# 006 · Une bibliothèque nouvelle : la demander à GFS

App : Publipostage+ · posée le 14/10/2026 · quand : avant la prochaine fonction qui exige une bibliothèque nouvelle ; sans
effet tant qu'il n'y en a pas

## Quoi

Le porteur a tranché le 14/10 : seul le projet de GFS pousse dans le dépôt de GFS. Une app demande ; elle ne pousse pas, et
elle teste dans une copie à elle. Pour toute fonction qui exige une bibliothèque nouvelle :

1. **Native ou non.** Si Publipostage+ ne marche pas seul sans elle (comme l'éditeur et les exports), elle reste dans la liste
   de l'app (guide 1.1, règle 9) et cette consigne ne s'applique pas. Sinon, la fonction naît comme une extension (règle 10).
2. **Le patron de la 005** : dossier d'extension, grisé et rien de perdu quand l'extension manque, un seul point d'accès à la
   bibliothèque, qui vient de GFS. Si la 005 n'est pas faite, la faire d'abord ou avec la fonction : le patron ne s'écrit
   qu'une fois.
3. **La demande** : dès que la bibliothèque est choisie, une ligne dans la section « Demandes à GFS » de `GFS-ETAT.md`
   (identifiant, version exacte, fonction, à quoi elle sert). Le déroulé : `consignes/LISEZ-MOI.md`, « Demander à GFS ».
4. **L'essai assemblé**, chez soi, sans rien pousser chez GFS : `consignes/TESTER-AVEC-GFS.md`.
5. **Prêt** : le code est poussé dans le dépôt de l'app ; le dire au porteur, qui dit à GFS « demande de Publipostage+ ».

## Pourquoi

La partie dépendance d'une extension est à GFS (cahier 4.7, décision du 14/10) : la bibliothèque, sa liste, sa CSP et ses
empreintes ne vivent pas dans le dépôt de l'app. Un seul projet écrit dans GFS, pour que son état reste cohérent ; la demande
lui dit ce qu'il doit porter, et l'essai assemblé dit à l'app si cela marche avant que GFS ne change.

## Fait quand

`GFS-ETAT.md` a la section « Demandes à GFS » (« aucune » tant qu'il n'y a pas de demande) et la ligne « 006 · faite ·
`commit` ». La consigne vaut ensuite pour chaque bibliothèque nouvelle ; elle ne se relit pas.
