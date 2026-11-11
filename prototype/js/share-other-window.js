// La fenêtre « Envoyer à un autre document » (maquette du 09/11 ; « Partager > Dans un autre document Grist > Relier un nouveau document… ») : le premier envoi à un document neuf, dans un seul sens, en une
// copie une fois ou en une copie qui se met à jour. Une fenêtre sur la base commune (js/modal.js : le titre et les boutons restent en place) qui montre l'étape où en est le parcours (js/share-other-flow.js)
// et demande le geste suivant :
//   1. le choix « une fois / à jour » et l'accord (ce que GFS ajoute dans ce document, rien sans lui) ; 2. le code à donner à l'autre document, puis sa réponse collée ; 3. le document qui répond, dit par Grist, avec son code de contrôle ;
//   4. l'envoi, puis « c'est arrivé » (et le partage est arrêté, ou le lien reste : le fichier suivant passe par « Partager » sans nouveau code). Le jugement d'un lien ou d'un code est celui du moteur (`errorText`) : cette fenêtre n'en juge rien.
// Fermée en cours d'envoi, elle laisse l'envoi se poursuivre ; elle défait seulement ce qui n'est pas encore parti.

import { h } from './dom.js';
import { icon } from './icons.js';
import { area, button, openSteps } from './steps-window.js';
import { FILES_TABLE } from './gfs-files.js';
import { HELPER_COLUMNS, RECEIVED_TABLE, SYNC_TABLE_NAME } from './share-other-flow.js';

const DAY_S = 24 * 60 * 60;

// Où se trouve le document qui répond, d'après la fiche que Grist donne de sa clé : son dossier, ou « espace personnel ».
const placeOf = (t, info) => (info.personal ? t('so.verify.personal') : t('so.verify.in', { folder: info.folder, team: info.team }));

// Ce que GFS ajoute dans ce document, d'après le choix (une fois : retiré à la fin ; à jour : reste tant que le lien dure).
function accordDetails(ctx) {
  const { t } = ctx;
  const live = ctx.mode === 'live';
  return [
    h('p', { class: 'so-lead' }, icon('info'), h('span', null, t(ctx.file ? (live ? 'so.accord.lead.live' : 'so.accord.lead') : 'so.link.lead'))),
    h('div', { class: 'sec' }, t('so.accord.adds')),
    h('ul', { class: 'so-list' },
      h('li', null, t(live ? 'so.accord.table.live' : 'so.accord.table', { table: SYNC_TABLE_NAME })),
      h('li', null, t('so.accord.columns', { table: FILES_TABLE, columns: HELPER_COLUMNS.join(', ') })),
      h('li', null, t(live ? 'so.accord.hook.live' : 'so.accord.hook'))),
    h('p', { class: 'fine' }, t('so.accord.rules')),
    h('p', { class: 'fine' }, t('so.accord.other', { table: RECEIVED_TABLE })),
    h('p', { class: 'fine' }, t('so.accord.keep')),
  ];
}

// Le réglage « exiger le code » : coché au départ à chaque envoi (décision du porteur, 09/11, audit de sécurité) ; décoché, le code reste affiché mais l'envoi part sans qu'on ait à confirmer l'avoir comparé.
function strictRow(ctx) {
  const { t } = ctx;
  const input = h('input', { type: 'checkbox', checked: ctx.strict, dataset: { fk: 'so-strict' } });
  input.addEventListener('change', () => { ctx.strict = input.checked; });
  return h('label', { class: 'chk so-strict' }, input, h('span', null, h('b', null, t('so.strict')), h('small', null, t('so.strict.hint'))));
}

function accordScreen(ctx) {
  const { t } = ctx;
  const details = h('div', null, ...accordDetails(ctx));
  const radio = mode => {
    const input = h('input', { type: 'radio', name: 'so-mode', value: mode, checked: ctx.mode === mode, dataset: { fk: `so-mode-${mode}` } });
    input.addEventListener('change', () => { ctx.mode = mode; details.replaceChildren(...accordDetails(ctx)); });
    return h('label', { class: 'chk' }, input, h('span', null, h('b', null, t(`so.mode.${mode}`)), h('small', null, t(`so.mode.${mode}.hint`))));
  };
  // Sans fichier, le lien est toujours « à jour » : pas de choix à faire.
  return {
    body: h('div', { class: 'rt-content' }, ...(ctx.file ? [h('div', { class: 'sec' }, t('so.mode.step')), radio('once'), radio('live')] : []), details, strictRow(ctx)),
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

// Avec « exiger le code » : « Envoyer » reste grisé tant que la case « j'ai comparé ce code » n'est pas cochée (le moteur le refuse aussi, avant toute écriture).
function verifyScreen(ctx, info) {
  const { t } = ctx;
  const send = button('so-send', t('so.send'), true);
  const compared = ctx.strict ? h('input', { type: 'checkbox', dataset: { fk: 'so-compared' } }) : null;
  const gate = () => send.setAttribute('aria-disabled', compared && !compared.checked ? 'true' : 'false');
  if (compared) { gate(); compared.addEventListener('change', gate); }
  return {
    body: h('div', { class: 'rt-content' },
      h('p', { class: 'rt-lead so-who' }, icon('check'), h('span', null, t('so.verify.lead'), h('br'), h('b', null, t('so.verify.doc', { name: info.name })), ' ', h('small', null, placeOf(t, info)))),
      h('div', { class: 'sec' }, t('so.verify.control')),
      h('p', { class: 'so-control', dataset: { fk: 'so-control' } }, info.control),
      h('p', { class: 'fine' }, t('so.verify.hint')),
      ...(compared ? [h('label', { class: 'chk so-compared' }, compared, h('span', null, h('b', null, t('so.compared'))))] : [])),
    buttons: [ctx.cancelButton(), ctx.go(send, () => ctx.send(Boolean(compared && compared.checked)), () => Boolean(compared) && !compared.checked)],
    first: compared ? 'so-compared' : 'so-send',
  };
}

function sendingScreen(ctx) {
  const { t } = ctx;
  return {
    body: h('div', { class: 'rt-content' }, h('p', { class: 'so-lead', role: 'status' }, icon('download'), h('span', null, ctx.file ? t('so.sending', { name: ctx.file.name }) : t('so.sending.link'))), h('p', { class: 'fine' }, t(ctx.file ? 'so.sending.hint' : 'so.sending.link.hint'))),
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
    body: h('div', { class: 'rt-content' }, h('p', { class: 'so-lead', role: 'status' }, icon('check'), h('span', null, ctx.file ? t('so.done', { name: ctx.file.name, doc: result.document }) : t('so.done.link', { doc: result.document }))), h('p', { class: 'fine' }, t(ctx.file ? (result.live ? 'so.done.live.hint' : 'so.done.hint') : 'so.done.link.hint'))),
    buttons: [button('so-close', t('so.close'), true)],
    first: 'so-close',
    close: true,
  };
}

// La fenêtre d'un fichier. opts : { container, t, inertTargets, settled() (appelée quand elle est fermée et que plus rien n'est en route), file ({ id, name } ; null : relier les deux documents sans fichier), createFlow(mode) (le parcours : createSourceFlow, `mode` : 'once' ou 'live'), errorText (le moteur), notice (un avis hors fenêtre), now () → ms }. Rend la promesse de sa fermeture.
export function openShareOther(opts) {
  const { t, file } = opts;
  const steps = openSteps({ container: opts.container, t, inertTargets: opts.inertTargets, title: file ? t('so.title', { name: file.name }) : t('so.title.link'), sub: file ? t('so.sub') : t('so.sub.link'), foot: t('so.foot'), errorText: opts.errorText });
  const { dialog, done, result, say, show } = steps;
  const ctx = { t, file, now: opts.now || Date.now, closed: false, sending: false, mode: file ? 'once' : 'live', strict: true, flow: null, go: steps.go, cancelButton: steps.cancelButton, copy: steps.copy };
  const settle = () => { if (opts.settled) void Promise.resolve(opts.settled()).catch(() => {}); };
  ctx.prepare = async () => {
    say(t('so.preparing'));
    ctx.flow = opts.createFlow(ctx.mode, ctx.strict);
    const made = await ctx.flow.prepare();
    if (ctx.closed) { await ctx.flow.abort().catch(() => {}); return; }
    show(codeScreen(ctx, made));
  };
  ctx.check = async text => show(verifyScreen(ctx, await ctx.flow.check(text)));
  ctx.send = async compared => {
    ctx.sending = true;
    show(sendingScreen(ctx));
    try {
      const finished = await ctx.flow.send(undefined, { compared });
      if (dialog.isConnected) show(doneScreen(ctx, finished)); else opts.notice(file ? t('so.toast.done', { name: file.name, doc: finished.document }) : t('so.toast.link', { doc: finished.document }));
    } catch (error) {
      const text = error && error.share ? t(`so.error.${error.share}`) : t('so.failed', { message: opts.errorText(error) });
      if (dialog.isConnected) show(failureScreen(ctx, text)); else opts.notice(text);
    }
    ctx.sent = true;
    if (ctx.closed) settle(); // fermée en cours d'envoi : c'est la fin de l'envoi qui clôt
  };
  ctx.stop = async () => {
    await ctx.flow.abort();
    ctx.sending = false;
    done(null);
  };
  show(accordScreen(ctx));
  // Fermée avant l'envoi : ce qui a été préparé est défait ; en cours d'envoi, l'envoi continue sans elle. `settled` (la clôture : js/sync-rules.js) vient quand plus rien n'est en route.
  void result.then(async () => {
    ctx.closed = true;
    if (!ctx.sending && ctx.flow) await ctx.flow.abort().catch(() => {});
    if (!ctx.sending || ctx.sent) settle();
  });
  return result;
}
