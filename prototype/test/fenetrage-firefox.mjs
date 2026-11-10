// La liste fenêtrée de l'explorateur sous Firefox (carte « Afficher seulement les lignes visibles » de l'audit vitesse et poids, choisie par le porteur le 10/11 ; règle du 03/11 : toute nouvelle interface ajoute
// ses mesures à test/interfaces-firefox.test.mjs ; faits vérifiés 87). Sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, `__many(n)` lui ajoute n fichiers), à 700 × 400, à la vraie souris et au
// vrai clavier : seules les lignes qu'on voit (et quelques-unes de part et d'autre) sont dans la page, chacune à la place que son rang lui donne, la barre de défilement a la hauteur de la liste entière, les flèches,
// Début et Fin traversent la fenêtre sans perdre le clavier, une ligne dont le clavier s'est éloigné par le défilement le garde (la liste), un clic choisit la ligne qu'on voit, une recherche courte rend la liste
// entière, les vignettes se fenêtrent par rangées, l'accessibilité renforcée (lignes de 37 px) garde la même place, et 20 000 fichiers coûtent ce que 5 000 coûtent. La géométrie sans navigateur est dans
// test/explorer-window.test.mjs ; le glisser-déposer pendant un défilement se mesure dans un vrai Grist, sous Chromium (le Firefox sans écran n'achève aucun glissement : voir Page.drag).
import { ROW_HEIGHT, ROW_HEIGHT_ACCESS } from '../labo/mesures-liste.mjs';
import { Run, centerOfSelector, delay } from './corbeille-firefox.mjs';

// ---------- ce qui s'exécute dans la page ----------

const many = async count => {
  const started = performance.now();
  window.__many(count);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return Math.round(performance.now() - started);
};

// Ce que la liste fait : combien de nœuds et de lignes, la hauteur, où est chaque ligne par rapport à celle que son rang lui donne (`rowH` : la hauteur d'une ligne), qui est choisi, où est le clavier.
const look = rowH => {
  const scroll = document.querySelector('.ex-scroll');
  const list = document.querySelector('.ex-list');
  const box = scroll.getBoundingClientRect();
  const head = list.querySelector('.ls-head');
  const headH = head ? head.offsetHeight : 0;
  const rows = [...list.querySelectorAll('.ls-row')];
  const tiles = [...list.querySelectorAll('.th')];
  const index = row => Number(row.getAttribute('aria-rowindex'));
  const topOf = row => row.getBoundingClientRect().top - box.top + scroll.scrollTop;
  // Une ligne est bien placée quand son haut est celui que le rang dit : l'en-tête, puis (rang - 2) lignes.
  const misplaced = rows.filter(row => Math.abs(topOf(row) - (headH + (index(row) - 2) * rowH)) > 1).map(index).slice(0, 5);
  const chosen = list.querySelector('.ls-row[aria-selected="true"], .th[aria-selected="true"]');
  const active = document.activeElement;
  const inView = node => { const at = node.getBoundingClientRect(); return at.top >= box.top + headH - 1 && at.bottom <= box.bottom + 1; };
  const covered = rows.length > 0 && rows[0].getBoundingClientRect().top <= box.top + headH + 1 && rows.at(-1).getBoundingClientRect().bottom >= box.bottom - 1;
  return {
    nodes: document.getElementsByTagName('*').length,
    rows: rows.length,
    tiles: tiles.length,
    windowed: Boolean(list.querySelector('.ex-rows, .th-grid.is-windowed')),
    rowcount: Number(list.getAttribute('aria-rowcount')) || 0,
    first: rows.length ? index(rows[0]) : 0,
    last: rows.length ? index(rows.at(-1)) : 0,
    scrollHeight: scroll.scrollHeight,
    clientHeight: scroll.clientHeight,
    scrollTop: Math.round(scroll.scrollTop),
    atBottom: Math.abs(scroll.scrollTop + scroll.clientHeight - scroll.scrollHeight) <= 1,
    headH,
    misplaced,
    covered,
    chosen: chosen ? { index: index(chosen), name: (chosen.querySelector('.t, .tn') || {}).textContent, visible: inView(chosen), last: chosen === (rows.at(-1) || tiles.at(-1)) } : null,
    focus: active === list ? 'list' : (active && active.closest && active.closest('[data-key]') && active.closest('[data-key]') === chosen ? 'chosen' : (active ? active.tagName : null)),
    search: document.querySelector('.inp-search input').value,
    info: ((document.querySelector('.ex-info') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    perRow: tiles.length ? tiles.filter(tile => tile.offsetTop === tiles[0].offsetTop).length : 0,
  };
};

const scrollTo = async fraction => {
  const scroll = document.querySelector('.ex-scroll');
  scroll.scrollTop = Math.round(fraction * (scroll.scrollHeight - scroll.clientHeight));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

// Le centre de la n-ième ligne (ou vignette) visible, la souris peut y cliquer.
const centerOfVisible = (selector, nth) => {
  const box = document.querySelector('.ex-scroll').getBoundingClientRect();
  const headH = (document.querySelector('.ls-head') || { offsetHeight: 0 }).offsetHeight;
  const seen = [...document.querySelectorAll(selector)].filter(node => { const at = node.getBoundingClientRect(); return at.top >= box.top + headH && at.bottom <= box.bottom; });
  const at = seen[nth].getBoundingClientRect();
  return [at.left + Math.min(80, at.width / 2), at.top + at.height / 2];
};

// ---------- les mesures ----------

const SMALL = 5000;
const MOST_ROWS = 90; // 700 × 400 : une douzaine de lignes visibles, huit de chaque côté, et de la marge
const note = (run, kind, text, state) => run.note(kind, `${text} (état : ${JSON.stringify(state).slice(0, 380)})`);

async function fresh(run, count = SMALL) {
  await run.reset();
  await run.page.run(many, count);
  return run.page.run(look, ROW_HEIGHT);
}

// Cinq mille fichiers : quelques dizaines de lignes dans la page, la hauteur de la liste entière, chaque ligne à sa place.
async function onlyWhatIsSeen(run) {
  const state = await fresh(run);
  if (!state.windowed || state.rows < 12 || state.rows > MOST_ROWS) note(run, 'lignes construites', `la liste devait ne construire que les lignes qu'on voit (de 12 à ${MOST_ROWS}), pas ${state.rows}`, state);
  if (state.nodes > 3000) note(run, 'nœuds', `la page devait garder moins de 3 000 nœuds pour ${SMALL} fichiers (${state.nodes})`, state);
  if (state.first !== 2) note(run, 'première ligne', `la première ligne construite devait être la première de la liste (rang 2 : l'en-tête est le rang 1), pas ${state.first}`, state);
  if (Math.abs(state.scrollHeight - (state.headH + (state.rowcount - 1) * ROW_HEIGHT)) > 2 || state.rowcount < SMALL) note(run, 'hauteur', 'la barre de défilement devait avoir la hauteur de la liste entière', state);
  if (state.misplaced.length) note(run, 'place des lignes', `des lignes ne sont pas à la place de leur rang (${state.misplaced})`, state);
}

// Le défilement à plusieurs endroits : chaque position montre des lignes, à leur place, sans trou ; tout en bas, la dernière ligne du dernier rang touche le bas.
async function scrolling(run) {
  await fresh(run);
  for (const fraction of [0.25, 0.5, 0.9, 1, 0.1, 0]) {
    await run.page.run(scrollTo, fraction);
    const state = await run.page.run(look, ROW_HEIGHT);
    if (!state.covered) note(run, 'trou', `à ${fraction * 100} %, les lignes devaient couvrir tout ce qu'on voit`, state);
    if (state.misplaced.length) note(run, 'place des lignes', `à ${fraction * 100} %, des lignes ne sont pas à la place de leur rang (${state.misplaced})`, state);
    if (state.rows > MOST_ROWS) note(run, 'lignes construites', `à ${fraction * 100} %, ${state.rows} lignes construites`, state);
    if (fraction === 1 && (state.last !== state.rowcount || !state.atBottom)) note(run, 'le bas', 'tout en bas, la dernière ligne devait être construite et toucher le bas', state);
    if (fraction === 0 && state.first !== 2) note(run, 'le haut', 'tout en haut, la première ligne devait être construite', state);
  }
}

// Le clavier traverse la fenêtre : trente flèches de plus que ce qui est construit, puis Fin et Début.
async function keyboard(run) {
  await fresh(run);
  await run.page.click(...await run.page.run(centerOfVisible, '.ls-row', 2));
  const start = (await run.page.run(look, ROW_HEIGHT)).chosen;
  if (!start) { run.note('clic', 'un clic sur une ligne devait la choisir'); return; }
  for (let step = 0; step < 36; step++) await run.page.press('ArrowDown');
  let state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.index !== start.index + 36) note(run, 'flèches', `36 flèches ↓ devaient mener 36 lignes plus bas (rang ${start.index + 36}, pas ${state.chosen && state.chosen.index})`, state);
  else if (!state.chosen.visible || state.focus !== 'chosen') note(run, 'flèches', 'la ligne choisie devait être à l\'écran et avoir le clavier', state);
  if (state.misplaced.length || state.rows > MOST_ROWS) note(run, 'place des lignes', 'après les flèches, des lignes sont mal placées ou trop nombreuses', state);
  await run.page.press('End');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.index !== state.rowcount || !state.chosen.visible || !state.atBottom || state.focus !== 'chosen') note(run, 'Fin', 'Fin devait choisir la dernière ligne (rang de la fin de liste), la montrer et lui donner le clavier', state);
  await run.page.press('ArrowUp');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.index !== state.rowcount - 1 || !state.chosen.visible) note(run, 'flèche ↑ après Fin', 'la flèche ↑ après Fin devait choisir l\'avant-dernière ligne', state);
  await run.page.press('Home');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.index !== 2 || !state.chosen.visible || state.scrollTop !== 0) note(run, 'Début', 'Début devait choisir la première ligne et remonter tout en haut', state);
}

// La ligne qui avait le clavier est sortie de la fenêtre par le défilement : le clavier reste à la liste, et la flèche ↓ reprend de la ligne choisie, pas d'ailleurs.
async function focusAway(run) {
  await fresh(run);
  await run.page.click(...await run.page.run(centerOfVisible, '.ls-row', 3));
  const chosen = (await run.page.run(look, ROW_HEIGHT)).chosen;
  await run.page.run(scrollTo, 0.8);
  let state = await run.page.run(look, ROW_HEIGHT);
  if (state.focus !== 'list') note(run, 'clavier', 'la ligne choisie a quitté la fenêtre : le clavier devait rester à la liste (pas tomber sur la page)', state);
  if (state.chosen) note(run, 'ligne choisie', 'la ligne choisie ne devait pas être construite si loin', state);
  await run.page.press('ArrowDown');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.index !== chosen.index + 1 || !state.chosen.visible || state.focus !== 'chosen') note(run, 'flèche ↓ de loin', `↓ devait choisir la ligne qui suit la ligne choisie (rang ${chosen.index + 1}) et y ramener l'écran`, state);
}

// Une recherche courte : la liste est entière (peu de lignes, plus de fenêtre) ; effacée, elle se refenêtre.
async function filtering(run) {
  await fresh(run);
  await run.page.press('/');
  for (const letter of 'Fichier 0049') await run.page.press(letter);
  await delay(250);
  let state = await run.page.run(look, ROW_HEIGHT);
  if (state.windowed || state.rows !== 11) note(run, 'recherche', `« Fichier 0049 » devait laisser onze lignes (00049 et 00490 à 00499), la liste entière sans fenêtre (${state.rows} lignes)`, state);
  await run.page.press('Escape');
  await delay(250);
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.windowed || state.rows > MOST_ROWS || state.rowcount < SMALL) note(run, 'recherche effacée', 'Échap devait rendre la liste entière, fenêtrée de nouveau', state);
}

// La souris : un clic au milieu de la liste choisit la ligne qu'on voit et la dit au pied ; l'étoile d'une ligne y répond, la liste garde sa place.
async function mouse(run) {
  await fresh(run);
  await run.page.run(scrollTo, 0.5);
  const before = await run.page.run(look, ROW_HEIGHT);
  const target = await run.page.run(() => { const row = [...document.querySelectorAll('.ls-row')].filter(node => { const at = node.getBoundingClientRect(); return at.top > 160 && at.bottom < 380; })[1]; return { name: row.querySelector('.t').textContent, key: row.dataset.key }; });
  await run.click(target.name);
  let state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.name !== target.name || !state.info.includes(target.name)) note(run, 'clic', `un clic sur « ${target.name} » devait la choisir et la dire au pied`, state);
  const star = await run.page.run(centerOfSelector, `.ls-row[data-key="${target.key}"] .rb.pin`);
  await run.page.move(...star);
  await run.page.click(...star);
  await run.expect('étoile', `l'étoile de « ${target.name} » devait demander l'épinglage`, s => s.filing.some(entry => entry === `pin:${target.name}`));
  state = await run.page.run(look, ROW_HEIGHT);
  if (Math.abs(state.scrollTop - before.scrollTop) > 2 || state.misplaced.length) note(run, 'place gardée', 'la liste devait garder sa place après l\'épinglage', { ...state, before: before.scrollTop });
}

// Les vignettes : des rangées entières construites, Fin et ↑ y mènent, la même rangée garde la même hauteur.
async function tiles(run) {
  await fresh(run);
  await run.clickSelector('.tb-group .tb:nth-child(2)');
  await delay(250);
  let state = await run.page.run(look, ROW_HEIGHT);
  if (!state.windowed || state.tiles < state.perRow * 2 || state.tiles > state.perRow * 40) note(run, 'vignettes construites', `la grille devait ne construire que les rangées qu'on voit (${state.tiles} vignettes, ${state.perRow} par rangée)`, state);
  if (state.perRow < 2) note(run, 'colonnes', 'la grille devait avoir plusieurs colonnes à 700 px', state);
  await run.page.run(scrollTo, 0.5);
  state = await run.page.run(look, ROW_HEIGHT);
  if (state.tiles > state.perRow * 40) note(run, 'vignettes construites', `à mi-hauteur, ${state.tiles} vignettes construites`, state);
  await run.page.click(...await run.page.run(centerOfVisible, '.th', 1));
  await run.page.press('End');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || !state.chosen.last || !state.chosen.visible || !state.atBottom || state.focus !== 'chosen') note(run, 'Fin en vignettes', 'Fin devait choisir la dernière vignette, la montrer, tout en bas, avec le clavier', state);
  const last = state.chosen;
  await run.page.press('ArrowUp');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || state.chosen.name === last.name || !state.chosen.visible) note(run, 'flèche ↑ en vignettes', 'la flèche ↑ devait remonter d\'une rangée, la vignette choisie visible', state);
  await run.page.press('Home');
  state = await run.page.run(look, ROW_HEIGHT);
  if (!state.chosen || !state.chosen.visible || state.scrollTop > 8) note(run, 'Début en vignettes', 'Début devait choisir la première vignette et remonter tout en haut', state);
}

// L'accessibilité renforcée : les lignes font 37 px ; la fenêtre les place à 37 px, pas à 28.
async function accessibility(run) {
  await run.reset();
  await run.page.run(() => window.__theme.chooseAccess(true));
  await delay(150);
  await run.page.run(many, SMALL);
  for (const fraction of [0, 0.5, 1]) {
    await run.page.run(scrollTo, fraction);
    const state = await run.page.run(look, ROW_HEIGHT_ACCESS);
    if (!state.windowed || state.misplaced.length || !state.covered || state.rows > MOST_ROWS) note(run, 'accessibilité renforcée', `à ${fraction * 100} %, les lignes devaient être à leur place avec une hauteur de ${ROW_HEIGHT_ACCESS} px`, state);
  }
}

// Vingt mille fichiers coûtent ce que cinq mille coûtent : le temps de construire la liste (mesuré à 10,7 s avant la fenêtre) et les nœuds de la page ; cent sauts de défilement de suite tiennent en moins de deux secondes.
async function cost(run) {
  await run.reset();
  const ms = await run.page.run(many, 20000);
  const state = await run.page.run(look, ROW_HEIGHT);
  if (ms > 1500) note(run, 'temps', `20 000 fichiers devaient s'afficher en moins de 1,5 s (${ms} ms ; 10 700 ms avant la fenêtre)`, state);
  if (state.nodes > 3000 || state.rows > MOST_ROWS) note(run, 'nœuds', `20 000 fichiers devaient laisser moins de 3 000 nœuds (${state.nodes})`, state);
  const jumps = await run.page.run(async () => {
    const scroll = document.querySelector('.ex-scroll');
    const started = performance.now();
    for (let step = 0; step < 100; step++) {
      scroll.scrollTop = (step * 7919 * 28) % (scroll.scrollHeight - scroll.clientHeight);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return Math.round(performance.now() - started);
  });
  if (jumps > 2000) note(run, 'défilement', `cent sauts de défilement devaient tenir en moins de 2 s (${jumps} ms)`, state);
}

export async function fenetrageProblems(page, language, tag) {
  const found = [];
  const run = new Run(page, tag, found, 'liste fenêtrée');
  for (const step of [onlyWhatIsSeen, scrolling, keyboard, focusAway, filtering, mouse, tiles, accessibility, cost]) {
    try {
      await step(run);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
    }
  }
  return found;
}
