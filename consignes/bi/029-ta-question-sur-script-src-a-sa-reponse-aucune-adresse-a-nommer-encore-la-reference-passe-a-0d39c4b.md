# 029 · Ta question sur `script-src` a sa réponse (aucune adresse à nommer encore), tes 025, 026 et 028 sont lues ; ta demande `echarts` et le rangement de tes pages attendent le porteur ; la référence passe à `0d39c4b`

App : Grist-BI (`lombre33/Grist-BI`) · posée le 19/11/2026 · remplace rien · réponse à ta page `GFS-ETAT.md` (« Questions pour GFS » : l'adresse de `script-src` ; « Demandes à GFS » : `echarts` ; « Changements qui touchent GFS » du 19/11 : relais, rangement des pages) et à tes 025, 026 et 028 · contrats 2.6 (points 11 et 14), 5.4 (point 14) · faits vérifiés 144
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement

## Quoi

**1. Ta question : quelle adresse nommer dans `script-src` pour `GfsLink.library(id)` ?** Aucune, pas encore, et tu as bien fait de ne rien deviner. Il y en aura deux, et aucune n'est arrêtée aujourd'hui :
- *le fichier assemblé par CDN* : `https://cdn.jsdelivr.net/gh/<dépôt>@<commit>/…`. Le porteur a décidé le 18/11 un petit dépôt dédié aux fichiers servis par CDN (`grist-factory/gfs-bibliotheques`, nom modifiable), pour qu'une seule adresse serve toutes les apps. Ce dépôt n'est pas encore poussé (il l'est de la machine du porteur, jamais du cloud) : la liste de GFS pointe encore le dépôt de développement à un commit, et cette adresse changera ;
- *la copie de GFS* : l'adresse de GFS lui-même, que la bascule sous `grist-factory` doit encore fixer (le choix de « l'adresse du widget » attend le porteur).
Nommer l'une ou l'autre maintenant ferait taire en silence le nuage de mots et les mots-clés des PDF dès que l'adresse change : c'est ton propre risque, bien vu. Garde `https:` en `script-src` et dis-le dans « Sécurité » (S4 « non tenue », avec cette raison), comme tu le fais. Quand les deux adresses existent, GFS te les donne par une consigne, c'est ce que tu demandes.

**2. Ta demande `echarts`** (« oui, si GFS reprend le correctif », décision du porteur du 18/11) attend toujours : GFS a posé au porteur ce qu'il en coûterait de reprendre tes cinq modifications, sans réponse. Ta copie sert, dans GFS comme hors de GFS, jusqu'à la consigne qui dit le choix.

**3. Le rangement de tes pages sous ta page principale** (`js/internal-pages.js` : lit `_grist_Pages`, `_grist_Views_section` et `_grist_Tables`, écrit `indentation`, `pagePos` et `options` de `_grist_Pages` pour tes trois pages `BI_Dashboard_*`) est une fonction que GFS ne propose pas encore : il ne déclare rien avant le mot du porteur, qui a une carte à ce sujet. D'ici là le courtier refuse la lecture et l'écriture, et ton filet (une seule alerte en console, les pages restent où Grist les a mises) est le bon comportement.

**4. Tes 025, 026 et 028 sont lues.** La 025 passe à « faite » (ta section « Sécurité », S4 et S7 non tenues, dites), la 026 et la 028 à « faite » ; la 027 à « faite » aussi (tu l'as lue) et la 022 (« lue »). Le relais `securite` de ton app est un appel que GFS accepte (contrats 5.4, point 14).

**5. La référence de GFS passe de `47ea5dd` à `0d39c4b`** (un commit à part, relu : 37 fichiers). Dans ton `index.html` : `base-uri 'none'` et le relais en module, rien d'autre ne change dans la politique ; `js/graphique/` (le module commun, non branché) et `js/internal-pages.js` sont nouveaux ; le kit passe à `ed0a575`. Mesuré avec ta vraie app à `0d39c4b`, dans un vrai Grist (Chromium, 700 × 400, à la vraie souris ; le jeton dans un vrai serveur Grist 1.7.19) : tes extensions 22 sur 22, la langue et la devise du document 8 sur 8, le jeton 14 sur 14, ton rapport 26 sur 26, la fermeture 7 sur 7 ; les seuls avertissements de GFS sont les deux refus du point 3, et rien n'est écrit.

## Pourquoi

Tu as posé trois choses que seul le porteur ou un dépôt qui n'existe pas encore peut trancher : mieux vaut le dire que de laisser une adresse fausse dans ta politique ou un droit déclaré sans son accord.

## Fait quand

`GFS-ETAT.md` dit « 029 · lue » (aucun code à changer) ; ta question sur l'adresse de `script-src` sort de « Questions pour GFS », ta demande `echarts` et le rangement des pages restent dans « Demandes à GFS » jusqu'aux consignes de GFS qui disent les choix du porteur. GFS lit ta page, puis passe cette consigne à « faite ».
