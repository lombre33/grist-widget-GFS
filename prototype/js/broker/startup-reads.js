// Une seule lecture de la structure du document au démarrage (27/11, choix du porteur après la mesure de fluidité de GFS : « Lire le document une seule
// fois » ; faits vérifiés 197). Au démarrage, GFS lit la liste des tables et les tables internes de Grist (`_grist_Tables`, `_grist_Tables_column`, …) jusqu'à
// cinq fois chacune, l'une après l'autre : chaque étape (les noms des tables, le rangement, les noms du document, les réglages de la vue, les pages de GFS, la
// liste des fichiers) relit ce que la précédente venait de lire, et chaque lecture est un aller-retour de réseau (45 ms à 40 ms d'aller-retour, 125 ms à 120
// ms) : une dizaine de vagues avant que la liste s'affiche.
//
// Pendant les premières secondes de la page, ces lectures-là sont PARTAGÉES : la première part vers Grist, celles qui suivent (en vol ou finies) reçoivent sa
// réponse, chacune sa copie. Ce qui est partagé : `listTables`, `getDocName` et `fetchTable` d'une table interne (`_grist_…`), rien d'autre (les tables de la
// personne se lisent toujours chez Grist). Ce qui arrête le partage :
//   - toute écriture par ce port (`applyUserActions`) : la lecture d'après est faite chez Grist ; une lecture qui était en vol pendant l'écriture n'est pas
//   gardée ;
//   - `close()`, que le contrôleur appelle avant le premier geste qui écrit sans passer par ce port (le moteur de partage, `grist.docApi`) ;
//   - le délai (WINDOW_MS depuis la création du port) : un document qui change pendant que la personne travaille n'est jamais relu dans un état d'avant.
// Une lecture qui échoue n'est pas gardée : la suivante repart chez Grist. `warmStructure` lance les lectures ensemble, dès que GFS a dit « prêt » à Grist :
// les étapes qui les demandent ensuite les trouvent faites.

// La durée pendant laquelle les lectures de la structure se partagent, depuis la création du port : le démarrage mesuré tient en moins de 2 s à 120 ms
// d'aller-retour.
export const WINDOW_MS = 3000;

// Les tables internes de Grist que le démarrage relit étape après étape.
export const STRUCTURE = ['_grist_Tables', '_grist_Tables_column', '_grist_Views', '_grist_Views_section', '_grist_Pages', '_grist_Attachments'];

const isStructure = (method, args) => method === 'listTables' || method === 'getDocName' ||
  (method === 'fetchTable' && typeof args[0] === 'string' && args[0].startsWith('_grist_'));

// Chaque lecteur a sa copie : celui qui change ce qu'il a reçu ne change rien pour les autres.
function copyOf(value) {
  try { return typeof structuredClone === 'function' ? structuredClone(value) : value; } catch (error) { return value; }
}

// `doc` : l'interface brute de Grist (`GristDocAPI`). Rend { doc, close } : `doc` s'emploie à sa place, `close()` met fin au partage.
// `now()` : l'heure en millisecondes ; `windowMs` : voir WINDOW_MS.
export function shareStartupReads(doc, { now = () => Date.now(), windowMs = WINDOW_MS } = {}) {
  const since = now();
  const reads = new Map(); // « table » -> la promesse de la lecture que les autres partagent
  let closed = false;
  const open = () => !closed && now() - since < windowMs;
  const close = () => { closed = true; reads.clear(); };

  const share = (target, method, args) => {
    const key = method === 'fetchTable' ? `${method}:${args[0]}` : method;
    if (!reads.has(key)) {
      const read = Promise.resolve(target[method](...args));
      reads.set(key, read);
      read.catch(() => { if (reads.get(key) === read) reads.delete(key); }); // une lecture qui échoue n'est pas gardée
    }
    return reads.get(key).then(copyOf);
  };

  const shared = new Proxy(doc, {
    get(target, key) {
      const value = target[key];
      if (typeof key !== 'string' || typeof value !== 'function') return value;
      if (key === 'applyUserActions') {
        return (...args) => {
          reads.clear();
          return Promise.resolve(value.apply(target, args)).finally(() => reads.clear());
        };
      }
      if (key === 'listTables' || key === 'fetchTable' || key === 'getDocName') {
        return (...args) => {
          if (open() && isStructure(key, args)) return share(target, key, args);
          if (!open()) reads.clear();
          return value.apply(target, args);
        };
      }
      return (...args) => value.apply(target, args);
    },
  });
  return { doc: shared, close };
}

// Lance ensemble les lectures de la structure que le démarrage demande ensuite une à une : une seule vague de réseau au lieu de dix. Une lecture refusée
// (l'accès complet n'est pas donné) ne dit rien ici : les étapes qui en ont besoin la redemandent et disent leur refus elles-mêmes.
export function warmStructure(doc) {
  const quiet = read => { try { Promise.resolve(read()).catch(() => {}); } catch (error) { /* rien */ } };
  for (const name of STRUCTURE) quiet(() => doc.fetchTable(name));
  quiet(() => doc.listTables());
  quiet(() => doc.getDocName());
}

// `grist.docApi` tel quel, sauf que sa première écriture (`applyUserActions`) appelle `onWrite()` avant de partir : le moteur de partage écrit par là, sans
// passer par le port, et une lecture du port ne doit pas rendre la structure d'avant ce qu'il vient d'écrire.
export function endOnWrite(docApi, onWrite) {
  return new Proxy(docApi, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== 'function') return value;
      if (key !== 'applyUserActions') return value.bind(target);
      return (...args) => { onWrite(); return value.apply(target, args); };
    },
  });
}
