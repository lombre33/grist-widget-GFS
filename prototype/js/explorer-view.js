// Le dessin de l'explorateur (maquette du 12/10, charte Grist Factory) : des fonctions qui construisent des nœuds à partir de l'état, sans
// jamais interpréter un nom de fichier comme du HTML. Les clics se lisent par délégation, d'après les attributs `data-*` posés ici.

import { h } from './dom.js';
import { icon } from './icons.js';
import { person, formatDate, pathParts } from './explorer-model.js';

export const SORT_HEADERS = [['name', 'ex.name'], ['type', 'ex.type'], ['mod', 'ex.modified'], ['by', 'ex.by']];
const FAMILIES = new Set(['doc', 'grid', 'slides']);

// Le cadre fixe : titre, bascule liste/vignettes, fil d'Ariane, recherche, filtre de type, « Nouveau », volet, liste, barre d'information.
export function buildShell(t) {
  const refs = {};
  const keep = (key, node) => { refs[key] = node; return node; };
  const toggle = (key, name, glyph) => keep(key, h('button', { type: 'button', class: 'tb', title: t(name), 'aria-label': t(name), 'aria-pressed': 'false' }, icon(glyph)));
  const root = h('section', { class: 'ex', 'aria-labelledby': 'ex-title', hidden: true },
    h('header', { class: 'ex-head' },
      h('div', { class: 'ex-title-row' },
        keep('title', h('h2', { class: 'ex-title', id: 'ex-title' }, t('ex.title'))),
        h('span', { class: 'grow' }),
        h('div', { class: 'tb-group', role: 'group', 'aria-label': t('ex.display') }, toggle('viewList', 'ex.list', 'list'), toggle('viewTiles', 'ex.tiles', 'tiles'))),
      h('div', { class: 'ex-nav-row' },
        keep('crumbs', h('nav', { class: 'crumbs', 'aria-label': t('ex.path') })),
        h('label', { class: 'inp-search' }, icon('search'),
          keep('search', h('input', { type: 'search', placeholder: t('ex.search'), 'aria-label': t('ex.searchLabel'), autocomplete: 'off' }))),
        keep('typeBtn', h('button', { type: 'button', class: 'btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: t('ex.typeFilter') })),
        keep('newBtn', h('button', { type: 'button', class: 'btn primary', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('plus'), t('ex.new'))))),
    keep('notices', h('div', { class: 'ex-notices' })),
    h('div', { class: 'ex-body' },
      keep('tree', h('nav', { class: 'ex-tree', 'aria-label': t('ex.folders') })),
      h('div', { class: 'ex-main' }, keep('scroll', h('div', { class: 'ex-scroll' },
        keep('list', h('div', { class: 'ex-list', role: 'grid', 'aria-label': t('ex.title') })),
        keep('empty', h('div', { class: 'empty', hidden: true })))))),
    h('footer', { class: 'ex-foot' },
      keep('info', h('div', { class: 'ex-info', 'aria-live': 'polite' })),
      keep('openBtn', h('button', { type: 'button', class: 'btn' }, t('ex.open'))),
      keep('closeBtn', h('button', { type: 'button', class: 'btn' }, t('ex.close')))));
  return { root, refs };
}

const family = file => (FAMILIES.has(file.family) ? file.family : null);

// Le fil d'Ariane : la racine (« Moi »), puis les dossiers ; « Résultats » quand une recherche ou un filtre est en cours.
export function crumbs(ctx) {
  const { t, state } = ctx;
  const sep = () => h('span', { class: 'sp' }, icon('chev-right'));
  const link = (path, name) => h('button', { type: 'button', dataset: { path } }, name);
  // Récents et Favoris gardent le chemin du retour à « Moi » : en vue étroite, le volet des dossiers est replié.
  if (state.view === 'recent') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('clock'), t('ex.recent'))];
  if (state.view === 'fav') return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, icon('pin'), t('ex.fav'))];
  if (ctx.filtering) return [link('', t('ex.me')), sep(), h('span', { class: 'here' }, t('ex.results'))];
  const parts = pathParts(state.path);
  if (!parts.length) return [h('span', { class: 'here' }, icon('user'), t('ex.me'))];
  const last = parts.length - 1;
  return [link('', t('ex.me')), ...parts.flatMap((part, i) => [sep(), i === last ? h('span', { class: 'here' }, part.name) : link(part.path, part.name)])];
}

function treeRow({ label, glyph, data, current, depth = 0, caret = null, toggle = null, count = null }) {
  return h('button', { type: 'button', class: 'tr-row', dataset: data, 'aria-current': String(Boolean(current)), vars: { '--d': depth } },
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
    h('hr', { class: 'tr-sep' }));
  const rows = ctx.treeRows.map(row => h('div', { class: 'tr-folder' }, treeRow({
    label: row.name, glyph: 'folder', data: { path: row.path }, current: inFolders && state.path === row.path, depth: row.depth + 1,
    caret: row.hasChildren ? (row.open ? 'open' : 'closed') : null, toggle: row.hasChildren ? row.path : null,
  })));
  return [pinned, h('div', { class: 'tr-folder' }, treeRow({ label: t('ex.me'), glyph: 'user', data: { path: '' }, current: inFolders && state.path === '' })), ...rows];
}

export function listHead(ctx) {
  const { t, sort } = ctx;
  return h('div', { class: 'ls-head', role: 'row' }, ...SORT_HEADERS.map(([key, text]) => h('button', {
    type: 'button', class: 'hd', role: 'columnheader', dataset: { sort: key }, 'aria-sort': sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : null,
  }, t(text))), h('span'));
}

function fileCells(ctx, file, flat) {
  const { t } = ctx;
  const lock = ctx.lockOf(file);
  const who = person(file.by);
  const name = file.name || t('ex.untitled');
  const pinTitle = file.pinned ? t('ex.unpin') : t('ex.pin');
  return [
    h('div', { class: 'nm', role: 'gridcell' }, icon(lock ? 'lock' : file.icon), h('span', { class: 't' }, name),
      flat && file.folder ? h('span', { class: 'hint' }, file.folder.split('/').pop()) : null,
      lock ? h('span', { class: 'sr-only' }, `, ${lock.text}`) : null),
    h('div', { class: 'ty', role: 'gridcell' }, h('span', { class: 'pill' }, ctx.typeLabel(file))),
    h('div', { class: 'md', role: 'gridcell' }, formatDate(file.ts, ctx.now, ctx.locale, t)),
    h('div', { class: 'by', role: 'gridcell' }, who.initials ? h('span', { class: 'who', title: who.name }, who.initials) : null),
    h('div', { class: 'acts', role: 'gridcell' },
      h('button', { type: 'button', class: `rb pin${file.pinned ? ' on' : ''}`, dataset: { pin: file.key }, title: pinTitle, 'aria-label': pinTitle, 'aria-pressed': String(file.pinned), 'aria-disabled': 'true' }, icon('pin')),
      h('button', { type: 'button', class: 'rb mn', dataset: { menu: file.key }, title: t('ex.more'), 'aria-label': t('ex.more'), 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'))),
  ];
}

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
    h('div', { class: 'nm', role: 'gridcell' }, icon('folder', 'fld'), h('span', { class: 't' }, folder.name)),
    h('div', { class: 'ty', role: 'gridcell' }, h('span', { class: 'pill' }, t('ex.fileCount', { n: folder.count }))),
    h('div', { class: 'md', role: 'gridcell' }, formatDate(folder.ts, ctx.now, ctx.locale, t)),
    h('div', { class: 'by', role: 'gridcell' }),
    h('div', { class: 'acts', role: 'gridcell' }));
}

export function tile(ctx, row) {
  const { t } = ctx;
  const folder = row.kind === 'folder';
  const file = row.file;
  const key = folder ? `dir:${row.path}` : file.key;
  const lock = folder ? null : ctx.lockOf(file);
  const glyph = folder ? 'folder' : (lock ? 'lock' : file.icon);
  return h('div', {
    class: `th${folder ? ' folder' : ''}${lock ? ' lk' : ''}`, role: 'row', tabindex: ctx.state.sel === key ? '0' : '-1', dataset: { key },
    'aria-selected': String(ctx.state.sel === key), 'data-fam': folder || lock ? null : family(file), title: lock ? lock.text : null,
  },
  h('div', { class: 'th-pv' }, icon(glyph, folder ? 'fld' : '')),
  h('span', { class: 'tn' }, folder ? row.name : (file.name || t('ex.untitled'))),
  h('div', { class: 'tt' }, icon(folder ? 'folder' : glyph), folder ? t('ex.fileCount', { n: row.count }) : ctx.typeLabel(file)));
}

// Le message d'une liste vide : jamais une page blanche.
export function emptyMessage(ctx) {
  const { t, state } = ctx;
  if (ctx.filtering) return t('ex.emptySearch');
  if (state.view === 'fav') return t('ex.emptyFav');
  if (state.view === 'recent' || ctx.totalFiles === 0) return t('ex.emptyAll');
  return t('ex.emptyFolder');
}

const infoLine1 = (...nodes) => h('div', { class: 'l1' }, ...nodes);

// La barre d'information : le fichier choisi (l'app qui l'ouvre, la date, le grisé), sinon un rappel du rangement.
export function infoBar(ctx) {
  const { t, selected } = ctx;
  if (!selected) {
    return h('div', { class: 'inf' }, infoLine1(icon('info'), h('span', { class: 'mu' }, ctx.state.view === 'folder' ? t('ex.hintPersonal') : t('ex.hintSelect'))),
      h('div', { class: 'l2' }, icon('pin'), h('span', { class: 'lt' }, t('ex.hintFav'))));
  }
  if (selected.kind === 'folder') {
    return h('div', { class: 'inf' }, infoLine1(icon('folder'), h('b', null, selected.name), h('span', { class: 'mu' }, `· ${t('ex.fileCount', { n: selected.count })}`)),
      h('div', { class: 'l2' }, h('span', { class: 'lt' }, t('ex.hintPersonal'))));
  }
  const { file } = selected;
  const lock = ctx.lockOf(file);
  const who = person(file.by);
  const when = file.ts === null ? '' : t('ex.modifiedOn', { date: formatDate(file.ts, ctx.now, ctx.locale, t) });
  const second = lock ? lock.text : [t('ex.opensIn', { app: ctx.appName(file.app) }), when, who.name ? t('ex.modifiedBy', { by: who.name }) : ''].filter(Boolean).join(' · ');
  return h('div', { class: 'inf', 'data-fam': lock ? null : family(file) },
    infoLine1(icon(lock ? 'lock' : file.icon), h('b', null, file.name || t('ex.untitled')), h('span', { class: 'mu' }, `· ${ctx.typeLabel(file)}`)),
    h('div', { class: 'l2' }, h('span', { class: 'lt' }, second)));
}
