# 004 · Automation+ tourne en fond dès qu'une automatisation existe : la décision du porteur

App : Tuesday · posée le 02/11/2026 · décision du porteur du 02/11, que ta page a relayée · quand : à lire maintenant ; aucun code chez toi ;
GFS la construit à l'étape 6

## Quoi

**1. La décision est enregistrée** (cahier de GFS, section 2 et section 12 ligne 4 ; contrats 1.4, point 1). Automation+ pourra tourner
caché derrière l'app active, mais seulement quand le document a au moins une automatisation ; sans automatisation, GFS ne crée aucun second
sous-cadre. Le courtier reliera alors deux sous-cadres à Grist, là où il n'en relie qu'un aujourd'hui : le contrat se complète à l'étape 6.
Chez toi, rien ne change : tu n'ouvres pas Automation+, tu ne sais pas s'il tourne, et tu te mets à jour comme tu le prévois, par les
changements de ta table.

**2. « Il existe un automatisme »** : Automation+ n'a pas de table de fichiers (son manifeste ne déclare pas `fichiers`). Elle garde ses
automatismes dans une seule table, `Automation` : une ligne `Type = Workflow` par table de vue, avec une colonne `Actif`, puis des lignes
`Log` (le journal) et `Lock` (le verrou d'exécution) ; le graphe est aussi dans la clé de réglages `workflow`. La lecture que ta page
propose, **au moins une ligne `Workflow` à `Actif` vrai** (un automatisme désactivé ne compte pas), tient donc sur cette table. Elle n'est
pas au contrat : GFS la confirmera à l'étape 6 avec Automation+, qui devra la déclarer.

**3. Tes trois points à préciser.** *Pas de double exécution* : Automation+ élit déjà un seul exécuteur par un verrou dans sa table (la
ligne `Lock`, renouvelée ; un onglet qui voit le verrou d'un autre reste en veille, `js/executor.js`). C'est la protection que tu cites ;
GFS la mesure à l'étape 6 avec deux sous-cadres d'une même page, le caché et celui du premier plan. *Coût en mémoire d'un second sous-cadre*
et *reprise après un rechargement de la page* : à mesurer à l'étape 6, dans un vrai Grist ; aucun chiffre aujourd'hui.

## Pourquoi

Automation+ ne tourne que vue ouverte, et GFS n'active qu'une app par section ; or une automatisation doit pouvoir faire évoluer le kanban
de Tuesday ou ajouter des tâches à l'agenda pendant que la personne y travaille. La condition (au moins une automatisation) évite de charger
un cadre pour rien. Cela répond à la question 4 du cahier de GFS, qui conseillait jusqu'ici « section à part pour commencer ».

## Fait quand

`GFS-ETAT.md` donne « 004 · lue ». Aucun code n'est demandé ; GFS écrit la suite à l'étape 6, par une consigne à Automation+ (la lecture de
sa table) et, s'il y a lieu, à toi.
