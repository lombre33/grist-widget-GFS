// La corbeille de l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, pour tous les fichiers de toutes les apps, avec une corbeille) : mettre un fichier à la corbeille,
// le restaurer, le supprimer pour de bon, vider la corbeille. Ce module ne sait pas où vit un fichier : il le demande à un « gardien » (`managers`), celui qui sait l'écrire, et ne fait que ce qui
// est commun à tous : la vérification qu'on peut écrire, la question avant ce qui ne s'annule pas (une fenêtre du widget), la phrase qui dit ce qui s'est passé, la liste relue. Un fichier
// qu'aucun gardien ne connaît n'a pas de corbeille depuis GFS : l'explorateur le grise et dit pourquoi.
//
// Un gardien est : { manages(fichier) -> bool, lock() -> { text } | null (rien ne peut s'écrire), trash(fichier) -> Promise<bool>, restore(fichier) -> Promise<{ name, renamed } | null>,
// empty(fichiers) -> Promise<nombre de fichiers supprimés pour de bon> }. Les gardiens écrivent seulement quand la personne l'a demandé (un geste de l'explorateur) ; aucun n'efface sans passer par
// la corbeille, sauf `empty`, qui ne touche que des fichiers déjà à la corbeille. Une erreur d'un gardien qui porte `expected: true` est un refus voulu (la personne a refusé de créer une table, une
// ligne ne se garde pas) : la phrase de l'explorateur l'explique, la console reste muette.

const REASON_MAX = 120;
const NAMES_SHOWN = 5;

// Le nom que les phrases donnent à un fichier, et la raison d'un échec, en une ligne : js/copying.js les reprend.
export const nameOf = (file, t) => file.name || t('ex.untitled');
export const reasonOf = error => String((error && error.message) || error).slice(0, REASON_MAX);

export class Trash {
  #opts;

  // opts : { managers: [gardien], ask(fenêtre) -> Promise<bool> (la fenêtre du widget : js/ask-window.js), t, notice(texte), refresh() -> Promise (relire les fichiers) }
  constructor(opts) {
    this.#opts = opts;
  }

  // Le gardien d'un fichier, ou null : GFS sait-il le supprimer ?
  managerOf(file) { return this.#opts.managers.find(manager => manager.manages(file)) || null; }

  handles(file) { return this.managerOf(file) !== null; }

  // ---------- les gestes ----------

  // Met le fichier à la corbeille. Pas de question : la corbeille se vide à la main, et rien n'est perdu. Rend true quand le fichier y est.
  move(file) {
    const { t } = this.#opts;
    const name = nameOf(file, t);
    return this.#act(file, 'trash.failed', async manager => (await manager.trash(file)
      ? { ok: true, text: t('trash.moved', { name }) }
      : { ok: false, text: t('trash.gone', { name }) }));
  }

  // Sort le fichier de la corbeille. Le gardien dit s'il a fallu changer son nom (un autre fichier avait pris le sien).
  restore(file) {
    const { t } = this.#opts;
    const name = nameOf(file, t);
    return this.#act(file, 'trash.restoreFailed', async manager => {
      const done = await manager.restore(file);
      if (!done) return { ok: false, text: t('trash.notIn', { name }) };
      return { ok: true, text: done.renamed ? t('trash.restoredAs', { name, as: done.name }) : t('trash.restored', { name }) };
    });
  }

  // Supprime le fichier pour de bon, après la question (la fenêtre donne le clavier à « Annuler »).
  purge(file) {
    const { t } = this.#opts;
    const name = nameOf(file, t);
    const confirm = { title: t('trash.purge.title', { name }), message: t('trash.purge.text'), confirmLabel: t('trash.purge.confirm') };
    return this.#act(file, 'trash.purgeFailed', async manager => (await manager.empty([file])
      ? { ok: true, text: t('trash.purged', { name }) }
      : { ok: false, text: t('trash.notIn', { name }) }), confirm);
  }

  // Vide la corbeille : seuls les fichiers que la personne a sous les yeux (`files`) sont supprimés, pas ceux qu'une autre personne y a mis entre-temps.
  async empty(files) {
    const { t, notice, refresh, ask } = this.#opts;
    const groups = new Map();
    for (const file of files) {
      const manager = this.managerOf(file);
      if (manager) groups.set(manager, [...(groups.get(manager) || []), file]);
    }
    if (!groups.size) return false;
    const blocked = [...groups.keys()].map(manager => manager.lock()).find(Boolean);
    if (blocked) { notice(blocked.text); return false; }
    const names = files.map(file => nameOf(file, t));
    const yes = await ask({
      title: t('trash.emptyAll.title'), message: t('trash.emptyAll.text', { n: files.length }), items: [...names.slice(0, NAMES_SHOWN), ...(names.length > NAMES_SHOWN ? ['…'] : [])],
      confirmLabel: t('trash.emptyAll.confirm'), cancelLabel: t('table.cancel'), safeFirst: true,
    });
    if (!yes) return false;
    let ok = false;
    try {
      let removed = 0;
      for (const [manager, group] of groups) removed += await manager.empty(group);
      notice(t('trash.emptied', { n: removed }));
      ok = true;
    } catch (error) {
      console.warn('GFS : la corbeille n’a pas pu être vidée', error);
      notice(t('trash.emptyFailed', { reason: reasonOf(error) }));
    }
    await refresh();
    return ok;
  }

  // Un geste sur un fichier : le gardien doit pouvoir écrire (sinon la phrase dit pourquoi, rien n'est demandé) ; `confirm` (une fenêtre) est posée avant ce qui ne s'annule pas ; la phrase du
  // résultat est dite et la liste relue, même après un échec (une autre personne a pu changer les fichiers). Rend true quand le geste a abouti.
  async #act(file, failKey, task, confirm = null) {
    const { t, notice, refresh, ask } = this.#opts;
    const manager = this.managerOf(file);
    if (!manager) return false;
    const lock = manager.lock();
    if (lock) { notice(lock.text); return false; }
    if (confirm && !(await ask({ ...confirm, cancelLabel: t('table.cancel'), safeFirst: true }))) return false;
    let ok = false;
    try {
      const said = await task(manager);
      notice(said.text);
      ok = said.ok;
    } catch (error) {
      if (!(error && error.expected)) console.warn('GFS : le geste sur la corbeille a échoué', error); // un refus voulu (`expected`) est dit à la personne, pas à la console
      notice(t(failKey, { name: nameOf(file, t), reason: reasonOf(error) }));
    }
    await refresh();
    return ok;
  }
}
