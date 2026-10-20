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
| `run-ouvrir` | GFS demande à l'app déjà ouverte d'ouvrir le fichier cliqué (contrats 5.4) : la sonde O (`sondes/o-ouvrir/`) répond comme Publipostage+ (consigne 010) ; double-clic, « Nouveau », annulation, erreur, appel inconnu, attente ; l'ouverture n'est rendue qu'une fois (contrats 5.2, point 3) : le cadre de la sonde, rechargé sur place, redemande son contexte et n'y retrouve ni le fichier ni le « Nouveau » |
| `run-ouvrir-publipostage` | la même porte avec la vraie Publipostage+ (la version que GFS référence) : le double-clic lance l'app sur le modèle cliqué, avant le ★ ; l'app déjà ouverte change de modèle sans se recharger ; la question « Enregistrer / Abandonner / Annuler » dans le panneau (GFS attend sans rien dire) ; un fichier d'un dossier ; « Nouveau » ouvre un modèle vierge du type (le document au démarrage ; la grille, l'e-mail et le macro-modèle app ouverte), avec la question d'enregistrement quand des modifications attendent et sans que GFS dise rien ; le cadre rechargé sur place, après l'enregistrement du modèle vierge, reprend l'ordre habituel de l'app et ne rouvre pas de modèle vierge ; le rechargement que l'app veut elle-même (Réglages > Déclencheur > « Recharger maintenant », à partir de `dc00b9d`) la ramène sur le modèle où la personne était, l'adresse du cadre redevient celle de GFS, et son choix de langue est grisé dans GFS (à partir de `f6d3fd0` : la langue est celle de GFS, cf. `run-langue-publipostage`) ; rien d'écrit par l'ouverture. L'enregistrement automatique de l'app (2,5 s) peut passer entre la frappe et la demande : l'essai recommence alors (huit fois au plus) |
| `run-langue` | le choix de langue de GFS (contrats 5.2, point 6) : le bouton « Langue » et son menu à la souris et au clavier, tout l'explorateur dans l'autre langue, la clé `gfs.langue` retenue et suivie au rechargement ; la sonde L (`sondes/l-langue/`) reçoit la langue (adresse, contexte, événement `langue`) sans que son cadre soit rechargé, et rien quand le choix redit la langue de Grist ; un navigateur qui refuse de retenir ; une seconde section de GFS qui change la clé (événement `storage`) ; `LAB_W=420` : la vue étroite, où le bouton ne garde que son icône |
| `run-langue-publipostage` | le choix de langue de GFS avec la vraie Publipostage+ (consigne 019 ; contrats 5.2, point 6) : l'app démarre dans la langue de GFS, grise ses cases de langue avec la phrase qui dit où choisir, se recharge dans l'autre langue quand GFS change la sienne en rouvrant le même modèle (l'adresse de son cadre garde la langue de sa création, rien n'est écrit dans le document), rattrape la langue de GFS après un F5, pose sa question « Enregistrer / Abandonner / Annuler » derrière l'explorateur (cadre caché et inerte) et la tient dans le panneau quand on le ferme (« Annuler », « Abandonner », « Enregistrer ») ; une langue redite ne pose aucune question. **Elle demande l'app à `f6d3fd0` ou après** (la référence de GFS depuis le 20/10) : avec une version plus ancienne (`dc00b9d`), l'app ne lit pas `contexte.langue` et la passe s'arrête dès le départ en le disant |
| `run-sans-cdn` | une extension dont la bibliothèque n'a pas de CDN (un fichier assemblé par un GFS qui n'épingle aucun commit de son dépôt public, contrats 2.6 point 11) dans la fenêtre « Apps et extensions » : le CDN grisé avec la raison, la copie de GFS choisie, rien d'écrit sans un geste, l'extension du graphique inchangée. Les données sont les vraies (l'extension « Édition collaborative » de Publipostage+ et `edition-live` du catalogue), sauf une, pour cet essai seulement : son catalogue retire l'adresse du CDN d'`edition-live` ; à la vraie souris, `LAB_LANG` et `LAB_SCHEME` |
| `run-edition` | l'écriture en direct de Publipostage+ de bout en bout, avec les vraies données : la fenêtre « Apps et extensions » coche « Édition collaborative », l'app reçoit le fichier assemblé `edition-live` (adresse, empreinte, forme « module »), ne le demande qu'au premier clic, le charge dans son sous-cadre isolé sous sa politique, et le direct démarre par le menu de l'app ; la table `Publipostage_Direct` naît par le courtier, se remplit à la frappe et se vide à l'arrêt. Autour de cela, l'essai compte et chronomètre ce que l'app lit toute seule pour son entrée automatique (contrats 5.5, point 7) : la liste des tables sans la table du direct, rien de la table juste après l'arrêt par la personne, la table du direct une fois le modèle rouvert. Cinq parties : la copie de GFS (le cas qui marche) ; une fausse empreinte de la copie, le navigateur refuse le fichier et l'app le dit ; le CDN par défaut (jsDelivr, au commit épinglé) quand la politique de l'app ne nomme pas son adresse, le navigateur de l'app la refuse, l'app le dit et « Copie de GFS » remet le direct en marche ; le CDN quand la politique nomme l'adresse exacte du catalogue (ce que la consigne 016 demande à l'app), le direct démarre par jsDelivr avec l'empreinte contrôlée ; une fausse empreinte du CDN, refusée. Le labo n'atteint pas jsDelivr : à l'adresse du CDN du catalogue, son miroir rend les octets exacts de la copie de GFS (même empreinte), avec le type JavaScript et l'en-tête CORS ; `--verifier-cdn` de l'outil des bibliothèques mesure le vrai CDN. Il faut l'app à la référence de GFS dans `prototype/apps/publipostage/` et son miroir (`build-mirror.sh`) |
| `run-diapositives` | les présentations de Publipostage+ (extension « Diapositives », type « Présentation ») avec la vraie app, de bout en bout, à la vraie souris : éteinte (le défaut), la ligne « Nouvelle présentation » du menu « + » est grisée avec sa raison et son clic ouvre la fenêtre de GFS sur la ligne « Diapositives » (sans bibliothèque : pas de mode à choisir ; sa taille, ≈ 36 Ko, est celle du manifeste) ; cochée, l'app la reçoit sans rien charger, une présentation vierge s'ouvre à la page 16:9 en paysage et s'enregistre sous le type « presentation » ; l'explorateur la connaît (famille orange, pastille, menu « Nouveau »), son double-clic ouvre l'app (au démarrage, puis par l'appel `ouvrir` quand l'app est déjà ouverte) ; « Nouveau » > « Présentation » de l'explorateur ouvre une présentation vierge dans l'app déjà ouverte, sans rien écrire ; l'extension charge sa bande des diapositives (un script et une feuille de style du dossier de l'app, rien d'une autre adresse) ; éteinte de nouveau, elle reste dans la liste, grisée avec sa raison, la présentation ouverte reste ouverte et s'enregistre toujours sous son type. Il faut l'app à la référence de GFS dans `prototype/apps/publipostage/` et son miroir (`build-mirror.sh`) |
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
