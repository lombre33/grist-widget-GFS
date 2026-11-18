// La fenêtre « Dépendances » des réglages (demande du porteur, 18/11 : « transparent pour les utilisateurs et simple à comprendre et à auditer ») : une ligne
// par bibliothèque que GFS sert, avec ce qui l'utilise, l'état (active, installée mais non utilisée, prête et pas encore servie), la version servie, la
// dernière stable et les avis de sécurité ; un clic sur une ligne déplie son audit (js/apps/dependencies-detail.js). Elle ne décide rien et n'écrit rien : en
// lecture seule. Une fenêtre sur une seule base
// (js/ui/modal.js) : le titre, la recherche et le pied restent en place, seule la liste défile. Les versions et les avis viennent d'un relevé daté que GFS
//   commite (outils/releve-dependances.mjs) : le navigateur n'appelle aucun service pour cela.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal, listKeys, LIST_SHOWN } from '../ui/modal.js';
import { normalize, words, matchesWords } from '../ui/search.js';
import { formatBytes } from '../weight/weight.js';
import { FILTERS, matchesFilter, summary } from './dependencies-model.js';
import { buildDetail, externalLink } from './dependencies-detail.js';

// L'état d'une ligne de la colonne « Dernière stable » : un mot et une icône, la couleur ne le porte jamais seule.
const GAP_LOOK = { 'a-jour': ['ok', 'check'], correctif: ['info', 'download'], mineure: ['info', 'download'], majeure: ['warn', 'download'],
  avance: ['muted', 'info'],
  inconnu: ['muted', 'info'] };

const searchText = row => normalize([row.paquet, row.version, row.licence, ...row.apps, ...row.functions,
  ...row.files.map(file => file.id)].filter(Boolean).join(' '));

function formatDate(iso, locale) {
  try { return new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (error) { return String(iso).slice(0, 10); }
}

// La colonne « Dernière stable » : l'avis le plus grave l'emporte sur l'écart de version.
function latestCell(t, row) {
  const [tone, glyph] = row.worst ? ['bad', 'warning'] : GAP_LOOK[row.releveAncien ? 'inconnu' : row.ecart];
  const text = row.worst ? t('dep.gap.avis', { level: t(`dep.level.${row.worst.niveau}`) }) : t(`dep.gap.${row.releveAncien ? 'inconnu' : row.ecart}`);
  return h('span', { class: 'dp-cell' }, h('span', { class: `dp-chip dp-${tone}` }, icon(glyph), text),
    h('span', { class: 'dp-sub dp-latest', title: row.latest ? t('dep.latest', { version: row.latest }) : null }, row.latest || ''));
}

// Le bouton d'une ligne : son nom et son état en mots, ce qui l'utilise, la version servie avec ses modes, la dernière stable.
function rowButton(t, row, open, onToggle) {
  const tags = [h('span', { class: 'dp-tag' }, t('dep.tag.copy')), row.hasCdn ? h('span', { class: 'dp-tag' }, t('dep.tag.cdn')) : null];
  return h('button', { type: 'button', class: 'dp-row', 'aria-expanded': String(open), dataset: { fk: `dep-${row.key}` }, on: { click: onToggle } },
    h('span', { class: 'dp-cell dp-lib' }, h('span', { class: 'dp-dot', dataset: { state: row.state }, 'aria-hidden': 'true' }),
      h('span', { class: 'dp-cell' }, h('strong', { class: 'dp-name' }, row.paquet),
        h('span', { class: 'dp-sub' }, [row.functions.join(', '), t(`dep.state.${row.state}`)].filter(Boolean).join(' · ')))),
    h('span', { class: 'dp-cell dp-users' }, row.apps.length ? row.apps.join(', ') : '—'),
    h('span', { class: 'dp-cell dp-gfs' }, h('span', { class: 'dp-ver' }, row.version), h('span', { class: 'dp-tags' }, ...tags)),
    latestCell(t, row), h('span', { class: 'dp-chev', 'aria-hidden': 'true' }, icon('chev-down')));
}

// opts : { container, inertTargets(), t, locale, rows (js/apps/dependencies-model.js), surveyed (la date du relevé en ISO, ou null), verify(row) ->
//   Promise<résultats> }. Rend la promesse de la fermeture.
export function openDependencies(opts) {
  const { t, locale, rows, surveyed } = opts;
  const state = { filter: 'all', open: new Set(), checks: new Map(), details: new Map() };
  const date = surveyed ? formatDate(surveyed, locale) : '';
  const { counts, bytes } = summary(rows);
  const search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('dep.search'), 'aria-label': t('dep.search'),
    dataset: { fk: 'dep-search' } });
  const chips = FILTERS.map(filter => h('button', { type: 'button', class: 'dp-filter', 'aria-pressed': String(filter === state.filter),
    dataset: { filter, fk: `dep-filter-${filter}` },
    on: { click: () => { state.filter = filter; render(); } } }, t(`dep.filter.${filter}`), h('span', { class: 'dp-count' }, String(counts[filter]))));
  const list = h('ul', { class: 'dp-list', 'aria-label': t('dep.title') });
  const empty = h('p', { class: 'dp-empty', role: 'status', hidden: true }, t('dep.none'));
  let done = () => {};

  const showDetail = (row, li) => {
    const detail = buildDetail({ t, locale, row, surveyed: date, state: state.checks.get(row.key) || null, verify: () => void check(row) });
    state.details.set(row.key, detail);
    li.append(detail.node);
  };
  const toggle = (row, li) => {
    const open = !state.open.has(row.key);
    if (open) state.open.add(row.key); else state.open.delete(row.key);
    li.classList.toggle('is-open', open);
    li.querySelector('.dp-row').setAttribute('aria-expanded', String(open));
    if (open) { showDetail(row, li); return; }
    li.querySelector('.dp-detail').remove();
    state.details.delete(row.key);
  };
  async function check(row) {
    const shown = next => { state.checks.set(row.key, next); const detail = state.details.get(row.key); if (detail) detail.setIntegrity(next); };
    shown('running');
    try { shown(await opts.verify(row)); } catch (error) {
      shown([{ state: 'erreur', reason: String((error && error.message) || error).slice(0, 120), address: '' }]); }
  }
  function item(row) {
    const li = h('li', { class: `dp-item${state.open.has(row.key) ? ' is-open' : ''}`, dataset: { key: row.key } });
    li.append(rowButton(t, row, state.open.has(row.key), () => toggle(row, li)));
    const href = row.site || row.depot;
    if (href) li.append(externalLink(t, { href, what: t(row.site ? 'dep.d.site' : 'dep.d.repo'), name: row.paquet, text: '', cls: 'dp-ext' }));
    if (state.open.has(row.key)) showDetail(row, li);
    return li;
  }
  function render() {
    const needles = words(search.value);
    const found = rows.filter(row => matchesFilter(row, state.filter) && matchesWords(needles, searchText(row)));
    state.details.clear();
    list.replaceChildren(...found.slice(0, LIST_SHOWN).map(item));
    empty.hidden = found.length > 0;
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter));
  }
  search.addEventListener('input', render);

  const section = h('section', { class: 'mod dp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dp-title' },
    h('header', { class: 'mod-head dp-head' }, h('h2', { id: 'dp-title' }, t('dep.title')),
      h('p', { class: 'mod-count' }, t('dep.count', { n: rows.length, size: formatBytes(bytes, locale, t) })),
      h('div', { class: 'dp-bar' }, h('label', { class: 'inp-search dp-search' }, icon('search'), search),
        h('div', { class: 'dp-filters', role: 'group', 'aria-label': t('dep.filters') }, ...chips))),
    h('div', { class: 'mod-body dp-body' },
      h('div', { class: 'dp-cols', 'aria-hidden': 'true' }, ...['lib', 'users', 'gfs', 'latest'].map(key => h('span', null, t(`dep.col.${key}`))), h('span')),
      list, empty, h('p', { class: 'dp-apps' }, t('dep.apps'))),
    h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note' }, surveyed ? t('dep.foot', { date }) : t('dep.foot.none')),
      h('button', { type: 'button', class: 'btn', dataset: { fk: 'dep-close' }, on: { click: () => done() } }, t('dep.close'))));
  section.addEventListener('keydown', event => { listKeys(event, { search, items: [...list.querySelectorAll('.dp-row')] }); });
  render();
  const modal = openModal({ container: opts.container, section, inertTargets: opts.inertTargets, first: search });
  done = modal.done;
  return modal.result;
}
