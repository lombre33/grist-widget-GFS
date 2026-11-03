# 005 · Les liens entre apps sont construits : `GfsLink.choose` et `GfsLink.openFile` (kit 0.3.0)

App : Tuesday · posée le 03/11/2026 · remplace le point 2 de la 002 · réponse à ta demande 4 · quand : au prochain lot qui touche tes liens ;
sans effet dans l'app seule (tes entrées restent grisées)

## Quoi

**1. Ce qui existe depuis le 03/11** (décision du porteur, carte « Construire maintenant » ; contrats 5.4, points 2 et 7, et 3.6). GFS répond à
`choisir` et à `ouvrir` côté app (publié à `1a3e6fb`), et le kit passe à **0.3.0** : `lombre33/grist-factory-kit` à **`9d17844`**, sans étiquette (le
cloud ne pousse pas d'étiquette : la référence est le commit). Avance ton sous-module `kit/` à ce commit, dans un commit à part.

```js
import { GfsLink } from './kit/js/gfs-link.js';
// Lier : la personne désigne un fichier dans l'explorateur de GFS, ouvert en mode choix.
const lien = await GfsLink.choose({ types: ['document', 'grille', 'presentation'], titre: I18n.t('liens.choisir') });
if (lien) garder({ app: lien.app, id: lien.id, type: lien.type, nom: lien.nom });   // la clé { app, id, type } ; le nom n'est qu'une étiquette
// Ouvrir, plus tard, par la clé gardée.
try { await GfsLink.openFile({ app, id, type }); } catch (erreur) { /* les codes : point 3 */ }
```

- `choose({ types, apps?, titre? })` : `types` est la liste des types voulus (1 à 16 noms), `apps` restreint aux apps nommées, `titre` est ton texte déjà
  traduit (une ligne, 120 signes au plus ; GFS dit « Choisir un fichier » sans titre). Rend `{ app, id, nom, type }` (`id` en texte), ou `null` quand la
  personne annule. Une seule demande à la fois : la même, posée deux fois, rend la même promesse ; une autre pendant la première est refusée.
- `openFile({ app, id, type })` : rend `true` quand l'app visée a ouvert le fichier. **Vers une autre app, la tienne s'en va** (une seule app à la fois,
  contrats 1.4) : ta promesse ne se règle pas et GFS n'envoie pas encore « fermer » à l'app qui s'en va (étape 6). **Finis tes écritures avant l'appel.**
- Seule, l'app n'appelle personne : `GfsLink.hosted` est faux et les deux fonctions rejettent (`GFS absent`). « Lier un fichier » et « Ouvrir » restent
  grisés, avec le texte commun du grisé (guide 5), jamais masqués, comme la 002 le disait ; hébergée, ils s'activent.

**2. Ce que la personne voit dans GFS.** L'explorateur s'ouvre avec ton titre, « Choisir » et « Annuler » à la place d'« Ouvrir » et « Fermer », « Nouveau »
grisé, et ne liste que les fichiers dont le type est demandé **et** offert à choisir par leur app : pour Publipostage+, ses documents, ses grilles et ses
présentations (la 002 disait « pas ses présentations » : c'est changé), jamais un e-mail ni une macro. Un fichier d'une app non installée, ou d'une extension
éteinte (une présentation sans « Diapositives »), est grisé, pas caché : un double-clic ouvre la fenêtre des apps sur la bonne ligne et le choix continue.
Double-clic, Entrée et « Choisir » désignent ; « Annuler » et Échap rendent `null`.

**3. Les refus de `openFile`** (ils rejettent avec `erreur.code`). Un lien n'est jamais supprimé par toi : tu le montres grisé, avec la raison, et la personne
le retire ou le refait.

| Code | Ce que GFS a fait | Ce que tu fais |
|---|---|---|
| `GFS_INTROUVABLE` | le fichier n'est plus dans la table de son app (ou l'app est inconnue) ; GFS l'a dit à la personne, ton app reste ouverte | grise le lien (« fichier introuvable »), ne redis rien |
| `GFS_ANNULE` | l'app visée n'était pas installée : la fenêtre des apps s'est ouverte, la personne l'a fermée sans l'installer | ne dis rien de plus ; le lien reste tel quel |
| `GFS_REFUSE` | clé mal formée, ou type que l'app visée ne sait pas ouvrir (`actions.ouvrir`) | un défaut chez toi : un avertissement en console |
| `GFS_ACCES` | GFS n'a pas l'accès complet au document : rien n'est listé, rien ne s'ouvre | montre `erreur.message` : il dit où régler l'accès dans Grist |

`choose` rejette avec `GFS_REFUSE` quand `types` est vide ou qu'un autre choix est déjà en cours, avec `GFS_ACCES` sous l'accès complet ; une personne qui annule
n'est jamais une erreur : c'est `null`.

**4. Ce que tu reçois toi aussi.** Ton type `projet` est déclaré dans `actions.choisir` et `actions.ouvrir` : une autre app peut lier un projet de Tuesday.
GFS t'envoie alors l'appel `ouvrir` (ton `GfsLink.onOpen`), ou l'ouverture à ton démarrage, avec **`raison: "lien"`** : ouvre le projet désigné, rien d'autre.
Publipostage+ ne dit rien de plus quand on lui ouvre un fichier par un lien (sa phrase « Ouvert depuis l'explorateur » est réservée à la raison `explorateur`) :
inutile d'en écrire une chez toi.

**5. Tester.** Dans ton dépôt, `createGfsLink({ host })` du kit fait un lien d'essai : le kit joue GFS avec une page et un cadre isolé (`navigateur/gfs-hote.js`, le
scénario `scenarios-gfs.mjs`), et `test/gfs-link.test.mjs` montre les réponses de GFS. Dans GFS même, Tuesday n'a pas encore sa place au catalogue (aucune référence
à avancer, `apps.md`) : quand ta page « Demandes à GFS » le demandera et que le porteur dira « demande de Tuesday », GFS t'y met, déclare `ACCEPTS_OPEN` pour ton
ouverture et mesure tes entrées de liens à 700 × 400, à la vraie souris. GFS les a déjà mesurées avec une sonde, avec la vraie Publipostage+ et avec le vrai client du kit
(`run-liens.mjs`, `run-liens-publipostage.mjs`, `run-liens-kit.mjs`, en français et en anglais, en clair et en sombre).

## Pourquoi

Ta demande 4 : des liens vers les fichiers d'autres apps depuis tes tâches. Le porteur a choisi de construire ce lot maintenant (03/11) ; c'est une fonction du kit :
toute autre app qui lie un fichier la prendra de la même façon. Le contrat ne bouge pas : la clé `{ app, id, type }`, le nom comme simple étiquette et le lien jamais supprimé
sont ceux de 5.4, point 7, écrits le 02/11.

## Fait quand

`GFS-ETAT.md` donne « 005 · lue » maintenant, puis « 005 · faite · `commit` » quand `kit/` est à `9d17844` ou après, que « Lier un fichier » appelle `GfsLink.choose`
et « Ouvrir » `GfsLink.openFile` (grisés seuls ou sans réponse de GFS), que `GFS_INTROUVABLE` grise le lien sans le supprimer, et que `onOpen` ouvre le projet désigné
pour la raison `lien`. Tes essais le montrent avec `createGfsLink` ; GFS le rejoue dans GFS à ton entrée.
