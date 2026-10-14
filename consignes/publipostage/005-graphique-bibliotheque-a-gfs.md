# 005 · Le graphique en extension, sa bibliothèque à GFS

App : Publipostage+ · posée le 14/10/2026 · remplace la 004 · quand : avant la V0.2 du prototype de GFS (activer ou non le
graphique, en CDN ou en version vendorisée), après la 003 ; dans l'app seule, le graphique devient grisé

## Quoi

Le porteur a tranché le 14/10 : les dépôts des apps restent propres et auditables. Le code de la fonction graphique (la façon
dont Publipostage+ gère ses graphiques) reste dans Publipostage+ ; toute la partie dépendance (Plotly, en CDN ou vendorisé,
son chargement, sa CSP, sa liste, ses empreintes) est portée par GFS (cahier 4.7 ; guide 1.1 points 9 et 10 ; contrats 2.6).
La 004 laissait l'adresse de Plotly et sa CSP dans l'app : elle ne vaut plus. Le graphique de la page (`js/chart-block.js`,
`js/chart-plot.js`, `js/chart-source.js` et `css/chart-block.css`) devient l'extension `graphique` de l'app :

1. **Le code de la fonction : un dossier à part, atteint seulement au premier usage.** Les trois fichiers et la feuille de
   style vont dans `extensions/graphique/`. Ils ne se chargent qu'au premier usage du graphique, et seulement si `graphique`
   figure dans `contexte.extensions` (contrats 5.2), au démarrage ou après l'événement `extensions`, comme les moteurs
   d'export (`ExportEngines.ensure`, guide 2.1). L'outil d'audit ne doit pas les compter dans la surface de l'app seule
   (guide 1.2 point 7, à vérifier) : si les balises de `index.html` (lignes 125 et 844 à 846 sur `89ebdd2`) les lui font
   compter, un registre de l'extension, dans le socle, nomme les fichiers à leur place.
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
4. **Plotly sort de l'app.** Il ne figure plus dans la liste de l'app (`dev-tests/.offline-cache/package.json`, ligne 49 sur
   `89ebdd2`) ni dans la CSP de la page (`index.html`, ligne 20) ; il n'est pas dans l'import map. L'éditeur et les exports,
   sans lesquels l'app ne marche pas seule, gardent leurs bibliothèques : seule celle du graphique est concernée. Le dessin
   n'appelle `window.Plotly` que par un seul point d'accès de l'extension (nom au choix du projet), qui rend la bibliothèque
   dans une promesse. La version exacte que le dessin exige (2.13.2, celle de Grist) est écrite à un seul endroit de
   l'extension : elle ira dans son entrée du manifeste, `bibliotheques` (contrats 2.6, étape 5).
5. **La bibliothèque vient de GFS.** Hébergée, le point d'accès la reçoit ainsi (contrats 5.2, un défaut que le prototype V0.2
   essaie et peut changer, GFS le dira alors par une consigne) : GFS donne une adresse et une empreinte pour `plotly` dans
   `contexte.bibliotheques` et dans l'événement `extensions`, et l'extension charge la bibliothèque par cette adresse avec
   l'empreinte, comme le fait déjà `ExportCommon.loadScriptOnce` (repris, pas recopié). Aucune adresse de la bibliothèque du
   graphique n'est écrite dans l'app. Les tests du graphique jouent GFS : ils donnent cette source au point d'accès ; la copie du
   miroir des tests (`umd/plotly-basic.min.js`) ne vient plus de la liste de l'app, et d'où les tests la prennent est au
   projet de l'app, qui le dit à GFS dans `GFS-ETAT.md` s'il bloque.
6. **Au passage.** `extensions/` s'ajoute à la liste publiée de l'outil d'envoi (`PUBLIES`, `outils/depot-propre/publier.sh`),
   qui refuse sinon un dossier inconnu à la racine.

Pas dans cette consigne : le manifeste `gfs.json` (étape 5), le kit (étape 3) et le choix CDN ou vendorisé, qui se fait dans
GFS. Lignes relevées sur `89ebdd2` le 14/10, à relire sur `origin/main`.

## Pourquoi

Au prototype (V0.2), le porteur veut activer ou non le graphique depuis GFS, en CDN ou en version vendorisée, et que le dépôt
de l'app reste simple à auditer : la bibliothèque, sa liste, sa CSP et ses empreintes sont un travail de GFS, fait une fois
pour toutes les apps, pas une copie dans chaque dépôt. Il faut pour cela que la fonction vive hors du socle, ne se charge que
si GFS l'a activée, reçoive sa bibliothèque de GFS, et que le socle sache la griser sans rien perdre (cahier 4.6 et 5.4,
guide 4). C'est l'extension pilote (guide 2.2).

## Fait quand

Des tests échouent sur le code d'avant et passent après :

- une garde de code (guide 4, « Bibliothèques d'extension ») : ni la liste de l'app, ni l'import map, ni la CSP d'`index.html`
  ne nomment Plotly ;
- seule (pas de `gfs` dans l'adresse) : aucun fichier de `extensions/graphique/` n'est demandé, ni au démarrage ni à
  l'ouverture d'un modèle qui porte un graphique ; la ligne de menu est grisée ; le modèle se réenregistre à l'identique (le
  test « Inconnu » du guide, section 4) ; le clic ouvre la fenêtre du grisé ;
- hébergée, avec un GFS simulé par le test qui donne `extensions = ['graphique']` et la source de la bibliothèque : le
  graphique se dessine comme avant, et ses tests actuels (`dev-tests/scenarios-chart-block.js`,
  `dev-tests/verify-chart-mouse.mjs`) passent sans changer de sens ;
- l'événement `extensions`, envoyé puis retiré, fait passer la fonction de grisée à active, puis de nouveau à grisée.

À vérifier comme le reste de l'interface : 700 × 400, clair et sombre, français et anglais. `GFS-ETAT.md` donne la ligne
« 005 · faite · `commit` ». La livraison réelle de la bibliothèque, en CDN et en vendorisé, se mesure ensuite avec le
prototype, dans un vrai Grist.
