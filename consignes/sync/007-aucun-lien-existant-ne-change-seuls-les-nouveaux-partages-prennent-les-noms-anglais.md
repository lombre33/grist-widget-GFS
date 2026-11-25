# 007 · Aucun lien existant ne change : seuls les nouveaux partages prennent les noms anglais, et trois réponses dont GFS a besoin

App : Sync+ (`lombre33/grist-widget-one-way-sync`) · posée le 25/11/2026 · remplace rien · décision du porteur du 25/11 (« on ne fait pas de migration pour ne pas risquer de casser un lien : uniquement les nouveaux partages » ; « la garder aux anciens noms » pour une table que Sync+ partage) · kit 0.29.1 · guide des apps 1.1, point 15 · faits vérifiés 160 et 162
quand : à lire au prochain lot, sans urgence ; **aucun code avant ta réponse** ; trois réponses dans ta page d'état ; aucun nom nouveau ne se publie sur un partage avant que le kit le sache

## Quoi

**1. La décision du porteur (25/11).** Tout passe en anglais partout, **mais pas les liens que Sync+ a déjà créés** : **aucune migration**, ni de table, ni de colonne, ni de code d'invitation, pour ne risquer de casser aucun lien. **Seuls les nouveaux partages** prennent les noms anglais ; le moteur lit les deux jeux de noms, un lien existant garde les siens et continue. Sync+ est déjà chez beaucoup de gens : c'est ce qui rend la règle stricte.

**2. Ce que GFS a mesuré** (faits vérifiés 160, vrai Grist 1.7.19 et vrai moteur du kit) : quand une app renomme la table qu'un partage envoie, le lot d'envoi devient **vide, sans erreur** (`Synchro_Table` garde l'ancien nom en texte) ; quand elle renomme les colonnes, le lot part avec des **cellules vides** (`{"Nom": null, …}`) et la cible verrait ses lignes écrasées. Dans les deux cas, **le lien se tait ou envoie du vide, et personne n'est prévenu**.

**3. Ce que GFS a fait de son côté** (kit 0.29.1, faits vérifiés 162) : la fenêtre commune de mise à jour des noms des autres apps **ne renomme jamais** une table qui porte la colonne **`id_sync`** (celle que Sync+ pose sur toute table qu'il envoie ou reçoit), ni ses colonnes ; elle renomme le reste et dit « Une table garde son ancien nom (un partage Sync+ s'en sert) ». GFS repère par `id_sync` parce que **toutes les personnes la lisent** (`Synchro` est réservée aux propriétaires). Elle devrait les renommer à la réouverture quand le partage est supprimé (lu, **pas mesuré**). Mesuré avec la vraie Publipostage+ ; **pas mesuré** : une table d'app qui sert de **destination** à une réception.

**4. Trois réponses** (aucun code ; tes réponses vont dans ta page d'état) :
- **a.** Les noms anglais que tu prévois pour un **nouveau** partage (`Synchro`, `Journal_<export>`, `Synchro_Export`, `Synchro_Ids`, `Synchro_Renvoi`, `Synchro_Lot`, `Synchro_Cle`, `Synchro_Colonnes`, `MajLe`, `RecalculLe`, `id_sync`), et surtout **la colonne qui dira « cette table est dans un partage »** si ce n'est plus `id_sync` : le kit ne reconnaît que `id_sync`. **Un nouveau partage dont les tables ne portent plus cette colonne ne serait pas protégé de la fenêtre des autres apps.** Ne publie donc **aucun nom nouveau** sur un partage avant que GFS ait ajouté la nouvelle clé au kit : il te le dira par une consigne.
- **b.** Un nouveau partage aux noms anglais est un changement de protocole entre deux documents : « un nom qui voyage entre deux documents ne change qu'avec un numéro de version majeur » (guide 1.1, point 15 ; le `README` du moteur dit déjà que ces colonnes « ne changent pas »). Ton `CODE_FORMAT` est à 2 et un moteur plus ancien refuse un code plus récent (`codeNewer` : « le widget de ce document est en retard »). Dis ce qu'un **moteur ancien** affiche devant le code d'un nouveau partage, et ce que fait un **moteur récent** quand la **cible** est plus ancienne : le but est un message, jamais un lien qui se casse sans rien dire.
- **c.** Un lien dont la table source a été renommée **sans la protection** (à la main, ou par une app avant le 25/11) se tait aujourd'hui sans le dire. Le moteur peut-il le **détecter** (la table que nomme `Synchro_Table` n'existe plus, ou une colonne de `Synchro_Colonnes` manque) et le dire à la personne ? Réponds seulement oui ou non et ce que ça coûterait : GFS posera la question au porteur avant toute consigne de code.

## Pourquoi

La suite entière passe à l'anglais, et Sync+ est le seul endroit où un nom change de document à document : un renommage fait au mauvais moment casse un lien sans bruit chez quelqu'un qui n'y a rien fait. Le porteur a choisi de ne rien migrer, et de protéger les tables que Sync+ partage contre les autres apps ; il reste à s'assurer que les **nouveaux** partages se reconnaissent aussi, et qu'un moteur ancien le dise au lieu de casser.

## Fait quand

Ta page d'état donne « 007 · faite · lue » avec les réponses a, b et c.
