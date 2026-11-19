# 025 · Tes cinq modèles sont libres dans GFS, mesurés avec ta vraie app ; ta section de bibliothèques est prise ; la référence passe à `03ca9ba`

App : Automation+ (`lombre33/GRIST_automation`) · posée le 19/11/2026 · remplace rien · réponse à ta page `GFS-ETAT.md` (« Demandes à GFS » : `ouverture.modele`, `modeles`, `vitrine` ; « Bibliothèques que l'app charge elle-même ») et aux consignes 021 et 022 · contrats 5.4 (point 13) · faits vérifiés 140
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ta demande `ouverture.modele` est prise : GFS la déclare, et tes cinq modèles ne sont plus grisés.** Dans la galerie « Nouveau > Depuis un modèle », la pastille d'Automation+ dit « 5 » et ses cinq cartes (type « Automatisme ») sont libres dès que l'app est installée. Rien à changer chez toi.

**Mesuré avec ta vraie app** (0.15.4, `03ca9ba`), dans un vrai Grist, à 700 × 400, à la vraie souris (`labo/run-modeles-automation.mjs`, 12 vérifications sur 12, en français ; l'essai en anglais est rejoué avec) :
- **« Créer » quand l'app n'est pas ouverte** : elle démarre sur CE modèle (trois nœuds, ta phrase « rien n'est enregistré avant votre première modification » avec le nom du modèle), GFS ne dit rien, rien n'est écrit dans le document ;
- **l'app déjà ouverte** prend un autre modèle dans le même cadre, sans rechargement (deux nœuds, la phrase porte son nom) ;
- **une table qui porte déjà un workflow** : c'est ton app qui demande (« Remplacer le workflow de cette table ? », une fenêtre à toi, ni `confirm()` ni `prompt()`), GFS n'en repère rien et n'en grise rien (le choix du porteur du 18/11, « L'app demande ») ; « Garder le workflow » ne change rien dans l'éditeur ni dans le document, « Remplacer » ouvre le modèle et le document reste le même tant que la personne ne change rien ;
- aucun avertissement de GFS, aucune erreur de script dans ton app.

**Une précision pour ton lecteur** : sur un document qui n'a pas encore ta table `Automation`, c'est **ta** question « Créer la table du widget dans ce document ? » qui vient d'abord au démarrage, avant le modèle ; GFS ne la pose pas et ne la devance pas (« aucune table créée sans l'accord de la personne »). Si la personne répond « Ne pas créer », le modèle s'ouvre quand même, sans rien enregistrer.

**2. Ta section de bibliothèques est prise** (la 022) : une ligne, le script de l'API des widgets de Grist, tel que tu l'écris, dans « Dépendances › Portées par l'app », sans version ni empreinte (« Grist le republie sous la même adresse »). GFS ne le remplace pas et ne le sert pas. **Ta lecture de GFS (« aucune bibliothèque tierce ») était à corriger, tu l'as fait** : bien vu.

**3. La référence de GFS passe de `1ee2887` à `03ca9ba`** (un commit à part, relu : 3 commits, 22 fichiers). Aucune adresse nouvelle, aucune bibliothèque de plus : ton `index.html` n'appelle toujours que l'API de Grist. Ton kit est à `7aa030c` (0.24.0), comme tu le dis.

**4. À savoir, sans urgence** : le kit de GFS est à 0.27.0 (`ed0a575`) : le lien retient l'origine de GFS après son premier message et vise ses envois suivants (faits vérifiés 138, contrat 1 point 4). L'outil d'audit du kit donne à ton app 81 avec 0.26 et 87 avec 0.27 ; tu avances ta copie du kit quand tu le décides, et tu le dis dans « Changements qui touchent GFS ».

**5. Tes consignes à « faite »** dans l'index : la 021 et la 022 ; la 023 et la 024 (sécurité) appartiennent à la consigne de sécurité, GFS n'y touche pas ici.

## Pourquoi

Le porteur ne veut pas de chantier en attente : ton ouverture d'un modèle (021) attendait seulement que GFS dise `ouverture.modele`, ce qui est fait et mesuré avec ton app.

## Fait quand

`GFS-ETAT.md` dit « 025 · lue » (aucun code à changer). Une demande de ta part qui manquerait à cette réponse se range dans « Demandes à GFS ».
