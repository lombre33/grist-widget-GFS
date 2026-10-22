# 013 · Les liens publics : un lien ne montre que son formulaire, et n'ouvre que ce que son formulaire remplit

App : Form+ · posée le 22/10/2026 · décision du porteur du 22/10 (carte « Fermer ce que les liens publics de Form+ laissent lire et
écrire ? » : « Form+ et GFS » ; puis : « bien segmenter et limiter les droits d'écriture d'un formulaire, être super vigilant ») ·
quand : au prochain lot, **avant la 012** ; du code dans ton app ; sécurité

## Quoi

**Ce que Grist ouvre à qui a le lien d'un formulaire publié** (lu dans le code de Grist : `faits-verifies.md` 10.11 ; ce que GFS en
tire : `contrats.md` 3.3 point 9, 3.7 point 8 et 11.9 ; ce que tu as mesuré sur un vrai Grist, dans les commentaires de
`ensureFormulairesTable` et de `ensureRespondentDefinitionField`, dit la même chose) :

- **en lecture**, toute la colonne affichée (`visibleCol`) de la table que vise chaque champ Référence des formulaires publiés,
  **champs cachés compris**. C'est `FormPlusDef` : le lien d'un formulaire donne la `Definition` de **tous** les formulaires de
  `FormPlus_Formulaires`, avec leur `shareKey`, leur `formLink` et leur `publicUrl` : qui a un seul lien retrouve ceux que la personne
  garde privés. C'est aussi, pour la colonne choisie, ce que font les questions « Choix depuis une table » (`ensureChoiceField`,
  `ensureRefListField`) ;
- **en ajout**, des lignes dans la table de **chaque** formulaire publié de la **page** (une clé de partage porte sur la page, et
  `ensureTableGate` ouvre une autre table sur cette même page), dans **toutes** ses colonnes, même celles que le formulaire ne montre
  pas ou qu'on y ajoutera plus tard. Grist ne vérifie rien de ce qu'un lien écrit : une colonne cachée, une formule déclenchée, un choix
  hors de la liste sont gardés tels quels (mesuré au moteur). Jamais de modification, de suppression ni de relecture d'une ligne.

Aucune règle, ni de Grist ni de GFS, ne resserre un lien après coup : la personne qui l'ouvre parle à Grist sans passer par GFS. Seul ce
que ton app publie compte. **Ce que GFS fait**, dès que ce lot est en ligne (22/10) :

- quand ton app pose `shareOptions` sur une section, ou ajoute un champ Référence à une section publiée, le courtier calcule ce que le
  lot ouvre de nouveau et en demande l'accord à la personne, dans une fenêtre qui dit : le lien est public, les tables qu'il remplit,
  les colonnes qu'il pourrait remplir sans les montrer, les colonnes qu'il rend lisibles, que rien ne limite le nombre de lignes, comment
  le fermer. Si elle refuse, ton `applyUserActions` est rejeté avec `GFS_ANNULE` et rien n'est écrit ;
- il **refuse sans demander** (`GFS_REFUSE`, avec la raison) d'ouvrir une table de GFS, d'une autre app ou de la tienne (`FormPlus_…`) à
  l'ajout, une table de GFS ou d'une autre app à la lecture, et tout ce que ton manifeste ne te laisserait pas écrire (ou lire) toi-même.
  La lecture d'une table de la tienne passe encore par l'accord, tant que ta définition y est lue ; une fois la 013 faite, GFS la
  refusera aussi (contrats 11.9, point 4c) ;
- il refuse ce qu'il ne sait pas juger (`AddOrUpdateRecord` sur les champs et les colonnes) ; `_grist_Pages.shareRef` ne s'écrit jamais.

**Ce que tu fais :**

**1. Un lien ne montre que son formulaire.** Rien d'un autre formulaire n'est lisible depuis un lien : ni sa définition, ni son
`shareKey`, ni son `formLink`, ni son `publicUrl` (11.9, points 4d et 10). À toi la manière ; pistes, avec leur prix : la définition portée
par l'adresse (ton secours `#form=` la porte déjà, mais une adresse a une longueur limitée) ; la liste des choix d'une question
« Choix depuis une table » copiée dans ta définition à la publication, pour que le lien ne lise aucune autre table (à mesurer) ; une
petite table par formulaire publié, que sa seule Référence vise (une table de plus : guide 1.1, point 4, avec l'accord de la personne) ;
au minimum, séparer ce que le répondant lit (questions, libellés, choix) de ce qui ne sort jamais (clés, adresses, `writeTable`,
`writeCol`, mode interne). Le minimum est un plancher : les questions d'un autre formulaire n'ont pas non plus à être lisibles.

**2. Une porte, sa table de réception** (11.9, points 4a et 4b). Un formulaire a sa page et ne remplit que les tables qu'il remplit
vraiment : jamais deux formulaires sur le même partage, jamais un lien qui écrit dans la table d'un autre formulaire. La table qu'un lien
remplit **reçoit** : elle ne porte aucune colonne de gestion (statut, note, état de traitement) que le lien pourrait remplir sans la
montrer ; ce que le formulaire ne montre pas y est une colonne-formule pure, ou une colonne d'une autre table liée à la ligne reçue. Une
table secondaire (`ensureTableGate`) s'ouvre à toute la page, dans toutes ses colonnes : ne l'offre que pour une table de réception à
elle, et dis-le (point 3). Où arrivent les réponses (boîte aux lettres validée, table de réception cloisonnée, ou l'accord seul) :
le porteur en décide (carte du 22/10) ; une consigne suivante te le dira, ce point-ci vaut dans tous les cas.

**3. Dis à la personne ce que le lien ouvre, avant de publier.** Dans ton écran, en mots simples : « ce lien permet à n'importe qui
d'ajouter des lignes à la table X (colonnes remplies : …, colonnes que le formulaire ne montre pas : …) et de lire toute la colonne Y de
la table Z » ; une question « Choix depuis une table » ouvre à tous la lecture de toute la colonne choisie, dis-le au moment du choix.
GFS posera sa propre fenêtre quand même : ne la remplace pas, complète-la de ce que toi seul sais (quel formulaire, quelle question).

**4. Un refus ne laisse rien à moitié fait.** Quand `applyUserActions` est rejeté avec `GFS_ANNULE` ou `GFS_REFUSE`, retire la section
créée ou dupliquée et les champs ajoutés, garde le formulaire privé et dis-le (« Publication refusée : ce formulaire reste privé », avec
la raison que GFS donne). Sans GFS (ton app seule), ta propre confirmation du point 3 est la seule : elle n'est pas facultative.

**5. Une ligne reçue par un lien est un texte non fiable** (11.9, point 5) : ce que ton app en affiche ou en fait est échappé, jamais
pris pour du code, une formule ou une adresse de script, aucune colonne d'auteur ni de date n'est crue, et rien n'est lancé sans le
geste d'une personne.

**6. Les documents déjà publiés** restent ouverts comme avant : ni GFS ni toi ne les refermez sans la personne. Dis dans ta page d'état
ce que ton app fait pour eux (les signaler à la personne, lui proposer de séparer).

## Pourquoi

Le porteur : « à l'échelle de GFS on doit être super carré côté sécurité, et un formulaire c'est une porte d'entrée pour venir écrire des
bêtises ou autre dans un document ». Un verrou dans GFS n'arrêterait aucun visiteur : seuls comptent ce qu'une app a le droit de
publier (GFS, avec l'accord de la personne) et la manière dont l'app ouvre ses formulaires (toi). Il a choisi « Form+ et GFS » et demandé
de segmenter et de limiter les droits d'écriture d'un formulaire avec une vigilance particulière.

## Fait quand

`GFS-ETAT.md` donne « 013 · faite · `<commit>` » (ou point par point), avec ta mesure sur un vrai Grist avec un partage : (a) le lien
d'un formulaire A ne rend rien du formulaire B (ni définition, ni clé, ni lien) ; (b) un ajout par le lien dans une table que A ne remplit
pas est refusé, et la table de A n'a aucune colonne de gestion ; (c) après un refus de la personne (`GFS_ANNULE`) ou de GFS (`GFS_REFUSE`),
le document est comme avant (aucune section en plus, rien de publié). Chaque correction a son test, qui échoue sur l'ancien code. GFS
rejoue `run-form` et `run-publication` ; son labo joue les fenêtres et les refus, pas les règles de partage de Grist (grist-static n'a pas
de partage) : ces règles-là, c'est ta mesure.
