// Sonde O du labo (V0.3, contrats 5.4 point 1) : une app minimale qui fait ce que fera Publipostage+ avec la consigne 010. Elle demande `contexte`, garde l'`ouverture` qu'on
// lui rend, puis répond à l'appel `ouvrir` de GFS quand elle est déjà ouverte. Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit.
// `body[data-reponse]` choisit sa réponse : `oui` ({ ouvert: true }), `non` ({ ouvert: false } : la personne annule la question de l'app), `inconnu` (une app qui n'a pas
// la porte : GFS_INCONNU, comme tout appel dont le nom n'est pas `ouvrir`), `echec` (une erreur de l'app : GFS_ERREUR et son texte), `muet` (la personne n'a pas encore
// répondu à la question de l'app : pas de réponse).
(function () {
  'use strict';
  var received = { contexte: false, ouverture: null, appels: [] };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      received.contexte = true;
      received.ouverture = (msg.data && msg.data.ouverture) || null;
      publish();
      return;
    }
    if (msg.type !== 'appel') return;
    if (msg.nom !== 'ouvrir' || document.body.dataset.reponse === 'inconnu') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
      return;
    }
    received.appels.push(msg.args);
    publish();
    if (document.body.dataset.reponse === 'muet') return;
    if (document.body.dataset.reponse === 'echec') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_ERREUR', message: 'Le modèle est introuvable.' });
      return;
    }
    post({ gfs: 0, type: 'reponse', id: msg.id, data: { ouvert: document.body.dataset.reponse !== 'non' } });
  });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  publish();
}());
