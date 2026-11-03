// Les liens entre apps avec la vraie Publipostage+ (contrats 5.4, points 2 et 7), celle que GFS référence, dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier : une app (la sonde Q,
// labo/sondes/q-liens/) demande à GFS de lui faire choisir un modèle de Publipostage+ (document, grille ou présentation ; jamais un e-mail ni une macro, que l'app n'offre pas à choisir), puis de
// l'ouvrir. La présentation demande l'extension « Diapositives » : le fichier est grisé tant qu'elle est éteinte, et la fenêtre qui la débloque s'ouvre sur sa ligne. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `liens-publipostage-${lang}-${scheme}`;
const WORD = lang === 'fr'
  ? { deck: 'Ma présentation', grid: 'Émargement (grille)', doc: 'Feuille d’émargement', note: 'Notes de session', hiddenRows: ['Convocation de session', 'Dossier de formation', 'Support de session'], folder: 'Formation', opened: /Ouvert depuis l.explorateur\./, title: 'Lier un modèle' }
  : { deck: 'My presentation', grid: 'Émargement (grille)', doc: 'Feuille d’émargement', note: 'Notes de session', hiddenRows: ['Convocation de session', 'Dossier de formation', 'Support de session'], folder: 'Formation', opened: /Opened from the explorer\./, title: 'Link a template' };
const FK = 'ext:publipostage/diapositives';
const ACCEPTS = {
  fichier: 'controller.js',
  de: 'const ACCEPTS_OPEN = Object.freeze({',
  vers: "const ACCEPTS_OPEN = Object.freeze({ 'sonde-q': { fichier: true, nouveau: true },",
};
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });

await seedFiles(lab.frame);
await lab.frame.evaluate(async deck => {
  await grist.docApi.applyUserActions([['AddTable', 'SondeQ_Fichiers', [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }]]]);
  await grist.docApi.applyUserActions([['AddRecord', 'Publipostage_Modeles', null, { Nom: deck, TypeModele: 'presentation', Contenu: '<p>Première diapositive</p>', DateModif: Math.floor(Date.now() / 1000) - 120, ModifiePar: '', EstParDefaut: false, NomFichierPDF: '' }]]);
}, WORD.deck);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const waitFor = async (label, test, ms = 8000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
let app = null;
const probe = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const shot = name => lab.shotPanel(run, name, frame);
const ex = frame.locator('.ex');
const toast = frame.locator('#toast');
const footer = () => frame.locator('.ex-foot .btn');
const rowTexts = () => frame.locator('.ls-row').allInnerTexts().then(list => list.map(text => text.replace(/\s+/g, ' ').trim()));
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const framesOf = re => page.frames().filter(f => re.test(f.url())).length;
const focusedRow = () => frame.evaluate(() => (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null));
// Ce que la personne voit dans Publipostage+ : le modèle ouvert (nom, genre) et le coin d'état.
const shown = () => app.evaluate(() => ({ name: document.getElementById('template-name').value, status: document.getElementById('status-msg').textContent, grid: GridEditor.isActive(), extensions: GfsLink.extensions() }));
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const startQ = async () => {
  await lab.openModules(frame);
  await frame.locator('[data-fk="app:sonde-q"]').check().catch(() => {});
  await lab.settle(frame);
  await frame.locator('[data-open="sonde-q"]').click();
  app = await lab.appFrame(/q-liens\//);
  await waitFor('la sonde Q a reçu son contexte', async () => (await probe()).contexte);
  received = 0;
};
let received = 0;
const ask = async (name, request) => {
  await app.evaluate(([key, value]) => { document.body.dataset[key] = JSON.stringify(value); }, [name, request]);
  await app.locator(`#${name}`).click();
};
const answer = async () => {
  await waitFor(`la réponse de GFS (${received + 1})`, async () => (await probe()).resultats.length > received);
  return (await probe()).resultats[received++];
};

// Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, comme dans run-ouvrir-publipostage.
await lab.openModules(frame);
await frame.locator('[data-fk="app:publipostage"]').check();
await lab.settle(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
await startQ();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. choisir : les cinq genres de modèles demandés, trois offerts ===');
await ask('choisir', { types: ['document', 'grille', 'presentation', 'email', 'macro'], titre: WORD.title });
await ex.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
let rows = await rowTexts();
say('à la racine :', rows);
check('à la racine : les documents et la présentation, rien d\'un autre genre que ceux que l\'app offre à choisir', rows.some(text => text.includes('Contrat de prestation')) && rows.some(text => text.includes(WORD.deck)) && !rows.some(text => WORD.hiddenRows.some(name => text.includes(name))), rows);
check('la présentation est grisée tant que l\'extension « Diapositives » est éteinte (jamais cachée)', (await frame.locator('.ls-row.lk', { hasText: WORD.deck }).count()) === 1, rows);
await shot('1-racine');
await row(WORD.folder).dblclick();
await page.waitForTimeout(300);
rows = await rowTexts();
say('dans « Formation » :', rows);
check('dans un dossier : documents et grilles, ni l\'e-mail ni la macro du même dossier', rows.some(text => text.includes(WORD.doc)) && rows.some(text => text.includes(WORD.grid)) && rows.some(text => text.includes(WORD.note)) && !rows.some(text => WORD.hiddenRows.some(name => text.includes(name))), rows);
await shot('2-dossier');
await row(WORD.grid).dblclick();
let reply = await answer();
say('réponse :', reply);
check('la grille désignée est rendue à l\'app avec sa clé { app, id, nom, type }', reply.ok && reply.data.app === 'publipostage' && /^\d+$/.test(reply.data.id) && reply.data.nom === WORD.grid && reply.data.type === 'grille' && Object.keys(reply.data).length === 4, reply);
const gridKey = reply.data;
check('l\'explorateur se referme, la sonde garde son cadre', await ex.isHidden() && framesOf(/q-liens\//) === 1);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. ouvrir : la grille s\'ouvre dans Publipostage+ ===');
await ask('ouvrir', { app: gridKey.app, fichier: { id: gridKey.id, type: gridKey.type } });
await waitFor('Publipostage+ prend la place de la sonde', async () => framesOf(/q-liens\//) === 0 && framesOf(/publipostage/) === 1);
app = await lab.appFrame(/publipostage/);
await waitStarted();
let seen = await shown();
say('Publipostage+ montre :', seen);
check('Publipostage+ s\'ouvre sur la grille désignée (le nom, l\'éditeur de grille) ; sa phrase « ouvert depuis l\'explorateur » n\'est pas dite (la raison est « lien »)', seen.name === WORD.grid && seen.grid === true && !WORD.opened.test(seen.status), seen);
await shot('3-grille-ouverte');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. choisir une présentation : l\'extension « Diapositives » se débloque dans la fenêtre ===');
await startQ();
await ask('choisir', { types: ['presentation'] });
await ex.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
rows = await rowTexts();
check('seule la présentation est listée, grisée', rows.length === 1 && rows[0].includes(WORD.deck) && (await frame.locator('.ls-row.lk').count()) === 1, rows);
await row(WORD.deck).dblclick();
await frame.locator('.mod').waitFor();
check('un double-clic sur la présentation grisée ouvre la fenêtre des apps sur la ligne « Diapositives »', (await focusedRow()) === FK && (await probe()).resultats.length === 0, await focusedRow());
await shot('4-extension-a-cocher');
await frame.locator(`[data-row="${FK}"] label`).click();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await page.waitForTimeout(500);
check('l\'extension cochée, la présentation n\'est plus grisée et le choix continue', (await frame.locator('.ls-row.lk').count()) === 0 && (await frame.locator('.ex.ex--choose').count()) === 1, await rowTexts());
await row(WORD.deck).dblclick();
reply = await answer();
check('la présentation est rendue à l\'app avec sa clé', reply.ok && reply.data.app === 'publipostage' && reply.data.nom === WORD.deck && reply.data.type === 'presentation', reply);
const deckKey = reply.data;
await ask('ouvrir', { app: deckKey.app, fichier: { id: deckKey.id, type: deckKey.type } });
await waitFor('Publipostage+ prend la place de la sonde', async () => framesOf(/q-liens\//) === 0 && framesOf(/publipostage/) === 1);
app = await lab.appFrame(/publipostage/);
await waitStarted();
seen = await shown();
say('Publipostage+ montre :', seen);
check('Publipostage+ s\'ouvre sur la présentation, l\'extension « Diapositives » active', seen.name === WORD.deck && seen.extensions.includes('diapositives'), seen);
await shot('5-presentation-ouverte');

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
