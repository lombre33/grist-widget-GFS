// Le squelette de l'explorateur (index.html, `#boot` ; css/gfs.css, `.boot`) : des barres de gris sur la grille de l'explorateur, posées avant que le code ait
// fini de lire le document, pour que le cadre ne reste pas blanc (27/11, demande du porteur : « une impression de fluidité à chaque ouverture »). Il passe sous
// les cadres des apps et sous
// l'explorateur : celui qui arrive le recouvre, et GFS le retire quand il est prêt, ou qu'il ne démarre pas.

// Retire le squelette de la page `doc` (rien n'arrive s'il n'y est plus).
export function removeSkeleton(doc = document) {
  const skeleton = doc.getElementById('boot');
  if (skeleton) skeleton.remove();
}
