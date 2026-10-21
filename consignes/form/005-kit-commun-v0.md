# 005 · Le kit commun v0.1 : le référencer, puis fenêtres, traduction, thème et jetons

App : Form+ · posée le 21/10/2026 · étape 3 du plan (cahier 10), Form+ premier client du kit (décision du porteur, 16/10) ·
suite de l'annonce de la 002 (point 3.1) · quand : au prochain lot ; du code dans ton app ; visible aussi dans l'app seule

## Quoi

**1. Le kit existe.** Dépôt `lombre33/grist-factory-kit` (public), première étiquette **`v0.1.0`**, commit `54c48f3`. Son
`README.md` est le mode d'emploi de chaque module et ses « Règles à connaître » : cette consigne ne le recopie pas, elle dit
ce que ton app en fait. Sa licence est la GPL 3.0, comme celle de tous les dépôts de la suite (guide, 1.3) ; la tienne est
l'objet de la 004. Le kit apporte ce que le relevé du 14/10 (cahier 4.5) a trouvé qui te manque :

- **les jetons de la charte** (`css/tokens.css`), en clair et en sombre, à la place de ta palette ;
- **le thème** (`js/theme.js`) ;
- **la traduction français / anglais** (`js/i18n.js`), avec les pluriels `{n|singulier|pluriel}` ;
- **les fenêtres** : `js/dialogs.js` (`prompt`, `confirm`, `choose`, `notice`) à la place des boîtes du navigateur, sur
  `js/modal-base.js` et `css/windows.css` (titre et boutons fixes, Tab et Échap tenus), avec `js/layers.js` et `js/dom.js`.

Sans bibliothèque ni adresse externe, et il marche sous une CSP stricte (`default-src 'none'`, `style-src 'self'`). Mesuré
seul : 38 essais sous Node et 203 vérifications dans Chromium à 700 × 400, à la vraie souris et au vrai clavier, en clair et
en sombre, en français et en anglais. **Essayé sur une copie de ton `2c0ee50`** (rien n'a été poussé chez toi) : ta suite (536
vérifications) y reste verte en français et en anglais ; ce que la copie a montré est dans le point 2.

**2. Ce que ton app a à faire**, dans cet ordre, ta suite restant verte à chaque pas :

1. **Référencer le kit**, dans un commit à part, relu : `git submodule add https://github.com/lombre33/grist-factory-kit.git
   kit`, puis `git -C kit checkout v0.1.0` (le commit `54c48f3`), puis `git add kit`. C'est l'adresse `https://` d'un dépôt
   public, la seule que Pages récupère (cahier 4.2) ; elle changera avec les dépôts publics, dans un commit à part. Aucun
   fichier du kit n'est copié dans `poc/`. Ton workflow `.github/workflows/tests.yml` demande `submodules: true` à
   `actions/checkout`, sinon `kit/` est vide en CI. Un module du kit s'importe par **une seule adresse** dans tout le dépôt,
   sans `?v=` (le README dit pourquoi : le kit avertit dans la console s'il est chargé par deux adresses).
2. **Jetons et thème.**
   - Dans `poc/widget.html`, `../kit/css/tokens.css` puis `../kit/css/windows.css`, avant `css/widget.css`. Dans `widget.css`,
     ta palette (le bloc `:root` et son bloc sombre) s'en va, sauf `--radius`. Plus de couleur ni de `z-index` en dur (charte,
     section 1), sauf le canevas du QR code (`#qrCanvas`), qui reste blanc : un QR code se scanne sur fond clair. Tes deux
     jeux, `--chrome-accent*` pour le concepteur et `--accent*` pour le répondant, deviennent celui du kit (tableau
     ci-dessous).
   - Le thème passe par `Theme.init({ storageKey: 'formplus_theme' })` : même clé, mêmes valeurs (`light`, `dark`, clé
     absente = système), donc le choix déjà fait est gardé. `getStoredTheme`, `setStoredTheme`, `applyTheme` et
     `effectiveDark` de `poc/js/theme.js` s'en vont ; `softenColor` lit `Theme.isDark()` ; la bascule fait
     `Theme.set(Theme.isDark() ? 'light' : 'dark')` et rafraîchit son icône sur `Theme.onChange`.
   - **Piège mesuré sur la copie.** `applyBranding` (la couleur choisie pour le répondant) posait ses variables sur `<html>`.
     Avec le kit, ce sont les mêmes jetons que ceux de l'écran du concepteur et des fenêtres du kit : le bouton principal du
     concepteur, ses onglets et les boutons des fenêtres du kit prenaient la couleur du formulaire (le rouge d'un formulaire
     rouge), ce que le commentaire de `theme.js` voulait éviter. Pose `--accent`, `--accent-solid`, `--accent-ink`,
     `--accent-soft` et `--on-accent` **sur `#fill`** (`$('fill').style.setProperty` : le CSSOM passe même sous
     `style-src 'self'`), jamais sur `<html>` : les textes et icônes d'accent du répondant (`--accent-ink`) gardent ainsi la
     couleur choisie, comme avant. Un fond plein prend `--accent-solid` sous `--on-accent`.

   | Dans `widget.css` | Jeton du kit |
   |---|---|
   | `--bg`, `--text` | les mêmes |
   | `--card` | `--surface` |
   | `--muted` | `--text-muted` |
   | `--border` (champs, boutons) | `--border-strong` |
   | `--border-soft` (cartes, filets) | `--border` |
   | `--chrome-accent`, `--accent` : fond plein | `--accent-solid`, et `--on-accent` pour le texte dessus |
   | `--chrome-accent`, `--accent` : texte ou icône | `--accent-ink` |
   | `--chrome-accent`, `--accent` : contour, filet | `--accent` |
   | `--chrome-accent-soft`, `--accent-soft` | `--accent-soft` |
   | `--chrome-accent-text`, `--accent-text` | `--on-accent` |
   | `--ok` | `--good` |
   | `--error` : texte | `--danger-ink` |
   | `--error` : contour | `--danger` |
   | `--shadow` | `--shadow-card` |
   | la police (`system-ui, …`) | `var(--font-ui)` |

3. **Traduction**, français et anglais dans le même lot. Tout texte de l'interface passe par `I18n` : ceux de `widget.html`
   par `data-i18n` (et `data-i18n-title`, `-aria`, `-placeholder` pour les attributs), ceux du code par `I18n.t('form.…')`,
   les pluriels en `{n|question|questions}`. Relevé approximatif sur `2c0ee50` : plus de 200 textes, dont 75 dans
   `widget.html`, environ 80 dans `config-editor.js` et environ 25 dans `respond.js`. Les textes vont dans un seul fichier de
   clés préfixées `form.` (dans la copie : `poc/js/strings.js`) ; ce que la personne écrit dans un formulaire (questions,
   aides) reste tel qu'elle l'a écrit. Dans le module d'entrée, `I18n.add(…)`, `I18n.init({ storageKey: 'formplus_lang' })`
   et `Theme.init(…)` viennent d'abord, avant que rien ne soit dessiné (sinon la page s'affiche en français et en clair,
   puis bascule) ; `I18n.onChange` retraduit ce que le code a écrit lui-même. La langue : celle de GFS quand l'app est
   hébergée (`gfs=<n>` et `language` dans l'adresse du cadre, contrats 1.3), sinon le choix gardé sous `formplus_lang`,
   sinon celle du navigateur (le français, ou l'anglais pour toute autre langue).
4. **Fenêtres.** Le `window.prompt` du repli de « Copier l'adresse » (`poc/js/config-editor.js`, ligne 204 à `2c0ee50`)
   devient `await Dialogs.prompt({ title, message, value, confirmLabel })`, et le `confirm()` de `resetQuestions` (ligne 1098)
   `await Dialogs.confirm({ title, message, confirmLabel, danger: true })`, avec un bouton qui nomme le geste (« Retirer les
   questions »), jamais « OK ». Ce sont des fenêtres du widget, qui n'arrêtent pas le script : l'appelant attend. Pas de
   fenêtre à toi à écrire ; une fenêtre dont Form+ aurait besoin plus tard se construit avec `ModalBase.create` (README).
5. **Tests.**
   1. L'essai de `resetQuestions` (`poc/js/tests.js`, ligne 983) remplaçait `window.confirm` ; la confirmation étant une
      fenêtre, il clique son bouton principal (`#pp-dialog-modal .pp-modal-primary`) et attend la fin de `resetQuestions()`.
      C'est le seul essai de ta suite qui a changé dans la copie.
   2. Le lanceur de la CI (`.github/scripts/run-widget-tests.js`) fixe la langue de la page : le Chromium de la CI est en
      anglais, et la suite lirait de l'anglais là où elle attend du français. Joue-la en `fr-FR` puis en `en-US` ; un essai
      qui compare un texte de l'interface le compare à `I18n.t(clé)`, pas à du français écrit en dur.
   3. La suite échoue quand le kit avertit dans la console : un `[I18n] …` (clé inconnue, traduction manquante) ou un
      `Kit : … est chargé deux fois`.
   4. Un essai vérifie que chaque clé `form.…` a ses deux langues.
   5. Un essai garde le piège du point 2 : après `applyBranding({ accentColor: '#e5484d' })`, le bouton principal du
      concepteur et celui d'une fenêtre du kit ont toujours le bleu du kit, celui du répondant a la couleur choisie ; il
      échoue quand les variables sont posées sur `<html>`. Les boutons ont une transition de 0,12 s : lis la couleur
      d'arrivée, pas celle du départ.
6. **Mesurer** dans un vrai Grist (ton `tests/grist-env` ou un autre), à 700 × 400, à la vraie souris et au vrai clavier, en
   clair et en sombre, en français et en anglais : les écrans traduits (un texte anglais plus long ne coupe rien et ne fait
   pas défiler la page à tort), la saisie et la confirmation (Tab tourne dans la fenêtre, Échap annule, un clic hors de la
   fenêtre ne ferme rien, le focus revient au bouton qui l'a ouverte), le contraste de 4,5:1, la bascule de thème, la couleur
   d'un formulaire.

**3. Ce que cette consigne ne demande pas.**

1. **`poc/public-form.html`** (la page de secours hors Grist, un script classique en ligne) **et `index.html`** gardent leur
   palette et leur français. Si tu les veux sur le kit, pose la question dans « Questions pour GFS ».
2. **Un choix de langue à toi dans l'app seule.** Dans GFS, il serait grisé avec la raison (contrats 5.2, point 6) ; si tu en
   veux un, pose la question de même. La lecture de `contexte.langue` et l'événement `langue` viennent à l'étape 5, avec le
   client du courtier (guide 1.2, point 8).
3. **Le contexte et le stockage par le kit, `gfs.json`, les tables, la CSP** : étape 5. La V0.1 n'a pas le client du
   courtier : tes lectures de `document.referrer` (consigne 003, point 2) restent ce qu'elles sont d'ici là, contrairement
   à ce que dit la 003 (« le kit les remplace à l'étape 3 ») : c'est le client du courtier, à l'étape 5, qui les remplacera.
   Si la CSP de ton app interdit un jour les styles en ligne (`style-src 'self'`, guide, règle 11), les attributs `style=`
   de `widget.html` (23 à `2c0ee50`, et 2 dans le code) seront à convertir en classes ; le kit n'en pose aucun et marche
   sous cette politique ; il n'est pas demandé de les retirer ici.

## Pourquoi

1. Le porteur a lancé l'étape 3 le 21/10, et Form+ en est le premier client (16/10, cahier 4.5) parce que c'est lui qui a le
   plus à y gagner : ni traduction, ni fenêtres à lui, une palette à lui. Le kit lui apporte ce qui manque au lieu de
   remplacer des copies, comme ce sera le cas chez Publipostage+, Automation+ et Grist-BI.
2. Ce que le kit porte ne s'écrit pas deux fois (guide, règle 1). L'essai de GFS sur une copie de ton dépôt a défriché le
   chemin avant que les autres apps s'y engagent : le piège de la couleur du formulaire et le lanceur de la CI en anglais
   sont ceux qu'elles retrouveraient.

## Fait quand

`GFS-ETAT.md` donne « 005 · faite · `<commit>` » quand : (a) `kit/` pointe sur `v0.1.0`, en commit à part, et ta CI récupère
les sous-modules ; (b) `widget.css` n'a plus de palette ni de couleur en dur (hors `#qrCanvas`), en clair et en sombre, et
la couleur du formulaire ne sort pas de `#fill` ; (c) tout texte de l'interface est dans tes clés `form.…` en français et en
anglais, la langue venant de l'adresse de GFS, sinon du choix gardé, sinon du navigateur ; (d) il ne reste ni `prompt()`, ni
`confirm()`, ni `alert()` ; (e) ta suite est verte dans les deux langues et échoue sur un avertissement du kit ; (f) tu as
mesuré comme au point 2.6. Ce qui n'a pas marché ou t'a étonné va dans « Questions pour GFS ». GFS relit ton journal depuis
`2c0ee50` (`docs/apps.md`) et répond par une consigne si besoin ; l'étape 3 est terminée quand le porteur a vu Form+ tourner
avec le kit (cahier 10).
