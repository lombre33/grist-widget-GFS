// Épingler, ranger et renommer depuis l'explorateur, avant d'ouvrir aucune app (le porteur, 21/10) : favoris et dossiers dans la table de GFS (`GFS_Filing`,
// contrats 6.4), le nom dans la table de l'app, sa seule colonne du nom (6.3, point 2). Créer et supprimer un dossier sont d'ici, même vide : il tient alors à
// une ligne d'état de `GFS_Filing` (6.4, point 11), et un dossier que la personne vide ne disparaît pas. Copier et supprimer un fichier ne sont pas d'ici :
// js/files/copying.js et js/files/trash.js (le porteur, 04/11). Un geste à la fois, et chacun part de la liste relue après le précédent ; il relit la table
// avant d'écrire, en un seul lot. Les fenêtres et l'accord de la personne viennent du contrôleur. Chaque geste qui a abouti dépose dans la pile d'annulation
// (`undoStack`, js/files/undo-stack.js) de quoi se défaire : Ctrl+Z remet le rangement ou le nom comme ils étaient (l'état d'avant est relu juste avant
// d'écrire), et ce que Ctrl+Z écrit dépose de quoi le refaire (Ctrl+Y). Chaque geste donne deux phrases : celle de Ctrl+Z (`undo.*`) et celle de Ctrl+Y
// (`redo.*`).
//
// Afficher avant d'écrire (étude du 23/11, choix du porteur : « raccourcir, puis afficher tout de suite ») : quand tout se sait d'avance, le geste s'affiche à
// l'instant (`opts.pending`, js/explorer/pending.js) et Grist s'écrit ensuite, derrière les écritures déjà parties (`#enqueue` : une à la fois, dans l'ordre
// des gestes). Si Grist refuse, le changement s'en va et la phrase du refus est dite ; s'il aboutit, il reste affiché jusqu'à la lecture qui le porte, et le
// geste dépose alors de quoi se défaire (Ctrl+Z attend les écritures en route : `settle`). Le geste reste écrit d'abord, puis affiché, dans quatre cas : la
// table du rangement n'a jamais été vue (la créer demande l'accord de la personne), un espace est touché (seul un propriétaire y écrit : la réponse vient d'une
// lecture), un partage est écrit avec le lot (le numéro d'une ligne d'état est l'identité du partage ; un refus se saurait trop tard), et jamais de droits, de
// partages ni d'envois.

import { folderMoves, folderName, folderPaths, inside, normalizePath, spareMoves, vacatedFolders } from './explorer-model.js';
import { TableDeclined } from '../files/rangement.js';
import { normalize } from '../ui/search.js';
import { UndoStack } from '../files/undo-stack.js';
import { isSpaceItself, isSpacePath, SPACES_ROOT, splitWrites, touchesSpaces, writePlacement } from '../sharing/spaces-filing.js';
import { linkWithin } from '../sharing/space-links.js';

// Les deux phrases d'un geste : celle de Ctrl+Z (`undoKey`, js/i18n/i18n-trash.js) et celle de Ctrl+Y (`redoKey`) ; `redoParams` : ce que dit le rétablissement
// quand il n'est pas celui de l'annulation (le dossier où le fichier retourne).
const said = (undoKey, redoKey, params, redoParams = params) => ({ undo: { key: undoKey, params }, redo: { key: redoKey, params: redoParams } });

// Un nom de fichier pris : casse et espaces autour ignorés, la règle de Publipostage+ (`Templates.sameName`) ; un nom de table de même.
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const lastPart = path => path.split('/').pop();
const parentOf = path => path.split('/').slice(0, -1).join('/');
const reasonOf = error => String((error && error.message) || error).slice(0, 120);
// Un lot sans rien à écrire : ni fichier, ni dossier gardé à ajouter ou à retirer.
const isEmptyWrite = (entries, folders) => !entries.length && !(folders.add || []).length && !(folders.drop || []).length && !(folders.moved || []).length &&
  !(folders.merged || []).length;

// Ce qu'un lot de rangement change à la liste que la personne voit (js/explorer/pending.js) : le ★ et le dossier des fichiers, les dossiers gardés sans fichier
// qui s'ajoutent, s'en vont ou changent de chemin.
const showsOf = (entries, folders) => [
  ...entries.map(entry => ({ op: 'place', app: entry.app, id: entry.file, pinned: entry.pinned, folder: entry.folder })),
  { op: 'dropFolders', paths: [...(folders.drop || []), ...(folders.moved || []).map(([from]) => from), ...(folders.merged || []).map(([from]) => from)] },
  { op: 'addFolders', paths: [...(folders.add || []), ...(folders.moved || []).map(([, to]) => to)] },
];

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
  #writes = Promise.resolve(); // les écritures de rangement, une à la fois : celle qui part attend celles qui sont parties avant
  #inFlight = 0; // les écritures parties ou en route

  // opts : { port, rangement, t, locale(), files() -> [fichier], folders?() -> les dossiers gardés sans fichier, here() -> le dossier ouvert, specOf(file) ->
  //   son entrée `fichiers` du manifeste,
  //          spaces?: { info() -> ce que disent les espaces (js/sharing/spaces-filing.js), owner() -> Promise<vrai si la personne est propriétaire> },
  //          folderShares?: { relocation(de, vers, dossiers), removal(chemins) } (js/sharing/folder-shares.js) : ce que renommer, déplacer ou supprimer un
  //          dossier de « Moi » change à ses partages et à ses liens, dans le même lot,
  //          cleanName?(file)
  //          -> la fonction qui met en forme le nom saisi (un PDF garde son « .pdf »), appName(id), writeBlock() -> texte | null, notice(texte), refresh() ->
  //          Promise (`refresh({ quiet })` : sans « Lecture des fichiers… » quand la liste montre déjà le résultat), pending? (les gestes qui s'affichent avant
  //          d'être écrits : js/explorer/pending.js ; sans lui, chaque geste s'écrit puis s'affiche),
  //          windows: { name(opts) -> Promise<texte | null>, folder(opts) -> Promise<chemin | null> } }
  constructor(opts) {
    this.#opts = opts;
    this.undoStack = new UndoStack({ t: opts.t, notice: opts.notice, settle: () => this.settled() });
  }

  // Rendue quand les écritures de rangement parties sont finies (celles que la liste montre déjà comprises).
  settled() { return this.#writes; }

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

  // Un dossier neuf, même vide (« Nouveau dossier ») : dans le dossier ouvert, ou dans `parent`. Il tient à une ligne d'état de `GFS_Filing` (6.4, point
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
      if (this.#opts.spaces && linkWithin(this.#opts.spaces.info(), path)) { notice(t('slink.fixed')); return false; }
      if (this.#opts.files().some(file => inside(file.folder, path))) { notice(t('ex.folderNotEmpty')); return false; }
      const kept = this.#spare().filter(each => inside(each, path));
      if (!kept.length) { notice(t('ex.folderGone')); return false; }
      // Un dossier partagé emporte ses partages (même lot) : le numéro de sa ligne pourrait sinon être redonné à un dossier neuf ; un dossier qu'un lien montre
      // reste (le lien se retire d'abord).
      const shared = this.#opts.folderShares ? await this.#opts.folderShares.removal(kept) : { extra: [], removed: 0 };
      if (shared.refuse) { notice(t(shared.refuse)); return false; }
      const folders = shared.extra.length ? { drop: kept, extra: shared.extra } : { drop: kept };
      if (!(await this.#write([], folders, said('undo.folder', 'redo.folderDeleted', { name: lastPart(path) })))) return false;
      notice(shared.removed ? t('ex.folderDeletedShared', { name: lastPart(path), n: shared.removed }) : t('ex.folderDeleted', { name: lastPart(path) }));
      return true;
    });
  }

  // Le fichier part à la corbeille (js/files/trash.js) : son dossier, s'il n'a plus de fichier, reste, comme après un déplacement. Sans la table
  // `GFS_Filing`, rien ne s'écrit et rien n'est demandé : on ne crée pas une table pour cela. Peut lever (Grist refuse le lot) : la corbeille le dit à la
  // console seulement, le fichier est à la corbeille.
  async keepFoldersOf(file) {
    const plan = this.#keepPlan(file);
    if (plan) await this.#enqueue(() => this.#keepWrite(plan));
  }

  // La même écriture, pour un geste qui est déjà dans la file des écritures (la corbeille qui s'affiche d'avance, `queued`) : se remettre en file derrière
  // elle-même attendrait pour toujours.
  async keepFoldersNow(file) {
    const plan = this.#keepPlan(file);
    if (plan) await this.#keepWrite(plan);
  }

  // Les dossiers que ce fichier laisserait sans fichier s'il partait à la corbeille : ceux que la liste doit garder d'avance. Aucun sans la table du rangement
  // (la corbeille n'en crée pas, le dossier vide disparaîtrait à la lecture suivante).
  foldersLeftBy(file) {
    const plan = this.#opts.rangement.known === true ? this.#keepPlan(file) : null;
    return plan ? plan.keep : [];
  }

  // Une écriture d'un autre geste (la corbeille, js/files/trash.js) qui prend son rang dans la file : une à la fois, dans l'ordre des gestes, et Ctrl+Z
  // l'attend comme les autres (`settled`). C'est à elle de relire la liste quand elle a fini.
  queued(task) { return this.#enqueue(task); }

  #keepPlan(file) {
    const list = [...this.#opts.files().filter(other => other.key !== file.key), file];
    const keep = vacatedFolders(list, [{ app: file.app, file: file.id, folder: null }], this.#spare());
    if (!keep.length) return null;
    const plan = this.#opts.spaces ? splitWrites([], { add: keep }, [], this.#opts.spaces.info()) :
      { entries: [], folders: { add: keep }, ops: [], markers: { add: [], drop: [] } };
    return { ...plan, keep };
  }

  async #keepWrite(plan) {
    // Le dossier d'un espace que la corbeille vide est gardé aussi, si la personne peut écrire l'espace.
    if (touchesSpaces(plan) && (await this.#opts.spaces.owner())) await writePlacement(this.#opts.port.doc, plan);
    if ((plan.folders.add || []).length) await this.#opts.rangement.setFiling([], { add: plan.folders.add, quiet: true });
  }

  // Range des fichiers neufs (une copie, un PDF importé), sans geste ni annulation : dans un dossier d'espace s'ils y sont placés, à la racine de la personne
  // si elle n'est pas propriétaire (la phrase le dit).
  rangeNew(entries) {
    return this.#enqueue(async () => {
      const { rangement, notice, t, spaces, port } = this.#opts;
      if (!spaces || !entries.some(entry => isSpacePath(normalizePath(entry.folder)))) return rangement.setFiling(entries);
      const plan = splitWrites(entries, {}, [], spaces.info());
      if (!plan.error && (await spaces.owner())) { await writePlacement(port.doc, plan); return rangement.setFiling(plan.entries); }
      notice(t(plan.error || 'ex.spaceOwnersOnly'));
      return rangement.setFiling(entries.map(entry => ({ ...entry, folder: isSpacePath(normalizePath(entry.folder)) ? '' : entry.folder })));
    });
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
      await this.#setName(now, name, this.#nameEntry(now, now.name, name, 'undo'));
    });
  }

  // Écrit le nom `name` du fichier `now` dans la colonne que le manifeste désigne. Rend true quand c'est accepté : écrit puis relu, ou affiché d'avance et
  // écrit derrière (sans la colonne, ou si Grist refuse, il s'en va et la phrase dit pourquoi). `entry` : de quoi défaire, déposé quand le nom est écrit.
  async #setName(now, name, entry) {
    const { pending } = this.#opts;
    const deposit = this.undoStack.later();
    if (!pending) {
      return this.#enqueue(async () => {
        if (!(await this.#storeName(now, name))) return false;
        deposit(entry);
        await this.#opts.refresh();
        return true;
      });
    }
    const change = pending.add({ op: 'rename', key: now.key, name });
    void this.#enqueue(async () => {
      if (await this.#storeName(now, name)) { pending.confirm(change); deposit(entry); } else pending.cancel(change);
      this.#readWhenIdle();
    });
    return true;
  }

  // Le nom seul dans la table de l'app, sa colonne du nom lue d'abord (une colonne absente n'est jamais écrite). Rend true quand c'est écrit ; sinon la phrase
  // dit pourquoi (colonne absente, Grist refuse).
  async #storeName(now, name) {
    const { t, port, notice, appName } = this.#opts;
    const spec = this.#opts.specOf(now);
    const column = spec && spec.colonnes ? spec.colonnes.nom : null;
    try {
      const found = column ? await columnsOf(port.doc, spec.table) : null;
      if (!found || !found.columns.includes(column)) { notice(t('ex.renameNoColumn', { app: appName(now.app) })); return false; }
      await port.doc.applyUserActions([['UpdateRecord', found.tableId, now.row, { [column]: name }]]);
      return true;
    } catch (error) {
      console.warn('GFS : le fichier n’a pas pu être renommé', error);
      notice(t('ex.renameFailed', { reason: reasonOf(error) }));
      return false;
    }
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
      if (!(await this.#setName(now, was, this.#nameEntry(now, renamed, was, kind === 'undo' ? 'redo' : 'undo')))) return null;
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

  // Les dossiers que la personne garde sans fichier (la ligne d'état de `GFS_Filing`).
  #spare() { return (this.#opts.folders && this.#opts.folders()) || []; }

  #folders() { return folderPaths(this.#opts.files(), this.#opts.locale(), this.#spare()); }

  async #chooseFolder(opts) {
    const target = await this.#opts.windows.folder({ ...opts, clean: folderName });
    return target === null ? null : normalizePath(target);
  }

  // Un rangement de fichiers : les dossiers qu'il laisse sans fichier sont gardés dans le même lot (6.4, point 11). `moving` : le dossier qui part avec tout ce
  // qu'il contient (il ne reste pas derrière lui) ;
  // `kept` : { drop, add }, ce que les dossiers gardés sans fichier ont à suivre (js/explorer/explorer-model.js, `spareMoves`).
  #writeMoves(entries, moving = null, kept = {}, undo = null) {
    const vacated = vacatedFolders(this.#opts.files(), entries, this.#spare(), kept).filter(path => moving === null || !inside(path, moving));
    // Les dossiers gardés qui changent de chemin (`moved`) gardent leur ligne d'état, donc leur numéro : ils n'entrent ni dans `add` ni dans `drop` ; ceux qui
    // se fondent dans un dossier qui existe déjà (`merged`) perdent la leur.
    if (kept.moved) {
      const extra = kept.extra && kept.extra.length ? { extra: kept.extra } : {};
      return this.#write(entries, { add: vacated, drop: [], moved: kept.moved, merged: kept.merged, ...extra }, undo);
    }
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
    let spare = this.#spare();
    if (!moves.length && !spareMoves(spare, path, target).add.length) return 'gone';
    // Les partages et les liens du dossier le suivent par le numéro de sa ligne d'état (js/sharing/folder-identity.js) : ceux qui portent encore son chemin
    // passent au numéro (les dossiers qui en portent reçoivent leur ligne d'abord, et suivent le déplacement), ceux d'un dossier fondu dans un autre partent.
    const shared = this.#opts.folderShares ? await this.#opts.folderShares.relocation(path, target, this.#folders()) : null;
    if (shared && shared.refuse) { this.#opts.notice(this.#opts.t(shared.refuse)); return false; }
    if (shared) spare = [...spare, ...shared.spare.filter(each => !spare.includes(each))];
    const kept = spareMoves(spare, path, target);
    // Un dossier gardé qui arrive sur un dossier qui existe déjà s'y fond : sa ligne (et ses partages) ne le suit pas ; les autres gardent leur ligne.
    const outside = new Set([...this.#folders(), ...spare].filter(each => !inside(each, path)));
    const pairs = kept.drop.map((from, at) => [from, kept.add[at]]);
    const done = await this.#writeMoves(moves, path, { ...kept, moved: pairs.filter(([, to]) => !outside.has(to)),
      merged: pairs.filter(([, to]) => outside.has(to)),
      extra: shared ? shared.extra : [] }, said('undo.folder', 'redo.folder', { name: lastPart(path) }, { name: lastPart(target) }));
    if (done && shared && shared.lost) this.#opts.notice(this.#opts.t('ex.folderMerged', { name: lastPart(target), n: shared.lost }));
    return done;
  }

  async #relocateOrSay(path, target) {
    if ((await this.#relocate(path, target)) === 'gone') this.#opts.notice(this.#opts.t('ex.folderGone'));
  }

  // Rien quand il n'y a rien à écrire. `folders` : { add, drop }, les dossiers gardés sans fichier. Rend true quand le rangement est accepté : écrit puis relu,
  // ou affiché d'avance et écrit derrière (Grist le refuse : il s'en va, la phrase est dite) ; false sinon (la personne a refusé la table, Grist a refusé le
  // lot : la phrase est dite).
  // `undo` : { undo, redo } (`said`), les phrases de l'annulation et du rétablissement ; l'état d'avant est relu ici, avant d'écrire, et sert à remettre le
  //   rangement comme il était.
  async #write(entries, folders = {}, undo = null) {
    if (isEmptyWrite(entries, folders)) return false;
    const before = undo ? this.#before(entries, folders) : null;
    const plan = this.#opts.spaces ? splitWrites(entries, folders, this.#opts.files(), this.#opts.spaces.info()) : null;
    if (plan && plan.error) { this.#opts.notice(this.#opts.t(plan.error)); return false; }
    // `deposit` : où ira de quoi se défaire quand le lot sera écrit (la pile aura peut-être changé de mode d'ici là)
    const lot = { entries, folders, plan, deposit: this.undoStack.later(), again: before && { run: () => this.#replayWrite(before, undo) } };
    if (!this.#instant(plan, folders)) return this.#enqueue(() => this.#writeNow(lot));
    const change = this.#opts.pending.add(showsOf(entries, folders));
    void this.#enqueue(() => this.#writeLater(lot, change));
    return true;
  }

  // Le lot peut-il s'afficher avant d'être écrit ? Voir l'en-tête : il faut que tout se sache d'avance.
  #instant(plan, folders) {
    const { pending, rangement } = this.#opts;
    return Boolean(pending) && rangement.known === true && !(plan && touchesSpaces(plan)) && !(folders.extra || []).length;
  }

  // Écrit puis relit : le geste qui ne peut pas s'afficher d'avance.
  async #writeNow({ entries, folders, plan, deposit, again }) {
    const refusal = await this.#refusalOf(plan);
    if (refusal) { this.#opts.notice(this.#opts.t(refusal)); return false; }
    if (!(await this.#store(entries, folders, plan))) return false;
    if (again) deposit(again);
    await this.#opts.refresh();
    return true;
  }

  // Écrit ce qui s'affiche déjà : le changement est confirmé (il reste affiché jusqu'à la lecture qui le porte) ou retiré (Grist a refusé).
  async #writeLater({ entries, folders, plan, deposit, again }, change) {
    const { pending } = this.#opts;
    if (await this.#store(entries, folders, plan)) {
      pending.confirm(change);
      if (again) deposit(again);
    } else pending.cancel(change);
    this.#readWhenIdle();
  }

  // Une écriture à la fois, dans l'ordre des gestes, qu'elles s'affichent d'avance ou non.
  #enqueue(task) {
    this.#inFlight += 1;
    const run = this.#writes.then(task).finally(() => { this.#inFlight -= 1; });
    this.#writes = run.catch(() => {});
    return run;
  }

  // La liste se relit quand la dernière écriture partie est finie (sans « Lecture des fichiers… » : elle montre déjà le résultat) : elle porte alors les
  // changements confirmés, qui cessent d'être posés par-dessus.
  #readWhenIdle() {
    if (this.#inFlight === 1) void this.#opts.refresh({ quiet: true });
  }

  // Seul un propriétaire du document touche à un espace : la clé de la phrase du refus, ou null.
  async #refusalOf(plan) {
    return plan && touchesSpaces(plan) && !(await this.#opts.spaces.owner()) ? 'ex.spaceOwnersOnly' : null;
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
    // Un dossier gardé qui a changé de chemin y retourne (sa ligne, et son numéro, avec lui) ; arrivé sur un dossier qui existait déjà, il n'a plus de ligne :
    // l'annulation lui en redonne une.
    const moved = (folders.moved || []).filter(([from]) => spare.includes(from)).map(([from, to]) => [to, from]);
    const fused = (folders.merged || []).filter(([from]) => spare.includes(from)).map(([from]) => from);
    return {
      entries: entries.map(entry => {
        const was = live.find(item => item.app === entry.app && item.id === String(entry.file));
        return { app: entry.app, file: entry.file, pinned: Boolean(was && was.pinned), folder: was ? was.folder || '' : '' };
      }),
      add: [...dropped.filter(path => spare.includes(path)), ...fused],
      drop: (folders.add || []).filter(path => !spare.includes(path) && !dropped.includes(path)),
      moved,
    };
  }

  // Défait un lot (Ctrl+Z) ou le refait (Ctrl+Y) : le rangement d'avant est réécrit, au rang des autres gestes (lecture seule : refusé et dit), et dépose à son
  // tour le geste inverse, avec les deux phrases échangées. Rend la phrase de ce qui vient de se faire (`phrases.undo` : l'entrée porte celle qu'elle dit quand
  // on la joue).
  #replayWrite(before, phrases) {
    return this.#gesture(async () => ((await this.#write(before.entries, { add: before.add, drop: before.drop, moved: before.moved },
      { undo: phrases.redo, redo: phrases.undo })) ?
      this.#opts.t(phrases.undo.key, phrases.undo.params) : null));
  }
}
