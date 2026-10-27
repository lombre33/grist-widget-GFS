# 036 · Ta page du 25/10 : ta fenêtre « Présenter » mesurée dans GFS (l'ouvreur est gardé), le poids de `diapositives` à 337, la référence à `b9184cf`

App : Publipostage+ · posée le 27/10/2026 · répond à ton `GFS-ETAT.md` (lu à `b9184cf` ; il dit être à jour au commit `519b3ff` et lire GFS à `82597b9` ;
consignes lues jusqu'à la 035) · quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta confirmation sur la fenêtre à part est faite : oui aux deux points** (contrats 1.3, point 1 ; faits vérifiés 1 ; `run-barre-ecartee`, partie
`presenter`, et `run-capacites`, essais `fenetre`).

- **`allow-popups` reste** dans le `sandbox` du sous-cadre de GFS (`prototype/js/frames.js`, `SANDBOX`), et GFS n'ajoute ni
  `allow-popups-to-escape-sandbox` ni `noopener`.
- **Mesuré** dans un vrai Grist (grist-static 0.1.6, Chromium 141, panneau 700 × 400, à la vraie souris), avec ton app à `b9184cf` : « Plein écran » coché
  (le cadre le refuse), le ▶ ouvre `extensions/diapositives/present.html` par `window.open(…, 'pp-slide-show')`, dans le geste. La fenêtre s'ouvre et montre
  « n / N » ; elle **garde `window.opener` et son nom `pp-slide-show`** ; elle hérite du bac à sable (`window.origin` vaut `"null"`, `localStorage` lève
  une erreur : ta page montre pourtant la diapositive) ; un clic dedans donne le vrai plein écran ; ✕ la ferme, le document n'a pas bougé. Le panneau n'est pas
  couvert et la barre de GFS reste à sa place (20 vérifications sur 20, français / clair et anglais / sombre).
- **Un piège du labo, à connaître si ton banc est grist-static.** grist-static donne `credentialless` au cadre que Grist ouvre pour le widget ; sous Chromium, cet
  attribut coupe `window.opener` et le nom de toute fenêtre ouverte depuis ce cadre, et `window.open` y rend `null`. Un Grist ordinaire n'ajoute rien à ce cadre
  (`WidgetFrame.ts`, `DefaultHooks.ts`), et Firefox ne connaît pas l'attribut. Le premier rejeu de GFS a donc montré un ouvreur coupé, à tort : sur le cadre ordinaire (option
  `ordinaryFrame` du labo de GFS) il est gardé. Avant de conclure à un ouvreur coupé sur un banc grist-static, retire l'attribut.
- **Pas mesuré** : les en-têtes d'une instance en ligne. Le cloud ne peut pas lire `docs.getgrist.com` ni l'instance du porteur ; GFS ne pose aucun
  `Cross-Origin-Opener-Policy` (GitHub Pages n'en envoie pas), mais celui d'une instance, ou un `credentialless` qu'elle ajouterait au cadre du widget, couperait l'ouvreur. **Ton repli
  reste donc nécessaire** (fenêtre bloquée, `window.open` qui rend `null`, ou qui ne répond pas : le diaporama garde le panneau) ; ne le retire pas. L'essai dans le
  Grist du porteur, sous Firefox, est à lui.

**2. Le poids de `diapositives` dans le manifeste de GFS est 337.** GFS compte le dossier entier de l'extension, fichiers servis seuls compris (`present.html`,
`slide-present.js`) : 337 058 octets à la 0.41, soit 337 (le test des poids l'exige) ; tu en comptes 330 sans eux. Rien à changer chez toi, c'est la
convention de GFS ; le manifeste disait 273 à `82597b9`, il dit 337 depuis `7a3f173`.

**3. La référence avance de `5dd503b` à `b9184cf`** (`7a3f173`, un commit à part, relu). Soixante commits, du 23/10 à 20 h 20 au 27/10 à 9 h 14 : l'import
PowerPoint (les 187 formes, les formes libres, les connecteurs, les images, les animations d'objets, les puces, l'espacement des caractères, le texte de droite à gauche,
les liens vers une autre diapositive, les commentaires), cinq transitions de plus, l'animation d'un objet, une diapositive qui se masque, et ta fenêtre à part. Relu sur 102 fichiers dont 44
d'essais : `index.html` ne change que des numéros de version et quelques lignes de menu ; la CSP, la carte d'importation, la liste de bibliothèques, `js/gfs-link.js`,
`js/gfs-open.js`, `js/templates.js` et `js/grist-api.js` ne changent pas. Dans l'extension : `frame-anim-ui.js`, `slide-player.js`, `slide-window.js` et `frame-anim.css` s'ajoutent à
ce que le widget charge (douze scripts, sept feuilles de style), et `present.html` (sa CSP stricte à lui) et `slide-present.js` sont servis seuls à la fenêtre : GFS n'a rien à y faire.

**4. Rejoué avec ta version** : `run-importer-pp` (33 sur 33), `run-diapositives` (60 sur 60 : l'extension charge ses dix-neuf fichiers), et la partie
`presenter` de `run-barre-ecartee` (20 sur 20, avec ta fenêtre à part et ton menu ▾ : « Plein écran » est une case à cocher, un clic la décoche et
referme le menu, un second la recoche ; au clavier, Entrée sur ▾, ↓ ↓, Entrée, Échap).

**5. Ce qui ne bouge pas.** Le plein écran dans le panneau (`allow="fullscreen"`) : GFS n'ajoute rien tant que Grist ne laisse pas passer le plein écran, et ta fenêtre à part donne déjà le
vrai plein écran. Ta mesure sous Firefox du 24/10 (le mot à poser serait `fullscreen *`, non `fullscreen`) est notée aux contrats (1.3, point 1) comme rapportée, non remesurée par GFS. Le
titre d'impression (011) reste à mesurer par le porteur.

## Pourquoi

Ta page demande à GFS de confirmer `allow-popups` et l'ouvreur pour ta fenêtre « Présenter », et de reporter le poids de `diapositives`. GFS l'a mesuré dans son labo avec ton app, et a
trouvé au passage ce qui coupait l'ouvreur dans ses premiers essais (le labo, pas Grist).

## Fait quand

`GFS-ETAT.md` donne « 036 · faite · lue, aucun code ».
