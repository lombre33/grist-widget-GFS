// Le courrier par relais, de bout en bout, dans un VRAI Grist : la boîte d'envoi que GFS crée (js/mail/outbox.js, avec l'accord), le webhook que Grist appelle, le
// relais (outils/relais-courrier/, lancé comme une personne le lancerait), l'envoi par SMTP chiffré vers un serveur d'essai (le puits : labo/courrier-puits.mjs), et l'accusé
// que le relais rend par le formulaire public du document. Rien n'est simulé de ce que Grist fait : formules, condition du webhook, livraison, nouvelles tentatives et
// formulaire sont ceux de la 1.7.19. Le serveur de messagerie et le certificat sont d'essai ; le message est relu par l'analyseur de messages de Python, pas par le nôtre.
//   GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-courrier-relais.mjs
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext, GRIST } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { call, rowsOf } from './lab-rest.mjs';
import { startSink } from './courrier-puits.mjs';
import { smtpSend } from '../outils/relais-courrier/smtp.mjs';
import { buildMessage } from '../outils/relais-courrier/mime.mjs';
import { newSecret, OUTBOX, RETURNS } from '../js/mail/outbox.js';

const REPO = process.env.REPO_DIR;
const RELAY_PORT = 9920;
const SPY_PORT = 9921;
const work = mkdtempSync(join(tmpdir(), 'courrier-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (job, limit = 40000) => { const started = Date.now(); for (;;) { const value = await job(); if (value || Date.now() - started > limit) return value; await sleep(500); } };

// Le certificat d'essai (deux jours), que le relais est prié de croire.
const keyFile = join(work, 'key.pem');
const certFile = join(work, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
const key = readFileSync(keyFile);
const cert = readFileSync(certFile);
const ca = cert.toString();

// Un message relu par l'analyseur de Python (le vrai décodage des mots codés, du base64, des parties).
const parse = data => JSON.parse(execFileSync('python3', ['-I', '-c', [
  'import sys, json, email, email.policy',
  'm = email.message_from_bytes(sys.stdin.buffer.read(), policy=email.policy.default)',
  'p = m.get_body(preferencelist=("plain",)); h = m.get_body(preferencelist=("html",))',
  'print(json.dumps({k.lower(): str(v) for k, v in m.items()} | {"text": p.get_content() if p else "", "html": h.get_content() if h else ""}))',
].join('\n')], { input: data }).toString());

// 1. Le client SMTP du relais contre le puits, sans Grist : chiffrement, identification, refus.
say('— 1. Le client SMTP du relais contre un serveur d\'essai');
const probe = buildMessage({ message: { to: ['a@exemple.fr', 'inconnu@exemple.fr'], cc: [], bcc: ['b@exemple.fr'], subject: 'Essai é', text: '.un point seul\nligne', html: '', replyTo: '' }, from: 'courrier@admin.exemple.fr', id: 'x.1.0' });
const recipients = ['a@exemple.fr', 'inconnu@exemple.fr', 'b@exemple.fr'];
const attempt = async (mode, url, options = {}) => {
  const sink = await startSink({ mode, key, cert, ...options.sink });
  try {
    const out = await smtpSend({ url: url.replace('PORT', sink.port), ca: options.noCa ? undefined : ca, from: 'courrier@admin.exemple.fr', recipients, data: probe });
    return { ok: true, out, sink: sink.messages };
  } catch (error) { return { ok: false, message: error.message, permanent: error.permanent }; } finally { await sink.close(); }
};
const starttls = await attempt('starttls', 'smtp://relais:secret@localhost:PORT');
check('STARTTLS, AUTH PLAIN : le message arrive chiffré, identifié, avec la copie cachée dans l\'enveloppe et l\'adresse inconnue refusée dite', starttls.ok && starttls.sink[0].chiffre && starttls.sink[0].user === 'relais' && starttls.sink[0].rcpt.join() === 'a@exemple.fr,b@exemple.fr' && starttls.out.refused.join() === 'inconnu@exemple.fr', { ok: starttls.ok, refused: starttls.out && starttls.out.refused });
const one = parse(starttls.sink[0].data);
check('relu par Python : objet décodé, texte intact (le point seul n\'est pas mangé), copie cachée absente des en-têtes', one.subject === 'Essai é' && one.text.replace(/\r?\n$/, '') === '.un point seul\nligne'.replace('\n', '\n') && !('bcc' in one) && one['message-id'] === '<x.1.0@admin.exemple.fr>', { subject: one.subject, id: one['message-id'], text: one.text });
const smtps = await attempt('smtps', 'smtps://relais:secret@localhost:PORT');
check('TLS d\'emblée (smtps) : le message arrive chiffré', smtps.ok && smtps.sink[0].chiffre, { ok: smtps.ok });
const clair = await attempt('clair', 'smtp://relais:secret@localhost:PORT');
check('un serveur qui n\'offre pas STARTTLS : refus, rien n\'est envoyé en clair', !clair.ok && /STARTTLS/.test(clair.message) && clair.permanent === true, clair);
const none = await attempt('clair', 'smtp://relais:secret@localhost:PORT?tls=none');
check('« ?tls=none » vers la machine elle-même : accepté, non chiffré (les essais)', none.ok && none.sink[0].chiffre === false, { ok: none.ok });
const noCa = await attempt('starttls', 'smtp://relais:secret@localhost:PORT', { noCa: true });
check('un certificat que le relais ne connaît pas : refusé (la vérification n\'est jamais coupée)', !noCa.ok && /TLS refusé/.test(noCa.message), noCa);
const badPass = await attempt('starttls', 'smtp://relais:secret@localhost:PORT', { sink: { pass: 'autre' } });
check('un mauvais mot de passe : refus définitif (535)', !badPass.ok && badPass.permanent === true && /535/.test(badPass.message), badPass);

// 2. Dans un vrai Grist.
say('— 2. Dans un vrai Grist');
const sink = await startSink({ mode: 'starttls', key, cert });
const spyLog = [];
let relayProcess = null;
const spy = createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', async () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const entry = { at: Date.now(), authorization: request.headers.authorization || '', body, status: 0 };
    spyLog.push(entry);
    try {
      const forwarded = await fetch(`http://127.0.0.1:${RELAY_PORT}${request.url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: entry.authorization }, body });
      entry.status = forwarded.status;
      response.writeHead(forwarded.status); response.end(await forwarded.text());
    } catch (error) { entry.status = 502; response.writeHead(502); response.end('relais absent'); }
  });
}).listen(SPY_PORT, '127.0.0.1');
const pages = createServer(serve(REPO, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const secret = newSecret();
const startRelay = async accuseUrl => {
  relayProcess = spawn(process.execPath, [join(REPO, 'prototype/outils/relais-courrier/relais.mjs')], { stdio: ['ignore', 'ignore', 'pipe'], env: {
    PATH: process.env.PATH, RELAIS_SECRET: secret, SMTP_URL: `smtp://relais:secret@localhost:${sink.port}`, SMTP_CA: certFile, DE: 'courrier@admin.exemple.fr', ACCUSE_URL: accuseUrl,
    ECOUTE: `127.0.0.1:${RELAY_PORT}`, MEMOIRE: join(work, 'memoire.json'),
  } });
  const errors = [];
  relayProcess.stderr.on('data', chunk => errors.push(chunk.toString()));
  relayProcess.errors = errors;
  const up = await until(async () => (await fetch(`http://127.0.0.1:${RELAY_PORT}/`).catch(() => null))?.status === 405, 10000);
  if (!up) throw new Error(`Le relais ne démarre pas : ${errors.join('')}`);
};
const stopRelay = async () => { if (relayProcess) { relayProcess.kill(); await sleep(300); relayProcess = null; } };

try {
  const server = await requireServer();
  const context = await newContext(browser, server);
  const run = await openGfs(context);
  const { page, frame, docId } = run;
  await frame.evaluate(async () => {
    const { Transfer, buildTransferFrame } = await import('./js/broker/transfer.js');
    const { startSyncEngine } = await import('./js/sharing/sync-port.js');
    const transfer = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
    window.__p = startSyncEngine({ docApi: grist.docApi, transfer, language: () => 'fr' });
    window.__t = transfer;
    window.__m = await import('./js/mail/outbox.js');
    window.__pages = await import('./kit/js/synchro/pages.js');
    window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, message: String(error.message).slice(0, 200) }; } };
  });

  // 2.1 La boîte d'envoi : refusée, rien n'est écrit ; acceptée, créée ; relue, rien de plus.
  const declined = await frame.evaluate(() => window.__m.ensureOutbox(window.__p, { accept: async wish => { window.__wish = wish; return false; } }));
  const afterDecline = await frame.evaluate(() => window.__p.readSchema().then(schema => ({ outbox: schema.has('GFS_Courrier'), returns: schema.has('GFS_Courrier_Retours') })));
  check('sans l\'accord de la personne, aucune table n\'est créée (la demande dit les deux tables)', declined.declined === true && !afterDecline.outbox && !afterDecline.returns && (await frame.evaluate(() => window.__wish.tables)).length === 2, { declined, afterDecline });
  const made = await frame.evaluate(() => window.__try(() => window.__m.ensureOutbox(window.__p, { accept: async () => true })));
  check('avec l\'accord : les deux tables sont créées (noms relus après création)', made.ok && made.value.created && made.value.outbox === OUTBOX && made.value.returns === RETURNS, made);
  const columns = await frame.evaluate(() => window.__p.readSchema().then(schema => ({ outbox: schema.columns('GFS_Courrier').map(column => column.colId).filter(id => id !== 'manualSort'), returns: schema.columns('GFS_Courrier_Retours').map(column => column.colId).filter(id => id !== 'manualSort') })));
  check('les colonnes sont celles du plan, aucune de plus', columns.outbox.join() === 'Destinataires,Copie,CopieCachee,Objet,Corps,Html,RepondreA,Demande,Relance,Cle,Statut,Detail' && columns.returns.join() === 'Courrier,Cle,Relance,Etat,Detail,RecuLe', columns);
  const again = await frame.evaluate(() => window.__m.ensureOutbox(window.__p, { accept: async () => { throw new Error('aucune question attendue'); } }));
  check('relue une seconde fois : rien à créer, aucune question', again.ready && !again.created, again);

  // 2.2 Les formules de Grist : la clé tirée à la création, le statut qui suit l'accusé.
  await frame.evaluate(() => window.__p.apply([['AddRecord', 'GFS_Courrier', null, { Destinataires: 'a@exemple.fr', Objet: 'Brouillon', Corps: 'pas encore', Demande: 'brouillon' }], ['AddRecord', 'GFS_Courrier', null, { Objet: 'Sans demande' }]]));
  const drafts = await frame.evaluate(() => window.__p.fetchRows('GFS_Courrier'));
  check('une ligne neuve reçoit une clé au hasard (32 caractères hexadécimaux, formule d\'une seule fois) et son statut est « brouillon »', drafts.length === 2 && drafts.every(row => /^[0-9a-f]{32}$/.test(row.Cle) && row.Statut === 'brouillon') && drafts[0].Cle !== drafts[1].Cle, drafts.map(row => [row.Cle, row.Statut]));

  // 2.3 Le formulaire public des accusés, l'adresse du relais et le webhook.
  const form = await frame.evaluate(() => window.__try(() => window.__pages.ensureForm('GFS_Courrier_Retours')));
  check('le formulaire des accusés est publié', form.ok, form);
  const identity = await frame.evaluate(() => window.__p.docIdentity());
  const links = await frame.evaluate(() => window.__p.fetchRows('_grist_Shares').then(shares => shares.map(each => each.linkId)));
  let formKey = '';
  for (let i = 0; i < 20 && !formKey; i++) {
    try { formKey = execFileSync('docker', ['exec', 'grist', 'python3', '-c', `import sqlite3;print(sqlite3.connect('/persist/home.sqlite3').execute("select key from shares where link_id=?",("${links[links.length - 1]}",)).fetchone()[0])`]).toString().trim(); } catch (error) { await sleep(1000); }
  }
  const accuseUrl = `${identity.origin}${identity.team ? `/o/${identity.team}` : ''}/api/s/${formKey}/tables/GFS_Courrier_Retours/records?flat=1`;
  check('la clé du formulaire est lue dans la base du serveur d\'essai (Grist ne la donne pas à un widget : la personne copie le lien)', formKey.length > 5, formKey.length);
  await startRelay(accuseUrl);
  const hookUrl = `http://127.0.0.1:${SPY_PORT}/courrier`;
  const armed = await frame.evaluate(([url, token]) => window.__try(() => window.__m.armRelay({ port: window.__p, transfer: window.__t, url, secret: token, loopback: true })), [hookUrl, secret]);
  check('armRelay : le webhook est posé, son secret réglé', armed.ok && typeof armed.value === 'string', armed);
  const listed = await frame.evaluate(() => Promise.all([window.__p.listWebhooks(), window.__p.webhookConditions()]).then(([hooks, conditions]) => hooks.map(hook => ({ name: hook.fields.name, url: hook.fields.url, table: hook.fields.tableId, enabled: hook.fields.enabled, events: hook.fields.eventTypes, condition: conditions.get(hook.id) }))));
  check('le webhook est actif, sur GFS_Courrier, « ajout » et « modification », avec la condition sur le statut', listed.length === 1 && listed[0].name === 'Courrier : relais' && listed[0].url === hookUrl && listed[0].table === 'GFS_Courrier' && listed[0].enabled && listed[0].events.join() === 'add,update' && listed[0].condition === '$Statut == "a-envoyer"', listed);
  await sleep(3000);
  check('les deux brouillons ne sont PAS livrés (la condition porte sur une colonne à formule : Grist la lit)', spyLog.length === 0 && sink.messages.length === 0, spyLog.map(entry => entry.body.slice(0, 200)));

  // 2.4 Un premier message, de la ligne au puits et à l'accusé.
  const mail = { Destinataires: 'agnès@exemple.fr'.replace('agnès', 'agnes'), Copie: 'chef@exemple.fr', CopieCachee: 'archives@exemple.fr', RepondreA: 'service@exemple.fr', Objet: 'Convocation à la réunion du comité d’éthique — ordre du jour et pièces à relire avant jeudi', Corps: 'Bonjour,\n\nVoici la convocation « du jeudi ».\n.Une ligne qui commence par un point.\n\nCordialement' };
  const id1 = await frame.evaluate(item => window.__m.enqueue(window.__p, 'GFS_Courrier', item), mail);
  const arrived = await until(() => sink.messages.length >= 1);
  check('le message arrive au puits, sans que personne ne touche rien (Grist appelle le relais, le relais envoie)', arrived && sink.messages[0].chiffre && sink.messages[0].user === 'relais', sink.messages.length);
  const got = parse(sink.messages[0].data);
  check('relu par Python : de, à, copie, répondre à, objet accentué long et texte (point initial compris) tels qu\'écrits', got.from === 'courrier@admin.exemple.fr' && got.to === 'agnes@exemple.fr' && got.cc === 'chef@exemple.fr' && got['reply-to'] === 'service@exemple.fr' && got.subject === mail.Objet && got.text.replace(/\r\n/g, '\n').trimEnd() === mail.Corps, got);
  check('l\'enveloppe porte aussi la copie cachée, que les en-têtes ne montrent pas', sink.messages[0].rcpt.join() === 'agnes@exemple.fr,chef@exemple.fr,archives@exemple.fr' && !('bcc' in got), sink.messages[0].rcpt);
  const sentRow = await until(async () => { const row = (await frame.evaluate(() => window.__p.fetchRows('GFS_Courrier'))).find(each => each.id === id1); return row && row.Statut === 'envoye' ? row : null; });
  check('l\'accusé revient par le formulaire public : le statut de la ligne passe à « envoyé » (formule), avec le Message-ID en détail', sentRow && /^Message-ID <[0-9a-f]{32}\.\d+\.0>$/.test(sentRow.Detail), sentRow);
  const backRows = await frame.evaluate(() => window.__p.fetchRows('GFS_Courrier_Retours'));
  check('une ligne d\'accusé : la ligne, sa clé, « envoye », et la date posée par Grist', backRows.length === 1 && backRows[0].Courrier === id1 && backRows[0].Cle === sentRow.Cle && backRows[0].Etat === 'envoye' && backRows[0].RecuLe, backRows);
  const delivery = spyLog[0];
  const payload = JSON.parse(delivery.body);
  check('ce que Grist a livré : un tableau d\'une ligne, avec l\'en-tête Authorization réglé, la clé, les champs et les colonnes à formule', delivery.authorization === `Bearer ${secret}` && Array.isArray(payload) && payload.length === 1 && payload[0].id === id1 && payload[0].Cle === sentRow.Cle && payload[0].Objet === mail.Objet && payload[0].Statut === 'a-envoyer', { authorization: delivery.authorization === `Bearer ${secret}`, keys: Object.keys(payload[0] || {}) });
  say('Livraison de Grist :', delivery.body.slice(0, 300));

  // 2.5 Ce qui ne doit PAS repartir.
  const deliveriesBefore = spyLog.length;
  await frame.evaluate(id => window.__p.apply([['UpdateRecord', 'GFS_Courrier', id, { Objet: 'Objet corrigé après envoi' }]]), id1);
  await sleep(5000);
  check('corriger une ligne déjà envoyée ne la renvoie pas (elle ne remplit plus la condition)', spyLog.length === deliveriesBefore && sink.messages.length === 1, { livraisons: spyLog.length, messages: sink.messages.length });
  const replay = await fetch(`http://127.0.0.1:${RELAY_PORT}/`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, body: delivery.body });
  const replayBody = await replay.json();
  check('la même livraison rejouée (comme Grist qui retente) : « déjà », rien n\'est renvoyé', replay.status === 200 && replayBody.results[0].state === 'deja' && sink.messages.length === 1, replayBody);
  const wrongSecret = await fetch(`http://127.0.0.1:${RELAY_PORT}/`, { method: 'POST', headers: { Authorization: 'Bearer faux' }, body: delivery.body });
  check('un mauvais secret : 401, rien n\'est envoyé', wrongSecret.status === 401 && sink.messages.length === 1, wrongSecret.status);

  // 2.6 Renvoyer : un envoi voulu.
  const requeued = await frame.evaluate(id => window.__m.requeue(window.__p, 'GFS_Courrier', [id]), id1);
  const second = await until(() => sink.messages.length >= 2);
  const backAfter = await until(async () => { const rows = await frame.evaluate(() => window.__p.fetchRows('GFS_Courrier_Retours')); return rows.length >= 2 ? rows : null; });
  const rowAfter = (await frame.evaluate(() => window.__p.fetchRows('GFS_Courrier'))).find(each => each.id === id1);
  check('renvoyer : la relance monte, le message repart (nouveau Message-ID), un second accusé, statut de nouveau « envoyé »', requeued === 1 && second && /\.1@admin\.exemple\.fr>$/.test(parse(sink.messages[1].data)['message-id']) && backAfter && backAfter[1].Relance === 1 && rowAfter.Statut === 'envoye', { requeued, messages: sink.messages.length, rowAfter: rowAfter && rowAfter.Statut });

  // 2.7 Le document fermé : plus aucune page de GFS, le courrier part quand même.
  await page.close();
  const other = await context.newPage();
  await other.goto(`${GRIST}/`, { waitUntil: 'load' });
  const rest = { page: other, docId };
  const table = rows => rows.map(row => ({ id: row.id, Statut: row.Statut, Detail: row.Detail }));
  const closed = await call(other, 'POST', `/api/docs/${docId}/apply`, [['AddRecord', 'GFS_Courrier', null, { Destinataires: 'fermé@exemple.fr'.replace('fermé', 'ferme'), Objet: 'Document fermé', Corps: 'Aucune page de GFS n\'est ouverte.', Demande: 'a-envoyer' }]]);
  const closedId = closed.json && closed.json.retValues && closed.json.retValues[0];
  const third = await until(() => sink.messages.length >= 3);
  const closedRow = await until(async () => (await rowsOf(rest, 'GFS_Courrier')).find(row => row.id === closedId && row.Statut === 'envoye'));
  check('document fermé (aucune page de GFS ouverte) : la ligne écrite par l\'API part quand même, et son statut passe à « envoyé »', third && closedRow, table(await rowsOf(rest, 'GFS_Courrier')));

  // 2.8 Ce que le relais refuse, avec un accusé « erreur ».
  const before = sink.messages.length;
  await call(other, 'POST', `/api/docs/${docId}/apply`, [['AddRecord', 'GFS_Courrier', null, { Destinataires: 'a@exemple.fr\r\nBcc: espion@exemple.fr', Objet: 'Injection', Corps: 'x', Demande: 'a-envoyer' }], ['AddRecord', 'GFS_Courrier', null, { Destinataires: 'inconnu@exemple.fr', Objet: 'Adresse inconnue', Corps: 'x', Demande: 'a-envoyer' }]]);
  const errors = await until(async () => { const rows = await rowsOf(rest, 'GFS_Courrier'); const bad = rows.filter(row => row.Statut === 'erreur'); return bad.length >= 2 ? rows : null; });
  const errorRows = (errors || []).filter(row => row.Statut === 'erreur');
  check('un retour à la ligne glissé dans une adresse (écrit sans passer par GFS) : refusé par le relais, statut « erreur », motif « headerBreak », rien n\'est envoyé', errorRows.some(row => row.Detail === 'headerBreak') && sink.messages.length === before, table(errors || []));
  check('une adresse que le serveur de messagerie refuse (550) : statut « erreur » avec le motif dit en clair, sans nouvel essai', errorRows.some(row => row.Objet === 'Adresse inconnue' && row.Detail === 'Aucune adresse n’est acceptée par le serveur.') && sink.messages.length === before, table(errors || []));

  // 2.9 Un accusé forgé par le lien public ne change rien sans la clé de la ligne.
  const draftId = (await rowsOf(rest, 'GFS_Courrier')).find(row => row.Objet === 'Brouillon');
  const forge = cle => fetch(accuseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ Courrier: draftId.id, Cle: cle, Relance: 0, Etat: 'envoye', Detail: 'forgé' }]) });
  const forged = await forge('0'.repeat(32));
  await sleep(1500);
  const afterForge = (await rowsOf(rest, 'GFS_Courrier')).find(row => row.id === draftId.id);
  check('un accusé envoyé au lien public avec une fausse clé est accepté par le formulaire mais ne change rien : la ligne reste « brouillon »', forged.ok && afterForge.Statut === 'brouillon', { status: forged.status, statut: afterForge.Statut });
  await forge(draftId.Cle);
  const afterRight = await until(async () => (await rowsOf(rest, 'GFS_Courrier')).find(row => row.id === draftId.id && row.Statut === 'envoye'));
  say(afterRight ? 'CONSTAT avec la bonne clé (que voient seulement le relais et les éditeurs du document), l\'accusé est pris : la clé EST le secret de l\'accusé' : 'CONSTAT l\'accusé à la bonne clé n\'a pas été pris');

  // 2.10 Le relais éteint : Grist retente, rien ne se perd.
  await stopRelay();
  const downAt = Date.now();
  await call(other, 'POST', `/api/docs/${docId}/apply`, [['AddRecord', 'GFS_Courrier', null, { Destinataires: 'retard@exemple.fr', Objet: 'Relais éteint', Corps: 'Il part quand le relais revient.', Demande: 'a-envoyer' }]]);
  const refused = await until(() => spyLog.some(entry => entry.at >= downAt && entry.status === 502), 20000);
  const countBefore = sink.messages.length;
  await sleep(3000);
  check('relais éteint : Grist tente, la livraison est refusée (502), rien n\'est envoyé et la ligne reste « à envoyer »', refused && sink.messages.length === countBefore && (await rowsOf(rest, 'GFS_Courrier')).some(row => row.Objet === 'Relais éteint' && row.Statut === 'a-envoyer'), { livraisons: spyLog.filter(entry => entry.at >= downAt).map(entry => entry.status) });
  await startRelay(accuseUrl);
  const backAt = Date.now();
  const late = await until(() => sink.messages.length > countBefore, 150000);
  const lateRow = await until(async () => (await rowsOf(rest, 'GFS_Courrier')).find(row => row.Objet === 'Relais éteint' && row.Statut === 'envoye'));
  say(`Grist a retenté ${Math.round((Date.now() - backAt) / 1000)} s après le retour du relais ; livraisons vues depuis l'arrêt :`, spyLog.filter(entry => entry.at >= downAt).map(entry => `${Math.round((entry.at - downAt) / 1000)} s : ${entry.status}`).join(', '));
  check('le relais revient : Grist retente et le message part, statut « envoyé » (rien ne s\'est perdu, rien n\'est parti deux fois)', late && lateRow && sink.messages.filter(item => /Relais éteint/.test(parse(item.data).subject)).length === 1, { messages: sink.messages.length });

  const noise = run.problems.filter(text => !run.allow.some(known => known.test(text)));
  check('la console de GFS reste vide', noise.length === 0, noise);
} finally {
  await stopRelay();
  spy.close(); pages.close(); await sink.close();
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
