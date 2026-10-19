# Le labo « vrai Grist »

Les mesures du prototype (étape 2 du plan) : GFS et ses apps tournent dans un **vrai Grist** (grist-static 0.1.6, dans Chromium), jamais contre un
faux Grist écrit par nous. Chaque essai se joue à la vraie souris et au vrai clavier (Playwright), à 700 × 400 quand il s'agit d'une interface.

## Lancer un essai

Il faut `node` (22), `npm` et Chromium avec Playwright (le conteneur du cloud les a).

```bash
cd prototype/labo
npm install                                                       # grist-static
bash build-mirror.sh                                              # Publipostage+ seulement : le miroir de ses bibliothèques de CDN
REPO_DIR="$(realpath ../..)" node lab-server.mjs &                # Grist sur 8910, GFS et les apps sur 8911
REPO_DIR="$(realpath ../..)" node run-ordre.mjs                   # un essai ; la sortie dit « OK » ou « ÉCHEC »
```

Le miroir ne construit que les bibliothèques de l'app. Celles que GFS porte (Plotly, pour le graphique) n'y sont pas : à leur adresse de CDN, le labo
rend la copie de GFS (`vendor/…`, nommée par `bibliotheques/catalogue.json`), qui a les mêmes octets et la même empreinte que le CDN.

L'attribut `integrity` des scripts est neutralisé (le miroir ne rend pas toujours les octets exacts du CDN), sauf dans les sondes et pour un script que GFS sert
lui-même (`vendor/…`) : là, le navigateur contrôle l'empreinte pour de bon, y compris pour un module dans un sous-cadre à origine opaque.

Variables utiles : `LAB_LANG=fr|en`, `LAB_SCHEME=light|dark`, `LAB_BROWSER=chromium|firefox|webkit` (les deux derniers : sur une machine qui les a),
`LAB_CONSOLE=error|all` (la console du navigateur), `LAB_BYPASS_CSP=1` (diagnostic seulement, jamais une mesure).

## Les essais

| Essai | Ce qu'il mesure |
|---|---|
| `run-slice1`, `probe-app`, `run-automation` | GFS ouvre Publipostage+ (la version que GFS référence, qui parle à GFS) et Automation+ (non modifiée) dans un sous-cadre isolé : leurs tables, ce qu'elles voient, ce que le courtier leur refuse |
| `run-explorer`, `run-modules` | l'explorateur et la fenêtre « Apps et extensions » (interface), dont la question de la table du document et son refus (contrats 7.4) |
| `run-rangement` | la table `GFS_Rangement` d'une autre version ou d'un autre auteur : colonne absente ajoutée, apps et champs inconnus gardés, ce qu'une autre section écrit entre deux gestes n'est pas défait |
| `run-ouvrir` | GFS demande à l'app déjà ouverte d'ouvrir le fichier cliqué (contrats 5.4) : la sonde O (`sondes/o-ouvrir/`) répond comme Publipostage+ (consigne 010) ; double-clic, « Nouveau », annulation, erreur, appel inconnu, attente |
| `run-ouvrir-publipostage` | la même porte avec la vraie Publipostage+ (la version que GFS référence) : le double-clic lance l'app sur le modèle cliqué, avant le ★ ; l'app déjà ouverte change de modèle sans se recharger ; la question « Enregistrer / Abandonner / Annuler » dans le panneau (GFS attend sans rien dire) ; un fichier d'un dossier ; « Nouveau » garde la phrase provisoire ; rien d'écrit par l'ouverture. L'enregistrement automatique de l'app (2,5 s) peut passer entre la frappe et la demande : l'essai recommence alors (huit fois au plus) |
| `run-sans-cdn` | une extension dont la bibliothèque n'a pas de CDN (un fichier assemblé par GFS, contrats 2.6 point 11) dans la fenêtre « Apps et extensions » : le CDN grisé avec la raison, la copie de GFS choisie, rien d'écrit sans un geste, l'extension du graphique inchangée. Les données sont les vraies (l'extension « Édition collaborative » de Publipostage+ et `edition-live` du catalogue), à la vraie souris, `LAB_LANG` et `LAB_SCHEME` |
| `run-edition` | l'écriture en direct de Publipostage+ de bout en bout, avec les vraies données : la fenêtre « Apps et extensions » coche « Édition collaborative », l'app reçoit le fichier assemblé `edition-live` (adresse, empreinte, forme « module »), ne le demande qu'au premier clic, le charge dans son sous-cadre isolé sous sa politique, et le direct démarre par le menu de l'app ; la table `Publipostage_Direct` naît par le courtier, se remplit à la frappe et se vide à l'arrêt. Seconde partie : une fausse empreinte dans le catalogue, le navigateur refuse le fichier et l'app le dit. Il faut l'app à la référence de GFS dans `prototype/apps/publipostage/` et son miroir (`build-mirror.sh`) |
| `run-diapositives` | les présentations de Publipostage+ (extension « Diapositives », type « Présentation ») avec la vraie app, de bout en bout, à la vraie souris : éteinte (le défaut), la ligne « Nouvelle présentation » du menu « + » est grisée avec sa raison et son clic ouvre la fenêtre de GFS sur la ligne « Diapositives » (sans bibliothèque : ni taille, ni mode à choisir) ; cochée, l'app la reçoit sans rien charger, une présentation vierge s'ouvre à la page 16:9 en paysage et s'enregistre sous le type « presentation » ; l'explorateur la connaît (famille orange, pastille, menu « Nouveau »), son double-clic ouvre l'app (au démarrage, puis par l'appel `ouvrir` quand l'app est déjà ouverte) ; éteinte de nouveau, elle reste dans la liste, grisée avec sa raison, la présentation ouverte reste ouverte et s'enregistre toujours sous son type. Il faut l'app à la référence de GFS dans `prototype/apps/publipostage/` et son miroir (`build-mirror.sh`) |
| `run-courtier` | le courtier avec le vrai script d'API de Grist : rejeu, `configure`, jeton, noms de tables |
| `run-select-by` | « Select by » et le mode lecture de Publipostage+ : la section de GFS suit une ligne choisie dans le tableau CLIENTS (panneau de droite de Grist, vraie souris) ; la ligne et le lien (`settings.linking`) arrivent à l'app, qu'elle s'ouvre après le choix ou qu'elle soit déjà ouverte, lien posé ou retiré. La sonde I (`sondes/i-lecture/`) s'abonne comme Publipostage+ ; puis le vrai Publipostage+ (`getCurrentRecord`, `getLinkState`) |
| `run-capacites` | ce qu'une app peut faire dans son sous-cadre (stockage, impression, téléchargements, fenêtres, presse-papiers, navigation) ; `CAP_CONFIG=grist` : la même sonde sans GFS |
| `run-impression` | « Print widget » de Grist relayé à l'app active |
| `run-ordre`, `run-routeur` | l'ordre des écouteurs de `message` (le routeur de GFS) |
| `run-politique` | peut-on imposer une politique de sécurité du contenu à un sous-cadre servi sans en-tête (attribut `csp`, `srcdoc`, `blob:`) ? Sans Grist : la question est celle du navigateur |
| `run-acces-none`, `run-reconstruit` | GFS sans l'accès complet ; le cadre que Grist reconstruit quand le niveau d'accès change |
| `run-section-ajoutee` | le cadre qu'une section de plus fait recharger : d'abord sans GFS (une sonde seule : le même élément `<iframe>`, un autre document), puis avec GFS et Publipostage+ ouverte (GFS repart de zéro, l'app est fermée ; contrats 3.1, point 6). Ajoute la section à la vraie souris, comme la première |
| `run-cout-cadre`, `run-heavy` | le coût d'un cadre de plus ; la lecture des fichiers dans un document lourd |
| `run-sondes` | la bibliothèque d'une extension (CDN et copie de GFS) sous six politiques d'app ; la matrice du rapport (mesure 4) est vérifiée, ligne par ligne |
| `run-navigateur` | la page `navigateur/` jouée à la souris (voir plus bas) |
| `run-reel` | la sonde `reel/`, avec un répondeur REST de remplacement pour la tuyauterie (`rest-standin.mjs`) |
| `run-direct` | comment un widget apprend qu'une autre table que celle de sa section a changé (contrats 5.5) : la prévenance de Grist, un relais par `BroadcastChannel`, la relecture `fetchTable` à 100, 250, 500 et 1 000 ms, un réseau simulé, la taille de la table. Trois widgets de `sondes/direct/` posés directement dans Grist (ce ne sont pas des apps de GFS), une seule page donc une seule horloge ; le réseau réel n'y est pas |

Les sondes (`sondes/`) sont des apps d'essai que GFS ne connaît pas : elles n'entrent dans le catalogue que pour la page du labo qui le demande. `sondes/direct/` fait exception : un widget que Grist reçoit tel quel, pour `run-direct`.

## Ce que seul ton navigateur ou ton Grist peut dire

Deux pages se publient avec le reste du dépôt (GitHub Pages) et se lancent d'un clic, sans rien installer. Elles ne servent qu'aux mesures.

1. **Ton navigateur** (Firefox, Safari, ou celui d'un client) : ouvre
   `https://lombre33.github.io/grist-widget-GFS/prototype/labo/navigateur/index.html`, laisse la page mesurer l'ordre des écouteurs, clique sur les boutons du
   cadre de haut en bas, réponds aux questions (un fichier arrivé ? une fenêtre ouverte ?), puis « Copier le résultat ». Aucun document Grist n'est touché.
2. **Ton vrai Grist** : dans un document de **test**, ajoute un widget personnalisé à l'adresse
   `https://lombre33.github.io/grist-widget-GFS/prototype/labo/reel/index.html`, accorde-lui l'accès complet (panneau de droite), note la version de Grist
   (menu Aide, « À propos de Grist »), lance la **lecture** (elle ne modifie rien), puis, si tu le veux, l'**écriture** (une confirmation te sera demandée : elle
   crée une table d'essai, joue dessus une vingtaine d'actions de Grist et la supprime), puis « Copier le résultat ». Le texte ne contient ni le jeton ni
   l'identifiant du document.

GitHub Pages met tout en cache dix minutes : après une mise à jour, recharge la page avec Ctrl+F5 (⌘⇧R sur Mac).

Pour refaire à la main, sur une machine qui a Firefox et WebKit de Playwright, ce que le cloud ne peut pas faire :
`npm install && npm install --no-save playwright && npx playwright install chromium firefox webkit`, lancer `lab-server.mjs`, puis
`LAB_BROWSER=firefox REPO_DIR=… node run-ordre.mjs`, de même pour `run-routeur.mjs`, `run-navigateur.mjs` et `run-politique.mjs`.
