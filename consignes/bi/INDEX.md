# Consignes de GFS pour Grist-BI

Dépôt de l'app : `lombre33/Grist-BI`. Mode d'emploi : [`../LISEZ-MOI.md`](../LISEZ-MOI.md), à lire une fois. Avant chaque lot :
cette page, puis seulement les consignes « à faire ».

| N° | Consigne | Quand | État |
|---|---|---|---|
| 001 | [Suivre le guide des apps](001-guide-des-apps.md) | à lire avant le prochain lot, puis à chaque lot | faite · `23647eb` |
| 002 | [La barre de GFS : ce qu'elle recouvrira chez toi (mesuré avec ton app seule)](002-barre-de-gfs-mesuree-seule.md) | à lire maintenant ; du code à ton entrée dans GFS (guide 1.2) ; sans effet dans l'app seule | lue |
| 003 | [Ton site en ligne reste publié : un fichier `.nojekyll` à la racine, et la version en ligne vérifiée à chaque lot](003-ton-site-en-ligne-reste-publie.md) | au prochain lot, sans urgence ; un fichier vide à ajouter, aucun autre code ; décision du porteur du 02/11 ; GFS ne l'ouvre pas encore sur son site ; sans effet dans l'app seule | faite · `21b012b` |
| 004 | [Suivre l'ambiance de GFS : au lot où tu prends le kit, `Ambiance.start()` (décision du porteur)](004-suivre-l-ambiance-de-gfs.md) | au lot où tu prends le kit (guide des apps 1.2, points 1 et 4) ; rien à changer d'ici là ; décision du porteur du 02/11 et du 03/11 ; sans effet dans l'app seule | faite · `fef9af8` |
| 005 | [Une ligne reçue par un lien public est du texte non fiable : dis dans ta page d'état comment Grist-BI l'affiche, la calcule et l'exporte](005-une-ligne-recue-par-un-lien-public-est-du-texte-non-fiable.md) | au prochain lot, sans urgence ; aucun code exigé (un relevé de ton code, dans ta page d'état) ; contrats 11.6 (point 9) et 11.9 (point 5), décision du porteur du 04/11 (11.7, point 9) ; vaut aussi dans l'app seule | à faire |
| 006 | [Réponds à « fermer » : enregistre avant de laisser la place à une autre app](006-repondre-a-fermer-enregistre-avant-de-partir.md) | au prochain lot, sans urgence ; du code dans ton app (une réponse à un appel de GFS) ; contrats 5.4 (points 3 et 7), guide 1.2 point 19 ; demande du porteur du 04/11 ; vaut dans GFS seulement | à faire |
| 007 | [Entrer dans GFS : démarrer dans son cadre isolé (le stockage), puis un rapport BI est une ligne nommée de `BI_Dashboard_Config`, ouvert par « Nouveau » et le double-clic](007-entrer-dans-gfs-rapports-bi-nommes.md) | au prochain lot ; du code dans ton app ; le point 1 d'abord (quatre lignes : sans lui l'app ne démarre pas dans GFS) ; contrats 2.4 et 5.2 à 5.4, guide 1.1 (règles 4 et 6) ; demande du porteur du 04/11, type « Rapport BI » ; le point 3 vaut dans GFS seulement | à faire |
| 008 | [Le kit répond à « fermer » (0.9.0) : abonne-toi avec `GfsLink.onClose` au lieu de répondre à la main](008-le-kit-repond-a-fermer-abonne-toi-avec-onclose.md) | en même temps que ta 006 ; du code dans ton app (la référence du kit, un abonné) | à faire |
