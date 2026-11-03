# 043 · Ranger tes exports PDF dans GFS : tu donnes le fichier, GFS le garde et pose la question du nom pris (demande du porteur)

App : Publipostage+ · posée le 03/11/2026 · demande du porteur du 03/11 (« que des exports de Publipostage+ en PDF aillent directement se ranger parmi les fichiers, avec le choix
d'écraser l'existant ou d'avoir une copie avec un (1) derrière le nom ») · quand : au prochain lot, sans urgence ; du code dans ton app (`js/gfs-link.js` : l'appel `ranger`
et le `code` des erreurs ; un choix de destination dans ton menu d'export ; `js/main.js` et `js/pdf-export.js` : là où l'export sort) ; sans effet dans l'app seule (l'option est
grisée) ; GFS déclare `actions.ranger` dans ton manifeste quand ta page dit « 043 · faite »

## Quoi

**1. La demande.** Le porteur, dans GFS : « que des exports de Publipostage+ en PDF aillent directement se ranger parmi les fichiers (prévoir l'UI pour que ça se fasse, et que
l'on puisse choisir d'écraser l'existant ou d'avoir une copie avec un (1) derrière le nom) ». GFS garde les PDF dans son explorateur (« Nouveau > Importer > PDF » ; « Lire », consigne 040) : un export de ton app peut
y arriver au lieu de, ou en plus de, passer par le dossier des téléchargements. **Tu donnes le fichier à GFS ; GFS le garde et pose lui-même à la personne la question du nom
pris.** Tu n'écris rien dans le document, tu ne reçois aucun jeton, tu ne refais pas la fenêtre.

**2. Ce que GFS a livré** (contrats 2.7 point 6, 5.4 point 9, 6.6 ; kit 0.7.0 ; `prototype/labo/run-ranger-pdf.mjs`).

- **L'appel `ranger`**, comme `installer` (même enveloppe : `{ gfs: 0, type: 'appel', id, nom: 'ranger', args }`), un fichier par appel, sans délai (la personne répond quand elle veut) :

```
ranger { fichier: <File ou Blob>, nom: 'Facture Martin.pdf',
         type?: 'pdf', lot?: 'contacts-1730651000', suivants?: 11, dossier?: … }
  →  { statut: 'ajoute' | 'remplace' | 'copie' | 'ignore', id, nom }
```

  `fichier` : le PDF que tu viens de fabriquer (un `Blob` ou un `File` : les octets passent dans le message). `nom` : 1 à 200 signes, GFS ajoute `.pdf` s'il manque.
  `type` : `pdf`, le seul que GFS garde (c'est aussi la valeur par défaut). `lot` : un texte de 1 à 64 signes qui nomme **cet export** ; `suivants` : combien de fichiers tu
  rangeras encore après celui-ci (0 pour le dernier). `dossier` : voir le point 5, ne le donne pas. Une forme hors de ces règles est refusée avant que rien ne s'écrive.
- **La réponse.** `ajoute` : un nouveau fichier. `remplace` : le fichier de ce nom a pris le contenu (même `id`, même place, mêmes favoris). `copie` : le nom était pris et la personne
  a gardé les deux, `nom` est celui de la copie (« Facture Martin (1).pdf » : GFS numérote à partir de **(1)**). `ignore` : la personne n'en veut pas (`id` et `nom` sont `null`) :
  ce n'est pas une erreur. `id` est l'identifiant du fichier chez GFS (la colonne `Identifiant` de `GFS_Fichiers`) : la clé où tu pourras accrocher, plus tard, ce que tu gardes
  d'un PDF (les commentaires, lot suivant).
- **Ce que la personne voit.** Si le nom est pris : la fenêtre « Ce nom est déjà pris » de GFS, qui **nomme ton app** (« Publipostage+ range un fichier dans GFS, mais GFS garde
  déjà un fichier « Facture Martin.pdf ». Que faire du nouveau ? »), décrit le fichier gardé, et offre **Garder les deux** (le clavier y est : un Entrée distrait n'écrase rien),
  **Remplacer** et **Annuler** (le nouveau n'est pas rangé). Échap et un clic à côté valent Annuler. Pour un export de plusieurs fichiers, la case **« Faire pareil pour les
  suivants »** y est offerte tant qu'il en reste : la personne répond une fois pour tout l'export. **GFS ne dit rien par-dessus ton app** (pas de phrase, pas de notice) : c'est
  toi qui rends compte, dans ton coin d'état.
- **Les erreurs** arrivent avec leur `code` et une phrase que GFS écrit dans la langue de la personne (tu peux la reprendre ou écrire la tienne) : `GFS_ANNULE` (la personne a
  refusé de créer la table `GFS_Fichiers`, qu'un premier PDF demande ; **les fichiers suivants du même export sont refusés de même, sans nouvelle question** : arrête d'appeler),
  `GFS_ECHEC` (le serveur Grist a refusé le fichier, « trop gros pour lui », ou n'a pas répondu ; le fichier suivant peut réussir), `GFS_LECTURE_SEULE` et `GFS_ACCES` (le document
  ne se laisse pas écrire), `GFS_REFUSE` (une demande hors règle, un fichier vide ou qui n'est pas un PDF ; ou **ton manifeste ne déclare pas encore `actions.ranger`** : la phrase
  le dit), `GFS_INACTIF` (ton app n'est plus l'app active : un autre fichier a pris sa place), `GFS_INCONNU` (un GFS plus ancien, qui ne sait pas ranger).
- **Un seul fichier à la fois.** GFS prend les dépôts l'un après l'autre (une seule fenêtre à la fois) ; **attends la réponse avant d'envoyer le suivant** : chaque appel copie les
  octets dans le message, cinq cents appels lancés ensemble copieraient tout le lot en mémoire.

**Mesuré** dans un vrai Grist (serveur 1.7.19 en Docker, 700 × 400, à la vraie souris et au vrai clavier, en français clair et en anglais sombre, 62 vérifications dans chacun) avec
une app d'essai qui appelle `ranger` comme tu le feras, puis avec le vrai client du kit : le `File` fabriqué dans un cadre sans `allow-same-origin` est celui que Grist garde,
octet pour octet ; Remplacer, Garder les deux, Annuler, Échap et un clic à côté rendent `remplace`, `copie` (« (1) »), `ignore` ; la case des suivants règle un lot de cinq fichiers
dont trois noms sont pris en une seule fenêtre, au clavier comme à la souris ; la table refusée refuse tout l'export sans seconde question ; un contenu qui n'est pas un PDF, un
fichier vide et un type non déclaré sont refusés avec leur raison ; un serveur qui refuse (413) ou un réseau coupé rendent `GFS_ECHEC` et le dépôt suivant réussit.

**3. Ce que GFS te demande.**

- **a. `js/gfs-link.js`.** Une fonction `ranger({ fichier, nom, lot, suivants })`, sur le modèle de `install` : `if (!hosted) return Promise.reject(new Error('GFS absent'))`, puis
  `call('ranger', args)` **sans délai** (le troisième argument de `call` reste vide : la personne répond quand elle veut), et la réponse lue en `{ statut, id, nom }` (`statut` texte,
  `id` en texte ou `null`, `nom` en texte ou `null`). **Ton `onMessage` rejette aujourd'hui `new Error(message)` sans le `code`** : pour `ranger` il le faut, car ta réaction dépend du
  code (`GFS_ANNULE` arrête l'export, `GFS_ECHEC` non) : `Object.assign(new Error(...), { code })`, comme le fait le kit. Le kit 0.7.0 a le même appel, `GfsLink.deposit`, testé
  contre le vrai GFS : prends-le comme modèle, **sans importer le kit dans ton lien** (deux liens dans un cadre numérotent chacun leurs appels depuis 1 et se prendraient les réponses :
  CHANGELOG du kit, 0.6.0).
- **b. Le choix de la destination.** Dans ton menu d'export des PDF, la personne choisit où va l'export : **Télécharger** (ce qu'elle connaît), **Ranger dans GFS**, ou **Les deux**.
  Le choix se garde par `GfsLink.storageSet` (chez GFS ; le navigateur seule). Le porteur n'a pas dit lequel est le défaut : GFS prend le plus prudent, **Télécharger** tant que la
  personne n'a rien choisi (une consigne suivante le changera si le porteur le demande). Seule (adresse sans `gfs=`), « Ranger dans GFS » est **grisé, jamais masqué**, et un clic
  explique comment passer à GFS : le texte commun du guide des apps (section 5) : changer l'adresse du widget dans le panneau de droite de Grist, jamais par la galerie. Les textes
  sont en français et en anglais dans le même lot.
- **c. Là où l'export sort.** Aujourd'hui chaque export se termine par un téléchargement ; la destination décide de ce qui part en plus ou à la place, **par PDF** :
  - **un PDF seul** (`PdfExport.exportCurrentRecord`, y compris « PDF protégé ») : un `ranger` avec le blob du document (`rendered.blob()`), nommé comme son téléchargement ;
  - **le PDF fusionné** et **l'assemblage avant impression** (`finishBatchExport`, `outBlob`) : un `ranger`, nommé comme le fichier téléchargé (`<table>-export.pdf`,
    `<table>-assemblage.pdf`) ; refaire le même export demain est exactement le cas « nom pris » du porteur ;
  - **l'archive ZIP de PDF** (`openBatchSink`, branche ZIP) : GFS ne garde pas d'archives, **il garde des PDF** : « Ranger dans GFS » range **chaque PDF de l'export**, un `ranger`
    par document, avec le nom qu'aurait son entrée dans l'archive (`uniqueZipFilename` : les doublons d'un même export gardent ta numérotation « (2) », ce sont tes noms ;
    un nom déjà gardé par un export précédent est l'affaire de GFS) ; tous portent le même `lot`, **un nouveau à chaque export** (par exemple `<table>-<horodatage>`, 64 signes
    au plus), et `suivants` décroît jusqu'à 0. Avec « Les deux », l'archive part aussi, comme avant ;
  - **les autres formats** (Word, Excel, PowerPoint, Markdown, HTML) et **l'impression navigateur** (« Impression navigateur » n'a pas de fichier) ne se rangent pas : GFS ne garde que
    des PDF. La destination ne touche que les PDF.
- **d. Ce que tu dis à la personne**, dans ton coin d'état (GFS a déjà posé sa question : pas de fenêtre de plus pour un succès) : le nombre de fichiers rangés (`ajoute`), remplacés
  (`remplace`), copiés (`copie`) et ignorés (`ignore`), en une phrase ; pour un `copie`, le nom que GFS a donné (« Facture Martin (1).pdf »). Une erreur se dit avec sa phrase, et
  **l'export ne se perd pas** : le PDF est déjà fabriqué ; quand le rangement échoue (`GFS_ANNULE`, `GFS_ECHEC`, `GFS_REFUSE`, `GFS_INCONNU`…) et que la personne n'a pas choisi
  « Télécharger » aussi, l'app télécharge le fichier comme avant et le dit. `GFS_ANNULE` arrête les appels de cet export ; les fichiers déjà rangés restent rangés.
- **e. Seule** (adresse sans `gfs=`) : rien ne change que le grisé du point b.

**4. Ce que GFS fait de son côté.** Quand ton `GFS-ETAT.md` donne « 043 · faite · `<commit>` », GFS déclare `actions.ranger: ["pdf"]` dans ton manifeste (un commit à part, relu),
rejoue `run-ranger-pdf` avec ton app, avance la référence de ton app et le dit dans `docs/apps.md`. Jusque-là, un `ranger` de ton app reçoit `GFS_REFUSE` (« le type « pdf » ne figure pas
dans actions.ranger du manifeste ») : dis-le et télécharge ; ne cache pas l'option pour autant. **Pour essayer avant** : dans ta copie jetable de GFS (`consignes/TESTER-AVEC-GFS.md`),
ajoute `"ranger": ["pdf"]` à `actions` dans `prototype/manifestes/publipostage.json` ; le labo de GFS (`prototype/labo/run-ranger-pdf.mjs`, avec la sonde Z, `LAB_KIT=1` pour le client
du kit) montre ce qu'un vrai Grist fait de chaque réponse.

**5. Ce que cette consigne ne demande pas.** Le **dossier** : ne donne pas `dossier` (les PDF arrivent à la racine de GFS, que la personne range ensuite comme tous ses fichiers ;
un dossier par modèle ou par table serait un choix de produit que le porteur n'a pas fait). Les **commentaires sur un PDF** et **ouvrir depuis ton app le PDF que tu viens de ranger** :
des lots à suivre, chacun avec sa consigne. Aucune table, colonne, clé de réglage, bibliothèque ni adresse de plus (aucune extension : le rangement est dans ton socle, l'appel est
léger), aucune écriture dans le document : ton `acces` ne change pas.

## Pourquoi

Le porteur veut que ses exports PDF se retrouvent avec ses autres fichiers, sans passer par le dossier des téléchargements, et décider une fois pour toutes, devant un nom pris, d'écraser
ou de garder deux fichiers. GFS est le seul à écrire ce qu'il garde (une pièce jointe de son document) et le seul à parler à Grist : ton app est la seule à fabriquer l'export. Le fichier passe
de l'un à l'autre, jamais un droit d'écriture ; la fenêtre du nom pris est la même pour un PDF importé et un PDF rangé, donc la règle (remplacer, garder les deux, annuler) ne s'écrit
qu'une fois. Un export qui ne peut pas se ranger ne se perd jamais : il se télécharge comme avant.

## Fait quand

`GFS-ETAT.md` donne « 043 · faite · `<commit>` », avec des tests qui échouent sur l'ancien code : `ranger` envoie `{ fichier, nom, lot, suivants }` dans l'enveloppe du contrat et lit
`{ statut, id, nom }` ; une erreur de GFS arrive avec son `code` ; un export de plusieurs PDF range un fichier par document, avec le même `lot`, `suivants` décroissant jusqu'à 0, et le
nom qu'aurait l'entrée de l'archive ; `GFS_ANNULE` arrête les appels de l'export ; un échec de rangement télécharge le fichier ; seule, « Ranger dans GFS » est grisé avec son explication, et
« Impression navigateur » n'en offre pas ; le choix de destination se garde et se relit. Tu écris ensuite, dans « Demandes à GFS », ce que tu as vu qui mérite une réponse (le défaut de la
destination, par exemple).
