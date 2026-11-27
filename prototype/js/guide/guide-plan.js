// Les deux vues d'ensemble du guide (module Guide, demande du porteur du 27/11, maquette « Le plan : la cartographie des démarches » et « Les contacts : qui
// est cité par quoi ») : le PLAN, tout le guide d'un coup d'œil, du thème à la sous-démarche, dessiné en HTML sans bibliothèque (un contact propre est plein,
// un contact hérité en pointillé, un thème sans contact saute aux yeux) ; et les CONTACTS, à l'envers : chaque interlocuteur avec les démarches qui le citent,
// les introuvables en tête. Des fonctions qui construisent des nœuds ; aucune ne lit ni n'écrit rien (la fenêtre, js/guide/guide-window.js, tient l'état et les
// gestes).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { initials } from '../annuaire/annuaire-items.js';
import { headline } from './guide-panes.js';
import { typeOf } from './guide-types.js';
import { contactsIndex, citingPerson } from './guide-contacts-index.js';

const KIND_GLYPH = Object.freeze({ person: 'user', service: 'building', post: 'briefcase', text: 'info' });
export const PLAN_FOLD_AT = 40; // au-delà, le plan s'ouvre replié sous les thèmes : un guide de centaines de démarches ne s'étale pas d'un coup

// Les démarches repliées au départ : aucune pour un petit guide, les sous-démarches des thèmes pour un grand.
export function planFolded(model) {
  return model.procs.length > PLAN_FOLD_AT ? new Set(model.index.roots.map(proc => proc.row)) : new Set();
}

// Qui contacter, sur une carte du plan : le contact (avec la flèche quand il vient de la mère), ou ce qui manque.
function leadLine(lead, bare, t) {
  if (!lead) return h('span', { class: 'gd-pn-lead is-none' }, icon('warning'), h('span', null, t(bare ? 'gd.plan.bare' : 'gd.plan.none')));
  return h('span', { class: 'gd-pn-lead' }, lead.inherited ? icon('corner') : null, h('span', null, lead.text));
}

// Le bouton de repli d'une carte qui a des filles : il dit combien elle en cache.
function foldButton(proc, kids, folded, t) {
  const label = t(folded ? 'gd.expand' : 'gd.collapse', { name: proc.title });
  return h('button', { type: 'button', class: 'gd-pn-tg', 'aria-expanded': String(!folded), title: label, 'aria-label': label,
    dataset: { act: 'plan-toggle', row: String(proc.row), fk: `pt:${proc.row}` } }, folded ? String(kids.length) : icon('minus'));
}

// Un nœud du plan : une carte (le titre, le type, qui contacter) et, si elle a des filles, son bouton de repli et la colonne de ses filles.
function planNode(model, proc, ctx) {
  const { t, folded, answerFor } = ctx;
  const kids = model.index.children.get(proc.row) || [];
  const isFolded = folded.has(proc.row);
  const lead = headline(answerFor(proc.row));
  const type = typeOf(model.config, proc);
  const bare = !lead && !model.index.parentOf.get(proc.row);
  const card = h('div', { class: `gd-pn${bare ? ' is-bare' : ''}${lead && lead.inherited ? ' is-inh' : ''}` },
    h('button', { type: 'button', class: 'gd-pn-b', dataset: { act: 'open', row: String(proc.row), fk: `pn:${proc.row}` } },
      h('span', { class: 'gd-pn-t' }, type ? icon(type.glyph, 'gd-pn-ic') : null, h('span', null, proc.title)), leadLine(lead, bare, t)),
    kids.length ? foldButton(proc, kids, isFolded, t) : null);
  return h('li', null, card, kids.length && !isFolded ? h('ul', null, ...kids.map(kid => planNode(model, kid, ctx))) : null);
}

// Le plan : un arbre de gauche à droite, qui défile dans sa carte.
export function planTree(model, { t, folded, answerFor }) {
  return h('div', { class: 'gd-card gd-plan-card' }, h('p', { class: 'gd-hint' }, t('gd.plan.hint')),
    h('ul', { class: 'gd-plan', role: 'group', 'aria-label': t('gd.view.plan') },
      ...model.index.roots.map(proc => planNode(model, proc, { t, folded, answerFor }))));
}

const avatar = name => h('span', { class: 'gd-av', 'aria-hidden': 'true' }, initials(name));

// Une ligne de l'index des contacts : le contact, ce qu'il désigne, combien de démarches le citent ; elle s'ouvre sur ces démarches.
function contactRow(group, { t, open }) {
  const isOpen = open.has(group.key);
  const who = group.people[0] || null;
  const sub = group.kind === 'person' || !who ? '' : who.name + (group.people.length > 1 ? ` +${group.people.length - 1}` : '');
  const head = h('button', { type: 'button', class: `gd-cr-b${group.found ? '' : ' is-lost'}`, 'aria-expanded': String(isOpen),
    dataset: { act: 'contact-toggle', key: group.key,
    fk: `cr:${group.key}` } }, group.kind === 'person' && who ? avatar(who.name) : icon(KIND_GLYPH[group.kind] || 'info', 'gd-cr-ic'),
  h('span', { class: 'gd-cr-t' }, h('span', { class: 'gd-cr-name' }, group.label), sub ? h('span', { class: 'gd-cr-sub' }, sub) : null),
  group.found ? null : h('span', { class: 'gd-chip is-warn' }, icon('warning'), h('span', null, t('gd.contacts.lost'))),
  h('span', { class: 'gd-pill' }, t('gd.count', { n: group.procs.length })), icon(isOpen ? 'chev-down' : 'chev-right'));
  const procs = isOpen ? h('ul', { class: 'gd-cr-procs' }, ...group.procs.map(proc =>
    h('li', null, h('button', { type: 'button', class: 'gd-kid', dataset: { act: 'open',
    row: String(proc.row), fk: `crp:${group.key}:${proc.row}` } }, h('span', null, proc.title),
      proc.own ? null : h('span', { class: 'gd-chip is-inh' }, icon('corner'), h('span', null,
      t('gd.inherited'))), icon('chev-right'))))) : null;
  return h('li', { class: 'gd-cr' }, head, procs);
}

// Les contacts à l'envers : tous les interlocuteurs du guide, les introuvables en tête.
export function contactsView(model, { t, open, answerFor }) {
  const groups = contactsIndex(model.procs, answerFor);
  const lost = groups.filter(group => !group.found).length;
  return h('div', { class: 'gd-card gd-contacts-card' }, h('p', { class: 'gd-hint' }, t('gd.contacts.hint')),
    lost ? h('p', { class: 'gd-warn' }, icon('warning'), h('span', null, t('gd.contacts.lostCount', { n: lost }))) : null,
    groups.length ? h('ul', { class: 'gd-crs' }, ...groups.map(group => contactRow(group, { t, open }))) : h('p', { class: 'gd-note' }, t('gd.contacts.none')));
}

// Les démarches d'une personne (ce qu'ouvre le bouton « Démarches » de sa fiche dans l'annuaire) : celles qui la citent par son nom, son poste ou le service
// dont elle est responsable. `row` : la ligne de la personne dans l'annuaire du guide.
export function personView(model, { t, row, answerFor }) {
  const person = model.directory && model.directory.byRow.get(row);
  const name = person ? person.name : t('gd.person.someone');
  const found = citingPerson(model.procs, answerFor, row);
  const list = h('ul', { class: 'gd-cr-procs gd-pv-list' }, ...found.map(proc => h('li', null, h('button', { type: 'button', class: 'gd-kid',
    dataset: { act: 'open', row: String(proc.row), fk: `pv:${proc.row}` } }, h('span', null, proc.title),
  h('span', { class: 'gd-pv-chips' }, h('span', { class: 'gd-chip' }, t(`gd.via.${proc.via}`)),
    proc.own ? null : h('span', { class: 'gd-chip is-inh' }, icon('corner'), h('span', null, t('gd.inherited')))), icon('chev-right')))));
  return h('div', { class: 'gd-card gd-person-card' }, h('div', { class: 'gd-pv-head' }, person ? avatar(name) : null,
    h('span', { class: 'gd-cr-name' }, name), h('button', { type: 'button', class: 'btn sm', dataset: { act: 'person-clear', fk: 'pv-all' } },
      t('gd.person.all'))),
  h('p', { class: 'gd-hint' }, t('gd.person.hint')), found.length ? list : h('p', { class: 'gd-note' }, t('gd.person.none', { name })));
}
