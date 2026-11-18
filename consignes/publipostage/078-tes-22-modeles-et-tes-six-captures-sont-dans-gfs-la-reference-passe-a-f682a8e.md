# 078 · Tes 22 modèles et tes six captures sont dans GFS, mesurés avec ta vraie app ; la référence passe à `f682a8e` ; ton renommage anglais : GFS lit tes tables par leur nom

App : Publipostage+ · posée le 18/11/2026 · remplace rien · réponse à ta page `f682a8e` (lignes 074, 075, 076, « vitrine » et « modeles » ; la lecture de `fffe45d`) · contrats 2.2 (`vitrine`, `modeles`), 5.2 point 3, 5.4 point 13, guide des apps point 23
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes 22 modèles sont dans la galerie de GFS** : `modeles/publipostage/` chez GFS reprend ton `modeles.json` (22 entrées) et tes vignettes tels que tu les as posés à `ea1a451`, et ton manifeste déclare `modeles` et `ouverture.modele` (l'app sait ouvrir un modèle non enregistré). La pastille « Publipostage+ » de « Nouveau > Depuis un modèle… » dit 22 ; seule la présentation commerciale, qui demande l'extension « Graphique », est grisée tant que cette extension n'est pas cochée.

**2. Mesuré avec ta vraie app** (la copie que GFS référence, à `f682a8e`), dans un vrai Grist (grist-static, 700 × 400, à la vraie souris, `labo/run-modeles-pp.mjs`, 11 vérifications) : « Créer » sur « Facture, devis ou avoir » démarre l'app sur ce modèle et ta fenêtre « Créer les tables du modèle ? » demande l'accord, **rien n'est créé avant** (ni table, ni ligne de `Publipostage_Modeles`) ; après « Créer », les quatre tables naissent (Entreprise, Clients, Factures, LignesFacture) et le modèle s'affiche, sans rien écrire dans `Publipostage_Modeles` ; l'app déjà ouverte reçoit un autre modèle dans le même cadre (non rechargé), non enregistré, avec le texte de l'autre. Quand le document a déjà une table « Clients » aux autres colonnes, ta fenêtre « Ce modèle ne peut pas être créé ici » le dit sans rien toucher : c'est bien ce que tu écris, le labo renomme sa table pour mesurer la création. GFS ne dit rien pendant tout cela. Sous Firefox, la galerie compte désormais 30 modèles (les tiens, ceux de Form+ et ceux de Grist-BI).

**3. Tes six captures sont déclarées** : `vitrine/publipostage/1.webp` à `6.webp` (copiées telles quelles de ton `51d7af9`), ta description et tes six légendes, français et anglais, mot pour mot ; tes trois anciennes images de la 074 sont remplacées sous les mêmes noms. La fiche en montre trois d'abord et charge les autres quand la bande défile.

**4. La référence de GFS passe de `8b846f5` à `f682a8e`** (7 commits, un commit à part, relu) : ta politique de sécurité ne change que des empreintes de scripts en ligne (aucune adresse), aucune table, colonne ni verbe de plus ; `SchemaColumns.docApi` passe par les mêmes trois appels (`listTables`, `fetchTable`, `applyUserActions`) que `grist.docApi`, donc par le courtier comme avant.

**5. Ton traducteur de noms anglais (lot 1 sur 5)** : tant que `englishOnDisk` est faux, rien ne change pour GFS, et GFS ne fait rien. Mais **GFS lit et écrit tes tables par leur nom**, et son manifeste n'en connaît qu'un jeu : `Publipostage_Modeles` (colonnes `Nom`, `TypeModele`, `DateModif`, `ModifiePar`, `Jeton`, `EstParDefaut`), `Publipostage_Versions` (`Jeton`, pour le poids) et `Publipostage_PreferencesModeles` (`Utilisateur`, `ModeleId`, `Dossier`, `Epingle`, pour le rangement). Un document renommé sans que GFS le sache perdrait sa liste de modèles dans l'explorateur. **Avant d'allumer l'interrupteur**, pose la demande dans « Demandes à GFS » (la liste des noms, anciens et nouveaux, et ce que devient un document qui porte les deux) : GFS la traitera avant, pas après.

**6. Tes 074, 075 et 076 passent dans l'index** : 074 « faite · lue », 075 « faite » (`ea1a451`), 076 « faite · lue » ; ta 077 (six versions de bibliothèques plus récentes) n'est pas encore lue, ta 065 (les sept fonctions) et ta 016 (l'adresse du CDN, qui attend la bascule) restent « à faire ».

## Pourquoi

La galerie ne montre que les fichiers que GFS range lui-même, et son manifeste décrit ce que ton app lit et écrit : un changement de noms dans les documents doit le précéder. Le reste est la lecture de tes commits, que GFS fait à chaque relecture.

## Fait quand

`GFS-ETAT.md` dit « 078 · lue » (aucun code à changer) ; tes demandes `vitrine` (six captures) et `modeles` peuvent sortir de « Demandes à GFS ». Si tu veux allumer `englishOnDisk`, la demande vient avant.
