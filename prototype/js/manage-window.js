// La fenêtre « Gérer les partages » (contrats 11.7, point 13, i ; maquettes du 06/11) : trois onglets — Options (la structure du document), Groupes (créer, lire d'une table, supprimer) et Catégories (un droit sur
// tous les fichiers). Un geste de propriétaire ; les autres lisent à qui le demander. Elle ne parle pas à Grist : `load()` rend l'état, les `on…` écrivent (js/manage-control.js). Sur la base commune des fenêtres
// (js/modal.js) : titre, onglets et bouton restent en place, seul le contenu défile. Un geste impossible est grisé avec sa raison, jamais masqué (charte).

import { h } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';
import { openMenu } from './menu.js';
import { CATEGORIES } from './sharing-model.js';
import { otherManageTab } from './manage-other-tab.js';
import { replaceKeepingFocus, tabList } from './tabs.js';

const TABS = Object.freeze(['options', 'groups', 'spaces', 'cats', 'other']);
const CATS = Object.freeze([{ who: CATEGORIES.editeurs, key: 'editeurs', glyph: 'edit' }, { who: CATEGORIES.tous, key: 'tous', glyph: 'globe' }]);
const RIGHTS = Object.freeze(['lecture', 'ecriture']);

const lead = (t, key) => h('p', { class: 'rt-lead' }, icon('lock'), h('span', null, t(key)));

function optionsTab(ctx) {
  const { t, state } = ctx;
  const structure = state.structure;
  const button = h('button', { type: 'button', class: 'btn', 'aria-disabled': structure && structure.kind ? null : 'true', dataset: { fk: 'manage-structure' } }, structure ? t(structure.label) : t('rights.act.close'));
  button.addEventListener('click', () => (structure && structure.kind ? void ctx.structure() : ctx.say(t(structure ? structure.why : 'rights.act.why.unreadable'))));
  return h('div', null,
    h('div', { class: 'sec' }, t('manage.options.structure')),
    h('p', { class: 'fine' }, t('manage.options.structure.text')),
    h('p', { class: 'sg-actions' }, button),
    structure && structure.kind ? h('p', { class: 'fine' }, t(structure.hint)) : null,
    h('div', { class: 'sec' }, t('manage.options.links')),
    h('p', { class: 'fine' }, t('manage.options.links.text')));
}

function groupRow(ctx, group) {
  const { t } = ctx;
  const notes = [t('manage.groups.count', { n: group.count }), group.source ? t('manage.groups.source', { table: group.source }) : null].filter(Boolean);
  const edit = group.source ? null : h('button', { type: 'button', class: 'btn sm', dataset: { fk: `manage-edit-${group.name}` } }, t('manage.groups.edit'));
  if (edit) edit.addEventListener('click', () => ctx.edit(group));
  const remove = h('button', { type: 'button', class: 'btn sm', dataset: { fk: `manage-remove-${group.name}` } }, t('manage.groups.remove'));
  remove.addEventListener('click', () => void ctx.removeGroup(group));
  return h('li', { class: 'rr', dataset: { group: group.name } }, icon('users', 'big'), h('span', { class: 'nm' }, h('b', null, group.name), h('small', null, notes.join(' · '))), edit, remove);
}

// Le formulaire d'un groupe tapé dans GFS : son nom (fixe à la modification) et ses adresses, une par ligne.
function groupForm(ctx, group) {
  const { t } = ctx;
  const name = h('input', { type: 'text', autocomplete: 'off', 'aria-label': t('manage.groups.name'), placeholder: t('manage.groups.name'), disabled: group ? true : null, dataset: { fk: 'manage-group-name' } });
  name.value = group ? group.name : '';
  const people = h('textarea', { rows: '3', 'aria-label': t('manage.groups.people'), placeholder: t('manage.groups.people'), spellcheck: 'false', dataset: { fk: 'manage-group-people' } });
  people.value = group ? group.here : '';
  const yes = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'manage-group-save' } }, group ? t('manage.groups.save') : t('manage.groups.create'));
  const no = h('button', { type: 'button', class: 'btn', dataset: { fk: 'manage-group-cancel' } }, t('share.cancel'));
  no.addEventListener('click', () => ctx.edit(null));
  yes.addEventListener('click', () => void ctx.saveGroup(group, { name: name.value, people: people.value }));
  return h('div', { class: 'sg-new' }, h('div', { class: 'field' }, icon('users'), name), h('div', { class: 'field mg-area' }, people), h('p', { class: 'fine' }, t('manage.groups.people.hint')), h('p', { class: 'sg-actions' }, no, yes));
}

function groupsTab(ctx) {
  const { t, state } = ctx;
  if (!state.active) return lead(t, 'manage.inactive');
  if (ctx.editing !== null) return h('div', null, h('div', { class: 'sec' }, t(ctx.editing ? 'manage.groups.editing' : 'manage.groups.new')), groupForm(ctx, ctx.editing || null));
  const create = h('button', { type: 'button', class: 'btn', dataset: { fk: 'manage-group-new' } }, icon('plus'), t('manage.groups.new'));
  create.addEventListener('click', () => ctx.edit(false));
  const read = h('button', { type: 'button', class: 'btn', 'aria-disabled': state.tables.length ? null : 'true', dataset: { fk: 'manage-group-read' } }, icon('table'), t('manage.read.button'));
  read.addEventListener('click', () => (state.tables.length ? void ctx.readTable() : ctx.say(t('manage.read.noTable'))));
  return h('div', null, h('p', { class: 'fine' }, t('manage.groups.lead')), h('p', { class: 'sg-actions' }, create, read),
    h('div', { class: 'sec' }, t('manage.groups.title')),
    state.groups.length ? h('ul', { class: 'rt-list sg-list' }, ...state.groups.map(group => groupRow(ctx, group))) : h('p', { class: 'rt-none' }, t('manage.groups.none')));
}

function spaceRow(ctx, space) {
  const { t } = ctx;
  const notes = [t('manage.groups.count', { n: space.people }), space.groups.length ? t('manage.spaces.groups', { n: space.groups.length }) : t('manage.spaces.noGroup')];
  const open = h('button', { type: 'button', class: 'btn sm', dataset: { fk: `manage-space-${space.key}` } }, t('manage.spaces.open'));
  open.addEventListener('click', () => ctx.openSpace(space));
  return h('li', { class: 'rr', dataset: { space: space.key } }, icon('folder', 'big'), h('span', { class: 'nm' }, h('b', null, space.name), h('small', null, notes.join(' · '))), open);
}

// Un groupe de l'espace : son rôle (un menu : lecture, écriture, retirer).
function spaceGroupRow(ctx, space, item) {
  const { t } = ctx;
  const level = h('button', { type: 'button', class: 'lvl', 'aria-haspopup': 'menu', dataset: { fk: `manage-space-group-${item.group}` } }, t(`share.right.${item.right}`), icon('chev-down'));
  level.addEventListener('click', () => openMenu(level, [
    ...RIGHTS.map(right => ({ label: t(`share.right.${right}`), icon: right === 'lecture' ? 'read' : 'edit', hint: t(`share.right.${right}.hint`), check: right === item.right, run: () => void ctx.spaceGroup(space, item.group, right) })),
    '-', { label: t('share.remove'), icon: 'x', run: () => void ctx.spaceGroup(space, item.group, null) },
  ], { host: ctx.container, align: 'right', label: item.group }));
  return h('li', { class: 'rr', dataset: { spaceGroup: item.group } }, icon('users', 'big'), h('span', { class: 'nm' }, h('b', null, item.group)), level);
}

function spaceDetail(ctx, space) {
  const { t } = ctx;
  const back = h('button', { type: 'button', class: 'btn sm', dataset: { fk: 'manage-space-back' } }, icon('chev-left'), t('work.back'));
  back.addEventListener('click', () => ctx.openSpace(null));
  const add = h('button', { type: 'button', class: 'btn', dataset: { fk: 'manage-space-add-group' } }, icon('plus'), t('manage.spaces.addGroup'));
  add.addEventListener('click', () => void ctx.addGroupTo(space));
  const remove = h('button', { type: 'button', class: 'btn', dataset: { fk: 'manage-space-remove' } }, t('manage.spaces.remove'));
  remove.addEventListener('click', () => void ctx.removeSpace(space));
  return h('div', null, h('p', { class: 'sg-actions mg-back' }, back), h('div', { class: 'sec' }, space.name), h('p', { class: 'fine' }, t('manage.spaces.detail')),
    h('p', { class: 'sg-actions' }, remove, add),
    space.groups.length ? h('ul', { class: 'rt-list sg-list' }, ...space.groups.map(item => spaceGroupRow(ctx, space, item))) : h('p', { class: 'rt-none' }, t('manage.spaces.noGroup')),
    h('p', { class: 'fine' }, t('manage.spaces.rights')));
}

function spacesTab(ctx) {
  const { t, state } = ctx;
  if (!state.active) return lead(t, 'manage.inactive');
  const open = ctx.space && state.spaces.find(item => item.key === ctx.space);
  if (open) return spaceDetail(ctx, open);
  const create = h('button', { type: 'button', class: 'btn', dataset: { fk: 'manage-space-new' } }, icon('plus'), t('manage.spaces.new'));
  create.addEventListener('click', () => void ctx.addSpace());
  return h('div', null, h('p', { class: 'fine' }, t('manage.spaces.lead')), h('p', { class: 'sg-actions' }, create), h('div', { class: 'sec' }, t('manage.spaces.title')),
    state.spaces.length ? h('ul', { class: 'rt-list sg-list' }, ...state.spaces.map(space => spaceRow(ctx, space))) : h('p', { class: 'rt-none' }, t('manage.spaces.none')));
}

function categoryRow(ctx, cat) {
  const { t, state } = ctx;
  const current = state.root[cat.who] ? state.root[cat.who].right : null;
  const label = current ? t(`share.right.${current}`) : t('manage.cats.none');
  const level = h('button', { type: 'button', class: 'lvl', 'aria-haspopup': 'menu', dataset: { fk: `manage-cat-${cat.key}` } }, label, icon('chev-down'));
  level.addEventListener('click', () => openMenu(level, [
    { label: t('manage.cats.none'), icon: 'lock', check: !current, run: () => void ctx.root(cat.who, null) },
    ...RIGHTS.map(right => ({ label: t(`share.right.${right}`), icon: right === 'lecture' ? 'read' : 'edit', hint: t(`share.right.${right}.hint`), check: right === current, run: () => void ctx.root(cat.who, right) })),
  ], { host: ctx.container, align: 'right', label: t(`share.cat.${cat.key}`) }));
  return h('li', { class: 'rr', dataset: { cat: cat.key } }, icon(cat.glyph, 'big'), h('span', { class: 'nm' }, h('b', null, t(`share.cat.${cat.key}`)), h('small', null, t(`share.cat.${cat.key}.hint`))), level);
}

function catsTab(ctx) {
  const { t, state } = ctx;
  if (!state.active) return lead(t, 'manage.inactive');
  return h('div', null, h('p', { class: 'fine' }, t('manage.cats.lead')), h('ul', { class: 'rt-list sg-list' }, ...CATS.map(cat => categoryRow(ctx, cat))), h('p', { class: 'fine' }, t('manage.cats.hint')));
}

// Le contenu d'après l'état : { owner, active, groups, rows, root, structure, tables }. Un non-propriétaire lit seulement à qui s'adresser.
export function manageBody(ctx) {
  const { t, state } = ctx;
  if (state.owner !== true) return lead(t, state.owner === false ? 'manage.other' : 'manage.unknown');
  const tabs = tabList({ keys: TABS, selected: ctx.tab, label: t('manage.title'), prefix: 'manage', text: key => t(`manage.tab.${key}`), onSelect: key => ctx.go(key) });
  const panel = { options: optionsTab, groups: groupsTab, spaces: spacesTab, cats: catsTab, other: otherManageTab }[ctx.tab](ctx);
  return h('div', { class: 'rt-content' }, tabs, h('div', { class: 'mg-panel', role: 'tabpanel', 'aria-labelledby': `manage-tab-${ctx.tab}` }, panel));
}

// opts : { container, t, inertTargets, load() → état, onAddGroup(state, { name, people }), onUpdateGroup(id, people), onRemoveGroup(id), onReadTable(state), onRoot(state, who, right), onStructure(), onConfirmRemove(name),
//   onAddSpace(state), onRemoveSpace(state, space), onSpaceGroup(state, space, group, right), onPickGroup(state, space), onLinks() → les documents reliés (js/share-links.js), onStopLink(link) → { ok, message? } (confirmé par l'appelant) }.
export function openManage(opts) {
  const { container, t } = opts;
  const body = h('div', { class: 'ask-body rt-body sh-body' }, h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('share.loading')));
  const status = h('p', { class: 'mod-note', 'aria-live': 'polite' }, t('share.foot'));
  const close = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'manage-close' } }, t('share.done'));
  const dialog = h('section', { class: 'mod pt sh mg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'manage-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'manage-title' }, t('manage.title')), h('p', { class: 'mod-count' }, t('manage.sub'))), body, h('footer', { class: 'mod-foot' }, status, close));
  const { done, result } = openModal({ container, section: dialog, inertTargets: opts.inertTargets, first: close, cancel: null });
  close.addEventListener('click', () => done(null));
  const ctx = { t, container, state: null, tab: 'options', editing: null, space: null, links: null, say: text => { status.textContent = text; } };
  const draw = () => { if (dialog.isConnected && ctx.state) replaceKeepingFocus(body, manageBody(ctx)); };
  const reload = async () => {
    try { ctx.state = await opts.load(); draw(); } catch (error) { if (dialog.isConnected) body.replaceChildren(h('p', { class: 'rt-none' }, t('manage.unreadable'))); }
  };
  const write = async job => {
    const answer = await job();
    ctx.say(answer && !answer.ok ? t('share.failed', { message: answer.message || '' }) : t('share.foot'));
    if (!answer || answer.ok) { ctx.editing = null; await reload(); }
    return answer;
  };
  ctx.readLinks = async () => {
    ctx.links = null;
    draw();
    try { ctx.links = opts.onLinks ? await opts.onLinks() : []; } catch (error) { ctx.links = false; }
    draw();
  };
  ctx.stopLink = async link => {
    const answer = await opts.onStopLink(link);
    if (!answer) return;
    ctx.say(answer.ok ? t('share.foot') : t('share.failed', { message: answer.message || '' }));
    if (answer.ok) await ctx.readLinks();
  };
  ctx.go = key => { ctx.tab = key; ctx.editing = null; ctx.space = null; draw(); if (key === 'other') void ctx.readLinks(); };
  ctx.openSpace = space => { ctx.space = space ? space.key : null; draw(); };
  ctx.addSpace = async () => { const answer = await opts.onAddSpace(ctx.state); if (answer) { ctx.say(answer.ok ? t('share.foot') : t('share.failed', { message: answer.message || '' })); if (answer.ok) await reload(); } };
  ctx.removeSpace = async space => { const answer = await opts.onRemoveSpace(ctx.state, space); if (answer && answer.ok) ctx.space = null; if (answer) { ctx.say(answer.ok ? t('share.foot') : t('share.failed', { message: answer.message || '' })); if (answer.ok) await reload(); } };
  ctx.addGroupTo = async space => { const group = await opts.onPickGroup(ctx.state, space); if (group) await write(() => opts.onSpaceGroup(ctx.state, space, group, 'lecture')); };
  ctx.spaceGroup = (space, group, right) => write(() => opts.onSpaceGroup(ctx.state, space, group, right));
  ctx.edit = group => { ctx.editing = group === null ? null : group; draw(); const field = body.querySelector('[data-fk="manage-group-name"]'); if (field) (field.disabled ? body.querySelector('[data-fk="manage-group-people"]') : field).focus({ preventScroll: true }); };
  ctx.saveGroup = (group, values) => write(() => (group ? opts.onUpdateGroup(group.id, values.people) : opts.onAddGroup(ctx.state, values)));
  ctx.removeGroup = async group => { if (await opts.onConfirmRemove(group.name)) await write(() => opts.onRemoveGroup(group.id)); };
  ctx.readTable = async () => { const answer = await opts.onReadTable(ctx.state); if (answer) { ctx.say(answer.ok ? t('share.foot') : t('share.failed', { message: answer.message || '' })); if (answer.ok) await reload(); } };
  ctx.root = (who, right) => write(() => opts.onRoot(ctx.state, who, right));
  ctx.structure = async () => { if (!(await opts.onStructure())) await reload(); };
  void reload();
  return result;
}
