// Le lien « Select by » que GFS pose lui-même (contrats 4.5, point 8), dans un vrai Grist (grist-static), à la vraie souris. La section de GFS n'est pas reliée à l'arrivée et la page n'a qu'une
// grille de la même table (CLIENTS) :
//   1. GFS relie sa section à la grille tout seul, le dit, et garde la marque `gfs.grille` dans les réglages de la vue ;
//   2. l'app ouverte (la sonde I, qui s'abonne comme Publipostage+) reçoit la ligne que la personne clique ensuite dans la grille : « La table de la page » suit le clic, sans rien régler ;
//   3. la personne retire le lien dans le panneau de droite de Grist, GFS se recharge : le lien ne revient pas (la marque).
//
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   REPO_DIR=<dépôt> node lab-server.mjs &   puis   REPO_DIR=<dépôt> node run-lien-grille.mjs
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const LINKED = 'Cursor:Same-Table';
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `lien-grille-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme, probes: true, grille: true });
const { page } = lab;
let frame = lab.frame;
await lab.fitPanel(undefined, 700, 400); // le panneau de référence (charte)

// Les sections de la page telles que Grist les garde : la grille et le widget de GFS, avec le lien de ce dernier.
const sections = target => target.evaluate(async () => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  return data.id.map((id, i) => ({ id, parentKey: data.parentKey[i], parentId: data.parentId[i], tableRef: data.tableRef[i], lien: data.linkSrcSectionRef[i] }));
});
const own = list => list.find(item => item.parentKey === 'custom');
const grid = list => list.find(item => item.parentKey === 'record');
const toast = target => target.evaluate(() => { const el = document.getElementById('toast'); return el && !el.hidden ? el.textContent : ''; });
const options = target => target.evaluate(() => grist.getOptions());

// La personne règle « Select by » de la section de GFS (panneau de droite, onglet « Data »).
async function selectBy(label) {
  await page.getByText('CLIENTS Custom', { exact: false }).first().click({ position: { x: 20, y: 5 } });
  await page.waitForTimeout(500);
  const panel = page.locator('.test-right-panel');
  await panel.getByText('Data', { exact: true }).first().click();
  await panel.getByText(/^(Select widget|CLIENTS)$/).first().click();
  await page.waitForTimeout(400);
  await page.getByText(label, { exact: true }).last().click();
  await page.waitForTimeout(1200);
}
const chooseRow = async name => { await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(1000); };
const readProbe = app => app.evaluate(() => JSON.parse(document.body.dataset.lecture || '{}'));
async function until(app, wanted) {
  for (let i = 0; i < 40; i++) {
    const seen = await readProbe(app);
    if (wanted(seen)) return seen;
    await page.waitForTimeout(100);
  }
  return readProbe(app);
}
const named = name => seen => Boolean(seen.ligne && seen.ligne.Nom === name);

say('\n=== GFS relie sa section à la grille tout seul ===');
// Le lien se pose quelques secondes après l'ouverture (le temps que Grist dise la table) : la phrase de GFS est vue, puis le lien lu dans la table des sections.
let said = '';
for (let i = 0; i < 80 && !said; i++) { said = await toast(frame); if (!said) await page.waitForTimeout(100); }
say('phrase de GFS :', said);
await lab.shotPanel(run, '1-phrase');
const box = await frame.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }; });
const WORDS = lang === 'fr' ? /GFS a relié ce widget à la grille de « Clients »/ : /GFS linked this widget to the “Clients” grid/;
check('GFS dit qu\'il a relié le widget à la grille de « Clients »', WORDS.test(said), said);
check('la phrase tient dans le panneau de 700 px, sans le dépasser', box.left >= 0 && box.right <= box.width && box.scrollWidth <= box.width, box);
let list = await sections(frame);
check('la section de GFS suit la grille (linkSrcSectionRef = la grille de la page)', own(list).lien === grid(list).id && grid(list).id > 0, list);
const kept = await options(frame);
check('la marque `gfs.grille` est dans les réglages de la vue', kept && kept['gfs.grille'] === 'lie', kept);
await lab.shot(run, '2-relie');

say('\n=== « La table de la page » suit la ligne cliquée, sans bouton « Ligne » ===');
const app = await lab.openApp('sonde-i', /i-lecture\//);
await page.waitForTimeout(2000);
let seen = await readProbe(app);
check('l\'app sait sa section reliée (settings.linking.asTarget)', Boolean(seen.lien) && seen.lien.asTarget === LINKED, seen.lien);
await chooseRow('Martin');
seen = await until(app, named('Martin'));
check('la ligne cliquée dans la grille (Martin) arrive à l\'app', named('Martin')(seen), seen.ligne);
await chooseRow('Dupont');
seen = await until(app, named('Dupont'));
check('puis la suivante (Dupont)', named('Dupont')(seen), seen.ligne);

say('\n=== La personne retire le lien : il ne revient pas ===');
await selectBy('Select widget');
list = await sections(frame);
check('le lien est retiré dans la table des sections', own(list).lien === 0, list);
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(4500); // plus que l'attente de la table et que celle du lien
list = await sections(frame);
check('GFS rechargé : le lien n\'est pas reposé (la marque)', own(list).lien === 0, list);
check('GFS ne dit rien', (await toast(frame)) === '', await toast(frame));
await lab.shot(run, '3-retire-et-recharge');
await lab.browser.close();
