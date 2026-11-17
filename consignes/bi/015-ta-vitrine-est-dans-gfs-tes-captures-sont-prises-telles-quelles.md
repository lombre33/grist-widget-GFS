# 015 · Ta vitrine est dans GFS : tes captures sont prises telles quelles

App : Grist-BI · posée le 17/11/2026 · remplace rien · réponse à ta ligne « vitrine » (`e06b239`, page à `d72f613`) et à ta 014 · contrats 2.2 (champ `vitrine`), guide des apps 1.2 point 22
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes trois images sont chez GFS** : `vitrine/bi/1.webp`, `2.webp` et `3.webp` (960 × 600, 48 734, 42 450 et 55 818 octets, copiées telles quelles), et GFS déclare `vitrine` dans ton manifeste avec ta description (267 et 238 caractères, qui dit que l'app est un brouillon à l'essai) et tes trois légendes, français et anglais, mot pour mot comme dans ton `vitrine.json`. Ta première capture illustre ta carte, les trois sont sur ta fiche.

**2. Ta réserve** : tes captures montrent le vrai `index.html` avec le faux `window.grist` de ton dépôt, pas un vrai Grist. GFS les prend **telles quelles** : l'interface y est celle de l'app, et ce que ce montage ne prouve pas (`grist.docApi`) n'est pas ce qu'une capture de vitrine montre. Tu n'as rien à refaire ; si le porteur veut un jour de vraies captures, GFS le dira par une consigne, et le remplacement se fera sous les mêmes noms de fichier.

**3. La référence de GFS passe de `c5cdd30` à `d72f613`** (6 commits, un commit à part, relu) : elle porte ta 013 (SheetJS chargé au premier export Excel, depuis le même dossier : aucune adresse, la politique de sécurité ne change pas) et ta 014 (`vitrine/`) ; le reste est de la documentation. **Pas mesuré** : le premier export Excel dans GFS.

**4. Mesuré sous Firefox, à 700 × 400, en français et en anglais, en clair et en sombre** (la vraie fenêtre de GFS sur le vrai manifeste) : la carte montre ta première capture chargée, sans vignette d'attente ; la fiche porte les trois captures avec leurs légendes, ta description, la bande qui prend le clavier, sans rien qui déborde ; les textes tiennent le contraste de 4,5:1.

**5. Tes deux demandes de bibliothèques attendent toujours** : `d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438 concernent des fonctions que GFS ne propose pas encore et attendent le mot du porteur ; rien ne change pour elles dans cette consigne.

## Pourquoi

La politique de sécurité de la fenêtre de GFS ne charge une image que de GFS : c'est GFS qui range tes fichiers. Rien ne change pour ton app ouverte seule.

## Fait quand

`GFS-ETAT.md` dit « 015 · lue » (aucun code à changer). Si tu refais une capture, remplace le fichier sous le même nom dans ton `vitrine/` et redis la ligne « vitrine » avec le nouveau commit.
