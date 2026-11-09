// La reprise du partage entre deux documents quand la page s'ouvre (« Partager > Un autre document Grist… », décisions du 09/11). Le moteur a deux boucles qui ne vivent que page ouverte : celle de
// l'envoyeur (elle envoie le contenu des fichiers après les lignes, et reprend un envoi que la page a laissé en route) et celle de celui qui reçoit (elle recopie le journal reçu dans sa table et attache le
// contenu quand il arrive). Si la fenêtre d'envoi a été fermée avant la fin, ou si la page du document qui reçoit n'était pas ouverte, rien ne s'arrête : au prochain démarrage, la boucle reprend d'où elle en était.
// Un document qui ne partage ni ne reçoit rien (aucune table technique du partage) ne charge rien : on ne lit que la liste de ses tables.
import { loadSharingEngine, startReceiving } from './sync-service.js';
import { SYNC_TABLE_NAME } from './share-other-flow.js';
import { closeSharingTables } from './sync-rules.js';

const JOURNAL = /^GFS_Journal_/;

// Ce que les tables du document disent : un partage en cours d'envoi (la table technique), un partage reçu (un journal).
export const sharingNeeds = tables => ({ sending: tables.includes(SYNC_TABLE_NAME), receiving: tables.some(name => JOURNAL.test(name)) });

// deps : { docApi (grist.docApi), transfer, language, busy, isOwner () → vrai/faux/null (la preuve qu'a GFS) } ; `engine` : { load, receive } (les essais le remplacent) ; `close` : la pose des règles des tables
// techniques (js/sync-rules.js). Rend ce qui a été repris, sans rien lever : une page qui ne peut pas lire ses tables (accès refusé) ne reprend rien. Les tables techniques ne sont lisibles que des
// propriétaires (audit de sécurité du 09/11) : les boucles du moteur ne tournent que sur leur page, qui pose aussi les règles qui manquent (Grist recharge alors le document, une seule fois).
export async function resumeSharing(deps, engine = { load: loadSharingEngine, receive: startReceiving }, close = closeSharingTables) {
  let tables;
  try { tables = (await deps.docApi.listTables()).map(String); } catch (error) { return { sending: false, receiving: false }; }
  const needs = sharingNeeds(tables);
  if (!needs.sending && !needs.receiving) return needs;
  if (!deps.isOwner || (await deps.isOwner()) !== true) return needs; // jamais deviné : sans la preuve d'être propriétaire, rien ne reprend
  const closing = await close({ docApi: deps.docApi });
  if (closing.changed) return needs; // Grist recharge le document : les boucles reprendront à l'ouverture suivante
  if (needs.receiving) await engine.receive(deps);
  else if (needs.sending) await engine.load(deps);
  return needs;
}
