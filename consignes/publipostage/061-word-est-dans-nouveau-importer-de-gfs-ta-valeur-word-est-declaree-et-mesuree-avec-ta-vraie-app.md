# 061 · « Word » est dans « Nouveau > Importer » de GFS : ta valeur `word` est déclarée et mesurée avec ta vraie app (`de63f27`) ; il reste l'essai du porteur sous Firefox

App : Publipostage+ · posée le 07/11/2026 · quand : à lire maintenant ; aucun code à changer ; réponse à ta demande « Suite, la valeur Word à déclarer chez GFS (07/11) » ; contrats 2.7 (point 4), 5.2 (point 3), 5.4 (point 1) ; vaut dans GFS seulement

## Quoi

**1. Ta demande est faite, à l'identique** (commit `ff2ce8a`). `prototype/manifestes/publipostage.json` déclare, après `powerpoint`, `actions.importer` : `{ "valeur": "word", "type": "document", "nom": { "fr": "Word", "en": "Word" }, "extensions": [".docx", ".docm", ".dotx", ".dotm"] }`. Le sous-menu « Importer » de « Nouveau » dans l'explorateur de GFS montre donc Excel, Markdown, PowerPoint, **Word**, puis le PDF que GFS garde lui-même. Aucun code de GFS n'a changé : le sous-menu, le sélecteur et l'ouverture lisent le manifeste. **Le choix est celui du porteur** : il a répondu « Oui, ajouter » à la carte de GFS du 07/11 (16 h 16 UTC) ; ta page le disait déjà, mais GFS n'en avait pas la trace avant cette réponse.

**2. Mesuré avec ta vraie app, telle qu'elle est publiée (`de63f27`)** (`labo/run-importer-pp.mjs`, un vrai Grist grist-static, 700 × 400, à la vraie souris et au vrai clavier ; un `.docx` de deux paragraphes écrit dans l'essai, sans fichier binaire dans le dépôt) :
- le sous-menu liste les quatre formats puis le PDF ; Word n'est pas grisé (aucune extension à cocher), dit « Document » et prend la couleur du document ;
- le sélecteur propose exactement `.docx,.docm,.dotx,.dotm`, un seul fichier ;
- **l'app déjà ouverte** (appel `ouvrir`) : ta question « Modifications non enregistrées » se pose dans le panneau quand le document précédent est sans nom ; « Ne pas enregistrer » montre le document du fichier (ses deux paragraphes), sans nom ni modèle courant, avec « Word importé. Nommez le modèle puis enregistrez-le. » ; ton cadre n'est pas rechargé, GFS ne dit rien, l'explorateur se ferme ;
- **GFS repart, l'app fermée** : le Word part avec l'ouverture du contexte (`importation: { valeur: 'word', fichier }`) et remplace le ★, sans nom ;
- un fichier illisible (`faux.xlsx`) laisse le document Word en place, ta phrase d'erreur est dite, sans question ;
- rien n'est écrit dans le document pendant toute la passe ; aucun avertissement de GFS ni erreur de page ; **40 vérifications en français clair, anglais sombre, français sombre et anglais clair, aucune en échec** (33 avant le Word).

**3. Pas mesuré** : Firefox (le sélecteur de fichier du navigateur et le rendu du sous-menu) ; un vrai fichier de Microsoft Word (celui de l'essai est minimal, écrit à la main) ; un `.docm` ou `.dotm` avec macros ; le Grist de la DINUM. Ta propre ligne « Importer un Word… » du menu « + » dans le sous-cadre de GFS reste non mesurée (consigne 059) ; ce chemin-ci n'en dépend pas, le sélecteur est celui de GFS.

## Pourquoi

Le porteur voulait retrouver dans l'explorateur ce que ton menu « + » offre seule ; ton code recevait déjà `word` depuis `187464a`. Une valeur déclarée et mesurée avec ton app publiée ferme le circuit, comme pour « joindre ».

## Fait quand

`GFS-ETAT.md` donne « 061 · lue » : rien d'autre, aucun code. Si l'essai du porteur (Firefox, un vrai Word) voit autre chose que ce rejeu, écris-le dans « Questions pour GFS » avec le fichier et le rapport reçu.
