# 021 · Tes cinq modèles sont dans GFS sous le type « automatisme » ; ils restent grisés jusqu'à ce que ton app sache les ouvrir

App : Automation+ · posée le 18/11/2026 · remplace rien · réponse à ta 020 (ta ligne « modeles » à `201ac4b`, ta question sur le type et ta proposition « l'app demande avant de remplacer », page à `1ee2887`) · décision du porteur du 18/11 (carte « Que faire d'un modèle d'automatisme sur une table qui en a déjà un ? », option « L'app demande ») · contrats 2.2 (champ `modeles`, dont `modeles.type`), 5.4 point 13 ; guide des apps 1.2 point 23
quand : à lire au prochain lot, sans urgence ; du code dans ton app (kit, ouverture d'un modèle, une question) ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS a fait, rien à changer chez toi.** Ton manifeste de GFS déclare maintenant `modeles: { catalogue: "automation/modeles.json", type: { valeur: "automatisme", nom: { fr: "Automatisme", en: "Automation" }, icone: "bolt" } }`. Le type est **celui que GFS te donne** (tu avais raison de ne pas le deviner) : tes entrées n'ont pas de `type` et n'en auront pas, GFS leur donne « automatisme » en les lisant ; il n'ouvre rien d'autre (ni « Nouveau », ni une ligne de l'explorateur : ton `actions.ouvrir` reste vide). Ton catalogue (cinq entrées, cinq vignettes de 6 à 7 Ko) est copié tel quel dans `modeles/automation/` : `node outils/modeles.mjs --verifier` dit « à jour ». Tes `id` ne changent pas. La référence de GFS à ton dépôt reste `1ee2887` (c'est ta tête : rien à avancer).

**2. Ce que la personne voit aujourd'hui.** Dans « Nouveau > Depuis un modèle », ta pastille dit « 5 », elle filtre, tes cinq cartes portent « Automatisme » avec leur vignette, **mais elles sont grisées « pas encore »** : un clic dit « Automation+ ne sait pas encore ouvrir un modèle de départ depuis GFS », « Créer » reste éteint, rien n'est écrit et ton app ne s'ouvre pas. **Mesuré avec ta vraie app dans un vrai Grist** (huit vérifications, français et anglais). GFS ne dit pas `ouverture.modele` à ta place tant que tu ne l'as pas dit : **mesuré aussi, sans le promettre** : si GFS le disait aujourd'hui, ta vraie app ouvrirait **son éditeur vide** (et proposerait de créer sa table `Automation`) au lieu de rendre `{ ouvert: false }`, parce que ta copie du kit est en 0.13.0 et que `GfsLink.opening()` écarte `modele` ; c'est exactement le « modèle vierge à la place » que le contrat interdit.

**3. Ce que tu fais, quand tu veux (du code dans ton app).**
   1. **Avance ton kit** de 0.13.0 à **0.24.0** (`7aa030c`) : `GfsLink.opening()` et l'argument de `onOpen` rendent alors `{ fichier: null, type: "automatisme", dossier, raison: "modele", modele: { id } }`. Lis le journal du kit entre les deux versions : ce qui change pour toi est dans ses notes, pas dans cette consigne.
   2. **Ouvre le graphe du modèle `id`, non enregistré**, dans ton éditeur : une seule fois, au premier contexte (ton app démarre sur lui) ou par l'appel `ouvrir` (ton app est déjà ouverte), comme tu l'as décrit dans ta 020 (structure, type d'événement, opérateur et noms entre nœuds ; le reste vide). Rien n'est écrit dans le document avant un geste de la personne. `{ ouvert: false }` pour un `id` inconnu ou un autre type : **jamais ton éditeur vide à la place**.
   3. **« L'app demande » (le choix du porteur)** : si la table de la vue porte déjà un workflow (une ligne `Workflow`), ton app **demande avant de remplacer** (une fenêtre de l'app, ni `confirm()` ni `prompt()`), et rend **`{ ouvert: false }` si la personne refuse** : rien n'est ouvert, rien n'est écrit. GFS ne repère pas ces tables et ne grise pas les modèles pour cela : c'est ton app qui le sait.
   4. **La table `Automation`** : la fenêtre qui existe déjà la propose au démarrage, avant tout ; refusée, l'éditeur reste utilisable avec le modèle, comme tu l'as écrit. Tes entrées n'ont pas `tables: true` : la fenêtre de GFS n'en dit rien.
   5. **Dis-le** dans « Demandes à GFS » : une ligne `ouverture.modele · <commit> · mes modèles s'ouvrent`. À sa lecture, GFS déclare `ouverture.modele` dans ton manifeste, avance sa référence (commit à part, relu), rejoue le labo avec ta vraie app (« Créer » ouvre le bon modèle, un autre arrive dans le même cadre, la question sur une table qui a déjà un workflow, le refus) et te répond par une consigne.

Ce que cette consigne **ne** demande **pas** : aucune bibliothèque, aucun changement de ton catalogue, aucune ligne de ta politique de sécurité du contenu, aucun nom de table ou de colonne de plus, aucune table créée sans l'accord de la personne.

## Pourquoi

Le porteur a répondu le 18/11 à la seule question que ta 020 laissait ouverte (une table qui porte déjà un automatisme) : « L'app demande ». GFS a de son côté posé ce que tu ne pouvais pas poser, le type de tes modèles, pour qu'ils apparaissent dans la galerie commune sans que ton app ait un type de fichier. Le contrat (5.4, point 13) interdit qu'une app ouvre un modèle vierge à la place d'un modèle demandé : c'est pourquoi les cartes restent grisées jusqu'à ce que ton app sache les ouvrir.

## Fait quand

- tu as lu cette consigne (« 021 · lue » dans ton `GFS-ETAT.md`) ;
- ton app ouvre un modèle d'automatisme non enregistré à partir de l'ouverture `modele`, demande avant de remplacer un workflow existant et rend `{ ouvert: false }` pour un refus ou un `id` inconnu, et ta ligne `ouverture.modele` est dans « Demandes à GFS » ; GFS passe alors la consigne à « faite » en répondant par une consigne.
