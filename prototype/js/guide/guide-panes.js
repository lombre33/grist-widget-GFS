// Ce que la fenêtre du guide montre (module Guide, demande du porteur du 27/11, maquette « scène 2 à 5 ») : les thèmes en tuiles, l'arbre des démarches, une
// ligne de démarche, la fiche d'une démarche (ses étapes et ses rôles). Des fonctions qui construisent des nœuds ; aucune ne lit ni n'écrit rien : la fenêtre
// (js/guide/guide-window.js) tient l'état et les gestes, le contrôle (js/guide/guide-control.js) la lecture.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { initials, telHref } from '../annuaire/annuaire-items.js';
import { ancestors, below } from './guide-model.js';
import { typeOf, fieldsOfType, fieldLabel, typeLabel, valueOf, dayOf, showsRole } from './guide-types.js';

const KIND_GLYPH = Object.freeze({ person: 'user', service: 'building', post: 'briefcase', text: 'info' });

// Le premier contact d'une réponse (js/guide/guide-contacts.js `answerOf`) : ce que la tuile et la ligne disent de « qui contacter » : { text, name, who (la
// personne), inherited }, ou null quand personne n'est dit.
export function headline(answer) {
  const item = answer.find(each => each.entries.length > 0);
  if (!item) return null;
  const entry = item.entries.find(each => each.found) || item.entries[0];
  const [who] = entry.people;
  return { text: entry.label || (who ? who.name : ''), name: who ? who.name : '', who: who || null, inherited: !item.own, viaFallback: item.viaFallback };
}

const avatar = (name, extra = '') => h('span', { class: `gd-av${extra ? ` ${extra}` : ''}`, 'aria-hidden': 'true' }, initials(name));

// « Qui contacter » d'une ligne : l'avatar de la personne, le service ou le poste dit, la personne.
function whoOf(lead) {
  if (!lead) return null;
  return h('span', { class: 'gd-who' }, lead.inherited ? icon('corner', 'gd-inh') : null, lead.name ? avatar(lead.name) : null,
    h('span', { class: 'gd-who-t' }, h('span', { class: 'gd-who-a' }, lead.text), lead.name &&
      lead.name !== lead.text ? h('span', { class: 'gd-who-b' }, lead.name) : null));
}

// ---------- les thèmes ----------

// Une tuile par thème (une démarche sans mère) : son titre, ce qu'elle contient, et qui contacter.
export function themeTiles(model, { t, answerFor }) {
  const { index } = model;
  return index.roots.map(proc => {
    const n = below(index, proc.row);
    const lead = headline(answerFor(proc.row));
    return h('button', { type: 'button', class: 'gd-tile', dataset: { act: 'open', row: String(proc.row), fk: `tile:${proc.row}` } },
      h('span', { class: 'gd-tile-ic' }, icon('guide')),
      h('span', { class: 'gd-tile-t' }, h('span', { class: 'gd-tile-name' }, proc.title),
        h('span', { class: 'gd-tile-sub' }, n ? t('gd.count', { n }) : t('gd.alone')),
        lead ? h('span', { class: 'gd-tile-lead' }, icon('corner'), h('span', null, lead.text)) : null));
  });
}

// ---------- l'arbre et les lignes ----------

// L'arbre des démarches : un thème, ses démarches, leurs sous-démarches ; le nombre de ce qui est dessous à droite d'une démarche qui en a.
export function treeNav(model, { selected, open, t }) {
  const { index } = model;
  const walk = (proc, depth) => {
    const kids = index.children.get(proc.row) || [];
    const isOpen = open.has(proc.row);
    const row = h('div', { class: `gd-tn${selected === proc.row ? ' is-sel' : ''}${depth === 0 ? ' is-top' : ''}`, dataset: { depth: String(depth) } },
      kids.length ? h('button', { type: 'button', class: 'gd-tn-tg', 'aria-expanded': String(isOpen),
        'aria-label': t(isOpen ? 'gd.collapse' : 'gd.expand', { name: proc.title }),
        dataset: { act: 'toggle', row: String(proc.row), fk: `tg:${proc.row}` } }, icon(isOpen ? 'chev-down' : 'chev-right')) :
          h('span', { class: 'gd-tn-sp' }),
      h('button', { type: 'button', class: 'gd-tn-b', 'aria-current': selected === proc.row ? 'true' : null, dataset: { act: 'node', row: String(proc.row),
        fk: `tn:${proc.row}` } }, h('span', { class: 'gd-tn-t' }, proc.title), kids.length ? h('span', { class: 'gd-tn-n' }, String(below(index, proc.row))) :
          null));
    row.style.setProperty('--d', String(depth));
    return h('li', { role: 'none' }, row, kids.length && isOpen ? h('ul', { role: 'group' }, ...kids.map(kid => walk(kid, depth + 1))) : null);
  };
  return h('ul', { class: 'gd-tree', role: 'tree', 'aria-label': t('gd.tree') }, ...index.roots.map(proc => walk(proc, 0)));
}

// Une démarche dans une liste : son titre, le chemin qui y mène (ses mères), et qui contacter.
export function procedureRow(model, proc, { answerFor, selected = false, tabStop = false, here = null }) {
  const trail = ancestors(model.index, proc.row).filter(mother => !here || mother.row !== here).map(mother => mother.title).join(' › ');
  return h('button', { type: 'button', class: `gd-row${selected ? ' is-sel' : ''}`, tabindex: tabStop ? '0' : '-1',
    dataset: { act: 'open', row: String(proc.row),
    fk: `row:${proc.row}` } }, h('span', { class: 'gd-row-main' }, h('span', { class: 'gd-row-title' }, proc.title),
      trail ? h('span', { class: 'gd-row-path' }, trail) : null),
  whoOf(headline(answerFor(proc.row))));
}

// ---------- la fiche ----------

// Une action de contact : un lien (courriel, appel) ou un bouton (copier) ; une icône seule, son nom au survol et pour les lecteurs d'écran.
function contactAction({ glyph, label, href = '', act = '', text = '', fk }) {
  return href ? h('a', { class: 'gd-ib', href, target: '_blank', rel: 'noopener', title: label, 'aria-label': label, dataset: { fk } }, icon(glyph)) :
    h('button', { type: 'button', class: 'gd-ib', title: label, 'aria-label': label, dataset: { act, text, fk } }, icon(glyph));
}

// Une personne dans une carte de rôle : son avatar, son nom, son poste, et de quoi la joindre (écrire, appeler, copier l'adresse).
function personBlock(person, { t, key }) {
  const call = telHref(person.phone);
  const actions = [person.email ? contactAction({ glyph: 'mail', label: t('gd.write', { name: person.name }), href: `mailto:${person.email}`,
    fk: `mail:${key}` }) : null,
    call ? contactAction({ glyph: 'phone', label: t('gd.call', { name: person.name }), href: call, fk: `tel:${key}` }) : null,
    person.email || person.phone ? contactAction({ glyph: 'copy', label: t('gd.copy', { name: person.name }), act: 'copy', text: person.email || person.phone,
      fk: `copy:${key}` }) : null]
    .filter(Boolean);
  return h('div', { class: 'gd-person' }, avatar(person.name, 'is-lg'), h('span', { class: 'gd-person-t' }, h('span', { class: 'gd-person-name' }, person.name),
    person.title ? h('span', { class: 'gd-person-sub' }, person.title) : null), h('span', { class: 'gd-acts' }, ...actions));
}

// Ce qu'un rôle désigne : le service ou le poste dit (une pastille), puis ceux qu'on a retrouvés, ou la phrase qui dit qu'on ne les a pas retrouvés.
function entryBlock(entry, item, { t, key }) {
  const chip = item.kind === 'person' ? null : h('span', { class: 'gd-chip is-kind' }, icon(KIND_GLYPH[item.kind]), h('span', null, entry.label));
  const people = entry.people.map((person, at) => personBlock(person, { t, key: `${key}.${at}` }));
  const lost = !entry.found && !entry.plain ? h('p', { class: 'gd-lost' }, t(item.kind === 'person' ? 'gd.lostPerson' : item.kind === 'service' ?
    'gd.lostService' : 'gd.lostPost',
    { label: entry.label })) : null;
  return h('div', { class: 'gd-entry' }, chip, ...people, lost);
}

// La carte d'un rôle : son nom, d'où il vient (« hérité de… »), et ses contacts. Un rôle que personne ne dit se voit quand même, grisé (jamais masqué).
function roleCard(item, { t, titleOf, key }) {
  const head = [h('span', { class: 'gd-role-n' }, item.role.label)];
  if (!item.empty && !item.own) head.push(h('span', { class: 'gd-chip is-inh', title: t('gd.inheritedFrom', { name: titleOf(item.from) }) }, icon('corner'),
    h('span', null, t('gd.inherited'))));
  if (item.viaFallback) head.push(h('span', { class: 'gd-chip is-warn' }, t('gd.viaFallback')));
  if (item.empty) return h('section', { class: 'gd-role is-empty' }, ...head, h('span', { class: 'gd-role-none' }, t('gd.roleEmpty')));
  return h('section', { class: `gd-role${item.viaFallback ? ' is-fallback' : ''}` }, h('div', { class: 'gd-role-h' }, ...head),
    item.viaFallback ? h('p', { class: 'gd-lost' }, t('gd.fallbackNote', { label: item.replaced.map(entry => entry.label).filter(Boolean).join(', ') })) : null,
    ...item.entries.map((entry, at) => entryBlock(entry, item, { t, key: `${key}.${at}` })));
}

// La colonne « Qui contacter » : une carte par rôle du guide, dans l'ordre du guide.
export function contactsPane(answer, { t, titleOf }) {
  const cards = answer.length ? answer.map((item, at) => roleCard(item, { t, titleOf, key: String(at) })) : [h('p', { class: 'gd-note' }, t('gd.noRoles'))];
  return h('div', { class: 'gd-contacts' }, h('h4', { class: 'gd-sec' }, t('gd.whoToContact')), ...cards);
}

// Les étapes : une ligne de la colonne = une étape, numérotée.
const stepsList = (steps, t) => (steps.length ? h('div', { class: 'gd-block' }, h('h4', { class: 'gd-sec' }, t('gd.steps')), h('ol', { class: 'gd-steps' },
  ...steps.map((step, at) => h('li', null, h('span', { class: 'gd-step-n', 'aria-hidden': 'true' }, String(at + 1)), h('span', null, step))))) : null);

// Le fil d'Ariane : les mères de la démarche, de la racine à la plus proche ; chacune se choisit.
const crumbs = (model, proc, t) => {
  const mothers = ancestors(model.index, proc.row);
  return mothers.length ? h('nav', { class: 'gd-crumbs', 'aria-label': t('gd.path') },
    ...mothers.flatMap((mother, at) => [at ? icon('chev-right', 'gd-sep') : null,
    h('button', { type: 'button', class: 'gd-crumb', dataset: { act: 'open', row: String(mother.row), fk: `crumb:${mother.row}` } }, mother.title)])) : null;
};

// Les démarches qui sont dessous : de quoi descendre d'un cran.
// Un parcours (un type qui demande le champ « Quand ? ») range ses étapes par date relative (J−90, J+15) et la dit devant chaque étape.
const whenField = (config, type) => (type ? fieldsOfType(config, type).find(field => field.id === 'when') || null : null);

const childrenList = (model, proc, t, config) => {
  const when = whenField(config, typeOf(config, proc));
  const kids = [...(model.index.children.get(proc.row) || [])];
  if (when) kids.sort((a, b) => (dayOf(a.extra.when) ?? Infinity) - (dayOf(b.extra.when) ?? Infinity));
  return kids.length ? h('div', { class: 'gd-block' }, h('h4', { class: 'gd-sec' }, t('gd.children', { n: kids.length })), h('ul', { class: 'gd-kids' },
    ...kids.map(kid => h('li', null, h('button', { type: 'button', class: 'gd-kid', dataset: { act: 'open', row: String(kid.row), fk: `kid:${kid.row}` } },
      when && kid.extra.when ? h('span', { class: 'gd-chip is-when' }, kid.extra.when) : null, h('span', null, kid.title), icon('chev-right')))))) : null;
};

// Un champ du type, montré comme son identifiant et sa forme le demandent : la réponse en grand, le numéro à appeler, un bouton pour une adresse de prise de
// rendez-vous ou de formulaire, le lieu (avec « Voir sur la carte », grisé tant que la cartographie n'est pas là), sinon une ligne « nom : valeur ».
function fieldBlock(field, value, t) {
  const label = fieldLabel(field, t);
  if (field.id === 'answer') return h('p', { class: 'gd-answer' }, value.text);
  if (field.id === 'phone') {
    const call = telHref(value.text);
    return h(call ? 'a' : 'span', { class: 'gd-urgent', href: call || null, dataset: { fk: 'fld:phone' } }, icon('phone'), h('span', { class: 'gd-urgent-t' },
      h('b', null, value.text), h('small', null, label)));
  }
  if (value.href && (field.id === 'booking' || field.id === 'form')) return h('a',
    { class: 'btn primary sm gd-cta', href: value.href, target: '_blank', rel: 'noopener',
    dataset: { fk: `fld:${field.id}` } }, icon(field.id === 'booking' ? 'clock' : 'open'), label);
  if (field.id === 'where') return h('div', { class: 'gd-where' }, icon('pin'), h('span', { class: 'gd-where-t' }, h('b', null, value.text),
    h('small', null, label)),
    h('button', { type: 'button', class: 'btn sm', 'aria-disabled': 'true', title: t('gd.map.off'), dataset: { act: 'mapoff', fk: 'fld:map' } }, icon('pin'),
      t('gd.map')));
  const shown = value.items ? h('span', { class: 'gd-chips' }, ...value.items.map(item => h('span', { class: 'gd-chip' }, item))) : value.href ?
    h('a', { class: 'gd-link',
    href: value.href, target: '_blank', rel: 'noopener' }, value.text, icon('open', 'sm')) :
      h('span', { class: field.shape === 'long' ? 'gd-long' : 'gd-val' }, value.text);
  return h('div', { class: field.shape === 'long' ? 'gd-block' : 'gd-kv' }, h('span', { class: 'gd-kv-k' }, label), shown);
}

// Les champs que le type de la démarche demande, remplis ; ceux qui sont vides ne se montrent pas.
const typedBlocks = (proc, type, config, t) => fieldsOfType(config, type).map(field => ({ field, value: valueOf(field, proc.extra[field.id]) })).filter(each =>
  each.value)
  .map(each => fieldBlock(each.field, each.value, t));

// Les rôles que le type de la démarche montre (tous sans type).
export const visibleAnswer = (answer, type) => answer.filter(item => showsRole(type, item.role));

// La colonne de gauche de la fiche : le fil d'Ariane, le titre, les mots-clés, les détails, les étapes, les sous-démarches, et l'alerte d'une boucle.
export function infoPane(model, proc, { t, config }) {
  const looped = model.index.loops.has(proc.row);
  const type = typeOf(config, proc);
  const chips = [type ? h('span', { class: 'gd-chip is-type' }, icon(type.glyph), h('span', null, typeLabel(type, t))) : null,
    ...proc.keywords.map(word => h('span', { class: 'gd-chip' }, word))].filter(Boolean);
  return h('div', { class: 'gd-info' }, crumbs(model, proc, t), h('h3', { class: 'gd-title' }, proc.title),
    chips.length ? h('div', { class: 'gd-chips' }, ...chips) : null,
    looped ? h('p', { class: 'gd-warn' }, icon('warning'), h('span', null, t('gd.loop'))) : null, ...typedBlocks(proc, type, config, t),
    proc.details ? h('p', { class: 'gd-details' }, proc.details) : null, stepsList(proc.steps, t), childrenList(model, proc, t, config));
}
