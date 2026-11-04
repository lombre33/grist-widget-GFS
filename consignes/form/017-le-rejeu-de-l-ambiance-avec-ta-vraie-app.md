# 017 · Le rejeu de l'ambiance avec ta vraie app : tout tient, un éclair de tes couleurs d'origine à voir ; et ta 015, relue (à lire, aucun code exigé)

App : Form+ · posée le 04/11/2026 · le rejeu que le « Fait quand » de la 016 promet, et ta page lue jusqu'à la 016 · quand : à lire au prochain lot, sans urgence ; aucun code exigé ; sans effet dans
l'app seule

## Quoi

**1. Ta page, relue.** La 015 (`01ddd10`) et la 016 (`954483a`) sont faites, ta page est à `0de37ac`. GFS a relu le code servi entre `fd5384a` et `0de37ac` : les listes de tables de ton éditeur sans
les tables `FormPlus_…`, `Ambiance.start()` dans `poc/js/main.js`, ta feuille qui lit les jetons de la charte et de forme (valeur d'origine en repli), `kit/` à `8afa569`. Rien de cela ne change ce que
GFS tient de ton app : ni table, ni colonne, ni clé de réglages, ni bibliothèque, ni permission, ni adresse de ta politique de sécurité du contenu. La référence de GFS avance à `0de37ac`, ton
manifeste ne change pas.

**2. Ce que GFS a rejoué.** Ton app à `0de37ac`, servie par GFS dans un vrai Grist, à 700 × 400, à la vraie souris, en français et en anglais, en clair et en sombre (quatre passes). Les écrans : tes
départs (les tuiles de démarrage), ton concepteur sur un formulaire semé comme tu l'enregistres (en haut, puis au bout du défilement), tes réponses, tes paramètres (chacun en haut puis au bout). Dans
chacun, avec chacune des quatre ambiances (Pop, Papier, Brut, Néon), dans les deux modes :
- le kit a posé les dix-neuf jetons de couleur du mode que ton app affiche, tels que GFS les calcule, et aucun jeton de forme qui diffère de celui de GFS ;
- le fond de la page est `--bg` ;
- **chaque texte garde 4,5:1 au moins** (3:1 pour un grand texte), mesuré sur les couleurs affichées une fois tes transitions finies : 56 mesures par passe, aucune en échec.

Puis : une couleur libre (une pastille de la palette du kit) : ton accent est celui de la personne, éclairci ou assombri au besoin ; « Revenir à Grist Factory » : tout ce que le kit avait posé s'en va,
tes couleurs d'origine reviennent, dans le même cadre ; une app ouverte après le choix (Néon) porte l'ambiance. Aucune erreur de page, aucun avertissement de GFS. (Le Grist du labo est en `http` : ton
`connect-src 'self' https:` y refuse l'adresse publique d'un formulaire, ce que ne fait pas un Grist en `https` ; GFS ne retient pas ces messages-là.)

**3. Un éclair de tes couleurs d'origine.** À son premier affichage, ton app se dessine dans ses couleurs d'origine, puis prend l'ambiance : dans le labo (Chromium, un Grist local), le premier
affichage vient de 10 à 25 ms, l'ambiance de 78 à 110 ms, soit **de 66 à 100 ms** de tes couleurs avant le changement, dans les quatre passes ; sur un Grist distant, plus. Tu appelles bien
`Ambiance.start()` avant d'afficher, comme le guide le dit, mais rien ne retient l'affichage jusqu'au message de GFS. **Ce n'est pas une règle du guide et GFS n'y peut rien** : c'est un constat, à toi
d'en faire ce que tu veux. Pour comparaison, Automation+ s'y prend ainsi : hébergée par GFS (`gfs=<n>` dans l'adresse du cadre), sa page attend l'ambiance avant de s'afficher
(`html[data-gfs-pending] body { visibility: hidden }` dans `css/style.css`, posé par `js/theme.js`, levé par la promesse `ready` du kit dans `js/gfs.js`, ou au bout de 2 s si le kit manque ou que
GFS tarde) ; seule, rien n'attend. Chez elle, le premier affichage porte déjà l'ambiance, sans repeinture ; chez toi, l'ambiance elle-même arrive de 78 à 110 ms : attendre ne coûterait que ce temps.

**4. Ce que GFS n'a pas mesuré.** L'écran du répondant et l'aperçu (`#fill`, `.pv-*`), que tu gardes à l'aspect dessiné par la personne (la 016) et qui ne s'affichent pas à qui conçoit dans GFS avec
l'accès complet ; Firefox ; l'instance de la DINUM.

## Pourquoi

Le « Fait quand » de la 016 promet ce rejeu avec ta vraie app : une promesse faite se tient par écrit, avec ce qui a été mesuré et ce qui ne l'a pas été. Le point 3 est une mesure que ton essai
sur le message d'exemple du kit ne pouvait pas voir : il a fallu un vrai GFS, qui met un moment à répondre.

## Fait quand

`GFS-ETAT.md` donne « 017 · faite · lue » (et, si tu retiens l'affichage jusqu'à l'ambiance, le commit qui le fait).
