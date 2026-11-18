# 075 · Tes modèles dans « Nouveau > Depuis un modèle » de GFS : un catalogue dans ton dépôt, et l'ouverture d'un modèle non enregistré

App : Publipostage+ · posée le 18/11/2026 · décision du porteur du 18/11 (carte « Choisir la forme de “Depuis un modèle” dans le menu Nouveau ? », option « Une galerie commune ») · contrats 2.2 (champ `modeles`), 5.2 (point 3), 5.4 (point 13) ; guide des apps 1.2 point 23
quand : au prochain lot, sans urgence ; du code dans ton app (réponse à une ouverture `modele`) et un dossier de fichiers ; sans effet dans l'app seule ; GFS a déjà fait sa part

## Quoi

Depuis le 18/11, le menu « Nouveau » de l'explorateur de GFS a un article « Depuis un modèle… » : une seule fenêtre réunit les modèles de toutes les apps (une carte par modèle avec sa vignette, une recherche, un filtre par app, un bouton « Créer »). Tu as déjà ta galerie de 22 modèles (`templates-gallery/`) : GFS la montre avec la tienne, dans l'ordre de ton catalogue.

1. **Un catalogue dans ton dépôt**, `modeles/modeles.json` à la racine, avec une vignette par modèle à côté. GFS porte déjà un catalogue **provisoire** de tes 22 modèles, établi d'après ta galerie (`prototype/modeles/publipostage/modeles.json` dans GFS) : reprends-le comme base et corrige-le, c'est le tien qui fera foi. Une entrée :

```json
{ "id": "facture", "type": "document",
  "nom": { "fr": "Facture, devis ou avoir", "en": "Invoice, quote or credit note" },
  "description": { "fr": "…", "en": "…" },
  "etiquettes": [ { "fr": "Vente", "en": "Sales" } ],
  "vignette": "facture.webp", "extensions": [ "graphique" ], "tables": true }
```

   `id` : `[a-z0-9][a-z0-9._-]{0,63}`, unique, **jamais changé ni réutilisé** (tu retrouves ton modèle par lui) ; `type` : l'un de tes types (`document`, `grille`, `presentation`, `email`) ; `nom` 60 signes au plus et `description` (facultative) 140 signes au plus, en français et en anglais ; `etiquettes` : des mots que la recherche lit ; `vignette` : WebP, 240 × 320 px, 12 Ko conseillés, prise dans un vrai Grist avec des données d'exemple sans nom de personne réel ; `extensions` : celles que le modèle demande **en plus** de celle de son type ; `tables: true` quand le modèle vient avec des tables. Une entrée mal formée est écartée par GFS avec un avertissement, les autres restent.

2. **L'ouverture d'un modèle** (contrats 5.2, point 3 ; 5.4, point 13). Avec le **kit 0.24.0**, `GfsLink.opening()` (et l'argument de `GfsLink.onOpen`) rend `{ fichier: null, type, dossier, raison: 'modele', modele: { id } }` : ouvre **un modèle non enregistré**, fait d'après le modèle `id`, comme ton « Nouveau » le fait d'un document vierge. Rien n'est écrit dans le document avant un geste de la personne ; si le modèle crée des tables (`tables: true`), ta demande d'accord habituelle passe avant (cahier 3.1) ; un refus ou « Annuler » rend `{ ouvert: false }`. **Un `id` que tu ne connais pas, ou un type que ta garde refuse : rien ne s'ouvre, `{ ouvert: false }`, jamais un modèle vierge à la place.** Quand ton app est déjà ouverte, la question « Enregistrer / Abandonner / Annuler » de ton document en cours passe comme pour toute ouverture.

3. **Avance ta référence du kit à 0.24.0** (`7aa030c`) : il ajoute `modele` à l'ouverture et ne change rien d'autre ; aucun code de ton app n'y est obligé.

4. **Puis la demande** : dans la section « Demandes à GFS » de ton `GFS-ETAT.md`, une ligne `modeles · <commit> · modeles/modeles.json · mes modèles de départ pour « Depuis un modèle »`, avec `ouverture.modele` si ton app sait ouvrir un modèle.

**Ce que GFS fait** : à la lecture de ta demande, il copie ton catalogue et tes vignettes dans son dossier `modeles/publipostage/` (`outils/modeles.mjs` ; la politique de sécurité de sa fenêtre ne charge une image que de lui), déclare `ouverture.modele` dans ton manifeste, avance la référence de ton app (commit à part) et te répond par une consigne. Tu n'ajoutes aucune adresse à ta politique de sécurité.

**En attendant ta demande** : tes 22 modèles sont déjà dans la fenêtre, mais **grisés** avec le mot « pas encore » (GFS n'ouvre jamais ton app sur un modèle vierge à la place) ; leur clic dit quoi faire.

Ce que cette consigne **ne** demande **pas** : l'aperçu en grandes captures (celui de ta galerie reste chez toi) ; aucune bibliothèque ; aucune table créée sans l'accord de la personne ; aucun changement de ton manifeste.

## Pourquoi

Le porteur a demandé le 18/11 un élément du menu « Nouveau » qui ouvre une fenêtre de modèles, reprenant ceux de chaque app (Publipostage+ et Slides+ ont déjà les leurs), et a choisi la forme « Une galerie commune » (contre un sous-menu par app et contre l'ouverture de ta galerie). Seule ton app sait ouvrir ses modèles et seuls des fichiers de GFS passent la politique de sécurité de la fenêtre : le catalogue vit chez toi, GFS le copie.

## Fait quand

- `modeles/modeles.json` et les vignettes sont dans ton dépôt, au commit cité dans `GFS-ETAT.md` ; chaque entrée porte le français et l'anglais ;
- un clic sur « Créer » dans GFS ouvre ton app sur le bon modèle, non enregistré ; un `id` inconnu ou un refus rend `{ ouvert: false }` ; aucune table n'est créée sans l'accord de la personne ;
- ta ligne « modeles » est dans « Demandes à GFS » ; GFS passe la consigne à « faite » en voyant tes modèles dégrisés.
