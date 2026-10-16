# 012 · Écriture en direct : les réponses de GFS aux deux questions

App : Publipostage+ · posée le 16/10/2026 · répond aux deux « Questions pour GFS » et à la demande d'écriture en direct du
`GFS-ETAT.md` (commit `1894442`, relu sur `47fae07`) · quand : avant d'écrire le code de l'extension « Édition collaborative » ;
sans effet dans l'app seule (la ligne du menu reste grisée)

## Quoi

**1. Les six bibliothèques : un seul fichier, assemblé par GFS** (choix du porteur, 16/10). Ni un fichier par bibliothèque avec
ta carte d'importation pour les relier, ni rien de nommé dans ton dépôt : GFS construit un seul module qui contient les six
paquets (et les 33 modules de `lib0` qu'ils tirent) et laisse en noms nus les bibliothèques de ton éditeur.

1. **Le fichier** s'appelle `edition-live`, version `1.0.0` (la version est celle de GFS, pas d'un paquet). Il contient `yjs`
   13.6.33, `y-protocols` 1.0.7, `lib0` 0.2.119, `@tiptap/y-tiptap` 3.0.10, `@tiptap/extension-collaboration` et
   `@tiptap/extension-collaboration-caret` 3.31.3, les versions de ta demande. Il laisse à ta carte d'importation **cinq noms,
   que ton `index.html` nomme déjà** : `@tiptap/core`, `prosemirror-model`, `prosemirror-state`, `prosemirror-transform`,
   `prosemirror-view`. Les `@tiptap/pm/<x>` des paquets sont renvoyés à `prosemirror-<x>` par l'outil de GFS.
2. **Rien à ajouter chez toi** : ni dans `dependances`, ni dans la carte d'importation (les 24 `lib0/*`, `yjs`, `y-protocols/*`,
   `@tiptap/y-tiptap`, les deux extensions et le `@tiptap/pm/state` de l'essai n'y entrent pas), ni dans la CSP : tant que GFS
   n'a pas d'adresse publique, le fichier n'existe qu'en copie de GFS (`cdn: null`), que `script-src 'self'` laisse passer.
   Quand GFS sera publié, une consigne te donnera l'adresse du CDN à nommer dans la CSP, comme pour Plotly (007).
3. **Le chargement** : `contexte.bibliotheques['edition-live']` vaut `{ src, integrite, forme: 'module' }` (et l'événement
   `extensions` le redonne, contrats 5.2). Au premier usage de l'extension, elle crée
   `<script type="module" src="…" integrity="…" crossorigin="anonymous">`, attend son `load`, puis lit
   `globalThis.GfsPaquets['edition-live'].modules[<paquet>]` : l'espace de noms du module, sous le nom du paquet npm. Les cinq
   clés sont `yjs`, `y-protocols/awareness`, `@tiptap/y-tiptap`, `@tiptap/extension-collaboration` et
   `@tiptap/extension-collaboration-caret` ; `import * as Y from 'yjs'` de l'essai devient
   `const Y = paquet.modules['yjs']`, et les deux extensions de TipTap se prennent par leur export nommé
   (`Collaboration`, `CollaborationCaret`). **Pas d'`import()`** : l'empreinte ne se pose pas sur un import dynamique.
4. **Le déclaré** : l'entrée de l'extension dans `gfs.json` exige `bibliotheques: [{ "id": "edition-live", "version": "1.0.0" }]`
   (contrats 2.6, point 5). Sans la source dans le contexte (app seule, extension inactive) ou si le chargement échoue
   (empreinte, réseau), la ligne du menu reste grisée avec la raison, jamais muette (5.2, point 5).

**2. Le canal : la table reste le tuyau, et sa prévenance est une relecture toutes les 250 ms.** GFS n'a pas de canal plus
rapide que la table à offrir, et la table est le bon tuyau : la donnée reste dans le document, sous les droits de Grist. Mais
les « ≈ 90 ms » de ton essai viennent de la prévenance de Grist, et **Grist ne prévient un widget que des changements de la table
de sa section** (contrats 5.5, point 1) : dans GFS, la table du direct n'est pas celle de la section de GFS. Voici ce que GFS
a mesuré pour le corriger (5.5, point 2, labo, sans réseau) : prévenance de Grist 20 ms ; **relecture de la table toutes les
250 ms, 156 ms (p90 244)**, soit la prévenance plus la moitié de l'intervalle, **125 ms de plus en moyenne et 250 ms au pire**,
pas 0,5 à 1,5 s.

1. **Ton canal Grist relit la table du direct par `grist.docApi.fetchTable('<table>')`** (relayé par le courtier : la table est
   à déclarer dans `permissions.lit`, et `ecrit` pour y écrire, sous le préfixe de l'app, contrats 2.3) au rythme du contrat
   5.5, point 3 : **250 ms** tant qu'une autre personne est présente (une ligne de présence récente) et que la page est
   visible ; **2 s** quand elle est seule ; jamais sous **100 ms** ; à l'arrêt quand la page est cachée ou que l'app n'est
   plus active. C'est un canal de plus derrière ton `connect(rappel)` (`channels.js`) : le rappel reçoit toujours la liste
   complète des lignes.
2. **Si la personne a lié la section à la table du direct**, `onRecords` prévient comme dans l'essai et il n'y a rien à
   relire (5.5, point 4). Le même canal sert les deux cas ; il choisit d'après `tableId` de la section.
3. **Pas de vignette relais pour l'instant** (une seconde section de GFS liée à la table du direct, mesurée à +1 ms de la
   prévenance, mais une vignette de plus à ajouter à la page). Elle n'est pas à prévoir : elle ne se décidera, avec le porteur,
   que si la mesure ci-dessous montre que 125 ms de plus ne suffisent pas, et elle s'ajoutera derrière le même canal (5.5,
   point 5).
4. **Le README de l'essai** dit « ≈ 90 ms » : à compléter par « avec la prévenance de Grist ; environ 125 ms de plus quand la
   table n'est pas celle de la section, relue toutes les 250 ms ».

## Pourquoi

1. Mesuré par GFS le 16/10 (page de test, CSP stricte, Chromium 141 ; faits vérifiés, 9) : un fichier de 145 862 octets (environ
   46 600 gzippés) fait se synchroniser deux éditeurs de l'app, texte, frappes simultanées, coupe d'un bloc, curseur et nom de
   l'autre, aussi dans un cadre isolé de même nature que celui de GFS. Si l'extension apporte **sa propre copie de ProseMirror**
   (404 Ko), le texte se synchronise mais **aucun curseur n'apparaît, sans une seule erreur** ; et une carte d'importation
   posée à l'exécution est refusée par une CSP comme la tienne. C'est pourquoi GFS ne livre pas les modules un à un.
2. Le défaut de 250 ms, 2 s et 100 ms est pris par GFS d'après cette mesure : la relecture coûte 5 à 9 ms (14 à 54 Ko) et suit la
   taille de la table, qui doit rester petite (ta compaction). **Non mesuré** : le réseau réel d'un Grist en ligne, deux
   navigateurs, les plafonds de l'offre. Un réseau simulé de 50 ms par sens ne change pas l'écart (+108 ms à 250 ms).

## Fait quand

`GFS-ETAT.md` donne « 012 · faite · `commit` » et efface les deux « Questions pour GFS » sur l'écriture en direct. Tests qui
échouent sur l'ancien code (sans GFS réel) : (a) l'extension charge un faux `contexte.bibliotheques['edition-live']` (un module
d'essai à la forme de 2.6, points 8 et 9) par `<script type="module">` avec l'empreinte, dans un cadre sans `allow-same-origin`,
lit `GfsPaquets['edition-live'].modules`, et reste grisée avec la raison si l'empreinte est fausse ; ta liste et ta carte
d'importation ne nomment aucun des six paquets ; (b) le canal relit à 250 ms avec une autre personne présente, à 2 s seul, pas
du tout page cachée, jamais sous 100 ms, et n'appelle pas `fetchTable` quand la table est celle de la section ; (c) seule, la
ligne reste grisée et rien d'autre ne change. L'essai assemblé avec le vrai fichier se fait dans ta copie de GFS
(`consignes/TESTER-AVEC-GFS.md`, qui dira quand l'outil sait construire ce fichier) ; mesure alors, sur un Grist en ligne avec
deux navigateurs, le délai d'une frappe à l'autre écran et écris-le dans « Questions pour GFS » : c'est ce qui confirme ou
corrige les trois rythmes. Le « demande de Publipostage+ » que le porteur dira ensuite fait ajouter `edition-live` à la liste
de GFS, déclarer l'extension dans son manifeste et avancer ta référence.
