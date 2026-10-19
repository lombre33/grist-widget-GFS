# 015 · Les présentations sont dans GFS ; la réponse sur le dossier de l'extension

App : Publipostage+ · posée le 19/10/2026 · répond à la demande « présentations » de ton `GFS-ETAT.md` (commit `5e14faa`, qui décrit
`da919fc`) et à l'une de ses « Questions pour GFS » · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans
l'app seule

## Quoi

**1. La demande est faite**, le porteur ayant demandé le 19/10 de mettre en place ce que Publipostage+ a livré :

1. **L'extension `diapositives` est déclarée dans le manifeste** (`9b54e3d`), telle que ta demande l'écrit : « Diapositives » /
   « Slides », le texte, l'icône `slides`, poids 0, `extensions/diapositives/`, les points d'entrée `type` `presentation` et `menu`
   `nouveau`, aucune bibliothèque.
2. **Le type `presentation` est dans les fichiers de `Publipostage_Modeles`** : « Présentation » / « Presentation », l'icône
   `slides`, la couleur `presentation` (la famille orange de l'explorateur de GFS), `extension: diapositives`.
3. **`presentation` est dans `actions.ouvrir`** : le double-clic d'une présentation dans l'explorateur ouvre ton app.
4. **La référence de ton app dans GFS passe de `abfb600` à `da919fc`** (`2bcfdab`, un commit à part, relu). GFS a lu ton
   `GFS-ETAT.md`, ton journal depuis `abfb600` et le diff de `da919fc` : rien de plus que ce que la page annonce (ni CSP, ni carte
   d'importation, ni liste de l'app, ni table, ni colonne, ni clé de réglages, ni table interne de plus ; la présentation n'est jamais
   le ★).

**2. Mesuré avec ton app** (`prototype/labo/run-diapositives.mjs`, vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la
vraie souris, 27 vérifications, en français / clair et en anglais / sombre ; ton app est celle de la référence, jamais modifiée) :

1. **éteinte** (le défaut), l'app ne reçoit pas `diapositives` ; la ligne « Nouvelle présentation » du menu « + » est grisée, avec
   sa raison (« Demande l'extension Diapositives (Grist Factory Suite) ») ; son clic appelle `installer` et GFS ouvre sa fenêtre
   sur la ligne « Diapositives », qui n'a ni taille ni mode à choisir (rien à charger) ;
2. **cochée**, l'app reçoit `diapositives` et aucune bibliothèque ; « Nouvelle présentation » ouvre une présentation vierge à la
   page 16:9 en paysage, sans rien charger (aucun refus de ta CSP) ; enregistrée, sa ligne porte `TypeModele` `presentation` et
   `190.5x338.7` en paysage dans `Margins` ;
3. **dans l'explorateur de GFS**, la présentation est orange, avec sa pastille et l'icône des diapositives ; son double-clic ouvre ton
   app sur elle (« Ouvert depuis l'explorateur. »), et l'app déjà ouverte passe d'une présentation à un document puis du document à la
   présentation par l'appel `ouvrir`, dans le même cadre, sans se recharger ;
4. **décochée** pendant qu'une présentation est ouverte : la ligne du menu se grise, la présentation reste ouverte, intacte, et
   s'enregistre toujours sous son type ; dans l'explorateur elle est grisée avec la raison, jamais cachée, et son double-clic ouvre
   la fenêtre de GFS sur la ligne « Diapositives ».

**Non mesuré** : un autre navigateur que Chromium (le labo du cloud n'a que lui) et le code propre aux diapositives, qui n'existe pas
encore.

**3. La réponse à ta question sur le dossier.** « `extensions/diapositives/` n'existe pas encore : une autre étape de GFS (copie,
audit, fenêtre d'installation) attend-elle des fichiers dedans ? » **Non.** GFS vérifie la forme du `dossier` (un chemin relatif à
l'app, sûr : contrats 2.6, point 1 ; `isSafePath` de `prototype/js/manifest.js`), jamais son existence, et aucune étape de GFS ne lit ce
dossier aujourd'hui. Le jour où le code propre aux diapositives y arrive, il suit la règle 10 du guide : un dossier à part, atteint
seulement à son premier usage, par le registre de `js/extensions.js`.

**4. La 014 vaut pour les cinq types.** Le manifeste dit désormais `document`, `grille`, `presentation`, `email`, `macro` dans
`actions.ouvrir`, et « Nouveau » est `ouvrir` avec `fichier: null` et l'un de ces types (contrats 5.4, point 1). Lis donc le
`type` de la 014 parmi **cinq** : pour `presentation`, le vierge est celui de ta ligne « Nouvelle présentation » du menu « + » (page
16:9, extension `diapositives` active, comme le prévoit déjà ta garde de la 002), à la place de l'ordre habituel, sans rien
écrire. Une `ouverture` `{ fichier: null, type: 'presentation' }` quand l'extension n'est pas active suit l'ordre habituel, sans
message d'erreur, comme un type refusé. Ta question disait que la réponse règle les deux : c'est cette réponse.

## Pourquoi

1. Le déroulé de `consignes/LISEZ-MOI.md` (« Demander à GFS », point 4) : à la demande du porteur, GFS déclare l'extension, avance
   ta référence dans un commit à part et répond par une consigne. Tes quatre points sont faits, et la fenêtre de GFS propose la case.
   Ta demande n'avait pas de bibliothèque : la liste de GFS n'a rien gagné.
2. Ta question sur le dossier avait une réponse courte, qui évite de créer des fichiers pour rien.
3. Rien ici ne change une règle : le point 4 redit le contrat 5.4 (point 1) pour un type de plus, et la décision du porteur du 19/10
   (« Nouveau » ouvre un modèle vierge, consigne 014).

## Fait quand

`GFS-ETAT.md` donne « 015 · faite · `commit` », retire de « Demandes à GFS » la demande des présentations et de « Questions pour
GFS » la ligne du dossier de l'extension. Aucun code n'est demandé : « faite » veut dire lue. Le code des diapositives, quand il
viendra, se dira à GFS comme le reste (« Changements qui touchent GFS »).
