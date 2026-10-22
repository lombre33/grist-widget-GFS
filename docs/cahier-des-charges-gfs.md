# Grist Factory Suite (GFS) : cahier des charges

Version 1 du 14 octobre 2026. Rien n'est codé : ce document fixe ce que GFS doit faire, ce qui est déjà décidé,
l'architecture retenue et l'ordre de réalisation. Il remplace, pour lancer le chantier, la lecture des études du 12 et
du 14 octobre (rangées dans `contexte/`, qui gardent le détail et les preuves).

Il sert à deux équipes :

- **le projet qui code GFS** : dépôt de GFS, kit commun, courtier, explorateur ;
- **le projet de chaque app** (Publipostage+ d'abord), qui suit le guide des apps (`guide-des-apps.md`) pour pouvoir
  tourner dans GFS sans rien perdre seule.

« Le porteur » désigne le porteur du projet Grist Factory : c'est lui qui décide.

## En bref

1. **GFS est un widget Grist « chef d'orchestre ».** Il installe des apps Grist Factory, en fait tourner une à la fois dans
   son cadre et permet de passer de l'une à l'autre par un **explorateur de fichiers** toujours présent. Un fichier, c'est
   un modèle de Publipostage+, un formulaire de Form+, un automatisme d'Automation+…
2. **Chaque app reste un dépôt public complet, qui tourne seule.** GFS n'apporte rien qu'une app ne sache faire seule sur
   ses propres données ; il ajoute l'explorateur, le passage d'une app à l'autre et les extensions.
3. **GFS référence le dépôt de chaque app à un commit précis** (sous-module Git) : aucune copie. Dependabot propose
   d'avancer la référence quand l'app avance.
4. **Bibliothèques : CDN par défaut, version vendorisée pour les RSSI qui l'exigent.** Les deux se fabriquent depuis une
   liste que Dependabot surveille pour les failles : celle de l'app pour ses bibliothèques natives, celle de GFS pour les
   bibliothèques non natives, que GFS porte seul pour que les dépôts des apps restent propres.
5. **Le gain de sécurité vient de l'isolement** : chaque app tourne dans un sous-cadre sans `allow-same-origin`, et GFS,
   seul à parler à Grist, ne laisse passer que ce que le manifeste de l'app autorise.
6. **Interopérables par la donnée et par des contrats écrits** (manifeste `gfs.json`, actions « ouvrir », « choisir »,
   « insérer », « fermer »), jamais en important le code d'une app dans une autre.
7. **Aller-retour sans perte** entre une app seule et GFS : on change l'adresse dans le champ du panneau de droite de Grist
   (jamais par la galerie), les définitions vivent dans des tables, le contenu inconnu reste intact.
8. **Ordre** : contrats, prototype du courtier, kit commun, listes des bibliothèques, apps prêtes, GFS v0, puis
   extensions et nouvelles apps. Chaque étape se livre seule (section 10).

---

## 1. Vision et périmètre

### 1.1 Ce que fait GFS

- Installer et désinstaller des apps, activer et désactiver leurs extensions, dans une section Grist.
- Montrer dans un explorateur les fichiers de toutes les apps installées : parcourir, chercher, filtrer par type, trier,
  ranger (dossiers, favoris).
- Ouvrir un fichier : activer l'app qui le possède, sur ce fichier.
- Passer d'une app à l'autre sans quitter le widget, et revenir là où l'on était.
- Offrir aux apps des actions communes : ouvrir un fichier, en choisir un, insérer ce qu'une autre app produit.

### 1.2 Les apps

| App | Dépôt de développement | État au 14/10 | Ses fichiers dans l'explorateur | Place dans GFS |
|---|---|---|---|---|
| Publipostage+ | `lombre33/publipostageGrist` | mûre ; bêta 1.0.0-beta.1 publiée le 05/10 (`grist-factory/Publipostage-Plus`) | modèles : document, e-mail, macro-modèle, grille ; présentation à venir | app native (documents, grilles) ; extensions : diapositives, écriture en temps réel, graphique |
| Form+ | `lombre33/FormPlus` | preuve de concept | formulaires | app ; sa définition doit passer des réglages de la vue à une table |
| Automation+ | `lombre33/GRIST_automation` | preuve de concept | automatismes | app ; son graphe doit passer en table ; ne tourne que vue ouverte |
| Grist-BI | `lombre33/Grist-BI` | preuve de concept | tableaux de bord | app, sans fusion de code avec les autres |
| Dashboard | à créer | — | tableaux de bord | à préciser par rapport à Grist-BI (question 6, section 12) |
| Thusday | à créer | — | projets (gestion de projet à la Monday ou ClickUp) | naîtra sur le kit, prête pour GFS |

Slides+ (`lombre33/SlidesPlus`) n'est pas une app de GFS : les diapositives deviennent une extension de Publipostage+
(une diapositive est une page 16:9 du même éditeur) et Slides+ reste une référence (étude du 12/10, section 3).

### 1.3 Ce que GFS n'est pas

- **Pas une fusion des apps** : aucune app n'importe le code d'une autre.
- **Pas une sécurité par cases à cocher** : dans un même cadre, tout le code a les mêmes droits. Ne jamais écrire, dans un
  README ou une interface, que « cocher un module » rend plus sûr. Ce qui protège, c'est l'isolement en sous-cadres.
- **Pas un moteur de calcul** : les valeurs se calculent dans Grist (colonnes à formule) ; les apps les mettent en forme.
- **Pas de serveur** : des pages statiques servies par GitHub Pages, ou hébergées par le client en mode vendorisé, sans
  étape de construction pour les servir.
- **Pas de navigation entre les pages de Grist** : un widget n'a aucune commande pour changer de page ni ouvrir une autre
  section (vérifié le 12/10 dans `grist-plugin-api.js`). On arrive dans un usage par la page Grist, réglée pour cet usage.

### 1.4 Vocabulaire

- **App** : un widget Grist Factory complet, dans son dépôt public, qui tourne seul.
- **GFS** : le widget qui héberge les apps. C'est son adresse qu'on met dans Grist.
- **Kit** : le code commun aux apps et à GFS (accès à Grist, traduction, jetons de la charte, fenêtres, liste avec
  recherche, empilement des couches, client du courtier…), versionné, sans bibliothèque tierce.
- **Extension** : une fonction d'une app qui demande une bibliothèque lourde (graphique, diapositives, temps réel,
  PowerPoint). Son code vit dans le dépôt de l'app ; sa bibliothèque est portée par GFS ; elle n'est active que dans GFS.
- **Courtier** : la partie de GFS qui relaie l'API de Grist entre Grist et l'app active, et la filtre.
- **Sous-cadre** : l'iframe dans laquelle GFS fait tourner une app.
- **Manifeste** : le fichier `gfs.json` d'une app, qui dit ce qu'elle possède, ce qu'elle demande et ce qu'elle offre.
- **Fichier** : ce que l'explorateur liste. Dans Publipostage+, un fichier est un **modèle**, et le mot reste « modèle »
  dans son interface.
- **Mode CDN, mode vendorisé** : les bibliothèques chargées depuis un CDN (le défaut) ou servies avec l'app (pour un RSSI
  qui interdit les CDN).
- **Bibliothèque native, non native** : une bibliothèque est native quand l'app ne marche pas seule sans elle (l'éditeur,
  les exports) ; elle reste dans l'app, dans la liste de l'app. Elle est non native quand c'est celle d'une extension (Plotly
  pour le graphique) : GFS la porte, avec sa liste, son chargement, ses empreintes et sa version vendorisée ; la CSP de l'app n'en garde que l'adresse du
  mode CDN.
- **Adresse** : l'URL d'un widget, celle qu'on écrit dans le champ du panneau de droite de Grist.

---

## 2. Décisions prises (ne pas rouvrir)

| Décision du porteur | Quand | Ce qu'elle implique |
|---|---|---|
| Une app = un dépôt public complet, qui tourne seule | 14/10 | Audit possible app par app |
| GFS **référence** le dépôt de chaque app, sans copie figée (« du code dupliqué, plus de maintenance ») | 14/10, 11 h 14 | Sous-modules Git à un commit précis |
| Pas « tout vendoriser » : une copie dont personne ne corrige la faille | 14/10, 11 h 15 | Pas de copie permanente des bibliothèques dans GFS |
| **CDN par défaut ; version vendorisée si le RSSI d'un client l'exige** | 14/10, 11 h 15 | Les deux modes depuis une liste : celle de l'app (natives) ou celle de GFS (non natives, ligne suivante) |
| **GFS porte la partie dépendance des bibliothèques non natives** : « les dépôts des apps doivent rester clean ». Le code d'une fonction (la façon dont Publipostage+ gère ses graphiques) reste dans l'app ; la bibliothèque (Plotly), son chargement, sa CSP, sa liste et ses empreintes sont à GFS | 14/10 | Section 4.7 ; le dépôt d'une app n'a ni la liste, ni l'import map d'une bibliothèque d'extension, et sa CSP n'en garde que l'adresse du mode CDN (précisé le 14/10 d'après la mesure du prototype et la réponse « CDN d'abord » à la question 11 : GFS ne peut imposer aucune politique à un sous-cadre). Confirmé par le porteur : l'éditeur et les exports, sans lesquels l'app ne marche pas seule, gardent leurs bibliothèques dans l'app |
| Une fonction dont la dépendance n'est pas activée est grisée, et un clic explique comment passer à l'adresse de GFS | 14/10 | Texte commun du grisé (guide des apps, section 5) |
| On passe d'une app seule à GFS et on revient sans perte de données | 14/10 | Section 7 |
| GFS charge l'app sans changer l'adresse du widget | 14/10 | Sous-cadre servi depuis le site de GFS |
| Pas de calcul dans le widget : les valeurs se calculent dans Grist | 09/10 | Aucun moteur de formules dans une app |
| Limiter le nombre de tables créées dans le document | 08/10 | Une ligne réservée d'une table existante avant une table de plus |
| Reprendre le code, ne pas dupliquer ; une refonte est acceptée si elle évite des copies | 08/10 et 12/10 | Kit commun |
| Charte Grist Factory : monochrome, un seul bleu d'accent, police du système, grisé jamais masqué, panneau de 700 × 400, français et anglais dans le même lot | 18/09 au 12/10 | Section 3.4 et `contexte/charte-ui-ux-grist-factory.md` |
| Couleurs par type, dans l'explorateur seulement : document bleu, grille vert, présentation orange | 12/10 | Section 6.5 |
| Notes = un document ; diapositives d'abord ; PowerPoint précis et OnlyOffice libre « très importants » | 12/10 | Extensions de Publipostage+ ; cadres libres avant PowerPoint |
| Barre d'outils de Publipostage+ gelée : aucun bouton de plus | 12/10 | Dans Publipostage+, l'entrée de l'explorateur est « Organiser » |
| **Isolement : chaque app dans un sous-cadre sans `allow-same-origin`** ; un domaine par app seulement si un audit l'exige. Critères du porteur : interopérabilité par GFS, bonne performance, code clair et modulaire, sécurité maximale | 16/10 | Rapport de l'étape 2, section 3 ; trois prix, chacun à un seul endroit : stockage par le kit, impression de Publipostage+ par sa propre page, lien e-mail dans un nouvel onglet |
| **Les apps installées se retiennent dans une table du document** (`GFS_Rangement`), créée avec l'accord de la personne | 16/10 | Contrats 6.4 et 7.4 : l'installation s'enregistre tout de suite, sans « Enregistrer », et vaut pour tout le document |
| **Ouvrir le fichier cliqué : une petite porte dans l'app** (l'`ouverture` du contexte et l'appel `ouvrir`) | 16/10 | Consigne 010 à Publipostage+ ; contrats 5.2, point 3, et 5.4 |
| **Deux environnements séparés** : les dépôts de développement (`lombre33`) et les dépôts publics (`grist-factory`) ; le GFS public référence les seconds, où le porteur ne pousse que des versions propres | 16/10 | Section 4.2 ; question 1 tranchée |
| **Premier client du kit commun : Form+**, et non Automation+, trop éloigné du périmètre de Publipostage+ | 16/10 | Sections 4.5 et 10 (étape 3, lancée et livrée le 21/10) |
| **Les six bibliothèques de l'écriture en direct de Publipostage+ : un seul fichier module, assemblé par GFS**, qui laisse en noms nus les bibliothèques natives de l'app (son éditeur) ; la copie de GFS d'abord, le CDN une fois l'adresse publique fixée | 16/10 | Section 4.7 ; contrats 2.6 (points 8 à 11) et 5.2 ; consigne 012 à Publipostage+ |
| **Le CDN de ce fichier assemblé : jsDelivr, qui le sert depuis le dépôt public de GFS, à un commit épinglé** ; l'adresse change avec le dépôt définitif, et chaque app qui l'accueille la nomme dans sa CSP | 19/10 | Section 4.7 ; contrats 2.6 (point 11) ; consigne 016 à Publipostage+ |
| **Un seul choix de langue pour GFS et toutes ses apps** : « Comme Grist » (par défaut), Français ou English, retenu sur le navigateur, suivi par les apps ouvertes | 20/10 | Contrats 1.3, 5.2 (point 6) et 5.3 (point 4) ; section 5.7 ; consigne 019 à Publipostage+ |
| **Licence : GNU GPL version 3 dans tous les dépôts de la suite** (GFS, kit, apps, outil d'audit) ; le code d'un tiers garde sa licence, compatible (MIT, BSD, Apache 2.0) | 21/10 | `LICENSE` (texte officiel) à la racine de chaque dépôt, `GPL-3.0-only` dans les `package.json` ; guide des apps, section 1.3 ; consignes à Form+ (Apache 2.0 jusque-là) et à Automation+ (fichier absent) ; l'outil d'audit (MIT jusque-là) : le porteur a dit oui le 21/10, message à coller dans le projet de l'outil |
| **Épingler, ranger et renommer un fichier se font dans l'explorateur de GFS, avant d'ouvrir aucune app** : favoris et dossiers dans `GFS_Rangement` ; renommer écrit le nom seul dans la table de l'app (« Oui, le nom seul ») ; dupliquer et supprimer restent à l'app, grisés dans l'explorateur | 21/10 | Contrats 6.3 (point 2) et 6.4 (points 7 et 8) ; guide des apps, section 1.2 (point 10) ; consignes à Publipostage+ et à Form+ (relire le nom avant d'enregistrer) |
| **Les droits des personnes sont ceux de Grist, jamais un verrou d'interface** : seul Grist arrête une personne ; les règles de GFS sont des règles d'accès de Grist, que GFS pose depuis un widget ouvert par un propriétaire du document | 21/10, 12 h 35 | Contrats 11.1 et 11.5 ; faits vérifiés, section 10 (10.1 et 10.4) |
| **Deux zones** : les tables de données restent à Grist (GFS n'y guide rien et n'y pose aucune règle) ; les tables que GFS et les apps créent sont encadrées | 21/10, 16 h 45 | Contrats 11.1 et 11.2 (les classes de tables dans `gfs.json`) ; guide des apps |
| **Un « responsable d'espace »** : une personne sans les grandes fonctions qui gère les **membres et le contenu de son espace** (dossier ou autre) | 21/10, 17 h 52 | Contrats 11.3 et 11.4 ; la table `GFS_Espaces` ; consigne 031 à Publipostage+ |
| **Changer qui voit quoi ne doit pas recharger Grist pour tout le monde** : les règles se posent une fois, et les droits varient avec des données (membres, responsables, visibilité), jamais avec une table d'appareillage qui touche les règles | 22/10, 5 h 26 | Contrats 11.4 (colonnes d'aide `GFS_…`) ; faits vérifiés 10.6 : seule une action sur les tables de règles recharge tout le monde |
| **Le contrat des permissions (version 0) est écrit, sur papier seulement** : aucun code de GFS avant les mesures sur le Grist du porteur ; la case « structure fermée » reste à trancher (carte ouverte) | 22/10, 7 h 42 | Contrats 11 ; faits vérifiés 10.10 ; consigne 031 à Publipostage+ (à lire maintenant, à faire au lot de l'étape 5) |

Si un fait nouveau remet en cause une de ces lignes, le dire au porteur avec ce fait, sur une carte de décision. Ne jamais
proposer l'inverse de son propre chef.

---

## 3. Exigences

Numérotées pour que les tests les citent (« 3.1, point 4 »).

### 3.1 Fonctionnelles

1. Installer, désinstaller une app ; activer, désactiver une extension. Désinstaller ne supprime aucune donnée.
2. L'explorateur liste les fichiers des apps installées, d'après leurs manifestes : nom, type (icône et mot, plus la couleur
   pour document, grille et présentation), dossier, date de modification. On y parcourt, cherche, filtre par type, trie.
   La recherche est celle de Publipostage+ : des mots dans n'importe quel ordre, accents, casse et ponctuation ignorés.
3. Ouvrir un fichier active son app sur ce fichier. Un fichier dont l'app n'est pas installée est listé grisé, avec
   « Installer ».
4. On passe d'un fichier ouvert à l'explorateur et on revient au même fichier, tel qu'on l'a laissé (« Retour », Échap).
5. Ouvrir le fichier d'une autre app ferme d'abord l'app active par l'action « fermer » : si elle a des modifications en
   attente, elle pose sa question (Enregistrer, Abandonner, Annuler) et « Annuler » laisse tout en place.
6. « Nouveau » crée un fichier de n'importe quel type des apps installées ; il se range dans le dossier courant.
7. Ranger : dossiers et favoris communs à toutes les apps, dans une seule table de GFS. Le rangement propre à une app (les
   dossiers personnels de Publipostage+) reste valable.
8. Une fonction qui demande une extension non active est grisée, jamais cachée. Dans GFS, un clic ouvre l'installation ;
   dans l'app seule, un clic explique comment passer à GFS (guide des apps, section 5).
9. À l'arrivée, GFS ouvre l'app de la section, puis l'app applique son propre ordre d'arrivée (section 6.2).
10. Un compte Lecteur de Grist voit tout en lecture : rien ne s'installe, rien ne s'écrit, les gestes d'écriture sont grisés.
11. Toute l'interface existe en français et en anglais ; ce que GFS écrit dans le document suit la langue de l'interface. La
    langue est un seul choix par personne, pour GFS et pour toutes ses apps (section 5.7).
12. Tout tient et se manie dans un panneau de 700 × 400, à la souris et au clavier (Tab, Échap), en thème clair et sombre.

### 3.2 Sécurité

1. Chaque app tourne dans un sous-cadre `sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"`,
   **sans** `allow-same-origin` (liste exacte confirmée par le prototype, section 9).
2. GFS est le seul à parler à Grist. Le courtier relaie et filtre d'après le manifeste : tables lisibles, tables modifiables,
   niveau d'accès maximal. L'écriture des tables internes de Grist (`_grist_*`) est refusée sauf déclaration.
3. GFS ne charge jamais de code depuis une adresse lue dans des réglages, une table ou un message : le code des apps vient
   des sous-modules publiés avec GFS.
4. Une app ne peut changer ni l'accès de la section, ni les réglages des autres apps, ni ses propres permissions.
5. Toute bibliothèque tierce figure dans une liste, à une version exacte, avec son empreinte quand le CDN le permet : celle
   de son app si elle est native, celle de GFS si elle est non native (4.7).
6. GFS et chaque app ont une politique de sécurité du contenu (CSP) stricte.
7. Aucune page de démonstration ni de test n'est publiée sur l'origine de production.
8. Le courtier reste petit (quelques centaines de lignes), sans bibliothèque, couvert par ses propres tests.

### 3.3 Audit et maintenance

1. Chaque dépôt public s'audite seul avec `grist-widget-audit` (dépôt `lombre33/Grist-widget-audit`). L'outil compte ce
   qu'atteignent les pages d'entrée du dépôt (`index.html` et celles d'un `manifest.json`), en un seul ensemble.
   Seuils : 4 000 lignes exécutées (mineur) et 12 000 (majeur) pour la règle B-VERB-01 ; fichier de plus de 600 lignes de
   code, fonction de 81 lignes ou plus, complexité au-dessus de 15 (`faits-verifies.md`).
2. Le code d'une extension n'est pas atteint depuis la page d'entrée de l'app seule si l'app le charge par une adresse
   calculée : l'outil lit un `import()` dont le chemin commence par un texte fixe, il ne lit pas une adresse calculée (mesuré
   à l'étape 2 : avec une adresse calculée, 2 fichiers sur 3 dans la surface et les défauts de l'extension, un `eval` et un
   `innerHTML`, n'apparaissent pas ; avec un chemin à début fixe, 3 sur 3, défauts rapportés). Garder les extensions hors de
   la surface comptée a donc un prix : leur code n'est relu par aucun audit. Question 12.
3. Aucune duplication entre dépôts : ce qui sert à deux apps va dans le kit.
4. Une seule liste des bibliothèques natives par app, et la liste de GFS pour les non natives. Import map, CSP, empreintes,
   miroir des tests et version vendorisée en sont tirés par un outil, jamais tenus à la main. Le dépôt d'une app ne garde
   rien d'une bibliothèque d'extension : ni liste, ni import map, et dans sa CSP que l'adresse du mode CDN.
5. Dependabot surveille la liste de chaque app et celle de GFS (`npm` : versions et failles), et les sous-modules
   (`gitsubmodule` : versions).
6. Un audit clone avec `--recurse-submodules`.

### 3.4 Interface (charte Grist Factory)

La charte complète est `contexte/charte-ui-ux-grist-factory.md` ; sa section 1 vaut pour tout widget et se lit en entier
avant toute interface. L'essentiel :

- Base de gris et **un seul bleu d'accent** ; rouge et ambre seulement pour un sens (erreur, attention). Toute couleur passe
  par les jetons de la charte (`--bg`, `--surface`, `--text`, `--accent`…), jamais en dur.
- **Contraste de 4,5:1 au moins**, en clair comme en sombre : texte rouge en `--danger-ink` (jamais `--danger`), bouton
  plein à texte blanc en `--accent-solid`, texte d'accent sur fond teinté en `--accent-ink`.
- **Police du système** (`--font-ui`, qui commence par `system-ui`) ; jamais une police chargée depuis un autre site. Le
  thème sombre ne change que l'interface, jamais le contenu produit.
- **Icônes SVG au trait**, en `mask-image` ; ni emoji ni police d'icônes ; une icône = une fonction.
- **Grisé, jamais masqué**. On ajoute, on ne retire rien sans l'accord du porteur.
- **Fenêtres** sur une seule base (titre et boutons fixes, seul le contenu défile ; largeurs 400, 480 ou grande ; voile
  `--pp-scrim` ; clavier piégé dans la fenêtre). Saisies et confirmations par des fenêtres du widget, jamais `prompt()`
  ni `confirm()`.
- **Couches** : le dernier menu ouvert passe au-dessus (`Layers.raise`, jetons `--z-*`, aucun `z-index` en dur).
- **Tout choix** de colonne, de table, de modèle ou de fichier passe par la liste avec recherche.
- **Panneau de 700 × 400** ; vérifié à la vraie souris et au vrai clavier, en clair et en sombre, en français et en anglais.
- **Français et anglais dans le même lot** ; « modèle », jamais « template » ; pluriels par `{n|singulier|pluriel}` ; le
  vide d'une liste s'écrit « — Choisir … — ».
- Marque **Grist Factory** (jamais le nom d'un compte GitHub personnel) ; logo discret en haut à droite.

### 3.5 Performance

1. Ouvrir une app dans GFS ne doit pas se voir plus lent qu'ouvrir l'app seule : le coût d'un cadre de plus se mesure au
   prototype dans 700 × 400, et le seuil se fixe alors.
2. Une extension et ses bibliothèques ne se chargent qu'au premier usage, comme les moteurs d'export de Publipostage+
   aujourd'hui.

---

## 4. Architecture

### 4.1 Quatre couches

```
Kit commun ........ versionné, sans bibliothèque tierce
  référencé (sous-module) par
Apps .............. une par dépôt public, complète, autonome ; une liste unique de ses bibliothèques natives
  + Extensions .... fonctions à bibliothèque lourde : code dans extensions/ de leur app, bibliothèque à GFS
  référencées (sous-modules) par
GFS ............... courtier, explorateur, installation, références aux versions des apps ; porte les bibliothèques non natives
```

- Le kit n'importe rien. Une app importe le kit, jamais une autre app. Une extension importe son app et le kit, jamais une
  autre extension.
- GFS importe le kit et référence les apps ; il ne charge leur code que dans des sous-cadres.
- Une app seule, c'est son socle natif. Ses extensions ne s'activent que dans GFS.
- **Le code d'une fonction reste dans l'app, la bibliothèque non native est à GFS** (décision du 14/10) : le dépôt d'une app
  reste propre et auditable, sans la liste ni l'import map de la bibliothèque d'une extension ; sa CSP n'en garde que l'adresse du
  mode CDN (4.7).

### 4.2 Dépôts, adresses et publication

- **Dépôts de développement** (compte `lombre33`) : un par app, un pour le kit, un pour GFS. Noms : `grist-widget-GFS`
  pour GFS (créé le 14/10) ; `grist-factory-kit` pour le kit (créé le 21/10, public, GPL 3.0).
- **Dépôts publics** (organisation `grist-factory`) : fabriqués par un outil d'envoi comme `outils/depot-propre/` de
  Publipostage+ (il ne copie que ce qui se publie, refuse un prénom, un lien de session, un secret, et ne pousse jamais),
  puis poussés par le porteur depuis sa machine. Aucune session cloud ne pousse sur `grist-factory`.
- **Sous-modules** : GFS a un dossier `apps/<id>` par app, qui pointe sur un commit du dépôt de l'app ; chaque app a un
  dossier `kit/` qui pointe sur une étiquette du kit. Adresses `https://` de dépôts publics : ce sont les seuls que Pages
  récupère, sous-modules imbriqués compris.
- **Dépôt public de GFS** : chaque sous-module y pointe vers le **dépôt public** de l'app, à son étiquette publiée. Les
  commits d'un dépôt public ne sont pas ceux du dépôt de développement : l'outil d'envoi de GFS fait la correspondance.
- **GitHub Pages** construit le site de GFS avec ses sous-modules ; une app y est servie à `…/apps/<id>/`. Pages répond
  `Access-Control-Allow-Origin: *` et met en cache 10 minutes, sans adresse par version : tout fichier modifié monte son
  `?v=` dans la page qui le charge. Pages ne sert aucun fichier ni dossier dont le nom commence par « _ » ou « . ».
- **Mettre une app à jour dans GFS** : avancer sa référence (une ligne). Dans le dépôt de développement, chaque avance est un
  commit relu, car les apps y sont en chantier. Dans le GFS public, la référence va vers la version que le porteur a publiée
  dans le dépôt public de l'app : son push vaut feu vert et le dépôt public ne reçoit que des versions propres (décision du
  16/10, question 1). Dependabot le propose.
- **L'adresse vivante** d'une app (sa dernière publication, sans référence figée) sert seulement à un canal de test, jamais
  à un client dont le RSSI veut une version fixe.

### 4.3 Le courtier

**Ce que dit le code de Grist** (branche principale de `grist-core`, lue le 14/10 ; détail et lignes :
`faits-verifies.md`) :

- Grist crée le cadre du widget sans `sandbox` et n'accepte que les messages venus de ce cadre ; il répond par
  `postMessage(msg, "*")`.
- Le script d'API d'un widget envoie à `window.parent` et écoute `window.onmessage` sans vérifier l'expéditeur. **Une app
  dans un sous-cadre de GFS parle donc à GFS, qui relaie vers Grist, sans que l'app change.**
- L'accès (aucun, lecture de la table, complet) vaut pour tout le cadre : tout ce qui tourne dans le cadre de GFS a l'accès
  accordé à GFS. Seul le courtier peut restreindre une app.

**Ce qu'il fait** :

- **Relayer** l'API de Grist dans les deux sens. Le protocole est celui de `grain-rpc` 0.1.7 : `mtype` 1 = appel (`iface`,
  `meth`, `args`, `reqId`), 2 = réponse, 3 = erreur, 4 = message, 5 = prêt. Une app appelle `GristDocAPI@grist` (tables),
  `GristView` (lignes de la section), `WidgetAPI` (réglages de la vue), `CustomSectionAPI` (`configure`, mappage) et
  `CommandAPI` ; Grist appelle chez le widget `print` et `editOptions`.
- **Renuméroter** : GFS et l'app numérotent chacun leurs appels à partir de 1 ; le courtier donne un numéro unique à ce
  qu'il relaie et rend chaque réponse au bon cadre (déduit du protocole, à confirmer au prototype).
- **Filtrer** d'après le manifeste de l'app active :
  - lecture (`fetchTable`, `fetchSelectedTable`…) : seulement les tables lisibles déclarées ;
  - écriture (`applyUserActions`) : tout le lot est refusé si une action vise une table non déclarée, ou une table `_grist_*`
    non déclarée (comme Grist, qui rejoue un lot en entier ou pas du tout) ;
  - réglages de la vue : `getOption` et `setOption` ne touchent que les clés déclarées par l'app ; `setOptions` et
    `clearOptions` sont ramenés à ces clés (Form+ appelle aujourd'hui `setOptions` avec tout son objet) ;
  - `configure` (envoyé par `grist.ready()`) n'est pas relayé tel quel : GFS déclare lui-même l'accès de la section ; le
    mappage des colonnes d'une app se tranche au prototype.
- **Fournir ce que l'isolement retire** : le contexte (instance, document, page, section, langue, thème, lecture seule,
  extensions actives, raison de l'ouverture) à la place de `document.referrer` ; un stockage par app à la place de
  `localStorage` ; l'impression (`print` relayé à l'app active) ; les actions communes (section 5.2).
- **Ne parler qu'aux siens** : GFS n'accepte un message que si sa source est le sous-cadre de l'app active (la règle de
  Grist) ; côté app, le kit écoute par `addEventListener('message')` et vérifie `event.source === window.parent`. Jamais
  `window.onmessage =` dans une app : cette affectation remplacerait l'écoute du script d'API de Grist.
- **Messages propres à GFS** : sans `mtype` (le script d'API de Grist les ignore), ou par une interface `gfs` du même
  protocole. À choisir à l'étape des contrats.

**Une app active à la fois** par section GFS. Une app qui doit tourner en fond (Automation+) : une section à part pour
commencer, ou un sous-cadre gardé ouvert et caché (question 4, section 12).

### 4.4 L'explorateur

- C'est la seule fonction propre à GFS. Il lit, en lecture seule, les fichiers de chaque app installée d'après son manifeste
  (table ; colonnes de l'identifiant, du nom, du type, du dossier, de la date ; lignes réservées exclues).
- Ouvrir un fichier, c'est activer l'app sur ce fichier (action « ouvrir »). Il sert aussi en **mode choix** (action
  « choisir »), filtré par types : diapositives à réutiliser, modèles d'une règle, tableau de bord à insérer.
- Le rangement commun (dossiers, favoris) tient dans **une seule table de GFS** (nom proposé : `GFS_Rangement`), créée
  seulement avec l'accord de la personne (la question « Créer les tables du widget dans ce document ? » de Publipostage+,
  reprise par le kit). Sa forme s'écrit avec les contrats.
- Interface : la maquette et la page « Parcours » (`maquettes/`). Volet des dossiers à gauche (172 px), liste à droite ;
  sous 520 px de large environ, le volet se replie et il reste le fil d'Ariane ; Récents et Favoris toujours visibles ;
  vignettes plus tard (d'abord icône du type et deux lignes de début de texte).

### 4.5 Le kit commun

- **Contenu** : accès à Grist (une fabrique paramétrée par un espace de noms, comme `shared/grist-api-core.js` de Slides+),
  traduction (`I18n.t` et ses pluriels), thème et jetons de la charte, fenêtres (`ModalBase`, `Dialogs`), liste avec
  recherche, empilement des couches (`Layers`), consentement à la création des tables, rappel « Enregistrer » des réglages
  de la vue, registre des extensions et dessin du grisé, client du courtier (contexte, stockage, actions), garde « préserver
  l'inconnu », gabarit de CSP, outil de la liste des bibliothèques.
- **Règles** : aucune bibliothèque tierce ; versionné par étiquettes ; chaque app le **référence** en sous-module (`kit/`),
  sans copie. Un changement du kit est une nouvelle version ; Dependabot propose ensuite la mise à jour dans chaque app.
- **Seul et dans GFS** : chaque fonction du client du courtier a un repli quand l'app tourne seule (contexte lu dans Grist,
  stockage du navigateur dans un `try/catch`, « choisir » par la liste avec recherche, actions vers une autre app grisées
  avec le texte commun).
- **Point de départ** : extraire de Publipostage+, le code le plus mûr et déjà conforme à la charte. Premier client :
  **Form+** (choix du porteur, 16/10 : Automation+ est trop éloigné du périmètre de Publipostage+), puis Publipostage+,
  Automation+, Grist-BI. Relevé du 14/10 (`d3c8475`) : Form+ est une preuve de concept d'environ 2 300 lignes en modules ES,
  sans bibliothèque (un script de QR code à lui), mais sans traduction (français seul), avec les fenêtres du navigateur
  (`prompt` et `confirm`) et sa propre palette : l'étape 3 les lui apporte, au lieu de seulement remplacer des copies comme
  chez Automation+.
- **V0.1 (21/10)** : dépôt `lombre33/grist-factory-kit`, version `v0.1.0` (commit `54c48f3`, mode d'emploi : son
  `README.md`). Au périmètre de ce que demande le premier client : les jetons de la charte (clair et sombre), le thème, la traduction français / anglais
  avec ses pluriels, les fenêtres (`ModalBase.create`), les saisies et confirmations (`Dialogs`), les couches (`Layers`) et
  deux petits outils (`h`, et une garde « un module, une adresse »), en modules ES et deux feuilles de style, sans
  bibliothèque. Mesuré : 38 essais sous Node et plus de 200 vérifications dans Chromium à 700 × 400, à la vraie souris et au
  vrai clavier, en clair et en sombre, en français et en anglais, sous la CSP d'une app hébergée. Le reste de la liste
  ci-dessus vient par lots, quand une app en a besoin : le client du courtier (contexte, stockage par app, identité), la
  liste avec recherche et les icônes, le texte commun du grisé, `ModalBase.adopt` (que Publipostage+ emploie) ; l'outil des
  bibliothèques est celui de l'étape 4. Essayé sur une copie de Form+ (`2c0ee50`) : sa suite de 536 essais reste verte en
  français et en anglais ; la consigne est la 005. Appris : la couleur qu'une personne choisit pour son formulaire se pose
  sur la zone du formulaire, jamais sur `<html>`, sinon elle gagne l'écran du concepteur et les fenêtres du kit.
- **Livrée le 21/10 : Form+ tourne avec le kit** (consigne 005 faite à `952fe4c`, relue et mesurée par GFS) : `kit/` est un
  sous-module au commit `54c48f3`, ses jetons, ses fenêtres, son thème et sa traduction française et anglaise viennent du kit,
  plus de `prompt` ni de `confirm` ; ses 542 essais passent en `fr-FR` et en `en-US` (rejoués par GFS) ; son widget, posé tel
  quel dans un vrai Grist à 700 × 400, passe 25 vérifications par combinaison (français et anglais, clair et sombre), sans
  échec. Restent : l'étiquette `v0.1.0`, que le porteur pose (le cloud de GFS ne pousse pas d'étiquette) ; deux ombres en dur
  chez Form+ (consigne 006) ; le client du courtier, la liste avec recherche et le texte commun du grisé, qui viennent par lots.
- **V0.2 (21/10, soir) : le client du courtier** (choix du porteur, « Dans le kit ») : `js/gfs-link.js`, commit `c0c8660`,
  d'après celui de Publipostage+ (`487d66b`), avec la barre de GFS et le stockage par app : le contexte, l'ouverture et l'appel
  « ouvrir », la langue, la barre, les choix de la personne, les extensions et « installer » ; seule, l'app ne parle à personne.
  Mesuré : 56 essais sous Node, dont 18 pour le lien, et 209 vérifications dans Chromium, dont le cadre d'une app isolé comme
  chez GFS face à une page qui joue GFS. Form+ le reprend par la consigne 010 ; GFS ouvre alors sa porte « ouvrir ». Restent
  hors du lien : l'identité, « choisir » et « insérer ». L'étiquette `v0.2.0`, comme la `v0.1.0`, est à poser par le porteur.

### 4.6 Les extensions

| Extension | App | Où on en est (14/10) |
|---|---|---|
| Graphique | Publipostage+ | Existe : ≈ 820 lignes, 3 fichiers ; 4 fichiers le citent. Plotly, chargé au premier graphique, passe à GFS (4.7). **C'est le pilote.** |
| Diapositives (type « présentation ») | Publipostage+ | Conçu : une diapositive est une page 16:9 du même éditeur, bande de miniatures, « Présenter », « Réutiliser » (`contexte/etude-slides-explorateur-parcours-2026-10-12.md`, sections 3 et 4) |
| Écriture en temps réel | Publipostage+ | Essai isolé en ligne (`prototypes/edition-live/` du dépôt) : TipTap et Yjs, transport par une table Grist, ≈ 90 ms d'un cadre à l'autre quand la table est celle de la section ; dans GFS, la table du direct est une autre table que celle de la section : Grist ne la pousse pas, l'app la relit toutes les 250 ms, 125 ms de plus en moyenne (contrats 5.5) ; six bibliothèques en un seul fichier assemblé (4.7) ; impact : `contexte/edition-live-impact-2026-10-13.md` |
| PowerPoint et formats Office | Publipostage+ | À l'étude : cadres libres d'abord ; import par le convertisseur d'OnlyOffice en WebAssembly (licence AGPL à lire) ; étude sur cinq vraies présentations proposée |

- Une extension **déclare ses points d'entrée** (bouton, ligne de menu, type de fichier, export) ; le socle de l'app dessine
  le grisé. Un seul code pour tous : dans la maquette du 12/10, une seule extension absente touche huit endroits.
- Absente, une extension ne fait rien disparaître : ce qu'elle a créé reste enregistré et s'affiche grisé.
- **Le code d'une extension reste dans le dépôt de son app ; sa bibliothèque est portée par GFS** (4.7). L'extension la reçoit
  de GFS quand elle est active, et ne la nomme ni dans la liste, ni dans l'import map de l'app ; la CSP de sa page n'en garde que
  l'adresse du mode CDN.

### 4.7 Dépendances : CDN par défaut, vendorisé pour les RSSI

- **Deux listes, aucune copie permanente.** Celle de l'**app** : un `package.json` à la racine, versions exactes, pour ses
  bibliothèques natives. Celle de **GFS** : les bibliothèques non natives, celles des extensions. Pour Publipostage+, la liste
  de l'app existe déjà (`dev-tests/.offline-cache/package.json`, 45 paquets), tenue à la main à côté de l'import map et de la
  CSP ; Plotly, la bibliothèque du graphique, en sort et passe à la liste de GFS.
- **La partie dépendance d'une extension est à GFS** (décision du porteur, 14/10, pour que les dépôts des apps restent
  propres et auditables). L'extension déclare dans son entrée du manifeste ce que son code exige (un identifiant et une
  version exacte, par exemple `plotly` 2.13.2) ; GFS tient la liste, les adresses CDN et leurs empreintes et la version
  vendorisée, et donne à l'extension active la source à charger ; l'adresse que la CSP de la page de l'app doit laisser entrer, en
  mode CDN, est celle de son catalogue. Le code qui se sert de la
  bibliothèque (la façon dont Publipostage+ gère ses graphiques) reste dans l'app. L'app n'a pas à connaître l'adresse : elle
  demande la bibliothèque à GFS par son `GFS-ETAT.md` et ne pousse jamais dans le dépôt de GFS (décision du porteur, 14/10 ;
  `consignes/LISEZ-MOI.md`, « Demander à GFS »).
- **Natif ou non** : une bibliothèque est native quand l'app ne marche pas seule sans elle. Confirmé par le porteur (14/10) :
  l'éditeur et les exports restent natifs, avec leurs bibliothèques dans la liste de l'app.
- **Un outil en tire** : les adresses CDN et leurs empreintes SRI, l'import map, la CSP du mode CDN, le miroir des tests, et
  la **version vendorisée** (fichiers téléchargés, empreintes vérifiées, licences listées dans `NOTICE`, CSP
  `script-src 'self'`). L'outil du kit le fait pour la liste d'une app, celui de GFS pour la liste de GFS. Les fichiers
  produits sont commités : la page servie n'a besoin d'aucune construction.
- **La version vendorisée** se fabrique à chaque version, jamais retouchée à la main. Elle se livre en archive à héberger
  chez soi, ou à une adresse à part ; jamais comme deuxième page d'entrée du même dépôt public (l'outil d'audit
  additionnerait les deux). Pour les bibliothèques de GFS, elle se fabrique de même depuis la liste de GFS, jamais comme une
  copie permanente de son dépôt.
- **Le choix CDN ou vendorisé d'une extension se fait dans GFS**, à son activation (V0.2 du prototype). Mesuré à l'étape 2
  (question 11, répondue le 14/10 : « CDN d'abord ») : la copie de GFS passe sous `script-src 'self'` sans que l'app nomme rien ;
  le CDN ne passe que si la CSP de la page de l'app laisse entrer son adresse, car GFS ne peut imposer aucune politique à un
  sous-cadre. Chaque app qui accueille une extension nomme donc dans sa CSP l'adresse du catalogue de GFS (contrats 2.6 et 5.2).
- **Une faille** se corrige pareil dans les deux modes : en changeant de version dans la liste, puis l'outil régénère tout.
  Dependabot (`npm`) donne les alertes et propose les mises à jour de sécurité.
- **esm.sh** reste l'exception du mode CDN : il reconstruit ses fichiers, aucune empreinte n'y est possible, et c'est là que
  sont les 69 bloquants de l'audit de Publipostage+ du 04/10. À terme : TipTap et ProseMirror construits une fois en un seul
  fichier, servi par jsDelivr depuis un dépôt à une version étiquetée, avec empreinte (question 2, section 12).
- **Un fichier assemblé quand les bibliothèques d'une extension doivent partager l'éditeur de l'app** (choix du porteur, 16/10,
  écriture en direct de Publipostage+) : GFS construit un seul fichier module, empreinte comprise, qui laisse en noms nus l'éditeur
  natif de l'app (une seule copie de ProseMirror : avec deux, le curseur des autres disparaît sans erreur). L'app n'en nomme aucun
  paquet. La copie de GFS d'abord ; depuis le 19/10 (choix du porteur), le CDN est jsDelivr, qui sert ce fichier depuis le dépôt public de
  GFS à un commit complet épinglé dans la liste de GFS (contrats 2.6, points 8 à 11). L'adresse suit le dépôt : celle du dépôt de
  développement aujourd'hui, celle du dépôt public définitif (question 5) quand il existera, par une consigne à chaque app.
- **Le script d'API de Grist** vient de `docs.getgrist.com` dans les deux modes (validé par la DINUM d'après le README
  d'Automation+).

Exemple de réglage Dependabot pour le dépôt de GFS (à adapter) :

```yaml
version: 2
updates:
  - package-ecosystem: "gitsubmodule"   # avance les références aux apps et au kit
    directory: "/"
    schedule: { interval: "weekly" }
  - package-ecosystem: "npm"            # liste des bibliothèques non natives, portée par GFS
    directory: "/"
    schedule: { interval: "weekly" }
```

---

## 5. Contrats (brouillon v0)

À écrire au propre en premier (étape 1 du plan) et à faire relire par le porteur avant tout code. Ce qui suit est le point
de départ, pas la version finale.

### 5.1 Le manifeste `gfs.json`

Un fichier `gfs.json` à la racine du dépôt de chaque app. Pas `manifest.json` : ce nom est celui des catalogues de widgets
de Grist, que l'outil d'audit lit comme des pages d'entrée.

| Champ | Contenu |
|---|---|
| `contrat` | Version du contrat GFS que l'app suit (GFS refuse, en la grisant, une app d'une version de contrat qu'il ne connaît pas) |
| `id`, `nom`, `version` | Identifiant court (`publipostage`), nom affiché en français et en anglais, version de l'app |
| `entree` | La page d'entrée (`index.html`) |
| `tables` | Le préfixe des tables possédées (`Publipostage_`) |
| `fichiers` | Pour chaque table de fichiers : la table, les colonnes (identifiant, nom, type, dossier, date), les types (valeur, nom, icône, famille de couleur) et les lignes à exclure (lignes réservées) |
| `reglages` | Les clés de réglages de la vue que l'app lit et écrit |
| `permissions` | Accès demandé ; tables lues ; tables écrites ; tables `_grist_*` écrites, avec la raison |
| `extensions` | Pour chacune : identifiant, nom, texte, poids, dossier, points d'entrée, bibliothèques exigées (identifiant et version exacte, sans adresse : elles sont à GFS) |
| `dependances` | Le chemin de la liste des bibliothèques natives de l'app (`package.json`) |
| `actions` | Ce que l'app accepte : « ouvrir » (types), « choisir » (types qu'elle sait montrer), « insérer » (ce qu'elle sait produire et recevoir) |

Exemple pour Publipostage+, d'après son code au 14/10 (`main` 92ecd58) :

```json
{
  "contrat": 0,
  "id": "publipostage",
  "nom": { "fr": "Publipostage+", "en": "Publipostage+" },
  "version": "1.0.0",
  "entree": "index.html",
  "tables": { "prefixe": "Publipostage_" },
  "fichiers": [{
    "table": "Publipostage_Modeles",
    "colonnes": { "id": "id", "nom": "Nom", "type": "TypeModele", "date": "DateModif" },
    "typeParDefaut": "document",
    "types": [
      { "valeur": "document", "nom": { "fr": "Document", "en": "Document" }, "couleur": "document" },
      { "valeur": "grille", "nom": { "fr": "Grille", "en": "Grid" }, "couleur": "grille" },
      { "valeur": "email", "nom": { "fr": "E-mail", "en": "Email" } },
      { "valeur": "macro", "nom": { "fr": "Macro-modèle", "en": "Macro template" } }
    ],
    "exclure": { "TypeModele": ["reglages"] }
  }],
  "reglages": ["modeleDeLaVue", "modeleSelonLigne", "droitsAcces", "dateDernierExport"],
  "permissions": {
    "acces": "full",
    "lit": ["*"],
    "ecrit": ["*"],
    "gristInterne": [{ "table": "_grist_Tables_column", "pourquoi": "colonne affichée d'une Référence créée par la galerie" }]
  },
  "extensions": [
    {
      "id": "graphique", "nom": { "fr": "Graphique", "en": "Chart" }, "dossier": "extensions/graphique/",
      "bibliotheques": [{ "id": "plotly", "version": "2.13.2" }]
    }
  ],
  "dependances": "package.json",
  "actions": { "ouvrir": ["document", "grille", "email", "macro"], "choisir": ["document", "grille"], "inserer": [] }
}
```

Publipostage+ lit toutes les tables (ses variables viennent de n'importe quelle table) et écrit hors de son préfixe sur un
geste de la personne (tables créées par la galerie, date du dernier export) : d'où `"*"`. Une app à portée étroite déclare
des listes courtes, et c'est là que le filtrage du courtier protège.

### 5.2 Les actions

| Action | Qui la demande | Ce qui se passe dans GFS | Ce qui se passe quand l'app est seule |
|---|---|---|---|
| **ouvrir** | l'explorateur, ou une app (« ouvrir ce fichier ») | GFS ferme l'app active si besoin (« fermer »), active l'app du fichier, lui passe le fichier et la raison de l'ouverture | l'app ouvre ses propres fichiers ; ceux d'une autre app sont grisés avec le texte commun |
| **choisir** | une app (réutiliser des diapositives, modèles d'une règle, tableau de bord à insérer) | l'explorateur s'ouvre en mode choix, filtré par types, et rend `{ app, id, nom, type }` ou rien si on annule | la liste avec recherche de l'app, sur ses propres fichiers |
| **insérer** | une app qui reçoit (un document reçoit un graphique de Grist-BI) | l'app qui fournit rend un **rendu portable** (image SVG ou PNG, ou une valeur) avec la référence de sa source ; l'app qui reçoit garde les deux | grisé, texte commun |
| **fermer** | GFS, avant d'activer une autre app | l'app répond « oui » quand elle peut fermer (après sa question d'enregistrement si besoin) ou « non » si la personne annule | sans objet |

Une app qui reçoit un rendu ne charge jamais le code de l'app qui l'a produit. Sans l'app source, le rendu reste affiché et
sa mise à jour est grisée. Une valeur simple (un chiffre) peut aussi se reprendre par la donnée, depuis la définition
enregistrée par l'autre app.

### 5.3 Les données

- Chaque app possède ses tables (préfixe déclaré) et n'écrit pas celles d'une autre, sauf contrat écrit.
- Schémas versionnés ; changements additifs seulement : jamais renommer ni supprimer une colonne.
- Tolérer les colonnes inconnues ; ne jamais écrire une colonne absente. Une seule `UpdateRecord` ou `AddRecord` sur une
  colonne inconnue annule tout le lot ; `AddColumn` sur un identifiant pris le renomme.
- Après un `AddTable`, relire l'identifiant réellement créé. Grist enlève les accents, remplace par « _ » tout ce qui n'est
  ni lettre ni chiffre, **retire les « _ » de tête**, met la première lettre en capitale, et numérote un nom déjà pris sans
  tenir compte de la casse (`Fournisseurs2`). Chaque `AddTable` crée aussi une page dans le document.
- Créer une table seulement avec l'accord de la personne, et préférer une ligne réservée d'une table existante (comme la
  ligne « réglages » de `Publipostage_Modeles`) à une table de plus.

### 5.4 Préserver l'inconnu

- Le socle de chaque app connaît la forme de tous ses objets, même ceux d'une extension absente. Un graphique dans un
  document ouvert sans l'extension s'affiche grisé et se réenregistre intact.
- Un type de fichier inconnu est listé grisé, jamais ouvert, jamais réenregistré, jamais proposé comme fichier de départ.
  Aujourd'hui Publipostage+ ouvre un type inconnu comme un document (`js/main.js`, `typeModeleOf`, ligne 330) et peut en
  faire son modèle de départ (`js/templates.js`, `canBeDocumentDefault`, ligne 451) : la garde se pose avant que quiconque
  écrive un nouveau type dans sa table (guide des apps, 2.2).

### 5.5 Les réglages de la vue

- Ils gardent ce qui se refait en un clic (le modèle de la vue, les règles d'ouverture, l'accès), jamais une définition
  (un formulaire, un graphe d'automatisation) : une définition vit dans une table.
- Chaque app déclare ses clés dans son manifeste ; les clés sont les mêmes seule ou dans GFS, et le courtier les transmet
  sans les renommer. Clés existantes gardées telles quelles ; toute clé nouvelle porte le préfixe de son app.
- Un réglage écrit par le widget n'est qu'un **brouillon** tant que la personne n'a pas cliqué « Enregistrer » dans Grist,
  et Grist ne prévient pas le widget de cet enregistrement (mesuré le 09/10 dans un vrai Grist). D'où le rappel
  « Enregistrer » du kit. Un widget ne doit jamais écrire un réglage sans geste de la personne : Grist afficherait
  « Enregistrer » pour rien.

### 5.6 Le contexte

- Une app ne déduit ni sa page, ni l'instance, ni le document de `document.referrer` ou de sa propre adresse. Elle les
  demande au kit, qui les lit dans Grist quand l'app est seule et auprès du courtier dans GFS.
- Raison de l'ouverture (« par la ligne… », « par la vue », « par le ★ », « à la main », « depuis l'explorateur ») : passée
  par GFS, affichée par l'app dans son coin d'état.
- Langue : celle que la personne a choisie dans GFS (sinon celle de Grist), donnée par le contexte et annoncée aux apps
  ouvertes par l'événement `langue` (contrats 5.2, point 6).

### 5.7 Le stockage du navigateur

- Dans un sous-cadre à origine opaque, `localStorage` lève une erreur. Le kit offre un stockage par app : une lecture
  immédiate dans une copie en mémoire, remplie au démarrage (par le navigateur quand l'app est seule, par le courtier dans
  GFS), et une écriture qui suit.
- **Fait le 21/10** (le porteur l'a demandé tout de suite) : GFS garde les choix de chaque app dans son propre navigateur,
  un espace par app (1 Mo au plus), les mêmes dans tous les documents de la personne sur ce navigateur ; pas d'un
  navigateur ou d'un ordinateur à l'autre, et les onglets déjà ouverts ne sont pas prévenus (contrats 5.3). Cela ne
  touche pas au document : cela marche en lecture seule.
- Un choix gardé par navigateur (thème, zoom, raccourcis) reste un confort : l'app marche sans lui.
- **La langue n'en fait plus partie** (décision du 20/10) : un seul choix par personne, gardé par GFS dans son propre
  stockage, que les apps lisent dans le contexte et suivent par un événement (contrats 5.2, point 6). L'app seule garde le
  sien.

---

## 6. Parcours et interface

### 6.1 Qui décide quoi

| | Décide | Précision |
|---|---|---|
| Grist | la page, la table, la ligne choisie, les droits | GFS et les apps les lisent ; ils n'y changent rien |
| GFS | les apps installées, l'app active, le lieu (fichier ouvert ou explorateur) | Une app active à la fois par section |
| L'app active | le fichier ouvert et son mode (édition, lecture) | L'espace de travail dépend du type du fichier, pas d'un onglet |
| Le document | les fichiers, le rangement, les réglages de la vue, les données | Les règles d'accès de Grist s'y appliquent ; un compte Lecteur est en lecture seule d'office |

### 6.2 Arrivée (proposition à valider avec les contrats)

1. GFS lit les apps installées dans `GFS_Rangement` (si la table existe) et les réglages de sa section : app de départ.
2. Sans app de départ, mais avec des clés de réglages qu'un manifeste déclare (la section servait à cette app seule), GFS
   ouvre cette app, sans rien écrire : c'est l'aller-retour sans perte. **Construit au prototype le 22/10** (décision du
   porteur, « comme avant GFS » : le modèle de la vue de Publipostage+, un document, une grille ou une présentation, s'ouvre
   à l'arrivée, comme dans l'app seule) : une clé compte quand elle a une valeur (`null` et le texte vide, par lesquels une
   app retire un choix, ne comptent pas) ; l'app doit être installée et l'accès que Grist a donné à GFS lui suffire ; avec
   deux apps servies par la section, GFS ne devine pas : l'explorateur. Contrats 7.4, point 7.
3. Sinon, une seule app installée : elle s'ouvre. Sinon : l'explorateur. *Pas codé au prototype : « une seule app
   installée : elle s'ouvre » (sans clé d'une app, l'explorateur, le plus prudent), ni le point 1 (rien n'écrit encore
   `gfs.depart`).*
4. L'app applique ensuite son propre ordre d'arrivée. Pour Publipostage+ : la ligne choisie si une règle la retient, puis le
   modèle de la vue, puis le ★ du document, sinon une page blanche (`js/main.js`, démarrage).
5. Une section neuve, sans rien : l'explorateur vide, qui propose « Installer une app ». Rien ne s'installe sans un geste.

### 6.3 Navigation

- Deux lieux dans le cadre : **le fichier ouvert** et **l'explorateur** ; par-dessus, des fenêtres (réglages, questions).
- **L'explorateur remplace le cadre**, et « Retour » ou Échap ramène au même fichier, tel quel : le sous-cadre de l'app
  reste vivant, caché, pendant qu'on explore.
- **Dans Publipostage+, l'entrée est « Organiser »** (en tête du sélecteur de modèle, déjà là) : sa barre d'outils est gelée.
  Une app sans équivalent reçoit du kit une entrée « Fichiers » à la place que sa charte prévoit.
- **GFS pose en plus, par-dessus l'app, une petite barre de trois boutons à icône seule** (« Fichiers », « Apps et extensions »,
  « Position de la barre »), que la personne place où elle veut : à gauche (par défaut), en haut, à droite ou en bas. Elle ne
  prend la place de personne : le cadre de l'app reste plein, et chaque app laisse libre, aux quatre bords, la petite zone que la
  barre recouvre et que GFS lui dit (contrats 5.2, point 7). Décision du porteur, 21/10 (question 7, section 12).
- Ouvrir un fichier d'une autre app : « fermer » d'abord (section 5.2).
- GFS n'ajoute aucune étape à l'historique du navigateur : « Précédent » reste celui de Grist.
- Deux sections GFS dans une page sont deux cadres indépendants : elles ne se parlent que par la ligne choisie de Grist.

### 6.4 Grisé et passage d'une app seule à GFS

- Dans GFS, une fonction dont l'extension n'est pas active est grisée ; un clic ouvre « Installer » à la bonne ligne.
- Dans l'app seule, un clic ouvre une fenêtre qui dit quoi faire : **changer l'adresse dans le champ du panneau de droite de
  Grist**, jamais en choisissant GFS dans la galerie, qui remet l'accès à « aucun » et efface les réglages de la vue.
  Texte proposé, en français et en anglais : guide des apps, section 5.

### 6.5 Couleurs par type (explorateur seulement)

| Type | Clair : icône · texte · fond de pastille · trait | Sombre : icône · texte · fond de pastille · trait |
|---|---|---|
| Document (le bleu d'accent) | `#2f6fed` · `#2558c4` · `#e8f0fe` · `#c7dbfd` | `#5b91f5` · `#74a3f7` · `#24324b` · `#35507d` |
| Grille | `#2e7d32` · `#1f6a24` · `#e7f4e8` · `#bfe0c2` | `#6cc57a` · `#8fd694` · `#16301a` · `#2c5a31` |
| Présentation | `#c7600a` · `#9a4a05` · `#fff0e0` · `#f6cc9d` | `#f0933e` · `#ffb06b` · `#3a2412` · `#6b4420` |
| E-mail, macro-modèle, et les types des autres apps | neutres | neutres |

- Seulement dans l'explorateur : icône de la ligne, pastille du type, vignettes, barre d'information, menu « Nouveau »,
  filtre de type. L'éditeur et le sélecteur de modèle de Publipostage+ restent monochromes.
- L'icône et le mot du type vont toujours ensemble : la couleur ne porte jamais seule le type.
- Texte coloré à 4,5:1 au moins sur son fond, icône à 3:1, en clair et en sombre. Le vert ne désigne que la grille, jamais un
  état (« enregistré », « actif »).
- Type dont l'app ou l'extension manque : cadenas, pastille grise, aucune couleur.
- Couleur des types des autres apps (formulaire, automatisme, tableau de bord, projet) : neutre tant que le porteur n'en
  demande pas (question 8, section 12). Les jetons se déclarent dans le kit, jamais en dur.

### 6.6 Les maquettes : ce qu'elles montrent, ce qui a changé depuis

Dans `maquettes/` (autonomes, sans réseau ; détail dans `maquettes/LISEZ-MOI.md`) :

- `maquette-widget-suite.html` (12/10, v3) : le widget entier dans 700 × 400 (explorateur coloré par type, document, grille,
  présentation, tableau de bord), « Réutiliser », « Présenter », la fenêtre des modules et les fonctions grisées, thème clair
  et sombre.
- `parcours-widget.html` (12/10) : le schéma d'ensemble (qui décide quoi, cas d'arrivée, navigation, cadre en blocs gris,
  quatre choix de parcours).
- `maquette-explorateur-slides.html` (12/10, v1) : première version, cadres libres et explorateur d'origine.

**Ce qui a changé le 14/10** : les maquettes montrent une « Suite » faite de modules dans un seul widget. Depuis, GFS fait
tourner des **apps** dans des sous-cadres. Restent valables : l'explorateur, les couleurs, le parcours, le grisé, le
700 × 400. Change : la « fenêtre des modules » devient l'installation des apps et des extensions de GFS, et un type absent
renvoie à l'installation de son app.

### 6.7 Choix de parcours en attente (un défaut pris pour chacun)

1. **L'explorateur remplace le cadre ou s'ouvre par-dessus ?** Défaut : il remplace le cadre, « Retour » ramène au même
   fichier. (La maquette v3 le montre encore en fenêtre avec « Agrandir ».)
2. **Rien ne désigne de fichier : page blanche ou explorateur ?** Défaut, pour Publipostage+ seul : page blanche, comme
   aujourd'hui ; dans GFS : l'explorateur quand aucune app ne s'impose (6.2).
3. **Dossiers d'équipe en plus du rangement personnel ?** Défaut : personnel d'abord ; un dossier d'équipe se retiendrait
   sur le fichier, pas dans les préférences.
4. **Une page Grist peut-elle s'ouvrir sur un dossier ?** Défaut : non pour l'instant ; une page ouvre un fichier.

---

## 7. Aller-retour entre une app seule et GFS

Quatre conditions, toutes nécessaires :

1. **Changer l'adresse dans le champ du panneau de droite de Grist**, jamais par la galerie : le champ garde les réglages de
   la vue et l'accès, la galerie les efface (`CustomSectionConfig.ts` contre `CustomWidgetGallery.ts`).
2. **Les définitions dans des tables** (5.5). Aujourd'hui, passer par la galerie ferait perdre leur définition à Form+ et à
   Automation+.
3. **Le contenu inconnu gardé intact** (5.4).
4. **Les mêmes clés de réglages** seule ou dans GFS (5.5).

Au retour vers l'app seule : elle retrouve ses tables et ses réglages ; ce qui vient d'une extension s'affiche grisé et reste
enregistré ; la table de rangement de GFS reste dans le document, inutilisée.

Un test de bout en bout le vérifie dans un vrai Grist, pour chaque app : seule, puis GFS, puis seule, sans perte.

---

## 8. Sécurité : enjeux et mesures

| Enjeu | Mesure |
|---|---|
| Tout le code du cadre de GFS a l'accès accordé, souvent « complet » | Sous-cadres isolés ; courtier qui filtre d'après le manifeste ; accès minimal déclaré par app |
| Du code qui change sans que GFS le voie | Références à un commit (sous-modules), avancées par une demande relue ; aucune adresse de code lue dans des réglages, des tables ou des messages. Tant que les essais servent le site en ligne des apps (22/10), la mesure ne vaut que pour la copie livrée : la page d'état de chaque app prévient des changements de contrat, et le filtre du courtier, qui lit le manifeste de GFS, refuse ce que l'app n'a pas déclaré |
| Bibliothèques tierces | Une liste par propriétaire (l'app pour ses bibliothèques natives, GFS pour celles des extensions), versions exactes, empreintes SRI ; Dependabot ; version vendorisée pour les RSSI ; esm.sh remplacé à terme par un fichier figé |
| Une seule origine pour tous les sites d'un compte GitHub (`lombre33.github.io`, `grist-factory.github.io`) : des pages de même origine partagent le stockage et, dans des cadres voisins, peuvent agir l'une sur l'autre | Sous-cadres sans `allow-same-origin` ; stockage par app ; aucune page de démonstration ni de test sur l'origine de production ; un domaine par app seulement si un audit l'exige |
| Écriture des tables internes de Grist (`_grist_*`) | Refusée par défaut ; déclarée et justifiée dans le manifeste (Form+ écrit `_grist_Views_section` ; Publipostage+ une fois `_grist_Tables_column`) |
| Apps sans CSP (Form+, Grist-BI) | Gabarit de CSP du kit, appliqué partout |
| Le courtier, nouvelle pièce critique | Petit, sans bibliothèque, tests dédiés, audité à chaque version |
| Messages d'un autre cadre | GFS ne lit que les messages de son sous-cadre actif ; le kit ne lit que ceux de son parent |
| Promettre trop | Pas de « cocher un module rend plus sûr » ; la sécurité se décrit par l'isolement et le filtrage, mesurés |

---

## 9. Prototype : à vérifier avant d'écrire GFS

À faire dans un dossier `prototype/` du dépôt de GFS, avec Publipostage+ et Automation+ **non modifiés** en sous-modules.
Les mesures se font dans un vrai Grist (labo `outils/labo-grist-reel/`, grist-static 0.1.6 dans Chromium), jamais contre un
faux Grist écrit par nous.

1. Le relais des messages avec les deux apps : prêt, accès, réglages, `onRecord`, `onRecords`, `docApi`, réponses et erreurs
   rendues au bon cadre.
2. `grist.ready()` de GFS et de l'app dans un même cadre : accès demandé, colonnes à mapper.
3. Impression, téléchargements (`<a download>` de Publipostage+), fenêtres surgissantes et liens `mailto:`, presse-papiers,
   plein écran, dans un sous-cadre isolé.
4. La CSP de l'app (`'self'`, CDN) et les modules ES dans un sous-cadre à origine opaque ; l'import map d'esm.sh ; la CSP de
   GFS lui-même (`frame-src 'self'` pour ses sous-cadres) ; la bibliothèque d'une extension (Plotly) reçue de GFS par adresse
   et empreinte, en CDN comme en vendorisé (question 11 ; mesuré : en CDN, la CSP de l'app doit nommer l'adresse du catalogue,
   en copie `'self'` suffit, rapport point 4).
5. Le stockage du navigateur indisponible en origine opaque : comportement des apps, stockage fourni par le courtier.
6. L'API REST de Grist par jeton (`getAccessToken`, pièces jointes) depuis un sous-cadre isolé. D'après le code de Grist,
   une origine non reconnue, `null` compris, reçoit `Access-Control-Allow-Origin: *` sans identifiants : le jeton passé dans
   l'adresse doit suffire, comme aujourd'hui depuis `github.io`.
7. Un site Pages de GFS construit avec une app en sous-module et le kit en sous-module imbriqué ; avec et sans `.nojekyll`.
8. Le coût d'ouverture d'un cadre de plus dans le panneau de 700 × 400.
9. L'outil d'audit sur une app avec un dossier `extensions/` non atteint par sa page d'entrée.
10. La version de Grist de l'instance visée (grist.numerique.gouv.fr) : le code lu est celui de la branche principale. Seul
    le porteur a accès à ses documents : la mesure se fait avec lui.

**Livrable** : un court rapport, mesure par mesure, et la décision d'isolement (sous-cadres, ou un domaine par app).
Rapport du 14/10 : `prototype/rapport.md` (les mesures qui demandent le navigateur ou le Grist du porteur restent à faire).

---

## 10. Plan de réalisation

Chaque étape se livre seule, avec ses tests, et attend le go du porteur avant la suivante.

| # | Étape | Livrable | Projet | Terminée quand |
|---|---|---|---|---|
| 1 | Contrats | `docs/contrats.md` dans le dépôt de GFS : manifeste, actions, données, réglages, contexte, stockage, protocole du courtier | GFS | Le porteur l'a relu et a dit go |
| 2 | Prototype du courtier | `prototype/` et le rapport de la section 9 | GFS | Les dix points mesurés ; isolement décidé |
| 3 | Kit commun v0 | Dépôt du kit, première étiquette ; Form+ le référence | GFS, puis Form+ | Form+ tourne avec le kit : fenêtres, traduction (français et anglais), thème et jetons viennent du kit, sans copie |
| 4 | Listes des bibliothèques | L'outil (dans le kit) ; `package.json` de Publipostage+ ; la liste de GFS pour les bibliothèques d'extensions ; Dependabot activé | GFS (outil, liste), Publipostage+ (adoption) | Import map, CSP, empreintes et miroir des tests régénérés à l'identique depuis la liste |
| 5 | Apps prêtes pour GFS | Garde « inconnu » ; définitions en tables ; contexte et stockage par le kit ; `gfs.json` | Chaque app (guide des apps) | L'aller-retour seule, GFS, seule passe dans un vrai Grist |
| 6 | GFS v0 | Références aux apps, courtier, explorateur, installation, texte du grisé | GFS | Exigences 3.1 à 3.3 couvertes par des tests ; audit de GFS sous les seuils |
| 7 | Extensions et nouvelles apps | Graphique (pilote), diapositives, temps réel, formats Office ; Dashboard, Thusday | Publipostage+, nouvelles apps | Chacune avec son étude et le go du porteur |

---

## 11. Qui fait quoi

| | Projet GFS | Projet de chaque app | Porteur |
|---|---|---|---|
| Contrats | écrit et tient à jour | relit ce qui le touche | décide |
| Kit, courtier, explorateur, outil des bibliothèques | code et teste | adopte le kit (sous-module) | — |
| Manifeste, garde « inconnu », définitions en tables, contexte et stockage par le kit | aide, fournit les tests du contrat | fait | — |
| Références des apps dans GFS | avance (après Dependabot) | publie ses versions | relit |
| Dépôts publics `grist-factory` | prépare l'envoi | prépare l'envoi | pousse depuis sa machine |
| Mesures dans son vrai Grist | prépare | prépare | les fait |

Quand un projet doit changer un fichier qu'un autre projet possède, il écrit sa proposition dans un fichier à part et la
fait passer par le porteur.

---

## 12. Questions à trancher (une carte au moment d'y aller, pas avant)

| # | Question | Quand | Conseil |
|---|---|---|---|
| 1 | Référence des apps : sous-module ou adresse vivante ? | Étape 2 | Sous-module ; l'adresse vivante pour un canal de test. **Tranché le 16/10 : sous-module** ; le GFS public référence les dépôts publics (`grist-factory`), et le push du porteur vaut feu vert (4.2). **Précisé le 22/10 (porteur : « servir les dépôts live, pas une copie figée »)** : les essais de GFS ouvrent chaque app sur son site en ligne par défaut, `live=0` ramène à la copie du sous-module, qui sert aussi de repli et aux mesures du labo ; ce que GFS livre à un client reste le sous-module (contrats 1.3, point 2) |
| 2 | TipTap en mode CDN : esm.sh, ou un seul fichier figé servi par jsDelivr avec empreinte ? | Étape 4 | Le fichier figé |
| 3 | Isolement : sous-cadres sans `allow-same-origin`, ou un domaine par app ? | Fin de l'étape 2 | Sous-cadres ; des domaines seulement si un audit l'exige. **Tranché le 16/10 : sous-cadres** (rapport, section 3) |
| 4 | Automation+ dans GFS : section à part, ou sous-cadre gardé en fond ? | Étape 6 | Section à part pour commencer |
| 5 | Où publier GFS et les apps ? | Avant la première publication | Organisation `grist-factory`, un dépôt public par app, un pour GFS, un pour le kit ; aucune page de test sur cette origine. Le 19/10, le CDN du fichier assemblé de l'écriture en direct pointe provisoirement le dépôt de développement ; il suivra le dépôt définitif. Le 21/10, le porteur garde les dépôts de `lombre33` tant que le code de GFS y est (les liens vers les apps et l'adresse du CDN comprises) et adaptera les liens à la bascule de GFS sous `grist-factory`, par une consigne à chaque app, sans date ; dépôt public de Publipostage+ : `grist-factory/Publipostage-Plus` |
| 6 | Dashboard et Grist-BI : deux apps, ou une ? | Au lancement de Dashboard | À préciser avec le porteur |
| 7 | Entrée de l'explorateur dans chaque app, ou un repère de GFS au-dessus des apps ? | Étape 6 | Dans chaque app (« Organiser » pour Publipostage+), sans barre de plus. **Reprise et tranchée le 21/10 : les deux.** L'entrée de chaque app reste, et GFS pose une barre de trois boutons à icône seule, que la personne place à gauche, en haut, à droite ou en bas ; elle recouvre un espace que les apps laissent libre, sans bande en plus (6.3, contrats 5.2, point 7) |
| 8 | Couleurs des types des autres apps | Étape 6 | Neutres tant qu'il ne les demande pas |
| 9 | Où retenir les apps installées : réglages de la section, ou une table pour tout le document ? | Étape 1 | Réglages de la section, avec le rappel « Enregistrer » ; une table seulement si le réglage doit valoir pour tout le document. **Tranché le 16/10 : une table pour tout le document** (`GFS_Rangement`, contrats 7.4) |
| 10 | Les quatre choix de parcours (6.7) | Étape 6 | Les défauts pris |
| 11 | Comment le sous-cadre reçoit la bibliothèque d'une extension (Plotly), comment sa CSP l'autorise en CDN comme en vendorisé (le dépôt de l'app n'en garde que l'adresse du CDN, mesuré), et où se retient le choix CDN ou vendorisé | V0.2 du prototype | Adresse et empreinte données par GFS, chargées par l'extension (contrats 5.2) ; la CSP se mesure d'abord. **Tranché le 14/10 : CDN d'abord ; chaque app nomme l'adresse du catalogue dans sa CSP** (rapport, point 4) |
| 12 | L'audit des extensions : les garder hors de la surface comptée de l'app (adresse calculée, code relu par personne), ou les compter (chemin à début fixe) | Étape 5 | Les auditer (chemin à début fixe) ; si un seuil de lignes saute, demander à l'outil d'audit de compter les extensions à part (rapport de l'étape 2, section 6) |

---

## 13. Sources

- Études et avis : `contexte/avis-architecture-gfs-2026-10-14.md` (avis complet du 14/10, avec ses preuves),
  `contexte/avis-modules-suite-2026-10-12.md`, `contexte/etude-slides-explorateur-parcours-2026-10-12.md`,
  `contexte/edition-live-impact-2026-10-13.md`.
- Faits vérifiés, avec fichier et ligne : `faits-verifies.md`.
- Charte : `contexte/charte-ui-ux-grist-factory.md` (état du 14/10 ; la référence vivante est dans le dépôt
  `publipostageGrist`, `planning/identite-ui-ux-grist-factory.md`).
- Maquettes et leurs contrôles : `maquettes/`. Labo « vrai Grist » : `outils/labo-grist-reel/`.
- Dépôts lus le 14/10 : `publipostageGrist` (92ecd58), `SlidesPlus` (747a700), `FormPlus` (b073d03), `GRIST_automation`
  (ee8f0a9), `Grist-BI` (c8c819f), `grist-widget-audit`.
