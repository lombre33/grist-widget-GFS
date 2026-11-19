# 087 · Réglages > Vue : dis pourquoi les deux boutons sont grisés quand le modèle ouvert n'est pas enregistré

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · demande du porteur du 19/11 (il ne pouvait pas choisir un modèle pour une vue) · charte (un contrôle grisé dit sa raison) · faits vérifiés 142
quand : à lire au prochain lot, sans urgence ; une phrase et un essai dans `js/view-template.js` ; vaut dans GFS et seule

## Quoi

Dans **Réglages > Vue > « Modèle par défaut de cette vue »**, quand « Utiliser le modèle ouvert pour cette vue » est grisé **parce que le modèle ouvert n'est pas encore enregistré** (`openTemplate()` rend `null` : un modèle neuf, un import, un modèle de départ de la galerie), l'écran le dit en une phrase, dans les deux langues, sous la phrase d'état : par exemple « Ce modèle n'est pas encore enregistré : donnez-lui un nom et cliquez sur Enregistrer, il pourra alors devenir celui de cette vue. » Le bouton grisé garde son libellé ; le texte est aussi son info-bulle (`title`) et son `aria-describedby`, pour qu'un lecteur d'écran le lise.

Les autres états ne changent pas : modèle enregistré ouvert (le bouton porte son nom), déjà celui de la vue, lecture seule (la phrase du verrou), « Retirer » grisé tant qu'aucun choix n'existe.

**Un essai à toi qui échoue sur le code actuel** : modèle vierge ouvert, la phrase est là, le bouton est grisé et la décrit ; après « Enregistrer » sous un nom, la phrase disparaît et le bouton porte le nom du modèle ; en lecture seule, seule la phrase du verrou paraît.

## Pourquoi

Le porteur, sur le Grist de la DINUM, ne pouvait pas choisir un modèle pour une vue : les deux boutons grisés, la phrase « Aucun modèle choisi pour cette vue. », rien d'autre. GFS l'a mesuré dans un vrai Grist (faits vérifiés 142) : **avec un modèle enregistré ouvert, tout marche** (noms d'avant ou noms anglais, second modèle ouvert par l'explorateur) ; **avec un modèle non enregistré, l'écran est exactement celui de la capture**, sans un mot sur la raison, alors que le coin d'état de l'app la dit ailleurs. Le geste est juste (un modèle neuf n'a pas d'identifiant à retenir), l'écran est muet. Sous GFS on y tombe plus souvent : « Nouveau », « Importer » et « Depuis un modèle » ouvrent tous un modèle non enregistré. Le choix, lui, est écrit dans la vue par GFS sans « Enregistrer » de Grist (contrats 7.3) : rien à changer de ce côté.

Ce que cette consigne ne demande pas : un bouton « Enregistrer et utiliser pour cette vue » (autre geste, autre décision), ni un changement du nom du bouton.

## Fait quand

La phrase paraît quand le modèle ouvert n'est pas enregistré, dans les deux langues, avec son essai ; elle ne paraît ni pour un modèle enregistré ni en lecture seule ; et ta page `GFS-ETAT.md` le dit (une ligne dans « Changements qui touchent GFS » avec la date et le commit, et ta ligne « Consignes » : « 087 · faite » avec le commit). GFS lit le dépôt de ton app (`js/view-template.js`, le texte de `settings.viewTemplate.*`), puis passe cette consigne à « faite ».
