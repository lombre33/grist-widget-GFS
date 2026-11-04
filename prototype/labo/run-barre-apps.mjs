// La barre de GFS devant Form+, Automation+ et Grist-BI, dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris : ce que la barre recouvre de chaque app aux quatre
// bords, tant que l'app n'écarte rien (le porteur, 21/10 : « Mesurer d'abord », avant d'écrire à chaque app ; contrats 5.2, point 7). Même mesure que
// run-barre-publipostage.mjs (barre-lab.mjs), sur les écrans où passe une personne (les gestes de la vraie souris qui y mènent sont dans ecrans-apps.mjs, que run-ambiance-apps.mjs parcourt aussi) :
//   Form+ (la version que GFS référence) : ses départs, puis son concepteur, sur un formulaire semé comme Form+ l'enregistre (seedFormDesigner), qu'elle lit en rechargeant son
//   cadre, et ses trois onglets, chacun en haut puis au bout de son défilement ;
//   Automation+ (la version que GFS référence) : sa question d'accord au démarrage, puis son graphe sans table (« Ne pas créer », deux nœuds ajoutés par « Ajouter »), son
//   journal ouvert, ses réglages ;
//   Grist-BI : GFS ne la référence pas encore (ni sous-module ni manifeste) ; elle se mesure seule, comme widget de la section, la barre posée par le calcul à la place que dit
//   le contrat (barRect), dessinée sur les captures. Son accueil (reliée d'elle-même à la table Clients), une tuile ajoutée au bout de la page, ses réglages. BI_DIR : une
//   copie de son dépôt au commit lu (docs/apps.md), servie le temps de la passe (`git -C <clone> archive <commit> | tar -x -C <dossier>`).
// Elle vérifie aussi ce qui doit rester vrai : la barre est à l'écran à chaque bord, à la place que dit le contrat, le courtier ne refuse rien et aucune erreur de page ne survient.
// APP=form|automation|bi, LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { measureEdges } from './barre-lab.mjs';
import { screensOf } from './ecrans-apps.mjs';

const appId = process.env.APP || 'form';
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `barre-${appId}-${lang}-${scheme}`;
const alone = appId === 'bi';
const ALONE_PORT = 8912;
if (alone && !process.env.BI_DIR) throw new Error('APP=bi demande BI_DIR : une copie du dépôt de Grist-BI au commit lu (LISEZ-MOI du labo)');
const server = alone ? createServer(serve(process.env.BI_DIR)).listen(ALONE_PORT, '127.0.0.1') : null;
const lab = await startLab({ lang, colorScheme: scheme, ...(alone ? { widget: `http://127.0.0.1:${ALONE_PORT}/index.html` } : {}) });
const { page, frame } = lab;
const refusals = [];
const errors = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) refusals.push(message.text().slice(0, 160)); });
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);

const SCREENS = screensOf(appId, { page, frame, lang });

const app = alone ? frame : await lab.openApp(appId, new RegExp(`/apps/${appId}/`));
await page.waitForTimeout(3000);
await lab.fitPanel(undefined, 700, 400);
const results = {};
for (const [screen, prepare] of SCREENS) {
  await prepare(app);
  await page.waitForTimeout(1000);
  results[screen] = await measureEdges({ lab, frame: alone ? null : frame, app, run, lang, screen });
}
say('en tout :', JSON.stringify(results));
if (!alone) check('le courtier n\'a rien refusé à l\'app pendant la passe', refusals.length === 0, refusals);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
server?.close();
