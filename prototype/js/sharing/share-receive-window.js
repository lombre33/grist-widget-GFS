// La fenêtre « Recevoir d'un autre document Grist » (maquette du 09/11 ; « Nouveau > Importer > D'un autre document Grist… ») : la première réception d'un
// partage. Une fenêtre à étapes (js/sharing/steps-window.js) qui montre l'étape où en est le parcours (js/sharing/share-receive-flow.js) et demande le geste
// suivant :
//   1. le code d'invitation collé ; 2. l'accord (ce que GFS ajoute dans ce document, rien sans lui : ce partage est déjà reçu ici ? la réception reprend) ; 3.
//   le lien du formulaire de réception, copié depuis Grist ;
//   4. la réponse à donner à l'envoyeur, avec le code de contrôle (le même chez lui). Le jugement d'un code ou d'un lien est celui du moteur (`errorText`) :
//   cette fenêtre n'en juge rien.
// Fermée avant que la réponse soit rendue, elle défait ce qu'elle a créé ; après, la réception reste (les fichiers arrivent quand l'envoyeur envoie).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { area, button, codeWithCopy, openSteps } from './steps-window.js';

// Un champ où l'on colle, et le bouton qui le suit : grisé tant que rien n'est collé.
function pasteField(ctx, { fk, label, action, run }) {
  const field = area(fk, label, false);
  const go = ctx.go(button(action.fk, action.label, true), () => run(field.value), () => !field.value.trim());
  go.setAttribute('aria-disabled', 'true');
  field.addEventListener('input', () => go.setAttribute('aria-disabled', field.value.trim() ? 'false' : 'true'));
  return { field, go };
}

function pasteScreen(ctx) {
  const { t } = ctx;
  const { field, go } = pasteField(ctx, { fk: 'sr-invite', label: t('sr.paste.label'), action: { fk: 'sr-continue', label: t('so.continue') },
    run: text => ctx.read(text) });
  return {
    body: h('div', { class: 'rt-content' }, h('div', { class: 'sec' }, t('sr.paste.step')), h('p', { class: 'fine' }, t('sr.paste.hint')), field,
      h('p', { class: 'fine' }, t('sr.paste.after'))),
    buttons: [ctx.cancelButton(), go],
    first: 'sr-invite',
  };
}

function accordScreen(ctx, info) {
  const { t } = ctx;
  const body = info.known
    ? [h('p', { class: 'so-lead' }, icon('info'), h('span', null, t('sr.accord.known', { name: info.name }))), h('p', { class: 'fine' }, t('sr.accord.keep'))]
    : [h('p', { class: 'so-lead' }, icon('info'), h('span', null, t('sr.accord.lead', { name: info.name }))),
      h('div', { class: 'sec' }, t('sr.accord.adds')),
      h('ul', { class: 'so-list' }, h('li', null, t('sr.accord.table', { table: info.table })), h('li', null, t('sr.accord.journal')),
        h('li', null, t('sr.accord.marks'))),
      h('p', { class: 'fine' }, t('sr.accord.rules')),
      h('p', { class: 'fine' }, t('sr.accord.keep'))];
  return {
    body: h('div', { class: 'rt-content' }, ...body),
    buttons: [ctx.cancelButton(), ctx.go(button('sr-accept', t('sr.accept'), true), () => ctx.accept())],
    first: 'sr-accept',
  };
}

function linkScreen(ctx, made) {
  const { t } = ctx;
  const { field, go } = pasteField(ctx, { fk: 'sr-link', label: t('sr.link.label'), action: { fk: 'sr-check', label: t('sr.link.check') },
    run: text => ctx.reply(text) });
  return {
    body: h('div', { class: 'rt-content' }, h('div', { class: 'sec' }, t('sr.link.step')),
      h('p', { class: 'fine' }, t('sr.link.hint', { journal: made.journal })), field),
    buttons: [ctx.cancelButton(), go],
    first: 'sr-link',
    foot: t('sr.foot.link'),
  };
}

function replyScreen(ctx, replied, table) {
  const { t } = ctx;
  const { code, copy } = codeWithCopy(ctx, { fk: 'sr-code', copyFk: 'sr-copy', label: t('sr.reply.label'), value: replied.code });
  return {
    body: h('div', { class: 'rt-content' },
      h('div', { class: 'sec' }, t('sr.reply.step')),
      h('p', { class: 'fine' }, t('sr.reply.hint')),
      h('div', { class: 'so-box' }, code, copy),
      h('div', { class: 'sec' }, t('so.verify.control')),
      h('p', { class: 'so-control', dataset: { fk: 'sr-control' } }, replied.control),
      h('p', { class: 'fine' }, t('sr.reply.after', { table }))),
    buttons: [button('so-close', t('so.close'), true)],
    first: 'sr-code',
    foot: t('sr.foot.reply'),
    close: true,
  };
}

// opts : { container, t, inertTargets, createFlow() (le parcours : createTargetFlow), errorText (le moteur), notice (un avis hors fenêtre) }. Rend la promesse
//   de sa fermeture.
export function openShareReceive(opts) {
  const { t } = opts;
  const errorText = error => (error && error.share ? t(`sr.error.${error.share}`) : opts.errorText(error));
  const steps = openSteps({ container: opts.container, t, inertTargets: opts.inertTargets, title: t('sr.title'), sub: t('sr.sub'), foot: t('sr.foot'),
    errorText });
  const { result, show } = steps;
  const flow = opts.createFlow();
  const ctx = { t, go: steps.go, cancelButton: steps.cancelButton, copy: steps.copy, replied: false };
  ctx.read = async text => show(accordScreen(ctx, await flow.read(text)));
  ctx.accept = async () => {
    const made = await flow.accept();
    ctx.table = made.table;
    show(linkScreen(ctx, made));
  };
  ctx.reply = async text => {
    const replied = await flow.reply(text);
    ctx.replied = true;
    show(replyScreen(ctx, replied, ctx.table));
  };
  show(pasteScreen(ctx));
  // Fermée avant la réponse : ce qui a été créé est défait (une réception reprise ou répondue reste).
  // `settled` (la clôture : js/sharing/sync-rules.js) vient ensuite, une fois le défait terminé.
  void result.then(async () => {
    if (!ctx.replied) await flow.abort().catch(error => opts.notice(errorText(error)));
    if (opts.settled) await Promise.resolve(opts.settled()).catch(() => {});
  });
  return result;
}
