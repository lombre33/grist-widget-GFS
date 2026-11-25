// L'annuaire sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; module Annuaire, demande du porteur du 25/11). La vraie
// fenêtre (js/annuaire/annuaire-window.js), le vrai contrôle et la vraie lecture, sur un faux Grist en mémoire (test/pages/annuaire.js), à la vraie souris et au vrai clavier. À
// mesurer, en français et en anglais, en clair et en sombre, à 700, 520 et 400 px de large (400 px de haut : le panneau de référence est 700 × 400) : la fenêtre tient dans la page
// sans la faire défiler, son titre, sa recherche, ses boutons et son pied restent en place et se lisent, rien ne sort de son cadre ni ne défile de côté ; la liste (une ligne
// par personne : avatar rond de 32 px, nom, poste, niveau en pastille qui se coupe par « … » au lieu de déborder, le nom et l'adresse très longs d'une personne compris) ;
// la hiérarchie (déplier à la souris, choisir un nœud réduit la liste et le pied le dit) ; la fiche (un clic sur une ligne, la fiche prend la place de la hiérarchie quand la
// fenêtre est étroite, ses boutons « Copier » font 24 px au moins, « Fermer la fiche » rend la hiérarchie) ; la recherche au clavier (mots dans n'importe quel ordre) ; les filtres
// derrière leur bouton (la liste garde sa place, une pastille filtre et le bouton compte) ; les cartes de contact ; l'organigramme (les cartes tiennent, « Tout voir » les met toutes
// dans le cadre, le zoom, une carte ouvre la fiche de la structure, les responsables, le pli d'une branche) ; le choix d'un autre annuaire ; le réglage ; la langue changée
// fenêtre ouverte ; Tab qui reste dans la fenêtre et Échap qui la ferme ; le contraste des textes (4,5:1), clair et sombre.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { setupProblems, savedProblems } from './annuaire-setup-firefox.mjs';
import { relationsReadProblems } from './annuaire-relations-firefox.mjs';
import { pathPickerProblems } from './annuaire-path-firefox.mjs';
import { editProblems } from './annuaire-edit-firefox.mjs';
import { toolsProblems } from './annuaire-tools-firefox.mjs';
import { subProblems } from './annuaire-sub-firefox.mjs';
import { ficheSectionsProblems } from './annuaire-fiche-firefox.mjs';
import { listColumnsProblems, sortProblems, orgFiltersProblems } from './annuaire-columns-firefox.mjs';

const OTHER = { fr: 'en', en: 'fr' };
const LONG_NAME = 'Jean-Baptiste de la Rochefoucauld-Montmorency';
const FAMILY = 'annuaire';

// ---------- ce qui s'exécute dans la page ----------

// Ce que la fenêtre montre : les cadres, les contrôles, les lignes, les cartes, ce qui sort de son cadre.
function inspect() {
  const modal = document.querySelector('.mod.an');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const visible = node => node.getClientRects().length > 0;
  const q = selector => modal.querySelector(selector);
  const all = selector => [...modal.querySelectorAll(selector)].filter(visible);
  const panelNode = document.querySelector('.an-fpanel'); // le panneau des filtres est posé sur le voile, à côté de la fenêtre
  const named = node => `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/)[0]}` : ''} « ${text(node).slice(0, 40)} »`;
  // Ce qui dépasse le cadre qui le coupe (une bande qui défile ne coupe pas : elle montre le reste en défilant).
  const escapes = [];
  for (const node of modal.querySelectorAll('*')) {
    if (!visible(node) || node.closest('svg') !== null && node.tagName.toLowerCase() !== 'svg') continue;
    let frame = node.parentElement;
    while (frame && frame !== modal && getComputedStyle(frame).overflowX === 'visible') frame = frame.parentElement;
    if (!frame || ['auto', 'scroll'].includes(getComputedStyle(frame).overflowX)) continue;
    const inner = node.getBoundingClientRect();
    const outer = frame.getBoundingClientRect();
    if (inner.right > outer.right + 1 || inner.left < outer.left - 1) escapes.push(`${named(node)} sort de ${named(frame)} (${Math.round(inner.left)}–${Math.round(inner.right)} dans ${Math.round(outer.left)}–${Math.round(outer.right)})`);
  }
  const sideways = all('.an-card, .an-list, .an-fiche-card, .an-body, .an-grid, .mod-body').filter(node => node.scrollWidth - node.clientWidth > 1).map(node => `${named(node)} défile de côté (${node.scrollWidth} pour ${node.clientWidth})`);
  const control = node => ({ text: text(node), title: node.title || '', box: box(node), label: node.getAttribute('aria-label') || '', pressed: node.getAttribute('aria-pressed'), disabled: node.getAttribute('aria-disabled') === 'true' });
  const pane = selector => { const node = q(selector); return node && visible(node) ? box(node) : null; };
  const rowOf = node => {
    const avatar = node.querySelector('.an-av');
    const pill = node.querySelector('.an-pill');
    const name = node.querySelector('.an-pe-name');
    return { row: node.dataset.row, box: box(node), pressed: node.getAttribute('aria-pressed') === 'true', name: text(name), sub: node.querySelector('.an-pe-sub') ? text(node.querySelector('.an-pe-sub')) : '',
      av: avatar ? { box: box(avatar), radius: parseFloat(getComputedStyle(avatar).borderTopLeftRadius) } : null,
      pill: pill ? { box: box(pill), cut: pill.scrollWidth > pill.clientWidth + 1, ellipsis: getComputedStyle(pill).textOverflow === 'ellipsis', text: text(pill) } : null,
      nameCut: name.scrollWidth > name.clientWidth + 1, nameEllipsis: getComputedStyle(name).textOverflow === 'ellipsis', tabindex: node.getAttribute('tabindex') };
  };
  const fiche = q('.an-fiche-card');
  const org = q('.an-org');
  const scroll = org && visible(org) ? q('.an-org-scroll') : null;
  return {
    view: [document.documentElement.clientWidth, document.documentElement.clientHeight], docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    window: box(modal), head: box(q('.mod-head')), foot: box(q('.mod-foot')), body: box(q('.an-body')), title: text(q('h2')), titleCut: q('h2').scrollWidth > q('h2').clientWidth + 1,
    name: control(q('.an-name')), nameCut: q('.an-name-t').scrollWidth > q('.an-name-t').clientWidth + 1, search: { box: box(q('.an-search input')), value: q('.an-search input').value, placeholder: q('.an-search input').placeholder },
    views: all('.an-top > .an-seg .an-seg-b').map(control), config: control(q('.an-ib[data-act="configure"]')), close: control(q('[data-act="close"]')),
    foots: text(q('.an-foot')), tree: pane('.an-tree'), main: pane('.an-main'), side: pane('.an-side'), list: pane('.an-list'), crumb: q('.an-crumb') ? text(q('.an-crumb')) : '',
    view_: modal.querySelector('.an-body').dataset.view || null, sideShown: modal.querySelector('.an-body').dataset.side || null,
    nodes: all('.an-tn').map(node => ({ id: node.querySelector('.an-tb').dataset.id, name: text(node.querySelector('.an-tn-name')), count: text(node.querySelector('.an-pill')), expanded: node.getAttribute('aria-expanded'),
      selected: node.getAttribute('aria-selected') === 'true', box: box(node), toggle: node.querySelector('button.an-tt') ? box(node.querySelector('button.an-tt')) : null })),
    persons: all('.an-person').map(rowOf), cards: all('.an-pcard').map(rowOf), listBox: pane('.an-list'),
    filtersToggle: q('[data-fk="filters"]') ? control(q('[data-fk="filters"]')) : null,
    panel: panelNode && visible(panelNode) ? { box: box(panelNode), outer: box(panelNode.parentElement), scrolls: panelNode.scrollHeight > panelNode.clientHeight + 1,
      expanded: q('[data-fk="filters"]').getAttribute('aria-expanded'),
      heads: [...panelNode.querySelectorAll('.an-fsec-h')].map(head => ({ fk: head.dataset.fk, text: text(head), open: head.getAttribute('aria-expanded') === 'true', box: box(head) })),
      rows: [...panelNode.querySelectorAll('.an-fv')].map(row => ({ fk: row.dataset.fk, text: text(row), checked: row.getAttribute('aria-checked') === 'true', box: box(row),
        role: row.getAttribute('role'), cut: row.querySelector('.an-fv-t').scrollWidth > row.querySelector('.an-fv-t').clientWidth + 1 })) } : null,
    footReset: q('.an-reset') ? control(q('.an-reset')) : null,
    fiche: fiche ? { box: box(fiche), name: text(fiche.querySelector('h3')), nameCut: fiche.querySelector('h3').scrollWidth > fiche.querySelector('h3').clientWidth + 1,
      rows: [...fiche.querySelectorAll('.an-fr')].map(row => ({ label: text(row.querySelector('dt')), value: text(row.querySelector('dd')), box: box(row) })),
      copies: [...fiche.querySelectorAll('.an-copy')].map(button => ({ label: button.title, box: box(button) })), pills: [...fiche.querySelectorAll('.an-pill')].map(pill => ({ box: box(pill), text: text(pill) })) } : null,
    sideClose: q('[data-fk="side-x"]') && visible(q('[data-fk="side-x"]')) ? box(q('[data-fk="side-x"]')) : null,
    org: scroll ? { box: box(scroll), cards: all('.an-oc').map(card => ({ id: card.dataset.id, title: text(card.querySelector('.an-oc-title')), box: box(card), pressed: card.getAttribute('aria-pressed') === 'true',
      titleCut: card.querySelector('.an-oc-title').scrollWidth > card.querySelector('.an-oc-title').clientWidth + 1 })),
    folds: all('.an-fold').map(fold => ({ id: fold.dataset.id, text: text(fold), expanded: fold.getAttribute('aria-expanded'), box: box(fold) })), zoom: text(q('.an-zoom')),
    modes: all('.an-org-bar .an-seg-b').map(control), buttons: all('.an-zoombar .an-ib').map(control), scrollable: scroll.scrollWidth > scroll.clientWidth + 1 || scroll.scrollHeight > scroll.clientHeight + 1 } : null,
    state: q('.an-state') && visible(q('.an-state')) ? text(q('.an-state')) : null, focused: document.activeElement ? (document.activeElement.dataset.fk || document.activeElement.tagName) : null,
    inside: modal.contains(document.activeElement), escapes, sideways, scrims: document.querySelectorAll('.mod-scrim').length,
  };
}

// Le centre, en pixels de la page, d'un élément amené dans la fenêtre : le clic s'y fait à la vraie souris.
function centerOf(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// Les fenêtres posées au-dessus (la liste des annuaires, le réglage) : leur cadre, leurs boutons, ce qui sort de la page.
function topWindow() {
  const scrims = [...document.querySelectorAll('.mod-scrim')];
  const scrim = scrims[scrims.length - 1];
  const modal = scrim && scrim.querySelector('.mod:not(.an)');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = modal.querySelector('.mod-body');
  return { box: box(modal), view: [document.documentElement.clientWidth, document.documentElement.clientHeight], title: text(modal.querySelector('h2')), foot: modal.querySelector('.mod-foot') ? box(modal.querySelector('.mod-foot')) : null,
    body: body ? { ...box(body), scrolls: body.scrollHeight - body.clientHeight, sideways: body.scrollWidth - body.clientWidth } : null, rows: [...modal.querySelectorAll('button')].map(button => ({ text: text(button), fk: button.dataset.fk || null, box: box(button) })),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || document.activeElement.tagName : null, scrims: scrims.length };
}

// Les textes dont le contraste se mesure : [le texte, le fond sur lequel il se pose].
const PROBES = {
  title: ['.an-top h2', '.mod'], name: ['.an-name-t', '.an-name'], seg: ['.an-seg-b[aria-pressed="true"]', '.an-seg-b'], segOff: ['.an-seg-b[aria-pressed="false"]', '.an-seg'],
  personName: ['.an-person[aria-pressed="false"] .an-pe-name', '.an-card'], personSub: ['.an-person[aria-pressed="false"] .an-pe-sub', '.an-card'],
  pill: ['.an-person[aria-pressed="false"] .an-pill', '.an-card'], treeName: ['.an-tn[aria-selected="false"] .an-tn-name', '.an-card'], treeCount: ['.an-tn[aria-selected="false"] .an-pill', '.an-card'],
  treeOn: ['.an-tn[aria-selected="true"] .an-tn-name', '.an-tb'], rowOn: ['.an-person[aria-pressed="true"] .an-pe-name', '.an-person'], rowOnSub: ['.an-person[aria-pressed="true"] .an-pe-sub', '.an-person'],
  foot: ['.an-foot', '.mod'], crumb: ['.an-crumb', '.an-card'], cardName: ['.an-pcard[aria-pressed="false"] .an-pe-name', '.an-card'], cardLine: ['.an-pcard .an-pc-line', '.an-card'],
  ficheName: ['.an-fiche-id h3', '.an-card'], ficheSub: ['.an-fiche-id .an-pe-sub', '.an-card'], ficheLabel: ['.an-fr dt', '.an-card'], ficheValue: ['.an-fr dd', '.an-card'],
  ficheLink: ['.an-fiche-card .an-link', '.an-card'], fvRow: ['.an-fv[aria-checked="false"] .an-fv-t', '.menu-panel'], fvOn: ['.an-fv[aria-checked="true"] .an-fv-t', '.an-fv'], fvCount: ['.an-fv-n', '.menu-panel'],
  fsecHead: ['.an-fsec-h .an-fsec-t', '.menu-panel'], badge: ['.an-badge', '.an-badge'], reset: ['.an-reset', '.mod'], toolOn: ['.an-tbtn.is-on .an-tb-t', '.an-tbtn'],
  orgTitle: ['.an-oc[aria-pressed="false"] .an-oc-title', '.an-card'], orgSub: ['.an-oc[aria-pressed="false"] .an-oc-sub', '.an-card'], orgOn: ['.an-oc[aria-pressed="true"] .an-oc-title', '.an-oc'],
  zoom: ['.an-zoom', '.an-card'], note: ['.an-note', '.an-card'],
};

// ---------- les mesures ----------

const insideX = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack;
const inside = (inner, outer, slack = 0.6) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

// La fenêtre : dans la page, sans rien qui sorte de son cadre ni défile de côté ; son titre, sa recherche, ses boutons et son pied en place.
function frameProblems(snap, note, where, { wide }) {
  const [vw, vh] = snap.view;
  const w = snap.window;
  if (w.left < -0.5 || w.right > vw + 0.5 || w.top < -0.5 || w.bottom > vh + 0.5) note('hors de la page', `${where} : la fenêtre (${Math.round(w.left)}, ${Math.round(w.top)}, ${Math.round(w.right)}, ${Math.round(w.bottom)}) sort de la page de ${vw} × ${vh}`);
  if (snap.docOverflow > 0) note('la page défile', `${where} : la page déborde de ${snap.docOverflow} px de côté`);
  for (const text of snap.escapes) note('sort de son cadre', `${where} : ${text}`);
  for (const text of snap.sideways) note('défile de côté', `${where} : ${text}`);
  if (snap.titleCut) note('titre coupé', `${where} : le titre « ${snap.title} » est coupé`);
  if (!inside(snap.head, w) || !inside(snap.foot, w)) note('cadre', `${where} : le titre ou le pied sort de la fenêtre`);
  if (snap.foot.bottom > w.bottom + 0.5 || snap.head.top < w.top - 0.5) note('cadre', `${where} : le pied ou le titre n'est pas dans la fenêtre`);
  if (snap.body.height < (wide ? 190 : 150)) note('place', `${where} : le corps ne mesure que ${Math.round(snap.body.height)} px de haut (${wide ? 190 : 150} au moins)`);
  for (const button of [snap.config, snap.close, snap.name, ...snap.views]) {
    if (button.box.height < 24 || button.box.width < 24) note('cible trop petite', `${where} : « ${button.label || button.text || button.title} » mesure ${Math.round(button.box.width)} × ${Math.round(button.box.height)} (24 au moins)`);
    if (!inside(button.box, w)) note('bouton hors de la fenêtre', `${where} : « ${button.label || button.text} » sort de la fenêtre`);
  }
  if (snap.search.box.height < 24 || !inside(snap.search.box, w)) note('recherche', `${where} : la recherche mesure ${Math.round(snap.search.box.width)} × ${Math.round(snap.search.box.height)} ou sort de la fenêtre`);
  if (snap.search.box.width < 100) note('recherche', `${where} : la recherche ne mesure que ${Math.round(snap.search.box.width)} px de large (100 au moins)`);
}

// Les lignes de la liste : un avatar rond de 32 px, le nom, le poste, la pastille dans la ligne ; ce qui est trop long se coupe par « … ».
function rowProblems(rows, note, where) {
  if (!rows.length) { note('liste vide', `${where} : aucune ligne dans la liste`); return; }
  for (const row of rows) {
    if (row.box.height < 40) note('ligne basse', `${where} : la ligne de « ${row.name} » ne mesure que ${Math.round(row.box.height)} px (40 au moins, une cible à la souris)`);
    if (!row.av || Math.abs(row.av.box.width - 32) > 1 || Math.abs(row.av.box.height - 32) > 1 || row.av.radius < 15) note('avatar', `${where} : l'avatar de « ${row.name} » n'est pas un rond de 32 px (${row.av && Math.round(row.av.box.width)}, rayon ${row.av && row.av.radius})`);
    else if (!inside(row.av.box, row.box)) note('avatar', `${where} : l'avatar de « ${row.name} » sort de sa ligne`);
    if (row.pill && row.pill.box.width > 0) {
      if (!inside(row.pill.box, row.box)) note('pastille hors de la ligne', `${where} : la pastille « ${row.pill.text} » de « ${row.name} » sort de sa ligne`);
      if (row.pill.cut && !row.pill.ellipsis) note('pastille coupée', `${where} : la pastille « ${row.pill.text} » est coupée sans « … »`);
      if (row.pill.box.height < 18) note('pastille basse', `${where} : la pastille « ${row.pill.text} » ne mesure que ${Math.round(row.pill.box.height)} px`);
    } else if (!row.pill) note('pastille absente', `${where} : « ${row.name} » n'a pas son niveau en pastille`);
    if (row.nameCut && !row.nameEllipsis) note('nom coupé', `${where} : le nom « ${row.name} » est coupé sans « … »`);
  }
  const tabStops = rows.filter(row => row.tabindex === '0').length;
  if (tabStops !== 1) note('clavier', `${where} : ${tabStops} lignes sont des arrêts de Tab (une seule attendue)`);
}

// Le contraste des textes de l'écran où l'on est, sous 4,5:1 : noté.
async function contrastProblems(page, note, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// Ouvre l'annuaire et attend la liste.
async function openWindow(page) {
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.mod.an .an-person') !== null);
  return page.run(inspect);
}

// La page doit être chargée (test/pages/annuaire.js) et réglée par `page.view` : `{ width, mode }` ne sert qu'à dire où l'on est.
export async function annuaireProblems(page, language, tag, { width, mode }) {
  const found = [];
  const run = new Run(page, tag, found, FAMILY);
  const t = createI18n(language).t;
  const other = createI18n(OTHER[language]).t;
  const note = (kind, text) => run.note(kind, text);
  const wide = width >= 600;
  const inspectNow = () => page.run(inspect);
  const click = async selector => { const at = await page.run(centerOf, selector); if (!at) { note('introuvable', `${selector} n'est pas dans la page`); return false; } await page.click(...at); await delay(80); return true; };
  try {
    const start = await openWindow(page).catch(() => null);
    if (!start) { note('ne s\'ouvre pas', 'la fenêtre ne montre aucune personne'); return found; }
    await opening(page, t, note, start, { width, wide });
    await contrastProblems(page, note, `la liste (${mode})`);
    await treeProblems(page, t, note, click, { wide });
    await ficheProblems(page, t, note, click, { wide });
    await searchProblems(page, t, note, click, inspectNow);
    await listColumnsProblems(page, t, note, click, { width, mode });
    await sortProblems(page, t, note, click, { width, mode });
    await filtersProblems(page, t, note, click, inspectNow, { wide });
    await cardsProblems(page, t, note, click, inspectNow, { wide });
    await orgProblems(page, t, note, click, inspectNow, { wide, mode, width });
    await orgFiltersProblems(page, t, note, click, inspectNow, async label => frameProblems(await inspectNow(), note, label, { wide }));
    await ficheSectionsProblems(page, t, note, click);
    await relationsReadProblems(page, t, note, click);
    await switchProblems(page, t, note, click, { wide });
    await settingsProblems(page, t, note, click, { wide, width, mode });
    if (wide) await savedProblems(page, t, note, click);
    await languageProblems(page, language, t, other, note, inspectNow);
    await keyboardProblems(page, t, note, inspectNow);
    await editProblems(page, t, note, click, { width, mode }); // il écrit dans le faux Grist : en dernier
    await subProblems(page, t, note, click, { width, mode, language }); // il recharge la page (`?sub=1`) et écrit dans le faux Grist
    await toolsProblems(page, t, note, click, { width, mode, language }); // il recharge la page (`?tools=1`) : tout dernier
    const said = await page.run(() => window.__annuaireNotices);
    if (said.length) note('phrase inattendue', `l'annuaire a dit : ${said.join(' | ')}`);
  } catch (error) {
    note('essai interrompu', String(error && error.stack || error).slice(0, 400));
  } finally {
    await page.run(() => { if (window.__annuaire && window.__annuaire.isOpen) window.__annuaire.close(); document.querySelectorAll('.mod-scrim').forEach(scrim => scrim.remove()); });
  }
  return found;
}

// ---------- chaque écran ----------

// La fenêtre ouverte : le cadre, les contrôles, les lignes, la recherche qui a le clavier, le pied.
async function opening(page, t, note, snap, { width, wide }) {
  const where = `la fenêtre ouverte à ${width} px`;
  frameProblems(snap, note, where, { wide });
  if (snap.title !== t('an.title')) note('titre', `${where} : le titre dit « ${snap.title} » (« ${t('an.title')} » attendu)`);
  if (snap.name.text !== 'Annuaire principal') note('annuaire', `${where} : l'annuaire montré est « ${snap.name.text} » (« Annuaire principal » attendu)`);
  if (snap.focused !== 'search') note('clavier', `${where} : le clavier est sur « ${snap.focused} », la recherche l'attend`);
  if (snap.persons.length !== 7) note('liste', `${where} : ${snap.persons.length} lignes (7 personnes attendues)`);
  rowProblems(snap.persons, note, where);
  if (snap.foots !== t('an.foot.all', { n: 7 })) note('pied', `${where} : le pied dit « ${snap.foots} » (« ${t('an.foot.all', { n: 7 })} » attendu)`);
  if (snap.views.length !== 3) note('affichages', `${where} : ${snap.views.length} affichages (3 attendus : liste, cartes, organigramme)`);
  const pressed = snap.views.filter(view => view.pressed === 'true');
  if (pressed.length !== 1 || !pressed[0].text) note('affichages', `${where} : l'affichage choisi ne dit pas son nom (${JSON.stringify(snap.views.map(view => [view.text, view.pressed]))})`);
  if (snap.main && snap.list && snap.list.height < 100) note('place', `${where} : la liste ne mesure que ${Math.round(snap.list.height)} px de haut`);
  if (wide && !snap.tree) note('hiérarchie', `${where} : la hiérarchie n'est pas montrée`);
  const names = snap.persons.map(row => row.name);
  if (!names.includes(LONG_NAME)) note('liste', `${where} : la personne au nom très long manque (${names.join(', ')})`);
}

// La hiérarchie : déplier à la souris, choisir un nœud réduit la liste.
async function treeProblems(page, t, note, click, { wide }) {
  const where = 'la hiérarchie';
  let snap = await page.run(inspect);
  if (!snap.tree) {
    if (wide) note('hiérarchie', `${where} : absente`);
    return;
  }
  const root = snap.nodes[0];
  if (!root || root.count !== '7') note('hiérarchie', `${where} : la racine ne dit pas 7 personnes (${JSON.stringify(root)})`);
  const folded = snap.nodes.find(node => node.expanded === 'false');
  if (!folded) { note('hiérarchie', `${where} : aucun nœud à déplier`); return; }
  if (folded.toggle && (folded.toggle.width < 20 || folded.toggle.height < 20)) note('cible trop petite', `${where} : la flèche de « ${folded.name} » mesure ${Math.round(folded.toggle.width)} × ${Math.round(folded.toggle.height)}`);
  const before = snap.nodes.length;
  await click(`[data-act="tree-toggle"][data-id="${folded.id}"]`);
  snap = await page.run(inspect);
  if (snap.nodes.length <= before) note('hiérarchie', `${where} : un clic sur la flèche de « ${folded.name} » ne la déplie pas (${before} → ${snap.nodes.length} lignes)`);
  const target = snap.nodes.find(node => node.name === folded.name);
  if (target && target.expanded !== 'true') note('hiérarchie', `${where} : « ${folded.name} » ne se dit pas déplié (aria-expanded ${target.expanded})`);
  for (const node of snap.nodes) if (!insideX(node.box, snap.tree)) note('hiérarchie', `${where} : la ligne « ${node.name} » sort du volet`);
  await click(`[data-act="tree-pick"][data-id="${folded.id}"]`);
  snap = await page.run(inspect);
  const picked = snap.nodes.find(node => node.id === folded.id);
  if (!picked || !picked.selected) note('hiérarchie', `${where} : « ${folded.name} » ne se dit pas choisi après un clic`);
  const count = Number(folded.count);
  if (snap.persons.length !== count) note('hiérarchie', `${where} : choisir « ${folded.name} » (${count} personnes) laisse ${snap.persons.length} lignes`);
  if (!snap.foots.includes(String(count))) note('pied', `${where} : le pied « ${snap.foots} » ne dit pas ${count}`);
  if (!snap.crumb.includes(folded.name)) note('fil', `${where} : le fil d'Ariane « ${snap.crumb} » ne dit pas « ${folded.name} »`);
  await click('[data-act="tree-pick"][data-id=""]');
  snap = await page.run(inspect);
  if (snap.persons.length !== 7) note('hiérarchie', `${where} : la racine ne rend pas les 7 personnes (${snap.persons.length})`);
}

// La fiche : un clic sur une ligne, la fiche à droite (elle prend la place de la hiérarchie quand c'est étroit, et toute la place sous 540 px), ses boutons, « Fermer la fiche » qui
// rend le clavier à la ligne.
async function ficheProblems(page, t, note, click, { wide }) {
  for (const [label, name] of [['une personne', 'Camille Durand'], ['la personne au nom très long', LONG_NAME]]) {
    const row = await page.run(snapshotRow, name);
    if (!row) { note('introuvable', `la liste ne montre pas « ${name} »`); continue; }
    await click(`[data-act="person"][data-row="${row}"]`);
    const snap = await page.run(inspect);
    const where = `la fiche de ${label}`;
    if (!snap.fiche) { note('fiche', `${where} : aucune fiche après un clic sur « ${name} »`); continue; }
    frameProblems(snap, note, where, { wide });
    if (!snap.side || snap.side.width < 190) note('fiche', `${where} : le volet de la fiche mesure ${snap.side ? Math.round(snap.side.width) : 0} px (190 au moins)`);
    if (snap.fiche.name !== name) note('fiche', `${where} : la fiche dit « ${snap.fiche.name} » (« ${name} » attendu)`);
    if (snap.fiche.nameCut) note('nom coupé', `${where} : le nom est coupé dans la fiche`);
    if (!insideX(snap.fiche.box, snap.side)) note('fiche', `${where} : la fiche sort de son volet`);
    const mail = snap.fiche.rows.find(each => each.label === t('an.mail'));
    if (!mail) note('fiche', `${where} : pas de ligne « ${t('an.mail')} »`);
    for (const copy of snap.fiche.copies) if (copy.box.width < 24 || copy.box.height < 24) note('cible trop petite', `${where} : « ${copy.label} » mesure ${Math.round(copy.box.width)} × ${Math.round(copy.box.height)} (24 au moins)`);
    for (const each of snap.fiche.rows) if (!insideX(each.box, snap.fiche.box)) note('fiche', `${where} : la ligne « ${each.label} » sort de la fiche`);
    // Sous 540 px la fiche recouvre la liste : la ligne choisie ne se voit qu'à côté d'elle.
    if (snap.main && !snap.persons.some(each => each.pressed)) note('fiche', `${where} : la ligne choisie ne se dit pas choisie`);
    if (!snap.main && snap.persons.length) note('fiche', `${where} : la liste recouverte reste à l'écran`);
    if (!snap.sideClose || snap.sideClose.width < 24) note('fiche', `${where} : « ${t('an.fiche.close')} » manque ou mesure moins de 24 px`);
    if (label === 'une personne') await contrastProblems(page, note, where);
    await click('[data-fk="side-x"]');
    const after = await page.run(inspect);
    if (after.fiche) note('fiche', `${where} : la fiche reste après « ${t('an.fiche.close')} »`);
    if (wide && !after.tree) note('hiérarchie', `${where} : la hiérarchie ne revient pas à la fermeture de la fiche`);
    if (after.focused !== `pe:${row}`) note('clavier', `${where} : après « ${t('an.fiche.close')} » le clavier est sur « ${after.focused} » (« pe:${row} », la ligne de la fiche, attendu)`);
    if (after.persons.length !== 7) note('liste', `${where} : la liste rendue montre ${after.persons.length} lignes (7 attendues)`);
  }
}

// La recherche au clavier : des mots dans n'importe quel ordre ; les effacer rend la liste.
async function searchProblems(page, t, note, click, inspectNow) {
  await click('.an-search input');
  await page.press('d', 'u', 'r', 'a', 'n', 'd');
  await delay(120);
  let snap = await inspectNow();
  if (snap.persons.length !== 1 || snap.persons[0].name !== 'Camille Durand') note('recherche', `« durand » trouve ${JSON.stringify(snap.persons.map(row => row.name))} (« Camille Durand » seule attendue)`);
  if (!snap.foots.includes('1')) note('pied', `la recherche « durand » : le pied dit « ${snap.foots} »`);
  for (let i = 0; i < 6; i++) await page.press('Backspace');
  await page.press('c', 'a', 'm', 'i', 'l', 'l', 'e', ' ', 'd', 'u');
  await delay(120);
  snap = await inspectNow();
  if (snap.persons.length !== 1) note('recherche', `« camille du » trouve ${snap.persons.length} personnes (une seule attendue : le début d'un mot suffit)`);
  for (let i = 0; i < 10; i++) await page.press('Backspace');
  await page.press('z', 'z', 'z');
  await delay(120);
  snap = await inspectNow();
  if (snap.persons.length !== 0) note('recherche', `« zzz » trouve ${snap.persons.length} personnes`);
  if (!snap.main || !(await page.run(() => /\S/.test(document.querySelector('.an-list').textContent)))) note('recherche', 'sans résultat, la liste ne dit rien');
  frameProblems(snap, note, 'la recherche sans résultat', { wide: true });
  for (let i = 0; i < 3; i++) await page.press('Backspace');
  await delay(120);
  snap = await inspectNow();
  if (snap.persons.length !== 7) note('recherche', `la recherche effacée laisse ${snap.persons.length} lignes (7 attendues)`);
}

// Le bouton « Filtres » et son panneau (retour du porteur, 25/11 : comme la maquette de l'annuaire) : le bouton est une cible de 24 px qui compte les choix, le panneau se pose
// sous lui dans la fenêtre sans rien déplacer, les deux premiers filtres sont dépliés, une case filtre sans fermer le panneau, le pied dit les valeurs choisies et
// « Réinitialiser » les retire, Échap ferme le panneau et rend le clavier au bouton, un second clic sur le bouton le range.
async function filtersProblems(page, t, note, click, inspectNow, { wide }) {
  const before = await inspectNow();
  if (!before.filtersToggle) { note('filtres', 'le bouton des filtres manque'); return; }
  if (before.filtersToggle.box.height < 24) note('cible trop petite', `le bouton « ${before.filtersToggle.text} » mesure ${Math.round(before.filtersToggle.box.height)} px de haut`);
  if (before.panel) note('filtres', 'le panneau des filtres est ouvert avant tout clic');
  const closedList = before.list ? before.list.height : 0;
  await click('[data-fk="filters"]');
  let snap = await inspectNow();
  const where = 'le panneau des filtres';
  if (!snap.panel) { note('filtres', `${where} : un clic sur le bouton ne l'ouvre pas`); return; }
  frameProblems(snap, note, where, { wide });
  if (snap.list && Math.abs(snap.list.height - closedList) > 1) note('place', `${where} : la liste passe de ${Math.round(closedList)} à ${Math.round(snap.list.height)} px de haut (le panneau flotte, il ne pousse rien)`);
  if (!inside(snap.panel.box, snap.window)) note('filtres', `${where} : le panneau sort de la fenêtre`);
  if (snap.panel.box.top < snap.filtersToggle.box.bottom - 1) note('filtres', `${where} : le panneau n'est pas sous le bouton (haut ${Math.round(snap.panel.box.top)}, bas du bouton ${Math.round(snap.filtersToggle.box.bottom)})`);
  if (snap.panel.expanded !== 'true') note('filtres', `${where} : le bouton ne dit pas qu'il est ouvert (aria-expanded « ${snap.panel.expanded} »)`);
  if (!snap.focused || !/^f[ls]:/.test(snap.focused)) note('clavier', `${where} : le clavier est sur « ${snap.focused} » à l'ouverture (une case du panneau attendue)`);
  if (snap.panel.heads.length < 2) note('filtres', `${where} : ${snap.panel.heads.length} filtre(s) seulement`);
  if (!snap.panel.heads.slice(0, 2).every(head => head.open)) note('filtres', `${where} : les deux premiers filtres ne sont pas dépliés`);
  for (const row of snap.panel.rows) {
    if (row.box.height < 24) note('cible trop petite', `${where} : la ligne « ${row.text} » mesure ${Math.round(row.box.height)} px de haut`);
    if (!insideX(row.box, snap.panel.box)) note('filtres', `${where} : la ligne « ${row.text} » sort du panneau`);
    if (row.role !== 'checkbox') note('accessibilité', `${where} : la ligne « ${row.text} » n'a pas le rôle de case à cocher`);
  }
  await contrastProblems(page, note, where);
  await click('[data-fk="fs:Contrat"]');
  snap = await inspectNow();
  const row = snap.panel && snap.panel.rows.find(each => each.fk === 'fl:Contrat:Contractuelle');
  if (!row) { note('filtres', `${where} : la case « Contractuelle » manque après avoir déplié « Contrat » (${snap.panel ? snap.panel.rows.map(each => each.text).join(' | ') : 'panneau fermé'})`); return; }
  await click(`[data-fk="${row.fk}"]`);
  snap = await inspectNow();
  const now = snap.panel && snap.panel.rows.find(each => each.fk === row.fk);
  if (!snap.panel) note('filtres', `${where} : le panneau se ferme à une case cochée (il doit rester ouvert pour en cocher plusieurs)`);
  if (!now || !now.checked) note('filtres', `${where} : la case « Contractuelle » ne se dit pas cochée`);
  if (snap.persons.length !== 1) note('filtres', `${where} : « Contractuelle » laisse ${snap.persons.length} lignes (1 attendue)`);
  if (!snap.filtersToggle.text.includes('1')) note('filtres', `${where} : le bouton ne compte pas le choix (« ${snap.filtersToggle.text} »)`);
  if (!snap.foots.includes('Contractuelle') || !snap.footReset) note('pied', `${where} : le pied dit « ${snap.foots} » (les valeurs choisies et « Réinitialiser » attendus)`);
  if (snap.focused !== row.fk) note('clavier', `${where} : après la case, le clavier est sur « ${snap.focused} » (« ${row.fk} » attendu)`);
  await contrastProblems(page, note, `${where}, une case cochée`);
  await click(`[data-fk="${row.fk}"]`);
  snap = await inspectNow();
  if (snap.persons.length !== 7) note('filtres', `${where} : la case relâchée laisse ${snap.persons.length} lignes (7 attendues)`);
  await click(`[data-fk="${row.fk}"]`);
  await click('[data-fk="filters-reset"]');
  snap = await inspectNow();
  if (snap.persons.length !== 7 || snap.footReset) note('filtres', `${where} : « Réinitialiser » laisse ${snap.persons.length} lignes et ${snap.footReset ? 'son bouton' : 'plus de bouton'} (7 lignes, plus de bouton attendus)`);
  // Un clic ailleurs (« Réinitialiser », dans le pied) range le panneau ; on le rouvre pour essayer Échap.
  if (snap.panel) note('filtres', `${where} : un clic dans le pied ne range pas le panneau`);
  await click('[data-fk="filters"]');
  await page.press('Escape');
  snap = await inspectNow().catch(() => null);
  if (!snap) { note('filtres', 'Échap ferme la fenêtre au lieu du panneau'); return; }
  if (snap.panel) note('filtres', 'Échap ne ferme pas le panneau');
  if (snap.focused !== 'filters') note('clavier', `après Échap le clavier est sur « ${snap.focused} » (le bouton des filtres attendu)`);
  await click('[data-fk="filters"]');
  await click('[data-fk="filters"]');
  snap = await inspectNow();
  if (snap.panel) note('filtres', 'un second clic sur le bouton ne range pas le panneau');
}

// Les cartes de contact : au moins deux colonnes à 700 px, dans le volet, une carte choisie ouvre la fiche.
async function cardsProblems(page, t, note, click, inspectNow, { wide }) {
  await click('[data-fk="v:cards"]');
  let snap = await inspectNow();
  const where = 'les cartes';
  if (snap.cards.length !== 7) { note('cartes', `${where} : ${snap.cards.length} cartes (7 attendues)`); return; }
  frameProblems(snap, note, where, { wide });
  const columns = new Set(snap.cards.map(card => Math.round(card.box.left))).size;
  if (wide && columns < 2) note('cartes', `${where} : ${columns} colonne (2 au moins à ${snap.view[0]} px)`);
  for (const card of snap.cards) {
    if (card.box.width < 140) note('cartes', `${where} : la carte de « ${card.name} » ne mesure que ${Math.round(card.box.width)} px de large (140 au moins)`);
    if (card.nameCut && !card.nameEllipsis) note('nom coupé', `${where} : le nom « ${card.name} » est coupé sans « … »`);
    if (card.pill && card.pill.box.width > 0 && !inside(card.pill.box, card.box)) note('pastille hors de la ligne', `${where} : la pastille de « ${card.name} » sort de sa carte`);
  }
  await contrastProblems(page, note, where);
  await click(`[data-act="person"][data-row="${snap.cards[0].row}"]`);
  snap = await inspectNow();
  if (!snap.fiche) note('fiche', `${where} : un clic sur une carte n'ouvre pas la fiche`);
  if (snap.main && !snap.cards.some(card => card.pressed)) note('cartes', `${where} : la carte choisie ne se dit pas choisie`);
  await click('[data-fk="side-x"]');
  await click('[data-fk="v:list"]');
  snap = await inspectNow();
  if (snap.persons.length !== 7) note('liste', `la liste revenue montre ${snap.persons.length} lignes (7 attendues)`);
}

// L'organigramme : les cartes, « Tout voir », le zoom, la carte qui ouvre la fiche, les responsables, le pli d'une branche.
async function orgProblems(page, t, note, click, inspectNow, { wide, mode, width }) {
  await click('[data-fk="v:org"]');
  await delay(150);
  let snap = await inspectNow();
  const where = `l'organigramme (${mode}, ${width} px)`;
  if (!snap.org) { note('organigramme', `${where} : ne s'affiche pas`); return; }
  frameProblems(snap, note, where, { wide });
  if (!snap.org.cards.length) { note('organigramme', `${where} : aucune carte`); return; }
  if (snap.org.box.height < 100) note('place', `${where} : le cadre de l'organigramme ne mesure que ${Math.round(snap.org.box.height)} px de haut`);
  for (const button of [...snap.org.buttons, ...snap.org.modes]) if (button.box.height < 24 || button.box.width < 24) note('cible trop petite', `${where} : « ${button.label || button.text} » mesure ${Math.round(button.box.width)} × ${Math.round(button.box.height)}`);
  const first = snap.org.cards[0];
  if (first.box.width < 120 || first.box.height < 40) note('organigramme', `${where} : la carte « ${first.title} » mesure ${Math.round(first.box.width)} × ${Math.round(first.box.height)} (illisible)`);
  await contrastProblems(page, note, where);
  await click('[data-fk="org-fit"]');
  await delay(150);
  snap = await inspectNow();
  const outside = snap.org.cards.filter(card => !inside(card.box, snap.org.box, 2));
  if (outside.length) note('organigramme', `${where} : « Tout voir » laisse ${outside.length} carte(s) hors du cadre (${outside.map(card => card.title).slice(0, 3).join(', ')})`);
  const fitted = snap.org.zoom;
  await click('[data-fk="org-in"]');
  snap = await inspectNow();
  if (snap.org.zoom === fitted) note('organigramme', `${where} : le zoom n'avance pas (« ${fitted} »)`);
  await click('[data-fk="org-fit"]');
  const card = snap.org.cards.find(each => each.title.includes('Direction')) || snap.org.cards[0];
  await click(`[data-fk="oc:${card.id}"]`);
  snap = await inspectNow();
  if (!snap.fiche) note('organigramme', `${where} : un clic sur la carte « ${card.title} » n'ouvre aucune fiche`);
  else frameProblems(snap, note, `${where}, fiche`, { wide });
  if (snap.org && !snap.org.cards.some(each => each.pressed)) note('organigramme', `${where} : la carte choisie ne se dit pas choisie`);
  await click('[data-fk="side-x"]');
  snap = await inspectNow();
  if (snap.fiche || !snap.org) note('organigramme', `${where} : « Fermer la fiche » ne rend pas l'organigramme`);
  else if (snap.focused !== `oc:${card.id}`) note('clavier', `${where} : après « Fermer la fiche » le clavier est sur « ${snap.focused} » (« oc:${card.id} » attendu)`);
  const fold = snap.org && snap.org.folds.find(each => each.expanded === 'true');
  if (fold) {
    const count = snap.org.cards.length;
    await click(`[data-fk="of:${fold.id}"]`);
    snap = await inspectNow();
    if (snap.org.cards.length >= count) note('organigramme', `${where} : replier une branche ne retire aucune carte (${count} → ${snap.org.cards.length})`);
    await click(`[data-fk="of:${fold.id}"]`);
  }
  await click('[data-fk="om:managers"]');
  snap = await inspectNow();
  if (!snap.org || !snap.org.cards.length) note('organigramme', `${where} : l'organigramme des responsables est vide`);
  else {
    if (!snap.org.cards.some(each => each.title === 'Emma Rolland')) note('organigramme', `${where} : « Emma Rolland », sans responsable, n'est pas en tête (${snap.org.cards.map(each => each.title).join(', ')})`);
    frameProblems(snap, note, `${where}, responsables`, { wide });
  }
  await click('[data-fk="v:list"]');
}

// Choisir un autre annuaire : la liste des annuaires, puis le nom du second dans l'en-tête.
async function switchProblems(page, t, note, click, { wide }) {
  await click('[data-fk="switch"]');
  const open = await page.until(topWindow).catch(() => null);
  const where = 'le choix d\'un annuaire';
  if (!open) { note('annuaires', `${where} : la liste ne s'ouvre pas`); return; }
  if (!inside(open.box, { left: 0, top: 0, right: open.view[0], bottom: open.view[1] })) note('hors de la page', `${where} : la liste sort de la page`);
  const names = open.rows.map(row => row.text);
  if (!names.some(text => text.includes('Annuaire des directions'))) { note('annuaires', `${where} : « Annuaire des directions » manque (${names.join(' | ')})`); await page.press('Escape'); return; }
  if (!names.some(text => text.includes(t('an.new')))) note('annuaires', `${where} : « ${t('an.new')} » manque`);
  const second = open.rows.find(row => row.text.includes('Annuaire des directions'));
  await page.click(second.box.left + second.box.width / 2, second.box.top + second.box.height / 2);
  await delay(200);
  const snap = await page.run(inspect);
  if (snap.name.text !== 'Annuaire des directions') note('annuaires', `${where} : l'en-tête dit « ${snap.name.text} » après le choix (« Annuaire des directions » attendu)`);
  frameProblems(snap, note, `${where}, l'autre annuaire`, { wide });
  await click('[data-fk="switch"]');
  const again = await page.until(topWindow).catch(() => null);
  const first = again && again.rows.find(row => row.text.includes('Annuaire principal'));
  if (first) { await page.click(first.box.left + first.box.width / 2, first.box.top + first.box.height / 2); await delay(200); } else await page.press('Escape');
  if ((await page.run(inspect)).name.text !== 'Annuaire principal') note('annuaires', `${where} : l'annuaire principal ne revient pas`);
}

// Le réglage : la fenêtre tient dans la page, ses boutons sont en place, « Annuler » la ferme sans rien écrire.
async function settingsProblems(page, t, note, click, { wide, width, mode }) {
  const written = await page.run(() => window.__annuaireNotices.length);
  await click('[data-fk="configure"]');
  const open = await page.until(topWindow).catch(() => null);
  const where = 'le réglage de l\'annuaire';
  if (!open) { note('réglage', `${where} : la fenêtre ne s'ouvre pas`); return; }
  const page_ = { left: 0, top: 0, right: open.view[0], bottom: open.view[1] };
  if (!inside(open.box, page_)) note('hors de la page', `${where} : la fenêtre sort de la page (${Math.round(open.box.left)}, ${Math.round(open.box.top)}, ${Math.round(open.box.right)}, ${Math.round(open.box.bottom)})`);
  if (open.foot && !inside(open.foot, page_)) note('réglage', `${where} : le pied avec ses boutons sort de la page`);
  if (open.body && open.body.sideways > 1) note('défile de côté', `${where} : le corps défile de côté (${open.body.sideways} px)`);
  for (const fk of ['set-save', 'set-cancel']) {
    const button = open.rows.find(row => row.fk === fk);
    if (!button) note('réglage', `${where} : le bouton ${fk} manque`);
    else if (button.box.height < 24 || !inside(button.box, page_)) note('réglage', `${where} : le bouton « ${button.text} » sort de la page ou mesure ${Math.round(button.box.height)} px`);
  }
  await contrastProblems(page, note, where);
  await setupProblems(page, t, note, { wide, width, mode });
  await pathPickerProblems(page, t, note, { wide, width, mode });
  await click('[data-fk="set-cancel"]');
  await delay(150);
  if (await page.run(topWindow)) note('réglage', `${where} : « Annuler » ne ferme pas la fenêtre`);
  if ((await page.run(() => window.__annuaireNotices.length)) !== written) note('réglage', `${where} : annuler a dit une phrase`);
  if (!(await page.run(inspect))) note('réglage', `${where} : annuler a fermé l'annuaire aussi`);
}

// La langue changée fenêtre ouverte : tous les textes de la fenêtre passent à l'autre langue ; puis on revient.
async function languageProblems(page, language, t, other, note, inspectNow) {
  await page.run(lang => window.__annuaireLanguage(lang), OTHER[language]);
  await delay(100);
  let snap = await inspectNow();
  if (snap.title !== other('an.title')) note('langue', `la langue changée fenêtre ouverte : le titre dit « ${snap.title} » (« ${other('an.title')} » attendu)`);
  if (snap.close.text !== other('an.close')) note('langue', `la langue changée fenêtre ouverte : le bouton dit « ${snap.close.text} » (« ${other('an.close')} » attendu)`);
  if (snap.search.placeholder !== other('an.search')) note('langue', `la langue changée fenêtre ouverte : la recherche dit « ${snap.search.placeholder} »`);
  await page.run(lang => window.__annuaireLanguage(lang), language);
  await delay(100);
  snap = await inspectNow();
  if (snap.title !== t('an.title')) note('langue', `la langue rendue : le titre dit « ${snap.title} » (« ${t('an.title')} » attendu)`);
}
// Tab reste dans la fenêtre ; Échap la ferme.
async function keyboardProblems(page, t, note, inspectNow) {
  const where = 'le clavier';
  const seen = new Set();
  for (let step = 0; step < 40; step++) {
    await page.press('Tab');
    const snap = await inspectNow();
    if (!snap) { note('clavier', `${where} : la fenêtre disparaît à la ${step + 1}e touche Tab`); return; }
    seen.add(snap.focused);
    if (!snap.inside) { note('clavier', `${where} : après ${step + 1} Tab, le clavier est hors de la fenêtre (« ${snap.focused} »)`); break; }
  }
  if (seen.size < 6) note('clavier', `${where} : Tab ne passe que par ${seen.size} éléments (${[...seen].join(', ')})`);
  await page.press('Escape');
  await delay(150);
  if (await page.run(inspect)) note('clavier', `${where} : Échap ne ferme pas la fenêtre`);
}

// La ligne (le numéro de ligne de la table) de la personne `name`, ou null.
function snapshotRow(name) {
  const row = [...document.querySelectorAll('.an-person')].find(node => node.querySelector('.an-pe-name').textContent === name);
  return row ? row.dataset.row : null;
}
