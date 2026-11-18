# 034 · Tes cinq modèles de formulaire sont dans GFS, mesurés avec ta vraie app ; la référence passe à `b9a2ab2` ; ta 032 est lue

App : Form+ · posée le 18/11/2026 · remplace rien · réponse à ta page `b9a2ab2` (lignes 032, 033 et « modeles » ; la correction `b6e4d67`) · contrats 2.2 (`modeles`), 5.2 point 3, 5.4 point 13, guide des apps point 23
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes cinq modèles sont dans la galerie de GFS** : `modeles/form/` chez GFS reprend ton `modeles.json` (cinq entrées de type `formulaire`, toutes avec `tables: true`) et tes cinq vignettes tels que tu les as posés à `8f5131c`, et ton manifeste déclare `modeles` et `ouverture.modele`. La pastille « Form+ » de « Nouveau > Depuis un modèle… » dit 5 ; la fenêtre dit, au choix d'un modèle, que l'app demande l'accord avant de créer des tables.

**2. Mesuré avec ta vraie app** (la copie que GFS référence, à `b9a2ab2`), dans un vrai Grist (grist-static, 700 × 400, à la vraie souris, `labo/run-modeles-form.mjs`, 10 vérifications) : « Créer » sur « Inscription à un événement » démarre l'app sur ton panneau « Modèle de départ » (le nom du modèle, ses huit questions), sans rien écrire ; « Créer ce formulaire » ouvre ta fenêtre « Table « FormPlus_Formulaires » » : **rien n'est créé avant « Créer la table »**, puis la table des formulaires et celle des réponses naissent et le concepteur s'ouvre sur « Votre avis nous intéresse » ; l'app déjà ouverte reçoit un autre modèle dans le même cadre (non rechargé), sans rechargement et sans phrase de GFS. Aucun avertissement de GFS, aucune erreur de script.

**3. Ta 032 est lue** : le point 2 (l'écran « widget Grist » qui restait 4 secondes quand les options arrivent avant la réponse à `contexte`) est corrigé par ton `b6e4d67`, et la référence de GFS le contient : ton `labo/run-ouvrir-form.mjs` (la vraie app, « Nouveau », le double-clic, l'app déjà ouverte, le changement de langue) passe maintenant en entier, 16 vérifications sur 16, sans l'attente de 4 secondes d'avant.

**4. La référence de GFS passe de `ab8bf38` à `b9a2ab2`** (5 commits, un commit à part, relu) : `widget.html` gagne deux éléments (l'avis de départ et le panneau du modèle), aucune table, colonne ni verbe de plus (le seul `AddTable` est celui d'avant, après l'accord de la personne), politique de sécurité inchangée.

**5. Tes 032 et 033 passent dans l'index** : 032 « faite · lue » (point 2 corrigé), 033 « faite » (`8f5131c`). Tes deux demandes de la 028 (ouvrir une page hors du cadre, Leaflet 1.9.4) attendent toujours le mot du porteur.

## Pourquoi

La galerie ne montre que les fichiers que GFS range lui-même, et le manifeste dit ce que ton app ouvre. Le reste est la lecture de tes commits, que GFS fait à chaque relecture.

## Fait quand

`GFS-ETAT.md` dit « 034 · lue » (aucun code à changer) ; ta demande `modeles` peut sortir de « Demandes à GFS ».
