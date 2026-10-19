# Contrats de GFS (version 0)

Version 0 du 14 octobre 2026. Étape 1 du plan (cahier, section 10) : aucun code n'est écrit. Ce document met au propre la
section 5 du cahier (`cahier-des-charges-gfs.md`) à partir des faits vérifiés (`faits-verifies.md`) et d'un relevé fait le
14/10 dans le code de Grist (branche principale de `grist-core`) et dans quatre apps : Publipostage+ (`e4a239c`), Form+
(`b073d03`), Automation+ (`ee8f0a9`) et Grist-BI (`c8c819f`). Il attend la relecture du porteur : sa réponse (go ou
changements) ferme l'étape 1.

Il sert à deux équipes : le projet qui code GFS (courtier, explorateur, kit) et le projet de chaque app, qui y trouve ce que
son manifeste doit dire, ce que GFS lui garantit et ce qu'il lui refuse.

## Lire ce document

Chaque règle porte une étiquette :

- **[T]** tranché : décision du porteur (cahier, section 2) ou fait lu dans le code de Grist, ou mesuré ;
- **[D]** défaut pris ici, à confirmer à la relecture ;
- **[M]** à mesurer au prototype (étape 2), dans un vrai Grist ;
- **[Q]** question au porteur.

Les règles sont numérotées dans chaque sous-section pour que les tests les citent (« contrats 3.2, point 4 »). Les clés du
manifeste et des messages sont en français, comme dans l'exemple du cahier. Le numéro de contrat (`contrat`) reste 0 tant
que GFS v0 (étape 6) n'est pas publié : d'ici là, rien n'est publié et le contrat change librement. Ensuite, ajouter
(un champ facultatif, un verbe autorisé) ne change pas le numéro ; retirer ou changer un sens le fait passer au suivant, et
GFS grise une app dont le numéro ne lui est pas connu.

Trois mots à retenir : la **tranche** d'une app est l'ensemble des clés de réglages que son manifeste déclare ; l'**app
active** est celle dont le sous-cadre est relié à Grist ; un **type inconnu** est un type de fichier que le socle de l'app ne
connaît pas.

---

## En bref

1. **Deux conversations séparées.** GFS parle à Grist comme n'importe quel widget ; chaque app parle à GFS comme si GFS
   était Grist, avec le script d'API de Grist, inchangé. Le courtier ne recopie jamais un message : il reçoit un appel, le
   contrôle, fait son propre appel à Grist et rend sa propre réponse (section 1).
2. **Ce qui n'est pas déclaré dans `gfs.json` est refusé** : tables lues et écrites, clés de réglages, tables internes de
   Grist (par table et par colonne). Trois capacités contournent un filtre de tables, donc se déclarent avec une raison : le
   jeton d'accès, les formules, la structure des pages (sections 2 et 3).
3. **Listes fermées, tenues par GFS** : les verbes d'écriture que le courtier laisse passer ; sept tables internes
   (règles d'accès, partages, rappels, réglages du document) qu'aucune app n'écrit, quoi qu'elle déclare ; la colonne
   `options` de `_grist_Views_section`, qui porte l'adresse et l'accès de chaque widget, GFS compris (section 3).
4. **Messages propres à GFS** (contexte, stockage, actions « ouvrir », « choisir », « insérer », « installer », « fermer ») :
   une enveloppe à part, sans `mtype`, que le script d'API de Grist ignore (sections 4 et 5).
5. **Installer ne télécharge rien** : le code de toutes les apps livrées est déjà dans le site de GFS ; installer inscrit
   l'identifiant de l'app dans une table du document (sections 6.4 et 7.4). La bibliothèque d'une extension n'est pas dans
   l'app : GFS la porte et donne sa source (2.6, 5.2).
6. **Réglages de la vue** : une tranche par app, mêmes clés seule ou dans GFS ; les clés de GFS commencent par `gfs.`.
   **Question 9, tranchée le 16/10** : les apps installées se retiennent dans une table du document, `GFS_Rangement`
   (section 7.4) ; l'installation s'enregistre tout de suite, sans « Enregistrer ».
7. **Ce qu'un filtre de tables ne peut pas garantir** est écrit en toutes lettres (section 3.7).
8. **À mesurer à l'étape 2** : liste en section 9.

## Ce qui change par rapport au brouillon du cahier (à relire en premier)

1. **Le courtier ne renumérote pas : il tient deux conversations** (cahier 4.3, « Renuméroter »). Même effet, aucune
   collision de numéros d'appel, sans table de correspondance ni message recopié (1.1, point 3).
2. **Le filtre ferme davantage** que « tables lisibles, tables modifiables, `_grist_*` sur déclaration » : verbes d'écriture
   en liste fermée ; tables internes déclarées par table et par colonne ; sept tables internes et une colonne jamais écrites
   par une app ; trois capacités à déclarer (`jeton`, `formules`, `structure`) (section 3).
3. **Les lectures de tables internes se déclarent aussi** (`gristInterne`) : Publipostage+ en lit sept, Grist-BI deux. Le
   brouillon ne parlait que des écritures, et n'en comptait qu'une pour Publipostage+ (`_grist_Tables_column`, cahier 8) : il
   en fait deux, car `js/page-tree.js` écrit aussi `_grist_Pages` pour ranger les pages que Grist crée avec ses tables.
4. **Form+ ne pourra plus écrire la colonne `options` de ses sections** (trois endroits de `poc/js/grist-meta.js`) : c'est
   le chemin par lequel une app réécrirait l'adresse et l'accès de GFS. Son marqueur et ses réglages passent dans une table,
   comme le cahier le décide déjà pour les définitions (section 8). Il ne retrouvera pas non plus tout seul la clé de partage
   d'un formulaire publié (`findExistingShareKey` lit `_grist_Shares`, qu'aucune app ne lit, 3.2) : la personne colle le
   lien, ce que Form+ prévoit déjà en repli.
5. **`pourquoi` devient bilingue** (`{ fr, en }`) : GFS le montre à la personne à l'installation.
6. **`inserer` devient `{ produit, recoit }`** dans le manifeste (le brouillon avait une liste vide). Son déroulement complet
   attend l'étape 7 : ici, seulement la forme du rendu et ses règles de sûreté (5.4).
7. **Un appel de plus, `installer`** : une app demande à GFS d'ouvrir l'installation d'une extension quand on clique sur une
   fonction grisée. Le cahier le suppose (3.1 point 8, 6.4) sans le nommer.
8. **« Nouveau » est `ouvrir` sans fichier**, avec un type : aucune cinquième action.
9. **Les messages propres à GFS ont leur enveloppe** (choix que le cahier 4.3 laissait aux contrats) et **les clés de GFS dans
   les réglages commencent par `gfs.`** (comme dans `CLAUDE.md`).
10. **Le contexte gagne `adresseWidget`** : Publipostage+ compare l'adresse de ses sections à la sienne
    (`chart-source.js`, `isOwnWidget`) pour ne pas se proposer comme graphique ; dans GFS, cette adresse est celle de GFS.
    `section` devient « au mieux » : Grist ne dit pas à un widget quelle est sa section.
11. **Le rejeu de l'état à l'app qui devient prête est obligatoire** : Grist ne renvoie l'état initial (réglages, thème, table)
    qu'au `ready` de GFS, pas à chaque app (4.2).
12. **La bibliothèque d'une extension est à GFS** (décision du porteur, 14/10 ; cahier 4.7) : le contrat en tire `bibliotheques`
    dans l'entrée de l'extension (2.6), un catalogue tenu par GFS, et la source donnée à l'app par le contexte et l'événement
    `extensions` (5.2). Mesuré à l'étape 2 : en CDN, la CSP de l'app nomme l'adresse du catalogue ; la copie de GFS passe sans
    rien nommer (2.6, point 4).
13. **Les apps installées se retiennent dans `GFS_Rangement`** (décision du porteur, 16/10, question 9) : une ligne réservée
    et une colonne `Valeur` de plus (6.4, 7.4). Le conseil du cahier était les réglages de la section, qui restent un brouillon
    jusqu'à « Enregistrer ».
14. **Une bibliothèque d'extension peut être un fichier assemblé par GFS** (décision du porteur, 16/10, sur la demande d'écriture
    en direct de Publipostage+) : plusieurs paquets npm dans un seul module, qui laisse en noms nus les bibliothèques natives de
    l'app (2.6, points 8 à 11 ; 5.2, points 4 et 5). Sans lui, le curseur des autres disparaît sans erreur.
15. **La table d'un direct n'est pas prévenue par Grist** : seule la table de la section l'est. GFS ne promet pas de canal plus
    rapide que la table ; il fixe le rythme de la relecture et donne ce qu'elle coûte, mesuré (5.5).

---

## 1. Principes : les deux conversations

```
Grist (la page)
   │  messages du protocole des widgets, par le script d'API de Grist
GFS (le cadre du widget) ── le courtier : point d'arrivée pour l'app, client pour Grist
   │  mêmes messages, même script d'API (inchangé) + messages propres à GFS (section 5)
L'app (sous-cadre sans allow-same-origin)
```

### 1.1 Qui parle à qui

1. [T] Pour Grist, GFS est un widget ordinaire : il charge le script d'API de l'instance, appelle `grist.ready()` une fois et
   n'emploie que l'API publique (`grist.docApi`, `grist.viewApi`, `grist.setOption`…).
2. [T] Pour une app, GFS est ce que Grist serait : elle charge le même script d'API, appelle les mêmes fonctions, reçoit les
   mêmes événements. Une app n'a rien à changer pour parler à Grist.
3. [D] Le courtier **ne retransmet aucun message**. Un appel de l'app est lu, comparé au manifeste, exécuté par GFS comme son
   propre appel à Grist, puis sa réponse part dans la conversation de l'app avec le numéro que l'app attend. Un événement de
   Grist est lu, filtré, puis reconstruit avec les seuls champs connus. Pourquoi : un message recopié emporte les champs
   qu'on n'a pas lus (`mdest`, champs inconnus) et mêle les numéros d'appel de deux conversations.
4. [T] La conversation avec l'app est celle de `grain-rpc` 0.1.7 : `mtype` 1 appel, 2 réponse, 3 erreur, 4 message, 5 prêt ;
   `mdest` vide ou `grist` désigne le courtier lui-même, tout autre `mdest` reçoit l'erreur `RPC_UNKNOWN_FORWARD_DEST` ; un
   message dont le `mtype` est inconnu, ou qui n'est pas un objet, est ignoré ; un appel sans `reqId` n'a pas de réponse.

### 1.2 Qui GFS écoute, et dans quel ordre

1. [T] **Le routeur de GFS est un écouteur `message` enregistré avant le script d'API de Grist.** Mesuré le 14/10 dans Chromium
   141 : le script d'API affecte `window.onmessage` ; un écouteur enregistré **après** passe après lui, phase de capture
   comprise, et le script d'API de GFS voit alors le message d'un sous-cadre (une fausse réponse portant un `reqId` connu
   suffirait). Un écouteur enregistré **avant** passe avant lui et l'arrête par `stopImmediatePropagation()`. La phase de capture
   ne protège donc pas : c'est l'ordre d'enregistrement qui décide (contrôle fait avec le vrai script d'API de Grist : si le
   routeur s'enregistre après lui, un faux message d'un cadre voisin arrive à Grist). [M] Reprendre dans Firefox et WebKit
   (seul Chromium est installé dans le labo du cloud : la page de mesure du porteur, rapport de l'étape 2, section 7).
2. [T] Le routeur applique trois cas, dans cet ordre : (a) `event.source === window.parent` : c'est Grist, il laisse passer ;
   (b) `event.source` est la fenêtre du sous-cadre actif : il traite le message lui-même (le courtier) et arrête la
   propagation ; (c) tout autre cas : il arrête la propagation et jette le message. Mesuré : un sous-cadre isolé peut écrire
   à son parent et à ses voisins (`parent.frames[i]`) ; `event.origin` y vaut `"null"` mais `event.source` identifie le cadre.
3. [T] Dans l'app, le kit enregistre, avant le script d'API de Grist, une garde du même genre : tout message dont la source
   n'est pas `window.parent` est jeté. Sans elle, un cadre voisin parle au script d'API de l'app (mesuré).
4. [T] Les messages partent avec `targetOrigin "*"` dans les deux sens (une origine opaque ne peut pas être visée).
   L'identification se fait par `event.source`, jamais par `event.origin`.

### 1.3 Le sous-cadre

1. [T] `sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"`, jamais `allow-same-origin` (décision du
   16/10, question 3). [D] `allow="clipboard-write"`, comme le cadre de Grist. Mesuré dans Chromium (rapport de l'étape 2,
   section 3) : avec ces permissions, `window.print`, les téléchargements, les fenêtres et les liens en nouvel onglet,
   l'écriture dans le presse-papiers marchent ; l'impression par un cadre caché, les cinq stockages du navigateur, la lecture du
   presse-papiers et le plein écran sont refusés ; un lien `mailto:` dans le même cadre le fait mourir, `frame-src` de GFS ne
   le connaissant pas. [D] Pour un lien `mailto:` ou `tel:`, l'app ouvre un nouvel onglet (`target="_blank"`), ce qui ne demande
   rien de plus à GFS ; les ajouter à `frame-src` de GFS serait l'autre voie, à confirmer à l'étape 6. [M] Firefox et Safari :
   la page de mesure du porteur.
2. [T] **L'adresse du sous-cadre est calculée par GFS** : `apps/<id>/<entree>` sur son propre site, `<id>` et `<entree>`
   venant du manifeste livré avec GFS. Elle n'est jamais lue dans un réglage, une table ou un message (cahier 3.2, point 3).
3. [T] Elle porte les six paramètres que Grist ajoute à l'adresse d'un widget (`access`, `readonly`, `language`, `culture`,
   `timeZone`, `currency` : `WidgetFrame.ts`, `_urlWithAccess`), **avec les mêmes noms**, les valeurs de GFS, sauf `access` :
   le niveau de l'**app** (3.1). Publipostage+ lit `readonly` dans son adresse (`isReadOnlyAddress`). S'y ajoute `gfs=<n>`
   (le numéro de contrat de GFS) : c'est ainsi qu'une app sait, tout de suite, qu'elle est hébergée.

### 1.4 Un sous-cadre à la fois

1. [D] Un seul sous-cadre est relié à Grist. L'explorateur le masque sans le débrancher. Ouvrir un fichier d'une autre app
   le détruit après « fermer » (5.4), puis en crée un neuf. L'action « insérer » (étape 7) en gardera deux, dont un suspendu :
   le contrat se complète alors.
2. [D] Un sous-cadre qui n'a pas dit `ready` au bout de 15 secondes est signalé à la personne (« l'app ne répond pas »), avec
   « Recharger ». Durée à confirmer à l'étape 6.
3. [T] Mesuré dans Chromium (rapport de l'étape 2, section 3) : un sous-cadre peut aller sur une autre page du site de GFS sans
   perdre son canal ; il ne peut pas aller sur un autre site (`frame-src 'self'` s'applique à ses navigations : le cadre
   meurt), ni renvoyer la page de Grist ailleurs (aucun `allow-top-navigation`). [M] Firefox et Safari : la page de mesure du
   porteur.

---

## 2. Le manifeste `gfs.json`

### 2.1 Où il est et qui le lit

1. [T] `gfs.json` est à la racine du dépôt de chaque app (pas `manifest.json` : nom des catalogues de widgets de Grist, que
   l'outil d'audit lit comme pages d'entrée).
2. [T] GFS le lit sur son propre site (`apps/<id>/gfs.json`, même origine que le code). L'outil d'envoi de GFS vérifie le
   manifeste de chaque sous-module avant de l'inscrire au **catalogue** : la liste des `id` livrés avec cette version de GFS,
   écrite dans un fichier commité. Un `id` hors catalogue n'est jamais chargé.
3. [D] Un manifeste invalide ne fait pas échouer GFS : l'app est listée grisée, avec le motif.

### 2.2 Les champs

| Champ | Type | Oblig. | Règle |
|---|---|---|---|
| `contrat` | entier | oui | Numéro du contrat suivi (ici 0). GFS grise une app dont le numéro lui est inconnu. |
| `id` | chaîne | oui | `[a-z][a-z0-9-]{1,23}`, unique au catalogue, jamais changé ni réutilisé : il nomme `apps/<id>/`, l'espace de stockage et l'entrée de la liste installée. |
| `nom` | `{ fr, en }` | oui | Nom affiché. |
| `version` | chaîne | oui | Version de l'app. |
| `entree` | chaîne | oui | Page d'entrée : chemin relatif, sans `..`, sans segment qui commence par « _ » ou « . » (Pages ne les sert pas). |
| `tables` | objet | oui | `{ "prefixe": "Publipostage_" }` : le préfixe des tables possédées (2.3). |
| `fichiers` | liste | non | Les tables de fichiers que l'explorateur lit (2.4). |
| `reglages` | liste | non | Les clés de réglages de la vue que l'app lit et écrit (2.5). |
| `permissions` | objet | oui | Accès, tables, tables internes, capacités (section 3). |
| `extensions` | liste | non | Les extensions de l'app (2.6). |
| `dependances` | chaîne | non | Chemin de la liste des bibliothèques **natives** de l'app (`package.json`) : celles d'une extension n'y figurent pas (2.6, point 4). |
| `actions` | objet | non | Ce que l'app accepte de la part des autres (2.7). |

Un champ inconnu est ignoré (le contrat s'étend par ajout) ; un champ obligatoire absent ou mal formé invalide le manifeste.

### 2.3 Le préfixe des tables

1. [T] Grist retire les « _ » de tête d'un identifiant de table, met la première lettre en capitale et numérote un nom pris
   sans tenir compte de la casse (faits vérifiés, 3). Donc : le préfixe commence par une capitale, ne contient que des
   lettres sans accent et des chiffres, finit par « _ » (`Publipostage_`, `Automation_`, `BI_`) ; il n'est le début d'aucun
   autre préfixe du catalogue (`A_` et `A_B_` ne coexistent pas) ; toute comparaison de noms de tables est insensible à la
   casse.
2. [T] `GFS_` est réservé à GFS (3.2).
3. [T] Le préfixe possédé est lisible et modifiable par son app sans autre déclaration.

### 2.4 Les fichiers

Une entrée de `fichiers` par table de fichiers :

| Champ | Contenu |
|---|---|
| `table` | Une table possédée (elle commence par le préfixe de l'app). |
| `colonnes` | `{ id, nom, type, dossier, date }` : noms de colonnes. `id` et `nom` obligatoires ; `type`, `dossier` (chemin séparé par « / »), `date` (colonne Date ou DateTime, en secondes comme Grist la rend) facultatifs. |
| `typeParDefaut` | Le type d'un fichier dont la cellule de type est vide (Publipostage+ : `document`). |
| `types` | Liste de `{ valeur, nom: { fr, en }, icone, couleur, extension }`. `couleur` : `document`, `grille` ou `presentation` (les trois du cahier 6.5), sinon neutre. `icone` : identifiant d'une icône du kit [D]. `extension` : l'extension qui possède ce type (absente : le socle). |
| `exclure` | `{ "<colonne>": [valeurs] }` : lignes que l'explorateur ignore (les lignes réservées, comme `reglages`). |
| `rangement` | Réservé, vide en v0 : le rangement propre à une app (3.1 point 7 du cahier) se fixe à l'étape 6. |

1. [T] L'identifiant d'un fichier est la valeur de `colonnes.id`, prise comme texte (pour Publipostage+, le numéro de ligne).
2. [T] GFS lit la table entière (l'API de Grist n'a pas de projection par colonne), ne garde que les colonnes déclarées, et ne
   l'écrit jamais. Une colonne déclarée mais absente de la table se lit comme vide : un document ancien n'a pas toutes les
   colonnes. Coût mesuré à l'étape 2 dans un document lourd (Publipostage+ y range le contenu des modèles : 118 modèles, environ
   20 Mo) : l'explorateur est prêt 2,7 s après le démarrage (première lecture 2,9 s), puis 0,2 à 1,6 s ; Grist ne sait pas lire
   une partie d'une table, donc la lecture prend toute la table.
3. [T] Un fichier dont le type n'est pas dans `types` est listé grisé, jamais ouvert (section 6.5).

### 2.5 Les réglages

1. [T] `reglages` liste les clés de la tranche de l'app. Un réglage garde ce qui se refait en un clic, jamais une définition
   (cahier 5.5).
2. [T] Une clé n'est pas déclarée par deux apps du catalogue (l'outil d'envoi le vérifie) et ne commence pas par `gfs.`. Si deux
   apps existantes portaient la même clé, le cas se décide avec le porteur.
3. [T] Les clés existantes sont gardées telles quelles ; toute clé nouvelle porte le préfixe de son app (Publipostage+ : `pp_`).

### 2.6 Les extensions

Une entrée par extension : `{ id, nom: { fr, en }, texte: { fr, en }, poids, dossier, pointsEntree, bibliotheques }`.

1. [T] `dossier` est un chemin relatif à l'app (`extensions/graphique/`) ; `poids` est une indication en Ko pour la fenêtre
   d'installation.
2. [T] `pointsEntree` liste ce que l'extension ajoute à l'app : `{ genre, id }` où `genre` vaut `bouton`, `menu`, `type` ou
   `export`. Le socle de l'app dessine le grisé de chacun (cahier 4.6) ; un `type` renvoie à `fichiers[].types[].extension`.
3. [T] Une extension n'a aucun effet dans l'app seule : `contexte.extensions` y est vide.
4. [T] **La bibliothèque d'une extension est non native : GFS la porte** (décision du porteur, 14/10 ; cahier 4.7). Le code de
   l'extension, c'est-à-dire la façon dont l'app se sert de la bibliothèque, reste dans l'app ; la bibliothèque, son
   chargement, sa liste et ses empreintes sont à GFS. Le dépôt de l'app ne la nomme ni dans sa liste (`dependances`), ni dans
   son import map. **Sa CSP garde l'adresse exacte du CDN que donne le catalogue, et rien d'autre** : GFS ne peut imposer
   aucune politique à un sous-cadre (3.7, point 4), donc sans cette adresse le navigateur refuse le CDN ; la copie de GFS
   passe avec `'self'`, sans rien nommer (5.2, point 5). Confirmé par le porteur (14/10) : l'éditeur et les exports restent
   natifs, avec leurs bibliothèques dans la liste de l'app.
5. [D] `bibliotheques` liste ce que le code de l'extension exige : `{ id, version }`, par exemple
   `{ "id": "plotly", "version": "2.13.2" }` (la version de Grist, celle pour laquelle le dessin du graphique est écrit).
   Ni adresse, ni empreinte, ni mode : elles sont à GFS.
6. [D] GFS tient un catalogue des bibliothèques d'extensions : pour chacune, `id`, `version`, l'adresse du CDN avec son
   empreinte (`cdn: { src, integrite }`, ou `cdn: null` au point 11) et le fichier de la version vendorisée avec la sienne
   (`vendorise: { chemin, integrite }`), tirés par son outil d'une liste de son dépôt (`package.json`). Le catalogue est publié
   avec GFS : la source d'une bibliothèque n'est jamais lue dans un réglage, une table ou un message d'une app (cahier 3.2,
   point 3). Une extension dont une bibliothèque exigée manque au catalogue (identifiant ou version) est grisée dans GFS, avec
   la raison.
7. [D] Le mode, CDN (le défaut) ou vendorisé, se choisit dans GFS, à l'activation de l'extension ; l'app ne le connaît pas.
   [Q] Où se retient ce choix (par extension, ou pour toute la section) : cahier, question 11.
8. [T] **Un fichier assemblé, quand plusieurs paquets doivent partager leurs instances avec l'éditeur natif de l'app** (choix du
   porteur, 16/10, sur la demande d'écriture en direct de Publipostage+). Les six paquets de cette demande importent
   `prosemirror-*` et `@tiptap/core` : si l'extension apporte sa propre copie de ProseMirror, le texte se synchronise mais les
   curseurs des autres disparaissent sans une erreur, et une carte d'importation posée à l'exécution est refusée par la CSP de
   l'app (faits vérifiés, 9). GFS construit donc **un seul fichier module**, qui contient les paquets demandés et leurs
   dépendances (par exemple `lib0`) et laisse en noms nus les bibliothèques natives de l'app, que la carte d'importation de
   l'app nomme déjà. L'entrée du catalogue (point 6) porte alors `forme: "module"`, `contient` (les paquets npm et leurs
   versions exactes), `modules` (les paquets que l'extension prend dans le fichier) et `externes` (les noms nus que le fichier
   laisse à l'app) :

   ```json
   { "id": "edition-live", "version": "1.0.0", "forme": "module", "poids": 145862,
     "contient": [ { "paquet": "yjs", "version": "13.6.33" }, … ],
     "modules": [ "yjs", "y-protocols/awareness", "@tiptap/y-tiptap", "@tiptap/extension-collaboration",
                  "@tiptap/extension-collaboration-caret" ],
     "externes": [ "@tiptap/core", "prosemirror-model", "prosemirror-state", "prosemirror-transform", "prosemirror-view" ],
     "cdn": null,
     "vendorise": { "chemin": "vendor/edition-live/1.0.0/edition-live.js", "integrite": "sha384-…" } }
   ```

   L'app ne nomme toujours aucun de ces paquets dans sa liste ni dans sa carte d'importation (point 4) ; elle garde, comme avant,
   les `externes`, qui sont ses bibliothèques natives. Une entrée sans `forme` est un script classique (Plotly).
9. [D] **Le fichier se range sous une clé de GFS.** Chargé, il pose `globalThis.GfsPaquets[id] = { version, modules }`, où
   `modules` associe à chaque paquet npm de `modules` son espace de noms (`modules['yjs']` vaut `import * as … from 'yjs'`) :
   l'extension prend ce qu'elle veut sous les noms qu'elle connaît déjà. Le fichier ne pose rien d'autre sur la fenêtre.
10. [D] **Construit par l'outil de GFS, jamais à la main.** La liste de GFS (`bibliotheques/package.json`) donne les versions
    exactes des paquets et, sous `gfs.bibliotheques.<id>.assemble`, ce que le fichier est : `version` (celle de GFS), `paquets`,
    `modules`, `externes` et `alias` (les `@tiptap/pm/<x>` renvoyés à `prosemirror-<x>`). L'outil tire les paquets (`npm pack`,
    avec l'intégrité du registre), les assemble (esbuild, version exacte, épinglée dans `prototype/package.json`) en un fichier
    minifié, calcule son empreinte (sha384), garde la copie vendorisée (`vendor/<id>/<version>/<id>.js` : `.js`, pour qu'il soit
    servi comme du JavaScript partout) et écrit l'entrée du catalogue. **La version est celle de GFS** (`1.0.0` au départ ; le
    troisième nombre monte quand une version contenue change) et `contient` dit ce qu'elle contient. L'extension exige
    `{ id, version }` comme pour toute bibliothèque (point 5).
    L'outil **refuse** le fichier qui contiendrait un paquet que la liste ne nomme pas, ou dont les noms nus ne seraient pas
    exactement les `externes` de la liste : une seconde copie d'une bibliothèque de l'app entrerait sans bruit dans le fichier
    (faits vérifiés, 9). Il recopie les licences des paquets contenus (MIT) dans `vendor/<id>/<version>/LICENCES.txt`, à côté.
11. [T] **Sans CDN tant que GFS n'a pas d'adresse publique** (cahier, question 5 ; choix du porteur, 16/10) : l'entrée porte
    `cdn: null`. La copie de GFS est alors le seul mode : la fenêtre « Apps et extensions » ne propose pas le CDN pour cette
    bibliothèque et le dit, l'extension marche avec la copie, et la CSP de l'app ne nomme rien (5.2, point 5). À la publication,
    l'outil ajoute l'adresse du CDN avec la même empreinte, et les apps nomment alors cette adresse dans leur CSP, comme pour
    Plotly (consigne 007).

### 2.7 Les actions acceptées

```json
{
  "actions": {
    "ouvrir":  ["document", "grille", "email", "macro"],
    "choisir": ["document", "grille"],
    "inserer": { "produit": [], "recoit": [] }
  }
}
```

1. [T] `ouvrir` : les types de fichiers que l'app sait ouvrir.
2. [T] `choisir` : les types de **ses** fichiers qu'une autre app peut faire choisir (l'explorateur en mode choix les montre).
3. [D] `inserer` : `produit` liste les rendus portables que l'app sait fournir, `recoit` ceux qu'elle sait accepter ; vides tant
   que l'étape 7 n'a pas écrit le déroulement (5.4).

### 2.8 Validation

1. [D] L'outil d'envoi de GFS valide chaque manifeste à la construction ; GFS le revalide au chargement. Une erreur de la
   liste suivante invalide le manifeste :
   - un champ obligatoire absent ou d'un autre type ; un `id` ou un préfixe hors format, déjà pris, ou égal à `GFS_` ;
   - `fichiers[].table` hors du préfixe ; une colonne de `colonnes` qui n'est pas une chaîne ;
   - une clé de `reglages` qui commence par `gfs.` ou que le catalogue donne à une autre app ;
   - dans `permissions` : une règle de la section 3 non tenue (un motif `ecrit` que `lit` ne couvre pas, un `pourquoi` absent,
     une table ou une colonne de la liste fermée 3.3, une entrée `gristInterne` qui lit `_grist_Shares` ou `_grist_Triggers`,
     qui écrit sans `lit: true` ou qui écrit plus d'une table, `lit`/`ecrit`/`gristInterne`/capacités avec un accès autre que
     `full`) ;
   - une extension dont le `dossier` sort de l'app, ou dont une entrée de `bibliotheques` n'a pas d'`id` ou n'a pas une
     `version` exacte (un intervalle, `latest`).

### 2.9 Exemple : Publipostage+

D'après son code du 14/10 (`e4a239c`). Les sept tables internes qu'il lit viennent de `chart-source.js`, `schema-renames.js`,
`page-tree.js`, `grist-api.js` et `settings-columns.js` ; les deux qu'il écrit, de `template-pack.js` (`visibleCol` de
`_grist_Tables_column`) et de `page-tree.js` (`indentation`, `pagePos` et `options` de `_grist_Pages`). Une entrée qui écrit
nomme une seule table et porte aussi `lit: true` (3.3, point 5).

```json
{
  "contrat": 0,
  "id": "publipostage",
  "nom": { "fr": "Publipostage+", "en": "Publipostage+" },
  "version": "1.0.0",
  "entree": "index.html",
  "tables": { "prefixe": "Publipostage_" },
  "fichiers": [{
    "table": "Publipostage_Modeles",
    "colonnes": { "id": "id", "nom": "Nom", "type": "TypeModele", "date": "DateModif" },
    "typeParDefaut": "document",
    "types": [
      { "valeur": "document", "nom": { "fr": "Document", "en": "Document" }, "couleur": "document" },
      { "valeur": "grille", "nom": { "fr": "Grille", "en": "Grid" }, "couleur": "grille" },
      { "valeur": "email", "nom": { "fr": "E-mail", "en": "Email" } },
      { "valeur": "macro", "nom": { "fr": "Macro-modèle", "en": "Macro template" } }
    ],
    "exclure": { "TypeModele": ["reglages"] }
  }],
  "reglages": ["modeleDeLaVue", "modeleSelonLigne", "droitsAcces", "dateDernierExport"],
  "permissions": {
    "acces": "full",
    "lit": ["*"],
    "ecrit": ["*"],
    "gristInterne": [
      {
        "tables": ["_grist_Tables"],
        "lit": true,
        "pourquoi": {
          "fr": "Connaître les tables du document et repérer celles que des règles d'accès cachent.",
          "en": "Know the document's tables and spot those hidden by access rules."
        }
      },
      {
        "tables": ["_grist_Tables_column"],
        "lit": true,
        "ecrit": ["visibleCol"],
        "pourquoi": {
          "fr": "Connaître les colonnes et leurs types, et régler la colonne affichée d'une Référence que la galerie de modèles vient de créer.",
          "en": "Know the columns and their types, and set the displayed column of a Reference that the template gallery has just created."
        }
      },
      {
        "tables": ["_grist_Pages"],
        "lit": true,
        "ecrit": ["indentation", "pagePos", "options"],
        "pourquoi": {
          "fr": "Ranger dans le volet des pages celles que Grist crée avec les tables du widget, et replier la page des modèles.",
          "en": "Tidy, in the page panel, the pages Grist creates with the widget's tables, and collapse the templates page."
        }
      },
      {
        "tables": ["_grist_Views", "_grist_Views_section", "_grist_Views_section_field", "_grist_Filters"],
        "lit": true,
        "pourquoi": {
          "fr": "Retrouver les sections de la page et leurs filtres pour proposer un graphique du document.",
          "en": "Find the page's sections and their filters to offer a chart of the document."
        }
      }
    ],
    "formules": {
      "pourquoi": {
        "fr": "La galerie crée des colonnes à formule et la colonne affichée des Références, et l'identification de la personne lit user.Email par une formule.",
        "en": "The gallery creates formula columns and the displayed column of References, and the person's identification reads user.Email through a formula."
      }
    },
    "jeton": {
      "lectureSeule": true,
      "pourquoi": {
        "fr": "Télécharger les pièces jointes du document et nommer le document par son adresse d'interface de programmation.",
        "en": "Download the document's attachments and name the document by its API address."
      }
    }
  },
  "extensions": [
    {
      "id": "graphique", "nom": { "fr": "Graphique", "en": "Chart" }, "dossier": "extensions/graphique/",
      "bibliotheques": [{ "id": "plotly", "version": "2.13.2" }]
    }
  ],
  "dependances": "package.json",
  "actions": {
    "ouvrir": ["document", "grille", "email", "macro"],
    "choisir": ["document", "grille"],
    "inserer": { "produit": [], "recoit": [] }
  }
}
```

---

## 3. Permissions et filtre du courtier

### 3.1 Le niveau d'accès

1. [T] Grist connaît trois niveaux : `none`, `read table`, `full` (chaînes exactes de `settings.accessLevel`). Le niveau vaut
   pour tout le cadre de GFS ; seul le courtier peut restreindre une app.
2. [D] GFS demande toujours `full` (`grist.ready({ requiredAccess: 'full' })`) : lire les tables de fichiers des apps pour
   l'explorateur exige `full`, même pour lui (`GristDocAPI`, sauf `getDocName`). La personne peut accorder moins.
3. [T] Le niveau d'une app est le plus bas entre `permissions.acces` et le niveau accordé à GFS. Les apps de ce contrat
   déclarent `full` ; une app qui ne fait qu'afficher la ligne choisie peut déclarer `read table` ou `none`.
4. [T] Un niveau accordé inférieur à `full` ne casse rien : GFS marche sans explorateur ni installation (gestes grisés, avec le
   texte qui explique), et chaque app reçoit son niveau.
5. [T] Le niveau que l'app lit dans l'événement d'options (`settings.accessLevel`, comme Publipostage+) est son niveau, pas
   celui de GFS.
6. [T] Un changement d'accès **reconstruit le cadre de GFS** (mesuré, faits vérifiés 2) : GFS repart de zéro, avec ses
   sous-cadres. Une app doit donc pouvoir être rechargée à tout moment sans perte, comme seule.

### 3.2 Les tables lisibles

`permissions.lit` est une liste de motifs : un nom (`Clients`), un préfixe suivi de `*` (`Publipostage_*`) ou `*` seul.

1. [T] Lire une table par `fetchTable` exige `full` chez Grist. Le courtier refuse (`GFS_REFUSE`) la table qu'aucun motif de
   `lit` ne couvre, hors du préfixe possédé (2.3, point 3).
2. [D] **`*` désigne les tables de la personne** : toute table dont le nom ne commence ni par `GFS_` ni par le préfixe d'une app
   du catalogue, et aucune table `_grist_*`. Un nom ou un préfixe écrit en toutes lettres (`Publipostage_Modeles`) désigne ces
   tables-là : lire la table d'une autre app est une lecture déclarée, jamais une lecture par `*`.
3. [T] Les tables `GFS_*` sont à GFS seul : une app ne les lit ni ne les écrit, quoi qu'elle déclare.
4. [D] Les tables internes de Grist (`_grist_*`) se lisent seulement par une entrée `gristInterne` avec `lit: true`, table par
   table (aucun motif). `_grist_Shares` (les clés de partage, qui donnent accès aux pages publiées) et `_grist_Triggers` (les
   déclencheurs de rappels vers l'extérieur) ne se lisent jamais.
5. [D] `listTables` rend la liste des tables lisibles de la personne (point 2), triée. `fetchTable('_grist_Tables')`, quand elle
   est déclarée, rend la table entière, lignes au nom vide comprises : Grist laisse la ligne d'une table que des règles d'accès
   cachent à la personne, avec un nom blanchi, et Publipostage+ les compte pour ne pas dire qu'une table « n'existe plus » à
   qui n'a simplement pas le droit de la lire (`js/settings-columns.js`). Le courtier ne retire donc aucune ligne d'une table
   interne : celles-ci se déclarent par table et par colonne, jamais par ligne.
6. [D] `GristView` (les lignes de la section) n'est pas soumis à `lit` : la table de la section est le choix de la personne, et
   `lit` ne gouverne que `GristDocAPI`.

### 3.3 Les écritures

`permissions.ecrit` est une liste de motifs, comme `lit`, et chaque motif doit être couvert par `lit` (on n'écrit pas ce qu'on
ne lit pas).

1. [T] Grist rejoue un lot d'actions en entier ou pas du tout. Le courtier fait de même : si une seule action est refusée, tout
   le lot l'est (`GFS_REFUSE`, avec le rang de l'action et le motif), sans appeler Grist.
2. [D] **Verbes autorisés** (liste fermée de la v0 : ceux que les quatre apps emploient). Tout autre verbe est refusé, dont
   `ApplyDocActions` et `ApplyUndoActions` (des actions de bas niveau qui échapperaient au contrôle), `ReplaceTableData`,
   `RenameColumn`, `ModifyColumn`, `AddView`, `AddViewSection`, `RemoveView`, `RemoveViewSection`.

   | Classe | Verbes | Table visée |
   |---|---|---|
   | Lignes | `AddRecord`, `BulkAddRecord`, `UpdateRecord`, `BulkUpdateRecord`, `RemoveRecord`, `BulkRemoveRecord`, `AddOrUpdateRecord`, `BulkAddOrUpdateRecord` | 1er argument |
   | Colonnes | `AddColumn`, `AddVisibleColumn`, `AddHiddenColumn`, `RemoveColumn`, `SetDisplayFormula` | 1er argument |
   | Tables | `AddTable`, `RemoveTable`, `RenameTable` | le nom demandé ; `RenameTable` : l'ancien et le nouveau |
   | Structure | `CreateViewSection` (avec `permissions.structure`) | la table de la ligne `table_ref` (1er argument), que le courtier retrouve dans `_grist_Tables` ; si `table_ref` vaut 0, le nom du 5e argument, comme pour `AddTable` ; une section de synthèse (`groupby_colrefs` non nul) est refusée en v0 |

3. [D] **Tables possédées et tables de la personne.** Une action qui vise une table possédée passe. Une action qui vise une
   autre table passe si un motif de `ecrit` la couvre. Dans tous les cas : jamais une table `GFS_*`, jamais la table d'une
   autre app (pas de contrat d'écriture croisée en v0 : l'échange passe par la lecture, ou par un avenant décidé avec le
   porteur).
4. [D] **Noms normalisés.** Grist change le nom qu'on lui donne (accents enlevés, caractères autres que lettres et chiffres
   remplacés, « _ » de tête retirés, capitale initiale, numéro si le nom est pris). Le courtier juge donc un nom après avoir
   retiré les « _ » de tête, sans tenir compte de la casse, **et** contrôle l'identifiant réel que Grist rend : s'il lit
   `GFS_` ou le préfixe d'une autre app, il retire la table créée et refuse. Après un lot qui crée ou renomme une table, il
   relit `_grist_Tables` pour le vérifier : cette relecture ne dépend pas de la forme de la réponse (`RenameTable` rend bien
   l'identifiant réel). Mesuré à l'étape 2 : 27 noms, aucun écart dangereux ; même avec un jugement volontairement affaibli, le
   contrôle de l'identifiant réel arrête chaque nom réservé et retire la table.
5. [D] **Tables internes.** Une écriture dans `_grist_*` n'est permise que par une entrée `gristInterne` qui nomme la table et
   la liste de ses colonnes (`ecrit`). Le courtier compare les clés des objets de valeurs (`AddRecord`, `BulkAddRecord`,
   `UpdateRecord`, `BulkUpdateRecord`, `AddOrUpdateRecord`, `BulkAddOrUpdateRecord` : ses deux objets `require` et `col_values`) à
   cette liste ; une clé de plus refuse le lot. Retirer des lignes (`RemoveRecord`, `BulkRemoveRecord`) demande en plus
   `"retire": true` dans l'entrée. Une entrée qui écrit demande aussi `lit: true`, et ne nomme qu'une table. Les verbes des
   classes « Colonnes » et « Tables » refusent toute table `_grist_*`.
6. [T] **Jamais écrites par une app, quoi que le manifeste déclare** (liste fermée de GFS, à relire contre le schéma de
   l'instance visée [M]) :
   - `_grist_ACLRules`, `_grist_ACLResources`, et les deux anciennes tables `_grist_ACLPrincipals`, `_grist_ACLMemberships` :
     les règles d'accès ;
   - `_grist_Shares` : les partages publics ;
   - `_grist_Triggers` : les déclencheurs de rappels vers l'extérieur (webhooks) : les modifier change ce qui sort du
     document ;
   - `_grist_DocInfo` : les réglages du document ;
   - la colonne `options` de `_grist_Views_section`, sur n'importe quelle ligne : elle contient `customView`, donc l'adresse et
     l'accès de chaque widget, GFS compris. Une app qui l'écrirait pourrait remplacer GFS par un autre code, avec l'accès
     de son choix, et ce changement survivrait à son retrait.
7. [D] Du deuxième argument de `applyUserActions`, le courtier ne transmet que `desc` et `parseStrings` [M : relire
   `ApplyUAOptions` dans l'instance visée].
8. [T] En **lecture seule** (`readonly=true` dans l'adresse de GFS), toute écriture est refusée sans appeler Grist
   (`GFS_LECTURE_SEULE`), réglages compris (cahier 3.1, point 10).

### 3.4 Les capacités à déclarer

Trois capacités contournent un filtre de tables. L'app les déclare, avec une raison en français et en anglais ; GFS les montre
à la personne dans la fenêtre d'installation, en mots simples.

1. [D] **`jeton`** : `{ "lectureSeule": true, "pourquoi": { … } }`. Sans elle, `getAccessToken` est refusé. Avec elle, le
   courtier force `readOnly: true` sauf `lectureSeule: false`, et transmet `route` tel quel. Un jeton ouvre l'API REST sur
   tout ce que la personne peut lire dans le document, donc au-delà de `lit` (3.7).
2. [D] **`formules`** : `{ "pourquoi": { … } }`. Sans elle, le courtier refuse toute colonne qui porte une formule
   (`formula` non vide, qu'`isFormula` soit vrai ou non : une formule déclenchée s'exécute aussi), dans `AddColumn`,
   `AddVisibleColumn`, `AddHiddenColumn` et les colonnes d'`AddTable`, ainsi que `SetDisplayFormula`.
3. [D] **`structure`** : `{ "pourquoi": { … } }`. Sans elle, les verbes de la classe « Structure » du tableau 3.3
   (`CreateViewSection` en v0) sont refusés : une app qui crée des sections change les pages de la personne.
4. [D] **Les entrées de `gristInterne`** ont la forme `{ "tables": [ … ], "lit": true, "ecrit": [ "colonne", … ], "retire": true,
   "pourquoi": { "fr": "…", "en": "…" } }`. `tables` et `pourquoi` sont obligatoires ; `lit`, `ecrit` et `retire` sont
   facultatifs, au moins un des trois. Une entrée qui écrit (`ecrit` ou `retire`) nomme une seule table et porte aussi
   `lit: true` (3.3, point 5). Le `pourquoi` est montré à la personne comme celui des capacités.

### 3.5 Les clés de réglages

Voir 7.2 : le courtier réduit chaque appel de `WidgetAPI` à la tranche de l'app.

### 3.6 Les erreurs

Le courtier répond à l'app par une erreur du protocole (`mtype` 3, avec `mesg` et `code`).

| Code | Quand |
|---|---|
| `GFS_REFUSE` | table, verbe, colonne, clé ou capacité non déclarée dans `gfs.json`, ou dans une liste fermée |
| `GFS_ACCES` | niveau de l'app insuffisant ; `mesg` reprend le texte de Grist (« Access not granted. Current access level … ») |
| `GFS_LECTURE_SEULE` | écriture dans un document en lecture seule |
| `GFS_CLE_NON_DECLAREE` | écriture d'une clé de réglage hors de la tranche |
| `GFS_INCONNU` | interface, méthode, action ou événement que GFS ne connaît pas |
| `GFS_INACTIF` | appel venu d'un sous-cadre qui n'est pas l'app active |
| `GFS_ANNULE` | la personne a annulé (choisir, installer…) |
| `GFS_QUOTA` | espace de stockage plein |

### 3.7 Ce que le filtre ne garantit pas

À écrire tel quel dans le README de GFS et dans la fenêtre d'installation : le gain de sécurité est l'isolement et le filtrage,
mesurés, pas une promesse (cahier 1.3, 8).

1. [T] Un **jeton** d'accès lit par l'API REST tout ce que la personne peut lire dans le document. Pour une app qui en déclare un,
   `lit` n'est qu'une indication.
2. [T] Une **formule** s'exécute dans le bac à sable de Grist et peut lire n'importe quelle table du document. Une app qui peut
   en poser une peut faire apparaître, dans une colonne qu'elle lit, des données qu'elle ne pourrait pas lire directement :
   `formules` dit qui le peut, rien de plus.
3. [T] Une app qui écrit une table peut y écrire n'importe quoi : le schéma additif et la tolérance aux colonnes inconnues
   sont des règles testées dans chaque app, pas imposées par le courtier.
4. [T] **L'isolement n'empêche pas une app d'envoyer à un site extérieur ce qu'elle a le droit de lire** : le bac à sable ne
   coupe pas le réseau. La politique de sécurité du contenu de sa page le limite tant que son code est sain, mais elle est
   dans la page de l'app, donc retirée par une app compromise ; GitHub Pages ne permet pas d'imposer une politique au
   sous-cadre par un en-tête. Chez un client qui héberge GFS (mode vendorisé), son serveur peut imposer les en-têtes.
   Mesuré à l'étape 2 : aucune voie ne le permet depuis GFS. L'attribut `csp` du cadre est refusé tant que le serveur de
   l'enfant n'envoie pas l'en-tête `Allow-CSP-From` (Pages ne le fait pas) ; un cadre fabriqué par `srcdoc` ou `blob:` hérite
   de la politique de GFS et perd les scripts en ligne de l'app ; `blob:` est refusé par `frame-src 'self'` tant qu'on ne
   l'ajoute pas. Chez un client qui héberge GFS, son serveur peut envoyer l'accord, et l'attribut impose alors la politique.
5. [T] Le filtre limite ce qu'une app compromise peut atteindre ; il ne rend pas son code digne de confiance. Une app qui
   déclare `*` voit toutes les données de la personne dans le document.
6. [T] **Lire une table interne, c'est lire la structure de tout le document.** `_grist_Tables` et `_grist_Tables_column` donnent
   les noms, les colonnes, les types, les formules et les choix de toutes les tables, y compris celles que `lit` ne couvre
   pas ; `_grist_Views_section` et ses voisines, les pages et leurs filtres. `gristInterne` dit qui peut le lire, rien de plus.

---

## 4. Le protocole du courtier

### 4.1 Le démarrage de GFS

1. [T] GFS enregistre son routeur (1.2), puis charge le script d'API de Grist, puis appelle `grist.ready()` une fois, avec
   `requiredAccess: 'full'` et un gestionnaire `onEditOptions`. Grist garde alors tout ce qu'il envoie à GFS jusqu'à ce
   `ready` (`queueOutgoingUntilReadyMessage`).
2. [T] GFS s'abonne aux événements de Grist par l'API publique et tient, dans une copie en mémoire, le **dernier** message de
   chacun : `options` (avec `settings`), `theme`, état de la table (`onRecords`) et ligne courante (`onRecord`).
3. [T] GFS lit ensuite les réglages de sa section, décide de l'app à ouvrir (cahier 6.2) et crée le sous-cadre.

### 4.2 Le sous-cadre, de la création au `ready`

1. [T] Comme Grist, le courtier **garde tout ce qu'il envoie à l'app, réponses comprises, jusqu'au message `ready` (`mtype` 5)
   de l'app**. L'app envoie `ready` par `grist.ready()`, puis un appel `configure` (4.3).
2. [T] À la réception de `ready`, le courtier **rejoue** à l'app, dans cet ordre, le dernier `options`, le dernier `theme` et
   l'état de la table (avec `dataChange: true` et `mappingsChange: true`), avec `fromReady: true` (le champ qui déclenche
   `themeInitialized` chez le script d'API). Sans ce rejeu, une app qui démarre après GFS n'apprendrait jamais le nom de
   sa table : `grist.getTable()` et `onRecords` en dépendent. **La ligne de ce rejeu est la ligne d'à présent**, pas celle du
   dernier message de table : au `ready`, Grist ne dit la ligne que dans son message de table, et ne le refait que quand la table
   change ; la ligne que la personne choisit ensuite, dans le widget que la section suit (« Select by »), n'arrive que dans
   un message de ligne. GFS garde donc le plus récent des deux messages et rejoue la ligne de celui-là (`GristState.tableNow`).
   Mesuré le 19/10 (labo, `run-select-by.mjs`) : en rejouant le message de table tel quel, une app ouverte après le choix d'une
   ligne lisait la ligne du démarrage de GFS (le mode lecture de Publipostage+ montrait le premier client).
3. [T] Ensuite, chaque événement de Grist est transmis dès qu'il arrive, reconstruit selon 4.3. Un événement de réglages dont le
   contenu pour l'app n'a pas changé (une clé de GFS ou d'une autre app dans les réglages) n'est pas transmis. Ce contenu est
   **la tranche de l'app et le lien « Select by » de la section** (`settings.linking`) : un changement du lien seul est transmis,
   car c'est ainsi que Grist dit à une app que sa section vient d'être reliée à un autre widget, ou ne l'est plus
   (`getLinkState()` de Publipostage+). Mesuré le 19/10 (labo, `run-select-by.mjs`) : en ne comparant que la tranche, une app
   ouverte gardait le lien qu'elle avait à l'ouverture.
4. [T] Les appels de l'app avant `ready` sont reçus et exécutés ; seule leur réponse attend `ready`.
5. [T] Un appel venu d'un sous-cadre qui n'est pas le sous-cadre actif reçoit `GFS_INACTIF` (3.6), sauf la réponse à un appel que
   GFS lui a fait (par exemple `fermer`) : un sous-cadre qu'on remplace ne parle plus à Grist pendant qu'il se ferme.

### 4.3 Les interfaces, une à une

Le niveau minimal est celui que Grist exige de GFS (`CustomView.ts`, `WidgetFrame.ts`) ; le courtier l'applique à l'app avec
**son** niveau (3.1).

| Interface et méthode | Niveau minimal | Traitement par le courtier |
|---|---|---|
| `GristDocAPI@grist` : `getDocName` | `read table` | Relayé : rend l'identifiant du document |
| `listTables` | `full` | Relayé, liste réduite aux tables lisibles (3.2) |
| `fetchTable` | `full` | Relayé si la table est lisible (3.2) |
| `applyUserActions` | `full` | Relayé si tout le lot est permis (3.3) |
| `getAccessToken` | `full` | Refusé sans `permissions.jeton` ; `readOnly` forcé (3.4) |
| `GristView` : `fetchSelectedTable`, `fetchSelectedRecord`, `allowSelectBy`, `setSelectedRows`, `setCursorPos` | `read table` | Relayé ; `includeColumns` autre que `shown` demande `full`, comme chez Grist |
| `WidgetAPI` : `getOptions`, `setOptions`, `clearOptions`, `setOption`, `getOption` | `none` | Tranche de l'app (7.2) |
| `CustomSectionAPI` : `configure` | `none` | Absorbé (voir plus bas) |
| `CustomSectionAPI` : `mappings` | `none` | Rend `null` en v0 |
| `CommandAPI` : `run` | selon la commande | Refusé en v0 : aucune des quatre apps ne s'en sert |
| Toute autre interface ou méthode | | `GFS_INCONNU` |

**Les événements de Grist vers l'app** sont reconstruits champ par champ :

| Événement (`mtype` 4) | Champs transmis |
|---|---|
| ligne courante (`onRecord`) et table (`onRecords`) | `tableId`, `rowId`, `dataChange`, `mappingsChange` ; niveau minimal `read table` |
| réglages (`onOptions`) | `options` : la tranche de l'app, ou `null` ; `settings` : `accessLevel` de l'**app** et `linking` tel que Grist le dit pour la section (transmis à chaque changement du lien, 4.2 point 3) ; `fromReady` |
| thème | `theme` et `fromReady`, tels que Grist les envoie : le script d'API de l'app applique les variables de thème de lui-même, comme aujourd'hui |

**`configure`** (envoyé par `grist.ready()` de l'app) n'est jamais relayé. Le courtier répond sans erreur et :
- compare `requiredAccess` au manifeste : une demande plus haute que `permissions.acces` est ignorée (GFS a déjà demandé
  `full` pour lui) ;
- retient `hasCustomOptions` pour l'app : c'est lui qui décide de l'effet de `editOptions` (ci-dessous) ;
- ignore `columns` et `allowSelectBy` en v0 (aucune app ne s'en sert) ; `mappings` rend alors `null`.

**`themeInitialized`**, envoyé par l'app après son premier thème, est absorbé : GFS a fait le sien.

**`print`** : Grist appelle `print` sur GFS. Le script d'API de GFS en a enregistré un qui imprime la page de GFS ; GFS le
remplace (`unregisterFunc`, puis `registerFunc`) par un qui appelle `print` sur l'app active et, sans app active (l'explorateur
est au premier plan), imprime sa propre page. [D] Le relais attend l'app 10 secondes au plus. Mesuré à l'étape 2 : « Print widget »
de Grist arrive à l'app active et GFS n'imprime pas ; sans app, GFS imprime sa page ; une app sans fonction `print` ne répond
pas, et au bout de 10 secondes la page de GFS s'imprime, l'app dedans.

**`editOptions`** : GFS déclare `onEditOptions` à Grist. L'appel est transmis à l'app active si elle a déclaré
`hasCustomOptions` ; sinon GFS ouvre sa propre fenêtre d'installation [D].

### 4.4 Les messages propres à GFS

Voir la section 5. Ils portent la clé `gfs` et jamais de `mtype` : le script d'API de Grist, dans GFS comme dans l'app, les
ignore (mesuré dans `grain-rpc` 0.1.7 : `_dispatch` n'agit que sur les `mtype` connus). Aucun champ d'un message `gfs` ne porte
un nom que le script d'API lit (`tableId`, `rowId`, `settings`, `theme`, `options`).

---

## 5. Les messages propres à GFS

### 5.1 L'enveloppe

```json
{ "gfs": 0, "type": "appel",     "id": 7, "nom": "ouvrir", "args": { } }
{ "gfs": 0, "type": "reponse",   "id": 7, "data": { } }
{ "gfs": 0, "type": "erreur",    "id": 7, "code": "GFS_REFUSE", "message": "…" }
{ "gfs": 0, "type": "evenement", "nom": "extensions", "data": { } }
```

Les noms de la v0 :

| Nom | Sens | Corps (`args` ou `data`) | Réponse |
|---|---|---|---|
| `contexte` | app → GFS | aucun | le contexte (5.2) |
| `stockage.ecrire` | app → GFS | `{ cle, valeur }` (5.3) | aucune : appel sans `id` |
| `ouvrir` | app → GFS, puis GFS → app active | 5.4 | 5.4 |
| `choisir` | app → GFS | 5.4 | 5.4 |
| `inserer` | app → GFS, puis GFS → app qui fournit | 5.4 | 5.4 |
| `installer` | app → GFS | 5.4 | 5.4 |
| `fermer` | GFS → app active | 5.4 | 5.4 |
| `extensions` (événement) | GFS → app | `{ extensions: [ … ], bibliotheques: { … } }` (5.2) | aucune |

1. [D] `gfs` est le numéro de contrat de l'émetteur (pour l'app, celui de son manifeste). Un message sans `gfs` entier, ou d'un
   numéro que le destinataire ne connaît pas, est ignoré.
2. [D] `id` est un entier propre à l'émetteur, à partir de 1 ; la réponse ou l'erreur le reprend. Un appel sans `id` n'attend
   pas de réponse (comme un appel sans `reqId` chez `grain-rpc`).
3. [D] Un appel de `nom` inconnu reçoit `GFS_INCONNU` ; un événement inconnu est ignoré. Les erreurs de 3.6 valent ici aussi.
4. [D] Délais : l'app attend `contexte` 5 secondes au plus ; les appels qui attendent une personne (`ouvrir`, `choisir`,
   `installer`, `inserer`) n'ont pas de délai ; `stockage.ecrire` n'attend pas de réponse pour continuer.
5. [T] Le courtier attribue chaque message à une app par la fenêtre qui l'a envoyé (1.2), jamais par un champ du message.

### 5.2 Le contexte

L'app ne déduit ni sa page, ni l'instance, ni le document de `document.referrer` ni de sa propre adresse : elle le demande au
kit, qui le lit dans Grist quand l'app est seule et auprès du courtier dans GFS (cahier 5.6). L'app le demande par
l'appel `contexte` dès son démarrage ; GFS rend :

| Champ | Contenu | Dans GFS | Quand l'app est seule |
|---|---|---|---|
| `contrat` | numéro de contrat de GFS | 0 | absent |
| `hote` | `{ nom, version }` de GFS | oui | `null` |
| `instance` | adresse de l'instance de Grist (origine) | calculée par le code du kit (la correction `fixBaseUrl` de Publipostage+), une fois, par GFS | calculée par le kit |
| `document` | identifiant du document (`getDocName`) | oui | lu dans Grist |
| `page` | numéro de la page, ou `null` | au mieux, d'après le référent de GFS | au mieux |
| `section` | numéro de la section, ou `null` | au mieux : Grist ne le dit pas au widget | au mieux |
| `adresseWidget` | adresse du widget dans Grist, sans requête | celle de GFS | celle de l'app |
| `langue`, `culture`, `fuseau`, `devise` | paramètres `language`, `culture`, `timeZone`, `currency` de l'adresse | ceux de GFS | ceux de l'adresse |
| `lectureSeule` | `readonly` de l'adresse | celui de GFS | celui de l'adresse |
| `acces` | niveau de **cette app** (3.1) | oui | celui de Grist |
| `extensions` | identifiants des extensions actives de l'app | liste de la section | `[]` |
| `bibliotheques` | source de chaque bibliothèque que les extensions actives exigent : `{ "<id>": { src, integrite, forme } }` (2.6) ; `forme` vaut toujours `script` ou `module` | oui | `{}` |
| `ouverture` | pourquoi et sur quoi l'app s'ouvre, ou `null` (5.4) | oui | `null` |
| `stockage` | copie initiale du stockage de l'app (5.3) | oui | contenu du navigateur |

1. [T] Les six paramètres de l'adresse (1.3) et le contexte disent la même chose : l'adresse existe pour le code des apps qui la
   lit déjà, le contexte pour le kit.
2. [D] Un seul événement en cours de vie : `extensions` (`{ "extensions": [ … ], "bibliotheques": { … } }`), quand la personne
   active ou désactive une extension dans GFS. L'app charge alors l'extension au premier usage, comme ses moteurs d'export.
3. [D] `ouverture` : `null` quand l'app s'ouvre sans consigne (elle applique son propre ordre d'arrivée, cahier 6.2, point 4) ;
   sinon `{ fichier, type, dossier, raison }` où `fichier` est `{ id, type }` (ou `null` pour « Nouveau »), `type` le type
   demandé quand `fichier` est `null`, `dossier` le dossier courant de l'explorateur (une indication), `raison` l'un de
   `explorateur`, `nouveau`, `lien`. L'app affiche elle-même la raison dans son coin d'état (« par la ligne… », « depuis
   l'explorateur »).
4. [D] `bibliotheques` : GFS cherche dans son catalogue (2.6, point 6) les bibliothèques qu'exigent les extensions actives de
   l'app et donne, pour chacune, l'adresse du mode choisi (CDN ou vendorisé) et son empreinte. L'extension charge la
   bibliothèque par cette adresse, avec l'empreinte (`integrity`) et `crossorigin="anonymous"`, au premier usage, et ne charge
   rien d'autre qui ne soit dans son dossier, dans la liste de son app ou dans ce champ. Le message vient de GFS seul
   (`event.source`, 1.2), et l'adresse vient du catalogue de GFS, jamais d'une app.
   Une bibliothèque de forme `script` (Plotly) se charge par `<script src>` et pose son nom global ; une de forme `module`
   (le fichier assemblé, 2.6, point 8) par `<script type="module" src>`, puis l'extension lit `globalThis.GfsPaquets[id]`
   (2.6, point 9). Aucune des deux par `import()` : une empreinte ne se pose pas sur un import dynamique (faits vérifiés, 9).
   Sans CDN (2.6, point 11), `src` est celui de la copie de GFS. `forme` est un ajout du 16/10 : une app qui ne lit que `src` et
   `integrite` (Plotly, consignes 005 et 007) n'a rien à changer.
5. [T] **Ce que la CSP de l'app doit autoriser** (mesuré à l'étape 2 avec six CSP d'app ; cahier, question 11 tranchée le
   14/10 : CDN d'abord). En mode copie, rien : `'self'` suffit. En mode CDN, l'adresse exacte que donne le catalogue (ou son
   empreinte), et rien d'autre. Une CSP qui n'en dit rien (`script-src 'self'`), ou qui ferme les connexions quand l'extension
   charge le texte avant de l'exécuter, refuse le CDN ; une fausse empreinte est toujours refusée.
   [D] Quand le chargement échoue (CSP, réseau, empreinte), l'extension reste grisée avec la raison, jamais muette.
   Pour un fichier de forme `module`, mesuré le 16/10 dans un cadre isolé (origine nulle, `sandbox` de GFS) sous
   `script-src 'self'` : une bonne empreinte charge le fichier, une mauvaise le refuse et rien n'est posé (faits vérifiés, 9).

### 5.3 Le stockage du navigateur

Dans un sous-cadre à origine opaque, les cinq stockages (`localStorage`, `sessionStorage`, cookies, `indexedDB`, cache) sont
refusés (mesuré à l'étape 2, décision d'isolement du 16/10). `contexte.stockage` reste vide dans le prototype ; le kit offre un
stockage par app (étape 3) :

1. [T] La lecture est immédiate, dans une copie en mémoire remplie au démarrage : par le navigateur quand l'app est seule, par
   `contexte.stockage` dans GFS. L'écriture suit : `stockage.ecrire` avec `{ cle, valeur }` (`valeur: null` retire la clé).
2. [D] Les clés sont des chaînes de 1 à 64 caractères parmi `A-Z a-z 0-9 _ . : -`, les valeurs des chaînes (comme
   `localStorage`). Le courtier range tout sous l'`id` de l'app, déduit de la fenêtre : une app ne touche que son espace.
3. [D] GFS garde ces espaces dans son propre `localStorage` (clés `gfs.stockage.<id>.…`), dans un `try/catch`, et en mémoire seule
   si le navigateur le refuse. Quota par app : 1 Mo, à fixer à l'étape 5 d'après la plus grosse clé de Publipostage+
   (`pp_schema_…`, un instantané du schéma par document) ; dépassement : `GFS_QUOTA`.
4. [T] Un choix gardé par navigateur (langue, thème, zoom, raccourcis) reste un confort : l'app marche sans lui (cahier 5.7).
   L'espace de GFS n'est pas celui de l'app seule : un réglage de navigateur fait seule ne suit pas dans GFS, et c'est sans
   perte de données.

### 5.4 Les actions

| Action | Appel | Réponse | Dans l'app seule |
|---|---|---|---|
| **ouvrir** | app → GFS : `{ app, fichier: { id, type }, raison? }` ; GFS → app active : `{ fichier, type, dossier, raison }` | `{ ouvert: true \| false }` (`false` si la personne annule la question de l'app) | l'app ouvre ses propres fichiers ; ceux d'une autre app sont grisés, texte commun |
| **choisir** | app → GFS : `{ types, apps?, titre? }` | `{ app, id, nom, type }`, ou `null` si la personne annule | la liste avec recherche de l'app, sur ses propres fichiers |
| **inserer** | app qui reçoit → GFS : `{ formats, types? }` ; GFS → app qui fournit : même corps | `{ rendu }` (ci-dessous) | grisé, texte commun |
| **installer** | app → GFS : `{ extension, fonction? }` | `{ actives: [ … ] }` : les extensions actives après le choix de la personne | la fenêtre du grisé (guide des apps, section 5) |
| **fermer** | GFS → app active : `{ raison }` | `{ ferme: true \| false }` | sans objet |

1. [T] **ouvrir** : GFS ferme d'abord l'app active (« fermer »), active l'app du fichier et lui passe `ouverture` (5.2). Si
   l'app du fichier est déjà active, GFS lui envoie l'appel `ouvrir` : elle ouvre le fichier, après sa propre question
   d'enregistrement. Le type demandé doit figurer dans `actions.ouvrir` du manifeste de l'app visée ; une app non installée
   est listée grisée avec « Installer ». « Nouveau » est `ouvrir` avec `fichier: null` et un `type` : l'app ouvre un fichier
   vierge de ce type et le crée à son premier enregistrement ; si son manifeste déclare `colonnes.dossier`, elle y écrit
   `dossier` (sinon le fichier arrive à la racine). [D]
   Quand l'app est déjà active, GFS (prototype V0.3) n'envoie l'appel qu'à une app qui a déjà demandé son `contexte` : avant, elle
   y lit l'`ouverture`, celle du dernier clic. L'appel n'a pas de délai. `{ ouvert: false }` (la personne a annulé dans l'app) ne
   se commente pas ; `GFS_INCONNU` (l'app n'a pas la porte) vaut la phrase provisoire ; toute autre erreur est dite avec le texte
   de l'app ; une app retirée ou remplacée pendant l'attente abandonne l'appel sans rien dire. [D] **Mesuré le 16/10** dans un
   vrai Grist, à la vraie souris, avec une app d'essai (sonde O, `run-ouvrir.mjs`) : le double-clic, « Nouveau », l'annulation,
   l'erreur, l'appel inconnu, l'attente sans réponse et le retrait de l'app pendant l'attente ; les messages vont et reviennent
   par le routeur jusqu'à un cadre isolé. [M] **Mesuré le 19/10 avec Publipostage+** (la version que GFS référence, `abfb600` ;
   `run-ouvrir-publipostage.mjs`, à 700 × 400, à la vraie souris, en français et en anglais, en clair et en sombre) : le double-clic
   lance l'app sur le modèle cliqué, avant le ★ ; l'app déjà ouverte change de modèle dans son cadre, sans rechargement ; le modèle
   déjà ouvert ne change rien ; avec des modifications en attente, l'app pose sa question dans le panneau et GFS attend sans rien
   dire (« Annuler » : l'app reste, « Abandonner » : elle ouvre, « Enregistrer » : son écriture passe par GFS pendant que l'appel
   attend, puis elle ouvre) ; un fichier rangé dans un dossier s'ouvre aussi ; l'ouverture n'écrit rien dans le document (ni
   modèle, ni ★, ni réglage de la vue). « Nouveau » n'est pas encore pris par Publipostage+ (sa consigne 010 l'exclut) : GFS garde
   sa phrase provisoire pour « Nouveau » seulement (`ACCEPTS_OPEN` a une valeur par app pour `fichier` et pour `nouveau`). [M]
2. [T] **choisir** : l'explorateur s'ouvre en mode choix, filtré par `types` (et `apps` si elle est donnée), parmi les types que
   les manifestes déclarent dans `actions.choisir`. Un fichier d'une app non installée est grisé, avec « Installer ». `titre`
   est un texte déjà traduit, montré par GFS.
3. [T] **fermer** : l'app répond `oui` quand elle peut fermer, après sa question (Enregistrer, Abandonner, Annuler), et `non`
   si la personne annule : tout reste en place. [D] Sans réponse, GFS ne ferme rien tout seul ; il propose « Fermer quand
   même » au bout de 10 secondes (les modifications non enregistrées seraient perdues). À confirmer à l'étape 6.
4. [T] **installer** : GFS ouvre sa fenêtre d'installation à la ligne de l'extension ; rien ne se télécharge (7.3). L'app
   charge l'extension quand elle reçoit l'événement `extensions`.
5. [D] **inserer** : seule la forme du rendu et ses règles sont arrêtées ici ; le déroulement (GFS active l'app qui fournit au
   premier plan, la personne y choisit, GFS la ferme et rend le rendu) demande deux sous-cadres à la fois et s'écrit à l'étape 7.
   Le **rendu portable** est :

   ```json
   {
     "format": "svg",
     "donnees": "<svg …>",
     "largeur": 640,
     "hauteur": 360,
     "texteAlternatif": "…",
     "source": { "app": "bi", "id": "7", "type": "tuile", "version": "1.2.0" }
   }
   ```

   `format` vaut `svg`, `png` (données en base64) ou `valeur` (`donnees` est alors une valeur JSON simple, sans dimensions).
   L'app qui reçoit garde le rendu **et** `source` ; sans l'app source, le rendu reste affiché et sa mise à jour est
   grisée. Taille maximale : à fixer à l'étape 7.
6. [T] Une app qui reçoit un rendu ne charge jamais le code de l'app qui l'a produit, et **traite `donnees` comme une donnée
   non fiable** : un SVG s'affiche par `<img src="data:image/svg+xml…">` (ou un canevas), jamais en l'insérant dans la page,
   car un SVG inséré exécute ses scripts.

### 5.5 La table d'un direct : être prévenu quand une autre table change

Une app qui fait passer un travail à plusieurs par une table du document (l'écriture en direct de Publipostage+ : une ligne par
paquet de frappes, une par personne pour la présence) doit savoir quand cette table change.

1. [T] **Grist ne prévient un widget que des changements de la table de sa section** (`TableNotifier`, `WidgetFrame.ts` ; faits
   vérifiés, 2). La table du direct est une autre table que celle de la section de GFS : aucun événement ne l'annonce, quelle
   que soit la façon dont GFS relaie. `fetchTable` est un appel au serveur du document, pas la lecture de la copie en mémoire
   qu'est `onRecords`.
2. [T] **Mesuré le 16/10** (labo, `run-direct.mjs`, **sans réseau**) : écrite par un cadre, une ligne arrive à un autre cadre
   en 20 ms (médiane) par la prévenance de Grist, 21 ms par un relais, **156 ms (p90 244) par une relecture toutes les 250 ms**,
   55 ms (p90 99) toutes les 100 ms, 265 ms toutes les 500 ms, 515 ms toutes les secondes : la prévenance plus la moitié de
   l'intervalle. Un réseau simulé à 50 ms par sens ne change pas cet écart (+108 ms à 250 ms). Une relecture coûte 5 à 9 ms pour
   14 à 54 Ko, 18 ms pour 280 Ko (faits vérifiés, 2).
3. [D] **L'app relit la table du direct par `fetchTable`, à ce rythme** : toutes les **250 ms** tant qu'une autre personne est
   présente (une ligne de présence récente) et que la page est visible ; toutes les **2 s** quand elle est seule ; jamais plus
   vite que toutes les **100 ms** ; à l'arrêt quand la page est cachée ou que l'app n'est plus active (`GFS_INACTIF`, 4.2,
   point 5). La table est déclarée dans `permissions.lit` (et `ecrit` pour y écrire) et le courtier relaie : GFS n'a rien à
   ajouter. Le délai que cela ajoute à celui de la prévenance de Grist est de **125 ms en moyenne et de 250 ms au plus**, pas de
   0,5 à 1,5 s. Défaut à confirmer sur un Grist en ligne (point 6).
4. [D] **Quand la table du direct est celle de la section** (la personne a lié la section de GFS à cette table), l'app n'a rien à
   relire : la prévenance de Grist arrive par `onRecords` (4.3). Le canal de l'app reste un détail interne (le `connect(rappel)`
   de son essai) : relecture ou prévenance, le rappel reçoit la liste complète des lignes.
5. [Q] **Une vignette relais** (une seconde section de GFS, liée à la table du direct, que Grist prévient et qui passe
   l'information à GFS par un canal local à la page) ramènerait le délai à celui de la prévenance (+1 ms mesuré). Elle coûte à
   la personne une vignette de plus à ajouter à la page et à garder, et à GFS un second mode d'ouverture. Elle ne se construit
   que si une mesure sur un Grist en ligne montre que la relecture ne suffit pas, et s'ajoute alors derrière le même canal de
   l'app.
6. [M] **À mesurer sur un Grist en ligne** : l'aller-retour réel d'une relecture, la charge de quatre relectures par seconde et
   par personne qui écrit, les plafonds de l'offre, le délai de bout en bout entre deux navigateurs.

---

## 6. Les données

### 6.1 Propriété et schémas

1. [T] Chaque app possède les tables de son préfixe et n'écrit pas celles d'une autre ; GFS possède `GFS_*`.
2. [T] Schémas versionnés, changements additifs seulement : jamais renommer ni supprimer une colonne publiée. Une colonne de
   sonde qu'une app ajoute puis retire dans la même opération (Form+ le fait pour tester le droit de modifier le schéma) n'est
   pas une colonne publiée ; `RemoveColumn` reste donc dans la liste de 3.3.
3. [T] Tolérer les colonnes inconnues ; ne jamais écrire une colonne absente : une seule `UpdateRecord` ou `AddRecord` sur une
   colonne inconnue annule tout le lot ; `AddColumn` sur un identifiant pris le renomme (`Replie2`).
4. [T] Une table lue par `fetchTable` rend toutes ses colonnes, dont les colonnes d'aide que Grist range dans la table
   (`gristHelper_…`) : les ignorer. Une colonne ajoutée par `AddColumn` est masquée dans la section : la lire avec
   `includeColumns: 'normal'` (niveau `full`).

### 6.2 Créer une table

1. [T] Seulement avec l'accord de la personne (la question « Créer les tables du widget dans ce document ? » de Publipostage+,
   reprise par le kit) ; le courtier ne la pose pas, c'est le kit, dans l'app comme dans GFS. Préférer une ligne réservée d'une
   table existante (la ligne `reglages` de `Publipostage_Modeles`) à une table de plus (cahier, section 2).
2. [T] Après un `AddTable`, relire l'identifiant réellement créé (3.3, point 4 pour les noms ; chaque `AddTable` crée aussi une
   page dans le document).
3. [T] Une table créée par la galerie de Publipostage+ n'est pas préfixée : elle appartient à la personne (d'où `ecrit: ["*"]`).

### 6.3 Les lignes réservées

1. [T] Une ligne réservée d'une table de fichiers se déclare dans `exclure` (2.4) : l'explorateur l'ignore, l'app ne la montre
   jamais comme un fichier.
2. [T] GFS n'écrit jamais dans la table d'une app.

### 6.4 `GFS_Rangement`, le rangement commun

Dossiers et favoris, communs à toutes les apps, par personne (cahier 3.1 point 7, 6.7 point 3), et les apps installées du
document (7.4). Une seule table, créée avec l'accord de la personne à la première installation d'une app ou à la première
rangée d'un fichier, selon ce qui vient d'abord.

| Colonne | Type Grist | Contenu |
|---|---|---|
| `Utilisateur` | Text | Adresse e-mail de la personne ; vide si son identité n'est pas résolue (le rangement est alors partagé, comme `Utilisateur = ''` de Publipostage+) |
| `App` | Text | `id` de l'app ; vide sur une ligne d'état de dossier |
| `Fichier` | Text | Identifiant du fichier (2.4) ; vide sur une ligne d'état de dossier |
| `Favori` | Bool | Épinglé par la personne |
| `Dossier` | Text | Chemin séparé par « / » (`Factures/Clients A`) ; vide = racine |
| `Replie` | Bool | Lignes d'état de dossier seulement : dossier replié par défaut |
| `Valeur` | Text | Lignes réservées de GFS seulement (point 6) : un texte JSON |

1. [D] Une ligne par (personne, app, fichier) qui a un dossier ou un favori ; une ligne d'état par (personne, dossier). Un
   dossier existe tant qu'une ligne le nomme.
2. [D] Modèle : `Publipostage_PreferencesModeles` (`js/template-preferences.js`), qui range déjà, par personne, l'épingle, le
   dossier (chemin avec « / ») et l'état replié.
3. [T] Changements additifs seulement, colonnes inconnues gardées ; désinstaller une app n'efface aucune ligne ; une ligne dont
   le fichier n'existe plus est ignorée.
4. [D] L'identité de la personne (`Utilisateur`) vient du mécanisme de Publipostage+ (une table-sonde lue par formule), que
   l'étape 3 fait passer dans le kit ; sans identité, repli vide, jamais bloquant.
5. [T] Le rangement propre à une app (les dossiers personnels de Publipostage+) reste valable dans l'app. Comment l'explorateur
   le montre dans GFS se décide à l'étape 6 (champ `fichiers[].rangement`, réservé en 2.4).
6. [T] Une ligne dont `Utilisateur` commence par `@` est une ligne réservée de GFS : l'état du document, jamais le rangement
   d'une personne. La seule à ce jour : `@document` / `gfs` / `apps`, les apps installées (7.4). Une app n'écrit jamais cette
   table (6.1, point 1).

### 6.5 Préserver l'inconnu

1. [T] Le socle de chaque app connaît la forme de tous ses objets, même ceux d'une extension absente. Un graphique dans un
   document ouvert sans l'extension s'affiche grisé et se réenregistre intact.
2. [T] Un type de fichier inconnu est listé grisé, jamais ouvert, jamais réenregistré, jamais proposé comme fichier de départ.
   Deux textes : « Demande l'extension {nom} (Grist Factory Suite) » pour un type qui renvoie à une extension du manifeste,
   où {nom} est le `nom` de cette extension (2.6) dans la langue de l'interface, jamais son `id` ;
   « Créé avec une version plus récente de {app} » pour un type absent du manifeste (guide des apps, 2.2).
3. [T] GFS applique la même règle dans l'explorateur : un type absent de `types`, ou d'une extension non active, est grisé avec
   un cadenas, sans couleur.
4. [T] GFS préserve aussi ses propres champs inconnus : quand il réécrit la ligne `apps` ou une autre ligne de `GFS_Rangement`,
   il garde ce qu'une version plus récente de GFS y a ajouté.

---

## 7. Les réglages de la vue

### 7.1 Ce qu'un réglage garde

1. [T] Ce qui se refait en un clic (le modèle de la vue, les règles d'ouverture, l'accès), jamais une définition (un
   formulaire, un graphe d'automatisation) : une définition vit dans une table (cahier 5.5).
2. [T] Les mêmes clés seule et dans GFS ; le courtier les transmet sans les renommer (aller-retour, cahier 7).
3. [T] Toutes les clés d'une section sont dans un seul objet, celui de Grist (`customView.widgetOptions`). Celles de GFS
   commencent par `gfs.`.

### 7.2 La tranche de l'app

1. [T] `getOptions()` rend les clés déclarées présentes dans l'objet, ou `null` s'il n'y en a aucune. `getOption(k)` rend la
   valeur d'une clé déclarée, ou rien pour une clé non déclarée.
2. [T] `setOption(k, v)` écrit la clé `k` si l'app l'a déclarée, sinon `GFS_CLE_NON_DECLAREE`.
3. [D] `setOptions(objet)` remplace la tranche : les clés déclarées de l'objet sont écrites, les clés déclarées absentes de
   l'objet sont retirées, les clés non déclarées sont ignorées (Form+ appelle `setOptions` avec tout son objet) ; GFS
   avertit dans la console. Les clés de GFS et des autres apps ne bougent pas.
4. [T] `clearOptions()` retire les clés déclarées de l'app, rien d'autre.
5. [T] Le courtier fait ces écritures par `setOption` (clé par clé), jamais par `setOptions`, qui remplacerait tout l'objet.
6. [T] Les appels de l'app et ceux de GFS passent par la même connexion à Grist : ils s'enchaînent, aucune écriture ne
   s'en perd.

### 7.3 Brouillon, « Enregistrer » et installation

1. [T] Un réglage écrit par le widget n'est qu'un **brouillon** tant que la personne n'a pas cliqué « Enregistrer » dans Grist ;
   Grist ne prévient pas le widget de cet enregistrement (mesuré le 09/10). D'où le rappel « Enregistrer » du kit.
2. [T] Un widget n'écrit jamais un réglage sans geste de la personne : Grist afficherait « Enregistrer » pour rien. Cela vaut
   pour GFS et ses clés `gfs.`.
3. [T] **Installer ne télécharge rien** : le code de toutes les apps livrées est déjà dans le site de GFS (sous-modules). Installer
   une app, c'est inscrire son `id` dans la liste du document (7.4) ; activer une extension, l'inscrire à la ligne de l'app ;
   désinstaller, retirer l'inscription. Désinstaller ne supprime aucune donnée (cahier 3.1, point 1) : réinstaller retrouve
   tout.

### 7.4 Question 9, tranchée le 16/10 : les apps installées se retiennent dans une table du document

Le conseil du cahier était les réglages de la section, avec le rappel « Enregistrer ». Le porteur a choisi une table pour tout
le document, pour que l'installation s'enregistre tout de suite.

1. [T] **Où.** Une ligne réservée de `GFS_Rangement` (6.4) : `Utilisateur` = `@document`, `App` = `gfs`, `Fichier` = `apps`,
   et dans `Valeur` un texte JSON `{ "<id>": { "extensions": [ "…" ], "modes": { "<extension>": "cdn" | "vendorise" } } }`
   (`modes` est facultatif, le défaut est le CDN : question 11). La ligne n'existe qu'après la première installation.
2. [T] **Immédiat.** Installer, désinstaller, activer une extension, choisir son mode : l'écriture de la ligne suffit, sans
   « Enregistrer ». Ce rappel reste pour les réglages que chaque app garde dans sa tranche (7.3), pas pour ceux de GFS.
3. [T] **Pour tout le document.** Les sections GFS d'un document partagent la liste des apps. GFS la relit au chargement de
   la section et juste avant d'écrire. [D] Un widget ne reçoit pas les changements d'une table qui n'est pas la sienne : une
   autre section ne voit un changement qu'à son prochain chargement. [M]
4. [T] **L'accord de la personne** (6.2, point 1) se demande au premier geste d'installation, puisque la table doit alors
   exister : une fenêtre du widget, jamais `confirm()`, qui dit le nom de la table, qu'elle vaut pour tout le document et que
   Grist ajoute une page pour elle. [D] Si la personne refuse, rien ne s'installe, la case revient et la question se repose au
   geste suivant ; Publipostage+, toujours là dans le prototype, marche sans table.
5. [D] **Sans droit d'écrire** (document en lecture seule, accès du widget insuffisant, règle d'accès de Grist qui refuse
   l'écriture) : les cases sont grisées, avec la raison ; une écriture refusée rend la liste à ce que la table disait en dernier.
6. [T] **Lire ne crée rien.** Au chargement, GFS lit `GFS_Rangement` si elle existe ; sinon la liste est celle par défaut.
7. [T] **L'aller-retour** (cahier 6.2, point 2) ne change pas : une section sans app de départ, mais dont les réglages portent
   des clés qu'un manifeste déclare, ouvre cette app sans rien écrire, que la table existe ou non.
8. [D] **L'app de départ** (`gfs.depart`) reste un réglage de la section : un brouillon jusqu'à « Enregistrer », écrit
   seulement sur un geste de la personne.
9. [D] **L'ancienne clé `gfs.apps`** du prototype V0.2 n'est plus ni lue ni écrite ; une section qui la porte n'est pas modifiée.
10. [T] **Mesuré le 16/10** dans un vrai Grist (labo grist-static 0.1.6, Chromium, panneau 700 × 400, V0.3 du prototype ;
    `run-modules.mjs` et `run-reconstruit.mjs`). Lire ne crée rien : sans geste, ni table ni page de plus. Le premier geste
    d'installation pose la question (le nom de la table, qu'elle vaut pour tout le document, qu'une page s'ajoute) ; Échap,
    « Annuler » ou un clic hors de la fenêtre la refusent : la case revient, aucune table ni page n'est créée, la personne en est
    avertie, et la question se repose au geste suivant. Accord donné : `AddTable` rend `{ id, table_id, columns, views }` (GFS
    relit l'identifiant dans `table_id`), la table a ses sept colonnes, **Grist ajoute une page pour elle**, et la ligne
    réservée est écrite par `AddRecord`. Les gestes suivants ne posent plus de question et écrivent par `UpdateRecord` après une
    relecture de la ligne. Le cadre de GFS rechargé retrouve les apps installées, n'ouvre pas la fenêtre tout seul et ne récrit
    rien ; reconstruit avec la section, il retrouve la table. Un document en lecture seule, ou un accès du widget inférieur à
    `full`, grise les cases avec la raison (`run-modules.mjs` avec `LAB_READONLY=1`, `run-acces-none.mjs`). Une table
    `GFS_Rangement` plus ancienne, sans la colonne `Valeur` (`run-rangement.mjs`) : aucune question, `AddColumn` ajoute la
    colonne avant l'écriture, la ligne d'un autre auteur n'est pas touchée, aucune page de plus ; une app et un champ que cette
    version ne connaît pas restent dans `Valeur` après un geste (6.5, point 4) ; ce qu'une autre section a écrit entre deux
    gestes n'est pas défait, la ligne étant relue avant chaque écriture.
    [M] Non mesuré : une écriture que refuse une règle d'accès de Grist (le labo n'en pose pas) ; le test unitaire la couvre
    contre un port qui refuse, pas contre Grist.

---

## 8. Ce que le contrat demande à chaque app

Relevé du 14/10, pour que le projet de chaque app relise ce qui le touche (cahier 11) ; le détail est dans le guide des apps.

| App | À changer ou à déclarer |
|---|---|
| Publipostage+ | Déclarer les sept lectures de `_grist_*` et ses deux écritures (`visibleCol` de `_grist_Tables_column` ; `indentation`, `pagePos` et `options` de `_grist_Pages`), le jeton en lecture seule, les formules ; lire l'adresse du widget (`isOwnWidget`), l'instance et le document dans le contexte (`fixBaseUrl`, `documentKey`) ; ranger ses clés `pp_*` dans le stockage du kit ; garde `source` avant le script d'API ; garde « type inconnu » (guide 2.2) ; graphique en extension, sans Plotly dans sa liste ni son import map (sa CSP garde l'adresse du CDN, 2.6 point 4), avec `bibliotheques` dans l'entrée de l'extension (2.6) |
| Form+ | Cesser d'écrire `_grist_Views_section.options` (marqueur `formplusDuplicate`, réglages : `poc/js/grist-meta.js` lignes 191, 270, 290) : une table `FormPlus_…` ; déclarer `structure` (`CreateViewSection`), la lecture de cinq tables internes et les écritures qu'il fait : `shareOptions` de `_grist_Views_section`, `parentId`, `colRef` et `widgetOptions` de `_grist_Views_section_field` (avec `retire`, pour les champs que Grist ajoute tout seuls), `visibleCol` de `_grist_Tables_column` ; ne plus lire `_grist_Shares` (`findExistingShareKey` : la clé se colle) ; prendre la page et l'instance dans le contexte ; ses clés de réglages passent d'un `setOptions` de tout l'objet à une tranche déclarée |
| Automation+ | Clé `workflow` déclarée en attendant que le graphe passe dans une table `Automation_…` ; lit et écrit des tables de la personne (`*`) ; section à part dans GFS (cahier, question 4) |
| Grist-BI | Déclarer la lecture de `_grist_Tables` et `_grist_Tables_column` ; préfixe `BI_` (`BI_Dashboard_Config`, `BI_StressTest`, `BI_Dashboard_Comments`) ; ses `RenameTable` visent des tables qu'il possède déjà, ou que `ecrit` couvre |

---

## 9. À mesurer au prototype (étape 2)

Dans un vrai Grist (labo `outils/labo-grist-reel/`), avec Publipostage+ et Automation+ non modifiés. Les dix points du cahier
(section 9) restent ; ce document en précise ou ajoute. Résultats du 14/10 : `prototype/rapport.md` ; ils entrent dans ce
document en petits commits, les points 8 (cadre qui navigue, politique imposable) et 11 (bibliothèque d'extension) d'abord :

1. **Rejeu à la reprise** (4.2) : une app qui démarre après GFS apprend sa table et ses réglages (`getTable`, `onRecords`,
   `onOptions`, `themeInitialized`).
2. **`configure` absorbé** (4.3) : `grist.ready()` de l'app ne change rien à l'accès de la section ; `hasCustomOptions` de GFS
   reste vrai.
3. **Impression** (4.3) : remplacer le `print` du script d'API de GFS par un relais vers l'app active.
4. **Ordre des écouteurs** (1.2) : le mesurer aussi dans Firefox et WebKit.
5. **Jeton depuis un sous-cadre opaque** (cahier 9, point 6) par le courtier : `getAccessToken` relayé, téléchargement d'une pièce
   jointe par l'adresse rendue.
6. **Noms normalisés** (3.3, point 4) : `AddTable` d'un nom normalisé vers `GFS_`, contrôle de l'identifiant rendu, retrait
   de la table créée ; relecture de `_grist_Tables` après `RenameTable`.
7. **Liste des verbes, tables internes interdites et `ApplyUAOptions`** (3.3) contre l'instance visée
   (`grist.numerique.gouv.fr`) : le code lu est celui de la branche principale.
8. **Cadre qui navigue** (1.4, point 3) et politique imposable au sous-cadre (3.7, point 4).
9. **Coût de la lecture des tables de fichiers** (2.4) dans un document lourd.
10. **Cadre reconstruit** (3.1, point 6) : GFS repart, l'app aussi, sans perte, comme seule.
11. **Bibliothèque d'extension** (2.6, 5.2) : Plotly reçu de GFS par adresse et empreinte dans un sous-cadre isolé, en CDN comme
    en vendorisé ; la CSP du sous-cadre qui l'autorise sans que le dépôt de l'app le nomme (GitHub Pages n'impose aucun en-tête
    à un sous-cadre, 3.7 point 4) ; le graphique qui tourne avec cette bibliothèque (`Plotly.toImage`). **Mesuré le 14/10** :
    en CDN la CSP de l'app doit nommer l'adresse du catalogue, la copie de GFS passe sans rien nommer (2.6 point 4, 5.2 point 5).
12. **Table du document** (6.4, 7.4) : création de `GFS_Rangement` avec l'accord de la personne, écriture et relecture de la ligne
    `apps`, refus de l'accord, écriture refusée par Grist. **Mesuré le 16/10** avec la V0.3 du prototype (7.4 point 10), sauf
    l'écriture refusée par une règle d'accès de Grist.
13. **La table d'un direct** (5.5) : prévenance, relais et relecture d'une table qui n'est pas celle de la section. **Mesuré le
    16/10** dans le labo, sans réseau (5.5, point 2) ; à refaire sur un Grist en ligne (5.5, point 6).
14. **Un fichier assemblé en cadre isolé** (2.6, points 8 à 11 ; 5.2) : chargé par empreinte, rangé sous `GfsPaquets`, deux
    éditeurs de l'app synchronisés. **Mesuré le 16/10** hors Grist, dans un cadre isolé (faits vérifiés, 9) ; à refaire avec le
    vrai fichier de GFS, dans un sous-cadre de GFS du labo, quand l'outil l'aura construit.

## 10. Laissé aux étapes suivantes

- **Étape 3 (kit)** : où vit la table-sonde de l'identité quand le kit la partage ; liste des icônes (`icone`) ; le texte commun
  du grisé et la fenêtre d'installation.
- **Étape 5 (apps)** : quota de stockage d'après `pp_schema_…` ; le contenu de chaque `gfs.json` ; la sortie de `_grist_*` pour
  Form+.
- **Étape 6 (GFS v0)** : le rangement propre à une app dans l'explorateur ; « Fermer quand même » ; « Recharger » ; la
  fenêtre d'installation qui montre `pourquoi`.
- **Étape 7 (extensions et nouvelles apps)** : le déroulement d'« insérer » (deux sous-cadres), la taille du rendu ; le
  mappage de colonnes pour une app qui en demanderait ; qui fait suivre un renommage de colonne aux modèles d'un type
  d'extension (le socle ne réécrit jamais un type inconnu, guide 2.2 ; relire le schéma ne montre pas le renommage, dont les
  anciens noms ne sont que dans l'instantané de l'app, `pp_schema_…`), à fixer avec la première extension de modèle.
- **Une fois GFS v0 publié** : le numéro de contrat passe à 1, et le tableau des changements du contrat s'ouvre dans ce document.
