// Page relais du labo (étude du lecteur vidéo) : pose le cadre du faux lecteur (une autre origine) dans SA page, avec les autorisations qu'un lecteur demande, et redit à GFS ce que le lecteur dit.
(function () {
  'use strict';
  const player = document.createElement('iframe');
  player.src = 'http://localhost:8917/prototype/labo/sondes/l-lecteur/policy.html';
  player.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  player.style.cssText = 'border:0;width:200px;height:120px';
  document.body.appendChild(player);
  window.addEventListener('message', (event) => {
    if (event.source === player.contentWindow && event.data && event.data.lecteur) window.parent.postMessage({ lecteur: { ...event.data.lecteur, via: 'relais' } }, '*');
  });
}());
