// Un choix dans une liste avec recherche (charte : tout choix de table, de colonne ou de modèle passe par là ; mots dans n'importe quel ordre, accents, casse
// et ponctuation ignorés), sur la base commune des fenêtres (js/ui/modal.js). Elle ne décide rien : la valeur choisie est rendue, ou null quand la personne
// renonce.

import { h } from './dom.js';
import { icon } from './icons.js';
import { LIST_SHOWN as SHOWN, listKeys, openModal } from './modal.js';
import { normalize, words, matchesWords } from './search.js';

// La ligne d'un choix : le bouton du choix (son icône, son nom, `hint` dessous quand il y en a un, la coche du choix en cours) et, avec `alt`, un second bouton
// à icône seule au bout de la ligne ; on n'y va qu'à la souris ou par → (jamais par Tab : la liste en compterait deux arrêts par ligne).
function rowOf(item, index, { current, alt }) {
  const mark = { index: String(index) };
  const main = h('button', { type: 'button', class: 'wk-item', title: item.hint ? `${item.label} · ${item.hint}` : null,
    dataset: { ...mark, fk: `pick-${item.value}` },
    'aria-current': item.value === current ? 'true' : null },
  icon(item.glyph || 'table'), h('span', { class: 'wk-label' }, h('span', { class: 'wk-name' }, item.label),
    item.hint ? h('span', { class: 'wk-reason' }, item.hint) : null),
  item.value === current ? icon('check') : null);
  const second = alt ? h('button', { type: 'button', class: 'btn sm wk-alt', tabindex: '-1', title: alt.label(item), 'aria-label': alt.label(item),
    dataset: { ...mark, fk: `pick-alt-${item.value}` } }, icon(alt.icon)) : null;
  return h('li', { class: 'wk-row' }, main, second);
}

// → va d'un choix à son second bouton et ← en revient ; ↑ et ↓ depuis un second bouton partent de son choix. Rend true quand la touche a servi.
function sideKeys(event, active) {
  const second = active.classList.contains('wk-alt');
  if (second && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) active.previousElementSibling.focus();
  const to = event.key === 'ArrowRight' && active.classList.contains('wk-item') ? active.nextElementSibling :
    (event.key === 'ArrowLeft' && second ? active.previousElementSibling : null);
  if (!to) return false;
  event.preventDefault();
  to.focus();
  return true;
}

// Entrée sur un choix fait son geste, Ctrl+Entrée (ou Cmd) son second geste ; avec `quick`, Entrée dans la recherche fait celui du premier choix. Rend true
// quand la touche a servi.
function enterKey(event, active, { search, list, quick }) {
  if (event.key !== 'Enter') return false;
  const [first] = list.querySelectorAll('.wk-row');
  const row = active === search && quick ? first : (active.classList.contains('wk-item') ? active.parentElement : null);
  if (!row) return false;
  event.preventDefault();
  row.children[event.ctrlKey || event.metaKey ? 1 : 0].click();
  return true;
}

// opts : { container, inertTargets, t, title, text, items: [{ value, label, glyph, hint }], current, none (le texte quand rien ne correspond),
//   alt : { icon, label(item) } (un second geste sur le même choix : un bouton à icône seule au bout de chaque ligne), quick (Entrée dans la recherche choisit
//   le premier) }.
// Rend la valeur choisie, ou null quand la personne renonce ; avec `alt`, { value, alt } (`alt` vrai quand elle a pris le second geste).
export function pickFrom({ container, inertTargets, t, title, text = '', items, current = null, none = '', alt = null, quick = false }) {
  const search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('pick.search'), 'aria-label': t('pick.search'),
    dataset: { fk: 'pick-search' } });
  const list = h('ul', { class: 'wk-list', 'aria-labelledby': 'pk-title' });
  const note = h('p', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'pick-cancel' } }, t('table.cancel'));
  const section = h('section', { class: 'mod wk pk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pk-title' },
    h('header', { class: 'mod-head wk-head' }, h('div', { class: 'wk-title-row' }, h('h2', { id: 'pk-title' }, title)),
      text ? h('p', { class: 'mod-count wk-text' }, text) : null, h('label', { class: 'inp-search wk-search' }, icon('search'), search)),
    h('div', { class: 'mod-body' }, list), h('footer', { class: 'mod-foot' }, note, cancel));
  const { done, result } = openModal({ container, section, inertTargets, first: search, cancel: null });
  let shown = [];
  const render = () => {
    const needles = words(search.value);
    const found = items.filter(item => matchesWords(needles, normalize(item.label)));
    shown = found.slice(0, SHOWN);
    list.replaceChildren(...shown.map((item, index) => rowOf(item, index, { current, alt })));
    note.textContent = !found.length ? none : (found.length > SHOWN ? t('work.more', { n: SHOWN, total: found.length }) : '');
  };
  search.addEventListener('input', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('.wk-item, .wk-alt');
    const item = button && shown[Number(button.dataset.index)];
    if (item) done(alt ? { value: item.value, alt: button.classList.contains('wk-alt') } : item.value);
  });
  cancel.addEventListener('click', () => done(null));
  section.addEventListener('keydown', event => {
    const active = search.ownerDocument.activeElement;
    if (alt && (sideKeys(event, active) || enterKey(event, active, { search, list, quick }))) return;
    listKeys(event, { search, items: [...list.querySelectorAll('.wk-item')] });
  });
  render();
  return result;
}
