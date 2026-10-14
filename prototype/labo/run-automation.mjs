// Automation+ (non modifiée) dans le sous-cadre isolé de GFS, dans un vrai Grist (cahier 9, point 1 : le relais avec les deux apps). On ouvre l'app comme une
// personne (la case, puis « Ouvrir »), on lit ce qu'elle affiche et ce que le courtier a refusé, on la regarde à 700 × 400.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lab = await startLab({ lang: process.env.LAB_LANG || 'fr', colorScheme: process.env.LAB_SCHEME || 'light' });
const refusals = [];
const errors = [];
lab.page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) refusals.push(message.text());
  if (message.type() === 'error' && /automation/.test(message.location().url || '')) errors.push(message.text());
});
lab.page.on('pageerror', error => errors.push(error.message));
const app = await lab.openApp('automation', /automation/);
await lab.page.waitForTimeout(5000);
await lab.fitPanel(undefined, 700, 400);
const seen = await app.evaluate(() => ({
  origine: window.origin,
  table: typeof grist !== 'undefined' && grist.getSelectedTableIdSync ? grist.getSelectedTableIdSync() : null,
  theme: document.documentElement.getAttribute('data-grist-theme'),
  titre: document.title,
  texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
  stockage: (() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (error) { return error.name; } })(),
}));
say('ce que l\'app voit :', JSON.stringify(seen));
say('refus du courtier :', JSON.stringify(refusals));
say('erreurs de l\'app :', JSON.stringify(errors));
await lab.shotPanel('automation', '700x400');
check('l\'app est ouverte dans le sous-cadre isolé (origine null)', seen.origine === 'null', seen.origine);
check('le courtier ne lui a rien refusé', refusals.length === 0, refusals);
check('aucune erreur de script dans l\'app', errors.length === 0, errors);
await lab.browser.close();
