// Un dossier partagé entre deux documents, « un seul lien par document » (carte du 11/11, option 1 : le nom du dossier voyage dans une colonne de plus de la table des fichiers) : MESURE, dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), de ce que le moteur de partage fait d'une colonne ajoutée APRÈS le premier partage. Sans cela, rien de ce qui suit ne tient.
//   1. un lien existe (un fichier part, sans la colonne) ; l'envoyeur ajoute `Dossier_partage` à `GFS_Fichiers`, la renseigne pour deux fichiers, et enregistre la condition ET la colonne de l'export ;
//   2. la table reçue gagne-t-elle la colonne ? porte-t-elle les valeurs ? le fichier déjà reçu reste-t-il intact (sa marque `Accepte`) ?
//   3. l'envoyeur change le nom du dossier (une cellule) : la table reçue suit-elle ?
//   4. un fichier retiré du dossier (la cellule vidée) : la table reçue suit-elle ?
// REPO_DIR="$(realpath ../..)" node run-dossier-colonne.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames } from './lab-pdf.mjs';
import { startEngine, handshake } from './lab-partage.mjs';

const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const FOLDER = 'Dossier_partage';

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
  const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf')], columns: COLUMNS, options: { archive: true } });

  const pass = async () => {
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await source.page.waitForTimeout(1500); } return rows; };
  const patch = (run, table, id, fields) => run.page.evaluate(async ([doc, name, row, values]) => (await fetch(`/api/docs/${doc}/tables/${name}/records`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ records: [{ id: row, fields: values }] }) })).status, [run.docId, table, id, fields]);

  let rows = await until(list => list.length === 1 && list[0].Contenu);
  check('le premier fichier est arrivé, sans la colonne de dossier', rows.length === 1 && !(FOLDER in rows[0]), Object.keys(rows[0] || {}));
  // La marque s'écrit comme GFS l'écrit (js/received-files.js, `answerFile`) : les deux colonnes sont ajoutées à la table reçue, puis la ligne est marquée.
  await target.frame.evaluate(() => grist.docApi.applyUserActions([['AddColumn', 'GFS_Recus', 'Accepte', { type: 'Bool', isFormula: false }], ['AddColumn', 'GFS_Recus', 'Refuse', { type: 'Bool', isFormula: false }]]));
  const marked = await patch(target, 'GFS_Recus', rows[0].id, { Accepte: true });
  check('la première arrivée est marquée « acceptée »', marked === 200, marked);

  say('--- 1. l\'envoyeur ajoute la colonne, la renseigne, et l\'ajoute à l\'export ---');
  await source.frame.evaluate(column => grist.docApi.applyUserActions([['AddColumn', 'GFS_Fichiers', column, { type: 'Text', isFormula: false }]]), FOLDER);
  const set = await Promise.all([patch(source, 'GFS_Fichiers', rowOf('Devis.pdf'), { [FOLDER]: 'Contrats' }), patch(source, 'GFS_Fichiers', rowOf('Contrat.pdf'), { [FOLDER]: 'Contrats' })]);
  check('la colonne est posée, deux fichiers y portent « Contrats »', set.every(status => status === 200), set);
  const columns = [...COLUMNS, FOLDER];
  const selection = ids => [{ table: 'GFS_Fichiers', columns, filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: ids }] } }];
  const edited = await source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    await window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
    return done.changed.length;
  }), { exp: first.exp, selection: selection([idOf('Facture.pdf'), idOf('Devis.pdf'), idOf('Contrat.pdf')]) });
  check('l\'export est enregistré avec la colonne de plus et deux fichiers de plus', edited.ok, edited);

  say('--- 2. ce que la table reçue devient ---');
  rows = await until(list => list.length === 3 && list.every(row => row.Contenu));
  const byName = name => rows.find(row => row.Nom === name);
  check('les trois fichiers sont là', rows.length === 3, rows.map(row => row.Nom));
  check('la table reçue a gagné la colonne', rows.every(row => FOLDER in row), Object.keys(rows[0] || {}));
  check('« Devis » et « Contrat » portent « Contrats », « Facture » est vide', byName('Devis.pdf')?.[FOLDER] === 'Contrats' && byName('Contrat.pdf')?.[FOLDER] === 'Contrats' && !byName('Facture.pdf')?.[FOLDER], rows.map(row => [row.Nom, row[FOLDER]]));
  check('« Facture » reçue plus tôt garde sa marque et son contenu (rien n\'est renvoyé de zéro)', byName('Facture.pdf')?.Accepte === true && Boolean(byName('Facture.pdf')?.Contenu), byName('Facture.pdf'));

  say('--- 3. le nom du dossier change chez l\'envoyeur ---');
  await patch(source, 'GFS_Fichiers', rowOf('Devis.pdf'), { [FOLDER]: 'Marchés' });
  await patch(source, 'GFS_Fichiers', rowOf('Contrat.pdf'), { [FOLDER]: 'Marchés' });
  rows = await until(list => list.filter(row => row[FOLDER] === 'Marchés').length === 2, 40);
  check('la table reçue suit le nouveau nom', rows.filter(row => row[FOLDER] === 'Marchés').length === 2, rows.map(row => [row.Nom, row[FOLDER]]));

  say('--- 4. un fichier sort du dossier (cellule vidée) ---');
  await patch(source, 'GFS_Fichiers', rowOf('Contrat.pdf'), { [FOLDER]: '' });
  rows = await until(list => list.find(row => row.Nom === 'Contrat.pdf')?.[FOLDER] === '', 40);
  check('la table reçue le montre sans dossier, la ligne est toujours là', rows.length === 3 && rows.find(row => row.Nom === 'Contrat.pdf')?.[FOLDER] === '', rows.map(row => [row.Nom, row[FOLDER]]));
} finally {
  await browser.close();
  pages.close();
}
