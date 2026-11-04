# 021 · Réponds à « dupliquer » : copie un formulaire en entier, sans le publier

App : Form+ · posée le 04/11/2026 · contrats de GFS 2.4 (`copie.appel`) et 5.4 (point 11), guide des apps 1.2 point 20 · demande du porteur du 04/11 : « il faut que tout puisse se faire depuis l'explorateur » · quand : au prochain lot, sans urgence, après la 020 ;
du code dans ton app (une réponse à un appel de GFS) ; vaut dans GFS seulement

## Quoi

**1. Ce que GFS fait dès maintenant.** « Dupliquer » (menu de la ligne) et Ctrl+C puis Ctrl+V font une copie d'un fichier dans l'explorateur. Pour un modèle de Publipostage+, une ligne copiée suffit, GFS l'écrit. **Un formulaire de Form+ n'est pas une ligne** : sa copie
est un formulaire de plus (sa ligne de `FormPlus_Formulaires`, ses sections natives, sa table de réponses). GFS ne sait pas les créer : **il te demande de copier le formulaire.** Tant que ton app ne répond pas, « Dupliquer » reste grisé pour un formulaire de Form+.

**2. Ce que tu fais : répondre à `dupliquer { fichier, nom }`.** `fichier` est `{ id, type }` (voir la 020) ; `nom` est **le premier nom libre** que GFS a calculé (« Inscription atelier (1) » : le nom du fichier, un numéro entre parenthèses, jamais un nom déjà pris). Tu copies le formulaire
avec ce que ton app sait déjà faire pour dupliquer un formulaire (la copie de ses sections natives, celle de sa définition…), sous ce nom, et tu réponds :

- `{ id, nom?, dit? }` **quand la copie existe** : `id` est le numéro de la nouvelle ligne de `FormPlus_Formulaires` (un nombre ou un texte) ; `nom` seulement si tu l'as changé ; `dit` une phrase d'une ligne (200 signes au plus) que GFS ajoute à la sienne. GFS relit la liste, montre la copie,
  la range dans le même dossier que l'original et lui donne le clavier ;
- `{ dit: "…" }` **sans `id`** si tu ne copies pas (la personne n'a pas l'accès voulu, une section manque…) : GFS dit ta phrase, rien n'est rangé ;
- une erreur (`GFS_ERREUR` et son texte) si quelque chose casse.

**3. La copie n'est pas publiée.** Un formulaire public reçoit des réponses de n'importe qui : une copie qui s'ouvrirait au monde sans que la personne l'ait demandé serait une surprise de plus que GFS ne veut pas. Copie le formulaire **avec son lien fermé** (par exemple `shareOptions` de ses sections à `'{}'`) et dis-le
dans `dit` (« Elle n'est pas publiée. ») : la personne la publie elle-même, dans ton app, quand elle le veut. La copie reprend la définition et les questions ; **pas les réponses** déjà reçues par l'original.

**4. Ce que tu ne fais pas.** Tu n'écris pas dans `GFS_Rangement` ni dans `GFS_Corbeille` (GFS seul y écrit) ; tu ne ranges pas la copie dans un dossier (GFS le fait). Tu réponds après avoir fini d'écrire ; sans réponse au bout de 20 secondes, GFS dit à la personne que Form+ ne répond pas.

**5. Dans ta page d'état**, sur la ligne de cette consigne : ce que ta copie reprend (sections, définition, table de réponses vide) et ce qu'elle ne reprend pas.

## Pourquoi

Même raison que la 020 : tout se fait depuis l'explorateur (décision du porteur, 04/11). Quand tu auras répondu, GFS déclare `copie: { appel: true }` dans son manifeste de Form+ en lisant ta page.

## Fait quand

`GFS-ETAT.md` donne « 021 · lue » maintenant, puis « 021 · faite · `commit` » quand `dupliquer` répond comme au point 2 et qu'un essai à toi le montre : la copie est un formulaire de la liste, ses sections ne sont pas publiées, l'original n'a pas bougé. GFS le rejoue avec ta vraie
app dans son labo (`run-composite`, puis un vrai Grist avec Form+) quand ta référence avance, et passe la consigne à « faite » en lisant ta page.
