# Guide des apps Grist Factory : être prête pour GFS

Version 1 du 14 octobre 2026. Pour le projet de chaque app, Publipostage+ d'abord. Ce guide dit ce qu'une app doit
respecter pour tourner dans Grist Factory Suite (GFS) sans rien perdre quand elle tourne seule. Le pourquoi est dans le
cahier des charges (`cahier-des-charges-gfs.md`) ; ses numéros de section sont cités entre parenthèses. Le tableau d'ensemble
(ce qu'est GFS, ce qui est en jeu) est dans `gfs-en-bref.md`.

## En bref

- Une app reste **complète et autonome** : GFS ne lui retire rien, il l'héberge.
- **Dès maintenant, sans attendre GFS**, treize règles qui ne coûtent presque rien et évitent de la dette (section 1.1).
- **Pour Publipostage+, une seule chose est urgente** : la garde « type inconnu », avant que quiconque écrive un nouveau
  type de modèle dans sa table (section 2.2).
- **Quand GFS arrive** : le kit en sous-module, le manifeste `gfs.json`, la liste unique des bibliothèques natives, le
  contexte et le stockage par le kit, les extensions, dont la bibliothèque n'est plus dans le dépôt de l'app mais portée par
  GFS (section 1.2).

---

## 1. Règles communes à toutes les apps

### 1.1 À respecter dès maintenant

1. **Aucun import du code d'une autre app.** Ce qui sert à deux apps va dans le kit (cahier 4.5) ; en attendant le kit, on
   le note, on ne le copie pas.
2. **Le contenu de l'app vit dans des tables préfixées par l'app** (un modèle, un formulaire, un graphe, un tableau de bord).
   Les réglages de la vue ne gardent que ce qui se refait en un clic. Toute clé de réglage nouvelle porte le préfixe de
   l'app (cahier 5.5).
3. **Préserver l'inconnu** : un fichier d'un type que l'app ne sait pas ouvrir est listé grisé, jamais ouvert, jamais
   réenregistré, jamais proposé comme fichier de départ ; un nœud ou un attribut inconnu dans un contenu est gardé tel quel à
   l'enregistrement (cahier 5.4).
4. **Données** : changements additifs seulement ; tolérer les colonnes inconnues ; ne jamais écrire une colonne absente ;
   relire l'identifiant réel après un `AddTable` ; créer une table seulement avec l'accord de la personne, et préférer une
   ligne réservée d'une table existante (cahier 5.3).
5. **Ne rien déduire de `document.referrer` ni de sa propre adresse** (page, instance, document). Une seule fonction de
   l'app le fait, facile à remplacer par le kit (cahier 5.6).
6. **Stockage du navigateur** : chaque accès dans un `try/catch`, et l'app marche sans lui. Dans GFS, l'app tourne dans une
   origine opaque où `localStorage` lève une erreur (cahier 5.7).
7. **Messages** : `addEventListener('message')` en vérifiant `event.source`, jamais `window.onmessage =`. Cette affectation
   remplacerait l'écoute du script d'API de Grist (`grist-plugin-api.ts`, ligne 520) et couperait l'app de Grist.
8. **Tables internes de Grist** (`_grist_*`) : aucune écriture sans une raison écrite. Elle devra être déclarée dans le
   manifeste, sinon le courtier la refusera.
9. **Une bibliothèque nouvelle** : si l'app ne marche pas seule sans elle (native, comme celles de l'éditeur et des
   exports), une version exacte, inscrite dans la liste de l'app, chargée au premier usage si elle est lourde, jamais par
   un lien CDN non figé. Si c'est celle d'une extension (non native), elle ne s'inscrit ni dans la liste, ni dans l'import
   map de l'app : l'extension dit seulement l'identifiant et la version exacte qu'elle exige, et GFS porte le reste (cahier
   4.7). Seule la CSP de la page garde l'adresse exacte que le catalogue de GFS donne pour le mode CDN : GFS ne peut imposer
   aucune politique à un sous-cadre (mesuré à l'étape 2), et sans cette adresse le navigateur refuse le CDN. L'app le lui
   demande dans son `GFS-ETAT.md` et ne pousse jamais chez GFS (`consignes/LISEZ-MOI.md`, « Demander à GFS »).
10. **Une fonction lourde nouvelle naît comme une extension** : son code dans un dossier à part, atteint seulement à son
    premier usage ; ses points d'entrée (bouton, ligne de menu, type, export) déclarés à un seul endroit ; le grisé dessiné
    par le socle, pas par chaque point d'entrée (cahier 4.6). Le code de la fonction reste dans l'app ; sa bibliothèque lui
    vient de GFS, par un seul point d'accès dans l'extension (règle 9).
11. **CSP stricte** : une adresse s'ajoute à la politique de sécurité de la page consciemment, avec ce qu'elle sert à faire.
12. **La charte Grist Factory** (cahier 3.4 ; `contexte/charte-ui-ux-grist-factory.md`, section 1).
13. **Ne jamais écrire** qu'activer ou cocher un module rend l'app plus sûre.

### 1.2 Quand GFS arrive (étapes 3 à 5 du plan, cahier 10)

1. Référencer le kit en sous-module (`kit/`) et remplacer ses propres copies par celles du kit, une à une, sans changer
   l'interface : accès à Grist, traduction, jetons et thème, fenêtres, liste avec recherche, couches, consentement des
   tables, rappel « Enregistrer ».
2. Écrire `gfs.json` à la racine du dépôt (cahier 5.1).
3. Passer à la liste unique des bibliothèques natives (`package.json` à la racine, versions exactes) et à l'outil du kit qui
   en tire import map, CSP, empreintes, miroir des tests et version vendorisée ; activer Dependabot (`npm`). Celles des
   extensions n'y sont pas : elles sont à GFS.
4. Passer le contexte et le stockage par le client du courtier du kit (avec ses replis quand l'app est seule).
5. Ranger les fonctions lourdes dans `extensions/`, avec le registre et le grisé du kit, et retirer leurs bibliothèques de la
   liste et de l'import map de l'app : GFS les porte (la CSP garde l'adresse du mode CDN, règle 9).
6. Montrer, dans l'app seule, la fenêtre du grisé (section 5).
7. Ajouter les tests du contrat (section 4) et vérifier avec l'outil d'audit ce que compte la surface de l'app seule : l'outil lit
   un `import()` dont le chemin commence par un texte fixe, il ne lit pas une adresse calculée (mesuré à l'étape 2). Une
   extension chargée par une adresse calculée sort donc de la surface, et son code n'est relu par aucun audit : le mode de
   chargement des extensions se décide avec GFS (cahier 3.3, point 2, question 12).

---

## 2. Publipostage+

Relevé sur `main` 92ecd58 (14/10/2026). Le dépôt avance vite : relire les numéros de ligne sur `origin/main` avant de s'en
servir.

### 2.1 Déjà conforme

- Modèles et données dans des tables préfixées `Publipostage_` (`Modeles`, `Commentaires`, `LiensTables`, `Abreviations`,
  `PreferencesModeles`, `FormatsPage`, `UserProbe`).
- Réglages de la vue d'un clic seulement : `modeleDeLaVue`, `modeleSelonLigne`, `droitsAcces`, `dateDernierExport`, avec le
  rappel « Enregistrer » (`js/save-reminder.js`).
- Tables créées avec l'accord de la personne (`js/table-consent.js`).
- Stockage du navigateur (`pp_*`) toujours dans des `try/catch` : l'app marche sans.
- Téléchargements par un `<a download>` (`js/export-common.js`, `downloadBlob`, ligne 92).
- Moteurs d'export chargés au premier usage (`<script type="text/x-lazy-engine">` dans `index.html`,
  `ExportEngines.ensure`) : c'est déjà le patron des extensions.
- Charte : Publipostage+ en est la source.
- Une seule écriture dans une table interne : `_grist_Tables_column` (`js/template-pack.js`, ligne 255, colonne affichée
  d'une Référence créée par la galerie). Elle sera déclarée dans le manifeste.

### 2.2 À faire dès maintenant

**La garde « type inconnu », avant tout nouveau type de modèle.** Aujourd'hui, un modèle dont `TypeModele` vaut une valeur
que l'app ne connaît pas (« presentation », par exemple) s'ouvre comme un document (`js/main.js`, `typeModeleOf`,
ligne 330 ; seul `macro` a sa branche, ligne 270) et peut devenir le modèle de départ (`js/templates.js`,
`canBeDocumentDefault`, ligne 451, n'exclut que `email` et `macro`). S'il est réenregistré, il est abîmé. La garde :

- un type inconnu n'est jamais chargé dans l'éditeur, jamais enregistré, jamais proposé comme ★ ;
- il est listé grisé dans le sélecteur et dans « Organiser », avec deux textes possibles : « Demande l'extension
  {nom} (Grist Factory Suite) » pour un type que le socle connaît mais dont l'extension manque (`{nom}` est le nom lisible de
  l'extension, celui de son manifeste, dans la langue de l'interface), « Créé avec une version plus récente de Publipostage+ »
  pour un type que le socle ne connaît pas ;
- son test échoue sur le code d'aujourd'hui : un modèle `TypeModele = 'presentation'` n'est ni ouvert, ni réenregistré, ni
  proposé comme ★.

**Les règles de la section 1.1, au fil des lots**, en particulier :

- aucune définition nouvelle dans les réglages de la vue ; une clé nouvelle prend le préfixe `pp_`, celui des clés du
  navigateur (défaut pris ici, à changer si le porteur préfère un autre préfixe) ;
- une bibliothèque nouvelle dont l'app a besoin pour marcher seule s'inscrit, comme aujourd'hui, dans l'import map, dans la
  CSP et dans `dev-tests/.offline-cache/package.json` (la liste unique viendra à l'étape 4) ; celle d'une extension ne
  s'y inscrit pas, GFS la porte (règle 9) ;
- aucune lecture nouvelle de `document.referrer` ;
- les fonctions lourdes à venir (diapositives, temps réel, formats Office) naissent en extensions, et le graphique en est le
  pilote : sa consigne est posée (`consignes/publipostage/`), Plotly quitte alors la liste et l'import map de l'app ; la CSP de
  sa page garde l'adresse du mode CDN.

### 2.3 Quand GFS arrive

- **Kit** : Publipostage+ est la source du kit ; elle devient ensuite cliente de son propre code extrait, en rejouant ses
  tests à chaque remplacement (non-régression stricte).
- **Liste unique** : `package.json` à la racine, tiré de `dev-tests/.offline-cache/package.json` (45 paquets aujourd'hui,
  dont Plotly, qui passe à la liste de GFS avec le graphique) ; l'outil du kit régénère l'import map et la CSP
  d'`index.html`, les empreintes et le miroir des tests.
- **Où est Grist** : `fixBaseUrl` (`js/grist-api.js`, lignes 930 à 944) lit `document.referrer` pour corriger une instance
  auto-hébergée mal réglée. Dans GFS, le référent est l'adresse de GFS : la fonction passe par le kit.
- **Stockage** : les clés `pp_*` (liste `STORED` de `outils/depot-propre/controles.mjs`) passent par le stockage du kit.
- **Manifeste** : `gfs.json`, d'après l'exemple du cahier (5.1).
- **Extensions** : le graphique dans `extensions/graphique/` (pilote), puis diapositives, temps réel, formats Office. Leur
  code reste dans l'app ; leur bibliothèque est à GFS : l'entrée du manifeste dit l'identifiant et la version exacte qu'elles
  exigent, rien de plus (contrats 2.6).
- **Publication** : l'outil d'envoi (`outils/depot-propre/`) publie `gfs.json`, `extensions/` et la référence au kit ; la
  carte du code gagne une ligne par extension.

### 2.4 À ne pas faire

- Pas de deuxième page d'entrée dans le dépôt public : l'outil d'audit additionnerait les deux ; la version vendorisée se
  livre à part.
- Pas « tout vendoriser » ; pas de lien CDN non figé.
- Pas de bouton de plus dans la barre d'outils (gelée) : l'explorateur s'ouvre par « Organiser ».
- Pas de calcul dans le widget.
- Pas d'écriture de réglage sans geste de la personne : Grist afficherait « Enregistrer » pour rien.

---

## 3. Les autres apps

| App | Ce qui manque pour GFS (relevé le 14/10) | Premier pas |
|---|---|---|
| Form+ (`FormPlus`, b073d03) | Définition entière dans les réglages de la vue, écrite par `grist.setOptions` ; écrit `_grist_Views_section` et `_grist_Views_section_field` (`poc/js/config-editor.js`, lignes 1017 et 1064) ; page et instance tirées de `document.referrer` (`poc/js/links.js`, ligne 77) ; pas de CSP ; une face publique hors de Grist (`poc/public-form.html`) | Définition dans une table préfixée ; écriture `_grist_*` déclarée et justifiée, ou retirée ; contexte par le kit ; CSP du kit |
| Automation+ (`GRIST_automation`, ee8f0a9) | Graphe dans les réglages de la vue (`grist.setOption('workflow', …)`, `js/main.js`, ligne 58) ; tables prévues `_Automation_*`, or Grist retire les « _ » de tête (`sandbox/grist/identifiers.py`, ligne 36) : elles s'appelleraient `Automation_*` ; fenêtres, traduction, thème et jetons refaits ; ne tourne que vue ouverte | Premier client du kit ; graphe dans une table `Automation_…` ; section à part dans GFS (cahier, question 4) |
| Grist-BI (`Grist-BI`, c8c819f) | Toutes ses bibliothèques vendorisées dans `js/vendor/` (ECharts, DuckDB-WASM de 34 Mo, Arrow, xlsx), pdfmake et PptxGenJS sur cdnjs ; pas de CSP ; son propre accès à Grist ; table `BI_Dashboard_Config` | Liste unique, mode CDN par défaut (DuckDB-WASM depuis un CDN : à essayer) ; CSP du kit ; action « insérer » (le rendu portable d'une tuile) |
| Slides+ (`SlidesPlus`, 747a700) | Pas une app de GFS : les diapositives deviennent une extension de Publipostage+ ; son dossier `shared/` est fait de copies adaptées de Publipostage+ | Ne plus l'enrichir ; le garder comme référence |
| Dashboard, Thusday | N'existent pas | Naître sur le kit, avec `gfs.json`, une liste unique et la charte dès le premier commit |

---

## 4. Tests du contrat (dans chaque app)

- **Inconnu** : un fichier d'un type inconnu n'est ni ouvert, ni réenregistré, ni proposé par défaut ; un contenu qui porte
  un nœud d'une extension absente se réenregistre à l'identique.
- **Données** : aucune écriture d'une colonne absente (rejoué avec une table à qui il manque une colonne).
- **Réglages** : l'app n'écrit que les clés de son manifeste, et jamais sans un geste.
- **Stockage** : l'app démarre et marche quand `localStorage` lève une erreur.
- **Bibliothèques d'extension** : ni la liste ni l'import map de l'app ne nomment la bibliothèque d'une de ses extensions, et
  la CSP de sa page ne la nomme que par l'adresse du catalogue de GFS (garde de code, comme `codeHygiene`).
- **Contexte et messages** : aucune lecture de `document.referrer` hors de la fonction prévue, aucun `window.onmessage =`
  (gardes de code, comme le groupe `codeHygiene` de Publipostage+).
- **Aller-retour** : seule, puis GFS, puis seule, sans perte, dans un vrai Grist (dès que GFS v0 existe).

---

## 5. Texte du grisé (proposition)

Dans l'app seule, un clic sur une fonction grisée ouvre cette fenêtre (base commune des fenêtres, largeur 400) :

> **Cette fonction demande Grist Factory Suite**
>
> « {fonction} » fait partie de l'extension « {extension} », disponible quand {app} tourne dans Grist Factory Suite.
>
> Pour l'ajouter sans rien perdre : dans le panneau de droite de Grist, remplacez l'adresse du widget par celle de Grist
> Factory Suite : {adresse} (« Copier »). Ne passez pas par la galerie des widgets : elle effacerait les réglages de cette
> vue.
>
> Vos modèles et vos réglages restent tels quels, et vous pourrez revenir à l'adresse de {app} à tout moment.
>
> [Fermer]

> **This feature needs Grist Factory Suite**
>
> "{feature}" is part of the "{extension}" extension, available when {app} runs inside Grist Factory Suite.
>
> To add it without losing anything: in Grist's right panel, replace the widget's address with the Grist Factory Suite
> address: {address} ("Copy"). Do not use the widget gallery: it would erase this view's settings.
>
> Your templates and settings stay as they are, and you can switch back to the {app} address at any time.
>
> [Close]

Les mots exacts du panneau de Grist (nom du champ de l'adresse, en français et en anglais) sont à relever dans un vrai Grist
avant d'écrire le texte définitif.
