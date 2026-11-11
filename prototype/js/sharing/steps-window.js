// La base des fenêtres à étapes du partage entre deux documents (js/sharing/share-other-window.js : celui qui envoie ; js/sharing/share-receive-window.js :
// celui qui reçoit) : une fenêtre sur la base commune (js/ui/modal.js : le titre et les boutons restent en place) qui montre un écran à la fois, avec ses
// boutons, et les gestes que tous les écrans partagent : un bouton qui fait travailler le moteur (grisé le temps du travail, l'échec dit par le moteur sans
// quitter l'écran), « Annuler », copier un code. Ne parle ni à Grist ni au moteur : les écrans et le parcours sont ceux de la fenêtre qui s'en sert.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';

export const button = (fk, label, primary = false) => h('button', { type: 'button', class: primary ? 'btn primary' : 'btn', dataset: { fk } }, label);
export const area = (fk, label, readOnly) => h('textarea', { class: 'so-code', rows: '3', spellcheck: 'false', autocomplete: 'off', readOnly,
  'aria-label': label, placeholder: readOnly ? null : label, dataset: { fk } });
// Une zone de code en lecture seule qui se sélectionne quand le clavier y arrive, et son bouton « Copier » (`ctx.copy` recopie la zone) ; `fk` et `copyFk` :
// leurs clés.
export function codeWithCopy(ctx, { fk, copyFk, label, value }) {
  const code = area(fk, label, true);
  code.value = value;
  code.addEventListener('focus', () => code.select());
  const copy = button(copyFk, ctx.t('so.code.copy'));
  copy.prepend(icon('copy'));
  copy.addEventListener('click', () => void ctx.copy(code));
  return { code, copy };
}

// opts : { container, t, inertTargets, title, sub, foot (la phrase du pied de chaque écran), errorText (le moteur dit ses refus) }. Rend { dialog, result (la
//   promesse de la fermeture), done(valeur), say(texte), show(écran), go(bouton, travail, grisé?), cancelButton(), copy(zone) } ; un écran est { body, buttons,
//   first (la clé du bouton qui reçoit le clavier), close? (« so-close » ferme la fenêtre), foot? (le texte du pied, sinon celui de la fenêtre) }.
export function openSteps(opts) {
  const { container, t } = opts;
  const body = h('div', { class: 'ask-body rt-body sh-body' });
  const status = h('p', { class: 'mod-note', 'aria-live': 'polite' }, opts.foot);
  const actions = h('span', { class: 'so-actions' });
  const dialog = h('section', { class: 'mod pt sh so', tabindex: '-1', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'so-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'so-title' }, opts.title), h('p', { class: 'mod-count' }, opts.sub)),
    body, h('footer', { class: 'mod-foot' }, status, actions));
  const { done, result } = openModal({ container, section: dialog, inertTargets: opts.inertTargets, first: dialog, cancel: null });
  const say = text => { status.textContent = text; };
  const show = screen => {
    body.replaceChildren(screen.body);
    actions.replaceChildren(...screen.buttons);
    status.textContent = screen.foot || opts.foot;
    const first = dialog.querySelector(`[data-fk="${screen.first}"]`);
    if (first) first.focus({ preventScroll: true });
    if (screen.close) for (const each of actions.querySelectorAll('[data-fk="so-close"]')) each.addEventListener('click', () => done(null));
  };
  // Un bouton qui fait travailler le moteur : grisé le temps du travail (ou tant que `idle` le dit), l'échec est dit par le moteur et la fenêtre reste où elle
  // est.
  const go = (node, job, idle = () => false) => {
    node.addEventListener('click', async () => {
      if (node.getAttribute('aria-disabled') === 'true' || idle()) return;
      node.setAttribute('aria-disabled', 'true');
      try { await job(); } catch (error) { say(t('so.failed', { message: opts.errorText(error) })); node.setAttribute('aria-disabled', 'false'); }
    });
    return node;
  };
  const cancelButton = () => {
    const cancel = button('so-cancel', t('so.cancel'));
    cancel.addEventListener('click', () => done(null));
    return cancel;
  };
  const copy = async node => {
    try { await node.ownerDocument.defaultView.navigator.clipboard.writeText(node.value); say(t('so.code.copied')); }
      catch (error) { node.focus(); node.select(); say(t('so.code.select')); }
  };
  return { dialog, result, done, say, show, go, cancelButton, copy };
}
