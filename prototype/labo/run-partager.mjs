// « Partager » (contrats 11.7, point 13) : le vrai plan de js/sharing-model.js joué dans un VRAI Grist, à trois comptes, en trois temps (le serveur d'essai ne connaît qu'une personne à la fois, `GRIST_EMAIL`) :
//   PHASE=proprietaire  essai@example.com : le plan crée `GFS_Partages` et `GFS_Fichiers`, ajoute les colonnes d'aide et pose les règles en une fois ; quatre fichiers, trois partages ;
//   PHASE=editeur       editor@example.com : il lit ses fichiers et ceux qu'on lui a partagés, partage le sien SANS propriétaire, ne peut ni se nommer auteur d'un autre ni valider un partage hors de ses fichiers ;
//   PHASE=lecteur       viewer@example.com : il lit ce que l'éditeur et le propriétaire lui ont partagé, rien d'autre ; PHASE=retrait : le propriétaire retire les règles.
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf, GRIST } from './lab-serveur.mjs';
import { shareWithEditorAndViewer } from './lab-droits.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { planSharing, planUnsharing, SHARES_TABLE, shareRecord } from '../js/sharing-model.js';
import { FILES_COLUMNS } from '../js/gfs-files.js';

const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_ETAT || '/tmp/partager-gfs-etat.json';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 400) };
}, [method, path, body]);
const apply = (page, id, actions) => call(page, 'POST', `/api/docs/${id}/apply`, actions);
const records = async (page, id, table) => { const answer = await call(page, 'GET', `/api/docs/${id}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : answer; };
const ids = list => (Array.isArray(list) ? list.map(row => row.Identifiant).sort().join(',') : JSON.stringify(list));
const strip = value => (Array.isArray(value) && value[0] === 'L' ? value.slice(1) : value);

// L'état que lit le plan : les tables internes de Grist, dans la forme de js/rights-reader.js (`raw`).
async function existingOf(page, id) {
  const [resources, rules, tables, columns] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules', '_grist_Tables', '_grist_Tables_column'].map(name => records(page, id, name)));
  return { resources, rules, tables, columns };
}

const pluginApi = await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, {});
  const page = await context.newPage();
  if (phase === 'proprietaire') {
    const path = await createDocument(page);
    const id = docIdOf(path);
    writeFileSync(STATE, JSON.stringify({ id }));
    say('partage au document :', await shareWithEditorAndViewer(page, id));
    const existing = await existingOf(page, id);
    const plan = planSharing(existing, FILES_COLUMNS);
    check('le plan est possible, sans règle d\'un autre auteur, pour un document neuf', plan.ok && plan.firstRule && plan.creates.join(",") === `${SHARES_TABLE},GFS_Rangement,GFS_Fichiers`, plan);
    let answer = await apply(page, id, plan.actions);
    check('les deux tables, les colonnes d\'aide et les règles s\'écrivent en UNE liasse', answer.status === 200, answer.text);
    const again = planSharing(await existingOf(page, id), FILES_COLUMNS);
    check('le plan suivant dit « déjà posé »', !again.ok && again.reason === 'already', again);
    answer = await apply(page, id, [['BulkAddRecord', 'GFS_Fichiers', [null, null, null, null], {
      Identifiant: ['f1', 'f2', 'f3', 'f4'], Nom: ['Devis.pdf', 'Secret.pdf', 'Public.pdf', 'Equipe.pdf'], Auteur: [EDITOR, OWNER, OWNER, OWNER] }]]);
    check('quatre fichiers (f1 est à l\'éditeur)', answer.status === 200, answer.text);
    answer = await apply(page, id, [['BulkAddRecord', SHARES_TABLE, [null, null], [shareRecord({ target: 'gfs-fichiers:f3', who: '@tous', right: 'lecture' }), shareRecord({ target: 'gfs-fichiers:f4', who: '@editeurs', right: 'lecture' })]
      .reduce((acc, row) => ({ Cible: [...(acc.Cible || []), row.Cible], Personne: [...(acc.Personne || []), row.Personne], Droit: [...(acc.Droit || []), row.Droit], Telecharger: [...(acc.Telecharger || []), row.Telecharger] }), {})]]);
    check('deux partages de catégorie écrits par le propriétaire', answer.status === 200, answer.text);
    const shares = await records(page, id, SHARES_TABLE);
    say('partages :', JSON.stringify(shares.map(row => [row.Cible, row.Personne, row.Auteur, row.AuteurAcces, row.Valide1, row.Valide])));
    check('l\'auteur et son rôle sont écrits par Grist ; un partage du propriétaire est valide', shares.every(row => row.Auteur === OWNER && row.Valide1 === true && row.Valide === true), shares.map(row => [row.AuteurAcces, row.Valide1, row.Valide]));
    const files = await records(page, id, 'GFS_Fichiers');
    say('lecteurs :', JSON.stringify(files.map(row => [row.Identifiant, strip(row.GFS_Lecteurs), strip(row.GFS_Cats)])));
    check('le propriétaire lit les quatre', ids(files) === 'f1,f2,f3,f4');
    check('GFS_Cats de f3 = tous, de f4 = editeurs', JSON.stringify(strip(files.find(row => row.Identifiant === 'f3').GFS_Cats)) === '["tous"]' && JSON.stringify(strip(files.find(row => row.Identifiant === 'f4').GFS_Cats)) === '["editeurs"]');
    check('l\'auteur d\'un fichier le lit et l\'administre', strip(files.find(row => row.Identifiant === 'f1').GFS_Admins).includes(EDITOR));
  } else if (phase === 'retrait') {
    const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const plan = planUnsharing(await existingOf(page, id));
    check('le plan de retrait existe', plan.ok, plan);
    const answer = await apply(page, id, plan.actions);
    check('les règles de partage se retirent', answer.status === 200, answer.text);
    const left = await existingOf(page, id);
    check('plus aucune règle de partage ; les tables restent', !left.rules.some(row => /Partages/.test(row.memo || '')) && left.tables.some(row => row.tableId === SHARES_TABLE));
    check('le plan suivant refait possible le retrait : « none »', planUnsharing(left).reason === 'none');
  } else {
    const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    if (phase === 'editeur') {
      say('--- editor@ : auteur de f1 ---');
      let seen = await records(page, id, 'GFS_Fichiers');
      check('il lit f1 (le sien), f3 (« tous ») et f4 (« les éditeurs »), pas f2', ids(seen) === 'f1,f3,f4', ids(seen));
      let answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, shareRecord({ target: 'gfs-fichiers:f1', who: VIEWER, right: 'lecture' })]]);
      check('il partage son fichier avec viewer@ SANS propriétaire', answer.status === 200, answer.text);
      answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, shareRecord({ target: 'gfs-fichiers:f2', who: EDITOR, right: 'lecture' })]]);
      say('partage d\'un fichier qui n\'est pas le sien (f2) :', answer.status);
      seen = await records(page, id, 'GFS_Fichiers');
      check('ce partage ne lui ouvre pas f2', ids(seen) === 'f1,f3,f4', ids(seen));
      answer = await apply(page, id, [['AddRecord', SHARES_TABLE, null, { ...shareRecord({ target: 'gfs-fichiers:f2', who: EDITOR, right: 'admin' }), Auteur: OWNER, AuteurAcces: 'owners' }]]);
      say('tentative de tricher sur l\'auteur et son rôle :', answer.status, answer.text.slice(0, 160));
      seen = await records(page, id, 'GFS_Fichiers');
      check('tricher sur l\'auteur et son rôle à la création est REFUSÉ, et ne lui ouvre pas f2', answer.status !== 200 && ids(seen) === 'f1,f3,f4', { status: answer.status, seen: ids(seen) });
      const mine = await records(page, id, SHARES_TABLE);
      const valid = Array.isArray(mine) ? mine.filter(row => row.Cible === 'gfs-fichiers:f2').map(row => [row.Personne, row.Auteur, row.AuteurAcces, row.Valide]) : mine;
      say('ses lignes sur f2 :', JSON.stringify(valid));
      const own = Array.isArray(mine) ? mine.find(row => row.Cible === 'gfs-fichiers:f1') : null;
      answer = own ? await apply(page, id, [['UpdateRecord', SHARES_TABLE, own.id, { AuteurAcces: 'owners' }]]) : { status: 0 };
      check('il ne peut pas réécrire le rôle de l\'auteur de sa ligne', answer.status !== 200, answer);
      answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', 1, { Nom: 'Devis (renommé).pdf' }]]);
      check('il renomme son fichier', answer.status === 200, answer.text);
      answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', 3, { Nom: 'Pirate.pdf' }]]);
      check('il ne renomme pas le fichier d\'un autre', answer.status !== 200, answer.text);
      answer = await apply(page, id, [['AddRecord', 'GFS_Fichiers', null, { Identifiant: 'e1', Nom: 'Au nom d\'un autre', Auteur: OWNER }]]);
      check('il ne crée pas de fichier au nom d\'un autre', answer.status !== 200, answer.text);
      answer = await apply(page, id, [['AddRecord', 'GFS_Fichiers', null, { Identifiant: 'e2', Nom: 'A moi', Auteur: EDITOR }]]);
      check('il crée un fichier à son nom', answer.status === 200, answer.text);
    } else {
      say('--- viewer@ ---');
      const seen = await records(page, id, 'GFS_Fichiers');
      check('il lit f1 (partagé par l\'éditeur) et f3 (« tous »), pas f2 ni f4 (éditeurs)', ids(seen) === 'f1,f3', ids(seen));
      const shares = await records(page, id, SHARES_TABLE);
      check('il ne lit que les partages qui le concernent (les siens et ceux de « tous », pas ceux des éditeurs)', Array.isArray(shares) && shares.every(row => String(row.PersonneL || row.Personne).toLowerCase() === VIEWER || row.Personne === '@tous') && !shares.some(row => row.Personne === '@editeurs'), shares);
      const answer = await apply(page, id, [['UpdateRecord', 'GFS_Fichiers', 3, { Nom: 'x' }]]);
      check('lecteur du document : il n\'écrit rien', answer.status !== 200, answer.text);
    }
  }
} finally {
  await browser.close();
}
