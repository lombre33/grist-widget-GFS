// Une app qui recharge son propre cadre sur place (Publipostage+ le fait au changement de langue ; contrats 5.2, point 3) redit `ready` : GFS lui rejoue alors ses réglages, son thème
// et l'état de sa table (contrats 4.2, point 2), comme Grist, qui redéclenche « ready » à chaque message `ready` (`WidgetFrame._onMessage`, sources de grist-static 0.1.6). Mesuré dans
// un vrai Grist (grist-static), à 700 × 400, avec Form+ (la version que GFS référence), qui attend ses réglages pour démarrer (`grist.onOptions`, sinon son écran « widget seul » au bout de
// 4 secondes) : après un rechargement de son cadre, elle retrouve ses départs, le thème de Grist (`data-grist-appearance`, que pose le script d'API de Grist) et la table de la section.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `recharge-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);

const STARTS = /Comment voulez-vous démarrer|How do you want to start/i;
const seen = app => app.evaluate(() => ({
  departs: document.getElementById('config') ? !document.getElementById('config').classList.contains('hidden') : false,
  seule: document.getElementById('standalone') ? !document.getElementById('standalone').classList.contains('hidden') : false,
  texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120),
  apparence: document.documentElement.getAttribute('data-grist-appearance'),
  table: typeof grist !== 'undefined' && grist.getSelectedTableIdSync ? grist.getSelectedTableIdSync() : null,
}));
const settled = async (app) => {
  await app.waitForFunction(() => ['config', 'standalone'].some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); }), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return seen(app);
};

const app = await lab.openApp('form', /apps\/form\//);
const before = await settled(app);
say('au départ :', JSON.stringify(before));
await lab.shotPanel(run, '1-depart');
check('Form+ démarre dans GFS sur ses départs, avec le thème de Grist et la table de la section', before.departs && !before.seule && STARTS.test(before.texte) && before.apparence === scheme && before.table === 'Clients', before);

await app.evaluate(() => location.reload());
await page.waitForTimeout(1500);
const after = await settled(app);
say('après le rechargement de son cadre :', JSON.stringify(after));
await lab.shotPanel(run, '2-recharge');
check('rechargée sur place, Form+ reçoit de nouveau ses réglages : ses départs, pas l\'écran « widget seul »', after.departs && !after.seule && STARTS.test(after.texte), after);
check('elle reçoit de nouveau le thème de Grist', after.apparence === scheme, after.apparence);
check('elle reçoit de nouveau l\'état de la table de la section', after.table === 'Clients', after.table);
check('GFS n\'a pas reconstruit son cadre : c\'est le même cadre d\'app', !app.isDetached() && page.frames().filter(frame => /\/apps\/form\//.test(frame.url())).length === 1);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
