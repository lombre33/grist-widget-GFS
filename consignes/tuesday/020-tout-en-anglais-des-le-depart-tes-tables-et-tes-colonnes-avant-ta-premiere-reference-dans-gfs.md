# 020 · Tout en anglais dès le départ : tes tables et tes colonnes, avant ta première référence dans GFS

App : Tuesday (`lombre33/grist-wisget-tuesday`) · posée le 25/11/2026 · remplace rien · décision du porteur du 25/11 (« tout en anglais partout, aucun document perdu, pas de table de plus » ; « les futures apps en anglais dès le départ ») · guide des apps 1.1, point 15 · kit 0.29.1 (README, « La mise à jour des noms »)
quand : à ton prochain lot ; une liste de noms à donner d'abord (dans « Demandes à GFS »), puis du code dans ton app ; aucune fenêtre ni migration si aucun document de gens ne porte tes noms

## Quoi

**1. La décision du porteur (25/11).** Tout passe en anglais partout (code, tables, colonnes) ; l'interface reste française et anglaise ; **aucun document ni arborescence perdu**, **pas de table de plus** (un renommage se fait sur place, jamais par copie) ; **GFS lit toujours les deux jeux de noms, sans date de fin** ; la personne le sait avant, par une fenêtre qui ne se passe pas, et **seulement si elle peut le faire** ; les gens sont toujours sur le lien de la dernière version. Pour une app nouvelle, c'est la règle du guide des apps (1.1, point 15) : **anglais dès le départ**, code (variables, fonctions, fichiers), tables et colonnes ; seule l'interface reste en français et en anglais.

**2. Tes noms d'aujourd'hui, et ce que GFS propose** (lus dans le rapport de GFS du 25/11, pas dans ton code : **ta liste fait foi**) :
- `Tuesday_Projets` → `Tuesday_Projects` : `Nom` → `Name`, `TypeProjet` → `ProjectType`, `Dossier` → `Folder`, `DateModif` → `ModifiedAt`.
- `Tuesday_Liens` → `Tuesday_Links` : `Ligne` → `Row`, `Fichier` → `File`, `Nom` → `Name`, `Cree` → `CreatedAt` ; `Table`, `App` et `Type` sont déjà anglais.

**3. Ce que tu fais** :
- **a.** Donne ta liste complète dans « Demandes à GFS » (toute table, colonne ou clé de réglage que ton code crée, lit ou écrit, avec son nom d'aujourd'hui et son nom anglais).
- **b.** **Si aucun document hors des tiens ne porte tes noms français** (la V1 est une démonstration : dis-le), bascule **d'un coup** dans ton code et tes tables, sans migration ni fenêtre : tes documents d'essai se refont ou se renomment à la main dans Grist. Tu n'écris jamais deux jeux de noms dans un même document.
- **c.** **Si un document hors des tiens les porte**, ne renomme rien : dis-le. GFS te posera la consigne qui adopte la **fenêtre commune** du kit 0.29.1 (`NamesUpdate.run`, `css/names-update.css` : bloquante, pour le propriétaire seulement, un seul lot, vérifiée avant et après ; une table qui porte `id_sync` n'est jamais renommée), avec les règles du guide (1.1, point 15) : tu lis les deux jeux dans la version qui renomme, tu ne crées jamais la table anglaise quand la française existe.
- **d.** Annonce tes noms dans ta fiche `gfs.json` et dans « Changements qui touchent GFS » **avant** ta première référence dans GFS (contrats 2.4, point 6 : GFS les déclare dans `noms` ; ton préfixe `Tuesday_` reste le début de chaque table).
- **e.** Une écriture qui répond « table introuvable » ou « colonne introuvable » : relis les noms et recommence **une fois** ; sinon dis « Rechargez la page » (guide 1.1, point 15).

**4. Une question** (ta réponse va dans « Demandes à GFS » de `GFS-ETAT.md`) : un document qui n'est pas le tien porte-t-il déjà `Tuesday_Projets` ou `Tuesday_Liens` ?

## Pourquoi

Une app qui n'est chez personne passe à l'anglais au moindre coût, avant que des documents de gens ne portent ses noms : après, il faudrait une migration, avec sa fenêtre.

## Fait quand

`GFS-ETAT.md` donne « 020 · faite · lue » avec ta liste de noms et la réponse à la question ; puis, quand le code est fait, le commit qui crée les tables anglaises dans un document neuf. Si la réponse est « oui », la fenêtre commune fait l'objet d'une consigne à part.
