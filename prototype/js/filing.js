// Épingler, ranger et renommer depuis l'explorateur, avant d'ouvrir aucune app (le porteur, 21/10) : favoris et dossiers dans la table de GFS
// (`GFS_Rangement`, contrats 6.4), le nom dans la table de l'app, sa seule colonne du nom (6.3, point 2). Dupliquer et supprimer restent à l'app.
// Un geste à la fois, et chacun part de la liste relue après le précédent ; il relit la table avant d'écrire, en un seul lot. Les fenêtres et
// l'accord de la personne viennent du contrôleur.

import { folderMoves, folderName, folderPaths, inside, normalizePath } from './explorer-model.js';
import { TableDeclined } from './rangement.js';
import { normalize } from './search.js';

// Un nom de fichier pris : casse et espaces autour ignorés, la règle de Publipostage+ (`Templates.sameName`) ; un nom de table de même.
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const lastPart = path => path.split('/').pop();
const parentOf = path => path.split('/').slice(0, -1).join('/');
const reasonOf = error => String((error && error.message) || error).slice(0, 120);

// Les colonnes de la table `tableId` d'après les tables internes de Grist (deux petites tables : la table de fichiers peut peser des mégaoctets).
async function columnsOf(doc, tableId) {
  const tables = await doc.fetchTable('_grist_Tables');
  const at = tables.tableId.findIndex(name => sameName(name, tableId));
  if (at < 0) return null;
  const columns = await doc.fetchTable('_grist_Tables_column');
  return { tableId: tables.tableId[at], columns: columns.colId.filter((colId, i) => columns.parentId[i] === tables.id[at]) };
}

export class Filing {
  #opts;
  #queue = Promise.resolve();

  // opts : { port, rangement, t, locale(), identity() -> texte, files() -> [fichier], here() -> le dossier ouvert, specOf(file) -> son entrée `fichiers` du manifeste,
  //          appName(id), writeBlock() -> texte | null, notice(texte), refresh() -> Promise,
  //          windows: { name(opts) -> Promise<texte | null>, folder(opts) -> Promise<chemin | null> } }
  constructor(opts) { this.#opts = opts; }

  // Deux clics rapides sur l'étoile l'allument puis l'éteignent : le second part de la liste relue après le premier.
  togglePin(file) {
    return this.#gesture(() => {
      const now = this.#now(file);
      return this.#write([{ app: now.app, file: now.id, pinned: !now.pinned, folder: now.folder }]);
    });
  }

  moveFile(file) {
    return this.#gesture(async () => {
      const now = this.#now(file);
      const target = await this.#chooseFolder({ title: this.#opts.t('ex.moveTitle', { name: this.#title(now) }), folders: this.#folders(), current: now.folder, base: this.#opts.here() });
      if (target !== null && target !== now.folder) await this.#write([{ app: now.app, file: now.id, pinned: now.pinned, folder: target }]);
    });
  }

  // Un dossier ne va ni en lui-même ni dans un de ses sous-dossiers : ils ne sont pas proposés. Un nouveau dossier naît à côté de lui.
  moveFolder(path) {
    return this.#gesture(async () => {
      const name = lastPart(path);
      const folders = this.#folders().filter(other => !inside(other, path));
      const target = await this.#chooseFolder({ title: this.#opts.t('ex.moveFolderTitle', { name }), folders, current: parentOf(path), base: parentOf(path) });
      if (target !== null && target !== parentOf(path)) await this.#write(folderMoves(this.#opts.files(), path, normalizePath(`${target}/${name}`)));
    });
  }

  // Deux dossiers voisins ne portent pas le même nom (comparé comme la recherche : accents, casse et ponctuation ignorés) : les fondre se fait en déplaçant.
  renameFolder(path) {
    return this.#gesture(async () => {
      const { t, windows } = this.#opts;
      const siblings = this.#folders().filter(other => other !== path && parentOf(other) === parentOf(path)).map(other => normalize(lastPart(other)));
      const refuse = name => (!name ? t('ex.nameEmpty') : (siblings.includes(normalize(name)) ? t('ex.folderTaken') : null));
      const name = await windows.name({ title: t('ex.renameFolderTitle', { name: lastPart(path) }), label: t('ex.folderNameLabel'), value: lastPart(path), confirmLabel: t('ex.rename'),
        clean: folderName, refuse });
      if (name !== null && name !== lastPart(path)) await this.#write(folderMoves(this.#opts.files(), path, normalizePath(`${parentOf(path)}/${name}`)));
    });
  }

  // Le nom seul, dans la colonne du nom que le manifeste désigne (choix du porteur, 21/10) : ni date ni auteur. Une colonne absente n'est jamais écrite ;
  // un nom qu'un autre fichier de la même table porte déjà est refusé.
  rename(file) {
    return this.#gesture(async () => {
      const { t, windows, port, notice, appName } = this.#opts;
      const now = this.#now(file);
      const spec = this.#opts.specOf(now);
      const column = spec && spec.colonnes ? spec.colonnes.nom : null;
      const taken = name => this.#opts.files().some(other => other.key !== now.key && other.app === now.app && other.table === now.table && sameName(other.name, name));
      const refuse = name => (!name ? t('ex.nameEmpty') : (taken(name) ? t('ex.nameTaken', { app: appName(now.app) }) : null));
      const name = await windows.name({ title: t('ex.renameTitle', { name: this.#title(now) }), label: t('ex.nameLabel'), value: now.name, confirmLabel: t('ex.rename'), refuse });
      if (name === null || name === now.name) return;
      try {
        const found = column ? await columnsOf(port.doc, spec.table) : null;
        if (!found || !found.columns.includes(column)) { notice(t('ex.renameNoColumn', { app: appName(now.app) })); return; }
        await port.doc.applyUserActions([['UpdateRecord', found.tableId, now.row, { [column]: name }]]);
      } catch (error) {
        console.warn('GFS : le fichier n’a pas pu être renommé', error);
        notice(t('ex.renameFailed', { reason: reasonOf(error) }));
        return;
      }
      await this.#opts.refresh();
    });
  }

  // Un geste à la fois ; rien ne commence quand le document ne peut rien enregistrer (lecture seule, accès incomplet), la personne le lit.
  #gesture(task) {
    const run = this.#queue.then(() => {
      const blocked = this.#opts.writeBlock();
      if (blocked) { this.#opts.notice(blocked); return undefined; }
      return task();
    });
    this.#queue = run.catch(() => {});
    return run;
  }

  #now(file) { return this.#opts.files().find(item => item.key === file.key) || file; }

  #title(file) { return file.name || this.#opts.t('ex.untitled'); }

  #folders() { return folderPaths(this.#opts.files(), this.#opts.locale()); }

  async #chooseFolder(opts) {
    const target = await this.#opts.windows.folder({ ...opts, clean: folderName });
    return target === null ? null : normalizePath(target);
  }

  // Rien quand la liste est vide (un dossier qui ne change pas) ; l'explorateur se relit après.
  async #write(entries) {
    const { rangement, identity, notice, t } = this.#opts;
    if (!entries.length) return;
    try {
      await rangement.setFiling(identity(), entries);
    } catch (error) {
      if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return; }
      console.warn('GFS : le rangement n’a pas pu être enregistré', error);
      notice(t('ex.filingFailed', { reason: reasonOf(error) }));
      return;
    }
    await this.#opts.refresh();
  }
}
