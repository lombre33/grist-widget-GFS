# 013 · La bibliothèque Excel (SheetJS, 882 Ko) ne se charge plus à l'ouverture : elle vient au premier export

App : Grist-BI · posée le 10/11/2026 · décision du porteur du 10/11 (carte « Demander aux apps de charger à la demande ce qu'elles n'utilisent pas ? »,
option « Form+ et Grist-BI d'abord ») · quand : au prochain lot, sans urgence ; du code dans ton app (un chargeur et deux lignes) ; vaut aussi dans
l'app seule

## Quoi

**1. Dans `index.html`, retire la balise de SheetJS** (à `c5cdd30`, la ligne 15) :

```html
<script src="js/vendor/xlsx/xlsx.full.min.js"></script>
```

**2. Dans `js/export.js`, charge-le au moment d'exporter.** `exportDashboardToExcel` teste aujourd'hui `typeof XLSX === 'undefined'` puis s'en sert :
avant ce test, attends le chargement de `js/vendor/xlsx/xlsx.full.min.js` (une petite fonction qui ajoute un `<script src>` à cette adresse relative,
une seule fois, et rend une promesse qui se résout au `load`). Garde le test et son message pour un chargement qui échoue.

- Le fichier reste le tien, dans `js/vendor/xlsx/`, sur la même origine que la page : aucune adresse nouvelle, aucun CDN, la politique de sécurité n'a
  rien à changer.
- L'adresse est écrite dans ton code, jamais lue dans un réglage, une table ou un message.

**3. Tes essais qui parlent de `XLSX`** (les essais Playwright de l'export) passent par le bouton d'export, ou chargent le fichier avant d'appeler la
fonction.

**4. Mesure chez toi, avant et après** (onglet Réseau, cache vidé, ouverture du rapport) : le nombre de requêtes et les octets reçus au premier
affichage. Écris les deux nombres dans ton `GFS-ETAT.md`.

Ce que cette consigne **ne** demande **pas** : ECharts (1 Mo) reste chargé à l'ouverture, toute tuile graphique en a besoin ; DuckDB-WASM est déjà
paresseux.

## Pourquoi

GFS a mesuré le 10/11 l'ouverture de ses apps sous Firefox, dans un vrai Grist (audit vitesse et poids). Grist-BI charge 2,3 Mo (776 Ko compressés) au
démarrage, dont ECharts (1 Mo) et SheetJS (882 Ko) ; SheetJS ne sert qu'à l'export Excel (`js/export.js`, `exportDashboardToExcel`). L'app s'affiche en
658 ms sur un réseau ADSL simulé (25 requêtes, 802 Ko envoyés) et prend de 55 à 70 Mo de mémoire de plus à son ouverture ; presque 40 % du poids du
démarrage ne sert qu'à qui exporte. Décision du porteur du 10/11.

## Fait quand

- `index.html` ne charge plus `xlsx.full.min.js` ; la page ouverte ne le demande pas (onglet Réseau) ;
- le premier clic sur « Export Excel » charge le fichier puis télécharge le classeur comme avant ; un chargement qui échoue montre le message d'avant ;
- les mesures avant et après sont dans `GFS-ETAT.md`.
