# 025 · Le kit 0.27.0 : avance ta référence du kit (ton README dit déjà `localStorage`, rien d'autre à écrire)

App : Automation+ (`lombre33/GRIST_automation`) · posée le 19/11/2026 · décision du porteur du 19/11 (« Tout le kit ») · kit 0.27.0 · contrats 1.2, point 4 · faits vérifiés 138
quand : à lire au prochain lot, sans urgence ; une référence du kit à avancer, aucun autre code ; décision du porteur du 19/11 (« Tout le kit »)

## Quoi

**1. Avance la référence du kit** au commit `ed0a575` (kit 0.27.0 ; l'étiquette `v0.27.0` est posée par le porteur depuis sa machine, la référence est le commit), dans un commit à part, relu. Tu es à `7aa030c` (kit 0.24.0). **Si ta 024 (kit 0.25.0, relais S8) n'est pas encore faite, avance une seule fois, directement à `ed0a575`** : il contient la 0.25.0 ; les points 2 à 5 de la 024 restent à faire, et son point 1 (`a1ed9db`) est dépassé par celui-ci. Rien ne change pour toi dans le code : aucune fonction ajoutée ni retirée, le contrat 5 est le même (CHANGELOG du kit, entrées 0.26.0 et 0.27.0).

**Ce que fait le lien du kit** (pour que tes essais ne te surprennent pas) : le tout premier message à GFS (la demande de `contexte`, qui ne porte aucune donnée) part toujours à `'*'` : l'app ne sait pas encore d'où elle est cadrée, et son cadre a une origine opaque. Dès le premier message valide de GFS (venu du cadre parent, au contrat de GFS), le lien retient `event.origin` (un `http(s)://hôte` sans chemin ; `"null"` et le reste ne sont pas retenus) et vise cette origine ensuite : le navigateur jette un message que le cadre parent, devenu une autre page, ne devrait pas lire. L'identification reste `event.source` (contrat 1, point 4). Une page parente qui joue GFS dans tes essais ne change rien.

**2. Rien à écrire dans ton README** : sa ligne « Dans le navigateur » nomme déjà `localStorage` (langue, thème, prise en main). C'est pour cela que ton stockage n'est que « mineur » à l'audit. Vérifie seulement qu'elle dit toujours vrai quand le kit 0.27.0 est avancé (le kit n'écrit dans `localStorage` que des choix d'affichage, sous les clés que ton app lui donne).

## Pourquoi

Le porteur a demandé le 19/11 pourquoi le kit fait chuter la note de l'outil d'audit `gw-audit` des apps qui l'embarquent. Deux constats « majeur » viennent d'un seul fichier du kit, `js/gfs-link.js` : une écoute de messages dont le garde était dans une autre fonction (l'outil ne lit que le corps de l'écoute) et un envoi vers GFS à `'*'`. Le kit 0.27.0 a écrit le garde dans l'écoute et vise l'origine de GFS dès son premier message. Mesuré (outil `015db5f`) : Automation+ 81 → 87, Grist-BI 57 → 60, GFS 70 → 73, le kit seul 93 → 96. **Une app n'en profite qu'en avançant sa référence du kit.** Mesuré aussi sous Chromium, Firefox 160 et dans un vrai Grist (faits vérifiés 138 de GFS). **C'est ton app qui en profite le plus : 81 → 87 d'après la mesure sur ton dépôt (`03ca9ba`).**

## Fait quand

Ta référence du kit est au commit `ed0a575` ou après, et ta page `GFS-ETAT.md` le dit (une ligne dans « Changements qui touchent GFS » avec la date et le commit, et ta ligne « Consignes » : « 025 · faite » avec le commit). GFS lit le dépôt de ton app (la référence du kit), puis passe cette consigne à « faite ».
