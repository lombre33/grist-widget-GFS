// Sonde ZF du labo (contrats 2.4 `appel`, 5.4 points 10 et 11) : une app qui fait ce que fera Form+ avec les consignes 020 et 021. Elle demande `contexte`, dit « prête » par le vrai script d'API de Grist, puis répond aux
// appels `supprimer` (fermer ce qui est lié à un fichier avant que GFS le mette à la corbeille) et `dupliquer` (copier un fichier en entier : ici, une ligne de sa table, écrite par le courtier de GFS comme le fera
// Form+). Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit.
// `body[data-supprimer]` choisit sa réponse : `oui` ({ fait: true, dit }), `nu` ({ fait: true } sans phrase), `non` ({ fait: false, dit } : l'app ne ferme pas), `echec` (GFS_ERREUR et son texte), `muet` (pas de
// réponse) ; absent ou `inconnu` : une app qui n'a pas la porte (GFS_INCONNU). `body[data-dupliquer]` : `oui` (la ligne est copiée, { id, nom, dit }), `refus` (rien n'est copié : { dit }), `echec`, `muet`, `inconnu`.
(function () {
  'use strict';
  var received = { contexte: false, supprimer: [], dupliquer: [] };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var mode = function (name) { return document.body.dataset[name] || 'inconnu'; };
  var unknown = function (msg) { post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' }); };
  var answer = function (msg, data) { post({ gfs: 0, type: 'reponse', id: msg.id, data: data }); };
  var fail = function (msg, text) { post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_ERREUR', message: text }); };

  var onDelete = function (msg) {
    var how = mode('supprimer');
    received.supprimer.push(msg.args);
    publish();
    if (how === 'muet') return;
    if (how === 'echec') { fail(msg, 'Le lien public n’a pas pu être fermé.'); return; }
    if (how === 'non') { answer(msg, { fait: false, dit: 'Ce formulaire est en cours de publication.' }); return; }
    answer(msg, how === 'nu' ? { fait: true } : { fait: true, dit: 'Son lien public est fermé.' });
  };

  // La copie : l'app écrit elle-même la ligne (le courtier de GFS relaie son `AddRecord` à Grist) et rend l'identifiant que Grist a donné.
  var onCopy = async function (msg) {
    var how = mode('dupliquer');
    received.dupliquer.push(msg.args);
    publish();
    if (how === 'muet') return;
    if (how === 'echec') { fail(msg, 'La copie n’a pas pu être écrite.'); return; }
    if (how === 'refus') { answer(msg, { dit: 'Il faut un titre.' }); return; }
    try {
      var added = await grist.docApi.applyUserActions([['AddRecord', 'SondeZf_Fichiers', null, { Nom: msg.args.nom, Type: 'formulaire', DateModif: Math.floor(Date.now() / 1000) }]]);
      answer(msg, { id: added.retValues[0], nom: msg.args.nom, dit: 'Elle n’est pas publiée.' });
    } catch (error) {
      fail(msg, String((error && error.message) || error));
    }
  };

  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) { received.contexte = true; publish(); return; }
    if (msg.type !== 'appel') return;
    if (msg.nom === 'supprimer' && mode('supprimer') !== 'inconnu') { onDelete(msg); return; }
    if (msg.nom === 'dupliquer' && mode('dupliquer') !== 'inconnu') { void onCopy(msg); return; }
    unknown(msg);
  });
  grist.ready({ requiredAccess: 'full' });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  publish();
}());
