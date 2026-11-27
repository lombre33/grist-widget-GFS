// Une seule lecture de la structure du document au démarrage (27/11, choix du porteur après la mesure de fluidité ; js/broker/startup-reads.js ; faits vérifiés 197),
// dans un VRAI serveur Grist (Docker 1.7.19, `vrai-serveur.sh`) derrière un relais de latence (`ONE_WAY_MS`, 20 = 40 ms d'aller-retour, 60 = 120 ms), sous Chromium.
// Le même document de deux façons : « partagé » (GFS tel qu'il est) et « témoin » (le partage et le lancement groupé retirés : le démarrage d'avant). Chaque appel que GFS
// fait au document est compté À L'ENTRÉE DE GRIST (un appel qui ne part pas chez Grist ne compte pas), avec l'heure où il part ; la liste visible est datée dans le même cadre.
//   1. Le témoin relit bien la structure plusieurs fois (`_grist_Tables`, `listTables`, `getDocName`) : la mesure a un sens.
//   2. Partagé : chaque table interne et `listTables` partent UNE fois avant la liste visible.
//   3. La liste visible est la même, ligne pour ligne, dans les deux cas.
//   4. La liste apparaît plus tôt qu'avec le témoin (médiane de LAB_RUNS rechargements, de la création du port à la première ligne).
//   5. Aucune erreur ni avertissement de GFS dans la console.
// Le relais : `ONE_WAY_MS=20 node /mnt/project-files/gfs/audits/fluidite-2026-11-27/banc/delai-grist.mjs` (Grist sur 8485 avec APP_HOME_URL=http://127.0.0.1:8484, relais sur 8484).
//   REPO_DIR="$(realpath ../..)" LAB_RUNS=5 node run-lecture-unique.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedFiles } from './seed.mjs';

const RUNS = Number(process.env.LAB_RUNS || 5);
const MIN_GAIN_MS = Number(process.env.LAB_GAIN_MS || 100);
const INTERNAL = ['_grist_Tables', '_grist_Tables_column', '_grist_Views', '_grist_Views_section', '_grist_Pages', '_grist_Attachments'];

// Chaque appel à `GristDocAPI` qui atteint le bord de Grist est noté (nom, table, heure) ; `__t0` : l'heure où le port est créé.
const counting = [
  { fichier: 'broker/broker.js', de: "const doc = grist.rpc.getStub('GristDocAPI@grist');", vers: "const doc = __counted(grist.rpc.getStub('GristDocAPI@grist'));" },
  { fichier: 'broker/broker.js', de: 'export function createPort(grist) {', vers: `function __counted(doc) {
  globalThis.__t0 = performance.now();
  globalThis.__reads = [];
  return new Proxy(doc, { get(target, key) {
    const value = target[key];
    if (typeof value !== 'function') return value;
    return (...args) => {
      globalThis.__reads.push({ m: String(key), a: typeof args[0] === 'string' ? args[0] : '', at: performance.now() });
      return value.apply(target, args);
    };
  } });
}
export function createPort(grist) {` },
];
// Le témoin : plus de partage (fenêtre à zéro) et plus de lancement groupé après `ready` : le démarrage d'avant ce lot.
const witness = [
  { fichier: 'broker/startup-reads.js', de: 'export const WINDOW_MS = 3000;', vers: 'export const WINDOW_MS = 0;' },
  { fichier: 'controller.js', de: 'warmStructure(this.port.doc);', vers: '' },
];

const gfsFrame = page => page.frames().find(each => /prototype\/index\.html/.test(each.url()) && /access=full/.test(each.url()));
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

// Un rechargement : de la création du port à la première ligne de la liste, les appels partis chez Grist dans l'intervalle, et les lignes affichées.
async function reload(run) {
  await run.page.reload({ waitUntil: 'load' });
  for (let attempt = 0; attempt < 6; attempt++) {
    let frame = null;
    for (let i = 0; i < 120 && !frame; i++) { frame = gfsFrame(run.page); if (!frame) await run.page.waitForTimeout(250); }
    try {
      await frame.waitForFunction(() => document.querySelector('.ls-row'), null, { polling: 'raf', timeout: 60000 });
      const shown = await frame.evaluate(() => performance.now());
      await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
      return await frame.evaluate(shownAt => {
        const all = globalThis.__reads || [];
        const reads = all.filter(read => read.at <= shownAt);
        // « avant la liste » : avant la première lecture d'une table de la personne (les fichiers), c'est-à-dire sur le chemin qui mène aux lignes
        const listRead = all.find(read => read.m === 'fetchTable' && !read.a.startsWith('_grist_'));
        const before = listRead ? all.filter(read => read.at < listRead.at) : reads;
        const count = (method, table) => before.filter(read => read.m === method && (table === undefined || read.a === table)).length;
        return {
          ms: Math.round(shownAt - globalThis.__t0), reads: reads.length, waves: before.length,
          trace: reads.map(read => `${Math.round(read.at - globalThis.__t0)} ${read.m}${read.a ? ` ${read.a}` : ''}`),
          tables: count('listTables'), docName: count('getDocName'),
          internal: Object.fromEntries(['_grist_Tables', '_grist_Tables_column', '_grist_Views', '_grist_Views_section', '_grist_Pages', '_grist_Attachments']
            .map(name => [name, count('fetchTable', name)])),
          rows: [...document.querySelectorAll('.ls-row')].map(row => row.textContent.replace(/\s+/g, ' ').replace(/(Auj\.|Hier|\d{1,2}\/\d{1,2}) ?\d{0,2}:?\d{0,2}$/, '').trim()).sort(),
        };
      }, shown);
    } catch (error) { await run.page.waitForTimeout(500); }
  }
  throw new Error('La liste de GFS ne s\'est pas affichée après le rechargement.');
}

async function measure(context, patches, label) {
  const run = await openGfs(context, { mirrors: true, patches });
  await seedFiles(run.frame, {});
  const results = [];
  await reload(run); // un premier passage pour chauffer le cache (le code de GFS est servi par un serveur local)
  for (let i = 0; i < RUNS; i++) results.push(await reload(run));
  say(`${label} : ${results.map(each => `${each.ms} ms`).join(', ')} (médiane ${median(results.map(each => each.ms))} ms)`);
  return { run, results };
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  say('--- témoin : le démarrage d\'avant ---');
  const before = await measure(context, [...counting, ...witness], 'témoin');
  say('--- partagé : GFS tel qu\'il est ---');
  const after = await measure(context, counting, 'partagé');

  const last = list => list[list.length - 1];
  if (process.env.LAB_TRACE) { say('partagé :', last(after.results).trace); say('témoin :', last(before.results).trace); }
  const was = last(before.results);
  const now = last(after.results);
  say('lectures parties chez Grist avant la lecture de la liste : témoin', { listTables: was.tables, getDocName: was.docName, ...was.internal, total: was.reads }, '; partagé', { listTables: now.tables, getDocName: now.docName, ...now.internal, total: now.reads });

  say('--- 1. le témoin relit la structure ---');
  check('le témoin lit `_grist_Tables` plus d\'une fois et `listTables` plus d\'une fois', was.internal._grist_Tables > 1 && was.tables > 1, { tables: was.internal._grist_Tables, listTables: was.tables });

  say('--- 2. partagé : une seule lecture de chaque ---');
  for (const each of after.results) {
    const worst = Math.max(each.tables, each.docName, ...INTERNAL.map(name => each.internal[name]));
    check('chaque table interne et `listTables` partent au plus une fois chez Grist avant la lecture de la liste', worst <= 1, { listTables: each.tables, getDocName: each.docName, ...each.internal });
  }
  check('moins d\'appels en tout chez Grist avant la liste que le témoin', now.reads < was.reads, { témoin: was.reads, partagé: now.reads });

  say('--- 3. la même liste ---');
  check('les mêmes lignes dans la liste, ligne pour ligne', JSON.stringify(now.rows) === JSON.stringify(was.rows), { témoin: was.rows.length, partagé: now.rows.length });
  check('la liste n\'est pas vide', now.rows.length > 0 && now.rows.some(row => row.includes('Contrat de prestation')), now.rows.slice(0, 3));

  say('--- 4. la liste apparaît plus tôt ---');
  const gain = median(before.results.map(each => each.ms)) - median(after.results.map(each => each.ms));
  check(`la liste est visible au moins ${MIN_GAIN_MS} ms plus tôt (médianes, de la création du port à la première ligne)`, gain >= MIN_GAIN_MS, `${gain} ms`);

  say('--- 5. la console ---');
  for (const [label, run] of [['témoin', before.run], ['partagé', after.run]]) {
    const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
    check(`${label} : aucune erreur ni avertissement inattendu de GFS`, unexpected.length === 0, unexpected);
  }
} finally {
  await browser.close();
  pages.close();
}
