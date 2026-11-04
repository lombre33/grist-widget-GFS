# 049 · Ta phrase sur la langue nomme le bouton « Réglages » de l'explorateur : le bouton « Langue » n'existe plus

App : Publipostage+ · posée le 04/11/2026 · contrats de GFS 5.2 (points 6 et 10) · décision du porteur du 04/11 (rassembler les éléments de menu dans l'explorateur pour les uniformiser, puis « ok pour la capture 1 ») ·
quand : au prochain lot, sans urgence ; un texte à changer dans ton app (`settings.language.gfsNote`, en français et en anglais, et son texte de repli dans `index.html`) ; vaut dans GFS seulement (seule, l'app ne montre pas cette phrase)

## Quoi

**1. Ce que GFS fait depuis le 04/11.** L'explorateur n'a plus de bouton « Langue » ni de bouton « Thème » : un seul bouton **« Réglages »** (une icône à curseurs, le dernier de la ligne du titre, à droite de « Liste » et « Vignettes ») ouvre un menu
de quatre lignes : **Langue ▸** (Comme Grist, Français, English), **Thème…**, **Position de la barre ▸**, puis **À propos…**. Le choix de langue marche comme avant : même `contexte.langue`, même événement `langue`, ton app n'a rien à changer pour le recevoir.
Seul l'endroit où la personne le fait a bougé. La barre flottante au-dessus de ton app ne change pas.

**2. Ce que tu fais : changer ta phrase.** Dans l'onglet « Langue » de tes Réglages, ta phrase `settings.language.gfsNote` (`js/i18n.js`, et son texte de repli dans `index.html`, la ligne `settings-language-gfs-note`) renvoie la personne vers un bouton qui n'existe plus :

- fr : « La langue se choisit dans Grist Factory Suite (bouton Langue de l'explorateur). »
- en : « The language is chosen in Grist Factory Suite (Language button in the explorer). »

Proposition :

- fr : « La langue se choisit dans Grist Factory Suite (bouton Réglages de l'explorateur, ligne Langue). »
- en : « The language is chosen in Grist Factory Suite (Settings button in the explorer, Language row). »

Dis-le avec tes mots si tu préfères, à deux conditions : la phrase nomme le bouton « Réglages » (« Settings ») **de l'explorateur** (tes propres Réglages portent le même nom : sans « de l'explorateur », la personne les chercherait dans ton panneau)
et la ligne « Langue » (« Language »), et elle ne nomme plus un bouton « Langue ». Les mots sont ceux que GFS affiche dans la langue de la personne.

**3. Ce que tu ne fais pas.** Tes deux cases de langue restent grisées sous GFS (grisé, jamais masqué) et gardent leur `aria-describedby` sur cette phrase : rien d'autre ne change, ni `js/gfs-link.js`, ni la langue de l'adresse de ton cadre.

## Pourquoi

Le porteur a demandé, le 04/11, de rassembler les réglages éparpillés de l'explorateur selon les guides de Grist Factory (une barre partagée, une icône = une fonction) ; il a choisi la première des trois propositions : un seul bouton « Réglages » dans l'explorateur, la barre flottante inchangée
(contrats 5.2, points 6 et 10). Dans le code de Publipostage+ (`6a22dee`), GFS n'a trouvé le nom de l'ancien bouton que dans cette phrase (`js/i18n.js` et `index.html`) ; Form+ (`0de37ac`) et le kit (0.8.0) ne le nomment pas. La laisser envoie la personne chercher un bouton qui n'existe plus.

## Fait quand

`GFS-ETAT.md` donne « 049 · lue » maintenant, puis « 049 · faite · `commit` » quand tes deux textes (français, anglais) et celui de `index.html` nomment le bouton « Réglages » de l'explorateur et la ligne « Langue ». GFS le rejoue avec ta vraie app dans son labo
(`run-langue-publipostage` : son CONSTAT « elle nomme le menu « Réglages » de GFS » devient « OK ») quand ta référence avance, et passe la consigne à « faite » en lisant ta page.
