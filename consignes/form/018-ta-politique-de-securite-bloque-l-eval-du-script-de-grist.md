# 018 · Ta politique de sécurité bloque l'`eval` du script de Grist : ajoute `'unsafe-eval'` et nomme le fichier en entier, sans quoi Form+ ne démarre pas

App : Form+ · posée le 04/11/2026 · panne vue par le porteur le 04/11 en créant un formulaire depuis GFS, reproduite par GFS · quand : **en premier**, avant le
prochain lot ; une ligne de `poc/widget.html` et un essai ; tant que ce n'est pas fait, Form+ ne s'ouvre pas dans le Grist du porteur ; visible aussi dans l'app seule

## Quoi

**Ce que le porteur a vu.** Il a voulu créer un formulaire depuis GFS (Firefox, le Grist de la DINUM). Form+ n'a jamais dit « prête », ni sur ton site en ligne
(`6059fb9`, ses numéros de ligne sont ceux de sa console), ni sur la copie figée de GFS (`0de37ac`) : GFS a attendu 15 s, a ouvert la copie, a attendu 15 s de plus, puis
a écrit « Form+ ne répond pas ». Sa console :

```text
Uncaught EvalError: call to eval() blocked by CSP        (https://docs.getgrist.com/grist-plugin-api.js:251)
Content-Security-Policy : … « script-src 'self' https://unpkg.com https://docs.getgrist.com » (la valeur 'unsafe-eval' est manquante)
Uncaught (in promise) TypeError: can't access property "ready", grist is undefined        (poc/js/main.js:133)
```

Le fichier que sert `docs.getgrist.com` s'évalue par `eval()` ; la ligne `Content-Security-Policy` de `poc/widget.html` refuse l'`eval`. Le script s'arrête au premier appel,
`window.grist` reste vide, `grist.ready()` (`main.js`, ligne 133) échoue, et ta page reste sur « Connexion à Grist… ».

**Mesuré par GFS** (vrai Grist Docker 1.7.19, Firefox 159, « Nouveau > Formulaire ») avec un script d'API enveloppé dans `eval(…)`, ce que fait le fichier de `docs.getgrist.com` :
la même console, jamais « prête », sur ton site comme sur la copie. Le script que sert un Grist Docker n'évalue rien : c'est pourquoi ni tes essais (`tests/grist-env/`) ni
ceux de GFS ne l'avaient vu. Avec la ligne ci-dessous, la même mesure donne Form+ prête en 0,2 s.

**Ce que tu fais.**

**1. Dans `poc/widget.html`, la directive `script-src` de la politique :**

```text
script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js https://unpkg.com;
```

Le reste de la politique ne change pas. Deux choses : `'unsafe-eval'`, que ce fichier exige (une politique ne peut pas l'attacher à un seul fichier : il ne reste que pour lui), et
l'adresse **entière** du script à la place de toute l'origine `https://docs.getgrist.com`, comme le font GFS, Publipostage+ et Automation+ (le guide, règle 11, le dit). Écris la
raison dans le commentaire au-dessus de la politique (celui de Publipostage+ : « `'unsafe-eval'` reste, faute de mieux : le fichier que Grist sert s'évalue »). Ton outil d'audit
le signalera peut-être : c'est le même cas que Publipostage+ et Automation+, qui le gardent avec cette raison.

**2. Un essai qui le tient.** Un essai hors ligne lit la politique de `poc/widget.html` et refuse qu'elle perde `'unsafe-eval'` ou l'adresse entière du script. Pour que ton banc
(`tests/grist-env/`) voie ce que voit le porteur, fais-y servir le script d'API sous la forme `eval(` + `JSON.stringify(<le fichier>)` + `);` : une page sans `'unsafe-eval'` y
échoue alors comme chez lui.

**3. En option, à ta main.** `loadPluginApi()` (`plugin-loader.js`) résout `true` dès l'événement `load` du script, même quand le script a échoué dans son `eval` : tu tombes alors
sur un `TypeError` muet, et ta page n'en dit rien. Vérifier `window.grist && typeof window.grist.ready === 'function'` avant de résoudre, et dire la cause à l'écran, aurait montré
le problème tout de suite.

## Pourquoi

Form+ est la seule app de la suite dont la politique de la page n'a pas `'unsafe-eval'` pour le script de Grist : la politique de GFS le dit en toutes lettres (« même raison que
dans les apps »), Publipostage+ et Automation+ la gardent avec cette raison, et la consigne 007 de Tuesday donne la même règle. Ton correctif du 21/10 (`85ac56d`) a ajouté
`docs.getgrist.com` à `script-src` après un essai contre un Grist auto-hébergé, dont le script n'évalue rien : la politique ne lui manquait de rien. Le fichier que ton chargeur
prend ensuite (`docs.getgrist.com`, dès que l'origine qui encadre le cadre n'est pas dans ta liste : toujours dans GFS) est un bundle de développement qui s'évalue. Le chargeur
est le même hors de GFS : l'app seule dans le Grist du porteur butterait sur la même ligne (lu dans le code, non mesuré).

## Fait quand

La politique de `poc/widget.html` garde `'unsafe-eval'` et l'adresse entière du script, un essai le tient, et `GFS-ETAT.md` donne « 018 · faite · `commit` ». GFS avance alors la
référence (commit à part, relu), rejoue le labo avec un script d'API qui s'évalue (Form+ prête sur son site comme sur la copie), et passe la 018 à « faite » en lisant ta page.
