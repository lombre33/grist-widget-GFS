// Un choix dans une liste avec recherche (charte : tout choix de table, de colonne ou de modèle passe par là ; mots dans n'importe quel ordre, accents, casse
// et ponctuation ignorés), sur la base commune des fenêtres (js/modal.js). Elle ne décide rien : la valeur choisie est rendue, ou null quand la personne
// renonce.

import { h } from './dom.js';
import { icon } from './icons.js';
import { LIST_SHOWN as SHOWN, listKeys, openModal } from './modal.js';
import { normalize, words, matchesWords } from './search.js';

// opts : { container, inertTargets, t, title, text, items: [{ value, label, glyph }], current, none (le texte quand rien ne correspond) }.
export function pickFrom({ container, inertTargets, t, title, text = '', items, current = null, none = '' }) {
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
    list.replaceChildren(...shown.map((item, index) => h('li', { class: 'wk-row' },
      h('button', { type: 'button', class: 'wk-item', dataset: { index: String(index), fk: `pick-${item.value}` },
        'aria-current': item.value === current ? 'true' : null },
        icon(item.glyph || 'table'), h('span', { class: 'wk-label' }, h('span', { class: 'wk-name' }, item.label)),
          item.value === current ? icon('check') : null))));
    note.textContent = !found.length ? none : (found.length > SHOWN ? t('work.more', { n: SHOWN, total: found.length }) : '');
  };
  search.addEventListener('input', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('.wk-item');
    const item = button && shown[Number(button.dataset.index)];
    if (item) done(item.value);
  });
  cancel.addEventListener('click', () => done(null));
  section.addEventListener('keydown', event => listKeys(event, { search, items: [...list.querySelectorAll('.wk-item')] }));
  render();
  return result;
}
