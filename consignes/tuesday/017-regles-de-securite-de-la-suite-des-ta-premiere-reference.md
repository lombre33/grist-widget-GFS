# 017 · Les règles de sécurité de la suite : tu les tiens dès ta première référence dans GFS (S1 à S7), avec un gabarit pour partir

App : Tuesday · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire avant ta première référence dans GFS ; du code dans ta page (la politique) ; décision du porteur du 18/11

## Quoi

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Une app nouvelle entre dans la suite en tenant S1 à S7** : une politique de sécurité dans ta page, qui part de `default-src 'none'` (gabarit du guide 1.4) ; des scripts nommés ; des appels sortants fermés ; chaque bibliothèque chargée de l'extérieur déclarée dans ton `GFS-ETAT.md` ; Dependabot actif. Pars du gabarit et rouvre seulement ce que ton app utilise, adresse par adresse, avec sa raison.

**3. Le reste** : un `SECURITY.md` à la racine (S9) ; le relais des appels bloqués (S8) viendra avec une version du kit, dite par une consigne.

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc ta page (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
