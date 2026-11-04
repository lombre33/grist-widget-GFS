// Le jeu de lignes que l'hôte donne au calendrier du kit pour les mesures de GFS : celui des essais du kit (navigateur/scenarios-calendrier-gestes.mjs), au même jour, pour que les nombres se
// recoupent. Le labo dans un vrai Grist (run-calendrier-kit.mjs) et l'essai sous Firefox (test/mesures-calendrier.mjs) le lisent ici, une seule fois.

// Mardi 3 novembre 2026, 10 h : le jour du calendrier ne dépend pas de la date de la machine (année, mois à partir de 0, jour, heure).
export const MAINTENANT = [2026, 10, 3, 10];

export const LIGNES = [
  { id: 1, titre: 'Rédiger le cahier', debut: '2026-10-30', fin: '2026-11-03', couleur: { fond: '#dff5e8', texte: '#146c48' } },
  { id: 2, titre: 'Choix de l\'hébergeur', debut: '2026-11-09' },
  { id: 3, titre: 'Maquettes', debut: '2026-11-13', fin: '2026-11-13' },
  { id: 4, titre: 'Atelier', debut: '2026-11-18T09:30', fin: '2026-11-18T11:00' },
  { id: 5, titre: 'Revue', debut: '2026-11-13' },
  { id: 6, titre: 'Bilan', debut: '2026-11-13' },
  { id: 7, titre: 'À planifier' },
  { id: 8, titre: 'Autre à planifier', modifiable: true },
  { id: 9, titre: 'Date cassée', debut: 'demain' },
];

export const HEURES = [
  { id: 20, titre: 'Point équipe', debut: '2026-11-03T09:30', fin: '2026-11-03T10:30' },
  { id: 21, titre: 'Atelier', debut: '2026-11-03T10:00', fin: '2026-11-03T12:00' },
  { id: 22, titre: 'Déjeuner', debut: '2026-11-05T12:00', fin: '2026-11-05T14:00' },
  { id: 23, titre: 'Sans heure', debut: '2026-11-04' },
  { id: 24, titre: 'À caser' },
];

// Les deux jeux ensemble, sans la couleur que Grist donne à la ligne 1 (une donnée de la personne : sa lisibilité n'est pas celle de l'ambiance), pour mesurer les quatre vues d'un coup.
export const TOUT = [...LIGNES.map(({ couleur, ...ligne }) => ligne), ...HEURES];
