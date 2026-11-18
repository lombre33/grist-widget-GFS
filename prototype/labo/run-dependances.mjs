// La fenêtre « Dépendances » (Réglages › Dépendances…) dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright :
// événements du pointeur et du clavier du navigateur, jamais dispatchEvent). Lot 3 (18/11) : le choix de la source (« CDN | Copie figée ») d'une bibliothèque s'écrit
// dans la table `GFS_Rangement` comme celui de la fiche d'une app (contrats 2.6 points 12 et 14), « Tout en copie figée » pose sa question avant d'écrire, et le
// rapport s'exporte. Ce que GFS écrit, et ce que Grist renvoie au rechargement du cadre, ne se mesure que dans un vrai Grist (CLAUDE.md).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_READONLY=1 (la vue est ouverte en lecture seule : la fenêtre se grise et n'écrit rien).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { setExtension, closeModules } from './lab-gestes.mjs';
import { settingsRows, openSettings } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const readonly = process.env.LAB_READONLY === '1';
const run = `dependances-${lang}-${scheme}${readonly ? '-lecture-seule' : ''}`;
const lab = await startLab({ lang, colorScheme: scheme, query: readonly ? 'readonly=true' : '' });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;
const shot = name => lab.shotPanel(run, name, frame);
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const modes = async () => ((await lab.rangement(frame)).value || {}).publipostage?.modes || {};
const MENU_ENTRY = lang === 'en' ? /^Dependencies/ : /^Dépendances/;
const openWindow = async () => {
  await openSettings(frame);
  await settingsRows(frame).filter({ hasText: MENU_ENTRY }).click();
  await frame.locator('.dp').waitFor();
  await page.waitForTimeout(300);
};
const closeWindow = async () => { await frame.locator('[data-fk="dep-close"]').click(); await frame.locator('.dp').waitFor({ state: 'hidden' }); };
const rowOf = name => frame.locator('.dp-item', { has: frame.locator('.dp-name', { hasText: new RegExp(`^${name}$`) }) });
const openRow = async name => { const item = rowOf(name); if (!(await item.evaluate(node => node.classList.contains('is-open')))) await item.locator('.dp-row').click(); return item; };
const sourceRadios = item => item.locator('.dp-seg input[type="radio"]');
const checkedSource = async item => item.locator('.dp-seg input:checked').evaluate(node => node.dataset.source).catch(() => null);
const allButton = frame.locator('[data-fk="dep-all"]');

await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);
if (!readonly) {
  // L'extension « Graphique » de Publipostage+ est ajoutée par la fenêtre des apps (la table du document naît avec l'accord de la personne), comme le ferait la personne.
  await lab.openModules(frame);
  await setExtension(frame, 'ext:publipostage/graphique', true);
  await lab.settle(frame);
  await closeModules(page, frame);
} else if (await frame.locator('.mod').count()) await closeModules(page, frame);
check('rien d\'ouvert devant le réglage', (await frame.locator('.mod').count()) === 0);

// ----- La fenêtre : une ligne par bibliothèque, l'audit et le choix de la source dans le détail.
await openWindow();
say('titre :', await text(frame.locator('.dp-head')));
const names = await frame.locator('.dp-name').allInnerTexts();
check('la fenêtre liste les bibliothèques que GFS sert (echarts, plotly.js-dist-min, pdfjs-dist…)', names.length >= 10 && names.some(name => /echarts/.test(name)) && names.some(name => /plotly/.test(name)), names);
const before = await lab.rangement(frame);
check('l\'ouvrir n\'écrit rien : la table GFS_Rangement n\'est pas créée par la fenêtre', readonly ? before.table === false : (before.value.publipostage?.modes === undefined), before.value);
const echarts = await openRow('echarts');
await shot('1-ligne-ouverte');
say('source :', await text(echarts.locator('.dp-seg').locator('xpath=..')));

if (readonly) {
  check('lecture seule : tous les choix de la source sont grisés', (await echarts.locator('.dp-seg input:not(:disabled)').count()) === 0
    && (await sourceRadios(echarts).count()) === 2);
  check('lecture seule : « Tout… » est grisé', (await allButton.getAttribute('aria-disabled')) === 'true');
  await allButton.click({ force: true }); // Playwright tient aria-disabled pour « pas actif » : la vraie souris clique quand même
  await page.waitForTimeout(300);
  say('note :', await text(frame.locator('.dp .mod-note')));
  check('lecture seule : un clic sur « Tout… » dit pourquoi et ne demande rien', (await frame.locator('.ask').count()) === 0
    && /lecture|read-only|read only/i.test(await text(frame.locator('.dp .mod-note'))));
  check('lecture seule : rien n\'est écrit', (await lab.rangement(frame)).table === false);
  await shot('2-lecture-seule');
  await lab.browser.close();
  say('avertissements GFS :', warnings);
  process.exit(process.exitCode || 0);
}

check('CDN au départ (le défaut ne s\'écrit pas)', (await checkedSource(echarts)) === 'cdn' && Object.keys(await modes()).length === 0, await modes());
check('les deux choix sont offerts', (await echarts.locator('.dp-seg input:not(:disabled)').count()) === 2);

// ----- Un choix : « Copie figée » pour la bibliothèque, écrit tout de suite dans la table du document.
await echarts.locator('.dp-seg label', { hasText: /Copie figée|Frozen copy/ }).click();
await lab.settle(frame);
await page.waitForTimeout(400);
check('« Copie figée » écrit le mode de l\'extension Graphique dans le document', (await modes()).graphique === 'vendorise', await modes());
check('la fenêtre l\'affiche (état de la ligne relu)', (await checkedSource(rowOf('echarts'))) === 'vendorise' && (await rowOf('echarts').locator('.dp-tag.is-on').count()) === 1);
check('le clavier est resté sur le choix de la ligne', await frame.evaluate(() => (document.activeElement.dataset.fk || '').startsWith('dep-src-echarts')));
say('état :', await text(rowOf('echarts').locator('.dp-detail [role="status"]').first()));
await shot('3-copie-figee-choisie');

// ----- Le cadre de GFS est rechargé : le choix revient de la table.
const saved = await lab.rangement(frame);
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await openWindow();
check('rechargé : le choix « Copie figée » est revenu de la table', (await checkedSource(await openRow('echarts'))) === 'vendorise');
check('rechargé : rien n\'a été récrit', JSON.stringify(await lab.rangement(frame)) === JSON.stringify(saved));

// ----- « Tout… » : la question dit ce qui change ; Échap n'écrit rien ; l'accord écrit une fois par app. La fonction native « Éditeur » de Publipostage+ a sa copie dans l'app :
// aucune bibliothèque de GFS, mais « tout en copie figée » la prend (la fiche de l'app la propose aussi).
const label = () => text(allButton);
const bothCopy = { graphique: 'vendorise', 'natif:editeur': 'vendorise' };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
say('bouton :', await label());
check('une fonction reste en CDN (l\'éditeur) : le bouton propose « Tout en copie figée »', /copie figée|frozen copy/i.test(await label()), await label());
await allButton.click();
await frame.locator('.ask').waitFor();
say('question :', await text(frame.locator('.ask')));
check('la question nomme l\'app et la seule fonction qui change', /Publipostage\+ : Éditeur|Publipostage\+ : Editor/.test(await text(frame.locator('.ask'))) && !/Graphi/.test(await text(frame.locator('.ask'))));
check('le clavier est sur « Annuler » (le geste sûr d\'abord)', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'ask-no'));
check('la fenêtre « Dépendances » est inerte derrière la question', await frame.evaluate(() => document.querySelector('.dp').closest('.mod-scrim').inert === true));
await shot('4-question-tout-en-copie');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('Échap refuse : la question est partie, la fenêtre reste, rien n\'est écrit', (await frame.locator('.ask').count()) === 0
  && (await frame.locator('.dp').count()) === 1 && same(await modes(), { graphique: 'vendorise' }), await modes());
check('la fenêtre « Dépendances » n\'est plus inerte, le clavier a le bouton', await frame.evaluate(() => !document.querySelector('.dp').closest('.mod-scrim').inert
  && document.activeElement && document.activeElement.dataset.fk === 'dep-all'));
await allButton.click();
await frame.locator('.ask').waitFor();
await frame.locator('[data-fk="ask-yes"]').click();
await lab.settle(frame);
await page.waitForTimeout(400);
check('« Tout en copie figée » : l\'extension et la fonction native sont en copie figée', same(await modes(), bothCopy), await modes());
check('un seul geste, une seule écriture : les lignes réservées sont les deux de toujours', (await lab.rangement(frame)).rows === saved.rows, (await lab.rangement(frame)).rows);
say('note :', await text(frame.locator('.dp .mod-note')));
check('le bouton propose maintenant « Tout en CDN »', /CDN/.test(await label()), await label());
await shot('5-tout-en-copie-figee');
await allButton.click();
await frame.locator('.ask').waitFor();
say('question :', await text(frame.locator('.ask')));
await frame.locator('[data-fk="ask-yes"]').click();
await lab.settle(frame);
await page.waitForTimeout(400);
check('« Tout en CDN » : tout revient au défaut, qui ne s\'écrit pas', Object.keys(await modes()).length === 0, await modes());
await allButton.click();
await frame.locator('.ask').waitFor();
await frame.locator('[data-fk="ask-yes"]').click();
await lab.settle(frame);
await page.waitForTimeout(400);
check('« Tout en copie figée » une seconde fois : les deux y sont de nouveau', same(await modes(), bothCopy), await modes());

// ----- L'export : un fichier téléchargé, lisible, au bon format.
await frame.locator('[data-fk="dep-export"]').click();
await frame.locator('[data-fk="dep-export-cdx"]').waitFor();
await shot('6-export');
const downloaded = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await frame.locator('[data-fk="dep-export-cdx"]').click();
const file = await downloaded;
if (file) {
  const body = JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'));
  say('fichier :', file.suggestedFilename());
  check('le fichier CycloneDX 1.5 est téléchargé', /^gfs-dependances-\d{4}-\d\d-\d\d\.cdx\.json$/.test(file.suggestedFilename())
    && body.bomFormat === 'CycloneDX' && body.specVersion === '1.5' && body.components.length >= 10, Object.keys(body));
} else say('CONSTAT : pas de téléchargement reçu depuis le cadre du widget (le cadre de Grist le refuse ?) — voir la note de la fenêtre :', await text(frame.locator('.dp .mod-note')));
check('la fenêtre dit le nom du rapport (ou l\'échec)', /gfs-dependances|rapport|report/i.test(await text(frame.locator('.dp .mod-note'))), await text(frame.locator('.dp .mod-note')));
await closeWindow();
await lab.browser.close();
say('avertissements GFS :', warnings);
