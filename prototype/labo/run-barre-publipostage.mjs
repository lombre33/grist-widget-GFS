// La barre de GFS devant la vraie Publipostage+ (la version que GFS référence), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris : ce que la barre recouvre de l'app aux quatre bords, tant
// que l'app n'écarte rien (consigne 025 : l'app n'a pas encore le code). L'app est ouverte sur le modèle que la personne ouvre (« Contrat de prestation »), le cadre de l'app est plein (aucune bande) ; pour chaque
// bord, la passe relève chaque contrôle visible de l'app (boutons, champs, liens, zone d'écriture) que la barre recouvre, en tout ou en partie, et le dit : c'est ce que l'app doit écarter pour que
// rien ne soit sous la barre. Elle vérifie aussi ce qui doit rester vrai quoi qu'il arrive : la barre est à l'écran à chaque bord, l'app répond encore (son état d'enregistrement ne change pas) et un clic dans le
// coin bas droit atteint l'app (là où la pastille du zoom et le ▶ sont). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `barre-publipostage-${lang}-${scheme}`;
const EDGES = { fr: { gauche: 'À gauche', haut: 'En haut', droite: 'À droite', bas: 'En bas' }, en: { gauche: 'Left', haut: 'Top', droite: 'Right', bas: 'Bottom' } }[lang];
const OPEN = 'Contrat de prestation';

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
const frame = lab.frame;
await frame.locator('.ls-row', { hasText: OPEN }).first().waitFor({ timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage', /\/apps\/publipostage\//, frame);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const dockRect = () => frame.evaluate(() => { const r = document.getElementById('floaters').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, largeur: r.width, hauteur: r.height }; });
const dockEdge = () => frame.evaluate(() => { const d = document.getElementById('floaters'); return { edge: d.dataset.edge, visible: !d.hidden }; });
// Les contrôles de l'app qu'une main peut atteindre, avec leur rectangle dans le cadre de l'app (le même repère que la barre : le cadre de l'app remplit la scène).
const controls = () => app.evaluate(() => {
  const label = el => (el.getAttribute('aria-label') || el.title || el.textContent || el.id || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  const wanted = 'button, [role="button"], input, select, textarea, a[href], [contenteditable="true"], .ProseMirror';
  return [...document.querySelectorAll(wanted)].map(el => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || style.visibility === 'hidden' || style.display === 'none' || el.closest('[hidden]')) return null;
    return { nom: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} « ${label(el)} »`, x: r.left, y: r.top, largeur: r.width, hauteur: r.height };
  }).filter(Boolean);
});
const overlap = (a, b) => {
  const w = Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const centerIn = (a, b) => a.x + a.largeur / 2 >= b.x && a.x + a.largeur / 2 <= b.x + b.largeur && a.y + a.hauteur / 2 >= b.y && a.y + a.hauteur / 2 <= b.y + b.hauteur;

const status0 = await app.evaluate(() => document.getElementById('status-msg').textContent);
const all = await controls();
say(`l'app compte ${all.length} contrôles visibles à 700 × 400 ;`, 'état :', status0.trim().slice(0, 60));
const result = {};
for (const edge of ['gauche', 'haut', 'droite', 'bas']) {
  const now = (await dockEdge()).edge;
  if (now !== edge) {
    await frame.locator('#floater-place').click();
    await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${EDGES[edge]}$`) }).click();
    await page.waitForTimeout(500);
  }
  const rect = await dockRect();
  const here = await controls();
  const covered = here.map(c => ({ ...c, part: Math.round((100 * overlap(c, rect)) / (c.largeur * c.hauteur)), centre: centerIn(c, rect) })).filter(c => c.part > 0);
  result[edge] = covered.map(c => `${c.nom} ${c.part} %${c.centre ? ' (centre)' : ''}`);
  say(`bord ${edge} : la barre (${Math.round(rect.largeur)} × ${Math.round(rect.hauteur)} à x ${Math.round(rect.x)}, y ${Math.round(rect.y)}) recouvre ${covered.length} contrôle(s) de l'app :`, result[edge]);
  check(`${edge} : la barre est à l'écran à ce bord`, (await dockEdge()).visible && (await dockEdge()).edge === edge);
  await lab.shotPanel(run, `bord-${edge}`, frame);
}
const status1 = await app.evaluate(() => document.getElementById('status-msg').textContent);
check('l\'app répond toujours à chaque bord : son état n\'a pas changé', status0 === status1, { avant: status0.slice(0, 60), apres: status1.slice(0, 60) });
const corner = await app.locator('body').click({ position: { x: 690, y: 390 }, trial: true, timeout: 3000 }).then(() => true, () => false);
check('le coin bas droit de l\'app est atteint par la vraie souris (la barre ne le recouvre plus)', corner);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
