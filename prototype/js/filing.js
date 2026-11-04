// Épingler, ranger et renommer depuis l'explorateur, avant d'ouvrir aucune app (le porteur, 21/10) : favoris et dossiers dans la table de GFS
// (`GFS_Rangement`, contrats 6.4), le nom dans la table de l'app, sa seule colonne du nom (6.3, point 2). Créer et supprimer un dossier sont d'ici, même vide : il tient alors à une ligne d'état de
// `GFS_Rangement` (6.4, point 11), et un dossier que la personne vide ne disparaît pas. Copier et supprimer un fichier ne sont pas d'ici : js/copying.js et js/trash.js (le porteur, 04/11).
// Un geste à la fois, et chacun part de la liste relue après le précédent ; il relit la table avant d'écrire, en un seul lot. Les fenêtres et
// l'accord de la personne viennent du contrôleur.

import { folderMoves, folderName, folderPaths, inside, normalizePath, spareMoves, vacatedFolders } from './explorer-model.js';
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

  // opts : { port, rangement, t, locale(), files() -> [fichier], folders?() -> les dossiers gardés sans fichier, here() -> le dossier ouvert, specOf(file) -> son entrée `fichiers` du manifeste,
  //          cleanName?(file) -> la fonction qui met en forme le nom saisi (un PDF garde son « .pdf »), appName(id), writeBlock() -> texte | null, notice(texte), refresh() -> Promise,
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
      if (target !== null && target !== now.folder) await this.#writeMoves([{ app: now.app, file: now.id, pinned: now.pinned, folder: target }]);
    });
  }

  // Couper puis coller (Ctrl+X, Ctrl+V) : le fichier va dans le dossier `folder` (le dossier ouvert), sans fenêtre. Rend 'moved', 'same' (il y est déjà : rien n'est écrit), ou rien quand le document ne
  // peut rien enregistrer ou que l'écriture a échoué (la phrase est dite).
  moveFileTo(file, folder) {
    return this.#gesture(async () => {
      const now = this.#now(file);
      if (now.folder === folder) return 'same';
      return (await this.#writeMoves([{ app: now.app, file: now.id, pinned: now.pinned, folder }])) ? 'moved' : undefined;
    });
  }

  // Le même geste pour un dossier : il va dans `folder`, sous-dossiers compris. Rend 'moved', 'same' (il y est déjà), 'inside' (un dossier ne va pas dans lui-même ni dans un de ses sous-dossiers),
  // 'gone' (plus rien ne le nomme : ni fichier, ni ligne d'état), ou rien quand rien ne s'écrit.
  moveFolderTo(path, folder) {
    return this.#gesture(async () => {
      const target = normalizePath(`${folder}/${lastPart(path)}`);
      if (target === path) return 'same';
      if (inside(target, path)) return 'inside';
      const done = await this.#relocate(path, target);
      return done === true ? 'moved' : (done || undefined);
    });
  }

  // Un dossier ne va ni en lui-même ni dans un de ses sous-dossiers : ils ne sont pas proposés. Un nouveau dossier naît à côté de lui.
  moveFolder(path) {
    return this.#gesture(async () => {
      const name = lastPart(path);
      const folders = this.#folders().filter(other => !inside(other, path));
      const target = await this.#chooseFolder({ title: this.#opts.t('ex.moveFolderTitle', { name }), folders, current: parentOf(path), base: parentOf(path) });
      if (target !== null && target !== parentOf(path)) await this.#relocateOrSay(path, normalizePath(`${target}/${name}`));
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
      if (name !== null && name !== lastPart(path)) await this.#relocateOrSay(path, normalizePath(`${parentOf(path)}/${name}`));
    });
  }

  // Un dossier neuf, même vide (« Nouveau dossier ») : dans le dossier ouvert, ou dans `parent`. Il tient à une ligne d'état de `GFS_Rangement` (6.4, point 11). Deux dossiers voisins ne portent pas le même nom
  // (comme pour renommer). Rend son chemin, ou rien quand la personne renonce ou que rien ne s'écrit.
  newFolder(parent = this.#opts.here()) {
    return this.#gesture(async () => {
      const { t, windows } = this.#opts;
      const siblings = this.#folders().filter(other => parentOf(other) === parent).map(other => normalize(lastPart(other)));
      const refuse = name => (!name ? t('ex.nameEmpty') : (siblings.includes(normalize(name)) ? t('ex.folderTaken') : null));
      const name = await windows.name({ title: t('ex.newFolderTitle', { folder: parent ? parent.split('/').join(' / ') : t('ex.me') }), label: t('ex.folderNameLabel'), value: '', confirmLabel: t('ex.newFolderConfirm'), clean: folderName, refuse });
      if (name === null) return undefined;
      const path = normalizePath(`${parent}/${name}`);
      return (await this.#write([], { add: [path] })) ? path : undefined;
    });
  }

  // Supprime un dossier qui n'a plus aucun fichier, ni dans ses sous-dossiers : il ne reste que des lignes d'état, celles du dossier et de ses sous-dossiers vides, qui sont retirées. Rien n'est perdu : pas de question.
  // Rend true quand il est supprimé, false sinon (la phrase dit pourquoi : un fichier est dedans, ou il n'existe plus).
  deleteFolder(path) {
    return this.#gesture(async () => {
      const { t, notice } = this.#opts;
      if (this.#opts.files().some(file => inside(file.folder, path))) { notice(t('ex.folderNotEmpty')); return false; }
      const kept = this.#spare().filter(each => inside(each, path));
      if (!kept.length) { notice(t('ex.folderGone')); return false; }
      if (!(await this.#write([], { drop: kept }))) return false;
      notice(t('ex.folderDeleted', { name: lastPart(path) }));
      return true;
    });
  }

  // Le fichier part à la corbeille (js/trash.js) : son dossier, s'il n'a plus de fichier, reste, comme après un déplacement. Sans la table `GFS_Rangement`, rien ne s'écrit et rien n'est demandé : on ne crée pas
  // une table pour cela. Peut lever (Grist refuse le lot) : la corbeille le dit à la console seulement, le fichier est à la corbeille.
  async keepFoldersOf(file) {
    const list = [...this.#opts.files().filter(other => other.key !== file.key), file];
    const keep = vacatedFolders(list, [{ app: file.app, file: file.id, folder: null }], this.#spare());
    if (keep.length) await this.#opts.rangement.setFiling([], { add: keep, quiet: true });
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
      const clean = this.#opts.cleanName ? this.#opts.cleanName(now) : undefined;
      const name = await windows.name({ title: t('ex.renameTitle', { name: this.#title(now) }), label: t('ex.nameLabel'), value: now.name, confirmLabel: t('ex.rename'), clean, refuse });
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

  // Les dossiers que la personne garde sans fichier (la ligne d'état de `GFS_Rangement`).
  #spare() { return (this.#opts.folders && this.#opts.folders()) || []; }

  #folders() { return folderPaths(this.#opts.files(), this.#opts.locale(), this.#spare()); }

  async #chooseFolder(opts) {
    const target = await this.#opts.windows.folder({ ...opts, clean: folderName });
    return target === null ? null : normalizePath(target);
  }

  // Un rangement de fichiers : les dossiers qu'il laisse sans fichier sont gardés dans le même lot (6.4, point 11). `moving` : le dossier qui part avec tout ce qu'il contient (il ne reste pas derrière lui) ;
  // `kept` : { drop, add }, ce que les dossiers gardés sans fichier ont à suivre (js/explorer-model.js, `spareMoves`).
  #writeMoves(entries, moving = null, kept = {}) {
    const vacated = vacatedFolders(this.#opts.files(), entries, this.#spare(), kept).filter(path => moving === null || !inside(path, moving));
    return this.#write(entries, { add: [...(kept.add || []), ...vacated], drop: kept.drop });
  }

  // Le dossier `path` devient `target`, sous-dossiers compris : ses fichiers changent de dossier et les dossiers qu'on garde dedans sans fichier le suivent, dans le même lot. Rend true quand c'est écrit,
  // 'gone' quand plus rien ne le nomme (ni fichier, ni ligne d'état), false quand rien ne s'écrit (la phrase est dite).
  async #relocate(path, target) {
    const moves = folderMoves(this.#opts.files(), path, target);
    const kept = spareMoves(this.#spare(), path, target);
    if (!moves.length && !kept.add.length) return 'gone';
    return this.#writeMoves(moves, path, kept);
  }

  async #relocateOrSay(path, target) {
    if ((await this.#relocate(path, target)) === 'gone') this.#opts.notice(this.#opts.t('ex.folderGone'));
  }

  // Rien quand il n'y a rien à écrire ; l'explorateur se relit après. `folders` : { add, drop }, les dossiers gardés sans fichier. Rend true quand le rangement est écrit, false sinon (la personne a refusé la table,
  // Grist a refusé le lot : la phrase est dite).
  async #write(entries, folders = {}) {
    const { rangement, notice, t } = this.#opts;
    if (!entries.length && !(folders.add || []).length && !(folders.drop || []).length) return false;
    try {
      await rangement.setFiling(entries, folders);
    } catch (error) {
      if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return false; }
      console.warn('GFS : le rangement n’a pas pu être enregistré', error);
      notice(t('ex.filingFailed', { reason: reasonOf(error) }));
      return false;
    }
    await this.#opts.refresh();
    return true;
  }
}
