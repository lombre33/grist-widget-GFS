# Contrats de GFS (version 0)

Version 0 du 14 octobre 2026. Étape 1 du plan (cahier, section 10) : aucun code n'est écrit. Ce document met au propre la
section 5 du cahier (`cahier-des-charges-gfs.md`) à partir des faits vérifiés (`faits-verifies.md`) et d'un relevé fait le
14/10 dans le code de Grist (branche principale de `grist-core`) et dans quatre apps : Publipostage+ (`e4a239c`), Form+
(`b073d03`), Automation+ (`ee8f0a9`) et Grist-BI (`c8c819f`). Il attend la relecture du porteur : sa réponse (go ou
changements) ferme l'étape 1. La section 11, les permissions des personnes, s'y est ajoutée le 22/10 (version 0).

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
   jeton d'accès, les formules, la structure des pages (sections 2 et 3). Une déclaration de plus ne contourne rien : `identite`
   donne l'adresse e-mail de la personne aux seules apps qui la demandent (3.4, point 6 ; 5.2, point 9).
3. **Listes fermées, tenues par GFS** : les verbes d'écriture que le courtier laisse passer ; sept tables internes
   (règles d'accès, partages, rappels, réglages du document) qu'aucune app n'écrit, quoi qu'elle déclare ; la colonne
   `options` de `_grist_Views_section`, qui porte l'adresse et l'accès de chaque widget, GFS compris (section 3).
4. **Messages propres à GFS** (contexte, stockage, barre, ambiance, correcteurs, actions « ouvrir », « choisir », « ranger », « joindre », « insérer », « installer », « fermer ») :
   une enveloppe à part, sans `mtype`, que le script d'API de Grist ignore (sections 4 et 5).
5. **Installer ne télécharge rien** : le code de toutes les apps livrées est déjà dans le site de GFS ; installer inscrit
   l'identifiant de l'app dans une table du document (sections 6.4 et 7.4). La bibliothèque d'une extension n'est pas dans
   l'app : GFS la porte et donne sa source (2.6, 5.2).
6. **Réglages de la vue** : une tranche par app, mêmes clés seule ou dans GFS ; les clés de GFS commencent par `gfs.`.
   **Question 9, tranchée le 16/10** : les apps installées se retiennent dans une table du document, `GFS_Rangement`
   (section 7.4) ; l'installation s'enregistre tout de suite, sans « Enregistrer ». **Décision du porteur, 03/11** : dans GFS, les
   réglages d'une app s'écrivent aussi dans la vue sans « Enregistrer » : GFS les écrit lui-même et le dit à l'app (7.3, points 4 à 6).
7. **Ce qu'un filtre de tables ne peut pas garantir** est écrit en toutes lettres (section 3.7).
8. **À mesurer à l'étape 2** : liste en section 9.
9. **Les permissions des personnes** (section 11, version 0 du 22/10) : seul Grist arrête une personne, par les règles d'accès
   qu'un propriétaire pose ; deux zones (les tables de données restent à Grist, celles de GFS et des apps sont encadrées) ; trois
   niveaux (Ouvert, Partagé, Encadré) ; un responsable d'espace entre le propriétaire et l'éditeur ; chaque app déclare la
   classe de ses tables (`classes`, 11.2). Rien n'est codé ; la structure du document reste une carte ouverte du porteur.

## Ce qui change par rapport au brouillon du cahier (à relire en premier)

1. **Le courtier ne renumérote pas : il tient deux conversations** (cahier 4.3, « Renuméroter »). Même effet, aucune
   collision de numéros d'appel, sans table de correspondance ni message recopié (1.1, point 3).
2. **Le filtre ferme davantage** que « tables lisibles, tables modifiables, `_grist_*` sur déclaration » : verbes d'écriture
   en liste fermée ; tables internes déclarées par table et par colonne ; sept tables internes et une colonne jamais écrites
   par une app ; trois capacités à déclarer (`jeton`, `formules`, `structure`) (section 3).
3. **Les lectures de tables internes se déclarent aussi** (`gristInterne`) : Publipostage+ en lit huit (la huitième, `_grist_DocInfo`,
   depuis le 21/10), Grist-BI deux. Le
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
    jusqu'à « Enregistrer » (sauf dans GFS depuis le 03/11 : point 18).
14. **Une bibliothèque d'extension peut être un fichier assemblé par GFS** (décision du porteur, 16/10, sur la demande d'écriture
    en direct de Publipostage+) : plusieurs paquets npm dans un seul module, qui laisse en noms nus les bibliothèques natives de
    l'app (2.6, points 8 à 11 ; 5.2, points 4 et 5). Sans lui, le curseur des autres disparaît sans erreur.
15. **La table d'un direct n'est pas prévenue par Grist** : seule la table de la section l'est. GFS ne promet pas de canal plus
    rapide que la table ; il fixe le rythme de la relecture et donne ce qu'elle coûte, mesuré (5.5).
16. **Les permissions des personnes ont leur section** (11, 22/10) : le brouillon du cahier ne parlait que du filtre des apps (3).
    Le manifeste gagne `classes` (2.2, 11.2), le contexte gagne `role` (5.2, point 8), et les règles de Grist que GFS posera sont
    écrites (11.4). La sonde de l'adresse a sa règle sous « Partagé » (6.4, point 9), mesurée.
17. **« Importer » est `ouvrir` avec le fichier que la personne a choisi** (décision du porteur, 22/10, « Nouveau > Importer ») : comme
    « Nouveau » (point 8), aucune action de plus. Le manifeste gagne `actions.importer` (2.7, point 4), l'ouverture gagne `importation`
    (5.2, point 3) et GFS ouvre lui-même le sélecteur de fichier (5.4, point 1). Mesuré avec une app d'essai : le `File` arrive lisible
    dans le cadre isolé.
18. **Les réglages d'une app s'écrivent dans la vue, sans « Enregistrer »** (décision du porteur, 03/11, « GFS l'écrit dans la vue ») :
    le courtier écrit lui-même les réglages de la section au lieu du brouillon de Grist, retrouve sa section par son adresse et sa
    table, dit à l'app que c'est fait (événement `reglages`, 5.1) et se replie sur le brouillon quand il ne peut pas (7.3, points 4 à 6).
    Le contexte ne donne pas la page : sur une instance ordinaire `page` vaut `null` (5.2 ; faits vérifiés, 18).

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
   rien de plus à GFS ; les ajouter à `frame-src` de GFS serait l'autre voie, à confirmer à l'étape 6. [M] Plein écran (demande de
   Publipostage+ du 21/10) : `fullscreen` ajouté à `allow` du seul sous-cadre ne change rien (« Disallowed by permissions
   policy »), pas plus que dans le seul cadre de Grist ; le navigateur le veut dans chaque cadre au-dessus de l'app, celui que
   Grist donne à GFS compris, qui n'a que `clipboard-write`. Avec les deux ajoutés (labo seulement, `run-capacites.mjs`,
   `CAP_CONFIG=pleinDeux`), la demande aboutit. GFS n'ajoute donc rien tant que Grist ne laisse pas passer le plein écran ; le jour
   où il le fait, c'est un mot de plus dans `allow`. [Rapporté] (Publipostage+, 24/10, un banc à trois sites, Firefox 128 ESR, 140 ESR et 158 et Chromium 153 ;
   non remesuré par GFS) : sous Firefox, `fullscreen` seul ne suffit pas pour un sous-cadre d'origine nulle ; le mot à poser serait `fullscreen *` (ou
   `allowfullscreen`) dans le `allow` du sous-cadre de GFS, avec `fullscreen` toujours sur le cadre de Grist. [M] Avec l'interrupteur « Plein écran » du menu ▾ de « Présenter » de Publipostage+
   (`4dfcd0c`, mesuré le 22/10 avec `865afa3` : `run-barre-ecartee`, partie `presenter`) : dans GFS le cadre de l'app dit que le plein
   écran n'est pas permis (`document.fullscreenEnabled` faux), la ligne est grisée avec sa raison, un clic dessus ne change rien
   et le diaporama prend le panneau. [M] **Fenêtre à part** (Publipostage+ à `b9184cf`, mesuré le 27/10 : `run-barre-ecartee`, partie `presenter`, et `run-capacites`, essais
   `fenetre`) : `window.open`, appelé dans le geste depuis le sous-cadre, ouvre la fenêtre (`allow-popups`) ; elle **hérite du bac à sable** (origine nulle, stockage refusé),
   **garde `window.opener` et le nom demandé**, donne le plein écran au premier clic et se ferme par un bouton de sa page. GFS n'ajoute ni `allow-popups-to-escape-sandbox` ni
   `noopener`. Cela vaut pour un Grist ordinaire : celui du labo (grist-static) ajoute `credentialless` à son cadre, ce qui, sous Chromium, coupe l'ouvreur et le nom (faits vérifiés 1) ;
   Firefox ne connaît pas cet attribut. Une instance qui l'ajouterait ôterait l'ouvreur à toute fenêtre d'une app : une app qui ouvre une fenêtre garde donc un repli pour
   `window.open` qui rend `null`. [M] **Firefox 140 (Windows), la page d'essai du porteur, 23/10** (`labo/essais-navigateur/`,
   faits vérifiés 11) : (a) un fichier fabriqué dans un cadre (adresse `blob:` ou `data:`, ancre `download`) n'est pas enregistré
   tant que `frame-src` de la page qui porte le cadre ne le nomme pas, cadre isolé ou non ; Chromium ne regarde pas `frame-src`
   pour un téléchargement. **GFS ajoute `blob:` à son `frame-src`**, pour cette seule raison (les exports de Publipostage+,
   `downloadBlob`) : `index.html`, contrôlé par `test/csp.test.mjs` ; l'export Word dans GFS sous Firefox reste à confirmer par le
   porteur. (b) **Sur le PC du travail du porteur (Firefox 140), LanguageTool ne travaille dans aucun cadre à origine opaque** (23/10 et
   27/10 : le cadre isolé comme celui de GFS, à un ou deux niveaux, au nom du site comme au nom avec le point final) **et travaille dans
   un cadre isolé qui garde sa vraie origine** (`allow-same-origin`) quand elle n'est pas celle de la page qui le porte (cadre P3 du
   27/10 : origine `https://lombre33.github.io.`, aucune lecture de la page porteuse ; faits vérifiés 11). [M] **Sur son PC de la maison
   (Firefox 158, 23/10, 21 h 17 et 21 h 50) il travaille dans tous les cadres essayés, le réglage actuel de GFS compris** : GFS n'a rien
   à changer pour lui. L'écart entre les deux postes tenait à la version de Firefox : au travail, LanguageTool fonctionne dans GFS tel quel
   depuis la mise à jour de Firefox (28/10, rapporté par le porteur, version d'arrivée non donnée). Le nom avec le point final ne rend donc
   pas LanguageTool à lui seul : il donne au cadre une origine qui n'est ni celle de GFS ni celle de Grist, et c'est la vraie origine qui
   compte au travail. **Le porteur a tranché le 28/10 de ne donner d'adresse propre à aucune app** (carte du 28/10) : l'isolement reste tel
   quel, sans `allow-same-origin`. Une app à part serait un cas particulier (sur GitHub Pages, le nom à point final ne donne qu'une adresse
   de plus, et la copie figée livrée à un client resterait isolée) ; Firefox 158 refuse de nommer ce nom dans `frame-src`, donc GFS devrait
   ouvrir cette règle à tout `https:` ; et la séparation entre GFS et l'app tiendrait à l'écriture du nom du site, non plus au bac à sable.
   Une extension du navigateur peut donc manquer dans le cadre d'une app, selon la version du navigateur (LanguageTool 11.3.1 au travail,
   la dernière version publiée : absent sous Firefox 140, présent après la mise à jour de Firefox, 28/10 ; faits vérifiés 11).
   [M] Safari : la page de mesure du porteur (`labo/navigateur/`).
2. [T] **L'adresse du sous-cadre est calculée par GFS**, d'après le catalogue et le manifeste livrés avec lui ; elle n'est jamais lue
   dans un réglage, une table ou un message (cahier 3.2, point 3). Deux formes, selon `live` dans l'adresse du widget :
   - **le site en ligne de l'app** (le défaut des essais, décision du porteur du 22/10 : « servir les dépôts live, pas une copie
     figée ») : `/<site>/<entree>` à la racine de l'origine de GFS, `<site>` étant la ligne `site` du catalogue (le site GitHub
     Pages du dépôt de développement de l'app : `publipostageGrist/`, `GRIST_automation/`, `FormPlus/`) et `<entree>` celle du
     manifeste (`index.html`, `poc/widget.html`). GitHub Pages sert tous les sites d'un compte sur la même origine (faits vérifiés,
     section 5) : `frame-src 'self'` les laisse passer, **la CSP de GFS ne change pas** ; si GFS et une app étaient un jour sur
     deux comptes, cette ligne devrait nommer l'autre origine, et ce serait un choix fait en connaissance de cause. Ce que l'app
     pousse est ce que la personne ouvre, au cache de Pages près (10 minutes).
   - **la copie figée** (`live=0`, et le repli ci-dessous) : `apps/<id>/<entree>` sur le site de GFS, le sous-module à la référence
     que GFS a relue. C'est ce que mesure le labo (`startLab`, `live: false` par défaut), et ce que GFS livrera à un client.
   Un site en ligne qui n'a pas dit `ready` au bout de 15 secondes (1.4, point 2) : GFS ouvre la copie figée dans le même cadre et le
   dit (« {app} : la dernière version ne répond pas, GFS ouvre sa copie figée. »). `data-app-source` du corps de la page de GFS
   vaut `live` ou `pinned` (les essais le lisent). Mesuré : `run-live.mjs`.
3. [T] Elle porte les six paramètres que Grist ajoute à l'adresse d'un widget (`access`, `readonly`, `language`, `culture`,
   `timeZone`, `currency` : `WidgetFrame.ts`, `_urlWithAccess`), **avec les mêmes noms**, les valeurs de GFS, sauf `access` :
   le niveau de l'**app** (3.1), et `language` : la langue que la personne a choisie dans GFS (`fr` ou `en`, 5.2 point 6),
   ou à défaut celle de Grist, telle qu'elle est quand le cadre est créé. Publipostage+ lit `readonly` dans son adresse
   (`isReadOnlyAddress`). S'y ajoute `gfs=<n>` (le numéro de contrat de GFS) : c'est ainsi qu'une app sait, tout de suite,
   qu'elle est hébergée. **Et, seulement quand la personne l'a choisi, `copie=<fonction>[,<fonction>]`** (11/11) : les fonctions de
   bibliothèques natives dont la copie figée est rangée dans l'app (l'éditeur : 2.6, point 14). Une page qui doit choisir sa carte
   d'importation avant que GFS ait répondu ne peut pas attendre le contexte : le choix est dans l'adresse. Sans choix, le paramètre
   n'y est pas (l'adresse d'avant) ; le kit le lit par `GfsLink.copies()`.

### 1.4 Un sous-cadre à la fois

1. [D] Un seul sous-cadre est relié à Grist. L'explorateur le masque sans le débrancher. Ouvrir un fichier d'une autre app
   le détruit après « fermer » (5.4), puis en crée un neuf. L'action « insérer » (étape 7) en gardera deux, dont un suspendu :
   le contrat se complète alors. **Décidé le 02/11 (porteur, par le projet de Tuesday)** : Automation+ pourra tourner caché derrière
   l'app active, dès que le document a au moins une automatisation (cahier, section 2 et section 12, ligne 4) ; ce sera un second
   sous-cadre, relié à Grist lui aussi, que le courtier devra servir en même temps que l'app active. Le contrat se complète à l'étape 6.
2. [D] Un sous-cadre qui n'a pas dit `ready` au bout de 15 secondes est signalé à la personne (« l'app ne répond pas »), avec
   « Recharger ». Durée à confirmer à l'étape 6. Pour un site en ligne (1.3, point 2), la première échéance ouvre d'abord la copie
   figée ; « ne répond pas » vient si elle tarde aussi.
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
| `arrivee` | objet | non | Où GFS lit, dans une table du document, que la section est celle de l'app quand la vue n'a aucun réglage : `{ table, colonne, lignes }` (2.5, point 4). |
| `reglagesArrivee` | liste | non | Celles des clés de `reglages` dont une valeur fait s'ouvrir l'app à l'arrivée ; sans elle, toutes les clés de `reglages` comptent (2.5, point 5). |
| `permissions` | objet | oui | Accès, tables, tables internes, capacités (section 3). |
| `extensions` | liste | non | Les extensions de l'app (2.6). |
| `dependances` | chaîne | non | Chemin de la liste des bibliothèques **natives** de l'app (`package.json`) : celles d'une extension n'y figurent pas (2.6, point 4). |
| `natives` | liste | non | Les bibliothèques natives de l'app **rangées par fonction**, pour le choix « CDN ou copie figée » : `[ { "id", "nom": { "fr", "en" }, "bibliotheques": [ { "id", "version" } ] } ]` (2.6, point 14 ; 5.2, point 12). Une bibliothèque n'est que dans une fonction, sa version est exacte. L'app le déclare quand elle lit le choix ; sans `natives`, rien n'est proposé et l'app reste au CDN. Une fonction dont la copie figée est **dans le dépôt de l'app** (l'éditeur) s'écrit `{ "id", "nom", "copieDansApp": true, "poids": <octets> }`, sans `bibliotheques`. |
| `actions` | objet | non | Ce que l'app accepte de la part des autres (2.7). |
| `ouverture` | objet | non | Ce que l'app sait faire d'une ouverture que GFS lui passe : `{ "fichier": true, "nouveau": true, "importer": true, "lire": true }` (5.2, point 3 ; 5.4, points 1 et 8). Un genre absent vaut faux : GFS ouvre alors l'app sur son modèle habituel et le dit, et grise « Importer » ou « Lire ». |
| `permanente` | booléen | non | `true` : l'app ne se retire pas de la fenêtre « Apps et extensions » (Publipostage+). |
| `classes` | objet | non | La classe de chaque table de l'app pour les règles des personnes (11.2) ; une table non déclarée est du travail courant. |

Un champ inconnu est ignoré (le contrat s'étend par ajout) ; un champ obligatoire absent ou mal formé invalide le manifeste.

*Le 09/11, `ouverture` et `permanente` remplacent deux listes écrites par nom d'app dans le contrôleur de GFS (`ACCEPTS_OPEN` et `ALWAYS_ON`, provisoires depuis l'étape 2) : plus bas, `ACCEPTS_OPEN.<app>.<genre>` se lit `ouverture.<genre>` du manifeste de l'app. Les quatre manifestes sont encore tenus par GFS (`manifestes/`) ; quand une app publie son propre `gfs.json`, elle déclare ces deux champs elle-même.*

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
| `types` | Liste de `{ valeur, nom: { fr, en }, icone, couleur, extension }`. `couleur` : `document`, `grille`, `presentation` ou `pdf` (les quatre du cahier 6.5), sinon neutre. `icone` : identifiant d'une icône du kit [D]. `extension` : l'extension qui possède ce type (absente : le socle). |
| `exclure` | `{ "<colonne>": [valeurs] }` : lignes que l'explorateur ignore (les lignes réservées, comme `reglages`). |
| `rangement` | Le rangement propre à l'app (3.1 point 7 du cahier), s'il y en a un : `{ table, utilisateur, fichier, dossier, epingle }`, des noms de colonnes. L'explorateur le lit comme point de départ et n'y écrit jamais (6.4, point 8). |
| `corbeille` | `{ date, par }` : les deux colonnes où GFS marque un fichier mis à la corbeille (la date en secondes comme Grist la rend, la personne), facultatif (décision du porteur du 04/11). Une ligne dont `date` est positive n'est plus listée dans l'explorateur mais dans sa vue « Corbeille », avec son dossier et son rangement. **Seule la table que GFS écrit lui-même en a** (`GFS_Fichiers`, 6.6, point 10) : aucune app ne déclare ces colonnes, GFS n'en ajoute à aucune table d'app. |
| `suppression` | `{ ligne: true, uniques, exclusives, remettre, appel }` : comment GFS retire et remet un fichier de cette table depuis l'explorateur (la corbeille des fichiers d'une app, décision du porteur du 04/11), facultatif. `ligne: true` (le seul mode) : un fichier est une ligne de la table, la retirer le supprime et la remettre le restaure. `uniques` : colonnes dont la valeur désigne un fichier (un jeton) : si une ligne de la table la porte déjà, il n'y a rien à restaurer. `exclusives` : colonnes booléennes qu'une seule ligne peut porter (« le modèle par défaut ») : le fichier restauré ne la reprend pas si une autre ligne l'a. `remettre` : `{ colonne: valeur }` posées à la restauration à la place des valeurs gardées. `appel: true` : le fichier tient à plus qu'une ligne (un formulaire, sa section, son lien public : Form+) ; avant de retirer la ligne, GFS demande à l'app ouverte de fermer ce qui y est lié (l'appel `supprimer`, 5.4, point 10), et grise le geste tant que cette app n'est pas ouverte. Sans recette, « Mettre à la corbeille » est grisé pour les fichiers de cette table et un clic dit pourquoi. **Une app seule, sans GFS, garde sa propre gestion de ses fichiers** : seul GFS lit cette recette (6.7). |
| `copie` | `{ ligne: true, uniques, exclusives, valeurs, appel }` : comment GFS copie un fichier de cette table depuis l'explorateur (« Dupliquer », Ctrl+C puis Ctrl+V ; décision du porteur du 04/11), facultatif. `ligne: true` (le seul mode) : un fichier est une ligne de la table, le copier, c'est ajouter une ligne qui a les mêmes valeurs. `uniques` : colonnes dont la valeur désigne un fichier (un jeton) : la copie les a vides (l'app lui en donne un quand elle en a besoin). `exclusives` : colonnes booléennes qu'une seule ligne peut porter (« le modèle par défaut ») : la copie ne la porte pas. `valeurs` : `{ colonne: valeur }` posées à la place de celles de l'original (elles passent en dernier : l'app décide). Le nom de la copie est le premier nom libre (« Contrat (1) ») ; la date et l'auteur restent ceux de l'original (le contenu est le même : l'app les met à jour quand elle enregistre) ; les pièces jointes restent **citées** par les deux lignes (rien n'est envoyé : Grist garde une pièce tant qu'une cellule la cite). `appel: true` (seul, sans `ligne`, il suffit) : le fichier tient à plus qu'une ligne ; c'est l'app ouverte qui le copie (l'appel `dupliquer`, 5.4, point 11) sous le nom que GFS a calculé, et GFS n'écrit rien dans la table. Sans recette, « Dupliquer » est grisé pour les fichiers de cette table et un clic dit où le faire. **Une app seule, sans GFS, garde sa propre gestion de ses fichiers** : seul GFS lit cette recette. |
| `poids` | `{ pieces: { colonne, taille }, liees: [{ table, colonne, fichier }] }` : ce que pèse un fichier de cette table en plus de sa ligne (le poids dans l'explorateur, demande du porteur du 04/11), facultatif. `pieces` : le fichier EST une pièce jointe (un PDF de GFS) ; `colonne` est la colonne de pièces jointes, `taille` celle qui dit sa taille en octets. Le poids du fichier est celui de sa ligne plus cette taille, et deux fichiers qui citent la même pièce (une copie) ne la comptent qu'une fois dans une somme. `liees` : des lignes d'une AUTRE table de l'app (son préfixe, comme `table`) qui suivent le fichier, par une clé (les versions d'un modèle de Publipostage+) ; `table` est cette table, `colonne` la colonne qui porte la clé dans la table liée, `fichier` la colonne du fichier qui porte la même clé. Le poids du fichier compte, en plus, les octets de toutes les lignes liées dont la clé est la sienne ; une clé vide ne rattache rien ; une table liée absente ou illisible ne compte rien (GFS le dit dans la console) ; deux fichiers de même clé (une copie qui n'aurait pas vidé la sienne) ne comptent ces lignes qu'une fois dans une somme. **Les tables que GFS écrit lui-même (`GFS_Fichiers`) ont `pieces` ; une app déclare `liees` dans le manifeste que GFS garde d'elle**, jamais `pieces` : ses lignes pèsent ce que leurs cellules pèsent (les pièces jointes qu'une ligne d'app cite ne sont pas comptées avec elle). |

1. [T] L'identifiant d'un fichier est la valeur de `colonnes.id`, prise comme texte (pour Publipostage+, le numéro de ligne).
2. [T] GFS lit la table entière (l'API de Grist n'a pas de projection par colonne), ne garde que les colonnes déclarées, et n'y
   écrit que le nom d'un fichier que la personne renomme dans l'explorateur (6.3, point 2). Une colonne déclarée mais absente
   de la table se lit comme vide : un document ancien n'a pas toutes les colonnes. Coût mesuré à l'étape 2 dans un document
   lourd (Publipostage+ y range le contenu des modèles : 118 modèles, environ 20 Mo) : l'explorateur est prêt 2,7 s après le
   démarrage (première lecture 2,9 s), puis 0,2 à 1,6 s ; Grist ne sait pas lire une partie d'une table, donc la lecture prend
   toute la table.
3. [T] Un fichier dont le type n'est pas dans `types` est listé grisé, jamais ouvert (section 6.5).
4. [T] **`suppression` est ce que l'app dit, pas ce que GFS devine.** GFS ne retire jamais la ligne d'un fichier d'une app sans recette déclarée, et ne retire que la ligne du fichier : ce que l'app garde ailleurs (les fils de commentaires, le rangement propre, les choix d'export, souvent accrochés au numéro de ligne) reste en place, et GFS restaure la ligne **au même numéro** quand il est libre, pour que tout se raccroche. Ce qui est accroché au fichier par une autre clé (l'historique des versions de Publipostage+, rangé par `Jeton`) n'est pas suivi par la recette `ligne` : l'app qui le purge comme orphelin le perd (6.7, point 6). Un fichier qui tient à plus qu'une ligne (un formulaire, sa section et son lien public, comme Form+) déclare `appel: true` : la recette n'écrit pas à la place de l'app, elle demande à l'app ouverte de fermer ce qui est lié avant que GFS retire la ligne (5.4, point 10). **La même règle vaut pour `copie`** : GFS n'ajoute jamais la ligne d'un fichier d'une app sans recette déclarée, n'écrit que les colonnes de données que Grist rend (jamais une formule, jamais une colonne absente : une seule action en échec annule tout le lot), et ce que l'app accroche à l'original par une autre clé (l'historique des versions de Publipostage+, rangé par `Jeton`) n'est pas copié : la copie a un jeton vide, donc son propre historique, à venir. Ce qui renvoie à la même ligne source (les règles « Tables liées » d'un modèle) est repris tel quel.

5. [T] **Le poids est une estimation, jamais ce que Grist compte pour sa limite.** Le poids d'un fichier est la somme des octets de ses cellules telles que GFS les a lues (texte en UTF-8, entier de 1 à 8 octets, flottant 8, booléen 1, rien 0 ; toutes les colonnes de la table, déclarées ou non, sauf l'identifiant et le rang), plus, pour un fichier qui est une pièce jointe, la taille de la pièce (`poids.pieces`). Un dossier pèse la somme de ses fichiers, sous-dossiers compris ; le pied de fenêtre, celle de ce que la liste montre ; une pièce citée par plusieurs fichiers n'y compte qu'une fois.
   À la corbeille, un fichier d'app pèse sa ligne de `GFS_Corbeille` (6.7), dont la copie JSON de la ligne fait presque tout. L'estimation ne compte ni l'historique des actions de Grist ni les pages libres du fichier : sur un vrai Grist 1.7.19, elle est à 0,1 % de l'octet exact pour de gros textes (les modèles) et de 16 à 47 % en dessous pour de toutes petites lignes, jamais au-dessus (faits vérifiés, 32). Rien n'est écrit dans le document : le poids se recalcule à chaque lecture. Le total du site, lui, n'est pas lisible depuis un widget.
   La case « + pièces jointes » du pied de fenêtre ajoute au total **les pièces jointes du document qu'aucun fichier de l'explorateur ne cite** (vivants ou à la corbeille) : GFS lit alors `_grist_Attachments` par son port (accès complet), une seule fois par cochage et par relecture des fichiers, et compte, comme Grist, une pièce par `fileIdent` distinct, sans les lignes dont `timeDeleted` n'est pas vide, à la plus grande taille (une pièce que plus aucune cellule ne cite compte jusqu'au passage de Grist, toutes les heures). Elle ne dépend pas de la vue, n'est pas retenue d'une ouverture à l'autre et n'écrit rien ; sans accès complet, ou si la lecture échoue, elle est grisée et dit pourquoi (faits vérifiés, 39).
   **La fenêtre « Poids du document »** (lot 4) : le total du pied est un bouton (arrêt de Tab, `aria-haspopup="dialog"`) ; un clic ouvre une fenêtre qui dit d'abord ce que la liste montre (l'estimation ci-dessus, avec les pièces jointes si
   la case est cochée), puis ce que Grist garde, lu dans sa base (6.6, point 14) : le fichier entier, les tables (somme), les pièces jointes (stockées, et comptées par Grist), l'historique des modifications, le reste (pages libres, index et
   tables internes de Grist) ; enfin chaque table avec son poids exact, **du plus lourd au plus léger, lues l'une après l'autre** (Grist coupe une lecture de plus d'une seconde). Rien n'est écrit ni gardé : tout se relit à chaque ouverture, et
   fermer la fenêtre arrête la lecture. Une table que Grist coupe dit « trop longue » sans retenir les autres. **Sans le droit de tout copier** (403) ou si Grist ne répond pas, la fenêtre reste, grisée, avec la raison ; l'estimation reste. Elle ne
   donne aucun « x % de 15 Go » : le total du site n'est pas lisible depuis un widget, et ce que compte la limite (les pièces jointes de tous les documents, ou les fichiers entiers) n'est pas connu ; les deux chiffres sont dans la fenêtre (faits vérifiés, 43).
   Les lignes liées (`poids.liees`) sont lues avec les fichiers, à chaque ouverture de l'explorateur et à chaque relecture, par `fetchTable` de la table liée (une seule fois par déclaration, jamais une lecture par fichier) : leur coût est celui de la table (Publipostage+ plafonne ses versions à 3 Mo pour tout le document : moins de 0,4 s de plus à l'ouverture, dans le bruit de la mesure, faits vérifiés, 41). À la corbeille, l'entrée d'un fichier pèse sa ligne de `GFS_Corbeille` seule : ses lignes liées restent dans leur table, et l'app décide de les garder ou de les retirer (6.7, point 6).
   **Dans un document lourd, les relectures ne lisent plus les cellules lourdes.** Quand une lecture complète a compté 4 Mo de fichiers ou plus (`js/explorer/explorer-sql.js`), les retours à l'explorateur qui suivent demandent à Grist, par une lecture SQL **en lecture seule** (la route de la fenêtre « Poids du document »), les seules colonnes que le manifeste déclare plus les octets des autres, en une lecture de la structure puis une lecture par table lancées ensemble : un modèle de 500 Ko n'est plus relu pour afficher son nom. Les fichiers et leurs poids sont ceux de la lecture complète, à l'octet près. Un document léger ne change pas (la première lecture d'une session est toujours complète) ; **sans le droit de tout copier (403, un document à règles d'accès), au moindre refus ou serveur muet, la lecture légère s'éteint pour la session** et la lecture complète reprend, sans jeton qui peut écrire (faits vérifiés, 86).

### 2.5 Les réglages

1. [T] `reglages` liste les clés de la tranche de l'app. Un réglage garde ce qui se refait en un clic, jamais une définition
   (cahier 5.5).
2. [T] Une clé n'est pas déclarée par deux apps du catalogue (l'outil d'envoi le vérifie) et ne commence pas par `gfs.`. Si deux
   apps existantes portaient la même clé, le cas se décide avec le porteur.
3. [T] Les clés existantes sont gardées telles quelles ; toute clé nouvelle porte le préfixe de son app (Publipostage+ : `pp_`).
4. [T] **`arrivee`** (facultatif) : une app qui range de quoi rouvrir sa vue dans une table du document, et non dans les réglages de la
   vue (Automation+ 0.15.0 : son graphe est la ligne `Workflow` de la table `Automation`, et elle n'écrit plus la clé `workflow` quand
   la table existe), le dit ainsi : `{ "table": "Automation", "colonne": "Table", "lignes": { "Type": "Workflow" } }`. `table` est une
   table que l'app lit (`permissions.lit`) ; `colonne`, celle de ses colonnes qui dit la table de la vue ; `lignes` (facultatif), les
   valeurs que doit porter la ligne (des textes, comparés tels quels, `Type` = `Workflow` : un `Log` ou un `Lock` ne désigne pas la
   vue). GFS ne s'en sert qu'à l'arrivée, aux conditions de 7.4, point 7 ; il ne fait que comparer, il ne lit jamais une valeur comme
   du code ni comme une adresse. L'app qui garde aussi une clé de réglage (`reglages`) reste reconnue par elle d'abord.
5. [T] **`reglagesArrivee`** (facultatif, décidé par le porteur le 12/11) : parmi les clés de `reglages`, celles dont **une valeur dit à GFS d'ouvrir l'app à
   l'arrivée** (7.4, point 7). Une clé de `reglages` qui n'y est pas se lit, s'écrit et se retire comme les autres, mais ne désigne pas l'app : une vue qui n'a
   que celle-là arrive sur l'explorateur, et non sur la page de départ de l'app. Publipostage+ : `["modeleDeLaVue", "modeleSelonLigne"]` (un modèle choisi pour la
   vue, ou une règle qui en choisit un selon la ligne) ; ses droits d'accès, la colonne de la date du dernier export et celle des pièces jointes (`droitsAcces`,
   `dateDernierExport`, `pp_attach_column`, `pp_attach_mode`) ne disent pas quoi ouvrir. Sans `reglagesArrivee`, toutes les clés de `reglages` comptent (Automation+ :
   `workflow`). Chaque entrée est une clé de `reglages` de la même app (le manifeste est refusé sinon) ; une liste vide : aucune clé ne fait ouvrir l'app.

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
   Ni adresse, ni empreinte, ni mode : elles sont à GFS. Une extension peut en exiger plusieurs : `graphique` exige depuis le
   03/11 `plotly` 2.13.2 (l'import des graphiques de Grist) **et** `echarts` 6.1.0 (Apache-2.0, le moteur des graphiques que l'app
   crée, « Créer un graphique… » ; demande de Publipostage+ du 02/11, réponse : consigne 042). Les deux suivent le même mode, CDN ou copie de GFS, et
   l'extension n'est servie que si le catalogue les a toutes : sans ECharts, « graphique » reste grisée avec ce qui manque, jamais
   servie à moitié.
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
     "cdn": { "src": "https://cdn.jsdelivr.net/gh/<propriétaire>/<dépôt>@<commit complet>/prototype/vendor/edition-live/1.0.0/edition-live.js",
              "integrite": "sha384-…" },
     "vendorise": { "chemin": "vendor/edition-live/1.0.0/edition-live.js", "integrite": "sha384-…" } }
   ```

   L'app ne nomme toujours aucun de ces paquets dans sa liste ni dans sa carte d'importation (point 4) ; elle garde, comme avant,
   les `externes`, qui sont ses bibliothèques natives. Une entrée sans `forme` est un script classique (Plotly).
9. [D] **Le fichier se range sous une clé de GFS.** Chargé, il pose `globalThis.GfsPaquets[id] = { version, modules }`, où
   `modules` associe à chaque paquet npm de `modules` son espace de noms (`modules['yjs']` vaut `import * as … from 'yjs'`) :
   l'extension prend ce qu'elle veut sous les noms qu'elle connaît déjà. Le fichier ne pose rien d'autre sur la fenêtre, à une exception
   près, quand un paquet ne tourne pas sans : celui de pdf.js pose aussi `globalThis.pdfjsWorker` (point 12).
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
11. [T] **Le CDN d'un fichier assemblé est jsDelivr, qui sert le dépôt public de GFS à un commit épinglé** (cahier, question 5 ;
    choix du porteur, 16/10 pour la copie de GFS d'abord, 19/10 pour le CDN). Un fichier assemblé n'est le fichier d'aucun paquet npm :
    jsDelivr le sert depuis le dépôt de GFS, octet pour octet, à l'adresse
    `https://cdn.jsdelivr.net/gh/<propriétaire>/<dépôt>@<commit>/<dossier de GFS>vendor/<id>/<version>/<id>.js`. La liste de GFS dit où
    (`gfs.publication` de `bibliotheques/package.json` : `depot`, `commit`, `racine`, le dossier de GFS dans le dépôt, `prototype/`).
    **Le commit est complet** (40 chiffres hexadécimaux, jamais une branche ni une étiquette, qui bougent sous l'empreinte) et **porte
    exactement la copie vendorisée** : l'outil le lit dans git, sans réseau (`--verifier` le contrôle ; l'adresse ne s'écrit pas sinon),
    puis `--catalogue` écrit `cdn: { src, integrite }` avec la même empreinte que la copie. La copie se commite donc d'abord, puis
    son commit entre dans la liste : le commit épinglé précède celui du catalogue. Le catalogue refuse à son tour une adresse `/gh/` qui
    ne nomme pas un commit complet (`js/apps/libraries.js`). jsDelivr n'est joignable ni du cloud ni du labo : `--verifier-cdn` (réseau, sur
    une machine qui y accède) compare au CDN réel les octets, l'en-tête CORS et le type JavaScript, sans quoi un module à empreinte est
    refusé dans un sous-cadre à origine opaque.
    **Les apps nomment l'adresse exacte dans leur CSP**, comme pour Plotly (consigne 007) : sans elle, le navigateur de l'app refuse le
    CDN ; la copie de GFS passe avec `'self'`, sans rien nommer (5.2, point 5). L'adresse change avec le commit épinglé et avec le dépôt
    (le dépôt public définitif de GFS aura la sienne, question 5) : chaque changement est une consigne aux apps. Sans `gfs.publication`
    (un GFS sans dépôt public, une copie d'essai), l'entrée porte `cdn: null` : la copie de GFS est alors le seul mode, la fenêtre
    « Apps et extensions » ne propose pas le CDN pour cette bibliothèque et le dit.
    [M] **Mesuré le 19/10 avec Publipostage+** (la version que GFS référence, `da919fc` ; `run-edition.mjs`, à 700 × 400, à la vraie
    souris et au vrai clavier, en français / clair et en anglais / sombre) : par défaut (« Depuis un CDN », rien d'écrit dans le
    document), l'app reçoit l'adresse jsDelivr et l'empreinte du catalogue ; **tant que sa CSP ne nomme pas cette adresse, le
    navigateur refuse le script** (`script-src-elem`, à l'adresse exacte), l'app dit « Écriture en direct impossible » avec la raison, la
    ligne reste grisée pour réessayer, rien n'est posé et aucune table n'est créée, et le choix de « Copie de GFS » remet le direct en
    marche au clic suivant ; **avec l'adresse dans sa CSP** (la page servie à l'essai seulement), le direct démarre par le CDN comme
    par la copie (un seul `<script type="module" integrity crossorigin="anonymous">`, aucun refus, les cinq modules, la table du
    direct née puis vidée à l'arrêt) ; **avec une fausse empreinte du CDN**, la CSP laisse passer et le navigateur refuse le fichier.
    Le labo n'atteint pas jsDelivr : à l'adresse du CDN, son miroir rend les octets exacts de la copie de GFS, avec l'en-tête CORS et
    le type JavaScript que `--verifier-cdn` contrôle sur le vrai CDN. [M]
12. [D] **Une bibliothèque sans CDN, même quand GFS a un dépôt public** (`sansCdn: true` dans `gfs.bibliotheques.<id>.assemble`, 03/11 ;
    la première est pdf.js). L'outil ne calcule alors aucune adresse pour elle : l'entrée porte `cdn: null` (point 11, dernière
    phrase), la copie de GFS est son seul mode, et la fenêtre « Apps et extensions » grise l'option CDN avec sa raison. **Pourquoi** :
    l'adresse d'un fichier assemblé dépend du commit épinglé (`gfs.publication.commit`), le même pour tous les fichiers assemblés ;
    le déplacer changerait l'adresse d'`edition-live` que la CSP de Publipostage+ nomme déjà (consignes 016 et 021 : elle ne bouge
    pas jusqu'à la bascule vers le dépôt public définitif). Une bibliothèque de plus ne doit pas obliger une app à changer sa CSP :
    en copie, `'self'` suffit (5.2, point 5). À la bascule, une seule consigne donnera toutes les adresses et retirera `sansCdn`.
    L'outil et ses tests le contrôlent (`--verifier` : l'entrée n'a pas de CDN, le catalogue publié est celui que la liste donne).
    **pdf.js** (`pdfjs` 1.0.0, demande de lecture des PDF, 03/11) contient `pdfjs-dist` 6.5.438 (Apache-2.0, sa licence est recopiée
    dans `vendor/pdfjs/1.0.0/LICENCES.txt`), `modules` `pdfjs-dist/build/pdf.min.mjs` (`getDocument`, `TextLayer`) et
    `pdfjs-dist/build/pdf.worker.min.mjs`, `externes` vide, 1,64 Mo. Un sous-cadre à origine opaque ne peut pas créer de vrai `Worker`
    (`SecurityError`, faits vérifiés, 19) : pdf.js retombe sur son « faux Worker », qui exécute le moteur dans la page et le cherche dans
    `globalThis.pdfjsWorker` avant tout `import()`. Le fichier assemblé contient le moteur et le pose lui-même en se chargeant : aucune
    adresse de plus, aucun `import()`, rien à nommer dans la CSP de l'app. **L'extension passe `verbosity: 0`** (sans quoi pdf.js
    écrit « Setting up fake worker. » en console à chaque document) **et `isEvalSupported: false`** (aucune CSP d'app n'accepte
    `unsafe-eval`). **Limites** : les polices standard, les CMap et le décodeur JPEG 2000 (wasm) sont des fichiers à part que le
    paquet ne met pas dans le fichier assemblé : un PDF qui en dépend s'affiche avec les polices de repli, ou sans l'image ; un PDF
    scanné, sans texte, n'a pas de couche de texte ; la lecture se fait dans la page, donc une page très lourde fige l'interface
    quelques dixièmes de seconde (mesuré à 0,16 s au plus, faits vérifiés, 19).
13. [D] **La licence suit chaque copie vendorisée** (03/11, avec ECharts). L'outil pose `vendor/<id>/<version>/LICENCES.txt` à côté de toute
    copie : le texte de la licence de chaque paquet contenu et, quand le paquet livre un fichier `NOTICE`, son texte à la suite (la
    licence Apache 2.0, article 4 d, veut que la copie redistribuée porte les deux ; ECharts en livre un). Un paquet sans fichier de
    licence, ou sans licence déclarée, ne se vendorise pas : l'outil s'arrête en le disant. `--verifier` contrôle que ce fichier est
    là et nomme chaque paquet de la copie (Plotly en a un depuis cette date).

14. [D] **Les copies figées des bibliothèques natives d'une app, chez GFS** (choix du porteur, 11/11 : « chez GFS, comme pour Plotly » ; étude
    `docs/etude-cdn-ou-copie.md`). La liste de l'app dit toujours quelles bibliothèques elle emploie (point 4, confirmé le 14/10) ; GFS en
    garde en plus une copie figée, que le porteur peut choisir à la place du CDN, fonction par fonction (fenêtre « Apps et
    extensions », 7.3, point 3 ; ce que l'app reçoit : 5.2, point 12). Dans la liste de GFS, une telle entrée porte `natifDe` (l'id de l'app) et la même forme que les autres (`paquet`, `fichier`) ;
    **sa version suit celle de l'app, jamais celle de Dependabot** (`.github/dependabot.yml` les ignore, un essai de `test/hygiene.test.mjs`
    le garde) : l'app monte sa version, le dit dans « Changements qui touchent GFS » de sa page d'état, et GFS réécrit sa copie dans le lot
    qui lit la demande. Le catalogue donne à chacune la copie (`vendorise`) et, comme pour toute entrée de paquet npm, l'adresse jsDelivr du
    même fichier (`cdn`) ; **une app ne reçoit jamais cette adresse** : son CDN, en mode CDN, est le sien (celui que sa CSP nomme déjà), la
    copie de GFS passe par `'self'`. Publipostage+ en a neuf (`docx`, `docx-charts`, `exceljs`, `jszip`, `marked`, `pdf-lib`, `pdfmake`,
    `pdfmake-polices`, `qrcode-generator`), 5,0 Mo de plus dans `vendor/`. **Deux licences que l'outil ne lisait pas** : JSZip livre
    `LICENSE.markdown` (le nom est maintenant reconnu) ; `qrcode-generator` ne livre aucun fichier de licence, l'avis MIT est l'en-tête de
    `qrcode.js` : la liste le dit (`licenceDansLeFichier: true`), l'outil vérifie que l'en-tête nomme la licence que le paquet déclare et le
    dit dans `LICENCES.txt`. **L'éditeur (TipTap, ProseMirror) est le seul morceau dont la copie est dans le dépôt de l'app** (choix du porteur,
    11/11 : « dans le dépôt de Publipostage+ ») : sa « copie » n'est pas un fichier mais une carte d'importation, que la page pose au démarrage
    (Firefox n'en prend qu'une : faits vérifiés 88), et la copie de l'app ne nomme jamais GFS dans sa politique : ses adresses sont relatives,
    `'self'` suffit. L'outil du kit 0.20.0 la fabrique dans le dépôt de l'app (`--copies`, section `gfs.copie` de sa liste) et tient la page : deux cartes
    d'importation en données et un script qui pose l'une des deux (faits vérifiés 98). GFS ne la sert pas : la fonction `editeur` du manifeste est `copieDansApp` (2.2), la fenêtre n'y vérifie rien (jamais
    grisée), le choix se retient comme les autres (`natif:editeur`) et part **dans l'adresse du cadre** (`copie=editeur`, 1.3 point 3), à
    son démarrage. **Il prend effet au prochain démarrage de l'app** : GFS ne recharge rien en cours de route (rien à perdre), la ligne le dit. [M]

### 2.7 Les actions acceptées

```json
{
  "actions": {
    "ouvrir":  ["document", "grille", "email", "macro"],
    "choisir": ["document", "grille"],
    "importer": [
      { "valeur": "excel", "type": "grille", "nom": { "fr": "Excel", "en": "Excel" }, "extensions": [".xlsx", ".xlsm"] }
    ],
    "lire": [ { "type": "pdf", "extension": "lecture-pdf" } ],
    "ranger": ["pdf"],
    "inserer": { "produit": [], "recoit": [] }
  }
}
```

1. [T] `ouvrir` : les types de fichiers que l'app sait ouvrir.
2. [T] `choisir` : les types de **ses** fichiers qu'une autre app peut faire choisir (l'explorateur en mode choix les montre). Un type qui n'a
   pas de sens hors de l'app n'y figure pas (Publipostage+ : document, grille et présentation, ni l'e-mail ni la macro). [D] Un type
   offert à choisir figure aussi dans `ouvrir` : un lien vers un type que l'app ne sait pas ouvrir est refusé (`GFS_REFUSE`, 5.4, point 7).
3. [D] `inserer` : `produit` liste les rendus portables que l'app sait fournir, `recoit` ceux qu'elle sait accepter ; vides tant
   que l'étape 7 n'a pas écrit le déroulement (5.4).
4. [D] `importer` (facultatif ; décision du porteur du 22/10, « Nouveau > Importer ») : les formats de fichier d'un autre logiciel
   (un classeur Excel, un Markdown, un PowerPoint) que l'app sait lire pour en faire un modèle vierge. GFS en fait le sous-menu
   « Importer » du menu « Nouveau » de l'explorateur : un article par format, au nom du format (`nom`), que suivent le type qu'il crée
   (`type`, un type de `actions.ouvrir`) et l'app quand il y en a plusieurs. `valeur` nomme le format auprès de l'app (une chaîne
   qui ne se répète pas dans la liste) ; `extensions` sont les terminaisons que le sélecteur de fichier propose et que GFS contrôle
   avant d'ouvrir l'app. Sans `importer`, l'app n'a pas d'article. Le déroulement est en 5.4, point 1.
5. [D] `lire` (facultatif ; demande du porteur du 03/11, « lire un PDF dans le mode Lecture de Publipostage+ ») : les types de fichiers
   **que GFS garde** (6.6 ; aujourd'hui `pdf`) que l'app sait lire. Une entrée `{ type, extension? }` : `type` est le type du fichier
   (un mot en minuscules, comme `pdf`) ; `extension` est l'identifiant d'une extension de l'app (déclarée dans `extensions`) qui apporte
   la lecture : sans elle, c'est le socle de l'app qui lit. GFS en fait le geste principal d'un fichier gardé : « Lire » à la place de
   « Télécharger », qui reste dans le menu de la ligne ; quand aucune app du catalogue ne lit le type, le fichier se télécharge comme
   avant (6.6, point 7). Plusieurs apps peuvent lire un même type : la première qui est prête sert, sinon la première déclarée dit
   ce qui manque. Le déroulement est en 5.4, point 8. L'app ne reçoit jamais le droit d'écrire ce que GFS garde.
6. [D] `ranger` (facultatif ; demande du porteur du 03/11, « les exports en PDF de Publipostage+ vont se ranger parmi les fichiers ») :
   les types de fichiers **que GFS garde** (6.6 ; aujourd'hui `pdf`) que l'app sait lui donner à ranger après les avoir fabriqués.
   Une liste de mots en minuscules (comme le `type` de `lire`), `["pdf"]`. Sans cette déclaration, l'appel `ranger` de l'app est
   refusé (`GFS_REFUSE`, 5.4, point 9) : GFS ne range que pour une app qui l'a dit. L'app ne reçoit jamais le droit d'écrire ce que
   GFS garde : elle donne le fichier et son nom, GFS seul l'écrit. Le déroulement est en 5.4, point 9.
7. [D] `joindre` (facultatif ; demande du porteur du 06/11, « enregistrer le PDF généré en pièce jointe dans la ligne Grist », **« GFS joint
   lui-même » choisi le même jour**) : les types de fichiers que l'app sait donner à GFS pour qu'il les joigne à la cellule « Pièces
   jointes » d'une ligne de ses tables (aujourd'hui `pdf`). Une liste de mots en minuscules, `["pdf"]`. Sans cette déclaration, l'appel
   `joindre` est refusé (`GFS_REFUSE`, 5.4, point 12). **L'app ne reçoit aucun jeton d'écriture pour cela** (`permissions.jeton` reste en
   lecture seule, 3.4, point 1) : elle donne les octets, GFS seul les envoie à Grist et écrit la cellule. Le déroulement est en 5.4, point 12.

### 2.8 Validation

1. [D] L'outil d'envoi de GFS valide chaque manifeste à la construction ; GFS le revalide au chargement. Une erreur de la
   liste suivante invalide le manifeste :
   - un champ obligatoire absent ou d'un autre type ; un `id` ou un préfixe hors format, déjà pris, ou égal à `GFS_` ;
   - `fichiers[].table` hors du préfixe ; une colonne de `colonnes` qui n'est pas une chaîne ;
   - une clé de `reglages` qui commence par `gfs.` ou que le catalogue donne à une autre app ;
   - `reglagesArrivee` (2.5, point 5) : autre chose qu'une liste de chaînes, une entrée qui n'est pas une clé de `reglages` de la même app ;
   - dans `ouverture` : autre chose qu'un objet, un genre (`fichier`, `nouveau`, `importer`, `lire`) qui n'est pas un booléen ; `permanente` qui n'est pas un booléen ;
   - dans `arrivee` (2.5, point 4) : autre chose qu'un objet, une `table` ou une `colonne` qui n'est pas une chaîne, une `table` que
     `permissions.lit` ne couvre pas, des `lignes` qui ne sont pas un objet de chaînes ;
   - dans `permissions` : une règle de la section 3 non tenue (un motif `ecrit` que `lit` ne couvre pas, un `pourquoi` absent,
     une table ou une colonne de la liste fermée 3.3, une entrée `gristInterne` qui lit `_grist_Shares` ou `_grist_Triggers`,
     qui écrit sans `lit: true` ou qui écrit plus d'une table, `lit`/`ecrit`/`gristInterne`/capacités avec un accès autre que
     `full`) ; dans `permissions.lienPublic` (3.4, point 5) : un `pourquoi` sans français ou sans anglais, une liste de motifs absente
     ou vide, un motif hors du préfixe de l'app, qui couvre toutes ses tables (`FormPlus_*`) ou la table de ses fichiers ou de son
     rangement ; dans `permissions.identite` (3.4, point 6) : un `pourquoi` absent, sans français ou sans anglais ; dans `permissions.lecteurs` (3.4, point 7) : un `pourquoi`
     absent, sans français ou sans anglais, des `fournisseurs` absents, vides, hors de `youtube` et `vimeo` ou en double ;
   - une extension dont le `dossier` sort de l'app, ou dont une entrée de `bibliotheques` n'a pas d'`id` ou n'a pas une
     `version` exacte (un intervalle, `latest`) ;
   - dans `actions.importer` (2.7, point 4) : une entrée sans `valeur` ou sans `nom` en français et en anglais, une `valeur` déjà
     prise, un `type` qui n'est pas dans `actions.ouvrir`, des `extensions` qui ne sont pas une liste non vide de terminaisons (un
     point, puis un à huit caractères ou chiffres : `.xlsx`) ;
   - dans `actions.lire` (2.7, point 5) : une entrée qui n'est pas un objet ou dont le `type` n'est pas un mot en minuscules (une
     lettre, puis des lettres, des chiffres ou des tirets, 24 signes au plus), un `type` déclaré deux fois, une `extension` qui n'est
     pas déclarée dans `extensions` ;
   - dans `actions.ranger` (2.7, point 6) : une valeur qui n'est pas une liste, une entrée qui n'est pas un mot en minuscules (la règle
     du `type` de `lire`), un type déclaré deux fois ;
   - dans `actions.joindre` (2.7, point 7) : les mêmes règles que `actions.ranger` ;
   - dans `classes` (11.2) : une table hors du préfixe de l'app, une classe inconnue, un champ de la classe absent (`personne`
     pour `personnel`, les quatre rôles de `etiquette` pour `reserve`, `de` et `lien` pour `derivee`), une table `derivee` dont
     `de` n'est pas une table `reserve`, un `secrets` qui n'est pas une liste de noms de colonnes.

### 2.9 Exemple : Publipostage+

D'après son code du 14/10 (`e4a239c`). Les sept tables internes qu'il lit viennent de `chart-source.js`, `schema-renames.js`,
`page-tree.js`, `grist-api.js` et `settings-columns.js` ; les deux qu'il écrit, de `template-pack.js` (`visibleCol` de
`_grist_Tables_column`) et de `page-tree.js` (`indentation`, `pagePos` et `options` de `_grist_Pages`). Une entrée qui écrit
nomme une seule table et porte aussi `lit: true` (3.3, point 5). Depuis le 21/10, une huitième lecture : `_grist_DocInfo`, pour
la langue et la devise du document (demande de l'app, `32822d6`) ; elle ne s'écrit jamais (3.3, point 6). Depuis le 22/10,
`actions.importer` déclare les imports que l'app fait par son menu « + » (`js/main.js` : `onImportXlsx`, `onImportMd`,
`onImportPptx`) : Excel (une grille), Markdown (un document) et PowerPoint (une présentation, le type de l'extension
« Diapositives », absent de cet exemple, qui n'en montre que les deux premiers). GFS grise les formats d'une app qui ne sait pas encore recevoir
le fichier de lui, avec « Pas encore » (5.4, point 1) ; Publipostage+ le sait depuis sa consigne 035 (`d76430c`, 23/10).

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
          "fr": "Retrouver les sections de la page et leurs filtres pour proposer un graphique du document, et pour que l'export en lot et la Boucle suivent la vue liée par « Sélectionner par ».",
          "en": "Find the page's sections and their filters to offer a chart of the document, and so that the batch export and the loop follow the view linked by “Select by”."
        }
      },
      {
        "tables": ["_grist_DocInfo"],
        "lit": true,
        "pourquoi": {
          "fr": "Connaître la langue et la devise du document pour écrire un nombre ou une date comme sa colonne dans Grist.",
          "en": "Know the document's language and currency to write a number or a date as its column does in Grist."
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
    "importer": [
      { "valeur": "excel", "type": "grille", "nom": { "fr": "Excel", "en": "Excel" }, "extensions": [".xlsx", ".xlsm"] },
      { "valeur": "markdown", "type": "document", "nom": { "fr": "Markdown", "en": "Markdown" }, "extensions": [".md", ".markdown", ".mdown", ".mkd", ".txt"] }
    ],
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
   sous-cadres. Une app doit donc pouvoir être rechargée à tout moment sans perte, comme seule. Ajouter une section à la page le
   fait aussi (mesuré le 19/10, faits vérifiés 2, `run-section-ajoutee.mjs`, avec ou sans GFS : c'est Grist qui recharge le cadre) ;
   GFS ne peut pas le garder en place.

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
   - `_grist_Shares` : les partages publics (**exception : la capacité `partage`**, 3.4 point 8, qui ne laisse faire que la recette du bouton « Publier » de Grist) ;
   - `_grist_Triggers` : les déclencheurs de rappels vers l'extérieur (webhooks) : les modifier change ce qui sort du
     document ;
   - `_grist_DocInfo` : les réglages du document ;
   - la colonne `options` de `_grist_Views_section`, sur n'importe quelle ligne : elle contient `customView`, donc l'adresse et
     l'accès de chaque widget, GFS compris. Une app qui l'écrirait pourrait remplacer GFS par un autre code, avec l'accès
     de son choix, et ce changement survivrait à son retrait ;
   - la colonne `shareRef` de `_grist_Pages` : elle lie une page à un partage, donc ouvre au public les formulaires publiés de la
     page (point 9). Une app peut la lire ; la poser ou la changer est un geste de la personne, dans Grist, **ou celui d'une app qui déclare `partage`**
     (3.4, point 8), dans la seule forme et aux seules conditions de ce point.
7. [D] Du deuxième argument de `applyUserActions`, le courtier ne transmet que `desc` et `parseStrings` [M : relire
   `ApplyUAOptions` dans l'instance visée].
8. [T] En **lecture seule** (`readonly=true` dans l'adresse de GFS), toute écriture est refusée sans appeler Grist
   (`GFS_LECTURE_SEULE`), réglages compris (cahier 3.1, point 10).
9. [D] **Publier un formulaire demande l'accord de la personne** (décision du porteur du 22/10 : « Form+ et GFS »). Le lien d'un
   formulaire publié (une section dont `shareOptions` porte `publish` et `form`, sur une page partagée) ouvre à qui l'a, sans passer
   par GFS : **l'ajout de lignes** dans la table de chaque formulaire publié de la page, dans toutes ses colonnes (celles que le
   formulaire ne montre pas, celles qu'on ajoutera ensuite), et **la lecture de toutes les lignes** de la colonne affichée
   (`visibleCol`) de la table que vise chaque Référence de leurs champs, champs cachés compris ; rien d'autre (3.7, point 8). Le
   courtier ne laisse donc rien s'ouvrir sans elle :
   - un lot qui écrit `_grist_Tables_column`, `_grist_Views_section` ou `_grist_Views_section_field` est rejoué sur une copie de leurs
     lignes (et de celles de `_grist_Tables`, qu'il lit), avant et après ; la différence est ce que le lot ouvre **de nouveau**, sans
     regarder si une page est partagée (un drapeau posé aujourd'hui ouvre dès qu'elle l'est, et la personne peut la partager sans GFS) :
     une table de plus ouverte à l'ajout (avec ses colonnes que le formulaire ne montre pas), une colonne de plus lue ;
   - **avant même de demander**, le courtier refuse (`GFS_REFUSE`, avec la raison, sans fenêtre) d'ouvrir à l'ajout une table de GFS,
     d'une autre app ou de l'app qui publie, d'ouvrir à la lecture une table de GFS ou d'une autre app, et ce que le manifeste de
     l'app ne lui laisserait pas écrire (ou lire) elle-même (11.9, point 4c). **Parmi les tables de l'app qui publie, un lien public ne lit
     que les petites tables que son manifeste déclare** (`permissions.lienPublic`, 3.4 point 5 ; choix du porteur du 03/11) : la lecture de
     toute autre table de l'app est refusée sans fenêtre, la table qui garde la définition et la clé de partage de tous les formulaires
     (Form+ : `FormPlus_Formulaires`) en tête ; celle d'une petite table déclarée (Form+ : `FormPlus_Pub_<vsId>`, la définition d'UN
     formulaire) passe par l'accord. Les classes protégées de 11.2 et le propriétaire seul (11.9, points 4c et 7) viendront avec la
     section 11 : GFS ne connaît pas encore le rôle de la personne ;
   - s'il y a une différence, la personne en décide dans une fenêtre de GFS qui dit, dans cet ordre (11.9, point 6) : que le lien est
     public (toute personne qui l'a, sans compte), les tables qu'il remplit (avec les colonnes que le formulaire ne montre pas mais que
     le lien pourra remplir), les colonnes qu'il rend lisibles, que rien ne limite le nombre de lignes ni ne contrôle ce qu'elles
     contiennent, comment le fermer (« Dépublier » le formulaire, dans Grist) ; le clavier y part sur « Refuser » ; « Refuser » ou Échap
     (un clic à côté ne ferme rien, décidé le 09/11) : `GFS_ANNULE`, rien n'est envoyé à Grist ; « Autoriser » : le lot passe ;
   - ce qui est déjà ouvert ne se redemande pas ; les lots qui publient passent **un par un** par session (le suivant est jugé sur un
     document où le précédent est posé) ; un lot qui ne touche pas ces trois tables ne coûte aucune lecture ;
   - **GFS échoue fermé** : une session sans moyen de demander, une structure illisible, un verbe que le courtier ne sait pas juger
     sur ces trois tables (`AddOrUpdateRecord`, `BulkAddOrUpdateRecord`, une forme `Bulk…` sans les valeurs attendues) refusent le lot
     (`GFS_REFUSE`).
   [M] Mesuré le 22/10, à 700 × 400, à la vraie souris et au vrai clavier, en français / clair, anglais / sombre, français / sombre et
   anglais / clair : `run-publication.mjs` (30 vérifications : la fenêtre et ce qu'elle dit, les trois refus par souris, Entrée et
   Échap, l'accord, le lot rejoué sans fenêtre, le champ Référence ajouté à une section publiée, la deuxième section sur la même table
   sans fenêtre, une autre table, trois tables protégées refusées sans fenêtre, un verbe refusé) et `run-form.mjs` avec Form+ non
   modifiée à `c249c4a` (son enregistrement par le lien ouvre deux fenêtres : la table des réponses à l'ajout, puis la lecture de
   `FormPlus_Formulaires.Definition` ; le second formulaire, aucune). **Non mesuré** : ce que Grist ouvre vraiment à qui a le lien,
   grist-static n'a pas de partages (faits vérifiés 10.11 ; la mesure est celle de Form+, sur un vrai Grist, et les six mesures du porteur).

### 3.4 Les capacités à déclarer

Trois capacités contournent un filtre de tables. L'app les déclare, avec une raison en français et en anglais ; GFS les montre
à la personne dans la fenêtre d'installation, en mots simples. Quatre déclarations de plus se font de la même façon : `lienPublic` resserre un filtre (point 5),
`identite` donne une donnée que GFS seul sait (point 6), `lecteurs` fait poser par GFS un lecteur de vidéo par-dessus le cadre de l'app (point 7), et `partage` lève,
dans une forme très étroite, deux des interdictions de 3.3 point 6 (point 8).

1. [D] **`jeton`** : `{ "lectureSeule": true, "pourquoi": { … } }`. Sans elle, `getAccessToken` est refusé. Avec elle, le
   courtier force `readOnly: true` sauf `lectureSeule: false`, et transmet `route` tel quel. Un jeton ouvre l'API REST sur
   tout ce que la personne peut lire dans le document, donc au-delà de `lit` (3.7).
2. [D] **`formules`** : `{ "pourquoi": { … } }`. Sans elle, le courtier refuse toute colonne qui porte une formule
   (`formula` non vide, qu'`isFormula` soit vrai ou non : une formule déclenchée s'exécute aussi), dans `AddColumn`,
   `AddVisibleColumn`, `AddHiddenColumn` et les colonnes d'`AddTable`, ainsi que `SetDisplayFormula`. [M] **Mesuré le 22/10 avec Form+ à `c249c4a`**
   (`run-form.mjs`) : son mode interne pose `FormPlus_Repondants` et sa colonne `Email`, une formule déclenchée `user.Email` ; sans la
   capacité, le courtier la refusait (« Une colonne à formule demande la capacité « formules » ») ; avec elle, déclarée dans le manifeste
   de l'app, la table et la colonne naissent, sans refus. [M] **Automation+ la déclare depuis le 09/11** (décision du porteur, carte « Remplir la colonne Auteur du journal ? ») : sa colonne `Auteur` du journal est une formule déclenchée `user.Email` posée à la création de sa table ; mesuré avec la vraie app dans un vrai Grist (`labo/run-auteur-automation.mjs`, faits vérifiés 63) : la table naît avec la formule et Grist y met l'adresse de la personne du moment, sans que l'app écrive d'auteur ni que GFS lui donne l'adresse (`identite` reste non déclarée). Une table créée avant la déclaration garde sa colonne sans formule.
3. [D] **`structure`** : `{ "pourquoi": { … } }`. Sans elle, les verbes de la classe « Structure » du tableau 3.3
   (`CreateViewSection` en v0) sont refusés : une app qui crée des sections change les pages de la personne.
4. [D] **Les entrées de `gristInterne`** ont la forme `{ "tables": [ … ], "lit": true, "ecrit": [ "colonne", … ], "retire": true,
   "pourquoi": { "fr": "…", "en": "…" } }`. `tables` et `pourquoi` sont obligatoires ; `lit`, `ecrit` et `retire` sont
   facultatifs, au moins un des trois. Une entrée qui écrit (`ecrit` ou `retire`) nomme une seule table et porte aussi
   `lit: true` (3.3, point 5). Le `pourquoi` est montré à la personne comme celui des capacités. [M] **Form+ (09/11, demande de sa page d'état)** :
   `{ tables: ["_grist_Views"], lit: true, ecrit: ["name"] }` pour renommer la page qu'un `CreateViewSection` vient de créer (Grist l'appelle « New page »
   et la range tout en bas) en « Formulaire <table> » ; le nom seulement, un seul `UpdateRecord` dans son propre lot (un refus n'arrête rien : l'app garde « New page » et le dit). Mesuré avec
   la vraie Form+ (faits vérifiés 65).
5. [T] **`lienPublic`** : `{ "lit": [ "FormPlus_Pub_*" ], "pourquoi": { "fr": "…", "en": "…" } }`. Pas une capacité qui contourne un filtre :
   une déclaration qui en **resserre** un. Elle nomme les tables **de l'app** qu'un lien public, celui d'un formulaire que l'app publie,
   peut lire si la personne y consent (3.3, point 9 ; 11.9, point 4c) ; **sans elle, aucune table de l'app n'est lisible par un lien
   public**. Chaque motif est un nom de table ou un préfixe suivi de « * » (comme 3.2), écrit sans accent, **dans le préfixe de l'app** et
   plus précis que lui (`FormPlus_*` couvre toutes ses tables : refusé), et il ne couvre **jamais** la table de ses fichiers
   (`fichiers[].table`) ni celle de son rangement (`rangement.table`) : le validateur de manifeste (2.8) le contrôle, un manifeste qui s'y
   refuse est invalide (2.1, point 3). « * » seul ne désigne pas les tables de l'app. Elle demande `acces: full` comme le reste. Le `pourquoi`
   est montré à la personne comme celui des capacités. Form+ : `["FormPlus_Pub_*"]`, la petite table d'une ligne de CHAQUE formulaire (la
   définition de ce formulaire seul, consigne 013). Codé le 03/11 (`js/broker/filter.js` : `publiclyReadable` ; `js/broker/publication.js` : `whyNot` ;
   `js/apps/manifest.js` : `checkPublicLink`).
6. [T] **`identite`** : `{ "pourquoi": { "fr": "…", "en": "…" } }`. Pas une capacité qui contourne un filtre : elle ouvre une
   donnée que GFS seul sait, l'adresse e-mail de la personne qui a le document ouvert (5.2, point 9). Choix du porteur du 03/11
   (« Aux apps qui le déclarent ») : GFS ne la donne **qu'aux apps qui la déclarent**, chacune disant pourquoi en français et en
   anglais ; la fenêtre d'installation montre cette raison comme celle des autres capacités, et un client peut lister les apps
   qui reçoivent l'adresse (`node outils/capacites.mjs --identite` ; sans filtre, toutes les capacités déclarées, avec leur
   raison). Sans la déclaration, `contexte.identite` vaut `null` et aucun événement n'est envoyé : l'app ne peut pas savoir si
   GFS connaît la personne. Elle ne demande pas `acces: full` : l'adresse ne passe par aucune table de l'app. Le validateur
   (2.8) exige le `pourquoi` en deux langues. Codé le 03/11 (`js/apps/manifest.js` : `checkCapabilities`, `listCapabilities` ;
   `js/broker/filter.js` : `makePolicy` ; `js/broker/context.js` : `identityFor`).
7. [T] **`lecteurs`** : `{ "fournisseurs": [ "youtube", "vimeo" ], "pourquoi": { "fr": "…", "en": "…" } }`. Pas une capacité qui contourne un filtre : elle
   fait **poser par GFS, par-dessus le cadre de l'app, le lecteur d'une vidéo** que l'app ne peut pas jouer elle-même (le bac à sable d'une app donne
   l'origine « null » à tout cadre qu'elle contient, et un lecteur de YouTube ou de Vimeo y échoue : faits vérifiés 50). Demande de Slides+ (Publipostage+, 06/11),
   étude `docs/etude-lecteur-video.md`, **choix du porteur du 07/11, « Politique élargie »** : la politique de sécurité de GFS nomme les deux sites dans `frame-src`
   (`https://www.youtube-nocookie.com` et `https://player.vimeo.com`, pas un de plus ; `blob:` s'y ajoutait déjà, 1.3) et le cadre du lecteur est posé directement dans
   la page de GFS, sans page relais. `fournisseurs` est une liste non vide de sites que GFS sait jouer (`youtube`, `vimeo`), sans doublon ; un nom inconnu ou un doublon
   invalide le manifeste (2.8). Le `pourquoi` est montré à la personne comme celui des capacités. Sans la déclaration, `contexte.lecteurs` vaut `[]` et les quatre appels
   `lecteur.*` sont refusés (`GFS_REFUSE`) : l'app ouvre alors la vidéo sur son site, dans un onglet. Elle ne demande pas `acces: full` : aucune table de l'app n'est en jeu.
   `node outils/capacites.mjs` la liste avec les sites. Les appels et leurs règles : 5.2, point 11. Codé le 07/11 (`js/broker/player.js`, `js/broker/player-sites.js`, `js/apps/manifest.js` : `checkPlayers`,
   `js/broker/filter.js` : `makePolicy`, `js/broker/context.js`).

8. [T] **`partage`** : `{ "pourquoi": { "fr": "…", "en": "…" } }`. **Décidé par le porteur le 11/11** (« Avec accord » : « Laisser Form+ publier le formulaire à ta place, avec ton accord à chaque
   fois ») ; **« Au choix, non coché » pour un lien commun à deux formulaires** (même jour). Elle laisse l'app poser le partage de la page de son formulaire, c'est-à-dire
   la recette du bouton « Publier » de Grist (`app/client/components/Forms/FormView.ts`, lu dans la 1.7.19 : `AddRecord _grist_Shares`, `UpdateRecord _grist_Pages.shareRef`,
   puis `shareOptions`), et rien d'autre. Elle ne demande pas la lecture de `_grist_Shares` (qui reste interdite, 3.2 point 4) et ne se déclare pas par `gristInterne`
   (le validateur refuse toujours `_grist_Shares` et `shareRef` dans une entrée, 3.3 point 5) ; elle demande `acces: full`. Sans elle, 3.3 point 6 vaut tel quel. Avec elle, le courtier juge :
   a. [T] **La forme** (`js/broker/sharing-rules.js`) : `AddRecord _grist_Shares` porte `linkId` (un identifiant de 8 à 64 caractères, lettres, chiffres, « - » et « _ ») et `options`
      valant exactement `{"publish":true}`, et rien d'autre ; `UpdateRecord _grist_Shares` ne change que `options`, exactement `{"publish":true}` ou `{"publish":false}` ;
      `UpdateRecord _grist_Pages` écrit `shareRef` seule, vers un partage (positif : détacher un partage n'est pas permis) ; aucun autre verbe, aucune forme `Bulk…` ni « ajouter ou mettre à
      jour », jamais `RemoveRecord` (un partage ne se retire pas). Les autres colonnes de `_grist_Pages` et les autres tables de 3.3 point 6 restent fermées.
   b. [T] **Ce que dit le document** (`js/broker/sharing.js`, `_grist_Pages`, `_grist_Shares`, `_grist_Views_section` lus par GFS seul, jamais par l'app ; un document illisible refuse le lot,
      GFS échoue fermé) : la page et le partage existent ; la page n'a pas déjà un partage ; **la page ne porte pas déjà un formulaire marqué publié** (`shareOptions` avec `publish` et `form` :
      lui rattacher un partage l'ouvrirait sans l'accord de la personne) ; rouvrir un partage fermé (`publish` à vrai) est refusé si une page qui le porte a un formulaire marqué publié
      (la personne l'avait fermé). Un lot est jugé action par action, chacune sur le document que les précédentes laisseraient.
   c. [T] **Rien de ceci n'ouvre quoi que ce soit.** Un formulaire ne s'ouvre à qui a le lien que par `shareOptions` : c'est CE geste qui demande l'accord de la personne (3.3, point 9, inchangé). Un
      partage posé sans formulaire publié ne donne ni le formulaire ni l'ajout de lignes (mesuré, faits vérifiés 95). Si la personne refuse à la publication, le partage reste posé sur la page,
      sans effet (l'app reçoit `GFS_ANNULE`) ; GFS ne le retire pas.
   d. [D] **Un lien commun à deux formulaires** (11.9, point 4a, modifié) : rattacher à une page un partage qui est déjà celui d'une autre page n'est pas refusé, **il est demandé** : une fenêtre
      de GFS (« Un seul lien pour deux formulaires ? ») nomme la page qui prend le lien, celles qui l'ont déjà et les tables de leurs formulaires, dit qu'une seule adresse les ouvre tous et que si
      elle fuit elle les ouvre tous ; « Refuser » est le défaut au clavier (`GFS_ANNULE`, rien n'est écrit) ; « Même lien » rattache. Sans moyen de demander, le lot est refusé. La publication du
      second formulaire passe ensuite par son propre accord (3.3, point 9), qui nomme sa table. **C'est à l'app de proposer ce choix, décoché, à la personne** : GFS ne l'impose jamais.
   Le `pourquoi` est montré à la personne comme celui des capacités. `node outils/capacites.mjs` la liste. Codé le 11/11 (`js/broker/sharing-rules.js`, `js/broker/sharing.js`, `js/broker/filter.js` : `makePolicy`,
   `internalWriteRefusal` ; `js/broker/broker.js` : `agreeSharedLink` ; `js/broker/publication-window.js` : `sharedLinkQuestion` ; `js/apps/manifest.js` : `checkCapabilities`). Mesuré dans un vrai Grist 1.7.19 avec la vraie
   Form+ (`labo/run-publier-form.mjs`, faits vérifiés 95).

### 3.5 Les clés de réglages

Voir 7.2 : le courtier réduit chaque appel de `WidgetAPI` à la tranche de l'app.

### 3.6 Les erreurs

Le courtier répond à l'app par une erreur du protocole (`mtype` 3, avec `mesg` et `code`).

| Code | Quand |
|---|---|
| `GFS_REFUSE` | table, verbe, colonne, clé ou capacité non déclarée dans `gfs.json`, ou dans une liste fermée ; une demande d'action hors règle, ou un type que le manifeste ne déclare pas (`ranger`, 5.4, point 9 ; `joindre`, point 12) ; un fichier vide ou qui n'est pas du type annoncé |
| `GFS_ACCES` | niveau de l'app insuffisant ; `mesg` reprend le texte de Grist (« Access not granted. Current access level … ») |
| `GFS_LECTURE_SEULE` | écriture dans un document en lecture seule |
| `GFS_CLE_NON_DECLAREE` | écriture d'une clé de réglage hors de la tranche |
| `GFS_INCONNU` | interface, méthode, action ou événement que GFS ne connaît pas |
| `GFS_INACTIF` | appel venu d'un sous-cadre qui n'est pas l'app active |
| `GFS_ANNULE` | la personne a annulé ou refusé : elle n'a pas débloqué l'app que visait `ouvrir` (5.4, point 7), elle a refusé d'ouvrir un formulaire au public, ou de créer la table où GFS garde ses fichiers (`ranger`, 5.4, point 9)… Un `choisir` annulé ne rend pas d'erreur : il rend `null` ; un `ranger` dont la personne ne veut pas non plus (`statut: ignore`) |
| `GFS_INTROUVABLE` | ce que l'appel désigne n'existe pas : une app que GFS ne connaît pas, ou un fichier que la table de l'app visée ne contient plus (`ouvrir`, 5.4, point 7) |
| `GFS_QUOTA` | espace de stockage plein |
| `GFS_ECHEC` | ce que GFS devait faire pour l'app n'a pas pu se faire, sans que ce soit un refus : Grist ou le cadre d'envoi n'a pas répondu, le serveur refuse le fichier (trop gros…) (`ranger`, 5.4, point 9 ; `joindre` ne s'en sert pas : il le dit dans `probleme`, point 12) ; `message` dit la raison en mots |

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
7. [T] **Le filtre n'arrête pas une personne.** Il borne le code d'une app ; ce qu'une personne lit et écrit, ce sont les règles
   d'accès de Grist qui le décident (section 11), et un verrou d'interface n'en tient pas lieu.
8. [T] **Un formulaire publié est une porte ouverte à toute personne qui a le lien, et GFS n'est pas sur son chemin.** Elle parle à
   Grist directement. Le lien ouvre à l'ajout **toutes** les colonnes de la table du formulaire (celles qu'il ne montre pas, celles
   qu'on ajoutera ensuite : Grist le note lui-même), et à la lecture la colonne affichée de chaque table qu'une Référence de ses champs
   vise, **sur toutes les lignes**, champs cachés compris. Une clé de partage porte sur la **page** : chaque lien ouvre les tables de
   tous les formulaires publiés de sa page. L'accord de 3.3, point 9, ne couvre que ce qu'une app publie par GFS : un formulaire publié
   depuis l'interface de Grist, ou avant ce contrôle, n'est jamais soumis à la personne. Ce qui réduit l'ouverture, c'est la conception
   de l'app (consigne 013 de Form+) : une table faite pour les réponses, sans colonne de travail ; le moins de Références possible,
   aucune qui montre la définition d'autres formulaires ; des formulaires qui n'écrivent pas dans les mêmes tables sur des pages
   différentes.

---

## 4. Le protocole du courtier

### 4.1 Le démarrage de GFS

1. [T] GFS enregistre son routeur (1.2), puis charge le script d'API de Grist, puis appelle `grist.ready()` une fois, avec
   `requiredAccess: 'full'` et un gestionnaire `onEditOptions`. Grist garde alors tout ce qu'il envoie à GFS jusqu'à ce
   `ready` (`queueOutgoingUntilReadyMessage`).
2. [T] GFS s'abonne aux événements de Grist par l'API publique et tient, dans une copie en mémoire, le **dernier** message de
   chacun : `options` (avec `settings`), `theme`, état de la table (`onRecords`) et ligne courante (`onRecord`).
3. [T] GFS lit ensuite les réglages de sa section, décide de l'app à ouvrir (cahier 6.2 ; la règle est au point 7 de 7.4) et
   crée le sous-cadre.

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
   **Le rejeu suit chaque `ready`**, pas seulement le premier : comme Grist, qui redéclenche « ready » à chaque message `ready`
   (`WidgetFrame._onMessage`, sources de grist-static 0.1.6), si bien qu'un cadre qui se recharge sur place (Publipostage+ au
   changement de langue, 5.2 point 3) retrouve ses réglages, son thème et sa table. [M] **Mesuré le 21/10** (labo,
   `run-recharge.mjs`, en français clair et en anglais sombre) avec Form+, qui attend ses réglages pour démarrer : rechargée sur
   place, elle retrouve ses départs, le thème de Grist et la table de la section ; avec le courtier d'avant, qui ne rejouait
   qu'au premier `ready`, elle tombait sur son écran « widget seul », sans thème ni table.
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

### 4.5 La table de travail : une table, et au besoin sa ligne, choisies dans GFS

Décidée par le porteur le 21/10 (« Oui, le construire dans GFS »), après la mesure du même jour (faits vérifiés, 1 ; labo,
`run-travail.mjs`). Sans elle, la section de GFS décide de la table et de la ligne de chaque app (4.2, 4.3) : il faut un GFS par
table, réglé dans le panneau de Grist.

1. [T] **Le geste.** Le bouton « Table de travail » de la barre de GFS (5.2, point 7) ouvre une fenêtre du widget : la liste des
   tables, avec recherche. Un clic sur une table la choisit, et c'est l'essentiel (le porteur, 21/10 : « la core feature c'est la
   table ») ; sa ligne est alors celle d'une section qui s'ouvre : la première du tableau, ou la ligne d'ajout (`new`) d'une table
   vide. Le bouton « Ligne » d'une table (ou la flèche droite) mène, pour qui le veut, à la liste de ses lignes, avec recherche.
   Choisir de nouveau la même table, sans ligne, ne change rien. Le premier article, « La table de la page », rend la main à la
   section : c'est l'état de départ, celui d'avant 4.5 ; sa ligne se complète ou se choisit (point 7). La liste des tables ne montre ni les tables internes de Grist
   (`_grist_*`), ni celles de GFS (`GFS_*`), ni celles des apps (leur préfixe, 2.3, le préfixe sans son « _ » final, et les
   tables de leurs fichiers, 2.4). Une table que l'app ouverte ne peut pas lire (3.2) est grisée, avec la raison.
2. [T] **Ce que l'app reçoit.** Tant qu'une table de travail est choisie, le courtier présente à l'app la table et la ligne
   choisies comme celles de sa section : le message de table et de ligne (4.3) porte leur `tableId` et leur `rowId`, au `ready`
   comme ensuite ; ceux de Grist pour la section ne passent plus. `fetchSelectedTable` et `fetchSelectedRecord` sont rendus
   depuis la table choisie, lue par GFS (`fetchTable`), sous la forme de la vue de Grist (faits vérifiés, 1) : colonnes visibles
   (sans `manualSort` ni colonnes d'aide), Référence par sa colonne affichée (`expandRefs`, vrai par défaut), nombre d'une colonne
   Date, DateTime ou Référence encodé, lignes dans l'ordre du tableau (`manualSort`). Sans section, il n'y a ni filtre ni tri de
   la personne : toutes les lignes. `setCursorPos` d'une ligne de la table choisie change la ligne de travail ;
   `setSelectedRows` ne fait rien. L'app n'a rien à changer : elle lit sa table par `getSelectedTableId`, `onRecord` et
   `onRecords`, que le script d'API tire de ces messages et de ces appels.
3. [T] **Une autre table, l'app est rouverte.** Changer de table (ou revenir à celle de la page) ferme l'app active et la rouvre :
   une app peut lire sa table une seule fois, au démarrage (Automation+). Changer de ligne dans la même table envoie un message
   de ligne, sans rouvrir.
4. [D] **Relire pour voir les changements.** Grist ne prévient pas GFS des changements d'une autre table que celle de sa section
   (5.5, point 1). Tant qu'une app est ouverte sur une table de travail, GFS relit la table choisie et envoie un message de table
   (`dataChange`) quand elle a changé : toutes les **2 s** jusqu'à 5 000 lignes, toutes les **5 s** jusqu'à 20 000, toutes les
   **10 s** au-delà ; à l'arrêt quand la page est cachée. Mesuré le 21/10 (labo, sans réseau) : une relecture coûte 11 à 14 ms
   pour 1 000 lignes, 38 ms pour 5 000, 135 à 166 ms pour 20 000 ; à 20 000 lignes relues toutes les 1,5 s, la page de Grist
   accroche à chaque relecture (0,19 s au plus). Deux lectures demandées en même temps n'en font qu'une.
5. [T] **Ce que le courtier refuse.** Une table que l'app ne peut pas lire (3.2) n'est jamais présentée : la fenêtre la grise, et
   une app ouverte ensuite qui ne peut pas la lire suit la page, et GFS le dit.
6. [D] **Ce qui est retenu.** Rien, dans le document comme dans le navigateur : la table de travail vaut pour le cadre de GFS
   ouvert, et se perd quand Grist le recharge (changement de page, d'accès). La plus prudente des réponses, en attendant
   l'usage.
7. [T] **La table de la page, sa ligne.** Décidé par le porteur le 03/11 (« j'aimerais que GFS prenne la main là-dessus » : le widget
   n'est pas relié par « Select by », et Publipostage+, ouverte en Lecture sur « La table de la page », n'avait aucune ligne). La
   table reste celle de la section, la ligne reste celle de Grist, avec deux compléments. (a) Quand Grist ne dit **aucune ligne**
   (le curseur de la section n'en a plus : filtre qui les écarte toutes, ou ligne d'ajout `new`) et que la section **n'est pas
   reliée** (`settings.linking.asTarget`, faits vérifiés 1 : une chaîne quand elle l'est ; sans cette information, elle est tenue
   pour non reliée), GFS donne **la première ligne du tableau** (lue par `fetchTable`, dans l'ordre du tableau, redonnée si elle a
   été retirée) : le message de table et le message de ligne que reçoit l'app la portent, au `ready` comme ensuite. Une table vide
   n'en donne aucune : la ligne d'ajout reste à Grist. Une section reliée n'a jamais d'autre ligne que celle de Grist. (b) Le bouton
   « Ligne » du premier article choisit une ligne de la table de la page : l'app la reçoit tout de suite (sans être rouverte, sauf
   si une autre table de travail était choisie), au `ready` comme à chaque message de table (un changement de données), jusqu'à ce
   que **Grist dise une autre ligne** (un message de ligne ou de table qui porte un autre numéro que le dernier qu'il a dit : la sienne
   passe toujours avant), que la personne revienne à la page ou choisisse une autre table de travail, ou que Grist recharge GFS (point 6). La
   barre le dit : bouton enfoncé, info-bulle « celle de la page (Table), ligne … ». Mesuré dans un vrai Grist (labo,
   `run-page-ligne.mjs`, faits vérifiés 1) : un filtre enregistré qui écarte toutes les lignes laissait Publipostage+ sur « Reliez ce
   widget » ; elle reçoit la première ligne, la ligne choisie résiste à un changement de données, `setCursorPos` dans la section la
   remplace.
8. [T] **Le lien « Select by », posé par GFS.** Décidé par le porteur le 10/11 (« je choisis la table, celle de la page par défaut, et ça fonctionne » ; carte « Quand GFS
   relie-t-il le widget à ta grille ? », option « Automatique, avec un mot dans la barre »). Grist ne dit à un widget que la ligne de **sa propre section**, ou de celle à
   laquelle il est relié (faits vérifiés 1) : sans lien, « La table de la page » reste sur la première ligne, quelle que soit la ligne que la personne clique dans la grille.
   GFS écrit donc **lui-même** le lien de sa section vers la grille de la même table (`js/broker/view-link.js` : un `UpdateRecord` sur `_grist_Views_section`, `linkSrcSectionRef`, avec
   `linkSrcColRef` et `linkTargetColRef` à 0, ce que fait le panneau de droite de Grist ; mesuré le 21/10 puis le 10/11), **une seule fois par section**, à l'ouverture, sans geste,
   quand : (a) GFS a le niveau `full` et le document s'écrit ; (b) la page décide de la table (aucune autre table de travail choisie) ; (c) la section n'est pas reliée
   (`settings.linking.asTarget`, point 7) ; (d) la marque `gfs.grille` est absente des réglages de la vue ; (e) GFS reconnaît sa section (`js/broker/view-options.js`, 7.3 point 4) ;
   (f) la page n'a **qu'une** grille, fiche ou liste de fiches de la même table (une fiche déjà liée à la grille suit son curseur et ne compte pas) ; (g) Grist confirme le lien
   dans les réglages de la section (`asTarget` devient une chaîne) : sinon l'écriture est défaite. **Plusieurs candidates** : GFS le dit (`link.several`) et n'écrit aucun lien.
   La marque `gfs.grille` (`lie` ou `plusieurs` ; une clé de GFS, 7.1 point 3) garde que c'est fait ou dit : **une personne qui retire le lien dans Grist ne le voit jamais
   revenir**. GFS dit son geste une fois (`link.done`, phrase qui disparaît seule). Le choix d'une ligne à la main (point 7, b) reste, et la ligne que Grist dit passe toujours
   devant. `?grille=0` dans l'adresse du widget coupe la fonction (les passes du labo qui mesurent une section non reliée). Un document sans droit d'écrire la structure : Grist
   refuse, GFS n'insiste pas, rien ne change. Mesuré dans un vrai Grist (faits vérifiés 77, `labo/run-lien-grille.mjs`).
9. [M] **À mesurer sur un Grist en ligne** : le coût d'une relecture par le réseau, et un repère léger « le document a changé »
   (l'historique du document par l'API REST) qui éviterait de relire une table qui n'a pas changé. De même pour le lien du point 8 : la version de Grist du porteur.

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
| `stockage.ecrire` | app → GFS | `{ cle, valeur }` (5.3) | aucune sans `id` ; avec un `id`, `{ retenu }` (5.3, point 3) |
| `barre.masquer` | app → GFS | `{ masquee }`, vrai ou faux (5.2, point 7) | aucune sans `id` ; avec un `id`, `{ masquee }`, l'état qui vaut (5.2, point 7) |
| `lecteur.afficher` | app → GFS | `{ id, fournisseur, video, debut?, rect, zone }` (5.2, point 11) | aucune ; un refus se lit en console |
| `lecteur.deplacer` | app → GFS | `{ id, rect, zone }` (5.2, point 11) | aucune ; un refus se lit en console |
| `lecteur.masquer` | app → GFS | `{ id, masque }`, vrai ou faux (5.2, point 11) | aucune ; un refus se lit en console |
| `lecteur.fermer` | app → GFS | `{ id }` (5.2, point 11) | aucune ; un refus se lit en console |
| `ouvrir` | app → GFS, puis GFS → app active | 5.4 | 5.4 |
| `choisir` | app → GFS | 5.4 | 5.4 |
| `ranger` | app → GFS | 5.4 | 5.4 |
| `joindre` | app → GFS | 5.4, point 12 | 5.4, point 12 |
| `inserer` | app → GFS, puis GFS → app qui fournit | 5.4 | 5.4 |
| `installer` | app → GFS | 5.4 | 5.4 |
| `fermer` | GFS → app active | 5.4 | 5.4 |
| `rester` | GFS → app active | 5.4, point 3 | 5.4, point 3 |
| `extensions` (événement) | GFS → app | `{ extensions: [ … ], bibliotheques: { … } }` (5.2) | aucune |
| `langue` (événement) | GFS → app | `{ langue }` (5.2, point 6) | aucune |
| `barre` (événement) | GFS → app | `{ barre }` : `{ bord, epaisseur, zone }` ou `null` (5.2, point 7) | aucune |
| `ambiance` (événement) | GFS → app | `{ ambiance }` : le message d'ambiance, ou `null` (5.2, point 10) | aucune |
| `correcteurs` (événement) | GFS → app | `{ correcteurs }` : `{ coupes }`, vrai quand la personne a coupé LanguageTool et les correcteurs du navigateur dans les apps (5.2, point 13) | aucune |
| `reglages` (événement) | GFS → app | `{ enregistres }` : vrai quand le réglage que l'app vient d'écrire est dans la vue, faux quand il reste un brouillon ; dit aussi d'avance, à la demande de `contexte`, ce que deviendront ses réglages (7.3, point 5) | aucune |

1. [D] `gfs` est le numéro de contrat de l'émetteur (pour l'app, celui de son manifeste). Un message sans `gfs` entier, ou d'un
   numéro que le destinataire ne connaît pas, est ignoré.
2. [D] `id` est un entier propre à l'émetteur, à partir de 1 ; la réponse ou l'erreur le reprend. Un appel sans `id` n'attend
   pas de réponse (comme un appel sans `reqId` chez `grain-rpc`).
3. [D] Un appel de `nom` inconnu reçoit `GFS_INCONNU` ; un événement inconnu est ignoré. Les erreurs de 3.6 valent ici aussi.
4. [D] Délais : l'app attend `contexte` 5 secondes au plus ; les appels qui attendent une personne (`ouvrir`, `choisir`,
   `ranger`, `joindre`, `installer`, `inserer`) n'ont pas de délai ; `stockage.ecrire`, `barre.masquer` et les quatre appels `lecteur.*` n'attendent pas de réponse pour continuer.
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
| `page` | numéro de la page, ou `null` | au mieux, d'après le référent de GFS : **`null` sur une instance ordinaire**, le référent d'un cadre d'une autre origine ne porte que l'origine de Grist (faits vérifiés, 18) | au mieux |
| `section` | numéro de la section, ou `null` | `null` : Grist ne le dit pas au widget (GFS retrouve sa section pour écrire ses réglages, 7.3, point 4, sans la donner aux apps) | au mieux |
| `adresseWidget` | adresse du widget dans Grist, sans requête | celle de GFS | celle de l'app |
| `langue` | `fr` ou `en` | le choix de la personne dans GFS, sinon la langue de Grist (point 6) | le choix de l'app, sinon l'adresse |
| `culture`, `fuseau`, `devise` | paramètres `culture`, `timeZone`, `currency` de l'adresse | ceux de GFS | ceux de l'adresse |
| `lectureSeule` | `readonly` de l'adresse | celui de GFS | celui de l'adresse |
| `acces` | niveau de **cette app** (3.1) | oui | celui de Grist |
| `extensions` | identifiants des extensions actives de l'app | liste de la section | `[]` |
| `bibliotheques` | source de chaque bibliothèque que les extensions actives exigent : `{ "<id>": { src, integrite, forme } }` (2.6) ; `forme` vaut toujours `script` ou `module` | oui | `{}` |
| `ouverture` | pourquoi et sur quoi l'app s'ouvre, ou `null` (5.4) | oui | `null` |
| `stockage` | copie de l'espace de cette app, `{ clé: valeur }` (5.3) | oui, relue à chaque appel | contenu du navigateur |
| `barre` | la barre de GFS qui recouvre le cadre de l'app, `{ bord, epaisseur, zone }`, ou `null` quand rien ne le recouvre (point 7) | oui, mesurée à chaque appel | `null` |
| `lecteurs` | les sites dont GFS pose le lecteur de vidéo pour cette app, `["youtube", "vimeo"]` (point 11) | seulement pour une app qui déclare `lecteurs` (3.4, point 7), `[]` pour toute autre ; relue à chaque appel | `[]` |
| `ambiance` | l'ambiance et la couleur que la personne a choisies pour GFS et ses apps, ou `null` quand rien n'est choisi (point 10) | oui, relue à chaque appel | `null` |
| `correcteurs` | `{ coupes }` : vrai quand la personne a coupé les correcteurs du navigateur (LanguageTool) dans les apps par le bouton de la barre (point 13) | oui, relue à chaque appel | `{ coupes: false }` |
| `role` | ce que GFS sait de la personne, `{ proprietaire, responsableDe }` (point 8) | oui, à chaque appel ; la preuve se garde pour la vie de la page, 1,5 s d'attente au plus | `{ proprietaire: null, responsableDe: [] }` |
| `liensPublics` | **pas encore rendu** (décidé le 06/11, 11.7, point 11) : `{ connu, tables }`, les tables qu'un lien public remplit ; `connu` faux (ni propriétaire prouvé, ni lecture possible) = l'app attend un geste sur toute ligne reçue | oui, une fois codé | `{ connu: false, tables: [] }` |
| `identite` | l'adresse e-mail de la personne, `{ email }`, ou `null` (point 9) | seulement pour une app qui déclare `identite` (3.4, point 6), `null` pour toute autre ; relue à chaque appel | `null` (l'app garde sa propre sonde, 11.6, point 5) |

1. [T] Les six paramètres de l'adresse (1.3) et le contexte disent la même chose : l'adresse existe pour le code des apps
   qui la lit déjà, le contexte pour le kit. Une seule différence dans le temps : la langue de l'adresse est celle du cadre
   quand il a été créé, et le contexte dit la langue qui vaut maintenant (point 6).
2. [D] Sept événements en cours de vie. `extensions` (`{ "extensions": [ … ], "bibliotheques": { … }, "natives": { … } }`), quand la personne
   active ou désactive une extension dans GFS, ou change le mode d'une bibliothèque native (point 12) : l'app charge alors l'extension au premier usage, comme ses moteurs d'export.
   `langue` (`{ "langue": "fr" | "en" }`), quand la personne change la langue de GFS (point 6). `barre` (`{ "barre": { … } | null }`),
   quand la barre de GFS change de bord, de taille, ou disparaît et revient (point 7). `identite` (`{ "identite": { "email": … } | null }`),
   quand GFS apprend l'adresse de la personne pendant que l'app qui la déclare est ouverte (point 9). `ambiance` (`{ "ambiance": { … } | null }`),
   quand la personne change l'ambiance ou la couleur de GFS (point 10). `correcteurs` (`{ "correcteurs": { "coupes": true | false } }`), quand la personne coupe ou rallume les correcteurs du navigateur par le bouton de la barre, ou le montre ou le cache (point 13). `reglages` (`{ "enregistres": true | false }`), après chaque écriture
   d'un réglage de l'app : vrai si GFS l'a écrit dans la vue (rien à enregistrer dans Grist), faux s'il est resté un brouillon ; et **d'avance**, une fois
   par demande de `contexte`, pour une app qui déclare des clés `reglages` (7.3, point 5).
3. [D] `ouverture` : `null` quand l'app s'ouvre sans consigne (elle applique son propre ordre d'arrivée, cahier 6.2, point 4 : c'est
   le cas du bouton « Ouvrir » de la fenêtre « Apps et extensions » et de l'arrivée sur une vue qui porte ses réglages, 7.4, point 7) ;
   sinon `{ fichier, type, dossier, raison }` où `fichier` est `{ id, type }` (ou `null` pour « Nouveau »), `type` le type
   demandé quand `fichier` est `null`, `dossier` le dossier courant de l'explorateur (une indication), `raison` l'un de
   `explorateur`, `nouveau`, `lien`, `importer`, `lire`. Avec `importer`, l'ouverture porte de plus `importation: { valeur, fichier }` :
   `valeur` est celle d'un format de `actions.importer` (2.7, point 4) et `fichier` l'objet `File` que la personne a choisi dans le
   sélecteur de GFS (le `fichier` de l'ouverture reste `null`, `type` est celui du format) ; le sous-cadre le lit comme tout fichier
   choisi (`name`, `size`, `type`, `text()`, `arrayBuffer()`), GFS ne le lit ni ne le garde (5.4, point 1). Avec `lire`, l'ouverture porte
   `lecture: { id, fichier }` : `id` est l'identifiant du fichier chez GFS (`Identifiant` de `GFS_Fichiers`, 6.6 : il ne change ni au
   renommage ni au remplacement, c'est la clé où l'app peut accrocher ce qu'elle garde, des commentaires par exemple), `fichier`
   l'objet `File` des octets, que GFS a téléchargés lui-même ; le `fichier` de l'ouverture reste `null` et `type` est celui du fichier
   lu (5.4, point 8). L'app affiche elle-même
   la raison dans son coin d'état (« par la ligne… », « depuis l'explorateur »). **GFS ne la rend qu'une fois**, au premier `contexte` de l'app qu'il vient d'activer : un cadre rechargé sur
   place (Publipostage+ le fait au changement de langue, de caractère de déclenchement et au premier contact) redemande son
   contexte et reçoit `null`, donc reprend son ordre d'arrivée habituel, au lieu de refaire un « Nouveau » déjà fait (le modèle
   vierge enregistré reviendrait vierge) ou de rouvrir le fichier du dernier clic. Une app déjà ouverte n'a pas de seconde
   `ouverture` : elle reçoit l'appel `ouvrir` (5.4, point 1). [M] **Mesuré le 19/10** dans un vrai Grist, avec la sonde O et
   avec Publipostage+ (`71287c4`) : le cadre rechargé retrouve l'ordre habituel, et les deux essais échouent sur l'ancien
   comportement (l'ouverture rendue à chaque `contexte`). Une app peut garder elle-même le modèle ouvert à travers un
   rechargement qu'elle déclenche : Publipostage+ (`dc00b9d`) laisse l'identifiant du modèle dans le fragment de l'adresse de
   son cadre (`#pp-open=<id>`, que GFS ne touche pas, sans aucun stockage), l'efface au démarrage et rouvre ce modèle avant
   tout le reste, `ouverture` comprise. [M] **Mesuré le 20/10** avec cette app : Réglages, Déclencheur, « Recharger
   maintenant » la rouvre sur le modèle où la personne était (non sur le ★), GFS ne dit rien, l'adresse du cadre redevient
   celle que GFS a donnée (`access`, `gfs`) et rien n'est écrit dans le document ; l'essai échoue avec l'app à `71287c4`. À
   `dc00b9d`, le choix de langue de l'app restait refusé dans GFS (le cadre n'a pas de stockage : la case revenait sur la
   langue de la page, sans rechargement) ; depuis `f6d3fd0` il est grisé et la langue est celle de GFS (point 6).
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
6. [D] `langue` : **un seul choix de langue par personne, pour GFS et pour toutes ses apps** (décision du porteur, 20/10).
   La ligne « Langue » du menu « Réglages » de l'explorateur (le dernier bouton de la ligne du titre, à icône seule ; décision du
   porteur, 04/11) offre « Comme Grist » (par défaut : le paramètre `language` de Grist, sinon la
   langue du navigateur), « Français » et « English ». Le choix est retenu dans le `localStorage` de GFS (clé `gfs.langue`),
   jamais dans le document ni dans une table, et toutes les sections de GFS d'une même page le suivent (événement `storage`
   du navigateur) ; un navigateur qui refuse de le retenir n'empêche rien : le choix vaut pour la page, et GFS le dit.
   `contexte.langue` vaut `fr` ou `en` et fait foi à chaque appel `contexte` ; le paramètre `language` de l'adresse du cadre
   n'en est que la valeur à sa création. Quand la langue qui vaut change, GFS envoie à l'app ouverte l'événement `langue`,
   une seule fois, sans toucher à son cadre : choisir la langue que Grist donne déjà ne change pas la langue, donc n'envoie
   rien. L'app décide comment suivre : se retraduire, ou se recharger après sa question d'enregistrement s'il y a des
   modifications en attente (point 3) ; une app qui n'écoute pas l'événement garde sa langue jusqu'à son prochain démarrage.
   Dans GFS, l'app n'offre plus de choix de langue à elle : le sien est grisé avec la raison, jamais masqué. `culture` reste
   celle de Grist (celle du document) ; seules les dates de GFS lui-même suivent la langue choisie. [M] **Mesuré le 20/10**
   dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier, en clair et en sombre, en français et en anglais
   (`prototype/labo/run-langue.mjs`, 37 vérifications par combinaison) avec la sonde L, qui fait ce que fera l'app : la
   langue de l'adresse et du contexte au départ ; l'événement à chaque changement qui compte, une seule fois ; rien quand le
   choix redit la langue de Grist ; son cadre jamais rechargé ; une app ouverte après le choix la reçoit dès son départ ;
   deux sections de GFS dans la page se suivent, la fenêtre « Apps et extensions » ouverte comprise ; un navigateur qui
   refuse d'écrire laisse le choix valable pour la page et le dit dans la langue choisie.
   [M] **Mesuré le 20/10 avec Publipostage+ à `f6d3fd0`** (consigne 019 ; `prototype/labo/run-langue-publipostage.mjs`, 25
   vérifications en français clair et en anglais sombre ; avec l'app à `dc00b9d`, qui ne lit pas la langue, l'essai s'arrête
   dès le départ) : l'app démarre dans la langue de GFS, grise ses deux cases de langue avec la phrase qui dit où choisir ;
   quand GFS change la sienne, l'app se recharge d'elle-même dans l'autre langue et rouvre le même modèle (non le ★), sans que
   GFS touche à son cadre (l'adresse garde la langue de sa création) et sans rien écrire dans le document ; après un F5 du
   cadre, elle repart dans la langue de son adresse puis rattrape celle de GFS ; quand des modifications attendent, elle pose
   d'abord sa question « Enregistrer / Abandonner / Annuler » (« Annuler » garde la langue d'avant, « Abandonner » ne garde pas
   ce qui a été tapé, « Enregistrer » enregistre avant de recharger) ; une langue redite ne pose aucune question. **À connaître** :
   l'explorateur ouvert cache le cadre de l'app et le rend inerte, donc cette question est posée derrière lui et ne se voit
   qu'en le fermant (elle y attend, rien n'est perdu). **Non mesuré** : deux onglets de Grist (même mécanisme du navigateur que
   deux sections, non joué), Firefox, Safari.
7. [D] `barre` : **la barre de GFS recouvre un petit morceau du cadre de l'app, et l'app laisse libre la place qu'elle y prend**
   (décision du porteur, 21/10 : la barre se place à gauche, en haut, à droite ou en bas, à la guise de la personne ; les apps
   adaptent leur interface aux quatre emplacements sans recouvrement ; l'emprise reste minimale, donc pas de bande en plus, mais
   un recouvrement de l'espace que les apps laissent vide). Elle porte cinq boutons à icône seule (« Fichiers », « Fichiers ouverts »,
   6.4 point 14, depuis le 11/11, « Apps et extensions », « Table de travail », 4.5, depuis le 21/10 au soir, et « Position de la barre »), de 34 × 154 px au bord
   gauche ou droit et de 154 × 34 px en haut ou en bas (**34 × 184 avec le sixième bouton, « LanguageTool », que la personne ajoute par le réglage du même nom, point 13**, entre « Table de travail » et « Position de la barre » ; 34 × 124 avec quatre boutons, jusqu'au 11/11 ; 34 × 94 avec les trois premiers), à 4 px du bord et centrée sur lui ; elle remplace les deux boutons que GFS posait au coin bas droit. Le cadre de l'app reste plein :
   rien ne le réduit. `contexte.barre` dit ce qui est recouvert :
   `{ "bord": "gauche", "epaisseur": 42, "zone": { "x": 0, "y": 119, "largeur": 42, "hauteur": 162 } }` (l'exemple d'un cadre de
   700 × 400 avec la barre à gauche ; la taille de la barre peut changer, l'app lit toujours la zone qu'on lui donne : elle a grandi de 30 px le 11/11 avec le 5e bouton,
   sans qu'aucune app ait rien à changer). `bord` vaut `gauche`, `haut`, `droite` ou `bas` ; `zone` est le rectangle à laisser libre,
   en pixels du cadre de l'app (origine en haut à gauche) : la barre et 4 px tout autour, bornés par le cadre ; `epaisseur` est la
   largeur de la zone (bords gauche et droit) ou sa hauteur (haut et bas), la profondeur dont l'app écarte ce qu'elle pose à ce
   bord. Hors de la zone, le cadre est à l'app, coins compris. L'app ne suppose aucun bord : les menus, bulles, fenêtres et bandes
   qu'elle pose près d'un bord s'écartent de la zone, quel que soit le bord (cahier 6.3).
   `barre` vaut `null` quand rien ne recouvre le cadre : l'explorateur est ouvert (le cadre de l'app est caché derrière lui),
   l'app a demandé à ne pas avoir la barre (plus bas), ou GFS ne l'affiche pas ; une app seule n'a pas de barre non plus. L'app la
   lit dans chaque `contexte`, et l'événement `barre` (`{ "barre": { … } | null }`) lui dit chaque changement, une seule fois :
   la personne choisit un autre bord (ou une autre section de GFS dans la page le change), le cadre change de taille (la barre est
   centrée sur son bord, la zone bouge avec elle), l'explorateur s'ouvre ou se ferme, l'app masque la barre ou la rend. L'app
   s'adapte sans recharger son cadre.
   `barre.masquer` (`{ "masquee": true | false }`) : l'app demande à ne pas avoir la barre (le diaporama plein cadre de
   Publipostage+), puis la rend ; avec un `id`, la réponse est `{ masquee }`, l'état qui vaut. **La demande ne vaut que pendant
   que l'app est montrée** : elle tombe quand l'explorateur s'ouvre ou quand l'app se ferme, et tout `contexte` remet la barre (un
   cadre qui se recharge repart avec elle). Une app qui masque la barre offre elle-même la sortie (la touche Échap), puisque la
   barre n'est plus là pour ouvrir l'explorateur. Un argument qui n'est pas vrai ou faux reçoit `GFS_REFUSE` et, comme pour
   `stockage.ecrire`, GFS le dit en console (avertissement : l'app, le code, la raison).
   Le bord est un choix de la personne : GFS le garde dans son `localStorage` (clé `gfs.barre`, `gauche` tant que rien n'est
   retenu), jamais dans le document ni dans une table, et n'écrit rien sans un geste de sa part ; toutes les sections de GFS d'une
   même page le suivent (événement `storage`) ; un navigateur qui refuse de le retenir n'empêche rien : le choix vaut pour la
   page et GFS le dit (même mécanisme que la langue, point 6).
   [M] **Mesuré le 21/10** dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier, en français clair et en anglais
   sombre (`prototype/labo/run-barre.mjs`, 82 vérifications par combinaison, aucune en échec) avec la sonde R
   (`labo/sondes/r-barre/`), qui fait ce que fera Publipostage+ : aux quatre bords la barre mesure 34 × 94 px (94 × 34 en haut et
   en bas), à 4 px du bord et centrée ; la zone que reçoit l'app (dans `contexte` et dans l'événement, un seul événement par
   changement) est exactement la barre mesurée dans la page, 4 px autour : `{ x: 0, y: 149, largeur: 42, hauteur: 102 }` à gauche,
   `{ x: 658, … }` à droite, `{ x: 299, y: 0, largeur: 102, hauteur: 42 }` en haut (trois boutons ; avec le quatrième, 4.5, le même essai
   mesure 34 × 124 px et `{ x: 0, y: 134, largeur: 42, hauteur: 132 }` à gauche, le 21/10 au soir) ; le menu de position s'ouvre à côté de la
   barre sans la recouvrir (à droite, au-dessous, à gauche ou au-dessus d'elle selon le bord) et se manie au clavier (Entrée,
   flèches, Échap, le focus revient au bouton) ; les coins et les trois autres milieux de côté de l'app restent cliquables à la
   vraie souris, à travers le cadre de GFS, pas le milieu du côté de la barre ; un cadre de 560 × 300 déplace la zone avec la barre
   et l'app le sait ; `barre.masquer` va et vient (la réponse dit l'état, l'app reçoit `null`, un argument hors règle reçoit
   `GFS_REFUSE` avec ou sans `id` et l'avertissement se lit en console) ; l'explorateur efface la barre, l'app l'apprend, et une
   demande de masquer faite pendant ce temps ne tient pas ; un cadre rechargé repart avec la barre ; le bord choisi tient au
   rechargement de GFS, une valeur inconnue du navigateur est ignorée, une autre section de GFS qui change la clé est suivie sans
   rechargement ; un navigateur qui refuse d'écrire donne la phrase d'avertissement (au-dessus de la barre quand elle est en bas)
   et le choix vaut pour la page ; GFS n'écrit rien sans un geste, et le document ne reçoit aucune écriture. [M] **Avec
   Publipostage+ à `fcca7b4`** (`prototype/labo/run-diapositives.mjs`, 51 vérifications, aucune en échec) : le bouton ▶
   « Présenter », recouvert par les deux anciens boutons de GFS dans les passes précédentes, se clique maintenant à la vraie
   souris ; la barre, à gauche par défaut, recouvre le début de la bande des diapositives, ce que l'app écarte (consigne 025).
   **Non mesuré** : un second onglet de Grist (même mécanisme du navigateur que deux sections), Firefox, Safari, l'adaptation de
   Publipostage+ elle-même (elle n'a pas encore le code).
8. `role` (22/10, permissions, 11.6 point 4) : `{ "proprietaire": true | false | null, "responsableDe": [ "<clé d'espace>", … ] }`.
   [T] **Codé et mesuré le 04/11** (faits vérifiés, 40). `proprietaire` vaut `true` ou `false` quand GFS l'a prouvé et `null` sinon, ce
   qui est le cas de départ. **La preuve** : `GET /webhooks` de l'API REST, avec le jeton du widget qui peut écrire (`getAccessToken({ readOnly: false })`),
   par le cadre d'envoi de GFS (6.6) ; Grist le rend aux propriétaires seuls : **200** pour un propriétaire, **403 « No owner access »** pour un
   éditeur et pour un lecteur, avec ou sans règle dans le document (Grist 1.7.19). GFS ne lit que le code de la réponse, jamais le corps (la liste des
   webhooks du document). Tout autre cas (pas de jeton, pas de réponse, un 404 d'une autre version de Grist, un 403 qui ne parle pas des propriétaires)
   donne `null`. Ce que GFS **ne prend pas** pour une preuve : la lecture des tables de règles (un éditeur les lit tant qu'aucune règle ne lui refuse la
   lecture d'une table) et la liste des utilisateurs du document (le jeton du widget n'ouvre ni `/access` ni le document : 403 pour tous, propriétaire compris).
   Une preuve sûre se garde pour la vie de la page (une règle posée la recharge) ; un `null` se redemande au bout de 30 secondes.
   [D] `responsableDe` liste les clés des espaces dont l'adresse de la personne est dans `Responsables` de `GFS_Espaces` (11.3) ;
   **vide** sans adresse résolue, sans espace, ou pour une app seule, donc toujours tant que les espaces ne sont pas construits (étape 7). L'app s'en sert pour **griser, jamais pour décider** : elle ne
   grise que si `proprietaire` est `false`, et c'est Grist qui accepte ou refuse. Le champ est relu à chaque appel `contexte`,
sans événement : seule une règle posée recharge la page (11.5, point 3), et qui voit quoi est une donnée.
9. [T] `identite` (03/11, choix du porteur « Aux apps qui le déclarent ») : `{ "email": "<adresse>" }`, ou `null`. **Qui la reçoit** :
   seule l'app dont le manifeste déclare `permissions.identite` (3.4, point 6). Pour toute autre, le champ est là et vaut `null`, et
   l'événement n'est jamais envoyé : elle ne peut pas distinguer « pas déclarée » de « GFS ne connaît pas la personne ». **D'où
   elle vient** : de la lecture que GFS fait déjà pour son rangement, la ligne-sonde (6.4, point 9) ; GFS ne lit rien de plus et ne
   crée aucune table pour cela. Elle vaut donc `null` tant que GFS ne l'a pas : la table `GFS_Rangement` n'existe pas encore (elle
   naît d'un geste de la personne, avec son accord, 6.4), le document est en lecture seule, ou Grist ne donne pas d'adresse de
   personne (les cas de 6.4, point 9 : l'anonyme de Grist, une valeur vide, une erreur, une valeur qui n'a pas la forme
   `nom@domaine`). **Comment elle arrive** : dans chaque `contexte` ; quand GFS l'apprend ensuite (la table naît pendant que l'app
   est ouverte), par l'événement `identite`, **une seule fois**, à l'app active qui la déclare et qui a déjà son contexte. Une
   valeur déjà donnée n'est jamais renvoyée ; un cadre qui se recharge redemande son contexte et la retrouve. L'adresse est celle
   de Grist, à la lettre près (casse comprise) ; l'app qui s'en sert comme clé la compare en minuscules (11.1, point 7). GFS ne la
   met dans l'adresse d'aucun cadre et n'en garde rien dans le navigateur (6.4, point 9). **Ce que l'app en fait** : elle montre
   (« Mes tâches »), filtre ou grise pour la raison qu'elle a déclarée, et ne décide jamais d'un droit : seul Grist refuse (11.1).
   Elle vit sans quand le champ vaut `null` : son repli est son propre mécanisme, ou demander à la personne qui elle est et le
   retenir dans son espace de stockage (5.3). Seule, l'app n'a pas cette valeur : le kit la rend `null` hors de GFS. Dans le kit :
   `GfsLink.identity()` et `GfsLink.onIdentity(rappel)` (version 0.4.0, `a793837`). [M] **Mesuré le 03/11** dans un vrai Grist
   (`prototype/labo/run-personne.mjs`, 34 vérifications, aucune en échec, en français clair, anglais clair, français sombre et
   anglais sombre, à 700 × 400 et à la vraie souris) avec trois sondes (`labo/sondes/v-personne/`) : V déclare l'identité, W non,
   X est écrite avec le vrai client du kit. Sans la table, V reçoit `null` et aucun événement ; l'étoile d'un fichier fait naître
   la table et V reçoit UN événement avec l'adresse de Grist (casse gardée), sans autre écriture de GFS que la table, la sonde, son
   retrait et la ligne de la personne, et un geste de plus ne le répète pas ; à la réouverture le contexte porte l'adresse (la
   sonde seule est écrite, l'adresse n'est dans l'adresse d'aucun cadre) ; W reçoit `null` dans tous les cas, sans événement ; X
   lit l'adresse par `GfsLink.identity()` et son abonné est rappelé une fois ; une autre personne reçoit la sienne, jamais celle
   de la précédente ; l'anonyme de Grist, une personne sans adresse et un document en lecture seule donnent `null`. Même limite
   que 6.4, point 9 : grist-static n'a pas de compte, le labo donne la personne au moteur de données.

10. [D] `ambiance` : **un seul choix d'ambiance et de couleur par personne, pour GFS et pour toutes ses apps** (décision du porteur,
   02/11 et 03/11). La ligne « Thème… » du menu « Réglages » de l'explorateur ouvre une fenêtre : cinq ambiances (Grist Factory, celle d'origine, bleu et
   gris ; Pop ; Papier ; Brut ; Enseigne, qui remplace Néon depuis le 04/11), chacune avec sa propre direction artistique (couleurs, arrondis, traits, ombres, polices,
   fond, filet), et, au choix, **la couleur de la personne**, qui remplace celle de l'ambiance sans toucher à sa forme (le sélecteur
   de couleur des documents de Publipostage+, passé au kit en 0.5.0 : la palette sous le bouton « Choisir ma couleur », « Personnalisé… »
   pour la fenêtre du carré, de la teinte et du code, « Celle de l'ambiance » pour rendre la couleur à l'ambiance ; si le kit de GFS ne se
   charge pas, « La mienne » est grisée avec sa raison, jamais cachée). Le clair et le sombre restent ceux de Grist (le message `theme`, 4.2) : une ambiance a ses deux modes. Le choix est
   retenu dans le `localStorage` de GFS (clés `gfs.theme` : l'identifiant de l'ambiance, absente pour Grist Factory ; `gfs.couleur` :
   `#rrggbb`, absente tant que la personne n'a pas choisi la sienne ; `gfs.acces` : `renforcee`, absente quand l'accessibilité renforcée est éteinte ;
   une ancienne clé `gfs.theme` à `neon` se lit `enseigne`), jamais dans le document ni dans une table, et n'écrit rien
   sans un geste de sa part ; toutes les sections de GFS d'une même page le suivent (événement `storage`) ; un navigateur qui refuse
   de le retenir n'empêche rien : le choix vaut pour la page, et GFS le dit (même mécanisme que la langue, point 6).
   `contexte.ambiance` et l'événement `ambiance` (`{ "ambiance": { … } | null }`) portent le même message. Il vaut **`null` quand
   rien n'est choisi** (Grist Factory sans couleur) : l'app garde alors ses propres couleurs, celles de la charte, et retire celles
   qu'elle avait posées. Sinon :
   ```json
   { "id": "pop", "couleur": "#6d4fd6", "ajustee": false,
     "clair":  { "--bg": "#f0ecff", "--surface": "#ffffff", "…": "…" },
     "sombre": { "--bg": "#1c1830", "…": "…" },
     "forme":  { "--radius-md": "14px", "--shadow-panel": "0 1px 2px color-mix(…)", "…": "…" } }
   ```
   `id` : `defaut`, `pop`, `papier`, `brut` ou `enseigne`, et `renforcee` quand l'accessibilité renforcée est allumée (voir plus bas : l'ambiance choisie dessous ne s'y lit plus) ; `couleur` : la couleur libre (`#rrggbb`), ou `null` ; `ajustee` : la couleur
   libre a dû être éclaircie ou assombrie pour que le texte reste lisible ; `clair` et `sombre` : **dix-neuf jetons de couleur
   chacun**, tous des `#rrggbb` en minuscules, les quinze de la charte (`--bg`, `--surface`, `--surface-sunken`, `--border`,
   `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-solid`, `--accent-solid-hover`, `--on-accent`,
   `--accent-ink`, `--accent-soft`, `--accent-soft-border`) et quatre de décor (`--accent-2`, `--accent-3`, `--accent-end`, le bout du
   dégradé du bouton plein, et `--hard`, l'ombre dure) ; `forme` : les jetons de forme que l'ambiance redit (arrondis `--radius-*`,
   traits `--bw`, `--divider*`, `--bar-w`, ombres `--shadow-*`, polices `--font-*`, `--fw-head`, `--fs-head`, `--tt-*`, `--ls-*`,
   fonds `--ex-bg`, `--main-bg`, `--wash`, `--wash-size`, `--stripe*`, `--avatar-*`, bouton plein `--fill*`), des textes de CSS écrits **en
   termes des jetons de couleur** (`var(--accent)`, `color-mix(…)`), si bien qu'une seule forme sert au clair comme au sombre ; ceux
   qu'une ambiance ne redit pas n'y sont pas : l'app garde alors sa valeur d'origine. Les couleurs d'état (`--danger*`, `--good*`, `--warn*`) ne
   changent jamais d'une ambiance à l'autre. Les couleurs de type (`--t-*`) sont celles de l'explorateur de GFS : elles suivent l'ambiance sur la page de GFS (décision du porteur, 04/11 ;
   table `js/theme/ambiance-types.js`, posée par le CSSOM avec l'ambiance), mais **elles ne sont pas dans le message** : une app n'en reçoit aucune et garde celles de la charte (cahier 6.5).
   **Le contraste est tenu par GFS** : pour chaque ambiance et pour toute couleur libre, les textes (`--text`, `--text-muted`,
   `--accent-ink`, `--on-accent` sur son bouton) gardent **4,5:1 au moins** sur les fonds où l'app les pose, en clair comme en sombre,
   et le bouton plein se distingue de sa carte ; GFS éclaircit ou assombrit la couleur libre pour y arriver (`ajustee`) et la fenêtre
   le dit. L'app n'a donc rien à recalculer.
   **L'accessibilité renforcée** (décision du porteur, 04/11, « un réglage à part » ; premier temps) est un interrupteur de la fenêtre « Thème », combinable avec toute ambiance et avec la couleur libre : elle ne
   change ni les jetons ni le message, seulement leurs valeurs. Quand elle est allumée, le message a l'`id` **`renforcee`** (jamais l'ambiance choisie dessous : une règle écrite pour une ambiance, par GFS ou par une app, ne s'y accroche pas), `ajustee` dit, comme plus haut,
   si une couleur a dû bouger pour y arriver et `couleur` est la couleur libre ou `null`. Les mêmes dix-neuf jetons de couleur y tiennent **7:1 au moins** pour tout texte (WCAG 1.4.6) sur les mêmes fonds (`--text`, `--text-muted`, `--accent-ink`, `--on-accent` sur son bouton),
   et **3:1 au moins** pour le trait de chaque commande (champ, bouton, case, vignette : `--border-strong` sur `--surface`, `--bg` et `--surface-sunken`, le bouton plein contre sa carte, WCAG 1.4.11), pour chaque ambiance et toute couleur libre. La `forme` est celle du
   mode renforcé : arrondis courts, `--bw` à 2 px, `--bar-w` à 6 px, `--divider-w` à 2 px, ni ombre, ni trame, ni filet (`--shadow-*`, `--wash`, `--stripe` à `none`), ni capitales ni lettres espacées (`--tt-head` à `none`, `--ls-head` et `--ls-label` à `normal`), le bouton plein uni
   (`--fill` : `var(--accent-solid)`, `--fill-line` : `var(--border-strong)`), et rien d'autre que les jetons de forme du kit (aucune clé nouvelle : le kit 0.6.0 pose le message tel quel). **Ce que fait GFS pour ses propres états**, que l'app peut faire de même : le texte
   d'erreur, d'avertissement, de « bon » et de type, dont les couleurs fixes ne sont pas dans les dix-neuf jetons, prend la couleur du texte (`--text`), et la couleur reste à l'icône ; le mot dit toujours l'état ou le type. « Revenir à Grist Factory » laisse l'accessibilité
   allumée (un besoin, pas un goût). **Le second temps** (feu vert du porteur, 10/11 ; `css/acces.css`) est l'interface de GFS seule : le message ne change pas et **aucun jeton ne s'ajoute** (`--fs-min` et `--target` sont à GFS, pas des jetons de forme). Texte : plancher de 14 px (`--fs-min`, 0 d'origine ; toute taille de GFS sous 14 px s'écrit
   `max(Npx, var(--fs-min))`, gardé par `test/acces.test.mjs`). Cibles : 36 px (une case de 22 px compte avec son nom, qui fait 36 px). Anneau de focus : contour de 3 px de la couleur du texte, 2 px de la page entre lui et la commande, dessiné dedans dans une zone qui défile.
   Aucun mouvement : ni transition, ni animation, ni défilement doux. Barre de la ligne choisie : une bordure de `--bar-w` (6 px), transparente d'avance. Barre de GFS au-dessus d'une app : 36 px par bouton, soit 42 × 156 px au lieu de 34 × 124 ; `contexte.barre.zone` dit la barre mesurée et 4 px autour
   (le cadre de GFS relit la barre quand sa taille change, pas seulement celle du cadre). **Le contraste forcé du système** (`forced-colors: active`) et **« réduire les animations »** (`prefers-reduced-motion: reduce`) valent pour toute ambiance, interrupteur allumé ou non. **Les apps** n'ont rien à faire (aucun jeton, aucune consigne) et GFS ne touche
   pas à leur interface ; ce que le système force (le contraste forcé) s'applique de lui-même à chacune, dans son propre cadre.
   **Ce que fait l'app** : le kit en fait la pose (kit 0.6.0) : l'app qui a le lien du kit appelle `Ambiance.start()` (`js/ambiance.js` du kit) une fois à son démarrage ; celle qui
   garde son propre lien appelle `createAmbiance({ link, isDark })` (`js/ambiance-pose.js`, qui ne connaît aucun lien : deux liens dans un même cadre se prendraient les réponses) ;
   aucune n'écrit la sienne. Ce qui suit est ce que le kit fait pour elle (et ce qu'une app sans le kit devrait refaire : elle prend le kit, guide des apps 1.2, points 1 et 4, et règle 15).
   Elle lit `contexte.ambiance` à son démarrage et l'événement `ambiance` ensuite, sans recharger son cadre. Elle
   pose les jetons **par le CSSOM** (`document.documentElement.style.setProperty`, jamais un attribut `style` ni une feuille de style écrits
   à partir du message : sa politique de sécurité du contenu les refuse), ceux du mode qu'elle affiche (`clair` ou `sombre`, d'après le message `theme` de
   Grist, 4.2), et **ne pose que les jetons qu'elle connaît** (sa liste, celle du kit), après avoir vérifié que chaque nom est de la forme
   `--[a-z0-9-]+` et chaque couleur un `#rrggbb` ; une valeur de forme qui contient `;`, `{`, `}`, `url(` ou `@import` est ignorée. Elle retire tout ce
   qu'elle avait posé quand elle reçoit `null` (ou une autre ambiance), au lieu de laisser des restes. Une app qui ne lit pas un jeton de
   forme **garde sa forme et prend les couleurs** : rien ne casse, et l'ambiance d'une app peut être plus sobre que celle de GFS. L'ambiance
   ne vaut que pour ce que l'app affiche à la personne : **jamais pour ce qu'elle produit** (un e-mail, un document, un PDF, un
   formulaire public), qui garde la charte de l'app ou du modèle (comme le thème sombre, cahier 3.4).
   GFS envoie l'événement **une seule fois par geste** (un geste qui change l'ambiance et la couleur à la fois n'en envoie qu'un), rien
   quand le choix redit ce qui vaut déjà ; un changement de mode (clair, sombre) n'en envoie aucun, puisque le message porte les deux.
   Le nom est `ambiance` et non `theme` pour ne pas se confondre avec le message `theme` de Grist, que GFS relaie tel quel.
   Une app seule n'a pas d'ambiance de GFS : `null`, elle garde ses couleurs (ou son propre choix de couleur, s'il en est).
   [M] **Mesuré le 03/11** (avec Néon, remplacé par Enseigne le 04/11 : les mesures qui le nomment sont celles de l'ancienne ambiance, refaites pour Enseigne dans le dernier paragraphe de ce point) dans un vrai Grist, à la vraie souris et au vrai clavier, en français et en anglais, en clair et en sombre :
   `run-theme.mjs` et la sonde M (une app minimale qui fait ce que feront les apps avec leur consigne) passent leurs 86 vérifications
   (38 pour les ambiances, 42 pour la couleur libre et 6 pour un kit introuvable, plus bas) dans chacune des quatre combinaisons à 700 × 400, et dans une cinquième à 420 de large. Sans choix, la page ne porte aucun jeton de GFS
   (le seul réglage en ligne est le `color-scheme` que le script d'API de Grist pose lui-même, faits vérifiés 17) et garde son aspect
   d'origine ; chaque choix se pose tout de suite sur la page (de 36 à 47 jetons selon l'ambiance : dix-neuf de couleur, le reste de forme), se retient dans les deux
   clés, repart dans la même ambiance au rechargement, et « Revenir à Grist Factory » les retire toutes. La fenêtre tient dans le panneau
   (349 à 358 de haut, sans défilement) dans les cinq ambiances ; le clavier y entre sur la vignette choisie, les flèches choisissent,
   Tab la traverse sans s'arrêter sur chaque vignette, Échap rend le clavier au bouton « Réglages ». Chaque texte de l'explorateur et de la
   fenêtre garde 4,5:1 au moins, mesuré sur les couleurs affichées (fonds superposés mélangés, arrêts pleins d'un dégradé compris), dans les cinq ambiances. L'app ouverte reçoit
   l'ambiance dans son `contexte` (dix-neuf jetons par mode et la forme), puis un seul événement `ambiance` par geste, `null` au
   retour à l'origine, rien quand le choix redit ce qui vaut déjà, et son cadre n'est jamais reconstruit. Un navigateur qui refuse
   le stockage garde le choix pour la page, et la fenêtre le dit.
   [M] **Mesuré le 03/11, la couleur libre** (même essai, mêmes combinaisons, sélecteur de couleur du kit 0.5.0, `4d7f556`, chargé à la
   première ouverture de la fenêtre « Thème » depuis `prototype/kit/`) : « Choisir ma couleur » ouvre la palette (50 pastilles, 419 × 171 à
   700 × 400) au-dessus du bouton, dans le panneau, sans défilement, sans cacher son bouton ; une pastille pose la couleur tout de suite (les
   dix-neuf jetons de couleur de chaque mode et rien d'autre : la `forme` de Grist Factory est vide), la retient (`gfs.couleur`, en minuscules,
   absente au retrait) et la fait suivre à l'app ouverte par **un seul** événement `ambiance` (`couleur` : la couleur choisie, `null` à son
   retrait avec l'ambiance d'origine). Les flèches, Début et Fin (sans bouclage), Tab (qui sort de la palette en la refermant), Entrée, Échap
   (qui ne ferme que la palette, ou que la fenêtre « Couleur personnalisée », jamais celle du dessous), le clic ailleurs et le clic sur le voile
   se comportent comme ceux d'un menu. « Personnalisé… » ouvre « Couleur personnalisée » (480 × 290, sans défilement) par-dessus la fenêtre
   « Thème », qui devient inerte ; Tab y tourne sans en sortir ; un code faux marque le champ et grise « Appliquer » ; « Annuler » et Échap
   n'appliquent rien ; Entrée dans le code applique. « Celle de l'ambiance » rend la couleur, « La mienne » reprend la dernière couleur à soi
   de la fenêtre ouverte (faute de l'avoir, elle ouvre la palette ; refermée sans choix, la fenêtre redit la vérité). Une couleur qui ne tient pas
   le contraste est éclaircie ou assombrie (`ajustee`) et la fenêtre le dit ; sans stockage, la couleur vaut pour la page seulement. Chaque texte
   de la palette et de la fenêtre garde 4,5:1 au moins. Un kit qui ne se charge pas (le sous-module n'est pas servi) grise « La mienne » et son
   bouton, dit la raison dans la fenêtre et une seule fois dans la console, et les ambiances marchent : le navigateur garde l'échec d'un `import()`
   jusqu'au rechargement de la page, la fenêtre le dit (« Recharge la page pour réessayer ») et, rechargée, la palette s'ouvre.
   [M] **Mesuré le 03/11, une app écrite avec le kit** (`run-ambiance-kit.mjs` et la sonde N, `labo/sondes/n-ambiance-kit/` : une app qui démarre `Ambiance.start()` du
   kit 0.6.0 (`8afa569`), dont la feuille lit les jetons de la charte et de forme ; sous la politique d'une app hébergée, `default-src 'none'; script-src 'self'; style-src 'self';
   base-uri 'none'; form-action 'none'`, dans le cadre isolé de GFS ; 18 vérifications dans chacune des quatre combinaisons à 700 × 400, aucune en échec). Sans choix, le kit
   n'a rien posé (seule reste la propriété de page que l'app s'est donnée) et `ready` s'est réglé sans repeindre. Pop arrive par un seul événement ; le kit pose les dix-neuf jetons
   de couleur du mode de l'app et les 28 de forme (48 propriétés avec celle de l'app), et les valeurs calculées de la page sont celles du message (l'accent, la carte, le bouton plein,
   l'arrondi, la police du titre). Le mode de l'app change (la préférence du système) : les jetons suivent sans événement de GFS, la forme reste, rien de plus n'est posé. Chaque texte
   de l'app (sept mesurés : le titre, les textes, le lien, les deux boutons) garde 4,5:1 au moins dans les quatre ambiances, en clair et en sombre. Une pastille de la palette du kit
   change l'accent de l'app par un seul événement, avec la forme de Pop ; « Revenir à Grist Factory » : l'app reçoit `null`, le kit retire tout ce qu'il avait posé et rien d'autre, la
   page retrouve les couleurs de la charte ; une app ouverte après le choix (Néon) reçoit l'ambiance dans son contexte et la pose avant que `ready` se règle (46 propriétés). Le cadre de
   l'app n'est jamais reconstruit et elle ne voit aucun refus de la politique de sécurité du contenu (le CSSOM passe sous `style-src 'self'`). Deux pièges vus : un fond de page écrit
   `--main-bg` (le fond de la carte de GFS, `transparent` chez Néon) laisse un titre clair à 1,10:1 en sombre (le guide dit `--bg`), et le décor `--wash` sur un élément plus court que la
   page se répète à chaque hauteur de contenu (`min-height: 100vh`).
   [M] **Mesuré le 04/11, les vraies apps** (`run-ambiance-apps.mjs`, faits vérifiés 23 : Form+ à `0de37ac` et Automation+ à `bb8a8dd`, servies par GFS dans un vrai Grist, 700 × 400, huit passes en français et en anglais, en clair et en sombre).
   Dans chaque écran où passe une personne (quatre chez Automation+, sept chez Form+) et chacune des quatre ambiances, le kit pose les dix-neuf jetons de couleur du mode tels que GFS les calcule, le fond de la page est `--bg` et chaque texte garde
   4,5:1 au moins (32 mesures par passe chez Automation+, 56 chez Form+, aucune en échec) ; la couleur libre, « Revenir à Grist Factory » (l'app retrouve ses couleurs, dans le même cadre) et l'app ouverte après le choix passent. Une app qui attend
   l'ambiance avant de s'afficher (Automation+ : `html[data-gfs-pending]`, levé par `ready`, 2 s au plus) porte déjà Néon à son premier affichage ; une qui ne l'attend pas (Form+) se montre de 66 à 100 ms dans ses couleurs d'origine avant de les
   changer : un constat, pas un manquement (le guide dit d'appeler `Ambiance.start()` avant d'afficher, il ne dit pas de retenir l'affichage). L'en-tête d'un déclencheur et celui d'une action d'Automation+ restent distincts dans les quatre ambiances, en clair et en sombre (écart de couleur OKLab de 0,145 au plus bas, Papier en sombre ; l'app seule : 0,299 en sombre).
   [M] **Mesuré le 04/11, Enseigne et l'accessibilité renforcée** (faits vérifiés 37 : `run-theme.mjs` dans un vrai Grist, quatre passes à 700 × 400, 110 vérifications chacune, aucune en échec ; `test/interfaces-firefox.test.mjs` dans un vrai Firefox 159 ; `test/ambiance.test.mjs` et `test/theme.test.mjs`).
   **Enseigne** pose 50 jetons en ligne (dix-neuf de couleur, 31 de forme ; 66 avec les couleurs de type de GFS, qui ne vont pas aux apps), l'app ouverte la reçoit dans son contexte (31 jetons de forme), chaque texte y garde 4,5:1 (67 textes). **L'accessibilité renforcée** : l'interrupteur
   tient sur une ligne de 30 px dans la fenêtre « Thème », qui reste dans 700 × 400 sans défilement du corps (354 px de haut sur chacune des cinq ambiances) ; allumé, la page porte `data-ambiance="renforcee"` et 52 jetons (dix-neuf de couleur, 33 de forme), `gfs.acces` est écrite et rien d'autre ; chaque texte de
   l'explorateur et de la fenêtre y garde 7:1 au moins (4,5:1 pour un grand texte) et chaque commande un trait à 3:1 au moins, sur chacune des cinq ambiances (67 textes et 23 traits par ambiance). L'app ouverte reçoit un message d'`id` `renforcee` (dix-neuf jetons par mode, 33 de forme, sans couleur
   libre), un seul événement par geste ; éteint, elle reçoit l'ambiance choisie ; « Revenir à Grist Factory » défait l'ambiance et laisse l'accessibilité ; le cadre de l'app n'est jamais reconstruit. Le kit 0.6.0 prend le message tel quel (`normalizeAmbiance`). Le moteur le tient pour toute couleur libre :
   7,050:1 au plus bas pour le texte et 3,050:1 pour le trait, sur les cinq ambiances et 169 couleurs. **Non mesuré** : les vraies apps (Form+, Automation+, Publipostage+) en accessibilité renforcée ; le clavier sous le Firefox du porteur.

11. [T] `lecteur.afficher`, `lecteur.deplacer`, `lecteur.masquer`, `lecteur.fermer` : **GFS pose le lecteur d'une vidéo par-dessus le cadre de l'app** (demande de Slides+, 06/11 ;
   étude `docs/etude-lecteur-video.md` ; choix du porteur du 07/11, « Politique élargie » ; déclaration : 3.4, point 7). Le cadre isolé d'une app ne peut pas jouer une vidéo de
   YouTube ou de Vimeo (faits vérifiés 50) ; l'app dit donc à GFS **quoi** jouer et **où** se trouve sa vignette, GFS monte l'adresse et pose le cadre. Les quatre appels n'ont pas
   d'`id` d'appel (GFS ne répond rien) ; un refus (`GFS_REFUSE`) se lit en console (avertissement : l'app, l'appel, la raison). Chaque appel porte l'`id` de la lecture, un mot en
   minuscules (`^[a-z][a-z0-9_-]{0,63}$`) que l'app choisit.
   - `lecteur.afficher { id, fournisseur, video, debut?, rect, zone }` : `fournisseur` est l'un de ceux que l'app a déclarés ; `video` est **l'identifiant seul** de la vidéo
     (YouTube : 11 signes, lettres, chiffres, `_` et `-` ; Vimeo : les chiffres, avec au besoin `/<clé>` pour une vidéo non listée), **jamais une adresse** : GFS monte lui-même
     l'adresse (`https://www.youtube-nocookie.com/embed/<video>?rel=0&playsinline=1&autoplay=1[&start=<debut>]`, ou `https://player.vimeo.com/video/<numéro>[?h=<clé>]&autoplay=1[#t=<debut>s]`) ;
     `debut` est un nombre entier de secondes (0 à 360 000) ; `rect` est le rectangle de la vignette et `zone` celui où elle peut se voir (la part visible de son défilement), tous deux
     `{ x, y, largeur, hauteur }` en pixels du cadre de l'app (origine en haut à gauche), nombres finis, largeur et hauteur au moins 0. **Un seul lecteur à la fois** : un nouvel
     `afficher` remplace le précédent.
   - `lecteur.deplacer { id, rect, zone }` : la vignette a bougé (défilement, zoom, redimensionnement) ; `lecteur.masquer { id, masque }` : cache (`true`) ou remontre (`false`) le lecteur sans
     l'arrêter, quand la vignette sort de la vue ou qu'un menu de l'app la recouvre ; `lecteur.fermer { id }` : le retire. Un `id` qui n'est pas celui du lecteur de cette app ne
     change rien, sans refus : **une app ne touche qu'à son propre lecteur**.
   - **Où GFS le pose** : dans la page de GFS, dans le repère des cadres, à `rect` rogné à `zone` et au cadre de l'app (la partie qui se voit ; le cadre du fournisseur garde sa taille
     entière, décalé de la part coupée) ; rien à montrer, il est caché sans être arrêté. Il passe sous la barre, les fenêtres et les menus de GFS. Un cadre qui change de taille
     (le panneau) le déplace du même écart. **Il disparaît quand l'app est cachée** (l'explorateur s'ouvre) **ou fermée** : une vidéo ne joue pas derrière lui, et
     rien ne revient seul.
   - **Le cadre du fournisseur** : `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"` (il garde l'origine de son site, dont il a
     besoin pour son stockage ; il ne peut ni naviguer GFS, ni ouvrir de fenêtre modale, ni envoyer de formulaire), `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`,
     `referrerpolicy="strict-origin-when-cross-origin"` (YouTube refuse un lecteur sans référent). Grist ne délègue à GFS que `clipboard-write` (faits vérifiés 50) : la liste d'`allow` ci-dessus
     est ce que GFS demande, pas ce qu'il obtient. Mesuré avec un faux lecteur, `autoplay`, `encrypted-media` et `fullscreen` sont **refusés** au cadre du lecteur : attendre que la vidéo démarre
     sans un second clic sur le ▶ du fournisseur, ou qu'elle passe en plein écran, serait promettre ce que personne ne peut tenir ; ce que les vrais sites font sans eux reste à mesurer (plus bas).
   - **Pas encore construit** : l'événement `lecteur { id, etat }` (`lecture`, `pause`, `fin`, `erreur`), qui demanderait au routeur une troisième classe de source (le cadre du fournisseur,
     ni app ni GFS) ; sans lui, l'app garde sa vignette ouverte à la fin de la vidéo et ne retombe pas sur l'onglet quand le fournisseur refuse (le lecteur affiche alors le message du site).
     L'app qui l'écoute (`GfsLink.onPlayerEvent`) ne reçoit simplement rien. `Escape` et le clic ailleurs sont à l'app : elle appelle `lecteur.fermer`.
   [M] **Mesuré le 07/11** (faits vérifiés 56) avec la vraie Publipostage+ à `987a338` dans un vrai Grist 1.7.19 (Chromium, 700 × 400, `prototype/labo/run-lecteur.mjs`, 36 vérifications, aucune en échec, en français clair et en
   anglais sombre), les pages de YouTube et de Vimeo étant remplacées par une page d'essai (`page.route` ; le cloud n'atteint pas ces sites) : `GfsLink.players()` rend `["youtube", "vimeo"]` ; `afficher` pose un cadre
   dont l'adresse et les attributs sont ceux ci-dessus, à l'endroit exact de la vignette dans la page (320 × 180 à 100, 80 du cadre de l'app) ; la politique de GFS le laisse passer (le navigateur demande la page
   aux deux sites) et refuse un troisième (témoin, Dailymotion) ; `deplacer` rogne la fenêtre à la zone (110 × 140 pour une vignette de 320 × 180 coupée en haut et à droite, le cadre du fournisseur décalé de
   −40 px) et la cache quand la zone ne touche pas la vignette ; `masquer` cache et remontre ; Vimeo remplace YouTube (un seul lecteur), avec la clé de la vidéo non listée ; une adresse à la place d'un identifiant,
   un site inconnu et un rectangle mal formé sont refusés, dits en console, sans rien changer ; à la vraie souris, le milieu de la vignette trouve le lecteur et le reste du cadre trouve l'app ; le panneau passé de 700 × 400
   à 760 × 440 déplace le lecteur avec le cadre de l'app ; le bouton « Fichiers » de la barre retire le lecteur, et l'app rouverte n'en retrouve aucun. **Le clavier dans le lecteur (mesuré le 07/11, section 8 de `run-lecteur.mjs`, 43 vérifications au total, aucune
   en échec)** : après un clic dans le lecteur, l'élément actif de la page de GFS est le cadre du fournisseur ; la touche Échap, tapée à la vraie touche, arrive à ce cadre
   et à lui seul : ni la page de GFS, ni l'app, ni la page de Grist ne la reçoivent (trois écoutes en capture). **Aucune touche tapée dans le lecteur n'atteint donc GFS ni l'app,
   et rien de leur côté ne peut la capter** ; ce qui ferme le lecteur est le clic ailleurs dans l'app (son écoute de la souris), le changement de diapositive, le bouton « Fichiers »
   de la barre et `lecteur.fermer`. Un bouton « Fermer » posé par GFS, ou la fermeture quand le focus revient à la page de GFS, ne sont pas construits (interface de plus : le porteur
   choisit après son essai avec une vraie vidéo, avec l'événement `lecteur`). **Non mesuré** : les vrais YouTube et Vimeo (démarrage, son, lecture
   automatique, plein écran : le porteur, sous Firefox, avec une vraie vidéo), Firefox dans un vrai Grist (sans Grist, le lecteur est mesuré sous Firefox 160 depuis le 10/11 : faits vérifiés 78, sauf la touche Échap dans le lecteur), le Grist de la DINUM, l'événement `lecteur` (pas construit).

12. [T] **`natives`** (choix du porteur, 11/11 : « chez GFS, comme pour Plotly » et « fonction par fonction » ; étude `docs/etude-cdn-ou-copie.md` ;
    mesuré le 11/11 dans un vrai Grist, faits vérifiés 93) : `{ "<id de bibliothèque>": { "version", "src", "integrite", "forme" } }`, dans le
    contexte et dans l'événement `extensions` (point 2), **seulement pour les bibliothèques natives dont la personne a choisi la copie figée** ;
    `{}` quand tout est au CDN (le défaut). L'app qui lit ce champ compare `version` à celle de sa liste : égale, elle charge la copie par `src`,
    avec `integrite` et `crossorigin="anonymous"` (`'self'` suffit, point 5) ; différente ou absente, elle charge par **son** CDN, celui que sa CSP
    nomme déjà. **GFS ne donne jamais l'adresse d'un CDN pour une bibliothèque native** (2.6, point 14) : l'app qui ne lit pas le champ reste au
    CDN, comme avant. Pour une fonction, GFS ne dit « copie figée » que si **toutes** ses bibliothèques sont dans son catalogue à la version que le
    manifeste déclare ; sinon la fonction reste au CDN et la fenêtre la grise avec la raison (7.3, point 3). Ce que la personne choisit se retient
    dans `modes` de la table de GFS, sous la clé `natif:<fonction>` (7.4, point 1). Côté app, le kit rend `GfsLink.native(id)` (0.18.0) et appelle
    `onExtensions` quand seule une copie figée change. **L'éditeur (TipTap, ProseMirror) n'est pas dans ce champ** : sa copie est une carte
    d'importation rangée dans l'app, que sa page pose avant la réponse de GFS ; le choix lui arrive dans l'adresse du cadre
    (`copie=editeur`, 1.3 point 3 ; `GfsLink.copies()`, kit 0.19.0), pas dans le contexte ni par événement, et prend effet au prochain démarrage.

13. [D] `correcteurs` : **le bouton « LanguageTool » de la barre** (demande du porteur, 12/11 ; mesuré le même jour, faits vérifiés 104). Un correcteur du navigateur
    (LanguageTool) juge chaque cadre d'après sa propre adresse : son interrupteur « pour ce site » ne coupe donc rien dans le cadre d'une app (l'adresse de l'app n'est pas
    celle de Grist), et un gros document le fait ramer. **GFS ne peut ni couper l'extension ni toucher au texte d'une app** (cadre isolé) : il retient deux choix de la personne
    et le dit à l'app. La ligne **« Bouton LanguageTool »** du menu « Réglages » (une case à cocher, éteinte au départ) met un sixième bouton dans la barre, entre « Table de travail » et
    « Position de la barre » ; enfoncé, LanguageTool travaille ; relevé, il est coupé dans les apps ; son nom et son info-bulle disent l'état. **Sans le bouton rien n'est coupé** : GFS
    laisse les correcteurs comme le navigateur les fait ; le choix de couper est gardé et reprend quand le bouton revient. Retenu dans le `localStorage` de GFS (jamais dans le document ;
    clés `gfs.langtool` : le bouton est dans la barre, et `gfs.correcteurs` : coupé ; absentes tant que la personne n'a rien voulu), suivi d'un onglet ou d'une section à l'autre ;
    si le navigateur refuse de retenir, le choix vaut pour la page et GFS le dit (comme la langue). **Le message** : `{ "coupes": true | false }`, dans `contexte.correcteurs` (relu à chaque
    appel, `{ "coupes": false }` pour une app seule ou sans choix) et dans l'événement `correcteurs` (`{ "correcteurs": { "coupes": … } }`), **une seule fois par changement de `coupes`** : cocher
    la ligne ou la décocher alors que le choix de couper est éteint n'envoie rien. **Ce que fait l'app** : sur chacun de ses éléments éditables **eux-mêmes** (`[contenteditable]` qui n'est pas
    `"false"`, `textarea`, `input` de texte), présents et à venir, elle pose `data-lt-active="false"` quand `coupes` est vrai et la retire quand il est faux, à chaud, sans recharger
    son cadre (le porteur l'a mesuré : LanguageTool relit la marque à chaud ; posée sur un élément qui entoure la zone, elle ne coupe rien). Le kit en fait la pose : `Correcteurs.start()`
    (`js/correcteurs.js`, kit 0.22.0), qui lit `contexte.correcteurs` à son démarrage et l'événement ensuite, et surveille les zones qui naissent après. Une app qui ne l'appelle pas
    n'est pas touchée : le bouton est sans effet sur elle (GFS ne le grise pas : il n'a aucun moyen de savoir si l'app lit le champ). [M] **Mesuré le 12/11** dans un vrai Grist (`labo/run-correcteurs.mjs`,
    sonde ZL qui pose la marque comme le fera le kit : 29 vérifications en français et en anglais, en clair et en sombre) et sous Firefox 160 sans écran (menu « Réglages » à cinq lignes, barre à
    six boutons sur les quatre bords) ; la réponse de LanguageTool lui-même est celle du porteur (faits vérifiés 104).

### 5.3 Le stockage du navigateur

Dans un sous-cadre à origine opaque, les cinq stockages (`localStorage`, `sessionStorage`, cookies, `indexedDB`, cache) sont
refusés (mesuré à l'étape 2, décision d'isolement du 16/10). GFS garde donc à leur place les choix de chaque app (thème,
raccourcis, zoom…) et les lui rend. **Le porteur a demandé le 21/10 de le faire tout de suite**, sans attendre l'étape 5 :

1. [T] La lecture est immédiate, dans une copie en mémoire remplie au démarrage : par le navigateur quand l'app est seule, par
   `contexte.stockage` dans GFS, un objet `{ clé: valeur }` qui est l'espace de **cette** app. GFS le relit à chaque appel
   `contexte` : un cadre qui se recharge retrouve ce qu'il avait écrit. L'écriture suit : `stockage.ecrire` avec
   `{ cle, valeur }` (`valeur: null` retire la clé).
2. [D] Les clés sont des chaînes de 1 à 64 caractères parmi `A-Z a-z 0-9 _ . : -`, les valeurs des chaînes (la chaîne vide en
   est une), comme `localStorage`. Le courtier range tout sous l'`id` de l'app, déduit de la fenêtre qui écrit (1.2), jamais
   d'un champ du message : une app ne voit, ne change et ne vide que son espace.
3. [D] Un appel sans `id` n'attend rien (5.1, point 2). Avec un `id`, la réponse est `{ retenu: true | false }` : `false` dit que
   le navigateur a refusé de garder la clé (point 5). Une clé, une valeur ou un identifiant hors règle reçoit `GFS_REFUSE`, un
   espace qui dépasserait son quota `GFS_QUOTA` (3.6) : rien ne change. Sans `id`, l'app n'apprend rien ; GFS le dit en console
   (avertissement : l'app, le code et la raison), ce que lit l'auteur de l'app.
4. [D] GFS garde ces espaces dans son propre `localStorage`, sous `gfs.stockage.<id>.<clé>` (un `id` n'a pas de point, 2.2 : la clé,
   qui peut en avoir, commence après le premier), dans un `try/catch`. **Quota : 1 Mo par app**, soit 1 048 576 caractères, clés
   et valeurs comptées (des unités UTF-16, ce que le navigateur compte lui-même). Un remplacement qui n'agrandit pas l'espace
   passe toujours : une app au-dessus de son quota peut se vider. Les douze clés de Publipostage+ (`pp_theme` à `pp_news_seen`, puis `pp_bubble_marks`, 22/10)
   font une dizaine de ko ; `pp_schema_…` (un instantané du schéma par document, lourd) n'y entre pas, à voir à l'étape 5.
5. [D] Un navigateur qui refuse de garder une clé (cadre sans stockage, quota du navigateur) n'arrête rien : la valeur vaut
   jusqu'au rechargement de la page de GFS (le contexte la rend), la réponse dit `retenu: false`, et le quota de GFS vaut encore.
6. [D] **Portée.** Par navigateur de la personne (son profil), non par compte Grist : on ne retrouve pas ses choix sur un autre
   navigateur ni un autre ordinateur. Les mêmes dans tous ses documents de l'instance de Grist : le navigateur sépare le
   stockage d'un cadre selon le site qui l'héberge, donc une autre instance a les siens (mesuré au labo : une page de GFS ouverte
   seule ne partage pas le stockage de son cadre dans Grist, `run-langue`, partie 7).
   Les onglets déjà ouverts ne sont pas prévenus ; l'app relit au prochain `contexte`. Une écriture ne touche qu'une clé : deux
   onglets qui écrivent des clés différentes ne s'écrasent pas, sur la même clé la dernière écriture gagne. Ce n'est pas une
   écriture du document : cela marche en lecture seule (par construction, non mesuré : le labo n'a pas de document en lecture
   seule), et le manifeste n'a rien à déclarer.
7. [T] Un choix gardé par navigateur (thème, zoom, raccourcis) reste un confort : l'app marche sans lui (cahier 5.7). La
   langue en est sortie : c'est un seul choix par personne, que GFS garde lui-même (5.2, point 6). L'espace de GFS n'est pas
   celui de l'app seule : un réglage de navigateur fait seule ne suit pas dans GFS, et c'est sans perte de données.
8. [M] **Mesuré le 21/10** dans un vrai Grist, à 700 × 400, en français clair et en anglais sombre
   (`prototype/labo/run-stockage.mjs`, 25 vérifications par combinaison ; avec le courtier d'avant, six échouent) avec deux sondes,
   S et T (`labo/sondes/s-stockage/`, deux identifiants), qui font ce que fera Publipostage+ : le sous-cadre refuse son propre
   `localStorage` ; le contexte rend un espace vide au départ ; un appel sans `id` n'a aucune réponse, avec un `id` il reçoit
   `{ retenu: true }` ; la clé est chez GFS sous `gfs.stockage.<id>.<clé>` et le document n'a reçu aucune écriture ; le cadre de
   l'app rechargé, puis GFS rechargé, retrouvent les valeurs ; la sonde T ne voit rien de l'espace de S, et un message de T qui
   nomme l'app S écrit quand même dans l'espace de T ; `null` retire la clé ; une clé ou une valeur hors règle reçoit
   `GFS_REFUSE` sans rien écrire, et sans `id` GFS le dit en console ; pile 1 048 576 caractères passe, un de plus reçoit
   `GFS_QUOTA` ; un navigateur qui refuse d'écrire donne `{ retenu: false }`, la valeur vaut pour la page (le contexte la rend à
   l'app rechargée) et disparaît avec la page de GFS. **Non mesuré** : un second onglet, un second document, Firefox, Safari.
   **Avec l'app, le 21/10 au soir** : Publipostage+ à `487d66b` (`prototype/labo/run-stockage-publipostage.mjs`, 12 vérifications
   par combinaison, mêmes conditions) : le thème choisi dans ses Réglages, à la souris puis au clavier, et le zoom de la page
   (Ctrl + plus) arrivent chez GFS sous `gfs.stockage.publipostage.*`, sans lot au document ni refus du courtier ; GFS rechargé,
   l'app revient dans ce thème et à ce zoom ; Ctrl + 0 retire la clé du zoom. **La douzième clé, mesurée le 22/10** avec `865afa3`
   (`run-stockage-publipostage`, partie 6, 19 vérifications par combinaison) : « Mise en forme » (les bulles et les puces de
   l'éditeur), choisi à la souris dans Réglages > Thème, s'applique à l'instant, arrive chez GFS sous
   `gfs.stockage.publipostage.pp_bubble_marks`, sans lot au document ni refus du courtier, et le choix survit au rechargement du
   cadre (case cochée, attribut posé dès le départ).

### 5.4 Les actions

| Action | Appel | Réponse | Dans l'app seule |
|---|---|---|---|
| **ouvrir** | app → GFS : `{ app, fichier: { id, type }, raison? }` ; GFS → app active : `{ fichier, type, dossier, raison, importation?, lecture? }` | `{ ouvert: true \| false }` (`false` si la personne annule la question de l'app) | l'app ouvre ses propres fichiers ; ceux d'une autre app sont grisés, texte commun |
| **choisir** | app → GFS : `{ types, apps?, titre? }` | `{ app, id, nom, type }`, ou `null` si la personne annule | la liste avec recherche de l'app, sur ses propres fichiers |
| **ranger** | app → GFS : `{ fichier, nom, type?, lot?, suivants?, dossier? }` | `{ statut, id, nom }` : `statut` vaut `ajoute`, `remplace`, `copie` ou `ignore` | l'app donne le fichier à télécharger, comme avant |
| **inserer** | app qui reçoit → GFS : `{ formats, types? }` ; GFS → app qui fournit : même corps | `{ rendu }` (ci-dessous) | grisé, texte commun |
| **installer** | app → GFS : `{ extension, fonction? }` | `{ actives: [ … ] }` : les extensions actives après le choix de la personne | la fenêtre du grisé (guide des apps, section 5) |
| **fermer** | GFS → app active : `{ raison }` | `{ ferme: true \| false }` | sans objet |
| **rester** | GFS → app active : `{ raison }` (celle du `fermer` auquel elle avait dit oui) | `{ repris: true \| false }` | sans objet (`GFS_INCONNU` : l'app n'a rien arrêté qu'elle sache) |
| **supprimer** | GFS → app active : `{ fichier: { id, type }, raison }` | `{ fait: true \| false, dit? }` | sans objet (l'app garde sa gestion) |
| **dupliquer** | GFS → app active : `{ fichier: { id, type }, nom }` | `{ id, nom?, dit? }`, ou `{ dit }` sans `id` | sans objet (l'app garde sa gestion) |

1. [T] **ouvrir** : GFS ferme d'abord l'app active (« fermer »), active l'app du fichier et lui passe `ouverture` (5.2). Si
   l'app du fichier est déjà active, GFS lui envoie l'appel `ouvrir` : elle ouvre le fichier, après sa propre question
   d'enregistrement. Le type demandé doit figurer dans `actions.ouvrir` du manifeste de l'app visée ; une app non installée
   est listée grisée avec « Installer ». « Nouveau » est `ouvrir` avec `fichier: null` et un `type` : l'app ouvre un fichier
   vierge de ce type et le crée à son premier enregistrement ; si son manifeste déclare `colonnes.dossier`, elle y écrit
   `dossier` (sinon le fichier arrive à la racine). [D]
   Quand l'app est déjà active, GFS (prototype V0.3) n'envoie l'appel qu'à une app qui a déjà demandé son `contexte` : avant, elle
   y lit l'`ouverture`, celle du dernier clic, rendue une seule fois (5.2, point 3). L'appel n'a pas de délai. `{ ouvert: false }`
   (la personne a annulé dans l'app) ne se commente pas ; `GFS_INCONNU` (l'app n'a pas la porte) vaut la phrase provisoire ;
   toute autre erreur est dite avec le texte de l'app ; une app retirée ou remplacée pendant l'attente abandonne l'appel sans
   rien dire. [D] **Mesuré le 16/10** dans un vrai Grist, à la vraie souris, avec une app d'essai (sonde O, `run-ouvrir.mjs`) :
   le double-clic, « Nouveau », l'annulation, l'erreur, l'appel inconnu, l'attente sans réponse et le retrait de l'app pendant
   l'attente ; les messages vont et reviennent par le routeur jusqu'à un cadre isolé. [M] **Mesuré le 19/10 avec Publipostage+**
   (la version que GFS référençait alors, `abfb600` ; `run-ouvrir-publipostage.mjs`, à 700 × 400, à la vraie souris, en français
   et en anglais, en clair et en sombre) : le double-clic lance l'app sur le modèle cliqué, avant le ★ ; l'app déjà ouverte
   change de modèle dans son cadre, sans rechargement ; le modèle déjà ouvert ne change rien ; avec des modifications en
   attente, l'app pose sa question dans le panneau et GFS attend sans rien dire (« Annuler » : l'app reste, « Abandonner » :
   elle ouvre, « Enregistrer » : son écriture passe par GFS pendant que l'appel attend, puis elle ouvre) ; un fichier rangé
   dans un dossier s'ouvre aussi ; l'ouverture n'écrit rien dans le document (ni modèle, ni ★, ni réglage de la vue). [M] **«
   Nouveau » mesuré le 19/10 avec Publipostage+ à `71287c4`** (sa consigne 014, `bfbe112` ; `run-ouvrir-publipostage.mjs` et
   `run-diapositives.mjs`, mêmes conditions) : l'app ouvre un modèle vierge du type demandé, pour les cinq types (le document
   au démarrage de l'app, à la place du ★ ; la grille, l'e-mail et le macro-modèle quand elle est déjà ouverte ; la
   présentation avec l'extension « Diapositives » cochée). Le coin d'état garde son avertissement « modèle non enregistré ».
   Avec des modifications en attente, l'app pose sa question (Enregistrer, Abandonner, Annuler) et GFS attend sans rien dire.
   Rien n'est écrit dans le document avant le premier « Enregistrer » de la personne. `ACCEPTS_OPEN` passe donc `nouveau` à
   `true` pour Publipostage+ : GFS ne dit plus sa phrase provisoire pour cette app, et la garde pour une app qui n'accepte
   pas l'ouverture (Automation+ aujourd'hui). [M] **Mesuré le 22/10 avec Form+ à `c249c4a`** (sa consigne 010 ;
   `run-ouvrir-form.mjs`, mêmes conditions, sur la copie et sur le site en ligne) : le menu « Nouveau » gagne « Formulaire »
   (grisé tant que l'app n'est pas installée, un clic dit pourquoi) ; dans un document sans formulaire, « Nouveau » lance l'app
   sur son écran de départ, sans phrase de GFS, et la table `FormPlus_Formulaires` n'existe toujours pas ensuite ; le
   double-clic d'un formulaire lance l'app sur CE formulaire (son titre, ses questions), l'app déjà ouverte change de formulaire
   dans son cadre sans le recharger, le même deux fois ne change rien ; le changement de langue recharge l'app, qui rouvre son
   formulaire (la ligne ouverte est gardée chez GFS, `formplus_open_row`). `ACCEPTS_OPEN` passe donc `fichier` et `nouveau` à
   `true` pour Form+. **Deux écarts de l'app, dits à Form+ (sa consigne 012, point 4)** : avec des formulaires enregistrés, « Nouveau »
   lancé quand l'app n'est pas ouverte rouvre un ancien formulaire au lieu de l'écran de départ (`onOptions` ne lit pas
   `raison: nouveau` : elle prend le formulaire gardé ouvert, sinon `resolveMyDefinition()`, ambiguë dans GFS puisque toutes
   les lignes portent la section partagée de l'hôte) ; l'app déjà ouverte montre bien l'écran de départ, mais laisse l'éditeur
   du formulaire précédent affiché dessous (`showConfig()` ne cache `#editor` que par « Changer de formulaire source »). Le
   labo les écrit en `CONSTAT`, sans les exiger.

   « Importer » (décision du porteur du 22/10) est `ouvrir` avec `fichier: null`, le `type` du format, `raison: importer` et
   `importation: { valeur, fichier }` (5.2, point 3), où `fichier` est le `File` que la personne a choisi. L'app le lit par le
   chemin de son propre menu d'import (mêmes lectures, mêmes refus dits dans son coin d'état, même question « Enregistrer /
   Abandonner / Annuler » avant de quitter un modèle modifié), en fait un modèle vierge du type, sans nom, qui naît à son premier
   « Enregistrer », et répond `{ ouvert: true }` quand ce modèle est ouvert à la fin, `{ ouvert: false }` quand la personne annule
   ou que le fichier est refusé. [D] **GFS ouvre lui-même le sélecteur de fichier** : un champ `file` caché, cliqué dans le geste
   de la personne (un sous-cadre isolé n'a pas ce geste), qui propose les `extensions` du manifeste. Annuler le sélecteur ne change
   rien ; un fichier d'une autre terminaison est refusé par GFS, qui dit celles que le format attend et n'ouvre pas l'app. Le
   fichier part une seule fois : avec l'ouverture, ou avec l'appel `ouvrir` quand l'app est déjà ouverte. **Une app qui ne sait pas
   encore le recevoir** a ses formats grisés, jamais masqués, avec « Pas encore » et, au clic, la phrase qui dit d'importer depuis
   le menu de l'app (`ACCEPTS_OPEN.<app>.importer`, la ligne provisoire de `fichier` et `nouveau` : elle passe à `true` quand le
   `GFS-ETAT.md` de l'app dit la consigne faite et que GFS l'a rejouée). La précaution compte : l'app d'aujourd'hui lit
   « `fichier: null` et un `type` » comme un « Nouveau » ; elle ouvrirait un modèle vierge, dirait `{ ouvert: true }`, et le fichier
   de la personne serait perdu sans un mot. Le kit (`gfs-link.js`, `normalizeOpening`) comme le `gfs-link.js` de Publipostage+ d'avant
   la consigne 035 ne gardent que `fichier`, `type`, `dossier` et `raison` : ils laissent tomber `importation`. Publipostage+ la garde
   depuis `d76430c` (consigne 035 faite le 23/10) ; le kit la garde, avec `lecture`, depuis sa version 0.7.0 (03/11). [M] **Mesuré le 22/10** dans un vrai Grist, à 700 × 400, à la vraie
   souris et au vrai clavier, en français et en anglais, en clair et en sombre (`run-importer.mjs`, avec la sonde P : une app
   d'essai qui fait ce que fera Publipostage+ et qui lit ce qu'elle reçoit ; le labo seul la range dans `ACCEPTS_OPEN`) : « Nouveau »
   gagne « Importer » après un séparateur, avec la flèche des sous-menus ; le sous-menu s'ouvre au clic, à Entrée et à la flèche
   droite, se referme à Échap et à la flèche gauche (le focus revient sur « Importer ») et à un clic à côté ; il se pose à côté du
   menu sans recouvrir « Importer » (le menu « Nouveau » est large : le sous-menu se rétrécit à la place qui reste, ses mentions se
   coupent par « … » et l'infobulle dit la raison en entier) ; les cinq formats du labo sont d'abord grisés (Publipostage+ : « Pas
   encore » pour Excel et Markdown, l'extension « Diapositives » pour PowerPoint ; la sonde, non installée : l'app à installer) et
   leur clic ouvre la phrase ou la fenêtre des apps, jamais un sélecteur de fichier ; la sonde installée, ses deux formats se
   dégrisent, avec leur type et le nom de l'app ; le sélecteur propose les terminaisons du manifeste et un seul fichier ;
   **l'app qui démarre reçoit le `File` dans la réponse à `contexte`, l'app déjà ouverte dans l'appel `ouvrir`, dans le même cadre
   non rechargé : un vrai `File` (`instanceof File`, nom, taille, type, texte accents compris) dans un cadre sans
   `allow-same-origin`** ; un fichier d'une autre terminaison est dit (nom, format, terminaisons) sans rien envoyer ; GFS n'écrit
   aucun avertissement.
   [M] **Mesuré le 23/10 avec la vraie Publipostage+** (`0c37c4b`, `run-importer-pp.mjs`, 33 vérifications dans chacune des quatre
   combinaisons langue × thème, à 700 × 400, à la vraie souris et au vrai clavier) : Excel et Markdown ne sont plus grisés (le type de
   chacun en mention, sa couleur), PowerPoint attend l'extension « Diapositives » puis se dégrise ; **au démarrage**, l'app ouvre le ★ puis
   le fichier le remplace (un document, une grille de trois lignes et deux colonnes, une présentation de deux diapositives et leur bande),
   sans nom ni modèle courant, avec la phrase « … importé. Nommez le modèle puis enregistrez-le. » ; **déjà ouverte** (appel `ouvrir`),
   elle pose sa question « Modifications non enregistrées » dans le panneau (sans « Enregistrer » : le modèle importé n'a pas de nom),
   « Annuler » ne change rien, « Ne pas enregistrer » ouvre le fichier, dans le même cadre non rechargé ; un fichier illisible
   (`faux.xlsx`) est dit par l'app, qui garde son document, sans question ni phrase de GFS ; l'explorateur se ferme et GFS ne dit rien
   à chaque fois, l'app n'ouvre aucun sélecteur de plus de toute la passe, et les imports n'écrivent rien dans le document (les modèles, les
   réglages de la vue).
2. [T] **choisir** : l'explorateur s'ouvre en mode choix, filtré par `types` (et `apps` si elle est donnée), parmi les types que
   les manifestes déclarent dans `actions.choisir`. Un fichier d'une app non installée est grisé, avec « Installer ». `titre`
   est un texte déjà traduit, montré par GFS. [T] **Construit et mesuré le 03/11** (point 7, `run-liens.mjs`) :
   - **La demande** : `types` est une liste de 1 à 16 noms, `apps` (facultative) de même, `titre` un texte, qu'une seule ligne montre,
     de 120 signes au plus. Une forme hors règle est refusée (`GFS_REFUSE`) avant que rien ne s'ouvre ; sous le niveau complet,
     `GFS_ACCES` ; un second `choisir` pendant le premier, `GFS_REFUSE` (le premier continue). L'explorateur ne montre que les
     fichiers dont le type est demandé **et** offert par leur app (`actions.choisir`) : dans Publipostage+, un e-mail ou une macro
     ne se désigne pas, une présentation, oui (`actions.choisir` : document, grille, présentation).
   - **L'explorateur en mode choix** : le titre est celui de l'app (sinon « Choisir un fichier »), précédé de l'icône du lien ;
     « Ouvrir » devient « Choisir » (le bouton principal), « Fermer » devient « Annuler », « Nouveau » est grisé et dit
     pourquoi ; la barre d'information explique le geste tant que rien n'est sélectionné ; la personne se déplace comme
     d'habitude (dossiers, recherche, filtre de type, vues). Un fichier d'une app non installée, ou d'une extension éteinte, est
     grisé comme partout, jamais caché : un double-clic ouvre la fenêtre des apps sur la bonne ligne, et le choix continue
     une fois la fenêtre fermée.
   - **La réponse** : `{ app, id, nom, type }` par le double-clic, Entrée sur le fichier sélectionné ou « Choisir » ; `id` est un
     texte et `nom` le nom du jour (« (sans nom) » à défaut). Annuler (« Annuler », Échap) rend `null`. L'explorateur se
     referme sur l'app, sauf s'il était déjà ouvert avant la demande. Si l'app qui demandait est retirée ou remplacée pendant le
     choix, il s'arrête sans rien rendre et l'explorateur redevient celui de toujours.
3. [D] **fermer** : GFS l'envoie à l'app active, avec `{ raison }`, avant qu'une autre app prenne sa place : `app` (la fenêtre des
   apps), `explorateur`, `nouveau`, `importer` ou `lire` (un fichier d'une autre app, depuis l'explorateur) et `lien` (un lien entre
   apps, point 7) ; il ne détruit son cadre qu'après `{ ferme: true }`. L'app **enregistre avant de répondre** (demande du porteur
   le 04/11 : « gérer les enregistrements automatiques en cas de swap d'app ou de fichier » ; la règle qui suit en est la lecture de GFS) : rien en attente, ou enregistrement
   automatique allumé, elle enregistre ce qui attend (et laisse finir une écriture en cours) puis répond `oui` sans question ; si
   l'écriture échoue, ou si l'enregistrement automatique est coupé et que des modifications attendent, elle pose sa propre question
   (Enregistrer, Abandonner, Annuler) : Enregistrer et Abandonner répondent `oui`, Annuler répond `non` et tout reste en place
   (l'explorateur est refermé pour que sa question se voie). **GFS ne ferme jamais tout seul** : sans réponse au bout de 10 secondes,
   ou si l'app répond par une erreur (une réponse qui n'est ni `oui` ni `non` en est une), une fenêtre de GFS nomme l'app et demande à
   la personne « Fermer quand même » (les modifications non enregistrées sont perdues) ou « Attendre » (sans réponse) / « Rester »
   (sur une erreur) ; « Attendre » suit la réponse de l'app quand elle vient. Une app qui ne connaît pas l'appel (`GFS_INCONNU`, la réponse
   que 5.1, point 3, demande à tout appel inconnu) part comme avant, sans question ; une app qui ne répond à rien, pas même `GFS_INCONNU`, fait
   attendre les 10 secondes puis la question de GFS ; une app qui n'a pas encore demandé son contexte n'a rien à enregistrer, GFS ne lui demande rien. Si
   la personne repart dans l'explorateur avant la réponse, la réponse tardive n'ouvre rien, et **GFS dit « tu restes » à l'app qui vient de répondre `oui`** (choix du porteur le 09/11 : « GFS le lui dit ») : l'appel `rester { raison }`, avec la raison du `fermer`, répond `{ repris: true | false }`. Une app qui a dit `oui` a pu lever son verrou et couper ce qui tournait (Automation+ : son exécution) : à `rester`, elle reprend ce qu'elle avait arrêté. GFS l'envoie à l'app qui a dit `oui` et que la personne garde (retour à l'explorateur avant la réponse, ou « Fermer quand même » puis retour), jamais à une app qui a dit `non` (elle n'a rien arrêté), ni à une app déjà remplacée ; une app qui ne connaît pas l'appel répond `GFS_INCONNU` et GFS n'ajoute rien (ni fenêtre, ni phrase, ni avertissement), `GFS_INACTIF` de même. GFS ne cherche pas la réponse `repris` pour la montrer à la personne. **Pas encore gardés** : le changement de
   la table de travail (4.5, point 7) et le retrait de l'app active du registre recréent le cadre sans « fermer ». **Le kit répond pour
   les apps qui s'en servent** : `GfsLink.onClose(fn)` (kit 0.9.0) rappelle `fn({ raison })` et rend l'`oui` ou le `non` de l'app ; `GfsLink.onStay(fn)` (kit 0.13.0) rappelle `fn({ raison })` à `rester` et rend vrai quand l'app a repris ; sans abonné, le
   kit répond `GFS_INCONNU` comme avant. [M] Mesuré le 04/11 dans un vrai Grist (faits vérifiés, section 29) ; « tu restes » mesuré le 09/11 (section 64).
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
7. [T] **Lier un fichier d'une autre app** (demande de Tuesday, 02/11 ; **construit le 03/11** : le courtier a `choisir` et `ouvrir`
   côté app, le kit 0.3.0 les offre par `GfsLink.choose` et `GfsLink.openFile`). L'app qui lie garde la clé `{ app, id, type }`
   que rend `choisir` ; le nom reçu n'est qu'une étiquette, celle du moment du choix. Un fichier renommé garde son `id` : `ouvrir`
   l'ouvre sous son nom du jour. Un fichier disparu, ou une app non installée, n'efface jamais le lien : l'app le montre grisé, avec la
   raison, et la personne le retire ou le refait. Relire le nom à l'ouverture serait un champ de plus dans la réponse de `ouvrir`
   (additif) : seulement si une app le demande. Consignes 002 et 005 à Tuesday.
   - **`ouvrir` depuis une app** : `{ app, fichier: { id, type }, raison? }` ; `id` est un texte (un nombre est pris comme tel), `raison`
     ne peut valoir que `lien` (GFS donne lui-même la raison à l'app visée : `lien`, 5.2 point 3). Les refus ont leur code (3.6) :
     `GFS_REFUSE` (forme, ou type absent de `actions.ouvrir` de l'app visée), `GFS_ACCES`, `GFS_INTROUVABLE` (app inconnue, ou fichier
     que la table de l'app visée ne contient plus : GFS le dit à la personne, « Sonde O n'a plus ce fichier : le lien ne peut pas
     s'ouvrir », l'app qui appelait reste ouverte et garde son lien), `GFS_ANNULE`, `GFS_INACTIF` (l'app qui appelait n'est plus l'app active).
   - **La ligne est relue** dans la table de l'app visée à chaque appel (pas la liste de l'explorateur, qui peut dater) : un fichier
     ajouté depuis s'ouvre, un fichier retiré dit son absence.
   - **Une app non installée** (ou un type d'une extension éteinte) : la fenêtre des apps s'ouvre sur sa ligne, l'appel attend ; la personne
     coche puis ferme la fenêtre, et le fichier s'ouvre ; elle ferme sans cocher, et l'app reçoit `GFS_ANNULE`, rien ne s'ouvre.
   - **L'app visée** devient l'app active et reçoit l'ouverture (`ouverture.raison: "lien"`) à son premier `contexte`, celle qui
     appelait s'en va (une seule app à la fois, 1.4) : sa promesse ne se règle donc pas, son cadre n'existe plus. **GFS lui envoie
     « fermer » d'abord** (point 3, `raison: "lien"`) : elle enregistre ou pose sa question avant de partir ; si elle répond `non`
     (ou si la personne reste), rien ne s'ouvre et l'appel `openFile` rend `{ ouvert: false }`. Si l'app visée est
     celle qui appelle, elle reçoit l'appel `ouvrir` de GFS (point 1) et sa réponse `{ ouvert }` revient à l'appelante, après sa
     question d'enregistrement s'il y en a une. Une app qui ne connaît pas encore l'ouverture d'un fichier précis
     (`ACCEPTS_OPEN`, provisoire) s'ouvre sur son modèle habituel avec la phrase provisoire de GFS.
   - [M] **Mesuré le 03/11** dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier, en français et en anglais, en clair
     et en sombre : avec les sondes Q (qui appelle) et O (dont les fichiers se lient), 33 vérifications dans chacune des quatre
     combinaisons (`run-liens.mjs`) ; avec **la vraie Publipostage+** (`run-liens-publipostage.mjs`, 12 vérifications dans chacune) :
     seuls les documents, les grilles et la présentation se listent, la présentation grisée jusqu'à ce que la personne coche
     « Diapositives » dans la fenêtre que le double-clic ouvre sur sa ligne, la grille et la présentation désignées s'ouvrent dans
     l'app, qui ne dit pas « Ouvert depuis l'explorateur » (la raison est `lien`) ; avec **le vrai client du kit**
     (`run-liens-kit.mjs`, 12 vérifications dans chacune) : `GfsLink.choose` rend la clé, `null` à l'annulation, `GFS_REFUSE` sans type ou pendant
     un autre choix, `GfsLink.openFile` rejette un fichier disparu par `GFS_INTROUVABLE` et ouvre l'app visée.

8. [T] **Lire un fichier que GFS garde** (demande du porteur du 03/11, lot 2 de l'étude PDF ; **construit et mesuré le 03/11**).
   `actions.lire` (2.7, point 5) dit quelles apps lisent quel type. Devant un fichier gardé (6.6), GFS prend la première app prête
   qui le lit :
   - **Le geste** : « Lire » est le geste principal (le bouton du pied, Entrée, le double-clic, le premier article du menu de la
     ligne) ; « Télécharger » passe dans le menu ; la barre d'information dit « S'ouvre dans <app> ». Quand aucune app ne lit le
     type, rien ne change (6.6, point 7).
   - **Grisé, jamais masqué** : l'app n'est pas installée, l'extension qui lit est éteinte, ou l'app ne reçoit pas encore le fichier
     (`ACCEPTS_OPEN.<app>.lire`, la ligne provisoire de `fichier`, `nouveau` et `importer`, qui passe à `true` quand le `GFS-ETAT.md` de
     l'app dit la consigne faite et que GFS l'a rejouée). « Lire » reste là, grisé, et la barre dit ce qui manque ; au clic, la
     fenêtre « Apps et extensions » s'ouvre sur la ligne qui le débloque (l'app, puis l'extension), ou la phrase « <app> ne lit pas
     encore les PDF de GFS : télécharge-le pour l'ouvrir » est dite, sans fenêtre. GFS n'ouvre jamais une app qui ne sait pas le
     recevoir : elle prendrait `fichier: null` pour un « Nouveau », ouvrirait un modèle vierge, et le PDF serait perdu sans un mot.
   - **L'ouverture** : GFS télécharge **lui-même** le PDF par le cadre d'envoi (6.6, point 5), en fait un `File` à son nom, et ouvre
     l'app avec `{ fichier: null, type: "pdf", dossier, raison: "lire", lecture: { id, fichier } }` (5.2, point 3), dans la réponse à
     `contexte` ou, quand l'app est déjà ouverte, par l'appel `ouvrir` (point 1). L'app ne reçoit aucun jeton et n'appelle jamais
     l'API de Grist pour cela. Le fichier part une seule fois. Si le transfert échoue, la phrase le dit (« « Facture.pdf » n'a pas pu
     être ouvert : le serveur Grist n'a pas répondu… »), l'explorateur reste ouvert et l'app n'est pas touchée.
   - **Ce que l'app fait** : elle lit `lecture.fichier` comme tout fichier choisi (`arrayBuffer()`), charge pdf.js par la bibliothèque
     `pdfjs` que GFS lui donne (2.6, point 12 ; extension « Lecture de PDF »), le montre dans son mode Lecture, et répond `{ ouvert: true }`
     quand le PDF est ouvert, `{ ouvert: false }` quand la personne annule ou que le fichier est refusé. **Elle garde `lecture` dans son
     `normalizeOpening`** : le kit jusqu'à sa version 0.6.0 et le `gfs-link.js` de Publipostage+ ne gardent que `fichier`, `type`, `dossier`, `raison` (et
     `importation` pour le second) et laisseraient tomber le fichier ; le kit garde `lecture` depuis sa version 0.7.0. Elle ne renvoie jamais les octets à GFS.
   - **Ce que l'app garde sur ce PDF** (demande du porteur du 03/11, lot 4 de l'étude PDF : des commentaires dans le mode Lecture de
     Publipostage+ ; consigne 045 ; **rien n'est construit chez GFS**). C'est à l'app : ses fils vivent dans ses tables (6.1), accrochés à
     `lecture.id`, et GFS n'en garde aucun, n'écrit jamais la table d'une app (3.3, point 3) et ne les voit pas. La clé ne change ni au
     renommage ni au remplacement (6.6, point 3) ; « Garder les deux » donne un autre fichier, donc une autre clé. Quand GFS met un fichier à la
     corbeille ou le supprime pour de bon (6.6, points 7 et 10), il ne le dit à aucune app : ses fils restent dans la table de l'app, et l'app ne
     les efface pas d'elle-même ; restauré, le fichier garde son identifiant, donc sa clé, et ses fils reviennent avec lui. Les règles d'accès de ces lignes (sans `ModeleId`) attendent l'étape 5 (11.7, point 3). Le guide dit le reste (point 18).
   - [M] **Mesuré le 03/11** dans un vrai serveur Grist 1.7.19 (Docker), à 700 × 400, à la vraie souris et au vrai clavier, en français
     clair et en anglais sombre (`prototype/labo/run-lire.mjs`, 43 vérifications dans chacune, aucune en échec), avec la sonde Y
     (`labo/sondes/y-lire-pdf/`), qui fait ce que fera Publipostage+ : le labo seul la range dans `ACCEPTS_OPEN`. Avant l'app, « Lire »
     est grisé, la barre demande l'app, un clic ouvre la fenêtre sur sa ligne, puis sur celle de l'extension (la copie de GFS est le
     seul mode de pdf.js, le CDN est grisé avec sa raison). L'app prête, « Lire » ferme l'explorateur et l'app reçoit **un vrai `File`**
     (`instanceof File`, nom, taille, type `application/pdf`, mêmes octets : même empreinte SHA-256 que le PDF choisi) **dans un cadre sans
     `allow-same-origin`** ; pdf.js 6.5.438 se charge par la source que GFS donne (la copie de GFS, empreinte `sha384`, un
     `<script type="module">` sous `script-src 'self'`, aucune violation de politique) ; le PDF de trois pages s'ouvre, son texte
     (accents compris) et son encre sont là, la couche de texte porte le même texte et un double-clic y sélectionne un mot ; la page suivante
     se tourne à la souris et à la flèche droite ; **l'app déjà ouverte reçoit l'appel `ouvrir`** (raison `lire`, même cadre non rechargé)
     et lit le second PDF ; Entrée et le double-clic lisent ; « Télécharger » du menu rend le PDF octet pour octet ; **lire n'écrit rien dans
     le document** (mêmes lignes, mêmes pièces jointes, mêmes tables) ; un transfert refusé est dit en mots et n'ouvre rien ; avec
     `lire: false`, « Lire » reste grisé, la phrase « ne lit pas encore » est dite au clic, sans fenêtre ni app ouverte ; les textes du pied
     et de la barre tiennent la charte (4,5:1) ; aucune erreur ni avertissement en console. **Non mesuré** : Firefox, l'instance de la
     DINUM, un PDF protégé par un mot de passe, un PDF de centaines de pages, la vraie Publipostage+ (mesurée le 04/11, ci-dessous).
   - [M] **Mesuré le 04/11 avec la vraie Publipostage+** (`3064a29`, extension `lecture-pdf` déclarée dans le manifeste de GFS, `ACCEPTS_OPEN.publipostage.lire`
     à `true` : consigne 044), dans un vrai serveur Grist 1.7.19 (Docker), à 700 × 400, à la vraie souris et au vrai clavier, en français et en
     anglais, en clair et en sombre (`prototype/labo/run-lire-publipostage.mjs`, 33 vérifications dans chacune des quatre passes, aucune en échec).
     Avant l'extension, « Lire » est grisé (« Demande l'extension Lecture de PDF »), un clic ouvre la fenêtre sur la ligne de l'extension, la copie de GFS
     est le seul mode de pdf.js. Cochée, « Lire » ouvre l'app : **au premier démarrage d'un document neuf, la question « Créer les tables du widget dans
     ce document ? » est celle de l'app** (une fois, GFS n'en pose aucune) et ses quatre tables naissent ; l'app tient `lecture.id` (l'identifiant que GFS
     a donné au PDF), montre le PDF dans son mode Lecture (coin d'état « PDF « Facture.pdf » : 3 pages. »), première page dessinée (de l'encre, du texte
     noir), couche de texte avec les accents, pdf.js 6.5.438 de la copie de GFS (source, empreinte `sha384`, forme `module`, chargé sans refus) ; la
     molette et le clavier font défiler, la page 3 se dessine en approchant, un double-clic y sélectionne un mot ; **l'appel `ouvrir`** : même cadre non
     rechargé, le second PDF remplace le premier ; Entrée et le double-clic lisent ; « Télécharger » rend le PDF octet pour octet ; lire n'écrit rien dans
     les PDF de GFS ; aucune erreur ni avertissement en console, hors deux messages connus du labo (`KNOWN_MESSAGES` de `prototype/labo/lab-pdf.mjs`). **Un navigateur ancien** : pdf.js 6 attend `getOrInsertComputed` de Map et de WeakMap
     (Chrome et Edge 145, Firefox 144, Safari 26.2 ; le Chromium du cloud, 141, ne les a pas : le labo les pose, `LAB_NAVIGATEUR_ANCIEN=1` ne les pose pas) ;
     sans elles l'app dit « Ce navigateur est trop ancien pour lire un PDF : mettez-le à jour. », reste sur son modèle et GFS n'a rien de cassé (13
     vérifications). **Non mesuré** : Firefox, l'instance de la DINUM, un PDF protégé par un mot de passe, un PDF de centaines de pages.

9. [T] **Ranger un fichier que l'app a fabriqué** (demande du porteur du 03/11, lot 3 de l'étude PDF : « que des exports de Publipostage+ en
   PDF aillent directement se ranger parmi les fichiers, avec le choix d'écraser l'existant ou d'avoir une copie avec un (1) derrière le
   nom » ; **construit et mesuré le 03/11**). `actions.ranger` (2.7, point 6) dit quels types l'app donne à GFS. Elle ne reçoit aucun
   jeton et n'écrit jamais ce que GFS garde (6.6) : elle donne les octets et un nom, GFS les écrit. Le niveau d'accès de l'app, même
   `none`, n'y change rien.
   - **L'appel** : `ranger { fichier, nom, type?, lot?, suivants?, dossier? }`. `fichier` : un `File` ou un `Blob` fabriqué dans le cadre
     de l'app (les octets passent par la copie du message) ; `nom` : le nom pour GFS, de 1 à 200 signes (un « .pdf » manquant est
     ajouté, un retour à la ligne devient une espace) ; `type` : `pdf`, le seul que GFS garde et celui qu'il prend sans mention ; `lot` : un
     texte de 1 à 64 signes qui nomme un export en lot ; `suivants` : un entier de 0 ou plus, combien de fichiers l'app rangera encore après
     celui-ci ; `dossier` : un chemin de 200 signes au plus (normalisé comme celui de l'explorateur : « Factures/2026 »), le dossier de la
     personne où va un fichier **nouveau** (un fichier remplacé garde sa place). Une demande hors de ces formes, un type que
     `actions.ranger` ne déclare pas, un fichier vide ou qui ne commence pas comme un PDF (6.6, point 4) : `GFS_REFUSE`, avec la raison en
     mots, avant que rien ne s'écrive.
   - **La réponse** : `{ statut, id, nom }`. `ajoute` : le fichier est nouveau ; `remplace` : le fichier de ce nom a pris le contenu (même
     `id`, même nom, même place) ; `copie` : le nom était pris et la personne a gardé les deux, `nom` est celui de la copie
     (« Facture (1).pdf ») ; `ignore` : la personne n'en veut pas, `id` et `nom` sont `null` et rien n'est écrit (ce n'est pas une
     erreur). `id` est l'`Identifiant` du fichier (6.6) : la clé où l'app peut accrocher ce qu'elle garde.
   - **Ce que la personne voit** : la fenêtre « Ce nom est déjà pris » de 6.6, point 3, et rien d'autre. Elle **nomme l'app** (« <app>
     range un fichier dans GFS, mais GFS garde déjà un fichier « Facture.pdf ». Que faire du nouveau ? » ; le nom est celui du manifeste
     dans la langue de la personne, jamais un texte du message), décrit le fichier gardé, et propose Garder les deux (le clavier y est),
     Remplacer et Annuler (« le nouveau n'est pas rangé dans GFS »). Échap vaut Annuler ; un clic à côté ne ferme rien (décidé le 09/11). **GFS ne dit rien par-dessus
     l'app**, ni phrase ni notice : c'est l'app qui rend compte, dans son coin d'état, de ce que dit la réponse ou l'erreur.
   - **Un export en lot** : les fichiers d'un même export portent le même `lot` et chacun son `suivants` (11, 10… 0). Tant qu'il en reste,
     la fenêtre offre la case « Faire pareil pour les suivants » : cochée, la réponse (Remplacer, Garder les deux ou Annuler) vaut pour
     les noms pris suivants du lot, sans nouvelle fenêtre. Le dernier fichier (`suivants: 0`) n'offre pas la case, et un fichier sans
     `lot` est seul. GFS ne retient que le dernier lot de l'app active : un autre nom de lot, ou une autre app, repart de zéro. Ce qui vaut
     pour tout le lot : la réponse cochée, la table refusée, le rangement refusé.
   - **Une fenêtre à la fois** : les dépôts passent l'un après l'autre, dans l'ordre des appels, même lancés ensemble ; un second fichier
     du même nom attend le premier et voit son résultat (copie « (1) »). Une app qui n'est plus l'app active quand son tour vient reçoit
     `GFS_INACTIF`, sans rien écrire. Pas de délai (5.1, point 4) : la personne répond quand elle veut.
   - **Les accords et les échecs** : la table `GFS_Fichiers` n'existe pas encore : GFS demande l'accord de la personne (6.6, point 1 ; la
     fenêtre dit que les apps y rangent aussi). Refusée, rien n'est créé : l'app reçoit `GFS_ANNULE`, et les fichiers suivants du même
     lot aussi, sans nouvelle question. Un document en lecture seule : `GFS_LECTURE_SEULE` ; ouvert sans l'accès complet : `GFS_ACCES` ;
     rien ne s'écrit. Le serveur Grist qui refuse le fichier (413) ou ne répond pas : `GFS_ECHEC`, avec la raison en mots, rien n'est
     écrit, et le dépôt suivant n'est pas bloqué. Un rangement dans un dossier qui échoue ne perd pas le fichier : il est gardé, à la racine.
   - **`Origine`** (6.6) : la ligne dit l'`id` de l'app qui l'a rangée, pris à la session de l'app et jamais à un champ du message (5.1,
     point 5) ; un fichier remplacé garde son `Origine`.
   - **Dans l'app seule** : l'app télécharge son fichier comme avant, et grise « Ranger dans GFS » avec le texte commun (guide des apps,
     section 5). Une impression par le navigateur ne fabrique pas de fichier : elle ne se range pas. Un GFS plus ancien répond
     `GFS_INCONNU` : l'app le dit et télécharge.
   - [M] **Mesuré le 03/11** dans un vrai serveur Grist 1.7.19 (Docker), à 700 × 400, à la vraie souris et au vrai clavier, en français
     clair et en anglais sombre (`prototype/labo/run-ranger-pdf.mjs`, 62 vérifications dans chacune, aucune en échec), avec la sonde Z
     (`labo/sondes/z-ranger-pdf/`), qui fait ce que fera Publipostage+ : le labo seul la range dans `ACCEPTS_OPEN`. **La même mesure avec le
     vrai client du kit 0.7.0** (`LAB_KIT=1`, la sonde Z kit, `GfsLink.deposit` du sous-module `prototype/kit` : 62 vérifications dans
     chacune, aucune en échec) rend les mêmes réponses et les mêmes codes. Sans la table, GFS
     demande l'accord avant tout et refuse proprement (rien n'est créé, `GFS_ANNULE`, trois fichiers d'un lot refusés sans seconde
     question). Accordée, **le `File` fabriqué dans le cadre isolé de l'app** (sans `allow-same-origin`) **est celui que Grist garde,
     octet pour octet** (même empreinte SHA-256, type `application/pdf`) ; la ligne dit l'identifiant rendu, le nom, la taille, l'app
     dans `Origine` et la date du jour ; l'app reçoit `{ statut: ajoute, id, nom }` et GFS ne dit rien par-dessus elle ; la liste de
     l'explorateur montre le PDF. Le dossier donné (` Factures // 2026/ `) devient « Factures/2026 », sans favori. Un nom pris : la
     fenêtre nomme l'app, décrit le fichier gardé, tient dans le panneau, ses textes tiennent la charte (4,5:1), le clavier est sur « Garder
     les deux », rien n'est écrit avant la réponse ; **Remplacer** garde l'identifiant, la ligne et le dossier et prend le contenu
     (`remplace`), **Garder les deux** crée « Facture (1).pdf » (`copie`) sans toucher à l'ancien, **Annuler**, Échap et un appui à côté
     rendent `ignore` sans rien écrire. Un lot de cinq fichiers dont trois noms sont pris : une seule fenêtre quand la case est cochée
     (au clavier : Tab, Espace, Tab, Tab, Entrée), « Annuler » avec la case passe les noms pris et range les autres, un nouveau lot ne
     reprend pas la réponse de l'ancien, le dernier fichier n'a pas de case. Deux dépôts lancés ensemble : une seule fenêtre, `[ajoute,
     copie]` dans l'ordre. Des demandes hors règle (un contenu qui n'est pas un PDF, un fichier vide, un type non déclaré, un texte à la
     place du fichier, pas de fichier, un nom vide, un lot vide) : `GFS_REFUSE` avec la raison, rien d'écrit, aucune fenêtre. Un envoi qui
     échoue (413, réseau coupé) : `GFS_ECHEC` avec la raison en mots, puis le dépôt suivant réussit. Aucune erreur ni avertissement en
     console. **La vraie Publipostage+** (`6a22dee`, sa consigne 043 faite) **est mesurée le 04/11** : son manifeste dans GFS déclare
     `actions.ranger: ["pdf"]` (sans cette ligne GFS répond `GFS_REFUSE` et l'app télécharge en le disant), et son menu « Destination du
     PDF » range un PDF seul (la table naît avec l'accord de la personne), une copie « (1) », un remplacement, un refus, le PDF téléchargé
     et rangé avec les mêmes octets, et une archive de trois PDF (un `ranger` par PDF sous le nom de son entrée de l'archive, une seule
     fenêtre pour trois noms pris) : `labo/run-ranger-publipostage.mjs`, 38 vérifications dans chacune de quatre passes (faits vérifiés,
     section 33). **Non mesuré** : Firefox avec la vraie app, l'instance de la DINUM, un PDF de plus de 12 Mo, le refus de créer la table
     du rangement (essais sous Node seulement : elle existe dès qu'une app est installée).

10. [T] **Mettre à la corbeille un fichier qui tient à plus qu'une ligne : `supprimer`** (demande du porteur du 04/11 : « tout se fait depuis
   l'explorateur, pour toutes les apps » ; **construit et mesuré le 04/11**, pour Form+, que GFS ne sait pas fermer seul : un formulaire est une
   ligne, sa section de formulaire, sa table de réponses et son lien public). Le manifeste déclare `suppression.appel: true` (2.4) ; l'appel part de
   GFS vers **l'app active seulement**, celle du fichier : `supprimer { fichier: { id, type }, raison }` (`id` : l'identifiant du fichier
   (point 1 de 2.4), `type` : sa valeur de `colonnes.type` ; `raison` vaut `corbeille`, la seule). L'app répond `{ fait: true }` quand ce qui est
   public est fermé (elle a fini d'écrire), `{ fait: false, dit }` quand elle ne peut pas, ou une erreur. `dit` est une phrase d'une ligne, de
   200 signes au plus (le reste est coupé, les retours à la ligne deviennent des espaces) : GFS l'ajoute à la sienne.
   - **L'ordre** : la table `GFS_Corbeille` est accordée **avant** l'appel (6.7, point 1) : un lien n'est jamais fermé pour un fichier que GFS ne
     peut pas garder ; la ligne est relue après la réponse ; puis **un seul lot** (`AddRecord` dans `GFS_Corbeille`, `RemoveRecord` dans la table
     de l'app). `{ fait: false }` : rien n'est écrit, la phrase de l'app est dite (vide : GFS dit seulement qu'il n'a rien fait). Ce que l'app
     garde ailleurs (la table de réponses, les sections) n'est pas suivi : restaurer remet la ligne, la personne republie à la main.
   - **L'app n'est pas là** : seule l'app active répond. Quand l'app du fichier n'est pas ouverte, ou n'a pas encore dit « prête » (4.2,
     point 3), l'article « Mettre à la corbeille » est **grisé, jamais masqué**, et un clic dit « Ouvre <app> pour … » (`trash.openApp`).
     Si l'app disparaît pendant l'attente : `GFS_INACTIF`, dit « <app> s'est fermée avant de répondre » ; si elle ne connaît pas l'appel :
     `GFS_INCONNU`, dit « <app> ne sait pas encore faire ce geste » ; **sans réponse au bout de 20 secondes**, GFS ne l'attend plus, n'écrit rien
     et dit « <app> ne répond pas » (une réponse tardive n'écrit rien).
   - **Ni restaurer, ni supprimer pour de bon, ni vider la corbeille** n'appellent l'app (6.7) : le lien est fermé depuis la mise à la corbeille.
   - **Dans l'app seule** : sans objet ; l'app garde sa propre gestion de ses formulaires.
11. [T] **Copier un fichier qui tient à plus qu'une ligne : `dupliquer`** (même demande ; **construit et mesuré le 04/11**). Le manifeste déclare
   `copie.appel: true` (2.4) ; l'appel part de GFS vers l'app active : `dupliquer { fichier: { id, type }, nom }`, où `nom` est **le premier
   nom libre** que GFS a calculé (« Inscription (1) »). L'app copie le fichier en entier, sous ce nom, et répond `{ id, nom?, dit? }` : `id`
   est l'identifiant de la copie (un nombre ou un texte, pris comme texte), `nom` seulement si elle l'a changé, `dit` une phrase (200 signes
   au plus). Une réponse **sans `id`** (`{ dit }`) : l'app n'a rien copié, GFS dit sa phrase et ne range rien. **La copie n'est pas publiée**
   (un lien public reçoit des réponses de n'importe qui : l'app ouvre une copie fermée et le dit dans `dit`) ; GFS n'écrit rien dans la table de
   l'app, relit la liste, range la copie dans le dossier de l'original (6.4) et lui donne le clavier. Les mêmes cas qu'au point 10 : grisé et
   « Ouvre <app> pour dupliquer … » (`copy.openApp`) quand l'app n'est pas ouverte, `GFS_INACTIF`, `GFS_INCONNU`, 20 secondes sans réponse.
   [M] **Mesuré le 04/11** (faits vérifiés, section 34) dans un vrai Grist, avec la sonde ZF (`labo/sondes/zf-composite/`) qui répond comme
   Form+ et le vrai manifeste : `labo/run-composite.mjs`, 38 vérifications en français clair et en anglais sombre, aucune en échec (la table
   accordée avant l'appel, un seul lot, la phrase de l'app, `{ fait: false }`, l'app muette, la restauration au même numéro, la copie qui prend
   le clavier, la plus longue phrase dans le panneau de 700 × 400). **Avec la vraie Form+ (mesuré le 07/11,
   faits vérifiés 58)** : ses consignes 020 et 021 faites (`7057309`, `GfsLink.onDelete` et `GfsLink.onDuplicate` du kit 0.10.0), GFS déclare `suppression: { ligne: true,
   appel: true }` et `copie: { appel: true }` dans `manifestes/form.json` et rejoue les deux gestes avec elle (`labo/run-composite-form.mjs`, grist-static, 25 vérifications en
   français clair et en anglais sombre, aucune en échec) : la copie est un formulaire de la liste, sa section à elle, son lien fermé, SA table de réponses vide
   (`<table>_copie`) ; la corbeille ferme le lien avant que la ligne parte ; restaurer remet la même ligne, le lien reste fermé. **Non mesuré** : Firefox avec la
   vraie app, le Grist de la DINUM, un formulaire publié par le geste « Publier » de l'app (l'essai pose `shareOptions` à la main), la copie d'un formulaire dont une
   question écrit dans une autre table que la principale (limite connue de l'app : cette table reste partagée avec l'original). **La table de la copie est créée sans
   fenêtre d'accord** (guide, règle 4) : question posée à l'app (consigne Form+ 026).

12. [D] **Joindre un fichier à la cellule « Pièces jointes » d'une ligne : `joindre`** (demande du porteur du 06/11 : « enregistrer le PDF généré
   en pièce jointe dans la ligne Grist » ; **le porteur a choisi « GFS joint lui-même » le 06/11**, à la carte « Laisser Publipostage+ joindre
   le PDF d'une ligne à sa cellule ? » : l'app n'a pas de jeton d'écriture, et lui confie les octets comme pour
   `ranger`). **Livré côté GFS le 06/11** (`prototype/js/broker/attach.js`, mesuré dans un vrai Grist, [M] ci-dessous) ; **GFS déclare `actions.joindre: ["pdf"]`
   dans `manifestes/publipostage.json` depuis le 07/11** (la page de l'app dit sa consigne 053 faite). **Où garder la colonne et le mode : « Dans la vue »**
   (carte du porteur, 07/11) : `pp_attach_column` et `pp_attach_mode` sont deux clés de `reglages` du manifeste de l'app, écrites dans la vue au geste
   de la personne comme toutes les clés de réglages (7.3), sans « Enregistrer » de Grist, partagées par tous ceux du document [M, faits vérifiés 54].
   Les [Q] attendent le porteur.
   - [D] **Déclaration** : `actions.joindre` (2.7, point 7), la liste des types de fichier que l'app joint (`["pdf"]`). Sans elle, ou pour un
     autre type : `GFS_REFUSE`, rien d'envoyé.
   - [T] **L'appel** (app → GFS, sans délai) : `joindre { table, colonne, mode?, fichiers: [{ ligne, fichier, nom }] }`. `table` et `colonne` :
     les identifiants de Grist ; `ligne` : le numéro de la ligne (un entier d'au moins 1) ; `fichier` : un `File` ou un `Blob` fabriqué dans le cadre
     de l'app (les octets, jamais un jeton) ; `nom` : le nom que Grist garde (1 à 200 signes, « .pdf » ajouté s'il manque) ; `mode` : `remplacer`
     (**par défaut** : un fichier de même nom déjà cité par la cellule en sort, le nouveau prend sa place) ou `ajouter` (le fichier s'ajoute à la suite,
     même nom compris). Plusieurs entrées d'une même `ligne` vont dans la même cellule, dans l'ordre reçu (« un document par valeur » de
     Publipostage+). Au plus 200 entrées par appel [Q 1].
   - [T] **Ce que GFS vérifie avant d'envoyer quoi que ce soit** : la forme ; que le type est déclaré et que les octets sont ceux d'un PDF (comme
     `ranger`, point 9) ; que `table` est une table que le manifeste de l'app laisse **lire et écrire** (3.2 et 3.3 : ni `GFS_`, ni une table d'une
     autre app, ni `_grist_*`) ; que le document n'est pas en lecture seule ; que l'app est toujours l'app active. Un seul échec de ces contrôles
     refuse tout l'appel, avec son code : `GFS_REFUSE` (forme, type non déclaré, table, fichier qui n'est pas un PDF), `GFS_LECTURE_SEULE`,
     `GFS_INACTIF`. **La colonne** (elle existe, est de type `Attachments`, n'est ni une formule ni une colonne déclenchée) est vérifiée ensuite, **sans
     rien envoyer** : un défaut n'est pas une erreur de l'appel, c'est `probleme` (`absente` ou `inutilisable`) dans la réponse, chaque fichier est
     un échec du même mot.
   - [T] **Ce que GFS fait** : chaque fichier est envoyé à Grist par le cadre d'envoi de GFS (6.6, un jeton jeté aussitôt) ; puis **un seul lot**
     `BulkUpdateRecord` sur la table, écrit après tous les envois sur une **relecture de la colonne juste avant** (une pièce jointe que la personne
     a ajoutée entre-temps dans Grist n'est pas perdue) : la cellule vaut `['L', …numéros]`. GFS écrit comme la personne : les règles d'accès de
     Grist s'appliquent ; si elles refusent, la réponse porte `probleme: 'refus'` (jamais une erreur de l'appel). Les envois se font un fichier après
     l'autre : un envoi que Grist refuse arrête le lot, les fichiers pas encore envoyés sont des échecs du même mot, et **rien n'est écrit** si aucun
     fichier n'est parti. **Sauf la taille** (décidé le 06/11, question de Publipostage+ à sa 053) : un fichier que Grist trouve trop gros (413) est un échec à lui seul
     (`trop-gros`), les suivants partent et sont joints. Deux appels `joindre` de la même app se suivent l'un après l'autre (une file), un échec n'arrête pas la file. Une pièce jointe remplacée **n'est pas supprimée du document** : elle reste dans la liste
     des pièces jointes de Grist (mesuré le 03/11 pour un remplacement), la cellule ne la cite plus.
   - [T] **La réponse** : `{ colonne, probleme, joints, echecs }`. `probleme` vaut `null`, ou ce qui a arrêté tout le lot : `absente`
     (la colonne n'existe plus), `inutilisable` (elle n'est plus de type Pièces jointes), `refus` (Grist refuse : droits, règles d'accès), `injoignable` (le serveur ne répond pas), `echec` (autre). `joints` : `[{ index, remplace }]`, une entrée par
     fichier joint (`index` : sa place dans `fichiers`, `remplace` vrai quand il a pris la place d'un fichier de même nom). `echecs` : `[{ index, raison }]`
     pour les fichiers que GFS n'a pas pu joindre (`raison` : `ligne` quand la ligne n'existe plus, `trop-gros` quand Grist refuse la taille de ce fichier, ou l'un des mots de `probleme`). GFS ne dit rien par-dessus
     l'app : elle écrit ces phrases dans son coin d'état. Les vérifications qui échouent d'avance rendent plutôt un refus (`GFS_REFUSE`, `GFS_LECTURE_SEULE`,
     `GFS_INACTIF`) avec sa phrase.
   - [T] **Ce que la personne voit de GFS** : rien, pas de question. Le geste est celui qu'elle a fait dans l'app (la case « Joindre à la ligne » du menu
     Exporter, puis l'export) ; GFS n'ajoute pas de fenêtre à un geste qu'elle vient de faire [Q 2].
   - [T] **Dans l'app seule** : l'app joint par ses propres moyens (le jeton d'écriture que Grist lui donne, jeté après l'export) ou grise la case ;
     dans GFS elle ne demande jamais ce jeton (3.4, point 1). Un GFS plus ancien répond `GFS_INCONNU` : l'app le dit et garde son PDF téléchargé.
   - [Q] **1. Combien de fichiers par appel ?** 200 (le lot d'un export de ZIP) est proposé ; `ranger` en prend 64 par lot, un par appel.
     **2. Une question avant la première jointure d'un document ?** Défaut : non (le geste de la personne suffit, comme l'export lui-même) ; l'autre
     voie : la fenêtre « Joindre à la colonne … ? » une fois par document et par app, comme la publication d'un formulaire (3.3, point 9).
   - [M] **Mesuré le 06/11** dans un vrai serveur Grist 1.7.19 (image officielle, Chromium, fr clair et en sombre ; `prototype/labo/run-joindre.mjs`, 35
     vérifications, avec une sonde qui fabrique ses PDF dans son cadre isolé, comme le fera Publipostage+) : les octets que Grist garde sont ceux de
     l'app (même empreinte SHA-256, type PDF, le nom donné) ; `remplacer` retire de la cellule le fichier de même nom (casse ignorée), garde les autres et
     met le nouveau à la fin, **l'ancien reste dans la liste des pièces jointes du document** ; `ajouter` garde tout ; trois fichiers sur deux lignes
     dans un appel : l'ordre reçu est gardé dans chaque cellule ; une ligne supprimée : échec `ligne`, les autres sont jointes ; colonne absente, de type
     Texte ou à formule : rien n'est envoyé ni écrit ; table de GFS, table interne, contenu qui n'est pas un PDF, ligne qui n'est pas un numéro :
     `GFS_REFUSE` ; le réseau tombe : `injoignable`, rien n'est écrit, l'appel suivant réussit ; le serveur répond 413 : `trop-gros` pour ce fichier, `probleme` reste null (mesuré le 06/11 dans la nuit : les autres fichiers du lot, avant et après lui, sont joints, `run-joindre.mjs`, 37 vérifications) ; une pièce jointe
     ajoutée dans Grist **pendant** l'envoi reste dans la cellule, avant la nôtre ; une règle d'accès qui refuse d'écrire la colonne : Grist répond
     « Blocked by column update access rules », la réponse porte `refus`, aucune cellule ne change, et **Grist reconstruit le cadre de GFS** quand une règle
     d'accès change (l'app est alors à rouvrir). **Pas mesuré** : Firefox (aucune interface dans ce geste), l'instance de la DINUM, la vraie app de
     Publipostage+ (elle n'appelle pas encore `joindre`).

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
   par personne qui écrit, la charge de fond du point 7 (une lecture toutes les 3 s par page ouverte), les plafonds de l'offre,
   le délai de bout en bout entre deux navigateurs.
7. [M] **La lecture de fond de l'entrée automatique** (Publipostage+ à `71287c4`, `js/live-entry.js`). Une page qui n'écrit pas
   en direct n'est pas prévenue (point 1) : pour rejoindre seule le salon qu'une autre personne allume, l'app relit de loin en
   loin, et seulement quand rejoindre aurait un sens (l'extension « Édition collaborative » est active, un modèle enregistré
   de type document est à l'écran, la page est visible, rien n'est à perdre à l'écran, la personne n'a pas quitté le direct).
   Sans la table du direct : `listTables` toutes les 3 s. Une fois la table vue : sa lecture (`fetchTable`) toutes les 3 s, ou
   toutes les 10 s quand elle ne porte que des restes (une page fermée sans prévenir) ; après une lecture en échec, 6 s, 12 s
   puis 30 s. Dans un salon, les cadences du point 3 ne changent pas. Le courtier n'y ajoute rien : un appel de l'app est un
   appel à Grist (4.3), sans file, sans cadence ni plafond propres à GFS. **Mesuré le 19/10** (labo, `run-edition.mjs`, vrai Grist,
   avec la vraie app, une seule page, sans réseau, en français clair et en anglais sombre) : 4 `listTables` en 13 s tant que la table
   n'existe pas ; 4 lectures de `Publipostage_Direct` en 13 s une fois la table créée, vide et le modèle rouvert, de 8 à 12 ms chacune de
   l'app à Grist et retour ; aucune lecture de cette table dans les 13 s qui suivent l'arrêt du direct par la personne elle-même
   (elle n'y est pas ramenée avant d'avoir rouvert le modèle). À l'échelle : une page ouverte dans ces conditions lit une fois
   toutes les 3 s, donc N pages lisent N/3 fois par seconde (30 pages : 10 lectures par seconde), même quand personne n'écrit.
   Le plafond d'un Grist en ligne face à cette charge reste à mesurer (point 6) ; cadence et conditions sont celles de l'app, et
   GFS ne les limite pas.

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
   (`gristHelper_…`) : les ignorer, comme les colonnes `GFS_…` que GFS ajoute aux tables classées (11.2, point 5). Une colonne
   ajoutée par `AddColumn` est masquée dans la section : la lire avec `includeColumns: 'normal'` (niveau `full`).

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
2. [T] GFS n'écrit jamais dans la table d'une app, sauf le nom d'un fichier (le porteur, 21/10) : quand la personne renomme un
   fichier dans l'explorateur, GFS écrit le nouveau nom, et lui seul, dans la colonne `colonnes.nom` de sa ligne (2.4), après
   avoir vérifié que la colonne existe ; ni date ni auteur. Un nom qu'un autre fichier de la même table porte déjà (casse et
   espaces autour ignorés, la règle de Publipostage+) est refusé dans la fenêtre. Une app ne réécrit donc jamais un nom périmé :
   elle ne met le nom dans la ligne qu'elle écrit qu'à la création du fichier et quand la personne l'a changé chez elle (guide
   des apps). **Réécrit le 04/11** (le porteur : « tout doit pouvoir se faire depuis l'explorateur, pour tous les fichiers de toutes les
   apps, avec une corbeille », la ligne du 21/10 « dupliquer et supprimer restent à l'app » est rouverte) : supprimer et dupliquer
   viennent aux fichiers des apps par une **recette que le manifeste déclare** (`suppression`, 2.4), jamais par un geste que GFS invente :
   **la corbeille d'une table d'app est livrée le 04/11** (lot 2 : `GFS_Corbeille` garde une copie de la ligne, 6.7) ; **la copie (« Dupliquer », Ctrl+C puis Ctrl+V)
   l'est aussi** (lot 3 : recette `copie`, 2.4 ; elle ajoute une ligne, comme l'app le ferait, et range la copie dans le dossier ouvert, 6.4, point 10). **Une app seule, sans GFS, garde sa propre gestion de ses fichiers** : GFS n'agit que d'après le manifeste, et
   seulement quand l'app est servie par lui. « Mettre à la corbeille » et « Dupliquer » sont grisés pour une app qui n'a pas de recette,
   et un clic dit pourquoi (`trash.appOnly`, `ex.notice.appOnly`) ; pour les PDF que GFS garde, la corbeille existe aussi (6.6, point 10). Une exception de plus est proposée, non tranchée :
   les colonnes d'aide `GFS_…` des tables classées, additives (11.7, point 6).

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
| `Adresse` | Text | Colonne à formule déclenchée (point 9) : Grist y écrit l'adresse de la personne pour la ligne-sonde, rien pour les autres |

1. [D] Une ligne par (personne, app, fichier) qui a un dossier ou un favori ; une ligne d'état par (personne, dossier) que la
   personne garde sans fichier (point 11). Un dossier existe tant qu'une ligne le nomme, celle d'un fichier ou celle d'un état ;
   les dossiers parents d'un chemin existent d'office.
2. [D] Modèle : `Publipostage_PreferencesModeles` (`js/template-preferences.js`), qui range déjà, par personne, l'épingle, le
   dossier (chemin avec « / ») et l'état replié.
3. [T] Changements additifs seulement, colonnes inconnues gardées ; désinstaller une app n'efface aucune ligne ; une ligne dont
   le fichier n'existe plus est ignorée.
4. [D] L'identité de la personne (`Utilisateur`) vient du mécanisme de Publipostage+ (une ligne ajoutée dont une formule
   déclenchée lit `user.Email`, point 9), que GFS lit lui-même : le porteur a choisi, le 22/10, un rangement « à soi seul », et
   non commun à tout le document. Sans identité (anonyme, adresse illisible, document en lecture seule, table pas encore
   créée), repli vide, jamais bloquant : le rangement est alors commun au document, et l'explorateur le dit (« Rangement
   commun au document »). Les lignes écrites sans identité (`Utilisateur` vide) restent dans la table, intactes ; une personne
   identifiée ne les voit plus, quiconque n'est pas identifié les voit toujours. Cette même adresse est donnée aux apps qui
   déclarent `identite` (3.4, point 6 ; 5.2, point 9), et à elles seules.
5. [T] Le rangement propre à une app (les dossiers personnels de Publipostage+) reste valable dans l'app ; l'explorateur de GFS
   le lit (champ `fichiers[].rangement`, 2.4) et n'y écrit jamais (point 8).
6. [T] Une ligne dont `Utilisateur` commence par `@` est une ligne réservée de GFS : l'état du document, jamais le rangement
   d'une personne. Deux à ce jour : `@document` / `gfs` / `apps`, les apps installées (7.4), et `@sonde`, la ligne-sonde
   (point 9), qui n'existe que le temps d'une lecture. Le rangement ignore toute ligne en « @ ». Une app n'écrit jamais cette
   table (6.1, point 1).
7. [D] GFS écrit ces lignes sur un geste de la personne dans l'explorateur, avant qu'aucune app ne soit ouverte (le porteur,
   21/10) : épingler un fichier, le déplacer, créer, renommer, déplacer ou supprimer un dossier (créer et supprimer : point 11).
   Chaque geste relit la table puis écrit en un seul lot ; un dossier renommé ou déplacé réécrit la ligne de chaque fichier qu'il
   contient et celle de chaque dossier gardé sans fichier, sous-dossiers compris ; un dossier ne va ni en lui-même ni dans un de
   ses sous-dossiers. Deux dossiers voisins ne portent pas le même nom (comparé
   comme la recherche) : renommer vers le nom d'un voisin est refusé, déplacer dans un dossier qui a déjà ce nom les réunit.
8. [D] Dans l'explorateur, la ligne de GFS d'un fichier passe devant le rangement propre de l'app (point 5) ; sans ligne de
   GFS, celui de l'app reste le point de départ. L'app garde le sien, que GFS ne réécrit pas : un fichier rangé dans GFS
   peut donc avoir une autre place dans l'app.
9. [T] **La sonde de l'adresse.** La colonne `Adresse` porte une formule déclenchée (`recalcWhen: 0`, `recalcDeps: null` : calculée
   à la création d'une ligne, jamais ensuite) : `user.Email if $Utilisateur == '@sonde' else ''`. Une fois à chaque ouverture
   de GFS, avant la première lecture du rangement ou à la première écriture, GFS ajoute une ligne `Utilisateur = '@sonde'`,
   relit `Adresse` par `fetchTable`, puis retire la ligne : en cas d'échec, un seul avertissement, et la ligne est retirée
   quand même. Seule la ligne-sonde reçoit une adresse (minimisation : aucune ligne de rangement n'en porte). La réponse,
   avec adresse ou sans, est gardée dans la mémoire de la page, jamais dans le navigateur (une autre personne sur le même poste
   doit être reconnue) ; sans table (la sonde ne la crée jamais), en lecture seule (la sonde n'écrirait que des refus) ou sur
   une erreur, rien n'est gardé et le geste suivant réessaie. Ne sont pas une adresse : une valeur vide, une erreur de la
   formule, `anon@getgrist.com` (l'anonyme de Grist), une valeur en « @ », ou qui n'a pas la forme `nom@domaine`. L'adresse
   se compare à la lettre près, telle que Grist la donne : Publipostage+ écrit la même chaîne (`user.Email`) dans
   `Publipostage_PreferencesModeles.Utilisateur`. Une table d'avant sans `Adresse` reçoit la colonne (6.1, point 3 : additif).
   GFS écrit cette formule par sa propre connexion : la capacité `formules` (3.4) ne concerne que les apps. [M] **Mesuré le
   22/10** dans le vrai moteur de Grist (grist-static, Pyodide ; `prototype/labo/run-identite.mjs`, 41 vérifications, fr/clair
   et en/sombre) : voir `faits-verifies.md`, section 3. Sous le niveau « Partagé » (11.4, point 2), une règle laisse chaque
   personne ajouter, lire et retirer sa seule ligne-sonde ; sans elle, la sonde est refusée à tout non-propriétaire. [M] Mesuré
   le 22/10 : faits vérifiés, 10.8.
10. [T] **Copier, couper, coller** (décision du porteur, 04/11). Le presse-papiers de l'explorateur est **à lui** (une seule chose à
    la fois, en mémoire de la page : ni le presse-papiers du système, ni le navigateur ; il se vide à la fermeture de l'explorateur,
    parce que ce qui y attendait a pu changer pendant que la personne était dans une app). **Ctrl/⌘+C** copie un fichier (un dossier
    ne se copie pas : la phrase dit de le couper), **Ctrl/⌘+X** coupe un fichier ou un dossier, **Ctrl/⌘+V** colle dans le dossier
    ouvert : la vue « Moi » et ses dossiers, jamais « Récents », « Favoris » ni la corbeille (la phrase le dit). Une copie se colle
    autant de fois que la personne veut ; ce qui est coupé, une fois (**couper puis coller déplace** : c'est le rangement du point
    7, une ligne par fichier, le favori garde sa place, rien n'est dupliqué ; un dossier suit avec tout ce qu'il contient, et ne va
    ni en lui-même ni chez lui). Le fichier collé (ou copié) est rangé par une ligne de cette table pour la personne : la copie d'un
    fichier d'une app a sa propre ligne (`App`, `Fichier` = l'identifiant de la copie, `Dossier`), sans favori ; à la racine, aucune
    ligne n'est écrite. Un fichier copié qui a disparu entre-temps (supprimé ou mis à la corbeille par une autre personne) n'est pas
    collé : la phrase le dit. Le geste est refusé, avec sa raison, dans un document en lecture seule, pendant le choix d'un fichier
    pour une app (les gestes d'écriture y sont grisés), et dans un champ de saisie (la touche reste au texte, qui se copie comme
    avant) ; quand du texte est sélectionné, Ctrl+C copie ce texte. **Ctrl+D duplique d'un geste** (demande du porteur, 12/11 ; elle
    était laissée au marque-page du navigateur jusque-là) : même geste que « Dupliquer » du menu de la ligne (clic droit, Maj+F10,
    « Plus d'actions »), qui dit « Ctrl+D » ; la copie est rangée dans le dossier de l'original (pas dans le dossier ouvert), prend le
    clavier, et ne touche pas à ce qui est copié ou coupé. L'explorateur retient l'événement (`preventDefault`) pour que le navigateur
    n'ajoute pas de marque-page ; dans un champ de saisie (la recherche), Ctrl+D reste au navigateur. Un dossier ne se duplique pas
    (la phrase dit de le couper), ni à la corbeille ni pendant le choix d'un fichier, ni un fichier que l'app seule sait copier (mêmes
    phrases que Ctrl+C). Une touche tenue enfoncée ne fait qu'une copie ; deux appuis qui se suivent font deux copies, l'une après
    l'autre (la seconde lit le dossier quand la première y est rangée : deux noms différents).
11. [D] **Créer, garder et supprimer un dossier, même vide** (décision du porteur, 04/11 : « créer des dossiers et sous-dossiers », tout
    se fait depuis l'explorateur). Un dossier sans fichier tient à une **ligne d'état** : `App` et `Fichier` vides, `Dossier` = son chemin,
    `Utilisateur` = la personne (point 1). Un sous-dossier n'a que sa propre ligne : ses parents existent d'office. Une ligne d'une autre
    personne, une ligne réservée (point 6) ou un chemin vide n'est pas un dossier de la personne.
    - **Créer.** « Nouveau dossier » est le premier article du menu « Nouveau » de l'explorateur : le dossier naît dans le dossier ouvert (à la
      racine quand la vue n'est pas un dossier : « Récents », « Favoris », la corbeille), et la personne y est conduite. Une fenêtre du widget
      demande le nom et dit où il naît ; un nom vide, ou celui d'un voisin (comparé comme la recherche, point 7), y est refusé. La table
      `GFS_Rangement` est créée avec l'accord de la personne s'il n'y en a pas encore (6.2) ; le geste n'écrit que la ligne d'état. Pendant le
      choix d'un fichier pour une app, « Nouveau dossier » est refusé comme les autres gestes d'écriture, et les dossiers sans fichier ne sont
      pas montrés.
    - **Rester.** Un dossier que la personne vide ne disparaît pas. Le geste qui le laisse sans fichier (déplacer, couper-coller, renommer ou
      déplacer un dossier) écrit sa ligne d'état **dans le même lot** ; **mettre à la corbeille** son dernier fichier l'écrit dans un lot à
      part, **silencieux** : sans la table `GFS_Rangement` (ou sans une de ses colonnes), GFS ne la crée pas et ne pose aucune question pour
      garder un dossier. La limite est dite : le dossier qu'un fichier tenait seul (un modèle que l'app range elle-même) disparaît alors avec
      lui, et revient avec le fichier restauré ; le lot échoue sans bruit (un avertissement) si Grist le refuse, le fichier est à la corbeille.
    - **Supprimer.** Un dossier **sans fichier**, sous-dossiers compris, se supprime (menu de la ligne, Suppr) : sa ligne d'état et celles de ses
      sous-dossiers sont retirées en un lot, **sans question** (rien n'est perdu : la corbeille est pour les fichiers) ; la phrase dit qu'il est
      supprimé. Un dossier qui a un fichier ne se supprime pas : l'article du menu est grisé (un clic redit pourquoi, comme Suppr) ; la personne
      vide le dossier d'abord. Un dossier que plus rien ne nomme (une autre personne l'a supprimé entre-temps) reçoit la phrase « Ce dossier n'existe plus ».
    - **Par personne.** Chacun voit ses dossiers sans fichier, jamais ceux d'un autre ; en supprimer un ne touche pas ceux d'un autre. Le
      rangement propre de l'app (point 5) n'est jamais écrit.
    [M] Mesuré le 04/11 dans un vrai serveur Grist 1.7.19 avec les modèles de Publipostage+ (`labo/run-dossiers.mjs`, 44 vérifications dans
    chacune des quatre combinaisons, aucune en échec) et dans un vrai Firefox 159 (`test/dossiers-firefox.mjs`) : faits vérifiés, section 31.
12. [T] **Glisser-déposer un fichier ou un dossier sur un dossier** (demande du porteur, 04/11 : « drag & drop des fichiers dans des dossiers,
    en amont, en aval »). C'est une autre façon de demander **le déplacement du point 10** (couper puis coller) : le même rangement,
    les mêmes lignes écrites, les mêmes phrases (« Contrat est déplacé dans Facturation »), rien de plus. La ligne tenue est un fichier ou un
    dossier de la liste (ligne ou vignette) ; elle se dépose sur **un dossier de la liste** (en aval), **une ligne du volet des dossiers**
    (« Moi » comprise) ou **un lien du fil d'Ariane** (en amont : la racine, un ancêtre). Un dossier fermé du volet qu'on survole 700 ms
    s'ouvre, pour que son sous-dossier devienne une cible. La cible qui accepterait la ligne s'éclaire (le bleu de la sélection, cerné d'un
    trait plein) et le curseur dit « déplacer » ; **une cible qui ne changerait rien n'est pas acceptée** (le curseur dit « interdit », rien
    ne s'éclaire) : le dossier où est déjà le fichier ou le dossier, un dossier sur lui-même ou dans un de ses sous-dossiers, son dossier
    parent. Le glissement part des fichiers de « Récents » et de « Favoris » comme de ceux d'un dossier ; **il ne part pas de la corbeille**
    ni pendant le choix d'un fichier pour une app, et ce qu'un autre programme glisse sur l'explorateur (un fichier de l'ordinateur) n'est
    pas accepté. Rien ne se dépose sur « Corbeille » : mettre à la corbeille reste le geste de la corbeille (6.6, point 10 ; 6.7). La ligne tenue n'est gardée que
    dans la page, jamais dans le presse-papiers du système ; un fichier coupé (Ctrl+X) reste coupé après un dépôt. Les mêmes refus que le
    point 10 : lecture seule, accès incomplet (la phrase le dit). Au clavier, le même déplacement est Ctrl+X puis Ctrl+V, ou « Déplacer »
    dans le menu de la ligne ; le glisser est un raccourci pour la souris, jamais le seul chemin. [M] **Mesuré le 04/11** sous Chromium,
    dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris (le bouton appuyé, la souris tirée, le bouton relâché ; le
    navigateur lance lui-même le glissement), en français clair et en anglais sombre (`labo/run-glisser-explorateur.mjs`, 30
    vérifications dans chacune, aucune en échec) : faits vérifiés, section 38. **Sous Firefox sans écran le dépôt n'aboutit pas au banc**
    (ni `drop` ni `dragend`, faits vérifiés 25) : `test/glisser-firefox.mjs` mesure ce qui s'y mesure (les lignes se tiennent, le départ, la
    cible qui accepte ou refuse) ; le dépôt à la vraie souris sous Firefox est à essayer chez le porteur.
13. [T] **Ctrl+Z (⌘+Z) défait le dernier geste de l'explorateur, Ctrl+Y (ou Ctrl+Maj+Z) le rétablit** (demande du porteur, 04/11 : « Ctrl+Z doit aussi
    faire revenir un fichier supprimé, et plus globalement toutes les modifications : renommage, déplacement, etc. » ; puis, à sa carte, « Oui, au clavier
    seulement » pour le rétablissement). L'explorateur garde une **pile des gestes qui ont
    abouti** (les 50 derniers, js/files/undo-stack.js) ; chaque appui défait **un seul geste, le plus récent**, dans l'ordre inverse, et dit ce qui
    est revenu (« Annulé : le nom « Contrat » est revenu », ou la phrase de la corbeille). Ce qui se défait : **mettre à la corbeille** (le
    fichier est restauré, à son numéro), **restaurer** (il retourne à la corbeille), **renommer** un fichier, **épingler ou désépingler**,
    **déplacer** un fichier ou un dossier (par le menu, couper-coller ou glisser-déposer, point 12), **renommer un dossier**, **créer un
    dossier** (il est supprimé), **supprimer un dossier** (il revient, avec sa ligne d'état), **copier ou dupliquer** (la copie va à la corbeille).
    **Défaire écrit comme le geste d'origine** (le rangement, le nom, la corbeille : mêmes lignes, mêmes refus : lecture seule, accès incomplet,
    table refusée). **Rétablir** : ce que Ctrl+Z vient de défaire se refait, un geste par appui, dans l'ordre inverse (« Rétabli : « Contrat » est de nouveau
    dans « Facturation » ») ; ce que Ctrl+Z écrit dépose de quoi le refaire dans une **seconde pile** (les 50 derniers), et ce que Ctrl+Y écrit dépose de quoi le défaire
    de nouveau : Ctrl+Z, Ctrl+Y, Ctrl+Z avancent d'un cran chacun, sans tourner en rond. **Un geste neuf vide cette seconde pile** : ce qu'on avait défait ne
    se refait plus (« Rien à rétablir »). **Rien de nouveau à l'écran** : ni bouton « Annuler » ni « Rétablir », seulement les touches (le menu de la ligne et
    la barre ne changent pas) ; **Ctrl+Maj+Z est Ctrl+Y** (⌘+Maj+Z sur Mac), et Ctrl+Maj+Y n'est pas lié. **Ce qui ne se défait pas** : « Supprimer définitivement » et « Vider la corbeille » (la fenêtre le dit avant) ; Ctrl+Z
    d'un geste qui portait sur un fichier supprimé pour de bon depuis dit « n'est plus là » et n'écrit rien. **Une annulation relit les
    fichiers d'aujourd'hui avant d'écrire** : un fichier qui n'est plus là (supprimé pour de bon depuis), dont le nom a changé depuis (par une autre
    personne ou une app), ou dont l'ancien nom est pris n'est pas touché, la phrase dit pourquoi ; **le rangement (dossier, étoile) est remis tel qu'il
    était avant le geste**, sans chercher si une autre personne l'a changé depuis ; un second appui pendant l'écriture est ignoré. **Remettre à la corbeille** un fichier qui tient à plus
    qu'une ligne (point 2.4, `appel` : un formulaire de Form+) attend l'app ouverte, comme le geste d'origine : la phrase dit d'ouvrir l'app, rien n'est
    écrit et **le geste reste à défaire (ou à refaire)** ; restaurer n'a pas besoin de l'app. La pile vit autant que la page (elle survit à la fermeture de
    l'explorateur et au passage d'une app à l'autre). **Dans un champ de saisie** (la recherche, une fenêtre), Ctrl+Z et Ctrl+Y restent ceux du texte ;
    pendant le choix d'un fichier pour une app, ils sont grisés comme le reste (la phrase le dit). [M] **Mesuré le 04/11** dans un vrai Grist
    (`labo/run-annuler.mjs`) et sous Firefox (`test/annuler-firefox.mjs`) : faits vérifiés, section 42.

14. [D] **« Ouverts » : revenir à un fichier déjà ouvert, sans repartir de l'arborescence** (demande du porteur, 04/11 : « un système d'onglet pour
    revenir sur un fichier ouvert et pouvoir faire des A/R entre plusieurs fichiers sans repartir à zéro dans l'arborescence » ; choix « la liste d'abord,
    les onglets vivants après » ; « pas d'ajout sur la barre flottante » dit le 04/11 d'un autre sujet, les réglages, puis la carte « où poser la liste » : le 10/11 l'option conseillée, la liste
    seulement dans l'explorateur, avait été prise ; **le 11/11 le porteur a choisi « Un 5e bouton sur la barre »** : la liste vit dans l'explorateur **et** sur la
    barre). Le volet a une première ligne, « Ouverts », avant « Récents » ; son nombre est celui des fichiers ouverts que la liste montre (aucun nombre quand il n'y en a pas).
    **Ce qui y entre** : un fichier précis que GFS a ouvert dans une app et que l'app a ouvert (le double-clic, Entrée, un lien entre apps, « Lire » un PDF que
    GFS garde). N'y entrent pas : un fichier vierge (« Nouveau », « Importer »), ce qu'une app ouvre toute seule (GFS ne le sait pas), ni un refus (la
    personne a annulé dans l'app, ou l'app ne connaît pas l'appel `ouvrir`). **La liste** : les huit derniers (un neuvième fait sortir le plus ancien), à
    plat (tous les dossiers, le dossier en indice), triée comme les favoris (par nom ; la tête de colonne change l'ordre) : son ordre ne bouge pas quand on
    passe d'un fichier à l'autre, c'est ce qui fait un aller-retour. Elle ne garde que des clés `app:id`, **rien dans Grist ni dans le navigateur** : le
    nom, le type, la date, le dossier et le poids sont ceux des fichiers d'aujourd'hui (un fichier renommé ou déplacé y est à jour, un fichier mis à la
    corbeille ou disparu n'y est plus) ; quand Grist recharge le widget, tous les cadres meurent et la liste est vide. **Le mot « affiché »** (jamais
    une couleur seule) est sur le fichier que l'app active montre, tant que c'est la session d'app que GFS a ouverte sur lui ; il s'efface quand l'app est
    remplacée ou qu'un fichier vierge s'ouvre. **Revenir à un fichier** : double-clic ou Entrée, comme partout (une autre app est d'abord priée de se
    fermer, point 5.4 point 3 ; la même app reçoit l'appel `ouvrir`) ; si l'app refuse, rien ne change et le fichier n'entre pas dans la liste.
    **« Retirer des ouverts »** est le deuxième article du menu d'une ligne, dans cette vue seulement : la ligne sort de la liste, le fichier et l'app ne
    bougent pas, la ligne suivante prend le clavier. Pendant le choix d'un fichier pour une app, la vue ne montre que ceux que l'app accepte. **Le 5e bouton de la barre, « Fichiers ouverts »**
    (11/11 ; `js/explorer/opened-bar.js`, `js/shell/dock.js`, 5.2 point 7) : le deuxième de la barre, entre « Fichiers » et « Apps » ; icône pile, **pastille qui porte le nombre**
    (le nombre est aussi dans le nom du bouton, « Fichiers ouverts : 3 ») ; **grisé, jamais masqué**, quand rien n'est ouvert, et son menu le dit (un article grisé dont
    le clic explique). Son menu (titre « Fichiers ouverts ») liste les mêmes fichiers **du plus récent au plus ancien** (le dernier ouvert en tête : l'aller-retour
    entre deux fichiers garde les mêmes places ; l'explorateur trie par nom) : l'icône du type (sans couleur : elle est réservée à l'explorateur), le nom (coupé par « … »
    avec son texte entier au survol), l'app en indice, et le fichier que l'app montre **en gras, avec un trait et son mot « affiché »** pour un lecteur d'écran. Un clic sur un
    autre fichier l'ouvre comme dans l'explorateur (une autre app est d'abord priée de se fermer, 5.4 point 3) ; **un clic sur le fichier affiché referme le menu sans
    rien relancer**. **La croix de la ligne (ou Suppr)** retire le fichier de la liste sans le fermer, et le menu se rouvre sans lui, le clavier sur la ligne qui prend sa
    place ; au clavier, → va à la croix, ← revient, ↓ et ↑ ne s'y arrêtent pas, Début et Fin vont au premier et au dernier article. **« Ouvrir un autre fichier… »** montre
    l'explorateur, comme « Fichiers ». La barre est une barre d'app : elle s'efface sous l'explorateur, et le menu s'ouvre à côté d'une barre verticale, au-dessous ou au-dessus
    d'une barre horizontale, sans la recouvrir. **Les onglets
    vivants** (plusieurs cadres d'app gardés ensemble) **ne sont pas faits** : une seule app est vivante à la fois. [M] **Mesuré le 10/11** dans un vrai Grist
    (`labo/run-ouverts.mjs`) et sous Firefox (`test/ouverts-firefox.mjs`) : faits vérifiés, section 79 ; **le 5e bouton, le 11/11** (`labo/run-ouverts-barre.mjs`,
    `test/barre-ouverts-firefox.mjs`) : faits vérifiés, section 97.
15. [T] **Une liste longue ne construit que ce qu'on voit** (décision du porteur, 10/11, audit vitesse et poids : « Afficher seulement les lignes
    visibles »). À partir de 200 lignes (liste) ou vignettes (`WINDOW_FROM`, `js/explorer/explorer-window.js`), l'explorateur construit les lignes visibles et huit
    rangées de part et d'autre ; l'espace des autres est tenu par le remplissage du conteneur : la barre de défilement, Début, Fin, la molette et la position
    gardée au redessin sont ceux d'une liste entière. **Ce que cela impose** : toutes les lignes d'une vue ont la même hauteur (mesurée à l'exécution, 28 px,
    37 px en accessibilité renforcée ; le nom d'une vignette réserve deux lignes) ; le clavier, la sélection, le presse-papiers et « Ouverts » lisent les
    données de la vue, non le DOM (`reveal(index)` construit et amène à l'écran la ligne voulue) ; le clavier reste à la liste quand la ligne qui l'avait sort de
    la fenêtre ; `aria-rowcount` et `aria-rowindex` annoncent le vrai nombre de lignes et leur rang ; un glissement en cours tient les lignes en place jusqu'à sa
    fin. **Ce que cela ne fait pas** : la recherche Ctrl+F du navigateur ne trouve pas une ligne qui n'est pas construite (le champ de recherche de l'explorateur,
    lui, cherche dans toutes les données). [M] **Mesuré le 10/11** dans un vrai Grist et sous Firefox à 700 × 400 : faits vérifiés, section 87.

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

### 6.6 `GFS_Fichiers`, les fichiers que GFS garde lui-même

Les PDF : ceux que la personne importe (« Nouveau > Importer > PDF ») et ceux qu'une app range (5.4, point 9). Choix du
porteur, le 03/11 : **GFS garde les PDF**, dans le document, et aucune app n'écrit jamais ce que GFS garde. Une seule table, le
fichier lui-même en pièce jointe de Grist.

| Colonne | Type Grist | Contenu |
|---|---|---|
| `Identifiant` | Text | 12 caractères hexadécimaux tirés au hasard, jamais changés : il nomme le fichier dans `GFS_Rangement` (`App = gfs-fichiers`) |
| `Nom` | Text | Le nom, avec son « .pdf » ; unique, casse et espaces autour ignorés (la règle de 6.3, point 2) |
| `Type` | Text | `pdf` |
| `Date` | DateTime:UTC | Le dernier dépôt, en secondes comme Grist les rend |
| `Auteur` | Text | L'adresse de la personne qui l'a déposé, telle que GFS la connaît (6.4, point 9) ; vide tant qu'elle ne l'est pas |
| `Contenu` | Attachments | Le PDF : une pièce jointe de Grist (`['L', numéro]`) |
| `Taille` | Int | En octets |
| `Origine` | Text | `import`, ou l'`id` de l'app qui l'a rangé (5.4, point 9) ; un fichier remplacé garde la sienne |
| `SupprimeLe` | DateTime:UTC | Vide tant que le fichier est là ; sinon le moment où la personne l'a mis à la corbeille, en secondes (point 10) |
| `SupprimePar` | Text | L'adresse de la personne qui l'y a mis, telle que GFS la connaît (comme `Auteur`) ; vide tant qu'elle ne l'est pas |

1. [T] La table naît avec l'accord de la personne (6.2), au premier PDF gardé, **avant tout envoi** : la fenêtre « Créer la table
   GFS_Fichiers ? » dit ce qu'elle garde ; un refus ne laisse rien derrière lui (ni table ni pièce jointe). Après l'`AddTable`,
   GFS relit l'identifiant réel (6.2, point 2) ; Grist ajoute une page pour elle. Une table d'avant à qui il manque une colonne la
   reçoit (6.1, point 3) ; une colonne absente n'est jamais écrite. [M] Mesuré le 03/11 sur un vrai serveur Grist 1.7.19
   (`prototype/labo/run-pdf.mjs`) : les huit colonnes et leurs types, la page. Les deux colonnes de la corbeille (point 10) s'ajoutent à une
   table d'avant au premier geste (mesuré le 04/11, `run-corbeille.mjs`).
2. [T] **Le manifeste de ces fichiers est dans GFS** (`js/files/gfs-files.js`, `id` `gfs-fichiers`, `integre`) : il n'est pas un
   sous-module, il ne passe ni par le catalogue ni par l'installation, aucune app n'y est liée. L'explorateur le lit comme celui
   d'une app (2.4) : `colonnes` `{ id: Identifiant, nom: Nom, type: Type, date: Date, par: Auteur }`, un seul type (`pdf`, de couleur `pdf` (le rouge, 04/11),
   un mot et une icône). Le rangement de ces fichiers (favoris, dossiers) est celui de GFS (6.4) sous `App = gfs-fichiers`, à
   la personne ; renommer écrit `Nom` seulement (6.3, point 2) en gardant le « .pdf ».
3. [T] **Un nom pris.** Importer un fichier dont le nom est déjà gardé ouvre une seule fenêtre, sur la base commune des fenêtres :
   « Remplacer » (la ligne garde son identifiant, son nom, sa place et ses favoris ; le contenu et la date changent), « Garder
   les deux » (le nouveau prend le premier nom libre, « Nom (1).pdf » ; un « (n) » déjà en fin de nom est remplacé, pas empilé ;
   la casse du nouveau nom est gardée) ou rien (Annuler, Échap ; un clic à côté ne ferme rien). Le clavier est sur « Garder les deux » : un Entrée
   distrait n'écrase rien. Un fichier qu'une app range sous un nom pris ouvre la même fenêtre, qui nomme l'app (5.4, point 9). Le nom libre et le nom pris sont recalculés sur la table **relue au moment d'écrire** : un fichier
   déposé ou retiré par une autre personne pendant que celle-ci décidait est pris en compte, jamais écrasé. L'ancienne pièce
   jointe d'un fichier remplacé n'est plus citée : Grist l'efface seul au bout de 7 jours (faits vérifiés, 14).
4. [T] **Ce que GFS vérifie avant d'envoyer** : l'extension « .pdf » (le nom saisi est mis en forme : un « .pdf » manquant est
   ajouté), un fichier non vide, `%PDF-` dans ses 1024 premiers octets. Un fichier qui ne passe pas est dit à la personne et
   n'est ni envoyé ni écrit.
5. [T] **Le cadre d'envoi.** La page de GFS ne peut atteindre que sa propre origine (`connect-src 'self'`) : l'envoi et le
   téléchargement des pièces jointes passent par un sous-cadre caché, `transfer/index.html`, de GFS (`js/broker/transfer.js`),
   `sandbox="allow-scripts"` seul (origine opaque, comme un cadre d'app, 1.3), sous sa propre politique de sécurité du contenu
   (`default-src 'none'; script-src 'self'; connect-src https:` : l'adresse du serveur n'est connue qu'à l'exécution). Il parle à
   GFS par un canal privé (`MessageChannel`, remis par le premier message, le routeur n'écoute aucune autre fenêtre) ; GFS
   lui donne chaque adresse, avec le jeton d'accès que Grist lui remet (`getAccessToken`, par sa propre connexion : la capacité
   de 3.4 ne concerne que les apps), en `?auth=`. Une app qui veut ranger un PDF le demande à GFS (5.4, point 9) : elle ne reçoit aucun
   jeton pour cela et n'a aucun accès à ce cadre.
6. [T] **L'en-tête `X-Requested-With: XMLHttpRequest` à l'envoi.** Sans lui, Grist 1.7.19 répond 401 **sans en-têtes CORS** à toute
   écriture d'une page d'une autre origine : le navigateur ne rapporte que « NetworkError » (c'est ce que la sonde du 03/11 a vu
   chez le porteur). Le cadre l'ajoute à l'envoi ; le téléchargement, une lecture simple, n'en a pas besoin. [M] Mesuré le
   03/11 (faits vérifiés, 14).
7. [T] **Ouvrir un PDF**, c'est le **lire** dans l'app dont le manifeste le déclare (`actions.lire`, 2.7, point 5 ; 5.4, point 8) :
   « Lire » est alors le geste principal et « Télécharger » reste dans le menu de la ligne. Quand aucune app du catalogue ne le lit,
   c'est le télécharger sous son nom (un lien invisible cliqué ; le bouton du pied et le menu disent « Télécharger »). Dupliquer copie la
   ligne (point 13) ; supprimer passe par la corbeille (point 10), et GFS le fait lui-même (6.3, point 2, ne vaut que pour les
   tables d'une app). **Jusqu'au 04/11**, supprimer retirait la ligne tout de suite, après une question : c'est devenu « Supprimer
   définitivement », qui ne se fait que depuis la corbeille.
8. [T] Un document en lecture seule, ou ouvert sans l'accès complet, grise « PDF » dans « Importer » avec sa raison : rien ne
   s'écrit sans un geste de la personne, rien ne s'envoie sans la table. Le dépôt d'une app y est refusé de même
   (`GFS_LECTURE_SEULE`, `GFS_ACCES`, 5.4, point 9).
9. [M] **Restent à mesurer chez le porteur** : la passerelle et la taille maximale d'une pièce jointe de l'instance de la DINUM
   (le serveur local accepte 12 Mo ; un refus 413 est dit en mots, sans écrire de ligne), et le Firefox des deux postes (le
   cadre en bac à sable, le téléchargement par lien) : le labo n'a que Chromium.
10. [T] **La corbeille** (décision du porteur, 04/11 : « prévoir une corbeille pour les éléments supprimés »). **Mettre à la corbeille**
    (menu de la ligne, ou Suppr) écrit `SupprimeLe` (maintenant, en secondes) et `SupprimePar` sur la ligne, et rien d'autre : la
    ligne, son `Identifiant`, son `Nom`, son contenu, ses favoris et son dossier restent ; la pièce jointe reste **citée**, donc Grist
    ne l'efface pas (il efface seul, au bout de 7 jours, ce qui n'est plus cité : faits vérifiés, 14). Pas de question : rien ne s'efface.
    Un fichier à la corbeille n'est plus listé ailleurs, ne se télécharge pas, ne compte pas dans le nom pris (un nouveau fichier peut
    reprendre son nom) et ne peut ni être renommé ni déplacé ; GFS ne dit rien aux apps (leurs fils, accrochés à l'`Identifiant`,
    restent dans leurs tables, 5.4, point 8). **La vue « Corbeille »**, à côté de « Récents » et « Favoris », est commune au
    document : elle liste les fichiers de toutes les personnes, avec la date et la personne (colonne « Supprimé », « Par »), le
    dossier où le fichier reviendra et un bouton « Restaurer » ; elle est grisée quand l'explorateur sert à choisir un fichier pour
    une app (un fichier supprimé ne se choisit pas). **Restaurer** (bouton, Entrée, menu) efface les deux colonnes (`SupprimeLe` redevient
    vide, mesuré `null` chez Grist) : la ligne et son identifiant sont ceux d'avant ; si un autre fichier a pris le nom entre-temps,
    le fichier revient sous le premier nom libre (« Nom (1).pdf ») et la phrase le dit. **Supprimer définitivement** (menu, ou Suppr
    dans la corbeille) et **Vider la corbeille** passent par une fenêtre du widget, le clavier sur « Annuler » ; seul `RemoveRecord`
    retire une ligne, et seulement une ligne déjà à la corbeille : « Vider » ne retire que les fichiers que la personne a sous les yeux
    (un autre fichier mis à la corbeille pendant la fenêtre reste), en **un seul lot**. Aucune purge automatique : la corbeille se
    vide à la main. Le geste d'un document en lecture seule est refusé avec sa raison (`trash.readonly`), avant toute question.
11. [T] **Les gardiens.** `js/files/trash.js` ne sait pas où vit un fichier : il le demande à un « gardien » (`manages`, `lock`, `trash`,
    `restore`, `empty`), le seul qui sache l'écrire. `js/files/kept-files.js` est celui de `GFS_Fichiers`. Un fichier qu'aucun gardien ne
    connaît n'a pas de corbeille depuis GFS : l'article est grisé et un clic dit pourquoi. `js/files/app-files.js` est le gardien des
    fichiers des apps (recette déclarée dans le manifeste, 2.4 ; table `GFS_Corbeille`, 6.7), branché le 04/11 sans toucher au reste.
    Une erreur d'un gardien qui porte `expected: true` est un refus voulu (la personne a refusé une table, une ligne ne se garde pas) :
    la phrase l'explique, la console reste muette.
12. [M] **Mesuré le 04/11** dans un vrai serveur Grist 1.7.19 (Docker), à 700 × 400, à la vraie souris et au vrai clavier, en français
    clair et en anglais sombre (`prototype/labo/run-corbeille.mjs`, 46 vérifications dans chacune, aucune en échec), et dans un vrai Firefox 159
    sans écran (`prototype/test/corbeille-firefox.mjs`) : une table d'une version plus ancienne reçoit les deux colonnes au premier
    geste (`AddColumn` sur une table qui a déjà des lignes, sans demande, sans nouvelle table) ; une cellule de date jamais écrite est
    `null` pour l'API REST, et `UpdateRecord` avec `null` la vide ; la date écrite revient en secondes ; **plusieurs `RemoveRecord`
    dans un seul `applyUserActions` passent** (vider) ; la pièce jointe d'un fichier supprimé pour de bon reste sur le serveur ;
    le clavier arrive au panneau dans le cadre de Grist dès qu'un clic l'y a posé (↓ ↑ Suppr Entrée F2 Maj+F10, clic droit).
13. [T] **Dupliquer et copier-coller un PDF** (décision du porteur, 04/11). « Dupliquer » (menu de la ligne) et Ctrl+C puis Ctrl+V
    ajoutent une ligne à `GFS_Fichiers` : un nouvel `Identifiant`, le premier nom libre (« Facture (1).pdf »), la **même pièce
    jointe** (`['L', n]` : aucun octet n'est envoyé ni copié ; Grist garde une pièce tant qu'une cellule la cite, donc l'original
    peut être supprimé pour de bon sans abîmer la copie), la même taille et la même origine ; la copie est de la personne,
    d'aujourd'hui (l'auteur de l'original ne passe pas à la copie). Un fichier à la corbeille ne se copie pas (il se restaure
    d'abord) ; un fichier sans contenu non plus (la phrase le dit). La copie va dans le dossier ouvert (Ctrl+V) ou à côté de
    l'original (« Dupliquer ») : une ligne de `GFS_Rangement` (6.4, point 10), sans favori. [M] Mesuré le 04/11 dans un vrai Grist
    1.7.19 (faits vérifiés, 28) : même pièce jointe citée deux fois, le nombre de pièces du document ne bouge pas, la copie se
    télécharge octet pour octet après la suppression définitive de l'original.

14. [T] **Le cadre d'envoi lit aussi le poids exact du document** (lot 4 du poids, demande du porteur du 04/11). Une opération de plus, `json` : un `GET` dont le JSON revient tel quel, qui ne sert qu'à la lecture SQL du
    document (`GET <adresse du document>/sql?q=…`, jeton **en lecture seule** d'abord, que GFS demande à chaque lecture et ne garde pas ; **le jeton qui peut écrire seulement après un refus (403) du premier**, et alors pour toute la lecture de cette ouverture : dans un document à règles d'accès, Grist refuse `/sql` au jeton en lecture seule même au propriétaire, et ne le rend qu'au jeton qui peut écrire). Le cadre ne fait toujours que ce que GFS lui demande, requête par requête ; GFS n'écrit dans une
    lecture que des `SELECT` écrits dans `js/weight/weight-reader.js`, et le nom d'une table (un identifiant de Grist : lettres, chiffres, soulignés) n'y entre qu'après la vérification de sa forme. La fenêtre « Poids du document »
    (2.4, point 5) en est l'unique usage : le fichier entier (`pragma_page_count × pragma_page_size`), l'historique (`SUM(LENGTH(body))` de `_gristsys_ActionHistory`), les pièces jointes stockées (`_gristsys_Files`) et comptées
    comme Grist les compte, et **chaque table, seule** (`dbstat`, `name = '<table>'`). [M] Mesuré dans un vrai Grist 1.7.19 (faits vérifiés, 43) : Grist coupe toute lecture de plus d'une seconde (400 : « a slow statement resulted in
    a database interrupt ») et le document ne répond plus à rien d'autre pendant ce temps, donc le poids de toutes les tables d'un coup est interdit ; `/sql` n'est rendu qu'à qui peut tout copier (un propriétaire, ou un
    éditeur ou un lecteur d'un document sans règle de lecture) : le refus (403) de la première lecture, avec les deux jetons, grise la fenêtre avec cette raison, et l'estimation reste.
15. [T] **Le cadre d'envoi fait aussi les requêtes REST du moteur de partage** (partage d'un dossier ou d'un fichier entre deux documents qui ont GFS, décision du porteur du 06/11 ; consigne 003 à Sync+). Une opération de plus, `rest` : un `GET`,
    `POST`, `PATCH` ou `DELETE` (rien d'autre) dont l'adresse est celle que GFS a bâtie, **sans cookie**, avec l'en-tête `X-Requested-With` sur tout ce qui n'est pas une lecture (sans lui Grist répond 401 sans en-têtes CORS) et un corps JSON
    quand GFS en donne un ; la réponse revient en `{ status, body }` (le JSON de la réponse, sinon son texte). Deux entrées dans `Transfer` (js/broker/transfer.js) : `rest(method, path, { body, writable, params })` (l'adresse REST du document + `path`, avec
    un jeton de `getAccessToken`, en écriture par défaut : la liste des webhooks n'est rendue qu'à un propriétaire, avec un jeton qui peut écrire) et `anonymous(method, url, { body })` (sans jeton : la lecture d'un document public et l'envoi de lignes
    à l'adresse d'un formulaire publié ; **seulement vers le serveur du document** : le lien d'une autre instance ne part pas, le cadre ne reçoit rien). Un refus du serveur revient en `TransferError` « http » avec son code, un serveur muet en « network ».
    Aucune adresse de plus dans la politique de GFS : le cadre garde son `connect-src https:`. [M] Mesuré dans un vrai Grist 1.7.19 depuis le vrai cadre (faits vérifiés, 59) : le cycle d'un webhook (créer avec sa condition, lister, désactiver, vider sa file,
    effacer) passe, Grist livre l'ajout d'une ligne à l'adresse du webhook, un refus garde son code (404), la lecture d'un document public et l'envoi de lignes à un document public en édition passent sans jeton avec `Origin: null` ; **Grist garde
    quelques secondes le refus qu'il a donné à une personne anonyme** (lecture rendue à +5 s après avoir rendu le document public), donc le moteur réessaie au cycle suivant et ne conclut pas d'un premier refus.
    `rest` et `anonymous` prennent aussi `timeout` (millisecondes, 60 s par défaut : l'avis de fin d'un webhook en veut dix), et `baseUrl()` rend l'adresse REST du document (sans jeton, demandée une fois).
16. [T] **Le port de GFS pour le moteur de partage** (`prototype/js/sharing/sync-port.js`, `createSyncPort(deps)` et `startSyncEngine(deps)` ; le moteur est une copie de celui de Sync+ dans le kit, `kit/js/synchro/`, mise à jour par `outils/reprendre-synchro.mjs`).
    Il remplit chaque fonction de `PORT_SHAPE` (`kit/js/synchro/port.js`) avec ce que GFS a déjà : lignes, actions et schéma par `grist.docApi` (valeurs décodées), tout le REST par le cadre d'envoi (point 15), `navigator.locks`,
    la langue de GFS (`js/sharing/sync-port-text.js` : les textes du moteur, `error.*` et `recv.*`, plus six clés du port ; une clé inconnue est rendue telle quelle, sans avertissement, car le moteur s'en sert pour reconnaître une erreur
    prévue), `gfs.synchro.` pour les deux préférences. Les tables du moteur portent le préfixe `GFS_`. **Un seul moteur par page** (le port est global) et il ne se charge qu'au premier partage : `sync-port.js` n'est importé qu'à ce moment,
    et la carte d'importation de `index.html` nomme les modules de `kit/js/synchro/` (`outils/versions.mjs`). Une requête anonyme ne part jamais vers un autre serveur que celui du document (`otherInstance`). Le port a aussi `shareInfo` (le document qu'une clé de formulaire désigne : le contrôle d'un lien collé), `publicAccess` et `journalStats`, que les écrans de Sync+ appellent hors de `PORT_SHAPE`
    (consigne 005). **Depuis le moteur 2.x (kit 0.14.0)** le REST n'est plus écrit par GFS : `createRestPort({ docApi: { fetchRows }, http })` (`kit/js/synchro/rest-port.js`) le rend tout entier (webhooks, `/compare`, SQL, envois directs,
    lecture publique, fiche d'un partage, pièces jointes), et GFS ne donne que `http` : `request` (le jeton qui écrit quand `full`), `anonymous` (sans jeton ; une adresse d'un autre serveur n'est pas suivie : `otherInstance`), `download`, `upload` et
    `docBaseUrl`, sur le cadre d'envoi. Un refus du serveur lève une erreur qui porte son `status` et le début (200 signes) de ce que Grist en dit ; le reste (cadre, jeton, réseau, délai, réponse inattendue) n'a pas de `status` et se
    dit dans la langue de la personne ; une réponse vide est `null`. `isOwner` reste celui de GFS (le code seul de `GET /webhooks`). [M] 40 vérifications dans un vrai Grist (faits vérifiés, 60 et 66), 16 essais du port sans Grist
    (`test/sync-port.test.mjs`).
17. [T] **« Partager > Dans un autre document Grist » : un fichier, un document, un niveau** (décisions du 07/11 et du 09/11 ; premier lot : les PDF de `GFS_Fichiers`, propriétaire du document). La fenêtre « Partager » a deux onglets, « Dans ce document »
    et **« Dans un autre document Grist »**, grisé (jamais masqué) avec sa raison pour un fichier d'app, pour un dossier, ou pour qui n'est pas propriétaire ; dégrisé pour le propriétaire **même quand les droits de GFS ne sont pas activés**. L'onglet liste les
    **documents reliés** (`js/sharing/share-links.js`) avec le niveau **de ce fichier** : « Pas partagé », « Copie à jour », et par le menu « Une copie, une fois », « Arrêter la copie » (grisé, avec sa raison, pour un fichier pas partagé) ; un lien qui attend la
    réponse de l'autre document est verrouillé (un clic dit pourquoi). « **Relier un nouveau document…** » ouvre le premier envoi (`js/sharing/share-other-window.js`, par-dessus « Partager »). **Un document relié est un export du moteur dont la condition nomme les
    fichiers partagés** (`Identifiant in […]` sur `GFS_Fichiers`, jamais vide : un identifiant fictif quand le dernier fichier sort, car une condition sans valeur envoie tous les fichiers : faits vérifiés, 70). « Copie à jour » = le fichier est dans la
    condition ; « Une copie, une fois » = il y entre, part, puis en sort (condition relue à ce moment-là) ; « Pas partagé » = il en sort. **GFS reçoit toujours « en archive »** : un fichier qui sort du partage **reste chez l'autre**, marqué `Supprimee_a_la_source`.
    Le premier envoi suit `js/sharing/share-other-flow.js` : le choix (une copie une fois ou qui se met à jour ; le nom du lien est celui du document pour le second), l'accord (ce que GFS ajoute : la table `GFS_Synchro`, trois colonnes d'aide `id_sync`, `MajLe`, `RecalculLe`
    dans `GFS_Fichiers` qui restent, un webhook ; **rien n'est écrit avant**), le code d'invitation, la réponse collée par l'autre personne (**le moteur juge le lien et le code, GFS n'en juge rien** : décision du porteur du 09/11), le document qui répond dit par
    Grist avec le code de contrôle (**« Exiger la comparaison du code » est coché au départ à chaque envoi** — décision du porteur du 09/11, audit de sécurité : l'invitation est alors en sécurité renforcée du moteur, la case « J'ai comparé ce code avec celui de l'autre document » grise « Envoyer » tant qu'elle n'est pas cochée et le moteur refuse sans elle, `codeNotCompared` ; décochée, le code reste affiché et l'envoi part sans confirmation ; le réglage n'est pas retenu d'un envoi à l'autre), l'envoi ; « une fois » arrête ensuite le partage, « à jour » **garde le lien** (les fichiers suivants partent par le menu, sans nouveau code). Fermer la fenêtre avant l'envoi défait ce qui était préparé ; la fermer en cours
    d'envoi laisse l'envoi se poursuivre (un avis le dit à la fin). **« Gérer les partages > Autres documents »** liste les liens avec leur état (à jour, en pause, bloqué, en attente) ; « Arrêter » (« Annuler » pour une invitation en attente) **demande d'abord**,
    puis défait l'export, son webhook et ses lignes : **ce qui est arrivé reste chez l'autre**. **Le moteur ne se charge que pour un document qui partage ou a reçu, ou à l'ouverture d'un onglet ou d'une fenêtre qui en parle** (`js/sharing/sync-service.js`) : à
    l'ouverture de la page, `js/sharing/sync-resume.js` lit la liste des tables et relance la boucle d'envoi (table `GFS_Synchro`) ou de réception (un `GFS_Journal_…`), sans quoi le contenu d'un fichier ne passerait pas quand l'une des deux pages était fermée. **Les tables techniques ne sont lisibles que des propriétaires** (décision du porteur du 09/11, audit de sécurité ; faits vérifiés, 76) : `js/sharing/sync-rules.js` pose, avec la note « GFS : Partages · … », `GFS_Synchro` en `+CRUD` pour les propriétaires et `-CRUD` pour les autres, un journal `GFS_Journal_…` en `+CRUD` / `-RUD` (la création reste ouverte, c'est par elle que le formulaire de réception écrit) ; `GFS_Recus…` reste lisible. Les règles se posent à la fermeture de la fenêtre de l'envoi, de la réception ou de « Relier » (Grist recharge alors la page) et à l'ouverture de la page ; seuls les propriétaires, prouvés tels, font tourner les boucles du moteur : **les fichiers ne se recopient que lorsqu'un propriétaire ouvre le document**.
    **Le côté qui reçoit** : « Nouveau > Importer > **D'un autre document Grist…** » (`js/sharing/share-receive-window.js`, parcours `js/sharing/share-receive-flow.js`, fonctions du moteur `kit/js/synchro/target/receive.js` ; grisé avec sa raison quand rien ne peut s'écrire
    ou pour qui n'est pas propriétaire). Quatre écrans sur la base commune des parcours (`js/sharing/steps-window.js`) : le code d'invitation collé (le moteur le lit ; un code d'une autre sorte, un lien public ou un échange, est refusé), **l'accord** (ce que GFS ajoute :
    une table et un journal technique avec la page de son formulaire ; **rien n'est écrit avant « Accepter »**), le **lien du formulaire** que la personne copie dans Grist (Grist ne donne pas la clé d'un formulaire à un widget ; le moteur vérifie que le lien
    écrit bien dans ce journal), puis **la réponse** à donner à l'envoyeur et le même code de contrôle que chez lui. GFS reçoit **toujours en archive** (70) ; la boucle de réception démarre dès la réponse. **Où arrivent les fichiers** : une destination ne reçoit
    les fichiers que d'un seul partage (règle du moteur, `destTaken`, mesurée) : `GFS_Recus` pour le premier, puis `GFS_Recus_2`, `GFS_Recus_3`… (la première table libre, jamais une table qui existe déjà) ; un partage déjà reçu de ce document reprend sa
    réception (même table, même journal) avec la nouvelle invitation. Fermée avant la réponse, la fenêtre défait ce qu'elle a créé (le journal, la page, la table encore vide) ; après la réponse, rien n'est défait. **Relier sans fichier** (le modèle du porteur en deux étapes : le setup qui lie les deux documents, avec ou sans fichier, puis les partages par fichier) : « Gérer les partages > Autres documents > **Relier un document…** » ouvre la même
    fenêtre sans fichier (la condition nomme l'identifiant fictif de GFS, rien ne part, le lien reste ; faits vérifiés, 71 et essai `labo/run-relier-sans-fichier.mjs`) ; chaque fichier se partage ensuite par « Partager » sans nouveau code. **« Partagés avec moi »** (09/11 ; une vue du volet de gauche, entre « Favoris » et « Corbeille » : `js/sharing/received-files.js`, `js/sharing/received-control.js`, `js/sharing/received-window.js`) : la liste à plat de tout ce qui arrive dans
    les tables `GFS_Recus`, `GFS_Recus_2`… (toutes, par leur nom), jamais mêlée aux fichiers vivants (`loadFiles` les rend à part, `received` : choisir, ouvrir, lire, ranger et chercher d'une app ne les voient pas, et les marques de
    rangement de GFS ne les touchent pas). Une arrivée est **à accepter** (ni `Accepte` ni `Refuse` : grisée, cadenas, mot « À accepter », sans étoile ; le volet porte leur nombre), **acceptée** (`Accepte` vrai : elle se lit comme un PDF que GFS garde,
    « Lire » ou « Télécharger » ; ni corbeille, ni copie, ni renommage : la table est celle du partage) ou **refusée** (`Refuse` vrai : plus montrée). La question « Accepter « X » ? » (Entrée, double clic, « Ouvrir », menu « ⋯ ») est
    **un oui ou un non pour ce fichier seulement** : Échap n'écrit rien ; la marque s'écrit sur la seule ligne, après le geste (`OwnTable` ajoute les deux colonnes Bool `Accepte` et `Refuse` à la table reçue avant d'écrire, jamais
    de `AddTable` ; l'accord de la réception les annonce). **Refuser masque, n'efface pas** : une ligne effacée reviendrait à la mise à jour de l'envoyeur (72). Un document en lecture seule dit pourquoi, sans fenêtre ; sans arrivée, la vue dit quoi faire.
    **La cloche Notifications** (09/11) : à droite de l'en-tête de l'explorateur (icône `bell`, à ajouter à la charte), une pastille dit le nombre d'arrivées à accepter, et le menu les nomme (« « Contrat.pdf » de X, à accepter » ; six au plus, puis « Voir N autres… ») avant « Ouvrir « Partagés avec moi » » ; un clic sur une arrivée pose sa question. Elle lit la liste déjà chargée : **elle n'écrit rien et ne crée aucune table** ; sans notification la ligne reste, grisée, et son clic dit ce qui s'annonce ici ; pendant le choix d'un fichier la cloche est grisée. La table `GFS_Notifications` ne viendra que pour une notification qu'il faut retenir (lue ou non, un partage demandé avant tout fichier), avec l'accord de la personne.
    **L'arrivée automatique** (09/11) : la boucle qui reçoit (celle du moteur, qui tourne tant que la page est ouverte, `js/sharing/sync-service.js`) dit à GFS quand un passage a changé quelque chose (`whenReceived`) ; si l'explorateur est ouvert, la liste des arrivées, le nombre du volet et la cloche se relisent seuls (`Explorer.setReceived`, rien d'autre ne bouge ; la ligne choisie reste choisie). Explorateur fermé : rien ne se relit, l'ouverture relit tout.
    **Les dossiers reçus** (11/11, choix du porteur : « le dossier, à accepter d'un coup »). Le nom du dossier voyage avec chaque fichier dans **une colonne de plus** de `GFS_Fichiers`, `Dossier_partage` (`SHARED_FOLDER_COLUMN`, `js/files/gfs-files.js` : ce n'est pas une colonne de base, un document qui ne partage aucun dossier ne l'a pas) ; la table reçue l'a avec les valeurs, même ajoutée **après** le premier partage, sans que rien soit renvoyé de zéro, et ses changements suivent (99). « Partagés avec moi » regroupe les arrivées de même nom **dans la même table reçue** (`js/sharing/received-folders.js`, `receivedFolders` : deux documents qui envoient chacun un dossier « Contrats » sont deux dossiers) : les dossiers en tête (lignes de dossier, clé `grp:<table>:<nom>`, jamais `dir:` — un dossier reçu ne se renomme, ne se déplace ni ne se supprime, le clavier non plus), puis les fichiers sans dossier (partage d'un fichier seul, fichier donné par une adresse). **Un dossier est grisé tant qu'un de ses fichiers attend** et le dit en mot (« 2 à accepter ») ; on y entre (double clic, Entrée, « Ouvrir le dossier » ; fil d'Ariane « Moi › Partagés avec moi › Contrats », Retour arrière) et une **barre** y propose « Accepter le dossier… ». La question (`ReceivedControl.askFolder`) est la même fenêtre qu'un fichier, avec le texte du dossier : **un oui ou un non pour tous les fichiers qui attendent**, écrit en **une seule action** (`answerFolder`, `BulkUpdateRecord` des marques `Accepte` / `Refuse` ; les deux colonnes sont ajoutées d'abord, jamais de `AddTable`) ; Échap n'écrit rien ; un fichier déjà répondu seul n'est pas retouché ; un fichier **ajouté plus tard au dossier arrive seul, grisé**, les autres gardent leur état ; un fichier refusé seul n'est plus montré, donc ni compté ni accepté avec le dossier, et un dossier dont tous les fichiers sont refusés disparaît. La cloche a **une ligne par dossier** (« Dossier « Contrats » de X : 3 fichiers à accepter ») qui pose la question du dossier. La recherche et le filtre de type remettent tous les fichiers reçus à plat.
    **L'envoi d'un dossier** (11/11, même choix : « un seul lien par document »). « Partager… » sur un dossier de « Moi » est libre (`ShareControl.whyNotFolder` ne grise plus que la racine, « Espaces » et un espace entier ; `folderFile(path)` rend `{ key, name, path, mine: true }` pour « Moi », avec `shared` pour un dossier d'espace ; `load()` rend `mine: true` sans lire les partages) : la fenêtre s'ouvre sur **« Dans un autre document Grist »** (`startTab`), l'onglet « Dans ce document » dit que « Moi » n'a pas de droits à donner (`share.folder.mine`). Le **niveau du dossier est celui de TOUS ses fichiers** (`levelOf(link, ids)` : « Copie à jour » quand tous sont dans la condition du lien, « Une partie du dossier » quand certains seulement, « Pas partagé » sinon) ; un fichier du dossier se partage aussi seul. Ce qui part : **les PDF de GFS rangés dans ce dossier même** (`filesOfFolder` : ni à la corbeille, ni reçus, ni donnés par une adresse ; ni sous-dossiers, ni fichiers d'une app, dits en une ligne : « 2 fichiers d'apps ne partent pas ») ; un dossier sans PDF est grisé avec sa raison. Le geste (`share-other.js`, `buildTab`) : **la colonne `Dossier_partage` est ajoutée au besoin (une seule action, jamais avant que le fichier existe) et reçoit le dernier mot du chemin du dossier sur les lignes du dossier, AVANT la condition** (le moteur ne compose ses colonnes que d'après la table au moment de l'enregistrement : `SENT_COLUMNS` nomme la colonne d'avance) ; puis la condition du lien reçoit tous les fichiers d'un coup (`applyLevel` accepte une liste). **Le nom reste écrit** quand le dossier s'arrête (« Arrêter la copie », ou « Une copie, une fois » une fois partie) : effacé après la sortie de la condition, il partait chez l'autre avec l'archive de la copie (mesuré, 100) ; la copie garde son dossier chez l'autre, et un fichier qui repart seul plus tard garde le nom de son dernier dossier partagé (le prix de « un seul nom par fichier »). « Relier un nouveau document… » depuis un dossier relie seulement (aucun fichier n'est envoyé : le niveau se choisit ensuite). Un fichier rangé dans un dossier se partageait mal (`whyNot` le prenait pour un dossier) : réglé. Faits vérifiés, 100.
    **Le suivi « à jour »** (11/11). « Copie à jour » sur un dossier **retient qu'il est suivi** : une ligne de `GFS_Rangement` par (personne, lien, dossier) — `App` = `gfs-suivi` (`FOLLOW_APP`), `Fichier` = l'export du lien, `Dossier` = le chemin, `Valeur` = la liste JSON des fichiers du dossier au dernier passage (`Rangement.followed / follow / unfollow` ; sans la table du rangement, rien ne s'écrit et rien ne se demande : la fenêtre dit que le dossier n'est pas suivi, `so.follow.off`). À chaque lecture des fichiers (`onLoaded` du contrôleur), tant que la page est ouverte, que la personne est propriétaire et que le document a un dossier suivi, `createFollower` (`js/share-follow.js`) compare le dossier d'aujourd'hui à celui du dernier passage (`planFollow`) : **un PDF nouveau dans le dossier** (ajouté, déplacé dedans, restauré) **entre dans la condition** avec le nom du dossier (écrit d'abord) et arrive chez l'autre grisé, seul, « à accepter » ; **un PDF qui n'y est plus** (déplacé, à la corbeille) **sort de la condition** (sa copie reste chez l'autre, en archive) ; **un PDF retiré à part n'est pas rajouté** (seuls les fichiers nouveaux entrent) ; **un dossier sans fichier** (vidé, ou renommé : ses fichiers ont un autre chemin) **ne change rien** : le suivi attend, il ne suit pas un renommage. « Arrêter la copie » et « Une copie, une fois » ne suivent plus ; un lien arrêté ne suit plus rien (ses lignes sont oubliées au passage suivant). Un seul passage à la fois, jamais d'erreur vers la page (un avertissement). Faits vérifiés, 100.
    **Ce que l'envoyeur ne peut pas écrire chez l'autre** (audit « contournement » du 11/11, faits vérifiés 101). Les marques `Accepte` et `Refuse` sont à la personne qui reçoit : le moteur remplit pourtant la table reçue avec les colonnes que l'envoyeur déclare, et recopie une colonne envoyée dans la colonne de même nom d'ici, si bien qu'un envoyeur qui rangeait une colonne `Accepte` vraie dans son export faisait arriver ses fichiers **déjà acceptés** (mesuré). Deux gestes ferment le trou (`js/sharing/received-marks.js`) : à la réception, une colonne envoyée qui porte le nom d'une marque (casse ignorée) arrive sous un autre nom (`Accepte_envoye`, correspondance passée au moteur) ; les deux colonnes Bool de marque sont créées **dès la réception** (`ensureMarks`, additif, jamais une table), et à l'ouverture de la page par un propriétaire pour les réceptions d'avant. Le type et le nom d'un fichier reçu sont des données de l'envoyeur : un fichier reçu non encore connu de GFS ne choisit jamais l'app qui l'ouvre (`readerOf`), et son nom de téléchargement est nettoyé (`receivedName`). La colonne `Dossier_partage` n'est plus envoyée qu'avec un lien qui reçoit un dossier (un lien de fichier seul ne dit rien des dossiers de l'envoyeur ; `carriesFolder`).
    **Pas encore** : le suivi d'un dossier renommé ou déplacé (le chemin retenu ne suit pas), un dossier d'espace sans table du rangement, les sous-dossiers, un partage demandé avant tout fichier (la cloche le dira quand `GFS_Notifications` existera). [M] 24 vérifications dans un vrai Grist pour l'envoi (faits vérifiés, 68), 10 pour le retrait d'un fichier et la condition jamais vide, et la vie d'un lien dans
    les fenêtres de GFS (70), 19 pour la réception de bout en bout (71), la liste « Partagés avec moi » et sa cloche dans un vrai Grist (`labo/run-partages-recus.mjs`, 75), la colonne du dossier (`labo/run-dossier-colonne.mjs`), les dossiers reçus (`labo/run-dossiers-recus.mjs`, 99) et l'envoi d'un dossier de bout en bout (`labo/run-partager-dossier.mjs`, 100), 0 écart sous Firefox (`test/partager-autre-firefox.mjs`, `test/partager-recevoir-firefox.mjs`, `test/partages-recus-firefox.mjs`, `test/partager-firefox.mjs`), essais sans Grist du parcours, des liens et de la reprise.

### 6.7 `GFS_Corbeille`, la corbeille des fichiers des apps

La corbeille des fichiers que GFS ne garde pas lui-même : ceux des tables d'apps dont le manifeste déclare une recette `suppression` (2.4).
Une app n'ajoute aucune colonne à ses tables pour cela, et n'écrit jamais cette table. Créée avec l'accord de la personne, au premier fichier
d'app mis à la corbeille (6.2), jamais avant.

| Colonne | Type Grist | Contenu |
|---|---|---|
| `Identifiant` | Text | Le nom de l'entrée : douze signes hexadécimaux tirés au hasard |
| `App` | Text | L'identifiant de l'app (`publipostage`) |
| `Table` | Text | La table de l'app d'où la ligne vient (`fichiers[].table`) |
| `FichierId` | Text | L'identifiant du fichier tel que l'app le désigne (`colonnes.id`, pris comme texte : le numéro de ligne) |
| `Nom`, `Type`, `Date`, `Auteur` | Text, Text, DateTime:UTC, Text | Ce que l'explorateur montre, tel que c'était (`colonnes.nom`, `type`, `date`, `par`) |
| `SupprimeLe` | DateTime:UTC | Le moment où la personne a mis le fichier à la corbeille, en secondes |
| `SupprimePar` | Text | L'adresse de la personne (vide tant que GFS ne la connaît pas, 6.4) |
| `Instantane` | Text | La ligne de l'app en JSON : `{ format: 1, id, valeurs }` |

1. [T] **Mettre à la corbeille** relit la ligne (c'est elle qui compte, pas la liste que la personne avait sous les yeux), la copie dans
   `GFS_Corbeille` et la retire de la table de l'app en **un seul `applyUserActions`** : `AddRecord` puis `RemoveRecord`. Grist applique
   le lot en entier ou pas du tout (mesuré : un lot dont une action échoue est défait en entier) : un fichier n'est jamais à la fois dans
   l'app et à la corbeille, ni perdu. Si la table n'existe pas, la personne est d'abord interrogée (une fenêtre du widget qui dit ce que
   GFS y garde) ; un refus ne supprime rien, et la phrase le dit. La ligne est relue **après** la réponse : la personne a pu être longue, et
   une autre a pu modifier ou supprimer la ligne (la copie garde l'état d'après, jamais celui d'avant). Un document en lecture seule, ou
   sans l'accès complet (les tables internes de Grist ne se lisent pas sans lui), est refusé avec sa raison avant toute question.
2. [T] **L'instantané** ne garde que les colonnes de **données** : celles que `_grist_Tables_column` ne donne pas pour des formules,
   hors `manualSort` et les colonnes `gristHelper_…` de Grist (Grist refuse d'écrire une formule). Une ligne dont une colonne
   `Attachments` n'est pas vide **n'est pas mise à la corbeille** : la copie en JSON ne citerait plus la pièce jointe, et Grist
   l'effacerait au bout de sept jours (faits vérifiés, 14) ; la phrase le dit (`trash.attachments`). Les lignes que le manifeste exclut
   (`exclure`) ne sont pas des fichiers : jamais copiées.
3. [T] **Restaurer** remet la ligne (`AddRecord`) **au même numéro** quand il est libre — les commentaires, le rangement et les choix
   d'export d'une app le désignent —, sinon sous un numéro neuf ; l'entrée part dans le même lot. Mesuré : Grist **refuse** un
   `AddRecord` à un numéro déjà pris (`AssertionError … existing record`), rien n'est écrasé. Le nom pris par un autre fichier pendant
   ce temps donne le premier nom libre (« Nom (1) ») sans traiter un point comme une extension, et la phrase le dit. Une colonne
   `uniques` (un jeton) déjà portée par une ligne de la table dit que l'app a déjà remis le fichier : rien n'est écrit, l'entrée part.
   Une colonne `exclusives` (le modèle par défaut) n'est pas reprise si une autre ligne l'a. L'entrée visée est celle dont le numéro,
   l'app, le fichier **et la date du geste** sont ceux que la personne avait sous les yeux : un fichier remis puis re-supprimé entre-temps
   n'est pas touché.
4. [T] **Supprimer pour de bon** et **Vider la corbeille** retirent l'entrée (`RemoveRecord`), jamais une ligne de l'app, et seulement
   celles que la personne a sous les yeux (6.6, point 10). Les écritures de GFS se font l'une après l'autre : deux gestes à la fois sur
   le même fichier s'enchaînent, le second voit qu'il n'est plus là.
5. [T] **La lecture** : l'explorateur lit `GFS_Corbeille` une fois par relecture (`js/explorer/explorer-data.js`) et range chaque entrée avec le
   dossier et le favori que le rangement avait gardés (le rangement n'a pas bougé : celui de l'app par numéro de fichier, celui de GFS
   par « app:fichier »). Une table illisible ne cache aucun fichier vivant, et la console le dit.
6. [M] **Ce que la corbeille d'une ligne ne suit pas** : tout ce qui n'est pas dans la ligne. Publipostage+ range l'historique des
   versions d'un modèle dans `Publipostage_Versions`, par `Jeton` : une version dont le modèle est absent est purgée comme orpheline à la
   prochaine ouverture d'un historique (après une grâce pour les récentes) ; un modèle restauré après cela a perdu son historique. La suite
   possible est une clé `liees` de la recette `suppression` (les lignes d'une autre table qui suivent le fichier par une colonne) ; elle n'est pas décidée. Le poids, lui, les compte déjà avec le modèle (`poids.liees`, 2.4) mais ne les suit pas dans la corbeille : l'entrée pèse sa ligne de `GFS_Corbeille` seule, et le modèle restauré retrouve ses versions tant que l'app ne les a pas purgées (faits vérifiés, 41).
   Un fichier composite (Form+ : la ligne, la section de formulaire, les colonnes et la table du formulaire, le lien public) déclare
   `appel: true` (2.4, point 4) : l'app ouverte ferme le lien avant que la ligne parte (5.4, point 10) ; **restaurer**, **supprimer pour de bon** et
   **vider la corbeille** ne l'appellent pas (le lien est fermé depuis la mise à la corbeille ; ce que l'app garde ailleurs reste à la personne).
7. [M] **Mesuré le 04/11** dans un vrai serveur Grist 1.7.19 avec les modèles et la vraie Publipostage+, à 700 × 400, souris et clavier réels
   (`prototype/labo/run-corbeille-apps.mjs`, 40 vérifications dans chacune des quatre passes, aucune en échec) : voir faits vérifiés, 26.

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
5. [T] Le courtier écrit les clés de l'app **dans la vue**, en une seule écriture de la section (7.3, point 4), jamais par le
   `setOptions` de Grist, qui remplacerait tout l'objet. Quand il ne peut pas (7.3, point 6), il se replie sur le `setOption` de
   Grist, clé par clé : un brouillon, comme avant.
6. [T] Les appels de l'app et ceux de GFS passent par la même connexion à Grist, et les écritures d'une même GFS s'enchaînent dans
   une file : aucune écriture ne s'en perd. Deux GFS d'un même document écrivent chacune dans sa vue ; une écriture relit le texte
   de la section juste avant de le réécrire (7.3, point 8 pour ce que cela ne couvre pas).

### 7.3 Brouillon, « Enregistrer », écriture dans la vue et installation

1. [T] **Le brouillon de Grist.** Un réglage qu'un widget écrit avec le `setOption` de Grist n'est qu'un **brouillon** tant que la
   personne n'a pas cliqué « Enregistrer » dans Grist ; Grist ne prévient pas le widget de cet enregistrement (mesuré le 09/10).
   D'où le rappel « Enregistrer » du kit : c'est le cas d'une app **seule** (point 9) et, dans GFS, du repli du point 6.
2. [T] Un widget n'écrit jamais un réglage sans geste de la personne : en brouillon, Grist afficherait « Enregistrer » pour rien ;
   écrit dans la vue (point 4), le réglage changerait le document sans qu'elle l'ait voulu. Cela vaut pour GFS et ses clés `gfs.`.
3. [T] **Installer ne télécharge rien** : le code de toutes les apps livrées est déjà dans le site de GFS (sous-modules). Installer
   une app, c'est inscrire son `id` dans la liste du document (7.4) ; activer une extension, l'inscrire à la ligne de l'app ;
   désinstaller, retirer l'inscription. Désinstaller ne supprime aucune donnée (cahier 3.1, point 1) : réinstaller retrouve
   tout. **Le mode d'une bibliothèque** (11/11 ; CDN par défaut, ou copie figée de GFS) se choisit dans la même fenêtre : pour une extension
   qui en a, et, pour une app dont le manifeste déclare `natives` (2.2), **fonction par fonction** (Export PDF, Export Word…), avec un raccourci
   « toutes » qui dit « mélange » quand les fonctions diffèrent. La ligne s'ouvre repliée (le choix de toutes), le détail se déplie à la souris
   et reste déplié après un choix ; la copie figée d'une fonction à qui il manque une bibliothèque du catalogue (ou sa version) est **grisée avec
   sa raison**, jamais cachée (2.6, point 14) ; en lecture seule, tout est grisé. Les mots sont les mêmes partout : « CDN » et « Copie figée ». La ligne de l'éditeur (copie dans l'app, 2.6 point 14) n'est jamais grisée pour une copie manquante et dit que son choix prend effet au prochain démarrage de l'app.
4. [T] **GFS écrit les réglages des apps dans la vue, sans « Enregistrer »** (décision du porteur, 03/11, « GFS l'écrit dans la
   vue » ; construit le même jour, `js/broker/view-options.js`). Quand une app écrit un réglage de sa tranche (`setOption`, `setOptions`,
   `clearOptions`, 7.2), le courtier :
   - **écrit la section.** Il met à jour le texte JSON de la colonne `options` de la section de GFS (`_grist_Views_section`,
     `UpdateRecord`) : seules les clés de `customView.widgetOptions` changent ; l'adresse, l'accès et le reste sont relus juste avant
     et gardés tels quels, et un objet vide redevient `null`, sa forme d'origine. C'est GFS qui écrit, jamais l'app : la colonne
     `options` reste interdite aux apps (3.3), et l'app n'écrit que les clés que son manifeste déclare (7.2). Une écriture qui ne
     change rien n'écrit rien ;
   - **n'affiche rien.** Aucune barre « Enregistrer / Retour », le cadre n'est pas reconstruit, et Grist redit les réglages au widget
     (`onOptions`, 4.3) : l'app les relit comme avant ;
   - **retrouve sa section.** Un widget ne sait ni sa page ni sa section (5.2 ; faits vérifiés, 18). GFS cherche les sections de même
     adresse (origine et chemin, sans la requête, sans `index.html` ni barre finale) et de même table que la sienne ; ses
     **candidates** sont celles dont les réglages enregistrés disent ce que Grist lui dit (`getOptions`, hors marques de recherche).
     Une seule : c'est la sienne. Plusieurs (deux GFS sur la même table dont les vues disent la même chose, par exemple sans
     aucun réglage) : une **marque** aléatoire
     est posée dans chaque candidate, en une seule écriture (clé `gfs.sonde`), et le cadre reconnaît la sienne en relisant ses
     réglages ; une marque d'un autre le fait recommencer après une attente aléatoire, jamais prendre la section d'un autre ; sans
     marque au bout de 1,5 s il renonce ; les marques sont toujours retirées, en relisant les textes avant, sans rien écraser. La
     réponse est gardée pour la vie du cadre. Les marques et les clés de GFS ne sont pas transmises aux apps (4.2, point 3) ;
   - **vérifie.** GFS attend que Grist redise les réglages écrits (3 secondes au plus). Sans cet écho il défait son écriture
     (seulement si le texte est toujours celui qu'il a écrit), écarte cette section et se replie (point 6).
5. [T] **L'app en est prévenue.** Après chaque écriture de ses réglages, GFS lui envoie l'événement `reglages` `{ enregistres }`
   (5.1) : vrai si le réglage est dans la vue, faux s'il est resté un brouillon. Une app qui rappelle « Enregistrer » à la personne
   (Publipostage+) tait son rappel quand `enregistres` est vrai ; une app qui ignore l'événement, ou qui est seule, n'a rien à changer.
   **Et d'avance** (décision du porteur, 10/11, « GFS le dit dès l'ouverture ») : une app qui ne sait rien avant son premier réglage montrait,
   dans GFS, son rappel un instant à chaque premier réglage, et deux phrases qui demandent d'enregistrer la vue tant qu'aucun réglage n'avait
   été écrit. À chaque demande de `contexte` d'une app qui déclare des clés `reglages` (pas en lecture seule), GFS **lit sa section, sans rien
   écrire** (les mêmes sections candidates que pour écrire, point 4) et envoie `reglages` : **vrai** quand une seule section dit ce que Grist
   dit à GFS (ou que la recherche a déjà reconnu la sienne) ; **faux** quand il sait déjà qu'il se repliera (accès pas `full`, aucune section,
   brouillon déjà posé : la raison est dite en console, comme à l'écriture) ; **rien** quand il ne sait pas (plusieurs sections pareilles :
   seule une marque le dirait, et une marque s'écrit). Les droits de structure ne se lisent pas : une annonce vraie se corrige par la première
   écriture que Grist refuse (`enregistres: false`). Une écriture qui part avant la réponse de la lecture la dépasse : l'annonce n'est alors
   pas envoyée. Aucune consigne aux apps : celles qui écoutent `reglages` (Publipostage+) le reprennent comme un événement de plus.
6. [T] **Le repli sur le brouillon.** GFS écrit alors un brouillon, clé par clé (point 1, comme avant), dit `enregistres: false`, et
   avertit une fois par raison dans la console, quand : l'accès de GFS n'est pas `full` ; aucune
   section n'est retrouvée (aucune candidate, ou recherche sans réponse) ; le texte de la section est illisible ; **un brouillon est
   déjà posé dans la section** (écrire dans la vue le cacherait, Grist rendant le brouillon avant le réglage enregistré : GFS le
   rejoint plutôt que de le masquer, et « Enregistrer » ou « Retour » le libère) ; Grist refuse l'écriture (une règle d'accès
   réserve la structure du document) ; l'écho manque. **En lecture seule**, le courtier refuse l'écriture (`GFS_LECTURE_SEULE`) avant tout : ni vue
   ni brouillon, et aucun événement `reglages` (une app qui montre un rappel à l'écriture le garde alors, sans rien d'enregistré).
7. [M] **Mesuré le 03/11** dans un vrai Grist (grist-static 0.1.6, Chromium, 700 × 400, souris et clavier réels) avec Publipostage+ :
   le geste « Utiliser le modèle ouvert pour cette vue » et « Retirer » ne montrent aucune barre ; l'arrivée rouvre la vue sur le modèle
   retenu ; deux GFS sur la même table gardent chacune son modèle, sans marque qui reste ; un brouillon déjà posé reste un brouillon
   et se libère par « Retour » (faits vérifiés, 18). Non mesuré : un vrai serveur et une règle d'accès qui refuse (le repli est couvert
   par les tests, contre un faux port), Firefox, ce que « Annuler » (Ctrl+Z) de Grist fait d'une écriture de la vue.
   **Mesuré le 10/11** (annonce d'ouverture, faits vérifiés 85) : avant l'annonce, la vraie Publipostage+ montrait son rappel au premier
   réglage et les deux phrases demandaient d'enregistrer ; avec elle, `GfsLink.settingsSaved()` est vrai dès l'ouverture, les deux phrases
   n'y demandent rien et le rappel ne paraît à aucun moment.
8. [T] **Ce que cela ne garantit pas.** Une écriture réécrit tout le texte de la section (accès et adresse compris) : un autre
   changement de la même section dans les quelques millisecondes qui suivent la relecture serait perdu. Elle demande le droit de
   modifier la structure du document, sinon c'est le repli du point 6. Et elle ne règle rien pour une app **seule** (point 9).
9. [D] **L'app seule** écrit toujours un brouillon, avec le rappel « Enregistrer » (point 1) : le même geste côté kit (retrouver sa
   section, écrire) viendra plus tard, sur le go du porteur.

### 7.4 Question 9, tranchée le 16/10 : les apps installées se retiennent dans une table du document

Le conseil du cahier était les réglages de la section, avec le rappel « Enregistrer ». Le porteur a choisi une table pour tout
le document, pour que l'installation s'enregistre tout de suite.

1. [T] **Où.** Une ligne réservée de `GFS_Rangement` (6.4) : `Utilisateur` = `@document`, `App` = `gfs`, `Fichier` = `apps`,
   et dans `Valeur` un texte JSON `{ "<id>": { "extensions": [ "…" ], "modes": { "<extension>": "cdn" | "vendorise", "natif:<fonction>": "vendorise" } } }`
   (`modes` est facultatif, le défaut est le CDN : question 11 ; la clé `natif:<fonction>` est celle d'une fonction de bibliothèques natives de l'app,
   2.6 point 14 : elle n'existe que pour la copie figée, le CDN n'est jamais écrit ; une clé que cette version de GFS ne connaît pas est gardée). La ligne n'existe qu'après la première installation.
2. [T] **Immédiat.** Installer, désinstaller, activer une extension, choisir son mode : l'écriture de la ligne suffit, sans
   « Enregistrer ». Le rappel ne vaut plus que pour les réglages d'une app **seule**, ou quand GFS se replie sur le brouillon (7.3,
   points 6 et 9), pas pour ceux de GFS.
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
7. [T] **L'aller-retour** (cahier 6.2, point 2) : une section sans app de départ, mais dont les réglages portent des clés
   qu'un manifeste déclare, ouvre cette app sans rien écrire, que la table existe ou non. **Construit le 22/10** (`js/broker/arrival.js`),
   sur le choix du porteur, « comme avant GFS » : le modèle de la vue de Publipostage+ (un document, une grille ou une
   présentation) s'ouvre à l'arrivée, comme dans l'app seule. La règle :
   - une clé compte quand elle a une valeur : `null` et le texte vide, par lesquels une app retire un choix (Publipostage+,
     « Retirer » du modèle de la vue : `setWidgetOption(clé, null)`), ne comptent pas ; `0`, `false` et un objet comptent ; **un objet
     qui dit `enabled: false` ne compte pas** (un choix coupé mais gardé : le « modèle selon la ligne » décoché de Publipostage+ garde
     ses règles pour qu'on les retrouve) ; **seules les clés `reglagesArrivee` du manifeste comptent** quand il les déclare (2.5, point 5 ;
     sinon toutes ses clés de `reglages`) : pour Publipostage+, le modèle de la vue et le modèle selon la ligne, pas les droits
     d'accès, la date du dernier export ni les pièces jointes (complété le 12/11, voir plus bas) ;
   - ne comptent que les apps qu'on peut ouvrir ici : installées (rien ne s'installe à l'arrivée) et dont l'accès demandé ne
     dépasse pas celui que Grist a donné à GFS ;
   - une seule app servie par la section : elle s'ouvre **sans consigne** (`ouverture` à `null`, 5.2, point 3 : elle applique
     son propre ordre d'arrivée, pour Publipostage+ la ligne, le modèle de la vue, puis le ★) ; aucune, ou deux (la section a servi
     plusieurs apps tour à tour) : l'explorateur, GFS ne devine pas ;
   - rien n'est écrit : ni réglage, ni table, ni page, ni clé `gfs.` ;
   - la fenêtre « Apps et extensions » du premier lancement ne s'ouvre pas par-dessus une app qui s'ouvre toute seule ; sans app,
     elle s'ouvre comme avant.

   Pas fait : « une seule app installée : elle s'ouvre » (cahier 6.2, point 3) ; sans clé d'une app, l'explorateur, le plus prudent.
   [M] **Mesuré le 22/10** (labo grist-static 0.1.6, Chromium, panneau 700 × 400, à la vraie souris et au vrai clavier ;
   `run-arrivee.mjs`, avec les vraies apps : Publipostage+ à `2d9d4ed`, Automation+ à `f3ab8d6`) : 25 vérifications sur 25 en
   français / clair et en anglais / sombre, 20 sur 20 en lecture seule. Sans réglage, avec `null`, avec un texte vide, avec des
   clés de GFS ou inconnues seules : l'explorateur, comme avant. Le modèle de la vue, un document ou une grille : Publipostage+
   s'ouvre dessus ; une présentation avec l'extension « Diapositives » cochée : la présentation, éteinte : le ★, comme dans
   l'app seule, et la vue garde son choix ; un modèle disparu : le ★ ; une autre clé de l'app (`dateDernierExport`) sans modèle :
   le ★. Rien n'est écrit : les modèles, les réglages enregistrés, les tables, les pages, la table du rangement et les réglages de
   la section sont les mêmes avant et après ; GFS ne dit rien. La fenêtre du premier lancement ne vient pas par-dessus l'app, et
   vient comme avant sans app. « Fichiers » (la barre) ouvre l'explorateur, Échap ramène au même modèle, dans le même cadre.
   Automation+ : le graphe dans la vue et l'app non installée, l'explorateur ; installée, elle s'ouvre ; servies toutes deux avec
   Publipostage+ : l'explorateur. Aucun avertissement du courtier, aucune erreur de script, aucun refus de la politique de
   sécurité (hors le style en ligne que le script d'API de Grist pose chez GFS, accepté : rapport du prototype). En lecture seule,
   l'app s'ouvre aussi ; ses écritures de migration sont refusées par le courtier (`GFS_LECTURE_SEULE`), l'arrivée n'en fait
   aucune. L'essai échoue sur l'ancien contrôleur : l'explorateur s'ouvre, avec la fenêtre du premier lancement.

   **Complété le 04/11 : une app qui garde sa vue dans une table** (choix du porteur, « GFS lit sa table » ; `arrivee` du manifeste,
   2.5, point 4 ; `js/broker/arrival.js`, `js/broker/arrival-table.js`). Automation+ 0.15.0 range son graphe dans la ligne `Workflow` de sa table
   `Automation` et n'écrit plus la clé `workflow` (ses réglages de vue ne servent plus qu'à défaut de table). La règle :
   - **un réglage de la section parle avant la table** : si une app qu'on peut ouvrir ici est servie par un réglage (la règle
     ci-dessus), la table n'est pas lue ; la vue d'un modèle de Publipostage+ reste à Publipostage+, même sur la table de Grist
     dont Automation+ a un graphe ;
   - sans réglage qui désigne une app, GFS lit la table que déclare `arrivee`, pour chaque app qu'on peut ouvrir et qui la
     déclare, par sa propre connexion à Grist (`listTables`, puis `fetchTable` de cette seule table) ; une table absente, vide ou
     illisible ne dit rien (un avertissement pour l'illisible) ; GFS ne crée jamais la table pour la chercher ;
   - la section est celle de l'app quand une ligne porte, dans `colonne`, l'identifiant de la table de la section (comparé sans la
     casse) et, dans chaque colonne de `lignes`, la valeur exacte demandée (`Type` = `Workflow` : une ligne `Log` ou `Lock` ne
     désigne rien) ; une seule app reconnue s'ouvre, sans consigne ; deux, GFS ne devine pas : l'explorateur ;
   - la table de la section est celle du dernier message de table de Grist (`GristState.whenTable`, 1,5 s au plus ; une section sans
     table n'a pas de message : l'explorateur) ; rien n'est écrit ; une valeur lue n'est comparée qu'à un texte, jamais lue comme
     du code ni comme une adresse.
   [M] **Mesuré le 04/11** (labo grist-static 0.1.6, Chromium, 700 × 400, à la vraie souris ; `run-arrivee.mjs`, partie 6, avec la
   vraie Automation+ 0.15.0 à `597fe02` et la vraie Publipostage+ à `6a22dee` ; français / clair et anglais / sombre, 36 vérifications
   sur 36 chacune) : sans la table, l'explorateur et aucune table créée ; l'app, à la souris, demande l'accord, crée `Automation` et
   range le graphe dans une ligne `Workflow` (`Table` = `Clients`) **sans écrire la clé `workflow`** (les réglages de la section
   restent vides) ; le cadre de GFS rechargé s'ouvre sur Automation+ (explorateur fermé, barre là) ; l'arrivée n'écrit ni table, ni
   réglage de la vue, ni rangement (le moteur ne reçoit que la ligne-sonde d'identité de GFS, 6.4 point 6, comme à chaque
   démarrage) ; le modèle de la vue de Publipostage+ ajouté, c'est Publipostage+ qui s'ouvre ; la ligne passée à une autre table, ou
   à `Log` : l'explorateur ; rétablie : Automation+. Coût : GFS se déclare prêt 229 à 310 ms après le chargement de son cadre, avec
   ou sans la lecture de la table (la table n'a qu'une ligne : le journal n'est pas élagué par l'app, la lecture grandira avec lui,
   11 à 14 ms pour 1 000 lignes mesurés le 21/10). Pas mesuré : Firefox (aucune interface de plus ; la comparaison est la même),
   une table `Automation` de plusieurs milliers de lignes.

   **Complété le 12/11 : seulement un modèle choisi** (choix du porteur, « Seulement si un modèle est choisi » ; `reglagesArrivee` du
   manifeste, 2.5, point 5). Une vue dont le seul réglage de Publipostage+ était sa date du dernier export, ses droits d'accès ou ses
   pièces jointes arrivait sur la page blanche de l'app (sans modèle ni ★) : rien ne disait quoi ouvrir. Désormais seuls
   `modeleDeLaVue` et `modeleSelonLigne` désignent Publipostage+ ; un objet qui dit `enabled: false` (le modèle selon la ligne décoché, ses
   règles gardées) ne compte pas. Conséquence pour la table : sans modèle, la table d'Automation+ est lue (un réglage de droits ou de date
   ne parle plus avant elle). Rien n'est écrit, rien ne change pour une app qui ne déclare pas `reglagesArrivee` (Automation+ : `workflow`).
   [M] **Mesuré le 12/11** (`run-arrivee.mjs`, labo grist-static 0.1.6, Chromium, 700 × 400 à la vraie souris, vraie Publipostage+ à `de63f27`
   et vraie Automation+ à `aaad9bf` ; **français / clair et anglais / sombre : 41 vérifications sur 42 chacune**, la 42e est un avertissement
   de GFS (« un brouillon est déjà posé ») que le labo produit aussi sur le code d'avant : voir faits vérifiés, 103) : la date du dernier
   export seule, les droits d'accès et les pièces jointes seuls, puis le modèle selon la ligne décoché : l'explorateur, sans app ni barre ;
   le modèle selon la ligne coché : Publipostage+ s'ouvre, sur son ordre habituel (le ★) ; le modèle de la vue avec les droits et la date :
   Publipostage+ s'ouvre sur le modèle ; le graphe d'Automation+ avec seulement la date et les droits de Publipostage+ : Automation+ s'ouvre
   (une seule app servie) ; la date et les droits ne parlent pas avant la table : Automation+ s'ouvre par sa ligne `Workflow`. **Sur l'ancien code,
   cinq de ces vérifications échouent** (la vue s'ouvre sur Publipostage+, ou l'explorateur quand Automation+ était aussi servie).
8. [D] **L'app de départ** (`gfs.depart`) reste un réglage de la section, écrit seulement sur un geste de la personne ; personne
   ne l'écrit encore. Quand GFS l'écrira, ce sera comme les réglages des apps (7.3, point 4), sans « Enregistrer ».
9. [D] **L'ancienne clé `gfs.apps`** du prototype V0.2 n'est plus ni lue ni écrite ; une section qui la porte n'est pas modifiée.
10. [T] **Mesuré le 16/10** dans un vrai Grist (labo grist-static 0.1.6, Chromium, panneau 700 × 400, V0.3 du prototype ;
    `run-modules.mjs` et `run-reconstruit.mjs`). Lire ne crée rien : sans geste, ni table ni page de plus. Le premier geste
    d'installation pose la question (le nom de la table, qu'elle vaut pour tout le document, qu'une page s'ajoute) ; Échap
    ou « Annuler » la refusent (un clic hors de la fenêtre ne la ferme pas) : la case revient, aucune table ni page n'est créée, la personne en est
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

Depuis le 22/10, chaque app déclare aussi la classe de ses tables (`classes`, 11.2) et suit 11.6, au lot de l'étape 5 et après
les mesures de 11.8 ; la ligne de chaque app est en 11.6, point 8.

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

- **Étape 3 (kit)** : où vit la table-sonde de l'identité quand le kit la partage (dans GFS, l'adresse vient de GFS : 5.2, point 9 ;
  reste l'app seule) ; liste des icônes (`icone`) ; le texte commun
  du grisé et la fenêtre d'installation.
- **Étape 5 (apps)** : où vivent les instantanés `pp_schema_…` (le quota de 1 Mo de 5.3 est fixé) ; le contenu de chaque `gfs.json` ; la sortie de `_grist_*` pour
  Form+ ; les classes de tables et les colonnes de l'étiquette (11.2, 11.6), après les mesures de 11.8.
- **Étape 6 (GFS v0)** : le rangement propre à une app dans l'explorateur ; « Fermer quand même » ; « Recharger » ; la
  fenêtre d'installation qui montre `pourquoi` (celui d'`identite` compris, 3.4, point 6) ; le panneau « Permissions » en lecture, le pied honnête et `contexte.role`
  (11.4, point 7 ; 5.2, point 8) : **codés et mesurés dans un vrai Grist le 04/11** (faits vérifiés, 40).
- **Étape 7 (extensions et nouvelles apps)** : poser et retirer un niveau de règles, les espaces et leurs responsables, le
  contrôle d'ensemble des règles (11.5, 11.7) ; le déroulement d'« insérer » (deux sous-cadres), la taille du rendu ; le
  mappage de colonnes pour une app qui en demanderait ; qui fait suivre un renommage de colonne aux modèles d'un type
  d'extension (le socle ne réécrit jamais un type inconnu, guide 2.2 ; relire le schéma ne montre pas le renommage, dont les
  anciens noms ne sont que dans l'instantané de l'app, `pp_schema_…`), à fixer avec la première extension de modèle.
- **Une fois GFS v0 publié** : le numéro de contrat passe à 1, et le tableau des changements du contrat s'ouvre dans ce document.

---

## 11. Les permissions des personnes (version 0 du 22/10)

Les sections 2 et 3 règlent ce qu'une **app** peut faire par le courtier. Celle-ci règle ce qu'une **personne** peut faire du
document : qui lit quoi, qui écrit quoi, qui administre un espace. Elle est écrite sur le go du porteur du 22/10, après ses
réponses du 21/10 (deux zones, un responsable d'espace). Rien n'est codé : GFS v0 (étape 6) lit les règles et les montre,
l'étape 7 les pose. L'étude, avec ses mesures, est le document « Permissions de Grist Factory : la stratégie » (fichiers du
projet) ; les preuves, avec le fichier et la ligne du code de Grist, sont dans `faits-verifies.md`, section 10.

Cette section est en **version 0** : elle ne devient définitive qu'après les dix mesures sur le Grist du porteur (11.8), qui
peuvent changer une règle de 11.4. Une carte reste ouverte, celle de la structure du document (11.7, point 1) : rien ici n'en
dépend, sauf un mot du pied de GFS. Les liens publics et les formulaires publiés, que les règles de GFS n'atteignent pas, ont
leur sous-section : 11.9.

### 11.1 Les principes

1. [T] **Deux frontières, une seule arrête une personne.** Une personne passe par les règles d'accès de Grist. Le code d'une app
   passe d'abord par le courtier (section 3), puis par les mêmes règles, avec les droits de la personne qui l'a ouverte. Seule
   la première arrête une personne, et seul Grist la tient : un verrou d'interface n'est jamais une protection (le porteur,
   21/10). Le droit réel est le plus petit des deux : un lecteur nommé responsable d'espace lit son espace et n'écrit rien (« Only
   owners or editors can modify documents », mesuré).
2. [T] **Deux zones** (le porteur, 21/10). *Les tables de données* (ce que la personne a créé ou importé, le travail courant des
   apps compris) restent à Grist : GFS n'y pose aucune règle, n'y guide rien, n'y montre rien. *Les tables de GFS et des apps*
   (rangement, contenus réservés et leurs versions, espaces, workflows, journaux) sont encadrées par des règles qu'un propriétaire
   pose, sur ces tables seulement. Une table que son app ne déclare pas (11.2) est du travail courant : zone de données.
3. [T] **Une seule source par fait.** GFS ne recopie jamais ce que Grist sait : il n'y a pas de table des personnes avec leur
   rôle. Le rôle sur le document vient de la base d'accueil de Grist ; les règles, de `_grist_ACLRules` et `_grist_ACLResources` ;
   l'étiquette d'un contenu, de colonnes de sa table (11.2) ; les espaces, d'une table de GFS (11.3). L'identité d'une personne
   n'est rangée nulle part : Grist la calcule à chaque demande (faits vérifiés, 10.1).
4. [T] **Trois niveaux de règles sur les tables de GFS et des apps**, qu'un propriétaire pose en un clic et retire en un clic :
   *Ouvert* (aucune règle), *Partagé* (chacun garde ses affaires : le rangement et les tables de classe `personnel`), *Encadré*
   (en plus : contenus réservés, espaces et workflows selon les rôles). Le niveau posé se lit dans les règles elles-mêmes, par
   leur note (« GFS : Encadré »), non dans une table à part : il ne peut pas se désynchroniser. **La structure fermée n'est pas
   un niveau** : c'est la case « Droits d'édition de la structure » de Grist, qui vaut pour tout le document (11.7).
5. [T] **Rien n'est posé sans le geste d'un propriétaire**, ni à l'ouverture d'un document ni par une app. GFS ne retire que ses
   propres règles, reconnues à leur note ; la règle d'un autre auteur ne part que par une case « Retirer » cochée.
6. [T] **La règle des propriétaires passe toujours en premier**, sans option : un propriétaire est soumis aux règles comme les
   autres, et sans elle il s'enferme dehors (mesuré).
7. [T] **L'adresse e-mail est la clé de toute personne**, comparée en minuscules des deux côtés (11.4, point 1). Limite : une
   personne qui change d'adresse perd ses affaires, ses contenus d'auteur et ses espaces tant qu'un propriétaire n'a pas mis les
   listes à jour.
8. [T] **Ce qu'aucune règle ne garantit.** Qui peut utiliser un contenu peut le lire, le copier et le capturer : « utiliser sans
   voir » n'existe pas dans un widget (comme 3.7 pour les apps). Un propriétaire hérité de l'espace de travail de Grist voit
   tout. Un contenu réservé n'est *secret* que si la structure est fermée ; sinon il est *discret* : une ligne cachée n'arrive pas
   chez la personne, mais un éditeur qui pose une colonne-formule la lit encore (mesuré, 10.2). Un lien public échappe à toutes les règles (11.9).

### 11.2 Les classes de tables : `classes` dans `gfs.json`

Un champ facultatif du manifeste (2.2) : en ajouter un ne change pas le numéro de contrat. Il dit à GFS de quoi est faite
chaque table de l'app, pour que les règles des personnes (11.4) la couvrent. **Il ne donne aucun droit à l'app** : ce que l'app
peut lire et écrire reste `permissions` (section 3), et le courtier ne lit pas `classes`.

| Classe | Une table qui… | Champs de l'entrée | Règles posées |
|---|---|---|---|
| `travail` | contient le travail courant de l'app (courriers produits, réponses d'un formulaire) ; **c'est la classe de toute table non déclarée** | aucun | aucune, jamais |
| `personnel` | a une ligne par personne (préférences, dossiers, favoris) | `personne` : la colonne qui porte l'adresse | Partagé |
| `reserve` | contient des contenus dont une étiquette dit qui peut les voir | `etiquette` : les colonnes `visibilite`, `personnes`, `auteur`, `espace` | Encadré |
| `derivee` | dépend d'une table `reserve` et en suit l'étiquette (versions, commentaires, écriture en direct) | `de` : la table `reserve` ; `lien` : sa colonne de référence vers elle | Encadré |
| `proprietaires` | ne s'écrit que par les propriétaires, tout le monde la lit (workflows) | `lignes` : `{ colonne, valeur }`, facultatif (sans lui, toute la table) | Encadré |

Toute entrée sauf `travail` peut porter `secrets` : la liste des colonnes qu'un non-propriétaire ne lit ni ne modifie (11.6,
point 7). Les noms de colonnes sont ceux de l'app ; leurs rôles sont ceux du contrat.

```json
{
  "classes": {
    "Publipostage_Modeles": {
      "classe": "reserve",
      "etiquette": { "visibilite": "Visibilite", "personnes": "Personnes", "auteur": "Auteur", "espace": "Espace" },
      "secrets": ["MotDePassePdf"]
    },
    "Publipostage_PreferencesModeles": { "classe": "personnel", "personne": "Utilisateur" },
    "Automation": { "classe": "proprietaires", "lignes": { "colonne": "Type", "valeur": "Workflow" } }
  }
}
```

1. [D] **Forme d'exemple, noms à fixer au lot de l'étape 5** : aucune app ne l'écrit avant les mesures de 11.8, ni n'ajoute une
   colonne avant la consigne qui la nomme (11.6, point 6).
2. [T] Une app ne classe que les tables de son préfixe (2.3) : jamais une table d'une autre app, jamais une table de la personne
   (la zone de données n'est pas à l'app).
3. [D] Les valeurs de `visibilite` : `tous`, `espace` (les membres de l'espace que dit `espace`), `nommees` (les adresses de
   `personnes`) ; toute autre valeur, vide comprise, veut dire *privé* : l'auteur, le responsable de l'espace s'il y en a un, et
   les propriétaires. Les contenus d'avant l'activation reçoivent `tous` : rien ne disparaît par surprise, le propriétaire réserve
   ensuite un contenu à la fois. (Le document de stratégie dit « propriétaires seulement » : l'auteur garde la lecture de son
   propre contenu, 11.4, règle 4.) Une ligne à `personne` vide, dans une table `personnel`, n'est lue que par les propriétaires.
4. [D] `auteur` est rempli à la création avec l'adresse de la personne, par une formule déclenchée `user.Email` ou par l'app avec
   l'adresse que la sonde de l'identité lui a donnée. La règle de création refuse tout autre auteur que la personne, sauf pour le
   responsable de l'espace, dans son espace (mesuré). La sonde d'une app (`Publipostage_UserProbe`) reste de classe `travail` :
   aucune règle ne la touche.
5. [D] `espace` porte la **clé** de l'espace (`Cle` de `GFS_Espaces`, 11.3), non son nom : renommer un espace ne réécrit alors
   aucune table d'app (6.3, point 2). **Les colonnes d'aide sont à GFS**, pas à l'app : des colonnes à formule nommées
   `GFS_Resp`, `GFS_Memb` et `GFS_PersonnesL` sur une table `reserve`, et `GFS_Visibilite`, `GFS_PersonnesL`, `GFS_Resp` et
   `GFS_Memb` sur une table `derivee` (formules en 11.4, point 4). Elles ne se créent qu'une fois `GFS_Espaces` née, et GFS les
   crée avec l'accord du propriétaire, quand il pose Encadré (11.5, point 4) ; l'exception à 6.3, point 2 est proposée, non
   tranchée (11.7, point 6).

### 11.3 Les espaces et le responsable d'espace

Le porteur veut, entre le propriétaire et l'éditeur, un statut comme celui d'animateur de Résana : une personne qui n'a pas les
grosses fonctions et administre un espace (21/10). Grist n'a que trois rôles : ce statut se construit avec des règles de lignes,
donc c'est Grist qui l'impose, jamais l'interface.

1. [T] **Un espace** est un dossier partagé de l'explorateur : une clé, un nom, un ou plusieurs responsables, des membres. Un
   contenu est dans un espace ou dans aucun ; une personne peut être dans plusieurs espaces. Les espaces remplacent les équipes
   de la première étude, dont la table devenait un privilège qu'un éditeur utilisait pour s'y ajouter (mesuré).
2. [T] **Jusqu'où va le responsable** (le porteur, 21/10 : « Membres et contenu de son espace ») :

   | Il peut… | Propriétaire | Responsable d'espace | Membre | Autre éditeur |
   |---|---|---|---|---|
   | Voir ce que l'espace réserve à ses membres | oui | oui | oui | non |
   | Créer un contenu dans l'espace | oui | oui | oui, à son nom | non |
   | Modifier ou supprimer le contenu d'un autre membre | oui | oui | non | non |
   | Ajouter ou retirer des membres de l'espace | oui | oui | non | non |
   | Sortir un contenu vers un espace qui n'est pas le sien | oui | non | non | non |
   | Créer, renommer ou supprimer un espace, nommer un responsable | oui | non | non | non |
   | Installer une app, poser ou retirer des règles, écrire un workflow, fermer la structure | oui | non | non | non |

3. [D] **`GFS_Espaces`**, une table de GFS (le préfixe `GFS_` est à lui, 2.3), créée avec l'accord d'un propriétaire (6.2),
   au plus tard quand il pose Encadré, même sans espace. Colonnes : `Cle` (texte court, jamais changé), `Nom`, `Responsables` et
   `Membres` (des listes d'adresses, tapées comme on veut), `RespL` et `MembL` (formules : les mêmes adresses, nettoyées et en
   minuscules). Une seule table pour tous les espaces, séparée du rangement (11.7, point 5).
4. [T] **Seuls les propriétaires écrivent `Responsables`** : c'est le privilège du système, une personne qui s'y ajouterait
   deviendrait responsable. Un responsable écrit `Membres` de son espace, rien d'autre.
5. [T] **Qui voit quoi est une donnée, pas une règle.** Aucune règle ne nomme une personne ou un espace : elles lisent les
   colonnes d'aide, qui suivent `GFS_Espaces`. Ajouter ou retirer un membre, nommer un responsable, changer la visibilité d'un
   contenu, le déplacer, en créer un ne recharge aucune page ; la personne concernée voit les contenus apparaître ou disparaître
   en direct (mesuré, 10.6). **`GFS_Espaces` n'est jamais déclarée « attribut de personne »** : c'est la seule façon de la
   brancher qui recharge la page de la personne dont la ligne change, et elle ne lui montre pas un nouvel accès avant son prochain
   chargement.
6. [T] Un responsable ou un membre qui n'a pas ou plus accès au document : rien, Grist l'arrête avant les règles. Un responsable
   retiré de la liste perd ses pouvoirs à son action suivante et reste membre s'il y est encore (mesuré).
7. [D] L'écran « Espaces » est dans l'explorateur de GFS (étape 7) : un propriétaire crée un espace et nomme ses responsables ;
   un responsable ajoute et retire les membres du sien. Les boutons qu'une personne ne peut pas utiliser sont grisés avec la
   raison, jamais masqués.

### 11.4 Les règles, niveau par niveau

Les règles de GFS sont celles du labo (faits vérifiés, 10.4 à 10.8). « Reste » est la règle sans condition ; Grist exige qu'elle
soit la dernière de sa ressource. Les droits s'écrivent comme Grist les range (`+CRUD`, `-R`, `-S`…). Dans les tableaux,
`<visibilite>`, `<auteur>`, `<espace>` et `<personnes>` sont les colonnes que le manifeste nomme sous `etiquette` ; les colonnes
`GFS_…` sont celles de 11.2, point 5.

1. [T] **Écrire une règle.** (a) Toute règle qui compare une adresse commence par `user.Email and …`, qui écarte une adresse
   absente. (b) L'adresse se compare en minuscules des deux côtés : `user.Email.lower()` contre une colonne d'aide en minuscules ;
   `lower()` et `upper()` sont les deux seuls appels de méthode que Grist accepte dans une condition. Pourquoi : `user.Email` est
   l'adresse affichée quand la demande vient de l'interface et l'adresse en minuscules quand elle vient de l'API, et une liste
   tapée « Editor1@Example.COM » ôte tout à son responsable (mesuré, 10.5). (c) **Une règle qui donne la lecture ne cite que
   `rec`** ; seules les règles de création, de modification et de suppression citent `newRec` (sans quoi Grist n'envoie pas à la
   personne la ligne qu'elle vient de créer : « Unexpected row removal », mesuré, 10.7). Pour une création ou une suppression,
   `rec` et `newRec` sont la même ligne, donc une règle qui ne cite que `rec` y suffit. (d) Aucune règle ne nomme une personne ou
   un espace (11.3, point 5). (e) Aucune règle sur une table de données (11.1, point 2) ; aucun « attribut de personne ».
2. [T] **Partagé** : le rangement de GFS (`GFS_Rangement`, 6.4) et toute table `personnel` (alors sans les règles 2 et 5, et avec
   la colonne `personne` à la place de `Utilisateur`).

   | # | Condition | Droits |
   |---|---|---|
   | 1 | `user.Access in [OWNER]` | `+CRUD` |
   | 2 | `rec.Utilisateur == "@document"` | `+R` |
   | 3 | `user.Email and rec.Utilisateur and rec.Utilisateur.lower() == user.Email.lower()` | `+R` |
   | 4 | `user.Email and rec.Utilisateur and rec.Utilisateur.lower() == user.Email.lower() and newRec.Utilisateur.lower() == user.Email.lower()` | `+CUD` |
   | 5 | `rec.Utilisateur == "@sonde" and user.Email and rec.Adresse and rec.Adresse.lower() == user.Email.lower()` | `+CRD` |
   | 6 | reste | `-CRUD` |

   La règle 5 est celle de **la ligne-sonde** (6.4, point 9). Sans elle, la sonde est refusée à tout éditeur : il ne connaît plus
   son adresse et n'écrit plus aucune ligne de rangement. Avec une règle plus large, l'adresse de la personne partirait en direct
   chez les autres, ou une ligne forgée au nom d'un autre serait acceptée. Avec celle-ci, l'adresse reste chez son propriétaire,
   une ligne forgée est refusée et personne ne retire la ligne d'un autre. [M] Mesuré le 22/10 (faits vérifiés, 10.8). Une
   personne dont l'adresse n'est pas résolue n'a pas de rangement sous Partagé ni Encadré (les lignes à `Utilisateur` vide
   restent, mais seuls les propriétaires les voient) : l'explorateur le dit, l'app continue sans.
3. [T] **Encadré** : tout Partagé, plus ce qui suit.

   *Une table `reserve`* :

   | # | Condition | Droits |
   |---|---|---|
   | 1 | `user.Access in [OWNER]` | `+CRUD` |
   | 2 | `user.Email and user.Email.lower() in rec.GFS_Resp` | `+R` |
   | 3 | `user.Email and user.Email.lower() in rec.GFS_Resp and user.Email.lower() in newRec.GFS_Resp` | `+CUD` |
   | 4 | `user.Email and rec.<auteur> and rec.<auteur>.lower() == user.Email.lower() and (not rec.<espace> or user.Email.lower() in rec.GFS_Memb or user.Email.lower() in rec.GFS_Resp)` | `+R` |
   | 5 | `user.Email and rec.<auteur> and rec.<auteur>.lower() == user.Email.lower() and newRec.<auteur>.lower() == user.Email.lower() and (not newRec.<espace> or user.Email.lower() in newRec.GFS_Memb or user.Email.lower() in newRec.GFS_Resp)` | `+CUD` |
   | 6 | `rec.<visibilite> == "tous"` | `+R` |
   | 7 | `user.Email and rec.<visibilite> == "espace" and user.Email.lower() in rec.GFS_Memb` | `+R` |
   | 8 | `user.Email and rec.<visibilite> == "nommees" and rec.GFS_PersonnesL and user.Email.lower() in rec.GFS_PersonnesL` | `+R` |
   | 9 | reste | `-CRUD` |

   Chaque colonne de `secrets`, sur sa propre ressource : `user.Access != OWNER` → `-RU`.

   *Une table `derivee`* : les règles 1 à 3 et 6 à 9 ci-dessus, sur ses colonnes d'aide (`GFS_Visibilite` à la place de
   `<visibilite>`, `GFS_PersonnesL`, `GFS_Resp`, `GFS_Memb`) ; les droits d'écriture propres à l'app s'ajoutent avant le reste
   (11.7, point 3).

   *Une table `proprietaires`* : `user.Access in [OWNER]` → `+CRUD`, puis `rec.Type == "Workflow" or newRec.Type == "Workflow"`
   (la condition de `lignes` ; la règle « reste » sans `lignes`) → `-CUD`. Pas de règle de fin : tous lisent, et le reste de la
   table (le journal, le verrou d'exécution) reste ouvert à tous (mesuré avec Automation+).

   *`GFS_Espaces`* : sur la colonne `Membres`, `user.Email and user.Email.lower() in rec.RespL` → `+U` ; sur la table, `user.Access
   in [OWNER]` → `+CRUD`, `user.Email and (user.Email.lower() in rec.RespL or user.Email.lower() in rec.MembL)` → `+R`, reste → `-CRUD`.
   Les règles d'une colonne passent avant celles de sa table, puis la règle par défaut du document (lu, 10.4).
4. [T] **Les colonnes d'aide** (formules mesurées). `GFS_Espaces` : `RespL` vaut `tuple(str(x).strip().lower() for x in
   ($Responsables or ()))`, et `MembL` de même pour `Membres`. Une table `reserve` : `GFS_Resp` vaut `tuple(GFS_Espaces.lookupOne(Cle=
   $<espace>).RespL or ())`, `GFS_Memb` de même avec `MembL`, `GFS_PersonnesL` vaut `tuple(str(x).strip().lower() for x in
   ($<personnes> or ()))`. Une table `derivee` : `GFS_Visibilite` vaut `$<lien>.<visibilite>` du contenu, et `GFS_PersonnesL`,
   `GFS_Resp`, `GFS_Memb` recopient ceux du contenu (`$<lien>.GFS_Resp`…). Les listes que les gens tapent restent telles quelles ;
   les règles ne comparent que ces copies. [M] **Mesuré le 22/10** avec ces noms : mêmes résultats que le jeu d'essai sans préfixe
   (faits vérifiés, 10.5), pour une table `reserve` ; la table `derivee` a été mesurée avant les espaces, avec des colonnes qui
   copient le contenu.
5. [T] **Structure fermée** (la case de Grist, pas un niveau) : une seule règle, sur la ressource « toutes les tables » (`*` / `*`, celle que l'interface de Grist écrit ; **mesuré le 06/11 sur
   Grist 1.7.19** : la ressource vide que Grist crée avec un document neuf n'est qu'un reste, une règle posée dessus ne ferme rien) :
   `user.Access != OWNER` → `-S`. Posée sur une table ou une colonne, Grist l'écarte sans erreur. Un éditeur ne peut alors plus
   ajouter ni supprimer une table, une colonne ou une page, ni changer l'adresse d'un widget, ni poser une formule, ni enregistrer
   un réglage partagé de la vue ; ses lignes restent écrivables et les responsables d'espace continuent d'administrer leur espace
   (mesuré, 10.2). GFS ne la pose pas de lui-même (11.7, point 1).
6. [T] **Ce qu'un éditeur peut**, tel que Grist l'applique (mesuré ou lu : faits vérifiés, 10.2 et 10.3) :

   | Un éditeur peut… | Ouvert | Partagé | Encadré | Encadré, structure fermée |
   |---|---|---|---|---|
   | Saisir et modifier ses données (zone de données : Grist seul) | oui | oui | oui | oui |
   | Lire ou changer le rangement d'une autre personne, changer la liste des apps | oui | non | non | non |
   | Lire un contenu que son étiquette réserve | oui | oui | non, sauf par une formule | non |
   | Changer l'adresse d'un widget, supprimer une table ou une section, enregistrer un réglage partagé de la vue | oui | oui | oui | non |
   | Ajouter une page, une table ou une colonne, poser une formule qui lit tout, faire un tableau de synthèse | oui | oui | oui | non |
   | Importer un fichier, télécharger ou copier le document entier | oui | non | non | non |

   La dernière ligne vient de n'importe quelle règle du document, même une seule : la première règle posée coûte l'import et la
   copie aux éditeurs, et le niveau choisi n'y change rien. Les propriétaires ne perdent ni l'un ni l'autre.
7. [T] **Le pied de GFS** ne parle que des tables de GFS et des apps (celles qui commencent par `GFS_` ou par le préfixe d'une app), jamais des
   tables de données. Quatre mots, **codés le 04/11** (faits vérifiés, 40) : *Pas protégé* (au moins une de ces tables sans aucune règle), *Protégé en partie*
   (Partagé, ou Encadré avec la structure ouverte), *Protégé* (Encadré partout ET structure fermée) et *Règles de Grist* (des règles que GFS n'a pas posées : il ne dit pas si elles
   protègent) ; « Permissions » tant qu'il n'a rien lu ou qu'il n'a rien à juger. Le niveau d'une table se lit à la note de ses règles (« GFS : Encadré »), jamais à leur contenu. **Seulement quand
   un propriétaire a lu les règles** (la preuve est celle de `contexte.role`, 5.2, point 8) : mesuré, dès qu'une règle refuse la lecture d'une table à une personne, les tables de règles
   lui arrivent **vides**, et vides elles ne disent pas « aucune règle » ; à toute autre personne le pied dit « Permissions », et le panneau en donne la raison.

### 11.5 Poser et retirer

1. [T] **Qui et quand.** Un propriétaire, par un geste de sa part. Au premier lancement (GFS est installé par un propriétaire,
   dont le widget en accès complet peut écrire les règles, mesuré), GFS peut proposer la mise en place en un clic, jamais en
   silence. Seul le rangement existe alors : Grist refuse une règle sur une table absente (« Invalid tables in rules », mesuré),
   donc les règles des espaces et des contenus se posent quand leur table naît.
2. [T] **Une seule liasse.** Les règles d'un niveau sont posées en un seul `applyUserActions` : `AddRecord` dans
   `_grist_ACLResources` et `BulkAddRecord` dans `_grist_ACLRules`, avec des identifiants et des `rulePos` explicites ; Grist
   applique tout ou rien. Un non-propriétaire reçoit « Only owners can modify access rules » (mesuré, 10.4).
3. [T] **Poser recharge la page de tout le monde.** Toute action sur `_grist_ACLRules` ou `_grist_ACLResources` renvoie à chaque
   personne connectée l'ordre de recharger le document, celle qui pose comprise ; même une action qui ne change rien (lu et
   mesuré, 10.6). GFS le dit au propriétaire avant, range ce qu'il faisait (le navigateur de GFS, jamais le document ; [D] clé
   `gfs.reprise`, 5.3) et le reprend après le rechargement. Rien d'autre ne recharge : qui voit quoi est une donnée (11.3, point 5).
4. [T] **Avant de poser**, GFS : relit les règles en place (seul un propriétaire le peut) et ne touche qu'aux siennes ; vérifie
   que chaque table de règles commence par celle des propriétaires ; dit ce que la première règle coûte aux éditeurs (l'import et
   la copie, 11.4, point 6) ; avant de fermer la structure, liste les tables dont les apps installées ont besoin et qui n'existent
   pas, puisqu'un éditeur ne pourra plus les créer. [D] **Pour Encadré, dans cet ordre**, avec l'accord du propriétaire (ce sont
   des changements de structure, additifs, qui ne rechargent personne, 10.6) : `GFS_Espaces` et ses deux colonnes d'aide ; puis
   les colonnes d'aide `GFS_…` des tables classées (une colonne créée avant la table qu'elle nomme garde l'erreur pour les lignes
   existantes, 10.5) ; puis la liasse de règles, après avoir vérifié que chaque table et chaque colonne qu'elle nomme existe
   (sinon GFS le dit et ne pose pas).
5. [D] **La note.** Chaque règle de GFS porte en `memo` « GFS : <niveau> » (`Partagé`, `Encadré`) ; c'est ainsi que GFS reconnaît
   les siennes, lit le niveau posé et ne retire que celles-là. Le refus de Grist qui cite une règle emporte sa note (lu, 10.2) :
   l'explication de l'app et de GFS peut la reprendre.
6. [T] **Après**, GFS relit les règles ; il ne dit « Protégé » que quand un propriétaire a prouvé la lecture (11.4, point 7).
7. [T] **Ne jamais** : donner à tous le droit de copier le document entier (cela rend ce que les règles cachent) ; poser un jeu de
   règles sans celle des propriétaires en tête ; retirer la règle d'un autre auteur sans case « Retirer » cochée ; ranger un
   secret ; écrire dans une table de données ; déclarer un attribut de personne ; écrire une règle de lecture qui cite `newRec` ;
   fermer la structure de lui-même (11.7, point 1) ; laisser publier un formulaire qui remplit une table protégée (11.9, point 4).
8. [D] Une nouvelle table de classe (une app installée plus tard) demande de poser ses règles : c'est une action sur les tables
   de règles, donc la même liasse, le même avertissement, le même rechargement.
9. [T] **Codé le 06/11 (étape 7, lot a)** : dans le panneau « Permissions » (`js/rights/rights-plan.js`, `rights-writer.js`, `rights-actions.js`), un propriétaire prouvé pose ou retire **Partagé sur le rangement** (les six règles de
   11.4, point 2, en une liasse, note « GFS : Partagé · … ») et **ferme ou rouvre la structure** (11.7, point 1). Chaque geste passe par une fenêtre du widget qui dit son prix (la première règle du document, le rechargement,
   ce que coûte la structure fermée), avec « Annuler » au clavier ; GFS relit les règles juste avant d'écrire (un plan périmé n'écrit rien), retient `gfs.reprise` dans le navigateur et rouvre le panneau après le rechargement.
   Un geste impossible reste à l'écran, grisé, avec sa raison (rangement absent ou sans la colonne `Adresse`, règles écrites à la main sur le rangement, structure déjà fermée à la main). Pas encore codé : Encadré, les
   espaces, les colonnes d'aide. Ce que GFS ne peut pas faire seul : lister, avant de fermer la structure, les tables dont les apps ont besoin (11.5, point 4) : le manifeste ne donne que le préfixe (2.3), la fenêtre le dit
   donc en général. Mesuré dans un vrai Grist (faits vérifiés, 44).

### 11.6 Ce que le contrat demande à chaque app

Tout est additif, rien ne se code avant les mesures de 11.8, et une app seule n'a rien de plus à faire : ses tables restent sous
les droits de Grist. [D] **Quand : au lot de l'étape 5**, avec `gfs.json`.

1. [D] **Dire la classe de chaque table** (11.2). Une table non déclarée est du travail courant : ni cachée, ni verrouillée,
   aucune règle.
2. [T] **Tolérer l'absence.** Une ligne cachée, une colonne protégée, une table qu'un éditeur ne peut plus créer : l'app continue
   sans, et ne présente jamais une liste ou un total comme complet quand une partie n'est pas lisible.
3. [T] **Expliquer chaque refus.** Quand Grist répond « Blocked by … » ou « Only owners … », l'app affiche ce que dit la brique
   « refus » du kit : qui refuse (Grist, l'app, le document), pourquoi, à qui s'adresser. La fonction reste grisée, jamais cachée.
4. [D] **Réserver aux propriétaires ce qui touche tout le monde.** Réglage partagé, conception, création de table : l'éditeur voit
   la fonction grisée avec « seul un propriétaire peut… ». L'app lit `contexte.role` (5.2, point 8) pour griser, **jamais pour
   décider** : Grist décide. Elle ne grise que si `proprietaire` vaut `false` ; `null` veut dire « on ne sait pas » et laisse la
   fonction utilisable.
5. [T] **Ne rien croire sur l'identité.** L'adresse de la personne vient de Grist, par la table-sonde (6.4, point 9 pour GFS ; la
   sienne pour l'app, puis celle du kit), jamais d'un champ qu'un éditeur peut changer. La ligne d'une sonde se relit par
   l'identifiant que rend l'ajout, jamais en cherchant « la ligne-sonde ». Depuis le 03/11, GFS donne l'adresse aux apps qui déclarent `identite` (5.2, point 9) : c'est la
   même lecture de Grist, non un champ que la personne a tapé.
6. [D] **L'app tient les colonnes de l'étiquette** (`visibilite`, `personnes`, `auteur`, `espace`) : additives (6.1), tolérées
   absentes. **Les colonnes d'aide `GFS_…` ne sont pas à l'app** : elle les tolère (6.1, points 3 et 4), les ignore et ne les écrit
   jamais. Les noms de l'étiquette viennent dans une consigne à part, après les mesures : aucune app n'ajoute de colonne avant. **07/11 : cette consigne ne viendra pas pour
   `visibilite`, `personnes` ni `espace`** : le partage d'un contenu vit dans `GFS_Partages` (11.7, point 13) et GFS pose lui-même ses colonnes d'aide `GFS_…` avec l'accord du
   propriétaire, dont `GFS_Auteur` que **Grist** écrit à la création (l'app n'écrit aucun auteur ; consignes 058, 025, 014, 011, 015 du 07/11, **remplacées** le même jour par 060 Publipostage+, 027 Form+, 015 Automation+, 012 Grist-BI, 016 Tuesday).
7. [T] **Aucun secret rangé en clair par GFS ; une app qui en garde un le déclare** (`secrets`) et vit sans quand il est illisible.
8. [D] **App par app** (relevé du 22/10) :

   | App | Ce qu'on lui demande |
   |---|---|
   | Publipostage+ | Déclarer `classes` : ses modèles (`reserve`), ses versions, commentaires et écriture en direct (`derivee`), ses préférences par personne (`personnel`) ; ajouter l'étiquette (quatre colonnes) ; vivre sans la colonne du mot de passe commun d'un PDF protégé (la saisir à chaque export, ce que l'app propose déjà) ; dire « seul un propriétaire enregistre ce réglage » pour les quatre réglages de sa vue quand la structure est fermée ; présenter son tableau de droits comme un confort : il masque des boutons, il ne protège rien ; **décidé par le porteur le 04/11 : l'usage seul et l'usage dans GFS se séparent** (seul, l'app garde son tableau tel quel ; dans GFS, c'est GFS qui repasse dessus : le tableau de l'app est grisé et les droits se règlent de façon centrale, à l'échelle de GFS, puis s'écrivent dans Grist à l'étape 7). Aucune consigne avant le contrat de l'étape 7 |
   | Form+ | Dire que concevoir ou republier un formulaire est un geste de propriétaire dès que la structure est fermée : il écrit dans la structure ; pour un lien public (11.9 ; consigne 013) : un partage et une table de réception par formulaire, aucune colonne de gestion écrite dans cette table, la définition de son seul formulaire dans ce que le lien peut lire, des réponses traitées comme non fiables ; sa page des répondants écrit avec la session anonyme du partage : sa tenue structure fermée est à mesurer (11.8) |
   | Automation+ | Déclarer `proprietaires` pour ses lignes `Workflow` (le type de ligne est déjà là) : un workflow s'exécute avec les droits de la personne qui a l'onglet ouvert, donc un workflow qu'un éditeur pourrait changer s'exécuterait chez un propriétaire, avec ses droits |
   | Grist-BI | Vivre sans sa table-sonde si un éditeur ne peut plus la créer (dans GFS, l'identité vient de GFS par le kit : 5.2, point 9 ; seule, l'app garde la sienne) ; dire que les chiffres sont ceux que la personne a le droit de lire, pour que deux personnes qui voient deux totaux sachent pourquoi |

9. [D] **Les liens publics** (11.9) : toute app traite une valeur de donnée comme du texte non fiable (elle l'échappe, ne la prend
   jamais pour du code), et ne déclenche rien d'elle-même sur les lignes d'une table qu'un lien public remplit. Publipostage+,
   Automation+ et Grist-BI le disent dans leur état ; la réponse du porteur est tombée le 04/11 (11.7, point 9) : consignes posées le 04/11 (Publipostage+ 046, Automation+ 009, Grist-BI 005).

### 11.7 Ce qui n'est pas décidé

1. [D] **Ce que GFS fait de la structure du document** (la case de Grist) : **le porteur a choisi le 04/11 (15 h 57) de la proposer d'un clic**
   (avec son prix, dit avant le clic : import et copie perdus pour les éditeurs, pages, tables et colonnes fermées ; le bouton rouvre de même). Rien n'est codé : le bouton
   est de l'étape 7, avec l'accord d'un propriétaire à chaque pose. Jusque-là : [T] GFS ne la ferme jamais de lui-même ; il
   dit, dans le pied, si elle est ouverte ou fermée et ce que cela change. Seul « Protégé » (11.4, point 7) et le caractère
   *secret* des contenus réservés (11.1, point 8) en dépendent. Grist décoche la case de lui-même quand un propriétaire active les
   Permissions avancées (lu), et le porteur a confirmé qu'elle se décoche sur son instance (21/10). Elle pèse aussi sur les liens publics : structure ouverte,
   un éditeur peut écrire les tables qui publient un formulaire (11.9, point 7), ce qu'il reste à mesurer (10.11, mesure 4).
2. [D] **Qui écrit l'étiquette d'un contenu : GFS, par « Partager »** (fenêtre du menu d'un fichier, point 13 ; décision du 06/11 : « partage libre, invitation demandée », colonnes d'aide
   posées avec l'accord du propriétaire à chaque fois). L'app n'écrit ni visibilité, ni personnes, ni espace, ni auteur : GFS pose `GFS_Auteur`, que Grist remplit (consignes du 07/11, 11.6 point 6). *(Question
   ouverte jusqu'au 06/11 : l'app dans son interface, ou GFS dans l'explorateur.)*
3. [Q] **Les tables dérivées** : ce que l'auteur d'un contenu lit et écrit de ses versions et de ses commentaires (versions à
   l'auteur et aux propriétaires, commentaires à ceux qui lisent le contenu, d'après le document de stratégie) n'est pas mesuré.
   À fixer avec Publipostage+ à l'étape 5 et à mesurer. S'y ajoutent les fils d'un PDF (5.4, point 8 ; consigne 045) : leurs lignes
   portent la clé du fichier et pas de `ModeleId`, la colonne par laquelle la classe `derivee` suit son modèle ; aucune table `reserve`
   ne se trouve derrière elles (le PDF est une ligne de `GFS_Fichiers`, sans étiquette), donc qui les lit et qui les écrit reste à dire.
4. [Q] **Les lignes réservées d'une table `reserve`** (la ligne `reglages` de Publipostage+, 6.3) : visibles de tous, écrites par
   qui ? Sous Encadré, seuls son auteur, le responsable de son espace et les propriétaires écrivent une ligne. À fixer avec
   Publipostage+.
5. [D] **`GFS_Espaces` à part** plutôt que des lignes réservées du rangement : le cahier préfère limiter les tables, mais les deux
   n'ont pas les mêmes règles (une personne lit ses lignes de rangement, un responsable lit sa ligne d'espace). Se tranche à
   l'étape 7, avant que la table existe.
6. [D] **GFS ajoute les colonnes d'aide dans la table d'une app** (**le porteur a choisi « oui, avec ton accord à chaque pose » le 06/11** ; rien n'est codé, c'est le lot b : l'exception à 6.3, point 2 est accordée, additive, jamais une donnée) —, ce que 6.3, point 2 ne permet pas aujourd'hui (le porteur n'a
   donné que le nom d'un fichier, 21/10). Les deux autres voies tiennent mal : l'app les crée (mesuré : une colonne créée avant
   `GFS_Espaces` garde l'erreur ; et l'app n'est pas ouverte quand le propriétaire pose Encadré), ou les règles lisent autre
   chose (une table « attribut de personne » recharge la page, 11.3, point 5). Défaut pris : GFS les crée, avec l'accord du
   propriétaire, additives, sans toucher à une donnée. Une carte au porteur au moment de l'étape 7.
7. [Q] **Le changement d'adresse e-mail** (une personne perd ses affaires) : GFS pourrait signaler les adresses des listes qui ne
   sont plus celles d'un utilisateur du document, par la liste des utilisateurs que l'API rend aux propriétaires (11.8).
8. **Le jeu complet** (rangement, contenus, espaces, workflows) n'a pas été mesuré d'un seul bloc : les règles des espaces et du
   responsable l'ont été sur les contenus, les personnes nommées et les tables dérivées avant les espaces. Un contrôle d'ensemble
   fait partie de l'étape 7.
9. [T] **Que reçoit un lien public : la table du formulaire, cloisonnée.** **Tranché le 04/11** (le porteur, carte « Choisir où
   arrivent les réponses d'un formulaire public », posée le 22/10) : (b) *la table du formulaire*, une par formulaire, colonnes de
   gestion écartées (11.9, point 4b) et accord à la publication (3.3, point 9, codé), que le panneau de GFS montre en entier, lien
   par lien (11.9, point 8). La consigne 013 la demande à Form+. (a) *La boîte aux lettres* (une table à **une seule colonne**, qu'une
   personne valide avant que l'app répartisse les réponses ; aucune table ouverte, aucune colonne lue ni forgée) n'est pas retenue
   pour l'instant : Form+ ne répartit rien après coup, il écrit chaque table directement à l'envoi (lu à `cc21a27`, `respond.js`), ce
   serait un ajout. (c) *Rien de plus que l'accord* : écartée.
10. [Q] **Fermer ou renouveler un lien depuis GFS** (une écriture, étape 7) : dépublier (`publish` à faux), ou renouveler (retirer le
    partage et en créer un autre, donc une autre clé, ce qui rend inutile un lien qui a circulé : à vérifier). À décider avec les
    autres écritures de GFS dans la structure.
11. [D] **GFS dit aux apps quelles tables un lien public remplit** (**le porteur a répondu « oui, GFS donne la liste » le 06/11, 21 h 10**, à la
    carte posée après la réponse d'Automation+ à sa 009 : un workflow actif lance ses actions sans geste sur toute ligne que sa vue reçoit, lien
    public compris, tant que l'onglet est ouvert et tient son verrou). Rien n'est codé ; le champ s'ajoute au contexte (5.2) avec le panneau des liens
    (11.9, point 8), à l'étape 7. Le contrat :
    a. [D] Le champ `liensPublics` du contexte vaut `{ connu, tables }`. `tables` est la liste des identifiants de table que **au moins un lien
       public** remplit (une table de réception, 11.9, point 4b, plus toute table qu'un partage publié cible), lue par GFS dans les partages du
       document avec la lecture du panneau (11.9, point 8) ; `connu` est vrai quand GFS l'a lue.
    b. [D] **Seul un propriétaire prouvé lit les partages** (11.9, point 8) : pour toute autre personne, ou quand les tables sont illisibles
       (structure fermée, règles posées), `connu` est faux et `tables` vide. **Une app qui reçoit `connu: false` fait comme si toute ligne reçue
       venait d'un lien** : elle attend le geste d'une personne avant d'agir sur une ligne qu'elle n'a pas écrite elle-même. Jamais l'inverse : un
       champ absent ou illisible ne vaut pas « aucun lien ».
    c. [D] **Ce que l'app en fait** : sur une ligne d'une table de `tables` (ou de toute table si `connu` est faux), elle n'agit pas sans geste
       (11.9, point 5, et 11.6, point 9) ; sur toute autre table, elle garde son comportement. La liste ne dit jamais qui a écrit une ligne (la
       colonne d'auteur n'est pas fiable, 11.9, point 3) : elle dit seulement quelles tables **peuvent** recevoir des lignes d'un lien.
    d. [T] GFS relit les partages à chaque `contexte` (au plus une fois toutes les 30 s) et n'envoie pas d'événement de plus au départ : une app
       qui agit sur une ligne reçue redemande le contexte avant de lancer. Aucune clé de lien n'est jamais dans le champ (11.9, point 8).
    e. [M] **À mesurer à l'étape 7** : qu'un propriétaire garde `connu: vrai` quand les règles de Partagé et la structure fermée sont posées
       (ses tables de partages lui restent lisibles) ; ce qu'un éditeur dont le widget a l'accès complet lirait de lui-même (point 8 : la clé
       de partage l'est, d'où la structure fermée) ; un formulaire publié par l'interface de Grist plutôt que par GFS.
    La consigne à Automation+ (013 et suivantes) et à Publipostage+ se rédige quand le champ est livré, avec ce qui l'est.
12. [D] **Qui voit un PDF que GFS garde, et une entrée de la corbeille ?** (trou vu le 04/11) **Le porteur a choisi le 06/11 « privé par défaut » (a, b et c ci-dessous) ; rien n'est codé, les règles de ces deux tables se posent avec Encadré.** `GFS_Fichiers` (6.6) et `GFS_Corbeille`
    (6.7) sont deux tables de GFS que 11.2 ne classe pas : sous Encadré, aucune règle ne les couvre, donc tout éditeur y lit tous les
    PDF (les exports d'une app compris, faits avec ce que la personne avait le droit de lire) et l'instantané complet de tout fichier
    d'app mis à la corbeille, qui est la ligne entière de l'app (`Instantane`, 6.7) : un modèle réservé (`reserve`, 11.2) qu'on
    supprime devient lisible de tous, ce que son étiquette interdisait. Le pied de GFS ne doit pas dire « Protégé » tant que ce trou
    est ouvert (11.4, point 7). Défaut proposé, à confirmer par une carte à l'étape qui pose les règles : (a) classer `GFS_Fichiers`
    en `reserve` (colonnes d'étiquette **additives**, 6.1 : `Visibilite`, `Espace`, `Personnes`, avec `Auteur`, déjà là) : un nouveau
    fichier n'est lu que de son auteur, du responsable de son espace et des propriétaires, et les fichiers d'avant gardent `tous` (comme
    11.2, point 3) ; (b) la corbeille recopie l'étiquette de la ligne qu'elle reçoit dans des colonnes à elle (une règle ne lit pas du
    JSON), et, quand la table d'origine n'a pas d'étiquette, n'est lue que de qui l'a supprimée et des propriétaires ; (c) « Restaurer »,
    « Supprimer pour de bon » et « Vider la corbeille » ne touchent que ce que la personne peut lire (6.7, point 4 : « celles qu'elle a
    sous les yeux »). Rien n'est écrit avant la carte, et rien ne fuit aujourd'hui de plus qu'au niveau Ouvert : aucune règle n'est posée.
13. [D] **Partager sans être propriétaire** (cahier d'Antoine du 06/11 : « Partager » depuis « ⋯ », quatre droits par fichier ou dossier, héritage vers le bas par
    défaut, groupes, catégories, e-mails ; maquettes validées le 06/11 : `maquette-partager.html`). Grist n'autorise que les propriétaires à écrire les règles et à inviter dans le
    document (11.4). **Le porteur a choisi le 06/11 (21 h 23) « partage libre, invitation demandée »** : les règles, posées une fois par un propriétaire, lisent une table de
    partages de GFS (fichier ou dossier, personne ou groupe ou catégorie, droit, date de fin) ; un administrateur de fichier, propriétaire ou non, partage avec les personnes
    **déjà dans le document** en y ajoutant une ligne, sans propriétaire. Pour une adresse **pas encore dans le document**, GFS envoie une demande d'invitation à un propriétaire ;
    la ligne de partage prend effet dès que la personne est invitée dans Grist. Les lignes de partage ne sont lisibles que de l'administrateur du fichier, de la personne
    concernée et des propriétaires (un nom de dossier peut être confidentiel). **Premier lot codé le 07/11** (point g) ; le reste (dossiers, groupes, catégories de la table d'équipe,
    demande d'invitation, menu « Gérer les partages ») n'est pas codé.
    a. [D] **Droits** : lecture seule, lecture + commentaires (ceux des apps : une règle sur leur table de commentaires liée au fichier, 11.7, point 3, pas le rôle de commentateur de
       Grist), dépôt seul (ajouter sans voir ni modifier l'existant), écriture, administration (changer qui a accès). Cases : « peut télécharger » ; « accès jusqu'au » (date de fin).
    b. [D] **Fin d'accès** : une règle de Grist ne lit pas l'heure, une colonne-formule sur `TODAY()` si (faits vérifiés, 46) : l'accès s'arrête à la date **dès que Grist recharge le
       document** ; la fenêtre le dit à l'ajout (un document ouvert sans interruption peut aller un peu au-delà) et la ligne passe en « échu » sans que GFS retire rien. [M] À mesurer : le
       rechargement d'un document ouvert au-delà de minuit.
    c. [D] **Un fichier ou un dossier sans droit est invisible** dans l'explorateur, non grisé (décision du porteur, 06/11 : les noms peuvent être confidentiels ; la règle « grisé, jamais
       masqué » vaut pour les gestes, non pour les données). Limite à dire : les noms de tables et de pages de Grist restent visibles de qui a accès au document.
    d. [D] **Héritage** : un dossier partagé donne ses droits à ce qu'il contient, vers le bas, par défaut ; les droits s'additionnent, sans refus explicite ; « ne plus hériter »
       restreint un fichier.
    f. [T] **Mesuré le 06/11 (faits vérifiés, 46)** : des règles posées une seule fois, qui ne lisent que la ligne (`rec`), suffisent : tout le reste passe par des colonnes-formules (`Lecteurs`,
       `Valide`, `AdminsCible`) ; un administrateur de dossier partage sans propriétaire ; un partage hors de son dossier est écrit mais ne vaut rien ; l'héritage vers le bas se calcule dans la formule ;
       deux niveaux de validité seulement (un administrateur désigné par un propriétaire nomme, la délégation ne descend pas plus bas).
    e. [T] **La liste des invités n'est pas lisible par un widget** (faits vérifiés, 45) : GFS propose les adresses qu'il connaît (le rangement, les tables d'équipes désignées) et
       l'adresse tapée ; le reste passe par « Demander l'invitation ». « Voir en tant que » existe déjà dans Grist et les widgets en tiennent compte : GFS n'en refait rien.

    g. [T] **Premier lot livré le 07/11** (`js/sharing/sharing-model.js`, `js/sharing/share-window.js`, `js/sharing/share-control.js`, `css/share.css`) : la ligne « Partager… » du menu d'un PDF que GFS garde
       (`GFS_Fichiers` ; les fichiers d'une app attendent leurs colonnes d'aide) ; trois droits (lecture seule, écriture, administration ; « commentaires » et « dépôt seul » sont dans le
       menu, grisés, avec leur raison) ; par adresse, par catégorie (« tous les éditeurs », « tout le document ») ; « peut télécharger » (confort) ; fin d'accès. **Activer** est un geste de
       propriétaire (`rights.act.sharing`), avec la question qui dit le prix (tables, cinq colonnes d'aide, première règle, rechargement de la page de tous) ; GFS rouvre la fenêtre du même fichier après
       le rechargement. L'activation crée aussi `GFS_Rangement` s'il manque : sans lui GFS ne connaît pas l'adresse d'un éditeur, et son PDF serait refusé (mesuré dans un vrai Grist,
       `labo/run-partager-fenetre.mjs`) ; les PDF déjà rangés restent lisibles de tous (une ligne « tout le document » par PDF). Chacun lit les lignes qui le concernent, catégories
       comprises. Mesuré : vrai Grist à trois comptes (`labo/run-partager.mjs` 25, `labo/run-partager-fenetre.mjs` 26), 700 × 400 à la vraie souris, clair et sombre, français et anglais ;
       Firefox (`test/partager-firefox.mjs`).

    h. [T] **Fichiers des apps livrés le 07/11** (lot 2 ; `appTargets` et `targetsOf` de `js/sharing/sharing-model.js`, d'après `fichiers[]` des manifestes). Pour chaque table de fichiers d'une app **présente dans le document** : GFS ajoute `GFS_Auteur`
       (colonne déclenchée, `user.Email`, écrite par Grist ; jamais rétro-remplie : les lignes d'avant n'ont pas d'auteur) et les cinq colonnes d'aide, pose les règles (création à son nom d'après `newRec.GFS_Auteur`, `-U` sur
       `GFS_Auteur`), laisse **ouvertes** les lignes que `exclure` écarte (les réglages) et rend les fichiers d'avant lisibles de tous (une ligne « tout le document » par ligne de la table). La clé d'un fichier est
       `<id de l'app>:<identifiant>`, le numéro de ligne quand `colonnes.id` vaut `id`. Une table d'app qui porte déjà une règle d'un autre auteur est laissée. Une app ajoutée après l'activation : « Étendre le partage à
       cette app… » (la question dit « compléter »). Mesuré dans un vrai Grist à trois comptes avec la table de Publipostage+ (`labo/run-partager-apps.mjs`, 34 vérifications ; Form+ ajouté ensuite) : l'éditeur ne lit pas
       le modèle privé du propriétaire, crée le sien (Grist écrit son adresse), ne triche pas sur l'auteur, écrit un modèle ouvert en écriture et pas un modèle en lecture, garde la ligne de réglages ; le lecteur n'écrit
       rien. **Pas mesuré** : avec les vraies apps sous règles (leur comportement devant un refus d'écriture) ; les tables liées (versions, commentaires) ne sont pas couvertes ; le numéro de ligne peut être réutilisé par Grist
       après une suppression (les partages d'un fichier supprimé attendent un nettoyage) ; la corbeille (point 12).
       **Corrigé le 09/11 (audit de sécurité, faits vérifiés 73)** : l'auteur d'un PDF de GFS est lui aussi `GFS_Auteur` (écrit par Grist, `-U` pour qui n'est pas propriétaire), plus la colonne « Auteur » : l'explorateur
       réécrit « Auteur » à chaque remplacement du contenu, et un porteur du droit « écriture » devenait ainsi auteur, donc administrateur, du PDF d'un autre (effacer, donner l'administration). Les PDF d'avant gardent leur
       auteur : la colonne reprend « Auteur » une fois, à la reprise du partage (« Compléter »).

    i. [T] **Groupes et « Gérer les partages » livrés le 07/11** (lot 3 ; `GROUPS_TABLE`, `groupColumns`, `planGroupAdd`, `planGroupsRead` de `js/sharing/sharing-model.js` ; `js/sharing/manage-window.js`, `js/sharing/manage-control.js`, `js/ui/pick-window.js`).
       La table `GFS_Groupes` naît avec le partage (ou à la reprise d'un partage d'avant, qui relit alors les colonnes d'aide) : `Nom`, `NomL`, `PersonnesIci` (adresses tapées), `Source`, `SourceEmail`, `SourceGroupe`
       (un groupe lu d'une table du document) et deux colonnes que Grist calcule, `Membres` et `Nb`. Un partage vise un groupe par `#nom` ; les colonnes d'aide de chaque fichier développent `#nom` par `Membres` (une règle de
       Grist ne lit pas une autre table). Règles : les propriétaires font tout, un éditeur lit `Nom`, `NomL`, `Nb` et `Source` (pour proposer un groupe), jamais les adresses, le reste est refusé. L'administration d'un fichier ne se donne
       pas à un groupe ni à une catégorie. « Gérer les partages… » (bouton de la fenêtre « Partager » et du panneau « Permissions », propriétaire seulement ; clé de reprise `manage`) : **Options** (fermer ou rouvrir la structure, avec la
       question du panneau ; les liens publics se créent dans Grist), **Groupes** (créer un groupe tapé, le modifier, le supprimer, **lire les groupes d'une table** : trois listes avec recherche, un groupe par valeur distincte,
       les identifiants vérifiés avant d'entrer dans une formule, les noms pris laissés), **Catégories** (un droit sur tout le document pour les éditeurs et pour tout le monde : une ligne de partage dont la cible est la racine `*`).
       Mesuré dans un vrai Grist à trois comptes (`labo/run-partager-groupes.mjs`, 32 vérifications) et sous Firefox (`test/partager-firefox.mjs`, 700 × 400 à la vraie souris). Une formule de `Membres` qui contenait un saut de ligne
       dans une chaîne (« \n » écrit en vrai saut) rendait `Membres` vide sans erreur visible : trouvé par le labo, gardé par un test. **Limites** : une colonne de groupes de type liste de choix n'est pas lue (la recherche
       de Grist compare une valeur) ; un groupe supprimé laisse ses partages sans effet (ils ne donnent plus accès à personne) ; les membres d'un groupe lu d'une table suivent la table mais pas par les apps.

    j. [T] **Espaces et « le plus précis gagne » : cœur livré le 09/11** (lot 4a ; décision du porteur du 09/11, comme Google Drive : des **espaces partagés** dont l'accès passe par des groupes seulement — plusieurs groupes, chacun son rôle —,
       et dans l'espace des droits différents par personne ou par groupe sur un dossier ou un fichier ; « Partagés avec moi » pour le partage direct entre personnes, lot 4c). `GFS_Espaces` (`Cle`, `Nom`, `Voit` : qui y a accès, groupes
       développés) et `GFS_Placement` (`Cible` : le fichier, `Espace`, `Dossier`) naissent avec le partage ; un partage vise `espace:<clé>`, `dossier:<clé>/<chemin>` ou un fichier. **Le droit le plus précis gagne** (choix du porteur,
       09/11 : « si Marc est dans un groupe qui a un espace et que je retire la lecture pour cacher un fichier, Marc n'y a plus accès ») : le fichier avant son dossier, le dossier avant l'espace, l'espace avant le document entier ; à
       précision égale, la personne avant le groupe, le groupe avant la catégorie ; **à égalité entre deux groupes, le droit le plus large** (choix du porteur, 09/11). Nouveau droit **« Aucun accès »** (`aucun`, pour une
       personne ou un groupe, jamais une catégorie) : une règle `-CRUD` sur la liste `GFS_Refus` passe juste après les propriétaires. Une colonne cachée `GFS_Calc` calcule les six listes (lecteurs, écrivains, administrateurs, refus,
       catégories qui lisent et qui écrivent) que les règles lisent ; un fichier sans placement garde les règles d'avant (le document, puis lui-même). **Un document partagé avant** est repris : « Partager… » dit « Compléter le partage… »,
       GFS ajoute `GFS_Calc` et `GFS_Refus`, reprend les formules d'aide, retire puis repose les règles de fichiers, crée les deux tables, sans repartager aucun fichier. Mesuré dans un vrai Grist à trois comptes
       (`labo/run-partager-espaces.mjs`, 23 vérifications ; `labo/run-partager-reprise.mjs`, 19 vérifications avec l'ancienne version servie depuis une copie du dépôt). **Pas fait** : « Partagés avec moi » (4c), le partage d'un dossier par la fenêtre, la gestion d'un espace par un administrateur de groupe (aujourd'hui seuls les propriétaires écrivent les espaces, les placements et les
       partages d'un espace ou d'un dossier), le renommage d'un dossier (ses partages le suivraient mal).
    k. [T] **L'écran des espaces : livré le 09/11** (lot 4b, première partie). « Gérer les partages… » a un onglet **Espaces** : liste, « Nouvel espace » (nom demandé dans une fenêtre du widget), détail avec les groupes de l'espace
       et leur rôle (lecture, écriture, retirer ; un groupe s'ajoute par la liste avec recherche), suppression avec question (les partages de l'espace et de ses dossiers partent, les fichiers restent, hors de l'espace). La fenêtre
       « Partager… » propose **« Aucun accès »** (grisé pour une catégorie) et affiche les droits hérités avec leur origine (« Hérité : espace “…” », « Hérité : dossier “…” »). Mesuré à la vraie souris dans un vrai Grist
       (`labo/run-partager-espaces.mjs`, étape 4 de la phase propriétaire) et sous Firefox (`test/partager-firefox.mjs`).
    l. [T] **Les espaces dans l'explorateur : livrés le 09/11** (lot 4b, seconde partie ; choix du porteur : « Espaces à côté de “Moi” »). « Espaces » est une **racine du volet**, après « Moi », avec les espaces que la personne lit,
       leurs dossiers et leurs dossiers vides ; « Moi » ne la liste pas, et le fil d'Ariane d'un espace ne passe pas par « Moi ». Pour tout ce qui range (arbre, « Déplacer vers… », couper-coller, glisser-déposer, Ctrl+Z), un
       espace est un dossier de plus : le fichier a pour dossier « Espaces/<espace>/<dossier> » (`js/sharing/spaces-filing.js`), et seule l'écriture sait la différence. **Un fichier placé dans un espace est une ligne de `GFS_Placement`**
       (`Cible` = la clé du fichier, `Espace`, `Dossier`), partagée avec ceux qui voient l'espace ; **le rangement de la personne (`GFS_Rangement`) ne reçoit jamais un chemin d'espace** : il garde le dossier à elle (le fichier y
       retourne quand il sort de l'espace) et le favori. Un dossier vide d'espace est une ligne de placement sans `Cible`. **Seul un propriétaire range dans un espace** (ou en sort un fichier, ou y garde un dossier) : les règles de
       `spaceRules` n'ouvrent l'écriture des placements qu'à eux ; une autre personne lit la phrase « Seul un propriétaire du document range dans un espace partagé » et rien n'est écrit. Un fichier neuf (copie, PDF importé) créé
       dans un dossier d'espace y est placé par un propriétaire, sinon il va à la racine de la personne. **Refusés pour l'instant, avec une phrase** : renommer ou déplacer un dossier d'espace (les partages portent son chemin et ne le
       suivraient pas : un refus ciblé perdu ouvrirait le dossier), supprimer ou créer un espace d'ici (« Gérer les partages… », onglet Espaces), nommer « Espaces » un dossier de « Moi ». Mesuré dans un vrai Grist à trois comptes
       (`labo/run-partager-espaces.mjs`, étape 5 : ranger, parcourir, ressortir, remettre à la souris ; l'éditeur voit la racine et le fichier, ne peut pas en sortir un) et sous Firefox (`test/dossiers-firefox.mjs`, « Espaces »).
       **« Partager… » sur un dossier d'espace : livré le 09/11.** Le menu d'un dossier a « Partager… » : dégrisé pour un dossier à l'intérieur d'un espace (cible `dossier:<clé>/<chemin>`), grisé avec sa phrase pour « Espaces »,
       un espace (ses groupes se règlent dans « Gérer les partages… », onglet Espaces) et un dossier de « Moi ». La fenêtre est celle des fichiers (personne, groupe, « Aucun accès ») et marque « Hérité » ce qui vient de l'espace
       et des dossiers au-dessus ; un droit donné se lit tout de suite dans les listes de chaque fichier du dossier (mesuré : `labo/run-partager-espaces.mjs`, étape 5, 43 vérifications ; Firefox : `test/dossiers-firefox.mjs`).
       **Pas fait** : la création d'un fichier d'une app directement dans un dossier d'espace (il naît à la racine de la personne), les fichiers à la corbeille (ils gardent leur place dans l'espace).
    m. [T] **« Partagés avec moi » : ce qu'on m'a donné par mon adresse, livré le 11/11** (lot 4c ; choix du porteur, 11/11 : « ce qu'on m'a donné par mon adresse »). La vue est celle des fichiers reçus d'un autre document (contrats 6.6,
       point 17) ; elle montre aussi les fichiers dont **le droit vient d'une ligne de partage à l'adresse de la personne, sur le fichier ou sur un dossier d'espace, écrite par quelqu'un d'autre**. Ni un groupe, ni une catégorie
       (« éditeurs », « tous »), ni la racine, ni un espace entier n'y comptent ; un fichier déjà rangé dans un espace que la personne voit reste dans l'espace. Grist le calcule : une colonne cachée de plus, **`GFS_Directs`**
       (« adresse>auteur du partage », septième liste de `GFS_Calc` ; le droit gagnant d'une personne doit être une ligne de personne au niveau d'un dossier ou du fichier). Le fichier garde son menu ordinaire (ouvrir, partager…) ; la
       colonne « Par » dit celui qui l'a donné ; **à la racine de « Moi » il ne figure pas tant que la personne ne l'a pas rangé dans un dossier**. Un lecteur ne peut pas apprendre son adresse par la sonde du rangement (il n'écrit
       rien) : GFS la lit alors dans les partages qu'il lit (« chacun lit les partages qui le concernent »), si une seule adresse de personne y figure. **Un document partagé avant** reçoit la colonne par « Compléter le partage… »
       (mesuré : `labo/run-partager-reprise.mjs`). Mesuré dans un vrai Grist à trois comptes (`labo/run-partager-espaces.mjs`) et sous Firefox (`test/dossiers-firefox.mjs`, « Partagés avec moi »).
       **Pas fait** : le partage direct d'un dossier de « Moi » (seuls les dossiers d'espace ont des droits), l'acceptation ou le refus d'un fichier donné (un droit donné se retire dans « Partager… » par celui qui l'a donné), la lecture légère des gros documents n'est pas mesurée.

### 11.8 À mesurer sur le Grist du porteur

Le labo (grist-static 0.1.6) n'a ni lien public, ni téléchargement, ni historique d'actions, ni les messages d'erreur de la page
de Grist, et n'est pas l'instance du porteur. Les dix points sont dans `faits-verifies.md`, 10.10, avec deux ou trois comptes (un
propriétaire, des éditeurs) : session de lien public ou de formulaire publié structure fermée ; texte du refus d'un réglage de
vue ; note d'une règle dans le refus ; rechargements à deux comptes ; qui est vraiment propriétaire ; téléchargement et copie
refusés ; historique des actions ; version de Grist et libellé de la case ; jeton du widget et liste des utilisateurs du
document ; adresse que voient les règles par l'interface et par l'API, ligne-sonde comprise. Chacun peut changer une règle de
11.4, un champ de `contexte.role` (5.2, point 8) ou la preuve du pied (11.4, point 7). Cette section sort de la version 0 quand
ils sont faits. **Faits le 04/11 sur un vrai Grist 1.7.19 (Docker, trois comptes, faits vérifiés 40)** : qui est vraiment propriétaire (la preuve `GET /webhooks`) ; le jeton du widget et la liste
des utilisateurs du document (le jeton n'ouvre pas `/access` : 403 pour tous) ; la version (1.7.19 seule : celle de la DINUM reste à relever). **Pas faits** : le reste, sur l'instance du porteur.

S'y ajoutent les six mesures des liens publics (faits vérifiés, 10.11), à faire dans la même séance avec un vrai lien de formulaire
publié. La première, une session de partage écrit-elle une table interne ou un réglage de widget ?, passe avant toutes : elle dit
si un lien peut plus que créer des lignes (11.9, point 2).

### 11.9 Les liens publics et les formulaires publiés

Un lien public (un formulaire publié, natif de Grist ou de Form+) laisse n'importe qui écrire dans le document sans y avoir de
compte. Le porteur, le 22/10 : un formulaire est « une porte d'entrée pour venir écrire des bêtises dans un document », et il faut
« segmenter et limiter les droits d'écriture d'un formulaire », avec une vigilance de tous les instants. Les preuves sont dans
`faits-verifies.md`, 10.11. L'accord demandé à chaque publication est codé dans le courtier depuis le 22/10 (3.3, point 9 : la
fenêtre, les refus sans demander, l'échec fermé) ; la consigne 013 est faite (Form+ à `fd5384a`) et, depuis le 03/11, un lien ne lit que
les petites tables que le manifeste de l'app déclare (point 4c) ; cette sous-section en donne le cadre et dit ce qui reste. Un formulaire qu'on remplit dans le document, connecté, n'est pas un lien public : il passe par les règles des
personnes (11.4). **Codé le 04/11** : le panneau de toutes les portes (point 8, étape 6). **Pas encore codé** : le propriétaire seul (point 7), les classes protégées de 11.2 (point 4c). **Tranché le 04/11** : un lien reçoit la table du formulaire, cloisonnée, et non une boîte aux lettres
(11.7, point 9 ; points 4a et 4b ci-dessous). **Pas mesuré** : ce que Grist ouvre vraiment à qui a le lien (le
labo n'a pas de partages, 10.11).

1. [T] **Un lien ne passe ni par le courtier ni par les règles de GFS.** Le visiteur parle à Grist, dans une session de partage
   anonyme, et Grist rend muettes pour lui toutes les règles posées (10.11). Aucun niveau (11.4), aucune classe (11.2), aucun
   espace (11.3) ne l'arrête ; un verrou d'interface encore moins (11.1, point 1). Aucune règle ne peut resserrer un lien après
   coup : seul ce qu'on publie (quelle table, quelles colonnes, quelles Références) fixe ce qu'il peut.
2. [T] **Ce qu'un lien a, au plus** (lu, 10.11) : créer des lignes, dans **toutes** les colonnes, des tables que ciblent les
   sections de formulaire publiées de sa page ; lire la colonne entière que montre chaque Référence de ces formulaires ; rien
   d'autre : ni lire une ligne existante, ni la modifier, ni la supprimer, ni toucher à la structure. [M] À mesurer avec un vrai
   lien (10.11, mesures 1 à 3) : un rapport de Form+ (16/09) dit qu'une session de partage a écrit les réglages d'un widget sur
   l'instance de la DINUM.
3. [T] **Grist ne vérifie rien de ce qu'un lien écrit** (mesuré au moteur, 10.11). Une colonne que le formulaire ne montre pas, une
   colonne à formule déclenchée (une date de réception, un auteur), un choix hors de la liste, une référence vers une ligne
   absente, du texte dans un nombre : tout est gardé tel quel. Seule une colonne-formule pure refuse d'être écrite. Aucune limite
   de nombre, de taille ni de débit propre à un lien n'est connue (mesure 5). **Toute ligne venue d'un lien est une entrée non
   fiable**, même dans une colonne que l'app croit remplir elle-même.
4. **Segmenter : une porte, sa table de réception.**
   a. [T] Un formulaire publié a **son partage** (sa page) et n'ouvre que **les tables qu'il remplit**, dites une à une dans
      l'accord (point 6) : **un partage par page** (**modifié le 11/11, « Au choix, non coché » : deux pages ne partagent un partage que si la personne l'accepte dans une fenêtre
      de GFS, qui reste sur « Refuser », 3.4 point 8 d** ; le défaut reste un lien par formulaire), jamais un lien qui écrit dans la table d'un autre formulaire que ceux de son partage.
   b. [T] La table qu'un lien remplit est une **table de réception** : elle reçoit, et ce qu'on en tire (valider, publipostage,
      workflow) se fait après le geste d'une personne (point 5). Ce que le formulaire ne montre pas (statut, note, état de
      traitement) n'y est pas une colonne de donnée : c'est une colonne-formule pure, ou une colonne d'une autre table liée à la
      ligne reçue. Tant que ce n'est pas le cas, l'accord liste ces colonnes (« le lien pourrait les remplir ») et le propriétaire
      accepte ou annule. **Tranché le 04/11** (le porteur) : une table de réception par formulaire, jamais une boîte aux lettres
      (11.7, point 9).
   c. [T] **Une table protégée n'est jamais ouverte à un lien**, parce que ses règles seraient muettes pour la création : une
      table de GFS (`GFS_Espaces` : un visiteur y écrirait la liste des responsables d'un espace), une table de classe `personnel`,
      `reserve`, `derivee` ou `proprietaires` (11.2), une table qui porte les colonnes de l'étiquette (11.2, point 4), une table de
      l'app qui publie (`FormPlus_…`). [D] GFS **refuse** la publication d'un formulaire qui en remplirait une, sans la proposer à
      l'accord. [T] Codé le 22/10 (3.3, point 9) : une table de GFS, d'une autre app ou de l'app qui publie, à l'ajout ; une table de
      GFS ou d'une autre app, à la lecture. Les classes de 11.2 viendront avec cette section.
      [T] **Tranché le 03/11 (le porteur, carte « Petites tables déclarées seulement »).** La 013 est faite (Form+ à `fd5384a`) et elle a pris la piste
      « une petite table par formulaire publié, que sa seule Référence vise » (sa propre liste, point 1) : le lien lit donc `FormPlus_Pub_<vsId>`, une
      ligne, la définition de CE formulaire, et le formulaire public ne s'afficherait pas sans cette lecture. Refuser toute lecture d'une table de l'app
      qui publie casserait donc tout formulaire public de Form+ ; GFS fait autrement : **parmi les tables de l'app qui publie, un lien public ne lit
      que les petites tables que le manifeste de l'app déclare** (`permissions.lienPublic`, 3.4 point 5 ; Form+ : `FormPlus_Pub_*`). La lecture d'une
      petite table déclarée passe par l'accord (la fenêtre dit la colonne `Definition` de la petite table) ; **toute autre table de l'app est refusée
      sans fenêtre** (`GFS_REFUSE` : « c'est une table de l'app que son manifeste ne déclare pas lisible par un lien public »), à commencer par celle qui
      garde toutes les définitions, `FormPlus_Formulaires` (clés de partage comprises), qu'un lien ne doit jamais lire : un manifeste dont un motif la
      couvrirait, ou couvrirait la table de rangement de l'app, est invalide (2.8). Un manifeste sans `lienPublic` n'ouvre aucune table de l'app à un
      lien. Codé et mesuré le 03/11 dans un vrai Grist : `run-publication.mjs` (36 vérifications, dont le refus de `FormPlus_Formulaires` sans
      fenêtre et la fenêtre de `FormPlus_Pub_9`) et `run-form.mjs` avec Form+ à `fd5384a` (48 : l'enregistrement par le lien ouvre les mêmes deux
      fenêtres, rien n'est refusé de ce que l'app fait).
   d. [D] Une **Référence** rend lisible, pour toute personne qui a le lien, la colonne entière qu'elle montre (lu) : l'accord la
      liste, et refuse une table protégée (c). Un formulaire de Form+ peut garder la liste des choix dans sa propre définition au
      moment de la publication, et le lien ne lit alors aucune autre table (à mesurer) ; pour un formulaire natif de Grist, ce n'est
      pas possible.
5. [T] **Ce qu'une app fait d'une ligne reçue.** Elle la traite comme du texte non fiable : elle l'échappe, ne la prend jamais pour
   du code, une formule ou une adresse de script (comme 10.9 pour un modèle), et ne croit aucune colonne d'auteur ni de date.
   [D] Elle ne lance aucun envoi, workflow ni document à partir d'elle sans le geste d'une personne (11.6, point 9).
6. [D] **Ce que l'accord à la publication dit**, dans cet ordre, en mots simples : que le lien est **public** et que toute personne
   qui l'a peut écrire ; les **tables** qu'il remplit ; les **colonnes qu'il pourrait remplir sans les montrer** ; les **colonnes
   qu'il rend lisibles** (Références) ; que **rien ne limite** le nombre de lignes qu'il ajoute ni ne contrôle ce qu'elles
   contiennent ; comment le fermer. Si une table est protégée (point 4c), il n'y a pas d'accord : la publication est refusée,
   avec la raison.
7. [D] **Qui ouvre et ferme une porte.** Seul un propriétaire publie ou dépublie un formulaire, comme dans l'interface de Grist
   (lu). Une app n'écrit jamais `_grist_Shares` ni `_grist_Pages.shareRef` (3.3, point 6) : partager la page est un geste de la
   personne, dans Grist. Ce qu'une app écrit, c'est ce qui rend un formulaire publiable (une colonne, une section et ses champs :
   les tables que juge 3.3, point 9), et GFS le tient lui-même : le courtier ne laisse passer ce lot que pour un propriétaire connu
   (`contexte.role.proprietaire` vrai), après l'accord. C'est un refus de plus que Grist n'en fait (structure ouverte, un éditeur
   peut écrire ces tables, même si son interface ne lui montre pas « Publier »), jamais une permission de plus : l'exception à 11.6,
   point 4 tient parce que c'est le courtier, non l'app, qui décide. Pas encore codé : GFS ne connaît pas le rôle de la personne
   (5.2, point 8).
8. [T] **Voir toutes les portes, d'où qu'elles viennent** (codé le 04/11, étape 6). Un propriétaire peut publier par l'interface de Grist, sans GFS, donc
   sans accord. Le panneau « Permissions » (en lecture) liste **tous** les partages du document, publiés ou non (lecture de
   `_grist_Shares`, `_grist_Pages`, `_grist_Views`, `_grist_Views_section` et ses champs) : la page qui porte chacun, la table qu'il remplit et son nombre de lignes, les colonnes qu'il peut
   remplir **sans les montrer**, celles qu'il rend lisibles, et, en rouge, une table de GFS ou d'une app qu'il ouvrirait (point 4c). **La clé du lien n'est jamais lue ni montrée** (mesuré : un lecteur dont le
   widget a l'accès complet la lit dans `_grist_Shares`, faits vérifiés, 40). Seul un propriétaire **prouvé** (5.2, point 8) les voit ; toute autre personne lit « seul un propriétaire voit les liens publics », et
   GFS ne lit alors aucune de ces tables. Il rattrape ce que l'accord (3.3, point 9) ne voit pas : un formulaire publié depuis l'interface de Grist, ou avant le 22/10 (3.7, point 8). [M] Joué dans un vrai Grist avec un partage posé
   par action (une page partagée, une section marquée `publish` et `form`) ; **pas mesuré** avec un formulaire que l'interface de Grist a publié ni avec les adresses statiques de Form+ (`#form=`, point 2 de l'état de Form+).
   Fermer ou renouveler un lien depuis GFS est une écriture : étape 7 (11.7, point 10).
9. [T] **Ce que GFS ne sait pas faire** : limiter le nombre ou le débit des lignes d'un lien, valider une valeur, reconnaître un
   robot. Grist n'offre rien de tel pour un partage et GFS n'est pas là quand son widget est fermé. La seule parade immédiate est
   de fermer le lien. Un contrôle fait dans la page d'un formulaire (champ obligatoire, longueur) est un confort : un lien s'écrit
   sans la page (11.1, point 1).
10. [T] **Rien de sensible chez un visiteur.** Ce qu'une app range dans les réglages d'un widget ou dans une table interne peut se
    lire dans la session d'un visiteur (10.11). Une app qui publie n'y range que ce que le lien peut lire sans dommage : la
    définition de **son seul formulaire**, jamais celle des autres ni les clés de leurs liens.
