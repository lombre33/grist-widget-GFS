# 004 · Les requêtes REST dans le moteur, une seule fois ; et un défaut de `docChanges`

App : Sync+ · posée le 07/11/2026 · quand : avec la 003 ou juste après, sans urgence ; du code dans ton app, sans changement visible pour la personne ; applique la règle « ne pas dupliquer de code » du projet de GFS et l'intégration du moteur décidée par le porteur le 06/11

GFS a écrit son port (`js/sync-port.js`) et l'a mesuré dans un vrai Grist 1.7.19 : 34 vérifications, dont l'envoi de lignes par la clé d'un vrai formulaire publié, depuis un cadre sans origine. Deux choses en sortent pour toi.

## Quoi

**1. Un défaut dans `docChanges` (`js/grist.js`).** Quand l'état de départ (`since`) est un état que Grist ne connaît plus, `GET /compare?left=<état>&right=HEAD` répond **500 `{"error":"Cannot read hash"}`** (Grist 1.7.19 ; pas 404, pas 400). Ta fonction relit alors depuis `HEAD`, mais, comme `since` n'est pas vide, elle garde `known = true` : elle rend `tables: Set()` **vide**, c'est-à-dire « rien n'a changé », au lieu de « inconnu » (`tables: null`, que la boucle de la CIBLE traite comme « tout relire »). Le tour perd donc les changements arrivés pendant que l'état était perdu. Correction : après le repli sur `HEAD`, rendre `tables: null` (GFS le fait dans son port ; son essai échoue sans la correction). Ajoute le même essai chez toi.

**2. Les requêtes REST une seule fois, dans le moteur.** Le port de GFS refait, sur son cadre d'envoi, ce que ton `js/grist.js` fait avec `fetch` : webhooks (création avec condition relue dans `_grist_Triggers`, `gristTooOld`, file vidée avant l'effacement, avis de fin), comparaison d'états, lecture SQL, `selectRows`, envoi direct de lignes (refus d'une autre instance, clé jamais dite en entier), lecture publique, pièces jointes. Deux copies de la même logique finiront par diverger. Propose-la une fois dans le moteur (par exemple `js/engine/rest-port.js`) :

- `createRestPort({ docApi, http })` rend les fonctions du `PORT_SHAPE` qui sont du REST (`querySql`, `selectRows`, `docChanges`, `isOwner`, `downloadAttachment`, `uploadAttachment`, les webhooks, `postRows`, `postToHook`, `publicRecords`) ;
- `http` est tout ce que l'hôte fournit : `request(méthode, chemin, { body, params, full, timeout })` (REST du document, avec un jeton, que l'hôte ajoute) qui rend `{ status, body }` et **lève une erreur portant `status` et `message`** sur un refus (une erreur sans `status` pour un réseau muet) ; `anonymous(méthode, adresse, { body, timeout })` (sans jeton, **seulement vers le serveur du document** : l'hôte le garantit) ; `download(numéro)` rend les octets ; `upload(nom, octets)` rend le numéro ; `docBaseUrl()` rend l'adresse REST du document ;
- `selectRows` se déduit de `querySql` : il passe dans le moteur (GFS en a recopié les trois lignes) ;
- ton `js/grist.js` ne garde que son `http` (le `fetch`, le jeton `auth=`, la liste d'instances) ; le `PORT_SHAPE` ne change pas. GFS écrira son `http` sur son cadre d'envoi (une quarantaine de lignes) et supprimera le reste de son port.

## Pourquoi

Une seule suite d'étapes REST, mesurée une fois : quand tu changes la façon de poser un webhook ou de lire un état, GFS le reçoit avec le moteur (`outils/reprendre-synchro.mjs`) sans réécrire son port. Le défaut de `docChanges` est la preuve du risque : il vit dans la partie que les deux hôtes recopient.

## Fait quand

`GFS-ETAT.md` donne la ligne « 004 · faite · `commit` » et, en note : le numéro de version du moteur (mineure) ; l'interface exacte de `http` (ce que chaque fonction prend et rend, ce que `request` lève) ; l'essai du défaut de `docChanges` (état perdu → `tables: null`) ; des essais du port REST sur un `http` en mémoire (création d'un webhook dont la condition manque : effacé et `gristTooOld` ; file vidée avant l'effacement ; avis de fin qui échoue sans retenir l'effacement ; envoi vers une autre instance : rien ne part). Si tu préfères un autre découpage pour le point 2, dis lequel : le point 1 se fait seul, tout de suite.
