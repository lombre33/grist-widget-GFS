// Le choix de langue de GFS (décision du porteur, 20/10) : un seul pour toutes les apps, retenu sur le navigateur de la personne. Trois valeurs : « comme Grist »
// (par défaut : le paramètre `language` que Grist met dans l'adresse du widget), le français, l'anglais. Le choix est dans le `localStorage` de GFS, jamais dans le document
// ni dans une table ; sans stockage (un navigateur qui le refuse), il vaut pour la page, et GFS le dit. Les apps le reçoivent par le contexte et par l'événement `langue`
// (contrats 5.2).

export const LANGUAGES = Object.freeze(['fr', 'en']);
// Chaque langue s'écrit dans la sienne, dans tous les menus : on retrouve la sienne même quand on ne lit pas celle de l'écran.
export const LANGUAGE_NAMES = Object.freeze({ fr: 'Français', en: 'English' });
export const STORAGE_KEY = 'gfs.langue';

const supported = value => (LANGUAGES.includes(value) ? value : null);

// La langue de Grist (son paramètre `language`), ou celle du navigateur à défaut : l'anglais s'il commence par « en », le français sinon.
export function languageOfGrist(param, browser) {
  return String(param || browser || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

// Ce que le navigateur garde : lire et écrire la clé de GFS. Un navigateur qui refuse (cadre sans stockage, navigation privée, quota) n'arrête rien :
// la lecture rend `null`, l'écriture rend `false`.
export function browserStore(win = window) {
  return {
    read() {
      try { return win.localStorage.getItem(STORAGE_KEY); } catch (error) { return null; }
    },
    write(value) {
      try {
        if (value === null) win.localStorage.removeItem(STORAGE_KEY);
        else win.localStorage.setItem(STORAGE_KEY, value);
        return true;
      } catch (error) { return false; }
    },
  };
}

// Le format des dates de GFS lui-même. La culture de Grist suit la langue de Grist : si la personne a choisi pour GFS une autre langue, elle ne vaut plus ici (un écran
// anglais n'écrit pas ses dates en français), à moins qu'elle ne soit de la langue choisie. Les apps gardent la culture de Grist : c'est celle du document.
export function localeFor({ culture, language, grist }) {
  const standard = language === 'en' ? 'en-GB' : 'fr-FR';
  const kept = culture && (language === grist || String(culture).toLowerCase().startsWith(language)) ? culture : null;
  try { return Intl.DateTimeFormat.supportedLocalesOf([kept || standard])[0] || standard; } catch (error) { return standard; }
}

export class LanguageSetting {
  #grist;
  #store;
  #choice;
  #listeners = [];

  // grist : la langue de Grist ('fr' | 'en'), store : { read(), write(valeur | null) → retenu ? }
  constructor({ grist, store }) {
    this.#grist = supported(grist) || 'fr';
    this.#store = store;
    this.#choice = this.#stored();
  }

  get grist() { return this.#grist; }
  // 'auto' (comme Grist), 'fr' ou 'en'.
  get choice() { return this.#choice; }
  // La langue qui vaut : celle de Grist tant que la personne n'en a pas choisi une.
  get language() { return this.#choice === 'auto' ? this.#grist : this.#choice; }

  // Une valeur étrangère dans le navigateur (une main qui y a écrit, une version à venir) est tenue pour absente.
  #stored() {
    try { return supported(this.#store.read()) || 'auto'; } catch (error) { return 'auto'; }
  }

  // Le choix de la personne. Rend `true` si le navigateur l'a retenu ; sinon il vaut jusqu'au rechargement de la page. Une valeur hors liste est ignorée.
  choose(choice) {
    if (choice !== 'auto' && !supported(choice)) return true;
    const kept = this.#store.write(choice === 'auto' ? null : choice) !== false;
    this.#apply(choice);
    return kept;
  }

  // Un autre onglet, ou une autre section de GFS dans la page, a changé la clé : on relit.
  reload() { this.#apply(this.#stored()); }

  #apply(choice) {
    const before = this.language;
    if (choice === this.#choice) return;
    this.#choice = choice;
    const event = { choice, language: this.language, languageChanged: before !== this.language };
    for (const listener of [...this.#listeners]) listener(event);
  }

  // `languageChanged` dit si la langue qui vaut a vraiment changé : choisir celle que Grist donne déjà ne dérange personne.
  onChange(listener) {
    this.#listeners.push(listener);
    return () => { this.#listeners = this.#listeners.filter(item => item !== listener); };
  }
}

// Le choix change ailleurs (un autre onglet, une autre section de GFS dans la même page) : le navigateur le dit par l'événement `storage`.
// `addEventListener` et non `window.onstorage =`, comme pour les messages (cela ne remplace l'écoute de personne).
export function watchStorage(setting, win = window) {
  const handler = event => { if (event.key === null || event.key === STORAGE_KEY) setting.reload(); };
  win.addEventListener('storage', handler);
  return () => win.removeEventListener('storage', handler);
}
