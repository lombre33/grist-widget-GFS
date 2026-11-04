// La copie d'un fichier depuis l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, « Dupliquer » et Ctrl+C puis Ctrl+V compris). Ce module ne sait pas où vit un fichier : il le demande
// à un « gardien » (les mêmes que ceux de la corbeille, js/trash.js, qui ajoutent `copies` et `copy`), celui qui sait l'écrire, et ne fait que ce qui est commun à tous : la vérification qu'on peut écrire, le
// dossier de la copie (le rangement de la personne, js/rangement.js), la phrase qui dit ce qui s'est passé, la liste relue. Un fichier qu'aucun gardien ne sait copier n'a pas de « Dupliquer » depuis GFS :
// l'explorateur le grise et dit pourquoi (ouvrir le fichier dans son app).
//
// Un gardien qui copie est : { copies(fichier) -> bool, lock() -> { text } | null (rien ne peut s'écrire), copy(fichier) -> Promise<{ id, name } | null> } ; `id` est l'identifiant que l'explorateur lira pour
// la copie, `name` son nom (le premier nom libre), `null` : le fichier n'est plus là. Une erreur d'un gardien qui porte `expected: true` est un refus voulu : la phrase l'explique, la console reste muette.

import { TableDeclined } from './own-table.js';
import { fileKey } from './explorer-model.js';
import { nameOf, reasonOf } from './trash.js';

export class Copying {
  #opts;

  // opts : { managers: [gardien], t, notice(texte), refresh() -> Promise (relire les fichiers), file(app, id, dossier) -> Promise (ranger la copie dans `dossier` : js/rangement.js, lève `TableDeclined` quand la
  //          personne refuse la table du rangement) }
  constructor(opts) {
    this.#opts = opts;
  }

  // Le gardien qui sait copier ce fichier, ou null.
  managerOf(file) { return this.#opts.managers.find(manager => typeof manager.copies === 'function' && manager.copies(file)) || null; }

  handles(file) { return this.managerOf(file) !== null; }

  // Copie `file`, et range la copie dans le dossier `folder` ('' : à la racine, rien à ranger). La phrase est dite et la liste relue, même après un échec (une autre personne a pu changer les fichiers).
  // Rend { key, name } : la clé de la copie dans l'explorateur et son nom, ou null quand rien n'a été copié.
  async copy(file, folder) {
    const { t, notice, refresh } = this.#opts;
    const manager = this.managerOf(file);
    if (!manager) return null;
    const lock = manager.lock();
    if (lock) { notice(lock.text); return null; }
    const name = nameOf(file, t);
    let result = null;
    try {
      const done = await manager.copy(file);
      if (done) {
        notice(await this.#said(file, done, folder));
        result = { key: fileKey(file.app, done.id), name: done.name };
      } else {
        notice(t('copy.gone', { name }));
      }
    } catch (error) {
      if (!(error && error.expected)) console.warn('GFS : la copie a échoué', error); // un refus voulu (`expected`) est dit à la personne, pas à la console
      notice(t('copy.failed', { name, reason: reasonOf(error) }));
    }
    await refresh();
    return result;
  }

  // La phrase qui dit la copie faite, après l'avoir rangée dans `folder`. Un rangement qui échoue ne perd pas la copie : elle existe, à la racine, et la phrase le dit.
  async #said(file, done, folder) {
    const { t } = this.#opts;
    if (!folder) return t('copy.done', { as: done.name });
    try {
      await this.#opts.file(file.app, done.id, folder);
      return t('copy.doneIn', { as: done.name, folder });
    } catch (error) {
      const declined = error instanceof TableDeclined;
      if (!declined) console.warn('GFS : la copie n’a pas pu être rangée dans son dossier', error);
      return `${t('copy.done', { as: done.name })} ${declined ? t('ex.filingDeclined') : t('ex.filingFailed', { reason: reasonOf(error) })}`;
    }
  }
}
