// Sonde V du labo (contrats 3.4 point 6 et 5.2 point 9) : une app minimale qui demande `contexte` à GFS et note, dans `document.body.dataset.sonde`, ce qu'elle reçoit : le contexte tel que GFS l'a rendu
// et chaque événement de GFS (nom et corps). Les sondes V (qui déclare l'identité) et W (qui ne la déclare pas) partagent cette page : seul leur manifeste diffère.
(function () {
  'use strict';
  var seen = { contexte: null, evenements: [] };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(seen); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'appel') {
      // Comme toute app (contrats 5.1, point 3) : un appel qu'elle ne connaît pas reçoit `GFS_INCONNU`. Sans cela, `fermer` reste sans réponse, GFS attend dix secondes et demande à la personne : la sonde
      // qu'on remplace restait à l'écran et le labo croyait lire la suivante.
      if (typeof msg.id === 'number') post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'Appel inconnu' });
    } else if (msg.type === 'reponse' && msg.id === 1) { seen.contexte = msg.data; publish(); }
    else if (msg.type === 'evenement') { seen.evenements.push({ nom: msg.nom, data: msg.data }); publish(); }
  });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  // Comme une app de Grist (le script d'API dit « prête », puis « thème posé ») : GFS la montre. Une sonde qui se tait reste cachée, et aucun clic ne l'atteint.
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  publish();
}());
