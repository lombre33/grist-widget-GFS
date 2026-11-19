# 088 · Réglages > Vue : les deux boutons grisés disent pourquoi au survol et à l'écran (remplace la 087)

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · remplace la 087 · demande du porteur du 19/11 (« indiquer pourquoi à chaque fois qu'une option est grisée ») · faits vérifiés 142
quand : à lire au prochain lot, sans urgence ; une phrase par état, `aria-disabled` à la place de `disabled`, un peu de CSS et un essai dans `js/view-template.js` et `css/row-template.css` ; vaut dans GFS et seule

## Quoi

Dans **Réglages > Vue > « Modèle par défaut de cette vue »**, « Utiliser le modèle ouvert pour cette vue » et « Retirer » grisés **disent pourquoi**, trois fois : au survol (`title`), dans une phrase visible sous la phrase d'état quand la raison est que le modèle n'est pas enregistré, et au lecteur d'écran (`aria-describedby` vers cette phrase).

**1. Un bouton grisé par `aria-disabled="true"`, jamais par `disabled`.** C'est ta règle (`js/floating-toolbars.js`, `setDisabled` : « un `<button disabled>` ne reçoit plus le survol, son info-bulle ne s'afficherait pas ») ; un bouton `disabled` n'a pas non plus le focus au clavier, donc sa raison n'est pas lisible sans souris. Le clic sur un bouton grisé ne fait rien (tu as déjà `if (!open || isReadOnly()) return;`). Le grisé visuel passe de `:disabled` à `[aria-disabled="true"]` dans `css/row-template.css` (lignes 18 et 19), mêmes valeurs.

**2. Une raison par état, dans les deux langues** (`title` du bouton, qui dit la même chose que la phrase) :
- **le modèle ouvert n'est pas enregistré** (`openTemplate()` rend `null` : un modèle neuf, un import, un modèle de départ de la galerie) : « Ce modèle n'est pas encore enregistré : donnez-lui un nom et cliquez sur Enregistrer, il pourra alors devenir celui de cette vue. » Cette phrase est aussi **visible** sous la phrase d'état, parce que c'est le cas où la personne ne sait pas quoi faire ;
- **déjà celui de la vue** : « Ce modèle est déjà celui de cette vue. » ;
- **lecture seule** : la phrase du verrou que tu as déjà (« Vous êtes en lecture seule : ce réglage est verrouillé. »), en info-bulle des deux boutons ;
- **« Retirer » sans choix** : « Aucun modèle n'est choisi pour cette vue : il n'y a rien à retirer. »
Un bouton actif n'a pas de `title`. Le texte du bouton ne change pas.

**Un essai à toi qui échoue sur le code actuel** : modèle vierge ouvert (la phrase visible, `title` et `aria-describedby`, `aria-disabled="true"` et pas `disabled`, le bouton atteint par Tab) ; après « Enregistrer » sous un nom (la phrase disparaît, le bouton porte le nom, sans `title`) ; modèle déjà celui de la vue ; lecture seule ; « Retirer » avant et après un choix.

## Pourquoi

Le porteur, sur le Grist de la DINUM, ne pouvait pas choisir un modèle pour une vue : les deux boutons grisés, « Aucun modèle choisi pour cette vue. », rien d'autre. GFS l'a mesuré dans un vrai Grist (faits vérifiés 142) : avec un modèle enregistré ouvert tout marche (noms d'avant ou anglais) ; avec un modèle non enregistré l'écran est exactement celui de sa capture, muet sur la raison, alors que le coin d'état de l'app la dit ailleurs. Le geste est juste, c'est l'écran qui ne l'explique pas. Sous GFS on y tombe plus souvent : « Nouveau », « Importer » et « Depuis un modèle » ouvrent tous un modèle non enregistré. Le porteur demande que **chaque option grisée dise pourquoi, au survol**, pas seulement en phrase : c'est le cas d'usage de ta règle `aria-disabled` + `title`, que ces deux boutons n'appliquent pas encore. Le choix, lui, est écrit dans la vue par GFS sans « Enregistrer » de Grist (contrats 7.3) : rien à changer de ce côté.

Ce que cette consigne ne demande pas : un bouton « Enregistrer et utiliser pour cette vue », ni un changement du nom du bouton.

## Fait quand

Les deux boutons sont grisés par `aria-disabled`, disent leur raison au survol, la phrase visible paraît pour un modèle non enregistré (deux langues, avec son essai) ; ni la phrase ni le `title` ne paraissent pour un modèle enregistré qui peut devenir celui de la vue ; et ta page `GFS-ETAT.md` le dit (une ligne dans « Changements qui touchent GFS » avec la date et le commit, et ta ligne « Consignes » : « 088 · faite » avec le commit, la 087 étant remplacée). GFS lit le dépôt de ton app (`js/view-template.js`, `css/row-template.css`, le texte de `settings.viewTemplate.*`), puis passe cette consigne à « faite ».
