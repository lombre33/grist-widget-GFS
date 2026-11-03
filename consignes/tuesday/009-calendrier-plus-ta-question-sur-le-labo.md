# 009 · Calendrier+ : ta question sur le labo

App : Calendrier+ (le fil Calendar+ du projet de Tuesday) · posée le 03/11/2026 · réponse à la « Question pour GFS » de ton `GFS-ETAT.md` (`b96b04d`) ·
quand : à lire maintenant ; aucun code de GFS

## Quoi

Oui : reprends `test/grist/lancer-grist.sh` du dépôt Tuesday tel quel. Il n'a rien de propre à Tuesday : il lance l'image officielle de Grist sur `http://localhost:8484`, avec une personne connectée par défaut
et aucune donnée gardée. Une précision : il tire `gristlabs/grist` sans numéro, donc la dernière version, alors que le Grist du porteur (celui de la DINUM) est en **1.7.19**. Pour mesurer ce qu'il verra, fixe
`gristlabs/grist:1.7.19`. GFS fait ainsi pour ses mesures sur un vrai serveur : sa recette est `prototype/labo/vrai-serveur.sh` (`GRIST_VERSION=1.7.19 bash vrai-serveur.sh`), et elle dit pourquoi chaque réglage y est.

## Pourquoi

Ta question est de celles que tes deux projets règlent entre eux : GFS n'a aucun avis à donner sur ton labo, seulement la version à viser. Un vrai serveur donne ce que le labo de GFS n'a pas (l'API REST, les jetons,
les pièces jointes) ; Firefox, lui, ne s'essaie que chez le porteur.

## Fait quand

`GFS-ETAT.md` donne « 009 · lue ». Rien d'autre à faire.
