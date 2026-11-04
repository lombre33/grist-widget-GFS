# 007 · Entrer dans GFS : démarrer dans son cadre isolé, puis un rapport BI est une ligne nommée de `BI_Dashboard_Config`

App : Grist-BI · posée le 04/11/2026 · contrats de GFS 2.4 et 5.2 à 5.4, guide des apps 1.1 (règles 4 et 6) et 4 (test « Stockage ») · demande du porteur du 04/11 (« créer un nouveau document BI dans le menu Nouveau :
il faudrait un nom et un type de document à suggérer »), qui a choisi « Rapport BI » ·
quand : au prochain lot ; du code dans ton app ; le point 1 d'abord, il tient en quatre lignes et c'est lui qui empêche ton app de démarrer dans GFS

## Quoi

**1. Ce que GFS a fait de son côté** (rien à faire chez toi). Grist-BI est dans le catalogue de GFS : ton dépôt est référencé à `474d67f` (le code de `fef9af8`, que ta page décrit ; seule ta page d'état change entre les deux) ;
un manifeste provisoire (`prototype/manifestes/bi.json`) nomme ta table de fichiers (`BI_Dashboard_Config`), ton type « Rapport BI » (en : « BI report », valeur `rapport`, icône en barres, sans couleur de famille), la capacité
`formules` (la table-sonde de l'adresse e-mail) et les deux tables internes que tu lis (`_grist_Tables`, `_grist_Tables_column`), chacune avec sa raison. Le menu « Nouveau » de l'explorateur propose « Rapport BI » ;
l'explorateur liste une ligne de `BI_Dashboard_Config` par rapport. Le nom est celui du porteur : « Tableau de bord » reste libre pour l'app Tableau de bord, qu'il annonce à part de Grist-BI.

**2. Ce que GFS a mesuré**, ton code non modifié, dans le sous-cadre isolé de GFS, dans un vrai Grist (`prototype/labo/run-bi.mjs`) :

- **L'app ne démarre pas.** Le sous-cadre n'a pas d'origine : y lire `localStorage` lève une erreur, `typeof localStorage` compris. `js/i18n.js:332` (`let lang = (typeof localStorage !== 'undefined' && …)`) tombe,
  `GristBI.i18n` n'existe pas, `js/charts.js:13` et `js/main.js:37` échouent (« Cannot destructure property 't' of 'GristBI.i18n' as it is undefined »), et l'app reste sur sa page statique, non traduite, sans rien d'actif.
  Trois autres endroits ont le même défaut : `js/i18n.js:389` (`setLang`), `js/main.js:886` et `:890` (l'auteur du commentaire) : le `try` est là, mais le `typeof` qui le précède est dehors.
- **Ces quatre lignes gardées par un `try` suffisent.** Avec elles (essai sur une copie, rien de poussé) : l'app démarre, le courtier ne lui refuse rien, aucune erreur de script ; le choix de « Clients » crée
  `BI_Dashboard_Config`, `BI_Dashboard_Comments` et `BI_Dashboard_UserProbe` (la sonde ajoute puis retire une ligne) et UNE ligne de configuration. Les trois tables naissent sans l'accord de la personne : l'écart à la
  règle 4 que ta 001 relève déjà.
- **Un rapport n'a pas de nom.** `BI_Dashboard_Config` n'a que `TableId` et `ConfigJSON`, une ligne par table de travail. Dans l'explorateur, chaque ligne est un « Rapport BI » appelé « (sans nom) », sans date ni auteur ;
  F2 dit « Grist-BI ne dit pas où est le nom de ses fichiers : renomme celui-ci dans Grist-BI » et n'écrit rien (GFS n'écrit jamais une colonne absente).
- « Nouveau > Rapport BI » et le double-clic d'un rapport ouvrent ton app sur sa page habituelle, et GFS dit « Provisoire : Grist-BI ne sait pas encore ouvrir un fichier précis… » (comme pour Form+ avant sa 010) ;
  rien n'est écrit dans le document.

**3. Ce que tu changes**, dans cet ordre (chaque point peut être un commit) :

1. **Le stockage** (guide, règle 6 ; test « Stockage » de la section 4). Mets le `typeof localStorage` dans le `try`, aux quatre endroits : la lecture de la langue (`i18n.js:332`), son écriture (`:389`), la lecture et l'écriture
   de l'auteur du commentaire (`main.js:886`, `:890`). Ajoute le test que le guide demande : l'app démarre et marche quand `localStorage` lève une erreur (une page dans un cadre `sandbox` sans `allow-same-origin`).
   Sans ce point, rien d'autre de cette consigne n'a d'effet dans GFS.
2. **Un rapport est une ligne nommée** (guide 1.1, règle 4 ; contrats 2.4). Ajoute à `BI_Dashboard_Config`, sans rien retirer ni renommer (`TableId` et `ConfigJSON` restent ce qu'ils sont) : `Nom` (texte, le nom du
   rapport), `TypeRapport` (texte, `rapport`), `DateModif` (DateTime, en secondes) et `ModifiePar` (l'adresse, ou « Nom <adresse> » comme Publipostage+). Ce sont les noms du manifeste ; si tu en veux d'autres, dis-le dans ta
   page. Règle 4 : des colonnes ajoutées à la table qui existe (comme ton `ensureColumnsUpToDate`), jamais d'écriture dans une colonne absente (un seul champ inconnu fait tomber tout le lot), l'identifiant réel relu après un
   `AddTable`. Puis :
   - **Plusieurs rapports par table de travail.** `TableId` désigne la table de travail du rapport, plus une clé unique : aujourd'hui `loadConfig` et `saveConfig` prennent la première ligne qui porte la table. Le rapport est
     repéré par sa ligne (`id`).
   - **Un nom à chaque rapport**, unique dans la table (au renommage, GFS refuse un nom que porte déjà un autre fichier de la table) ; pour un rapport nouveau, « Rapport BI 1 », « Rapport BI 2 »… (en : « BI report 1 »,
     « BI report 2 »…), dans la langue de la personne, au premier enregistrement.
   - **Les lignes d'avant** (sans `Nom`) se lisent toujours : à leur premier enregistrement, sur un geste de la personne et jamais au démarrage, elles reçoivent `Nom` (le `TableId`, par exemple « Clients »), `TypeRapport`, la
     date et l'auteur. Rien ne s'écrit en lecture seule. Un `TypeRapport` que tu ne connais pas n'est ni ouvert, ni réenregistré (guide, test « Inconnu »).
   - **Le nom se change à deux endroits** (F2 dans l'explorateur de GFS, et ton app) : une seule colonne, `Nom`.
3. **Le lien avec GFS du kit 0.7.0** (tu l'as pris à la 004 : `Ambiance.start()` démarre déjà le lien ; prends `GfsLink` dans `kit/js/gfs-link.js` pour le reste, sans second lien) :
   - **Au démarrage**, après `await GfsLink.ready`, `GfsLink.opening()` donne `{ fichier, type, dossier, raison }`, ou null. `fichier.id` (en texte) est l'`id` de la ligne : ouvre ce rapport. `fichier` null (`raison` vaut
     `nouveau`) : ton écran de départ habituel, avec un rapport vierge dont la ligne ne s'écrit qu'au premier enregistrement (« Nouveau » n'écrit rien). Seule, `opening()` est null : ton app ne change pas.
   - **App déjà ouverte** : `GfsLink.onOpen(async ({ fichier, type }) => …)`, même règle. Avec des modifications en attente, ce que ta 006 décrit d'abord. Rends `true` une fois ouvert (rien à recharger quand c'est déjà ce
     rapport), `false` si la personne annule.
   - **La langue et ce que ton cadre garde.** Dans GFS, la langue est un seul choix pour GFS et ses apps (5.2, point 6) : `GfsLink.onLanguage(language => …)`. La clé `gristbi_lang` et l'auteur du commentaire passent par
     `GfsLink.storageGet` / `storageSet` quand l'app est hébergée (contrats 5.3), par `localStorage` sinon. Dis dans ta page comment ton app suit la langue (retraduite ou rechargée).

**4. Ce qui vient** (une annonce, rien à faire maintenant). Quand le point 3 est fait, GFS passe ton ouverture à « sait ouvrir » : « Nouveau > Rapport BI » et le double-clic d'un rapport démarrent ton app sans la phrase
provisoire. Tes trois tables sans l'accord de la personne (règle 4) restent l'écart que ta 001 a relevé.

## Pourquoi

1. Le porteur veut créer un document BI depuis « Nouveau », comme un formulaire ou un modèle : sans fichier nommé chez l'app, GFS n'a rien à lister ni à créer. Il a choisi « Rapport BI » (contre « Analyse ») et gardé
   « Tableau de bord » pour l'app dédiée.
2. Le point 1 n'est pas une nouveauté : c'est la règle 6 du guide, que ton app ne tient pas aujourd'hui dans le sous-cadre de GFS.
3. Une ligne par rapport permet d'en avoir plusieurs par table et de les ranger comme les autres fichiers (dossiers, favoris : GFS les garde chez lui, rien de plus à écrire chez toi).

## Fait quand

`GFS-ETAT.md` donne « 007 · faite · `xxxxxxx` » (le point 1 seul : « 007 · en cours · point 1 `xxxxxxx` »), et dit : les noms exacts des colonnes ajoutées, ce que deviennent les lignes d'avant, comment les noms restent uniques,
comment ton app suit la langue ; « Changements qui touchent GFS » liste les colonnes. GFS rejoue alors `run-bi` avec ton commit (au point 1, la ligne « l'app démarre » doit passer de CONSTAT à OK), avance la référence et,
au point 3, passe l'ouverture à « sait ouvrir » (« Nouveau », double-clic, app déjà ouverte, langue).
