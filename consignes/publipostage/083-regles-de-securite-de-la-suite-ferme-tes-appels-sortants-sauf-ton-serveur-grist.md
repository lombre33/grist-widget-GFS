# 083 · Les règles de sécurité de la suite, version corrigée : ferme les appels sortants de ta page (S1 à S9), avec l'exception du serveur Grist de la personne

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 18/11/2026 · remplace la 082 (faits corrigés) · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire au prochain lot ; du code dans ta page (la politique) ; le porteur dit que tu vas le faire bientôt ; décision du porteur du 18/11 ; remplace la 082

## Quoi

**0. Ce qui change depuis la 082** : le guide 1.4 dit une exception à la règle S3 (point 3 ci-dessous), que la 082 ne disait pas.

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Ce que GFS a lu dans ta page** (`index.html` à ta référence `b32f450`) : un `script-src` (`'self'`, `'unsafe-eval'`, 104 adresses esm.sh versionnées, 5 empreintes), `object-src 'none'`, `base-uri 'none'`, `frame-src` (YouTube nocookie, Vimeo), `form-action 'none'`.
**Pas de `default-src`, de `connect-src` ni d'`img-src`** : ta page ne limite aucun appel sortant, ni aucune image. Une bibliothèque piratée pourrait donc envoyer des données où elle veut. Le porteur dit que tu vas la limiter bientôt : voici ce que GFS contrôlera.

**3. La forme attendue** (règles S2 à S4) : `default-src 'none'`, puis tu rouvres seulement ce que ton app utilise, par `'self'` ou par une adresse exacte : `connect-src`, `img-src`, `font-src`, `media-src`, `worker-src`, `frame-src` (déjà fait). Jamais `*` ni `http:`.
**L'exception, dite** (guide 1.4, S3) : si ton app appelle **le serveur Grist de la personne avec un jeton d'accès** (lire une pièce jointe, une table par l'API), tu ne peux pas nommer cet hôte d'avance ; `connect-src https:` est alors permis, et `img-src https:` si tu montres ces images, **et rien d'autre en `https:`**. Écris dans « Adresses que l'app appelle » la ligne `serveur Grist de la personne · connect · <ce que tu lis> · oui, après un geste` : GFS note « à noter » au lieu de « non tenue ». Si ton app n'a pas ce besoin, n'ouvre rien en `https:`.
Ton `script-src` est déjà nommé ; garde-le, avec ses adresses versionnées. Les bibliothèques que **GFS sert** à ton app (les adresses de son catalogue) n'ont pas à être déclarées : il en garde la version et l'empreinte. Mesure ta page dans un vrai Grist, console ouverte, avant de la publier : toute violation que tu n'attendais pas est soit une adresse oubliée, soit un appel à retirer.

**4. Dis ce que tu as mesuré** sur les empreintes (règle S5) : lesquelles de tes adresses esm.sh et cdnjs peuvent porter `integrity`, lesquelles ne le peuvent pas, et pourquoi.

**5. Le reste** : Dependabot actif sur ton dépôt (GFS y a lu un `.github/dependabot.yml`) et un `SECURITY.md` à la racine (S7 et S9 ; GFS n'y a pas lu de `SECURITY.md`).

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc la page que son manifeste ouvre (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
