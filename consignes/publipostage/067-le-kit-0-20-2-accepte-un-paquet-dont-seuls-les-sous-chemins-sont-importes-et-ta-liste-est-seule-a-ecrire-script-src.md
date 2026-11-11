# 067 · Le kit 0.20.2 accepte un paquet dont seuls les sous-chemins sont importés (`@tiptap/pm`) ; ta liste est seule à écrire `script-src`

App : Publipostage+ · posée le 11/11/2026 · remplace rien · réponse à ta demande « Suite, la liste unique des bibliothèques rejouée sur `fd06824`, les fonctions des bibliothèques natives et la copie de l'éditeur (11/11) » (points 4, 5 et 6) · cahier 4.7 · suite des 063 et 064
quand : avec ton plan de la 063, quand tu avances le kit ; sans urgence ; du code dans l'outil du kit (déjà fait), rien dans ton code ; vaut pour la 063 et la 066

## Quoi

**1. Le changement du kit que tu demandes est fait : kit 0.20.2 (`2feec25`).** Dans `outils/bibliotheques/carte.mjs`, `checkRemaps` ne demande plus qu'un paquet de `gfs.carte.sousChemins` soit dans `paquets` : il lui faut sa **version exacte dans `dependencies`**, et rien d'autre. Un paquet dont seuls les sous-chemins sont importés (`@tiptap/pm`, treize adresses absolues que demande le bundle d'esm.sh de `@tiptap/core`) reste donc hors de `paquets`, avec sa version exacte (3.31.3) dans `dependencies` : la carte n'a pas son entrée nue, ses sous-chemins sont écrits comme avant, ramenés à l'instance unique. Un paquet de `sousChemins` sans version exacte est refusé (« la version de X doit être exacte dans dependencies »). Une liste qui garde le paquet dans `paquets` produit la même carte qu'avant. Ton diff de 55 lignes disait la même chose ; GFS l'a écrit de son côté (trois lignes de `checkRemaps` et un commentaire, un essai qui change une attente et en gagne une : `test/bibliotheques-carte.test.mjs`, les 537 essais du kit verts, et le nouvel essai rouge sur l'ancien outil).

**À faire de ton côté.** Avance ta référence du kit à la 0.20.2 ou plus récente (la 0.21.0, `ede73a7`, y ajoute seulement le moteur de partage 2.7.0 de Sync+, que ton app ne charge pas), dans un commit à part et relu. Puis refais ton rejeu à `fd06824` avec la liste du point 3 de ta page (les 92 sources dans `politique.scriptSrc`, `@tiptap/pm` hors de `paquets`, `sousChemins` et `dependencies` inchangés) : les chiffres que tu donnes (59 entrées, `script-src` à 109 jetons, deux passes identiques, `--verifier` et `--verifier-cdn` cohérents) sont ceux que GFS attend ; **GFS ne les a pas rejoués avec ta liste**, seulement l'essai du kit.

**2. Un seul écrivain de `script-src` : ta liste, par l'outil du kit** (c'est déjà la 063). Ton plan est le bon : `outils/empreintes-editeur.mjs` garde le relevé et cesse d'écrire `script-src` (`--poser-politique` disparaît, ou ne sert plus qu'à un contrôle sans écriture). Convenir de cela avec l'auteur de `bd9f53e` est entre vous : GFS n'y met aucune condition, sinon que `--verifier` de l'outil du kit redise « liste, catalogue et politique cohérents » après n'importe quel passage de tes autres outils.

**3. Tes sept fonctions pour la 065 attendent le porteur.** GFS propose aujourd'hui quatre fonctions pour tes neuf natives ; ta proposition de sept (`pdf`, `pdf-assemblage`, `zip`, `word`, `excel`, `markdown`, `qr`, avec tes noms français et anglais) est sur une carte de décision au porteur. Ne range rien d'après elle avant que GFS te le dise : l'ordre de la 065 (d'abord ta liste unique, 063 et 064) ne te fait rien perdre. Ton constat sur jszip est entendu et ne se discute pas : c'est lui qui motive la carte.

**4. Le poids de la fonction « Éditeur ».** Le 1 172 757 octets du manifeste d'essai de GFS (faits vérifiés 96) est une estimation faite avant que la copie existe. Quand tu diras que la fonction est prête, GFS affichera le poids de la copie construite (tes 615 704 octets, 194 707 compressés), pas l'estimation.

## Pourquoi

Ta politique de sécurité resserrée (92 dossiers d'esm.sh au lieu de l'hôte entier) est un progrès que l'outil du kit défaisait : il remettait l'hôte entier et l'entrée nue de `@tiptap/pm`. Mieux vaut corriger l'outil que garder deux écrivains qui se contredisent. Les sept fonctions changent ce que le porteur voit dans la fenêtre « Apps et extensions » : c'est à lui de dire.

## Fait quand

`GFS-ETAT.md` donne « 067 · lue » avec le kit avancé (commit à part) et le rejeu à `fd06824` : `--verifier` dit « liste, catalogue et politique cohérents » avec `@tiptap/pm` hors de `paquets`, et `script-src` n'a qu'un écrivain. Les sept fonctions, la 065 et la 066 ont leur propre échéance.
