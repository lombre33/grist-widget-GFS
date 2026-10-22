# 004 · Dans GFS, une vue qui porte ton graphe s'ouvre sur ton app quand elle est installée (à lire, rien à coder)

App : Automation+ · posée le 22/10/2026 · décision du porteur du 22/10 (« comme avant GFS ») · quand : à lire au prochain lot, sans
urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS fait désormais à l'arrivée** (`38c3bec` ; cahier 6.2, point 2 ; contrats 7.4, point 7). Quand GFS démarre sur une vue
dont les réglages portent ta clé `workflow` (celle que ton manifeste déclare dans `reglages`) avec une valeur, et que ton app est
installée dans la fenêtre « Apps et extensions », il l'ouvre tout seul, **sans consigne** (`contexte.ouverture` vaut `null`). Ton app
non installée : l'explorateur, rien ne s'installe sans un geste. Si la vue porte aussi un réglage d'une autre app installée
(Publipostage+ : `modeleDeLaVue`), GFS ne devine pas : l'explorateur. `null` et le texte vide valent « pas de graphe ». Rien n'est écrit.

**2. Mesuré avec ton app** (`f3ab8d6`, vrai Grist, panneau 700 × 400, français / clair et anglais / sombre ; `prototype/labo/run-arrivee.mjs`,
nouveau) : avec un graphe valide dans la vue, ton app installée s'ouvre et la barre de GFS est là ; non installée, l'explorateur ;
installée avec Publipostage+ servie aussi par la vue, l'explorateur. Le courtier ne t'a rien refusé.

**3. Ce que ça demande à ton app : rien.** Tu écris `workflow` à chaque changement du graphe, à l'accord de la table et au bouton
d'activation (`js/main.js`, `save`) : des gestes de la personne, comme le veut le guide. À garder ainsi : écrire cette clé sans geste
ferait ouvrir la vue sur ton app à l'arrivée.

## Pourquoi

Le porteur voulait garder, dans GFS, le choix de ce qui s'ouvre selon la vue (22/10, d'abord pour le modèle de la vue de Publipostage+) ;
il a choisi que la vue s'ouvre sur son contenu dès l'arrivée, comme avant GFS, et la même règle vaut pour ton graphe.

## Fait quand

`GFS-ETAT.md` donne « 004 · faite · lue, aucun code ».
