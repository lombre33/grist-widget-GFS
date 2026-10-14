// La fenêtre que la sonde G ouvre : elle dit ce que le navigateur lui a laissé (origine, stockage, lien avec l'ouvreur).
(function () {
  'use strict';
  const out = { origine: window.origin, ouvreur: window.opener !== null, contexteSecurise: window.isSecureContext };
  try { window.localStorage.setItem('essai', '1'); out.stockage = 'accessible'; } catch (error) { out.stockage = error.name; }
  document.body.dataset.popup = JSON.stringify(out);
}());
