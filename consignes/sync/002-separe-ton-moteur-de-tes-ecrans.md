# 002 · Sépare ton moteur de tes écrans : un branchement vers Grist, un préfixe de tables réglable

App : Sync+ · posée le 06/11/2026 · quand : au prochain lot, sans urgence ; du code dans ton app, sans changement visible pour la personne ; décision du porteur du 06/11 (le moteur va dans le kit) ; vaut aussi dans l'app seule

## Quoi

1. **Le moteur dans un dossier à part, sans rien dessiner.** Ce qui crée, lit, écrit et décide (aujourd'hui `js/logic/` et, d'après une lecture
   rapide de GFS à vérifier chez toi, les parties de `js/source/synchro.js`, `js/source/actions.js`, `js/target/dest.js` et
   `js/target/loop.js` qui ne dessinent rien) va dans un dossier que GFS peut lire seul. Rien n'y utilise `document`, `window`, `location`, `navigator` ni le global
   `grist`. Les écrans (`js/source/*-wizard.js`, `tab.js`, `ui.js`…) appellent le moteur, jamais l'inverse.
2. **Un seul branchement vers Grist.** Le moteur reçoit un objet `port` qui offre ce que `js/grist.js` expose aujourd'hui
   (lire et écrire des lignes, le schéma, l'identité du document, être propriétaire, joindre ou lire une pièce jointe, les
   webhooks, l'envoi d'un lot à un webhook, le partage d'un formulaire, l'accès public, le verrou de la page, et le fait que la page est visible : `loop.js` lit
   `document.visibilityState`). Sync+ seul garde son
   code d'aujourd'hui comme `port` ; GFS écrira le sien (c'est lui qui parle à Grist, et qui décide des tables qui sortent).
3. **Le préfixe des tables est un paramètre.** `Synchro`, `Journal_…` et les tables de destination que le moteur crée prennent un
   préfixe donné au démarrage. La valeur par défaut garde les noms d'aujourd'hui : aucun document existant ne change.
4. **Une version du moteur.** Un numéro dans le dossier du moteur (et une ligne dans ton journal des changements), pour que GFS
   dise à quel commit il l'a lu. Pas de nouvelle bibliothèque : le moteur reste en modules ES, sans dépendance.
5. **Rien de visible ne change.** Tes essais (Node et vrai Grist) passent sans modification ; un essai de plus montre le moteur
   tournant avec un `port` qui n'est pas celui de Grist.

## Pourquoi

Le moteur ira dans le kit, et GFS le fera tourner dans sa page avec son propre `port` : il faut donc qu'il ne dépende ni de ton
écran ni du global `grist`. La séparation est déjà bien avancée chez toi (logique pure, une seule porte réseau) ; il reste les
quelques fichiers où l'écran et l'orchestration sont mêlés. Précédent : le calendrier de Calendar+ (consigne 012 de
`consignes/tuesday/`). GFS reprend ton moteur **à un commit** et le range dans le kit ; les corrections qu'il y fait, il les dit
dans ta page d'état, et tu reprends la version du kit au lieu de garder la tienne (comme Calendar+ l'a fait).

## Fait quand

`GFS-ETAT.md` donne la ligne « 002 · faite · `commit` » et, en note : le dossier du moteur et son numéro de version ; la liste
des fonctions du `port` ; le nom du paramètre de préfixe et sa valeur par défaut ; « aucun accès à l'écran dans le moteur »
(ou ce qui reste, et pourquoi) ; et, dans « Questions pour GFS », si le moteur écrit des textes lus par la personne (messages,
diagnostics), car GFS doit alors les offrir en français et en anglais.
