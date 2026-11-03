# 006 · Le calendrier est un module du kit (voie A) : où il sera, comment il y entre, qui fait quoi

App : Tuesday, et son fil Calendar+ (`lombre33/grist-widget-calendar-plus`, le même projet) · posée le 03/11/2026 · réponse à ta demande 2 du 02/11 (le calendrier) ·
quand : à lire maintenant ; rien à changer dans Tuesday d'ici là

## Quoi

**1. La décision** (carte « Kit commun », le porteur, 03/11). Le calendrier est un module du kit : la voie A de ton `integration-suite.md`, 1. Calendar+ et Tuesday le
montent chacun chez eux ; Calendar+ marche seul, et la vue Calendrier reste dans l'écran de Tuesday. La voie B (Calendar+ ouvert par GFS à la place de Tuesday) est
écartée. Aucune app n'importe le code d'une autre : le module est dans le kit, que les deux référencent.

**2. Où il sera.** Dans le kit, `js/calendrier/index.js` : le chemin que ton hôte vise déjà (`js/ui/calendrier-hote.js`, `CHEMIN_MODULE`, `b3eb966`), avec sa feuille
`css/calendrier.css`, que ta page lie comme elle lie `tokens.css` et `windows.css` (son `?v=` monte avec la version du kit). Le module n'importe que le kit, ne parle
jamais à Grist (son plan, section 2) et n'écrit ni couleur ni `z-index` en dur ; ses essais viennent avec lui dans `test/` du kit.

**3. Comment il y entre** (comme la charte, extraite de Publipostage+ pour devenir le kit).

1. **Le fil Calendar+** écrit le module dans `calendrier/` de son dépôt, avec ses essais (`docs/plan.md`, section 2). Rien n'entre dans le kit avant qu'il existe.
2. Quand une première version tient, **Calendar+** le dit dans la section « Demandes à GFS » de son `GFS-ETAT.md` : le commit, le dossier, la feuille de style, les essais.
   GFS n'attend pas la fin du plan ; vous dites quelle première version peut remplacer la grille provisoire de Tuesday sans lui faire rien perdre (le glisser-déposer
   de ses tâches, par exemple).
3. **GFS** lit ce commit, déplace le dossier dans le kit (il réécrit les chemins des imports du kit), passe les essais du kit et l'outil d'audit (600 lignes de code par
   fichier, moins de 81 par fonction, complexité 15 au plus), pousse une version du kit sans étiquette (le porteur la pose) et répond par une consigne à chacun.
4. **Calendar+** avance `kit/` à ce commit (commit à part, relu), puis retire son dossier `calendrier/` et importe celui du kit : le code n'est plus qu'à un endroit.
   **Tuesday** avance `kit/` (commit à part, relu) : son hôte trouve le module et la grille provisoire part.

**4. Une seule porte d'entrée.** Les deux dépôts décrivent aujourd'hui deux formes. L'hôte de Tuesday (`b3eb966`) appelle `creerCalendrier(rappels)` et attend
`{ element, definir({ lignes, options }) }` ; le plan de Calendar+ (`b96b04d`, section 2) écrit `creerCalendrier(element, options)` et rend `{ definir, aujourdhui, aller,
detruire }`. Les lignes, les dates et les rappels sont d'accord (plan, section 3 ; `integration-suite.md`, 1). Accordez-vous **avant le premier déplacement**, puisque
le kit versionne le module : la forme retenue s'écrit en tête de `index.js`, et GFS la reprend dans le README du kit.

**5. Le sous-cadre d'essai** (lot 4 du plan de Calendar+, demande du porteur du 03/11 : la page de Calendar+ montrée dans un sous-cadre de Tuesday, par messages). C'est
entre vous deux : GFS ne le décide pas et ne le mesure pas. La politique de sécurité de Tuesday dit aujourd'hui `frame-src 'none'` ; l'ouvrir à l'adresse de Calendar+
est une adresse de plus, mise consciemment, que tu retires quand le module du kit prend la place.

**6. Ce qui reste ouvert.** Qui écrit dans le kit après le premier déplacement, GFS sur demande ou le fil Calendar+ : le porteur le tranchera à ce moment-là, et rien
n'en dépend d'ici là. Aujourd'hui, seul GFS pousse dans le kit.

## Pourquoi

Tu voulais le calendrier dans l'écran de Tuesday, et un calendrier qui marche seul : seule la voie A laisse l'un et l'autre (carte du 02/11, réponse du 03/11). Elle
respecte les couches (le kit n'importe rien, une app importe le kit, jamais une autre app). Le prix est celui que ton tableau annonçait : le kit grossit, et chaque
évolution du calendrier est une version du kit. L'hôte que tu as déjà écrit n'a rien à changer, parce qu'il retombe sur la grille provisoire tant que le module manque.

## Fait quand

`GFS-ETAT.md` de Tuesday donne « 006 · lue » maintenant, puis « 006 · faite · `commit` » quand `kit/` contient `js/calendrier/`, que ton hôte monte le module dans la
vue Calendrier et que la grille provisoire est retirée ; tes essais le montrent. Pour le fil Calendar+, la section « Demandes à GFS » dit « module prêt » avec le
commit (point 3, étape 2) ; GFS répond alors par la consigne qui suit.
