// L'appel `fermer` de GFS à l'app active, avant qu'une autre app prenne sa place (contrats 5.1 et 5.4, point 3), dans un vrai Grist, à 700 × 400, à la vraie souris : la personne double-clique le
// fichier d'une autre app, ouvre une app dans la fenêtre des apps, ou suit un lien. L'app active (la sonde O, labo/sondes/o-ouvrir/, ou la sonde Q) enregistre ou pose sa question avant de partir,
// comme le fera Publipostage+ après la consigne qui lui demande de répondre à `fermer` ; une app qui ne connaît pas l'appel part comme avant. Le sondage de la sonde : `body[data-fermer]`
// (`oui`, `non`, `echec`, `muet`, `question`, ou rien : GFS_INCONNU). GFS tient les deux sondes pour des apps qui acceptent « ouvrir » (le labo seul les ajoute à `ACCEPTS_OPEN`).
// « Tu restes » (contrats 5.4, point 3, appel `rester`) : l'app qui a répondu oui alors que la personne est revenue à l'explorateur reçoit `rester` (`body[data-rester]` de la sonde : `oui`, `non`, ou rien : GFS_INCONNU).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const fr = lang === 'fr';
const run = `fermer-${lang}-${scheme}`;
const WORD = fr
  ? { app: 'Sonde O', silent: 'Sonde O ne répond pas', fault: 'Sonde O n’a pas pu se fermer', wait: 'Attendre', force: 'Fermer quand même', stay: 'Rester', reason: /Enregistrement refusé par Grist\./, hint: /Si sa question d’enregistrement est à l’écran/, close: 'Fermer' }
  : { app: 'Probe O', silent: 'Probe O is not responding', fault: 'Probe O could not close', wait: 'Wait', force: 'Close anyway', stay: 'Stay', reason: /Enregistrement refusé par Grist\./, hint: /If its save question is on screen/, close: 'Close' };
const ACCEPTS = {
  fichier: 'controller.js',
  de: 'const ACCEPTS_OPEN = Object.freeze({',
  vers: "const ACCEPTS_OPEN = Object.freeze({ 'sonde-o': { fichier: true, nouveau: true }, 'sonde-q': { fichier: true, nouveau: true },",
};
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && isGfsWarning(m.text())) warnings.push(m.text()); });

// Les fichiers des deux sondes : une table du préfixe de chaque app, remplie par GFS (accès complet) ; GFS les relit en repartant.
const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async stamp => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeO_Fichiers', columns], ['AddTable', 'SondeQ_Fichiers', columns]]);
  await grist.docApi.applyUserActions([
    ['BulkAddRecord', 'SondeO_Fichiers', [null, null, null], { Nom: ['Premier', 'Deuxième', 'Troisième'], Type: ['document', 'document', 'document'], DateModif: [stamp - 60, stamp - 120, stamp - 180] }],
    ['BulkAddRecord', 'SondeQ_Fichiers', [null], { Nom: ['Projet Q'], Type: ['projet'], DateModif: [stamp - 30] }],
  ]);
}, now);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const O = /o-ouvrir\//;
const Q = /q-liens\//;
const frameOf = re => page.frames().find(f => re.test(f.url()));
const count = re => page.frames().filter(f => re.test(f.url())).length;
const readProbe = f => f.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')).catch(() => ({}));
const waitFor = async (label, test, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const modal = frame.locator('.mod.ask');
const toast = frame.locator('#toast');
const ex = frame.locator('.ex');
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const shot = name => lab.shotPanel(run, name, frame);
const showFiles = async name => { await frame.locator('#floater-files').click(); await row(name).waitFor(); };
const ready = async re => waitFor(`le contexte de ${re}`, async () => { const f = frameOf(re); return Boolean(f) && (await readProbe(f)).contexte === true; }, 80);
const quiet = () => toast.waitFor({ state: 'hidden', timeout: 20000 });
const clean = async label => check(`${label} : aucune fenêtre ni phrase de GFS`, (await modal.count()) === 0 && (await toast.isHidden()), { fenetres: await modal.count(), phrase: await toast.innerText() });

// La sonde O au premier plan, avec la réponse voulue à `fermer` : si elle n'y est pas, un double-clic sur son fichier (la sonde Q ne connaît pas `fermer`, elle part comme avant).
const becomeO = async mode => {
  if (count(O) === 0) { await showFiles('Premier'); await row('Premier').dblclick(); await waitFor('O ouvert', () => count(O) === 1); await ready(O); }
  await frameOf(O).evaluate(value => { document.body.dataset.fermer = value; }, mode);
};
const dropOnQ = async () => { await showFiles('Projet Q'); await row('Projet Q').dblclick(); };
const closeExplorer = () => frame.locator('.ex-foot .btn', { hasText: WORD.close }).last().click();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 0. la fenêtre des apps : la sonde Q est ouverte, la sonde O la remplace (Q ne connaît pas « fermer ») ===');
await lab.openApp('sonde-q', Q, frame);
await ready(Q);
await lab.openApp('sonde-o', O, frame);
await ready(O);
check('la sonde O remplace la sonde Q depuis la fenêtre des apps, sans fenêtre : Q ne connaît pas « fermer » et part comme avant', count(O) === 1 && count(Q) === 0 && (await modal.count()) === 0, { o: count(O), q: count(Q) });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. l\'app répond « oui » : elle part sans question ===');
await becomeO('oui');
await dropOnQ();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
check('« oui » : la sonde O part, la sonde Q s\'ouvre, l\'explorateur est refermé', count(O) === 0 && count(Q) === 1 && await ex.isHidden(), { o: count(O), q: count(Q) });
await clean('« oui »');

say('=== 2. une app qui ne connaît pas « fermer » (la sonde Q) part comme avant ===');
await showFiles('Premier');
await row('Premier').dblclick();
await waitFor('O ouvert', () => count(O) === 1 && count(Q) === 0);
await ready(O);
check('GFS_INCONNU : la sonde Q part, la sonde O s\'ouvre, sans fenêtre ni phrase', count(O) === 1 && count(Q) === 0 && await ex.isHidden(), { o: count(O), q: count(Q) });
await clean('GFS_INCONNU');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. l\'app pose sa question d\'enregistrement : la personne y répond à la souris ===');
await becomeO('question');
await dropOnQ();
await frameOf(O).locator('#question').waitFor({ state: 'visible', timeout: 5000 });
check('la question de l\'app est à l\'écran : l\'explorateur est refermé, l\'app et son cadre sont là, rien ne s\'est ouvert', await ex.isHidden() && count(O) === 1 && count(Q) === 0, { o: count(O), q: count(Q) });
const askedWith = (await readProbe(frameOf(O))).fermer;
check('GFS a demandé « fermer » une fois, avec la raison du geste (« explorateur »)', JSON.stringify(askedWith) === JSON.stringify([{ raison: 'explorateur' }]), askedWith);
await clean('pendant la question de l\'app');
await shot('3-question-de-l-app');
await frameOf(O).locator('#annuler').click();
await page.waitForTimeout(700);
check('« Annuler » dans l\'app : elle reste (cadre gardé), la sonde Q ne s\'ouvre pas, GFS ne dit rien', count(O) === 1 && count(Q) === 0 && await ex.isHidden(), { o: count(O), q: count(Q) });
await clean('« Annuler »');
check('l\'app a gardé sa réponse (« annuler ») et son appel', JSON.stringify((await readProbe(frameOf(O))).reponses) === JSON.stringify(['annuler']));
check('une app qui a répondu non n\'a rien arrêté : GFS ne lui dit pas « rester »', (await readProbe(frameOf(O))).rester.length === 0, (await readProbe(frameOf(O))).rester);
await dropOnQ();
await frameOf(O).locator('#question').waitFor({ state: 'visible', timeout: 5000 });
await frameOf(O).locator('#abandonner').click();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
check('« Abandonner » dans l\'app : elle répond oui, elle part, la sonde Q s\'ouvre', count(O) === 0 && count(Q) === 1, { o: count(O), q: count(Q) });
await clean('« Abandonner »');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. l\'app se tait : au bout de dix secondes la personne décide (« Attendre ») ===');
await becomeO('muet');
const started = Date.now();
await dropOnQ();
await modal.waitFor({ state: 'visible', timeout: 16000 });
const waited = Date.now() - started;
const title = (await frame.locator('#ask-title').innerText()).trim();
const text = (await frame.locator('#ask-text').innerText()).replace(/\s+/g, ' ');
const buttons = (await modal.locator('.btn').allInnerTexts()).map(item => item.trim());
say('délai :', waited, 'ms | titre :', title, '| boutons :', buttons);
check('GFS attend dix secondes avant de proposer « Fermer quand même »', waited >= 9000 && waited <= 15000, waited);
check('la fenêtre dit quelle app ne répond pas, et que la question d\'enregistrement de l\'app peut attendre une réponse', title === WORD.silent && WORD.hint.test(text), { title, text });
check('deux boutons : « Attendre » (le clavier y est) et « Fermer quand même »', buttons.length === 2 && buttons.includes(WORD.wait) && buttons.includes(WORD.force) && await modal.locator('[data-fk="ask-no"]').evaluate(node => node === node.ownerDocument.activeElement), buttons);
await shot('4-ne-repond-pas');
await modal.locator('[data-fk="ask-no"]').click();
await page.waitForTimeout(1500);
check('« Attendre » : la fenêtre se ferme, l\'app reste, rien ne s\'ouvre, l\'explorateur reste refermé', (await modal.count()) === 0 && count(O) === 1 && count(Q) === 0 && await ex.isHidden(), { o: count(O), q: count(Q) });
await frameOf(O).evaluate(() => window.__fermer(true));
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
check('l\'app répond « oui » plus tard : le changement a lieu', count(O) === 0 && count(Q) === 1, { o: count(O), q: count(Q) });

say('=== 5. l\'app se tait : « Fermer quand même » ===');
await becomeO('muet');
await dropOnQ();
await modal.waitFor({ state: 'visible', timeout: 16000 });
await modal.locator('[data-fk="ask-yes"]').click();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
check('« Fermer quand même » : l\'app part sans avoir répondu, la sonde Q s\'ouvre', count(O) === 0 && count(Q) === 1 && (await modal.count()) === 0, { o: count(O), q: count(Q) });

say('=== 6. la personne repart explorer avant la réponse de l\'app ===');
await becomeO('muet');
await dropOnQ();
await waitFor('l\'appel fermer', async () => (await readProbe(frameOf(O))).fermer.length === 1);
await frame.locator('#floater-files').click();
await ex.waitFor({ state: 'visible' });
await frameOf(O).evaluate(() => window.__fermer(true));
await page.waitForTimeout(1500);
check('l\'explorateur est rouvert avant la réponse : la réponse tardive n\'ouvre rien, l\'app et l\'explorateur restent', await ex.isVisible() && count(O) === 1 && count(Q) === 0 && (await modal.count()) === 0, { o: count(O), q: count(Q) });
check('l\'app qui répond oui trop tard, sans connaître « rester » : GFS le lui a dit une fois (raison « explorateur »), elle répond GFS_INCONNU, sans fenêtre ni phrase ni avertissement',
  JSON.stringify((await readProbe(frameOf(O))).rester) === JSON.stringify([{ raison: 'explorateur' }]) && (await modal.count()) === 0 && await toast.isHidden() && warnings.length === 0, { rester: (await readProbe(frameOf(O))).rester, warnings });
await closeExplorer();

say('=== 6b. tu restes : l\'app qui connaît « rester » reprend ce qu\'elle avait arrêté ===');
await becomeO('muet');
await frameOf(O).evaluate(() => { document.body.dataset.rester = 'oui'; });
await dropOnQ();
await waitFor('l\'appel fermer', async () => (await readProbe(frameOf(O))).fermer.length === 2);
await frame.locator('#floater-files').click();
await ex.waitFor({ state: 'visible' });
check('avant la réponse de l\'app, GFS n\'a pas redit « rester » (il n\'y a que l\'appel de l\'essai 6)', (await readProbe(frameOf(O))).rester.length === 1, (await readProbe(frameOf(O))).rester);
await frameOf(O).evaluate(() => window.__fermer(true));
await waitFor('l\'appel rester', async () => (await readProbe(frameOf(O))).rester.length === 2);
await page.waitForTimeout(800);
const stayed = (await readProbe(frameOf(O))).rester;
say('rester reçu :', stayed);
check('l\'app a dit oui puis la personne est restée dans l\'explorateur : GFS lui dit « rester » avec la raison du « fermer »', stayed.length === 2 && JSON.stringify(stayed[1]) === JSON.stringify({ raison: 'explorateur' }), stayed);
check('l\'app et l\'explorateur sont en place, rien ne s\'ouvre, GFS ne dit rien de plus à la personne', await ex.isVisible() && count(O) === 1 && count(Q) === 0 && (await modal.count()) === 0 && await toast.isHidden(), { o: count(O), q: count(Q) });
await closeExplorer();
await clean('« rester »');

say('=== 7. l\'app répond par une erreur ===');
await becomeO('echec');
await dropOnQ();
await modal.waitFor({ state: 'visible', timeout: 5000 });
const faultTitle = (await frame.locator('#ask-title').innerText()).trim();
const faultText = (await frame.locator('#ask-text').innerText()).replace(/\s+/g, ' ');
const faultButtons = (await modal.locator('.btn').allInnerTexts()).map(item => item.trim());
check('la fenêtre dit que l\'app n\'a pas pu se fermer, avec le texte de l\'app', faultTitle === WORD.fault && WORD.reason.test(faultText), { faultTitle, faultText });
check('deux boutons : « Rester » et « Fermer quand même »', faultButtons.length === 2 && faultButtons.includes(WORD.stay) && faultButtons.includes(WORD.force), faultButtons);
await shot('7-pas-pu-se-fermer');
await modal.locator('[data-fk="ask-no"]').click();
await page.waitForTimeout(800);
check('« Rester » : l\'app reste, rien ne s\'ouvre', (await modal.count()) === 0 && count(O) === 1 && count(Q) === 0 && await ex.isHidden(), { o: count(O), q: count(Q) });
await dropOnQ();
await modal.waitFor({ state: 'visible', timeout: 5000 });
await modal.locator('[data-fk="ask-yes"]').click();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
check('« Fermer quand même » sur une erreur : l\'app part, la sonde Q s\'ouvre', count(O) === 0 && count(Q) === 1, { o: count(O), q: count(Q) });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 8. un lien : l\'app qui suit le lien est celle à qui GFS demande de se fermer ===');
const q = () => frameOf(Q);
await q().evaluate(() => { document.body.dataset.choisir = JSON.stringify({ types: ['document'], apps: ['sonde-o'] }); });
await q().locator('#choisir').click();
await ex.waitFor({ state: 'visible' });
await row('Premier').dblclick();
await waitFor('la clé du fichier', async () => (await readProbe(q())).resultats.length === 1);
const key = ((await readProbe(q())).resultats[0] || {}).data;
await q().evaluate(([choice, answer]) => { document.body.dataset.ouvrir = JSON.stringify({ app: choice.app, fichier: { id: choice.id, type: choice.type } }); document.body.dataset.fermer = answer; }, [key, 'non']);
await q().locator('#ouvrir').click();
await waitFor('la réponse du lien', async () => (await readProbe(q())).resultats.length === 2);
const refused = await readProbe(q());
say('Q a reçu :', refused.fermer, refused.resultats[1]);
check('la sonde Q répond « non » à « fermer » : elle reste, le lien rend { ouvert: false }, et l\'appel portait la raison « lien »', count(Q) === 1 && count(O) === 0 && JSON.stringify(refused.fermer) === JSON.stringify([{ raison: 'lien' }]) && refused.resultats[1].ok === true && refused.resultats[1].data.ouvert === false, refused);
await clean('lien refusé');
await q().evaluate(() => { document.body.dataset.fermer = 'oui'; });
await q().locator('#ouvrir').click();
await waitFor('O ouvert par le lien', () => count(O) === 1 && count(Q) === 0);
check('la sonde Q répond « oui » : elle part, la sonde O s\'ouvre sur le fichier du lien', count(O) === 1 && count(Q) === 0, { o: count(O), q: count(Q) });
await ready(O);
const opening = (await readProbe(frameOf(O))).ouverture;
check('l\'app ouverte par le lien reçoit l\'ouverture « lien »', Boolean(opening) && opening.raison === 'lien' && opening.fichier.type === 'document', opening);
await clean('lien accepté');

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
