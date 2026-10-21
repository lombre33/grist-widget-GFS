// Un choix de la personne, retenu sur le navigateur de GFS (jamais dans le document ni dans une table) : la langue, le bord de la barre. Une clé du `localStorage` de GFS ;
// une valeur étrangère (une main qui y a écrit, une version à venir) est tenue pour absente ; un navigateur qui refuse de retenir n'arrête rien (le choix vaut pour la page, et
// `choose` le dit) ; un autre onglet, ou une autre section de GFS dans la page, qui change la clé est suivi par l'événement `storage` du navigateur.

// Ce que le navigateur garde pour une clé : la lire, l'écrire, la retirer (`write(null)`). Un navigateur qui refuse (cadre sans stockage, navigation privée, quota) n'arrête rien :
// la lecture rend `null`, l'écriture rend `false`.
export function keyStore(win, key) {
  return {
    read() {
      try { return win.localStorage.getItem(key); } catch (error) { return null; }
    },
    write(value) {
      try {
        if (value === null) win.localStorage.removeItem(key);
        else win.localStorage.setItem(key, value);
        return true;
      } catch (error) { return false; }
    },
  };
}

// Le choix change ailleurs : le navigateur le dit par l'événement `storage`. `addEventListener` et non `window.onstorage =`, comme pour les messages (cela ne remplace l'écoute de personne).
export function watchKey(choice, key, win = window) {
  const handler = event => { if (event.key === null || event.key === key) choice.reload(); };
  win.addEventListener('storage', handler);
  return () => win.removeEventListener('storage', handler);
}

export class StoredChoice {
  #choices;
  #fallback;
  #store;
  #keep;
  #value;
  #listeners = [];

  // choices : les valeurs permises ; fallback : la valeur tant que rien n'est retenu (l'une des valeurs permises) ; store : { read(), write(valeur | null) → retenu ? } ;
  // keep(valeur) : ce qu'on écrit pour elle (`null` retire la clé : la langue « comme Grist » est la clé absente).
  constructor({ choices, fallback, store, keep = value => value }) {
    this.#choices = choices;
    this.#fallback = fallback;
    this.#store = store;
    this.#keep = keep;
    this.#value = this.#stored();
  }

  get value() { return this.#value; }

  #stored() {
    try {
      const found = this.#store.read();
      return this.#choices.includes(found) ? found : this.#fallback;
    } catch (error) { return this.#fallback; }
  }

  // Le choix de la personne. Rend `true` si le navigateur l'a retenu ; sinon il vaut jusqu'au rechargement de la page. Une valeur hors liste est ignorée.
  choose(value) {
    if (!this.#choices.includes(value)) return true;
    const kept = this.#store.write(this.#keep(value)) !== false;
    this.#apply(value);
    return kept;
  }

  // Un autre onglet, ou une autre section de GFS dans la page, a changé la clé : on relit.
  reload() { this.#apply(this.#stored()); }

  #apply(value) {
    const before = this.#value;
    if (value === before) return;
    this.#value = value;
    for (const listener of [...this.#listeners]) listener(value, before);
  }

  // listener(valeur, valeurAvant) : appelé quand la valeur change vraiment.
  onChange(listener) {
    this.#listeners.push(listener);
    return () => { this.#listeners = this.#listeners.filter(item => item !== listener); };
  }
}
