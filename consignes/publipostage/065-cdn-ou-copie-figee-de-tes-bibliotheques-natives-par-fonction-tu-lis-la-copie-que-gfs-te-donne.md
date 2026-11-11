# 065 · Le choix « CDN ou copie figée » de tes bibliothèques natives : tu les ranges par fonction et tu lis la copie que GFS te donne (demande du porteur)

App : Publipostage+ · posée le 11/11/2026 · remplace rien · cahier 2 (décisions du 11/11), contrats 2.6 (point 14) et 5.2 (point 12), kit 0.18.0
quand : après ta liste unique (063 et 064), une fonction après l'autre, sans urgence ; **l'éditeur (TipTap) n'est pas dans cette consigne** (le porteur n'a pas encore choisi où loge sa copie)

## Quoi

**Ce que le porteur a décidé** (10/11 : « pour chaque [bibliothèque] on propose via CDN ou via copie figée, au choix dans le menu app, y compris pour Publipostage+ » ; 11/11, deux choix) : dans la fenêtre « Apps et extensions » de GFS, la personne choisit, pour ton app, **CDN (le défaut) ou copie figée**, **fonction par fonction** (Export PDF, Export Word…), avec un raccourci « toutes ». **La copie figée est chez GFS** (`vendor/`, comme celle de Plotly), pas dans ton dépôt : ta liste unique (063) reste la seule liste de tes bibliothèques, ton CDN reste le tien.

**Ce que GFS a déjà fait** : une copie de chacune de tes neuf bibliothèques natives, tirée de npm à la version de la liste que la 063 te donne (docx 9.15.1, docx-charts 9.15.1, exceljs 4.4.0, jszip 3.10.1, marked 15.0.12, pdf-lib 1.17.1, pdfmake 0.2.7, pdfmake-polices 0.2.7, qrcode-generator 1.4.4), avec leur empreinte et leurs licences ; la fenêtre ; l'événement et le contexte ; `GfsLink.native(id)` dans le kit 0.18.0. **Si tu montes l'une de ces versions** (Dependabot de ta liste), dis-le dans « Changements qui touchent GFS » de ta page d'état : GFS refait sa copie dans le lot qui lit ta demande ; entre-temps, c'est la comparaison de version ci-dessous qui te garde au CDN.

**Ce que tu fais, dans cet ordre :**

1. **Ranger tes bibliothèques par fonction** : une fonction est ce que ton code charge **ensemble, au même geste**, tout ou rien (pdfmake sans ses polices ne marche pas). Chaque bibliothèque n'est que dans une fonction. Proposition de GFS d'après ta liste, que tu corriges (tu sais ce que ton code charge et quand) : **Export PDF** = pdfmake, pdfmake-polices, jszip ; **Export Word** = docx, docx-charts ; **Export Excel** = exceljs ; **Divers** = pdf-lib, marked, qrcode-generator. Écris-le dans « Demandes à GFS » de ta page d'état : l'id de chaque fonction, son nom en français et en anglais (ce que la personne lira), ses bibliothèques. GFS le déclare alors dans son manifeste de ton app (`natives`, contrats 2.2) et la fenêtre propose le choix : **GFS ne le déclare pas avant que tu aies dit que ton code le lit**, pour ne pas montrer un choix sans effet.
2. **Avancer ta référence du kit à la 0.18.0** (un commit à part, relu) et **lire `GfsLink.native(id)`** au moment où ton code charge chaque bibliothèque d'une fonction : `{ version, src, integrite, forme }` quand la personne a mis cette fonction en copie figée, `null` sinon (et seule, hors de GFS : `null`).
3. **Décider fonction par fonction, tout ou rien** : si **chaque** bibliothèque de la fonction a un `native(id)` dont la `version` est **égale à celle de ta liste**, charge la copie par `src` (`<script src integrity crossorigin="anonymous">`, `integrite` telle que GFS la donne) ; sinon charge **tout par ton CDN**, celui que ta CSP nomme déjà. **GFS ne te donne jamais l'adresse d'un CDN pour tes natives** : ta CSP ne change pas, la copie de GFS passe par `script-src 'self'` (mesuré, ci-dessous). Un chargement de la copie qui échoue (réseau, empreinte) retombe sur ton CDN et le dit dans ton coin d'état, jamais muet (contrats 5.2, point 5).
4. **Un changement de choix en cours de route** (`onExtensions`) : une bibliothèque déjà chargée reste ; le nouveau choix vaut au prochain chargement de la fonction. Pas de rechargement de l'app.
5. **Un essai par fonction** qui prouve les deux chemins : copie (`version` égale) et CDN (`null` ou version différente), avec une fausse empreinte refusée par le navigateur.

**Ce que GFS a mesuré** (faits vérifiés 93, `labo/run-natives.mjs`, vrai Grist, ton `ac9b86d` ouverte dans son sous-cadre isolé, le manifeste d'essai déclarant les quatre fonctions ci-dessus) : le geste sur Word écrit `natif:word` dans la table de GFS ; ton cadre reçoit l'événement `extensions` avec `natives: { docx, docx-charts }` (version, adresse de GFS, empreinte, jamais jsDelivr) et `contexte` redemandé rend les mêmes ; une balise `<script integrity>` posée dans ton cadre sur cette adresse charge (`window.docx` existe) sous ta CSP actuelle, la même adresse avec une fausse empreinte est refusée ; le retour au CDN envoie `natives: {}`. **Pas mesuré** : ton code qui les lit (il n'existe pas encore).

## Pourquoi

Le porteur veut pouvoir fermer le réseau d'un client bibliothèque par bibliothèque, sans que le CDN cesse d'être le défaut (« pas tout vendoriser » tient). Avec la copie chez GFS, ta liste reste la seule source de tes versions et ton dépôt ne grossit pas de 5 Mo ; la comparaison de `version` règle le seul risque (une copie en retard de GFS) : tu ne charges jamais une version que ta liste n'a pas.

## Fait quand

`GFS-ETAT.md` donne « 065 · lue ». Puis, dans « Demandes à GFS » : tes fonctions (id, noms, bibliothèques). Puis ton code : `native` lu, comparaison de version, un essai par fonction, et « 065 · faite » avec le commit. GFS déclare alors tes fonctions, rejoue sa mesure avec ton app à jour, et avance ta référence.
