# 095 · À l'ouverture : l'adresse e-mail prise chez GFS, et les lectures de métadonnées qui restent (elle remplace la 094)

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · remplace la 094, que GFS avait écrite avant d'avoir lu ta page du 23/11 (`d4cd4bc`) · mesure de GFS du 23/11 (étude « ouvrir les fichiers plus vite », faits vérifiés 147) · demande du porteur du 24/11
quand : à ton chantier d'ouverture, sans urgence ; du code dans l'app (la sonde de l'adresse, quelques lectures de métadonnées partagées) et une demande à GFS ; vaut dans GFS, et seule pour la partie « lectures »

## Quoi

La 094 demandait trois choses. GFS a lu ta page du 23/11 : une partie est déjà faite, la 095 garde le reste. Si tu as lu la 094 avant celle-ci, la 095 prime.

**Déjà fait, rien à refaire** (lu dans ton code à `d4cd4bc`, pas rejoué par GFS)

- `a510931` : la table des modèles se lit une fois à l'ouverture d'un document à jour (deux pour un document d'avant, dix avant). C'est la lecture que GFS avait vue neuf fois de suite (8 s sur 16 Mo, une ouverture à froid sur six). Elle profite de la copie de GFS : sur un gros document (4 à 48 Mo), la première lecture de ta table des modèles est servie par la lecture que l'explorateur vient de faire, si personne n'a écrit entre-temps (0,13 à 0,18 s au lieu de 0,8 à 0,98 s, livré le 23/11, `26ce345`) ; cette copie ne sert qu'une fois, et c'est maintenant ta première lecture qui en profite.
- `98b1964` et `7d0ccd6` : le document que GFS désigne s'affiche en lecture seule par la lecture REST d'une seule ligne, pendant que la table se lit. C'est ce que le point 3 de la 094 cherchait (montrer avant la fin des lectures) : rien à ajouter. Cette lecture ne passe pas par GFS et ne prend pas sa copie ; le jeton qu'elle demande à chaque ouverture entre dans le compte des appels de GFS.

**1. Les lectures de métadonnées restent à compter.** GFS a compté à `6fd6eec`, avant `a510931` : à l'ouverture, **25 appels à Grist, dont 14 différents** : `_grist_Tables` ×4, la liste des tables ×4, les colonnes ×3, et la ligne-sonde de l'adresse (une écriture, une lecture, une suppression). `a510931` ne touche que la table des modèles : GFS n'a pas vu ces lectures-là changer. Compte-les à `d4cd4bc` avec ton journal d'ouverture (`js/perf-trace.js`, Ctrl + Alt + Maj + L : les appels à `grist.docApi`, cumulés par appel). Premier endroit à regarder, d'après la lecture du code (pas mesuré) : deux couches lisent les mêmes tables de métadonnées, `js/schema-columns.js:186` et `:199` (la liste des tables, `_grist_Tables`, `_grist_Tables_column`) et `js/grist-api.js:59` et `:688` (la liste des tables, puis `_grist_Tables`, `_grist_Tables_column` et `_grist_DocInfo`). Ce qui se lit plusieurs fois se partage par une promesse commune entre ceux qui le demandent, comme tu le fais déjà pour la liste brute des tables (`js/grist-api.js:55`) ; vise une dizaine d'appels.

**2. L'adresse e-mail vient de GFS, la ligne-sonde devient le repli.** GFS donne l'adresse e-mail de la personne aux apps qui la déclarent (guide des apps, 1.2 point 14 ; contrats 3.4 point 6 et 5.2 point 9 ; kit 0.4.0, `GfsLink.identity()` et `GfsLink.onIdentity(fn)`, que ton kit 0.27.0 a). Ta page du 23/11 ne la demande pas encore. Le manifeste de Publipostage+ est tenu par GFS (`prototype/manifestes/publipostage.json`) : **demande-la dans la section « Demandes à GFS » de ton `GFS-ETAT.md`**, en une ligne (`identite` · la raison, en français et en anglais, que la personne lira à l'installation · ce qu'elle sert à faire chez toi : les droits d'accès, l'auteur des commentaires, « Modifié par »). GFS déclare `permissions.identite` dans ton manifeste dès qu'il lit la ligne (un commit à part), puis te répond. Le code ensuite :

- tant que `GfsLink.identity()` rend `null`, tu fais comme aujourd'hui (ta sonde, `probeUserRow` : `null` veut dire « pas déclarée », « GFS ne la connaît pas encore » (sa table de rangement n'existe pas dans un document neuf), « document en lecture seule » ou « app seule » : tu ne peux pas les distinguer, le repli est obligatoire) ;
- quand elle rend `{ email }` (dans le contexte, ou plus tard par `onIdentity`), c'est elle qui sert : **plus d'écriture, de lecture ni de suppression à l'ouverture** ;
- le **nom** de la personne (`user.Name`) n'est pas dans l'identité de GFS : la sonde reste son seul chemin, au moment où une chip « Nom » le demande, plus à l'ouverture ;
- l'adresse est celle de Grist, à la lettre près : compare-la en minuscules.

## Pourquoi

Le porteur veut des fichiers qui s'ouvrent plus vite, et il a dit que Publipostage+ a son propre chantier d'ouverture : cette consigne en donne les mesures. La ligne-sonde est une écriture que l'app fait à l'ouverture sans geste de la personne ; elle est inutile quand GFS donne l'adresse, et une app qui écrit au démarrage ne peut pas être démarrée cachée d'avance (une piste que GFS a étudiée et laissée de côté pour cette raison). Mesuré à froid à `6fd6eec` : 0,72 s sur un document léger (le mur est le démarrage de l'app, 0,54 s jusqu'à la page chargée), 1,6 s sur 16 Mo avant la copie de GFS, 0,8 à 0,9 s avec elle.

Ce que cette consigne ne demande pas : retirer la sonde (elle reste le repli et le chemin du nom), ni changer ce que l'app dit à la personne.

## Fait quand

1. À froid, sur un modèle ouvert depuis GFS, chaque table interne n'est lue qu'une fois, y compris sur le document de 16 Mo : ta page dit ce que ton journal d'ouverture compte à ton commit (les appels, et lesquels restent plusieurs fois s'il en reste). GFS rejoue ensuite son banc d'ouverture (celui du 23/11, une dizaine d'appels attendue au lieu de 25) et le dit.
2. Quand GFS donne l'adresse (`GfsLink.identity()` rend `{ email }`), l'ouverture n'écrit rien dans le document (plus de ligne-sonde) ; quand elle rend `null`, tu retombes sur la sonde, comme avant. Un essai à toi couvre les deux cas.
3. Ta page `GFS-ETAT.md` dit « 095 · faite » avec le commit, la ligne `identite` dans « Demandes à GFS » et, dans « Changements qui touchent GFS », la date et le commit. GFS lit le dépôt de ton app, déclare `identite` à ta demande, rejoue la mesure d'ouverture, puis passe cette consigne à « faite ». La 094 n'a rien à dire dans ta page : elle est remplacée.
