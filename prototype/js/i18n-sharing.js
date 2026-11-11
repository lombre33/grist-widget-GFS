// Les textes de la question « Un seul lien pour deux formulaires ? » (js/publication-window.js ; contrats 3.3 point 6 et 3.4 point 8 ; choix du porteur du 11/11, « Au choix, non coché »),
// en français (vouvoiement) et en anglais dans le même lot. Dans leur propre fichier : js/i18n.js reste sous les 600 lignes de code de l'outil d'audit.

export const SHARING_STRINGS = Object.freeze({
  fr: {
    'sl.title': 'Un seul lien pour deux formulaires ?',
    'sl.text': '{app} veut que le formulaire de la page « {page} » ait le même lien public que :',
    'sl.item': '« {page} », formulaire de {n|la table|les tables} {tables}',
    'sl.quote': '« {name} »',
    'sl.itemBare': '« {page} »',
    'sl.note': 'Une seule adresse ouvre alors tous ces formulaires, à toute personne qui l’a, sans compte : si elle fuit, elle les ouvre tous. Refusez pour que ce formulaire garde son propre lien.',
    'sl.allow': 'Même lien',
    'sl.refuse': 'Refuser',
  },
  en: {
    'sl.title': 'One link for two forms?',
    'sl.text': '{app} wants the form on the page “{page}” to have the same public link as:',
    'sl.item': '“{page}”, form of the {n|table|tables} {tables}',
    'sl.quote': '“{name}”',
    'sl.itemBare': '“{page}”',
    'sl.note': 'A single address then opens all these forms, to anyone who has it, without an account: if it leaks, it opens them all. Refuse to keep this form on its own link.',
    'sl.allow': 'Same link',
    'sl.refuse': 'Refuse',
  },
});
