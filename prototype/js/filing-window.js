// Les deux fenêtres du rangement (contrats 6.4), sur la base commune des fenêtres (js/modal.js) : nommer (renommer un fichier ou un dossier) et choisir
// un dossier (déplacer). La liste des dossiers a sa recherche (mots dans n'importe quel ordre, accents, casse et ponctuation ignorés), et ce qu'on y écrit
// peut devenir un nouveau dossier. Elles ne décident rien : le nom ou le chemin choisi est rendu, ou null quand la personne renonce.

import { h } from './dom.js';
import { icon } from './icons.js';
import { LIST_SHOWN as SHOWN, listKeys, openModal } from './modal.js';
import { normalize, words, matchesWords } from './search.js';

// opts : { container, inertTargets, t, title, label, value, confirmLabel, clean(texte) -> texte ('' : refusé, `emptyText` le dit) }.
export function askName({ container, inertTargets, t, title, label, value, confirmLabel, clean = text => text.trim(), emptyText }) {
  const input = h('input', { type: 'text', class: 'nw-input', id: 'nw-input', autocomplete: 'off', spellcheck: 'false', dataset: { fk: 'name-input' } });
  input.value = value;
  const note = h('p', { class: 'mod-note nw-note', 'aria-live': 'polite' });
  const ok = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'name-ok' } }, confirmLabel);
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'name-cancel' } }, t('table.cancel'));
  const section = h('section', { class: 'mod ask nw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nw-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'nw-title' }, title)),
    h('div', { class: 'ask-body' }, h('label', { class: 'nw-label', for: 'nw-input' }, label), input, note),
    h('footer', { class: 'mod-foot ask-foot' }, cancel, ok));
  const { done, result } = openModal({ container, section, inertTargets, first: input, cancel: null });
  const submit = () => {
    const name = clean(input.value);
    if (name) { done(name); return; }
    note.textContent = emptyText;
    input.focus();
  };
  ok.addEventListener('click', submit);
  cancel.addEventListener('click', () => done(null));
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
  input.select();
  return result;
}

// Les articles de la liste : « Moi » (la racine), les dossiers, et le nouveau dossier que dit la recherche quand aucun dossier ne porte ce nom.
function folderItems({ t, folders, base, query, clean }) {
  const needles = words(query);
  const all = [{ path: '', label: t('ex.me'), glyph: 'user' }, ...folders.map(path => ({ path, label: path.split('/').join(' / '), glyph: 'folder' }))];
  const found = all.filter(item => matchesWords(needles, normalize(item.label)));
  const name = clean(query);
  const path = name ? (base ? `${base}/${name}` : name) : '';
  if (name && !folders.some(existing => normalize(existing) === normalize(path))) {
    found.push({ path, label: base ? t('ex.moveNewIn', { name, folder: base.split('/').pop() }) : t('ex.moveNew', { name }), glyph: 'plus', fresh: true });
  }
  return found;
}

// opts : { container, inertTargets, t, title, folders: [chemin], current (le dossier où est l'objet), base (le dossier où naît un nouveau dossier), clean(texte) -> nom }.
export function chooseFolder({ container, inertTargets, t, title, folders, current, base, clean }) {
  const search = h('input', { type: 'search', autocomplete: 'off', placeholder: t('ex.moveSearch'), 'aria-label': t('ex.moveSearch'), dataset: { fk: 'move-search' } });
  const list = h('ul', { class: 'wk-list', 'aria-labelledby': 'mv-title' });
  const note = h('p', { class: 'mod-note', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'move-cancel' } }, t('table.cancel'));
  const section = h('section', { class: 'mod wk mv', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mv-title' },
    h('header', { class: 'mod-head wk-head' }, h('div', { class: 'wk-title-row' }, h('h2', { id: 'mv-title' }, title)),
      h('p', { class: 'mod-count wk-text' }, t('ex.moveText')), h('label', { class: 'inp-search wk-search' }, icon('search'), search)),
    h('div', { class: 'mod-body' }, list),
    h('footer', { class: 'mod-foot' }, note, cancel));
  const { done, result } = openModal({ container, section, inertTargets, first: search, cancel: null });
  let shown = [];
  const render = () => {
    const found = folderItems({ t, folders, base, query: search.value, clean });
    shown = found.slice(0, SHOWN);
    list.replaceChildren(...shown.map((item, index) => h('li', { class: 'wk-row' },
      h('button', { type: 'button', class: `wk-item${item.fresh ? ' is-fresh' : ''}`, dataset: { index: String(index), fk: `move-${item.fresh ? 'new' : item.path || 'root'}` },
        'aria-current': !item.fresh && item.path === current ? 'true' : null },
      icon(item.glyph), h('span', { class: 'wk-label' }, h('span', { class: 'wk-name' }, item.label)), !item.fresh && item.path === current ? icon('check') : null))));
    note.textContent = !found.length ? t('ex.moveNone') : (found.length > SHOWN ? t('work.more', { n: SHOWN, total: found.length }) : '');
  };
  search.addEventListener('input', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('.wk-item');
    const item = button && shown[Number(button.dataset.index)];
    if (item) done(item.path);
  });
  section.addEventListener('keydown', event => listKeys(event, { search, items: [...list.querySelectorAll('.wk-item')] }));
  render();
  return result;
}
