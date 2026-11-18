# 020 · Des modèles d'automatisme dans « Nouveau > Depuis un modèle » de GFS : dis si ça a un sens chez toi, et prépare ton catalogue

App : Automation+ · posée le 18/11/2026 · décision du porteur du 18/11 (carte « Choisir la forme de “Depuis un modèle” dans le menu Nouveau ? », option « Une galerie commune ») · contrats 2.2 (champ `modeles`), 5.2 (point 3), 5.4 (point 13) ; guide des apps 1.2 point 23
quand : au prochain lot, sans urgence ; facultatif ; aucun code tant que tu n'as pas répondu ; sans effet dans l'app seule

## Quoi

Depuis le 18/11, le menu « Nouveau » de l'explorateur de GFS a un article « Depuis un modèle… » : une seule fenêtre réunit les modèles de toutes les apps (une carte par modèle avec sa vignette, une recherche, un filtre par app, un bouton « Créer »). Publipostage+ y met déjà ses 22 modèles ; Automation+ n'y a pour l'instant qu'une pastille grisée « bientôt ». Le porteur voudrait que les apps sans modèle en aient.

**Ce que GFS sait faire aujourd'hui** : lister des modèles dont le `type` est un type de fichier que l'app ouvre (`actions.ouvrir`, contrats 2.2). **Ton app n'a pas de fichier** (`ouverture.nouveau: false`, pas de `fichiers` dans ton manifeste : un automatisme est une ligne de ta table `Automation`, qu'on ouvre depuis l'arrivée). GFS ne peut donc pas encore montrer tes modèles, et la forme que cela prendrait chez toi n'est pas décidée. **Sur ce point GFS ne devine pas : réponds d'abord.**

1. **Dans la section « Questions pour GFS » de ton `GFS-ETAT.md`, dis si un automatisme modèle a un sens chez toi** : par exemple « quand le statut change, ajouter une ligne dans une autre table », ou « envoyer une ligne vers un journal ». Dis ce qu'il faudrait pour qu'un tel modèle s'ouvre **non enregistré** dans ton éditeur (quelles tables et quelles colonnes il suppose, ce que la personne choisit avant de l'ouvrir), et combien tu en vois. Si cela n'a pas de sens, dis-le : la pastille reste grisée « bientôt », sans autre suite.
2. **Si oui, prépare ton catalogue** sans rien attendre, au format commun : `modeles/modeles.json` à la racine de ton dépôt et une vignette par modèle (WebP, 240 × 320 px, 12 Ko conseillés, prise dans un vrai Grist avec des données d'exemple sans nom de personne réel). Une entrée : `{ "id", "nom": { "fr", "en" }, "description"?, "etiquettes"?, "vignette"?, "tables"? }` ; `id` : `[a-z0-9][a-z0-9._-]{0,63}`, unique, jamais changé ni réutilisé ; `nom` 60 signes au plus, `description` 140. Le `type` de chaque entrée, **seul champ que ton app n'a pas**, sera fixé par GFS dans sa réponse : ne le devine pas.
3. **L'ouverture** : avec le **kit 0.24.0** (`7aa030c`, qui ajoute `modele` à l'ouverture et ne change rien d'autre), `GfsLink.opening()` rendra `{ fichier: null, type, dossier, raison: 'modele', modele: { id } }`. Ce que ton app en fait (ouvrir l'automatisme modèle **non enregistré**, demander l'accord avant de créer une table, rendre `{ ouvert: false }` pour un `id` inconnu ou un refus, **jamais un automatisme vide à la place**) se fera **après la réponse de GFS**, pas avant.
4. **Puis la demande** : dans « Demandes à GFS », une ligne `modeles · <commit> · modeles/modeles.json · mes modèles d'automatisme`. À sa lecture, GFS cherche comment ranger un type pour ton app sans fichier, te répond par une consigne et ne déclare rien dans ton manifeste avant.

Ce que cette consigne **ne** demande **pas** : aucun code d'app, aucune bibliothèque, aucune table créée sans l'accord de la personne, aucun changement de ton manifeste.

## Pourquoi

Le porteur a demandé le 18/11 un élément du menu « Nouveau » qui ouvre une fenêtre de modèles, reprenant ceux de chaque app, et que les apps qui n'en ont pas encore en aient (Publipostage+ et Slides+ ont déjà les leurs) ; il a choisi la forme « Une galerie commune ». Le contrat (5.4, point 13) lie un modèle à un type de fichier : Automation+ n'en a pas, donc une question de produit se pose qui ne regarde que toi (qu'est-ce qu'un modèle d'automatisme ?), avant toute décision de GFS.

## Fait quand

- ta réponse (« oui, voici ce que c'est » ou « non, pas pour l'instant ») est dans « Questions pour GFS » de ton `GFS-ETAT.md` ;
- si oui : `modeles/modeles.json` et les vignettes sont dans ton dépôt, au commit cité dans ta ligne « modeles » ; GFS passe la consigne à « faite » en répondant par une consigne.
