// La ligne « Un autre document Grist… » de la liste du champ d'ajout de « Partager » (js/share-window.js, option `extraTargets`) : partager ce fichier avec un autre document qui a GFS, par le moteur de Sync+.
// Elle est là dès aujourd'hui, grisée : un clic dit pourquoi (« grisé, jamais masqué »). Quand le moteur sera dans le kit, `greyed` tombe et `run` ouvre l'invitation. Un seul endroit pour la ligne,
// que le contrôleur (js/controller.js) et la page d'essai Firefox (test/pages/explorateur.js) lisent tous deux.
export function otherDocumentTargets(t) {
  return [{ label: t('share.other'), hint: t('share.other.hint'), icon: 'link', greyed: true, why: t('share.other.why'), run: () => {} }];
}
