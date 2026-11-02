# 037 · Ton site en ligne reste publié : un fichier `.nojekyll` à la racine, et la version en ligne vérifiée à chaque lot

App : Publipostage+ · posée le 02/11/2026 · décision du porteur du 02/11 (« Oui, une consigne ») · quand : au prochain lot, sans urgence ;
un fichier vide à ajouter, aucun autre code ; sans effet dans l'app seule

## Quoi

**1. Ajoute un fichier vide `.nojekyll` à la racine de ton dépôt.** Sans lui, GitHub Pages passe tes fichiers `.md` dans Jekyll avant de
publier ; une accolade double non fermée dans l'un d'eux (un `{{` sans `}}`, un `{%` sans `%}`) fait échouer la publication, et ton site
reste sur la version d'avant, sans rien montrer, ni à toi ni à la personne. Avec `.nojekyll`, Pages publie tes fichiers tels quels et ne
lit plus tes documents. Rien ne change pour ton code. Une conséquence : sans Jekyll, Pages peut servir aussi les noms qui commencent par «
_ » ou « . », qu'il cachait (chez toi `.claude/` et `dev-tests/.offline-cache/`) ; ils sont déjà publics dans ton dépôt, mais ne garde là
rien qui ne doive pas être lu.

**2. À chaque lot, vérifie que le site en ligne sert ce que tu viens de pousser.** Après les 10 minutes de cache de GitHub Pages : (a) le
run « pages build and deployment » de l'onglet Actions de ton dépôt est vert ; (b) un changement visible du lot est bien en ligne (le
numéro de version quand il bouge, là où ton app l'affiche, sinon un détail du lot). Mets ces deux vérifications dans ton protocole de test
manuel : Automation+ l'a fait avec un scénario de son `docs/TESTS_GRIST_REEL.md` (START-05), et avec un test automatique qui échoue si
`.nojekyll` ou `index.html` manque à la racine (HYG-12), un plus que tu peux reprendre mais qui n'est pas demandé.

## Pourquoi

Le site en ligne d'Automation+ est resté à la version 0.9.0 du 21/10 au 02/11, alors que son dépôt était à la 0.11.1 : sa publication
échouait à cause d'une accolade double non fermée dans un document, et rien ne le montrait. Depuis le 22/10, GFS ouvre ton app sur son site
(`https://lombre33.github.io/publipostageGrist/index.html`, consigne 033). GFS ne retombe sur la copie de son sous-module que si le site ne
répond pas en 15 secondes : un site publié mais ancien est servi comme s'il était à jour, et GFS ne peut pas ouvrir ton site depuis son
environnement pour le vérifier à ta place. GFS a relu le 02/11 les 31 fichiers `.md` de ton dépôt (à `6c6ee73`) avec le découpage de Liquid
: aucune accolade non fermée aujourd'hui. Mais Publipostage+ écrit des variables `{{Table.Colonne}}` dans ses documents, et tes lots sont
nombreux : le jour où l'une reste ouverte, la publication échoue sans que rien ne le dise. Décision du porteur du 02/11 ; guide des apps,
1.2 point 11 ; faits vérifiés, section 5.

## Fait quand

`.nojekyll` est à la racine de la branche principale de ton dépôt, la publication de ce lot est verte, et `GFS-ETAT.md` donne « 037 · faite
· `commit` » avec la version vue en ligne et la date.
