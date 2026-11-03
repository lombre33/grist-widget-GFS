// Sonde M du labo (contrats 5.2, point 10) : une app minimale qui fait ce que feront les apps avec leur consigne « ambiance ». Elle demande `contexte` au démarrage, note l'`ambiance` qu'on lui
// rend, puis note chaque événement `ambiance` de GFS. Elle pose les couleurs reçues sur sa page par le CSSOM (jamais un attribut `style` écrit en HTML : sa politique le refuse) et les retire quand
// GFS dit `null`. Ce qu'elle a reçu est écrit dans `document.body.dataset.sonde`, que le labo lit.
(function () {
  'use strict';
  var received = { contextes: [], evenements: [] };
  var applied = [];
  var nextId = 1;
  var publish = function () { document.body.dataset.sonde = JSON.stringify(received); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  var isHex = function (value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value); };
  // Ce qu'on retient du message : de quoi vérifier sa forme sans en recopier les dix-neuf jetons de chaque mode.
  var summary = function (ambiance) {
    if (!ambiance) return null;
    return { id: ambiance.id, couleur: ambiance.couleur, ajustee: ambiance.ajustee, clair: Object.keys(ambiance.clair || {}).length, sombre: Object.keys(ambiance.sombre || {}).length,
      forme: Object.keys(ambiance.forme || {}).length, accentClair: ambiance.clair && ambiance.clair['--accent'], accentSombre: ambiance.sombre && ambiance.sombre['--accent'] };
  };
  // Pose les couleurs du mode de la page, ou retire celles qu'on avait posées (`null`).
  var apply = function (ambiance) {
    applied.forEach(function (name) { document.documentElement.style.removeProperty(name); });
    applied = [];
    if (!ambiance) return;
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var colors = dark ? ambiance.sombre : ambiance.clair;
    Object.keys(colors || {}).forEach(function (name) {
      if (/^--[a-z0-9-]+$/.test(name) && isHex(colors[name])) { document.documentElement.style.setProperty(name, colors[name]); applied.push(name); }
    });
    document.body.style.setProperty('background', 'var(--bg, #ffffff)');
    document.body.style.setProperty('color', 'var(--text, #000000)');
  };
  var askContext = function () { post({ gfs: 0, type: 'appel', id: nextId++, nom: 'contexte', args: {} }); };
  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse') {
      received.contextes.push(summary(msg.data && msg.data.ambiance));
      apply(msg.data && msg.data.ambiance);
      publish();
    } else if (msg.type === 'evenement' && msg.nom === 'ambiance') {
      received.evenements.push(summary(msg.data && msg.data.ambiance));
      apply(msg.data && msg.data.ambiance);
      publish();
    }
  });
  askContext();
  publish();
  // Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (GFS montre alors le cadre et retire sa phrase « se charge… »).
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
}());
