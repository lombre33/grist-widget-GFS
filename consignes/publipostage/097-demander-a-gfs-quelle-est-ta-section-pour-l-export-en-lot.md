# 097 · Export en lot : demander à GFS quelle est ta section (l'appel `section`) au lieu de la chercher par ton adresse

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · demande du porteur (« Oui, GFS dit à l'app où il est ») · mesure de GFS du 24/11 (faits vérifiés 150)
quand : à ton prochain lot, sans urgence ; un petit code dans l'app (un appel, un choix dans `readLinkedRows`) ; vaut dans GFS seulement (seule, tu gardes ta recherche par adresse) ; GFS a déjà l'appel

## Quoi

**Ce que le porteur a vu** (24/11, un document de la DINUM, sous Firefox) : à l'export en lot, la fenêtre « Quelles lignes exporter ? » dit « Le widget ne sait pas quelle vue de la page lui est liée par « Sélectionner par » : plusieurs widgets de cette table ont la même adresse que lui », avec « Annuler » et « Toute la table » seulement. Il demande que, par défaut, GFS sache où il est et que tu prennes **sa** vue, la personne pouvant toujours choisir « Toute la table ».

**D'où vient le message** (lu à `6fd6eec`) : `ViewSource.linkedRows` (`js/view-source.js`, `readLinkedRows`) garde les sections de la table dont `customView.url` est ton adresse (`isOwnWidget`). Sous GFS c'est l'adresse de GFS (`adresseWidget`, consigne 009), donc toutes les sections de GFS de la table : si elles ne sont pas toutes liées à la même vue, tu rends `unreadable: 'ambiguous'`. GFS relie chaque section à la grille de **sa** page (contrats 4.5, point 8) : deux pages avec chacune leur grille et leur GFS, ce sont deux GFS liés à deux grilles. **Mesuré dans un vrai Grist avec ta vraie app** (`6fd6eec`, `labo/run-pp-vue-ambigue.mjs`) : ce cas rend `ambiguous` ; avec un seul GFS sur la table, tu réponds sans ambiguïté ; `GristAPI.getLinkState()` vaut `linked` dans les deux GFS, il ne les départage pas (il suffit seulement quand le GFS n'est **pas** relié : `unlinked`).

**Ce que GFS fait maintenant** : l'appel `section` (contrats 5.4, point 15 ; guide des apps, 1.2 règle 25). Sans argument, il répond :

- `{ id }` : le numéro de la ligne de `_grist_Views_section` où GFS se trouve, **quand GFS en est sûr** ;
- `{ id: null, raison }` : `acces` (GFS n'a pas l'accès complet), `lecture-seule` (plusieurs GFS pareils sur la table et un document qui ne s'écrit pas), `inconnue` (aucune section reconnue, un brouillon posé dans la vue, une lecture refusée).

Il ne donne que cet identifiant : ni le nom de la table, ni le titre, ni les réglages ; lire `_grist_Views_section` reste soumis à ton manifeste (tu le déclares déjà pour l'export en lot). Un GFS plus ancien répond `GFS_INCONNU`. La première demande peut poser un instant une marque dans chaque section de GFS de la table, puis la retirer (mesuré : 33 ms, aucune barre « Enregistrer », aucun cadre reconstruit) ; les suivantes ne coûtent rien.

**Ce que tu fais**

1. **Un appel de plus dans ton lien avec GFS** (`js/gfs-link.js`, à côté de `call('installer', …)`) : `GfsLink.section()` appelle `section` et rend l'identifiant (entier de 1 ou plus) ou `null`. Une réponse `{ id: null }`, une erreur (`GFS_INCONNU` d'un GFS ancien, un délai de quelques secondes) et l'app seule rendent toutes `null`, sans rien dire à la personne. Demande-le **une fois** par vie de ton cadre et garde la réponse : elle ne dure pas au-delà (une vue défaite ou une page recopiée en change le numéro).
2. **Dans `readLinkedRows(tableId, allRows)`**, quand `Extensions.widgetAddress()` dit que tu es sous GFS : demande d'abord `section()`. Si elle rend un numéro, ta section est **celle-là** (`meta.sections.get(id)`), et plus « toutes les sections de la table à l'adresse de GFS » : lis son lien (`cursorSourceOf`) et la suite comme aujourd'hui. Si son `tableRef` n'est pas celui de ta table (la personne a choisi une autre table de travail que celle de la section de GFS), rends `null` (rien à suivre). Si elle rend `null`, garde ta conduite d'avant : la recherche par adresse, et le message « ne sait pas quelle vue » seulement quand elle ne tranche pas non plus.
3. **La Boucle et les variables** passent par `ViewSource.linkedRows` (`loop-rules.js`, `variable-loop.js`) : rien d'autre à changer.
4. **Un essai à toi** : un document à deux sections de même adresse liées à deux grilles différentes, un faux GFS qui répond `{ id }` (la fenêtre propose « Celles de la vue « … » » de la grille de CE GFS, `focus` sur ce bouton), `{ id: null, raison }`, une erreur et l'app seule (conduite d'avant, texte inchangé).

## Pourquoi

Le porteur travaille dans des documents qui ont plusieurs pages avec GFS sur la même table : la fenêtre ne lui laisse alors que « Toute la table », jamais « Celles de la vue ». GFS sait où il est (il s'en sert déjà pour écrire tes réglages dans la vue et poser son lien « Sélectionner par »), mais ne le disait pas : tu ne peux pas le deviner par l'adresse quand les sections se ressemblent. Ce que cette consigne ne demande pas : retirer ta recherche par adresse (c'est ton repli et ton chemin quand tu es seule), ni changer le texte ou les boutons de la fenêtre.

## Fait quand

1. Dans deux GFS sur deux pages, chacune avec sa grille de la même table, l'export en lot propose les lignes de la vue liée au GFS où la personne se trouve, avec « Toute la table » à côté et sans dire que tu ne sais pas laquelle est la tienne.
2. Quand GFS répond `{ id: null }` ou `GFS_INCONNU`, ou quand l'app est seule, tout est comme avant (même fenêtre, même texte). Un essai à toi couvre les deux cas.
3. Ta page `GFS-ETAT.md` dit « 097 · faite » avec le commit, et, dans « Changements qui touchent GFS », la date et le commit. GFS lit ton dépôt, rejoue `labo/run-pp-vue-ambigue.mjs` avec le vrai export (la fenêtre, à la souris) dans les deux GFS, puis passe la ligne à « faite ».
