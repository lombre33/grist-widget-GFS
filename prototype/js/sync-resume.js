// La reprise du partage entre deux documents quand la page s'ouvre (« Partager > Un autre document Grist… », décisions du 09/11). Le moteur a deux boucles qui ne vivent que page ouverte : celle de
// l'envoyeur (elle envoie le contenu des fichiers après les lignes, et reprend un envoi que la page a laissé en route) et celle de celui qui reçoit (elle recopie le journal reçu dans sa table et attache le
// contenu quand il arrive). Si la fenêtre d'envoi a été fermée avant la fin, ou si la page du document qui reçoit n'était pas ouverte, rien ne s'arrête : au prochain démarrage, la boucle reprend d'où elle en était.
// Un document qui ne partage ni ne reçoit rien (aucune table technique du partage) ne charge rien : on ne lit que la liste de ses tables.
import { loadSharingEngine, startReceiving } from './sync-service.js';
import { SYNC_TABLE_NAME } from './share-other-flow.js';

const JOURNAL = /^GFS_Journal_/;

// Ce que les tables du document disent : un partage en cours d'envoi (la table technique), un partage reçu (un journal).
export const sharingNeeds = tables => ({ sending: tables.includes(SYNC_TABLE_NAME), receiving: tables.some(name => JOURNAL.test(name)) });

// deps : { docApi (grist.docApi), transfer, language, busy } ; `engine` : { load, receive } (les essais le remplacent). Rend ce qui a été repris, sans rien lever : une page qui ne peut pas lire ses tables
// (accès refusé) ne reprend rien.
export async function resumeSharing(deps, engine = { load: loadSharingEngine, receive: startReceiving }) {
  let tables;
  try { tables = (await deps.docApi.listTables()).map(String); } catch (error) { return { sending: false, receiving: false }; }
  const needs = sharingNeeds(tables);
  if (needs.receiving) await engine.receive(deps);
  else if (needs.sending) await engine.load(deps);
  return needs;
}
