// La fenêtre « Dépendances » des réglages (demande du porteur, 18/11 : « transparent pour les utilisateurs et simple à comprendre et à auditer ») : une ligne
// par bibliothèque que GFS sert, avec l'état (active, installée mais non utilisée, prête et pas encore servie), la version servie, la dernière stable et les
// avis de sécurité ; rangées par app, avec seulement les apps installées au départ et un panneau refermé pour les autres (js/apps/dependencies-list.js). Un
// clic sur une ligne déplie son audit (js/apps/dependencies-detail.js) et son choix de source (« CDN » ou « Copie figée », le même réglage que la fiche d'une
// app : js/apps/dependencies-source.js). Le pied offre « Tout en copie figée » et l'export du rapport (js/apps/dependencies-foot.js). Elle n'écrit que sur un
// geste de la personne. Une fenêtre sur une seule base (js/ui/modal.js) : le titre, la recherche et le pied restent en place, seule la liste défile. Les
// versions et les avis viennent d'un relevé daté que GFS commite (outils/releve-dependances.mjs) : le navigateur n'appelle aucun service pour cela.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal, listKeys } from '../ui/modal.js';
import { normalize, words, matchesWords } from '../ui/search.js';
import { formatBytes } from '../weight/weight.js';
import { FILTERS, matchesFilter, summary } from './dependencies-model.js';
import { sourceOf, planFor } from './dependencies-source.js';
import { buildList } from './dependencies-list.js';
import { buildFoot } from './dependencies-foot.js';

const searchText = row => normalize([row.paquet, row.version, row.licence, ...row.apps, ...row.functions,
  ...row.files.map(file => file.id)].filter(Boolean).join(' '));

function formatDate(iso, locale) {
  try { return new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (error) { return String(iso).slice(0, 10); }
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
  const state = { filter: 'all', open: new Set(), more: false, checks: new Map(), details: new Map(), rows: opts.rows(), locale };
  const date = opts.surveyed ? formatDate(opts.surveyed, locale) : '';
  const empty = h('p', { class: 'dp-empty', role: 'status', hidden: true }, t('dep.none'));
  const head = buildHead(t, state.rows, state, { onFilter: filter => { state.filter = filter; render(); }, onSearch: () => render() });
  let done = () => {};
  let foot = null;
  let needles = [];

  // Un choix de source : l'état de la fenêtre change tout de suite, l'écriture suit ; si elle échoue, l'état revient à ce que la table dit.
  const pick = async (row, mode) => {
    const plan = planFor(sourceOf(row).open, mode);
    if (!plan.length) return;
    const pending = opts.apply(plan, mode);
    refresh();
    await pending;
    refresh();
  };
  // Le vide : rien ne correspond, ou seul le panneau refermé (les apps non installées) a des lignes qui correspondent.
  const showEmpty = ({ shown, rest }) => {
    const { counts } = summary(state.rows);
    // La colonne « Aussi utilisée par » n'a de sens que lorsqu'une bibliothèque sert à plusieurs apps ; sinon elle ne dirait que « — » partout.
    section.classList.toggle('dp-solo', !state.rows.some(row => new Set(row.uses.map(use => use.app)).size > 1));
    empty.hidden = shown > 0 || (rest > 0 && state.more);
    empty.textContent = t(rest > 0 ? 'dep.none.installed' : 'dep.none');
    for (const chip of head.chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter));
      chip.querySelector('.dp-count').textContent = String(counts[chip.dataset.filter]);
    }
  };
  const list = buildList({ t, locale, state, date, verify: opts.verify, blocked: () => opts.blocked(), pick, after: showEmpty,
    matches: row => matchesFilter(row, state.filter) && matchesWords(needles, searchText(row)) });
  function render() {
    needles = words(head.search.value);
    list.render();
  }
  // Les lignes se relisent d'après les apps (un choix change l'état d'une bibliothèque) ; le clavier reste sur le même élément, retrouvé par sa clé.
  function refresh() {
    const doc = empty.ownerDocument;
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
      list.node, empty, h('p', { class: 'dp-apps' }, t('dep.apps'))), foot.node);
  section.addEventListener('keydown', event => { listKeys(event, { search: head.search, items: list.items() }); });
  render();
  foot.update();
  const modal = openModal({ container: opts.container, section, inertTargets: opts.inertTargets, first: head.search });
  done = modal.done;
  return modal.result;
}
