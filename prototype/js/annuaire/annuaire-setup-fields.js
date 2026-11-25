// L'onglet « Champs de la fiche » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11 ; fenêtre « Champs de la fiche » de la maquette) : une
// ligne par champ (nom, type, « Liste » : ses valeurs en pastilles dans la liste et les cartes, « Filtre » : ses valeurs en filtres au-dessus de la liste), les
// colonnes que GFS propose d'ajouter, et un bouton pour en chercher une autre. Un champ est une colonne de la table des personnes qui existe déjà : GFS n'en
// crée aucune (additif seulement, jamais sans l'accord de la personne). Le responsable direct y a sa ligne : il donne l'organigramme des responsables. `host` :
// voir js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { columnOf } from './annuaire-schema.js';
import { columnItems, switchButton, iconButton, shift, typeLabel, FILTERABLE, GLYPHS } from './annuaire-setup-shared.js';

const SUGGESTED = 6;
// l'ordre des suggestions : ce qui donne un filtre d'abord
const KINDS = Object.freeze(['choice', 'choicelist', 'bool', 'date', 'ref', 'reflist', 'text', 'number']);

// Les colonnes que GFS lit déjà par un nom ou que les niveaux suivent : elles ne se proposent pas en champ.
function takenColumns(config) {
  const taken = new Set(['name', 'first', 'title', 'email', 'phone', 'lead', 'manager'].map(key => config[key]).filter(Boolean));
  for (const level of config.levels) if (level.path[0]) taken.add(level.path[0]);
  for (const field of config.fields) taken.add(field.col);
  return taken;
}

const isPerson = (col, table) => col.genre === 'ref' && col.ref === table;

// Les suggestions : « Responsable direct » (quand une colonne désigne une autre ligne de la même table), puis les colonnes libres, celles qui donnent un filtre
// d'abord.
function suggestions(host) {
  const { schema, draft, t } = host;
  const cols = (schema[draft.table] ? schema[draft.table].columns : []).filter(col => col.genre !== 'file');
  const taken = takenColumns(draft.config);
  const free = cols.filter(col => !taken.has(col.id)).sort((a, b) => KINDS.indexOf(a.genre) - KINDS.indexOf(b.genre)).slice(0, SUGGESTED);
  const manager = !draft.config.manager && cols.some(col => isPerson(col, draft.table))
    ? [h('button', { type: 'button', class: 'an-sug', dataset: { act: 'sug-manager', fk: 'sug-manager' } }, icon('plus'), t('an.fld.managerSug'))] : [];
  return [...manager, ...free.map(col => h('button', { type: 'button', class: 'an-sug', title: typeLabel(col, draft.table, t),
    dataset: { act: 'sug', col: col.id, fk: `sug:${col.id}` } }, icon('plus'), col.id))];
}

function head(t) {
  return h('div', { class: 'an-frow is-head' }, h('span', null, t('an.fld.col.field')), h('span', { class: 'an-f-type' }, t('an.fld.col.type')),
    h('span', { class: 'an-f-sw' }, t('an.fld.col.list')), h('span', { class: 'an-f-sw' }, t('an.fld.col.filter')), h('span', { class: 'an-f-acts' }));
}

// Une ligne verrouillée (les colonnes que GFS lit par un nom, le responsable direct) : ses interrupteurs sont grisés, la raison au survol.
function lockedRow(t, { glyph, name, type, listOn, why, extra }) {
  const sw = (fk, on) => switchButton({ on, label: why, fk, data: {}, disabled: true, title: why });
  return h('div', { class: 'an-frow is-locked' }, h('span', { class: 'an-f-name' }, icon(glyph), name), h('span', { class: 'an-f-type' }, type),
    h('span', { class: 'an-f-sw' }, sw(`lk-l:${name}`, listOn)), h('span', { class: 'an-f-sw' }, sw(`lk-f:${name}`, false)),
      h('span', { class: 'an-f-acts' }, extra || null));
}

function fieldRow(host, field, at) {
  const { t, draft, schema } = host;
  const col = columnOf(schema, draft.table, field.col);
  const can = col ? FILTERABLE.includes(col.genre) : false;
  const name = h('span', { class: 'an-f-name', title: col ? '' : t('an.fld.absent') }, icon(GLYPHS[col ? col.genre : ''] || 'table'), field.col);
  const last = draft.config.fields.length - 1;
  return h('div', { class: 'an-frow' }, name, h('span', { class: 'an-f-type' }, typeLabel(col, draft.table, t)),
    h('span', { class: 'an-f-sw' }, switchButton({ on: field.list, label: `${field.col} · ${t('an.fld.col.list')}`, fk: `fl:${at}`,
      data: { act: 'fld-list', index: String(at) } })),
    h('span', { class: 'an-f-sw' }, switchButton({ on: can && field.filter, label: `${field.col} · ${t('an.fld.col.filter')}`, fk: `ff:${at}`,
      data: { act: 'fld-filter', index: String(at) },
      disabled: !can, title: can ? '' : t('an.set.noFilter') })),
    h('span', { class: 'an-f-acts' }, iconButton(t, { glyph: 'chev-up', label: t('an.set.up'), fk: `fu:${at}`, data: { act: 'fld-up', index: String(at) },
      disabled: at === 0 }),
      iconButton(t, { glyph: 'chev-down', label: t('an.set.down'), fk: `fd:${at}`, data: { act: 'fld-down', index: String(at) }, disabled: at === last }),
      iconButton(t, { glyph: 'trash', label: t('an.set.remove'), fk: `fr:${at}`, data: { act: 'fld-remove', index: String(at) } })));
}

export function fieldsTab(host) {
  const { t, draft } = host;
  const { config, table } = draft;
  const filters = config.fields.filter(field => field.filter).length;
  const rows = [lockedRow(t, { glyph: 'lock', name: t('an.fld.fixedName'), type: t('an.fld.fixed'), listOn: true, why: t('an.fld.fixedWhy') })];
  if (config.manager) rows.push(lockedRow(t, { glyph: 'org', name: config.manager, type: t('an.type.person'), listOn: false, why: t('an.fld.managerWhy'),
    extra: iconButton(t, { glyph: 'trash', label: t('an.set.remove'), fk: 'mgr-remove', data: { act: 'mgr-remove' } }) }));
  rows.push(...config.fields.map((field, at) => fieldRow(host, field, at)));
  const sugs = table ? suggestions(host) : [];
  return h('div', { class: 'an-tabpanel' }, h('div', { class: 'an-lab-row' }, h('span', { class: 'an-lab' }, t('an.set.fields')),
    h('span', { class: 'an-set-hint' }, t('an.fld.count', { n: config.fields.length, f: filters }))),
  h('p', { class: 'an-set-help' }, t('an.set.fieldsHelp')), h('div', { class: 'an-ftable' }, head(t), ...rows),
  sugs.length ? h('div', { class: 'an-sugs' }, h('span', { class: 'an-lab' }, t('an.fld.suggestions')), h('div', { class: 'an-sug-row' }, ...sugs)) : null,
  h('button', { type: 'button', class: 'btn sm', 'aria-disabled': table ? null : 'true', title: table ? null : t('an.set.needTable'),
    dataset: { act: 'field-add', fk: 'field-add' } },
    icon('plus'), t('an.set.addField')));
}

// ---------- les gestes ----------

const ACTS = Object.freeze({
  'fld-list': (host, data) => { const field = host.draft.config.fields[Number(data.index)]; field.list = !field.list; host.repaint(); },
  'fld-filter': (host, data) => { const field = host.draft.config.fields[Number(data.index)]; field.filter = !field.filter; host.repaint(); },
  'fld-up': (host, data) => reorder(host, Number(data.index), -1),
  'fld-down': (host, data) => reorder(host, Number(data.index), 1),
  'fld-remove': (host, data) => { host.draft.config.fields.splice(Number(data.index), 1); host.repaint(); },
  'mgr-remove': host => { host.draft.config.manager = ''; host.repaint(); },
  sug: (host, data) => { addField(host, data.col); },
  'sug-manager': host => void pickManager(host),
  'field-add': host => void pickField(host),
});

function reorder(host, at, by) {
  if (!shift(host.draft.config.fields, at, by)) return;
  host.repaint();
  host.focus(`${by < 0 ? 'fu' : 'fd'}:${at + by}`, `fr:${at + by}`);
}

// Rend true quand le geste est de cet onglet.
export function fieldsAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}

function addField(host, colId) {
  const col = columnOf(host.schema, host.draft.table, colId);
  if (!col) return;
  host.draft.config.fields.push({ col: colId, filter: FILTERABLE.includes(col.genre), list: false });
  host.repaint();
  host.focus(`fl:${host.draft.config.fields.length - 1}`);
}

async function pickField(host) {
  const { t, draft } = host;
  const taken = takenColumns(draft.config);
  const items = columnItems(host.schema, draft.table, t, { follow: false }).filter(item => !taken.has(item.label));
  const chosen = await host.list({ title: t('an.set.pickField'), text: t('an.set.pickFieldText'), items, none: t('an.set.noColumn') });
  if (chosen !== null) addField(host, chosen.slice(4));
}

// Le responsable direct : une colonne qui désigne une autre ligne de la même table.
async function pickManager(host) {
  const { t, draft } = host;
  const items = columnItems(host.schema, draft.table, t, { follow: false }).filter(item => {
    const col = columnOf(host.schema, draft.table, item.label);
    return col && isPerson(col, draft.table);
  });
  const chosen = await host.list({ title: t('an.set.manager'), text: t('an.set.managerHint'), items, none: t('an.set.noManagerColumn') });
  if (chosen === null) return;
  draft.config.manager = chosen.slice(4);
  draft.config.fields = draft.config.fields.filter(field => field.col !== draft.config.manager);
  host.repaint();
}
