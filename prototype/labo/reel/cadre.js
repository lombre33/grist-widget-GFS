// Le sous-cadre isolé de la sonde : il attend de sa page le jeton, joue les requêtes REST depuis son origine opaque et rend les états. Il ne parle qu'à sa page (`window.parent`).
(function () {
  'use strict';
  window.addEventListener('message', async event => {
    if (event.source !== window.parent || !event.data || event.data.type !== 'gfs-reel-requetes') return;
    let resultats;
    try { resultats = await window.GFSRest.battery(event.data); } catch (error) { resultats = { erreur: window.GFSRest.describe(error) }; }
    window.parent.postMessage({ type: 'gfs-reel-resultats', origine: window.origin, resultats }, '*');
  });
  window.parent.postMessage({ type: 'gfs-reel-pret' }, '*');
}());
