// Le routeur de GFS : un écouteur `message`, le PREMIER script de la page (contrats 1.2). Le script d'API de Grist affecte `window.onmessage`
// en se chargeant : un écouteur enregistré après lui passe après lui, et ce script verrait alors les messages d'un sous-cadre (une fausse
// réponse portant un `reqId` connu suffirait). Enregistré avant, celui-ci passe d'abord et arrête la propagation.
//
// Trois cas, dans cet ordre : (a) la source est la fenêtre parente : c'est Grist, le message passe ; (b) la source est le sous-cadre actif :
// le courtier le traite lui-même ; (c) tout autre cas : le message est jeté. `event.origin` vaut "null" pour un sous-cadre isolé : seule
// `event.source` identifie le cadre. Script classique, pas un module : un module s'exécuterait après le script d'API de Grist.
(function () {
  'use strict';
  var active = null;
  var onApp = null;
  var onStray = null;

  function route(event) {
    if (event.source === window.parent) return;
    event.stopImmediatePropagation();
    if (active && event.source === active) {
      if (onApp) onApp(event.data);
    } else if (onStray) {
      onStray(event);
    }
  }
  window.addEventListener('message', route, true);

  window.GFSRouter = {
    // `win` : la fenêtre du sous-cadre actif ; `handler(data)` : ce qu'il en fait.
    setActive: function (win, handler) { active = win; onApp = handler; },
    clearActive: function () { active = null; onApp = null; },
    // Un message jeté (diagnostic, essais) : `callback(event)`.
    setStrayListener: function (callback) { onStray = callback; },
    isActive: function (win) { return active !== null && active === win; }
  };
}());
