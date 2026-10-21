# 008 · Ta page du 21/10 (soir) : la 007 mesurée, un formulaire ne s'enregistre pas encore, les répondants, une ligne par formulaire

App : Form+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`16701fe`, qui décrit `038dd1b`) · quand : au prochain lot ; du code
dans ton app ; visible aussi dans l'app seule (enregistrer ne passe pas non plus sans GFS)

## Quoi

**1. La référence avance de `39e0740` à `038dd1b`** (un commit à part, relu), le commit que ta page décrit. Relu (13 fichiers) :
plus d'écriture de `options`, plus de lecture de `_grist_Shares`, plus de `setOptions` de tout l'objet ; `FormPlus_Formulaires`
naît avec l'accord de la personne, son identifiant relu après `AddTable`. Ni adresse, ni stockage, ni écriture `_grist_*` de plus :
le manifeste de Form+ ne change pas.

**2. Ce que GFS a mesuré** (vrai Grist : grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris et au vrai clavier, en
français / clair et en anglais / sombre ; `prototype/labo/run-form.mjs`, 26 vérifications sur 26, et `run-form-seul.mjs`, ton app
sans GFS, 7 sur 7, dans les deux combinaisons) :

- Ton app démarre sans refus ni erreur de script, et le courtier ne refuse rien pendant tout l'enregistrement.
- « Repartir d'un formulaire existant », le lien d'un formulaire du document, « Générer » : la fenêtre du kit demande l'accord, et
  « Créer la table » crée `FormPlus_Formulaires`. Bien.
- **Puis rien ne s'enregistre, avec ou sans GFS.** Juste après, `ensureFormulairesTable` appelle `ensureTableGate`
  (`poc/js/grist-meta.js`, lignes 404 et 89), qui pose sur la page du widget une section de formulaire pour `FormPlus_Formulaires` ;
  Grist recharge aussitôt le cadre : celui de GFS (l'explorateur revient, ton app est fermée), ou le tien sans GFS. C'est le fait
  que donnait la 007 (point 2 : « les gestes qui posent une section doivent se reprendre à la réouverture »). La suite est perdue :
  la section garde ses six champs et n'est pas publiée, le formulaire n'est pas dupliqué, aucune ligne n'est écrite.
- **Chaque nouvel essai ajoute une section.** Au second « Générer » (sans fenêtre : la table existe), `ensureTableGate` ne trouve
  pas de section publiée et en pose une autre : deux sections « FormPlus_Formulaires » de plus sur la page, toujours aucune
  ligne. Dans GFS, elles prennent la place de son panneau.

**3. Les répondants** (le point 5 de la 007, et ta page). **Lu dans le code de Grist, non mesuré** (`app/common/ACLRulesReader.ts`,
dans les sources que grist-static 0.1.6 embarque ; c'est le serveur de Grist qui applique ces règles, et grist-static n'a pas de
partages). Une session de partage ne lit ni n'écrit aucune table de données (`-CRUDS` sur chacune, ligne 277). Une section de
formulaire publiée sur une page du partage (lignes 220 et 228) ouvre sa table à **l'ajout de lignes**, toutes colonnes (`+C`,
ligne 301), et à la lecture de la seule ligne `rec.id == 0` (`+R`, ligne 308) : **aucune ligne existante**. La session lit en plus
les colonnes montrées (`visibleCol`) des tables vers lesquelles pointent les Références de ces formulaires (ligne 325) : c'est ce
qu'utilisent tes questions « Choix depuis une table ». Si cela se confirme sur un vrai Grist :

- `ensureTableGate` sur `FormPlus_Formulaires` ne rend pas la `Definition` lisible au répondant, ni par `fetchTable` dans la
  session de partage, ni par le repli REST de `renderFill()` (`/records`) ;
- elle permet à quiconque a le lien d'un formulaire d'**ajouter des lignes** à `FormPlus_Formulaires`, que l'explorateur de GFS
  listerait comme des formulaires.

**4. Une ligne par formulaire** (la 007, point 3.1). **Lu dans ton code, non mesuré** (l'enregistrement ne passe pas). Une ligne se
retrouve par `IdSectionWidget`, la section du widget (`saveFormDefinition`, ligne 426) : seule, une instance du widget porte un
formulaire, et c'est cohérent. Dans GFS, ta section est celle de GFS, la même pour tous tes formulaires : un second formulaire fait
dans GFS réécrirait la ligne du premier (`UpdateRecord`, ligne 430). `findMySection` la trouve parce qu'elle est la seule section
personnalisée du document (ligne 349) : avec un autre widget dans le document, elle n'en trouve aucune, et rien ne s'enregistre.

**5. Ce que tu changes.**

1. Le premier « Générer » écrit la ligne du formulaire, avec ou sans GFS ; un nouvel essai ne pose jamais une section de plus.
2. Une ligne par formulaire, comme la 007 le demande : dans GFS, un second formulaire a sa propre ligne et ne touche pas celle du
   premier. La porte « ouvrir » (007, point 4) donnera à ton app l'identifiant de la ligne à ouvrir.
3. Les répondants : vérifie sur ton vrai Grist, avec un vrai lien de partage, ce qu'un répondant lit de `FormPlus_Formulaires` et si
   ce lien peut y ajouter une ligne ; dis dans ta page comment la définition lui parvient. Si cela demande quelque chose à GFS,
   c'est une question pour GFS.

**6. Ta page.** Elle décrit `038dd1b`, mais ton `main` est la fusion `652b156`, qui apporte douze commits que la page ne décrit pas
(de `514341f` à `85ac56d`, deux fusions comprises). Ceux qui touchent GFS : le mode interne (`02be13c` : la table
`FormPlus_Repondants` et sa colonne `Email` à formule `user.Email`, qui demanderont la capacité `formules`, contrats 3.4, et l'accord
de la personne, règle 4), la CSP de `widget.html` (`aa13d26`, puis `85ac56d` : `https://docs.getgrist.com` dans `script-src`, d'où
le cahier fait venir le script d'API de Grist), le lien public (`00ad9d5`). Décris-les dans « Changements qui touchent GFS » : GFS
avancera alors la référence jusqu'à la fusion et les mesurera.

**7. L'`INDEX.md`** passe la 007 à « faite · `038dd1b` », comme ta page.

**8. À venir, rien à faire avant la consigne qui suivra** : le porteur a choisi ce soir que les fichiers de GFS épinglent, rangent
et renomment eux-mêmes, avant qu'aucune app ne soit ouverte. Les favoris et les dossiers iront dans la table de GFS
(`GFS_Rangement`) ; pour renommer, GFS écrira **la seule colonne `Nom`** de `FormPlus_Formulaires` (choix du porteur : « Oui, le
nom seul »). Dupliquer et supprimer restent à toi.

## Pourquoi

La 007 devait faire apparaître tes formulaires dans l'explorateur de GFS : sans ligne enregistrée, il reste vide, et chaque essai
change la page de la personne. GFS avance la référence au fur et à mesure (le porteur, 20/10) et mesure ce qui se voit dans son
cadre ; ce qui se joue dans une session de partage ne se mesure que sur un vrai Grist avec un vrai lien, que tu as.

## Fait quand

`GFS-ETAT.md` donne « 008 · faite · `xxxxxxx` » et dit : comment un formulaire s'enregistre (dans quel ordre, ce qui se reprend à
la réouverture), comment une ligne se retrouve, ce qu'un répondant lit et peut ajouter (mesuré sur ton vrai Grist, avec un vrai
lien) ; « Changements qui touchent GFS » décrit les commits du point 6. GFS rejoue alors `run-form` et `run-form-seul` avec ton
commit : une ligne au premier « Générer », une seconde ligne pour un second formulaire, aucune section de plus au second essai.
