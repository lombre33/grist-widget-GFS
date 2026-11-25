// L'onglet « Personnes » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11) : le nom de l'annuaire, la table des personnes et les colonnes
// que GFS y lit. Par défaut seulement le nom et l'adresse e-mail (le poste, la hiérarchie et le reste sont derrière l'option de l'onglet « Hiérarchie » et dans
// les champs) ; le nom complet est une seule colonne, et un volet qui se déplie propose de séparer le nom et le prénom, avec la raison : c'est la bonne gestion
// de la donnée (trier par nom, saluer par le prénom, éviter les doublons). `host` : voir js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { isPeopleTable } from './annuaire-schema.js';
import { CONFIG_VERSION, FIELD_SEPARATOR, NAME_ORDERS, keyPath, readConfig } from './annuaire-config.js';
import { chooser, formRow, switchButton } from './annuaire-setup-shared.js';
import { pickColumn, pickPath, personName } from './annuaire-setup-path.js';
import { nameOf } from './annuaire-model.js';

// Le nom du texte et l'aide de chaque colonne lue, et si elle est obligatoire.
const KEYS = Object.freeze({ name: ['an.set.name', true], first: ['an.set.first', true], email: ['an.set.email', false], phone: ['an.set.phone', false],
  title: ['an.set.title', false], lead: ['an.set.lead', false] }); // le poste et « responsable de sa structure » se choisissent depuis l'onglet « Hiérarchie »
// Le type d'une colonne que GFS propose de créer pour chacune (« Responsable de sa structure » : un oui/non).
const CREATES = Object.freeze({ lead: 'Bool' });

export function peopleTab(host) {
  const { t, draft, ui, editing } = host;
  const { name, table, config } = draft;
  const fixed = editing && Boolean(host.schema[table]); // une table qui a disparu du document se remplace
  const split = ui.split || Boolean(config.first);
  const need = { disabled: !table, title: table ? '' : t('an.set.needTable') };
  const nameInput = h('input', { type: 'text', class: 'an-set-input', value: name, disabled: editing, autocomplete: 'off', 'aria-label': t('an.set.nameLabel'),
    placeholder: t('an.set.namePlaceholder'), dataset: { fk: 'set-name', input: 'name' } });
  const column = key => formRow(`${t(KEYS[key][0] === 'an.set.name' && split ? 'an.set.last' : KEYS[key][0])}${KEYS[key][1] ? ' *' : ''}`,
    chooser(t, `pc:${key}`, config[key], { act: 'pick-person', key }, need), t(key === 'name' && split ? 'an.set.lastHint' : `${KEYS[key][0]}Hint`));
  const phone = config.phone || ui.phone;
  return h('div', { class: 'an-tabpanel' },
    h('section', { class: 'an-sec' }, h('h3', null, t('an.set.annuaire')), formRow(`${t('an.set.nameLabel')} *`, nameInput),
      formRow(`${t('an.set.table')} *`, chooser(t, 'pt', table, { act: 'pick-table' }, { disabled: fixed, title: fixed ? t('an.set.tableFixed') : '' }),
        fixed ? '' : t('an.set.tableHint'))),
    h('section', { class: 'an-sec' }, h('h3', null, t('an.set.persons')), column('name'),
      split ? column('first') : null, ...(split ? orderRows(host) : []), splitDisclosure(host, split), column('email'),
      phone ? column('phone') : h('div', { class: 'an-set-add' }, h('button', { type: 'button', class: 'an-sug', 'aria-disabled': table ? null : 'true',
        title: table ? null : t('an.set.needTable'), dataset: { act: 'add-phone', fk: 'add-phone' } }, icon('plus'), t('an.set.phone')))));
}

// « Séparer le nom et le prénom » : un bouton qui déplie la raison, et rend les deux colonnes. Fermé, le prénom est oublié.
function splitDisclosure(host, split) {
  const { t } = host;
  return h('div', { class: 'an-disclose' },
    h('button', { type: 'button', class: 'an-disclose-b', 'aria-expanded': String(split), dataset: { act: 'toggle-split', fk: 'toggle-split' } },
      icon(split ? 'chev-down' : 'chev-right'), t('an.set.split'), h('span', { class: 'an-disclose-tag' }, t('an.set.splitTag'))),
    split ? h('p', { class: 'an-set-why' }, icon('info'), t('an.set.splitWhy')) : null);
}

// Comment le nom s'écrit : l'ordre (« Prénom Nom », « Nom Prénom », « Nom, Prénom »), le nom de famille en capitales ou non, et l'aperçu que donne la personne
// d'exemple de la table (js/annuaire/annuaire-sample.js : la mieux remplie), sinon un nom fictif.
function orderRows(host) {
  const { t, draft } = host;
  const { config } = draft;
  const seg = h('div', { class: 'an-seg', role: 'group', 'aria-label': t('an.set.order') },
    ...NAME_ORDERS.map(order => h('button', { type: 'button', class: 'an-seg-b',
      'aria-pressed': String(config.order === order), dataset: { act: 'order', order, fk: `order:${order}` } }, t(`an.set.order.${order}`))));
  const live = config.first ? personName(host) : '';
  const preview = live || nameOf('Camille', 'Durand', config.order, config.upper).name;
  return [formRow(t('an.set.order'), seg, t('an.set.orderHint')),
    formRow(t('an.set.upper'), switchButton({ on: config.upper, label: t('an.set.upper'), fk: 'upper-toggle', data: { act: 'upper-toggle' } }),
      t('an.set.upperHint')),
    h('p', { class: 'an-set-example', 'aria-live': 'polite', dataset: { fk: 'name-example' } }, t('an.set.orderExample', { name: preview }))];
}

// Les gestes de l'onglet : chacun reçoit l'hôte et les attributs `data-*` du bouton.
const ACTS = Object.freeze({
  'pick-table': host => void pickTable(host),
  'pick-person': (host, data) => void pickPerson(host, data.key),
  'add-phone': host => { host.ui.phone = true; host.repaint(); void pickPerson(host, 'phone'); },
  'toggle-split': host => {
    const { draft, ui } = host;
    const was = ui.split || Boolean(draft.config.first);
    if (was) draft.config.first = '';
    ui.split = !was;
    host.repaint();
  },
  order: (host, data) => { host.draft.config.order = data.order; host.repaint(); },
  'upper-toggle': host => { host.draft.config.upper = !host.draft.config.upper; host.repaint(); },
});

// Rend true quand le geste est de cet onglet.
export function peopleAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}

async function pickTable(host) {
  const { t, schema, draft } = host;
  const items = Object.keys(schema).filter(isPeopleTable).sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name, glyph: 'table',
    hint: t('an.set.columns', { n: schema[name].columns.length }) }));
  const chosen = await host.list({ title: t('an.set.pickTable'), text: t('an.set.pickTableText'), items, current: draft.table, none: t('an.set.noTable') });
  if (chosen === null || chosen === draft.table) return;
  draft.table = chosen;
  draft.config = { ...readConfig({}), v: CONFIG_VERSION };
  host.ui.split = false;
  host.ui.phone = false;
  host.ui.fresh = null;
  host.changed();
}

// Une colonne que GFS lit par un nom : le nom (obligatoire), le prénom, l'adresse, le téléphone, le poste. Les facultatives se vident par « Aucune » ; une
// colonne peut aussi se créer, avec l'accord de la personne (js/annuaire/annuaire-setup-path.js). Le nom, le prénom, l'adresse, le téléphone et le poste
// peuvent venir d'une table liée (retour du porteur, 25/11 : « le poste est une référence : je veux choisir une autre colonne de la table des postes ») : la
// liste suit les références comme celle d'un champ de la fiche ; « Responsable de sa structure » (un oui/non) reste une colonne de la personne.
async function pickPerson(host, key) {
  const { t, draft } = host;
  const [label, required] = KEYS[key];
  const options = { title: t(key === 'name' && (host.ui.split || draft.config.first) ? 'an.set.last' : label), text: t(`${label}Hint`),
    types: [{ type: CREATES[key] || 'Text', label: t(CREATES[key] === 'Bool' ? 'an.type.bool' : 'an.type.text') }], clear: !required };
  let chosen;
  if (key === 'lead') chosen = await pickColumn(host, { ...options, current: draft.config[key] });
  else {
    const path = await pickPath(host, { ...options, current: keyPath(draft.config[key]) });
    chosen = path === null ? null : path.join(FIELD_SEPARATOR);
  }
  if (chosen === null) return;
  draft.config[key] = chosen;
  if (key === 'phone' && !chosen) host.ui.phone = false;
  host.changed();
}
