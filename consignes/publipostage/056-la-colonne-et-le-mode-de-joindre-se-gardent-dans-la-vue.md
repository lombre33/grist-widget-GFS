# 056 · La colonne et le mode de « Joindre à la ligne » se gardent dans la vue : GFS déclare tes deux clés (choix du porteur, aucun code à changer)

App : Publipostage+ · posée le 07/11/2026 · quand : à lire maintenant ; aucun code à changer, un commentaire à mettre à jour ; suite de la 053 (point 6) et de la 055 (point 3) ; contrats 5.4 (point 12), 7.3 ; vaut dans GFS seulement

## Quoi

**Le porteur a répondu à ta question (07/11)** : la carte « Où garder la colonne et le mode de “Joindre à la ligne” quand Publipostage+ tourne dans GFS ? » a reçu **« Dans la vue »**. Ce qui est fait côté GFS :
- **`pp_attach_column` et `pp_attach_mode` sont déclarés** dans `reglages` du manifeste que GFS garde de ton app. Ton `setWidgetOption(COLUMN_OPTION, …)` et `setWidgetOption(MODE_OPTION, …)` (`js/row-attachment.js`, `writeColumn`, `writeMode`) ne sont donc plus refusés : GFS les écrit dans les réglages de la vue, au geste de la personne, **sans la barre « Enregistrer » de Grist**, comme tes autres clés (contrats 7.3). Le choix est partagé par toutes les personnes du document, et `onOptions` te le rend à l'ouverture ;
- **mesuré dans un vrai Grist** avec ta vraie app (référence `987a338`, `labo/run-joindre-publipostage.mjs` section 7, faits vérifiés 54 ; 23 vérifications en français clair et en anglais sombre) : `writeColumn` et `writeMode` rejoués, la section de la vue porte `{ "pp_attach_column": "<colonne>", "pp_attach_mode": "add" }`, aucune barre « Enregistrer », GFS rechargé et l'app rouverte : `getColumn()` et `getMode()` rendent les deux valeurs. Le clic dans ta liste n'est pas rejoué (il appelle ces deux fonctions), ni Firefox, ni le Grist du porteur.

**Ce qui est à toi** : rien à coder. Mets seulement à jour tes commentaires qui disent que ces deux clés sont refusées par GFS (`js/row-attachment.js`, en tête, et sur `GFS_ATTACH_WIRED`) : elles sont déclarées. Les valeurs restent celles d'aujourd'hui (la colonne : son identifiant en texte, ou `null` ; le mode : `replace` ou `add`). Ton drapeau reste à toi : il se lève après ton essai dans le Grist du porteur.

## Pourquoi

Le porteur préfère que le choix se garde avec la vue, comme le modèle de la vue (03/11), plutôt que dans le stockage de chaque personne : un seul réglage pour tout le document, sans rien à refaire à chaque ouverture. La 053 (point 6) te laissait le choix du stockage de la personne ; cette réponse le remplace.

## Fait quand

`GFS-ETAT.md` donne « 056 · lue » et tes commentaires à jour. Si ton essai chez le porteur voit la barre « Enregistrer », un choix non retrouvé à la réouverture ou un refus de `setOption`, dis-le dans « Questions pour GFS » avec ce que ton code a reçu.
