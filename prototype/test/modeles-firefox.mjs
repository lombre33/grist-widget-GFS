// « Nouveau > Depuis un modèle » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; décision du porteur du 18/11 : « Une galerie
// commune »). La vraie fenêtre (js/apps/templates-window.js), le vrai contrôle et les vraies `Entries` sur les quatre manifestes de GFS et les vrais catalogues de modèles de Publipostage+ (22), Form+ (5) et Grist-BI (3) :
// leurs vignettes (`window.__templates`, test/pages/explorateur.js), à 700 × 400, à la vraie souris et au vrai clavier. À mesurer : l'article « Depuis un modèle… » du menu « Nouveau » (entre
// « Nouveau dossier » et « Importer », 28 px, rien de coupé, un clic le demande à l'explorateur) ; la fenêtre (dans la page, titre et nombre, recherche au clavier, pastilles par app dont les apps sans
// modèle grisées « bientôt », cinq colonnes de cartes, des vignettes qui se chargent, rien qui déborde, le pied qui reste en place quand les cartes défilent) ; la recherche (mots dans n'importe quel
// ordre, aucun résultat) ; les pastilles (filtrer, revenir, une pastille grisée dit pourquoi) ; « Créer » (un clic sur une carte la choisit, « Créer » rend le modèle au contrôleur et ferme la fenêtre ;
// flèches et Entrée ; Échap ferme sans rien créer) ; le grisé (une app qui ne sait pas encore ouvrir un modèle : cartes en pointillé, raison dans le pied, « Créer » éteint ; une extension éteinte :
// « Voir dans Apps » ouvre la ligne et la galerie revient avec la recherche et le choix ; l'app absente) ; un catalogue illisible (la pastille le dit) ; le changement de langue fenêtre ouverte ; la
// fenêtre étroite (520 et 400 px : rien ne déborde, moins de colonnes) ; le contraste des textes, clair et sombre.
import { createI18n } from '../js/i18n/i18n.js';
import { readJson } from './helpers.mjs';
import { Run } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const CATALOGUE = readJson('modeles/publipostage/modeles.json');
// Les trois apps qui livrent un catalogue (le 18/11 : Publipostage+, Form+, Grist-BI) ; Automation+ n'en a pas encore, sa pastille reste grisée « bientôt ».
const FORM = readJson('modeles/form/modeles.json').length;
const BI = readJson('modeles/bi/modeles.json').length;
const TOTAL = CATALOGUE.length + FORM + BI;
const OTHER = { fr: 'en', en: 'fr' };
const SEARCH = { fr: 'mouvement stock', en: 'movement stock' }; // un seul modèle : « Bon de mouvement de stock » / « Stock movement slip »

// Ce que la fenêtre montre : la fenêtre, les pastilles, les cartes (place, nom, type, état, vignette), le pied, le clavier.
function gallery() {
  const modal = document.querySelector('.mod.tp');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = modal.querySelector('.mod-body');
  const bodyBox = box(body);
  const title = modal.querySelector('h2');
  const see = modal.querySelector('[data-act="see"]');
  const create = modal.querySelector('[data-act="create"]');
  const cards = [...modal.querySelectorAll('.tp-card')].map(card => {
    const image = card.querySelector('.tp-img');
    const frame = box(card);
    return { key: card.dataset.key, name: text(card.querySelector('.tp-name')), type: text(card.querySelector('.tp-type')), app: text(card.querySelector('.tp-app')),
      pressed: card.getAttribute('aria-pressed') === 'true', disabled: card.getAttribute('aria-disabled') === 'true', tabindex: card.getAttribute('tabindex'), box: frame,
      overflow: card.scrollWidth - card.clientWidth, shot: box(card.querySelector('.tp-shot')), placeholder: Boolean(card.querySelector('.tp-ph')),
      image: image ? { loaded: image.complete && image.naturalWidth > 0, opacity: Number(getComputedStyle(image).opacity) } : null, tables: Boolean(card.querySelector('.tp-tables')),
      visible: frame.bottom > bodyBox.top + 1 && frame.top < bodyBox.bottom - 1, dashed: getComputedStyle(card).borderTopStyle === 'dashed', title: card.title };
  });
  return {
    view: [document.documentElement.clientWidth, document.documentElement.clientHeight], window: box(modal), head: box(modal.querySelector('.mod-head')), foot: box(modal.querySelector('.mod-foot')),
    body: { ...bodyBox, overflowX: body.scrollWidth - body.clientWidth, top: body.scrollTop, max: body.scrollHeight - body.clientHeight }, title: text(title), titleCut: title.scrollWidth > title.clientWidth + 1,
    count: text(modal.querySelector('.tp-count')), query: modal.querySelector('input').value, search: box(modal.querySelector('.tp-search')),
    chips: [...modal.querySelectorAll('.tp-chip')].map(chip => ({ app: chip.dataset.app, text: text(chip), pressed: chip.getAttribute('aria-pressed') === 'true', disabled: chip.getAttribute('aria-disabled') === 'true', box: box(chip) })),
    chipsRow: box(modal.querySelector('.tp-chips')), cards, columns: new Set(cards.map(card => Math.round(card.box.left))).size, none: modal.querySelector('.tp-none') ? text(modal.querySelector('.tp-none')) : null,
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null, note: text(modal.querySelector('.mod-note')), warn: modal.querySelector('.mod-note').classList.contains('is-warn'),
    see: { shown: !see.hidden && see.getClientRects().length > 0, text: text(see) }, create: { text: text(create), disabled: create.getAttribute('aria-disabled') === 'true' }, close: text(modal.querySelector('[data-act="close"]')),
    log: window.__templatesLog, scrims: document.querySelectorAll('.mod-scrim').length,
  };
}

// Le centre, en pixels de la page, d'un élément amené dans la fenêtre : le clic s'y fait à la vraie souris.
function centerOf(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function newMenu() {
  const menu = document.querySelector('.menu:not(.menu-sub)');
  if (!menu) return null;
  const view = [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const items = [...menu.querySelectorAll('.menu-item')].map(item => {
    const rect = item.getBoundingClientRect();
    const name = item.querySelector('.menu-label');
    return { label: name.textContent, popup: item.getAttribute('aria-haspopup') === 'menu', height: rect.height, cut: name.scrollWidth > name.clientWidth + 1, icon: Boolean(item.querySelector('svg use')),
      frame: [rect.left, rect.top, rect.right, rect.bottom], center: [rect.left + rect.width / 2, rect.top + rect.height / 2] };
  });
  return { view, items, menus: document.querySelectorAll('.menu').length };
}

const PROBES = {
  name: ['.tp-card .tp-name', '.tp-card'], app: ['.tp-card .tp-app', '.tp-card'], type: ['.tp-card:not([aria-disabled="true"]) .tp-type', '.tp-card'], lockedType: ['.tp-card[aria-disabled="true"] .tp-type', '.tp-card'],
  lockedName: ['.tp-card[aria-disabled="true"] .tp-name', '.tp-card'], pressedName: ['.tp-card[aria-pressed="true"] .tp-name', '.tp-card'], pressedApp: ['.tp-card[aria-pressed="true"] .tp-app', '.tp-card'],
  chip: ['.tp-chip[aria-pressed="false"]:not([aria-disabled="true"])', '.mod'], chipOn: ['.tp-chip[aria-pressed="true"]', '.mod'], chipOff: ['.tp-chip[aria-disabled="true"]', '.mod'],
  chipCount: ['.tp-chip[aria-pressed="false"] b', '.tp-chip'], count: ['.tp-count', '.mod'], note: ['.mod-note:not(.is-warn)', '.mod-foot'], warn: ['.mod-note.is-warn', '.mod-foot'],
  create: ['[data-act="create"]:not([aria-disabled="true"])', '.mod-foot'], createOff: ['[data-act="create"][aria-disabled="true"]', '.mod-foot'], close: ['[data-act="close"]', '.mod-foot'], see: ['[data-act="see"]', '.mod-foot'],
  none: ['.tp-none', '.mod'],
};

const closed = () => !document.querySelector('.mod-scrim');
const sameApprox = (a, b) => Math.abs(a - b) <= 1.5;

export async function modelesProblems(page, language, tag, mode) {
  const found = [];
  const run = new Run(page, tag, found, 'Nouveau > Depuis un modèle');
  const { t } = createI18n(language);
  const other = createI18n(OTHER[language]);
  // Une fonction passée à `page.run` s'exécute seule dans la page : celles qui en appellent d'autres (`gallery`, `centerOf`, `newMenu`) y sont posées comme fonctions globales.
  await page.run((...sources) => { for (const source of sources) { const name = source.match(/function (\w+)/)[1]; window[name] = (0, eval)(`(${source})`); } }, gallery.toString(), centerOf.toString(), newMenu.toString());
  const nameOf = (id, lang = language) => CATALOGUE.find(model => model.id === id).nom[lang];
  const note = (kind, text) => run.note(kind, text);
  const contrastsAt = async where => {
    for (const [what, value] of Object.entries(await page.run(contrasts, PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
  };
  const open = async variant => {
    await page.run(name => window.__templates(name), variant);
    // les vignettes se chargent à l'écran (`loading="lazy"`) : un instant après l'ouverture
    return page.until(() => { const g = gallery(); return g && g.cards.filter(card => card.visible && card.image).every(card => card.image.loaded) ? g : null; }).catch(() => page.run(gallery));
  };
  const close = async () => { await page.run(() => { if (window.__templatesControl) window.__templatesControl.close(); window.__templatesLog = { created: [], unlocked: [] }; }); };
  const click = async selector => { const at = await page.run(centerOf, selector); if (!at) { note('introuvable', `${selector} manque`); return false; } await page.click(...at); return true; };
  try {
    await menuProblems(page, language, t, note);
    await mainProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf, other, mode });
    await lockedProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf, mode });
  } catch (error) {
    note('mesure interrompue', String(error && error.stack ? error.stack : error).replace(/\s+/g, ' ').slice(0, 400));
  }
  await close();
  await page.run(() => { for (const menu of document.querySelectorAll('.menu')) menu.remove(); window.__importTypes = []; window.__templatesAsked = 0; });
  return found;
}

// L'article du menu « Nouveau » : ses trois lignes dans l'ordre, 28 px, rien de coupé, un clic le demande à l'explorateur et ferme le menu.
async function menuProblems(page, language, t, note) {
  const centerOfNew = () => {
    const button = document.querySelector('button use[href="#i-plus"]').closest('button');
    const box = button.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  };
  await page.run(() => { window.__importTypes = [{ app: 'publipostage', type: 'grille', icon: 'grid', family: 'grid', greyed: false, focus: null, reason: '', valeur: 'excel', extensions: ['.xlsx'], label: 'Excel', hint: '' }]; window.__templatesAsked = 0; });
  await page.click(...await page.run(centerOfNew));
  const shown = await page.until(newMenu, [], 1500).catch(() => null);
  if (!shown) { note('menu', 'le clic sur « Nouveau » n\'ouvre aucun menu'); return; }
  const names = shown.items.map(item => item.label);
  const wanted = [t('ex.newFolder'), t('ex.templates'), t('ex.import')];
  if (names.join('|') !== wanted.join('|')) note('le menu', `« Nouveau » montre « ${names.join(' | ')} » au lieu de « ${wanted.join(' | ')} »`);
  const row = shown.items[1];
  if (row) {
    if (Math.abs(row.height - 28) > 0.5) note('hauteur de la ligne', `« ${row.label} » mesure ${row.height} px au lieu de 28`);
    if (row.cut) note('nom coupé', `« ${row.label} » est coupé`);
    if (!row.icon) note('icône', `« ${row.label} » n'a pas d'icône`);
    if (row.popup) note('ligne', `« ${row.label} » ouvre un sous-menu : elle devrait ouvrir la fenêtre`);
    await page.click(...row.center);
    const after = await page.run(() => ({ asked: window.__templatesAsked, menus: document.querySelectorAll('.menu').length }));
    if (after.asked !== 1) note('le clic', `un clic sur « ${row.label} » demande ${after.asked} fois la galerie à l'explorateur au lieu d'une`);
    if (after.menus !== 0) note('les menus se ferment', `${after.menus} menu(s) restent ouverts après le choix`);
  }
}

// La fenêtre au départ : sa place, ses pastilles, ses cartes, ses vignettes, son pied.
async function startProblems(s, t, note, language) {
  if (s.window.left < -0.5 || s.window.top < -0.5 || s.window.right > s.view[0] + 0.5 || s.window.bottom > s.view[1] + 0.5) note('fenêtre', `la fenêtre (${[s.window.left, s.window.top, s.window.right, s.window.bottom].map(Math.round).join(', ')}) sort de la page de ${s.view.join(' × ')} px`);
  if (s.title !== t('tp.title') || s.titleCut) note('titre', `le titre devrait être « ${t('tp.title')} », entier : « ${s.title} »${s.titleCut ? ' (coupé)' : ''}`);
  if (s.count !== t('tp.count', { n: TOTAL })) note('nombre', `le nombre devrait dire « ${t('tp.count', { n: TOTAL })} » : « ${s.count} »`);
  if (s.focused !== 'search') note('clavier', `à l'ouverture le clavier devrait être dans la recherche : ${s.focused}`);
  const chips = s.chips.map(chip => `${chip.app}:${chip.text}${chip.pressed ? ':on' : ''}${chip.disabled ? ':off' : ''}`).join(' | ');
  const wantedChips = [`all:${t('tp.all')}${TOTAL}:on`, `publipostage:Publipostage+${CATALOGUE.length}`, `automation:Automation+${t('tp.soon')}:off`, `form:Form+${FORM}`, `bi:Grist-BI${BI}`].join(' | ');
  if (chips !== wantedChips) note('pastilles', `les pastilles devraient être « ${wantedChips} » : « ${chips} »`);
  if (new Set(s.chips.map(chip => Math.round(chip.box.top))).size > 1) note('pastilles', 'les pastilles devraient tenir sur une seule rangée');
  if (s.cards.length !== TOTAL) note('cartes', `la galerie devrait montrer ${TOTAL} cartes : ${s.cards.length}`);
  if (s.columns < 4) note('colonnes', `à ${s.view[0]} px la galerie devrait poser quatre colonnes au moins : ${s.columns}`);
  if (s.body.overflowX > 1) note('débordement', `la galerie déborde la fenêtre de ${s.body.overflowX} px`);
  const first = s.cards[0];
  if (first) {
    if (first.name !== CATALOGUE[0].nom[language]) note('première carte', `la première carte devrait s'appeler « ${CATALOGUE[0].nom[language]} » : « ${first.name} »`);
    if (first.type !== 'Document') note('type', `la carte devrait dire son type, « Document » : « ${first.type} »`);
    if (!first.tables) note('tables', 'un modèle qui vient avec des tables devrait le montrer');
    if (first.box.top > s.body.bottom - 60) note('première rangée', 'la première rangée devrait se voir dans la fenêtre');
  }
  const ratio = first ? first.shot.height / first.shot.width : 0;
  if (first && (ratio < 1.2 || ratio > 1.45)) note('vignette', `la vignette devrait être en portrait (3 × 4) : ${ratio.toFixed(2)}`);
  for (const card of s.cards) {
    if (card.overflow > 1) note('carte coupée', `« ${card.name} » déborde de ${card.overflow} px`);
    if (card.box.left < s.window.left || card.box.right > s.window.right) note('carte hors de la fenêtre', `« ${card.name} » sort de la fenêtre`);
    if (Math.abs(card.box.width - first.box.width) > 1.5) note('largeur des cartes', `« ${card.name} » mesure ${card.box.width.toFixed(1)} px, la première ${first.box.width.toFixed(1)} px`);
  }
  const visible = s.cards.filter(card => card.visible && card.image);
  if (!visible.length || visible.some(card => !card.image.loaded)) note('vignettes', `les vignettes à l'écran devraient toutes se charger : ${visible.filter(card => !card.image.loaded).length} sur ${visible.length} manquent`);
  if (s.cards.filter(card => card.tabindex === '0').length !== 1) note('arrêt de Tab', `une seule carte devrait avoir l'arrêt de Tab : ${s.cards.filter(card => card.tabindex === '0').length}`);
  if (s.note !== t('tp.idle')) note('pied', `le pied devrait dire « ${t('tp.idle')} » : « ${s.note} »`);
  if (!s.create.disabled || s.see.shown) note('boutons', `sans choix, « Créer » devrait être éteint et « Voir dans Apps » absent : ${JSON.stringify([s.create, s.see])}`);
  if (s.create.text !== t('tp.create') || s.close !== t('tp.close')) note('boutons', `les boutons devraient dire « ${t('tp.close')} » et « ${t('tp.create')} » : « ${s.close} » et « ${s.create.text} »`);
  if (s.body.max < 10) note('défilement', `${TOTAL} cartes à 400 px de haut : la galerie devrait défiler`);
  if (s.foot.bottom > s.window.bottom + 0.5 || s.head.top < s.window.top - 0.5) note('pied et en-tête', 'l\'en-tête et le pied devraient rester dans la fenêtre');
}

// La galerie prête : le départ, les vignettes qui suivent le défilement, la recherche, les pastilles, « Créer » à la souris et au clavier, la langue, les fenêtres étroites.
async function mainProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf, other, mode }) {
  let s = await open('pret');
  await startProblems(s, t, note, language);
  await contrastsAt(`la galerie (${mode})`);
  // Les cartes défilent, le titre et le pied restent : et les vignettes du bas se chargent quand elles arrivent.
  const headTop = s.head.top;
  const footTop = s.foot.top;
  await page.run(() => { const body = document.querySelector('.mod.tp .mod-body'); body.scrollTop = body.scrollHeight; });
  s = await page.until(() => { const g = gallery(); return g && g.cards.filter(card => card.visible && card.image).every(card => card.image.loaded) ? g : null; }).catch(() => null);
  if (!s) note('vignettes du bas', 'les vignettes du bas ne se chargent pas quand la galerie défile jusqu\'à elles');
  else if (!sameApprox(s.head.top, headTop) || !sameApprox(s.foot.top, footTop)) note('une seule base', `l'en-tête (${headTop} → ${s.head.top}) ou le pied (${footTop} → ${s.foot.top}) a bougé quand les cartes ont défilé`);
  await page.run(() => { document.querySelector('.mod.tp .mod-body').scrollTop = 0; });
  // La recherche au clavier : des mots dans n'importe quel ordre, puis rien.
  await page.press(...SEARCH[language].split(''));
  s = await page.until(() => { const g = gallery(); return g && g.query && g.cards.length === 1 ? g : null; }).catch(() => null);
  if (!s) note('recherche', `« ${SEARCH[language]} » devrait ne laisser que « ${nameOf('bon-de-mouvement')} »`);
  else {
    if (s.cards[0].name !== nameOf('bon-de-mouvement')) note('recherche', `« ${SEARCH[language]} » devrait trouver « ${nameOf('bon-de-mouvement')} » : « ${s.cards[0].name} »`);
    if (s.count !== t('tp.count', { n: 1 })) note('recherche', `le nombre devrait dire « ${t('tp.count', { n: 1 })} » : « ${s.count} »`);
    if (s.chips[0].text !== `${t('tp.all')}${TOTAL}`) note('recherche', 'les pastilles gardent leurs nombres (toute la galerie) pendant la recherche');
  }
  await page.chord('Control', 'a');
  await page.press('Backspace', ...'zzzz'.split(''));
  s = await page.until(() => { const g = gallery(); return g && g.query === 'zzzz' && g.none ? g : null; }).catch(() => null);
  if (!s) note('recherche vide', 'une recherche sans résultat devrait le dire');
  else if (s.none !== t('tp.none') || s.count !== t('tp.count', { n: 0 })) note('recherche vide', `devrait dire « ${t('tp.none')} » et « ${t('tp.count', { n: 0 })} » : « ${s.none} » / « ${s.count} »`);
  await contrastsAt(`la galerie sans résultat (${mode})`);
  await page.chord('Control', 'a');
  await page.press('Backspace');
  s = await page.until(total => { const g = gallery(); return g && g.query === '' && g.cards.length === total ? g : null; }, [TOTAL]).catch(() => null);
  if (!s) note('recherche', `effacer la recherche devrait rendre les ${TOTAL} cartes`);
  await pillProblems(page, t, note, { click });
  await createProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf });
  await languageProblems(page, language, t, note, { open, close, other });
  await narrowProblems(page, t, note, { open, close, mode });
}

// Les pastilles : filtrer par app, revenir ; une pastille grisée dit pourquoi et ne filtre pas.
async function pillProblems(page, t, note, { click }) {
  if (!await click('[data-app="publipostage"]')) return;
  let s = await page.until(() => { const g = gallery(); return g && g.chips.find(chip => chip.app === 'publipostage').pressed ? g : null; }).catch(() => null);
  if (!s) note('pastille', 'un clic sur « Publipostage+ » devrait la choisir');
  else if (s.cards.length !== CATALOGUE.length || s.chips[0].pressed) note('pastille', `filtrer sur Publipostage+ devrait garder ses ${CATALOGUE.length} cartes et défaire « ${t('tp.all')} » : ${s.cards.length} / ${s.chips[0].pressed}`);
  await click('[data-app="publipostage"]');
  s = await page.until(() => { const g = gallery(); return g && g.chips[0].pressed ? g : null; }).catch(() => null);
  if (!s) note('pastille', 'un second clic sur la même pastille devrait revenir à toutes les apps');
  // Form+ et Grist-BI livrent leur catalogue : leur pastille filtre sur leurs cartes, libres et avec leur vignette.
  for (const [app, count] of [['form', FORM], ['bi', BI]]) {
    if (!await click(`[data-app="${app}"]`)) continue;
    s = await page.until(id => { const g = gallery(); return g && g.chips.find(chip => chip.app === id).pressed && g.cards.every(card => !card.image || card.image.loaded) ? g : null; }, [app]).catch(() => null);
    if (!s) note('pastille', `un clic sur la pastille « ${app} » devrait la choisir et charger ses vignettes`);
    else if (s.cards.length !== count || s.chips[0].pressed || s.cards.some(card => card.disabled)) note('pastille', `filtrer sur « ${app} » devrait montrer ses ${count} cartes libres : ${s.cards.length} / ${s.cards.filter(card => card.disabled).length} grisées`);
    await click(`[data-app="${app}"]`);
    await page.until(() => { const g = gallery(); return g && g.chips[0].pressed ? g : null; }).catch(() => null);
  }
  await click('[data-app="automation"]');
  s = await page.until(() => { const g = gallery(); return g && g.note !== undefined && g.note.includes('Automation+') ? g : null; }).catch(() => null);
  if (!s) note('pastille grisée', 'un clic sur une app sans modèle devrait dire pourquoi, dans le pied');
  else {
    if (s.note !== t('tp.appSoon', { app: 'Automation+' })) note('pastille grisée', `le pied devrait dire « ${t('tp.appSoon', { app: 'Automation+' })} » : « ${s.note} »`);
    if (!s.chips[0].pressed || s.cards.length !== TOTAL) note('pastille grisée', 'une pastille grisée ne filtre pas : « Toutes les apps » reste choisie');
  }
}

// « Créer » : à la souris (une carte, puis le bouton), au clavier (flèches, Entrée), Échap sans rien créer, « Fermer ».
async function createProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf }) {
  const created = () => page.run(() => window.__templatesLog.created);
  if (!await click('.tp-card')) return;
  let s = await page.until(() => { const g = gallery(); return g && g.cards[0].pressed ? g : null; }).catch(() => null);
  if (!s) { note('choix', 'un clic sur une carte devrait la choisir'); return; }
  if (s.note !== t('tp.chosenTables', { name: nameOf('facture'), app: 'Publipostage+' })) note('pied', `le pied devrait dire « ${t('tp.chosenTables', { name: nameOf('facture'), app: 'Publipostage+' })} » : « ${s.note} »`);
  if (s.create.disabled) note('créer', '« Créer » devrait s\'allumer quand une carte est choisie');
  if (s.warn) note('pied', 'le pied d\'un modèle libre ne devrait pas être en ambre');
  await contrastsAt('la galerie avec un choix');
  await click('[data-act="create"]');
  await page.until(closed).catch(() => note('créer', 'un clic sur « Créer » devrait fermer la fenêtre'));
  if ((await created()).join() !== 'publipostage/facture') note('créer', `« Créer » devrait rendre « publipostage/facture » au contrôleur : ${JSON.stringify(await created())}`);
  // Au clavier : de la recherche à la première carte, à la suivante, Entrée.
  await close();
  await open('pret');
  await page.press('ArrowDown');
  s = await page.until(() => { const g = gallery(); return g && g.focused === `m:${g.cards[0].key}` ? g : null; }).catch(() => null);
  if (!s) note('clavier', 'la flèche du bas, dans la recherche, devrait aller à la première carte');
  await page.press('ArrowRight');
  s = await page.until(() => { const g = gallery(); return g && g.focused === `m:${g.cards[1].key}` ? g : null; }).catch(() => null);
  if (!s) note('clavier', 'la flèche de droite devrait aller à la carte suivante');
  await page.press('ArrowDown');
  s = await page.until(() => { const g = gallery(); return g && g.cards.findIndex(card => g.focused === `m:${card.key}`) === 1 + g.columns ? g : null; }).catch(() => null);
  if (!s) note('clavier', 'la flèche du bas devrait descendre d\'une rangée');
  await page.press('ArrowUp', 'ArrowLeft', 'ArrowUp');
  s = await page.until(() => { const g = gallery(); return g && g.focused === 'search' ? g : null; }).catch(() => null);
  if (!s) note('clavier', 'la flèche du haut, sur la première rangée, devrait revenir à la recherche');
  await page.press('ArrowDown', 'ArrowRight', 'Enter');
  await page.until(closed).catch(() => note('Entrée', 'Entrée sur une carte devrait créer et fermer la fenêtre'));
  if ((await created()).join() !== 'publipostage/courrier-relance') note('Entrée', `Entrée sur la deuxième carte devrait rendre « publipostage/courrier-relance » : ${JSON.stringify(await created())}`);
  // Échap ne crée rien ; « Fermer » non plus.
  await close();
  await open('pret');
  await page.press('Escape');
  await page.until(closed).catch(() => note('Échap', 'Échap devrait fermer la fenêtre'));
  if ((await created()).length) note('Échap', `Échap ne devrait rien créer : ${JSON.stringify(await created())}`);
  await open('pret');
  await click('[data-act="close"]');
  await page.until(closed).catch(() => note('Fermer', '« Fermer » devrait fermer la fenêtre'));
  if ((await created()).length) note('Fermer', `« Fermer » ne devrait rien créer : ${JSON.stringify(await created())}`);
  await close();
}

// Le changement de langue, fenêtre ouverte : les textes, les noms et les étiquettes passent dans l'autre langue, la recherche est gardée.
async function languageProblems(page, language, t, note, { open, close, other }) {
  await open('pret');
  await page.press(...'stock'.split('')); // un mot des deux langues : la recherche se relit dans la nouvelle langue
  const before = await page.until(() => { const g = gallery(); return g && g.query === 'stock' && g.cards.length ? g : null; }).catch(() => null);
  await page.run(lang => window.__templatesLanguage(lang), OTHER[language]);
  const s = await page.run(gallery);
  if (!s || s.title !== other.t('tp.title')) note('langue', `après le changement de langue le titre devrait être « ${other.t('tp.title')} » : « ${s && s.title} »`);
  else if (!before || s.query !== 'stock' || !s.cards.length) note('langue', 'après le changement de langue la recherche devrait rester et trouver les mêmes modèles');
  else if (s.cards[0].name === before.cards[0].name) note('langue', `le nom de la carte devrait changer de langue : « ${s.cards[0].name} »`);
  await close();
}

// Les fenêtres étroites : plus de colonnes que la place n'en donne jamais, rien ne déborde.
async function narrowProblems(page, t, note, { open, close, mode }) {
  for (const [width, columns] of [[520, 3], [400, 2]]) {
    await page.view({ width, scale: 1, mode });
    const s = await open('pret');
    if (s.window.right > s.view[0] + 0.5 || s.window.left < -0.5) note(`${width} px`, `la fenêtre sort de la page de ${s.view[0]} px`);
    if (s.body.overflowX > 1) note(`${width} px`, `la galerie déborde de ${s.body.overflowX} px`);
    if (s.columns < columns) note(`${width} px`, `la galerie devrait poser ${columns} colonnes au moins : ${s.columns}`);
    if (s.search.right > s.window.right + 0.5 || s.search.left < s.window.left - 0.5) note(`${width} px`, 'la recherche sort de la fenêtre');
    if (s.cards.some(card => card.overflow > 1)) note(`${width} px`, 'une carte déborde');
    if (s.title !== t('tp.title')) note(`${width} px`, `le titre devrait rester « ${t('tp.title')} » : « ${s.title} »`);
    await close();
  }
  await page.view({ width: 700, scale: 1, mode });
}

// Le grisé : une app qui ne sait pas encore ouvrir un modèle, une extension éteinte (« Voir dans Apps » et le retour), l'app absente, un catalogue illisible.
async function lockedProblems(page, language, t, note, { open, close, click, contrastsAt, nameOf }) {
  // Une app qui ne déclare pas (encore) `ouverture.modele` : le banc l'ôte aux trois apps qui ont un catalogue.
  let s = await open('attente');
  if (s.cards.length !== TOTAL || s.cards.some(card => !card.disabled || !card.dashed)) note('attente', `sans \`ouverture.modele\` les ${TOTAL} cartes devraient rester, grisées et en pointillé`);
  if (s.cards.some(card => card.image && Math.abs(card.image.opacity - 0.5) > 0.05)) note('attente', 'la vignette d\'un modèle grisé devrait être à demi effacée');
  await click('.tp-card');
  s = await page.until(() => { const g = gallery(); return g && g.cards[0].pressed ? g : null; }).catch(() => null);
  const reason = t('ex.template.notYet', { app: 'Publipostage+' });
  if (!s) note('attente', 'un clic sur une carte grisée devrait la choisir, pour en dire la raison');
  else {
    if (s.note !== t('tp.locked', { name: nameOf('facture'), reason })) note('attente', `le pied devrait dire « ${t('tp.locked', { name: nameOf('facture'), reason })} » : « ${s.note} »`);
    if (!s.warn) note('attente', 'la raison d\'un modèle grisé devrait être en ambre');
    if (s.see.shown) note('attente', '« Voir dans Apps » n\'a rien à débloquer : il devrait rester caché');
    if (!s.create.disabled) note('attente', '« Créer » devrait rester éteint');
  }
  await contrastsAt('la galerie grisée (attente)');
  await click('[data-act="create"]');
  const stayed = await page.run(() => ({ scrims: document.querySelectorAll('.mod-scrim').length, created: window.__templatesLog.created.length }));
  if (stayed.scrims !== 1 || stayed.created) note('attente', `« Créer » éteint ne devrait ni fermer la fenêtre ni rien créer : ${JSON.stringify(stayed)}`);
  await close();
  // Une extension éteinte : « Voir dans Apps » ouvre la ligne ; la galerie revient avec la recherche et le choix.
  await open('extension');
  await page.press(...'presentation'.split(''));
  await page.until(() => { const g = gallery(); return g && g.cards.length === 1 ? g : null; }).catch(() => note('extension', 'la recherche « presentation » devrait ne laisser que la présentation commerciale'));
  await click('.tp-card');
  s = await page.until(() => { const g = gallery(); return g && g.see.shown ? g : null; }).catch(() => null);
  if (!s) { note('extension', 'un modèle qui demande une extension éteinte devrait montrer « Voir dans Apps »'); await close(); return; }
  if (s.see.text !== t('tp.seeApps') || !s.cards[0].disabled) note('extension', `« ${t('tp.seeApps')} » devrait se montrer sur une carte grisée : « ${s.see.text} » / grisée ${s.cards[0].disabled}`);
  await contrastsAt('la galerie grisée (extension)');
  await click('[data-act="see"]');
  const back = await page.until(() => { const g = gallery(); return g && window.__templatesLog.unlocked.length && g.query === 'presentation' && g.cards[0].pressed ? g : null; }).catch(() => null);
  const unlocked = await page.run(() => window.__templatesLog.unlocked);
  if (unlocked.length !== 1 || unlocked[0].focus !== 'ext:publipostage/graphique') note('extension', `« Voir dans Apps » devrait ouvrir la ligne du graphique : ${JSON.stringify(unlocked)}`);
  if (!back) note('extension', 'après la fenêtre « Apps et extensions » la galerie devrait revenir avec la recherche et le choix');
  await close();
  // L'app absente : la ligne de l'app.
  s = await open('absente');
  await click('.tp-card');
  s = await page.until(() => { const g = gallery(); return g && g.see.shown ? g : null; }).catch(() => null);
  if (!s) note('app absente', 'un modèle d\'une app non installée devrait montrer « Voir dans Apps »');
  else if (!s.note.includes(t('ex.lockedApp', { app: 'Publipostage+' }))) note('app absente', `le pied devrait dire « ${t('ex.lockedApp', { app: 'Publipostage+' })} » : « ${s.note} »`);
  await close();
  // Un catalogue illisible : la pastille le dit, la raison est au clic.
  s = await open('illisible');
  const pill = s.chips.find(chip => chip.app === 'publipostage');
  if (!pill || !pill.disabled || !pill.text.includes(t('tp.broken'))) note('catalogue illisible', `la pastille de Publipostage+ devrait être grisée et dire « ${t('tp.broken')} » : ${JSON.stringify(pill)}`);
  if (s.cards.length || s.none !== t('tp.empty')) note('catalogue illisible', `sans aucun modèle la fenêtre devrait dire « ${t('tp.empty')} » : « ${s.none} »`);
  await click('[data-app="publipostage"]');
  s = await page.until(() => { const g = gallery(); return g && g.note.includes('404') ? g : null; }).catch(() => null);
  if (!s) note('catalogue illisible', 'un clic sur la pastille devrait dire la raison (404)');
  await contrastsAt('la galerie vide');
  await close();
}
