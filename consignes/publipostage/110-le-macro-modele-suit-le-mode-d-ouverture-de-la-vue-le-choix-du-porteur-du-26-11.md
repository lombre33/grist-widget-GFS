# 110 · Le macro-modèle suit le mode d'ouverture de la vue : le choix du porteur (26/11) et ce que GFS a mesuré

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 26/11/2026 · remplace rien · suite du point 1 de la 099 (`pp_view_open_mode`) · décision du porteur du 26/11 · faits vérifiés 186 · `js/main.js` (`startMode`), `js/view-template.js`, `index.html` et `js/i18n-texts-settings.js` (texte du réglage)
quand : au prochain lot, sans urgence ; du code dans ton app ; rien à faire chez GFS

## Quoi

**1. Le choix du porteur (26/11).** Sur une page dont le modèle est un macro-modèle, la vue était réglée « Lecture » (Réglages > Vue > « Mode d'ouverture de cette vue ») et elle s'ouvrait en Édition : le texte du réglage dit pourquoi (« …un macro-modèle s'ouvrent toujours en Édition »), mais ce n'est pas ce que le porteur attend. Une carte lui a demandé s'il fallait faire suivre le mode de la vue aussi par les macro-modèles ; il a répondu **« Lecture aussi pour les macro-modèles »**.

**2. Ce que GFS a mesuré** (faits vérifiés 186, vrai Grist, ta page à `55d96c7c`) : GFS n'est pas en cause. Le choix « Lecture » s'écrit dans la vue sans refus ni « Enregistrer », il tient au redémarrage de GFS, et un document ordinaire, un e-mail et le modèle de la vue arrivent en Lecture. Le macro-modèle, lui, s'ouvre en Édition parce que `startMode` le met de côté (`currentTypeModele === 'macro'`) ; et sa Lecture n'a rien à montrer : avec un macro-modèle dont la composition est vide, elle montre une page blanche, parce que le résumé de la composition (`showMacroSummary`, `syncEditorVisibilityForMode`) n'existe qu'en Édition. Avec une composition qui n'est pas vide, GFS ne l'a pas mesuré.

**3. Ce qui est demandé.**
- Quand la vue dit « Lecture », un macro-modèle qui s'ouvre de lui-même (le modèle de la vue, celui que GFS désigne par un double-clic ou à l'arrivée, celui que le rechargement d'un changement de langue rouvre) s'ouvre **en Lecture**, comme un document. Quand la vue dit « Édition » ou n'a pas de choix, rien ne change : « Édition » pour la vue, la dernière préférence de la personne sans choix.
- **Ce que montre la Lecture d'un macro-modèle, c'est à toi de le décider** : une page blanche ne rend pas le choix du porteur utile, et GFS ne dicte pas ton écran. Si tu y vois un choix de produit que tu ne peux pas faire seul, dis-le dans « Questions pour GFS » : GFS le pose au porteur sur une carte.
- Ce qui ne change pas : un modèle vierge, un fichier importé, l'absence de modèle et « Nouveau > Macro-modèle » de GFS ouvrent toujours l'Édition (l'écran de composition vide) ; la personne garde le bouton Édition ou Lecture, sauf en lecture seule.
- Le texte du réglage (le petit texte sous la liste, en français et en anglais) ne dit plus qu'un macro-modèle s'ouvre toujours en Édition ; ton essai `dev-tests/verify-view-open-mode.mjs` (cas 4, « un macro-modèle choisi pour la vue s'ouvre en Édition, même si la vue dit Lecture ») suit.

**4. Pas demandé.** Quand ton app est déjà ouverte et que la personne ouvre un autre fichier par l'explorateur de GFS, ton app garde le mode du moment : le réglage de la vue vaut au départ de l'app (`startMode` n'est lu qu'au démarrage). GFS l'a mesuré (faits vérifiés 186) et ne demande pas d'y toucher.

## Pourquoi

Le porteur règle la vue en « Lecture » pour une page qui sert à consulter, et la page s'ouvrait en Édition parce que son modèle est un macro-modèle. Le réglage est juste, l'exception de ton app n'est pas celle qu'il veut ; il l'a dit.

## Fait quand

1. Une vue réglée « Lecture » ouvre son macro-modèle en Lecture (au départ de l'app, seule comme dans GFS, par l'arrivée sur la vue et par un double-clic dans l'explorateur), et cette Lecture montre ce que tu as décidé ; une vue réglée « Édition », ou sans choix, ouvre comme avant.
2. Le texte du réglage ne dit plus qu'un macro-modèle s'ouvre toujours en Édition, en français et en anglais.
3. Ta page dit « 110 · faite » avec les commits (ou « 110 · lue, une question » avec la question dans « Questions pour GFS »). GFS rejoue ensuite `labo/run-mode-ouverture-vue.mjs` avec ta copie : son constat 3 passe à « OK ».
