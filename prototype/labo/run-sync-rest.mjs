// Les requêtes REST que le moteur de Sync+ fera passer par GFS, jouées depuis le VRAI cadre d'envoi de GFS (origine opaque, `connect-src https:`, sans cookie) dans un VRAI serveur Grist (`GRIST_DOCKER_ARGS="-e
// ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`) : étude « Partager un dossier avec un autre document », mesure 5, `Transfer.rest` et `Transfer.anonymous` (contrats 6.6, point 15).
// GFS est ajouté à un document comme le fait la personne (accès complet) ; l'essai ouvre dans son cadre un second `Transfer` (le vrai, js/broker/transfer.js) et lui fait faire ce que fait `js/grist.js` de Sync+ :
//   1. être propriétaire (`GET /webhooks`), puis le cycle d'un webhook : créer (avec une condition), lister, désactiver, vider sa file, effacer ; Grist livre bien l'ajout d'une ligne à l'adresse du webhook ;
//   2. un refus (404 sur un webhook qui n'existe pas) arrive avec son code, sans casser le cadre ;
//   3. un document public : lecture sans jeton (`Origin: null`) d'une table filtrée, par `anonymous` ; refusée tant que le document n'est pas public ;
//   4. l'envoi de lignes sans jeton (public en édition) : `anonymous('POST', …)` avec le corps JSON ; l'adresse d'une autre instance n'est pas suivie.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-sync-rest.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext, GRIST } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';

const HOOK_PORT = 9912;
const got = [];
const hook = createServer((request, response) => { let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => { got.push({ url: request.url, body: body.slice(0, 300) }); response.end('ok'); }); }).listen(HOOK_PORT, '127.0.0.1');
const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  const run = await openGfs(context);
  const { page, frame, docId } = run;
  // Un second `Transfer`, le vrai, dans le cadre de GFS ; `window.__t` le garde. Rend l'adresse REST du document (sans jeton).
  const base = await frame.evaluate(async () => {
    const { Transfer, buildTransferFrame } = await import('./js/broker/transfer.js');
    window.__t = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
    window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, kind: error.kind, status: error.status, message: String(error.message).slice(0, 160) }; } };
    return (await grist.docApi.getAccessToken({ readOnly: true })).baseUrl;
  });
  say('Adresse REST du document :', base);

  // 1. Propriétaire, puis le cycle d'un webhook.
  check('propriétaire : le cadre dit vrai (GET /webhooks, 200)', await frame.evaluate(() => window.__t.isOwner()) === true);
  const hookUrl = `http://127.0.0.1:${HOOK_PORT}/hook`;
  const made = await frame.evaluate(url => window.__try(() => window.__t.rest('POST', '/webhooks', { body: { webhooks: [{ fields: { name: 'essai', url, tableId: 'Clients', eventTypes: ['add', 'update'], enabled: true, condition: '$Nom != ""', isReadyColumn: null } }] } })), hookUrl);
  check('créer un webhook (POST JSON avec condition, depuis le cadre opaque) : 200 et son identifiant', made.ok && made.value.status === 200 && typeof made.value.body.webhooks[0].id === 'string', made);
  const id = made.ok ? made.value.body.webhooks[0].id : '';
  const listed = await frame.evaluate(() => window.__try(() => window.__t.rest('GET', '/webhooks')));
  check('lister : le webhook y est, avec son adresse et son état', listed.ok && listed.value.body.webhooks.some(each => each.id === id && each.fields.url === hookUrl && each.fields.enabled === true), listed.ok ? listed.value.body.webhooks.map(each => each.fields.name) : listed);
  await frame.evaluate(() => grist.docApi.applyUserActions([['AddRecord', 'Clients', null, { Nom: 'Livré' }]]));
  for (let i = 0; i < 40 && !got.length; i++) await page.waitForTimeout(500);
  check('Grist livre l\'ajout d\'une ligne à l\'adresse du webhook', got.length > 0 && /Liv/.test(got[0].body), got);
  const off = await frame.evaluate(webhook => window.__try(() => window.__t.rest('PATCH', `/webhooks/${webhook}`, { body: { enabled: false } })), id);
  check('désactiver (PATCH JSON) : 200', off.ok && off.value.status === 200, off);
  const queue = await frame.evaluate(webhook => window.__try(() => window.__t.rest('DELETE', `/webhooks/queue/${webhook}`)), id);
  say('vider la file de ce webhook (DELETE) :', queue.ok ? queue.value.status : queue);
  check('effacer (DELETE) : 200', (await frame.evaluate(webhook => window.__try(() => window.__t.rest('DELETE', `/webhooks/${webhook}`)), id)).ok === true);
  const after = await frame.evaluate(() => window.__try(() => window.__t.rest('GET', '/webhooks')));
  check('après l\'effacement, la liste n\'a plus ce webhook', after.ok && !after.value.body.webhooks.some(each => each.id === id), after);

  // 2. Un refus arrive avec son code.
  const missing = await frame.evaluate(() => window.__try(() => window.__t.rest('DELETE', '/webhooks/00000000-0000-4000-8000-000000000000')));
  check('un webhook qui n\'existe pas : refus « http » avec son code (pas une erreur de réseau)', !missing.ok && missing.kind === 'http' && [404, 400].includes(missing.status), missing);

  // 3. Le document public, lu sans jeton ; refusé tant qu'il ne l'est pas.
  const filter = encodeURIComponent(JSON.stringify({ Nom: ['Livré'] }));
  const closed = await frame.evaluate(address => window.__try(() => window.__t.anonymous('GET', address)), `${base}/tables/Clients/records?filter=${filter}`);
  check('avant de rendre le document public : la lecture sans jeton est refusée (401, 403 ou 404), sans erreur de réseau', !closed.ok && closed.kind === 'http' && [401, 403, 404].includes(closed.status), closed);
  const share = access => page.evaluate(async ([doc, role]) => (await fetch(`/api/docs/${doc}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: { users: { 'everyone@getgrist.com': role } } }) })).status, [docId, access]);
  check('le document devient public en lecture (via la session)', await share('viewers') === 200);
  // Grist garde quelques secondes le refus qu'il vient de donner à une personne anonyme : la lecture réussit dès qu'il l'oublie (vu le 07/11 : refusée à +0 s, rendue à +5 s).
  const until = async (job, limit = 30000) => {
    const started = Date.now();
    let answer = await job();
    while (!answer.ok && Date.now() - started < limit) { await page.waitForTimeout(2500); answer = await job(); }
    return { ...answer, after: Math.round((Date.now() - started) / 1000) };
  };
  const open = await until(() => frame.evaluate(address => window.__try(() => window.__t.anonymous('GET', address)), `${base}/tables/Clients/records?filter=${filter}`));
  say('Lecture publique rendue après', open.after, 's (le refus d\'avant est gardé quelques secondes par Grist)');
  check('document public : la lecture sans jeton, depuis le cadre opaque, rend les lignes filtrées', open.ok && open.value.status === 200 && Array.isArray(open.value.body.records) && open.value.body.records.length === 1 && open.value.body.records[0].fields.Nom === 'Livré', open.ok ? open.value.body : open);

  // 4. L'envoi de lignes sans jeton (public en édition) ; l'adresse d'une autre instance n'est pas suivie.
  check('le document devient public en édition (via la session)', await share('editors') === 200);
  const posted = await until(() => frame.evaluate(address => window.__try(() => window.__t.anonymous('POST', address, { body: { records: [{ fields: { Nom: 'Anonyme' } }] } })), `${base}/tables/Clients/records`));
  check('envoi de lignes sans jeton (POST JSON, depuis le cadre opaque) : 200', posted.ok && posted.value.status === 200, posted);
  const rows = await run.rest.rows('Clients');
  check('la ligne envoyée sans jeton est dans la table', rows.some(row => row.Nom === 'Anonyme'), rows.map(row => row.Nom));
  const elsewhere = await frame.evaluate(() => window.__try(() => window.__t.anonymous('POST', 'https://autre-instance.example.org/api/s/CLE/tables/Clients/records', { body: [] })));
  check('l\'adresse d\'une autre instance n\'est pas suivie (rien ne part)', !elsewhere.ok && elsewhere.kind === 'answer', elsewhere);
  await share('none').catch(() => {});
  if (run.problems.length) say('Console de GFS :', run.problems.filter(text => !run.allow.some(known => known.test(text))));
} finally {
  hook.close(); pages.close();
  await browser.close();
}
