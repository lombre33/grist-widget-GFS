# 071 · Ta carte et ta fiche dans la vitrine de GFS : une description et trois captures

App : Publipostage+ · posée le 17/11/2026 · décision du porteur du 17/11 (carte « Demander aux apps leurs vraies captures et descriptions ? », option « Oui, à toutes les apps ») · quand : au prochain lot, sans urgence ; aucun code ne change dans ton app (un dossier de fichiers) ; ne sert que dans GFS

## Quoi

Depuis le 17/11, la fenêtre « Apps et extensions » de GFS est une vitrine, comme un magasin d'apps (guide des apps, 1.2 point 22 ; contrats 2.2, champ `vitrine`) : une carte par app, et une fiche qui s'ouvre au clic. Sans rien de ta part, ta carte montre ton icône et ton nom. Pour la remplir, donne :

1. **Une description** de ce que fait Publipostage+, en une à trois phrases (280 caractères au plus), en français et en anglais. Elle remplace ton texte court sur la fiche. Dis ce que la personne fait avec l'app, sans promesse de sécurité (guide 1.1, point 13).
2. **Trois captures** de l'app en action, par exemple un document en cours d'édition, une grille et une présentation si tu veux montrer les trois modes de l'app, chacune avec une légende de 60 caractères au plus, en français et en anglais. La première illustre ta carte : choisis celle qui dit à quoi sert l'app.

**Où les poser, dans ton dépôt** : un dossier `vitrine/` à la racine, avec `vitrine.json`, `1.webp`, `2.webp` et `3.webp`.

```json
{ "description": { "fr": "…", "en": "…" },
  "captures": [ { "fichier": "1.webp", "legende": { "fr": "…", "en": "…" } },
                { "fichier": "2.webp", "legende": { "fr": "…", "en": "…" } },
                { "fichier": "3.webp", "legende": { "fr": "…", "en": "…" } } ] }
```

**Les images** : WebP, 960 × 600 px (16:10), 60 Ko au plus chacune ; l'app seule, sans la barre du navigateur ; prises dans un vrai Grist, en clair, avec des données d'exemple sans nom de personne réel ; l'essentiel au centre (la carte rogne un dixième en haut et en bas). Une capture en français sert aux deux langues.

**Puis la demande** : dans la section « Demandes à GFS » de ton `GFS-ETAT.md`, une ligne `vitrine · <commit> · vitrine/vitrine.json · description et trois captures pour la carte et la fiche`.

**Ce que GFS fait** : à la lecture de ta demande, il copie les trois images dans son dossier `vitrine/` (la politique de sécurité de sa fenêtre ne charge une image que de lui, jamais de ton dépôt ni d'un CDN), déclare `vitrine` dans ton manifeste, avance la référence de ton app (commit à part) et te répond par une consigne. Tu n'ajoutes aucune adresse à ta politique de sécurité.

Ce que cette consigne **ne** demande **pas** : aucun code, aucune bibliothèque, aucun changement de ton manifeste ; ni captures de tes extensions (la vitrine n'en montre pas).

## Pourquoi

Le porteur a demandé le 17/11 une fenêtre des apps « comme un app store », avec des captures et une description (maquette « A · Vitrine », choisie le 17/11) ; elle est en ligne, avec des vignettes d'attente à la place de tes captures. Seule l'app sait montrer ce qu'elle fait, et seuls des fichiers de GFS passent la politique de sécurité de la fenêtre. Décision du porteur du 17/11 : demander à toutes les apps.

## Fait quand

- `vitrine/vitrine.json` et les trois images sont dans ton dépôt, au commit cité dans `GFS-ETAT.md` ;
- chaque image mesure 960 × 600 px et pèse 60 Ko au plus ; la description et chaque légende portent le français et l'anglais ;
- ta ligne « vitrine » est dans « Demandes à GFS » ; GFS passe la consigne à « faite » en voyant ta carte et ta fiche remplies.
