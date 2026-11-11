// « Partagés avec moi » (09/11) : où retenir qu'un fichier reçu est accepté ou refusé ? Mesuré dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), deux documents qui ont GFS,
// sans écran, avec les fonctions du moteur et le port de GFS ; la réception est « en archive » (ce que fait GFS). Rien ici n'est du code de GFS : c'est la mesure qui décide du choix.
//   1. deux fichiers arrivent (Facture, Devis) ; GFS ajouterait à la table reçue une colonne `Accepte` (Bool) : le moteur laisse-t-il la colonne ? Facture est marquée acceptée, Devis refusée (`Refuse`) ;
//   2. l'envoyeur renomme les deux fichiers (une mise à jour de la copie à jour) : la ligne de Facture prend le nouveau nom, GARDE sa marque, sans doublon ; Devis garde sa marque de refus, sans doublon ;
//   3. contre-épreuve du « refusé = effacé » : la ligne de Devis est supprimée chez l'autre, puis l'envoyeur la modifie encore : la ligne revient-elle ? (si oui, il faut une marque, pas un effacement) ;
//   4. un troisième fichier (Contrat) ajouté à la condition arrive sans marque : c'est lui qui est « à accepter » ;
//   5. aucun passage du moteur n'a levé d'erreur, les colonnes ajoutées sont toujours là.
//   REPO_DIR="$(realpath ../..)" node run-recus-etat.mjs
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
const errors = [];

// Une écriture REST dans le document de `run` (la page de Grist, même origine que l'API).
const send = (run, method, path, body) => run.page.evaluate(async ([id, verb, suffix, payload]) => {
  const response = await fetch(`/api/docs/${id}${suffix}`, { method: verb, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) });
  return { status: response.status, body: await response.text().then(text => text.slice(0, 200)) };
}, [run.docId, method, path, body]);

try {
  const context = await newContext(browser, server);
  const source = await openGfs(context);
  await importSamples(source);
  const target = await openGfs(context);
  await startEngine(source.frame);
  await startEngine(target.frame);
  const files = await source.rest.rows('GFS_Fichiers');
  const idOf = name => files.find(row => row.Nom === name).Identifiant;
  const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf'), idOf('Devis.pdf')], columns: COLUMNS, options: { archive: true } });
  const pass = async () => {
    const swallowed = await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    const consolidated = await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    for (const each of [swallowed, consolidated]) if (!each.ok) errors.push(each.message);
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await source.page.waitForTimeout(1500); } return rows; };
  const named = (rows, name) => rows.filter(row => row.Nom === name);
  const edit = ids => source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
  }), { exp: first.exp, selection: first.selection(ids) });
  const rename = async (from, to) => {
    const row = (await source.rest.rows('GFS_Fichiers')).find(each => each.Nom === from);
    return send(source, 'PATCH', '/tables/GFS_Fichiers/records', { records: [{ id: row.id, fields: { Nom: to } }] });
  };

  say('--- 1. une colonne de GFS dans la table reçue ---');
  let rows = await until(list => ['Facture.pdf', 'Devis.pdf'].every(name => list.some(row => row.Nom === name && row.Contenu)));
  check('deux fichiers arrivés avec leur contenu', rows.length === 2 && rows.every(row => row.Contenu), rows.map(row => row.Nom));
  const added = await send(target, 'POST', '/tables/GFS_Recus/columns', { columns: [{ id: 'Accepte', fields: { type: 'Bool', label: 'Accepte' } }, { id: 'Refuse', fields: { type: 'Bool', label: 'Refuse' } }] });
  check('Grist accepte d\'ajouter deux colonnes (Accepte, Refuse) à la table reçue', added.status === 200, added);
  const facture = named(rows, 'Facture.pdf')[0];
  const devis = named(rows, 'Devis.pdf')[0];
  const accepted = await send(target, 'PATCH', '/tables/GFS_Recus/records', { records: [{ id: facture.id, fields: { Accepte: true } }] });
  const refused = await send(target, 'PATCH', '/tables/GFS_Recus/records', { records: [{ id: devis.id, fields: { Refuse: true } }] });
  check('Facture est marquée acceptée, Devis refusé', accepted.status === 200 && refused.status === 200, { accepted, refused });

  say('--- 2. l\'envoyeur renomme : la marque tient ---');
  await rename('Facture.pdf', 'Facture v2.pdf');
  await rename('Devis.pdf', 'Devis v2.pdf');
  rows = await until(list => list.some(row => row.Nom === 'Facture v2.pdf') && list.some(row => row.Nom === 'Devis v2.pdf'));
  say('GFS_Recus après le renommage :', JSON.stringify(rows.map(row => ({ id: row.id, Nom: row.Nom, Accepte: row.Accepte, Refuse: row.Refuse }))));
  const f2 = named(rows, 'Facture v2.pdf');
  const d2 = named(rows, 'Devis v2.pdf');
  check('la mise à jour arrive sur la MÊME ligne de Facture (pas de doublon) et la marque « acceptée » tient', rows.length === 2 && f2.length === 1 && f2[0].id === facture.id && f2[0].Accepte === true, rows.map(row => [row.id, row.Nom, row.Accepte]));
  check('la mise à jour de Devis arrive sur sa ligne, la marque « refusé » tient, pas de doublon', d2.length === 1 && d2[0].id === devis.id && d2[0].Refuse === true, rows.map(row => [row.id, row.Nom, row.Refuse]));

  say('--- 3. contre-épreuve : effacer la ligne refusée ---');
  const erased = await send(target, 'POST', '/tables/GFS_Recus/data/delete', [devis.id]);
  say('effacement de la ligne de Devis :', JSON.stringify(erased));
  await rename('Devis v2.pdf', 'Devis v3.pdf');
  rows = await until(list => list.some(row => row.Nom === 'Devis v3.pdf'), 14);
  const back = named(rows, 'Devis v3.pdf');
  say(back.length ? 'la ligne effacée est REVENUE avec la mise à jour' : 'la ligne effacée n\'est pas revenue', JSON.stringify(rows.map(row => row.Nom)));
  check('(mesure) une ligne effacée chez l\'autre : revient-elle à la mise à jour suivante ? réponse relevée ci-dessus', true, { revenue: back.length === 1 });

  say('--- 4. un fichier de plus arrive « à accepter » ---');
  await importPdf(source.page, source.frame, pdfFile('Contrat.pdf', 2, 'Contrat').file);
  await waitForNames(source.frame, ['Contrat.pdf', 'Devis v3.pdf', 'Facture v2.pdf']);
  const contratId = (await source.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Contrat.pdf').Identifiant;
  const widened = await edit([idOf('Facture.pdf'), idOf('Devis.pdf'), contratId]);
  check('Contrat entre dans la condition', widened.ok, widened);
  rows = await until(list => list.some(row => row.Nom === 'Contrat.pdf' && row.Contenu));
  const contrat = named(rows, 'Contrat.pdf');
  check('Contrat arrive avec son contenu et SANS marque (ni Accepte ni Refuse) : c\'est lui qui est « à accepter »', contrat.length === 1 && Boolean(contrat[0].Contenu) && !contrat[0].Accepte && !contrat[0].Refuse, contrat);

  say('--- 5. le moteur n\'a rien levé ---');
  const columns = (await target.rest.columns('GFS_Recus')).map(column => column.id);
  check('aucun passage du moteur n\'a levé d\'erreur, et Accepte et Refuse sont toujours des colonnes de la table reçue', errors.length === 0 && columns.includes('Accepte') && columns.includes('Refuse'), { errors, columns });
} finally {
  await browser.close();
  pages.close();
}
