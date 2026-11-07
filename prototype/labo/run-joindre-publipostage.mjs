// Joindre les PDF d'une ligne à sa cellule « Pièces jointes » avec la VRAIE Publipostage+ (consigne 053 ; contrats 5.4 point 12), celle que GFS référence, dans un VRAI serveur Grist
// (l'image officielle, `bash vrai-serveur.sh`) : un modèle de l'app est ouvert dans son éditeur, puis le code de l'app qui joint (`RowAttachment.attachAll`, branché sur `GfsLink.attach`) reçoit des
// PDF qu'un générateur d'essai fabrique (le pdfmake de l'app n'est pas dans le miroir des bibliothèques) et les donne à GFS. Chromium seulement ; les bibliothèques de l'app viennent du miroir (`bash build-mirror.sh`).
// Deux changements, rien que pour cet essai (`routePatches`, le fichier publié n'est pas touché) : la constante `GFS_ATTACH_WIRED` de l'app passe à vrai (le grisé que l'app ne lèvera qu'après l'essai chez le porteur)
// et l'app reçoit la colonne choisie (la personne la choisit dans Réglages > Vue ; sous GFS l'option `pp_attach_column` n'est pas déclarée : où l'app la garde est une décision du porteur). Un troisième tant que le
// manifeste de GFS ne déclare pas `actions.joindre: ["pdf"]` (GFS le déclare depuis la page de l'app qui dit la 053 faite, 07/11) : le manifeste est alors complété par l'essai, et la section 0 le dit.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-joindre-publipostage.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Le grisé : sans la levée, `attachAll` ne fait rien chez GFS (rend null) ; avec elle, la jointure vaut.
//   2. Deux PDF sur deux lignes : l'app reçoit `attached` pour les deux, les cellules citent les pièces jointes, les octets sont ceux du PDF (même empreinte), un seul `BulkUpdateRecord`.
//   3. Le même nom une seconde fois (mode « remplacer ») : `replaced` (1 ; l'app compte 0 ou 1), la cellule ne cite que la nouvelle pièce.
//   4. Une ligne qui n'existe pas : un échec de raison `row`, les autres sont joints.
//   5. Un PDF que Grist trouve trop gros, au milieu de trois : lui seul échoue (`tooLarge`), `problem` reste null, les deux autres sont joints (réponse de GFS à la question de l'app sur sa 053).
//   5b. Tous les PDF sont trop gros : l'app tire `problem: 'tooLarge'` de deux échecs du même mot, rien n'est écrit.
//   7. La colonne et le mode se gardent dans la vue (réglages `pp_attach_column` et `pp_attach_mode` déclarés, 07/11) : écrits sans la barre « Enregistrer », retrouvés GFS rechargé.
//   6. Le réseau tombe : `unreachable` pour le lot, rien n'est écrit.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { seedFiles } from './seed.mjs';
import { makePdf } from './pdf-fixture.mjs';
import { PAGE_PORT, openGfs, sha256, waitFor, rowOf } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const MODEL = 'Contrat de prestation';
const CREATE_TABLES = lang === 'fr' ? /^Créer les tables$/ : /^Create the tables$/;
const TABLE = 'Courriers';
const COLUMN = 'Pieces';
const APP_FILE = '/prototype/apps/publipostage/js/row-attachment.js';
// LAB_SANS_LEVEE=1 : le témoin. L'app garde son grisé (`GFS_ATTACH_WIRED` reste faux) : `attachAll` ne fait rien chez GFS et rend null ; seule la section 1 est jouée.
const WITHOUT_LIFT = process.env.LAB_SANS_LEVEE === '1';
const DECLARED = /"joindre"\s*:\s*\[\s*"pdf"\s*\]/.test(readFileSync(join(process.env.REPO_DIR, 'prototype/manifestes/publipostage.json'), 'utf8'));
const PATCHES = [
  ...(DECLARED ? [] : [{ chemin: '/prototype/manifestes/publipostage.json', de: '"ranger": ["pdf"],', vers: '"ranger": ["pdf"],\n    "joindre": ["pdf"],' }]),
  ...(WITHOUT_LIFT ? [] : [{ chemin: APP_FILE, de: 'const GFS_ATTACH_WIRED = false;', vers: 'const GFS_ATTACH_WIRED = true;' }]),
  { chemin: APP_FILE, de: 'return { init, getColumn,', vers: 'return { chooseForLab: value => { column = value; }, writeColumnForLab: writeColumn, writeModeForLab: writeMode, init, getColumn,' },
];
const pdf = title => makePdf({ pages: 1, title });
const b64 = bytes => Buffer.from(bytes).toString('base64');
const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// L'app donne ses PDF à son code qui joint, comme son export le fait (`{ index, rowId, name, blob }`) ; ce qu'elle rend est son rapport.
const attach = (app, items) => app.evaluate(async ({ table, items }) => {
  const progress = [];
  const built = items.map((item, index) => ({ index, rowId: item.rowId, name: item.name, blob: new Blob([Uint8Array.from(atob(item.b64), char => char.charCodeAt(0))], { type: 'application/pdf' }) }));
  const report = await RowAttachment.attachAll(table, built, (rank, total) => progress.push([rank, total]));
  return { report, progress };
}, { table: TABLE, items });
const item = (rowId, name, title) => ({ rowId, name, b64: b64(pdf(title)), hash: sha256(pdf(title)) });
const cells = async rest => (await rest.rows(TABLE)).map(row => row[COLUMN]);

async function openModel(run) {
  const { page, frame } = run;
  say('--- 0. un modèle de Publipostage+ ouvert, une table avec une colonne « Pièces jointes » ---');
  check(DECLARED ? 'le manifeste de GFS déclare `actions.joindre: ["pdf"]` (aucun remplacement du manifeste)' : 'témoin : le manifeste de GFS ne déclare pas encore `actions.joindre` (l\'essai le complète)', true);
  await seedFiles(frame);
  await page.evaluate(async ([doc, table, column]) => (await fetch(`/api/docs/${doc}/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([['AddTable', table, [{ id: 'Nom', type: 'Text' }, { id: column, type: 'Attachments' }]], ['BulkAddRecord', table, [null, null, null], { Nom: ['Lot 1', 'Lot 2', 'Lot 3'] }]]),
  })).json(), [run.docId, TABLE, COLUMN]);
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await rowOf(frame, MODEL).dblclick();
  const ready = await waitFor(page, 'Publipostage+ montre le modèle', async () => {
    const app = appFrame(page);
    if (!app) return false;
    const create = app.getByRole('button', { name: CREATE_TABLES });
    if (await create.count()) await create.click();
    return (await app.evaluate(() => typeof RowAttachment !== 'undefined' && Boolean(document.getElementById('btn-export-pdf')) && document.getElementById('template-name').value)) === MODEL;
  }, 90000);
  check('Publipostage+ s\'ouvre sur le modèle dans son éditeur', ready);
  run.app = appFrame(page);
  await page.waitForTimeout(1500);
}

async function playGrey(run) {
  const { app, page } = run;
  say('--- 1. le grisé et la levée ---');
  const hosted = await app.evaluate(() => ({ hosted: GfsLink.hosted === true, answering: GfsLink.isAnswering() }));
  check('l\'app est hébergée par GFS et GFS lui répond', hosted.hosted && hosted.answering, hosted);
  await app.evaluate(column => RowAttachment.chooseForLab(column), COLUMN);
  const reason = await app.evaluate(() => RowAttachment.offReason(''));
  say('raison du grisé :', JSON.stringify(reason));
  if (WITHOUT_LIFT) {
    check('témoin : sans la levée, la jointure est grisée par GFS (raison `gfs`)', reason === 'gfs', reason);
    const nothing = await attach(app, [item(1, 'Courrier-1.pdf', 'Courrier un')]);
    check('témoin : `attachAll` ne fait rien chez GFS (rend null) et le document ne gagne aucune pièce jointe', nothing.report === null && (await run.rest.attachments()).length === 0, nothing);
    return;
  }
  check('la levée faite (le labo pose `GFS_ATTACH_WIRED`), la jointure n\'est plus grisée par GFS', reason !== 'gfs', reason);
  void page;
}

async function playTwoRows(run) {
  const { app, rest } = run;
  say('--- 2. deux PDF sur deux lignes ---');
  const first = item(1, 'Courrier-1.pdf', 'Courrier un');
  const second = item(2, 'Courrier-2.pdf', 'Courrier deux');
  const before = (await rest.attachments()).length;
  const { report, progress } = await attach(app, [first, second]);
  say('rapport de l\'app :', JSON.stringify(report), 'progression :', JSON.stringify(progress));
  check('l\'app reçoit un rapport sans problème : deux joints, aucun échec', report && report.problem === null && sameJson(report.attached, [{ index: 0, replaced: 0 }, { index: 1, replaced: 0 }]) && report.failed.length === 0, report);
  const written = await cells(rest);
  check('les cellules des lignes 1 et 2 citent une pièce jointe, la ligne 3 n\'a pas bougé', Array.isArray(written[0]) && written[0].length === 2 && Array.isArray(written[1]) && written[1].length === 2 && !Array.isArray(written[2]), written);
  const firstId = written[0][1];
  const stored = await rest.attachment(firstId);
  check('les octets que Grist garde sont ceux du PDF de l\'app (même empreinte, type PDF)', stored.hash === first.hash && /pdf/i.test(stored.type), stored);
  check('deux pièces jointes de plus dans le document', (await rest.attachments()).length === before + 2);
  run.firstId = firstId;
}

async function playReplace(run) {
  const { app, rest } = run;
  say('--- 3. le même nom une seconde fois (remplacer) ---');
  const again = item(1, 'Courrier-1.pdf', 'Courrier un revu');
  const { report } = await attach(app, [again]);
  check('l\'app reçoit `replaced` pour ce PDF', report && report.problem === null && sameJson(report.attached, [{ index: 0, replaced: 1 }]), report);
  const written = await cells(rest);
  check('la cellule ne cite que la nouvelle pièce (l\'ancienne reste dans la liste du document)', Array.isArray(written[0]) && written[0].length === 2 && written[0][1] !== run.firstId && (await rest.attachments()).some(entry => entry.id === run.firstId), written[0]);
  check('et la nouvelle pièce porte le nouveau contenu', (await rest.attachment(written[0][1])).hash === again.hash);
}

async function playMissingRow(run) {
  const { app, rest } = run;
  say('--- 4. une ligne qui n\'existe pas ---');
  const { report } = await attach(app, [item(3, 'Courrier-3.pdf', 'Courrier trois'), item(99, 'Fantome.pdf', 'Fantôme')]);
  check('la ligne absente est un échec de raison `row`, l\'autre est jointe', report && report.problem === null && sameJson(report.attached, [{ index: 0, replaced: 0 }]) && sameJson(report.failed, [{ index: 1, reason: 'row' }]), report);
  check('la ligne 3 cite sa pièce jointe', Array.isArray((await cells(rest))[2]));
}

async function playTooLarge(run) {
  const { app, page, rest } = run;
  say('--- 5. un PDF trop gros au milieu de trois ---');
  const before = await cells(rest);
  let posts = 0;
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' && ++posts === 2
    ? route.fulfill({ status: 413, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Payload Too Large"}' })
    : route.continue()));
  const { report } = await attach(app, [item(1, 'Avant.pdf', 'Avant'), item(2, 'Gros.pdf', 'Trop gros'), item(3, 'Apres.pdf', 'Après')]);
  await page.context().unroute(/\/attachments\?auth=/);
  say('rapport de l\'app :', JSON.stringify(report));
  check('lui seul échoue (`tooLarge`), `problem` reste null, le premier et le troisième sont joints', report && report.problem === null && sameJson(report.attached.map(entry => entry.index), [0, 2]) && sameJson(report.failed, [{ index: 1, reason: 'tooLarge' }]), report);
  const after = await cells(rest);
  check('les lignes 1 et 3 gagnent une pièce, la ligne 2 n\'a pas bougé', after[0].length === before[0].length + 1 && after[2].length === before[2].length + 1 && sameJson(after[1], before[1]), { avant: before, apres: after });
}

async function playAllTooLarge(run) {
  const { app, page, rest } = run;
  say('--- 5b. tous les PDF sont trop gros ---');
  const before = await cells(rest);
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 413, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Payload Too Large"}' })
    : route.continue()));
  const { report } = await attach(app, [item(1, 'Gros1.pdf', 'Gros un'), item(2, 'Gros2.pdf', 'Gros deux')]);
  await page.context().unroute(/\/attachments\?auth=/);
  check('l\'app reçoit `tooLarge` pour le lot (aucun joint, deux échecs du même mot : c\'est elle qui en tire `problem`)', report && report.problem === 'tooLarge' && report.attached.length === 0 && sameJson(report.failed, [{ index: 0, reason: 'tooLarge' }, { index: 1, reason: 'tooLarge' }]), report);
  check('rien n\'est écrit', sameJson(await cells(rest), before));
}

async function playDown(run) {
  const { app, page, rest } = run;
  say('--- 6. le réseau tombe ---');
  const before = await cells(rest);
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
  const { report } = await attach(app, [item(1, 'Panne.pdf', 'Panne')]);
  await page.context().unroute(/\/attachments\?auth=/);
  check('`unreachable` pour le lot, aucun joint', report && report.problem === 'unreachable' && report.attached.length === 0 && sameJson(report.failed, [{ index: 0, reason: 'unreachable' }]), report);
  check('rien n\'est écrit', sameJson(await cells(rest), before));
}

// Le choix de la colonne et du mode se garde dans la vue (contrats 5.4, point 12 ; carte du porteur du 07/11, « Dans la vue ») : l'app écrit comme sa liste le fait après le geste de la personne (`writeColumn`, `writeMode`), GFS
// l'écrit dans les réglages de la section, sans la barre « Enregistrer » de Grist ; GFS rechargé, l'app retrouve les deux. (Le clic dans la liste de l'app n'est pas rejoué ici : il appelle ces deux mêmes fonctions.)
const sectionOptions = frame => frame.evaluate(async () => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  // `options.customView` est lui-même un texte JSON (la définition du widget personnalisé) ; ses réglages sont dans `widgetOptions`.
  return data.id.map((id, index) => { try { return JSON.parse(JSON.parse(data.options[index] || '{}').customView || 'null'); } catch (error) { return null; } }).filter(Boolean);
});
async function playKept(run) {
  const { page, frame } = run;
  say('--- 7. la colonne et le mode se gardent dans la vue ---');
  await run.app.evaluate(async column => { await RowAttachment.writeColumnForLab(column); await RowAttachment.writeModeForLab('add'); }, COLUMN);
  await page.waitForTimeout(2500);
  const saved = (await sectionOptions(frame)).map(view => view.widgetOptions).filter(Boolean);
  say('réglages de la section :', JSON.stringify(saved).slice(0, 300));
  check('GFS a écrit les deux réglages dans la section de la vue', saved.some(entry => entry.pp_attach_column === COLUMN && entry.pp_attach_mode === 'add'), saved);
  check('Grist ne montre aucune barre « Enregistrer »', (await page.locator('.test-section-menu-small-btn-save').count()) === 0);
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  if (!appFrame(page)) await rowOf(frame, MODEL).dblclick();
  const back = await waitFor(page, 'Publipostage+ retrouve ses deux réglages', async () => {
    const app = appFrame(page);
    if (!app) return false;
    const got = await app.evaluate(() => (typeof RowAttachment === 'undefined' ? null : [RowAttachment.getColumn(), RowAttachment.getMode()])).catch(() => null);
    return got && got[0] === COLUMN && got[1] === 'add';
  }, 60000);
  check('GFS rechargé, l\'app rouverte retrouve la colonne et le mode', back);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true, patches: PATCHES });
  await openModel(run);
  await playGrey(run);
  if (!WITHOUT_LIFT) {
    await playTwoRows(run);
    await playReplace(run);
    await playMissingRow(run);
    await playTooLarge(run);
    await playAllTooLarge(run);
    await playDown(run);
    await playKept(run);
  }
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console (hors ceux que le labo provoque)', unexpected.filter(text => !/attachments|413|ERR_FAILED|Failed to load resource/i.test(text)).length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
