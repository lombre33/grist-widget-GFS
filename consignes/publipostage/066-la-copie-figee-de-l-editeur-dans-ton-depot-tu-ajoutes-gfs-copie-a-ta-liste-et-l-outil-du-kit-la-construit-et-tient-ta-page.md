# 066 · La copie figée de l'éditeur est dans ton dépôt : tu ajoutes `gfs.copie` à ta liste, et l'outil du kit la construit et tient ta page (choix du porteur)

App : Publipostage+ · posée le 11/11/2026 · complète la 065 (qui laissait l'éditeur de côté) · cahier 2 (décisions du 11/11), contrats 1.3 (point 3), 2.6 (point 14), kit 0.20.0
quand : après ta liste unique (063, 064), sans urgence ; indépendante des fonctions de la 065 (tu peux les faire dans l'ordre que tu veux)

## Quoi

**Ce que le porteur a décidé** (11/11, à la question « où loge la copie de l'éditeur ? ») : **dans ton dépôt**. « Seule la copie de l'éditeur (1,1 Mo) reste dans l'app ; le reste est chez GFS. La page garde des adresses relatives, sans nommer GFS. » Le choix « CDN ou copie figée » de l'éditeur se fait dans la fenêtre « Apps et extensions » de GFS, comme pour tes neuf natives (ligne « Éditeur (TipTap) », jamais grisée) ; il **prend effet au prochain démarrage de ton app** (GFS ne recharge rien : la ligne le dit à la personne).

**Pourquoi l'éditeur est à part** : sa « copie » n'est pas un fichier mais une carte d'importation (`@tiptap/core`, `prosemirror-model`… vers des modules), et Firefox n'en prend qu'une par page (faits vérifiés 88). La page choisit donc sa carte **avant** de charger quoi que ce soit : elle ne peut pas attendre que GFS réponde.

**Ce que GFS a déjà fait** : l'adresse de ton cadre porte `copie=editeur` quand la personne a choisi la copie (en plus de `gfs=0`) ; `GfsLink.copies()` (kit 0.19.0) la lit ; et **l'outil du kit 0.20.0 fabrique la copie et réécrit ta page** (faits vérifiés 98, mesuré sur une copie de ton `ac9b86d` sous Firefox 160 et Chromium, dans un cadre isolé : l'éditeur démarre depuis la copie, aucune requête vers esm.sh, aucune violation de ta politique).

**Ce que tu fais, dans cet ordre :**

1. **Avancer ta référence du kit à la 0.20.0** (un commit à part, relu).
2. **Ajouter à ta liste** (`package.json`, section `gfs`) :
   `"copie": { "fonction": "editeur", "dossier": "vendor/editeur", "sansEsm": ["@tiptap/pm"], "cle": "pp_editeur_copie" }`
   `fonction` est l'identifiant que GFS met dans l'adresse (`copie=editeur`) ; `dossier` est où loge la copie ; `sansEsm` est la même liste que ton miroir (les paquets de la carte que ton code n'importe jamais par leur nom) ; `cle` est **facultative** : une clé du stockage de ton app qui, valant `copie`, choisit la copie quand ton app tourne seule (si tu veux une entrée de menu « éditeur hors ligne » ; GFS n'en demande pas ; le stockage n'est lu que dans un `try/catch`).
3. **Lancer `node kit/outils/bibliotheques.mjs --copies`** (réseau : npm). Il construit les modules de ta carte d'un seul tenant (une seule instance de ProseMirror), minifiés, dans `vendor/editeur/` avec `LICENCES.txt` (la licence de chaque paquet lu) et `COPIE.json` (version de chaque paquet, empreinte de chaque fichier), **puis réécrit ta page** : à la place de ta carte d'importation, **deux cartes en données (CDN et copie) et un script de 9 lignes** qui pose la bonne au démarrage (la copie quand l'adresse dit `copie=editeur`, ton CDN sinon, ou la clé `cle` du stockage). Sur ton `ac9b86d` : 55 fichiers, 51 paquets, 760 Ko ; refait à l'identique tant que tes versions ne changent pas.
4. **Ne rien écrire de la main dans ce bloc ni dans `script-src`** : l'outil y met deux empreintes de plus (le script, le texte de la carte de la copie) et garde celle de ta carte du CDN ; aucune adresse de plus dans ta politique (`'self'` couvre la copie). `node kit/outils/bibliotheques.mjs --verifier` relit tout (le bloc, les empreintes des fichiers de la copie, les versions de ta liste) et te dit « refaire la copie » quand Dependabot monte une version de la carte.
5. **Commiter** `vendor/editeur/` (sa licence est celle de chaque paquet, dans `LICENCES.txt` ; ton dépôt reste GPL-3.0 pour son propre code) et ta page. Si ton outil d'audit lit les fichiers JS, exclus ce dossier : c'est le code d'un tiers, minifié.
6. **Un essai** qui prouve les deux chemins : la page ouverte avec `?copie=editeur` charge l'éditeur depuis `vendor/editeur/` (aucune requête vers esm.sh, aucune violation de la politique), la page sans `copie` garde ta carte du CDN. Ton miroir d'essais ne change pas.
7. **Tu n'as rien à lire de `GfsLink.copies()`** : c'est le script de la page qui lit l'adresse, tout seul, avant tout le reste. Elle ne t'est utile que si tu veux montrer dans ton coin d'état que l'éditeur tourne depuis la copie.

**Ce que tu dis à GFS** : dans « Demandes à GFS » de ta page d'état, que la fonction « Éditeur » (`editeur`, nom français et anglais, ≈ 1,1 Mo) est prête à être déclarée. GFS la déclare alors dans son manifeste de ton app (`natives`, `copieDansApp: true`, sans bibliothèque) **avec tes neuf natives de la 065** et rejoue sa mesure avec ta page à jour.

## Pourquoi

Le porteur veut pouvoir fermer le réseau d'un client bibliothèque par bibliothèque, **l'éditeur compris**, sans que le CDN cesse d'être le défaut (« pas tout vendoriser » tient). La copie dans ton dépôt garde ta page sans le nom de GFS et tes adresses relatives ; l'outil du kit tient le reste (carte, empreintes, licences) comme il tient déjà ta liste, pour que tu n'aies aucune empreinte à écrire de la main.

## Fait quand

`GFS-ETAT.md` donne « 066 · lue ». Puis ta liste porte `gfs.copie`, `vendor/editeur/` est commité, `--verifier` ne dit rien, ton essai passe, et « 066 · faite » avec le commit. GFS déclare alors la fonction, rejoue sa mesure dans un vrai Grist avec ta page, et avance ta référence.

**À savoir** : si ta page appelle déjà un jour un module de l'éditeur par un chemin plutôt que par son nom nu (`@tiptap/pm/...`), la copie ne l'a pas : dis-le dans ta page d'état, `sansEsm` ne couvre que les paquets que ton code n'importe jamais par leur nom.
