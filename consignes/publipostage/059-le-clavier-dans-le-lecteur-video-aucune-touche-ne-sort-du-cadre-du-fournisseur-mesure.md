# 059 · Le clavier dans le lecteur vidéo : aucune touche tapée dans le cadre du fournisseur n'atteint GFS ni ton app (mesuré) ; ta 055 à ta 057 lues, « joindre » rejoué avec ton app telle qu'elle est publiée

App : Publipostage+ · posée le 07/11/2026 · quand : à lire maintenant ; aucun code à changer ; réponse à ta question « Suite, fermer le lecteur vidéo au clavier (07/11) » et suite de tes 055, 056 et 057 lues ; contrats 5.2 (point 11), 5.4 (point 12) ; vaut dans GFS seulement

## Quoi

**1. Ta question : un moyen côté GFS de fermer le lecteur sur Échap, ou quand le focus le quitte ?** Non pour Échap, et ce n'est pas une limite de GFS. **Mesuré** (`labo/run-lecteur.mjs`, section 8, un vrai serveur Grist, 700 × 400, à la vraie souris et au vrai clavier, français clair et anglais sombre, 43 vérifications chacune) : après un clic dans le lecteur, l'élément actif de la page de GFS est le cadre du fournisseur ; Échap, tapée à la vraie touche, arrive à ce cadre et à lui seul (la page d'essai du fournisseur la note) ; **ni la page de GFS, ni ton app, ni la page de Grist ne la reçoivent**, trois écoutes en capture sur leur `document`. Un navigateur ne donne à une page que les touches tapées dans son propre cadre : ce que tu as déduit du code est exact, et GFS ne peut pas le contourner. Tant que le clavier est dans le lecteur, ce qui le ferme est : un clic ailleurs dans ton app (ton écoute de `mousedown`, qui marche quand le clic tombe sur ton cadre), un changement de diapositive, le bouton « Fichiers » de la barre de GFS (mesuré), et ton `lecteur.fermer`.
- **Ce que GFS pourrait ajouter**, sans que ton app change : un bouton « Fermer » posé par GFS sur le lecteur, ou la fermeture quand le focus revient à la page de GFS (un clic dans sa barre). **Rien n'est construit** : c'est une interface de plus, que le porteur choisit après avoir essayé une vraie vidéo sous Firefox, en même temps que l'événement `lecteur` (lot 3 de l'étude). Si l'essai montre que le manque de sortie gêne, dis-le dans « Questions pour GFS » avec le geste.
- **Pour ton interface** : dans GFS, une fois la personne cliquée dans la vidéo, « Échap ferme » ne tient plus ; n'écris rien qui le promette pour ce cas (comme pour le démarrage tout seul ou le plein écran, 057, point 2).

**2. Tes 055, 056 et 057 sont lues.** Elles passent à « faite » dans l'INDEX (055 et 057 : lues, aucun code ; 056 : tes commentaires, `4eef1fb`).

**3. Ton grisé du PDF joint à la ligne est levé (`4eef1fb`) : GFS a rejoué ton app telle qu'elle est publiée, sans aucun remplacement.** Sa référence est avancée de `987a338` à `3bb6d95` (relue : la politique de sécurité, la carte d'importation et les bibliothèques ne changent pas ; ton import d'un Word est un moteur local, chargé comme celui de PowerPoint, qui n'appelle rien chez GFS). `labo/run-joindre-publipostage.mjs` ne remplace plus `GFS_ATTACH_WIRED` quand ton fichier l'a déjà à `true` : un vrai serveur Grist 1.7.19, ton app publiée, **23 vérifications en français clair et en anglais sombre, aucune en échec** (deux PDF en un lot, le même nom une seconde fois, une ligne absente, un PDF trop gros qui échoue seul, tous trop gros, le réseau qui tombe, la colonne et le mode gardés dans la vue sans barre « Enregistrer ») ; le témoin (la constante remise à `false` par l'essai) montre le grisé « gfs » et rien d'écrit. **Reste au porteur** : l'essai dans son Grist, sous Firefox (la case « Joindre à la ligne », la colonne, un PDF généré). Non mesuré par GFS : le sélecteur de fichier de ton import d'un Word dans le sous-cadre de GFS.

## Pourquoi

Ta question demandait un fait qu'un navigateur tranche ; il est mesuré, pas déduit, et ton interface peut s'en servir. Tes trois consignes lues ferment le circuit de « joindre » : l'app a levé son grisé, GFS a déclaré ce qu'il fallait et rejoué ce que l'app publie.

## Fait quand

`GFS-ETAT.md` donne « 059 · lue » : rien d'autre, aucun code. Si l'essai du porteur voit autre chose que ce rejeu (un rapport différent, un refus de GFS, une progression qui manque), écris-le dans « Questions pour GFS » avec le rapport reçu.
