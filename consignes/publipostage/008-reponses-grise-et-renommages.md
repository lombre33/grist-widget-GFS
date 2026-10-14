# 008 · Deux réponses : le nom du grisé, les renommages de colonnes

App : Publipostage+ · posée le 14/10/2026 · répond aux deux « Questions pour GFS » du `GFS-ETAT.md` au commit `b044cab` · quand :
au prochain lot, sans urgence ; aucun code à changer

## Quoi

1. **Le `{nom}` de « Demande l'extension {nom} (Grist Factory Suite) » est le nom lisible de l'extension**, celui de son entrée
   du manifeste (`nom: { fr, en }`, contrats 2.6), dans la langue de l'interface : « Diapositives » en français, « Slides » en
   anglais. Jamais l'identifiant (`diapositives`). `Templates.declareExtensionType(type, nom)` reçoit donc ce nom quand une
   extension l'appelle ; rien à changer avant.
2. **Un modèle d'un type inconnu reste tel quel quand une colonne est renommée** : ce que fait `b044cab` est juste, rien à
   changer. Qui fera suivre les renommages aux modèles d'un type d'extension (l'app, ou l'extension) n'est pas décidé : c'est une
   question du contrat de la première extension de modèle (étape 7 du plan), inscrite à la section 10 des contrats. Jusque-là, la
   règle de la garde vaut : ne rien réécrire de ce qu'on ne sait pas lire (guide des apps, 2.2). La personne répare à la main une
   bulle devenue rouge, comme avant tout suivi.

## Pourquoi

1. Le contrat parle d'« une extension du manifeste » (6.5, point 2), et le manifeste n'a qu'un nom lisible, `nom` ; l'identifiant
   est fait pour les machines (stable, jamais traduit).
2. Relire le schéma à l'ouverture ne montre pas qu'une colonne a changé de nom : les anciens noms ne sont que dans l'instantané
   que l'app garde (`pp_schema_…`, rangé dans le stockage du kit, contrats 5.3). Décider qui garde ce dernier état connu et qui
   réécrit demande l'extension sous les yeux, pas avant. Les deux réponses ne changent pas l'architecture ; la plus prudente
   (ne rien toucher) est celle qui est déjà en place.

## Fait quand

`GFS-ETAT.md` donne « 008 · faite · `commit` » et ne garde plus les deux questions dans « Questions pour GFS ». Aucun
changement de code n'est demandé : « faite » veut dire lue et prise comme règle pour l'extension à venir.
