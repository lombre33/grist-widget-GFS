# 011 · Le calendrier est dans le kit (0.8.0) : monte-le à la place de la grille provisoire

App : Tuesday · posée le 04/11/2026 · suite de la 006 (voie A) ; décision du porteur du 04/11 (« Oui, maintenant ») ·
quand : au prochain lot qui touche la vue Calendrier ; du code dans ton app (`kit/` à `336baf4`, ton hôte, ta page)

## Quoi

**1. Le module est dans le kit.** Le calendrier de Calendar+ (version 2 avec les heures, `531e0cd`) est rangé dans le kit à `336baf4` (0.8.0 ; le porteur pose l'étiquette) :
`js/calendrier/index.js` et sa feuille `css/calendrier.css`. L'interface (`creerCalendrier(rappels)` rend `{ element, definir({ lignes, options }), aller, aujourdhui, detruire }`),
les lignes, les options et les rappels sont dans le README du kit, section « Le calendrier » : lis-la, elle n'est pas recopiée ici.

**2. Ce que tu changes.**

1. Avance `kit/` à `336baf4` (commit à part, relu). Lis le `CHANGELOG.md` du kit, 0.7.0 puis 0.8.0 : la 0.7.0 ajoute `GfsLink.deposit` (ranger un export) et garde les fichiers que GFS passe à l'ouverture ; rien n'en change pour toi tant que tu ne les appelles pas.
2. Lie `kit/css/calendrier.css` dans ta page, **après** `tokens.css`, avec son `?v=` qui monte à chaque version du kit. Le module est servi par ta propre origine, comme le reste du kit : rien à ajouter à ta politique
   de sécurité du contenu (il pose les couleurs de Grist par le CSSOM, jamais par un attribut `style`). Si tu avais ouvert `frame-src` à l'adresse de Calendar+ pour le sous-cadre d'essai (006, point 5),
   retire cette adresse : le module n'en a plus besoin.
3. Dans `js/ui/calendrier-hote.js`, `CHEMIN_MODULE` vise déjà `../../kit/js/calendrier/index.js` : dès que `kit/` contient le module, ton hôte le trouve, et **la grille provisoire part**. L'hôte garde ce qui est à toi : la correspondance entre tes
   tâches et les `lignes` (dates civiles en texte, sans fuseau ; la couleur que Grist donne ; `modifiable`), l'écriture dans Grist, Annuler / Rétablir. Le module ne parle jamais à Grist.
4. Le glisser d'une tâche sur un autre jour ou une autre heure, le plateau « Sans date » et la saisie rapide sont dans le module : tu n'en écris plus le code. Tes cartes de kanban restent à toi.

**3. Ce que GFS a mesuré** (`labo/run-calendrier-kit.mjs`, dépôt de GFS), avec une app d'essai écrite avec le kit : dans un vrai Grist (grist-static), le panneau à 700 × 400, la souris réelle, sous la politique d'une app
hébergée, dans le sous-cadre isolé (sans `allow-same-origin`), en français et en anglais, en clair et en sombre : 41 vérifications par passe, aucune en échec.

- Le glisser-déposer HTML5 marche à la vraie souris dans ce sous-cadre : d'un jour à l'autre, une barre de plusieurs jours (l'écart est gardé), une puce du plateau « Sans date » sur un jour, un bloc horaire d'une colonne à l'autre
  (au quart d'heure) ; un déplacement que l'hôte refuse ou rejette ramène l'événement au jour exact où il était.
- Les couleurs de Grist se posent sous `style-src 'self'`. Le calendrier suit les quatre ambiances de GFS et une couleur libre, en clair et en sombre : chaque texte garde 4,5:1 au moins.
- La barre de GFS (34 × 124 px au bord choisi) prend une zone que l'app laisse libre (la page d'essai la réserve) : le calendrier a 658 px de large à 700. À 658 px, **sa barre d'outils tient sur une ligne en Mois et en Semaine (45 px) et passe sur deux en vue Jour
  (81 px : « Sans date » descend)**, et la sixième semaine du mois est coupée par le bas du panneau (elle se rejoint à la molette). Ce sont des constats, GFS ne change rien au module sans ta demande (point 4).
- Sous Firefox 159 sans écran : la mise en page, le clic, la saisie rapide, le départ du glisser et l'accueil de la cible passent. **Le dépôt lui-même n'est pas mesuré** (aucun banc sans écran n'achève un glissement) : le porteur l'essaiera
  dans son Firefox.

**4. Changer le module ensuite.** Seul GFS pousse dans le kit (006, point 6, inchangé). Ce que tu veux du calendrier, dis-le dans « Demandes à GFS » de ton `GFS-ETAT.md` ; le fil Calendar+, qui connaît le module, fait de même
(consigne 012).

## Pourquoi

Tu voulais le calendrier dans l'écran de Tuesday, et un calendrier qui marche seul : la voie A laisse l'un et l'autre (006). Le code n'est qu'à un endroit, le kit, que les deux apps référencent.

## Fait quand

`GFS-ETAT.md` de Tuesday donne « 011 · lue » maintenant, puis « 011 · faite · `commit` » quand `kit/` est à `336baf4` ou plus récent, que ton hôte monte le module dans la vue Calendrier, que la grille provisoire est retirée
et que tes essais le montrent (le calendrier se monte, un clic ouvre la tâche, un déplacement refusé revient). GFS le rejouera avec la vraie Tuesday à son entrée au catalogue.
