# 004 · Le graphique en extension

App : Publipostage+ · posée le 14/10/2026 · quand : avant la V0.2 du prototype de GFS (activer ou non le graphique), après
la 003 ; dans l'app seule, le graphique devient grisé

## Quoi

Le graphique de la page (`js/chart-block.js`, `js/chart-plot.js`, `js/chart-source.js` et `css/chart-block.css`) devient
l'extension `graphique` de l'app (cahier 4.6 ; guide 1.1 point 10, 2.2 et 2.3 ; contrats 2.6). Défaut pris : son code reste
dans le dépôt de Publipostage+ ; si le porteur le met dans GFS, une nouvelle consigne remplace celle-ci.

1. **Un dossier à part, atteint seulement au premier usage.** Les trois fichiers et la feuille de style vont dans
   `extensions/graphique/`. Ils ne se chargent qu'au premier usage du graphique, et seulement si `graphique` figure dans
   `contexte.extensions` (contrats 5.2), au démarrage ou après l'événement `extensions`, comme les moteurs d'export
   (`ExportEngines.ensure`, guide 2.1). L'outil d'audit ne doit pas les compter dans la surface de l'app seule (guide 1.2
   point 7, à vérifier) : si les balises de `index.html` (lignes 125 et 844 à 846 sur `89ebdd2`) les lui font compter, un
   registre de l'extension, dans le socle, nomme les fichiers à leur place.
2. **Le socle garde la forme du graphique, pas son dessin.** Le nœud `img.editor-image` et ses attributs `chartSection`,
   `chartScope` et `chartName` (`js/editor-nodes.js`), le nom et l'icône de la fonction et le texte du grisé restent dans le
   socle. Les appels à `ChartBlock` hors de ses fichiers (`js/editor-nodes.js`, `js/main-toolbar.js`, `js/main.js` et
   `js/reader-mode.js` sur `89ebdd2`) passent par un seul point d'entrée, qui répond aussi quand l'extension est absente.
3. **Sans l'extension : grisé, jamais caché, rien de perdu.**
   - La ligne « Graphique de la page… » du menu « Lien et blocs de contenu » est grisée, pas retirée.
   - Un modèle qui porte un graphique s'ouvre avec un cadre grisé qui garde son nom, et se réenregistre à l'identique, tous
     ses attributs compris. À la Lecture et à l'export, une note prend sa place (comme « [Graphique indisponible] »
     aujourd'hui).
   - Le clic sur la fonction grisée ouvre, dans l'app seule, la fenêtre du guide (section 5, en français et en anglais) ; dans
     GFS, quand l'extension est inactive, il appelle `installer` (contrats 5.4). L'adresse de GFS que montre la fenêtre est
     tenue en un seul endroit : GFS la donnera par une consigne quand il sera publié.
4. **La bibliothèque n'est plus écrite en dur dans le dessin.** `LIB` (`js/chart-plot.js`, ligne 11 : l'adresse de Plotly 2.13.2
   et son empreinte) devient une valeur que le chargeur de l'extension fournit. Sans autre indication, c'est l'adresse et
   l'empreinte d'aujourd'hui : rien ne change pour la personne. En version vendorisée, GFS donnera lui-même la source ; la
   forme du message se fixe avec la V0.2 du prototype et viendra par une consigne : ne pas l'inventer d'ici là. La CSP de la
   page garde l'adresse de Plotly.
5. **Au passage.** `extensions/` s'ajoute à la liste publiée de l'outil d'envoi (`PUBLIES`, `outils/depot-propre/publier.sh`),
   qui refuse sinon un dossier inconnu à la racine.

Pas dans cette consigne : le manifeste `gfs.json` (étape 5) et le kit (étape 3). Lignes relevées sur `89ebdd2` le 14/10, à
relire sur `origin/main`.

## Pourquoi

Au prototype (V0.2), le porteur veut activer ou non le graphique depuis GFS, en CDN ou en version vendorisée, et que sa
bibliothèque ne soit plus dans le code de base de l'app : c'est l'extension pilote (cahier 4.6, guide 2.2). Il faut pour cela
que la fonction vive hors du socle, ne se charge que si GFS l'a activée, et que le socle sache la griser sans rien perdre
(cahier 5.4, guide 4).

## Fait quand

Des tests échouent sur le code d'avant et passent après :

- seule (pas de `gfs` dans l'adresse) : aucun fichier de `extensions/graphique/` n'est demandé, ni au démarrage ni à
  l'ouverture d'un modèle qui porte un graphique ; la ligne de menu est grisée ; le modèle se réenregistre à l'identique (le
  test « Inconnu » du guide, section 4) ; le clic ouvre la fenêtre du grisé ;
- hébergée, avec un GFS simulé par le test et `contexte.extensions = ['graphique']` : le graphique marche comme avant, et ses
  tests actuels (`dev-tests/scenarios-chart-block.js`, `dev-tests/verify-chart-mouse.mjs`) passent sans changer de sens ;
- l'événement `extensions`, envoyé puis retiré, fait passer la fonction de grisée à active, puis de nouveau à grisée ;
- l'adresse de Plotly n'existe plus qu'à un seul endroit de l'extension.

À vérifier comme le reste de l'interface : 700 × 400, clair et sombre, français et anglais. `GFS-ETAT.md` donne la ligne
« 004 · faite · `commit` ».
