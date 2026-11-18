# 017 · SheetJS 0.18.5 a deux avis de sécurité publiés : passe à la dernière version

App : Grist-BI · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« pour les failles relevées, passe-leur la consigne de basculer la dernière version ») · quand : au prochain lot, avant le reste ; du code dans ton app (un fichier remplacé) ; vaut aussi dans l'app seule

## Quoi

**1. SheetJS (`js/vendor/xlsx/xlsx.full.min.js`, version 0.18.5, ton export Excel) : remplace-le par la dernière version que publie SheetJS.** La base d'avis de npm (interrogée le 18/11) lui donne deux avis de niveau haut :

- pollution de prototype, [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), versions avant 0.19.3 ;
- déni de service par expression régulière, [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (CVE-2024-22363), versions avant 0.20.2.

Les versions corrigées **ne sont pas sur npm** (le paquet y reste en 0.18.5) : SheetJS les publie sur `cdn.sheetjs.com` (GFS n'y accède pas depuis le cloud, c'est donc à toi de relever la dernière). Prends-en l'archive, garde le même nom de fichier et le même emplacement, remets sa licence (Apache-2.0) à côté et écris la version dans ton `GFS-ETAT.md`. Rien d'autre ne change : la page charge toujours le fichier de ton dépôt, sur sa propre origine, aucune adresse nouvelle.

**2. Si changer de fichier te paraît plus lourd que changer de bibliothèque** (ExcelJS 4.4.0, sans aucun avis publié, est celle que GFS sert déjà à Publipostage+ ; ton export n'écrit que des `.xlsx`), **ne choisis pas en silence** : dis-le dans ta page d'état, le porteur tranche.

**3. Tes essais de l'export Excel** passent avec le nouveau fichier (un classeur exporté s'ouvre, les cellules et les types sont ceux d'avant).

Ce que cette consigne **ne** demande **pas** :

- **ECharts** : sa montée en 6.1.0 est déjà en cours chez toi (porteur, 18/11) ; rien à ajouter. La 5.6.0 a un avis de niveau moyen (XSS, [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)), corrigé en 6.1.0 : une raison de plus de l'achever.
- **pdfmake** (0.2.7, aujourd'hui la même version que Publipostage+) : la dernière publiée est la 0.3.14, une refonte de l'interface. Aucun avis de sécurité sur la 0.2.7 : ne la monte pas seule et pas sans lire le guide de la 0.3 ; si tu l'étudies, dis-le dans ta page d'état.
- **PptxGenJS** (4.0.1) et **d3-cloud** (2.0.0) sont à jour ; **DuckDB-WASM** 1.32.0 : le registre ne publie qu'une version de développement plus récente, rien à faire.

## Pourquoi

GFS a relevé le 18/11 les avis de sécurité publiés pour toutes les versions de bibliothèques qu'il sert ou que les apps déclarent (étude « Dépendances », fenêtre prévue dans les réglages de GFS). Deux versions de Grist-BI sont touchées ; les autres bibliothèques lues n'ont aucun avis (ce qui ne veut pas dire aucune faille : la base ne regarde pas ce qu'un fichier assemblé embarque). Ton export n'écrit que des `.xlsx` et ne relit jamais un fichier, ce qui limite l'exposition (à confirmer par toi) ; un avis publié reste un avis qu'un audit de sécurité remonte. Décision du porteur du 18/11 : GFS pose une consigne chaque fois qu'il voit une montée de version, et une consigne « avant le reste » quand elle corrige un avis.

## Fait quand

`GFS-ETAT.md` dit « 017 · faite » avec le commit et la version de SheetJS maintenant dans `js/vendor/xlsx/`, ou dit pourquoi tu proposes de changer de bibliothèque. Dis aussi où en est ECharts 6.1.0 (commit ou « en cours »), pour que GFS passe sa ligne de la fenêtre « Dépendances ».
