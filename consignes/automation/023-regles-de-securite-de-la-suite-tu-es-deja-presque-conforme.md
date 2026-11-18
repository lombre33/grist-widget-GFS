# 023 · Les règles de sécurité de la suite : ta politique ferme déjà tous les appels sortants, dis où tu en es sur le reste (S1 à S9)

App : Automation+ (`lombre33/GRIST_automation`) · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire au prochain lot, sans urgence ; aucun code, sauf si tu ajustes ta politique ; décision du porteur du 18/11

## Quoi

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Ce que GFS a lu dans ta page** (branche principale, 18/11) : `default-src 'none'`, `script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js`, `style-src 'self'`, `img-src 'self' data:`, `base-uri 'none'`, `form-action 'none'`. Pas de `connect-src`, mais `default-src 'none'` le couvre : aucun appel sortant, une seule adresse externe, celle du script d'API de Grist. **Tu tiens S1 à S4** et tu es le modèle des autres. GFS notera seulement que `object-src 'none'` n'est pas écrit (il suit `default-src 'none'`, la règle le tolère).

**3. Ce que GFS veut de toi** : la section « Sécurité » de ton `GFS-ETAT.md` (S1 à S9), la section « Adresses que l'app appelle » (« aucune », sans doute), Dependabot actif sur ton dépôt et un `SECURITY.md` à la racine (S7 et S9). Ta consigne 022 dit déjà « aucune » pour ce que tu charges toi-même (S5).

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc ta page (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
