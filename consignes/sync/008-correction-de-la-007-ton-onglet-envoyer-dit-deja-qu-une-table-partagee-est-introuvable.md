# 008 · Correction de la 007 : ton onglet « Envoyer » dit déjà qu'une table partagée est introuvable ; GFS s'était trompé, aucun code n'est demandé

App : Sync+ (`lombre33/grist-widget-one-way-sync`) · posée le 25/11/2026 · remplace le point 2 et la question c de la 007 · faits vérifiés 160 (corrigé) et 165 · lu à `c4fa667` (0.31.0, moteur 5.2.0)
quand : à lire avec la 007, sans urgence ; aucun code ; la question c de la 007 est retirée, les questions a et b restent

## Quoi

**1. Ce que la 007 disait à tort.** Elle écrivait (point 2 et question c) qu'un lien dont la table source a été renommée à la main « se tait, sans le dire », et demandait si le moteur pouvait le détecter. **Il le détecte déjà, et ton widget le dit.** GFS ne l'avait pas vu parce qu'il avait mesuré le seul moteur (`ensureSyncTable`, le lot d'envoi vide) et pas ton onglet.

**2. Ce que GFS a lu dans ton code** (0.31.0, moteur 5.2.0 ; faits vérifiés 165) : `exportDrift` (`js/engine/logic/exports.js`) rend les tables **introuvables** (« renommées ou effacées : leurs lignes ne partent plus ») et les colonnes renommées, effacées ou d'un autre type (« elles partiraient vides ou fausses ») ; l'onglet « Envoyer » les dit sur la ligne de l'export (`send.export.lost` : « Table introuvable (renommée ou supprimée) : … Ses lignes ne sont plus envoyées. Redonnez-lui son nom, ou retirez-la de l'export (Modifier). » ; `send.export.drift` pour les colonnes), la table `Synchro` renommée a sa carte (`send.lost.renamed.*`) et le côté cible dit un journal renommé (`recv.renamed.*`). GFS ne l'a pas vu à l'écran : il demande un vrai serveur pour les webhooks de ton widget.

**3. Ce qui reste vrai, et que GFS ne te demande pas de coder** : ces messages ne se lisent que **quand quelqu'un ouvre l'onglet « Envoyer »** ; tant que personne ne l'ouvre, les lignes ne partent plus et rien ne prévient ni la personne qui a renommé, ni le document qui reçoit. Un avertissement qui n'attend pas l'onglet ne peut pas venir de ton widget (il ne tourne pas tant qu'il n'est pas affiché) : c'est une question pour le porteur, que GFS lui pose sur une carte avant tout code. Si le porteur la veut, une consigne te dira alors ce qu'elle attend du moteur (le résultat de `exportDrift`).

**4. Deux autres constats** :
- **Le moteur que GFS porte dans le kit est la 5.1.0** ; ton widget est à la 5.2.0 (« les tables de résumé de Grist s'envoient comme les autres »). GFS avancera sa copie, dans un commit à part ; rien à faire chez toi.
- Les questions **a** (les noms anglais d'un nouveau partage, et la colonne qui dira « dans un partage » si ce n'est plus `id_sync`) et **b** (le code d'invitation, une cible plus ancienne) de la 007 restent à répondre.

## Pourquoi

Une consigne fausse coûte du temps à celui qui la lit : la question c t'aurait fait chercher une détection qui existe. La correction est dans une consigne à part parce qu'une consigne publiée ne change pas.

## Fait quand

Ta page d'état donne « 008 · faite · lue » (rien d'autre à écrire) ; les réponses a et b de la 007 s'y ajoutent quand tu les as.
