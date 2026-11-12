// Les textes de GFS, en français et en anglais dans le même lot (charte : « modèle », jamais « template » en français ; pluriels par
// {n|singulier|pluriel}, comme le kit ; le vide d'une liste s'écrit « — Choisir … — »). À passer au kit (étape 3) avec la traduction des apps.

import { TRASH_STRINGS } from './i18n-trash.js';
import { FOLDER_STRINGS } from './i18n-folders.js';
import { WEIGHT_STRINGS } from './i18n-weight.js';
import { NATIVES_STRINGS } from './i18n-natives.js';
import { RIGHTS_STRINGS } from './i18n-rights.js';
import { SHARE_STRINGS } from './i18n-share.js';
import { SHARE_OTHER_STRINGS } from './i18n-share-other.js';
import { MANAGE_STRINGS } from './i18n-manage.js';
import { RECEIVED_STRINGS } from './i18n-received.js';
import { NOTIFICATION_STRINGS } from './i18n-notifications.js';
import { EXPLORER_STRINGS } from './i18n-explorer.js';
import { SHARING_STRINGS } from './i18n-sharing.js';

const STRINGS = {
  fr: {
    ...TRASH_STRINGS.fr,
    ...FOLDER_STRINGS.fr,
    ...WEIGHT_STRINGS.fr,
    ...NATIVES_STRINGS.fr,
    ...RIGHTS_STRINGS.fr,
    ...SHARE_STRINGS.fr,
    ...SHARE_OTHER_STRINGS.fr,
    ...MANAGE_STRINGS.fr,
    ...RECEIVED_STRINGS.fr,
    ...NOTIFICATION_STRINGS.fr,
    ...EXPLORER_STRINGS.fr,
    ...SHARING_STRINGS.fr,
    // Le démarrage de GFS, le repli sur la copie figée d'une app et la question posée quand une app doit se fermer.
    'gfs.title': 'Grist Factory Suite',
    'gfs.noGrist': 'GFS doit être ajouté comme widget personnalisé dans Grist.',
    'gfs.loading': '{app} se charge…',
    'gfs.timeout': '{app} ne répond pas.',
    'gfs.leave.silentTitle': '{app} ne répond pas',
    'gfs.leave.silentText': 'GFS a demandé à {app} de se fermer, sans réponse. Si sa question d’enregistrement est à l’écran, attendez et répondez-y. Fermer quand même perd ce qui n’est pas enregistré.',
    'gfs.leave.faultTitle': '{app} n’a pas pu se fermer',
    'gfs.leave.faultText': '{app} a répondu : {reason}. Fermer quand même perd ce qui n’est pas enregistré.',
    'gfs.leave.unexpected': 'réponse inattendue',
    'gfs.leave.force': 'Fermer quand même',
    'gfs.leave.wait': 'Attendre',
    'gfs.leave.stay': 'Rester',
    'gfs.fallback': '{app} : la dernière version ne répond pas, GFS ouvre sa copie figée.',
    'gfs.loadFailed': 'GFS ne démarre pas : {reason}',
    'gfs.filesTip': 'Ouvrir l’explorateur de fichiers',
    'gfs.apps': 'Apps',
    'gfs.appsTip': 'Apps et extensions de Grist Factory Suite',
    // La table de travail : la table (et la ligne) que l'app ouverte reçoit comme si c'était celle de sa page.
    'work.title': 'Table de travail',
    'work.tipPage': 'Table de travail : celle de la page ({table})',
    'work.tipTable': 'Table de travail : {table}',
    'work.tipChosen': 'Table de travail : {table}, ligne {row}',
    'work.tipPageRow': 'Table de travail : celle de la page ({table}), ligne {row}',
    'work.textTables': 'L’app ouverte travaille sur la table choisie ici, sans rien régler dans Grist. La ligne est facultative : sans elle, la première.',
    'work.row': 'Ligne',
    'work.rowOf': 'Choisir aussi la ligne de {table}',
    'work.textRows': 'La ligne de {table} sur laquelle l’app travaille :',
    'work.page': 'La table de la page : {table}',
    'work.search': 'Rechercher…',
    'work.back': 'Tables',
    'work.close': 'Fermer',
    'work.loading': 'Lecture de {table}…',
    'work.failed': 'La table {table} est illisible : {reason}',
    'work.none': 'Rien ne correspond à la recherche.',
    'work.more': 'Les {n} premières sur {total} : affinez la recherche.',
    'work.rows': '{n} {n|ligne|lignes}',
    'work.locked': '{app} ne lit pas cette table.',
    'work.refused': '{app} ne lit pas la table {table} : elle suit la page.',
    // Le lien d'une app avec la grille de la page.
    'link.done': 'GFS a relié ce widget à la grille de « {table} » : la ligne suit votre clic.',
    'link.several': 'Plusieurs grilles de « {table} » sont sur la page : GFS ne sait pas laquelle suivre. Reliez le widget vous-même (« Sélectionner par », dans le panneau de droite de Grist).',
    // La barre de GFS : sa position et ses boutons.
    'dock.opened': 'Fichiers ouverts',
    'dock.openedCount': 'Fichiers ouverts : {n}',
    'dock.openedNone': 'Aucun fichier ouvert',
    'dock.openedWhy': 'Les fichiers que vous ouvrez depuis l’explorateur restent ici : vous y revenez d’un clic, sans repartir de l’arborescence.',
    'dock.openedMore': 'Ouvrir un autre fichier…',
    'dock.openedDropName': 'Retirer des ouverts : {name}',
    'dock.place': 'Position de la barre',
    'dock.ltOn': 'LanguageTool travaille dans les apps (un clic le coupe)',
    'dock.ltOff': 'LanguageTool est coupé dans les apps (un clic le rallume)',
    'dock.gauche': 'À gauche',
    'dock.haut': 'En haut',
    'dock.droite': 'À droite',
    'dock.bas': 'En bas',
    // L'état sans app ouverte, et les bulles des deux boutons flottants (l'explorateur, les apps).
    'gfs.idle': 'Aucune app ouverte. Choisissez un fichier dans l’explorateur.',
    'gfs.settingsFailed': 'Ce choix n’a pas pu être enregistré : {reason}',
    'gfs.needsFullAccess': 'GFS a besoin de l’accès complet au document pour lister vos fichiers et ouvrir vos apps. Dans le panneau de droite de Grist, acceptez la demande d’accès ou réglez le niveau d’accès sur « accès complet ».',
    'gfs.needsFullAccessHint': 'Demande l’accès complet au document.',

    // Le menu « Réglages ».
    'set.tip': 'Réglages de Grist Factory Suite',
    'set.menu': 'Réglages',
    'set.theme': 'Thème…',
    'set.advanced': 'Réglages avancés',
    'set.advanced.tip': 'Des réglages dont on se sert rarement',
    'set.langtool': 'Bouton LanguageTool',
    'langtool.tip': 'Un bouton de la barre coupe ou rallume LanguageTool dans l’app ouverte',
    'set.about': 'À propos…',
    // La fenêtre « À propos ».
    'about.title': 'À propos de Grist Factory Suite',
    'about.text': 'Le widget Grist qui héberge les apps Grist Factory et ouvre leurs fichiers.',
    'about.version': 'Version : {value}',
    'about.author': 'Auteur : {value}',
    'about.site': 'Site : {value}',
    'about.license': 'Licence : {value}',
    'about.close': 'Fermer',

    // Le choix de la langue, commun à GFS et à ses apps.
    'lang.tip': 'Langue de Grist Factory Suite et de ses apps',
    'lang.menu': 'Langue',
    'lang.auto': 'Comme Grist ({name})',
    'lang.notKept': 'Ce choix ne sera pas gardé : votre navigateur refuse l’enregistrement.',

    // Les ambiances (thèmes) et les couleurs de GFS et de ses apps.
    'theme.tip': 'Thème de Grist Factory Suite et de ses apps',
    'theme.title': 'Thème',
    'theme.text': 'L’ambiance et la couleur de GFS et de ses apps, sur ce navigateur.',
    'theme.ambiances': 'Ambiance',
    'theme.mini': 'Fichiers',
    'theme.amb.defaut': 'Grist Factory',
    'theme.amb.defaut.sub': 'D’origine, sobre',
    'theme.amb.pop': 'Pop',
    'theme.amb.pop.sub': 'Joyeux, arrondi',
    'theme.amb.papier': 'Papier',
    'theme.amb.papier.sub': 'Éditorial, fin',
    'theme.amb.brut': 'Brut',
    'theme.amb.brut.sub': 'Franc, tranché',
    'theme.amb.enseigne': 'Enseigne',
    'theme.amb.enseigne.sub': 'Rose, lumineux',
    'theme.color': 'Couleur d’accent',
    'theme.color.amb': 'Celle de l’ambiance',
    'theme.color.own': 'La mienne',
    'theme.color.pick': 'Choisir ma couleur',
    'theme.color.missing': 'Le sélecteur de couleur ne s’est pas chargé : GFS garde la couleur de l’ambiance. Rechargez la page pour réessayer.',
    'theme.acces': 'Accessibilité renforcée',
    'theme.acces.d': 'Texte à 7:1, cibles de 36 px, focus épais, sans décor ni animation.',
    'theme.acces.tip': 'Garde les couleurs de l’ambiance choisie, ou la vôtre. Texte à 7:1 et de 14 px au moins, traits à 3:1, cadres épais, cibles de 36 px, anneau de focus épais, sans décor, sans capitales et sans animation.',
    'theme.check': 'Couleurs calculées : contraste de {ratio}:1 au moins en clair et en sombre (la norme demande 4,5:1).',
    'theme.check.origin': 'Ambiance d’origine : contraste de {ratio}:1 au moins en clair et en sombre (la norme demande 4,5:1).',
    'theme.check.strict': 'Texte à {ratio}:1 et traits à {edge}:1 au moins, en clair et en sombre (la norme demande 7:1 et 3:1).',
    'theme.adjusted': 'Votre couleur a été un peu éclaircie ou assombrie ({hex}) pour que le texte des boutons reste lisible.',
    'theme.saved': 'S’applique tout de suite, reste sur ce navigateur.',
    'theme.notKept': 'Ce choix vaut pour cette page seulement : votre navigateur refuse de le garder.',
    'theme.reset': 'Revenir à Grist Factory',
    'theme.close': 'Fermer',

    // La fenêtre « Apps et extensions » : installer, activer, choisir le mode CDN ou la copie vendorisée.
    'mod.title': 'Apps et extensions',
    'mod.count': '{n} {n|actif|actifs} sur {total}',
    'mod.countNote': 'seul le code coché est chargé',
    'mod.badge.on': 'Actif',
    'mod.badge.off': 'Désactivé',
    'mod.badge.locked': 'Indisponible',
    'mod.always': 'Toujours actif.',
    'mod.needsApp': 'Demande {app}.',
    'mod.open': 'Ouvrir',
    'mod.openTip': 'Ouvrir {app}',
    'mod.close': 'Fermer',
    'mod.saved': 'Ces choix s’enregistrent tout de suite, pour tout le document.',
    'mod.readonly': 'Lecture seule : ces choix ne s’enregistrent pas.',
    'mod.needsAccess': 'Accès complet au document requis : ces choix ne s’enregistrent pas.',
    // Les questions « Créer la table … ? » : aucune table n'est créée sans l'accord de la personne.
    'table.title': 'Créer la table GFS_Rangement ?',
    'table.text': 'GFS y retient les apps installées de ce document et le rangement de ses fichiers (favoris, dossiers). Pour que ce rangement soit à chacun, GFS y lit aussi l’adresse de la personne : Grist l’inscrit dans une ligne ajoutée puis retirée aussitôt. La table est ajoutée au document, avec une page pour elle ; les apps ne l’écrivent jamais. Sans elle, rien ne s’installe ni ne se range.',
    'table.create': 'Créer la table',
    'table.cancel': 'Annuler',
    // La question « Ouvrir au public ? » : ce qu'une app demande d'ouvrir à toute personne qui aura le lien d'un formulaire.
    'pub.title': 'Ouvrir au public ?',
    'pub.text': '{app} veut ouvrir des données de ce document à toute personne qui aura le lien d’un de ses formulaires publiés, sans compte. Cette personne pourra :',
    'pub.write': 'ajouter des lignes à la table « {table} », dans toutes ses colonnes, celles qu’on y ajoutera plus tard comprises',
    'pub.writeHidden': 'ajouter des lignes à la table « {table} », dans toutes ses colonnes, y compris {n|cette colonne|ces colonnes} que le formulaire ne montre pas : {columns}',
    'pub.read': 'lire toutes les valeurs de la colonne « {column} » de la table « {table} »',
    'pub.more': ' et {n} {n|autre|autres}',
    'pub.note': 'Rien ne limite le nombre de lignes ajoutées ni ne contrôle ce qu’elles contiennent. Cette personne ne pourra ni modifier ni supprimer de ligne, ni lire d’autre donnée. Pour fermer le lien : « Dépublier » le formulaire, dans Grist.',
    'pub.allow': 'Autoriser',
    'pub.refuse': 'Refuser',
    'table.declined': 'Rien n’a été installé : la table GFS_Rangement n’a pas été créée.',
    'mod.sizeKb': '≈ {n} Ko',
    'mod.sizeMb': '≈ {n} Mo',
    'mod.library': 'Bibliothèque {lib}, {size} au premier usage',
    'mod.mode.cdn': 'Depuis un CDN',
    'mod.mode.cdnHint': 'Par défaut. Chargée depuis jsDelivr, vérifiée par son empreinte.',
    'mod.mode.cdnNone': 'Indisponible : GFS n’a pas encore d’adresse publique pour servir cette bibliothèque.',
    'mod.mode.vendorise': 'Copie de GFS',
    'mod.mode.vendoriseHint': 'Servie par GFS, sans adresse externe : pour les réseaux fermés.',
    'mod.missingLib': '{lib} {version} manque au catalogue de GFS : l’extension ne peut pas être activée.',
    'mod.invalid': 'Cette app n’est pas utilisable : {reasons}',

    // Le lien d'un fichier vers une app qui ne l'a plus.
    'link.gone': '{app} n’a plus ce fichier : le lien ne peut pas s’ouvrir.',
  },
  en: {
    ...TRASH_STRINGS.en,
    ...FOLDER_STRINGS.en,
    ...WEIGHT_STRINGS.en,
    ...NATIVES_STRINGS.en,
    ...RIGHTS_STRINGS.en,
    ...SHARE_STRINGS.en,
    ...SHARE_OTHER_STRINGS.en,
    ...MANAGE_STRINGS.en,
    ...RECEIVED_STRINGS.en,
    ...NOTIFICATION_STRINGS.en,
    ...EXPLORER_STRINGS.en,
    ...SHARING_STRINGS.en,
    // Le démarrage de GFS, le repli sur la copie figée d'une app et la question posée quand une app doit se fermer.
    'gfs.title': 'Grist Factory Suite',
    'gfs.noGrist': 'GFS must be added to Grist as a custom widget.',
    'gfs.loading': '{app} is loading…',
    'gfs.timeout': '{app} is not responding.',
    'gfs.leave.silentTitle': '{app} is not responding',
    'gfs.leave.silentText': 'GFS asked {app} to close and got no answer. If its save question is on screen, wait and answer it. Closing anyway loses whatever is not saved.',
    'gfs.leave.faultTitle': '{app} could not close',
    'gfs.leave.faultText': '{app} answered: {reason}. Closing anyway loses whatever is not saved.',
    'gfs.leave.unexpected': 'unexpected answer',
    'gfs.leave.force': 'Close anyway',
    'gfs.leave.wait': 'Wait',
    'gfs.leave.stay': 'Stay',
    'gfs.fallback': '{app}: the latest version is not responding, GFS opens its pinned copy.',
    'gfs.loadFailed': 'GFS cannot start: {reason}',
    'gfs.filesTip': 'Open the file explorer',
    'gfs.apps': 'Apps',
    'gfs.appsTip': 'Apps and extensions of Grist Factory Suite',
    // La table de travail : la table (et la ligne) que l'app ouverte reçoit comme si c'était celle de sa page.
    'work.title': 'Working table',
    'work.tipPage': 'Working table: the page’s ({table})',
    'work.tipTable': 'Working table: {table}',
    'work.tipChosen': 'Working table: {table}, row {row}',
    'work.tipPageRow': 'Working table: the page’s ({table}), row {row}',
    'work.textTables': 'The open app works on the table chosen here, without changing anything in Grist. The row is optional: without it, the first one.',
    'work.row': 'Row',
    'work.rowOf': 'Also choose the row of {table}',
    'work.textRows': 'The row of {table} the app works on:',
    'work.page': 'The page’s table: {table}',
    'work.search': 'Search…',
    'work.back': 'Tables',
    'work.close': 'Close',
    'work.loading': 'Reading {table}…',
    'work.failed': 'The {table} table cannot be read: {reason}',
    'work.none': 'Nothing matches the search.',
    'work.more': 'The first {n} of {total}: refine the search.',
    'work.rows': '{n} {n|row|rows}',
    'work.locked': '{app} does not read this table.',
    'work.refused': '{app} does not read the {table} table: it follows the page.',
    // Le lien d'une app avec la grille de la page.
    'link.done': 'GFS linked this widget to the “{table}” grid: the row follows your click.',
    'link.several': 'There are several “{table}” grids on the page: GFS cannot tell which one to follow. Link the widget yourself (“Select by” in Grist’s right panel).',
    // La barre de GFS : sa position et ses boutons.
    'dock.opened': 'Open files',
    'dock.openedCount': 'Open files: {n}',
    'dock.openedNone': 'No open files',
    'dock.openedWhy': 'Files you open from the explorer stay here: go back to any of them in one click, without starting over from the tree.',
    'dock.openedMore': 'Open another file…',
    'dock.openedDropName': 'Remove from open files: {name}',
    'dock.place': 'Bar position',
    'dock.ltOn': 'LanguageTool is working in the apps (click to turn it off)',
    'dock.ltOff': 'LanguageTool is turned off in the apps (click to turn it back on)',
    'dock.gauche': 'Left',
    'dock.haut': 'Top',
    'dock.droite': 'Right',
    'dock.bas': 'Bottom',
    // L'état sans app ouverte, et les bulles des deux boutons flottants (l'explorateur, les apps).
    'gfs.idle': 'No app is open. Pick a file in the explorer.',
    'gfs.settingsFailed': 'This choice could not be saved: {reason}',
    'gfs.needsFullAccess': 'GFS needs full access to the document to list your files and open your apps. In Grist’s right panel, accept the access request or set the access level to “full document access”.',
    'gfs.needsFullAccessHint': 'Needs full access to the document.',

    // Le menu « Réglages ».
    'set.tip': 'Grist Factory Suite settings',
    'set.menu': 'Settings',
    'set.theme': 'Theme…',
    'set.advanced': 'Advanced settings',
    'set.advanced.tip': 'Settings that are rarely needed',
    'set.langtool': 'LanguageTool button',
    'langtool.tip': 'A button in the bar turns LanguageTool off or back on in the open app',
    'set.about': 'About…',
    // La fenêtre « À propos ».
    'about.title': 'About Grist Factory Suite',
    'about.text': 'The Grist widget that hosts the Grist Factory apps and opens their files.',
    'about.version': 'Version: {value}',
    'about.author': 'Author: {value}',
    'about.site': 'Site: {value}',
    'about.license': 'License: {value}',
    'about.close': 'Close',

    // Le choix de la langue, commun à GFS et à ses apps.
    'lang.tip': 'Language of Grist Factory Suite and its apps',
    'lang.menu': 'Language',
    'lang.auto': 'Same as Grist ({name})',
    'lang.notKept': 'This choice will not be kept: your browser refuses to store it.',

    // Les ambiances (thèmes) et les couleurs de GFS et de ses apps.
    'theme.tip': 'Theme of Grist Factory Suite and its apps',
    'theme.title': 'Theme',
    'theme.text': 'The look and the color of GFS and its apps, on this browser.',
    'theme.ambiances': 'Look',
    'theme.mini': 'Files',
    'theme.amb.defaut': 'Grist Factory',
    'theme.amb.defaut.sub': 'Original, sober',
    'theme.amb.pop': 'Pop',
    'theme.amb.pop.sub': 'Cheerful, rounded',
    'theme.amb.papier': 'Paper',
    'theme.amb.papier.sub': 'Editorial, fine',
    'theme.amb.brut': 'Raw',
    'theme.amb.brut.sub': 'Blunt, bold',
    'theme.amb.enseigne': 'Neon sign',
    'theme.amb.enseigne.sub': 'Pink, glowing',
    'theme.color': 'Accent color',
    'theme.color.amb': 'The look’s color',
    'theme.color.own': 'My own',
    'theme.color.pick': 'Choose my color',
    'theme.color.missing': 'The color picker did not load: GFS keeps the look’s color. Reload the page to try again.',
    'theme.acces': 'Enhanced accessibility',
    'theme.acces.d': 'Text at 7:1, 36 px targets, thick focus, no decoration or animation.',
    'theme.acces.tip': 'Keeps the colors of the look you chose, or yours. Text at 7:1 and at least 14 px, lines at 3:1, thick frames, 36 px targets, thick focus ring, no decoration, no capitals and no animation.',
    'theme.check': 'Computed colors: contrast of at least {ratio}:1 in light and dark (the standard asks for 4.5:1).',
    'theme.check.origin': 'Original look: contrast of at least {ratio}:1 in light and dark (the standard asks for 4.5:1).',
    'theme.check.strict': 'Text at {ratio}:1 and lines at {edge}:1 or more, in light and dark (the standard asks for 7:1 and 3:1).',
    'theme.adjusted': 'Your color was slightly lightened or darkened ({hex}) so that button text stays readable.',
    'theme.saved': 'Applies right away, stays on this browser.',
    'theme.notKept': 'This choice only holds for this page: your browser refuses to keep it.',
    'theme.reset': 'Back to Grist Factory',
    'theme.close': 'Close',

    // La fenêtre « Apps et extensions » : installer, activer, choisir le mode CDN ou la copie vendorisée.
    'mod.title': 'Apps and extensions',
    'mod.count': '{n} of {total} active',
    'mod.countNote': 'only the ticked code is loaded',
    'mod.badge.on': 'Active',
    'mod.badge.off': 'Off',
    'mod.badge.locked': 'Unavailable',
    'mod.always': 'Always active.',
    'mod.needsApp': 'Needs {app}.',
    'mod.open': 'Open',
    'mod.openTip': 'Open {app}',
    'mod.close': 'Close',
    'mod.saved': 'These choices are saved right away, for the whole document.',
    'mod.readonly': 'Read-only: these choices are not saved.',
    'mod.needsAccess': 'Full document access required: these choices are not saved.',
    // Les questions « Créer la table … ? » : aucune table n'est créée sans l'accord de la personne.
    'table.title': 'Create the GFS_Rangement table?',
    'table.text': 'GFS keeps this document’s installed apps there, and how its files are filed (favorites, folders). So that the filing belongs to each person, GFS also reads the person’s address there: Grist writes it into a row that is added and removed straight away. The table is added to the document, with a page of its own; apps never write to it. Without it, nothing can be installed or filed.',
    'table.create': 'Create the table',
    'table.cancel': 'Cancel',
    // La question « Ouvrir au public ? » : ce qu'une app demande d'ouvrir à toute personne qui aura le lien d'un formulaire.
    'pub.title': 'Open to the public?',
    'pub.text': '{app} wants to open some of this document’s data to anyone who has the link of one of its published forms, no account needed. That person will be able to:',
    'pub.write': 'add rows to the table “{table}”, in all its columns, including those added later',
    'pub.writeHidden': 'add rows to the table “{table}”, in all its columns, including {n|this column|these columns} the form does not show: {columns}',
    'pub.read': 'read every value of the column “{column}” of the table “{table}”',
    'pub.more': ' and {n} more',
    'pub.note': 'Nothing limits how many rows get added or checks what they contain. That person will not be able to edit or delete any row, or to read any other data. To close the link, “Unpublish” the form in Grist.',
    'pub.allow': 'Allow',
    'pub.refuse': 'Refuse',
    'table.declined': 'Nothing was installed: the GFS_Rangement table was not created.',
    'mod.sizeKb': '≈ {n} KB',
    'mod.sizeMb': '≈ {n} MB',
    'mod.library': '{lib} library, {size} on first use',
    'mod.mode.cdn': 'From a CDN',
    'mod.mode.cdnHint': 'Default. Loaded from jsDelivr, checked against its fingerprint.',
    'mod.mode.cdnNone': 'Unavailable: GFS has no public address yet to serve this library.',
    'mod.mode.vendorise': 'GFS copy',
    'mod.mode.vendoriseHint': 'Served by GFS, no external address: for closed networks.',
    'mod.missingLib': '{lib} {version} is missing from the GFS catalogue: the extension cannot be turned on.',
    'mod.invalid': 'This app cannot be used: {reasons}',

    // Le lien d'un fichier vers une app qui ne l'a plus.
    'link.gone': '{app} no longer has this file: the link cannot be opened.',
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
