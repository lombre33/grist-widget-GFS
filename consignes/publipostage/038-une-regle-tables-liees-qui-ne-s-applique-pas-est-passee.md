# 038 · Une règle « Tables liées » qui ne s'applique pas à la page est passée, et tu relies par la colonne Référence (décision du porteur)

App : Publipostage+ · posée le 03/11/2026 · décision du porteur du 03/11 · quand : au prochain lot ; du code dans ton app (la résolution
des tables liées, `js/variables.js` et `js/grist-api.js`) ; se voit aussi dans l'app seule

## Quoi

**1. Ce que le porteur a vu** (dans GFS, mode Lecture par ligne). La table de la page est « ENVOI POSTAUX » (colonnes `Projet`, `B`,
`date envoie`…) et « Tables liées » montre six règles, toutes écrites « Toutes les tables » (`TableSource` vide : la règle commune, celle
d'avant les liens propres à une table). Celle d'Établissements dit « Auto = conve… » : l'identifiant de la ligne d'Établissements doit être
égal à la colonne « conve… » de la table de la page, et « ENVOI POSTAUX » n'a pas cette colonne. Les champs d'Établissements et de Projets
restent **vides, sans message**, alors que `B` et `Projet` sont de vraies colonnes Référence vers ces tables.

**2. Ce que GFS a mesuré** (vrai Grist, ta version à `134d043`, les Références montrant du texte comme chez le porteur). Dans `baseRows`,
`GristAPI.getLinkRule(table, page)` rend la règle commune dès qu'il n'y a pas de règle propre à ce couple ; `resolveLinkedRows` lit la
colonne source dans la ligne de la page : elle n'existe pas, `ruleSourceValue` rend `undefined`, la règle ne trouve aucune ligne, sans erreur.
Deux choses ne se font alors jamais : le repli par la colonne Référence de la page (`findReferenceColumns`), et la fenêtre de liaison
(`ensureLinkConfigured` ne la propose que sans règle). Corrigée à la main avec le crayon de « Tables liées » (la bonne colonne à gauche,
« Auto » à droite), la Lecture montre les valeurs : c'est donc bien la règle qui masquait la colonne Référence.

**3. Ce que GFS te demande.** Une règle de liaison **dont la colonne source n'existe pas dans la table de la page** ne s'applique pas à
cette page : passe-la comme s'il n'y en avait pas. Dans `baseRows`, cherche alors la colonne Référence de la page qui mène à la table
(`findReferenceColumns`) ; s'il n'y en a aucune, laisse `ensureLinkConfigured` proposer la fenêtre de liaison, comme pour une table sans
règle. Tout ce qui s'applique aujourd'hui s'applique comme avant : une règle propre au couple (page, table), une règle commune dont la
colonne source est dans la table de la page, la règle « singleton », la colonne source « Auto ». **Tu ne supprimes ni ne réécris jamais
une règle de la personne** : elle reste dans « Tables liées », elle est seulement sans effet sur la page où sa colonne manque.

## Pourquoi

Une règle commune écrite avant les liens propres à une table (ou pour une autre page) masque aujourd'hui la bonne colonne Référence sans
rien dire : la personne ne voit que des champs vides, et ne reçoit ni message ni proposition de relier. Le porteur a choisi (03/11, carte
« Décider ce que fait Publipostage+ d'une règle « Tables liées » qui ne s'applique pas ») que Publipostage+ passe la règle et relie
tout seul, plutôt que de dire ce qui cloche ou de laisser la personne corriger à la main.

## Fait quand

`GFS-ETAT.md` donne « 038 · faite · `<commit>` » ; un test échoue sur l'ancien code : une règle commune dont la colonne source manque dans
la table de la page, avec une colonne Référence vers la table liée, rend les lignes que la Référence désigne ; sans Référence, la fenêtre
de liaison se propose ; une règle commune dont la colonne existe s'applique toujours. GFS le rejoue dans un vrai Grist avec les six règles
du porteur, en Lecture par ligne.
