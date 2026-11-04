// Une sonde du labo qui ne connaît pas un appel de GFS le dit comme le font le kit et Publipostage+ (contrats 5.1, point 3) : `GFS_INCONNU`. Sans cela, GFS attend dix secondes la réponse à `fermer`
// (contrats 5.4, point 3) et pose sa question « ne répond pas » quand une autre app prend la place de la sonde : l'essai qui change d'app ne mesurerait plus ce qu'il veut mesurer.
// À charger avant le script de la sonde, qui garde ses propres appels (`ouvrir` va à O et à Q, qui ont leur réponse).
(function () {
  'use strict';
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined || msg.type !== 'appel' || !Number.isInteger(msg.id)) return;
    window.parent.postMessage({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'Appel inconnu : ' + String(msg.nom).slice(0, 60) }, '*');
  });
}());
