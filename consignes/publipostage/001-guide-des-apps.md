# 001 · Suivre le guide des apps

App : Publipostage+ · posée le 14/10/2026 · quand : à lire avant le prochain lot, puis à chaque lot

## Quoi

1. Lire `docs/guide-des-apps.md` (dépôt de GFS) : la section 1.1 (treize règles à respecter dès maintenant) et la section 2
   (Publipostage+). Les sections 1.2 et 2.3 disent ce qui viendra avec le kit, les contrats et `gfs.json` : les lire pour savoir
   où l'on va, sans en engager aucune avant la consigne qui la demande (elles attendent les étapes 3 à 5 du plan et le go du
   porteur).
2. Appliquer la 1.1 et la 2.4 à tout code nouveau, dès le prochain lot. Le code existant s'y met au fil des lots, sans lot
   dédié, sauf la garde « type inconnu » (consigne 002).
3. Relire le relevé que le guide fait de l'app (2.1 et 2.2) : il date de `92ecd58` et l'app a avancé depuis. GFS sait déjà qu'il
   est incomplet : la table `Publipostage_Versions` n'y figure pas, et `js/page-tree.js` écrit `_grist_Pages` en plus de
   `_grist_Tables_column` (le guide ne compte qu'une écriture de table interne). Écrire dans le `GFS-ETAT.md` le reste de ce qui
   est faux ou périmé.
4. Créer le `GFS-ETAT.md` à la racine du dépôt (format : `consignes/LISEZ-MOI.md`). `outils/depot-propre/publier.sh` refuse
   toute entrée de racine qu'il ne connaît pas : y ajouter `GFS-ETAT.md` à `EXCLUS`, dans le même commit, car ce fichier ne se
   publie pas.

## Pourquoi

Les treize règles ne coûtent presque rien aujourd'hui et évitent une dette le jour où l'app tournera dans GFS (sous-cadre
isolé, filtre du courtier d'après le manifeste, liste unique des bibliothèques). Le relevé du guide a été fait par GFS, de
l'extérieur et en lecture seule : seul le projet de l'app sait s'il est juste.

## Fait quand

`GFS-ETAT.md` donne la ligne « 001 · faite · `commit` » avec, en note, les numéros des règles de la 1.1 que le code existant ne
respecte pas encore (ou « aucun écart ») et ce que le relevé du guide a de faux ou de périmé (ou « relevé juste »). « Faite »
ne veut pas dire « oubliée » : les règles restent en vigueur à chaque lot.
