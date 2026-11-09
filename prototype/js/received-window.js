// La fenêtre qui répond à une arrivée (« Partagés avec moi », maquette du 09/11) : « Accepter « Contrat.pdf » ? », sur la base des fenêtres à étapes (js/steps-window.js). Un oui ou un non pour CE fichier : l'écriture de la marque
// (js/received-files.js `answerFile`) est faite par le bouton, un échec est dit dans la fenêtre sans la fermer ; Échap ferme sans répondre (le fichier reste « à accepter »). Rend la promesse de la réponse :
// 'accept', 'refuse' ou null.
import { h } from './dom.js';
import { icon } from './icons.js';
import { button, openSteps } from './steps-window.js';

// ctx : { container, t, inertTargets, title, sub, who (qui partage), name, size, answer(accepté) -> Promise }.
export function openAnswer(ctx) {
  const { t } = ctx;
  const steps = openSteps({
    container: ctx.container, t, inertTargets: ctx.inertTargets, title: ctx.title, sub: ctx.sub, foot: t('rx.answer.foot'),
    errorText: error => String((error && error.message) || error).slice(0, 160),
  });
  const reply = (fk, text, accepted, primary) => steps.go(button(fk, text, primary), async () => { await ctx.answer(accepted); steps.done(accepted ? 'accept' : 'refuse'); });
  steps.show({
    body: h('div', { class: 'rt-content' },
      h('p', { class: 'so-lead' }, icon('info'), h('span', null, t('rx.answer.text', { who: ctx.who, name: ctx.name, size: ctx.size }))),
      h('p', { class: 'fine' }, t('rx.answer.keep'))),
    buttons: [reply('rx-refuse', t('rx.refuse'), false, false), reply('rx-accept', t('rx.accept'), true, true)],
    first: 'rx-accept',
  });
  return steps.result;
}
