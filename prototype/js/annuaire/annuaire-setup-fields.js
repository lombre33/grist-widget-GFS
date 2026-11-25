// L'onglet « Champs de la fiche » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11 ; fenêtre « Champs de la fiche » de la maquette) : une
// ligne par champ (nom, type, « Colonne » : une colonne de la liste, « Liste » : ses valeurs en pastilles dans la liste et les cartes, « Filtre » : ses valeurs
// en filtres, les mêmes dans la liste, les cartes et les organigrammes ; l'adresse et le téléphone ont leur ligne, avec « Colonne » seulement), les
// colonnes que GFS propose d'ajouter, et un bouton pour en chercher une autre. Un champ est une colonne de la table des personnes qui existe déjà : GFS n'en
// crée aucune (additif seulement, jamais sans l'accord de la personne). Le responsable direct et les autres relations ont leur onglet
// (js/annuaire/annuaire-setup-
// relations.js) : leurs colonnes ne se proposent pas ici. `host` : voir js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { columnAt } from './annuaire-schema.js';
import { FIELD_SEPARATOR, FIXED_COLUMNS, fieldPath } from './annuaire-config.js';
import { switchButton, iconButton, shift, typeLabel, FILTERABLE, GLYPHS } from './annuaire-setup-shared.js';
import { pickPath } from './annuaire-setup-path.js';

const SUGGESTED = 6;
// l'ordre des suggestions : ce qui donne un filtre d'abord
const KINDS = Object.freeze(['choice', 'choicelist', 'bool', 'date', 'ref', 'reflist', 'text', 'number']);

// Les colonnes que GFS lit déjà par un nom ou que les niveaux suivent : elles ne se proposent pas en champ.
function takenColumns(config) {
  const taken = new Set(['name', 'first', 'title', 'email', 'phone', 'lead', 'manager'].map(key => config[key]).filter(Boolean));
  for (const level of config.levels) if (level.path[0]) taken.add(level.path[0]);
  for (const rel of config.relations) if (rel.col) taken.add(rel.col);
  for (const field of config.fields) taken.add(field.col);
  for (const col of [config.leave, config.presence.col]) if (col) taken.add(col); // les colonnes des options (départ, présence) ne se proposent pas en champ
  return taken;
}

// Les suggestions : les colonnes libres, celles qui donnent un filtre d'abord.
function suggestions(host) {
  const { schema, draft, t } = host;
  const cols = (schema[draft.table] ? schema[draft.table].columns : []).filter(col => col.genre !== 'file');
  const taken = takenColumns(draft.config);
  const free = cols.filter(col => !taken.has(col.id)).sort((a, b) => KINDS.indexOf(a.genre) - KINDS.indexOf(b.genre)).slice(0, SUGGESTED);
  return [...free.map(col => h('button', { type: 'button', class: 'an-sug', title: typeLabel(col, draft.table, t),
    dataset: { act: 'sug', col: col.id, fk: `sug:${col.id}` } }, icon('plus'), col.id))];
}

function head(t) {
  return h('div', { class: 'an-frow is-head' }, h('span', null, t('an.fld.col.field')), h('span', { class: 'an-f-type' }, t('an.fld.col.type')),
    h('span', { class: 'an-f-sw' }, t('an.fld.col.column')), h('span', { class: 'an-f-sw' }, t('an.fld.col.list')),
      h('span', { class: 'an-f-sw' }, t('an.fld.col.filter')),
    h('span', { class: 'an-f-acts' }));
}

// Une ligne verrouillée (les colonnes que GFS lit par un nom) : ses interrupteurs sont grisés, la raison au survol.
function lockedRow(t, { glyph, name, type, listOn, why }) {
  const sw = (fk, on) => switchButton({ on, label: why, fk, data: {}, disabled: true, title: why });
  return h('div', { class: 'an-frow is-locked' }, h('span', { class: 'an-f-name' }, icon(glyph), name), h('span', { class: 'an-f-type' }, type),
    h('span', { class: 'an-f-sw' }, sw(`lk-c:${name}`, false)), h('span', { class: 'an-f-sw' }, sw(`lk-l:${name}`, listOn)),
      h('span', { class: 'an-f-sw' }, sw(`lk-f:${name}`, false)),
    h('span', { class: 'an-f-acts' }));
}

// L'adresse et le téléphone, quand la personne les a réglés : la liste les montre toujours dans la fiche ; seul « Colonne » se règle (il en fait une colonne de
// la liste).
function fixedRow(host, key) {
  const { t, draft } = host;
  const label = t(key === 'email' ? 'an.mail' : 'an.phone');
  const sw = (fk, on) => switchButton({ on, label: `${label} · ${t('an.fld.col.list')}`, fk, data: {}, disabled: true, title: t('an.fld.fixedWhy') });
  return h('div', { class: 'an-frow is-locked' }, h('span', { class: 'an-f-name' }, icon(key === 'email' ? 'mail' : 'phone'), label),
    h('span', { class: 'an-f-type' }, t('an.fld.fixed')),
    h('span', { class: 'an-f-sw' }, switchButton({ on: draft.config.columns.includes(key), label: `${label} · ${t('an.fld.col.column')}`, fk: `fc:${key}`,
      data: { act: 'fix-column', key } })),
    h('span', { class: 'an-f-sw' }, sw(`lk-l:${key}`, false)), h('span', { class: 'an-f-sw' }, sw(`lk-f:${key}`, false)), h('span', { class: 'an-f-acts' }));
}

function fieldRow(host, field, at) {
  const { t, draft, schema } = host;
  const col = columnAt(schema, draft.table, fieldPath(field));
  const can = col ? FILTERABLE.includes(col.genre) : false;
  const name = h('span', { class: 'an-f-name', title: col ? '' : t('an.fld.absent') }, icon(GLYPHS[col ? col.genre : ''] || 'table'), field.col);
  const last = draft.config.fields.length - 1;
  return h('div', { class: 'an-frow' }, name, h('span', { class: 'an-f-type' }, typeLabel(col, draft.table, t)),
    h('span', { class: 'an-f-sw' }, switchButton({ on: field.column, label: `${field.col} · ${t('an.fld.col.column')}`, fk: `fk:${at}`,
      data: { act: 'fld-column', index: String(at) } })),
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
  const columns = config.fields.filter(field => field.column).length + config.columns.length;
  const rows = [lockedRow(t, { glyph: 'lock', name: t('an.fld.fixedName'), type: t('an.fld.fixed'), listOn: true, why: t('an.fld.fixedWhy') }),
    ...FIXED_COLUMNS.filter(key => config[key]).map(key => fixedRow(host, key))];
  rows.push(...config.fields.map((field, at) => fieldRow(host, field, at)));
  const sugs = table ? suggestions(host) : [];
  return h('div', { class: 'an-tabpanel' }, h('div', { class: 'an-lab-row' }, h('span', { class: 'an-lab' }, t('an.set.fields')),
    h('span', { class: 'an-set-hint' }, t('an.fld.count', { n: config.fields.length, c: columns, f: filters }))),
  h('p', { class: 'an-set-help' }, t('an.set.fieldsHelp')), h('div', { class: 'an-ftable' }, head(t), ...rows),
  sugs.length ? h('div', { class: 'an-sugs' }, h('span', { class: 'an-lab' }, t('an.fld.suggestions')), h('div', { class: 'an-sug-row' }, ...sugs)) : null,
  h('button', { type: 'button', class: 'btn sm', 'aria-disabled': table ? null : 'true', title: table ? null : t('an.set.needTable'),
    dataset: { act: 'field-add', fk: 'field-add' } },
    icon('plus'), t('an.set.addField')));
}

// ---------- les gestes ----------

const ACTS = Object.freeze({
  'fld-column': (host, data) => { const field = host.draft.config.fields[Number(data.index)]; field.column = !field.column; host.repaint(); },
  'fix-column': (host, data) => {
    const { columns } = host.draft.config;
    const at = columns.indexOf(data.key);
    if (at < 0) columns.push(data.key); else columns.splice(at, 1);
    host.repaint();
  },
  'fld-list': (host, data) => { const field = host.draft.config.fields[Number(data.index)]; field.list = !field.list; host.repaint(); },
  'fld-filter': (host, data) => { const field = host.draft.config.fields[Number(data.index)]; field.filter = !field.filter; host.repaint(); },
  'fld-up': (host, data) => reorder(host, Number(data.index), -1),
  'fld-down': (host, data) => reorder(host, Number(data.index), 1),
  'fld-remove': (host, data) => { host.draft.config.fields.splice(Number(data.index), 1); host.repaint(); },
  sug: (host, data) => { addField(host, [data.col]); },
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

// Un champ nouveau : le chemin de ses colonnes depuis la personne ; un champ déjà là n'est pas ajouté deux fois (le focus va à sa ligne).
function addField(host, path) {
  const col = columnAt(host.schema, host.draft.table, path);
  if (!col) return;
  const key = path.join(FIELD_SEPARATOR);
  const { fields } = host.draft.config;
  const known = fields.findIndex(field => field.col === key);
  if (known < 0) fields.push({ col: key, path: path.length > 1 ? path : [], filter: FILTERABLE.includes(col.genre), list: false, column: false });
  host.repaint();
  host.focus(`fl:${known < 0 ? fields.length - 1 : known}`);
}

// Un champ : la colonne d'une table liée se cherche d'un coup ou se suit pas à pas, et une colonne peut se créer (js/annuaire/annuaire-setup-path.js). Les
// colonnes que GFS lit déjà par un nom (et celles des niveaux et des relations) ne se proposent pas dans la table des personnes.
async function pickField(host) {
  const { t, draft } = host;
  const taken = takenColumns(draft.config);
  const kinds = [['Text', 'an.type.text'], ['Choice', 'an.type.choice'], ['ChoiceList', 'an.type.choicelist'], ['Bool', 'an.type.bool'],
    ['Date', 'an.type.date'],
    ['Numeric', 'an.type.number']];
  const path = await pickPath(host, { title: t('an.set.pickField'), text: t('an.set.pickFieldText'),
    types: kinds.map(([type, key]) => ({ type, label: t(key) })),
    filter: (col, followed) => followed.length > 0 || !taken.has(col.id) });
  if (path !== null) addField(host, path);
}
