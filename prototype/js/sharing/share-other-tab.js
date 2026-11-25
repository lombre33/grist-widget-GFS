// L'onglet « Dans un autre document Grist » de la fenêtre « Partager » (js/sharing/share-window.js ; maquette du 09/11) : les documents déjà reliés, chacun
// avec le niveau de CE fichier (« Pas partagé », « Copie à jour », ou, par le menu, « Une copie, une fois » et « Arrêter la copie »), et « Relier un nouveau
// document… » pour le premier envoi à un document neuf (js/sharing/share-other-window.js). Ne parle ni à Grist ni au moteur : `ctx` donne les liens lus
// (js/sharing/share-links.js) et les gestes. Grisé avec sa raison, jamais masqué (charte).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openMenu } from '../ui/menu.js';
import { betaNotice } from './other-beta-notice.js';
import { levelOf, maxText } from './share-links.js';

const mark = name => h('span', { class: 'who' }, String(name || '?').trim().slice(0, 2).replace(/^./, first => first.toUpperCase()) || '?');

// Un texte qui dit « ce fichier » ou, pour un dossier, « ce dossier » : la clé du dossier est la clé du fichier suivie de « .folder ».
const word = (ctx, key) => ctx.t(ctx.other.folder ? `${key}.folder` : key);

// Le menu des niveaux d'un fichier (ou d'un dossier) chez un document : une copie une fois, une copie à jour (cochée quand c'est le cas), arrêter la copie
// (grisé, avec sa raison, quand rien n'est partagé). Un fichier de plus de 25 Mo (`other.limit`, js/sharing/share-other.js) ne peut plus y entrer : les
// deux copies (« une fois », « à jour ») sont grisées, un clic dit pourquoi ; l'arrêt reste permis (le fichier a pu entrer avant).
function levelItems(ctx, link, level) {
  const { t } = ctx;
  const limit = ctx.other.limit;
  const enter = (item, to) => ({ ...item, greyed: Boolean(limit), run: () => (limit ? ctx.say(limit) : void ctx.setLevel(link, to)) });
  return [
    enter({ label: t('so.level.once'), icon: 'copy', hint: word(ctx, 'so.level.once.hint') }, 'once'),
    enter({ label: t('so.level.live'), icon: 'link', hint: word(ctx, 'so.level.live.hint'), check: level === 'live' }, 'live'),
    '-',
    { label: t('so.level.stop'), icon: 'x', hint: t('so.level.stop.hint'), greyed: level === 'none',
      run: () => (level === 'none' ? ctx.say(word(ctx, 'so.level.stop.why')) : void ctx.setLevel(link, 'none')) },
  ];
}

function linkRow(ctx, link) {
  const { t, other } = ctx;
  const level = levelOf(link, other.fileId);
  const waiting = link.state === 'pending';
  const locked = Boolean(other.why) || waiting;
  const button = h('button', { type: 'button', class: 'lvl', 'aria-disabled': locked ? 'true' : null, 'aria-haspopup': locked ? null : 'menu',
    dataset: { fk: `other-level-${link.id}` } }, t(`so.level.${level}`), icon(locked ? 'lock' : 'chev-down'));
  button.addEventListener('click', () => (locked ? ctx.say(other.why || t('so.link.pending')) :
    openMenu(button, levelItems(ctx, link, level), { host: ctx.container, align: 'right', label: link.doc.name || link.name })));
  const tagText = link.state !== 'active' ? t(`so.state.${link.state}`) : (level === 'live' ? t('so.state.active') : null);
  return h('li', { class: 'rr', dataset: { link: link.id, level } }, mark(link.doc.name || link.name),
    h('span', { class: 'nm' }, h('b', null, link.doc.name || link.name), h('small', null,
    waiting ? t('so.link.pending') : t('so.link.sub', { n: link.files.length }))),
    tagText ? h('span', { class: 'tag' }, tagText) : null, button);
}

// Le contenu de l'onglet. ctx : { t, container, other ({ why, fileId }), links (null : en lecture ; false : illisible ; sinon la liste), setLevel(link, level),
// say(text), newDocument() }.
export function otherTab(ctx) {
  const { t, other } = ctx;
  const stuck = other.why || other.limit;
  const fresh = h('button', { type: 'button', class: 'btn', 'aria-disabled': stuck ? 'true' : null, dataset: { fk: 'other-new' } }, t('so.tab.new'));
  fresh.addEventListener('click', () => (stuck ? ctx.say(stuck) : ctx.newDocument()));
  const lead = other.folder ? t('so.tab.lead.folder', { n: other.count }) : t('so.tab.lead');
  const parts = [betaNotice(t, 'other-beta'), stuck ? h('p', { class: 'rt-lead' }, icon('lock'), h('span', null, stuck)) :
    h('p', { class: 'fine' }, lead)];
  if (other.folder && other.skipped > 0) parts.push(h('p', { class: 'fine', dataset: { fk: 'other-skipped' } },
    t('so.tab.skipped.folder', { n: other.skipped })));
  if (other.folder && other.tooBig > 0) parts.push(h('p', { class: 'fine', dataset: { fk: 'other-toobig' } },
    t('so.tab.toobig.folder', { n: other.tooBig, max: maxText(t) })));
  if (ctx.links === null) parts.push(h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('so.tab.loading')));
  else if (ctx.links === false) parts.push(h('p', { class: 'rt-none' }, t('so.tab.unreadable')));
  else {
    parts.push(h('div', { class: 'sec' }, t('so.tab.linked')), ctx.links.length ?
      h('ul', { class: 'rt-list sg-list' }, ...ctx.links.map(link => linkRow(ctx, link))) : h('p', { class: 'rt-none' }, word(ctx, 'so.tab.none')));
  }
  parts.push(h('p', { class: 'sg-actions' }, fresh));
  return h('div', { class: 'rt-content' }, ...parts);
}
