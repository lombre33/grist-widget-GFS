// La corbeille de l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, pour tous les fichiers de toutes les apps, avec une
// corbeille) : mettre un fichier à la corbeille, le restaurer, le supprimer pour de bon, vider la corbeille. Ce module ne sait pas où vit un fichier : il le
// demande à un « gardien » (`managers`), celui qui sait l'écrire, et ne fait que ce qui est commun à tous : la vérification qu'on peut écrire, la question
// avant ce qui ne s'annule pas (une fenêtre du widget), la phrase qui dit ce qui s'est passé, la liste relue. Un fichier qu'aucun gardien ne connaît n'a pas de
// corbeille depuis GFS : l'explorateur le grise et dit pourquoi.
//
// Un gardien est : { manages(fichier) -> bool, lock(fichier?, geste?) -> { text } | null (rien ne peut s'écrire), trash(fichier) -> Promise<bool | { said } | {
// declined }>, restore(fichier) -> Promise<{ name, renamed } | null>, empty(fichiers) -> Promise<nombre de fichiers supprimés pour de bon> }. `said` : une
// phrase que l'app ajoute à celle de GFS ; `declined` : l'app n'a pas fermé le fichier, rien n'est écrit, et sa phrase (peut-être vide) est dite ; un gardien
// dont le geste attend l'app ouverte a aussi `waitsForApp(fichier, geste) -> { text } | null` (js/files/app-files.js). Les gardiens écrivent seulement quand la
// personne l'a demandé (un geste de l'explorateur) ; aucun n'efface sans passer par la corbeille, sauf `empty`, qui ne touche que des fichiers déjà à la
// corbeille. Une erreur d'un gardien qui porte `expected: true` est un refus voulu (la personne a refusé de créer une table, une ligne ne se garde pas) : la
// phrase de l'explorateur l'explique, la console reste muette.
//
// Afficher avant d'écrire (choix du porteur, 24/11 : « oui, sauf si l'app doit répondre ») : quand le gardien dit qu'il n'a rien à demander
// (`instant(fichier)` : la table de la corbeille existe déjà, l'app n'a pas à fermer le fichier), mettre à la corbeille fait partir la ligne de la liste à
// l'instant (`opts.later.pending`, js/explorer/pending.js) et l'écriture suit, à son rang dans la file des écritures de rangement (`opts.later.queue`,
// js/explorer/filing.js). Si elle aboutit, la phrase est dite et la liste relue ; si Grist refuse (une ligne avec des pièces jointes, un échec), la ligne
// revient et la phrase dit pourquoi. Le geste rend true tout de suite et appelle `onDone` quand l'écriture a abouti : c'est alors seulement que la pile
// d'annulation reçoit de quoi le défaire. Restaurer, supprimer pour de bon et vider la corbeille s'écrivent toujours d'abord.

const REASON_MAX = 120;
const NAMES_SHOWN = 5;

// Le nom que les phrases donnent à un fichier, et la raison d'un échec, en une ligne : js/files/copying.js les reprend.
export const nameOf = (file, t) => file.name || t('ex.untitled');
export const reasonOf = error => String((error && error.message) || error).slice(0, REASON_MAX);

export class Trash {
  #opts;

  // opts : { managers: [gardien], ask(fenêtre) -> Promise<bool> (la fenêtre du widget : js/ui/ask-window.js), t, notice(texte), refresh() -> Promise (relire
  //   les
  //   fichiers),
  //          keepFolders?(fichier) -> Promise (appelé quand le fichier est à la corbeille, avant que la liste soit relue : le dossier qu'il laisse sans fichier
  //          est gardé, js/explorer/filing.js),
  //          later?: { pending (js/explorer/pending.js), queue(tâche) -> Promise (la file des écritures), left(fichier) -> [chemins] (les dossiers que le
  //          fichier laisse vides), keep(fichier) -> Promise (les garder, depuis la file), refresh({ quiet }) } : de quoi afficher d'avance }
  constructor(opts) {
    this.#opts = { keepFolders: async () => {}, ...opts };
  }

  // Le gardien d'un fichier, ou null : GFS sait-il le supprimer ?
  managerOf(file) { return this.#opts.managers.find(manager => manager.manages(file)) || null; }

  handles(file) { return this.managerOf(file) !== null; }

  // Mettre ce fichier à la corbeille attend l'app ouverte (un fichier qui tient à plus qu'une ligne, contrats 2.4 `appel`) et elle ne l'est pas : { text } pour
  // griser l'article et dire d'ouvrir l'app. Sinon null.
  appLockOf(file) {
    const manager = this.managerOf(file);
    return manager && typeof manager.waitsForApp === 'function' ? manager.waitsForApp(file, 'trash') : null;
  }

  // ---------- les gestes ----------

  // Met le fichier à la corbeille. Pas de question : la corbeille se vide à la main, et rien n'est perdu. Rend true quand le fichier y est, ou quand il part de
  // la liste en attendant (voir l'en-tête). `onDone` : rappelée quand le fichier est vraiment à la corbeille (jamais s'il n'y est pas).
  async move(file, onDone = () => {}) {
    const manager = this.managerOf(file);
    const { later } = this.#opts;
    if (later && manager && typeof manager.instant === 'function' && manager.instant(file)) return this.#moveLater(manager, file, onDone);
    const ok = await this.#act(file, 'trash.failed', manager2 => this.#trashTask(manager2, file, () => this.#keepFolders(file)), null, 'trash');
    if (ok) onDone();
    return ok;
  }

  // Le geste lui-même : le gardien met le fichier à la corbeille, le dossier qu'il laisse vide est gardé. Rend { ok, gone?, text } : la phrase à dire ;
  // `gone` : le fichier n'est plus dans la table de l'app (rien à mettre à la corbeille, mais il n'est plus vivant non plus).
  async #trashTask(manager, file, keep) {
    const { t } = this.#opts;
    const name = nameOf(file, t);
    const done = await manager.trash(file);
    if (done && done.declined !== undefined) return { ok: false, text: done.declined };
    if (!done) return { ok: false, gone: true, text: t('trash.gone', { name }) };
    await keep();
    return { ok: true, text: [t('trash.moved', { name }), done.said].filter(Boolean).join(' ') };
  }

  // Le même geste, affiché d'avance : la ligne part de la liste tout de suite, l'écriture prend son rang dans la file. Le verrou (lecture seule, accès partiel)
  // se dit avant, comme d'habitude. Le fichier qui n'est plus là reste hors de la liste (la relecture le confirme) ; un refus ou un échec le fait revenir.
  #moveLater(manager, file, onDone) {
    const { t, notice, later } = this.#opts;
    const lock = manager.lock(file, 'trash');
    if (lock) { notice(lock.text); return Promise.resolve(false); }
    const left = later.left(file);
    const change = later.pending.add([{ op: 'leave', app: file.app, id: file.id }, ...(left.length ? [{ op: 'addFolders', paths: left }] : [])]);
    void later.queue(async () => {
      let said = null;
      try {
        said = await this.#trashTask(manager, file, () => this.#keepFolders(file, later.keep));
      } catch (error) {
        if (!(error && error.expected)) console.warn('GFS : le geste sur la corbeille a échoué', error);
        notice(t('trash.failed', { name: nameOf(file, t), reason: reasonOf(error) }));
      }
      if (said && said.text) notice(said.text);
      if (said && said.ok) onDone();
      if (said && (said.ok || said.gone)) later.pending.confirm(change); else later.pending.cancel(change);
      await later.refresh({ quiet: true });
    }).catch(() => {});
    return Promise.resolve(true);
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
      title: t('trash.emptyAll.title'), message: t('trash.emptyAll.text', { n: files.length }),
        items: [...names.slice(0, NAMES_SHOWN), ...(names.length > NAMES_SHOWN ? ['…'] : [])],
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

  // Le dossier d'un fichier qui part à la corbeille reste, comme après un déplacement. Si cela ne s'écrit pas, le fichier est quand même à la corbeille : la
  // console le sait, la personne n'a rien à en lire.
  async #keepFolders(file, keep = this.#opts.keepFolders) {
    try {
      await keep(file);
    } catch (error) {
      console.warn('GFS : le dossier du fichier n’a pas pu être gardé', error);
    }
  }

  // Un geste sur un fichier : le gardien doit pouvoir écrire (sinon la phrase dit pourquoi, rien n'est demandé) ; `confirm` (une fenêtre) est posée avant ce
  // qui ne s'annule pas ; la phrase du résultat est dite et la liste relue, même après un échec (une autre personne a pu changer les fichiers). Rend true quand
  // le geste a abouti.
  async #act(file, failKey, task, confirm = null, gesture = undefined) {
    const { t, notice, refresh, ask } = this.#opts;
    const manager = this.managerOf(file);
    if (!manager) return false;
    const lock = manager.lock(file, gesture);
    if (lock) { notice(lock.text); return false; }
    if (confirm && !(await ask({ ...confirm, cancelLabel: t('table.cancel'), safeFirst: true }))) return false;
    let ok = false;
    try {
      const said = await task(manager);
      if (said.text) notice(said.text);
      ok = said.ok;
    } catch (error) {
      // un refus voulu (`expected`) est dit à la personne, pas à la console
      if (!(error && error.expected)) console.warn('GFS : le geste sur la corbeille a échoué', error);
      notice(t(failKey, { name: nameOf(file, t), reason: reasonOf(error) }));
    }
    await refresh();
    return ok;
  }
}
