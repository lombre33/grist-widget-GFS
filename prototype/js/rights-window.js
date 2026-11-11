// Le panneau « Permissions » (étape 6, contrats 11.4 point 7 ; 11.9 point 8), en lecture : ce que les règles de Grist disent des tables de GFS et des apps, la structure du document, si la personne
// est propriétaire, et tous les liens publics du document (pour un propriétaire seulement). Il ne pose rien : poser et retirer des règles est l'étape 7, avec ses cartes. Sur la base commune des fenêtres
// (js/modal.js) : le titre et le bouton restent en place, le contenu défile. Aucune clé de lien, aucun nom de personne : seulement des tables, des pages et des nombres.

import { h } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';
import { chipKey, leadKey } from './rights.js';
import { actionsOf } from './rights-plan.js';

const section = (title, ...children) => h('section', { class: 'rt-sec' }, h('h3', null, title), ...children);

function tablesBlock(t, rules) {
  if (!rules.readable) return null;
  const rows = rules.tables.map(({ tableId, level }) => h('li', { class: 'rt-row' }, icon('table'), h('span', { class: 'rt-name' }, tableId), h('span', { class: 'rt-level', dataset: { level } }, t(`rights.level.${level}`))));
  return section(t('rights.tables'), rows.length ? h('ul', { class: 'rt-list' }, ...rows) : h('p', { class: 'rt-none' }, t('rights.tables.none')),
    h('p', { class: 'rt-struct' }, h('b', null, t('rights.structure')), ' · ', t(rules.closed ? 'rights.structure.closed' : 'rights.structure.open')));
}

// Un lien : la page qui le porte, ce qu'il laisse écrire (et les colonnes qu'il remplit sans les montrer), ce qu'il rend lisible, et l'alerte quand il ouvre une table de GFS ou d'une app.
function linkBlock(t, link) {
  const lines = [];
  for (const entry of link.filled) {
    lines.push(h('li', null, entry.rows === null || entry.rows === undefined ? t('rights.link.fillsUnknown', { table: entry.tableId }) : t('rights.link.fills', { table: entry.tableId, n: entry.rows })));
    if (entry.unshown.length) lines.push(h('li', { class: 'rt-warn' }, icon('warning'), t('rights.link.hidden', { columns: entry.unshown.join(', ') })));
  }
  for (const entry of link.readable) lines.push(h('li', null, t('rights.link.reads', { table: entry.tableId, column: entry.colId })));
  if (link.protectedOpen.length) lines.push(h('li', { class: 'rt-bad' }, icon('warning'), t('rights.link.protected', { n: link.protectedOpen.length, tables: link.protectedOpen.join(', ') })));
  if (!lines.length) lines.push(h('li', { class: 'rt-none' }, t('rights.link.empty')));
  const named = link.pages.filter(Boolean);
  const title = named.length ? named.map(page => t('rights.link.page', { page })).join(' · ') : t('rights.link.noPage');
  return h('li', { class: 'rt-link' }, h('div', { class: 'rt-link-head' }, icon('link'), h('b', null, title)), h('ul', { class: 'rt-link-lines' }, ...lines));
}

function linksBlock(t, result) {
  if (result.status !== 'ok') return section(t('rights.links'), h('p', { class: 'rt-none' }, t(`rights.links.${result.status}`)));
  return section(t('rights.links'), result.links.length ? h('ul', { class: 'rt-list' }, ...result.links.map(link => linkBlock(t, link))) : h('p', { class: 'rt-none' }, t('rights.links.none')));
}

// Le bloc « Poser des règles » (étape 7) : seulement pour un propriétaire prouvé qui lit les règles ; un geste impossible est grisé avec sa raison, jamais masqué (charte).
function actionsBlock(t, state, act) {
  if (!state.rules.readable) return null;
  const rows = actionsOf(state.plans).map(({ kind, label, hint, why }) => {
    const button = h('button', { type: 'button', class: 'btn', 'aria-disabled': kind ? null : 'true', dataset: { fk: `rights-act-${kind || 'off'}` } }, t(label));
    if (kind) button.addEventListener('click', () => act(kind));
    else button.addEventListener('click', event => event.preventDefault());
    return h('li', { class: 'rt-act' }, button, h('p', { class: kind ? 'rt-hint' : 'rt-none' }, t(kind ? hint : why)));
  });
  const manage = h('button', { type: 'button', class: 'btn', dataset: { fk: 'rights-act-manage' } }, icon('users'), t('manage.open'));
  manage.addEventListener('click', () => act('manage'));
  rows.push(h('li', { class: 'rt-act' }, manage, h('p', { class: 'rt-hint' }, t('manage.open.hint'))));
  return section(t('rights.act.title'), h('p', { class: 'rt-hint' }, t('rights.act.lead')), h('ul', { class: 'rt-list' }, ...rows));
}

// Le contenu du panneau d'après ce que le lecteur a rendu : { rules, owner, links, plans }. Une fonction de nœuds, sans état ; `act(kind)` répond au clic d'un geste possible.
export function rightsBody(t, state, act = () => {}) {
  const { rules, owner, links } = state;
  return h('div', { class: 'rt-content' },
    h('p', { class: 'rt-lead', dataset: { word: rules.readable && rules.word ? rules.word : 'none' } }, icon('shield'), h('span', null, h('b', null, t(chipKey(rules))), ' · ', t(leadKey(rules)))),
    h('p', { class: 'rt-role' }, t(`rights.role.${owner === true || owner === false ? owner : 'null'}`)),
    tablesBlock(t, rules),
    actionsBlock(t, state, act),
    linksBlock(t, links));
}

// opts : { container, t, inertTargets() -> [élément], load() -> Promise<{ rules, owner, links, plans }>, act(kind) -> Promise (le geste, question comprise) }. Rend la promesse de la fermeture.
export function openRights({ container, t, inertTargets, load, act = async () => {} }) {
  const body = h('div', { class: 'ask-body rt-body' }, h('p', { class: 'rt-none', 'aria-live': 'polite' }, t('rights.loading')));
  const close = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'rights-close' } }, t('rights.close'));
  const dialog = h('section', { class: 'mod rt', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rights-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'rights-title' }, t('rights.title'))),
    body,
    h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note' }, t('rights.foot')), close));
  const { done, result } = openModal({ container, section: dialog, inertTargets, first: close, cancel: null });
  close.addEventListener('click', () => done(null));
  // « Gérer les partages… » prend la place de ce panneau (une seule fenêtre à lire, un seul voile) ; à sa fermeture le panneau revient, avec le clavier sur le même bouton.
  const run = async kind => {
    const veil = kind === 'manage' ? dialog.closest('.mod-scrim') : null;
    if (veil) veil.classList.add('is-under');
    try { await act(kind); } finally { if (veil) veil.classList.remove('is-under'); }
    await show();
    const again = dialog.isConnected ? body.querySelector(`[data-fk="rights-act-${kind}"]`) : null;
    if (again) again.focus({ preventScroll: true });
  };
  const show = () => load().then(state => { if (dialog.isConnected) body.replaceChildren(rightsBody(t, state, kind => void run(kind))); })
    .catch(() => { if (dialog.isConnected) body.replaceChildren(h('p', { class: 'rt-none' }, t('rights.lead.unreadable'))); });
  void show();
  return result;
}
