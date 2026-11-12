// Sonde ZL du labo (contrats 5.2, point 13) : une app minimale qui fait ce que fera le kit (`Correcteurs.start()`) après la consigne aux apps. Elle demande `contexte` au démarrage et pose la marque
// `data-lt-active="false"` sur chacune de ses zones de texte si `correcteurs.coupes` est vrai, la retire sinon ; elle refait de même à chaque événement `correcteurs` de GFS. Ce qu'elle a reçu et la marque
// qu'elle a posée sont écrits dans `document.body.dataset.sonde`, que le labo lit.
(function () {
  'use strict';
  var received = { contextes: [], evenements: [], marques: null };
  var nextId = 1;
  var EDITABLE = 'textarea, input, [contenteditable]';
  var mark = function (coupes) {
    var marques = {};
    Array.prototype.forEach.call(document.querySelectorAll(EDITABLE), function (node) {
      if (coupes) node.setAttribute('data-lt-active', 'false');
      else node.removeAttribute('data-lt-active');
      marques[node.id] = node.getAttribute('data-lt-active');
    });
    received.marques = marques;
  };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var askContext = function () { post({ gfs: 0, type: 'appel', id: nextId++, nom: 'contexte', args: {} }); };
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse') {
      var c = msg.data && msg.data.correcteurs;
      received.contextes.push(c === undefined ? 'absent' : c);
      if (c && typeof c.coupes === 'boolean') mark(c.coupes);
      publish();
    } else if (msg.type === 'evenement' && msg.nom === 'correcteurs') {
      received.evenements.push(msg.data);
      if (msg.data && typeof msg.data.correcteurs === 'object') mark(Boolean(msg.data.correcteurs.coupes));
      publish();
    }
  });
  askContext();
  publish();
}());
