// L'onglet « Relations » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11 : assistant·e, référent·e, suppléant·e et les autres, avec
// leurs règles ; choix du porteur : un quatrième onglet, trois modèles prêts, une petite ligne sur la carte de l'organigramme). Une relation est une colonne de
// la table des personnes qui en désigne une autre : GFS n'en crée aucune (additif seulement, jamais sans l'accord de la personne), la personne choisit celle
// qui existe. Une relation se crée en trois temps, comme un niveau : son nom, sa colonne (orange tant qu'elle manque), puis ses règles (le sens inverse, la
// ligne sur la carte). Le responsable direct est la première relation, quand il y en a un : il donne l'organigramme des responsables. `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { TEMPLATES } from './annuaire-relations.js';
import { columnOf } from './annuaire-schema.js';
import { columnItem, formRow, switchButton, iconButton, shift, typeLabel } from './annuaire-setup-shared.js';

// Les colonnes qui peuvent porter une relation : celles de la table des personnes qui désignent une personne (une référence, ou une liste de références, vers
// cette même table), sauf celles que le responsable direct ou une autre relation lisent déjà (`keep` : la colonne qu'on est en train de changer).
function relationColumns(host, keep) {
  const { schema, draft, t } = host;
  const taken = new Set([draft.config.manager, ...draft.config.relations.map(rel => rel.col)].filter(Boolean));
  taken.delete(keep);
  return (schema[draft.table] ? schema[draft.table].columns : []).filter(col => (col.genre === 'ref' || col.genre === 'reflist') && col.ref === draft.table &&
    !taken.has(col.id)).map(col => columnItem(col, typeLabel(col, draft.table, t)));
}

// Le fil d'une colonne choisie : « Personnes › Assistant » et ce qu'elle désigne (une personne, ou plusieurs).
function source(host, colId, at, act) {
  const { t, draft } = host;
  const col = columnOf(host.schema, draft.table, colId);
  return colId
    ? h('button', { type: 'button', class: 'an-lv-path', title: t('an.lv.change'),
      dataset: { act, index: String(at), fk: act === 'pick-manager' ? 'mp' : `rp:${at}` } },
      h('span', null, draft.table), icon('chev-right'), h('b', null, colId), h('span', { class: 'an-rel-kind' }, typeLabel(col, draft.table, t)))
    : h('button', { type: 'button', class: 'an-lv-todo', dataset: { act, index: String(at), fk: act === 'pick-manager' ? 'mp' : `rp:${at}` } },
      icon('warning'), t('an.lv.todo'));
}

// La carte du responsable direct : son nom est fixe, sa colonne se change, et on peut le retirer.
function managerCard(host) {
  const { t, draft } = host;
  return h('div', { class: 'an-lvrow an-relrow' },
    h('div', { class: 'an-lv-top' }, h('span', { class: 'an-rel-fixed' }, t('an.rel.manager')),
      h('span', { class: 'an-lv-acts' }, iconButton(t, { glyph: 'trash', label: t('an.set.remove'), fk: 'mgr-remove', data: { act: 'mgr-remove' } }))),
    h('div', { class: 'an-lv-src' }, source(host, draft.config.manager, 0, 'pick-manager')),
    h('p', { class: 'an-set-hint an-rel-note' }, t('an.rel.managerNote')));
}

// La carte d'une relation : son nom, sa colonne, puis ses règles (le sens inverse, la ligne sur la carte de l'organigramme).
function relationCard(host, rel, at) {
  const { t, draft } = host;
  const last = draft.config.relations.length - 1;
  const index = String(at);
  const input = (value, kind, fk, label, placeholder, cls) => h('input', { type: 'text', class: cls, value, placeholder, 'aria-label': label,
    autocomplete: 'off',
    dataset: { fk, input: kind, index } });
  const acts = h('span', { class: 'an-lv-acts' },
    iconButton(t, { glyph: 'chev-up', label: t('an.set.up'), fk: `ru:${at}`, data: { act: 'rel-up', index }, disabled: at === 0 }),
    iconButton(t, { glyph: 'chev-down', label: t('an.set.down'), fk: `rd:${at}`, data: { act: 'rel-down', index }, disabled: at === last }),
    iconButton(t, { glyph: 'trash', label: t('an.set.remove'), fk: `rr:${at}`, data: { act: 'rel-remove', index } }));
  const rules = h('div', { class: 'an-rel-rules' },
    h('label', { class: 'an-rel-inv' }, h('span', { class: 'an-set-hint' }, t('an.rel.inverse')),
      input(rel.inverse, 'rel-inverse', `ri:${at}`, t('an.rel.inverse'), t('an.rel.inversePlaceholder'), 'an-lv-name')),
    h('span', { class: 'an-rel-card' }, h('span', { class: 'an-set-hint' }, t('an.rel.card')),
      switchButton({ on: rel.card, label: `${rel.label || rel.col} · ${t('an.rel.card')}`, fk: `rc:${at}`, data: { act: 'rel-card', index } })));
  return h('div', { class: `an-lvrow an-relrow${rel.col ? '' : ' is-todo'}` },
    h('div', { class: 'an-lv-top' }, input(rel.label, 'rel-label', `rl:${at}`, t('an.rel.nameLabel'), t('an.rel.namePlaceholder'), 'an-lv-name'), acts),
    h('div', { class: 'an-lv-src' }, source(host, rel.col, at, 'pick-relation')), rules);
}

export function relationsTab(host) {
  const { t, draft } = host;
  const { config, table } = draft;
  const none = table ? {} : { 'aria-disabled': 'true', title: t('an.set.needTable') };
  const chip = (key, label) => h('button', { type: 'button', class: 'an-sug', ...none, dataset: { act: 'rel-add', template: key, fk: `rt:${key}` } },
    icon('plus'), label);
  const cards = [...(config.manager ? [managerCard(host)] : []), ...config.relations.map((rel, at) => relationCard(host, rel, at))];
  const lonely = config.relations.some(rel => rel.card) && !config.manager;
  return h('div', { class: 'an-tabpanel' }, h('div', { class: 'an-lab-row' }, h('span', { class: 'an-lab' }, t('an.rel.title')),
    h('span', { class: 'an-set-hint' }, t('an.rel.count', { n: cards.length }))),
  h('p', { class: 'an-set-help' }, t('an.rel.help')),
  cards.length ? h('div', { class: 'an-lvl-list' }, ...cards) : h('p', { class: 'an-set-hint' }, t('an.rel.empty')),
  lonely ? h('p', { class: 'an-set-why' }, icon('info'), t('an.rel.cardNoManager')) : null,
  h('div', { class: 'an-sugs' }, h('span', { class: 'an-lab' }, t('an.rel.add')),
    h('div', { class: 'an-sug-row' }, ...(config.manager ? [] : [chip('manager', t('an.rel.manager'))]),
      ...TEMPLATES.map(key => chip(key, t(`an.rel.tpl.${key}`))), chip('other', t('an.rel.other')))));
}

// ---------- les gestes ----------

const atOf = data => Number(data.index);

const ACTS = Object.freeze({
  'rel-add': (host, data) => void addRelation(host, data.template),
  'pick-relation': (host, data) => void pickColumn(host, host.draft.config.relations[atOf(data)]),
  'pick-manager': host => void pickColumn(host, null),
  'rel-card': (host, data) => { const rel = host.draft.config.relations[atOf(data)]; rel.card = !rel.card; host.repaint(); },
  'rel-up': (host, data) => move(host, atOf(data), -1),
  'rel-down': (host, data) => move(host, atOf(data), 1),
  'rel-remove': (host, data) => { host.draft.config.relations.splice(atOf(data), 1); host.repaint(); },
  'mgr-remove': host => { host.draft.config.manager = ''; host.repaint(); },
});

function move(host, at, by) {
  if (!shift(host.draft.config.relations, at, by)) return;
  host.repaint();
  host.focus(`${by < 0 ? 'ru' : 'rd'}:${at + by}`, `rl:${at + by}`);
}

// Rend true quand le geste est de cet onglet.
export function relationsAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}

// Le nom ou le sens inverse qu'on tape : l'état suit, sans redessiner (le curseur reste là).
export function relationInput(host, input) {
  const rel = host.draft.config.relations[Number(input.dataset.index)];
  if (rel) rel[input.dataset.input === 'rel-inverse' ? 'inverse' : 'label'] = input.value;
}

// La colonne d'une relation (ou, sans relation, celle du responsable direct) : une liste avec recherche des colonnes qui désignent une personne. Renoncer
// laisse la relation comme elle était (orange si elle n'avait pas de colonne).
async function pickColumn(host, rel) {
  const { t, draft } = host;
  const current = rel ? rel.col : draft.config.manager;
  const chosen = await host.list({ title: t('an.rel.pickTitle', { name: rel ? (rel.label || t('an.rel.nameLabel')) : t('an.rel.manager') }),
    text: t('an.rel.pickText'),
    items: relationColumns(host, current), current: current ? `use:${current}` : null, none: t('an.rel.noColumn') });
  if (chosen === null) return;
  const col = chosen.slice(4);
  if (rel) rel.col = col; else draft.config.manager = col;
  draft.config.fields = draft.config.fields.filter(field => field.col !== col);
  host.changed();
  host.focus(rel ? `rp:${draft.config.relations.indexOf(rel)}` : 'mp');
}

// Une relation nouvelle : un modèle (son nom et son sens inverse viennent tout prêts), « Autre relation » (la personne les écrit), ou le responsable direct
// (son nom est fixe : on passe à sa colonne).
async function addRelation(host, template) {
  const { t, draft } = host;
  if (template === 'manager') { await pickColumn(host, null); return; }
  const made = template === 'other' ? await newRelationWindow(host) : { label: t(`an.rel.tpl.${template}`), inverse: t(`an.rel.tpl.${template}.inverse`) };
  if (!made) return;
  const rel = { col: '', label: made.label, inverse: made.inverse, card: true };
  draft.config.relations.push(rel);
  host.changed();
  await pickColumn(host, rel);
  host.focus(`rp:${draft.config.relations.indexOf(rel)}`);
}

// La fenêtre « Nouvelle relation » : le nom (obligatoire) et le sens inverse (facultatif). Rend { label, inverse } ou null.
function newRelationWindow(host) {
  const { t } = host;
  const field = (fk, label, placeholder) => h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder, 'aria-label': label,
    dataset: { fk } });
  const name = field('nr-name', t('an.rel.nameLabel'), t('an.rel.namePlaceholder'));
  const inverse = field('nr-inverse', t('an.rel.inverse'), t('an.rel.inversePlaceholder'));
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'nr-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'nr-ok' } }, t('an.rel.addOne'));
  const section = h('section', { class: 'mod an-nl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-nr-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-nr-title' }, t('an.rel.newTitle'))),
    h('div', { class: 'mod-body an-set-body' }, formRow(`${t('an.rel.nameLabel')} *`, name, t('an.rel.nameHint')),
      formRow(t('an.rel.inverse'), inverse, t('an.rel.inverseHint'))),
    h('footer', { class: 'mod-foot' }, h('span', { class: 'mod-note' }), cancel, ok));
  const { done, result } = openModal({ container: host.container, section, inertTargets: host.inertTargets, first: name, cancel: null });
  const confirm = () => { if (name.value.trim()) done({ label: name.value.trim(), inverse: inverse.value.trim() }); };
  name.addEventListener('input', () => ok.setAttribute('aria-disabled', name.value.trim() ? 'false' : 'true'));
  for (const input of [name, inverse]) input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } });
  cancel.addEventListener('click', () => done(null));
  ok.addEventListener('click', confirm);
  return result;
}
