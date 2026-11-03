# 041 · Suivre l'ambiance de GFS : tu la lis dans ton lien, le kit la pose, ta charte UI/UX la dit (décision du porteur)

App : Publipostage+ · posée le 03/11/2026 · décision du porteur du 02/11 et du 03/11 · quand : au prochain lot, sans urgence ; du code dans ton app (`js/gfs-link.js`, ton module d'entrée, tes feuilles, `kit/`) et une
section de ta charte UI/UX ; sans effet dans l'app seule ; les 039 et 040 touchent aussi `js/gfs-link.js`

## Quoi

**1. La décision.** Le porteur (02/11, puis 03/11) : GFS propose autre chose que son bleu et gris, avec des options plus marquées qu'une teinte.
**Cinq ambiances**, chacune avec sa propre direction artistique (couleurs, arrondis, traits, ombres, polices, fond, filet) :
Grist Factory (l'aspect d'origine), Pop (lavande, cartes très arrondies, bouton en dégradé), Papier (crème et encre, titres à empattements, coins presque droits),
Brut (jaune et noir, traits épais, ombres dures, capitales) et Néon (trame de points, traits qui brillent, titres à chasse fixe) ; et, au choix, **la couleur de la
personne**, prise avec le même sélecteur que dans les documents (celui du kit 0.5.0). Un seul choix, fait dans la fenêtre « Thème » de GFS, pour GFS et pour
toutes ses apps ; ton app le suit sans que son cadre soit rechargé. Construit et mesuré le 03/11 dans un vrai Grist (contrats de GFS 5.2, point 10 ; guide des apps, règle 15).

**2. Ce que le kit fait déjà (0.6.0, `8afa569`), et ce qu'il ne fait pas pour toi.** Le kit sait lire l'ambiance de GFS (`kit/js/ambiance-message.js`) et la poser sur la page
(`kit/js/ambiance-pose.js`) ; README du kit, « L'ambiance de GFS ». Sa version toute prête, `Ambiance.start()` (`kit/js/ambiance.js`), démarre le lien du kit avec GFS : elle n'est pas pour toi,
qui as le tien (`js/gfs-link.js`, avec son `reglages` de la 039). Deux liens dans un même cadre numérotent chacun leurs appels depuis 1 et se prendraient les réponses (lu dans
`kit/js/gfs-link.js`, non mesuré). Tu prends donc la pose sans le lien, `createAmbiance`, et tu lui donnes le tien : le kit te donne la lecture et la pose, pas le lien.

**3. Ce que tu fais.**

- **Le kit en sous-module**, `kit/` à `8afa569`, en commit à part, relu (guide des apps 1.2, point 1 ; tu remplaceras tes copies une à une plus tard, pas dans ce lot). Il se sert
  depuis ton site comme ton code (même origine, `script-src 'self'` suffit) ; ta carte d'importation versionnée nomme les fichiers que tu importes. **Tu n'importes que
  `kit/js/ambiance-message.js` et `kit/js/ambiance-pose.js`** (le second importe `once.js`, rien d'autre), jamais `kit/js/ambiance.js`, qui démarre le lien du kit.
- **Ton `js/gfs-link.js` lit l'ambiance comme il lit la langue** : `contexte.ambiance` à l'arrivée du contexte, puis l'événement `ambiance`
  (`{ gfs: 0, type: 'evenement', nom: 'ambiance', data: { ambiance } }`, une fois par geste de la personne), chaque fois par `normalizeAmbiance` (le message lu avec méfiance, ou
  `null`). Il garde la valeur, rappelle ses abonnés seulement quand elle change vraiment (une copie à chacun) et donne `ambiance()`, `onAmbiance(fn)` (qui rend de quoi se désabonner)
  et ta promesse d'arrivée du contexte. Seul, il dit `null` et n'écoute rien de plus.
- **Dans ton module d'entrée, avant d'afficher** : `createAmbiance({ link: <ton lien>, isDark: () => <ton app affiche le sombre> }).start()`, une fois. `isDark` dit ton mode (le choix
  de la personne dans ton app, puis celui de Grist, puis le système) ; si tu le changes autrement que par `data-theme` sur `<html>`, appelle `repaint()` à chaque changement. `await ambiance.ready`
  est facultatif : l'ambiance connue au contexte est posée avant qu'il se règle.
- **Tes feuilles lisent les jetons** (guide des apps, règle 15, qui dit lesquels et lesquels ne pas lire) : les couleurs par les jetons de la charte, jamais en dur ; les
  jetons de forme qui ont un équivalent chez toi (arrondis, trait, ombres, police et casse des titres, filet, bouton plein), chacun avec sa valeur d'origine en repli
  (`var(--radius-md, 10px)`) ; le fond de la page est `--bg`, sur un élément qui couvre la page (`min-height: 100vh`), jamais `--main-bg` (celui de la carte de GFS :
  `transparent` chez Néon, un titre clair y tombait à 1,10:1, mesuré) ; le décor `--wash` s'y pose en `background-image`, avec `--wash-size`.
- **Ta charte vivante (`planning/identite-ui-ux-grist-factory.md`) gagne une section « Ambiances de GFS »** : les cinq noms et leur direction en une ligne ; les dix-neuf jetons de couleur et ce que
  chacun colore ; les jetons de forme à lire et ceux à ne pas lire ; les paires dont GFS tient 4,5:1 ; les deux pièges (le fond, le décor) ; et « affiché, pas produit ». Elle renvoie à la règle 15 du
  guide des apps pour la source, que GFS tient à jour avec son moteur, sans la recopier en entier : les autres apps lisent ta charte.
- À ton rythme, sans lien avec ce lot : tes copies du sélecteur de couleur (le menu et la fenêtre « Couleur personnalisée ») passent au kit 0.5.0, tiré des tiennes (guide, règle 15 : « n'en garde pas de copie »).

**4. Ce que tu laisses.** Tout ce que Publipostage+ produit (modèles, e-mails, PDF, exports, présentations, formulaires) garde l'aspect du modèle ou du document : l'ambiance ne vaut que pour ce que
tu montres à la personne, tes barres, menus, panneaux, fenêtres et réglages. La page que la personne écrit dans ton éditeur est ce qu'elle produit : elle garde l'aspect du document (c'est la lecture de GFS de
« jamais ce qu'elle produit » ; si tu lis autrement, dis-le dans ton `GFS-ETAT.md`). Les couleurs qui disent quelque chose (l'état : rouge, vert, orange ; le type) restent les tiennes : GFS ne les change pas d'une ambiance à l'autre, et ne tient pas leur contraste sur les fonds d'une ambiance (il ne tient que les paires de la règle 15) : c'est le tien.

## Pourquoi

Le porteur veut que choisir une ambiance change tout ce que la personne voit, pas seulement GFS : une app qui garde ses couleurs au milieu d'un GFS en Néon fait tache. Une seule
pose, écrite dans le kit : aucune app ne la réécrit, et GFS tient le contraste de 4,5:1 pour les paires de la charte, que tu n'as donc pas à recalculer. Publipostage+ tient la charte UI/UX vivante de la suite : c'est chez toi que les autres apps lisent comment suivre une ambiance, d'où la section de ta charte.

## Fait quand

`GFS-ETAT.md` donne « 041 · faite · `<commit>` ». Un essai de ton côté échoue sur l'ancien code : avec le message d'exemple du kit (`kit/test/ambiance-exemple.json`,
un vrai message de GFS), les couleurs calculées de ta page (le fond, une carte, un bouton plein) sont celles du message, et avec `null` elles redeviennent les tiennes ; et un
essai lit tes feuilles et refuse une couleur écrite en dur hors d'une liste d'exceptions (l'état, le type, ce que tu produis) que tu écris et justifies. La section « Ambiances de GFS » est dans ta charte. GFS rejoue ensuite
`labo/run-ambiance-kit.mjs` avec ton app à la place de la sonde N : les quatre ambiances en clair et en sombre à 700 × 400, le contraste de chaque texte de tes écrans
principaux, la couleur libre, le retour à l'origine.
