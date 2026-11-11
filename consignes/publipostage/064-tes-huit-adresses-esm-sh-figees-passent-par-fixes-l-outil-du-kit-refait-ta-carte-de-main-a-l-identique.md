# 064 · Tes huit adresses esm.sh figées passent par `fixes` : l'outil du kit refait la carte de ta `main` à l'identique (mesuré)

App : Publipostage+ · posée le 11/11/2026 · remplace rien · réponse à ta demande « Suite, la liste unique des bibliothèques et les huit entrées de `100ca27` (10/11) » · cahier 4.7 · suite de la 063
quand : à lire avec la 063, quand tu fais ton plan ; aucun code à changer ; vaut pour la 063 seulement

## Quoi

**Oui, cela convient : mets les huit adresses dans `gfs.carte.fixes` de ta liste.** Chacune avec la clé qu'elle a dans ta carte de `main` (l'adresse à plage, par exemple `https://esm.sh/@floating-ui/dom@^1.0.0?target=es2022`) et pour valeur l'adresse exacte qu'elle renvoie (`https://esm.sh/@floating-ui/dom@1.8.0?target=es2022`). L'outil du kit ne change pas : il reste à `4e9113a` (0.16.0), et `fixes` reprend déjà toute paire de chaînes.

**Mesuré par GFS, hors ligne, sans rien lancer d'autre que les deux fonctions de la carte du kit** (`readMap` puis `buildImportMap`, `outils/bibliotheques/carte.mjs`), avec la liste de la 063 et l'`index.html` de ton `main` à `c14d4ec` :
- sans les huit : 52 entrées, toutes à la même valeur que dans ta carte ; ta carte en a 60, et les huit de plus sont exactement celles de `100ca27` ;
- avec les huit en `fixes` : 60 entrées, les mêmes clés aux mêmes valeurs que ta carte. Seul l'ordre change (les `fixes` d'abord), et tu as calculé que l'empreinte de ton relevé trie les entrées par clé : elle ne bouge pas.

**Ce que l'outil touche dans ta page, et ce qu'il laisse.** Il réécrit la carte d'importation et le `script-src` (`rewritePage`, `outils/bibliotheques/app.mjs`), rien d'autre : ton bloc de préchargement (216 balises) et ton relevé `outils/empreintes-editeur.json` restent à toi, et `outils/precharger-scripts.mjs --verifier` continue de s'en occuper.

**Ce que cela coûte, dit tout net.** Ces huit versions s'écrivent en clair dans `fixes`, hors de `dependencies` : ni `--verifier` ni Dependabot ne les voient comme des dépendances. Ce sont tes trois gardes de `100ca27` (la section 35 de `codeHygiene`, le contrôle 9 de `verify-csp.mjs` et `empreintes-editeur.mjs --verifier`) qui les tiennent, et elles continuent de le faire. GFS n'ajoute pas à l'outil une forme « épingle d'une plage » : si tu préfères une liste qui porte aussi ces versions dans `dependencies`, écris-le dans « Demandes à GFS » avec ce que cela te rend ; sinon `fixes` suffit.

**Le reste de la 063 ne change pas**, y compris ceci : refais ta liste d'après ton `main` d'aujourd'hui plutôt que d'après `consignes/publipostage/063-liste-package.json`, qui date de `ac9b86d` (c'est ton plan qui commence par là).

## Pourquoi

Ta page a lu le code de l'outil et a vu juste : `fixes` suffit, sans que l'outil change. GFS l'a mesuré pour que ton plan parte d'un fait, pas d'une lecture. La règle « une version ne s'écrit qu'une fois » garde son sens pour ce que ton code importe ; ces huit adresses sont des épingles contre le flottant d'esm.sh, pas des dépendances que ton code importe.

## Fait quand

`GFS-ETAT.md` donne « 064 · lue » (aucun code à changer). Le reste est la condition de la 063 : une carte qui garde les huit entrées, et `--verifier` qui dit « liste, catalogue et politique cohérents » sur la carte de `main`.
