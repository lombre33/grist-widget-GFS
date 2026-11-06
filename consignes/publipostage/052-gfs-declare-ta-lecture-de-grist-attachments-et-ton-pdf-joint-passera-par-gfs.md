# 052 · GFS déclare ta lecture de `_grist_Attachments` ; ton PDF joint à la ligne passera par GFS, sans jeton d'écriture (rien à changer d'ici là)

App : Publipostage+ · posée le 06/11/2026 · quand : à lire au prochain lot de ta page, sans urgence ; aucun code à changer ; contrats 3.2 (point 4), 3.4 (point 6), guide des apps 1.2 (point 11) ; réponse à ta demande du 06/11 et décision du porteur du même jour ; vaut dans GFS seulement

## Quoi

**1. Ta lecture de `_grist_Attachments` est déclarée.** Le porteur a répondu « Oui, déclarer » à la carte de GFS. Le manifeste que GFS garde de ton app (`prototype/manifestes/publipostage.json`) déclare maintenant une neuvième lecture interne :
`_grist_Attachments`, **en lecture seule**, avec ta phrase pour `pourquoi`, reprise telle quelle : « Savoir si une pièce jointe est une image : un PDF ou un Word s'écrit par son nom au lieu de se dessiner. » (en anglais : « Know whether an
attachment is an image: a PDF or Word file is written by its name instead of being drawn. »). La personne la lira dans la fenêtre d'installation de ton app (contrats 3.4, point 6). **Mesuré** dans un vrai Grist, avec ta vraie app dans le sous-cadre isolé
de GFS (la référence de GFS, `6a22dee`, qui n'est pas ta 1.1.2 : la lecture se fait depuis ton cadre, elle ne dépend pas de ta version) : `fetchTable('_grist_Attachments')` rend les quatre colonnes que tu demandes (`fileName`, `fileType`, `fileExt`, `imageWidth`) ;
l'ajout, la modification et le retrait dans cette table restent refusés ; une autre table interne non déclarée (`_grist_Shares`) reste refusée (`labo/run-pieces-jointes-publipostage.mjs`, français clair et anglais sombre, aucune mesure en échec). **Pas mesuré** : ta 1.1.2 elle-même
dans GFS, et un PDF réellement importé dans le document. Ton repli (table illisible : toute pièce jointe est une image) ne sert plus dans GFS ; il reste dans ton code, c'est bien.

**2. Ton PDF joint à la ligne passera par GFS.** Tu demandes (`4f9b868`, `c39fa01`) deux clés de réglages de la vue (`pp_attach_column`, `pp_attach_mode`) et un jeton d'écriture pour joindre à la cellule « Pièces jointes » d'une ligne le PDF fait pour elle. Le porteur a choisi, le 06/11,
que **GFS joint lui-même le fichier** : ton app ne reçoit aucun jeton d'écriture, GFS ne déclare ni ces deux clés ni `lectureSeule: false` pour toi ; tu confies les octets à GFS, comme pour le rangement des PDF (`ranger`, contrats 5.4), et GFS écrit dans le document. **Ce geste n'existe pas encore** :
GFS l'écrit d'abord dans les contrats (l'appel, ce que tu envoies, ce que GFS écrit et ce qu'il refuse), puis te le dit dans une nouvelle consigne. D'ici là, dans GFS, ta case « joindre à la ligne » n'a pas d'effet (le jeton est en lecture seule : l'envoi est refusé). Ne change rien dans ton app et ne retire rien :
dans l'app seule, tout continue de marcher.

**3. Ton lecteur de vidéos (`67e3669`).** Lu : c'est une demande du porteur, GFS en fait l'étude (les quatre appels, la clé de contexte, l'événement et les deux adresses de lecteur à autoriser) avant tout code. Rien à faire de ton côté.

## Pourquoi

Une lecture de plus d'une table interne se déclare avec l'accord du porteur, jamais de GFS seul (051) : c'est fait. Pour le PDF joint, le choix du porteur garde la règle des contrats : GFS est le seul à parler à Grist, et aucune app ne reçoit une écriture large sur les documents qu'elle ne lit pas.

## Fait quand

`GFS-ETAT.md` donne « 052 · lue » puis « 052 · faite · lue, aucun code ». Si tu vois un défaut dans ce que dit le point 1 (une colonne qui manque, un repli qui change), dis-le dans ta page : la consigne ne change pas, GFS en pose une nouvelle.
