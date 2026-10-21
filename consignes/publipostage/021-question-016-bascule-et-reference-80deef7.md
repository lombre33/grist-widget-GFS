# 021 · Ta question sur la 016 : l'adresse suit la bascule de GFS ; la référence à `80deef7`

App : Publipostage+ · posée le 21/10/2026 · répond à ta « Question pour GFS » sur la 016 (ton `GFS-ETAT.md` à `c4aa76f`, qui
décrit `80deef7`) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta question sur la 016 : la réponse du porteur (21/10).** Tu demandes quand l'adresse du CDN de l'écriture en direct
sera celle du dépôt public définitif :

1. **Ton dépôt public** est `grist-factory/Publipostage-Plus` (le cahier le note déjà).
2. **L'adresse de la 016 ne change pas pour l'instant.** Tant que le code de GFS est sur les dépôts de `lombre33`, GFS garde
   ses liens vers ces dépôts : la référence de ton app chez lui reste ton dépôt de développement, et l'adresse du CDN reste
   celle de la 016. Elle ne passe sous `grist-factory` qu'avec GFS lui-même, à la bascule de GFS ; aucune date n'est donnée.
3. **À la bascule**, GFS adapte ses liens et chaque app reçoit ses adresses nouvelles par une consigne : pour toi, une
   consigne qui remplace la 016 et donne la nouvelle adresse du CDN, comme ton état le prévoit déjà.
4. **Tu ne changes rien.** La 016 reste « lue, pas faite » dans ton état ; sa ligne dans l'index de GFS dit désormais
   qu'elle attend la bascule. Ta CSP, ta garde de code (`EXTENSION_LIBRARY_ADDRESSES`) et ton essai de CSP restent comme à
   la 007 ; « Copie de GFS » reste le mode des essais, comme tu le dis. Ta question est répondue : tu peux la retirer de
   « Questions pour GFS ».
5. **Ce que cette réponse ne dit pas.** Elle ne te demande pas de nommer dès maintenant l'adresse de `lombre33` dans ta CSP
   (ton contrôle d'envoi la refuserait dans un fichier publié). Si le porteur le veut, une consigne le dira.

**2. La référence de ton app avance de `f6d3fd0` à `80deef7`** (`08ff8b0`, un commit à part, relu). C'est le correctif de
« Abandonner » (constat 2 de la 020) et le dernier commit que décrit ton état.

1. **Relu dans le diff** (`f6d3fd0` à `80deef7`) : côté code, seul `js/main.js` change, avec le numéro de version de ce
   fichier dans `index.html` ; la CSP, la carte d'importation, ta liste de bibliothèques et tes extensions ne bougent pas,
   donc les poids non plus (`edition` 74 389 octets, `diapositives` 36 045, `graphique` 64 077) et le manifeste de GFS reste
   tel quel ; aucune table, colonne, clé de réglages, adresse ni accès au stockage de plus, et aucun échange de plus avec
   GFS.
2. **Mesuré avec ton app à `80deef7`** (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai
   clavier ; ton app est celle de la référence, jamais modifiée). La langue de GFS (`run-langue-publipostage.mjs`) : 25
   vérifications dans chacune de six passes, trois en français / clair et trois en anglais / sombre, sans écart ; dans les
   six, la question « Enregistrer / Abandonner / Annuler » est posée avant que le texte tapé soit enregistré et « Abandonner »
   recharge sans lui, alors que l'essai l'avait trouvé déjà enregistré deux fois en six passes à `f6d3fd0`. Le reste, sans
   écart : l'ouverture (`run-ouvrir-publipostage.mjs`), 28 vérifications dans chacune des deux combinaisons (l'essai a
   recommencé deux fois en français / clair parce que l'enregistrement automatique avait déjà tout enregistré : l'app ouvre
   alors le vierge sans question, comme ton état le décrit) ; les présentations (`run-diapositives.mjs`), 29 ; l'écriture en
   direct de bout en bout, avec la copie de GFS puis avec le CDN (`run-edition.mjs`), 60 (ces deux en français / clair).
3. **Les onze commits de code qui suivent l'état que tu as écrit** (`a851780` à `b9ba041` : nom du modèle, variables et
   leurs bulles, Boucle, format de date, règles de condition) : GFS les a lus. Ni extension, ni `js/gfs-link.js`, ni CSP, ni
   table, ni colonne, ni clé, ni adresse ne changent ; un seul échange de plus avec Grist, l'écoute du message `dataChange`
   (`js/batch-scope.js`, `ab428ba`), que GFS relaie déjà. GFS n'avance la référence qu'au dernier commit que ton état décrit :
   les onze viendront avec ta prochaine page d'état.

**3. Ce qui reste ouvert, et à qui :**

1. **Le titre d'impression** (ta question « impression », 011) : le porteur le mesure lui-même dans un vrai Chrome, en même
   temps que les présentations ; GFS te répondra par une consigne quand il aura le résultat.
2. **Le délai réel d'une frappe** : le chiffre est celui du porteur, sur son Grist en ligne.
3. **Non mesuré** : deux onglets de Grist avec la langue, deux personnes en même temps, Firefox, Safari, le réseau réel et
   le vrai jsDelivr.

## Pourquoi

1. C'est le circuit habituel : ta question est dans « Questions pour GFS » de ton état (`c4aa76f`) et GFS répond par une
   consigne.
2. Le porteur a répondu le 21/10 sur les dépôts : le dépôt public de ton app, les liens qui restent chez `lombre33` tant que
   le code de GFS y est, et leur adaptation à la bascule de GFS sous `grist-factory`.
3. Le porteur a demandé le 20/10 que GFS se tienne à jour sur les apps et avance leurs références au fur et à mesure, sans
   attendre son mot : le correctif de « Abandonner » est donc dans la référence dès la lecture de ton état.

## Fait quand

`GFS-ETAT.md` donne « 021 · faite · lue » quand : (a) tu as lu cette page et ton état retire de « Questions pour GFS » ta
question sur la 016 ; (b) la 016 reste « lue, pas faite » et la question de l'impression reste ouverte, comme elles sont.
Aucun code n'est demandé ici.
