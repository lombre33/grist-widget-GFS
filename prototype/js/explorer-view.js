// Le dessin de l'explorateur (maquette du 12/10, charte Grist Factory) : des fonctions qui construisent des nœuds à partir de l'état, sans
// jamais interpréter un nom de fichier comme du HTML. Les clics se lisent par délégation, d'après les attributs `data-*` posés ici.

import { h } from './dom.js';
import { icon } from './icons.js';
import { person, formatDate, pathParts, stampOf, authorOf, FAMILY_NAMES } from './explorer-model.js';
import { SPACES_ROOT, folderLabel, isSpacePath } from './spaces-filing.js';
import { formatBytes } from './weight.js';
import { chipKey } from './rights.js';

export const SORT_HEADERS = [['name', 'ex.name'], ['type', 'ex.type'], ['poids', 'ex.weight'], ['mod', 'ex.modified'], ['by', 'ex.by']];

// Le cadre fixe : titre, « Apps », bascule liste/vignettes, « Réglages », fil d'Ariane, recherche, filtre de type, « Nouveau », volet, liste, barre d'information.
// Ses textes sont posés par `relabel` : la même fonction les réécrit quand la personne change la langue de GFS.
export function buildShell(i18n) {
  const refs = {};
  const keep = (key, node) => { refs[key] = node; return node; };
  const toggle = (key, glyph) => keep(key, h('button', { type: 'button', class: 'tb', 'aria-pressed': 'false' }, icon(glyph)));
  const root = h('section', { class: 'ex', 'aria-labelledby': 'ex-title', hidden: true },
    h('header', { class: 'ex-head' },
      h('div', { class: 'ex-title-row' },
        keep('title', h('h2', { class: 'ex-title', id: 'ex-title' })),
        h('span', { class: 'grow' }),
        keep('appsBtn', h('button', { type: 'button', class: 'tb', 'aria-haspopup': 'dialog' })),
        keep('display', h('div', { class: 'tb-group', role: 'group' }, toggle('viewList', 'list'), toggle('viewTiles', 'tiles'))),
        keep('settingsBtn', h('button', { type: 'button', class: 'tb', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('sliders')))),
      h('div', { class: 'ex-nav-row' },
        keep('crumbs', h('nav', { class: 'crumbs' })),
        h('label', { class: 'inp-search' }, icon('search'), keep('search', h('input', { type: 'search', autocomplete: 'off' }))),
        keep('typeBtn', h('button', { type: 'button', class: 'btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' })),
        keep('newBtn', h('button', { type: 'button', class: 'btn primary', 'aria-haspopup': 'menu', 'aria-expanded': 'false' })))),
    keep('notices', h('div', { class: 'ex-notices' })),
    h('div', { class: 'ex-body' },
      keep('tree', h('nav', { class: 'ex-tree' })),
      h('div', { class: 'ex-main' }, keep('scroll', h('div', { class: 'ex-scroll' },
        keep('list', h('div', { class: 'ex-list', role: 'grid', tabindex: '-1' })),
        keep('empty', h('div', { class: 'empty', hidden: true })))))),
    h('footer', { class: 'ex-foot' },
      keep('info', h('div', { class: 'ex-info', 'aria-live': 'polite' })),
      keep('total', h('button', { type: 'button', class: 'ex-total', id: 'ex-total', 'aria-haspopup': 'dialog' })),
      keep('pj', h('label', { class: 'ex-pj' }, keep('pjInput', h('input', { type: 'checkbox', 'aria-describedby': 'ex-total' })), keep('pjText', h('span')))),
      h('div', { class: 'ex-rights' }, keep('rightsBtn', h('button', { type: 'button', class: 'rights-chip', 'aria-haspopup': 'dialog' }))),
      keep('openBtn', h('button', { type: 'button', class: 'btn' })),
      keep('closeBtn', h('button', { type: 'button', class: 'btn' }))));
  relabel(refs, i18n);
  return { root, refs };
}

// Les textes du cadre fixe, dans la langue de `i18n` : à la construction, puis à chaque changement de langue. Le contenu qui change au fil de l'usage (fil d'Ariane, volet,
// liste, bouton du filtre de type) est redessiné par l'explorateur. Le bouton « Réglages » n'a que son icône, posée à la construction : `relabel` ne touche qu'à ses noms, et le clavier y reste quand on vient
// de choisir une langue dans son menu.
export function relabel(refs, i18n) {
  const { t } = i18n;
  const describe = (node, text) => { node.setAttribute('title', text); node.setAttribute('aria-label', text); };
  refs.title.textContent = t('ex.title');
  refs.appsBtn.title = t('gfs.appsTip');
  refs.appsBtn.replaceChildren(icon('modules'), t('gfs.apps'));
  describe(refs.settingsBtn, t('set.tip'));
  refs.display.setAttribute('aria-label', t('ex.display'));
  describe(refs.viewList, t('ex.list'));
  describe(refs.viewTiles, t('ex.tiles'));
  refs.crumbs.setAttribute('aria-label', t('ex.path'));
  refs.search.placeholder = t('ex.search');
  refs.search.setAttribute('aria-label', t('ex.searchLabel'));
  refs.typeBtn.title = t('ex.typeFilter');
  refs.newBtn.replaceChildren(icon('plus'), t('ex.new'));
  refs.tree.setAttribute('aria-label', t('ex.folders'));
  refs.list.setAttribute('aria-label', t('ex.title'));
  refs.total.title = `${t('weight.totalTip')} ${t('weight.detailTip')}`;
  refs.pjText.textContent = t('weight.pj');
  refs.pj.title = t('weight.pjTip');
  refs.openBtn.textContent = t('ex.open');
  refs.closeBtn.textContent = t('ex.close');
  rightsChip(refs, i18n, refs.rights || null);
}

// Le mot du pied (contrats 11.4, point 7) : « Pas protégé », « Protégé en partie », « Protégé », ou « Permissions » tant que GFS n'a rien lu ; il ouvre le panneau des permissions. `rules` : ce que
// `RightsReader.rules()` a rendu, ou null avant la lecture. Le mot et l'icône vont ensemble.
export function rightsChip(refs, i18n, rules) {
  const { t } = i18n;
  const word = rules && rules.readable && rules.word ? rules.word : 'none';
  refs.rightsBtn.dataset.word = word;
  refs.rightsBtn.title = t('rights.chip.tip');
  refs.rightsBtn.replaceChildren(icon('shield'), h('span', { class: 'lbl' }, t(chipKey(rules))));
}

const family = file => (FAMILY_NAMES.includes(file.family) ? file.family : null);

// Le poids d'une ligne, dans la langue de la personne (js/weight.js).
const weightText = (ctx, bytes) => formatBytes(bytes, ctx.locale, ctx.t);

// Le fil d'Ariane : la racine (« Moi »), puis les dossiers ; « Résultats » quand une recherche ou un filtre est en cours.
export function crumbs(ctx) {
  const { t, state } = ctx;
  const sep = () => h('span', { class: 'sp' }, icon('chev-right'));
  const link = (path, name) => h('button', { type: 'button', dataset: { path } }, name);
  // Récents et Favoris gardent le chemin du retour à « Moi » : en vue étroite, le volet des dossiers est replié.
  if (state.view === 'recent') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('clock'), t('ex.recent'))];
  if (state.view === 'fav') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('pin'), t('ex.fav'))];
  if (state.view === 'trash') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('trash'), t('trash.view'))];
  if (state.view === 'shared') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('users'), t('rx.view'))];
  if (ctx.filtering) return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, t('ex.results'))];
  const parts = pathParts(state.path);
  if (!parts.length) return [h('span', { class: 'here' }, icon('user'), t('ex.me'))];
  const last = parts.length - 1;
  const crumb = (part, i) => (i === last ? h('span', { class: 'here' }, folderLabel(t, part.path, part.name)) : link(part.path, folderLabel(t, part.path, part.name)));
  // Les espaces partagés sont une racine à côté de « Moi » : leur fil d'Ariane ne passe pas par « Moi ».
  if (isSpacePath(state.path)) return parts.flatMap((part, i) => (i ? [sep(), crumb(part, i)] : [crumb(part, i)]));
  return [link('', t('ex.me')), ...parts.flatMap((part, i) => [sep(), crumb(part, i)])];
}

function treeRow({ label, glyph, data, current, depth = 0, caret = null, toggle = null, count = null, grey = false }) {
  // Le nom entier au survol : le volet est étroit, un nom long y est coupé (charte).
  return h('button', { type: 'button', class: 'tr-row', title: label, dataset: data, 'aria-current': String(Boolean(current)), 'aria-disabled': grey ? 'true' : null, vars: { '--d': depth } },
    h('span', { class: 'car-slot', dataset: toggle === null ? null : { toggle } }, caret ? icon('chev-right', caret === 'open' ? 'open' : '') : null),
    icon(glyph, glyph === 'folder' ? 'fld' : ''), h('span', { class: 'lbl' }, label), count === null ? null : h('span', { class: 'cnt' }, String(count)));
}

// Le volet : Récents et Favoris toujours en haut, puis « Moi » et ses dossiers.
export function tree(ctx) {
  const { t, state } = ctx;
  const inFolders = state.view === 'folder';
  const pinned = h('div', { class: 'tr-pin' },
    treeRow({ label: t('ex.recent'), glyph: 'clock', data: { view: 'recent' }, current: state.view === 'recent' }),
    treeRow({ label: t('ex.fav'), glyph: 'pin', data: { view: 'fav' }, current: state.view === 'fav', count: ctx.favCount }),
    // Les arrivées d'un autre document, à accepter ou acceptées : le nombre à accepter, grisées pendant un choix (un fichier d'ailleurs ne se choisit pas).
    treeRow({ label: t('rx.view'), glyph: 'users', data: { view: 'shared' }, current: state.view === 'shared', count: ctx.sharedPending || null, grey: ctx.choosing }),
    // La corbeille garde son rang pendant le choix d'un fichier, grisée : un fichier supprimé ne se choisit pas.
    treeRow({ label: t('trash.view'), glyph: 'trash', data: { view: 'trash' }, current: state.view === 'trash', count: ctx.trashCount || null, grey: ctx.choosing }),
    h('hr', { class: 'tr-sep' }));
  // « Espaces » est une racine à côté de « Moi » : ses lignes viennent après celles de « Moi », au même niveau que lui.
  const row = (item, shift) => h('div', { class: 'tr-folder' }, treeRow({
    label: folderLabel(t, item.path, item.name), glyph: item.path === SPACES_ROOT ? 'users' : 'folder', data: { path: item.path }, current: inFolders && state.path === item.path, depth: item.depth + shift,
    caret: item.hasChildren ? (item.open ? 'open' : 'closed') : null, toggle: item.hasChildren ? item.path : null,
  }));
  const mine = ctx.treeRows.filter(item => !isSpacePath(item.path)).map(item => row(item, 1));
  const spaces = ctx.treeRows.filter(item => isSpacePath(item.path)).map(item => row(item, 0));
  return [pinned, h('div', { class: 'tr-folder' }, treeRow({ label: t('ex.me'), glyph: 'user', data: { path: '' }, current: inFolders && state.path === '' })), ...mine, ...spaces];
}

// À la corbeille, la colonne de date dit la date de la suppression, non celle de la dernière modification.
export function listHead(ctx) {
  const { t, sort } = ctx;
  const trash = ctx.state.view === 'trash';
  return h('div', { class: 'ls-head', role: 'row' }, ...SORT_HEADERS.map(([key, text]) => h('button', {
    type: 'button', class: 'hd', role: 'columnheader', dataset: { sort: key }, 'aria-sort': sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : null,
  }, t(trash && key === 'mod' ? 'trash.deleted' : text))), h('span'));
}

function fileCells(ctx, file, flat) {
  const { t } = ctx;
  const lock = ctx.lockOf(file);
  const who = person(authorOf(file));
  const name = file.name || t('ex.untitled');
  const pinTitle = file.pinned ? t('ex.unpin') : t('ex.pin');
  return [
    h('div', { class: 'nm', role: 'gridcell' }, icon(lock ? 'lock' : file.icon), h('span', { class: 't', title: lock ? `${name} · ${lock.text}` : name }, name),
      flat && file.folder ? h('span', { class: 'hint' }, file.folder.split('/').pop()) : null,
      lock ? h('span', { class: 'sr-only' }, `, ${lock.text}`) : null),
    h('div', { class: 'ty', role: 'gridcell' }, h('span', { class: 'pill' }, ctx.typeLabel(file))),
    h('div', { class: 'wt', role: 'gridcell' }, weightText(ctx, file.weight)),
    h('div', { class: 'md', role: 'gridcell' }, formatDate(stampOf(file), ctx.now, ctx.locale, t)),
    h('div', { class: 'by', role: 'gridcell' }, who.initials ? h('span', { class: 'who', title: who.name }, who.initials) : null),
    h('div', { class: 'acts', role: 'gridcell' }, ctx.state.view === 'trash' ? restoreButton(t, file.key)
      : (ctx.state.view === 'shared' ? null : h('button', { type: 'button', class: `rb pin${file.pinned ? ' on' : ''}`, dataset: { pin: file.key }, title: pinTitle, 'aria-label': pinTitle, 'aria-pressed': String(file.pinned) }, icon('pin'))),
    moreButton(t, file.key)),
  ];
}

// « Restaurer » d'une ligne de la corbeille : il prend la place de l'étoile (un fichier à la corbeille ne s'épingle pas).
const restoreButton = (t, key) => h('button', { type: 'button', class: 'rb rs', dataset: { restore: key }, title: t('trash.restore'), 'aria-label': t('trash.restore') }, icon('restore'));

// « Plus d'actions » d'une ligne (fichier ou dossier) : le menu de js/explorer.js.
const moreButton = (t, key) => h('button', { type: 'button', class: 'rb mn', dataset: { menu: key }, title: t('ex.more'), 'aria-label': t('ex.more'), 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'));

export function fileRow(ctx, file, flat) {
  const lock = ctx.lockOf(file);
  return h('div', {
    class: `ls-row${lock ? ' lk' : ''}`, role: 'row', tabindex: ctx.state.sel === file.key ? '0' : '-1', dataset: { key: file.key },
    'aria-selected': String(ctx.state.sel === file.key), 'data-fam': lock ? null : family(file), title: lock ? lock.text : null,
  }, ...fileCells(ctx, file, flat));
}

export function folderRow(ctx, folder) {
  const { t } = ctx;
  const key = `dir:${folder.path}`;
  return h('div', { class: 'ls-row folder', role: 'row', tabindex: ctx.state.sel === key ? '0' : '-1', dataset: { key }, 'aria-selected': String(ctx.state.sel === key) },
    h('div', { class: 'nm', role: 'gridcell' }, icon('folder', 'fld'), h('span', { class: 't', title: folderLabel(t, folder.path, folder.name) }, folderLabel(t, folder.path, folder.name))),
    h('div', { class: 'ty', role: 'gridcell' }, h('span', { class: 'pill' }, t('ex.fileCount', { n: folder.count }))),
    h('div', { class: 'wt', role: 'gridcell' }, weightText(ctx, folder.weight)),
    h('div', { class: 'md', role: 'gridcell' }, formatDate(folder.ts, ctx.now, ctx.locale, t)),
    h('div', { class: 'by', role: 'gridcell' }),
    h('div', { class: 'acts', role: 'gridcell' }, moreButton(t, key)));
}

// Ce qu'une vignette montre : un dossier ou un fichier (grisé ou non).
function tileFacts(ctx, row) {
  const { t } = ctx;
  if (row.kind === 'folder') {
    return { folder: true, key: `dir:${row.path}`, lock: null, glyph: 'folder', name: row.name, caption: t('ex.fileCount', { n: row.count }), weight: weightText(ctx, row.weight), fam: null };
  }
  const file = row.file;
  const lock = ctx.lockOf(file);
  return { folder: false, key: file.key, lock, glyph: lock ? 'lock' : file.icon, name: file.name || t('ex.untitled'), caption: ctx.typeLabel(file), weight: weightText(ctx, file.weight), fam: lock ? null : family(file) };
}

export function tile(ctx, row) {
  const { folder, key, lock, glyph, name, caption, weight, fam } = tileFacts(ctx, row);
  const selected = ctx.state.sel === key;
  return h('div', {
    class: `th${folder ? ' folder' : ''}${lock ? ' lk' : ''}`, role: 'row', tabindex: selected ? '0' : '-1', dataset: { key },
    'aria-selected': String(selected), 'data-fam': fam, title: lock ? lock.text : null,
  },
  h('div', { class: 'th-pv' }, icon(glyph, folder ? 'fld' : '')),
  h('span', { class: 'tn', title: lock ? `${name} · ${lock.text}` : name }, name),
  h('div', { class: 'tt' }, icon(glyph), caption),
  h('div', { class: 'tw' }, weight));
}

// Le message d'une liste vide : jamais une page blanche.
export function emptyMessage(ctx) {
  const { t, state } = ctx;
  if (ctx.filtering) return t('ex.emptySearch');
  if (ctx.choosing && ctx.totalFiles === 0) return t('ex.choose.empty');
  if (state.view === 'trash') return t('trash.emptyList');
  if (state.view === 'shared') return t('rx.empty');
  if (state.view === 'fav') return t('ex.emptyFav');
  // « Aucun fichier » ne vaut qu'à la racine : un dossier (créé vide, ou vidé) est « vide » même quand le document n'a aucun fichier.
  if (state.view === 'recent' || (ctx.totalFiles === 0 && state.path === '')) return t('ex.emptyAll');
  return t('ex.emptyFolder');
}

const infoLine1 = (...nodes) => h('div', { class: 'l1' }, ...nodes);

// La barre d'information : le fichier choisi (l'app qui l'ouvre, la date, le grisé), sinon un rappel du rangement : à la personne seule, ou commun au
// document tant que GFS ne sait pas qui elle est (contrats 6.4, point 4). Ses lignes sont coupées quand la place manque : son texte entier est au survol (charte).
export function infoBar(ctx) {
  const bar = infoContent(ctx);
  bar.title = [...bar.children].map(line => line.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return bar;
}

function infoContent(ctx) {
  const { t, selected } = ctx;
  const filingHint = ctx.personal ? t('ex.hintPersonal') : t('ex.hintShared');
  if (!selected) return noSelectionInfo(ctx, filingHint);
  return selected.kind === 'folder' ? folderInfo(ctx, selected, filingHint) : fileInfo(ctx, selected.file);
}

// Rien n'est choisi : ce que fait la vue (la corbeille, un choix de fichier, le rangement d'un dossier), puis un rappel des favoris.
function noSelectionInfo(ctx, filingHint) {
  const { t } = ctx;
  const hint = ctx.state.view === 'trash' ? t('trash.hint') : (ctx.state.view === 'folder' ? filingHint : t('ex.hintSelect'));
  return h('div', { class: 'inf' }, infoLine1(icon('info'), h('span', { class: 'mu' }, ctx.choosing ? t('ex.choose.hint') : hint)),
    h('div', { class: 'l2' }, icon('pin'), h('span', { class: 'lt' }, ctx.personal ? t('ex.hintFav') : t('ex.hintFavShared'))));
}

function folderInfo(ctx, selected, filingHint) {
  const { t } = ctx;
  return h('div', { class: 'inf' }, infoLine1(icon('folder'), h('b', null, folderLabel(t, selected.path, selected.name)), h('span', { class: 'mu' }, `· ${t('ex.fileCount', { n: selected.count })} · ${weightText(ctx, selected.weight)}`)),
    h('div', { class: 'l2' }, h('span', { class: 'lt' }, filingHint)));
}

// Le fichier choisi : son nom, son type et son poids ; en dessous le grisé s'il y en a un, sinon ses faits.
function fileInfo(ctx, file) {
  const { t } = ctx;
  const lock = ctx.lockOf(file);
  const second = lock ? lock.text : fileFacts(ctx, file).filter(Boolean).join(' · ');
  return h('div', { class: 'inf', 'data-fam': lock ? null : family(file) },
    infoLine1(icon(lock ? 'lock' : file.icon), h('b', null, file.name || t('ex.untitled')), h('span', { class: 'mu' }, `· ${ctx.typeLabel(file)} · ${weightText(ctx, file.weight)}`)),
    h('div', { class: 'l2' }, h('span', { class: 'lt' }, second)));
}

// À la corbeille : quand et par qui le fichier y est allé, et où il revient ; sinon : l'app qui l'ouvre, sa dernière modification et son auteur.
function fileFacts(ctx, file) {
  const { t } = ctx;
  const who = person(authorOf(file));
  const date = formatDate(stampOf(file), ctx.now, ctx.locale, t);
  const by = who.name ? t('ex.modifiedBy', { by: who.name }) : '';
  if (file.trashed) return [t('trash.deletedOn', { date }), by, file.folder ? t('trash.backTo', { folder: file.folder }) : ''];
  return [ctx.opensIn(file), file.ts === null ? '' : t('ex.modifiedOn', { date }), by];
}

// La barre de la corbeille, au-dessus de la liste : la règle (rien ne part seul) et « Vider la corbeille… ». Rien tant que la corbeille est vide.
export function trashBar(ctx) {
  const { t } = ctx;
  return h('div', { class: 'trash-bar' }, icon('trash'), h('span', { class: 'tb-text', title: t('trash.bar') }, t('trash.bar')),
    h('button', { type: 'button', class: 'btn', dataset: { emptyTrash: '' } }, t('trash.empty')));
}

// Le total du pied de fenêtre : ce que pèse ce que la liste montre, dossiers compris (`ctx.total`, en octets), et, case « + pièces jointes » cochée et lue (`ctx.pj`), les pièces jointes du document qui ne sont
// pas des fichiers de l'explorateur (js/weight.js, `otherAttachments`). Le mot « Total » est dit aux lecteurs d'écran, avec la part de chacun ; l'infobulle dit ce qui est compté.
const pjCounted = ctx => ctx.pj.on && ctx.pj.ready;
const totalSplit = ctx => ctx.t('weight.totalSplit', { list: weightText(ctx, ctx.total), pj: weightText(ctx, ctx.pj.bytes), n: ctx.pj.count });

export function totalBar(ctx) {
  const counted = pjCounted(ctx);
  const parts = [h('span', { class: 'sr-only' }, `${ctx.t('weight.total')} : `), h('b', { class: 'tot-n' }, weightText(ctx, ctx.total + (counted ? ctx.pj.bytes : 0)))];
  if (counted) parts.push(h('span', { class: 'sr-only' }, `, ${totalSplit(ctx)}`));
  return parts;
}

// L'infobulle du total, et l'état du pied de fenêtre : occupé tant que les pièces jointes se lisent.
export function totalTip(ctx) {
  const { t, pj } = ctx;
  return [t('weight.totalTip'), pjCounted(ctx) ? totalSplit(ctx) : null, pj.on && pj.busy ? t('weight.pjLoading') : null, t('weight.detailTip')].filter(Boolean).join(' ');
}

// La case « + pièces jointes » : cochée quand la personne l'a demandée ; grisée, jamais masquée, quand GFS ne peut pas lire les pièces jointes (`ctx.pj.grey` dit pourquoi : au survol, et au clic
// par le geste de js/explorer.js). `aria-disabled` et non `disabled` : une case désactivée ne répond pas au clic, et le clic est ce qui explique.
export function pjBox(refs, ctx) {
  const { pj, t } = ctx;
  refs.pj.classList.toggle('is-grey', Boolean(pj.grey));
  refs.pj.title = pj.grey || t('weight.pjTip');
  refs.pjInput.checked = pj.on;
  refs.pjInput.setAttribute('aria-disabled', String(Boolean(pj.grey)));
  refs.total.setAttribute('aria-busy', String(pj.on && pj.busy));
  refs.total.title = totalTip(ctx);
}
