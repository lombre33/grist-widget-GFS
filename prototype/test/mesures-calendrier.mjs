// Le calendrier du kit (kit 0.8.0, js/calendrier/) sous Firefox, le navigateur du porteur : les mesures que `interfaces-firefox.test.mjs` joue dans un vrai Firefox sans écran (test/firefox.mjs), à 700 × 400, à la
// vraie souris et au vrai clavier (`input.performActions` : jamais `dispatchEvent`). La page est celle que le kit garde pour ses propres essais (kit/navigateur/calendrier.html : le module monté comme le ferait
// une app, sous la politique d'une app hébergée ; `kit.appels` garde ce que l'hôte reçoit). Le module met ses événements dans des `<div role="button" draggable>`, jamais des `<button draggable>` (que Firefox,
// avant la version 147, ne laisse pas glisser) : ce que mesure surtout cette passe est donc le glisser-déposer HTML5 du navigateur du porteur, jusqu'où ce Firefox sans écran le mène : le navigateur lance le glissement
// (`dragstart` sur la barre ou le bloc, effet « move », un texte), survole le jour visé et le module l'accepte (`dragover` annulé, effet « move »). Le dépôt lui-même ne s'achève pas dans ce Firefox (voir `Page.drag`
// de test/firefox.mjs : ni `drop` ni `dragend` après le lâcher, même sur une page de deux éléments) : l'hôte qui reçoit les dates et l'événement qui revient quand l'hôte refuse se mesurent sous Chromium, dans un vrai
// Grist (labo/run-calendrier-kit.mjs, les mêmes gestes).
import { HEURES, LIGNES, MAINTENANT } from '../labo/jeu-calendrier.mjs';

export const CALENDAR_PAGE = '/kit/navigateur/calendrier.html';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

const define = (lignes, options, now, language) => kit.calendrier.definir({ lignes, options: { maintenant: () => new Date(...now), langue: language, ...options } });
const rectOf = selector => {
  const element = document.querySelector(selector);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
};
const callsOf = name => kit.appels.filter(item => item.nom === name).map(item => item.valeur);
const textOf = selector => { const element = document.querySelector(selector); return element ? element.textContent.trim() : null; };
// Le jour où l'événement est affiché : la cellule qui porte le coin haut gauche de sa barre (ce que la personne voit, jamais seulement « la même semaine »).
const dayOf = id => {
  const bar = document.querySelector(`.cal-evt[data-id="${id}"]`);
  if (!bar) return null;
  const box = bar.getBoundingClientRect();
  const cell = [...document.querySelectorAll('.cal-fond[data-jour]')].find(item => { const r = item.getBoundingClientRect(); return r.left <= box.left + 4 && box.left + 4 < r.right && r.top <= box.top + 2 && box.top + 2 < r.bottom; });
  return cell ? cell.dataset.jour : null;
};
// Les nombres que le mois doit tenir : 42 jours, six semaines, la barre d'outils sur une ligne, chaque événement dans la grille, l'événement 2 sur son jour, « +2 » du 13.
const measureMonth = () => {
  const grid = document.querySelector('.cal-corps').getBoundingClientRect();
  const outside = [...document.querySelectorAll('.cal-evt')].filter(item => { const r = item.getBoundingClientRect(); return r.left < grid.left - 0.5 || r.right > grid.right + 0.5; }).length;
  const plus = [...document.querySelectorAll('.cal-plus')].map(item => item.textContent.trim());
  return { days: document.querySelectorAll('.cal-fond').length, weeks: document.querySelectorAll('.cal-corps .cal-sem').length, toolbar: Math.round(document.querySelector('.cal-barre').getBoundingClientRect().height),
    title: document.querySelector('.cal-titre').textContent.trim(), outside, plus, names: [...document.querySelectorAll('.cal-nom')].map(item => item.textContent.trim()) };
};
// Les blocs horaires de la vue Semaine : la colonne du 3 novembre fait 24 × 40 px, un bloc est à son heure et de sa durée, deux blocs qui se chevauchent sont côte à côte.
const measureHours = () => {
  const box = selector => document.querySelector(selector).getBoundingClientRect();
  const column = box('.cal-colonne[data-jour="2026-11-03"]');
  const [a, b] = [box('.cal-bloc[data-id="20"]'), box('.cal-bloc[data-id="21"]')];
  return { column: Math.round(column.height), aTop: Math.round(a.y - column.y), aHeight: Math.round(a.height), bTop: Math.round(b.y - column.y), bHeight: Math.round(b.height),
    halves: Math.abs(a.width - column.width / 2) < 2 && Math.abs(b.width - column.width / 2) < 2 && b.x > a.x, scrolled: Math.round(document.querySelector('.cal-heures').scrollTop) };
};
const scrollHours = dy => { document.querySelector('.cal-heures').scrollTop += dy; };
// Ce que le navigateur fait d'un glissement, vu de la page (des écouteurs sur `document` : ils passent après ceux du module, `defaultPrevented` dit s'il a accepté le dépôt) : le début (la barre qui glisse,
// son effet, ses types de données) et le dernier survol (le jour sous le curseur, accepté ou non, l'effet).
const spyDrag = () => {
  window.__dnd = { start: null, over: null };
  document.addEventListener('dragstart', event => { window.__dnd.start = { on: String(event.target.className), effect: event.dataTransfer.effectAllowed, types: [...event.dataTransfer.types] }; });
  document.addEventListener('dragover', event => {
    const zone = document.elementsFromPoint(event.clientX, event.clientY).find(item => item.dataset && item.dataset.jour);
    window.__dnd.over = { day: zone ? zone.dataset.jour : null, prevented: event.defaultPrevented, effect: event.dataTransfer.dropEffect };
  });
};
const applyTheme = mode => { document.documentElement.dataset.theme = mode; };

// ---------- ce que l'essai fait de la page ----------

async function fresh(page, site, { language, mode, lignes = LIGNES, options = {} }) {
  await page.goto(`${site.url}${CALENDAR_PAGE}`);
  await page.view({ width: 700, height: 400, mode });
  await page.run(applyTheme, mode);
  await page.until(() => Boolean(window.kit && window.kit.calendrier));
  await page.run(define, lignes, options, MAINTENANT, language);
  await page.until(() => Boolean(document.querySelector('.cal-titre')));
}

const WORDS = {
  fr: { title: 'Novembre 2026', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] },
  en: { title: 'November 2026', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Le mois : ce que la page doit montrer, mesuré (la mise en page de Firefox n'est pas celle de Chromium).
async function monthProblems(page, site, tag, language, mode, note) {
  await fresh(page, site, { language, mode });
  const month = await page.run(measureMonth);
  if (month.title !== WORDS[language].title || !same(month.names, WORDS[language].days)) note('mois', `${tag} : le titre est « ${month.title} » et les jours ${month.names.join(' ')}`);
  if (month.days !== 42 || month.weeks !== 6) note('mois', `${tag} : ${month.days} jours et ${month.weeks} semaines au lieu de 42 et 6`);
  if (month.toolbar > 60) note('barre d\'outils', `${tag} : la barre d'outils du mois est sur plusieurs lignes (${month.toolbar} px)`);
  if (month.outside) note('mois', `${tag} : ${month.outside} événement(s) sortent de la grille`);
  if (!same(month.plus, ['+2'])) note('mois', `${tag} : les « +n » sont ${JSON.stringify(month.plus)} au lieu de ["+2"]`);
  const day = await page.run(dayOf, 2);
  if (day !== '2026-11-09') note('mois', `${tag} : l'événement 2 est affiché le ${day} au lieu du 9 novembre`);
}

// Les gestes de la vraie souris et du vrai clavier : ouvrir un événement, la liste d'un jour, la saisie rapide (Entrée, Échap, l'hôte qui refuse).
async function gestureProblems(page, site, tag, language, mode, note) {
  await fresh(page, site, { language, mode });
  const at = selector => page.run(rectOf, selector);
  const calls = name => page.run(callsOf, name);
  const click = async selector => { const box = await at(selector); await page.click(box.cx, box.cy); };
  await click('.cal-evt[data-id="2"]');
  if (!same(await calls('ouvrir'), [2])) note('gestes', `${tag} : un clic sur l'événement 2 donne ${JSON.stringify(await calls('ouvrir'))} à l'hôte au lieu de [2]`);
  await click('.cal-plus');
  const list = await page.until(() => { const lines = [...document.querySelectorAll('.cal-liste-ligne')].map(item => item.textContent.trim()); return lines.length ? lines : null; }, [], 3000).catch(() => null);
  if (!same(list, ['Bilan', 'Maquettes', 'Revue'])) note('gestes', `${tag} : la liste du 13 est ${JSON.stringify(list)}`);
  await page.press('Escape');
  if (await page.run(() => document.querySelectorAll('.cal-liste').length)) note('gestes', `${tag} : Échap ne ferme pas la liste du jour`);
  await click('.cal-fond[data-jour="2026-11-17"]');
  await page.until(() => document.querySelector('.cal-saisie-champ'), [], 3000).catch(() => null);
  await page.press(...'appeler');
  await page.press('Enter');
  const added = await page.until(() => { const found = kit.appels.filter(item => item.nom === 'ajouter'); return found.length ? found.map(item => item.valeur) : null; }, [], 3000).catch(() => null);
  if (!same(added, [{ debut: '2026-11-17', titre: 'appeler' }])) note('gestes', `${tag} : la saisie rapide donne ${JSON.stringify(added)} à l'hôte`);
  if (await page.run(() => document.querySelectorAll('.cal-saisie').length)) note('gestes', `${tag} : la saisie reste ouverte après Entrée`);
  await click('.cal-num[data-jour="2026-11-18"]');
  await page.until(() => document.querySelector('.cal-saisie-champ'), [], 3000).catch(() => null);
  await page.press(...'brouillon');
  await page.press('Escape');
  if (await page.run(() => document.querySelectorAll('.cal-saisie').length) || (await calls('ajouter')).length !== 1) note('gestes', `${tag} : Échap laisse la saisie ouverte ou envoie le brouillon`);
}

// Le glissement lancé par la souris (d'un point à l'autre), et ce que la page en a vu.
async function dragged(page, from, to) {
  await page.run(spyDrag);
  await page.drag(from, to);
  await page.until(() => window.__dnd && window.__dnd.over, [], 3000).catch(() => null);
  return page.run(() => window.__dnd);
}

// Ce que doit montrer un glissement : le navigateur le lance sur `source`, avec l'effet « move » et un texte, et le jour visé accepte le dépôt avec l'effet « move ».
function dragVerdict(note, tag, what, seen, { source, day }) {
  if (!seen.start || !seen.start.on.split(' ').includes(source)) note('glisser-déposer', `${tag} : ${what} : Firefox ne lance pas le glissement (dragstart : ${JSON.stringify(seen.start)})`);
  else if (seen.start.effect !== 'move' || !seen.start.types.includes('text/plain')) note('glisser-déposer', `${tag} : ${what} : le glissement porte ${JSON.stringify(seen.start)} au lieu de « move » et d'un texte`);
  if (!seen.over || seen.over.day !== day || !seen.over.prevented || seen.over.effect !== 'move') note('glisser-déposer', `${tag} : ${what} : le jour visé (${day}) n'accepte pas le dépôt : ${JSON.stringify(seen.over)}`);
}

// Le glisser-déposer d'un événement du mois sur un autre jour, d'une tâche du plateau « Sans date » sur un jour : le glissement est lancé et le jour visé l'accepte (le dépôt se mesure sous Chromium).
async function dragProblems(page, site, tag, language, mode, note) {
  const at = selector => page.run(rectOf, selector);
  const centers = async (from, to) => { const [a, b] = [await at(from), await at(to)]; return [[a.cx, a.cy], [b.cx, b.cy]]; };
  await fresh(page, site, { language, mode });
  dragVerdict(note, tag, 'un événement du mois (du 9 au 11)', await dragged(page, ...await centers('.cal-evt[data-id="2"]', '.cal-fond[data-jour="2026-11-11"]')), { source: 'cal-evt', day: '2026-11-11' });
  await fresh(page, site, { language, mode });
  const button = await at('.cal-plateau-bouton');
  await page.click(button.cx, button.cy);
  await page.until(() => document.querySelector('.cal-puce[data-id="7"]'), [], 3000);
  dragVerdict(note, tag, 'une tâche du plateau « Sans date » (sur le 20)', await dragged(page, ...await centers('.cal-puce[data-id="7"]', '.cal-fond[data-jour="2026-11-20"]')), { source: 'cal-puce', day: '2026-11-20' });
}

// La vue Semaine : les blocs à leur heure et de leur durée, côte à côte quand ils se chevauchent, la grille ouverte vers 7 h, un bloc glissé d'une colonne à l'autre (le jeudi sur le vendredi).
async function weekProblems(page, site, tag, language, mode, note) {
  await fresh(page, site, { language, mode, lignes: HEURES, options: { vue: 'semaine' } });
  const hours = await page.run(measureHours);
  if (hours.column !== 960 || hours.aTop !== 380 || hours.aHeight !== 40 || hours.bTop !== 400 || hours.bHeight !== 80 || !hours.halves) note('semaine', `${tag} : les blocs de 9 h 30 et 10 h sont mal placés ${JSON.stringify(hours)}`);
  if (hours.scrolled < 250 || hours.scrolled > 290) note('semaine', `${tag} : la grille horaire s'ouvre à ${hours.scrolled} px (vers 7 h : 270 px attendus)`);
  await page.run(scrollHours, 120);
  const [block, thursday, friday] = [await page.run(rectOf, '.cal-bloc[data-id="22"]'), await page.run(rectOf, '.cal-colonne[data-jour="2026-11-05"]'), await page.run(rectOf, '.cal-colonne[data-jour="2026-11-06"]')];
  const from = [block.x + 10, block.y + 20];
  dragVerdict(note, tag, 'un bloc horaire (du jeudi au vendredi)', await dragged(page, from, [from[0] + (friday.x - thursday.x), from[1] + 11]), { source: 'cal-bloc', day: '2026-11-06' });
}

// Tout ce que Firefox doit montrer du calendrier, pour une langue et un mode : les écarts, chacun { kind, text }.
export async function calendarProblems(page, site, language, mode) {
  const tag = `calendrier, ${language}, 700 × 400, ${mode === 'dark' ? 'sombre' : 'clair'}`;
  const found = [];
  const note = (kind, text) => found.push({ kind: `calendrier : ${kind}`, text });
  for (const run of [monthProblems, gestureProblems, dragProblems, weekProblems]) {
    try { await run(page, site, tag, language, mode, note); } catch (error) { note('geste impossible', `${tag}, ${run.name} : ${String(error.message).slice(0, 200)}`); }
  }
  return found;
}

// Ce que la page du calendrier a écrit dans la console de Firefox depuis la ligne `from` du journal (une erreur de script, un refus de la politique de sécurité du contenu, un avertissement) : rien n'est attendu.
export const calendarLogs = (page, from = 0) => page.logs.slice(from).filter(entry => entry.level === 'error' || entry.level === 'warn').map(entry => ({ kind: 'calendrier : la page écrit dans la console', text: `la page a écrit « ${String(entry.text).slice(0, 160)} »` }));
