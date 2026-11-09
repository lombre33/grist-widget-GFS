// La fenêtre « Envoyer à un autre document » (maquette du 09/11 ; « Partager > Un autre document Grist… ») : une copie du fichier, une seule fois, dans un seul sens. Une fenêtre sur la base commune
// (js/modal.js : le titre et les boutons restent en place) qui montre l'étape où en est le parcours (js/share-other-flow.js) et demande le geste suivant :
//   1. l'accord (ce que GFS ajoute dans ce document, rien sans lui) ; 2. le code à donner à l'autre document, puis sa réponse collée ; 3. le document qui répond, dit par Grist, avec son code de contrôle ;
//   4. l'envoi, puis « c'est arrivé et le partage est arrêté ». Le jugement d'un lien ou d'un code est celui du moteur (`errorText`) : cette fenêtre n'en juge rien.
// Fermée en cours d'envoi, elle laisse l'envoi se poursuivre ; elle défait seulement ce qui n'est pas encore parti.

import { h } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';
import { FILES_TABLE } from './gfs-files.js';
import { HELPER_COLUMNS, RECEIVED_TABLE, SYNC_TABLE_NAME } from './share-other-flow.js';

const DAY_S = 24 * 60 * 60;
const button = (fk, label, primary = false) => h('button', { type: 'button', class: primary ? 'btn primary' : 'btn', dataset: { fk } }, label);
const area = (fk, label, readOnly) => h('textarea', { class: 'so-code', rows: '3', spellcheck: 'false', autocomplete: 'off', readOnly, 'aria-label': label, placeholder: readOnly ? null : label, dataset: { fk } });

// Où se trouve le document qui répond, d'après la fiche que Grist donne de sa clé : son dossier, ou « espace personnel ».
const placeOf = (t, info) => (info.personal ? t('so.verify.personal') : t('so.verify.in', { folder: info.folder, team: info.team }));

function accordScreen(ctx) {
  const { t } = ctx;
  return {
    body: h('div', { class: 'rt-content' },
      h('p', { class: 'so-lead' }, icon('info'), h('span', null, t('so.accord.lead'))),
      h('div', { class: 'sec' }, t('so.accord.adds')),
      h('ul', { class: 'so-list' },
        h('li', null, t('so.accord.table', { table: SYNC_TABLE_NAME })),
        h('li', null, t('so.accord.columns', { table: FILES_TABLE, columns: HELPER_COLUMNS.join(', ') })),
        h('li', null, t('so.accord.hook'))),
      h('p', { class: 'fine' }, t('so.accord.other', { table: RECEIVED_TABLE })),
      h('p', { class: 'fine' }, t('so.accord.keep'))),
    buttons: [ctx.cancelButton(), ctx.go(button('so-continue', t('so.continue'), true), () => ctx.prepare())],
    first: 'so-continue',
  };
}

function codeScreen(ctx, made) {
  const { t } = ctx;
  const code = area('so-code', t('so.code.label'), true);
  code.value = made.code;
  code.addEventListener('focus', () => code.select());
  const copy = button('so-copy', t('so.code.copy'));
  copy.prepend(icon('copy'));
  copy.addEventListener('click', () => void ctx.copy(code));
  const reply = area('so-reply', t('so.reply.label'), false);
  const check = button('so-check', t('so.check'), true);
  check.setAttribute('aria-disabled', 'true');
  reply.addEventListener('input', () => check.setAttribute('aria-disabled', reply.value.trim() ? 'false' : 'true'));
  const days = Math.max(1, Math.round((made.expire - ctx.now() / 1000) / DAY_S));
  return {
    body: h('div', { class: 'rt-content' },
      h('div', { class: 'sec' }, t('so.code.step')),
      h('p', { class: 'fine' }, t('so.code.hint', { n: days })),
      h('div', { class: 'so-box' }, code, copy),
      h('div', { class: 'sec' }, t('so.reply.step')),
      h('p', { class: 'fine' }, t('so.reply.hint')),
      reply),
    buttons: [ctx.cancelButton(), ctx.go(check, () => ctx.check(reply.value), () => !reply.value.trim())],
    first: 'so-code',
  };
}

function verifyScreen(ctx, info) {
  const { t } = ctx;
  return {
    body: h('div', { class: 'rt-content' },
      h('p', { class: 'rt-lead so-who' }, icon('check'), h('span', null, t('so.verify.lead'), h('br'), h('b', null, t('so.verify.doc', { name: info.name })), ' ', h('small', null, placeOf(t, info)))),
      h('div', { class: 'sec' }, t('so.verify.control')),
      h('p', { class: 'so-control', dataset: { fk: 'so-control' } }, info.control),
      h('p', { class: 'fine' }, t('so.verify.hint'))),
    buttons: [ctx.cancelButton(), ctx.go(button('so-send', t('so.send'), true), () => ctx.send())],
    first: 'so-send',
  };
}

function sendingScreen(ctx) {
  const { t } = ctx;
  return {
    body: h('div', { class: 'rt-content' }, h('p', { class: 'so-lead', role: 'status' }, icon('download'), h('span', null, t('so.sending', { name: ctx.file.name }))), h('p', { class: 'fine' }, t('so.sending.hint'))),
    buttons: [button('so-close', t('so.close'), true)],
    first: 'so-close',
    close: true,
  };
}

// L'envoi n'a pas pu finir (le lien de réception de l'autre ne répond pas, ou le temps est passé) : le partage reste là ; la personne l'arrête, ou le laisse se poursuivre tant que ce document est ouvert.
function failureScreen(ctx, text) {
  const { t } = ctx;
  const stop = ctx.go(button('so-stop', t('so.stop')), () => ctx.stop());
  return {
    body: h('div', { class: 'rt-content' }, h('p', { class: 'rt-lead', role: 'alert' }, icon('warning'), h('span', null, text)), h('p', { class: 'fine' }, t('so.error.hint'))),
    buttons: [stop, button('so-close', t('so.close'), true)],
    first: 'so-close',
    close: true,
  };
}

function doneScreen(ctx, result) {
  const { t } = ctx;
  return {
    body: h('div', { class: 'rt-content' }, h('p', { class: 'so-lead', role: 'status' }, icon('check'), h('span', null, t('so.done', { name: ctx.file.name, doc: result.document }))), h('p', { class: 'fine' }, t('so.done.hint'))),
    buttons: [button('so-close', t('so.close'), true)],
    first: 'so-close',
    close: true,
  };
}

// La fenêtre d'un fichier. opts : { container, t, inertTargets, file ({ id, name }), flow (createSourceFlow), errorText (le moteur), notice (un avis hors fenêtre), now () → ms }. Rend la promesse de sa fermeture.
export function openShareOther(opts) {
  const { container, t, file, flow } = opts;
  const body = h('div', { class: 'ask-body rt-body sh-body' });
  const status = h('p', { class: 'mod-note', 'aria-live': 'polite' }, t('so.foot'));
  const actions = h('span', { class: 'so-actions' });
  const dialog = h('section', { class: 'mod pt sh so', tabindex: '-1', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'so-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'so-title' }, t('so.title', { name: file.name })), h('p', { class: 'mod-count' }, t('so.sub'))),
    body, h('footer', { class: 'mod-foot' }, status, actions));
  const { done, result } = openModal({ container, section: dialog, inertTargets: opts.inertTargets, first: dialog, cancel: null });
  const ctx = { t, file, now: opts.now || Date.now, closed: false, sending: false };
  const say = text => { status.textContent = text; };
  const show = screen => {
    body.replaceChildren(screen.body);
    actions.replaceChildren(...screen.buttons);
    status.textContent = t('so.foot');
    const first = dialog.querySelector(`[data-fk="${screen.first}"]`);
    if (first) first.focus({ preventScroll: true });
    if (screen.close) for (const each of actions.querySelectorAll('[data-fk="so-close"]')) each.addEventListener('click', () => done(null));
  };
  // Un bouton qui fait travailler le moteur : grisé le temps du travail (ou tant que `idle` le dit), l'échec est dit par le moteur et la fenêtre reste où elle est.
  ctx.go = (node, job, idle = () => false) => {
    node.addEventListener('click', async () => {
      if (node.getAttribute('aria-disabled') === 'true' || idle()) return;
      node.setAttribute('aria-disabled', 'true');
      try { await job(); } catch (error) { say(t('so.failed', { message: opts.errorText(error) })); node.setAttribute('aria-disabled', 'false'); }
    });
    return node;
  };
  ctx.cancelButton = () => {
    const cancel = button('so-cancel', t('so.cancel'));
    cancel.addEventListener('click', () => done(null));
    return cancel;
  };
  ctx.copy = async node => {
    try { await node.ownerDocument.defaultView.navigator.clipboard.writeText(node.value); say(t('so.code.copied')); } catch (error) { node.focus(); node.select(); say(t('so.code.select')); }
  };
  ctx.prepare = async () => {
    say(t('so.preparing'));
    const made = await flow.prepare();
    if (ctx.closed) { await flow.abort().catch(() => {}); return; }
    show(codeScreen(ctx, made));
  };
  ctx.check = async text => show(verifyScreen(ctx, await flow.check(text)));
  ctx.send = async () => {
    ctx.sending = true;
    show(sendingScreen(ctx));
    try {
      const finished = await flow.send();
      if (dialog.isConnected) show(doneScreen(ctx, finished)); else opts.notice(t('so.toast.done', { name: file.name, doc: finished.document }));
    } catch (error) {
      const text = error && error.share ? t(`so.error.${error.share}`) : t('so.failed', { message: opts.errorText(error) });
      if (dialog.isConnected) show(failureScreen(ctx, text)); else opts.notice(text);
    }
  };
  ctx.stop = async () => {
    await flow.abort();
    ctx.sending = false;
    done(null);
  };
  show(accordScreen(ctx));
  // Fermée avant l'envoi : ce qui a été préparé est défait ; en cours d'envoi, l'envoi continue sans elle.
  void result.then(() => { ctx.closed = true; if (!ctx.sending) void flow.abort().catch(() => {}); });
  return result;
}
