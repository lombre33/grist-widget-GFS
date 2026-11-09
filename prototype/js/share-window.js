// La fenêtre « Partager » d'un fichier (contrats 11.7, point 13 ; maquettes du 06/11) : qui a accès et à quel droit, une seule zone pour ajouter (personnes déjà connues de GFS, catégories, une adresse),
// l'activation du partage la première fois. Elle ne parle pas à Grist : `load()` rend l'état, `onAdd`, `onChange`, `onRemove` et `onActivate` écrivent (js/share-control.js). Sur la base commune des
// fenêtres (js/modal.js) : le titre et le bouton restent en place, seul le contenu défile. Un geste impossible est grisé avec sa raison, jamais masqué (charte).

import { h } from './dom.js';
import { icon } from './icons.js';
import { openModal, listKeys } from './modal.js';
import { openMenu } from './menu.js';
import { words, normalize, matchesWords } from './search.js';
import { CATEGORIES, GROUP_PREFIX, isGroup, shareRecord } from './sharing-model.js';
import { otherTab } from './share-other-tab.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Les cinq droits de la maquette ; « commentaire » et « dépôt seul » attendent leurs tables (grisés, avec la raison), un droit d'administration ne se donne pas à une catégorie.
const LEVELS = Object.freeze([{ key: 'lecture', glyph: 'read' }, { key: 'commentaire', glyph: 'info', later: true }, { key: 'depot', glyph: 'download', later: true }, { key: 'ecriture', glyph: 'edit' }, { key: 'admin', glyph: 'shield' }, { key: 'aucun', glyph: 'lock' }]);
const CATS = Object.freeze([{ who: CATEGORIES.editeurs, key: 'editeurs', glyph: 'edit' }, { who: CATEGORIES.tous, key: 'tous', glyph: 'globe' }]);
const isCategory = who => String(who).startsWith('@');

// Un droit d'administration ne se donne qu'à une personne : ni une catégorie ni un groupe.
const notPerson = who => isCategory(who) || isGroup(who);

export const whoLabel = (t, who) => (isCategory(who) ? t(`share.cat.${String(who).slice(1)}`) : (isGroup(who) ? t('share.group.label', { name: String(who).slice(1) }) : who));

// Ce que la zone d'ajout propose pour `text` : { people, categories, groups, invite }. Jamais une personne ni une catégorie déjà dans la liste, jamais la personne elle-même.
export function suggestions(t, state, text) {
  const needles = words(text);
  const have = new Set(state.shares.filter(share => !share.inherited).map(share => share.who.toLowerCase()));
  const skip = new Set([...have, state.me, state.author].filter(Boolean));
  const people = state.people.filter(email => !skip.has(email) && matchesWords(needles, normalize(email))).map(email => ({ who: email, label: email, glyph: 'user' }));
  const categories = CATS.filter(cat => !have.has(cat.who) && matchesWords(needles, normalize(t(`share.cat.${cat.key}`)))).map(cat => ({ who: cat.who, label: t(`share.cat.${cat.key}`), hint: t(`share.cat.${cat.key}.hint`), glyph: cat.glyph }));
  const groups = (state.groups || []).filter(group => !have.has(`${GROUP_PREFIX}${group.name}`.toLowerCase()) && matchesWords(needles, normalize(group.name))).map(group => ({ who: `${GROUP_PREFIX}${group.name}`, label: group.name, hint: t('share.group.hint', { n: group.count }), glyph: 'users' }));
  const typed = String(text || '').trim().toLowerCase();
  const invite = EMAIL.test(typed) && !skip.has(typed) && !state.people.includes(typed) ? { who: typed, label: t('share.suggest.invite', { email: typed }), hint: t('share.suggest.inviteHint'), glyph: 'mail' } : null;
  return { people, categories, groups, invite };
}

// Les articles du menu des droits : celui d'aujourd'hui coché ; grisés avec leur raison ; « Retirer l'accès » en dernier (sauf pour un nouveau partage, pas encore écrit).
export function levelItems(t, { current, category, onPick, onRemove, onWhy }) {
  const items = LEVELS.map(level => {
    const why = level.later ? t(`share.right.${level.key}.why`) : (level.key === 'admin' && category ? t('share.right.admin.person') : (level.key === 'aucun' && category ? t('share.right.aucun.category') : null));
    return { label: t(`share.right.${level.key}`), icon: level.glyph, hint: t(`share.right.${level.key}.hint`), check: level.key === current, greyed: Boolean(why), run: () => (why ? onWhy(why) : onPick(level.key)) };
  });
  return onRemove ? [...items, '-', { label: t('share.remove'), icon: 'x', run: onRemove }] : items;
}

const initials = text => String(text).replace(/@.*/, '').split(/[._\s-]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
const avatar = who => (isCategory(who) ? icon(CATS.find(cat => cat.who === who)?.glyph || 'user', 'big') : (isGroup(who) ? icon('users', 'big') : h('span', { class: 'who' }, initials(who))));

function dateText(seconds, locale) {
  try { return new Date(seconds * 1000).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }); } catch (error) { return ''; }
}

// D'où vient un droit hérité : le document entier, l'espace, ou un dossier de l'espace.
const inheritedText = (t, from) => (from && from.kind === 'space' ? t('share.row.inherited.space', { name: from.name }) : (from && from.kind === 'folder' ? t('share.row.inherited.folder', { name: from.name }) : t('share.row.inherited')));

// Une ligne de « Qui a accès » : l'avatar ou l'icône, le nom, ses détails (fin d'accès, téléchargement, validité), et le droit (un bouton qui ouvre le menu quand la personne peut changer les partages).
function row(ctx, share) {
  const { t, state } = ctx;
  const expired = !share.active;
  const notes = [];
  if (share.end && !expired) notes.push(t('share.row.until', { date: dateText(share.end, ctx.locale) }));
  if (expired) notes.push(t('share.row.expired', { date: dateText(share.end, ctx.locale) }));
  if (share.download) notes.push(t('share.row.download'));
  if (!share.valid) notes.push(t('share.row.invalid'));
  const label = share.inherited ? `${whoLabel(t, share.who)} · ${inheritedText(t, share.from)}` : whoLabel(t, share.who) + (share.who.toLowerCase() === state.me ? t('share.row.me') : '');
  const locked = share.inherited || !state.canManage;
  const button = h('button', { type: 'button', class: 'lvl', 'aria-disabled': locked ? 'true' : null, 'aria-haspopup': locked ? null : 'menu', dataset: { fk: `share-level-${share.id}` } }, t(`share.right.${share.right}`), icon(locked ? 'lock' : 'chev-down'));
  if (!locked) button.addEventListener('click', () => openMenu(button, levelItems(t, {
    current: share.right, category: notPerson(share.who), onPick: right => ctx.change(share, right), onRemove: () => ctx.remove(share), onWhy: why => ctx.say(why),
  }), { host: ctx.container, align: 'right', label: t('share.sec.access') }));
  const tags = [!share.valid ? t('share.tag.invalid') : null, expired ? t('share.tag.expired') : null].filter(Boolean).map(text => h('span', { class: 'tag' }, text));
  return h('li', { class: 'rr', dataset: { share: String(share.id) } }, avatar(share.who), h('span', { class: 'nm' }, h('b', null, label), notes.length ? h('small', null, notes.join(' · ')) : null), ...tags, button);
}

// Les deux lignes qui sont toujours là : les propriétaires, et l'auteur du fichier.
function fixedRows(ctx) {
  const { t, state } = ctx;
  const lock = h('span', { class: 'lvl', 'aria-disabled': 'true' }, t('share.right.admin'), icon('lock'));
  const rows = [h('li', { class: 'rr', dataset: { fixed: 'owners' } }, icon('shield', 'big'), h('span', { class: 'nm' }, h('b', null, t('share.row.owners')), h('small', null, t('share.row.owners.hint'))), lock.cloneNode(true))];
  if (state.author) rows.push(h('li', { class: 'rr', dataset: { fixed: 'author' } }, avatar(state.author), h('span', { class: 'nm' }, h('b', null, t('share.row.author', { who: state.author }) + (state.author === state.me ? t('share.row.me') : ''))), lock));
  return rows;
}

// Une proposition de la liste : un bouton (grisé et cliquable pour dire pourquoi, jamais masqué).
function suggestion(item, run, why) {
  const button = h('button', { type: 'button', class: 'opt', role: 'option', 'aria-disabled': why ? 'true' : null, dataset: { fk: `share-pick-${String(item.who || item.label)}` } }, item.who ? avatar(item.who) : icon(item.glyph || 'user', 'big'), h('span', null, h('b', null, item.label), item.hint ? h('small', null, item.hint) : null));
  button.addEventListener('click', () => run(why));
  return button;
}

function suggestionList(ctx, found) {
  const { t } = ctx;
  const groups = [[t('share.suggest.people'), [...found.people, ...(found.invite ? [found.invite] : [])]], [t('share.suggest.cats'), found.categories], [t('share.suggest.groups'), found.groups]];
  const nodes = [];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    nodes.push(h('div', { class: 'sec' }, title));
    for (const item of items) nodes.push(suggestion(item, () => ctx.choose(item.who)));
  }
  if (!found.people.length && !found.invite && !found.categories.length && !found.groups.length) nodes.push(h('p', { class: 'fine' }, t('share.suggest.none')));
  return h('div', { class: 'drop', role: 'listbox', 'aria-label': t('share.add.label') }, ...nodes);
}

// Les deux onglets (« Dans ce document », « Dans un autre document Grist »), quand l'autre document est possible.
function tabsBar(ctx) {
  const { t } = ctx;
  return h('div', { class: 'mg-tabs', role: 'tablist', 'aria-label': t('share.sec.access') }, ...['here', 'other'].map(key => {
    const tab = h('button', { type: 'button', role: 'tab', class: 'mg-tab', 'aria-selected': String(ctx.tab === key), dataset: { fk: `share-tab-${key}` } }, t(`share.tab.${key}`));
    tab.addEventListener('click', () => ctx.goTab(key));
    return tab;
  }));
}

// La zone d'ajout : un champ, et sa liste qui se redessine à chaque touche.
function addField(ctx) {
  const { t, state } = ctx;
  const input = h('input', { type: 'text', autocomplete: 'off', placeholder: t('share.add.placeholder'), 'aria-label': t('share.add.label'), dataset: { fk: 'share-add' } });
  const slot = h('div', { class: 'sg-slot' });
  const draw = () => slot.replaceChildren(suggestionList(ctx, suggestions(t, state, input.value)));
  input.addEventListener('focus', draw);
  input.addEventListener('click', draw); // le champ déjà actif (la liste fermée par Échap) rouvre sa liste au clic
  input.addEventListener('input', draw);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && slot.firstChild) { event.preventDefault(); event.stopPropagation(); slot.replaceChildren(); return; }
    listKeys(event, { search: input, items: [...slot.querySelectorAll('button.opt')] });
  });
  slot.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); slot.replaceChildren(); input.focus(); } else listKeys(event, { search: input, items: [...slot.querySelectorAll('button.opt')] }); });
  return h('div', { class: 'sg-add' }, h('div', { class: 'field' }, icon('search'), input), slot);
}

// Après le choix d'une personne : son droit, « Peut télécharger », la fin d'accès, puis « Ajouter ».
function pendingForm(ctx, who) {
  const { t } = ctx;
  let right = 'lecture';
  const level = h('button', { type: 'button', class: 'lvl', 'aria-haspopup': 'menu', dataset: { fk: 'share-new-level' } }, t(`share.right.${right}`), icon('chev-down'));
  const setLevel = next => { right = next; level.replaceChildren(t(`share.right.${right}`), icon('chev-down')); };
  level.addEventListener('click', () => openMenu(level, levelItems(t, { current: right, category: notPerson(who), onPick: setLevel, onWhy: why => ctx.say(why) }), { host: ctx.container, align: 'right', label: t('share.sec.add') }));
  const download = h('input', { type: 'checkbox', dataset: { fk: 'share-download' } });
  const endOn = h('input', { type: 'checkbox', dataset: { fk: 'share-end-on' } });
  const date = h('input', { type: 'date', disabled: true, 'aria-label': t('share.end.date'), dataset: { fk: 'share-end' } });
  endOn.addEventListener('change', () => { date.disabled = !endOn.checked; if (endOn.checked) date.focus(); });
  const yes = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'share-confirm' } }, t('share.confirm'));
  const no = h('button', { type: 'button', class: 'btn', dataset: { fk: 'share-cancel' } }, t('share.cancel'));
  no.addEventListener('click', () => ctx.choose(null));
  yes.addEventListener('click', () => {
    const end = endOn.checked && date.value ? Date.UTC(...date.value.split('-').map((part, at) => (at === 1 ? Number(part) - 1 : Number(part)))) / 1000 : null;
    void ctx.add(shareRecord({ target: ctx.target, who, right, download: download.checked, end }));
  });
  return h('div', { class: 'sg-new', dataset: { who } },
    h('div', { class: 'rr' }, avatar(who), h('span', { class: 'nm' }, h('b', null, whoLabel(t, who))), level),
    h('label', { class: 'chk' }, download, h('span', null, h('b', null, t('share.download')), h('small', null, t('share.download.hint')))),
    h('label', { class: 'chk' }, endOn, h('span', null, h('b', null, t('share.end')), h('small', null, date), h('small', null, t('share.end.hint')))),
    h('p', { class: 'sg-actions' }, no, yes));
}

// L'état « partage pas activé » : le propriétaire peut l'activer ; les autres lisent à qui le demander.
function inactiveBlock(ctx) {
  const { t, state } = ctx;
  const word = state.extend === 'upgrade' ? 'share.upgrade' : (state.extend ? 'share.extend' : 'share.inactive');
  if (state.owner === true) {
    const activate = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'share-activate' } }, t(state.extend === 'upgrade' ? 'share.upgrade.activate' : (state.extend ? 'share.extend.activate' : 'share.inactive.activate')));
    activate.addEventListener('click', () => void ctx.activate());
    return h('div', { class: 'rt-content' }, h('p', { class: 'fine' }, t(`${word}.owner`)), h('p', { class: 'sg-actions' }, activate));
  }
  return h('div', { class: 'rt-content' }, h('p', { class: 'rt-lead' }, icon('lock'), h('span', null, t(state.owner === false ? `${word}.other` : 'share.inactive.unknown'))));
}

// Le contenu d'après l'état : { active, owner, canManage, shares, me, author, people }. `ctx.pending` : la personne choisie, pas encore ajoutée.
export function shareBody(ctx) {
  const { t, state } = ctx;
  if (!state.active) return inactiveBlock(ctx);
  const parts = [];
  if (state.canManage) parts.push(ctx.pending ? h('div', null, h('div', { class: 'sec' }, t('share.sec.add')), pendingForm(ctx, ctx.pending)) : addField(ctx));
  else parts.push(h('p', { class: 'fine', dataset: { fk: 'share-readonly' } }, t('share.readonly')));
  parts.push(h('div', { class: 'sec' }, t('share.sec.access')), h('ul', { class: 'rt-list sg-list' }, ...fixedRows(ctx), ...state.shares.map(share => row(ctx, share))));
  return h('div', { class: 'rt-content' }, ...parts);
}

// opts : { container, t, locale, inertTargets, file: { key, name, app }, load() → état, onAdd(record), onChange(id, patch), onRemove(id) → { ok, message? }, onActivate() → true quand Grist va recharger,
// onManage() ouvre « Gérer les partages » (propriétaire), other: { why, fileId, loadLinks(), onLevel(link, level) → { ok, message?, note? }, onNew() } ou state → cet objet (l'onglet « Dans un autre document Grist » :
// js/share-other-tab.js, js/share-other.js ; sans lui, pas d'onglets) }. Rend la promesse de la fermeture.
export function openShare(opts) {
  const { container, t, file } = opts;
  const body = h('div', { class: 'ask-body rt-body sh-body' }, h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('share.loading')));
  const status = h('p', { class: 'mod-note', 'aria-live': 'polite' }, t('share.foot'));
  const close = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'share-close' } }, t('share.done'));
  // « Gérer les partages… » : les groupes, les catégories et la structure (js/manage-window.js) ; grisé avec sa raison pour qui n'est pas propriétaire.
  const manage = h('button', { type: 'button', class: 'btn', 'aria-disabled': opts.onManage ? null : 'true', dataset: { fk: 'share-manage' } }, icon('users'), t('manage.open'));
  const dialog = h('section', { class: 'mod pt sh', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'share-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'share-title' }, t('share.title', { name: file.name })), h('p', { class: 'mod-count' }, t('share.sub', { app: file.app }))),
    body, h('footer', { class: 'mod-foot' }, status, manage, close));
  const { done, result } = openModal({ container, section: dialog, inertTargets: opts.inertTargets, first: close, cancel: null });
  close.addEventListener('click', () => done(null));
  const ctx = { t, container, locale: opts.locale, target: file.key, state: null, pending: null, tab: 'here', links: null, other: null, say: text => { status.textContent = text; } };
  const draw = () => {
    if (!dialog.isConnected || !ctx.state) return;
    const content = ctx.other && ctx.tab === 'other' ? otherTab(ctx) : shareBody(ctx);
    if (ctx.other) content.prepend(tabsBar(ctx));
    body.replaceChildren(content);
    // Après le choix d'une personne, le formulaire est sous les yeux : le clavier est sur le droit, et « Ajouter » (en bas du formulaire) se montre, même sur un petit panneau.
    const form = body.querySelector('.sg-new');
    if (form) { body.querySelector('[data-fk="share-new-level"]').focus({ preventScroll: true }); body.querySelector('.sg-actions').scrollIntoView({ block: 'nearest' }); }
  };
  const otherOf = () => (typeof opts.other === 'function' ? opts.other(ctx.state) : opts.other) || null;
  // Les documents reliés ne se lisent qu'à l'ouverture de leur onglet (le moteur de partage ne se charge pas pour qui ne s'en sert pas), puis à chaque relecture.
  const readLinks = async () => { try { ctx.links = await ctx.other.loadLinks(); } catch (error) { ctx.links = false; } };
  const reload = async () => {
    try {
      ctx.state = await opts.load(); ctx.pending = null; ctx.other = otherOf();
      if (ctx.other && ctx.links !== null) await readLinks();
      draw();
    } catch (error) { if (dialog.isConnected) body.replaceChildren(h('p', { class: 'rt-none' }, t('share.unreadable'))); }
  };
  const write = async job => {
    const answer = await job();
    ctx.say(answer && !answer.ok ? t('share.failed', { message: answer.message || '' }) : ((answer && answer.note) || t('share.foot')));
    if (!answer || answer.ok) await reload();
    return answer;
  };
  ctx.goTab = async tab => {
    ctx.tab = tab;
    if (tab === 'other' && ctx.links === null) { draw(); await readLinks(); }
    draw();
  };
  ctx.setLevel = (link, level) => write(() => ctx.other.onLevel(link, level));
  ctx.newDocument = async () => {
    await ctx.other.onNew();
    if (dialog.isConnected) await reload();
  };
  ctx.choose = who => { ctx.pending = who; draw(); };
  ctx.add = record => (record ? write(() => opts.onAdd(record)) : Promise.resolve());
  ctx.change = (share, right) => write(() => opts.onChange(share.id, { Droit: right }));
  ctx.remove = share => write(() => opts.onRemove(share.id));
  ctx.activate = async () => { if (!(await opts.onActivate())) await reload(); };
  manage.addEventListener('click', async () => {
    if (!opts.onManage) return;
    if (!ctx.state || ctx.state.owner !== true) { ctx.say(t('manage.other')); return; }
    await opts.onManage();
    if (dialog.isConnected) await reload();
  });
  void reload();
  return result;
}
