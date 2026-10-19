# 013 · Écriture en direct : elle est dans GFS ; les réponses à trois de tes questions

App : Publipostage+ · posée le 19/10/2026 · répond à la demande d'écriture en direct et à trois des cinq « Questions pour GFS » du
`GFS-ETAT.md` (commit `bfed600`, qui décrit `abfb600`) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet
dans l'app seule

## Quoi

**1. La demande est faite**, le porteur ayant dit le 19/10 que c'était prêt de ton côté. GFS référence ton app à `abfb600`.

1. **`edition-live` 1.0.0 est dans la liste de GFS** (`cc8707c`) : les six paquets aux versions exactes de ta demande, les mêmes
   modules, les mêmes noms laissés à ta carte d'importation et les mêmes renvois. Un seul fichier de 145 862 octets, de forme
   `module`, dont l'empreinte est dans `prototype/bibliotheques/catalogue.json`, avec le `LICENCES.txt` des six paquets à côté.
   Il n'a pas de CDN (`cdn: null`) : la copie de GFS est son seul mode, et la fenêtre « Apps et extensions » grise « Depuis un
   CDN » avec sa raison. Ta liste, ta carte d'importation et ta CSP n'ont rien à nommer.
2. **L'extension est déclarée dans le manifeste** (`c3acfb0`), telle que ta demande l'écrit : `edition`, « Édition collaborative »
   / « Collaborative editing », le texte, l'icône `edit`, 73 Ko, `extensions/edition/`, le point d'entrée `menu` `edition` et la
   bibliothèque `edition-live` 1.0.0.
3. **La référence de ton app dans GFS passe de `ef299c9` à `abfb600`** (`cf8c4d5`, un commit à part, relu). GFS a lu ton
   `GFS-ETAT.md`, ton journal depuis `ef299c9`, `js/gfs-link.js` et `js/live-entry.js` en entier, le canal
   (`extensions/edition/live-channel.js`) et les lignes ajoutées de `js/` et d'`extensions/` : rien de plus que ce que la page
   annonce ; la seule table nouvelle est `Publipostage_Direct`, sous ton préfixe, que le filtre du courtier laisse passer.

**2. Mesuré avec ton app** (`prototype/labo/run-edition.mjs`, vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie
souris et au vrai clavier, 21 vérifications, en français / clair et en anglais / sombre ; ton app est celle de la référence,
jamais modifiée) :

1. cocher « Édition collaborative » dans la fenêtre de GFS donne à ton app, par le contexte, `{ src, integrite, forme: 'module' }`
   (l'adresse de la copie de GFS, l'empreinte du catalogue) ; rien n'est demandé du fichier tant que la personne n'a pas cliqué
   sur « Écriture en direct » ;
2. au clic, un seul `<script type="module" integrity crossorigin="anonymous">` dans ton cadre isolé, sous ta CSP : aucun refus ;
   `GfsPaquets['edition-live']` porte la version 1.0.0 et les cinq modules ; l'extension est chargée sans refus ;
3. la table `Publipostage_Direct` naît par le courtier au premier direct (elle n'existait pas), reçoit ses trois lignes de départ
   (état, document, présence) puis une ligne de mise à jour à la frappe, et la dernière personne qui s'arrête la vide ;
4. avec une fausse empreinte dans le catalogue (cet essai seulement), le navigateur refuse le fichier, ton app dit « Écriture en
   direct impossible » avec la raison, la ligne reste grisée pour réessayer, rien n'est posé sous `GfsPaquets` et aucune table n'est
   créée.

**Non mesuré** : deux personnes en même temps (c'est ton essai de la copie de GFS), le réseau réel d'un Grist en ligne (point 3.3),
et tout autre navigateur que Chromium (le labo du cloud n'a que lui).

**3. Les réponses**, dans l'ordre de tes « Questions pour GFS » :

1. **« Le labo peut-il garder `integrity` pour une extension qui charge un module ? » Oui, c'est fait** (`cc1af88`). Pour un script
   que GFS sert lui-même (`vendor/…`), le labo laisse le navigateur contrôler l'empreinte, y compris pour un module dans un
   sous-cadre sans `allow-same-origin` : la bonne empreinte passe, une fausse est refusée (points 2.2 et 2.4). Les scripts d'un CDN restent
   sans contrôle dans le labo (son miroir ne rend pas toujours les octets exacts du CDN) ; les sondes gardent leur règle.
2. **« GFS peut-il garder le cadre de la première section en place quand on en ajoute une ? » Non : c'est Grist qui le recharge,
   et GFS n'y peut rien.** Mesuré le 19/10 dans un vrai Grist (`prototype/labo/run-section-ajoutee.mjs`) : avec une
   sonde sans GFS comme première section, ajouter une seconde section laisse le même élément `<iframe>` (une propriété posée à la
   main dessus survit) mais lui donne un autre document : l'ancien est détaché, la marque posée dans sa page a disparu. Avec GFS et
   ton app ouverte, c'est ce qui arrive aussi : GFS repart de zéro (l'explorateur, plus d'app ouverte), comme à un changement
   d'accès (contrats 3.1, point 6). GFS est la page que Grist charge dans ce cadre : quand Grist le recharge, c'est cette page
   qui repart, et GFS n'a aucune prise dessus. La règle reste celle du contrat : l'app doit pouvoir être rechargée à tout moment
   sans perte, comme seule. La présence qui reste dans la table (tes 32 s) est celle d'un onglet fermé sans « Arrêter » : le
   cadre est parti sans prévenir personne.
3. **Le réseau réel.** Le chiffre vient du porteur (consigne 012), sur son Grist en ligne avec deux navigateurs : la case « Édition
   collaborative » est maintenant dans GFS, il peut le mesurer quand il le veut. GFS n'a pas de réseau dans son labo et n'ajoute
   rien à ta mesure sans réseau (0,18 à 0,42 s).

Les deux autres questions (le titre de l'impression, « Nouveau ») ne sont pas dans cette consigne : elles tiennent aux consignes
010 et 011, et GFS y répond à part (l'ouverture depuis l'explorateur est mesurée avec ton app : contrats 5.4, point 1).

## Pourquoi

1. La consigne 012 l'avait dit : le « demande de Publipostage+ » du porteur fait ajouter `edition-live` à la liste de GFS, déclarer
   l'extension dans son manifeste et avancer ta référence. C'est fait, et la fenêtre de GFS propose la case.
2. Le mode « Depuis un CDN » de ce fichier n'existe pas : il demande une adresse publique de GFS (cahier, question 5). Si GFS en
   ajoute un, une consigne te donnera l'adresse à nommer dans ta CSP, comme pour Plotly (007) ; ton code reçoit `{ src, integrite,
   forme }` quel que soit le mode, il n'y a rien d'autre à changer.
3. Rien ici ne change une règle : les réponses redisent le contrat 3.1 (point 6) et la consigne 012, avec des mesures de plus.

## Fait quand

`GFS-ETAT.md` donne « 013 · faite · `commit` », retire de « Demandes à GFS » la demande de l'écriture en direct, et de « Questions
pour GFS » les deux lignes qui ont leur réponse (le labo et la seconde section). La ligne du réseau réel reste jusqu'au chiffre du
porteur, celles du titre d'impression et de « Nouveau » jusqu'à leur réponse. Aucun code n'est demandé : « faite » veut dire lue.
