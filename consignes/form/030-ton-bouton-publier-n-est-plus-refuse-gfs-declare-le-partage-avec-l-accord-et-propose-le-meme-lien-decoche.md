# 030 · Ton bouton « Publier le formulaire » n'est plus refusé : GFS déclare le partage, avec l'accord de la personne ; propose en plus « même lien », décoché

App : Form+ · posée le 11/11/2026 · décisions du porteur du 11/11 (cartes « Laisser Form+ publier le formulaire à ta place, avec ton accord à chaque fois ? », option
« Avec accord », et « Laisser un second formulaire réutiliser le lien du premier, sans copie ? », option « Au choix, non coché ») · quand : au prochain lot ; la partie 1
ne demande rien, la partie 2 une phrase et un test, la partie 3 est la vraie nouveauté

## Quoi

**1. Ton bouton passe.** Ton `publishFormSection` (`poc/js/grist-meta.js`, vu à `3b9ac0c`) écrit `AddRecord _grist_Shares`, puis `UpdateRecord _grist_Pages { shareRef }`, puis
`UpdateRecord _grist_Views_section { shareOptions }`. GFS déclare pour Form+ la capacité `partage` (manifeste ; contrats 3.4, point 8) : les deux premières passent, **dans la forme de ta
recette et pas une de plus** : `linkId` (8 à 64 caractères : ton `crypto.randomUUID()`) et `options` valant `{"publish":true}`, `shareRef` seule dans son propre `UpdateRecord`, et
l'autre branche de ta recette (`UpdateRecord _grist_Shares { options }` à `{"publish":true}`, quand la page a déjà un partage). La troisième écriture ouvre la fenêtre d'accord de GFS
(« Ouvrir au public ? », « Refuser » au clavier), comme pour tout formulaire. **Mesuré avec ta page à `3b9ac0c`** dans un vrai Grist 1.7.19 (`labo/run-publier-form.mjs` de GFS,
faits vérifiés 95) : aucun refus du courtier, la fenêtre s'ouvre, « Autoriser » publie et ton guide passe seul à l'étape 2, le lien marche en visiteur anonyme ; avant la réponse de la
personne, la clé du lien n'ouvre ni le formulaire ni l'ajout de lignes.

GFS te refuse encore (`GFS_REFUSE`, ton repli sur le geste à la main reste le bon) : rattacher un partage à une page qui porte déjà un formulaire marqué publié ; rouvrir
(`publish: true`) un partage fermé dont une page porte un formulaire marqué publié ; toute autre écriture dans `_grist_Shares` (jamais de `RemoveRecord`, jamais d'autre colonne), tout
`shareRef` écrit avec une autre colonne, ou à 0. Tu ne lis toujours pas `_grist_Shares` : le numéro du partage d'une page se lit dans `_grist_Pages.shareRef`.

**2. Le refus de la personne n'est pas un échec.** Quand elle clique « Refuser » (ou Échap), ton appel rejette avec `error.code === 'GFS_ANNULE'` (mesuré : le code arrive tel quel).
Aujourd'hui `publishNow` (`poc/js/publish-guide.js`) met `G.refused = true` pour tout rejet, et le guide dit « Form+ n'a pas pu publier à votre place » : mesuré à `3b9ac0c`, c'est
ce que la personne lit juste après avoir refusé. Distingue les deux : pour `GFS_ANNULE`, dis qu'elle a refusé (« Vous avez refusé : le formulaire n'est pas publié. »), garde le bouton de
l'étape 1 pour recommencer, ne passe pas au geste à la main ; pour `GFS_REFUSE` ou une erreur de Grist, garde ton repli. Le partage déjà posé reste sur la page (GFS ne le retire
pas, et il n'ouvre rien tant qu'aucune section n'est publiée) : au clic suivant, ta recette prend sa branche « page déjà partagée ». Le guide des apps, point 14, le demandait déjà
(un refus de la personne n'est pas une erreur).

**3. Propose « même lien que… », décoché.** C'est le choix du porteur : un second formulaire peut prendre le lien du premier, la personne n'a plus rien à copier. Les faits (faits
vérifiés 91 et 95) : la clé de l'adresse est tirée par le serveur, aucun widget ne peut la lire, **seule celle que tu as déjà retenue en enregistrant le premier formulaire existe côté
Form+** ; deux pages qui portent le même `shareRef` ouvrent leurs deux formulaires avec la même clé.
- Dans l'étape 1 de ton guide, **seulement quand le document a déjà un formulaire de Form+ publié** dont tu connais la clé, ajoute une case **décochée** : « Même lien que « <nom du
  premier formulaire> » : rien à copier. » Écris dans la phrase ce que la personne y gagne et ce que ça coûte : une seule adresse ouvre alors les deux formulaires, et si elle fuit elle
  les ouvre tous les deux (chacun reçoit des lignes dans sa propre table). Dépublier l'un dans Grist peut fermer le lien des deux : ne l'écris que si tu l'as mesuré (GFS ne l'a pas fait).
- Case cochée : au lieu de créer un partage, écris `UpdateRecord _grist_Pages { shareRef }` avec le `shareRef` de la page du premier formulaire (tu le lis dans `_grist_Pages`), puis
  `shareOptions` comme d'habitude. **GFS ouvre alors sa fenêtre « Un seul lien pour deux formulaires ? »** (« Refuser » au clavier) à l'écriture du `shareRef`, puis son accord de
  publication habituel (nom de la table du second formulaire). Si la personne refuse la première, tu reçois `GFS_ANNULE` : retombe sur le chemin normal (un lien à lui, partie 1), sans
  rien dire d'une erreur.
- Une fois la page rattachée, **bâtis l'adresse du second formulaire avec la clé que tu as retenue pour le premier** (`…/forms/<clé>/<numéro de la section>`) et passe l'étape de collage :
  la personne n'a rien à copier. Garde la clé dans la ligne du second comme pour n'importe quel formulaire.
- Case décochée (le défaut) : rien ne change, un lien par formulaire, comme la règle de la 013.

## Pourquoi

Le copier-coller du lien est la gêne que le porteur cite le plus pour Form+. GFS ne peut pas lire la clé (mesuré le 11/11), donc la seule façon de supprimer la copie est de ne pas en
demander une nouvelle : publier à la place de la personne (partie 1) retire le parcours de Grist, et un lien commun (partie 3) retire la copie pour tous les formulaires suivants.
Les deux se font avec l'accord de la personne : c'est la fenêtre de GFS qui a le dernier mot, jamais ta case seule.

## Fait quand

- le bouton « Publier le formulaire » publie sans refus dans un vrai GFS : la fenêtre « Ouvrir au public ? » s'ouvre, « Autoriser » mène à l'étape 2, « Refuser » reste à l'étape 1
  avec une phrase qui dit que la personne a refusé, et un second clic relance la fenêtre ;
- un rejet autre que `GFS_ANNULE` (par exemple `GFS_REFUSE`) mène toujours à ton geste à la main ;
- la case « Même lien que… » est décochée, n'apparaît que si un autre formulaire de Form+ est publié, dit le prix du lien commun ; cochée, la fenêtre « Un seul lien pour deux
  formulaires ? » de GFS s'ouvre, « Même lien » rattache la page et le guide saute le collage, « Refuser » retombe sur un lien à part ;
- tes essais couvrent le rejet par `GFS_ANNULE`, le rejet par `GFS_REFUSE` et la case ; ta page d'état dit ce qui est fait, et ce que tu n'as pas mesuré (Firefox, une autre version de
  Grist).
