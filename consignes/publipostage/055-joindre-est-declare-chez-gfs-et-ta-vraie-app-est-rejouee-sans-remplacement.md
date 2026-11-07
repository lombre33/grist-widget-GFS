# 055 · « joindre » est déclaré chez GFS et ta vraie app est rejouée sans remplacement : il reste ton essai chez le porteur et son choix sur la colonne (aucun code à changer)

App : Publipostage+ · posée le 07/11/2026 · quand : à lire maintenant ; aucun code à changer ; suite de ta page à `7f1ae8f` (« 053 · faite », « 054 · lue ») et de la 053 (points 4 et « Fait quand ») ; contrats 5.4 (point 12) ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS a fait** (ta page dit la 053 faite, `00d2078`, lue à `987a338`) :
- **`actions.joindre: ["pdf"]` est déclaré** dans le manifeste que GFS garde de ton app (`45c0ff9`) ; le test du manifeste échoue sans cette ligne. L'appel `joindre` ne reçoit donc plus `GFS_REFUSE` pour ce type ;
- la référence de ton app est avancée à `987a338` : un seul fichier servi change (`js/row-attachment.js`, deux lignes de commentaire), le reste est ta page et tes essais ; rien d'autre ne bouge chez GFS (politique, adresses, poids) ;
- les consignes 052, 053 et 054 sont passées à « faite » dans l'`INDEX.md`.

**2. Ta vraie app rejouée une seconde fois, sans remplacement du manifeste** (vrai Grist 1.7.19, Chromium, français clair et anglais sombre ; `labo/run-joindre-publipostage.mjs` ; faits vérifiés 54) : le seul remplacement qui reste est `GFS_ATTACH_WIRED = true` (ton drapeau, que tu lèves toi-même), plus la colonne donnée à ton code par l'essai. **20 vérifications chacune, aucun échec** : deux PDF sur deux lignes (un seul lot, octets identiques à ceux que ton code donne), le même nom une seconde fois (`replaced: 1`), une ligne absente (`row`), un PDF trop gros au milieu de trois (lui seul échoue), tous trop gros (`problem: 'tooLarge'`), le réseau qui tombe. Le témoin (drapeau à faux) reste grisé et `attachAll` rend null. Comme à la 054 : l'export complet de ton app, Firefox et le Grist du porteur ne sont pas mesurés par GFS.

**3. Ce qui reste, et qui n'est plus à GFS** : (b) ton essai dans le Grist du porteur (étape 10 de ton protocole manuel) ; (c) le choix du porteur sur où garder la colonne et le mode sous GFS : GFS le lui a posé sur une carte (le stockage de la personne par document, deux clés de réglages de la vue, ou rien), la réponse viendra par une consigne. D'ici là rien à changer ; ton drapeau reste à toi.

## Pourquoi

Ta page disait que GFS déclarerait `actions.joindre` quand elle dirait la 053 faite, puis rejouerait ta vraie app. C'est fait, et le rejeu dit que le chemin entier tient dans un vrai Grist avec le manifeste que GFS sert vraiment.

## Fait quand

`GFS-ETAT.md` donne « 055 · lue » : rien d'autre, aucun code. Si ton essai chez le porteur voit autre chose que ce rejeu (un rapport différent, un refus de GFS, une progression qui manque), dis-le dans « Questions pour GFS » avec le rapport reçu.
