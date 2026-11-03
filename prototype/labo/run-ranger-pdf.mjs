// Ranger les exports d'une app dans GFS (contrats 2.7 point 6, 5.4 point 9, 6.6), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) : une app (la sonde Z,
// `labo/sondes/z-ranger-pdf/`, qui fait ce que fera Publipostage+ pour ses exports) fabrique des PDF DANS SON CADRE ISOLÉ et demande à GFS de les ranger. Tout ce que la personne fait, elle le
// fait à la vraie souris et au vrai clavier, à 700 × 400 ; ce que le serveur retient (tables, lignes, pièces jointes, rangement) est lu par l'API REST. Chromium seulement.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-ranger-pdf.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   LAB_KIT=1 : la même mesure avec la sonde Z kit (`kit.html`), qui parle à GFS par le VRAI client du kit (`GfsLink.deposit`, le sous-module `prototype/kit`) au lieu d'une enveloppe écrite à la main.
//   0. La sonde Z est installée (fenêtre « Apps ») et ouverte par « Nouveau > Document ».
//   1. La table GFS_Fichiers n'existe pas : GFS demande l'accord ; refusée, rien n'est créé et l'app reçoit GFS_ANNULE ; dans un lot, la question n'est posée qu'une fois.
//   2. Accordée : le PDF est rangé (le File vient d'un cadre isolé : même empreinte), l'app reçoit { statut, id, nom }, GFS ne dit rien par-dessus l'app, la liste de l'explorateur le montre.
//   3. Le dossier que l'app donne : un fichier nouveau y entre (la table du rangement est celle de l'installation de l'app), un fichier remplacé garde sa place.
//   4. Un nom pris : la fenêtre nomme l'app, décrit le fichier existant, tient dans le panneau ; Remplacer, Garder les deux, Annuler, Échap et un clic à côté.
//   5. Un lot : la case « Faire pareil pour les suivants » (souris et clavier), Annuler avec la case, la case absente du dernier fichier, la fenêtre qui revient sans la case.
//   6. Des dépôts lancés ensemble passent l'un après l'autre (une seule fenêtre à la fois).
//   7. Des demandes hors règle et des fichiers qui n'en sont pas : refusés (GFS_REFUSE) sans rien écrire ; un envoi qui échoue : GFS_ECHEC, avec la raison en mots.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { makePdf } from './pdf-fixture.mjs';
import { PAGE_PORT, sha256, openGfs, waitForNames, folders, shot, contrastProblems, windowFits, waitFor, settle, closeModules } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const KIT = process.env.LAB_KIT === '1';
const PROBE = KIT ? 'zk' : 'z';
const ID = `sonde-${PROBE}`;
const APP = `${lang === 'fr' ? 'Sonde' : 'Probe'} Z${KIT ? ' kit' : ''}`;
const PROBE_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/sondes/z-ranger-pdf/`;
const ACCEPTS = { fichier: 'controller.js', de: 'const ACCEPTS_OPEN = Object.freeze({', vers: `const ACCEPTS_OPEN = Object.freeze({ '${ID}': { nouveau: true },` };
const FIVE_SECONDS = 5000;

// Un PDF de l'app : son nom pour GFS, ses octets (base64, pour passer dans le cadre de l'app), l'empreinte qu'on doit retrouver chez Grist. `title` change le contenu, donc l'empreinte.
const pdfItem = (nom, title, pages = 1) => {
  const buffer = makePdf({ pages, title });
  return { nom, b64: buffer.toString('base64'), hash: sha256(buffer), size: buffer.length };
};
const bytesItem = (nom, text) => ({ nom, b64: Buffer.from(text, 'latin1').toString('base64') });

// L'app et ce qu'elle dit (body[data-sonde]) : elle est dans un sous-cadre isolé (sandbox sans allow-same-origin) du site de GFS.
const probeFrame = page => page.frames().find(frame => frame.url().startsWith(PROBE_URL) && !frame.isDetached());
const probeSays = page => { const frame = probeFrame(page); return frame ? frame.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')) : Promise.resolve({}); };
// Une demande de l'app, sans l'attendre : la fenêtre de GFS s'ouvre pendant ce temps et la personne y répond ; la promesse rend la réponse de GFS.
const ask = (page, method, ...args) => probeFrame(page).evaluate(([name, params]) => window.sondeZ[name](...params), [method, args]);
const settled = (promise, ms = FIVE_SECONDS) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve('attente'), ms))]);
const snapshot = async rest => ({ tables: await rest.tables(), rows: (await rest.rows('GFS_Fichiers')).length, attachments: (await rest.attachments()).length });
const rowNamed = async (rest, name) => (await rest.rows('GFS_Fichiers')).find(row => row.Nom === name);
const hashOf = async (rest, name) => { const row = await rowNamed(rest, name); return row ? (await rest.attachment(row.Contenu[1])).hash : null; };

// La fenêtre du nom pris, vue par la personne.
const cf = frame => ({
  open: () => frame.locator('#cf-title').waitFor(),
  gone: () => frame.locator('.mod-scrim').waitFor({ state: 'detached' }),
  again: frame.locator('[data-fk="conflict-again"]'),
  both: frame.locator('[data-fk="conflict-both"]'),
  replace: frame.locator('[data-fk="conflict-replace"]'),
  cancel: frame.locator('[data-fk="conflict-cancel"]'),
  text: () => frame.locator('#cf-text').textContent(),
  note: () => frame.locator('.ask-note').textContent(),
  items: () => frame.locator('.ask-items li').allTextContents(),
  focus: () => frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null),
});
// L'app dit non à la fenêtre déjà ouverte : un appui sur le fond, hors de la fenêtre.
const pressOutside = async (page, frame) => {
  const box = await (await frame.frameElement()).boundingBox();
  await page.mouse.click(box.x + 8, box.y + 8);
};
const toastHidden = frame => frame.locator('#toast').isHidden();

// ----- 0. La sonde Z est installée et ouverte.
async function installProbe(run) {
  const { page, frame } = run;
  say('--- 0. la sonde Z range ses exports : installée et ouverte ---');
  await frame.locator('.tb', { hasText: t('gfs.apps') }).first().click();
  await frame.locator('.mod').waitFor();
  await frame.locator(`[data-fk="app:${ID}"]`).check();
  await settle(page, frame);
  await closeModules(page, frame);
  await frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await frame.getByRole('menuitem', { name: new RegExp(`^Document ${APP}`) }).click();
  await waitFor(page, 'la sonde Z a reçu son contexte', async () => (await probeSays(page)).contexte);
  check('l\'app est ouverte dans son cadre isolé, l\'explorateur est refermé', Boolean(probeFrame(page)) && await frame.locator('.ex').isHidden() && (await probeSays(page)).contexte === true);
  run.items = {
    facture: pdfItem('Facture.pdf', 'Facture un'), facture2: pdfItem('Facture.pdf', 'Facture deux', 2), facture3: pdfItem('Facture.pdf', 'Facture trois'), facture4: pdfItem('Facture.pdf', 'Facture quatre'),
    contrat: pdfItem('Contrat.pdf', 'Contrat un'), contrat2: pdfItem('Contrat.pdf', 'Contrat deux'),
  };
}

// ----- 1. La table refusée.
async function playDeclined(run) {
  const { page, frame, rest } = run;
  say('--- 1. la table GFS_Fichiers refusée ---');
  const before = await snapshot(rest);
  check('le document n\'a pas encore la table des fichiers', !before.tables.includes('GFS_Fichiers'), before.tables);
  const pending = ask(page, 'ranger', run.items.facture);
  await frame.locator('.mod.ask').waitFor();
  const title = await frame.locator('#ask-title').textContent();
  const text = await frame.locator('.mod.ask').textContent();
  check('GFS demande l\'accord avant tout, et dit que les apps y rangent aussi', title === t('files.table.title') && text.includes(t('files.table.text')) && !(await rest.tables()).includes('GFS_Fichiers'), title);
  check('la fenêtre tient dans le panneau et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', await windowFits(frame));
  await shot(frame, 'ranger-1-accord');
  await frame.locator('[data-fk="ask-no"]').click();
  const answer = await settled(pending);
  check('refusée : l\'app reçoit GFS_ANNULE avec la phrase de GFS ; rien n\'est créé ni envoyé', answer.ok === false && answer.code === 'GFS_ANNULE' && answer.message === t('files.declined') && JSON.stringify(await snapshot(rest)) === JSON.stringify(before), answer);
  const batch = ask(page, 'exporter', 'refus', [run.items.facture, run.items.contrat, pdfItem('Devis.pdf', 'Devis un')]);
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-no"]').click();
  const answers = await settled(batch);
  check('dans un lot, la table refusée n\'est pas redemandée : les trois fichiers sont refusés (GFS_ANNULE), sans autre fenêtre', Array.isArray(answers) && answers.length === 3 && answers.every(each => each.code === 'GFS_ANNULE') && (await frame.locator('.mod').count()) === 0, answers);
  check('rien n\'a été créé', !(await rest.tables()).includes('GFS_Fichiers') && (await rest.attachments()).length === 0);
}

// ----- 2. La table accordée : le premier PDF est rangé.
async function playFirst(run) {
  const { page, frame, rest } = run;
  say('--- 2. le premier PDF est rangé ---');
  const pending = ask(page, 'ranger', run.items.facture);
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  const answer = await settled(pending);
  check('l\'app reçoit { statut: « ajoute », id, nom }', answer.ok === true && answer.data.statut === 'ajoute' && /^[0-9a-f]{12}$/.test(answer.data.id) && answer.data.nom === 'Facture.pdf', answer);
  run.firstId = answer.data && answer.data.id;
  const rows = await rest.rows('GFS_Fichiers');
  const [row] = rows;
  check('une ligne : l\'identifiant rendu, le nom, le type, la taille, l\'app dans « Origine », la date du jour', rows.length === 1 && row.Identifiant === run.firstId && row.Nom === 'Facture.pdf' && row.Type === 'pdf' && row.Taille === run.items.facture.size && row.Origine === ID && Math.abs(row.Date - Date.now() / 1000) < 600, row);
  const stored = await rest.attachment(row.Contenu[1]);
  check('le PDF fabriqué dans le cadre isolé de l\'app est celui que Grist garde, octet pour octet (même empreinte)', stored.status === 200 && stored.hash === run.items.facture.hash && stored.type === 'application/pdf', stored);
  check('GFS ne dit rien par-dessus l\'app (aucune phrase), l\'app est toujours là', await toastHidden(frame) && Boolean(probeFrame(page)));
  await openExplorer(run);
  check('la liste de l\'explorateur montre le PDF rangé', JSON.stringify(await waitForNames(frame, ['Facture.pdf'])) === '["Facture.pdf"]');
  await shot(frame, 'ranger-2-liste');
  await closeExplorer(frame);
}
const openExplorer = async run => { await run.frame.locator('#floater-files').click(); await run.frame.locator('.ex').waitFor(); };
const closeExplorer = async frame => { await frame.locator('.ex').getByRole('button', { name: t('ex.close'), exact: true }).click(); await frame.locator('.ex').waitFor({ state: 'hidden' }); };

// ----- 3. Le dossier que l'app donne.
async function playFolder(run) {
  const { page, frame, rest } = run;
  say('--- 3. le dossier ---');
  const pending = ask(page, 'ranger', { ...run.items.contrat, dossier: ' Factures // 2026/ ' });
  const answer = await settled(pending);
  check('le fichier est rangé', answer.ok === true && answer.data.statut === 'ajoute' && answer.data.nom === 'Contrat.pdf', answer);
  const filing = (await rest.rows('GFS_Rangement')).filter(row => row.App === 'gfs-fichiers' && row.Fichier === (answer.data && answer.data.id));
  check('le rangement de la personne le met dans « Factures/2026 » (chemin normalisé), sans favori', filing.length === 1 && filing[0].Dossier === 'Factures/2026' && filing[0].Favori === false, filing);
  await openExplorer(run);
  const names = await waitForNames(frame, ['Facture.pdf']);
  const dirs = await folders(frame);
  check('l\'explorateur montre le dossier « Factures » et garde « Contrat.pdf » dedans (la racine ne garde que « Facture.pdf »)', JSON.stringify(dirs) === '["Factures"]' && JSON.stringify(names) === '["Facture.pdf"]', [dirs, names]);
  await shot(frame, 'ranger-3-dossier');
  await closeExplorer(frame);
}

// ----- 4. Un nom pris : la fenêtre, et toutes ses issues.
async function playTaken(run) {
  const { page, frame, rest } = run;
  say('--- 4. un nom pris ---');
  const win = cf(frame);
  const before = await snapshot(rest);
  const original = await rowNamed(rest, 'Facture.pdf');
  let pending = ask(page, 'ranger', run.items.facture2);
  await win.open();
  check('le titre est celui de la fenêtre commune', (await frame.locator('#cf-title').textContent()) === t('files.conflict.title'));
  check('la phrase nomme l\'app qui range et le fichier pris', (await win.text()) === t('files.conflict.textFrom', { app: APP, name: 'Facture.pdf' }), await win.text());
  check('la fenêtre décrit le fichier existant (sa date)', (await win.note()).length > 0 && /\d/.test(await win.note()), await win.note());
  const items = await win.items();
  check('trois issues dites : Garder les deux (avec le nom de la copie), Remplacer, Annuler', items.length === 3 && items[0].includes(t('files.conflict.both')) && items[0].includes('Facture (1).pdf') && items[1].includes(t('files.conflict.replace')) && items[2].includes(t('files.conflict.skipHint')), items);
  check('un dépôt seul (sans lot) n\'offre pas la case « pour les suivants »', (await win.again.count()) === 0);
  check('le clavier est sur « Garder les deux » (un Entrée distrait n\'écrase rien)', (await win.focus()) === 'conflict-both', await win.focus());
  check('la fenêtre tient dans le panneau de 700 × 400 et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, 'ranger-4-nom-pris');
  check('rien n\'est écrit tant que la personne n\'a pas répondu', JSON.stringify(await snapshot(rest)) === JSON.stringify(before));
  await win.replace.click();
  let answer = await settled(pending);
  const replaced = await rowNamed(rest, 'Facture.pdf');
  check('« Remplacer » : { statut: « remplace » }, même identifiant, même nom, aucune ligne de plus, le contenu du nouveau', answer.ok === true && answer.data.statut === 'remplace' && answer.data.id === original.Identifiant && answer.data.nom === 'Facture.pdf'
    && replaced.Identifiant === original.Identifiant && replaced.id === original.id && (await snapshot(rest)).rows === before.rows && (await hashOf(rest, 'Facture.pdf')) === run.items.facture2.hash, answer);
  check('la ligne remplacée dit toujours son app (« Origine ») et la date a bougé', replaced.Origine === ID && replaced.Date >= original.Date);

  pending = ask(page, 'ranger', run.items.facture3);
  await win.open();
  await win.both.click();
  answer = await settled(pending);
  const copy = await rowNamed(rest, 'Facture (1).pdf');
  check('« Garder les deux » : { statut: « copie », nom: « Facture (1).pdf » }, une ligne de plus, l\'ancien garde son contenu', answer.ok === true && answer.data.statut === 'copie' && answer.data.nom === 'Facture (1).pdf' && Boolean(copy) && answer.data.id === copy.Identifiant
    && (await hashOf(rest, 'Facture (1).pdf')) === run.items.facture3.hash && (await hashOf(rest, 'Facture.pdf')) === run.items.facture2.hash && (await snapshot(rest)).rows === before.rows + 1, answer);

  const rowsNow = await snapshot(rest);
  for (const [how, give] of [['Annuler', () => win.cancel.click()], ['Échap', () => page.keyboard.press('Escape')], ['un appui à côté de la fenêtre', () => pressOutside(page, frame)]]) {
    pending = ask(page, 'ranger', run.items.facture4);
    await win.open();
    await give();
    answer = await settled(pending);
    check(`${how} : { statut: « ignore », id et nom nuls }, rien n'est envoyé ni écrit`, answer.ok === true && answer.data.statut === 'ignore' && answer.data.id === null && answer.data.nom === null && JSON.stringify(await snapshot(rest)) === JSON.stringify(rowsNow), answer);
  }
}

// ----- 5. Un lot : « Faire pareil pour les suivants ».
async function playBatches(run) {
  const { page, frame, rest } = run;
  say('--- 5. un lot ---');
  const win = cf(frame);
  const devis = pdfItem('Devis.pdf', 'Devis un');
  const bilan = pdfItem('Bilan.pdf', 'Bilan un');
  const batchA = [devis, pdfItem('Facture.pdf', 'Lot A facture'), pdfItem('Facture (1).pdf', 'Lot A copie'), pdfItem('Contrat.pdf', 'Lot A contrat'), bilan];
  const before = await snapshot(rest);
  const folderOf = async name => { const row = await rowNamed(rest, name); return ((await rest.rows('GFS_Rangement')).find(each => each.Fichier === row.Identifiant) || {}).Dossier; };
  const contract = await rowNamed(rest, 'Contrat.pdf');
  let pending = ask(page, 'exporter', 'export-A', batchA);
  await win.open();
  const label = await win.again.locator('xpath=..').textContent();
  check('au premier nom pris du lot, la case « Faire pareil pour les suivants » est offerte le clavier reste sur « Garder les deux »', (await win.again.count()) === 1 && label.trim() === t('files.conflict.again') && (await win.focus()) === 'conflict-both', label);
  check('la fenêtre avec la case tient dans le panneau et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, 'ranger-5-lot-case');
  // Au vrai clavier : Tab va à la case, Espace la coche, Tab Tab atteint « Remplacer », Entrée le choisit.
  await page.keyboard.press('Tab');
  check('Tab, depuis « Garder les deux », va à la case', (await win.focus()) === 'conflict-again', await win.focus());
  await page.keyboard.press('Space');
  check('Espace coche la case', await win.again.isChecked());
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  check('Tab, Tab : « Remplacer » a le clavier', (await win.focus()) === 'conflict-replace', await win.focus());
  await page.keyboard.press('Enter');
  const answers = await settled(pending, 15000);
  const statuses = Array.isArray(answers) ? answers.map(each => each.ok && each.data.statut) : answers;
  check('« Remplacer » avec la case : une seule fenêtre pour les trois noms pris, l\'export va jusqu\'au bout', JSON.stringify(statuses) === JSON.stringify(['ajoute', 'remplace', 'remplace', 'remplace', 'ajoute']) && (await frame.locator('.mod').count()) === 0, answers);
  const hashes = await Promise.all(batchA.map(item => hashOf(rest, item.nom)));
  check('les cinq PDF du lot sont chez Grist avec leur contenu (les trois pris ont été remplacés, les deux autres ajoutés)', hashes.every((hash, at) => hash === batchA[at].hash) && (await snapshot(rest)).rows === before.rows + 2, hashes);
  check('« Contrat.pdf », remplacé, garde sa place (même ligne, même dossier)', (await rowNamed(rest, 'Contrat.pdf')).Identifiant === contract.Identifiant && (await folderOf('Contrat.pdf')) === 'Factures/2026');

  // Annuler avec la case : les noms pris suivants sont passés, un fichier sans conflit est rangé.
  const batchB = [pdfItem('Devis.pdf', 'Lot B devis'), pdfItem('Bilan.pdf', 'Lot B bilan'), pdfItem('Nouveau.pdf', 'Lot B nouveau'), pdfItem('Facture.pdf', 'Lot B facture')];
  const betweenRows = await snapshot(rest);
  pending = ask(page, 'exporter', 'export-B', batchB);
  await win.open();
  check('un nouveau lot ne reprend pas la réponse de l\'ancien : la fenêtre revient', (await win.again.count()) === 1 && !(await win.again.isChecked()));
  await win.again.check();
  await win.cancel.click();
  const skipped = await settled(pending, 15000);
  const skippedStatuses = Array.isArray(skipped) ? skipped.map(each => each.ok && each.data.statut) : skipped;
  check('« Annuler » avec la case : les noms pris sont passés (ignore), « Nouveau.pdf » est rangé, une seule fenêtre', JSON.stringify(skippedStatuses) === JSON.stringify(['ignore', 'ignore', 'ajoute', 'ignore']) && (await frame.locator('.mod').count()) === 0, skipped);
  check('seul « Nouveau.pdf » est ajouté ; « Devis.pdf » et « Bilan.pdf » gardent le contenu du lot A', (await snapshot(rest)).rows === betweenRows.rows + 1 && (await hashOf(rest, 'Devis.pdf')) === devis.hash && (await hashOf(rest, 'Bilan.pdf')) === bilan.hash && (await hashOf(rest, 'Nouveau.pdf')) === batchB[2].hash);

  // Sans la case cochée, la fenêtre revient ; le dernier fichier du lot n'offre pas la case.
  const batchC = [pdfItem('Bilan.pdf', 'Lot C bilan'), pdfItem('Facture.pdf', 'Lot C facture')];
  const rowsC = await snapshot(rest);
  pending = ask(page, 'exporter', 'export-C', batchC);
  await win.open();
  check('premier fichier du lot : la case est là', (await win.again.count()) === 1);
  await win.both.click();
  await win.gone();
  await win.open();
  check('sans la case cochée, la fenêtre revient au nom pris suivant ; c\'est le dernier fichier : plus de case', (await win.again.count()) === 0 && (await win.text()) === t('files.conflict.textFrom', { app: APP, name: 'Facture.pdf' }), await win.text());
  await shot(frame, 'ranger-6-dernier');
  await win.replace.click();
  const last = await settled(pending, 15000);
  const lastStatuses = Array.isArray(last) ? last.map(each => each.ok && each.data.statut) : last;
  check('Garder les deux puis Remplacer : [copie, remplace]', JSON.stringify(lastStatuses) === JSON.stringify(['copie', 'remplace']) && last[0].data.nom === 'Bilan (1).pdf', last);
  check('« Bilan (1).pdf » est la copie, « Facture.pdf » a le contenu du lot C, « Bilan.pdf » n\'a pas bougé', (await snapshot(rest)).rows === rowsC.rows + 1 && (await hashOf(rest, 'Bilan (1).pdf')) === batchC[0].hash && (await hashOf(rest, 'Facture.pdf')) === batchC[1].hash && (await hashOf(rest, 'Bilan.pdf')) === bilan.hash);
}

// ----- 6. Des dépôts lancés ensemble.
async function playTogether(run) {
  const { page, frame, rest } = run;
  say('--- 6. des dépôts lancés ensemble ---');
  const win = cf(frame);
  const before = await snapshot(rest);
  const first = pdfItem('Rapport.pdf', 'Rapport un');
  const second = pdfItem('Rapport.pdf', 'Rapport deux');
  const pending = ask(page, 'ensemble', [first, second]);
  await win.open();
  check('le second dépôt du même nom attend le premier, puis demande : une seule fenêtre', (await frame.locator('.mod-scrim').count()) === 1 && (await win.text()) === t('files.conflict.textFrom', { app: APP, name: 'Rapport.pdf' }), await win.text());
  await win.both.click();
  const answers = await settled(pending, 15000);
  check('[ajoute, copie « Rapport (1).pdf »] dans l\'ordre des demandes', Array.isArray(answers) && answers[0].data.statut === 'ajoute' && answers[1].data.statut === 'copie' && answers[1].data.nom === 'Rapport (1).pdf', answers);
  check('les deux PDF sont chez Grist avec leur contenu', (await snapshot(rest)).rows === before.rows + 2 && (await hashOf(rest, 'Rapport.pdf')) === first.hash && (await hashOf(rest, 'Rapport (1).pdf')) === second.hash);
}

// ----- 7. Les refus et les échecs.
async function playRefusals(run) {
  const { page, frame, rest } = run;
  say('--- 7. des demandes refusées ---');
  const before = await snapshot(rest);
  const good = pdfItem('Ok.pdf', 'Ok');
  const cases = [
    ['un fichier dont le contenu n\'est pas celui d\'un PDF', bytesItem('Faux.pdf', 'PK\u0003\u0004 un classeur renomme'), 'GFS_REFUSE', t('files.notPdf', { name: 'Faux.pdf' })],
    ['un fichier vide', bytesItem('Vide.pdf', ''), 'GFS_REFUSE', t('files.empty', { name: 'Vide.pdf' })],
    ['un type que l\'app n\'a pas déclaré', { ...good, type: 'image' }, 'GFS_REFUSE', /image/],
    ['un « fichier » qui n\'est qu\'un texte', { brut: { fichier: '%PDF-1.4 un texte', nom: 'Texte.pdf' } }, 'GFS_REFUSE', /File ou un Blob/],
    ['une demande sans fichier', { brut: { nom: 'Rien.pdf' } }, 'GFS_REFUSE', /File ou un Blob/],
    ['un nom vide (« .pdf »)', { ...good, nom: '.pdf' }, 'GFS_REFUSE', /nom/],
    ['un lot sans nom', { ...good, lot: '   ' }, 'GFS_REFUSE', /lot/],
  ];
  for (const [what, item, code, message] of cases) {
    const answer = await settled(ask(page, 'ranger', item));
    const said = typeof message === 'string' ? answer.message === message : message.test(answer.message);
    check(`${what} : ${code}, avec la raison`, answer.ok === false && answer.code === code && said, answer);
  }
  check('rien n\'a été écrit ni envoyé, aucune fenêtre ne s\'est ouverte', JSON.stringify(await snapshot(rest)) === JSON.stringify(before) && (await frame.locator('.mod').count()) === 0);
}

async function playFailures(run) {
  const { page, frame, rest } = run;
  say('--- 8. l\'envoi échoue ---');
  run.allow.push(/le fichier n’a pas pu être traité/);
  const before = await snapshot(rest);
  const answer = (status, body) => route => (route.request().method() === 'POST' ? route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }) : route.continue());
  await page.context().route(/\/attachments\?auth=/, answer(413, '{"error":"Payload Too Large"}'));
  const tooBig = await settled(ask(page, 'ranger', pdfItem('Gros.pdf', 'Gros')));
  await page.context().unroute(/\/attachments\?auth=/);
  check('le serveur refuse (413) : GFS_ECHEC, la raison est dite en mots', tooBig.ok === false && tooBig.code === 'GFS_ECHEC' && tooBig.message === t('files.failed', { name: 'Gros.pdf', reason: t('files.err.tooBig') }), tooBig);
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
  const down = await settled(ask(page, 'ranger', pdfItem('Panne.pdf', 'Panne')));
  await page.context().unroute(/\/attachments\?auth=/);
  check('le réseau tombe : GFS_ECHEC, avec la raison en mots', down.ok === false && down.code === 'GFS_ECHEC' && down.message === t('files.failed', { name: 'Panne.pdf', reason: t('files.err.network') }), down);
  check('aucune ligne n\'est ajoutée, aucune pièce jointe, aucune fenêtre ; GFS ne dit rien', JSON.stringify(await snapshot(rest)) === JSON.stringify(before) && (await frame.locator('.mod').count()) === 0 && await toastHidden(frame));
  const again = await settled(ask(page, 'ranger', pdfItem('Reprise.pdf', 'Reprise')));
  check('la panne passée, le dépôt suivant réussit (la file n\'est pas bloquée)', again.ok === true && again.data.statut === 'ajoute', again);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, probes: [PROBE], patches: [ACCEPTS] });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await installProbe(run);
  await playDeclined(run);
  await playFirst(run);
  await playFolder(run);
  await playTaken(run);
  await playBatches(run);
  await playTogether(run);
  await playRefusals(run);
  await playFailures(run);
  const said = await probeSays(run.page);
  check('l\'app a reçu une réponse à chacun de ses appels', said.resultats.length >= 30, said.resultats.length);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, la sonde), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
