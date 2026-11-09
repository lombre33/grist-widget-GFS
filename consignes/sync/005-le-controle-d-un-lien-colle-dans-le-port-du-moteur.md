# 005 · Le contrôle d'un lien collé, le lien public et le résumé d'un journal : dans le moteur, par le port

App : Sync+ · posée le 09/11/2026 · quand : avec le second lot de la 003 (elle la complète, sans la remplacer) ; du code dans ton app, sans changement visible pour la personne ; décision du porteur du 09/11 (« le copier-coller des liens, il faut garder le cœur du moteur de Sync+, pas le choix là-dessus », pour la sécurité)

## Quoi

GFS ne refait aucun contrôle de lien : il affiche des champs et des erreurs, le moteur juge. Pour cela, trois fonctions que tes écrans appellent aujourd'hui dans `js/grist.js`, **hors du `PORT_SHAPE`**, doivent y entrer en même temps que l'orchestration de la 003 :

- `shareInfo(url)` : le document que désigne la clé d'une adresse d'écriture (lecture anonyme de `GET /api/s/<clé>`, `readShare` de `logic/trust.js`). C'est le contrôle de sécurité d'un lien collé : un lien qui écrirait dans un autre document est refusé (`shareOtherDoc`), une clé coupée rend `null` (`shareUnknown`), Grist muet ou une réponse inattendue lève `shareUnreadable`. Appelée aujourd'hui par `source/recipient-wizard.js`, `target/wizard.js` et `source/tab.js`.
- `publicAccess(base)` : le droit du lien public du document (`'viewers'`, `'editors'`, `''` s'il est fermé, `null` si Grist ne répond pas). Appelée par `source/tab.js`.
- `journalStats(table, colonneRecu, colonneType)` : `{ n, last, raw }` en une requête, `null` si Grist refuse. Appelée par `target/tab.js` et `diagnostic.js`.

Le port de GFS les a déjà, **sous ces noms et avec ce contrat**, mesurés dans un vrai Grist 1.7.19 depuis son cadre d'envoi (faits vérifiés de GFS, 60) : la fiche du document rendue par la clé d'un vrai formulaire publié, une clé inconnue → `null`, une autre instance → `shareUnreadable` sans rien envoyer, le lien public fermé → `''`, une table absente → `null`.

Le reste du jugement d'un lien reste dans le moteur, jamais dans un écran : `testUrl`, `controlCode` et la comparaison du code de contrôle (`codeNotCompared`), la signature, la durée de vie d'une invitation, le refus d'une autre instance. Si l'un de ces contrôles n'existe aujourd'hui que dans un écran, il passe dans le moteur avec la 003.

## Pourquoi

Le porteur a tranché : pour recevoir un partage, la personne colle une fois le lien du formulaire (Grist ne le donne à aucun widget), et c'est le moteur de Sync+ qui le juge. Si ces appels restent dans tes écrans, GFS devrait les réécrire pour dessiner les siens : deux versions d'un contrôle de sécurité finiraient par diverger.

## Fait quand

`GFS-ETAT.md` donne la ligne « 005 · faite · `commit` » et, en note : les trois fonctions dans `PORT_SHAPE` (`setPort` refuse un port qui ne les a pas) et le numéro de version du moteur ; « aucun contrôle de lien dans un écran » ; et des essais du moteur, sur ton Grist en mémoire, d'un lien d'un autre document (refusé), d'une clé inconnue, d'un Grist muet, et d'un code de contrôle non comparé en sécurité renforcée.
