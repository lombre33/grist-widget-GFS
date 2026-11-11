// « La mienne » : choisir sa couleur d'accent avec le sélecteur de couleur des documents (décision du porteur, 03/11), celui du kit (sous-module `kit/`) : le
// menu de couleur sous le bouton de la fenêtre « Thème » (la palette, « Personnalisé… », « Celle de l'ambiance » qui rend la couleur à l'ambiance), et la
// fenêtre « Couleur personnalisée » (le carré, la teinte, le code) posée par-dessus la fenêtre « Thème », sur la base commune des fenêtres (js/ui/modal.js) :
// GFS en pose son contenu dans sa propre fenêtre, comme le kit le prévoit. Le sélecteur ne se charge qu'à la première ouverture de la fenêtre « Thème », et GFS
// ne dépend pas de lui : s'il ne se charge pas (le sous-module n'est pas servi), `state` vaut 'missing', la fenêtre grise « La mienne » et le dit, et tout le
// reste marche.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { openPanel } from '../ui/menu.js';
import { seedOf } from './ambiance.js';

let loading = null;

// { createColorPalette, ColorEditor, translate(langue) → t }, ou null quand le kit ne se charge pas. Le navigateur garde un échec d'import jusqu'au
// rechargement de la page (mesuré, labo/run-theme.mjs) : GFS ne réessaie donc pas, ne le dit qu'une fois, et la fenêtre dit de recharger la page.
export function loadPicker() {
  if (!loading) {
    loading = Promise.all([import('../../kit/js/color-palette.js'), import('../../kit/js/color-dialog.js'), import('../../kit/js/i18n.js')]).then(
      ([palette, dialog, strings]) => ({
      createColorPalette: palette.createColorPalette,
      ColorEditor: dialog.ColorEditor,
      translate: language => strings.createI18n({ strings: strings.KIT_STRINGS, language }).t,
    })).catch(error => {
      console.warn('GFS : le sélecteur de couleur du kit ne se charge pas', error);
      return null;
    });
  }
  return loading;
}

export class ColorPicking {
  #opts;
  #kit = null;
  #state = 'loading'; // 'loading' | 'ready' | 'missing'
  #ready = Promise.resolve();
  #panel = null;
  #editor = null;
  #last; // la dernière couleur à soi : « la mienne » la reprend quand on revient de « celle de l'ambiance »

  // opts : { setting (ThemeSetting), i18n() → { lang, t }, mode() → 'clair' | 'sombre', anchor() → le bouton, host() → le voile de la fenêtre « Thème » (le
  //   menu s'y pose), container, inertTargets() → [élément] (ce que la fenêtre de la couleur rend inerte, avec le voile de la fenêtre « Thème »), onState(),
  //   onChoice(retenu) }
  constructor(opts) {
    this.#opts = opts;
    this.#last = opts.setting.color;
  }

  get state() { return this.#state; }

  load() {
    this.#ready = loadPicker().then(kit => {
      this.#kit = kit;
      this.#state = kit ? 'ready' : 'missing';
      this.#opts.onState();
    });
    return this.#ready;
  }

  close() {
    this.#closePanel(false);
    if (this.#editor) this.#editor.done(null);
  }

  // Le bouton « Choisir ma couleur » : ouvre le menu de couleur sous lui, ou le referme.
  async toggle() {
    await this.#ready;
    const anchor = this.#opts.anchor();
    if (this.#state !== 'ready' || !anchor) return;
    if (this.#panel) { this.#closePanel(false); return; }
    const { setting, i18n, host } = this.#opts;
    const palette = this.#kit.createColorPalette({
      t: this.#t(), current: setting.color, noneLabel: i18n().t('theme.color.amb'),
      onPick: color => this.#choose(color), onNone: () => this.#choose(null), onCustom: () => this.#custom(),
    });
    // La fenêtre se redessine à la fermeture : « La mienne », cochée pour ouvrir le menu, redevient « Celle de l'ambiance » quand on le referme sans rien
    // choisir.
    this.#panel = openPanel(anchor, palette.element, { host: host(), label: i18n().t('theme.color'),
      onClose: () => { this.#panel = null; this.#opts.onState(); } });
    palette.focus();
  }

  // « La mienne » : la dernière couleur à soi, ou, faute de l'avoir, le menu de couleur.
  own() {
    if (this.#last) this.#choose(this.#last);
    else void this.toggle();
  }

  // « Celle de l'ambiance » : la couleur choisie est gardée de côté pour « la mienne ».
  release() { this.#choose(null); }

  #t() { return this.#kit.translate(this.#opts.i18n().lang); }

  #closePanel(focusBack) {
    if (!this.#panel) return;
    const panel = this.#panel;
    this.#panel = null;
    panel.close();
    const anchor = this.#opts.anchor();
    if (focusBack && anchor) anchor.focus({ preventScroll: true });
  }

  #choose(color) {
    this.#closePanel(true);
    const { setting } = this.#opts;
    this.#last = color || setting.color || this.#last;
    this.#opts.onChoice(setting.chooseColor(color));
  }

  // « Personnalisé… » : la fenêtre du carré, de la teinte et du code, par-dessus la fenêtre « Thème ». « Appliquer » pose la couleur ; « Annuler » et Échap ne
  // changent rien ; un clic à côté ne ferme pas la fenêtre.
  #custom() {
    this.#closePanel(true);
    const { setting, container, mode, host, inertTargets } = this.#opts;
    const t = this.#t();
    let finish = () => {};
    const apply = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'tc-apply' } }, t('kit.color.apply'));
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'tc-cancel' } }, t('kit.cancel'));
    const editor = new this.#kit.ColorEditor({ t, initial: setting.color || seedOf(setting.ambiance, mode()), onValidity: valid => { apply.disabled = !valid; },
      onSubmit: () => finish() });
    const section = h('section', { class: 'mod th-edit', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tc-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'tc-title' }, t('kit.color.custom'))),
      h('div', { class: 'mod-body th-edit-body' }, editor.element),
      h('footer', { class: 'mod-foot' }, cancel, apply));
    const modal = openModal({ container, section, inertTargets: () => [...inertTargets(), host()], first: editor.element.querySelector('.cp-hex'),
      cancel: null });
    finish = () => { if (editor.valid()) modal.done(editor.color()); };
    cancel.addEventListener('click', () => modal.done(null));
    apply.addEventListener('click', finish);
    editor.focus();
    this.#editor = modal;
    void modal.result.then(color => {
      this.#editor = null;
      if (color) this.#choose(color);
    });
  }
}
