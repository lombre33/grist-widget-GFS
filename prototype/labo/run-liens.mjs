// Les liens entre apps (contrats 5.4, points 2 et 7), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier : l'app (la sonde Q, labo/sondes/q-liens/) demande à GFS de lui faire
// choisir un fichier d'une autre app (la sonde O, labo/sondes/o-ouvrir/), puis de l'ouvrir. GFS tient les deux sondes pour des apps qui acceptent « ouvrir » (le labo seul leur fait déclarer
// `ouverture` dans leur manifeste). Les gestes de la personne sont de vrais gestes ; seul le second `choisir` pendant un choix est un clic de la sonde sur elle-même (le cadre de l'app est alors sous
// l'explorateur : c'est le courtier qu'on mesure, pas une interface). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, probeDeclares } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const fr = lang === 'fr';
const run = `liens-${lang}-${scheme}`;
const WORD = fr
  ? { title: 'Lier un document', byDefault: 'Choisir un fichier', pick: 'Choisir', cancel: 'Annuler', open: 'Ouvrir', close: 'Fermer', newOff: /Indisponible pendant le choix/, hint: /Double-clique un fichier/, empty: /Aucun fichier de ce genre/, gone: /Sonde O n’a plus ce fichier/, probeO: 'Sonde O', rows: ['Premier', 'Deuxième', 'Troisième'], macro: 'Macro cachée' }
  : { title: 'Link a document', byDefault: 'Choose a file', pick: 'Choose', cancel: 'Cancel', open: 'Open', close: 'Close', newOff: /Not available while choosing/, hint: /Double-click a file/, empty: /No file of this kind/, gone: /Probe O no longer has this file/, probeO: 'Probe O', rows: ['First', 'Second', 'Third'], macro: 'Hidden macro' };
const ACCEPTS = [probeDeclares('sonde-o', { ouverture: { fichier: true, nouveau: true } }), probeDeclares('sonde-q', { ouverture: { fichier: true, nouveau: true } })];
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [...ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && isGfsWarning(m.text())) warnings.push(m.text()); });

// Les fichiers des deux sondes : une table du préfixe de chaque app, remplie par GFS (accès complet) ; GFS les relit en repartant. La sonde O a trois documents et une macro (que son app n'offre pas à choisir).
const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async ([stamp, names, macro]) => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeO_Fichiers', columns], ['AddTable', 'SondeQ_Fichiers', columns]]);
  await grist.docApi.applyUserActions([
    ['BulkAddRecord', 'SondeO_Fichiers', [null, null, null, null], { Nom: [...names, macro], Type: ['document', 'document', 'document', 'macro'], DateModif: [stamp - 60, stamp - 120, stamp - 180, stamp - 240] }],
    ['BulkAddRecord', 'SondeQ_Fichiers', [null], { Nom: ['Projet Q'], Type: ['projet'], DateModif: [stamp - 30] }],
  ]);
}, [now, WORD.rows, WORD.macro]);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

let app = await lab.openApp('sonde-q', /q-liens\//, frame);
const probe = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const waitFor = async (label, test) => {
  for (let i = 0; i < 60; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
await waitFor('la sonde Q a reçu son contexte', async () => (await probe()).contexte);
await app.evaluate(() => { window.__avant = true; });

const ex = frame.locator('.ex');
const toast = frame.locator('#toast');
const shot = name => lab.shotPanel(run, name, frame);
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const rowTexts = () => frame.locator('.ls-row').allInnerTexts().then(list => list.map(text => text.replace(/\s+/g, ' ').trim()));
const infoText = async () => (await frame.locator('.ex-info').innerText()).replace(/\s+/g, ' ');
const qFrames = () => page.frames().filter(f => /q-liens\//.test(f.url())).length;
const oFrames = () => page.frames().filter(f => /o-ouvrir\//.test(f.url())).length;
const quiet = () => toast.waitFor({ state: 'hidden', timeout: 20000 });
const footer = () => frame.locator('.ex-foot .btn');
const newButton = () => frame.locator('.ex-nav-row .btn.primary');
const choosing = () => frame.locator('.ex.ex--choose').count().then(n => n === 1);

// La sonde Q appelle GFS à un clic de la vraie souris sur son bouton, avec la demande posée dans le corps de sa page ; `answer()` rend la réponse de GFS à l'appel suivant.
let received = 0;
const ask = async (name, request) => {
  await app.evaluate(([key, value]) => { document.body.dataset[key] = JSON.stringify(value); }, [name, request]);
  await app.locator(`#${name}`).click();
};
const answer = async () => {
  await waitFor(`la réponse de GFS (${received + 1})`, async () => (await probe()).resultats.length > received);
  return (await probe()).resultats[received++];
};
const picked = async (app_, id, nom, type) => JSON.stringify(await answer().then(r => r.data)) === JSON.stringify({ app: app_, id, nom, type });
// Ouvrir une demande de choix et attendre l'explorateur en mode choix.
const choose = async request => { await ask('choisir', request); await ex.waitFor({ state: 'visible' }); await page.waitForTimeout(200); };

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. choisir : l\'app qui offre les fichiers (la sonde O) n\'est pas installée ===');
await choose({ types: ['document'], titre: WORD.title });
const title = (await frame.locator('.ex-title').innerText()).trim();
const labels = (await footer().allInnerTexts()).map(text => text.trim());
const offRows = await rowTexts();
say('titre :', title, '| boutons :', labels, '| Nouveau :', await newButton().getAttribute('aria-disabled'), '| lignes :', offRows);
check('l\'explorateur s\'ouvre en mode choix, avec le titre de l\'app (déjà traduit), « Choisir » à la place d\'« Ouvrir », « Annuler » à la place de « Fermer »', title === WORD.title && labels[0] === WORD.pick && labels[1] === WORD.cancel && await choosing(), { title, labels });
check('« Nouveau » est grisé (aria-disabled) et dit pourquoi', (await newButton().getAttribute('aria-disabled')) === 'true' && WORD.newOff.test(await newButton().getAttribute('title')), await newButton().getAttribute('title'));
check('il ne montre que les documents de l\'app qui les offre à choisir : ni la macro de la sonde O, ni le projet de la sonde Q', offRows.length === 3 && WORD.rows.every(name => offRows.some(text => text.includes(name))) && !offRows.some(text => text.includes(WORD.macro) || /Projet Q/.test(text)), offRows);
check('l\'app n\'étant pas installée, ses fichiers sont grisés, jamais cachés', (await frame.locator('.ls-row.lk').count()) === 3, await frame.locator('.ls-row.lk').count());
check('la barre d\'information explique le geste (double-clic, ou sélectionner puis « Choisir »)', WORD.hint.test(await infoText()), await infoText());
await shot('1-choix-grise');

await row(WORD.rows[0]).dblclick();
await frame.locator('.mod').waitFor();
check('un double-clic sur un fichier grisé ouvre la fenêtre des apps, et le choix reste en cours (rien rendu à l\'app)', (await choosing()) && (await probe()).resultats.length === 0 && (await frame.locator('[data-fk="app:sonde-o"]').count()) === 1);
await frame.locator('[data-fk="app:sonde-o"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'detached' });
await page.waitForTimeout(400);
check('la personne installe l\'app et ferme la fenêtre : l\'explorateur est toujours en mode choix, les fichiers ne sont plus grisés', (await choosing()) && (await frame.locator('.ls-row.lk').count()) === 0 && (await frame.locator('.ls-row').count()) === 3, await rowTexts());
await shot('2-choix-degrise');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. choisir : les trois gestes (double-clic, Entrée, « Choisir ») ===');
await row(WORD.rows[0]).dblclick();
check('le double-clic rend { app, id, nom, type } à l\'app, qui garde son cadre ; l\'explorateur se referme', await picked('sonde-o', '1', WORD.rows[0], 'document') && await ex.isHidden() && qFrames() === 1);

await choose({ types: ['document'] });
check('sans titre, GFS dit « ' + WORD.byDefault + ' »', (await frame.locator('.ex-title').innerText()).trim() === WORD.byDefault);
await row(WORD.rows[1]).click();
check('la sélection d\'un fichier remplace l\'explication dans la barre d\'information', !WORD.hint.test(await infoText()), await infoText());
await page.keyboard.press('Enter');
check('Entrée sur le fichier sélectionné le désigne', await picked('sonde-o', '2', WORD.rows[1], 'document') && await ex.isHidden());

await choose({ types: ['document'] });
await row(WORD.rows[2]).click();
await footer().first().click();
check('« Choisir » désigne le fichier sélectionné', await picked('sonde-o', '3', WORD.rows[2], 'document') && await ex.isHidden());

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. choisir : annuler, « Nouveau », deux choix à la fois, filtres ===');
await choose({ types: ['document'] });
await footer().nth(1).click();
let reply = await answer();
check('« Annuler » rend null à l\'app et referme l\'explorateur', reply.ok && reply.data === null && await ex.isHidden(), reply);

await choose({ types: ['document'] });
await page.keyboard.press('Escape');
reply = await answer();
check('Échap rend null aussi', reply.ok && reply.data === null && await ex.isHidden(), reply);

await choose({ types: ['document'] });
const box = await newButton().boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await toast.waitFor({ state: 'visible', timeout: 5000 });
const refusal = await toast.innerText();
check('« Nouveau » pendant un choix dit qu\'il est indisponible et ne crée rien', WORD.newOff.test(refusal) && (await choosing()) && (await frame.locator('.menu').count()) === 0, refusal);
await shot('3-nouveau-indisponible');

await app.evaluate(() => document.getElementById('choisir').click());
reply = await answer();
check('un second choix pendant le premier est refusé (GFS_REFUSE) ; le premier continue', !reply.ok && reply.code === 'GFS_REFUSE' && (await choosing()) && (await probe()).resultats.length === received, reply);
await footer().nth(1).click();
reply = await answer();
check('le premier, annulé ensuite, rend null', reply.ok && reply.data === null, reply);

await ask('choisir', { types: [] });
reply = await answer();
check('une demande sans type est refusée (GFS_REFUSE) avant que rien ne s\'ouvre', !reply.ok && reply.code === 'GFS_REFUSE' && await ex.isHidden(), reply);

await choose({ types: ['document'], apps: ['sonde-q'] });
const emptyText = (await frame.locator('.empty').innerText()).replace(/\s+/g, ' ');
check('restreint à une app qui n\'offre aucun de ces types : message « aucun fichier de ce genre », rien d\'autre dans la liste', WORD.empty.test(emptyText) && (await frame.locator('.ls-row').count()) === 0, emptyText);
await shot('4-vide');
await footer().nth(1).click();
await answer();

await choose({ types: ['projet'] });
check('une app peut désigner ses propres fichiers : le projet de la sonde Q est seul listé', (await rowTexts()).length === 1 && /Projet Q/.test((await rowTexts())[0]), await rowTexts());
await row('Projet Q').dblclick();
check('et il lui est rendu', await picked('sonde-q', '1', 'Projet Q', 'projet'));

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. choisir : l\'app qui demande est retirée pendant le choix ===');
await choose({ types: ['document'] });
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('.mod').waitFor();
await frame.locator('[data-fk="app:sonde-q"]').uncheck();
await lab.settle(frame);
await page.waitForTimeout(600);
const after = (await footer().allInnerTexts()).map(text => text.trim());
check('l\'app qui demandait est retirée : son cadre part, le choix s\'arrête, l\'explorateur redevient normal (Ouvrir / Fermer, Nouveau actif)',
  qFrames() === 0 && !(await choosing()) && after[0] === WORD.open && after[1] === WORD.close && (await newButton().getAttribute('aria-disabled')) === null, { cadres: qFrames(), boutons: after });
await shot('5-app-retiree');
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'detached' });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. ouvrir : refus, fichier disparu, même app, autre app ===');
await frame.locator('.ls-row').first().waitFor();
await lab.openModules(frame);
await frame.locator('[data-fk="app:sonde-q"]').check();
await lab.settle(frame);
await frame.locator('[data-open="sonde-q"]').click();
app = await lab.appFrame(/q-liens\//);
received = 0;
await waitFor('la sonde Q relancée a reçu son contexte', async () => (await probe()).contexte);

await ask('ouvrir', { app: 'sonde-o', fichier: { id: '999', type: 'document' } });
reply = await answer();
const gone = (await toast.isVisible()) ? await toast.innerText() : '';
check('un fichier disparu : GFS_INTROUVABLE à l\'app, une phrase à la personne, l\'app reste ouverte (le lien n\'est pas supprimé)', !reply.ok && reply.code === 'GFS_INTROUVABLE' && WORD.gone.test(gone) && qFrames() === 1, { reply, gone });
await shot('6-fichier-disparu');
await quiet();

await ask('ouvrir', { app: 'sonde-o', fichier: { id: '1', type: 'projet' } });
reply = await answer();
check('un type que l\'app ne sait pas ouvrir : GFS_REFUSE', !reply.ok && reply.code === 'GFS_REFUSE' && qFrames() === 1, reply);
await ask('ouvrir', { app: 'inconnue', fichier: { id: '1', type: 'document' } });
reply = await answer();
check('une app que GFS ne connaît pas : GFS_INTROUVABLE', !reply.ok && reply.code === 'GFS_INTROUVABLE' && qFrames() === 1, reply);
await ask('ouvrir', { app: 'sonde-o' });
reply = await answer();
check('une demande mal formée : GFS_REFUSE', !reply.ok && reply.code === 'GFS_REFUSE', reply);

await ask('ouvrir', { app: 'sonde-q', fichier: { id: '1', type: 'projet' } });
reply = await answer();
let seen = await probe();
say('appel reçu par la sonde Q :', seen.appels[0]);
check('un fichier de la même app : GFS l\'envoie à l\'app (appel « ouvrir », raison « lien »), qui répond { ouvert: true }',
  reply.ok && reply.data.ouvert === true && JSON.stringify(seen.appels[0]) === JSON.stringify({ fichier: { id: '1', type: 'projet' }, type: 'projet', dossier: '', raison: 'lien' }) && qFrames() === 1, { reply, appel: seen.appels[0] });
await app.evaluate(() => { document.body.dataset.reponse = 'non'; });
await ask('ouvrir', { app: 'sonde-q', fichier: { id: '1', type: 'projet' } });
reply = await answer();
check('la personne annule dans l\'app : { ouvert: false }, GFS n\'ajoute aucune phrase', reply.ok && reply.data.ouvert === false && await toast.isHidden(), reply);

await ask('ouvrir', { app: 'sonde-o', fichier: { id: '2', type: 'document' } });
await waitFor('la sonde O ouverte', async () => oFrames() === 1);
const o = await lab.appFrame(/o-ouvrir\//);
await waitFor('la sonde O a reçu son contexte', () => o.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}').contexte));
const opened = await o.evaluate(() => JSON.parse(document.body.dataset.sonde));
say('contexte de la sonde O :', opened.ouverture);
check('un fichier d\'une autre app : elle prend la place de celle qui demande (une seule app à la fois), et reçoit l\'ouverture avec la raison « lien »',
  qFrames() === 0 && oFrames() === 1 && opened.ouverture && opened.ouverture.fichier.id === '2' && opened.ouverture.fichier.type === 'document' && opened.ouverture.raison === 'lien' && opened.ouverture.dossier === '', opened.ouverture);
await shot('7-app-ouverte');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 6. ouvrir : l\'app visée n\'est pas installée ===');
await lab.openModules(frame);
await frame.locator('[data-open="sonde-q"]').click();
app = await lab.appFrame(/q-liens\//);
received = 0;
await waitFor('la sonde Q a reçu son contexte', async () => (await probe()).contexte);
await lab.openModules(frame);
await frame.locator('[data-fk="app:sonde-o"]').uncheck();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'detached' });

await ask('ouvrir', { app: 'sonde-o', fichier: { id: '3', type: 'document' } });
await frame.locator('.mod').waitFor();
check('l\'app visée n\'est pas installée : la fenêtre des apps s\'ouvre, l\'appel attend', (await probe()).resultats.length === 0 && (await frame.locator('[data-fk="app:sonde-o"]').count()) === 1);
await shot('8-ouvrir-app-absente');
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'detached' });
reply = await answer();
check('la personne ferme la fenêtre sans l\'installer : GFS_ANNULE, l\'app reste ouverte', !reply.ok && reply.code === 'GFS_ANNULE' && qFrames() === 1 && oFrames() === 0, reply);

await ask('ouvrir', { app: 'sonde-o', fichier: { id: '3', type: 'document' } });
await frame.locator('.mod').waitFor();
await frame.locator('[data-fk="app:sonde-o"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await waitFor('la sonde O ouverte', async () => oFrames() === 1);
const o2 = await lab.appFrame(/o-ouvrir\//);
await waitFor('la sonde O a reçu son contexte', () => o2.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}').contexte));
const installed = await o2.evaluate(() => JSON.parse(document.body.dataset.sonde));
check('la personne l\'installe et ferme la fenêtre : l\'app s\'ouvre sur le fichier, avec la raison « lien »', qFrames() === 0 && installed.ouverture && installed.ouverture.fichier.id === '3' && installed.ouverture.raison === 'lien', installed.ouverture);

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
