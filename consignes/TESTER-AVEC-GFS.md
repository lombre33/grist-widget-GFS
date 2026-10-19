# Tester son app assemblée à GFS, sans rien pousser chez GFS

Pour le projet d'une app qui code une fonction à bibliothèque nouvelle, ou qui veut voir son app dans GFS. Tout se fait dans
une **copie jetable de GFS**, à côté du dépôt de l'app (jamais dedans) : rien n'y est commité, rien ne se pousse, ni chez GFS
ni dans l'app. Il faut `git`, `node` (22), `npm` (le registre répond) et Chromium avec Playwright : le conteneur du cloud les a.

État au 14/10/2026 : les étapes 1 à 3 ont été essayées depuis une copie neuve, avec Publipostage+ (41 secondes : la copie,
l'app branchée, une bibliothèque ajoutée avec un catalogue « cohérent », le labo qui ouvre l'app dans son sous-cadre isolé).
Pas encore essayé : une extension nouvelle qui reçoit sa bibliothèque dans ce labo ; le premier essai le dira. Les chemins
sont ceux du prototype de GFS à cette date ; si l'un a bougé ou si une étape bloque, l'écrire dans « Questions pour GFS »
plutôt que la contourner.

Au 16/10/2026 : **le fichier assemblé** (section 2 bis, consigne 012) est construit par l'outil depuis le registre npm, à
l'identique de l'essai de GFS, et la fenêtre « Apps et extensions » le montre sans CDN, avec la raison ; aucune app ne l'a
encore essayé dans ce labo.

Au 19/10/2026 : `edition-live` 1.0.0 et l'extension « Édition collaborative » de Publipostage+ sont dans la liste, le catalogue et le
manifeste réels de GFS (consigne 013) : une copie neuve de GFS les a déjà, et la section 2 bis ne sert plus que pour une extension
nouvelle. Le labo les joue de bout en bout avec ton app (`prototype/labo/run-edition.mjs`).

Aussi au 19/10/2026 : le fichier assemblé a son CDN dans le catalogue réel de GFS, jsDelivr, qui le sert depuis le dépôt public de GFS à un
commit épinglé (consigne 016 : l'adresse exacte que la CSP de ton app nomme). `run-edition.mjs` joue le CDN, sans puis avec cette adresse
dans la CSP. Une extension nouvelle essayée dans ta copie n'a pas de CDN : l'outil écrit `cdn: null` tant que le commit épinglé de la liste
ne porte pas le fichier, la copie de GFS est son seul mode, et le CDN entre à la publication par GFS.

## 1. La copie de GFS, l'app à la place de son sous-module

```bash
git clone --depth 1 https://github.com/lombre33/grist-widget-GFS.git gfs-essai
rmdir gfs-essai/prototype/apps/<app>      # <app> : publipostage ou automation ; le sous-module n'est pas tiré, le dossier est vide
ln -s "$(realpath <dépôt de l'app>)" gfs-essai/prototype/apps/<app>
```

L'app est lue telle qu'elle est dans son dossier de travail, commitée ou non.

## 2. La bibliothèque, en local

C'est ce que GFS fera pour de bon quand la demande sera prête (`LISEZ-MOI.md`, « Demander à GFS »).

1. `gfs-essai/prototype/bibliotheques/package.json` : la version exacte dans `dependencies`, et l'entrée
   `gfs.bibliotheques.<id>` = `{ "paquet": "<paquet npm>", "fichier": "<fichier du paquet à servir>" }`.
2. `cd gfs-essai/prototype && node outils/bibliotheques.mjs` tire le paquet (`npm pack`), calcule l'empreinte et écrit
   `bibliotheques/catalogue.json` et la copie `vendor/<id>/<version>/<fichier>`. `node outils/bibliotheques.mjs --verifier`
   relit ces fichiers sans réseau (« catalogue cohérent »).
3. `gfs-essai/prototype/manifestes/<app>.json`, clé `extensions` : copier l'entrée `graphique` et l'adapter (`id`, `nom` en
   français et en anglais, `dossier` de l'extension dans l'app, `bibliotheques: [{ "id": "<id>", "version": "<version>" }]`).

## 2 bis. Plusieurs paquets en un seul fichier assemblé par GFS (consigne 012)

Quand une extension a besoin de plusieurs paquets qui partagent leurs instances avec les bibliothèques natives de l'app (le cas
de l'écriture en direct), GFS les assemble en un seul module (contrats 2.6, points 8 à 11). Remplacer l'étape 1 de la
section 2 par ceci, une seule fois par copie :

1. `cd gfs-essai/prototype && npm ci` : installe `esbuild`, épinglé en version exacte, que l'outil n'appelle que pour cela.
2. `gfs-essai/prototype/bibliotheques/package.json` : les six paquets dans `dependencies` (versions exactes, celles de ta
   demande) et l'entrée `assemble` de la liste :

```json
{
  "dependencies": {
    "yjs": "13.6.33", "y-protocols": "1.0.7", "lib0": "0.2.119", "@tiptap/y-tiptap": "3.0.10",
    "@tiptap/extension-collaboration": "3.31.3", "@tiptap/extension-collaboration-caret": "3.31.3"
  },
  "gfs": { "bibliotheques": { "edition-live": { "assemble": {
    "version": "1.0.0",
    "paquets": ["yjs", "y-protocols", "lib0", "@tiptap/y-tiptap",
                "@tiptap/extension-collaboration", "@tiptap/extension-collaboration-caret"],
    "modules": ["yjs", "y-protocols/awareness", "@tiptap/y-tiptap",
                "@tiptap/extension-collaboration", "@tiptap/extension-collaboration-caret"],
    "externes": ["@tiptap/core", "prosemirror-model", "prosemirror-state",
                 "prosemirror-transform", "prosemirror-view"],
    "alias": { "@tiptap/pm/model": "prosemirror-model", "@tiptap/pm/state": "prosemirror-state",
               "@tiptap/pm/transform": "prosemirror-transform", "@tiptap/pm/view": "prosemirror-view" }
  } } } }
}
```

3. `node outils/bibliotheques.mjs` (trois secondes) écrit `vendor/edition-live/1.0.0/edition-live.js` (145 862 octets),
   `LICENCES.txt` à côté et l'entrée du catalogue : `forme: "module"`, `cdn: null` (l'adresse jsDelivr ne vient qu'à la publication par
   GFS, quand un commit épinglé porte le fichier), l'empreinte. L'outil **refuse** de rien
   écrire si le fichier contient un paquet de plus que la liste, ou laisse un nom nu de plus ou de moins que `externes` ;
   si tes versions ou ton éditeur demandent un autre `@tiptap/pm/<x>`, il le dit, et c'est alors à toi de l'écrire dans
   « Questions pour GFS » (une ligne de plus dans `externes` et `alias`, décidée par GFS). `--verifier` relit le tout sans
   réseau.
4. `manifestes/<app>.json`, clé `extensions` : comme à l'étape 3 de la section 2, avec
   `bibliotheques: [{ "id": "edition-live", "version": "1.0.0" }]`.

Ce que ton extension reçoit dans la copie : `contexte.bibliotheques['edition-live']` vaut
`{ src, integrite, forme: 'module' }`, `src` étant l'adresse de la copie de GFS (dans ta copie, **sans CDN** : c'est son seul mode, la
fenêtre grise « Depuis un CDN » et dit pourquoi ; dans GFS, l'adresse jsDelivr du catalogue donne le même fichier avec la même empreinte, et
ta CSP doit la nommer). Elle se charge par `<script type="module" src integrity crossorigin="anonymous">` (jamais `import()`), puis
`globalThis.GfsPaquets['edition-live'].modules['yjs']` et les quatre autres.
Dans le labo, `@tiptap/core` et `prosemirror-*` viennent de la carte d'importation de ton app, par le miroir de tes CDN.

## 3. Le labo « vrai Grist »

Grist y est grist-static, dans Chromium ; GFS y est ajouté comme widget, en accès complet, et l'app s'ouvre dans son
sous-cadre isolé, comme chez une personne.

```bash
cd gfs-essai/prototype/labo
npm install                                  # grist-static
bash build-mirror.sh                         # Publipostage+ seulement : le miroir de ses bibliothèques de CDN (le cloud n'atteint que npm)
REPO_DIR="$(realpath ../..)" node lab-server.mjs & SERVEUR=$!     # Grist sur 8910, GFS et l'app sur 8911 : ports libres
node essai.mjs
kill $SERVEUR                                # le serveur peut aussi rester lancé entre deux essais
```

`essai.mjs`, à écrire dans `gfs-essai/prototype/labo/` (modèles : `run-slice1.mjs` ; `run-sondes.mjs` pour une bibliothèque
reçue de GFS) :

```js
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
const lab = await startLab({ lang: 'fr' });     // un vrai Grist avec GFS ; colorScheme: 'dark' pour le sombre
const app = await lab.openApp('<app>');         // « Apps et extensions » : coche l'app, l'ouvre, rend son cadre
// l'extension : lab.openModules(), puis la case [data-fk="ext:<app>/<extension>"]
// les gestes à la vraie souris (app.locator(…).click()), jamais dispatchEvent, puis check('ce qu'on attend', condition)
await lab.browser.close();
```

- **Mode « Copie de GFS »** (case `[data-fk="mode:<app>/<extension>/vendorise"]`) : le miroir est construit avec la liste de
  l'app, il n'a donc pas la bibliothèque d'une extension (la nouvelle, ni Plotly une fois la 005 faite). L'essai se fait avec
  la copie que le labo sert depuis `vendor/`, pas avec le CDN. Pour un fichier assemblé, la case n'existe pas à choisir : la
  copie est déjà le mode de l'extension, et `[data-fk="mode:<app>/<extension>/cdn"]` est grisée.
- **700 × 400** : `lab.fitPanel(undefined, 700, 400)`.
- Ce que l'essai apprend sur GFS (la source de la bibliothèque, la sécurité, un contrat qui manque) va dans « Questions pour
  GFS » ; la copie se supprime à la fin.
