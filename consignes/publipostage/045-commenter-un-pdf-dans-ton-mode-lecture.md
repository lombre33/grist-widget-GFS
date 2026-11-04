# 045 · Commenter un PDF dans ton mode Lecture : l'ancre est dans le texte du PDF, le fil dans ta table, la clé est l'identifiant que GFS donne (demande du porteur)

App : Publipostage+ · posée le 04/11/2026 · demande du porteur du 03/11 (« si possible via le mode lecture de Publipostage+ comme ça on a aussi les commentaires et l'UI qui reste
la même ») · quand : au prochain lot, sans urgence, après la 040 qu'elle suit et sans lien avec la 043 ; du code dans ton app (`extensions/lecture-pdf/` : l'ancre, la marque et le
geste sur le texte du PDF ; `js/comments.js` : les fils d'un PDF dans ta table `Publipostage_Commentaires` ; `js/main.js` : le grisé) ; sans effet dans l'app seule (aucun PDF ne s'y
lit) ; rien à déclarer chez GFS

## Quoi

**1. La demande.** Le porteur a demandé à lire les PDF dans GFS « si possible via le mode lecture de Publipostage+ comme ça on a aussi les commentaires et l'UI qui reste la même ».
La 040 t'a fait lire le PDF dans ton mode Lecture ; **cette consigne en fait aussi un document qu'on commente** : la personne sélectionne un passage du PDF, ouvre un fil, y répond,
le résout, le rouvre ou le supprime, avec la fenêtre, les gestes et les couleurs des commentaires d'un modèle. Pendant la lecture d'un PDF, « Commenter » est grisé aujourd'hui
(`pdf.locked.comment`) : il se dégrise pour un PDF qui a du texte.

**2. Ce que GFS te donne, et ce qu'il ne te donne pas** (déjà écrit : contrats 5.4 point 8, 6.6 ; guide 15). **Une clé, rien d'autre.** `lecture.id` est l'`Identifiant` du PDF chez
GFS : douze signes tirés au hasard à l'import, **jamais changés**, ni quand la personne renomme le fichier, ni quand elle le **remplace** (« Remplacer » devant un nom pris garde la
ligne, donc l'identifiant ; le contenu et la date changent), ni d'un poste à l'autre. Seule « Garder les deux » en donne un autre : c'est un autre fichier, avec ses propres fils
(mesuré le 03/11 dans un vrai Grist : `prototype/labo/run-pdf.mjs`, « même ligne, même identifiant », et `run-lire.mjs`, l'identifiant que ton app reçoit). Il arrive avec
l'ouverture comme avec l'appel `ouvrir`, que tu lis depuis la 040. GFS ne garde aucun commentaire, n'écrit jamais ta table (jamais la table d'une autre app, contrats 3.3 point 3) et
ne te donne ni jeton, ni appel, ni message de plus : **ce que tu gardes sur ce PDF est à toi, accroché à cette clé.**

**3. Ce que ton app fait.**

- **a. Où vivent les fils d'un PDF.** Dans la table que tu as déjà, `Publipostage_Commentaires` : pas de table de plus (le cahier limite les tables), et un fil de PDF est un fil comme
  les autres, des messages d'une personne, à une date, sous un `CommentId`. La ligne d'un message de PDF porte **la clé du PDF** (`lecture.id`, en texte) et **pas de `ModeleId`** (`0`,
  la valeur d'une colonne entière qu'on n'a pas remplie) : la lecture d'un modèle ne lit pas les fils des PDF, la lecture d'un PDF ne lit pas ceux des modèles. Il faut aussi de quoi
  **retrouver le passage** (point b) et **l'état « résolu »** : pour un modèle, ils vivent dans la marque du document ; un PDF n'a pas de document où poser une marque (l'app n'écrit jamais
  ce que GFS garde, contrats 6.6) ; ils vivent donc dans la table, **une seule fois par fil** (sur la ligne de son premier message, pas sur chaque réponse), lus de la même
  façon par toutes les personnes du document. Les noms et les types des colonnes de plus sont les tiens ; à titre d'exemple : la clé en texte, la page en entier, le début et la fin
  en entiers, la citation, un peu de texte avant et après, l'état résolu en booléen.
- **b. L'ancre est du texte, jamais des pixels.** Un fil de PDF s'accroche à **une page et à du texte** : le numéro de la page (celui de `getPage(n)`), les positions de début et de
  fin du passage dans le texte de cette page, le passage lui-même (la citation) et un peu de texte avant et après, pour départager deux passages identiques. Le « texte de la page »
  se calcule **sans le DOM**, par une seule fonction qui sert à écrire l'ancre comme à la retrouver : le texte que donne `getTextContent()` (les `str` des éléments mis bout à bout,
  les fins de ligne, les espaces multiples et insécables réduits à une espace, pour qu'une sélection de la souris et le texte de la page se comparent), parce qu'une page hors de
  l'écran n'a pas de couche de texte (ta lecture n'en garde que quelques-unes dessinées, `KEEP_RENDERED`). La sélection de la personne se convertit en ces positions à partir de la
  couche de texte de pdf.js (sa copie de GFS, 6.5.438, rend `textLayer.textDivs` et `textLayer.textContentItemsStr` : lu dans `prototype/vendor/pdfjs/1.0.0/pdfjs.js`, à toi de le
  mesurer). L'ancre n'a **jamais** de coordonnées d'écran : la marque se redessine chaque fois qu'une page se dessine, après un défilement qui l'avait vidée, un zoom (« Ajuster »,
  Ctrl + molette, `--pp-fit-zoom`), la Lecture épurée.
- **c. Le geste, la marque, le fil.** Comme pour un modèle : « Commenter » (par les mêmes entrées que pour un modèle) sur la sélection faite dans le PDF, la même fenêtre, le même premier
  message, les mêmes réponses, « Résoudre » et « Rouvrir », « Supprimer le fil » avec sa question. **Rien n'est écrit tant que le premier message n'est pas publié** : abandonner la
  fenêtre ne laisse rien derrière. La marque est un surlignage du passage, posé sur la couche de texte (elle suit le zoom et le défilement avec la page), pas sur le canevas, avec
  l'aspect des marques d'un modèle par les mêmes jetons (active, résolue, en clair et en sombre) ; un clic, et le clavier comme pour les marques d'un modèle, ouvre le fil. Les fils
  d'un PDF se lisent à son ouverture et après chaque geste de la personne, à la cadence de ceux d'un modèle (pas de relecture continue). Un fil ne couvre **qu'une page** : une sélection
  qui déborde est coupée à la fin de la page où elle commence, et le coin d'état le dit en une phrase (le choix le plus prudent ; si tu vois mieux, dis-le).
- **d. Ouvrir un PDF n'écrit rien.** La 040 l'a posé (« lire n'écrit rien dans le document ») et cela vaut pour les fils : à l'ouverture, tu ne lis `Publipostage_Commentaires` que si elle
  existe et porte la colonne de la clé ; sinon, aucun fil, **sans question, sans table et sans colonne créée** (la fenêtre « Créer les tables du widget dans ce document ? » n'apparaît
  qu'à la première écriture, comme pour un modèle). Les colonnes de plus arrivent **avec le premier fil publié** : un document neuf crée la table avec toutes ses colonnes (ta liste
  `TABLE_COLUMNS`) ; pour une table d'avant, tu ajoutes **celles qui manquent**, par `AddColumn` seulement (le courtier de GFS refuse `ModifyColumn` et `RenameColumn`, contrats 3.3
  point 2), après avoir relu les colonnes présentes (un `AddColumn` sur un identifiant pris renomme la colonne, `…2`, contrats 6.1 point 3), et **tu n'écris jamais une colonne absente** :
  une seule annule tout le lot (guide 4). Tu l'as déjà fait pour la colonne `Name` de la table-sonde (`readUserName`, `js/grist-api.js`). Quand Grist refuse l'ajout (le document n'autorise
  pas cette personne à changer sa structure, contrats 11.7 point 1), tu le dis avec sa raison, « Commenter » reste grisé pour ce PDF et rien n'est écrit à moitié.
- **e. Grisé, jamais masqué.** Un PDF **sans texte** (un scan : `getTextContent()` ne rend rien sur les pages dessinées) ne se commente pas, la reconnaissance de caractères n'étant pas
  demandée : « Commenter » reste grisé avec **sa propre raison** (on ne sélectionne que du texte), distincte de celle de la lecture seule. Pour le reste, la personne a ce que `canComment`
  (`js/access-rights.js`) lui permet déjà pour un modèle, avec la raison que tu donnes aujourd'hui quand elle ne peut pas écrire dans le document. Seule (adresse sans `gfs=`), aucun PDF ne
  s'ouvre : rien ne change.
- **f. Un PDF renommé, remplacé, supprimé.** *Renommé* : les fils restent, la clé est la même. *Remplacé* (même clé, autre contenu) : le fil retrouve son passage, d'abord là où il
  était (la citation y est toujours), sinon par sa citation, sur la même page puis sur les autres, **page par page et sans bloquer la lecture** (guide 15 : jamais le document d'un
  coup), le passage dont l'entourage ressemble le plus quand plusieurs conviennent. Si le passage n'est plus dans le PDF, le fil est dit **« passage introuvable »** : il reste lisible,
  se résout et se supprime (par une liste des fils du PDF, par exemple), il garde sa citation et la page où il était, et **l'app ne l'efface jamais de son propre chef** : une version
  suivante qui rend le passage le retrouve. *Supprimé* : GFS le fait lui-même, pour toutes les personnes du document (contrats 6.6 point 7), et ne dit rien à ton app, qui n'a aucun
  moyen de le savoir ; ses fils restent dans ta table, sans que personne ne les voie. **N'efface rien de toi-même** : une purge serait un geste de la personne, que le porteur n'a pas
  demandé (point 5).
- **g. Les droits.** Les lignes d'un fil de PDF n'ont pas de `ModeleId`, la colonne par laquelle la classe `derivee` de tes commentaires suit l'étiquette de leur modèle (contrats 11.6
  point 8). Qui lit et qui écrit ces fils est donc une question de plus pour les permissions (contrats 11.7 point 3, à fixer avec toi à l'étape 5) : **d'ici là, n'écris aucune règle
  d'accès et ne déclare aucune `classes` pour elles**, ils sont lus par toute personne qui lit le document et écrits par celles qui peuvent y écrire, comme ceux d'un modèle aujourd'hui.

**4. Ce que GFS fait de son côté.** Rien à déclarer : ni verbe, ni action, ni extension, ni bibliothèque, ni adresse, ni table (la tienne est dans ton préfixe, `lit` et `ecrit` la couvrent
déjà), ni `ACCEPTS_OPEN`. Quand ta page dit « 045 · faite · `<commit>` », GFS rejoue la lecture avec ton app dans un vrai Grist (une fois la 040 faite et déclarée) et y ajoute ce que la clé
promet : un fil sur un PDF lu, puis le PDF renommé, puis remplacé (même `Identifiant`, le fil suit), puis la table d'avant sans les colonnes ; il l'écrit à `docs/apps.md`. **Pour l'essayer
avant** : dans ta copie jetable de GFS (`consignes/TESTER-AVEC-GFS.md`), déclare `actions.lire` et l'extension `lecture-pdf` comme la 040 le demande ; rien d'autre n'est à poser.

**5. Ce que cette consigne ne demande pas.** La **reconnaissance de caractères** d'un scan ; des commentaires sans texte (une zone, une image) et des annotations dessinées sur la page ;
les commentaires **écrits dans le PDF** (GFS garde le fichier tel que la personne l'a mis, ils ne sortent pas dans un export) ; la **purge** des fils d'un PDF supprimé (une question de
produit que le porteur n'a pas posée : pour la poser, GFS devrait dire à l'app quels fichiers existent, ce que le contrat n'a pas) ; des **règles d'accès** (étape 5). Aucun appel, message,
clé de réglages, bibliothèque ni adresse de plus ; aucune table de plus, des colonnes seulement. Le poids de l'extension `lecture-pdf` change avec ce code : ta page donne le nouveau total
(les octets du dossier `extensions/lecture-pdf/`), que GFS reporte dans son manifeste.

## Pourquoi

Le porteur veut lire un PDF dans la Lecture de Publipostage+ pour y retrouver l'interface qu'il connaît, et les commentaires avec elle. GFS ne garde que le fichier (une pièce jointe de son
document) et ne sait rien d'un commentaire ; ton app est la seule à avoir l'interface des fils. Ce qui les relie est une clé qui ne change ni au renommage ni au remplacement (contrats
5.4 point 8) : le fil est à toi, dans ta table, partagé par toutes les personnes du document comme ceux des modèles, et il retrouve son passage quand le PDF change de version. Un fil
ne se perd jamais en silence : un passage qui ne se retrouve plus se dit, il ne s'efface pas.

## Fait quand

`GFS-ETAT.md` donne « 045 · faite · `<commit>` », avec des tests qui échouent sur l'ancien code :

- sélectionner un passage d'un PDF et publier le premier message écrit **une** ligne : la clé du PDF, la page, le passage, l'état, et rien dans `ModeleId` ; une réponse ajoute une ligne
  sans ancre ; résoudre et rouvrir change l'état en une écriture ; supprimer le fil retire toutes ses lignes ; rien n'est écrit avant la publication ni quand la personne abandonne ;
- la marque revient à la même place après qu'une page s'est vidée puis redessinée (défilement), après un zoom et en Lecture épurée ; une sélection qui déborde est coupée à la page ;
- une autre séance qui ouvre le même PDF voit le fil ; les fils d'un autre PDF et ceux des modèles ne se mêlent pas, dans un sens comme dans l'autre ;
- le PDF renommé garde ses fils ; remplacé par une version où le passage a changé de page, le fil suit ; remplacé par une version sans le passage, le fil est dit « passage introuvable »,
  se lit, se résout, se supprime, sa ligne reste, et une version qui rend le passage le retrouve ;
- un PDF sans texte : « Commenter » grisé avec sa raison, rien d'écrit ; la lecture seule garde la sienne ;
- une table d'avant sans les colonnes : ouvrir un PDF n'écrit rien et ne pose aucune question ; le premier fil n'ajoute que les colonnes manquantes, puis écrit ; un refus de Grist (structure
  fermée) est dit avec sa raison, rien n'est écrit, « Commenter » reste grisé pour ce PDF ; un document sans la table la crée avec toutes ses colonnes, après l'accord de la personne ;
- les commentaires des modèles ne changent pas (mêmes lignes, `ModeleId` rempli, colonnes de plus vides) et tes essais d'avant passent ; l'app seule ne change pas ;
- mesuré à 700 × 400, à la vraie souris (la sélection au glisser) et au vrai clavier, en clair et en sombre, en français et en anglais (les deux langues dans le même lot), **et sous
  Firefox**, le navigateur du porteur : la sélection dans la couche de texte de pdf.js et la marque y tombent au même endroit.

Tu écris ensuite, dans « Demandes à GFS », ce que tu as vu qui mérite une réponse (le poids de `lecture-pdf`, ce qu'un fil dit quand le PDF a disparu, ce que la personne attendrait d'un PDF
supprimé).
