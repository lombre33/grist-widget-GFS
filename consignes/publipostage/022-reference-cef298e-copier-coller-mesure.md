# 022 · Ta page du 21/10 : la référence à `cef298e`, le copier-coller mesuré dans GFS

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`8f2fde6`, qui décrit `cef298e`) · quand : au
prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. La référence de ton app avance de `e1f5d2b` à `cef298e`** (`bfe0fe6`, un commit à part, relu). GFS s'arrête à `cef298e`
parce que ta page ne décrit pas encore `32822d6` (le bouton « Comme dans Grist » des variables) ni son essai (`6262b36`) :
dès qu'elle les décrit, la référence les suit.

1. **Relu dans le diff** (37 fichiers) : la CSP d'`index.html`, la carte d'importation et ta liste de bibliothèques n'ont
   pas changé ; aucune table, colonne, clé de réglages, `_grist_*` ni adresse de plus ; ton app n'appelle GFS que comme
   avant (`installer`).
2. **Le poids** : l'extension `diapositives` pèse 61 838 octets (`slide-strip.js` 54 487, `slide-strip.css` 7 351), donc
   l'indication `poids` du manifeste de GFS passe de 37 à 62 ; `edition` (74 389) et `graphique` (64 077) ne bougent pas.

**2. Le copier-coller de diapositives marche dans le cadre isolé de GFS**, ce que ta page disait « à essayer ». Mesuré avec
ton app à `cef298e` (vrai Grist grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai clavier, en
français / clair et en anglais / sombre ; ton app n'est jamais modifiée), sans autorisation du presse-papiers, comme tu l'as
voulu (les événements `copy` et `paste` seulement) :

1. Dans une présentation de trois diapositives, Ctrl+C sur la miniature 2 : le coin d'état dit « Diapositive 2 copiée. » /
   « Slide 2 copied. », le clavier reste sur elle et le document ne change pas.
2. Ctrl+V sur la miniature 1 : la diapositive copiée arrive en deuxième, avec son titre et son texte en gras, le clavier
   reste sur sa miniature, et un seul Ctrl+Z la retire.
3. Un mot choisi dans le texte garde le copier-coller de toujours : il se colle au curseur, sans diapositive de plus.
4. L'extension éteinte : Ctrl+V puis Ctrl+C sur une miniature appellent `installer` (la fenêtre de GFS s'ouvre sur la ligne
   « Diapositives »), et le document ne change pas.
5. Aucun refus de la politique de sécurité, aucun avertissement de GFS dans la console.

**3. Le reste, sans écart** : la langue (`run-langue-publipostage.mjs`, 25 vérifications par combinaison), l'ouverture (28)
et les présentations (37, dont le copier-coller), en français / clair et en anglais / sombre ; l'écriture en direct (60), en
français / clair.

**4. Ce qui reste ouvert, et à qui :**

1. **Non mesuré** : le copier-coller entre deux onglets de Grist (le presse-papiers du système fait le lien ; ton essai à
   deux onglets l'a mesuré chez toi, pas GFS), les images en calque qui suivent leur diapositive, la tenue de 70
   diapositives (tes chiffres), Firefox et Safari.
2. **Le titre d'impression** (011) : toujours non mesuré par GFS, dont le labo n'ouvre pas la boîte d'impression de Chrome ;
   le porteur le mesure dans son Chrome.
3. **La 016** reste « lue, pas faite » : elle attend la bascule de GFS sous `grist-factory`.

## Pourquoi

Ta page disait le copier-coller « à essayer » dans le cadre isolé : GFS l'a essayé pour toi, et la référence de ton app dans
GFS est maintenant celle que ta page décrit.

## Fait quand

`GFS-ETAT.md` donne « 022 · faite · lue, aucun code » (avec tes constats, si tu en as).
