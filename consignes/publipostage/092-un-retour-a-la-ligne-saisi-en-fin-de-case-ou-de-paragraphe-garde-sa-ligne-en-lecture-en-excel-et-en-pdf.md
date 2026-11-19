# 092 · Un retour à la ligne saisi (Maj+Entrée) à la fin d'une case ou d'un paragraphe : l'éditeur et Word gardent sa ligne vide, la Lecture, l'export Excel/ODS et le PDF la perdent

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · retour du porteur du 19/11 (« les sauts de ligne en mode grille ne sont pas conservés en lecture et à l'export ; des retours à la ligne faits à la main, en dur dans le modèle, avec Maj+Entrée ») · complète la 091 · rien à changer dans GFS
quand : à lire au prochain lot ; cause trouvée dans quatre fonctions, correction essayée dans une copie (diff fourni) ; vaut dans GFS et seule

## Quoi

La 091 traite les retours d'une **valeur** de la table. Celle-ci traite ceux que la personne **tape** dans le modèle (Maj+Entrée, un `<br>`), le cas décrit par le porteur après la 091.

GFS les a mesurés partout (clone de `6fd6eec`, Chromium sans écran, une grille de deux colonnes puis des paragraphes). Un retour saisi **au milieu** d'un texte, doublé, avant ou après une bulle, dans une case fusionnée, sous une marque (gras, italique) ou dans une case centrée est gardé par l'éditeur, la Lecture, Excel, ODS, Word et le PDF : rien à corriger là. **Un seul cas se perd : le retour qui termine la case ou le paragraphe**, celui qu'on laisse pour réserver de la place, ou qu'un Word importé apporte en fin de case.

| retours saisis en fin de case | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| éditeur (hauteur de la ligne de la grille) | 25 px | 43 | 61 | 78 |
| Lecture, aujourd'hui | 24 | **24** | **40** | **57** |
| Excel, texte de la case | « A » | « B » | « C » | « D » : les `\n` de fin sont retirés |
| Excel, hauteur de la ligne | 21,75 | **21,75** | **36,5** | **51,5** |
| PDF, écart avec la ligne suivante | 22 px | **21** | **37** | **51** |
| Word (`w:br` écrits) | 0 | 1 | 2 | 3 |

Autrement dit : l'éditeur montre n + 1 lignes, la Lecture, Excel et le PDF en montrent n (une de moins que ce que la personne voit), Word en montre n + 1. Dans un **document** (paragraphes, hors grille) c'est pire en PDF : deux paragraphes finissant par 1 et 2 retours font 34 et 50 px dans l'éditeur, 16 et 33 en Lecture, et le PDF les écrit **sans aucune ligne vide** (15 et 14 pt d'écart avec le paragraphe suivant, comme un paragraphe ordinaire).

Les quatre causes :

- **Lecture** (`js/reader-mode.js`, `keepBlankLines`) : un navigateur n'ouvre aucune ligne après un `<br>` qui termine un bloc ; l'éditeur le fait parce que ProseMirror y ajoute un `<br>` de fin, qui n'est pas dans `Editor.getHTML()`. `keepBlankLines` ne remplit que les blocs **vides**.
- **Excel et ODS** (`js/xlsx-export.js`) : `createLineBuilder().dropTrailingEmptyLines()` retire toutes les lignes vides de la fin, y compris celles que `lineBreak()` vient d'ouvrir pour un `<br>` saisi ; et la hauteur de ligne vient d'un hôte de mesure (`addRecordSheet` → `ExportCommon.attachMeasureHost`) où le `<br>` de fin n'ouvre pas de ligne non plus.
- **PDF** (`js/pdf-export.js`) : `trimEdgeWhitespace` retire les `\n` de fin des runs d'un paragraphe (`ordinaryBlocks`), et pdfmake n'ouvre pas de ligne après un `\n` final ; la hauteur d'une ligne de grille vient de l'hôte de mesure, où `insertTrailingBreaksForEmptyBlocks` ne remplit que les blocs vides.
- **Word** (`js/docx-export.js`) : rien, le `<br>` de fin donne son `w:br`.

Correction essayée dans une copie (hors de ton dépôt), sur le même banc : le diff complet est dans les fichiers du projet GFS (`gfs/outils-pp/correction-proposee-retour-de-fin.diff`, 39 lignes ajoutées sur quatre fichiers, à relire, pas à appliquer à l'aveugle). L'idée, par cause :

- **Lecture** : `keepBlankLines` ajoute son `<br class="pp-blank-line">` aussi à un bloc dont le dernier enfant est un `<br>` (hors `ProseMirror-trailingBreak`) : n retours font n lignes vides, comme l'éditeur.
- **Mesure** : une fonction commune dans `js/export-common.js` (`fillTrailingBreaks(root)`, à côté de `fillEmptyBlocks`) ajoute après un `<br>` de fin un `<br data-measure-filler>` que la mesure compte et que personne n'écrit ; `addRecordSheet` l'appelle avant `attachMeasureHost`, `insertTrailingBreaksForEmptyBlocks` du PDF aussi ; `visitText`/`visit` d'Excel et `leafRuns` du PDF l'ignorent (comme ils ignorent déjà `data-pdf-measure-filler`).
- **Excel** : `createLineBuilder` retient le nombre de lignes à garder (`kept = lines.length` à chaque `lineBreak()`) et `dropTrailingEmptyLines` ne retire pas en dessous.
- **PDF, paragraphes** : `ordinaryBlocks` compte les `\n` de fin avant `trimEdgeWhitespace`, puis ajoute un run `'\n'.repeat(n) + ' '` (espace insécable) qui rend les n lignes.

Résultat mesuré sur la copie, mêmes cas : Lecture 24 / 40 / 57 / 73 px (éditeur 25 / 43 / 61 / 78), Excel « B\n », « C\n\n », « D\n\n\n » avec des lignes de 21,75 / 36,5 / 51,5 / 66,5, PDF des écarts de 22 / 36 / 52 / 66 px, et en document 15 / 29 / 45 pt entre les paragraphes. Word ne bouge pas.

**Ce que GFS n'a pas fait, à toi :** passer la suite de tes essais sur la copie (GFS n'a joué que le banc ci-dessus) ; et regarder deux points : (1) un `\n` qui sépare deux blocs ne doit pas compter comme un retour saisi : `trimKeepingTrailingBreaks` regarde les runs d'un seul bloc, mais un élément de liste dont le dernier paragraphe est vide pourrait gagner une ligne ; (2) l'espace insécable de fin en PDF (la police, le glyphe) ; si tu as mieux, prends-le. **Ce que GFS n'a pas mesuré** : si l'import d'un Word (`js/docx-import.js`) donne ce `<br>` de fin pour un `w:br` qui termine un paragraphe ; dis-le dans « Questions » de `GFS-ETAT.md` si tu le sais.

**Le porteur n'a pas encore confirmé** que ses retours à la ligne sont ceux de fin de case : s'il dit non, cette consigne reste une correction vraie (l'éditeur et les exports se contredisent) mais n'explique pas ce qu'il a vu, et GFS reviendra avec lui.

## Pourquoi

Une case de grille ou un paragraphe qui finit par un retour réserve une place : la personne la voit dans l'éditeur (et dans Word), et la Lecture, le classeur et le PDF la rendent plus courte, parfois d'une ligne qui change l'emplacement du texte suivant. Un document, c'est ce qui sort ; l'éditeur ne doit pas promettre ce que la sortie ne tient pas.

## Fait quand

1. Un ou plusieurs retours saisis à la fin d'une case de grille ou d'un paragraphe gardent chacun leur ligne vide en Lecture, dans le texte et la hauteur de ligne d'Excel et d'ODS, et dans le PDF (grille et document), comme dans l'éditeur et dans Word.
2. Rien ne change pour un bloc sans retour de fin, un bloc vide, un retour au milieu d'un texte, ni pour la 091 (valeur à plusieurs lignes).
3. L'essai (grille et document, 0, 1, 2 et 3 retours de fin) échoue sur l'ancien code, en Lecture, en Excel (texte et hauteur) et en PDF.
