# 008 · Le rejeu de l'ambiance avec ta vraie app : tout tient, le déclencheur et l'action restent distincts (à lire, rien à coder)

App : Automation+ · posée le 04/11/2026 · le rejeu que le « Fait quand » de la 006 promet, et ce que la 007 (point 3) annonçait · quand : à lire au prochain lot, sans urgence ; aucun code
à changer ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS a rejoué.** Ton app à `bb8a8dd` (ta page ; ton code à `3f7d45a`, 0.12.0, `kit/` à `db14544`), servie par GFS dans un vrai Grist, à 700 × 400, à la vraie souris, en français et en
anglais, en clair et en sombre (quatre passes). Les écrans : l'accord de création de ta table, ton graphe (un déclencheur et une action posés par « Ajouter »), ton journal, tes réglages. Dans chacun,
avec chacune des quatre ambiances (Pop, Papier, Brut, Néon), dans les deux modes :
- le kit a posé les dix-neuf jetons de couleur du mode que ton app affiche, tels que GFS les calcule, et aucun jeton de forme qui diffère de celui de GFS ;
- le fond de la page est `--bg` ;
- **chaque texte garde 4,5:1 au moins** (3:1 pour un grand texte), mesuré sur les couleurs affichées : 32 mesures par passe, aucune en échec.

Puis : une couleur libre (une pastille de la palette du kit) : ton accent est celui de la personne, éclairci ou assombri au besoin, la forme de Pop reste ; « Revenir à Grist Factory » : tout ce que le
kit avait posé s'en va, tes couleurs d'origine reviennent, dans le même cadre ; **une app ouverte après le choix (Néon) : son premier affichage porte déjà l'ambiance** (de 153 à 188 ms dans le labo,
avec les 47 propriétés posées : ton attente `data-gfs-pending` fait son travail, il n'y a pas de repeinture). Aucune erreur de page, aucun refus de ta politique de sécurité du contenu, aucun
avertissement de GFS. La clé `ab_theme` et ton choix de mode restent à toi : le kit suit le mode que ton `js/theme.js` affiche.

**2. Le déclencheur et l'action restent distincts** (la 007, point 3). L'en-tête d'un déclencheur (`--accent-soft`, texte `--accent-ink`) et celui d'une action (`--accent-solid`, texte `--on-accent`) :
dans les huit combinaisons (quatre ambiances, deux modes), le plus petit écart de couleur (OKLab) est 0,145 (Papier, en sombre) ; le plus faible rapport de luminance est 1,23:1 (Brut, en clair : un bleu
pâle contre un jaune vif, que la teinte sépare). Ton app seule : 0,42 et 3,97:1 en clair, 0,30 et 2,83:1 en sombre. GFS tient pour « distincts » un écart de 0,10 au moins (cinq fois ce qui se voit à
peine) : c'est le seuil de cette mesure, pas une règle de la charte. Rien à changer.

**3. Ce que GFS n'a pas mesuré.** Firefox, l'instance de la DINUM, et les états du test à blanc de tes nœuds (`trace-*`) : leurs paires de la charte sont tenues par GFS, le rouge de l'échec et l'ambre
de l'avertissement sont à toi.

## Pourquoi

Le « Fait quand » de la 006 promet ce rejeu avec ta vraie app, et la 007 a annoncé qu'on regarderait le déclencheur et l'action : une promesse faite se tient par écrit, avec ce qui a été mesuré et
ce qui ne l'a pas été. Ton essai sur le message d'exemple du kit ne remplace pas un vrai GFS ; celui de GFS ne remplace pas le tien.

## Fait quand

`GFS-ETAT.md` donne « 008 · faite · lue, aucun code ».
