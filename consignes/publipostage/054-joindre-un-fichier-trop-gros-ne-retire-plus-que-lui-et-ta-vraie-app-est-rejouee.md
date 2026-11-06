# 054 · « joindre » : un fichier trop gros ne retire plus que lui du lot, et ta vraie app est rejouée dans un vrai Grist (réponse à ta question sur la 053 ; rien à changer)

App : Publipostage+ · posée le 06/11/2026 · quand : à lire maintenant ; aucun code à changer ; la levée de ton grisé reste à ta « 053 · faite » ; contrats 5.4 (point 12) ; suite de ta question « Suite, l'arrêt du lot quand un envoi est refusé (06/11) » (« Questions pour GFS ») et de la 053 ; vaut dans GFS seulement

## Quoi

**1. Ta question : oui.** Un `trop-gros` ne retire plus que son fichier du lot. GFS envoie les fichiers un à un : un 413 désigne le fichier refusé, GFS ne peut pas se tromper de fichier. Ce qui est écrit au contrat (5.4, point 12) et livré dans GFS :
- `trop-gros` est **un échec de ce fichier** : une entrée de `echecs` (`raison: 'trop-gros'`), les fichiers suivants sont envoyés, ceux d'avant et d'après sont joints dans le même lot ; `probleme` reste `null` ;
- `refus`, `injoignable` et `echec` arrêtent toujours le lot, comme la 053 le disait : ils valent pour tout le lot ;
- si tous les fichiers sont trop gros, `echecs` les cite tous et `probleme` reste `null`, rien n'est écrit.

**Ce que ton code fait déjà de cette réponse, sans rien changer** (lu à `c850c89`, `js/row-attachment.js`) : chaque `echecs` passe par `problemOfGfs` (`trop-gros` devient `tooLarge`), les `joints` sont comptés, et ton `problem` ne se pose que quand rien n'est joint (`reasons.size === 1`) : un PDF trop gros au milieu de trois te rend `problem: null`, `failed = [{ index, reason: 'tooLarge' }]` et les deux autres joints ; deux fichiers trop gros sur deux te rendent `problem: 'tooLarge'`. C'est exactement ton chemin « app seule ». Tu peux garder ta phrase de la 053 sur l'écart (2) en la corrigeant : l'écart ne vaut plus que pour `refus`, `injoignable` et `echec`.

**2. Ta vraie app a été rejouée dans un vrai Grist** (Grist 1.7.19 officiel, Chromium, français clair et anglais sombre ; `labo/run-joindre-publipostage.mjs` ; faits vérifiés 54 ; **19 vérifications chacune, aucun échec**). C'est ton `RowAttachment.attachAll` à `c850c89`, appelé comme l'export l'appelle (`{ index, rowId, name, blob }`), à travers GFS. Pour cet essai seulement (rien de publié ne change) : GFS a déclaré `actions.joindre: ["pdf"]` au manifeste, ta constante `GFS_ATTACH_WIRED` est passée à vrai, et l'essai a donné lui-même la colonne à ton code. Ce que ton code a reçu :
- **deux PDF sur deux lignes** : rapport sans problème, deux `attached`, **une seule** progression (un lot) ; chaque cellule cite sa pièce jointe, la ligne 3 n'a pas bougé ; les octets que Grist garde ont l'empreinte de ton PDF, type PDF ;
- **le même nom une seconde fois** : `replaced: 1`, la cellule ne cite que la nouvelle pièce (l'ancienne reste dans la liste du document) ;
- **une ligne qui n'existe pas** : `failed = [{ index, reason: 'row' }]`, l'autre PDF est joint, `problem` null ;
- **un PDF trop gros au milieu de trois** : voir plus haut, les lignes 1 et 3 gagnent chacune une pièce, la ligne 2 n'a pas bougé ; **tous trop gros** : `problem: 'tooLarge'`, rien d'écrit ;
- **le réseau tombe** : `problem: 'unreachable'`, rien d'écrit ;
- **le témoin** : sans la levée (`GFS_ATTACH_WIRED` faux), ta case est grisée (`offReason` rend `gfs`) et `attachAll` rend null, le document ne gagne rien.

**Pas mesuré** : l'export complet de ton app (pdfmake n'est pas dans le miroir des bibliothèques du cloud d'essai : les PDF sont ceux d'un générateur d'essai, pas les tiens) ; le menu « Exporter » et le panneau de Réglages sous GFS ; Firefox ; le Grist de la DINUM du porteur. Si tu veux attendre un essai dans ce Grist avant de lever ton grisé (ton commentaire de `GFS_ATTACH_WIRED` le dit), dis-le dans ta page : GFS n'y a pas accès.

**3. Rappel de ce qui reste à toi** : où garder la colonne et le mode sous GFS (053, point 6), puis ta « 053 · faite » : GFS déclare alors `actions.joindre: ["pdf"]` et rejoue ta vraie app une dernière fois sans aucun remplacement.

## Pourquoi

Tu l'avais demandé : la différence entre ton chemin seul et celui de GFS ne devait pas faire perdre à la personne les PDF d'après un fichier trop gros. GFS a décidé le 06/11 (nuit) de le changer de son côté plutôt que d'ajouter un cas chez toi. Le rejeu dit que le chemin entier marche dans un vrai Grist, pour que tu lèves ton grisé en sachant ce que ton code recevra.

## Fait quand

`GFS-ETAT.md` donne « 054 · lue » : rien d'autre, aucun code. Si ton essai de ta 053 voit autre chose que ce que ce rejeu a mesuré (un rapport différent, une progression qui manque, un mot de problème absent), dis-le dans « Questions pour GFS » avec le rapport reçu.
