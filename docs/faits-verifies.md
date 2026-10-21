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
