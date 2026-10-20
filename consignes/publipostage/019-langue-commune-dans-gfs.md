# 019 · La langue est un seul choix, dans GFS : ce que ton app lit, écoute et grise

App : Publipostage+ · posée le 20/10/2026 · remplace le point 4 de la 018 (« langue lue, pas traitée ») et répond à ta
« Demande à GFS » de langue (ton `GFS-ETAT.md` à `69a3dc9`) · quand : au prochain lot ; du code dans ton app ; sans effet dans
l'app seule

## Quoi

**1. Le porteur a tranché (20/10).** Un seul choix de langue par personne, gardé par GFS, pour GFS et pour toutes ses apps :
le bouton « Langue » de l'explorateur de GFS offre « Comme Grist » (le défaut), Français et English ; le choix est retenu
sur le navigateur ; les apps ouvertes le suivent. Le contrat est écrit : contrats 5.2, point 6 (le détail), 1.3 point 3 et
5.3 point 4 ; cahier 5.7 ; guide, section 1.2, point 8.

**2. Ce que GFS fait déjà**, mesuré dans un vrai Grist avec une sonde qui joue le rôle de ton app (pas encore avec ton app) :

1. `contexte.langue` vaut toujours `fr` ou `en` : le choix de la personne, sinon la langue de Grist. Il fait foi à chaque
   appel `contexte`.
2. Le paramètre `language` de l'adresse de ton cadre porte la même valeur, **à la création du cadre seulement** : GFS ne
   recharge jamais ton cadre, donc l'adresse ne change plus. Après un rechargement que ton app fait elle-même, l'adresse
   garde l'ancienne langue et c'est le contexte qui dit la bonne (mesuré : adresse `fr`, contexte `en`).
3. Quand la langue qui vaut change, GFS envoie à ton app ouverte l'événement `langue` : `{ gfs: 0, type: 'evenement', nom:
   'langue', data: { langue: 'fr' | 'en' } }`, une seule fois par changement. Il n'en part aucun quand la personne choisit
   la langue que Grist donne déjà, ni quand elle revient à « Comme Grist » sans que la langue change.
4. `culture`, `fuseau` et `devise` ne bougent pas : ce sont ceux du document.

**3. Ce que ton app a à faire** (tout est dans le contrat, rien n'est ajouté ici) :

1. **Au démarrage dans GFS, prendre la langue de `contexte.langue`**, avant `pp_lang` et la langue du navigateur
   (`initialLang()` ne lit que ces deux-là). Comment ton app l'a avant de dessiner (attendre le contexte, comme elle le fait
   déjà pour le modèle de départ, ou partir de l'adresse et se corriger) est à toi. Seule, rien ne change.
2. **Écouter l'événement `langue`** : `GfsLink` ne connaît que `extensions`. Si la langue reçue n'est pas celle de l'app,
   elle suit comme elle suit aujourd'hui ton choix de langue (`changeLanguage`, `js/settings.js`) : la question Enregistrer,
   Abandonner, Annuler s'il y a des modifications en attente, puis le rechargement qui rouvre le modèle (`#pp-open`,
   `dc00b9d`). « Annuler » laisse la langue d'avant jusqu'au prochain démarrage ; GFS ne le voit pas et n'insiste pas.
3. **Griser ton choix de langue (Réglages) dans GFS**, avec la raison, jamais le masquer : « La langue se choisit dans Grist
   Factory Suite (bouton Langue de l'explorateur). » / « The language is chosen in Grist Factory Suite (Language button in
   the explorer). » Seule, il marche comme avant.
4. **Ajouter à tes tests du contrat** (guide, section 4) la lecture de `contexte.langue` et l'événement `langue`.

**4. Ce que ton app n'a pas à faire.** Aucun stockage : la langue ne passe plus par celui du courtier (contrats 5.3, point
4). Aucune clé, table ni manifeste de plus ; la CSP, la carte d'importation et le poids de tes extensions ne changent pas.

**5. Après ton commit**, pose une demande de référence dans les « Demandes à GFS » de ton `GFS-ETAT.md`. GFS avance la
référence (commit à part, relu) et rejoue avec ton app ce qu'il a mesuré avec la sonde : ton app ouverte en français, la
langue changée en anglais depuis l'explorateur (avec et sans modifications en attente), le même modèle rouvert dans la
langue choisie, rien de plus dans l'adresse du cadre que ce que GFS y a mis.

**6. Le reste est comme dans la 018** : le titre d'impression (011), l'adresse définitive du CDN (016), le délai réel d'une
frappe, et ce qui n'est pas mesuré (deux personnes en même temps, Firefox, Safari, le réseau réel, le vrai jsDelivr).

## Pourquoi

1. Ta demande de langue (un seul choix, gardé par GFS, annoncé aux apps ouvertes) était la seule qui changeait un contrat ;
   le porteur l'a acceptée le 20/10, la 018 disait qu'une consigne suivrait : la voici.
2. Les apps ne gardent plus chacune leur langue dans GFS : c'était un confort par app que le cadre isolé ne permettait pas
   (pas de stockage), et que la personne devait refaire dans chaque app.
3. Ce que ton app sait déjà faire seule (poser sa question avant de partir, se recharger, rouvrir le modèle) suffit : GFS
   n'a pas à rejouer un geste que l'app sait faire.

## Fait quand

`GFS-ETAT.md` donne « 019 · faite · `<commit>` » quand : (a) ouverte dans GFS, ton app prend la langue de `contexte.langue`,
y compris quand elle diffère de celle du navigateur ; (b) l'événement `langue` la fait passer dans l'autre langue, après ta
question quand des modifications attendent, et elle rouvre le même modèle ; (c) ton choix de langue est grisé dans GFS avec
la raison, et marche comme avant dans l'app seule ; (d) tes tests du contrat jouent la lecture et l'événement ; (e) ta
« Demande à GFS » de langue s'en va avec la demande de référence qui suit.
