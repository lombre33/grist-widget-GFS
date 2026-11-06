# 009 · Tes 006 à 008 rejouées dans GFS avec ta vraie app : tout passe ; un constat sur « Nouveau » (la ligne du rapport naît à l'ouverture)

App : Grist-BI · posée le 06/11/2026 · contrats de GFS 5.2 à 5.4 (ouvrir, fermer), guide des apps 1.1 (règle 4) · réponse à tes 006, 007 et 008, que ta page dit faites (« GFS rejoue … quand ta référence avance ») ·
quand : à lire maintenant ; du code seulement si tu corriges le constat du point 2 (au prochain lot, sans urgence) ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS a fait de son côté** (rien à faire chez toi). GFS a avancé la référence de ton dépôt de `474d67f` à `b6f9490` (le sommet de `main`, `kit/` à `eaa2ae2`, 0.9.0) et a rejoué tes trois consignes dans un vrai Grist (son labo : le sous-cadre isolé
comme dans GFS, panneau de 700 × 400, vraie souris et vrai clavier, en français clair et en anglais sombre). GFS sait maintenant que ton app ouvre un rapport précis et en crée un vierge (`ACCEPTS_OPEN` : « Nouveau > Rapport BI » et le
double-clic ne disent plus « Provisoire »). Mesuré, ton code tel que tu l'as poussé :

- **007, point 1 : ton app démarre dans GFS.** Origine « null », stockage refusé, `GristBI.i18n` existe, aucune erreur de script, le courtier ne refuse rien.
- **007, points 2 et 3.** Le choix de la table crée tes trois tables et les colonnes `Nom`, `TypeRapport`, `DateModif`, `ModifiePar` sur `BI_Dashboard_Config` ; un rapport est une ligne nommée (« Rapport BI 1 », « BI report 1 » en anglais :
  ton app suit la langue de GFS dès son démarrage) ; une ligne d'avant, sans nom, s'affiche « (sans nom) » jusqu'à son prochain enregistrement ; **F2 dans l'explorateur écrit `Nom`**, et rien d'autre ; le double-clic d'un rapport l'ouvre,
  app fermée (ton `GfsLink.opening()`) comme app ouverte (ton `onOpen`), sur la table de ce rapport (Commandes, pas la première table), sans rien écrire dans le document.
- **006 et 008 : ton `onClose` écrit avant de partir.** Une page ajoutée par ton bouton « + Page », puis « Nouveau > Document » de Publipostage+ avant que ton enregistrement ait eu lieu (l'essai porte ton délai de 600 ms à 600 000 ms, de sorte
  que seule ta réponse à `fermer` peut écrire) : le document porte ensuite ta ligne avec la page « Pause ». Sans ton abonné, la page est perdue (le témoin de l'essai).

**2. Un constat : la ligne de ton rapport vierge naît à l'ouverture, sans geste de la personne.** Le commentaire de ton `openBlankReport` (`js/main.js`) dit que sa ligne de `BI_Dashboard_Config` « ne s'écrit qu'au premier enregistrement, jamais ici : « Nouveau »
n'écrit rien par lui-même » ; le contrat parle du « premier enregistrement » (5.4, point 1 : l'app ouvre un fichier vierge « et le crée à son premier enregistrement »). Mesuré : six secondes après « Nouveau > Rapport BI », sans rien toucher, `BI_Dashboard_Config` porte déjà la ligne
« Rapport BI 1 » ; un deuxième « Nouveau » sans rien faire ajoute « Rapport BI 2 », et ainsi de suite. **Chaque « Nouveau » laisse donc un fichier de plus dans le document, même abandonné.** Ce n'est pas une écriture de GFS (GFS n'écrit que le nom
d'un fichier renommé et ne demande rien à ce moment). La cause probable est l'abonné de `js/main.js:776` : `switchTable` appelle `store.setPages(…)`, ce qui planifie l'enregistrement du rapport vierge comme s'il avait changé.

**3. Ce que tu fais.** Lis le constat. Ou tu écris le rapport vierge seulement au premier changement de la personne (un essai à toi : « Nouveau », rien d'autre, le document ne change pas ; puis un changement, la ligne naît), ou tu dis dans ta page que c'est voulu,
avec la raison : GFS ne décide pas à ta place, il lui faut juste une page qui dise vrai.

Hors de cette consigne : tes deux demandes de bibliothèques (`d3-cloud` 2.0.0 et `pdfjs-dist` 6.5.438) sont lues ; GFS les traite quand le porteur le demande (règle du dépôt). Pas mesuré : Firefox, ton site en ligne, un changement de langue pendant que l'app
est ouverte (`onLanguage` : seule la langue du démarrage est vue).

## Pourquoi

Un « Nouveau » est un geste qu'on peut regretter : un fichier fantôme par essai encombre la liste de la personne. Et ta page, qui dit le contraire de ce qui se passe, trompe le projet suivant qui la lira.

## Fait quand

`GFS-ETAT.md` donne « 009 · lue » maintenant, puis « 009 · faite · `commit` » quand « Nouveau » sans rien faire n'écrit plus de ligne (avec l'essai qui le montre) ou que ta page dit que c'est voulu, avec la raison. GFS rejoue `run-bi` (le constat y est une ligne
`CONSTAT`, qui passera en vérification) quand ta référence avance.
