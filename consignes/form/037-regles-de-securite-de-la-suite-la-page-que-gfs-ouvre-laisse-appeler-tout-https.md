# 037 · Les règles de sécurité de la suite, version corrigée : la page que GFS ouvre laisse appeler toute adresse https ; dis où tu en es (S1 à S9)

App : Form+ (`lombre33/FormPlus`) · posée le 18/11/2026 · remplace la 036 (faits corrigés) · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire au prochain lot, sans urgence ; peu de code (la politique de `poc/widget.html`) ; décision du porteur du 18/11 ; remplace la 036

## Quoi

**0. Ce qui change depuis la 036** : la 036 décrivait ta page d'accueil `index.html`, stricte, et non la page que GFS ouvre (`entree` de ton manifeste : `poc/widget.html`). C'est la seconde qui compte ici, et elle est moins stricte.

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Ce que GFS a lu dans `poc/widget.html`** (à ta référence `b9a2ab2`) : `default-src 'self'`, `script-src 'self' 'unsafe-eval' https://docs.getgrist.com/grist-plugin-api.js https://unpkg.com`, `style-src 'self' 'unsafe-inline' https://unpkg.com`,
**`img-src 'self' data: https:`**, **`connect-src 'self' https:`**, `object-src 'none'`, `base-uri 'none'`. Pas de `form-action 'none'`. Conséquences : toute adresse https peut être appelée et toute image https chargée (S3), et `unpkg.com` entier peut servir des scripts et des feuilles (S4).
Ta page d'accueil `index.html` n'a pas ce défaut, mais ce n'est pas elle que GFS ouvre.

**3. La forme attendue** : `default-src 'none'`, puis tu rouvres seulement ce que ton formulaire utilise. Pour Leaflet (ta demande 028 reste ce qu'elle est), ouvre l'**adresse exacte et versionnée** de la bibliothèque dans `script-src` et `style-src`, plus celle des fonds de carte dans `img-src`, **quand l'option existe**, pas `unpkg.com` entier (S4).
**L'exception, dite** (guide 1.4, S3) : si ton app appelle **le serveur Grist de la personne avec un jeton d'accès** (lire une pièce jointe, une table par l'API), tu ne peux pas nommer cet hôte d'avance ; `connect-src https:` est alors permis, et `img-src https:` si tu montres ces images, **et rien d'autre en `https:`**. Écris dans « Adresses que l'app appelle » la ligne `serveur Grist de la personne · connect · <ce que tu lis> · oui, après un geste` : GFS note « à noter » au lieu de « non tenue ». Si ton app n'a pas ce besoin, n'ouvre rien en `https:`.
Si ton formulaire n'appelle pas le serveur Grist avec un jeton, `connect-src 'self'` suffit. Dis dans ton `GFS-ETAT.md` pourquoi `connect-src https:` et `img-src https:` sont ouverts aujourd'hui, ou retire-les ; ajoute `form-action 'none'` ; dis si `style-src 'unsafe-inline'` est encore nécessaire (GFS le note, sans le compter contre toi).

**4. Le reste** : Dependabot actif sur ton dépôt (GFS n'y a pas lu de `.github/dependabot.yml`) ; ton `SECURITY.md` est bien là (S7 et S9).

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc la page que son manifeste ouvre (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
