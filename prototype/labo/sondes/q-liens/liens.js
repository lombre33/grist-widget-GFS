// Sonde Q du labo (contrats 5.4, points 2 et 7) : une app minimale qui lie des fichiers d'autres apps, comme le fera Tuesday. Elle demande `contexte`, garde l'`ouverture` qu'on lui rend, répond
// à l'appel `ouvrir` de GFS quand elle est déjà ouverte, et, à un clic sur ses deux boutons, appelle `choisir` et `ouvrir` chez GFS avec la demande que le labo a posée dans `body[data-choisir]`
// et `body[data-ouvrir]`. Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit : `resultats` garde, dans l'ordre, la réponse de GFS à chacun de ses appels.
// Elle répond aussi à `fermer` (contrats 5.4, point 3) quand `body[data-fermer]` vaut `oui` ou `non` ; sans lui, comme avant : GFS_INCONNU. Les appels reçus sont dans `fermer`.
(function () {
  'use strict';
  var received = { contexte: false, ouverture: null, appels: [], resultats: [], fermer: [] };
  var waiting = {};
  var next = 10;
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var answered = function (msg) {
    var name = waiting[msg.id];
    if (!name) return;
    delete waiting[msg.id];
    received.resultats.push(msg.type === 'reponse' ? { nom: name, ok: true, data: msg.data } : { nom: name, ok: false, code: msg.code, message: msg.message });
    publish();
  };
  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      received.contexte = true;
      received.ouverture = (msg.data && msg.data.ouverture) || null;
      publish();
    } else if (msg.type === 'reponse' || msg.type === 'erreur') {
      answered(msg);
    } else if (msg.type === 'appel') {
      if (msg.nom === 'fermer' && /^(oui|non)$/.test(document.body.dataset.fermer || '')) {
        received.fermer.push(msg.args);
        publish();
        post({ gfs: 0, type: 'reponse', id: msg.id, data: { ferme: document.body.dataset.fermer === 'oui' } });
        return;
      }
      if (msg.nom !== 'ouvrir') {
        post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
        return;
      }
      received.appels.push(msg.args);
      publish();
      post({ gfs: 0, type: 'reponse', id: msg.id, data: { ouvert: document.body.dataset.reponse !== 'non' } });
    }
  });
  var ask = function (name) {
    var id = next++;
    waiting[id] = name;
    post({ gfs: 0, type: 'appel', id: id, nom: name, args: JSON.parse(document.body.dataset[name] || '{}') });
  };
  document.getElementById('choisir').addEventListener('click', function () { ask('choisir'); });
  document.getElementById('ouvrir').addEventListener('click', function () { ask('ouvrir'); });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  // Comme une app de Grist (le script d'API dit « prête », puis « thème posé ») : GFS la montre. Une sonde qui se tait reste cachée, et aucun clic ne l'atteint.
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  publish();
}());
