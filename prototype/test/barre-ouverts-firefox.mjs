// Le 5e bouton de la barre, « Fichiers ouverts », sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à ce banc ; décision d'Antoine du 11/11). La vraie barre de index.html, le vrai `Dock` et le
// vrai `OpenedBar` (test/pages/barre-ouverts.js) sur des fichiers d'essai, avec les feuilles de style de index.html. Ce que l'essai mesure, à 700 × 400 (et la liste à 400 px de large), en français et en anglais, en clair
// et en sombre, à la vraie souris et au vrai clavier : les cinq boutons dans l'ordre et la barre de 34 × 154 ; le bouton grisé sans fichier ouvert et son menu (titre, article grisé qui explique, « Ouvrir un autre
// fichier… ») ; la pastille et le nom qui portent le nombre ; chaque ligne (28 px, contenu dans la ligne, fichier affiché en gras avec son mot, indice de l'app, croix de 24 px au moins) ; un clic sur un fichier l'ouvre,
// sur le fichier affiché ne fait rien ; la croix retire la ligne et rouvre le menu ; le clavier (↓, →, ←, Suppr, Début, Fin, Échap) ; le menu sur les quatre bords, sans recouvrir la barre et dans la page ; un nom
// très long coupé par « … » avec son texte entier au survol ; l'accessibilité renforcée (cibles de 36 px). Le contraste se mesure dans un vrai Grist (labo/run-ouverts-barre.mjs).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { Run } from './corbeille-firefox.mjs';

export const PAGE = '/essai-barre-ouverts.html';
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) <= tolerance;
const overlaps = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
const inside = (box, [width, height]) => box[0] >= -0.5 && box[1] >= -0.5 && box[2] <= width + 0.5 && box[3] <= height + 0.5;
const SIDES = { gauche: 'à droite', haut: 'au-dessous', droite: 'à gauche', bas: 'au-dessus' };

// La page d'essai : les feuilles de style et la carte d'importation de index.html (dans leur ordre), sa barre telle quelle, et la phrase d'état.
export function barrePages() {
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sheets = index.match(/<link rel="stylesheet"[^>]*>/g) || [];
  const importMap = (index.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
  const floaters = (index.match(/<div class="floaters"[\s\S]*?<\/div>/) || [''])[0];
  if (sheets.length < 3 || !importMap || !floaters) throw new Error('index.html : ses feuilles de style, sa carte d\'importation et sa barre');
  const page = `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>essai</title>\n${sheets.join('\n')}\n${importMap}\n</head>\n`
    + `<body><main class="stage" id="stage"><div class="frames" id="frames"></div>${floaters.replace(' hidden>', '>')}<p class="status toast" id="toast" role="status" hidden></p></main><script type="module" src="/test/pages/barre-ouverts.js"></script></body></html>`;
  return { [PAGE]: page };
}

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Ce que la personne voit : la barre, le bouton et sa pastille, le menu ouvert (ses lignes une à une), où est le clavier, la phrase d'état, ce que le menu a fait ouvrir.
function read() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const box = node => { const at = node.getBoundingClientRect(); return [at.left, at.top, at.right, at.bottom]; };
  const button = document.getElementById('floater-opened');
  const bar = document.getElementById('floaters');
  const menu = document.querySelector('.menu-opened');
  const badge = button.querySelector('.badge');
  const active = document.activeElement;
  const rowOf = row => {
    const [main, drop] = [...row.children];
    const label = main.querySelector('.menu-label');
    const hint = main.querySelector('.menu-hint');
    const here = box(row);
    return {
      name: text(label), hint: text(hint), height: Math.round(row.getBoundingClientRect().height), current: main.getAttribute('aria-current') === 'true', word: text(main.querySelector('.sr-only')),
      weight: Number(getComputedStyle(main).fontWeight), cut: label.scrollWidth > label.clientWidth + 1 && !main.title, title: main.title,
      contained: [label, hint, drop].every(node => !node || (box(node)[0] >= here[0] - 0.5 && box(node)[2] <= here[2] + 0.5 && box(node)[1] >= here[1] - 0.5 && box(node)[3] <= here[3] + 0.5)),
      drop: { w: drop.getBoundingClientRect().width, h: drop.getBoundingClientRect().height, label: drop.getAttribute('aria-label') },
    };
  };
  return {
    view: [document.documentElement.clientWidth, document.documentElement.clientHeight], ids: [...bar.querySelectorAll('.floater')].map(node => node.id),
    sizes: [...bar.querySelectorAll('.floater')].map(node => [Math.round(node.getBoundingClientRect().width), Math.round(node.getBoundingClientRect().height)]),
    bar: box(bar), button: box(button), name: button.getAttribute('aria-label'), title: button.title, empty: button.dataset.empty, expanded: button.getAttribute('aria-expanded'),
    badge: badge ? { text: text(badge), box: box(badge) } : null,
    menu: menu ? {
      box: box(menu), title: text(menu.querySelector('.menu-title')), rows: [...menu.querySelectorAll('.menu-row')].map(rowOf), separators: menu.querySelectorAll('hr').length,
      items: [...menu.querySelectorAll('.menu-item:not(.menu-drop)')].map(item => ({ name: text(item.querySelector('.menu-label')), greyed: item.getAttribute('aria-disabled') === 'true', height: Math.round(item.getBoundingClientRect().height) })),
      scrolls: menu.scrollHeight > menu.clientHeight + 1,
    } : null,
    focus: active ? { onButton: active.id === 'floater-opened', label: text(active.querySelector && active.querySelector('.menu-label')) || active.getAttribute('aria-label'), drop: active.classList.contains('menu-drop') } : null,
    toast: document.getElementById('toast').hidden ? null : text(document.getElementById('toast')), opens: window.__bar.opens, explorer: window.__bar.explorer, keys: window.__bar.keys(),
  };
}

const centerOf = selector => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
// Le centre de la ligne (ou de sa croix) dont le nom est `name`.
const centerOfRow = (name, drop) => {
  const row = [...document.querySelectorAll('.menu-opened .menu-row')].find(node => node.querySelector('.menu-label').textContent.trim() === name);
  if (!row) return null;
  const box = row.children[drop ? 1 : 0].getBoundingClientRect();
  return [box.left + Math.min(drop ? box.width / 2 : 40, box.width / 2), box.top + box.height / 2];
};
const centerOfMore = () => { const node = [...document.querySelectorAll('.menu-opened .menu-item')].pop(); const box = node.getBoundingClientRect(); return [box.left + 40, box.top + box.height / 2]; };
const centerOfGreyed = () => { const node = document.querySelector('.menu-opened .menu-item[aria-disabled="true"]'); const box = node.getBoundingClientRect(); return [box.left + 40, box.top + box.height / 2]; };

// ---------- les gestes ----------

class Bar extends Run {
  constructor(page, language, tag, found) { super(page, tag, found, 'barre des fichiers ouverts'); this.t = createI18n(language).t; }

  state() { return this.page.run(read); }

  async expectState(kind, what, check) {
    const started = Date.now();
    let state = await this.state();
    while (!check(state) && Date.now() - started < 3000) { await new Promise(resolve => setTimeout(resolve, 60)); state = await this.state(); }
    if (!check(state)) this.note(kind, `${what} (état : ${JSON.stringify({ ...state, menu: state.menu && { ...state.menu, rows: state.menu.rows.map(row => row.name) } }).slice(0, 460)})`);
    return state;
  }

  async at(fn, ...args) { return this.page.run(fn, ...args); }

  // Un clic à la vraie souris sur ce que `fn` désigne.
  async clickAt(what, fn, ...args) {
    const point = await this.at(fn, ...args);
    if (!point) { this.note('geste impossible', `${what} est introuvable`); return false; }
    await this.page.click(...point);
    return true;
  }

  async setup(count, edge = 'gauche') {
    await this.page.run(() => { window.__bar.clear(); window.__bar.access(false); });
    await this.page.run(name => window.__bar.edge(name), edge);
    await this.page.run(n => window.__bar.fill(n), count);
    await new Promise(resolve => setTimeout(resolve, 120));
  }

  openMenu() { return this.clickAt('le bouton « Fichiers ouverts »', centerOf, '#floater-opened'); }
}

// La barre : cinq boutons dans l'ordre, 34 × 154 au bord gauche, le bouton de 28 px, grisé et sans pastille quand rien n'est ouvert.
async function layout(run) {
  await run.setup(0);
  const view = await run.state();
  const { t } = run;
  if (view.ids.join() !== 'floater-files,floater-opened,floater-apps,floater-work,floater-place') run.note('les boutons', `l'ordre devait être Fichiers, Fichiers ouverts, Apps, Table de travail, Position (${view.ids.join()})`);
  const [left, top, right, bottom] = view.bar;
  if (!near(right - left, 34) || !near(bottom - top, 154) || !near(left, 4) || !near((top + bottom) / 2, view.view[1] / 2, 1)) run.note('la barre', `la barre devait mesurer 34 × 154 px, à 4 px du bord gauche et centrée (${view.bar.map(Math.round)})`);
  if (view.sizes.some(([w, h]) => w !== 28 || h !== 28)) run.note('les boutons', `chaque bouton devait mesurer 28 × 28 px (${JSON.stringify(view.sizes)})`);
  if (view.name !== t('dock.opened') || view.title !== t('dock.opened') || view.empty !== 'true' || view.badge) run.note('le bouton vide', `grisé, nommé « ${t('dock.opened')} », sans pastille (${view.name}, ${view.empty}, ${JSON.stringify(view.badge)})`);
}

// Sans fichier ouvert : le menu dit pourquoi (un article grisé dont le clic explique) et garde « Ouvrir un autre fichier… » ; Échap rend le clavier au bouton.
async function emptyMenu(run) {
  const { t } = run;
  await run.setup(0);
  await run.openMenu();
  const menu = await run.expectState('le menu vide', 'le menu devait s\'ouvrir avec son titre, l\'article grisé et « Ouvrir un autre fichier… »', state => state.menu && state.menu.items.length === 2);
  const names = menu.menu ? menu.menu.items.map(item => item.name).join('|') : '';
  if (menu.menu && (menu.menu.title !== t('dock.opened') || names !== `${t('dock.openedNone')}|${t('dock.openedMore')}` || !menu.menu.items[0].greyed || menu.menu.separators !== 1 || menu.expanded !== 'true')) run.note('le menu vide', `titre, article grisé, séparateur et « ${t('dock.openedMore')} » attendus (${names})`);
  await run.clickAt('l\'article grisé', centerOfGreyed);
  await run.expectState('l\'article grisé', 'un clic sur l\'article grisé devait dire pourquoi', state => state.toast === t('dock.openedWhy'));
  await run.page.press('Escape');
  await run.expectState('Échap', 'Échap devait refermer le menu et rendre le clavier au bouton', state => !state.menu && state.focus && state.focus.onButton && state.expanded === 'false');
}

// Trois fichiers ouverts : la pastille, le nom du bouton, les lignes (28 px, dans la ligne), le fichier affiché en gras avec son mot, l'indice de l'app, la croix de 24 px au moins.
async function filled(run) {
  const { t } = run;
  await run.setup(3);
  const view = await run.state();
  const badge = view.badge;
  if (!badge || badge.text !== '3' || badge.box[2] > view.button[2] + 4 || badge.box[1] < view.button[1] - 4 || badge.box[0] < view.button[0] || view.name !== t('dock.openedCount', { n: 3 }) || view.empty !== 'false') run.note('la pastille', `la pastille devait dire 3 au coin du bouton, et le nom « ${t('dock.openedCount', { n: 3 })} » (${JSON.stringify(badge)}, ${view.name})`);
  await run.openMenu();
  const open = await run.expectState('le menu', 'le menu devait s\'ouvrir avec trois lignes', state => state.menu && state.menu.rows.length === 3);
  if (!open.menu) return;
  const names = open.menu.rows.map(row => row.name).join('|');
  if (names !== 'Inscription à la formation|Émargement|Convocation') run.note('l\'ordre', `du plus récent au plus ancien : « Inscription à la formation », « Émargement », « Convocation » (${names})`);
  for (const row of open.menu.rows) {
    if (row.height !== 28 || !row.contained) run.note('une ligne', `« ${row.name} » devait mesurer 28 px et garder son contenu dans la ligne (${row.height} px, dans la ligne : ${row.contained})`);
    if (row.cut) run.note('nom coupé', `« ${row.name} » est coupé sans son texte entier au survol`);
    if (row.drop.w < 24 || row.drop.h < 24 || row.drop.label !== t('dock.openedDropName', { name: row.name })) run.note('la croix', `la croix de « ${row.name} » devait mesurer 24 px au moins et se nommer « ${t('dock.openedDropName', { name: row.name })} » (${row.drop.w} × ${row.drop.h}, ${row.drop.label})`);
    if (!row.hint) run.note('l\'indice', `« ${row.name} » devait dire son app`);
  }
  const [shown, other] = open.menu.rows;
  if (!shown.current || other.current || !(shown.word || '').includes(t('ex.shown')) || shown.weight < 600 || other.weight >= 600) run.note('le fichier affiché', `seul le dernier fichier ouvert devait être marqué (gras, mot « ${t('ex.shown')} », aria-current) : ${JSON.stringify([shown, other].map(row => [row.name, row.current, row.word, row.weight]))}`);
  if (overlaps(open.menu.box, open.bar) || !inside(open.menu.box, open.view)) run.note('la place du menu', `le menu devait tenir dans la page sans recouvrir la barre (${open.menu.box.map(Math.round)} / ${open.bar.map(Math.round)})`);
  await run.page.press('Escape');
}

// Un clic sur un fichier l'ouvre, sur le fichier affiché ne fait rien ; la croix retire la ligne et rouvre le menu.
async function mouse(run) {
  const { t } = run;
  await run.setup(3);
  await run.openMenu();
  await run.clickAt('le fichier affiché', centerOfRow, 'Inscription à la formation', false);
  const same = await run.expectState('le fichier affiché', 'un clic sur le fichier affiché devait refermer le menu sans rien ouvrir', state => !state.menu);
  if (same.opens.length !== 0) run.note('le fichier affiché', `un clic sur le fichier affiché ne devait rien ouvrir (${same.opens.join()})`);
  await run.openMenu();
  await run.clickAt('« Émargement »', centerOfRow, 'Émargement', false);
  const other = await run.expectState('un autre fichier', 'un clic sur un autre fichier devait le faire ouvrir et refermer le menu', state => !state.menu && state.opens.join() === 'pp:2');
  if (other.opens.join() !== 'pp:2') run.note('un autre fichier', `« Émargement » devait être ouvert (${other.opens.join()})`);
  await run.openMenu();
  await run.clickAt('la croix de « Émargement »', centerOfRow, 'Émargement', true);
  const dropped = await run.expectState('la croix', 'la croix devait retirer « Émargement » : le menu se rouvre avec deux lignes, la pastille passe à 2', state => state.menu && state.menu.rows.length === 2 && state.badge && state.badge.text === '2');
  if (dropped.menu && dropped.menu.rows.some(row => row.name === 'Émargement')) run.note('la croix', '« Émargement » devait avoir quitté la liste');
  if (dropped.keys.join() !== 'pp:1,form:3') run.note('la croix', `la liste devait garder « Convocation » puis « Inscription » (${dropped.keys.join()})`);
  await run.clickAt('« Ouvrir un autre fichier… »', centerOfMore);
  await run.expectState('« Ouvrir un autre fichier… »', `« ${t('dock.openedMore')} » devait montrer l'explorateur`, state => !state.menu && state.explorer === 1);
}

// Le clavier : le menu ouvert prend le fichier affiché, ↓ passe à la ligne suivante, → à sa croix, ← revient, ↓ depuis la croix saute à la ligne d'après, Suppr retire, Début et Fin, Échap.
async function keyboard(run) {
  const { t } = run;
  await run.setup(3);
  // Entrée et Espace sur un bouton ne se jouent pas sous ce Firefox sans écran (voir conflictProblems) : le menu s'ouvre à la souris, le clavier se mesure dedans ; « Entrée ouvre le menu » est dans le labo (Chromium).
  await run.openMenu();
  const first = await run.expectState('l\'ouverture', 'le menu devait s\'ouvrir, le clavier sur le fichier affiché', state => state.menu && state.focus && state.focus.label === 'Inscription à la formation');
  if (!first.menu) return;
  await run.page.press('ArrowDown');
  await run.expectState('↓', '↓ devait passer à « Émargement »', state => state.focus.label === 'Émargement');
  await run.page.press('ArrowRight');
  await run.expectState('→', '→ devait aller à la croix de « Émargement »', state => state.focus.drop && state.focus.label === t('dock.openedDropName', { name: 'Émargement' }));
  await run.page.press('ArrowLeft');
  await run.expectState('←', '← devait revenir à « Émargement »', state => !state.focus.drop && state.focus.label === 'Émargement');
  await run.page.press('ArrowRight');
  await run.page.press('ArrowDown');
  await run.expectState('↓ depuis la croix', '↓ depuis la croix devait aller à « Convocation » (la croix n\'est pas un arrêt de plus)', state => state.focus.label === 'Convocation');
  await run.page.press('ArrowUp');
  await run.page.press('Delete');
  const gone = await run.expectState('Suppr', 'Suppr devait retirer « Émargement » : le menu se rouvre, le clavier sur « Convocation » (la ligne qui prend sa place)', state => state.menu && state.menu.rows.length === 2 && state.focus.label === 'Convocation');
  if (gone.keys.join() !== 'pp:1,form:3') run.note('Suppr', `la liste devait garder « Convocation » puis « Inscription » (${gone.keys.join()})`);
  await run.page.press('End');
  await run.expectState('Fin', 'Fin devait aller à « Ouvrir un autre fichier… »', state => state.focus.label === t('dock.openedMore'));
  await run.page.press('Home');
  await run.expectState('Début', 'Début devait aller au premier fichier', state => state.focus.label === 'Inscription à la formation');
  await run.page.press('Escape');
  await run.expectState('Échap', 'Échap devait refermer le menu et rendre le clavier au bouton', state => !state.menu && state.focus.onButton);
}

// Le menu sur les quatre bords : à côté de la barre sans la recouvrir, du bon côté, dans la page, les huit fichiers lisibles (la liste défile au besoin).
async function edges(run) {
  for (const edge of Object.keys(SIDES)) {
    await run.setup(8, edge);
    await run.openMenu();
    const state = await run.expectState(`le bord ${edge}`, `le menu devait s'ouvrir pour le bord ${edge}`, current => current.menu && current.menu.rows.length === 8);
    if (!state.menu) continue;
    const [m, b] = [state.menu.box, state.bar];
    const sideOk = { gauche: m[0] >= b[2] - 0.5, droite: m[2] <= b[0] + 0.5, haut: m[1] >= b[3] - 0.5, bas: m[3] <= b[1] + 0.5 }[edge];
    if (overlaps(m, b) || !sideOk || !inside(m, state.view)) run.note(`le bord ${edge}`, `le menu devait s'ouvrir ${SIDES[edge]} de la barre, sans la recouvrir, dans la page (${m.map(Math.round)} / ${b.map(Math.round)} / ${state.view})`);
    await run.page.press('Escape');
  }
  await run.setup(0, 'gauche');
}

// Un nom très long : coupé par « … », son texte entier au survol, le menu reste dans la page (même à 400 px de large) et ne dépasse pas 340 px.
async function longName(run) {
  await run.setup(8);
  await run.openMenu();
  const state = await run.expectState('un nom long', 'le menu devait s\'ouvrir avec huit lignes', current => current.menu && current.menu.rows.length === 8);
  if (!state.menu) return;
  const long = state.menu.rows.find(row => row.name.startsWith('Convocation à la session'));
  const width = state.menu.box[2] - state.menu.box[0];
  if (!long || !long.title || !long.title.includes('direction régionale') || long.cut) run.note('un nom long', `le nom long devait garder son texte entier au survol (${long && long.title})`);
  if (width > 340.5 || !inside(state.menu.box, state.view) || overlaps(state.menu.box, state.bar)) run.note('un nom long', `le menu devait rester dans la page et tenir en 340 px (${Math.round(width)} px, ${state.menu.box.map(Math.round)} / ${state.view})`);
  await run.page.press('Escape');
}

// L'accessibilité renforcée : les cinq boutons mesurent 36 px, les lignes et les croix aussi ; le menu tient dans la page, « Ouvrir un autre fichier… » reste atteignable au clavier.
async function access(run) {
  const { t } = run;
  await run.setup(8);
  await run.page.run(() => window.__bar.access(true));
  await new Promise(resolve => setTimeout(resolve, 150));
  const view = await run.state();
  if (view.sizes.some(([w, h]) => w < 36 || h < 36)) run.note('l\'accessibilité renforcée', `les cinq boutons devaient mesurer 36 px au moins (${JSON.stringify(view.sizes)})`);
  await run.openMenu();
  const state = await run.expectState('l\'accessibilité renforcée', 'le menu devait s\'ouvrir', current => current.menu && current.menu.rows.length === 8);
  if (state.menu) {
    if (state.menu.items.some(item => item.height < 36) || state.menu.rows.some(row => row.drop.w < 36 || row.drop.h < 36)) run.note('l\'accessibilité renforcée', 'les lignes et les croix devaient mesurer 36 px au moins');
    if (!inside(state.menu.box, state.view) || overlaps(state.menu.box, state.bar)) run.note('l\'accessibilité renforcée', `le menu devait tenir dans la page sans recouvrir la barre (${state.menu.box.map(Math.round)} / ${state.view})`);
  }
  await run.page.press('End');
  await run.expectState('Fin', `Fin devait atteindre « ${t('dock.openedMore')} » même quand la liste défile`, current => current.focus.label === t('dock.openedMore'));
  await run.page.press('Escape');
  await run.page.run(() => window.__bar.access(false));
}

// Les mesures de la barre, dans la langue de la page (`language`) et le mode déjà posé ; rend les écarts { kind, text }.
export async function barreProblems(page, site, language, mode, width = 700) {
  const found = [];
  await page.goto(`${site.url}${PAGE}?lang=${language}`);
  await page.run(() => window.__ready);
  await page.view({ width, height: 400, scale: 1, mode });
  await page.activate();
  const run = new Bar(page, language, `${width} px, ${mode === 'dark' ? 'sombre' : 'clair'}, ${language}`, found);
  const steps = width === 700 ? [layout, emptyMenu, filled, mouse, keyboard, edges, longName, access] : [longName, edges];
  for (const step of steps) {
    try {
      await step(run);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
  }
  return found;
}
