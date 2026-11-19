# 036 · Les règles de sécurité de la suite : ta politique est déjà la plus stricte, dis où tu en es sur le reste (S1 à S9)

App : Form+ (`lombre33/FormPlus`) · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire au prochain lot, sans urgence ; peu de code (la politique, si tu ajustes) ; décision du porteur du 18/11

## Quoi

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Ce que GFS a lu dans ta page** (branche principale, 18/11) : `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`. Aucun script externe, aucun appel sortant : tu tiens S1, S3 et S4. Ce que GFS notera : pas de `form-action 'none'` (S2), et `style-src 'unsafe-inline'`, que la règle tolère tant que S3 est tenue (dis si tu en as encore besoin ; la règle 12 du guide demande déjà les couleurs par le CSSOM).

**3. Leaflet** (ta demande 028 reste ce qu'elle est) : le jour où la carte s'active, ta politique devra ouvrir l'adresse exacte de la bibliothèque et celle des fonds de carte, dans `script-src`, `style-src`, `img-src` et `connect-src` s'il le faut, et **seulement** pour cela (S3, S4, S5). Écris dès maintenant, dans ta section « Adresses que l'app appelle », ce que tu ouvrirais.

**4. Le reste** : Dependabot actif sur ton dépôt et un `SECURITY.md` à la racine (S7 et S9).

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc ta page (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
