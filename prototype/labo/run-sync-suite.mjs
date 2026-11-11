// Après une première acceptation, que peut-il arriver SANS nouvelle invitation ? (schéma du 09/11 : « les noms avant d'accepter », « une copie qui se met à jour »), dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), deux documents qui ont GFS. Mesure sans écran, avec les fonctions du moteur et le port de GFS :
//   1. un premier partage (Facture), l'export reste actif (« à jour ») ;
//   2. le second PDF (Devis) est ajouté à l'export déjà accepté (la condition s'élargit : `finishEdit`) : arrive-t-il dans le même journal, puis dans `GFS_Recus`, sans nouvelle invitation ?
//   3. un PDF NOUVEAU de la source (jamais cité par l'export) : part-il ? (non : la condition ne le nomme pas) ;
//   4. ce que le journal de la cible montre d'une arrivée AVANT qu'elle soit recopiée (les noms sont-ils lisibles tels que GFS les montrerait avant l'acceptation ?).
//   REPO_DIR="$(realpath ../..)" node run-sync-suite.mjs
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

try {
  const context = await newContext(browser, server);
  const source = await openGfs(context);
  await importSamples(source);
  const target = await openGfs(context);
  await startEngine(source.frame);
  await startEngine(target.frame);
  const devisId = (await source.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Devis.pdf').Identifiant;

  say('--- 1. un premier partage, l\'export reste actif ---');
  const first = await handshake(source, target, { name: 'Facture', ids: [source.id], columns: COLUMNS });
  const pass = async () => {
    await source.frame.evaluate(() => window.__s.catchUp());
    await target.frame.evaluate(() => window.__s.consolidateAll({ reread: true }));
    return target.rest.rows('GFS_Recus');
  };
  let rows = [];
  for (let i = 0; i < 40 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i++) { await delay(source.page, 1500); rows = await pass(); }
  check('le premier fichier est arrivé (Facture), et lui seul', rows.length === 1 && rows[0].Nom === 'Facture.pdf' && Boolean(rows[0].Contenu), rows.map(row => row.Nom));

  say('--- 2. un second fichier ajouté à l\'export déjà accepté ---');
  const edited = await source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return { changed: done.changed, sent: await window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed }) };
  }), { exp: first.exp, selection: first.selection([source.id, devisId]) });
  say('modification de l\'export :', JSON.stringify(edited));
  check('l\'export accepte une condition élargie (même invitation, même webhook)', edited.ok, edited);
  // Les lignes du journal de la cible : leur type, et la colonne qui porte le nom du fichier (sans la recopie dans `GFS_Recus`).
  const journalNames = () => target.frame.evaluate(name => window.__p.fetchRows(name).then(list => list.filter(row => row.Synchro_Type === 'lot' || row.Synchro_Type === 'liste').map(row => ({ type: row.Synchro_Type, table: row.Synchro_Table, columnWithName: Object.keys(row).filter(key => String(row[key]).includes('Devis.pdf')) }))), first.journal);
  await source.frame.evaluate(() => window.__s.catchUp());
  await delay(source.page, 2500);
  const beforeCopy = await journalNames();
  say('journal de la cible AVANT recopie :', JSON.stringify(beforeCopy));
  const inJournal = beforeCopy.some(row => row.columnWithName.length > 0);
  check('le nom du second fichier est lisible dans le journal de la cible avant toute recopie', inJournal, beforeCopy.length);
  let after = [];
  for (let i = 0; i < 40 && !after.some(row => row.Nom === 'Devis.pdf' && row.Contenu); i++) { after = await pass(); if (!after.some(row => row.Nom === 'Devis.pdf' && row.Contenu)) await delay(source.page, 1500); }
  check('le second fichier arrive dans GFS_Recus sans nouvelle invitation, avec son contenu', after.some(row => row.Nom === 'Devis.pdf' && row.Contenu), after.map(row => ({ Nom: row.Nom, Contenu: row.Contenu })));

  say('--- 3. un PDF nouveau de la source, jamais cité par l\'export ---');
  await importPdf(source.page, source.frame, pdfFile('Contrat.pdf', 2, 'Contrat').file);
  await waitForNames(source.frame, ['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  let last = [];
  for (let i = 0; i < 6; i++) { last = await pass(); await delay(source.page, 1500); }
  check('un PDF neuf n\'arrive pas tout seul (l\'export ne le nomme pas) : il faut l\'ajouter à la condition', !last.some(row => row.Nom === 'Contrat.pdf'), last.map(row => row.Nom));
  const named = await source.frame.evaluate(id => window.__try(async () => {
    const [entry] = (await window.__p.fetchRows('GFS_Fichiers')).filter(row => row.Nom === 'Contrat.pdf');
    return entry.Identifiant;
  }), '');
  const widened = await source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
  }), { exp: first.exp, selection: first.selection([source.id, devisId, named.value]) });
  let again = [];
  for (let i = 0; i < 40 && !again.some(row => row.Nom === 'Contrat.pdf' && row.Contenu); i++) { again = await pass(); if (!again.some(row => row.Nom === 'Contrat.pdf' && row.Contenu)) await delay(source.page, 1500); }
  check('ajouté à la condition (un geste de GFS, pas de la personne), il arrive avec son contenu', widened.ok && again.some(row => row.Nom === 'Contrat.pdf' && row.Contenu), { widened, rows: again.map(row => row.Nom) });
  const stillThere = await source.frame.evaluate(() => window.__p.listWebhooks().then(list => list.length));
  say('webhooks de la source après les ajouts :', stillThere);
  for (const each of [source, target]) if (each.problems.length) say('Console de GFS :', each.problems.filter(text => !each.allow.some(known => known.test(text))));
} finally {
  await browser.close();
  pages.close();
}
