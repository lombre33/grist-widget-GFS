// Sonde P du labo (contrats 5.2 point 3 et 5.4 point 1) : une app minimale qui fait ce que fera Publipostage+ avec la consigne 035. Elle demande `contexte`, garde l'`ouverture`
// qu'on lui rend, répond à l'appel `ouvrir` quand elle est déjà ouverte, et LIT le fichier que `importation` lui apporte : son nom, sa taille, son type, s'il est bien un `File`, et son
// texte (c'est la mesure : un `File` envoyé par `postMessage` à un cadre isolé, sans `allow-same-origin`, se lit-il ?). Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`.
(function () {
  'use strict';
  var received = { contexte: false, ouverture: null, appels: [] };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  // L'ouverture telle que l'app la voit : le fichier de `importation` est décrit et lu, le reste est gardé tel quel.
  function describe(opening) {
    if (!opening || !opening.importation) return Promise.resolve(opening || null);
    var file = opening.importation.fichier;
    var plain = Object.assign({}, opening, { importation: { valeur: opening.importation.valeur } });
    plain.importation.estFichier = file instanceof File;
    plain.importation.nom = file && file.name;
    plain.importation.taille = file && file.size;
    plain.importation.type = file && file.type;
    return Promise.resolve(file && file.text ? file.text() : '').then(function (text) { plain.importation.texte = text; return plain; },
      function (error) { plain.importation.erreur = String(error && error.message || error); return plain; });
  }
  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      received.contexte = true;
      describe(msg.data && msg.data.ouverture).then(function (opening) { received.ouverture = opening; publish(); });
      return;
    }
    if (msg.type !== 'appel') return;
    if (msg.nom !== 'ouvrir') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
      return;
    }
    describe(msg.args).then(function (opening) {
      received.appels.push(opening);
      publish();
      post({ gfs: 0, type: 'reponse', id: msg.id, data: { ouvert: document.body.dataset.reponse !== 'non' } });
    });
  });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  publish();
}());
