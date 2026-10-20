// Sonde L du labo (contrats 5.2, point 2) : une app minimale qui fait ce que fera Publipostage+ avec la consigne 019. Elle demande `contexte` au démarrage, note la `langue` qu'on lui rend et
// celle de l'adresse de son cadre, puis note chaque événement `langue` de GFS et, comme le ferait une app qui se recharge, redemande son contexte. Ce qu'elle a reçu est écrit dans
// `document.body.dataset.sonde`, que le labo lit.
(function () {
  'use strict';
  var received = { adresse: new URLSearchParams(location.search).get('language'), contextes: [], evenements: [] };
  var nextId = 1;
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var askContext = function () { post({ gfs: 0, type: 'appel', id: nextId++, nom: 'contexte', args: {} }); };
  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse') {
      received.contextes.push({ langue: (msg.data && msg.data.langue) || null, culture: (msg.data && msg.data.culture) || null });
      publish();
    } else if (msg.type === 'evenement' && msg.nom === 'langue') {
      received.evenements.push(msg.data);
      publish();
      askContext();
    }
  });
  askContext();
  publish();
}());
