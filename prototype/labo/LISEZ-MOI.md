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

Variables utiles : `LAB_LANG=fr|en`, `LAB_SCHEME=light|dark`, `LAB_BROWSER=chromium|firefox|webkit` (les deux derniers : sur une machine qui les a),
`LAB_CONSOLE=error|all` (la console du navigateur), `LAB_BYPASS_CSP=1` (diagnostic seulement, jamais une mesure).

## Les essais

| Essai | Ce qu'il mesure |
|---|---|
| `run-slice1`, `probe-app`, `run-automation` | GFS ouvre Publipostage+ (la version que GFS référence, qui parle à GFS) et Automation+ (non modifiée) dans un sous-cadre isolé : leurs tables, ce qu'elles voient, ce que le courtier leur refuse |
| `run-explorer`, `run-modules` | l'explorateur et la fenêtre « Apps et extensions » (interface) |
| `run-courtier` | le courtier avec le vrai script d'API de Grist : rejeu, `configure`, jeton, noms de tables |
| `run-capacites` | ce qu'une app peut faire dans son sous-cadre (stockage, impression, téléchargements, fenêtres, presse-papiers, navigation) ; `CAP_CONFIG=grist` : la même sonde sans GFS |
| `run-impression` | « Print widget » de Grist relayé à l'app active |
| `run-ordre`, `run-routeur` | l'ordre des écouteurs de `message` (le routeur de GFS) |
| `run-politique` | peut-on imposer une politique de sécurité du contenu à un sous-cadre servi sans en-tête (attribut `csp`, `srcdoc`, `blob:`) ? Sans Grist : la question est celle du navigateur |
| `run-acces-none`, `run-reconstruit` | GFS sans l'accès complet ; le cadre que Grist reconstruit quand le niveau d'accès change |
| `run-cout-cadre`, `run-heavy` | le coût d'un cadre de plus ; la lecture des fichiers dans un document lourd |
| `run-sondes` | la bibliothèque d'une extension (CDN et copie de GFS) sous six politiques d'app ; la matrice du rapport (mesure 4) est vérifiée, ligne par ligne |
| `run-navigateur` | la page `navigateur/` jouée à la souris (voir plus bas) |
| `run-reel` | la sonde `reel/`, avec un répondeur REST de remplacement pour la tuyauterie (`rest-standin.mjs`) |

Les sondes (`sondes/`) sont des apps d'essai que GFS ne connaît pas : elles n'entrent dans le catalogue que pour la page du labo qui le demande.

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
