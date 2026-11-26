// La fenêtre du verrou (module Annuaire ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu ») : l'état du verrou, les règles que Grist appliquera
// dites en phrases, ce que cela change, les règles exactes telles que Grist les range, et les gestes (poser ou mettre à jour, retirer, fermer la structure).
// Elle ne parle pas à Grist : ce qu'elle montre vient de js/annuaire/annuaire-lock-view.js, et la pose est à js/annuaire/annuaire-lock-control.js. Une fenêtre
// du widget sur la base commune (js/ui/modal.js). Grisé, jamais masqué : un geste impossible reste là, avec sa raison. Rend { action, structure } : `action`
// vaut 'put', 'update', 'remove', 'close' ou null quand la personne renonce ; `structure` dit si elle a gardé « fermer aussi la structure ».

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { switchButton } from './annuaire-setup-shared.js';

const list = items => h('ul', { class: 'an-lk-list' }, ...items.map(item => h('li', null, item)));
const section = (title, ...body) => h('section', { class: 'an-lk-sec' }, h('h3', null, title), ...body);
const NOTHING = Object.freeze({ action: null, structure: false });

// Les règles exactes : une entrée par ressource, chacune avec ses lignes « condition → droits », puis les colonnes d'aide.
function codeBlock(codes) {
  const lines = codes.groups.map(group => h('div', { class: 'an-lk-grp' }, h('b', null, group.where),
    ...group.lines.map(line => h('code', { class: 'an-lk-line' }, `${line.formula} → ${line.rights}`))));
  const helpers = codes.helpers.map(each => h('div', { class: 'an-lk-grp' }, h('b', null, each.id),
    h('code', { class: 'an-lk-line an-lk-formula' }, each.formula)));
  return h('div', { class: 'an-lk-code', hidden: true }, ...lines, ...helpers);
}

// La ligne de la structure : déjà fermée (dit), à fermer en même temps (un interrupteur, proposé), ou dite seulement.
function structureNode(model, t, on) {
  if (!model.spec.ok || model.state === 'foreign') return null;
  if (model.closed) return h('p', { class: 'an-lk-ok' }, icon('check'), t('an.lock.structure.closed'));
  if (!model.offer) return h('p', { class: 'an-set-hint' }, t('an.lock.structure.closeSub'));
  return h('div', { class: 'an-ob-row' }, switchButton({ on, label: t('an.lock.structure.close'), fk: 'lk-structure', data: { act: 'lk-structure' } }),
    h('span', { class: 'an-ob-t' }, h('b', null, t('an.lock.structure.close')), h('small', null, t('an.lock.structure.closeSub'))));
}

const toneOf = model => (model.state === 'current' ? 'ok' : (model.ready || model.state === 'none' ? 'info' : 'warn'));

// Les quatre boutons du pied : un geste impossible reste là, grisé, avec sa raison au survol.
function buttons(model, t) {
  const one = (label, fk, off, why, primary = false) => h('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`,
    'aria-disabled': off ? 'true' : null,
    title: off && why ? why : null, dataset: { fk, act: fk } }, label);
  const acts = model.put || model.remove || model.close;
  return { cancel: one(t(acts ? 'an.lock.cancel' : 'an.lock.close'), 'lk-cancel', false),
    remove: one(t('an.lock.remove'), 'lk-remove', !model.remove, t('an.lock.removeNone')),
    close: one(t('an.lock.closeNow'), 'lk-close', !model.close, t(model.closed ? 'an.lock.structure.closed' : 'an.lock.closeNone')),
    put: one(t(model.put === 'update' ? 'an.lock.update' : 'an.lock.put'), 'lk-put', !model.put, model.text, true) };
}

// Les gestes de la fenêtre : l'interrupteur de la structure et le volet des règles exactes.
function wireBody(body, code, state, t) {
  body.addEventListener('click', event => {
    const target = event.target.closest('[data-act]');
    if (!target) return;
    if (target.dataset.act === 'lk-structure') {
      state.structure = !state.structure;
      target.classList.toggle('is-on', state.structure);
      target.setAttribute('aria-checked', String(state.structure));
    } else if (target.dataset.act === 'lk-code' && code) {
      const open = code.hidden;
      code.hidden = !open;
      target.setAttribute('aria-expanded', String(open));
      target.replaceChildren(icon(open ? 'chev-down' : 'chev-right'), t('an.lock.code.title'));
      if (open) code.scrollIntoView({ block: 'nearest' });
    }
  });
}

// opts : { container, inertTargets(), t, model (voir lockModel), name (l'annuaire), table }
export function openLockWindow({ container, inertTargets, t, model, name, table }) {
  const state = { structure: model.offer };
  const foot = buttons(model, t);
  const code = model.codes ? codeBlock(model.codes) : null;
  const toggle = h('button', { type: 'button', class: 'an-disclose-b', 'aria-expanded': 'false', dataset: { fk: 'lk-code', act: 'lk-code' } },
    icon('chev-right'),
    t('an.lock.code.title'));
  const structure = structureNode(model, t, state.structure);
  const body = h('div', { class: 'mod-body an-set-body an-lk-body' }, h('p', { class: `an-lk-state is-${toneOf(model)}`, role: 'status' }, model.text),
    ...(model.rules.length ? [section(t('an.lock.h.rules', { table }), list(model.rules))] : []),
    ...(model.costs.length ? [section(t('an.lock.h.costs'), list(model.costs))] : []), ...(structure ? [structure] : []),
    ...(code ? [h('div', { class: 'an-disclose' }, toggle), code] : []));
  const dialog = h('section', { class: 'mod an-set an-lk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-lk-title' },
    h('header', { class: 'mod-head an-ed-head' }, h('h2', { id: 'an-lk-title' }, t('an.lock.title')), h('span', { class: 'an-ed-who' }, name)), body,
    h('footer', { class: 'mod-foot' }, h('span', { class: 'an-grow' }), foot.cancel, foot.remove, foot.close, foot.put));
  const { done, result } = openModal({ container, section: dialog, inertTargets, first: foot.cancel, cancel: NOTHING });
  const finish = (action, node) => { if (node.getAttribute('aria-disabled') !== 'true') done({ action, structure: state.structure }); };
  foot.cancel.addEventListener('click', () => done(NOTHING));
  foot.remove.addEventListener('click', () => finish('remove', foot.remove));
  foot.close.addEventListener('click', () => finish('close', foot.close));
  foot.put.addEventListener('click', () => finish(model.put, foot.put));
  wireBody(body, code, state, t);
  return result;
}
