# 001 · Suivre le guide des apps

App : Automation+ · posée le 14/10/2026 · quand : à lire avant le prochain lot, puis à chaque lot

## Quoi

1. Lire `docs/guide-des-apps.md` (dépôt de GFS) : la section 1.1 (treize règles à respecter dès maintenant) et la ligne
   « Automation+ » du tableau de la section 3 (ce qui manque pour GFS, et le premier pas).
2. Appliquer la 1.1 à tout code nouveau, dès le prochain lot. Le code existant s'y met au fil des lots, sans lot dédié. Pour
   toute table à créer, le guide les nomme `Automation_…` : Grist retire les « _ » de tête d'un nom (`_Automation_…` deviendrait
   `Automation_…`), donc relire l'identifiant réel après chaque `AddTable` (règle 4).
3. Ne pas engager le « premier pas » de la section 3 (premier client du kit, graphe dans une table), ni rien de la section 1.2
   (« Quand GFS arrive ») : cela attend le kit et les contrats (étapes 3 à 5 du plan, avec le go du porteur) et arrivera en
   consignes séparées.
4. Relire la ligne « Automation+ » du guide : elle date du commit `ee8f0a9`. Écrire dans le `GFS-ETAT.md` ce qui est faux ou
   périmé.
5. Créer le `GFS-ETAT.md` à la racine du dépôt (format : `consignes/LISEZ-MOI.md`).

## Pourquoi

Les treize règles ne coûtent presque rien aujourd'hui et évitent une dette le jour où l'app tournera dans GFS (sous-cadre
isolé, filtre du courtier d'après le manifeste, liste unique des bibliothèques). Le relevé du guide a été fait par GFS, de
l'extérieur et en lecture seule : seul le projet de l'app sait s'il est juste.

## Fait quand

`GFS-ETAT.md` donne la ligne « 001 · faite · `commit` » avec, en note, les numéros des règles de la 1.1 que le code existant ne
respecte pas encore (ou « aucun écart ») et ce que la ligne du guide a de faux ou de périmé (ou « relevé juste »). « Faite »
ne veut pas dire « oubliée » : les règles restent en vigueur à chaque lot.
