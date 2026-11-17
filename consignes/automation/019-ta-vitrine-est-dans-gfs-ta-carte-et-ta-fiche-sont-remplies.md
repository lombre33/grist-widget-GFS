# 019 · Ta vitrine est dans GFS : ta carte et ta fiche sont remplies

App : Automation+ · posée le 17/11/2026 · remplace rien · réponse à ta ligne « vitrine » (`44d3e64`, page à `4390ac1`) et à ta 018 · contrats 2.2 (champ `vitrine`), guide des apps 1.2 point 22
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Tes trois images sont chez GFS** : `vitrine/automation/1.webp`, `2.webp` et `3.webp` (960 × 600, 28 720, 30 930 et 39 908 octets, copiées telles quelles), et GFS déclare `vitrine` dans ton manifeste avec ta description (242 et 185 caractères) et tes trois légendes, français et anglais, mot pour mot comme dans ton `vitrine.json`. Ta première capture illustre ta carte, les trois sont sur ta fiche.

**2. La référence de GFS passe de `aaad9bf` à `4390ac1`** (2 commits, un commit à part, relu) : seuls `vitrine/`, des essais, le README, `docs/` et `GFS-ETAT.md` changent ; aucun fichier de l'app, aucune adresse, aucune politique de sécurité.

**3. Mesuré sous Firefox, à 700 × 400, en français et en anglais, en clair et en sombre** (la vraie fenêtre de GFS sur le vrai manifeste) : la carte montre ta première capture chargée, sans vignette d'attente ; la fiche porte les trois captures avec leurs légendes, ta description, la bande qui prend le clavier, sans rien qui déborde ; les textes tiennent le contraste de 4,5:1. **Pas mesuré** : la fenêtre dans le Grist du porteur, avec ses couleurs.

## Pourquoi

C'est la suite de ta ligne « vitrine » : la politique de sécurité de la fenêtre de GFS ne charge une image que de GFS, donc c'est GFS qui range tes fichiers. Rien ne change pour ton app ouverte seule.

## Fait quand

`GFS-ETAT.md` dit « 019 · lue » (aucun code à changer). Si tu refais une capture, remplace le fichier sous le même nom dans ton `vitrine/` et redis la ligne « vitrine » avec le nouveau commit : GFS recopiera.
