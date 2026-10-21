# 003 · Réponses à ta page d'état : la carte, les écritures dans Grist, ton relevé

App : Form+ · posée le 21/10/2026 · réponse à ton `GFS-ETAT.md` (`2c0ee50`) · quand : à lire avant le prochain lot ; aucun
code à changer

## Quoi

**1. Lu.** GFS a relu ton dépôt jusqu'à `2c0ee50` : ta page d'état (la 001 et la 002 faites), la colonne cachée
`FormPlus_srcL_…` (`96cf415`, `ensureRefListField`) et la carte. Rien d'autre de ce qui est arrivé depuis `c1237a2` ne
touche ce que GFS suit : pas de table, de clé de réglages ni d'écriture dans `_grist_*` de plus. L'`INDEX.md` passe la 001
et la 002 à « faite ».

**2. Ta ligne du guide est corrigée** (section 3, relevé du 21/10 à `2c0ee50`). Tes écarts à la règle 2 (définition dans les
réglages de la vue) et à la règle 11 (aucune CSP) y étaient déjà. Corrigé : `_grist_Views_section` s'écrit dans
`poc/js/grist-meta.js` (`shareOptions` et `options`), pas dans `config-editor.js`, qui n'écrit que
`_grist_Views_section_field`. Complété : la règle 5 compte quatre lectures de `document.referrer`, pas deux ; en plus des
deux de `poc/js/links.js` (lignes 79 et 89), `poc/js/plugin-loader.js` (ligne 19) s'en sert pour choisir l'origine d'où
charger l'API des widgets, et `poc/js/diag.js` (ligne 12) le montre dans le diagnostic. Ajoute ces deux-là à ton état au
prochain lot, sans toucher au code : le kit les remplace à l'étape 3.

**3. Ta première question, sur la carte : garde le mécanisme autonome tel quel.** Ne le suspends pas, ne le change pas.
D'abord, l'app seule reste complète, et sa carte y est déjà grisée par défaut ; en changer le chargement avant que GFS porte
Leaflet retirerait une fonction sans rien donner en échange (on ajoute, on ne retire rien sans l'accord du porteur).
Ensuite, ce mécanisme est propre à l'app seule : dans GFS, ton app tourne dans un sous-cadre sans `allow-same-origin`, GFS
n'y pose aucun réglage de page (pas de `window.FORMPLUS_ENABLE_MAP`) et ne peut lui imposer aucune CSP. Ce sont
`contexte.extensions` (l'extension est-elle active ?) et `contexte.bibliotheques` (l'adresse et l'empreinte) qui diront à
l'app si la carte est permise et d'où la charger (contrats 2.6, points 3 et 4, et section 5). Une consigne dira ce qui
change chez toi quand le catalogue de GFS portera Leaflet ; d'ici là, rien.

**4. Ta demande Leaflet 1.9.4 : reçue, pas encore traitée.** Elle est notée dans `docs/apps.md`. Deux points attendent le
choix du porteur (question posée le 21/10) : Leaflet n'est pas un seul fichier (un script, une feuille de style et des
images) alors que le catalogue de GFS porte un fichier par bibliothèque et que le contexte ne connaît que les formes
`script` et `module` ; et les tuiles d'OpenStreetMap sont une adresse de plus dans une CSP (règle 11). Form+ n'étant pas
encore dans GFS, l'extension « carte » se déclarera avec ton manifeste (étape 5). Rien à changer chez toi d'ici là : la
réponse viendra dans une consigne.

**5. Ta deuxième question, sur les écritures dans `_grist_*` : oui, cela attend l'étape 5.** Rien à lister ailleurs d'ici là :
la raison écrite à côté de chaque écriture (règle 8) et ta page d'état suffisent. À l'étape 5, chaque écriture se déclare
dans le manifeste (une entrée `gristInterne` : la table, les colonnes écrites, `retire` pour retirer des lignes, une raison
en français et en anglais ; contrats 3.3, point 5, et 3.4, point 4) et le courtier refuse toute clé non déclarée. Deux
choses à savoir dès maintenant, parce qu'elles pèsent sur la définition de ton formulaire :

   - La colonne `options` de `_grist_Views_section` fait partie de ce que le courtier ne laisse jamais écrire à une app,
     quoi que le manifeste déclare (contrats 3.3, point 6) : elle porte `customView`, donc l'adresse et l'accès de chaque
     widget, GFS compris. `persistOptions` (`poc/js/grist-meta.js`, ligne 295), la copie d'un formulaire (ligne 216) et la
     réparation (ligne 315) ne pourront donc pas être déclarées. C'est la raison du premier pas de ta ligne du guide : la
     définition du formulaire dans une table préfixée, lisible par les répondants.
   - Créer une section (`CreateViewSection`, `poc/js/grist-meta.js`, ligne 70) demande la capacité `structure`, avec sa
     raison (contrats 3.4, point 3).

Rien de cela n'est à faire maintenant (001, point 3) : c'est pour ne rien bâtir dessus d'ici là.

## Pourquoi

1. Ta page d'état pose deux questions et une demande ; la boîte aux lettres veut une réponse écrite à chacune, et un relevé
   juste du guide pour que l'étape 5 ne parte pas d'un inventaire incomplet.
2. La colonne `options` et la capacité `structure` changent le chemin entre ton code d'aujourd'hui et un manifeste ; mieux
   vaut le savoir avant le prochain lot que le jour du manifeste.

## Fait quand

`GFS-ETAT.md` donne « 003 · faite · lue » après lecture ; aucun code n'est demandé ici. Si le guide corrigé te semble encore
faux ou incomplet, dis-le dans « Questions pour GFS ».
