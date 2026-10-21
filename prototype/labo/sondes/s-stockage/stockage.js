// Sonde S du labo (contrats 5.3) : une app minimale qui fait ce que fera Publipostage+ avec ses choix. Elle demande `contexte` au démarrage et note le `stockage` qu'on lui rend ; le labo
// lui fait écrire (`window.sondeS.ecrire`, avec ou sans `id`) et redemander son contexte. Elle note aussi ce que son propre navigateur lui laisse faire : le sous-cadre à origine
// opaque n'a aucun stockage. Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit (jamais les valeurs envoyées : une valeur d'un mégaoctet n'y tiendrait pas).
(function () {
  'use strict';
  var received = { navigateur: null, contextes: [], reponses: [], erreurs: [] };
  var nextId = 1;
  var kinds = {};
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };

  // Le contexte rendu, en abrégé : les longueurs des valeurs toujours, les valeurs seulement quand elles sont courtes.
  var describe = function (context) {
    var space = context.stockage;
    var lengths = {};
    Object.keys(space).forEach(function (name) { lengths[name] = space[name].length; });
    var total = Object.keys(lengths).reduce(function (sum, name) { return sum + name.length + lengths[name]; }, 0);
    return { langue: context.langue, stockage: total < 20000 ? space : null, longueurs: lengths, total: total, proto: Object.getPrototypeOf(space) === Object.prototype };
  };

  var browserStorage = function () {
    try { window.localStorage.setItem('sonde', '1'); return 'accepté'; } catch (error) { return 'refusé'; }
  };

  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type !== 'reponse' && msg.type !== 'erreur') return;
    var kind = kinds[msg.id] || '?';
    if (msg.type === 'erreur') received.erreurs.push({ id: msg.id, kind: kind, code: msg.code });
    else if (kind === 'contexte') received.contextes.push(describe(msg.data));
    else received.reponses.push({ id: msg.id, kind: kind, data: msg.data });
    publish();
  });

  window.sondeS = {
    // `avecId` : l'app attend la réponse ({ retenu }) ou l'erreur ; sans, comme `stockage.ecrire` de la v0, aucune réponse. `extra` : des champs en plus dans les arguments (un message qui prétend viser une autre app).
    ecrire: function (cle, valeur, avecId, extra) {
      var args = { cle: cle, valeur: valeur };
      Object.keys(extra || {}).forEach(function (name) { args[name] = extra[name]; });
      var msg = { gfs: 0, type: 'appel', nom: 'stockage.ecrire', args: args };
      if (avecId) { msg.id = nextId++; kinds[msg.id] = 'ecrire:' + cle; }
      post(msg);
      return msg.id || null;
    },
    contexte: function () {
      var id = nextId++;
      kinds[id] = 'contexte';
      post({ gfs: 0, type: 'appel', id: id, nom: 'contexte', args: {} });
    },
  };
  received.navigateur = browserStorage();
  window.sondeS.contexte();
  publish();
}());
