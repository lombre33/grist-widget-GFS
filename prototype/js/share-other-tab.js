// L'onglet « Dans un autre document Grist » de la fenêtre « Partager » (js/share-window.js ; maquette du 09/11) : les documents déjà reliés, chacun avec le niveau de CE fichier (« Pas partagé », « Copie à jour »,
// ou, par le menu, « Une copie, une fois » et « Arrêter la copie »), et « Relier un nouveau document… » pour le premier envoi à un document neuf (js/share-other-window.js). Ne parle ni à Grist ni au moteur :
// `ctx` donne les liens lus (js/share-links.js) et les gestes. Grisé avec sa raison, jamais masqué (charte).
import { h } from './dom.js';
import { icon } from './icons.js';
import { openMenu } from './menu.js';
import { levelOf } from './share-links.js';

const mark = name => h('span', { class: 'who' }, String(name || '?').trim().slice(0, 2).replace(/^./, first => first.toUpperCase()) || '?');

// Le menu des niveaux d'un fichier chez un document : une copie une fois, une copie à jour (cochée quand c'est le cas), arrêter la copie (grisé, avec sa raison, quand le fichier n'est pas partagé).
function levelItems(ctx, link, level) {
  const { t } = ctx;
  return [
    { label: t('so.level.once'), icon: 'copy', hint: t('so.level.once.hint'), run: () => void ctx.setLevel(link, 'once') },
    { label: t('so.level.live'), icon: 'link', hint: t('so.level.live.hint'), check: level === 'live', run: () => void ctx.setLevel(link, 'live') },
    '-',
    { label: t('so.level.stop'), icon: 'x', hint: t('so.level.stop.hint'), greyed: level === 'none', run: () => (level === 'none' ? ctx.say(t('so.level.stop.why')) : void ctx.setLevel(link, 'none')) },
  ];
}

function linkRow(ctx, link) {
  const { t, other } = ctx;
  const level = levelOf(link, other.fileId);
  const waiting = link.state === 'pending';
  const locked = Boolean(other.why) || waiting;
  const button = h('button', { type: 'button', class: 'lvl', 'aria-disabled': locked ? 'true' : null, 'aria-haspopup': locked ? null : 'menu', dataset: { fk: `other-level-${link.id}` } }, t(`so.level.${level}`), icon(locked ? 'lock' : 'chev-down'));
  button.addEventListener('click', () => (locked ? ctx.say(other.why || t('so.link.pending')) : openMenu(button, levelItems(ctx, link, level), { host: ctx.container, align: 'right', label: link.doc.name || link.name })));
  const tagText = link.state !== 'active' ? t(`so.state.${link.state}`) : (level === 'live' ? t('so.state.active') : null);
  return h('li', { class: 'rr', dataset: { link: link.id, level } }, mark(link.doc.name || link.name), h('span', { class: 'nm' }, h('b', null, link.doc.name || link.name), h('small', null, waiting ? t('so.link.pending') : t('so.link.sub', { n: link.files.length }))),
    tagText ? h('span', { class: 'tag' }, tagText) : null, button);
}

// Le contenu de l'onglet. ctx : { t, container, other ({ why, fileId }), links (null : en lecture ; false : illisible ; sinon la liste), setLevel(link, level), say(text), newDocument() }.
export function otherTab(ctx) {
  const { t, other } = ctx;
  const fresh = h('button', { type: 'button', class: 'btn', 'aria-disabled': other.why ? 'true' : null, dataset: { fk: 'other-new' } }, t('so.tab.new'));
  fresh.addEventListener('click', () => (other.why ? ctx.say(other.why) : ctx.newDocument()));
  const parts = [other.why ? h('p', { class: 'rt-lead' }, icon('lock'), h('span', null, other.why)) : h('p', { class: 'fine' }, t('so.tab.lead'))];
  if (ctx.links === null) parts.push(h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('so.tab.loading')));
  else if (ctx.links === false) parts.push(h('p', { class: 'rt-none' }, t('so.tab.unreadable')));
  else {
    parts.push(h('div', { class: 'sec' }, t('so.tab.linked')), ctx.links.length ? h('ul', { class: 'rt-list sg-list' }, ...ctx.links.map(link => linkRow(ctx, link))) : h('p', { class: 'rt-none' }, t('so.tab.none')));
  }
  parts.push(h('p', { class: 'sg-actions' }, fresh));
  return h('div', { class: 'rt-content' }, ...parts);
}
