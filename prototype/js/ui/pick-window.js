// Un choix dans une liste avec recherche (charte : tout choix de table, de colonne ou de modèle passe par là ; mots dans n'importe quel ordre, accents, casse
// et ponctuation ignorés), sur la base commune des fenêtres (js/ui/modal.js). Elle ne décide rien : la valeur choisie est rendue, ou null quand la personne
// renonce.

import { h } from './dom.js';
import { icon } from './icons.js';
import { LIST_SHOWN as SHOWN, listKeys, openModal } from './modal.js';
import { normalize, words, matchesWords } from './search.js';

// La ligne d'un choix : le bouton du choix (son icône, son nom, `hint` dessous quand il y en a un, `sample` à droite : ce que le choix contient pour une
// personne d'exemple, la coche du choix en cours) et, avec `alt`, un second bouton au bout de la ligne (icône seule, ou icône et texte quand `alt.text`
// existe) ; on n'y va qu'à la souris ou par → (jamais par Tab : la liste en compterait deux arrêts par ligne). Un choix qui porte `alt: false` n'a pas de
// second bouton.
function rowOf(item, index, { current, alt }) {
  const mark = { index: String(index) };
  const sample = typeof item.sample === 'function' ? item.sample() : item.sample;
  const main = h('button', { type: 'button', class: 'wk-item', title: [item.label, item.hint, sample].filter(Boolean).join(' · ') || null,
    dataset: { ...mark, fk: `pick-${item.value}` },
    'aria-current': item.value === current ? 'true' : null },
  icon(item.glyph || 'table'), h('span', { class: 'wk-label' }, h('span', { class: 'wk-name' }, item.label),
    item.hint ? h('span', { class: 'wk-reason' }, item.hint) : null),
  sample ? h('span', { class: 'wk-sample' }, sample) : null,
  item.value === current ? icon('check') : null);
  const withText = alt && alt.text ? alt.text(item) : '';
  const second = alt && item.alt !== false ? h('button', { type: 'button', class: `btn sm wk-alt${withText ? ' has-text' : ''}`, tabindex: '-1',
    title: alt.label(item),
    'aria-label': alt.label(item), dataset: { ...mark, fk: `pick-alt-${item.value}` } }, withText ? h('span', null, withText) : null, icon(alt.icon)) : null;
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

// Le chemin parcouru : une pastille par étape, des flèches entre elles ; la dernière, celle où l'on est, prend la couleur d'accent. Avec `back`, les étapes
// déjà parcourues sont des boutons : un clic y revient.
function crumbBar(crumbs, t, back) {
  const last = crumbs.length - 1;
  const crumb = (text, i) => (back && i < last ? h('button', { type: 'button', class: 'wk-crumb is-link', title: t('pick.backTo', { step: text }),
    dataset: { crumb: String(i), fk: `pick-crumb:${i}` } }, text) : h('span', { class: 'wk-crumb', role: 'listitem' }, text));
  return h('div', { class: 'wk-crumbs', role: 'list', 'aria-label': t('pick.path') }, h('span', { class: 'wk-crumbs-l' }, t('pick.path')),
    ...crumbs.flatMap((text, i) => [i ? icon('chev-right') : null, crumb(text, i)]));
}

// opts : { container, inertTargets, t, title, text, items: [{ value, label, glyph, hint, sample (un texte, ou une fonction qui le rend : l'exemple peut arriver
//   après
//   l'ouverture), searchOnly (le choix n'est montré que quand la recherche a des mots), pinned (le choix reste montré, quelle que soit la recherche : « Créer…
//   »), alt: false (pas de
//   second geste pour lui) }], current, none (le texte
//   quand rien ne correspond), alt : { icon, label(item), text(item) (facultatif : un mot à côté de l'icône) } (un second geste sur le même choix), quick
//   (Entrée dans
//   la recherche choisit le premier), crumbs : [textes] (le chemin déjà parcouru, en pastilles sous le titre : la dernière est celle qu'on choisit, `pick.path`
//   le
//   nomme), back (avec `crumbs` : on peut revenir en arrière, par les pastilles, le bouton « Retour » ou Retour arrière dans une recherche vide ; la liste rend
//   alors
//   { jump: n } : n est le nombre d'étapes qu'on garde), example (une fonction qui dit d'où viennent les exemples : une ligne sous la recherche), watch (reçoit
//   une
//   fonction qui redessine la liste : à appeler quand les exemples arrivent) }.
// Rend la valeur choisie, ou null quand la personne renonce ; avec `alt`, { value, alt } (`alt` vrai quand elle a pris le second geste).
export function pickFrom({ container, inertTargets, t, title, text = '', items, current = null, none = '', alt = null, quick = false, crumbs = [], back = false,
  example = null, watch = null }) {
  const search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('pick.search'), 'aria-label': t('pick.search'),
    dataset: { fk: 'pick-search' } });
  const list = h('ul', { class: 'wk-list', 'aria-labelledby': 'pk-title' });
  const note = h('p', { class: 'mod-note', 'aria-live': 'polite' });
  const source = h('p', { class: 'wk-example', hidden: true });
  const canBack = back && crumbs.length > 1;
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'pick-cancel' } }, t('table.cancel'));
  const goBack = canBack ? h('button', { type: 'button', class: 'btn', dataset: { fk: 'pick-back' } }, icon('chev-left'), t('pick.back')) : null;
  const section = h('section', { class: 'mod wk pk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pk-title' },
    h('header', { class: 'mod-head wk-head' }, h('div', { class: 'wk-title-row' }, h('h2', { id: 'pk-title' }, title)),
      crumbs.length ? crumbBar(crumbs, t, canBack) : null, text ? h('p', { class: 'mod-count wk-text' }, text) : null,
      h('label', { class: 'inp-search wk-search' }, icon('search'), search), source),
    h('div', { class: 'mod-body' }, list), h('footer', { class: 'mod-foot' }, note, goBack, cancel));
  const { done, result } = openModal({ container, section, inertTargets, first: search, cancel: null });
  let shown = [];
  const render = () => {
    const needles = words(search.value);
    const found = items.filter(item => item.pinned || ((needles.length || !item.searchOnly) && matchesWords(needles, normalize(item.label))));
    shown = found.slice(0, SHOWN);
    const kept = list.ownerDocument.activeElement && list.contains(list.ownerDocument.activeElement) ? list.ownerDocument.activeElement.dataset.fk : null;
    list.replaceChildren(...shown.map((item, index) => rowOf(item, index, { current, alt })));
    const again = kept && [...list.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
    note.textContent = !found.length ? none : (found.length > SHOWN ? t('work.more', { n: SHOWN, total: found.length }) : '');
    const where = example ? example() : '';
    source.textContent = where;
    source.hidden = !where;
  };
  search.addEventListener('input', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('.wk-item, .wk-alt');
    const item = button && shown[Number(button.dataset.index)];
    if (item) done(alt ? { value: item.value, alt: button.classList.contains('wk-alt') } : item.value);
  });
  cancel.addEventListener('click', () => done(null));
  if (canBack) {
    goBack.addEventListener('click', () => done({ jump: crumbs.length - 2 }));
    section.querySelector('.wk-crumbs').addEventListener('click', event => {
      const step = event.target.closest('[data-crumb]');
      if (step) done({ jump: Number(step.dataset.crumb) });
    });
  }
  section.addEventListener('keydown', event => {
    const active = search.ownerDocument.activeElement;
    if (canBack && event.key === 'Backspace' && active === search && !search.value) { event.preventDefault(); done({ jump: crumbs.length - 2 }); return; }
    if (alt && (sideKeys(event, active) || enterKey(event, active, { search, list, quick }))) return;
    listKeys(event, { search, items: [...list.querySelectorAll('.wk-item')] });
  });
  render();
  if (watch) watch(render);
  return result;
}
