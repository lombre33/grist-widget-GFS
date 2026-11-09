// Le moteur de partage entre deux documents (kit/js/synchro/, repris de Sync+), chargé au premier besoin et démarré une seule fois par page (son port est global) : ni lui ni le port de GFS ne pèsent
// sur la page de quelqu'un qui ne partage rien. Rend les seules fonctions que les parcours de GFS appellent, dans un objet que leurs essais remplacent (js/share-other-flow.js).
// deps : { docApi (grist.docApi, qui décode les valeurs), transfer (js/transfer.js), language () → 'fr' | 'en', busy () → booléen }.

let loading = null;

async function load(deps) {
  const [{ startSyncEngine }, exporting, inviting, resending, acting, filing, failing] = await Promise.all([
    import('./sync-port.js'), import('../kit/js/synchro/source/export.js'), import('../kit/js/synchro/source/invite.js'), import('../kit/js/synchro/source/resend.js'),
    import('../kit/js/synchro/source/actions.js'), import('../kit/js/synchro/source/files.js'), import('../kit/js/synchro/errors.js'),
  ]);
  startSyncEngine(deps);
  // Le rattrapage du moteur (il envoie le contenu des fichiers, et reprend un envoi que la page a laissé en route) tourne tant que la page est ouverte ; sans la table technique, il ne fait presque rien.
  resending.startAutoCatchUp(() => {});
  return Object.freeze({
    saveChosenExport: exporting.saveChosenExport,
    startInvitation: inviting.startInvitation,
    invitationCode: inviting.invitationCode,
    checkReply: inviting.checkReply,
    approveReply: inviting.approveReply,
    sendExisting: inviting.sendExisting,
    catchUp: resending.catchUp,
    catchState: resending.catchState,
    endExport: acting.endExport,
    cancelPendingInvitation: acting.cancelPendingInvitation,
    filesPending: filing.filesPending,
    errorText: failing.errorText,
  });
}

// Le moteur prêt (une seule fois ; un échec de chargement est retenté au prochain appel).
export function loadSharingEngine(deps) {
  loading ||= load(deps).catch(error => { loading = null; throw error; });
  return loading;
}

let receiving = null;

// Le côté qui reçoit : la boucle du moteur qui recopie les journaux reçus dans leur table et attache le contenu des fichiers quand il arrive. Lancée une seule fois par page, et seulement quand ce document a
// déjà reçu un partage (js/sync-resume.js) : un document qui ne reçoit rien ne la paie pas.
export function startReceiving(deps) {
  receiving ||= loadSharingEngine(deps).then(() => import('../kit/js/synchro/target/loop.js')).then(loop => { loop.startAutoConsolidation(() => {}); return true; }).catch(error => { receiving = null; throw error; });
  return receiving;
}
