// Le parcours de celui qui envoie un fichier à un autre document Grist (« Partager > Un autre document Grist… » ; décisions du porteur des 06/11 et 09/11) : une copie, une seule fois, dans un seul sens.
// Sans fenêtre ni Grist : tout ce qu'il fait passe par `engine`, les fonctions du moteur de partage du kit (kit/js/synchro/, voir js/sync-service.js), que les essais remplacent. La fenêtre
// (js/share-other-window.js) ne fait que montrer l'étape et demander le geste suivant.
//   prepare()  l'export d'un seul fichier (une condition sur son identifiant), l'invitation et son code ;
//   check()    la réponse collée, contrôlée chez Grist (de quel document est la clé de son formulaire) : le moteur juge le lien, GFS n'en juge rien ;
//   send()     le webhook, le fichier, puis le partage s'arrête (la copie reste chez l'autre) ;
//   abort()    défait ce qui a été préparé.
// Le premier lot ne couvre que les PDF que GFS garde (`GFS_Fichiers`).
import { FILES_COLUMN_IDS, FILES_TABLE, TRASH_COLUMN_IDS } from './gfs-files.js';

// Les colonnes qui partent : celles du fichier, sans la corbeille (qui n'a de sens que dans le document d'origine).
export const SENT_COLUMNS = Object.freeze(FILES_COLUMN_IDS.filter(id => !TRASH_COLUMN_IDS.includes(id)));
// Les colonnes d'aide que le moteur pose dans la table des fichiers et la table technique qu'il crée (pour le texte de l'accord ; leurs noms sont ceux du protocole entre deux documents).
export const HELPER_COLUMNS = Object.freeze(['id_sync', 'MajLe', 'RecalculLe']);
export const SYNC_TABLE_NAME = 'GFS_Synchro';
export const RECEIVED_TABLE = 'GFS_Recus';
export const PASS_MS = 2000; // entre deux passages du rattrapage, tant que des fichiers partent
export const PASSES = 90; // trois minutes au plus avant de dire que l'envoi n'est pas fini

// Le nom de l'export (celui du journal chez l'autre) : le nom du fichier sans « .pdf ».
export const exportName = file => String(file.name || '').replace(/\.pdf$/i, '').trim() || String(file.name || file.id);

// La sélection du moteur : la table des fichiers, ses colonnes, et le seul fichier voulu (son identifiant ne change jamais, ni au renommage ni au remplacement).
export const selectionOf = file => [{ table: FILES_TABLE, columns: [...SENT_COLUMNS], filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'eq', values: [file.id] }] } }];

// Ce qui retient l'envoi : un destinataire dont le lien de réception ne répond pas (`blocked`) ou un envoi qui n'a pas fini dans le temps (`timeout`).
const stuck = code => Object.assign(new Error(code), { share: code });

// deps : { engine, file ({ id, name }), wait (ms) → promesse }.
export function createSourceFlow({ engine, file, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const state = { exp: null, entry: null, reply: null, hook: null };

  async function prepare() {
    const saved = await engine.saveChosenExport({ name: exportName(file), selection: selectionOf(file) });
    state.exp = saved.created;
    const { entry, secret } = await engine.startInvitation(state.exp);
    state.entry = entry;
    const made = await engine.invitationCode(state.exp, entry, secret);
    return { code: made.code, expire: made.expire };
  }

  // La réponse collée : ce que la fenêtre montre (le document, dit par Grist, et le code de contrôle) ; le moteur refuse tout ce qui ne va pas (autre instance, autre invitation, lien d'un autre document…).
  async function check(text) {
    state.reply = await engine.checkReply(state.exp, state.entry, String(text || '').trim());
    const { share } = state.reply;
    return { name: share.name, folder: share.folder, team: share.teamName, personal: Boolean(share.personal), control: state.reply.code };
  }

  // Envoie, jusqu'à ce que plus rien ne reste à partir, puis arrête le partage. Le rattrapage du moteur envoie le contenu du fichier en un second temps (`catchUp`) : on le passe jusqu'à « rien à envoyer ».
  // Si une autre page du navigateur renvoyait déjà (`sendExisting` rend null), les lignes sont seulement marquées : on attend qu'un passage les ait envoyées avant de croire que tout est parti.
  async function send(progress = () => {}) {
    state.hook = await engine.approveReply(state.exp, state.entry, state.reply);
    progress({ phase: 'rows' });
    let waiting = (await engine.sendExisting(state.exp)) === null;
    for (let pass = 0; pass < PASSES; pass += 1) {
      progress({ phase: 'files', pass });
      await engine.catchUp();
      const caught = engine.catchState();
      if (caught.why === 'blocked') throw stuck('blocked');
      if (caught.why === 'sent') waiting = false;
      if (!waiting && !caught.running && caught.why === 'idle' && engine.filesPending(state.exp.id) === 0) {
        await engine.endExport(state.exp);
        return { document: state.reply.share.name };
      }
      await wait(PASS_MS);
    }
    throw stuck('timeout');
  }

  // L'invitation et l'export qu'on a préparés sont défaits (l'export, ses lignes de la table technique, l'invitation en attente) ; les colonnes d'aide restent. Après le début de l'envoi (webhook posé), c'est
  // l'arrêt du partage : avis de fin, webhook et export effacés ; la copie déjà arrivée reste chez l'autre.
  async function abort() {
    if (!state.exp) return;
    try { if (state.entry && !state.hook) await engine.cancelPendingInvitation(state.entry); } catch (error) { /* l'invitation n'était plus là */ }
    await engine.endExport(state.exp);
    state.exp = null;
  }

  return { prepare, check, send, abort, get started() { return Boolean(state.hook); } };
}
