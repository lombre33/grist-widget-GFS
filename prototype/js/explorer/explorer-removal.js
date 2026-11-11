// Les gestes de l'explorateur qui font partir une ligne de la liste : mettre à la corbeille, supprimer un dossier, restaurer, supprimer pour de bon, vider la
// corbeille (js/explorer/explorer.js). Sortis de l'explorateur pour qu'il reste sous les 600 lignes de code de l'outil d'audit. Rien ne s'y garde :
// l'explorateur donne, par des fonctions, ce qu'il montre à l'instant du geste.
//
// x : { opts() (les options de l'explorateur : i18n, notice, appName, filing), view() ('folder', 'recent', 'trash'…), choice() (un mode choix est ouvert),
//   files(), trashed() (les fichiers vivants et à la corbeille),
//       bin() (le gardien de la corbeille, js/files/trash.js), keys() (la clé de chaque ligne, dans l'ordre), isOpen(), select(clé, focus) }

export class Removal {
  #x;

  constructor(x) { this.#x = x; }

  // Suppr, ou « Mettre à la corbeille » : le fichier part à la corbeille (pas de question : rien ne s'efface) et la ligne suivante prend le clavier. À la
  // corbeille, Suppr supprime pour de bon.
  async trash(key) {
    const x = this.#x;
    const opts = x.opts();
    const { t } = opts.i18n;
    if (x.choice()) { opts.notice(t('ex.choose.newOff')); return; }
    if (x.view() === 'trash') { await this.purge(key); return; }
    if (key.startsWith('dir:')) { await this.deleteFolder(key); return; }
    const file = x.files().find(item => item.key === key);
    if (!file) return;
    if (!x.bin().handles(file)) { opts.notice(t('trash.appOnly', { app: opts.appName(file.app) })); return; }
    await this.leaving(key, () => x.bin().move(file));
  }

  // Supprimer un dossier : possible quand plus aucun fichier n'est dedans (rien ne s'efface, il ne reste qu'une ligne d'état, js/explorer/filing.js) ; sinon la
  // phrase dit quoi faire. La ligne suivante prend le clavier.
  async deleteFolder(key) {
    await this.leaving(key, () => this.#x.opts().filing.deleteFolder(key.slice(4)));
  }

  restore(key) {
    const file = this.#x.trashed().find(item => item.key === key);
    return file ? this.leaving(key, () => this.#x.bin().restore(file)) : Promise.resolve();
  }

  purge(key) {
    const file = this.#x.trashed().find(item => item.key === key);
    return file ? this.leaving(key, () => this.#x.bin().purge(file)) : Promise.resolve();
  }

  async emptyTrash() {
    const x = this.#x;
    if (!x.choice() && x.trashed().length) await x.bin().empty([...x.trashed()]);
  }

  // Un geste qui fait partir la ligne `key` de la liste : quand il a abouti, le clavier passe à la ligne qui la suivait (ou la précédait), comme dans un
  // explorateur de fichiers.
  async leaving(key, run) {
    const x = this.#x;
    const keys = x.keys();
    const at = keys.indexOf(key);
    const next = keys[at + 1] || keys[at - 1] || null;
    if (await run() && next && x.isOpen() && x.keys().includes(next)) x.select(next, true);
  }
}
