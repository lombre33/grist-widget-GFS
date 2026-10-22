// « Présenter » devant la barre de GFS (run-barre-ecartee.mjs, consigne 025 de Publipostage+) : le menu ▾ du ▶ (`showMenu`), puis le diaporama, qui prend tout le cadre, donc GFS masque sa barre quand il s'ouvre (`GfsBar.hide(true)`) et la rend à chaque
// sortie (`GfsBar.hide(false)`, dans `stop`, le seul chemin de sortie de l'app). Chaque tour part d'une présentation ouverte, la barre à son bord : on lance (le bouton ▶ à la vraie souris, F5 depuis la première
// diapositive, Maj+F5 depuis celle du curseur), on vérifie que la barre n'est plus là (GFS ne la dessine plus et l'app ne reçoit plus de zone) et que le diaporama couvre tout le cadre, puis on sort d'une des quatre façons
// (Échap, le bouton ✕ à la vraie souris, une touche à l'écran de fin, un clic à l'écran de fin) et on vérifie qu'elle est revenue, au même bord, à la même place.
import { check, say } from './lab-common.mjs';
import { dockEdge } from './barre-lab.mjs';
import { readZone, barAgreesWithZone, centerOf, clickOpener, wait, none, hits, inFrame, label, shownRect, rectOf, unopened } from './barre-ecartee-lab.mjs';

const SHOW = '.pp-slide-show';
const EXIT = '.pp-slide-show-exit';
const PLAY = '.pp-slide-show-open';
const THUMB = '.pp-slide-strip .pp-slide-item[aria-selected="true"] .pp-slide-thumb';
const MORE = '.pp-slide-show-more';
const MENU = '.pp-show-menu';
const FULLSCREEN_ROW = `${MENU} [data-action="fullscreen"]`;
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

// Le menu ▾ du ▶ (4dfcd0c), ouvert à la vraie souris : trois lignes dans le panneau, hors de la zone de la barre. Le plein écran est refusé dans GFS (le cadre que Grist donne à GFS n'a que `allow="clipboard-write"`,
// contrats 1.3) : « Plein écran » y est grisé avec sa raison, un clic dessus ne change rien (le menu reste ouvert, aucun diaporama, aucun plein écran), un appui hors du menu le referme ; au clavier, Entrée sur ▾ l'ouvre sur sa première ligne et Échap le referme en rendant le clavier à ▾. Le jour où les deux cadres
// le permettent, la ligne est cochée et sans raison : la passe le dit sans compter en échec ce que GFS ne peut pas choisir.
export async function showMenu(r, tag) {
  const out = none();
  const name = `${tag} · menu ▾ de « Présenter »`;
  const opened = await clickOpener(r, MORE);
  if (opened !== 'clique') { unopened(out, opened, 'bouton ▾'); return out; }
  const box = await shownRect(r, MENU, 2000);
  if (!box) { out.notes.push('le menu ▾ ne s\'ouvre pas'); return out; }
  out.mesures += 1;
  if (hits(box, r.zone)) out.sur.push(label('menu ▾', box));
  if (!inFrame(box, r.size)) out.notes.push(label('menu ▾ hors du cadre', box));
  const facts = await r.app.evaluate(() => {
    const full = document.querySelector('.pp-show-menu [data-action="fullscreen"]');
    const note = full && full.querySelector('.pp-show-menu-note');
    const noteBox = note ? note.getBoundingClientRect() : null;
    return {
      rows: document.querySelectorAll('.pp-show-menu [data-action]').length, allowed: document.fullscreenEnabled, disabled: full && full.getAttribute('aria-disabled'), checked: full && full.getAttribute('aria-checked'),
      note: note ? note.textContent.trim() : '', noteShown: Boolean(note && !note.hidden && noteBox.width > 0 && noteBox.height > 0),
    };
  });
  const refused = facts.allowed === false;
  const rowOk = facts.rows === 3 && (refused ? facts.disabled === 'true' && facts.checked === 'false' && facts.noteShown && facts.note.length > 0 : facts.disabled === 'false' && facts.checked === 'true' && !facts.noteShown);
  check(`${name} : trois lignes, et ${refused ? '« Plein écran » grisé avec sa raison (le cadre refuse le plein écran)' : '« Plein écran » coché, sans raison (le cadre le permet)'}`, rowOk, facts);
  if (refused) {
    const click = await clickOpener(r, FULLSCREEN_ROW);
    await wait(r, 400);
    const after = await r.app.evaluate(() => ({ showing: Boolean(document.querySelector('.pp-slide-show')), fullscreen: document.fullscreenElement !== null }));
    const stillOpen = Boolean(await rectOf(r.app, MENU));
    check(`${name} : un clic sur « Plein écran » grisé ne change rien : le menu reste ouvert, aucun diaporama, aucun plein écran`, click === 'clique' && stillOpen && !after.showing && !after.fullscreen, { click, stillOpen, after });
  }
  // Ouvert à la souris, le menu se referme par un appui hors de lui (le ▾ ne prend pas le focus : Échap ne l'atteint pas) ; ouvert au clavier (Entrée sur ▾), le clavier est dans le menu : ↓ ↓ mènent à
  // « Plein écran », Entrée dessus ne change rien, Échap referme le menu et rend le clavier à ▾.
  const pressed = await r.hand.pressOutside();
  await wait(r, 300);
  const closedByPress = pressed && !(await rectOf(r.app, MENU));
  check(`${name} : un appui hors du menu, à la souris, le referme`, closedByPress, { appui: pressed, ferme: closedByPress });
  if (!pressed) { out.notes.push('le clavier du menu ▾ n\'est pas essayé : aucun endroit inerte atteignable pour donner le focus au cadre'); await r.hand.park(); return out; }
  await r.app.evaluate(sel => document.querySelector(sel).focus(), MORE);
  await r.page.keyboard.press('Enter');
  await wait(r, 400);
  const first = await r.app.evaluate(() => document.activeElement && document.activeElement.dataset.action);
  await r.page.keyboard.press('ArrowDown');
  await r.page.keyboard.press('ArrowDown');
  const third = await r.app.evaluate(() => document.activeElement && document.activeElement.dataset.action);
  await r.page.keyboard.press('Enter');
  await wait(r, 300);
  const kept = Boolean(await rectOf(r.app, MENU)) && !(await r.app.evaluate(() => Boolean(document.querySelector('.pp-slide-show'))));
  await r.page.keyboard.press('Escape');
  await wait(r, 300);
  const closed = !(await rectOf(r.app, MENU));
  const back = await r.app.evaluate(() => document.activeElement && document.activeElement.classList.contains('pp-slide-show-more'));
  check(`${name} : au clavier, Entrée sur ▾ ouvre le menu sur sa première ligne, ↓ ↓ mènent à « Plein écran » (Entrée dessus ne change rien), Échap referme le menu et rend le clavier à ▾`,
    first === 'current' && third === 'fullscreen' && (refused ? kept : true) && closed && back, { premiere: first, troisieme: third, menuGarde: kept, ferme: closed, clavierSurFleche: back });
  await r.hand.park();
  return out;
}
