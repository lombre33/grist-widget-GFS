// Audit « contournement » du 11/11 : un ENVOYEUR peut-il écrire lui-même les marques « accepté » / « refusé » dans la table reçue ? (js/sharing/received-files.js lit `Accepte` et `Refuse` dans la
// table `GFS_Recus*`, une table que le moteur de Sync+ remplit avec les colonnes que l'envoyeur déclare.) Joué dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`) :
// l'envoyeur est ici un document « méchant » qui range une colonne `Accepte` dans les colonnes de son export, avec le moteur lui-même (un envoyeur qui n'est pas GFS peut le faire avec le widget de Sync+).
//   SCENARIO=invitation  la colonne `Accepte` fait partie de l'export dès l'invitation ;
//   SCENARIO=apres       elle est ajoutée à l'export après le premier envoi, avant toute réponse de la personne ;
//   SCENARIO=casse       comme « invitation », avec `ACCEPTE` et `REFUSE` en majuscules ;
//   SCENARIO=repondu     la personne a déjà répondu (ses colonnes existent) : l'envoyeur ajoute alors `Accepte` à l'export, avec une autre valeur.
//   GFS_FLOW=0           la réception est montée par les fonctions du moteur seules (l'ÉTAT D'AVANT le correctif : l'essai doit échouer) ; sans cela, par le parcours de GFS (js/sharing/share-receive-flow.js).
// REPO_DIR="$(realpath ../..)" SCENARIO=invitation node run-securite-marques.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames } from './lab-pdf.mjs';
import { startEngine, handshake as engineHandshake, formLink } from './lab-partage.mjs';

const scenario = process.env.SCENARIO || 'invitation';
const viaGfs = process.env.GFS_FLOW !== '0';
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const upper = scenario === 'casse'; // les noms écrits en majuscules : Grist ne distingue pas la casse
const MARKS = upper ? ['ACCEPTE', 'REFUSE'] : ['Accepte', 'Refuse'];

// Le premier partage, comme `handshake` de lab-partage.mjs, mais le côté qui reçoit passe par le parcours de GFS (le correctif : marques posées d'emblée, colonnes de même nom renommées).
async function handshakeGfs(source, target, { name, ids, columns }) {
  const selection = [{ table: 'GFS_Fichiers', columns, filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: ids }] } }];
  const saved = await source.frame.evaluate(args => window.__s.saveChosenExport({ name: args.name, selection: args.selection }).then(done => ({ id: done.id, created: done.created })), { name, selection });
  const invited = await source.frame.evaluate(exp => window.__s.startInvitation(exp).then(async ({ entry, secret }) => ({ entry, code: (await window.__s.invitationCode(exp, entry, secret)).code })), saved.created);
  await target.frame.evaluate(async code => {
    const { createTargetFlow } = await import('./js/sharing/share-receive-flow.js');
    const port = await import('./kit/js/synchro/port.js');
    const marks = await import('./js/sharing/received-marks.js');
    const engine = { ...window.__s, tableTaken: async table => (await port.readSchema()).resolve(table) !== null, ensureMarks: table => marks.ensureMarks(grist.docApi, [table]) };
    window.__flow = createTargetFlow({ engine });
    await window.__flow.read(code);
    await window.__flow.accept();
  }, invited.code);
  const { link } = await formLink(target);
  const replied = await target.frame.evaluate(address => window.__flow.reply(address), link);
  const reply = await source.frame.evaluate(args => window.__s.checkReply(args.exp, args.entry, args.code), { exp: saved.created, entry: invited.entry, code: replied.code });
  await source.frame.evaluate(args => window.__s.approveReply(args.exp, args.entry, args.reply).then(() => window.__s.sendExisting(args.exp)), { exp: saved.created, entry: invited.entry, reply });
  return { exp: saved.created, entry: invited.entry };
}
const handshake = (source, target, options) => (viaGfs ? handshakeGfs(source, target, options) : engineHandshake(source, target, options));

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: 'light' });
  const source = await openGfs(context, { lang: 'fr' });
  await importSamples(source);
  await importPdf(source.page, source.frame, pdfFile('Contrat.pdf', 2, 'Contrat').file);
  await waitForNames(source.frame, ['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  const target = await openGfs(context, { lang: 'fr' });
  await startEngine(source.frame);
  await startEngine(target.frame);
  const files = await source.rest.rows('GFS_Fichiers');
  const idOf = name => files.find(row => row.Nom === name).Identifiant;
  const rowOf = name => files.find(row => row.Nom === name).id;
  const patch = (run, table, id, fields) => run.page.evaluate(async ([doc, name, row, values]) => (await fetch(`/api/docs/${doc}/tables/${name}/records`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ records: [{ id: row, fields: values }] }) })).status, [run.docId, table, id, fields]);
  const addMarks = () => source.frame.evaluate(names => grist.docApi.applyUserActions(names.map(name => ['AddColumn', 'GFS_Fichiers', name, { type: 'Bool', isFormula: false }])), MARKS);
  const pass = async () => {
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await source.page.waitForTimeout(1500); } return rows; };
  const selection = (columns, ids) => [{ table: 'GFS_Fichiers', columns, filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: ids }] } }];
  const editExport = (exp, columns, ids) => source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    await window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
    return done.changed.length;
  }), { exp, selection: selection(columns, ids) });
  const marks = rows => rows.map(row => [row.Nom, row.Accepte ?? null, row.Refuse ?? null]);

  say(`--- scénario « ${scenario} » ---`);
  if (scenario === 'invitation' || scenario === 'casse') {
    await addMarks();
    await Promise.all([patch(source, 'GFS_Fichiers', rowOf('Devis.pdf'), { [MARKS[0]]: true }), patch(source, 'GFS_Fichiers', rowOf('Facture.pdf'), { [MARKS[0]]: true, [MARKS[1]]: false })]);
    await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf'), idOf('Devis.pdf')], columns: [...COLUMNS, ...MARKS], options: { archive: true } });
    const rows = await until(list => list.length === 2 && list.every(row => row.Contenu));
    check('les deux fichiers sont arrivés', rows.length === 2, marks(rows));
    check('AUCUN n\'arrive déjà « accepté » (la personne n\'a rien répondu)', rows.every(row => !row.Accepte), marks(rows));
  } else if (scenario === 'apres') {
    const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf')], columns: COLUMNS, options: { archive: true } });
    let rows = await until(list => list.length === 1 && list[0].Contenu);
    check(viaGfs ? 'le premier fichier est arrivé, les colonnes de marque existent déjà et sont vides' : 'le premier fichier est arrivé, sans colonne de marque',
      rows.length === 1 && (viaGfs ? 'Accepte' in rows[0] && !rows[0].Accepte : !('Accepte' in rows[0])), Object.keys(rows[0] || {}));
    await addMarks();
    await patch(source, 'GFS_Fichiers', rowOf('Facture.pdf'), { Accepte: true });
    const edited = await editExport(first.exp, [...COLUMNS, ...MARKS], [idOf('Facture.pdf')]);
    check('l\'export gagne les colonnes de marque', edited.ok, edited);
    rows = await until(list => list.some(row => 'Accepte' in row), 30);
    check('la marque envoyée n\'arrive PAS sous le nom que GFS lit pour « accepté »', !rows.some(row => row.Accepte === true), marks(rows));
    if (viaGfs) check('elle est reçue sous un nom libre du moteur (donnée de l\'envoyeur, que GFS ne lit pas)', Object.keys(rows[0] || {}).some(key => /^Accepte_\d+$/.test(key) && rows[0][key] === true), Object.keys(rows[0] || {}));
  } else {
    const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf'), idOf('Devis.pdf')], columns: COLUMNS, options: { archive: true } });
    let rows = await until(list => list.length === 2 && list.every(row => row.Contenu));
    // la personne répond comme GFS le fait (js/sharing/received-files.js) : « Facture » acceptée, « Devis » refusée
    await target.frame.evaluate(() => grist.docApi.applyUserActions([['AddColumn', 'GFS_Recus', 'Accepte', { type: 'Bool', isFormula: false }], ['AddColumn', 'GFS_Recus', 'Refuse', { type: 'Bool', isFormula: false }]]));
    const idFacture = rows.find(row => row.Nom === 'Facture.pdf').id;
    const idDevis = rows.find(row => row.Nom === 'Devis.pdf').id;
    await patch(target, 'GFS_Recus', idFacture, { Accepte: true, Refuse: false });
    await patch(target, 'GFS_Recus', idDevis, { Accepte: false, Refuse: true });
    await addMarks();
    await Promise.all([patch(source, 'GFS_Fichiers', rowOf('Facture.pdf'), { Accepte: false, Refuse: true }), patch(source, 'GFS_Fichiers', rowOf('Devis.pdf'), { Accepte: true, Refuse: false })]);
    const edited = await editExport(first.exp, [...COLUMNS, ...MARKS], [idOf('Facture.pdf'), idOf('Devis.pdf')]);
    check('l\'export gagne les colonnes de marque', edited.ok, edited);
    await source.page.waitForTimeout(4000);
    rows = await until(list => list.length === 2, 10);
    const facture = rows.find(row => row.Nom === 'Facture.pdf');
    const devis = rows.find(row => row.Nom === 'Devis.pdf');
    check('la réponse de la personne tient : « Facture » reste acceptée, « Devis » reste refusée', facture?.Accepte === true && facture?.Refuse !== true && devis?.Refuse === true && devis?.Accepte !== true, marks(rows));
  }
  say('console de la page de l\'envoyeur : ' + JSON.stringify(source.problems.slice(0, 3)));
} finally {
  await browser.close();
  pages.close();
}
