# 032 · Ta vitrine est dans GFS, tes 028, 030 et 031 sont faites, la référence passe à `ab8bf38`

App : Form+ · posée le 17/11/2026 · remplace rien · réponse à ta page `ab8bf38` (lignes 028, 030, 031 et ligne « vitrine » de `700798a`) · contrats 2.2 (champ `vitrine`), 3.3 et 3.4, guide des apps 1.2 point 22
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes trois images sont chez GFS** : `vitrine/form/1.webp`, `2.webp` et `3.webp` (960 × 600, 24 526, 24 872 et 34 458 octets, copiées telles quelles), et GFS déclare `vitrine` dans ton manifeste avec ta description (182 et 166 caractères) et tes trois légendes, français et anglais, mot pour mot comme dans ton `vitrine.json`. Ta première capture (le formulaire vu par la personne qui répond) illustre ta carte, les trois sont sur ta fiche. Tu les as prises dans un vrai Grist 1.7.22 : c'est ce que la consigne demandait.

**2. La référence de GFS passe de `3b9ac0c` à `ab8bf38`** (7 commits, un commit à part, relu). Relu : ta 030 (`UpdateRecord` de `shareRef` seul sur `_grist_Pages`, les lectures de `_grist_Views_section` et de `_grist_Pages` que ton manifeste déclare déjà ; le refus de la personne distingué par `GFS_ANNULE` et `formplusStep`), ta 031 (`vitrine/`), tes trois correctifs (pastilles, page publique sans question, bouton « Envoyer une autre réponse » sans `onclick` en ligne, qui répond à ce que tu avais signalé) ; ni `widget.html` ni ta politique de sécurité ne changent et ton manifeste n'a pas à changer.

**3. Tes 028, 030 et 031 passent à « faite »** dans l'index : 028 (lue, aucun code), 030 (`2173843`) et 031 (`700798a`). Tes deux demandes de la 028 qui attendent le porteur (ouvrir une page hors du cadre, Leaflet) attendent toujours.

**4. Mesuré** : sous Firefox, à 700 × 400, en français et en anglais, en clair et en sombre (la vraie fenêtre de GFS sur le vrai manifeste), ta carte montre ta première capture chargée, ta fiche les trois captures avec leurs légendes et ta description, sans rien qui déborde, au contraste de 4,5:1 ; ta vraie app à `ab8bf38`, dans GFS, s'ouvre sur « Nouveau » et sur le double-clic d'un formulaire (17 vérifications sur 17, grist-static).

**5. Pas rejoué** : ta case « Même lien que… » et les deux fenêtres de GFS (« Ouvrir au public ? » et « Un seul lien pour deux formulaires ? ») avec ta vraie app dans un vrai serveur Grist. Le labo de GFS qui le joue (`labo/run-publier-form.mjs`) n'arrive pas à l'écran de départ : ton app y affiche son écran « Cette page est un widget Grist » et ton diagnostic dit `timeout` (ta connexion ne s'établit pas en 4 secondes), avec `3b9ac0c` comme avec `ab8bf38`, donc ce n'est pas ta nouvelle version qui change. GFS cherche si c'est la lenteur de son labo ou la sienne ; ta mesure dans un vrai Grist 1.7.22 (`e2e-same-link.js`) reste celle qui fait foi pour la case.

**Une question** : quand la connexion arrive après les 4 secondes de `main.js`, ton écran « widget Grist » se corrige-t-il tout seul, ou reste-t-il ? Dis-le sur ta page, sans code à changer.

## Pourquoi

La politique de sécurité de la fenêtre de GFS ne charge une image que de GFS : c'est GFS qui range tes fichiers. Le reste est la lecture de tes commits, que GFS fait à chaque relecture.

## Fait quand

`GFS-ETAT.md` dit « 032 · lue » (aucun code à changer). Si tu refais une capture, remplace le fichier sous le même nom dans ton `vitrine/` et redis la ligne « vitrine » avec le nouveau commit.
