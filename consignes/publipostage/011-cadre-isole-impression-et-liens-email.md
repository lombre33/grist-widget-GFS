# 011 · Dans le cadre isolé de GFS : imprimer par sa propre page, ouvrir les liens e-mail dans un nouvel onglet

App : Publipostage+ · posée le 16/10/2026 · quand : avant que GFS montre Publipostage+ à des personnes (alpha) ; dans l'app
seule, rien n'est obligé de changer

## Quoi

GFS fait tourner chaque app dans un cadre isolé : `sandbox="allow-scripts allow-forms allow-popups allow-modals
allow-downloads"`, sans `allow-same-origin`, donc une origine « nulle » (décision du porteur le 16/10, cahier section 2 ;
contrats 1.3, point 1). Mesuré dans un vrai Grist (`prototype/rapport.md`, section 3) : téléchargements, `window.print()`,
nouvel onglet et écriture dans le presse-papiers y marchent comme seule, et les accès de l'app au stockage du navigateur sont
déjà dans des `try/catch` (guide 1.1, point 6 : rien à faire). Deux endroits de l'app ne marchent pas :

1. **L'impression navigateur** (« Impression navigateur » du bouton PDF). `js/print-export.js` (`createFrame`, ligne 95) fabrique
   un cadre caché (`srcdoc`, `sandbox="allow-same-origin allow-modals"`) qu'elle lit ensuite (`frame.contentDocument`, styles
   calculés, `afterprint`, `print()` sur sa fenêtre). Dans le cadre isolé, ce cadre caché n'a pas l'origine de l'app : son
   `contentDocument` vaut `null` et chaque accès à sa fenêtre lève une `SecurityError`. Les quatre façons essayées (la sienne,
   sans attribut `sandbox`, vide puis écrit par `document.write`, avec `allow-modals` seul) échouent pareil. Ce qui marche :
   `window.print()` sur la fenêtre de l'app elle-même, qui reçoit `beforeprint` et `afterprint`. L'impression navigateur doit donc
   se faire sans lire de cadre. La façon est celle de l'app ; une piste : rendre les feuilles dans sa propre page (un conteneur
   hors de l'écran mais mis en page, pour la mesure ; `@media print` ne montre que lui, avec ses règles `@page`), appeler
   `window.print()` sur sa fenêtre, retirer le conteneur à `afterprint`. Un seul chemin, qui marche seule comme hébergée, vaut
   mieux que deux. Les feuilles restent celles de la Lecture (mêmes coupures, en-têtes et pieds, sens des pages).
2. **Les liens `mailto:` et `tel:`.** Dans le même cadre, un tel lien fait mourir le cadre : la politique de GFS (`frame-src
   'self'`) ne connaît pas ces adresses. Dans un nouvel onglet, rien ne casse (mesuré). Hébergée par GFS (`gfs` dans l'adresse,
   `GfsLink`), l'app ouvre donc ces liens dans un nouvel onglet (`target="_blank"`, `rel="noopener noreferrer"`) à trois
   endroits : `onCreateEmail` (`js/main.js`, ligne 1912, le `<a>` synthétique), `openExternal` (`js/link-dialog.js`, ligne 72) et
   les liens de la Lecture (`js/reader-mode.js`, ligne 970, où seuls les liens `http` reçoivent aujourd'hui `target="_blank"`).
   Seule, rien ne change.

Lignes relevées sur `47fae07` le 16/10, à relire sur `origin/main`.

## Pourquoi

Le 16/10, le porteur a choisi le cadre isolé après avoir eu les prix : le stockage du navigateur (GFS le prêtera par le kit,
étape 3), l'impression par la page de l'app, le lien e-mail dans un nouvel onglet. Chaque prix se règle à un seul endroit. Sans
cette consigne, dans GFS l'impression navigateur échoue et « Créer l'e-mail » fait disparaître l'app jusqu'au rechargement. GFS
ne peut rien y changer de son côté : donner au cadre caché la bonne origine reviendrait à rouvrir la cage (`allow-same-origin`
écarté).

## Fait quand

Un essai dans un cadre de même nature que celui de GFS (mêmes drapeaux `sandbox`, sans `allow-same-origin` ; la page de test
de l'app peut le monter, ou la copie de GFS de `consignes/TESTER-AVEC-GFS.md`) montre : l'impression navigateur lance
`print()` sur la fenêtre de l'app, avec le même nombre de feuilles et les mêmes coupures que la Lecture (le test des feuilles de
`PrintExport` existant, adapté) ; un clic sur « Créer l'e-mail » et sur un lien `mailto:` de la Lecture ouvre un nouvel onglet
et laisse l'app affichée ; seule, les feuilles sont celles d'aujourd'hui et les liens se comportent comme aujourd'hui. Si une
piste pour l'impression demande une mesure dans un vrai Grist (une fenêtre ouverte par l'app, par exemple), l'écrire dans
« Questions pour GFS » : le labo de GFS la mesure. `GFS-ETAT.md` donne la ligne « 011 · faite · `commit` ».
