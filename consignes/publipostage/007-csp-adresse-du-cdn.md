# 007 · Précision de la 005 : la CSP garde l'adresse du CDN de Plotly

App : Publipostage+ · posée le 14/10/2026 · précise la 005 (point 4 et première puce de « Fait quand ») et la « Pourquoi » de la
006 · quand : avant de toucher à la CSP de `index.html` pour la 005 ; le reste de la 005 ne change pas

## Quoi

La 005 disait que Plotly sort aussi de la CSP de la page. Pour le mode CDN, c'est faux, et l'essai de l'étape 2 du prototype de
GFS le montre : GFS ne peut imposer aucune politique de sécurité à un sous-cadre (GitHub Pages n'envoie pas l'en-tête qui le
permettrait). La seule CSP qui décide de ce que l'app charge est donc celle de sa page. Le porteur a répondu « CDN d'abord » le
14/10 : GFS donne l'adresse du CDN à l'extension, et la CSP de l'app doit la laisser entrer, sinon le navigateur refuse le
script. Pour la CSP, la 005 se lit ainsi :

1. **La CSP de `index.html` garde l'adresse exacte de Plotly 2.13.2** : celle du catalogue de GFS,
   `https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js`, entière, et rien d'autre pour le graphique
   (ni l'hôte `cdn.jsdelivr.net` ouvert en entier, ni `blob:`). Elle y est déjà (ligne 20 sur `9d0230f`) : ne pas la retirer en
   faisant la 005. Un commentaire à côté dit pourquoi elle reste.
2. **Tout le reste de la 005 vaut** : Plotly sort de la liste de l'app et de l'import map, aucun fichier de code de l'app ne
   nomme l'adresse, et seul le point d'accès de l'extension appelle `window.Plotly`. Seule, l'app ne charge jamais cette
   adresse : le graphique y est grisé, la CSP ne fait que la permettre à GFS.
3. **La garde de code** (guide 4, « Bibliothèques d'extension ») se lit : ni la liste de l'app ni l'import map ne nomment Plotly,
   et la CSP d'`index.html` ne le nomme que par l'adresse du point 1.
4. **Pour toute bibliothèque d'extension à venir** (006) : la réponse de GFS donne l'adresse exacte à garder dans la CSP, une
   par bibliothèque. L'app n'en écrit aucune de sa main.

Lignes relevées sur `9d0230f` le 14/10, à relire sur `origin/main`.

## Pourquoi

Mesuré à l'étape 2 avec six CSP d'app différentes (`prototype/rapport.md`, section 1 point 4, et section 4 point 8) : la copie
vendorisée de GFS se charge dans les six sans que l'app la nomme (`'self'` suffit) ; le CDN ne se charge que si la CSP de l'app
nomme son adresse ou son empreinte, ou admet de charger le texte puis de l'exécuter ; il est refusé quand elle n'en dit rien ou
ferme les connexions. Une fausse empreinte est toujours refusée. Retirer l'adresse comme la 005 le disait casserait donc le mode
CDN, celui que le porteur a retenu.

## Fait quand

`GFS-ETAT.md` donne « 007 · faite · `commit` ». La CSP d'`index.html` nomme Plotly 2.13.2 par l'adresse du point 1 et par aucun
autre moyen. La garde de code du point 3 passe, et échoue si l'adresse disparaît de la CSP ou si Plotly revient dans la liste ou
dans l'import map.
