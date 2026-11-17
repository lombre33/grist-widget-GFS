# 070 · Un bandeau dans la bêta figée qui conseille de migrer vers la 1.1, et un bouton « Découvrir les nouveautés » qui lance la fenêtre des nouveautés de la V1 (demande du porteur)

App : Publipostage+ · posée le 13/11/2026 · remplace rien · demande du porteur du 13/11 · quand : au prochain lot, sans urgence mais avant que d'autres personnes ne tombent sur la bêta ; du code dans la bêta figée (`beta/` du dépôt public) et dans tes outils d'envoi ; GFS n'a rien à changer (il sert ta racine, jamais `/beta/`)

## Quoi

**1. Ce que le porteur a demandé** (13/11, ses mots) : « un bandeau pour les personnes qui utilisent encore [le widget] en version bêta (ceux qui utilisent le lien /beta), en mettant : *Attention, widget en version bêta, nous vous conseillons de migrer vers la version 1.1*, et un bouton pour découvrir les nouveautés qui lance la pop-up de nouveautés de la version 1 ». Il a écrit « GFS » ; GFS n'a ni `/beta/`, ni fenêtre de nouveautés, ni 1.1 : GFS lit la demande comme portant sur **ta** bêta, `https://grist-factory.github.io/Publipostage-Plus/beta/`, et sur **ta** fenêtre `WhatsNew` (`js/whats-new.js`, « Voir les nouveautés »). Si tu lis autre chose, dis-le dans ta page d'état.

**2. Ce que GFS a lu chez toi** (dépôt de développement à `ac75d2e`, dépôt public à `8e0d1db`) :

- la bêta est une copie **figée** de l'étiquette `v1.0.0-beta.1` (`beta/` du dépôt public, choix du 04/11 « Oui, dossier beta/ »), « telle quelle et sans correctif » dans ton README public ; `outils/depot-propre/publier.sh` refuse un `beta/` qui n'est pas identique, octet pour octet, à l'étiquette, et `controles.mjs --beta-figee` exige `beta/js/version.js` à `1.0.0-beta.1`. Un bandeau dans `beta/` est donc **une retouche que tes propres contrôles refuseraient** : c'est à toi de dire comment elle reste honnête (par exemple une étiquette `v1.0.0-beta.2` qui n'ajoute que le bandeau, et les contrôles qui la nomment) ;
- la bêta (05/10) **n'a pas la fenêtre des nouveautés** (écrite le 21/10) : ni `js/whats-new.js`, ni `js/person-store.js`, ni `img/news/` (lu sur `beta/` ; elle a `js/modal-base.js` et `css/modal-base.css`). Un bouton qui « lance la pop-up de la V1 » ne peut donc pas l'appeler : la V1 est une autre page, dans un autre cadre ;
- les images de la fenêtre pèsent **631 Ko** (34 fichiers, les deux langues) ; la bêta et la V1 sont sur la **même origine** (`grist-factory.github.io`), et la politique de la bêta n'autorise que `'self'` : une image de `../img/news/1.0/` n'est donc pas bloquée (à vérifier chez toi), sans copier les 34 fichiers.

**3. Ce que GFS te demande** (le but vient du porteur, le moyen est le tien) :

- **a. Un bandeau en haut de la bêta**, sur une ligne qui passe à la ligne si le panneau est étroit, qui ne cache ni la barre d'outils ni le menu des modèles, avec ces textes :
  - français : « Attention : widget en version bêta. Nous vous conseillons de migrer vers la version 1.1. » · bouton « Découvrir les nouveautés » ;
  - anglais : « Attention: this widget is a beta version. We recommend migrating to version 1.1. » · bouton « Discover what's new ».
  Charte Grist Factory : jetons de couleur de la bêta, contraste de 4,5:1 en clair et en sombre, aucune icône emoji, une icône SVG au trait si tu en mets une. « 1.1 » est le texte du porteur ; la bêta étant figée, il ne suivra pas la 1.2 : si tu préfères « la version actuelle », dis-le-lui dans ta page d'état.
- **b. Le bouton ouvre les nouveautés de la V1**, par le moyen le plus léger que tu choisis et que tu dis dans ta page d'état. Dans l'ordre que GFS conseille : (i) la fenêtre à écrans dans la bêta, **un seul code pour la bêta et la V1** (le moule `createPager` et les textes `news.*` ne s'écrivent pas deux fois ; une copie produite par un outil dans `beta/`, jamais une copie à la main), ses images lues sur la V1 plutôt que recopiées ; (ii) sinon une page des nouveautés dans la V1 que le bouton ouvre dans un nouvel onglet ; (iii) en dernier, la note de version de ton dépôt public (`CHANGELOG`, déjà le lien de ta fenêtre), ce qui n'est **pas** la pop-up que le porteur a demandée : à ne prendre que si (i) et (ii) coûtent trop, en le disant.
- **c. Le bandeau peut se fermer** (une croix) jusqu'à la prochaine ouverture ; rien n'est retenu, pour que l'avertissement revienne à chaque ouverture de la bêta (si tu préfères retenir la fermeture, dis-le dans ta page d'état). La fenêtre des nouveautés ne s'ouvre jamais toute seule dans la bêta : la personne choisit.
- **d. Français et anglais dans le même lot**, et la langue du widget décide, comme pour le reste de la bêta.

**4. Pas demandé** : aucun correctif d'un comportement de la bêta ; pas de changement de la V1 (sa fenêtre s'ouvre toujours toute seule une fois, `pp_news_seen`) ; pas de « comment migrer » (changer l'adresse du widget dans le panneau de droite de Grist) dans le bandeau : le porteur n'en a pas parlé, GFS lui pose la question.

## Pourquoi

Le porteur (13/11) veut que les personnes encore sur la bêta le sachent et voient ce que la V1 change, sans qu'il faille le leur dire une par une. Le retour du forum du 12/11 en est un exemple probable : une barre de bulle à quatre boutons, sans le pinceau du 05/11, donc un build d'avant la 1.1. La bêta est gardée exprès pour qui a un ancien modèle qui ne se rouvre pas bien ; le bandeau ne la retire pas, il dit seulement ce qu'elle est. Ton README promet une bêta « sans correctif » : un bandeau n'y change aucun comportement, mais la phrase et les contrôles qui la gardent sont à toi.

## Fait quand

`GFS-ETAT.md` dit « 070 · faite · `<commit>` » (ou « 070 · lue » avec la question qui te bloque, par exemple sur l'étiquette de la bêta) ; un test échoue sur l'ancien code : la bêta posée dans `beta/` montre le bandeau en français et en anglais, le bouton ouvre les nouveautés par le moyen que tu as choisi (i, ii ou iii, dit dans ta page d'état), la croix le ferme, et `publier.sh` et `controles.mjs --beta-figee` acceptent la nouvelle bêta. Mesuré à 700 × 400, à la vraie souris, en clair et en sombre, dans un vrai Grist si tu en as un, sinon dans ton banc. Le dépôt public se pousse par le porteur depuis sa machine, jamais depuis le cloud : ton outil d'envoi prépare, il pousse. GFS ne mesure rien de son côté (aucun code de GFS ne change).
