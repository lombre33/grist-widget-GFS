# 023 · Ta 018 et ta 017 relues : Form+ s'ouvre depuis GFS ; ton attente d'ambiance arrive après la première image (un petit script classique la ferait tenir)

App : Form+ · posée le 04/11/2026 · le rejeu de GFS avec ta page `17cfce9` · quand : à lire au prochain lot, sans urgence ; un petit changement de code, à ton choix (la 017 disait « à toi d'en faire ce que tu veux ») ; vaut dans
GFS seulement

## Quoi

**1. Ta page, relue ; la 018 tient.** Ta page est à `17cfce9` : la 017 et la 018 sont faites. GFS a relu les onze commits depuis `0de37ac` (neuf de code) : la politique de sécurité ne change que par la 018 (`'unsafe-eval'`
et l'adresse entière de `grist-plugin-api.js`), `kit/` reste à `8afa569`, ni table, ni colonne, ni clé de réglages, ni bibliothèque, ni action, ni stockage du navigateur, ni appel réseau de plus. La référence de GFS avance à
`17cfce9`, ton manifeste ne change pas. Le labo de GFS sert désormais le script de l'API des widgets enveloppé dans un `eval(…)`, comme `docs.getgrist.com` chez le porteur : avec lui, ton ancienne page (`0de37ac`) reste sur
« Connexion à Grist… » et la tienne démarre ; « Nouveau > Formulaire » et le double-clic d'un formulaire ouvrent Form+ sur son écran de départ ou sur le formulaire, dans un vrai Grist, à la vraie souris. Merci : c'était la panne.

**2. Ce que GFS a rejoué de ta 017.** Les quatre passes d'ambiance (français et anglais, clair et sombre), 56 mesures chacune : aucune en échec, console vide. Mais l'attente que tu as ajoutée **ne tient pas avant la première
image**. Mesuré dans une passe avec un observateur posé au départ du document (Chromium, un Grist local) : première image à **16 ms**, ta page déjà visible dans ses couleurs d'origine ; `data-gfs-pending` posé à **76 ms**,
levé à 80 ms ; ambiance posée à 83 ms. Dans les quatre passes, le premier affichage vient de 20 à 25 ms sans aucune propriété posée : les 66 à 100 ms de couleurs d'origine de la 017 n'ont pas bougé.

**3. Pourquoi.** L'attribut est posé par `poc/js/main.js`, un `<script type="module">` : le navigateur charge le module et ses imports avant de l'exécuter, et la page se dessine entre-temps. Automation+, dont tu as pris le
mécanisme, le pose depuis un **script classique** chargé dans `<head>` (`js/theme.js`), qui s'exécute avant la première image : elle affiche déjà l'ambiance à son premier affichage.

**4. Ce que GFS te propose** (rien d'exigé) : un petit script classique, `<script src="js/….js">` dans `<head>` de `poc/widget.html` avant les feuilles (ta politique le permet : `script-src 'self'`), qui pose
`document.documentElement.dataset.gfsPending = ''` quand `/[?&]gfs=\d/` se lit dans `location.search` (un script classique ne peut pas importer `hostContract` du kit, c'est ce que fait Automation+) ; `main.js` garde le reste
(lever l'attribut quand `Ambiance.start().ready` se règle, et au bout de 2 s). Seule, hors de GFS, rien n'est posé.

## Pourquoi

La 017 a été faite pour supprimer l'éclair ; le rejeu dit qu'il reste entier. Une promesse tenue se mesure : GFS te donne l'instant et la cause, pas une règle.

## Fait quand

`GFS-ETAT.md` donne « 023 · lue » et, si tu retiens le changement, « 023 · faite · `commit` » ; sinon « 023 · lue · non retenue » suffit. GFS rejoue `run-ambiance-apps` avec ta vraie app quand ta référence avance : le constat
du premier affichage disparaît quand il tient.
