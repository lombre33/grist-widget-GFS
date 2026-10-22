# 032 · Dans GFS, une vue qui porte tes réglages s'ouvre sur ton app, le modèle de la vue compris (à lire, rien à coder)

App : Publipostage+ · posée le 22/10/2026 · décision du porteur du 22/10 (« comme avant GFS ») · quand : à lire au prochain lot, sans
urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS fait désormais à l'arrivée** (`38c3bec` ; cahier 6.2, point 2 ; contrats 7.4, point 7). Quand GFS démarre sur une vue
dont les réglages portent une clé de ton `reglages` avec une valeur (`modeleDeLaVue`, `modeleSelonLigne`, `droitsAcces`,
`dateDernierExport`), il ouvre ton app tout seul, **sans consigne** : `contexte.ouverture` vaut `null`, et ton ordre d'arrivée
habituel s'applique (la ligne choisie, le modèle de la vue, le ★, la page blanche). Avant, GFS démarrait toujours sur l'explorateur :
le modèle de la vue ne s'ouvrait que par le bouton « Ouvrir » de la fenêtre des apps. `null` et le texte vide valent « pas de choix »
(ton « Retirer » du modèle de la vue écrit `null` : la vue repart alors sur l'explorateur). Rien n'est écrit, ni par GFS ni par ton app.

**2. Mesuré avec ton app** (`2d9d4ed`, vrai Grist, panneau 700 × 400, français / clair, anglais / sombre, et en lecture seule ;
`prototype/labo/run-arrivee.mjs`, nouveau) : le modèle de la vue est un document, une grille, ou une présentation (extension
« Diapositives » cochée : la présentation s'ouvre ; éteinte : ton ★, comme dans l'app seule) ; un modèle disparu : ton ★ ; une autre
clé que le modèle de la vue (ici `dateDernierExport`) : ton ordre habituel. La barre de GFS est là, « Fichiers » ouvre l'explorateur et
Échap ramène au même modèle, dans le même cadre. Aucune table, ligne ni réglage de plus.

**3. Ce que ça demande à ton app : rien.** Une chose à garder en tête (le guide, 1.1 point 2, le dit maintenant) : une clé de
`reglages` écrite sans geste de la personne ferait ouvrir la vue sur ton app à l'arrivée. Écris-les sur un geste, et retire un choix par
`null` ou en retirant la clé.

**4. Pas fait, exprès.** Quand la vue ne porte aucune clé, GFS ouvre l'explorateur, même si ton app est la seule installée (cahier 6.2,
point 3 : le plus prudent).

## Pourquoi

Le porteur voulait garder, dans GFS, le choix du modèle qui s'ouvre selon la vue (22/10) ; il a choisi que la vue s'ouvre sur son modèle
dès l'arrivée, comme avant GFS.

## Fait quand

`GFS-ETAT.md` donne « 032 · faite · lue, aucun code ».
