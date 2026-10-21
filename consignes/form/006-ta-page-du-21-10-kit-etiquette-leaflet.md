# 006 · Ta page du 21/10 : le kit relu et mesuré, l'étiquette, Leaflet

App : Form+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`80c1636`, qui décrit `952fe4c`) · quand : au prochain lot, sans
urgence ; un petit changement de code (deux ombres) ; visible aussi dans l'app seule

## Quoi

**1. Le kit appliqué : relu, rejoué et mesuré dans un vrai Grist. La 005 est faite.**

1. **Relu dans ton dépôt** (à `952fe4c`) : `kit/` est un sous-module au commit `54c48f3`, ajouté dans un commit à part
   (`90958ac`) ; la CI charge les sous-modules (`submodules: true`) ; `widget.html` charge `tokens.css` et `windows.css` du kit ;
   plus un `prompt`, `confirm` ni `alert` hors des essais ; le texte d'interface passe par `I18n` du kit (`poc/js/strings.js`) ;
   ton runner fait échouer un `console.warn` aussi (double chargement du kit, clé inconnue ou manquante).
2. **Rejoué par GFS** : ta suite de 542 essais (`.github/scripts/run-widget-tests.js`), à `80c1636` avec le kit à `54c48f3`,
   passe en `fr-FR` et en `en-US` : 542 sur 542 chacune.
3. **Mesuré dans un vrai Grist** (grist-static 0.1.6 dans Chromium ; ton widget, `poc/widget.html`, posé tel quel comme widget
   personnalisé, `gfs=1` dans l'adresse comme dans GFS ; 700 × 400, à la vraie souris et au vrai clavier ; en français / clair,
   français / sombre, anglais / clair et anglais / sombre) : 25 vérifications par combinaison, aucun échec. La langue et le thème
   sont ceux de l'adresse ; rien ne dépasse du panneau ni ne défile en largeur ; le contraste du texte atteint 4,5:1 sur les
   quatre écrans (démarrage, partir de zéro, lien du formulaire, formulaire existant) ; le bouton principal prend la couleur de
   `--accent-solid` ; la confirmation « Réinitialiser les questions » est une fenêtre du kit, entière dans le panneau, avec le
   focus sur « Annuler », Tab qui y tourne, Échap qui annule, un clic dehors qui ne la ferme pas ; la saisie prend le focus et
   Entrée la valide ; aucun avertissement ni erreur dans la console. Les captures sont à la disposition du porteur.
4. **Pas ouvert par GFS** : l'écran du concepteur avec des questions (`#config`, `#editor`), qui veut un formulaire natif publié
   dans le document ; tes essais le couvrent.
5. **Un reste de couleur en dur** : deux `box-shadow` à `rgba(…)` dans `poc/css/widget.css`, le pouce de l'interrupteur
   (`.toggle-thumb`, ligne 80) et la carte d'aperçu (`.pv-q`, ligne 229). Le kit a `--shadow-card` et `--shadow-float` pour cela,
   qui suivent le thème clair et sombre. Au prochain lot, quand tu es dans la feuille ; ce sont les seules couleurs en dur de ta
   feuille hors `#qrCanvas`, que la 005 admet.

**2. L'étiquette `v0.1.0` : ta question est juste.** Le dépôt du kit n'a pas d'étiquette (`git ls-remote --tags` : liste
vide, vérifié par GFS le 21/10), et la 005 écrivait `git -C kit checkout v0.1.0` comme si elle existait : c'était une erreur de
GFS. **La référence est le commit `54c48f3`**, le sommet de `main` du kit, auquel ton sous-module pointe déjà : il n'a pas à
bouger. Le cloud où GFS travaille ne peut pas pousser d'étiquette : c'est le porteur qui la posera sur `54c48f3`, de sa machine.
Que l'étiquette existe ou non, ton sous-module reste au même commit.

**3. Leaflet : décidé par le porteur le 21/10.** Une dépendance externe va dans GFS, comme pour Publipostage+ et ses fonctions.
Elle sera portée avec Form+, au moment où Form+ entre dans GFS (manifeste, référence) : GFS élargira alors son catalogue (une
bibliothèque a ici un script, une feuille de style et des images) et ta CSP nommera les tuiles OpenStreetMap ; une consigne te
dira quoi écrire. Rien n'est codé avant et **rien à changer chez toi** : hors GFS, ton chargement autonome
(`window.FORMPLUS_ENABLE_MAP`, unpkg) reste le mécanisme, comme le disait la 003.

**4. Pas encore décrits par ta page** : `a5d2207` (création automatique d'une colonne, `AddColumn`, `poc/js/grist-meta.js`) et
`adba2b4` (le comparatif). GFS les lira quand ta page les décrit. Pour la colonne créée : la règle 4 du guide s'y applique
déjà (changements additifs, jamais d'écriture dans une colonne absente).

## Pourquoi

Ta page dit la 005 faite et pose une question et une demande : GFS a relu et mesuré ce qu'elle annonce (l'étape 3 se termine
quand Form+ tourne avec le kit), corrigé l'erreur de la 005 sur l'étiquette, et dit où en est Leaflet.

## Fait quand

`GFS-ETAT.md` donne « 006 · faite · lue » (avec tes constats, si tu en as), retire la question de l'étiquette de « Questions pour
GFS » et garde la demande Leaflet « en attente de l'entrée de Form+ dans GFS ». Les deux ombres suivent au prochain lot, avec
son commit.
