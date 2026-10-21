# Grist Factory Suite (GFS) : consignes pour Claude

## Ce dépôt

GFS est le widget Grist qui héberge les apps Grist Factory (Publipostage+, Form+, Automation+, Grist-BI, puis Dashboard et
Thusday) : un courtier qui relaie l'API de Grist vers l'app active, un explorateur de fichiers, l'installation des apps et
des extensions, et les références aux apps (sous-modules Git).

Dépôt de développement : `lombre33/grist-widget-GFS`.

À lire avant tout code :

- `docs/cahier-des-charges-gfs.md` : « En bref », puis les sections 2 (décisions), 4 (architecture) et 5 (contrats) ;
- `docs/guide-des-apps.md` : ce que chaque app doit respecter ;
- `docs/faits-verifies.md` : ce qui a été lu dans le code de Grist et mesuré, avec fichier et ligne ;
- la charte Grist Factory, section 1, avant toute interface.

Le dossier de lancement complet (études, charte, maquettes, labo « vrai Grist ») est dans les fichiers du projet Claude.
Dans ces documents, `contexte/`, `maquettes/` et `outils/` désignent des dossiers de ce dossier de lancement, pas du dépôt.

## Décisions à ne pas rouvrir

- Une app = un dépôt public complet, qui tourne seule. GFS **référence** chaque app à un commit (sous-module), sans copie.
- Bibliothèques : **CDN par défaut**, version vendorisée seulement si le RSSI d'un client l'exige ; les deux depuis une
  liste : celle de l'app pour ses bibliothèques natives, celle de GFS pour les non natives (celles des extensions, que GFS
  porte : le dépôt d'une app n'en garde ni liste ni import map, et sa CSP ne garde que l'adresse du CDN que donne GFS, car
  GFS ne peut imposer aucune politique à un sous-cadre : mesuré à l'étape 2). Pas « tout vendoriser ».
- Isolement : une app par sous-cadre, sans `allow-same-origin` ; GFS est le seul à parler à Grist.
- Interopérabilité par la donnée et par des contrats écrits, jamais par l'import du code d'une app dans une autre.
- Fonctions sans leur extension : grisées, jamais cachées ; un clic explique comment passer à GFS (changer l'adresse dans le
  champ du panneau de droite de Grist, jamais par la galerie).
- Pas de calcul dans le widget ; limiter le nombre de tables ; ne pas dupliquer de code.
- Licence : GPL 3.0 pour tous les dépôts de la suite (GFS, kit, apps, outil d'audit) : `LICENSE` à la racine,
  `GPL-3.0-only` dans les `package.json` ; le code d'un tiers garde sa licence, compatible (21/10).

Si un fait nouveau remet en cause une de ces lignes : le dire au porteur, avec le fait, sur une carte de décision.

## Architecture en une minute

- Couches : kit (sans bibliothèque) ← apps (+ extensions) ← GFS. Le kit n'importe rien ; une app importe le kit, jamais une
  autre app ; une extension importe son app et le kit, jamais une autre extension.
- Dossiers : `apps/<id>/` (sous-modules des apps), `kit/` (sous-module du kit), `docs/` (dont `contrats.md`, étape 1 du
  plan), `prototype/` (étape 2).
- Le courtier relaie le protocole de l'API des widgets (`grain-rpc`, `mtype` 1 à 5), renumérote les appels, filtre d'après
  le manifeste `gfs.json` de l'app (tables lues, tables écrites, clés de réglages, `_grist_*` refusé sauf déclaration),
  et fournit le contexte, le stockage, l'impression et les actions « ouvrir », « choisir », « insérer », « fermer ».

## Règles de code

- JavaScript en modules ES, HTML et CSS, sans framework. Aucune étape de construction pour servir les pages : ce qu'un outil
  génère (import map, CSP, empreintes) est commité.
- Le courtier reste petit, sans bibliothèque, avec ses propres tests. Il ne charge jamais de code depuis une adresse lue
  dans des réglages, une table ou un message.
- Messages : `addEventListener('message')` et vérification de `event.source`, jamais `window.onmessage =` (cela
  remplacerait l'écoute du script d'API de Grist).
- Aucun accès au stockage du navigateur hors d'un `try/catch` ; le code marche sans lui.
- Données : changements additifs seulement ; ne jamais écrire une colonne absente (une seule annule tout le lot) ; relire
  l'identifiant réel après un `AddTable` ; aucune table créée sans l'accord de la personne.
- Réglages de la vue : jamais écrits sans un geste de la personne (Grist afficherait « Enregistrer » pour rien) ; clés de
  GFS préfixées `gfs.`.
- Pas de `console.log` dans le code publié (avertissements et erreurs seulement). Aucun prénom de personne dans le code
  publié, commentaires compris.
- GitHub Pages ne sert aucun fichier ni dossier dont le nom commence par « _ » ou « . », et met tout en cache 10 minutes :
  tout fichier CSS ou JS modifié monte son `?v=` dans la page qui le charge.
- Politique de sécurité du contenu stricte ; toute adresse ajoutée l'est consciemment, avec ce qu'elle sert à faire.
- Code repris, jamais copié : chercher ce qui existe (dans le kit, dans Publipostage+) avant d'écrire, et relire son diff à
  la recherche de copies.
- Fichiers et fonctions sous les seuils de l'outil d'audit : 600 lignes de code par fichier, moins de 81 lignes par
  fonction, complexité 15 au plus.

## Interface

- Charte Grist Factory, section 1 : base de gris et un seul bleu d'accent ; couleurs par les jetons, jamais en dur ;
  contraste de 4,5:1 en clair et en sombre (`--danger-ink` pour un texte rouge, `--accent-solid` sous un texte blanc) ;
  police du système, jamais une police d'un autre site ; icônes SVG au trait, ni emoji ni police d'icônes ; une icône = une
  fonction.
- Grisé, jamais masqué. On ajoute, on ne retire rien sans l'accord du porteur.
- Fenêtres sur une seule base (titre et boutons fixes) ; saisies et confirmations par des fenêtres du widget, jamais
  `prompt()` ni `confirm()` ; le dernier menu ouvert passe au-dessus (`Layers.raise`, jetons `--z-*`).
- Tout choix de colonne, de table, de modèle ou de fichier par la liste avec recherche (mots dans n'importe quel ordre,
  accents, casse et ponctuation ignorés).
- Panneau de référence : 700 × 400. Vérifier à la vraie souris et au vrai clavier, en clair et en sombre, en français et en
  anglais.
- Français et anglais dans le même lot. « modèle », jamais « template » ; pluriels par `{n|singulier|pluriel}` ; le vide
  d'une liste s'écrit « — Choisir … — ». Marque « Grist Factory ».
- Couleurs par type dans l'explorateur seulement : document bleu, grille vert, présentation orange ; l'icône et le mot du
  type toujours ensemble.

## Tests et vérification

- Une seule passe ciblée juste avant chaque push : les tests de ce que le push change. La suite complète seulement à la
  demande du porteur. Lire le résumé et les échecs, pas tout le journal.
- Chaque correction a son test, qui échoue sur l'ancien code.
- Ce qui dépend de ce que Grist envoie (accès, messages, réglages, cadre reconstruit) se mesure dans un vrai Grist (labo
  grist-static), jamais contre un faux Grist écrit par nous.
- Une interface se mesure à 700 × 400 à la vraie souris (pas de `dispatchEvent`), en clair et en sombre.
- Pas de relecture ni de vérification à plusieurs agents, même avec `ultracode` : c'est une règle de coût du porteur.

## Git et publication

- Push direct sur `main`, sans demande de fusion, par petits lots ; `git fetch origin main` juste avant (même règle que
  Publipostage+ ; le porteur peut la changer).
- Avancer la référence d'une app ou du kit, c'est un commit à part, relu (Dependabot le propose).
- Les dépôts des apps et de l'outil d'audit se lisent depuis ce projet, sans s'y modifier : un changement dans une app
  s'écrit comme une consigne (section suivante), que le projet de l'app lit lui-même.
- Seul ce projet pousse dans le dépôt de GFS (décision du porteur, 14/10) : un projet d'app y **demande** (section « Demandes
  à GFS » de son `GFS-ETAT.md`) et teste dans une copie à lui (`consignes/TESTER-AVEC-GFS.md`).
- Jamais de commit vide pour relancer une publication ; vérifier que Pages a publié et sert les fichiers.
- Les dépôts publics de l'organisation `grist-factory` ne se poussent jamais depuis le cloud : un outil d'envoi prépare le
  dépôt propre, le porteur pousse depuis sa machine.

## Les apps : consignes et état

Les dépôts servent de boîte aux lettres ; chaque côté ne lit qu'une page (mode d'emploi : `consignes/LISEZ-MOI.md`).

- **Écrire à une app** : une consigne est un fichier `consignes/<app>/NNN-sujet.md` (Quoi, Pourquoi, Fait quand) avec sa ligne
  dans l'`INDEX.md` de l'app, dans le même commit. Une consigne publiée ne change pas : un changement de fond est une nouvelle
  consigne qui remplace l'ancienne. Elle ne dit que ce que le cahier, le guide, les contrats relus ou une décision du porteur
  disent déjà ; sinon, carte de décision d'abord.
- **Se mettre à jour sur une app** : lire son `GFS-ETAT.md` (racine de son dépôt), puis le journal des commits depuis le
  « dernier commit lu » de `docs/apps.md`, jamais tout le dépôt (commandes et pièges : `docs/apps.md`). Ensuite, passer les
  consignes faites à « faite » dans l'`INDEX.md`, avancer la ligne de `docs/apps.md` et répondre aux questions par une consigne.
- **Traiter une demande d'app** (le porteur dit « demande de Publipostage+ », ou d'une autre app) : lire la section
  « Demandes à GFS » de son `GFS-ETAT.md` ; ajouter la bibliothèque à la liste de GFS et lancer l'outil (catalogue,
  empreintes, copie vendorisée) ; déclarer l'extension dans le manifeste ; avancer la référence de l'app (commit à part,
  relu) ; pousser ; répondre par une consigne.
- On ne pousse jamais dans le dépôt d'une app.

## Travailler avec le porteur

- En français, en le tutoyant. Il parle à un seul Claude : ne jamais parler de coordinateur, de fil ni de session.
- Ce qui dépasse sa demande se propose sur une carte de décision (une question par carte, deux à quatre options, une
  conseillée), écrite avec ce qu'il verra dans son document, pas avec des noms d'écrans ou de fichiers. Rien n'est codé
  avant son choix. Son « oui » à une étude n'est pas un go pour coder.
- Une question produit qui n'est pas encore utile attend le moment où on l'implémente ; si les deux réponses ne changent pas
  l'architecture, prendre la plus prudente et le dire en une ligne.
- Un récapitulatif sépare les défauts (avec leur impact) des vraies nouveautés, en mots simples, sans codes.
