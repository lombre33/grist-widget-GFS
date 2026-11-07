// Le port de GFS pour le moteur de partage entre deux documents (kit/js/synchro/, repris de Sync+) : tout ce que le moteur demande à l'extérieur (kit/js/synchro/port.js, `PORT_SHAPE`), rempli avec ce que
// GFS a déjà. Le moteur ne parle jamais à Grist, à la page ni à la langue autrement que par cet objet.
//   - les lignes et le schéma : l'API des widgets, `grist.docApi` (celle qui décode les valeurs : le moteur lit des valeurs décodées, pas la forme brute du courtier) ;
//   - tout le REST (SQL, comparaison d'états, pièces jointes, webhooks, envois à l'adresse d'un webhook, lecture publique) : le cadre d'envoi de GFS (js/transfer.js), seul à pouvoir sortir vers le serveur
//     (la page de GFS n'a pas le droit de se connecter ailleurs qu'à elle-même ; contrats 6.6, points 14 et 15). Les requêtes anonymes ne vont qu'au serveur du document ;
//   - la langue, la page et les deux petites valeurs du navigateur : ceux de GFS, préfixe `gfs.synchro.`.
// Rien n'est lu à l'import : `createSyncPort` reçoit ses dépendances (et ses essais les remplacent). Les tables que le moteur crée portent le préfixe `GFS_`.
import { startEngine } from '../kit/js/synchro/index.js';
import { maskKey, parseDocBaseUrl } from '../kit/js/synchro/logic/codes.js';
import { parseJson, toRows } from '../kit/js/synchro/logic/common.js';
import { schemaFrom } from '../kit/js/synchro/logic/schema.js';
import { TransferError } from './transfer.js';
import { createEngineText } from './sync-port-text.js';

export const SYNC_PREFIX = 'GFS_';
const PREF_PREFIX = 'gfs.synchro.';
const NOTICE_MS = 10 * 1000; // l'avis de fin envoyé juste avant d'effacer un webhook : un lien mort ou lent ne retient pas l'effacement

// Une erreur du cadre d'envoi, dite comme le moteur la lit : un refus du serveur garde son code et ce que Grist en dit (sans jamais montrer une clé de formulaire en entier), le reste est dit dans la
// langue de la personne. `kind` : voir TransferError.
function engineError(error, text) {
  if (!(error instanceof TransferError)) return error;
  if (error.kind === 'http') return new Error(maskKey(`HTTP ${error.status} ${error.message}`));
  return new Error(text(`error.transfer.${error.kind}`));
}

// Les deux façons de parler au serveur, avec leurs erreurs dites : `json` (REST avec jeton : rend le corps, null s'il est vide ; le refus 403 est celui des propriétaires seuls) et `guard` (n'importe quel
// autre travail du cadre : pièces jointes, envois anonymes).
function senders(transfer, text) {
  const guard = async job => {
    try { return await job(); } catch (error) { throw engineError(error, text); }
  };
  const json = async (method, path, body) => {
    try {
      const { body: answer } = await transfer.rest(method, path, { body });
      return answer === '' ? null : answer;
    } catch (error) {
      if (error instanceof TransferError && error.kind === 'http' && error.status === 403) throw new Error('ownerOnly');
      throw engineError(error, text);
    }
  };
  return { guard, json };
}

// Les lignes et le schéma du document, l'identité, les droits, les lectures SQL et la comparaison d'états.
function dataPort({ docApi, transfer }, { json }, text) {
  const fetchRows = async tableId => toRows(await docApi.fetchTable(tableId));
  const querySql = async query => {
    try { return await transfer.sql(query, { writable: true }); } catch (error) { return null; }
  };
  let owner = null;
  return {
    fetchRows,
    // Une liste vide n'est pas envoyée à Grist.
    apply: actions => (actions.length ? docApi.applyUserActions(actions) : { retValues: [] }),
    async readSchema() {
      const [tables, columns] = await Promise.all([fetchRows('_grist_Tables'), fetchRows('_grist_Tables_column')]);
      return schemaFrom(tables, columns);
    },
    // Quelques colonnes d'une table, lues en SQL (bien plus léger qu'une table entière aux grosses cellules) ; null si Grist refuse. `where` : { colonne: valeur }, des noms que le moteur écrit.
    selectRows(tableId, colIds, where = {}) {
      const test = Object.entries(where).map(([column, value]) => `"${column}" = '${String(value).replace(/'/g, "''")}'`).join(' and ');
      return querySql(`select ${['id', ...colIds].map(column => `"${column}"`).join(', ')} from "${tableId}"${test ? ` where ${test}` : ''}`);
    },
    querySql,
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
    docChanges: since => documentChanges(transfer, since),
  };
}

// La réponse de la comparaison : l'état actuel et, si le départ est connu et qu'aucune table n'a été renommée, les tables touchées.
function changesOf(body, from) {
  const { right, details } = body;
  const delta = (details || {}).rightChanges;
  const known = from && delta && !(delta.tableRenames || []).length;
  return { hash: right.h, tables: known ? new Set(Object.keys(delta.tableDeltas || {})) : null };
}

// Ce qui a changé dans le document depuis l'état `since` : l'état actuel (`hash`) et les tables touchées (`tables`, null si on ne peut pas le dire), par la comparaison de deux états de Grist
// (GET /compare). Null si Grist refuse (elle est réservée à qui peut tout lire).
async function documentChanges(transfer, since) {
  const read = async left => {
    try {
      return await transfer.rest('GET', '/compare', { params: { left, right: 'HEAD', maxRows: 1 } });
    } catch (error) {
      if (error instanceof TransferError && error.kind === 'http') return { status: error.status, body: null };
      throw error;
    }
  };
  try {
    let answer = await read(since || 'HEAD');
    if ([401, 403].includes(answer.status)) return null;
    // Un état que Grist ne connaît plus (500 « Cannot read hash » dans la 1.7.19) : on relit depuis HEAD pour avoir l'état actuel, mais la liste des tables touchées n'est plus celle d'un vrai départ. Elle serait vide
    // (HEAD contre HEAD) et dirait « rien n'a changé » : on la rend nulle, comme Sync+ le fait sans état de départ (le moteur relit tout).
    let from = since;
    if (answer.status >= 400 && since) { answer = await read('HEAD'); from = ''; }
    if (answer.status >= 400) return answer.status === 404 ? null : { hash: since, tables: null };
    return changesOf(answer.body, from);
  } catch (error) {
    return { hash: since, tables: null };
  }
}

// Les pièces jointes : le contenu en octets, et le dépôt d'un fichier (rend son numéro).
function filesPort({ transfer }, { guard }) {
  return {
    async downloadAttachment(id) {
      const blob = await guard(() => transfer.download(Number(id)));
      return new Uint8Array(await blob.arrayBuffer());
    },
    uploadAttachment: (name, bytes) => guard(() => transfer.upload(new Blob([bytes]), name)),
  };
}

// Les webhooks du document (propriétaires seulement) et les envois directs à leur adresse. Un envoi anonyme ne va qu'à l'instance du document.
function hooksPort({ transfer }, { guard, json }, data) {
  const postRows = async (url, rows, timeout) => {
    if (new URL(url).origin !== (await data.docIdentity()).origin) throw new Error('otherInstance');
    await guard(() => transfer.anonymous('POST', url, { body: rows, timeout }));
  };
  const clearOne = id => json('DELETE', `/webhooks/queue/${encodeURIComponent(id)}`);
  const remove = async id => {
    // Effacer un webhook ne coupe pas l'envoi que Grist retente pour lui, qui garderait la file de tout le document : on vide d'abord sa file (une instance qui n'a pas cette route l'ignore).
    await clearOne(id).catch(() => {});
    return json('DELETE', `/webhooks/${encodeURIComponent(id)}`);
  };
  // La condition de chaque webhook (le texte de la formule), par identifiant : Grist la garde dans _grist_Triggers avec l'identifiant du webhook.
  const webhookConditions = async () => {
    const conditions = new Map();
    for (const trigger of await data.fetchRows('_grist_Triggers')) {
      const condition = (parseJson(trigger.condition || '{}') || {}).text || '';
      const actions = parseJson(trigger.actions || '[]');
      for (const action of Array.isArray(actions) ? actions : []) if (action && action.type === 'webhook') conditions.set(action.id, condition);
    }
    return conditions;
  };
  const postToHook = (hook, rows, timeout) => postRows(hook.fields.url, rows, timeout);
  return {
    postRows,
    postToHook,
    webhookConditions,
    deleteWebhook: remove,
    listWebhooks: async () => (await json('GET', '/webhooks')).webhooks,
    // Un webhook par destinataire, filtré par `condition` (une formule que Grist évalue sur chaque ligne). Grist l'accepte depuis la 1.7.11 : une instance plus ancienne refuse le champ ou l'ignore, donc
    // la condition enregistrée est relue, et le webhook effacé si elle manque (il recevrait tout).
    async createWebhook({ name, memo, url, tableId, condition }) {
      let result;
      try {
        result = await json('POST', '/webhooks', { webhooks: [{ fields: { name, memo, url, tableId, condition, eventTypes: ['add', 'update'], enabled: true, isReadyColumn: null } }] });
      } catch (error) {
        throw /condition/i.test(error.message) ? new Error('gristTooOld') : error;
      }
      const id = result.webhooks[0].id;
      if ((await webhookConditions()).get(id) !== condition) {
        await remove(id).catch(() => {});
        throw new Error('gristTooOld');
      }
      return id;
    },
    setWebhookEnabled: (id, enabled) => json('PATCH', `/webhooks/${encodeURIComponent(id)}`, { enabled }),
    // Le dernier envoi direct à l'adresse du webhook, puis son effacement ; un lien mort ou trop lent ne retient pas l'effacement.
    async deleteWebhookWithNotice(hook, rows) {
      await postToHook(hook, rows, NOTICE_MS).catch(() => {});
      await remove(hook.id);
    },
    clearWebhookQueue: () => json('DELETE', '/webhooks/queue'),
  };
}

// Un document public, lu sans identifiant (`filter` : { colonne: [valeurs] }) : « publicClosed » si Grist refuse, ne répond pas, ou si l'adresse n'est pas celle du serveur du document.
function publicPort({ transfer }) {
  return {
    async publicRecords(base, tableId, filter) {
      try {
        const { body } = await transfer.anonymous('GET', `${base}/tables/${tableId}/records?filter=${encodeURIComponent(JSON.stringify(filter))}`);
        return (body && body.records) || [];
      } catch (error) {
        throw new Error('publicClosed');
      }
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
  const sender = senders(transfer, text);
  const context = { docApi, transfer };
  const data = dataPort(context, sender, text);
  return {
    ...data,
    ...filesPort(context, sender),
    ...hooksPort(context, sender, data),
    ...publicPort(context),
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
