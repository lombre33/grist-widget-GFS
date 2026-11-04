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
  `REVEAL_TIMEOUT_MS` à partir de `ready`), comme Grist pour ses widgets (`js/session.js`, `#reveal`) ; un cadre caché (`visibility:
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

GFS pose l'ambiance choisie (js/theme-apply.js) sur `<html>` et lit le mode (clair, sombre) que Grist y a posé. Ce que le script d'API de Grist y écrit, lu dans `grist-plugin-api.js`
(grist-static 0.1.6 ; `attachCssThemeVars`, ligne 27021 de ce fichier), à chaque message `theme` de Grist :

- une feuille `<style id="grist-theme">` (`@layer grist-theme { :root { --grist-theme-… } }`, plus quatre variables `--scroll-bar-*`), que la politique `style-src 'self'` de GFS refuse (rien ne s'applique) ;
- `document.documentElement.style.setProperty('color-scheme', appearance)` : un style **en ligne** sur `<html>` (c'est pourquoi une page que GFS n'a pas touchée porte déjà une propriété en ligne, `color-scheme`) ;
- les attributs `data-grist-theme` (le nom du thème) et `data-grist-appearance` (`light` ou `dark`).

Aucun nom ne ressemble à ceux de GFS : les jetons de la charte (`--bg`, `--accent`…) et de forme (`--radius-md`…) ne sont jamais écrits par Grist, et GFS ne touche ni à `color-scheme` ni aux attributs `data-grist-*`. Le mode que GFS suit est le
`color-scheme` calculé de `<html>`, que `css/gfs.css` tire de `data-grist-appearance` ou, à défaut, du système (`prefers-color-scheme`). Mesuré dans un vrai Grist (`labo/run-theme.mjs`) : les deux modes se suivent.

**Le sélecteur de couleur de « La mienne » (mesuré le 03/11, `labo/run-theme.mjs`, Chromium).** Le menu de couleur du kit (`createColorPalette`, 50 pastilles) mesure 419 × 171 à 700 × 400 et 289 × 171 à 420 de large ;
sous le bouton « Choisir ma couleur », il ne resterait pas 171 px dans un panneau de 400 : le menu se pose au-dessus (la même règle que les autres menus de GFS, `place` de `js/menu.js`), dans le panneau, sans défilement.
La fenêtre « Couleur personnalisée » (`ColorEditor`) mesure 480 × 290 à 700 × 400 et 408 × 282 à 420, sans défilement. Les fenêtres de GFS (`js/modal.js`) se posent maintenant l'une sur l'autre : la dernière ouverte est seule à
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
- **Pas mesuré** : Firefox, l'instance de la DINUM (la taille maximale d'une pièce jointe et la passerelle), la vraie Publipostage+ (consigne 043), un PDF de plus de 12 Mo, une personne qui refuse de créer `GFS_Rangement`.

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
- **Pas mesuré** : Firefox, l'instance de la DINUM, l'écran du répondant et l'aperçu de Form+ (`#fill`, `.pv-*`, que l'app garde à l'aspect dessiné par la personne : consigne 016), les états du test à blanc des nœuds d'Automation+
  (`trace-*`, dont le rouge d'échec et l'ambre d'avertissement sont à l'app), Grist-BI et Tuesday (pas encore au catalogue de GFS : ni manifeste ni sous-module).

## 24. La corbeille des PDF de GFS et le clavier de l'explorateur : ce que le vrai serveur a mesuré (04/11)

Décision du porteur le 04/11 : « tout doit pouvoir se faire depuis l'explorateur, avec une corbeille » (cahier, section 2 ; contrats 6.6, points 10 à 12). Mesuré avec
`labo/run-corbeille.mjs` dans un **vrai serveur Grist 1.7.19** (Docker, `labo/vrai-serveur.sh`) : GFS ajouté comme widget à un document neuf, panneau à 700 × 400, souris et clavier réels, en français clair et en anglais
sombre (46 vérifications dans chacune, aucune en échec), Chromium 141 ; puis dans un **vrai Firefox 159 sans écran** (`test/corbeille-firefox.mjs`, à 700 px, clair et sombre, français et anglais).

- **Une table d'une version plus ancienne** : on retire `SupprimeLe` et `SupprimePar` de `GFS_Fichiers` par l'API REST (`RemoveColumn`), puis « Suppr » sur un fichier : GFS ajoute les deux colonnes (`AddColumn`, `DateTime:UTC` et `Text`) à une table qui a
  déjà des lignes, sans poser de question (la table existe : aucun accord à demander) et sans créer d'autre table, puis marque la ligne. Les types relus par l'API REST sont ceux voulus.
- **Ce que Grist rend d'une date jamais écrite** : `null` (pas `0`, pas une chaîne). Écrite, la date revient **en secondes** (un entier, à une seconde près de l'horloge du labo). `UpdateRecord` avec `null` sur la colonne de date et `''` sur la colonne de texte les
  vide : l'API REST rend `null` et `""`. C'est pourquoi la lecture (`trashOf`, `js/explorer-model.js`) ne tient pour « à la corbeille » qu'une date strictement positive.
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
- **Ctrl, Alt et Méta** : aucune combinaison n'est liée (`js/explorer-keys.js`, essai Node) : Ctrl+D est le marque-page de Firefox, Ctrl+F sa recherche dans la page, Alt+← la page précédente ; Ctrl+C, Ctrl+X et Ctrl+V sont réservés à dupliquer et déplacer (lot 3).
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
**Pas mesuré** : l'app seule dans le Grist du porteur (le chargeur est le même : lu, non mesuré) ; le fichier réel de `docs.getgrist.com`.

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
