// « Présenter » devant la barre de GFS (run-barre-ecartee.mjs, consigne 025 de Publipostage+) : le diaporama prend tout le cadre, donc GFS masque sa barre quand il s'ouvre (`GfsBar.hide(true)`) et la rend à chaque
// sortie (`GfsBar.hide(false)`, dans `stop`, le seul chemin de sortie de l'app). Chaque tour part d'une présentation ouverte, la barre à son bord : on lance (le bouton ▶ à la vraie souris, F5 depuis la première
// diapositive, Maj+F5 depuis celle du curseur), on vérifie que la barre n'est plus là (GFS ne la dessine plus et l'app ne reçoit plus de zone) et que le diaporama couvre tout le cadre, puis on sort d'une des quatre façons
// (Échap, le bouton ✕ à la vraie souris, une touche à l'écran de fin, un clic à l'écran de fin) et on vérifie qu'elle est revenue, au même bord, à la même place.
import { check, say } from './lab-common.mjs';
import { dockEdge } from './barre-lab.mjs';
import { readZone, barAgreesWithZone, centerOf, clickOpener, wait } from './barre-ecartee-lab.mjs';

const SHOW = '.pp-slide-show';
const EXIT = '.pp-slide-show-exit';
const PLAY = '.pp-slide-show-open';
const THUMB = '.pp-slide-strip .pp-slide-item[aria-selected="true"] .pp-slide-thumb';
// [comment on lance, comment on sort] : les quatre sorties de l'app, et les trois façons de lancer (le ▶ deux fois : il est la façon de la souris).
export const TOURS = [['play', 'escape'], ['f5', 'exit'], ['shift', 'end-key'], ['play', 'end-click']];
const NAMES = { play: 'le bouton ▶', f5: 'F5', shift: 'Maj+F5', escape: 'Échap', exit: 'le bouton ✕', 'end-key': 'une touche à l\'écran de fin', 'end-click': 'un clic à l\'écran de fin' };

async function until(r, test, ms = 4000) {
  for (let waited = 0; waited < ms; waited += 100) {
    if (await test()) return true;
    await wait(r, 100);
  }
  return false;
}
const showing = r => r.app.evaluate(sel => Boolean(document.querySelector(sel)), SHOW);
const atEnd = r => r.app.evaluate(() => { const end = document.querySelector('.pp-slide-show-end'); return Boolean(end) && !end.hidden; });
const barGone = async r => !(await dockEdge(r.frame)).visible && (await readZone(r.app)) === null;

// Le clavier dans l'app (une touche du clavier va au cadre qui a le focus) : un clic de la vraie souris sur la miniature du curseur, ou à défaut sur le texte.
async function focusApp(r) {
  if ((await clickOpener(r, THUMB)) !== 'clique') await clickOpener(r, '.tiptap p');
  await wait(r, 200);
}

// Lance le diaporama ; rend ce qui a été fait (le ▶ recouvert ou absent se remplace par F5, et le dit).
async function start(r, how) {
  if (how === 'play') {
    const at = await centerOf(r.app, PLAY);
    if (at && (await r.hand.reach(at.x, at.y))) { await r.hand.click(at.x, at.y); return 'play'; }
  }
  await focusApp(r);
  await r.page.keyboard.press(how === 'shift' ? 'Shift+F5' : 'F5');
  return how === 'play' ? 'f5, faute du bouton ▶' : how;
}

async function leave(r, how) {
  if (how === 'escape') { await r.page.keyboard.press('Escape'); return; }
  if (how === 'exit') {
    await r.hand.move(r.size[0] / 2, r.size[1] / 2, 3);
    await r.hand.move(r.size[0] / 2 + 14, r.size[1] / 2 + 9, 3);
    const at = await centerOf(r.app, EXIT);
    if (at) await r.hand.click(at.x, at.y);
    return;
  }
  for (let i = 0; i < 6 && !(await atEnd(r)); i++) { await r.page.keyboard.press('ArrowRight'); await wait(r, 250); }
  if (how === 'end-key') await r.page.keyboard.press('Enter');
  else await r.hand.click(r.size[0] / 2, r.size[1] / 2);
}

// Un tour : lance, vérifie le diaporama et l'absence de la barre, sort, vérifie la barre revenue.
export async function tour(r, tag, [how, out], shot = null) {
  const name = `${tag} · Présenter (${NAMES[how]}, sortie par ${NAMES[out]})`;
  const before = await barAgreesWithZone(r.frame, r.app);
  const done = await start(r, how);
  const opened = await until(r, () => showing(r), 15000);
  await until(r, () => r.app.evaluate(() => /\d+ \/ \d+/.test((document.querySelector('.pp-slide-show-counter') || {}).textContent || '')), 15000);
  const hidden = await until(r, () => barGone(r), 3000);
  const covers = opened && await r.app.evaluate(sel => { const box = document.querySelector(sel).getBoundingClientRect(); return box.left === 0 && box.top === 0 && box.width === innerWidth && box.height === innerHeight; }, SHOW);
  if (shot) await shot();
  if (done !== how) say(`   ${name} : ${done}`);
  check(`${name} : le diaporama s'ouvre, prend tout le cadre, et GFS retire sa barre (il ne la dessine plus, l'app ne reçoit plus de zone)`, before.ok && opened && covers && hidden, { avant: before.ok, ouvert: opened, couvre: covers, barreRetiree: hidden });
  await leave(r, out);
  const closed = await until(r, async () => !(await showing(r)));
  const back = await until(r, async () => (await barAgreesWithZone(r.frame, r.app)).ok);
  const zone = await readZone(r.app);
  const same = Boolean(zone) && ['left', 'top', 'right', 'bottom'].every(side => Math.abs(zone[side] - r.zone[side]) <= 1) && zone.edge === r.zone.edge;
  check(`${name} : le diaporama est fermé et la barre est revenue, au même bord, à la même place`, closed && back && same, { ferme: closed, revenue: back, memePlace: same, zone });
  await r.hand.park();
}
