// Le choix de langue de GFS (décision du porteur, 20/10) : un seul pour toutes les apps, retenu sur le navigateur de la personne. Trois valeurs : « comme Grist »
// (par défaut : le paramètre `language` que Grist met dans l'adresse du widget), le français, l'anglais. Le choix est dans le `localStorage` de GFS, jamais dans le document
// ni dans une table ; sans stockage (un navigateur qui le refuse), il vaut pour la page, et GFS le dit. Les apps le reçoivent par le contexte et par l'événement `langue`
// (contrats 5.2).

import { StoredChoice, keyStore, watchKey } from './stored-choice.js';

export const LANGUAGES = Object.freeze(['fr', 'en']);
// Chaque langue s'écrit dans la sienne, dans tous les menus : on retrouve la sienne même quand on ne lit pas celle de l'écran.
export const LANGUAGE_NAMES = Object.freeze({ fr: 'Français', en: 'English' });
export const STORAGE_KEY = 'gfs.langue';

const supported = value => (LANGUAGES.includes(value) ? value : null);

// La langue de Grist (son paramètre `language`), ou celle du navigateur à défaut : l'anglais s'il commence par « en », le français sinon.
export function languageOfGrist(param, browser) {
  return String(param || browser || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

// Ce que le navigateur garde : lire et écrire la clé de GFS (un navigateur qui refuse n'arrête rien : `stored-choice.js`).
export const browserStore = (win = window) => keyStore(win, STORAGE_KEY);

// Le format des dates de GFS lui-même. La culture de Grist suit la langue de Grist : si la personne a choisi pour GFS une autre langue, elle ne vaut plus ici (un écran
// anglais n'écrit pas ses dates en français), à moins qu'elle ne soit de la langue choisie. Les apps gardent la culture de Grist : c'est celle du document.
export function localeFor({ culture, language, grist }) {
  const standard = language === 'en' ? 'en-GB' : 'fr-FR';
  const kept = culture && (language === grist || String(culture).toLowerCase().startsWith(language)) ? culture : null;
  try { return Intl.DateTimeFormat.supportedLocalesOf([kept || standard])[0] || standard; } catch (error) { return standard; }
}

export class LanguageSetting {
  #grist;
  #stored;

  // grist : la langue de Grist ('fr' | 'en'), store : { read(), write(valeur | null) → retenu ? } ; « comme Grist » est la clé absente
  constructor({ grist, store }) {
    this.#grist = supported(grist) || 'fr';
    this.#stored = new StoredChoice({ choices: ['auto', ...LANGUAGES], fallback: 'auto', store, keep: choice => (choice === 'auto' ? null : choice) });
  }

  get grist() { return this.#grist; }
  // 'auto' (comme Grist), 'fr' ou 'en'.
  get choice() { return this.#stored.value; }
  // La langue qui vaut : celle de Grist tant que la personne n'en a pas choisi une.
  get language() { return this.#languageOf(this.choice); }

  #languageOf(choice) { return choice === 'auto' ? this.#grist : choice; }

  // Le choix de la personne. Rend `true` si le navigateur l'a retenu ; sinon il vaut jusqu'au rechargement de la page. Une valeur hors liste est ignorée.
  choose(choice) { return this.#stored.choose(choice); }

  // Un autre onglet, ou une autre section de GFS dans la page, a changé la clé : on relit.
  reload() { this.#stored.reload(); }

  // `languageChanged` dit si la langue qui vaut a vraiment changé : choisir celle que Grist donne déjà ne dérange personne.
  onChange(listener) {
    return this.#stored.onChange((choice, before) => listener({ choice, language: this.language, languageChanged: this.#languageOf(before) !== this.language }));
  }
}

// Le choix change ailleurs (un autre onglet, une autre section de GFS dans la même page) : le navigateur le dit par l'événement `storage`.
export const watchStorage = (setting, win = window) => watchKey(setting, STORAGE_KEY, win);
