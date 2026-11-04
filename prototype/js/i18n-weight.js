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
    'weight.pj': '+ pièces jointes',
    'weight.pjTip': 'Ajoute au total les pièces jointes du document qui ne sont pas des fichiers de l’explorateur, comme les photos d’une colonne « Pièces jointes ». Un fichier envoyé deux fois n’est compté qu’une fois ; les PDF de la liste ne sont pas recomptés.',
    'weight.pjLoading': 'Lecture des pièces jointes du document…',
    'weight.pjNone': 'Cette fenêtre ne peut pas lire les pièces jointes du document.',
    'weight.pjFailed': 'GFS n’a pas pu lire les pièces jointes du document : {reason}',
    'weight.totalSplit': '{list} pour la liste + {pj} pour {n} {n|pièce jointe|pièces jointes} du document.',
  },
  en: {
    'ex.weight': 'Size',
    'weight.o': '{n} B',
    'weight.ko': '{n} KB',
    'weight.mo': '{n} MB',
    'weight.go': '{n} GB',
    'weight.total': 'Total',
    'weight.totalTip': 'Estimated size of what the list shows (folders included), without Grist’s history. An attachment cited by several files is counted once.',
    'weight.pj': '+ attachments',
    'weight.pjTip': 'Adds to the total the document’s attachments that are not explorer files, such as the photos of an “Attachments” column. A file uploaded twice is counted once; the PDFs of the list are not counted again.',
    'weight.pjLoading': 'Reading the document’s attachments…',
    'weight.pjNone': 'This window cannot read the document’s attachments.',
    'weight.pjFailed': 'GFS could not read the document’s attachments: {reason}',
    'weight.totalSplit': '{list} for the list + {pj} for {n} {n|attachment|attachments} of the document.',
  },
});
