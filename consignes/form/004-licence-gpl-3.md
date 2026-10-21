# 004 · Licence : GNU GPL version 3 à la place d'Apache 2.0

App : Form+ · posée le 21/10/2026 · décision du porteur du 21/10 : tous les dépôts de la suite sont sous GPL 3.0 · quand :
au prochain lot ; aucun code ne change

## Quoi

1. **Remplacer `LICENSE`** par le texte officiel de la GNU General Public License version 3 : prends celui du dépôt de GFS
   (`LICENSE` à sa racine, 674 lignes ; `git clone --depth 1 https://github.com/lombre33/grist-widget-GFS`, branche `main`),
   octet pour octet. Contrôle : l'empreinte SHA-256 du fichier est
   `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`.
2. **Dire « GPL 3.0 » là où ton dépôt dit « Apache »** : `README.md` (la section sur la licence) ; la checklist du catalogue
   (`07-checklist-catalogue-gristgouv.md`, dans ton dossier `docs/` : les lignes 56, 102 et 120, et la section 4 sur la
   licence, qui garde son constat que le catalogue n'impose aucune licence) ; la feuille de route
   (`03-roadmap-priorites.md`, ligne 27 : ce paragraphe est un compte rendu du 18 septembre, ajoute-lui une note datée
   plutôt que de le réécrire). Les licences d'autres projets que cite l'étude comparative (`01-etude-comparative.md`) ne
   changent pas.
3. **Garder les avis de tiers.** `poc/qrcode.js` (MIT) garde son avis d'origine, déjà dans le fichier et dans la section sur
   les dépendances tierces du README ; la licence MIT est compatible avec la GPL 3.0. Si du code repris d'ailleurs (par
   exemple d'un widget sous Apache 2.0, compatible lui aussi) est dans ton dépôt, il garde son avis d'origine. Avant
   d'ajouter du code tiers, lire sa licence (guide, 1.3, point 3).
4. **Le `package.json` de `.github/scripts`** (l'outillage de tests) reçoit `"license": "GPL-3.0-only"`, sans autre
   changement. Pas d'en-tête de licence à écrire dans chaque fichier.

## Pourquoi

Le porteur a décidé le 21/10 que tous les dépôts de la suite sont sous GPL 3.0 (cahier, section 2 ; guide, section 1.3). Le
relevé de GFS du 21/10 : le dépôt de Form+ est sous la licence Apache 2.0 (ajoutée le 18 septembre en vue du catalogue, qui,
dit ta checklist, n'exige aucune licence précise) ; Publipostage+, Grist-BI et SlidesPlus sont déjà sous GPL 3.0,
Automation+ n'a que le fichier à ajouter. Apache 2.0 est compatible avec la GPL 3.0 : le passage ne casse rien pour le code
repris.

## Fait quand

`GFS-ETAT.md` donne « 004 · faite · `commit` » ; `LICENSE` a l'empreinte ci-dessus ; `grep -ri apache`, hors
`package-lock.json`, ne trouve plus que des licences d'autres projets citées pour mémoire et la note datée de la feuille de
route.
