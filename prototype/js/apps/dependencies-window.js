// La fenêtre « Dépendances » des réglages (demande du porteur, 18/11 : « transparent pour les utilisateurs et simple à comprendre et à auditer ») : une ligne
// par bibliothèque que GFS sert, avec ce qui l'utilise, l'état (active, installée mais non utilisée, prête et pas encore servie), la version servie, la
// dernière stable et les avis de sécurité ; un clic sur une ligne déplie son audit (js/apps/dependencies-detail.js) et son choix de source (« CDN » ou
// « Copie figée », le même réglage que la fiche d'une app : js/apps/dependencies-source.js). Le pied offre « Tout en copie figée » et l'export du rapport
// (js/apps/dependencies-foot.js). Elle n'écrit que sur un geste de la personne. Une fenêtre sur une seule base (js/ui/modal.js) : le titre, la recherche et le
// pied restent en place, seule la liste défile. Les versions et les avis viennent d'un relevé daté que GFS commite (outils/releve-dependances.mjs) : le
// navigateur n'appelle aucun service pour cela.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal, listKeys, LIST_SHOWN } from '../ui/modal.js';
import { normalize, words, matchesWords } from '../ui/search.js';
import { formatBytes } from '../weight/weight.js';
import { FILTERS, matchesFilter, summary } from './dependencies-model.js';
import { buildDetail, externalLink } from './dependencies-detail.js';
import { sourceOf, planFor } from './dependencies-source.js';
import { buildFoot } from './dependencies-foot.js';

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
  const { mode } = sourceOf(row);
  const tag = (kind, shown) => h('span', { class: `dp-tag${shown === mode ? ' is-on' : ''}` }, shown === mode ? icon('check') : null, t(`dep.tag.${kind}`),
    shown === mode ? h('span', { class: 'fp-sr' }, ` (${t('dep.tag.on')})`) : null);
  const tags = [tag('copy', 'vendorise'), row.hasCdn ? tag('cdn', 'cdn') : null];
  return h('button', { type: 'button', class: 'dp-row', 'aria-expanded': String(open), dataset: { fk: `dep-${row.key}` }, on: { click: onToggle } },
    h('span', { class: 'dp-cell dp-lib' }, h('span', { class: 'dp-dot', dataset: { state: row.state }, 'aria-hidden': 'true' }),
      h('span', { class: 'dp-cell' }, h('strong', { class: 'dp-name' }, row.paquet),
        h('span', { class: 'dp-sub' }, [row.functions.join(', '), t(`dep.state.${row.state}`)].filter(Boolean).join(' · ')))),
    h('span', { class: 'dp-cell dp-users' }, row.apps.length ? row.apps.join(', ') : '—'),
    h('span', { class: 'dp-cell dp-gfs' }, h('span', { class: 'dp-ver' }, row.version), h('span', { class: 'dp-tags' }, ...tags)),
    latestCell(t, row), h('span', { class: 'dp-chev', 'aria-hidden': 'true' }, icon('chev-down')));
}

// La vérification d'une copie : « en cours », puis ce que l'audit rend (ou l'erreur) ; le détail ouvert la montre tout de suite.
async function runCheck(state, row, verify) {
  const shown = next => { state.checks.set(row.key, next); const detail = state.details.get(row.key); if (detail) detail.setIntegrity(next); };
  shown('running');
  try { shown(await verify(row)); } catch (error) {
    shown([{ state: 'erreur', reason: String((error && error.message) || error).slice(0, 120), address: '' }]); }
}

// L'en-tête : le titre, le nombre de bibliothèques, la recherche et les filtres. Rend { node, search, chips }.
function buildHead(t, rows, state, { onFilter, onSearch }) {
  const { bytes } = summary(rows);
  const search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('dep.search'), 'aria-label': t('dep.search'),
    dataset: { fk: 'dep-search' } });
  search.addEventListener('input', onSearch);
  const chips = FILTERS.map(filter => h('button', { type: 'button', class: 'dp-filter', 'aria-pressed': 'false',
    dataset: { filter, fk: `dep-filter-${filter}` },
    on: { click: () => onFilter(filter) } }, t(`dep.filter.${filter}`), h('span', { class: 'dp-count' })));
  const node = h('header', { class: 'mod-head dp-head' }, h('h2', { id: 'dp-title' }, t('dep.title')),
    h('p', { class: 'mod-count' }, t('dep.count', { n: rows.length, size: formatBytes(bytes, state.locale, t) })),
    h('div', { class: 'dp-bar' }, h('label', { class: 'inp-search dp-search' }, icon('search'), search),
      h('div', { class: 'dp-filters', role: 'group', 'aria-label': t('dep.filters') }, ...chips)));
  return { node, search, chips };
}

// opts : { container, inertTargets(), t, locale, lang, rows() (js/apps/dependencies-model.js : relues à chaque changement), surveyed (la date du relevé en
//   ISO, ou null), verify(row) -> Promise<résultats>, blocked() (la raison pour laquelle rien ne s'écrit, ou null), units() (js/apps/dependencies-source.js),
//   apply(plan, mode) -> Promise (l'écriture des choix), ask(opts) -> Promise<booléen>, now() -> Date, uuid() -> texte, save(nom, texte) }.
// Rend la promesse de la fermeture.
export function openDependencies(opts) {
  const { t, locale } = opts;
  const state = { filter: 'all', open: new Set(), checks: new Map(), details: new Map(), rows: opts.rows(), locale };
  const date = opts.surveyed ? formatDate(opts.surveyed, locale) : '';
  const list = h('ul', { class: 'dp-list', 'aria-label': t('dep.title') });
  const empty = h('p', { class: 'dp-empty', role: 'status', hidden: true }, t('dep.none'));
  const head = buildHead(t, state.rows, state, { onFilter: filter => { state.filter = filter; render(); }, onSearch: () => render() });
  let done = () => {};
  let foot = null;

  // Un choix de source : l'état de la fenêtre change tout de suite, l'écriture suit ; si elle échoue, l'état revient à ce que la table dit.
  const pick = async (row, mode) => {
    const plan = planFor(sourceOf(row).open, mode);
    if (!plan.length) return;
    const pending = opts.apply(plan, mode);
    refresh();
    await pending;
    refresh();
  };
  const showDetail = (row, li) => {
    const detail = buildDetail({ t, locale, row, surveyed: date, state: state.checks.get(row.key) || null, verify: () => void runCheck(state, row, opts.verify),
      blocked: opts.blocked(), pick: mode => void pick(row, mode) });
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
  function item(row) {
    const li = h('li', { class: `dp-item${state.open.has(row.key) ? ' is-open' : ''}`, dataset: { key: row.key } });
    li.append(rowButton(t, row, state.open.has(row.key), () => toggle(row, li)));
    const href = row.site || row.depot;
    if (href) li.append(externalLink(t, { href, what: t(row.site ? 'dep.d.site' : 'dep.d.repo'), name: row.paquet, text: '', cls: 'dp-ext' }));
    if (state.open.has(row.key)) showDetail(row, li);
    return li;
  }
  function render() {
    const needles = words(head.search.value);
    const found = state.rows.filter(row => matchesFilter(row, state.filter) && matchesWords(needles, searchText(row)));
    const { counts } = summary(state.rows);
    state.details.clear();
    list.replaceChildren(...found.slice(0, LIST_SHOWN).map(item));
    empty.hidden = found.length > 0;
    for (const chip of head.chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter));
      chip.querySelector('.dp-count').textContent = String(counts[chip.dataset.filter]);
    }
  }
  // Les lignes se relisent d'après les apps (un choix change l'état d'une bibliothèque) ; le clavier reste sur le même élément, retrouvé par sa clé.
  function refresh() {
    const doc = list.ownerDocument;
    const kept = doc.activeElement && section.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    state.rows = opts.rows();
    render();
    foot.update();
    const again = kept && [...section.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept && !node.disabled);
    if (again) again.focus({ preventScroll: true });
  }

  foot = buildFoot({ opts, state, date, refresh, close: () => done() });
  const section = h('section', { class: 'mod dp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dp-title' }, head.node,
    h('div', { class: 'mod-body dp-body' },
      h('div', { class: 'dp-cols', 'aria-hidden': 'true' }, ...['lib', 'users', 'gfs', 'latest'].map(key => h('span', null, t(`dep.col.${key}`))), h('span')),
      list, empty, h('p', { class: 'dp-apps' }, t('dep.apps'))), foot.node);
  section.addEventListener('keydown', event => { listKeys(event, { search: head.search, items: [...list.querySelectorAll('.dp-row')] }); });
  render();
  foot.update();
  const modal = openModal({ container: opts.container, section, inertTargets: opts.inertTargets, first: head.search });
  done = modal.done;
  return modal.result;
}
