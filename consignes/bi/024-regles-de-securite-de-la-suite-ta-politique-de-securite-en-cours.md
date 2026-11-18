# 024 · Les règles de sécurité de la suite : ce que GFS contrôlera dans la politique de sécurité que tu écris, et où dire où tu en es

App : Grist-BI (`lombre33/Grist-BI`) · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« des règles de sécurité dans le cahier des charges de toutes les apps, présentes et surtout à venir ») · cahier 3.2.1 et 3.2.2 · guide des apps 1.4 · faits vérifiés 133
quand : à lire avant de publier ta politique ; du code dans ta page (la politique) ; le porteur dit que tu l'écris en ce moment ; décision du porteur du 18/11

## Quoi

**1. Lis les règles** : guide des apps 1.4 (S1 à S9, avec un gabarit de politique) et cahier 3.2.1.

**2. Ce que GFS a lu dans ta page** (branche principale, 18/11) : aucune politique de sécurité (une carte d'importation, 44 scripts, un script en ligne, le script d'API de Grist comme seule adresse externe). Le porteur dit que tu l'écris en ce moment : voici ce que GFS contrôlera.

**3. La forme attendue** (règles S1 à S4) : une balise `<meta http-equiv="Content-Security-Policy">` qui part de `default-src 'none'` et rouvre seulement ce que ton app utilise : `script-src` (`'self'`, le script d'API de Grist par son adresse entière avec `'unsafe-eval'`, les adresses exactes et versionnées de ce que tu charges encore d'un CDN : pdfmake, PptxGenJS ; ta carte d'importation et ton script en ligne par empreinte),
`connect-src`, `img-src`, `font-src`, `worker-src`, `frame-src` : `'self'` et des adresses exactes seulement.
DuckDB-WASM demande sans doute `'wasm-unsafe-eval'` et `worker-src blob:` : si tu dois les ouvrir, **dis-le dans ton `GFS-ETAT.md` avec la raison** (règle S4) ; GFS le note, il ne le compte pas contre toi. Mesure ta page dans un vrai Grist, console ouverte, avant de la publier : toute violation que tu n'attendais pas est une adresse oubliée ou un appel à retirer.

**4. Tes bibliothèques** (règle S5) : celles de `js/vendor/` sont déjà dans ta consigne 023 ; pour les adresses de CDN, dis lesquelles portent `integrity`.

**5. Le reste** : Dependabot actif sur ton dépôt et un `SECURITY.md` à la racine (S7 et S9).

**Deux sections de ton `GFS-ETAT.md`** (format dans le guide 1.4 et dans `consignes/LISEZ-MOI.md`) : « Adresses que l'app appelle » (chaque adresse que ta politique ouvre, avec sa raison ; « aucune » si seulement `'self'`) et « Sécurité » (une ligne par règle, de S1 à S9 : tenue, en cours avec une date prévue, ou non tenue avec la raison). Ce que tu y écris s'affiche comme « L'app dit : … » à côté de ce que GFS a lu.
## Pourquoi

Le porteur a demandé le 18/11 que toutes les apps, présentes et à venir, suivent des règles de sécurité écrites, et que la fenêtre « Dépendances » de GFS devienne un tableau de bord de sécurité. Le risque qu'il a nommé : une bibliothèque piratée qui envoie les données de la personne ailleurs. **La seule barrière, c'est la politique de sécurité de ta page**, appliquée par le navigateur : GFS ne peut en imposer aucune à un sous-cadre, et il ne voit pas ce qu'une bibliothèque appelle pendant l'usage. GFS lit donc ta page (à ta référence et sur ton site en ligne) et la compare aux règles ; chaque semaine, un contrôle automatique le refait. Rien ne se bloque : la fenêtre montre où tu en es, règle par règle, avec la date du contrôle.

## Fait quand

Ton `GFS-ETAT.md` a les deux sections, et la fenêtre « Dépendances » de GFS montre, sous ton app, S1 à S7 tenues ou « en cours » avec une date. GFS lit ton `GFS-ETAT.md` et ta page (quand le porteur le demande, ou avant tout travail qui touche ton app), puis passe cette consigne à « faite ».
