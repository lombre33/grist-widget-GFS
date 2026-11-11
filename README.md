# Grist Factory Suite (GFS)

GFS est un widget personnalisé de Grist qui héberge les apps Grist Factory (Publipostage+, Form+, Automation+, Grist-BI, puis
Dashboard et Thusday). Il installe les apps, en fait tourner une à la fois dans un sous-cadre isolé, et ajoute un explorateur de
fichiers toujours présent pour passer de l'une à l'autre. Licence : GPL 3.0 (`LICENSE`).

*English, in short: GFS is a Grist custom widget that runs the Grist Factory apps one at a time, each in a sandboxed iframe, and
adds a file explorer. It asks for `full` access to the document; everything it reads, writes and contacts is listed below.*

## À quoi sert GFS

- **Un courtier** : seul à parler à Grist, il relaie l'API des widgets vers l'app ouverte et ne laisse passer que ce que le
  manifeste `gfs.json` de l'app déclare (tables lues, tables écrites, clés de réglages ; les tables `_grist_*` sont refusées sauf
  déclaration).
- **Un explorateur de fichiers** : les fichiers de toutes les apps (un modèle, un formulaire, un automatisme…) au même endroit,
  avec dossiers, corbeille, copie, glisser-déposer et annulation.
- **L'installation des apps et des extensions** : une extension est une fonction d'une app qui demande une bibliothèque lourde
  (graphique, présentations, édition en direct) ; GFS la porte, l'app seule la grise sans la cacher.
- **Le partage** : droits par fichier d'après les règles d'accès de Grist, et envoi d'un fichier à un autre document Grist qui a GFS.

Une app est un dépôt public complet, qui tourne aussi seule ; GFS la **référence** à un commit (sous-module Git), sans copie.
Le cahier des charges est dans `docs/cahier-des-charges-gfs.md`, les contrats entre GFS et les apps dans `docs/contrats.md`.

## Configurer GFS dans Grist

1. Dans Grist, ajoutez un widget **Personnalisé**.
2. Dans le champ « URL » du panneau de droite, collez l'adresse de la page :
   `https://lombre33.github.io/grist-widget-GFS/prototype/index.html` (jamais par la galerie de widgets).
3. Choisissez l'accès **« Accès complet au document »** (`requiredAccess: 'full'`).
4. Au premier lancement, GFS propose les apps à installer ; rien n'est créé dans le document sans l'accord de la personne.

Pour servir GFS chez soi : les pages sont statiques, sans étape de construction (`prototype/` à publier tel quel, sous-modules
inclus). Les essais se lancent par `npm ci && npm test` dans `prototype/`.

## Accès au document : pourquoi `full`

GFS ne sait pas d'avance quelles tables lit chaque app : il lit les tables et les métadonnées (`_grist_Tables`, droits, partages,
pages) pour appliquer le manifeste de l'app ouverte, et il écrit dans les tables des apps ce que leur manifeste déclare. Un niveau
inférieur ne laisse pas passer cela.

- **Lu** : les tables que l'app ouverte déclare lire, les métadonnées `_grist_*` utiles à l'explorateur, aux droits et au partage.
- **Écrit, avec l'accord de la personne** : les tables de GFS, préfixées `GFS_` (`GFS_Rangement`, `GFS_Fichiers`, `GFS_Corbeille`,
  `GFS_Recus`, `GFS_Placement`, `GFS_Partages`, `GFS_Notifications`) ; les tables que l'app ouverte déclare écrire.
- **Structure** : des changements additifs (ajout d'une table ou d'une colonne), et jamais l'écriture d'une colonne absente. Une
  seule exception : quand Grist donne à une table créée par une app un nom que son manifeste ne permet pas, le courtier la retire
  (ou lui rend son nom) et le dit (`prototype/js/broker/broker.js`).
- **Lignes** : les gestes de la personne (corbeille, « Supprimer définitivement », dossiers, partages) écrivent et retirent des
  lignes dans les tables de GFS et dans celles des apps que leur manifeste déclare.
- **Règles d'accès** : écrites (et retirées) seulement quand le propriétaire active ou arrête le partage, après une fenêtre qui
  dit ce qui va changer.
- **Réglages de la vue** : jamais écrits sans un geste de la personne ; les clés de GFS sont préfixées `gfs.`.

## Dépendances et hôtes externes

GFS n'embarque aucune bibliothèque à l'exécution : modules ES, HTML et CSS, sans framework (`prototype/js/`). Les dépendances de
développement (`acorn`, `esbuild`, `grain-rpc`) ne servent qu'aux essais et aux outils (`prototype/package.json`).

La politique de sécurité du contenu de la page (`prototype/index.html`, `connect-src 'self'`) n'ouvre que ces adresses :

| Hôte | Pour quoi | Quand |
|---|---|---|
| `docs.getgrist.com` | `grist-plugin-api.js`, le script que tout widget Grist charge (adresse entière dans la politique) | au démarrage |
| `cdn.jsdelivr.net` | les bibliothèques des extensions (Plotly, ECharts, édition en direct), avec leur empreinte SRI ; une copie vendorisée est dans `prototype/vendor/` pour un réseau fermé | quand une extension est activée |
| `www.youtube-nocookie.com`, `player.vimeo.com` | le cadre du lecteur de vidéos d'une app qui l'a déclaré | au clic sur le bouton de lecture |

GFS lit ses propres manifestes et catalogues par chemin relatif (`fetch`, même origine) ; il ne charge jamais de code depuis une
adresse lue dans des réglages, une table ou un message. Les apps tournent dans des sous-cadres `sandbox` sans `allow-same-origin`,
d'origine opaque : c'est pourquoi les messages vers elles s'envoient avec la cible `'*'`, et se reçoivent après vérification de
`event.source`.

## Stockage dans le navigateur

Le `localStorage` ne garde que des préférences d'affichage et l'espace que GFS tient pour chaque app (qui n'a pas de stockage
propre dans son sous-cadre), notamment : `gfs.langue`, `gfs.theme`, `gfs.couleur`, `gfs.barre`, `gfs.premier-lancement.<document>`,
`gfs.stockage.<app>.<clé>`, `gfs.synchro.*`. Aucune donnée du document n'y est écrite, et GFS fonctionne sans lui (chaque accès
est dans un `try/catch`).

## Sécurité

Pour signaler une vulnérabilité, lisez `SECURITY.md` : pas d'issue publique avant correction.

## Carte du code

| Où | Quoi |
|---|---|
| `prototype/index.html`, `prototype/css/` | la page (politique de sécurité, carte d'importation écrite par `outils/versions.mjs`), les feuilles de style |
| `prototype/js/gfs.js`, `controller.js`, `entries.js`, `openings.js` | le démarrage et le contrôleur (apps, ouvertures, fichiers) |
| `broker.js`, `filter.js`, `rpc.js`, `envelope.js`, `router.js`, `session.js`, `frames.js` | le courtier : protocole de l'API des widgets, filtre d'après le manifeste, sous-cadres |
| `manifest.js`, `catalogue.js`, `libraries.js`, `extensions.js`, `app-*.js` | les manifestes `gfs.json`, le catalogue des apps, les bibliothèques et les extensions |
| `explorer*.js`, `files-store.js`, `rangement.js`, `gfs-trash.js`, `undo-stack.js` | l'explorateur, le rangement, la corbeille, l'annulation |
| `sharing-model.js`, `share-*.js`, `rights-*.js`, `sync-*.js`, `received-*.js`, `transfer.js` | le partage, les droits, l'envoi vers un autre document, le transfert des pièces jointes |
| `modal.js`, `menu.js`, `layers.js`, `*-window.js`, `dom.js`, `icons.js` | les fenêtres, les menus et leur empilement |
| `theme*.js`, `ambiance*.js`, `oklch.js`, `i18n*.js`, `language.js` | le thème, les couleurs, les textes en français et en anglais |
| `prototype/manifestes/`, `prototype/bibliotheques/`, `prototype/vendor/` | un manifeste par app, la liste des bibliothèques, leurs copies vendorisées |
| `prototype/apps/`, `prototype/kit/` | les apps et le kit commun (sous-modules Git, jamais copiés) |
| `prototype/test/` | les essais (`node --test`), avec Firefox pour les interfaces |
| `prototype/labo/` | les essais dans un vrai Grist (Docker), joués à la main ; la page de GFS n'en charge aucun |
| `docs/`, `consignes/` | cahier des charges, contrats, guide des apps, faits vérifiés ; les consignes aux projets des apps |

## Audit

Le dépôt s'audite avec `grist-widget-audit` (`lombre33/Grist-widget-audit`). Ce que l'outil signale et qui est voulu :
le script d'API de Grist chargé depuis `docs.getgrist.com` (adresse entière dans la politique) ; l'accès `full` (voir plus haut) ;
`postMessage(…, '*')` vers un sous-cadre d'origine opaque ; les gestionnaires `message` qui vérifient `event.source` ; les
préférences d'affichage dans le `localStorage` ; l'axe dynamique lu sans les sous-modules du kit, dont une feuille de style manque.
