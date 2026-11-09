// Ce que les essais de partage entre deux documents ont en commun (run-sync-partage.mjs, run-partager-autre.mjs) : le moteur du kit et le port de GFS branchés dans la page d'un document que l'essai pilote
// lui-même (le côté qui reçoit, que GFS ne dessine pas encore), et le lien « Copier le lien » du formulaire d'un journal, dont la clé est lue dans la base du serveur d'essai (un widget ne la lit pas).
import { execFileSync } from 'node:child_process';

// Le port de GFS, le vrai : le cadre d'envoi, l'API des widgets, le moteur du kit. `window.__p` : le port ; `window.__s` : les fonctions du moteur que le parcours appelle ; `window.__try` : un essai qui rend
// l'erreur au lieu de la lever.
export const startEngine = frame => frame.evaluate(async () => {
  const { Transfer, buildTransferFrame } = await import('./js/transfer.js');
  const { startSyncEngine } = await import('./js/sync-port.js');
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
