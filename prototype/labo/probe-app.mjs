// Sonde : ce que Publipostage+ (non modifié) voit dans son sous-cadre isolé, une fois ouvert par GFS.
import { startLab } from './lab-setup.mjs';
import { say } from './lab-common.mjs';

const lab = await startLab({ colorScheme: process.env.LAB_SCHEME || 'light' });
const app = await lab.openApp('publipostage');
await lab.page.waitForTimeout(4000);
const consent = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
if (await consent.count()) { await consent.first().click(); await lab.page.waitForTimeout(6000); }
const seen = await app.evaluate(() => {
  const out = {};
  out.href = location.href.replace(/\?.*/, '?…');
  out.origin = window.origin;
  out.referrer = document.referrer;
  out.isSecureContext = window.isSecureContext;
  out.selectedTable = typeof grist !== 'undefined' && grist.getSelectedTableIdSync ? grist.getSelectedTableIdSync() : '(grist absent)';
  out.appearance = document.documentElement.getAttribute('data-grist-appearance');
  out.theme = document.documentElement.getAttribute('data-grist-theme');
  try { localStorage.setItem('x', '1'); out.localStorage = 'ok'; } catch (e) { out.localStorage = e.name; }
  try { sessionStorage.setItem('x', '1'); out.sessionStorage = 'ok'; } catch (e) { out.sessionStorage = e.name; }
  try { out.cookie = document.cookie === '' ? 'vide (ok)' : 'present'; } catch (e) { out.cookie = e.name; }
  try { out.indexedDB = typeof indexedDB !== 'undefined' ? 'present' : 'absent'; } catch (e) { out.indexedDB = e.name; }
  out.status = (document.getElementById('status-msg') || {}).textContent;
  out.guardOnmessage = typeof window.onmessage;
  return out;
});
say(JSON.stringify(seen, null, 1));
const gfsSeen = await lab.frame.evaluate(() => ({ gfs: document.body.dataset.gfs, appStatus: document.body.dataset.appStatus, frames: document.querySelectorAll('iframe').length, sandbox: document.querySelector('iframe').getAttribute('sandbox'), allow: document.querySelector('iframe').getAttribute('allow') }));
say(JSON.stringify(gfsSeen));
await lab.browser.close();
