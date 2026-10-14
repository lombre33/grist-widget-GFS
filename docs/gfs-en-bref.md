# GFS en bref, pour le projet d'une app

À lire une fois, avant le reste de la boîte aux lettres (`consignes/LISEZ-MOI.md`). Cette page dit ce qu'est Grist Factory
Suite (GFS), ce qui est en jeu, ce qui change pour une app et ce qui ne change pas, et qui fait quoi. Les règles à suivre sont
dans le guide des apps (`guide-des-apps.md`), les raisons dans le cahier des charges (`cahier-des-charges-gfs.md`), les messages
entre GFS et les apps dans les contrats (`contrats.md`). Le porteur est la personne qui porte le projet Grist Factory : c'est
elle qui décide. À jour au 14/10/2026.

## Ce qu'est GFS

Un widget Grist « chef d'orchestre ». La personne met son adresse dans le champ du panneau de droite de Grist ; GFS installe des
apps Grist Factory (Publipostage+, Form+, Automation+, Grist-BI, puis Dashboard et Thusday), en fait tourner une à la fois dans
son cadre, et permet de passer de l'une à l'autre par un **explorateur de fichiers** toujours présent. Un fichier, c'est un
modèle de Publipostage+, un formulaire de Form+, un automatisme d'Automation+… GFS y ajoute les **extensions** : des fonctions
d'une app qui demandent une bibliothèque lourde (graphique, diapositives, temps réel, formats Office).

## Ce qui est en jeu

- **Une suite, pas une fusion.** Les apps partagent des données et des gestes (ouvrir un fichier, en choisir un, insérer ce
  qu'une autre app produit) par des contrats écrits, jamais en important le code d'une autre app.
- **Chaque app reste complète.** Un dépôt public qui tourne seul, audité seul : GFS ne lui retire rien, il l'héberge. On passe
  d'une app seule à GFS et on revient sans perdre de données.
- **La sécurité vient de l'isolement.** Chaque app tourne dans un sous-cadre isolé (sans `allow-same-origin`) ; GFS est seul à
  parler à Grist et ne laisse passer que ce que le manifeste de l'app déclare. Jamais « cocher un module rend plus sûr ».
- **Des dépôts d'apps propres et auditables.** Le code d'une fonction reste dans l'app ; la bibliothèque d'une extension (Plotly
  pour le graphique), son chargement, sa liste, sa CSP et ses empreintes sont à GFS, en CDN par défaut ou en copie vendorisée
  pour les réseaux fermés. Les bibliothèques sans lesquelles l'app ne marche pas seule (l'éditeur, les exports) restent à l'app.
- **Rien à héberger.** Des pages statiques (GitHub Pages, ou chez le client) et aucune étape de construction pour les servir.

## Ce qui change pour une app

- **Seule** : rien ne se perd. Une fonction dont l'extension manque est grisée, jamais cachée, et un clic explique comment passer
  à GFS ; ce qu'elle a créé se réenregistre intact.
- **Dans GFS** : l'app tourne dans un sous-cadre, ne devine ni sa page ni son document par son adresse, et parle à Grist par le
  courtier de GFS, qui filtre d'après son manifeste (`gfs.json` : tables lues et écrites, clés de réglages, tables internes
  `_grist_*` refusées sauf déclaration). GFS lui donne le contexte, le stockage et les actions « ouvrir », « choisir »,
  « insérer » et « fermer ».
- **Ses données** vivent dans ses tables, préfixées par l'app, pas dans les réglages de la vue ; ce qu'elle ne connaît pas, elle
  le garde tel quel.

## Qui fait quoi

Le projet de GFS écrit les contrats, le courtier, l'explorateur et le kit commun, et dépose ses consignes dans
`consignes/<app>/`. Le projet de chaque app code son app, suit les consignes et le guide, et tient son `GFS-ETAT.md` : ce qu'elle
a changé qui touche GFS, ses questions, ses demandes (la bibliothèque d'une extension, par exemple). Il teste l'assemblage dans
une copie de GFS à lui et ne pousse jamais dans le dépôt de GFS ; GFS ne pousse jamais dans celui d'une app.

## Où on en est (14/10/2026)

L'ordre : contrats, prototype du courtier, kit commun, listes des bibliothèques, apps prêtes pour GFS, GFS v0, puis extensions et
nouvelles apps (cahier, section 10). Les contrats sont un brouillon qui évolue avec le prototype, lequel montre déjà
l'explorateur, la fenêtre « Apps et extensions » et Publipostage+ ouvert dans un sous-cadre isolé, dans un vrai Grist.
Publipostage+ est mûr ; Form+, Automation+ et Grist-BI sont des preuves de concept.

## Pour la suite

Avant un lot : `consignes/<app>/INDEX.md`. Pour coder dans les règles : `guide-des-apps.md`. Pour une bibliothèque nouvelle :
`consignes/LISEZ-MOI.md`, « Demander à GFS ». Pour essayer son app dans GFS : `consignes/TESTER-AVEC-GFS.md`.
