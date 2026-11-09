// Le port de GFS pour le moteur de partage entre deux documents (kit/js/synchro/, repris de Sync+) : tout ce que le moteur demande à l'extérieur (kit/js/synchro/port.js, `PORT_SHAPE`), rempli avec ce que
// GFS a déjà. Le moteur ne parle jamais à Grist, à la page ni à la langue autrement que par cet objet.
//   - les lignes et le schéma : l'API des widgets, `grist.docApi` (celle qui décode les valeurs : le moteur lit des valeurs décodées, pas la forme brute du courtier) ;
//   - tout le REST (SQL, comparaison d'états, pièces jointes, webhooks, envois à l'adresse d'un webhook, lecture publique, fiche d'un partage) : écrit une fois par le moteur (`createRestPort`), qui ne
//     demande à GFS que `http`, ci-dessous : le cadre d'envoi de GFS (js/transfer.js), seul à pouvoir sortir vers le serveur (la page de GFS n'a pas le droit de se connecter ailleurs qu'à elle-même ;
//     contrats 6.6, points 14 et 15). Les requêtes anonymes ne vont qu'au serveur du document ;
//   - la langue, la page et les deux petites valeurs du navigateur : ceux de GFS, préfixe `gfs.synchro.`.
// Rien n'est lu à l'import : `createSyncPort` reçoit ses dépendances (et ses essais les remplacent). Les tables que le moteur crée portent le préfixe `GFS_`.
import { startEngine } from '../kit/js/synchro/index.js';
import { parseDocBaseUrl } from '../kit/js/synchro/logic/codes.js';
import { toRows } from '../kit/js/synchro/logic/common.js';
import { schemaFrom } from '../kit/js/synchro/logic/schema.js';
import { createRestPort } from '../kit/js/synchro/rest-port.js';
import { TransferError } from './transfer.js';
import { createEngineText } from './sync-port-text.js';

export const SYNC_PREFIX = 'GFS_';
const PREF_PREFIX = 'gfs.synchro.';
const REFUSAL_CHARS = 200; // ce que le moteur garde du texte d'un refus de Grist

// Une erreur du cadre d'envoi, dite comme le moteur la lit : un refus du serveur garde son code (`status`) et le début de ce que Grist en dit ; le reste (cadre, jeton, réseau, délai, réponse inattendue)
// n'a pas de code et se dit dans la langue de la personne. `kind` : voir TransferError.
function engineError(error, text) {
  if (!(error instanceof TransferError)) return error;
  if (error.kind === 'http') return Object.assign(new Error(String(error.message).slice(0, REFUSAL_CHARS)), { status: error.status });
  return new Error(text(`error.transfer.${error.kind}`));
}

// Le `http` du moteur (kit/js/synchro/rest-port.js) sur le cadre d'envoi : `request` (REST du document, avec le jeton : `full` demande celui qui peut écrire), `anonymous` (sans jeton, au serveur du
// document seulement), `download` et `upload` (octets des pièces jointes) et `docBaseUrl`.
function createHttp(transfer, text) {
  const guard = async job => {
    try { return await job(); } catch (error) { throw engineError(error, text); }
  };
  const answerOf = ({ status, body }) => ({ status, body: body === '' ? null : body });
  return {
    request: async (method, path, { body, params, full = false, timeout } = {}) => answerOf(await guard(() => transfer.rest(method, path, { body, params, writable: full, timeout }))),
    // Une adresse d'un autre serveur que celui du document ne part pas : « otherInstance », que le moteur lit (le cadre le refuse aussi).
    async anonymous(method, url, { body, timeout } = {}) {
      const own = new URL(await guard(() => transfer.baseUrl())).origin;
      if (new URL(url, own).origin !== own) throw new Error('otherInstance');
      return answerOf(await guard(() => transfer.anonymous(method, url, { body, timeout })));
    },
    async download(id) {
      const blob = await guard(() => transfer.download(Number(id)));
      return new Uint8Array(await blob.arrayBuffer());
    },
    upload: (name, bytes) => guard(() => transfer.upload(new Blob([bytes]), name)),
    docBaseUrl: () => guard(() => transfer.baseUrl()),
  };
}

// Les lignes et le schéma du document, son identité et ses droits : ce que seul GFS sait (l'API des widgets, le jeton du propriétaire).
function dataPort({ docApi, transfer }, text) {
  const fetchRows = async tableId => toRows(await docApi.fetchTable(tableId));
  let owner = null;
  return {
    fetchRows,
    // Une liste vide n'est pas envoyée à Grist.
    apply: actions => (actions.length ? docApi.applyUserActions(actions) : { retValues: [] }),
    async readSchema() {
      const [tables, columns] = await Promise.all([fetchRows('_grist_Tables'), fetchRows('_grist_Tables_column')]);
      return schemaFrom(tables, columns);
    },
    // Instance, équipe, identifiant du document et l'adresse REST elle-même, déduits de l'adresse que Grist donne avec tout jeton.
    async docIdentity() {
      const baseUrl = await transfer.baseUrl();
      return { ...parseDocBaseUrl(baseUrl), baseUrl };
    },
    // Seuls les propriétaires lisent la liste des webhooks. Une réponse sûre (vrai ou faux) est gardée ; « Grist n'a pas répondu » ne l'est pas.
    async isOwner() {
      if (owner === null) {
        owner = await transfer.isOwner();
        if (owner === null) throw new Error(text('error.ownerUnknown'));
      }
      return owner;
    },
  };
}

// La page : visible ou non, occupée (une fenêtre ouverte que le rechargement du document fermerait) et ses deux événements ; `env` est la fenêtre (les essais en donnent une fausse).
function pagePort(env, busy) {
  const visible = () => env.document.visibilityState === 'visible';
  return {
    visible,
    busy,
    onShow: callback => env.document.addEventListener('visibilitychange', () => { if (visible()) callback(); }),
    onLeave: callback => env.addEventListener('pagehide', callback),
  };
}

// Les deux petites valeurs du navigateur (la date de la dernière visite d'un document, l'identifiant du navigateur) : jamais une donnée des tables, et le moteur marche sans le stockage.
function prefsPort(env) {
  return {
    read(name) {
      try { return env.localStorage.getItem(PREF_PREFIX + name); } catch (error) { return null; }
    },
    write(name, value) {
      try { env.localStorage.setItem(PREF_PREFIX + name, value); return true; } catch (error) { return false; }
    },
  };
}

// deps : { docApi (grist.docApi), transfer (js/transfer.js), language () -> 'fr' | 'en', busy () -> booléen, env (la fenêtre : par défaut `globalThis`) }.
export function createSyncPort({ docApi, transfer, language = () => 'fr', busy = () => false, env = globalThis }) {
  const text = createEngineText(language);
  const data = dataPort({ docApi, transfer }, text);
  const rest = createRestPort({ docApi: { fetchRows: data.fetchRows }, http: createHttp(transfer, text) });
  return {
    ...rest,
    ...data,
    // Une seule exécution à la fois sous ce nom, tous les onglets du navigateur confondus (sans verrous possibles : tout de suite).
    withLock: (name, job) => (env.navigator && env.navigator.locks ? env.navigator.locks.request(name, job) : job()),
    text,
    page: pagePort(env, busy),
    prefs: prefsPort(env),
  };
}

// Branche le moteur sur ce port, avec le préfixe de tables de GFS ; refuse un port incomplet. Un seul moteur par page.
export function startSyncEngine(deps) {
  const port = createSyncPort(deps);
  startEngine({ port, prefix: SYNC_PREFIX });
  return port;
}
