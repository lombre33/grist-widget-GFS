// Le choix de thème de GFS (décision du porteur, 03/11) : une ambiance (Grist Factory d'origine, Pop, Papier, Brut, Enseigne) et, au choix, la couleur de la personne, qui remplace celle de l'ambiance ; puis,
// à part (décision du 04/11), l'accessibilité renforcée, qui se pose sur l'ambiance et la couleur choisies. Un seul choix pour GFS et pour toutes ses apps, retenu sur le navigateur de la personne comme la
// langue (clés `gfs.theme`, `gfs.couleur` et `gfs.acces` du `localStorage` de GFS), jamais dans le document ni dans une table ; sans stockage, il vaut pour la page, et GFS le dit. Le clair et le sombre
// restent ceux de Grist. Les apps le reçoivent par le contexte et par l'événement `ambiance` (contrats 5.2, point 10).

import { StoredChoice, keyStore, watchKey } from './stored-choice.js';
import { AMBIANCES, DEFAULT_AMBIANCE, ORIGIN, RENFORCEE, ambiancePalette } from './ambiance.js';
import { isHex, parseHex } from './oklch.js';

export const AMBIANCE_KEY = 'gfs.theme';
export const COLOR_KEY = 'gfs.couleur';
export const ACCESS_KEY = 'gfs.acces';

// L'accessibilité renforcée est allumée (la clé vaut `renforcee`) ou éteinte (la clé est absente).
const STANDARD = 'standard';
const ACCESS_CHOICES = Object.freeze([STANDARD, RENFORCEE]);

// Ce que le navigateur garde : lire et écrire les trois clés de GFS (un navigateur qui refuse n'arrête rien : `stored-choice.js`).
export const browserStores = (win = window) => ({ ambianceStore: keyStore(win, AMBIANCE_KEY), colorStore: keyStore(win, COLOR_KEY), accessStore: keyStore(win, ACCESS_KEY) });

// Néon, retiré le 04/11 au profit d'Enseigne, a pu être choisi la veille : sa clé se lit comme celle d'Enseigne (la clé elle-même n'est réécrite qu'au prochain choix de la personne).
const readingNeonAsEnseigne = store => ({ read: () => { const found = store.read(); return found === 'neon' ? 'enseigne' : found; }, write: value => store.write(value) });

// Ce que les apps reçoivent (contrats 5.2, point 10) : l'ambiance (`id`), la couleur libre (`couleur`, ou null), les dix-neuf jetons de couleur de chaque mode et les jetons de forme ; `null` quand rien n'est choisi :
// l'app garde alors ses propres couleurs, celles de la charte. `ajustee` dit qu'une couleur a dû être éclaircie ou assombrie pour que le texte reste lisible. Avec l'accessibilité renforcée (`strict`), l'`id` est
// `renforcee` et non celui de l'ambiance : ni GFS ni une app n'accroche alors le décor d'une ambiance (lueurs, capitales) à une page qui n'en veut plus ; les jetons, eux, gardent la couleur de l'ambiance.
export function ambianceMessage(id, color, strict = false) {
  const palette = ambiancePalette(id, color, { renforcee: strict });
  if (!palette) return null;
  return { id: strict ? RENFORCEE : id, couleur: color ? parseHex(color) : null, ajustee: palette.ajustee, clair: palette.clair, sombre: palette.sombre, forme: palette.forme };
}

// Ce que la vignette d'une ambiance montre (fenêtre « Thème ») : le message de cette ambiance pour la couleur choisie, et pour l'accessibilité renforcée si elle est allumée (la vignette montre ce que le
// choix donnerait). L'ambiance d'origine, sans couleur ni accessibilité renforcée, n'écrit rien sur la page ; sa vignette pose pourtant les couleurs d'origine, pour les montrer même quand la page porte une
// autre ambiance.
export function previewMessage(id, color, strict = false) {
  return ambianceMessage(id, color, strict) || { id: DEFAULT_AMBIANCE, couleur: null, ajustee: false, clair: ORIGIN.clair, sombre: ORIGIN.sombre, forme: {} };
}

export class ThemeSetting {
  #ambiance;
  #color;
  #access;
  #listeners = [];
  #held = false; // un geste change les deux choix (« Revenir à l'origine ») : on ne le dit qu'une fois
  #told;

  // ambianceStore, colorStore, accessStore : { read(), write(valeur | null) → retenu ? } ; l'ambiance d'origine, l'absence de couleur et l'accessibilité éteinte sont les clés absentes
  constructor({ ambianceStore, colorStore, accessStore }) {
    this.#ambiance = new StoredChoice({ choices: AMBIANCES, fallback: DEFAULT_AMBIANCE, store: readingNeonAsEnseigne(ambianceStore), keep: id => (id === DEFAULT_AMBIANCE ? null : id) });
    this.#color = new StoredChoice({ choices: value => value === null || isHex(value), fallback: null, store: colorStore });
    this.#access = new StoredChoice({ choices: ACCESS_CHOICES, fallback: STANDARD, store: accessStore, keep: value => (value === RENFORCEE ? value : null) });
    this.#told = this.#key();
    for (const choice of [this.#ambiance, this.#color, this.#access]) choice.onChange(() => this.#tell());
  }

  get ambiance() { return this.#ambiance.value; }
  // La couleur libre (`#rrggbb`), ou null : celle de l'ambiance.
  get color() { return this.#color.value; }
  // L'accessibilité renforcée est allumée : le texte à 7:1, chaque trait à 3:1, des cadres épais, sans décor, sur l'ambiance et la couleur choisies.
  get access() { return this.#access.value === RENFORCEE; }
  // La personne a choisi une ambiance ou une couleur : ce que « Revenir à Grist Factory » défait.
  get hasOwnLook() { return this.ambiance !== DEFAULT_AMBIANCE || this.color !== null; }
  // Rien n'est choisi : GFS et ses apps ont l'aspect d'origine (le message est `null`).
  get isOrigin() { return !this.hasOwnLook && !this.access; }
  // Les jetons calculés pour ce choix, ou null quand rien ne s'écrit.
  get palette() { return ambiancePalette(this.ambiance, this.color, { renforcee: this.access }); }
  message() { return ambianceMessage(this.ambiance, this.color, this.access); }

  // Le choix de la personne. Rend `true` si le navigateur l'a retenu ; sinon il vaut jusqu'au rechargement de la page. Une valeur hors liste est ignorée.
  choose(id) { return this.#ambiance.choose(id); }
  // `null` : la couleur de l'ambiance. Un texte qui n'est pas une couleur est ignoré.
  chooseColor(text) {
    const hex = text === null ? null : parseHex(text);
    return text !== null && !hex ? true : this.#color.choose(hex);
  }
  // Allumer (`true`) ou éteindre l'accessibilité renforcée. Rend `true` si le navigateur l'a retenue.
  chooseAccess(on) { return this.#access.choose(on ? RENFORCEE : STANDARD); }
  // Revenir à l'aspect d'origine : l'ambiance Grist Factory, sans couleur choisie. L'accessibilité renforcée n'est pas touchée : c'est un besoin et non un goût, qu'un retour à l'origine du décor ne doit pas
  // retirer à qui en a besoin ; elle s'éteint par son interrupteur.
  reset() {
    this.#held = true;
    const kept = [this.#ambiance.choose(DEFAULT_AMBIANCE), this.#color.choose(null)].every(Boolean);
    this.#held = false;
    this.#tell();
    return kept;
  }

  // Un autre onglet, ou une autre section de GFS dans la page, a changé une clé : on relit les deux.
  reload() {
    this.#held = true;
    this.#ambiance.reload();
    this.#color.reload();
    this.#access.reload();
    this.#held = false;
    this.#tell();
  }

  // Le navigateur dit qu'une clé a changé ailleurs (événement `storage`) : rend de quoi s'arrêter.
  watch(win = window) {
    const stops = [AMBIANCE_KEY, COLOR_KEY, ACCESS_KEY].map(key => watchKey({ reload: () => this.reload() }, key, win));
    return () => stops.forEach(stop => stop());
  }

  // listener({ ambiance, color, access }) : appelé quand le choix change vraiment (une fois par geste).
  onChange(listener) {
    this.#listeners.push(listener);
    return () => { this.#listeners = this.#listeners.filter(item => item !== listener); };
  }

  #key() { return `${this.ambiance}|${this.color}|${this.access}`; }

  #tell() {
    if (this.#held) return;
    const key = this.#key();
    if (key === this.#told) return;
    this.#told = key;
    for (const listener of [...this.#listeners]) listener({ ambiance: this.ambiance, color: this.color, access: this.access });
  }
}
