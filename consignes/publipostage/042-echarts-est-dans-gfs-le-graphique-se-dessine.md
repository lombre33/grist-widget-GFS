# 042 · ECharts 6.1.0 est dans GFS : « Créer un graphique… » se dessine, la référence est à `067c931` et les poids sont reportés (réponse à ta demande de bibliothèque)

App : Publipostage+ · posée le 03/11/2026 · réponse à ta demande de bibliothèque de « Demandes à GFS » (ECharts 6.1.0, 02/11 et 03/11) · quand : à lire maintenant ;
aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta demande est traitée.** Le porteur a signalé le 03/11 que le volet graphique de Slides+ semblait manquer d'une bibliothèque : c'était ECharts, que ta demande
attendait chez GFS et que GFS ne donnait donc pas encore à ton app. `Extensions.library('echarts')` rendait `null`, et ta fenêtre « Créer un graphique… » disait « Aperçu
indisponible : le module qui dessine les graphiques n'a pas pu se charger. Vérifiez la connexion » (le message est le tien : ce n'était pas la connexion). C'est corrigé.

**2. Ce que GFS a fait** (contrats 2.6, points 5 et 13 ; faits vérifiés, section 20 ; `2b0e184` et `06cfa16`).

- **La bibliothèque.** `echarts` 6.1.0 (Apache-2.0, forme `script`) est dans la liste des bibliothèques de GFS et dans son catalogue : l'adresse jsDelivr
  `https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js` (celle que ta politique de sécurité nomme déjà : rien à y changer) et l'empreinte
  `sha384-C2iskrW/uPW46KzOjrvJIQo4YkV8lkD+QS0CrDN18IIPIpT/g2USu8bTP3nvmIAD`, la tienne, que GFS a recalculée sur l'archive de npm (les mêmes octets que le CDN). La
  « Copie de GFS » est à côté, avec sa licence et son `NOTICE` (`vendor/echarts/6.1.0/LICENCES.txt`) : l'Apache 2.0 veut le `NOTICE` avec une copie redistribuée.
- **Ton extension.** Le manifeste de GFS demande maintenant `plotly` 2.13.2 **et** `echarts` 6.1.0 pour `graphique` ; les deux suivent le même mode (CDN ou copie de GFS), et
  l'extension n'est servie que si le catalogue a les deux.
- **Les poids** que ta page demandait de reporter : `diapositives` 471, `graphique` 168, `edition` 102 (Ko). GFS compte le dossier entier de chaque extension (consigne
  036), `present.html` et `slide-present.js` compris : ses sommes ne sont pas les tiennes, c'est la convention de GFS.
- **La référence de GFS** est avancée à `067c931` (commit à part, relu) : ton contrat avec GFS n'a pas bougé (mêmes verbes d'actions de Grist, mêmes tables internes, mêmes
  appels de l'API, un seul accès au stockage ; les adresses de plus sont `docx@9.15.1`, `echarts@6.1.0` et des espaces de noms XML). Elle contient tes commits `22157a8`
  (038) et `067c931` (039).

**3. Ce que GFS a mesuré** (un vrai Grist, Chromium, 700 × 400, à la vraie souris, ta version à `067c931` ; `prototype/labo/run-graphique.mjs`, 20 vérifications dans chacune de
quatre passes : français clair et anglais sombre, CDN et « Copie de GFS »). GFS donne `echarts` et `plotly` comme son catalogue le dit ; rien n'est demandé avant le premier
dessin, puis **une seule demande** part, que le navigateur contrôle par l'empreinte, sans aucune violation de ta politique de sécurité ; l'aperçu est une vraie image PNG
peinte (barres, radar, entonnoir et jauge) ; « Insérer » pose le graphique dessiné dans le cadre et ton modèle ne garde que sa définition. Rejoués sur ta version, sans échec :
`run-ouvrir-publipostage`, `run-diapositives`, `run-edition`, `run-modules`, `run-sans-cdn`. **Pas mesuré** : le vrai jsDelivr (le labo met une copie aux mêmes octets à son
adresse), Firefox, le Grist en ligne du porteur, un très gros tableau.

**4. Ce que tu fais.** Rien dans ton code. Dis « 042 · faite · lue, aucun code » dans `GFS-ETAT.md` et retire la demande d'ECharts de « Demandes à GFS » (elle est faite). Le jour où
tes options s'écriront pour une autre version d'ECharts, ce sera une nouvelle demande : GFS garde une version exacte par entrée du catalogue, et le manifeste de GFS et ton
`LIBRARY` (`chart-make.js`) doivent dire la même (contrats 2.6, point 5).

## Pourquoi

Une extension est servie avec **toutes** les bibliothèques qu'elle exige (contrats 2.6, point 5) : sans `echarts` au catalogue de GFS, l'app d'aujourd'hui ne peut pas dessiner un
graphique qu'elle crée, et GFS ne le disait pas. La mesure ci-dessus est celle du geste du porteur de bout en bout : la fenêtre « Apps et extensions », puis « Créer un graphique… ».

## Fait quand

`GFS-ETAT.md` donne « 042 · faite · lue, aucun code » et ne porte plus la demande d'ECharts. Si, dans GFS, « Créer un graphique… » ne dessine pas chez toi alors que
`GfsLink.library('echarts')` rend une source, dis-le dans « Questions pour GFS » avec le message que ta fenêtre affiche : GFS le rejoue dans un vrai Grist.
