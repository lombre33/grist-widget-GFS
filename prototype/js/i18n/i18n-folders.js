// Les textes des dossiers créés, vidés et supprimés depuis l'explorateur (décision du porteur du 04/11 : « créer des dossiers et sous-dossiers », tout se fait
// depuis l'explorateur), en français et en anglais dans le même lot. Ils rejoignent ceux de GFS dans js/i18n/i18n.js ; le fichier est à part pour que i18n.js
// reste sous les 600 lignes de code de l'outil d'audit.

export const FOLDER_STRINGS = Object.freeze({
  fr: {
    'ex.newFolder': 'Nouveau dossier',
    'ex.newFolderTitle': 'Nouveau dossier dans « {folder} »',
    'ex.newFolderConfirm': 'Créer',
    'ex.deleteFolder': 'Supprimer le dossier',
    'ex.folderDeleted': 'Dossier « {name} » supprimé.',
    'ex.folderNotEmpty': 'Ce dossier contient encore des fichiers : déplacez-les ou mettez-les à la corbeille, puis supprimez le dossier.',
    'ex.folderGone': 'Ce dossier n’existe plus.',
    'ex.spaces': 'Espaces',
    'ex.spaceUnknown': 'Un fichier se range dans un espace ou dans un de ses dossiers, pas dans « Espaces » seul.',
    'ex.spaceOwnersOnly': 'Seul un propriétaire du document range dans un espace partagé.',
    'ex.spaceRootTaken': '« Espaces » est réservé aux espaces partagés : choisissez un autre nom.',
    'ex.spaceCreateElsewhere': 'Un espace se crée dans « Partager… », puis « Gérer les partages… », onglet Espaces.',
    'ex.spaceFixed': 'Un espace se gère dans « Partager… », puis « Gérer les partages… », onglet Espaces.',
    'ex.spaceFolderFixed': 'Un dossier d’espace ne se renomme ni ne se déplace pas encore : ses partages le suivraient mal.',
  },
  en: {
    'ex.newFolder': 'New folder',
    'ex.newFolderTitle': 'New folder in “{folder}”',
    'ex.newFolderConfirm': 'Create',
    'ex.deleteFolder': 'Delete folder',
    'ex.folderDeleted': 'Folder “{name}” deleted.',
    'ex.folderNotEmpty': 'This folder still holds files: move them or send them to the trash, then delete the folder.',
    'ex.folderGone': 'This folder no longer exists.',
    'ex.spaces': 'Spaces',
    'ex.spaceUnknown': 'A file is filed in a space or in one of its folders, not in “Spaces” alone.',
    'ex.spaceOwnersOnly': 'Only an owner of the document files into a shared space.',
    'ex.spaceRootTaken': '“Spaces” is reserved for shared spaces: choose another name.',
    'ex.spaceCreateElsewhere': 'A space is created in “Share…”, then “Manage sharing…”, Spaces tab.',
    'ex.spaceFixed': 'A space is managed in “Share…”, then “Manage sharing…”, Spaces tab.',
    'ex.spaceFolderFixed': 'A space folder cannot be renamed or moved yet: its shares would not follow it.',
  },
});
