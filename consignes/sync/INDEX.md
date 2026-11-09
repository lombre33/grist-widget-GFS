# Consignes de GFS pour Sync+ (« Synchro Grist »)

Dépôt de l'app : `lombre33/grist-widget-one-way-sync` (dépôt de développement ; la copie publiée `grist-factory/grist-widget-syncPlus`
est restée à la 0.5.9). Mode d'emploi : [`../LISEZ-MOI.md`](../LISEZ-MOI.md), à lire une fois. Avant chaque lot : cette page, puis
seulement les consignes « à faire ». Sync+ n'est pas une app du catalogue de GFS : seul son moteur sera lu par GFS (kit).

| N° | Consigne | Quand | État |
|---|---|---|---|
| 001 | [GFS existe, et son explorateur ira chercher ton moteur de synchronisation](001-gfs-existe-et-ira-chercher-ton-moteur.md) | à lire maintenant ; la page d'état à ton prochain lot ; décision du porteur du 06/11 ; aucun code, aucun effet dans l'app seule | faite (`f37cfd9`, relue le 07/11) |
| 002 | [Sépare ton moteur de tes écrans : un branchement vers Grist, un préfixe de tables réglable](002-separe-ton-moteur-de-tes-ecrans.md) | au prochain lot, sans urgence ; du code dans ton app, sans changement visible ; décision du porteur du 06/11 ; vaut aussi dans l'app seule | faite (`f37cfd9`, relue le 07/11) |
| 003 | [Tes cinq questions, et le second lot : l'orchestration des assistants, sans écran](003-reponses-et-second-lot-l-orchestration-sans-ecran.md) | au prochain lot, sans urgence ; du code dans ton app, sans changement visible ; décision du porteur du 06/11 | faite (moteur 2.0.0 `09143dd`, 2.1.0 `3447b9f`, relue le 09/11 à `e7054cc`) |
| 004 | [Les requêtes REST dans le moteur, une seule fois ; et un défaut de `docChanges`](004-les-requetes-rest-dans-le-moteur-et-un-defaut-de-docchanges.md) | avec la 003 ou juste après, sans urgence ; du code dans ton app, sans changement visible ; le point 1 (défaut) se fait seul | faite (moteur 2.0.0 `09143dd`, 2.1.0 `3447b9f`, relue le 09/11 à `e7054cc`) |
| 005 | [Le contrôle d'un lien collé, le lien public et le résumé d'un journal : dans le moteur, par le port](005-le-controle-d-un-lien-colle-dans-le-port-du-moteur.md) | avec le second lot de la 003 (la complète) ; du code dans ton app, sans changement visible ; décision du porteur du 09/11 | faite (moteur 2.0.0 `09143dd`, 2.1.0 `3447b9f`, relue le 09/11 à `e7054cc`) |
