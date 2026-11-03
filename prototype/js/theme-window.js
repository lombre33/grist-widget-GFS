// La fenêtre « Thème » (décision du porteur, 03/11) : les cinq ambiances en vignettes (chacune est le vrai décor de GFS à l'échelle d'une vignette, dans la couleur et le mode qui valent), la couleur
// d'accent (celle de l'ambiance, ou la sienne), le contraste mesuré, le retour à l'origine. Un choix s'applique tout de suite : la fenêtre le rend au réglage (js/theme.js), qui le retient ; la page
// et les apps le reçoivent par js/theme-apply.js. Une fenêtre sur la base commune (js/modal.js) : le titre et le pied restent en place, seul le corps défile.
// Les vignettes sont des boutons radio : Tab y entre une fois, les flèches choisissent. « La mienne » ouvre le sélecteur de couleur des documents, celui du kit (js/theme-color.js) ; si le kit ne se charge
// pas, elle est grisée, avec sa raison dite sous elle : grisé, jamais masqué.

import { h } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';
import { AMBIANCES, seedOf, weakestContrast } from './ambiance.js';
import { previewMessage } from './theme.js';
import { paint } from './theme-apply.js';
import { ColorPicking } from './theme-color.js';

// La petite scène d'une vignette : le titre et un bouton plein, puis une carte à deux lignes (un avatar, un trait de texte, une pastille de type) ; elle prend les jetons de couleur et de forme de son ambiance.
function scene() {
  const row = (family, short) => h('div', { class: 'mn-r' }, h('i', { class: 'mn-av' }), h('span', { class: short ? 'mn-l s' : 'mn-l' }), h('i', { class: 'mn-p', 'data-fam': family }));
  return h('div', { class: 'amb-mini', 'aria-hidden': 'true' },
    h('div', { class: 'mn-head' }, h('b', { class: 'mn-t' }), h('i', { class: 'mn-btn' })),
    h('div', { class: 'mn-card' }, h('i', { class: 'mn-st' }), row('doc', false), row('grid', true)));
}

// Une vignette : un bouton radio sur toute sa surface, la scène, le nom, le mot qui la décrit, la coche de la vignette choisie.
function tile(id) {
  const input = h('input', { type: 'radio', name: 'amb', value: id, dataset: { fk: `amb:${id}` } });
  const mini = scene();
  const name = h('span', { class: 'amb-name' });
  const sub = h('span', { class: 'amb-sub' });
  return { id, input, mini, name, sub, node: h('label', { class: 'amb' }, input, mini, name, sub, icon('check', 'chk')) };
}

// La couleur d'accent : « celle de l'ambiance » (avec sa pastille) ou « la mienne » (avec le bouton du sélecteur de couleur).
function colorBox() {
  const refs = {
    amb: h('input', { type: 'radio', name: 'col', value: 'amb', dataset: { fk: 'col:amb' } }), own: h('input', { type: 'radio', name: 'col', value: 'own', dataset: { fk: 'col:own' } }),
    legend: h('legend'), ambText: h('span'), ownText: h('span'), dot: h('i', { class: 'dot' }), swatch: h('i', { class: 'sw' }), pickText: h('span'),
  };
  refs.pick = h('button', { type: 'button', class: 'btn sm th-pick', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', dataset: { fk: 'col:pick' } }, refs.swatch, refs.pickText, icon('chev-down'));
  refs.node = h('fieldset', { class: 'th-col' }, refs.legend,
    h('label', { class: 'rd' }, refs.amb, h('span', { class: 'rd-text' }, h('span', { class: 'rd-label' }, refs.ambText, refs.dot))),
    h('label', { class: 'rd' }, refs.own, h('span', { class: 'rd-text' }, h('span', { class: 'rd-label' }, refs.ownText))),
    refs.pick);
  return refs;
}

// La fenêtre entière, sans texte ni état : `#label` et `refresh` les posent.
function buildWindow() {
  const tiles = AMBIANCES.map(tile);
  const line = (cls, glyph, text) => ({ text, node: h('p', { class: cls }, icon(glyph), text) });
  const refs = {
    tiles, color: colorBox(), title: h('h2', { id: 'th-title' }), text: h('p', { class: 'mod-count' }), note: h('p', { class: 'mod-note', 'aria-live': 'polite' }),
    grid: h('div', { class: 'amb-grid', role: 'radiogroup' }, ...tiles.map(item => item.node)),
    check: line('th-check', 'check', h('span')), adjusted: line('th-adj', 'info', h('span')), later: line('th-adj', 'info', h('span')),
    reset: h('button', { type: 'button', class: 'btn', dataset: { fk: 'reset' } }), close: h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'close' } }),
  };
  refs.section = h('section', { class: 'mod th-win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'th-title' },
    h('header', { class: 'mod-head' }, refs.title, refs.text),
    h('div', { class: 'mod-body th-body' }, refs.grid, refs.color.node, refs.check.node, refs.adjusted.node, refs.later.node),
    h('footer', { class: 'mod-foot' }, refs.note, refs.reset, refs.close));
  return refs;
}

export class ThemeWindow {
  #opts;
  #refs = null;
  #modal = null;
  #stop = null;
  #kept = true; // le navigateur a retenu le dernier choix (sinon la fenêtre le dit : il vaut pour la page)
  #picking = null; // le sélecteur de couleur du kit (js/theme-color.js), le temps que la fenêtre est ouverte

  // opts : { container, i18n, locale, setting (ThemeSetting), mode() → 'clair' | 'sombre' (celui que montre la page), inertTargets() → [élément], onClose()? }
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#modal !== null; }
  // Le fond de la fenêtre, pour qu'une question posée par-dessus (ask-window.js) le rende inerte.
  get element() { return this.#refs ? this.#refs.section.parentNode : null; }

  open() {
    if (this.#modal) { this.refresh(); return; }
    const { setting, container, inertTargets } = this.#opts;
    const refs = buildWindow();
    this.#refs = refs;
    this.#kept = true;
    this.#picking = this.#pickingFor();
    this.#label();
    this.refresh();
    this.#bind(refs);
    this.#modal = openModal({ container, section: refs.section, inertTargets, first: refs.tiles.find(item => item.id === setting.ambiance).input, cancel: null });
    this.#stop = setting.onChange(() => this.refresh()); // un autre onglet de la personne change aussi le choix
    void this.#picking.load(); // le sélecteur de couleur du kit : chargé maintenant, pour qu'il soit prêt au premier clic
    void this.#modal.result.then(() => this.#closed());
  }

  close() {
    if (this.#picking) this.#picking.close();
    if (this.#modal) this.#modal.done(null);
  }

  // Le sélecteur de couleur, relié à cette fenêtre : il lit son réglage, sa langue et son mode, se pose sous son bouton et lui rend ce que la personne a choisi.
  #pickingFor() {
    const { setting, container, inertTargets, mode } = this.#opts;
    return new ColorPicking({
      setting, container, mode, inertTargets, i18n: () => this.#opts.i18n, anchor: () => (this.#refs ? this.#refs.color.pick : null), host: () => this.element,
      onState: () => this.refresh(), onChoice: kept => { this.#kept = kept; this.refresh(); },
    });
  }

  #closed() {
    this.#picking = null;
    this.#stop();
    this.#stop = null;
    this.#modal = null;
    this.#refs = null;
    if (this.#opts.onClose) this.#opts.onClose();
  }

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes ; une fenêtre fermée prendra les nouveaux à son ouverture.
  relocalize({ i18n, locale }) {
    this.#opts = { ...this.#opts, i18n, locale };
    if (!this.#refs) return;
    this.#picking.close();
    this.#label();
    this.refresh();
  }

  #bind(refs) {
    const { setting } = this.#opts;
    refs.section.addEventListener('change', ({ target }) => {
      if (target.name === 'col') { if (target.value === 'amb') this.#picking.release(); else this.#picking.own(); return; }
      if (target.name === 'amb') this.#kept = setting.choose(target.value);
      this.refresh();
    });
    refs.color.pick.addEventListener('click', () => { void this.#picking.toggle(); });
    refs.reset.addEventListener('click', () => { this.#kept = setting.reset(); this.refresh(); });
    refs.close.addEventListener('click', () => this.close());
  }

  // Les textes, dans la langue qui vaut.
  #label() {
    const { t } = this.#opts.i18n;
    const { tiles, color } = this.#refs;
    const refs = this.#refs;
    refs.title.textContent = t('theme.title');
    refs.text.textContent = t('theme.text');
    refs.grid.setAttribute('aria-label', t('theme.ambiances'));
    for (const item of tiles) {
      item.name.textContent = t(`theme.amb.${item.id}`);
      item.sub.textContent = t(`theme.amb.${item.id}.sub`);
      item.mini.querySelector('.mn-t').textContent = t('theme.mini');
    }
    color.legend.textContent = t('theme.color');
    color.ambText.textContent = t('theme.color.amb');
    color.ownText.textContent = t('theme.color.own');
    color.pick.title = t('theme.color.pick');
    refs.later.text.textContent = t('theme.color.missing');
    refs.reset.textContent = t('theme.reset');
    refs.close.textContent = t('theme.close');
  }

  // L'état d'après le réglage : la vignette choisie, la couleur, les vignettes repeintes (dans la couleur choisie et le mode de la page), la mesure du contraste.
  refresh() {
    const refs = this.#refs;
    if (!refs) return;
    const { setting, i18n } = this.#opts;
    const mode = this.#opts.mode();
    for (const item of refs.tiles) {
      item.input.checked = item.id === setting.ambiance;
      paint(item.mini, previewMessage(item.id, setting.color), mode);
    }
    this.#refreshColor(refs.color, setting);
    const message = setting.message() || previewMessage('defaut', null);
    refs.check.text.textContent = i18n.t(setting.isOrigin ? 'theme.check.origin' : 'theme.check', { ratio: this.#ratio(weakestContrast(message)) });
    refs.adjusted.node.hidden = !(setting.color && message.ajustee);
    if (!refs.adjusted.node.hidden) refs.adjusted.text.textContent = i18n.t('theme.adjusted', { hex: message.clair['--accent-solid'].toUpperCase() });
    refs.note.textContent = i18n.t(this.#kept ? 'theme.saved' : 'theme.notKept');
    refs.reset.setAttribute('aria-disabled', String(setting.isOrigin));
  }

  // « 4,63 » → « 4,6 » : le contraste annoncé est celui qu'on tient, arrondi vers le bas (jamais plus beau que la mesure).
  #ratio(value) {
    const format = new Intl.NumberFormat(this.#opts.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return format.format(Math.floor(value * 10) / 10);
  }

  // La couleur d'accent. Sans le sélecteur de couleur du kit (il ne s'est pas chargé), « la mienne » est grisée (le bouton aussi) et sa raison est dite sous elle ; une couleur déjà retenue reste visible.
  #refreshColor(box, setting) {
    const { t } = this.#opts.i18n;
    const { color } = setting;
    const missing = this.#picking.state === 'missing';
    box.amb.checked = color === null;
    box.own.checked = color !== null;
    box.own.disabled = missing;
    box.pick.setAttribute('aria-disabled', String(missing));
    this.#refs.later.node.hidden = !missing;
    box.dot.style.setProperty('background-color', seedOf(setting.ambiance, this.#opts.mode()));
    box.swatch.style.setProperty('background-color', color || 'transparent');
    box.pickText.textContent = color ? color.toUpperCase() : t('theme.color.pick');
  }
}
