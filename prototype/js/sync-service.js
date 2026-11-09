// Le moteur de partage entre deux documents (kit/js/synchro/, repris de Sync+), chargé au premier besoin et démarré une seule fois par page (son port est global) : ni lui ni le port de GFS ne pèsent
// sur la page de quelqu'un qui ne partage rien. Rend les seules fonctions que les parcours de GFS appellent, dans un objet que leurs essais remplacent (js/share-other-flow.js).
// deps : { docApi (grist.docApi, qui décode les valeurs), transfer (js/transfer.js), language () → 'fr' | 'en', busy () → booléen }.

let loading = null;

async function load(deps) {
  const [{ startSyncEngine }, exporting, inviting, resending, acting, filing, failing, tabling, sourcing, enginePort, { linksFrom }] = await Promise.all([
    import('./sync-port.js'), import('../kit/js/synchro/source/export.js'), import('../kit/js/synchro/source/invite.js'), import('../kit/js/synchro/source/resend.js'),
    import('../kit/js/synchro/source/actions.js'), import('../kit/js/synchro/source/files.js'), import('../kit/js/synchro/errors.js'),
    import('../kit/js/synchro/logic/exports.js'), import('../kit/js/synchro/source/synchro.js'), import('../kit/js/synchro/port.js'), import('./share-links.js'),
  ]);
  startSyncEngine(deps);
  // Le rattrapage du moteur (il envoie le contenu des fichiers, et reprend un envoi que la page a laissé en route) tourne tant que la page est ouverte ; sans la table technique, il ne fait presque rien.
  resending.startAutoCatchUp(() => {});
  // Les documents reliés : ce que la table technique, ses webhooks et leur état disent (js/share-links.js). Sans droit sur les webhooks (pas propriétaire), la liste est vide : rien n'est dit de ce qu'on ne lit pas.
  const readLinks = async () => {
    const schema = await enginePort.readSchema();
    let hooks = null;
    try { hooks = await sourcing.readHooks(); } catch (error) { hooks = null; }
    return linksFrom({ note: sourcing.readSourceNote(schema), rows: await sourcing.syncRows(schema), hooks, tablesOf: tabling.exportTables, emailOf: tabling.exportEmail, statusOf: hook => tabling.hookStatus(hook)[0] });
  };
  return Object.freeze({
    readLinks,
    finishEdit: exporting.finishEdit,
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

// Le côté qui reçoit : le moteur et, en plus, les fonctions d'une réception (kit/js/synchro/target/receive.js), que seul celui qui reçoit charge (js/share-receive-flow.js).
export async function loadReceiveEngine(deps) {
  const [engine, receive, enginePort] = await Promise.all([loadSharingEngine(deps), import('../kit/js/synchro/target/receive.js'), import('../kit/js/synchro/port.js')]);
  return Object.freeze({
    ...engine,
    // Une table de ce nom existe déjà dans ce document (Grist ne distingue pas les majuscules).
    tableTaken: async name => (await enginePort.readSchema()).resolve(name) !== null,
    readInvitation: receive.readInvitation,
    knownReception: receive.knownReception,
    relinkReception: receive.relinkReception,
    checkDestinations: receive.checkDestinations,
    createReception: receive.createReception,
    receptionReply: receive.receptionReply,
    undoReception: receive.undoReception,
  });
}

let receiving = null;

// Le côté qui reçoit : la boucle du moteur qui recopie les journaux reçus dans leur table et attache le contenu des fichiers quand il arrive. Lancée une seule fois par page, et seulement quand ce document a
// déjà reçu un partage (js/sync-resume.js) : un document qui ne reçoit rien ne la paie pas.
export function startReceiving(deps) {
  receiving ||= loadSharingEngine(deps).then(() => import('../kit/js/synchro/target/loop.js')).then(loop => { loop.startAutoConsolidation(() => {}); return true; }).catch(error => { receiving = null; throw error; });
  return receiving;
}
