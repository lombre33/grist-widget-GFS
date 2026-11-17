# 068 · Le bouton « LanguageTool » de GFS : ton lien lit `correcteurs` et le kit 0.22.0 pose `data-lt-active="false"` sur chaque zone de texte, en Document, en Grille et en Slides+

App : Publipostage+ · posée le 12/11/2026 · remplace rien · demande du porteur (12/11 : un bouton dans la barre de GFS pour couper LanguageTool dans l'app, « il me faudra comme option sur Slides+, Document et Grille ») · contrats 5.2, point 13 · guide des apps, règle 21 · faits vérifiés 104
quand : avec ton prochain lot ; petit (un lien, une pose) ; du code dans le kit (fait, 0.22.0) et dans GFS (fait, `b5b84f9`), un peu dans ton lien

## Quoi

**Pourquoi un bouton.** Le porteur a LanguageTool dans Firefox. L'extension juge chaque cadre d'après **son** adresse : son interrupteur « pour ce site » ne coupe rien dans ton cadre (adresse de ton dépôt, non celle de Grist), et un gros diaporama de Slides+ ramait tant qu'il n'avait pas coupé l'extension à la main dans Firefox. **Mesuré par le porteur le 12/11** (faits vérifiés 104) : LanguageTool obéit à `data-lt-active="false"` posée sur la zone de texte **elle-même**, à chaud et sans recharger ; posée sur un élément qui l'entoure, elle ne coupe rien. GFS ne peut rien toucher dans ton cadre isolé : c'est toi qui poses la marque.

**Ce que GFS fait (déjà fait).** Le réglage « Bouton LanguageTool » du menu « Réglages » met un sixième bouton dans la barre de GFS ; enfoncé, LanguageTool travaille, relevé il est coupé. GFS te le dit : `contexte.correcteurs` (`{ "coupes": true | false }`, `{ coupes: false }` quand rien n'est coupé) et l'événement `correcteurs` (`{ "correcteurs": { "coupes": … } }`), une fois par changement. Sans le bouton dans la barre, rien n'est coupé.

**Ce que le kit fait (déjà fait : kit 0.22.0, `1fd425d`).** `createCorrecteurs({ link })` (`kit/js/correcteurs-pose.js`) marque `data-lt-active="false"` sur chaque `textarea`, `input` de texte et `contenteditable` de ta page (jamais un conteneur, jamais un mot de passe), **y compris ceux qui naissent après** (un `MutationObserver` qui n'existe que tant que « coupé » est vrai), et retire ses marques, et seulement elles, quand GFS dit « pas coupé ». `normalizeCorrecteurs` (`kit/js/correcteurs-message.js`) lit le message avec méfiance.

**À faire de ton côté, trois gestes, comme pour l'ambiance (consigne 041) :**

1. **Avance ta référence du kit à la 0.22.0** (`1fd425d`) ou plus récente, dans un commit à part et relu ; l'outil du kit refait ta carte d'importation : vérifie qu'elle nomme `kit/js/correcteurs-message.js` et `kit/js/correcteurs-pose.js` comme elle nomme `ambiance-message.js` et `ambiance-pose.js`.
2. **Dans ton lien (`js/gfs-link.js`)** : lis `contexte.correcteurs` et l'événement `correcteurs` par `normalizeCorrecteurs`, et rends `correcteurs()` et `onCorrecteurs(fn)` (abonné rappelé à chaque vrai changement ; `{ coupes: false }` seule ou avec un GFS qui ne dit rien), la forme même de `ambiance()` et `onAmbiance(fn)`.
3. **Une pose, dans un petit module à côté de `js/gfs-ambiance.js`**, hébergée seulement : `createCorrecteurs({ link: GfsLink }).start()` une fois, au démarrage (module d'entrée). **N'importe pas `kit/js/correcteurs.js`** : il démarrerait le lien du kit à côté du tien (deux liens dans un cadre numérotent chacun leurs appels depuis 1 et se prennent les réponses ; c'est pourquoi tu prends déjà `ambiance-pose.js` et non `ambiance.js`). Le module de pose ne se charge pas : l'app ne coupe rien et le dit une fois dans la console, comme pour l'ambiance.

**Document, Grille et Slides+ : une seule racine éditable à toi** (relu à `bcb7844`) : `js/editor.js` bâtit **un** TipTap sur `#editor-container` pour le document, la grille et la présentation de Slides+ ; `js/field-editor.js` en bâtit d'autres pour les champs (e-mail, nom de fichier) ; des fenêtres et l'extension `diapositives` (chargée à la demande, avec ses notes `slide-notes-ui.js`) ont leurs `textarea` et `input`. La pose du kit les marque tous, au démarrage comme à leur naissance : **tu n'écris rien par mode, rien dans l'extension**. Ne pose pas d'autre marque et ne retire pas celle du kit : si tu poses toi-même `data-lt-active` quelque part, le kit n'y touche pas (ni pour poser, ni pour retirer). Pas de bouton, pas de réglage chez toi : le bouton est celui de GFS. Seule, hors de GFS, tu ne poses rien.

## Pourquoi

Le porteur veut couper LanguageTool d'un clic, sans naviguer dans les réglages de Firefox à chaque fois, **dans les trois modes** de l'app : le document, la grille et la présentation (c'est là que la lenteur s'est vue : un gros diaporama, jusqu'à 2 400 cadres dans un seul éditeur). ProseMirror ne retouche que les attributs qu'il a posés lui-même (relu dans son code, **à confirmer au rejeu** : c'est la première vérification de « Fait quand ») : la marque sur la racine doit rester.

## Fait quand

`GFS-ETAT.md` donne « 068 · lue » ou « 068 · faite » avec le kit avancé (commit à part) et ton lien et ta pose. Rejouée dans une copie de GFS à `b5b84f9` ou plus récent (`TESTER-AVEC-GFS.md`), le réglage « Bouton LanguageTool » coché :
- **bouton relevé** (coupé) : la racine du TipTap (`.tiptap`, la même pour les trois) porte `data-lt-active="false"` **en Document, en Grille et en Slides+**, ainsi que les champs de tes fenêtres et la zone de notes de Slides+ ; **enfoncé** : aucune ne la porte ;
- une **fenêtre ouverte après le clic** et l'extension `diapositives` **chargée après** ont leurs zones marquées sans autre geste ; un autre modèle ouvert sans recharger le cadre garde l'état ;
- ton cadre n'est jamais rechargé par le bouton, et **seule**, hors de GFS, aucune marque et aucun avertissement dans la console.
Le porteur le mesure ensuite avec son LanguageTool dans Firefox (un gros diaporama de Slides+ ne rame plus quand c'est coupé) ; son retour vient à GFS par ta page ou par lui.
