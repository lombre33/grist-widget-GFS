# 035 · « Nouveau > Importer » : GFS te donne le fichier choisi, tes trois imports passent par la même porte (demande du porteur)

App : Publipostage+ · posée le 22/10/2026 · demande du porteur du 22/10 (« Sous-menu Importer ») · quand : au prochain lot, sans urgence ;
du code dans ton app (la lecture de l'ouverture, `js/gfs-open.js`, tes trois imports) ; sans effet dans l'app seule

## Quoi

**1. La demande.** Le porteur, dans GFS : « les imports possibles par Publipostage+ (Excel, docx, pptx etc.) il faudrait qu'ils soient aussi
disponibles dans le menu Nouveau, sous-menu Import ». Il a choisi « Sous-menu Importer » : le menu « Nouveau » de l'explorateur de GFS a un
sous-menu « Importer » ; la personne y choisit un format, GFS ouvre le sélecteur de fichier du navigateur, elle choisit le fichier, et ton
app le reçoit et en fait un modèle vierge, comme ton menu « + » le fait.

**2. Ce que GFS a livré** (contrats 2.7 point 4, 5.2 point 3, 5.4 point 1 ; `prototype/labo/run-importer.mjs`). Ton manifeste déclare
`actions.importer` : `excel` (une grille ; `.xlsx`, `.xlsm`), `markdown` (un document ; `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`) et
`powerpoint` (une présentation ; `.pptx`, `.ppsx`, `.potx`). GFS ouvre lui-même le sélecteur (ton cadre est isolé : il n'a pas le geste de la
personne), contrôle la terminaison, puis te donne le fichier **une seule fois**, à l'ouverture de l'app (réponse à ton premier `contexte`,
`GfsLink.opening()`) ou, app déjà ouverte, par l'appel `ouvrir` (`GfsLink.onOpen`) :

```
{ fichier: null, type: 'grille' | 'document' | 'presentation', dossier, raison: 'importer',
  importation: { valeur: 'excel' | 'markdown' | 'powerpoint', fichier: <File> } }
```

**Mesuré** dans un vrai Grist, avec une app d'essai qui fait ce que cette consigne te demande : le `File` arrive dans un cadre sans
`allow-same-origin`, lisible (`instanceof File`, `name`, `size`, `type`, `text()`, `arrayBuffer()`), au démarrage comme dans l'appel `ouvrir`.
GFS ne lit pas le fichier et ne le garde pas.

**3. Ce que GFS te demande.**

- **a. `js/gfs-link.js`, `normalizeOpening`** : garder `importation: { valeur, fichier }` quand `raison` vaut `importer` (`valeur` un
  texte, `fichier` un `File` ; sinon l'ouverture est lue sans importation, comme aujourd'hui). Aujourd'hui elle ne garde que `fichier`, `type`,
  `dossier` et `raison` : le fichier tomberait là.
- **b. `js/gfs-open.js`** : une ouverture qui porte `importation` **n'est pas un « Nouveau » du type** (`requestedBlank` lit « pas de fichier et un
  type » : sans ce point, l'app ouvrirait un modèle vierge, répondrait `{ ouvert: true }` et le fichier de la personne serait perdu sans un mot).
  Au démarrage (devant ton ordre d'arrivée, comme `startupBlankType`) et par l'appel `ouvrir`, la valeur désigne l'import : `excel` fait ce que fait
  `onImportXlsx`, `markdown` ce que fait `onImportMd`, `powerpoint` ce que fait `onImportPptx`, **avec le fichier reçu à la place du
  sélecteur** : le rappel que chaque menu passe à `GridXlsxImport.chooseFile` devient une fonction nommée que le menu et GFS appellent.
- **c. Le même chemin que ton menu « + »** : mêmes lectures, mêmes refus et mêmes phrases du coin d'état (fichier illisible, vide, trop gros,
  ancien format…), même question « Enregistrer / Abandonner / Annuler » avant de quitter un modèle modifié (après une lecture réussie, comme
  aujourd'hui), même résultat : un modèle vierge sans nom, pas encore enregistré, et rien d'écrit dans le document avant son premier
  « Enregistrer ». PowerPoint demande l'extension « Diapositives » comme au menu : GFS grise la ligne tant qu'elle manque, et l'app refuse
  quand même proprement. Un document en lecture seule refuse aussi (comme `isReadOnly()` au menu).
- **d. La réponse à `ouvrir`** : `{ ouvert: true }` quand le modèle importé est ouvert à la fin ; `{ ouvert: false }` si la personne annule (la
  question d'enregistrement), si le fichier est refusé, ou si le document est en lecture seule. Pas de délai : la personne peut prendre son temps.
- **e. Seule** (adresse sans `gfs=`) : rien ne change ; tes trois entrées du menu « + » gardent leur sélecteur.

**4. Ce que GFS ne te demande pas.** Aucune table, colonne, clé de réglage, message ni adresse de plus : `importation` voyage dans
l'`ouverture` et l'appel `ouvrir` que tu lis déjà. Le kit laisse lui aussi tomber `importation` aujourd'hui ; il la gardera dans sa prochaine
version, sans que tu aies à l'attendre (le point a est chez toi).

## Pourquoi

Le porteur veut retrouver dans GFS ce que ton menu « + » donne seule. GFS est le seul à pouvoir ouvrir un sélecteur de fichier depuis son
explorateur ; ton app est la seule à savoir lire un classeur, un Markdown ou un PowerPoint : le fichier passe de l'un à l'autre, jamais le code.
Tant que ta page d'état ne dit pas cette consigne faite, GFS **grise** tes trois formats (« Pas encore », un clic dit d'importer depuis ton menu) :
l'app d'aujourd'hui prendrait l'appel pour un « Nouveau » et le fichier serait perdu.

## Fait quand

`GFS-ETAT.md` donne « 035 · faite · `<commit>` », avec des tests qui échouent sur l'ancien code : `normalizeOpening` garde `importation` (une
valeur et un `File`) et ne la garde pas pour une autre `raison` ; une ouverture `importer` n'ouvre pas de modèle vierge à la place de l'import ;
chacune des trois valeurs lance la lecture de son fichier sans sélecteur, et un fichier refusé donne `{ ouvert: false }`. GFS rejoue alors
`run-importer` avec ton app, passe `ACCEPTS_OPEN.publipostage.importer` à `true` (un commit de GFS, relu) et dégrise Excel, Markdown et, avec
l'extension, PowerPoint.
