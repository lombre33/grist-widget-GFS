# 041 · Le CDN de la suite est jsDelivr : Leaflet quitte unpkg, et ton empreinte ne change pas

App : Form+ (`lombre33/FormPlus`) · posée le 25/11/2026 · décision du porteur du 25/11 (jsDelivr, secours = la copie de GFS et pas un deuxième CDN, « la migration vers le CDN retenu ») · cahier section 2 (dernière ligne) et 4.7, guide des apps 1.4 règle S5 · faits vérifiés 167 · suite des 028, 037 et 039
quand : au prochain lot, sans urgence ; un petit changement de code (deux constantes, une politique, un essai) ; Leaflet est inactif aujourd'hui (rien ne pose `window.FORMPLUS_ENABLE_MAP`), donc aucun effet visible

## Quoi

**1. Ce que le porteur a décidé le 25/11** (cahier, section 2) : **jsDelivr est le CDN de la suite**, chaque fichier se vérifie de bout en bout (version exacte, empreinte prise sur l'archive npm), et le secours sera **la copie figée de GFS, pas un deuxième CDN**. Les apps qui chargent encore depuis cdnjs ou unpkg passent à jsDelivr. La règle S5 du guide le dit désormais ainsi.

**2. Ce que GFS a mesuré** (faits vérifiés 167 : GitHub Actions, trois lectures par adresse, chaque fichier comparé à l'archive npm) : `leaflet@1.9.4/dist/leaflet.js` et `dist/leaflet.css` sont servis **à l'identique de l'archive npm** par jsDelivr (et par unpkg), et jsDelivr publie lui-même l'empreinte de chaque fichier, qui concorde. **Tes deux empreintes sha256 (`LEAFLET_CDN_JS_INTEGRITY`, `LEAFLET_CDN_CSS_INTEGRITY`) restent donc bonnes** : ce sont les mêmes octets. Le dossier d'images (`dist/images/`) n'est pas mesuré : c'est à toi de le vérifier (point 3.d).

**3. Ce que tu fais** :
- **a. Les deux adresses** : dans `poc/js/kinds.js`, `LEAFLET_CDN_URL` devient `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js` et `LEAFLET_CDN_CSS` devient `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css` ; garde les empreintes et le commentaire qui les explique (écris « jsDelivr » à la place d'« unpkg »).
- **b. La politique de `poc/widget.html`** : `script-src`, `style-src` et `img-src` nomment les mêmes trois adresses exactes (`…/dist/leaflet.js`, `…/dist/leaflet.css`, `…/dist/images/`) **chez `cdn.jsdelivr.net`**, et plus rien chez `unpkg.com`. Toujours une adresse exacte, jamais `cdn.jsdelivr.net` en entier (règle S4).
- **c. Tes essais** (`poc/js/tests.js`, la ligne qui liste les `img-src` permis, et ceux qui comparent les adresses de Leaflet à la politique) suivent ; un essai refuse `unpkg.com` dans la politique.
- **d. Mesure le marqueur** : avec la carte allumée dans un essai (`FORMPLUS_ENABLE_MAP`), l'image du marqueur s'affiche (la feuille de style la lit par un chemin relatif, qui suit son hôte) et la console ne signale aucune politique de sécurité du contenu bloquée.
- **e. Documents et `GFS-ETAT.md`** : `README.md` (la ligne de Leaflet, « chargé depuis `unpkg.com` »), `docs/06-carte-interactive.md` (elles nomment `unpkg.com`), puis dans `GFS-ETAT.md` : « Bibliothèques que l'app charge elle-même » (la ligne de Leaflet), « Adresses que l'app appelle » (les trois lignes d'unpkg deviennent jsDelivr) et « Changements qui touchent GFS ».

**4. Ce qui vient après, que tu ne fais pas maintenant** : le **secours** (GFS donnera l'adresse de sa copie figée, qu'une petite aide du kit prendra quand le CDN échoue ou tarde) : il ne te concerne que si Leaflet passe un jour par le catalogue de GFS, ce que ta 028 laisse au porteur. Rien d'autre à faire ici.

## Pourquoi

Le porteur veut un CDN vérifié de bout en bout, un seul hôte à nommer dans les politiques, et un secours qui ne dépende pas d'un second service. Pour Leaflet, l'empreinte ne change pas : c'est seulement l'hôte qui change. jsDelivr rend les octets de npm pour 21 fichiers sur 21, avec un cache permanent (`immutable`) ; unpkg les rend aussi, mais ne publie aucune empreinte à recouper et ne dit ni qui l'exploite ni son niveau de service.

## Fait quand

`GFS-ETAT.md` donne « 041 · faite · lue » avec le commit ; `poc/widget.html` ne nomme plus `unpkg.com` ; tes essais passent ; la carte allumée dans un essai charge le script, la feuille de style et le marqueur depuis jsDelivr sans erreur de politique. GFS relit ton dépôt au prochain contrôle du lundi et le dit dans « Sécurité ».
