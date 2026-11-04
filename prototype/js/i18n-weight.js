// Les textes du poids dans l'explorateur (demande du porteur, 04/11 : « estimer le poids de chaque élément »), en français et en anglais dans le même lot. Ils rejoignent ceux de GFS dans js/i18n.js ;
// le fichier est à part pour que i18n.js reste sous les 600 lignes de code de l'outil d'audit. 1 Ko = 1 024 octets.

export const WEIGHT_STRINGS = Object.freeze({
  fr: {
    'ex.weight': 'Poids',
    'weight.o': '{n} o',
    'weight.ko': '{n} Ko',
    'weight.mo': '{n} Mo',
    'weight.go': '{n} Go',
    'weight.total': 'Total',
    'weight.totalTip': 'Poids estimé de ce que la liste montre (dossiers compris), sans l’historique de Grist. Une pièce jointe citée par plusieurs fichiers n’est comptée qu’une fois.',
  },
  en: {
    'ex.weight': 'Size',
    'weight.o': '{n} B',
    'weight.ko': '{n} KB',
    'weight.mo': '{n} MB',
    'weight.go': '{n} GB',
    'weight.total': 'Total',
    'weight.totalTip': 'Estimated size of what the list shows (folders included), without Grist’s history. An attachment cited by several files is counted once.',
  },
});
