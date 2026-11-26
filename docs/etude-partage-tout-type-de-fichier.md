# Partager tout type de fichier entre deux documents Grist (étude du 25/11, rien n'est codé)

Demande du porteur (25/11) : « pour l'alpha je veux que l'on puisse faire tout type de document (et gérer les enjeux d'édition multiple de PP) ».
Aujourd'hui « Partager > Dans un autre document Grist » dit « seulement les PDF que GFS garde » pour tout fichier d'une app (contrats 6.6, point 17).
Cette étude dit ce que le moteur de partage (celui de Sync+, dans le kit) permet pour une app, ce qui a été mesuré dans un vrai Grist, les façons de faire, et
ce que chacune coûte à l'édition à plusieurs. **Les cartes de décision attendent la réponse du porteur avant tout code.**

## Ce qui se passe aujourd'hui, par défaut

- **Relier deux documents ne copie rien.** « Relier un document… » ne nomme que l'identifiant fictif `gfs-aucun` : le lien existe, rien ne part. Chaque fichier ou
  dossier se partage ensuite à part (« Une copie, une fois » ou « Copie à jour »).
- Ce qui part arrive **grisé, « à accepter »**, dans « Partagés avec moi » ; refuser masque sans effacer ; le fichier retiré chez l'envoyeur reste chez l'autre.
- Seuls les PDF de `GFS_Fichiers` partent : un fichier d'app (un modèle de Publipostage+) est **une ligne de la table de l'app**, pas une ligne de `GFS_Fichiers`.

## Ce que le moteur permet pour une table d'app (lu dans le kit 0.31.0, moteur 5.1.0, puis mesuré)

| Sujet | Ce que dit le moteur |
|---|---|
| Quelles tables, quelles colonnes | n'importe quelle table, **colonnes cochées une à une** (le mot de passe PDF d'un modèle reste chez l'envoyeur : mesuré), lignes choisies par une condition |
| Pièces jointes | une colonne « Pièces jointes » voyage avec la ligne (mesuré : 50 Ko), 25 Mo par fichier au plus |
| Sens | un sens (l'autre document est passif) ; **deux sens (« Échange »)** : par ligne, **la version la plus récente gagne** (`MajLe`), l'autre est perdue ; le document qui invite peut demander « à valider » pour certains changements |
| Ce que le moteur écrit **dans la table de l'app** | trois colonnes d'aide (`id_sync`, `MajLe`, `RecalculLe`), mesuré ; la table ne peut plus être renommée tant que le lien dure (faits 160) |
| Chez celui qui reçoit | une table **à part** (`GFS_Recus…`) : GFS ne reçoit jamais dans la table d'une app, et Publipostage+ ne lit pas cette table |
| Retouche chez celui qui reçoit | elle tient jusqu'à la prochaine modification **de cette ligne** chez l'envoyeur, puis elle est écrasée sans question (mesuré) |
| Ligne supprimée chez l'envoyeur | reste chez l'autre, marquée « supprimée à la source » (réception en archive : mesuré) |

## Mesures dans un vrai Grist 1.7.19 (banc `gfs/etudes/partage-tout-type-2026-11-25/` dans les fichiers du projet ; GFS `6e16cc4`, kit `4774a99`)

Une table aux 19 colonnes de `Publipostage_Templates`, un modèle par ligne, envoyée par le moteur de GFS d'un document à un autre.

1. **Une ligne de plus de 0,9 Mo n'arrive jamais, et personne ne le dit.** 0,25 Mo et 0,5 Mo arrivent à l'octet près ; **1, 1,5, 2 et 3 Mo n'arrivent pas** (rien après une minute ; les modèles de 3 et 9 Mo du premier essai, rien après cinq minutes).
   Cause lue dans le moteur : Grist refuse un envoi de plus de 1 Mo (`POST_MAX` 950 000 octets) ; une ligne plus grosse est notée « trop grosse » et n'est jamais envoyée.
   Chez l'envoyeur le webhook répond « succès » et le moteur dit « rien à envoyer » : **GFS afficherait « Copie à jour »** (il lit l'état du webhook, pas la note « trop grosse »).
   L'API REST de Grist refuse d'ailleurs d'écrire un modèle de 3 Mo (« request entity too large ») : seul le canal du widget (celui de Publipostage+) l'écrit.
   Pour mémoire (faits 161) : les documents de Publipostage+ pèsent environ 90 Ko, **les présentations environ 3 Mo**.
2. **Chaque enregistrement coûte cher.** Huit enregistrements d'un modèle de 0,5 Mo : le document de l'envoyeur passe de 30,6 à 50,7 Mo (**≈ 2,5 Mo par enregistrement**),
   celui du receveur de 16,1 à 55,2 Mo (**≈ 5 Mo par enregistrement**) : chaque version est gardée plusieurs fois (historique de Grist, journal du moteur ; la part de chacun n'est pas isolée).
   Publipostage+ enregistre seul pendant qu'on écrit : un modèle partagé « à jour » ligne par ligne grossirait les deux documents à chaque pause de la frappe.
3. **Porté comme un PDF (une ligne légère et le contenu en pièce jointe), tout passe.** Un contenu de 3 Mo arrive avec les mêmes octets ; **un contenu remplacé chez
   l'envoyeur arrive chez l'autre** (en quelques secondes dans l'essai). Prix : après cinq remplacements d'un contenu de 3 Mo, l'envoyeur pèse 18,5 Mo (les anciennes pièces jointes restent : 6 sur 6)
   et le receveur **90,5 Mo** (≈ 15 Mo par version : le moteur découpe le fichier en morceaux de texte dans le journal avant de le recopier). Le moteur sait effacer l'historique de son journal
   (`cleanJournal`, 4.1.0) ; GFS n'a pas encore le bouton.
4. **« Dupliquer » de GFS recopie `id_sync`** (et `MajLe`) quand la table de l'app est celle que le moteur suit : deux lignes de même clé de synchro. Il faudrait que la recette de copie
   écarte les colonnes du moteur.
5. **Le lien entre deux modèles n'est qu'un texte** : un document dont `LinkedEmail` nomme le jeton d'un e-mail arrive avec ce jeton (mesuré), mais l'e-mail ne vient que si on le partage aussi.

Pas mesuré : Firefox, la DINUM, le modèle réel d'un client (images), deux sens, la durée de vie des anciennes pièces jointes (nettoyage de Grist).

## Ce qu'est un « fichier » de Publipostage+ pour le partage

Une ligne de 19 colonnes : le contenu (texte ou page HTML ; les images y sont en `data:` ou liées à une pièce jointe du document d'origine, et celles-là ne voyagent pas avec la ligne : à vérifier sur un vrai modèle), la mise en page, le type (document, grille, présentation, e-mail, macro), les destinataires et l'objet
d'un e-mail, une colonne de pièces jointes, le jeton d'identité, l'e-mail lié (par son jeton), le mot de passe PDF. **Ce qui ne doit jamais partir** : le mot de passe PDF (déjà nommé comme secret
dans l'exemple de contrats 11.2), les colonnes de visibilité (qui peut voir : `Visibilite`, `Personnes`, `Espace`). **Ce qui ne part pas avec la ligne** : les versions, les
commentaires, les liens avec les tables de la page, le rangement et l'étoile de chaque personne, **les tables de données que le modèle cite** (les champs de fusion trouveront ou non leurs
colonnes dans l'autre document). La recette de copie de Publipostage+ (`copie.ligne`, jeton vidé, « par défaut » retiré) est déjà ce qu'il faut pour installer un modèle reçu.

## Les façons de faire

**A. Brancher le lien sur la table de l'app** (le moteur envoie les lignes). Rejetée par les mesures : plafond d'environ 0,9 Mo par modèle, silencieux ; 5 à 10 fois le contenu à chaque
enregistrement ; colonnes ajoutées dans la table de l'app ; renommage de la table bloqué (en conflit avec la bascule anglaise de Publipostage+) ; l'identité d'un modèle (numéro de
ligne réutilisé, jeton parfois vide) ne tient pas comme condition.

**B. Porter le modèle comme un PDF** (recommandée). Au partage, GFS relit la ligne, en fait un **paquet** (ses colonnes de données, moins les secrets et la visibilité, avec l'app, le type et
la date de la version) gardé en pièce jointe d'une ligne d'envoi légère, que le moteur et tout ce qui existe déjà portent (accepter, refuser, dossiers, archive, limite de 25 Mo, droits).
Rien n'est ajouté à la table de l'app ni à son nom. À l'arrivée, « Accepter » **ajoute le modèle aux modèles de l'app** par la même écriture que « Dupliquer » (nom libre, jeton vide,
pas « par défaut »), rangé dans le dossier choisi ; Publipostage+ n'a rien à changer. Un type dont l'app n'a pas dit comment le copier reste **grisé avec sa raison**, comme le veut la charte (aujourd'hui Grist-BI n'a pas de recette ; Form+ copie par un appel à l'app
ouverte, il faudra donc que l'app sache produire et installer un paquet). Coût : un paquet par version, à envoyer par geste (voir plus bas).

**C. Les deux sens** (« Échange » du moteur) : le plus récent gagne par ligne, donc une des deux retouches disparaît ; impossible aussi pour un modèle de plus de 0,9 Mo (point 1). Pas pour l'alpha.

## L'édition à plusieurs, cas par cas

| Cas | Ce qui se passe avec B |
|---|---|
| Deux personnes du **même** document écrivent le même modèle | rien ne change : l'écriture en direct de Publipostage+ (une table du document, relue toutes les 250 ms) reste à l'app |
| Un modèle partagé, **chaque document le retouche** | deux modèles indépendants, jamais d'écrasement : l'autre fait ce qu'il veut de sa copie |
| L'envoyeur améliore son modèle | rien n'arrive tout seul : un geste **« Envoyer la nouvelle version »** (jamais à chaque enregistrement : voir mesure 2) ; l'autre voit une pastille « nouvelle version » |
| L'autre a retouché sa copie et reçoit la nouvelle version | une question, avec les mots de « Ce nom est déjà pris » : **Remplacer ma copie / Garder les deux / Ignorer** ; jamais d'écrasement silencieux |
| Écriture en direct **entre deux documents** | impossible sans relais : il n'y a pas de table commune à relire ; hors périmètre |

## Lots si « B » est choisie (chacun attend son go, un push à la fois)

1. **Envoyer un modèle** : l'onglet « Dans un autre document Grist » dégrisé pour tout fichier dont l'app a une recette de copie ; le paquet ; essai dans un vrai Grist (document sans PDF compris).
2. **Recevoir et accepter** : l'arrivée « à accepter » avec l'icône de son type ; « Accepter » ajoute le modèle à l'app (grisé avec sa raison si l'app ou son extension manque).
3. **Nouvelle version** : « Envoyer la nouvelle version », la pastille, la question « Remplacer / Garder les deux / Ignorer », le bouton qui efface l'historique du journal.
4. **Les types suivants** : Grist-BI (consigne : déclarer sa recette de copie), puis Form+ (copie par appel) ; Automation+ quand le porteur le veut.

À poser plus tard, une carte chacune, si besoin : emporter aussi l'e-mail lié ; envoyer les tables du modèle vides (comme la galerie, « Créer avec ses tables ») ; un modèle reçu qui reste lisible sans être ajouté.

## Complément du 26/11 : l'écriture en direct entre deux documents (« un même document dans deux Grist se comporte comme dans le même Grist »)

Le porteur (26/11) veut, dans un monde idéal : (1) un message « modifié, rechargez » quand l'autre document change le modèle, comme dans un même Grist ; (2) les changements visibles à l'ouverture suivante quand une
seule personne édite à la fois ; (3) l'écriture collaborative en direct, même avec un délai plus gros. Et que **seuls les éléments modifiés voyagent**, jamais tout le modèle à chaque retouche.

**Ce qui existe déjà : Publipostage+ écrit en direct par morceaux.** Son extension d'écriture en direct (`extensions/edition/live-sync.js`, lue le 26/11) tient le texte du modèle dans un document Yjs et l'échange par les lignes
d'**une table du document** (`Publipostage_Direct`, six colonnes) : « u » un paquet de frappes (quelques dizaines d'octets), **ajouté puis jamais modifié** ; « s » l'instantané du modèle (une ligne, remplacée à la compaction,
toutes les 60 lignes) ; « p » la présence (nom, couleur, curseur : une ligne par personne, **modifiée sur place toutes les 0,4 s**) ; « d » « enregistré ». Une mise à jour reçue deux fois ou dans le désordre ne change rien (propriété de Yjs).
C'est donc déjà la solution au « seulement ce qui a changé » : il manque le **relais d'un document à l'autre**.

**Mesure 4, dans un vrai Grist 1.7.19** (banc `mesure-4-salon-relais.log` ; table à l'image de `Publipostage_Direct`, lien à un sens du moteur de GFS, filtre `Kind` dans « u » et « s », réception en archive) :

1. **Le délai** : un paquet écrit chez l'envoyeur est lu chez l'autre en **2,5 s au mieux, 6,9 s en médiane, 11,4 s au pire** (12 paquets ; le receveur passe toutes les 10 s tant que des lignes arrivent). C'est le « délai un peu plus gros » du porteur.
2. **Le poids** : 300 paquets de 60 à 80 signes (deux personnes qui tapent, environ 3 paquets par seconde pendant 100 s) : l'envoyeur passe de 1,3 à 2,2 Mo (**≈ 2,9 Ko par paquet**), le receveur de 2,7 à 4,8 Mo (**≈ 7,2 Ko par paquet**). Un paquet pèse donc 40 à 100 fois son contenu :
   une heure de frappe à ce rythme ferait environ 30 Mo chez l'envoyeur et 75 Mo chez le receveur. **Le relais doit donc grouper les frappes** (un paquet toutes les deux à cinq secondes, pas toutes les 0,4 s) et le journal du moteur doit pouvoir s'effacer (`cleanJournal`).
3. **La compaction ne perd rien** : l'instantané remplacé (85 Ko) arrive en 5 s ; les 60 paquets supprimés chez l'envoyeur **restent chez le receveur, marqués « supprimée à la source », et lisibles** (60 sur 60). Chaque côté compacte donc seul : la suppression n'a pas à voyager.
4. **La présence reste chez l'envoyeur** : un filtre sur « Kind » ne laisse partir ni « p » ni « d » (la présence d'un autre document n'est pas voulue : trop coûteuse, 0,4 s).

**Mesure avec Yjs seul (26/11)** : 20 000 signes tapés par paquets de six signes = 3 199 paquets de 44 octets en médiane (56 au plus), 135 Ko au total, et un instantané de 85 Ko : l'ordre de grandeur de ce qui voyagerait.

**Ce qu'il faudrait pour que ce relais fasse un même modèle des deux côtés** (rien n'est codé) :
- **Publipostage+** : le « salon » d'un modèle est repéré par le numéro de ligne du modèle (`Doc`), qui **diffère d'un document à l'autre** : il faut une identité commune (le jeton du lien) ; lire aussi les paquets reçus d'un autre document (GFS n'écrit jamais dans la table de l'app) ; un repli propre quand le relais est coupé. Consigne à poser, après accord.
- **GFS** : un lien dans chaque sens par modèle partagé en direct (aujourd'hui un seul sens ; l'« Échange » du moteur n'est pas nécessaire et pas mesuré), le filtre sur « Kind », la limite de débit, le bouton d'effacement du journal, un message clair « l'autre document n'est pas à jour » (le moteur dit « Copie à jour » même quand il n'a rien envoyé : mesure 1).
- **L'édition classique (hors direct) ne produit pas de paquets** : elle enregistre tout le modèle. Pour les niveaux 1 et 2 sans le direct, il faut donc envoyer le modèle **entier mais une fois par séance** (à la fermeture ou après quelques minutes sans frappe), pas à chaque enregistrement : un message « modifié, rechargez » à l'autre document. Publipostage+ devrait dire à GFS « ce modèle vient d'être modifié ».

**Pas mesuré** : les deux sens ensemble, une vraie frappe de deux personnes à travers le relais (Yjs rejoue les paquets, il ne devrait rien perdre : lu, pas vu), Firefox, la DINUM (webhook entre deux documents de l'instance), la durée de vie de l'historique de Grist.

*Les noms de tables de ces essais (`GFS_Fichiers`, `GFS_Recus`) sont ceux d'avant le passage de GFS à l'anglais (faits vérifiés 181).*
