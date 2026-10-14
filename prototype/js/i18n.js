// Les textes de GFS, en français et en anglais dans le même lot (charte : « modèle », jamais « template » en français ; pluriels par
// {n|singulier|pluriel}, comme le kit ; le vide d'une liste s'écrit « — Choisir … — »). À passer au kit (étape 3) avec la traduction des apps.

const STRINGS = {
  fr: {
    'gfs.title': 'Grist Factory Suite',
    'gfs.noGrist': 'GFS doit être ajouté comme widget personnalisé dans Grist.',
    'gfs.loading': '{app} se charge…',
    'gfs.timeout': '{app} ne répond pas.',
    'gfs.loadFailed': 'GFS ne démarre pas : {reason}',
    'gfs.files': 'Fichiers',
    'gfs.filesTip': 'Ouvrir l’explorateur de fichiers',
    'gfs.apps': 'Apps',
    'gfs.appsTip': 'Apps et extensions de Grist Factory Suite',
    'gfs.idle': 'Aucune app ouverte. Choisis un fichier dans l’explorateur.',

    'ex.title': 'Mes fichiers',
    'ex.display': 'Affichage',
    'ex.list': 'Liste',
    'ex.tiles': 'Vignettes',
    'ex.path': 'Chemin',
    'ex.search': 'Rechercher…',
    'ex.searchLabel': 'Rechercher un fichier',
    'ex.allTypes': 'Tous les types',
    'ex.typeFilter': 'Filtrer par type',
    'ex.new': 'Nouveau',
    'ex.recent': 'Récents',
    'ex.fav': 'Favoris',
    'ex.me': 'Moi',
    'ex.results': 'Résultats',
    'ex.folders': 'Dossiers',
    'ex.name': 'Nom',
    'ex.type': 'Type',
    'ex.modified': 'Modifié',
    'ex.by': 'Par',
    'ex.open': 'Ouvrir',
    'ex.close': 'Fermer',
    'ex.closeNone': 'Aucune app n’est ouverte : choisis d’abord un fichier.',
    'ex.untitled': '(sans nom)',
    'ex.fileCount': '{n} {n|fichier|fichiers}',
    'ex.subfolderCount': '{n} {n|sous-dossier|sous-dossiers}',
    'ex.emptyAll': 'Aucun fichier. Crée-en un avec « Nouveau ».',
    'ex.emptyFolder': 'Dossier vide.',
    'ex.emptyFav': 'Aucun favori pour le moment.',
    'ex.emptySearch': 'Aucun fichier ne correspond.',
    'ex.hintPersonal': 'Rangement personnel : les autres personnes ne le voient pas.',
    'ex.hintFav': 'Favori, le tien seulement.',
    'ex.hintSelect': 'Sélectionne un fichier pour voir ses détails.',
    'ex.opensIn': 'S’ouvre dans {app}',
    'ex.modifiedOn': 'Modifié : {date}',
    'ex.modifiedBy': 'par {by}',
    'ex.today': 'Auj. {time}',
    'ex.yesterday': 'Hier',
    'ex.pin': 'Épingler en favori',
    'ex.unpin': 'Retirer des favoris',
    'ex.more': 'Plus d’actions',
    'ex.rename': 'Renommer',
    'ex.duplicate': 'Dupliquer',
    'ex.move': 'Déplacer vers…',
    'ex.delete': 'Supprimer…',
    'ex.openFolder': 'Ouvrir le dossier',
    'ex.lockedType': 'Créé avec une version plus récente de {app}',
    'ex.lockedExtension': 'Demande l’extension {name} (Grist Factory Suite)',
    'ex.lockedHint': 'Grisé : un double-clic explique pourquoi',
    'ex.loading': 'Lecture des fichiers…',
    'ex.readFailed': '{app} : lecture impossible ({reason}).',
    'ex.notice.open': 'Provisoire : {app} ne sait pas encore ouvrir un fichier précis, il s’ouvre sur son modèle habituel.',
    'ex.notice.new': 'Provisoire : {app} ne sait pas encore créer un fichier de ce type depuis GFS, il s’ouvre sur son modèle habituel.',
    'ex.notice.filing': 'Provisoire : épingler, renommer et ranger se font encore dans {app}.',
    'ex.notice.noApp': 'Aucune app installée ne sait ouvrir ce type de fichier.',
  },
  en: {
    'gfs.title': 'Grist Factory Suite',
    'gfs.noGrist': 'GFS must be added to Grist as a custom widget.',
    'gfs.loading': '{app} is loading…',
    'gfs.timeout': '{app} is not responding.',
    'gfs.loadFailed': 'GFS cannot start: {reason}',
    'gfs.files': 'Files',
    'gfs.filesTip': 'Open the file explorer',
    'gfs.apps': 'Apps',
    'gfs.appsTip': 'Apps and extensions of Grist Factory Suite',
    'gfs.idle': 'No app is open. Pick a file in the explorer.',

    'ex.title': 'My files',
    'ex.display': 'View',
    'ex.list': 'List',
    'ex.tiles': 'Tiles',
    'ex.path': 'Path',
    'ex.search': 'Search…',
    'ex.searchLabel': 'Search for a file',
    'ex.allTypes': 'All types',
    'ex.typeFilter': 'Filter by type',
    'ex.new': 'New',
    'ex.recent': 'Recent',
    'ex.fav': 'Favorites',
    'ex.me': 'Me',
    'ex.results': 'Results',
    'ex.folders': 'Folders',
    'ex.name': 'Name',
    'ex.type': 'Type',
    'ex.modified': 'Modified',
    'ex.by': 'By',
    'ex.open': 'Open',
    'ex.close': 'Close',
    'ex.closeNone': 'No app is open: pick a file first.',
    'ex.untitled': '(untitled)',
    'ex.fileCount': '{n} {n|file|files}',
    'ex.subfolderCount': '{n} {n|subfolder|subfolders}',
    'ex.emptyAll': 'No files yet. Create one with “New”.',
    'ex.emptyFolder': 'Empty folder.',
    'ex.emptyFav': 'No favorites yet.',
    'ex.emptySearch': 'No file matches.',
    'ex.hintPersonal': 'Personal folders: other people do not see them.',
    'ex.hintFav': 'Favorite, yours only.',
    'ex.hintSelect': 'Select a file to see its details.',
    'ex.opensIn': 'Opens in {app}',
    'ex.modifiedOn': 'Modified: {date}',
    'ex.modifiedBy': 'by {by}',
    'ex.today': 'Today {time}',
    'ex.yesterday': 'Yesterday',
    'ex.pin': 'Pin as favorite',
    'ex.unpin': 'Remove from favorites',
    'ex.more': 'More actions',
    'ex.rename': 'Rename',
    'ex.duplicate': 'Duplicate',
    'ex.move': 'Move to…',
    'ex.delete': 'Delete…',
    'ex.openFolder': 'Open folder',
    'ex.lockedType': 'Created with a newer version of {app}',
    'ex.lockedExtension': 'Needs the {name} extension (Grist Factory Suite)',
    'ex.lockedHint': 'Greyed out: double-click to see why',
    'ex.loading': 'Reading files…',
    'ex.readFailed': '{app}: cannot read ({reason}).',
    'ex.notice.open': 'Provisional: {app} cannot open a specific file yet, it opens on its usual template.',
    'ex.notice.new': 'Provisional: {app} cannot create a file of this type from GFS yet, it opens on its usual template.',
    'ex.notice.filing': 'Provisional: pinning, renaming and filing are still done in {app}.',
    'ex.notice.noApp': 'No installed app can open this type of file.',
  },
};

const warned = new Set();

// Rend { lang, t } : t(clé, variables) remplace {nom} et choisit le singulier ou le pluriel de {n|singulier|pluriel}.
export function createI18n(language) {
  const lang = language === 'en' ? 'en' : 'fr';
  const rules = new Intl.PluralRules(lang);
  const dict = STRINGS[lang];
  const t = (key, vars) => {
    let text = Object.hasOwn(dict, key) ? dict[key] : STRINGS.fr[key];
    if (text === undefined) {
      if (!warned.has(key)) { warned.add(key); console.warn(`GFS : texte inconnu « ${key} »`); }
      return key;
    }
    if (vars) {
      text = text.replace(/\{(\w+)\|([^|{}]*)\|([^|{}]*)\}/g,
        (all, name, one, other) => (name in vars ? (rules.select(Number(vars[name])) === 'one' ? one : other) : all));
      text = text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
    }
    return text;
  };
  return { lang, t };
}

export const STRING_TABLES = STRINGS;
