# 003 · Ce que GFS tient pour toi : la carte insérée, la couleur, « Mes tâches », « Automatiser… », et ce qui attend le porteur

App : Tuesday · posée le 02/11/2026 · réponse à ta page du 02/11 (demandes 2, 5 et 7) · quand : à lire maintenant ; aucun code ; sans effet
dans l'app seule

## Quoi

**1. La carte insérée dans un document (V2 ; demande 5).** Le déroulement (GFS active l'app qui fournit, la personne y choisit, GFS la
ferme et rend le rendu) et la taille maximale s'écrivent à l'étape 7 (contrats 5.4, point 5 ; 1.4, point 1), pas avant. Ce qui est arrêté
est la forme du **rendu portable** : `{ format: "svg" | "png" | "valeur", donnees, largeur, hauteur, texteAlternatif, source: { app, id,
type, version } }`. L'app qui reçoit garde le rendu **et** `source` ; sans Tuesday, le rendu reste affiché et sa mise à jour est grisée. Elle
traite `donnees` comme une donnée non fiable et ne charge jamais ton code (5.4, point 6). Ta carte sera l'un des trois formats, choisi avec
toi à l'étape 7 ; d'ici là `inserer.produit` reste `[]` et l'entrée est grisée. L'accord de Publipostage+ pour recevoir une carte est le sien
(`inserer.recoit` de son manifeste) : GFS ne le lui demande pas avant l'étape 7.

**2. La couleur du type « Projet » (demande 7).** Neutre : le cahier de GFS (section 12, question 8) dit « neutres tant qu'il ne les demande
pas », et le porteur ne l'a pas demandée. Rien à faire ; le jour où il le demande, GFS te l'écrit.

**3. Le point de départ de « Automatiser… » (V2 ; demande 7).** Aujourd'hui l'ouverture ne porte ni table ni correspondance de colonnes
(`{ app, fichier: { id, type }, raison? }`, contrats 5.4) et Automation+ ne sait pas ouvrir un fichier (son manifeste dit `actions.ouvrir:
[]` : elle n'a pas de table de fichiers). Il manque donc quelque chose des deux côtés. La forme du point de départ s'écrit quand tu arrives à
ta V2, par une consigne à chacun des deux projets ; pas avant, la question n'est pas encore utile. D'ici là l'entrée « Automatiser… » est
grisée avec sa raison, et tu ne passes jamais ce point de départ en écrivant dans une table d'Automation+ (le courtier le refuse, 3.3).

**4. Reconnaître la personne pour « Mes tâches » (demande 7).** Garde le défaut de ton cahier (question 6) : la personne se choisit une fois
dans la liste de tes responsables, et tu le retiens dans le stockage de GFS (`GfsLink.storageSet`, contrats 5.3). Il vaut par navigateur et
reste un confort : sans lui, l'app marche et redemande. Aucune identité ne passe dans le `contexte` aujourd'hui ; l'adresse de la personne
vient d'une table-sonde (contrats 11.6, point 5 ; celle de GFS est dans `GFS_Rangement`), que ni GFS ni le kit n'offrent à une app. Si tu
veux la reconnaître d'office un jour, mets-le dans ta section « Demandes à GFS ».

**5. Ce qui attend le porteur** (deux cartes posées le 02/11). (a) Construire maintenant les deux appels des liens entre apps (`choisir` et
`ouvrir`, dans le courtier de GFS et le kit) ou attendre que Tuesday entre dans GFS. (b) Le calendrier : un module du kit que Tuesday et
Calendar+ montent chacun chez eux (voie A), ou Calendar+ ouvert par GFS à la place de Tuesday, qui se ferme pour lui laisser le cadre
(voie B). Une app n'importe jamais le code d'une autre : ce sont les deux voies de ton `integration-suite.md`. GFS te répond par une
consigne dès qu'il a choisi ; ton calendrier reste comme il est d'ici là.

## Pourquoi

Ces points ne se règlent ni par un contrat déjà écrit ni par une décision du porteur : GFS dit ici ce qu'il tient par défaut (la couleur
neutre, ton choix une fois) et ce qu'il laisse à plus tard (la carte, le point de départ), pour que tu écrives ta V1 sans attendre. Les deux
choix qui changent l'architecture sont au porteur.

## Fait quand

`GFS-ETAT.md` donne « 003 · lue ». Aucun code n'est demandé.
