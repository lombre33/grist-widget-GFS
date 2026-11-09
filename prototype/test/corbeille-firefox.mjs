// La corbeille et le clavier de l'explorateur sous Firefox (décision du porteur du 04/11 : tout se fait depuis l'explorateur, avec une corbeille ; règle du 03/11 : toute nouvelle interface ajoute ses
// mesures à test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, le vrai
// `Trash`, la vraie fenêtre d'accord, un gardien de doublure) : Entrée dès l'ouverture, F2, Suppr, Retour arrière, « / », le clic droit et Maj+F10, ↑ ↓ en vignettes ; la vue « Corbeille » (comptée dans le
// volet, ses colonnes, sa barre, « Restaurer »), Suppr et « Vider la corbeille… » devant leur fenêtre (le clavier est sur « Annuler »). Entrée et Espace sur un BOUTON ne se jouent pas dans ce Firefox sans
// écran (voir test/interfaces-firefox.test.mjs) : la fenêtre se confirme à la souris. Ce que fait chaque touche sans DOM est dans test/explorer-keys.test.mjs.
import { createI18n } from '../js/i18n.js';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Ce que la personne voit : les lignes, la ligne choisie, où est le clavier, les phrases dites, la liste du menu ouvert, la fenêtre ouverte, la barre de la corbeille.
export function snapshot() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const active = document.activeElement;
  const own = active && active.closest ? active.closest('.ls-row, .th') : null;
  const tiles = [...document.querySelectorAll('.th')];
  const info = document.querySelector('.ex-info');
  const open = document.querySelector('.ex-foot > .btn');
  const trashRow = document.querySelector('.tr-row[data-view="trash"]');
  const modal = document.querySelector('.mod.ask');
  // La fenêtre tient dans la page et rien n'y déborde (ses boutons, son texte) : la liste de ce qui sort, vide quand tout va bien (la fonction vit dans la page : rien du module n'y est visible).
  const fits = () => {
    const box = modal.getBoundingClientRect();
    const outside = [...modal.querySelectorAll('*')].filter(node => {
      const at = node.getBoundingClientRect();
      return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1 || at.bottom > box.bottom + 1 || at.top < box.top - 1);
    }).map(node => node.className || node.tagName).slice(0, 5);
    const inPage = box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
    return inPage && outside.length === 0 ? [] : [inPage ? 'dans la page' : 'hors de la page', ...outside];
  };
  // Un texte coupé (points de suspension, ou lignes limitées) a son texte entier au survol (charte) : la liste de ceux qui n'ont pas de `title`, vide quand tout va bien. Les en-têtes de colonne tiennent sur une ligne.
  const cut = [...document.querySelectorAll('.ex *')].filter(node => {
    const style = getComputedStyle(node);
    const clipped = (style.textOverflow === 'ellipsis' && node.scrollWidth > node.clientWidth + 1) || (style.getPropertyValue('-webkit-line-clamp') !== 'none' && node.scrollHeight > node.clientHeight + 1);
    return clipped && !node.closest('[title]') && !node.getAttribute('aria-label');
  }).map(node => `${node.className || node.tagName} « ${text(node).slice(0, 40)} »`);
  return {
    cut,
    headHeights: [...document.querySelectorAll('.ls-head .hd')].map(node => Math.round(node.getBoundingClientRect().height)),
    headOverlap: [...document.querySelectorAll('.ls-head .hd')].map(node => node.getBoundingClientRect()).some((box, at, boxes) => at > 0 && box.width > 0 && boxes[at - 1].width > 0 && box.left < boxes[at - 1].right - 0.5),
    rows: [...document.querySelectorAll('.ls-row')].map(row => ({ name: text(row.querySelector('.t')), folder: row.classList.contains('folder') })),
    tiles: tiles.map(tile => text(tile.querySelector('.tn'))),
    perRow: tiles.length ? tiles.filter(tile => tile.offsetTop === tiles[0].offsetTop).length : 0,
    selected: text(document.querySelector('.ls-row[aria-selected="true"] .t, .th[aria-selected="true"] .tn')),
    focus: own ? text(own.querySelector('.t, .tn')) : (active && active.type === 'search' ? '(recherche)' : ((active && active.dataset && active.dataset.fk) || (active ? active.tagName : null))),
    search: document.querySelector('.inp-search input').value,
    notices: window.__notices.slice(),
    filing: window.__filing.map(entry => entry.join(':')),
    copies: window.__copies.map(entry => entry.join(':')),
    opened: window.__opened,
    crumbs: text(document.querySelector('.crumbs')),
    head: [...document.querySelectorAll('.ls-head .hd')].map(text),
    trashCount: text(trashRow && trashRow.querySelector('.cnt')),
    trashGrey: trashRow ? trashRow.getAttribute('aria-disabled') : null,
    bar: text(document.querySelector('.trash-bar .tb-text')),
    barButton: text(document.querySelector('.trash-bar .btn')),
    empty: (() => { const node = document.querySelector('.ex-scroll .empty'); return node && !node.hidden ? text(node) : null; })(),
    openLabel: text(open),
    openDisabled: open ? open.getAttribute('aria-disabled') : null,
    info: text(info),
    menu: [...document.querySelectorAll('.menu .menu-item')].map(item => ({ label: text(item.querySelector('.menu-label')), hint: text(item.querySelector('.menu-hint')), greyed: item.getAttribute('aria-disabled') === 'true' })),
    modal: modal ? { title: text(modal.querySelector('.mod-head h2')), items: modal.querySelectorAll('.ask-items li').length, focus: active && active.dataset ? active.dataset.fk || null : null, fits: fits(), note: text(modal.querySelector('.mod-note')) } : null,
    restoreButtons: document.querySelectorAll('.ls-row .rb.rs').length,
    pinButtons: document.querySelectorAll('.ls-row .rb.pin').length,
  };
}

// Le centre, à l'écran, de la ligne (ou de la vignette) qui porte ce nom, amenée dans la page.
export function centerOfName(name) {
  const node = [...document.querySelectorAll('.ls-row, .th')].find(item => (item.querySelector('.t, .tn') || {}).textContent === name);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const box = node.getBoundingClientRect();
  return [box.left + Math.min(60, box.width / 2), box.top + box.height / 2];
}

export function centerOfSelector(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
}

// ---------- la conduite ----------

export class Run {
  #page;
  #tag;
  #found;
  #family;

  // `family` : le nom de la famille de mesures, en tête de chaque écart (« corbeille et clavier », « copier et coller »).
  constructor(page, tag, found, family = 'corbeille et clavier') { this.#page = page; this.#tag = tag; this.#found = found; this.#family = family; }

  note(kind, text) { this.#found.push({ kind: `${this.#family} : ${kind}`, text: `${this.#tag} : ${text}` }); }

  get page() { return this.#page; }

  snap() { return this.#page.run(snapshot); }

  // Attend que `check(snapshot)` soit vrai (au plus 3 s) ; sinon un écart, `what` dit ce qui était attendu. Rend le dernier état.
  async expect(kind, what, check) {
    const started = Date.now();
    let state = await this.snap();
    while (!check(state) && Date.now() - started < 3000) { await delay(60); state = await this.snap(); }
    if (!check(state)) this.note(kind, `${what} (état : ${JSON.stringify({ ...state, menu: undefined, head: undefined }).slice(0, 400)})`);
    return state;
  }

  async click(name) {
    const at = await this.#page.run(centerOfName, name);
    if (!at) { this.note('ligne introuvable', `« ${name} » n'est pas dans la liste`); return false; }
    await this.#page.click(...at);
    return true;
  }

  async clickSelector(selector) {
    const at = await this.#page.run(centerOfSelector, selector);
    if (!at) { this.note('bouton introuvable', `${selector} n'est pas dans la page`); return false; }
    await this.#page.click(...at);
    return true;
  }

  reset() { return this.#page.run(() => window.__reset()); }
}

export const names = state => state.rows.map(row => row.name);

// Entrée dès l'ouverture (la première ligne a le clavier sans être choisie), puis Retour arrière : le dossier parent.
async function opening(run) {
  await run.reset();
  const start = await run.snap();
  if (start.cut.length) run.note('texte coupé sans info-bulle', `des textes de la liste sont coupés sans leur texte entier au survol : ${start.cut.slice(0, 3).join(' ; ')}`);
  if (start.focus !== 'Formation' || start.selected !== null) run.note('le clavier à l\'ouverture', `le clavier devait être sur la première ligne, sans rien de choisi (focus ${start.focus}, choisi ${start.selected})`);
  await run.page.press('Enter');
  await run.expect('Entrée sur la première ligne', 'Entrée devait ouvrir le dossier « Formation » avant tout autre geste', state => names(state).join('|') === 'Contrat de prestation|Support de session');
  await run.click('Support de session');
  await run.page.press('Backspace');
  await run.expect('Retour arrière', 'Retour arrière devait remonter au dossier parent (la racine : « Formation » en tête)', state => names(state)[0] === 'Formation' && state.rows.length > 5 && !state.crumbs.includes('Formation'));
  await run.page.press('Backspace');
  const root = await run.snap();
  if (names(root)[0] !== 'Formation') run.note('Retour arrière à la racine', 'Retour arrière à la racine ne devait rien changer');
}

// F2 puis Suppr sur un fichier : le renommage est demandé au rangement, le fichier part à la corbeille (sans question), la ligne suivante prend le clavier et le volet compte un fichier.
async function renameAndTrash(run, t) {
  await run.reset();
  const before = await run.snap();
  await run.click('Convocation');
  await run.page.press('F2');
  await run.expect('F2', 'F2 devait demander à renommer « Convocation »', state => state.filing.join() === 'rename:Convocation');
  await run.page.press('Delete');
  const after = await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille, sans question, et passer au fichier suivant', state => !names(state).includes('Convocation') && state.trashCount === '1'
    && state.notices.at(-1) === t('trash.moved', { name: 'Convocation' }) && state.modal === null);
  const next = before.rows[before.rows.findIndex(row => row.name === 'Convocation') + 1].name;
  if (after.selected !== next || after.focus !== next) run.note('Suppr : la ligne suivante', `après Suppr, le clavier devait passer à « ${next} » (choisi ${after.selected}, clavier ${after.focus})`);
}

// La vue « Corbeille » : sa ligne du volet, ses colonnes, sa barre, son bouton « Restaurer » ; F2 n'y fait rien ; Entrée restaure ; la liste vide le dit.
async function trashView(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  await run.clickSelector('.tr-row[data-view="trash"]');
  const view = await run.expect('vue « Corbeille »', 'la vue « Corbeille » devait lister « Convocation », avec sa barre et un bouton « Restaurer » grisé', state => names(state).join() === 'Convocation' && state.bar === t('trash.bar')
    && state.barButton === t('trash.empty') && state.openLabel === t('trash.restore') && state.openDisabled === 'true' && state.crumbs.includes(t('trash.view')));
  if (view.cut.length) run.note('texte coupé sans info-bulle', `à la corbeille, des textes sont coupés sans leur texte entier au survol : ${view.cut.slice(0, 3).join(' ; ')}`);
  if (view.headHeights.some(height => height > 24)) run.note('en-tête sur deux lignes', `un en-tête de colonne de la corbeille passe sur deux lignes (hauteurs ${view.headHeights.join(', ')} px)`);
  if (view.headOverlap) run.note('en-têtes qui se recouvrent', 'deux en-têtes de colonne de la corbeille se recouvrent (« Supprimé » déborde sur la colonne voisine)');
  if (!view.head.includes(t('trash.deleted'))) run.note('colonne de date', `la colonne de date devait dire « ${t('trash.deleted')} » (${view.head.join(', ')})`);
  if (view.restoreButtons !== 1 || view.pinButtons !== 0) run.note('bouton de ligne', `la ligne devait porter « Restaurer » et pas d'étoile (${view.restoreButtons} restaurer, ${view.pinButtons} étoile)`);
  await run.click('Convocation');
  await run.expect('fichier choisi à la corbeille', 'le fichier choisi devait dégriser « Restaurer » et dire quand il a été supprimé', state => state.openDisabled === 'false'
    && state.info.includes(t('trash.deletedOn', { date: 'XYZ' }).split('XYZ')[0].trim()));
  const filedBefore = (await run.snap()).filing.length;
  await run.page.press('F2');
  await delay(150);
  if ((await run.snap()).filing.length !== filedBefore) run.note('F2 à la corbeille', 'F2 ne devait rien renommer à la corbeille');
  await run.page.press('Enter');
  await run.expect('Entrée à la corbeille', 'Entrée devait restaurer « Convocation » : la corbeille est vide, elle le dit', state => state.rows.length === 0 && state.empty === t('trash.emptyList')
    && state.notices.at(-1) === t('trash.restored', { name: 'Convocation' }) && state.trashCount === null);
  await run.clickSelector('.crumbs button');
  await run.expect('retour aux dossiers', 'le fil d\'Ariane devait ramener aux dossiers, « Convocation » y est revenu', state => names(state).includes('Convocation'));
}

// Suppr à la corbeille : la fenêtre nomme le fichier et laisse le clavier à « Annuler » ; Échap ne supprime rien ; « Supprimer définitivement » (la souris) supprime ; « Vider la corbeille… » demande aussi.
async function purgeAndEmpty(run, t) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('deux fichiers à la corbeille', 'Suppr, deux fois, devait mettre deux fichiers à la corbeille', state => state.trashCount === '1');
  await run.page.press('Delete');
  await run.expect('deux fichiers à la corbeille', 'Suppr, deux fois, devait mettre deux fichiers à la corbeille', state => state.trashCount === '2');
  await run.clickSelector('.tr-row[data-view="trash"]');
  await run.expect('la corbeille', 'la corbeille devait lister les deux fichiers', state => state.rows.length === 2);
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr à la corbeille', 'Suppr devait ouvrir la fenêtre « Supprimer définitivement », le clavier sur « Annuler »', state => state.modal && state.modal.title === t('trash.purge.title', { name: 'Convocation' })
    && state.modal.focus === 'ask-no');
  await run.page.press('Escape');
  await run.expect('Échap devant la fenêtre', 'Échap devait fermer la fenêtre sans rien supprimer', state => state.modal === null && state.rows.length === 2);
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr à la corbeille', 'la fenêtre devait se rouvrir', state => state.modal !== null);
  await run.clickSelector('[data-fk="ask-yes"]');
  await run.expect('supprimer définitivement', 'confirmée à la souris, la suppression devait retirer « Convocation » et le dire', state => state.modal === null && state.rows.length === 1
    && state.notices.at(-1) === t('trash.purged', { name: 'Convocation' }));
  await run.clickSelector('.trash-bar .btn');
  await run.expect('vider la corbeille', '« Vider la corbeille… » devait ouvrir sa fenêtre, qui nomme le fichier restant', state => state.modal && state.modal.title === t('trash.emptyAll.title') && state.modal.items === 1);
  await run.clickSelector('[data-fk="ask-yes"]');
  await run.expect('vider la corbeille', 'confirmée, la corbeille devait se vider et le dire', state => state.rows.length === 0 && state.empty === t('trash.emptyList') && state.notices.at(-1) === t('trash.emptied', { n: 1 }));
}

// La question de la table de la corbeille des apps (contrats 6.7) : un texte long dans une fenêtre du widget ; elle tient dans la page avec ses deux boutons, « Annuler » la ferme sans rien faire.
async function tableWindow(run, t) {
  await run.reset();
  await run.page.run(() => window.__askTable());
  await run.expect('la table de la corbeille', 'la fenêtre devait s\'ouvrir avec son titre et tenir dans la page (état : fits)', state => state.modal && state.modal.title === t('trash.table.title') && state.modal.fits.length === 0);
  await run.clickSelector('[data-fk="ask-no"]');
  await run.expect('la table de la corbeille', '« Annuler » devait fermer la fenêtre', state => state.modal === null);
}

// Le clic droit et Maj+F10 : le menu de CETTE ligne, avec les touches dans les articles ; la corbeille y est un article comme un autre.
async function menus(run, t) {
  await run.reset();
  const at = await run.page.run(centerOfName, 'Convocation');
  await run.page.rightClick(...at);
  const hints = state => {
    const entry = label => state.menu.find(item => item.label === label);
    return entry(t('ex.rename')) && entry(t('ex.rename')).hint === 'F2' && entry(t('trash.move')) && entry(t('trash.move')).hint === t('key.delete') && entry(t('trash.move')).greyed === false
      && state.menu[0].hint === t('key.enter');
  };
  await run.expect('clic droit', 'le clic droit devait ouvrir le menu de « Convocation », avec F2, Suppr et Entrée dans ses articles', state => state.selected === 'Convocation' && state.menu.length >= 6 && hints(state));
  await run.page.press('Escape');
  await run.expect('Échap dans le menu', 'Échap devait fermer le menu', state => state.menu.length === 0);
  await run.click('Main');
  await run.page.chord('Shift', 'F10');
  await run.expect('Maj+F10', 'Maj+F10 devait ouvrir le menu de « Main »', state => state.selected === 'Main' && state.menu.length >= 6 && hints(state));
  await run.page.press('Escape');
  await run.expect('Échap dans le menu', 'Échap devait fermer le menu', state => state.menu.length === 0);
  await run.click('Formation');
  await run.page.press('Delete');
  await run.expect('Suppr sur un dossier', 'Suppr sur un dossier qui a des fichiers devait dire qu\'il ne se supprime pas ainsi, sans rien supprimer (les dossiers : test/dossiers-firefox.mjs)', state => state.notices.at(-1) === t('ex.folderNotEmpty') && state.rows.length > 5 && state.trashCount === null);
}

// « / » met le clavier dans la recherche sans s'y écrire ; ce qu'on tape ensuite filtre ; Échap vide la recherche.
async function searching(run) {
  await run.reset();
  await run.click('Main');
  await run.page.press('/');
  await run.expect('« / »', '« / » devait mettre le clavier dans la recherche, sans y écrire le signe', state => state.focus === '(recherche)' && state.search === '');
  await run.page.press('c', 'o', 'n', 'v', '/');
  await run.expect('la recherche', 'taper « conv/ » devait filtrer la liste sur « Convocation » (le deuxième « / » est un signe comme un autre, la ponctuation est ignorée)', state => state.search === 'conv/' && names(state).join() === 'Convocation');
  await run.page.press('Backspace');
  await run.expect('la recherche', 'Retour arrière dans la recherche devait effacer « / », non remonter d\'un dossier', state => state.search === 'conv' && names(state).join() === 'Convocation');
  await run.page.press('Escape');
  await run.expect('Échap dans la recherche', 'Échap devait vider la recherche', state => state.search === '' && state.rows.length > 5);
}

// En vignettes ↑ et ↓ changent de rangée ; ← et → de vignette.
async function tiles(run) {
  await run.reset();
  await run.clickSelector('.tb-group .tb:nth-child(2)');
  const first = await run.expect('vignettes', 'la vue en vignettes devait s\'afficher', state => state.tiles.length > 5);
  if (first.cut.length) run.note('texte coupé sans info-bulle', `des vignettes ont un nom coupé sans son texte entier au survol : ${first.cut.slice(0, 3).join(' ; ')}`);
  if (first.perRow < 2) { run.note('vignettes', `moins de deux vignettes par rangée (${first.perRow}) : ↓ ne se mesure pas`); return; }
  await run.click(first.tiles[0]);
  await run.page.press('ArrowDown');
  await run.expect('↓ en vignettes', `↓ devait aller une rangée plus bas, à « ${first.tiles[first.perRow]} »`, state => state.selected === first.tiles[first.perRow]);
  await run.page.press('ArrowRight');
  await run.expect('→ en vignettes', '→ devait aller à la vignette suivante', state => state.selected === first.tiles[first.perRow + 1]);
  await run.page.press('ArrowUp');
  await run.expect('↑ en vignettes', '↑ devait remonter d\'une rangée', state => state.selected === first.tiles[1]);
  await run.clickSelector('.tb-group .tb:nth-child(1)');
  await run.expect('retour en liste', 'la liste devait revenir', state => state.rows.length > 5);
}

// Retour arrière depuis la corbeille : la racine.
async function leavingTrash(run) {
  await run.reset();
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait mettre « Convocation » à la corbeille', state => state.trashCount === '1');
  await run.clickSelector('.tr-row[data-view="trash"]');
  await run.expect('la corbeille', 'la corbeille devait lister « Convocation »', state => names(state).join() === 'Convocation');
  await run.click('Convocation');
  await run.page.press('Backspace');
  await run.expect('Retour arrière à la corbeille', 'Retour arrière depuis la corbeille devait ramener à la racine', state => names(state)[0] === 'Formation' && state.bar === null);
}

// Les mesures de la corbeille et du clavier, dans la langue de la page (`language`) ; rend les écarts { kind, text }.
export async function corbeilleProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found);
  const steps = [opening, renameAndTrash, trashView, purgeAndEmpty, tableWindow, menus, searching, tiles, leavingTrash];
  for (const step of steps) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
  }
  return found;
}
