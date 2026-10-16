# 010 · Ouvrir le modèle que GFS désigne

App : Publipostage+ · posée le 16/10/2026 · remplace la 003 · quand : pour que le double-clic de l'explorateur de GFS
ouvre le modèle cliqué ; sans effet dans l'app seule

## Quoi

Hébergée par GFS, l'app ouvre le modèle que GFS lui désigne et dit pourquoi dans son coin d'état. Les messages sont ceux de
`docs/contrats.md` (GFS, sections 5.1, 5.2 point 3 et 5.4 point 1) ; ce contrat est un brouillon qui évolue avec le prototype, et
GFS annonce tout changement de message par une nouvelle consigne. Ce que la 003 demandait en premier (se savoir hébergée,
appeler `contexte`) est fait par `js/gfs-link.js` (005) : il reste l'`ouverture` du contexte, l'appel `ouvrir` et la phrase
d'état.

1. **Lire `ouverture`.** `js/gfs-link.js` garde aujourd'hui `extensions`, `bibliotheques` et `adresseWidget` du contexte ; il
   garde aussi `ouverture` et la rend (par exemple `GfsLink.opening()`). Elle vaut `null` ou `{ fichier, type, dossier, raison }`
   (contrats 5.2, point 3), où `fichier` est `null` ou `{ id, type }` : l'`id` est le numéro de ligne du modèle dans
   `Publipostage_Modeles`, pris comme texte. Seule, ou sans réponse de GFS : `null`.
2. **À l'arrivée.** `init()` attend `GfsLink.ready` (aussitôt seule ; 5 secondes au plus hébergée) avant de choisir le modèle de
   départ (`startupTemplateId`, `js/main.js` ligne 2897). Si `ouverture.fichier` désigne un modèle qui s'ouvre
   (`Templates.openableById`), c'est celui-là, **avant** l'ordre habituel (la ligne, le modèle de la vue, ★). Si `ouverture` est
   `null`, si `fichier` est `null` (« Nouveau » : hors de cette consigne), si le modèle est introuvable ou d'un type que la garde
   de la 002 n'ouvre pas : l'ordre habituel, sans message d'erreur.
3. **Quand elle est déjà ouverte.** GFS lui envoie l'appel `ouvrir` (enveloppe de 5.1 : `type: 'appel'`, `nom: 'ouvrir'`, `id`,
   `args: { fichier, type, dossier, raison }`). `js/gfs-link.js` ne lit aujourd'hui que des réponses et l'événement
   `extensions` : il lit aussi cet appel, avec la même vérification (`event.source === window.parent`, `gfs` égal au contrat de
   l'adresse), et le passe à celui qui s'est inscrit (par exemple `GfsLink.onOpen(fn)`). L'app ouvre le modèle par le chemin du
   sélecteur, donc avec sa question « Enregistrer / Abandonner / Annuler » si des modifications attendent
   (`openTemplateForRow`, `js/main.js` ligne 527), puis répond au parent
   `{ gfs: <n>, type: 'reponse', id, data: { ouvert } }`, sans délai : la personne peut prendre son temps.
   - `ouvert: true` quand le modèle demandé est ouvert à la fin, y compris quand c'était déjà lui (`openTemplateForRow` rend
     alors `false` : ne pas s'en servir tel quel) ;
   - `ouvert: false` si la personne annule, si le modèle est introuvable ou si la garde de la 002 ne l'ouvre pas ;
   - un appel reçu avant la fin du démarrage attend cette fin ;
   - tout autre `nom` d'appel reçoit `{ type: 'erreur', id, code: 'GFS_INCONNU', message }` (5.1, point 3).
4. **Dire pourquoi.** Dans le coin d'état (`setStatus`, `js/main.js` ligne 84), une phrase courte selon `raison` : pour
   `explorateur`, « Ouvert depuis l'explorateur. ». Une raison qu'elle ne connaît pas n'affiche rien. Elle s'écrit après ce qui
   remplace le coin d'état à l'ouverture (le message « Widget prêt » au démarrage, l'état d'enregistrement du modèle chargé).
   Français et anglais dans le même lot.
5. **Rien d'autre n'est écrit.** Ouvrir un modèle ainsi ne change ni le modèle de la vue (`modeleDeLaVue`), ni le ★, ni aucun
   réglage : la personne n'a pas d'« Enregistrer » à faire dans Grist.

L'écoute des messages de GFS suit la règle 7 du guide (1.1) : `addEventListener('message')`, jamais `window.onmessage =`, comme le
fait déjà `js/gfs-link.js`. Ce que l'app fait d'une ouverture tient dans un petit fichier à part, pas dans `js/main.js`. Lignes
relevées sur `47fae07` le 16/10, à relire sur `origin/main`.

## Pourquoi

Le prototype de GFS montre les modèles du document dans son explorateur ; un double-clic doit ouvrir Publipostage+ sur ce
modèle, pas sur celui qu'elle ouvre d'habitude. Le 14/10, le porteur avait écrit au projet de l'app (`GFS-ETAT.md`, ligne 003)
qu'il ne voulait pas qu'on adapte l'app pour cela. Le 16/10, sur une carte de décision, il a eu les faits : l'app n'a aucune porte
pour choisir un modèle, et la seule autre voie (GFS écrit « Modèle par défaut de cette vue ») écraserait son choix pour la vue et
ferait apparaître « Enregistrer » dans Grist. Il a choisi la petite porte dans l'app. Cette consigne remplace donc la 003, que
`GFS-ETAT.md` peut passer à « remplacée par la 010 ». C'est la même porte que toutes les apps auront (contrats 5.4) ; seule,
l'app ne change pas.

## Fait quand

Un test échoue sur le code d'avant et passe après. Avec `gfs=0` dans son adresse et un GFS simulé par le test
(`dev-tests/gfs-stub.js`) qui répond à `contexte` avec l'`id` d'un modèle autre que son modèle habituel, l'app ouvre ce modèle et
écrit sa raison ; avec `ouverture: null`, `fichier: null`, un `id` inconnu ou un type que la garde de la 002 n'ouvre pas, elle
suit l'ordre habituel. Un appel `ouvrir` ensuite change de modèle (avec la question d'enregistrement si des modifications
attendent) et reçoit `{ ouvert: true }` ; `{ ouvert: false }` si la personne annule ; `{ ouvert: true }` sans rien changer si
c'est déjà ce modèle ; un autre nom d'appel reçoit `GFS_INCONNU`. Sans `gfs` dans l'adresse, rien n'est envoyé ni écouté de plus
et l'ordre d'arrivée est celui d'aujourd'hui. La mesure dans un vrai Grist se fait ensuite avec le prototype, par GFS, qui avance
alors sa référence et retire sa phrase « Provisoire ». À vérifier comme le reste de l'interface : 700 × 400, clair et sombre,
français et anglais. `GFS-ETAT.md` donne la ligne « 010 · faite · `commit` ».
