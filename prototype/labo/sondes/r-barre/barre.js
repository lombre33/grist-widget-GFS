// Sonde R du labo (contrats 5.2 point 7 et 5.1 `barre.masquer`) : une app minimale qui fait ce que fera Publipostage+ avec la barre de GFS. Elle demande `contexte` au démarrage, note la
// `barre` qu'on lui rend, note chaque événement `barre`, garde libre la zone qu'elle recouvre (son titre en haut et sa légende en bas s'en écartent) et sait demander à ne pas avoir la barre
// (`barre.masquer`). Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit ; le labo la fait redemander son contexte et appeler `barre.masquer`.
(function () {
  'use strict';
  var received = { contextes: [], evenements: [], reponses: [], erreurs: [], clics: {} };
  var nextId = 1;
  var kinds = {};
  var area = document.getElementById('zone-libre');
  var heading = document.getElementById('titre');
  var caption = document.getElementById('legende');
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };

  var touches = function (element, zone) {
    var box = element.getBoundingClientRect();
    return box.left < zone.x + zone.largeur && box.right > zone.x && box.top < zone.y + zone.hauteur && box.bottom > zone.y;
  };

  // La zone dessinée et les deux textes écartés si elle les recouvre : le titre passe au-dessous de la zone, la légende au-dessus.
  var adapt = function (barre) {
    heading.style.top = '8px';
    caption.style.bottom = '8px';
    area.hidden = !barre;
    if (!barre) return;
    area.style.left = barre.zone.x + 'px';
    area.style.top = barre.zone.y + 'px';
    area.style.width = barre.zone.largeur + 'px';
    area.style.height = barre.zone.hauteur + 'px';
    if (touches(heading, barre.zone)) heading.style.top = (barre.zone.y + barre.zone.hauteur) + 'px';
    if (touches(caption, barre.zone)) caption.style.bottom = (window.innerHeight - barre.zone.y) + 'px';
  };

  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'evenement') {
      if (msg.nom !== 'barre') return;
      received.evenements.push(msg.data);
      adapt(msg.data.barre);
    } else if (msg.type === 'reponse' || msg.type === 'erreur') {
      var kind = kinds[msg.id] || '?';
      if (msg.type === 'erreur') received.erreurs.push({ id: msg.id, kind: kind, code: msg.code });
      else if (kind === 'contexte') { received.contextes.push({ langue: msg.data.langue, barre: msg.data.barre }); adapt(msg.data.barre); }
      else received.reponses.push({ id: msg.id, kind: kind, data: msg.data });
    }
    publish();
  });

  Array.prototype.forEach.call(document.querySelectorAll('.coin'), function (button) {
    button.addEventListener('click', function () { received.clics[button.id] = (received.clics[button.id] || 0) + 1; publish(); });
  });

  window.sondeR = {
    contexte: function () {
      var id = nextId++;
      kinds[id] = 'contexte';
      post({ gfs: 0, type: 'appel', id: id, nom: 'contexte', args: {} });
    },
    // `avecId` : l'app attend la réponse ({ masquee }) ou l'erreur ; sans, aucune réponse (un refus se lit alors en console de GFS).
    masquer: function (masquee, avecId) {
      var msg = { gfs: 0, type: 'appel', nom: 'barre.masquer', args: { masquee: masquee } };
      if (avecId) { msg.id = nextId++; kinds[msg.id] = 'masquer:' + String(masquee); }
      post(msg);
    },
  };
  window.sondeR.contexte();
  // Comme une app de Grist (le script d'API le dit une fois le thème posé) : GFS la montre. Une sonde qui se tait reste cachée, et aucun clic ne l'atteint.
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  publish();
}());
