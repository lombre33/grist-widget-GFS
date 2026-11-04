// Les textes des dossiers créés, vidés et supprimés depuis l'explorateur (décision du porteur du 04/11 : « créer des dossiers et sous-dossiers », tout se fait depuis l'explorateur), en français et en anglais
// dans le même lot. Ils rejoignent ceux de GFS dans js/i18n.js ; le fichier est à part pour que i18n.js reste sous les 600 lignes de code de l'outil d'audit.

export const FOLDER_STRINGS = Object.freeze({
  fr: {
    'ex.newFolder': 'Nouveau dossier',
    'ex.newFolderTitle': 'Nouveau dossier dans « {folder} »',
    'ex.newFolderConfirm': 'Créer',
    'ex.deleteFolder': 'Supprimer le dossier',
    'ex.folderDeleted': 'Dossier « {name} » supprimé.',
    'ex.folderNotEmpty': 'Ce dossier contient encore des fichiers : déplace-les ou mets-les à la corbeille, puis supprime le dossier.',
    'ex.folderGone': 'Ce dossier n’existe plus.',
  },
  en: {
    'ex.newFolder': 'New folder',
    'ex.newFolderTitle': 'New folder in “{folder}”',
    'ex.newFolderConfirm': 'Create',
    'ex.deleteFolder': 'Delete folder',
    'ex.folderDeleted': 'Folder “{name}” deleted.',
    'ex.folderNotEmpty': 'This folder still holds files: move them or send them to the trash, then delete the folder.',
    'ex.folderGone': 'This folder no longer exists.',
  },
});
