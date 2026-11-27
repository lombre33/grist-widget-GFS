// Choisir une colonne dans le réglage de l'annuaire (module Annuaire, retours du porteur du 25/11) : « on ne peut pas revenir en arrière », « j'ai une
// référence de poste dans ma table, mais pas de colonne pour le pôle : il est dans la table des postes » (comme PP gère les variables de plusieurs tables, en
// mieux), « des valeurs d'exemple en direct », « une colonne existante, ou le widget propose de la créer ».
//
// Deux listes avec recherche (js/ui/pick-window.js) :
// - `pickPath` rend un chemin de colonnes depuis la table des personnes : une colonne de la personne, ou la colonne d'une table qu'une de ses références vise.
//   Chaque
//   référence a un bouton « Postes › » pour la suivre pas à pas (le fil dit où l'on est, ses pastilles et « Retour » reviennent d'un cran) ; en tapant, la
//   recherche
//   regarde aussi, d'un coup, dans les tables liées (« Poste › Pôle », « Poste › Structure › Direction ») ;
// - `pickColumn` rend une colonne de la table des personnes, ou '' pour « Aucune ».
// Chaque article dit à droite ce que la colonne contient pour une personne d'exemple (js/annuaire/annuaire-sample.js), et la première ligne propose de créer
// une
// colonne : une petite fenêtre (nom, type) qui dit ce qui s'écrit dans le document, et n'écrit qu'au clic sur « Créer la colonne ». `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { normalize } from '../ui/search.js';
import { columnOf } from './annuaire-schema.js';
import { keyPath } from './annuaire-config.js';
import { nameOf } from './annuaire-model.js';
import { GLYPHS, MAX_PATH, typeLabel, formRow } from './annuaire-setup-shared.js';
import { valuesEditor } from './annuaire-values-editor.js';
import { isChoiceGenre } from './annuaire-field-edit.js';
import { genreOf } from './annuaire-schema.js';

const SEP = '\u001f';
const DEEP_HOPS = 2; // combien de références la recherche suit d'un coup
const DEEP_LIMIT = 600; // combien de colonnes de tables liées elle propose au plus

// La table qu'on atteint en suivant `path` depuis la table des personnes ('' quand un maillon n'est pas une référence qu'on suit).
export function tableAfter(schema, table, path) {
  let at = table;
  for (const id of path) {
    const col = at ? columnOf(schema, at, id) : null;
    at = col && col.genre === 'ref' ? col.ref : '';
  }
  return at;
}

// Le nom de la personne d'exemple, écrit comme l'annuaire l'écrira ; '' tant qu'il n'y a pas d'exemple ou de colonne du nom.
export function personName(host) {
  const { config } = host.draft;
  const last = config.name ? host.sample.text(keyPath(config.name)) : '';
  if (!last) return '';
  return nameOf(config.first ? host.sample.text(keyPath(config.first)) : '', last, config.order, config.upper).name;
}

// D'où viennent les exemples : une ligne sous la recherche.
function exampleLine(host) {
  const { t, sample } = host;
  if (sample.state === 'idle' || sample.state === 'loading') return t('an.sample.loading');
  if (sample.state !== 'ready') return '';
  const name = personName(host);
  return name ? t('an.sample.from', { name }) : t('an.sample.fromAnon');
}

// Une colonne en article de liste : son nom, son type (ou la table qu'elle montre), l'exemple à droite, et le bouton qui la suit quand c'est une référence
// simple.
function columnRow(host, col, path, follow) {
  const { t, schema, draft } = host;
  const canFollow = follow && col.genre === 'ref' && Boolean(schema[col.ref]);
  return { value: `use:${col.id}`, label: col.id, glyph: GLYPHS[col.genre] || 'table', sample: () => host.sample.text([...path, col.id]),
    hint: col.ref && col.ref !== draft.table ? t('an.set.shows', { table: col.ref }) : typeLabel(col, draft.table, t), follow: canFollow ? col.ref : '',
    alt: canFollow ? undefined : false };
}

// Les colonnes des tables que les références de `table` visent, d'un coup : « Poste › Pôle ». Rien qui revienne sur ses pas (une table déjà suivie n'est pas
// suivie deux fois) ; au plus DEEP_HOPS références, et jamais plus que MAX_PATH colonnes en tout.
function deepRows(host, table, path, files = false) {
  const { t, schema, draft } = host;
  const rows = [];
  const visit = (at, via, seen) => {
    if (via.length >= DEEP_HOPS || path.length + via.length + 2 > MAX_PATH) return;
    for (const col of schema[at].columns) {
      if (col.genre !== 'ref' || !schema[col.ref] || seen.has(col.ref)) continue;
      const next = [...via, col.id];
      for (const target of schema[col.ref].columns) {
        if ((target.genre === 'file') !== files) continue;
        rows.push({ value: `deep:${[...next, target.id].join(SEP)}`, label: [...next, target.id].join(' › '), glyph: GLYPHS[target.genre] || 'table',
          alt: false,
          searchOnly: true, hint: t('an.set.inTable', { table: col.ref }), sample: () => host.sample.text([...path, ...next, target.id]) });
      }
      visit(col.ref, next, new Set([...seen, col.ref]));
    }
  };
  if (schema[table]) visit(table, [], new Set([draft.table, ...path.map((_, i) => tableAfter(schema, draft.table, path.slice(0, i + 1)))]));
  return rows.slice(0, DEEP_LIMIT);
}

// La première ligne de la liste : créer une colonne dans la table où l'on est.
const createRow = (host, table) => ({ value: 'new:', label: host.t('an.new.item', { table }), glyph: 'plus', hint: host.t('an.new.itemHint'), pinned: true,
  alt: false });

// La fenêtre « Créer une colonne » : son nom, son type, ce qui s'écrit dans le document ; rien n'est écrit avant « Créer la colonne ». Rend l'identifiant de la
// colonne que Grist a créée, ou null.
function createWindow(host, { table, types }) {
  const { t, schema } = host;
  let chosen = types[0];
  let busy = false;
  const blocked = host.writeBlock();
  const taken = name => (schema[table] ? schema[table].columns : []).some(col => normalize(col.id) === normalize(name));
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('an.new.namePlaceholder'), 'aria-label': t('an.new.name'),
    value: types[0].suggest || '', dataset: { fk: 'nc-name' } }); // `suggest` : le nom qu'un type propose (le bureau du plan)
  const seg = h('div', { class: 'an-seg', role: 'group', 'aria-label': t('an.new.type') });
  const note = h('span', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'nc-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'nc-ok' } }, t('an.new.ok'));
  const values = valuesEditor({ t, fk: 'nc-val' });
  const valuesRow = formRow(t('an.new.values'), values.node, t('an.new.valuesHint'));
  const choosing = () => isChoiceGenre(genreOf(chosen.type));
  const paint = () => {
    seg.replaceChildren(...types.map(each => h('button', { type: 'button', class: 'an-seg-b', 'aria-pressed': String(each === chosen),
      dataset: { type: each.type, fk: `nc-type:${each.type}` } }, each.label)));
    valuesRow.hidden = !choosing();
  };
  const check = () => {
    const name = input.value.trim();
    const problem = blocked || (name && taken(name) ? t('an.new.taken') : '');
    note.textContent = problem;
    note.classList.toggle('is-warn', Boolean(problem));
    ok.setAttribute('aria-disabled', name && !problem && !busy ? 'false' : 'true');
  };
  const section = h('section', { class: 'mod an-nl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-nc-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-nc-title' }, t('an.new.title'))),
    h('div', { class: 'mod-body an-set-body' }, formRow(`${t('an.new.name')} *`, input), types.length > 1 ? formRow(t('an.new.type'), seg) : null, valuesRow,
      h('p', { class: 'an-set-hint' }, t('an.new.why', { table }))),
    h('footer', { class: 'mod-foot' }, note, cancel, ok));
  paint();
  const { done, result } = openModal({ container: host.container, section, inertTargets: host.inertTargets, first: input, cancel: null });
  const create = async () => {
    if (ok.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    check();
    try {
      done((await host.createColumn(table, { name: input.value.trim(), type: chosen.type, choices: choosing() ? values.values() : [], show: chosen.show })).id);
    } catch (error) {
      busy = false;
      check();
      note.textContent = t('an.new.failed', { reason: String(error && error.message ? error.message : error) });
      note.classList.add('is-warn');
    }
  };
  input.addEventListener('input', check);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void create(); } });
  seg.addEventListener('click', event => {
    const button = event.target.closest('[data-type]');
    if (button) { chosen = types.find(each => each.type === button.dataset.type) || chosen; paint(); }
  });
  cancel.addEventListener('click', () => done(null));
  ok.addEventListener('click', () => void create());
  check();
  return result;
}

// Un chemin de colonnes depuis la personne, ou null quand la personne renonce. opts : { title, text, types ([{ type, label }] : les types qu'on propose pour
// créer une colonne ; rien : pas de création), filter(col, path) -> bool (les colonnes qu'on propose), clear (propose « Aucune » au premier étage : rend []),
// current (le chemin en cours, qu'on retrouve marqué dans la liste), files (vrai : seules les colonnes « Pièces jointes » se choisissent, la photo et le logo ;
// les références se suivent mais ne se choisissent pas) }.
export async function pickPath(host, { title, text = '', types = [], filter = () => true, clear = false, current = [], files = false }) {
  const { t, schema, draft } = host;
  const path = [];
  host.sample.load();
  for (;;) {
    const table = tableAfter(schema, draft.table, path);
    const cols = (schema[table] ? schema[table].columns : []).filter(col => (files ? col.genre === 'file' ||
      (col.genre === 'ref' && schema[col.ref]) : col.genre !== 'file') &&
      filter(col, path));
    const none = clear && path.length === 0 ? [{ value: 'none', label: t('an.set.none'), glyph: 'x', hint: '', alt: false }] : [];
    const items = [...(types.length ? [createRow(host, table)] : []), ...none, ...cols.map(col => columnRow(host, col, path, path.length < MAX_PATH - 1)),
      ...deepRows(host, table, path, files)];
    const here = current.length === path.length + 1 && path.every((id, i) => id === current[i]) ? `use:${current[path.length]}` : null;
    const chosen = await host.list({ title, text: path.length ? '' : text, crumbs: [draft.table, ...path], back: true, items, none: t('an.set.noColumn'),
      current: here, alt: { icon: 'chev-right', label: item => t('an.set.follow', { table: item.follow }), text: item => item.follow },
        example: () => exampleLine(host),
      watch: refresh => host.sample.whenLoaded(refresh) });
    if (chosen !== null && chosen.value === 'new:') {
      const made = await createWindow(host, { table, types });
      if (made) return [...path, made];
      continue;
    }
    const answer = answerOf(chosen, path, files ? id => (columnOf(schema, table, id) || {}).genre === 'ref' : null);
    if (answer !== undefined) return answer;
  }
}

// Ce que le choix d'une ligne répond : un chemin (c'est fini), `null` (la personne renonce), ou `undefined` (le choix continue : on suit une référence ou on
// revient en arrière, `path` change).
function answerOf(chosen, path, mustFollow = null) {
  if (chosen === null) return null;
  if (chosen.jump !== undefined) { path.length = chosen.jump; return undefined; }
  if (chosen.value === 'none') return [];
  if (chosen.value.startsWith('deep:')) return [...path, ...chosen.value.slice(5).split(SEP)];
  const col = chosen.value.slice(4);
  if (!chosen.alt && !(mustFollow && mustFollow(col))) return [...path, col];
  path.push(col);
  return undefined;
}

// Une colonne de la table des personnes : son identifiant, '' pour « Aucune » (avec `clear`), ou null quand la personne renonce. opts : { title, text, types,
// filter(col) -> bool, clear (propose « Aucune »), current (la colonne en cours), files (vrai : seules les colonnes « Pièces jointes » se proposent) }.
export async function pickColumn(host, { title, text = '', types = [], filter = () => true, clear = false, current = '', files = false }) {
  const { t, schema, draft } = host;
  host.sample.load();
  for (;;) {
    const cols = (schema[draft.table] ? schema[draft.table].columns : []).filter(col => (col.genre === 'file') === files && filter(col));
    const items = [...(types.length ? [createRow(host, draft.table)] : []), ...(clear ? [{ value: 'none', label: t('an.set.none'), glyph: 'x', hint: '' }] :
      []),
      ...cols.map(col => columnRow(host, col, [], false))];
    const chosen = await host.list({ title, text, items, current: current ? `use:${current}` : null, none: t('an.set.noColumn'),
      example: () => exampleLine(host),
      watch: refresh => host.sample.whenLoaded(refresh) });
    if (chosen === null) return null;
    if (chosen === 'none') return '';
    if (chosen === 'new:') {
      const made = await createWindow(host, { table: draft.table, types });
      if (made) return made;
      continue;
    }
    return chosen.slice(4);
  }
}
