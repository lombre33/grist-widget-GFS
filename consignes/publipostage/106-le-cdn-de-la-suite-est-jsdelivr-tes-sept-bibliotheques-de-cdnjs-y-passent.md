# 106 · Le CDN de la suite est jsDelivr : tes sept bibliothèques de cdnjs y passent, cinq sans que l'empreinte change et deux avec le fichier de npm

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 25/11/2026 · décision du porteur du 25/11 (jsDelivr, secours = la copie de GFS et pas un deuxième CDN, « la migration vers le CDN retenu ») · cahier section 2 (dernière ligne) et 4.7, guide des apps 1.4 règle S5 · faits vérifiés 163, 164 et 167 · ne remplace pas la 016 (l'adresse à préfixe viendra avec le dépôt dédié, dans une autre consigne)
quand : au prochain lot, sans urgence ; du code et des fichiers générés dans ton app ; TipTap et le secours de GFS ont chacun leur consigne, après

## Quoi

**1. Ce que le porteur a décidé le 25/11** (cahier, section 2) : **jsDelivr est le CDN de la suite**, chaque fichier se vérifie de bout en bout (version exacte, empreinte prise sur l'archive npm), et le secours sera **la copie figée de GFS, pas un deuxième CDN**. Les apps qui chargent encore depuis cdnjs ou unpkg passent à jsDelivr. Le guide, règle S5, le dit désormais ainsi.

**2. Ce que GFS a mesuré** (faits vérifiés 167 : GitHub Actions, trois lectures par adresse, chaque fichier comparé à l'archive npm) :
- **jsDelivr rend les octets de l'archive npm pour 21 fichiers sur 21** ; cdnjs ne trouve que 15 adresses sur 23 et en minifie certaines lui-même.
- **Cinq de tes sept bibliothèques de cdnjs sont déjà les octets de npm** : exceljs 4.4.0 (`dist/exceljs.min.js`), jszip 3.10.1 (`dist/jszip.min.js`), marked 15.0.12 (`marked.min.js`), pdf-lib 1.17.1 (`dist/pdf-lib.min.js`) et pdfmake 0.2.7 (`build/pdfmake.min.js`). jsDelivr les rend à l'identique : **leur `integrity` ne change pas**.
- **Deux sont des variantes que cdnjs fabrique lui-même**, qu'aucun fichier de npm ne recoupe : `pdfmake/0.2.7/vfs_fonts.min.js` (ton empreinte actuelle `sha384-dWs4+zGq…`) et `qrcode-generator/1.4.4/qrcode.min.js` (`sha384-mZT2gIty…`). Chez jsDelivr, le fichier vérifiable est celui de npm : `build/vfs_fonts.js` (`sha384-go03OGrgP7enVgJF/9UK2k6D5xW+f7Vq1WHLp75VqnMN5uu+CZDXu7uGjjzZReI5`) et `qrcode.js` (`sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k`). Ce sont les deux fichiers que ton miroir des essais (`miroir.depuis`) prend déjà, et ceux que le catalogue de GFS sert lui-même : tes essais les ont donc déjà passés.

**3. Ce que tu fais** :
- **a. Dans `package.json`, section `gfs.bibliotheques`**, pour `exceljs`, `jszip`, `marked`, `pdf-lib`, `pdfmake`, `pdfmake-polices` et `qrcode-generator` : **remplace `src` (l'adresse de cdnjs) par `fichier`**, le chemin du fichier dans le paquet npm : celui que `miroir.depuis` donne déjà (`dist/exceljs.min.js`, `dist/jszip.min.js`, `marked.min.js`, `dist/pdf-lib.min.js`, `build/pdfmake.min.js`, `build/vfs_fonts.js`, `qrcode.js`), comme tes entrées `docx` et `docx-charts`. Garde `miroir` tel quel. L'outil prend alors l'adresse `https://cdn.jsdelivr.net/npm/<paquet>@<version exacte>/<fichier>` et l'empreinte sur l'archive npm.
- **b. Relance `node kit/outils/bibliotheques.mjs`** (puis `--verifier`) : il réécrit le catalogue, le `script-src` d'`index.html` (les sept adresses de cdnjs sortent, les sept de jsDelivr entrent), `js/native-libs.js` (adresses et empreintes) et le miroir des essais. Commite les fichiers produits. Si ton poste joint jsDelivr, `--verifier-cdn` compare au CDN réel : GFS l'a fait depuis GitHub, pas depuis le cloud de développement.
- **c. Tes essais** (`dev-tests/`) qui nomment les adresses de cdnjs (le routage vers le miroir, la vérification de la politique, le chargeur de bibliothèques) suivent : la même adresse chez jsDelivr, et l'essai de politique ne laisse plus passer `cdnjs.cloudflare.com`.
- **d. Ne touche à rien d'autre dans ce lot** : plotly, echarts, docx et les polices (`@fontsource`, `@gouvfr/dsfr`) sont déjà chez jsDelivr ; **TipTap et sa carte d'importation (esm.sh) restent tels quels** : le porteur n'a pas encore choisi, une consigne suivra.
- **e. Dis-le dans `GFS-ETAT.md`** : « Adresses que l'app appelle » (cdnjs sort), « Bibliothèques que l'app charge elle-même » (adresses et empreintes), et « Changements qui touchent GFS » (le commit, et les deux empreintes qui changent).

**4. Ce qui vient après, que tu ne fais pas maintenant** : (i) le **secours** : GFS saura donner à l'app, avec l'adresse de CDN, l'adresse de sa copie figée, qu'une petite aide du kit prendra quand le CDN échoue ou tarde ; (ii) une **adresse à préfixe** dans ta politique, à la place de tes adresses exactes, quand le dépôt dédié existera ; (iii) **TipTap**. Chacun aura sa consigne, après le feu vert du porteur.

## Pourquoi

Le porteur veut un CDN vérifié de bout en bout et un secours qui ne dépend pas d'un second service. Ce secours ne peut être que la copie de GFS, et elle n'est la même que le CDN que pour les octets de npm : chez cdnjs, deux de tes fichiers ne sont pas ceux de npm et huit adresses de la suite n'existent pas du tout chez lui. Avec jsDelivr seul, ta politique n'a plus qu'un hôte à nommer, tes empreintes viennent toutes de la même source, et le contrôle du lundi de GFS (la vue « Sécurité » de la fenêtre « Dépendances ») les relit sans exception.

## Fait quand

`GFS-ETAT.md` donne « 106 · faite · lue » avec le commit ; `--verifier` passe ; le `script-src` d'`index.html` ne nomme plus `cdnjs.cloudflare.com` ; tes essais passent avec les nouvelles adresses ; et les exports en PDF (pdfmake et ses polices), Word, Excel, ZIP, la lecture du Markdown et le code QR marchent dans l'app seule. GFS relit ta liste au prochain contrôle du lundi et le dit dans « Sécurité ».
