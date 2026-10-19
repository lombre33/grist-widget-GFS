# Rapport de l'étape 2 : le prototype du courtier

Écrit le 14/10/2026 pour le porteur. GFS `0.2.0-proto`, dépôt `lombre33/grist-widget-GFS`, publié par GitHub Pages. Sauf mention
contraire, chaque mesure vient d'un vrai Grist (grist-static 0.1.6, dans Chromium 141), jouée à la vraie souris, avec Publipostage+
et Automation+ **non modifiées** (sous-modules). Pour refaire une mesure : `labo/LISEZ-MOI.md`. Les captures sont dans les fichiers
du projet (`gfs/prototype/captures/`), pas dans le dépôt.

## En bref

**Ce qui marche**

- Publipostage+ et Automation+ tournent dans leur cadre isolé sans une ligne changée : elles lisent leur table, reçoivent le
  thème clair ou sombre et la langue, créent leurs tables. Le courtier ne leur refuse rien et aucune erreur de script n'apparaît.
- Le courtier tient : un message qui ne vient pas de l'app active est jeté ; un nom de table réservé est refusé même déguisé
  (27 noms essayés : accents, lettres larges, tirets, espaces) ; un lot dont une action est refusée n'écrit rien.
- La bibliothèque d'une extension (Plotly) arrive de GFS avec son empreinte. La copie de GFS se charge sous les six protections
  d'app essayées ; le CDN sous quatre sur six (section 1, point 4).
- GitHub Pages sert GFS et ses deux apps en sous-modules ; la publication prend de 28 à 90 s.
- Un cadre de plus coûte de 0,1 à 0,5 s à l'ouverture et quelques Mo : rien qui empêche de garder un cadre par app.

**Ce que le cadre isolé coûte aux apps** (détail en section 3)

- Plus de stockage du navigateur : les deux apps démarrent quand même, mais GFS devra le leur fournir (le kit, étape 3).
- L'impression par un cadre caché, celle de Publipostage+, ne marche pas : elle devra imprimer par sa propre page.
- Un lien « écrire un e-mail » qui s'ouvre dans le même cadre casse le cadre ; dans un nouvel onglet, il marche.
- Ce que le cadre ne fait pas : empêcher une app d'appeler un serveur extérieur. Ni lui ni un site par app n'y changent rien ;
  seule la protection de la page de l'app (sa CSP) le limite.

**Ce qui reste, et qui dépend de toi**

- Quatre décisions, en cartes : l'isolement (question 3), les références des apps (question 1), où retenir les apps installées
  (question 9, rouverte par ta question sur « Enregistrer »), et comment ouvrir Publipostage+ sur le bon modèle (section 8).
- Trois mesures que toi seul peux faire (section 7) : Firefox et Safari, ton vrai Grist, l'empreinte du CDN.
- Une précision pour Publipostage+, qui a déjà commencé la consigne 005 : sa protection garde l'adresse du CDN (nouvelle
  consigne 007, section 4, point 8). Pour qu'il la lise, dis-lui « nouvelle consigne GFS ».

## 1. Les dix mesures du cahier (section 9)

| # | Mesure | Où on en est | Ce qui a été mesuré |
|---|---|---|---|
| 1 | Relais des messages avec les deux apps | Mesuré | Les deux apps s'ouvrent dans leur cadre isolé, lisent leur table, reçoivent thème et langue ; Publipostage+ crée ses quatre tables ; zéro refus du courtier, zéro erreur de script. Une app qui démarre après GFS apprend ses options en 10 à 13 ms et ses lignes en 48 à 75 ms. Un refus du courtier (nom réservé, niveau d'accès insuffisant) et une erreur de Grist reviennent, avec leur code, à l'app qui les a provoqués. |
| 2 | `grist.ready()` de GFS et de l'app | Mesuré | L'appel de l'app est absorbé : le panneau de droite de Grist garde la configuration de GFS (aucune colonne à faire correspondre) et l'app lit son propre niveau d'accès (`full`). |
| 3 | Impression, téléchargements, fenêtres, e-mail, presse-papiers, plein écran | Mesuré dans Chromium ; Firefox et Safari : ta page (section 7) | Section 3 : tout marche sauf l'impression par un cadre caché ; la lecture du presse-papiers et le plein écran sont refusés comme dans Grist sans GFS ; un lien e-mail dans le même cadre le casse. |
| 4 | Protection de l'app et modules ES en origine opaque ; carte d'importation d'esm.sh ; protection de GFS ; bibliothèque d'extension | Mesuré (CDN réel : section 7) | Les modules ES des deux apps se chargent dans l'origine opaque. La protection de GFS (`frame-src 'self'`) suffit à ses sous-cadres ; chaque script et chaque feuille de style de GFS se charge une fois, à son adresse versionnée (28 vérifications de la fenêtre « Apps et extensions »). Bibliothèque d'extension, six protections d'app : la copie de GFS se charge dans les six, sans que l'app la nomme ; le CDN se charge quand la protection de l'app nomme son adresse ou son empreinte, ou admet de charger le texte puis de l'exécuter (quatre cas), et il est refusé quand elle n'en dit rien ou ferme les connexions (deux cas) ; une fausse empreinte est toujours refusée. Voir section 4, point 8. La page de Publipostage+, carte d'importation d'esm.sh comprise, démarre dans le cadre isolé (le labo sert esm.sh depuis un miroir : l'éditeur et le vrai esm.sh se vérifient en ouvrant Publipostage+ dans ton Grist). |
| 5 | Stockage du navigateur en origine opaque | Mesuré | Les cinq stockages (`localStorage`, `sessionStorage`, cookies, `indexedDB`, cache) sont refusés. Publipostage+ et Automation+ démarrent quand même (leurs accès sont gardés). GFS ne fournit pas encore de stockage (`contexte.stockage` vide) : il viendra avec le kit. |
| 6 | API REST par jeton depuis un cadre isolé | Tuyauterie mesurée ; l'instance réelle se mesure chez toi | Grist du labo ne délivre pas de jeton : le courtier relaie `getAccessToken` avec la même issue que sans lui. La suite (CORS depuis l'origine `null`, jeton dans l'adresse, pièces jointes, tables internes par SQL) est vérifiée avec un répondeur de remplacement : c'est de la tuyauterie, pas un vrai Grist. Par le code de Grist : une origine `null` reçoit `Access-Control-Allow-Origin: *`, et le jeton se donne dans l'adresse (l'en-tête `Authorization` est refusé). La sonde `reel/` le vérifie sur ton instance. |
| 7 | Site Pages avec une app en sous-module, et le kit imbriqué ; avec et sans `.nojekyll` | Mesuré, sauf le kit imbriqué (il n'existe pas : étape 3) | Les deux apps en sous-modules sont servies. Avec `.nojekyll` : 28 à 50 s de publication (une fois 90 s) et aucune étape Jekyll ; sans : 53 et 72 s, avec en plus l'image de Jekyll à tirer (18 s) et sa construction (6 s). Jekyll transforme les Markdown, écarte les fichiers dont le nom commence par « _ » ou « . » et peut échouer sur un `{{` (connu, non provoqué ici). La toute première publication a pris près de 9 minutes. On garde `.nojekyll`. |
| 8 | Coût d'un cadre de plus dans le panneau de 700 × 400 | Mesuré | L'app est montrée 0,41 à 0,46 s après « Ouvrir » (Publipostage+, trois passages) et 0,10 à 0,16 s pour une app minimale ; 3 à 5 Mo de mémoire JavaScript en plus (1 Mo pour l'app minimale) ; aucun processus ni rendu en plus ; pas de hausse mesurable de la mémoire du navigateur. |
| 9 | Outil d'audit et dossier `extensions/` non atteint par la page d'entrée | Mesuré | Si l'extension est chargée par une adresse calculée, l'outil ne la lit pas : 2 fichiers sur 3 dans la surface, et ses défauts (un `eval`, un `innerHTML`) n'apparaissent pas. Si elle est chargée par un chemin à début fixe, il la lit : 3 sur 3, défauts rapportés. Voir section 6. |
| 10 | Version de Grist de l'instance visée | Chez toi | La sonde `reel/` relève le niveau de schéma du document (46 dans le labo) ; la version de Grist se lit dans « Aide », « À propos ». |

## 2. Les onze points du contrat (section 9 de `docs/contrats.md`)

| # | Point | Où on en est |
|---|---|---|
| 1 | Rejeu à la reprise | Mesuré : une app qui démarre après GFS apprend ses options, ses lignes et sa ligne courante sans rien demander. |
| 2 | `configure` absorbé | Mesuré : l'accès de la section et la configuration de GFS ne bougent pas. |
| 3 | Impression | Mesuré : « Print widget » de Grist arrive à l'app active ; sans app, GFS imprime sa page ; une app qui ne répond pas : après 10 s, GFS imprime sa page (l'app, dedans, imprime avec elle). |
| 4 | Ordre des écouteurs | Mesuré dans Chromium avec le vrai script d'API de Grist ; Firefox et WebKit : ta page. |
| 5 | Jeton depuis un sous-cadre opaque | Relais mesuré ; l'instance réelle : la sonde `reel/`. |
| 6 | Noms normalisés | Mesuré : 27 noms, aucun écart dangereux ; avec un jugement volontairement affaibli, le contrôle de l'identifiant réel arrête quand même chaque nom réservé et retire la table ; `RenameTable` rend l'identifiant réel. |
| 7 | Verbes, tables internes, `ApplyUAOptions` contre l'instance visée | Dans le labo, les 17 verbes autorisés passent et Grist accepte les options `desc`, `parseStrings`, `otherId`, `linkId` et même une clé inconnue : le tri du courtier (seuls `desc` et `parseStrings`) est donc la seule défense. Ton instance : la sonde `reel/`. |
| 8 | Cadre qui navigue ; politique imposable au sous-cadre | Mesuré (section 3 et section 4, point 6). |
| 9 | Coût de la lecture des fichiers dans un document lourd | Mesuré : 118 modèles, environ 20 Mo : l'explorateur est prêt 2,7 s après le démarrage (première lecture 2,9 s), puis 0,2 à 1,6 s ; la lecture prend toute la table (Grist ne sait pas en lire une partie). |
| 10 | Cadre reconstruit | Mesuré : Grist reconstruit le cadre en 59 à 83 ms quand le niveau d'accès change, GFS est prêt 0,4 s après ; ni réglage ni table perdus ; l'app se rouvre sans recréer de table. |
| 11 | Bibliothèque d'extension | Mesuré : point 4 de la section 1 ; chaque fois qu'elle se charge, la bibliothèque dessine bien un graphique (`Plotly.toImage` rend une image vectorielle de 7 752 octets). |

## 3. Le cadre isolé : ce que l'app peut faire (la décision d'isolement)

Le cadre isolé (la « cage ») est le sous-cadre où GFS fait tourner une app, avec des drapeaux `sandbox` qui lui retirent son
origine (`allow-same-origin` absent). Même essai, joué dans Grist sans GFS (l'app est alors un widget ordinaire) et dans la cage.

| Ce que fait l'app | Dans Grist sans GFS | Dans le cadre isolé de GFS |
|---|---|---|
| Garder des réglages dans le navigateur | Oui (au nom du site de l'app, partagé avec les autres apps du même site) | **Non** : les cinq stockages sont refusés |
| Imprimer sa page (`window.print`) | Oui | Oui |
| Imprimer par un cadre caché (Publipostage+ aujourd'hui) | Oui | **Non** : les quatre façons essayées échouent (le cadre n'est pas lisible par l'app) |
| Télécharger un fichier (`<a download>`, blob ou data) | Oui | Oui |
| Ouvrir une fenêtre ou un lien dans un nouvel onglet | Oui, la page ouverte a le vrai site | Oui, mais la page ouverte reste en cage (pas de stockage) |
| Lien « e-mail » dans un nouvel onglet | Rien ne casse | Rien ne casse (le logiciel de messagerie qui s'ouvre se confirme par ta page) |
| Lien « e-mail » dans le même cadre | Rien ne casse | **Le cadre meurt** (page d'erreur) : la liste des cadres permis de GFS ne connaît pas `mailto:` ; avec `mailto:` ajouté, il survit |
| Écrire dans le presse-papiers | Oui | Oui |
| Lire le presse-papiers ; plein écran | Non (Grist ne le permet pas) | Non, pareil |
| Appeler un autre site (`fetch`) | Oui | Oui : **le cadre ne coupe pas le réseau** |
| Aller sur une autre page du même site | Oui | Oui (le canal avec GFS reste) |
| Aller sur un autre site | Oui | Non : le cadre meurt |
| Envoyer toute la page de Grist ailleurs (après un clic) | **Oui** (la page demande « quitter ? ») | **Non** |

Ce que la cage apporte en plus : l'origine de chaque app devient « nulle », donc deux apps du même site ne partagent plus rien
dans le navigateur, et une app ne peut plus renvoyer toute la page de Grist ailleurs. Variante « même origine que GFS »
(`allow-same-origin`) : elle rend le stockage et l'impression, mais une app y pourrait lire et piloter GFS et ses voisines, et
retirer sa propre cage (fait connu du navigateur, non essayé ici) : écartée.

**Décision d'isolement (question 3). Conseil : cadres isolés, sans `allow-same-origin` ; des domaines seulement si un audit
l'exige.**

- Un site par app (mêmes drapeaux `sandbox`, avec `allow-same-origin` cette fois sans danger puisque l'origine diffère ;
  raisonnement, non essayé ici) rendrait aux apps leur stockage et leur impression. Il coûte un nom de site par app et une
  adresse de plus à déclarer dans GFS à chaque app ; il ne retire rien à ce que la cage empêche déjà et ne coupe pas non plus le
  réseau.
- Le passage d'un choix à l'autre ne touche ni le courtier, ni le filtre, ni le manifeste : il se fera si un audit l'exige.
- Les trois prix de la cage se règlent chacun à un seul endroit : le stockage par le kit (étape 3), l'impression de
  Publipostage+ par sa propre page, le lien e-mail par `target="_blank"` ou par `mailto:` dans les cadres permis de GFS.

## 4. Ce que ça change dans les contrats (petits commits : les points 6 et 8 sont faits, les autres suivent tes réponses)

1. **Contrats 3.3, point 4** : « `RenameTable` ne rend rien d'exploitable » est faux. Il rend l'identifiant réel. Le courtier
   relit quand même `_grist_Tables`, qui ne dépend pas de la forme de la réponse.
2. **Contrats 1.2, point 1** : le [M] se ferme pour Chromium. Ajouter : la phase de capture ne protège pas, c'est l'ordre
   d'enregistrement qui décide. Contrôle fait : si le routeur s'enregistre après le script d'API de Grist, un faux message d'un
   cadre voisin arrive à Grist.
3. **Contrats 1.3, point 1** : la liste exacte des permissions est celle de la section 3. À choisir à l'étape 6 : ajouter
   `mailto:` et `tel:` à `frame-src` de GFS, ou exiger des apps un nouvel onglet pour ces liens.
4. **Contrats 1.4, point 3** : le cadre peut aller sur une autre page de GFS, pas sur un autre site (il meurt), pas sur le haut
   ni le parent.
5. **Contrats 2.4, point 2** : coût mesuré de la lecture entière (section 2, point 9).
6. **Contrats 3.7, point 4** : l'attribut `csp` du cadre est refusé tant que le serveur de l'enfant n'envoie pas
   `Allow-CSP-From` (GitHub Pages ne le fait pas) ; un cadre fabriqué par `srcdoc` ou `blob:` hérite de la politique de GFS et
   perd son script en ligne ; `blob:` est refusé par `frame-src 'self'` tant qu'on ne l'ajoute pas. Chez un client qui héberge
   GFS, son serveur peut envoyer l'accord : l'attribut impose alors la politique (mesuré). **Fait** (3.7, point 4).
7. **Contrats 4.3 (impression)** : le relais est mesuré, avec le repli de 10 s.
8. **Contrats 2.6, point 4, et 5.2, point 5 ; cahier (décision du 14/10 sur les bibliothèques non natives, 3.3 point 4 et
   4.7) ; consigne 005 : en mode CDN, la protection de l'app doit laisser entrer l'adresse exacte du CDN**, celle du catalogue
   de GFS (mesuré, point 4 de la section 1). Aucun sous-cadre ne reçoit sa politique de GFS : seule celle de la page de l'app
   compte. En mode copie, rien n'est à nommer (`'self'` suffit). Cela découle de ta réponse « CDN d'abord » (la carte disait
   « chaque app nomme l'adresse dans sa protection »), mais la consigne 005 disait le contraire (« ni la CSP ») : appliquée
   telle quelle, elle aurait retiré l'adresse du CDN de la protection de Publipostage+, et le graphique ne se serait plus
   chargé en CDN. **Fait.** Le projet de Publipostage+ avait déjà lu la 005 (« en cours » dans son état) et une consigne
   publiée ne change pas : la précision est la nouvelle consigne 007, et le guide, le cahier et les contrats disent la même
   chose. Reste à lui dire « nouvelle consigne GFS ».
9. **Guide des apps (1.2, point 7) et cahier 3.3, point 2** : l'outil d'audit lit un `import()` à début fixe, pas une adresse
   calculée (section 6).
10. **Contrats 5.3** : en cadre isolé tous les stockages sont refusés ; `contexte.stockage` reste vide jusqu'au kit.

## 5. Défauts trouvés, et vraies nouveautés

**Défauts (avec ce qu'ils auraient coûté)**

| Défaut | Impact | État |
|---|---|---|
| GFS sans l'accès complet affichait l'erreur anglaise de Grist et « Aucun fichier » | Une personne qui ajoute GFS par son adresse (accès « aucun » au départ) croyait son document vide | Corrigé : un bandeau dit quoi faire, les menus sont grisés avec la raison |
| Le cache de Pages (10 minutes) mélangeait anciens et nouveaux modules | Après une publication, la page pouvait ne plus démarrer pendant dix minutes | Corrigé : une empreinte dans chaque adresse, et un test qui échoue si elle est périmée |
| Pages sans `.nojekyll` | Markdown des apps transformés, fichiers en « _ » ou « . » écartés, construction pouvant échouer | Corrigé |
| La consigne 005 contredit la mesure du CDN | Le graphique ne se chargerait plus en CDN dans Publipostage+ | Corrigé par la consigne 007 (section 4, point 8) ; reste à dire « nouvelle consigne GFS » à son projet |
| Le contrat disait que `RenameTable` ne rend rien | Sans conséquence : le courtier relit les tables | Texte à corriger |
| Installer une app n'est qu'un brouillon tant qu'« Enregistrer » n'est pas cliqué | Un rechargement avant le clic efface l'installation | Décision : question 9 |
| Le script d'API de Grist pose un style en ligne que la politique de GFS refuse | Un message dans la console, aucun effet visible (le thème passe par des attributs, clair et sombre se voient) | Accepté |
| Une extension chargée par une adresse calculée échappe à l'audit | Son code n'est relu par personne | Question qui attend (section 6) |

**Vraies nouveautés (des faits que le cahier ne savait pas)**

- Sans GFS, une app peut renvoyer toute la page de Grist ailleurs après un clic. Dans le cadre isolé, non.
- Le routeur doit être le premier script de la page : la phase de capture n'y change rien.
- Aucune voie du navigateur n'impose une politique à un sous-cadre servi par Pages. La protection du mode CDN est celle de la
  page de l'app.
- Le jeton REST se donne dans l'adresse ; l'en-tête `Authorization` est refusé (d'après le code de Grist).
- Grist accepte une clé inconnue dans les options d'`applyUserActions` : le tri du courtier est la seule défense.
- Une fenêtre ouverte depuis une app garde la cage. Lui permettre de s'en échapper donnerait au site ouvert le vrai site de GFS :
  écarté.
- Le cadre isolé peut naviguer vers une autre page de GFS sans perdre son canal, mais pas vers un autre site ni vers le haut.

## 6. Limites de ces mesures, et ce qui attend

- **Un seul navigateur** : Chromium (Playwright), sans interface. Firefox et Safari : ta page. Un navigateur sans interface ne
  voit ni le logiciel de messagerie s'ouvrir, ni la boîte d'impression, ni un fichier arriver : la page te pose ces questions.
- **Grist du labo** : le vrai moteur, mais sans serveur : pas de jeton, ni utilisateurs ni règles d'accès. D'où la sonde `reel/`.
- **Aucun CDN ni le site publié depuis le cloud** : les bibliothèques de Publipostage+ viennent d'un miroir du labo ; que Pages
  publie, je le lis dans ses journaux de construction ; l'empreinte réelle du CDN : la commande de la section 7.
- **Publipostage+ ne comprend pas encore l'enveloppe de GFS** (la 005 est en cours chez elle ; la 003 attend ta réponse,
  section 8) : elle démarre sur son modèle habituel et charge son propre Plotly. Les six apps de test, elles, parlent à GFS.
- Pas mesurés : le kit imbriqué (il n'existe pas), un Grist sur un réseau interne (autorisations du navigateur pour le réseau
  local), un cadre fabriqué par `srcdoc` avec une vraie app (adresses relatives, `base-uri 'none'`).
- La fenêtre de première ouverture ne revient qu'une fois par navigateur (drapeau dans son stockage local, avec `try/catch`).
- **Question qui attend l'étape 5 : l'audit des extensions.** Les garder hors de la surface comptée (cahier 3.3, point 2)
  suppose un chargement par adresse calculée, que l'outil ne lit pas : leur code n'est alors relu par aucun audit. Mon avis :
  les auditer (chemin à début fixe), et si un seuil de lignes saute, demander à l'outil d'audit de compter les extensions à
  part. À trancher quand Publipostage+ range le graphique.

## 7. Ce que toi seul peux faire

1. **Ton navigateur (5 minutes, aucun document touché).** Dans Firefox, puis dans Safari, ouvre
   `https://lombre33.github.io/grist-widget-GFS/prototype/labo/navigateur/index.html`. Laisse la page mesurer, clique sur les
   boutons du cadre de haut en bas, réponds aux questions, puis « Copier le résultat » et colle-le dans la conversation.
2. **Ton vrai Grist.** Dans un document de **test**, ajoute un widget personnalisé à l'adresse
   `https://lombre33.github.io/grist-widget-GFS/prototype/labo/reel/index.html`, accorde-lui l'accès complet, note la version de
   Grist (Aide, À propos), lance « Lecture » (elle ne modifie rien), puis, si tu veux, « Écriture » (une confirmation te sera
   demandée : une table d'essai est créée, une vingtaine d'actions y sont jouées, puis elle est supprimée), puis
   « Copier le résultat ». Le texte ne contient ni le jeton ni l'identifiant du document.
3. **L'empreinte du CDN (facultatif).** Depuis `prototype/`, avec Node 18 ou plus et du réseau :
   `node outils/bibliotheques.mjs --verifier-cdn`. Il dit « catalogue cohérent » ou l'écart. Depuis le 19/10, il contrôle aussi le fichier
   assemblé de l'écriture en direct, servi par jsDelivr depuis le dépôt public de GFS : les octets (l'empreinte), l'en-tête CORS et le type
   JavaScript, que le navigateur exige d'un module à empreinte.

GitHub Pages met tout en cache dix minutes : après une mise à jour, recharge avec Ctrl+F5 (⌘⇧R sur Mac).

## 8. Publipostage+ : où en sont ses deux consignes, et ce que le prototype montrera

Le projet de Publipostage+ a lu ses consignes (son état du 14/10 : la 002 et la 006 faites, la 001 et la 005 en cours).

- **Ouvrir le bon modèle (consigne 003).** Aujourd'hui, un double-clic sur un modèle ouvre Publipostage+ sur son modèle habituel
  et GFS le dit (« Provisoire : Publipostage+ ne sait pas encore ouvrir un fichier précis »). Son projet a noté de ton côté que
  tu ne veux plus de la 003 (« GFS ouvre lui-même le bon modèle sans adapter l'app »). Or je l'ai relu dans son code : l'app n'a
  aucune entrée pour choisir un modèle (dans son adresse, elle ne lit que « readonly » et « dev »). La seule voie sans la
  toucher serait d'écrire le « modèle de la vue » qu'elle lit au démarrage (`modeleDeLaVue`), ce qui écraserait le choix fait
  pour la vue et ferait apparaître « Enregistrer ». D'où une carte pour trancher.
- **Graphique (consignes 005 et 007).** Aujourd'hui, la case « Graphique » et le choix « CDN » ou « copie de GFS » de la
  fenêtre « Apps et extensions » ne changent rien dans la vraie Publipostage+, qui charge son propre Plotly ; ils agissent
  seulement sur les apps de test. Une fois la 005 faite avec la 007, cocher « Graphique » active le graphique, décocher le
  grise, et le choix du mode change d'où vient la bibliothèque.
- Pour que son projet lise la 007, dis-lui « nouvelle consigne GFS ».

## 9. Captures

Dans les fichiers du projet, `gfs/prototype/captures/` : `automation-700x400.png` (Automation+ dans GFS, 700 × 400),
`acces-fr-light-1-sans-acc-s-none-.png` (GFS sans l'accès complet), `navigateur-chromium-light.png` (la page à ouvrir dans ton
navigateur, jouée dans Chromium), `reel-1-confirmation.png` et `reel-2-apres-ecriture.png` (la sonde de ton vrai Grist).
