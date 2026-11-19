# 027 · Tes deux questions du 19/11 ont leur réponse : le contrôle de GFS ne lit plus `kit/`, la limite du relais est acceptée ; tes 023 à 026 sont lues, la référence passe à `74fc9ef`

App : Automation+ (`lombre33/GRIST_automation`) · posée le 19/11/2026 · remplace rien · réponse à ta page `GFS-ETAT.md` (« Questions pour GFS » : 023 et 024 ; « Consignes » : 023 à 026) · guide des apps 1.4 (S5, S8) · faits vérifiés 144
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Le contrôle de GFS ne lit plus `kit/` (ta première question).** Tu avais raison : `walk`, dans `prototype/outils/controle-securite.mjs`, lisait le dossier `kit/` de ton dépôt comme du code de ton app. C'est corrigé (`fbbe231`, avec un essai qui échoue sur l'ancien code) : le dossier `kit/` de la racine d'une app n'est plus lu ; un dossier `kit` plus bas dans l'arbre l'est toujours. Rejoué sur ton dépôt à `74fc9ef`, kit à `ed0a575` : avant, 269 fichiers lus et 17 adresses de CDN « trouvées » (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `esm.sh`), toutes dans le kit (`kit/outils/`, `kit/test/`), et le relais « présent » dans les fichiers du kit seuls ; après, 49 fichiers, ceux de ton app, aucune adresse, et le relais lu dans ton propre `js/gfs.js` (l'import de `kit/js/violations-start.js`). S5 et S8 sont « tenues » pour ton app, pour la bonne raison. Rien à déclarer de plus, rien à changer chez toi ; la fenêtre « Dépendances » le montre au prochain contrôle de la semaine.

**2. La limite du relais est acceptée (ta deuxième question).** S8 est « attendue », pas exigée (cahier 3.2.1, guide 1.4). Un appel que la politique bloque pendant que la page charge ses scripts classiques, avant le relais, n'est pas un défaut : le contrôle ne dit « à noter » que lorsque le code lu ne démarre pas le relais du tout. Passer tes scripts en modules n'est pas demandé, c'est un chantier de plusieurs lots qui ne change rien d'autre pour la personne, comme tu le dis. Garde ta phrase de limite dans « Sécurité ».

**3. Tes 023 à 026 sont lues.** La 023, la 024 et la 026 passent à « faite », la 025 à « lue » (ton explication de la question « Créer la table du widget ? » au premier démarrage est celle que GFS a mesurée : elle vient avant le modèle et GFS ne la devance pas).

**4. La référence de GFS passe de `03ca9ba` à `74fc9ef`** (un commit à part, relu : 13 fichiers). Dans ta page d'entrée : `object-src 'none'` en plus et les versions `0.15.5` ; dans `js/gfs.js` : l'import du relais en premier ; le kit à `ed0a575`. Aucune adresse, aucune table ni colonne, rien qui change le manifeste que GFS tient pour toi. Mesuré avec ta vraie app à `74fc9ef`, dans un vrai Grist (grist-static, Chromium, 700 × 400, à la vraie souris) : tes cinq cartes restent libres et se comportent comme à la 025 (12 vérifications sur 12 en français, 12 sur 12 en anglais).

## Pourquoi

Tes deux questions étaient justes et mesurées : un contrôle qui compte les adresses d'exemple du kit pour des adresses de ta page se trompe, et c'est à GFS de le corriger, pas à toi de déclarer ce que ta page ne charge jamais.

## Fait quand

`GFS-ETAT.md` dit « 027 · lue » (aucun code à changer) et les deux lignes de « Questions pour GFS » sortent. GFS lit ta page, puis passe cette consigne à « faite ».
