// L'appel `ouvrir` de GFS à l'app déjà ouverte (contrats 5.1 et 5.4, point 1), dans un vrai Grist, à 700 × 400, à la vraie souris : la personne double-clique un fichier de
// l'app qui est déjà au premier plan (l'explorateur revient par le repère « Fichiers »), ou choisit « Nouveau » ; GFS envoie l'appel à l'app, qui ouvre elle-même, après sa propre
// question d'enregistrement. La sonde O fait ce que fera Publipostage+ avec la consigne 010 (labo/sondes/o-ouvrir/) ; GFS la tient pour une app qui accepte « ouvrir »
// (le labo seul change la ligne provisoire `ACCEPTS_OPEN`). LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const NAME = lang === 'fr' ? 'Sonde O' : 'Probe O'; // le nom de la sonde dans la langue de GFS
const ACCEPTS = {
  fichier: 'controller.js',
  de: 'const ACCEPTS_OPEN = Object.freeze({ publipostage: false, automation: false });',
  vers: "const ACCEPTS_OPEN = Object.freeze({ publipostage: false, automation: false, 'sonde-o': true });",
};
const lab = await startLab({ lang, probes: true, patches: [ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });

// Les fichiers de la sonde : une table du préfixe de l'app, remplie par GFS (accès complet) comme le fait le labo pour Publipostage+ ; GFS la relit en repartant.
const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async stamp => {
  await grist.docApi.applyUserActions([['AddTable', 'SondeO_Fichiers', [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }]]]);
  await grist.docApi.applyUserActions([['BulkAddRecord', 'SondeO_Fichiers', [null, null, null], {
    Nom: ['Premier', 'Deuxième', 'Troisième'], Type: ['document', 'document', 'document'], DateModif: [stamp - 60, stamp - 120, stamp - 180],
  }]]);
}, now);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const app = await lab.openApp('sonde-o', /o-ouvrir\//, frame);
const probe = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const waitFor = async (label, test) => {
  for (let i = 0; i < 50; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
await waitFor('la sonde a reçu son contexte', async () => (await probe()).contexte);
check('la sonde est ouverte et a reçu son contexte, sans ouverture (elle est venue de la fenêtre des apps)', (await probe()).contexte && (await probe()).ouverture === null, await probe());
const frames = () => page.frames().filter(f => /o-ouvrir\//.test(f.url())).length;
const toast = () => frame.locator('#toast');
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ls-row', { hasText: 'Premier' }).first().waitFor(); };
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const explorerHidden = () => frame.locator('.ex').isHidden();
// Une phrase de GFS disparaît seule : avant de vérifier qu'il n'y en a pas de nouvelle, on attend que la précédente soit partie.
const quiet = () => toast().waitFor({ state: 'hidden', timeout: 20000 });

// 1. Double-clic : l'app est déjà ouverte, GFS lui envoie l'appel.
await showFiles();
say('fichiers listés :', await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').slice(0, 40))));
await row('Premier').dblclick();
await waitFor('l\'appel ouvrir', async () => (await probe()).appels.length === 1);
let seen = await probe();
say('appel reçu :', seen.appels[0]);
const call = seen.appels[0] || {};
const idOk = Boolean(call.fichier) && typeof call.fichier.id === 'string' && call.fichier.id !== '' && call.fichier.type === 'document';
check('le double-clic envoie « ouvrir » à l\'app déjà ouverte, avec le fichier (son id en texte, son type), le type, le dossier et la raison',
  seen.appels.length === 1 && idOk && call.type === 'document' && call.dossier === '' && call.raison === 'explorateur' && Object.keys(call).length === 4, call);
check('l\'explorateur se ferme et l\'app garde son cadre (pas rechargée)', (await explorerHidden()) && frames() === 1, { cadres: frames() });
check('app qui accepte « ouvrir », réponse « ouvert » : aucune phrase provisoire', await toast().isHidden(), await toast().innerText());
const firstId = call.fichier && call.fichier.id;

// 2. La personne annule la question de l'app : { ouvert: false }, rien à dire de plus.
await app.evaluate(() => { document.body.dataset.reponse = 'non'; });
await showFiles();
await row('Deuxième').dblclick();
await waitFor('le second appel', async () => (await probe()).appels.length === 2);
await page.waitForTimeout(400);
seen = await probe();
check('un second double-clic envoie un second appel, avec un autre fichier', seen.appels.length === 2 && seen.appels[1].fichier.id !== firstId, seen.appels[1]);
check('la personne annule dans l\'app ({ ouvert: false }) : GFS n\'ajoute aucune phrase', await toast().isHidden(), await toast().innerText());

// 3. Une app qui n'a pas la porte : GFS_INCONNU, GFS dit ce qui est provisoire.
await app.evaluate(() => { document.body.dataset.reponse = 'inconnu'; });
await showFiles();
await row('Troisième').dblclick();
await page.waitForTimeout(600);
const notice = (await toast().isVisible()) ? await toast().innerText() : '';
say('phrase :', notice);
check('une app qui ne connaît pas « ouvrir » (GFS_INCONNU) : la phrase provisoire, avec son nom', new RegExp(NAME).test(notice) && (lang === 'fr' ? /Provisoire/ : /Provisional/).test(notice), notice);
check('l\'appel inconnu n\'a rien ajouté aux appels reçus', (await probe()).appels.length === 2);

// 3 bis. Une erreur de l'app (autre que « inconnu ») : GFS la dit avec son texte.
await quiet();
await app.evaluate(() => { document.body.dataset.reponse = 'echec'; });
await showFiles();
await row('Premier').dblclick();
await waitFor('l\'appel en échec', async () => (await probe()).appels.length === 3);
await page.waitForTimeout(600);
const failure = (await toast().isVisible()) ? await toast().innerText() : '';
say('phrase :', failure);
check('une erreur de l\'app : GFS dit qu\'elle n\'a pas pu ouvrir, avec le texte de l\'app', new RegExp(NAME).test(failure) && /Le modèle est introuvable\./.test(failure) && !/Provisoire|Provisional/.test(failure), failure);

// 4. « Nouveau » : `ouvrir` sans fichier, avec un type.
await app.evaluate(() => { document.body.dataset.reponse = 'oui'; });
await showFiles();
await frame.locator('.btn.primary').click();
await frame.locator('.menu-item', { hasText: new RegExp(NAME) }).click();
await waitFor('l\'appel « nouveau »', async () => (await probe()).appels.length === 4);
seen = await probe();
say('appel « nouveau » :', seen.appels[3]);
check('« Nouveau » envoie « ouvrir » sans fichier, avec le type et la raison', seen.appels.length === 4 && JSON.stringify(seen.appels[3]) === JSON.stringify({ fichier: null, type: 'document', dossier: '', raison: 'nouveau' }), seen.appels[3]);
check('l\'explorateur est refermé', await explorerHidden());

// 5. Une question de l'app qui attend (aucune réponse) : l'appel reste en attente, sans délai ; retirer l'app le défait sans bruit.
await quiet();
await app.evaluate(() => { document.body.dataset.reponse = 'muet'; });
await showFiles();
await row('Premier').dblclick();
await waitFor('l\'appel resté sans réponse', async () => (await probe()).appels.length === 5);
await page.waitForTimeout(1500);
check('sans réponse, GFS attend (aucune phrase, l\'app reste là)', (await toast().isHidden()) && frames() === 1, await toast().innerText());
await lab.openModules(frame);
await frame.locator('[data-fk="app:sonde-o"]').uncheck();
await lab.settle(frame);
await page.waitForTimeout(600);
check('retirer l\'app pendant l\'attente : le cadre part, l\'explorateur revient, aucune phrase d\'erreur', frames() === 0 && (await frame.locator('.ex').isVisible()) && (await toast().isHidden()), { cadres: frames(), phrase: await toast().innerText() });
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
