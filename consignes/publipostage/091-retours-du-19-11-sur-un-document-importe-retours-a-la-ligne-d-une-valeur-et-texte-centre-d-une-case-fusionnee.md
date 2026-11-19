# 091 · Retours du 19/11 sur un document importé : les retours à la ligne d'une valeur Grist se perdent à l'export Excel, ODS et Word ; le texte centré d'une case fusionnée reste collé à droite après un import Word

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · retours du porteur du 19/11 sur un document importé d'un Word · rien à changer dans GFS (mesuré : voir le point 2)
quand : à lire au prochain lot ; point 1 : cause trouvée et correction essayée, quelques lignes et des essais ; point 2 : cause pas encore trouvée, à mesurer sur le fichier du porteur ; vaut dans GFS et seule

## Quoi

### 1. Les retours à la ligne d'une valeur Grist à plusieurs lignes se perdent à l'export Excel, ODS et Word

Le porteur : « en mode grille, les sauts de ligne au sein d'une cellule ne sont pas conservés en lecture et à l'export ».

Mesuré sur ta page seule (clone de `6fd6eec`, Chromium sans écran, une grille de deux cases dont l'une porte `#Adresse`, la valeur de la ligne étant « 12 rue X⏎75000 Paris »), en comparant un retour **saisi** (Maj+Entrée, un `<br>`) et une **valeur** qui contient un saut de ligne :

| | retour saisi (`<br>`) | valeur à deux lignes |
|---|---|---|
| éditeur, HTML résolu | gardé | gardé |
| Lecture | gardé | gardé (`white-space: break-spaces` de `.reader-content`) |
| PDF | gardé (deux lignes) | gardé (deux lignes) |
| Excel | gardé (`\n` dans la chaîne, `wrapText`) | **perdu** : « 12 rue X 75000 Paris » |
| ODS | comme Excel | **perdu**, par le même chemin |
| Word | gardé (`w:br`) | **perdu** : `\n` écrit dans `<w:t>`, que Word lit comme une espace ; vaut aussi dans un document, hors grille |

La cause, dans deux fichiers :

- `js/xlsx-export.js`, `readCellContent` → `visitText` : `node.nodeValue.replace(/\r\n?|\n/g, ' ')` change tout saut de ligne d'un texte en espace. Seul un `<br>` passe par `out.lineBreak()`. `js/ods-export.js` passe par `XlsxExport.recordAppender` : il hérite du même défaut.
- `js/docx-export.js` : `valueRuns` (la valeur d'une bulle) et le nœud texte de `inlineNodesFrom` font `textRun(texte)` d'un seul bloc ; `tabbed` ne connaît que la tabulation.

La Lecture, le PDF et l'export HTML rendent déjà ces sauts (`white-space: break-spaces`, le texte `\n` de pdfmake) : les exports Excel, ODS et Word doivent faire pareil, puisque pour eux un `\n` dans un texte du HTML résolu est une vraie ligne (un blanc entre deux blocs, lui, reste écarté par la garde qui existe déjà).

Correction essayée dans une copie (hors de ton dépôt) : Excel donne « 12 rue X⏎75000 Paris » avec `wrapText`, Word donne deux séries séparées par `<w:br/>` ; le PDF et la Lecture ne bougent pas. Le diff complet est dans les fichiers du projet GFS (`gfs/outils-pp/correction-proposee-retours-a-la-ligne.diff`, à relire, pas à appliquer à l'aveugle) ; l'idée tient en trois lignes :

```js
// js/xlsx-export.js, visitText : couper le texte aux sauts de ligne au lieu de les changer en espace
node.nodeValue.split(/\r\n?|\n/).forEach((piece, i) => { if (i) out.lineBreak(); if (piece) out.addText(piece, style); });

// js/docx-export.js : une série par ligne, un w:br entre elles (docx 9.15.1 n'exporte pas `Break` : c'est `new docx.TextRun({ break: 1 })`, comme ton <br>)
const textRuns = (text, style) => String(text).split(/\r\n?|\n/).flatMap((line, i) => (i ? [withEffects(new docx.TextRun(Object.assign({ break: 1 }, runOpts(style))), style)] : []).concat(line ? [textRun(line, style)] : []));
// puis `valueRuns` et le nœud texte de `inlineNodesFrom` appellent textRuns à la place de textRun
```

**Ce que GFS n'a pas reproduit : la perte en Lecture.** Dans les deux cas ci-dessus la Lecture garde les deux lignes et la case grandit (40 px pour deux lignes). Si tu as un cas où elle les perd (une valeur à `\r\n`, un format de bulle, une case de grille importée d'Excel…), dis-le dans ta section « Questions » de `GFS-ETAT.md` ; GFS le mesurera avec le porteur.

### 2. Le texte centré d'une case fusionnée reste collé à droite après un import Word

Le porteur (capture du 19/11, une « fiche navette » importée d'un Word, éditeur de Publipostage+ servi par GFS, Firefox) : dans les cases fusionnées sur les trois colonnes des lignes 1 et 4, le texte, centré d'après la barre, est tassé à droite ; le centre du texte tombe environ 75 px (ligne 1) et 120 px (ligne 4) à droite du centre de la case, alors que la ligne 2, fusionnée aussi, est bien centrée. « Scinder la case » puis « Fusionner » à la main le remet d'aplomb : « à voir pourquoi ça casse à l'import ».

Ce n'est pas GFS : la page tourne dans un sous-cadre isolé, aucun style de GFS ne touche les tableaux de ta page.

Mesuré avec le même banc (`DocxImport.fromBuffer` sur un Word fabriqué avec `DocxFixtures`, tableau de trois colonnes dont la ligne 2 est une case `gridSpan=3`, puis `TableMerge.splitCell` et `mergeCells` du vrai éditeur) :

- une case fusionnée sur trois colonnes avec `jc=center` s'importe **bien centrée** (décalage 0) ; scinder puis fusionner ne change rien ;
- ce qui décale le texte à l'import, c'est un retrait du paragraphe : `w:ind left` (devient `padding-left` / `data-indent-left`, `formatOf` dans `js/docx-import.js`), `w:ind start`, ou `w:ind firstLine` ; le texte se centre alors dans ce qui reste de la case ; mais **scinder puis fusionner ne l'enlève pas** (le paragraphe garde son retrait) ;
- un `w:bidi` ou un `w:tcW` très petit : sans effet sur le centrage (des espaces ou des tabulations en tête de texte, eux, ne sont pas mesurés : le banc les compte dans le texte).

Donc les causes simples sont écartées et celle qui décale n'est pas ce que la défusion règle : **la cause n'est pas trouvée**. Il faut le fichier du porteur. GFS ne l'a pas vu ; le porteur te le transmet (ou GFS le dépose dans les fichiers du projet et le dit au porteur).

Ce que je te demande : avec le fichier, lis sur le paragraphe de la case des lignes 1 et 4 (`data-indent-left`, `data-indent-first`, `style`) et sur la case (`colwidth`, `colspan`) ce qui décale le texte ; dis pourquoi défusionner puis refusionner le rend (le geste réécrit `colwidth` et les traits de la case : `GridEditor.splitSelected`, `mergeSelected`) ; corrige à l'import ; et ajoute l'essai (une case fusionnée sur trois colonnes, texte centré, avec les réglages de paragraphe de ce fichier). Si le fichier ne montre rien d'anormal à l'import, dis-le : GFS regardera alors le rendu sous Firefox.

## Pourquoi

Le porteur a vu les deux sur un même document importé d'un Word, le 19/11. Le point 1 touche le résultat que la personne reçoit : une adresse sur deux lignes dans Grist sort sur une seule ligne dans le classeur et le Word. Le point 2 touche la fidélité de l'import : la page importée n'est pas celle du Word, et la personne le corrige à la main case par case.

## Fait quand

1. Une valeur de colonne Texte à plusieurs lignes (`\n` comme `\r\n`) garde ses lignes dans l'export Excel (avec `wrapText`), l'export ODS et l'export Word, dans une grille et, pour Word, dans un document ; un retour saisi reste comme avant ; un blanc entre deux blocs n'ajoute pas de ligne ; l'essai échoue sur l'ancien code.
2. La cause du texte collé à droite est dite (sur le fichier du porteur), l'import la corrige, et un essai l'attrape ; ou ton `GFS-ETAT.md` dit ce que le fichier montre et pourquoi rien n'est à corriger à l'import.
