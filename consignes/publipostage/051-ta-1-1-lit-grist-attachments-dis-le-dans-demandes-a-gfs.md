# 051 · Ta 1.1 lit `_grist_Attachments` : dis-le dans « Demandes à GFS » ; dans GFS elle est refusée tant que le manifeste ne la déclare pas (aucun code à changer)

App : Publipostage+ · posée le 06/11/2026 · quand : au prochain lot de ta page, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS a lu.** Ta page d'état dit le commit `33a8737` (le 04/11) et « consignes lues jusqu'à la 050 » : bravo, tout est lu. Le sommet de ton dépôt est `7c98c9a` (1.0.0, puis 1.1.0 à 1.1.2, du 04 au 06/11). GFS a parcouru ce
journal pour ce qu'il suit : tables, colonnes, clés de réglages, verbes d'actions, adresses, bibliothèques, messages, stockage. **Un seul changement touche le contrat** : depuis `1de0bc1` (05/11, « Une pièce jointe qui n'est pas
une image est remplacée par un message qui dit son nom »), `GristAPI.getAttachmentInfos` (`js/grist-api.js`) lit la table interne **`_grist_Attachments`** (`readTable`, colonnes `fileName`, `fileType`, `fileExt` et
`imageWidth`) pour savoir si une pièce jointe est une image. Recherché dans le diff de `js/`, `extensions/` et `index.html` : pas de table `Publipostage_*` de plus, pas de clé `pp_*`, pas de stockage du navigateur, pas
de verbe d'écriture ni d'appel `grist.*` de plus, pas d'adresse, de bibliothèque ni de message à GFS de plus ; les règles de mise en forme conditionnelle (`rules` et `widgetOptions` de `_grist_Tables_column`, colonnes
d'aide `gristHelper_…` des tables) passent par des lectures que le manifeste de GFS déclare déjà.

**2. Ce que ça donne dans GFS.** Le manifeste que GFS garde de ton app (`prototype/manifestes/publipostage.json`) déclare huit lectures internes : `_grist_Tables`, `_grist_Tables_column`, `_grist_Pages`, `_grist_Views`,
`_grist_Views_section`, `_grist_Views_section_field`, `_grist_Filters` et `_grist_DocInfo`. Le courtier refuse toute autre table `_grist_*` (contrats 3.2, point 4). Rejoué avec le filtre de GFS et ce manifeste :
`_grist_Attachments` → « Lecture de _grist_Attachments non déclarée (permissions.gristInterne). ». Ton repli tient, d'après ton commentaire (table illisible : la liste est vide, **toute pièce jointe est tenue pour une image**,
comme avant ta 1.1) : rien ne casse, mais dans GFS un PDF ou un Word dans une image liée à une colonne Pièces jointes se dessinerait encore comme une image, au lieu de son nom. **Pas mesuré** : ta 1.1.2 dans un vrai Grist, dans
le cadre isolé de GFS ; ce qui est dit ici vient du filtre de GFS et de ton code.

**3. Ce que tu fais.** Aucun code. Ajoute à « Demandes à GFS » de ta page une entrée « lire `_grist_Attachments` » : les quatre colonnes lues, la fonction (`getAttachmentInfos`, `js/grist-api.js`), pourquoi en une phrase (savoir si une
pièce jointe est une image), le commit (`1de0bc1`) et ton repli. Mets aussi ta page à jour : « Changements qui touchent GFS » doit dire ce que ta 1.0.0 et ta 1.1.x changent pour GFS (le guide, 1.2 point 11) ; s'il n'y a que cette
lecture, écris-le (« rien d'autre »). **GFS ne déclare pas cette lecture de lui-même** : c'est un accès de plus à une table interne de Grist, que la personne voit dans la fenêtre d'installation de l'app (contrats 3.4, point 6).
Dès que ta demande est lue, GFS la propose au porteur sur une carte, avec ce que la table montre (le nom, le type et la taille de chaque pièce jointe du document), et déclare la lecture s'il dit oui.

## Pourquoi

Le contrat dit que tu le dis, dans le même envoi que le changement (guide, 1.2 point 11) ; GFS le lit aussi dans ton journal, mais il ne se fie pas à sa seule lecture pour élargir ce qu'une app lit dans le document. Sans cette entrée,
dans GFS, ta Lecture et tes exports traitent une pièce jointe qui n'est pas une image comme une image, sans que personne ne sache pourquoi : l'avertissement n'est que dans la console (`[GristAPI] getAttachmentInfos: _grist_Attachments illisible`).

## Fait quand

`GFS-ETAT.md` donne « 051 · lue » et l'entrée « lire `_grist_Attachments` » dans « Demandes à GFS » (aucun code), puis « 051 · faite · lue, aucun code ». Si tu préfères ne pas lire cette table dans GFS, dis-le : la bulle d'image garde alors
son repli (toute pièce jointe est une image) et GFS ne déclare rien.
