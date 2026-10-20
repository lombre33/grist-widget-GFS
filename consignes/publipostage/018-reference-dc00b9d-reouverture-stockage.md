# 018 · Ta demande du 20/10 : la référence à `dc00b9d`, la réouverture mesurée ; la réponse sur le stockage

App : Publipostage+ · posée le 20/10/2026 · répond à ta « Demande à GFS » de référence et à ta question sur le stockage (ton
`GFS-ETAT.md` à `69a3dc9`, qui décrit `dc00b9d`) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet
dans l'app seule

## Quoi

**1. Ta demande de référence est faite.** La référence de ton app avance de `71287c4` à `dc00b9d` (`e4d86f1`, un commit à
part, relu).

1. **Relu dans le diff** : la CSP d'`index.html`, la carte d'importation et ta liste de bibliothèques n'ont pas changé
   (`index.html` ne gagne que des numéros de version, la ligne de menu des signets et deux scripts de ton app servis par
   `'self'`, `js/anchors.js` et `js/bookmark-dialog.js`) ; aucune table, colonne, clé de réglages ni adresse de plus ; aucun
   accès au stockage du navigateur ajouté.
2. **Les poids ne bougent pas** : tes extensions pèsent ce qu'elles pesaient à `71287c4` (`edition` 74 389 octets,
   `diapositives` 36 045), donc le manifeste de GFS reste tel quel.
3. **Le seul échange de plus avec GFS** est l'attente du contexte avant le choix du modèle de départ (`await GfsLink.ready`,
   `js/main.js`).

**2. Mesuré avec ton app à `dc00b9d`** (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai
clavier, en français / clair et en anglais / sombre ; ton app est celle de la référence, jamais modifiée) :

1. **La réouverture après un rechargement que ton app veut elle-même** (`run-ouvrir-publipostage.mjs`, quatre vérifications
   de plus, 28 en tout) : un modèle ouvert par un double-clic dans l'explorateur de GFS, puis Réglages > Déclencheur, un
   autre caractère choisi au clavier, « Recharger maintenant » : ton app se recharge et rouvre ce modèle, pas le ★ ; GFS ne
   dit rien ; l'adresse du cadre redevient celle que GFS a donnée (`access`, `gfs`), sans fragment, et il n'y a toujours
   qu'un cadre ; rien n'est écrit dans le document. L'essai échoue avec ton app à `71287c4` (27 sur 28 : elle revenait sur
   le ★).
2. **Un rechargement qui ne vient pas de tes Réglages** (F5, Grist, GFS) reprend l'ordre habituel, comme avant : GFS ne rend
   l'`ouverture` qu'une fois (contrats 5.2, point 3). Mesuré dans le même essai.
3. **Le choix de langue de ton app dans GFS** reste refusé : un clic sur l'autre langue ne recharge pas le cadre et la case
   revient sur la langue de la page (`I18n.storeLang` n'a pas de stockage dans le cadre isolé). Mesuré dans le même essai.
4. **Le reste, sans écart** : les présentations (`run-diapositives.mjs`, 29 vérifications) et l'écriture en direct de bout
   en bout, avec la copie de GFS puis avec le CDN (`run-edition.mjs`, 60).

**3. Le stockage (ta question « à quelle étape ? »).** Tu lis juste : `contexte.stockage` reste vide dans le prototype et le
courtier n'a pas de prise pour `stockage.ecrire` (contrats 5.3).

1. Le plan (cahier, section 10) ne range pas le stockage du courtier dans une étape à lui. Il place l'offre du kit à l'étape
   3 (contrats 5.3) et le passage de tes clés `pp_*` par le kit à l'étape 5, dont la fin demande que l'aller-retour « seule,
   GFS, seule » passe dans un vrai Grist : ce qui suppose que le courtier tienne le stockage au plus tard à ce moment-là.
2. Chaque étape attend le go du porteur et GFS ne fixe pas de date ; le porteur peut demander le stockage plus tôt.
3. D'ici là, dans GFS, le thème, le caractère de déclenchement et la langue de ton app ne se retiennent pas (contrats 5.3,
   point 4 : un confort, l'app marche sans).

**4. Ta demande « langue » est lue, pas traitée.** Un choix de langue gardé par GFS, commun à toutes les apps et annoncé aux
apps ouvertes, change ce que disent le cahier (5.7) et le contrat (5.3, point 4 : la langue est un confort gardé app par
app). C'est au porteur de trancher ; une nouvelle consigne suivra, qui dira à ton app ce qu'elle a à lire et à écouter. Tu
n'as rien à coder d'ici là.

**5. Ce qui reste ouvert, et à qui :**

1. **Le titre d'impression** (011) : non mesuré, le labo du cloud n'ouvre pas la boîte d'impression de Chrome ; le porteur
   le mesure dans un vrai Chrome.
2. **L'adresse définitive du CDN** (ta question sur la 016) : elle suit le dépôt public définitif (cahier, question 5,
   « avant la première publication »), sans date donnée. La 016 reste « lue, pas faite » ; la consigne qui la remplacera
   viendra avec l'adresse.
3. **Le délai réel d'une frappe** : le chiffre est celui du porteur, sur son Grist en ligne.
4. **Non mesuré** : deux personnes en même temps, Firefox, Safari, le réseau réel et le vrai jsDelivr.

## Pourquoi

1. C'est le circuit habituel : ton état (`69a3dc9`) porte une demande de référence, une demande de langue et une question de
   stockage, et GFS répond par une consigne. La 017 est lue : l'index la passe à « faite ».
2. La réouverture que tu as ajoutée (`dc00b9d`) règle le défaut que la 017 signalait (la personne qui change de langue après
   avoir ouvert un modèle par l'explorateur retombait sur le ★) sans que GFS rejoue un geste déjà fait : ce que l'app sait
   seule, elle le garde seule.
3. La langue commune est un fait nouveau pour le contrat : elle ne s'écrit qu'après le choix du porteur.

## Fait quand

`GFS-ETAT.md` donne « 018 · faite · lue » quand : (a) tu as lu cette page, et ton état retire de « Demandes à GFS » la
demande de référence et de « Questions pour GFS » celle du stockage ; (b) la demande de langue reste posée tant que le
porteur n'a pas tranché ; (c) la 016 et la question de l'impression restent comme elles sont. Aucun code n'est demandé ici.
