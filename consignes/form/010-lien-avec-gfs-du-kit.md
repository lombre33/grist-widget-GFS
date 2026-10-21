# 010 · Le lien avec GFS du kit 0.2.0 : ouvrir le formulaire double-cliqué, la langue, le thème et la page dans GFS

App : Form+ · posée le 21/10/2026 · suite de l'annonce de la 007 (point 4) · quand : au prochain lot, avec la 008 et la 009 (la
porte « ouvrir » donne une ligne de `FormPlus_Formulaires`, que la 008 rend une par formulaire) ; du code dans ton app ; sans
effet dans l'app seule

## Quoi

**1. Le kit 0.2.0.** Le porteur a voulu le dialogue avec GFS écrit une fois, dans le kit, pour toutes les apps (21/10) : c'est
`js/gfs-link.js`, d'après celui de Publipostage+, au commit **`c0c8660`** de `lombre33/grist-factory-kit`. Son README (section
« Le lien avec GFS ») dit tout ce que le lien rend, son CHANGELOG ce qui change : rien dans ce que tu emploies déjà du kit.
Mesuré seul : 56 essais sous Node, dont 18 pour le lien, et 209 vérifications dans Chromium, dont le cadre d'une app isolé comme
chez GFS face à une page qui joue GFS. Avance ton sous-module `kit/` de `54c48f3` à `c0c8660`, dans un commit à part, relu.
L'étiquette `v0.2.0` n'est pas encore posée : la référence est le commit, comme à la 006.

**2. Ce que ton app fait du lien** (contrats de GFS, 5.2 à 5.4) :

1. **Une seule adresse** : `import { GfsLink } from '../../kit/js/gfs-link.js'`, comme tes autres modules du kit. Seule, le
   lien ne parle à personne (`GfsLink.hosted` est faux, `opening()` est null) : ton app seule ne change pas.
2. **Le formulaire à ouvrir au démarrage.** Dans GFS, après `await GfsLink.ready`, `GfsLink.opening()` dit sur quoi ton app
   s'ouvre : `{ fichier, type, dossier, raison }`. Quand `fichier` n'est pas null, `fichier.id` est l'identifiant de la ligne
   de `FormPlus_Formulaires` (en texte) : ton app ouvre ce formulaire, à la place de son écran habituel. Quand `fichier` est
   null (`raison` vaut `nouveau`), ou que `opening()` est null, ton écran de départ habituel. GFS ne donne l'ouverture qu'une
   fois : un cadre rechargé la reçoit nulle (5.2, point 3).
3. **Le double-clic quand ton app est déjà ouverte** : `GfsLink.onOpen(async ({ fichier, type }) => …)`, avec la même règle (le
   formulaire, ou l'écran de départ quand `fichier` est null). Avec des modifications en attente, ta question d'enregistrement
   d'abord. Rends `true` une fois ouvert, `false` si la personne annule (GFS n'ajoute rien) ; une erreur levée, GFS la dit
   avec son texte. Le formulaire déjà ouvert : rends `true` sans rien recharger.
4. **La langue** : `GfsLink.onLanguage(language => …)`. Dans GFS, c'est un seul choix pour GFS et ses apps (5.2, point 6) ; ton
   app démarre déjà dans la langue de son adresse (`I18n.init`), et le lien lui dit ensuite chaque changement, une fois. À toi
   de choisir comment suivre : te retraduire (`I18n.setLanguage`, puis redessiner ce que ton code a écrit avec `I18n.t`, que
   `translateDom` ne reprend pas), ou te recharger après ta question d'enregistrement, en gardant toi-même le formulaire
   ouvert (un cadre rechargé n'a plus d'ouverture).
5. **Le thème choisi** (`formplus_theme`) : dans GFS, ton cadre n'a pas de stockage à lui (guide, règle 6), et `Theme.set`
   n'y vaut que pour la page. Hébergée, ta bascule envoie aussi le choix à GFS, `GfsLink.storageSet('formplus_theme', …)`
   (`Theme.choice`, `null` pour « système ») ; au démarrage, après `ready`, `GfsLink.storageGet('formplus_theme')` rend le
   choix gardé, que tu poses par `Theme.set`. Le manifeste n'a rien à déclarer (5.3, point 6).
6. **La page** : dans GFS, ton référent est l'adresse de GFS (guide, 2.3), et `myPageFromReferrer()` (`poc/js/links.js`,
   ligne 91) rend null. Hébergée, prends `GfsLink.context().page` : au mieux, comme ton référent quand l'app est seule
   (null quand GFS ne la connaît pas ; tes replis restent). Seule, rien ne change (guide, règle 5).

**3. Ce que le lien ne donne pas** : l'identité de la personne (le contexte n'a pas de champ pour elle : `ModifiePar` reste
comme il est) ; « choisir » et « insérer ». La barre de GFS (`GfsLink.bar()`, `onBar`, `hideBar`) est dans le kit, mais la barre
aux quatre bords aura sa consigne après mesure chez toi, comme la 007 l'a dit : rien à faire pour elle dans ce lot.

## Pourquoi

1. Le double-clic sur un formulaire dans les fichiers de GFS ouvre aujourd'hui ton écran de départ, avec la phrase
   « Provisoire : Form+ ne sait pas encore ouvrir un fichier précis ». Le porteur veut voir les apps travailler ensemble au
   même endroit ; ouvrir le bon formulaire en est le premier geste.
2. Un seul code de dialogue avec GFS pour toutes les apps (« ne pas dupliquer de code ») : le kit le porte, tu ne l'écris pas.

## Fait quand

`GFS-ETAT.md` donne « 010 · faite · `xxxxxxx` », avec ton sous-module `kit/` à `c0c8660`, et dit comment ton app suit la langue
(retraduite ou rechargée). GFS avance alors la référence, déclare `"ouvrir": ["formulaire"]` dans ton manifeste (le menu
« Nouveau » de ses fichiers gagne « Formulaire », la phrase provisoire s'en va) et mesure dans un vrai Grist, à 700 × 400, à la
vraie souris : le double-clic lance ton app sur le formulaire cliqué ; ton app déjà ouverte change de formulaire sans recharger
son cadre ; avec des modifications en attente, ta question passe d'abord ; « Nouveau » ouvre ton écran de départ ; la langue de
GFS suit ; le thème choisi revient quand GFS se recharge.
