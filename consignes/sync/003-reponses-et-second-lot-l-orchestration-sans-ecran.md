# 003 · Tes cinq questions, et le second lot : l'orchestration des assistants, sans écran

App : Sync+ · posée le 07/11/2026 · quand : au prochain lot, sans urgence ; du code dans ton app, sans changement visible pour la personne ; décision du porteur du 06/11 (le moteur est intégré, pas refait)

Bravo pour la 001 et la 002 : GFS a relu ton `GFS-ETAT.md` (`f37cfd9`, sommet `2ea1c9f`), lancé `tests/unit/engine.test.mjs` et `engine-port.test.mjs` (12 verts) et ouvert le port et le préfixe : c'est ce qu'il lui fallait.

## Quoi

**Réponses à tes cinq questions** (rien à changer chez toi pour les quatre premières, sauf ce qui est dit) :

1. **Textes.** Le texte du diagnostic à copier passe aussi par `port.text` (fr et en dans `i18n/`) : la personne le lit, et GFS offre
   tout en français et en anglais. Les **mémos des règles d'accès restent en français fixe** : ce sont des données du document, lues par
   des personnes de langues différentes, et « Synchro : » sert à les reconnaître (ceux de GFS, « GFS : … », sont de même en français).
   Ne change ni ce préfixe ni leur forme.
2. **Tables de destination.** Les noms que ton écran **propose** prennent le préfixe : c'est voulu. GFS, lui, donnera l'identifiant exact de chaque
   destination dans `plans` (`[{ table, dest }]`) : le moteur doit utiliser `dest` tel quel, sans y remettre le préfixe. D'après notre
   lecture, `destTableId` n'est appelé que par ton écran (`js/target/dest.js`) : garde-le ainsi, et ajoute un essai qui donne un `dest`
   sans préfixe au moteur et vérifie qu'il reste intact.
3. **Lien public.** GFS prendra le préfixe `GFS_` (celui de toutes ses tables) dans chaque document : deux documents qui ont GFS ont donc
   le même préfixe, et la CIBLE retrouve `GFS_Synchro` de la SOURCE. Un échange entre Sync+ seul (préfixe vide) et GFS n'est pas un cas voulu :
   aucun changement de protocole.
4. **Orchestration des assistants : oui, un second lot.** GFS ne réécrira pas ces enchaînements (le choix du porteur est d'intégrer ton
   moteur, pas de le refaire). Voir le paragraphe suivant.
5. **`apply`.** Confirmé : `{ retValues }`, et une liste vide est sans effet. GFS donnera un port qui s'y tient.

**Le second lot : l'enchaînement des assistants dans le moteur, sans fenêtre.** Ce que ta page d'état garde « côté écran, sciemment »
(SOURCE : `checkReply`, `approve`, le retour d'un Échange ; CIBLE : `readInvitation`, la création de la réception, la réponse ; le contrôle
horaire des webhooks `checkHooks` ; `js/diagnostic.js`) passe dans le dossier du moteur, sous une forme que tes écrans **et** ceux de GFS
appellent : des fonctions qui prennent des données simples (les réponses de la personne : table, colonnes, destination, code collé) et
rendent des données (ce qui s'est passé, l'étape suivante, les textes par `port.text`), sans ouvrir de fenêtre ni lire l'écran. Les fenêtres
et leurs boutons restent chez toi ; GFS dessine les siennes.

Dans cet ordre, parce que le premier usage de GFS est un envoi **une fois**, d'une table de fichiers, sans suivi par webhook :

1. **D'abord** : SOURCE (créer l'export, produire le code d'invitation, lire la réponse, approuver, envoyer) et CIBLE (lire l'invitation,
   créer la réception, répondre, recevoir).
2. **Ensuite** : le contrôle des webhooks (« tenu à jour », un sens) et le diagnostic.

Le moteur reste sans bibliothèque et sans accès à l'écran (`tests/unit/engine.test.mjs` le vérifie déjà) ; ses essais passent sans
modification, plus un essai qui joue une SOURCE puis une CIBLE de bout en bout sur ton Grist en mémoire (`engine-fake.mjs`), sans écran.

## Pourquoi

GFS fera tourner le moteur dans sa page avec son propre port (il parle seul à Grist). Sans ces enchaînements dans le moteur, il devrait
les récrire à partir de tes écrans, et deux versions de la même suite d'étapes divergeraient. Le premier usage est le partage d'un
dossier de fichiers entre deux documents qui ont GFS (« une fois », puis « tenu à jour »).

## Fait quand

`GFS-ETAT.md` donne la ligne « 003 · faite · `commit` » et, en note : le numéro de version du moteur (mineure, puisqu'une fonction s'ajoute) ;
la liste des fonctions ajoutées, avec ce que chacune prend et rend ; pour chacune, ce qu'elle suppose du port ; « aucun accès à l'écran
dans le moteur » ; et l'essai de bout en bout SOURCE puis CIBLE sur le port en mémoire. Si l'un des deux temps (le premier, ou le contrôle des webhooks et le diagnostic)
arrive avant l'autre, dis lequel : GFS ne peut commencer qu'avec le premier.
