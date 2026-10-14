# Consignes de GFS aux apps

Ce dossier est la boîte aux lettres de GFS vers les projets des apps ; le `GFS-ETAT.md` que chaque app tient à la racine de son
dépôt est celle des apps vers GFS. Chaque côté ne lit qu'une page : l'app lit l'`INDEX.md` de ses consignes, GFS lit le
`GFS-ETAT.md` de l'app. Personne ne pousse dans le dépôt de l'autre : GFS écrit ici, l'app écrit chez elle.

Dossiers : `publipostage` (Publipostage+), `form` (Form+), `automation` (Automation+), `bi` (Grist-BI).

## Lire ses consignes (projet d'une app)

1. Avant chaque lot, lire `consignes/<app>/INDEX.md`, dans le dépôt `lombre33/grist-widget-GFS` (branche `main`) : une ligne par
   consigne, avec son numéro, son titre, son échéance et son état.
2. Ouvrir seulement les consignes « à faire » que le `GFS-ETAT.md` de l'app ne donne pas déjà pour faites (GFS ne passe une
   consigne à « faite » qu'en lisant ce fichier). Une consigne « faite », « remplacée » ou « retirée » ne se relit pas.
3. Une consigne publiée ne change pas, sauf faute de frappe : un changement de fond est une nouvelle consigne, que l'INDEX dit
   remplacer l'ancienne. Une consigne déjà lue n'est donc jamais à relire.
4. Une consigne ne se contourne pas. Fausse, impossible ou contraire à une règle de l'app : la laisser « à faire » et poser la
   question dans le `GFS-ETAT.md`.
5. Le dépôt est public : une lecture par git suffit (`git clone --depth 1 https://github.com/lombre33/grist-widget-GFS`, vérifié
   le 14/10 depuis le projet de GFS). Les outils GitHub d'un projet ne couvrent que les dépôts qui lui sont ajoutés.

Une consigne tient en une page et se suffit : **Quoi** (ce qu'il faut faire), **Pourquoi**, **Fait quand** (comment savoir que
c'est fait). Quand le détail est dans le guide des apps ou dans le cahier, elle dit où, sans obliger à les lire en entier.

États dans l'INDEX, écrits par GFS seul : `à faire`, `faite` (avec le commit de l'app), `remplacée`, `retirée`.

## Répondre : `GFS-ETAT.md`

Une page (une soixantaine de lignes au plus), écrite par le projet de l'app à la racine de son dépôt et remise à jour à la fin
de chaque lot qui change l'une de ses trois parties. GFS la lit, il ne la modifie jamais.

```markdown
# GFS-ETAT : <nom de l'app>

Mis à jour le AAAA-MM-JJ, au commit `xxxxxxx` (le dernier commit de code que cette page décrit).

## Consignes
- 001 · faite · `xxxxxxx` · note facultative, une ligne
- 002 · en cours · lot 1 sur 2

## Changements qui touchent GFS
- AAAA-MM-JJ · `xxxxxxx` · ce qui a changé, en une ligne

## Questions pour GFS
- une ligne par question ; « aucune » sinon
```

Ce qui touche GFS, et seulement cela (le journal des commits dit déjà le reste) :

- une table possédée ajoutée, renommée ou retirée ; une colonne ajoutée ou retirée dans une table de fichiers (identifiant,
  nom, type, dossier, date) ;
- un type de fichier ajouté ou retiré (valeur de la colonne de type) ;
- une clé de réglages de la vue ajoutée, renommée ou retirée ;
- une table interne `_grist_*` lue ou écrite en plus ou en moins ;
- une bibliothèque ou une adresse de la CSP ajoutée ou retirée ; une extension ajoutée ou déplacée ;
- une action « ouvrir », « choisir », « insérer » ou « fermer » ajoutée ou changée ;
- une version publiée (étiquette du dépôt public) ; la création ou un changement de `gfs.json`, quand il existera.

Règles du fichier :

- Les changements vont du plus récent au plus ancien ; au-delà d'une vingtaine de lignes, les plus anciennes s'effacent
  (l'historique git les garde).
- C'est un fichier de développement : il ne se publie pas, et ne contient ni prénom de personne, ni lien de session, ni secret.
  Si l'app a un outil d'envoi vers un dépôt public, y ajouter son nom aux exclusions dans le même commit que le fichier
  (Publipostage+ : `EXCLUS` dans `outils/depot-propre/publier.sh`, qui refuse toute entrée de racine inconnue).
- GFS le lit quand le porteur le demande et avant tout travail de GFS qui touche l'app (contrats, prototype, kit). Une question
  urgente se dit aussi au porteur, dans le projet de l'app.
- GFS répond à une question par une nouvelle consigne ; la question s'efface alors du fichier.
