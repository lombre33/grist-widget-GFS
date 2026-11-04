// Sonde ZC du labo (cahier 4.5, « le calendrier » ; kit 0.8.0) : une app écrite avec le VRAI kit, comme le sera Tuesday. Elle monte `creerCalendrier` dans un cadre qui remplit la page, pose l'ambiance de
// GFS (`Ambiance.start()`), suit la langue de GFS (`GfsLink.onLanguage`) et réserve le bord que la barre de GFS recouvre (`GfsLink.onBar`, contrats 5.2, point 7). Le module ne parle pas à Grist : la
// sonde est son hôte, et `window.sonde` garde ce qu'elle a reçu de lui (`appels`), pour que le labo le relise, et ce que le labo lui commande : les lignes et les options (`definir`), la réponse de l'hôte
// aux déplacements et aux ajouts (`reponse` : 'ok', 'refus' ou 'erreur').
import { GfsLink } from '/kit/js/gfs-link.js';
import { Ambiance } from '/kit/js/ambiance.js';
import { creerCalendrier } from '/kit/js/calendrier/index.js';

const MAINTENANT = new Date(2026, 10, 3, 10, 0, 0);   // mardi 3 novembre 2026, 10 h : le jour du calendrier ne dépend pas de la date du labo
const sonde = { pret: false, appels: [], reponse: 'ok', violations: [], barre: null, langue: 'fr', hote: GfsLink.hosted, ambiances: [] };
const noter = (nom, valeur) => { sonde.appels.push({ nom, valeur }); };
document.addEventListener('securitypolicyviolation', event => { sonde.violations.push(`${event.violatedDirective} ${event.blockedURI}`); });
window.sonde = sonde;

// Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (GFS montre alors le cadre et retire sa phrase « se charge… »).
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');

const hote = document.getElementById('hote');
const cadre = document.getElementById('cadre');
const REMPLISSAGE = { gauche: 'padding-left', haut: 'padding-top', droite: 'padding-right', bas: 'padding-bottom' };
// L'hôte laisse libre la place de la barre : le bord qu'elle recouvre, de son épaisseur (la zone que GFS donne en comprend 4 px tout autour).
function reserver(barre) {
  for (const propriete of Object.values(REMPLISSAGE)) hote.style.removeProperty(propriete);
  if (barre && REMPLISSAGE[barre.bord]) hote.style.setProperty(REMPLISSAGE[barre.bord], `${barre.epaisseur}px`);
}

// La réponse de l'hôte : 'ok', 'refus' (un déplacement rend false, un ajout rejette) ou 'erreur' (les deux rejettent).
const calendrier = creerCalendrier({
  onOuvrir: id => noter('ouvrir', id),
  onDeplacer: async resultat => { noter('deplacer', resultat); if (sonde.reponse === 'refus') return false; if (sonde.reponse === 'erreur') throw new Error('non'); return true; },
  onAjouter: async demande => { noter('ajouter', demande); if (sonde.reponse !== 'ok') throw new Error('non'); return true; },
  onEtat: etat => noter('etat', etat),
});

let demande = { lignes: [], options: {} };
let monte = false;
const afficher = () => { if (monte) calendrier.definir({ lignes: demande.lignes, options: { maintenant: () => new Date(MAINTENANT), langue: sonde.langue, ...demande.options } }); };
// Les lignes et les options que le labo veut voir, au jour de la sonde et dans la langue de GFS.
sonde.definir = (lignes, options = {}) => { demande = { lignes, options }; afficher(); };
sonde.detruire = () => calendrier.detruire();

GfsLink.onLanguage(langue => { sonde.langue = langue || 'fr'; afficher(); });
GfsLink.onBar(barre => { sonde.barre = barre; reserver(barre); });
// L'ambiance que GFS donne, jeton par jeton pour quelques-uns : de quoi comparer à ce que le calendrier affiche.
const echantillon = jetons => Object.fromEntries(['--bg', '--surface', '--text', '--accent', '--accent-solid'].map(nom => [nom, jetons[nom]]));
GfsLink.onAmbiance(message => { sonde.ambiances.push(message && { id: message.id, couleur: message.couleur, clair: echantillon(message.clair), sombre: echantillon(message.sombre) }); });
const ambiance = Ambiance.start();
await Promise.all([ambiance.ready, GfsLink.ready]);
sonde.langue = GfsLink.language() || 'fr';
cadre.append(calendrier.element);
monte = true;
afficher();
sonde.pret = true;
