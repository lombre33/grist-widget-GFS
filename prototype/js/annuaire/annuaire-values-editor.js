// Les valeurs d'une colonne « Choix » ou « Choix multiple » (module Annuaire ; choix du porteur, 27/11 : « ajouter depuis là des valeurs »), en deux endroits :
// la fenêtre « Créer une colonne » (js/annuaire/annuaire-setup-path.js) et la fenêtre « Modifier le champ » (js/annuaire/annuaire-field-window.js). Une saisie
// (Entrée ou « Ajouter » ; plusieurs valeurs d'un coup quand on les sépare par une virgule), les valeurs en pastilles qu'on retire. Rien ne s'écrit dans Grist
// d'ici : le contrôle rend ses valeurs, la fenêtre qui l'accueille les écrit à son bouton.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { iconButton } from './annuaire-setup-shared.js';
import { splitTags } from './annuaire-field-edit.js';

// `fk` : le repère du clavier ; `onChange(valeurs)` : appelé à chaque ajout ou retrait. Rend { node, values(), set(valeurs), disable(raison) }.
export function valuesEditor({ t, fk, values = [], onChange = () => {} }) {
  let list = [...values];
  let off = '';
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('an.val.placeholder'), 'aria-label': t('an.val.label'),
    dataset: { fk: `${fk}-in` } });
  const add = h('button', { type: 'button', class: 'btn sm', dataset: { fk: `${fk}-add` } }, icon('plus'), t('an.val.add'));
  const chips = h('div', { class: 'an-vals', role: 'list', 'aria-label': t('an.val.label') });
  const node = h('div', { class: 'an-vals-ed' }, h('div', { class: 'an-vals-in' }, input, add), chips);
  const pill = (value, at) => h('span', { class: 'an-val', role: 'listitem' }, h('span', { class: 'an-val-t', title: value }, value),
    iconButton(t, { glyph: 'x', label: t('an.val.remove', { value }), fk: `${fk}-x:${at}`, disabled: Boolean(off),
      data: { act: 'val-remove', index: String(at) } }));
  const paint = () => {
    chips.replaceChildren(...(list.length ? list.map(pill) : [h('span', { class: 'an-set-hint' }, t('an.val.none'))]));
    for (const control of [input, add]) {
      control.toggleAttribute('disabled', Boolean(off));
      control.title = off;
    }
  };
  const push = () => {
    const more = splitTags(input.value).filter(value => !list.includes(value));
    input.value = '';
    if (more.length) { list = [...list, ...more]; paint(); onChange([...list]); }
    input.focus();
  };
  add.addEventListener('click', push);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); push(); } });
  chips.addEventListener('click', event => {
    const button = event.target.closest('[data-act="val-remove"]');
    if (!button || off) return;
    list = list.filter((_, at) => at !== Number(button.dataset.index));
    paint();
    onChange([...list]);
    const next = chips.querySelector('[data-act="val-remove"]');
    (next || input).focus();
  });
  paint();
  return { node, input, values: () => [...list], set: next => { list = [...next]; paint(); }, disable: reason => { off = reason || ''; paint(); } };
}
