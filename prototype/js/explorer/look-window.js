// La fenêtre « Apparence du dossier » (étude du 27/11, maquette validée par le porteur), sur la base commune des fenêtres (js/ui/modal.js : titre et boutons
// fixes, Échap ferme, un clic à côté ne ferme rien). Une seule fenêtre pour les trois choix : la couleur (huit pastilles : « par défaut » puis sept teintes de
// la charte), l'icône (le dossier ou un repère dessiné dedans) et l'émoji, qui prend la place de l'icône. L'aperçu en haut suit les choix. Rien n'est écrit
// ici : la fenêtre rend { look } (l'apparence choisie, ou null pour l'aspect d'origine), ou null quand la personne renonce.
//
// opts : { container, inertTargets, t, title, who (la ligne sous le nom : à qui est l'apparence), name (le nom du dossier ou de l'espace), look (l'apparence
// d'aujourd'hui, ou null) }.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { COLORS, GLYPHS, cleanEmoji, cleanLook } from '../files/folder-looks.js';
import { folderIcon } from './folder-look-view.js';
import { icon } from '../ui/icons.js';

// Un groupe de choix (role « radiogroup ») : un seul arrêt de tabulation, les flèches passent d'un choix au suivant et le choisissent.
function radioGroup({ label, buttons, onPick }) {
  const group = h('div', { class: 'lk-row', role: 'radiogroup', 'aria-label': label }, ...buttons);
  const sync = () => {
    const checked = buttons.find(button => button.getAttribute('aria-checked') === 'true') || buttons[0];
    for (const button of buttons) button.tabIndex = button === checked ? 0 : -1;
  };
  group.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const jump = { Home: 0, End: buttons.length - 1 }[event.key];
    const at = buttons.indexOf(event.target.closest('button'));
    if (at < 0 || (step === undefined && jump === undefined)) return;
    event.preventDefault();
    const next = buttons[jump !== undefined ? jump : (at + step + buttons.length) % buttons.length];
    onPick(next);
    next.focus();
  });
  return { group, sync };
}

export function askLook({ container, inertTargets, t, title, who = t('lk.who'), name, look }) {
  const start = cleanLook(look) || {};
  const state = { color: start.color || '', glyph: start.glyph || '', emoji: start.emoji || '' };
  let invalid = false;
  const current = () => cleanLook({ color: state.color, glyph: state.glyph, emoji: state.emoji });

  const preview = h('div', { class: 'lk-prev' });
  const swatches = ['', ...COLORS].map(color => h('button', { type: 'button', class: `lk-sw${color ? '' : ' is-default'}`, role: 'radio',
    title: t(color ? `lk.c.${color}` : 'lk.c.default'),
    'aria-label': t(color ? `lk.c.${color}` : 'lk.c.default'), 'aria-checked': 'false', 'data-look': color || null,
      dataset: { color, fk: `look-color-${color || 'default'}` } },
    icon(color ? 'check' : 'folder', color ? '' : 'fld')));
  const glyphs = ['', ...GLYPHS].map(glyph => h('button', { type: 'button', class: 'lk-gl', role: 'radio', title: t(`lk.g.${glyph || 'folder'}`),
    'aria-label': t(`lk.g.${glyph || 'folder'}`), 'aria-checked': 'false', dataset: { glyph, fk: `look-glyph-${glyph || 'folder'}` } }, folderIcon({ glyph })));
  const emoji = h('input', { type: 'text', class: 'lk-in', id: 'lk-emoji', autocomplete: 'off', spellcheck: 'false', placeholder: t('lk.emojiPlaceholder'),
    dataset: { fk: 'look-emoji' } });
  emoji.value = state.emoji;
  const note = h('p', { class: 'mod-note lk-note', 'aria-live': 'polite' });
  const apply = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'look-ok' } }, t('lk.apply'));
  const reset = h('button', { type: 'button', class: 'btn', dataset: { fk: 'look-reset' } }, t('lk.reset'));
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'look-cancel' } }, t('table.cancel'));

  const colors = radioGroup({ label: t('lk.color'), buttons: swatches, onPick: button => { state.color = button.dataset.color; paint(); } });
  const icons = radioGroup({ label: t('lk.glyph'), buttons: glyphs, onPick: button =>
    { state.glyph = button.dataset.glyph; state.emoji = ''; emoji.value = ''; invalid = false; paint(); } });
  for (const button of swatches) button.addEventListener('click', () => { state.color = button.dataset.color; paint(); });
  for (const button of glyphs) button.addEventListener('click', () => {
    state.glyph = button.dataset.glyph; state.emoji = ''; emoji.value = ''; invalid = false; paint(); });

  // Redessine ce qui dépend des choix : l'aperçu, les coches, la teinte des icônes proposées et le bouton « Appliquer ».
  function paint() {
    const now = current();
    preview.replaceChildren(folderIcon(now));
    if (state.color) preview.setAttribute('data-look', state.color); else preview.removeAttribute('data-look');
    for (const button of swatches) button.setAttribute('aria-checked', String(button.dataset.color === state.color));
    for (const button of glyphs) {
      button.setAttribute('aria-checked', String(!state.emoji && button.dataset.glyph === state.glyph));
      if (state.color) button.setAttribute('data-look', state.color); else button.removeAttribute('data-look');
    }
    colors.sync();
    icons.sync();
    note.textContent = invalid ? t('lk.emojiBad') : '';
    apply.setAttribute('aria-disabled', invalid ? 'true' : 'false');
  }

  const section = h('section', { class: 'mod ask lk-win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lk-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'lk-title' }, title)),
    h('div', { class: 'ask-body lk-body' },
      h('div', { class: 'lk-top' }, preview, h('div', { class: 'lk-who' }, h('div', { class: 'lk-name', title: name }, name),
        h('div', { class: 'lk-sub' }, who))),
      h('div', { class: 'lk-sec' }, h('span', { class: 'lk-lab' }, t('lk.color')), colors.group),
      h('div', { class: 'lk-sec' }, h('span', { class: 'lk-lab' }, t('lk.glyph')), icons.group),
      h('div', { class: 'lk-sec' }, h('label', { class: 'lk-lab', for: 'lk-emoji' }, t('lk.emoji')),
        h('div', { class: 'lk-row' }, emoji, h('span', { class: 'lk-hint' }, t('lk.emojiHint')))),
      note),
    h('footer', { class: 'mod-foot ask-foot' }, cancel, reset, apply));
  const { done, result } = openModal({ container, section, inertTargets, first: swatches[0], cancel: null });

  emoji.addEventListener('input', () => {
    const raw = emoji.value.trim();
    const found = cleanEmoji(raw);
    invalid = raw !== '' && found === '';
    state.emoji = found;
    if (found) state.glyph = '';
    paint();
  });
  const submit = () => {
    if (invalid) { emoji.focus(); return; }
    done({ look: current() });
  };
  apply.addEventListener('click', submit);
  emoji.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
  reset.addEventListener('click', () => {
    state.color = ''; state.glyph = ''; state.emoji = ''; emoji.value = ''; invalid = false;
    paint();
  });
  cancel.addEventListener('click', () => done(null));
  paint();
  return result;
}

