# 001 · GFS existe, et son explorateur ira chercher ton moteur de synchronisation

App : Sync+ (« Synchro Grist ») · posée le 06/11/2026 · quand : à lire maintenant ; la page d'état à ton prochain lot

## Quoi

1. Lire `docs/gfs-en-bref.md` (dépôt `lombre33/grist-widget-GFS`, branche `main`), une page : ce qu'est GFS (le widget qui héberge
   les apps Grist Factory et leur explorateur de fichiers) et pourquoi il te concerne.
2. Lire ceci, qui est décidé : le porteur veut que l'explorateur de GFS puisse partager un dossier ou un fichier entre deux
   documents Grist qui ont tous deux GFS, avec **ton moteur** plutôt qu'un moteur refait. Choix du porteur du 06/11 : le moteur
   devient un module du **kit** (dépôt commun de la suite, sans bibliothèque, que seul GFS écrit), comme le calendrier de
   Calendar+ (kit 0.8.0). GFS pilote le moteur avec son propre écran ; ton écran à toi reste, il n'est ni remplacé ni retiré.
3. Ne rien changer à ce que fait Sync+ seul : pas de manifeste `gfs.json`, pas d'entrée au catalogue, pas de lien avec GFS dans
   ton code. Sync+ n'est pas une « app de GFS » ; seul son moteur sera lu par GFS (la 002 dit ce qu'il faut séparer).
4. Créer le `GFS-ETAT.md` à la racine de ton dépôt (format : `consignes/LISEZ-MOI.md`, « Répondre : `GFS-ETAT.md` »). GFS le lit
   avant chaque lot qui te concerne ; c'est ta seule façon de lui parler.
5. Relire ce que GFS a retenu de toi (ci-dessous, lu sur la version 0.12.2 du 06/11 en début d'après-midi ; `main` est à la 0.13.2 depuis, que GFS n'a pas relue) et écrire dans la page d'état ce qui est
   faux ou périmé : environ 8 800 lignes de JavaScript sans bibliothèque ; `js/logic/` (3 700 lignes) sans écran ; `js/grist.js`
   seule porte vers Grist ; écrans dans `js/source/`, `js/target/` et `js/ui.js` ; le moteur écrit une table technique
   `Synchro`, les colonnes `id_sync` et `MajLe`, un `Journal_…` par réception avec sa page et son formulaire, des règles
   d'accès « Synchro : … » et des webhooks ; limites : une ligne de plus de 1 Mo n'est pas envoyée, les deux documents sont sur la
   même instance, Grist 1.7.11 au moins.

## Pourquoi

Un seul code pour la synchronisation (règle de la suite : ne pas dupliquer de code), et GFS seul à parler à Grist. Le projet de
Sync+ ne connaissait pas GFS : cette consigne le met au courant, sans rien lui imposer avant la 002.

## Fait quand

`GFS-ETAT.md` existe, donne la ligne « 001 · faite · `commit` » et dit, en note, ce que le relevé du point 5 a de faux ou de
périmé (ou « relevé juste »). Licence : `GPL-3.0-only` y est déjà ; rien à faire.
