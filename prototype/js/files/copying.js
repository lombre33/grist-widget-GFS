// La copie d'un fichier depuis l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, « Dupliquer » et Ctrl+C puis Ctrl+V compris). Ce
// module ne sait pas où vit un fichier : il le demande à un « gardien » (les mêmes que ceux de la corbeille, js/files/trash.js, qui ajoutent `copies` et
// `copy`), celui qui sait l'écrire, et ne fait que ce qui est commun à tous : la vérification qu'on peut écrire, le dossier de la copie (le rangement de la
// personne, js/files/rangement.js), la phrase qui dit ce qui s'est passé, la liste relue. Un fichier qu'aucun gardien ne sait copier n'a pas de « Dupliquer »
// depuis GFS : l'explorateur le grise et dit pourquoi (ouvrir le fichier dans son app).
//
// Un gardien qui copie est : { copies(fichier) -> bool, lock(fichier, geste) -> { text } | null (rien ne peut s'écrire), copy(fichier) -> Promise<{ id, name,
// said? } | { declined } | null> } ; `id` est l'identifiant que l'explorateur lira pour la copie, `name` son nom (le premier nom libre), `said` une phrase que
// l'app ajoute à celle de GFS, `declined` : l'app n'a rien copié (sa phrase, peut-être vide, est dite), `null` : le fichier n'est plus là. Un gardien dont la
// copie attend l'app ouverte a aussi `waitsForApp(fichier, geste) -> { text } | null` (js/files/app-files.js). Une erreur d'un gardien qui porte `expected:
// true` est un refus voulu : la phrase l'explique, la console reste muette.

import { TableDeclined } from './own-table.js';
import { fileKey } from '../explorer/explorer-model.js';
import { nameOf, reasonOf } from './trash.js';

export class Copying {
  #opts;

  // opts : { managers: [gardien], t, notice(texte), refresh() -> Promise (relire les fichiers), file(app, id, dossier) -> Promise (ranger la copie dans
  //   `dossier` : js/files/rangement.js, lève `TableDeclined` quand la
  //          personne refuse la table du rangement) }
  constructor(opts) {
    this.#opts = opts;
  }

  // Le gardien qui sait copier ce fichier, ou null.
  managerOf(file) { return this.#opts.managers.find(manager => typeof manager.copies === 'function' && manager.copies(file)) || null; }

  handles(file) { return this.managerOf(file) !== null; }

  // Copier ce fichier attend l'app ouverte (contrats 2.4 `appel`) et elle ne l'est pas : { text } pour griser l'article et dire d'ouvrir l'app. Sinon null.
  appLockOf(file) {
    const manager = this.managerOf(file);
    return manager && typeof manager.waitsForApp === 'function' ? manager.waitsForApp(file, 'copy') : null;
  }

  // Copie `file`, et range la copie dans le dossier `folder` ('' : à la racine, rien à ranger). La phrase est dite et la liste relue, même après un échec (une
  // autre personne a pu changer les fichiers). Rend { key, name } : la clé de la copie dans l'explorateur et son nom, ou null quand rien n'a été copié.
  async copy(file, folder) {
    const { t, notice, refresh } = this.#opts;
    const manager = this.managerOf(file);
    if (!manager) return null;
    const lock = manager.lock(file, 'copy');
    if (lock) { notice(lock.text); return null; }
    const name = nameOf(file, t);
    let result = null;
    try {
      const done = await manager.copy(file);
      if (done && done.declined !== undefined) {
        if (done.declined) notice(done.declined);
      } else if (done) {
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

  // La phrase qui dit la copie faite, après l'avoir rangée dans `folder`. Un rangement qui échoue ne perd pas la copie : elle existe, à la racine, et la phrase
  // le dit.
  async #said(file, done, folder) {
    const { t } = this.#opts;
    const add = text => [text, done.said].filter(Boolean).join(' '); // la phrase que l'app ajoute (un fichier qu'elle copie elle-même), après celle de GFS
    if (!folder) return add(t('copy.done', { as: done.name }));
    try {
      await this.#opts.file(file.app, done.id, folder);
      return add(t('copy.doneIn', { as: done.name, folder }));
    } catch (error) {
      const declined = error instanceof TableDeclined;
      if (!declined) console.warn('GFS : la copie n’a pas pu être rangée dans son dossier', error);
      return add(`${t('copy.done', { as: done.name })} ${declined ? t('ex.filingDeclined') : t('ex.filingFailed', { reason: reasonOf(error) })}`);
    }
  }
}
