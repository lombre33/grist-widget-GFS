# 020 · GFS déclare la lecture de la langue et de la devise du document : ta demande `_grist_DocInfo` est acceptée

App : Grist-BI · posée le 18/11/2026 · remplace rien · réponse à ta demande `_grist_DocInfo` (page à `0b7b77f`) et à la ligne de ta 018 qui disait qu'elle était refusée · décision du porteur du 18/11 (carte « Laisser Grist-BI lire la langue et la devise du document ? » : « Oui, lecture seule ») · contrats 3.2 (point 4), 3.3 (point 3)
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. La lecture est déclarée dans ton manifeste de GFS** : `permissions.gristInterne` porte maintenant une troisième entrée, `_grist_DocInfo`, `lit: true`, avec son pourquoi en français et en anglais (« Connaître la langue et la devise du document pour écrire un nombre ou un montant comme la colonne qui le porte »). Le courtier ne l'ouvre qu'en **lecture** : une écriture dans `_grist_DocInfo` reste refusée (« n'est jamais écrite par une app »), comme pour Publipostage+ depuis le 21/10. Il filtre par table, pas par colonne : ton `readColumnFormats` lit `documentSettings`, rien de plus n'est utile, et GFS n'ouvre aucune autre table interne pour toi (`_grist_Attachments`, `_grist_Shares` restent refusées).

**2. Mesuré avec ta vraie app** (la copie que GFS référence, à `ca75d36`), dans un vrai Grist (grist-static, 700 × 400, `labo/run-bi-docinfo.mjs`, 8 vérifications sur 8 en français et en anglais) : `fetchTable('_grist_DocInfo')` rend `documentSettings` (`{"locale":"en-US","engine":"python3"}` dans le document d'essai) ; **ton `readColumnFormats('Clients')` rend les trois colonnes et `docSettings: { locale: "en-US" }`**, sans se replier ni avertir ; l'écriture est refusée et les réglages du document restent tels quels.

**3. Ce que tu fais** : rien. Ton repli sur « Automatique » (le `try` de `readColumnFormats`) reste utile hors de GFS et si la lecture échoue un jour ; tu peux sortir ta demande `_grist_DocInfo` de « Demandes à GFS ». Ta seule réserve, dans le commentaire de `js/grist-api.js` (« la forme exacte de ces deux tables n'a PAS été vérifiée sur un vrai document Grist ») : elle est maintenant vérifiée pour `documentSettings` (un texte JSON : `{"locale":"en-US","engine":"python3"}` dans le document d'essai ; ta fonction `parseDocSettings` lit `locale` et `currency`). Dans GFS, la devise n'a pas été mesurée avec un document qui en porte une : à confirmer par toi avec un vrai document si tu veux la dire dans ton commentaire.

Ce que cette consigne **ne** demande **pas** : aucun code, aucune bibliothèque, aucun nom de table ou de colonne de plus, aucune écriture.

## Pourquoi

Le porteur a répondu « Oui, lecture seule » le 18/11. C'est la même lecture que Publipostage+ a depuis le 21/10, limitée à deux réglages du document ; elle rend complet le réglage « Format des nombres : comme dans la colonne » de tes tuiles dans GFS.

## Fait quand

`GFS-ETAT.md` dit « 020 · lue » (aucun code) et ta demande `_grist_DocInfo` sort de « Demandes à GFS ».
