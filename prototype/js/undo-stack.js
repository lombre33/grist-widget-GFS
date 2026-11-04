// La pile d'annulation de l'explorateur (demande du porteur, 04/11 : « Ctrl+Z doit aussi faire revenir un fichier supprimé, et plus globalement toutes les modifications : renommage, déplacement, etc. »).
// Chaque geste de l'explorateur qui a abouti dépose ici de quoi se défaire (`push`) ; Ctrl+Z (ou ⌘+Z) défait le dernier, puis l'avant-dernier : un geste par appui, dans l'ordre inverse. Défaire écrit comme le
// geste d'origine (le rangement, le nom, la corbeille) et ne laisse rien derrière lui : il n'y a pas de « rétablir ». Les gestes qui ne s'annulent pas (supprimer pour de bon, vider la corbeille : la fenêtre
// le dit avant) n'y déposent rien. La pile vit autant que l'explorateur de la page (elle survit à sa fermeture : on peut revenir de l'app et défaire) ; chaque annulation relit l'état d'aujourd'hui et le
// dit quand le fichier n'est plus là ou a changé entre-temps, au lieu d'écrire à l'aveugle.

const LIMIT = 50; // les gestes gardés : les plus anciens s'oublient
const REASON_MAX = 120;

export class UndoStack {
  #opts;
  #items = [];
  #replaying = false;

  // opts : { t, notice(texte) }
  constructor(opts) { this.#opts = opts; }

  get size() { return this.#items.length; }

  // Dépose de quoi défaire le geste qui vient d'aboutir : `entry.run()` rend la phrase qui dit ce qui est revenu (déjà traduite), ou rien quand le geste l'a dite lui-même (la corbeille), ou `{ said, again: true }`
  // quand rien n'a pu se faire mais que cela pourra plus tard (l'app qui doit être ouverte : la phrase le dit, et le geste reste à défaire). Ce qu'une annulation écrit elle-même n'est pas déposé : défaire ne
  // se défait pas (Ctrl+Z ne va pas et vient).
  push(entry) {
    if (this.#replaying) return;
    this.#items.push(entry);
    if (this.#items.length > LIMIT) this.#items.shift();
  }

  clear() { this.#items = []; }

  // Ctrl+Z : défait le dernier geste. Un seul à la fois (un second appui pendant l'écriture est ignoré). Rend true quand il y avait quelque chose à défaire.
  async undo() {
    const { t, notice } = this.#opts;
    if (this.#replaying) return false;
    const entry = this.#items.pop();
    if (!entry) { notice(t('undo.nothing')); return false; }
    this.#replaying = true;
    try {
      const done = await entry.run();
      const said = done && typeof done === 'object' ? done.said : done;
      if (done && done.again) this.#items.push(entry);
      if (said) notice(said);
    } catch (error) {
      if (!(error && error.expected)) console.warn('GFS : l’annulation a échoué', error);
      notice(t('undo.failed', { reason: String((error && error.message) || error).slice(0, REASON_MAX) }));
    } finally {
      this.#replaying = false;
    }
    return true;
  }
}
