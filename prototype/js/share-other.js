// Le partage d'un fichier avec d'autres documents Grist, côté contrôleur (« Partager > Dans un autre document Grist », « Gérer les partages > Autres documents » ; maquette du 09/11) : lit les documents reliés,
// change le niveau d'un fichier chez l'un d'eux, ouvre la fenêtre du premier envoi à un document neuf (js/share-other-window.js), arrête un lien. Le moteur de partage du kit (kit/js/synchro/, repris de Sync+), son
// port et les fenêtres ne se chargent qu'au premier besoin : rien ne pèse sur la page de quelqu'un qui ne partage rien. Un seul endroit pour le contrôleur (js/controller.js) et la page d'essai Firefox
// (test/pages/explorateur.js). Grisé, jamais masqué, quand ça ne peut pas servir : un clic dit pourquoi. Le premier lot ne couvre que les PDF que GFS garde, et un propriétaire du document.
import { FILES_APP } from './gfs-files.js';
import { applyLevel, stopLink } from './share-links.js';
import { closeSharingTables } from './sync-rules.js';

// Pourquoi l'onglet est grisé (une phrase), ou null.
export function whyNot(t, { file, state }) {
  if (!file || file.folder || file.app !== FILES_APP) return t('share.other.why.pdf');
  if (!state || state.owner !== true) return t('share.other.why.owner');
  return null;
}

// Le nom de ce document, pour nommer le lien chez l'autre (le journal qu'il y reçoit) ; à défaut, un nom neutre.
export async function documentName(transfer, t) {
  try {
    const reply = await transfer.rest('GET', '', { writable: false });
    const name = reply && reply.body && reply.body.name;
    return typeof name === 'string' && name.trim() ? name.trim() : t('so.link.default');
  } catch (error) { return t('so.link.default'); }
}

// Les tables techniques que la fenêtre vient de créer (`GFS_Synchro`, un journal) se ferment aux non-propriétaires une fois la fenêtre fermée : Grist recharge alors la page, ce qui aurait défait le parcours en
// cours. Le moteur de partage reprend à l'ouverture suivante (js/sync-resume.js). Réservé à un propriétaire que GFS a prouvé tel ; sans effet, et sans bruit, quand rien n'est à poser (js/sync-rules.js).
async function closeTechnicalTables(deps) {
  if ((await deps.transfer.isOwner()) === true) await closeSharingTables({ docApi: deps.docApi() });
}

// deps : { t, container, inertTargets() , docApi() → grist.docApi, transfer (js/transfer.js), language () → 'fr' | 'en', notice (un avis hors fenêtre), writeBlock() → la raison d'un blocage ou null }.
export function createOtherDocuments(deps) {
  const { t } = deps;
  const engine = async () => (await import('./sync-service.js')).loadSharingEngine({ docApi: deps.docApi(), transfer: deps.transfer, language: deps.language, busy: () => false });
  const links = async () => (await engine()).readLinks();
  const said = async error => (error && error.share ? t(`so.error.${error.share}`) : t('so.failed', { message: (await engine().then(each => each.errorText(error), () => (error && error.message) || String(error))) }));

  // La fenêtre du premier envoi à un document neuf. La fenêtre « Partager » est encore ouverte dessous : elle devient inerte avec le reste (la liste est prise avant que la nouvelle fenêtre existe).
  // `file` null : relier les deux documents sans rien envoyer (« Gérer les partages > Autres documents > Relier un document… »).
  async function open(file) {
    const blocked = deps.writeBlock();
    if (blocked) { deps.notice(blocked); return; }
    try {
      const [{ openShareOther }, { createSourceFlow }, running, name] = await Promise.all([import('./share-other-window.js'), import('./share-other-flow.js'), engine(), documentName(deps.transfer, t)]);
      const below = [...deps.container.querySelectorAll('.mod-scrim')];
      await openShareOther({
        container: deps.container, t, inertTargets: () => [...deps.inertTargets(), ...below], file: file ? { id: file.id, name: file.name } : null,
        createFlow: (mode, strict) => createSourceFlow({ engine: running, file, mode: file ? mode : 'live', strict, name }), errorText: running.errorText, notice: deps.notice, settled: () => closeTechnicalTables(deps),
      });
    } catch (error) { deps.notice(await said(error)); }
  }

  // « Nouveau > Importer > D'un autre document Grist… » : recevoir un partage. L'article du sous-menu (grisé avec sa raison quand rien ne peut s'écrire) et la fenêtre de la réception (js/share-receive-window.js) ;
  // la boucle de réception du moteur démarre dès que la réponse est rendue, pour que les fichiers arrivent sans recharger la page.
  async function receive() {
    const blocked = deps.writeBlock();
    if (blocked) { deps.notice(blocked); return; }
    try {
      if ((await deps.transfer.isOwner()) !== true) { deps.notice(t('sr.why.owner')); return; }
      const sync = await import('./sync-service.js');
      const engineDeps = { docApi: deps.docApi(), transfer: deps.transfer, language: deps.language, busy: () => false };
      const [{ openShareReceive }, { createTargetFlow }, running] = await Promise.all([import('./share-receive-window.js'), import('./share-receive-flow.js'), sync.loadReceiveEngine(engineDeps)]);
      await openShareReceive({
        container: deps.container, t, inertTargets: deps.inertTargets, createFlow: () => createTargetFlow({ engine: running, onReplied: () => void sync.startReceiving(engineDeps).catch(() => {}) }),
        errorText: running.errorText, notice: deps.notice, settled: () => closeTechnicalTables(deps),
      });
    } catch (error) { deps.notice(await said(error)); }
  }

  return {
    receive,
    link: () => open(null),
    entry() {
      const blocked = deps.writeBlock();
      return { action: 'receive', icon: 'download', family: null, greyed: Boolean(blocked), reason: blocked || '', focus: null, label: t('sr.entry'), hint: blocked || t('sr.entry.hint') };
    },
    // L'onglet de « Partager » pour `file` (l'état que la fenêtre dessine : { owner, … }).
    tab(file, state) {
      const why = whyNot(t, { file, state });
      return {
        why, fileId: file ? file.id : '', loadLinks: links, onNew: () => open(file),
        async onLevel(link, level) {
          const blocked = why || deps.writeBlock();
          if (blocked) return { ok: false, message: blocked };
          try {
            const done = await applyLevel(await engine(), link, file.id, level);
            if (!done.later) return { ok: true };
            const doc = link.doc.name || link.name;
            void done.later.then(() => deps.notice(t('so.once.done', { name: file.name, doc })), async error => deps.notice(await said(error)));
            return { ok: true, note: t('so.once.going', { name: file.name }) };
          } catch (error) { return { ok: false, message: await said(error) }; }
        },
      };
    },
    // « Gérer les partages > Autres documents » : les liens, et l'arrêt d'un lien (ou l'annulation d'une invitation en attente).
    links,
    async stop(link) {
      const blocked = deps.writeBlock();
      if (blocked) return { ok: false, message: blocked };
      try { await stopLink(await engine(), link); return { ok: true }; } catch (error) { return { ok: false, message: await said(error) }; }
    },
  };
}
