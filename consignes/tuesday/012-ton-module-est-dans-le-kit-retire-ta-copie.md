# 012 · Calendrier+ : ton module est dans le kit (0.8.0), retire ta copie et monte celui du kit

App : Calendrier+ (le fil Calendar+ du projet de Tuesday) · posée le 04/11/2026 · réponse à ta demande « Module prêt (version 2, avec les heures) » de `GFS-ETAT.md` (`531e0cd`) ; décision du porteur du 04/11 (« Oui, maintenant ») ·
quand : au prochain lot ; du code dans ton app (`kit/` à `336baf4`, ton dossier `calendrier/`, ta page)

## Quoi

**1. Fait : ton module est dans le kit**, à `336baf4` (0.8.0 ; le porteur pose l'étiquette) : `js/calendrier/index.js` et `css/calendrier.css`, rangés tels que tu les as écrits (`531e0cd`, la porte d'entrée de ta 006 :
`creerCalendrier(rappels)` rend `{ element, definir({ lignes, options }), aller, aujourdhui, detruire }`). Le README du kit a une section « Le calendrier » ; le `CHANGELOG.md`, la 0.8.0, dit tout ce que GFS a touché. En deux mots :
les deux chemins de `lien-kit.js`, et quatre choses que les essais ont montrées en le rangeant : (1) Échap dans la saisie rapide ou dans la liste d'un jour levait « The node to be removed is no longer a child of this node » dans Chrome ;
(2) le titre de la liste d'un jour s'écrivait « Vendredi 13 Novembre 2026 » en français ; (3) `creerCalendrier` faisait 153 lignes, au-dessus du seuil de 80 de l'outil d'audit : coupée en quatre, sans rien changer pour l'hôte ;
(4) la grille horaire ne disait pas l'effet du dépôt (`dropEffect = 'move'`), que le mois disait : sous le banc Firefox de GFS il restait « none » au-dessus des heures. Chaque correction a son essai, qui échoue sur l'ancien code.
Tes essais sur les dates, les événements, le placement, les heures, le déplacement et la navigation (72) et tes 31 essais sous Chromium sont dans le kit (`test/calendrier-*.test.mjs`, `navigateur/`).

**2. Ce que tu fais** (006, point 3, étape 4).

1. Avance `kit/` à `336baf4` (commit à part, relu).
2. Retire ton dossier `calendrier/` (`index.js`, `noyau/`, `vue/`, `lien-kit.js`, la feuille) : **le code n'est plus qu'à un endroit**. Ta page importe `kit/js/calendrier/index.js` et lie `kit/css/calendrier.css` après `tokens.css`, avec son `?v=`
   qui monte à chaque version du kit.
3. Garde ton hôte : la lecture des données de Grist, la correspondance avec les `lignes`, les rappels, tes clés `cal_*`. Garde aussi ceux de tes essais qui testent ton hôte ; ceux qui testent le module sont dans le kit.
4. Ta demande « Module prêt » est traitée : retire-la de ta page quand tu as lu cette consigne. Le sous-cadre d'essai de ton lot 4 reste entre Tuesday et toi (006, point 5) ; Tuesday monte le module depuis le kit (011).

**3. Changer le module ensuite.** Seul GFS pousse dans le kit (006, point 6, inchangé ; le porteur peut en décider autrement). Pour changer le calendrier : une demande dans « Demandes à GFS » de ton `GFS-ETAT.md`, avec le commit,
ce qui change et pourquoi, comme pour une bibliothèque ; GFS le reporte dans le kit, passe les essais et l'outil d'audit, publie une version et répond par une consigne.

**4. Ce que GFS a mesuré** (`labo/run-calendrier-kit.mjs`, dépôt de GFS ; la page d'essai est `labo/sondes/z-calendrier/`, un exemple d'hôte avec `GfsLink`, `Ambiance` et la réservation du bord de la barre), dans un vrai Grist (grist-static),
le panneau à 700 × 400, la souris réelle, sous la politique d'une app hébergée, dans le sous-cadre isolé, en français et en anglais, en clair et en sombre : 41 vérifications par passe, aucune en échec.

- Le glisser-déposer HTML5 marche à la vraie souris dans le sous-cadre isolé : un événement d'un jour à l'autre, une barre de plusieurs jours (l'écart est gardé), une puce du plateau « Sans date », un bloc horaire d'une colonne à
  l'autre au quart d'heure ; refusé (`false`) ou rejeté (une erreur), l'événement revient au jour exact où il était. En lecture seule, rien ne glisse.
- Les couleurs de Grist se posent sous `style-src 'self'`. Le calendrier suit les quatre ambiances de GFS et une couleur libre : chaque texte garde 4,5:1 au moins (77 textes mesurés dans le mois, 24 dans la semaine, 13 dans le jour).
- **Deux constats, sans changement de GFS** : à 658 px de large (700 moins la barre de GFS), la barre d'outils tient sur une ligne en Mois et en Semaine (45 px) et passe sur deux en vue Jour (81 px : « Sans date » descend) ; et la sixième
  semaine du mois est coupée par le bas du panneau à 700 × 400 (elle se rejoint à la molette). Si tu veux les changer, c'est une demande du point 3.
- Sous Firefox 159 sans écran : la mise en page, le clic, la saisie rapide, le départ du glisser et l'accueil de la cible passent. **Le dépôt lui-même n'est pas mesuré** (aucun banc sans écran n'achève un glissement HTML5, même sur une page
  de deux éléments) : ton essai sous Firefox (007, « dès le lot 6 ») reste au porteur.

## Pourquoi

La voie A (006) : Calendar+ marche seul et Tuesday le montre dans son écran, avec le même code. Tant que ta copie reste dans ton dépôt, il y a deux calendriers à tenir ; le kit n'en garde qu'un, et chaque évolution est une version.

## Fait quand

`GFS-ETAT.md` donne « 012 · lue » maintenant, puis « 012 · faite · `commit` » quand `kit/` est à `336baf4` ou plus récent, que `calendrier/` n'est plus dans ton dépôt, que ta page monte le module du kit et que tes essais le montrent.
