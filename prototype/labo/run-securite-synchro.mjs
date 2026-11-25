// Audit de sécurité du 09/11 : les tables techniques du partage entre documents (`GFS_Synchro` côté qui envoie, `GFS_Journal_*` côté qui reçoit) rangent des morceaux de PDF et les clés qui signent les envois.
// Sans règle, toute personne qui ouvre le document les lit. Choix du porteur : « les fermer comme les fichiers » (js/sharing/sync-rules.js : propriétaires seuls ; un journal garde la création ouverte, c'est par elle que le
// formulaire de réception y écrit). Mesuré dans un VRAI Grist, avec trois comptes, un à la fois (le serveur n'en connaît qu'un : on le relance sous chacun), en cinq passages :
//   PHASE=proprietaire  essai@ : deux documents qui ont GFS, un vrai partage « à jour » (Facture.pdf arrive), les deux documents partagés à editor@ et viewer@ ; aucune règle n'est encore posée ;
//   PHASE=avant         editor@ puis viewer@ : AVANT le correctif, ils lisent les morceaux de PDF et les clés (mesure du défaut) ;
//   PHASE=ferme         essai@ rouvre les deux documents : GFS pose les règles (une seule fois, Grist recharge la page), un second passage ne pose rien et ne recharge rien, le partage CONTINUE (un
//                       fichier renommé à la source arrive à la cible, par le formulaire, sous `-RUD`), le propriétaire lit toujours les tables ;
//   PHASE=apres         editor@ puis viewer@ : ils ne lisent plus rien des tables techniques, n'y écrivent ni n'y effacent rien, les ouvrent sans bruit dans GFS ;
//   PHASE=arret         essai@ arrête le partage : la table disparaît, ses règles restent, le document s'ouvre encore.
//   GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh && PHASE=proprietaire REPO_DIR="$(realpath ../..)" node run-securite-synchro.mjs
//   GRIST_EMAIL=editor@example.com GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh && PHASE=avant node run-securite-synchro.mjs   (puis viewer@, puis `ferme` sous essai@, puis `apres` sous chacun)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext, GRIST } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, importSamples, KNOWN_MESSAGES, GFS } from './lab-pdf.mjs';
import { gfsFrame, shareWithEditorAndViewer } from './lab-droits.mjs';
import { startEngine, handshake } from './lab-partage.mjs';

const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.SECURITE_ETAT || '/tmp/securite-synchro-etat.json';
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const who = process.env.GRIST_EMAIL || 'essai@example.com';
const delay = (page, ms) => page.waitForTimeout(ms);
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 200) };
}, [method, path, body]);
const rows = async (page, id, table) => { const answer = await call(page, 'GET', `/api/docs/${id}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : answer; };
const apply = (page, id, actions) => call(page, 'POST', `/api/docs/${id}/apply`, actions);
const readable = list => Array.isArray(list) && list.length > 0;
const aclOf = async (page, id) => {
  const [resources, rules] = await Promise.all(['_grist_ACLResources', '_grist_ACLRules'].map(name => rows(page, id, name)));
  const byId = new Map((Array.isArray(resources) ? resources : []).map(each => [each.id, each]));
  return (Array.isArray(rules) ? rules : []).filter(rule => /^GFS\s*:\s*Partages/.test(rule.memo || '')).map(rule => ({ table: (byId.get(rule.resource) || {}).tableId, formula: rule.aclFormula, rights: rule.permissionsText }));
};
const journalOf = async (page, id) => { const tables = await call(page, 'GET', `/api/docs/${id}/tables`); return tables.json.tables.map(table => table.id).find(name => /^GFS_Journal_/.test(name)); };

// Un document déjà préparé, rouvert par la personne : la page « Clients » porte GFS ; la console de GFS est relevée (hors les messages connus de Grist).
async function reopen(context, path) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && (message.location().url.startsWith(new URL(GFS).origin) || /Content Security Policy|Refused to/.test(message.text()))) problems.push(`${message.location().url.slice(0, 120)}:${message.location().lineNumber} ${message.text().slice(0, 300)}`); });
  await page.goto(`${GRIST}${path}`, { waitUntil: 'load' });
  await page.locator('.test-onboarding-popup').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.getByText('Clients', { exact: true }).first().click();
  return { page, problems, unexpected: () => problems.filter(each => !KNOWN_MESSAGES.some(known => known.test(each))) };
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, {});
  if (phase === 'proprietaire') {
    say('--- essai@ : deux documents, un vrai partage « à jour » ---');
    const source = await openGfs(context);
    await importSamples(source);
    const target = await openGfs(context);
    await startEngine(source.frame);
    await startEngine(target.frame);
    const first = await handshake(source, target, { name: 'Facture', ids: [source.id], columns: COLUMNS });
    const pass = async () => {
      await source.frame.evaluate(() => window.__s.catchUp());
      await target.frame.evaluate(() => window.__s.consolidateAll({ reread: true }));
      return target.rest.rows('GFS_Recus');
    };
    let received = [];
    for (let i = 0; i < 40 && !received.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i += 1) { await delay(source.page, 1500); received = await pass(); }
    check('Facture.pdf est arrivé dans GFS_Recus (le partage marche avant toute règle)', received.some(row => row.Nom === 'Facture.pdf' && row.Contenu), received.map(row => row.Nom));
    const journal = await journalOf(target.page, target.docId);
    check('aucune règle des tables du partage n\'est posée (le document d\'avant)', (await aclOf(source.page, source.docId)).length === 0 && (await aclOf(target.page, target.docId)).length === 0);
    say('partage de la source :', await shareWithEditorAndViewer(source.page, source.docId), '; de la cible :', await shareWithEditorAndViewer(target.page, target.docId));
    // Une colonne et une ligne qui EXISTENT : un refus d'écriture doit venir des règles, jamais d'une colonne ou d'une ligne absente.
    const synchroRows = await rows(source.page, source.docId, 'GFS_Synchro');
    const journalRows = await rows(target.page, target.docId, journal);
    check('le propriétaire lit GFS_Synchro et le journal (lignes présentes)', readable(synchroRows) && readable(journalRows), { synchro: synchroRows.length, journal: journalRows.length });
    const column = Object.keys(synchroRows[0]).find(key => !/^(id|gristHelper_)/.test(key));
    writeFileSync(STATE, JSON.stringify({ source: { id: source.docId, path: source.path }, target: { id: target.docId, path: target.path }, journal, fileId: source.id, exp: first.exp, column, synchroRow: synchroRows[0].id, journalRow: journalRows[0].id }));
    say('état gardé dans', STATE, '; journal :', journal);
  } else {
    const state = JSON.parse(readFileSync(STATE, 'utf8'));
    const page = await context.newPage();
    await page.goto(`${GRIST}/`, { waitUntil: 'load' });
    await delay(page, 2500);
    if (phase === 'avant' || phase === 'apres') {
      const after = phase === 'apres';
      say(`--- ${who} : ${after ? 'APRÈS' : 'AVANT'} la fermeture des tables techniques ---`);
      const synchro = await rows(page, state.source.id, 'GFS_Synchro');
      const journal = await rows(page, state.target.id, state.journal);
      say('GFS_Synchro :', JSON.stringify(readable(synchro) ? { lignes: synchro.length, colonnes: Object.keys(synchro[0]).slice(0, 8) } : synchro), '; journal :', JSON.stringify(readable(journal) ? { lignes: journal.length, types: [...new Set(journal.map(row => row.Synchro_Type))] } : journal));
      if (!after) {
        check('AVANT : un éditeur / lecteur LIT GFS_Synchro (les clés qui signent les envois)', readable(synchro), readable(synchro) ? { lignes: synchro.length } : synchro);
        check('AVANT : il LIT le journal reçu (les morceaux de PDF, y compris ceux qu\'il n\'a pas le droit de lire par fichier)', readable(journal), readable(journal) ? { lignes: journal.length } : journal);
      } else {
        check('APRÈS : GFS_Synchro ne se lit plus (aucune ligne rendue)', !readable(synchro), readable(synchro) ? { lignes: synchro.length } : synchro);
        check('APRÈS : le journal reçu ne se lit plus (aucune ligne rendue)', !readable(journal), readable(journal) ? { lignes: journal.length } : journal);
        const written = await apply(page, state.source.id, [['AddRecord', 'GFS_Synchro', null, { [state.column]: 'x' }]]);
        check('APRÈS : écrire dans GFS_Synchro est refusé', written.status !== 200, written.text);
        const erased = await apply(page, state.source.id, [['BulkRemoveRecord', 'GFS_Synchro', [state.synchroRow]]]);
        check('APRÈS : effacer une ligne de GFS_Synchro est refusé', erased.status !== 200, erased.text);
        const touched = await apply(page, state.target.id, [['BulkUpdateRecord', state.journal, [state.journalRow], { Synchro_Type: ['x'] }]]);
        check('APRÈS : modifier une ligne du journal est refusé', touched.status !== 200, touched.text);
        const removed = await apply(page, state.target.id, [['BulkRemoveRecord', state.journal, [state.journalRow]]]);
        check('APRÈS : effacer une ligne du journal est refusé', removed.status !== 200, removed.text);
        const received = await rows(page, state.target.id, 'GFS_Recus');
        say('GFS_Recus (non fermée : « Partagés avec moi », carte 4c) :', JSON.stringify(readable(received) ? received.map(row => row.Nom) : received));
        say(`--- ${who} ouvre GFS sur la cible : aucun bruit ni boucle du moteur ---`);
        const opened = await reopen(context, state.target.path);
        const frame = await gfsFrame(opened.page);
        await delay(opened.page, 5000);
        check('GFS s\'ouvre sans boucle du moteur de partage et sans erreur dans la console', opened.unexpected().length === 0 && (await frame.evaluate(() => document.body.dataset.gfs)) === 'ready', opened.unexpected());
      }
    } else if (phase === 'ferme') {
      say('--- essai@ rouvre les deux documents : GFS pose les règles ---');
      const target = await reopen(context, state.target.path);
      const source = await reopen(context, state.source.path);
      const admin = await context.newPage();
      await admin.goto(`${GRIST}/`, { waitUntil: 'load' });
      let acl = { source: [], target: [] };
      for (let i = 0; i < 90 && !(acl.source.length && acl.target.length); i += 1) { await delay(admin, 1000); acl = { source: await aclOf(admin, state.source.id), target: await aclOf(admin, state.target.id) }; }
      say('règles posées — source :', JSON.stringify(acl.source), '; cible :', JSON.stringify(acl.target));
      check('GFS_Synchro : propriétaires +CRUD, tous les autres -CRUD', acl.source.length === 2 && acl.source[0].formula === 'user.Access in [OWNER]' && acl.source[0].rights === '+CRUD' && acl.source[1].rights === '-CRUD', acl.source);
      check('le journal reçu : propriétaires +CRUD, tous les autres -RUD (la création reste ouverte)', acl.target.length === 2 && acl.target.every(rule => rule.table === state.journal) && acl.target[1].rights === '-RUD', acl.target);
      const targetFrame = await gfsFrame(target.page);
      const sourceFrame = await gfsFrame(source.page);
      await delay(target.page, 3000);
      await Promise.all([targetFrame, sourceFrame].map(frame => frame.evaluate(() => { window.__marque = 1; })));
      await delay(target.page, 9000);
      const kept = await Promise.all([targetFrame, sourceFrame].map(frame => frame.evaluate(() => window.__marque === 1)));
      const again = { source: await aclOf(admin, state.source.id), target: await aclOf(admin, state.target.id) };
      check('un second passage ne pose rien et ne recharge rien (les règles sont les mêmes, la page est restée)', JSON.stringify(again) === JSON.stringify(acl) && kept.every(Boolean), { kept, again });
      check('le propriétaire lit toujours les tables techniques', readable(await rows(admin, state.source.id, 'GFS_Synchro')) && readable(await rows(admin, state.target.id, state.journal)));
      say('--- le partage continue sous les règles ---');
      const sourceRow = (await rows(admin, state.source.id, 'GFS_Fichiers')).find(row => row.Identifiant === state.fileId);
      const newName = `Facture-${Date.now() % 100000}.pdf`;
      const renamed = await apply(admin, state.source.id, [['UpdateRecord', 'GFS_Fichiers', sourceRow.id, { Nom: newName }]]);
      check('le propriétaire renomme le fichier à la source', renamed.status === 200, renamed.text);
      let landed = [];
      for (let i = 0; i < 60 && !landed.some(row => row.Nom === newName); i += 1) { await delay(admin, 1500); landed = await rows(admin, state.target.id, 'GFS_Recus'); }
      check('le nouveau nom arrive à la cible par le webhook et le formulaire (création ouverte sous -RUD), recopié par la boucle du propriétaire', Array.isArray(landed) && landed.some(row => row.Nom === newName && row.Contenu), Array.isArray(landed) ? landed.map(row => row.Nom) : landed);
      check('aucune erreur de GFS dans la console du propriétaire', [target, source].every(each => each.unexpected().length === 0), [target, source].map(each => each.unexpected()));
    } else if (phase === 'arret') { // essai@, après les passages `apres` : la table disparaît, les règles restent
      say('--- arrêter le partage : le document reste ouvrable ---');
      const admin = await context.newPage();
      await admin.goto(`${GRIST}/`, { waitUntil: 'load' });
      const source = await reopen(context, state.source.path);
      const sourceFrame = await gfsFrame(source.page);
      await startEngine(sourceFrame);
      const ended = await sourceFrame.evaluate(exp => window.__try(() => window.__s.endExport(exp)), { ...state.exp, recipients: [] });
      say('endExport :', JSON.stringify(ended).slice(0, 200));
      await delay(admin, 4000);
      const tablesAfter = (await call(admin, 'GET', `/api/docs/${state.source.id}/tables`)).json.tables.map(table => table.id);
      const leftover = (await aclOf(admin, state.source.id)).filter(rule => !tablesAfter.includes(rule.table));
      say('tables de la source après l\'arrêt :', tablesAfter.filter(name => /^GFS_/.test(name)).join(', '), '; règles restées sur une table disparue :', JSON.stringify(leftover));
      const reopened = await reopen(context, state.source.path);
      const frame = await gfsFrame(reopened.page);
      check('la source s\'ouvre encore après l\'arrêt du partage, GFS prêt (des règles sur une table disparue ne bloquent rien)', (await frame.evaluate(() => document.body.dataset.gfs)) === 'ready' && (await rows(admin, state.source.id, 'GFS_Fichiers')).length > 0, leftover);
      check('aucune erreur de GFS dans la console du propriétaire', [source, reopened].every(each => each.unexpected().filter(text => !/KeyError 'GFS_Synchro'/.test(text)).length === 0), [source, reopened].map(each => each.unexpected()));
    }
  }
} finally {
  await browser.close();
  pages.close();
}
