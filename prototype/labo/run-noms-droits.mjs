// Qui peut renommer les tables d'une app dans un VRAI serveur Grist, et en combien de temps : le lot de renommage de la vraie Publipostage+ envoyé par un propriétaire, un éditeur et un lecteur, dans un
// document ouvert et dans un document dont GFS a fermé la structure (« Partager », contrats 11.4 : `user.Access != OWNER` → `-S`), puis sa durée sur un gros document. Le serveur d'essai ne connaît qu'une
// personne à la fois (voir `vrai-serveur.sh`) : trois temps, un serveur relancé entre chaque.
//   bash vrai-serveur.sh                                  && PHASE=proprietaire REPO_DIR="$(realpath ../..)" node run-noms-droits.mjs   # crée les documents, les partage, mesure la durée
//   GRIST_EMAIL=editor@example.com bash vrai-serveur.sh   && PHASE=editeur      REPO_DIR=… node run-noms-droits.mjs
//   GRIST_EMAIL=viewer@example.com bash vrai-serveur.sh   && PHASE=lecteur      REPO_DIR=… node run-noms-droits.mjs
// `PP_DIR` : la copie de Publipostage+ dont on charge `js/schema-columns.js` (par défaut celle du sous-module, souvent plus ancienne que le sommet de l'app). `GROS` : les lignes du gros document
// (30 000 par défaut, environ 45 Mo). L'état passe par un petit fichier (`NOMS_ETAT`).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { chromium, say, check, constat } from './lab-common.mjs';
import { GRIST, requireServer, newContext, createDocument, docIdOf } from './lab-serveur.mjs';
import { call, apply, rowsOf } from './lab-rest.mjs';
import { planCloseStructure } from '../js/rights/rights-plan.js';

const PHASE = process.env.PHASE || 'proprietaire';
const ETAT = process.env.NOMS_ETAT || '/tmp/noms-droits-etat.json';
const PP_DIR = process.env.PP_DIR || join(process.env.REPO_DIR, 'prototype/apps/publipostage');
const BIG = Number(process.env.GROS || 30000);
const OLD_MODELS = 'Publipostage_Modeles';
const MODELS = 'Publipostage_Templates';

// Le traducteur de l'app tel qu'elle l'écrit : son `planRenames` rend le lot qu'elle enverrait.
function appRegistry() {
  const source = readFileSync(join(PP_DIR, 'js/schema-columns.js'), 'utf8');
  const sandbox = { grist: { docApi: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__SC = SchemaColumns;`, sandbox);
  return sandbox.__SC;
}

// Ce que l'app lit du document pour calculer son lot : les noms des tables et le libellé de chaque colonne.
async function appBatch(run, registry) {
  const tables = await rowsOf(run, '_grist_Tables');
  const columns = await rowsOf(run, '_grist_Tables_column');
  const byRef = new Map(tables.map(row => [row.id, row.tableId]));
  const labels = new Map();
  for (const column of columns) {
    const table = byRef.get(column.parentId);
    if (!table) continue;
    if (!labels.has(table)) labels.set(table, new Map());
    labels.get(table).set(column.colId, column.label);
  }
  return registry.planRenames(new Set(tables.map(row => row.tableId)), id => labels.get(id) || null);
}

const MODEL_COLUMNS = [['Nom', 'Text'], ['Contenu', 'Text'], ['NomFichierPDF', 'Text'], ['DateModif', 'DateTime'], ['TypeModele', 'Text'], ['ModifiePar', 'Text'], ['EstParDefaut', 'Bool'], ['Jeton', 'Text']];
const PREFS_COLUMNS = [['Utilisateur', 'Text'], ['ModeleId', 'Int'], ['Epingle', 'Bool'], ['Dossier', 'Text'], ['Replie', 'Bool']];
const columnsOf = list => list.map(([id, type]) => ({ id, type }));

// Un document aux noms d'avant : les modèles et leurs préférences de Publipostage+, `count` modèles (`size` signes de contenu chacun).
async function seed(page, name, { count = 4, size = 40 } = {}) {
  const path = await createDocument(page);
  const id = docIdOf(path);
  const run = { page, docId: id };
  const first = await apply(run, [['AddTable', OLD_MODELS, columnsOf(MODEL_COLUMNS)], ['AddTable', 'Publipostage_PreferencesModeles', columnsOf(PREFS_COLUMNS)]]);
  if (first.status !== 200) throw new Error(`le document ${name} n'a pas pu être préparé : ${first.text}`);
  const content = 'x'.repeat(size);
  const chunk = Math.max(1, Math.floor(400000 / (size + 40)));
  for (let from = 0; from < count; from += chunk) {
    const n = Math.min(chunk, count - from);
    const answer = await apply(run, [['BulkAddRecord', OLD_MODELS, Array(n).fill(null), {
      Nom: Array.from({ length: n }, (unused, i) => `Modèle ${from + i + 1}`), Contenu: Array(n).fill(content), NomFichierPDF: Array(n).fill(''), DateModif: Array(n).fill(1762000000),
      TypeModele: Array(n).fill('document'), ModifiePar: Array(n).fill(''), EstParDefaut: Array(n).fill(false), Jeton: Array.from({ length: n }, (unused, i) => `j${from + i + 1}`) }]]);
    if (answer.status !== 200) throw new Error(`les lignes de ${name} n'ont pas pu être écrites : ${answer.text}`);
  }
  await apply(run, [['AddRecord', 'Publipostage_PreferencesModeles', null, { Utilisateur: 'essai@example.com', ModeleId: 1, Epingle: true, Dossier: 'Contrats', Replie: false }]]);
  return { name, path, id };
}

// GFS ferme la structure : la règle que pose `planCloseStructure`, lue sur les tables des règles du document.
async function closeStructure(page, doc) {
  const run = { page, docId: doc.id };
  const resources = (await rowsOf(run, '_grist_ACLResources')) || [];
  const rules = (await rowsOf(run, '_grist_ACLRules')) || [];
  const plan = planCloseStructure({ resources, rules });
  if (!plan.ok) throw new Error(`la structure n'a pas pu être fermée : ${plan.reason}`);
  const answer = await apply(run, plan.actions);
  if (answer.status !== 200) throw new Error(`la règle n'a pas été posée : ${answer.text}`);
}

const share = (page, id) => call(page, 'PATCH', `/api/docs/${id}/access`, { delta: { users: { 'editor@example.com': 'editors', 'viewer@example.com': 'viewers' } } });

const server = await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  const page = await context.newPage();
  const registry = appRegistry();
  if (PHASE === 'proprietaire') {
    const docs = {};
    for (const role of ['proprietaire', 'editeur', 'lecteur']) {
      for (const state of ['ouvert', 'ferme']) {
        const doc = await seed(page, `${role}-${state}`);
        if (state === 'ferme') await closeStructure(page, doc);
        say(`   document ${doc.name} : ${doc.id}`, `partage ${(await share(page, doc.id)).status}`);
        docs[doc.name] = doc;
      }
    }
    // la durée du renommage sur un gros document (le propriétaire, sans règle)
    const started = Date.now();
    const big = await seed(page, 'gros', { count: BIG, size: 1500 });
    say(`   gros document : ${BIG} lignes de 1,5 Ko préparées en ${Math.round((Date.now() - started) / 1000)} s`);
    docs.gros = big;
    for (const name of ['proprietaire-ouvert', 'proprietaire-ferme', 'gros']) {
      const run = { page, docId: docs[name].id };
      const batch = await appBatch(run, registry);
      const before = (await rowsOf(run, OLD_MODELS)).length;
      const t0 = Date.now();
      const answer = await apply(run, batch.actions);
      const ms = Date.now() - t0;
      const after = (await rowsOf(run, MODELS) || []).length;
      check(`le propriétaire renomme le document « ${name} » : Grist l'accepte, sans perte (${before} lignes avant, ${after} après), en ${ms} ms`,
        answer.status === 200 && before === after, answer.text);
      if (name === 'gros') constat(`la durée sur ${BIG} lignes (${Math.round(BIG * 1.5 / 1024)} Mo environ) : ${ms} ms`, ms < 5000, ms);
    }
    writeFileSync(ETAT, JSON.stringify(docs));
  } else {
    const docs = JSON.parse(readFileSync(ETAT, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const who = (await call(page, 'GET', '/api/profile/user')).json;
    say(`--- ${PHASE} : ${who && who.email} ---`);
    for (const state of ['ouvert', 'ferme']) {
      const doc = docs[`${PHASE}-${state}`];
      const run = { page, docId: doc.id };
      const info = await call(page, 'GET', `/api/docs/${doc.id}`);
      say(`   document ${doc.name} : accès « ${info.json && info.json.access}  »`, `webhooks ${(await call(page, 'GET', `/api/docs/${doc.id}/webhooks`)).status}`);
      const batch = await appBatch(run, registry);
      say(`   le lot de l'app : ${batch.actions.length} actions`);
      const write = await apply(run, [['AddRecord', OLD_MODELS, null, { Nom: `Écrit par ${PHASE}`, TypeModele: 'document' }]]);
      say(`   écrire une ligne : ${write.status}`);
      const before = ((await rowsOf(run, OLD_MODELS)) || []).length;
      const answer = await apply(run, batch.actions);
      const tables = (await rowsOf(run, '_grist_Tables') || []).map(row => row.tableId);
      say(`   renommer : ${answer.status}`, answer.status === 200 ? '' : answer.text);
      say(`   tables après : ${JSON.stringify(tables.filter(name => /^Publipostage_/.test(name)))}`);
      const renamed = tables.includes(MODELS);
      constat(`${PHASE}, document ${state} : le renommage ${renamed ? 'PASSE' : 'est REFUSÉ'} (statut ${answer.status}), lignes avant ${before}`, true, '');
    }
  }
} finally {
  await browser.close();
}
