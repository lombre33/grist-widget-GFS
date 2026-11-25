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
import { install, loads as loadsOf } from './lab-sql.mjs';
import { apply } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const SUITE = '&suite=127.0.0.1'; // l'hôte du serveur d'essai, donné comme instance de La Suite : la surveillance du poids lit aussi
const WAIT_MS = 9000; // la surveillance du poids lit 5 s après le départ
const LOADS = Number(process.env.LOADS || 3);
const PASSES = (process.env.PASSES || '1,2,3').split(','); // les passes jouées ; BIG_COUNT : le nombre de modèles de 400 Ko (14 par défaut ; 300 : un document de 120 Mo)
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
const BIG = Array.from({ length: Number(process.env.BIG_COUNT || 14) }, (unused, i) => `Gros ${String(i + 1).padStart(3, '0')}`); // 14 modèles de 400 Ko : plus de 4 Mo, à partir desquels GFS lit les fichiers en lecture légère (js/explorer/explorer-sql.js)
const NAMES = [...SMALL, ...BIG].sort();

// La liste ne dessine que les lignes qu'on voit : avec 300 modèles, elle montre les premiers, dans l'ordre.
const sameNames = shown => JSON.stringify(shown) === JSON.stringify(NAMES.slice(0, shown.length));

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

const loads = (run, label) => loadsOf(run, label, { count: LOADS, wait: WAIT_MS });

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  await install(context, { delay: DELAY_MS, blocks: q => firewall.test(q) });
  const count = each => Object.entries(each.sent).filter(([key]) => key.startsWith('compte')).reduce((sum, [, n]) => sum + n, 0);

  if (PASSES.includes('1')) {
  say('--- 1. un document à règles d\'accès (Grist refuse `/sql` au jeton en lecture seule, le propriétaire lit avec le jeton qui peut écrire), derrière le pare-feu ---');
  const ruled = await openGfs(context, { lang, query: SUITE });
  await seed(ruled, true);
  const first = await loads(ruled, 'règles');
  check('l\'explorateur montre les trois modèles, à chaque chargement', first.every(each => sameNames(each.shown)), first.map(each => each.shown));
  check('au premier chargement : un seul refus, celui du jeton prudent (et pas un par table)', first[0].refused <= 1, first[0].sent);
  check('le poids (jeton qui peut écrire, d\'emblée : Grist a déjà refusé le jeton en lecture seule) ne se fait refuser à aucun chargement', first.every(each => each.sent['poids 200'] === 1 && !Object.keys(each.sent).some(key => key.startsWith('poids') && key !== 'poids 200')), first.map(each => each.sent));
  check('aux chargements suivants (même onglet) : aucune requête refusée, tout part d\'emblée avec le jeton qui peut écrire (la note `writable` de l\'onglet)', first.slice(1).every(each => each.refused === 0),
    first.slice(1).map(each => each.sent));
  check('la lecture légère sert aux chargements suivants (le document est connu lourd) : la structure et les lignes à 200',
    first.slice(1).every(each => each.sent['structure 200'] === 1 && each.sent['lignes 200'] === 1), first.map(each => each.sent));
  const warns = ruled.problems.filter(problem => /lecture légère des fichiers est éteinte/.test(problem));
  check('GFS ne dit jamais que la lecture légère est éteinte (le propriétaire lit avec le jeton qui peut écrire)', warns.length === 0, warns);
  const expected = /lecture légère des fichiers est éteinte|porte plusieurs noms dans le document/; // dits depuis toujours : l'éteinte, et le document aux deux jeux de noms
  const unknown = ruled.problems.filter(problem => !ruled.allow.some(known => known.test(problem)) && !expected.test(problem));
  check('aucune autre erreur ni avertissement de GFS dans la console', unknown.length === 0, unknown);

  }

  if (PASSES.includes('2')) {
  say('--- 2. un document sans règle, derrière un pare-feu qui refuserait toute lecture de la structure : les comptes passent, la structure est bloquée ---');
  firewall = ANY_STRUCTURE;
  const open = await openGfs(context, { lang, query: SUITE });
  await seed(open, false);
  const second = await loads(open, 'sans règle');
  check('l\'explorateur montre les trois modèles, à chaque chargement', second.every(each => sameNames(each.shown)), second.map(each => each.shown));
  const asked = second.reduce((sum, each) => sum + Object.entries(each.sent).filter(([key]) => key.startsWith('structure')).reduce((total, [, n]) => total + n, 0), 0);
  check('la structure refusée par le pare-feu n\'est demandée qu\'une fois sur les trois chargements (la mémoire de l\'onglet la retient)', asked === 1, second.map(each => each.sent));
  const comptes = second.map(count);
  check('les comptes de lignes (qui passent) cessent dès que la lecture légère est fermée : aucun au dernier chargement', comptes[2] === 0, comptes);

  }

  if (PASSES.includes('3')) {
  say('--- 3. un document sans règle, derrière le pare-feu tel que la DINUM l\'a mesuré : la structure (forme `NOT LIKE`) passe, la lecture légère sert ---');
  firewall = MEASURED;
  const light = await openGfs(context, { lang, query: SUITE });
  await seed(light, false);
  const third = await loads(light, 'pare-feu mesuré');
  check('l\'explorateur montre les trois modèles, à chaque chargement', third.every(each => sameNames(each.shown)), third.map(each => each.shown));
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
  }
} finally {
  await browser.close();
  pages.close();
}
