# 016 · Écriture en direct : l'adresse du CDN de GFS, à nommer dans ta CSP

App : Publipostage+ · posée le 19/10/2026 · suite de la 013 (son « Pourquoi », point 2) et de la 007 · quand : au prochain lot, avant
le reste : tant que ta CSP ne nomme pas cette adresse, le mode par défaut de l'écriture en direct (« Depuis un CDN ») est refusé par
le navigateur ; une ligne de CSP et ton garde-fou à changer ; sans effet dans l'app seule

## Quoi

**1. GFS offre le CDN pour l'écriture en direct**, le porteur l'ayant choisi le 19/10 (jsDelivr). La 013 (point 1.1) disait que
`edition-live` n'avait pas de CDN : ce n'est plus vrai (`4bf3cbc`).

1. **jsDelivr sert le fichier depuis le dépôt public de GFS, à un commit épinglé** : `cc8707c2ff18a32fd8f43a92a3e1a3026579f713`,
   le commit qui a ajouté la copie à GFS. C'est un commit complet (jamais une branche ni une étiquette, qui bougeraient sous
   l'empreinte), et l'outil de GFS lit dans git qu'il porte exactement la copie vendorisée avant d'écrire l'adresse (contrats 2.6,
   point 11).
2. **L'empreinte est celle de la copie** (`sha384-FVwm2w…`, dans `prototype/bibliotheques/catalogue.json`) : mêmes octets, mêmes
   six paquets, mêmes modules, mêmes noms laissés à ta carte d'importation.
3. **La fenêtre « Apps et extensions » de GFS propose « Depuis un CDN »**, qui devient le défaut, et « Copie de GFS » (le choix de la
   personne s'écrit dans le document, un geste, comme pour le graphique).

**2. L'adresse exacte**, celle que le catalogue de GFS donne à ton app (`src`) :

    https://cdn.jsdelivr.net/gh/lombre33/grist-widget-GFS@cc8707c2ff18a32fd8f43a92a3e1a3026579f713/prototype/vendor/edition-live/1.0.0/edition-live.js

Copie-la telle quelle : une source de CSP qui porte un chemin se compare à l'octet près, la casse de `grist-widget-GFS` comprise.

**3. Ce que ton app change**, et seulement cela :

1. **`script-src` de la CSP d'`index.html` nomme cette adresse entière**, à côté de celle de Plotly, avec le commentaire qui dit
   pourquoi (GFS ne peut imposer aucune politique à un sous-cadre : consigne 007). Rien de plus large : ni `cdn.jsdelivr.net` en
   entier, ni `/gh/` en entier, ni le dépôt, ni `blob:`.
2. **Ton garde-fou la connaît** : `EXTENSION_LIBRARY_ADDRESSES`, dans `dev-tests/verify-code-hygiene.mjs`, reçoit `edition-live` et
   son adresse (une adresse par bibliothèque d'extension, écrite là et nulle part dans le code du widget), pour que la section
   « politique » ne la prenne pas pour une adresse oubliée et que ta section 25 garde qu'elle est là, seule et exacte.
3. **Ta liste de bibliothèques et ta carte d'importation ne changent pas** (guide, règle 9). Ton code reçoit toujours
   `{ src, integrite, forme: 'module' }`, quel que soit le mode : il n'y a rien d'autre à toucher.

**4. Mesuré avec ton app** (`prototype/labo/run-edition.mjs`, vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie
souris et au vrai clavier, 56 vérifications, en français / clair et en anglais / sombre ; ton app est celle de la référence,
`da919fc`, jamais modifiée : pour le point 2 seulement, la page est servie à l'essai avec l'adresse de plus dans sa CSP) :

1. **avec ta CSP actuelle, au défaut** (« Depuis un CDN » cochée et libre, rien d'écrit dans le document) : ton app reçoit l'adresse
   ci-dessus et l'empreinte du CDN ; au clic sur « Écriture en direct », **le navigateur refuse le script** (`script-src-elem`, à
   l'adresse exacte, et sa console le dit), ton app dit « Écriture en direct impossible » avec la raison, la ligne reste grisée
   (« Cliquer pour réessayer »), rien n'est posé sous `GfsPaquets` et aucune table n'est créée. Choisir « Copie de GFS » dans la
   fenêtre de GFS remet le direct en marche au clic suivant (la copie passe par `'self'`, sans rien nommer) ;
2. **avec l'adresse dans la CSP** : le direct démarre par le CDN comme par la copie, un seul
   `<script type="module" integrity crossorigin="anonymous">` à l'adresse exacte, aucun refus, `GfsPaquets['edition-live']` en 1.0.0
   avec les cinq modules, la table `Publipostage_Direct` née par le courtier, la frappe qui arrive, la table vidée à l'arrêt ;
3. **avec une fausse empreinte du CDN** dans le catalogue (cet essai seulement, l'adresse étant dans la CSP) : la CSP laisse passer,
   c'est le navigateur qui refuse le fichier, et ton app dit pourquoi : l'empreinte est bien contrôlée à l'adresse du CDN.

**Non mesuré** : le vrai jsDelivr, que ni le cloud ni le labo n'atteignent. À l'adresse du CDN, le miroir du labo rend les octets
exacts de la copie de GFS, avec l'en-tête CORS et le type JavaScript ; le porteur reçoit de GFS la commande qui compare le vrai CDN
à la copie (`node outils/bibliotheques.mjs --verifier-cdn`, dans `prototype/` : octets, en-tête CORS, type). Aussi non mesuré : un
autre navigateur que Chromium.

## Pourquoi

1. La 013 l'avait annoncé : si GFS ajoutait un mode CDN à ce fichier, une consigne te donnerait l'adresse à nommer dans ta CSP,
   comme pour Plotly (007). Le porteur a demandé le 19/10 de l'offrir tout de suite.
2. **Tant que ta CSP ne la nomme pas**, la personne qui a coché « Édition collaborative » sans choisir de mode passe, avec le défaut
   « Depuis un CDN », d'un mode qui marchait (la copie, seul mode jusque-là) à un mode que son navigateur refuse. L'app le dit et la
   sortie est une case de GFS (point 4.1), mais c'est un recul à fermer au plus tôt : d'où le « avant le reste ».
3. L'adresse est **provisoire** : elle change avec le dépôt public définitif de GFS (organisation `grist-factory`, cahier, question 5)
   et avec une nouvelle version du fichier assemblé (nouveau fichier, nouveau commit épinglé). Chaque changement est une nouvelle
   consigne qui remplace celle-ci, qui ne bougera pas.
4. Rien ici ne change une règle : le contrat 2.6 (point 11), la 007 pour la CSP, la 013 pour le reste, et le choix du porteur.

## Fait quand

`GFS-ETAT.md` donne « 016 · faite · `commit` » quand : (a) la CSP d'`index.html` nomme l'adresse du point 2, entière et seule,
à côté de celle de Plotly ; (b) ton garde-fou la garde ; (c) ton essai de CSP (comme celui de Plotly, consigne 007) charge le
fichier du CDN à cette adresse, avec son empreinte, sous ta politique, et refuse une autre adresse de jsDelivr ; (d) le direct
démarre par le CDN de GFS, au défaut de la fenêtre « Apps et extensions », dans une copie de GFS
(`consignes/TESTER-AVEC-GFS.md`) ou avec le vrai jsDelivr. Si l'adresse change, une nouvelle consigne te le dit.
