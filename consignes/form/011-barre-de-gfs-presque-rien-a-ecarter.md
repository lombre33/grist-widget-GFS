# 011 · La barre de GFS chez toi : presque rien à écarter (mesuré), et un cadre rechargé garde son état

App : Form+ · posée le 21/10/2026 (nuit) · la consigne de la barre que la 010 annonçait (point 3), après mesure chez toi · quand :
avec la 010, ou au lot suivant ; un petit changement de code ; sans effet dans l'app seule

## Quoi

**1. La barre de GFS** (décision du porteur du 21/10 ; contrats 5.2, point 7 ; guide 1.2, point 9). Quatre boutons à icône seule,
34 × 124 px au bord gauche ou droit, 124 × 34 en haut ou en bas, à 4 px du bord et centrée sur lui ; à gauche tant que la
personne n'a rien choisi. Elle se pose par-dessus ton cadre, qui reste plein : pas de bande en plus. La zone à laisser libre est
la barre et 4 px autour : à 700 × 400, à gauche, `{ "x": 0, "y": 134, "largeur": 42, "hauteur": 132 }`. Ne l'écris jamais en dur :
la barre a déjà changé de taille une fois (un quatrième bouton le 21/10).

**2. Ce qu'elle recouvre chez toi**, tant que ton app n'écarte rien (mesuré avec ton app à `038dd1b`, celle que GFS référence, dans
un vrai Grist, à 700 × 400, en français / clair et en anglais / sombre ; `prototype/labo/run-barre-apps.mjs` avec `APP=form` ; tes
départs, puis ton concepteur sur un formulaire de deux questions, ses trois onglets, chacun en haut puis au bout du défilement) :

| Bord | Ce que la barre recouvre |
|---|---|
| gauche (par défaut) | rien : ta carte commence à 46 px du bord, la zone en prend 42 |
| haut | le haut de l'onglet « Réponses » (2 % du bouton), en haut de la page ; rien sur tes départs |
| droite | rien |
| bas | en haut du concepteur, le milieu d'un champ de question au bas de la vue (16 % du champ) ; il monte en défilant, et au bout du défilement rien n'est sous la barre, aux trois onglets ; sur tes départs, le bord de « Diagnostic » (1 %) |

Le courtier ne t'a rien refusé pendant la passe, et aucune erreur de page n'est survenue.

**3. Ce que ton app en fait** (à toi la manière : GFS ne l'impose pas), par le lien de la 010 : `GfsLink.onBar(barre => …)`, appelé
aussi à l'arrivée du contexte comme `onLanguage`, avec `{ bord, epaisseur, zone }` en pixels de ton cadre, ou `null` (l'explorateur
ouvert, ou ton app seule) ; `GfsLink.bar()` le relit.

1. Barre en haut : tes onglets s'écartent de la zone (le haut de ta carte sous `zone.y + zone.hauteur`, par exemple).
2. Barre en bas : le bas de ta page laisse au moins `epaisseur` sous ton dernier contrôle, pour qu'il monte toujours au-dessus de
   la barre en défilant (c'est déjà vrai du formulaire mesuré).
3. Barre à gauche ou à droite : ta carte garde, à toute largeur de cadre, plus que `epaisseur` de chaque côté.
4. Tes menus, listes et fenêtres se calent sur la zone libre (non mesuré : aucun n'était ouvert pendant la passe).
5. Seule, rien ne change : `GfsLink.bar()` vaut `null`.

**4. Un cadre rechargé garde son état** (contrats 4.2, point 2 ; corrigé chez GFS le 21/10, `75276d7`). Si tu te recharges au
changement de langue (010, point 2.4), GFS te redonne tes réglages, le thème et la table, comme Grist : mesuré avec ton app
(`run-recharge`, 6 vérifications sur 6, en français / clair et en anglais / sombre) ; avant, tu retombais sur ton écran « widget
seul ». Rien à faire chez toi.

## Pourquoi

Le porteur a décidé le 21/10 que la barre se pose au bord que la personne choisit, par-dessus l'espace que les apps laissent vide,
et a voulu mesurer chaque app avant de lui écrire. Chez toi, presque rien n'est sous la barre : deux petits écarts suffisent.

## Fait quand

`GFS-ETAT.md` donne « 011 · faite · `<commit>` » quand ton app écoute `onBar` et écarte ses onglets (barre en haut) et le bas de sa
page (barre en bas), ou « lue, pas faite » avec la raison. GFS rejoue alors la mesure avec ta version, aux quatre bords.
