// La garde de démarrage de GFS (27/11) : un script classique, posé avant le module d'entrée, pour qu'un fichier qui ne charge pas ne laisse jamais la page
// blanche.
// Le défaut : sous Firefox, de temps en temps, « Loading module from …/explorer/list-signature.js?v=… was blocked because of a disallowed MIME type
// (text/html) » et rien à l'écran. GitHub Pages rend alors une page 404 (HTML) pour un fichier qui existe, juste après une publication ; son CDN garde cette
// réponse PAR CHEMIN : il ignore la `?v=` (mesuré le 27/11 : deux adresses qui ne diffèrent que par elle rendent le même objet, `age` identique) et sert une
// réponse 404 de son cache sans en-tête de durée. Le navigateur, lui, retient l'échec d'un module pour toute la page : relire la même adresse ne sert à rien.
// Ce que fait la garde : (1) elle dit le défaut à l'écran, (2) nomme les fichiers refusés (elle relit chaque module du préchargement), (3) reprend la page
// sous une autre adresse du même dossier : une barre de plus avant le nom de la page (`prototype//index.html`, puis `prototype///index.html`…). Le CDN n'a
// jamais vu ces chemins, le serveur de Pages les sert (mesuré : 200, mêmes octets), et tout ce que la page cite en relatif (modules, feuilles de style,
// manifestes) suit le dossier. Elle ne le fait qu'après avoir lu la page de rechange (un hébergeur qui ne fusionne pas les barres rendrait une page d'erreur),
// trois fois au plus d'elle-même ; au-delà, un bouton « Recharger » reprend sous une adresse nouvelle. Le nombre de barres EST le compteur d'essais : rien à
// retenir dans le navigateur. L'adresse du widget que GFS donne aux apps et à la section de la vue ne garde jamais ces barres de plus
// (js/broker/view-options.js, js/broker/app-context.js).
(function () {
  'use strict';
  var AUTO_TRIES = 3;
  var PARALLEL = 8;
  var TEXTS = {
    fr: {
      checking: 'GFS n\'a pas pu charger tous ses fichiers. Vérification en cours…',
      retrying: 'GFS n\'a pas pu charger tous ses fichiers : GitHub vient sans doute de publier une mise à jour. Nouvel essai automatique…',
      final: 'GFS n\'a pas pu charger tous ses fichiers. Patientez deux ou trois minutes (GitHub garde cette réponse en défaut jusqu\'à dix minutes), puis cliquez sur « Recharger ». '
        + 'Si cela dure, signalez le fichier cité.',
      files: 'Fichier refusé : ', reload: 'Recharger',
    },
    en: {
      checking: 'GFS could not load all of its files. Checking…',
      retrying: 'GFS could not load all of its files: GitHub has probably just published an update. Trying again automatically…',
      final: 'GFS could not load all of its files. Wait two or three minutes (GitHub keeps this faulty answer for up to ten minutes), then click "Reload". '
        + 'If this goes on, report the file named here.',
      files: 'File refused: ', reload: 'Reload',
    },
  };
  var handled = false;

  // La langue d'écran sans le module de langue (il n'est pas chargé) : le paramètre `language` de Grist, le choix de la personne, puis le navigateur.
  function languageOf() {
    var chosen = null;
    try { chosen = window.localStorage.getItem('gfs.langue'); } catch (error) { chosen = null; }
    var param = null;
    try { param = new URLSearchParams(window.location.search).get('language'); } catch (error) { param = null; }
    var value = (chosen === 'fr' || chosen === 'en') ? chosen : (param || (window.navigator && window.navigator.language) || 'fr');
    return String(value).toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  }

  // Le chemin coupé avant le nom de la page : { head: '/depot/prototype', slashes: 1, file: 'index.html' }. « slashes » compte les barres qui séparent le
  // dossier du nom.
  function split(pathname) {
    var cut = pathname.lastIndexOf('/') + 1;
    var folder = pathname.slice(0, cut);
    var trailing = folder.match(/\/+$/)[0].length;
    return { head: folder.slice(0, folder.length - trailing), slashes: trailing, file: pathname.slice(cut) };
  }

  // Le numéro d'essai que porte une adresse : 0 pour `prototype/index.html`, 1 pour `prototype//index.html`.
  function attemptOf(href) { return split(new URL(href).pathname).slashes - 1; }

  // La même page à l'essai `attempt` : requête et fragment gardés.
  function retryAddress(href, attempt) {
    var url = new URL(href);
    var parts = split(url.pathname);
    url.pathname = parts.head + new Array(attempt + 2).join('/') + parts.file;
    return url.href;
  }

  function starting() { return !document.body || document.body.getAttribute('data-gfs') === 'starting'; }

  // Les modules que la page doit lire : le script d'entrée et le préchargement (ses imports statiques, de proche en proche).
  function moduleUrls() {
    var found = [];
    var nodes = document.querySelectorAll('link[rel="modulepreload"], script[type="module"][src]');
    for (var i = 0; i < nodes.length; i += 1) {
      var url = nodes[i].href || nodes[i].src;
      if (url && found.indexOf(url) < 0) found.push(url);
    }
    return found;
  }

  // null si le fichier est servi comme un script, sinon ce que le serveur a rendu : { url, status, type }.
  function refused(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      var type = response.headers.get('content-type') || '';
      if (response.body) response.body.cancel();
      return response.ok && /javascript|ecmascript/i.test(type) ? null : { url: url, status: response.status, type: type };
    }, function (error) { return { url: url, status: 0, type: String(error && error.message) }; });
  }

  // Les fichiers refusés parmi `urls`, lus par groupes de PARALLEL.
  function probe(urls) {
    var bad = [];
    var next = 0;
    function worker() {
      if (next >= urls.length) return Promise.resolve();
      var url = urls[next];
      next += 1;
      return refused(url).then(function (result) { if (result) bad.push(result); return worker(); });
    }
    var workers = [];
    for (var i = 0; i < PARALLEL; i += 1) workers.push(worker());
    return Promise.all(workers).then(function () { return bad; });
  }

  // La page de rechange répond-elle comme la page de GFS ? Sinon (l'hébergeur ne fusionne pas les barres : une page d'erreur), on n'y va pas.
  function reachable(address) {
    return fetch(address, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      return response.ok ? response.text().then(function (text) { return text.indexOf('data-gfs="starting"') >= 0; }) : false;
    }, function () { return false; });
  }

  // Le cadre de la phrase : posé dans le corps de la page, refait à chaque changement de phrase.
  function render(text, detail, onReload) {
    var old = document.getElementById('boot-failure');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'boot-failure';
    box.className = 'boot-failure';
    box.setAttribute('role', 'alert');
    var sentence = document.createElement('p');
    sentence.textContent = text;
    box.appendChild(sentence);
    if (detail) {
      var code = document.createElement('p');
      code.className = 'boot-failure__detail';
      code.textContent = detail;
      box.appendChild(code);
    }
    if (onReload) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = TEXTS[languageOf()].reload;
      button.addEventListener('click', onReload);
      box.appendChild(button);
    }
    (document.body || document.documentElement).appendChild(box);
  }

  function detailOf(bad) {
    var shown = bad.slice(0, 3).map(function (each) {
      return each.url.replace(/^.*\/js\//, '').replace(/\?.*$/, '') + ' (' + (each.status || '?') + (each.type ? ', ' + each.type.replace(/;.*$/, '') : '') +
        ')';
    });
    return shown.length ? TEXTS[languageOf()].files + shown.join(', ') + (bad.length > 3 ? ' …' : '') : '';
  }

  // Une adresse nouvelle, ou la même page relue si l'hébergeur n'en admet pas.
  function reloadElsewhere(attempt) {
    var address = retryAddress(window.location.href, attempt + 1);
    return reachable(address).then(function (ok) {
      if (ok) window.location.replace(address); else window.location.reload();
    });
  }

  function fail() {
    if (handled) return;
    handled = true;
    var texts = TEXTS[languageOf()];
    var attempt = attemptOf(window.location.href);
    render(texts.checking, '', null);
    var onReady = function () {
      probe(moduleUrls()).then(function (bad) {
        if (bad.length && window.console) console.warn('GFS : fichiers refusés au démarrage', bad);
        var detail = detailOf(bad);
        var stop = function () { render(texts.final, detail, function () { reloadElsewhere(attempt); }); };
        if (attempt >= AUTO_TRIES) { stop(); return; }
        reachable(retryAddress(window.location.href, attempt + 1)).then(function (ok) {
          if (!ok) { stop(); return; }
          render(texts.retrying, detail, null);
          window.setTimeout(function () { reloadElsewhere(attempt); }, 1500 * (attempt + 1));
        });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
  }

  // Un module de la page qui ne charge pas : l'événement `error` du script d'entrée (réponse refusée, hôte mort) ; un module lu mais qui ne s'accorde pas avec
  // ses voisins (une page d'hier avec un fichier d'aujourd'hui : « does not provide an export ») lève une SyntaxError sur la fenêtre. Une autre erreur est
  // celle d'un code qui tourne : elle n'est pas notre affaire.
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window && target.tagName === 'SCRIPT' && target.type === 'module') fail();
    else if (target === window && event.error instanceof SyntaxError && starting()) fail();
  }, true);

  window.GFSBootGuard = { attemptOf: attemptOf, retryAddress: retryAddress };
}());
