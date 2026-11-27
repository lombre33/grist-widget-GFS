// Les gestes de rangement qui s'affichent avant d'être écrits (étude du 23/11, choix du porteur : « raccourcir, puis afficher tout de suite ») : le dossier
// créé, le ★, un nom, un dossier renommé, déplacé ou retiré, un fichier mis à la corbeille (24/11) apparaissent à l'instant ; Grist est écrit ensuite, à son
// rang (js/explorer/filing.js, js/files/trash.js). Ce module
// ne sait rien de Grist : il tient la liste des changements en attente et les pose sur la liste que l'explorateur a lue.
//
// Le cycle d'un changement : `add` (il s'affiche), puis `confirm` quand l'écriture a abouti, ou `cancel` quand Grist l'a refusé (il disparaît, la phrase du
// refus est dite par l'écriture). Un changement confirmé reste posé sur la liste jusqu'à ce qu'une lecture partie APRÈS sa confirmation soit arrivée (`stamp`
// au départ de la lecture, `retire` à son arrivée) : une lecture partie avant ne le connaît pas, et sans cette garde le dossier clignoterait (il disparaîtrait,
// puis reviendrait). Rien ici ne se garde dans le navigateur : les changements vivent autant que la page.

import { normalize } from '../ui/search.js';

const searchOf = file => normalize(`${file.name} ${file.folder}`);

// Ce que chaque sorte de changement fait à { files, folders, pinned } (`folders` : les dossiers gardés sans fichier ; `pinned` : les dossiers en favori,
// absents d'une liste qui n'en porte pas). Les fichiers touchés sont recopiés, les autres gardent leur objet. Un fichier se désigne comme le rangement
// l'écrit : par son app et son numéro.
const pinnedOf = lists => lists.pinned || [];
const SHOW = {
  // le ★ et le dossier d'un fichier (épingler, ranger, déplacer : une ligne de rangement)
  place: (lists, { app, id, pinned, folder }) => ({ ...lists,
    files: lists.files.map(file => (file.app === app && file.id === String(id) ? { ...file, pinned, folder, search: searchOf({ ...file, folder }) } : file)) }),
  // le nom d'un fichier
  rename: (lists, { key, name }) => ({ ...lists, files: lists.files.map(file => (file.key === key ? { ...file, name, search: searchOf({ ...file, name }) } :
    file)) }),
  // un fichier qui part à la corbeille (choix du porteur, 24/11) : il quitte la liste des fichiers vivants
  leave: (lists, { app, id }) => ({ ...lists, files: lists.files.filter(file => !(file.app === app && file.id === String(id))) }),
  // des dossiers gardés sans fichier qui s'ajoutent (un dossier neuf, ou celui qu'un déplacement a vidé), une fois chacun
  addFolders: (lists, { paths }) => ({ ...lists, folders: [...lists.folders, ...paths.filter(path => !lists.folders.includes(path))] }),
  // des dossiers gardés sans fichier qui s'en vont, et leur favori avec eux (la ligne d'état qui le porte s'en va)
  dropFolders: (lists, { paths }) => ({ ...lists, folders: lists.folders.filter(path => !paths.includes(path)),
    ...(lists.pinned ? { pinned: lists.pinned.filter(path => !paths.includes(path)) } : {}) }),
  // des dossiers qui entrent dans les favoris (`on`) ou en sortent
  pinFolders: (lists, { paths, on }) => ({ ...lists, pinned: on ? [...new Set([...pinnedOf(lists), ...paths])] :
    pinnedOf(lists).filter(path => !paths.includes(path)) }),
  // des dossiers en favori qui changent de chemin (renommés, déplacés, fondus dans un dossier qui existe déjà : `pairs`, [[de, vers]]) : leur favori les suit
  followPins: (lists, { pairs }) => ({ ...lists, pinned: [...new Set(pinnedOf(lists).map(path => (pairs.find(([from]) => from === path) || [0, path])[1]))] }),
};

export class Pending {
  #ops = [];
  #seq = 0;
  #clock = 0; // le nombre de confirmations : une lecture partie quand il valait `n` connaît tout ce qui a été confirmé jusque-là
  // Appelé quand ce qui s'affiche change sans qu'une lecture arrive (un changement posé, ou retiré parce que Grist l'a refusé) : l'explorateur se redessine.
  onChange = () => {};

  get size() { return this.#ops.length; }

  // Un changement de plus, qui s'affiche tout de suite : un geste de rangement, en une ou plusieurs étapes. `shows` : { op, … } (voir SHOW), ou une liste. Rend
  // le changement, à confirmer ou à annuler d'un bloc.
  add(shows) {
    const steps = [].concat(shows);
    for (const step of steps) if (!SHOW[step.op]) throw new Error(`changement inconnu : ${step.op}`);
    const change = { steps, id: ++this.#seq, confirmedAt: null };
    this.#ops.push(change);
    this.onChange();
    return change;
  }

  // L'écriture a abouti : le changement reste affiché jusqu'à ce qu'une lecture plus récente le porte.
  confirm(change) { change.confirmedAt = ++this.#clock; }

  // Grist a refusé : le changement s'en va, la liste redevient celle qui est lue.
  cancel(change) {
    const at = this.#ops.indexOf(change);
    if (at < 0) return;
    this.#ops.splice(at, 1);
    this.onChange();
  }

  // Au départ d'une lecture des fichiers : ce qu'elle saura de ce qui a été confirmé.
  stamp() { return this.#clock; }

  // À l'arrivée de la lecture partie à `stamp` : les changements qu'elle porte (confirmés avant son départ) se retirent, sans se redessiner (la liste lue
  // arrive juste après, et les contient).
  retire(stamp) {
    this.#ops = this.#ops.filter(change => change.confirmedAt === null || change.confirmedAt > stamp);
  }

  // La liste lue, avec les changements en attente posés dessus, dans l'ordre où ils ont été faits. Sans changement, la liste lue elle-même.
  apply(lists) {
    return this.#ops.reduce((state, change) => change.steps.reduce((now, step) => SHOW[step.op](now, step), state), lists);
  }
}
