// Les champs de la fenêtre « Modifier » (module Annuaire, demande du porteur du 25/11) : un contrôle par type de colonne, des fonctions qui construisent des
// nœuds (js/annuaire/annuaire-edit-window.js tient l'état et les gestes). Un texte, une date ou un nombre se tape ; un choix et une référence passent par la
// liste avec recherche (charte : js/ui/pick-window.js) ; un choix multiple est une rangée de cases ; un oui/non un interrupteur ; une liste de personnes, des
// pastilles qu'on retire et un bouton qui en ajoute.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { chooser, switchButton, iconButton } from './annuaire-setup-shared.js';
import { choiceOptions, refOptions } from './annuaire-edit.js';

const INPUT_MODES = Object.freeze({ email: 'email', phone: 'tel', number: 'decimal' });

// Le texte d'une valeur de la fenêtre, tel qu'on le lit (un choix, un nom, « Oui », une date dans la langue) ; `labels` : { id: nom } des références.
export function say(field, value, { t, locale, labels }) {
  if (field.genre === 'bool') return t(value ? 'an.yes' : 'an.no');
  if (field.genre === 'ref') return value ? labels[value] || String(value) : '';
  if (field.genre === 'reflist' || field.genre === 'choicelist') return value.map(each => labels[each] || each).join(', ');
  if (field.genre === 'date' && value) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  }
  return String(value ?? '');
}

// Les noms des personnes ou des lignes qu'une référence désigne : { id: nom }.
export function labelsOf(fields, ctx) {
  const labels = {};
  for (const field of fields.filter(each => each.genre === 'ref' || each.genre === 'reflist')) {
    for (const option of refOptions(field, ctx)) labels[option.id] = option.label;
  }
  return labels;
}

function textInput(field, value) {
  const type = field.genre === 'date' ? 'date' : 'text';
  return h('input', { type, class: 'an-set-input', value, autocomplete: 'off', inputmode: INPUT_MODES[field.key] || INPUT_MODES[field.genre] || null,
    'aria-label': field.label, dataset: { input: field.key, fk: `ef:${field.key}` } });
}

function boolSwitch(field, value, t) {
  return h('span', { class: 'an-ed-bool' }, switchButton({ on: value, label: field.label, fk: `ef:${field.key}`, data: { act: 'ed-bool', key: field.key } }),
    h('span', null, t(value ? 'an.yes' : 'an.no')));
}

// Un choix multiple : une case par valeur que la colonne propose (et celles que la personne a déjà, même hors liste).
function choiceChips(field, value, t) {
  const options = choiceOptions(field, value);
  if (!options.length) return h('span', { class: 'an-set-hint' }, t('an.edit.noChoices'));
  return h('div', { class: 'an-ed-chips', role: 'group', 'aria-label': field.label }, ...options.map(each => h('button', { type: 'button',
    class: 'an-ed-chip', role: 'checkbox', 'aria-checked': String(value.includes(each)), dataset: { act: 'ed-chip', key: field.key, value: each,
      fk: `ec:${field.key}:${each}` } }, value.includes(each) ? icon('check') : null, each)));
}

// Des personnes (ou des lignes) en pastilles qu'on retire d'un clic, et le bouton qui en ajoute (la liste avec recherche).
function refChips(field, value, t, labels) {
  return h('div', { class: 'an-ed-chips', role: 'group', 'aria-label': field.label },
    ...value.map(id => h('span', { class: 'an-ed-pill' }, h('span', null, labels[id] || String(id)),
      iconButton(t, { glyph: 'x', label: t('an.edit.remove', { what: labels[id] || String(id) }), fk: `er:${field.key}:${id}`,
        data: { act: 'ed-remove', key: field.key,
        value: String(id) } }))),
    h('button', { type: 'button', class: 'btn sm an-ed-add', dataset: { act: 'ed-add', key: field.key, fk: `ea:${field.key}` } }, icon('plus'),
      t('an.edit.add')));
}

// Le contrôle d'un champ pour sa valeur du moment. `host` : { t, locale, labels }.
export function controlOf(field, value, host) {
  const { t, labels } = host;
  const pick = (act, text) => chooser(t, `ef:${field.key}`, text, { act, key: field.key });
  switch (field.genre) {
    case 'bool': return boolSwitch(field, value, t);
    case 'choice': return pick('ed-choice', value);
    case 'ref': return pick('ed-ref', value ? labels[value] || String(value) : '');
    case 'choicelist': return choiceChips(field, value, t);
    case 'reflist': return refChips(field, value, t, labels);
    default: return textInput(field, value);
  }
}

// Une ligne grisée : la valeur qu'une autre table porte, ou une colonne que Grist calcule. Elle se lit, elle ne se change pas ici (grisé, jamais masqué).
export function lockedRow(entry, text, t) {
  const why = entry.why === 'path' ? t('an.edit.lockedPath', { table: entry.table || '' }) :
    t(entry.why === 'formula' ? 'an.edit.lockedFormula' : 'an.edit.lockedType');
  return h('div', { class: 'an-set-row an-ed-locked' }, h('span', { class: 'an-set-label' }, entry.label),
    h('div', { class: 'an-set-control' }, h('p', { class: 'an-set-example', title: why }, text || '—'),
      h('span', { class: 'an-set-hint an-ed-why' }, icon('lock'), why)));
}
