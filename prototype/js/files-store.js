// Les fichiers que GFS garde, côté données (contrats 6.6) : la table `GFS_Fichiers`, une ligne par PDF, le fichier en pièce jointe Grist. Ce module ajoute, remplace, retire et lit un
// fichier ; il ne montre rien à la personne (les fenêtres et les phrases sont à js/kept-files.js) et ne parle à Grist que par le port de GFS et le cadre d'envoi (js/transfer.js).
//
// Les règles : la table ne naît qu'avec l'accord de la personne, avant tout envoi (un refus ne laisse rien derrière lui) ; le fichier part d'abord, la ligne s'écrit ensuite (un envoi qui
// échoue n'ajoute aucune ligne) ; au moment d'écrire, la table est relue : ce qui a changé pendant que la personne décidait (un nom pris entre-temps, un fichier retiré par une autre
// personne) est pris en compte, pas écrasé. L'ancienne pièce jointe d'un fichier remplacé n'est plus citée par aucune cellule : Grist l'efface seul au bout de 7 jours (faits vérifiés 14).
// Les écritures se font l'une après l'autre.
//
// La corbeille (contrats 6.6, point 7) : mettre un fichier à la corbeille marque sa ligne (`SupprimeLe`, `SupprimePar`), rien ne s'efface et la pièce jointe reste citée ; le restaurer vide le marqueur ;
// seul « supprimer définitivement » retire la ligne. Un fichier à la corbeille ne compte plus pour les noms : un nouveau fichier peut reprendre son nom, et c'est le restauré qui prend alors un numéro.
// Ces gestes agissent sur des lignes qui existent déjà : ils ne créent jamais la table, donc ne demandent jamais son accord.

import { OwnTable } from './own-table.js';
import { FILES_TABLE, FILES_COLUMNS, FILES_COLUMN_IDS, TRASH_COLUMN_IDS, sameName, freeName, newId, newRecord, replacementRecord, trashRecord, restoreRecord } from './gfs-files.js';

const cell = (data, column, i) => (Array.isArray(data[column]) ? data[column][i] : undefined);
const text = value => (typeof value === 'string' ? value : '');

// La pièce jointe d'une cellule `Contenu` : `['L', numéro, …]`, le premier numéro ; null quand il n'y en a pas.
function attachmentOf(value) {
  return Array.isArray(value) && value[0] === 'L' && Number.isInteger(value[1]) ? value[1] : null;
}

// Les fichiers d'une table lue : [{ row, id, name, ts, by, attachment, trashed }]. Une ligne sans identifiant est ignorée (GFS ne sait pas la désigner). `trashed` : { ts, by } (la date du geste,
// son auteur) quand le fichier est à la corbeille, sinon null ; une table plus ancienne n'a pas ces colonnes : aucun fichier n'y est à la corbeille.
export function filesOf(data) {
  const files = [];
  const rows = (data && Array.isArray(data.id)) ? data.id : [];
  rows.forEach((row, i) => {
    const id = text(cell(data, 'Identifiant', i));
    const deleted = cell(data, 'SupprimeLe', i);
    const trashed = typeof deleted === 'number' && deleted > 0 ? { ts: deleted, by: text(cell(data, 'SupprimePar', i)) } : null;
    if (id) files.push({ row, id, name: text(cell(data, 'Nom', i)), ts: cell(data, 'Date', i), by: text(cell(data, 'Auteur', i)), attachment: attachmentOf(cell(data, 'Contenu', i)), trashed });
  });
  return files;
}

const alive = file => !file.trashed;

export class FilesStore {
  #port;
  #table;
  #transfer;
  #identity;
  #now;
  #queue = Promise.resolve();

  // opts : { port ({ doc }), transfer (js/transfer.js), consent() -> Promise<boolean> (créer la table ?), identity() -> l'adresse de la personne ou '', now() -> millisecondes }
  constructor({ port, transfer, consent, identity = () => '', now = () => Date.now() }) {
    this.#port = port;
    this.#transfer = transfer;
    this.#identity = identity;
    this.#now = now;
    this.#table = new OwnTable({ port, name: FILES_TABLE, columns: FILES_COLUMNS, consent });
  }

  // Un seul geste d'écriture à la fois : le suivant part de la table telle que le précédent l'a laissée.
  #exclusive(task) {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => {});
    return run;
  }

  // Ajoute un PDF. `file` : l'objet File ; `name` : son nom pour GFS (avec « .pdf ») ; `decide(existant, copie)` : appelé seulement quand un fichier porte déjà ce nom (`copie` : le nom libre
  // « Nom (1).pdf »), rend 'replace' (le fichier existant garde sa place et prend ce contenu), 'both' (le nouveau prend le nom de la copie) ou null (la personne renonce) ; `onUpload()` :
  // appelé juste avant l'envoi. Rend null si elle renonce, sinon { status: 'added' | 'replaced', id, name, row }. TableDeclined quand la personne refuse de créer la table.
  add({ file, name, decide, onUpload = () => {}, origin = 'import' }) {
    return this.#exclusive(async () => {
      const state = await this.#table.ready(FILES_COLUMN_IDS);
      const present = filesOf(state.data).filter(alive);
      const existing = present.find(other => sameName(other.name, name)) || null;
      const copy = freeName(name, present.map(other => other.name));
      const choice = existing ? await decide(existing, copy) : 'new';
      if (choice === null || choice === undefined) return null;
      // Le nom que Grist garde avec la pièce jointe est celui que la personne verra : celui du fichier remplacé, ou le nom libre d'une copie.
      const wanted = { replace: () => existing.name, both: () => copy, new: () => name }[choice]();
      onUpload();
      const attachment = await this.#transfer.upload(file, wanted);
      return this.#write({ choice, existing, file, name: wanted, attachment, origin });
    });
  }

  // L'écriture, sur la table relue : un fichier à remplacer qui n'est plus là devient un fichier ajouté ; un nom pris entre-temps reçoit son numéro.
  async #write({ choice, existing, file, name, attachment, origin }) {
    const fresh = filesOf((await this.#table.load()).data).filter(alive);
    const values = { attachment, size: file.size, author: this.#identity(), now: this.#now(), origin };
    const target = choice === 'replace' ? fresh.find(other => other.id === existing.id) : null;
    const tableId = this.#table.id;
    if (target) {
      await this.#port.doc.applyUserActions([['UpdateRecord', tableId, target.row, replacementRecord(values)]]);
      return { status: 'replaced', id: target.id, name: target.name, row: target.row };
    }
    const taken = fresh.map(other => other.name);
    const kept = taken.some(other => sameName(other, name)) ? freeName(name, taken) : name;
    const id = newId();
    const result = await this.#port.doc.applyUserActions([['AddRecord', tableId, null, newRecord({ ...values, id, name: kept })]]);
    const row = result && Array.isArray(result.retValues) ? result.retValues[0] : null;
    return { status: 'added', id, name: kept, row };
  }

  // Met un fichier à la corbeille : sa ligne reste, marquée de la date et de l'auteur du geste (les deux colonnes sont ajoutées à une table plus ancienne) ; rien ne s'efface. Rend false quand
  // le fichier n'est plus là, ou y est déjà.
  trash(file) {
    return this.#exclusive(async () => {
      const state = await this.#table.existing(TRASH_COLUMN_IDS);
      const found = state && filesOf(state.data).find(other => other.id === file.id);
      if (!found || found.trashed) return false;
      await this.#port.doc.applyUserActions([['UpdateRecord', this.#table.id, found.row, trashRecord({ now: this.#now(), author: this.#identity() })]]);
      return true;
    });
  }

  // Sort un fichier de la corbeille : le marqueur se vide, le fichier retrouve son dossier et ses favoris (le rangement n'a pas bougé). Un nom pris entre-temps par un fichier qui n'est pas à la
  // corbeille n'est pas écrasé : le restauré prend le premier nom libre, « Nom (1).pdf ». Rend { name, renamed }, ou null quand le fichier n'est plus à la corbeille.
  restore(file) {
    return this.#exclusive(async () => {
      const state = await this.#table.existing();
      const all = state ? filesOf(state.data) : [];
      const found = all.find(other => other.id === file.id && other.trashed);
      if (!found) return null;
      const taken = all.filter(alive).map(other => other.name);
      const name = taken.some(other => sameName(other, found.name)) ? freeName(found.name, taken) : found.name;
      await this.#port.doc.applyUserActions([['UpdateRecord', this.#table.id, found.row, { ...restoreRecord(), ...(name === found.name ? {} : { Nom: name }) }]]);
      return { name, renamed: name !== found.name };
    });
  }

  // Supprime pour de bon les fichiers `files`, s'ils sont toujours à la corbeille : un fichier restauré entre-temps, ou déjà supprimé, n'est pas touché. Leurs pièces jointes, plus citées, seront effacées
  // par Grist au bout de 7 jours (faits vérifiés 14). Rend le nombre de lignes retirées.
  empty(files) {
    return this.#exclusive(async () => {
      const state = await this.#table.existing();
      const ids = new Set(files.map(file => file.id));
      const rows = state ? filesOf(state.data).filter(other => other.trashed && ids.has(other.id)) : [];
      if (rows.length) await this.#port.doc.applyUserActions(rows.map(other => ['RemoveRecord', this.#table.id, other.row]));
      return rows.length;
    });
  }

  // Le contenu d'un fichier : { blob, name }. La ligne est relue (un fichier retiré par une autre personne, ou une cellule sans pièce jointe, est dit) ; rien n'est écrit.
  async download(file) {
    const found = filesOf((await this.#table.load()).data).find(other => other.id === file.id);
    if (!found) throw new Error('Ce fichier n’est plus dans le document.');
    if (found.trashed) throw new Error('Ce fichier est à la corbeille.');
    if (found.attachment === null) throw new Error('Ce fichier n’a pas de contenu.');
    return { blob: await this.#transfer.download(found.attachment), name: found.name };
  }
}
