# 002 · Licence : ajouter le fichier `LICENSE` (GNU GPL version 3)

App : Automation+ · posée le 21/10/2026 · décision du porteur du 21/10 : tous les dépôts de la suite sont sous GPL 3.0 ·
quand : au prochain lot ; aucun code ne change

## Quoi

1. **Ajouter `LICENSE` à la racine du dépôt** : le texte officiel de la GNU General Public License version 3, celui du dépôt
   de GFS (`LICENSE` à sa racine, 674 lignes ; `git clone --depth 1 https://github.com/lombre33/grist-widget-GFS`, branche
   `main`), octet pour octet. Contrôle : l'empreinte SHA-256 du fichier est
   `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`.
2. Le reste est déjà juste : `package.json` (`"license": "GPL-3.0-only"`), le README (« licence GNU GPL v3.0 ») et le
   panneau « Crédits » disent GPL 3.0. Rien à changer dans le code, ni d'en-tête de licence à écrire dans chaque fichier.

## Pourquoi

Le porteur a décidé le 21/10 que tous les dépôts de la suite sont sous GPL 3.0 (cahier, section 2 ; guide, section 1.3). Le
relevé de GFS du 21/10 : Automation+ le dit partout, mais le dépôt n'a pas le texte de la licence. Sans lui, GitHub
n'affiche aucune licence pour le dépôt, et la GPL demande de donner à chaque destinataire une copie de la licence avec le
programme (article 4).

## Fait quand

`GFS-ETAT.md` (que crée la 001) donne « 002 · faite · `commit` » ; `LICENSE` a l'empreinte ci-dessus.
