// L'état d'une arrivée de « Partagés avec moi » d'après ses deux marques (js/sharing/received-files.js) : un module sans dépendance, que le modèle de
// l'explorateur et le groupement par dossier (js/sharing/received-folders.js) lisent sans passer par la lecture des tables.
export const PENDING = 'pending';
export const ACCEPTED = 'accepted';
export const REFUSED = 'refused';

// L'état d'une arrivée d'après ses deux marques : un refus passe devant un accord (une ligne marquée des deux n'est pas un cas que GFS écrit, mais que
// l'envoyeur ne peut pas produire non plus).
export const stateOf = ({ accepted, refused }) => (refused ? REFUSED : accepted ? ACCEPTED : PENDING);
