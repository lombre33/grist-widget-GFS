// Le cadre voisin du labo (étape 2, contrats 9 point 4) : un cadre qui n'est ni Grist ni l'app active écrit à GFS un message que seul Grist devrait
// lui envoyer : `onOptions`, les réglages de la section. S'il atteignait le script d'API de Grist, GFS croirait qu'Automation+ est installée (et que
// l'app ouverte ne l'est plus). Sa cible vient de son nom (cadre ajouté par le labo à l'intérieur d'une app) ou de la balise # de son adresse :
//   voisins     toutes les fenêtres de la même page que lui (GFS en fait partie), comme le ferait un autre widget de la page de Grist ;
//   grandparent le parent de son parent : GFS, quand ce cadre est le cadre d'un cadre d'app.
(function () {
  'use strict';
  var mode = window.name || window.location.hash.slice(1);
  var forged = { mtype: 4, data: { settings: { accessLevel: 'full' }, options: { 'gfs.apps': { publipostage: { extensions: [] }, automation: { extensions: [] } } } } };
  var targets = [];
  if (mode === 'voisins') {
    for (var i = 0; i < window.parent.frames.length; i++) targets.push(window.parent.frames[i]);
  } else if (mode === 'grandparent') {
    targets.push(window.parent.parent);
  }
  var sent = 0;
  targets.forEach(function (target) {
    try { target.postMessage(forged, '*'); sent += 1; } catch (error) { /* une fenêtre qui refuse */ }
  });
  document.title = 'écrit à ' + sent + ' fenêtre(s) (' + mode + ')';
}());
