# Étude : faire jouer par GFS les vidéos YouTube et Vimeo de Slides+ (06/11/2026)

Étude, **rien n'est codé** : Antoine a choisi « Oui, étude d'abord » le 06/11. Elle répond à la demande de Publipostage+ (« Suite, demande du 06/11 » de sa page `GFS-ETAT.md`, code de l'app à `67e3669`), lue à `47fbd21`. Les mesures sont dans un vrai Grist 1.7.19 (`prototype/labo/run-lecteur-mesures.mjs`, Chromium, fr clair et en sombre, tout vert ; faits vérifiés 50) ; un vrai YouTube ou Vimeo n'est pas joignable depuis le conteneur d'essai, un faux lecteur local d'une autre origine en tient lieu.

## En bref

- **L'app a raison : le lecteur doit être posé par GFS.** Un cadre posé dans l'app hérite de son bac à sable : origine « null », stockage refusé, et YouTube n'y démarre pas. Mesuré dans un vrai Grist : le même cadre posé par GFS a sa vraie origine et son stockage ; isolé comme celui d'une app, il a l'origine « null » et `SecurityError`.
- **Deux façons de le poser, une seule à conseiller** : une **page relais** de GFS (un petit fichier du site de GFS, avec sa propre politique de sécurité, qui seule nomme YouTube et Vimeo) laisse la politique de la page de GFS **inchangée** (`frame-src 'self' blob:`) ; l'autre, ajouter les deux sites à la politique de GFS, élargit celle de tout GFS. Les deux marchent (mesuré avec le faux lecteur) ; le cadre posé directement sans l'élargir est refusé par la politique.
- **Ce que Grist ne laisse pas passer, et que personne ne peut ajouter** : Grist donne à GFS un cadre avec `allow="clipboard-write"` seulement. **La lecture automatique avec son, les médias protégés et le plein écran ne sont pas délégués** au lecteur (mesuré : `autoplay`, `encrypted-media`, `fullscreen` refusés ; l'image dans l'image, oui). Le clic de la personne dans l'app arrive bien à la page de GFS mais **pas au cadre du lecteur**. Conséquence probable : la vidéo se pose au clic sur le ▶ et la personne appuie encore une fois sur le ▶ du lecteur (ou la lecture démarre sans le son) ; pas de plein écran. Non mesuré avec un vrai YouTube.
- **Une décision de politique revient à Antoine** : GFS contacterait Google et Vimeo (sur un clic, jamais avant) et ajouterait leurs adresses à une politique de sécurité qu'il veut stricte. D'où la carte posée avec cette étude.

## 1. Ce que Slides+ demande

Quatre appels de l'app à GFS, sans `id` (GFS ne répond rien, comme `barre.masquer`, consigne 025) :
`lecteur.afficher { id, fournisseur, video, debut, rect, zone }`, `lecteur.deplacer { id, rect, zone }`, `lecteur.masquer { id, masque }`, `lecteur.fermer { id }` ; une clé `lecteurs` au contexte puis un événement du même nom (la liste des fournisseurs que GFS sait jouer, `['youtube', 'vimeo']`) ; un événement facultatif `lecteur { id, etat }` (`lecture`, `pause`, `fin`, `erreur`). `rect` est le rectangle de l'objet dans le cadre de l'app (zoom compris), `zone` la partie où il peut se voir (le défilement de l'éditeur) : GFS rogne le lecteur à la zone. Un seul lecteur à la fois. L'app n'envoie rien tant que GFS n'annonce pas `lecteurs` : **sans l'annonce, la vignette ouvre la vidéo dans un onglet** (c'est le repli, il reste).

Lu dans le code de GFS : sans `id`, un appel dont le nom est inconnu est jeté (`prototype/js/broker/envelope.js:69` lève `GFS_INCONNU`, sans réponse faute d'`id`) : un GFS qui ne sait pas encore faire ce geste n'est pas dérangé par `lecteur.*`.

## 2. Pourquoi GFS et pas l'app

Le sous-cadre d'une app porte `sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"`, sans `allow-same-origin` (`prototype/js/broker/frames.js:8`), et ce bac à sable s'impose à tout cadre que l'app contient. La page de GFS, elle, n'est pas dans un bac à sable (Grist lui donne un cadre sans attribut `sandbox`, mesuré) : un cadre qu'elle pose a sa vraie origine.

## 3. Les deux façons de poser le cadre

**A. Une page relais de GFS (conseillée).** Un fichier du site de GFS (à créer : `prototype/lecteur/index.html` ; l'essai en a une version, `labo/sondes/l-lecteur/relais.html`), de la même origine que GFS, avec sa propre politique : `default-src 'none'; script-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com`. GFS pose ce cadre-là (autorisé par son `frame-src 'self'`) ; la page relais pose le cadre du fournisseur, avec une adresse que **GFS** monte d'après `fournisseur` et `video` (jamais une adresse venue de l'app), et redit à GFS ce que le lecteur dit. La politique de la page de GFS ne change pas, et c'est le modèle de la page d'envoi (`prototype/transfer/index.html`, qui porte déjà sa propre politique). Mesuré : le lecteur répond depuis la page relais sous la politique de GFS inchangée ; la même adresse posée directement dans la page de GFS est refusée (« Refused to frame … `frame-src 'self' blob:` »).

**B. Élargir la politique de GFS** : `frame-src 'self' blob: https://www.youtube-nocookie.com https://player.vimeo.com` dans `prototype/index.html`. Plus simple (pas de page de plus), mais toute la page de GFS, pas seulement un lecteur, pourrait alors poser un cadre vers ces deux sites ; la règle du dépôt est que toute adresse ajoutée l'est « consciemment, avec ce qu'elle sert à faire ».

**C. Ne rien faire** : la vignette ouvre la vidéo sur son site, dans un onglet. C'est ce qui se passe aujourd'hui.

## 4. Mesuré dans un vrai Grist 1.7.19 (Chromium)

`run-lecteur-mesures.mjs` (français clair, anglais sombre ; `LAB_RELAIS=1` pour la page relais), un faux lecteur d'une autre origine (`localhost` au lieu de `127.0.0.1`), la politique de GFS élargie à son adresse pour la seule mesure directe :

- **Le cadre que Grist donne à GFS** : `allow="clipboard-write"`, pas de `sandbox`.
- **Un cadre posé par GFS** : origine à lui, stockage qui répond. **Le même, isolé comme celui d'une app** : origine « null », stockage `SecurityError`.
- **Autorisations d'un lecteur** : `autoplay` refusée, `encrypted-media` refusée, `fullscreen` refusée, `picture-in-picture` accordée. Elles ne dépendent pas de la façon de poser le cadre (directe ou par la page relais : mêmes valeurs) mais de ce que Grist délègue à GFS.
- **Activation de la personne** (réponse au point 5 de la demande de l'app) : un vrai clic dans le cadre isolé de l'app donne l'activation à l'app **et à la page de GFS** (l'ancêtre), **pas au cadre du lecteur** (autre origine) : 0 relevé « active » sur le lecteur contre 30 sur 30 pour les deux autres, sur 1,2 s après le clic. Le démarrage automatique ne profite donc pas du clic dans l'app.
- **Le routeur de GFS jette les messages du cadre du lecteur** (`prototype/js/broker/router.js`, contrats 1.2 : seule la source « Grist » ou « l'app active » passe). L'événement `lecteur { id, etat }` demanderait une troisième classe de source, le cadre du lecteur que GFS a posé lui-même, jamais traitée comme un ordre : ce que dit YouTube ou Vimeo (leur API par messages) est une information, pas une commande.
- **Pas mesuré** : un vrai YouTube ou Vimeo (réseau refusé), Firefox, Safari, un téléphone ; ce que fait réellement YouTube quand `autoplay=1` arrive sans délégation (le lecteur démarre-t-il muet ? attend-il un clic ?).

## 5. Ce que GFS ferait (si le go est donné)

- **Contrat** : un point de la section 5 (appels `lecteur.afficher`, `deplacer`, `masquer`, `fermer`, sans `id`, comme `barre.masquer` ; la clé `lecteurs` au contexte, un événement `lecteurs` ; l'événement `lecteur`). Les formes sont celles de l'app : `id` en `^[a-z][a-z0-9_-]{0,63}$`, `fournisseur` dans la liste annoncée, `video` en 11 signes `[A-Za-z0-9_-]` (YouTube) ou en chiffres avec un suffixe `/<clé>` facultatif (Vimeo), `debut` entier d'au moins 0, `rect` et `zone` de nombres finis. Une demande hors règle est ignorée avec un avertissement en console (comme `barre.masquer`). Un seul lecteur à la fois : un nouvel `afficher` remplace le précédent ; à la fermeture ou au remplacement de l'app (`fermer`, contrats 5.4), GFS retire tout lecteur.
- **Adresses montées par GFS** : `https://www.youtube-nocookie.com/embed/<video>?start=<debut>&rel=0` (et `autoplay=1`, que la mesure dit sans effet garanti) et `https://player.vimeo.com/video/<video>` (le suffixe `/<clé>` devient `?h=<clé>`).
- **Placement** : le cadre du lecteur se pose par-dessus celui de l'app, à `rect`, rogné à `zone` et au cadre ; il passe sous les menus et fenêtres de GFS (`Layers`, jetons `--z-*`) et s'efface sous `masquer`. Le clavier : un cadre d'une autre origine prend le focus au clic ; Échap et la barre de GFS doivent rester joignables (à mesurer à la vraie souris et au vrai clavier, 700 × 400, clair et sombre).
- **Déclaration par l'app** : comme les autres capacités, le lecteur se déclare au manifeste de l'app (`lecteurs: ["youtube", "vimeo"]`) avec sa phrase `pourquoi` FR/EN, que la personne lit dans la fenêtre d'installation (contrats 3.4 : ce serait un point de plus, à côté de `identite`) : « Faire jouer des vidéos YouTube et Vimeo, qui contactent ces sites au clic sur le bouton de lecture. » Sans cette déclaration, `lecteurs` est vide, GFS n'annonce rien et la vignette ouvre un onglet. Hors GFS, l'objet vidéo de Slides+ reste grisé, jamais caché.
- **Respect de la vie privée** : rien ne se charge avant le clic sur le ▶ ; adresses `youtube-nocookie.com` (le mode « sans cookie » de YouTube : pas lu ici, à vérifier ; le site voit en tout cas l'adresse IP de la personne dès que le cadre s'ouvre) ; un client dont le RSSI refuse ces sites les bloque à son pare-feu, et l'app retombe sur l'onglet.

## 6. Lots possibles, dans l'ordre

1. Contrat, manifeste (déclaration), page relais, `afficher` et `fermer`, annonce `lecteurs` (mesuré avec le faux lecteur dans un vrai Grist, Chromium et Firefox).
2. `deplacer` (défilement, zoom) et `masquer`, avec le rognage à `zone`.
3. L'événement `lecteur` (la troisième classe de source du routeur).
4. Une mesure d'Antoine sous Firefox avec un vrai YouTube et un vrai Vimeo (démarrage, son, clavier), qui dira si le double clic est acceptable.

Hors de cette étude, à décider à part si Slides+ le veut : la fenêtre à part du diaporama (`present.html`) est un onglet à l'origine « null » ; lui donner un lecteur demanderait `allow-popups-to-escape-sandbox` au sous-cadre (écarté à la consigne 036).

## 7. Ce qui attend le porteur

Une carte, posée avec cette étude : où poser le lecteur (page relais, politique élargie, ou rien). Rien n'est codé avant sa réponse ; Publipostage+ est au courant que l'étude est faite par la prochaine consigne qu'il recevra.

## 8. Suite : décidé le 07/11, « Politique élargie »

Le porteur a choisi la **politique élargie** (et non la page relais, que l'étude conseillait) : la politique de sécurité de GFS nomme `www.youtube-nocookie.com` et `player.vimeo.com` dans `frame-src`, le cadre du lecteur est posé directement dans la page de GFS. Construit le 07/11 (lots 1 et 2 de la section 6 : `afficher`, `fermer`, `deplacer`, `masquer`, le rognage, l'annonce `lecteurs`, la déclaration au manifeste), mesuré avec la vraie Publipostage+ dans un vrai Grist (faits vérifiés 56, contrats 3.4 point 7 et 5.2 point 11). **Reste** : le lot 3 (événement `lecteur`, qui demande au routeur une troisième classe de source : le cadre du fournisseur), et le lot 4 (la mesure du porteur sous Firefox avec un vrai YouTube et un vrai Vimeo : démarrage sans second clic ? plein écran ? son ?). Ce que l'étude disait de la page relais reste vrai si la politique doit un jour être resserrée à nouveau.

