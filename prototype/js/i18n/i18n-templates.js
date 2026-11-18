// Les textes de « Nouveau > Depuis un modèle » (décision du porteur, 18/11 : « Une galerie commune » ; contrats 5.4, point 13) : l'article du menu, les avis de
// l'ouverture et la fenêtre des modèles de départ, en français et en anglais dans le même lot. Le fichier est à part pour que i18n.js reste sous les 600 lignes
// de code de l'outil d'audit.

export const TEMPLATE_STRINGS = Object.freeze({
  fr: {
    // Le menu « Nouveau », l'avis d'une ouverture qui n'aboutit qu'à moitié et le grisé d'une app qui ne sait pas encore ouvrir un modèle de départ.
    'ex.templates': 'Depuis un modèle…',
    'ex.template.notYet': '{app} ne sait pas encore ouvrir un modèle de départ depuis GFS : choisissez-le dans le menu de l’app.',
    'ex.notice.template': '{app} s’ouvre, mais ne sait pas encore ouvrir ce modèle de départ : choisissez-le dans son menu.',
    // La fenêtre : titre, recherche, pastilles par app, cartes, pied.
    'tp.title': 'Créer à partir d’un modèle',
    'tp.count': '{n} {n|modèle|modèles}',
    'tp.search': 'Chercher un modèle…',
    'tp.all': 'Toutes',
    'tp.soon': 'bientôt',
    'tp.broken': 'illisible',
    'tp.tablesTip': 'Ce modèle vient avec des tables : l’app vous demande l’accord avant d’en créer.',
    'tp.empty': 'Aucune app ne propose encore de modèle de départ.',
    'tp.none': 'Aucun modèle ne correspond à votre recherche.',
    'tp.idle': 'Choisissez un modèle, puis « Créer » : l’app s’ouvre dessus, sans rien enregistrer.',
    'tp.chosen': '{name} · {app} : avec « Créer », un document non enregistré s’ouvre.',
    'tp.chosenTables': '{name} · {app} : avec « Créer », l’app s’ouvre et vous demande l’accord avant de créer des tables.',
    'tp.locked': '{name} : {reason}',
    'tp.appSoon': '{app} ne propose pas encore de modèle de départ.',
    'tp.appBroken': 'Le catalogue de modèles de {app} ne se lit pas ({reason}).',
    'tp.seeApps': 'Voir dans Apps',
    'tp.close': 'Fermer',
    'tp.create': 'Créer',
  },
  en: {
    'ex.templates': 'From a template…',
    'ex.template.notYet': '{app} cannot open a starter template from GFS yet: choose it from the app’s own menu.',
    'ex.notice.template': '{app} opens, but cannot open this starter template yet: choose it from its own menu.',
    'tp.title': 'Create from a template',
    'tp.count': '{n} {n|template|templates}',
    'tp.search': 'Search templates…',
    'tp.all': 'All',
    'tp.soon': 'soon',
    'tp.broken': 'unreadable',
    'tp.tablesTip': 'This template comes with tables: the app asks your consent before creating any.',
    'tp.empty': 'No app offers a starter template yet.',
    'tp.none': 'No template matches your search.',
    'tp.idle': 'Choose a template, then “Create”: the app opens on it, nothing is saved.',
    'tp.chosen': '{name} · {app}: “Create” opens an unsaved document.',
    'tp.chosenTables': '{name} · {app}: “Create” opens the app, which asks your consent before creating tables.',
    'tp.locked': '{name}: {reason}',
    'tp.appSoon': '{app} does not offer starter templates yet.',
    'tp.appBroken': 'The template catalogue of {app} cannot be read ({reason}).',
    'tp.seeApps': 'See in Apps',
    'tp.close': 'Close',
    'tp.create': 'Create',
  },
});
