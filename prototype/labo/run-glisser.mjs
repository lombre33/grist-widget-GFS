// Le glisser-déposer HTML5 dans le cadre d'une app de GFS (une question de Tuesday dans son GFS-ETAT.md : son kanban et son calendrier glissent des tâches), dans un vrai Grist, à 700 × 400, à la
// vraie souris : la sonde U (labo/sondes/u-glisser/) garde le gabarit de Tuesday (un `<article draggable>` déposé dans des colonnes, un `<button draggable>` déposé sur un jour) sous sa politique
// de sécurité, dans le sous-cadre que GFS pose (`sandbox` sans `allow-same-origin`). La souris de Playwright fait le glissement du navigateur (Chromium) : ce que mesure cette passe est ce que
// le cadre de GFS laisse faire, pas ce que Firefox fait de son côté (le labo n'a que Chromium : LAB_BROWSER=firefox sur une machine qui l'a). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `glisser-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);

const waitFor = async (label, test, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const app = await lab.openApp('sonde-u', /u-glisser\//, frame);
const probe = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
await waitFor('le contexte', async () => (await probe()).contexte);
await frame.waitForFunction(() => { const el = document.querySelector('.app-frame'); return Boolean(el) && !el.classList.contains('app-frame--hidden'); }, null, { timeout: 15000 });
await app.evaluate(() => { window.__avant = true; });
const shot = name => lab.shotPanel(run, name, frame);

const sandbox = await frame.evaluate(() => document.querySelector('.app-frame').getAttribute('sandbox'));
say('sandbox du sous-cadre :', sandbox);
check('le sous-cadre de l\'app est isolé : pas d\'allow-same-origin', typeof sandbox === 'string' && !sandbox.includes('allow-same-origin'), sandbox);

// La vraie souris : appuyer sur le centre de l'élément, le tirer (le navigateur ne lance le glissement qu'après quelques pixels), puis le lâcher au centre de la cible.
const centre = async locator => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const drag = async (from, to) => {
  const a = await centre(app.locator(from));
  const b = await centre(app.locator(to));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(250);
  return probe();
};
const inside = (zone, item) => app.locator(`${zone} ${item}`).count();

say('=== 1. kanban : une carte (article draggable) d\'une colonne à l\'autre ===');
await shot('1-depart');
let seen = await drag('#carte-1', '#col-encours');
say('vu par l\'app :', seen);
check('dragstart reçu par la carte, avec le texte posé dans dataTransfer', seen.departs.includes('carte-1'), seen.departs);
check('dragover reçu par la colonne visée (le dépôt est permis)', seen.survols > 0, seen.survols);
check('drop reçu par la colonne « En cours » avec le texte de dataTransfer', seen.depots.some(d => d.zone === 'encours' && d.texte === 'carte-1'), seen.depots);
check('dragend : le navigateur retient l\'effet « move »', seen.fins.some(f => f.id === 'carte-1' && f.effet === 'move'), seen.fins);
check('la carte est dans la colonne d\'arrivée et plus dans celle du départ', (await inside('#col-encours', '#carte-1')) === 1 && (await inside('#col-afaire', '#carte-1')) === 0);
await shot('2-apres-le-premier-depot');

seen = await drag('#carte-2', '#col-fait');
check('une seconde carte, sur une autre colonne : mêmes événements, même résultat', seen.depots.some(d => d.zone === 'fait' && d.texte === 'carte-2') && (await inside('#col-fait', '#carte-2')) === 1, seen.depots);

say('=== 2. calendrier : une puce (button draggable) d\'un jour à l\'autre ===');
seen = await drag('#puce-1', '#jour-jeudi');
say('vu par l\'app :', seen);
check('la puce (un bouton) part, passe et se dépose sur « jeudi »', seen.departs.includes('puce-1') && seen.depots.some(d => d.zone === 'jeudi' && d.texte === 'puce-1') && (await inside('#jour-jeudi', '#puce-1')) === 1, seen.depots);
check('dragend : effet « move » aussi pour la puce', seen.fins.some(f => f.id === 'puce-1' && f.effet === 'move'), seen.fins);
await shot('3-puce-deposee');

say('=== 3. lâcher hors de toute cible : rien ne bouge ===');
const before = (await probe()).depots.length;
seen = await drag('#carte-1', 'h1');
check('aucun dépôt de plus, la carte reste où elle était, l\'effet retenu est « none »', seen.depots.length === before && (await inside('#col-encours', '#carte-1')) === 1 && seen.fins.at(-1).id === 'carte-1' && seen.fins.at(-1).effet === 'none', seen.fins.at(-1));

say('=== 4. GFS n\'a rien perdu ===');
check('le cadre de l\'app n\'a pas été rechargé par les glissements', await app.evaluate(() => window.__avant === true));
check('l\'explorateur de GFS est resté fermé', await frame.locator('.ex').isHidden());
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
