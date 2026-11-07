// Grist-BI (référencée à 8eb479b) répond à `fermer` (consignes 006 et 008 de GFS à Grist-BI, contrats 5.4 point 3) : ce qu'elle a « en attente » est écrit avant que GFS détruise son cadre.
// Dans un vrai Grist, à 700 × 400, à la vraie souris : la personne ajoute une page (le bouton « + Page » de l'app), puis, avant que l'app ait enregistré, ouvre « Nouveau > Document » de Publipostage+.
// Le seul changement de l'app pour cet essai : son délai d'enregistrement (600 ms) devient très long, de sorte que **seule** la réponse à `fermer` peut écrire la page avant le départ ; sans lui,
// l'app aurait enregistré d'elle-même pendant les clics de la personne et l'essai ne prouverait rien.
//   1. L'app est ouverte sur un rapport vierge (« Nouveau > Rapport BI ») ; la page « Pause » est ajoutée ; le document ne porte encore aucune ligne de configuration (rien n'est enregistré).
//   2. « Nouveau > Document » (Publipostage+) : GFS appelle `fermer { raison: 'nouveau' }`, l'app enregistre puis répond `{ ferme: true }` ; son cadre disparaît, celui de Publipostage+ le remplace.
//   3. Le document porte une ligne de configuration, nommée « Rapport BI 1 », dont la configuration contient la page « Pause » ; aucun avertissement de GFS.
// LAB_SANS_ONCLOSE=1 : le témoin. L'abonné `GfsLink.onClose` de l'app est retiré (l'app d'avant la 006) : le kit répond `GFS_INCONNU`, GFS détruit le cadre et la page ajoutée est perdue.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `bi-fermer-${lang}-${scheme}`;
const WORDS = lang === 'fr' ? { report: 'Rapport BI', document: 'Document' } : { report: 'BI report', document: 'Document' };
const BI_URL = /(apps\/bi|Grist-BI)\//;
const PP_URL = /(apps\/publipostage|publipostageGrist)\//;
const DEBOUNCE = { chemin: '/prototype/apps/bi/js/main.js', de: '    }, 600);\n  }\n\n  // Partagé par scheduleSave/flushPendingSave', vers: '    }, 600000);\n  }\n\n  // Partagé par scheduleSave/flushPendingSave' };

const WITHOUT = process.env.LAB_SANS_ONCLOSE === '1';
const NO_ONCLOSE = { chemin: '/prototype/apps/bi/js/main.js', de: "GfsLink.onClose(async () => {\n        await flushPendingSave();\n        return true;\n      });", vers: '/* témoin : pas d\'abonné à fermer */' };
const lab = await startLab({ lang, colorScheme: scheme, patches: WITHOUT ? [DEBOUNCE, NO_ONCLOSE] : [DEBOUNCE] });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && isGfsWarning(message.text())) warnings.push(message.text()); });
// La page est ajoutée par `prompt()` dans l'app (le sous-cadre a `allow-modals`) : la personne tape « Pause » et valide.
page.on('dialog', dialog => dialog.accept('Pause').catch(() => {}));
await lab.fitPanel(undefined, 700, 400);

let frame = lab.frame;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
// La configuration relue : { table: false } sans table, sinon chaque ligne avec son nom et le nom de ses pages.
const configState = () => frame.evaluate(async () => {
  if (!(await grist.docApi.listTables()).map(String).includes('BI_Dashboard_Config')) return { table: false, rows: [] };
  const data = await grist.docApi.fetchTable('BI_Dashboard_Config');
  const pages = json => { try { return JSON.parse(json).pages.map(each => each.name); } catch (error) { return null; } };
  return { table: true, rows: data.id.map((id, i) => ({ id, TableId: data.TableId[i], Nom: data.Nom ? data.Nom[i] : undefined, pages: pages(data.ConfigJSON[i]) })) };
});

await restart();
await lab.openModules(frame);
await frame.locator('[data-fk="app:bi"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();

// ----- 1. Un rapport vierge, une page ajoutée, rien d'enregistré.
await frame.locator('.btn.primary').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu-item', { hasText: WORDS.report }).first().click();
const app = await lab.appFrame(BI_URL);
check('l\'app a un cadre', Boolean(app));
await app.locator('#table-select').waitFor();
await page.waitForTimeout(3000);
await app.locator('#add-page').click();
await page.waitForTimeout(1200);
const pagesShown = await app.evaluate(() => [...document.querySelectorAll('#page-tabs .page-tab, .page-tab')].map(each => each.textContent.replace(/\s+/g, ' ').trim()));
say('pages affichées dans l\'app :', JSON.stringify(pagesShown));
const before = await configState();
say('avant de partir, le document porte :', JSON.stringify(before));
check('la page « Pause » est dans l\'app', pagesShown.some(text => /Pause/.test(text)), pagesShown);
check('rien n\'est encore enregistré (le délai d\'enregistrement de l\'app est très long pour cet essai)', before.rows.length === 0, before);
await lab.shotPanel(run, '1-page-ajoutee', frame);

// ----- 2. La personne ouvre « Nouveau > Document » : GFS demande à l'app de se fermer.
await frame.locator('#floater-files').click();
await frame.locator('.ls-row').first().waitFor().catch(() => {});
await frame.locator('.btn.primary').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu-item', { hasText: new RegExp(`^\\s*${WORDS.document}`) }).first().click();
await page.waitForTimeout(6000);
const ppFrame = await lab.appFrame(PP_URL).catch(() => null);
const biFrame = page.frames().find(each => BI_URL.test(each.url()) && !each.isDetached());
await lab.shotPanel(run, '2-apres', frame);

// ----- 3. Ce que le document a gardé.
const after = await configState();
say('après son départ, le document porte :', JSON.stringify(after));
check('GFS a remplacé Grist-BI par Publipostage+ (le cadre de Grist-BI a disparu, celui de Publipostage+ existe)', !biFrame && Boolean(ppFrame), { bi: Boolean(biFrame), pp: Boolean(ppFrame) });
if (WITHOUT) {
  check('témoin : sans abonné à `fermer`, la page ajoutée est perdue (aucune ligne de configuration)', after.rows.length === 0, after);
} else {
  check('l\'app a enregistré avant de partir : une ligne de configuration, nommée « ' + WORDS.report + ' 1 »', after.rows.length === 1 && new RegExp(`^${WORDS.report} 1$`).test(after.rows[0].Nom || ''), after);
  check('et cette ligne porte la page ajoutée', after.rows.length === 1 && (after.rows[0].pages || []).includes('Pause'), after.rows.map(row => row.pages));
}
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
