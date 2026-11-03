// Sonde K du labo (contrats 5.4, points 2 et 7) : une app écrite avec le kit commun, comme le sera Tuesday. Elle charge `js/gfs-link.js` du dépôt du kit (le labo le sert sous /kit/) et laisse
// le labo appeler `GfsLink.choose` et `GfsLink.openFile`, qui parlent à GFS par l'enveloppe du contrat ; ce que l'app a reçu à l'ouverture se lit dans `document.body.dataset.sonde`.
import { GfsLink } from '/kit/js/gfs-link.js';

window.sondeK = { GfsLink };
// Comme une app de Grist (le script d'API dit « prête », puis « thème posé ») : GFS la montre.
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
GfsLink.ready.then(() => { document.body.dataset.sonde = JSON.stringify({ contexte: GfsLink.context() !== null, hosted: GfsLink.hosted, ouverture: GfsLink.opening() }); });
