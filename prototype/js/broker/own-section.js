// L'appel `section` (contrats 5.4, point 15) : l'app demande à GFS quelle est la section de la page où il se trouve. Grist ne le dit pas à un widget, et sous
// GFS toutes les sections de GFS ont la même adresse : une app qui cherche la sienne dans `_grist_Views_section` par son adresse ne sait pas laquelle est la
// sienne dès que deux GFS partagent la table (Publipostage+, export en lot : « plusieurs widgets de cette table ont la même adresse que lui »). GFS, lui, la
// retrouve (js/broker/view-options.js, `locate`) ; il ne dit que ce dont il est sûr, et jamais plus que l'identifiant : l'app en tire ce qu'elle sait lire du
// document (ses tables internes, déclarées). Du code sans accès à la page : l'hôte donne `locate()`.

// Pourquoi GFS ne sait pas, en mots fermés : `acces` (GFS n'a pas l'accès complet au document), `lecture-seule` (plusieurs GFS pareils et un document qui ne
// s'écrit pas), `inconnue` (le reste : aucune section reconnue, un brouillon posé, une lecture refusée).
const REASONS = { access: 'acces', 'read-only': 'lecture-seule' };

// Les poignées de l'enveloppe (5.1) : `section` -> `{ id }`, ou `{ id: null, raison }` ; jamais d'erreur, l'app qui ne reçoit pas d'identifiant garde sa
// conduite d'avant.
export function ownSectionHandlers({ locate }) {
  return {
    section: async () => {
      const found = await locate();
      return found.id ? { id: found.id } : { id: null, raison: REASONS[found.reason] || 'inconnue' };
    },
  };
}
