# 006 · Quatre fonctions du moteur au-dessus des seuils de l'outil d'audit : à découper

App : Sync+ · posée le 09/11/2026 · quand : à ton prochain lot, sans urgence ; du code dans ton app, sans changement visible pour la personne ; décision du porteur du 09/11 (carte « Faire découper les 4 fonctions du moteur de partage trop grandes ? » : « Demander à Sync+ de les découper »)

## Quoi

Quatre fonctions de `js/engine/` dépassent les seuils de l'outil d'audit (cahier 3.3, point 1 : une fonction de 81 lignes ou plus, une complexité au-dessus de 15). GFS les a mesurées le 09/11 sur la copie du moteur 2.1.0 (ton commit `e7054cc`, dans le kit 0.14.0), avec la mesure de l'outil lui-même (`src/moteur/fonctions.js` de `Grist-widget-audit` : la complexité de McCabe sur le corps propre de la fonction, `if`, boucle, `case`, `catch`, ternaire, `&&`, `||` et `??` comptés ; les lignes, de la première à la dernière, fonctions internes comprises) :

| Fonction | Fichier du moteur | Mesure | Seuil |
|---|---|---|---|
| `createRestPort` | `js/engine/rest-port.js` | 226 lignes | 80 au plus |
| `lotFormula` | `js/engine/logic/formulas.js` | 87 lignes | 80 au plus |
| `journalFacts` | `js/engine/logic/diagnostic.js` | complexité 22 | 15 au plus |
| `diagnosticText` | `js/engine/logic/diagnostic.js` | complexité 18 | 15 au plus |

Tu découpes sans changer le comportement. Des pistes, que tu décides (tu connais ton code mieux que GFS) :

- `createRestPort` : la fabrique garde l'état qu'elle ferme (`owner`, `ownOrigin`) et ne fait plus qu'assembler. Chaque groupe de requêtes devient une fonction du module qui reçoit ce qu'il lui faut (`rest`, `http`, `docApi`) et rend sa part du port : lectures (`querySql`, `selectRows`, `journalStats`, `docChanges`), webhooks (`listWebhooks`, `isOwner`, `webhookConditions`, `createWebhook`, `deleteWebhook`, `deleteWebhookWithNotice`, `postRows`), partage et lecture publique (`shareInfo`, `publicAccess`, `publicRecords`), pièces jointes (`downloadAttachment`, `uploadAttachment`). La forme du port que `createRestPort` rend, et son mode d'emploi en tête de fichier, ne changent pas.
- `lotFormula` : le texte de la formule est fait de lignes de Python ; chaque grande étape (le choix du type de ligne et des fichiers, la fenêtre des lignes recalculées, le plafond d'un envoi, le bilan) devient une petite fonction qui rend ses lignes, et `lotFormula` les met bout à bout. **Le texte de la formule reste identique, octet pour octet** : un essai qui compare la sortie avant et après le garantit (c'est le texte que le moteur pose dans les colonnes des documents déjà partagés : qu'il reste identique évite tout changement chez eux).
- `journalFacts` et `diagnosticText` : une petite fonction par fait (l'arrivée, le mode, l'écart, le soupçon…) et par section du texte (en-tête, envoi, réception, erreurs).

## Pourquoi

GFS charge le moteur par des `import()` à chemin fixe : l'outil d'audit lit donc ces fichiers quand il juge GFS, et compte ces quatre fonctions contre lui. Le `README` du kit dit encore « aucune fonction au-dessus des seuils » (vrai au kit 0.8, plus depuis le moteur de partage). Le porteur a préféré que le moteur reste une seule source chez toi, plutôt que GFS le découpe dans sa copie : une copie découpée ici divergerait à chaque reprise (`outils/reprendre-synchro.mjs` refait la copie entière).

## Fait quand

`GFS-ETAT.md` donne la ligne « 006 · faite · `commit` » et, en note : la mesure de l'outil d'audit passée sur tout `js/engine/` (nombre de fonctions mesurées, aucune à 81 lignes ou plus, aucune au-dessus de la complexité 15) ; le numéro de version du moteur (une mineure, puisque le comportement ne change pas) ; et les essais du moteur toujours verts, dont celui qui garde le texte de `lotFormula` octet pour octet. Si une coupe change malgré tout un comportement, dis-le dans la note, avec ce qui a changé : GFS le mesure alors dans son Grist avant de reprendre le moteur.
