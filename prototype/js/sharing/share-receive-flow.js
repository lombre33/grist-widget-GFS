// Le parcours de celui qui reçoit des fichiers d'un autre document Grist, la première fois (« Nouveau > Importer > D'un autre document Grist… » ; décisions du
// porteur des 06/11 et 09/11) : le code d'invitation collé, l'accord (ce que GFS ajoute dans ce document), le lien du formulaire de réception copié depuis
// Grist, la réponse à rendre à l'envoyeur et son code de contrôle. Sans fenêtre ni Grist : tout passe par `engine`, les fonctions du moteur de partage du kit
// (kit/js/synchro/target/receive.js, voir js/sharing/sync-service.js), que les essais remplacent. Le moteur juge le code, le lien et la réponse ; GFS n'en juge
// rien (décision du 09/11). GFS reçoit TOUJOURS en archive (js/sharing/share-links.js : un fichier qui sort du partage reste ici, marqué « supprimé à la source
// », mesuré : faits vérifiés, 70) et range tout ce qui arrive dans une seule table, `GFS_Recus`.
//   read()    le code collé, lu et contrôlé : le nom du partage, ce qu'il apporte, si une réception de ce partage existe déjà ;
//   accept()  le journal du partage, sa table et la page de son formulaire sont créés (ou, si une réception existe déjà de ce même document, reprise avec la
//             nouvelle invitation) ;
//   reply()   le lien du formulaire collé, vérifié (il doit écrire dans CE journal) : le code de réponse et le code de contrôle ;
//   abort()   défait ce qui vient d'être créé, tant que la réponse n'est pas rendue.
import { RECEIVED_TABLE } from './received-files.js';

export { RECEIVED_TABLE };
const TABLES_TRIED = 50;

// Ce que GFS ne reçoit pas : un lien public ou un échange sont d'autres modes du moteur de Sync+, que GFS ne propose pas.
const mode = invitation => invitation.mode || 'reponse';
const refused = code => Object.assign(new Error(code), { share: code });

// deps : { engine, onReplied (rend la main quand la réponse est rendue : la boucle de réception du document démarre) }.
export function createTargetFlow({ engine, onReplied = () => {} }) {
  const state = { invitation: null, known: null, table: null, made: null, relinked: false, replied: false };

  // La table où arrivent les fichiers de cette réception : une destination ne reçoit les fichiers que d'un seul partage (règle du moteur), donc `GFS_Recus`
  // pour le premier, puis `GFS_Recus_2`, `GFS_Recus_3`… ; une table qui existe déjà n'est jamais reprise (ses lignes ne sont pas à nous). Une réception déjà là
  // garde la sienne.
  async function destination(known) {
    if (known) return ((known.note.tables || [])[0] || {}).dest || RECEIVED_TABLE;
    for (let n = 1; n <= TABLES_TRIED; n += 1) {
      const name = n === 1 ? RECEIVED_TABLE : `${RECEIVED_TABLE}_${n}`;
      if (!(await engine.tableTaken(name))) return name;
    }
    throw refused('tables');
  }

  // Le code collé : ce que la fenêtre montre. `expire` : la fin de validité du code (secondes) ; `known` : une réception de ce partage existe déjà dans ce
  // document.
  async function read(text) {
    const invitation = await engine.readInvitation(String(text || '').trim());
    if (mode(invitation) !== 'reponse') throw refused('mode');
    state.invitation = invitation;
    state.known = await engine.knownReception(invitation);
    state.table = await destination(state.known);
    return { name: invitation.name, tables: (invitation.tables || []).length, expire: invitation.expire || null, known: Boolean(state.known),
      table: state.table };
  }

  // La réception : les destinations sont vérifiées (le moteur refuse une table d'ici qui bouclerait vers le document d'origine), puis le journal, `GFS_Recus`
  // et la page du formulaire sont créés. Rend le nom du journal, aussi celui de la page où copier le lien du formulaire.
  async function accept() {
    const { invitation, known } = state;
    if (known) {
      state.made = await engine.relinkReception(known, invitation);
      state.relinked = true;
    } else {
      const plans = invitation.tables.map(tb => ({ tb, dest: state.table }));
      await engine.checkDestinations(invitation, plans);
      state.made = await engine.createReception(invitation, plans, { reserve: true, options: { archive: true } });
    }
    return { journal: state.made.journal, relinked: state.relinked, table: state.table };
  }

  // Le lien du formulaire collé : le moteur vérifie qu'il écrit dans ce journal, puis rend la réponse à donner à l'envoyeur et le code de contrôle (le même
  // chez lui).
  async function reply(link) {
    const done = await engine.receptionReply(state.made, String(link || '').trim());
    state.replied = true;
    onReplied();
    return { code: done.code, control: done.control };
  }

  // Défait la réception qu'on vient de créer (le journal, la page du formulaire, les tables encore vides). Une réception reprise (déjà là avant) ou dont la
  // réponse est rendue reste.
  async function abort() {
    if (!state.made || state.relinked || state.replied) return;
    try { await engine.undoReception(state.made); } finally { state.made = null; }
  }

  return { read, accept, reply, abort, get created() { return Boolean(state.made); } };
}
