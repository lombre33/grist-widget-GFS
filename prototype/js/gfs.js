// GFS : le widget qui héberge les apps (contrats 4.1). Ordre de démarrage : le routeur (déjà là), le script d'API de Grist (déjà là),
// puis ce module, qui passe la main au contrôleur : abonnement aux événements de Grist, grist.ready(), manifestes, explorateur ou app.

import { GfsController } from './controller.js';

const controller = new GfsController({ grist: window.grist, router: window.GFSRouter, search: location.search });
controller.start().catch(error => {
  console.error('GFS : démarrage impossible', error);
  const status = document.getElementById('status');
  status.hidden = false;
  status.classList.add('status--bad');
  status.textContent = controller.t('gfs.loadFailed', { reason: String(error && error.message) });
});
