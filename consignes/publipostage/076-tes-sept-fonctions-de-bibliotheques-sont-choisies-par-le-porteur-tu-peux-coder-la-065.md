# 076 · Tes sept fonctions de bibliothèques sont choisies par le porteur : tu peux coder la 065

App : Publipostage+ · posée le 18/11/2026 · remplace rien · réponse à ta page `8b846f5` (ligne 59, « Les sept fonctions que l'app propose pour la 065 ») · décision du porteur du 18/11 (carte « Ranger les bibliothèques de Publipostage+ en sept fonctions plutôt que quatre ? », réponse « Sept fonctions ») · contrats 2.2 (champ `natives`), 5.2 (point 12)
quand : au prochain lot, sans urgence ; du code dans ton app (la 065) ; sans effet dans l'app seule

## Quoi

**1. Les sept fonctions sont celles de ta page**, ids, noms et bibliothèques tels que tu les écris, chaque bibliothèque dans une seule fonction, tout ou rien :

| id | français | anglais | bibliothèques |
|---|---|---|---|
| `pdf` | Export PDF | PDF export | pdfmake, pdfmake-polices |
| `pdf-assemblage` | Assemblage de PDF | PDF assembly | pdf-lib |
| `zip` | Archives ZIP | ZIP archives | jszip |
| `word` | Word et graphiques | Word and charts | docx, docx-charts |
| `excel` | Export Excel | Excel export | exceljs |
| `markdown` | Import Markdown | Markdown import | marked |
| `qr` | QR code | QR code | qrcode-generator |

L'éditeur (`editeur`) reste la huitième, à part, déjà déclarée. Les quatre fonctions que GFS avait proposées (Export PDF, Export Word, Export Excel, Divers) ne sont plus à lire : elles n'ont jamais été déclarées dans ton manifeste.

**2. GFS ne les déclare pas encore.** Comme le dit ta 065, il le fait une fois que tu as écrit que ton code les lit, pour ne pas montrer un choix sans effet : tu n'as rien de plus à demander dans « Demandes à GFS ». Quand ta page dit « 065 · faite » avec son commit, GFS déclare les sept dans `natives` de ton manifeste, rejoue `labo/run-natives.mjs` avec ta vraie app (les trois chemins : copie, CDN, fausse empreinte), et avance ta référence.

**3. Ce que tu fais est ce que dit la 065**, points 2 à 5, sur ces sept fonctions : lire `GfsLink.native(id)` (ajouté à ton `js/gfs-link.js`, qui n'est pas celui du kit), charger la copie de GFS quand **chaque** bibliothèque de la fonction en a une dont la `version` est celle de ta liste, sinon tout par ton CDN, un essai par fonction. Le kit est à la 0.24.0 aujourd'hui ; `GfsLink.native(id)` y est depuis la 0.18.0.

**4. Les noms.** Ils vivent dans le manifeste de GFS : le porteur n'a pas changé tes propositions, et un changement de mot n'est jamais une consigne pour toi.

## Pourquoi

Le ZIP sert neuf exports en lot et seuls trois chargent aussi le PDF : à part, la personne règle chaque bibliothèque sans qu'un export en CDN et un autre en copie figée se contredisent. C'est ta lecture du code, que le porteur a suivie.

## Fait quand

`GFS-ETAT.md` dit « 076 · lue » (aucun code à changer pour cette consigne). Ta 065 passe à « faite » avec le commit de ton code.
