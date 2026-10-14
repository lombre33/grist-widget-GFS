// Tranche 1 : GFS ouvre Publipostage+ (non modifié) dans un sous-cadre isolé, dans un vrai Grist ; Publipostage+ crée ses tables par le courtier.
import { startLab } from './lab-setup.mjs';
import { say } from './lab-common.mjs';

const lab = await startLab({ query: '?ouvrir=publipostage' });
const warnings = [];
lab.page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.page.waitForTimeout(6000);
const app = await lab.appFrame();
say('app frame :', app.url());
await lab.shot('slice1', '1-ouverture');
const consent = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
say('consentement visible :', await consent.count());
if (await consent.count()) { await consent.first().click(); await lab.page.waitForTimeout(8000); }
await lab.shot('slice1', '2-tables-creees');
say('refus :', JSON.stringify(warnings, null, 1));
const tables = await lab.frame.evaluate(async () => (await grist.docApi.listTables()));
say('tables du document :', tables);
await lab.browser.close();
