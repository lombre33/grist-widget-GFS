# 028 · Ta page du 21/10 (soir) : la référence à `4f00ac2`, le bouton ▶ mesuré dans GFS, épingler, ranger et renommer depuis GFS

App : Publipostage+ · posée le 21/10/2026 · répond à ton `GFS-ETAT.md` (`b711d80`, qui décrit `4f00ac2`) · quand : au prochain
lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. La référence avance de `487d66b` à `4f00ac2`** (`14cc617`, un commit à part, relu), le dernier commit de code que ta page
décrit. Relu (13 fichiers, un ajouté, aucun retiré) : la CSP d'`index.html`, la carte d'importation et la liste de
bibliothèques ne changent pas ; `index.html` ne monte que des `?v=` ; `extensions/diapositives/slide-show.js` place le bouton ▶
quand la pastille du zoom arrive, par le CSSOM ; la pagination vérifie chaque réserve sur le bloc qui ouvre la page suivante.
Ni appel à Grist, message, adresse ni stockage de plus : rien à déclarer. Le poids de Diapositives passe à **166 Ko** dans son
manifeste (166 402 octets).

**2. Le bouton ▶ « Présenter » mesuré dans GFS** (vrai Grist : grist-static 0.1.6 dans Chromium, 700 × 400, à la vraie souris
et au vrai clavier, en français / clair et en anglais / sombre ; `prototype/labo/run-diapositives.mjs`, 58 vérifications sur 58
dans les deux combinaisons, une de plus que pour la 026) : juste après le double-clic de l'explorateur, qui ouvre ton app sur
une présentation, le bouton est montré, à gauche de la pastille du zoom, sur sa ligne, en bas du panneau ; il se clique à la
vraie souris, la barre de GFS (au bord gauche par défaut) ne le recouvre pas.

**À savoir** : avec le `slide-show.js` de `487d66b`, la même vérification passe aussi : ce geste ne reproduit pas le cas que ta
page décrit (la pastille construite après la bande). La mesure dit donc que le bouton est à sa place, pas que le cas est
corrigé. **Non mesuré** : les pages qui commencent où elles doivent (`daaf364` ; ta page dit que le geste ne se reproduit pas
dans tes essais non plus), après un rechargement du cadre, Firefox, Safari.

**3. L'`INDEX.md`** passe la 026 et la 027 à « faite · lue, aucun code », comme ta page.

**4. À venir, rien à faire avant la consigne qui suivra** : le porteur a choisi ce soir que les fichiers de GFS épinglent,
rangent et renomment eux-mêmes, avant qu'aucune app ne soit ouverte. Les favoris et les dossiers iront dans la table de GFS
(`GFS_Rangement`) ; ton rangement à toi (`Publipostage_PreferencesModeles`) reste le tien, celui de l'app seule. Pour
renommer, GFS écrira **la seule colonne `Nom`** de tes modèles (choix du porteur : « Oui, le nom seul ») ; la consigne qui
viendra avec le contrat te dira quoi faire pour ne jamais remettre l'ancien nom (un modèle ouvert que tu enregistres avec le
nom gardé en mémoire). Dupliquer et supprimer restent à toi.

## Pourquoi

Ta page décrit deux corrections ; GFS avance la référence au fur et à mesure (le porteur, 20/10) et mesure ce qui se voit dans
son cadre : le bouton ▶ à l'ouverture par GFS.

## Fait quand

`GFS-ETAT.md` donne « 028 · faite · lue, aucun code ».
