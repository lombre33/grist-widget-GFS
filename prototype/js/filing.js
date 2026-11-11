// Épingler, ranger et renommer depuis l'explorateur, avant d'ouvrir aucune app (le porteur, 21/10) : favoris et dossiers dans la table de GFS (`GFS_Rangement`,
// contrats 6.4), le nom dans la table de l'app, sa seule colonne du nom (6.3, point 2). Créer et supprimer un dossier sont d'ici, même vide : il tient alors à
// une ligne d'état de `GFS_Rangement` (6.4, point 11), et un dossier que la personne vide ne disparaît pas. Copier et supprimer un fichier ne sont pas d'ici :
// js/copying.js et js/trash.js (le porteur, 04/11). Un geste à la fois, et chacun part de la liste relue après le précédent ; il relit la table avant d'écrire,
// en un seul lot. Les fenêtres et l'accord de la personne viennent du contrôleur. Chaque geste qui a abouti dépose dans la pile d'annulation (`undoStack`,
// js/undo-stack.js) de quoi se défaire : Ctrl+Z remet le rangement ou le nom comme ils étaient (l'état d'avant est relu juste avant d'écrire), et ce que Ctrl+Z
// écrit dépose de quoi le refaire (Ctrl+Y). Chaque geste donne deux phrases : celle de Ctrl+Z (`undo.*`) et celle de Ctrl+Y (`redo.*`).

import { folderMoves, folderName, folderPaths, inside, normalizePath, spareMoves, vacatedFolders } from './explorer-model.js';
import { TableDeclined } from './rangement.js';
import { normalize } from './search.js';
import { UndoStack } from './undo-stack.js';
import { isSpaceItself, isSpacePath, SPACES_ROOT, splitWrites, touchesSpaces, writePlacement } from './spaces-filing.js';

// Les deux phrases d'un geste : celle de Ctrl+Z (`undoKey`, js/i18n-trash.js) et celle de Ctrl+Y (`redoKey`) ; `redoParams` : ce que dit le rétablissement
// quand il n'est pas celui de l'annulation (le dossier où le fichier retourne).
const said = (undoKey, redoKey, params, redoParams = params) => ({ undo: { key: undoKey, params }, redo: { key: redoKey, params: redoParams } });

// Un nom de fichier pris : casse et espaces autour ignorés, la règle de Publipostage+ (`Templates.sameName`) ; un nom de table de même.
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const lastPart = path => path.split('/').pop();
const parentOf = path => path.split('/').slice(0, -1).join('/');
const reasonOf = error => String((error && error.message) || error).slice(0, 120);
// Un lot sans rien à écrire : ni fichier, ni dossier gardé à ajouter ou à retirer.
const isEmptyWrite = (entries, folders) => !entries.length && !(folders.add || []).length && !(folders.drop || []).length;

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

  // opts : { port, rangement, t, locale(), files() -> [fichier], folders?() -> les dossiers gardés sans fichier, here() -> le dossier ouvert, specOf(file) ->
  //   son entrée `fichiers` du manifeste,
  //          spaces?: { info() -> ce que disent les espaces (js/spaces-filing.js), owner() -> Promise<vrai si la personne est propriétaire> }, cleanName?(file)
  //          -> la fonction qui met en forme le nom saisi (un PDF garde son « .pdf »), appName(id), writeBlock() -> texte | null, notice(texte), refresh() ->
  //          Promise,
  //          windows: { name(opts) -> Promise<texte | null>, folder(opts) -> Promise<chemin | null> } }
  constructor(opts) {
    this.#opts = opts;
    this.undoStack = new UndoStack({ t: opts.t, notice: opts.notice });
  }

  // Deux clics rapides sur l'étoile l'allument puis l'éteignent : le second part de la liste relue après le premier.
  togglePin(file) {
    return this.#gesture(() => {
      const now = this.#now(file);
      return this.#write([{ app: now.app, file: now.id, pinned: !now.pinned, folder: now.folder }], {},
        said(now.pinned ? 'undo.pinned' : 'undo.unpinned', now.pinned ? 'redo.unpinned' : 'redo.pinned', { name: this.#title(now) }));
    });
  }

  moveFile(file) {
    return this.#gesture(async () => {
      const now = this.#now(file);
      const target = await this.#chooseFolder({ title: this.#opts.t('ex.moveTitle', { name: this.#title(now) }), folders: this.#folders(), current: now.folder,
        base: this.#opts.here() });
      if (target !== null && target !== now.folder) await this.#writeMoves([{ app: now.app, file: now.id, pinned: now.pinned, folder: target }], null, {},
        this.#movedBack(now, target));
    });
  }

  // Couper puis coller (Ctrl+X, Ctrl+V) : le fichier va dans le dossier `folder` (le dossier ouvert), sans fenêtre. Rend 'moved', 'same' (il y est déjà : rien
  // n'est écrit), ou rien quand le document ne peut rien enregistrer ou que l'écriture a échoué (la phrase est dite).
  moveFileTo(file, folder) {
    return this.#gesture(async () => {
      const now = this.#now(file);
      if (now.folder === folder) return 'same';
      return (await this.#writeMoves([{ app: now.app, file: now.id, pinned: now.pinned, folder }], null, {}, this.#movedBack(now, folder))) ? 'moved' :
        undefined;
    });
  }

  // Le même geste pour un dossier : il va dans `folder`, sous-dossiers compris. Rend 'moved', 'same' (il y est déjà), 'inside' (un dossier ne va pas dans
  // lui-même ni dans un de ses sous-dossiers), 'gone' (plus rien ne le nomme : ni fichier, ni ligne d'état), ou rien quand rien ne s'écrit.
  moveFolderTo(path, folder) {
    return this.#gesture(async () => {
      const target = normalizePath(`${folder}/${lastPart(path)}`);
      if (target === path) return 'same';
      if (inside(target, path)) return 'inside';
      if (this.#fixed(path, target)) return undefined;
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
      if (target !== null && target !== parentOf(path) && !this.#fixed(path, normalizePath(`${target}/${name}`))) await this.#relocateOrSay(path,
        normalizePath(`${target}/${name}`));
    });
  }

  // Deux dossiers voisins ne portent pas le même nom (comparé comme la recherche : accents, casse et ponctuation ignorés) : les fondre se fait en déplaçant.
  renameFolder(path) {
    return this.#gesture(async () => {
      const { t, windows } = this.#opts;
      const siblings = this.#folders().filter(other => other !== path && parentOf(other) === parentOf(path)).map(other => normalize(lastPart(other)));
      const refuse = name => (!name ? t('ex.nameEmpty') : (siblings.includes(normalize(name)) ? t('ex.folderTaken') : null));
      const name = await windows.name({ title: t('ex.renameFolderTitle', { name: lastPart(path) }), label: t('ex.folderNameLabel'), value: lastPart(path),
        confirmLabel: t('ex.rename'),
        clean: folderName, refuse });
      if (name !== null && name !== lastPart(path) && !this.#fixed(path, normalizePath(`${parentOf(path)}/${name}`))) await this.#relocateOrSay(path,
        normalizePath(`${parentOf(path)}/${name}`));
    });
  }

  // Un dossier neuf, même vide (« Nouveau dossier ») : dans le dossier ouvert, ou dans `parent`. Il tient à une ligne d'état de `GFS_Rangement` (6.4, point
  // 11). Deux dossiers voisins ne portent pas le même nom (comme pour renommer). Rend son chemin, ou rien quand la personne renonce ou que rien ne s'écrit.
  newFolder(parent = this.#opts.here()) {
    return this.#gesture(async () => {
      const { t, windows } = this.#opts;
      if (parent === SPACES_ROOT) { this.#opts.notice(t('ex.spaceCreateElsewhere')); return undefined; }
      const siblings = this.#folders().filter(other => parentOf(other) === parent).map(other => normalize(lastPart(other)));
      const refuse = name => (!name ? t('ex.nameEmpty') : (siblings.includes(normalize(name)) ? t('ex.folderTaken') : null));
      const name = await windows.name({ title: t('ex.newFolderTitle', { folder: parent ? parent.split('/').join(' / ') : t('ex.me') }),
        label: t('ex.folderNameLabel'), value: '', confirmLabel: t('ex.newFolderConfirm'), clean: folderName, refuse });
      if (name === null) return undefined;
      const path = normalizePath(`${parent}/${name}`);
      if (parent === '' && normalize(name) === normalize(SPACES_ROOT)) { this.#opts.notice(t('ex.spaceRootTaken')); return undefined; }
      return (await this.#write([], { add: [path] }, said('undo.folderCreated', 'redo.folderCreated', { name: lastPart(path) }))) ? path : undefined;
    });
  }

  // Supprime un dossier qui n'a plus aucun fichier, ni dans ses sous-dossiers : il ne reste que des lignes d'état, celles du dossier et de ses sous-dossiers
  // vides, qui sont retirées. Rien n'est perdu : pas de question. Rend true quand il est supprimé, false sinon (la phrase dit pourquoi : un fichier est dedans,
  // ou il n'existe plus).
  deleteFolder(path) {
    return this.#gesture(async () => {
      const { t, notice } = this.#opts;
      if (isSpaceItself(path)) { notice(t('ex.spaceFixed')); return false; }
      if (this.#opts.files().some(file => inside(file.folder, path))) { notice(t('ex.folderNotEmpty')); return false; }
      const kept = this.#spare().filter(each => inside(each, path));
      if (!kept.length) { notice(t('ex.folderGone')); return false; }
      if (!(await this.#write([], { drop: kept }, said('undo.folder', 'redo.folderDeleted', { name: lastPart(path) })))) return false;
      notice(t('ex.folderDeleted', { name: lastPart(path) }));
      return true;
    });
  }

  // Le fichier part à la corbeille (js/trash.js) : son dossier, s'il n'a plus de fichier, reste, comme après un déplacement. Sans la table `GFS_Rangement`,
  // rien ne s'écrit et rien n'est demandé : on ne crée pas une table pour cela. Peut lever (Grist refuse le lot) : la corbeille le dit à la console seulement,
  // le fichier est à la corbeille.
  async keepFoldersOf(file) {
    const list = [...this.#opts.files().filter(other => other.key !== file.key), file];
    const keep = vacatedFolders(list, [{ app: file.app, file: file.id, folder: null }], this.#spare());
    if (!keep.length) return;
    const plan = this.#opts.spaces ? splitWrites([], { add: keep }, [], this.#opts.spaces.info()) :
      { entries: [], folders: { add: keep }, ops: [], markers: { add: [], drop: [] } };
    // Le dossier d'un espace que la corbeille vide est gardé aussi, si la personne peut écrire l'espace.
    if (touchesSpaces(plan) && (await this.#opts.spaces.owner())) await writePlacement(this.#opts.port.doc, plan);
    if ((plan.folders.add || []).length) await this.#opts.rangement.setFiling([], { add: plan.folders.add, quiet: true });
  }

  // Range des fichiers neufs (une copie, un PDF importé), sans geste ni annulation : dans un dossier d'espace s'ils y sont placés, à la racine de la personne
  // si elle n'est pas propriétaire (la phrase le dit).
  async rangeNew(entries) {
    const { rangement, notice, t, spaces, port } = this.#opts;
    if (!spaces || !entries.some(entry => isSpacePath(normalizePath(entry.folder)))) return rangement.setFiling(entries);
    const plan = splitWrites(entries, {}, [], spaces.info());
    if (!plan.error && (await spaces.owner())) { await writePlacement(port.doc, plan); return rangement.setFiling(plan.entries); }
    notice(t(plan.error || 'ex.spaceOwnersOnly'));
    return rangement.setFiling(entries.map(entry => ({ ...entry, folder: isSpacePath(normalizePath(entry.folder)) ? '' : entry.folder })));
  }

  // Un dossier d'espace ne se renomme ni ne se déplace (ses partages portent son chemin : ils ne le suivraient pas) ; ni « Espaces » ni un espace ne s'écrivent
  // d'ici ; rien ne se range sous « Espaces » sans un espace. Rend true (la phrase est dite) quand le geste est refusé.
  #fixed(path, target) {
    const { notice, t } = this.#opts;
    if (!isSpacePath(path) && !isSpacePath(target)) return false;
    if (isSpacePath(path)) { notice(t(isSpaceItself(path) ? 'ex.spaceFixed' : 'ex.spaceFolderFixed')); return true; }
    if (isSpaceItself(target)) { notice(t('ex.spaceFixed')); return true; }
    return false;
  }

  // Le nom seul, dans la colonne du nom que le manifeste désigne (choix du porteur, 21/10) : ni date ni auteur. Une colonne absente n'est jamais écrite ;
  // un nom qu'un autre fichier de la même table porte déjà est refusé.
  rename(file) {
    return this.#gesture(async () => {
      const { t, windows, appName } = this.#opts;
      const now = this.#now(file);
      const taken = name => this.#opts.files().some(other => other.key !== now.key && other.app === now.app && other.table === now.table &&
        sameName(other.name, name));
      const refuse = name => (!name ? t('ex.nameEmpty') : (taken(name) ? t('ex.nameTaken', { app: appName(now.app) }) : null));
      const clean = this.#opts.cleanName ? this.#opts.cleanName(now) : undefined;
      const name = await windows.name({ title: t('ex.renameTitle', { name: this.#title(now) }), label: t('ex.nameLabel'), value: now.name,
        confirmLabel: t('ex.rename'), clean, refuse });
      if (name === null || name === now.name) return;
      if (await this.#setName(now, name)) this.undoStack.push(this.#nameEntry(now, now.name, name, 'undo'));
    });
  }

  // Écrit le nom `name` du fichier `now` dans la colonne que le manifeste désigne, puis relit la liste. Rend true quand c'est écrit ; sinon la phrase dit
  // pourquoi (colonne absente, Grist refuse).
  async #setName(now, name) {
    const { t, port, notice, appName } = this.#opts;
    const spec = this.#opts.specOf(now);
    const column = spec && spec.colonnes ? spec.colonnes.nom : null;
    try {
      const found = column ? await columnsOf(port.doc, spec.table) : null;
      if (!found || !found.columns.includes(column)) { notice(t('ex.renameNoColumn', { app: appName(now.app) })); return false; }
      await port.doc.applyUserActions([['UpdateRecord', found.tableId, now.row, { [column]: name }]]);
    } catch (error) {
      console.warn('GFS : le fichier n’a pas pu être renommé', error);
      notice(t('ex.renameFailed', { reason: reasonOf(error) }));
      return false;
    }
    await this.#opts.refresh();
    return true;
  }

  // De quoi remettre le nom `was` à `file`, qui porte aujourd'hui `renamed` : `kind` 'undo' (Ctrl+Z défait le renommage) ou 'redo' (Ctrl+Y le refait ; `was`
  // est alors le nom que le renommage avait donné).
  #nameEntry(file, was, renamed, kind) { return { run: () => this.#renameBack(file, was, renamed, kind) }; }

  // Le fichier reprend le nom `was`, s'il porte encore celui que le geste précédent lui avait donné (`renamed`) et qu'aucun autre fichier de l'app n'a pris
  // `was` entre-temps ; le geste inverse est déposé (dans la pile du rétablissement quand c'est une annulation, et inversement).
  #renameBack(file, was, renamed, kind) {
    return this.#gesture(async () => {
      const { t, appName } = this.#opts;
      const now = this.#opts.files().find(item => item.key === file.key);
      if (!now) return t(`${kind}.gone`, { name: renamed });
      if (now.name !== renamed) return t(`${kind}.changed`, { name: renamed });
      if (this.#opts.files().some(other => other.key !== now.key && other.app === now.app && other.table === now.table && sameName(other.name, was))) return t(
        'ex.nameTaken', { app: appName(now.app) });
      if (!(await this.#setName(now, was))) return null;
      this.undoStack.push(this.#nameEntry(now, renamed, was, kind === 'undo' ? 'redo' : 'undo'));
      return t(`${kind}.renamed`, { name: was });
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

  // Un rangement de fichiers : les dossiers qu'il laisse sans fichier sont gardés dans le même lot (6.4, point 11). `moving` : le dossier qui part avec tout ce
  // qu'il contient (il ne reste pas derrière lui) ;
  // `kept` : { drop, add }, ce que les dossiers gardés sans fichier ont à suivre (js/explorer-model.js, `spareMoves`).
  #writeMoves(entries, moving = null, kept = {}, undo = null) {
    const vacated = vacatedFolders(this.#opts.files(), entries, this.#spare(), kept).filter(path => moving === null || !inside(path, moving));
    return this.#write(entries, { add: [...(kept.add || []), ...vacated], drop: kept.drop }, undo);
  }

  // Ce que disent l'annulation et le rétablissement d'un fichier déplacé vers `to` : il revient dans le dossier d'où il vient, ou retourne dans `to` (« Moi »
  // pour la racine).
  #movedBack(now, to) {
    const me = this.#opts.t('ex.me');
    return said('undo.moved', 'redo.moved', { name: this.#title(now), folder: now.folder || me }, { name: this.#title(now), folder: to || me });
  }

  // Le dossier `path` devient `target`, sous-dossiers compris : ses fichiers changent de dossier et les dossiers qu'on garde dedans sans fichier le suivent,
  // dans le même lot. Rend true quand c'est écrit, 'gone' quand plus rien ne le nomme (ni fichier, ni ligne d'état), false quand rien ne s'écrit (la phrase est
  // dite).
  async #relocate(path, target) {
    const moves = folderMoves(this.#opts.files(), path, target);
    const kept = spareMoves(this.#spare(), path, target);
    if (!moves.length && !kept.add.length) return 'gone';
    return this.#writeMoves(moves, path, kept, said('undo.folder', 'redo.folder', { name: lastPart(path) }, { name: lastPart(target) }));
  }

  async #relocateOrSay(path, target) {
    if ((await this.#relocate(path, target)) === 'gone') this.#opts.notice(this.#opts.t('ex.folderGone'));
  }

  // Rien quand il n'y a rien à écrire ; l'explorateur se relit après. `folders` : { add, drop }, les dossiers gardés sans fichier. Rend true quand le rangement
  // est écrit, false sinon (la personne a refusé la table, Grist a refusé le lot : la phrase est dite).
  // `undo` : { undo, redo } (`said`), les phrases de l'annulation et du rétablissement ; l'état d'avant est relu ici, avant d'écrire, et sert à remettre le
  //   rangement comme il était.
  async #write(entries, folders = {}, undo = null) {
    if (isEmptyWrite(entries, folders)) return false;
    const before = undo ? this.#before(entries, folders) : null;
    const plan = this.#opts.spaces ? splitWrites(entries, folders, this.#opts.files(), this.#opts.spaces.info()) : null;
    const refusal = await this.#refusalOf(plan);
    if (refusal) { this.#opts.notice(this.#opts.t(refusal)); return false; }
    if (!(await this.#store(entries, folders, plan))) return false;
    if (before) this.undoStack.push({ run: () => this.#replayWrite(before, undo) });
    await this.#opts.refresh();
    return true;
  }

  // Pourquoi le lot ne s'écrit pas (la clé de sa phrase), ou null : les espaces le refusent, ou seul un propriétaire du document touche à un espace.
  async #refusalOf(plan) {
    if (!plan) return null;
    if (plan.error) return plan.error;
    return touchesSpaces(plan) && !(await this.#opts.spaces.owner()) ? 'ex.spaceOwnersOnly' : null;
  }

  // Écrit le placement dans les espaces et le rangement. Rend true quand c'est écrit, false sinon (la personne a refusé la table, Grist a refusé le lot : la
  // phrase est dite).
  async #store(entries, folders, plan) {
    const { rangement, notice, t } = this.#opts;
    try {
      if (plan && touchesSpaces(plan)) await writePlacement(this.#opts.port.doc, plan);
      if (!plan) await rangement.setFiling(entries, folders);
      else if (!isEmptyWrite(plan.entries, plan.folders)) await rangement.setFiling(plan.entries, plan.folders);
      return true;
    } catch (error) {
      if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return false; }
      console.warn('GFS : le rangement n’a pas pu être enregistré', error);
      notice(t('ex.filingFailed', { reason: reasonOf(error) }));
      return false;
    }
  }

  // L'état d'avant un lot de rangement : ce que chaque fichier touché avait (favori, dossier), les dossiers gardés que le lot retire (à remettre) et ceux qu'il
  // crée (à retirer).
  #before(entries, folders) {
    const live = this.#opts.files();
    const spare = this.#spare();
    const dropped = folders.drop || [];
    return {
      entries: entries.map(entry => {
        const was = live.find(item => item.app === entry.app && item.id === String(entry.file));
        return { app: entry.app, file: entry.file, pinned: Boolean(was && was.pinned), folder: was ? was.folder || '' : '' };
      }),
      add: dropped.filter(path => spare.includes(path)),
      drop: (folders.add || []).filter(path => !spare.includes(path) && !dropped.includes(path)),
    };
  }

  // Défait un lot (Ctrl+Z) ou le refait (Ctrl+Y) : le rangement d'avant est réécrit, au rang des autres gestes (lecture seule : refusé et dit), et dépose à son
  // tour le geste inverse, avec les deux phrases échangées. Rend la phrase de ce qui vient de se faire (`phrases.undo` : l'entrée porte celle qu'elle dit quand
  // on la joue).
  #replayWrite(before, phrases) {
    return this.#gesture(async () => ((await this.#write(before.entries, { add: before.add, drop: before.drop }, { undo: phrases.redo, redo: phrases.undo })) ?
      this.#opts.t(phrases.undo.key, phrases.undo.params) : null));
  }
}
