// « Créer une table » pour l'annuaire (module Annuaire, retour du porteur du 25/11 : « pour chaque option qui demande la table, laisser l'option d'en créer une
// »). Dans le choix de la table des personnes, la première ligne propose à la personne qui n'a pas de table prête que GFS en crée une, dédiée à l'annuaire :
// une ligne par personne, une colonne pour le nom et une pour l'adresse e-mail (js/annuaire/annuaire-config.js : `PEOPLE_TABLE`). Les autres colonnes (le
// poste, le téléphone, un niveau, un champ…) se créent ensuite, une à une, depuis les choix de colonne du réglage (js/annuaire/annuaire-setup-path.js : « Créer
// une colonne »). Rien ne s'écrit avant « Créer la table » : la fenêtre dit ce qui s'écrit, comme celle d'une colonne. `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { normalize } from '../ui/search.js';
import { PEOPLE_COLUMNS, PEOPLE_TABLE } from './annuaire-config.js';
import { formRow } from './annuaire-setup-shared.js';

// La première ligne de la liste des tables.
export const createTableRow = host => ({ value: 'new:', label: host.t('an.tbl.item'), glyph: 'plus', hint: host.t('an.tbl.itemHint'), pinned: true,
  alt: false });

// Le nom que la fenêtre propose : « Directory_People », puis « Directory_People_2 »… tant qu'une table du document le porte.
export function suggestedName(schema) {
  const names = new Set(Object.keys(schema).map(normalize));
  let name = PEOPLE_TABLE.id;
  for (let n = 2; names.has(normalize(name)); n += 1) name = `${PEOPLE_TABLE.id}_${n}`;
  return name;
}

// La fenêtre « Créer la table des personnes » : rend { table, name, email } (l'identifiant que Grist a donné à la table et à ses deux colonnes), ou null quand
// la personne renonce.
export function createTableWindow(host) {
  const { t, schema } = host;
  let busy = false;
  const blocked = host.writeBlock();
  const taken = name => Object.keys(schema).some(each => normalize(each) === normalize(name));
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', value: suggestedName(schema), 'aria-label': t('an.tbl.name'),
    dataset: { fk: 'nt-name' } });
  const note = h('span', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'nt-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'nt-ok' } }, t('an.tbl.ok'));
  const check = () => {
    const name = input.value.trim();
    const problem = blocked || (name && taken(name) ? t('an.tbl.taken') : '');
    note.textContent = problem;
    note.classList.toggle('is-warn', Boolean(problem));
    ok.setAttribute('aria-disabled', name && !problem && !busy ? 'false' : 'true');
  };
  const section = h('section', { class: 'mod an-nl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-nt-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-nt-title' }, t('an.tbl.title'))),
    h('div', { class: 'mod-body an-set-body' }, formRow(`${t('an.tbl.name')} *`, input),
      formRow(t('an.tbl.columns'), h('span', { class: 'an-set-text' }, PEOPLE_COLUMNS.map(column => column.id).join(', '))),
      h('p', { class: 'an-set-hint' }, t('an.tbl.why'))),
    h('footer', { class: 'mod-foot' }, note, cancel, ok));
  const { done, result } = openModal({ container: host.container, section, inertTargets: host.inertTargets, first: input, cancel: null });
  const create = async () => {
    if (ok.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    check();
    try {
      done(await host.createTable(input.value.trim()));
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
