# 108 · Le secours d'un CDN est livré : tes bibliothèques passent par la copie de GFS quand le CDN échoue ou tarde (kit 0.31.0)

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 25/11/2026 · décision du porteur du 25/11 (« oui très bien, copie figée en back-up » : le secours d'un CDN, c'est la copie de GFS, jamais un deuxième CDN) · contrats 5.2 point 14 · kit 0.31.0 · faits vérifiés 170 · guide des apps 1.4, étape 3 · suite des 106 et 107
quand : au prochain lot, sans urgence, après ou avec la 106 ; un petit changement de code (deux chargeurs) ; sans effet tant que le CDN répond

## Quoi

**1. Ce que le porteur a décidé le 25/11.** Quand le CDN d'une bibliothèque échoue ou tarde (un réseau d'administration qui coupe jsDelivr, un hôte muet, des octets que l'empreinte refuse), l'app charge **la copie de GFS**, pas un deuxième CDN. GFS garde déjà cette copie de tes neuf bibliothèques natives et de celles de tes extensions.

**2. Livré côté GFS (25/11).**
- **GFS le dit à l'app** : `secours: { "<id>": { version, src, integrite, forme } }` dans le contexte et l'événement `extensions` (contrats 5.2, point 14). **Additif** : `bibliotheques` et `natives` ne changent pas. Pour toi, mesuré dans un vrai Grist avec ta vraie app (`6fd6eec`, `labo/run-graphique.mjs`) : **au CDN, 11 entrées** (tes neuf natives, plus Plotly et ECharts de l'extension « Graphique »), en copie figée 9 ; jamais une adresse de jsDelivr, toujours la copie de GFS avec sa propre empreinte. L'éditeur n'y est pas (sa copie est dans ton dépôt). `edition-live` y sera quand son extension sera active et au CDN (la mesure n'en a activé qu'une, le graphique) ; **`pdfjs` n'a pas de CDN** (sa copie de GFS est déjà son seul mode) : rien à secourir, `secours('pdfjs')` rend `null`.
- **Le kit 0.31.0** (`4774a99`) : `GfsLink.secours(id, version?)` rend l'entrée, ou `null` (GFS d'avant, rien à secourir, autre version) ; **`loadScript(lib, { secours, delai })`** (`js/script-loader.js`, README « Le secours d'un CDN ») charge par le CDN, puis par la copie sur `error` ou après 3 secondes (`forme: 'module'` se charge en module ; `integrity` vaut `integrite`). Sans `secours`, ni minuterie ni changement.
- **Mesuré sous Firefox 160** (cadre isolé comme le tien, faits vérifiés 170) : le CDN qui charge ne fait jamais demander la copie ; des octets changés chez le CDN sont refusés et **leur code ne s'exécute jamais**, la copie charge ; un hôte mort, une adresse que ta politique ne nomme pas et un hôte muet (après 3 s) donnent la copie ; la copie passe sous `script-src 'self'`, **ta politique ne nomme rien de plus**.

**3. Ce que tu fais** :
- **a. Avance la référence du kit à `4774a99` (0.31.0) ou après** (commit à part, relu). La 0.31.0 contient la 0.30.0 de la 107.
- **b. Tes natives** (`js/native-libs.js`, `NativeLibs.load`, et `ExportCommon.loadScriptOnce` de `js/export-common.js`) : aujourd'hui, `GfsLink.native(id)` donne la copie quand la personne l'a choisie (et le CDN prend le relais si la copie échoue : **ne touche pas à ce sens-là**), sinon tu charges par ton CDN. Ajoute l'autre sens : dans la branche CDN, un secours `GfsLink.secours(id, versionOf(id))` (la version de ta liste décide : une copie d'une autre version n'est jamais prise, `secours` rend alors `null`), que le chargeur essaie quand le CDN échoue ou ne répond pas en 3 s. Le plus court est que `loadScriptOnce` prenne un secours facultatif et le passe au `loadScript` du kit : **reprends l'aide du kit, ne la recopie pas**.
- **c. Tes bibliothèques d'extension** (`js/extensions.js`) : même chose pour Plotly, ECharts et `edition-live` : `GfsLink.library(id)` d'abord, `GfsLink.secours(id)` (sans version : GFS ne donne que celle de l'entrée) en secours ; pour `pdfjs` (sans CDN), `null` est le cas normal et ton code le supporte.
- **d. Tes contrôles de refus** (`scriptRefusal`) laissent déjà passer l'adresse de la copie de GFS (c'est elle que tu charges quand la personne choisit la copie figée) : le secours passe par la même voie, avec l'empreinte que GFS donne ; garde ce contrôle, ne l'élargis pas.
- **e. Tes essais** : un essai où le CDN d'une bibliothèque échoue (réponse en erreur, puis octets changés) et où l'export (PDF, Word, Excel, ZIP, QR, Markdown) et le graphique marchent depuis la copie ; un essai où le CDN répond et où la copie n'est pas demandée ; un essai de l'app **seule** (sans GFS) qui n'a pas de secours et marche comme avant.
- **f. `GFS-ETAT.md`** : « Changements qui touchent GFS » (le commit, le kit 0.31.0, `secours` lu) et « Adresses que l'app appelle » (rien de nouveau : la copie est du site de GFS).

**4. Ce que tu ne fais pas** : ne nomme aucune adresse de GFS dans ta politique ; ne mets pas de deuxième CDN ; ne change pas l'éditeur (107). Le service de la copie de l'éditeur par jsDelivr viendra dans une autre consigne, après le dépôt dédié.

## Pourquoi

Le porteur veut un CDN vérifié de bout en bout et un secours qui ne dépende pas d'un second service. Sans le secours, une personne sur un réseau qui coupe jsDelivr n'a plus d'export ni de graphique ; avec lui, l'app charge la copie de GFS, aux mêmes octets, sans qu'elle ait besoin d'une adresse de plus dans sa politique. Le coût pour toi est de quelques lignes : le kit fait la minuterie et l'ordre.

## Fait quand

`GFS-ETAT.md` donne « 108 · faite · lue » avec le commit ; tes essais passent (CDN en échec, CDN qui répond, app seule) ; dans GFS, avec un CDN que tu fais échouer, un export PDF et le graphique marchent depuis la copie de GFS, sans erreur de politique dans la console. GFS refera sa mesure avec ta version dans un vrai Grist.
