// Le numéro de structure du document (contrats 6.4, point 16) dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright : événements
// du pointeur et du clavier du navigateur, jamais dispatchEvent). La ligne réservée `@document` / `gfs` / `structure`, ce que le moteur de Grist reçoit, ce que GFS refuse d'écrire.
//   1. Le premier geste (installer une app, la table naît avec l'accord de la personne) : la ligne du numéro part APRÈS le geste, dans son propre lot, avec `{"structure":1}`.
//   2. Le document rouvert : le numéro n'est pas réécrit ; un geste de plus (épingler) n'écrit que le rangement.
//   3. Un document qu'une version plus récente a préparé (`{"structure":99,…}`) : GFS le dit à l'ouverture, lit tout (les apps installées restent), n'écrit rien d'autre que la
//      ligne-sonde (ajoutée puis retirée aussitôt) ; épingler dit pourquoi, « Installer » est grisé, aucune question de table, la table est telle qu'elle était.
//   4. Un document d'avant (aucune ligne du numéro) : le premier geste la note ; une ligne du numéro sans le numéro est complétée sans perdre ce qu'elle portait.
//   5. Document en lecture seule : aucune écriture du tout, le numéro n'est pas noté.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { explorerTools } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `structure-${lang}-${scheme}`;
const ANA = { Email: 'ana@exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 };
const NEWER = /plus récente de GFS|newer version of GFS/;

const lab = await startLab({ lang, colorScheme: scheme, user: ANA });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));

let frame = lab.frame;
const open = async ({ query = '' } = {}) => {
  await lab.setUser(ANA);
  await lab.forgetActions();
  await frame.evaluate(extra => {
    const url = new URL(location.href);
    for (const [key, value] of new URLSearchParams(extra)) url.searchParams.set(key, value);
    location.href = url.href;
  }, query);
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const closeWindow = async () => { if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };
const { row, toast, starOn, until } = explorerTools(() => frame, page);
const shot = name => lab.shotPanel(run, name, frame);
const gfsActions = async () => (await lab.actions()).filter(action => / GFS_Filing/.test(action));
const SONDE = 'AddRecord GFS_Filing [@sonde]';
const MARK = 'AddRecord GFS_Filing [@document]';
const markOf = async () => {
  const state = await lab.rangement(frame);
  return state.table ? state.lines.find(line => line.Utilisateur === '@document' && line.App === 'gfs' && line.Fichier === 'structure') || null : null;
};
const allLines = async () => JSON.stringify(((await lab.rangement(frame)).lines || []).map(({ id, ...line }) => line));
const setMark = async value => {
  const mark = await markOf();
  await frame.evaluate(async ({ id, value }) => {
    await grist.docApi.applyUserActions([value === null ? ['RemoveRecord', 'GFS_Filing', id] : ['UpdateRecord', 'GFS_Filing', id, { Valeur: value }]]);
  }, { id: mark.id, value });
};
const openApps = async () => { await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click(); await frame.locator('.mod').waitFor(); };
const contract = 'Contrat de prestation';

// ----- 1. Le premier geste : installer une app.
say('\n1. Premier geste : installer une app');
await open();
await closeWindow();
check('au départ, aucune table GFS_Filing ; l\'ouverture n\'écrit rien', (await lab.rangement(frame)).table === false && (await lab.actions()).length === 0, await lab.actions());
await openApps();
await frame.locator('[data-fk="app:automation"]').click();
await frame.locator('.ask').waitFor({ timeout: 5000 });
await frame.locator('[data-fk="ask-yes"]').click();
const installed = await until(async () => (await frame.locator('[data-fk="open:automation"]').count()) > 0, 20000);
check('l\'app est installée après « Créer la table »', Boolean(installed));
await until(async () => (await markOf()) !== null, 15000); // la fenêtre montre l'app avant que les écritures soient parties : on attend la dernière
const sequence = await gfsActions();
check('le numéro est la dernière écriture dans la table de GFS : après le geste, dans son propre lot', sequence.length >= 3 && sequence.at(-1) === MARK && sequence[0] === 'AddTable GFS_Filing', sequence);
const mark = await markOf();
check('la ligne du numéro est là : `{"structure":1}`', mark && mark.Valeur === '{"structure":1}' && mark.Favori === false && mark.Dossier === '', mark);
const apps = (await lab.rangement(frame)).value;
check('la ligne des apps installées n\'a pas bougé de forme : automation, sans autre clé', apps && Object.keys(apps).includes('automation') && !('structure' in apps), apps);
check('aucune ligne-sonde ne reste', (await lab.rangement(frame)).lines.every(line => line.Utilisateur !== '@sonde'));
await shot('1-installee');

// ----- 2. Le document rouvert.
say('\n2. Le document rouvert');
await open();
await closeWindow();
check('à l\'ouverture, le numéro n\'est pas réécrit : une sonde, rien d\'autre', JSON.stringify(await gfsActions()) === JSON.stringify([SONDE, 'RemoveRecord GFS_Filing']), await lab.actions());
await lab.forgetActions();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
check('épingler un fichier allume l\'étoile', Boolean(await until(() => starOn(contract), 20000)));
await until(async () => (await lab.actions()).length > 0, 15000);
// Publipostage+ tient son rangement (contrats 6.4, point 8) : le geste s'écrit dans sa table, GFS_Filing ne reçoit pas le numéro une seconde fois.
const pinned = await lab.actions();
check('le geste écrit le rangement de la personne, pas le numéro', pinned.length >= 1 && pinned.every(action => action !== MARK), pinned);
check('un seul numéro dans la table', ((await lab.rangement(frame)).lines.filter(line => line.Fichier === 'structure')).length === 1);

// ----- 3. Un document qu'une version plus récente a préparé.
say('\n3. Un document plus récent');
await setMark('{"structure":99,"venu":"plus tard"}');
const frozen = await allLines();
await open();
const notice = await until(async () => NEWER.test(await toast()), 8000);
check('à l\'ouverture, GFS dit que le document vient d\'une version plus récente', Boolean(notice), await toast());
await shot('3-document-plus-recent');
check('GFS n\'a écrit que la ligne-sonde (ajoutée puis retirée) : aucune écriture de rangement', JSON.stringify(await gfsActions()) === JSON.stringify([SONDE, 'RemoveRecord GFS_Filing']), await lab.actions());
check('GFS lit ce qui est là : l\'étoile d\'Ana est allumée', await starOn(contract));
await lab.forgetActions();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await page.waitForTimeout(600);
const reason = await toast();
check('épingler dit pourquoi rien ne s\'enregistre, sans question de table', NEWER.test(reason) && (await frame.locator('.ask').count()) === 0, reason);
check('l\'étoile n\'a pas changé et rien n\'a été écrit', (await starOn(contract)) && (await lab.actions()).length === 0, await lab.actions());
await openApps();
const enabled = await frame.locator('.mod .ap-act .btn.primary:not([aria-disabled="true"])').count();
check('dans la fenêtre des apps, aucun bouton « Installer » n\'est actif (grisé, jamais masqué)', enabled === 0 && (await frame.locator('.mod .ap-act .btn.primary').count()) > 0, enabled);
check('les apps déjà installées se lisent : « Ouvrir » sur Automation+', (await frame.locator('[data-fk="open:automation"]').count()) === 1);
await frame.locator('.mod .ap-act .btn.primary[aria-disabled="true"]').first().click({ force: true });
await page.waitForTimeout(400);
check('un clic sur un bouton grisé n\'ouvre aucune question et n\'écrit rien', (await frame.locator('.ask').count()) === 0 && (await lab.actions()).length === 0, await lab.actions());
await shot('3b-installer-grise');
await closeWindow();
check('la table est exactement telle qu\'elle était (le numéro 99 aussi)', (await allLines()) === frozen);

// ----- 4. Un document d'avant, puis une ligne du numéro sans le numéro.
say('\n4. Un document d\'avant');
await setMark(null);
const before = JSON.stringify((await lab.rangement(frame)).lines.filter(line => line.Fichier !== 'structure'));
await open();
await closeWindow();
check('le document d\'avant n\'a pas de numéro : GFS ne s\'en plaint pas', !NEWER.test(await toast()) && (await markOf()) === null);
await lab.forgetActions();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await until(async () => !(await starOn(contract)), 20000);
await until(async () => (await markOf()) !== null, 15000);
const stamped = await gfsActions();
check('le premier geste note le numéro, après lui', stamped.at(-1) === MARK && stamped.filter(action => action === MARK).length === 1, stamped);
check('le numéro est `{"structure":1}`, les autres lignes ne bougent que par le geste', (await markOf()).Valeur === '{"structure":1}'
  && JSON.stringify((await lab.rangement(frame)).lines.filter(line => line.Fichier !== 'structure' && line.Utilisateur === '@document')) === JSON.stringify(JSON.parse(before).filter(line => line.Utilisateur === '@document')));
await setMark('{"autre":"gardé"}');
await open();
await closeWindow();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await until(() => starOn(contract), 20000);
check('une ligne du numéro sans numéro est complétée, ce qu\'elle portait reste', (await markOf()).Valeur === '{"autre":"gardé","structure":1}', await markOf());

// ----- 5. Lecture seule.
say('\n5. Document en lecture seule');
await setMark(null);
const readOnlyBefore = await allLines();
await open({ query: 'readonly=true' });
check('à l\'ouverture en lecture seule, GFS n\'écrit rien du tout', (await lab.actions()).length === 0, await lab.actions());
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await page.waitForTimeout(500);
check('épingler dit « lecture seule » ; le numéro n\'est pas noté', /lecture seule|read-only/i.test(await toast()) && (await lab.actions()).length === 0 && (await allLines()) === readOnlyBefore, await toast());
check('aucun avertissement de GFS, aucune erreur de script', warnings.length === 0, warnings);
await lab.browser.close();
