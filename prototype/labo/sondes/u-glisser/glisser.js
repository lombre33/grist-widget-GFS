// Sonde U du labo : une app minimale qui fait glisser et déposer avec l'API HTML5 (dragstart, dragover, drop, dragend), comme le kanban de Tuesday (des `<article draggable>` déposés dans des
// colonnes) et son calendrier (un `<button draggable>` déposé sur un jour). Ce qu'elle a vu est écrit dans `document.body.dataset.sonde`, que le labo lit : les départs, le nombre de survols, les
// dépôts (la zone et le texte de `dataTransfer`), la fin de chaque glissement (l'effet que le navigateur a retenu) et ce qui a été lu du `dataTransfer` à l'arrivée.
(function () {
  'use strict';
  var seen = { contexte: false, departs: [], survols: 0, depots: [], fins: [] };
  var dragged = null;
  var publish = function () { document.body.dataset.sonde = JSON.stringify(seen); };
  var post = function (message) { window.parent.postMessage(message, '*'); };
  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) { seen.contexte = true; publish(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[draggable="true"]'), function (item) {
    item.addEventListener('dragstart', function (event) {
      dragged = item;
      event.dataTransfer.setData('text/plain', item.id);
      event.dataTransfer.effectAllowed = 'move';
      seen.departs.push(item.id);
      publish();
    });
    item.addEventListener('dragend', function (event) {
      seen.fins.push({ id: item.id, effet: event.dataTransfer.dropEffect });
      dragged = null;
      Array.prototype.forEach.call(document.querySelectorAll('.cible'), function (zone) { zone.classList.remove('cible'); });
      publish();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-zone]'), function (zone) {
    zone.addEventListener('dragover', function (event) {
      if (!dragged) return;
      event.preventDefault();
      zone.classList.add('cible');
      seen.survols += 1;
    });
    zone.addEventListener('dragleave', function () { zone.classList.remove('cible'); });
    zone.addEventListener('drop', function (event) {
      event.preventDefault();
      var text = event.dataTransfer.getData('text/plain');
      if (dragged) zone.appendChild(dragged);
      seen.depots.push({ zone: zone.dataset.zone, texte: text });
      publish();
    });
  });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  // Comme une app de Grist (le script d'API dit « prête », puis « thème posé ») : GFS la montre. Une sonde qui se tait reste cachée, et aucun clic ne l'atteint.
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  publish();
}());
