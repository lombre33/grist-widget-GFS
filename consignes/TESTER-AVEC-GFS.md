# Tester son app assemblée à GFS, sans rien pousser chez GFS

Pour le projet d'une app qui code une fonction à bibliothèque nouvelle, ou qui veut voir son app dans GFS. Tout se fait dans
une **copie jetable de GFS**, à côté du dépôt de l'app (jamais dedans) : rien n'y est commité, rien ne se pousse, ni chez GFS
ni dans l'app. Il faut `git`, `node` (22), `npm` (le registre répond) et Chromium avec Playwright : le conteneur du cloud les a.

État au 14/10/2026 : les étapes 1 à 3 ont été essayées depuis une copie neuve, avec Publipostage+ (41 secondes : la copie,
l'app branchée, une bibliothèque ajoutée avec un catalogue « cohérent », le labo qui ouvre l'app dans son sous-cadre isolé).
Pas encore essayé : une extension nouvelle qui reçoit sa bibliothèque dans ce labo ; le premier essai le dira. Les chemins
sont ceux du prototype de GFS à cette date ; si l'un a bougé ou si une étape bloque, l'écrire dans « Questions pour GFS »
plutôt que la contourner.

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
  la copie que le labo sert depuis `vendor/`, pas avec le CDN.
- **700 × 400** : `lab.fitPanel(undefined, 700, 400)`.
- Ce que l'essai apprend sur GFS (la source de la bibliothèque, la sécurité, un contrat qui manque) va dans « Questions pour
  GFS » ; la copie se supprime à la fin.
