// L'onglet « Autres documents » de « Gérer les partages » (js/manage-window.js ; maquette du 09/11) : les documents Grist reliés à celui-ci
// (js/share-links.js), avec leur état et un seul geste, arrêter (annuler, pour une invitation qui attend sa réponse). Ce qui est déjà arrivé chez l'autre y
// reste. Ne parle ni à Grist ni au moteur : `ctx` donne les liens lus et le geste.
import { h } from './dom.js';

const mark = name => h('span', { class: 'who' }, String(name || '?').trim().slice(0, 2).replace(/^./, first => first.toUpperCase()) || '?');

function linkRow(ctx, link) {
  const { t } = ctx;
  const name = link.doc.name || link.name;
  const pending = link.state === 'pending';
  const stop = h('button', { type: 'button', class: 'btn sm', dataset: { fk: `manage-other-stop-${link.id}` } },
    t(pending ? 'manage.other.cancel' : 'manage.other.stop'));
  stop.addEventListener('click', () => void ctx.stopLink(link));
  return h('li', { class: 'rr', dataset: { link: link.id, state: link.state } }, mark(name),
    h('span', { class: 'nm' }, h('b', null, name), h('small', null, pending ? t('so.link.pending') : t('so.link.files', { n: link.files.length }))),
    h('span', { class: 'tag' }, t(`so.state.${link.state}`)), stop);
}

// ctx : { t, links (null : en lecture ; false : illisible ; sinon la liste), stopLink(link), newLink() (relier un document, sans fichier) }.
export function otherManageTab(ctx) {
  const { t } = ctx;
  const lead = h('p', { class: 'fine' }, t('manage.other.lead'));
  if (ctx.links === null) return h('div', null, lead, h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('so.tab.loading')));
  if (ctx.links === false) return h('div', null, lead, h('p', { class: 'rt-none' }, t('manage.other.unreadable')));
  const fresh = h('button', { type: 'button', class: 'btn sm', dataset: { fk: 'manage-other-new' } }, t('manage.other.new'));
  fresh.addEventListener('click', () => void ctx.newLink());
  return h('div', null, lead, h('div', { class: 'sec' }, t('manage.other.title')),
    ctx.links.length ? h('ul', { class: 'rt-list sg-list' }, ...ctx.links.map(link => linkRow(ctx, link))) :
    h('p', { class: 'rt-none' }, t('manage.other.none')), h('p', null, fresh));
}
