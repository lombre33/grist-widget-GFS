// La case « + pièces jointes » de l'explorateur (js/explorer.js) : son état et ses lectures. Le dessin reste à js/explorer-view.js (`pjBox`, `totalBar`). Sorti de l'explorateur pour qu'il reste sous les 600 lignes de code
// de l'outil d'audit, et pour que la course des lectures (une réponse plus ancienne est ignorée) ait son essai.
//
// deps : { t, hasSource() (GFS sait-il lire la table des pièces jointes), load() (la lit : { data } ou { error }), restricted() (pas d'accès complet), files(), trashed() (les fichiers vivants et à la corbeille),
//          changed() (le total est à redessiner) }

import { pieceKeys, otherAttachments } from './weight.js';

const NO_OTHER = Object.freeze({ bytes: 0, count: 0 });

export class PiecesBox {
  // cochée (`on`), la table de Grist lue (`table`), ce qu'elle ajoute au total (`other`), une lecture en cours (`busy`), ou en échec (`failed`, `reason`)
  #state = { on: false, table: null, other: NO_OTHER, busy: false, failed: false, reason: '' };
  #run = 0; // le numéro de la dernière lecture : une réponse plus ancienne est ignorée
  #deps;

  constructor(deps) { this.#deps = deps; }

  // La case, ce qu'elle ajoute au total, et, quand GFS ne peut pas lire les pièces jointes, la raison : grisée, jamais masquée (charte).
  facts() {
    const { t } = this.#deps;
    const { on, table, other, busy, failed, reason } = this.#state;
    let grey = '';
    if (!this.#deps.hasSource()) grey = t('weight.pjNone');
    else if (this.#deps.restricted()) grey = t('gfs.needsFullAccess');
    else if (failed) grey = t('weight.pjFailed', { reason });
    return { on: on && !grey, ready: table !== null, busy, bytes: other.bytes, count: other.count, grey };
  }

  // Les fichiers ont changé : une lecture qui avait échoué se retente au prochain clic sur la case, et le compte est refait.
  filesChanged() {
    this.#state.failed = false;
    this.#count();
  }

  // Après la mise à jour de la liste : la case cochée relit (un PDF ajouté ou retiré change les pièces jointes).
  reread() {
    if (this.#state.on && this.#deps.hasSource()) void this.#read();
  }

  // Un clic sur la case, `checked` son nouvel état : grisée, rend la raison (le clic ne coche rien) ; sinon rend `null`, et les pièces jointes ne se lisent que cochée.
  toggle(checked) {
    const { grey } = this.facts();
    if (grey) return grey;
    this.#state.on = checked;
    if (checked) { void this.#read(); return null; }
    this.#run += 1;
    Object.assign(this.#state, { table: null, other: NO_OTHER, busy: false });
    this.#deps.changed();
    return null;
  }

  // Lit la table des pièces jointes de Grist. Pendant une relecture, le total garde ce qu'il disait ; un échec décoche la case et la grise avec sa raison.
  async #read() {
    const run = ++this.#run;
    this.#state.busy = true;
    this.#deps.changed();
    let result;
    try { result = await this.#deps.load(); } catch (error) { result = { error }; }
    if (run !== this.#run) return;
    this.#state.busy = false;
    if (result.error) Object.assign(this.#state, { on: false, failed: true, table: null, reason: String(result.error.message || result.error) });
    else this.#state.table = result.data;
    this.#count();
    this.#deps.changed();
  }

  // Ce que la case ajoute : les pièces jointes de la table qu'aucun fichier de l'explorateur, vivant ou à la corbeille, ne cite (js/weight.js).
  #count() {
    this.#state.other = this.#state.table ? otherAttachments(this.#state.table, pieceKeys(this.#deps.files(), this.#deps.trashed())) : NO_OTHER;
  }
}
