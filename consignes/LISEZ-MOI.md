# Consignes de GFS aux apps

Ce dossier est la boîte aux lettres de GFS vers les projets des apps ; le `GFS-ETAT.md` que chaque app tient à la racine de son
dépôt est celle des apps vers GFS. Chaque côté ne lit qu'une page : l'app lit l'`INDEX.md` de ses consignes, GFS lit le
`GFS-ETAT.md` de l'app. Personne ne pousse dans le dépôt de l'autre : GFS écrit ici, l'app écrit chez elle. Une app qui a
besoin de quelque chose dans GFS le **demande** (section « Demandes à GFS », plus bas) et teste dans une copie à elle
(`TESTER-AVEC-GFS.md`) : elle ne pousse jamais chez GFS.

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

## Demandes à GFS
- <bibliothèque> · <version exacte> · <fonction concernée> · <à quoi elle sert> ; « aucune » sinon
```

Ce qui touche GFS, et seulement cela (le journal des commits dit déjà le reste) :

- une table possédée ajoutée, renommée ou retirée ; une colonne ajoutée ou retirée dans une table de fichiers (identifiant,
  nom, type, dossier, date) ;
- un type de fichier ajouté ou retiré (valeur de la colonne de type) ;
- une clé de réglages de la vue ajoutée, renommée ou retirée ;
- une table interne `_grist_*` lue ou écrite en plus ou en moins ;
- une bibliothèque ou une adresse de la CSP ajoutée ou retirée (celle d'une extension se demande plutôt, voir plus bas) ; une
  extension ajoutée ou déplacée ;
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
- GFS répond à une question ou à une demande par une nouvelle consigne ; elle s'efface alors du fichier.

## Demander à GFS

Une app ne pousse jamais dans le dépôt de GFS, même pour essayer : seul le projet de GFS y écrit (décision du porteur, 14/10).
Ce dont elle a besoin chez GFS, elle le demande dans la section « Demandes à GFS » de son `GFS-ETAT.md`, une ligne par demande.
La demande prévue aujourd'hui est la **bibliothèque d'une extension**, que GFS porte (cahier 4.7 ; guide 1.1, règle 9) :

1. **Coder la fonction sans la bibliothèque** : ni dans la liste de l'app, ni dans son import map, ni dans sa CSP. Une
   bibliothèque dont l'app ne peut pas se passer pour tourner seule (l'éditeur, les exports) n'est pas une demande : elle reste
   dans l'app.
2. **Écrire la demande** : l'identifiant (court et stable, par exemple `plotly`), la **version exacte** (ni `^`, ni `latest`), la
   fonction de l'app qui s'en sert, et à quoi elle sert en une phrase (avec le fichier voulu du paquet, s'il en propose
   plusieurs).
3. **Tester l'assemblage** dans une copie de GFS à soi, sans rien pousser : `TESTER-AVEC-GFS.md`.
4. **Pousser le code chez l'app, puis dire au porteur que c'est prêt.** Il dit à GFS « demande de Publipostage+ » (ou de l'app
   concernée) : GFS ajoute la bibliothèque à sa liste (adresse CDN, empreinte, copie vendorisée, sécurité), déclare
   l'extension, avance la référence de l'app (un commit à part), pousse, et répond par une consigne. La ligne s'efface alors
   de la section.
