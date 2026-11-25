# 109 · Les liens avec l'annuaire de GFS : choisir une personne dans l'annuaire, et en recevoir une

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 25/11/2026 · demande du porteur du 25/11 (module Annuaire de GFS : « liens avec les autres apps, dans les deux sens ») · contrats 2.7 point 8, 5.2 point 3 et 5.4 point 16 · maquette du module, scène 15
quand : sans urgence, **après** que le kit expose `GfsLink.choosePerson` et lit `ouverture.personne` (le porteur le demande au projet du kit : GFS annonce la version) ; du code dans ton app ; 108 réservée au CDN de l'éditeur (consigne 107, point 5)

## Quoi

**1. Ce que GFS fait déjà.** Le module Annuaire (un type de fichier de l'explorateur, une fenêtre « Annuaire ») sait faire choisir **une personne** dans les annuaires du document, et en **poser une** dans une app. Les deux gestes ne portent que la personne : `{ nom, email, titre, telephone, annuaire }`, des textes. Ton app ne lit jamais l'annuaire et n'en demande aucune table (contrats 5.4, point 16).

**2. Ce que tu peux faire de ton côté** : choisir la personne dont l'adresse remplit un destinataire d'un e-mail (À, Cc, Cci) ou un champ de personne de ton document ; et recevoir une personne que la fiche de l'annuaire t'envoie (« Insérer dans… »). Tu choisis **où** dans ton interface ; tu le dis à GFS en une phrase, qu'il montre dans le menu « Insérer dans… » de la fiche (ici : « destinataire d'un envoi » / « recipient of a mailing »).

**3. Ce que tu fais** :
- **a. Quand le kit le permet** (version annoncée par GFS), avance ta référence du kit (commit à part, relu).
- **b. De l'app vers l'annuaire** : un bouton « Choisir dans l'annuaire… » à côté du champ concerné appelle `GfsLink.choosePerson({ titre })` (`titre` : un texte déjà traduit, 120 signes au plus). La réponse est la personne, ou `null` (la personne a annulé : tu ne changes rien). Tu gardes ce que tu reçois comme **la valeur de ton propre champ** : aucune clé ni numéro d'annuaire. Hors de GFS (l'app seule), le bouton est **grisé avec sa raison** (« Disponible dans Grist Factory Suite »), jamais caché.
- **c. De l'annuaire vers l'app** : `GfsLink.opening()` (au démarrage) et `GfsLink.onOpen` (app déjà ouverte) rendent une ouverture `{ raison: 'personne', personne }`. Pose la personne là où tu l'as dit. Quand tu ne peux pas la poser (aucun brouillon ouvert, un champ qui ne s'écrit pas), **dis-le dans ton interface** et réponds `false` à `onOpen` : GFS n'écrit rien pour toi.
- **d. `GFS-ETAT.md`**, « Changements qui touchent GFS » : l'endroit où tu poses une personne (les quelques mots, en français et en anglais), le bouton « Choisir dans l'annuaire… » et le commit. GFS déclare alors `actions.personnes` (`choisir`, `inserer`) et `ouverture.personne` dans ton manifeste ; **tant que tu ne l'as pas dit, rien ne change pour toi** (ton app n'est pas dans le menu « Insérer dans… »).
- **e. Tes essais** : une ouverture `personne` reçue au démarrage et dans l'app déjà ouverte ; une réponse `null` ; un refus (`GFS_REFUSE`, `GFS_ACCES`) dit à la personne sans rien casser.

**4. Ce que tu ne fais pas** : ne demande pas la lecture de la table des personnes de l'annuaire pour cela ; ne garde pas la liste des personnes ; ne charge rien depuis une adresse reçue dans la personne (ce sont des textes, à afficher comme tels).

## Pourquoi

Une personne se saisit une fois, dans l'annuaire du document ; les apps s'y reportent sans copier la table. Le porteur a retenu les deux sens (scène 15 de la maquette) et veut que l'app ne reçoive que la personne désignée.

## Fait quand

`GFS-ETAT.md` donne « 109 · faite · lue » avec le commit et les quelques mots de « destinataire d'un envoi » (ou la raison de ne pas le faire) ; le bouton « Choisir dans l'annuaire… » répond à `null` sans rien changer, et une ouverture `personne` se pose ou se refuse à voix haute.
