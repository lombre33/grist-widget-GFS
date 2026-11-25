// Ce que les essais de partage entre deux documents ont en commun (run-sync-partage.mjs, run-partager-autre.mjs) : le moteur du kit et le port de GFS branchés dans la page d'un document que l'essai pilote
// lui-même (le côté qui reçoit, que GFS ne dessine pas encore), et le lien « Copier le lien » du formulaire d'un journal, dont la clé est lue dans la base du serveur d'essai (un widget ne la lit pas).
import { execFileSync } from 'node:child_process';

// Le port de GFS, le vrai : le cadre d'envoi, l'API des widgets, le moteur du kit. `window.__p` : le port ; `window.__s` : les fonctions du moteur que le parcours appelle ; `window.__try` : un essai qui rend
// l'erreur au lieu de la lever.
export const startEngine = frame => frame.evaluate(async () => {
  const { Transfer, buildTransferFrame } = await import('./js/broker/transfer.js');
  const { startSyncEngine } = await import('./js/sharing/sync-port.js');
  const [exportMod, inviteMod, receiveMod, loopMod, receivedMod, resendMod, actionsMod, filesMod, errorsMod] = await Promise.all([
    import('./kit/js/synchro/source/export.js'), import('./kit/js/synchro/source/invite.js'), import('./kit/js/synchro/target/receive.js'),
    import('./kit/js/synchro/target/loop.js'), import('./kit/js/synchro/logic/received.js'), import('./kit/js/synchro/source/resend.js'), import('./kit/js/synchro/source/actions.js'),
    import('./kit/js/synchro/source/files.js'), import('./kit/js/synchro/errors.js')]);
  const transfer = new Transfer({ doc: grist.docApi, base: document.baseURI, createFrame: url => buildTransferFrame(document, url) });
  window.__p = startSyncEngine({ docApi: grist.docApi, transfer, language: () => 'fr' });
  window.__s = { ...exportMod, ...inviteMod, ...receiveMod, ...loopMod, ...receivedMod, catchUp: resendMod.catchUp, catchState: resendMod.catchState, endExport: actionsMod.endExport, filesPending: filesMod.filesPending, errorText: errorsMod.errorText };
  window.__try = async job => { try { return { ok: true, value: await job() }; } catch (error) { return { ok: false, message: String(error.message).slice(0, 300) }; } };
  return true;
});

// Le lien « Copier le lien » du dernier formulaire publié du document de `run` ({ frame, page }) : `…/forms/<clé>/1`.
export async function formLink(run) {
  const linkIds = await run.frame.evaluate(() => window.__p.fetchRows('_grist_Shares').then(shares => shares.map(each => each.linkId)));
  let key = '';
  for (let i = 0; i < 20 && !key; i++) {
    try { key = execFileSync('docker', ['exec', 'grist', 'python3', '-c', `import sqlite3;print(sqlite3.connect('/persist/home.sqlite3').execute("select key from shares where link_id=?",("${linkIds[linkIds.length - 1]}",)).fetchone()[0])`]).toString().trim(); } catch (error) { await run.page.waitForTimeout(1000); }
  }
  const identity = await run.frame.evaluate(() => window.__p.docIdentity());
  return { key, link: `${identity.origin}${identity.team ? `/o/${identity.team}` : ''}/forms/${key}/1` };
}

// Le parcours entier d'un premier partage entre deux documents (`source`, `target` : ce que rend `openGfs`, le moteur démarré dans chacun par `startEngine`), tel que les essais le rejouent : l'export
// des fichiers `ids` (une condition sur leur identifiant), l'invitation, la réception à part (`GFS_Recus`), le lien du formulaire collé, la réponse contrôlée, le webhook et l'existant envoyé. Rend ce
// que les passages suivants gardent : l'export (`exp`), l'invitation (`entry`), le journal de la cible.
export async function handshake(source, target, { name, ids, columns, options = {} }) {
  const selection = ids => [{ table: 'GFS_Fichiers', columns, filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values: ids }] } }];
  const saved = await source.frame.evaluate(args => window.__s.saveChosenExport({ name: args.name, selection: args.selection }).then(done => ({ id: done.id, created: done.created })), { name, selection: selection(ids) });
  const invited = await source.frame.evaluate(exp => window.__s.startInvitation(exp).then(async ({ entry, secret }) => ({ entry, code: (await window.__s.invitationCode(exp, entry, secret)).code })), saved.created);
  const invitation = await target.frame.evaluate(code => window.__s.readInvitation(code), invited.code);
  const made = await target.frame.evaluate(args => {
    const plans = args.invite.tables.map(tb => ({ tb, dest: 'GFS_Recus' }));
    return window.__s.createReception(args.invite, plans, { reserve: true, options: args.options }).then(reception => ({ journal: reception.journal, note: reception.note }));
  }, { invite: invitation, options });
  const { link } = await formLink(target);
  const replied = await target.frame.evaluate(args => window.__s.receptionReply(args.made, args.link), { made, link });
  const reply = await source.frame.evaluate(args => window.__s.checkReply(args.exp, args.entry, args.code), { exp: saved.created, entry: invited.entry, code: replied.code });
  await source.frame.evaluate(args => window.__s.approveReply(args.exp, args.entry, args.reply).then(() => window.__s.sendExisting(args.exp)), { exp: saved.created, entry: invited.entry, reply });
  return { exp: saved.created, entry: invited.entry, journal: made.journal, selection };
}

// « Envoyer » dans la fenêtre d'envoi : la case « J'ai comparé ce code avec celui de l'autre document » (cochée au départ côté réglage, audit de sécurité du 09/11) dégrise le bouton ; la personne la coche, puis envoie.
export async function sendComparing(frame) {
  const compared = frame.locator('[data-fk="so-compared"]');
  if (await compared.count()) await compared.click();
  await frame.locator('[data-fk="so-send"]').click();
}

// Audit de sécurité du 09/11 : quand la fenêtre d'un partage qui laisse une table technique se ferme (`GFS_Synchro` d'un lien, un journal reçu), GFS la réserve aux propriétaires (js/sharing/sync-rules.js) et Grist
// recharge la page. L'essai attend que les règles soient posées, puis reprend le cadre rechargé de `run` (ce que rend `openGfs`).
export async function reopenedFrame(run) {
  const { gfsFrame } = await import('./lab-droits.mjs');
  const posed = () => run.page.evaluate(async doc => {
    const read = async table => (await (await fetch(`/api/docs/${doc}/tables/${table}/records`)).json()).records.map(row => row.fields);
    return (await read('_grist_ACLRules')).filter(rule => /^GFS\s*:\s*Partages/.test(rule.memo || '')).length;
  }, run.docId).catch(() => 0);
  for (let i = 0; i < 60 && (await posed()) < 2; i += 1) await run.page.waitForTimeout(1000);
  run.frame = await gfsFrame(run.page);
}
