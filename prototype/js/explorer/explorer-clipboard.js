// Le presse-papiers de l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, au clavier aussi) : Ctrl+C copie un fichier, Ctrl+X coupe
// un fichier ou un dossier, Ctrl+V colle dans le dossier ouvert, et Ctrl+D (12/11 : pour qui duplique sans passer par copier-coller) fait la copie d'un
// geste, à côté du fichier. Copier-coller fait une copie du fichier dans ce dossier (js/files/copying.js) ; couper-coller le déplace
// (js/explorer/filing.js), sans rien dupliquer ; l'un et l'autre se font dans les dossiers de la personne (« Moi » et ses sous-dossiers), pas dans
// Récents, Favoris ou la corbeille. Ce n'est pas le presse-papiers du système : rien n'y est écrit, et rien n'en est lu. Un dossier se coupe, il ne se copie
// pas. Ce module garde ce qui est copié ou coupé (jusqu'à la fermeture de l'explorateur) et dit ce qui s'est passé ; l'explorateur (js/explorer/explorer.js)
// sait quelle ligne la personne vise et où elle est. Le glisser-déposer (js/explorer/explorer-drag.js) déplace par `moveTo`, avec les mêmes phrases.

const lastPart = path => path.split('/').pop();

export class Clipboard {
  #opts;
  #held = null; // { mode: 'copy' | 'cut', key, name } : le fichier ou le dossier copié ou coupé, ou null
  #queue = Promise.resolve(); // les copies d'un geste en cours : l'une après l'autre, la suivante lit le dossier quand la précédente y est rangée

  // opts : { t, notice(texte), appName(id), file(key) -> le fichier vivant de la liste, ou undefined, where() -> { view, path } (où est la personne),
  //   reveal(key) (met la ligne au clavier quand elle y est),
  //          copying: { handles(fichier), copy(fichier, dossier) -> Promise<{ key } | null> } (js/files/copying.js),
  //          filing: { moveFileTo(fichier, dossier), moveFolderTo(chemin, dossier) } (js/explorer/filing.js : 'moved' | 'same' | 'inside' | 'gone' | rien) }
  constructor(opts) {
    this.#opts = opts;
  }

  // Ce que la personne a copié ou coupé, ou null.
  get held() { return this.#held; }

  // On n'a plus rien de copié ni de coupé : l'explorateur se ferme, et ce qui était à coller a pu changer pendant que la personne était dans une app (le
  // fichier supprimé, renommé, déjà ailleurs).
  clear() { this.#held = null; }

  // Ctrl+C (`mode` 'copy'), Ctrl+X (`mode` 'cut') ou Ctrl+D (`mode` 'duplicate') sur la ligne `key` (un fichier, ou un dossier : « dir:chemin »). Un fichier
  // qu'aucun gardien ne copie, ou un dossier, ne se copie pas : la phrase dit pourquoi. Ctrl+D ne garde rien : il rend la promesse de la copie (voir
  // `duplicate`).
  take(key, mode) {
    const { t, notice, appName, copying, file, where } = this.#opts;
    if (where().view === 'trash') { notice(t('clip.inTrash')); return undefined; }
    if (key.startsWith('dir:')) {
      if (mode !== 'cut') { notice(t('clip.folderCopy')); return undefined; }
      this.#held = { mode, key, name: lastPart(key.slice(4)) };
    } else {
      const found = file(key);
      if (!found) return undefined;
      if (mode !== 'cut' && !copying.handles(found)) { notice(t('ex.notice.appOnly', { app: appName(found.app) })); return undefined; }
      if (mode === 'duplicate') return this.duplicate(found);
      this.#held = { mode, key, name: found.name || t('ex.untitled') };
    }
    notice(t(mode === 'copy' ? 'clip.copied' : 'clip.cut', { name: this.#held.name }));
    return undefined;
  }

  // « Dupliquer » (le menu de la ligne, Ctrl+D) : une copie du fichier, rangée dans le même dossier que lui, qui prend le clavier. Le presse-papiers n'y est
  // pour rien. Deux appuis qui se suivent font deux copies, pas deux fois le même nom : la copie suivante attend que la précédente soit rangée et la liste
  // relue.
  duplicate(found) {
    const run = this.#queue.then(async () => {
      const made = await this.#opts.copying.copy(found, found.folder);
      if (made) this.#opts.reveal(made.key);
    });
    this.#queue = run.catch(() => {});
    return run;
  }

  // Ctrl+V : colle dans le dossier ouvert. Une copie se colle autant de fois qu'on veut ; ce qui a été coupé part une fois collé.
  async paste() {
    const { t, notice, copying, filing, file, where, reveal } = this.#opts;
    const held = this.#held;
    if (!held) { notice(t('clip.empty')); return; }
    const { view, path } = where();
    if (view !== 'folder') { notice(t('clip.noFolder')); return; }
    if (held.key.startsWith('dir:')) {
      this.#moved(held, await filing.moveFolderTo(held.key.slice(4), path), path, `dir:${path ? `${path}/` : ''}${held.name}`); return; }
    const found = file(held.key);
    if (!found) { this.#held = null; notice(t('clip.gone', { name: held.name })); return; }
    if (held.mode === 'cut') { this.#moved(held, await filing.moveFileTo(found, path), path, held.key); return; }
    const made = await copying.copy(found, path);
    if (made) reveal(made.key);
  }

  // Le glisser-déposer (js/explorer/explorer-drag.js) : la ligne `key` (un fichier, ou un dossier : « dir:chemin ») va dans le dossier `path`, comme après un
  // couper-coller mais sans le presse-papiers : ce qui est coupé reste coupé. La phrase dit ce qui s'est passé. Un fichier qui n'est plus dans la liste n'est
  // pas déplacé (la liste dit la vérité).
  async moveTo(key, path) {
    const { t, filing, file } = this.#opts;
    const folder = key.startsWith('dir:');
    const found = folder ? null : file(key);
    if (!folder && !found) return;
    const name = folder ? lastPart(key.slice(4)) : (found.name || t('ex.untitled'));
    const result = await (folder ? filing.moveFolderTo(key.slice(4), path) : filing.moveFileTo(found, path));
    this.#moved({ key, name }, result, path, folder ? `dir:${path ? `${path}/` : ''}${name}` : key, 'drag.gone');
  }

  // La phrase d'un déplacement : `result` est ce que js/explorer/filing.js rend (rien : le rangement n'a pas pu s'écrire, il l'a dit). Un fichier ou un dossier
  // déplacé n'est plus à coller (`held` : { key, name }).
  #moved(held, result, folder, key, gone = 'clip.gone') {
    const { t, notice, reveal } = this.#opts;
    if (!result) return;
    const sentences = {
      moved: () => t('clip.moved', { name: held.name, folder: folder || t('ex.me') }), same: () => t('clip.same', { name: held.name }),
        inside: () => t('clip.folderInto'), gone: () => t(gone, { name: held.name }),
    };
    notice(sentences[result]());
    if ((result === 'moved' || result === 'gone') && this.#held && this.#held.key === held.key) this.#held = null;
    if (result === 'moved') reveal(key);
  }
}
