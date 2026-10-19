// Ouvrir le bon modèle de Publipostage+ depuis l'explorateur de GFS (consigne 010 ; contrats 5.2 point 3 et 5.4 point 1), avec la vraie app, celle que GFS référence, dans un vrai Grist, à
// 700 × 400, à la vraie souris et au vrai clavier. Le double-clic d'un fichier lance l'app sur ce modèle (l'`ouverture` du contexte) ; l'app déjà ouverte reçoit l'appel `ouvrir`, et pose
// sa question « Enregistrer / Abandonner / Annuler » dans le panneau quand des modifications attendent : GFS attend, sans rien dire. « Nouveau » garde la phrase provisoire : l'app ne crée
// pas encore de fichier vierge. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `ouvrir-publipostage-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { opened: /Ouvert depuis l.explorateur\./, provisional: /Provisoire/, buttons: ['Annuler', 'Abandonner', 'Enregistrer'] }
  : { opened: /Opened from the explorer\./, provisional: /Provisional/, buttons: ['Cancel', 'Discard', 'Save'] };
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
// La personne a un modèle ★ (par défaut) : c'est celui que l'app ouvre d'elle-même, le double-clic doit passer devant.
await lab.frame.evaluate(() => grist.docApi.applyUserActions([['UpdateRecord', 'Publipostage_Modeles', 1, { EstParDefaut: true }]]));

// GFS repart (le document garde ses tables) : l'explorateur d'abord, aucune app ouverte.
let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
await restart();

const row = text => frame.locator('.ls-row', { hasText: text }).first();
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
// Ce que la personne voit dans l'app : le modèle ouvert (numéro, nom, texte) et le coin d'état.
const shown = () => app.evaluate(() => ({
  id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value,
  text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent,
}));
const waitShown = async (name, ms = 12000) => {
  for (let i = 0; i < ms / 100; i++) {
    const seen = await shown().catch(() => null);
    if (seen && seen.name === name) return seen;
    await page.waitForTimeout(100);
  }
  return shown().catch(() => null);
};
// L'app a fini de démarrer quand son coin d'état a dit quelque chose.
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const goRoot = async () => { if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click(); };
const showFiles = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await goRoot();
  await frame.locator('.ls-row', { hasText: 'Quittance de loyer' }).first().waitFor();
};
// Ce que le document retient : les modèles (tous leurs champs, la date comprise) et les réglages de la section.
const snapshot = () => frame.evaluate(async () => JSON.stringify({
  modeles: await grist.docApi.fetchTable('Publipostage_Modeles'), vue: (await grist.docApi.fetchTable('_grist_Views_section')).options,
}));
const contentOf = name => frame.evaluate(async n => {
  const data = await grist.docApi.fetchTable('Publipostage_Modeles');
  return data.Contenu[data.Nom.indexOf(n)];
}, name);

// 1. « Nouveau » quand l'app n'est pas ouverte : elle démarre sur son modèle habituel (le ★), GFS dit pourquoi (elle ne sait pas encore créer un fichier vierge).
await frame.locator('.btn.primary').click();
await frame.locator('.menu-item', { hasText: /Document/ }).click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
const usual = await shown().catch(() => ({ name: '' }));
say('modèle habituel de l\'app :', usual, 'phrase de GFS :', await toast());
check('« Nouveau » : GFS dit que Publipostage+ ne sait pas encore créer un fichier, l\'app s\'ouvre sur son modèle habituel (le ★)', WORDS.provisional.test(await toast()) && /Publipostage\+/.test(await toast()) && usual.name === 'Feuille d’émargement' && !WORDS.opened.test(usual.status), { usual, phrase: await toast() });
const base = await snapshot();

// 2. Le double-clic d'un fichier quand l'app n'est pas ouverte : elle démarre sur CE modèle.
await restart();
await row('Contrat de prestation').dblclick();
app = await lab.appFrame(/publipostage/);
let seen = await waitShown('Contrat de prestation');
say('au démarrage :', seen, 'phrase de GFS :', await toast());
check('le double-clic lance l\'app sur le modèle cliqué, avant le ★', seen.name === 'Contrat de prestation' && seen.text === 'Contrat de prestation' && seen.name !== usual.name, { seen, usual });
check('le coin d\'état dit pourquoi, et GFS n\'ajoute aucune phrase', WORDS.opened.test(seen.status) && (await toast()) === '' && (await explorerHidden()), { status: seen.status, phrase: await toast() });
await waitStarted();
await app.evaluate(() => { window.__marque = 'avant'; });

// 3. L'app est déjà ouverte : GFS lui envoie l'appel `ouvrir`, elle change de modèle sans se recharger.
await showFiles();
await row('Quittance de loyer').dblclick();
seen = await waitShown('Quittance de loyer');
say('app déjà ouverte :', seen, 'phrase de GFS :', await toast());
check('l\'app déjà ouverte ouvre le modèle cliqué, dans le même cadre (elle n\'est pas rechargée)',
  seen.name === 'Quittance de loyer' && seen.text === 'Quittance de loyer' && (await app.evaluate(() => window.__marque)) === 'avant' && page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length === 1, seen);
check('le coin d\'état dit pourquoi, l\'explorateur se ferme, GFS n\'ajoute aucune phrase', WORDS.opened.test(seen.status) && (await explorerHidden()) && (await toast()) === '', { status: seen.status, phrase: await toast() });

// 4. Le modèle déjà ouvert : rien ne change.
await showFiles();
await row('Quittance de loyer').dblclick();
await page.waitForTimeout(800);
const again = await shown();
check('le modèle demandé est déjà ouvert : rien ne change, l\'explorateur se ferme, aucune phrase', JSON.stringify(again) === JSON.stringify(seen) && (await explorerHidden()) && (await toast()) === '', { again, phrase: await toast() });
check('rien n\'est écrit dans le document par ces ouvertures (ni modèle, ni ★, ni réglage de la vue)', (await snapshot()) === base);

// 5. Des modifications attendent : l'app pose sa question dans le panneau, GFS attend sans rien dire. L'enregistrement automatique de l'app (toutes les 2,5 s) peut passer entre la frappe
//    et la demande : elle enregistre alors, ouvre sans question, et l'essai recommence sur l'autre modèle (jamais plus de huit fois).
const dialog = () => app.evaluate(() => {
  const overlay = document.getElementById('pp-dialog-modal');
  if (!overlay || getComputedStyle(overlay).display === 'none') return null;
  const box = overlay.querySelector('.modal-content').getBoundingClientRect();
  return { buttons: [...overlay.querySelectorAll('.pp-modal-actions button')].filter(b => !b.hidden).map(b => b.textContent), inPanel: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
});
const typeAtEnd = async text => {
  const box = await app.locator('.ProseMirror p').first().boundingBox();
  await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
  await page.keyboard.press('End');
  await page.keyboard.type(text);
};
const pair = { open: 'Quittance de loyer', other: 'Contrat de prestation' };
const pending = async (token, via) => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const typed = `${token}${attempt}`;
    await typeAtEnd(` ${typed}`);
    await showFiles();
    if (via === 'bouton') { await row(pair.other).click(); await frame.locator('.ex-foot .btn').first().click(); } else await row(pair.other).dblclick();
    for (let i = 0; i < 25 && !(await dialog()); i++) await page.waitForTimeout(100);
    if (await dialog()) return { typed, attempt };
    say(`(essai ${attempt} : l'enregistrement automatique est passé, l'app a ouvert sans question)`);
    [pair.open, pair.other] = [pair.other, pair.open];
    await waitShown(pair.open);
  }
  return null;
};
const button = label => app.locator('#pp-dialog-modal .pp-modal-actions button', { hasText: label });

let episode = await pending('ANNULE', 'bouton');
let asked = episode && (await dialog());
await lab.shotPanel(run, '1-question', frame);
check('des modifications attendent : l\'app pose sa question dans le panneau (Annuler, Abandonner, Enregistrer), l\'explorateur est fermé, GFS ne dit rien',
  Boolean(asked) && asked.inPanel && asked.buttons.join('|') === WORDS.buttons.join('|') && (await explorerHidden()) && (await toast()) === '', { asked, phrase: await toast() });
await page.waitForTimeout(1500);
check('GFS attend la personne sans délai : après 1,5 s, la question est toujours là, aucune phrase', Boolean(await dialog()) && (await toast()) === '');
await button(WORDS.buttons[0]).click();
await page.waitForTimeout(800);
seen = await shown();
check('« Annuler » : le modèle ouvert reste, avec ce qui a été tapé ; GFS ne dit rien', seen.name === pair.open && seen.text.includes(episode.typed) && (await toast()) === '' && !(await dialog()), { seen, phrase: await toast() });

episode = await pending('ABANDONNE', 'double-clic');
await button(WORDS.buttons[1]).click();
const left = pair.open;
seen = await waitShown(pair.other);
check('« Abandonner » : le modèle demandé s\'ouvre et dit pourquoi, ce qui a été tapé n\'est pas gardé', seen.name === pair.other && WORDS.opened.test(seen.status) && !(await contentOf(left)).includes(episode.typed), { seen, content: await contentOf(left) });
[pair.open, pair.other] = [pair.other, pair.open];

episode = await pending('ENREGISTRE', 'double-clic');
await button(WORDS.buttons[2]).click();
const saved = pair.open;
seen = await waitShown(pair.other);
check('« Enregistrer » : le modèle quitté est enregistré (l\'écriture de l\'app passe par GFS pendant que son appel attend), puis le modèle demandé s\'ouvre',
  seen.name === pair.other && (await contentOf(saved)).includes(episode.typed) && WORDS.opened.test(seen.status), { seen, content: await contentOf(saved) });
[pair.open, pair.other] = [pair.other, pair.open];
await lab.shotPanel(run, '2-apres-enregistrement', frame);

// 6. Un fichier rangé dans un dossier : l'explorateur y entre, le double-clic ouvre le modèle (le dossier part dans l'appel, l'app l'ignore).
await showFiles();
await row('Facturation').dblclick();
await frame.locator('.ls-row', { hasText: 'Facture / devis multi-TVA' }).first().waitFor();
await row('Facture / devis multi-TVA').dblclick();
seen = await waitShown('Facture / devis multi-TVA');
check('un fichier d\'un dossier s\'ouvre aussi : l\'app ouvre ce modèle', seen && seen.name === 'Facture / devis multi-TVA' && seen.text === 'Facture / devis multi-TVA' && (await explorerHidden()), seen);

// 7. « Nouveau » quand l'app est ouverte : l'explorateur se ferme, GFS dit ce qui est provisoire, l'app n'a pas bougé.
await showFiles();
await frame.locator('.btn.primary').click();
await frame.locator('.menu-item', { hasText: /Document/ }).click();
await page.waitForTimeout(600);
const afterNew = await shown();
check('« Nouveau » avec l\'app ouverte : la phrase provisoire, l\'app garde son modèle', WORDS.provisional.test(await toast()) && /Publipostage\+/.test(await toast()) && afterNew.name === 'Facture / devis multi-TVA' && (await explorerHidden()), { afterNew, phrase: await toast() });
await lab.shotPanel(run, '3-nouveau', frame);
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
