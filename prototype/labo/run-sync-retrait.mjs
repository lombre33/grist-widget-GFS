// Retirer un fichier de la condition d'un partage « à jour » : la copie reste-t-elle chez l'autre ? (« Une copie, une fois » et « Arrêter » dans Partager > Dans un autre document Grist, 09/11), dans un
// VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), deux documents qui ont GFS, sans écran, avec les fonctions du moteur et le port de GFS :
//   1. un partage à jour de deux fichiers (Facture, Devis), les deux arrivent avec leur contenu ;
//   2. Devis est retiré de la condition (`saveChosenExport` + `finishEdit`) : reste-t-il dans `GFS_Recus` après le prochain passage ? et son contenu ?
//   3. Devis est remis dans la condition : revient-il sans doublon ?
//   4. la même chose quand la réception est « en archive » (option du moteur : rien n'est effacé à l'arrivée d'un retrait) ;
//   5. tous les fichiers sortent de la condition : avec `selectionFor([])` de GFS (js/sharing/share-links.js), qui nomme un identifiant inexistant, rien d'autre ne part (un PDF jamais cité reste chez l'envoyeur) ;
//   6. contre-épreuve : une condition SANS valeur envoie tout.
//   REPO_DIR="$(realpath ../..)" node run-sync-retrait.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames } from './lab-pdf.mjs';
import { startEngine, handshake } from './lab-partage.mjs';

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const delay = (page, ms) => page.waitForTimeout(ms);

async function scenario(context, label, options) {
  say(`=== ${label} ===`);
  const source = await openGfs(context);
  await importSamples(source);
  const target = await openGfs(context);
  await startEngine(source.frame);
  await startEngine(target.frame);
  const devisId = (await source.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Devis.pdf').Identifiant;
  const first = await handshake(source, target, { name: 'Lot', ids: [source.id, devisId], columns: COLUMNS, options });
  const pass = async () => {
    await source.frame.evaluate(() => window.__s.catchUp());
    await target.frame.evaluate(() => window.__s.consolidateAll({ reread: true }));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await delay(source.page, 1500); } return rows; };
  const both = rows => ['Facture.pdf', 'Devis.pdf'].every(name => rows.some(row => row.Nom === name && row.Contenu));
  let rows = await until(both);
  check('1. les deux fichiers sont arrivés avec leur contenu', both(rows), rows.map(row => ({ Nom: row.Nom, Contenu: Boolean(row.Contenu) })));
  const edit = ids => source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return { changed: done.changed, sent: await window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed }) };
  }), { exp: first.exp, selection: first.selection(ids) });
  const removed = await edit([source.id]);
  say('retrait de Devis de la condition :', JSON.stringify(removed));
  rows = await until(() => false, 6);
  const devis = rows.filter(row => row.Nom === 'Devis.pdf');
  say('après le retrait, GFS_Recus :', JSON.stringify(rows.map(row => ({ Nom: row.Nom, Contenu: Boolean(row.Contenu), Archive: row.Supprimee_a_la_source ?? row.Supprim_e_la_source ?? Object.entries(row).filter(([key]) => /archiv|suppr/i.test(key)) }))));
  if (options.archive) check('2. réception en archive : Devis reste chez l\'autre après son retrait de la condition, avec son contenu, marqué « supprimé à la source »', devis.length === 1 && Boolean(devis[0].Contenu) && devis[0].Supprimee_a_la_source === true, devis.map(row => ({ Nom: row.Nom, Contenu: Boolean(row.Contenu), Archive: row.Supprimee_a_la_source })));
  else check('2. réception normale : Devis est EFFACÉ chez l\'autre à son retrait de la condition (c\'est pourquoi GFS reçoit toujours en archive)', devis.length === 0, devis.map(row => row.Nom));
  check('2b. Facture est restée', rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu), rows.map(row => row.Nom));
  const back = await edit([source.id, devisId]);
  rows = await until(() => false, 6);
  check('3. Devis remis dans la condition : une seule ligne, pas de doublon', rows.filter(row => row.Nom === 'Devis.pdf').length === 1, rows.map(row => row.Nom));
  say('remise :', JSON.stringify(back));
  if (options.archive) {
    await importPdf(source.page, source.frame, pdfFile('Contrat.pdf', 2, 'Contrat').file);
    await waitForNames(source.frame, ['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
    const empty = await source.frame.evaluate(args => window.__try(async () => {
      const { selectionFor } = await import('./js/sharing/share-links.js');
      const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: selectionFor([]) });
      return { filter: JSON.stringify(selectionFor([])[0].filter), sent: await window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed }) };
    }), { exp: first.exp });
    say('condition vide (identifiant inexistant) :', JSON.stringify(empty));
    rows = await until(() => false, 6);
    check('5. aucun fichier dans la condition : le PDF jamais cité (Contrat) ne part pas, les deux autres restent chez l\'autre', empty.ok && rows.length === 2 && !rows.some(row => row.Nom === 'Contrat.pdf'), rows.map(row => row.Nom));
    const bare = await source.frame.evaluate(args => window.__try(async () => {
      const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: [{ table: 'GFS_Fichiers', columns: ['Identifiant', 'Nom'], filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: [] }] } }] });
      return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
    }), { exp: first.exp });
    rows = await until(rows => rows.some(row => row.Nom === 'Contrat.pdf'), 10);
    check('6. contre-épreuve : une condition SANS valeur est écartée par le moteur et TOUS les fichiers partent (d\'où l\'identifiant fictif de GFS)', bare.ok && rows.some(row => row.Nom === 'Contrat.pdf'), rows.map(row => row.Nom).join());
  }
  return { source, target };
}

try {
  const context = await newContext(browser, server);
  await scenario(context, 'réception normale', {});
  await scenario(context, 'réception en archive', { archive: true });
} finally {
  await browser.close();
  pages.close();
}
