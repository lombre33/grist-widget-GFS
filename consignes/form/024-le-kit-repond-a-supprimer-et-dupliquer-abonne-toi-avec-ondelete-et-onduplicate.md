# 024 · Le kit répond à « supprimer » et « dupliquer » (0.10.0) : abonne-toi avec `GfsLink.onDelete` et `GfsLink.onDuplicate` ; tes 020 et 021 ne sont plus bloquées

App : Form+ · posée le 06/11/2026 · contrats de GFS 2.4 et 5.4 (points 10 et 11), guide des apps 1.2 point 20, kit 0.10.0 · décision du porteur du 06/11 (carte « Ajouter au kit les réponses à « Mettre à la corbeille » et « Dupliquer » ? » : « Un crochet par geste ») ·
quand : en même temps que ta 020 et ta 021 (qui restent valables telles quelles) ; du code dans ton app (la référence du kit, deux abonnés) ; vaut dans GFS seulement

## Quoi

**1. Ce qui bloquait.** Ta page (`bf0ddce`) l'a bien lu : le client du kit (`kit/js/gfs-link.js`) répondait `GFS_INCONNU` à tout appel de GFS sauf `ouvrir` et `fermer`, aussitôt, avant qu'un abonné ajouté par Form+ ait pu répondre ; sans crochet dans le kit, répondre à `supprimer` ou à `dupliquer` aurait
obligé à copier le protocole chez toi. Le porteur a choisi un crochet par geste, comme `onClose`.

**2. Ce que le kit fait maintenant** (0.10.0, `cb1f8cd` ; le porteur pose l'étiquette `v0.10.0`) : deux abonnés de plus dans `GfsLink`, un seul abonné par appel (le dernier remplace l'autre) ; chacun rend de quoi se désabonner.

- **`GfsLink.onDelete(fn)`** : `fn({ fichier: { id, type }, raison })` s'exécute quand la personne met un fichier de Form+ à la corbeille depuis l'explorateur (`raison` vaut `corbeille`). `fn` ferme le lien public du formulaire (ta 020), puis rend (ou résout) `{ fait: true }` ; `{ fait: false, dit }` quand elle ne
  peut pas (`dit` : une phrase d'une ligne, 200 signes au plus, que GFS ajoute à la sienne) ; rendre seulement `true` ou `false` suffit. Seul `true` ou `fait: true` laisse GFS écrire dans la corbeille.
- **`GfsLink.onDuplicate(fn)`** : `fn({ fichier: { id, type }, nom })` s'exécute quand la personne copie un fichier (`nom` : le premier nom libre, calculé par GFS). `fn` copie le formulaire en entier sous ce nom, sans le publier (ta 021), et rend `{ id, nom?, dit? }` (`id` : la copie, texte ou nombre non vide ;
  `nom` seulement avec lui) ; `{ dit }` sans `id` dit que rien n'a été copié.
- **Ce que GFS en fait** : une erreur que ton abonné lève part avec son texte et GFS la dit ; sans abonné, `GFS_INCONNU` (GFS dit « ne sait pas encore faire ce geste ») ; sans réponse au bout de 20 secondes GFS n'écrit rien. `fichier.id` arrive tel que GFS le donne (texte ou nombre).
  Rien ne change pour `ouvrir` ni `fermer`. Essais : 195 sous Node et la scène Chromium du cadre isolé (README et CHANGELOG du kit, « 0.10.0 »).

**3. Ce que tu fais.** Avance ton sous-module `kit/` à `cb1f8cd` (un commit à part, relu avant : seul `js/gfs-link.js` change pour toi, et la version), puis fais ta 020 et ta 021 telles qu'écrites, avec `GfsLink.onDelete` et `GfsLink.onDuplicate` au lieu d'un abonné à toi. Dis-le dans ta
page : « 020 · faite » et « 021 · faite » (le « Fait quand » de chacune dit quoi mesurer). **GFS déclare `suppression.appel` et `copie.appel` dans son manifeste de Form+ quand ta page dit 020 et 021 faites**, puis rejoue le geste avec ta vraie app dans un vrai Grist (aujourd'hui seule la sonde qui répond comme
toi a été mesurée). Si une réponse ne tient pas dans ces formes, dis-le dans ta page : le crochet est au kit, GFS le change là.

## Pourquoi

Une seule version du dialogue avec GFS pour toutes les apps (règle « ne pas dupliquer de code ») : ce qui manquait était un crochet, pas un protocole de plus chez toi. Les contrats de GFS (5.4, points 10 et 11) et le guide (1.2 point 20) n'ont pas changé : la 020 et la 021 disent déjà quoi répondre.

## Fait quand

`GFS-ETAT.md` donne « 024 · lue », puis « 024 · faite » avec le commit qui avance `kit/` à `cb1f8cd` (ou plus récent, si le kit a avancé depuis : la page dit lequel), en même temps que « 020 · faite » et « 021 · faite ».
