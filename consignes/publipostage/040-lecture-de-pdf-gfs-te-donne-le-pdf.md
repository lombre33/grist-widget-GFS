# 040 · Lecture de PDF : GFS te donne le PDF qu'il garde, tu le montres dans ton mode Lecture (demande du porteur)

App : Publipostage+ · posée le 03/11/2026 · demande du porteur du 03/11 (« lecture de PDF, si possible via le mode lecture de Publipostage+ ») · quand : au prochain lot, sans urgence ;
du code dans ton app (une extension `lecture-pdf`, la lecture de l'ouverture dans `js/gfs-link.js` et `js/gfs-open.js`) ; sans effet dans l'app seule ; GFS grise « Lire » (« Pas encore ») jusque-là

## Quoi

**1. La demande.** Le porteur, dans GFS : « est-il possible d'avoir une lecture de PDF ? si possible via le mode lecture de Publipostage+ comme ça on a aussi les
commentaires et l'UI qui reste la même ». Il a choisi (carte du 03/11, option A) que **GFS garde les PDF** : ils sont dans l'explorateur de GFS, à côté des
fichiers des apps (« Nouveau > Importer > PDF »). Pour un PDF, « Lire » devient le geste principal de l'explorateur (le bouton, Entrée, le double-clic) ; GFS ouvre
ton app avec le PDF et **tu le montres dans ton mode Lecture**, avec son interface : le porteur ne veut pas un lecteur de plus, il veut le tien. Les commentaires
sur un PDF viennent à un lot suivant (point 5).

**2. Ce que GFS a livré** (contrats 2.6 point 12, 2.7 point 5, 5.2 point 3, 5.4 point 8 ; `prototype/labo/run-lire.mjs`).

- **Le geste.** Ton manifeste déclarera `actions.lire: [{ "type": "pdf", "extension": "lecture-pdf" }]` (GFS l'écrit, point 4). GFS télécharge **lui-même** le PDF
  (ton app ne reçoit aucun jeton et n'appelle jamais l'API de Grist pour cela), en fait un `File` à son nom, et ouvre ton app **une seule fois**, à l'ouverture
  (réponse à ton premier `contexte`, `GfsLink.opening()`) ou, app déjà ouverte, par l'appel `ouvrir` (`GfsLink.onOpen`) :

```
{ fichier: null, type: 'pdf', dossier, raison: 'lire',
  lecture: { id: <texte>, fichier: <File> } }
```

  `lecture.fichier` est le PDF (`File`, type `application/pdf`, nom du PDF). `lecture.id` est l'identifiant du PDF chez GFS (la colonne `Identifiant` de
  `GFS_Fichiers` : il ne change ni au renommage ni au remplacement) : c'est la clé où tu pourras accrocher ce que tu gardes d'un PDF. GFS ne redonne pas le PDF :
  un cadre rechargé sur place (le changement de langue) reçoit `null` et reprend ton ordre d'arrivée habituel (contrats 5.2, point 3) ; la personne rouvre le PDF
  depuis l'explorateur.

- **La bibliothèque.** GFS a ajouté `pdfjs` 1.0.0 à sa liste : pdf.js (`pdfjs-dist` 6.5.438, Apache-2.0), son moteur compris, en un seul fichier de 1,64 Mo.
  **Copie de GFS seulement, sans CDN** (`cdn: null` ; la fenêtre « Apps et extensions » grise l'option CDN avec sa raison) : l'adresse du CDN d'`edition-live`
  que ta CSP nomme déjà ne bouge pas, et tu n'as rien à ajouter chez toi, ni liste de bibliothèques, ni carte d'importation, ni CSP (`script-src 'self'` laisse
  passer la copie, qui est du même site). Tu la charges comme `edition-live` (012, point 1.3) : `contexte.bibliotheques.pdfjs` vaut `{ src, integrite, forme:
  'module' }` ; un `<script type="module" src integrity crossorigin="anonymous">`, son `load`, puis
  `globalThis.GfsPaquets.pdfjs.modules['pdfjs-dist/build/pdf.min.mjs']` (`getDocument`, `TextLayer`). **Pas d'`import()`** : l'empreinte ne se pose pas sur un
  import dynamique.

**Mesuré** dans un vrai Grist (serveur 1.7.19 en Docker, 700 × 400, à la vraie souris et au vrai clavier, en français clair et en anglais sombre, 43 vérifications
dans chacun) avec une app d'essai qui fait ce que cette consigne te demande : le `File` arrive dans un cadre sans `allow-same-origin`, intact (même empreinte
SHA-256), au démarrage comme par l'appel `ouvrir` (même cadre, non rechargé) ; pdf.js se charge sous `script-src 'self'` sans aucune violation de politique,
ouvre un PDF de trois pages, dessine la page et sa couche de texte (accents compris, un mot se sélectionne à la souris) ; lire n'écrit rien dans le document.

**3. Ce que GFS te demande.**

- **a. `js/gfs-link.js`, `normalizeOpening`** : garder `lecture: { id, fichier }` quand `raison` vaut `lire` (`id` un texte, `fichier` un `File` ; sinon
  l'ouverture est lue sans lecture, comme aujourd'hui). Aujourd'hui elle ne garde que `fichier`, `type`, `dossier`, `raison` et `importation` : le PDF tomberait là.
  Le kit 0.4.0 le laisse tomber aussi ; il le gardera dans sa prochaine version, sans que tu aies à l'attendre (le point a est chez toi).
- **b. `js/gfs-open.js`** : une ouverture qui porte `lecture` **n'est ni un « Nouveau » du type, ni une ouverture qui retombe sur ton ordre d'arrivée habituel**
  (la ligne, le modèle de la vue, le ★) : le PDF de la personne serait perdu sans un mot. Au démarrage (devant ton ordre d'arrivée, comme
  `startupBlankType`) et par l'appel `ouvrir`, la lecture désigne le PDF à ouvrir.
- **c. L'extension `lecture-pdf`** (« Lecture de PDF » / « PDF reading ») : du code dans `extensions/lecture-pdf/`, nommé par le registre de `js/extensions.js` comme
  `edition` (012) et `graphique` (005), chargé au premier usage. Elle lit `lecture.fichier.arrayBuffer()` et passe les octets à pdf.js. Ce que GFS a mesuré et que
  ton extension reprend :
  - `pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false, verbosity: 0 })` : `isEvalSupported: false` (aucune CSP d'app n'accepte
    `unsafe-eval`), `verbosity: 0` (sans quoi pdf.js écrit « Setting up fake worker. » en console à chaque document) ;
  - **le moteur tourne dans ta page** : un cadre sans `allow-same-origin` ne peut pas créer de `Worker` (`SecurityError`), pdf.js prend son « faux Worker » et le
    fichier de GFS le pose lui-même. Ne règle pas `GlobalWorkerOptions.workerSrc`, ne charge rien de plus. Lis **page par page** (`getPage(n)` à la demande), jamais
    le document d'un coup : une page très lourde fige l'interface quelques dixièmes de seconde (0,16 s au plus, mesuré) ;
  - pour fermer le document précédent, `loadingTask.destroy()` (le `PDFDocumentProxy` de pdf.js 6 n'a plus de `destroy()`) ;
  - la couche de texte (la sélection à la souris, et plus tard les commentaires) : `new TextLayer({ textContentSource: await page.getTextContent(), container,
    viewport }).render()` ; le conteneur a besoin de la variable CSS `--total-scale-factor`, posée à l'échelle de la page ;
  - **limites connues** (contrats 2.6, point 12) : les polices standard, les CMap et le décodeur JPEG 2000 ne sont pas dans le fichier : un PDF qui en dépend
    s'affiche avec les polices de repli, ou sans l'image ; un PDF scanné n'a pas de couche de texte ; un PDF protégé par un mot de passe passe par `onPassword`
    de pdf.js, la saisie est la tienne (une fenêtre de l'app, jamais `prompt()`). Non mesurés : Firefox, un PDF de centaines de pages.
- **d. Dans ton mode Lecture.** C'est ce que le porteur a demandé : le PDF s'affiche dans l'interface de ta Lecture (sa barre, ses réglages d'affichage), pas
  dans un lecteur à part. Ce qui s'applique à un PDF reprend ton interface ; ce qui ne s'y applique pas (l'édition, les modèles, l'export) reste là, **grisé avec
  sa raison, jamais masqué**. Le détail de l'interface est à toi ; si une question change ce que la personne voit au point de demander au porteur, pose-la dans
  « Questions pour GFS ». Les textes sont en français et en anglais dans le même lot.
- **e. La réponse à `ouvrir`** : `{ ouvert: true }` quand le PDF est ouvert à la fin ; `{ ouvert: false }` si la personne annule (la question « Enregistrer /
  Abandonner / Annuler » d'un modèle modifié se pose avant de le quitter, comme à la 014), si le fichier est illisible, vide ou n'est pas un PDF, ou si le mot de
  passe est refusé. Pas de délai : la personne peut prendre son temps. Dis ce qui s'est passé dans ton coin d'état.
- **f. Seule** (adresse sans `gfs=`) : rien ne change. Sans `contexte.bibliotheques.pdfjs` (extension éteinte), la lecture dit pourquoi et répond `{ ouvert: false }`.

**4. Ce que GFS fait de son côté.** Quand ton `GFS-ETAT.md` donne « 040 · faite · `<commit>` » et que « Demandes à GFS » porte la demande de l'extension (son nom en
français et en anglais, son texte, son poids en octets, ses fichiers et leurs points d'entrée), GFS la déclare dans ton manifeste avec `actions.lire` (un commit à part,
relu), passe `ACCEPTS_OPEN.publipostage.lire` à `true`, rejoue `run-lire` avec ton app et dégrise « Lire ». Jusque-là, « Lire » reste dans l'explorateur, grisé, et
dit que ton app ne lit pas encore les PDF de GFS : GFS n'ouvre jamais ton app avec un PDF qu'elle ne sait pas recevoir (elle ne saurait pas quoi en faire).

**5. Ce que cette consigne ne demande pas.** Aucune table, colonne, clé de réglage, message, appel ni adresse de plus : `lecture` voyage dans l'`ouverture` et
l'appel `ouvrir` que tu lis déjà. Les **commentaires sur un PDF** et le **rangement de tes exports PDF parmi les fichiers de GFS** (« écraser » ou « (1) ») sont deux
lots à suivre, un à la fois, chacun avec sa consigne.

## Pourquoi

Le porteur veut lire un PDF dans l'interface de ta Lecture et, ensuite, y laisser des commentaires. GFS est le seul à garder le PDF (une pièce jointe de son
document) et le seul à parler à Grist ; ton app est la seule à avoir cette interface de lecture : le PDF passe de l'un à l'autre, jamais le code. pdf.js est une
bibliothèque que ton extension n'a pas dans sa liste : c'est GFS qui la porte pour les extensions (cahier, section 2). Tant que ta page d'état ne dit pas cette
consigne faite, GFS **grise** « Lire » pour ton app : l'app d'aujourd'hui ne garderait pas `lecture` et le PDF serait perdu.

## Fait quand

`GFS-ETAT.md` donne « 040 · faite · `<commit>` », avec des tests qui échouent sur l'ancien code : `normalizeOpening` garde `lecture` (un texte et un `File`) quand
`raison` vaut `lire` et ne la garde pas pour une autre `raison` ; une ouverture `lire` n'ouvre ni modèle vierge ni ordre d'arrivée à la place du PDF ; le PDF reçu
s'ouvre (nombre de pages, texte de la première page) et le suivant remplace le premier sans recharger l'app ; un fichier illisible, vide ou refusé donne `{ ouvert:
false }` ; pdf.js se charge par la source de `contexte.bibliotheques.pdfjs` et par aucune adresse écrite dans ton code. Tu demandes ensuite l'extension à GFS (point 4).
