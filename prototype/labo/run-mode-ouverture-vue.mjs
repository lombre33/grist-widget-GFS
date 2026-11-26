// Le mode d'ouverture de la vue de Publipostage+ sous GFS (`pp_view_open_mode`, « Réglages > Vue > S'ouvre en » ; consigne 099, point 1 ; contrats 2.5, points 3 et 5), avec la vraie app dans un vrai Grist,
// à 700 × 400. La consigne 099 disait : « lu et essayé sur le manifeste, pas rejoué avec ton code dans un vrai Grist ». Voici le rejeu. Il demande une copie de l'app qui porte ce réglage (le sous-module
// `apps/publipostage` à `0b3799de` ou après : la référence de GFS est plus ancienne) et le miroir des bibliothèques (`build-mirror.sh`, refait avec cette copie).
//   1. Le choix « Lecture » est écrit dans la vue (`customView.widgetOptions.pp_view_open_mode`), sans refus (la phrase rouge « Ce choix n'est pas gardé » ne paraît pas) et sans barre « Enregistrer » de Grist.
//   2. GFS repart : le réglage est toujours dans le document ; un document ordinaire et un e-mail, ouverts par un double-clic quand l'app n'est pas ouverte, s'ouvrent en Lecture.
//   3. Un macro-modèle s'ouvrait en Édition, quoi que dise la vue (règle de l'app à `55d96c7c` : sa Lecture n'a rien à montrer d'un macro-modèle). Le porteur a choisi « Lecture aussi » (26/11, consigne 110) :
//      le constat 3 dit « CONSTAT » tant que l'app ne l'a pas fait, « OK » ensuite.
//   4. La vue a un modèle (Réglages > Vue > « Utiliser le modèle ouvert pour cette vue ») : GFS repart, la vue arrive sur l'app et ce modèle s'ouvre en Lecture.
//   5. Constat : l'app est déjà ouverte, la personne est passée en Édition, puis elle ouvre un autre document par l'explorateur : l'app garde le mode du moment (le réglage vaut au départ de l'app).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check, constat } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `mode-ouverture-vue-${lang}-${scheme}`;
const FILES = { document: 'Contrat de prestation', other: 'Quittance de loyer', email: 'Convocation de session', macro: 'Dossier de formation', folder: 'Formation' };
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);

let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const goRoot = async () => { if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click(); };
const showFiles = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await goRoot();
  await frame.locator('.ls-row', { hasText: FILES.other }).first().waitFor();
};
// Un fichier rangé dans « Formation » : on entre dans le dossier, puis double-clic.
const openInFolder = async name => {
  await row(FILES.folder).dblclick();
  await frame.locator('.ls-row', { hasText: name }).first().waitFor();
  await row(name).dblclick();
};
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
};
// Ce que la personne voit : le modèle ouvert et le bouton de mode allumé.
const shown = () => app.evaluate(() => ({
  name: document.getElementById('template-name').value,
  mode: document.getElementById('btn-mode-read').classList.contains('active') ? 'read' : (document.getElementById('btn-mode-edit').classList.contains('active') ? 'edit' : 'none'),
}));
const viewOptions = () => frame.evaluate(async () => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  return data.id.map((id, i) => ({ parentKey: data.parentKey[i], text: data.options[i] })).filter(item => item.parentKey === 'custom').map(item => JSON.parse(JSON.parse(item.text).customView).widgetOptions);
});
const saveBars = () => page.locator('.test-section-menu-small-btn-save').count();
const openViewSettings = async () => {
  await app.locator('#v2-btn-settings').click();
  await app.locator('[data-settings-tab="rowTemplate"]').click();
};

// Le premier départ de l'app (par la fenêtre des apps), puis le réglage au vrai clic.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
await openViewSettings();
await app.locator('#settings-viewopen-mode').selectOption('read');
await page.waitForTimeout(1500);
const sentence = await app.locator('#settings-viewopen-status').innerText();
const written = await viewOptions();
say('1. liste :', await app.locator('#settings-viewopen-mode').inputValue(), '| phrase :', sentence, '| options de la vue :', written, '| barres « Enregistrer » :', await saveBars());
check('1. « Lecture » est écrit dans la vue, sans refus et sans barre « Enregistrer »',
  written.length === 1 && written[0].pp_view_open_mode === 'read' && !/gardé|kept/.test(sentence) && (await saveBars()) === 0, { written, sentence });
await lab.shotPanel(run, '1-reglage-lecture', frame).catch(() => {});
await page.keyboard.press('Escape');

// 2. GFS repart, l'app n'est pas ouverte : un document ordinaire, puis un e-mail.
await restart();
const kept = await viewOptions();
await row(FILES.document).dblclick();
app = await lab.appFrame(/publipostage/);
await waitStarted();
const document1 = await shown();
say('2. document ordinaire au départ :', document1, '| options de la vue après redémarrage :', kept);
check('2. le réglage est toujours dans le document après le redémarrage de GFS', kept.length === 1 && kept[0].pp_view_open_mode === 'read', kept);
check('2. un document ordinaire ouvert par un double-clic s\'ouvre en Lecture', document1.name === FILES.document && document1.mode === 'read', document1);
await restart();
await openInFolder(FILES.email);
app = await lab.appFrame(/publipostage/);
await waitStarted();
const email = await shown();
say('2. e-mail au départ :', email);
check('2. un e-mail ouvert par un double-clic s\'ouvre en Lecture', email.name === FILES.email && email.mode === 'read', email);

// 3. Le macro-modèle : l'Édition, par la règle de l'app.
await restart();
await openInFolder(FILES.macro);
app = await lab.appFrame(/publipostage/);
await waitStarted();
const macro = await shown();
say('3. macro-modèle au départ :', macro);
check('3. le macro-modèle du labo s\'est ouvert (au départ de l\'app, par un double-clic)', macro.name === FILES.macro && macro.mode !== 'none', macro);
// Le choix du porteur du 26/11 (consigne 110) : « Lecture aussi pour les macro-modèles ». Tant que l'app ouvre toujours l'Édition, c'est un constat, pas un échec.
constat('3. un macro-modèle s\'ouvre en Lecture quand la vue le dit (consigne 110 ; l\'app l\'ouvrait en Édition à `55d96c7c`)', macro.mode === 'read', macro);
await openViewSettings();
const hint = await app.locator('#settings-viewopen-section').first().innerText();
say('3. petit texte du réglage :', hint.slice(-200));
await page.keyboard.press('Escape');
await lab.shotPanel(run, '3-macro-modele', frame).catch(() => {});

// 4. La vue a un modèle : elle arrive sur l'app, ce modèle s'ouvre en Lecture.
await restart();
await openInFolder(FILES.email);
app = await lab.appFrame(/publipostage/);
await waitStarted();
await openViewSettings();
await app.locator('#settings-viewtemplate-set').click();
await page.waitForTimeout(1500);
const withModel = await viewOptions();
await page.keyboard.press('Escape');
await restart();
await page.waitForTimeout(3000);
app = await lab.appFrame(/publipostage/);
await waitStarted();
const arrival = await shown();
say('4. options de la vue :', withModel, '| arrivée :', arrival);
check('4. la vue arrive sur l\'app et le modèle de la vue s\'ouvre en Lecture',
  withModel[0].pp_view_open_mode === 'read' && Boolean(withModel[0].modeleDeLaVue) && arrival.name === FILES.email && arrival.mode === 'read', { withModel, arrival });

// 5. Constat : l'app déjà ouverte, la personne en Édition, un autre document par l'explorateur.
await app.locator('#btn-mode-edit').click();
await page.waitForTimeout(500);
await showFiles();
await row(FILES.other).dblclick();
await page.waitForTimeout(3000);
const later = await shown();
say('5. app déjà ouverte, personne en Édition, autre document :', later);
constat('5. l\'app déjà ouverte garde le mode du moment (Édition) : le réglage de la vue vaut au départ de l\'app', later.name === FILES.other && later.mode === 'edit', later);

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
