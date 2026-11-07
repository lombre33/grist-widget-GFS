// Le port de GFS pour le moteur de partage (js/sync-port.js) et le moteur de Sync+ (kit/js/synchro/) branchés dans la page de GFS, dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash
// vrai-serveur.sh`) : étude « Partager un dossier avec un autre document », mesure 6. Rien n'est simulé : le port est celui de GFS, ses requêtes REST passent par le vrai cadre d'envoi (origine opaque), le
// moteur est celui du kit. Ce que l'essai fait faire à chaque fonction du port :
//   1. le démarrage du moteur (port complet, tables au préfixe `GFS_`), l'identité du document, le propriétaire ;
//   2. les lignes : lire, écrire (`apply`), le schéma, une lecture SQL, un refus qui rend null ;
//   3. `docChanges` : l'état, puis les tables que touche un ajout ;
//   4. une pièce jointe déposée, relue octet pour octet ;
//   5. les webhooks : créer avec une condition (relue dans _grist_Triggers), lister, ne livrer que les lignes qui la remplissent, désactiver, avis de fin puis effacer ;
//   6. un document public lu sans jeton ; l'envoi de lignes à l'adresse d'un VRAI formulaire publié (`ensureForm` du moteur, la clé lue dans la base du serveur) ; l'adresse d'une autre instance refusée.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-sync-port.mjs
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';

const HOOK_PORT = 9913;
const got = [];
const hook = createServer((request, response) => { let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => { got.push({ url: request.url, body: body.slice(0, 600) }); response.end('ok'); }); }).listen(HOOK_PORT, '127.0.0.1');
const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  const run = await openGfs(context);
  const { page, frame, docId } = run;
  // Le port de GFS, le vrai : le cadre d'envoi, l'API des widgets, le moteur du kit. `window.__p` : le port ; `window.__e` : quelques fonctions du moteur ; `window.__try` : un essai qui rend l'erreur au lieu de la lever.
  const started = await frame.evaluate(async () => {
    const { Transfer, buildTransferFrame } = await import('./js/transfer.js');
    const { startSyncEngine, SYNC_PREFIX } = await import('./js/sync-port.js');
    const common = await import('./kit/js/synchro/logic/common.js');
    const pagesModule = await import('./kit/js/synchro/pages.js');
    const transfer = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
    window.__p = startSyncEngine({ docApi: grist.docApi, transfer, language: () => 'fr' });
    window.__e = { ensureForm: pagesModule.ensureForm, syncTable: () => common.SYNC_TABLE };
    window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, message: String(error.message).slice(0, 200) }; } };
    return { prefix: SYNC_PREFIX, table: common.SYNC_TABLE };
  });
  check('le moteur démarre sur le port de GFS (port complet), ses tables au préfixe GFS_', started.prefix === 'GFS_' && started.table === 'GFS_Synchro', started);

  // 1. Identité et propriétaire.
  const identity = await frame.evaluate(() => window.__p.docIdentity());
  // Grist écrit dans l'adresse REST l'identifiant court du document (les 12 premiers caractères de l'identifiant complet de l'adresse de la page).
  check('docIdentity : l\'identifiant du document et son adresse REST', docId.startsWith(identity.docId) && identity.docId.length >= 10 && identity.baseUrl.endsWith(`/api/docs/${identity.docId}`) && identity.team === 'docs', { identity, docId });
  check('isOwner : la personne d\'essai est propriétaire (vrai, par le cadre)', await frame.evaluate(() => window.__p.isOwner()) === true);

  // 2. Les lignes.
  const added = await frame.evaluate(() => window.__p.apply([['AddRecord', 'Clients', null, { Nom: 'Port 1' }]]));
  check('apply : une ligne ajoutée (identifiant rendu)', Number.isInteger(added.retValues[0]), added);
  check('apply d\'une liste vide : rien n\'est envoyé, rien ne casse', (await frame.evaluate(() => window.__p.apply([]))).retValues.length === 0);
  const rows = await frame.evaluate(() => window.__p.fetchRows('Clients'));
  check('fetchRows : la ligne ajoutée est lue, décodée', rows.some(row => row.Nom === 'Port 1'), rows.map(row => row.Nom));
  const schema = await frame.evaluate(async () => { const s = await window.__p.readSchema(); const t = s.table('Clients'); return { has: Boolean(t), columns: t ? Object.keys(t.columns || {}).length || (t.cols || []).length : 0 }; });
  check('readSchema : la table Clients et ses colonnes', schema.has, schema);
  const selected = await frame.evaluate(() => window.__p.selectRows('Clients', ['Nom'], { Nom: 'Port 1' }));
  check('selectRows : la ligne, lue en SQL avec le jeton qui peut écrire', Array.isArray(selected) && selected.length === 1 && selected[0].Nom === 'Port 1', selected);
  check('une lecture SQL que Grist refuse (table absente) rend null, sans erreur', await frame.evaluate(() => window.__p.selectRows('Absente', ['X'])) === null);

  // 3. Ce qui a changé.
  const changes = hash => frame.evaluate(since => window.__p.docChanges(since).then(found => found && { hash: found.hash, tables: found.tables && [...found.tables] }), hash);
  const first = await changes('');
  check('docChanges sans état de départ : l\'état actuel, pas de liste de tables', first && typeof first.hash === 'string' && first.hash.length > 8 && first.tables === null, first);
  await frame.evaluate(() => window.__p.apply([['AddRecord', 'Clients', null, { Nom: 'Port 2' }]]));
  const since = await changes(first.hash);
  check('docChanges depuis cet état : la table Clients est touchée', since && since.tables && since.tables.includes('Clients') && since.hash !== first.hash, since);
  const raw = await page.evaluate(async address => { const response = await fetch(address); return { status: response.status, body: (await response.text()).slice(0, 300) }; }, `/api/docs/${docId}/compare?left=${'0'.repeat(40)}&right=HEAD&maxRows=1`);
  say('Grist, état de départ inconnu (GET /compare, session) :', raw.status, raw.body);
  const unknown = await changes('0'.repeat(40));
  check('docChanges depuis un état inconnu : relu depuis HEAD (état rendu, pas de liste)', unknown && typeof unknown.hash === 'string' && unknown.tables === null, unknown);

  // 4. Une pièce jointe.
  const bytes = Array.from({ length: 3000 }, (_, i) => (i * 7) % 251);
  const uploaded = await frame.evaluate(list => window.__try(() => window.__p.uploadAttachment('essai.bin', new Uint8Array(list))), bytes);
  check('uploadAttachment : le numéro de la pièce jointe', uploaded.ok && Number.isInteger(uploaded.value), uploaded);
  const back = await frame.evaluate(id => window.__try(async () => Array.from(await window.__p.downloadAttachment(id))), uploaded.value);
  check('downloadAttachment : les mêmes octets, un à un', back.ok && back.value.length === bytes.length && back.value.every((byte, i) => byte === bytes[i]), back.ok ? back.value.length : back);
  const missing = await frame.evaluate(() => window.__try(() => window.__p.downloadAttachment(987654)));
  check('une pièce jointe qui n\'existe pas : une erreur « HTTP 404 »', !missing.ok && /^HTTP (404|400)/.test(missing.message), missing);

  // 5. Les webhooks.
  const hookUrl = `http://127.0.0.1:${HOOK_PORT}/hook`;
  const created = await frame.evaluate(url => window.__try(() => window.__p.createWebhook({ name: 'port', memo: 'essai', url, tableId: 'Clients', condition: '$Nom == "Livré 2"' })), hookUrl);
  check('createWebhook : un identifiant, la condition enregistrée relue (Grist 1.7.19)', created.ok && typeof created.value === 'string', created);
  const id = created.value;
  const listed = await frame.evaluate(() => window.__try(() => window.__p.listWebhooks()));
  check('listWebhooks : le webhook y est, actif, à son adresse', listed.ok && listed.value.some(each => each.id === id && each.fields.url === hookUrl && each.fields.enabled), listed.ok ? listed.value.map(each => each.fields.name) : listed);
  const conditions = await frame.evaluate(() => window.__p.webhookConditions().then(map => [...map]));
  check('webhookConditions : la formule de ce webhook', conditions.some(([key, text]) => key === id && text === '$Nom == "Livré 2"'), conditions);
  await frame.evaluate(() => window.__p.apply([['AddRecord', 'Clients', null, { Nom: 'Pas pour toi' }], ['AddRecord', 'Clients', null, { Nom: 'Livré 2' }]]));
  for (let i = 0; i < 40 && !got.length; i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  check('Grist ne livre que la ligne qui remplit la condition', got.length >= 1 && got.every(each => /Liv/.test(each.body) && !/Pas pour toi/.test(each.body)), got);
  check('setWebhookEnabled : désactivé', (await frame.evaluate(webhook => window.__try(() => window.__p.setWebhookEnabled(webhook, false)), id)).ok);
  check('deleteWebhook : effacé (sa file vidée d\'abord)', (await frame.evaluate(webhook => window.__try(() => window.__p.deleteWebhook(webhook)), id)).ok);
  check('après l\'effacement, la liste n\'a plus ce webhook', !(await frame.evaluate(() => window.__p.listWebhooks())).some(each => each.id === id));
  const gone = await frame.evaluate(webhook => window.__try(() => window.__p.setWebhookEnabled(webhook, true)), id);
  check('un webhook effacé : le refus arrive en erreur, pas en blocage', !gone.ok && /^HTTP (404|400)/.test(gone.message), gone);

  // 6. Document public, formulaire publié, autre instance.
  const share = access => page.evaluate(async ([doc, role]) => (await fetch(`/api/docs/${doc}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: { users: { 'everyone@getgrist.com': role === 'none' ? null : role } } }) })).status, [docId, access]);
  const until = async (job, limit = 30000) => {
    const started = Date.now();
    let answer = await job();
    while (!answer.ok && Date.now() - started < limit) { await page.waitForTimeout(2500); answer = await job(); }
    return answer;
  };
  check('le document devient public en lecture (via la session)', await share('viewers') === 200);
  const records = await until(() => frame.evaluate(base => window.__try(() => window.__p.publicRecords(base, 'Clients', { Nom: ['Port 1'] })), identity.baseUrl));
  check('publicRecords : les lignes filtrées, lues sans jeton depuis le cadre opaque', records.ok && records.value.length === 1 && records.value[0].fields.Nom === 'Port 1', records);
  check('le document cesse d\'être public (via la session)', await share('none') === 200);
  const closed = await until(() => frame.evaluate(base => window.__try(async () => { try { await window.__p.publicRecords(base, 'Clients', {}); return 'lisible'; } catch (error) { return error.message; } }), identity.baseUrl).then(answer => ({ ...answer, ok: answer.value === 'publicClosed' })), 40000);
  check('le document n\'est plus public : « publicClosed »', closed.ok, closed);

  const form = await frame.evaluate(() => window.__try(() => window.__e.ensureForm('Clients')));
  check('ensureForm (moteur) : le formulaire de la table est publié', form.ok, form);
  const link = await frame.evaluate(() => window.__p.fetchRows('_grist_Shares').then(shares => shares.map(each => each.linkId)));
  say('Partage(s) du document :', link.join(', '));
  let key = '';
  for (let i = 0; i < 20 && !key; i++) {
    try { key = execFileSync('docker', ['exec', 'grist', 'python3', '-c', `import sqlite3;print(sqlite3.connect('/persist/home.sqlite3').execute("select key from shares where link_id=?",("${link[link.length - 1]}",)).fetchone()[0])`]).toString().trim(); } catch (error) { await page.waitForTimeout(1000); }
  }
  check('la clé du formulaire est lue dans la base du serveur d\'essai', key.length > 5, key.length);
  const prefix = identity.team ? `/o/${identity.team}` : '';
  const formUrl = `${identity.origin}${prefix}/api/s/${key}/tables/Clients/records?flat=1`;
  const posted = await until(() => frame.evaluate(address => window.__try(() => window.__p.postRows(address, [{ Nom: 'Par le formulaire' }])), formUrl));
  check('postRows : l\'envoi de lignes à l\'adresse d\'un formulaire publié (sans jeton, depuis le cadre opaque)', posted.ok, posted);
  const formRows = await run.rest.rows('Clients');
  check('la ligne envoyée par la clé du formulaire est dans la table', formRows.some(row => row.Nom === 'Par le formulaire'), formRows.map(row => row.Nom));
  // L'avis de fin : le webhook d'un destinataire écrit dans le formulaire publié de l'autre document (même instance) ; le dernier envoi part par cette clé, puis le webhook est effacé.
  const noticed = await frame.evaluate(url => window.__try(async () => {
    const id = await window.__p.createWebhook({ name: 'avis', memo: 'essai', url, tableId: 'Clients', condition: '$Nom == "jamais"' });
    await window.__p.deleteWebhookWithNotice({ id, fields: { url } }, [{ Nom: 'Avis de fin' }]);
    return (await window.__p.listWebhooks()).some(each => each.id === id);
  }), formUrl);
  check('deleteWebhookWithNotice : le dernier envoi arrive par la clé du formulaire, puis le webhook est effacé', noticed.ok && noticed.value === false && (await run.rest.rows('Clients')).some(row => row.Nom === 'Avis de fin'), noticed);
  const other = await frame.evaluate(() => window.__try(() => window.__p.postRows('https://autre-instance.example.org/api/s/CLE/tables/Clients/records?flat=1', [])));
  check('postRows vers une autre instance : « otherInstance », rien ne part', !other.ok && other.message === 'otherInstance', other);
  const wrongKey = await frame.evaluate(address => window.__try(() => window.__p.postRows(address, [{ Nom: 'x' }])), `${identity.origin}${prefix}/api/s/ZZZZ9999AAAA/tables/Clients/records?flat=1`);
  check('une clé qui n\'existe pas : une erreur dite sans la clé en entier', !wrongKey.ok && /^HTTP 4\d\d/.test(wrongKey.message) && !wrongKey.message.includes('ZZZZ9999AAAA'), wrongKey);
  if (run.problems.length) say('Console de GFS :', run.problems.filter(text => !run.allow.some(known => known.test(text))));
} finally {
  hook.close(); pages.close();
  await browser.close();
}
