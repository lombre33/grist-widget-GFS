// Après une navigation du cadre : GFS répond-il encore à cette page (le routeur reconnaît la fenêtre du cadre) ? La réponse est écrite dans body[data-ailleurs].
(function () {
  'use strict';
  document.body.dataset.ailleurs = 'attente';
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.gfs !== 0 || message.id !== 1 || (message.type !== 'reponse' && message.type !== 'erreur')) return;
    document.body.dataset.ailleurs = JSON.stringify({ type: message.type, hote: message.data && message.data.hote });
  });
  window.parent.postMessage({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} }, '*');
}());
