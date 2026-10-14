// Le courtier : exécute les appels d'une app (contrats 4.3) comme ses propres appels à Grist, après le filtre. Il ne retransmet aucun
// message : il lit l'appel, le contrôle, appelle Grist par sa propre connexion et rend sa propre réponse (contrats 1.1, point 3).
//
// `port` donne les trois interfaces de Grist sous leur forme brute : { doc, view, widget }. Les appels de lecture de lignes passent par les
// interfaces brutes et non par `grist.docApi` : celle-ci décode côté widget, et l'app décode déjà de son côté (un second décodage abîmerait
// les valeurs).

import { ERR, Refus, levelOf, checkBatch, readRefusal, visibleTables, cleanApplyOptions, batchTouchesTables, batchCreatesSection,
  realNameRefusal, tokenOptions } from './filter.js';
import { sliceOf, optionOf, checkKey, planSetOptions, planClear } from './options-slice.js';

export function createPort(grist) {
  return {
    doc: grist.rpc.getStub('GristDocAPI@grist'),
    view: grist.rpc.getStub('GristView'),
    widget: grist.rpc.getStub('WidgetAPI'),
  };
}

function requireLevel(level, minimum, message) {
  if (levelOf(level) < levelOf(minimum)) {
    throw new Refus(ERR.ACCES, message || `Access not granted. Current access level ${level}`);
  }
}

// Le niveau minimal de chaque méthode : celui que Grist exige de GFS (contrats 4.3).
function minimumLevel(iface, meth) {
  if (iface === 'GristDocAPI') return meth === 'getDocName' ? 'read table' : 'full';
  if (iface === 'GristView') return 'read table';
  return 'none';
}

const fail = (code, message) => { throw new Refus(code, message); };
const guardWrite = env => { if (env.readonly) fail(ERR.LECTURE_SEULE, 'Document ouvert en lecture seule.'); };

// Les identifiants réels des tables et la correspondance numéro de ligne -> identifiant, lus dans _grist_Tables (aucune ligne retirée).
async function tableMap(port) {
  const data = await port.doc.fetchTable('_grist_Tables');
  const map = new Map();
  (data.id || []).forEach((rowId, i) => map.set(rowId, data.tableId[i]));
  return map;
}
const realIds = async port => [...(await tableMap(port)).values()].filter(Boolean);

// Après un lot qui crée ou renomme une table : l'identifiant que Grist a vraiment donné est contrôlé (contrats 3.3, point 4). Une table
// créée qui n'est pas permise est retirée ; une table renommée vers un nom interdit retrouve son nom.
async function verifyNames(env, before, actions) {
  const after = await realIds(env.port);
  const bad = after.filter(id => !before.includes(id) && realNameRefusal(env.policy, id));
  if (!bad.length) return;
  const renames = actions.filter(a => a[0] === 'RenameTable' && before.includes(a[1]) && !after.includes(a[1])).map(a => a[1]);
  const undo = bad.map(id => (renames.length ? ['RenameTable', id, renames.shift()] : ['RemoveTable', id]));
  await env.port.doc.applyUserActions(undo, {});
  fail(ERR.REFUSE, `Grist a donné à une table le nom ${bad.join(', ')}, qui n'est pas permis à cette app : la table est retirée ou retrouve son nom.`);
}

async function applyActions(env, [actions, options]) {
  guardWrite(env);
  const ctx = Array.isArray(actions) && batchCreatesSection(actions) ? { tableRefs: await tableMap(env.port) } : {};
  const verdict = checkBatch(env.policy, actions, ctx);
  if (!verdict.ok) fail(ERR.REFUSE, `Action ${verdict.rank + 1} refusée : ${verdict.reason}`);
  const watch = batchTouchesTables(actions);
  const before = watch ? await realIds(env.port) : null;
  const result = await env.port.doc.applyUserActions(actions, cleanApplyOptions(options));
  if (watch) await verifyNames(env, before, actions);
  return result;
}

function docHandlers(env) {
  const { policy, port } = env;
  return {
    getDocName: () => port.doc.getDocName(),
    listTables: async () => visibleTables(policy, await port.doc.listTables()),
    fetchTable: async ([tableId]) => {
      const why = typeof tableId === 'string' ? readRefusal(policy, tableId) : 'Un nom de table est attendu.';
      if (why) fail(ERR.REFUSE, why);
      return port.doc.fetchTable(tableId);
    },
    applyUserActions: args => applyActions(env, args),
    getAccessToken: async ([options]) => {
      if (!policy.jeton) fail(ERR.REFUSE, 'Le jeton d\'accès n\'est pas déclaré dans le manifeste (permissions.jeton).');
      return port.doc.getAccessToken(tokenOptions(policy, options));
    },
  };
}

function viewHandlers(env) {
  const { port, level } = env;
  const columns = options => {
    const wanted = options && options.includeColumns;
    if (wanted && wanted !== 'shown') {
      requireLevel(level, 'full', `Setting includeColumns to ${wanted} requires full access. Current access level is ${level}`);
    }
  };
  return {
    fetchSelectedTable: async ([options]) => { columns(options); return port.view.fetchSelectedTable(options || {}); },
    fetchSelectedRecord: async ([rowId, options]) => { columns(options); return port.view.fetchSelectedRecord(rowId, options || {}); },
    allowSelectBy: () => port.view.allowSelectBy(),
    setSelectedRows: ([rowIds]) => port.view.setSelectedRows(rowIds),
    setCursorPos: ([pos]) => port.view.setCursorPos(pos),
  };
}

// Écrire une clé, ou la retirer : Grist garde l'objet en JSON, une valeur indéfinie y disparaît.
const writeKey = (env, key, value) => env.port.widget.setOption(key, value);

function widgetHandlers(env) {
  const { port, declared } = env;
  return {
    getOptions: async () => sliceOf(await port.widget.getOptions(), declared),
    getOption: async ([key]) => optionOf(await port.widget.getOptions(), declared, key),
    setOption: async ([key, value]) => { guardWrite(env); checkKey(declared, key); await writeKey(env, key, value); },
    setOptions: async ([incoming]) => {
      guardWrite(env);
      const plan = planSetOptions(declared, await port.widget.getOptions(), incoming);
      for (const [key, value] of plan.writes) await writeKey(env, key, value);
      for (const key of plan.removes) await writeKey(env, key, undefined);
      if (plan.ignored.length) console.warn(`GFS : setOptions ignore les clés non déclarées : ${plan.ignored.join(', ')}`);
    },
    clearOptions: async () => {
      guardWrite(env);
      for (const key of planClear(declared, await port.widget.getOptions())) await writeKey(env, key, undefined);
    },
  };
}

// `configure` n'est jamais relayé : GFS a déjà demandé son accès pour lui-même (contrats 4.3).
function sectionHandlers(env) {
  return {
    configure: async ([settings]) => { env.onConfigure(settings && typeof settings === 'object' ? settings : {}); },
    mappings: async () => null,
  };
}

export function makeCallHandler(env) {
  const handlers = {
    GristDocAPI: docHandlers(env),
    GristView: viewHandlers(env),
    WidgetAPI: widgetHandlers(env),
    CustomSectionAPI: sectionHandlers(env),
    CommandAPI: { run: () => fail(ERR.REFUSE, 'CommandAPI.run n\'est pas permis en v0.') },
  };
  return async ({ iface, meth, args }) => {
    const methods = Object.hasOwn(handlers, iface) ? handlers[iface] : null;
    if (!methods || !Object.hasOwn(methods, meth)) fail(ERR.INCONNU, `${iface}.${meth} est inconnu de GFS.`);
    requireLevel(env.level, minimumLevel(iface, meth));
    return methods[meth](args);
  };
}
