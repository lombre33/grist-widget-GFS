// Recevoir un partage, côté contrôleur (« Nouveau > Importer > D'un autre document Grist… », décisions du 09/11) : l'article du sous-menu (grisé avec sa raison
// quand rien ne peut s'écrire), la fenêtre de la réception (js/sharing/share-receive-window.js) et sa reprise quand Grist recharge la page : publier le
// formulaire la recharge, et la fenêtre qui attendait le lien du formulaire se perdait (retour du porteur du 25/11, docs.getgrist.com). Le moteur, le parcours
// et la fenêtre ne se chargent qu'au premier besoin (js/sharing/sync-service.js).

// deps : ceux de js/sharing/share-other.js (`createOtherDocuments`) ; `said(error)` : la phrase d'une erreur du partage ; `settled()` : ce que la fenêtre fait
//   en se fermant (poser les règles des tables techniques, ce qui recharge la page).
export function createReceiving({ deps, said, settled }) {
  const { t } = deps;

  // La fenêtre de la réception, de zéro (`extra` vide) ou reprise à l'étape du lien (`extra.resume`) : la boucle de réception du moteur démarre dès que la
  // réponse est rendue, pour que les fichiers arrivent sans recharger la page.
  async function openReception(extra) {
    const sync = await import('./sync-service.js');
    const engineDeps = { docApi: deps.docApi(), transfer: deps.transfer, language: deps.language, busy: () => false };
    const [{ openShareReceive }, { createTargetFlow }, running] = await Promise.all(
      [import('./share-receive-window.js'), import('./share-receive-flow.js'), sync.loadReceiveEngine(engineDeps)]);
    const waiting = extra.resume ? (await running.awaitingReceptions())[0] : null;
    if (extra.resume && !waiting) return; // la réponse a été rendue entre-temps (une autre page du même document)
    await openShareReceive({
      container: deps.container, t, inertTargets: deps.inertTargets, resumed: waiting ? { name: waiting.note.name } : undefined, createFlow: () =>
        createTargetFlow({ engine: running, resume: waiting, onReplied: () => void sync.startReceiving(engineDeps).catch(() => {}) }),
      errorText: running.errorText, notice: deps.notice, settled,
    });
  }

  return {
    // Le geste de la personne : la fenêtre de zéro, pour un propriétaire seulement.
    async receive() {
      const blocked = deps.writeBlock();
      if (blocked) { deps.notice(blocked); return; }
      try {
        if ((await deps.transfer.isOwner()) !== true) { deps.notice(t('sr.why.owner')); return; }
        await openReception({});
      } catch (error) { deps.notice(await said(error)); }
    },
    // La page vient de s'ouvrir (js/sharing/sync-resume.js) : si une réception attendait le lien du formulaire quand Grist a rechargé la page, la fenêtre
    // revient à cette étape. Sans réception en attente, rien ne s'ouvre ; jamais une erreur levée.
    async resumeReceive() {
      try {
        if (deps.writeBlock() || (await deps.transfer.isOwner()) !== true) return;
        await openReception({ resume: true });
      } catch (error) { console.warn('GFS : la réception en attente ne reprend pas', error); }
    },
  };
}
