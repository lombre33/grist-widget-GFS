// Les lectures SQL que le serveur refuse (faits vérifiés 173), jouées dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400. Retour du porteur sur la DINUM : à chaque rechargement de
// l'explorateur, la console reçoit deux comptes de lignes refusés par Grist (403, en-têtes CORS lus), puis la lecture de la structure et celle du poids refusées par le pare-feu (403 sans en-tête CORS). Ici :
//   1. un document à règles d'accès (Grist refuse `/sql` au jeton en lecture seule) qui porte les tables de Publipostage+ sous les deux jeux de noms (les comptes de lignes partent), derrière un « pare-feu » qui
//      refuse, sans en-tête CORS, les formes que la sonde du porteur a vues refusées (`substr(`, deux sous-requêtes ; la règle réelle n'est pas connue : ce répondeur n'est qu'une doublure du pare-feu,
//      Grist, lui, est le vrai) ;
//   2. un document sans règle derrière un « pare-feu » qui refuserait toute lecture de la structure : les comptes de lignes passent, la structure est bloquée ;
//   3. un document sans règle derrière le pare-feu tel que la DINUM l'a mesuré : la structure (forme `NOT LIKE`) passe, la lecture légère sert à chaque chargement.
// Chaque passe recharge la page trois fois et relève, pour chaque chargement, les requêtes `/sql` parties et ce qu'elles ont reçu, les fichiers que l'explorateur montre et ce que GFS dit dans la console.
// À lancer sur l'arbre d'avant (REPO_DIR) et sur celui d'après pour comparer.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-sql-refuse.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { reopened } from './lab-poids.mjs';
import { apply } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const SUITE = '&suite=127.0.0.1'; // l'hôte du serveur d'essai, donné comme instance de La Suite : la surveillance du poids lit aussi
const WAIT_MS = 9000; // la surveillance du poids lit 5 s après le départ
const LOADS = 3;
const DELAY_MS = Number(process.env.SQL_DELAY || 86); // la réponse de `/sql` à la DINUM : 86 ms dans la console du porteur
// Les doublures du pare-feu. MESURÉ : celui de la DINUM refuse la structure écrite avec `substr(…) <> …` et le poids écrit avec deux sous-requêtes (sonde du porteur, 25/11) et laisse passer `NOT LIKE` /
// `!=` et `page_count * page_size FROM pragma_page_count(), pragma_page_size()` ; ANY : refuse toute lecture de la structure (le cas où aucune forme ne passerait).
const MEASURED = /substr\(|\(SELECT page_count/i;
const ANY_STRUCTURE = /_grist_Tables_column|pragma_/i;
let firewall = MEASURED;

const TEXT = names => names.map(id => ({ id, type: 'Text' }));
const TABLES = {
  Publipostage_Modeles: [...TEXT(['Nom', 'Contenu', 'TypeModele', 'DateModif', 'ModifiePar', 'Jeton']), { id: 'EstParDefaut', type: 'Bool' }],
  Publipostage_Templates: [...TEXT(['Name', 'Content', 'TemplateType', 'ModifiedAt', 'ModifiedBy', 'Token']), { id: 'IsDefault', type: 'Bool' }],
  Publipostage_PreferencesModeles: [...TEXT(['Utilisateur', 'Dossier']), { id: 'ModeleId', type: 'Int' }, { id: 'Epingle', type: 'Bool' }],
  Publipostage_TemplatePreferences: [...TEXT(['User', 'Folder']), { id: 'TemplateId', type: 'Int' }, { id: 'Pinned', type: 'Bool' }],
};
const SMALL = ['Attestation', 'Convocation', 'Lettre'];
const BIG = Array.from({ length: 14 }, (unused, i) => `Gros ${String(i + 1).padStart(2, '0')}`); // 14 modèles de 400 Ko : plus de 4 Mo, à partir desquels GFS lit les fichiers en lecture légère (js/explorer/explorer-sql.js)
const NAMES = [...SMALL, ...BIG].sort();

// Ce que la page demande à `/sql`, et ce qu'elle en reçoit : `answer` vaut « 200 », « 403 Grist » (réponse lue, en-têtes CORS de Grist) ou « bloquée » (le pare-feu : pas d'en-tête CORS, la page ne lit rien).
const net = [];
const kindOf = q => (/COUNT\(\*\)/.test(q) ? 'compte' : /_grist_Tables_column/.test(q) ? 'structure' : /pragma_page_count/.test(q) ? 'poids' : /gfs_octets/.test(q) ? 'lignes' : 'autre');

async function install(context) {
  context.on('response', response => {
    if (/\/api\/docs\/[^/]+\/sql\?/.test(response.url())) net.push({ q: new URL(response.url()).searchParams.get('q'), answer: response.status() === 200 ? '200' : `${response.status()} Grist` });
  });
  context.on('requestfailed', request => {
    if (/\/api\/docs\/[^/]+\/sql\?/.test(request.url())) net.push({ q: new URL(request.url()).searchParams.get('q'), answer: 'bloquée' });
  });
  // La doublure du pare-feu : la requête n'arrive pas à Grist et la page n'en lit rien (un 403 sans en-tête CORS ne lui rend qu'une erreur de réseau : `route.fulfill` de Playwright ajoute lui-même l'en-tête CORS, donc
  // c'est `abort` qui rend ce que la page voit).
  await context.route(/\/api\/docs\/[^/]+\/sql\?/, async route => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    if (firewall.test(q)) await route.abort('failed');
    else await route.continue();
  });
}

const summary = () => {
  const out = {};
  for (const { q, answer } of net) { const key = `${kindOf(q)} ${answer}`; out[key] = (out[key] || 0) + 1; }
  return out;
};
const names = frame => frame.locator('.ls-row:not(.folder) .t').allInnerTexts().then(list => [...list].sort());

// Un document d'essai : les quatre tables (l'ancienne vide, l'anglaise avec trois modèles), et, si `rules`, une règle d'accès qui fait refuser `/sql` au jeton en lecture seule.
async function seed(run, rules) {
  const tables = Object.entries(TABLES).map(([id, columns]) => ['AddTable', id, columns]);
  const add = (name, content) => apply(run.page, run.docId, [['AddRecord', 'Publipostage_Templates', null, { Name: name, Content: content, TemplateType: 'document', Token: name }]]);
  const statuses = [await apply(run.page, run.docId, tables)];
  for (const name of SMALL) statuses.push(await add(name, '<p>a</p>'));
  for (const name of BIG) statuses.push(await add(name, 'x'.repeat(4e5)));
  check('les tables des deux jeux de noms sont posées, l\'anglaise avec des modèles', statuses.every(status => status === 200), statuses);
  if (rules) {
    check('la règle d\'accès est posée', await apply(run.page, run.docId, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Clients', colIds: '*' }],
      ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD' }]]) === 200);
  }
}

// Trois chargements de la page : ce que chacun envoie à `/sql`, ce que l'explorateur montre, ce que GFS dit.
async function loads(run, label) {
  const seen = [];
  for (let i = 1; i <= LOADS; i++) {
    net.length = 0;
    const started = Date.now();
    await run.page.reload();
    const frame = await reopened(run.page);
    await frame.waitForFunction(() => document.body.dataset.explorerStats, null, { timeout: 60000 });
    const listed = Date.now() - started; // du rechargement à la liste lue (la mesure de `explorerStats` : la fin de la lecture des fichiers)
    await run.page.waitForTimeout(WAIT_MS);
    const shown = await names(frame);
    seen.push({ load: i, listed, sent: summary(), total: net.length, refused: net.filter(entry => entry.answer !== '200').length, shown });
    say(`  ${label} chargement ${i} :`, { listeMs: listed, demandes: net.length, refusées: seen[i - 1].refused, détail: seen[i - 1].sent, fichiers: shown });
  }
  return seen;
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  await install(context);

  say('--- 1. un document à règles d\'accès (Grist refuse `/sql` au jeton en lecture seule), derrière le pare-feu ---');
  const ruled = await openGfs(context, { lang, query: SUITE });
  await seed(ruled, true);
  const first = await loads(ruled, 'règles');
  check('l\'explorateur montre les trois modèles, à chaque chargement', first.every(each => JSON.stringify(each.shown) === JSON.stringify(NAMES)), first.map(each => each.shown));
  const count = each => Object.entries(each.sent).filter(([key]) => key.startsWith('compte')).reduce((sum, [, n]) => sum + n, 0);
  check(`au premier chargement : au plus un compte de lignes refusé (et pas un par table)`, count(first[0]) <= 1, first[0].sent);
  check('aux chargements suivants (même onglet) : aucun compte de lignes, aucune lecture de la structure', first.slice(1).every(each => count(each) === 0 && !Object.keys(each.sent).some(key => key.startsWith('structure'))),
    first.slice(1).map(each => each.sent));
  const warns = ruled.problems.filter(problem => /lecture légère des fichiers est éteinte/.test(problem));
  check('GFS dit une fois par chargement au plus que la lecture légère est éteinte', warns.length <= LOADS, warns.length);
  const expected = /lecture légère des fichiers est éteinte|porte plusieurs noms dans le document/; // dits depuis toujours : l'éteinte, et le document aux deux jeux de noms
  const unknown = ruled.problems.filter(problem => !ruled.allow.some(known => known.test(problem)) && !expected.test(problem));
  check('aucune autre erreur ni avertissement de GFS dans la console', unknown.length === 0, unknown);

  say('--- 2. un document sans règle, derrière un pare-feu qui refuserait toute lecture de la structure : les comptes passent, la structure est bloquée ---');
  firewall = ANY_STRUCTURE;
  const open = await openGfs(context, { lang, query: SUITE });
  await seed(open, false);
  const second = await loads(open, 'sans règle');
  check('l\'explorateur montre les trois modèles, à chaque chargement', second.every(each => JSON.stringify(each.shown) === JSON.stringify(NAMES)), second.map(each => each.shown));
  const asked = second.reduce((sum, each) => sum + Object.entries(each.sent).filter(([key]) => key.startsWith('structure')).reduce((total, [, n]) => total + n, 0), 0);
  check('la structure refusée par le pare-feu n\'est demandée qu\'une fois sur les trois chargements (la mémoire de l\'onglet la retient)', asked === 1, second.map(each => each.sent));
  const comptes = second.map(count);
  check('les comptes de lignes (qui passent) cessent dès que la lecture légère est fermée : aucun au dernier chargement', comptes[2] === 0, comptes);

  say('--- 3. un document sans règle, derrière le pare-feu tel que la DINUM l\'a mesuré : la structure (forme `NOT LIKE`) passe, la lecture légère sert ---');
  firewall = MEASURED;
  const light = await openGfs(context, { lang, query: SUITE });
  await seed(light, false);
  const third = await loads(light, 'pare-feu mesuré');
  check('l\'explorateur montre les trois modèles, à chaque chargement', third.every(each => JSON.stringify(each.shown) === JSON.stringify(NAMES)), third.map(each => each.shown));
  const kinds = (each, kind) => Object.entries(each.sent).filter(([key]) => key.startsWith(kind));
  // Le premier chargement lit en entier : l'ouverture de la page avait vu le document léger (tables vides), et le souvenir « léger » (js/explorer/heavy-hint.js) ne change qu'à cette lecture ;
  // les suivants savent le document lourd (14 modèles de 400 Ko) et lisent en SQL.
  const heavy = third.slice(1);
  check('la structure est demandée à chaque chargement du document connu lourd et Grist la rend (200) : le pare-feu mesuré la laisse passer',
    heavy.every(each => kinds(each, 'structure').length === 1 && kinds(each, 'structure')[0][0] === 'structure 200'), third.map(each => each.sent));
  check('les lignes se lisent en SQL (lecture légère) à chaque chargement du document connu lourd, toutes rendues (200)',
    heavy.every(each => kinds(each, 'lignes').length === 1 && kinds(each, 'lignes')[0][0] === 'lignes 200'), third.map(each => each.sent));
  const off = light.problems.filter(problem => /lecture légère des fichiers est éteinte/.test(problem));
  check('GFS ne dit jamais que la lecture légère est éteinte', off.length === 0, off);
} finally {
  await browser.close();
  pages.close();
}
