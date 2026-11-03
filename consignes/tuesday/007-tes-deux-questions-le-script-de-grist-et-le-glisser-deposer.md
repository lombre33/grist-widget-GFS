# 007 · Tes deux questions du 02/11 : le script d'API de Grist et le glisser-déposer

App : Tuesday, et son fil Calendar+ pour le point 2 · posée le 03/11/2026 · réponse aux deux « Questions pour GFS » de ton `GFS-ETAT.md` (`d958504`) ·
quand : à lire maintenant ; le point 2 peut demander un changement de ta puce de calendrier

## Quoi

**1. Le script d'API de Grist.** Garde-le : il se charge de `https://docs.getgrist.com/grist-plugin-api.js` dans les deux modes, l'app seule et l'app dans GFS. Le cahier le dit
(4.7 : « le script d'API de Grist vient de `docs.getgrist.com` dans les deux modes », validé par la DINUM d'après le README d'Automation+), et GFS le charge de la même adresse :
sa politique de sécurité nomme ce fichier et garde `'unsafe-eval'` pour lui seul, comme la tienne. Le courtier ne le fournit pas : dans GFS, l'app le charge toujours, et son
`grist.ready()` parle à GFS comme il parlerait à Grist (contrats 4.1 et 4.2).

**2. Le glisser-déposer HTML5.** Il marche dans le sous-cadre de GFS. Mesuré le 03/11 dans un vrai Grist (Chromium, 700 × 400, `run-glisser.mjs`, faits vérifiés 13) : dans le cadre que
GFS pose (`sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"`, sans `allow-same-origin`), sous une politique sans style en ligne comme la tienne, l'app
reçoit `dragstart`, `dragover`, `drop` et `dragend` ; `dataTransfer` garde son texte ; l'effet retenu est `move` sur une cible et `none` hors de toute cible ; le cadre ne se recharge pas.
Vrai d'une carte (`<article draggable>`, ton kanban) comme d'une puce (`<button draggable>`, ton calendrier). **Pas mesuré** : Firefox (le labo n'a que Chromium), le tactile, le clavier.

**Un risque sous Firefox, lu et non mesuré.** Les fiches de Mozilla disent qu'un `<button draggable="true">` ne démarre pas de glissement avant Firefox 147 (bug 568313, corrigé dans la 147 ; le
bug 1967645, ouvert contre la 138, a été fermé comme doublon). Le porteur ne teste que sous Firefox, et son poste de travail était en 140 avant sa mise à jour du 28/10 (version d'arrivée
non donnée) : ta puce de calendrier (`js/ui/calendrier.js`, un `<button>`) peut ne pas glisser chez lui, là où ta carte de kanban (un `<article>`) glisse. Si tu veux t'en garder, fais porter
`draggable` à un élément qui n'est pas un bouton (comme ta carte), avec `tabindex` et `role` pour le clavier, et fais essayer la puce au porteur sous Firefox. Le fil Calendar+ garde la même règle pour
les événements de son module, qui glisseront aussi.

## Pourquoi

Ces deux questions étaient dans ta page d'état, avec « à mesurer au labo » pour la seconde. Le script d'API se lisait déjà au cahier ; le glisser-déposer demandait une mesure dans le cadre de GFS, faite
avec une sonde qui reprend ton gabarit. GFS la rejouera avec Tuesday lui-même à son entrée au catalogue.

## Fait quand

`GFS-ETAT.md` donne « 007 · lue » maintenant. Elle passe à « 007 · faite · `commit` » quand `draggable` n'est plus porté par un `<button>` dans tes vues, ou quand le porteur a vu ta puce glisser sous
Firefox. Pour le fil Calendar+, la règle vaut pour son module dès sa première vue qui glisse (lot 6 de son plan).
