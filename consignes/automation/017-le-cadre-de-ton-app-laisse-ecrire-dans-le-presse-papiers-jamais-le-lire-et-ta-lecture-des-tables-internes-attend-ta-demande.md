# 017 · Le cadre de ton app laisse écrire dans le presse-papiers (jamais le lire) ; et la lecture des tables internes de ton diagnostic attend ta demande

App : Automation+ · posée le 11/11/2026 · remplace rien · contrats de GFS 1.3 (point 1) et 3.2 (point 4) · réponse à ta question du diagnostic (0.15.2, `b565c9e`)
quand : à lire avec la 016, au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Le presse-papiers (ta question « Questions pour GFS »).** Oui, le cadre de ton app dans GFS laisse écrire. GFS pose `allow="clipboard-write"` sur le cadre de chaque app (`prototype/js/frames.js`), comme Grist le pose sur le cadre qu'il donne à GFS. Mesuré par GFS dans Chromium (contrats 1.3, point 1) : l'écriture (`navigator.clipboard.writeText`, appelée dans le geste de la personne) marche ; la **lecture** (`readText`) est refusée ; le cadre n'a jamais `allow-same-origin`. Ton premier chemin, l'API du presse-papiers, doit donc aboutir dans GFS ; la commande du navigateur ne sert que de repli. **Sous Firefox**, le navigateur du porteur, GFS ne l'a pas mesuré pour ton cadre : ta ligne DIAG-R10 le dira.

**2. Tes lectures de `_grist_Tables` et `_grist_Tables_column`.** Ta page les note en « Changements » sans les demander. Dans GFS, une table `_grist_*` se lit seulement par une entrée du manifeste qui la nomme, table par table et colonne par colonne (contrats 3.2, point 4). Le manifeste d'Automation+ n'en a pas : tant que tu ne demandes rien, le courtier les refuse. Ton diagnostic doit donc tenir sans elles dans GFS : les colonnes manquent, il le dit, et rien ne casse. Si tu veux qu'il les montre aussi dans GFS, écris la demande dans « Demandes à GFS » : les deux tables, les colonnes lues, « lecture seule », et l'usage en une phrase. GFS la soumet alors au porteur ; elle ne se déclare pas d'elle-même.

## Pourquoi

Tu as posé une question de fait (le cadre) : la réponse est dans le contrat, la voici. Ta lecture de deux tables internes est la première de l'app ; le contrat veut qu'une telle lecture soit demandée et déclarée, jamais supposée. GFS te dit où en est le courtier pour que ton diagnostic ne soit pas surpris dans le vrai cadre.

## Fait quand

`GFS-ETAT.md` donne « 017 · lue » (aucun code à changer). Quand tu auras joué DIAG-R10 dans GFS, une ligne dit laquelle des deux voies a copié le texte (l'API du presse-papiers ou la commande du navigateur) et ce que le diagnostic montre des colonnes (les voir, ou lire qu'elles manquent).
