// « À propos de Grist Factory Suite » : ce que la charte met dans le panneau « Crédits » d'un widget (section 1, « Marque » : version, auteur, site, licence).
// L'éditeur affiché est Grist Factory, jamais un compte personnel. Pas de « Bio » (à écrire par le porteur) ni de logo (un fichier à obtenir de lui) tant
// qu'ils ne sont pas là ; pas de lien vers le dépôt public tant que celui de l'organisation n'existe pas. La version est celle que GFS donne déjà aux apps
// (`hote.version`, contrats 5.2).

import { HOST } from './context.js';

export const CREDITS = Object.freeze({ auteur: 'Grist Factory', site: 'grist-factory.fr', licence: 'GNU GPL v3.0' });

// Les quatre lignes de la fenêtre, dans la langue de `t`.
export const aboutItems = t => [
  t('about.version', { value: HOST.version }), t('about.author', { value: CREDITS.auteur }), t('about.site', { value: CREDITS.site }),
    t('about.license', { value: CREDITS.licence }),
];
