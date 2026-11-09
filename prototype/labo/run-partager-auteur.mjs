// Audit de sécurité du 09/11 : « écrire » sur un PDF partagé mène-t-il à « administrer » ? Le vrai plan de js/sharing-model.js joué dans un VRAI Grist, en deux temps (un compte à la fois, comme run-partager.mjs) :
//   PHASE=proprietaire  essai@example.com : un document qui a déjà des PDF (« Auteur » écrit, pas de GFS_Auteur : le document d'avant) ; le plan est posé et reprend l'auteur ; deux fichiers du propriétaire, f2 partagé
//                       à editor@ avec le droit « écriture » (rien de plus) ;
//   PHASE=editeur       editor@example.com : il lit et renomme f2 (c'est son droit) ; il remplace son contenu comme le fait l'explorateur (qui réécrit « Auteur ») ; il essaie de se mettre auteur de f2 par
//                       « Auteur » et par « GFS_Auteur », puis d'y tirer l'administration : effacer f2, partager f2 à viewer@. Avant le correctif, la partie « Auteur » donnait l'administration (ÉCHEC mesuré le 09/11).
//   bash vrai-serveur.sh && PHASE=proprietaire node run-partager-auteur.mjs ; GRIST_EMAIL=editor@example.com bash vrai-serveur.sh && PHASE=editeur node run-partager-auteur.mjs
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf, GRIST } from './lab-serveur.mjs';
import { shareWithEditorAndViewer } from './lab-droits.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { planSharing, SHARES_TABLE, shareRecord } from '../js/sharing-model.js';
import { FILES_COLUMNS } from '../js/gfs-files.js';

const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.AUTEUR_ETAT || '/tmp/partager-auteur-etat.json';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 300) };
}, [method, path, body]);
const apply = (page, id, actions) => call(page, 'POST', `/api/docs/${id}/apply`, actions);
const records = async (page, id, table) => { const answer = await call(page, 'GET', `/api/docs/${id}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : answer; };
const ids = list => (Array.isArray(list) ? list.map(row => row.Identifiant).sort().join(',') : JSON.stringify(list));
const strip = value => (Array.isArray(value) && value[0] === 'L' ? value.slice(1) : value);
async function existingOf(page, id) {
  const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables', '_grist_Tables_column'].map(name => records(page, id, name)));
  return { resources, rules, tables, columns };
}

const pluginApi = await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await (await newContext(browser, pluginApi, {})).newPage();
  if (phase === 'proprietaire') {
    const id = docIdOf(await createDocument(page));
    writeFileSync(STATE, JSON.stringify({ id }));
    say('partage au document :', await shareWithEditorAndViewer(page, id));
    // Le document d'avant : GFS_Fichiers existe, trois PDF y ont leur « Auteur », la colonne protégée n'existe pas encore.
    let answer = await apply(page, id, [['AddTable', 'GFS_Fichiers', FILES_COLUMNS.map(column => ({ ...column }))], ['BulkAddRecord', 'GFS_Fichiers', [null, null], { Identifiant: ['v1', 'v2'], Nom: ['Ancien-editeur.pdf', 'Ancien-proprio.pdf'], Auteur: [EDITOR, OWNER] }]]);
    check('un document d\'avant : deux PDF, leur « Auteur » écrit', answer.status === 200, answer.text);
    const plan = planSharing(await existingOf(page, id), FILES_COLUMNS);
    check('le plan est posé en une liasse', plan.ok && (await apply(page, id, plan.actions)).status === 200, plan.reason);
    const legacy = await records(page, id, 'GFS_Fichiers');
    check('l\'auteur des PDF d\'avant est repris de « Auteur » (GFS_Auteur)', legacy.length === 2 && legacy.every(row => row.GFS_Auteur === row.Auteur && row.GFS_Auteur), legacy.map(row => [row.Auteur, row.GFS_Auteur]));
    check('l\'auteur d\'un PDF d\'avant en est administrateur (editor@ : v1)', strip(legacy.find(row => row.Identifiant === 'v1').GFS_Admins).includes(EDITOR), legacy.map(row => strip(row.GFS_Admins)));
    answer = await apply(page, id, [['BulkAddRecord', 'GFS_Fichiers', [null, null], { Identifiant: ['f1', 'f2'], Nom: ['Prive.pdf', 'Equipe.pdf'], Auteur: [OWNER, OWNER] }]]);
    check('deux fichiers du propriétaire (GFS_Auteur écrit par Grist)', answer.status === 200 && (await records(page, id, 'GFS_Fichiers')).filter(row => ['f1', 'f2'].includes(row.Identifiant)).every(row => row.GFS_Auteur === OWNER), answer.text);
    const row = shareRecord({ target: 'gfs-fichiers:f2', who: EDITOR, right: 'ecriture' });
    answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, row]]);
    check('f2 est partagé à editor@ avec « écriture » seulement', answer.status === 200, answer.text);
    const f2 = (await records(page, id, 'GFS_Fichiers')).find(each => each.Identifiant === 'f2');
    say('f2 côté propriétaire :', JSON.stringify({ admins: strip(f2.GFS_Admins), ecrivains: strip(f2.GFS_Ecrivains), lecteurs: strip(f2.GFS_Lecteurs) }));
    check('editor@ écrit f2 sans l\'administrer', strip(f2.GFS_Ecrivains).includes(EDITOR) && !strip(f2.GFS_Admins).includes(EDITOR), f2);
  } else {
    const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    say('--- editor@ : droit « écriture » sur f2 ---');
    let seen = await records(page, id, 'GFS_Fichiers');
    check('il lit f2 et son PDF d\'avant (v1 : il en est l\'auteur repris), pas f1 ni v2 (le plan de l\'essai ne passe pas `fileIds` : pas de partage « tous » pour les PDF d\'avant)', ids(seen.filter(row => row.Identifiant !== 'e2')) === 'f2,v1', ids(seen)); // e2 : le fichier que cette phase crée (un second passage le retrouve)
    const rowOf = async identifiant => (await records(page, id, 'GFS_Fichiers')).find(each => each.Identifiant === identifiant);
    const f2Row = (await rowOf('f2')).id;
    let answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', f2Row, { Nom: 'Equipe (relu).pdf' }]]);
    check('il renomme f2 (son droit d\'écriture)', answer.status === 200, answer.text);
    answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, shareRecord({ target: 'gfs-fichiers:f2', who: VIEWER, right: 'lecture' })]]);
    seen = await records(page, id, SHARES_TABLE);
    say('partage de f2 à viewer@ par l\'écrivain (réponse', answer.status + ') ; ses lignes :', JSON.stringify(Array.isArray(seen) ? seen.map(row => [row.Cible, row.Personne, row.Valide]) : seen));
    const before = Array.isArray(seen) ? seen.find(row => row.Personne === VIEWER) : null;
    check('AVANT : un partage de f2 par l\'écrivain n\'est pas valide (il n\'administre pas f2)', !before || before.Valide === false, before);
    // Le geste de l'explorateur qui remplace un PDF : il réécrit « Auteur » (le dernier qui a modifié). Il ne donne pas l'administration.
    answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', f2Row, { Auteur: EDITOR, Taille: 12 }]]);
    check('il remplace le contenu de f2 comme l\'explorateur (« Auteur » réécrit : accepté, c\'est le dernier qui a modifié)', answer.status === 200, answer.text);
    let f2 = await rowOf('f2');
    say('f2 après :', JSON.stringify({ Auteur: f2.Auteur, GFS_Auteur: f2.GFS_Auteur, admins: strip(f2.GFS_Admins) }));
    check('RÉSULTAT : l\'écrivain n\'est pas administrateur de f2 (avant le correctif : ÉCHEC mesuré, il l\'était, effaçait f2 et donnait l\'administration)', !strip(f2.GFS_Admins).includes(EDITOR) && strip(f2.GFS_Admins).includes(OWNER), strip(f2.GFS_Admins));
    // Les tentatives directes.
    answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', f2Row, { GFS_Auteur: EDITOR }]]);
    check('se nommer auteur par GFS_Auteur est REFUSÉ', answer.status !== 200, answer.text);
    answer = await apply(page, id, [['AddRecord', 'GFS_Fichiers', null, { Identifiant: 'e1', Nom: 'Au nom d\'un autre', GFS_Auteur: OWNER }]]);
    check('créer un fichier au nom du propriétaire (GFS_Auteur) est REFUSÉ', answer.status !== 200, answer.text);
    answer = await apply(page, id, [['AddRecord', 'GFS_Fichiers', null, { Identifiant: 'e2', Nom: 'A moi' }]]);
    const mineRow = await rowOf('e2');
    check('créer un fichier à son nom : accepté, Grist écrit GFS_Auteur', answer.status === 200 && mineRow && mineRow.GFS_Auteur === EDITOR && strip(mineRow.GFS_Admins).includes(EDITOR), mineRow && [mineRow.GFS_Auteur, strip(mineRow.GFS_Admins)]);
    answer = await apply(page, id, [['RemoveRecord', 'GFS_Fichiers', f2Row]]);
    check('effacer f2 est REFUSÉ (écrire n\'est pas administrer)', answer.status !== 200 && Boolean(await rowOf('f2')), answer.text);
    answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, shareRecord({ target: 'gfs-fichiers:f2', who: VIEWER, right: 'admin' })]]);
    f2 = await rowOf('f2');
    check('donner l\'administration de f2 à viewer@ ne vaut rien', !strip(f2.GFS_Admins).includes(VIEWER), strip(f2.GFS_Admins));
    answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', (await rowOf('v1')).id, { GFS_Auteur: 'autre@example.com' }]]);
    check('même pour son propre PDF d\'avant, GFS_Auteur ne change pas (seul un propriétaire le change)', answer.status !== 200, answer.text);
  }
} finally {
  await browser.close();
}
