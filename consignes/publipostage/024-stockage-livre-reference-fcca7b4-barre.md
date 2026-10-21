# 024 · Ta demande du 21/10 : le stockage de chaque personne est livré, la référence à `fcca7b4`, la barre de GFS

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`2ed567c`, qui décrit `fcca7b4`) · quand : au
prochain lot, sans urgence ; du code dans ton app (point 1.7) ; sans effet dans l'app seule

## Quoi

**1. Le stockage de chaque personne est livré** (`14cfd19` ; contrats 5.1, 5.2 et 5.3). Le porteur l'a demandé tout de suite, le
21/10. Voici tes réponses, dans l'ordre de ta demande :

1. **La forme.** `contexte.stockage` est l'espace de ton app seule : un objet `{ clé: valeur }`, relu par GFS à chaque appel
   `contexte` (un cadre rechargé retrouve ce qu'il avait écrit). Pour écrire : l'appel `stockage.ecrire` avec
   `{ cle, valeur }` ; `valeur: null` retire la clé. Sans `id`, l'appel n'attend rien ; avec un `id`, la réponse est
   `{ retenu: true }`, ou `{ retenu: false }` quand le navigateur a refusé de garder la clé (la valeur vaut alors jusqu'au
   rechargement de la page de GFS).
2. **Tes clés.** Une clé fait de 1 à 64 caractères parmi `A-Z a-z 0-9 _ . : -` : tes onze clés (`pp_theme` à `pp_news_seen`)
   passent telles quelles. Une valeur est une chaîne (tes JSON en sont une, une fois écrits ; la chaîne vide aussi). Une clé, une
   valeur ou un appel hors règle reçoit `GFS_REFUSE` et rien n'est écrit ; sans `id`, ton app ne l'apprend pas, donc GFS le dit en
   console (un avertissement avec le nom de l'app, le code et la raison).
3. **La taille.** 1 Mo par app : 1 048 576 caractères, clés et valeurs comptées. Au-delà, `GFS_QUOTA` et rien ne change ; une
   valeur qui n'agrandit pas l'espace passe toujours, donc une app pleine peut se vider. Tes onze clés font une dizaine de ko.
   `pp_lang` n'y est pas (GFS donne la langue) et `pp_schema_*` non plus (tu ne l'as pas demandé : à voir à l'étape 5).
4. **Par navigateur, pas par compte** (comme `gfs.langue`) : les mêmes dans tous les documents de la même instance de Grist ; une
   autre instance a les siens (le navigateur sépare le stockage selon le site qui héberge) ; un autre navigateur ou un autre
   ordinateur repart de zéro. Tout cela est un confort, jamais une donnée : ton app marche sans (cahier 5.7).
5. **Les onglets** déjà ouverts ne sont pas prévenus : ton app relit au prochain `contexte`. Deux onglets qui écrivent des clés
   différentes ne s'écrasent pas ; sur la même clé, la dernière écriture gagne.
6. **Ce n'est pas une écriture du document** : cela marche en lecture seule (par construction, non mesuré : le labo n'a pas de
   document en lecture seule) et ton manifeste n'a rien à déclarer.
7. **Chez toi**, comme ta page le prévoit : lire `contexte.stockage` au démarrage (comme la langue), écrire chaque changement par
   `stockage.ecrire`, ne s'en servir que s'il est là. Un GFS plus ancien répond `GFS_INCONNU` à un appel qui porte un `id`
   (contrats 5.1, point 3) et ne fait rien d'un appel sans `id` : ton app y reste comme aujourd'hui. L'espace de GFS n'est pas
   celui de l'app seule : un réglage fait seule ne suit pas dans GFS, sans perte de données (contrats 5.3, point 7). Chez GFS,
   la fenêtre des nouveautés peut donc s'ouvrir seule, une fois par personne : `pp_news_seen` absent, puis écrit à la fermeture.
8. **Mesuré dans un vrai Grist** (grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris, en français / clair et en
   anglais / sombre ; `prototype/labo/run-stockage.mjs`, 25 vérifications par combinaison, dont six échouent avec le courtier
   d'avant) avec deux sondes qui font ce que fera ton app : le sous-cadre refuse son propre `localStorage` ; le contexte rend un
   espace vide au départ ; avec un `id` la réponse est `{ retenu: true }`, la clé est chez GFS sous `gfs.stockage.<id>.<clé>` et le
   document ne reçoit aucune écriture ; le cadre rechargé, puis GFS rechargé, retrouvent les valeurs ; une app ne voit rien de
   l'espace d'une autre, même si son message la nomme ; `null` retire la clé ; hors règle, `GFS_REFUSE` ; pile 1 048 576 caractères
   passe, un de plus reçoit `GFS_QUOTA` ; un navigateur qui refuse d'écrire donne `{ retenu: false }` et la valeur vaut pour la page.
   **Non mesuré** : un second onglet, un second document, Firefox, Safari. Avec ton app elle-même, GFS n'a rien à mesurer avant
   que ton code l'appelle : dis-le-nous quand c'est fait, et la vérification se rejoue avec elle.

**2. La référence de ton app avance de `7a723ce` à `fcca7b4`** (`c4b3026`, un commit à part, relu). GFS s'arrête là : `2ed567c` ne
change que ta page d'état.

1. **Relu dans le diff** (53 fichiers) : la CSP d'`index.html` (seuls des `?v=` changent), la carte d'importation, ta liste de
   bibliothèques et `js/gfs-link.js` ne changent pas ; ni table, colonne ni clé de réglages de plus ; aucune table interne ni
   adresse de plus ; aucun message de plus vers GFS ; rien n'écrit dans le stockage du navigateur.
2. **Le poids** (`6bcecc1`) : `diapositives` (0.11) pèse 140 508 octets (`slide-strip.js` 81 983, `slide-strip.css` 9 571,
   `slide-import.js` 22 932, `slide-import.css` 4 090, `slide-show.js` 17 816, `slide-show.css` 4 116), donc l'indication `poids`
   du manifeste de GFS passe de 131 à 141 ; `graphique` (64 077) passe de 66 à 64 (le 66 était un chiffre ancien, faux depuis
   longtemps) ; `edition` (74 389) ne bouge pas. Un essai de GFS compare désormais ces chiffres à ton dossier à chaque avancée.
3. **Mesuré avec ton app à `fcca7b4`** (même labo, même méthode) : la langue (25 vérifications par combinaison) et l'ouverture
   (28), en français / clair et en anglais / sombre, et l'écriture en direct (60, en français / clair) sans échec ; les présentations
   (51) avec un seul échec par combinaison, le même qu'à `7a723ce` : le bouton ▶ « Présenter » est recouvert par les boutons
   « Fichiers » et « Apps » de GFS (Maj+F5 marche), ce que règle la barre du point 3 ci-dessous. Aucun refus de la politique de sécurité hors ceux que
   l'essai de l'écriture en direct provoque exprès (fausse empreinte), aucun avertissement de GFS.

**3. La barre de GFS et la place libre de l'app : le porteur a tranché, la forme de l'échange suit dans la 025.** Le porteur a
répondu le 21/10 : la barre de GFS se place où la personne le veut, à gauche, en haut, à droite ou en bas ; les apps adaptent leur
interface aux quatre places, sans que rien se recouvre ; et l'emprise reste minimale : pas de bande en plus, la barre se pose par-dessus
l'espace que les apps laissent vide. C'est le second cas de ta page (la barre recouvre le cadre, l'app écarte de la bande ses éléments de
bord et cale ses menus, bulles et fenêtres sur la zone libre). GFS écrit maintenant le contrat de cet échange (contrats 5.1 et 5.2) : un
champ du contexte et un événement quand la personne déplace la barre ou qu'elle apparaît ou disparaît, et un appel de l'app pour que ton
diaporama prenne tout le cadre ; puis le code, mesuré dans un vrai Grist aux quatre bords. La 025 te donne la forme retenue, avec
ce que cela demande à ton app. **D'ici là, ne change rien** : aucun code chez toi avant la 025.

**4. Ce qui reste ouvert, et à qui :**

1. **Le titre d'impression** (011) : toujours non mesuré par GFS, dont le labo n'ouvre pas la boîte d'impression de Chrome ; le
   porteur le mesure dans son Chrome. Ta question reste dans « Questions pour GFS ».
2. **La 016** reste « lue, pas faite » : elle attend la bascule de GFS sous `grist-factory`.
3. **Non mesuré par GFS** : le volet « Importer » (`e47e520`), la fenêtre des nouveautés (`dee85a7`), la pagination (`38dbbd4`), le
   choix de plusieurs diapositives (`6ca67c6`), Firefox et Safari.

## Pourquoi

Ta page porte deux demandes. Le stockage ne dépend que de GFS et le porteur a dit « maintenant » : livré, mesuré, documenté (contrats
5.3, guide des apps, point 6). La barre touche l'espace de ton app : le porteur a fixé ce qu'il veut, GFS écrit la forme de l'échange
et te la donne avant que tu codes, comme ta page le demande.

## Fait quand

`GFS-ETAT.md` donne « 024 · faite · `<commit>` » quand ton app lit `contexte.stockage` au démarrage et écrit chaque changement de ses
onze clés par `stockage.ecrire` (avec la fenêtre des nouveautés qui s'ouvre une fois par personne chez GFS), ou « lue, pas faite »
avec la raison. Il retire alors de « Demandes à GFS » la demande des choix de chaque personne, et garde celle de la barre
jusqu'à la consigne 025.
