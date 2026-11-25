// Le message d'erreur du poids (demande du porteur, 25/11) : un bandeau rouge en haut de l'explorateur, qui reste tant que le document dépasse la limite
// (js/weight/weight-guard.js), avec un bouton qui ouvre la fenêtre « Poids du document ». GFS avertit : il ne bloque rien.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { LIMIT_GO } from './weight-guard.js';
import { formatBytes } from './weight.js';

// « Ce document pèse 12,40 Go. Il ne peut pas dépasser 13 Go. »
export const alertText = (bytes, locale, t) => t('weight.alert', { size: formatBytes(bytes, locale, t), limit: t('weight.go', { n: String(LIMIT_GO) }) });

// Le bandeau. `detail()` ouvre la fenêtre du poids.
export function alertBar({ bytes, locale, t, detail }) {
  return h('div', { class: 'banner banner--danger', role: 'alert' }, icon('warning'), h('span', { class: 'banner-text' }, alertText(bytes, locale, t)),
    h('button', { type: 'button', class: 'btn', dataset: { weightAlert: '' }, on: { click: detail } }, t('weight.alertDetail')));
}
