// Poser l'ambiance choisie sur la page de GFS (décision du porteur, 03/11) : `data-ambiance` et les jetons de couleur, de forme et de type sur <html>, par le CSSOM (`style.setProperty`, que la politique
// `style-src 'self'` laisse passer : elle ne refuse que l'attribut `style` écrit dans le HTML). Les jetons de forme y valent partout ; ceux de couleur et de type (les couleurs des types de fichier,
// js/ambiance-types.js : décision du 04/11) sont ceux du mode que montre la page. Le mode est celui de Grist (l'attribut `data-grist-appearance` que son script d'API pose) ou, à défaut, celui du
// système : GFS lit le `color-scheme` que css/gfs.css en tire, et se repose quand il change. Sans choix, rien ne s'écrit : les feuilles de style disent l'aspect d'origine.

import { COLOR_TOKENS } from './ambiance.js';
import { FORME_TOKENS } from './ambiance-forme.js';
import { TYPE_TOKENS, typeTokens } from './ambiance-types.js';

const TOKENS = Object.freeze([...COLOR_TOKENS, ...FORME_TOKENS, ...TYPE_TOKENS]);

// Le mode que montre la page : 'clair' ou 'sombre'.
export const modeOf = win => (win.getComputedStyle(win.document.documentElement).colorScheme === 'dark' ? 'sombre' : 'clair');

// Pose le message d'ambiance (js/theme.js, `ambianceMessage`) sur un élément, pour un mode ; `null` le retire. La vignette de la fenêtre « Thème » s'en sert aussi, pour la sienne : celle de l'ambiance d'origine
// pose donc aussi les couleurs de type d'origine, que la page peut avoir remplacées par celles d'une autre ambiance. Les couleurs de type ne sont pas dans le message : elles ne vont pas aux apps.
export function paint(el, message, mode) {
  for (const name of TOKENS) el.style.removeProperty(name);
  if (!message) { el.removeAttribute('data-ambiance'); return; }
  el.setAttribute('data-ambiance', message.id);
  for (const [name, value] of Object.entries({ ...typeTokens(message.id, mode), ...message.forme, ...message[mode] })) el.style.setProperty(name, value);
}

// Le mode change : Grist pose un autre `data-grist-appearance`, ou le système change de préférence. `addEventListener` et non `onchange =` (cela ne remplace l'écoute de personne).
export function watchAppearance(win, onChange) {
  const doc = win.document;
  const check = () => onChange(modeOf(win));
  const observer = new win.MutationObserver(check);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-grist-appearance'] });
  const query = win.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', check);
  return () => { observer.disconnect(); query.removeEventListener('change', check); };
}

// Pose l'ambiance sur la page de GFS et la tient à jour : quand la personne change de choix (ou un autre onglet), quand le mode change. `onMessage(message)` dit aux apps ce qui vaut maintenant.
export class ThemeHost {
  #win;
  #setting;
  #onMessage;
  #mode;
  #modeListeners = [];

  constructor({ win = window, setting, onMessage = () => {} }) {
    this.#win = win;
    this.#setting = setting;
    this.#onMessage = onMessage;
    this.#mode = modeOf(win);
  }

  get mode() { return this.#mode; }

  start() {
    this.#paint();
    const stops = [
      this.#setting.onChange(() => { this.#paint(); this.#onMessage(this.#setting.message()); }),
      this.#setting.watch(this.#win),
      watchAppearance(this.#win, mode => this.#setMode(mode)),
    ];
    return () => stops.forEach(stop => stop());
  }

  // listener(mode) : le mode que montre la page a changé (la fenêtre « Thème » redessine ses vignettes).
  onMode(listener) {
    this.#modeListeners.push(listener);
    return () => { this.#modeListeners = this.#modeListeners.filter(item => item !== listener); };
  }

  #setMode(mode) {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#paint();
    for (const listener of [...this.#modeListeners]) listener(mode);
  }

  #paint() { paint(this.#win.document.documentElement, this.#setting.message(), this.#mode); }
}
