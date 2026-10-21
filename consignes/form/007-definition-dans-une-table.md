# 007 · Entrer dans GFS : la définition de chaque formulaire dans une table

App : Form+ · posée le 21/10/2026 · à la demande du porteur (il veut voir Form+ dans les fichiers de GFS) · quand : au prochain
lot ; du code dans ton app ; le premier pas de ta ligne du guide, et lui seul

## Quoi

**1. Ce que GFS a fait de son côté** (rien à faire chez toi). Form+ est dans le catalogue de GFS : ton dépôt est référencé au
commit `39e0740`, le dernier que ta page décrit ; un manifeste provisoire (`prototype/manifestes/form.json`) nomme ta table de
fichiers, ton type « Formulaire » (icône `form`, sans couleur de famille), les cinq tables internes que tu lis, tes écritures
`_grist_*` et la capacité `structure`, chacune avec sa raison. L'explorateur de GFS listera tes formulaires dès que la table
existe. Le porteur a demandé le 21/10 que Form+ y soit visible : c'est le go de ce pas-là, pas des suivants (001, point 3).

**2. Ce que GFS a mesuré**, ton code non modifié à `39e0740`, dans le sous-cadre isolé de GFS, dans un vrai Grist
(`prototype/labo/run-form.mjs`, et `run-form-seul.mjs` pour le même geste sans GFS) :

- Ton app démarre sans refus ni erreur de script ; « Partir de zéro » passe (la table, la section de formulaire).
- Le courtier refuse `persistOptions` et la copie d'un formulaire : « Action 1 refusée : La colonne options de
  _grist_Views_section n'est jamais écrite par une app. » Le lot entier tombe, `shareOptions` compris (3.3, points 1 et 6).
  Il refuse aussi la lecture de `_grist_Shares` : « _grist_Shares ne se lit jamais. » (`findExistingShareKey`, qui rend déjà
  `null` : la clé se colle).
- `grist.setOptions(saved)`, ton repli, ne dit rien et n'écrit rien (aucune clé de Form+ n'est déclarée) et `getOptions()` rend
  `null` : **dans GFS, rien de ce que la personne règle ne se garde aujourd'hui**, sans message.
- Dès que `CreateViewSection` a posé la section, Grist recharge le cadre de l'app, avec ou sans GFS : le retrait du champ qu'il
  ajoute tout seul (`clearAutoFields`) n'a pas lieu et un champ reste dans le formulaire « vide » ; dans GFS, l'explorateur
  revient, l'app est fermée. Les gestes qui posent une section doivent se reprendre à la réouverture.

**3. Ce que tu changes.**

1. **La définition de chaque formulaire passe dans `FormPlus_Formulaires`**, une ligne par formulaire : `Nom` (le titre),
   `TypeFormulaire` (`formulaire`), `DateModif` (DateTime, en secondes), `ModifiePar` (l'adresse, ou « Nom <adresse> » comme
   Publipostage+), et une colonne `Definition` (texte, la définition entière en JSON : ce que `persistOptions` met aujourd'hui
   dans `customView.widgetOptions`). GFS ne lit que les quatre premières (la table entière, 2.4 point 2 : garde la définition
   petite). Les noms sont ceux du manifeste ; si tu veux d'autres colonnes pour la définition, dis-le dans ta page.
2. **Règle 4** : la table naît avec l'accord de la personne (une fenêtre du kit), jamais d'écriture dans une colonne absente,
   l'identifiant réel relu après `AddTable`, une colonne ou un champ inconnu gardé à la réécriture. Les formulaires déjà faits
   (définis dans les réglages de la vue) se lisent toujours : lire `options` reste permis, et ils passent dans la table au
   premier enregistrement.
3. **Plus d'écriture de `options`** : ni `persistOptions`, ni le marqueur de copie (`formplusDuplicate`, `formplusSource`), ni
   la réparation. Le marqueur de copie passe dans la ligne de la table.
4. **Plus de lecture de `_grist_Shares`**, et plus de `setOptions` de tout l'objet. Si tu gardes un réglage de vue (par exemple
   le formulaire que cette instance affiche), c'est une clé à toi, préfixée, écrite sur un geste de la personne ; nomme-la dans
   ta page, GFS la déclare.
5. **Les répondants** : c'était la raison de `options` (lisible par une session de partage anonyme). Dis dans ta page comment la
   définition leur reste lisible avec une table. Si cela demande autre chose à GFS, c'est une question pour GFS.

**4. Ce qui vient** (une annonce, rien à faire maintenant). La page et l'instance par le contexte, et la porte « ouvrir » (un
double-clic sur un formulaire ouvre ton app sur lui ; aujourd'hui GFS dit « Provisoire : Form+ ne sait pas encore ouvrir un
fichier précis ») demandent un client du courtier dans le kit : le porteur en décide, une consigne dira quoi écrire. Leaflet
suit, comme la 006 l'a dit, quand le catalogue porte un script, une feuille de style et des images. La barre de GFS aux quatre
bords (5.2, point 7) aura sa consigne, après mesure chez toi.

## Pourquoi

1. Le porteur veut voir Form+ à côté de Publipostage+ dans l'explorateur : sans table, il n'y a rien à lister.
2. Le courtier ne laisse jamais une app écrire `options` (elle porte l'adresse et l'accès de chaque widget, GFS compris) :
   tant que la définition y vit, Form+ ne peut rien enregistrer dans GFS. La table est aussi ce que le cahier (5.5) et le
   guide (1.1, règle 2) demandent, et ta ligne du guide en fait le premier pas.
3. Une définition dans une table se voit, se sauvegarde et se partage avec le document, y compris dans l'app seule.

## Fait quand

`GFS-ETAT.md` donne « 007 · faite · `xxxxxxx` » et dit : le nom exact de la table et de ses colonnes, la forme de `Definition`
(une ligne en exemple), comment les répondants la lisent, la clé de réglage s'il y en a une ; « Changements qui touchent GFS »
liste la table. GFS rejoue alors `run-form` avec ton commit, pose un formulaire réel dans l'explorateur et avance la référence.
