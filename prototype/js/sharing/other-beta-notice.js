// L'avis du partage entre documents Grist (demande du porteur du 25/11) : la fonction repose sur le widget Sync+, encore en bêta, donc très expérimentale.
// Un seul texte (`so.beta`), montré partout où l'on entre dans cette fonction : l'onglet de « Partager », l'onglet de « Gérer les partages » et les deux
// fenêtres qui relient ou reçoivent un document. Il informe, il ne bloque rien.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

// `fk` : le repère de l'avis dans la fenêtre où il se montre (un par endroit).
export const betaNotice = (t, fk) => h('p', { class: 'so-beta', role: 'note', dataset: { fk } }, icon('info'), h('span', null, t('so.beta')));
