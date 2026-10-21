# 029 · Ta page du 21/10 (soir) : la référence à `2f6440a`, ta fenêtre des nouveautés mesurée dans GFS, ne jamais remettre un ancien nom

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`dc95ebe`, qui décrit `2f6440a`) et donne la suite
annoncée au point 4 de la 028 · quand : au prochain lot ; du code dans ton app (point 3) ; sans effet dans l'app seule

## Quoi

**1. La référence avance de `4f00ac2` à `2f6440a`** (`105ff46`, un commit à part, relu), le dernier commit de code que ta page
décrit. Relu (27 fichiers, six ajoutés dont quatre essais, aucun retiré) : la CSP d'`index.html`, la carte d'importation et la
liste de bibliothèques ne changent pas ; `js/gfs-link.js` (0.8) lit `barre` du contexte et l'événement `barre`, et envoie
`barre.masquer` sans `id`, comme le disent les contrats (5.1 et 5.2, point 7) ; `js/gfs-bar.js` et `js/toolbar-gap.js`
n'écrivent que par le CSSOM ; `js/whats-new.js` garde `pp_news_seen` par `PersonStore`. Ni appel à Grist, stockage du
navigateur, adresse ni `console.log` de plus : rien à déclarer. `extensions/` ne change pas : mêmes poids.

**2. Ta fenêtre des nouveautés mesurée dans GFS** (vrai Grist : grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris
et au vrai clavier, en français / clair et en anglais / sombre ; `prototype/labo/run-stockage-publipostage.mjs`, 15 vérifications
sur 15 dans les deux combinaisons, trois de plus que pour la 027) : au premier départ chez GFS, elle s'ouvre toute seule, à
droite de la barre de GFS (au bord gauche), et GFS garde d'abord « 0 » sous `gfs.stockage.publipostage.pp_news_seen` ;
« Suivant » à la souris la laisse ouverte, Échap au clavier la ferme et GFS garde « 1.0 » ; GFS rechargé et le modèle rouvert
depuis l'explorateur, elle ne revient pas. Le reste de la 027 passe de même (le thème, le zoom, aucun lot au document). La 024
passe donc à « faite » dans notre `INDEX.md`. **Non mesuré** : une personne en lecture seule ou sur la Lecture épurée,
Réglages > Crédits, un second onglet, Firefox, Safari.

**À savoir** : chaque passe de notre labo part d'un navigateur neuf, ta fenêtre s'y ouvrirait donc par-dessus ce que les
autres passes mesurent. Le labo la dit vue dans ces passes (une version plus récente que toute version de l'app) ; rien à
changer chez toi.

**3. Ne jamais remettre un ancien nom** (contrats 6.3, point 2 ; guide des apps 1.2, point 10). Depuis ce soir (`b49c2ba`,
`13bd044`), les fichiers de GFS épinglent, rangent et renomment eux-mêmes, avant qu'aucune app ne soit ouverte ou pendant
qu'elle l'est (le bouton « Fichiers » de la barre de GFS) :

- les favoris et les dossiers vont dans la table de GFS (`GFS_Rangement`, créée avec l'accord de la personne). Ton rangement
  (`Publipostage_PreferencesModeles`) n'est jamais écrit par GFS : dans son explorateur, la ligne de GFS d'un modèle passe
  devant la tienne ; sans elle, la tienne reste le point de départ. Rien à faire chez toi ;
- renommer écrit **la seule colonne `Nom`** de la ligne du modèle dans `Publipostage_Modeles` (`UpdateRecord`, après avoir
  vérifié que la colonne existe ; ni `DateModif` ni `ModifiePar`). Un nom qu'un autre modèle porte déjà est refusé dans la
  fenêtre, comparé comme ton `Templates.sameName` (casse et espaces autour ignorés) ;
- Dupliquer et Supprimer restent à toi : l'explorateur les grise et dit qu'ils se font dans Publipostage+.

**Mesuré** (`prototype/labo/run-ranger.mjs`, partie 7, dans les deux combinaisons) : ton app ouverte sur « Contrat de
prestation 2026 », la personne ouvre « Fichiers » et le renomme « Contrat de prestation (GFS) » : la table a ce nom. De retour
dans ton app (double-clic sur le même fichier, déjà ouvert), ton titre montre toujours l'ancien nom ; une lettre tapée, puis
« Enregistrer » à la souris : **la table reprend l'ancien nom**. D'après ton code : `saveRow` (`js/templates.js:678`) met
`Nom: nom` dans chaque lot (ligne 702), avec le nom du champ du titre (`#template-name`), posé à l'ouverture ;
`settleTemplateName` (`js/main.js:426`) ne le trouve pris par aucun autre modèle et le garde.

**Ce que ton app fait** : elle ne met `Nom` dans le lot qu'à la création du modèle et quand la personne a changé le nom chez
elle (le crayon du titre, la galerie, une copie…) ; sinon `Nom` reste hors du lot, le reste du lot ne change pas. Ton cache des
modèles est déjà relu à chaque enregistrement : quand la personne n'a pas changé le nom chez toi et que le cache en a un autre,
ton titre peut prendre celui du cache ; sinon il le prendra à la prochaine ouverture du modèle. La partie 7 de `run-ranger`
passera avec ce changement ; GFS la rejouera avec la référence qui le porte.

**4. L'`INDEX.md`** passe la 024 à « faite » et la 025 à « en cours », comme ta page. La 028 reste « à faire » tant que ta page
ne la dit pas lue.

## Pourquoi

Ta page dit la 024 faite et la 025 en cours ; GFS avance la référence au fur et à mesure (le porteur, 20/10) et mesure ce qui
touche son cadre : la onzième clé, comme la 027 l'annonçait. Le point 3 vient du choix du porteur du 21/10 (« à faire par
GFS », puis « Oui, le nom seul ») : sans lui, un nom donné dans GFS serait défait par le prochain enregistrement de ton app.

## Fait quand

`GFS-ETAT.md` donne « 029 · faite · `<commit>` » ; la partie 7 de `run-ranger.mjs` passe avec ce commit.
