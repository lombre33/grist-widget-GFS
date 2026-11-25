// Les colonnes de la liste et l'organigramme filtré sous Firefox (règle du 03/11 ; module Annuaire, retours du porteur du 25/11 : « des colonnes pour les attributs, réglables comme les
// filtres », « des filtres sur l'organigramme, les mêmes partout », « par défaut déplié jusqu'au niveau le plus bas, et une option en haut pour montrer ou non les gens »), à la vraie
// souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js : l'adresse et le télétravail sont en colonnes). Suite de test/annuaire-firefox.mjs.
// À mesurer : la ligne de titres au-dessus des lignes quand la place le permet (mêmes colonnes que les lignes), les colonnes qui passent sous le nom avec leur libellé quand c'est
// étroit (une cellule vide s'efface), un oui/non dit en toutes lettres ; l'organigramme déplié jusqu'au bout au premier regard, le bouton « Personnes » (une petite carte par personne,
// retenu sur le navigateur, absent de l'organigramme des responsables), les filtres de l'organigramme (les niveaux et les champs, les mêmes que la liste), la recherche qui le réduit,
// les responsables des personnes trouvées en cartes estompées.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { clickOn } from './annuaire-table-firefox.mjs';

const PROBES = { col: ['.an-person[aria-pressed="false"] .an-pe-col', '.an-card'], colHead: ['.an-ch', '.an-card'], person: ['.an-oc.is-person .an-oc-title', '.an-oc'],
  dim: ['.an-oc.is-dim .an-oc-title', '.an-oc'] };
const FILTERS = '.an-org-tools [data-fk="filters"]'; // le bouton du fil de la liste est caché dans l'organigramme : il ne faut pas cliquer le premier de la page
const STACKED = 560; // la largeur du volet du milieu sous laquelle les colonnes passent sous le nom (css/annuaire.css)

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

// ---------- ce qui s'exécute dans la page ----------

function colsSnap() {
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const list = document.querySelector('.an-list');
  const main = document.querySelector('.an-main');
  const head = list.querySelector('.an-cols-head');
  const shown = node => node && node.getClientRects().length > 0;
  return { has: list.classList.contains('has-cols'), main: box(main), list: box(list), sideways: list.scrollWidth - list.clientWidth,
    head: shown(head) ? { box: box(head), cells: [...head.querySelectorAll('.an-ch')].map(cell => ({ text: text(cell), box: box(cell) })) } : null,
    rows: [...list.querySelectorAll('.an-person')].map(row => ({ name: text(row.querySelector('.an-pe-name')), box: box(row), cells: [...row.querySelectorAll('.an-pe-col')].map(cell => ({
      text: text(cell), label: cell.dataset.label, box: box(cell), display: getComputedStyle(cell).display, before: getComputedStyle(cell, '::before').content,
      cut: cell.scrollWidth > cell.clientWidth + 1, ellipsis: getComputedStyle(cell).textOverflow === 'ellipsis' })) })) };
}

function orgSnap() {
  const org = document.querySelector('.an-org');
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const shown = node => node && node.getClientRects().length > 0;
  const none = org.querySelector('.an-org-none');
  const panel = document.querySelector('.an-fpanel');
  return { frame: box(org.querySelector('.an-org-scroll')), zoom: text(org.querySelector('.an-zoom')),
    cards: [...org.querySelectorAll('.an-oc')].map(card => ({ id: card.dataset.id, title: text(card.querySelector('.an-oc-title')), person: card.classList.contains('is-person'),
      dim: card.classList.contains('is-dim'), height: card.parentElement.offsetHeight, box: box(card), cut: card.querySelector('.an-oc-title').scrollWidth > card.querySelector('.an-oc-title').clientWidth + 1 })),
    pills: [...org.querySelectorAll('.an-oc .an-pill')].map(pill => ({ text: text(pill), cut: pill.scrollWidth > pill.clientWidth + 1 })),
    folds: [...org.querySelectorAll('.an-fold')].map(fold => ({ id: fold.dataset.id, expanded: fold.getAttribute('aria-expanded') })),
    tools: [...org.querySelectorAll('.an-org-tools button')].map(button => ({ fk: button.dataset.fk, text: text(button), pressed: button.getAttribute('aria-pressed'), title: button.title,
      disabled: button.getAttribute('aria-disabled') === 'true', box: box(button) })),
    chips: shown(panel) ? [...panel.querySelectorAll('.an-fv')].map(chip => ({ fk: chip.dataset.fk, text: text(chip), pressed: chip.getAttribute('aria-checked') === 'true' })) : [],
    none: shown(none) ? text(none) : null, foot: text(document.querySelector('.an-foot')), stored: (() => { try { return window.localStorage.getItem('gfs.annuaire.orgPeople'); } catch (error) { return 'x'; } })(),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

// ---------- les colonnes de la liste ----------

// Les colonnes d'une liste : le titre de chaque colonne, ce que chaque ligne y met, la même grille d'un bout à l'autre, ou, étroit, le libellé devant chaque valeur.
function columnsCheck(snap, t, note, where, { grid }) {
  if (!snap.has) { note('colonnes', `${where} : la liste n'a pas ses colonnes (classe « has-cols » absente)`); return; }
  const labels = [t('an.mail'), 'Teletravail'];
  if (grid) {
    if (!snap.head) note('colonnes', `${where} : pas de ligne de titres alors que le volet mesure ${Math.round(snap.main.width)} px`);
    else {
      const names = snap.head.cells.map(cell => cell.text);
      if (names.join() !== [t('an.col.name'), ...labels].join()) note('colonnes', `${where} : les titres sont « ${names.join(' | ')} » (« ${[t('an.col.name'), ...labels].join(' | ')} » attendus)`);
      const first = snap.rows[0];
      for (const [i, label] of labels.entries()) {
        const cell = first && first.cells[i];
        const title = snap.head.cells[i + 1];
        if (cell && title && Math.abs(cell.box.left - title.box.left) > 1.5) note('colonnes', `${where} : la colonne « ${label} » n'est pas sous son titre (${Math.round(title.box.left)} px, ${Math.round(cell.box.left)} px)`);
      }
      if (snap.head.box.width < snap.list.width - 40 && snap.sideways <= 0) note('colonnes', `${where} : la ligne de titres ne s'étend pas sur la liste`);
    }
  } else if (snap.head) note('colonnes', `${where} : la ligne de titres est là alors que le volet ne mesure que ${Math.round(snap.main.width)} px (les colonnes passent sous le nom)`);
  const camille = snap.rows.find(row => row.name === 'Camille Durand');
  if (!camille) { note('colonnes', `${where} : « Camille Durand » manque`); return; }
  const wanted = ['camille.durand@exemple.fr', t('an.yes')];
  if (camille.cells.map(cell => cell.text).join() !== wanted.join()) note('colonnes', `${where} : les cellules de « Camille Durand » sont « ${camille.cells.map(cell => cell.text).join(' | ')} » (« ${wanted.join(' | ')} » attendues)`);
  const emma = snap.rows.find(row => row.name === 'Emma Rolland');
  if (emma && emma.cells[1] && emma.cells[1].text !== '') note('colonnes', `${where} : le télétravail vide d'« Emma Rolland » dit « ${emma.cells[1].text} »`);
  for (const row of snap.rows) {
    if (row.cells.length !== labels.length) note('colonnes', `${where} : « ${row.name} » a ${row.cells.length} cellules (${labels.length} attendues)`);
    for (const cell of row.cells) {
      if (cell.display === 'none') { if (cell.text) note('colonnes', `${where} : la cellule « ${cell.label} » de « ${row.name} » est cachée alors qu'elle dit « ${cell.text} »`); continue; }
      if (!inside(cell.box, row.box, 2)) note('colonnes', `${where} : la cellule « ${cell.label} » de « ${row.name} » sort de sa ligne`);
      if (cell.cut && !cell.ellipsis) note('colonnes', `${where} : la cellule « ${cell.label} » de « ${row.name} » est coupée sans « … »`);
      if (!grid && !cell.before.includes(cell.label)) note('colonnes', `${where} : la cellule « ${cell.label} » de « ${row.name} » n'écrit pas son libellé devant (${cell.before})`);
    }
    if (row.box.height < 40) note('ligne basse', `${where} : la ligne de « ${row.name} » ne mesure que ${Math.round(row.box.height)} px`);
  }
  if (!grid && snap.sideways > 1) note('défile de côté', `${where} : la liste défile de côté de ${snap.sideways} px alors que les colonnes passent sous le nom`);
}

export async function listColumnsProblems(page, t, note, click, { width, mode }) {
  let snap = await page.run(colsSnap);
  columnsCheck(snap, t, note, `les colonnes de la liste à ${width} px`, { grid: snap.main.width > STACKED });
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (what.startsWith('col') && value < 4.5) note('contraste', `les colonnes de la liste (${mode}) : « ${what} » trop pâle (${value.toFixed(2)})`); });
  if (width !== 700) return;
  // Large : la grille avec sa ligne de titres (les mêmes colonnes que les lignes), sans rien qui sorte de la liste.
  await page.view({ width: 1200, scale: 1, mode });
  await delay(150);
  snap = await page.run(colsSnap);
  columnsCheck(snap, t, note, 'les colonnes de la liste à 1200 px', { grid: true });
  if (snap.sideways > 1) note('défile de côté', `les colonnes de la liste à 1200 px : la liste défile de côté de ${snap.sideways} px alors que la place suffit`);
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (what === 'colHead' && value < 4.5) note('contraste', `la ligne de titres (${mode}) : trop pâle (${value.toFixed(2)})`); });
  await page.view({ width, scale: 1, mode });
  await delay(150);
}

// ---------- l'organigramme filtré ----------

const structures = snap => snap.cards.filter(card => !card.person);
const people = snap => snap.cards.filter(card => card.person);

// L'organigramme au premier regard : tout déplié, un bouton « Personnes » éteint, un bouton « Filtres ».
async function firstLook(t, note, frame, where, snap) {
  if (snap.folds.some(fold => fold.expanded !== 'true')) note('organigramme', `${where} : une branche est repliée au premier regard (${snap.folds.filter(fold => fold.expanded !== 'true').length} sur ${snap.folds.length}) : tout doit être déplié jusqu'au niveau le plus bas`);
  if (structures(snap).length !== 9) note('organigramme', `${where} : ${structures(snap).length} cartes de structure au premier regard (9 attendues : la racine, trois pôles, quatre directions, un service)`);
  if (!structures(snap).some(card => card.title === 'Budget')) note('organigramme', `${where} : le niveau le plus bas (« Budget ») n'est pas dessiné`);
  const cutPills = snap.pills.filter(pill => pill.cut);
  if (cutPills.length) note('organigramme', `${where} : le nombre de personnes est coupé sur ${cutPills.length} carte(s) (« ${cutPills.map(pill => pill.text).join(' | ')} ») : il ne doit jamais se couper`);
  const peopleButton = snap.tools.find(tool => tool.fk === 'org-people');
  const filtersButton = snap.tools.find(tool => tool.fk === 'filters');
  if (!peopleButton) note('organigramme', `${where} : le bouton « ${t('an.org.people')} » manque dans la barre`);
  else {
    if (peopleButton.pressed !== 'false') note('organigramme', `${where} : « ${t('an.org.people')} » est allumé par défaut`);
    if (people(snap).length) note('organigramme', `${where} : des personnes sont dessinées alors que « ${t('an.org.people')} » est éteint`);
    if (peopleButton.box.height < 24) note('cible trop petite', `${where} : « ${t('an.org.people')} » mesure ${Math.round(peopleButton.box.height)} px de haut`);
  }
  if (!filtersButton) note('organigramme', `${where} : le bouton « ${t('an.filters')} » manque dans la barre de l'organigramme`);
  else if (filtersButton.box.height < 24) note('cible trop petite', `${where} : « ${t('an.filters')} » mesure ${Math.round(filtersButton.box.height)} px de haut`);
  await frame(where);
}

// `frame(texte)` : mesure le cadre de la fenêtre dans l'état où elle est (test/annuaire-firefox.mjs, `frameProblems`).
export async function orgFiltersProblems(page, t, note, click, inspectNow, frame) {
  await click('[data-fk="v:org"]');
  await click('[data-fk="om:structures"]'); // l'essai de l'organigramme a laissé celui des responsables
  await delay(200);
  const where = 'l\'organigramme filtré';
  let snap = await page.run(orgSnap);
  await firstLook(t, note, frame, `${where} (premier regard)`, snap);

  // « Personnes » : une petite carte par personne, sous sa structure, retenue sur le navigateur.
  await click('[data-fk="org-people"]');
  await delay(200);
  snap = await page.run(orgSnap);
  const crew = people(snap);
  if (crew.length !== 7) note('organigramme', `${where} : « ${t('an.org.people')} » dessine ${crew.length} personnes (7 attendues)`);
  if (crew.some(card => card.height !== 36)) note('organigramme', `${where} : une petite carte de personne ne mesure pas 36 px (${crew.map(card => card.height).join(', ')})`);
  if (snap.tools.find(tool => tool.fk === 'org-people').pressed !== 'true') note('organigramme', `${where} : « ${t('an.org.people')} » ne se dit pas allumé`);
  if (snap.stored !== '1') note('organigramme', `${where} : le choix n'est pas retenu sur le navigateur (${snap.stored})`);
  if (snap.focused !== 'org-people') note('clavier', `${where} : après le clic, le clavier est sur « ${snap.focused} » (« org-people » attendu)`);
  await click('[data-fk="org-fit"]');
  snap = await page.run(orgSnap);
  const outside = snap.cards.filter(card => !inside(card.box, snap.frame, 2));
  if (outside.length && parseInt(snap.zoom, 10) > 25) note('organigramme', `${where} : « Tout voir » laisse ${outside.length} carte(s) hors du cadre avec les personnes (${outside.map(card => card.title).slice(0, 3).join(', ')})`);
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (what === 'person' && value < 4.5) note('contraste', `${where} : « ${what} » trop pâle (${value.toFixed(2)})`); });
  await frame(`${where}, avec les personnes`);
  const person = crew.find(card => card.title === 'Camille Durand');
  if (person) {
    await click(`[data-fk="oc:${person.id}"]`);
    const fiche = await inspectNow();
    if (!fiche.fiche || fiche.fiche.name !== 'Camille Durand') note('organigramme', `${where} : un clic sur la petite carte de « Camille Durand » ouvre « ${fiche.fiche ? fiche.fiche.name : 'rien'} »`);
    await click('[data-fk="side-x"]');
    const back = await inspectNow();
    if (back.focused !== `oc:${person.id}`) note('clavier', `${where} : après « Fermer la fiche » le clavier est sur « ${back.focused} » (« oc:${person.id} » attendu)`);
  } else note('organigramme', `${where} : la petite carte de « Camille Durand » manque`);

  // Le panneau défile sous 400 px de haut : une case plus bas que la première page est d'abord amenée sous la souris.
  const inPanel = selector => clickOn(page, note, selector);
  // Les filtres : les mêmes que la liste, les niveaux d'abord ; un niveau réduit l'organigramme à sa branche.
  await click(FILTERS);
  snap = await page.run(orgSnap);
  const level = snap.chips.find(chip => chip.fk === 'fl:@L0:Pôle Numérique');
  if (!level) { note('organigramme', `${where} : le filtre du niveau « Pôle » manque dans l'organigramme (${snap.chips.map(chip => chip.fk).join(' | ')})`); return finish(page, click); }
  await frame(`${where}, filtres ouverts`);
  await inPanel(`[data-fk="${level.fk}"]`);
  snap = await page.run(orgSnap);
  if (structures(snap).length !== 3 || !['Pôle Numérique', 'Direction du numérique'].every(name => structures(snap).some(card => card.title === name))) note('organigramme', `${where} : le filtre « Pôle Numérique » laisse ${structures(snap).length} cartes de structure (3 attendues : ${structures(snap).map(card => card.title).join(', ')})`);
  if (people(snap).map(card => card.title).join() !== 'Louis Girard') note('organigramme', `${where} : le filtre « Pôle Numérique » laisse les personnes « ${people(snap).map(card => card.title).join(', ')} » (« Louis Girard » seul attendu)`);
  if (!snap.foot.includes('1')) note('pied', `${where} : le pied dit « ${snap.foot} » avec un filtre qui laisse une personne`);
  if (snap.folds.some(fold => fold.expanded !== 'true')) note('organigramme', `${where} : une branche est repliée après un filtre (tout se déplie de nouveau)`);
  await frame(`${where}, filtré par niveau`);
  // Un niveau et un champ se cumulent : Louis Girard n'est pas contractuel, plus personne.
  // Le panneau se souvient des filtres que la personne a dépliés : on ne déplie « Contrat » que s'il est replié.
  if (!(await page.run(orgSnap)).chips.some(chip => chip.fk === 'fl:Contrat:Contractuelle')) await inPanel('[data-fk="fs:Contrat"]');
  await inPanel('[data-fk="fl:Contrat:Contractuelle"]');
  snap = await page.run(orgSnap);
  if (snap.cards.length || !snap.none || !snap.none.includes(t('an.list.none'))) note('organigramme', `${where} : sans personne qui passe les filtres l'organigramme dit « ${snap.none} » avec ${snap.cards.length} cartes (« ${t('an.list.none')} » attendu, aucune carte)`);
  await inPanel('[data-fk="fl:Contrat:Contractuelle"]');
  await inPanel(`[data-fk="${level.fk}"]`);
  snap = await page.run(orgSnap);
  if (structures(snap).length !== 9 || people(snap).length !== 7) note('organigramme', `${where} : les filtres relâchés laissent ${structures(snap).length} structures et ${people(snap).length} personnes (9 et 7 attendues)`);
  await click(FILTERS);

  // La recherche réduit aussi l'organigramme ; les responsables des personnes trouvées sont estompés.
  await click('.an-search input');
  await page.press('c', 'a', 'm', 'i', 'l', 'l', 'e');
  await delay(200);
  snap = await page.run(orgSnap);
  if (structures(snap).length !== 4 || !['Pôle Ressources', 'Direction des finances', 'Budget'].every(name => structures(snap).some(card => card.title === name))) note('organigramme', `${where} : la recherche « camille » laisse les structures « ${structures(snap).map(card => card.title).join(', ')} » (la branche de « Budget » attendue)`);
  if (people(snap).map(card => card.title).join() !== 'Camille Durand') note('organigramme', `${where} : la recherche « camille » laisse les personnes « ${people(snap).map(card => card.title).join(', ')} »`);
  await click('[data-fk="om:managers"]');
  await delay(200);
  snap = await page.run(orgSnap);
  const dim = snap.cards.filter(card => card.dim).map(card => card.title).sort().join();
  if (snap.cards.length !== 3 || dim !== 'Emma Rolland,Nathan Roussel') note('organigramme', `${where} : les responsables de « camille » : ${snap.cards.map(card => `${card.title}${card.dim ? ' (estompée)' : ''}`).join(', ')} (Camille, avec Nathan et Emma estompés, attendue)`);
  if (snap.pills.some(pill => pill.cut)) note('organigramme', `${where} : le nombre de personnes d'une carte de responsable est coupé`);
  if (snap.tools.some(tool => tool.fk === 'org-people')) note('organigramme', `${where} : « ${t('an.org.people')} » est dans l'organigramme des responsables, où les personnes sont déjà les cartes`);
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (what === 'dim' && value < 4.5) note('contraste', `${where} : une carte estompée est trop pâle (${value.toFixed(2)})`); });
  await frame(`${where}, responsables d'une recherche`);
  await click('[data-fk="om:structures"]');
  return finish(page, click);
}

// Remet tout comme au départ : la recherche effacée, « Personnes » éteint, la liste.
async function finish(page, click) {
  await click('.an-search input');
  for (let i = 0; i < 7; i++) await page.press('Backspace');
  await delay(100);
  const snap = await page.run(orgSnap);
  const people_ = snap.tools.find(tool => tool.fk === 'org-people');
  if (people_ && people_.pressed === 'true') await click('[data-fk="org-people"]');
  await click('[data-fk="v:list"]');
  await delay(100);
}

// ---------- le tri de la liste ----------

// Ce que la liste et les boutons de tri disent du tri en cours.
function sortSnap() {
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const list = document.querySelector('.an-list');
  const button = document.querySelector('.an-crumb [data-fk="sort-pick"]');
  const rows = [...list.querySelectorAll('.an-person, .an-pcard')];
  return { names: rows.map(row => text(row.querySelector('.an-pe-name'))), subs: rows.map(row => (row.querySelector('.an-pe-sub') ? text(row.querySelector('.an-pe-sub')) : '')),
    mails: rows.map(row => { const cell = row.querySelector('.an-pe-col'); return cell ? text(cell) : ''; }),
    head: [...list.querySelectorAll('.an-ch')].map(cell => ({ fk: cell.dataset.fk, sorted: cell.classList.contains('is-sorted'), label: cell.getAttribute('aria-label'),
      arrow: Boolean(cell.querySelector('.ic')), height: cell.getBoundingClientRect().height })),
    button: button ? { text: text(button), on: button.classList.contains('is-on'), label: button.getAttribute('aria-label'), box: box(button), main: box(document.querySelector('.an-main')) } : null,
    pick: [...document.querySelectorAll('.pk [data-fk]')].map(node => node.dataset.fk), focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

const COLLATOR = new Intl.Collator('fr-FR', { numeric: true, sensitivity: 'base' });

// Les valeurs non vides dans l'ordre demandé (`sign` 1 : croissant, -1 : décroissant), les vides à la fin.
function ordered(values, sign) {
  const filled = values.filter(Boolean);
  const emptyAtEnd = values.slice(filled.length).every(value => !value) && values.slice(0, filled.length).every(Boolean);
  return emptyAtEnd && filled.every((value, at) => at === 0 || sign * COLLATOR.compare(filled[at - 1], value) <= 0);
}

// Ouvre la liste « Trier par » : le bouton, puis les choix (« Ordre de l'annuaire », les colonnes) ; un choix par son clavier de liste.
async function openPick(page, click, note, where) {
  await click('.an-crumb [data-fk="sort-pick"]');
  await delay(120);
  const snap = await page.run(sortSnap);
  if (!snap.pick.includes('pick-name') || !snap.pick.includes('pick-__none') || !snap.pick.includes('pick-title')) note('tri', `${where} : la liste « Trier par » ne propose pas « nom », « poste » et « ordre de l'annuaire » (${snap.pick.join(' ')})`);
  return snap;
}

// Les titres de colonne triés au clic, le bouton « Trier » et sa liste : croissant, décroissant, plus de tri ; les deux disent le tri en cours ; le bouton se mesure à chaque largeur.
export async function sortProblems(page, t, note, click, { width, mode }) {
  const where = `le tri à ${width} px (${mode})`;
  let snap = await page.run(sortSnap);
  const start = snap.names;
  if (!snap.button) { note('tri', `${where} : le bouton « Trier » manque dans le fil de la liste`); return; }
  if (snap.button.box.height < 24 || snap.button.box.left < snap.button.main.left || snap.button.box.right > snap.button.main.right + 1) note('tri', `${where} : le bouton « Trier » mesure ${Math.round(snap.button.box.width)} × ${Math.round(snap.button.box.height)} ou sort du volet`);
  if (snap.button.on) note('tri', `${where} : le bouton dit un tri avant tout choix (« ${snap.button.text} »)`);
  if (width === 700) {
    // Large : les titres de colonne sont des boutons.
    await page.view({ width: 1200, scale: 1, mode });
    await delay(150);
    snap = await page.run(sortSnap);
    if (!snap.head.length) { note('tri', 'à 1200 px : les titres de colonne ne sont pas là'); } else {
      if (snap.head.some(cell => cell.height < 20)) note('cible trop petite', `à 1200 px : un titre de colonne mesure ${Math.round(Math.min(...snap.head.map(cell => cell.height)))} px de haut`);
      await click('[data-fk="sort:email"]');
      snap = await page.run(sortSnap);
      const mail = snap.head.find(cell => cell.fk === 'sort:email');
      if (!mail || !mail.sorted || !mail.arrow) note('tri', 'à 1200 px : après un clic le titre « E-mail » ne dit pas qu\'il trie (flèche absente)');
      if (!ordered(snap.mails, 1)) note('tri', `à 1200 px : un clic sur « E-mail » ne trie pas en croissant (${snap.mails.join(' | ')})`);
      if (!snap.button.on || snap.focused !== 'sort:email') note('tri', `à 1200 px : après le clic le bouton est « ${snap.button.text} » (allumé : ${snap.button.on}) et le clavier sur « ${snap.focused} » (« sort:email » attendu)`);
      await click('[data-fk="sort:email"]');
      snap = await page.run(sortSnap);
      if (!ordered(snap.mails, -1)) note('tri', `à 1200 px : un second clic sur « E-mail » ne trie pas en décroissant (${snap.mails.join(' | ')})`);
      await click('[data-fk="sort:email"]');
      snap = await page.run(sortSnap);
      if (snap.names.join() !== start.join() || snap.head.some(cell => cell.sorted)) note('tri', 'à 1200 px : un troisième clic ne rend pas l\'ordre de l\'annuaire');
    }
    await page.view({ width, scale: 1, mode });
    await delay(150);
  }
  // Le bouton : « Poste » en croissant (Entrée), en décroissant (le second geste), puis « Ordre de l'annuaire ».
  await openPick(page, click, note, where);
  await click('[data-fk="pick-title"]');
  await delay(120);
  snap = await page.run(sortSnap);
  if (!snap.button.on) note('tri', `${where} : le bouton ne dit pas le tri choisi (« ${snap.button.text} »)`);
  if (!ordered(snap.subs, 1)) note('tri', `${where} : « Poste » ne trie pas en croissant (${snap.subs.join(' | ')})`);
  if (snap.focused !== 'sort-pick') note('clavier', `${where} : après le choix le clavier est sur « ${snap.focused} » (le bouton « Trier » attendu)`);
  await openPick(page, click, note, where);
  await click('[data-fk="pick-alt-title"]');
  await delay(120);
  snap = await page.run(sortSnap);
  if (!ordered(snap.subs, -1)) note('tri', `${where} : le second geste sur « Poste » ne trie pas en décroissant (${snap.subs.join(' | ')})`);
  if (!/décroissant|descending/.test(snap.button.label)) note('tri', `${where} : le bouton ne dit pas le sens (« ${snap.button.label} »)`);
  // Les cartes ont le même bouton.
  await click('[data-fk="v:cards"]');
  await delay(150);
  snap = await page.run(sortSnap);
  if (!snap.button || !snap.button.on) note('tri', `${where} : le tri ne suit pas dans la vue en cartes (« ${snap.button ? snap.button.text : 'pas de bouton'} »)`);
  await click('[data-fk="v:list"]');
  await openPick(page, click, note, where);
  await click('[data-fk="pick-__none"]');
  await delay(120);
  snap = await page.run(sortSnap);
  if (snap.names.join() !== start.join() || snap.button.on) note('tri', `${where} : « Ordre de l'annuaire » ne rend pas l'ordre par nom`);
}
