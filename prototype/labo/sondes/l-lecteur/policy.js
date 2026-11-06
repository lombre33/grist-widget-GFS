// Faux lecteur du labo (étude du lecteur vidéo de Slides+) : à l'ouverture et à chaque demande de son parent, dit son origine, si le stockage lui répond, quelles fonctions la politique
// d'autorisations lui laisse (celles que demande un lecteur : lecture automatique, médias protégés, image dans l'image, plein écran) et l'état de l'activation de la personne.
(function () {
  'use strict';
  const FEATURES = ['autoplay', 'encrypted-media', 'picture-in-picture', 'fullscreen', 'clipboard-write'];
  function report() {
    let storage = 'ok';
    try { window.localStorage.setItem('lecteur', '1'); } catch (error) { storage = error.name; }
    const policy = document.permissionsPolicy || document.featurePolicy;
    const features = {};
    FEATURES.forEach((name) => { features[name] = policy ? policy.allowsFeature(name) : null; });
    const activation = navigator.userActivation ? { active: navigator.userActivation.isActive, been: navigator.userActivation.hasBeenActive } : null;
    return { origin: String(window.origin), storage, features, activation };
  }
  // L'activation de la personne ne s'observe pas par un événement : un relevé toutes les 40 ms (heure, activation en cours), que le labo lit et date lui-même.
  const samples = [];
  setInterval(() => { samples.push([Date.now(), navigator.userActivation ? navigator.userActivation.isActive : null]); if (samples.length > 400) samples.shift(); }, 40);
  window.addEventListener('message', (event) => { if (event.source === window.parent) window.parent.postMessage({ lecteur: { ...report(), samples } }, '*'); });
  window.parent.postMessage({ lecteur: report() }, '*');
}());
