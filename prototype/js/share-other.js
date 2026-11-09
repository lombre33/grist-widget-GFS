// La ligne « Un autre document Grist… » de la liste du champ d'ajout de « Partager » (js/share-window.js, option `extraTargets`) : envoyer une copie de ce fichier à un autre document qui a GFS, par le moteur de
// partage du kit (kit/js/synchro/, repris de Sync+). Un seul endroit pour la ligne, que le contrôleur (js/controller.js) et la page d'essai Firefox (test/pages/explorateur.js) lisent tous deux. Grisée, jamais
// masquée, quand elle ne peut pas servir : un clic dit pourquoi. Le premier lot ne couvre que les PDF que GFS garde, et un propriétaire du document.
import { FILES_APP } from './gfs-files.js';

// Pourquoi la ligne est grisée (une phrase), ou null. Sans parcours branché (la page d'essai), le partage entre deux documents « arrive bientôt ».
function whyNot(t, { file, state, open }) {
  if (!open) return t('share.other.why');
  if (!file || file.folder || file.app !== FILES_APP) return t('share.other.why.pdf');
  if (!state || state.owner !== true) return t('share.other.why.owner');
  return null;
}

// opts : { file (le fichier de la fenêtre), state (l'état qu'elle dessine : { owner, … }), open(file) → ouvre la fenêtre d'envoi }.
export function otherDocumentTargets(t, opts = {}) {
  const why = whyNot(t, opts);
  return [{ label: t('share.other'), hint: t('share.other.hint'), icon: 'link', greyed: Boolean(why), why, run: () => { if (!why) opts.open(opts.file); } }];
}

// Ouvre la fenêtre d'envoi du fichier. Le moteur, son port et la fenêtre ne se chargent qu'à ce moment. deps : { file, t, container, inertTargets, docApi (grist.docApi), transfer, language () → 'fr' | 'en',
// notice (un avis hors fenêtre) }. Rend la promesse de la fermeture de la fenêtre.
export async function openOtherDocument(deps) {
  const [{ openShareOther }, { createSourceFlow }, { loadSharingEngine }] = await Promise.all([import('./share-other-window.js'), import('./share-other-flow.js'), import('./sync-service.js')]);
  const engine = await loadSharingEngine({ docApi: deps.docApi, transfer: deps.transfer, language: deps.language, busy: () => false });
  // La fenêtre « Partager » est encore ouverte dessous : elle devient inerte avec le reste (la liste est prise avant que la nouvelle fenêtre existe).
  const below = [...deps.container.querySelectorAll('.mod-scrim')];
  return openShareOther({
    container: deps.container, t: deps.t, inertTargets: () => [...deps.inertTargets(), ...below], file: { id: deps.file.id, name: deps.file.name },
    flow: createSourceFlow({ engine, file: deps.file }), errorText: engine.errorText, notice: deps.notice,
  });
}
