// Le bouton « LanguageTool » de la barre (demande du porteur, 12/11 ; contrats 5.2, point 13) : un correcteur du navigateur (LanguageTool) juge chaque cadre
// d'après sa propre adresse, donc son interrupteur « pour ce site » ne coupe rien dans le cadre d'une app (mesuré par le porteur le 12/11, faits vérifiés 104).
// GFS ne touche ni à l'extension ni au texte d'une app (cadre isolé) : il retient deux choix de la personne, et dit à l'app « correcteurs coupés » ou non ;
// l'app pose alors sur chacune de ses zones de texte la marque `data-lt-active="false"` que LanguageTool respecte, à chaud et sans recharger (kit,
// `js/correcteurs.js`).
//   - `shown` : la ligne « Bouton LanguageTool » du menu « Réglages » : le bouton est dans la barre (clé `gfs.langtool`, absente tant que la personne ne l'a
//   pas voulu) ;
//   - `cut`   : le bouton, enfoncé ou non : LanguageTool est coupé dans les apps (clé `gfs.correcteurs`).
// Sans le bouton dans la barre, rien n'est coupé : GFS laisse les correcteurs comme le navigateur les fait (le choix de couper est gardé, il reprend quand le
// bouton revient). Les deux choix sont retenus dans le `localStorage` de GFS, jamais dans le document, et suivis d'un onglet à l'autre.

import { StoredChoice, keyStore, watchKey } from './stored-choice.js';

export const SHOWN_KEY = 'gfs.langtool';
export const CUT_KEY = 'gfs.correcteurs';

const choice = (win, key) => new StoredChoice({
  choices: ['non', 'oui'], fallback: 'non', store: keyStore(win, key), keep: value => (value === 'oui' ? 'oui' : null),
});

export class Correcteurs {
  #shown;
  #cut;
  #state;
  #listeners = [];

  constructor({ win = window } = {}) {
    this.#shown = choice(win, SHOWN_KEY);
    this.#cut = choice(win, CUT_KEY);
    this.#state = this.state;
    for (const [setting, key] of [[this.#shown, SHOWN_KEY], [this.#cut, CUT_KEY]]) {
      setting.onChange(() => this.#changed());
      watchKey(setting, key, win);
    }
  }

  // L'état qui vaut : le bouton est-il dans la barre, et les correcteurs sont-ils coupés dans les apps (jamais sans le bouton).
  get state() {
    const shown = this.#shown.value === 'oui';
    return { shown, coupes: shown && this.#cut.value === 'oui' };
  }

  // Ce que les apps reçoivent (`contexte.correcteurs` et événement `correcteurs`, contrats 5.2, point 13).
  message() { return { coupes: this.state.coupes }; }

  // La ligne « Bouton LanguageTool » : rend `true` si le navigateur a retenu le choix (sinon il vaut jusqu'au rechargement de la page).
  setShown(on) { return this.#shown.choose(on ? 'oui' : 'non'); }

  // Le bouton de la barre : coupe ou rallume ; rend `true` si le navigateur a retenu le choix.
  toggleCut() { return this.#cut.choose(this.#cut.value === 'oui' ? 'non' : 'oui'); }

  // listener(état, état d'avant) : appelé quand `shown` ou `coupes` change vraiment.
  onChange(listener) {
    this.#listeners.push(listener);
    return () => { this.#listeners = this.#listeners.filter(item => item !== listener); };
  }

  #changed() {
    const before = this.#state;
    const now = this.state;
    if (now.shown === before.shown && now.coupes === before.coupes) return;
    this.#state = now;
    for (const listener of [...this.#listeners]) listener(now, before);
  }
}
