// Les textes de « Créer une table » pour l'annuaire (retour du porteur du 25/11 : « laisser l'option d'en créer une »), en français (vouvoiement) et en anglais
// dans le même lot : la première ligne du choix de la table des personnes et la fenêtre qui dit ce que GFS écrit. Ils rejoignent ceux du module par
// js/i18n/i18n-annuaire.js.

export const ANNUAIRE_TABLE_STRINGS = Object.freeze({
  fr: {
    'an.tbl.item': 'Créer une table pour cet annuaire…',
    'an.tbl.itemHint': 'GFS la crée et la tient, avec votre accord',
    'an.tbl.title': 'Créer la table des personnes',
    'an.tbl.name': 'Nom de la table',
    'an.tbl.columns': 'Colonnes créées',
    'an.tbl.why': 'GFS ajoute à votre document cette table, vide et dédiée à votre annuaire : une colonne pour le nom, une pour l’adresse e-mail. Rien d’autre n’est '
      + 'modifié. Les autres colonnes (le poste, le téléphone…) s’ajouteront depuis le réglage, quand vous les demanderez, et vous retrouverez la table dans Grist. '
      + 'Si vous annulez le réglage, la table reste dans le document.',
    'an.tbl.ok': 'Créer la table',
    'an.tbl.taken': 'Une table porte déjà ce nom.',
    'an.tbl.failed': 'La table n’a pas pu être créée : {reason}',
  },
  en: {
    'an.tbl.item': 'Create a table for this directory…',
    'an.tbl.itemHint': 'GFS creates and keeps it, with your consent',
    'an.tbl.title': 'Create the people table',
    'an.tbl.name': 'Table name',
    'an.tbl.columns': 'Columns created',
    'an.tbl.why': 'GFS adds this table to your document, empty and dedicated to your directory: one column for the name, one for the email address. Nothing else is '
      + 'changed. The other columns (title, phone…) will be added from the settings, when you ask for them, and you will find the table in Grist. If you cancel '
      + 'the settings, the table stays in the document.',
    'an.tbl.ok': 'Create the table',
    'an.tbl.taken': 'A table already has this name.',
    'an.tbl.failed': 'The table could not be created: {reason}',
  },
});
