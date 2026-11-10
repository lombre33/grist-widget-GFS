// Les fichiers ouverts (la vue « Ouverts » de l'explorateur, contrats 6.4 point 14) : ceux que la personne a ouverts dans une app depuis qu'elle est dans ce document, pour y revenir d'un clic et
// faire des allers-retours sans repartir de l'arborescence. Une liste de clés (`app:id`, js/explorer-model.js) et rien d'autre : le nom, le type, la date, le dossier et le poids se lisent chaque
// fois dans les fichiers vivants (un fichier renommé, déplacé ou mis à la corbeille y est à jour, un fichier disparu n'y est plus).
// Gardée en mémoire seulement, jamais dans Grist ni dans le navigateur : quand Grist recharge le widget tous les cadres meurent, et la liste avec eux.
// GFS ne connaît que ce qu'il ouvre lui-même : un fichier que l'app ouvre de son côté n'y entre pas.

// Les derniers fichiers ouverts qu'elle garde : le plus ancien sort quand un neuvième arrive (comme « Récents »).
export const OPENED_LIMIT = 8;

// Sans fichiers ouverts (les essais de l'explorateur seul) : la vue « Ouverts » est vide.
export const NO_OPENED = Object.freeze({ keys: () => [], shown: () => null, remove: () => {} });

export class OpenedFiles {
  #keys = []; // du plus ancien au plus récent
  #shown = null; // { key, session } : le dernier fichier que GFS a ouvert, dans la session d'app qui le montre

  // Un fichier vient d'être ouvert par GFS dans `session` : il passe en tête de la liste, et c'est lui que l'app affiche.
  add(key, session) {
    this.#keys = [...this.#keys.filter(known => known !== key), key].slice(-OPENED_LIMIT);
    this.#shown = { key, session };
  }

  // GFS vient d'ouvrir autre chose qu'un fichier précis (un fichier vierge par « Nouveau », ou d'après un fichier par « Importer ») : l'app n'affiche plus aucun fichier de la liste.
  none() { this.#shown = null; }

  // « Retirer des ouverts » : le fichier sort de la liste, rien d'autre ne change (l'app garde ce qu'elle affiche).
  remove(key) {
    this.#keys = this.#keys.filter(known => known !== key);
    if (this.#shown && this.#shown.key === key) this.#shown = null;
  }

  keys() { return [...this.#keys]; }

  // Le fichier que l'app active affiche, quand c'est GFS qui le lui a donné : `null` dès que la session d'app n'est plus la même (l'app a été remplacée, ou rouverte sans fichier).
  shown(session) { return this.#shown && session && this.#shown.session === session ? this.#shown.key : null; }
}
