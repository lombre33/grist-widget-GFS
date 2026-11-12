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
- Lu et mesuré le 27/10 (grist-static 0.1.6 ; ses sources sont dans les fichiers `.map` de `dist/`) : **le cadre que le labo donne à GFS porte un attribut de plus que
  celui d'un Grist ordinaire, `credentialless`**. `WidgetFrame.ts` (`buildDom`, lignes 224 à 227) pose l'adresse, `{ allow: "clipboard-write" }`, puis
  `hooks.iframeAttributes`. Les réglages par défaut de Grist (`app/client/DefaultHooks.ts`, lignes 5 à 23) n'ont pas de `iframeAttributes` ; ceux de grist-static
  (`ext/app/client/HookStub.ts`, lignes 25 à 29) y mettent `credentialless: true`. Mesuré dans Chromium 141 (`labo/run-capacites.mjs`, essais `fenetre` : la sonde, ouverte comme
  une app dans le sous-cadre de GFS) : **avec l'attribut** (le labo tel quel), `window.open` rend `null` et la fenêtre s'ouvre sans `window.opener` et sans nom ; **sans lui**
  (`CAP_ORDINAIRE=1`, ou `ordinaryFrame` dans `labo/lab-setup.mjs`), `window.open` rend la fenêtre, qui garde `window.opener` et le nom demandé, avec l'origine nulle et le
  stockage refusé (le bac à sable du sous-cadre est hérité : `allow-popups` sans `allow-popups-to-escape-sandbox`) ; avec `noopener` demandé, `null` et pas d'ouvreur dans les deux
  cas. La vraie Publipostage+ (à `b9184cf`, `labo/run-barre-ecartee.mjs`, partie `presenter`) donne la même chose : sa fenêtre « Présenter » perd son ouvreur et son nom
  `pp-slide-show` avec l'attribut (premier essai du labo), les garde sans lui. Lu dans la table de compatibilité de MDN (`mdn/browser-compat-data`, `api/HTMLIFrameElement.json`,
  relue le 27/10) : `credentialless` existe depuis Chrome 110 (Edge de même) ; **Firefox et Safari ne l'ont pas**. **Non mesuré** : si l'instance du porteur (grist.numerique.gouv.fr)
  ou `docs.getgrist.com` ajoute un attribut à ce cadre (le proxy du cloud refuse ces adresses : ni leurs en-têtes ni leur page ne sont lus) ; Firefox. **Pour le labo** : une mesure qui
  dépend d'une fenêtre ouverte par une app se fait avec `ordinaryFrame` ; les autres passes n'ont pas été refaites sans l'attribut.
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
- Lu et mesuré le 03/11 (mêmes sources ; `labo/run-page-ligne.mjs`, grist-static 0.1.6, Chromium, la vraie Publipostage+) : **un widget peut n'avoir aucune
  ligne sans être relié.** `TableNotifier` et `RecordNotifier` envoient `rowId: cursor.getCursorPos().rowId || undefined` (lignes 653 et 768) : quand le
  curseur de la section n'a plus de ligne, le message dit `rowId` `undefined`, et le script d'API n'appelle pas `onRecord` (`grist-plugin-api.ts`,
  ligne 382 : `!msg.tableId || !msg.rowId || msg.rowId === "new"`). Un **filtre enregistré** qui écarte toutes les lignes (`_grist_Filters`, `filter`
  `{"included":[]}`) a ce résultat : section non reliée (`asTarget` nul), `fetchSelectedTable` sans ligne, et Publipostage+, ouverte ensuite en Lecture, montrait
  « Reliez ce widget à votre tableau » : l'écran que le porteur a vu le 03/11 (table non vide, widget non relié). Ce qui a vidé le curseur chez lui n'est pas
  établi. `GristViewImpl.fetchSelectedRecord` (ligne 469) lit `tableData.getValue(rowId, …)` pour **n'importe quelle** ligne de la table, filtrée ou non : une
  ligne que GFS dit à l'app (contrats 4.5, point 7) se relit donc par la vue de Grist.
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
- Mesuré le 21/10 dans un vrai Grist (grist-static 0.1.6, Chromium, `labo/run-demo.mjs`, essai retiré le 04/11 avec le bouton « Démo » : il reste dans l'historique de Git) : **changer la table d'une section de
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
- Mesuré le 02/11 (`labo/run-form.mjs`, 48 vérifications, et `run-form-seul.mjs`, 12 ; grist-static 0.1.6, Chromium) avec Form+ à `fd5384a` (consignes 012, 013
  et 014 faites) : **« Partir de zéro » pose le formulaire natif sur une page neuve et Grist ne recharge aucun cadre**, ni celui de GFS ni celui de Form+, avec ou
  sans GFS : l'enregistrement va jusqu'au bout. **Un formulaire natif posé sur la page du widget** (Grist y reconstruit le cadre) **est refusé par l'app, avec sa
  raison, avant toute copie** : aucune fenêtre, rien d'écrit. **Une ligne par formulaire**, et pour chacun une petite table d'une ligne `FormPlus_Pub_<vsId>` qui
  porte sa `Definition` et une colonne cachée `FormPlusDef_<vsId>` dans la table du formulaire (une Référence qui affiche `Definition`, champ caché dans la
  copie) : aucune ne porte la définition d'un autre, et la colonne partagée d'avant n'est plus posée. **Fenêtres** : au premier enregistrement, deux de Form+ (sa
  table `FormPlus_Formulaires`, puis « Avant de publier cette copie », qui dit la table recevant des lignes) et deux de GFS (la table des réponses ouverte à
  l'ajout, puis la lecture de la colonne `Definition` de la petite table de CE formulaire) ; pour un second formulaire, une de Form+ et deux de GFS (sa table à
  l'ajout, puis sa petite table à la lecture) ; le même lien une seconde fois, aucune ; le mode interne, une de Form+ (la table `FormPlus_Repondants`, dont la
  colonne `Email` est une formule déclenchée `user.Email`) et aucune de GFS. **L'ancienne porte** (une section de formulaire publiée sur `FormPlus_Formulaires`,
  posée par `038dd1b`) est proposée à la fermeture par une fenêtre de Form+, avant tout le reste ; elle est dépubliée par `UpdateRecord` de `shareOptions`, jamais
  supprimée, et GFS ne demande ni ne refuse rien. Le courtier ne refuse rien de tout cela et l'app ne lève aucune erreur de script. **Non mesuré par GFS** : ce
  qu'un vrai lien lit de la petite table. Form+ l'a mesuré sur un Grist Docker avec une vraie clé de partage (`GFS-ETAT.md` de l'app, 013 point 1) : le lien ne
  rend plus que la ligne de CE formulaire, là où la colonne partagée d'avant rendait les définitions de tous, clés de partage comprises.
- Mesuré le 03/11 (`labo/run-publication.mjs`, 36 vérifications, en français / clair, anglais / sombre, français / sombre et anglais / clair ; `labo/run-form.mjs`, 48,
  en français / clair et anglais / sombre ; grist-static 0.1.6, Chromium, à 700 × 400, à la vraie souris et au vrai clavier) avec Form+ à `fd5384a` : **parmi les tables de
  l'app qui publie, un lien public ne lit que les petites tables que le manifeste déclare** (`permissions.lienPublic`, Form+ : `FormPlus_Pub_*` ; décision du porteur du
  03/11). Un formulaire dont la Référence lit `FormPlus_Formulaires.Definition` (la table qui garde la définition et la clé de partage de tous les formulaires) est
  **refusé sans fenêtre** (`GFS_REFUSE`, « … FormPlus_Formulaires à la lecture … son manifeste ne déclare pas lisible par un lien public ») et la section n'est pas publiée ;
  celui dont la Référence lit la petite table `FormPlus_Pub_9` ouvre la fenêtre de GFS (« ajouter des lignes à la table « Courriers » », puis « lire toutes les valeurs de la
  colonne « Definition » de la table « FormPlus_Pub_9 » »), qui tient dans le panneau sans défilement, en clair et en sombre, en français et en anglais, et le lot passe avec
  l'accord. Avec la vraie Form+, rien de ce qu'elle fait n'est refusé et aucune fenêtre ne s'ajoute (les mêmes deux de GFS à l'enregistrement par le lien). **Non mesuré** :
  ce que Grist ouvre vraiment à qui a le lien (10.11), grist-static n'a pas de partages.

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
- **Un envoi** (POST, PUT, PATCH, DELETE) **avec un jeton exige en plus `X-Requested-With: XMLHttpRequest`**, sinon le navigateur ne rend que
  « NetworkError » : mesuré le 03/11, section 14.

## 5. GitHub Pages et GitHub

- En-têtes relevés le 14/10 (`lombre33.github.io/publipostageGrist/index.html`) : `access-control-allow-origin: *`,
  `cache-control: max-age=600` ; aucune adresse par version.
- **Une origine par compte** : `lombre33.github.io` sert tous les sites de projet du compte et le site du dépôt
  `lombre33/lombre33.github.io` (2020) ; de même pour `grist-factory.github.io`.
- Pages (Jekyll, par défaut) ne sert **aucun fichier ni dossier dont le nom commence par « _ » ou « . »** (vu le 09/10 :
  un dossier `_tables/` répondait 404 en ligne, alors qu'il marchait en local).
- **Une publication qui échoue laisse le site sur l'ancienne version, sans rien montrer** (vu le 02/11 chez Automation+, d'après sa page
  d'état à `746a564`) : Pages passe aussi les fichiers `.md` dans Jekyll, et une accolade double non fermée (`{{` sans `}}`) fait échouer
  la construction ; `lombre33.github.io/GRIST_automation/` est resté à la 0.9.0 du 21/10 au 02/11, alors que le dépôt était à la 0.11.1. Le
  découpage de Liquid, rejoué sur ses fichiers `.md` à `f3ab8d6`, ne trouve qu'une accolade non fermée (`docs/TESTS_GRIST_REEL.md`, ligne
  134) ; un `.nojekyll` à la racine (ajouté à `941eafd`) règle le cas. GFS ouvre les apps sur leur site depuis le 22/10 (`4394fb0`) : tant
  que le site répond, le repli sur la copie ne joue pas (il ne joue qu'au bout de 15 secondes sans réponse), donc rien ne signale une
  version ancienne. Au 02/11, aucun des quatre autres dépôts (Publipostage+, Form+, Grist-BI, SlidesPlus) n'a de `.nojekyll` ni d'accolade
  non fermée dans ses `.md`. **Pas mesuré** : la version réellement servie par chaque site (github.io est injoignable depuis le cloud) ;
  Jekyll lui-même (le découpage est celui de Liquid, rejoué par un script).
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
l'API, et la ligne-sonde sous « Partagé » (10.8). **Trois sont faits depuis le 04/11 sur Grist 1.7.19 (section 40)** : qui est vraiment propriétaire, le jeton du widget et la liste des utilisateurs, la version. Les contrats 11 (version 0) ne deviennent définitifs qu'après elles. Les liens publics ont leurs
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
  ne supprime et ne relit aucune ligne existante. Form+ l'a corrigé (consigne 013, faite le 02/11) : une petite table et une colonne cachée par formulaire, § 2.
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
- Lu dans Form+ (`poc/js/respond.js`, `grist-meta.js`, `config-editor.js`, à `cc21a27` le 23/10 ; `ensureTableGate` relue à `6059fb9`
  le 04/11) : **la page des répondants écrit chaque table directement, table par table**, sans table d'arrivée ni déplacement après
  coup. `onSubmit` (`respond.js` 826–1030) range les réponses par table, envoie les pièces jointes, écrit la table principale (celle du
  formulaire natif) par l'API REST du partage, puis chaque autre table par `grist.docApi.applyUserActions([['AddRecord', …]])` ; aucune
  atomicité (une table qui échoue laisse les autres écrites : l'avertissement « envoi partiel », `failedTables`), et si la principale
  échoue rien d'autre n'est écrit. Chaque table secondaire est ouverte au lien par `ensureTableGate` (`grist-meta.js` 129 ; toujours
  appelée à `6059fb9`) : une section de formulaire **vide** publiée sur la page, donc la création dans toutes ses colonnes (ci-dessus).
  La page de secours hors Grist (`public-form.js`) n'écrit que la table principale. C'est pourquoi la boîte aux lettres (contrats 11.7,
  point 9) serait un ajout de Form+, et pourquoi la consigne 013 limite les tables secondaires à des tables de réception à elles.
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
version ou les réglages de LanguageTool), non de GFS. L'essai à trois pages (`profond.html`) a été fait sur les deux : à la maison le 23/10
à 21 h 50, au travail le 27/10 à 9 h 43 (plus bas).

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
  poste : la version de Firefox, ou la version ou les réglages de l'extension.
- **Mesuré par le porteur** (PC du travail, Firefox 140, 27/10, 9 h 43 heure de Paris), avec la même `profond.html` ouverte sur le site
  en ligne : **LanguageTool ne corrige que dans P3** (traces `lt-highlighter`, `lt-div`, `lt-toolbar`, `lt-span`, les deux zones marquées,
  stockage permis, aucune lecture de la page porteuse : `SecurityError`), l'app isolée qui garde sa vraie origine (`allow-same-origin`)
  au nom avec le point final, donc d'origine `https://lombre33.github.io.`, autre que celle de la page qui la porte. **Non** dans P1
  (le réglage d'aujourd'hui de GFS : origine nulle, trois pages, nom du site), P2 (de même au nom avec le point), P4 et P5 (un niveau
  de moins, au nom du site puis avec le point) : ni `data-lt-installed`, ni `lt-*`, ni attribut posé sur les zones. Donc, sur ce poste,
  **l'origine opaque arrête LanguageTool** (le nombre de niveaux, un ou deux, et le nom du site, avec ou sans point, n'y changent rien) et
  **le nom avec le point ne sert que s'il s'accompagne de `allow-same-origin`** : il donne au cadre une origine propre, il n'ouvre pas
  LanguageTool à lui seul (P2 et P5 contre P3). P3 est le cadre qu'une « adresse propre à l'app » donnerait. Les deux postes diffèrent
  sur P1, P2, P4 et P5 (non au travail, oui à la maison) : version de Firefox (140, 158) ou version ou réglages de l'extension, non
  communiquées. Cherché sans résultat net (27/10) : un bogue de Mozilla qui expliquerait cet écart. **Pas mesuré** : la version de
  l'extension à la maison (au travail : 11.3.1, 28/10) ; une version de Firefox entre la 140 et la 158 ; Chrome et Edge ; la règle `frame-src` de Firefox 140
  devant le nom avec le point (la page d'essai ouvre `frame-src` à `https:`, et le cadre P3 s'y est posé).
- **Rapporté par le porteur** (PC du travail, 28/10, 19 h 13 heure de Paris) : **LanguageTool 11.3.1**. C'est la version courante du module sur
  addons.mozilla.org (mise à jour du 14/08/2026, page lue le 28/10) : mettre l'extension à jour au travail ne changerait rien. Pour l'écart entre
  les deux postes il reste la version de Firefox (140 au travail, 158 à la maison), un réglage ou une règle de l'entreprise, ou la version de
  l'extension à la maison (non communiquée). **Décision du porteur le 28/10, 19 h 11 : l'isolement reste tel quel, GFS ne donne d'adresse
  propre à aucune app** (cahier, section 2) ; l'écart se cherche sur les postes, sans code.
- **Rapporté par le porteur** (PC du travail, 28/10, 19 h 21 heure de Paris) : « j'ai mis à jour Firefox et du coup cela fonctionne ». **LanguageTool
  11.3.1 fonctionne donc dans GFS tel quel depuis la mise à jour de Firefox** (version d'arrivée non donnée ; `profond.html` n'a pas été refaite).
  **La cause de l'écart entre les deux postes était la version de Firefox (140)**, non l'extension ni GFS : dans un Firefox à jour, le cadre
  isolé de GFS n'empêche pas LanguageTool. Le porteur : « on ne touche plus à rien » ; l'isolement et la décision du 28/10 restent.
- Hors de ce que ces pages peuvent dire : Safari.

## 12. Les liens entre apps : ce que le labo a mesuré (03/11)

Mesuré dans un vrai Grist (grist-static 0.1.6, Chromium), à 700 × 400, à la vraie souris et au vrai clavier, en français et en anglais, en
clair et en sombre : `run-liens.mjs` (sondes Q et O), `run-liens-publipostage.mjs` (la vraie Publipostage+, celle que GFS référence) et
`run-liens-kit.mjs` (le vrai client du kit 0.3.0). Les sondes, leurs tables et leurs mots sont décrits dans `labo/LISEZ-MOI.md`. Firefox et
Safari ne sont pas mesurés (le labo n'a que Chromium).

- **Un cadre d'app qui ne dit pas qu'il est prêt reste caché** : GFS ne montre le cadre qu'à l'arrivée de `themeInitialized` (ou après
  `REVEAL_TIMEOUT_MS` à partir de `ready`), comme Grist pour ses widgets (`js/broker/session.js`, `#reveal`) ; un cadre caché (`visibility:
  hidden`) ne reçoit aucun clic. Une app d'essai écrite pour cliquer dedans envoie `{ mtype: 5 }` puis `{ mtype: 4, data: { message:
  'themeInitialized' } }`.
- **Le kit se charge dans un cadre isolé** : `import '/kit/js/gfs-link.js'` depuis une page d'origine opaque (`sandbox="allow-scripts"`, sans
  `allow-same-origin`), sous `script-src 'self'`, marche si le serveur du module pose l'en-tête CORS ouvert (`Access-Control-Allow-Origin: *`),
  comme GitHub Pages ; sans lui, le module ne se charge pas.
- **Publipostage+ à `134d043` ne dit rien d'une ouverture par un lien** : sa table de phrases (`js/gfs-open.js`, `REASON_TEXT`) ne connaît que
  `explorateur` ; une raison inconnue (`lien`) n'affiche rien, l'app ouvre le fichier désigné (une grille : son éditeur ; une
  présentation : l'extension « Diapositives » active) et son coin d'état garde « Widget prêt. ».
- **Publipostage+ offre à choisir** ses documents, ses grilles et ses présentations (`actions.choisir`) ; un e-mail, une macro, un
  type que le manifeste ne connaît pas (`diaporama` dans le document d'essai) ne se listent pas en mode choix. Une présentation est
  grisée tant que l'extension « Diapositives » est éteinte ; le double-clic ouvre la fenêtre des apps sur la ligne de l'extension.

## 13. Le glisser-déposer HTML5 dans le cadre d'une app (03/11)

La question de Tuesday (son `GFS-ETAT.md`) : son kanban et son calendrier font glisser des tâches avec l'API HTML5 ; marche-t-elle dans le sous-cadre de GFS ?

- **Mesuré** dans un vrai Grist (grist-static 0.1.6, Chromium), à 700 × 400, avec la souris de Playwright (`labo/run-glisser.mjs`, la sonde U de `labo/sondes/u-glisser/`,
  13 vérifications en français et clair, 13 en anglais et sombre) : dans le sous-cadre que GFS pose (`sandbox="allow-scripts allow-forms allow-popups allow-modals
  allow-downloads"`, sans `allow-same-origin`), sous une politique sans style en ligne comme celle de Tuesday, l'app reçoit `dragstart`, `dragover`, `drop` et
  `dragend` ; `dataTransfer` garde son texte d'un événement à l'autre ; l'effet retenu est `move` sur une cible et `none` hors de toute cible ; le cadre n'est pas
  rechargé et GFS n'avertit de rien. Vrai d'un `<article draggable>` (la carte du kanban) comme d'un `<button draggable>` (la puce du calendrier de Tuesday).
- **Pas mesuré** : Firefox (le labo n'a que Chromium ; `LAB_BROWSER=firefox` sur une machine qui l'a), le tactile, le clavier.
- **Lu ailleurs, pas mesuré ici** (fiches de Mozilla lues le 03/11) : un `<button draggable="true">` ne démarre pas de glissement dans Firefox avant la 147
  (bug 568313, « Impossible to make <button>s draggable », corrigé dans la 147 ; le bug 1967645, ouvert contre la 138, a été fermé comme doublon de celui-là).
  Le Firefox du porteur au travail était en 140 avant sa mise à jour du 28/10 (version d'arrivée non donnée), celui de la maison en 158 : une puce de calendrier faite
  d'un `<button>` peut ne pas glisser chez lui. Une carte faite d'un `<article>` n'est pas touchée.

## 14. L'envoi d'une pièce jointe par l'API REST (mesuré le 03/11)

La question de l'étude PDF (lot 1 : GFS garde les PDF dans le document) : GFS peut-il envoyer un fichier, avec le jeton de `getAccessToken`, depuis sa page ? La sonde du
vrai Grist (`labo/reel/`, section 3) a d'abord échoué chez le porteur (DINUM, Grist 1.7.19, Firefox 140, 03/11 12:03 UTC : « NetworkError when attempting to fetch resource »,
même pour 0,1 Mo). Reproduit puis expliqué sur un **vrai serveur Grist 1.7.19** (l'image officielle `gristlabs/grist:1.7.19`, `labo/vrai-serveur.sh`), la page de la sonde sur
une autre origine, Chromium (`labo/run-reel-serveur.mjs`, 15 vérifications).

- **La cause** (`/grist/_build/app/server/lib/Authorizer.js` de l'image 1.7.19, lignes 238-245 et 474-482 ; source `app/server/lib/Authorizer.ts`, `resolveIdentity` et `addRequestUser`) :
  un jeton `?auth=` ne donne pas d'identité explicite (`explicitAuth: false`, « Access tokens don't set a userId, so CSRF protection still applies »). Une requête qui n'est ni
  GET, ni HEAD, ni OPTIONS doit alors porter `X-Requested-With: XMLHttpRequest` (ou `Content-Type: application/json`), sinon Grist répond **401** « Unauthenticated requests
  require one of the headers… ».
- **Pourquoi le navigateur ne dit rien** (`FlexServer.js`, `addApiMiddleware`, lignes 952-953) : `_userIdMiddleware` (où se trouve la garde) passe AVANT `_trustOriginsMiddleware`
  (qui pose `Access-Control-Allow-Origin`). Le 401 part donc sans en-tête CORS, et le navigateur ne rend pas la réponse : Firefox dit « NetworkError when attempting to fetch
  resource », Chromium « Failed to fetch » (sa console : « No 'Access-Control-Allow-Origin' header is present »). Rien n'est reçu ni gardé.
- **Avec l'en-tête** : le navigateur envoie d'abord OPTIONS ; `trustOriginHandler` (`FlexServer.js`, ligne 2802) y répond 200 avec `Access-Control-Allow-Origin: *`,
  `Allow-Methods: GET, PATCH, PUT, POST, DELETE, OPTIONS` et `Allow-Headers: Content-Type, X-Requested-With` (pas `Authorization`, comme pour toute origine non reconnue). L'envoi passe.
  Mesuré avec l'en-tête, depuis la page d'une autre origine (celle de GFS) : `POST /attachments?auth=…`, champ `upload` → 200 et `[numéro]` ; le nom « Facture été (1).pdf » arrive intact
  (accents, espaces, parenthèses) ; la fiche (`fileName`, `fileSize`) est dans la liste ; le téléchargement (`GET /attachments/:numéro/download?auth=…`) rend les mêmes octets avant comme après le
  rattachement, en `application/pdf` ; la cellule d'une colonne `Attachments` s'écrit `['L', numéro]` et se relit pareil, brute et décodée ; remplacer, c'est un second envoi puis
  `UpdateRecord` (l'ancienne pièce jointe reste listée, Grist l'efface seul au bout de 7 jours) ; **50 Mo acceptés** (aucune limite par défaut, 5 s en local). Le jeton d'écriture dure 900 000 ms.
- **Les GET** (liste, téléchargement) n'ont pas besoin de l'en-tête. L'en-tête `Authorization` reste refusé par le navigateur (absent de `Allow-Headers`).
- **Conséquence pour GFS** : tout envoi (et toute écriture REST) depuis une page du navigateur porte `X-Requested-With: XMLHttpRequest`. Les apps n'envoient rien : elles confient les octets à GFS.
- **Pas mesuré** : le serveur du porteur avec l'en-tête (passerelle, taille maximale réelle : la sonde relancée le dira), Firefox (le labo n'a que Chromium).

## 15. L'adresse e-mail de la personne donnée aux apps qui la déclarent (mesuré le 03/11)

Le choix du porteur du 03/11 (« Aux apps qui le déclarent ») : GFS lit déjà l'adresse pour son rangement (section 3, la ligne-sonde) ; il la donne, et à elles seules, aux apps dont le
manifeste déclare `permissions.identite` (contrats 3.4, point 6, et 5.2, point 9).

- **Mesuré** dans un vrai Grist (grist-static 0.1.6, Chromium), à 700 × 400, à la vraie souris, en français et en anglais, en clair et en sombre : `labo/run-personne.mjs`, 34 vérifications
  par combinaison, aucune en échec, avec trois sondes (`labo/sondes/v-personne/`) : V déclare l'identité, W ne la déclare pas, X est écrite avec le vrai client du kit 0.4.0
  (`GfsLink.identity`, `onIdentity`).
- **Avant que GFS connaisse la personne** (la table `GFS_Rangement` n'existe pas) : le contexte de V porte `identite: null` et aucun événement n'arrive. **Quand la table naît** (la
  personne épingle un fichier et accepte) : V reçoit un seul événement `identite` avec `{ email }`, l'adresse que le moteur de Grist a rendue (la casse est gardée :
  `Ana@Exemple.org` reste ainsi) ; un geste de plus ne le répète pas ; le moteur ne reçoit que les écritures de la section 3 (la table, la ligne-sonde, son retrait, la ligne de la personne).
- **À la réouverture** (la table existe) : le contexte de V porte l'adresse dès le départ, sans événement, et GFS n'écrit que la sonde (ajoutée puis retirée) ; l'adresse n'est dans l'adresse
  d'aucun cadre (ni celui de GFS, ni celui de l'app). Le contexte garde tous ses autres champs.
- **W, qui ne l'a pas déclarée**, reçoit `null` dans tous les cas, la même valeur que V sans la table : elle ne peut pas savoir si GFS connaît la personne, et l'adresse n'est nulle part dans ce
  qu'elle reçoit (contexte et événements). **X** lit `GfsLink.identity()` après `ready` et son abonné est rappelé une fois, avec la même valeur.
- **Une autre personne** qui ouvre le même document reçoit la sienne, jamais celle de la précédente (GFS ne garde rien dans le navigateur). L'anonyme de Grist, une personne sans adresse et un
  document en lecture seule donnent `null`.
- **Pas mesuré** : le serveur de Grist (grist-static n'a pas de compte : le labo donne la personne au moteur de données, comme pour la section 3 ; l'adresse que rend un vrai serveur est
  celle dont Publipostage+ se sert depuis longtemps pour ses préférences), Firefox et Safari (le labo n'a que Chromium).
- **L'outil de liste** : `node outils/capacites.mjs --identite` dit quelles apps du catalogue reçoivent l'adresse et pourquoi (`--en` pour l'anglais, `--json` pour un programme) ; sans filtre,
  toutes les capacités déclarées. Aujourd'hui aucune app du catalogue ne la déclare.

## 16. GFS garde les PDF : ce que le vrai serveur a mesuré (03/11)

Le lot 1 de l'étude PDF (GFS garde les PDF, contrats 6.6), joué par `labo/run-pdf.mjs` dans un **vrai serveur Grist 1.7.19** (l'image officielle, `labo/vrai-serveur.sh`), Chromium, GFS ajouté comme widget à un
document neuf, panneau à 700 × 400, souris et clavier réels, en français et en clair puis en anglais et en sombre. Ce que le serveur retient est relu par l'API REST avec la session de la personne d'essai.

- **La table** : l'accord est demandé avant tout envoi ; refusé, ni la table, ni la ligne, ni la pièce jointe n'existent. Accordé, `AddTable` crée `GFS_Fichiers` avec ses huit colonnes aux types attendus
  (`Text`, `DateTime:UTC`, `Attachments`, `Int`) et **Grist ajoute une page pour elle** (relue dans `_grist_Pages`).
- **Le cadre d'envoi tient sous le bac à sable** : `sandbox="allow-scripts"` seul, `window.origin` vaut `null`, le cadre est caché ; le canal privé (`MessageChannel`, remis après le `load` du cadre) passe les
  demandes, le routeur ne reçoit rien de lui. L'envoi (`POST /attachments?auth=…`, champ `upload`, avec `X-Requested-With`) et le téléchargement (`GET`, sans) y marchent, le nom du fichier arrive intact. **Le labo
  ajoute l'adresse du serveur d'essai à la source `connect-src` de la page du cadre** (le serveur local est en `http`, que `https:` ne couvre pas) : `connect-src https:` seul n'a pas été mesuré face à un serveur
  en https.
- **Le contenu est celui qui a été choisi** : la ligne porte le nom, `pdf`, la taille, `import`, la date du jour et la cellule `['L', numéro]` ; le fichier relu du serveur a la même empreinte (sha-256) et
  le type `application/pdf` ; la pièce jointe garde le nom du fichier. Un fichier de **12 Mo** (12 582 944 octets) part et revient identique en **4 à 10 s** en local.
- **Un nom pris** : la fenêtre propose « Garder les deux » (le clavier y est), « Remplacer », « Annuler » ; Échap n'écrit rien. « Garder les deux » donne « Nom (1).pdf », ou « (2) » si « (1) » est pris, en gardant la
  casse du nouveau nom (« facture (2).PDF »). « Remplacer » garde la ligne (même `Identifiant`, même nom), met le nouveau contenu (nouvelle pièce jointe) et laisse l'ancienne listée, que Grist efface seul au
  bout de 7 jours (section 14). Tab tourne dans la fenêtre sans en sortir ; Entrée sur « Garder les deux » garde les deux.
- **Télécharger** : le double clic et le bouton du pied donnent le fichier sous son nom, octet pour octet.
- **Renommer, épingler, déplacer** : le « .pdf » manquant est remis ; un nom pris est refusé dans la fenêtre ; épingler crée `GFS_Rangement` (accord demandé) et une ligne `App = gfs-fichiers`,
  `Fichier = <Identifiant>`, à la personne ; un PDF importé dans un dossier ouvert y est rangé. **`Auteur` reste vide tant que GFS ne connaît pas l'adresse de la personne** (elle vient de la sonde de
  `GFS_Rangement`, contrats 6.4, point 9) : le premier PDF d'un document neuf n'a pas d'auteur, ceux d'après oui.
- **Supprimer** : la confirmation donne le clavier à « Annuler » ; Échap ne supprime rien ; « Supprimer » retire la ligne.
- **Ce qui ne va pas** : un fichier qui n'est pas un PDF (le contenu d'un classeur sous un nom en `.pdf`), un fichier vide, un autre format sont dits avant tout envoi, sans ligne ni pièce jointe. Un refus du
  serveur (413, simulé par le labo) est dit en mots (« trop gros pour lui »), un serveur muet aussi, sans ligne ni pièce jointe de plus.
- **Contrastes et tenue** : tous les textes des fenêtres de ce lot atteignent 4,5:1 en clair et en sombre ; chaque fenêtre tient dans 700 × 400 sans rien qui déborde.
- **La console** : aucune erreur ni avertissement de GFS dans une session normale (les échecs joués exprès en écrivent un seul, « le fichier n'a pas pu être traité »). Deux messages, qui ne sont pas des défauts
  de ce lot et que le labo connaît : le script d'API de Grist pose sa feuille de thème en ligne (`<style id="grist-theme">`), que la politique de GFS (`style-src 'self'`) refuse, et le premier cadre, ouvert sans
  accès, ne peut pas lire le nom du document.
- **Pas mesuré** : l'instance du porteur (DINUM : passerelle, taille maximale d'une pièce jointe), Firefox (le cadre en bac à sable, le téléchargement par lien) : le labo n'a que Chromium.

## 17. Le thème de la page : ce que le script d'API de Grist y pose (lu le 03/11)

GFS pose l'ambiance choisie (js/theme/theme-apply.js) sur `<html>` et lit le mode (clair, sombre) que Grist y a posé. Ce que le script d'API de Grist y écrit, lu dans `grist-plugin-api.js`
(grist-static 0.1.6 ; `attachCssThemeVars`, ligne 27021 de ce fichier), à chaque message `theme` de Grist :

- une feuille `<style id="grist-theme">` (`@layer grist-theme { :root { --grist-theme-… } }`, plus quatre variables `--scroll-bar-*`), que la politique `style-src 'self'` de GFS refuse (rien ne s'applique) ;
- `document.documentElement.style.setProperty('color-scheme', appearance)` : un style **en ligne** sur `<html>` (c'est pourquoi une page que GFS n'a pas touchée porte déjà une propriété en ligne, `color-scheme`) ;
- les attributs `data-grist-theme` (le nom du thème) et `data-grist-appearance` (`light` ou `dark`).

Aucun nom ne ressemble à ceux de GFS : les jetons de la charte (`--bg`, `--accent`…) et de forme (`--radius-md`…) ne sont jamais écrits par Grist, et GFS ne touche ni à `color-scheme` ni aux attributs `data-grist-*`. Le mode que GFS suit est le
`color-scheme` calculé de `<html>`, que `css/gfs.css` tire de `data-grist-appearance` ou, à défaut, du système (`prefers-color-scheme`). Mesuré dans un vrai Grist (`labo/run-theme.mjs`) : les deux modes se suivent.

**Le sélecteur de couleur de « La mienne » (mesuré le 03/11, `labo/run-theme.mjs`, Chromium).** Le menu de couleur du kit (`createColorPalette`, 50 pastilles) mesure 419 × 171 à 700 × 400 et 289 × 171 à 420 de large ;
sous le bouton « Choisir ma couleur », il ne resterait pas 171 px dans un panneau de 400 : le menu se pose au-dessus (la même règle que les autres menus de GFS, `place` de `js/ui/menu.js`), dans le panneau, sans défilement.
La fenêtre « Couleur personnalisée » (`ColorEditor`) mesure 480 × 290 à 700 × 400 et 408 × 282 à 420, sans défilement. Les fenêtres de GFS (`js/ui/modal.js`) se posent maintenant l'une sur l'autre : la dernière ouverte est seule à
tenir le clavier (Échap ne ferme que celle du dessus), le menu de couleur garde Échap et Tab quand le clavier est dedans (`data-popover`), et Tab depuis sa dernière étape, ou Maj+Tab depuis la première, le referme en rendant la
touche au bouton : le navigateur la fait alors avancer d'un arrêt depuis le bouton. Le kit n'est chargé qu'à la première ouverture de la fenêtre « Thème » (`import()` de `kit/js/color-palette.js`, `color-dialog.js` et `i18n.js`) :
s'il ne se charge pas, « La mienne » est grisée avec sa raison et le reste marche ; mesuré, le navigateur garde l'échec d'un `import()` jusqu'au rechargement de la page (GFS ne réessaie donc pas et ne le dit qu'une fois : la fenêtre dit de recharger). **Pas mesuré** : Firefox (le labo n'a que Chromium), et le service de GitHub Pages pour `prototype/kit/` (sous-module, comme `prototype/apps/`).

**Une app qui pose l'ambiance avec le kit (mesuré le 03/11, `labo/run-ambiance-kit.mjs`, Chromium, sonde N).** La sonde est une app écrite avec le kit 0.6.0 (`8afa569`, `Ambiance.start()`) sous la politique d'une
app hébergée (`default-src 'none'; script-src 'self'; style-src 'self'`), dans le cadre isolé de GFS (`sandbox="allow-scripts"`, origine opaque) ; 18 vérifications dans chacune des quatre combinaisons à 700 × 400.
- Le CSSOM passe sous `style-src 'self'` : l'app n'a vu aucun refus (`securitypolicyviolation`), à la pose, au changement de mode et au retrait ; la console ne porte que des messages du script d'API de Grist
  (`grist-plugin-api.js` : sa feuille `grist-theme` en ligne, refusée, déjà connue) et de grist-static (`dist/main.bundle.js`), jamais un de l'app ni du kit.
- Un cadre isolé n'a pas le script d'API de Grist : le mode que le kit suit y est la préférence du système (`matchMedia`), que `page.emulateMedia` fait basculer dans le sous-cadre comme dans la page. Le mode par
  `data-grist-appearance` est couvert par les essais du kit (Node), pas par le labo.
- Pop pose 48 propriétés en ligne sur `<html>` de l'app (les dix-neuf jetons de couleur du mode, 28 de forme, plus la propriété que l'app s'est donnée) ; Néon 46 ; le retrait les enlève toutes sauf celle de l'app.
  Avant `ready`, l'ambiance connue au contexte est déjà posée : l'app s'affiche sans repeindre.
- **Piège du fond** : `--main-bg` n'est pas le fond d'une page d'app, c'est celui de la carte de GFS, et il vaut `transparent` chez Néon : un `body { background: var(--main-bg, var(--bg)) }` laissait le titre clair
  d'un Néon sombre à 1,10:1 sur le blanc du cadre. Le fond d'une app est `--bg`. **Piège du décor** : `--wash` est fait de dégradés dimensionnés sur la boîte de l'élément ; sur un `body` plus court que la page, il se répète
  à chaque hauteur de contenu (des coutures visibles) : `min-height: 100vh` sur l'élément qui le porte.
- Un même cadre qui aurait deux liens avec GFS (le sien et celui du kit) : `nextId` part de 1 dans chacun (`js/gfs-link.js`, `link.nextId++`) et une réponse se retrouve par son seul `id` (`link.pending.get(message.id)`) ;
  deux liens se prendraient donc les réponses. **Lu dans le code du kit, non mesuré.**

## 18. Les réglages de la vue : ce que le widget ne sait pas, et l'écriture directe (lu et mesuré le 03/11)

Le choix du porteur du 03/11 (« GFS l'écrit dans la vue ») : le courtier écrit lui-même les réglages des apps dans la section de GFS, au lieu du brouillon de Grist (contrats 7.3, points 4 à 6).

**Ce que le widget ne sait pas (lu).**

- Grist 1.7.19 (`WidgetFrame.ts`, lignes 248 à 252 ; tag v1.7.19 de grist-core, lu sur raw.githubusercontent.com) n'ajoute à l'adresse d'un widget que `access`, `readonly` et les paramètres de langue.
  `onOptions` ne porte que `options` et `settings: { accessLevel, linking }`. **Ni numéro de page, ni numéro de section, ni identifiant de document.**
- Aucun `Referrer-Policy` n'est posé (`FlexServer.ts`, `sendAppPage.ts`, `static/app.html`, `WidgetFrame.ts`) : la politique par défaut des navigateurs (`strict-origin-when-cross-origin`) ne laisse
  au cadre d'une autre origine que l'origine de Grist. Mesuré au labo (deux ports, donc deux origines) : le `document.referrer` de GFS est `http://127.0.0.1:8910/`, `contexte.page` vaut `null`.
  `pageOf(referrer)` ne trouve `/p/N` que pour un widget de la même origine que Grist ; Form+ (`myPageFromReferrer`) est dans le même cas. **Non mesuré** sur grist.numerique.gouv.fr ni sous Firefox
  (un proxy peut seulement en dire moins).

**Pourquoi « Enregistrer » apparaissait (lu).** `WidgetAPIImpl.setOption` écrit `section.activeCustomOptions`, un brouillon (`ViewSectionRec.ts`, ligne 444) ; la barre « Enregistrer / Retour »
(`ViewSectionMenu.ts`, `displaySaveObs`) reste tant qu'il n'est pas enregistré, et un widget ne peut pas le vider. `getOptions()` rend le brouillon avant les réglages enregistrés : écrire dans la vue
pendant qu'un brouillon est posé n'en change pas ce que le widget lit.

**Écrire la section (mesuré, labo grist-static 0.1.6, Chromium).**

- `UpdateRecord` de `_grist_Views_section.options` (un texte JSON dont `customView` est lui-même un texte JSON : `url`, `access`, `widgetOptions`…) : **aucune barre**, le cadre n'est pas reconstruit,
  et Grist redit les réglages au widget (`getOptions`, `onOptions`). Un « vide » doit être remis tel qu'il était : `widgetOptions: null` n'est pas `{}` (les `options` ne reviennent pas identiques sinon).
- **Retrouver sa section** : deux sections de GFS de même adresse et de même table, chacune avec sa propre Publipostage+ (la seconde reliée par « Sélectionner par », seul canal indépendant de la vérité) :
  chaque cadre retrouve la sienne par une marque (nombre aléatoire par candidate, une seule `applyUserActions`, relue par son propre `getOptions`), même quand les trois essais tournent en parallèle ;
  un nombre inconnu fait recommencer après une attente aléatoire, jamais prendre la section d'un autre. Une seule candidate : aucune marque, aucune écriture de plus.

**Publipostage+ à la vraie souris** (`labo/run-reglages-directs.mjs`, vrai Grist, panneau 700 × 400, 33 vérifications par combinaison, aucune en échec, en français / clair et en anglais / sombre ;
Publipostage+ `134d043`, servie par la copie de GFS) :

- **Le geste** « Utiliser le modèle ouvert pour cette vue » : aucune barre ; `widgetOptions.modeleDeLaVue` est dans la section de GFS, et rien d'autre n'a bougé (accès, adresse, autres options de la section) ;
  l'app relit son réglage par l'écho de Grist ; elle reçoit un seul événement `reglages` `{ enregistres: true }` ; ni le cadre de GFS ni celui de l'app ne sont reconstruits ; GFS ne dit rien en console.
- **« Retirer »** : la clé passe à `null`, toujours sans barre, un second événement arrive ; choisir de nouveau la remet.
- **GFS rechargé** : la vue s'ouvre d'elle-même sur Publipostage+ et sur le modèle retenu, sans rien demander (7.4, point 7).
- **Deux GFS sur la même table** : chacune écrit dans SA vue, l'autre ne bouge pas. Quand les deux vues disent la même chose, la recherche pose ses marques, les retire et écrit (5 écritures de la section) ;
  quand elles ne se ressemblent plus, une seule écriture. Aucune marque ne reste, aucun cadre n'est reconstruit, aucune barre.
- **Un brouillon déjà posé** (une clé `gfs.essai` écrite par `grist.setOption` : la barre apparaît) : GFS n'écrit rien dans la vue, ni réglage ni marque ; le réglage de l'app rejoint le brouillon,
  l'app reçoit `enregistres: false`, la barre reste, « Retour » la libère et la vue est comme avant ; GFS le dit une fois en console.
- **Le texte de Publipostage+ n'a pas suivi** : son rappel (« Pour partager vos changements, cliquez sur « Enregistrer » en haut du widget, dans Grist. », `js/save-reminder.js`) et deux phrases des
  Réglages (`settings.view.intro`, `settings.access.saveHint`) disent encore d'enregistrer dans Grist : faux sous GFS quand l'événement `reglages` dit `enregistres: true` (consigne à Publipostage+).

**Pas mesuré.** Un vrai serveur Grist et une règle d'accès qui refuse l'écriture (grist-static n'en a pas : le repli est couvert par les tests contre un faux port, pas contre Grist), Firefox (le labo n'a que
Chromium), Safari, ce que « Annuler » (Ctrl+Z) de Grist fait d'une écriture de la vue, et l'instance du porteur.

## 19. Lire un PDF que GFS garde : pdf.js dans un cadre isolé, joué dans un vrai serveur (03/11)

Le lot 2 de l'étude PDF (lire un PDF dans une app, contrats 2.6 point 12, 2.7 point 5, 5.4 point 8). Deux mesures : le fichier de pdf.js que l'outil de GFS assemble contre le paquet d'origine
(Chromium, une page quelconque), puis le geste entier, `labo/run-lire.mjs`, dans un **vrai serveur Grist 1.7.19** : GFS ajouté comme widget à un document neuf, panneau à 700 × 400, souris et clavier réels,
en français clair puis en anglais sombre, avec la sonde Y (`labo/sondes/y-lire-pdf/`) qui fait ce que fera Publipostage+. Chromium seulement.

- **Le fichier assemblé est le pdf.js d'origine** : même version (6.5.438), mêmes exports (`getDocument`, `TextLayer`, `GlobalWorkerOptions`, `PasswordResponses`, `version`), même PDF de trois pages, même texte
  (page 2 : « Facture numero 2 », la ligne accentuée, « Page 2 sur 3 »), même encre (19 324 pixels non blancs). **Une différence voulue** : avec le paquet d'origine, pdf.js crée un vrai `Worker` ; avec le
  fichier assemblé, il n'en crée aucun, car le moteur est déjà dans `globalThis.pdfjsWorker` (le fichier le pose en se chargeant) et pdf.js l'exécute dans la page. Sans `verbosity: 0`, pdf.js écrit alors
  « Warning: Setting up fake worker. » en console, à chaque document.
- **Un cadre à origine opaque ne peut pas créer de Worker** (mesuré le 03/11 au matin, étude : `SecurityError`) : le faux Worker n'est donc pas un repli de confort mais le seul chemin dans un cadre d'app. Il
  tourne dans la page de l'app : une page lourde fige l'interface (étude : jusqu'à 155 ms pour la plus longue tâche, pages de 30 à 180 ms) ; la sonde, avec trois petites pages, n'a rien vu de tel.
- **Un `File` envoyé par GFS se lit dans le cadre isolé** (`sandbox="allow-scripts"`, sans `allow-same-origin`), comme celui d'« Importer » (5.4, point 1) : `instanceof File`, le nom, la taille, le type
  `application/pdf`, `arrayBuffer()` rend tous les octets, et leur empreinte SHA-256 est celle du PDF que la personne a choisi (1 633 octets, commencent par `%PDF-1.4`). Une ouverture « lire » porte
  `lecture: { id, fichier }`, `raison: lire`, `fichier: null` ; l'`id` est l'`Identifiant` de la ligne de `GFS_Fichiers`.
- **La bibliothèque arrive par la source que GFS donne** : `contexte.bibliotheques.pdfjs` = `{ src: …/prototype/vendor/pdfjs/1.0.0/pdfjs.js, integrite: sha384-c85h+cJ0…, forme: "module" }` ; l'app la charge par
  un `<script type="module" src integrity crossorigin="anonymous">` sous `script-src 'self'` (la politique de Publipostage+ recopiée) : aucune violation de politique, aucune erreur ; `GfsPaquets.pdfjs`
  est posé, avec les deux modules. **Elle est copie seulement** (`sansCdn`) : la fenêtre « Apps et extensions » grise l'option CDN avec « GFS n'a pas encore d'adresse publique pour servir cette bibliothèque »
  et coche la copie de GFS (1,6 Mo « au premier usage »).
- **Ce que l'app fait du document** : trois pages, le texte de la page (accents compris), la page dessinée sur un canevas (de l'encre, du texte noir), la couche de texte (`TextLayer`) qui porte le même texte
  et où un double-clic à la vraie souris sélectionne un mot ; la page suivante se tourne à la souris (bouton) et au clavier (flèche droite, flèche gauche pour revenir). **Fermer le document précédent se fait par la
  tâche de chargement** (`getDocument(…).destroy()`) : le `PDFDocumentProxy` de la 6.5.438 n'a plus de `destroy()` (« doc.destroy is not a function », vu par la sonde à sa première passe).
- **Avant l'app, « Lire » est grisé, jamais masqué** : le bouton du pied et le premier article du menu de la ligne ; la barre dit « Demande l'app Sonde Y (Grist Factory Suite) » ; un clic ouvre « Apps et extensions »
  sur la ligne de l'app, puis (l'app cochée, qui demande l'accord de la table du rangement) sur celle de l'extension « Lecture de PDF » ; aucune app n'est ouverte pour rien. L'app et l'extension prêtes, « Lire »
  se dégrise et la barre dit « S'ouvre dans Sonde Y ».
- **L'app déjà ouverte reçoit l'appel `ouvrir`** (raison `lire`, `lecture` présent) dans le même cadre, non rechargé : le premier PDF est encore dans l'historique de la sonde, le second est lu (une page, son
  titre, de l'encre, la bibliothèque déjà là, rien de rechargé). Entrée sur la ligne choisie et le double-clic lisent (ils ne téléchargent pas) ; « Télécharger » du menu rend le PDF octet pour octet.
- **Lire n'écrit rien** : mêmes lignes de `GFS_Fichiers`, mêmes pièces jointes, mêmes tables avant et après. Le transfert coupé (la route de téléchargement abandonnée par le labo) est dit en mots : « « Facture.pdf » n'a
  pas pu être ouvert : le serveur Grist n'a pas répondu… », l'explorateur reste ouvert, la sonde ne reçoit rien.
- **Une app qui ne reçoit pas encore le fichier** (`ACCEPTS_OPEN.<app>.lire` à `false`, l'état de toute app avant sa consigne) : « Lire » reste grisé, la barre et le clic disent « <app> ne lit pas encore les PDF de GFS :
  télécharge-le pour l'ouvrir », sans fenêtre ni app ouverte ; « Télécharger » du menu marche.
- **Un cadre d'app reste caché tant que l'app ne dit pas qu'elle est prête** : la sonde n'était pas visible (`visibility: hidden` sur son `<iframe>`, donc aucun clic ne l'atteignait) avant d'envoyer `ready` puis
  `themeInitialized`, comme le fait le script d'API de Grist. Une vraie app le fait déjà ; une sonde de labo doit l'écrire.
- **Contrastes et tenue** : le pied et la barre d'information avec « Lire » prêt atteignent 4,5:1 (clair et sombre) et tiennent dans 700 × 400 ; la page dessinée tient dans le panneau sans défilement.
- **La console** : aucune erreur ni avertissement de GFS, de la sonde ou de pdf.js (avec `verbosity: 0`), aucune violation de politique ; les échecs joués exprès n'ajoutent que la phrase « le fichier n'a pas pu être traité ».
- **Pas mesuré** : Firefox (le cadre en bac à sable, la lecture par un module à empreinte), l'instance de la DINUM, un PDF protégé par un mot de passe (pdf.js le demande par `onPassword`, l'app doit
  le gérer : Publipostage+ le fait déjà pour ses exports), un PDF de centaines de pages, un PDF qui exige les polices standard, les CMap ou le décodeur JPEG 2000 (non fournis, contrats 2.6, point 12), un
  PDF sans texte (un scan : pas de couche de texte), la vraie Publipostage+ (mesurée le 04/11 : section 22).

## 20. ECharts 6.1.0 : l'archive de npm est le fichier que le CDN sert, et « Créer un graphique… » dessine dans un vrai Grist (lu et mesuré le 03/11)

La demande de Publipostage+ (graphiques créés dans l'app, « Créer un graphique… ») donne l'empreinte du fichier que jsDelivr sert pour `echarts@6.1.0`. jsDelivr n'est pas joignable du cloud ; le registre de npm l'est,
et c'est de là que l'outil des bibliothèques tire la copie (`npm pack`, avec l'intégrité que donne le registre). Lu et mesuré le 03/11 :

- **`dist/echarts.min.js` de l'archive** pèse 1 121 883 octets et porte l'empreinte `sha384-C2iskrW/uPW46KzOjrvJIQo4YkV8lkD+QS0CrDN18IIPIpT/g2USu8bTP3nvmIAD`, **exactement celles que Publipostage+ a relevées sur le CDN** : une seule empreinte vaut
  pour le CDN et pour la copie de GFS, comme pour Plotly. Le registre dit `6.1.0`, licence `Apache-2.0`.
- **Le fichier garde l'en-tête de la fondation Apache** (« Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements »). L'archive livre à sa racine un `LICENSE` (Apache 2.0, 11 990 octets)
  et un `NOTICE` (168 octets : « Apache ECharts / Copyright 2017-2026 The Apache Software Foundation »). L'article 4 d de la licence veut que la copie redistribuée porte le texte du `NOTICE` : l'outil le recopie, après la licence, dans
  `vendor/echarts/6.1.0/LICENCES.txt` (contrats 2.6, point 13).
- **La copie de GFS** est à `vendor/echarts/6.1.0/dist/echarts.min.js` (la disposition de l'outil : le chemin du fichier dans le paquet est gardé).

**Le symptôme, et sa cause (03/11).** Le porteur a vu le volet graphique de Slides+ « manquer d'une librairie ». L'app (`extensions/graphique/chart-make.js`) demande `echarts` à GFS (`Extensions.library('echarts')`) ; le manifeste de GFS ne
l'exigeait pas et le catalogue ne l'avait pas, GFS ne donnait donc rien, et la fenêtre « Créer un graphique… » disait « Aperçu indisponible : le module qui dessine les graphiques n'a pas pu se charger ». « Insérer » restait allumé (une
bibliothèque qui n'a pas pu se charger n'empêche rien) : la personne posait un cadre qui ne se dessinait jamais. Rejoué au labo avec le manifeste d'avant (`LAB_SANS_ECHARTS=1`) : 12 des 20 vérifications de `run-graphique.mjs` échouent (GFS
ne donne pas `echarts`, aucune demande du fichier ne part, aperçu indisponible, radar, entonnoir et jauge non dessinés, cadre non dessiné), 8 passent (Plotly est donné comme avant, la fenêtre s'ouvre, la politique de l'app ne refuse rien,
le modèle ne garde que la définition).

**Mesuré dans un vrai Grist** (grist-static 0.1.6, Chromium, 700 × 400, vraie souris et vrai clavier, la vraie Publipostage+ à `067c931` : `labo/run-graphique.mjs`, 20 vérifications, **vertes** en français clair avec le CDN, en français clair
avec la « Copie de GFS », en anglais sombre avec le CDN et en anglais sombre avec la copie) :

- La ligne « Graphique » de la fenêtre « Apps et extensions » nomme ses deux bibliothèques (Plotly ≈ 998 Ko, ECharts ≈ 1,1 Mo au premier usage) et dit son propre poids du manifeste (≈ 168 Ko). Le mode choisi est le seul coché.
- GFS donne à l'app `echarts` et `plotly` avec l'adresse, l'empreinte et la forme du catalogue : l'adresse jsDelivr en mode CDN, `vendor/echarts/6.1.0/dist/echarts.min.js` de GFS en mode copie. Rien n'est demandé du fichier tant que la
  personne ne dessine pas ; puis **une seule demande** part, à l'adresse donnée, jamais redemandée (radar, entonnoir et jauge réutilisent la bibliothèque chargée).
- La balise `<script>` de l'app porte l'empreinte du catalogue et `crossorigin="anonymous"` ; le navigateur la **contrôle pour de bon** (le labo rend à l'adresse jsDelivr les octets exacts de la copie de GFS, voir `LISEZ-MOI.md` du
  labo) ; la politique de sécurité de l'app laisse passer l'adresse (CDN) comme la copie (`'self'`) : aucune violation.
- L'aperçu est une **image PNG de 1 440 × 900 réellement peinte** (24 % de pixels non blancs pour des barres, 4,6 % pour un radar, 43 % pour un entonnoir, 6,8 % pour une jauge) ; « Insérer » pose le graphique dessiné dans le cadre
  de l'éditeur, et le modèle ne garde que sa définition (`data-chart-spec`), jamais l'image.
- Rejoués sur la même référence, sans échec : `run-ouvrir-publipostage` (28), `run-diapositives` (60, en français clair et en anglais sombre), `run-edition` (60), `run-modules` (46) et `run-sans-cdn` (15).

**Pas mesuré.** Le vrai jsDelivr (`node outils/bibliotheques.mjs --verifier-cdn`, sur une machine qui y accède : le labo y met une copie aux mêmes octets), Firefox (le cloud n'a que Chromium), le Grist en ligne du porteur (celui de la
DINUM) et le dessin d'un graphique sur un très gros tableau. La fenêtre écrit « Echarts » (l'identifiant du catalogue avec une capitale) et non « ECharts » : un détail d'affichage de GFS, pas de l'app.

## 21. Ranger un export d'une app dans GFS : ce que le vrai serveur a mesuré (03/11)

Le lot 3 de l'étude PDF (contrats 2.7 point 6, 5.4 point 9, 6.6). Une app fabrique un PDF **dans son cadre isolé** et demande à GFS de le ranger. Joué par `labo/run-ranger-pdf.mjs` dans un **vrai serveur Grist 1.7.19**
(Docker) : GFS ajouté comme widget à un document neuf, panneau à 700 × 400, souris et clavier réels, en français clair puis en anglais sombre, avec la sonde Z (`labo/sondes/z-ranger-pdf/`), qui fait ce que fera
Publipostage+ ; puis la même mesure avec le **vrai client du kit 0.7.0** (`LAB_KIT=1`, `GfsLink.deposit`, la sonde Z kit). Ce que GFS écrit (tables, lignes, pièces jointes, rangement) est relu par l'API REST. Chromium seulement.

- **Un `File` fabriqué dans le cadre isolé** (`sandbox="allow-scripts"`, origine opaque) **traverse le message de l'app à GFS avec ses octets** : la pièce jointe que Grist garde a la même empreinte SHA-256 que le PDF fabriqué,
  et le type `application/pdf`. Le message ne porte que `{ fichier, nom, … }` : l'app ne reçoit ni ne donne de jeton, et son niveau d'accès (`none` pour la sonde) n'y change rien.
- **La ligne écrite** : l'`Identifiant` rendu à l'app (12 caractères hexadécimaux), le nom, `pdf`, la taille en octets, la date du jour, **`Origine` = l'`id` de l'app**, pris à la session et non au message. Un fichier remplacé garde
  son `Identifiant`, sa ligne, son dossier et son `Origine` ; la date change. L'explorateur montre le PDF rangé dès le dépôt fini.
- **GFS ne dit rien par-dessus l'app** : après un dépôt réussi, ni phrase ni notice (le bandeau de GFS reste caché), l'app est toujours là ; c'est la réponse `{ statut, id, nom }` qui parle.
- **La table `GFS_Fichiers` absente** : GFS demande l'accord avant tout envoi, et sa fenêtre dit que les apps y rangent aussi. Refusée, **ni table ni pièce jointe** ne naissent et l'app reçoit `GFS_ANNULE` avec la phrase de
  GFS ; un lot de trois fichiers est refusé d'un bloc, **sans seconde question**. **La table du rangement (`GFS_Rangement`) existe dès qu'une app est installée** (elle porte la ligne réservée du registre des apps) : la
  question de sa création n'est donc jamais posée à un dépôt (essais sous Node seulement pour son refus).
- **Le dossier** : ` Factures // 2026/ ` devient « Factures/2026 » ; un fichier nouveau y entre, sans favori ; l'explorateur montre le dossier et garde le fichier dedans.
- **Un nom pris** : la fenêtre commune nomme l'app (« Sonde Z range un fichier dans GFS, mais GFS garde déjà un fichier « Facture.pdf ». Que faire du nouveau ? »), décrit le fichier gardé (date, auteur), offre trois
  issues (Garder les deux avec le nom de la copie, Remplacer, Annuler : « le nouveau n'est pas rangé dans GFS »), tient dans 700 × 400 sans défiler et ses textes atteignent 4,5:1 ; le clavier est sur « Garder les deux » ;
  rien n'est écrit tant que la personne n'a pas répondu. Remplacer : `remplace`, même ligne, même `Identifiant`, aucune ligne de plus, le contenu du nouveau. Garder les deux : `copie`, « Facture (1).pdf », l'ancien
  garde son contenu. Annuler, Échap et un appui à côté de la fenêtre : `ignore`, `id` et `nom` nuls, rien d'envoyé ni d'écrit.
- **Un lot** : la case « Faire pareil pour les suivants » n'est offerte que dans un lot dont il reste des fichiers ; au vrai clavier (Tab, Espace, Tab, Tab, Entrée) une seule fenêtre règle les trois noms pris d'un lot de cinq
  fichiers ; « Annuler » avec la case passe les noms pris et range les autres ; un nouveau lot ne reprend pas la réponse de l'ancien ; sans la case cochée la fenêtre revient ; le dernier fichier n'a pas de case.
- **Des dépôts lancés ensemble passent l'un après l'autre** : une seule fenêtre à la fois (deux fichiers de même nom : `[ajoute, copie « Rapport (1).pdf »]` dans l'ordre des demandes).
- **Les refus** : un contenu qui n'est pas un PDF, un fichier vide, un type que l'app n'a pas déclaré, un texte à la place du fichier, aucun fichier, un nom vide (« .pdf »), un lot vide : `GFS_REFUSE` avec la raison en mots,
  rien d'écrit, aucune fenêtre. **Les échecs** : le serveur qui refuse le fichier (413) et le réseau coupé rendent `GFS_ECHEC` avec la raison en mots (« trop gros pour lui », « le serveur n'a pas répondu ») ; aucune ligne ni pièce
  jointe de plus ; le dépôt suivant réussit (la file n'est pas bloquée).
- **La console** : aucune erreur ni avertissement de GFS ou de la sonde, aucune violation de politique ; les échecs joués exprès n'ajoutent que la phrase « le fichier n'a pas pu être traité ». 62 vérifications dans chacune
  des deux passes, et 62 dans chacune avec le client du kit : mêmes réponses, mêmes codes. Les labos « importer un PDF » (64 vérifications) et « lire un PDF » (43) passent toujours après les changements de la fenêtre du nom pris.
- **Le kit** (0.7.0, `grist-factory-kit`) : `GfsLink.deposit` rend `{ statut, id, nom }` ou rejette avec le code de GFS ; il n'a pas de délai ; chaque appel est un fichier de plus. **`structuredClone` d'un `File` hors d'un
  navigateur perd son nom** (sous Node, il rend un `Blob`) : l'ouverture du kit rend le même `File` à chaque lecture. Dans Chromium, un cadre isolé reçoit bien un vrai `File` (nom, taille, type, octets) par `importation` et
  `lecture`, que le kit jusqu'à la version 0.6.0 laissait tomber.
- **Pas mesuré** : Firefox, l'instance de la DINUM (la taille maximale d'une pièce jointe et la passerelle), un PDF de plus de 12 Mo, une personne qui refuse de créer `GFS_Rangement`. **La vraie Publipostage+ (consigne 043) est mesurée depuis le 04/11 : section 33.**

## 22. Lire un PDF avec la vraie Publipostage+ : ce que le vrai serveur a mesuré (04/11)

Suite de la section 19 (la sonde Y) : la **vraie** Publipostage+ (`3064a29`, sa consigne 040 faite par `2082d41`), servie par GFS, lit le PDF que GFS garde (contrats 2.7 point 5, 5.4 point 8). Joué par
`labo/run-lire-publipostage.mjs` dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) : GFS ajouté comme widget à un document neuf, panneau à 700 × 400, souris et clavier réels, en français et en
anglais, en clair et en sombre (33 vérifications dans chacune des quatre passes), plus la passe « navigateur ancien » (13 vérifications, en français clair et en anglais sombre). Chromium 141 seulement. Les bibliothèques
natives de l'app viennent de copies aux mêmes adresses que leurs CDN (`labo/mirror`) ; pdf.js est la copie de GFS.

- **Le geste** : avant l'extension, « Lire » est grisé (« Demande l'extension Lecture de PDF »), jamais masqué ; un clic ouvre « Apps et extensions » sur la ligne de l'extension, sans ouvrir aucune app ; pdf.js ne
  s'offre que par la copie de GFS (le CDN est grisé avec sa raison) ; l'extension cochée, « Lire » se dégrise et la barre dit où le PDF s'ouvre.
- **La question des tables est celle de l'app** : sur un document neuf, la première lecture fait démarrer l'app, qui pose sa propre question (« Créer les tables du widget dans ce document ? ») ; GFS n'en pose aucune ; quatre
  tables naissent (`Publipostage_LiensTables`, `Publipostage_Modeles`, `Publipostage_PreferencesModeles`, `Publipostage_UserProbe`) ; les lignes et les pièces jointes de `GFS_Fichiers` ne changent pas.
- **Ce que l'app fait du PDF** : elle reçoit `lecture.id` (l'`Identifiant` que GFS a donné, 12 caractères), le nom et les 3 pages ; son coin d'état dit « PDF « Facture.pdf » : 3 pages. » (« PDF “Facture.pdf”: 3 pages. » en
  anglais) ; la première page est dessinée sur un canevas (de l'encre, du texte noir), sa couche de texte porte la ligne accentuée ; pdf.js est celui de la copie de GFS : source `…/prototype/vendor/pdfjs/1.0.0/pdfjs.js`,
  empreinte `sha384-c85h+cJ0…`, forme `module`, version 6.5.438, aucune violation de politique.
- **Dans l'app** : la molette fait défiler et la page 3 se dessine en approchant (les pages se dessinent à la demande) ; au clavier, « Début » remonte et « Page suivante » fait défiler ; un double-clic dans le texte sélectionne un mot.
- **L'appel `ouvrir`** : l'app déjà ouverte lit le second PDF dans le même cadre, non rechargé (un marqueur posé dans sa page y est encore) ; son coin d'état dit « PDF « Devis.pdf » : 1 page. » ; l'explorateur s'est refermé.
- **Les autres gestes** : « Télécharger » du menu rend le PDF octet pour octet (1 633 octets) ; Entrée et le double-clic lisent ; lire n'écrit rien dans les PDF de GFS.
- **La console** : aucune erreur ni avertissement (GFS, Publipostage+, pdf.js) ni violation de politique, hors deux messages connus du labo (`KNOWN_MESSAGES`, `labo/lab-pdf.mjs`).
- **Le Chromium du cloud est trop vieux pour pdf.js 6** : pdf.js 6.5.438 appelle `getOrInsertComputed` de `Map` et de `WeakMap` (et `getOrInsert`, pour les destinations nommées) ; Chromium 141 ne les a pas (Chrome et Edge 145,
  Firefox 144, Safari 26.2 d'après caniuse, lu le 04/11 et pas mesuré dans ces navigateurs). Sans elles, pdf.js dit « getOrInsertComputed is not a function » : le labo les pose avant tout script (`addModernMethods`,
  `labo/lab-pdf.mjs`), et `LAB_NAVIGATEUR_ANCIEN=1` les laisse absentes. **Ce que voit la personne d'un navigateur ancien** : la garde de l'app (`modernEnough()`) refuse avant de charger la bibliothèque ; le coin d'état dit
  « Ce navigateur est trop ancien pour lire un PDF : mettez-le à jour. » (« This browser is too old to read a PDF: please update it. ») ; l'app reste sur son modèle (aucune feuille, aucun PDF tenu) ; l'explorateur revient
  et « Lire » reste prêt ; GFS n'a rien de cassé. **Dans le paquet de npm** (lu, pas joué) : la version « legacy » de pdfjs-dist 6.5.438 (`legacy/build/pdf.min.mjs`, 538 Ko, et son moteur de 1,33 Mo) définit ces méthodes
  elle-même (core-js : `getOrInsert` et `getOrInsertComputed`, de `Map` et de `WeakMap`) ; la version moderne (474 Ko et 1,27 Mo) ne fait que les appeler.
- **Les poids** : `lecture-pdf` : trois fichiers, 17 343 octets (`pdf-engine.js` 5 798, `pdf-view.js` 8 451, `pdf-view.css` 3 094), soit 17 Ko dans le manifeste ; `graphique` 183 (`d9b78a4`, 182 559 octets) ; `diapositives`
  471 et `edition` 102 n'ont pas bougé.
- **Un défaut de GFS vu en mesurant** : la notice « Ouverture de « Devis.pdf »… » (`files.reading`, `kept-files.js`, `load`) reste affichée **6 secondes** (34 px de haut, dans le bas du panneau de 700 × 400), par-dessus
  l'app, alors que le PDF est dessiné au bout de 0,6 s dans l'app déjà ouverte : seul son délai (`NOTICE_MS`, `controller.js`) la retire, et seul le bouton « Démo » appelle `#hideNotice`. Mesuré par une passe jetable
  (français clair, une demi-seconde entre deux relevés). **Corrigé le 04/11 (`f64bfe3`)** : `KeptFiles.load` retire la notice dès que les octets sont arrivés (`hideNotice` ; le contrôleur ne retire que cette phrase-là, pas une autre
  qui l'aurait remplacée), et un transfert qui échoue garde sa phrase d'erreur. Mesuré dans un vrai Grist (`run-lire`, deux vérifications de plus : l'app qui démarre, l'app déjà ouverte) : elles échouent sur l'ancien code,
  passent avec la correction, en français clair et en anglais sombre.
- **Rejoués sur `3064a29`, sans échec** : `run-modules` (46 vérifications en français clair, 46 en anglais sombre), `run-ouvrir-publipostage` (28), `run-importer-pp` (33), `run-diapositives` (60), `run-graphique` (20),
  `run-edition` (60), `run-barre-publipostage` (7), `run-langue-publipostage` (25), `run-sans-cdn` (15), et la sonde `run-lire` (43).
- **Pas mesuré** : Firefox (le cadre en bac à sable, le module à empreinte, et `getOrInsertComputed` dans la version de Firefox de la personne), l'instance de la DINUM, un PDF protégé par un mot de passe (l'app le demande dans
  une fenêtre à elle), un PDF de centaines de pages, le vrai CDN des bibliothèques natives de l'app.

## 23. L'ambiance de GFS avec les vraies Form+ et Automation+ : ce que le vrai Grist a mesuré (04/11)

Suite de la section 17 (la sonde N, une app écrite avec le kit) : les **vraies** apps, servies par GFS depuis leur référence, prennent l'ambiance choisie dans GFS (consignes 016 de Form+ et 006 d'Automation+ ; contrats
5.2, point 10 ; guide des apps, règle 15). Joué par `labo/run-ambiance-apps.mjs` (les écrans où passe une personne sont dans `labo/ecrans-apps.mjs`, que partage `run-barre-apps.mjs`) dans un **vrai Grist** (grist-static), panneau à
700 × 400, souris réelle, en français et en anglais, en clair et en sombre : une passe par combinaison, huit passes en tout, Chromium 141 seulement. Form+ à `0de37ac` (son code à `954483a`, `kit/` à `8afa569`),
Automation+ à `bb8a8dd` (son code à `3f7d45a`, 0.12.0, `kit/` à `db14544`) : le code servi de chaque référence (pages, scripts, feuilles, politique de sécurité) est relu en entier et ses essais parcourus : rien qui change le contrat (ni table, ni colonne,
ni clé de réglages, ni bibliothèque, ni permission, ni adresse de la politique de sécurité du contenu).

- **Ce que mesure chaque passe**, dans chaque écran, avec chacune des quatre ambiances (Pop, Papier, Brut, Néon), dans les deux modes : le kit a posé les dix-neuf jetons de couleur du mode que l'app affiche, tels que GFS les
  calcule (`ambiancePalette`), et aucun jeton de forme qui diffère de celui de GFS ; le fond de la page est `--bg` ; **chaque texte garde 4,5:1 au moins** (3:1 pour un grand texte), mesuré sur les couleurs affichées (les fonds
  des ancêtres posés l'un sur l'autre), une fois les transitions de l'app finies. Automation+ : quatre écrans (l'accord de création de la table, le graphe avec un déclencheur et une action posés à la souris, le journal, les
  réglages), 32 mesures par passe ; Form+ : sept écrans (les départs, le concepteur d'un formulaire semé, en haut puis en bas, les réponses, les paramètres, de même), 56 mesures par passe. **Aucune en échec, dans les huit passes.**
- **La couleur libre** (une pastille de la palette du kit) : l'accent de l'app est celui de la personne, éclairci ou assombri au besoin (`#6d28d9` reste tel quel en clair, devient `#9e7dff` en sombre), la forme de Pop reste.
  **« Revenir à Grist Factory »** : l'app retire tout ce que le kit avait posé et retrouve ses couleurs d'origine, dans le même cadre (un seul, non reconstruit). Les jetons que l'app tient pour elle (la zone que la barre
  de GFS lui fait écarter : `--gfs-zone-*` chez Automation+, `--gfs-bar-*` chez Form+) ne sont pas ceux de GFS : ils bougent quand la barre disparaît (l'explorateur ouvert), et l'essai ne compare que les jetons de l'ambiance.
- **Une app ouverte après le choix (Néon)** : Automation+ attend l'ambiance avant de s'afficher (`html[data-gfs-pending]`, levé par `ready`, au plus 2 s) : son premier affichage vient de 153 à 188 ms dans le labo, avec les
  47 propriétés déjà posées : pas de repeinture, dans les quatre passes. **Form+ s'affiche d'abord dans ses couleurs d'origine, puis prend l'ambiance** : premier affichage de 10 à 25 ms, ambiance de 78 à 110 ms, soit **66 à 100 ms
  de couleurs d'origine** avant le changement (Chromium, Grist local ; plus long sur un Grist distant). Le guide dit d'appeler `Ambiance.start()` « avant d'afficher » : Form+ le fait dans son module d'entrée, mais rien ne retient
  l'affichage jusqu'au message de GFS. Ce n'est pas une règle du guide et GFS n'y peut rien : constat, dit à l'app par sa consigne 017.
- **Le déclencheur et l'action d'Automation+** (la 007, point 3, l'a promis) : l'en-tête d'un déclencheur (`--accent-soft`) et celui d'une action (`--accent-solid`) restent distincts dans les huit combinaisons : le plus petit écart
  de couleur en OKLab est **0,145** (Papier, en sombre), le plus faible rapport de luminance **1,23:1** (Brut, en clair : un bleu pâle `#dfeaff` contre un jaune vif `#f9d100` : la teinte les sépare). L'app seule : 0,420 et 3,97:1 en clair
  (`#e8f0fe` et `#2f6fed`), 0,299 et 2,83:1 en sombre (`#24324b` et `#2f6fed`). Seuil de cette mesure : 0,10 (cinq fois ce qui se voit à peine, 0,02) : un choix de GFS pour ce rejeu, pas une règle de la charte.
- **La console** : aucune erreur de page, aucun refus de la politique de sécurité du contenu, aucun avertissement de GFS. Le Grist du labo est en `http` : le `connect-src 'self' https:` de Form+ refuse ses appels à l'adresse publique
  d'un formulaire (ce que ne fait pas un Grist en `https`), et l'essai ne retient pas ces messages-là.
- **Deux pièges de mesure** : le contraste d'un texte mesuré pendant une transition de l'app (Form+ en a sur ses tuiles et ses boutons : `transition: background .12s`) donne de faux échecs (un `.start-tile-desc` à 2,62:1) : l'essai
  attend que `document.getAnimations()` soit vide ; et une capture prise la fenêtre « Thème » ouverte cache une part de l'app derrière elle : elle se prend fenêtre et explorateur refermés.
- **Rejoué le 04/11 avec Automation+ à `6019846`** (son code à `e27e89c`, 0.14.0 ; `kit/` toujours à `db14544`). Quatre commits depuis `bb8a8dd`, relus (49 fichiers) : `7350a5c` (0.13.0 : l'app lit `access` et `readonly` dans l'adresse de son cadre, contrats 1.3, point 3 ;
  `sessionStorage`, clé `ab_executor_<table>`), `e27e89c` (0.14.0 : une prise en main de six écrans, avec des captures `img/tuto/*.webp` du même site) et leurs deux pages. La politique de sécurité ne change que par `img-src 'self' data:` à la place de
  `data:` ; le stockage du navigateur gagne `localStorage` (`ab_tuto`) et `sessionStorage`, dans des `try/catch` ; aucune table, colonne, clé de réglages, bibliothèque, action ni adresse de plus, aucun appel réseau ajouté. `run-automation` : trois vérifications ;
  `run-ambiance-apps` : quatre passes (français et anglais, clair et sombre), 32 mesures chacune, **aucune en échec**, le plus petit écart déclencheur/action toujours 0,145 (1,23:1). La prise en main n'est ouverte dans aucun des quatre écrans mesurés : dans le sous-cadre
  isolé le stockage est refusé (`SecurityError`), et l'app ne l'ouvre alors jamais d'elle-même (son E2E-55).
- **Rejoué le 04/11 avec Automation+ à `597fe02`** (son code à `0c19c80`, 0.15.0 ; `kit/` toujours à `db14544`). Deux commits de code depuis `6019846`, relus : `0695db5` et `0c19c80` (retouches avant la sortie publique) et la page `597fe02`. Ce qui change pour GFS : **la clé de réglages `workflow` n'est plus écrite quand le graphe est gardé dans la table `Automation`** (`js/main.js`, `save` : `grist.setOption('workflow', …)` seulement si `Store.saveGraph` n'a pas pu écrire, c'est-à-dire sans table utilisable ; Grist montrait sinon son bouton « Enregistrer » à chaque changement) ; une vue dont le graphe est dans `Automation` n'a donc plus de clé que `prototype/js/broker/arrival.js` lise, et GFS arrive sur l'explorateur (lu dans le code, pas rejoué avec la 0.15.0 qui construit un graphe) : l'app demande à GFS de repérer sa vue par la ligne `Workflow` de `Automation` dont `Table` est la table de la vue (carte posée au porteur, rien codé avant son choix). Le reste ne touche pas le contrat : un attribut facultatif `w` sur les nœuds (largeur de 200 à 600 px, gardé tel quel par une version plus ancienne), des comparaisons au texte tapé dans le moteur (`js/engine.js`), le canevas ; dans `index.html` seuls les `?v=0.15.0` et une phrase changent (même politique de sécurité, mêmes seize scripts), et la recherche de `localStorage`, `sessionStorage`, `fetch`, `postMessage`, `innerHTML`, `eval`, `import(`, `window.parent` et d'adresses dans le diff de `js/` et `css/` ne trouve aucun ajout. `run-automation` : trois vérifications ; `run-ambiance-apps` : quatre passes (français et anglais, clair et sombre), 32 mesures chacune, **aucune en échec**, console vide, le plus petit écart déclencheur/action toujours 0,145 (1,23:1).
- **Rejoué le 04/11 avec Form+ à `17cfce9`** (sa page ; son code à `6c79698`, `kit/` toujours à `8afa569`). Onze commits depuis `0de37ac`, dont neuf de code, relus (onze fichiers) : la 017 (`6c79b62`), l'adresse à diffuser d'un formulaire publié (`7e6db89` : la page
  statique de Form+ avec `#form=`, au lieu de la page Grist `/s/<clé>/p/<n>` ; sa page ne le décrit pas encore, le fil des permissions le relit), des retouches de l'éditeur et du répondant, et la 018 (`6c79698`). La politique de sécurité de `poc/widget.html` passe
  de `script-src 'self' https://unpkg.com https://docs.getgrist.com` à `script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js https://unpkg.com` ; aucune table, colonne, clé de réglages, bibliothèque, permission, action, clé de stockage ni appel
  réseau de plus (recherche de `grist.setOption`, `applyUserActions`, `localStorage`, `sessionStorage`, `fetch`, `postMessage`, `eval`, `import(`, `window.parent` et d'adresses dans le diff de `poc/js`). `run-ambiance-apps` : quatre passes (français et anglais, clair et sombre),
  56 mesures chacune, **aucune en échec**, console vide. **Constat, sa 017 ne tient pas** : l'app cache sa page jusqu'à l'ambiance (`html[data-gfs-pending] body { visibility: hidden }`), mais c'est le module `main.js` qui pose l'attribut, après la première image.
  Mesuré dans une passe (français, clair) avec un observateur posé au départ du document : première image à 16 ms, page visible dans ses couleurs d'origine ; attribut posé à 76 ms, levé à 80 ms, ambiance posée à 83 ms. Dans les quatre passes le premier affichage vient de
  20 à 25 ms avec zéro propriété posée : le constat de la 017 (de 66 à 100 ms de couleurs d'origine) n'a pas bougé. Rejoué ensuite sur `main` avec Enseigne à la place de Néon (français, clair) : première image à 27 ms, attribut posé à 60 ms, levé à 67 ms, ambiance posée à 78 ms. Automation+ pose le sien depuis un script classique (`js/theme.js`) et affiche déjà l'ambiance choisie à son premier affichage (153 à 188 ms). Dit à l'app par la consigne 023.
- **Pas mesuré** : Firefox, l'instance de la DINUM, l'écran du répondant et l'aperçu de Form+ (`#fill`, `.pv-*`, que l'app garde à l'aspect dessiné par la personne : consigne 016), les états du test à blanc des nœuds d'Automation+
  (`trace-*`, dont le rouge d'échec et l'ambre d'avertissement sont à l'app), Grist-BI et Tuesday (pas encore au catalogue de GFS : ni manifeste ni sous-module).

## 24. La corbeille des PDF de GFS et le clavier de l'explorateur : ce que le vrai serveur a mesuré (04/11)

Décision du porteur le 04/11 : « tout doit pouvoir se faire depuis l'explorateur, avec une corbeille » (cahier, section 2 ; contrats 6.6, points 10 à 12). Mesuré avec
`labo/run-corbeille.mjs` dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) : GFS ajouté comme widget à un document neuf, panneau à 700 × 400, souris et clavier réels, en français clair et en anglais
sombre (46 vérifications dans chacune, aucune en échec), Chromium 141 ; puis dans un **vrai Firefox 159 sans écran** (`test/corbeille-firefox.mjs`, à 700 px, clair et sombre, français et anglais).

- **Une table d'une version plus ancienne** : on retire `SupprimeLe` et `SupprimePar` de `GFS_Fichiers` par l'API REST (`RemoveColumn`), puis « Suppr » sur un fichier : GFS ajoute les deux colonnes (`AddColumn`, `DateTime:UTC` et `Text`) à une table qui a
  déjà des lignes, sans poser de question (la table existe : aucun accord à demander) et sans créer d'autre table, puis marque la ligne. Les types relus par l'API REST sont ceux voulus.
- **Ce que Grist rend d'une date jamais écrite** : `null` (pas `0`, pas une chaîne). Écrite, la date revient **en secondes** (un entier, à une seconde près de l'horloge du labo). `UpdateRecord` avec `null` sur la colonne de date et `''` sur la colonne de texte les
  vide : l'API REST rend `null` et `""`. C'est pourquoi la lecture (`trashOf`, `js/explorer/explorer-model.js`) ne tient pour « à la corbeille » qu'une date strictement positive.
- **La ligne marquée garde tout** : même `Identifiant`, même `Nom`, `Contenu` toujours `['L', n]`, et la liste des pièces jointes du serveur n'a pas changé (la pièce reste citée : Grist ne l'efface pas). Les autres lignes ne sont pas marquées.
- **L'adresse de la personne** : `SupprimePar` porte l'adresse que Grist donne (`essai@example.com`) **quand GFS la connaît**, c'est-à-dire une fois sa table de rangement lue (6.4, point 9) ; avant un premier favori, `SupprimePar` (comme `Auteur`)
  est vide, et la vue ne montre pas d'initiales. Le labo pose donc un premier favori avant la corbeille.
- **Restaurer** : la date redevient `null`, la personne `""`, la ligne et son identifiant sont ceux d'avant ; sa pièce jointe est la même. **Un nom devenu pris** (un nouveau « Devis.pdf » est entré pendant que l'ancien était à la corbeille, sans fenêtre « nom
  pris » : un fichier à la corbeille ne prend pas son nom) : le fichier restauré revient sous « Devis (1).pdf », la phrase le dit, les deux lignes sont dans la table, aucune n'est marquée.
- **Supprimer pour de bon** : la fenêtre nomme le fichier et donne le clavier à « Annuler » ; Échap ne supprime rien ; la ligne disparaît de la table ; **la pièce jointe reste sur le serveur** (Grist ne l'efface qu'au bout de 7 jours, faits vérifiés, 14).
- **Vider la corbeille** : une seule fenêtre, qui nomme les fichiers ; **plusieurs `RemoveRecord` dans un seul `applyUserActions` passent** (les deux lignes vues partent en un lot) ; une ligne qu'une autre personne met à la corbeille **pendant que la fenêtre est
  ouverte** (écrite par l'API REST) n'est pas retirée : elle reste, marquée, et la vue relue la montre avec le nom de l'autre personne.
- **Le clavier dans le cadre de Grist** : un clic à la vraie souris sur une ligne donne le clavier au panneau (la ligne est l'élément actif et choisie) ; ↓ ↑ passent d'une ligne à l'autre, Suppr met à la corbeille (et le clavier passe à la ligne qui reste),
  Entrée restaure à la corbeille, F2 ouvre « Renommer » sur la ligne choisie, Maj+F10 et le clic droit ouvrent le menu de la ligne (où chaque geste dit sa touche : « Suppr », « F2 », « Entrée »), Échap ferme le menu et laisse la ligne choisie.
- **Dans Firefox 159 sans écran** : ↑ ↓ ← → Début Fin Entrée F2 Suppr Retour arrière « / » Maj+F10 arrivent au script de la page (écouteur de `keydown` sur la liste) ; **Entrée et Espace sur un `<button>` ne cliquent pas** (déjà noté, `labo/LISEZ-MOI.md`) :
  l'essai n'en dépend pas, il passe par les lignes. Les codes WebDriver des touches de fonction : F2 ``, F10 `` (F11 est `` : une erreur de code avait ouvert autre chose), Suppr ``, Retour arrière ``.
- **Ctrl, Alt et Méta** : aucune combinaison n'est liée (`js/explorer/explorer-keys.js`, essai Node) : Ctrl+D est le marque-page de Firefox, Ctrl+F sa recherche dans la page, Alt+← la page précédente ; Ctrl+C, Ctrl+X et Ctrl+V sont réservés à dupliquer et déplacer (lot 3).
- **Pas mesuré** : le clavier **avant** tout clic dans le panneau (Grist garde alors le clavier pour sa grille : à vérifier chez le porteur) ; l'instance de la DINUM ; le Firefox du porteur et son clavier (touche « Menu », Maj+F10 sous Windows) ; un document en
  lecture seule joué dans le vrai serveur (le refus `trash.readonly` est mesuré dans les essais Node) ; la corbeille des fichiers **des apps** (lot 2, mesurée dans la section 26).

## 25. Le calendrier du kit : ce que le vrai Grist et Firefox ont mesuré (04/11)

Le module de calendrier de Calendar+ (version 2 avec les heures, `531e0cd`) est rangé dans le kit 0.8.0 (`336baf4` ; consignes 006, 011 et 012). Joué par `labo/run-calendrier-kit.mjs` dans un **vrai Grist** (grist-static), panneau à 700 × 400, souris
réelle, en français et en anglais, en clair et en sombre (une passe par combinaison, quatre passes), Chromium 141 seulement. La sonde ZC (`labo/sondes/z-calendrier/`, `sonde-zc.json`) est une app écrite avec le kit : `creerCalendrier`, `GfsLink`,
`Ambiance` ; elle tourne dans le sous-cadre isolé de GFS (sans `allow-same-origin`) sous la politique de sécurité d'une app hébergée (ni style ni image en ligne), et le kit lui est servi depuis `prototype/kit` (ou `KIT_DIR`). **41 vérifications et
un constat par passe, aucune en échec** ; le même cadre du début à la fin (jamais reconstruit), aucune requête hors du labo, aucune erreur de page, aucun refus de la politique de sécurité du contenu.

- **Le glisser-déposer HTML5 marche à la vraie souris dans le sous-cadre isolé** (la crainte de la consigne 007 : mesuré, plus seulement lu dans le code). Un événement du lundi 9 au mercredi 11 : l'hôte reçoit `{ id, debut, fin }` et l'événement est
  affiché au 11. Une barre du mardi 3 au jeudi 5, saisie par son premier jour et déposée un mardi : du 10 au 12, l'écart est gardé. Une puce du plateau « Sans date » déposée sur le vendredi 20 : l'événement est là, la puce a quitté le plateau.
  Un bloc horaire du jeudi 12:00 déposé sur le vendredi : 12:15 à 14:15 (au quart d'heure, la durée gardée). L'hôte qui répond `false`, ou qui rejette (une erreur), ramène l'événement au jour exact où il était (le 9, pas seulement la même
  semaine : l'essai regarde la cellule qui porte la barre). En lecture seule, rien ne glisse (aucun `draggable`), la raison est dite, un glissement à la souris n'envoie rien.
- **Les couleurs de Grist passent par le CSSOM** sous `style-src 'self'` : fond `#dff5e8` et texte `#146c48` lus sur l'événement coloré. **La barre de GFS** (34 × 124 px au bord gauche, zone `{ x: 0, y: 134, largeur: 42, hauteur: 132 }` à 700 × 400) :
  l'hôte la réserve en gardant le bord libre, le calendrier fait 658 px de large et commence à droite d'elle, sans rien de recouvert.
- **L'ambiance** (les quatre : Pop, Papier, Brut, Néon, dans les deux modes) : la page, le calendrier et le repère d'aujourd'hui prennent `--bg`, `--surface` et `--accent-solid` ; **chaque texte garde 4,5:1 au moins** (mois et plateau 77 textes mesurés,
  liste d'un jour 5, saisie rapide 1, semaine 24, jour 13, par combinaison : aucun en échec) ; une couleur libre (`#6d28d9`) est suivie ; « Revenir à Grist Factory » rend les couleurs de la charte. Les couleurs que Grist donne à un événement
  sont une donnée de la personne : elles ne sont pas mesurées.
- **Un piège de mesure** : l'audit de contraste des autres rejeux cherche le fond d'un texte dans ses ancêtres. Dans le calendrier, le numéro d'un jour est posé sur une cellule sœur (`.cal-fond`) : l'audit lisait le fond de la page, et un contraste
  de 1,11:1 passait. Le mode « par point » de `contrastAudit` (`document.elementsFromPoint` au centre du texte) lit le fond que la personne voit ; contrôle négatif fait : il attrape 1,11:1 là où l'audit par ancêtres se tait.
- **Deux constats, rien n'est changé** (le module est celui de Calendar+) : à 658 px, la barre d'outils tient sur une ligne en Mois et en Semaine (45 px) et passe sur deux en vue Jour (81 px : « Sans date » descend et les boutons de vue se déplacent) ;
  et la sixième semaine du mois (30 novembre au 6 décembre) est coupée par le bas du panneau (428 px pour 400 de fenêtre), elle se rejoint à la molette, jusqu'au bout. Un `:hover` qui semblait resté sur un bouton de vue n'est pas un défaut : la barre
  se remet en page sous un pointeur qui ne bouge pas.
- **Firefox 159 sans écran** (`test/firefox.mjs`, `test/mesures-calendrier.mjs` joué par `interfaces-firefox.test.mjs`, sur la page d'essai du kit), français et anglais, clair et sombre : le mois (titre, 42 jours, six semaines, barre d'outils sur une
  ligne, aucun événement hors de la grille, « +2 »), un clic sur un événement qui le dit à l'hôte, la liste d'un jour et Échap, la saisie rapide (`ajouter`), la semaine (blocs de 9 h 30 et de 10 h à leur place, côte à côte, ouverture vers 7 h). Le glisser-déposer :
  **le départ** (`dragstart`, effet « move », un texte) **et l'accueil de la cible** (`dragover` annulé, effet « move ») pour un événement du mois, une puce du plateau et un bloc horaire. **Le dépôt lui-même n'est pas mesuré** : ni le Firefox sans écran
  ni le même sous Xvfb n'achèvent un glissement lancé par des actions de pointeur BiDi (`dragstart`, `dragenter`, `dragover` partent ; ni `drop`, ni `dragend`, ni `mouseup` après le lâcher), **même sur une page de deux éléments** (contrôle) : limite du banc,
  pas du module. À essayer dans le vrai Firefox du porteur.
- **Ce que Firefox a montré dans le module, corrigé** : sur ce banc, un gestionnaire de `dragover` qui ne fait qu'annuler l'événement lit l'effet « none » (contrôle sur deux éléments), un gestionnaire qui pose `dropEffect = 'move'` lit « move » ; le mois le posait
  (`accepterDepots`), pas la grille horaire, et un dépôt dont l'effet est « none » n'a pas lieu (spécification HTML). Kit `336baf4` : les deux grilles passent par `accepterLeDepot`, un essai Chromium (en échec sur l'ancien code : effet « none ») et la mesure Firefox
  le gardent. **Non su** : si un Firefox sur un vrai système, qui suggère l'effet, acceptait déjà le dépôt sur la grille horaire.
- **Pas mesuré** : le dépôt sous Firefox, l'instance de la DINUM, Tuesday et Calendar+ avec le module du kit (la première n'est pas au catalogue, la seconde garde sa copie jusqu'à la consigne 012), un calendrier de milliers de lignes.

## 26. La corbeille des fichiers des apps (Publipostage+) : ce que le vrai serveur a mesuré (04/11)

Décision du porteur le 04/11 (« tout doit pouvoir se faire depuis l'explorateur, pour toutes les apps, avec une corbeille » ; cahier, section 2 ; contrats 2.4 `suppression`, 6.7). Mesuré avec `labo/run-corbeille-apps.mjs` dans un
**vrai serveur Grist 1.7.19** (Docker) : GFS ajouté comme widget à un document neuf, les modèles de Publipostage+ semés (dix-huit modèles, les réglages de l'app, leur rangement), une colonne à formule, une colonne de pièces jointes et un jeton
ajoutés, panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre (40 vérifications dans chacune, aucune en échec), Chromium 141, avec **la vraie Publipostage+** (celle que GFS référence).

- **Un numéro de ligne voulu** : `AddRecord` à un numéro **déjà pris** est refusé par Grist (HTTP 500, `AssertionError docactions.[Bulk]AddRecord for existing record #2`), rien n'est écrasé ; à un numéro **libre**, la ligne revient à ce numéro. La restauration vérifie
  d'abord que le numéro est libre (sinon : un numéro neuf) ; si une autre personne le prend entre la lecture et l'écriture, Grist refuse et le lot entier est défait.
- **Un lot est tout ou rien** : un lot dont une action échoue (colonne inconnue : `KeyError`) est défait en entier, y compris l'`AddRecord` qui le précédait. C'est ce qui permet à « mettre à la corbeille » d'écrire la copie et de retirer la ligne dans UN lot sans jamais laisser un fichier
  à la fois dans l'app et à la corbeille.
- **Retirer une ligne qui n'est plus là n'échoue pas** : `RemoveRecord` d'un numéro absent rend `null`, et le lot continue (l'`AddRecord` qui le précédait est gardé). Conséquence : si une autre personne supprime la ligne entre la lecture de GFS et son écriture, la copie est quand même gardée à la
  corbeille (restaurable) ; GFS relit la ligne juste avant d'écrire, et **après** la réponse à la question de la table (une personne peut être longue à répondre). Deux personnes qui mettent le même fichier à la corbeille au même instant peuvent en laisser deux copies : le jeton (`uniques`) évite alors un doublon à la restauration.
- **Les colonnes de données** : GFS lit `_grist_Tables` et `_grist_Tables_column` (accès complet) pour savoir lesquelles copier : la colonne à formule (`Resume`) et `manualSort` n'y sont pas, `Pieces` (`Attachments`) y est avec son type. La copie contient `Nom`, `Contenu`, `NomFichierPDF`, `DateModif`,
  `TypeModele`, `ModifiePar`, `EstParDefaut`, `Jeton`, `Pieces` ; **restaurée, la ligne est identique** (mêmes valeurs, mêmes dates en secondes, même jeton) et la formule recalcule.
- **Une pièce jointe** : la cellule rend `['L', n]` ; un fichier qui en a n'est pas mis à la corbeille (la copie en JSON ne la citerait plus : Grist l'effacerait au bout de 7 jours), la phrase le dit, aucune table n'est créée. **Un envoi de fichier par l'API REST demande l'en-tête `X-Requested-With: XMLHttpRequest`**
  (sans lui : 401 « Unauthenticated requests require one of the headers… », contre les envois d'une autre page).
- **La table naît avec l'accord** : sans table, « Suppr » ouvre une fenêtre du widget (« Créer la table GFS_Corbeille ? », lisible à 4,5:1, dans le panneau) ; « Annuler » ne supprime rien (phrase : « … n'a pas pu être mis à la corbeille : la table GFS_Corbeille n'a pas été créée (rien n'est supprimé). »), la table n'est pas créée ;
  « Créer la table » crée `GFS_Corbeille` avec ses onze colonnes aux types voulus (`DateTime:UTC` pour les deux dates), puis met le modèle à la corbeille. Les deux refus voulus (la table refusée, la pièce jointe) ne laissent aucun avertissement dans la console de GFS.
- **L'adresse de la personne** : comme pour les PDF (section 24), `SupprimePar` n'est connue qu'une fois la table de rangement lue (6.4, point 9) ; le labo pose un premier favori avant la corbeille. **Le rangement de la personne** (l'app range par `Utilisateur`) ne s'applique qu'une fois la personne connue : avant,
  c'est le rangement commun (`Utilisateur` vide) ; le labo sème donc le rangement avec l'adresse de la personne d'essai.
- **Restaurer** : au **même numéro** quand il est libre (mesuré : 16 → 16, valeurs identiques) ; **le modèle par défaut** ne reprend pas son étoile quand un autre l'est devenu (il n'y a qu'une étoile) et la reprend sinon ; **le même jeton déjà présent** (l'app a remis le modèle) : rien n'est écrit dans la table
  de l'app, l'entrée quitte la corbeille, pas de doublon ; **un nom devenu pris** : le premier nom libre (« Dossier de formation (1) »), la phrase le dit, le numéro est celui d'avant ; **un numéro pris** par une autre ligne (ajoutée à ce numéro) : un numéro neuf, la ligne de l'autre n'est pas touchée.
  Dossier et favori du fichier n'ont pas bougé (le rangement de l'app est par numéro) : la corbeille dit « revient dans Formation » et le fichier retrouve son dossier et son épingle.
- **Supprimer pour de bon** et **Vider** : une fenêtre qui nomme le modèle (ou les modèles) et donne le clavier à « Annuler » ; Échap ne supprime rien ; seule l'entrée de la corbeille part, la table de l'app et les pièces jointes d'un autre modèle ne bougent pas.
- **La vraie Publipostage+ ouvre le modèle restauré** : Entrée (double-clic) sur la ligne du modèle restauré : l'app démarre, `Templates.getCurrentId()` rend `16`, le nom et le texte sont ceux d'avant la corbeille (« Ouvert depuis l'explorateur. »). Le sous-module `apps/publipostage` s'initialise dans le cloud (`git submodule update --init`)
  et le miroir local des bibliothèques se construit par `labo/build-mirror.sh` (le cloud n'atteint que le registre npm).
- **Pas mesuré** : l'instance de la DINUM ; le Firefox du porteur (l'interface de la corbeille y est mesurée par `test/corbeille-firefox.mjs` pour les PDF ; les fichiers des apps y passent par la même vue) ; un document en lecture seule joué dans le vrai serveur (`trash.readonly`, essais Node) ; la perte de l'historique des versions d'un
  modèle restauré (contrats 6.7, point 6) ; Form+ et Automation+ (pas de recette : leurs fichiers sont grisés, avec la raison).

## 27. Le script d'API de `docs.getgrist.com` s'évalue : une page sans `'unsafe-eval'` ne démarre pas (vu par le porteur et reproduit le 04/11)

**Vu par le porteur** (Firefox, le Grist de la DINUM, « Nouveau > Formulaire » depuis GFS) : Form+ ne dit jamais « prête ». GFS attend 15 s le site en ligne, ouvre la copie figée, attend 15 s de plus, puis écrit « Form+ ne répond pas ». Sa console :

```text
Uncaught EvalError: call to eval() blocked by CSP        (https://docs.getgrist.com/grist-plugin-api.js:251)
Content-Security-Policy : … « script-src 'self' https://unpkg.com https://docs.getgrist.com » (la valeur 'unsafe-eval' est manquante)
Uncaught (in promise) TypeError: can't access property "ready", grist is undefined        (lombre33.github.io/FormPlus/poc/js/main.js:133)
```

La ligne 133 est celle de `grist.ready()` à la tête de Form+ (`6059fb9`) ; la copie figée (`0de37ac`) la porte à la ligne 119 et a la même politique : elle échoue de même.

**Lu** (les politiques de page, le 04/11) : GFS (`prototype/index.html`, `'unsafe-eval'` et l'adresse entière du script, avec la raison : « le fichier que Grist sert est un bundle de développement qui s'évalue par eval() »), Publipostage+ (`dd19c76` :
`script-src 'self' 'unsafe-eval' https://esm.sh https://docs.getgrist.com/grist-plugin-api.js`), Automation+ (`6019846` : `'self' 'unsafe-eval'` et l'adresse entière), Tuesday (consigne 007, point 1), **Form+ seule sans `'unsafe-eval'`** (`default-src 'self'; script-src 'self' https://unpkg.com https://docs.getgrist.com`, depuis `85ac56d` du 21/10, qui avait ajouté `docs.getgrist.com` après un essai contre un Grist auto-hébergé).

**Pourquoi ni Form+ ni le labo ne l'avaient vu.** Le script que sert un Grist Docker (1.7.19 : `/grist-plugin-api.js`, 27 015 lignes) ne contient aucun `eval(` ; le labo (`labo/lab-serveur.mjs`) le sert à la place de celui de `docs.getgrist.com`, comme le banc d'essai de Form+
(`tests/grist-env/README.md`, point 2 : `ctx.route('https://docs.getgrist.com/grist-plugin-api.js', …)` vers le fichier du Docker). Seul le fichier de `docs.getgrist.com` s'évalue, et il est injoignable du cloud (le proxy refuse l'hôte) : sa forme est lue dans la console du porteur, pas dans le fichier.

**Reproduit** (Firefox 159, vrai Grist Docker 1.7.19, « Nouveau > Formulaire ») en servant le script du Docker enveloppé dans `eval(` + `JSON.stringify(fichier)` + `);` : Form+ en tête (`6059fb9`) et sa copie (`0de37ac`) donnent `EvalError: call to eval() blocked by CSP`, puis `ReferenceError: grist is not defined`
(le dernier mot diffère de la console du porteur, `TypeError … grist is undefined` : dans l'enveloppe du labo `grist` n'est pas déclaré du tout ; la cause, l'`EvalError` qui précède, est la même) ; la page reste sur sa carte « Connexion à Grist… » ; GFS n'a jamais le `ready`. La même mesure avec une copie de Form+ dont la politique est `script-src 'self' 'unsafe-eval' https://unpkg.com
https://docs.getgrist.com/grist-plugin-api.js` : **prête en 0,2 s**, sur le site comme sur la copie. Sans l'enveloppe `eval`, la tête de Form+ comme la copie sont prêtes en moins d'une demi-seconde (Chromium, Firefox 140 et 159) : le défaut ne se voit qu'avec le script qui s'évalue.

**Le piège de l'app** : `loadPluginApi()` (`plugin-loader.js`) résout `true` sur l'événement `load` du script, qui vient même quand le script a échoué dans son `eval` ; l'app tombe alors sur un `TypeError` que rien n'affiche. Dit à Form+ en option (consigne 018, point 3).

**Ce que GFS fait** : consigne 018 à Form+ (la politique de sa page : `'unsafe-eval'` et l'adresse entière du script), règle 11 du guide des apps complétée, et le défaut propre à GFS que le porteur a vu en chemin (le message rouge restait sur l'explorateur, et rouvrir l'app ne la relançait pas).

**Le défaut de GFS, corrigé et mesuré** (`1573848`, sur `main` le 04/11). *Dans un vrai Grist* (grist-static, Chromium, 700 × 400, souris réelle, `labo/run-app-muette.mjs`, 12 vérifications en français clair et en anglais sombre) et *sous Firefox 159 dans un vrai serveur Grist Docker 1.7.19*
(Form+ muette : son site en ligne et sa copie répondent 404 ; 7 vérifications) : « Form+ ne répond pas. » apparaît en rouge 30 s après l'ouverture ; sur l'explorateur la phrase n'est plus visible et son texte est vide (un lecteur d'écran ne la lit pas) ; l'explorateur fermé, elle revient, la même, en rouge ;
Form+ rendue à elle-même, « Nouveau > Formulaire » **relance** l'app (un seul cadre, sur son site en ligne, prête) et la phrase a disparu. Sur l'ancien code les mêmes gestes donnent 6 échecs sur 12 dans le labo et 4 sous Firefox : la phrase reste sur l'explorateur, rien n'est relancé et le cadre muet reste. La console de GFS dit, une fois par délai,
où il a attendu (le site en ligne, puis la copie figée, sans la recherche de l'adresse) : la cause d'une app muette est dans la console de **son** cadre (c'est là que le porteur l'a lue).

**Le labo voit désormais cette panne, par défaut** : `labo/api-evaluee.mjs` sert le script de l'API des widgets enveloppé dans `var grist;` et `eval(…)`, la forme du fichier de `docs.getgrist.com` d'après la console du porteur (`LAB_API_EVAL=0` le sert tel quel). Avec lui, la passe `run-ouvrir-form.mjs` sur Form+ à `0de37ac` reste sur « Connexion à Grist… » : « Nouveau > Formulaire » et le double-clic d'un formulaire ne démarrent rien (2 échecs) ; sans l'enveloppe, elle réussissait.
(`run-app-muette.mjs`, elle, ne dépend pas de Form+ : ses deux pages sont des pages d'essai, et elle réussit dans les deux modes.) `test/api-evaluee.test.mjs` garde l'enveloppe (un contexte qui refuse l'évaluation de texte y donne `EvalError`, puis `grist` vide) et le défaut. **Défaut depuis le 04/11**, Form+ ayant appliqué la 018 (`6c79698`, référence de GFS à `17cfce9`) : avec la politique corrigée, `run-ouvrir-form` (toutes ses vérifications), `run-form` (48 sur 48), `run-form-seul` (12 sur 12), `run-app-muette` (12 sur 12), `run-direct` (12 sur 12) et `run-courtier` (11 sur 11) réussissent, enveloppe active.
**Pas mesuré** : l'app seule dans le Grist du porteur (le chargeur est le même : lu, non mesuré) ; le fichier réel de `docs.getgrist.com` (injoignable du cloud : sa forme est celle de la console du porteur, pas celle du fichier) ; Publipostage+ et Automation+ avec l'enveloppe (leur politique garde `'unsafe-eval'` : lu dans leurs dépôts, pas rejoué, car leurs sous-modules et le miroir de leurs bibliothèques ne sont pas posés dans ce conteneur).

## 28. Dupliquer et copier-coller depuis l'explorateur (Publipostage+, PDF) : ce que le vrai serveur a mesuré (04/11)

Décision du porteur le 04/11 (« tout doit pouvoir se faire depuis l'explorateur, pour toutes les apps » ; cahier, section 2 ; contrats 2.4 `copie`, 6.4 point 10, 6.6 point 13). Mesuré avec `labo/run-copie.mjs` dans un **vrai serveur Grist 1.7.19** (Docker) : GFS ajouté comme widget à un document neuf,
deux PDF importés par l'explorateur, les modèles de Publipostage+ semés (dix-huit modèles, les réglages de l'app, leur rangement), une colonne à formule, une colonne de pièces jointes et un jeton ajoutés, panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre
(41 vérifications dans chacune, aucune en échec), Chromium 141, avec **la vraie Publipostage+** (celle que GFS référence). L'interface y est aussi mesurée dans un vrai Firefox 159 sans écran (`test/copier-firefox.mjs`, branché sur `test/interfaces-firefox.test.mjs`).

- **Ajouter une ligne avec les valeurs d'une autre** : un seul `AddRecord` sans numéro (Grist donne le suivant : 20 après 19 lignes). GFS n'écrit que les colonnes de données que ses lectures rendent : **la colonne à formule (`Resume`) n'est pas écrite et se recalcule pour la copie** (« CONTRAT DE PRESTATION (1) »), `manualSort` non plus ; `Pieces` (`Attachments`) est écrite telle que lue (`['L', n]`) ;
  `DateModif` (secondes) et `ModifiePar` sont ceux de l'original (la copie a le même contenu : l'app met la date à jour quand elle enregistre). L'original n'a pas bougé d'un octet (jeton compris).
- **Le nom** : le premier nom libre, « Contrat de prestation (1) », puis « (2) » pour un deuxième exemplaire ; un PDF garde son extension (« Facture (1).pdf ») ; la ligne réservée des réglages n'est pas un fichier, son nom ne compte pas. (Publipostage+ dit « (2) » quand on duplique chez lui ; GFS garde « (1) », sa convention de tous les fichiers.)
- **Le jeton** : la copie l'a vide (`uniques: [Jeton]`). Publipostage+ en donne un à un modèle qui n'en a pas, au premier besoin, sans l'écraser (`Templates.ensureToken`, `js/templates.js`, lu dans la version référencée ; ses essais disent « un modèle neuf n'a pas de jeton ») : **la copie n'hérite donc pas de l'historique des versions de l'original** (rangé par jeton), elle commence le sien.
  **La vraie app ouvre la copie** : `Templates.getCurrentId()` rend le numéro de la copie, le nom est « Contrat de prestation (1) », le texte celui de l'original.
- **Le modèle par défaut** : la copie n'a jamais l'étoile (`exclusives: [EstParDefaut]`) : il n'y en a toujours qu'une, celle de l'original, qui reste épinglé ; la copie ne l'est pas.
- **Le rangement** : la copie d'un fichier d'une app est rangée par **une ligne de `GFS_Rangement`** pour la personne (`App`, `Fichier` = le numéro de la copie, `Dossier`, `Favori` faux) ; à la racine, **aucune ligne n'est écrite**. « Dupliquer » range la copie dans le dossier de l'original (« Formation »), Ctrl+V dans le dossier ouvert (« Facturation »).
  **Couper puis coller** écrit une ligne par fichier et **garde le favori** (le modèle épinglé garde `Favori` à vrai avec son nouveau `Dossier`) ; un **dossier coupé** emporte ce qu'il contient (« Formation/Archives 2025 » devient « Stock/Archives 2025 » pour le modèle qu'il contenait) et **le rangement propre de Publipostage+ (`Publipostage_PreferencesModeles`) n'est pas touché** (identique avant et après).
- **Une pièce jointe citée deux fois** : la copie d'un modèle à pièce jointe cite la même pièce que l'original ; **le document garde le même nombre de pièces jointes** (trois avant, trois après : rien n'est envoyé). Un PDF copié a un nouvel `Identifiant` (12 caractères hexadécimaux) et la même pièce, la même taille, la même origine ; la copie est de la personne que Grist donne, d'aujourd'hui
  (l'original, importé avant que GFS connaisse la personne, n'a pas d'auteur : la copie ne le reprend pas). **L'original mis à la corbeille puis supprimé pour de bon : sa ligne part, la copie reste, sa pièce jointe est inchangée (même empreinte) et « Télécharger » la rend octet pour octet.** (Grist n'efface une pièce que quand plus aucune cellule ne la cite.)
- **Le clavier dans le cadre de Grist** : Ctrl+C, Ctrl+X et Ctrl+V arrivent au panneau dès qu'un clic l'y a posé (comme ↓ ↑ Suppr), et il le garde quand la personne change de dossier au double-clic. Une copie se colle autant de fois que la personne veut (« (1) » puis « (2) ») ; ce qui est coupé, une fois ; la ligne neuve prend le clavier (`aria-selected`).
  Les refus se disent sans rien écrire : rien à copier, « un dossier ne se copie pas : coupe-le », pas de collage dans « Récents ». La console de GFS reste muette.
- **Pas mesuré** : l'instance de la DINUM ; le Firefox du porteur (l'interface est mesurée par `test/copier-firefox.mjs`, pas les gestes de bout en bout dans un vrai Grist, que le labo ne joue qu'en Chromium) ; **deux personnes qui copient le même fichier au même instant** (chacune choisit « (1) » d'après sa lecture, qui précède l'écriture : deux lignes peuvent porter le même nom, la personne le voit et renomme) ;
  un document en lecture seule joué dans le vrai serveur (`trash.readonly` : essais Node) ; un modèle dont les règles « Tables liées » désignent un modèle source (la copie garde les liens, c'est celle de l'original) ; Form+ et Automation+ (pas de recette : « Dupliquer » est grisé, avec la raison).

## 29. Changer d'app : GFS demande « fermer » et attend la réponse, ce que le vrai Grist a mesuré (04/11)

Décision du porteur le 04/11 (« gérer les enregistrements automatiques en cas de swap d'app ou de fichier » ; cahier, section 5.2, point 5 ; contrats 5.4, points 3 et 7). Mesuré avec `labo/run-fermer.mjs` dans un **vrai Grist** (grist-static), panneau à 700 × 400, à la vraie souris, avec les sondes O et Q (`sondes/o-ouvrir/`, `sondes/q-liens/`) qui répondent à `fermer` comme le fera une app, en français et en anglais, en clair et en sombre : 30 vérifications dans chacune des quatre combinaisons, aucune en échec, la console de GFS muette (les essais voisins du changement d'app passent aussi : `run-ouvrir` 16 vérifications, `run-liens` 33). **Pas avec la vraie Publipostage+** : celle que GFS référence (`3064a29`) ne répond qu'à `ouvrir` (`js/gfs-link.js` rend `GFS_INCONNU` à tout autre appel de GFS) ; elle part donc comme avant tant que la consigne ne lui a pas demandé de répondre. L'interface de la question est aussi mesurée dans un vrai Firefox sans écran (`test/fermer-firefox.mjs`, branché sur `test/interfaces-firefox.test.mjs`).

- **Où GFS le demande** : la fenêtre des apps, le double-clic, « Nouveau », « Importer » ou « Lire » d'un fichier d'une **autre** app, un lien entre apps ; la `raison` part avec l'appel (`app`, `explorateur`, `nouveau`, `importer`, `lire`, `lien` : vérifiée à chaque geste). Un autre fichier de l'app déjà ouverte passe par `ouvrir`, pas par `fermer`.
- **« oui »** : l'app répond `{ ferme: true }`, son cadre est détruit et l'autre app s'ouvre, GFS ne dit rien. **Une app qui ne connaît pas l'appel** (`GFS_INCONNU`, la sonde Q) part comme avant, sans fenêtre ni phrase.
- **Sa propre question** : l'app pose Enregistrer / Abandonner / Annuler dans son cadre (l'explorateur est refermé pour qu'elle se voie, rien ne s'est ouvert) ; « Annuler » (`{ ferme: false }`) la laisse en place et GFS ne dit rien ; « Abandonner » la fait partir.
- **L'app se tait** : GFS attend dix secondes (mesuré : 10,47 à 10,51 s) puis pose « *app* ne répond pas », avec « Attendre » (le clavier y est) et « Fermer quand même » ; « Attendre » ne ferme rien, et la réponse tardive de l'app (`oui`) fait ensuite partir l'app ; « Fermer quand même » la ferme sans réponse.
- **L'app répond par une erreur** : « *app* n'a pas pu se fermer », avec la phrase de l'app, « Rester » (le clavier y est, l'app reste et rien ne s'ouvre) et « Fermer quand même ».
- **Un lien** : l'app qui suit le lien est celle à qui GFS demande de se fermer (`raison: "lien"`) ; si elle répond `non`, l'appel `openFile` rend `{ ouvert: false }` ; si elle répond `oui`, elle part et l'app visée s'ouvre avec `ouverture.raison: "lien"`.
- **La personne repart explorer avant la réponse** : la réponse tardive de l'app n'ouvre rien ; l'explorateur et l'app restent comme la personne les a laissés. La console de GFS reste muette.
- **Une app écrite avec le kit** (`labo/run-liens-kit.mjs`, la sonde K, quatre combinaisons, 13 vérifications chacune) : le kit 0.9.0 (`eaa2ae2`) rappelle l'abonné de `GfsLink.onClose` avec la raison « lien » ; **faux** : le cadre n'est pas détruit, `openFile` rend `false` et GFS ne dit rien par-dessus ; **vrai** : l'app visée prend la place. Sans abonné, le kit répond `GFS_INCONNU` (mesure d'avant : la sonde K partait sans rien demander). Côté kit : 191 essais Node (4 de plus, en échec sur l'ancien code) et 689 vérifications Chromium sur le cadre isolé.
- **Pas mesuré** : la vraie Publipostage+ (elle ne répond pas encore à `fermer`) ; le changement de la table de travail et le retrait de l'app active du registre (pas gardés : le cadre est recréé sans « fermer ») ; l'instance de la DINUM ; le geste de bout en bout sous le Firefox du porteur (la mise en page de la question est mesurée, pas le labo entier, qui ne joue qu'en Chromium).

## 30. Les icônes des types de fichier suivent l'ambiance, le PDF est rouge : ce que Firefox et le vrai Grist ont mesuré (04/11)

Décision du porteur le 04/11 (« ne faudrait-il pas adapter les icônes des types de fichier aussi au thème ? » et « une icône colorée "pdf" pour les pdf » ; cahier 6.5, contrats 2.4 et 5.2 point 10). Mesuré avec `test/icones-firefox.mjs` (branché sur `test/interfaces-firefox.test.mjs`) dans un vrai **Firefox 159** sans écran, à 700 × 400, et avec `labo/run-theme.mjs` dans un vrai Grist (grist-static, Chromium 153), quatre passes (français et anglais, clair et sombre). La lecture et le jugement sont communs (`labo/mesures-icones.mjs`) : ce que le navigateur CALCULE pour l'icône (couleur, épaisseur du trait, angles, bouts, remplissage, halo) contre le tableau de `js/theme/ambiance-types.js` et le trait de `css/explorer.css`.

- **Firefox refuse un nombre calculé pour `stroke-width`.** Écrit `calc(1.8 * var(--ic-k, 1))`, le trait tombe à **1 px** sans un mot (la valeur est « invalide au moment du calcul ») : 130 écarts sous Firefox (120 icônes, 10 barres d'information), et aucun sous Node ni sous Chromium. Mesuré sur un `<svg>` : `1.8` donne 1,8 px, `calc(1.8)` et `calc(1.8 * 1)` sont **refusés** (1 px), `calc(1.8px * 1)`, `calc(1.8px * var(--k, 1))` et `calc(1.8 * var(--k, 1) * 1px)` donnent 1,8 px. Le trait s'écrit donc en **longueur** (`calc(1.8px * var(--ic-k, 1))`, qui vaut 1,8 dans le dessin). Chromium n'a pas été mesuré sur l'ancienne écriture. L'essai échoue sur l'ancienne règle et passe sur la nouvelle.
- **Ce que Firefox calcule**, par ambiance (icône « document », sombre) : Grist Factory `rgb(91, 145, 245)` 1,8 px, angles et bouts ronds ; Pop `rgb(45, 166, 250)` 1,98 px, remplissage `color(srgb … / 0.17)` ; Papier `rgb(127, 175, 226)` 1,584 px, angles vifs, bouts coupés ; Brut `rgb(103, 156, 255)` 2,124 px, angles vifs, bouts carrés ; Enseigne (qui a pris la ligne de Néon le 04/11, mesurée sous ce nom) `rgb(109, 173, 255)` 1,656 px et `drop-shadow(… 0px 0px 2.2px)` à 80 %. Le PDF a sa couleur dans chacune (`rgb(243, 121, 132)` en sombre d'origine, `rgb(255, 120, 157)` Pop, `rgb(246, 136, 97)` Papier, `rgb(255, 112, 116)` Brut, `rgb(255, 116, 172)` Enseigne, ex-Néon). Les écritures calculées sont `rgb(…)`, `color(srgb … / a)` (un mélange) et `drop-shadow(color(srgb …) …)` : la mesure lit les trois.
- **Le fichier grisé** n'a ni couleur de type, ni remplissage, ni halo (« grisé : jamais allumé ») ; **le dossier** garde son remplissage d'origine ; les deux gardent le trait de l'ambiance.
- **Les vignettes de la fenêtre « Thème »** gardent les couleurs de type de LEUR ambiance quand la page porte Pop (la pastille « document » de Grist Factory, de Papier et de Brut a le fond doux de sa propre ambiance, en clair et en sombre).
- **Dans le vrai Grist** : les icônes de type de la liste ont la couleur du tableau et le trait de l'ambiance dans les cinq ambiances (aucun écart, quatre passes), et **chaque texte de l'explorateur et de la fenêtre garde 4,5:1 au moins** sur les couleurs affichées, pastilles comprises. Une page à l'ambiance d'origine avec une couleur libre porte maintenant **35 jetons** en ligne (19 de couleur et 16 de type, ces seize valant ceux de la feuille de style) ; les deux repères du labo qui comptaient 19 sont mis à jour.
- **Contrastes** (`test/ambiance.test.mjs`, sur les fonds de chaque ambiance, avec une centaine de couleurs libres) : texte de type **4,57:1** au plus bas, icône **3,18:1** au plus bas ; les teintes se tiennent (bleu 235 à 285°, vert 135 à 175°, orange 35 à 95°, rouge au-delà de 340° ou jusqu'à 45°) et deux familles se distinguent toujours (écart OKLab d'au moins 0,1).
- **Pas mesuré** : le PDF rouge dans le vrai serveur Grist (les essais Node et Firefox le lisent par le vrai modèle et le vrai manifeste de GFS ; le labo `run-pdf` n'a pas été rejoué) ; les vignettes et la barre d'information dans le vrai Grist (mesurées sous Firefox seulement) ; le Firefox du porteur (un Firefox 159 sans écran) ; l'instance de la DINUM.

## 31. Créer, garder et supprimer des dossiers, même vides : ce que le vrai serveur et Firefox ont mesuré (04/11)

Décision du porteur le 04/11 (« je n'ai pas l'impression que l'on puisse créer des dossier/sous dossier à date ? à lancer aussi » ; cahier, section 2 ; contrats 6.4, points 1, 7 et 11). Mesuré avec `labo/run-dossiers.mjs` dans un **vrai serveur Grist 1.7.19** (Docker), avec les modèles de Publipostage+ (dix-huit modèles, leurs réglages, leur rangement),
une deuxième personne qui a un dossier à elle, panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre (44 vérifications dans chacune, aucune en échec), Chromium 153. L'interface y est aussi mesurée dans un vrai Firefox 159 sans écran
(`test/dossiers-firefox.mjs`, branché sur `test/interfaces-firefox.test.mjs`, fr et en, clair et sombre, à 700 px).

- **Un dossier vide tient à une ligne de `GFS_Rangement`** : `App` et `Fichier` vides, `Dossier` = le chemin, `Utilisateur` = l'adresse que Grist donne à la personne, `Favori` faux. « Contrats » puis « Contrats/2026 » font **deux lignes** (le sous-dossier n'écrit pas celle de son parent). GFS rechargé, le dossier est toujours là, avec « 0 fichier »
  et sans une ligne de plus ; **la ligne-sonde de l'adresse n'a rien laissé**. La table de l'app (`Publipostage_Modeles`) et ses réglages (`Publipostage_PreferencesModeles`) sont **identiques avant et après** tous les gestes.
- **La table naît avec l'accord de la personne, au premier dossier** : la question dit ce que GFS y garde (les dossiers y sont) ; rien n'est créé tant qu'elle n'a pas dit oui. La fenêtre « Nouveau dossier » dit où il naît (« Moi » ou le dossier ouvert), met le clavier dans le champ, tient dans le panneau et se lit à 4,5:1.
- **Le dossier prend le clavier, sans fichier** (« 0 fichier » dans la barre d'information) ; Entrée l'ouvre : « Dossier vide. » (et non « Aucun fichier ») ; Retour arrière ramène à la racine. **Dans un dossier vide, la liste n'avait plus de ligne à garder le clavier** : Retour arrière ne montait pas (trouvé par `test/dossiers-firefox.mjs`) ; la liste elle-même
  le prend maintenant (`tabindex="-1"`, un `focus-visible` qui ne déborde pas).
- **Les refus se disent dans la fenêtre** : un nom vide, ou celui d'un voisin (« formation » pour « Formation » : casse et accents ignorés) ; rien n'est écrit.
- **Ranger dans un dossier vide** : la fenêtre « Déplacer » propose le dossier vide et son sous-dossier ; le modèle y va par **une ligne de rangement** (à l'adresse de la personne) et les lignes d'état ne bougent pas ; « Contrats » compte alors un fichier (celui de son sous-dossier). Coupé-collé dehors, **le dossier qu'il quitte reste** (une seule ligne
  d'état par dossier, jamais de doublon).
- **Mettre à la corbeille le dernier fichier d'un dossier** : avec la table du rangement, **la ligne d'état s'écrit**, le dossier reste, vide ; à la corbeille, la barre dit où le modèle reviendra ; restauré, il revient dans son dossier, **au même numéro de ligne, avec les mêmes valeurs**.
  **Sans la table du rangement, rien n'est demandé ni créé** (seule la question de `GFS_Corbeille` se pose) : le dossier qu'un modèle tenait seul, rangé par l'app, **disparaît avec lui** (la limite dite, contrats 6.4 point 11), puis revient avec le modèle restauré.
- **Renommer, déplacer, supprimer** : F2 sur un dossier vide renomme **le dossier et son sous-dossier dans le même lot** (aucune ligne de l'ancien nom ne reste) ; Ctrl+X puis Ctrl+V les met dans « Stock » (leurs lignes suivent, rien ne reste à la racine) ; Suppr les supprime avec leur sous-dossier vide, **sans question**, et la phrase le dit.
  Un dossier qui a des fichiers **ne se supprime pas** : Suppr dit quoi faire et n'écrit rien ; son article « Supprimer le dossier » est grisé, avec Suppr pour touche, et un clic dessus redit pourquoi.
- **Par personne** : le dossier de l'autre personne n'est ni vu ni touché, et supprimer ceux de la première laisse le sien.
- **Ce que le serveur fait des phrases** : la phrase de la corbeille arrive **avant** que la liste ait fini de se relire (« Lecture des fichiers… » entre les deux) ; celle d'un dossier supprimé, après. L'essai attend donc le texte exact (« Dossier vide. »), pas n'importe quel texte. La console de GFS reste muette.
- **Pas mesuré** : l'instance de la DINUM ; le Firefox du porteur (la mise en page est mesurée par `test/dossiers-firefox.mjs`, pas les gestes de bout en bout dans un vrai Grist, que le labo ne joue qu'en Chromium) ; **la même personne dans deux fenêtres qui crée ou vide au même instant**
  (chaque geste relit la table avant d'écrire et n'ajoute pas une ligne qui existe ; deux lignes pour un seul dossier se verraient comme un seul dossier, et « supprimer » les retire toutes) ; un document en lecture seule joué dans le vrai serveur (`writeBlock` : essais Node) ; des centaines de dossiers ; Form+ et Automation+ (rien à ranger côté app : leurs fichiers n'ont pas de recette `copie` ni `suppression`).

## 32. Le poids dans l'explorateur : ce que le vrai serveur et Firefox ont mesuré (04/11)

Demande du porteur le 04/11 (« la limite est de 15 Go sur l'ensemble des documents Grist : dans l'explorateur, on doit pouvoir estimer le poids de chaque élément, et si possible une case pour inclure les pièces jointes ») ; il a choisi, après l'étude, la colonne et les sommes, les tables liées des apps et une fenêtre « Poids du document » (quatre lots, chacun poussé seul). **Ce lot : la colonne « Poids », les poids des dossiers, le total du pied de fenêtre, la corbeille.** Mesuré avec `labo/run-poids.mjs` dans un **vrai serveur Grist 1.7.19** (Docker) :
les dix-huit modèles de Publipostage+ (leur ligne de réglages, trois modèles lourds de 600 000 caractères), trois PDF de GFS (dont un de 60 pages), panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre (22 vérifications dans chacune, aucune en échec), Chromium 153 ; avec `labo/run-liste.mjs` (grist-static, 68 vérifications dans chacune des quatre, aucune en échec) ; et dans un vrai Firefox 159 sans écran
(`test/interfaces-firefox.test.mjs` : les en-têtes, les cellules, le tri et le total, aux six largeurs, à 100 % et à 150 %, en clair et en sombre, en français et en anglais).

- **Ce que le poids compte** : les octets des cellules de la ligne comme SQLite les range (texte en UTF-8, entier de 1 à 8 octets, flottant 8, booléen 1, rien 0, liste de pièces jointes sans son « L »), pour toutes les colonnes que `fetchTable` rend (sauf `id` et `manualSort`) ; pour un PDF de GFS, qui EST une pièce jointe, plus sa taille (`Taille`). **Ce n'est ni la taille du fichier du document ni ce que compte la limite de Grist** : ni l'historique des actions
  (≈ 3 fois le contenu par enregistrement, 44 % du document d'essai de l'étude), ni les pages libres. Rien n'est écrit dans le document : le poids se recalcule à chaque lecture.
- **Face à l'octet exact de SQLite (`dbstat`, tableau par tableau)** : les modèles (22 lignes, dont trois de 600 Ko) **1 801 587 o estimés pour 1 803 735 o, soit −0,1 %** ; les PDF (3 lignes) 121 pour 182 (−33,5 %) ; le rangement (17 lignes) 219 pour 410 (−46,6 %). **Jamais au-dessus**, et d'autant plus en dessous que les lignes sont petites : l'estimation ne compte ni l'en-tête que SQLite met à chaque ligne ni le rang `manualSort`.
  Sur les modèles, qui portent presque tout le poids d'un document d'app, elle tient à 0,1 %. Le calcul coûte 55 ms pour 118 modèles (21 Mo de texte, sous Node 22), 90 ms pour le poids seul : sans commune mesure avec la lecture de la table (contrats 2.4, point 2).
- **`Taille` est la taille de Grist** : 1 633, 778 et 26 300 octets, les mêmes que `_grist_Attachments.fileSize` pour les trois PDF.
- **Un PDF dupliqué cite la même pièce jointe** (le numéro 3 des deux côtés, le document garde trois pièces) : chaque exemplaire dit son poids entier (« 26 Ko »), et le total de la liste (recherche « Rapport ») compte la pièce **une fois** : « 26 Ko », non « 51 Ko ». Un dossier fait de même : une pièce citée par deux de ses fichiers n'y compte qu'une fois.
- **La corbeille** : l'entrée d'un modèle lourd pèse **600 249 octets**, ceux de sa ligne de `GFS_Corbeille` (la copie JSON de la ligne, `Instantane`, en fait presque tout : mettre un modèle à la corbeille ne libère rien tant qu'elle le garde) ; la vue et son total disent « 586 Ko » ; restauré, le modèle dit le poids de sa ligne.
- **Le tri** : un premier clic sur « Poids » met le plus lourd d'abord (les dossiers par leur somme, puis les fichiers), le second le plus léger ; à poids égal, l'ordre des noms ; « Nom » remet l'ordre des noms.
- **La mise en page** : la colonne prend **32 px au nom à 700 px** (188 → 156). En dessous de 700 px le volet des dossiers passe de 172 à 132 px (de 520 à 699 px), et **sous 600 px la liste perd « Modifié » et « Par »** (elle garde Nom, Type, Poids) : sans cela, à 520 px le nom tombait à 16 px, moins que son en-tête (36 écarts mesurés sous Firefox). La vue large était déjà trop étroite sous 620 px environ avant ce lot.
  Mesuré aux six largeurs (700, 640, 600, 520, 500, 400) : aucun en-tête ne se recouvre, aucune cellule de type, de poids ou de date n'est coupée, le poids est collé au bord droit de sa colonne (moins d'un pixel), le total du pied tient entre la barre d'information et les boutons, chaque vignette dit son poids.
- **L'outil d'essai sous Firefox s'arrêtait à la 4 097e commande** (trouvé en ajoutant ces mesures) : le `WebSocket` de Node 22.23 (undici) range ses clés de masque dans un tampon de 16 386 octets qu'il consomme par quatre ; à la 4 097e trame envoyée par le processus, il écrit des clés vides et **Firefox ferme la connexion sans un mot** (« Firefox a fermé la connexion », puis chaque commande attend ses 30 s). Mesuré : exactement **4 092 commandes d'affilée**, qu'elles soient des clics, des touches ou des scripts ;
  deux Firefox lancés l'un après l'autre par le même processus se partagent ces 4 096 trames. Le fichier d'essai en envoyait 3 096 pour ses deux langues avant ce lot, 2 290 pour le français seul avec la colonne : la seconde langue s'arrêtait vers la 30e seconde. `test/websocket-client.mjs` (un client RFC 6455 d'une centaine de lignes, une clé neuve par trame) lève la limite : 6 000 scripts d'affilée passent, et `test/websocket-client.test.mjs` en envoie 5 000 à un vrai serveur.
- **Pas mesuré** : l'instance de la DINUM ; **ce que compte la limite de 15 Go** (le total du site n'est pas lisible depuis un widget : l'étude l'a lu dans le code, `GET /api/orgs/:id/usage` demande le propriétaire) ; le Firefox du porteur (un Firefox 159 sans écran) et un vrai Grist sous Firefox (le labo ne joue qu'en Chromium) ; les tables liées des apps (versions de Publipostage+, réponses de Form+ : lot 3) ; la fenêtre « Poids du document » (lot 4) ; la case « + pièces jointes » (lot 2) est la section 39 ;
  un document de plusieurs centaines de milliers de lignes (la lecture de la table, déjà faite par l'explorateur, coûte plus que la somme).

## 33. Ranger les exports PDF de la vraie Publipostage+ dans GFS : ce que le vrai serveur a mesuré (04/11)

Suite de la section 21 (la sonde Z) : la **vraie** Publipostage+ (`6a22dee`, sa consigne 043 faite par `cfabee2`, `690b50c` et `47e56ce`), servie par GFS, range ses exports PDF parmi les fichiers de GFS (contrats 2.7 point 6,
5.4 point 9). Joué par `labo/run-ranger-publipostage.mjs` dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) : un modèle de l'app ouvert dans son éditeur depuis l'explorateur de GFS, panneau à 700 × 400, souris et
clavier réels (le menu « Exporter » de l'app s'ouvre au survol), en français et en anglais, en clair et en sombre (38 vérifications dans chacune des quatre passes, et dans une cinquième sur le `main` du jour). Chromium 141 seulement. Les
bibliothèques natives de l'app, `pdfmake` et ses polices compris, viennent de copies aux mêmes adresses que leurs CDN (`labo/mirror`, `bash build-mirror.sh`).

- **La déclaration est ce qui fait ranger** : sans `actions.ranger: ["pdf"]` dans le manifeste de GFS, le premier export échoue comme prévu : GFS répond `GFS_REFUSE` (« ranger : le type « pdf » ne figure pas dans actions.ranger du
  manifeste de l'app « publipostage » ») et l'app télécharge le PDF en le disant (« GFS n'a pas gardé 1 PDF (…) »). Avec la déclaration, l'essai passe. Il n'y a aucun interrupteur de plus dans le code de GFS (`ACCEPTS_OPEN` n'a pas
  d'entrée `ranger`).
- **Le menu** : « Destination du PDF » dans « Exporter » porte ses trois lignes (Télécharger, Ranger dans GFS, Télécharger et ranger dans GFS), vivantes (ni grisées ni retirées), « Télécharger » cochée au départ ; un vrai clic coche
  « Ranger dans GFS » et GFS garde le choix par app et par personne (`stockage.ecrire`, clé `pp_export_destination`, rangée sous `gfs.stockage.publipostage.`).
- **Un premier export** : sur un document sans `GFS_Fichiers`, **c'est GFS qui demande l'accord pour sa table** (l'app n'en pose aucune), devant le panneau ; accordée, la table naît avec le PDF : une ligne, au nom que le modèle donne
  (« Contrat de prestation 2026.pdf »), `Origine` `publipostage`, une pièce jointe qui est un vrai PDF (`%PDF-`, quelques ko) ; rien n'est téléchargé ; le coin d'état de l'app dit « PDF rangé dans GFS. » ; l'explorateur montre le PDF.
- **Un nom pris** : la fenêtre « Ce nom est déjà pris » nomme l'app, le clavier est sur « Garder les deux », elle tient dans le panneau, ses textes ont le contraste voulu (4,5:1), rien n'est écrit avant la réponse. **Garder les deux** :
  « … (1).pdf », l'ancien PDF garde son contenu (même empreinte), l'app dit « PDF rangé dans GFS sous le nom « … (1).pdf ». » ; **Remplacer** : la même ligne (même identifiant) prend le nouveau contenu, la copie n'a pas bougé, « PDF rangé
  dans GFS, à la place de l'ancien. » ; **Annuler** : rien n'est rangé ni téléchargé, « PDF non rangé : annulé dans GFS. »
- **Télécharger et ranger dans GFS** : le fichier téléchargé (au nom de l'export) et la pièce jointe de GFS ont les mêmes octets (même empreinte SHA-256) ; le coin d'état dit le rangement puis « PDF généré. » ; « Télécharger » seul ne
  range rien.
- **Une archive ZIP de trois lignes** : l'app envoie les PDF un à un sous le nom de leur entrée de l'archive (`uniqueZipFilename` numérote à partir de (2) : « Lot de contrats.pdf », « Lot de contrats (2).pdf », « Lot de contrats (3).pdf »), tous
  du même lot, avec `suivants` 2, 1, 0. Sur des noms libres : aucune fenêtre, trois lignes, « 3 PDF rangés dans GFS. ». Le même export une seconde fois : trois noms pris, **une seule fenêtre** avec la case « Faire pareil pour les
  suivants » ; « Garder les deux » vaut pour les trois (trois copies de plus, « (1) », « (4) » et « (5) » : GFS prend le premier numéro libre, les trois premiers PDF n'ont pas bougé, « 3 PDF rangés dans GFS (3 gardés en double). ») ;
  une troisième fois, « Remplacer » pour les suivants : les trois mêmes lignes (mêmes identifiants) prennent un nouveau contenu, aucune de plus (« … (3 remplacés). ») ; l'archive n'est jamais téléchargée. **Une fausse alerte levée** :
  dans la première version de l'essai, trois PDF rangés sur des noms déjà pris ressortaient « (3) », « (4) » et « (5) », ce qui ressemblait à un même nom reçu trois fois ; l'app envoie bien trois noms distincts, ce sont les premiers
  numéros libres de GFS (l'essai le montre maintenant sur des noms libres, puis pris).
- **La console** : aucune erreur ni avertissement (GFS, Publipostage+), ni violation de politique.
- **Le contrat de l'app n'a pas bougé** entre `3064a29` et `6a22dee` (mesuré sur son code servi, avant et après) : mêmes verbes d'actions de Grist, mêmes tables internes, mêmes appels `grist.*`, mêmes adresses, même accès au
  stockage, même réseau ; deux `import(` de plus, les modules d'ambiance du kit lus par leur nom dans la carte d'importation, depuis le dossier `kit/` de l'app. **Seul le poids d'`edition` change** : 102 512 octets, soit 103 Ko au lieu de 102
  (`live.css`) ; `graphique` 183, `diapositives` 471 et `lecture-pdf` 17 n'ont pas bougé. **La publication de GFS prend les sous-modules en entier** (le journal de `pages build and deployment` entre dans `prototype/apps/automation/kit` et
  `prototype/apps/form/kit`) : le `kit/` de l'app, sous-module de son dépôt, est servi avec la copie de repli (**vérifié sur la construction de `7269e64`, qui entre dans `prototype/apps/publipostage/kit`**).
- **Rejoués sur `6a22dee`, sans échec** (français clair, une passe chacun) : `run-lire-publipostage` (33 vérifications), `run-ouvrir-publipostage` (28), `run-importer-pp` (33), `run-graphique` (20), `run-edition` (60),
  `run-diapositives` (60), `run-copie` (41) et `run-corbeille-apps` (40).
- **Pas mesuré** : Firefox avec la vraie app dans un vrai Grist (la fenêtre du nom pris, elle, est mesurée sous Firefox par `test/interfaces-firefox.test.mjs`), l'instance de la DINUM, un PDF de plus de 12 Mo, un nom de fichier à
  variables (l'essai tape un nom sans variable), le « PDF protégé » et le PDF réuni (le même chemin `deliver`, non joués), une personne qui refuse de créer la table avec la vraie app.

## 34. Un fichier qui tient à plus qu'une ligne (Form+) : ce que le vrai Grist et Firefox ont mesuré (04/11)

Suite des sections 26 (la corbeille des fichiers des apps) et 28 (la copie) : un formulaire de Form+ n'est pas une ligne (sa section de formulaire, sa table de réponses, son lien public), GFS ne sait pas le fermer ni le copier seul. Les contrats 2.4 (`suppression.appel`, `copie.appel`) et 5.4 (points 10 et 11) font que l'app ouverte le fait à sa place. Joué par `labo/run-composite.mjs` dans un **vrai Grist** (grist-static, Chromium), à 700 × 400, à la vraie souris et au vrai clavier, en français clair et en anglais sombre (38 vérifications dans chacune, aucune en échec), avec la **sonde ZF** (`labo/sondes/zf-composite/`), qui répond comme Form+ répondra : ce n'est pas la vraie Form+, qui n'a pas encore répondu aux consignes 020 et 021.

- **L'app n'est pas ouverte** : « Mettre à la corbeille » et « Dupliquer » sont **grisés, jamais masqués**, et le clic, Suppr et Ctrl+C puis Ctrl+V disent le même mot pour mot (« Ouvre Sonde ZF pour … ») ; rien n'est écrit, la table de la corbeille n'existe pas. **L'app ouverte** les dégrise.
- **L'ordre** : la question de la table `GFS_Corbeille` passe **avant** l'appel ; refusée, l'app n'a rien reçu et la ligne reste. Accordée, l'app reçoit `supprimer { fichier: { id: '1', type: 'formulaire' }, raison: 'corbeille' }` une seule fois, puis la ligne part dans **un seul lot** (`AddRecord GFS_Corbeille`, `RemoveRecord` de la table de l'app) ; l'instantané garde l'app, la table, le fichier, le nom.
- **Les autres réponses** : `{ fait: false, dit }` (sa phrase seule, rien ne part), une erreur (la phrase de la corbeille manquée avec le texte de l'app), un appel que l'app ne connaît pas (« ne sait pas encore faire ce geste »), une app muette (GFS attend son délai, 1,5 s dans la mesure au lieu de 20 s, puis le dit) : la ligne reste, la corbeille garde une seule entrée. Un `{ fait: true }` sans phrase : la phrase de GFS seule.
- **« Dupliquer »** : l'app reçoit le fichier et **le premier nom libre** (« Enquête (1) »), écrit sa copie par le courtier de GFS ; **GFS n'écrit aucune ligne**, relit, montre la copie et lui donne le clavier. Ses refus (`{ dit }` sans `id`, une erreur, le silence, un appel inconnu) se disent comme ceux de la corbeille, sans ligne de plus.
- **Restaurer** remet la ligne à son numéro (1), avec son type et sa date ; la plus longue phrase de l'app tient dans le panneau de 700 × 400, sans être coupée.
- **La console** : aucun avertissement de GFS autre que ceux d'un geste manqué voulu.
- **Sous Firefox** : `test/composite-firefox.mjs` (menu grisé, clavier, app ouverte, corbeille sans app) passe dans un vrai Firefox 159 en français et en anglais, en clair et en sombre, aux largeurs de l'explorateur.
- **Pas mesuré** : la vraie Form+ (GFS ne déclare `appel` dans `manifestes/form.json` qu'après sa réponse), Firefox avec la vraie app, l'instance de la DINUM.

## 35. Une vue dont le graphe est dans la table : GFS rouvre Automation+ par sa table (04/11)

Suite de la section 23 (Automation+) et du contrat 7.4, point 7. La **vraie** Automation+ 0.15.0 (`597fe02`, code à `0c19c80`) range son graphe dans la ligne `Workflow` de sa table `Automation` et n'écrit plus la clé de réglages `workflow` ; le porteur a choisi le 04/11 que GFS lise cette table à l'arrivée (`arrivee` du manifeste, contrats 2.5 point 4). Joué par `labo/run-arrivee.mjs`, partie 6, dans le labo grist-static 0.1.6 (Chromium, 700 × 400, souris réelle), avec la vraie Automation+ et la vraie Publipostage+ (`6a22dee`, son `kit/` à `8afa569`), en français / clair et en anglais / sombre : 36 vérifications sur 36 dans chacune.

- **Ce que l'app écrit** (relu dans `js/store.js`, `saveGraph`, et mesuré) : à la souris, l'app demande l'accord, crée `Automation` et y range une ligne `{ Type: "Workflow", Table: "Clients" }` (`Table` : l'identifiant de la table de la vue). Les réglages de la section restent vides : aucune clé `workflow`.
- **L'arrivée** : GFS rechargé sur une section sans aucun réglage s'ouvre sur Automation+ (explorateur fermé, barre là). **Sur l'ancien contrôleur, l'explorateur s'ouvre** (deux vérifications en échec : l'arrivée, et le rétablissement de la ligne) ; les 34 autres passent.
- **Priorité** : le modèle de la vue de Publipostage+ ajouté à la section, c'est Publipostage+ qui s'ouvre, même avec la ligne `Workflow` (le réglage parle avant la table). Cela diffère de ce que disait la carte posée au porteur (« une vue de Publipostage+ sur cette table compte deux apps, l'explorateur ») : la priorité des réglages l'évite ; le porteur en est prévenu.
- **Ce qui ne désigne pas la vue** : la ligne passée à une autre table, ou au type `Log` : l'explorateur ; rétablie : Automation+. Sans la table `Automation` : l'explorateur, et GFS n'a pas créé la table pour la chercher.
- **Rien n'est écrit par l'arrivée** : le moteur ne reçoit que la ligne-sonde d'identité de GFS (`AddRecord GFS_Rangement [@sonde]`, puis `RemoveRecord`), qu'il pose à chaque démarrage quand la table du rangement existe (6.4, point 6) ; ni `AddTable`, ni écriture des réglages de la section. Les réglages et la liste des tables sont les mêmes avant et après.
- **Coût** : GFS se déclare prêt 229 à 310 ms après le chargement de son cadre, avec la lecture de la table (une ligne) comme sans (237 à 316 ms). La lecture de la table d'Automation+ grandira avec son journal (l'app n'en élague aucune ligne, `js/store.js`) : 11 à 14 ms pour 1 000 lignes mesurés le 21/10 (section 4). Pas mesuré : une table de plusieurs milliers de lignes, Firefox.
- **Constat à part, sans rapport avec l'arrivée** : à la création de sa table dans GFS, Automation+ demande une colonne `Auteur` à formule déclenchée (`user.Email`) ; Automation+ ne déclare pas la capacité `formules` (contrats 3.4, point 2), le courtier refuse (`GFS_REFUSE`, « Une colonne à formule demande la capacité « formules » »), et l'app recrée la table sans formule (`ensureTables`, store.js) : **la colonne `Auteur` du journal reste vide dans GFS**, un avertissement dans la console, aucun message pour la personne. Dans Grist seul, la formule passe. C'est le comportement prévu par l'app (« la colonne Auteur reste vide »), mesuré ici pour la première fois ; rien n'est changé avant le choix du porteur.

## 36. Grist-BI dans GFS : l'app ne démarre pas dans le sous-cadre isolé (04/11)

Grist-BI (`474d67f`, le code de `fef9af8`) est entrée au catalogue de GFS (type « Rapport BI », choix du porteur du 04/11) : sous-module `prototype/apps/bi`, manifeste provisoire `prototype/manifestes/bi.json`, `ACCEPTS_OPEN.bi` à faux. Joué par
`labo/run-bi.mjs` dans un vrai Grist (grist-static, Chromium), panneau à 700 × 400, à la vraie souris et au vrai clavier, en français et en clair (l'essai ne mesure pas l'anglais ni Firefox : c'est une ligne de plus dans la liste de l'explorateur,
avec l'icône `chart` qui suit le même trait que `form`). L'app est servie par la copie du sous-module (`live=0`) ; son site en ligne n'est pas joignable du cloud.

- **L'app non modifiée ne démarre pas dans GFS.** Le sous-cadre n'a pas d'origine (pas de `allow-same-origin`) : y lire `localStorage` lève une `SecurityError`, **`typeof localStorage` compris** (« Failed to read the 'localStorage'
  property from 'Window' : The document is sandboxed… »). `js/i18n.js:332` (`let lang = (typeof localStorage !== 'undefined' && …)`) est hors de tout `try` : le script de langue tombe, `GristBI.i18n` n'existe pas, `js/charts.js:13` et
  `js/main.js:37` échouent (« Cannot destructure property 't' of 'GristBI.i18n' as it is undefined »). L'app reste sur sa page statique, non traduite (« 0 ligne(s) »), et GFS garde « Grist-BI se charge… ». Trois autres lectures ont le même
  défaut, le `try` y suit le `typeof` : `js/i18n.js:389` (`setLang`), `js/main.js:886` et `:890` (l'auteur du commentaire).
- **Quatre lignes gardées suffisent** (essai sur la copie, jamais commité : le `typeof` entre dans le `try`). L'app démarre ; le courtier ne refuse rien (accès `full`, tables `BI_`, `_grist_Tables` et `_grist_Tables_column` en lecture, la
  capacité `formules` pour la sonde) ; aucune erreur de script. Le choix de la table « Clients » crée **trois tables sans l'accord de la personne** (`BI_Dashboard_Config`, `BI_Dashboard_Comments`, `BI_Dashboard_UserProbe` : la sonde ajoute puis
  retire une ligne) et **une ligne** de configuration, dont les seules colonnes sont `TableId` et `ConfigJSON`.
- **Les lignes d'avant dans l'explorateur** : une ligne de `BI_Dashboard_Config` est un fichier « Rapport BI » (type par défaut `rapport`, icône en barres, aucune couleur de famille), appelé « (sans nom) » : la colonne `Nom` n'existe pas, ni la
  date ni l'auteur. F2 dit « Grist-BI ne dit pas où est le nom de ses fichiers : renomme celui-ci dans Grist-BI » et n'écrit rien (la colonne est absente : jamais écrite). Le double-clic comme « Nouveau » ouvrent l'app sur sa page habituelle, GFS
  dit « Provisoire : Grist-BI ne sait pas encore… », et le document n'est pas touché.
- **Le menu « Nouveau »** propose « Rapport BI » dès que l'app est au catalogue : grisé tant qu'elle n'est pas installée (un clic ouvre la fenêtre « Apps et extensions »), dégrisé ensuite.
- **Pas mesuré** : Firefox, l'anglais, le site en ligne de l'app, l'instance de la DINUM ; l'ouverture d'un rapport précis et le suivi de la langue (l'app n'a pas le lien de GFS : consigne 007, point 3).

## 37. Enseigne à la place de Néon, et l'accessibilité renforcée : ce que le moteur, le vrai Grist et Firefox ont mesuré (04/11)

Décision du porteur le 04/11 (« le thème néon n'est pas fou… à retravailler complètement, quitte à explorer d'autres pistes ; peut-être un thème accessibilité ? »), puis ses choix sur carte (10:19) : **Enseigne** à la place de Néon, et **un réglage à part** (un interrupteur de la fenêtre « Thème »), **premier temps seulement** ; contrats 5.2 point 10, cahier 2 et 3.4. Mesuré avec `test/ambiance.test.mjs` et `test/theme.test.mjs` (Node), `labo/run-theme.mjs` dans un vrai Grist (grist-static, Chromium 153 ; quatre passes : français et anglais, clair et sombre, 700 × 400 ; 110 vérifications chacune, **aucune en échec**) et `test/interfaces-firefox.test.mjs` dans un vrai **Firefox 159** sans écran (700, 640, 520, 500 et 400 px, à 100 % et à 150 %, français et anglais, clair et sombre).

- **Le moteur** (`js/theme/ambiance.js`, sans couleur libre) : le texte le plus faible et le trait de commande le plus faible, par ambiance ordinaire : Pop 5,08 et 1,12:1 ; Papier 5,77 et 1,21 ; Brut 6,10 et 1,65 ; Enseigne 5,97 et 1,22. Les ambiances ordinaires tiennent donc 4,5:1 pour le texte mais **pas 3:1 pour le trait des commandes** (1,12 à 1,65) : c'est ce que l'interrupteur apporte. En accessibilité renforcée, sur les cinq ambiances et 169 couleurs libres (une grille de teintes, de saturations et de clartés), **le texte le plus faible est à 7,050:1 et le trait le plus faible à 3,050:1** (Pop avec `#4d66b3`) ; sans couleur libre : Grist Factory 7,06 et 3,10 ; Pop 7,05 et 3,06 ; Papier 7,07 et 3,13 ; Brut 7,10 et 3,32 ; Enseigne 7,11 et 3,06. Les limites sont 7,05 et 3,05, un peu au-dessus de 7 et de 3 pour qu'un arrondi d'affichage ne les passe pas en dessous.
- **Enseigne** (rose néon sur noir chaud ; en clair, « l'enseigne de jour » : ivoire, encre, rose profond ; capitales espacées, lueur du titre et du bouton plein, tubes de 1,5 px autour des cadres) pose **50 jetons** en ligne (19 de couleur, 31 de forme), 66 avec les 16 couleurs de type. **La lueur est du CSS de GFS** (`text-shadow` et `box-shadow` faits de `--hard`), pas un jeton : le kit 0.6.0 ne connaît que ses 37 jetons de forme et n'a pas changé ; en clair `--hard` est la couleur du fond, la lueur ne se voit pas (voulu). Chaque texte de l'explorateur et de la fenêtre y garde 4,5:1 au moins (67 textes mesurés sur les couleurs affichées, dont 16 sur un fond dégradé, aucun en échec). Les couleurs de type de l'ancienne ligne Néon, gardées pour Enseigne, tiennent le texte à 4,5:1 et l'icône à 3:1 sur ses fonds (`weakestType`).
- **L'interrupteur « Accessibilité renforcée »** : une ligne de **30 px** (une seule ligne : le texte est coupé par des points de suspension plutôt que de passer à la ligne), son nom et sa phrase (« Texte à 7:1, traits à 3:1, cadres épais, sans décor ni capitales. »), `role="switch"`. La fenêtre « Thème » tient dans 700 × 400 **sans défilement du corps** : 351 à 359 px de haut selon l'ambiance, **354 px** renforcée sur chacune des cinq (dans le vrai Grist) ; sous Firefox, 351 px éteint et 354 px allumé à 700 et 640 px, 370 et 373 px à 520 px, sans que le corps défile ; en dessous de 520 px (vue étroite, trois colonnes de vignettes), le corps défile, la fenêtre fait 388 px et la ligne reste sur une ligne. Pour y arriver il a fallu resserrer la fenêtre : une première ligne à deux lignes de texte faisait 60 px et la fenêtre débordait de 700 × 400.
- **Allumé à la souris** (un clic n'importe où sur la ligne : l'entrée `opacity: 0` couvre toute la ligne) : la page porte `data-ambiance="renforcee"` et **52 jetons** (19 de couleur, 33 de forme), aucun de type (la page prend les couleurs d'origine), `gfs.acces` est écrite à `renforcee`, ni `gfs.theme` ni `gfs.couleur` ne sont touchées, « Revenir à Grist Factory » reste grisé si l'ambiance et la couleur sont d'origine. Les cinq vignettes montrent ce que le choix donnerait avec l'interrupteur (toutes `renforcee`, fond et accent de leur ambiance). **Chaque texte de l'explorateur et de la fenêtre y garde 7:1 au moins (4,5:1 pour un grand texte) et chaque commande un trait à 3:1 au moins**, sur chacune des cinq ambiances (67 textes et 23 traits mesurés par ambiance, aucun en échec). L'audit des traits a vu, avant correction, les boutons pleins (« Fermer », « Nouveau ») à **1,31 à 2,70:1** de leur carte sur Brut et Enseigne renforcées : `--fill-line` du mode renforcé est maintenant `--border-strong`.
- **Le texte d'état et de type** (rouge, vert, ambre, bleu, orange, rouge carmin du PDF) n'est pas dans les 19 jetons et ne tient pas toujours 7:1 : en accessibilité renforcée, GFS lui donne la couleur du texte de la page (`:root[data-ambiance="renforcee"]` dans `css/gfs.css`, après les deux blocs sombres : à poids égal, le dernier gagne), la couleur reste à l'icône et le mot dit l'état ou le type. L'icône d'origine de chaque type tient 3:1 sur les fonds de chaque ambiance renforcée et de toute couleur libre (`test/ambiance.test.mjs`).
- **Le clavier**, mesuré dans le vrai Grist : Tab depuis la vignette choisie passe par la couleur, son bouton, **l'interrupteur**, « Revenir à Grist Factory » et la fermeture, puis reboucle ; l'interrupteur montre un anneau de focus de 2 px ; Espace l'éteint (la page reprend l'ambiance choisie, Enseigne, avec son décor ; `gfs.acces` disparaît ; le clavier reste sur l'interrupteur) et le rallume. **Sous Firefox sans écran, ni l'anneau ni Espace ne se jouent** : `document.hasFocus()` y reste faux, donc `:focus-visible` ne s'applique à rien et Espace n'active pas une case (comme pour un bouton : faits vérifiés 11 et `labo/LISEZ-MOI.md`) ; Tab y arrive bien (trois arrêts depuis la vignette) et la souris allume puis éteint. Ces deux gestes restent à la mesure du labo (Chromium) et au Firefox du porteur.
- **Les apps** : l'app ouverte reçoit, à l'allumage, `id` `renforcee` (19 jetons par mode, 33 de forme, aucune couleur libre) sans événement de plus qu'un seul par geste ; à l'extinction, l'ambiance choisie (Enseigne, 31 de forme) ; au rallumage, `renforcee` ; GFS ne touche pas à son cadre. « Revenir à Grist Factory » défait l'ambiance, **laisse l'accessibilité** (l'interrupteur reste allumé, `gfs.acces` reste) et l'app reste en `renforcee`. Rechargé, GFS repart en accessibilité renforcée, posée dès le départ ; éteint, la page n'a plus rien de posé et les trois clés ont disparu. Le kit 0.6.0 prend ce message tel quel (`test/theme.test.mjs`, `normalizeAmbiance`).
- **Une ancienne clé** : `gfs.theme` à `neon` (choisi la veille) se lit `enseigne` et n'est réécrite qu'au prochain choix ; une clé qui n'a jamais existé reste absente.
- **Sous Firefox** (vrai Firefox 159) : la ligne de l'interrupteur mesure au plus 34 px à toute largeur, le rôle est `switch`, trois Tab y arrivent, un clic l'allume (la page prend `renforcee`) puis un second l'éteint ; la page renforcée garde ses lignes à 28 px, son contenu dans la ligne, ses traits et cadres de 2 px, et n'a ni capitales, ni lueur, ni ombre, ni trame, ni filet ; Enseigne a ses capitales espacées et la lueur de son titre ; la fenêtre « Thème », peinte par chacun de ces choix, tient dans la page.
- **Pas mesuré** : le Firefox du porteur au vrai clavier (anneau de focus, Espace) ; l'instance de la DINUM ; les vraies apps (Publipostage+, Form+, Automation+…) en accessibilité renforcée : elles reçoivent les mêmes jetons, mais leurs propres couleurs d'état restent les leurs ; le second temps (cibles de 36 px, texte de 14 px, anneau de focus de 3 px à deux couleurs, mouvement réduit, contraste forcé, barre de sélection en vrai trait), qui attendait le feu vert du porteur : livré et mesuré le 10/11 (fait 81).

## 38. Glisser-déposer dans l'explorateur : ce que Chromium dans un vrai Grist et Firefox ont mesuré (04/11)

Demande du porteur : déposer des fichiers dans des dossiers, en amont comme en aval (contrats 6.4, point 12). Joué par `labo/run-glisser-explorateur.mjs` dans un **vrai Grist** (grist-static, Chromium), à 700 × 400, **à la vraie souris** (le bouton appuyé, la souris tirée de pas en pas, le bouton relâché : le navigateur lance lui-même le glissement HTML5), en français clair et en anglais sombre (30 vérifications dans chacune, aucune en échec), avec la sonde ZF (trois fichiers) et des dossiers créés par « Nouveau dossier ».

- **En aval** : un fichier tiré sur un **dossier de la liste** puis sur un **dossier du volet** est déplacé (une ligne de `GFS_Rangement`, plus à la racine, la phrase « … est déplacé dans « Contrats » » mot pour mot) ; pendant le glissement, **seule la cible s'éclaire** et la ligne tenue s'efface. Un dossier fermé du volet **survolé 1,2 s s'ouvre** et son sous-dossier (« Archives/2025 ») devient une cible qui s'éclaire à son tour et reçoit le fichier.
- **En amont** : le fil d'Ariane (« Moi », puis un ancêtre : depuis « Archives/2025 », « Archives ») et la racine du volet acceptent le fichier ; la phrase dit « Moi » pour la racine.
- **Un dossier** se tient comme un fichier : « Archives », avec son fichier et son sous-dossier gardé, va dans « Contrats » (les lignes d'état des dossiers suivent, y compris celle de « Archives » elle-même). En **vignettes**, la vignette du dossier s'éclaire et reçoit le fichier.
- **Ce qui ne s'accepte pas** : le dossier où est déjà le fichier, un dossier sur lui-même, un dossier dans son sous-dossier : rien ne s'éclaire, aucune écriture (le journal des actions de Grist ne bouge pas), rien ne reste éclairé ni effacé. **À la corbeille, aucune ligne ne se tient.**
- **La première fois**, la table du rangement n'existe pas : « Nouveau dossier » demande l'accord pour la créer (celui des dossiers, 6.4 point 11) ; le glisser-déposer lui-même n'écrit que la ligne du fichier.
- **Aucun avertissement de GFS** en console.
- **Sous Firefox 159 sans écran** (`test/glisser-firefox.mjs`, en français et en anglais, en clair et en sombre) : les lignes se tiennent (`draggable`), pas à la corbeille ; le glissement **part** (`dragstart`), le dossier qui accepterait la ligne **s'éclaire et annule le survol**, celui de la ligne ne s'éclaire pas et n'annule rien ; la ligne tenue s'efface. **Le dépôt n'aboutit pas au banc** : comme pour le calendrier du kit (section 25), `drop` et `dragend` ne viennent jamais après le lâcher.
- **Mesuré aussi en Node** (`test/explorer-drag.test.mjs`, `test/explorer-clipboard.test.mjs`) : ce qui s'accepte (dossier de la ligne, soi-même, sous-dossier, parent), ce qui s'éclaire, un seul déplacement par dépôt, un glissement venu d'ailleurs refusé, le minuteur d'ouverture du volet.
- **Pas mesuré** : le dépôt sous Firefox à la vraie souris (chez le porteur), un glissement parti de « Récents » ou de « Favoris » (le code l'accepte, essai en Node seulement), le tactile, l'instance de la DINUM.

## 39. La case « + pièces jointes » de l'explorateur : ce que le vrai serveur et Firefox ont mesuré (04/11)

Lot 2 du poids (section 32 pour le lot 1) : le total du pied de fenêtre peut prendre **les pièces jointes du document que nul fichier de l'explorateur ne cite** (les photos d'une table de l'utilisateur, par exemple). Joué par `labo/run-poids.mjs` (sa passe 6) dans un **vrai serveur Grist 1.7.19** (Docker), panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre (38 vérifications dans chacune des quatre, aucune en échec, Chromium 153) ; avec `test/pieces-jointes-firefox.mjs` dans un vrai Firefox 159 sans écran (aux six largeurs, à 100 % et à 150 %, en clair et en sombre, en français et en anglais) ; et `test/weight.test.mjs` (`otherAttachments`).

- **Ce que Grist compte, lu dans son code (`DocStorage.js`, `ActiveDoc.js` de l'image 1.7.19) puis mesuré** : une pièce par `fileIdent` distinct (le même contenu envoyé deux fois, sous deux noms, donne **deux lignes de `_grist_Attachments` et une seule empreinte** : lignes 4 et 5 de l'essai), sans les lignes dont `timeDeleted` n'est pas vide, à la plus grande des tailles de leurs lignes. Le contenu d'un PDF de GFS envoyé de nouveau dans une table de l'utilisateur **partage l'empreinte** de la pièce du PDF de GFS (lignes 3 et 8) : Grist ne le stocke qu'une fois.
- **Ce que la case ajoute** : les `fileIdent` vivants qu'aucun fichier de l'explorateur ne cite, **fichiers à la corbeille compris** (la corbeille garde leur pièce : un PDF mis à la corbeille ne devient pas « autre », le total des « autres » ne bouge pas). Ce n'est pas la vue : la case ajoute la même somme au dossier ouvert, à une recherche ou à la corbeille. Mesuré : l'essai envoie six pièces (une photo de 200 000 octets envoyée deux fois, 350 000, 90 000, le contenu du PDF « Rapport » et une pièce de 120 000 octets citée puis plus citée) ;
  **SQL (la formule de Grist) dit 4 pièces et 760 000 octets, la case dit « 2,5 Mo » pour une liste de « 1,7 Mo »** (1 830 432 + 760 000 = 2 590 432 o), et son infobulle « 1,7 Mo pour la liste + 742 Ko pour 4 pièces jointes du document. » ; décochée, le total revient à celui de la liste ; **rien n'est écrit dans le document** (aucune table de plus, la table des pièces jointes inchangée).
- **Une pièce que plus aucune cellule ne cite compte encore, pour Grist comme pour la case**, jusqu'au passage de Grist : il marque `timeDeleted` **toutes les heures** (`REMOVE_UNUSED_ATTACHMENTS_DELAY` : 60 min ± 30 s, `Interval` d'`ActiveDoc`) ou quand un propriétaire le demande (`POST /api/docs/<id>/attachments/removeUnused?expiredonly=true`, avec `X-Requested-With`), puis efface la pièce du fichier **sept jours plus tard** (`ATTACHMENTS_EXPIRY_DAYS`). Mesuré : avant le passage, la pièce de 120 000 octets comptait (SQL : 4 pièces, 760 000 o ; la case : 2,5 Mo) ;
  après, SQL dit 3 pièces et 640 000 o, et la case, décochée puis recochée, relit et le dit. **Corrige** une note du matin du 04/11 (« une pièce non référencée sort du compte en une minute environ »), fausse : l'essai attendait 240 s sans voir `timeDeleted` changer.
- **La lecture** : `fetchTable('_grist_Attachments')` par le port de GFS (accès complet), **seulement quand la case est cochée** ; relue à chaque relecture des fichiers tant qu'elle est cochée, jetée quand on la décoche. **40 à 73 ms pour 9 lignes, 86 à 128 ms pour 3 009 lignes** (toutes les mesures, quatre passes). Un refus de Grist (pas d'accès complet, lecture qui échoue) décoche la case et la **grise** (`aria-disabled`, jamais `disabled`) avec la raison en infobulle ; son clic redit la raison en une phrase, sans relire. Le grisé n'est mesuré que sous Firefox, sur une doublure de la table.
- **Le pied de fenêtre** : le total, la case et « Ouvrir » / « Fermer » ne se recouvrent pas et ne sont pas coupés, **à 700 px la hauteur du pied ne change pas (57 px) case cochée**, aux six largeurs sous Firefox. **Sous 520 px, le total passe au-dessus de la case** (le pied devient une grille) ; la barre d'information y est plus courte (121 px à 400 px, contre 64 px avant) mais entière. Le texte de la case et du total atteint 4,5:1, en clair et en sombre.
- **Le clavier (Chromium, vrai clavier)** : la case est un arrêt de Tab **juste avant « Ouvrir »** (Maj+Tab depuis « Ouvrir » y arrive, Tab va à « Ouvrir » puis « Fermer »), son anneau de focus est le trait de 2 px de la charte, **Espace la coche et elle garde le focus** (le pied n'est pas reconstruit). Le Firefox sans écran n'active pas une case à Espace et n'a pas le focus du système (`document.hasFocus()` est faux : `:focus-visible` ne s'applique jamais) : sous Firefox, la souris et l'ordre des arrêts de Tab se mesurent, pas l'anneau ni Espace (comme `conflictProblems`).
- **Un défaut trouvé par l'essai et corrigé avant le push** : le total du pied se lisait « Total : 1,7 Monull » — la liste d'éléments du pied contenait un `null`, que `replaceChildren` écrit en toutes lettres — c'est le texte que lit un lecteur d'écran ; le chiffre affiché, lui, était juste. Les mesures sous Firefox lisaient le seul chiffre. **Les deux essais lisent maintenant tout le texte du total** (`Total : 1,7 Mo` décochée, `Total : 2,5 Mo, 1,7 Mo pour la liste + 742 Ko pour 4 pièces jointes du document.` cochée), et l'ancien code échoue (`Total : 18,1 Monull` sous Firefox).
- **Pas mesuré** : une seconde personne sur un document à règles d'accès (la lecture de `_grist_Attachments` peut être refusée : le grisé existe, il n'a pas été vu dans un vrai Grist) ; l'instance de la DINUM ; un document de dizaines de milliers de pièces ; le Firefox du porteur (un Firefox 159 sans écran, sans l'anneau de focus ni Espace) ; les pièces jointes que **cite une ligne d'app** (une pièce citée par une table d'app et non déclarée au manifeste compte comme « autre », c'est voulu : le manifeste ne dit pas qu'elle appartient à un fichier).

## 40. Les droits lus par GFS : qui est propriétaire, et qui lit les règles (mesuré le 04/11)

Étape 6 du plan (contrats 5.2 point 8, 11.4 point 7, 11.9 point 8). Joué dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) avec trois comptes : le serveur d'essai ne connaît qu'une personne à la fois
(`GRIST_DEFAULT_EMAIL`), on le relance entre les temps (propriétaire `essai@`, éditeur `editor@`, lecteur `viewer@`, tous trois dans le même document). Sonde brute : `labo/droits/` (`labo/run-droits-reel.mjs`) ; GFS entier :
`labo/run-droits.mjs` (`PHASE=proprietaire`, `editeur`, `lecteur`), panneau à 700 × 400, souris et clavier réels.

- **Une preuve de propriétaire qui marche** : `GET /api/docs/<id>/webhooks?auth=<jeton>` avec le jeton du widget **qui peut écrire** (`getAccessToken({ readOnly: false })`) rend **200** au propriétaire et **403 « No owner access »** à un
  éditeur comme à un lecteur, document sans règle comme document avec règles. Avec le jeton **en lecture seule**, le même appel est refusé à tous (403, propriétaire compris) : il faut celui qui peut écrire. `GET /timing` se
  comporte pareil. GFS ne lit que le code de la réponse (le corps liste les webhooks du document) : c'est une opération de plus du cadre d'envoi (`status`, `transfer/transfer.js`).
- **Ce qui ne prouve rien** : `GET /api/docs/<id>` et `/access` avec le jeton du widget : **403 « access denied »** pour tous, propriétaire compris (la liste des utilisateurs du document n'est donc pas à la portée d'un widget) ; `/sql` :
  200 pour tout le monde dans un document sans règle, 403 pour un éditeur dès qu'une règle existe ; `/usersForViewAs` : 403 pour tous avec ce jeton.
- **Un document neuf a déjà une règle** : `_grist_ACLRules` porte une ligne (ressource 1, `permissions` 63, `principals` `[1]`, aucune condition) et `_grist_ACLResources` une ligne (`tableId` et `colIds` vides) : « tout le monde peut
  tout ». Ce n'est pas une règle de la personne (`js/rights/rights.js`, `userRules`). Une règle ajoutée par action (`AddRecord` dans les deux tables, dans un seul lot) est prise telle quelle ; son texte de droits va dans `permissionsText`.
- **Qui lit les tables de règles** (trois documents, un éditeur ; puis un lecteur dont le widget a l'accès complet) : tant qu'**aucune règle ne refuse la lecture d'une table** (une règle `-C`, `-U` ou `-S` seule), l'éditeur et le lecteur
  lisent `_grist_ACLRules`, `_grist_ACLResources` et `_grist_Shares`, **la clé de chaque lien (`linkId`) comprise**, comme le propriétaire. Dès qu'une règle refuse la **lecture** d'une table à une personne (`-R`, ou `-CRUD` comme
  l'Encadré de 11.4), les deux tables de règles lui arrivent **vides**, la table disparaît de sa liste de tables (REST) et sa ligne de `_grist_Tables` n'a plus de nom ; `/sql` lui est refusé. C'est le cas du niveau Encadré : un
  éditeur n'y lit rien, et une lecture vide ne veut pas dire « aucune règle » (`contrats` 11.4, point 7 : le mot du pied ne se dit qu'à un propriétaire prouvé).
- **Ce que GFS en fait** (codé, `js/rights/rights.js`, `js/rights/rights-reader.js`, `js/rights/rights-control.js`, `js/rights/rights-window.js`) : un propriétaire prouvé voit le mot du pied (« Pas protégé » sans règle, « Protégé » avec l'Encadré partout et la structure
  fermée, posés ici par action comme le fera l'étape 7), le panneau (tables de GFS et d'app avec leur niveau, la structure, les liens publics) et le rôle `proprietaire: true` donné à une app (la sonde V de `labo/sondes/`) ; un éditeur et un lecteur
  voient « Permissions » au pied, le panneau dit « seul un propriétaire peut vérifier les règles », cache les tables et les liens, et l'app reçoit `proprietaire: false`. **La clé d'un lien n'apparaît nulle part dans la page de GFS** (vérifié sur le
  texte de la page entière). Un partage posé par action (une page partagée, une section `publish` et `form`, un champ caché) est listé avec sa page, sa table, son nombre de lignes et la colonne qu'il remplit sans la montrer.
- **Joué** : `labo/run-droits.mjs`, français en clair puis anglais en sombre, propriétaire (13 vérifications), éditeur (6), lecteur (6), sans échec ; le panneau tient dans le 700 × 400, ses textes ont le contraste voulu (4,5:1), la
  console de GFS est muette. Sous **Firefox 159** (`test/interfaces-firefox.test.mjs`, `test/droits-firefox.mjs`) : le mot du pied et le panneau, quatre états, en français et en anglais, en clair et en sombre à 700 px : le mot tient dans le pied, le
  panneau tient dans la page, son titre et son bouton restent en place, le clavier est sur « Fermer », Tab reste dedans, Échap le ferme, la souris l'ouvre et le ferme. Un premier essai a cassé la mesure de la corbeille (elle lit le premier bouton
  du pied) : le mot a sa propre boîte.
- **Correction du 06/11** : dans cet essai, la règle de structure fermée avait été posée par action sur la ressource vide que Grist crée avec un document neuf ; elle ne ferme rien dans un vrai Grist (la bonne ressource est `*` / `*`, section 44). La lecture de GFS et le mot du pied tenaient (ils lisent les deux), le labo pose maintenant la règle au bon endroit.
- **Pas mesuré** : l'instance de la DINUM (version de Grist inconnue : si elle cachait déjà les règles dans un cas de plus, le mot du pied dirait « Permissions », jamais un faux « Protégé »), Firefox avec un vrai Grist, un formulaire
  publié par l'interface de Grist (le partage de l'essai est posé par action : GFS lit bien les tables de Grist, mais ce n'est pas l'interface de Grist qui les a remplies), les adresses statiques de Form+ (`#form=`), un éditeur qui **ajoute lui-même** un widget en accès complet
  (il lirait alors les clés des liens tant qu'aucune règle ne lui ferme une table : à mesurer avant la carte sur la structure fermée), les espaces (étape 7).

## 41. Les versions d'un modèle comptent avec le modèle : ce que le vrai serveur a mesuré (04/11)

Lot 3 du poids (sections 32 et 39 pour les lots 1 et 2) : un fichier d'app peut compter **les lignes d'une autre table qui le suivent par une clé** (`poids.liees`, contrats 2.4). Publipostage+ en a une : les versions d'un modèle, `Publipostage_Versions`, rangées par `Jeton`. Joué par `labo/run-poids.mjs` (sa passe 7) dans un **vrai serveur Grist 1.7.19** (Docker), panneau à 700 × 400, souris et clavier réels, en français clair, français sombre, anglais clair et anglais sombre (47 vérifications dans chacune des quatre, aucune en échec, Chromium 153), avec la table aux colonnes que crée `js/versions-store.js` de la vraie Publipostage+ (`Jeton`, `Date`, `Auteur`, `Nom`, `Genre`, `Donnees`, des textes de la taille de ses états compressés) ; et `test/weight.test.mjs`, `test/explorer-data.test.mjs`, `test/manifest.test.mjs`.

- **Ce que le poids d'un modèle devient** : sa ligne plus les octets de toutes les lignes de `Publipostage_Versions` dont `Jeton` est le sien. Mesuré : « Modèle lourd 1 » (586 Ko de ligne) et ses quatre versions de 120 000 signes disent **« 1,0 Mo »**, « Contrat de prestation » (62 o) et ses trois versions de 2 000 signes **« 6 Ko »** ; le total du pied passe de « 1,7 Mo » à « 2,2 Mo » ; le dossier somme les modèles avec leurs versions. Les 110 000 octets de versions dont le jeton ne désigne aucun modèle (deux « orphelines ») ou est vide ne sont à personne : sur 596 227 octets dans la table, 486 154 sont rattachés. Une clé vide ne rattache rien (c'est ce qui fait qu'une copie, qui a un jeton vide, ne compte aucune version).
- **L'estimation face à SQLite (`dbstat`)** : la table des versions est estimée à 596 227 octets pour 597 075 d'exacts, **−0,1 %**, jamais au-dessus (les mêmes gros textes que les modèles, section 32).
- **La copie et la corbeille** : la copie d'un modèle de 600 000 signes a un jeton vide et pèse sa ligne seule (586 Ko) ; le modèle mis à la corbeille pèse la ligne de `GFS_Corbeille` (586 Ko) et **ses quatre versions restent dans leur table** ; remis, il retrouve « 1,0 Mo » (tant que l'app n'a pas purgé ses versions comme orphelines : contrats 6.7, point 6, non changé).
- **Le coût de lire la table** : GFS lit `Publipostage_Versions` en entier à chaque ouverture de l'explorateur et à chaque relecture (`fetchTable`, une fois par déclaration, jamais une lecture par fichier). Avec 35 versions, **3,0 Mo** (le plafond de Publipostage+ : 3 millions de signes pour tout le document), l'ouverture de l'explorateur (rechargement du cadre, liste entière pesée) a pris, quatre passes : sans la table 921 et 1 126, 903 et 926, 572 et 1 034, 921 et 1 129 ms ; avec elle 1 250 et 1 294, 854 et 855, 665 et 1 267, 637 et 668 ms, soit **+249, −60, +163 et −372 ms : dans le bruit** (une ouverture dure environ une seconde, le cadre étant rechargé à chaque fois). Une table liée absente ne coûte aucune lecture ; illisible, elle ne compte rien et la console l'avertit (essai unitaire).
- **Un défaut du labo, pas de GFS** : après un rechargement du cadre de GFS (`location.reload()`), Chromium rend la même violation de politique que d'habitude (« Applying inline style violates… », la feuille de thème que pose `grist-plugin-api.js`, lignes 26980 et 27006 de la 1.7.19) **sans l'adresse du script**, et le filtre des messages connus de `labo/lab-pdf.mjs` ne la reconnaissait plus : il accepte maintenant le même message sans adresse (`^:ligne`), jamais un message qui nomme un fichier de GFS.
- **Pas mesuré** : l'instance de la DINUM ; un document dont les versions ont été gardées par la vraie Publipostage+ en usage (l'essai les a écrites par l'API de Grist, avec des textes en base64 de la taille de ses états : un état compressé fait environ 0,3 fois le modèle) ; Firefox avec la vraie app ; Form+ (ses réponses vont dans des tables que la personne choisit : aucun lien fixe à déclarer, carte de décision posée au porteur) ; la fenêtre « Poids du document » (lot 4).

## 42. Ctrl+Z et Ctrl+Y dans l'explorateur : ce que le vrai Grist et Firefox ont mesuré (04/11)

Demande du porteur : « Ctrl+Z doit aussi faire revenir un fichier supprimé, et plus globalement toutes les modifications (renommage, déplacement, etc.) » (contrats 6.4, point 13) ; à sa carte, il a choisi le rétablissement **au clavier seulement** (Ctrl+Y et Ctrl+Maj+Z, aucun bouton). Joué par `labo/run-annuler.mjs` dans un **vrai Grist** (grist-static, Chromium), à 700 × 400, **au vrai clavier**, en français clair et en anglais sombre (42 vérifications dans chacune, aucune en échec), avec la sonde ZF (trois formulaires, qui répond aux appels `supprimer` et `dupliquer` comme le fera Form+).

- **Mettre à la corbeille puis Ctrl+Z** : la ligne revient **à son numéro** (la ligne 1), avec son type et sa date ; la corbeille est vide ; la liste la montre ; la phrase est celle de la restauration, mot pour mot. **Un second Ctrl+Z dit « Rien à annuler »** : la restauration que fait l'annulation ne retourne pas dans la pile des gestes à défaire, elle va dans celle du rétablissement (pas de va-et-vient).
- **Renommer, épingler, créer un dossier, déplacer (Ctrl+X puis Ctrl+V), supprimer un dossier** : chacun se défait d'un Ctrl+Z, écrit dans le document (le nom d'avant, l'étoile éteinte, le dossier retiré des dossiers gardés, le fichier de nouveau à la racine, le dossier revenu avec sa ligne d'état) et dit ce qui est revenu (« Annulé : … »).
- **Un geste par appui, dans l'ordre inverse** : épingler, renommer puis mettre à la corbeille, et trois Ctrl+Z défont d'abord la suppression, puis le nom, puis l'étoile ; le quatrième dit « Rien à annuler ». Une pile qui garde un geste d'avant (un dossier créé) le défait à son tour : c'est le dernier d'abord.
- **Copier-coller puis Ctrl+Z** : **la copie, et elle seule**, part à la corbeille ; GFS appelle l'app (`supprimer`) et la phrase de l'app s'ajoute à celle de la corbeille.
- **Supprimer pour de bon ne s'annule pas** : le Ctrl+Z d'une mise à la corbeille dont l'entrée a été supprimée pour de bon, puis celui de la copie qui l'a précédée, disent « n'est plus là » et **n'écrivent rien** ; la pile se vide.
- **Rétablir : Ctrl+Y et Ctrl+Maj+Z** (⌘+Maj+Z sur Mac), **un cran par appui**, **aucun bouton** : la pile garde ce que Ctrl+Z vient de défaire. Ctrl+Z puis Ctrl+Y rend la ligne restaurée **à son numéro** (le 3, mêmes valeurs) avec la phrase de la restauration, mot pour mot ; Ctrl+Z puis Ctrl+Y **tournent sans se perdre** (Ctrl+Z remet « Bilan » à la corbeille, l'app est appelée ; Ctrl+Y le ressort) ; **un Ctrl+Y de plus dit « Rien à rétablir »** et n'écrit rien ; le renommage se refait (« Rétabli : … ») puis se défait de nouveau ; **Ctrl+Maj+Z refait un déplacement** (le fichier retourne dans son dossier). **Un geste neuf vide le rétablissement** : une étoile posée après un Ctrl+Z, Ctrl+Y dit « Rien à rétablir » et le fichier garde son nom d'avant.
- **Dans la recherche**, Ctrl+Z (et Ctrl+Y) reste celui du texte : la suppression n'est pas défaite (Chromium annule la frappe).
- **L'app fermée** : après une restauration à la main, une autre app prend la place ; Ctrl+Z (remettre à la corbeille, qui attend l'app, contrats 2.4 `appel`) dit d'ouvrir l'app, n'écrit rien, **garde le geste** ; l'app rouverte, le même Ctrl+Z met le formulaire à la corbeille. **Restaurer, lui, n'a pas besoin de l'app** (essai sous Firefox, `test/annuler-firefox.mjs`).
- **Aucun avertissement de GFS** en console.
- **Sous Firefox 159 sans écran** (`test/annuler-firefox.mjs`, en français et en anglais, en clair et en sombre, avec le vrai `Trash`, le vrai `Copying` et le vrai `Filing` qui partagent une pile) : Suppr puis Ctrl+Z, restaurer puis Ctrl+Z, copier-coller puis Ctrl+Z, deux suppressions défaites une par appui dans l'ordre inverse puis « Rien à annuler », la recherche qui garde son Ctrl+Z, **Ctrl+Y et Ctrl+Maj+Z qui rétablissent** (un cran par appui, la recherche garde les siens, un geste neuf vide le rétablissement), le fichier composite (remettre à la corbeille attend l'app, restaurer non, rétablir la mise à la corbeille attend l'app), le choix d'un fichier (la phrase dit que c'est indisponible). L'essai **échoue sans la liaison de la touche** (vérifié en la retirant).
- **Mesuré aussi en Node** (`test/undo-stack.test.mjs`, `test/explorer-undo.test.mjs`, `test/filing.test.mjs`, `test/explorer-keys.test.mjs`) : l'ordre, la limite de 50 dans chaque pile, l'appui ignoré pendant l'écriture, le geste qui reste (`again`), l'entrée la plus récente de la corbeille, un fichier qui a changé ou qui n'est plus là, un nom pris, la lecture seule.
- **Limite dite** : un nom n'est remis que si le fichier porte encore le nom que le geste lui avait donné (sinon « a changé depuis », rien n'est écrit) ; **le rangement (dossier, étoile) est remis tel qu'il était avant le geste, sans chercher si une autre personne l'a changé depuis** (la ligne d'un fichier supprimé pour de bon depuis est ignorée par la lecture).
- **Pas mesuré** : Ctrl+Z à deux personnes en même temps, la limite de 50 gestes à la main, le clavier Mac (⌘+Z et ⌘+Maj+Z : essai en Node seulement), le tactile, l'instance de la DINUM.

## 43. La fenêtre « Poids du document » : ce que le vrai serveur a mesuré, à trois comptes (04/11)

Lot 4 du poids (sections 32, 39 et 41 pour les lots 1 à 3) : un clic sur le total du pied de l'explorateur ouvre une fenêtre qui lit **le poids exact dans la base du document** (contrats 2.4, point 5 ; 6.6, point 14). Joué par `labo/run-poids-fenetre.mjs` dans un **vrai serveur Grist 1.7.19** (Docker), sous **trois comptes** (la personne d'essai, un éditeur, un lecteur, le même document, le serveur relancé sous chaque compte), panneau à 700 × 400, souris et clavier réels, en français clair et en anglais sombre (Chromium 153 ; 63 vérifications dans chacune des deux, aucune en échec) ; `test/weight-reader.test.mjs`, `test/transfer.test.mjs` et `test/transfer-frame.test.mjs` (Node) ; `test/poids-fenetre-firefox.mjs` (Firefox 159 sans écran, à 700 px, en clair et en sombre, avec un faux `/sql`).

- **Grist coupe toute lecture de plus d'une seconde** : `GET /sql` rend alors 400 (« a slow statement resulted in a database interrupt ») et **le document ne répond plus à rien d'autre pendant ce temps**. Le poids de toutes les tables d'un coup (`dbstat` sans nom) est donc interdit : chaque table se lit seule, l'une après l'autre (`dbstat` avec `name = '<table>'` : environ 150 ms pour 461 Mo). Les autres lectures sont courtes : le fichier entier (`page_count × page_size`, 6 ms sur 1,9 Go), l'historique (`SUM(LENGTH(body))` de `_gristsys_ActionHistory`, 10 ms sur 922 Mo), les pièces jointes stockées (`_gristsys_Files`) et comptées comme le fait Grist.
- **Ce que la fenêtre dit, face à `/sql` lu par la session de la page de Grist** (autre chemin, mêmes requêtes) : fichier 8 990 720 o, historique 6 696 541 o, pièces jointes stockées 550 000 o et comptées 550 000 o (celles de `_grist_Attachments`, une par empreinte, sans les supprimées), tables 1 531 230 o (à moins de 10 % de la formule de données de Grist, qui compte aussi ses tables internes), **reste 212 949 o** (pages libres, index, tables internes : jamais négatif). Cinq tables, du plus lourd au plus léger ; la lecture entière (quatre lectures, la liste des tables, puis une par table) prend **de 617 à 744 ms** de l'ouverture à la dernière ligne.
- **Qui lit quoi** : sans règle d'accès, **le propriétaire, l'éditeur et le lecteur lisent tout** (jeton en lecture seule). Avec une règle (`user.Access != OWNER`, `-CRUD`), **`/sql` est refusé (403) à l'éditeur et au lecteur, avec les deux jetons**, et la fenêtre le sait en 130 à 155 ms (deux lectures : le jeton en lecture seule, puis celui qui peut écrire) ; elle se grise avec sa raison, les cinq lignes disent « — », aucune table n'est listée, l'estimation reste.
- **Un trou trouvé à la mesure, corrigé** : dans un document à règles d'accès, **le propriétaire lui-même est refusé (403) avec le jeton en lecture seule**, alors que sa propre session lit `/sql` sans peine ; le jeton **qui peut écrire** (`getAccessToken({ readOnly: false })`) rend 200 au propriétaire et 403 à l'éditeur et au lecteur (même constat que pour `/webhooks`, section 40). GFS lit donc en lecture seule d'abord et ne passe au jeton qui peut écrire qu'**après un refus**, pour le reste de cette ouverture (`escalating`, essais en Node : un refus coûte un essai, une seule fois ; sans règle, le jeton qui peut écrire n'est jamais demandé ; une lecture coupée n'en change pas). Mesuré : le propriétaire d'un document à règles lit tout.
- **Un défaut de la première version, trouvé par le labo** : le texte grisé (opacité .55) tombait à **3,64:1** de contraste ; il prend maintenant `--text-muted`.
- **Le clavier et le focus** : « Fermer » a le focus à l'ouverture, Tab reste dans la fenêtre, Échap la ferme et le focus revient sur le total (qui est un bouton, `aria-haspopup="dialog"`).
- **Aucune erreur ni avertissement de GFS en console** ; les seuls messages sont ceux que le navigateur écrit seul pour les 403 attendus (permis dans les passes « refusé »).
- **Un défaut trouvé par l'essai Node** : une table était encore lue après la fermeture de la fenêtre ; la lecture s'arrête maintenant avant chaque table.
- **Un défaut des essais, pas de GFS** : le total du pied est un bouton, et les essais qui prenaient « le premier bouton du pied » prenaient le total (`.ex-foot > .btn` maintenant).
- **Pas de « x % de 15 Go »** : le total du site n'est pas lisible depuis un widget, et ce que compte la limite (les pièces jointes de tous les documents, ou les fichiers entiers) n'est pas connu. La fenêtre donne les deux chiffres (fichier entier et pièces jointes comptées).
- **Pas mesuré** : l'instance de la DINUM ; un document de plusieurs Go (la lecture d'une table de plus d'une seconde dit « trop longue » ligne par ligne, essai Node seulement) ; Firefox avec un vrai Grist (le labo n'a que Chromium : Firefox joue la fenêtre sans Grist) ; Form+ (rien de plus à compter dans le poids d'un formulaire, carte de décision posée au porteur).

## 44. Poser et retirer des règles depuis le panneau « Permissions » : ce que le vrai Grist a mesuré (06/11)

Étape 7, lot a (contrats 11.4 points 2 et 5, 11.5 point 9). Joué dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`), trois comptes (propriétaire, éditeur), à 700 × 400, à la vraie souris : `labo/run-poser.mjs` (`PHASE=proprietaire`, `editeur`, `retrait`) ; le panneau sous Firefox 159 dans `test/droits-firefox.mjs`.

- **Une liasse suffit, et Grist recharge la page** : `AddRecord` dans `_grist_ACLResources` puis `BulkAddRecord` dans `_grist_ACLRules` (identifiants et `rulePos` choisis) passent en une `applyUserActions` depuis le cadre de GFS ouvert par un propriétaire. Grist recharge alors la page, GFS rouvre le panneau tout seul (clé `gfs.reprise` du navigateur) et les six règles de Partagé sont relues comme les siennes (note « GFS : Partagé · … »).
- **Piège trouvé par l'essai** : la ressource que Grist crée avec un document neuf (`tableId` et `colIds` vides) **n'est pas celle qui ferme la structure**. Une règle `user.Access != OWNER` → `-S` posée dessus laisse l'éditeur ajouter une table, une colonne, une page, renommer une table (mesuré : tout passe, y compris `AddTable` par l'API). Posée sur la ressource **`*` / `*`** (« toutes les tables », celle que l'interface de Grist écrit), tout est refusé : « Blocked by table structure access rules ». GFS écrit donc sur `*` / `*` (la crée au besoin) et lit les deux formes. Le premier essai de l'étape 6 (§40) avait posé la règle sur la ressource vide : l'état « Protégé » qu'il affichait ne reposait que sur la lecture de GFS, pas sur un verrou réel ; corrigé (`labo/run-droits.mjs` pose maintenant sur `*` / `*`).
- **Position des règles** : Grist renumérote `rulePos` à 1, 2… dans l'ordre reçu ; la règle de Grist de la ressource vide reste sans position (vide, donc en dernier). Une règle `-S` seule sur `*` / `*` ne rend aucune table « Règles de Grist » : GFS l'écarte du calcul du niveau d'une table.
- **L'éditeur, Partagé posé et structure fermée** : il ne lit que sa ligne et celles de `@document` ; il change son propre rangement (200) ; il ne crée pas de ligne au nom d'un autre (403 « Blocked by row create access rules ») ; il ne peut ni ajouter une table, ni ajouter ou supprimer une colonne, ni renommer une table, ni ajouter une page (403 « Blocked by table structure access rules ») ; il ne télécharge plus le document entier (403 « not authorized to download this document »), dès la première règle, comme annoncé en 11.4 point 6. Les **notes des règles** (« GFS : Partagé · … », « GFS : Structure fermée · … ») arrivent **dans le refus** (`details.memos`), ce qui permet à GFS et aux apps d'expliquer qui refuse et pourquoi.
- **La ligne-sonde passe sous Partagé** quand la colonne `Adresse` porte la formule déclenchée de GFS (`COLUMNS` de `js/files/rangement.js`) ; avec une colonne `Adresse` sans formule (premier essai du labo), la création est refusée : « l'adresse de la personne n'a pas pu être lue ». GFS marche pour l'éditeur, console muette.
- **Retirer** : « Rouvrir » retire la règle de structure (et sa ressource `*` / `*` si elle n'en garde plus), « Retirer les règles de GFS » les six règles de Partagé ; une règle écrite à la main sur une autre table reste, et le pied redit « Pas protégé ».
- **Ce que le panneau montre à qui n'est pas propriétaire** : « Permissions », « seul un propriétaire peut vérifier », aucun geste (le bloc « Poser des règles » n'est pas rendu).
- **Pas mesuré** : Encadré, les espaces, les colonnes d'aide (lots suivants) ; l'instance de la DINUM ; un éditeur qui lit le panneau pendant que le propriétaire pose (la page se recharge pour tous, 10.6).

## 45. La liste des personnes invitées au document n'est pas lisible par un widget (mesuré le 06/11)

Question d'Antoine (06/11) : l'autocomplétion de « Partager » peut-elle lire les personnes déjà invitées au document ? `labo/run-invites.mjs`, vrai Grist 1.7.19, compte propriétaire, jeton de `getAccessToken` (relayé par le courtier) :

| Point d'accès | Jeton en écriture | Jeton en lecture seule |
|---|---|---|
| `/access` | 403 « access denied » | 403 « access denied » |
| `/usersForViewAs` (la liste de « Voir en tant que ») | 403 « access denied » | 403 « No owner access » |

Conclusion : **aucune liste des invités n'est à la portée d'un widget, propriétaire compris.** Les personnes que GFS peut proposer sont celles qu'il voit déjà : les adresses des lignes de `GFS_Rangement` (qui a ouvert GFS dans ce document), celles des tables d'équipes que le propriétaire désigne (« Lire les groupes d'une table »), et l'adresse tapée. Une adresse tapée dont GFS ne peut pas savoir si elle est dans le document passe par « Demander l'invitation » (contrats 11.7, point 13).

## 46. Partager sans être propriétaire : des règles posées une fois, qui lisent une table de partages (mesuré le 06/11)

`labo/run-partages.mjs`, vrai Grist 1.7.19, trois comptes (propriétaire, éditeur administrateur d'un dossier, lecteur), 13 vérifications, aucun échec. Le montage : une table `Fichiers` (chemin, auteur écrit par une formule déclenchée sur `user.Email`, colonne-formule `Lecteurs` qui lit les partages valides et actifs dont la cible est le fichier ou un dossier au-dessus) et une table `Partages` (cible, personne, droit, fin, auteur déclenché, colonnes-formules `Valide`, `Actif`, `AdminsCible`). Six règles sur `Partages` et trois sur `Fichiers`, **posées une seule fois par le propriétaire** ; aucune règle ne lit une autre table (une règle ne lit que `rec` et `newRec`), tout passe par des colonnes-formules.

- **Un administrateur de dossier partage sans propriétaire** : l'éditeur ajoute une ligne « Ventes → viewer@ », Grist la gère comme une ligne ordinaire ; le lecteur lit aussitôt le fichier du dossier.
- **Un partage hors de son dossier ne vaut rien** : l'éditeur peut écrire la ligne (200 : la règle de création est large, `newRec` n'a pas de formules), mais `Valide` reste faux et rien ne s'ouvre ; la ligne se voit « non valide ».
- **L'héritage vers le bas** se calcule dans la formule (chemin égal à la cible, ou qui commence par la cible suivie de « / »).
- **L'auteur de la ligne ne se triche pas** : il est écrit par Grist à la création (formule déclenchée), l'éditeur ne peut pas le choisir. Deux niveaux de validité seulement (une formule ne peut pas dépendre d'elle-même) : un administrateur désigné par le propriétaire peut nommer des personnes, y compris d'autres administrateurs de son dossier ; la délégation ne descend pas plus bas.
- **L'invisible** : un fichier hors de `Lecteurs` n'arrive pas du tout à la personne (ni le nom, ni le dossier) ; l'éditeur ne peut pas modifier un fichier qui ne lui est pas accordé en écriture (refus avec les notes des règles).
- **La fin d'accès** : une règle de Grist **ne lit pas l'heure** (`NOW`, `TODAY`, `DATE`, `datetime` : « Unknown variable », 400 à l'écriture de la règle). Une **colonne-formule** sur `TODAY()` le fait : une fin passée exclut le partage, une fin à venir le garde. Grist recalcule `TODAY()` à l'ouverture du document ; **pas mesuré** : un document ouvert sans interruption au-delà de minuit ne se recalcule pas de lui-même (à dire dans la fenêtre).
- **Pas mesuré** : le coût avec beaucoup de partages (`Partages.all` dans chaque formule) ; un fichier à plusieurs partages et plusieurs droits (écriture, dépôt seul, télécharger) ; l'interface de Grist devant ces règles ; l'instance de la DINUM.

## 47. Partager un dossier avec un autre document : règles d'accès, webhooks, canal direct entre deux documents (mesuré le 06/11)

Étude « Partager dossiers et fichiers entre documents » (moteur de Sync+, dépôt `lombre33/grist-widget-one-way-sync`, lu sur la version 0.12.2 ; `main` est à la 0.13.2, `3cc217a`, non relue), mesures 2 à 4 de l'étude, jouées dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) : `labo/run-sync-regles.mjs`, `run-sync-webhook.mjs`, `run-sync-canal.mjs`, et `run-sync-canal-firefox.mjs` (Firefox 159.0.1, piloté sans Playwright).

- **Les règles de GFS et celles de Sync+ vivent dans le même document, dans les deux ordres.** Document avec `GFS_Rangement`, `Synchro` (ses neuf colonnes), un `Journal_…` et une table reçue ; GFS pose Partagé (6 règles) et ferme la structure (1 règle), Sync+ pose les siennes par ses propres fonctions (`publicAclRules` avec un export public, `ownerAclRules`, `journalAclRules`, `lockAclRules` : 10 règles). Grist accepte chaque liasse (200) dans l'ordre GFS puis Sync+ comme dans l'ordre Sync+ puis GFS ; aucune règle d'un tiers n'apparaît ; « Retirer Partagé » et « Rouvrir la structure » ne retirent que les notes « GFS : » ; les dix règles de Sync+ restent, même texte et même ordre ; Sync+ n'a plus rien à reposer ensuite (idempotent), même après les retraits de GFS.
- **Ce qui rend cela possible** : chaque auteur reconnaît les siennes à leur note (« GFS : », « Synchro : ») et Grist évalue les règles **par ressource** : les règles de `GFS_Rangement` gardent leur ordre propre (la règle des propriétaires reste la première de sa ressource), même quand Grist renumérote `rulePos` en fractions (Sync+ posé en second : 0,045 à 0,45, avant GFS ; GFS posé en second : 0,5 à 5,5, mêlé aux règles de Sync+, 1 à 10) et mêle les deux auteurs dans la liste globale. Seule ressource partagée : `*` / `*`, où GFS met `user.Access != OWNER` → `-S` et Sync+ (document public seulement) `user.Access == VIEWER` → `-R` : deux droits différents, deux publics différents.
- **Pas mesuré** : l'effet de ces règles pour un éditeur et un lecteur (les comptes du labo ; les règles de Sync+ ont leurs essais chez lui, celles de GFS les nôtres, section 44) ; le nombre de rechargements du document (chaque liasse en provoque un, 11.5 point 3).
- **Un webhook de Grist vers une adresse locale est refusé par défaut** : `POST /webhooks` vers `http://127.0.0.1:…` répond **403 « Provided url is forbidden »** ; avec `ALLOWED_WEBHOOK_DOMAINS='*'` le webhook est créé et livre (une ligne ajoutée arrive à l'écouteur, corps `[{"id":2,"manualSort":2,"Nom":"Martin"}]`). Sync+ pose un webhook par destinataire : c'est donc un réglage de l'hébergeur, comme le dit l'étude (la DINUM l'a accepté lors du test du 14/10). **Pas mesuré** : une instance à adresse publique (le labo n'en a pas).
- **Deux documents d'une même instance, ouverts dans le même navigateur, peuvent se parler directement.** Sous **Chromium** et un vrai Grist : deux documents, chacun avec un widget (sonde sans accès au document), un `BroadcastChannel` : chaque widget entend l'autre, y compris quand son document est en arrière-plan ; l'événement `storage` de `localStorage` passe aussi ; un **autre profil** du navigateur n'entend rien. Sous **Firefox 159** : une page ouvre une 2e page du même site (autre onglet, même profil), chacune avec un cadre d'un autre site (sandbox `allow-scripts allow-same-origin`) ; le cadre de la 2e répond « pong » au « ping » du cadre de la 1re. Conséquence : le partage peut se faire **en un geste** quand l'autre document est ouvert dans le même navigateur (l'invitation arrive toute seule, la personne n'accepte qu'une fois), les deux codes à copier-coller restant le repli (autre navigateur, autre profil, autre poste). **Pas mesuré** : Grist réel sous Firefox (le labo ne le pilote pas), les réglages stricts de vie privée, les fenêtres privées, deux navigateurs différents.
- **Lu dans le code de GFS (non mesuré)** : `copyPlan` (`js/files/gfs-copy.js`) copie toutes les colonnes d'une ligne puis vide celles que la recette `copie` déclare (`uniques`, `exclusives`) : une colonne `id_sync` ajoutée par le moteur serait donc **copiée** par « Dupliquer » (deux fichiers, une même clé) tant qu'elle n'est pas déclarée ; GFS doit l'ajouter lui-même aux colonnes uniques. Les noms que le moteur crée (`Synchro`, `Journal_`) sont écrits en dur dans son `js/logic/common.js` : d'où le point 3 de la consigne 002 à Sync+.
- **Pas mesuré, et pas mesurable ce soir** : la taille des vrais modèles de Publipostage+ (le labo n'a pas de modèle réel : elle se lit dans le document d'Antoine, fenêtre « Poids du document ») ; `id_sync` dans une table de la vraie Publipostage+ ; le parcours entier du moteur (il n'est pas encore dans le kit : consigne 002).

## 48. Joindre un PDF à la cellule « Pièces jointes » d'une ligne : ce que Grist garde et refuse (mesuré le 06/11)

`labo/run-joindre.mjs`, vrai Grist 1.7.19 (image officielle), Chromium, fr clair et en sombre, 35 vérifications, aucun échec. Une sonde (`labo/sondes/j-joindre/`) fabrique ses PDF dans son cadre isolé et les donne à GFS (`prototype/js/broker/attach.js`, contrats 5.4 point 12).

- **Les octets de l'app arrivent intacts** : l'empreinte SHA-256 de la pièce jointe téléchargée (`/attachments/N/download`) est celle du `File` fabriqué dans le cadre isolé, type `application/pdf`, nom donné par l'app. La cellule de la ligne vaut `['L', …numéros]`, rien d'autre ne bouge (autres lignes, autres colonnes).
- **Remplacer retire la citation, pas la pièce jointe** : après `remplacer`, la cellule ne cite plus l'ancien fichier de même nom (casse ignorée) mais la liste des pièces jointes du document (`/attachments`) le garde. `ajouter` garde tout, même nom compris.
- **Un lot, une écriture** : trois fichiers sur deux lignes dans un appel, un seul `BulkUpdateRecord` ; l'ordre reçu est gardé dans chaque cellule. Une ligne supprimée entre-temps est un échec de cette ligne, les autres sont jointes.
- **Une pièce jointe ajoutée par une personne pendant l'envoi n'est pas perdue** : la colonne est relue juste avant d'écrire (cellule `['L', 3, 7, 10, 11, 12]` : la pièce ajoutée en cours d'envoi, 11, est avant la nôtre, 12).
- **Une règle d'accès qui refuse de modifier la colonne** (`-U`, formule `True`) : Grist répond « Blocked by column update access rules » ; GFS rend `probleme: 'refus'`, aucune cellule ne change, la file n'est pas bloquée. **Poser ou retirer une règle d'accès fait reconstruire le cadre de GFS** (l'ancien cadre est détaché, l'app ouverte disparaît) : l'app est à rouvrir.
- **Le serveur qui refuse la taille (413)** donnait `trop-gros` pour tous les fichiers du lot (jusqu'à la nuit du 06/11 : depuis, **pour ce seul fichier**, les autres sont joints, section 53), **le réseau qui tombe** donne `injoignable` (rien n'est écrit, l'appel suivant réussit).
- **Une demande interceptée puis rejouée (`route.fetch` puis `fulfill`)** rendait un envoi en échec dans le labo : l'interception du labo changeait la réponse, pas GFS ; l'essai de l'ajout concurrent laisse partir la demande telle quelle (`route.continue`).
- **Pas mesuré** : Firefox (le geste n'a pas d'interface), l'instance de la DINUM, la vraie app de Publipostage+.

## 49. Joindre par le vrai client du kit : mêmes mesures, même résultat (mesuré le 06/11)

`LAB_KIT=1 node labo/run-joindre.mjs` : la sonde J « kit » (`labo/sondes/j-joindre/kit.html`) parle à GFS par `GfsLink.attach` du kit 0.11.0 (`70c3f67`, le sous-module `prototype/kit`) au lieu d'une enveloppe écrite à la main. Vrai Grist 1.7.19, Chromium, fr clair et en sombre : **les 35 vérifications de la section 48 passent à l'identique**, console propre.

- Un `File` fabriqué dans le cadre isolé et rangé dans la liste `fichiers` traverse le message de GFS avec ses octets (même empreinte SHA-256 que le fichier de l'app).
- Une ligne qui n'est pas un numéro est refusée **par le kit** (`GFS_REFUSE`, avant tout message) ; le contenu qui n'est pas un PDF, la table de GFS et la table interne le sont par GFS : le code est le même, la phrase vient de celui qui refuse.
- Le rapport rendu par le kit est celui de GFS, normalisé (`colonne`, `probleme`, `joints`, `echecs`), sans clé de plus.

## 50. Un lecteur vidéo posé par GFS : ce que Grist lui laisse et ce qu'il lui refuse (mesuré le 06/11)

`labo/run-lecteur-mesures.mjs`, vrai Grist 1.7.19 (image officielle), Chromium, fr clair et en sombre, aucun échec, console propre (sauf le refus attendu de la politique, voir plus bas). Un faux lecteur d'une autre origine (`localhost` au lieu de `127.0.0.1`, `labo/sondes/l-lecteur/policy.html`) tient lieu de YouTube et de Vimeo, que le conteneur d'essai n'atteint pas. Étude : `docs/etude-lecteur-video.md`. Rien n'est codé dans GFS.

- **Le cadre que Grist donne à GFS** : `allow="clipboard-write"`, pas d'attribut `sandbox`.
- **Un cadre posé par GFS** (sous une `frame-src` élargie à l'adresse du faux lecteur, la seule modification de GFS) : il a sa propre origine (`http://localhost:…`) et son stockage répond. **Le même cadre, isolé comme celui d'une app** (`sandbox="allow-scripts"`) : origine `null`, stockage `SecurityError`. Un lecteur posé par l'app subirait le second cas.
- **Les fonctions qu'un lecteur demande** (`allow="autoplay; encrypted-media; picture-in-picture; fullscreen"` sur son cadre) : `autoplay` refusée, `encrypted-media` refusée, `fullscreen` refusée, `picture-in-picture` accordée. **Grist ne délègue à GFS que `clipboard-write`**, et un cadre ne peut recevoir que ce que son parent a reçu. Mêmes valeurs posé directement ou par la page relais.
- **Activation de la personne** : un vrai clic de souris dans le cadre isolé de l'app donne l'activation à l'app (30 relevés « active » sur 30 dans la 1,2 s qui suit, 0 avant) et **à la page de GFS** (30 sur 30), **pas au cadre du lecteur** (0 sur 0). Le relevé se fait dans la page (échantillon toutes les 40 ms), pas par `evaluate` de Playwright, qui accorde lui-même une activation passagère.
- **Page relais** (`LAB_RELAIS=1`, politique de GFS **inchangée** : `frame-src 'self' blob:`) : une page de GFS avec sa propre politique (`default-src 'none'; script-src 'self'; frame-src <adresse du lecteur>`) pose le cadre du lecteur, qui répond, et redit à GFS ce que le lecteur dit. **La même adresse posée directement dans la page de GFS est refusée** (« Refused to frame … `frame-src 'self' blob:` »).
- **Le routeur de GFS jette les messages d'une fenêtre qui n'est ni Grist ni l'app active** (`js/broker/router.js`) : les rapports du lecteur ne se lisent, dans l'essai, que par `GFSRouter.setStrayListener`.
- **Pas mesuré** : un vrai YouTube ou Vimeo (comment ils se comportent quand `autoplay=1` arrive sans délégation), Firefox, Safari, un téléphone, l'instance de la DINUM, la mise en page à 700 × 400 (aucune interface n'est construite).
- **Rejouer** : `bash prototype/labo/vrai-serveur.sh`, puis `REPO_DIR="$(realpath ../..)" node run-lecteur-mesures.mjs` depuis `prototype/labo` (`LAB_LANG=fr|en`, `LAB_SCHEME=light|dark`, `LAB_RELAIS=1` pour la page relais). Le labo donne à la page modifiée de GFS le port du vrai serveur par `LAB_PAGES_PORT` (`lab-common.mjs`, `servePages`).

## 51. Grist-BI à `b6f9490` dans GFS : elle démarre, elle ouvre un rapport précis et en crée un vierge (mesuré le 06/11)

Suite de la section 36. Référence avancée à `b6f9490` (kit 0.9.0, `eaa2ae2` ; relue dans `docs/apps.md` : politique de sécurité, adresses et tables inchangées). `labo/run-bi.mjs`, vrai Grist (grist-static), Chromium, panneau à 700 × 400, à la vraie souris et au vrai clavier, **fr clair et en sombre : 23 vérifications dans chaque passe, aucune erreur, console propre**. `ACCEPTS_OPEN.bi` passe à `{ fichier: true, nouveau: true }` (`js/controller.js`) ; rejoué avec l'ancienne valeur, trois vérifications échouent (la phrase provisoire revient, l'app fermée comme l'app ouverte).

- **L'app démarre dans le sous-cadre isolé.** Les quatre lectures de `localStorage` ont leur `try` autour du `typeof` (consigne 007, point 1) : origine `null`, stockage `SecurityError`, `GristBI.i18n` existe, aucune erreur de script. Le courtier ne refuse rien (accès `full`, tables `BI_`, tables internes lues, capacité `formules`).
- **« Nouveau > Rapport BI »** ouvre un rapport vierge sur la première table du document, sans phrase provisoire (`GfsLink.opening()`). **L'app écrit alors elle-même la ligne de ce rapport**, nommée « Rapport BI 1 » (« BI report 1 » en anglais : l'app suit la langue de GFS dès le démarrage) : la ligne est déjà dans le document six secondes après l'ouverture, sans geste de la personne, alors que sa page dit que « Nouveau n'écrit rien par lui-même ». Ce n'est pas une écriture de GFS ; GFS ne l'a pas demandée.
- **Le choix de la table** crée les trois tables (`BI_Dashboard_Config`, `_Comments`, `_UserProbe`, **sans l'accord de la personne** : l'écart à la règle 4 que l'app déclare à sa consigne 001) et les colonnes `Nom`, `TypeRapport`, `DateModif`, `ModifiePar` par `AddColumn` sur la table de configuration existante ; une seule ligne par table de travail.
- **Dans l'explorateur** : un fichier « Rapport BI » par ligne ; la ligne d'avant (semée sans `Nom`) s'affiche « (sans nom) » jusqu'à son prochain enregistrement par l'app. **F2 écrit le nom dans la colonne `Nom` de la ligne choisie, et nulle part ailleurs** (la colonne existe, GFS l'écrit ; rien d'autre ne bouge).
- **Le double-clic d'un rapport** : app fermée, elle démarre sur la table de ce rapport (Commandes, pas la première table : le démarrage lit `ouverture` du contexte) ; app ouverte, elle passe au rapport demandé par l'appel `ouvrir` (Commandes puis Clients) ; dans les deux cas aucune phrase de GFS, **rien n'est écrit dans le document** (mêmes lignes, mêmes noms).
- **Pas mesuré** : Firefox, le site en ligne de l'app (injoignable du cloud), l'instance de la DINUM, un changement de langue **en cours d'usage** (`onLanguage` : seule la langue au démarrage est vue), l'enregistrement en attente à la fermeture avec un rapport modifié (`onClose`, la page de l'app le dit mesuré avec son simulateur à elle).

## 52. Grist-BI répond à `fermer` : ce qu'elle a en attente est écrit avant que GFS détruise son cadre (mesuré le 06/11)

`labo/run-bi-fermer.mjs`, vrai Grist (grist-static), Chromium, 700 × 400, à la vraie souris, **fr clair et en sombre, 7 vérifications chacune, aucun échec**. Grist-BI à `b6f9490`, kit 0.9.0 (`GfsLink.onClose`, consignes 006 et 008).

- **Le scénario** : « Nouveau > Rapport BI », puis le bouton « + Page » de l'app (la page « Pause », par le `prompt()` de l'app : le sous-cadre a `allow-modals`), puis « Nouveau > Document » de Publipostage+. L'enregistrement de l'app est un délai de 600 ms (`js/main.js`, `scheduleSave`) : **le labo le porte à 600 000 ms** (seul changement de l'app pour cet essai) pour que rien ne soit écrit pendant les clics de la personne ; avant de partir, le document ne porte ni table ni ligne de configuration (vérifié).
- **GFS appelle `fermer { raison: 'nouveau' }`, l'app écrit puis répond `{ ferme: true }`** : le cadre de Grist-BI disparaît, celui de Publipostage+ le remplace, et le document porte une ligne de configuration (« Rapport BI 1 », la table Clients) dont la configuration contient les pages « Page 1 » et « Pause ». Aucun avertissement de GFS.
- **Le témoin** (`LAB_SANS_ONCLOSE=1`, l'abonné retiré, c'est-à-dire l'app d'avant la 006) : le kit répond `GFS_INCONNU`, GFS remplace l'app, **la page est perdue** : aucune table, aucune ligne. L'essai prouve donc la réponse de l'app, pas son délai d'enregistrement.
- **Pas mesuré** : Firefox, une question posée par l'app à la fermeture (elle n'en pose jamais : l'enregistrement automatique est toujours allumé), le site en ligne de l'app.

## 53. Un fichier trop gros n'arrête plus le lot de « joindre » : lui seul échoue (mesuré le 06/11, nuit)

Question de Publipostage+ à sa consigne 053 (« un `trop-gros` pourrait-il ne retirer que ce fichier du lot ? »). GFS envoie les fichiers un par un (`js/broker/attach.js`, `#send`) : un 413 désigne donc le fichier refusé, et GFS ne peut pas se tromper de fichier. **Décidé le 06/11 par GFS** (contrats 5.4, point 12) : `trop-gros` est un échec de ce fichier (`echecs`, `raison: 'trop-gros'`) ; `probleme` ne le porte plus et reste null ; `refus`, `injoignable` et `echec` arrêtent le lot comme avant.

- **Essai unitaire** (`test/attach.test.mjs`) : trois fichiers, le deuxième refusé (413) : le premier et le troisième sont joints (un seul lot), les trois sont essayés ; un fichier seul trop gros : rien envoyé, rien écrit ; les refus `refus`, `echec` et `injoignable` arrêtent toujours le lot. Le nouvel essai échoue avec l'ancien code.
- **Vrai Grist 1.7.19** (`labo/run-joindre.mjs`, fr clair, en sombre, et avec le client du kit : **37 vérifications chacune, aucun échec**) : deux fichiers refusés (413) : deux échecs `trop-gros`, aucun joint, `probleme` null, rien d'écrit ; trois fichiers dont le deuxième reçoit 413 : les lignes 1 et 3 gagnent chacune une pièce jointe, la ligne 2 n'a pas bougé, `joints` = [0, 2], `echecs` = [{ 1, `trop-gros` }].
- **Le kit 0.11.0** laisse passer le rapport tel quel ; sa documentation (README et commentaire de `attach`) rangeait `trop-gros` parmi les mots de `probleme` : corrigée au kit `b9525e8` (commentaire et README seulement, aucun code), référence de GFS avancée.

## 54. La vraie Publipostage+ à `c850c89` joint ses PDF par GFS, dans un vrai Grist (mesuré le 06/11, nuit)

Le chemin que Publipostage+ a branché à sa consigne 053 (`RowAttachment.attachAll` → `attachViaGfs` → `GfsLink.attach`), jamais exercé avant : les essais de « joindre » se faisaient avec une sonde ou avec le client du kit seul. `labo/run-joindre-publipostage.mjs` ouvre un modèle de la vraie app (la version que GFS référence) dans un vrai Grist 1.7.19 (Docker), à travers GFS, puis donne à son code trois PDF qu'il reçoit comme à l'export. Trois remplacements, pour cet essai seulement (`routePatches`, rien de publié ne change) : `actions.joindre: ["pdf"]` au manifeste de GFS (que GFS ne déclarera qu'à « 053 · faite » sur la page de l'app), `GFS_ATTACH_WIRED = true` dans l'app (son grisé, qu'elle lève elle-même à sa 053) et une porte pour lui donner la colonne (sous GFS, `pp_attach_column` n'est pas déclarée : où l'app garde sa colonne reste à décider avec elle).

**19 vérifications chacune, aucun échec** (fr clair, en sombre) ; le témoin `LAB_SANS_LEVEE=1` (l'app garde son grisé) passe aussi : raison `gfs`, `attachAll` rend null, le document ne gagne rien.

- **Deux PDF sur deux lignes** : rapport sans problème, deux joints, une seule progression (un lot) ; les cellules citent chacune une pièce jointe, la ligne 3 n'a pas bougé ; les octets que Grist garde ont l'empreinte du PDF de l'app et le type PDF.
- **Le même nom une seconde fois** : l'app reçoit `replaced: 1` (elle compte 0 ou 1, pas un booléen), la cellule ne cite que la nouvelle pièce, l'ancienne reste dans la liste du document.
- **Une ligne qui n'existe pas** : un échec de raison `row` (GFS dit `ligne`, l'app traduit), l'autre PDF est joint, `problem` reste null.
- **Un fichier trop gros au milieu de trois** (413 sur le deuxième envoi) : `failed = [{ 1, tooLarge }]`, `problem` null, les lignes 1 et 3 gagnent chacune une pièce, la ligne 2 n'a pas bougé : la réponse de GFS à la question de l'app (fait 53) arrive bien jusqu'à elle. **Tous trop gros** : l'app tire `problem: 'tooLarge'` de deux échecs du même mot, rien n'est écrit.
- **Le réseau tombe** : `problem: 'unreachable'`, aucun joint, rien d'écrit.
- **Non mesuré** : l'export complet de l'app (pdfmake n'est pas dans le miroir des bibliothèques du cloud : le PDF est celui d'un générateur d'essai, pas celui de l'app) ; Firefox ; le Grist de la DINUM ; le menu « Exporter » et le panneau de Réglages de l'app sous GFS (l'app les grise par `blockedByGfs`, pas de geste de la personne mesuré ici).

**Second rejeu, le 07/11 (nuit), après « 053 · faite » (`00d2078`, page lue à `987a338`)** : `actions.joindre: ["pdf"]` est déclaré pour de bon dans `prototype/manifestes/publipostage.json` (le test du manifeste échoue sans cette ligne) et l'essai ne complète plus le manifeste (sa section 0 le dit) ; le seul remplacement qui reste est `GFS_ATTACH_WIRED = true`, que l'app ne lèvera qu'après son essai chez le porteur. Même rejeu, **20 vérifications chacune, aucun échec** (fr clair, en sombre) ; le témoin (grisé gardé) : 6 vérifications vertes. Le Grist d'essai était à relancer (le démon Docker du conteneur ne survit pas à la nuit : `bash vrai-serveur.sh`).

**La colonne et le mode se gardent dans la vue (mesuré le 07/11, matin ; choix du porteur « Dans la vue »)** : `pp_attach_column` et `pp_attach_mode` sont ajoutés à `reglages` du manifeste de Publipostage+ (le test du manifeste échoue sans eux : sans la déclaration le courtier refuse `setOption`). Section 7 de `labo/run-joindre-publipostage.mjs`, avec la vraie app dans un vrai Grist : l'app écrit comme sa liste le fait après le geste (`writeColumn`, `writeMode`, rejouées par un remplacement du labo qui les expose ; le clic dans la liste n'est pas rejoué), GFS les écrit dans `widgetOptions` de la section (`{"pp_attach_column":"Pieces","pp_attach_mode":"add"}`), Grist ne montre aucune barre « Enregistrer », et GFS rechargé l'app rouverte retrouve la colonne et le mode. **23 vérifications chacune, aucun échec** (fr clair, en sombre). Non mesuré : le clic dans la liste de l'app, Firefox, le Grist du porteur.

## 55. « Partager » : le vrai plan d'activation et ses règles, à trois comptes (mesuré le 07/11)

`labo/run-partager.mjs`, vrai Grist 1.7.19, propriétaire, éditeur auteur d'un fichier, lecteur du document ; le plan est celui de `js/sharing/sharing-model.js` (`planSharing`), 25 vérifications, aucun échec. Pour le premier lot : les PDF que GFS garde (`GFS_Fichiers`).

- **Une seule liasse suffit** : deux tables (`GFS_Fichiers` créée si elle manque, `GFS_Partages`), cinq colonnes d'aide, trois ressources et seize règles s'écrivent en UN `apply`, les tables avant les règles. Un second plan répond « déjà posé ».
- **`user.Access` est lisible par une formule déclenchée** : Grist écrit `owners` ou `editors` dans `AuteurAcces` à la création ; c'est la racine de confiance (un partage d'un propriétaire est valide, sans liste de propriétaires à tenir).
- **Grist garde l'auteur qu'on lui donne** : une colonne à formule déclenchée n'est pas écrite quand la création fournit déjà la valeur (essai : un éditeur crée un partage avec `Auteur` = le propriétaire et `AuteurAcces` = `owners` : accepté, `Valide1` vrai). Une règle de colonne `-C` n'y change rien. **La parade qui tient** : la règle de création lit `newRec` (qui porte, à la création, la valeur que Grist écrit ou celle qu'on a donnée) et exige `newRec.Auteur.lower() == user.Email.lower()` et `newRec.AuteurAcces == user.Access` : la même création honnête passe, la triche est refusée (403, avec la note de la règle). Changer ces deux colonnes ensuite est refusé aux non-propriétaires (`-U` sur les deux colonnes seules, 403).
- **Un administrateur de fichier partage sans propriétaire** (l'éditeur, auteur de `f1`, le partage avec le lecteur : le lecteur le lit) ; **un partage d'un fichier qui n'est pas le sien est écrit mais invalide** (`Valide` faux) et n'ouvre rien ; il ne crée pas de fichier au nom d'un autre, ne modifie pas celui d'un autre ; les catégories « tous » et « les éditeurs » ouvrent selon le rôle de Grist (le lecteur lit « tous », pas « les éditeurs »).
- **Un défaut de formule peut cacher des fichiers** : une colonne d'aide qui lit une ligne de partage dont `Valide` est en erreur rend le fichier illisible pour tout le monde sauf les propriétaires (premier essai : une formule mal indentée dans `AdminsBase` ; l'éditeur ne lisait plus son propre fichier après son premier partage). D'où un test qui vérifie l'indentation de chaque formule (`test/sharing-model.test.mjs`).
- **Retirer** : les règles de partage (note « GFS : Partages ») et leurs ressources partent, les tables et colonnes restent ; un second retrait n'a plus rien à faire.
- **Pas mesuré** : l'interface de Grist devant ces règles ; beaucoup de partages ; un fichier d'une table d'app (premier lot : les PDF de GFS) ; les dossiers et l'héritage (une cible `dir:` n'existe pas encore : le rangement est par personne).

## 56. Le lecteur vidéo de GFS, avec la vraie Publipostage+, sous la politique élargie (mesuré le 07/11)

Choix du porteur du 07/11, carte « Politique élargie » : `frame-src` de GFS nomme `https://www.youtube-nocookie.com` et `https://player.vimeo.com` (rien d'autre), le cadre du lecteur est posé directement dans la page de GFS. Construit : `js/broker/player.js`, `js/broker/player-sites.js`, `permissions.lecteurs` au manifeste (`youtube`, `vimeo` pour Publipostage+), `contexte.lecteurs`, contrat 3.4 point 7 et 5.2 point 11. Essai : `prototype/labo/run-lecteur.mjs`, vrai Grist 1.7.19 (image officielle), Chromium, 700 × 400, la **vraie Publipostage+ à `987a338`** ouverte sur un modèle, **36 vérifications chacune, aucun échec** en français clair et en anglais sombre ; essais unitaires `test/player.test.mjs` (12), `manifest`, `context`, `csp`.

- **L'app reçoit la liste** : `GfsLink.players()` rend `["youtube", "vimeo"]` (le code de liaison de l'app, pas un faux).
- **Les deux pages sont demandées, pas une de plus** : le navigateur demande `https://www.youtube-nocookie.com/embed/…` et `https://player.vimeo.com/video/…` (le labo leur répond lui-même par `page.route` : le cloud n'atteint ni YouTube ni Vimeo) ; un cadre vers `https://www.dailymotion.com` (témoin) est refusé : « Refused to frame … `frame-src 'self' blob: https://www.youtube-nocookie.com https://player.vimeo.com` ». Aucun autre refus de la politique dans la console.
- **L'adresse est montée par GFS** : `…/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1&start=42` pour YouTube ; `https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1#t=30s` pour une vidéo Vimeo non listée. Les attributs du cadre : `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `referrerpolicy="strict-origin-when-cross-origin"`. **Un piège vu** : l'attribut `allowfullscreen` en plus de `allow="… fullscreen"` fait dire à Chromium « Allow attribute will take precedence over 'allowfullscreen' » (un avertissement de GFS en console) : GFS ne pose que `allow`.
- **Où il est posé** : une vignette de 320 × 180 à (100, 80) du cadre de l'app donne un lecteur de 320 × 180 à (100, 80) du cadre dans la page (mesuré par `boundingBox`) ; `deplacer` vers (150, 60) avec une zone qui coupe le haut et la droite donne une fenêtre de 110 × 140 et le cadre du fournisseur, de 320 × 180, décalé de −40 px ; une zone qui ne touche pas la vignette cache la fenêtre (le cadre reste en place) ; `masquer` cache et remontre. Le panneau passé de 700 × 400 à 760 × 440 (ResizeObserver sur le cadre de l'app) déplace le lecteur avec lui.
- **La vraie souris** (`page.mouse.move`, `:hover`) : au milieu de la vignette elle trouve le lecteur ; dans le cadre de l'app, ailleurs, ou dans la partie coupée, elle trouve l'app.
- **Un seul lecteur** : `afficher` (Vimeo) remplace YouTube ; `fermer` d'un autre `id` ne retire rien ; une adresse à la place d'un identifiant, un site non déclaré (`dailymotion`) et un rectangle mal formé sont refusés avec l'avertissement « GFS : publipostage : lecteur.afficher refusé (GFS_REFUSE) : … » et ne changent rien.
- **Il part avec l'app** : le bouton « Fichiers » de la barre (clic) retire le lecteur ; l'app rouverte n'en retrouve aucun ; l'app en pose un nouveau, `fermer` le retire.
- **Pas mesuré** : un vrai YouTube ou Vimeo (le démarrage sans second clic, que les faits 50 disent non délégué ; le plein écran ; le son ; les erreurs « vidéo non intégrable » / 153 que GFS n'a aucun moyen de relayer à l'app tant que l'événement `lecteur` n'est pas construit) ; Firefox ; le Grist de la DINUM ; l'événement `lecteur { id, etat }` (non construit, lot 3 de l'étude) ; le clavier dans le lecteur (Échap et la barre) ; les gestes de la vraie vignette de Slides+ (`js/video-frame.js` n'est pas rejoué : le labo appelle `GfsLink.player` comme lui).
- **Rejouer** : `bash prototype/labo/vrai-serveur.sh`, puis `REPO_DIR="$(realpath ../..)" node run-lecteur.mjs` depuis `prototype/labo` (`LAB_LANG=fr|en`, `LAB_SCHEME=light|dark`).

## 57. Grist-BI à `8eb479b` : « Nouveau » n'écrit plus de ligne sans geste ; Automation+ à `f6da4cc` (mesuré le 07/11)

Suite des sections 51 et 52 (Grist-BI) et de la consigne 009 de GFS à Grist-BI. Références avancées le 07/11 (matin), chacune dans un commit à part : **Grist-BI de `b6f9490` à `8eb479b`** (trois fichiers : `js/main.js` +23 lignes, `dev-tests/test-data.js`, sa page d'état ; `kit/` toujours à `eaa2ae2`) et **Automation+ de `597fe02` à `f6da4cc`** (0.15.1, neuf commits : `js/closing.js` et la réponse à `fermer`, le défaut « Infinity » de `js/engine.js` ; `index.html` ne change que les `?v=` et le script `closing.js` : **même politique de sécurité, aucune adresse ni bibliothèque de plus** ; `kit/` à `eaa2ae2`).

- **Le constat de la consigne 009 est corrigé et tient dans un vrai Grist** (`labo/run-bi.mjs`, grist-static, Chromium, 700 × 400, fr clair, **25 vérifications, aucun échec** ; l'essai est réécrit pour la nouvelle règle, le CONSTAT du 06/11 devient une vérification). « Nouveau > Rapport BI » : l'app s'ouvre vierge, le document n'a pas de table `BI_Dashboard_Config` ; choisir la table de travail : toujours aucune ligne (seules `BI_Dashboard_Comments` et `BI_Dashboard_UserProbe` naissent) ; **un vrai geste** (« + Page », le nom « Pause » tapé dans le `prompt()` de l'app) : 600 ms plus tard la table de configuration naît avec `TableId`, `ConfigJSON`, `Nom`, `TypeRapport`, `DateModif`, `ModifiePar` et **une seule ligne** (« Rapport BI 1 ») ; un second « Nouveau » sans rien faire ne laisse aucun fichier de plus ; F2, le double-clic (app fermée : `ouverture` ; ouverte : `ouvrir`) comme avant ; aucun avertissement de GFS, aucune erreur de script.
- **La réponse à `fermer` tient avec le nouveau code** : `labo/run-bi-fermer.mjs` rejoué à `8eb479b`, 7 vérifications, aucun échec.
- **Automation+ à `f6da4cc`** : `labo/run-automation.mjs` (vraie app, vrai Grist, 3 vérifications) et `run-ambiance-apps.mjs` (`APP=automation`, français clair, 10 vérifications), aucun échec. **Pas rejoué** : sa réponse à `fermer` (`GfsLink.onClose`, `js/closing.js`) avec la vraie app dans le vrai GFS (le constat de sa 013 : un `oui` peut n'être pas suivi de la destruction du cadre, carte « tu restes » en attente), Firefox, le Grist de la DINUM.
- **Un risque lu, pas mesuré** : `suppressNextSave` de Grist-BI est baissé sans `try … finally` (`js/main.js:1849-1854`) ; une exception dans `render()` pendant `switchTable` le laisserait levé, plus aucune sauvegarde ensuite (consigne 010 à Grist-BI).
- **Piège du labo** : `lab-server.mjs` se lance avec `REPO_DIR="$(realpath ../..)"` (sans lui il sert un autre dossier et le cadre de GFS ne se charge jamais : « waiting for locator('.btn.primary') ») ; l'app Grist-BI demande le nom d'une page par `prompt()` : l'essai doit répondre au `dialog`.


## 58. La vraie Form+ répond à la corbeille et à la copie ; Publipostage+ à `3bb6d95` joint sans remplacement ; Grist-BI à `4c86596` ; le clavier dans le lecteur (mesuré le 07/11, matin)

Suite des sections 34 (la sonde ZF), 54 (« joindre »), 56 (le lecteur) et 57 (Grist-BI). Trois références avancées le 07/11, chacune dans un commit à part : **Grist-BI** de `8eb479b` à `4c86596` (un fichier servi, `js/main.js` : le `finally` de la consigne 010), **Form+** de `17cfce9` à `91e4ba8` (sept commits : `poc/widget.html` n'a gagné qu'un script classique de `'self'`, aucune bibliothèque ni adresse de plus, le kit relevé à `cb1f8cd`, 0.10.0), **Publipostage+** de `987a338` à `3bb6d95` (le grisé du PDF joint levé par l'app, `4eef1fb` ; la mise en forme conditionnelle des tableaux ; l'import d'un Word, un moteur local sans appel à GFS ; `index.html` ne change que par des numéros de version, un texte de repli et la ligne « Importer un Word… »).

- **La vraie Form+ répond à `supprimer` et à `dupliquer`** (`labo/run-composite-form.mjs`, grist-static, Chromium, 700 × 400, à la vraie souris et au vrai clavier, **25 vérifications chacune en français clair et en anglais sombre, aucune en échec**). GFS déclare `suppression: { ligne: true, appel: true }` et `copie: { appel: true }` dans `manifestes/form.json` (les deux tests du manifeste et du gardien sont mis à jour). Les formulaires sont rangés comme Form+ le fait (`seedFormDesigner` : une section native et une ligne de `FormPlus_Formulaires`) ; le premier est publié (`shareOptions` à `{"publish":true,"form":true}`, posé à la main : pas de clé de partage réelle). Form+ fermée, les deux gestes sont grisés et le clic dit d'ouvrir l'app ; ouverte, ils sont dégrisés.
  - **Dupliquer** : le nom est le premier libre (« … (1) »), la copie a **sa section** (≠ celle de l'original), ni clé de partage ni adresse publique, son lien est fermé, **sa table de réponses est à elle et vide** (`Clients_copie`) ; l'original n'a pas bougé (même ligne, même définition, son lien public ouvert, la table `Clients` intacte) ; GFS n'a écrit aucune ligne dans `FormPlus_Formulaires` (une seule `AddRecord`, celle de l'app) ; la copie prend le clavier ; la phrase de GFS et celle de l'app sont dites bout à bout.
  - **Mettre à la corbeille** : la question de la table `GFS_Corbeille` passe avant l'appel (refusée, l'app n'est pas appelée et le lien reste ouvert) ; `onDelete` ferme le lien (`shareOptions` à `{}`) ; la ligne part à `GFS_Corbeille` dans un seul lot (`AddRecord GFS_Corbeille`, `RemoveRecord FormPlus_Formulaires`) ; la section et la table de réponses restent. **Restaurer** : même numéro, même définition, le lien reste fermé.
  - **Constat** (consigne Form+ 026) : la copie crée une table sans fenêtre d'accord (guide des apps, règle 4) et sa phrase ne le dit pas.
  - **Non mesuré** : Firefox avec la vraie app, le Grist de la DINUM, un formulaire publié par le geste « Publier » de l'app, la copie d'un formulaire dont une question écrit dans une autre table que la principale.
- **« Joindre » avec Publipostage+ telle qu'elle est publiée** : `GFS_ATTACH_WIRED` vaut `true` dans son fichier (`4eef1fb`), l'essai (`run-joindre-publipostage.mjs`) ne le remplace plus (il le fait encore sur une référence plus ancienne, et, avec `LAB_SANS_LEVEE=1`, le remet à `false` pour le témoin). **23 vérifications chacune en français clair et en anglais sombre, aucune en échec** ; le témoin passe (raison `gfs`, `attachAll` rend null, rien d'écrit). Non mesuré : l'essai du porteur dans son Grist sous Firefox ; le sélecteur de fichier de l'import d'un Word dans le sous-cadre.
- **Grist-BI à `4c86596`** : `run-bi.mjs` (25 vérifications) et `run-bi-fermer.mjs` (7) rejoués, aucun échec.
- **Le clavier dans le lecteur vidéo** (section 8 de `run-lecteur.mjs`, **43 vérifications chacune**, aucune en échec) : après un clic à la vraie souris dans le lecteur, l'élément actif de la page de GFS est son cadre ; Échap, tapée à la vraie touche, arrive au cadre du fournisseur (la page d'essai note la touche) et à lui seul, **ni la page de GFS, ni l'app, ni la page de Grist ne la reçoivent** ; le lecteur reste ; `lecteur.fermer` le retire. Un navigateur ne donne à une page que les touches de son propre cadre : ni GFS ni l'app ne peuvent fermer le lecteur sur Échap. (Réponse à la question de Publipostage+, consigne 059.)
- **Rejouer** : `bash prototype/labo/vrai-serveur.sh` (« joindre », le lecteur), `REPO_DIR="$(realpath ../..)" node lab-server.mjs` (la corbeille et la copie de Form+, Grist-BI), puis depuis `prototype/labo` : `node run-composite-form.mjs`, `node run-joindre-publipostage.mjs`, `node run-lecteur.mjs`, `node run-bi.mjs` (`LAB_LANG=fr|en`, `LAB_SCHEME=light|dark`).

## 59. Le moteur de partage parle à Grist par le cadre d'envoi de GFS : webhooks, lecture publique, envoi sans jeton (mesuré le 07/11, après-midi)

Suite de la section 47 (les règles, le webhook, le canal entre deux documents). Le moteur de Sync+ (`js/engine/`, version 1.0.0, `f37cfd9`) ne parle à Grist que par un `port` ; GFS le remplira avec ce qu'il a : `grist.docApi` pour les lignes et les actions, le **cadre d'envoi** (`js/broker/transfer.js`, `transfer/transfer.js`) pour tout le REST. Lu dans le code : la page de GFS a `connect-src 'self'` (elle ne peut rien demander à Grist), le cadre (`sandbox="allow-scripts"`, origine opaque) a `connect-src https:` et fait des requêtes `?auth=<jeton>` sans cookie, comme `gristFetch` de Sync+.

- **Mesuré** (`labo/run-sync-rest.mjs`, vrai Grist 1.7.19 lancé avec `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`, Chromium, le vrai `Transfer` dans le vrai cadre de GFS, 15 vérifications, aucune en échec) :
  - **Webhooks depuis l'origine opaque** : `GET /webhooks` (propriétaire), `POST` JSON avec `condition` (200, identifiant rendu), liste (le webhook y est, avec son adresse), `PATCH {enabled:false}`, `DELETE /webhooks/queue/<id>` (200), `DELETE /webhooks/<id>` ; **Grist livre l'ajout d'une ligne à l'adresse du webhook** ; un webhook qui n'existe pas : 404 avec son texte, `TransferError` « http », pas une erreur de réseau. La demande préalable CORS accepte `Content-Type` et `X-Requested-With` pour ces méthodes.
  - **Document public, sans jeton** (`Origin: null`) : une lecture filtrée (`/tables/Clients/records?filter=…`) rend la ligne ; un envoi JSON de lignes (document public en édition) est accepté et la ligne est dans la table. Une adresse d'un autre serveur n'est pas suivie par `anonymous` (rien ne part).
  - **Piège** : Grist **garde quelques secondes le refus** donné à une personne anonyme. Lecture refusée (403 « No view access ») juste après avoir rendu le document public, rendue 5 s plus tard (le même pour l'envoi) ; sans lecture refusée avant, elle passe tout de suite (vérifié à part). Le moteur ne doit pas conclure d'un premier refus : il le reprend au cycle suivant (« publicClosed » de Sync+ ne doit pas être définitif).
  - Le serveur de l'essai doit autoriser les webhooks vers 127.0.0.1 (`ALLOWED_WEBHOOK_DOMAINS`) ; un Grist par défaut les refuse (section 47).
- **Non mesuré** : l'envoi à l'adresse d'un **formulaire publié** (`/api/s/<clé>/tables/…`, que le moteur crée lui-même par `ensureForm`) : il passera par la même opération, à rejouer avec le moteur ; Firefox ; le Grist de la DINUM (passerelle, CORS réel).
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-sync-rest.mjs`.

## 60. Le port de GFS fait tourner le moteur de partage dans un vrai Grist : lignes, état du document, pièces jointes, webhooks avec condition, formulaire publié (mesuré le 07/11, soir)

Suite de la section 59. `prototype/js/sharing/sync-port.js` remplit le `port` du moteur de Sync+ (kit 0.12.0, `kit/js/synchro/`, moteur 1.0.0) avec ce que GFS a : `grist.docApi` pour les lignes et les actions (celle qui **décode** les valeurs : le courtier de GFS, lui, passe par les interfaces brutes, que le moteur ne lit pas), le cadre d'envoi pour tout le REST (SQL, `/compare`, pièces jointes, webhooks, envois anonymes, lecture publique), `navigator.locks`, la langue de GFS, `gfs.synchro.` pour les deux préférences. Les tables du moteur portent le préfixe `GFS_` (`GFS_Synchro`, `GFS_Journal_<export>`).

- **Mesuré** (`labo/run-sync-port.mjs`, vrai Grist 1.7.19 avec `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`, Chromium, le vrai port dans la vraie page de GFS, **34 vérifications au premier passage, 40 avec le contrôle d'un lien, aucune en échec**, rejouée plusieurs fois) :
  - `startEngine` accepte le port (forme complète) ; `isOwner` vrai pour la personne d'essai ; `apply` (ligne ajoutée, liste vide sans appel), `fetchRows` (valeurs décodées), `readSchema`, `selectRows` et `querySql` (le jeton qui peut écrire ; une table absente rend `null`) ;
  - **`docChanges`** : l'état sans départ, puis `tables = ['Clients']` après un ajout ; **Grist 1.7.19 répond 500 « Cannot read hash » à un état de départ qu'il ne connaît pas** (pas 404, pas 400). La logique de Sync+ relit alors depuis `HEAD` mais garde `since` pour dire « les tables touchées sont connues » : elle rendrait **un ensemble vide** (« rien n'a changé ») à la place de « inconnu ». Le port de GFS rend `tables: null` dans ce cas (essai qui échoue sans la correction) ; à dire à Sync+ (consigne 004) ;
  - pièces jointes : 3 000 octets déposés puis relus **un à un** ; une pièce qui n'existe pas : `HTTP 404 Attachment not found: …` ;
  - **webhooks** : `createWebhook` avec condition (relue dans `_grist_Triggers` par `webhookConditions`), `listWebhooks`, **Grist ne livre que la ligne qui remplit la condition** (`$Nom == "Livré 2"` : la ligne « Pas pour toi » n'est pas livrée), `setWebhookEnabled`, `deleteWebhook` (la file vidée d'abord), un webhook effacé répond 404 en erreur dite ;
  - **document public** (lecture sans jeton, `Origin: null`) : `publicRecords` rend la ligne filtrée ; rendu privé, `publicClosed` (après le délai de quelques secondes de la section 59) ;
  - **formulaire publié** : `ensureForm` du moteur le crée et le publie ; l'envoi de lignes à `…/api/s/<clé>/tables/Clients/records?flat=1`, **sans jeton, depuis l'origine opaque, passe** (ligne dans la table) ; l'**avis de fin** (`deleteWebhookWithNotice`) arrive par la clé du formulaire, puis le webhook est effacé ; une autre instance : `otherInstance`, rien ne part ; une clé inconnue : `HTTP 404 Share not known`, sans la clé en entier.
- **Le contrôle de sécurité d'un lien collé passe par le cadre** (rejoué le 09/11, `labo/run-sync-port.mjs`, **40 vérifications**, aucune en échec) : `GET <instance>/api/s/<clé>` **sans jeton, depuis l'origine opaque**, rend la fiche du document que la clé désigne (`readShare` du moteur : identifiant **complet**, nom, dossier, `personal: true` dans l'espace personnel, où `org.domain` est vide) ; une clé inconnue rend `null` (404), un lien d'une autre instance est refusé avant de partir (`shareUnreadable`) ; `publicAccess` rend `''` pour un document privé ; `journalStats` résume un journal en une requête SQL, `null` pour une table absente. Ces trois fonctions (`shareInfo`, `publicAccess`, `journalStats`) **ne sont pas dans `PORT_SHAPE`** : elles sont dans `js/grist.js` de Sync+ et appelées par ses écrans (`recipient-wizard.js`, `target/wizard.js`, `source/tab.js`, `diagnostic.js`). Le port de GFS les a déjà, sous les mêmes noms ; la consigne 005 les demande dans le port du moteur avec l'orchestration. Choix d'Antoine du 09/11 : le collage des liens garde le cœur du moteur de Sync+ (sécurité), GFS n'en refait rien.
- **L'adresse REST ne porte pas l'identifiant complet du document** : `getAccessToken` donne `…/o/docs/api/docs/7LGMG89VQ5yp`, alors que l'adresse de la page porte `7LGMG89VQ5yprDdoEVRg9R` (l'identifiant court, 12 caractères). `docIdentity().docId` est l'identifiant court, comme chez Sync+.
- **Grist ne donne pas la clé d'un formulaire publié à un widget.** Le serveur la crée à la publication et la garde dans sa base (`shares.key`) ; le client de Grist la lit par son canal interne (`docComm.getShare`, `FormView.js`), qu'aucune API de widget n'ouvre, et aucune route REST (`ApiServer.js`, `DocApi.js`) ne la rend. Le moteur de Sync+ le sait (« la personne copie le lien depuis la carte du formulaire ») : **pour recevoir par webhook, la personne du document qui reçoit colle une fois le lien de son formulaire** (l'essai lit la clé dans la base du serveur d'essai, ce que personne ne peut faire ailleurs). Le mode « lien public » n'en a pas besoin, mais rend le document lisible par tous. À dire à Antoine quand le parcours sera dessiné : « un geste si possible » ne supprime pas ce collage.
- **Non mesuré** : Firefox avec un vrai Grist (Playwright ne pilote que son Firefox patché, absent du cloud : les essais sous Firefox passent par `test/firefox.mjs`, sans Grist) ; le Grist de la DINUM (passerelle, CORS réel) ; deux documents ensemble (attend le second lot de Sync+ : l'orchestration sans écran) ; la taille des vrais modèles de Publipostage+.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-sync-port.mjs`. Les essais sans Grist : `node --test prototype/test/sync-port.test.mjs`.

## 61. La vraie Form+ à `c1f84a9` dit la table de sa copie ; Publipostage+ à `de63f27` joint sans remplacement ; Grist-BI à `c5cdd30` (mesuré le 07/11, soir)

- **Form+** `886c550` (consigne 026, point 3) : `duplicateManagedForm` rend `{ id, tableId }` et `GfsLink.onDuplicate` met le nom de la table dans `dit`. Rejoué avec la vraie app dans un vrai Grist (grist-static, `labo/run-composite-form.mjs`, 700 × 400, vraie souris et vrai clavier) : la phrase dite bout à bout est « Copie faite : « Inscription à une formation (1) ». Elle n’est pas publiée. Ses réponses iront dans une nouvelle table, « Clients_copie », vide. » (et l'anglaise : « Copy made: … »)  ; la table de la copie est `Clients_copie`, vide ; le reste de la section 58 tient. **25 vérifications en français clair et en anglais sombre, aucune en échec.** Aucune fenêtre d'accord : choix assumé par l'app (une fenêtre attendrait un clic sur un écran pas forcément affiché et GFS abandonnerait l'appel au bout de 20 s).
- **Publipostage+** `de63f27` (huit commits depuis `3bb6d95`) : `run-joindre-publipostage` rejoué sur un vrai serveur Grist 1.7.19, 23 vérifications en français clair et en anglais sombre, aucune en échec. La politique de sécurité, la carte d'importation, les bibliothèques et les extensions ne changent pas. Non mesuré : l'import d'un Word par « Nouveau > Importer » (la valeur n'est pas déclarée), Firefox, le Grist de la DINUM.
- **Grist-BI** `c5cdd30` : `run-bi` (25) et `run-bi-fermer` (7) rejoués, en français clair et en anglais sombre, aucune en échec. Le bandeau de lecture seule est dans `index.html` (`#shared-readonly-warning`, masqué) ; non joué : un rapport réellement partagé en lecture seule.

## 62. « Nouveau > Importer > Word » avec la vraie Publipostage+ (mesuré le 07/11, soir)

- **Décision du porteur** (07/11, carte « Ajouter Word au sous-menu Nouveau > Importer ? », « Oui, ajouter ») après la demande de l'app (`187464a`, sa page à `de63f27`). `actions.importer` de `manifestes/publipostage.json` gagne `{ valeur: word, type: document, extensions: .docx .docm .dotx .dotm }`, les quatre extensions de la ligne « Importer un Word… » du menu « + » de l'app. Aucun code de GFS : le sous-menu, le sélecteur, l'ouverture et l'appel `ouvrir` lisent le manifeste (contrats 2.7 point 4, 5.2 point 3).
- **Mesuré avec la vraie app** (`labo/run-importer-pp.mjs`, grist-static, 700 × 400, vraie souris et vrai clavier ; un `.docx` de deux paragraphes écrit dans l'essai) : le sous-menu liste Excel, Markdown, PowerPoint, Word, puis le PDF ; Word n'est pas grisé (sans extension à cocher), dit « Document » et prend la couleur du document ; le sélecteur propose `.docx,.docm,.dotx,.dotm`, un seul fichier ; l'app déjà ouverte pose sa question d'enregistrement (le document précédent est sans nom), puis montre le document du fichier avec la phrase « Word importé. Nommez le modèle puis enregistrez-le. » ; GFS repart (app fermée) : le Word part avec l'ouverture du contexte et remplace le ★ ; un fichier illisible (`faux.xlsx`) laisse le document Word et ne pose pas de question ; rien n'est écrit dans le document pendant toute la passe ; aucun avertissement de GFS, aucune erreur de page. **40 vérifications en français clair, anglais sombre, français sombre et anglais clair, aucune en échec** (33 avant le Word).
- **Non mesuré** : Firefox (le sélecteur de fichier du navigateur et le rendu du sous-menu), un vrai Word de Microsoft (le fichier de l'essai est écrit à la main, minimal), un `.dotm` ou `.docm` avec macros, le Grist de la DINUM.

## 63. La colonne « Auteur » du journal d'Automation+ se remplit dans GFS : la capacité « formules » est déclarée (mesuré le 09/11)

- **Décision du porteur** (09/11, carte « Remplir la colonne « Auteur » du journal d'Automation+ dans GFS ? » ; il demandait si la gestion des identités par GFS répondait à la question : non, l'app écrirait elle-même l'adresse, un texte modifiable, alors que dans Grist seul Grist la met à la création de la ligne ; « sinon partir sur le A »). `manifestes/automation.json` déclare `permissions.formules` avec sa raison (fr, en). `identite` reste non déclarée : GFS ne donne pas l'adresse à l'app.
- **Avant** (témoin `LAB_SANS_FORMULES=1`, capacité retirée du manifeste le temps de la passe) : `AddTable Automation` est refusée par le courtier (« Une colonne à formule demande la capacité « formules » », avertissement de GFS), l'app se rabat sur une table sans formule, `Auteur` reste vide.
- **Après** (`labo/run-auteur-automation.mjs`, la vraie Automation+ au commit référencé, grist-static, le moteur du labo remplit `user.Email` avec la personne du moment) : la colonne `Auteur` existe avec la formule `user.Email`, `isFormula` faux, `recalcWhen` 0 (déclenchée à la création) ; deux lignes de journal ajoutées par deux personnes portent chacune leur adresse, la première n'est pas réécrite ; l'app n'a écrit que `AddTable` et deux `AddRecord`, sans valeur d'auteur ; GFS n'a rien dit. **6 vérifications par combinaison langue × thème (quatre), 5 pour le témoin, aucune en échec.**
- **Non mesuré** : un vrai serveur Grist (l'adresse vient du moteur du labo : sur un vrai serveur c'est `user.Email` de Grist, mesuré avec Form+ au 22/10), Firefox, le Grist de la DINUM. **Limite** : seules les tables créées après la déclaration ont la formule ; une table `Automation` déjà créée sans elle garde une colonne sans formule (aucun changement de colonne par GFS : changements additifs seulement).

## 64. GFS dit « tu restes » à l'app qui avait répondu « oui » à « fermer » quand la personne est revenue (mesuré le 09/11)

- **Décision du porteur** (09/11, carte « Dire à une app « finalement tu restes » après son oui à « fermer » ? », option « GFS le lui dit »). Le trou : une app qui répond `oui` à `fermer` s'est déjà préparée à partir (Automation+ lève son verrou et coupe son exécution) ; si la personne revient à l'explorateur avant la réponse, GFS ignore le `oui` tardif et l'app reste, mais arrêtée.
- **Ce qui est construit.** Appel GFS → app `rester { raison }` (contrats 5.4, point 3), réponse `{ repris: true | false }` ; `AppSession.stayApp`, `tellToStay` et `leaveApp` dans `js/broker/leave.js` (`#leave` du contrôleur passe par `leaveApp`). GFS l'envoie quand l'app a dit `oui`, qu'elle est toujours l'app active et que la personne a fait autre chose (retour à l'explorateur) ; jamais après un `non`, jamais à une app déjà remplacée. `GFS_INCONNU` et `GFS_INACTIF` ne produisent ni phrase ni avertissement ; une autre erreur, un avertissement. **Kit 0.13.0** (`28e2b76`) : `GfsLink.onStay(fn)`, sans abonné `GFS_INCONNU`. Aucun appel quand l'app visée ne peut pas être activée : GFS ne demande plus à l'app active de se fermer pour rien (`#openable`).
- **Mesuré** (`labo/run-fermer.mjs`, vrai Grist grist-static, sonde O à `body[data-rester]`, 700 × 400, souris réelle) : l'app muette qui répond `oui` après le retour à l'explorateur reçoit `rester` une fois avec la raison « explorateur », sans connaître l'appel elle répond `GFS_INCONNU` (aucune fenêtre, phrase ni avertissement) ; une app qui répond `non` ne reçoit rien ; l'app et l'explorateur restent en place. **36 vérifications par combinaison langue × thème (quatre), aucune en échec.** `labo/run-liens-kit.mjs` avec le **vrai client du kit** 0.13.0 : l'abonné `onStay` reçoit la raison « lien », `openFile` rend `false`, l'app reste, GFS ne dit rien par-dessus (14 vérifications). `run-liens` (33) et `run-ouvrir` (16) rejoués, aucun en échec. Essais Node : `leave.test.mjs` (20), kit 443 sous Node et 28 sous Chromium.
- **Non mesuré** : une vraie Automation+ qui reprend son verrou (elle doit s'abonner : consigne à Automation+), Firefox (l'appel n'a pas d'interface).

## 65. La vraie Form+ à `2faf93b` : son guide de publication marche dans GFS, la page du formulaire est renommée (mesuré le 09/11)

- **Ce que la page d'état de Form+ demande** (le porteur : « je crois que Form+ a une demande pour toi », 09/11) : `_grist_Views` en lecture et `name` en écriture, pour renommer la page que Grist crée pour « Partir de zéro » (« New page », en anglais quelle que soit la langue, tout en bas de la liste) en « Formulaire <table> » / « Form <table> ». Un seul `UpdateRecord`, dans son propre lot : sans la déclaration le courtier refusait (Form+ gardait « New page » et le disait). **Déclaré** dans `manifestes/form.json` (entrée `gristInterne` à une table, `lit: true`, `ecrit: ["name"]`, raison en français et en anglais). Les deux autres demandes (ouvrir une page hors du cadre, Leaflet) ont une carte posée au porteur : rien n'est codé.
- **Relu dans le diff de `c1f84a9` à `2faf93b`** (trois commits, 16 fichiers) : aucune adresse nouvelle, aucune politique de sécurité touchée (`widget.html` : un `div`), aucun `fetch`, aucun `window.open` hors de l'app seule (en GFS le guide donne l'adresse à copier : un onglet ouvert depuis le cadre hérite de son bac à sable, contrats 1.3, point 1) ; ce que le guide lit et écrit en plus à travers le courtier : `_grist_Views.name` (déclaré ici), `_grist_Views_section.shareOptions` en lecture toutes les 2,5 s tant qu'il attend la publication (déjà déclaré), `getAccessToken({ readOnly: true })` (« jeton », déjà déclaré), `storageSet('formplus_pending_guide')` (stockage de la personne chez GFS). `navigator.clipboard.readText` est refusé dans le cadre (Grist ne délègue que `clipboard-write`) : l'app le tolère et laisse coller.
- **Mesuré avec la vraie Form+** (`labo/run-form.mjs`, grist-static, 700 × 400, souris réelle, Chromium) : « Partir de zéro » ne rencontre aucun refus du courtier ; la page prend le nom « Formulaire Reponses » / « Form Responses » (relu dans `_grist_Views`) ; le guide est à l'écran à l'étape 1 et nomme la page ; le Grist du labo ne délivre pas de jeton, Form+ dit alors où est la page (« tout en bas de la liste des pages ») sans lien ni bouton ; « J'ai ouvert la page » mène à l'étape 2 (« J'attends la publication ») ; le geste « Publier », fait à la main depuis le cadre de GFS, amène l'étape 3 tout seul (Form+ relit `shareOptions` à travers le courtier) ; le lien se tape dans le champ du guide, Entrée l'enregistre : mêmes fenêtres qu'avant sauf **une seule fenêtre de GFS** (la lecture de `Definition`), la table des réponses étant déjà ouverte à l'ajout par le « Publier » de la personne. **53 vérifications par combinaison langue × thème (quatre), aucune en échec** ; `run-composite-form` 25, `run-ouvrir-form` 17, aucune en échec.
- **Non mesuré** : l'adresse de la page à copier dans GFS (`pageUrlFromBaseUrl` avec l'adresse du jeton et l'instance de GFS) sur un vrai serveur ; Firefox ; la reprise du guide après le rechargement du cadre quand la personne revient d'un autre onglet de Grist.

## 66. Le port de GFS sur le REST du moteur 2.1.0 : les 40 vérifications du vrai Grist passent encore (mesuré le 09/11)

Sync+ a livré les consignes 003 à 005 (moteur **2.0.0** `09143dd`, **2.1.0** `3447b9f`, relu à `e7054cc`) : le REST du port n'est plus écrit par GFS mais une fois par le moteur (`createRestPort`), et le kit passe à la 0.14.0. `prototype/js/sharing/sync-port.js` tombe de 289 à 125 lignes : il ne garde que ce que seul GFS sait (lignes et schéma par `grist.docApi`, identité du document, propriétaire par le cadre, verrou, langue, page, préférences) et le `http` qui porte le REST sur le cadre d'envoi.

- **Mesuré** (`labo/run-sync-port.mjs`, vrai Grist 1.7.19, Chromium, `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`) : **les mêmes 40 vérifications, aucune en échec** après le changement de moteur ; la console de GFS reste vide. Les essais du port sans Grist : 16 (`test/sync-port.test.mjs`).
- **Un écart a été rattrapé par la mesure, pas par les essais** : le lien d'une autre instance collé à `shareInfo` arrivait comme « La réponse de Grist n'est pas celle qu'on attend » (le cadre refuse l'adresse et le moteur 2.1.0 ne sait pas lire cette erreur) ; le `http` de GFS dit maintenant `otherInstance` avant d'envoyer quoi que ce soit, comme `postRows` (une erreur que le moteur connaît et dit à la personne).
- **`docChanges` d'un état perdu** (500 « Cannot read hash », vu sur Grist 1.7.19) : le moteur 2.x rend lui-même `tables: null` (correction de Sync+ `6159c08`, demandée par la consigne 004) ; le code de GFS qui le faisait est supprimé et son essai passe sur le code du moteur.
- **Un serveur muet** n'est plus « shareUnreadable » : l'erreur dite du cadre (« Le serveur Grist ne répond pas. ») remonte telle quelle, sans code, comme le moteur la lit.
- **Non mesuré** : Firefox avec un vrai Grist ; le Grist de la DINUM ; deux documents ensemble (les enchaînements sans fenêtre du moteur 2.x sont prêts, GFS n'en a pas encore dessiné l'écran).

## 67. Un PDF passe d'un document Grist à un autre, par le moteur de Sync+ et le port de GFS, dans un vrai Grist (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19 (`labo/run-sync-partage.mjs`, Chromium, `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`), le parcours du moteur 2.1.0 joué sans écran avec les vraies fonctions (`saveChosenExport`, `startInvitation`, `invitationCode`, `readInvitation`, `createReception`, `receptionReply`, `checkReply`, `approveReply`, `catchUp`, `consolidateAll`). **Les 21 vérifications passent**, la console de GFS reste vide dans les deux pages.

- **Un seul fichier part** : l'export porte une condition sur la colonne `Identifiant` de `GFS_Fichiers` (`{ mode: 'all', conds: [{ id: 'Identifiant', op: 'eq', values: [<identifiant du PDF>] }] }`) ; l'autre PDF du document reste chez lui, la table reçue n'a qu'une ligne. `loadPlan` dit « 1 fichier » avant l'envoi.
- **Ce que le premier document gagne** : une table, `GFS_Synchro`, et trois colonnes dans `GFS_Fichiers` (`id_sync`, `MajLe`, `RecalculLe`, remplies pour **toutes** les lignes de la table, pas seulement celle qui part) ; un webhook par destinataire (`Synchro Facture #…`, sur `GFS_Synchro`). Rien d'autre.
- **Ce que le second gagne** : une table de réception `GFS_Journal_<export>` avec sa page et son formulaire publié, et la table reçue que GFS choisit (ici `GFS_Recus`, **séparée de `GFS_Fichiers`**, qui n'existe pas dans ce document), avec sa page. Deux tables et deux pages. **Aucune règle d'accès n'est écrite** quand `options` est vide (relu dans `_grist_ACLRules` des deux documents : la seule ligne est celle que Grist pose) ; le moteur sait rendre la table reçue en lecture seule et ranger une archive par une option de la réception (`options`), à décider avec les permissions de GFS avant de la proposer à l'écran.
- **Le lien du formulaire** (« Copier le lien » de Grist : `…/forms/<clé>/<n>`) est collé une fois à la réception ; `receptionReply` envoie une ligne d'essai par la clé et vérifie qu'elle arrive **dans ce journal** : une clé qui n'existe pas est refusée (`linkTest`), sans jamais la dire en entier. Le code de contrôle est le même des deux côtés (`WGV-ME3` dans un passage).
- **`checkReply` demande à Grist de quel document est la clé** (sans jeton, depuis le cadre opaque) : la fiche dit l'identifiant **complet** du second document, c'est lui que la SOURCE montre, pas ce que le code affirme.
- **Le contenu du PDF n'arrive pas avec la ligne** : la ligne arrive d'abord (nom, taille, `Contenu` vide), puis le contenu par un **second passage de la SOURCE** (`catchUp`, le rattrapage, qui envoie les fichiers en morceaux par la clé du formulaire, une fois par destinataire) et la CIBLE le recopie (`consolidateAll`). Après ces passages : `Contenu = ['L', 1]`, **mêmes octets** (SHA-256, 1 633 octets, `application/pdf`). **Les deux passages sont des boucles que la page du document fait tourner seule tant qu'elle est ouverte** (`startAutoCatchUp` pour la SOURCE, propriétaire seulement ; `startAutoConsolidation` pour la CIBLE) : GFS doit donc les lancer au démarrage de la page dès qu'un document a ces tables, pas seulement au premier partage (à construire avec l'écran).
- **Non mesuré** : Firefox avec un vrai Grist ; le Grist de la DINUM (webhooks vers sa propre instance, passerelle) ; deux personnes différentes (ici la même personne d'essai ouvre les deux documents) ; les règles d'accès du moteur avec celles de GFS ; un fichier de plusieurs mégaoctets (le seuil de la taille maximale de l'instance, `uploadErrors`).
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-sync-partage.mjs`.

## 68. La fenêtre « Envoyer à un autre document » : le même passage, à la vraie souris, dans un vrai Grist ; la reprise à l'ouverture de la page (mesuré le 09/11)

Le premier document est celui de la personne : tout passe par les fenêtres de GFS (`labo/run-partager-autre.mjs`, Chromium, 700 × 400, vraie souris et vrai clavier, français et anglais, clair et sombre ; **24 vérifications dans chacune des quatre passes**). Le second est piloté par l'essai avec les fonctions du moteur (le côté qui reçoit n'a pas encore d'écran dans GFS) : il lit l'invitation, crée sa réception dans `GFS_Recus`, répond.

- **Le geste** : « Partager… » d'un PDF, puis la ligne **« Un autre document Grist… »** du champ d'ajout. Elle est dégrisée pour le propriétaire du document **même quand les droits de GFS ne sont pas activés** ; elle reste grisée, avec sa raison dite au clic, pour un fichier d'app, pour qui n'est pas propriétaire, ou sans le geste branché.
- **Rien n'est écrit avant l'accord** : la fenêtre d'accord dit ce que GFS ajoute (la table `GFS_Synchro`, retirée à la fin ; trois colonnes d'aide `id_sync`, `MajLe`, `RecalculLe` dans `GFS_Fichiers`, qui restent ; un webhook, retiré à la fin ; côté de l'autre, une table de réception et `GFS_Recus`). Échap sur l'accord ne laisse aucune table ni colonne ; « Continuer » les pose et rend le code d'invitation. Un document qui ne partage rien **ne charge pas le moteur** (aucun fichier de `kit/js/synchro/` demandé à l'ouverture).
- **La réponse collée est jugée par le moteur, jamais par GFS** : un texte qui n'est pas un code est refusé par son message (« Ce texte n'est pas un code de synchro… ») sans quitter l'écran ; la bonne réponse montre le document **dit par Grist** (son nom, son dossier ou « espace personnel ») et le **code de contrôle**, le même des deux côtés.
- **« Envoyer le fichier »** : le fichier arrive dans `GFS_Recus` de l'autre document avec **les mêmes octets** (SHA-256, 1 633 octets), le partage s'arrête (plus de table `GFS_Synchro`, plus de webhook, les colonnes d'aide restent) et la fenêtre le dit. **« Annuler » après le code défait ce qui était préparé** (table technique retirée, les deux PDF intacts).
- **Reprise à l'ouverture** (`js/sharing/sync-resume.js`) : la page de l'autre document est **fermée puis rouverte** ; GFS y voit un journal reçu (`GFS_Journal_…`) et relance la boucle de réception du moteur : **le contenu du PDF arrive sans que l'essai fasse rien** (avant, il fallait que l'essai lance `consolidateAll`). Une table `GFS_Synchro` relance de même l'envoi laissé en route. Rien ne se charge sans l'une de ces tables ; des tables illisibles ne reprennent rien et ne lèvent rien.
- **Un bouton grisé de cette fenêtre tombait à 2,4:1** (texte blanc sur le bleu pâli par la transparence de la base des boutons) : grisé, il est maintenant texte atténué, fond neutre et bordure en pointillés, comme celui de « Droits » (`opacity: 1`).
- **Sous Firefox** (`test/partager-autre-firefox.mjs`, dans `test/interfaces-firefox.test.mjs`) : l'accord, le code (« Contrôler » grisé tant que rien n'est collé, le refus dit sans quitter l'écran), le document qui répond (dans un dossier, dans l'espace personnel), l'envoi, la fin, l'échec (préparation refusée, envoi bloqué avec « Arrêter le partage », fenêtre fermée en cours d'envoi et avis à la fin), et la ligne de « Partager » qui ouvre la fenêtre par-dessus (Échap ne ferme qu'elle) tiennent dans la page à 700 px, en français et en anglais, en clair et en sombre : **0 écart**. Les réponses du parcours y sont des doublures : le moteur et Grist se mesurent dans le vrai Grist.
- **Non mesuré** : le côté qui reçoit dans GFS (pas d'écran : la carte du porteur est sans réponse) ; Firefox avec un vrai Grist ; le Grist de la DINUM ; deux personnes différentes ; un fichier de plusieurs mégaoctets.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-partager-autre.mjs` (`LAB_LANG=en LAB_SCHEME=dark` pour l'anglais et le sombre).

## 69. Après une première acceptation, un fichier de plus arrive sans nouvelle invitation, et son nom est lisible avant la recopie (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19 (`labo/run-sync-suite.mjs`, Chromium, `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`), le moteur 2.1.0 et le port de GFS, sans écran : un premier partage (Facture), l'export **reste actif**, puis la condition de l'export est élargie. **Les 7 vérifications passent**, la console de GFS reste vide dans les deux pages.

- **Élargir l'export d'un partage déjà accepté** (`saveChosenExport({ exp, … })` puis `finishEdit`) : le second PDF (Devis) part par le **même webhook** et arrive dans le **même journal**, puis dans `GFS_Recus` avec son contenu, **sans nouveau code ni nouveau lien collé**. Un seul webhook reste chez l'envoyeur après les ajouts.
- **Un PDF neuf de l'envoyeur n'arrive pas tout seul** : l'export le nomme par son identifiant, il faut qu'un geste de GFS l'ajoute à la condition (pour un dossier partagé « à jour », c'est GFS qui élargirait la condition quand un fichier est rangé dans le dossier). Une fois ajouté, il arrive avec son contenu.
- **Le nom d'un fichier arrivé est lisible dans le journal de la cible avant la recopie** (colonne `Synchro_Lot` des lignes `lot`), tant que la boucle de réception n'a pas recopié : ce sont les vraies lignes, non un nom annoncé. **Mais la boucle de réception du moteur recopie tout de suite quand la page est ouverte** : retenir une arrivée jusqu'à l'acceptation n'existe pas dans le moteur ; ce serait à GFS (poser les arrivées « à accepter », invisibles aux apps et à l'explorateur, jusqu'à un clic).
- **Non mesuré** : un second partage vers le même document sous **un autre export** (l'invitation d'un export ne sert qu'à lui) ; la taille d'un journal qui reçoit longtemps ; retirer un fichier de la condition (arrêter de partager ce fichier) ; ce que fait la boucle de réception d'une arrivée refusée.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-sync-suite.mjs`.

## 70. Retirer un fichier d'un partage « à jour », une condition qui ne reste jamais vide, la vie d'un lien dans GFS (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19 (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`), le moteur 2.1.0 et le port de GFS. Deux essais : `labo/run-sync-retrait.mjs` (le moteur seul, sans écran, **10 vérifications**) et `labo/run-partager-liens.mjs` (la vie d'un lien dans les fenêtres de GFS, à 700 × 400, vraie souris, français clair et anglais sombre : **toutes passent dans les deux passes**, console de GFS vide).

- **Retirer un fichier de la condition d'un export** (`saveChosenExport({ exp, … })` puis `finishEdit`) : avec une réception **normale**, la ligne est **effacée chez l'autre** document (son contenu avec elle) ; avec une réception **« en archive »** (option du moteur), **la copie reste**, contenu compris, et sa ligne porte `Supprimee_a_la_source` à vrai. Les autres fichiers ne bougent pas. **GFS reçoit donc toujours en archive**, et « Arrêter la copie » ne reprend rien à l'autre.
- **Remettre le fichier dans la condition** : il revient **sans doublon** (une seule ligne).
- **Une condition `in` SANS valeur est écartée par le moteur, et TOUS les fichiers partent** (mesuré : le PDF jamais cité part avec les autres). Quand le dernier fichier sort, GFS nomme donc un identifiant qui n'existe pas (`gfs-aucun`, `js/sharing/share-links.js`) : la condition reste valide, aucun fichier ne part, le PDF jamais cité reste chez l'envoyeur.
- **Un document relié, c'est un export du moteur dont la condition nomme les fichiers partagés** (`Identifiant in […]` sur `GFS_Fichiers`). « Copie à jour » = le fichier est dans la condition ; « Pas partagé » = il n'y est pas ; « Une copie, une fois » = il y entre, part (rattrapage jusqu'à « rien à envoyer »), puis sort de la condition **relue à ce moment-là** (un fichier ajouté entre-temps ne disparaît pas avec lui). Les liens se lisent dans la note de `GFS_Synchro` et les webhooks (le nom du document est dans le mémo du webhook) ; un échange, un lien public ou un export d'une autre origine n'est pas un lien de GFS et reste là où il est.
- **Dans GFS, de bout en bout** : « Une copie qui se met à jour » laisse un webhook et `GFS_Synchro` chez l'envoyeur et amène Facture chez l'autre ; l'onglet liste ce document avec le niveau **de chaque fichier** (Facture « Copie à jour », Devis « Pas partagé ») ; Devis passe à « Copie à jour » par le menu et arrive **sans nouveau code ni fenêtre d'envoi** ; « Arrêter la copie » le sort du partage et **la copie reste** ; « Une copie, une fois » le renvoie puis le sort tout seul de la condition ; « Gérer les partages > Autres documents » liste le lien, « Arrêter » **demande d'abord** (le clavier sur « Annuler », qui n'arrête rien), puis il ne reste **ni webhook ni table technique** chez l'envoyeur ; les deux PDF restent chez l'autre et chez l'envoyeur.
- **Sous Firefox** (`test/partager-autre-firefox.mjs`, `test/partager-firefox.mjs`) : l'accord offre « Une copie, une fois » et « Une copie qui se met à jour » (la fin dit si le lien reste), l'onglet de « Partager » (trois liens : à jour, en attente de réponse, bloqué ; le menu des niveaux, « Arrêter la copie » grisé avec sa raison pour un fichier pas partagé ; un lien en attente verrouillé, un clic dit pourquoi ; sans lien et lien illisible), « Gérer les partages > Autres documents » (annuler une invitation en attente) tiennent dans la page à 700 px, en français et en anglais, en clair et en sombre : **0 écart**.
- **Non mesuré** : deux liens vers deux documents différents depuis le même document ; plusieurs milliers de fichiers dans une condition ; le côté qui reçoit dans GFS (lot suivant : « à accepter ») ; Firefox avec un vrai Grist ; le Grist de la DINUM.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-sync-retrait.mjs` et `node run-partager-liens.mjs` (`LAB_LANG=en LAB_SCHEME=dark` pour l'anglais et le sombre).

## 71. Recevoir d'un autre document Grist depuis GFS : de l'envoi au fichier reçu, à la vraie souris, dans un vrai Grist (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19 (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*"`), le moteur 2.1.0 et le port de GFS. Essai : `labo/run-partager-recevoir.mjs` (700 × 400, vraie souris, **19 vérifications, toutes passent en français clair et en anglais sombre**) ; le seul geste que l'essai fait à la place de la personne est de lire le lien du formulaire dans la base du serveur d'essai (Grist ne le donne pas à un widget : la personne le copie dans Grist).

- **« Nouveau > Importer > D'un autre document Grist… »** est dans le sous-menu, dégrisé pour le propriétaire. Un texte qui n'est pas un code est refusé par le moteur (« Ce texte n'est pas un code de synchro… ») et la fenêtre reste où elle est ; **Échap n'écrit rien** (ni journal ni table).
- **L'accord dit ce que GFS ajoute** (la table, un journal technique et la page de son formulaire) ; **rien n'est écrit avant « Accepter »** (mesuré : aucune table de plus à ce moment). « Accepter » crée le journal (`GFS_Journal_<nom du document>`), la table et la page du formulaire.
- **Le lien du formulaire** : un lien qui n'écrit pas dans ce journal est refusé par le moteur (« Ce lien n'écrit pas dans le journal de cette réception… »), la fenêtre reste où elle est ; le bon lien rend **la réponse et le code de contrôle**, et **l'envoyeur, en la collant, voit le MÊME code**. Il envoie : **le fichier arrive dans `GFS_Recus`, mêmes octets** (taille et empreinte identiques), sans autre geste (la boucle de réception démarre à la réponse).
- **Une destination ne reçoit les fichiers que d'un seul partage** : un second partage, vers `GFS_Recus` déjà prise, est refusé par le moteur (`destTaken`, `kit/js/synchro/logic/journal.js`) ; GFS choisit donc la première table libre, **`GFS_Recus_2`** (jamais une table qui existe déjà), et l'accord la nomme. Mesuré : le second journal et `GFS_Recus_2` sont créés à l'acceptation.
- **Fermer avant la réponse défait ce qui avait été créé** : « Annuler » après « Accepter » supprime le second journal et `GFS_Recus_2` ; `GFS_Recus` et la première réception, avec son fichier, restent.
- **Aucune erreur de GFS dans la console**, des deux côtés, à une exception rare : quand le dernier partage « une fois » prend fin, le moteur efface sa table technique (`GFS_Synchro`) pendant qu'un passage de son rattrapage la lit, et la console de l'envoyeur dit **une fois** « KeyError 'GFS_Synchro' » (sans suite : le partage a abouti, le fichier est arrivé). Constaté sur 3 passes de suite après le redémarrage du serveur d'essai, puis plus du tout : une course dans le moteur de Sync+ (`kit/js/synchro/source/resend.js`, `catchUp`), pas dans GFS ; l'essai la relève et ne la compte pas. À signaler à Sync+ quand une consigne s'y posera (il suffirait de traiter l'absence de la table comme « rien à renvoyer »).
- **Sous Firefox** (`test/partager-recevoir-firefox.mjs`, 0 écart, 700 px, clair et sombre, fr et en) : la fenêtre sur une doublure du parcours ; à chaque écran elle tient dans la page, titre et boutons en place ; « Continuer » grisé tant que rien n'est collé, un refus dit sans quitter l'écran, l'accord d'un premier et d'un second partage (la table libre), une réception qui reprend, le lien refusé, la réponse et son code, fermer avant ou après la réponse.
- **Non mesuré** : la réception depuis un autre Grist que le serveur d'essai (le Grist de la DINUM) ; plusieurs milliers de fichiers ; « Partagés avec moi » « à accepter » et les noms avant l'accord (carte posée à Antoine, rien codé) ; la cloche Notifications ; l'arrivée automatique après la première fois.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-partager-recevoir.mjs` (`LAB_LANG=en LAB_SCHEME=dark` pour l'anglais et le sombre).

## 72. « Partagés avec moi » : où retenir qu'un fichier reçu est accepté ou refusé (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19, réception « en archive » (ce que fait GFS), le moteur 2.1.0. Essai : `labo/run-recus-etat.mjs` (sans écran ; **9 vérifications, toutes passent**). Rien de la vue n'est codé : cette mesure décide de la façon de retenir le choix de la personne.

- **Grist accepte d'ajouter deux colonnes de GFS (`Accepte`, `Refuse`, Bool) à la table reçue**, et le moteur les laisse : après un renommage du fichier chez l'envoyeur, la mise à jour arrive **sur la même ligne** (pas de doublon), le nom change, **la marque tient** (Facture reste acceptée, Devis reste refusé). Aucun passage du moteur n'a levé d'erreur ; les deux colonnes sont toujours là à la fin.
- **Effacer la ligne d'un fichier refusé ne suffit pas : elle REVIENT** à la mise à jour suivante de l'envoyeur (mesuré : une nouvelle ligne de Devis réapparaît avec son contenu). Un refus se **marque**, il ne s'efface pas ; refuser = `Refuse` à vrai (la ligne reste, cachée de l'explorateur et des apps).
- **Un fichier nouveau arrive sans marque** (`Accepte` et `Refuse` à faux) : c'est lui qui est « à accepter ». Son vrai nom et son contenu sont déjà là.
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" node run-recus-etat.mjs`.

## 73. « Écrire » ne doit pas mener à « administrer » : l'auteur d'un PDF partagé (mesuré le 09/11, audit de sécurité)

Vrai Grist 1.7.19, trois comptes (`labo/run-partager-auteur.mjs`, deux temps ; `labo/run-partager.mjs` 25 et `labo/run-partager-fenetre.mjs` rejoués en entier après le correctif, aucun échec).

- **Le défaut, mesuré avant le correctif** : f2 est au propriétaire, partagé à editor@ avec « écriture » seulement. editor@ le renomme (son droit), puis réécrit « Auteur » avec son adresse : Grist accepte (200), `GFS_Admins` de f2 devient `[editor@]`, il efface f2 (200) et donne l'administration à viewer@ (200). Le geste de l'explorateur qui remplace un PDF réécrit lui aussi « Auteur » : un porteur d'« écriture » devenait administrateur sans tricher.
- **Le correctif** : l'auteur d'un PDF est `GFS_Auteur`, la colonne que Grist écrit à la création, comme pour les fichiers des apps (`FILES_TARGET.stamped`). Mesuré : le même scénario laisse `GFS_Admins` de f2 à `[essai@]` ; réécrire « Auteur » reste permis (c'est « le dernier qui a modifié »), changer `GFS_Auteur` est refusé (« Blocked by column update access rules »), créer un fichier au nom du propriétaire est refusé, effacer f2 est refusé, donner l'administration de f2 à viewer@ ne vaut rien (`Valide` faux), et editor@ crée son propre fichier (Grist écrit son adresse).
- **Les PDF d'avant** : une colonne à formule `$Auteur` qu'on rend ordinaire (`ModifyColumn { isFormula: false, formula: 'user.Email', recalcWhen: 0 }`) **garde ses valeurs** et ne s'applique qu'aux nouvelles lignes (mesuré : deux lignes d'avant reprises, une ligne neuve à l'adresse de la personne même quand elle donne une autre valeur). Le plan fait les deux dans la même liasse que les colonnes d'aide ; une table partagée avant est reprise par « Compléter » (`share-control.js` : `upgrade`).
- **Pas mesuré** : le placement (`GFS_Placement`, les espaces) ; une reprise d'un partage déjà actif depuis l'interface (le plan l'a rejoué avec `existing` d'un document d'avant, sans règles) ; Firefox.
- **Rejouer** : `bash prototype/labo/vrai-serveur.sh`, puis `PHASE=proprietaire node run-partager-auteur.mjs` ; `GRIST_EMAIL=editor@example.com bash vrai-serveur.sh` et `PHASE=editeur node run-partager-auteur.mjs` (depuis `prototype/labo`, `REPO_DIR="$(realpath ../..)"`). Le Grist de test se tire de `mirror.gcr.io/gristlabs/grist:1.7.19` quand Docker Hub refuse (limite de débit), puis `docker tag mirror.gcr.io/gristlabs/grist:1.7.19 gristlabs/grist:1.7.19`.

## 74. Le code de contrôle du partage entre documents, exigé par défaut (mesuré le 09/11, audit de sécurité)

Choix du porteur (carte du 09/11) : « Exiger la comparaison du code de contrôle » est coché au départ, la personne peut le décocher. Essai : `labo/run-partager-autre.mjs`, vrai Grist 1.7.19, la vraie fenêtre à la vraie souris, 700 × 400 (`LAB_STRICT=0` décoche le réglage).

- **Coché (par défaut)** : GFS demande une invitation en sécurité renforcée (`startInvitation(exp, { renforce: true })`). L'autre document, qui répond avec le moteur ordinaire (une réception à sens unique n'a pas à comparer), donne le **même code de contrôle** que celui de la fenêtre. « Envoyer » est grisé tant que « J'ai comparé ce code avec celui de l'autre document » n'est pas coché ; un clic dessus (forcé, une vraie souris le donne) n'envoie rien : aucun webhook, la fenêtre reste. Cochée, la case laisse partir le fichier, mêmes octets chez l'autre (27 vérifications, aucun échec).
- **Décoché** : pas de case, « Envoyer » dégrisé, l'invitation est celle d'avant ; le fichier arrive (25 à 26 vérifications). **Le moteur refuse aussi sans la case** quand l'invitation est renforcée : `approveReply` lève `codeNotCompared` avant toute écriture (essai unitaire `test/share-other-flow.test.mjs`, le moteur est la barrière, pas seulement la fenêtre).
- **Un bruit vu une fois sur trois passages** : `KeyError 'GFS_Synchro'` dans la console, de `kit/js/synchro/source/resend.js` : le rattrapage lit la table technique juste après que « une fois » l'a supprimée. Même passage sans le correctif : propre ; le bruit ne dépend pas du réglage.
- **Sous Firefox** (`test/partager-autre-firefox.mjs`, mesure de la seule fenêtre : 0 écart, fr et en, clair et sombre, 700 px) : le réglage est là, coché, se décoche et se recoche à la souris ; avec lui, le clavier arrive sur la case, « Envoyer » grisé et muet, dégrisé par la case ; sans lui, pas de case. **Espace sur la case ne se joue pas** dans ce Firefox sans écran.
- **Pas mesuré** : l'effet de l'invitation renforcée sur un partage « à jour » plusieurs mois après (les fichiers suivants ne passent plus par le code) ; Firefox avec un vrai Grist.

## 75. « Partagés avec moi » dans GFS : accepter et refuser à la vraie souris, dans un vrai Grist (mesuré le 09/11)

Deux documents qui ont GFS, sur un vrai Grist 1.7.19, le moteur 2.1.0, à 700 × 400, à la vraie souris, en français clair et en anglais sombre. Essai : `labo/run-partages-recus.mjs` (**30 vérifications, toutes passent dans les deux ambiances** : 23 pour la vue, 6 pour la cloche, 1 pour l'arrivée en direct). Le premier partage est monté par les fonctions du moteur (la fenêtre qui reçoit un premier code est mesurée au 71) ; la vue, la question et les marques sont celles de GFS.

- **Deux arrivées sont « à accepter »** : l'entrée « Partagés avec moi » du volet porte leur nombre (2), les lignes sont grisées (cadenas), leur mot est « À accepter », elles n'ont pas d'étoile (pas de rangement) mais gardent leur menu. Ni « Moi » ni « Récents » ne les montrent : `loadFiles` les rend à part, rien de ce qui lit les fichiers vivants ne les voit.
- **Échap n'écrit rien** : après la question fermée, la table reçue n'a ni colonne `Accepte` ni `Refuse`, aucune marque. **Les colonnes naissent au premier oui ou non** (`OwnTable.existing`), jamais une table (depuis l'audit du 11/11, fait 101 : les deux colonnes de marque sont créées dès la réception par le parcours de GFS ; `OwnTable.existing` reste le repli) : après « Accepter » et « Refuser », la liste des tables du document est celle d'avant.
- **« Accepter »** dégrise la ligne (son mot redevient « PDF », le nombre baisse) et pose `Accepte` sur SA ligne ; **« Refuser »** la masque et pose `Refuse` sur la sienne. Les deux lignes sont toujours dans `GFS_Recus`.
- **L'envoyeur renomme les deux fichiers** : l'accepté reste accepté sous son nouveau nom, le refusé ne revient pas, aucun doublon (la marque tient : 72). **Un fichier de plus arrive** : lui seul est « à accepter » et compté.
- **Une arrivée acceptée se lit comme un PDF que GFS garde** : le bouton dit « Lire » (une app lit les PDF dans ce document d'essai) ; son menu ne propose que la lecture ; le menu d'une arrivée en attente n'offre que « Accepter ou refuser… » (ni corbeille, ni renommage, ni copie : la table est celle du partage).
- **La cloche Notifications suit la liste** : la pastille dit 2 (et le nom du bouton « Notifications : 2 à accepter », pour la voix), le menu nomme les deux arrivées puis ouvre « Partagés avec moi », il tient dans le panneau avec un contraste de 4,5:1, un clic sur « Devis.pdf » pose la question de CE fichier ; après un « Accepter » la pastille dit 1, après le « Refuser » elle disparaît mais la cloche reste là. Rien n'est écrit par la cloche.
- **Un fichier arrive PENDANT que l'explorateur est ouvert** : l'envoyeur ajoute « Avenant.pdf » à son export ; la seule boucle qui reçoit est celle de la page ouverte (≈ 10 s) ; sans rouvrir l'explorateur, la ligne arrive grisée « À accepter », le volet et la cloche passent à 2. **Sans le branchement de GFS sur la boucle, l'essai échoue** (la liste reste à 1 : vérifié en le retirant).
- **La console de GFS reste vide** (hors la course connue du moteur, 71).
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis depuis `prototype/labo` : `REPO_DIR="$(realpath ../..)" LAB_LANG=fr LAB_SCHEME=light node run-partages-recus.mjs` (et `LAB_LANG=en LAB_SCHEME=dark`).
- **Pas mesuré** : le refus puis le regret (la marque `Refuse` s'efface à la main dans la table) ; les dossiers partagés.

## 76. Les tables techniques du partage entre documents ne se lisent plus qu'avec les droits de propriétaire (mesuré le 09/11, audit de sécurité)

Choix du porteur (carte du 09/11) : « Les fermer comme les fichiers ». Vrai Grist 1.7.19, trois comptes un à la fois (`labo/run-securite-synchro.mjs`, cinq passages : `proprietaire`, `avant`, `ferme`, `apres`, `arret`), puis les fenêtres rejouées à la vraie souris (`labo/run-partager-recevoir.mjs`, `run-relier-sans-fichier.mjs`, `run-partager-liens.mjs`, `run-partager-autre.mjs`).

- **Le défaut (avant)** : sur un vrai partage « à jour » (Facture.pdf arrivé), `editor@` et `viewer@` lisent `GFS_Synchro` de l'envoyeur (7 lignes : la signature qui authentifie les envois, la liste des fichiers et leurs noms, des morceaux de PDF) et le journal reçu de la cible (2 lignes : le nom, la référence du contenu, le sceau). Aucune règle ne les couvrait, et ces lignes n'ont pas les règles par fichier de « Partager » (faits 73).
- **Les règles** (`js/sharing/sync-rules.js`, note « GFS : Partages · … », donc « Encadré » au pied et retirées par « Retirer le partage ») : `GFS_Synchro` = propriétaires `+CRUD`, tous les autres `-CRUD` ; un journal `GFS_Journal_*` = propriétaires `+CRUD`, tous les autres `-RUD` (**la création reste ouverte** : c'est par elle que le formulaire de réception y écrit). `GFS_Recus*` n'est pas fermée (« Partagés avec moi » la lit ; carte 4c).
- **Après** : l'éditeur reçoit `403 Blocked by table read access rules` en lisant `GFS_Synchro` et le journal, et `Blocked by table create/update/delete access rules` en y écrivant ou effaçant (une colonne et une ligne qui existent : le refus vient des règles) ; le lecteur est refusé partout (`No write access`). Ni l'un ni l'autre n'a d'erreur dans la console de GFS en ouvrant la cible : pas de boucle du moteur.
- **Le partage continue** : un fichier renommé à la source arrive à la cible par le webhook, le formulaire sous `-RUD` et la boucle du propriétaire. Le propriétaire lit toujours les tables.
- **Quand les règles se posent** (propriétaire prouvé par `transfer.isOwner() === true`, jamais deviné) : **à la fermeture de la fenêtre** de l'envoi, de la réception ou de « Relier » (pas en plein parcours : Grist **recharge la page** quand des règles d'accès changent, ce qui défait la fenêtre), et à l'ouverture de la page (`js/sharing/sync-resume.js`, qui pose ce qui manque). Fermée en cours d'envoi, c'est la fin de l'envoi qui clôt. Un second passage ne pose rien et ne recharge rien (mesuré : même liste de règles, la page reste). Le texte d'accord le dit (« Grist recharge alors la page »).
- **Conséquence à connaître** : seuls les propriétaires font tourner les boucles du moteur (rattrapage de l'envoi, recopie de la réception) ; **les fichiers ne se recopient que lorsqu'un propriétaire ouvre le document**. Dit dans l'accord de la réception.
- **Arrêter le partage** : la table `GFS_Synchro` disparaît, **ses règles restent** sur une table qui n'existe plus ; le document s'ouvre et GFS est prêt, sans erreur (Grist 1.7.19 ne s'en plaint pas). Elles couvrent d'avance la table si un nouveau partage la recrée ; « Retirer le partage » les retire.
- **Pas mesuré** : un document dont une règle d'un autre auteur porte déjà sur une table technique (laissée telle quelle, essai unitaire seulement) ; Firefox avec un vrai Grist (la mesure Firefox est celle des deux fenêtres, 0 écart, fr et en, clair et sombre, 700 px).
- **Rejouer** : `GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh`, puis `PHASE=proprietaire node run-securite-synchro.mjs` ; relancer le serveur sous `GRIST_EMAIL=editor@example.com` (puis `viewer@`) pour `PHASE=avant` ; sous `essai@` pour `PHASE=ferme` ; sous chacun pour `PHASE=apres` ; sous `essai@` pour `PHASE=arret`.

## 77. GFS relie sa section à la grille de la même table : la ligne cliquée arrive à l'app, sans « Sélectionner par » à la main (mesuré le 10/11)

Choix du porteur (10/11) : « je choisis la table, celle de la page par défaut, et ça fonctionne ». Vrai Grist (grist-static 0.1.6, Chromium), 700 × 400, à la vraie souris, en français clair et en anglais sombre. Essai : `labo/run-lien-grille.mjs` (**10 vérifications ×2**, aucune en échec) ; code : `js/broker/view-link.js`, `ViewOptions.section()`, contrats 4.5 point 8.

- **Le constat** (capture du porteur, 10/11) : le panneau de droite de Grist disait « Sélectionner par : Choisir une vue » ; Publipostage+ en Lecture restait sur la première ligne de la table, quelle que soit la ligne cliquée à gauche. Rien d'un défaut de l'app : Grist ne dit à un widget que la ligne de sa propre section (faits 1, `RecordNotifier`).
- **GFS écrit le lien lui-même** : à l'ouverture, une fois, `UpdateRecord` de sa section (`linkSrcSectionRef` = la grille de la page, `linkSrcColRef` et `linkTargetColRef` à 0). Grist redit aussitôt les réglages à GFS : `settings.linking.asTarget` = `"Cursor:Same-Table"`, que l'app (la sonde I) lit aussi. La phrase « GFS a relié ce widget à la grille de « Clients » : la ligne suit votre clic. » tient sur deux lignes dans le panneau de 700 px, sans le dépasser.
- **La ligne cliquée arrive à l'app** : Martin, puis Dupont, sans le bouton « Ligne » ni le panneau de droite.
- **La marque** : `gfs.grille` = `lie` dans les réglages de la vue (une clé de GFS : l'app n'en voit rien). La personne retire le lien dans le panneau de droite (« Select widget »), GFS se recharge : **le lien n'est pas reposé et GFS ne dit rien**.
- **Les sections que Grist garde** : la page de l'essai a une grille (`record`, page 1), le widget de GFS (`custom`, page 1) et, hors page (`parentId` 0), les sections des données brutes de la même table : elles ne comptent pas comme candidates (même page seulement).
- **Pas mesuré** : Firefox avec un vrai Grist (le labo ne lance que le Firefox de Playwright, absent du conteneur ; la phrase est celle de `.toast`, déjà mesurée sous Firefox par `interfaces-firefox.test.mjs` pour les autres) ; plusieurs grilles de la même table sur la page (essai unitaire seulement : GFS le dit et n'écrit rien) ; un document dont l'utilisateur ne peut pas écrire la structure (Grist refuse : essai unitaire) ; le Grist de la DINUM ; Publipostage+ avec ce lien (`run-select-by` mesure déjà son Lecture avec un lien « Select by » posé par la personne : l'app ne voit aucune différence).
- **Rejouer** : `REPO_DIR="$(realpath ../..)" node lab-server.mjs &` puis, depuis `prototype/labo`, `LAB_LANG=fr LAB_SCHEME=light node run-lien-grille.mjs` (et `LAB_LANG=en LAB_SCHEME=dark`). Les autres passes du labo posent `?grille=0` : elles mesurent une section non reliée comme avant.

## 78. Le lecteur vidéo de GFS sous Firefox : adresse, politique de sécurité, endroit, rognage, souris, taille du panneau (mesuré le 10/11)

Le lecteur du 07/11 (faits vérifiés 56) n'avait été joué que sous Chromium, dans un vrai Grist. Banc : `prototype/test/lecteur-firefox.mjs` et `prototype/test/pages/lecteur.js`, joués par `test/interfaces-firefox.test.mjs` (Firefox 160 sans écran, posé par `labo/installer-firefox.sh`), à 700 × 400, en clair et en sombre : le vrai `Player` (`js/broker/player.js`) posé dans `.frames` par-dessus un cadre d'app isolé (`sandbox="allow-scripts"`), avec les feuilles de style et la politique de sécurité de `index.html` recopiées. **Aucun Grist** : ce que Grist délègue à GFS (`allow`) n'est pas mesuré ici. Le cloud n'atteint ni YouTube ni Vimeo (le nom ne se résout pas) : Firefox les voit répondre une petite page d'essai, par WebDriver BiDi (`network.addIntercept` puis `network.provideResponse`, `page.stub` de `test/firefox.mjs`), la requête n'atteint pas le réseau.

- **L'adresse et les attributs du cadre sont ceux de Chromium** : `…/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1&start=42`, `sandbox`, `allow` (`autoplay; encrypted-media; picture-in-picture; fullscreen`) et `referrerpolicy` lus tels quels. Firefox n'écrit aucune ligne de journal à leur sujet (le journal de la page, lu par `log.entryAdded`, reste vide).
- **La politique de sécurité de GFS laisse passer les deux sites et refuse un troisième** : la page de `youtube-nocookie.com` et celle de `player.vimeo.com` se chargent dans le cadre du lecteur (le titre de la page répondue se lit dans le cadre), sans aucun `securitypolicyviolation` ; un cadre vers `dailymotion.com` est refusé (`frame-src`). L'essai échoue quand on retire `https://player.vimeo.com` de la politique (« refus : frame-src, https://player.vimeo.com »).
- **Où il est posé** : mêmes nombres que sous Chromium : 320 × 180 à (100, 80) du cadre de l'app ; après `deplacer` avec une zone qui coupe le haut et la droite, une fenêtre de 110 × 140 et un cadre du fournisseur de 320 × 180 décalé de −40 px ; une zone qui ne touche pas l'objet cache la fenêtre sans la retirer ; `masquer` puis `masquer` à faux la cachent puis la montrent.
- **La vraie souris** (`input.performActions`, `:hover`) : au milieu de la vignette elle trouve le lecteur, dans le cadre de l'app ailleurs ou dans la partie coupée elle trouve l'app.
- **Un seul lecteur** : Vimeo (`https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1#t=30s`) remplace YouTube ; `fermer` d'un autre `id` ne retire rien ; une adresse à la place d'un identifiant, un site inconnu et un rectangle mal formé sont refusés (`GFS_REFUSE`) et dits en console, sans rien changer.
- **Le panneau change de taille** : un objet à (500, 50) de 320 de large, dans une zone de 2 000 px, se voit sur 200 px quand le cadre de l'app mesure 700 px de large et sur 320 px à 900 px : le lecteur suit le cadre (`ResizeObserver`).
- **Il part avec l'app** : une app cachée derrière l'explorateur ne pose rien ; l'app fermée retire le lecteur ; un nouveau se pose, `fermer` le retire.
- **Le focus** : un clic de la vraie souris dans le lecteur fait du cadre du fournisseur l'élément actif de la page de GFS ; ni ce clic ni un clic dans l'app ne ferment le lecteur.
- **Ne se mesure pas dans ce Firefox : la touche Échap tapée dans le lecteur.** Firefox sans écran ne donne le focus à aucune fenêtre (`document.hasFocus()` vaut faux, aussi dans le cadre du fournisseur), garde le lecteur comme élément actif même après un clic dans l'app, et dépose la touche que WebDriver synthétise sur l'élément `iframe` de la page de GFS (`["Escape","IFRAME","YouTube"]`), jamais dans le document d'une autre origine (le titre de la page du fournisseur ne change pas). Le résultat de Chromium (faits vérifiés 56 : après un clic dans le lecteur, Échap n'arrive qu'au cadre du fournisseur, ni à GFS ni à l'app ni à Grist) reste la référence ; sous Firefox, c'est à la personne de l'essayer.
- **Pas mesuré** : un vrai YouTube ou Vimeo (le démarrage au premier clic, le son, le plein écran, les erreurs d'intégration), Firefox avec un vrai Grist (le labo ne lance que le Firefox de Playwright, absent du conteneur), le Grist de la DINUM.
- **Rejouer** : `bash prototype/labo/installer-firefox.sh`, puis, depuis `prototype`, `node --test --test-name-pattern="lecteur de vidéos" test/interfaces-firefox.test.mjs` (une dizaine de secondes).

## 79. La vue « Ouverts » : revenir à un fichier déjà ouvert, sans repartir de l'arborescence (mesuré le 10/11)

Demande du porteur (04/11 : « un système d'onglet pour revenir sur un fichier ouvert et pouvoir faire des A/R entre plusieurs fichiers sans repartir à zéro dans l'arborescence » ; « liste d'abord, onglets vivants après » ; « pas d'ajout sur la barre flottante », 10/11 : la liste vit seulement dans l'explorateur ; contrats 6.4, point 14). Mesuré avec `labo/run-ouverts.mjs` dans un **vrai Grist** (grist-static), panneau à 700 × 400, souris réelle, deux apps de sonde (O, qui répond à `fermer` ; Q, qui ne connaît pas l'appel), en français clair, français sombre, anglais clair et anglais sombre (22 vérifications dans chacune, aucune en échec), et sous Firefox 159 sans écran (`test/ouverts-firefox.mjs`, branché sur `test/interfaces-firefox.test.mjs`, fr et en, clair et sombre, à 700 px : 9 essais verts ; la mesure échoue bien quand une attente est cassée).

- **Rien d'ouvert** : « Ouverts » est la première ligne du volet (avant « Récents », « Favoris », « Partagés avec moi » et la corbeille), sans nombre ; la liste dit « Aucun fichier ouvert pour le moment… » et le fil d'Ariane « Moi › Ouverts ».
- **Un fichier ouvert dans une app entre dans la liste** : le double-clic de « Premier » ouvre la sonde O sur son identifiant (en texte, raison « explorateur ») ; la liste compte 1 et porte le mot **« affiché »** sur « Premier ».
- **L'aller-retour** : « Projet Q » (sonde Q) ouvert depuis le dossier, la sonde O est priée de se fermer (elle répond « oui ») ; la liste garde les deux fichiers, par nom, « affiché » sur « Projet Q » seulement. Un double-clic sur « Premier » **dans la liste** ramène la sonde O (la sonde Q part comme avant, `GFS_INCONNU`) sur le même fichier : la liste garde ses deux lignes (rien n'est dupliqué), « affiché » passe à « Premier » ; un second retour à « Projet Q » fait pareil, la sonde O ayant répondu « oui ».
- **« Retirer des ouverts »** : le deuxième article du menu d'une ligne (après « Ouvrir »), seulement dans cette vue ; la ligne sort, le nombre baisse, le fichier reste dans son dossier et l'app reste ouverte ; le menu d'une ligne du dossier n'a pas l'article.
- **Un refus dans l'app** : la sonde O répond « non » à `fermer` : elle reste, la sonde Q ne s'ouvre pas, la liste ne bouge pas (« Projet Q », retiré avant, n'y entre pas), « affiché » reste sur « Premier » ; après un « oui », « Projet Q » entre dans la liste et devient le fichier affiché.
- **700 × 400** : chaque texte de l'explorateur (« affiché » compris : 36 textes) se lit à **4,5:1 au moins** en clair et en sombre ; la ligne du volet, le nom et « affiché » tiennent dans la fenêtre sans être coupés. Sous Firefox : chaque ligne mesure 28 px, son contenu y reste, aucun texte coupé sans info-bulle, le dossier en indice (« Formation ») pour un fichier qui y est, le clavier passe à la ligne suivante après un retrait, Entrée ouvre.
- **Les essais Node** : `OpenedFiles` (huit derniers, pas de doublon, « affiché » tant que c'est la même session d'app), l'entrée dans la liste par `Openings` (l'app a ouvert ; pas un refus, pas une app qui ne connaît pas l'appel, pas un fichier vierge ; un PDF que GFS garde sous sa clé), la liste à plat du modèle, l'article du menu, la ligne du volet, le message vide et le mot « affiché ».
- **Pas mesuré** : les vraies apps avec la liste (Publipostage+ répond à `fermer` depuis sa 047, les autres depuis leurs consignes sur le kit : le retour par la liste passe par le même `fermer` que le double-clic, mesuré avec les sondes, pas rejoué avec elles) ; plus de huit fichiers ouverts dans un vrai Grist (couvert par un essai Node) ; le rechargement du widget par Grist (la liste repart vide : elle ne vit qu'en mémoire, ce que le code garantit, non joué dans le labo) ; l'instance de la DINUM ; Firefox avec un vrai Grist (le labo ne lance que Chromium).
- **Rejouer** : `REPO_DIR="$(realpath ../..)" node lab-server.mjs &` puis, depuis `prototype/labo`, `LAB_LANG=fr LAB_SCHEME=light node run-ouverts.mjs` (et les trois autres combinaisons) ; Firefox : `bash labo/installer-firefox.sh` puis `node --test test/interfaces-firefox.test.mjs`.

## 80. L'outil des bibliothèques d'une app, rejoué sur une copie de Publipostage+ : carte, politique, empreintes et miroir se refont depuis la seule liste (mesuré le 10/11, étape 4)

Mesuré sur une copie de `lombre33/publipostageGrist` à `ac9b86d` (sommet de `main` le 10/11, rien n'est poussé chez l'app), avec le kit 0.16.0 (`4e9113a`, `outils/bibliotheques.mjs`). La liste essayée est `consignes/publipostage/063-liste-package.json`, tirée de son `index.html`, de ses sept fichiers `{ src, integrity }` et de `dev-tests/.offline-cache/build.mjs`.

- **Carte d'importation** : 52 entrées refaites (2 du kit, 34 paquets dont 16 « uniques », 13 sous-chemins de `@tiptap/pm`, 3 plages), **mêmes clés, mêmes valeurs** que celles écrites à la main ; seul l'ordre change, l'outil le fixe.
- **Politique** : le `script-src` refait cite les mêmes 15 sources que l'ancien (les quatre fixes, les neuf adresses du catalogue, Plotly et ECharts) et les trois empreintes de scripts en ligne : deux identiques (le script du bouton « Enregistrer », celui du démarrage anticipé), la troisième (la carte) change parce que la carte est réécrite dans son ordre et que l'outil la recalcule dans la même passe. Une deuxième passe ne change aucun octet ; `--verifier` dit « cohérents ».
- **Empreintes** : l'empreinte de `docx` (`dist/index.iife.js`) et celle de son module des graphiques, calculées par l'outil sur l'archive npm, sont celles que l'app écrit à la main (jsDelivr sert donc le fichier du paquet octet pour octet) ; les sept fichiers de `js/` qui écrivent `{ src, integrity }` disent les mêmes que le catalogue (« empreintes inchangées ») ; une empreinte abîmée à la main est dite par `--verifier` et remise par l'outil.
- **Miroir des essais** : le miroir refait par `--miroir` est **identique octet pour octet** à celui que `build.mjs` construit (55 fichiers de modules ES, 13 copies, `esm-map.json`, mêmes paquets aux mêmes versions). Le plan de l'outil (33 modules, 13 copies) est celui des deux tables de `build.mjs`.
- **Pas mesuré** : cdnjs, jsDelivr et esm.sh ne répondent pas depuis le cloud (le proxy refuse) : les sept empreintes cdnjs sont celles que l'app écrit, reprises telles quelles dans le catalogue de l'essai, **jamais relues sur le CDN** (`--verifier-cdn` est à jouer par le porteur, hors du cloud) ; la page régénérée n'a été ouverte dans aucun navigateur (l'essai `cspLoad` de l'app, qui joue la vraie politique, est à rejouer par son projet) ; les deux fichiers assemblés de l'app (`edition-live`, `pdfjs`) ne sont pas faits par l'outil.
- **Rejouer** : copier la liste en `package.json` à la racine d'une copie de l'app, puis `node <kit>/outils/bibliotheques.mjs --racine .` (ou `--paquets <dossier>` hors ligne), `--verifier`, `--miroir`.

## 81. L'accessibilité renforcée, second temps : cibles de 36 px, texte de 14 px, anneau de focus, mouvement, contraste forcé, barre en vrai trait (mesuré le 10/11)

Décision du porteur le 04/11 (le second temps de l'accessibilité renforcée, « un lot à part »), feu vert le 10/11 (« les 8 », puis « tous »). Mesuré avec `test/acces.test.mjs` (Node, 9 essais), `test/interfaces-firefox.test.mjs` (vrai Firefox 160 sans écran, 12 essais, **aucun en échec**), `labo/run-acces.mjs` dans un vrai Grist (grist-static, Chromium ; français clair et anglais sombre, 700 × 400, 26 mesures chacune, **aucune en échec**) et les passes `run-theme.mjs` (français clair et anglais sombre) et `run-barre.mjs` rejouées. Contrats 5.2 point 10, cahier 2 et 3.4, guide des apps 15.

- **Le texte** : plancher de 14 px. `--fs-min` vaut 0 d'origine et 14 px en accessibilité renforcée ; chaque taille de GFS sous 14 px s'écrit `max(Npx, var(--fs-min))` (`test/acces.test.mjs` refuse une taille nue sous 14 px, sauf le dessin d'une vignette d'ambiance, 9,5 px, qui n'est pas du texte à lire). Balayage de chaque texte affiché : **0 sous 14 px** dans l'explorateur, le menu « Réglages », la fenêtre « Thème » et « Apps et extensions » (vrai Grist), et sur 16 surfaces sous Firefox (la liste, la ligne choisie, les vignettes, deux menus, dix fenêtres) en français, anglais, clair et sombre. Sans l'interrupteur : rien ne change (ligne de 28 px, texte de 12,5 px, `gfs.acces` absente).
- **Les cibles** : 36 px, **0 commande plus petite** dans les mêmes surfaces. Les lignes de la liste mesurent **37 px** (un bouton de 36 px et le filet de 1 px du bas) et l'en-tête 38 px : à 36 px, sous Firefox, le filet passait dans le texte. Une case ou une pastille ronde de 22 px se compte avec le nom qui la coche, quand il fait 36 px : `label` qui l'entoure, ou `label for` (dans « Apps et extensions », la case est seule dans sa colonne et son nom est à côté : mesuré à 22 px dans un vrai Grist, d'où `.mr-title label { min-height: 36px }`).
- **La mise en page qui en résulte** : à 700 × 400 la liste montre moins de lignes (37 px au lieu de 28) ; sous 900 px « Modifié » et « Par » s'effacent de la liste (l'auteur et la date restent dans la barre du bas, comme sous 600 px en texte d'origine), le poids sous 600 px. La fenêtre « Thème » tient dans 700 × 400 **sans défilement du corps** : 372 px de haut sur les cinq ambiances renforcées (vrai Grist, français et anglais) ; sous Firefox elle défile de 16 px à 640 px de large (le test ne l'exige qu'à partir de 700 px).
- **L'anneau de focus** : mesuré **au vrai clavier (Tab) sous Chromium** : contour de 3 px pleins de la couleur du texte, 2 px de la page entre lui et la commande, deux couleurs à 3:1 au moins, jamais coupé par la zone qui défile, à **36 commandes** de l'explorateur, **6** de « Thème », **39** de « Apps et extensions » et à la barre de GFS. La mesure a trouvé deux défauts, corrigés : le groupe « Liste / Vignettes » (`overflow: hidden`) coupait l'anneau de 3 px (il se dessine maintenant dedans) et la première case de « Apps et extensions » arrivait collée au bord du corps qui défile (`scroll-margin: 8px`). **Sous Firefox sans écran, `:focus-visible` ne s'applique à rien**, même au vrai clavier (comme au fait 37) : ni `browsingContext.activate`, ni un Firefox avec fenêtre sous `xvfb-run` (`GFS_FIREFOX_ECRAN`) ne donnent le focus du système. L'anneau ne se mesure donc que sous Chromium.
- **La barre de la ligne choisie** : une vraie bordure de 6 px à gauche (`--bar-w`), transparente d'avance pour que la ligne ne bouge pas au choix, de la couleur d'accent une fois choisie ; la ligne choisie, l'en-tête, les autres lignes et le volet ont la même largeur (6 px). Sans l'interrupteur : l'ombre de 3 px d'avant.
- **Le mouvement** : **0 élément** avec une transition ou une animation qui dure, défilement « auto » (sans l'interrupteur la page en a : la mesure n'est pas vide, une flèche du volet le prouve). Le réglage « réduire les animations » du système (`prefers-reduced-motion: reduce`) fait la même chose pour toute ambiance, interrupteur allumé ou non.
- **Le contraste forcé du système** (`forced-colors: active`) : mesuré sous Chromium (`forcedColors: 'active'`) et sous Firefox (`browser.display.document_color_use` à 2), **l'accessibilité renforcée éteinte puis allumée**. **Défaut trouvé dans le vrai Grist, interrupteur allumé** : `:root[data-ambiance="renforcee"] .ls-row { border-left: … transparent }` pèse plus que `.ls-row { border-left: … Canvas }` du bloc du contraste forcé ; la barre de la ligne choisie prenait la même couleur du système que ses voisines (noir sur noir) et ne se lisait plus. Corrigé en préfixant chaque règle du bloc de `:is(:root, :root[data-ambiance="renforcee"])` (`test/acces.test.mjs`). Mesuré ensuite, allumé : la ligne choisie (6 px, `Highlight` contre `Canvas`), le bouton « Liste » enfoncé (contour de 2 px), la vignette choisie (3 px contre 2), la vignette d'ambiance cochée (3 px contre 1), l'interrupteur (la poignée change de côté et de couleur).
- **La barre de GFS au-dessus d'une app** : quatre boutons de 36 × 36 px, la barre mesure **42 × 156 px** (34 × 124 px d'origine) ; la zone que l'app doit laisser libre (`contexte.barre.zone`) est exactement la barre mesurée et 4 px autour (50 × 164 px à gauche), allumé comme éteint. Le `Dock` n'observait que le cadre : sa taille change maintenant sans que le cadre bouge, il observe aussi la barre (`ResizeObserver`).
- **Le labo du thème** : trois vérifications de `run-theme.mjs` étaient en échec avant ce lot sans rapport avec lui (le bouton « Réglages » n'est plus le premier bouton à menu depuis la cloche Notifications ; « Recharge » est devenu « Rechargez » au vouvoiement du 09/11) et une disait « anneau de 2 px » : remises à jour.
- **Les apps** : aucun jeton ne s'ajoute (`--fs-min` et `--target` sont à GFS) et GFS ne touche pas à leur interface : aucune consigne. Le contraste forcé et « réduire les animations » valent dans chaque cadre par eux-mêmes.
- **Pas mesuré** : la vue « Ouverts » et le lecteur vidéo avec l'interrupteur (arrivés sur main pendant ce lot : leurs écrans ne sont pas dans le balayage) ; le Firefox du porteur au vrai clavier (anneau de focus, Espace) ; un vrai Windows en contraste élevé (l'émulation de Chromium et la préférence de Firefox seulement) ; les vraies apps (leurs écrans gardent leurs tailles) ; l'instance de la DINUM ; un écran tactile (pas de mesure avec le doigt).

## 82. L'ouverture de GFS : les manifestes lus ensemble et les modules préchargés, mesurés sous Firefox dans un vrai Grist (mesuré le 10/11)

Décision du porteur le 10/11 (carte « Accélérer l'ouverture de GFS » de l'audit vitesse et poids, option « Lecture en parallèle + préchargement »). Mesuré sous Firefox 159 sans écran, dans un vrai Grist 1.7.19 (Docker, `vrai-serveur.sh` avec `APP_HOME_URL=http://grist.localhost:8484`), GFS servi sous un autre nom d'hôte par le banc de l'audit (`audits/vitesse-poids-2026-11-10/banc/`, `run-variantes.mjs` pour l'avant sur une copie, `run-apres.mjs` pour le dépôt tel qu'il est maintenant). Réseau **simulé** par le banc (latence et débit ajoutés à chaque réponse : fibre 40 ms et 100 Mbit/s, ADSL 120 ms et 20 Mbit/s), cache de 10 minutes comme GitHub Pages ; temps du cadre du widget créé à « prêt » (explorateur affiché, première fenêtre passée), médianes de 4 passages.

| du cadre créé à « prêt » | fibre froid | fibre chaud | ADSL froid | ADSL chaud |
|---|---|---|---|---|
| avant (audit) | 876 ms [869–920] | 483 ms | 2 021 ms [2 006–2 090] | 929 ms |
| après (ce lot) | **434 ms** [409–446] | **267 ms** [227–272] | **874 ms** [869–884] | **343 ms** [333–369] |
| widget vide (ce que Grist coûte seul) | 204 ms | | 420 ms | |

- **Ce qui a changé** : `loadAll` (`js/apps/manifest.js`) lance les quatre lectures de manifestes ensemble et juge les manifestes dans l'ordre du catalogue (l'unicité des `id`, des préfixes et des clés se juge contre les manifestes déjà acceptés : un doublon est refusé quel que soit l'ordre d'arrivée) ; `start()` (`js/controller.js`) lance la lecture du catalogue des bibliothèques avant d'attendre les manifestes (elle n'en dépend pas) : **5 allers-retours de suite deviennent 1** (c'est la différence du « chaud », où tout est en cache sauf ces cinq `no-store`). `outils/versions.mjs` écrit, entre `<!-- préchargement -->` et `<!-- /préchargement -->` juste après la carte d'importation, **129 liens `modulepreload`** (les imports statiques de `js/gfs.js`, de proche en proche, à l'adresse versionnée de la carte) : les 9 niveaux d'imports se demandent d'un coup (c'est la différence du « froid »).
- **Rien n'est demandé deux fois** : 148 requêtes au démarrage (146 avant : deux modules sont arrivés sur `main` depuis), 148 adresses distinctes, aucun doublon, aucun module demandé sans son `?v=`. Les mêmes liens placés **avant** la carte d'importation font demander les modules sans leur `?v=` (398 requêtes, 1 325 Ko au lieu de 561 Ko : mesuré le 10/11) : l'essai `versions.test.mjs` garde l'ordre (après la carte, avant le script d'entrée).
- **La liste est celle d'un vrai analyseur** : `test/versions.test.mjs` relit les 129 modules du chemin de démarrage avec acorn et exige les mêmes que les liens (même adresse que la carte pour chacun) ; l'outil les trouve par une expression régulière (imports statiques en début de ligne, sur plusieurs lignes, `export … from`), que cet essai contrôle. La politique de sécurité n'a pas bougé : `modulepreload` est compté dans `script-src 'self'`, rien n'est ajouté. La page pèse 9 Ko de plus (27 160 octets au lieu de 18 083), 1 Ko de plus compressée (6 469 octets au lieu de 5 437).
- **Essais qui échouent sur l'ancien code** : `manifest.test.mjs` (toutes les lectures partent avant la première réponse ; l'ordre du catalogue tient quand les manifestes arrivent à l'envers ; le doublon est refusé), `ouverture.test.mjs` (l'ordre des lignes de `start()`), `versions.test.mjs` (le bloc, son ordre, sa péremption).
- **Pas mesuré** : le vrai réseau (github.io est injoignable depuis le cloud : le gain réel dépend des allers-retours de la personne ; il est d'autant plus grand que la latence l'est), le Firefox du porteur, Chromium, Publipostage+ et les autres apps (leur page n'est pas touchée). Le reste du démarrage (sept feuilles de style qui bloquent l'affichage, 129 modules à évaluer) n'a pas changé.

## 83. Les parcours de bout en bout dans un vrai Grist, sous Chromium et sous Firefox : trois défauts mesurés, corrigés sur le choix du porteur (mesuré le 10/11)

Demande du porteur le 10/11 (« les 8 », puis « tous », huitième point : l'audit des parcours). Rejoué dans un vrai Grist 1.7.19 (Docker, `labo/vrai-serveur.sh`), à 700 × 400 : installer, ouvrir Form+, Automation+ et Grist-BI, un modèle de la vraie Publipostage+ (ranger, renommer, dupliquer, corbeille, restaurer, rouvrir), un PDF (importer, lire, télécharger), recharger, partager entre deux documents, deux GFS sur une page, les apps sur un réseau qui n'atteint pas leur site, un collègue lecteur et un éditeur. Chromium : 48 vérifications, 1 défaut ; Firefox 159 : 35 vérifications, 2 défauts de GFS ; collègues : 0 défaut. Rapport et captures : `audits/parcours-2026-11-10/` des fichiers du projet.

- **La phrase d'état laisse passer la souris.** Mesuré sous Firefox, au vrai pointeur : la bulle « GFS a relié ce widget à la grille » (niveau 400, au-dessus des fenêtres) recouvrait « Annuler » et « Créer la table » de la première installation pendant **3,1 à 3,3 s**, et « Créer la table » de la corbeille pendant 2,3 s ; le clic tombait sur elle. `.status` (la phrase d'état et la phrase d'erreur) est du texte seul : `pointer-events: none`. `test/bulle-firefox.mjs` pose un bouton au niveau des fenêtres sous chaque phrase et demande à Firefox ce qui reçoit la souris : échoue sur l'ancien CSS, passe maintenant (français et anglais, clair et sombre).
- **Ctrl+Z choisit le fichier ramené.** Le fichier supprimé revenait, mais la ligne choisie restait celle d'un voisin (la copie « (1) »), et un Suppr de plus agissait sur elle. `undoable` (js/explorer/explorer-undo.js) donne à l'explorateur la clé du fichier sorti de la corbeille (Ctrl+Z d'une suppression, Ctrl+Y d'une copie défaite), qui le choisit et lui rend le clavier. Mesuré identique sous Chromium et Firefox avant ; `test/explorer-undo.test.mjs` (4 essais) et `test/annuler-firefox.mjs` (« Ctrl+Z choisit le fichier ramené ») échouent sur l'ancien code.
- **À la corbeille, le nom passe avant le dossier d'origine.** À 700 px le nom « Contrat de prestation » fait **125 px** et la cellule n'en montrait que **75** : le dossier d'origine (« Formation »), écrit à côté, gardait sa place (`flex: none`) et deux fichiers voisins (« Convocation 2026 », « … (1) ») s'écrivaient « Convocatio… ». Les colonnes « Poids » (56 px) et « Par » (32 px) ne peuvent pas se resserrer (leur en-tête et leur pastille y tiennent juste) : c'est le dossier qui cède (`.hint.yield`), et son chemin entier est au survol. Les autres vues à plat (Récents, Favoris, recherche) ne changent pas. `test/corbeille-firefox.mjs` (« nameBeforeOrigin ») resserre la cellule à la largeur juste du nom : le nom doit y tenir en entier.
- **Pas corrigé, en attente du choix du porteur** : le repli de 15 s à chaque ouverture d'une app sur réseau fermé (mesuré : 15,2 à 15,5 s à chaque fois, quatre ouvertures de suite). L'avertissement `[GfsBar] abonné en échec … popup is undefined` de Publipostage+ (`js/template-tree-select.js`, ligne 309, une passe Firefox sur trois) partira avec la prochaine consigne à Publipostage+ (carte du 10/11).
- **Pas mesuré** : le site en ligne des apps (`github.io` injoignable du cloud : le cas « le site répond » ; les apps ont été servies par leur copie) ; le Firefox du porteur lui-même ; la synchronisation qui continue après l'arrivée d'un PDF ; l'essai `labo/run-annuler.mjs` (grist-static, absent de ce conteneur : le même geste est mesuré dans le vrai serveur par `labo/run-corbeille-apps.mjs`, 40 vérifications, aucune en échec).

## 84. GFS passé à l'outil d'audit : 67 sur 100 et deux points bloquants avant, 74 sur 100 et aucun après (mesuré le 10/11)

Mesuré avec `lombre33/Grist-widget-audit` à `1f4aed6` (`gwaudit` 1.0.0, sommet de `main` le 04/11, lu sans s'y modifier), lancé du cloud avec le Chromium du conteneur (`GWAUDIT_CHROMIUM_PATH=/opt/pw-browsers/chromium`, et `GWAUDIT_CHROMIUM_SANS_SANDBOX=1` : le conteneur est `root`, le code audité est le nôtre) et `--sans-reseau` ; 6 à 10 secondes par passage. Rapports : `audits/gw-audit-2026-11-10/`.

- **Avant** (GFS à `e3c0497`, cloné simplement, comme l'outil lit une adresse de dépôt) : **67/100, NON CONFORME**, deux bloquants (`B-DOC-01` : aucun README ; `C-SECRET-01` : `cle-secrete-0123456789` dans `labo/run-droits.mjs`) ; axes A 88, B 67, C 2, D 97, E 100, F 94. **Après** (le lot de ce jour) : **74/100, CONFORME SOUS RÉSERVE**, aucun bloquant ; A 88, B 88, C 17, D 97, E 100, F 97.
- **La surface** : un seul point d'entrée, `prototype/index.html`, 144 fichiers, 12 903 lignes de JavaScript (`B-VERB-01`, mineur au-dessus de 4 000, majeur au-dessus de 12 000). L'outil **ne récupère pas les sous-modules** : sans le kit, la feuille `kit/css/color-picker.css` est une 404 de la mesure dynamique. Avec une copie du kit (`4e9113a`) : 210 fichiers, 19 613 lignes ; 63/100 avant, 67/100 après ; les défauts propres au kit (quatre fonctions du moteur de partage, noms génériques, doublons avec GFS, deux `postMessage`) restent à son projet.
- **Corrigé dans GFS** : un `README.md` (ce que fait GFS, l'accès complet et pourquoi, ce qui est lu et écrit, les hôtes de la politique, les clés du `localStorage`, la carte du code) et un `SECURITY.md` ; les valeurs d'essai qui avaient l'allure d'un secret (`labo/run-droits*.mjs`, `test/transfer.test.mjs`) et le paramètre `token` de `Layers.raise` (un nom de variable CSS) ; 22 noms génériques (`data`, `bar`, `a`, `b`) ; le geste commun des fenêtres « Apps et extensions » et « Table de travail » (fond inerte, retour du clavier : `holdBackground` et `giveBackFocus` de `modal.js`) ; les fixtures communes des deux essais du partage ; des commentaires par groupe dans les trois fichiers de textes les plus longs ; `setTimeout(() => run(), ms)`.
- **Signalé par l'outil et voulu** (un faux positif de la règle ou un choix du cahier) : `C-EXFIL-04`, le script d'API de Grist chargé depuis `docs.getgrist.com` (adresse entière dans la politique, aucune adresse relative possible depuis Pages ; un client qui l'exige décide avec le porteur, cahier section 2) ; `C-GRIST-03` et `C-GRIST-04`, les sondes du labo (`labo/droits/sonde.js`, `labo/form-lab.mjs`) ; `C-PM-01`, le gestionnaire `message` du routeur, passé par son nom : l'outil ne lit que le corps d'une fonction écrite sur place, et `route` vérifie `event.source` ; `C-PM-02`, `postMessage(…, '*')` vers un cadre `sandbox` d'origine opaque (aucune autre cible n'existe) ; `C-EXFIL-02`, `fetch(path)` de chemins relatifs et `this.open(session, args)` pris pour un `XMLHttpRequest.open` ; `F-RGAA-05`, quatre boutons nommés par `setAttribute('aria-label')` à l'exécution (l'analyse dynamique n'y trouve aucun défaut) ; `D-CONSOLE-01`, des erreurs du script de Grist lui-même (style en ligne) et un appel `http` du banc refusé par `connect-src https:`.
- **Pas corrigé** : `A-DUP-01`, 208 blocs dupliqués (avant : 209), dont, parmi les cent plus gros, 81 groupes entre scripts du labo (`labo/run-*.mjs`), 15 entre essais, 3 entre les deux et un entre `dock-state.js` et `run-barre.mjs` ; les seules copies entre deux modules de `js/` (la pose et la dépose des deux fenêtres à classe) sont reprises. Les scripts du labo se rejouent du cloud (grist-static) mais ce sont plus de quatre-vingts groupes à refaire un à un : carte posée au porteur ; `B-VERB-01` (la carte du code est dans le README, le seuil reste franchi) ; `A-PERF-01`, trois lectures de tables une à une (déjà dans l'audit de vitesse).
- **Pas mesuré** : `npm audit` et les dates de publication des dépendances (le réseau est coupé, `--sans-reseau`) ; l'axe dynamique a tourné sans le bac à sable de Chromium.
- **Rejouer** : `git clone https://github.com/lombre33/Grist-widget-audit && cd Grist-widget-audit && npm install`, puis `GWAUDIT_CHROMIUM_PATH=<chromium> node bin/gwaudit.js <copie de GFS> --json --sortie <dossier>` ; le Chromium de Playwright n'est pas au chemin que l'outil attend dans le cloud (`/opt/pw-browsers/chromium` est le fichier exécutable).

## 85. L'annonce d'ouverture de `reglages` : la vraie Publipostage+ ne montre plus « Enregistrer » avant son premier réglage (mesuré le 10/11)

Le porteur voyait encore « Pour partager vos changements, cliquez sur « Enregistrer » en haut du widget, dans Grist. » sous GFS. Le texte est celui de Publipostage+ (`js/save-reminder.js`), pas de GFS. Diagnostic lu dans le code des deux côtés, puis choix du porteur (« GFS le dit dès l'ouverture »), construit et mesuré dans un vrai Grist (grist-static 0.1.6, Chromium, 700 × 400) avec Publipostage+ à `de63f27`, `labo/run-reglages-directs.mjs` (trois vérifications ajoutées au départ et au geste).

- **Avant (lu, puis mesuré sur l'ancien GFS)** : Publipostage+ ne sait si GFS enregistre qu'au premier événement `reglages`, que GFS n'envoyait qu'après une écriture. D'ici là (`GfsLink.settingsSaved()` à `null`) : les deux phrases des Réglages (`settings.view.intro`, `settings.access.saveHint`) demandent d'enregistrer la vue dans Grist, et le rappel de la ligne **paraît dès le geste** (l'app prévient ses abonnés avant même d'envoyer `grist.setOption`) jusqu'à l'événement. Mesuré : sans l'annonce, le rappel est montré avec son texte pendant le premier réglage.
- **Après** : à la demande de `contexte`, GFS lit `_grist_Views_section` et `_grist_Tables` (rien n'est écrit) et envoie `reglages` : `GfsLink.settingsSaved()` est vrai avant tout geste, les deux phrases sont celles « sans demande » (`…Saved`), et le rappel n'est montré à aucun moment (observé par un `MutationObserver` posé avant le geste). Les écritures suivantes redisent `true`, comme avant.
- **Quand GFS ne dit pas vrai d'avance** : accès pas `full`, aucune section reconnue, brouillon déjà posé → `false` (et la raison en console dès l'ouverture) ; plusieurs sections pareilles → rien. Couvert par les tests (`view-options.test.mjs`, `app-session.test.mjs`), pas rejoué dans un vrai Grist : seul le cas « vrai » l'est.
- **Autres causes du message trouvées en lisant le code, non changées** : un repli de GFS (la barre « Enregistrer / Retour » existe alors vraiment) ; la lecture seule (le courtier refuse l'écriture, aucun événement, le rappel de l'app reste) ; Form+ (« Non persisté : cliquez sur Enregistrer » quand sa table de formulaires n'a pas pu être écrite, sans barre sous GFS).
- **Pas mesuré** : Firefox (le labo ne conduit pas Firefox dans le cloud ; l'annonce est un message ordinaire, sans lien avec le navigateur), un vrai serveur (latence, droits de structure). **Déjà en échec avant ce lot, sans rapport** : deux vérifications de la partie « deux GFS sur la même table » de `run-reglages-directs.mjs` (la seconde GFS écrit sa clé `gfs.grille` : les deux vues ne se ressemblent plus, la recherche par marques n'a plus lieu d'être).


## 86. Les relectures de l'explorateur sans les cellules lourdes : le retour à l'explorateur passe de 1,9 s à 0,27 s sur 49 Mo de modèles (mesuré le 10/11)

Décision du porteur le 10/11 (carte « Que faire des modèles lourds relus à chaque retour à l'explorateur ? » de l'audit vitesse et poids, option « Lire seulement les colonnes utiles »). Mesuré sous Firefox 159 sans écran, dans un vrai Grist 1.7.19 (Docker), avec le banc de l'audit (`audits/vitesse-poids-2026-11-10/banc/run-big.mjs H`) : un document de 100 modèles de 500 Ko (49 Mo), on ouvre un formulaire de Form+ puis on revient à l'explorateur.

| retour à l'explorateur (clic → liste redessinée) | 40 modèles de 400 Ko (16 Mo) | 100 modèles de 500 Ko (49 Mo) |
|---|---|---|
| avant : lecture complète (`fetchTable`) | 714 ms (lecture 602 ms) | 1 929 ms (lecture 1 747 ms) |
| après : lecture légère, quatre appels de suite (premier essai) | 342 ms (lecture 226 ms) | 370 ms (lecture 224 ms) |
| après : lecture légère, tables lues ensemble (ce lot) | **247 ms** (lecture 127 ms) | **275 ms** (lecture 130 ms) |

- **Ce qui a changé** : `js/explorer/explorer-sql.js` (nouveau). La **première** lecture d'une session reste complète : elle compte le poids des fichiers (`learn`) ; à 4 Mo ou plus, les suivantes passent par `GET /sql` (cadre d'envoi, `Transfer.sql`, jeton **en lecture seule**) : une lecture de la structure (`_grist_Tables_column`), puis une lecture par table (colonnes du manifeste d'après `neededColumns`, nombres lus, octets du texte non rendu comptés par SQLite : `length(CAST(… AS BLOB))`) lancées **ensemble**. Mesuré : chaque appel SQL coûte de 55 à 80 ms par lui-même (le jeton est redemandé à Grist à chaque requête, js/broker/transfer.js), d'où les lectures concurrentes (224 → 130 ms). Un document léger ne change pas : aucun cadre d'envoi, aucun jeton de plus.
- **Même résultat que la lecture complète** : les deux lectures donnent les mêmes fichiers, le même poids à l'octet près (`stats.bytes` : 16 475 068 et 51 293 528 octets dans les deux cas), la même liste dans le vrai Grist (136 lignes, mêmes noms et mêmes poids affichés), et pour tous les manifestes déclarés dans un SQLite réel (`test/explorer-sql.test.mjs` : entiers de 1 à 6 octets, réels, booléens, listes `ChoiceList`/`Attachments`/`RefList`, colonne absente d'un document ancien, corbeille de GFS, lignes liées).
- **Quand elle s'éteint** : mesuré avec une règle d'accès dans le document (Grist refuse `/sql` à un jeton en lecture seule, faits vérifiés 43) : le retour à l'explorateur relit en entier comme avant (1 512 ms, mêmes fichiers, mêmes 51 293 528 octets) ; la lecture s'éteint pour la session au premier refus, ne redemande plus rien, et dit pourquoi en console (une fois). Aucun jeton qui peut écrire n'est demandé pour cette lecture (la fenêtre « Poids du document », elle, le demande sur geste de la personne).
- **Cadre d'envoi dans le banc** : sa politique n'autorise que `https:` ; le banc, qui sert Grist en `http://grist.localhost`, lui ajoute cette adresse pour LUI seul (rien du dépôt n'est changé). Sans cela la lecture légère échoue (`NetworkError`) et l'explorateur relit en entier : c'est ce que le repli donne, et c'est ce qu'un premier passage du banc a mesuré par erreur.
- **Essais qui échouent sur l'ancien code ou si on casse la règle** : `explorer-sql.test.mjs` (les poids ignorés, la lecture qui ne s'éteint pas après une erreur, l'avertissement répété, les lectures qui se suivent, la colonne lourde lue, la liste non décodée : chacune en mutation).
- **Pas mesuré** : Firefox du porteur, un serveur distant (la latence ajoute l'aller-retour de la structure et un jeton par appel, pour un gain proportionnel au poids évité), un document lourd en nombre de fichiers plutôt qu'en octets (le chantier suivant : n'afficher que les lignes visibles), la première ouverture d'une session (toujours complète : un indice gardé d'une session à l'autre demanderait le stockage du navigateur ; pas fait).

## 87. La liste de l'explorateur ne construit que les lignes qu'on voit : 20 000 fichiers = 841 nœuds au lieu de 360 951, liste visible en 0,8 s au lieu de 10,7 s (mesuré le 10/11)

Décision du porteur le 10/11 (carte « Que faire d'un explorateur à des milliers de fichiers ? » de l'audit vitesse et poids, option « Afficher seulement les lignes visibles »). Mesuré sous Firefox 159 sans écran, dans un vrai Grist 1.7.19 (Docker), avec le banc de l'audit (`audits/vitesse-poids-2026-11-10/banc/run-big.mjs`, scénario F), documents de 500, 5 000 et 20 000 fichiers (moitié formulaires, moitié modèles).

| document de | liste visible avant → après | nœuds du widget | mémoire de Firefox en fin de passage | recherche vidée (liste entière redessinée) |
|---|---|---|---|---|
| 500 fichiers (536 lignes) | 837 → **389 ms** | 9 951 → **841** | 811 → **706 Mo** | 200 → 49 ms |
| 5 000 fichiers | 3 164 → **430 ms** | 90 951 → **841** | 1 313 → **725 Mo** | 1 383 → 50 ms |
| 20 000 fichiers | 10 708 → **810 ms** | 360 951 → **841** | 2 962 → **763 Mo** | 6 182 → 134 ms |

- **Ce qui a changé** : `js/explorer/explorer-window.js` (nouveau, `RowWindow`). À partir de **200 lignes** (ou vignettes), seules les lignes visibles et huit rangées de part et d'autre sont construites ; l'espace des autres est tenu par le remplissage (`padding-top` et `padding-bottom`) du conteneur : la barre de défilement a la hauteur de la liste entière (15 034 px pour 536 lignes, 561 034 px pour 20 036), et Début, Fin, la molette et la position gardée au redessin se comportent comme avant. Mesuré dans le vrai Grist : au bas de la liste, 23 lignes construites dont la dernière porte `aria-rowindex` 20 037 sur 20 037 ; au milieu, 32 lignes ; revenu en haut, 22 (la rangée 2, l'en-tête étant la rangée 1) ; chaque saut coûte de 30 à 34 ms.
- **Les hauteurs sont mesurées, pas supposées** : la hauteur d'une rangée (28 px, 37 px en accessibilité renforcée) et le nombre de colonnes des vignettes se lisent sur ce qui est construit, au pixel près, et se relisent à chaque changement de taille (`ResizeObserver`). Le nom d'une vignette réserve toujours deux lignes (`css/explorer.css`, `.is-windowed .tn`), sans quoi les rangées n'auraient pas la même hauteur.
- **Le reste de l'explorateur lit ses données, plus le DOM** : le clavier (flèches, Début, Fin, Entrée, F2, Suppr), la sélection, le presse-papiers et « Ouverts » passent par la liste des clés (`#keys`) ; `reveal(index)` construit et amène à l'écran la ligne dont on a besoin. Si la ligne qui avait le clavier sort de la fenêtre, le clavier reste à la liste, pas à la page. Les lecteurs d'écran lisent `aria-rowcount` et `aria-rowindex` : le nombre réel de lignes est annoncé, pas celui qu'on a construit.
- **Mesuré sous Firefox à 700 × 400, à la vraie souris et au vrai clavier, en clair et en sombre, en français et en anglais** (`test/fenetrage-firefox.mjs`, dans `test/interfaces-firefox.test.mjs`) : nœuds, place des lignes (aucune ne se superpose ou ne saute), barre de défilement entière, Fin puis ↑, Début, 36 flèches ↓ de suite, le clavier qui reste à la liste quand sa ligne sort, filtre, clic et épinglage à la souris, vignettes, accessibilité renforcée (37 px), 20 000 fichiers. L'essai échoue sans le fenêtrage (`WINDOW_FROM` poussé à 10 millions : 5 011 lignes construites, 90 493 nœuds).
- **Pas mesuré, et pourquoi** : le **glisser-déposer pendant un défilement** (`Page.drag` de Firefox sans écran ne se termine jamais ; la règle « les lignes ne bougent pas tant qu'un glissement est en cours », `Dragging.holding`, n'est essayée qu'en essai unitaire) ; la recherche **Ctrl+F du navigateur** ne trouve plus les fichiers qui ne sont pas construits (le champ de recherche de l'explorateur, lui, cherche dans toutes les données) ; un navigateur sans `ResizeObserver` (la taille n'est alors relue qu'à la construction) ; le reste du temps à 20 000 fichiers (0,8 s) est la lecture, le classement et le modèle, qui restent proportionnels au nombre de fichiers.

## 88. Une page n'a qu'une carte d'importation : mesuré sous Firefox 160 et Chromium 153 (10/11, pour l'étude `docs/etude-cdn-ou-copie.md`)

Pages d'essai servies en local, pilotées par `test/firefox.mjs` (Firefox 160.0, conteneur du cloud) et par Playwright (Chromium 153) ; les trois sondes sont dans les fichiers du projet, `etudes/cdn-ou-copie-10-11/probe*.mjs` (pas dans le dépôt : elles ne servent qu'à rejouer ce fait).

- **Une seconde carte est ignorée par Firefox 160**, qu'elle soit écrite dans la page après la première ou posée par script, même avant tout `import()` : `import('tip')` échoue (« bare specifier, but was not remapped »). Chromium 153 la fusionne : `tip` résolu, et une clé déjà définie par la première carte garde sa valeur (la première gagne).
- **Une carte posée par un script en ligne, quand la page n'en a pas d'autre, marche dans les deux** (`import()` réussi, avant ou après le chargement de la page).
- **Avec une politique `script-src 'self'` + empreintes**, cette carte posée n'est prise que si la politique nomme l'empreinte sha256 de son texte exact : sans elle, refusée dans les deux navigateurs (même échec de résolution, sans autre message).
- Conséquence retenue dans l'étude : la page de Publipostage+ choisirait, au démarrage, entre deux textes de carte (éditeur en CDN ou en copie), les deux empreintes dans la politique ; le mode doit donc être connu avant la réponse de GFS.
- **Pas mesuré** : la même chose dans la vraie page de Publipostage+ et dans un vrai Grist ; Safari ; les Firefox plus anciens que 160.

## 89. Le moteur de partage 2.6.0 du kit 0.17.0, rejoué par le port de GFS dans un vrai Grist 1.7.19 (11/11)

Le kit passe de 0.16.0 à **0.17.0** (`cddb6f4`) : le moteur de Sync+ de 2.1.0 à **2.6.0** (Sync+ `c631cfa`), repris par `outils/reprendre-synchro.mjs` (corrigé le même jour : un dossier `golden/` dans `tests/unit` de Sync+ l'arrêtait). `ENGINE_VERSION` du kit : `2.6.0`. Mesuré avec la référence du kit avancée dans GFS, le serveur Docker `gristlabs/grist:1.7.19` (`vrai-serveur.sh` avec `ALLOWED_WEBHOOK_DOMAINS=*`), Chromium 153 :

- **`labo/run-sync-port.mjs` : 40 vérifications sur 40**, console de GFS vide : le port de GFS (`js/sharing/sync-port.js`, sans changement) prend toujours ses vingt noms de `createRestPort` (même ordre) ; démarrage, lignes, schéma, lecture SQL, `docChanges` (dont l'état perdu qui rend « inconnu »), pièce jointe, webhooks avec condition, document public, envoi à un vrai formulaire publié, autre instance (« otherInstance »), clé inconnue.
- **`labo/run-sync-partage.mjs` : 21 vérifications sur 21**, console vide : un PDF d'un document à l'autre (même contenu chez le second), `GFS_Synchro` et `GFS_Fichiers` chez l'envoyeur, `GFS_Recus` et `GFS_Journal_<export>` chez le receveur.
- Essais Node : kit `node --test "test/*.test.mjs"` 525 sur 525 ; GFS `sync-port`, `sync-resume`, `sync-rules`, `kit-copies`, `versions`, `csp`, `hygiene` 64 sur 64.
- Dans le diff de 2.1.0 à 2.6.0 : aucune adresse, aucun `fetch`, aucun `eval`, aucun stockage du navigateur, aucun `console.log` ajouté. Le texte des formules de la table `GFS_Synchro` est gardé octet pour octet par `test/synchro-formulas-golden.test.mjs`.
- **Pas mesuré** : Firefox ; les ajouts facultatifs de 2.2.0 à 2.5.0 (`docUrl` sous sa nouvelle forme sur l'instance DINUM, `arrange`, `readLost`) : GFS ne les appelle pas encore, ils sont dans le kit pour quand une fenêtre en aura l'usage.

## 90. La vraie Form+ à `3b9ac0c` : elle publie elle-même au bouton, GFS refuse l'écriture de `_grist_Shares` et le guide passe au geste à la main (mesuré le 11/11)

- **Relu dans le diff de `2faf93b` à `3b9ac0c`** (17 fichiers, dont `poc/js/publish-guide.js`, `grist-meta.js`, `config-editor.js`, `main.js`, `respond.js`) : aucune adresse nouvelle, aucune politique de sécurité touchée, aucun `window.open`, aucun stockage du navigateur de plus ; ce que l'app demande de plus au courtier : `AddRecord _grist_Shares` puis `UpdateRecord _grist_Pages.shareRef` (le bouton « Publier le formulaire »), `UpdateRecord _grist_Views_section.shareOptions` (déjà permise), et une lecture du formulaire par la route du document (`GET <adresse du jeton>/forms/<section>?auth=<jeton>`, `fetchNativeForm`) tant que la clé de partage manque. `tests.js` ne se charge plus qu'avec `#test` (consigne 029).
- **Mesuré avec la vraie Form+** (`labo/run-form.mjs`, grist-static, 700 × 400, souris réelle, Chromium ; étape 3b réécrite pour le nouveau guide) : **54 vérifications sur 54 en français clair, anglais sombre et français sombre** ; `run-composite-form` 25 sur 25 ; `run-ouvrir-form` 17 sur 17 ; aucune erreur de script. Au clic sur « Publier le formulaire », le courtier répond « `_grist_Shares` n'est jamais écrite par une app » (`GFS_REFUSE`) : **aucune ligne de partage n'est créée, la section reste intacte** ; Form+ ne montre pas d'erreur, dit « n'a pas pu publier à votre place », nomme la page « Formulaire Reponses », attend la publication, et passe seule à l'étape 2 quand la personne publie dans Grist (écriture de `shareOptions` faite depuis le cadre de GFS), puis à l'étape 3 (coller le lien).
- **Donc** : le contrat disait « jamais » pour `_grist_Shares` en écriture ; laisser Form+ publier à la place de la personne change cette règle. Carte posée au porteur le 11/11, choix « Avec accord » : voir la section 95.
- **Non mesuré** : « construire le formulaire avant son lien » dans un vrai GFS (la lecture par la route du document demande un jeton, que grist-static ne délivre pas ; même schéma que le dépôt des pièces jointes, mesuré en 53) ; l'adresse de la page à copier ; Firefox ; DINUM.

## 91. La clé d'un lien de formulaire : Grist la tire seul et aucun widget ne peut la lire ; deux pages sur le même partage la partagent (mesuré le 11/11, Grist 1.7.19)

Question du porteur (11/11) : GFS peut-il récupérer lui-même le lien d'un formulaire, pour que la personne n'ait plus à le copier ? Mesuré avec `labo/run-cle-partage.mjs` (vrai Grist 1.7.19 dans Docker, sans widget : les écritures de la recette de Form+, puis des requêtes de visiteur anonyme, sans cookie) : **7 vérifications sur 7**.

- **La clé de l'adresse n'est pas écrite dans le document.** `_grist_Shares` ne garde que le `linkId` que le document a choisi ; la clé (22 caractères) est tirée par le serveur (`makeId()`, `HomeDBManager.syncShares`) et ne se trouve que dans sa base d'accueil (`shares.key`, hors de portée du document et des widgets). L'adresse bâtie avec le `linkId` répond 404.
- **Une seule voie la donne** : `getShare` sur la connexion du document (`DocWorker`, droit « owners »), que Grist n'a pas branchée sur l'API des widgets (cinq méthodes de `GristDocAPI` seulement) et qu'aucune route REST ne répète : relu aussi dans `app/server/lib/DocApi.ts`, `app/gen-server/ApiServer.ts` et `DocWorker.ts` de `grist-core` `main` (11/11), `getShare: method("owners", "getShare")` y est toujours la seule. Le presse-papiers ne se lit pas non plus depuis un widget (seul `clipboard-write` est délégué, mesuré à l'étape 2). Donc **seul le geste de la personne** (Partager, Copier le lien, coller) apporte la clé.
- **Deux pages sur le même partage partagent la clé** : après `UpdateRecord _grist_Pages.shareRef` de la seconde page vers le partage de la première, la même clé ouvre les deux formulaires en visiteur anonyme, et laisse ajouter une ligne dans la table du second. Une clé qui n'est celle d'aucun partage de la page (formulaire non publié) répond 404. **Le coût** : un lien qui fuit ouvre tous les formulaires du partage, ce que la règle 4a des contrats (« jamais deux formulaires sur le même partage », tranchée le 04/11) interdit aujourd'hui.
- **Pas mesuré** : une autre version de Grist (celle de la DINUM) ; Firefox (le script n'a pas d'interface).

## 92. Neuf bibliothèques natives de Publipostage+ vendorisées chez GFS : les mêmes octets que le miroir des essais de l'app, 5,1 Mo de plus (11/11)

Choix du porteur (11/11) : la copie figée des bibliothèques natives d'une app est chez GFS (contrats 2.6, point 14 ; `docs/etude-cdn-ou-copie.md`). Tirées de npm par `node outils/bibliotheques.mjs` (sans option, réseau npm seul) d'après la liste de GFS.

- **Octets** : docx 1 061 633, docx-charts 215 515, exceljs 947 702, jszip 97 630, marked 39 903, pdf-lib 525 099, pdfmake 1 357 654, pdfmake-polices 798 329, qrcode-generator 56 694, soit **5 100 159 octets** ; ce sont, à l'octet près, les tailles des fichiers que le miroir de l'outil du kit pose pour les essais de Publipostage+ (`umd/`, mesuré le 10/11). `prototype/vendor/` passe de 3,9 à 8,9 Mo (`du`).
- **Catalogue** : 4 entrées avant, 13 après ; les quatre anciennes sont inchangées (la différence ne fait qu'ajouter 117 lignes). `node outils/bibliotheques.mjs --verifier` : « catalogue cohérent ».
- **Deux licences que l'outil refusait** : JSZip livre `LICENSE.markdown` (nom non reconnu jusque-là) ; `qrcode-generator` 1.4.4 ne livre aucun fichier de licence (son `package.json` dit MIT, l'avis est l'en-tête de `qrcode.js`). L'outil accepte maintenant le premier, et le second seulement quand la liste le dit (`licenceDansLeFichier`) et que l'en-tête du fichier nomme la licence déclarée. Les deux essais échouent sur l'ancien code (`test/bibliotheques-outil.test.mjs`).
- **Pas mesuré** : que ces fichiers de npm soient ceux que cdnjs sert à Publipostage+ (cdnjs est refusé depuis le cloud ; le miroir des essais de l'app prend déjà ces fichiers à leur place) ; leur chargement dans un navigateur par une app (rien ne les demande encore : c'est le lot suivant).

## 93. Le choix « CDN ou copie figée » des bibliothèques natives, dans un vrai Grist avec la vraie Publipostage+ : le geste s'écrit, l'app reçoit la copie, le navigateur en contrôle l'empreinte (mesuré le 11/11)

Demande du porteur (10/11) et choix du 11/11 (copie chez GFS, fonction par fonction ; contrats 2.6 point 14, 5.2 point 12). `prototype/labo/run-natives.mjs`, dans un **vrai Grist** (grist-static 0.1.6, Chromium), à 700 × 400, à la vraie souris : 17 vérifications au vert en français clair, 17 en anglais sombre, 5 en lecture seule.

- **Ce que la personne fait** : la ligne « Bibliothèques de l'app · ≈ 4,9 Mo » (neuf bibliothèques) est au CDN, détail replié ; le détail se déplie à la souris (quatre fonctions, aucune ligne ne déborde) ; un clic sur « Copie figée » de Word écrit `{"natif:word":"vendorise"}` dans la ligne `@document / gfs / apps` de `GFS_Rangement` (un geste, sans « Enregistrer », rien dans les réglages de la vue) ; « toutes » en copie figée écrit les quatre clés ; « toutes » au CDN les retire (`modes` redevient `{}` : le CDN n'est jamais écrit).
- **Ce que l'app reçoit** : l'événement `extensions` porte `natives` avec exactement les deux bibliothèques de Word (`docx`, `docx-charts`), chacune `{ version: "9.15.1", src: <vendor/ de GFS>, integrite: sha384-…, forme: "script" }`, jamais une adresse jsDelivr ; `contexte`, redemandé par l'app, rend les mêmes copies ; le retour au CDN envoie `natives: {}`.
- **L'empreinte est contrôlée pour de bon** : le fichier que GFS sert a l'empreinte qu'il annonce (`sha384-ud8085E8…`) ; dans le sous-cadre isolé de l'app (origine opaque, sa politique `script-src 'self' 'unsafe-eval' https://esm.sh …` qui ne nomme rien pour GFS), une balise `<script src integrity crossorigin>` sur cette adresse charge (`window.docx` existe) et la même adresse avec une fausse empreinte est refusée.
- **Lecture seule** (`LAB_READONLY=1`) : les dix boutons (les raccourcis « toutes » et les deux de chacune des quatre fonctions) sont grisés, un clic à la vraie souris sur « Copie figée » n'écrit aucune table.
- **Firefox** : la fenêtre, ses lignes, le clavier et la lecture seule sont mesurés dans un vrai Firefox 160 sans écran (`test/natives-firefox.mjs`, jouée par `test/interfaces-firefox.test.mjs` : 0 écart en français et anglais, clair et sombre, à 700 × 400 ; l'essai échoue quand on casse le détail, le raccourci ou le grisé).
- **Pas mesuré** : (1) la vraie Publipostage+ **ne lit pas encore** `natives` : le labo ajoute les quatre fonctions au manifeste que GFS lit (la page d'état de l'app dira quand elle l'adopte) et la copie de l'app est celle de `ac9b86d`, pas de la référence ; l'app n'a donc chargé la copie que par la balise du labo ; (2) un vrai Grist sous Firefox (le labo n'a pas Firefox pour Playwright) ; (3) le CDN de l'app (cdnjs, esm.sh) face à la copie : refusés depuis le cloud ; (4) l'éditeur (TipTap), dont la copie attend le choix du porteur (carte posée).

## 94. Les scripts d'essai les plus copiés repris dans des modules communs : 208 blocs recopiés avant, 201 après, aucun verdict changé (mesuré le 11/11)

Choix du porteur (11/11, « Les plus copiés seulement », suite du fait 84). Rejoué avec l'outil d'audit à `1f4aed6`, GFS cloné simplement : **74/100 avant comme après** (le score ne bouge pas tant que des copies restent), mais `A-DUP-01` passe de 208 à **201 blocs** (151 → 143 entre fichiers différents) et d'environ 1 525 à **1 399 lignes** recopiées.

- **Repris** : `test/fenetre-firefox.mjs` (la mesure d'une fenêtre ouverte et les trois gestes qui l'attendent, pour les essais Firefox des fenêtres « Envoyer » et « Recevoir » : les 14 essais de `interfaces-firefox.test.mjs` passent avant et après) ; `labo/lab-gestes.mjs` (avertissements de GFS, attente, semis des tables d'une sonde, réouverture de GFS, lecture d'une sonde et de l'explorateur) pour dix passes du labo (`run-ouverts`, `-fermer`, `-composite`, `-annuler`, `-stockage`, `-barre`, `-langue`, `-theme`, `-identite`, `-ranger`) ; `test/fake-dom.mjs` (la doublure de DOM, trois essais Node) ; et deux vraies copies dans le code de la page : `writeActions` (`rights-actions.js`, l'écriture des actions que recopiaient `share-control.js` et `manage-control.js`) et `codeWithCopy` (`steps-window.js`, la zone de code et son bouton « Copier » des deux fenêtres), avec `test/steps-code.test.mjs`.
- **Mesure de chaque passe** : jouée dans un vrai Grist (grist-static 0.1.6, Chromium) avant et après, les lignes `OK` / `ÉCHEC` comparées une à une : mêmes verdicts (22, 36, 38, 42, 25, 110 `OK` pour ouverts, fermer, composite, annuler, stockage, theme ; `run-barre` : 80 sur 82 avant, 82 sur 82 après, les deux écarts venaient de trois passes jouées à la fois). Le premier rejeu de `run-composite` et `run-annuler` a trouvé un oubli (la date du semis, lue plus loin) : `seedProbeFiles` la rend.
- **Pas touché, parce qu'il faut un vrai serveur Grist** (la sortie dit « Le serveur Grist ne répond pas sur 127.0.0.1:8484 », Docker ne démarre pas dans le conteneur) : `run-partager*`, `run-partages*`, `run-relier-sans-fichier`, `run-sync-*`, `run-dossiers`, `run-corbeille*`, `run-copie`, les sondes `j-joindre` et `z-ranger-pdf`. Ce sont les plus gros groupes qui restent (24, 22, 17, 15 lignes), et ceux d'Automation+, de Form+ et de Publipostage+ (`run-ouvrir-form`, `run-langue-publipostage`…), dont les sous-modules ne sont pas dans ce conteneur. Les 90 blocs restants des cent plus gros sont presque tous là.
- **Trouvé en rejouant** : trois passes avaient vieilli sans bruit, parce que les fonctions arrivées depuis ne les concernaient pas : `run-langue` prenait la cloche « Notifications » pour le bouton « Réglages » et « Ouverts » pour « Récents » (8 `ÉCHEC` sur 39, maintenant 39 sur 39) ; `run-identite` attendait encore « le tien seulement » (le texte dit « le vôtre » depuis le 09/11, maintenant 41 sur 41) ; `run-ranger` supposait que « Retirer des favoris » suit la première flèche, or le menu s'ouvre sur « Partager… » (8 sur 11 avant, 31 sur 32 maintenant). **Reste un `ÉCHEC` périmé dans `run-ranger`** : il attend « Dupliquer » grisé, or la copie existe depuis le 04/11 (« Copie faite »).
- **`i18n-explorer.js`**, sorti de `i18n.js` le 11/11, avait refait monter `B-COM-01` (axe B 85) : ses groupes de clés ont maintenant leurs commentaires (axe B 88).
- **Rejouer** : comme au fait 84 ; les passes du labo : `cd prototype/labo && npm install && REPO_DIR="$(realpath ../..)" node lab-server.mjs &` puis `REPO_DIR="$(realpath ../..)" node run-<nom>.mjs`.

## 95. Form+ publie à la place de la personne, avec son accord ; une page peut prendre le lien d'une autre, si elle l'accepte (mesuré le 11/11, vrai Grist 1.7.19, vraie Form+ à `3b9ac0c`)

Décisions du porteur le 11/11 : « Avec accord » (carte « Laisser Form+ publier le formulaire à ta place, avec ton accord à chaque fois ? ») et « Au choix, non coché » (carte « Laisser un second formulaire réutiliser le lien du premier, sans copie ? »). Contrats : 3.4 point 8 (la capacité `partage`), 3.3 point 6 (l'exception), 11.9 point 4a (modifié).

- **Ce que le bouton « Publier » de Grist écrit** (relu dans `app/client/components/Forms/FormView.js` de la 1.7.19, dans l'image du labo) : `AddRecord _grist_Shares { linkId: uuid v4, options: '{"publish":true}' }`, `UpdateRecord _grist_Pages { shareRef }`, puis `shareOptions` `{form, publish}` sur la section ; si la page a déjà un partage valide, `options` du partage passe à `publish: true` ; « Dépublier » met `publish: false` sur la section, et sur le partage quand plus aucune section de la vue n'est publiée. La recette de Form+ (`grist-meta.js`, `publishFormSection`) est la même, au `linkId` près (`crypto.randomUUID`). `js/broker/sharing-rules.js` n'en laisse passer que cette forme.
- **`labo/run-publier-form.mjs`** (vrai serveur Grist dans Docker, GFS et la vraie Form+ dedans, 700 × 400, souris réelle) : **21 vérifications sur 21 en français clair et en anglais sombre** (accepter, avec le second formulaire sur le même lien), **13 sur 13 en français sombre et en anglais clair** (refuser). Ce qui est mesuré :
  - le bouton fait poser la ligne de partage (`linkId` uuid, `{"publish":true}`) et la page la prend : **aucun refus du courtier** ; la fenêtre « Ouvrir au public ? » s'ouvre ensuite, le clavier est sur « Refuser » ;
  - **avant la réponse, la clé tirée par le serveur (lue dans `home.sqlite3`) n'ouvre rien** : le formulaire répond 404, l'ajout d'une ligne 403 ; un partage sans formulaire publié est donc sans effet ;
  - « Autoriser » : la section est publiée, Form+ passe seule à l'étape 2 ; en visiteur anonyme le formulaire s'ouvre (200) et une ligne s'ajoute dans la table des réponses, pas dans une autre (« Clients », 403) ; l'adresse bâtie avec le `linkId` du document répond 404 ;
  - « Refuser » : la section reste intacte, le partage posé reste sur la page, le lien n'ouvre toujours rien ; Form+ passe au geste à la main ;
  - **un second formulaire sur le même lien** (les écritures partent du cadre de la vraie Form+, le courtier la juge comme elle) : la fenêtre « Un seul lien pour deux formulaires ? » nomme la page qui prend le lien, la page et la table du premier ; « Refuser » laisse la page sans partage et l'app reçoit `GFS_ANNULE` ; « Même lien » rattache ; la publication du second demande son accord (sa table `Autres`) ; **la même clé ouvre alors les deux formulaires et chacun reçoit des lignes dans sa seule table**.
- **Un accord que Form+ confond avec un échec** : après le refus de la personne (`GFS_ANNULE`), le guide de Form+ dit « n'a pas pu publier à votre place » (CONSTAT du labo) ; la consigne 030 lui demande de le dire autrement.
- **Essais Node** : `test/sharing.test.mjs` (27) ; ciblés avant la poussée : 298 sur 298 (`sharing`, `filter`, `manifest`, `broker`, `broker-options`, `publication`, `i18n`, `hygiene`, `versions`, `csp`, `kit-copies` et les tests qui lisent les manifestes). `run-form.mjs` étape 3b réécrite pour grist-static (qui n'a pas de serveur d'accueil : la ligne de partage s'ajoute, Grist refuse le rattachement « HomeDbManager not available », Form+ passe au geste à la main) : **56 vérifications sur 56 en français clair, anglais sombre et français sombre**, `run-composite-form` 25, `run-ouvrir-form` 17.
- **Pas mesuré** : la case « Même lien » dans le guide de Form+ (elle n'existe pas encore : consigne 030) ; Firefox ; l'instance de la DINUM (version de Grist peut-être plus récente) ; un partage posé puis laissé par un refus, retrouvé plus tard par le « Publier » de Grist lui-même (le code de Grist le réutilise : `page.shareRef() !== 0` puis `getShare(linkId)`, lu, pas rejoué).

## 96. La copie figée de l'éditeur est dans le dépôt de l'app : GFS la choisit, ne la sert pas, et l'adresse du cadre la porte au démarrage suivant (mesuré le 11/11, vrai Grist, vraie Publipostage+ à `ac9b86d`)

Choix du porteur (11/11, 10 h 25) : « Dans le dépôt de Publipostage+ » (contrats 2.6 point 14, 1.3 point 3, 5.2 point 12 ; étude `docs/etude-cdn-ou-copie.md`). `prototype/labo/run-natives.mjs`, la même passe que le fait 93 avec une fonction de plus (`editeur`, `copieDansApp: true`, 1 172 757 octets) : 22 vérifications au vert en anglais sombre, la même passe en français clair, et 5 en lecture seule.

- **Ce que la personne voit** : la ligne « Éditeur (TipTap) · ≈ 1,1 Mo » est la première des cinq fonctions, avec « CDN » et « Copie figée », jamais grisée (GFS n'a rien à y vérifier) et sous elle la phrase « La copie est dans l'app : le choix prend effet au prochain démarrage de l'app. » ; la légende passe à « mélange » ; rien ne déborde à 700 × 400, en clair et en sombre, en français et en anglais, sous Firefox 160 aussi (`test/natives-firefox.mjs`, 0 écart ; l'essai échoue quand on retire la phrase).
- **Ce que GFS écrit et dit** : le geste écrit `{"natif:editeur":"vendorise"}` dans la table de GFS ; l'app ouverte ne reçoit **aucun événement** (GFS ne sert rien pour l'éditeur) et son cadre n'est pas rechargé (même adresse) ; « toutes » en copie figée écrit cinq clés et l'app reçoit les neuf bibliothèques de GFS, pas l'éditeur.
- **Au démarrage suivant** (GFS rouvert, Publipostage+ rouverte à la souris) : l'adresse du cadre porte `copie=editeur` à côté de `gfs=0`, et `hostCopies(location.search)` du kit 0.19.0, chargé dans le cadre isolé, rend `["editeur"]` : la page peut choisir sa carte d'importation avant que GFS réponde.
- **Pas mesuré** : la copie de l'éditeur elle-même (l'outil du kit qui la fabrique : kit 0.20.0, fait vérifié 98), la page de Publipostage+ qui lit `copies()` (elle n'existe pas encore).

## 97. Le 5e bouton de la barre, « Fichiers ouverts » : la barre passe à 34 × 154, Publipostage+ écarte encore sa zone, la liste se manie à la souris et au clavier (mesuré le 11/11)

Choix d'Antoine du 11/11 (carte « Décider où poser la liste des fichiers ouverts » : « Un 5e bouton sur la barre »). La liste « Ouverts » de l'explorateur (section 79) reste ; la barre en a la même liste (contrats 5.2 point 7 et 6.4 point 14).

- **`labo/run-ouverts-barre.mjs`** (vrai Grist grist-static, 700 × 400, souris et clavier réels, sondes O et Q) : **55 vérifications sur 55 dans chacune des quatre combinaisons (français et anglais, clair et sombre), aucune en échec**. Le bouton est le deuxième (entre « Fichiers » et « Apps »), 28 × 28, icône seule ; **la barre mesure 34 × 154 px** à 4 px du bord gauche, centrée ; sans fichier ouvert il est grisé (couleur de texte atténuée), sans pastille, et son menu dit pourquoi (l'article grisé, dont le clic explique par une phrase qui s'efface seule, puis « Ouvrir un autre fichier… ») ; la pastille et le nom du bouton portent le nombre (« Fichiers ouverts : 3 ») ; la liste va du plus récent au plus ancien et le fichier affiché est en gras avec son mot (`aria-current`) ; l'aller-retour par la barre fait fermer l'app active (sonde O répond « oui ») et ouvre l'autre sur le bon fichier, sans passer par l'explorateur ; **un clic sur le fichier affiché ne relance rien** (l'ouverture de la sonde ne change pas) ; la croix retire la ligne sans toucher à l'app, le menu se rouvre ; au clavier → va à la croix, ← revient, ↓ la saute, Suppr retire, Début et Fin vont aux bouts, Échap rend le clavier au bouton ; huit fichiers au plus ; le nombre de la barre est celui de la ligne « Ouverts » de l'explorateur ; aux quatre bords le menu s'ouvre à côté, au-dessous ou au-dessus de la barre sans la recouvrir et reste dans le cadre ; accessibilité renforcée : cibles de 36 px, croix de 36 px, « Ouvrir un autre fichier… » atteint par Fin même quand la liste défile. Contraste (4 combinaisons) : pastille 4,55:1, titre 5,4:1 (clair) et 6,33:1 (sombre), fichier affiché 5,6:1 et 5,1:1, son indice 4,71:1 et 5,23:1 ; **la pastille et le titre sont `aria-hidden` (le nombre est dans le nom du bouton, le titre dans celui du menu) et l'audit de contraste commun saute ces éléments : ils sont mesurés à part dans le labo**.
- **`test/barre-ouverts-firefox.mjs`** (Firefox, la vraie barre de `index.html` et le vrai menu sur une page d'essai, à 700 px et la liste à 400 px, clair et sombre, français et anglais) : les mêmes mesures sans écart ; vérifié qui mord : une croix ramenée à 18 px et le fichier affiché sans gras sont signalés. **Entrée et Espace sur un bouton ne s'activent pas dans ce Firefox sans écran** (les trois événements clavier arrivent, aucun `click`, `document.hasFocus()` faux) : le menu s'ouvre à la souris, et « Entrée ouvre le menu » se mesure dans le labo.
- **Les labos de la barre rejoués à la nouvelle taille** : `run-barre` 82 vérifications sur 82 (zone à 700 × 400 : `{ x: 0, y: 119, largeur: 42, hauteur: 162 }`), `run-acces` 26 sur 26 (cinq boutons de 36 px), `run-barre-publipostage` 7 sur 7. **`run-barre-ecartee` (la vraie Publipostage+ à `de63f27`, 3 tailles × 4 bords)** : les 301 vérifications de zone passent en français clair ; les 12 écarts sont tous le même contrôle de **contenu** du menu ▾ « Présenter » (quatre lignes au lieu de trois : la liste de l'app a changé depuis la mesure du 22/10, ce n'est pas la barre) ; en anglais sombre la passe s'arrête dans la tournée des fenêtres du diaporama (la fenêtre à part est fermée) après 137 vérifications : les deux sont à remettre à jour avec la version actuelle de l'app. `run-barre-apps` s'arrête au départ de Form+ (son bouton « Vous avez déjà un lien de formulaire ? » est caché dans la version référencée) : non rejoué, écran à mettre à jour.
- **Aucune consigne aux apps** : le contrat ne change pas (elles lisent `zone`), seule la zone a grandi de 30 px.
- **Une course trouvée en route dans `run-barre`** : l'événement de zone était compté avant d'être arrivé chez l'app (le compte tombait de temps en temps, 2 passes sur 4) ; la mesure attend maintenant l'événement.
- **Essais Node** : `test/opened-bar.test.mjs` (8), `test/opened-files.test.mjs` (onChange) ; ciblés avant la poussée : 155 sur 155 (`opened-bar`, `opened-files`, `dock-state`, `i18n`, `hygiene`, `csp`, `css-classes`, `contrast`, `versions`, `explorer-menus`, `settings-menu`, `openings`, `explorer-model`, `fenetres-css`, `acces`).
- **Non mesuré** : les vraies apps avec le menu ouvert (seules les sondes O et Q l'ont été) ; le tactile ; Safari ; Entrée sur le bouton sous Firefox (voir plus haut) ; la publication de Pages (injoignable du cloud).

## 98. La copie de l'éditeur, fabriquée par l'outil du kit dans le dépôt de l'app, démarre depuis la copie sous Firefox 160 et Chromium, dans un cadre isolé, sans rien demander à esm.sh (mesuré le 11/11, copie de Publipostage+ à `ac9b86d`)

Kit 0.20.0 (`c2ad14d`), `node kit/outils/bibliotheques.mjs --copies` avec `gfs.copie` ajouté à la liste de la copie d'essai (rien n'est poussé dans l'app) ; contrats 2.6 point 14 ; essais `kit/test/bibliotheques-copies.test.mjs`.

- **La copie** : 55 fichiers (33 modules, un par nom de la carte, `@tiptap/pm` excepté, et 22 morceaux qu'ils se partagent), 51 paquets lus, 760 Ko minifiés, refaite **à l'identique** (deux constructions, `diff -r` vide) ; `LICENCES.txt` (la licence de chacun des 51 paquets) et `COPIE.json` (version de chaque paquet, empreinte sha384 de chaque fichier) ; `--verifier` voit un fichier modifié d'un octet.
- **La page** : à la place de la carte écrite à la main, deux cartes en données (CDN : le texte d'avant, octet pour octet, donc la même empreinte ; copie : adresses relatives `./vendor/editeur/…`) et un script de 9 lignes qui pose l'une (chaque module de la copie porte un `?v=` tiré de son empreinte : un module refait change d'adresse, GitHub Pages gardant tout dix minutes) ; `script-src` gagne **deux empreintes** (le script et le texte de la carte de la copie) et garde celle de la carte du CDN. La politique de Publipostage+ telle quelle (`'self'`, `'unsafe-eval'`, esm.sh, les neuf natives…) : aucune adresse de plus.
- **Avec `?copie=editeur`**, page d'essai portant la politique et le bloc de la vraie page, dans un cadre `sandbox` sans `allow-same-origin` (serveur qui envoie `Access-Control-Allow-Origin: *` comme GitHub Pages), **Firefox 160 et Chromium** : 44 fichiers lus dans `vendor/editeur`, 0 vers esm.sh, 0 violation de la politique ; les 21 groupes de noms que `js/editor.js` importe (`Editor`, `StarterKit`, `Table`, `EditorState`, `__pastedCells`…) sont tous définis ; une seule instance de ProseMirror (`editor.state instanceof EditorState`) ; un tableau inséré s'affiche. Même résultat hors cadre.
- **Sans `copie`** (ou avec une autre fonction) : la page demande les 22 modules à esm.sh (injoignable du cloud : le chargement échoue, ce qui prouve la direction, pas le chargement). **Un texte de carte modifié d'un espace** (empreinte inchangée) : la politique refuse la carte injectée (`inline / script-src-elem`) et le navigateur ne trouve plus aucun nom nu, sous les deux navigateurs : l'empreinte du texte exact est bien ce qui la protège.
- **Pas mesuré** : la vraie page de Publipostage+ avec ce bloc (elle ne l'a pas encore : consigne 066), un vrai Grist qui ouvre cette page (la mesure est sur une page d'essai), GitHub Pages lui-même (injoignable du cloud ; l'en-tête CORS est celui que servent déjà les modules du kit de la page), le CDN esm.sh en chargement réel.

## 99. Une colonne ajoutée à la table envoyée APRÈS le premier partage arrive chez l'autre avec ses valeurs ; le dossier reçu se lit de cette colonne (mesuré dans un vrai Grist 1.7.19, `labo/run-dossier-colonne.mjs` 9 sur 9, `labo/run-dossiers-recus.mjs` 24 sur 24 en français clair et en anglais sombre, Firefox 160 : 0 écart)

Carte du 11/11, « Le dossier, à accepter d'un coup », seconde carte « un seul lien par document » (le nom du dossier voyage dans une colonne de plus). Ce que la mesure dit, sur un lien existant (un fichier déjà parti, accepté chez l'autre) :

- **L'envoyeur ajoute `Dossier_partage` (Text) à `GFS_Fichiers`**, la renseigne pour deux fichiers, puis enregistre l'export avec la colonne de plus et deux fichiers de plus dans la condition (`saveChosenExport` + `finishEdit`, `changed` = 1 table). Le moteur n'envoie une colonne que si elle existe dans le schéma au moment de l'enregistrement : la liste des colonnes de GFS (`SENT_COLUMNS`) peut la nommer d'avance sans effet tant qu'elle manque.
- **La table reçue gagne la colonne** (sans qu'on la crée chez l'autre), avec les valeurs des trois lignes ; le fichier arrivé avant la colonne **garde sa marque `Accepte` et son contenu** (rien n'est renvoyé de zéro, le contenu n'est pas redemandé).
- **Un changement de la cellule suit** : le nom du dossier change chez l'envoyeur (« Contrats » → « Marchés »), la table reçue le dit à la passe suivante ; la cellule vidée sort le fichier du dossier (la ligne reste, sans dossier).
- **Chez l'autre** : « Partagés avec moi » montre le dossier en tête (grisé, « 2 à accepter »), le fichier seul dessous ; on y entre à la souris et au clavier ; « Accepter le dossier… » marque les deux lignes en **une seule action** (les marques sont sur leurs lignes, pas sur le fichier seul) ; Échap n'écrit ni colonne ni marque ; un fichier ajouté plus tard arrive seul, grisé, les autres restent acceptés ; refuser le dossier ne touche que ce qui attendait.
- **Un seul nom par fichier** : la colonne est une cellule du fichier, pas un lien : un fichier rangé dans deux dossiers partagés ne porte que le dernier nom écrit, et un autre document relié qui reçoit ce fichier d'une autre façon (partage d'un fichier seul) voit aussi ce nom. C'est le prix de « un seul lien par document » ; il est dit au porteur sur la carte.
- **Pas mesuré** : l'envoi d'un dossier par GFS lui-même (l'essai écrit la colonne et la condition par les fonctions du moteur, comme `run-partages-recus.mjs`), le suivi d'un fichier qui entre ou sort du dossier chez l'envoyeur, les sous-dossiers.

## 100. Partager un dossier de « Moi » avec un document déjà relié : la colonne naît, le nom du dossier part avec les fichiers, rien ne se renvoie (mesuré dans un vrai Grist 1.7.19, `labo/run-partager-dossier.mjs` en français clair et en anglais sombre ; Firefox 160 : 0 écart)

Suite de 99, cette fois par les fenêtres de GFS elles-mêmes (le premier lien est fait par « Partager > Dans un autre document Grist » sur un fichier hors dossier, comme `run-partager-liens.mjs`) :

- **L'article « Partager… » d'un dossier de « Moi » est libre** et la fenêtre s'ouvre sur « Dans un autre document Grist » (le sous-titre dit « Dossier de « Moi » », « Dans ce document » dit que « Moi » n'a pas de droits à donner et n'écrit rien). Le dossier d'un lien déjà fait est « Pas partagé » tant que la personne n'a rien choisi.
- **« Copie à jour »** : aucune fenêtre d'envoi ; `Dossier_partage` naît dans `GFS_Fichiers` (une colonne, aucune ligne de plus) et porte « Contrats » sur les deux PDF du dossier, **vide** sur les autres ; la condition du lien passe à trois fichiers ; chez l'autre, les deux PDF arrivent avec leur contenu et leur dossier, le fichier déjà reçu reste sans dossier, et « Partagés avec moi » montre « Contrats » grisé, « 2 à accepter ». La colonne est écrite **avant** la condition (sinon le moteur ne l'enverrait pas à ce premier enregistrement).
- **« Arrêter la copie »** : les deux PDF sortent de la condition (le fichier hors dossier y reste), les copies restent chez l'autre avec leur dossier, marquées « supprimées à la source » (réception en archive). **Le nom du dossier reste écrit chez l'envoyeur** : l'essai l'a d'abord effacé après la sortie (puis après un passage du moteur au repos), et la cellule vidée **partait chez l'autre avec l'archive** (le dossier de la copie devenait vide), pour un fichier sur deux, ou pour les deux selon la course ; un nom qui reste ne coûte qu'un nom de dossier gardé par un fichier qui repartirait seul.
- **Un PDF du dossier partagé seul** (son propre onglet, qui n'était pas grisé : un fichier rangé dans un dossier se partage comme un autre) : le dossier devient « Une partie du dossier » ; « Copie à jour » le complète sans rien renvoyer de ce qui est parti.
- **« Une copie, une fois »** : l'avis dit que le dossier part, les fichiers sortent de la condition tout seuls (la fenêtre rouverte dit « Pas partagé », le fichier hors dossier est resté), la copie garde son dossier chez l'autre.
- **Le suivi** (« Copie à jour » retient le dossier dans une ligne `gfs-suivi` du rangement) : un PDF **déplacé dans le dossier** porte son nom et entre dans la condition **sans rien demander** à la personne (la condition passe de trois à quatre fichiers), arrive chez l'autre avec son contenu et son dossier, les autres n'ayant pas bougé ; le **mettre à la corbeille** le fait sortir de la condition (trois fichiers) et sa copie **reste chez l'autre, marquée « supprimée à la source »**, avec son dossier ; « Une copie, une fois » ou « Arrêter la copie » retirent la ligne du rangement.
- **Pas mesuré** : le suivi d'un dossier renommé ou déplacé (il attend, sans rien changer), un dossier d'espace, les sous-dossiers, un fichier rangé dans deux dossiers partagés (un seul nom).

## 101. Un envoyeur peut faire arriver ses fichiers « déjà acceptés » en rangeant une colonne `Accepte` dans son export : trou mesuré, fermé, remesuré (audit « contournement » du 11/11, vrai Grist 1.7.19, `labo/run-securite-marques.mjs`)

La question : un document qui envoie peut-il écrire lui-même, dans la table reçue, les marques que GFS lit pour « accepté » et « refusé » (`Accepte`, `Refuse`, `js/sharing/received-files.js`) ? Le moteur de Sync+ copie dans la table reçue les colonnes que l'envoyeur déclare, et recopie une colonne envoyée dans la colonne de même nom d'ici. L'envoyeur du labo est un document « méchant » qui range `Accepte` (et `Refuse`) dans les colonnes de son export, avec les fonctions du moteur (un envoyeur qui n'est pas GFS le fait avec le widget de Sync+).

- **Avant** (`GFS_FLOW=0`, la réception montée par le moteur seul) : `invitation` (la colonne est dans l'export dès l'invitation) : **les deux fichiers arrivent « acceptés »**, la personne n'a rien répondu ; `apres` (colonne ajoutée à l'export après le premier envoi) : **le fichier arrive accepté** tant que la table reçue n'a pas ses propres colonnes de marque. Dès que ces colonnes existent (réponse déjà donnée), le moteur donne un nom libre aux colonnes envoyées qui les recoupent (`Accepte_2`) et ne touche à rien : `repondu` tient depuis toujours.
- **Le correctif** : une colonne envoyée qui porte le nom d'une marque arrive sous `<nom>_envoye` (`reservedMap`, casse ignorée : Grist ne distingue pas `ACCEPTE`), et les deux colonnes de marque existent dans la table reçue dès la réception (`ensureMarks`, deux `AddColumn` Bool dans une seule écriture, jamais une table ; aussi à l'ouverture de la page par un propriétaire pour les réceptions d'avant).
- **Après** (par le parcours de GFS) : `invitation`, `casse` : les deux fichiers arrivent **sans aucune marque**, la valeur envoyée est dans `Accepte_envoye` ; `apres` : les colonnes de marque existent déjà et sont vides au premier envoi, la colonne envoyée plus tard arrive sous `Accepte_N` (`N` ≥ 2, nom libre du moteur) et GFS ne la lit pas ; `repondu` : « Facture » reste acceptée et « Devis » refusée malgré les valeurs contraires de l'envoyeur. Aucune erreur dans la console.
- **Aussi corrigé, par lecture du code** (essais sans Grist, `test/entries.test.mjs`, `test/files-store.test.mjs`) : le type d'un fichier reçu et son nom sont écrits par l'envoyeur ; un fichier reçu que GFS ne connaît pas ne choisit plus l'app qui l'ouvre (`readerOf` rend rien), et le nom de téléchargement d'un fichier reçu perd ses séparateurs de chemin, ses caractères de contrôle et ses points de tête (`receivedName`). `Dossier_partage` n'est plus envoyée qu'avec un lien qui reçoit un dossier : sans cela le nom d'un dossier de l'envoyeur fuyait vers tout lien de fichier seul (`labo/run-partager-dossier.mjs`, 38 sur 38 après le changement ; `labo/run-partager-recevoir.mjs` propre).
- **Voulu, et dit** : tout éditeur du document qui reçoit peut accepter ou refuser (la marque n'est pas un verrou de Grist : le PDF est déjà dans la table ; question posée au porteur) ; un fichier accepté dont le contenu est remplacé par l'envoyeur reste accepté (« à jour », 72 ; question posée au porteur).
- **Pas mesuré** : le rejeu à trois comptes (propriétaire, éditeur, lecteur) sur les gestes nouveaux (envoi d'un dossier, lignes du suivi) ; la portée par lien de la colonne du dossier pour un deuxième document relié (essais sans Grist seulement) ; les signatures du moteur (elles sont celles de Sync+, non relues ici).

## 102. L'explorateur lisait ses tables l'une derrière l'autre : 760 ms d'attente de Grist avant la première ligne ; lues ensemble et l'adresse apprise pendant la lecture, il en reste 370 (mesuré le 11/11, vrai Grist 1.7.19 derrière un relais de 40 ms d'aller-retour, Firefox 160 ; `labo/run-identite.mjs` 42 sur 42)

Demande d'Antoine du 11/11 (« le temps d'afficher les fichiers dans l'explorateur est un peu long »). Le banc de l'audit du 10/11 tournait avec un Grist sans latence, où une lecture coûte 5 à 9 ms : l'ouverture ne montrait rien. Le Grist d'Antoine est celui d'une instance distante : le relais (`delai-grist.mjs`, dans `gfs/audits/explorateur-affichage-2026-11-11/banc/` des fichiers du projet) ajoute 20 ms à chaque paquet dans chaque sens, HTTP et WebSocket sans y toucher. Chaque appel de GFS à Grist (`window.__trace`, copie de travail hors du dépôt) y est chronométré.

- **Une écriture coûte deux lectures** (96 contre 46 ms) ; cinq tables lues l'une après l'autre prennent 230 ms, lues ensemble 93 ms : Grist répond à des demandes simultanées, la seconde de deux demandes sur la même table prend un peu plus (88 contre 47 ms).
- **Avant** (document de trois tables d'apps, 36 fichiers), du début du code de GFS à la liste peinte : 739, 782 et 779 ms, soit seize fois le prix d'une lecture (47 ms), une dizaine d'appels de suite : la liste des tables et le rangement de GFS (deux fois, en parallèle), la ligne-sonde ajoutée (`AddRecord`), relue, retirée (`RemoveRecord`), la liste des tables de l'arrivée, celle de la lecture des fichiers, le rangement, puis les trois tables d'apps **l'une après l'autre**. Chaque table de fichiers de plus (rangement propre d'une app, table liée du poids, table reçue) ajoutait un aller-retour.
- **Après** : 363, 364 et 380 ms, soit huit fois le prix d'une lecture. Trois changements : `loadFiles` lit toutes ses tables ensemble après la liste des tables (`explorer-data.js`, `readEverything` ; `loadReceived` et `loadSpaces` aussi) ; l'adresse de la personne n'est plus attendue avant d'ouvrir l'explorateur, mais seulement avant de ranger (`loadFiles` reçoit la promesse, `Rangement.learning`) ; la ligne-sonde part sans que l'adresse attende son retrait.
- **Un piège, mesuré** : GFS relisait la liste dès qu'il apprenait l'adresse (`#onIdentity`) ; avec l'adresse apprise PENDANT la première lecture, cette relecture jetait ce que la première avait lu (421 à 472 ms au lieu de 363 à 380, et deux lectures de chaque table). La lecture qui a attendu l'adresse n'est plus relancée ; `labo/run-identite.mjs` compte les tables lues (`lab.reads()`, `fetch_table` à la frontière du moteur) : une seule lecture des modèles à l'ouverture, 2 sans la garde.
- **De bout en bout** (cadre du widget créé → première ligne, GFS servi en « fibre » simulée, 4 passages à froid) : 1 206 ms [1 077–1 210] avant, 761 ms [734–766] après. Le rangement personnel est appliqué dès la première liste (dossier « Formation » de la personne d'essai, pas celui d'une autre), la ligne-sonde est retirée, la table des modèles est lue une fois.
- **Document lourd** (40 modèles de 400 Ko, 16 Mo) : 1 263 à 1 351 ms avant, 882 à 1 011 ms après. Reste la première lecture d'une session, toujours complète (la lecture légère, faits vérifiés 83, ne prend la suite qu'après avoir VU un document lourd) : 600 à 700 ms à 16 Mo sans limite de débit, plus sur un vrai réseau.
- **Pas mesuré** : l'instance distante elle-même (le relais ne simule que la latence), le Firefox des PC d'Antoine, un document de plusieurs milliers de fichiers (la liste fenêtrée, faits vérifiés 87, est déjà là), l'ouverture directe sur une app (le code attend l'adresse avant d'ouvrir l'app, comme avant).
- **Ce qui reste le plus long** : l'ouverture se fait en trois enchaînements parallèles ; le plus long est « registre des apps (2 allers-retours) → liste des tables de l'arrivée → liste des tables de la lecture → lecture » ; la sonde de l'adresse (liste des tables, rangement, ajout, relecture) finit plus tôt. Commencer la lecture avant la décision d'arrivée gagnerait encore environ 80 ms, au prix d'une lecture lancée pour rien quand la section s'ouvre sur une app : non fait.

## 103. Une vue qui n'a de Publipostage+ que ses droits, sa date d'export ou ses pièces jointes arrivait sur la page blanche de l'app ; seul un modèle choisi la fait s'ouvrir (mesuré le 12/11, vrai Grist, `labo/run-arrivee.mjs`)

**Constat d'Antoine (12/11, Firefox, Grist de la DINUM)** : GFS rechargé arrive sur Publipostage+ et un document vide, alors que « Réglages > Vue » dit « Aucun modèle choisi pour cette vue ». **Cause lue** (`js/broker/arrival.js`, `js/apps/manifest.js`) : une vue arrive sur une app dès qu'**un seul** des six réglages déclarés par son manifeste a une valeur, et Publipostage+ en déclare six (`modeleDeLaVue`, `modeleSelonLigne`, `droitsAcces`, `dateDernierExport`, `pp_attach_column`, `pp_attach_mode`) ; l'app est permanente (toujours installée). Sans modèle ni ★ elle ouvre sa page blanche (`js/main.js`, ordre d'arrivée). Ses écritures de ces clés se font toutes sur un geste de la personne (`js/access-rights.js`, `js/export-date.js`, `js/row-template.js`, `js/view-template.js`, relus à `de63f27`) : une vue qui a servi à Publipostage+ avant le changement d'adresse du widget en garde donc les clés. Le réglage précis de la vue d'Antoine n'a pas été lu (son Grist n'est pas joignable d'ici).

**Changement (choix d'Antoine du 12/11, « Seulement si un modèle est choisi »)** : champ `reglagesArrivee` du manifeste (contrats 2.5, point 5) ; Publipostage+ : `modeleDeLaVue` et `modeleSelonLigne` ; un objet qui dit `enabled: false` ne compte pas (le « modèle selon la ligne » décoché garde ses règles : `js/row-template.js`, `normalizeRaw`).

**Mesuré** (labo grist-static 0.1.6, Chromium, 700 × 400, vraie Publipostage+ à `de63f27`, vraie Automation+ à `aaad9bf`) : en français / clair et en anglais / sombre, 41 vérifications sur 42 chacune, et 24 sur 24 en lecture seule (`LAB_READONLY=1`, les parties qui écrivent sautées) ; la date du dernier export seule, les droits et les pièces jointes seuls, le modèle selon la ligne décoché : l'explorateur ; le modèle selon la ligne coché, ou le modèle de la vue avec les autres réglages : Publipostage+ s'ouvre ; le graphe d'Automation+ ou sa ligne `Workflow` avec ces réglages de Publipostage+ : Automation+ s'ouvre. **Sur l'ancien code : 5 de ces vérifications échouent.** Tests : `test/arrival.test.mjs` et `test/manifest.test.mjs` (cinq échouent sur l'ancien code).

**La 42e vérification du labo échoue aussi sur le code d'avant** : « aucune phrase d'avertissement de GFS » ; le labo reçoit « GFS : les réglages restent un brouillon : un brouillon est déjà posé » dès la partie 2, avec ou sans ce changement. La cause n'a pas été cherchée (le labo pose ses réglages par `grist.setOption` depuis le cadre de GFS, ce qui peut laisser le brouillon que GFS signale). **Non mesuré** : Firefox (aucune interface de plus), le Grist de la DINUM, la vue réelle d'Antoine.
