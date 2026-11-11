# 029 · Le fichier d'essais `poc/js/tests.js` (265 Ko) ne se charge plus à l'ouverture : il ne vient qu'avec `#test`

App : Form+ · posée le 10/11/2026 · décision du porteur du 10/11 (carte « Demander aux apps de charger à la demande ce qu'elles n'utilisent pas ? »,
option « Form+ et Grist-BI d'abord ») · quand : au prochain lot, sans urgence ; une ligne de code ; vaut aussi dans l'app seule (le premier
affichage est plus léger partout)

## Quoi

**1. Dans `poc/js/main.js`, ne charge plus `tests.js` d'emblée.** À `2faf93b`, la ligne 19 est `import { runTests } from './tests.js';` et la
ligne 137 ne s'en sert que pour l'adresse `#test` :

```js
if (hashParams.has('test')) { await runTests(); return; }
```

Retire l'import statique et charge le module à ce moment-là :

```js
if (hashParams.has('test')) { const { runTests } = await import('./tests.js'); await runTests(); return; }
```

**2. Rien d'autre ne change.** `#test` ouvre la même suite, `.github/scripts/run-widget-tests.js` l'ouvre par cette adresse, et ses essais restent
verts. Si `tests.js` fait autre chose que définir `runTests` au chargement (un effet de bord dont le reste de l'app dépendrait), ne force rien : dis-le
dans ta page d'état.

**3. Mesure chez toi, avant et après** (onglet Réseau, cache vidé, ouverture de l'éditeur) : le nombre de requêtes et les octets reçus au premier
affichage. Écris les deux nombres dans ton `GFS-ETAT.md` (le gain réel dépend de ce que Form+ charge d'autre à ce moment-là : GFS ne l'a pas mesuré
à ce détail).

## Pourquoi

GFS a mesuré le 10/11 l'ouverture de ses apps sous Firefox, dans un vrai Grist (audit vitesse et poids). Form+ s'affiche en 834 ms sur un réseau ADSL
simulé (120 ms de latence, 20 Mbit/s) avec ses 34 requêtes, plus lentement que Grist-BI (658 ms, 25 requêtes), qui pèse pourtant 3,6 fois plus : le coût
d'une app suit le **nombre** de fichiers avant leur poids. Dans les 19 fichiers de Form+ (675 Ko), `tests.js` pèse 265 Ko, soit 39 %, et il est dans le
chemin de démarrage alors qu'il ne sert qu'avec `#test`. Décision du porteur du 10/11.

## Fait quand

- `poc/js/main.js` n'importe plus `tests.js` en début de fichier ; la page ouverte sans `#test` ne le demande pas (onglet Réseau) ;
- avec `#test`, la suite tourne comme avant et la CI est verte ;
- les mesures avant et après sont dans `GFS-ETAT.md`.
