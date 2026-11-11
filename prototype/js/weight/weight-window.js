// La fenêtre « Poids du document » (lot 4 du poids, demande du porteur du 04/11 ; contrats 2.4 point 5) : un clic sur le total du pied de l'explorateur
// l'ouvre. En haut, ce que la liste montre (l'estimation, qui est toujours là) ; dessous, ce que Grist garde, lu dans sa base (js/weight/weight-reader.js) : le
// fichier entier, les tables, les pièces jointes, l'historique des modifications, le reste ; enfin chaque table avec son poids exact, lues l'une après l'autre.
// Sur la base commune des fenêtres (js/ui/modal.js) : le titre et le bouton restent en place, le contenu défile. Elle ne pose rien et ne garde rien.
//
// Sans le droit de tout copier (ou si Grist ne répond pas), le bloc « Ce que Grist garde » reste là, grisé, avec la raison : grisé, jamais masqué.
// L'estimation, elle, ne dépend de rien. Les lignes sont dessinées une fois et mises à jour à chaque lecture : le défilement de la liste des tables n'est pas
// remis en haut pendant que les tables se lisent.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { formatBytes } from './weight.js';

const LINES = ['file', 'data', 'attachments', 'history', 'rest'];

// Les lignes du bloc « Ce que Grist garde » : un nom, une infobulle qui dit d'où vient le chiffre, et la valeur (mise à jour à chaque lecture).
function linesBlock(t) {
  const values = {};
  const rows = LINES.map(key => {
    values[key] = h('dd', { class: 'wd-v' }, t('wd.none'));
    return h('div', { class: `wd-line wd-${key}`, title: t(`wd.${key}Tip`) }, h('dt', null, t(`wd.${key}`)), values[key]);
  });
  return { node: h('dl', { class: 'wd-lines' }, ...rows), values };
}

// Le contenu, ses éléments mis à jour par `update(état)` (l'état de js/weight/weight-reader.js, ou null avant la première lecture). `estimate` : { list
// (octets), pj (null ou { bytes }) }.
export function buildWeightView({ t, locale, estimate }) {
  const show = bytes => (bytes === null || bytes === undefined ? t('wd.none') : formatBytes(bytes, locale, t));
  const lead = [h('p', { class: 'wd-lead' }, h('b', null, `${t('wd.estimate')} : `), t('wd.estimateText', { list: show(estimate.list) }))];
  if (estimate.pj) lead.push(h('p', { class: 'wd-lead' }, t('wd.estimatePj', { total: show(estimate.list + estimate.pj.bytes) })));
  const message = h('p', { class: 'wd-state', role: 'status', 'aria-live': 'polite' }, t('wd.loading'));
  const { node: lines, values } = linesBlock(t);
  const progress = h('span', { class: 'wd-progress' });
  const list = h('ul', { class: 'wd-tables' });
  const exact = h('section', { class: 'wd-sec wd-exact', dataset: { state: 'loading' } }, h('h3', null, t('wd.exact')), message, lines);
  const tables = h('section', { class: 'wd-sec wd-tablesec', dataset: { state: 'loading' } }, h('h3', null, t('wd.tables'), ' ', progress), list);
  const root = h('div', { class: 'wd-content' }, ...lead, exact, tables);
  const rowNodes = new Map();

  // Une ligne de table : son nom, une barre à l'échelle de la plus lourde, son poids (ou pourquoi elle n'en a pas).
  const tableValue = row => ({ ok: show(row.bytes), wait: t('wd.tableWait'), slow: t('wd.tableSlow'), failed: t('wd.tableFailed') }[row.state]);
  function placeTables(state) {
    const largest = Math.max(1, ...state.tables.map(row => row.bytes || 0));
    const nodes = state.tables.map(row => {
      let node = rowNodes.get(row.name);
      if (!node) {
        node = { li: h('li', { class: 'wd-row' }), name: h('span', { class: 'wd-name', title: row.name }, row.name), bar: h('i'),
          value: h('span', { class: 'wd-num' }) };
        node.li.append(node.name, h('span', { class: 'wd-bar', 'aria-hidden': 'true' }, node.bar), node.value);
        rowNodes.set(row.name, node);
      }
      node.value.textContent = tableValue(row);
      node.li.dataset.state = row.state;
      node.bar.style.setProperty('--w', `${Math.round(100 * (row.bytes || 0) / largest)}%`); // CSSOM : permis sous `style-src 'self'`
      return node.li;
    });
    const same = nodes.length === list.children.length && nodes.every((node, i) => list.children[i] === node);
    if (!same) list.replaceChildren(...nodes);
  }

  // Le bloc grisé, avec la raison : refus de droits, lecture coupée, serveur muet.
  function grey(state) {
    const text = { denied: t('wd.denied'), slow: t('wd.slow'), failed: t('wd.failed', { reason: state.reason }) }[state.status];
    message.textContent = text;
    exact.dataset.state = state.status;
    tables.dataset.state = state.status;
    for (const key of LINES) values[key].textContent = t('wd.none');
    progress.textContent = '';
  }

  function update(state) {
    if (!state) return;
    if (state.status === 'denied' || state.status === 'slow' || state.status === 'failed') { grey(state); return; }
    const done = state.tables ? state.tables.filter(row => row.state !== 'wait').length : 0;
    const dataBytes = state.status === 'ok' && state.tables ? state.tables.reduce((sum, row) => sum + (row.bytes || 0), 0) : null;
    values.file.textContent = show(state.file);
    values.history.textContent = show(state.history);
    values.attachments.textContent = state.stored === null ? show(state.counted) :
      `${show(state.stored)} · ${t('wd.attachmentsCounted', { n: show(state.counted) })}`;
    values.data.textContent = show(dataBytes);
    values.rest.textContent = show(state.rest);
    if (state.tables) {
      placeTables(state);
      progress.textContent = state.status === 'ok' ? '' : `· ${t('wd.progress', { done, n: state.tables.length })}`;
    }
    message.textContent = state.status === 'ok' ? '' : t('wd.loading');
    message.hidden = state.status === 'ok';
    exact.dataset.state = state.status;
    tables.dataset.state = state.status;
  }
  return { root, update };
}

// opts : { container, t, locale, inertTargets, estimate, load(update, cancelled) }. Rend la promesse de la fermeture.
export function openWeight({ container, t, locale, inertTargets, estimate, load }) {
  const view = buildWeightView({ t, locale, estimate });
  const close = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'weight-close' } }, t('wd.close'));
  const dialog = h('section', { class: 'mod wd', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wd-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'wd-title' }, t('wd.title'))),
    h('div', { class: 'ask-body wd-body' }, view.root),
    h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note' }, t('wd.foot')), close));
  const { done, result } = openModal({ container, section: dialog, inertTargets, first: close, cancel: null });
  close.addEventListener('click', () => done(null));
  void load(state => { if (dialog.isConnected) view.update(state); }, () => !dialog.isConnected);
  return result;
}
