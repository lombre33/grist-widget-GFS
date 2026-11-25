// La lecture rapide avec le jeton qui peut écrire (choix du porteur, 25/11 soir ; faits vérifiés 173 et 43) sous TROIS comptes, dans un VRAI serveur Grist (`bash vrai-serveur.sh`) : Grist refuse `/sql`
// au jeton en lecture seule dans un document à règles d'accès, même au propriétaire, et ne le rend qu'au jeton qui peut écrire, au propriétaire seul. GFS passe donc au jeton qui peut écrire après le premier
// refus : le propriétaire lit vite ; un éditeur ou un lecteur n'obtient rien de plus (les deux jetons refusés, la lecture légère se ferme, la table est lue en entier comme avant). Le serveur d'essai ne connaît
// qu'une personne à la fois : l'éditeur et le lecteur se jouent en relançant le serveur sous leur compte, sur le MÊME document (comme `run-poids-fenetre.mjs`) :
//   bash vrai-serveur.sh                                 && REPO_DIR="$(realpath ../..)" PHASE=seed node run-sql-compte.mjs                      # le propriétaire crée le document, y pose les règles, le partage
//   GRIST_EMAIL=editor@example.com bash vrai-serveur.sh  && REPO_DIR="$(realpath ../..)" PHASE=read WHO=editeur node run-sql-compte.mjs     # l'éditeur : deux refus, puis plus rien, la liste est là
//   GRIST_EMAIL=viewer@example.com bash vrai-serveur.sh  && REPO_DIR="$(realpath ../..)" PHASE=read WHO=lecteur node run-sql-compte.mjs     # le lecteur : de même
// L'état du document passe d'un temps à l'autre par `/tmp/sql-compte-etat.json` (`SQL_COMPTE_ETAT`). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { apply } from './lab-droits.mjs';
import { install, loads, net, summary } from './lab-sql.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'seed';
const who = process.env.WHO || 'editeur';
const STATE = process.env.SQL_COMPTE_ETAT || '/tmp/sql-compte-etat.json';
const SUITE = '&suite=127.0.0.1'; // l'hôte du serveur d'essai, donné comme instance de La Suite : la surveillance du poids lit aussi
const NAMES = ['Attestation', 'Convocation', 'Lettre'];
const TEXT = ids => ids.map(id => ({ id, type: 'Text' }));

// Le document : une table de Publipostage+ sous chaque jeu de noms (le compte de lignes part), trois modèles, une table que la règle cache aux autres, et le partage à l'éditeur et au lecteur.
async function seed(run) {
  const tables = [['AddTable', 'Publipostage_Modeles', TEXT(['Nom', 'Contenu', 'TypeModele', 'DateModif', 'ModifiePar', 'Jeton'])],
    ['AddTable', 'Publipostage_Templates', TEXT(['Name', 'Content', 'TemplateType', 'ModifiedAt', 'ModifiedBy', 'Token'])], ['AddTable', 'Secrets', TEXT(['Note'])]];
  check('les tables sont posées', await apply(run.page, run.docId, tables) === 200);
  for (const name of NAMES) await apply(run.page, run.docId, [['AddRecord', 'Publipostage_Templates', null, { Name: name, Content: '<p>a</p>', TemplateType: 'document', Token: name }]]);
  await apply(run.page, run.docId, [['AddRecord', 'Secrets', null, { Note: 'à ne pas montrer' }]]);
  check('la règle qui cache « Secrets » aux autres est posée', await apply(run.page, run.docId, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Secrets', colIds: '*' }],
    ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD' }]]) === 200);
  const shared = await run.page.evaluate(async id => (await fetch(`/api/docs/${id}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta: { users: { 'editor@example.com': 'editors', 'viewer@example.com': 'viewers' } } }) })).status, run.docId);
  check('le document est partagé à l\'éditeur et au lecteur', shared === 200, shared);
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  await install(context);
  if (phase === 'seed') {
    const run = await openGfs(context, { lang, query: SUITE });
    await seed(run);
    writeFileSync(STATE, JSON.stringify({ path: run.path }));
    const seen = await loads(run, 'propriétaire');
    check('le propriétaire : la liste est là à chaque chargement', seen.every(each => JSON.stringify(each.shown) === JSON.stringify(NAMES)), seen.map(each => each.shown));
    check('le propriétaire : un seul refus, au premier chargement (le jeton prudent) ; ensuite tout part avec le jeton qui peut écrire', seen[0].refused <= 1 && seen.slice(1).every(each => each.refused === 0), seen.map(each => each.sent));
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    // La première ouverture de la page dans cet onglet (les chargements suivants relisent la mémoire de l'onglet) : c'est là que GFS essaie les deux jetons.
    const opening = summary();
    say(`  ${who}, première ouverture :`, opening);
    check(`${who} : à la première ouverture, aucune lecture SQL ne rend de lignes ; les refus sont ceux des deux jetons (quatre au plus : le compte de lignes, le poids)`,
      !Object.keys(opening).some(key => key.endsWith(' 200')) && net.filter(entry => entry.answer !== '200').length <= 4, opening);
    const seen = await loads(run, who);
    check(`${who} : la liste est là à chaque chargement (lue en entier, comme avant)`, seen.every(each => JSON.stringify(each.shown) === JSON.stringify(NAMES)), seen.map(each => each.shown));
    const got = seen.flatMap(each => Object.keys(each.sent)).filter(key => key.endsWith(' 200') && /^(compte|structure|lignes|poids|autre)/.test(key));
    check(`${who} : aucune lecture SQL ne lui rend de lignes (ni les deux jetons de GFS, ni la lecture légère)`, got.length === 0, seen.map(each => each.sent));
    check(`${who} : au premier chargement, deux refus au plus pour le compte de lignes (le jeton prudent, puis celui qui peut écrire), et plus aucun compte ensuite`,
      (seen[0].sent['compte 403 Grist'] || 0) <= 2 && seen.slice(1).every(each => !Object.keys(each.sent).some(key => key.startsWith('compte'))), seen.map(each => each.sent));
    check(`${who} : jamais de lecture de la structure ni des lignes en SQL`, seen.every(each => !Object.keys(each.sent).some(key => /^(structure|lignes)/.test(key))), seen.map(each => each.sent));
  }
} finally {
  await browser.close();
  pages.close();
}
