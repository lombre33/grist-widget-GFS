# 085 · Tes sept fonctions natives sont déclarées dans GFS et mesurées avec ta vraie app, ta section de bibliothèques est prise, GFS lit tes noms anglais ; la référence passe à `a6465c1`

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · remplace rien · réponse à ta page `GFS-ETAT.md` (« Changements qui touchent GFS », « Bibliothèques que l'app charge elle-même », « Demandes à GFS ») et aux consignes 065, 076 à 081 · contrats 2.6 (point 14), 5.2 (point 12) · faits vérifiés 139
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement ; décision du porteur du 18/11 (« ne laisse pas de chantier en attente »)

## Quoi

**1. Ta 065 est prise : GFS déclare tes sept fonctions natives** (`natives` du manifeste de l'app) : *Export PDF* (pdfmake et ses polices 0.2.7), *Assemblage de PDF* (pdf-lib 1.17.1), *Archives ZIP* (JSZip 3.10.1), *Word et graphiques* (docx et docx-charts 9.15.1), *Export Excel* (ExcelJS 4.4.0), *Import Markdown* (marked 15.0.12) et *QR code* (qrcode-generator 1.4.4), plus l'éditeur (TipTap, « copie dans l'app », 615 704 octets). La fenêtre « Dépendances » offre pour chacune le choix « CDN ou copie figée » que la personne fait ; GFS te le dit par `GfsLink.native(id)` et tu l'annonces par `pp:nativeFallback` quand ta copie ou ton CDN manque.

**Mesuré avec ta vraie app** (`a6465c1`), dans un vrai Grist, 700 × 400, à la vraie souris (`labo/run-natives.mjs`, 28 vérifications sur 28) : la copie de GFS se charge pour ses sept fonctions avec son empreinte ; une fausse empreinte rend `echec` et une version qui n'est pas celle déclarée rend `ecart`, tous deux annoncés par ton `pp:nativeFallback`, sans rien casser. **Non mesuré** : le chemin « CDN » (le cloud de GFS n'atteint pas ces CDN) ; il est celui d'aujourd'hui.

**2. Tes noms anglais : mesuré, et une chose à savoir.** GFS lit tes deux jeux de noms (la 080) et une personne dont le document est né dans GFS reçoit des tables et colonnes en anglais (`labo/run-pp-noms-anglais-reel.mjs`, 35 vérifications sur 35, avec ta vraie app). **Mais dans GFS ton app ne renomme jamais un document existant** : `migrate()` rend `null` quand `isHostedByGfs()` (`js/schema-columns.js`), parce que le courtier de GFS refuse `RenameColumn` et `ModifyColumn` ; GFS le garde comme tel (« additif seulement », contrat de données). Le renommage a donc lieu à la première ouverture **hors de GFS**, et un même document passe indifféremment de l'un à l'autre. Rien à changer chez toi ; GFS ne te demande pas de renommer dans son cadre.

**3. Ta section de bibliothèques est prise** (la 081), ligne par ligne, dans « Dépendances › Portées par l'app » : TipTap (esm.sh), l'API de Grist, pdfmake, **les polices du PDF** (`polices-pdf`, ton site), pdf-lib, JSZip, **docx sur `cdn.jsdelivr.net`**, ExcelJS, marked, qrcode-generator, **les polices libres** (jsDelivr) et **Marianne** 1.15.4. Ta ligne « kit » n'est pas montrée : le kit est celui de GFS, servi avec ton site. Le poids du graphique passe de 189 à 205 Ko dans le manifeste (ta mesure du commit `a3bd181`).

**4. La référence de GFS passe de `b32f450` à `a6465c1`** (un commit à part, relu : 13 commits, 82 fichiers). Rien de neuf dans les adresses que ta page appelle ni dans les bibliothèques qu'elle charge, hors celles que tu as dites dans ta section. **Ce qui reste à la consigne de sécurité** (083 et 084) : tes `data:` et `blob:` dans `connect-src` (S3), la ligne S8 « tenue » ; GFS ne les juge pas ici. Le kit que GFS sert est à 0.27.0 (`ed0a575`) : le lien retient l'origine de GFS après son premier message (faits vérifiés 138) ; ta copie du kit avance quand tu le décides, sans urgence.

**5. Tes consignes à « faite »** dans l'index : la 065, les 077 à 081. Pour la 077 (versions plus récentes de six bibliothèques), la montée de chacune se dira dans ton « Changements qui touchent GFS » quand tu la fais ; GFS réécrira alors sa copie.

## Pourquoi

Le porteur ne veut pas de chantier en attente : ce qui dépendait de GFS pour tes fonctions natives et ta section de bibliothèques est fini et mesuré. Le point 2 est une surprise que les mesures ont montrée : mieux vaut que tu la connaisses avant qu'une personne la rencontre.

## Fait quand

`GFS-ETAT.md` dit « 085 · lue » (aucun code à changer). Si ton `migrate()` doit pouvoir renommer dans GFS un jour, c'est une demande à GFS (verbe `RenameColumn` ou `ModifyColumn`), pas un manque de ta part.
