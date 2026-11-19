# 093 · Les listes de colonnes se relisent à l'ouverture d'une fenêtre : une colonne ajoutée ou passée en case à cocher dans Grist après l'ouverture de l'app manque, ou garde son ancien type, dans « Condition de la case »

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · retour du porteur du 19/11 (« la liste des colonnes ne liste pas une colonne booléenne, pourtant dans la table » ; sur une autre colonne il a dû écrire « true » à la main : « ça devrait par défaut proposer vrai/faux ») · rien à changer dans GFS : même défaut sans GFS · faits vérifiés 143
quand : à lire au prochain lot, sans urgence ; une relecture légère des colonnes et des types à l'ouverture des fenêtres qui en listent, et un essai ; vaut dans GFS et seule

## Quoi

Quand la personne ajoute une colonne dans Grist, ou change le type d'une colonne vide en « case à cocher » (interrupteur), **pendant que l'app est ouverte**, la fenêtre « Condition de la case » (celle de la bulle, du bloc et de la valeur conditionnels aussi : `js/variable-condition.js`) ne la voit pas :

- une colonne **ajoutée** après la dernière lecture n'est pas dans la liste ;
- une colonne **retypée** garde son ancien type dans la liste (pas de « (case à cocher) ») et son champ Valeur reste une saisie libre : **la liste Oui / Non existe déjà** (`buildBoolList`, `js/condition-fields.js`) mais ne se montre que si `GristAPI.getColumnType` rend `Bool`, et il rend l'ancien type (`Any` pour une colonne qui était vide). C'est le « true » tapé à la main du porteur ; il n'y a rien à ajouter au champ Valeur lui-même.

**À faire : relire les colonnes et leurs types à l'ouverture d'une fenêtre qui les liste**, comme tu le fais déjà pour la liste « # » (`js/variables.js` : `refreshSchemaOnce`, remis à zéro à la fermeture de la liste, lignes 442 et 615). Les listes qui passent par `ConditionFields.buildRuleRow` (`fillColumnList`, `buildColumnField`) sont toutes concernées : les conditions des bulles, des blocs, des valeurs et des cases (`js/variable-condition-rules.js`), la mise en forme conditionnelle (`js/conditional-style-window.js`), le tableau croisé (`js/pivot-window.js`), le filtre d'une boucle (`js/variable-loop.js`), et les règles des macros si elles passent aussi par là. Deux contraintes :

1. **Une relecture légère, pas la passe complète** : ton propre commentaire (`js/editor.js`, `settleSteps`) rappelle que `refreshSchema()` relit chaque table en entier (1,4 million de cases sur un gros document) ; une fenêtre qui s'ouvre ne doit pas payer cela. Les métadonnées suffisent : `GristAPI.init` fait déjà une passe rapide (`startSchemaPass(true)`, `js/grist-api.js` ligne 413 : `listTables`, `_grist_Tables`, `_grist_Tables_column`, quelques Ko) ; une passe qui ne remplace pas par du provisoire les colonnes qu'une règle d'accès cache (les listes exactes viennent de `fetchTable`) est ce qu'on attend. Tu choisis la forme.
2. **La fenêtre ne doit pas attendre longtemps ni se rouvrir à côté** : si la relecture n'est pas finie à l'ouverture (Grist lent), la liste et le champ Valeur se reconstruisent quand elle finit (`renderRules()`), sans toucher à ce que la personne a déjà choisi.

**Un essai à toi qui échoue sur le code actuel** : ouvrir un modèle, poser une case conditionnelle (la liste « # » relit le schéma ici) ; **dans Grist**, passer une colonne vide en case à cocher (`ModifyColumn`, `type: 'Bool'`) et ajouter une colonne `Bool` ; ouvrir « Condition de la case » : les deux sont listées avec « (case à cocher) », et le champ Valeur de chacune propose Oui / Non.

## Pourquoi

Le porteur, sur le Grist de la DINUM (Firefox), n'a pas vu ses colonnes « Signature président » et « signature DGS » (des interrupteurs) dans « Condition de la case », alors que « Urgent » y était, sans l'indication « (case à cocher) » et avec une saisie libre pour la valeur. La capture est compatible avec ce défaut ; GFS ne l'a pas vue sur son document.

GFS l'a mesuré dans un vrai Grist (faits vérifiés 143, sommet de `main` `6fd6eec`, Chromium, `labo/run-colonnes-perimees-publipostage.mjs`) : l'app ouverte, une case conditionnelle posée, puis dans Grist une colonne vide passée en `Bool` (interrupteur) et une colonne `Bool` ajoutée. La fenêtre « Condition de la case » liste `Urgent (case à cocher)` et `Ancienne_vide` **sans indication**, et pas `Signature_tardive` ; son champ Valeur est une saisie libre. **Après une ouverture de la liste « # »** (qui relit le schéma), la même fenêtre rouverte liste les trois avec « (case à cocher) » et propose Oui / Non. **Le même résultat sans GFS** (l'app posée seule comme widget) : ce n'est pas un défaut du courtier, et il n'y a rien à changer dans GFS (le courtier rend toutes les colonnes et tous les types à la première lecture, mesuré aussi).

Le porteur travaille ainsi : l'app ouverte à côté de la grille, il ajoute et règle ses colonnes dans Grist, puis revient à la condition. Un défaut qui ne se voit qu'après un rechargement ressemble à une colonne qui n'existe pas.

Ce que cette consigne ne demande pas : un autre mot que « Oui / Non » dans le champ Valeur (ce sont les mots que la comparaison lit : `ConditionRules.parseBoolExpected`), ni de deviner qu'une colonne `Any` qui ne contient que vrai et faux est une case à cocher.

## Fait quand

1. La fenêtre « Condition de la case » (et les autres fenêtres qui listent les colonnes par `ConditionFields`) liste une colonne ajoutée dans Grist après l'ouverture de l'app, avec son type, sans avoir à ouvrir la liste « # » ni recharger.
2. Une colonne passée en case à cocher dans Grist après l'ouverture porte « (case à cocher) » et son champ Valeur propose Oui / Non.
3. Ouvrir la fenêtre ne relit pas toutes les tables en entier (une relecture des métadonnées seulement) ; un document aux colonnes inchangées n'est pas plus lent à ouvrir, et la liste ne clignote pas.
4. L'essai ci-dessus échoue sur l'ancien code, et ta page `GFS-ETAT.md` le dit (une ligne dans « Changements qui touchent GFS » avec la date et le commit, et ta ligne « Consignes » : « 093 · faite » avec le commit). GFS lit le dépôt de ton app (`js/variable-condition.js`, `js/condition-fields.js`, `js/grist-api.js`), rejoue `labo/run-colonnes-perimees-publipostage.mjs` (les `CONSTAT` doivent devenir des `OK`), puis passe cette consigne à « faite ».
