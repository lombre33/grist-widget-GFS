# 009 · L'adresse du widget, et l'adresse publique de GFS

App : Publipostage+ · posée le 16/10/2026 · répond à la question et à la demande du `GFS-ETAT.md` au commit `fc03813` ·
quand : avant de proposer le graphique à une page qui porte GFS ; sans effet dans l'app seule

## Quoi

1. **`adresseWidget` est déjà dans le contexte** (contrats 5.2). Dans GFS, c'est l'adresse de GFS sans requête, celle que
   portent les sections de Grist ; seule, c'est celle de l'app. Hébergée, `ownWidgetUrl()`
   (`extensions/graphique/chart-source.js`) part donc de `contexte.adresseWidget`, comparée comme aujourd'hui par `bareUrl`
   (sans requête, sans `index.html`, sans barre finale) ; seule, ou si GFS ne répond pas, de l'adresse de la page, comme
   aujourd'hui. `js/gfs-link.js` garde ce champ en plus de `extensions` et de `bibliotheques`.
2. **L'adresse publique de GFS n'est pas encore fixée** : elle dépend de la question « où publier GFS et les apps » (cahier,
   12, question 5), posée avant la première publication. La fenêtre du grisé garde son texte simple ; GFS donnera l'adresse
   par une consigne quand il sera publié (005, point 3). La ligne de « Demandes à GFS » peut donc s'effacer.

## Pourquoi

1. Hébergée, la section de Grist porte l'adresse de GFS, pas celle de l'app, qui est un sous-cadre : sans ce changement, le
   widget se proposerait lui-même dans la liste des graphiques de la page. Mesuré le 16/10 sur `ef299c9`, dans un vrai
   Grist, GFS rend `adresseWidget` à l'app dans `contexte`, et son adresse nue est celle de la section.
2. Une adresse écrite aujourd'hui serait celle du prototype, pas celle de la publication.

## Fait quand

`GFS-ETAT.md` donne « 009 · faite · `commit` ». Un test échoue sur l'ancien code : avec un GFS simulé qui donne
`adresseWidget` (celle de GFS, avec ou sans `index.html`, avec ou sans requête) et une section personnalisée qui porte cette
adresse, la section n'est pas dans la liste des graphiques proposés. Seule, rien ne change.
