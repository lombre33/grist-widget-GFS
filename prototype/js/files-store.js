// Les fichiers que GFS garde, côté données (contrats 6.6) : la table `GFS_Fichiers`, une ligne par PDF, le fichier en pièce jointe Grist. Ce module ajoute, remplace, retire et lit un
// fichier ; il ne montre rien à la personne (les fenêtres et les phrases sont à js/kept-files.js) et ne parle à Grist que par le port de GFS et le cadre d'envoi (js/transfer.js).
//
// Les règles : la table ne naît qu'avec l'accord de la personne, avant tout envoi (un refus ne laisse rien derrière lui) ; le fichier part d'abord, la ligne s'écrit ensuite (un envoi qui
// échoue n'ajoute aucune ligne) ; au moment d'écrire, la table est relue : ce qui a changé pendant que la personne décidait (un nom pris entre-temps, un fichier retiré par une autre
// personne) est pris en compte, pas écrasé. L'ancienne pièce jointe d'un fichier remplacé n'est plus citée par aucune cellule : Grist l'efface seul au bout de 7 jours (faits vérifiés 14).
// Les écritures se font l'une après l'autre.

import { OwnTable } from './own-table.js';
import { FILES_TABLE, FILES_COLUMNS, FILES_COLUMN_IDS, sameName, freeName, newId, newRecord, replacementRecord } from './gfs-files.js';

const cell = (data, column, i) => (Array.isArray(data[column]) ? data[column][i] : undefined);
const text = value => (typeof value === 'string' ? value : '');

// La pièce jointe d'une cellule `Contenu` : `['L', numéro, …]`, le premier numéro ; null quand il n'y en a pas.
function attachmentOf(value) {
  return Array.isArray(value) && value[0] === 'L' && Number.isInteger(value[1]) ? value[1] : null;
}

// Les fichiers d'une table lue : [{ row, id, name, ts, by, attachment }]. Une ligne sans identifiant est ignorée (GFS ne sait pas la désigner).
export function filesOf(data) {
  const files = [];
  const rows = (data && Array.isArray(data.id)) ? data.id : [];
  rows.forEach((row, i) => {
    const id = text(cell(data, 'Identifiant', i));
    if (id) files.push({ row, id, name: text(cell(data, 'Nom', i)), ts: cell(data, 'Date', i), by: text(cell(data, 'Auteur', i)), attachment: attachmentOf(cell(data, 'Contenu', i)) });
  });
  return files;
}

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
      const present = filesOf(state.data);
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
    const fresh = filesOf((await this.#table.load()).data);
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

  // Retire un fichier de la table (sa pièce jointe, plus citée, sera effacée par Grist au bout de 7 jours). Rend false quand il n'y était déjà plus.
  remove(file) {
    return this.#exclusive(async () => {
      const found = filesOf((await this.#table.load()).data).find(other => other.id === file.id);
      if (!found) return false;
      await this.#port.doc.applyUserActions([['RemoveRecord', this.#table.id, found.row]]);
      return true;
    });
  }

  // Le contenu d'un fichier : { blob, name }. La ligne est relue (un fichier retiré par une autre personne, ou une cellule sans pièce jointe, est dit) ; rien n'est écrit.
  async download(file) {
    const found = filesOf((await this.#table.load()).data).find(other => other.id === file.id);
    if (!found) throw new Error('Ce fichier n’est plus dans le document.');
    if (found.attachment === null) throw new Error('Ce fichier n’a pas de contenu.');
    return { blob: await this.#transfer.download(found.attachment), name: found.name };
  }
}
