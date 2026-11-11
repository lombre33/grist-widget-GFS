// Les sites de vidéos dont GFS sait poser le lecteur (contrats 3.4 point 7, 5.2 point 11). Un petit fichier à part, sans import : le manifeste, la politique de
// l'app et le lecteur le lisent tous trois.

export const PROVIDERS = Object.freeze(['youtube', 'vimeo']);

// Les sites que GFS sait jouer parmi ceux qu'une app déclare (`permissions.lecteurs.fournisseurs`) : l'ordre de la déclaration, sans doublon.
export const knownProviders = list => (Array.isArray(list) ? [...new Set(list.filter(name => PROVIDERS.includes(name)))] : []);
