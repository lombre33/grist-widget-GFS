// Sonde O du labo (V0.3, contrats 5.4 point 1) : une app minimale qui fait ce que fera Publipostage+ avec la consigne 010. Elle demande `contexte`, garde l'`ouverture` qu'on
// lui rend, puis répond à l'appel `ouvrir` de GFS quand elle est déjà ouverte. Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit.
// `body[data-reponse]` choisit sa réponse : `oui` ({ ouvert: true }), `non` ({ ouvert: false } : la personne annule la question de l'app), `inconnu` (une app qui n'a pas
// la porte : GFS_INCONNU, comme tout appel dont le nom n'est pas `ouvrir`), `echec` (une erreur de l'app : GFS_ERREUR et son texte), `muet` (la personne n'a pas encore
// répondu à la question de l'app : pas de réponse).
// `fermer` (contrats 5.4, point 3) : `body[data-fermer]` choisit la réponse. Absent ou `inconnu` : une app qui n'a pas la porte (GFS_INCONNU, comme avant). `oui` ({ ferme: true }), `non`
// ({ ferme: false }), `echec` (GFS_ERREUR et son texte), `muet` (pas de réponse : `window.__fermer(true | false)` y répond plus tard), `question` (la sonde pose dans sa page la question
// « Enregistrer / Abandonner / Annuler » que pose une app avec des modifications en attente : la personne y répond à la souris). Les appels reçus sont dans `fermer`, les boutons cliqués dans `reponses`.
// `rester` (contrats 5.4, point 3 : GFS dit « tu restes » à l'app qui avait répondu oui à `fermer`) : `body[data-rester]` choisit la réponse. Absent ou `inconnu` : GFS_INCONNU (une app qui n'a pas la porte). `oui` ({ repris: true }) ou `non`
// ({ repris: false }). Les appels reçus sont dans `rester`, qu'elle y réponde ou non.
(function () {
  'use strict';
  var received = { contexte: false, ouverture: null, appels: [], fermer: [], rester: [], reponses: [] };
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var closing = null; // l'id de l'appel `fermer` qui attend la réponse de la personne
  var answerClose = function (ok) {
    if (closing === null) return;
    post({ gfs: 0, type: 'reponse', id: closing, data: { ferme: ok } });
    closing = null;
    var box = document.getElementById('question');
    if (box) box.remove();
  };
  window.__fermer = answerClose;
  var showQuestion = function () {
    var box = document.createElement('div');
    box.id = 'question';
    box.setAttribute('style', 'position:fixed;left:60px;top:70px;padding:14px;background:#fff;color:#111;border:2px solid #333;z-index:9;font:14px system-ui,sans-serif');
    var text = document.createElement('p');
    text.textContent = 'Enregistrer les modifications ?';
    box.appendChild(text);
    [['enregistrer', 'Enregistrer', true], ['abandonner', 'Abandonner', true], ['annuler', 'Annuler', false]].forEach(function (item) {
      var button = document.createElement('button');
      button.id = item[0];
      button.type = 'button';
      button.textContent = item[1];
      button.setAttribute('style', 'margin-right:8px;padding:6px 10px');
      button.addEventListener('click', function () { received.reponses.push(item[0]); publish(); answerClose(item[2]); });
      box.appendChild(button);
    });
    document.body.appendChild(box);
    // Comme une app de Grist (le script d'API dit « prête », puis « thème posé ») : GFS la montre, et la souris atteint la question. Une sonde qui se tait reste cachée.
    post({ mtype: 5 });
    post({ mtype: 4, data: { message: 'themeInitialized' } });
  };
  var onClose = function (msg) {
    var mode = document.body.dataset.fermer;
    received.fermer.push(msg.args);
    publish();
    if (mode === 'muet' || mode === 'question') { closing = msg.id; if (mode === 'question') showQuestion(); return; }
    if (mode === 'echec') { post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_ERREUR', message: 'Enregistrement refusé par Grist.' }); return; }
    post({ gfs: 0, type: 'reponse', id: msg.id, data: { ferme: mode !== 'non' } });
  };
  var onStay = function (msg) {
    var mode = document.body.dataset.rester || 'inconnu';
    received.rester.push(msg.args);
    publish();
    if (mode === 'inconnu') { post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « rester » est inconnu de cette app.' }); return; }
    post({ gfs: 0, type: 'reponse', id: msg.id, data: { repris: mode === 'oui' } });
  };
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
    if (msg.nom === 'fermer' && (document.body.dataset.fermer || 'inconnu') !== 'inconnu') { onClose(msg); return; }
    if (msg.nom === 'rester') { onStay(msg); return; }
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
