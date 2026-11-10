# 063 · Ta liste unique des bibliothèques (`package.json` à la racine) et l'outil du kit qui en refait la carte d'importation, la politique de sécurité, les empreintes et le miroir des essais (étape 4 du plan)

App : Publipostage+ · posée le 10/11/2026 · quand : au prochain lot, sans urgence ; **ton code ne change pas** (aucune page, aucun module), seuls changent `index.html` (la carte d'importation et le `script-src`), un `package.json` nouveau, le miroir de tes essais et un fichier de Dependabot · décision du porteur : étape 4 du plan (10/11), guide des apps 1.2 point 3 et 2.3

## Quoi

**Aujourd'hui, une même bibliothèque est écrite à cinq endroits** : la carte d'importation d'`index.html` (chaque version trois ou quatre fois pour ProseMirror), la politique de sécurité (une adresse par script, plus l'empreinte de la carte), les sept fichiers de `js/` qui écrivent `{ src, integrity }`, `dev-tests/.offline-cache/package.json` et les deux listes de `dev-tests/.offline-cache/build.mjs`. L'étape 4 les réduit à **une liste** et à un outil, dans le kit (0.16.0, `4e9113a`, mode d'emploi : son `README.md`, « Les bibliothèques d'une app »).

**1. Pose la liste.** GFS a rejoué l'outil sur une copie de ton dépôt à `ac9b86d` (rien n'est poussé chez toi) : la liste qui marche est [`063-liste-package.json`](063-liste-package.json), à copier à la racine de ton dépôt en `package.json`. Elle est tirée de ton `index.html`, de ton `build.mjs` et de tes sept fichiers, rien d'inventé : `dependencies` (41 paquets : ce que la page charge), `devDependencies` (esbuild, jsqr, pdfjs-dist, echarts : seuls les essais les lisent), et la section `gfs` :

- `bibliotheques` : les neuf fichiers que ta page charge (docx et ses graphiques, exceljs, jszip, marked, pdf-lib, pdfmake et ses polices, qrcode-generator), chacun soit `fichier` d'un paquet npm (jsDelivr), soit `src` (cdnjs, avec la version dans l'adresse) ;
- `politique.scriptSrc` : ce que **tu** écris à la main (`'self'`, `'unsafe-eval'` que l'API de Grist exige, `https://esm.sh`, le script d'API de Grist, et les deux adresses que GFS te donne pour ses extensions : Plotly et ECharts) ; `index.html` garde sa balise, ses autres directives et ses commentaires ;
- `carte` : la carte d'importation (52 entrées : les deux du kit, 34 paquets dont 16 « uniques », les 13 sous-chemins de `@tiptap/pm`, les 3 plages) ; **une version ne s'écrit plus qu'une fois**, dans `dependencies` ;
- `code` : `js` et `extensions`, que l'outil lit pour accorder les empreintes `{ src, integrity }` au catalogue ;
- `miroir` : où poser le miroir de tes essais et les fichiers à y copier (les treize que ton `build.mjs` copie, les 33 modules de ta carte, sauf `@tiptap/pm`).

**2. Lance l'outil depuis la racine de ton dépôt**, avec le kit à `4e9113a` ou après. Ton `kit/` peut rester à `8afa569` : l'outil n'est jamais chargé par ta page ; lance-le depuis un clone du kit (`node ../grist-factory-kit/outils/bibliotheques.mjs --racine .`), ou avance ta référence du kit si tu le veux (un autre lot, c'est ta décision). La première passe écrit `bibliotheques/catalogue.json` (les neuf adresses avec leur empreinte : celles de tes sept fichiers, que l'outil **ne change pas** : mesuré, le catalogue et ton code disent déjà les mêmes), réécrit la carte d'importation et le `script-src` d'`index.html` : **c'est le seul fichier de ton app qui bouge**, et il bouge de forme seulement (l'ordre des entrées de la carte, les retours à la ligne du `script-src` : l'outil les fixe ; **mêmes 52 entrées avec les mêmes valeurs, mêmes adresses de script, mêmes empreintes de scripts en ligne**, sauf celle de la carte, qui change avec sa mise en forme et que l'outil réécrit dans la même passe). Une deuxième passe ne change plus rien.

**3. Refais le miroir par l'outil** : `node <kit>/outils/bibliotheques.mjs --miroir` remplace `dev-tests/offline-deps.sh` et le gros de `build.mjs`. Mesuré par GFS : sur ton `ac9b86d`, le miroir qu'il refait est **identique octet pour octet** à celui de ton `build.mjs` (55 fichiers de modules, 13 copies, `esm-map.json`, mêmes paquets aux mêmes versions). **Garde de ton `build.mjs` les deux blocs qui assemblent `edition-live` et `pdfjs`** (`edition-live.json`, `pdfjs-gfs.json`) dans un petit script à part : l'outil ne sait pas les construire, GFS les reprendra au lot suivant (il en a l'assemblage), et ta ligne dans `docs/apps.md` le dira.

**4. Dependabot (`npm`) à la racine.** Une proposition change une version dans la liste ; tu relances l'outil dans le même lot, il réécrit tout le reste (carte, politique, catalogue, empreintes). `--verifier` (sans réseau) dit ce qui manque, et peut devenir un de tes essais.

**5. Pas demandé** : retirer tes propres contrôles de `dev-tests/verify-code-hygiene.mjs` (section 11 : empreintes de la politique, adresses permises) : ils continuent de servir de filet, tu les retireras quand l'outil sera le tien ; la copie vendorisée de ton app (le CDN reste le défaut, le vendorisé vient si un RSSI l'exige) ; TipTap en un seul fichier figé (une question au porteur, pas encore tranchée : une consigne à part suivra).

## Pourquoi

Étape 4 du plan (cahier, section 10 : « import map, politique, empreintes et miroir des tests régénérés à l'identique depuis la liste »). Une montée de ProseMirror aujourd'hui, c'est une version à retoucher à la main à plusieurs endroits de la carte, puis l'empreinte de la carte dans la politique, qu'un oubli rend invisible jusqu'au jour où la page refuse de démarrer chez le porteur (ton propre contrôle de 04/10 le dit). Avec la liste, on écrit la version une fois. Les mêmes outils servent les autres apps et la liste de GFS lui-même (l'outil de GFS reprend les primitives du kit).

## Fait quand

- `package.json` à la racine (la liste), `bibliotheques/catalogue.json` et un `index.html` régénéré sont dans ton dépôt ; **`<kit>/outils/bibliotheques.mjs --racine . --verifier` dit « liste, catalogue et politique cohérents »**, et une deuxième passe de l'outil ne change aucun fichier ;
- tes essais passent avec l'`index.html` régénéré : `codeHygiene`, et surtout **`cspLoad`** (la vraie politique dans un navigateur, sans contournement : le widget démarre, exporte, charge ses bibliothèques) ; GFS n'a rien mesuré dans un navigateur sur cette page, seulement les fichiers ;
- le miroir refait par `--miroir` fait passer ta suite comme avant ;
- Dependabot `npm` à la racine est activé ;
- ta page d'état le dit (une ligne sous « Changements qui touchent GFS » : la liste unique, la référence du kit utilisée) ; GFS passera la 063 à « faite » en la lisant. **Seul le porteur peut jouer `--verifier-cdn`** (cdnjs, jsDelivr et esm.sh ne répondent pas depuis le cloud de GFS ni, à notre connaissance, depuis le tien) : GFS le lui demandera, ce n'est pas un critère pour toi.
