# 022 · Le kit répond à « fermer » (0.9.0) : abonne-toi avec `GfsLink.onClose` au lieu de répondre à la main

App : Form+ · posée le 04/11/2026 · contrats de GFS 5.4 (point 3), guide des apps 1.2 point 19, kit 0.9.0 · demande du porteur du 04/11 (« Ajouter au kit la réponse à « fermer » pour les apps qui l'utilisent » : « Oui, dans le kit ») ·
quand : en même temps que ta 019 (ou dès que ta 019 est faite sans le kit) ; du code dans ton app (la référence du kit, un abonné) ; vaut dans GFS seulement

## Quoi

**1. Ce qui manquait.** Le client du kit (`js/gfs-link.js`) répondait `GFS_INCONNU` à tout appel de GFS sauf `ouvrir`. Une app qui parle à GFS par le kit ne pouvait donc pas répondre à `fermer` (ta 019) : GFS la prenait pour
« elle part sans rien dire » et détruisait son cadre sans que rien soit enregistré.

**2. Ce que le kit fait maintenant** (0.9.0, `eaa2ae2` ; le porteur pose l'étiquette `v0.9.0`) : `GfsLink.onClose(fn)`. `fn({ raison })` s'exécute quand GFS va remplacer ton app (`raison` : `app`, `explorateur`, `nouveau`, `importer`,
`lire` ou `lien`, vide si GFS n'en donne pas). Elle enregistre ce qui attend ou pose ta question (Enregistrer, Abandonner, Annuler), puis rend **vrai** si l'app peut partir (ton `{ ferme: true }`) ou **faux** si la personne reste
(`{ ferme: false }`) ; une promesse est permise, et seul `true` ferme. Une erreur part chez GFS avec son texte : c'est la personne qui décide. Le kit pose l'enveloppe, reprend l'`id` de l'appel et répond : **tu n'écris plus
aucune réponse à la main**. Un seul abonné à la fois ; `onClose` rend de quoi se désabonner. Sans abonné, le kit répond `GFS_INCONNU` comme avant.

**3. Ce que tu fais.** Avance `kit/` à `eaa2ae2` (commit à part, relu), puis écris ta règle de la 019 dans un abonné : `GfsLink.onClose(async ({ raison }) => ...)`. La règle ne change pas (rien en attente : vrai ; enregistrement
automatique allumé : enregistre puis vrai, sans question ; sinon ta question). Si ton app parle à GFS par un code à elle et non par le kit, cette consigne ne te concerne pas : ta 019 reste telle quelle.

## Pourquoi

Une seule réponse à `fermer`, écrite une fois dans le kit, pour toutes les apps qui s'en servent (règle « ne pas dupliquer de code ») ; sans elle, la 019 ne pouvait être faite qu'en réécrivant le client du kit chez toi.

## Fait quand

`GFS-ETAT.md` donne « 022 · lue » maintenant, puis « 022 · faite · `commit` » quand `kit/` est à `eaa2ae2` ou plus récent, que `GfsLink.onClose` répond comme à la 019 et qu'un essai à toi le montre. Tu peux passer la 019 et la 022 à « faite »
dans le même commit. GFS rejoue `fermer` avec ta vraie app dans son labo (`run-fermer`, un vrai Grist, la vraie souris) quand ta référence avance.
