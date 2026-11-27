// La ligne-sonde restée dans `GFS_Filing` (`@sonde`, contrats 6.4 point 6) : GFS l'ajoute pour apprendre l'adresse de la personne puis la retire sans attendre ; quand la page est refaite
// par Grist entre les deux, ou que l'onglet se ferme, le retrait est perdu et la ligne reste (mesuré dans l'essai des noms, run-noms-gfs.mjs : trois des quatre essais avec Sync+).
// Retour du porteur du 26/11 : « pas au démarrage, mais en tâche de fond une fois que tout est lancé, pendant que l'utilisateur navigue ». Dans un VRAI Grist (`bash vrai-serveur.sh`),
// un document qui porte déjà trois lignes-sondes restées, dont une d'une autre personne, et une ligne de rangement ordinaire :
//   1. à l'ouverture, GFS est prêt SANS avoir touché aux lignes restées (rien n'est retiré au démarrage) ;
//   2. quelques secondes plus tard, en tâche de fond, les lignes de la personne partent d'un seul lot ; la ligne d'une autre personne et la ligne de rangement restent ;
//   3. une seconde ouverture ne laisse aucune ligne de plus, et ne dit rien dans la console.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.   REPO_DIR="$(realpath ../..)" node run-sonde-restee.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { gfsFrame, apply } from './lab-droits.mjs';
import { COLUMNS } from '../js/files/rangement.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const OTHER = 'ben@exemple.org';

// Les lignes de `GFS_Filing` telles que Grist les rend, sans attendre que le document se calme (c'est le calme que l'essai mesure).
const filing = run => run.page.evaluate(async doc => {
  const answer = await (await fetch(`/api/docs/${doc}/tables/GFS_Filing/records`)).json();
  return (answer.records || []).map(record => ({ id: record.id, ...record.fields }));
}, run.docId);
const probes = rows => rows.filter(row => row.User === '@sonde');
// L'heure à laquelle GFS dit « prêt » (`data-gfs="ready"`), notée dans son cadre : le délai du retrait se compte à partir d'elle, pas de l'instant où l'essai la constate (Grist fait
// attendre l'essai jusqu'à 4 s de plus, le temps de sa visite guidée).
const noteReadyAt = page => page.addInitScript(() => {
  if (!/\/prototype\/index\.html/.test(location.pathname)) return;
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
    if (document.body.dataset.gfs === 'ready' && !window.readyAt) window.readyAt = Date.now();
  }).observe(document.body, { attributes: true }));
});

const server = await requireServer();
const pagesServer = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang });

  say('\n=== Un document qui porte des lignes-sondes restées ===');
  let answer = await apply(run.page, run.docId, [['AddTable', 'GFS_Filing', COLUMNS.map(({ id, type, ...more }) => ({ id, type, ...more }))],
    ['AddRecord', 'GFS_Filing', null, { User: '@sonde' }], ['AddRecord', 'GFS_Filing', null, { User: '@sonde' }]]);
  check('la table du rangement et deux lignes-sondes sont posées (Grist y écrit l\'adresse de la personne d\'essai)', !answer.error, answer);
  const first = await filing(run);
  const me = String((first.find(row => row.User === '@sonde') || {}).Address || '');
  check('Grist a écrit l\'adresse de la personne d\'essai dans les lignes-sondes', /^[^@\s]+@[^@\s]+$/.test(me) && probes(first).length === 2 && probes(first).every(row => row.Address === me), first);
  answer = await apply(run.page, run.docId, [['AddRecord', 'GFS_Filing', null, { User: '@sonde' }], ['AddRecord', 'GFS_Filing', null, { User: me, App: 'publipostage', File: '2', Favorite: true }]]);
  const added = await filing(run);
  const other = probes(added).find(row => !first.some(each => each.id === row.id));
  // Une ligne-sonde d'une autre personne : l'adresse que Grist y a écrite est celle de son auteur ; la valeur se pose à la main pour l'essai (colonne à formule déclenchée, déjà remplie).
  answer = await apply(run.page, run.docId, [['UpdateRecord', 'GFS_Filing', other.id, { Address: OTHER }]]);
  check('une troisième ligne-sonde est à l\'adresse d\'une autre personne', !answer.error && probes(await filing(run)).filter(row => row.Address === OTHER).length === 1, answer);

  say('\n=== 1. À l\'ouverture, rien n\'est retiré ===');
  await noteReadyAt(run.page);
  await run.page.reload({ waitUntil: 'load' });
  await run.page.locator('.test-onboarding-popup').first().waitFor({ timeout: 4000 }).catch(() => {});
  await run.page.keyboard.press('Escape');
  run.frame = await gfsFrame(run.page);
  const readyAt = await run.frame.evaluate(() => window.readyAt);
  const atReady = probes(await filing(run));
  say(`   GFS prêt depuis ${Date.now() - readyAt} ms ; lignes-sondes à ce moment :`, atReady.length);
  check('GFS est prêt avec les deux lignes de la personne encore là (rien n\'est retiré au démarrage)', atReady.filter(row => row.Address === me).length >= 2, atReady);

  say('\n=== 2. En tâche de fond, quelques secondes plus tard ===');
  let gone = null;
  for (let waited = 0; waited < 25000 && gone === null; waited += 500) {
    await run.page.waitForTimeout(500);
    if (!probes(await filing(run)).some(row => row.Address === me)) gone = Date.now() - readyAt;
  }
  say('   lignes de la personne parties', gone === null ? 'jamais (25 s)' : `${gone} ms après le « prêt » de GFS`);
  const after = await filing(run);
  check('les lignes-sondes de la personne sont parties, en tâche de fond (délai de 8 s après le « prêt », pas plus de 15 s)', gone !== null && gone >= 7500 && gone < 15000, { gone });
  check('la ligne-sonde d\'une autre personne reste (elle la retirera à son tour)', probes(after).length === 1 && probes(after)[0].Address === OTHER, probes(after));
  check('la ligne de rangement ordinaire reste', after.some(row => row.User === me && row.App === 'publipostage' && row.Favorite === true), after);

  say('\n=== 3. Une seconde ouverture ne laisse rien de plus ===');
  await run.page.reload({ waitUntil: 'load' });
  await run.page.locator('.test-onboarding-popup').first().waitFor({ timeout: 4000 }).catch(() => {});
  await run.page.keyboard.press('Escape');
  run.frame = await gfsFrame(run.page);
  await run.page.waitForTimeout(12000);
  const again = await filing(run);
  check('toujours la seule ligne-sonde de l\'autre personne, la ligne de rangement et aucune ligne de plus', probes(again).length === 1 && again.length === after.length, again);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pagesServer.close();
}
