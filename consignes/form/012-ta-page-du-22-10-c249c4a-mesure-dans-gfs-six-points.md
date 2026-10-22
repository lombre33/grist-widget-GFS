# 012 · Ta page du 22/10 : `c249c4a` mesuré dans GFS, l'enregistrement qui passe, six points à reprendre

App : Form+ · posée le 22/10/2026 · réponse à ton `GFS-ETAT.md` (lu à `c249c4a`) · quand : au prochain lot, sans urgence ; du code
dans ton app (points 2 à 7) ; les points 2 à 6 se voient aussi dans l'app seule

## Quoi

**1. Ce que GFS a mesuré avec ton app à `c249c4a`** (vrai Grist, grist-static 0.1.6, à la vraie souris et au vrai clavier, panneau
700 × 400, français / clair et anglais / sombre ; `prototype/labo/run-form.mjs`, `run-form-seul.mjs` pour ton app sans GFS,
`run-ouvrir-form.mjs` et `run-barre-apps.mjs`). **Ça passe** : un formulaire natif posé sur sa propre page s'enregistre (ta fenêtre
d'accord, puis `FormPlus_Formulaires`), sans section de garde et sans qu'aucun cadre se recharge ; une ligne par formulaire, celle de
la copie (`Definition.vsId`) ; le champ caché `FormPlusDef` (une Référence vers `FormPlus_Formulaires`, `Definition` affichée) ; le
même lien deux fois ne copie rien de plus ; un second formulaire a sa ligne ; le mode interne pose `FormPlus_Repondants` et sa
colonne `Email` (formule `user.Email`). « Nouveau » et le double-clic démarrent ton app (010) ; la barre (011) est là aux quatre
bords sur tes quatre écrans, au départ et en fin de défilement, sans rien d'utile dessous ; le courtier ne t'a rien refusé.
Deux réponses : (a) GFS a déclaré la capacité `formules` dans ton manifeste (sans elle, le courtier refusait la colonne du mode
interne : « Une colonne à formule demande la capacité « formules » »), rien à faire chez toi ; (b) à ta question de la 008, point 3,
l'explorateur de GFS liste **toutes** les lignes de `FormPlus_Formulaires`, par `Nom`, `TypeFormulaire`, `DateModif` et `ModifiePar`
(il ne lit pas `Definition`) : d'après ta mesure (un visiteur ne peut ajouter une ligne que là où une section de formulaire est
publiée), sans la section de garde personne ne peut en ajouter une, et c'est ce qui compte.

**2. Le formulaire natif posé sur la page de ton widget : la ligne n'est jamais écrite.** C'est le cas de « Partir de zéro » (le
formulaire vide qu'il crée est posé sur la page de ton widget) et de toute personne qui met ton widget à côté de son formulaire.
`duplicateFormSection` pose la copie sur la page de la source ; Grist reconstruit alors le cadre du widget avant que `saveConfig`
écrive. Mesuré avec et sans GFS : ta fenêtre d'accord et `FormPlus_Formulaires` passent, puis plus rien, aucune ligne ; et chaque
nouvel essai ajoute une copie orpheline de plus. À toi la manière (écrire la ligne avant que la copie ne recharge le cadre, ou la
reprendre au redémarrage par `GfsLink.storageSet`, ou demander à la personne de poser son formulaire sur sa propre page avant de
dupliquer : tu détectes déjà `samePage`).

**3. « Changer de formulaire source » disparaît.** Le bouton est dans le `<p data-i18n="form.settings.urlDesc">` de
`poc/widget.html` : `translateDom` du kit remplace tout le contenu d'un élément `data-i18n` par du texte, le bouton n'est plus dans la
page une seconde après l'ouverture (mesuré dans GFS). Un formulaire enregistré qu'on rouvre n'a donc plus de chemin vers l'écran de
départ : impossible de lier un autre formulaire. Sors le bouton du paragraphe.

**4. « Nouveau » doit montrer ton écran de départ** (reprend ce que la 010 attend). Mesuré, avec des formulaires enregistrés : « Nouveau »
lancé quand ton app n'est pas ouverte rouvre un ancien formulaire (`onOptions` ne lit pas `raison: nouveau` : elle prend le
formulaire gardé ouvert, sinon `resolveMyDefinition()`, ambiguë dans GFS puisque toutes les lignes portent la section partagée de
l'hôte) ; ton app déjà ouverte montre bien l'écran de départ, mais laisse l'éditeur du formulaire précédent affiché dessous
(`showConfig()` ne cache `#editor` que par le bouton du point 3).

**5. Le champ caché du second formulaire est visible.** Quand le formulaire natif a été posé après la colonne `FormPlusDef`, Grist
l'en dote déjà, et `ensureRespondentDefinitionField` le prend pour fait (`already`) sans le cacher : la copie du second formulaire
porte `FormPlusDef` **sans** `formIsHidden` (mesuré : `["cache","visible"]` pour deux formulaires de `Clients`). Une personne qui
répond le verrait. Si le champ existe, pose `formIsHidden: true` dessus.

**6. Le mode interne crée `FormPlus_Repondants` sans fenêtre d'accord.** La table naît au clic sur la case (mesuré : aucune fenêtre
pendant les 4 secondes qui suivent). Guide 1.1, point 4 : une table ne se crée qu'avec l'accord de la personne, comme tu le fais
pour `FormPlus_Formulaires`.

**7. Un document déjà touché par `038dd1b` peut garder le portillon que tu as retiré.** Lu dans ton code, pas mesuré (le labo part
d'un document neuf) : `ensureFormulairesTable` ne pose plus de section de garde, mais rien ne retire celle que les versions
d'avant ont posée (celle de `038dd1b`, la 007). Dans un document où tu l'as essayée, elle est peut-être encore là, publiée : c'est
le risque que tu as mesuré (n'importe quel visiteur du lien y ajoute une ligne). Si tu en as posé dans des documents réels, retire-la
au prochain enregistrement (avec l'accord de la personne, comme pour toute écriture qui change sa page) ou dis dans ta page d'état
que tu ne le fais pas et pourquoi.

**8. Rien à changer, à savoir.** Dès maintenant GFS ouvre ton app depuis son site en ligne
(`https://lombre33.github.io/FormPlus/poc/widget.html`), plus depuis une copie figée (décision du porteur du 22/10) : ce que tu
pousses est ce que le porteur voit dans GFS, après les 10 minutes de cache de Pages. Garde ce site publié et ton entrée à
`poc/widget.html` (le manifeste de GFS la déclare) ; s'il ne répond pas en 15 secondes, GFS ouvre la copie du sous-module et le dit.
Ta demande Leaflet attend toujours le mot du porteur.

## Pourquoi

Le porteur a voulu que chaque app soit mesurée dans GFS avant la suite. L'enregistrement de la 008 marche là où le formulaire a sa
page ; les points 2 à 4 sont ceux qu'une première personne rencontre (« Partir de zéro », puis un second formulaire, puis « Nouveau »).

## Fait quand

`GFS-ETAT.md` donne « 012 · faite · `<commit>` » (ou point par point) ; chaque correction a son test, qui échoue sur l'ancien code.
GFS rejoue alors `run-form`, `run-form-seul` et `run-ouvrir-form` : les « CONSTAT » (points 2 à 6) deviennent des vérifications.
