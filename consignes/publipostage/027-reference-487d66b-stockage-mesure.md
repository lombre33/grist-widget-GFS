# 027 · Ta page du 21/10 (soir) : la référence à `487d66b`, tes choix gardés par GFS mesurés avec ton app, le bouton « Table de travail »

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`89890c8`, qui décrit `487d66b`) · quand : au prochain
lot, sans urgence, avec la 026 ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. La référence avance de `15aa696` à `487d66b`** (`becf3b8`, un commit à part, relu), le dernier commit de code que ta page
décrit. Relu (30 fichiers, deux ajoutés, aucun retiré) : la CSP d'`index.html`, la carte d'importation et la liste de
bibliothèques ne changent pas ; `index.html` charge `js/gfs-link.js` puis `js/person-store.js` avant tout autre script ;
`js/gfs-link.js` lit `contexte.stockage` et envoie `stockage.ecrire` sans `id`, avec la règle des clés de GFS ; les autres
modules passent de `localStorage` à `PersonStore`, sans appel à Grist, message, adresse ni stockage de plus ; `extensions/` ne
change pas (mêmes poids). Rien à déclarer dans le manifeste (contrats 5.3, point 6).

**2. Tes choix gardés par GFS, mesurés avec ton app** (vrai Grist : grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie
souris et au vrai clavier, en français / clair et en anglais / sombre ; `prototype/labo/run-stockage-publipostage.mjs`,
12 vérifications sur 12 dans les deux combinaisons), avec le geste de ta page et un second :

- au départ, ton app a l'espace de GFS (`PersonStore.shared()`), son cadre refuse son propre stockage, GFS n'a rien gardé pour
  elle ;
- le thème choisi dans tes Réglages, à la souris puis au clavier (les flèches du groupe), s'applique à l'instant ; GFS le garde
  sous `gfs.stockage.publipostage.pp_theme` ; aucun lot au document, aucun refus du courtier ;
- Ctrl + plus fait grandir la feuille d'un cran (de 85 à 90 %) et GFS garde `pp_page_zoom` ;
- GFS rechargé, le même modèle rouvert depuis l'explorateur : ton app revient dans le thème choisi, ses Réglages le cochent, et
  au même zoom ;
- Ctrl + 0 retire la clé du zoom (`valeur: null`) : GFS ne garde plus que le thème.

Vu en passant, rien à faire : un clic dans le texte envoie la sonde d'identité de ton app (`Publipostage_UserProbe`, une ligne
ajoutée puis retirée), comme avant la 024 ; c'est le seul lot de la passe.

**Non mesuré** : les huit autres clés (`pp_trigger_char`, `pp_expansion_char`, `pp_shortcuts`, `pp_shortcuts_view`,
`pp_mail_client`, `pp_autosave_enabled`, `pp_sheet_assembly`, `pp_pdf_protection`), le bouton Enregistrer bleu un instant (la
limite que ta page dit), un second onglet, Firefox, Safari.

**3. La 024 passe à « faite pour dix des onze clés »** dans l'`INDEX.md` ; la onzième (`pp_news_seen`) et la fenêtre des
nouveautés une fois par personne viendront dans ton lot à part, que GFS mesurera de même.

**4. Le bouton de la barre s'appelle « Table de travail »** (« Working table ») depuis `465a936` : la 026 l'appelle encore
« Table et ligne de travail ». Un clic sur une table la choisit, avec sa première ligne ; choisir la ligne devient facultatif.
La barre ne change pas : quatre boutons, 34 × 124 px au bord gauche ou droit ; lis `contexte.barre.zone`.

**5. La 025** : ta page dit qu'elle est lue et que tu la fais en deux lots, avec le choix du porteur « Laisser un vide » en
haut ; l'`INDEX.md` la marque « lue, pas faite ». Quand tu la diras faite, GFS rejouera la barre avec ton app aux quatre bords.

## Pourquoi

Ta page dit la 024 faite et demande de rejouer la vérification de GFS avec ton app à `487d66b` : c'est fait, avec ton geste (le
thème) et un second (le zoom), pour l'écriture, la relecture après un rechargement et le retrait d'une clé.

## Fait quand

`GFS-ETAT.md` donne « 027 · faite · lue, aucun code ».
