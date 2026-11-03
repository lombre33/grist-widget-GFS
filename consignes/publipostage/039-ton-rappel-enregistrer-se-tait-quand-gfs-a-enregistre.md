# 039 · Ton rappel « Enregistrer » se tait quand GFS a enregistré le réglage (décision du porteur)

App : Publipostage+ · posée le 03/11/2026 · décision du porteur du 03/11 · quand : au prochain lot, sans urgence ; du code dans ton app
(`js/gfs-link.js`, `js/save-reminder.js`, trois textes) ; sans effet dans l'app seule

## Quoi

**1. La décision.** Le porteur (03/11) : plus d'« Enregistrer » de Grist pour les réglages de la vue dans GFS ; GFS les écrit dans la vue
(contrats 7.3, points 4 à 6 ; guide des apps 1.2, règle 16). Construit et mesuré le 03/11 avec ton app : « Utiliser le modèle ouvert pour
cette vue » et « Retirer » n'affichent aucune barre, et tu relis ton réglage par l'écho de Grist (`onOptions`), comme avant. Tu n'as rien
à changer à tes écritures : elles passent toujours par `setOption`, avec les clés de ton manifeste.

**2. Ce qui est devenu faux.** Ton rappel (« Pour partager vos changements, cliquez sur « Enregistrer » en haut du widget, dans Grist. »,
`SaveReminder`, clé `settings.saveReminder`) reste affiché dans GFS, ainsi que deux phrases qui demandent d'enregistrer la vue :
`settings.view.intro` et `settings.access.saveHint` (le rappel et ces phrases sont aussi dans l'`index.html`). La personne cherche un bouton
qui n'existe pas.

**3. Ce que GFS te demande.**

- **Écoute l'événement `reglages`** dans `js/gfs-link.js`, à côté de `langue` : `{ gfs: 0, type: 'evenement', nom: 'reglages', data: { enregistres } }`,
  de la fenêtre parente (contrats 5.1 et 5.2, point 2). GFS l'envoie après chaque écriture de tes réglages (`setOption`, `setOptions`,
  `clearOptions`) : `enregistres: true`, le réglage est dans la vue ; `enregistres: false`, il est resté un brouillon.
- **`enregistres: true`** : la ligne du rappel reste vide (`SaveReminder.render`), et `settings.view.intro` et `settings.access.saveHint`
  perdent leur demande d'enregistrer la vue (le réglage est déjà pour tout le monde) ; le reste de `saveHint` (« Une personne absente de
  la table garde tous les droits… ») ne change pas.
- **`enregistres: false`** (GFS s'est replié sur le brouillon de Grist : un brouillon était déjà posé dans la vue, ou la structure du
  document est réservée) : garde ton rappel, qui n'est vrai que là. **Avant le premier événement, et seule, tu le gardes aussi.**
- Tu n'écris toujours aucun réglage sans geste de la personne.

L'événement n'est dans aucune version du kit pour l'instant : écris-le chez toi, comme `langue`. GFS le proposera au kit quand une deuxième
app en aura besoin (Form+ et Automation+ écrivent aussi des réglages de vue).

## Pourquoi

Sans cela, la personne lit « cliquez sur Enregistrer » alors que rien ne s'affiche en haut du widget. Tout ce qui est écrit dans la vue
est déjà enregistré pour tout le monde ; le rappel n'est vrai que pour le repli sur le brouillon et pour l'app seule.

## Fait quand

`GFS-ETAT.md` donne « 039 · faite · `<commit>` » ; le test échoue sur l'ancien code : l'événement `reglages` à `true` laisse la ligne vide et
retire la demande des deux phrases, à `false` la ligne se montre comme avant, sans événement elle se montre. GFS rejoue
`labo/run-reglages-directs.mjs` : la ligne du rappel, relevée aujourd'hui comme un constat, devient une vérification.
