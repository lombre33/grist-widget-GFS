// Les textes des filtres de l'annuaire que le retour du porteur du 25/11 a ajoutés (« un bouton pour réinitialiser », « un champ de recherche par filtre »,
// « une option par annuaire : le panneau, ou une barre avec le nom de chaque champ »), en français (vouvoiement) et en anglais dans le même lot. Ils rejoignent
// ceux du module par js/i18n/i18n-annuaire.js.

export const ANNUAIRE_FILTER_STRINGS = Object.freeze({
  fr: {
    'an.filter.search': 'Rechercher…',
    'an.filter.searchIn': 'Rechercher dans {name}',
    'an.filter.noMatch': 'Aucune valeur ne correspond.',
    'an.filter.refine': '{n} autres valeurs : précisez la recherche.',
    'an.filters.resetTip': 'Retirer toutes les valeurs cochées',
    'an.filters.resetNone': 'Aucune valeur n’est cochée.',
    'an.filters.chosen': '{n} {n|valeur cochée|valeurs cochées}',
    'an.filters.nothing': 'Aucune valeur cochée',
    'an.opt.filters': 'Filtres',
    'an.opt.filtersSub': 'Comment cet annuaire montre ses filtres',
    'an.opt.filterMode': 'Affichage',
    'an.opt.fmPanel': 'Panneau',
    'an.opt.fmBar': 'Barre',
    'an.opt.fmNote': 'Panneau : tous les filtres s’ouvrent depuis un seul bouton « Filtres ». Barre : une rangée avec un menu par champ, au nom de ce champ. Dans les deux cas, '
      + 'chaque filtre a sa recherche et « Réinitialiser » apparaît dès qu’une valeur est cochée.',
  },
  en: {
    'an.filter.search': 'Search…',
    'an.filter.searchIn': 'Search in {name}',
    'an.filter.noMatch': 'No value matches.',
    'an.filter.refine': '{n} more values: refine the search.',
    'an.filters.resetTip': 'Clear every checked value',
    'an.filters.resetNone': 'Nothing is checked.',
    'an.filters.chosen': '{n} {n|value|values} checked',
    'an.filters.nothing': 'Nothing checked',
    'an.opt.filters': 'Filters',
    'an.opt.filtersSub': 'How this directory shows its filters',
    'an.opt.filterMode': 'Display',
    'an.opt.fmPanel': 'Panel',
    'an.opt.fmBar': 'Bar',
    'an.opt.fmNote': 'Panel: one “Filters” button opens every filter. Bar: a row with one menu per field, named after the field. Either way, each filter has '
      + 'its own search, and “Reset” is there as soon as a value is checked.',
  },
});
