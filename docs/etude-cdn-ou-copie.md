# Étude : CDN ou copie figée, au choix, pour les bibliothèques de chaque app (10/11/2026)

Étude, **rien n'est codé**. Elle répond à Antoine (10/11, 20:45) : « pour chaque [bibliothèque] on propose via CDN ou via copie figée, faire pareil, au choix dans le menu app, y compris pour Publipostage+ » ;
il a refusé l'un-ou-l'autre de la carte sur TipTap (esm.sh ou fichier figé). Deux cartes attendent son choix : où ranger la copie, à quelle échelle choisir. Les captures
(`maquette-*.png`, rendues avec le vrai code de la fenêtre « Apps et extensions », sans les textes que le code n'a pas encore) sont à côté de ce fichier dans les fichiers du projet.

## Mise à jour du 11/11 : les deux cartes sont répondues

Le porteur a choisi **« Chez GFS, comme pour Plotly »** (A ; le conseil B de l'étude, §3, n'est donc pas retenu) et **« Fonction par fonction »** avec le raccourci « toutes » (§4). Ce qui en découle, construit le même jour :

- **Lot 1 (copies chez GFS)** : neuf bibliothèques natives de Publipostage+ dans `prototype/vendor/` (5,1 Mo), entrées `natifDe: "publipostage"` de la liste de GFS dont **la version suit celle de l'app** (Dependabot les ignore, un essai le garde) : la dérive de version du §3 se règle par la demande de l'app (circuit « Demandes à GFS »), et par la comparaison de `version` côté app (contrats 5.2, point 12) qui retombe sur son CDN. Faits vérifiés 92.
- **Lot 2 (la fenêtre et ce que l'app reçoit)** : une ligne « Bibliothèques de l'app » par app dont le manifeste déclare `natives` (fonctions : bibliothèques et version), détail par fonction replié, clés `natif:<fonction>` dans `modes`, champ `natives` du contexte et de l'événement `extensions`, `GfsLink.native(id)` dans le kit 0.18.0. Mesuré dans un vrai Grist avec la vraie Publipostage+ et sous Firefox (faits vérifiés 93).
- **Reste** : (3) la **consigne à Publipostage+** (groupes, lecture de `natives`, comparaison de `version` ; seule, sans GFS, l'app n'a pas la copie : elle reste au CDN, conséquence du choix « chez GFS »), après la 063 ; GFS ne déclare `natives` dans son manifeste qu'une fois l'app prête, pour ne pas montrer un choix sans effet ; (4) **l'éditeur** : sa copie est une carte d'importation (§5) et, avec la copie chez GFS, le texte de la carte porte l'adresse de GFS, que la politique de l'app doit nommer par empreinte : carte posée au porteur (copie dans le dépôt de l'app, chez GFS avec l'adresse nommée par l'app, ou éditeur au CDN seulement) ; rien n'est codé pour l'éditeur avant sa réponse.

## En bref

- **Ce qui existe** : le choix « Depuis un CDN / Copie de GFS » est fait **par extension** (cahier, question 11 ; `prototype/js/extensions.js:31`, `prototype/js/modules-window.js`, `prototype/css/modules.css:71-79`), pour 4 bibliothèques que GFS porte (Plotly, ECharts, l'écriture en direct, la lecture des PDF ; `vendor/` pèse 3,9 Mo). Les bibliothèques **natives** de Publipostage+ n'ont **aucune copie** : sept fichiers en CDN avec empreinte, TipTap et ProseMirror par esm.sh (sans empreinte possible).
- **Ce qu'il faut** : des copies figées des natives, un moyen pour l'app de savoir quel mode est choisi, les lignes dans la fenêtre d'Antoine, et l'outil qui fabrique et vérifie les copies depuis la liste (celle de la consigne 063 reste la source).
- **Où ranger la copie : dans le dépôt de l'app (conseillé, B).** Avant d'écrire cette étude, la carte conseillait « chez GFS » ; un fait nouveau a changé le conseil (§3) : la liste d'une app est montée par Dependabot, et une copie rangée ailleurs que dans le même lot reste en retard, sans bruit.
- **TipTap est le cas dur** : sa « copie » n'est pas un fichier mais une autre carte d'importation, et Firefox n'en prend qu'une par page (mesuré, §5). Faisable : la page choisit sa carte au démarrage, le mode lui arrivant par l'adresse du cadre ; changer le mode de l'éditeur recharge l'app.
- **Poids de toutes les copies de Publipostage+ : ≈ 6,0 Mo** (§2). Le CDN reste le mode par défaut.

## 1. Ce qui existe aujourd'hui

- Le réglage est un objet `modes` par app (`js/settings.js`) : `{ "<extension>": "cdn" | "vendorise" }`. Écrit tout de suite dans la table de GFS (jamais dans les réglages de la vue), rendu à l'app par l'événement `extensions` (contrats 5.2, point 4) avec, pour chaque bibliothèque, `{ src, integrite, forme }`.
- Une bibliothèque sans CDN n'a que la copie ; l'option CDN est alors grisée avec sa raison (`js/modules-window.js`, `noCdn`).
- Décision d'Antoine du 14/10 (contrats 2.6, point 4) : **l'éditeur et les exports restent natifs, avec leurs bibliothèques dans la liste de l'app**. La demande du 10/11 ne la remet pas en cause : elle ajoute un choix de mode ; elle dit seulement que la copie ne peut plus être « celle de GFS » pour les natives sans la contredire.

## 2. Ce que Publipostage+ charge lui-même (mesuré sur le miroir de l'outil du kit, 10/11)

| Fonction | Bibliothèques | Octets | Mo |
|---|---|---|---|
| Éditeur | TipTap + ProseMirror (esbuild, fichiers partagés : une instance de chaque) | 1 172 757 | 1,1 |
| Export PDF | pdfmake, ses polices, JSZip | 2 253 613 | 2,1 |
| Export Word | docx, docx-charts | 1 277 148 | 1,2 |
| Export Excel | ExcelJS | 947 702 | 0,9 |
| Divers | pdf-lib, marked, qrcode-generator | 621 696 | 0,6 |
| **Total** | | **6 272 916** | **≈ 6,0** |

Chargées à la demande (le PDF seulement au premier export PDF), sauf l'éditeur, lancé au démarrage (`js/main.js:2594`).

## 3. Où ranger la copie

| | A. Chez GFS (`vendor/`, comme Plotly) | B. Dans le dépôt de l'app |
|---|---|---|
| Dérive de version | **Oui** : l'app monte docx (Dependabot de sa liste) ; la copie de GFS reste à l'ancienne version jusqu'à ce que GFS la refasse, et l'app retombe en CDN sans le dire | **Non** : l'outil refait copies, carte, politique et empreintes dans le même lot que la liste |
| Contrats 2.6, point 4 (14/10) | Contredit : des natives dans la liste de GFS | Respecté : la copie suit la liste |
| App seule (hors GFS) | CDN seulement | Les deux modes (choix dans son propre menu) |
| Origine du fichier | Même origine que l'app seulement tant qu'elles sont servies par le même site | Même origine par construction (`'self'`, rien à nommer dans la politique) |
| Poids | +6 Mo chez GFS pour une seule app | +6 Mo dans le dépôt de l'app |
| Qui écrit | GFS seul ; l'app n'a qu'à demander | L'app commite ses copies (consigne, elle ne reçoit rien de GFS) |
| Vérifiable dans le cloud | Oui (npm est joignable) | Oui (l'outil relit chaque copie dans l'archive npm) |

**Conseil : B.** A est plus simple pour l'app mais demande un aller-retour à chaque montée de version et contredit une décision d'Antoine ; B reprend la règle du cahier (« celle de l'app pour ses bibliothèques natives ») et ne coûte à l'app que ce que son outil fait déjà (le miroir des essais contient ces mêmes fichiers).

## 4. L'échelle du choix et où il est retenu

- **Un choix par app** (maquette 1) : une seule ligne dans la fenêtre. Simple, mais Antoine dit « pour chaque ».
- **Fonction par fonction, avec un raccourci pour toutes** (maquette 2, conseillée) : cinq lignes pour Publipostage+ (Éditeur, PDF, Word, Excel, Divers), état « mélange » au raccourci quand elles diffèrent. C'est le grain où l'app charge réellement (le PDF entier ou rien).
- **Une ligne par bibliothèque** : dix lignes au moins (neuf fichiers de bibliothèques et l'éditeur), sans rien de plus à choisir : pdfmake sans ses polices ne marche pas.
- **Retenu** : dans l'objet `modes` de GFS, clés de fonction à côté de celles des extensions ; écrit tout de suite, grisé en lecture seule avec la raison (comme aujourd'hui). GFS le dit à l'app dans l'événement `extensions` (champ à ajouter au contrat 5.2 ; une app qui ne le lit pas reste en CDN) et, pour l'éditeur, dans le fragment de l'adresse du cadre (§5). L'app seule garde le même choix dans son menu, clé `pp_*` par `person-store` ; **dans GFS, c'est celui de GFS qui compte** et la ligne de l'app est grisée avec la phrase qui le dit.
- **Mots** : « Copie figée » pour les deux (pour les extensions, « Copie de GFS » deviendrait « Copie figée », sinon une même chose a deux noms).

## 5. TipTap et la carte d'importation

- Aujourd'hui, 50 adresses `esm.sh` dans la carte de `index.html` (52 entrées avec les deux du kit), en script statique dont l'empreinte est dans la politique, et l'éditeur importe ses classes par noms nus (`js/editor.js`, `importLibraries`) dès le démarrage, avant la réponse de GFS (`GfsLink.ready`, `js/main.js:2663`).
- La copie existe déjà : le miroir de l'outil du kit fait un découpage esbuild (55 fichiers, 1,17 Mo) et `esm-map.json` donne le nom nu de chaque fichier. Un seul exemplaire de chaque paquet : c'est ce que la carte garantissait (les curseurs de l'écriture en direct en dépendent, faits vérifiés 9).
- **Le piège, mesuré le 10/11 : une page n'a qu'une carte.** Dans Firefox 160, une **seconde** carte d'importation est ignorée, qu'elle soit écrite dans la page ou posée par script, même avant tout `import()` (Chromium 153 la fusionne ; ce n'est donc pas une porte pour Firefox, le navigateur d'Antoine). En revanche une carte **posée par un petit script en ligne, quand la page n'en a pas d'autre**, marche dans les deux navigateurs, à condition que la politique nomme l'empreinte du texte exact de cette carte (sans elle, refusée).
- **Ce que cela donne** : la page ne porte plus de carte statique ; un script d'amorce (son empreinte dans la politique) choisit entre deux textes de carte, « éditeur en CDN » (esm.sh) ou « éditeur en copie » (fichiers de l'app), les entrées du kit étant les mêmes. La politique nomme l'empreinte des deux ; l'outil les calcule. Les autres fonctions (PDF, Word, Excel, Divers) n'ont pas de nom nu : une balise `<script src>` avec empreinte, choisie au chargement, sans carte.
- **Le mode doit être connu tout de suite**, avant la réponse de GFS : en app seule, un réglage local lu dans un `try/catch` (CDN si absent) ; dans GFS, GFS l'ajoute au **fragment de l'adresse du cadre** (l'app en lit déjà un pour rouvrir le bon modèle, `Settings.takeReopenId`). L'adresse du code reste calculée par GFS d'après le catalogue ; seul un mot de la liste `cdn` | `copie` voyage dans le fragment. **Changer le mode de l'éditeur dans GFS recharge donc l'app**, avec un avis qui le dit ; les autres fonctions changent au prochain chargement sans recharger. Aucun retard de démarrage de plus.
- En mode CDN, TipTap reste sur esm.sh sans empreinte, comme aujourd'hui (esm.sh refabrique ses fichiers : aucune empreinte ne tient) ; seule la copie figée donne à TipTap une empreinte vérifiable.

## 6. L'outil du kit

À ajouter à `kit/outils/bibliotheques.mjs` (0.17) : `gfs.groupes` (fonction → bibliothèques) ; `--copies`, qui écrit `vendor/<id>/<version>/…` (le fichier de l'archive npm, octet pour octet, plus le découpage esbuild de la carte) et, dans le catalogue de l'app, `copie: { chemin, integrite }` ; les deux textes de carte et leurs empreintes pour la politique ; `--verifier` relit chaque copie dans l'archive npm (faisable sans CDN). Les copies des fichiers assemblés d'une app (`edition-live`, `pdfjs`) restent dans son `build.mjs` : hors de cette étude.

## 7. Lots, si Antoine répond « B » et « fonction par fonction »

1. Kit 0.17 : groupes et `--copies`, avec ses essais (rejoués sur la copie de Publipostage+, comme pour la 063). Aucune ligne de GFS.
2. GFS : lignes de la fenêtre (maquette 2), clés `modes`, champ de l'événement `extensions`, fragment de l'adresse du cadre et rechargement de l'app, contrats 5.2, essais, mesure dans un vrai Grist sous Firefox. Chaque correction a son essai.
3. Consigne à Publipostage+ (après la 063) : groupes, chargeur qui lit le mode, script d'amorce qui pose la carte, copies commitées, ligne de son menu en app seule.
4. Form+, Grist-BI, Automation+ : à leur adoption de la liste, sans consigne de plus que la 063 + celle-ci.

Avec « A » : le lot 1 écrit les copies dans `prototype/vendor/` depuis la liste de chaque app, le lot 3 devient « l'app demande l'adresse à GFS », et la dérive (§3) reste à surveiller par un essai.

## 8. Pas mesuré

La carte posée par script dans la vraie page de Publipostage+ (mesurée seulement sur des pages d'essai, Firefox 160 et Chromium 153) ; les empreintes des copies face au CDN (cdnjs, jsDelivr et esm.sh sont refusés depuis le cloud) ; le poids des bibliothèques des autres apps.
