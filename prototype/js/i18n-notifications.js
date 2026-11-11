// Les textes de la cloche Notifications (js/notifications.js ; maquette du 09/11, la cloche est à droite de l'en-tête de l'explorateur), en français (vouvoiement) et en anglais dans le même lot. Ils rejoignent
// js/i18n.js, qui reste sous les 600 lignes de code de l'outil d'audit.

export const NOTIFICATION_STRINGS = Object.freeze({
  fr: {
    'nt.tip': 'Notifications',
    'nt.tipCount': 'Notifications : {n} à accepter',
    'nt.menu': 'Notifications',
    'nt.none': 'Aucune notification',
    'nt.noneWhy': 'Rien à signaler. Un fichier partagé depuis un autre document Grist s’annonce ici, à accepter.',
    'nt.arrival': '« {name} » de {by}, à accepter',
    'nt.arrivalUnknown': '« {name} », à accepter',
    'nt.folder': 'Dossier « {name} » de {by} : {n} {n|fichier|fichiers} à accepter',
    'nt.folderUnknown': 'Dossier « {name} » : {n} {n|fichier|fichiers} à accepter',
    'nt.open': 'Ouvrir « Partagés avec moi »',
    'nt.openMore': 'Voir {n} autres dans « Partagés avec moi »',
  },
  en: {
    'nt.tip': 'Notifications',
    'nt.tipCount': 'Notifications: {n} to accept',
    'nt.menu': 'Notifications',
    'nt.none': 'No notifications',
    'nt.noneWhy': 'Nothing to report. A file shared from another Grist document is announced here, waiting to be accepted.',
    'nt.arrival': '“{name}” from {by}, to accept',
    'nt.arrivalUnknown': '“{name}”, to accept',
    'nt.folder': 'Folder “{name}” from {by}: {n} {n|file|files} to accept',
    'nt.folderUnknown': 'Folder “{name}”: {n} {n|file|files} to accept',
    'nt.open': 'Open “Shared with me”',
    'nt.openMore': 'See {n} more in “Shared with me”',
  },
});
