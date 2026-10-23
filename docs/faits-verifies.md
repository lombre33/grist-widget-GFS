# Faits vérifiés pour GFS (au 14/10/2026)

Chaque fait dit où il a été lu ou mesuré. Le code de Grist est celui de la branche principale de `grist-core`, lu par
jsDelivr (`https://cdn.jsdelivr.net/gh/gristlabs/grist-core@main/<chemin>`) : ce n'est pas forcément celui de l'instance
visée (grist.numerique.gouv.fr). Un comportement de Grist se vérifie dans sa source ou dans un vrai Grist, jamais de
mémoire ni contre un faux Grist écrit par nous. Les numéros de ligne bougent : les relire avant de s'en servir.

## 1. Grist : le cadre du widget et ses messages

- `app/client/components/WidgetFrame.ts` : le cadre est créé sans `sandbox`, avec seulement `allow="clipboard-write"`
  (`buildDom`, ligne 219) ; `_onMessage` (ligne 260) n'accepte que les messages dont `event.source` est ce cadre ; les
  réponses partent par `postMessage(msg, "*")` (ligne 129) ; l'accès et la lecture seule sont ajoutés à l'adresse du cadre
  (`_urlWithAccess`, ligne 236) ; `configure` (ligne 842) applique à la section l'accès voulu et les colonnes à mapper
  déclarés par `grist.ready()` ; les réglages ne passent pas d'un widget à l'autre, « by design » (ligne 563).
- `app/plugin/grist-plugin-api.ts` : le widget envoie à `window.parent` avec `"*"` (ligne 519) et écoute par
  `window.onmessage = (e) => rpc.receiveMessage(e.data)` (ligne 520), sans vérifier l'expéditeur, par une **affectation** :
  un autre `window.onmessage =` dans la page la remplacerait. `print` est enregistré et appelle `window.print()`
  (ligne 525) ; `editOptions` aussi (ligne 485). Interfaces appelées (lignes 51 à 97) : `GristAPI`, `GristDocAPI@grist`,
  `GristView`, `WidgetAPI`, `CustomSectionAPI`, `CommandAPI`.
- Protocole `grain-rpc` 0.1.7 (paquet npm, `dist/lib/message.d.ts`) : `mtype` 1 = appel (`mdest?`, `reqId?`, `iface`,
  `meth`, `args`), 2 = réponse (`reqId`, `data`), 3 = erreur (`reqId`, `mesg`, `code?`), 4 = message (`mdest?`, `data`),
  5 = prêt. `_dispatch` (`dist/lib/rpc.js`) ignore sans erreur un message dont le `mtype` est inconnu.
- Lu le 12/10 dans `grist-plugin-api.js` servi aux widgets : un widget lit et écrit les tables, lit et pose les réglages de
  sa section, suit la ligne choisie, déplace la ligne ou la sélection de sa table. **Aucune commande pour changer de page ni
  ouvrir une autre section.**
- Lu le 21/10 dans `grist-plugin-api.js` et `GristDoc.bundle.js` (grist-static 0.1.6) : la table d'un widget
  (`getSelectedTableIdSync`, `selectedTable`) est le `tableId` du **dernier message** reçu (`ready`, `_tableId = msg.tableId`) ;
  `onRecord` et `onRecords` relisent par `GristView.fetchSelectedRecord` et `fetchSelectedTable`. Celles-ci rendent les colonnes
  visibles de la section, une Référence par sa colonne affichée (`expandRefs`, vrai par défaut), et encodent un nombre d'une
  colonne Date, DateTime ou Référence (`['d', v]`, `['D', v, fuseau]`, `['R', table, v]`) ; `fetchSelectedTable` rend les lignes
  de la section filtrées et triées.
- Mesuré le 21/10 dans un vrai Grist (`labo/run-travail.mjs`, couche du labo seulement) : **une app reçoit une autre table que
  celle de la section de GFS sans changer**, si GFS lui envoie cette table dans ses messages et répond à ses lectures de la vue
  depuis `fetchTable`. Publipostage+ lit la convocation d'une inscription de Participants, GFS restant sur la page Clients, et
  suit un changement de ligne ; Automation+, ouverte ainsi sur Participants, traite en 1,1 à 1,6 s une inscription créée
  ailleurs (relecture toutes les 1,5 s ; deux passages). Automation+ lit sa table une fois, au démarrage.
- Mesuré le 21/10 (même essai, grist-static, tout dans le navigateur) : `fetchTable` d'une table de six colonnes, médiane de
  dix lectures, deux passages : 11 à 14 ms pour 1 000 lignes (70 Ko), 38 ms pour 5 000 (360 Ko), 135 à 166 ms pour 20 000
  (1,5 Mo). Relue toutes les 1,5 s, la table de 20 000 lignes retarde le fil de la page de Grist de plus de 50 ms à chaque
  relecture (9 fois en 15 s, 190 ms au plus), contre aucune fois sans relecture. **Non mesuré** : un vrai serveur Grist (lecture par le réseau).
- Mesuré le 22/10 (Chromium, `labo/run-importer.mjs`, sonde P) : **un objet `File` envoyé par `postMessage` à un sous-cadre isolé** (`sandbox`
  sans `allow-same-origin`, origine opaque) **arrive et se lit** : `instanceof File`, nom, taille, type et `text()` (accents compris),
  que l'app démarre (dans la réponse à son `contexte`) ou soit déjà ouverte (dans l'appel `ouvrir`). Les messages de GFS à l'app sont
  postés sans étape JSON (`postMessage(message, '*')`) : ce qui passe est un clone structuré. Le sélecteur de fichier est ouvert par
  GFS, dans le geste de la personne (un champ `file` caché cliqué dans le clic ou la touche Entrée) : un sous-cadre isolé n'a pas ce
  geste dans GFS, et GFS peut ainsi refuser une autre terminaison avant d'ouvrir l'app. **Non mesuré** : Firefox et WebKit (seul Chromium
  est installé dans le labo du cloud).
- Mesuré le 23/10 (Chromium, `labo/run-importer-pp.mjs`, la vraie Publipostage+ à `0c37c4b`, consigne 035 faite) : **les trois lecteurs de l'app lisent
  le `File` que GFS donne à un sous-cadre isolé** : le lecteur de Markdown (un document), ExcelJS (une grille de trois lignes et deux colonnes) et JSZip
  (une présentation de deux diapositives), au démarrage comme l'app déjà ouverte (sa question d'enregistrement, « Annuler » ne change rien, « Ne pas
  enregistrer » ouvre le fichier). Un fichier illisible est dit par l'app, qui garde son document ; rien n'est écrit dans le document. Les deux
  bibliothèques viennent du miroir du labo, aux octets exacts des CDN (même empreinte que celle que l'app épingle). **Non mesuré** : Firefox et WebKit.

**Conséquence** : une app dans un sous-cadre de GFS envoie ses messages à GFS, qui peut les relayer à Grist et rendre les
réponses, sans que l'app change.

## 2. Grist : réglages de la vue, galerie, accès

- `app/client/models/entities/ViewSectionRec.ts` (ligne 504) : adresse, accès, réglages et mappage vivent dans `customView`
  de la section.
- `app/client/ui/CustomWidgetGallery.ts` (`_saveCustomUrlWidget` ligne 380, `_saveRemoteWidget` ligne 397) : choisir un
  widget dans la galerie, adresse personnalisée comprise, remet l'accès à « aucun » et efface les réglages et le mappage.
- `app/client/ui/CustomSectionConfig.ts` (`_url`, ligne 436) : changer seulement l'adresse dans le champ du panneau de
  droite garde les réglages et l'accès.
- Mesuré dans un vrai Grist (grist-static 0.1.6, 05/10 et 09/10, `outils/labo-grist-reel/`) :
  - un widget ajouté par son adresse arrive **sans accès** (`?access=none`) ; l'API répond alors « Access not granted.
    Current access level none » ; avec « Read selected table », `listTables` est refusé aussi ;
  - chaque changement d'accès **reconstruit le cadre** du widget ;
  - `setOption` ne pose qu'un **brouillon** tant que la personne n'a pas cliqué « Enregistrer » dans Grist ; « Enregistrer »
    n'envoie **rien** au widget ; « Retour » renvoie les réglages enregistrés ; un écho `onOptions` arrive pour chaque
    réglage qui change vraiment ;
  - un widget ne voit que les lignes de **sa** section (tri et filtre de la section compris).
- Lu dans `WidgetFrame.ts` (13/10) : un widget n'est prévenu que des changements de la table de sa section ; `onRecords`
  relit toute la table dans la copie en mémoire de la page Grist (sans réseau) ; une colonne ajoutée par `AddColumn` est
  masquée dans la section (la lire avec `includeColumns: 'normal'`).
- Lu le 16/10 dans `WidgetFrame.ts` (les sources que le paquet grist-static 0.1.6 embarque dans ses cartes de sources, pas la
  branche principale) : `GristDocAPIImpl.fetchTable` rend `docComm.fetchTable(tableId)`, donc **un appel au serveur du
  document** ; `GristViewImpl.fetchSelectedTable` lit au contraire la copie en mémoire de la section (`sortedRows`,
  `tableData`) et ne rend que la table de la section. `TableNotifier` n'écoute que les champs (`viewFields`), les lignes
  (`sortedRows`, `rowNotify`) et le mappage de la **section** : rien ne prévient un widget du changement d'une autre table.
- Lu le 19/10 (mêmes sources de grist-static 0.1.6) : **la ligne choisie ne passe pas par les mêmes messages au `ready` et ensuite.**
  `RecordNotifier` (ligne 653) n'envoie son message de ligne (`{ tableId, rowId, dataChange: false }`) qu'au **changement de
  ligne** de la section, jamais au `ready` ; `TableNotifier._ready` (ligne 798) envoie, au `ready`, le message de table avec le
  `rowId` d'alors (ligne 808) et ne le refait que si les champs, les lignes ou le mappage de la section changent. Choisir une ligne dans
  le widget que la section suit (« Select by ») ne refait donc pas le message de table. Côté widget, `onRecord`
  (`grist-plugin-api.ts`, ligne 376) réagit à **tout** message qui porte un `tableId` et un `rowId` (celui de table compris), puis relit la ligne
  par `fetchSelectedRecord`. `ConfigNotifier` (ligne 681) redit le message de réglages, avec `settings.linking`
  `{ asTarget, asSource }`, à chaque changement des réglages **ou du lien** de la section (lignes 688 à 745) ; `asTarget` est la
  description du lien entrant (`linkTypeDescription`), `null` sans lien.
- Mesuré le 19/10 dans un vrai Grist (grist-static 0.1.6, Chromium, `labo/run-select-by.mjs`, la sonde I et le vrai Publipostage+) :
  section de GFS reliée au tableau CLIENTS (« Select by »), `settings.linking.asTarget` = `"Cursor:Same-Table"` (`null` quand le lien
  est retiré), puis la ligne 2 choisie **avant** d'ouvrir l'app : GFS qui rejouait le message de table du démarrage disait la ligne 1, et
  l'app lisait le mauvais client ; le lien retiré ou posé après l'ouverture n'arrivait pas à l'app (le message de réglages ne
  différait du précédent que par `linking`, et GFS ne comparait que la tranche de l'app). Les lignes choisies **après**
  l'ouverture arrivaient correctement (messages de ligne relayés).
- Lu le 21/10 (mêmes sources, `WidgetFrame.ts`, lignes 266 à 268) : **chaque** message `ready` du cadre redéclenche « ready »
  (`this.trigger('ready', this)`), donc le rejeu de chaque source d'événements (réglages, thème, table), et pas seulement le
  premier. Un widget qui recharge sa page dans le même cadre retrouve ainsi son état. Mesuré le même jour (`labo/run-recharge.mjs`,
  Form+ rechargée sur place dans GFS) : le courtier, qui ne rejouait qu'au premier `ready`, laissait l'app sans réglages, sans thème
  ni table ; il rejoue maintenant à chaque `ready` (contrats 4.2, point 2).
- Mesuré le 16/10 dans un vrai Grist (grist-static 0.1.6, Chromium 141, `labo/run-direct.mjs`) : trois widgets de
  `labo/sondes/direct/` sur deux tables d'un document de test, dans une seule page donc une seule horloge. Un widget écrit
  une ligne ; les autres notent l'heure où ils la voient. Médiane sur 40 lignes, **sans réseau** (le moteur de Grist tourne dans le
  navigateur) : écriture jusqu'au moteur 12 ms ; widget lié à la table écrite, prévenu par Grist **20 ms** (p90 25) ; relais de
  ce widget vers un widget lié à une autre table par `BroadcastChannel` **21 ms** (+1 ms) ; relecture par
  `docApi.fetchTable` à intervalle fixe, d'une table qui n'est pas celle de la section : **55 ms** (toutes les 100 ms ; p90 99),
  **156 ms** (250 ms ; p90 244), 265 ms (500 ms ; p90 462), 515 ms (1 000 ms ; p90 927). C'est la prévenance plus **la moitié
  de l'intervalle** (l'intervalle entier au pire) : les deux chemins paient les mêmes trajets, la relecture attend en plus
  le prochain tour. Réseau simulé à 50 ms par sens (écriture, prévenance, requête et réponse de la relecture) : prévenance
  122 ms, relecture à 250 ms 230 ms (p90 336), soit +108 ms, la demi-période. Une relecture coûte 5 à 9 ms pour 14 à 54 Ko,
  11 ms pour 130 Ko, 18 ms pour 280 Ko. **Non mesuré** : le réseau réel d'un Grist en ligne, plusieurs navigateurs ou comptes,
  les plafonds de l'offre, un widget de relais sur une autre origine que celle de GFS.
- Mesuré le 16/10 (même essai) : un widget en lecture de la table (« Read table ») ne peut pas demander
  `includeColumns: 'normal'` (« Setting includeColumns to normal requires full access. Current access level is read table »),
  et les colonnes que `AddColumn` ajoute sont masquées dans la section : un widget de relais est donc en accès complet,
  comme GFS.
- Mesuré le 19/10 dans un vrai Grist (grist-static 0.1.6, Chromium, `labo/run-section-ajoutee.mjs`) : **ajouter une section à la page
  recharge le cadre de la première**. Avec une sonde sans GFS comme première section, l'élément `<iframe>` reste le même (une
  propriété posée à la main dessus survit) mais son document change : l'ancien est détaché, la marque posée dans sa page a disparu.
  Avec GFS et Publipostage+ ouverte, GFS repart de zéro (l'explorateur, plus d'app), comme à un changement d'accès (contrats 3.1,
  point 6). **Non mesuré** : les autres changements de mise en page (déplacer, redimensionner, retirer une section).
- Mesuré le 21/10 dans un vrai Grist (grist-static 0.1.6, Chromium, `labo/run-demo.mjs`) : **changer la table d'une section de
  widget personnalisé** (panneau de droite, « Modifier la vue » / « Change widget », puis la table et « Enregistrer ») rouvre la
  galerie des widgets, l'adresse déjà remplie (« Modifier le widget »), puis ses avertissements ; l'accès retombe à « aucun » et
  Grist redemande l'accès complet (« Accept ») : le cadre est reconstruit sans accès, puis avec l'accès complet après l'accord.
  GFS repart de zéro, l'explorateur d'abord. Les libellés français sont ceux de `grist-static/dist/locales/fr.client.json`.
- Mesuré le 21/10 dans un vrai Grist (grist-static 0.1.6, Chromium, `labo/run-form.mjs` et `run-form-seul.mjs`), avec Form+ non
  modifiée à `39e0740` : posée dans le sous-cadre isolé de GFS, elle démarre sans refus ni erreur (origine `null`, pas de stockage).
  Le courtier lui refuse ce que son code fait pour ranger une définition : `UpdateRecord` de `options` sur une section (« Action 1
  refusée : La colonne options de _grist_Views_section n'est jamais écrite par une app. »), et le lot entier tombe quand il porte
  aussi `shareOptions`, qui est déclaré (le marqueur de copie de `duplicateFormSection`) ; `fetchTable('_grist_Shares')`
  (« _grist_Shares ne se lit jamais. »). `grist.setOptions(objet)` d'une app qui ne déclare aucune clé ne dit rien et n'écrit rien
  (`getOptions()` rend `null`, les lignes de `_grist_Views_section` ne changent pas). « Partir de zéro » passe avec la structure et les
  écritures déclarées (table, `CreateViewSection` sur la page de GFS), puis **Grist recharge le cadre dès que la section de
  formulaire est posée**, avec ou sans GFS : le retrait du champ que Grist ajoute tout seul, que l'app fait ensuite, n'a pas lieu
  (un champ reste dans le formulaire « vide »), et dans GFS l'explorateur revient, l'app est fermée. Une table `FormPlus_Formulaires`
  aux colonnes du manifeste donne des lignes d'explorateur au type « Formulaire » (icône `form`, aucune couleur de famille), qui
  s'ouvrent par le double-clic sur le modèle habituel de l'app (aucune porte « ouvrir » déclarée).
- Mesuré le 21/10 (mêmes essais), avec Form+ à `038dd1b` (la consigne 007 faite) : **enregistrer un formulaire par son lien n'écrit
  aucune ligne, avec ou sans GFS.** Form+ demande l'accord (fenêtre du kit), crée `FormPlus_Formulaires`, puis pose sur la page de
  son widget une section de formulaire pour cette table (`ensureTableGate`) : Grist recharge aussitôt le cadre (celui de GFS, ou
  celui de Form+ seule), et la suite est perdue (section ni vidée, ses six champs restent, ni publiée ; formulaire ni dupliqué ni
  enregistré). Un second
  essai, sans fenêtre puisque la table existe, pose une section de plus, toujours sans ligne : chaque essai ajoute une section
  visible sur la page. Le courtier ne refuse rien pendant ces essais.
- Mesuré le 21/10 (même essai) : **un widget en accès complet peut poser une section de widget personnalisé** sur une page :
  `CreateViewSection` (table, page, `'custom'`) rend `sectionRef` ; ses réglages s'écrivent comme Grist les écrit
  (`options.customView`, une chaîne JSON : `mode`, `url`, `access`, `widgetDef`…), le lien « Select by » par
  `linkSrcSectionRef` (la section du tableau), `linkSrcColRef` et `linkTargetColRef` à 0, et la disposition par
  `_grist_Views.layoutSpec` (`{"children":[{"children":[{"leaf":tableau},{"leaf":widget}]}]}` : côte à côte). Avec `access` vide,
  Grist charge le widget sans accès et demande l'accès complet dans le panneau de droite (« Accept ») ; après l'accord, le widget
  suit la ligne choisie dans le tableau. Aucun avertissement de Grist sur l'adresse.
- Mesuré le 22/10 (`labo/run-publication.mjs`, 30 vérifications, à 700 × 400, à la vraie souris et au vrai clavier, en français / clair,
  anglais / sombre, français / sombre et anglais / clair) avec Form+ non modifiée à `c249c4a` : **un appel de l'app qui publie un
  formulaire (`UpdateRecord` de `shareOptions` sur sa section) ou qui ajoute un champ Référence à une section publiée est tenu par GFS
  jusqu'à la réponse de la personne** ; la fenêtre dit la table ouverte à l'ajout et ses colonnes que le formulaire ne montre pas, ou la
  colonne rendue lisible ; « Refuser », Entrée (le clavier part sur « Refuser ») et Échap donnent `GFS_ANNULE` et le document ne bouge
  pas ; « Autoriser » laisse passer, le même lot rejoué ne demande plus rien, une deuxième section sur la même table non plus ; une table
  de GFS, d'une autre app ou de l'app est refusée sans fenêtre (`GFS_REFUSE`). Avec `run-form.mjs` : l'enregistrement d'un formulaire par
  son lien ouvre deux fenêtres (la table `Clients` à l'ajout, puis la lecture de `FormPlus_Formulaires.Definition`, que tout lien pourra
  lire), le second formulaire aucune. **Non mesuré** : ce que Grist ouvre vraiment à qui a le lien (10.11), grist-static n'a pas de
  partages.

## 3. Grist : données

- Un lot d'actions est rejoué en entier ou pas du tout. Une `UpdateRecord` ou `AddRecord` sur une colonne inconnue annule
  tout le lot ; `AddColumn` sur un identifiant pris le renomme ; `BulkRemoveRecord` sur une ligne absente refuse le lot ;
  `BulkAddOrUpdateRecord` est une mise à jour ou insertion atomique.
- Noms de table : `sandbox/grist/identifiers.py`, `_sanitize_ident` (ligne 36) remplace par « _ » tout ce qui n'est pas
  `[a-zA-Z0-9_]` puis **retire les « _ » de tête** ; un identifiant de table prend la capitale et le préfixe « T » s'il
  commence par un chiffre (ligne 81). Mesuré (09/10) : les accents disparaissent, un nom pris reçoit un numéro sans tenir
  compte de la casse (`Fournisseurs2`) ; `AddTable` rend `{ id, table_id, columns, views }` et crée une page ;
  `RemoveTable` retire la table, sa vue et sa page.
- Une Référence montre une colonne par `visibleCol`, puis `SetDisplayFormula` range la formule dans une colonne d'aide
  (`gristHelper_Display`…).
- Lu le 21/10 dans `app/common/ACLRulesReader.ts` (les sources que grist-static 0.1.6 embarque ; le serveur de Grist applique ces
  règles) : **une session de partage (le lien d'un formulaire publié) ne lit ni n'écrit aucune table de données par défaut**
  (`-CRUDS` sur chacune, `_addDefaultShareRules`, ligne 277 ; les tables `_grist_*` restent hors de ces règles, censurées
  autrement). Pour chaque table qui a une section de formulaire publiée (`shareOptions` : `publish` et `form`) sur une page du
  partage (`_addRulesForShare`, ligne 205), elle **crée des lignes** dans toutes les colonnes (`+C`, ligne 301) et **ne lit que la
  ligne `rec.id == 0`** (`+R`, ligne 308), c'est-à-dire aucune ligne existante ; elle lit en plus les colonnes montrées
  (`visibleCol`) des tables vers lesquelles pointent les Références de ces formulaires (`_shareTableReferencesForForm`,
  ligne 325). Une section de formulaire publiée sur une table ouvre donc cette table à l'ajout, pas à la lecture.
  **Non mesuré** : grist-static n'a pas de partages (pas de serveur).
- Mesuré le 21/10 (`labo/run-ranger.mjs`, à 700 × 400, souris et clavier, fr clair et en sombre) : épingler, déplacer et
  renommer depuis l'explorateur de GFS. La première étoile, sans table, pose la question ; « Annuler » ne crée rien ;
  « Créer la table » crée `GFS_Rangement` (avec sa page) puis la ligne du fichier, et **le cadre de GFS n'est pas reconstruit**
  (la page nouvelle n'est pas celle du widget) : l'étoile s'allume 0,2 s après le clic, liste relue. Renommer écrit
  `UpdateRecord` sur la seule colonne du nom : dans `Publipostage_Modeles`, après le geste, seule la colonne `Nom` diffère, sur
  la seule ligne du fichier (date et auteur intacts) ; le nom d'un autre modèle, tapé en minuscules, est refusé dans la
  fenêtre et rien n'est écrit. `_grist_Tables` et `_grist_Tables_column`, lues par la connexion de GFS
  (accès complet), donnent le nom réel de la table et ses colonnes. Le rangement de Publipostage+
  (`Publipostage_PreferencesModeles`) n'est jamais écrit.
- Mesuré le 22/10 (`labo/run-identite.mjs`, 41 vérifications, fr clair et en sombre) : **lire l'adresse de la personne comme le fait
  Publipostage+** (contrats 6.4, point 9). Dans le vrai moteur de Grist (grist-static 0.1.6, Pyodide), `user.Email` vaut `None` : il n'y
  a pas de compte. Le labo glisse donc la personne à la frontière du Worker (l'argument `user` de `apply_user_actions`, ce que le serveur
  de Grist ajoute) ; le moteur, la formule et les actions restent ceux de Grist. Une colonne de texte à formule déclenchée
  (`isFormula: false`, `recalcWhen: 0`, `recalcDeps: null`) est calculée à la création d'une ligne seulement et jamais après ; sa formule
  peut se conditionner à une autre colonne : `user.Email if $Utilisateur == '@sonde' else ''` ne donne une adresse qu'à la ligne-sonde,
  les lignes de rangement gardent `''`. Les numéros de ligne libérés sont réutilisés (le prochain est le plus grand plus un) : la sonde
  prend un numéro puis le rend. Dans l'ordre, le moteur reçoit `AddTable`, `AddRecord` (`@sonde`), `RemoveRecord`, puis la ligne de la
  personne à son adresse ; à chaque réouverture, une paire `AddRecord` / `RemoveRecord` et rien d'autre ; en lecture seule et sans
  table, aucune écriture. Une sonde coûte de 23 à 28 ms, lecture de la table comprise. Deux personnes (Ana, Ben) dans un même
  document ne voient ni les favoris ni les dossiers l'une de l'autre ; l'anonyme (`anon@getgrist.com`) et une formule sans adresse
  rangent dans le rangement commun (`Utilisateur` vide) ; une table d'avant sans `Adresse` reçoit la colonne avant la sonde. Les
  favoris et les dossiers que Publipostage+ range par adresse (`Publipostage_PreferencesModeles`) se retrouvent dans GFS pour la même
  personne, et GFS n'y écrit rien. **Non mesuré** : l'adresse que le vrai serveur de Grist donne à `user.Email` (Publipostage+ s'appuie
  sur le même mécanisme et le même moteur, chez le porteur, sur l'instance de la DINUM) ; Firefox et Safari.

## 4. Grist : API REST et origines

- `app/server/lib/requestUtils.ts`, `trustOrigin` (ligne 123) : une origine `null` (opaque) n'est pas reconnue ; une origine
  est reconnue si elle partage le domaine de base du serveur.
- `app/server/lib/FlexServer.ts`, `trustOriginHandler` (ligne 3103) : à une origine non reconnue, Grist répond
  `Access-Control-Allow-Origin: *` **sans identifiants** (ni cookie ni en-tête `Authorization` ; une requête qui en porte est
  refusée, 403).
- **Conséquence** (à confirmer au prototype) : un sous-cadre à origine opaque appelle l'API REST comme un widget servi par
  `github.io` aujourd'hui, avec le jeton de `getAccessToken` dans l'adresse.

## 5. GitHub Pages et GitHub

- En-têtes relevés le 14/10 (`lombre33.github.io/publipostageGrist/index.html`) : `access-control-allow-origin: *`,
  `cache-control: max-age=600` ; aucune adresse par version.
- **Une origine par compte** : `lombre33.github.io` sert tous les sites de projet du compte et le site du dépôt
  `lombre33/lombre33.github.io` (2020) ; de même pour `grist-factory.github.io`.
- Pages (Jekyll, par défaut) ne sert **aucun fichier ni dossier dont le nom commence par « _ » ou « . »** (vu le 09/10 :
  un dossier `_tables/` répondait 404 en ligne, alors qu'il marchait en local).
- Documentation de GitHub (dépôt `github/docs`, lu le 14/10 par jsDelivr ; docs.github.com est bloqué depuis le cloud) :
  Pages récupère les sous-modules à la construction, dépôts publics et adresses `https://` seulement, sous-modules imbriqués
  compris (`content/pages/getting-started-with-github-pages/using-submodules-with-github-pages.md`) ; Dependabot :
  `gitsubmodule` a les mises à jour de version (pas de sécurité), `npm` les deux
  (`data/reusables/dependabot/supported-package-managers.md`).
- `grist-factory` est une organisation GitHub. Aucune session cloud n'y pousse (refusé le 05/10) : le dépôt public est
  poussé depuis la machine du porteur.

## 6. L'outil d'audit (`lombre33/Grist-widget-audit`)

- `src/contexte/inventaire.js`, `trouverPointsDEntree` : les points d'entrée sont `index.html` (profondeur 1 au plus) et
  les pages d'un `manifest.json` (une adresse absolue `https://…` est « hébergée ailleurs », hors surface) ;
  `calculerSurface` en fait **un seul ensemble** ; aucune option ne choisit une seule entrée.
- `src/regles/b-lisibilite.js` (ligne 284), B-VERB-01 : lignes de JS et de HTML exécutées, mineur au-dessus de 4 000,
  majeur au-dessus de 12 000 ; cite le guide Grist.Gouv (« périmètre fonctionnel clairement défini et raisonnablement
  étroit », « plusieurs métiers différents : envisagez de le découper »). Publipostage+ le 04/10 : 28 960 lignes ; réponse
  retenue : une carte du code dans le README.
- Seuils retrouvés en refaisant les mesures de l'outil (04/10) : fonction jugée à 81 lignes physiques ou plus, fonctions
  imbriquées comprises ; module en fonction auto-appelée jugé sur ses lignes propres, seuil 85 (les fonctions fléchées
  comptent comme du code propre) ; complexité au-dessus de 15 ; fichier au-dessus de 600 lignes de code (sans commentaires
  ni lignes vides).

## 7. État des apps (relevé le 14/10, clones en lecture)

| App | Dépôt (commit) | Bibliothèques | Où vit sa définition | À noter |
|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` (92ecd58) | ≈ 34 paquets par esm.sh (TipTap 3.31.3, ProseMirror) dans l'import map ; fichiers figés sur cdnjs et jsDelivr chargés au premier usage, avec SRI | Modèles en tables ; réglages de la vue par `grist.setOption` | CSP avec esm.sh ouvert et `'unsafe-eval'` (script d'API de Grist) ; `frame-src 'none'` |
| Slides+ | `lombre33/SlidesPlus` (747a700) | Fabric.js vendorisé | Table `SlidesPlus_Presentations` | `shared/` adapté ou copié de Publipostage+ |
| Form+ | `lombre33/FormPlus` (b073d03) | Aucune (modules ES) | Réglages de la vue (`grist.setOptions`) ; écrit `_grist_Views_section(_field)` (`poc/js/config-editor.js`, lignes 1017 et 1064) | Page et instance tirées de `document.referrer` (`poc/js/links.js`, ligne 77) ; face publique hors de Grist ; pas de CSP ; `requiredAccess: 'full'` |
| Automation+ | `lombre33/GRIST_automation` (ee8f0a9) | Aucune ; CSP stricte | Réglages de la vue (`grist.setOption('workflow')`, `js/main.js`, ligne 58) | Ne tourne que vue ouverte ; tables `_Automation_*` prévues |
| Grist-BI | `lombre33/Grist-BI` (c8c819f) | `js/vendor/` (ECharts, DuckDB-WASM 34 Mo, Arrow, xlsx) ; pdfmake et PptxGenJS sur cdnjs | Table `BI_Dashboard_Config` | Pas de CSP ; son propre accès à Grist |

**Code en double** : l'accès à Grist existe dans les cinq (Slides+ en a une copie adaptée) ; la liste avec recherche fait
744 lignes dans Publipostage+ et 157 réécrites dans Automation+ (29 en commun) ; fenêtres, traduction, thème et jetons sont
refaits dans Automation+.

## 8. Publipostage+ : repères dans le code (`main` 92ecd58, 14/10)

| Sujet | Où |
|---|---|
| Type de modèle : branche du macro-modèle ; « document » par défaut | `js/main.js` lignes 270 et 330 (`typeModeleOf`) |
| Modèle de départ (★) possible pour tout type sauf `email` et `macro` | `js/templates.js` ligne 451 (`canBeDocumentDefault`) |
| Table des modèles et ses colonnes (`Nom`, `Contenu`, `TypeModele`, `DateModif`, `EstParDefaut`…) ; ligne réservée `reglages` | `js/templates.js` |
| Types : `document` (ou vide), `email`, `macro`, `grille` (`js/grid-editor.js`, ligne 37) | |
| Réglages de la vue : `droitsAcces`, `dateDernierExport`, `modeleSelonLigne`, `modeleDeLaVue` | `js/access-rights.js`, `js/export-date.js`, `js/row-template.js`, `js/view-template.js` ; écrits par `setWidgetOption` (`js/grist-api.js`, ligne 783) |
| Ordre d'arrivée : la ligne (`RowTemplate.pick`), la vue, le ★, sinon page blanche | `js/main.js` lignes 2781 à 2787 |
| Lecture de `document.referrer` | `js/grist-api.js`, `fixBaseUrl` (ligne 930) |
| Téléchargement par `<a download>` | `js/export-common.js`, `downloadBlob` (ligne 92) |
| Seule écriture d'une table `_grist_*` | `js/template-pack.js` ligne 255 (`_grist_Tables_column`) |
| CSP et import map | `index.html` lignes 14 et 47 |
| Moteurs d'export chargés au premier usage (le patron des extensions) | `index.html` lignes 803 à 809 (`text/x-lazy-engine`), `js/export-engines.js`, `js/export-common.js` |
| Liste des versions des bibliothèques (miroir des tests, 45 paquets) | `dev-tests/.offline-cache/package.json` |
| Fenêtres de premier contact ; consentement des tables ; rappel « Enregistrer » | `js/first-contact.js`, `js/table-consent.js`, `js/save-reminder.js` |
| Base des fenêtres ; saisies ; liste avec recherche ; couches ; traduction | `js/modal-base.js`, `js/dialogs.js`, `js/search-select.js`, `js/layers.js`, `js/i18n.js` |
| Outil d'envoi vers le dépôt public | `outils/depot-propre/` (`publier.sh`, `controles.mjs`) |

## 9. Un fichier assemblé pour une extension (mesuré le 16/10, hors Grist)

Page de test servie par un serveur statique qui répond `Access-Control-Allow-Origin: *` (comme GitHub Pages), Chromium 141,
esbuild 0.28.2, les six paquets de la demande d'écriture en direct de Publipostage+ (`yjs` 13.6.33, `y-protocols` 1.0.7,
`lib0` 0.2.119, `@tiptap/y-tiptap` 3.0.10, `@tiptap/extension-collaboration` et `-collaboration-caret` 3.31.3). Les bibliothèques
natives de l'app (`@tiptap/core`, `prosemirror-*`) y sont des modules d'essai posés par une carte d'importation statique,
comme dans l'app ; ni esm.sh (injoignable depuis le cloud), ni la vraie page de l'app, ni jsDelivr ne sont dans la mesure.

- **Un seul fichier** : 145 862 octets, environ 46 600 gzippés (`edition-live.js`), qui contient les six paquets et leurs 33 modules
  `lib0`, et laisse en noms nus **cinq noms**, tous déjà dans la carte d'importation d'`index.html` de l'app : `@tiptap/core`,
  `prosemirror-model`, `prosemirror-state`, `prosemirror-transform`, `prosemirror-view` (les imports `@tiptap/pm/<x>` des
  paquets sont renvoyés à `prosemirror-<x>` par un alias de l'outil de construction).
- **Deux éditeurs** de l'app, montés avec les modules du fichier, se synchronisent : un texte, des frappes simultanées, la
  coupe d'un bloc, et le curseur avec le nom de l'autre.
- **Témoin** : avec **sa propre copie de ProseMirror** dans le fichier (404 Ko), le texte se synchronise mais **aucun curseur
  n'apparaît et aucune erreur n'est levée** : les plugins de l'éditeur de l'app ne reconnaissent plus l'état de l'autre copie.
  C'est la panne silencieuse que le fichier unique, aux noms de l'app laissés en externes, évite.
- **Carte d'importation à l'exécution** : refusée par une CSP comme celle de l'app (`script-src` avec l'empreinte de sa carte
  statique). GFS ne peut donc pas livrer les modules un à un en posant sa carte : l'app garderait la sienne.
- **Empreinte d'un script de type module créé à la volée** (`<script type="module" src integrity crossorigin>`) : la bonne
  empreinte charge le fichier, une mauvaise est refusée. Aucune empreinte ne se pose sur un `import()`.
- **Dans un cadre isolé** (`sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"`, origine nulle,
  `self.origin === 'null'`), sous `script-src 'self'` et l'empreinte de la carte : le fichier d'empreinte fausse est refusé et
  ne pose rien, le fichier d'empreinte exacte se charge, range ses modules dans `globalThis.GfsPaquets['edition-live']`, et les
  deux éditeurs se synchronisent comme hors du cadre.
- **L'outil de GFS** (`outils/bibliotheques.mjs`, mode `assemble`) reconstruit ce fichier d'après la liste, depuis le registre
  npm (`npm pack` des six versions exactes, trois secondes) : **les mêmes octets que l'essai** (145 862 ; 46 585 gzippés au
  maximum de compression), donc la même empreinte et le même comportement dans le cadre isolé. Deux constructions de la même
  liste donnent les mêmes octets (testé). Les six paquets sont sous licence MIT ; l'outil en recopie les textes dans
  `LICENCES.txt`, à côté du fichier.

## 10. Grist : les permissions (lu et mesuré les 21 et 22/10)

Étude : le document « Permissions de Grist Factory : la stratégie » (Claude Doc, dans les fichiers du projet) ; ses preuves
sont ici, avec le fichier et la ligne. **Lu** : le code de `grist-core`, branche principale, relu le 21/10 (les sources que
grist-static 0.1.6 embarque) ; ce n'est pas forcément la version de l'instance du porteur. **Mesuré** : dans le labo « vrai
Grist » (grist-static 0.1.6 : `ActiveDoc`, `GranularAccess` et `DocClients` réels), une personne à la fois par « Voir en tant
que » (owner@, editor1@, editor2@, viewer@example.com) ; pour les rechargements, chaque message que le serveur enverrait est
rejoué pour chacune de ces personnes avec une copie de la session. Les scripts, les patchs de grist-static et la sortie de
chaque mesure sont dans les fichiers du projet (`gfs/etudes/permissions-2026-10-21/mesures/`, son `LISEZ-MOI.md` dit comment
les rejouer) ; ils ne sont pas dans le dépôt. **Rapporté** : dit par un autre projet ou par le porteur, pas remesuré. Le labo n'a
ni lien public, ni téléchargement, ni historique d'actions, ni les messages d'erreur de la page de Grist, et il n'est pas
l'instance du porteur : les dix mesures de la fin sont à refaire chez lui.

### 10.1 Où vivent les droits et les rôles

- Lu : le rôle d'une personne sur le document n'est pas rangé dans le document ; Grist le tire de sa base d'accueil, comme le
  plus fort entre le rôle donné sur le document et celui qui vient de l'espace de travail ou de l'organisation, plafonné par
  le réglage d'héritage (`app/common/UserAPI.ts` 347–376 ; `app/server/lib/Authorizer.ts` 700–729).
- Lu : les règles fines sont dans deux tables internes du document, `_grist_ACLResources` et `_grist_ACLRules` ; une règle
  spéciale a sa ressource `*SPECIAL`, sauf la structure, que l'interface range sur la règle par défaut quand la case est
  décochée (`app/server/lib/GranularAccess.ts` 77–81 et 244–245 ; `app/common/ACLRuleCollection.ts` 23 et 136–142). Ces deux
  tables ne sont envoyées qu'aux propriétaires (`GranularAccess.ts` 1149–1153) : seul un propriétaire peut prouver ce qu'elles
  disent.
- Lu : personne ne range « qui est la personne » ; Grist le calcule à chaque demande (rôle, identifiant, adresse, nom,
  paramètres du lien, connecté ou non). Un visiteur anonyme (lien public, formulaire publié) n'a pas d'adresse vide : il a
  l'adresse nominale `anon@getgrist.com`, et `user.IsLoggedIn` est faux (`GranularAccess.ts` 360–371 et 399–414 ;
  `sandbox/grist/user.py` 14–23 ; `UserAPI.ts` 47 ; `UsersManager.ts` 355–364).
- Lu : le lien ouvert à tout le monde est un rôle donné à un utilisateur spécial (« anonyme » ou « tout le monde ») dans la
  base d'accueil ; un formulaire publié est une ligne de la table interne `_grist_Shares`, que seuls les propriétaires reçoivent
  (`UsersManager.ts` 48 ; `HomeDBManager.ts` 5049–5070 ; `GranularAccess.ts` 360–371 et 3349–3355).
- Lu : l'API rend la liste des utilisateurs du document avec leur rôle ; pour un propriétaire seulement, elle ajoute le drapeau
  « les éditeurs contournent les règles », qui n'existe que dans la branche principale, pas dans la version du labo
  (`UserAPI.ts` 321–331 et 500).
- Lu : l'adresse d'un widget et son niveau d'accès sont dans la colonne `options` de la section de page, sous la clé
  `customView` (`app/server/lib/ActiveDoc.ts` 3396–3408 ; `app/client/components/CustomView.ts` 255–271).

### 10.2 La structure est un réglage du document entier

- Lu et mesuré : le droit de modifier la structure n'existe que sur la règle par défaut, celle de toutes les tables ; posé sur
  une table ou une colonne, il est écarté sans erreur et l'éditeur supprime encore la table (`app/common/ACLPermissions.ts`
  72–73 ; `ACLRuleCollection.ts` 814–817 ; labo, `diag-s.mjs`).
- Lu : la case « Droits d'édition de la structure » est la règle « les non-propriétaires n'ont pas le droit de structure » sur
  toutes les tables (`ACLRuleCollection.ts` 183–188). Quand un propriétaire active les Permissions avancées, Grist décoche la
  case de lui-même et prévient (`app/client/aclui/AccessRules.ts` 701–720) ; cochée, il avertit qu'un éditeur peut contourner
  les règles de table et de colonne et lire et changer toutes les données (`AccessRules.ts` 1516–1521). Rapporté par le
  porteur, le 21/10 à 18 h 15 : la case existe sur son instance et se décoche sans souci.
- Mesuré, structure ouverte, des règles de lignes en place : un éditeur change l'adresse du widget, enregistre un réglage de vue,
  supprime une section, une colonne ou une table, pose une colonne-formule, et cette formule lit tous les modèles malgré les
  règles de lignes qui les cachent. Une colonne-formule posée avant la fermeture continue de tout lire.
- Mesuré, structure fermée : ces actions sont refusées (« Blocked by table structure access rules ») ; les lignes restent
  écrivables, les responsables d'espace continuent d'administrer leur espace.
- Lu : toute action sur une table interne demande la permission de structure ; le refus porte la note de la règle
  (`GranularAccess.ts` 2786–2813, 3073–3101 et 3097–3102).

### 10.3 Ce que coûte la première règle

- Lu : dès qu'une règle existe, quelle qu'elle soit, l'import, l'ajout de vue et les colonnes cachées sont refusés aux
  non-propriétaires (`GranularAccess.ts` 108–135, 1080–1083 et 1490–1512 ; `ACLRuleCollection.ts` 290–293 et 401). Mesuré :
  l'import est refusé aux éditeurs (« need uncomplicated access ») ; ajouter une page par l'interface, une table ou un tableau de
  synthèse passe sans la structure fermée et s'arrête avec elle.
- Lu : le téléchargement et la copie du document entier sont refusés aux non-propriétaires dès qu'une règle existe, sauf droit
  spécial (`GranularAccess.ts` 1155–1163 ; `ACLRuleCollection.ts` 71–112 et 154–189).

### 10.4 Écrire les règles depuis un widget

- Mesuré (21/10, `mesure-acl.mjs`) : un widget en accès complet, ouvert par un propriétaire, pose les règles en **une seule**
  `applyUserActions` : `AddRecord` dans `_grist_ACLResources` et `BulkAddRecord` dans `_grist_ACLRules`, avec des identifiants et
  des `rulePos` explicites ; tout ou rien. Un non-propriétaire reçoit « Only owners can modify access rules ».
- Mesuré (21/10) : une règle sur une table qui n'existe pas est refusée (« Invalid tables in rules »).
- Lu et mesuré : le moteur analyse lui-même la formule écrite dans `aclFormula` (`aclFormulaParsed` se remplit : toutes les règles
  posées par les mesures sont « analysées »). Lu : Grist refuse une règle dont la formule n'est pas analysée, et une règle sans
  condition qui n'est pas la dernière de sa ressource (`ACLRuleCollection.ts` 809 et 811). L'ordre entre ressources ne compte
  pas : les règles d'une colonne passent avant celles de sa table, puis la règle par défaut du document (`PermissionInfo.ts`
  60–65 et 74–99).
- Mesuré : un propriétaire est soumis aux règles comme les autres ; sans sa règle en premier, sur une table qui n'a qu'un refus
  par défaut, il ne lit plus rien. Ce que le labo montrait d'abord (une session « système » qui ignore les règles) était son
  artefact.
- Mesuré : une ligne cachée n'arrive pas du tout ; un modèle de propriétaire ne se modifie ni ne se supprime ; on ne crée pas
  de ligne au nom d'un autre ; une colonne protégée n'arrive pas ; les refus s'écrivent « Blocked by row create|update|delete
  access rules ». Les règles ne suivent pas une référence (`rec.Modele.Visibilite` ne correspond à rien) : une colonne-aide qui
  recopie l'étiquette marche et suit les changements.
- Lu : une règle d'attribut (une table cherchée par l'adresse de la personne) a sa forme et ses contraintes
  (`ACLRuleCollection.ts` 349–360, 507–520 et 763–835). Mesuré : une table d'équipes et une règle d'attribut marchent, mais la
  table devient un privilège (un éditeur s'y ajoute) : les espaces la remplacent.

### 10.5 Le responsable d'espace et les adresses

- Mesuré (21/10, `mesure-espaces*.mjs`, avec deux éditeurs, un lecteur et un propriétaire) : un responsable ajoute et retire
  des membres de son espace, et l'effet se voit à la lecture suivante de la personne concernée ; il crée, modifie et supprime ce
  qui est dans son espace ; un membre crée à son nom ; un non-membre ne crée rien dans l'espace ; personne ne déplace un contenu
  vers un espace qui n'est pas le sien (un premier jeu de règles le laissait faire ; resserré, puis remesuré). Il ne nomme aucun
  responsable et ne renomme, ne crée ni ne supprime aucun espace (« Blocked by … »). Avec la structure fermée pour tout le
  document, les mêmes essais donnent les mêmes résultats.
- Mesuré : un lecteur nommé responsable lit ce que les règles lui ouvrent et n'écrit rien (« Only owners or editors can modify
  documents ») : le rôle de base plafonne les règles. Un responsable retiré de la liste perd ses pouvoirs à son action suivante
  (« Blocked by row update access rules ») et lit encore ce que l'espace ouvre à ses membres, s'il en est resté un.
- Lu : `user.Email` est l'adresse affichée quand la demande vient de l'interface, et l'adresse normalisée en minuscules quand
  elle vient de l'API ; Grist n'a corrigé l'écart que pour ses propriétés d'utilisateur, dont la comparaison ignore la casse
  (`Authorizer.ts` 163–171 ; `GranularAccess.ts` 2177–2194). Une condition de règle n'accepte que `lower()` et `upper()` comme
  appels de méthode (`app/common/PredicateFormula.ts` 182–188 et 304–308).
- Mesuré (21/10, `mesure-casse.mjs`, jeux `naif` et `robuste`) : avec un responsable tapé « Editor1@Example.COM » et un membre
  tapé « EDITOR2@example.com », des règles qui comparent l'adresse telle quelle retirent au responsable la lecture de son
  espace, de sa ligne de rangement et toute administration, et au membre la lecture des modèles de son espace ; avec des
  colonnes-aide en minuscules et `lower()` des deux côtés, les mêmes essais passent tous. Une personne nommée dont l'adresse est
  tapée en majuscules lit le modèle qui la nomme, un autre éditeur non. Le labo passe par l'adresse affichée : l'écart de l'API
  n'y est pas reproductible.
- Mesuré (22/10, `mesure-casse-gfs.mjs`) : la même suite avec les noms définitifs du contrat (la table des espaces s'appelle
  `GFS_Espaces` et se cherche par une clé, `lookupOne(Cle=$Espace)` ; les colonnes d'aide des contenus s'appellent `GFS_Resp`,
  `GFS_Memb` et `GFS_PersonnesL`) donne exactement les mêmes résultats que le jeu sans préfixe.
- Mesuré (22/10, `mesure-aide-absente.mjs`) : une colonne d'aide dont la formule nomme `GFS_Espaces`, créée **avant** que la
  table existe, vaut `NameError` pour les lignes existantes ; quand la table naît, puis reçoit un espace, ces lignes ne se
  recalculent pas (même avec une formule qui attrape `NameError`) ; une ligne ajoutée ensuite se calcule ; réécrire la formule
  avec un autre texte recalcule la colonne (le même texte, non). D'où l'ordre : la table d'abord, les colonnes ensuite.

### 10.6 Ce qui fait recharger la page de Grist (22/10)

- Lu : toute action sur `_grist_ACLRules` ou `_grist_ACLResources` renvoie à chaque personne connectée l'ordre de recharger le
  document, celle qui pose comprise ; le code note qu'il pourrait l'éviter dans bien des cas, sans l'avoir fait. La page rouvre
  alors le document en cours : les widgets repartent de zéro (`GranularAccess.ts` 332–333 et 745–750 ; `DocClients.ts`,
  `_prepareMessage` ; `App.ts`, écoute de `docShutdown`). Mesuré (`mesure-rechargement.mjs`, `patch-observe.mjs`) :
  poser des règles, en poser une qui ne change rien, poser la règle de la case de structure : le propriétaire, les deux
  éditeurs et le lecteur observés reçoivent tous l'ordre de recharger.
- Mesuré : ajouter ou retirer un membre, nommer ou retirer un responsable, changer la visibilité d'un modèle, le déplacer vers un
  autre espace, créer un modèle ou un espace : personne ne reçoit l'ordre de recharger ; la personne concernée reçoit l'ajout ou
  le retrait des lignes en direct. Ajouter une colonne ou une table, ou renommer une colonne que les règles lisent (Grist
  réécrit alors les règles lui-même) : pas de rechargement non plus. Lu : quand une ligne devient lisible ou cesse de l'être
  pour une personne, Grist remplace la modification par un ajout ou un retrait de la ligne (`GranularAccess.ts` 1742–1871).
- Lu et mesuré : une table déclarée « attribut de personne » recharge la page de la personne dont la ligne trouvée change ou
  disparaît, elle seule ; si elle n'avait pas de ligne et en reçoit une, rien ne se passe et aucune ligne ne lui est envoyée
  (elle ne voit le nouvel accès qu'au prochain chargement) ; la recherche par adresse ignore la casse (`GranularAccess.ts`
  421–452, 709–721 et 2134–2168).
- Lu, non mesuré : quand un formulaire est publié et que des règles existent, tout changement des tables internes fait recharger
  les visiteurs du formulaire (`GranularAccess.ts` 616–652 et 753–755).

### 10.7 La lecture ne cite que `rec` (22/10)

- Lu : si Grist n'arrive pas à filtrer une diffusion pour une personne, il lui envoie une erreur à la place des lignes ; sa page
  affiche l'erreur et n'applique pas les actions du lot (`GranularAccess.ts` 2031–2046 ; `DocClients.ts` ; `GristDoc.ts`,
  `_onDocUserAction`). Pour accepter une création, `newRec` est la ligne à la fin du lot, formules comprises ; pour la diffuser,
  Grist évalue la lecture pas à pas, sans `newRec`, avant que les formules aient tourné (`GranularAccess.ts` 1894–1925,
  2046–2060 et 2313–2370).
- Lu : pour une création, Grist fait de `rec` la ligne créée, et pour une suppression de `newRec` la ligne supprimée, « pour la
  commodité de qui écrit les règles » (`GranularAccess.ts` 1959–1966) : une règle de création ou de suppression peut donc ne citer
  que `rec`, comme la règle de la ligne-sonde (10.8).
- Mesuré (`mesure-rechargement.mjs`, `aides` puis `aides split` ; `mesure-casse.mjs` avec `SPLIT=1`) : avec une règle de lecture
  écrite avec `newRec`, le responsable ou l'auteur qui crée un modèle reçoit « Unexpected row removal » à la place de sa ligne ;
  avec la lecture écrite avec `rec` seul et la création, la modification et la suppression écrites avec `newRec`, il la reçoit,
  et la suite de mesures des droits d'écriture (adresses en majuscules, responsable retiré, lecteur nommé) donne les mêmes
  résultats. **Une règle qui donne la lecture ne cite que `rec`.**

### 10.8 La sonde de l'adresse sous « Partagé » (22/10)

La sonde de GFS (contrats 6.4, point 9) ajoute une ligne `Utilisateur = '@sonde'` dont la colonne `Adresse`, une formule
déclenchée (`user.Email`), reçoit l'adresse de la personne ; elle la relit puis retire la ligne. Mesuré (`mesure-sonde.mjs`,
quatre jeux de règles sur le même rangement, trois éditeurs et un lecteur observés, dont ce que le serveur enverrait à chacun) :

- **Avec les règles « Partagé » de l'annexe seules** (propriétaires, ligne `@document` en lecture, ses propres lignes), un éditeur
  ne peut pas ajouter la ligne-sonde : « Blocked by row create access rules ». Il ne connaît plus son adresse, donc n'écrit plus
  aucune ligne de rangement : le niveau cassait la sonde pour tous les non-propriétaires.
- **Une règle « la ligne `@sonde` : création, lecture, suppression pour tous »** la rétablit, mais l'adresse de l'éditeur est
  envoyée en direct à toutes les personnes connectées (la ligne arrive chez l'autre éditeur et chez le lecteur), une ligne
  forgée avec l'adresse d'un autre est acceptée et lisible de tous, et n'importe qui retire la ligne d'un autre.
- **Deux règles (création et suppression pour tous, lecture seulement si `rec.Adresse` est l'adresse de la personne)** : l'adresse
  reste chez son propriétaire, mais une ligne forgée au nom d'un autre est encore acceptée et n'importe qui retire la ligne d'un
  autre.
- **Une seule règle** `rec.Utilisateur == "@sonde" and user.Email and rec.Adresse and rec.Adresse.lower() == user.Email.lower()`
  en création, lecture et suppression : l'éditeur ajoute sa ligne, la lit avec son adresse (`editor1@example.com`) puis la retire ;
  les autres personnes ne reçoivent rien ; une ligne forgée avec l'adresse du propriétaire est refusée (« Blocked by row create
  access rules ») ; l'éditeur qui la met à sa propre adresse est accepté ; un autre éditeur ne peut pas la retirer. Un lecteur
  reste refusé (« Only owners or editors can modify documents »), comme sans règle. La valeur de `Adresse` fournie à l'ajout est
  gardée telle quelle (la formule déclenchée ne tourne qu'à défaut) : c'est la règle qui oblige cette valeur à être l'adresse de
  la personne.
- Pour l'éditeur qui crée la ligne, la diffusion arrive en deux temps que Grist rassemble (la ligne d'abord illisible, puis lisible
  une fois `Adresse` calculée : `BulkAddRecord` avec la colonne), sans l'erreur « Unexpected row removal » de 10.7.

### 10.9 Les tables des apps et le reste

- Mesuré : sans règle sur les tables dérivées (versions, commentaires, écriture en direct), le texte d'un modèle réservé se lit
  dans les versions ; avec des colonnes-formules qui recopient l'étiquette dans chaque table dérivée, les mêmes règles s'y
  appliquent et la visibilité suit quand le propriétaire la change. La colonne du mot de passe PDF n'arrive pas aux
  non-propriétaires quand une règle de colonne la protège. Table d'Automation+ : les workflows s'écrivent par les propriétaires,
  le journal et le verrou par tous.
- Rapporté (Form+, 16/09) : sur l'instance de la DINUM, une session de partage a pu écrire les réglages d'un widget ; les tables
  internes échappent au refus par défaut d'un partage. À remesurer chez le porteur avec la structure fermée.
- Rapporté (audit de Publipostage+, 4/10) : un modèle écrit par un éditeur est du contenu que l'app affiche chez les autres ;
  liste blanche de balises, adresses de script retirées, politique de sécurité du contenu.

### 10.10 À mesurer sur le Grist du porteur

Dix points, avec deux ou trois comptes (un propriétaire, des éditeurs) : une session de lien public ou de formulaire publié,
structure fermée ; le texte qu'un éditeur voit quand Grist refuse d'enregistrer un réglage de vue ; la note d'une règle dans le
refus de la page de Grist ; les rechargements (une règle posée recharge la page de l'autre compte, un membre ajouté par un
responsable ne recharge rien et fait apparaître les modèles chez la personne ; un widget en accès complet ouvert par un
propriétaire écrit-il les règles ?) ; qui est vraiment propriétaire, héritage de l'espace de travail compris ; le
téléchargement et la copie refusés à un éditeur ; l'historique des actions ; la version de Grist et le libellé exact de la
case ; le jeton du widget et la liste des utilisateurs du document ; l'adresse que voient les règles par l'interface et par
l'API, et la ligne-sonde sous « Partagé » (10.8). Les contrats 11 (version 0) ne deviennent définitifs qu'après elles. Les liens publics ont leurs
propres mesures : 10.11.

### 10.11 Les liens publics et les formulaires publiés (22/10)

Le porteur, le 22/10 : « segmenter et limiter les droits d'écriture d'un formulaire, être super vigilant là-dessus ». **Lu** :
`grist-core`, branche principale, relu le 22/10 (`ACLRulesReader.ts`, `GranularAccess.ts`, `HomeDBManager.ts`, `DocApi.ts`,
`DocWorker.ts`, `FormView.ts`). **Aucune mesure avec un vrai lien** : le labo n'a pas de partages (pas de serveur d'accueil).
Complète le § 3 (« une session de partage ne lit ni n'écrit aucune table de données par défaut »).

- Lu : l'adresse d'un lien porte une clé de partage que le serveur d'accueil tire au hasard pour chaque partage du document
  (`HomeDBManager.ts` 3214–3231) ; il y retrouve le document et donne à la session le rôle « éditeurs », « à contrôler au niveau
  fin » (`HomeDBManager.ts` 1097–1127). Cette clé n'est pas l'identifiant `linkId` que le document garde dans `_grist_Shares` :
  la demander au serveur est réservé aux propriétaires (`getShare`, `DocWorker.ts` 151 ; `FormView.ts` 739–757 en fait l'adresse
  du formulaire). Grist fait du visiteur l'utilisateur anonyme (10.1) et met dans `user.ShareRef` la ligne de `_grist_Shares` du
  lien (`GranularAccess.ts` 360–371 et 390–400).
- Lu : **les règles posées ne valent pas pour un lien.** Dès que le document a un partage, Grist réécrit chaque règle enregistrée
  en `user.ShareRef is None and (…)` : elle ne vaut plus que pour les sessions qui ne sont pas des partages (`ACLRulesReader.ts`
  138–150 et 497–507 ; le commentaire de l'option `addShareRules`, 98–105, dit que partages et règles « s'excluent pour
  l'instant »). Les règles de GFS (contrats 11.4) sont donc muettes pour un visiteur : aucune ne peut le restreindre.
- Lu : **ce qu'un lien a, au plus.** Aucune table de données et aucune structure par défaut (`-CRUDS` sur chaque table qui n'est pas
  `_grist_*`, `-S` sur la règle par défaut : `_addDefaultShareRules`, 270–282) ; un partage non publié est refusé en entier
  (`_blockShare`, 452–464). Pour chaque table que cible une section de formulaire publiée sur une page du partage (section et
  partage publiés : `_addRulesForShare`, 205–259) : la création `+C` dans **toutes les colonnes** (`colIds: "*"`, 287–302 ; le
  code note lui-même que « hidden columns could be written », 250–253), la lecture de la ligne 0 seulement (304–317, « a hack »)
  et la lecture de la **colonne entière** que montre chaque Référence du formulaire (325–372 ; la colonne `id` si elle n'en montre
  aucune). Aucune lecture d'une ligne existante, aucune modification, aucune suppression.
- Lu : les tables `_grist_*` échappent à ces règles, « censurées d'une autre façon » (`ACLRulesReader.ts` 261–269) : un visiteur
  reçoit la structure (pages, sections de vue et leurs réglages, colonnes) comme tout le monde, filtrée d'après son accès aux
  tables de données ; seules `_grist_ACLResources`, `_grist_ACLRules` et `_grist_Shares` ne vont qu'aux propriétaires
  (`GranularAccess.ts` 3348–3356). Ce qu'une app range dans les réglages d'un widget (la colonne `options` de sa section) peut donc
  se lire dans la session d'un visiteur dont la page porte ce widget. Rapporté (Form+, mesuré dans un vrai Grist, relu le 22/10) :
  le lien d'un formulaire donne la définition de tous les formulaires du document, clés de partage comprises ; il ne modifie,
  ne supprime et ne relit aucune ligne existante.
- Lu : toute action sur une table `_grist_*` demande le droit de structure, que le partage refuse (`GranularAccess.ts` 2786–2805).
  Rapporté pourtant (Form+, 16/09, 10.9) : une session de partage a écrit les réglages d'un widget sur l'instance de la DINUM.
  **C'est la première chose à remesurer chez le porteur** (mesure 1).
- Lu : l'interface de Grist n'affiche Publier, Dépublier et Partager qu'aux propriétaires (`FormView.ts` 409 et 700–733). Publier
  n'est pourtant qu'une suite d'écritures ordinaires : `AddRecord` dans `_grist_Shares`, puis `UpdateRecord` de
  `_grist_Pages.shareRef` et de `shareOptions` sur la section (`FormView.ts` 559–585), que seul le droit de structure arrête
  (`GranularAccess.ts` 2786–2805 : l'exception des propriétaires ne vaut que pour les tables de règles). Structure ouverte, un
  éditeur a ce droit. **Non lu** : si le serveur d'accueil rend alors le lien utilisable (mesure 4).
- Lu : le formulaire natif de Grist écarte les colonnes-formules (« Formulas are currently unsupported », `DocApi.ts` 1452–1458),
  mais le partage ne le fait pas pour la création : toutes les colonnes de la table l'acceptent.
- Mesuré (22/10, `mesure-formulaire-public.mjs`, grist-static 0.1.6). **Le labo ne simule pas un visiteur de lien** (ni `ShareRef`,
  ni anonyme) : il mesure ce qui n'en dépend pas. (A) *Le moteur de données*, un éditeur sans règle : une valeur fournie pour une
  colonne de gestion que le formulaire ne montre pas est gardée ; pour une colonne à formule déclenchée (comme `Adresse`, 10.8)
  aussi (« forgé » prend la place de « auto ») ; pour une colonne-formule pure, elle est **refusée** à l'ajout comme à la
  modification (l'erreur du labo n'a pas de texte ; le système, sans règle, est refusé de même) et la ligne n'est pas créée ; un
  choix hors de la liste, une référence vers une ligne qui n'existe pas (424242) et du texte dans une colonne numérique sont
  **gardés tels quels**. (B) *Des règles équivalentes à celles d'un partage* (les autres tables et la structure refusées, la
  création et la lecture de la ligne 0 sur la table du formulaire), données à une personne nommée (editor2@) : elle crée une ligne en
  remplissant une colonne de gestion et une colonne déclenchée ; elle ne lit **aucune ligne** de la table, pas même la sienne ;
  modifier une ligne, même celle qu'elle vient de créer, ou en supprimer une est refusé (« Blocked by table update | delete
  access rules ») ; créer dans une autre table (« table create ») et ajouter une colonne (« table structure ») aussi.
- Non lu : toute limite de nombre, de taille ou de débit propre à un lien. Il y a un suivi des appels de l'API par document
  (`DocApiUsageTracker`, `DocWorker.ts` 11 et 33) et des limites de l'offre de l'instance (lignes, taille) que ce travail n'a pas
  lues : ce qu'un lien qui les dépasse fait au document est à demander au porteur (mesure 5).

À mesurer chez le porteur, avec un vrai lien de formulaire publié et deux comptes (ces six points précisent le premier des dix
de 10.10) :

1. ce qu'une session de partage écrit : une ligne dans la table du formulaire ; une ligne dans une autre table ; un réglage de
   widget ; une colonne ; avec quel texte de refus (Form+ doit l'expliquer) ;
2. ce qu'elle lit : les réglages d'un widget de sa page et des autres pages, les noms des autres tables et colonnes, la colonne
   d'une Référence, et rien d'une ligne existante ;
3. avec les règles de GFS posées (Partagé, puis Encadré), le lien crée-t-il encore dans la table du formulaire ? (Lu : oui.)
4. structure ouverte : un éditeur publie-t-il un formulaire par l'API (les trois écritures de `FormView.ts` 559–585), et le lien
   répond-il ?
5. les limites de l'offre de l'instance (lignes du document, taille, appels de l'API par jour) et ce que devient le document quand
   un lien les dépasse (lecture seule pour tous ?).
6. un widget en accès complet, ouvert par un propriétaire, lit-il `_grist_Shares` (les identifiants et les options des liens), et
   ouvert par un éditeur, n'en reçoit-il rien ?

## 11. Firefox : ce que la page d'essai du porteur a mesuré (23/10)

**Deux postes.** Le porteur a deux PC (dit le 23/10, 21 h 50 heure de Paris) : celui du travail, sous **Firefox 140**, où il a fait tous
les essais jusqu'à 17 h 33, et celui de la maison, sous **Firefox 158**, où il a fait ceux de 21 h 17 et de 21 h 50. Le rapport d'une page
d'essai porte la version de Firefox dans sa deuxième ligne. Un écart entre deux rapports peut venir du poste (la version de Firefox, la
version ou les réglages de LanguageTool), non de GFS.

Mesuré par le porteur dans **Firefox 140 (Windows), LanguageTool installé**, sur la page `labo/essais-navigateur/` (commit `ff2834f`,
servie par Pages ; son rapport est dans le fil du 23/10, 14 h 35 heure de Paris). Cinq cadres posés par la page : A, un cadre
ordinaire ; B, isolé comme celui de GFS (`allow-scripts allow-forms allow-popups allow-modals allow-downloads`, origine nulle) ; C,
B avec `allow-same-origin` en plus ; D, deux niveaux de cadres ordinaires ; E, deux niveaux, le dernier isolé comme dans GFS. Dans
chaque cadre, des zones de texte avec des fautes et des boutons de téléchargement : t1, le geste de `downloadBlob` (adresse libérée
aussitôt) ; t2, adresse libérée au bout de 10 s ; t3, adresse `data:` ; t4 et t5, le fichier puis ses octets envoyés à la page du
dessus, qui l'enregistre ; t6, le geste de `downloadBlob` 7 secondes après le clic.

| Cadre | Origine vue du cadre | LanguageTool | t1 | t2 | t3 | t4 | t5 | t6 |
|---|---|---|---|---|---|---|---|---|
| A, ordinaire | le site | oui | rien | – | – | – | – | – |
| B, isolé (comme GFS) | nulle | **non** | rien | rien | rien | arrivé | arrivé | rien |
| C, B + `allow-same-origin` | le site | oui | rien | – | – | – | – | – |
| D, deux niveaux ordinaires | le site | oui | rien | – | – | – | – | – |
| E, deux niveaux, le dernier isolé | nulle | **non** | rien | rien | rien | rien | rien | rien |

- Mesuré, **LanguageTool** : B et C ne diffèrent que par `allow-same-origin`. Avec lui, LanguageTool laisse ses traces
  (`data-lt-installed`, éléments `lt-*`, attributs `data-lt-*` et `data-gramm`) et le porteur dit qu'il corrige ; sans lui, aucune
  trace, `spellcheck` reste absent des zones et seul le correcteur de Firefox souligne. L'imbrication n'y change rien (D). La cause
  est, sur le PC du travail (Firefox 140), l'origine opaque du cadre, donc l'isolement choisi le 16/10 (contrats 1.3, point 1) ; sur le
  PC de la maison (Firefox 158) LanguageTool travaille dans tous les cadres, l'isolé comme GFS compris (plus bas).
- Mesuré, **téléchargements** : tout enregistrement lancé depuis un cadre a échoué, isolé ou non (t1 en A, C, D ; tous en B et E).
  Ceux que la page du dessus a lancés ont réussi quand elle était la page de plus haut niveau (t4 et t5 en B) et échoué quand elle
  était elle-même un cadre (t4 et t5 en E).
- Lu, pas mesuré par nous : la page d'essai portait elle-même `frame-src 'self'`, comme GFS avant le correctif. **Firefox applique
  le `frame-src` de la page qui porte le cadre au téléchargement lancé dans ce cadre** ; Chromium ne le regarde pas pour un
  téléchargement. Un hôte qui n'y nomme pas `blob:` bloque donc ces fichiers sous Firefox. Cas décrits par d'autres :
  [AWS re:Post, tableaux de bord intégrés dans Firefox](https://www.repost.aws/articles/ARKhfT7erBRa2v195DR8x9Hg/resolving-csv-excel-download-failures-in-firefox-for-embedded-amazon-quicksight-dashboards-by-allowing-blob-in-csp),
  [support Mozilla, question 1287204](https://support.mozilla.org/en-US/questions/1287204) (un visionneur intégré, `default-src` sans
  `blob:`), [communauté Dynatrace](https://community.dynatrace.com/t5/Developer-Q-A-Forum/Downloading-blocked-by-CSP/m-p/262134)
  (même erreur, `frame-src` et `blob:` ; navigateur non nommé). Cela rend compte de tous les résultats ci-dessus : le contrôle A était
  faussé par la page elle-même ; Word marche dans Publipostage+ seule dans Grist (le cadre de Grist est ordinaire, et la page de
  Grist n'a pas de règle de ce genre : déduit, non lu) et pas dans GFS (sa règle ne nommait pas `blob:`).
- Fait : `blob:` ajouté au seul `frame-src` de GFS (`index.html`, contrôlé par `test/csp.test.mjs`).
- **À confirmer par le porteur** : l'export Word et PowerPoint de Publipostage+ dans GFS sous Firefox, correctif en ligne. À mesurer
  ensuite, avec la page d'essai refaite sous une règle qui nomme `blob:` : un cadre isolé enregistre-t-il directement (t1 à t3 et
  t6 en B et E), ou faut-il que GFS enregistre pour lui (t4 et t5) ?
- Lu, pas mesuré par nous : pourquoi LanguageTool s'arrête. Firefox et Chromium choisissent les pages où une extension entre d'après
  l'**adresse** du document pour les adresses http(s), non d'après son origine : dans Firefox, [`MatchPattern.cpp`](https://searchfox.org/mozilla-central/source/toolkit/components/extensions/MatchPattern.cpp)
  regarde pour ces adresses l'URL du document, jamais le principal (son commentaire sur les schémas non opaques), et [`ExtensionContent.sys.mjs`](https://searchfox.org/mozilla-central/source/toolkit/components/extensions/ExtensionContent.sys.mjs)
  n'écarte aucun document à principal nul ; dans Chromium, [`content_script_injection_url_getter.cc`](https://chromium.googlesource.com/chromium/src/+/main/extensions/common/content_script_injection_url_getter.cc)
  rend l'adresse du document tant que le schéma n'est pas `about`, `data`, `blob` ou `filesystem`. Rien ne dit donc qu'une extension
  n'entre pas dans un cadre isolé : elle y entre probablement et **s'y arrête d'elle-même** (cause inconnue : le code de l'extension
  n'est pas public). Une sonde d'extension de notre fabrication le dirait (non faite). Dans tous les cas l'app ne peut rien y changer.
- **Mesuré par le porteur** avec la page `labo/essais-navigateur/croise.html` (Firefox 140, Windows, 23/10, 15 h 47 heure de Paris ; sa
  mécanique, `run-essai-croise.mjs`, est vérifiée dans Chromium) : le cadre isolé qui **garde sa vraie origine**, posé par une page
  d'**une autre origine** (le contrôle C ne donnait que la même origine que GFS). La page, enregistrée puis ouverte depuis le disque
  (son rapport lui donne l'origine `null`), pose trois cadres venus du site de GFS : X, cadre simple (origine `https://lombre33.github.io`,
  stockage permis, LanguageTool **oui**) ; Y, isolé comme GFS **plus `allow-same-origin`** (même origine, stockage permis,
  `data-lt-installed` présent, LanguageTool **oui**) ; Z, isolé comme GFS (origine nulle, stockage refusé, aucune trace, LanguageTool
  **non**). Dans ce Firefox 140, ce n'est donc ni le sandbox ni le sous-cadre qui arrête LanguageTool, c'est l'origine opaque : une
  vraie origine **différente de celle de la page qui le porte** suffit. Cette page, ouverte depuis le disque, n'était pas elle-même
  de vraie origine : la même mesure sous une page de vraie origine est celle de 21 h 17, plus bas. Pas mesuré : Chrome, Edge et Safari.
- **Une origine de plus sans domaine ni second compte : le nom du site écrit avec un point à la fin** (`https://lombre33.github.io.`).
  Le nom complet d'un site finit par un point qu'on n'écrit pas d'ordinaire ; le navigateur le garde dans l'origine, donc
  `lombre33.github.io` et `lombre33.github.io.` sont deux origines pour une même machine. Une origine, c'est le schéma, le nom et le port :
  GitHub Pages fixe le schéma (https) et le port, le dossier et les paramètres n'en font pas partie. Mesuré dans Chromium par nous (labo,
  `run-essai-croise.mjs`, partie `?point`, avec `localhost` contre `localhost.` : une adresse IP ne peut pas porter de point final) :
  deux origines (`http://localhost:PORT` et `http://localhost.:PORT`), aucune lecture dans un sens ni dans l'autre (`SecurityError`),
  stockage permis dans le cadre isolé qui garde son origine, en-tête `Host` envoyé avec le point, `frame-src 'self'` bloque le cadre au
  nom avec le point et un `frame-src` qui le nomme l'accepte. **Mesuré par le porteur** (Firefox 140, Windows, 23/10, 17 h 33 heure de
  Paris) : `cadre.html` s'ouvre à `https://lombre33.github.io./…` ; GitHub Pages répond donc au nom avec le point et Firefox accepte le
  certificat. **Lu** : l'analyseur de règles de Firefox ([`nsCSPParser.cpp`](https://searchfox.org/mozilla-central/source/dom/security/nsCSPParser.cpp),
  fonction `subHost`, d'après deux résumés concordants de la page, non relue ligne à ligne) refuse un nom qui finit par un point et
  ignore la source. **Mesuré par le porteur** (Firefox 158, Windows, 23/10, 21 h 17 heure de Paris), avec `croise.html?point` ouverte
  sur le site en ligne, donc sous une page de vraie origine (`https://lombre33.github.io`) dont les trois cadres viennent de
  `https://lombre33.github.io.` (« LanguageTool corrige ici » est la réponse de la personne ; les traces ne sont qu'un indice) :
  - **La règle `frame-src` de Firefox refuse le nom avec le point.** Deux petites pages, chacune avec sa balise `<meta>` et deux
    cadres de contrôle, W à l'adresse avec le point et V au même site sans le point : la règle qui nomme l'adresse avec le point
    bloque **les deux** (« frame-src a bloqué https://lombre33.github.io. » et « … https://lombre33.github.io ») ; la règle qui
    nomme l'adresse sans le point laisse passer V et bloque W. Aucune ne laisse passer un cadre à l'adresse avec le point : pour
    que GFS en pose un, sa règle devrait s'ouvrir à tout `https:` ou passer par une page-relais. Cela confirme la lecture de
    `subHost` pour Firefox 158 ; Firefox 140 n'a pas été mesuré sur ce point.
  - X, cadre simple : origine `https://lombre33.github.io.`, stockage permis, aucune lecture dans un sens ni dans l'autre
    (`SecurityError`), LanguageTool **oui**. Y, isolé comme GFS plus `allow-same-origin` : même origine, mêmes lectures refusées,
    stockage permis, LanguageTool **oui** (traces `lt-highlighter`, `lt-div`, `lt-toolbar`, `lt-span`, les deux zones marquées).
  - **Z, isolé comme GFS (origine nulle, stockage refusé) : LanguageTool oui** (traces `lt-toolbar`, `lt-div`, `lt-span` et
    `data-lt-installed`, pas de `lt-highlighter`, une seule des deux zones marquée, comme en X). Le même Z avait donné **non** à
    15 h 47 (PC du travail, Firefox 140, page ouverte depuis le disque, cadres au nom sans point). Trois choses avaient changé à la
    fois : le poste (Firefox 140, puis 158), la page qui porte les cadres (le disque, puis le site en ligne) et le nom du site des
    cadres (sans, puis avec le point). La mesure de 21 h 50 (ci-dessous) les sépare : c'est le poste.
- **Mesuré par le porteur** (PC de la maison, Firefox 158, 23/10, 21 h 50 heure de Paris) avec `labo/essais-navigateur/profond.html`,
  ouverte sur le site en ligne (`https://lombre33.github.io`) : trois pages l'une dans l'autre comme GFS dans Grist, le cadre de l'app au
  nom du site ou au nom avec le point final (sa mécanique, `run-essai-profond.mjs`, est vérifiée dans Chromium). **LanguageTool corrige dans
  les cinq cadres** (la réponse est celle de la personne) : P1, le réglage d'aujourd'hui de GFS (l'app isolée, origine nulle, au nom du
  site, niveau 2) ; P2, de même au nom avec le point ; P3, isolée avec `allow-same-origin` au nom avec le point (origine
  `https://lombre33.github.io.`, stockage permis) ; P4 et P5, un niveau de moins, au nom du site puis au nom avec le point. Le porteur
  dit aussi que l'extension marche dans GFS lui-même sur ce PC. Donc, sur ce poste, **ni l'origine opaque, ni le nombre de niveaux, ni
  le nom du site n'arrêtent LanguageTool, et GFS n'a rien à changer pour lui** ; ce qui l'arrêtait au travail (Firefox 140) tient au
  poste : la version de Firefox, ou la version ou les réglages de l'extension. **Pas mesuré** : P1 à P5 sur le PC du travail (essai
  prévu le 24/10, avec la version de l'extension sur chaque PC) ; Chrome et Edge.
- Hors de ce que ces pages peuvent dire : Safari.
