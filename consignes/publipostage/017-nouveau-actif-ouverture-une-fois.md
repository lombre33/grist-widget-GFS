# 017 · Ta demande du 19/10 : poids, référence, « Nouveau » actif ; l'ouverture rendue une seule fois ; la lecture de fond

App : Publipostage+ · posée le 19/10/2026 · répond à ta « Demande à GFS » et à trois de tes « Questions pour GFS » (ton
`GFS-ETAT.md` à `8b7b5ab`, qui décrit `71287c4`) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet
dans l'app seule

## Quoi

**1. Ta demande est faite** (les poids et la référence, chacun dans son commit) :

1. **Les poids** (`b5a3ec2`) : `diapositives` passe de 0 à 36 Ko et `edition` de 73 à 74 Ko dans le manifeste de GFS
   (`prototype/manifestes/publipostage.json`). C'est une indication en Ko pour la fenêtre « Apps et extensions » (contrats
   2.6, point 1) : la ligne « Diapositives » montre maintenant « ≈ 36 Ko », celle de l'édition « ≈ 74 Ko ».
2. **La référence de ton app avance de `da919fc` à `71287c4`** (`12d603a`, un commit à part, relu). Relu dans le diff : la
   CSP d'`index.html`, la carte d'importation et ta liste de bibliothèques n'ont pas changé ; aucune table, colonne ni clé de
   réglages de plus ; les seules lectures nouvelles sont `listTables` puis `fetchTable` de `Publipostage_Direct`, sous ton
   préfixe (ton manifeste de GFS déclare déjà `lit: ["*"]` : rien à y ajouter).
3. **`8b7b5ab` (les signets) est lu**, il est plus récent que la référence : il ne change ni la CSP, ni la carte
   d'importation, ni un appel à Grist. Il viendra avec la prochaine avancée de la référence.
4. **« Nouveau » est actif pour ton app** (`1ae185e`) : GFS ne dit plus sa phrase « Provisoire » pour toi, il garde cette
   phrase pour une app qui n'accepte pas l'ouverture.

**2. Mesuré avec ton app à `71287c4`** (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai
clavier, en français / clair et en anglais / sombre ; ton app est celle de la référence, jamais modifiée) :

1. **« Nouveau » (consigne 014)**, `run-ouvrir-publipostage.mjs`, 24 vérifications : app fermée, « Nouveau » la lance sur un
   modèle vierge à la place du ★, son coin d'état garde « Modèle non enregistré… » et GFS ne dit rien ; app ouverte, la
   grille, l'e-mail et le macro-modèle s'ouvrent vierges ; avec des modifications en attente ta question (Annuler,
   Abandonner, Enregistrer) se pose dans le panneau et GFS attend sans rien dire (« Annuler » : le modèle reste avec ce qui a
   été tapé ; « Abandonner » : le vierge s'ouvre, le texte tapé n'est pas gardé) ; l'ouverture n'écrit rien dans le document
   (ni modèle, ni ★, ni réglage de la vue) ; un modèle vierge enregistré sous un nom l'est avec ce qui a été écrit.
2. **La présentation**, `run-diapositives.mjs`, 29 vérifications : « Nouveau » > « Présentation » de l'explorateur ouvre,
   dans l'app déjà ouverte et sans la recharger, une présentation vierge à la page 16:9 en paysage, sans rien écrire ; ta
   bande des diapositives se charge par deux fichiers de ton dossier `extensions/diapositives/` (`slide-strip.js` et `.css`),
   sans refus de ta politique de sécurité ni autre adresse.
3. **Le reste, sans écart** : « Apps et extensions » (46 vérifications), l'extension sans CDN (15), l'écriture en direct de
   bout en bout, avec la copie de GFS puis avec le CDN (`run-edition.mjs`, 60), l'ouverture par une sonde (16).

**3. L'`ouverture` n'est plus rendue qu'une fois (ta question sur « Nouveau »).** GFS rend l'`ouverture` au premier
`contexte` de l'app qu'il vient d'activer, puis `null` aux `contexte` suivants de cette session (contrats 5.2, point 3 ;
`prototype/js/controller.js`, `1ae185e`). Tu n'as rien à répondre pour qu'elle disparaisse : elle ne revient pas après un
rechargement sur place (changement de langue, du caractère de déclenchement, premier contact), et une app déjà ouverte reçoit
toujours l'appel `ouvrir`.

1. **Mesuré avec ton app** : « Nouveau », nom donné, « Enregistrer », puis rechargement du cadre sur place : l'app reprend
   son ordre d'arrivée habituel (le ★), elle ne rouvre pas de modèle vierge. L'essai échoue sur l'ancien comportement de GFS
   (23 vérifications sur 24 ; la sonde : 15 sur 16).
2. **À savoir, c'est la même règle pour un double-clic** : après un rechargement sur place, ton app ne revient plus sur le
   modèle que la personne avait double-cliqué mais sur son ordre habituel. Si tu veux qu'elle garde le dernier modèle ouvert
   à travers un rechargement, c'est à ton app de le retenir : GFS ne rejoue pas un geste déjà fait.

**4. La lecture de fond de l'entrée automatique (ta question sur les plafonds).** Le courtier n'a ni cadence ni plafond à lui :
un appel de ton app est un appel à Grist (contrats 4.3 ; le point 7 de la section 5.5 est ajouté). Mesuré avec ton app,
sans réseau (`run-edition.mjs`), pendant 13 s sans que la personne touche à rien :

1. **sans table du direct** : 4 `listTables`, de 9 à 12 ms chacune (de ton app à Grist et retour) ;
2. **la table du direct existe, vide, et le modèle est rouvert** : 4 lectures de `Publipostage_Direct`, de 8 à 12 ms chacune,
   sans `listTables` ;
3. **juste après que la personne a arrêté le direct elle-même** : aucune lecture de cette table (elle n'y est pas ramenée
   avant d'avoir rouvert le modèle, comme ton état le dit).

À l'échelle, une lecture toutes les 3 s par page ouverte donne N/3 lectures par seconde pour N pages (30 pages : 10 par
seconde), même quand personne n'écrit. **Non mesuré** : ce que le plafond d'un Grist en ligne en fait (contrats 5.5, point 6) ;
si une limite apparaît, la cadence est à toi, GFS ne la limite pas.

**5. Ce qui reste ouvert, et à qui :**

1. **Le titre d'impression** : non mesuré. Le labo du cloud n'ouvre pas la boîte d'impression de Chrome, donc le nom proposé
   pour le PDF ne s'y lit pas. Ta question reste dans ton état ; GFS la mesure dans un vrai Chrome quand le porteur le fait.
2. **Le délai réel d'une frappe** : le chiffre est celui du porteur, sur son Grist en ligne avec deux navigateurs (consigne
   012).
3. **La 016 n'est pas encore lue** (ton état s'arrête à la 015). Tant que ta CSP ne nomme pas l'adresse du CDN de l'écriture
   en direct, le mode par défaut de la fenêtre de GFS, « Depuis un CDN », est refusé par ton navigateur : c'est la 016 qui le
   règle.
4. **Non mesuré** : deux personnes en même temps (l'entrée automatique entre deux sections), Firefox, Safari, le réseau réel
   et le vrai jsDelivr.

## Pourquoi

1. C'est le circuit habituel : ton état (`8b7b5ab`) porte une demande et quatre questions, GFS répond par une consigne.
2. Ta 014 est faite : GFS peut activer « Nouveau » pour toi et retirer sa phrase provisoire (contrats 5.4, point 1).
3. Ta question sur l'`ouverture` met le doigt sur un vrai défaut : un modèle vierge enregistré revenait vierge après un
   rechargement sur place. Le contrat dit maintenant que l'ouverture ne se rend qu'une fois (5.2, point 3), et le même
   mécanisme vaut pour toutes les apps.
4. Aucune règle du cahier ne change : ni le cadre isolé, ni le CDN par défaut, ni le grisé.

## Fait quand

`GFS-ETAT.md` donne « 017 · faite · lue » quand : (a) tu as lu cette page, et ton état retire de « Demandes à GFS » la
demande du 19/10 et de « Questions pour GFS » les trois questions que cette page clôt (« Nouveau », l'écriture en direct,
l'entrée automatique) ; (b) la question de l'impression reste dans tes questions tant qu'elle n'est pas mesurée ; (c) si ton
app doit garder le dernier modèle à travers un rechargement (point 3.2), ton état dit comment. Aucun code n'est demandé ici.
