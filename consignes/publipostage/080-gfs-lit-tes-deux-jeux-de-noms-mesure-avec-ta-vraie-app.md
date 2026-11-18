# 080 · GFS lit tes deux jeux de noms, tables et colonnes : mesuré avec ta vraie app dans un vrai Grist ; tu n'attends plus GFS pour allumer `englishOnDisk`, tu le lui dis

App : Publipostage+ · posée le 18/11/2026 · remplace le point 5 de la 078 (« GFS ne code rien avant ta demande ») · réponse à ton registre `js/schema-columns.js` (à `b32f450`) et à sa phrase « une fois GFS prévenu » · décision du porteur du 18/11 (« ne laisse pas de chantier en attente ») · contrats 2.4 (point 6, `noms`), faits vérifiés 129
quand : à lire au prochain lot ; aucun code à changer aujourd'hui ; vaut dans GFS seulement

## Quoi

**1. GFS lit tes deux jeux de noms dès aujourd'hui.** Le manifeste de GFS garde les noms d'avant (`Publipostage_Modeles`, `Nom`…) et dit les autres (`noms`) pour tes trois tables : `Publipostage_Modeles` (14 colonnes de ton registre), `Publipostage_PreferencesModeles` (8) et `Publipostage_Versions` (5). Avant chaque lecture de tes fichiers, GFS lit `_grist_Tables` et `_grist_Tables_column` (deux petites tables internes de Grist, en lecture seule, seulement parce que ton manifeste dit `noms`) et réécrit ce qu'il lit et écrit dans les noms que le document porte : la liste de l'explorateur, l'étoile et les dossiers (ton rangement fait foi, 072), F2, « Dupliquer », la corbeille, le poids avec les versions liées. Rien n'est écrit dans ton document pour cela.

**2. Mesuré avec ta vraie app** (la copie que GFS référence, `b32f450`), dans un vrai Grist 1.7.19 (l'image officielle), 700 × 400, à la vraie souris (`labo/run-pp-noms-anglais-reel.mjs`, 24 vérifications sur 24) : le document d'essai porte d'abord tes noms d'avant, puis il est renommé comme ton registre le dit (`RenameColumn`, puis `RenameTable` : les lignes suivent). Avant et après, **la liste est la même** (« Contrat de prestation », « Quittance de loyer », « Support de session »), les mêmes dossiers et la même étoile, la console de GFS muette ; une étoile écrit dans `Publipostage_TemplatePreferences` (`User`, `TemplateId`, `Pinned`) et rien dans `GFS_Rangement` ; F2 écrit `Name` ; « Dupliquer » copie les valeurs sauf le nom et `Token` ; un modèle mis à la corbeille **avant** le renommage se restaure **après** sans rien perdre ; ta vraie app ouvre le modèle du document renommé (son nom et son texte). Avant cette consigne, le même document renommé perdait toute sa liste dans GFS, sans un mot (faits vérifiés 127).

**3. Les règles de GFS, pour ce que ton registre lui laisse décider :**
- **Un document qui porte les deux noms d'une table** (`Publipostage_Modeles` ET `Publipostage_Templates`, ou une colonne dans les deux jeux) : GFS lit le nom du manifeste, l'ancien, et le dit dans la console (un avertissement). Un renommage par `RenameTable` et `RenameColumn` de Grist n'en laisse jamais deux ; en porter deux est un reste que GFS ne devine pas. Si tu veux l'inverse, dis-le (« Questions pour GFS »).
- **Un nom que le document ne porte pas** (une table que tu n'as pas encore créée, une colonne d'un document ancien) : GFS garde le nom du manifeste, et la lecture dit « vide » comme avant.
- **Ce que GFS écrit pour lui s'écrit sous les noms du manifeste**, quel que soit le jeu du document : la colonne `Table` de `GFS_Corbeille` dit `Publipostage_Modeles`, et l'instantané d'une ligne mise de côté garde `Nom`, `Jeton`… ; à la restauration, GFS les remet sous les noms du document. Une corbeille ne se perd donc pas quand tu renommes.
- **GFS ne crée jamais une de tes tables ni une de tes colonnes** : il lit et écrit celles qui existent.

**4. Ce que tu fais, et il n'y a rien à coder aujourd'hui :**
- **Tu dis à GFS quand tes noms changent** : un nom ajouté, renommé ou retiré dans l'une de ces trois tables, une table de plus que GFS lit : une ligne dans « Changements qui touchent GFS ». Le manifeste est la copie que GFS tient de tes noms, et un nom que `noms` ne donne pas est un nom que GFS ne sait pas lire.
- **Le jour où tu allumes `englishOnDisk`**, ou que tu renommes des documents existants : une ligne dans « Changements qui touchent GFS », plus besoin de demande avant (le point 5 de la 078 est remplacé). Le renommage se fait par `RenameTable` et `RenameColumn` de Grist, sur place : jamais une copie vers une table neuve, jamais deux tables pour la même chose.
- **Ce que GFS ne lit pas** (tes `_Comments`, `_Abbreviations`, `_PageFormats`, `_TableLinks`) n'est pas dans `noms` : tu les renommes comme tu veux.

**5. Ce qui n'est pas mesuré** : ton renommage réel (ton lot 5) et un document à moitié renommé (une table renommée, l'autre pas : essai de GFS seulement, pas encore dans un vrai Grist) ; GFS rejouera l'essai quand tu allumes l'interrupteur, si ta ligne le dit.

## Pourquoi

Ton registre dit que l'interrupteur ne s'allume qu'« une fois GFS prévenu » : le porteur ne veut pas de chantier en attente, GFS lit donc les deux jeux de noms maintenant, au lieu d'attendre ta demande. Ainsi ton allumage n'a plus de condition côté GFS, et l'explorateur ne perd la liste d'aucun document.

## Fait quand

`GFS-ETAT.md` dit « 080 · lue » (aucun code à changer) et la question des noms est fermée de ton côté. Le jour où tu allumes `englishOnDisk` : une ligne dans « Changements qui touchent GFS », avec le commit.
