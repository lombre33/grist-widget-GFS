# 034 · « Échap » quitte l'édition de l'en-tête et du pied de page, comme « Terminer » (demande du porteur)

App : Publipostage+ · posée le 22/10/2026 · demande du porteur du 22/10 · quand : au prochain lot, sans urgence ; du code dans ton app
(un gestionnaire de touche) ; se voit aussi dans l'app seule

## Quoi

**1. La demande.** Le porteur, dans GFS : « quand on est dans le mode édition d'en-tête, il faut que Échap fasse revenir en arrière
(même action que le bouton Terminer) ». Le mode est celui de `js/header-footer-preview.js` (`hfMode`, l'en-tête ou le pied de page, par
défaut ou de première page) et le bouton, `#v2-hf-btn-done` (« Terminer » / « Done »), appelle `exitHeaderFooterMode()`.

**2. Ce que GFS a mesuré** (vrai Grist, panneau 700 × 400, au vrai clavier ; `prototype/labo/run-echap-entete.mjs`, nouveau). **GFS n'avale
pas la touche** : Échap, au vrai clavier, arrive dans ton cadre (un écouteur en capture compte l'appui). Dans le mode, Échap ne change
rien : ton module n'a aucun gestionnaire de touche (les autres `Escape` de l'app sont ceux des menus, des fenêtres et de quelques
outils : `modal-base.js`, `find-replace.js`, `free-frame.js`, `clean-reading.js`…). « Terminer » quitte le mode.

**3. Ce que GFS te demande** : tant que `hfMode` est actif, Échap appelle `exitHeaderFooterMode()`, comme « Terminer » (l'en-tête comme
le pied de page). Un menu, une fenêtre ou un outil ouvert gardent l'appui (même garde que `clean-reading.js` : `event.defaultPrevented`,
`event.isComposing`), pour que la fermeture d'un menu ne fasse pas aussi quitter le mode.

## Pourquoi

C'est la sortie que la personne cherche d'instinct d'un mode « à part » ; sans elle, il faut viser le bouton. Rien ne vient de GFS, qui
ne peut ni lire ni retenir une touche tapée dans ton cadre isolé.

## Fait quand

`GFS-ETAT.md` donne « 034 · faite · `<commit>` » ; le test échoue sur l'ancien code. GFS rejoue `run-echap-entete` : les deux « CONSTAT » (point 3
du labo, en-tête et pied de page) deviennent des vérifications.
