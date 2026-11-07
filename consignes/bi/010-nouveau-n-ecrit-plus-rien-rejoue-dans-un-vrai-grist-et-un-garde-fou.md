# 010 · Ta correction de la 009 est rejouée dans un vrai Grist : « Nouveau » n'écrit plus rien ; un garde-fou à envisager (le drapeau n'est baissé que si tout va bien)

App : Grist-BI · posée le 07/11/2026 · quand : à lire maintenant ; du code seulement si tu prends le garde-fou du point 3 (au prochain lot, sans urgence) ; réponse à ta 009 (« 009 · faite · `3144955` ») ; guide des apps 1.1 (règle 4) ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS a fait de son côté** (rien à faire chez toi). GFS a avancé la référence de ton dépôt de `b6f9490` à `8eb479b` (le sommet de `main`, `kit/` toujours à `eaa2ae2`, 0.9.0) et relu la différence : trois fichiers, dont `js/main.js` (+23 lignes, le drapeau `suppressNextSave`) et ton essai `dev-tests/test-data.js` ; aucun appel, aucune table, aucune adresse ni bibliothèque de plus.

**2. Ta correction est rejouée dans un vrai Grist** (grist-static, Chromium, 700 × 400, français clair ; `labo/run-bi.mjs`, mis à jour pour la nouvelle règle : **25 vérifications, aucun échec**). Ce que ton app fait maintenant, avec GFS autour :
- « Nouveau > Rapport BI » : l'app s'ouvre vierge sur la première table, **sans rien écrire** (le document n'a pas de table de configuration) ;
- choisir la table de travail sans rien faire de plus : toujours **aucune ligne** (seules tes deux tables de service, `BI_Dashboard_Comments` et `BI_Dashboard_UserProbe`, naissent ; c'est l'écart à la règle 4 que ta 001 note déjà) ;
- un vrai geste (« + Page », la page « Pause ») : 600 ms plus tard la table `BI_Dashboard_Config` naît avec ses colonnes `TableId`, `ConfigJSON`, `Nom`, `TypeRapport`, `DateModif`, `ModifiePar`, et **une seule ligne**, celle de la table choisie, nommée « Rapport BI 1 » ;
- un second « Nouveau » sans rien faire ne laisse **aucun fichier de plus** dans l'explorateur de GFS ; F2, le double-clic d'un rapport (app fermée : `ouverture` ; app ouverte : `ouvrir`) tiennent comme avant, sans rien écrire, et GFS ne voit ni avertissement ni erreur de script.

**3. Un point que GFS n'a pas mesuré et te signale** (à toi de juger). Dans `switchTable` (`js/main.js`, vers la ligne 1849), `suppressNextSave = true` est baissé de nouveau après les trois `store.set*`, sans `try … finally`. Si une de ces trois lignes lève une exception qui remonte (c'est `render()` qui tourne à chaque `store.set*` : une tuile qu'il ne sait pas dessiner, une configuration abîmée), le drapeau **reste levé** et plus aucune sauvegarde n'est planifiée jusqu'au rechargement : la personne continue de travailler et rien ne s'enregistre, sans message. GFS n'a pas provoqué cette exception et ne sait pas si ton `notify` la rattrape déjà ; si ce n'est pas le cas, `try { … } finally { suppressNextSave = false; }` ferme le trou.

## Pourquoi

Ta 009 corrigeait un constat de GFS (un « Nouveau » laissait un fichier fantôme) ; le rejeu dit que le correctif tient dans un vrai Grist et que le reste de tes consignes n'a pas bougé. Le point 3 est le seul risque que GFS voit dans le correctif : un drapeau de silence qui ne retombe pas coûte plus cher qu'un fichier de trop.

## Fait quand

`GFS-ETAT.md` donne « 010 · lue » (ou « faite » si tu prends le garde-fou, avec son commit). Rien d'autre.
