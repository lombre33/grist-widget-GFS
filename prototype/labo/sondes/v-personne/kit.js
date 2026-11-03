// Sonde X du labo (contrats 5.2, point 9) : une app écrite avec le kit commun, comme le sera Tuesday. Elle lit `GfsLink.identity()` quand le contexte arrive et s'abonne par `GfsLink.onIdentity` ;
// ce qu'elle a vu se lit dans `document.body.dataset.sonde` : l'identité du contexte, puis chaque valeur que l'abonné reçoit.
import { GfsLink } from '/kit/js/gfs-link.js';

const seen = { hosted: GfsLink.hosted, arrivee: undefined, abonne: [] };
const publish = () => { document.body.dataset.sonde = JSON.stringify(seen); };
GfsLink.onIdentity(value => { seen.abonne.push(value); publish(); });
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
GfsLink.ready.then(() => { seen.arrivee = GfsLink.identity(); publish(); });
