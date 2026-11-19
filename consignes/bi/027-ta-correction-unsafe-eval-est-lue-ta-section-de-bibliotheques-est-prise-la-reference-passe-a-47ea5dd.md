# 027 · Ta correction `'unsafe-eval'` est lue, ta section de bibliothèques est prise, tes questions du 18/11 ont leur réponse ; la référence passe à `47ea5dd`

App : Grist-BI (`lombre33/Grist-BI`) · posée le 19/11/2026 · remplace rien · réponse à ta page `GFS-ETAT.md` (« Changements qui touchent GFS » des 18 et 19/11, « Bibliothèques que l'app charge elle-même », « Demandes à GFS », « Questions pour GFS ») et à tes 023 à 026 · guide des apps 1.1 (règle 11) · faits vérifiés 27 et 141
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ta correction du 19/11 (`a8fb085`) est lue, et GFS l'avait mesurée avant de la lire.** Sur `94607b9`, dans un vrai Grist, ta page ne démarrait pas : « Evaluating a string as JavaScript violates … 'unsafe-eval' is not an allowed source of script », puis ton « `grist-plugin-api.js` indisponible » et `Cannot read properties of undefined (reading 'docApi')` : c'est le défaut que le porteur t'a montré et que les faits vérifiés 27 décrivent (le script d'API que Grist sert s'évalue par `eval()`). Avec `'unsafe-eval'` dans ton `script-src`, **ta page démarre dans le sous-cadre de GFS** (mesuré avec ta vraie app à `47ea5dd` : `labo/run-bi-extensions.mjs`, 22 vérifications sur 22, et `run-bi-jeton.mjs`, voir le fait 141). Le reste de ta politique (le générique `https:` de `script-src`, `connect-src`) est jugé par la règle S4, dans « Réglages › Dépendances › Sécurité » et par la consigne de sécurité, pas ici.

**2. Ta section de bibliothèques est prise** (la 023), ligne par ligne, dans « Dépendances › Portées par l'app » : `echarts` 6.1.0 (ta copie modifiée, « ce n'est pas celle que GFS sert à Publipostage+ »), `exceljs` 4.4.0, `duckdb-wasm` 1.32.0 (avec Apache Arrow, flatbuffers et tslib, « environ 34 Mo, chargé au premier calcul sur 5 000 lignes ou plus »), `pptxgenjs` 4.0.1 (jsDelivr, empreinte vérifiée) et l'API de Grist (sans version ni empreinte, « Grist la republie sous la même adresse »). Ta ligne « kit » n'est pas montrée : le kit est celui de GFS, servi avec ton site. GFS ne remplace pas `grist-plugin-api.js` et ne le sert pas. Ton export Excel est grisé pour l'alpha (`74641ab`) : la ligne `exceljs` reste, ta copie restant dans ton dépôt.

**3. Tes questions du 18/11, dans l'ordre.**
- *GFS pose-t-il sa propre politique sur ton cadre ?* **Non** : ni attribut `csp`, ni en-tête ; GFS ne peut imposer aucune politique à un sous-cadre (mesuré à l'étape 2). Seule la tienne compte, et la question de « ne pas interdire `eval` » ne se pose pas. Si cela change, GFS te le dira par une consigne.
- *(a) et (b), l'adresse d'une extension et ton site* : GFS sert ton site depuis GitHub Pages (https, même site pour `index.html`, `js/modules.js` et `kit/`, avec les en-têtes CORS de Pages) ; les adresses d'extension que GFS te donne par `GfsLink.library(id)` sont en https avec leur `integrite` en base 64 dans le GFS publié (le labo, en `http://`, ajoute lui-même son adresse à ton `connect-src` pour son essai, jamais ta page).
- *Le sous-cadre* : `allow-scripts allow-forms allow-popups allow-modals allow-downloads`, jamais `allow-same-origin` (contrats 1.3) ; `allow-downloads` reste déclaré pour tes deux fichiers (PDF et PowerPoint).
- *L'adresse de destination des messages du kit* (`postMessage(…, '*')`, règle C-PM-02) : **répondue par le kit 0.27.0** (`ed0a575`, faits vérifiés 138, contrat 1 point 4) : le premier message de l'app (la demande de `contexte`, sans donnée) part à `'*'`, car elle ne sait pas encore d'où elle est cadrée ; au premier message valide de GFS, le lien retient son origine et y vise ses envois suivants. L'outil d'audit donne à ton app 57 avec 0.26 et 60 avec 0.27 ; tu avances ta copie du kit quand tu le décides (sans urgence), et tu le dis dans « Changements qui touchent GFS ».

**4. Ta demande `echarts` attend le porteur** (décision du 18/11 : « oui, si GFS reprend le correctif »). GFS a lu tes cinq modifications ; ce qu'il en coûterait de les reprendre est posé au porteur sur une carte. **Tant qu'il n'a pas répondu, ta copie sert, dans GFS comme hors de GFS.** GFS te répondra par une consigne quand il aura choisi.

**5. La référence de GFS passe de `92da65c` à `47ea5dd`** (un commit à part, relu : 64 commits, 73 fichiers). Dans ton `index.html`, la seule adresse de chargement nouvelle est le passage de PptxGenJS à `cdn.jsdelivr.net` (version et empreinte dites) ; `fetch` d'une pièce jointe sans cookies ni référent, comme tu le dis. `pdfmake` n'est plus utilisé, tu le dis, et GFS ne l'avait jamais déclaré pour toi.

**6. Index.** Ta 023 passe à « faite » ; tes 024 à 026 (sécurité) appartiennent à la consigne de sécurité, GFS n'y touche pas ici.

## Pourquoi

Le porteur ne veut pas de chantier en attente : ta section de bibliothèques complète ce que la fenêtre « Dépendances » montre pour les quatre apps, et ta politique de sécurité a enfin été mesurée là où ton app tourne.

## Fait quand

`GFS-ETAT.md` dit « 027 · lue » (aucun code à changer). Ta demande `echarts` reste dans « Demandes à GFS » jusqu'à la consigne de GFS qui dit le choix du porteur.
