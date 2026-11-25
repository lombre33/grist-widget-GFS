# 102 · GFS lit la table qui a des lignes quand un document porte deux noms (livré), et deux questions sur la version « Beta » et la version live

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 25/11/2026 · remplace rien · suite du point 4 de la 096 · décision du porteur du 25/11 (« tout en anglais partout, aucun document perdu, ne pas multiplier les tables ») · faits vérifiés 155 et 158
quand : à lire au prochain lot ; aucun code dans l'app ; deux réponses à donner dans « Demandes à GFS »

## Quoi

**1. Livré : GFS lit comme toi quand un document porte les deux noms d'une table.** Un document où une ancienne copie de l'app a recréé `Publipostage_Modeles` (ou `_PreferencesModeles`) à côté de `Publipostage_Templates` : GFS lit **la table qui a des lignes** ; si les deux en ont, ou si aucune n'en a, **l'anglaise**. Une colonne qui porte deux noms (`Nom` et `Name`) : l'anglaise. Mesuré dans un vrai Grist 1.7.19 avec ta version `ea0112b` (`prototype/labo/run-noms-cas.mjs`, cas `doublons`) : table anglaise à 18 modèles et table d'avant vide, GFS montre les 18 ; les deux avec des lignes, GFS montre l'anglaise et son F2 écrit dans l'anglaise ; anglaise vidée, GFS montre les modèles de l'ancienne. Avant ce lot, GFS lisait la table d'avant (0 modèle affiché alors que tu en avais 18). Ta fenêtre « Réunir » reste la voie pour la personne. **GFS lit toujours les deux jeux de noms, sans date de fin** (décision du porteur, 25/11) : un document que personne n'a rouvert dans ta nouvelle version, ou restauré d'une sauvegarde, reste lisible.

**2. Ce que le porteur a décidé le 25/11.** Tout passe en anglais partout (code, tables, colonnes) ; l'interface reste française et anglaise ; **aucun document ni arborescence perdu**, **pas de table de plus**. Il a dit que les gens sont toujours sur le lien de la dernière version : il n'y a pas de sortie en deux temps à prévoir pour la version live, sauf pour le code « legacy » de la Beta (question b).

**3. À venir, pas encore une demande : ne code rien avant la consigne qui le dira.** Le porteur a choisi (25/11) qu'à la première ouverture d'une version qui renomme, l'app montre une **fenêtre commune** (dans le kit) : elle dit ce qui change (les noms seulement) et ce qui ne change pas (les lignes, leurs numéros, leur contenu), que c'est l'affaire de quelques secondes, et **elle ne se passe pas**, mais **seulement pour qui peut modifier la structure**. Mesuré (vrai Grist 1.7.19, ton lot de renommage, 28 actions) : le propriétaire passe ; un éditeur passe dans un document sans règle, et reçoit **403** (« Blocked by full structure access rules », avec la raison de GFS) quand GFS a fermé la structure, sans rien renommer ; un lecteur reçoit 403 (« No write access »). Le lot dure environ **une seconde pour 30 000 lignes (44 Mo)**. Aujourd'hui, ton `migrate()` saute dans GFS (`isHostedByGfs()`) : cela change quand GFS laissera une app renommer ses tables déclarées, avec la consigne qui suivra.

**4. Deux questions** (tes réponses vont dans « Demandes à GFS » de `GFS-ETAT.md`) :
- **a.** Quelle version est servie aux gens (le « live »), et lit-elle déjà les deux jeux de noms ? Si elle ne les lit pas, dis ce qui se passe devant un document déjà en anglais.
- **b.** Le porteur demande s'il est possible de publier quelque chose dans le code « legacy » de la Beta de Publipostage+. Ce qu'il voudrait : une dernière version qui, devant un document **déjà aux noms anglais**, ne recrée **pas** les tables d'avant, et dit à la personne « ce document a été mis à jour par une version plus récente : ouvrez la dernière version ». Dis où cette Beta est servie, si ton projet peut y publier, et ce qui serait sûr de faire. GFS ne pousse jamais dans ton dépôt.

## Pourquoi

La 096 te promettait cette règle : sans elle, GFS et ton app lisaient deux tables différentes dans un document aux deux jeux de noms. Les deux questions viennent du risque mesuré le 25/11 : une ancienne copie devant un document renommé recrée des tables vides en français à côté, sans perdre de données mais en les cachant.

## Fait quand

`GFS-ETAT.md` donne la ligne « 102 · faite · lue » avec tes réponses aux questions a et b, et la mention « livré » du point 1 lue (ou un écart si ton `migrate()` lit autrement les deux noms d'une table).
