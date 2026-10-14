// La sonde pour un vrai Grist (cahier 9, points 6 et 10 ; contrats 9, points 5 et 7) : ce que seule une instance réelle peut dire. Un widget de test que la personne ajoute à un
// document de test, en accès complet :
//   1. la lecture (rien n'est modifié) : le jeton de `getAccessToken` et l'API REST, depuis la page puis depuis un sous-cadre isolé (origine opaque), les tables internes du
//      document, le niveau de schéma ;
//   2. l'écriture, seulement si la personne la demande : une table d'essai, les actions que GFS laisse passer, puis la table est supprimée.
// Le résultat est un texte à coller. Le jeton n'y figure jamais ; l'identifiant du document non plus.
import { SANDBOX } from '../../js/frames.js';

/* global grist */
const rest = window.GFSRest;
const TABLE = 'Sonde_GFS_essai';
const RENAMED = 'Sonde_GFS_essai_bis';
const FRAME_TIMEOUT_MS = 20000;
const $ = id => document.getElementById(id);
const state = { acces: null, tables: null, lecture: [], ecriture: [], version: '' };

const json = value => JSON.stringify(value);
const redact = url => String(url).replace(/(\/api\/docs\/)[^/?#]+/, '$1<id du document>');
const cut = (text, size = 150) => (text.length > size ? `${text.slice(0, size)}…` : text);

async function attempt(fn) {
  try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, erreur: rest.describe(error) }; }
}
const outcome = result => (result.ok ? result.value : { erreur: result.erreur });

// ----- Le compte rendu : des lignes « nom : valeur », par section.
function add(section, nom, valeur) {
  state[section].push({ nom, valeur });
  render(section);
}
function render(section) {
  const body = $(section).tBodies[0];
  body.textContent = '';
  for (const { nom, valeur } of state[section]) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const value = document.createElement('td');
    name.textContent = nom;
    value.textContent = typeof valeur === 'string' ? valeur : json(valeur);
    value.className = 'mono';
    tr.append(name, value);
    body.append(tr);
  }
  renderReport();
}

function origin() {
  try { return new URL(document.referrer).origin; } catch (error) { return '(inconnue)'; }
}

function report() {
  const lines = (entries, empty) => (entries.length ? entries.map(({ nom, valeur }) => `   ${nom} : ${typeof valeur === 'string' ? valeur : cut(json(valeur), 400)}`) : [`   ${empty}`]);
  return [
    `Sonde GFS dans un vrai Grist : ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC)`,
    `Instance : ${origin()}   Version de Grist (donnée par la personne) : ${state.version.trim() || '(non donnée)'}`,
    `Navigateur : ${navigator.userAgent}`,
    `Accès accordé à la sonde : ${state.acces || '(inconnu)'} ; tables de l'utilisateur : ${state.tables === null ? '(non lues)' : state.tables.length}`,
    '',
    '1. Lecture', ...lines(state.lecture, '(pas lancée)'),
    '',
    '2. Écriture dans une table d\'essai', ...lines(state.ecriture, '(pas lancée)'),
  ].join('\n');
}
function renderReport() { $('rapport').value = report(); }

// ----- 1. La lecture.
function inFrame(token) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    const done = value => { clearTimeout(timer); window.removeEventListener('message', onMessage); frame.remove(); resolve(value); };
    const timer = setTimeout(() => done({ erreur: 'le cadre n\'a pas répondu' }), FRAME_TIMEOUT_MS);
    function onMessage(event) {
      if (event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === 'gfs-reel-pret') frame.contentWindow.postMessage({ type: 'gfs-reel-requetes', baseUrl: token.baseUrl, token: token.token }, '*');
      if (event.data.type === 'gfs-reel-resultats') done({ origine: event.data.origine, resultats: event.data.resultats });
    }
    window.addEventListener('message', onMessage);
    frame.setAttribute('sandbox', SANDBOX);
    frame.setAttribute('title', 'Cadre isolé de la sonde');
    frame.hidden = true;
    frame.src = 'cadre.html?v=1';
    document.body.append(frame);
  });
}

function addBattery(label, results) {
  if (results.erreur && !results.resultats) { add('lecture', label, results); return; }
  for (const [nom, valeur] of Object.entries(results.resultats || results)) add('lecture', `${label} › ${nom}`, valeur);
}

async function runRead() {
  $('lecture-lancer').disabled = true;
  state.lecture = [];
  const schema = await attempt(async () => (await grist.docApi.fetchTable('_grist_DocInfo')).schemaVersion[0]);
  add('lecture', 'niveau de schéma du document (_grist_DocInfo.schemaVersion)', outcome(schema));
  const token = await attempt(() => grist.docApi.getAccessToken({ readOnly: true }));
  if (!token.ok) {
    add('lecture', 'getAccessToken', outcome(token));
  } else {
    add('lecture', 'jeton', { adresse: redact(token.value.baseUrl), dureeMs: token.value.ttlMs });
    addBattery(`depuis la page de la sonde (origine ${window.origin})`, { resultats: await rest.battery(token.value) });
    const framed = await inFrame(token.value);
    addBattery(`depuis un cadre isolé (origine ${framed.origine || 'inconnue'})`, framed);
  }
  $('lecture-lancer').disabled = false;
}

// ----- 2. L'écriture : les actions de la liste fermée de GFS (contrats 3.3, point 2), sur une table d'essai.
function context() {
  const ctx = { table: null, tableRef: null, created: [] };
  ctx.ua = async (actions, options) => {
    const result = await grist.docApi.applyUserActions(actions, options);
    const values = Array.isArray(result) ? result : (result && result.retValues) || [];
    return { values, text: cut(json(values), 140) };
  };
  ctx.step = async (actions, options) => (await ctx.ua(actions, options)).text;
  return ctx;
}

const STEPS = [
  ['AddTable', async ctx => {
    const { values, text } = await ctx.ua([['AddTable', TABLE, [{ id: 'A', type: 'Text' }, { id: 'N', type: 'Numeric' }]]]);
    ctx.table = values[0].table_id;
    ctx.tableRef = values[0].id;
    ctx.created.push(ctx.table);
    return text;
  }],
  ['AddRecord', ctx => ctx.step([['AddRecord', ctx.table, null, { A: 'un', N: 1 }]])],
  ['BulkAddRecord', ctx => ctx.step([['BulkAddRecord', ctx.table, [null, null], { A: ['deux', 'trois'], N: [2, 3] }]])],
  ['UpdateRecord', ctx => ctx.step([['UpdateRecord', ctx.table, 1, { N: 10 }]])],
  ['BulkUpdateRecord', ctx => ctx.step([['BulkUpdateRecord', ctx.table, [2, 3], { N: [20, 30] }]])],
  ['AddOrUpdateRecord', ctx => ctx.step([['AddOrUpdateRecord', ctx.table, { A: 'un' }, { N: 11 }, {}]])],
  ['BulkAddOrUpdateRecord', ctx => ctx.step([['BulkAddOrUpdateRecord', ctx.table, { A: ['deux', 'quatre'] }, { N: [21, 4] }, {}]])],
  ['RemoveRecord', ctx => ctx.step([['RemoveRecord', ctx.table, 1]])],
  ['BulkRemoveRecord', ctx => ctx.step([['BulkRemoveRecord', ctx.table, [2, 3]]])],
  ['AddColumn', ctx => ctx.step([['AddColumn', ctx.table, 'B', { type: 'Text' }]])],
  ['AddVisibleColumn', ctx => ctx.step([['AddVisibleColumn', ctx.table, 'C', { type: 'Text' }]])],
  ['AddHiddenColumn', ctx => ctx.step([['AddHiddenColumn', ctx.table, 'D', { type: 'Text' }]])],
  ['RemoveColumn', ctx => ctx.step([['RemoveColumn', ctx.table, 'D']])],
  ['SetDisplayFormula', async ctx => {
    const { values } = await ctx.ua([['AddColumn', ctx.table, 'R', { type: `Ref:${ctx.table}` }]]);
    return ctx.step([['SetDisplayFormula', ctx.table, null, values[0].colRef, '$R.A']]);
  }],
  ['CreateViewSection', ctx => ctx.step([['CreateViewSection', ctx.tableRef, 0, 'record', null, null]])],
  ['RenameTable', async ctx => {
    const text = await ctx.step([['RenameTable', ctx.table, RENAMED]]);
    const names = await grist.docApi.listTables();
    const renamed = names.find(name => name.toLowerCase() === RENAMED.toLowerCase());
    if (renamed) { ctx.created.splice(ctx.created.indexOf(ctx.table), 1, renamed); ctx.table = renamed; }
    return `${text} ; ensuite listTables rend ${json(names.filter(name => /^Sonde_GFS/i.test(name)))}`;
  }],
  ['options de applyUserActions : desc et parseStrings', ctx => ctx.step([['AddRecord', ctx.table, null, { N: '12' }]], { desc: 'Essai de GFS', parseStrings: true })],
  ['options de applyUserActions : otherId et linkId', ctx => ctx.step([['AddRecord', ctx.table, null, { N: 13 }]], { otherId: 0, linkId: 0 })],
  ['options de applyUserActions : une clé inconnue', ctx => ctx.step([['AddRecord', ctx.table, null, { N: 14 }]], { cleInconnue: 1 })],
  ['nom normalisé : « _Sonde éé 1 »', async ctx => {
    const { values, text } = await ctx.ua([['AddTable', '_Sonde éé 1', [{ id: 'A', type: 'Text' }]]]);
    ctx.created.push(values[0].table_id);
    return `identifiant rendu « ${values[0].table_id} » ; ${text}`;
  }],
];

async function cleanup(ctx, before) {
  const present = await grist.docApi.listTables();
  for (const name of ctx.created.filter(created => present.includes(created))) {
    add('ecriture', `RemoveTable ${name}`, outcome(await attempt(() => ctx.step([['RemoveTable', name]]))));
  }
  const after = await grist.docApi.listTables();
  add('ecriture', 'tables du document après le nettoyage', { avant: before.length, apres: after.length, identiques: json([...before].sort()) === json([...after].sort()) });
}

async function runWrite() {
  $('ecriture-lancer').disabled = true;
  state.ecriture = [];
  const before = await grist.docApi.listTables();
  const ctx = context();
  try {
    for (const [nom, step] of STEPS) {
      add('ecriture', nom, outcome(await attempt(() => step(ctx))));
      if (nom === 'AddTable' && !ctx.table) break;
    }
  } finally {
    await cleanup(ctx, before);
    $('ecriture-lancer').disabled = false;
  }
}

// ----- La fenêtre de confirmation : rien n'est écrit sans elle.
function askConsent() {
  const dialog = $('consent');
  dialog.showModal();
  $('consent-oui').focus();
}

async function copy() {
  const status = $('copie-etat');
  try {
    await navigator.clipboard.writeText(report());
    status.textContent = 'Copié.';
  } catch (error) {
    $('rapport').select();
    status.textContent = document.execCommand('copy') ? 'Copié.' : 'Copie refusée : sélectionne le texte ci-dessous et copie-le.';
  }
}

async function readTables() {
  const tables = await attempt(() => grist.docApi.listTables());
  state.tables = tables.ok ? tables.value : null;
  renderReport();
}

function start() {
  grist.ready({ requiredAccess: 'full' });
  // Grist donne le niveau d'accès avec les réglages ; les tables ne se lisent qu'une fois l'accès complet accordé.
  grist.onOptions((options, interaction) => {
    state.acces = interaction && interaction.accessLevel;
    renderReport();
    if (state.acces === 'full') void readTables();
  });
  $('instance').textContent = origin();
  $('lecture-lancer').addEventListener('click', runRead);
  $('ecriture-lancer').addEventListener('click', askConsent);
  $('consent-oui').addEventListener('click', () => { $('consent').close(); void runWrite(); });
  $('consent-non').addEventListener('click', () => $('consent').close());
  $('version').addEventListener('input', event => { state.version = event.target.value; renderReport(); });
  $('copier').addEventListener('click', copy);
  renderReport();
}

start();
