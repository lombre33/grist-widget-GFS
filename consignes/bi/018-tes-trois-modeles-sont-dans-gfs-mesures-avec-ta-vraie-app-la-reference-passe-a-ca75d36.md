# 018 · Tes trois modèles de rapport sont dans GFS, mesurés avec ta vraie app ; ExcelJS est lu ; la référence passe à `ca75d36` ; deux lectures que GFS refuse

App : Grist-BI · posée le 18/11/2026 · remplace rien · réponse à ta page `ca75d36` (lignes 014, 015, 016, 017, « vitrine », « modeles », « exceljs » et « pdfjs ») · contrats 2.2 (`vitrine`, `modeles`), 3.3 point 2, 5.2 point 3, 5.4 point 13, guide des apps point 23
quand : à lire au prochain lot, sans urgence ; aucun code à changer (deux demandes possibles, plus bas) ; vaut dans GFS seulement

## Quoi

**1. Tes trois modèles sont dans la galerie de GFS** : `modeles/bi/` chez GFS reprend ton `modeles.json` (trois entrées de type `rapport`, sans `tables`) et tes trois vignettes tels que tu les as posés à `cf889aa`, et ton manifeste déclare `modeles` et `ouverture.modele`. La pastille « Grist-BI » de « Nouveau > Depuis un modèle… » dit 3.

**2. Mesuré avec ta vraie app** (la copie que GFS référence, à `ca75d36`, avec ECharts 6.1.0), dans un vrai Grist (grist-static, 700 × 400, à la vraie souris, `labo/run-modeles-bi.mjs`) : « Créer » sur « Vue d'ensemble » démarre l'app sur un rapport non enregistré (trois tuiles, graphiques dessinés) sur la table du document, **sans rien écrire** ; l'app déjà ouverte reçoit « Répartition par catégorie » dans le même cadre (non rechargé) et le rapport change ; « Évolution dans le temps » sur un document sans colonne de dates est refusé par ta fenêtre (« il lui faut une colonne de dates ») et le rapport en cours reste, sans phrase de GFS. Ce que tu n'avais pas pu jouer (« rien n'a été joué dans le vrai GFS ») l'est donc. Tes vignettes et tes captures prises avec le faux `window.grist` sont gardées telles quelles.

**3. Ta vitrine refaite est chez GFS** : tes trois images sont remplacées sous les mêmes noms (`1.webp` 48 692, `2.webp` 47 250, `3.webp` 56 654 octets) et les légendes 1 et 3 redéclarées, la description inchangée.

**4. ExcelJS 4.4.0 est lu** (ta 017 : SheetJS 0.18.5 remplacé) : c'est bien **le même fichier** que celui du catalogue de GFS (octet pour octet, même `sha384-Pqp51FUN2/…`). Sa copie reste dans ton dépôt, chargée au premier export depuis la même origine : GFS ne la sert pas à ta place, ta politique de sécurité et ta carte d'importation ne changent pas, rien à ajouter chez GFS. Ton constat sur `allow-downloads` est juste (`prototype/js/broker/frames.js`) ; **l'export Excel dans GFS n'est pas rejoué** (à jouer à la main dans un vrai GFS : un clic sur l'export doit télécharger un `.xlsx`).

**5. La référence de GFS passe de `d72f613` à `ca75d36`** (90 commits, un commit à part, relu) : `index.html` ne change que des scripts, des `aria-label` et un commentaire, aucune adresse, aucune politique de contenu ; ECharts 6.1.0 en copie dans `js/vendor/` ; ExcelJS à la place de SheetJS. Deux lectures de plus que GFS ne lit pas comme tu les écris :

- **`_grist_DocInfo` est refusée.** Ton `readColumnFormats` lit `documentSettings` (langue et devise du document) pour « Format des nombres : comme dans la colonne » ; ton manifeste dans GFS déclare `_grist_Tables` et `_grist_Tables_column`, pas `_grist_DocInfo` : le courtier refuse (`GFS_REFUSE`, un avertissement par lecture, mesuré dans le labo) et ton code retombe sur « Automatique » pour la devise et la langue du document, comme il le prévoit. Si tu veux cette lecture dans GFS, **demande-la dans « Demandes à GFS »** avec ce qu'elle sert à faire (Publipostage+ la déclare pour la même raison : connaître la langue et la devise du document pour écrire un nombre ou une date comme sa colonne) ; GFS la déclarera à ce moment-là.
- **`ModifyColumn` est refusé** (ta table-sonde, ton repli sur la saisie à la main) : la liste des verbes du courtier est fermée (contrats 3.3, point 2). Si le repli te convient, rien à faire ; sinon dis-le aussi dans « Demandes à GFS ».

**6. Tes 014 à 017 passent dans l'index** : 014 « faite » (déjà), 015 « faite · lue », 016 « faite » (`cf889aa`), 017 « faite » (`8584515`, ExcelJS à la place de SheetJS). Tes demandes `d3-cloud` 2.0.0 et `pdfjs` (refaite le 18/11 sous la forme module que GFS porte) attendent toujours le mot du porteur : déclarer une extension de Grist-BI qui prend `pdfjs` est une fonction nouvelle.

## Pourquoi

La galerie ne montre que les fichiers que GFS range lui-même, et le manifeste dit ce que ton app ouvre et lit. Le reste est la lecture de tes commits, que GFS fait à chaque relecture.

## Fait quand

`GFS-ETAT.md` dit « 018 · lue » (aucun code à changer) ; tes demandes `vitrine`, `modeles` et `exceljs` peuvent sortir de « Demandes à GFS ». Si tu veux `_grist_DocInfo`, la demande vient dans cette section.
