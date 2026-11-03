# 006 · Suivre l'ambiance de GFS : au lot où tu prends le kit, `Ambiance.start()` (décision du porteur)

App : Automation+ · posée le 03/11/2026 · décision du porteur du 02/11 et du 03/11 · quand : au lot où tu prends le kit (003 ; guide des apps 1.2, points 1 et 4) ; rien à changer d'ici là ; sans effet dans l'app seule

## Quoi

**1. La décision.** Le porteur (02/11, puis 03/11) : GFS propose autre chose que son bleu et gris, avec des options plus marquées qu'une teinte.
**Cinq ambiances**, chacune avec sa propre direction artistique (couleurs, arrondis, traits, ombres, polices, fond, filet) :
Grist Factory (l'aspect d'origine), Pop (lavande, cartes très arrondies, bouton en dégradé), Papier (crème et encre, titres à empattements, coins presque droits),
Brut (jaune et noir, traits épais, ombres dures, capitales) et Néon (trame de points, traits qui brillent, titres à chasse fixe) ; et, au choix, **la couleur de la
personne**, prise avec le même sélecteur que dans les documents (celui du kit 0.5.0). Un seul choix, fait dans la fenêtre « Thème » de GFS, pour GFS et pour
toutes ses apps ; ton app le suit sans que son cadre soit rechargé. Construit et mesuré le 03/11 dans un vrai Grist (contrats de GFS 5.2, point 10 ; guide des apps, règle 15).

**2. Pourquoi tu attends le kit.** L'ambiance arrive par le lien avec GFS (`contexte.ambiance`, puis l'événement `ambiance`), que tu n'as pas encore : c'est le lien du kit (`GfsLink`), que tu prends au
lot de ta consigne 003. Rien ne change dans ton app d'ici là, et seule elle garde ses couleurs.

**3. Ce que le kit fait déjà (0.6.0, `8afa569`).** `Ambiance.start()` (`kit/js/ambiance.js`) lit l'ambiance que GFS donne (`GfsLink.ambiance()`), la vérifie
(les jetons qu'il connaît, des `#rrggbb`, rien qui sorte de sa déclaration) et la pose sur `<html>` par le CSSOM : les dix-neuf jetons de couleur du mode que ton app
affiche et les jetons de forme. Il suit GFS (un événement par geste de la personne) et ton mode, clair ou sombre, sans que GFS dise rien (le mode est celui de `Theme`
du kit : le choix de la personne dans l'app, puis celui de Grist, puis le système) ; quand GFS dit `null` (rien n'est choisi), il retire ce qu'il avait posé, et rien
d'autre ; dans ton app seule, il ne fait rien. Ta politique de sécurité du contenu ne change pas : le CSSOM passe sous `style-src 'self'` (mesuré). Une app qui tient son
mode elle-même (sa propre clé, son interrupteur) appelle à la place `createAmbiance({ link: GfsLink, isDark })` de `kit/js/ambiance-pose.js`, avec son `isDark()`, et
`repaint()` quand le mode change autrement que par `data-theme` sur `<html>`. README du kit, « L'ambiance de GFS ».

**4. Ce que tu fais, à ce lot-là.**

- **Prends le kit à `8afa569` ou plus récent** (le sous-module `kit/`, son lien avec GFS : guide des apps 1.2, points 1 et 4), pas à un commit d'avant 0.6.0.
- **`Ambiance.start()`**, une fois, dans `js/main.js`, avant d'afficher. Ton mode est celui de `Theme` du kit, que tu prends à ce lot (guide 1.2, point 1) ;
  si tu gardes le tien (ta clé `ab_theme`), prends à la place `createAmbiance({ link: GfsLink, isDark }).start()` de `kit/js/ambiance-pose.js` avec ton `isDark()`.
- **Tes feuilles lisent les jetons** (guide des apps, règle 15, qui dit lesquels et lesquels ne pas lire) : les couleurs par les jetons de la charte, jamais en dur ; les
  jetons de forme qui ont un équivalent chez toi (arrondis, trait, ombres, police et casse des titres, filet, bouton plein), chacun avec sa valeur d'origine en repli
  (`var(--radius-md, 10px)`) ; le fond de la page est `--bg`, sur un élément qui couvre la page (`min-height: 100vh`), jamais `--main-bg` (celui de la carte de GFS :
  `transparent` chez Néon, un titre clair y tombait à 1,10:1, mesuré) ; le décor `--wash` s'y pose en `background-image`, avec `--wash-size`.

**5. Ce que tu laisses.** Ce qui entoure ton graphe et le porte (barres, panneaux, fenêtres, réglages, journal) suit l'ambiance. Les couleurs que tes nœuds portent pour dire un type (un déclencheur,
une action) ou un état (un succès, un échec) sont de celles qui disent quelque chose : elles restent les tiennes, GFS ne les change pas d'une ambiance à l'autre et ne tient pas leur contraste sur les fonds d'une ambiance (il ne tient que les paires de la règle 15) : c'est le tien.

## Pourquoi

Le porteur veut que choisir une ambiance change tout ce que la personne voit, pas seulement GFS : une app qui garde ses couleurs au milieu d'un GFS en Néon fait tache. Une seule
pose, écrite dans le kit : aucune app ne la réécrit, et GFS tient le contraste de 4,5:1 pour les paires de la charte, que tu n'as donc pas à recalculer.

## Fait quand

`GFS-ETAT.md` donne « 006 · faite · `<commit>` ». Un essai de ton côté échoue sur l'ancien code : avec le message d'exemple du kit (`kit/test/ambiance-exemple.json`,
un vrai message de GFS), les couleurs calculées de ta page (le fond, une carte, un bouton plein) sont celles du message, et avec `null` elles redeviennent les tiennes ; et un
essai lit tes feuilles et refuse une couleur écrite en dur hors d'une liste d'exceptions (l'état, le type, ce que tu produis) que tu écris et justifies. GFS rejoue ensuite
`labo/run-ambiance-kit.mjs` avec ton app à la place de la sonde N : les quatre ambiances en clair et en sombre à 700 × 400, le contraste de chaque texte de tes écrans
principaux, la couleur libre, le retour à l'origine.
