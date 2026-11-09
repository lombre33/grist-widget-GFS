// Deux documents qui ont GFS, dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`) : un PDF du premier arrive dans le second par le moteur de partage du kit
// (kit/js/synchro/) branché sur le port de GFS (js/sync-port.js), une fois, dans un sens. Rien n'est simulé côté Grist : le port est celui de GFS, ses requêtes passent par le vrai cadre d'envoi, les
// webhooks sont ceux de Grist. Le parcours est celui que dessine l'écran à venir, sans écran :
//   SOURCE (le premier) : l'export du PDF (un seul fichier, une condition sur son identifiant), l'invitation et son code ;
//   CIBLE (le second)   : l'invitation lue et contrôlée, la réception créée (un journal, son formulaire publié, la table `GFS_Recus`), le lien du formulaire collé une fois, le code de réponse ;
//   SOURCE              : la réponse contrôlée chez Grist, le webhook branché, l'existant envoyé ;
//   CIBLE               : le PDF est dans `GFS_Recus`, la pièce jointe a les mêmes octets.
//   GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-sync-partage.mjs
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, importSamples } from './lab-pdf.mjs';

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];

// Le port de GFS et le moteur du kit dans la page d'un document ; `window.__s` : les fonctions du moteur que le parcours appelle, `window.__try` : un essai qui rend l'erreur au lieu de la lever.
const startEngine = frame => frame.evaluate(async () => {
  const { Transfer, buildTransferFrame } = await import('./js/transfer.js');
  const { startSyncEngine } = await import('./js/sync-port.js');
  const [exportMod, inviteMod, receiveMod, loopMod, receivedMod, resendMod] = await Promise.all([
    import('./kit/js/synchro/source/export.js'), import('./kit/js/synchro/source/invite.js'), import('./kit/js/synchro/target/receive.js'),
    import('./kit/js/synchro/target/loop.js'), import('./kit/js/synchro/logic/received.js'), import('./kit/js/synchro/source/resend.js')]);
  const transfer = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
  window.__p = startSyncEngine({ docApi: grist.docApi, transfer, language: () => 'fr' });
  window.__s = { ...exportMod, ...inviteMod, ...receiveMod, ...loopMod, ...receivedMod, catchUp: resendMod.catchUp, catchState: resendMod.catchState };
  window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, message: String(error.message).slice(0, 300) }; } };
  return true;
});

try {
  const context = await newContext(browser, server);
  const source = await openGfs(context);
  await importSamples(source);
  const target = await openGfs(context);
  check('deux documents ont GFS, le premier avec deux PDF', source.docId !== target.docId && (await source.rest.rows('GFS_Fichiers')).length === 2, [source.docId, target.docId]);
  await startEngine(source.frame);
  await startEngine(target.frame);

  // SOURCE : un export d'un seul fichier.
  const filter = { mode: 'all', conds: [{ id: 'Identifiant', op: 'eq', values: [source.id] }] };
  const saved = await source.frame.evaluate(args => window.__try(() => window.__s.saveChosenExport({ name: 'Facture', selection: [{ table: 'GFS_Fichiers', columns: args.columns, filter: args.filter }] }).then(done => ({ id: done.id, created: done.created }))), { columns: COLUMNS, filter });
  check('SOURCE : l\'export d\'un fichier est créé', saved.ok && saved.value.created, saved);
  const columns = (await source.rest.columns('GFS_Fichiers')).map(each => each.id);
  say('Colonnes de GFS_Fichiers après l\'export :', columns.join(', '));
  say('Tables de la SOURCE :', (await source.rest.tables()).join(', '));
  check('SOURCE : la table technique GFS_Synchro, et trois colonnes d\'aide dans GFS_Fichiers', (await source.rest.tables()).includes('GFS_Synchro') && ['id_sync', 'MajLe', 'RecalculLe'].every(name => columns.includes(name)), columns);

  const invited = await source.frame.evaluate(exp => window.__try(async () => {
    const { entry, secret } = await window.__s.startInvitation(exp);
    const made = await window.__s.invitationCode(exp, entry, secret);
    return { entry, code: made.code, expire: made.expire };
  }), saved.value.created);
  check('SOURCE : un code d\'invitation', invited.ok && /^GRISTSYNC2\./.test(invited.value.code), invited.ok ? invited.value.code.slice(0, 30) : invited);
  const plan = await source.frame.evaluate(exp => window.__try(() => window.__s.loadPlan(exp)), saved.value.created);
  check('SOURCE : l\'envoi de l\'existant coûte un fichier', plan.ok && plan.value.count === 1, plan);

  // CIBLE : l'invitation, la réception à part (`GFS_Recus`).
  const read = await target.frame.evaluate(code => window.__try(async () => {
    const invitation = await window.__s.readInvitation(code);
    return { invitation, known: await window.__s.knownReception(invitation) };
  }), invited.value.code);
  check('CIBLE : l\'invitation est lue et contrôlée (même instance, un fichier, le nom de l\'export)', read.ok && read.value.invitation.name === 'Facture' && read.value.known === null, read.ok ? { name: read.value.invitation.name, from: read.value.invitation.from } : read);
  const made = await target.frame.evaluate(invitation => window.__try(async () => {
    const plans = invitation.tables.map(tb => ({ tb, dest: 'GFS_Recus' }));
    const { existing } = await window.__s.checkDestinations(invitation, plans);
    const reception = await window.__s.createReception(invitation, plans, { reserve: true, options: {} });
    return { existing, journal: reception.journal, created: reception.created, note: reception.note };
  }), read.value.invitation);
  check('CIBLE : la réception est créée (un journal, sa page, la table reçue à part)', made.ok && made.value.created.includes('GFS_Recus') && /^GFS_Journal_/.test(made.value.journal), made.ok ? { existing: made.value.existing, journal: made.value.journal, created: made.value.created } : made);
  say('Tables de la CIBLE :', (await target.rest.tables()).join(', '));
  say('Pages de la CIBLE :', (await target.rest.pages()).join(', '));

  // Le lien « Copier le lien » du formulaire du journal : la personne le colle une fois. La clé est lue dans la base du serveur d'essai (un widget ne la lit pas).
  const linkIds = await target.frame.evaluate(() => window.__p.fetchRows('_grist_Shares').then(shares => shares.map(each => each.linkId)));
  let key = '';
  for (let i = 0; i < 20 && !key; i++) {
    try { key = execFileSync('docker', ['exec', 'grist', 'python3', '-c', `import sqlite3;print(sqlite3.connect('/persist/home.sqlite3').execute("select key from shares where link_id=?",("${linkIds[linkIds.length - 1]}",)).fetchone()[0])`]).toString().trim(); } catch (error) { await target.page.waitForTimeout(1000); }
  }
  check('CIBLE : la clé du formulaire du journal est lue dans la base du serveur d\'essai', key.length > 5, key.length);
  const identity = await target.frame.evaluate(() => window.__p.docIdentity());
  const link = `${identity.origin}${identity.team ? `/o/${identity.team}` : ''}/forms/${key}/1`;
  const replied = await target.frame.evaluate(args => window.__try(() => window.__s.receptionReply(args.made, args.link)), { made: { journal: made.value.journal, note: made.value.note }, link });
  check('CIBLE : le lien collé est contrôlé (une ligne d\'essai arrive dans le journal) et le code de réponse est produit', replied.ok && /^GRISTSYNC2\./.test(replied.value.code) && /^[0-9A-Z]{3}-[0-9A-Z]{3}$/.test(replied.value.control), replied.ok ? replied.value.control : replied);
  const wrongLink = await target.frame.evaluate(args => window.__try(() => window.__s.receptionReply(args.made, args.link)), { made: { journal: made.value.journal, note: made.value.note }, link: link.replace(key, 'ZZZZ9999AAAA') });
  check('CIBLE : un lien dont la clé n\'existe pas est refusé, sans la clé en entier', !wrongLink.ok && !wrongLink.message.includes('ZZZZ9999AAAA'), wrongLink);

  // SOURCE : la réponse est contrôlée chez Grist, le webhook est branché, l'existant part.
  const reply = await source.frame.evaluate(args => window.__try(async () => {
    const read = await window.__s.checkReply(args.exp, args.entry, args.code);
    return { share: read.share, code: read.code, tables: read.tables, url: read.url.replace(/\/api\/s\/[A-Za-z0-9]+/, '/api/s/…'), reply: read };
  }), { exp: saved.value.created, entry: invited.value.entry, code: replied.value.code });
  check('SOURCE : la réponse est contrôlée chez Grist (le document de la clé est le second, même code de contrôle des deux côtés)', reply.ok && reply.value.share.docId === target.docId && reply.value.code === replied.value.control, reply.ok ? { share: reply.value.share, code: reply.value.code, tables: reply.value.tables } : reply);
  const approved = await source.frame.evaluate(args => window.__try(async () => {
    const hook = await window.__s.approveReply(args.exp, args.entry, args.reply);
    const sent = await window.__s.sendExisting(args.exp);
    return { hook, sent };
  }), { exp: saved.value.created, entry: invited.value.entry, reply: reply.value.reply });
  check('SOURCE : le webhook est branché, l\'existant est envoyé', approved.ok && typeof approved.value.hook === 'string', approved);
  const hooks = await source.frame.evaluate(() => window.__p.listWebhooks().then(list => list.map(each => ({ table: each.fields.tableId, enabled: each.fields.enabled, name: each.fields.name }))));
  say('Webhooks de la SOURCE :', JSON.stringify(hooks));

  // CIBLE : le PDF arrive dans le journal, puis dans la table reçue, avec les mêmes octets.
  // Les deux boucles du moteur, une passe à la fois (dans la page, elles tournent seules : `startAutoCatchUp` de la SOURCE envoie les fichiers, `startAutoConsolidation` de la CIBLE recopie).
  const received = async () => {
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    return target.rest.rows('GFS_Recus');
  };
  let rows = [];
  for (let i = 0; i < 40 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i++) { await target.page.waitForTimeout(2000); rows = await received(); }
  say('Lignes de GFS_Recus :', JSON.stringify(rows.map(row => ({ Nom: row.Nom, Taille: row.Taille, Contenu: row.Contenu }))));
  check('CIBLE : le fichier choisi est dans la table reçue, et lui seul', rows.filter(row => row.Supprime !== true).length === 1 && rows.some(row => row.Nom === 'Facture.pdf'), rows.map(row => row.Nom));
  const sent = (await source.rest.rows('GFS_Fichiers')).find(row => row.Identifiant === source.id);
  const there = rows.find(row => row.Nom === 'Facture.pdf');
  const was = await source.rest.attachment(sent.Contenu[1]);
  const now = there && Array.isArray(there.Contenu) ? await target.rest.attachment(there.Contenu[1]) : null;
  check('CIBLE : la pièce jointe a les mêmes octets (empreinte, taille, type)', Boolean(now) && now.status === 200 && now.hash === was.hash && now.size === was.size, { was, now });
  check('CIBLE : GFS_Fichiers de la CIBLE n\'existe pas (la table reçue est à part)', !(await target.rest.tables()).includes('GFS_Fichiers'), await target.rest.tables());
  const left = (await source.rest.rows('GFS_Fichiers')).map(row => row.Nom);
  check('SOURCE : le fichier d\'origine est intact', left.includes('Facture.pdf') && left.includes('Devis.pdf'), left);
  for (const [label, each] of [['SOURCE', source], ['CIBLE', target]]) {
    const rules = await each.frame.evaluate(async () => {
      const [resources, list] = await Promise.all([window.__p.fetchRows('_grist_ACLResources'), window.__p.fetchRows('_grist_ACLRules')]);
      return list.map(rule => ({ resource: (resources.find(r => r.id === rule.resource) || {}).tableId + '/' + (resources.find(r => r.id === rule.resource) || {}).colIds, cond: rule.aclFormula, perm: rule.permissionsText, memo: rule.memo }));
    });
    say(`Règles d'accès de la ${label} :`, JSON.stringify(rules));
  }
  for (const each of [source, target]) if (each.problems.length) say('Console de GFS :', each.problems.filter(text => !each.allow.some(known => known.test(text))));
} finally {
  pages.close();
  await browser.close();
}
