// La pile d'annulation de l'explorateur (demande du porteur, 04/11 : « Ctrl+Z doit aussi faire revenir un fichier supprimé, et plus globalement toutes les
// modifications : renommage, déplacement, etc. » ; puis, à sa carte du même jour, « Oui, au clavier seulement » : Ctrl+Y et Ctrl+Maj+Z rétablissent). Chaque
// geste de l'explorateur qui a abouti dépose ici de quoi se défaire (`push`) ; Ctrl+Z (ou ⌘+Z) défait le dernier, puis l'avant-dernier : un geste par appui,
// dans l'ordre inverse. Défaire écrit comme le geste d'origine (le rangement, le nom, la corbeille) ; ce que l'annulation écrit dépose à son tour de quoi la
// défaire, mais **dans la pile du rétablissement** : Ctrl+Y (ou Ctrl+Maj+Z) refait le geste qu'on vient de défaire, et ce que le rétablissement écrit retourne
// dans la pile des annulations (Ctrl+Z, Ctrl+Y, Ctrl+Z ne tournent pas en rond : chaque appui avance d'un cran). **Un geste neuf vide la pile du
// rétablissement** (ce qu'on avait défait ne se refait plus : l'état a changé). Les gestes qui ne s'annulent pas (supprimer pour de bon, vider la corbeille :
// la fenêtre le dit avant) n'y déposent rien. Les piles vivent autant que la page (elles survivent à la fermeture de l'explorateur : on peut revenir de l'app
// et défaire) ; chaque annulation ou rétablissement relit l'état d'aujourd'hui et le dit quand le fichier n'est plus là ou a changé entre-temps, au lieu
// d'écrire à l'aveugle.

const LIMIT = 50; // les gestes gardés, dans chaque pile : les plus anciens s'oublient
const REASON_MAX = 120;

const keep = (list, entry) => { list.push(entry); if (list.length > LIMIT) list.shift(); };

export class UndoStack {
  #opts;
  #done = []; // les gestes à défaire (Ctrl+Z), le dernier en dernier
  #undone = []; // les gestes défaits, à refaire (Ctrl+Y)
  #mode = null; // 'undo' ou 'redo' pendant qu'une annulation ou un rétablissement écrit, sinon null

  // opts : { t, notice(texte) }
  constructor(opts) { this.#opts = opts; }

  get size() { return this.#done.length; }

  get redoSize() { return this.#undone.length; }

  // Dépose de quoi défaire le geste qui vient d'aboutir : `entry.run()` rend la phrase qui dit ce qui est revenu (déjà traduite), ou rien quand le geste l'a
  // dite lui-même (la corbeille), ou `{ said, again: true }` quand rien n'a pu se faire mais que cela pourra plus tard (l'app qui doit être ouverte : la phrase
  // le dit, et le geste reste à défaire). Pendant une annulation, ce qui est déposé est de quoi la refaire (pile du rétablissement) ; pendant un
  // rétablissement, de quoi le défaire de nouveau ; un geste neuf vide la pile du rétablissement.
  push(entry) {
    if (this.#mode === 'undo') { keep(this.#undone, entry); return; }
    keep(this.#done, entry);
    if (this.#mode === null) this.#undone = [];
  }

  clear() { this.#done = []; this.#undone = []; }

  // Ctrl+Z : défait le dernier geste. Un seul à la fois (un second appui pendant l'écriture est ignoré). Rend true quand il y avait quelque chose à défaire.
  undo() { return this.#replay('undo'); }

  // Ctrl+Y ou Ctrl+Maj+Z : refait le dernier geste défait.
  redo() { return this.#replay('redo'); }

  async #replay(kind) {
    const { t, notice } = this.#opts;
    if (this.#mode) return false;
    const from = kind === 'undo' ? this.#done : this.#undone;
    const entry = from.pop();
    if (!entry) { notice(t(`${kind}.nothing`)); return false; }
    this.#mode = kind;
    try {
      await this.#play(kind, entry, from);
    } finally {
      this.#mode = null;
    }
    return true;
  }

  // Joue le geste : ce qu'il dit se dit ; un geste à refaire en plusieurs fois (`again`) reste sur sa pile ; un échec se dit avec sa raison (et s'écrit, sauf
  // un échec prévu).
  async #play(kind, entry, from) {
    const { t, notice } = this.#opts;
    try {
      const done = await entry.run();
      const said = done && typeof done === 'object' ? done.said : done;
      if (done && done.again) keep(from, entry);
      if (said) notice(said);
    } catch (error) {
      if (!(error && error.expected)) console.warn(`GFS : ${kind === 'undo' ? 'l’annulation' : 'le rétablissement'} a échoué`, error);
      notice(t(`${kind}.failed`, { reason: String((error && error.message) || error).slice(0, REASON_MAX) }));
    }
  }
}
