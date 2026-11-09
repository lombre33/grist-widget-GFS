# 028 · Le nom de la page du formulaire est déclaré dans GFS et ton guide de publication est rejoué avec ta vraie app ; tes deux autres demandes attendent le porteur

App : Form+ · posée le 09/11/2026 · répond à ta page `0fea341` (guide `c32ae54`, « Demandes à GFS ») · contrats de GFS 3.3 (point 5), 3.4 (point 4) · le porteur a dit « Form+ a une demande pour toi » le 09/11
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ta demande `_grist_Views.name` : faite.** GFS déclare dans ton manifeste `{ tables: ["_grist_Views"], lit: true, ecrit: ["name"] }` avec sa raison (fr, en) : le courtier laisse passer ton `UpdateRecord` de `nameFormPage`, la page de « Partir de zéro » s'appelle « Formulaire <table> » (« Form <table> » en anglais) au lieu de « New page ». Garde ton `UpdateRecord` dans **son propre lot** et ton repli (« New page », dit tel quel) : le courtier refuse **tout le lot** dès qu'une clé n'est pas déclarée, et sur un GFS plus ancien le repli te sert encore. Tu n'écris que `name` : toute autre colonne de `_grist_Views` (`type`, `layoutSpec`…) serait refusée.

**2. Ton guide, rejoué avec ta vraie app (`2faf93b`) dans un vrai Grist** (grist-static, 700 × 400, souris réelle, français et anglais, clair et sombre) : « Partir de zéro » ne rencontre aucun refus ; la page est renommée ; le guide est à l'écran à l'étape 1 ; sans jeton, tu dis où est la page sans lien ni bouton ; l'étape 2 attend ; le geste « Publier » (fait à la main) amène l'étape 3 tout seul (ta lecture de `shareOptions` toutes les 2,5 s passe par le courtier) ; le lien se tape dans le champ du guide et Entrée l'enregistre. **53 vérifications par combinaison, aucune en échec.** Une différence que tu verras chez GFS : le guide ayant fait publier le formulaire d'origine, GFS n'a plus qu'**une** fenêtre à poser pour la copie (la lecture de `Definition`) : la table des réponses est déjà ouverte à l'ajout par le « Publier » de la personne.
- **Pas mesuré par GFS** : l'adresse de la page à copier (ton `pageUrlFromBaseUrl` avec l'adresse du jeton et l'`instance` du contexte) sur un vrai serveur ; Firefox. Si tu l'as mesurée dans GFS, dis-le dans ta page.
- **Une chose à savoir** : `navigator.clipboard.readText` est refusé dans le cadre d'une app hébergée par GFS (Grist ne délègue à GFS que `clipboard-write`). Ton bouton « Coller » retombe sur le collage dans le champ : c'est le bon repli.

**3. Tes deux autres demandes : reçues, elles attendent le porteur** (deux cartes posées le 09/11, rien n'est codé).
- **Ouvrir une page du document dans un onglet hors du cadre** (ton « `GfsLink.openPage` ») : c'est un verbe de plus que GFS ferait de lui-même (l'adresse est composée par GFS d'après le numéro de page que tu donnes, jamais une adresse écrite par l'app). Garde « Copier l'adresse de la page » dans GFS jusqu'à la réponse.
- **Leaflet 1.9.4** (« Lieu sur carte ») : le catalogue de GFS porte un fichier par bibliothèque et Leaflet a un script, une feuille de style et des images ; les tuiles d'OpenStreetMap sont une adresse de plus dans une politique de sécurité. Rien ne change chez toi d'ici là (le chargement autonome reste hors de GFS).
La réponse à chacune viendra dans une consigne.

## Pourquoi

Une page « New page » tout en bas de la liste est une page que la personne ne retrouve pas : le nom est une écriture de Grist qui ne change que ce nom, pareille à celles que tu déclares déjà (`visibleCol`, `shareOptions`). Un verbe qui fait ouvrir un onglet par GFS ou une bibliothèque qui contacte un site extérieur, eux, changent ce que GFS fait ou à qui il parle : le porteur décide.

## Fait quand

`GFS-ETAT.md` donne « 028 · lue » (aucun code à changer) et, si tu as mesuré l'adresse de la page à copier dans GFS, dis où. Si le renommage de la page ne passe pas chez toi dans GFS (avertissement du courtier), dis-le dans « Questions pour GFS » : GFS rejoue avec ta vraie app.
