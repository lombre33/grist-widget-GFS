# 002 · Garde « type inconnu »

App : Publipostage+ · posée le 14/10/2026 · quand : **urgent**, avant que quiconque écrive un nouveau type de modèle
dans `Publipostage_Modeles`

## Quoi

Un modèle dont `TypeModele` a une valeur que l'app ne connaît pas (par exemple `presentation`) est préservé, jamais
touché :

- il n'est jamais chargé dans l'éditeur (par quelque chemin que ce soit : sélecteur, modèle de la vue, règle de ligne, ★),
  jamais réenregistré, jamais proposé comme ★, le modèle de départ du document ;
- il est listé grisé dans le sélecteur de modèle et dans « Organiser », avec un texte qui dit pourquoi :
  - type que l'app sait nommer mais dont l'extension manque : « Demande l'extension {nom} (Grist Factory Suite) » ;
  - type qu'elle ne connaît pas du tout : « Créé avec une version plus récente de Publipostage+ » (tant qu'aucune
    extension ne déclare de type, seul ce texte est atteint) ;
- les types connus ne changent pas : `document` (la valeur vide en fait partie), `grille`, `email` et `macro` ; la ligne
  réservée `reglages` reste exclue des listes ;
- les deux textes existent en français et en anglais dans le même lot (charte).

Où, au 14/10 sur `ad1f88c` (numéros de ligne à relire sur `origin/main`) : `typeModeleOf` (`js/main.js`, ligne 330)
rend la valeur telle quelle, donc un type inconnu s'ouvre comme un document ; `canBeDocumentDefault` (`js/templates.js`,
ligne 476) n'exclut que `email` et `macro`.

## Pourquoi

Aujourd'hui, un type inconnu s'ouvre comme un document et peut devenir le modèle de départ ; s'il est réenregistré, il
est abîmé. Les diapositives (type « présentation ») et d'autres types viendront de GFS ou d'une version plus récente de
l'app : sans la garde, l'app seule, ou une version plus ancienne, les détruirait. Elle doit exister avant que quiconque
écrive un nouveau type dans la table (cahier 5.4, guide 2.2). C'est la seule chose urgente du guide.

## Fait quand

Un test échoue sur le code d'avant et passe avec la garde : un modèle `TypeModele = 'presentation'` n'est ni ouvert dans
l'éditeur, ni réenregistré, ni proposé comme ★, et il apparaît grisé, avec le bon texte, dans le sélecteur et dans
« Organiser » (à vérifier comme le reste de l'interface : 700 × 400, clair et sombre, français et anglais).
`GFS-ETAT.md` donne la ligne « 002 · faite · `commit` ».
