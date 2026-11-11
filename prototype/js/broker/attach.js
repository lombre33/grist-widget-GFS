// Joindre un fichier à la cellule « Pièces jointes » d'une ligne (contrats 5.4, point 12) : une app qui a fabriqué un PDF (l'export d'une ligne de
// Publipostage+) demande à GFS de le joindre à la cellule de CETTE ligne, par l'appel `joindre`. GFS est seul à parler à Grist : l'app ne reçoit aucun jeton
// d'écriture, elle donne les octets ; GFS les envoie (le cadre d'envoi, js/broker/transfer.js), relit la colonne juste avant d'écrire, et écrit un seul lot. Ce
// module lit la demande (sans effet de bord), vérifie ce que l'app a le droit de demander, joue l'envoi puis l'écriture, et rend le rapport.

import { ERR, Refus, readRefusal, writeRefusal } from './filter.js';
import { PDF_TYPE, cleanName, looksLikePdf, sameName } from '../files/gfs-files.js';

const NAME_MAX = 200;
const ITEMS_MAX = 200;
const MODES = Object.freeze(['remplacer', 'ajouter']);
const ATTACHMENTS = 'Attachments';

const refuse = message => new Refus(ERR.REFUSE, message);

// Ce qui peut arrêter un lot, dans les mots du contrat : `absente`, `inutilisable` (avant tout envoi), puis `refus`, `injoignable`, `echec` (pendant l'envoi ou
// l'écriture). `trop-gros` n'arrête rien : c'est l'échec d'un seul fichier (`echecs`).
export const PROBLEM = Object.freeze({ missing: 'absente', unusable: 'inutilisable', denied: 'refus', tooLarge: 'trop-gros', unreachable: 'injoignable',
  failed: 'echec' });

// `joindre { table, colonne, mode?, fichiers: [{ ligne, fichier, nom }] }` (5.4, point 12) -> { table, column, mode, items: [{ index, row, file, name }] }. Une
// forme hors règle est refusée (GFS_REFUSE) avant que rien ne s'envoie. `nom` : le nom que Grist garde, un « .pdf » manquant est ajouté ; `mode` : `remplacer`
// (par défaut) ou `ajouter`.
export function readAttach(args) {
  const { table, colonne, mode = MODES[0], fichiers } = args && typeof args === 'object' ? args : {};
  if (typeof table !== 'string' || table === '') throw refuse('joindre : table doit être l\'identifiant d\'une table.');
  if (typeof colonne !== 'string' || colonne === '') throw refuse('joindre : colonne doit être l\'identifiant d\'une colonne.');
  if (!MODES.includes(mode)) throw refuse(`joindre : mode doit valoir « ${MODES.join(' » ou « ')} ».`);
  if (!Array.isArray(fichiers) || fichiers.length === 0 || fichiers.length > ITEMS_MAX) throw refuse(
    `joindre : fichiers doit être une liste de 1 à ${ITEMS_MAX} entrées.`);
  return { table, column: colonne, mode, items: fichiers.map(readItem) };
}

function readItem(entry, index) {
  const { ligne, fichier, nom } = entry && typeof entry === 'object' ? entry : {};
  const where = `joindre : fichiers[${index}]`;
  if (!Number.isInteger(ligne) || ligne < 1) throw refuse(`${where}.ligne doit être un numéro de ligne (un entier d'au moins 1).`);
  if (!(fichier instanceof Blob)) throw refuse(`${where}.fichier doit être un File ou un Blob.`);
  if (fichier.size === 0) throw refuse(`${where}.fichier est vide.`);
  const name = cleanName(typeof nom === 'string' ? nom.replace(/[\u0000-\u001f\u007f]+/g, ' ') : '');
  if (!name || name.length > NAME_MAX) throw refuse(`${where}.nom doit être un texte de 1 à ${NAME_MAX} signes.`);
  return { index, row: ligne, file: fichier, name };
}

// Les ids d'une cellule « Pièces jointes » : `['L', 3, 5]` -> [3, 5] ; une cellule vide (null, '', 0 ou liste vide) -> [].
const idsOf = cell => (Array.isArray(cell) && cell[0] === 'L' ? cell.slice(1).filter(Number.isInteger) : []);

// Pourquoi un envoi a échoué (js/broker/transfer.js : `kind` et `status`), dans les mots du contrat.
function problemOfTransfer(error) {
  if (error && error.kind === 'http') {
    if (error.status === 413) return PROBLEM.tooLarge;
    return error.status === 401 || error.status === 403 ? PROBLEM.denied : PROBLEM.failed;
  }
  return error && ['network', 'frame', 'token', 'timeout'].includes(error.kind) ? PROBLEM.unreachable : PROBLEM.failed;
}

// Le refus d'une écriture par Grist (règles d'accès, droits) se lit dans son message ; tout autre échec est `echec`.
const problemOfWrite = error => (/access|denied|permission|forbidden|not allowed/i.test(String((error && error.message) || error)) ? PROBLEM.denied :
  PROBLEM.failed);

export class Attach {
  #host;
  #queue = Promise.resolve();

  // host : { doc (le document de la page : fetchTable, applyUserActions), transfer (js/broker/transfer.js : upload), session() -> l'app active, readonly() ->
  //   le
  //   document est en lecture seule }
  constructor(host) { this.#host = host; }

  // L'appel de l'app à GFS, pour la table des poignées de l'enveloppe (5.1).
  handlers(session) {
    return { joindre: args => this.attach(session, args) };
  }

  // Rend { colonne, probleme, joints, echecs } (5.4, point 12). Les refus ont leur code (3.6) : GFS_REFUSE (forme, type non déclaré, table que le manifeste ne
  // laisse pas lire et écrire, fichier qui n'est pas un PDF), GFS_LECTURE_SEULE, GFS_INACTIF (l'app est partie). Un envoi ou une écriture que Grist refuse
  // n'est pas une erreur de l'appel : le rapport le dit (`probleme`).
  attach(session, args) {
    const request = readAttach(args);
    const declared = (session.manifest.actions && session.manifest.actions.joindre) || [];
    if (!declared.includes(PDF_TYPE)) throw refuse(
      `joindre : le type « ${PDF_TYPE} » ne figure pas dans actions.joindre du manifeste de l'app « ${session.id} ».`);
    const run = this.#queue.then(() => this.#run(session, request));
    this.#queue = run.catch(() => {});
    return run;
  }

  async #run(session, { table, column, mode, items }) {
    const host = this.#host;
    if (session !== host.session()) throw new Refus(ERR.INACTIF, 'L\'app n\'est plus active.');
    if (host.readonly()) throw new Refus(ERR.LECTURE_SEULE, 'Le document est en lecture seule.');
    const denied = readRefusal(session.policy, table) || writeRefusal(session.policy, table);
    if (denied) throw refuse(`joindre : ${denied}`);
    for (const item of items) {
      if (!looksLikePdf(new Uint8Array(await item.file.slice(0, 1024).arrayBuffer()))) throw refuse(
        `joindre : fichiers[${item.index}].fichier n'est pas un PDF.`);
    }
    const report = { colonne: column, probleme: null, joints: [], echecs: [] };
    const state = await this.#columnState(table, column);
    if (state) return stop(report, items, state);
    const known = new Set((await host.doc.fetchTable(table)).id);
    for (const item of items) if (!known.has(item.row)) report.echecs.push({ index: item.index, raison: 'ligne' });
    const sent = await this.#send(items.filter(item => known.has(item.row)), report);
    if (sent.length) await this.#write(table, column, mode, sent, report);
    report.echecs.sort((a, b) => a.index - b.index);
    return report;
  }

  // `absente` : la colonne n'existe pas dans la table ; `inutilisable` : elle n'est pas de type Pièces jointes, ou elle est à formule (déclenchée comprise) ;
  //   null : elle peut recevoir.
  async #columnState(table, column) {
    const { doc } = this.#host;
    const tables = await doc.fetchTable('_grist_Tables');
    const at = tables.tableId.indexOf(table);
    if (at < 0) return PROBLEM.missing;
    const columns = await doc.fetchTable('_grist_Tables_column');
    const found = columns.id.findIndex((id, i) => columns.parentId[i] === tables.id[at] && columns.colId[i] === column);
    if (found < 0) return PROBLEM.missing;
    const formula = typeof columns.formula[found] === 'string' && columns.formula[found].trim() !== '';
    return columns.type[found] === ATTACHMENTS && !formula && !columns.isFormula[found] ? null : PROBLEM.unusable;
  }

  // L'envoi, un fichier après l'autre : ce que Grist refuse arrête le lot (`probleme`), les fichiers pas encore envoyés sont des échecs. Seule la taille
  // n'arrête rien : un fichier que Grist trouve trop gros est un échec à lui seul (`trop-gros`, 06/11, question de Publipostage+ à sa 053), les suivants
  // partent. Rend les fichiers envoyés avec leur numéro de pièce jointe.
  async #send(items, report) {
    const sent = [];
    for (const item of items) {
      if (report.probleme) { report.echecs.push({ index: item.index, raison: report.probleme }); continue; }
      try {
        sent.push({ ...item, attachment: await this.#host.transfer.upload(item.file, item.name) });
      } catch (error) {
        const problem = problemOfTransfer(error);
        if (problem !== PROBLEM.tooLarge) report.probleme = problem;
        report.echecs.push({ index: item.index, raison: problem });
      }
    }
    return sent;
  }

  // L'écriture : la colonne relue juste avant (une pièce jointe ajoutée entre-temps n'est pas perdue), puis un seul lot. `remplacer` : un fichier de même nom
  //   que le nouveau sort de la cellule.
  async #write(table, column, mode, sent, report) {
    const { doc } = this.#host;
    const fresh = await doc.fetchTable(table);
    const names = await doc.fetchTable('_grist_Attachments');
    const nameOf = new Map(names.id.map((id, i) => [id, names.fileName[i]]));
    const cells = new Map(fresh.id.map((id, i) => [id, idsOf(fresh[column][i])]));
    const joints = [];
    for (const item of sent) {
      if (!cells.has(item.row)) { report.echecs.push({ index: item.index, raison: 'ligne' }); continue; }
      const before = cells.get(item.row);
      const kept = mode === 'remplacer' ? before.filter(id => !sameName(nameOf.get(id), item.name)) : before;
      cells.set(item.row, [...kept, item.attachment]);
      joints.push({ index: item.index, remplace: kept.length < before.length, row: item.row });
    }
    if (!joints.length) return;
    const rows = [...new Set(joints.map(joint => joint.row))];
    try {
      await doc.applyUserActions([['BulkUpdateRecord', table, rows, { [column]: rows.map(row => ['L', ...cells.get(row)]) }]]);
    } catch (error) {
      console.warn('GFS : joindre : Grist n\'a pas écrit la cellule', error && error.message);
      report.probleme = problemOfWrite(error);
      for (const joint of joints) report.echecs.push({ index: joint.index, raison: report.probleme });
      return;
    }
    report.joints = joints.map(({ index, remplace }) => ({ index, remplace }));
  }
}

// Une colonne qui ne peut pas recevoir : rien n'est envoyé, chaque fichier est un échec qui dit pourquoi.
function stop(report, items, problem) {
  return { ...report, probleme: problem, echecs: items.map(item => ({ index: item.index, raison: problem })) };
}
