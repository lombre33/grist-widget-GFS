// « Créer une table » pour l'annuaire (module Annuaire, retour du porteur du 25/11 : « pour chaque option qui demande la table, laisser l'option d'en créer une
// »). Dans le choix de la table des personnes, la première ligne propose à la personne qui n'a pas de table prête que GFS en crée une, dédiée à l'annuaire :
// une ligne par personne, une colonne pour le nom et une pour l'adresse e-mail (js/annuaire/annuaire-config.js : `PEOPLE_TABLE`). Les autres colonnes (le
// poste, le téléphone, un niveau, un champ…) se créent ensuite, une à une, depuis les choix de colonne du réglage (js/annuaire/annuaire-setup-path.js : « Créer
// une colonne »). Rien ne s'écrit avant « Créer la table » : la fenêtre dit ce qui s'écrit, comme celle d'une colonne. `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { normalize } from '../ui/search.js';
import { PEOPLE_COLUMNS, PEOPLE_TABLE, PLAN_COLUMNS, PLAN_TABLE } from './annuaire-config.js';
import { formRow } from './annuaire-setup-shared.js';

// La première ligne de la liste des tables.
export const createTableRow = host => ({ value: 'new:', label: host.t('an.tbl.item'), glyph: 'plus', hint: host.t('an.tbl.itemHint'), pinned: true,
  alt: false });

// Le nom que la fenêtre propose : « Directory_People », puis « Directory_People_2 »… tant qu'une table du document le porte (`base` : « Directory_Places » pour
// la table des lieux du plan).
export function suggestedName(schema, base = PEOPLE_TABLE.id) {
  const names = new Set(Object.keys(schema).map(normalize));
  let name = base;
  for (let n = 2; names.has(normalize(name)); n += 1) name = `${base}_${n}`;
  return name;
}

// Ce que la fenêtre écrit pour chaque table que GFS sait créer : le nom proposé, les colonnes dites, les trois textes, et le geste qui l'écrit.
export const PEOPLE_SPEC = host => ({ base: PEOPLE_TABLE.id, columns: PEOPLE_COLUMNS.map(column => column.id), title: 'an.tbl.title', why: 'an.tbl.why',
  ok: 'an.tbl.ok', make: name => host.createTable(name) });
// La table des lieux du plan (décision du porteur, 27/11) : toutes ses colonnes, y compris `Parent`, que GFS ajoute juste après.
export const PLAN_SPEC = host => ({ base: PLAN_TABLE.id, columns: [...PLAN_COLUMNS.map(column => column.id), PLAN_TABLE.parent], title: 'an.plan.tbl.title',
  why: 'an.plan.tbl.why', ok: 'an.plan.tbl.ok', make: name => host.createPlanTable(name) });

// La fenêtre « Créer la table des personnes » (ou des lieux : `spec`) : rend ce que le geste d'écriture rend (pour les personnes { table, name, email } :
// l'identifiant que Grist a donné à la table et à ses deux colonnes), ou null quand la personne renonce.
export function createTableWindow(host, spec = PEOPLE_SPEC(host)) {
  const { t, schema } = host;
  let busy = false;
  const blocked = host.writeBlock();
  const taken = name => Object.keys(schema).some(each => normalize(each) === normalize(name));
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', value: suggestedName(schema, spec.base), 'aria-label': t('an.tbl.name'),
    dataset: { fk: 'nt-name' } });
  const note = h('span', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'nt-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'nt-ok' } }, t(spec.ok));
  const check = () => {
    const name = input.value.trim();
    const problem = blocked || (name && taken(name) ? t('an.tbl.taken') : '');
    note.textContent = problem;
    note.classList.toggle('is-warn', Boolean(problem));
    ok.setAttribute('aria-disabled', name && !problem && !busy ? 'false' : 'true');
  };
  const section = h('section', { class: 'mod an-nl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-nt-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-nt-title' }, t(spec.title))),
    h('div', { class: 'mod-body an-set-body' }, formRow(`${t('an.tbl.name')} *`, input),
      formRow(t('an.tbl.columns'), h('span', { class: 'an-set-text' }, spec.columns.join(', '))),
      h('p', { class: 'an-set-hint' }, t(spec.why))),
    h('footer', { class: 'mod-foot' }, note, cancel, ok));
  const { done, result } = openModal({ container: host.container, section, inertTargets: host.inertTargets, first: input, cancel: null });
  const create = async () => {
    if (ok.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    check();
    try {
      done(await spec.make(input.value.trim()));
    } catch (error) {
      busy = false;
      check();
      note.textContent = t('an.tbl.failed', { reason: String(error && error.message ? error.message : error) });
      note.classList.add('is-warn');
    }
  };
  input.addEventListener('input', check);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void create(); } });
  cancel.addEventListener('click', () => done(null));
  ok.addEventListener('click', () => void create());
  check();
  return result;
}
