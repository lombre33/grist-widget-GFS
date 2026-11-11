// Ranger un fichier dans GFS (contrats 5.4, point 9) : une app qui a fabriqué un PDF (un export de Publipostage+) demande à GFS de le garder, par l'appel
// `ranger`. GFS est seul à écrire ce qu'il garde (6.6) : l'app ne reçoit aucun jeton, elle donne le fichier et son nom ; la table, la fenêtre « Ce nom est déjà
// pris » et le rangement sont ceux de la personne qui importe un PDF (js/kept-files.js). Ce module lit la demande (sans effet de bord), vérifie que l'app a
// déclaré `actions.ranger`, met les dépôts à la file (un seul à la fois : la fenêtre d'un nom pris ne se superpose pas à celle d'un autre) et retient ce qui
// vaut pour tout un lot : la réponse « Faire pareil pour les suivants », la table refusée, le rangement refusé.

import { ERR, Refus } from './filter.js';
import { PDF_TYPE, cleanName } from './gfs-files.js';
import { normalizePath } from './explorer-model.js';

const NAME_MAX = 200;
const LOT_MAX = 64;
const FOLDER_MAX = 200;

const refuse = message => new Refus(ERR.REFUSE, message);

// Ce que GFS a fait, dans les mots du contrat : `ajoute` (un nouveau fichier), `remplace` (le fichier de ce nom prend le contenu), `copie` (le nom était pris :
// le nouveau a un nom libre), `ignore` (la personne n'en veut pas).
const STATUS = Object.freeze({ added: 'ajoute', replaced: 'remplace', copied: 'copie', skipped: 'ignore' });

// `ranger { fichier, nom, type?, lot?, suivants?, dossier? }` (5.4, point 9) -> { file, name, type, lot, more, folder }. Une forme hors règle est refusée
// (GFS_REFUSE) avant que rien ne s'écrive.
// `nom` : le nom pour GFS, un « .pdf » manquant est ajouté ; `type` : `pdf` (le seul que GFS garde) ; `lot` : un texte qui nomme l'export en lot (au plus 64
//   signes) ; `suivants` : combien de fichiers l'app rangera encore après celui-ci (0 : le dernier, la case « pour les suivants » n'est pas offerte) ;
//   `dossier` : le dossier de la personne où va un fichier nouveau.
export function readDeposit(args) {
  const { fichier: file, type = PDF_TYPE } = args;
  if (!(file instanceof Blob)) throw refuse('ranger : fichier doit être un File ou un Blob.');
  const name = readName(args.nom);
  if (type !== PDF_TYPE) throw refuse(`ranger : GFS ne garde que des fichiers de type « ${PDF_TYPE} » (reçu : « ${String(type).slice(0, 40)} »).`);
  return { file, name, type, lot: readLot(args.lot), more: readMore(args.suivants), folder: readFolder(args.dossier) };
}

// Le nom pour GFS : les signes de contrôle deviennent des espaces, un « .pdf » manquant est ajouté.
function readName(nom) {
  const asked = typeof nom === 'string' ? nom.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim() : '';
  const name = cleanName(asked);
  if (!name || name.length > NAME_MAX) throw refuse(`ranger : nom doit être un texte de 1 à ${NAME_MAX} signes.`);
  return name;
}

// Le texte qui nomme l'export en lot, ou `null` quand l'app n'en donne pas.
function readLot(lot) {
  if (lot !== undefined && (typeof lot !== 'string' || lot.trim() === '' || lot.length > LOT_MAX)) throw refuse(
    `ranger : lot doit être un texte de 1 à ${LOT_MAX} signes.`);
  return lot === undefined ? null : lot;
}

// Combien de fichiers l'app rangera encore après celui-ci, ou `null` quand elle ne le dit pas.
function readMore(suivants) {
  if (suivants !== undefined && !(Number.isInteger(suivants) && suivants >= 0)) throw refuse('ranger : suivants doit être un entier de 0 ou plus.');
  return suivants === undefined ? null : suivants;
}

// Le dossier de la personne où va un fichier nouveau (la racine quand l'app n'en donne pas).
function readFolder(dossier) {
  if (dossier !== undefined && (typeof dossier !== 'string' || dossier.length > FOLDER_MAX)) throw refuse(
    `ranger : dossier doit être un chemin de ${FOLDER_MAX} signes au plus.`);
  return normalizePath(dossier);
}

export class Deposit {
  #host;
  #queue = Promise.resolve();
  #batch = null;

  // host : { kept (js/kept-files.js : deposit(demande)), session() -> la session de l'app active, appName(session) -> son nom dans la langue de la personne }
  constructor(host) { this.#host = host; }

  // L'appel de l'app à GFS, pour la table des poignées de l'enveloppe (5.1).
  handlers(session) {
    return { ranger: args => this.file(session, args) };
  }

  // Rend { statut, id, nom } (5.4, point 9) ; `id` et `nom` sont `null` quand la personne n'a pas voulu du fichier. Les refus ont leur code (3.6) : GFS_REFUSE
  // (forme, type non déclaré, fichier vide ou qui n'est pas un PDF), GFS_ACCES et GFS_LECTURE_SEULE, GFS_ANNULE (la personne refuse de créer la table),
  // GFS_ECHEC (Grist ou le cadre d'envoi), GFS_INACTIF (l'app est partie).
  file(session, args) {
    const request = readDeposit(args);
    const declared = (session.manifest.actions && session.manifest.actions.ranger) || [];
    if (!declared.includes(request.type)) throw refuse(
      `ranger : le type « ${request.type} » ne figure pas dans actions.ranger du manifeste de l'app « ${session.id} ».`);
    const batch = this.#batchOf(session, request.lot);
    const run = this.#queue.then(() => this.#run(session, request, batch));
    this.#queue = run.catch(() => {});
    return run;
  }

  async #run(session, { file, name, folder, lot, more }, batch) {
    const host = this.#host;
    if (session !== host.session()) throw new Refus(ERR.INACTIF, `L'app n'est plus active.`);
    const result = await host.kept.deposit({ file, name, folder, app: session.id, appName: host.appName(session), repeat: lot !== null && more !== 0, batch });
    return { statut: STATUS[result.status], id: result.id, nom: result.name };
  }

  // Ce qui vaut pour tout le lot d'une app : un lot est une app ouverte et le nom de lot qu'elle donne ; sans nom, chaque fichier est seul (aucune mémoire).
  // Le dernier lot seul est retenu : un autre nom de lot, ou une autre app, repart de zéro.
  #batchOf(session, lot) {
    const fresh = () => ({ choice: null, declined: false, noFolder: false });
    if (lot === null) return fresh();
    if (!this.#batch || this.#batch.session !== session || this.#batch.lot !== lot) this.#batch = { session, lot, memory: fresh() };
    return this.#batch.memory;
  }
}
