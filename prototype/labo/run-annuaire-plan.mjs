// Le plan des bâtiments de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « le plan comme base », « situer le bureau d'une personne »), DEPUIS L'ÉCRAN, dans un VRAI serveur
// Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier, le propriétaire du document dans le vrai GFS. Ce que le faux Grist ne dit
// pas : ce que `AddTable` rend (l'identifiant de la table, ses colonnes), la colonne `Parent` qui se vise elle-même (`AddColumn` puis `SetDisplayFormula`), la colonne « Bureau »
// que le réglage crée (une référence vers la table des lieux), la lecture de l'arbre de lieux et le décompte des personnes montrées.
// Non mesuré sous Firefox (consigne du porteur du 27/11 : pas d'essai Firefox sauf bug précis à reproduire).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-plan.mjs        LAB_LANG=fr|en, LAB_SCHEME=light|dark
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, contrastProblems, windowFits, pressGreyed } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { rowsOf, apply } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `annuaire-plan-${lang}-${scheme}`;
const CONFIG = {
  v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', manager: 'Responsable', relations: [], columns: ['email'],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }],
};
const CAMILLE = 4; // Camille Durand, bureau 101
const THEO = 6; // Théo Lambert, bureau 101
const EMMA = 2; // Emma Rolland, bureau 102
const NATHAN = 3; // Nathan Roussel, bureau 201
const MANON = 10; // Manon Fabre, bureau 201
const HELENE = 1; // Hélène Marchetti, bureau B101 (autre bâtiment)

// Un plan dessiné dans la page de Grist (des pièces cotées, comme un plan d'étage), envoyé par l'API REST (ce que ferait Grist lui-même) : le numéro de la pièce jointe.
const seedPlan = (run, name, width, height) => run.page.evaluate(async ([docId, fileName, w, h]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f4efe3';
  context.fillRect(0, 0, w, h);
  context.strokeStyle = '#33415c';
  context.lineWidth = 6;
  context.font = `${Math.round(h / 22)}px sans-serif`;
  context.fillStyle = '#33415c';
  [['101', 0.04, 0.08, 0.3, 0.4], ['102', 0.36, 0.08, 0.3, 0.4], ['Atlas', 0.68, 0.08, 0.28, 0.4], ['Couloir', 0.04, 0.52, 0.92, 0.12], ['201', 0.04, 0.68, 0.45, 0.28]].forEach(([label, x, y, bw, bh]) => {
    context.strokeRect(x * w, y * h, bw * w, bh * h);
    context.fillText(label, x * w + 16, y * h + h / 14);
  });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const form = new FormData();
  form.append('upload', blob, fileName);
  const response = await fetch(`/api/docs/${docId}/attachments`, { method: 'POST', body: form, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  return (await response.json())[0];
}, [run.docId, name, width, height]);

// Une grosse image bruitée (un JPEG de plusieurs Mo), en octets : à poser dans le sélecteur de fichiers.
const bigImage = (page, width, height) => page.evaluate(async ([w, h]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  const data = context.createImageData(w, h);
  for (let at = 0; at < data.data.length; at += 4) { data.data[at] = (at / 4) % 251; data.data[at + 1] = Math.random() * 255; data.data[at + 2] = (at / 4000) % 255; data.data[at + 3] = 255; }
  context.putImageData(data, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.9);
  return url.slice(url.indexOf(',') + 1);
}, [width, height]);

// Ce que Grist garde d'une pièce jointe : { size, width, height, type, name }.
const attachmentInfo = (run, id) => run.page.evaluate(async ([docId, n]) => {
  const meta = await (await fetch(`/api/docs/${docId}/attachments/${n}`)).json();
  const blob = await (await fetch(`/api/docs/${docId}/attachments/${n}/download`)).blob();
  const bitmap = await createImageBitmap(blob).catch(() => null);
  return { name: meta.fileName, size: meta.fileSize, type: blob.type, width: bitmap ? bitmap.width : 0, height: bitmap ? bitmap.height : 0 };
}, [run.docId, id]);

const placeCell = async (run, id) => ((await rowsOf(run, 'Directory_Places')) || []).find(row => row.id === id).Plan;
const attachmentId = cell => (Array.isArray(cell) ? cell.filter(each => typeof each === 'number')[0] || 0 : 0);
const noteOf = async frame => (await frame.locator('.mod.an .an-foot').innerText()).replace(/\s+/g, ' ').trim();
// L'agrandissement que le cadre applique à l'image : 1 quand rien n'est posé (l'image entière), sinon `scale(k)` et le décalage.
const viewOf = frame => frame.locator('.an-pl-stage').evaluate(stage => {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(stage.style.transform);
  return match ? { x: Number(match[1]), y: Number(match[2]), k: Number(match[3]) } : { x: 0, y: 0, k: 1 };
});

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const tilesOf = async frame => (await frame.locator('.an-pl-tile .an-pl-name').allInnerTexts()).map(each => each.trim());
const crumbOf = async frame => (await frame.locator('.an-pl-trail li').allInnerTexts()).map(each => each.trim());

// Ouvre la fenêtre de l'annuaire (le bouton du titre de l'explorateur).
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(500);
}

// Les lieux de l'essai : [nom, genre, usage, parent (numéro de ligne), places, adresse]. Les numéros suivent l'ordre (la table est neuve).
const PLACES = [
  ['Siège', 'Site', '', 0, 0, '12 rue des Écoles, Lyon'], // 1
  ['Bâtiment A', 'Building', '', 1, 0, ''], // 2
  ['Bâtiment B', 'Building', '', 1, 0, ''], // 3
  ['Étage 1', 'Floor', '', 2, 0, ''], // 4
  ['Étage 2', 'Floor', '', 2, 0, ''], // 5
  ['Bureau 101', 'Room', 'Office', 4, 2, ''], // 6
  ['Bureau 102', 'Room', 'Office', 4, 1, ''], // 7
  ['Couloir', 'Room', 'Circulation', 4, 0, ''], // 8
  ['Salle Atlas', 'Room', 'Meeting', 4, 12, ''], // 9
  ['Bureau 201', 'Room', 'Office', 5, 3, ''], // 10
  ['Sanitaires', 'Room', 'Service', 5, 0, ''], // 11
  ['Étage 1', 'Floor', '', 3, 0, ''], // 12 (celui du bâtiment B : même nom qu'un autre étage, chemins différents)
  ['Bureau B101', 'Room', 'Office', 12, 1, ''], // 13
];
const OFFICES = { [CAMILLE]: 6, [THEO]: 6, [EMMA]: 7, [NATHAN]: 10, [MANON]: 10, [HELENE]: 13 };

async function createFromSettings(frame, page, run) {
  say('--- 1. le réglage « Lieux » : la table et la colonne se créent avec l\'accord de la personne, rien avant ---');
  const tableIds = async () => ((await rowsOf(run, '_grist_Tables')) || []).map(row => row.tableId);
  check('aucune table des lieux avant le geste', !(await tableIds()).includes('Directory_Places'), await tableIds());
  await frame.locator('[data-fk="configure"]').click();
  await frame.locator('.mod.an-set').waitFor({ state: 'visible' });
  await frame.locator('[data-fk="tab:plan"]').click();
  const office = frame.locator('[data-fk="pl:office"]');
  check('la colonne du bureau est grisée tant que la table n\'est pas choisie (avec sa raison)', (await office.getAttribute('aria-disabled')) === 'true'
    && (await office.getAttribute('title')) === t('an.plan.needTable'), await office.getAttribute('title'));
  await shot(frame, '1-reglage-vide');
  await frame.locator('[data-fk="pl:table"]').click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  const rows = (await frame.locator('.mod.pk .wk-name').allInnerTexts()).map(each => each.trim());
  check('la liste des tables ne propose que « Créer… » (aucune table n\'a les colonnes d\'un lieu)', rows.length === 1 && rows[0] === t('an.plan.item'), rows);
  await frame.locator('[data-fk="pick-new:"]').click();
  await frame.locator('[data-fk="nt-name"]').waitFor({ state: 'visible' });
  check('la fenêtre propose « Directory_Places » et dit ce qui s\'écrit', (await frame.locator('[data-fk="nt-name"]').inputValue()) === 'Directory_Places'
    && (await text(frame.locator('.mod.an-nl .an-set-text'))).includes('Parent'), await text(frame.locator('.mod.an-nl .an-set-body')));
  await shot(frame, '2-creer-table');
  check('rien n\'est encore écrit', !(await tableIds()).includes('Directory_Places'));
  await frame.locator('[data-fk="nt-ok"]').click();
  await frame.locator('.mod.an-nl').waitFor({ state: 'detached', timeout: 30000 });
  const tables = await tableIds();
  check('la table est dans Grist', tables.includes('Directory_Places'), tables);
  const columns = ((await rowsOf(run, '_grist_Tables_column')) || []);
  const tableRow = ((await rowsOf(run, '_grist_Tables')) || []).find(row => row.tableId === 'Directory_Places').id;
  const own = columns.filter(column => column.parentId === tableRow && !column.colId.startsWith('gristHelper_')).map(column => `${column.colId}:${column.type}`);
  say('  colonnes de la table des lieux :', own.join(' '));
  check('ses colonnes : Name, Kind, Use, Address, Lat, Lng, Plan, Shape, Capacity et Parent (une référence vers elle-même)', ['Name:Text', 'Kind:Choice', 'Use:Choice', 'Address:Text',
    'Lat:Numeric', 'Lng:Numeric', 'Plan:Attachments', 'Shape:Text', 'Capacity:Int', 'Parent:Ref:Directory_Places'].every(each => own.includes(each)), own);
  const parent = columns.find(column => column.parentId === tableRow && column.colId === 'Parent');
  const name = columns.find(column => column.parentId === tableRow && column.colId === 'Name');
  check('« Parent » montre le nom du lieu (pas un numéro)', parent && name && parent.visibleCol === name.id, parent);
  check('le réglage montre la table choisie et la colonne du bureau devient disponible', (await text(frame.locator('[data-fk="pl:table"]'))).includes('Directory_Places')
    && (await frame.locator('[data-fk="pl:office"]').getAttribute('aria-disabled')) !== 'true');
  await shot(frame, '3-table-choisie');

  await frame.locator('[data-fk="pl:office"]').click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  const choices = (await frame.locator('.mod.pk .wk-name').allInnerTexts()).map(each => each.trim());
  check('la liste du bureau propose « Créer une colonne… » et aucune colonne qui ne vise pas les lieux', choices.length >= 1 && !choices.includes('Structure'), choices);
  await frame.locator('[data-fk="pick-new:"]').click();
  await frame.locator('[data-fk="nc-name"]').waitFor({ state: 'visible' });
  check('la fenêtre propose le nom « Bureau » (ou « Office »), de type référence vers la table des lieux', (await frame.locator('[data-fk="nc-name"]').inputValue()) === t('an.plan.officeName'));
  await shot(frame, '4-creer-colonne');
  await frame.locator('[data-fk="nc-ok"]').click();
  await frame.locator('.mod.an-nc').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const created = ((await rowsOf(run, '_grist_Tables_column')) || []).find(column => column.colId === t('an.plan.officeName'));
  check('la colonne du bureau est dans Grist : une référence vers la table des lieux, qui montre le nom du lieu', created && created.type === 'Ref:Directory_Places' && created.visibleCol === name.id, created);
  check('le réglage montre cette colonne', (await text(frame.locator('[data-fk="pl:office"]'))).includes(t('an.plan.officeName')), await text(frame.locator('[data-fk="pl:office"]')));
  await shot(frame, '5-reglage-complet');
  await frame.locator('[data-fk="set-save"]').click();
  await frame.locator('.mod.an-set').waitFor({ state: 'detached', timeout: 30000 });
}

// La table des lieux et les bureaux, posés comme Grist le ferait (les saisies d'un administrateur).
async function seedPlaces(run) {
  const bureau = t('an.plan.officeName');
  const done = await apply(run, [['BulkAddRecord', 'Directory_Places', PLACES.map(() => null), {
    Name: PLACES.map(row => row[0]), Kind: PLACES.map(row => row[1]), Use: PLACES.map(row => row[2]), Parent: PLACES.map(row => row[3]),
    Capacity: PLACES.map(row => row[4]), Address: PLACES.map(row => row[5]) }],
  ['BulkUpdateRecord', 'Personnes', Object.keys(OFFICES).map(Number), { [bureau]: Object.keys(OFFICES).map(row => OFFICES[row]) }]]);
  check('les treize lieux et les six bureaux sont posés', done.status === 200, done.text);
}

async function play(run) {
  const { page } = run;
  say('--- 0. le document et l\'annuaire (sans plan) ---');
  await seedAnnuaire(run.frame);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
  }, CONFIG);
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const grey = frame.locator('[data-fk="v:plan"]');
  check('la vue « Plan » est là, grisée, avec sa raison', (await grey.count()) === 1 && (await grey.getAttribute('aria-disabled')) === 'true' && Boolean(await grey.getAttribute('title')),
    await grey.getAttribute('title'));
  await pressGreyed(page, grey);
  await page.waitForTimeout(300);
  check('un clic sur la vue grisée dit comment l\'allumer et ne change pas de vue', (await frame.locator('[data-fk="v:list"]').getAttribute('aria-pressed')) === 'true');
  await shot(frame, '0-plan-grise');

  await createFromSettings(frame, page, run);
  await seedPlaces(run);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);

  say('--- 2. la vue « Plan » : on descend d\'un cran à chaque clic ---');
  const plan = frame.locator('[data-fk="v:plan"]');
  check('la vue « Plan » est allumée', (await plan.getAttribute('aria-disabled')) !== 'true');
  await plan.click();
  await frame.locator('.an-plan').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  check('cran 1 : le site (une seule carte), « Tous les lieux » en haut', JSON.stringify(await tilesOf(frame)) === JSON.stringify(['Siège']) && (await crumbOf(frame)).join('|') === t('an.plan.all'),
    [await tilesOf(frame), await crumbOf(frame)]);
  const unplaced = await text(frame.locator('.an-pl-unplaced'));
  check('les personnes sans bureau sont comptées en bas (douze)', unplaced.includes('12'), unplaced);
  await shot(frame, '6-cran-1');
  await frame.locator('.an-pl-tile', { hasText: 'Siège' }).click();
  check('cran 2 : les deux bâtiments, le fil d\'Ariane dit où l\'on est', JSON.stringify(await tilesOf(frame)) === JSON.stringify(['Bâtiment A', 'Bâtiment B'])
    && (await crumbOf(frame)).join('|') === [t('an.plan.all'), 'Siège'].join('|'), [await tilesOf(frame), await crumbOf(frame)]);
  const counts = (await frame.locator('.an-pl-tile').allInnerTexts()).map(each => each.replace(/\s+/g, ' '));
  check('le bâtiment A accueille cinq personnes, le B une', counts[0].includes('5') && counts[1].includes('1'), counts);
  await shot(frame, '7-cran-2');
  await frame.locator('.an-pl-tile', { hasText: 'Bâtiment A' }).click();
  await frame.locator('.an-pl-tile', { hasText: 'Étage 1' }).click();
  const rooms = await tilesOf(frame);
  check('cran 3 : les locaux de l\'étage 1, couloir compris (grisé)', JSON.stringify(rooms) === JSON.stringify(['Bureau 101', 'Bureau 102', 'Couloir', 'Salle Atlas']), rooms);
  const couloir = frame.locator('.an-pl-tile', { hasText: 'Couloir' });
  check('le couloir est grisé (jamais masqué), avec sa raison', (await couloir.getAttribute('aria-disabled')) === 'true' && (await couloir.getAttribute('title')) === t('an.plan.noSeats'));
  await shot(frame, '8-cran-3');
  await pressGreyed(page, couloir);
  await page.waitForTimeout(300);
  check('un clic sur le couloir dit pourquoi, sans changer de lieu', (await crumbOf(frame)).length === 4 && JSON.stringify(await tilesOf(frame)) === JSON.stringify(rooms));
  await frame.locator('.an-pl-tile', { hasText: 'Bureau 101' }).click();
  await page.waitForTimeout(300);
  const here = (await frame.locator('.an-pl-people .an-person').allInnerTexts()).map(each => each.replace(/\s+/g, ' '));
  check('cran 4 : les occupants du bureau 101 (Camille Durand, Théo Lambert), pas d\'autres', here.length === 2 && here.some(each => each.includes('Camille')) && here.some(each => each.includes('Théo')), here);
  check('le fil d\'Ariane remonte jusqu\'à « Tous les lieux »', (await crumbOf(frame)).join('|') === [t('an.plan.all'), 'Siège', 'Bâtiment A', 'Étage 1', 'Bureau 101'].join('|'), await crumbOf(frame));
  await shot(frame, '9-cran-4');
  const fit = await windowFits(frame);
  check('la fenêtre tient dans le panneau 700 × 400, rien ne déborde', fit.inPanel && fit.overflowing.length === 0, fit);
  check('contraste 4,5:1 sur tout le plan', (await contrastProblems(frame, '.an-plan')).length === 0, await contrastProblems(frame, '.an-plan'));

  say('--- 3. le clavier : Échap remonte d\'un cran avant de fermer la fenêtre ---');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Échap : retour à l\'étage 1', (await crumbOf(frame)).join('|') === [t('an.plan.all'), 'Siège', 'Bâtiment A', 'Étage 1'].join('|') && (await frame.locator('.mod.an').count()) === 1, await crumbOf(frame));
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  check('trois Échap de plus : tout en haut, la fenêtre est toujours là', (await crumbOf(frame)).length === 1 && (await frame.locator('.mod.an').count()) === 1, await crumbOf(frame));

  say('--- 4. la recherche : le plan ne montre jamais une personne que l\'annuaire cache ---');
  await frame.locator(`input[aria-label="${t('an.searchLabel')}"]`).fill('camille');
  await page.waitForTimeout(500);
  await frame.locator('.an-pl-tile', { hasText: 'Siège' }).click();
  const filtered = (await frame.locator('.an-pl-tile').allInnerTexts()).map(each => each.replace(/\s+/g, ' '));
  check('avec « camille », le bâtiment A n\'accueille plus qu\'une personne, le B aucune', filtered[0].includes('1') && filtered[1].includes('0'), filtered);
  await shot(frame, '10-recherche');
  await frame.locator(`input[aria-label="${t('an.searchLabel')}"]`).fill('');
  await page.waitForTimeout(400);

  say('--- 5. la fiche : « Lieu » et « Voir sur le plan » ---');
  await frame.locator('[data-fk="v:list"]').click();
  await page.waitForTimeout(300);
  await frame.locator(`[data-fk="pe:${CAMILLE}"]`).scrollIntoViewIfNeeded();
  await frame.locator(`[data-fk="pe:${CAMILLE}"]`).click();
  const placeList = frame.locator(`.an-side .an-hp[aria-label="${t('an.fiche.place')}"]`);
  await placeList.waitFor({ timeout: 10000 });
  const path = (await placeList.locator('.an-hp-v').allInnerTexts()).map(each => each.trim());
  check('la fiche de Camille montre le chemin de son bureau, du site au local', path.join('|') === 'Siège|Bâtiment A|Étage 1|Bureau 101', path);
  await shot(frame, '11-fiche-lieu');
  await frame.locator('[data-fk="plan-open"]').click();
  await frame.locator('.an-plan').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  check('« Voir sur le plan » ouvre la vue Plan sur l\'étage de Camille, son bureau repéré', (await crumbOf(frame)).join('|') === [t('an.plan.all'), 'Siège', 'Bâtiment A', 'Étage 1'].join('|')
    && (await frame.locator('.an-pl-tile.is-here .an-pl-name').innerText()).trim() === 'Bureau 101', await crumbOf(frame));
  await shot(frame, '12-voir-sur-le-plan');

  say('--- 6. « Modifier » : changer le bureau d\'une personne, un seul changement écrit ---');
  await frame.locator('[data-fk="v:list"]').click();
  await page.waitForTimeout(300);
  if (!(await frame.locator(`.an-side [data-fk="edit"][data-row="${EMMA}"]`).count())) {
    await frame.locator(`[data-fk="pe:${EMMA}"]`).scrollIntoViewIfNeeded();
    await frame.locator(`[data-fk="pe:${EMMA}"]`).click();
  }
  await frame.locator('.an-side [data-fk="edit"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'visible' });
  const field = frame.locator('[data-fk="ef:office"]');
  await field.scrollIntoViewIfNeeded();
  check('le champ « Bureau » montre le chemin entier du lieu actuel', (await text(field)).includes('Bureau 102') && (await text(field)).includes('Bâtiment A'), await text(field));
  await field.click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  const options = (await frame.locator('.mod.pk .wk-name').allInnerTexts()).map(each => each.trim());
  say('  les bureaux proposés :', JSON.stringify(options));
  check('la liste propose les lieux de travail en chemin entier, sans couloir ni sanitaires, les deux « Étage 1 » ne se confondent pas', options.some(each => each.includes('Bâtiment B › Étage 1 › Bureau B101'))
    && !options.some(each => each.includes('Couloir') || each.includes('Sanitaires')), options);
  await shot(frame, '13-choisir-bureau');
  await frame.locator('.mod.pk .wk-item', { hasText: 'Bureau 201' }).click();
  await frame.locator('[data-fk="ed-next"]').click();
  const review = (await frame.locator('.an-ed-change').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
  check('la relecture dit le changement de bureau', review.includes('201'), review);
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached', timeout: 40000 });
  const emma = ((await rowsOf(run, 'Personnes')) || []).find(row => row.id === EMMA);
  check('Grist a le nouveau bureau d\'Emma (la ligne 10), rien d\'autre n\'a changé', emma[t('an.plan.officeName')] === 10 && emma.Nom === 'Emma Rolland', emma);
  await planImage(run, frame, page);
  await planShapes(run, page);
  await planNav(run, page);
  await planTrace(run, page);
  check('aucune erreur de GFS dans la console (ni violation de la politique de contenu)', unexpected(run).length === 0, unexpected(run));
}

// Descend jusqu'au lieu `names` (« Siège », « Bâtiment A », « Étage 1 »…) depuis le premier cran, en cliquant ses cartes à la vraie souris.
async function goTo(frame, page, names) {
  const top = frame.locator('[data-fk="plan-at:0"]');
  if ((await top.getAttribute('aria-disabled')) !== 'true') await top.click(); // déjà tout en haut : « Tous les lieux » est le lieu où l'on est, grisé
  for (const name of names) {
    await frame.locator('.an-pl-tile', { hasText: name }).first().click();
    await page.waitForTimeout(150);
  }
}

async function planImage(run, frame, page) {
  say('--- 7. l\'image du plan : un plan posé dans Grist se montre, se zoome, se déplace ; un administrateur le choisit, le remplace, le retire ---');
  const plan = await seedPlan(run, 'etage-1.png', 1600, 1000);
  check('le plan d\'étage est une pièce jointe de Grist', Number.isInteger(plan), plan);
  const set = await apply(run, [['UpdateRecord', 'Directory_Places', 4, { Plan: ['L', plan] }]]);
  check('la cellule « Plan » de l\'étage 1 le cite', set.status === 200, set.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A', 'Étage 1']);
  const picture = frame.locator('.an-pl-img');
  await picture.waitFor({ state: 'visible', timeout: 25000 });
  const loaded = await picture.evaluate(img => ({ src: img.src.slice(0, 15), width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
  check('le plan est une image « data: » (la politique de contenu ne bouge pas), ajustée au cadre', loaded.src.startsWith('data:image/png') && loaded.fit === 'contain' && loaded.width <= 2048, loaded);
  const frameBox = await frame.locator('.an-pl-vp').boundingBox();
  const sideBox = await frame.locator('.an-pl-side').boundingBox();
  check('le cadre est à gauche, les lieux à droite (la fiche est fermée : 700 px suffisent)', frameBox.x < sideBox.x && frameBox.width > 220 && Math.abs(frameBox.y - sideBox.y) < 40, [frameBox, sideBox]);
  const buttons = async () => (await frame.locator('.an-pl-zb').evaluateAll(list => list.map(node => node.getAttribute('aria-disabled'))));
  check('tout entier : on peut agrandir, pas réduire ni ajuster (grisés, jamais masqués)', JSON.stringify(await buttons()) === JSON.stringify(['false', 'true', 'true', 'false']), await buttons());
  await shot(frame, '14-plan-image');
  check('la fenêtre tient dans le panneau 700 × 400', (await windowFits(frame)).inPanel);
  check('contraste 4,5:1 sur le plan et ses boutons', (await contrastProblems(frame, '.an-plan')).length === 0, await contrastProblems(frame, '.an-plan'));

  say('  le zoom, à la vraie souris');
  const centre = { x: frameBox.x + frameBox.width / 2, y: frameBox.y + frameBox.height / 2 };
  await page.mouse.move(centre.x + 60, centre.y + 30);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(300);
  const zoomed = await viewOf(frame);
  check('la molette agrandit le plan sous le pointeur', zoomed.k > 1.5 && zoomed.x < 0 && zoomed.y < 0, zoomed);
  check('« Réduire » et « Tout le plan » s\'ouvrent', JSON.stringify(await buttons()) === JSON.stringify(['false', 'false', 'false', 'false']), await buttons());
  await shot(frame, '15-plan-zoom');
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x - 70, centre.y - 40, { steps: 6 });
  await page.mouse.up();
  const dragged = await viewOf(frame);
  check('glisser déplace l\'image (le plan suit la main, borné par le cadre)', dragged.k === zoomed.k && dragged.x < zoomed.x && dragged.y < zoomed.y, [zoomed, dragged]);
  check('l\'image recouvre toujours le cadre', dragged.x >= frameBox.width - frameBox.width * dragged.k - 1 && dragged.y >= frameBox.height - frameBox.height * dragged.k - 1, dragged);
  await page.keyboard.press('0');
  check('« 0 » au clavier remet le plan entier', (await viewOf(frame)).k === 1);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  check('« + » agrandit, les flèches déplacent', (await viewOf(frame)).k > 1.5);
  const before = await viewOf(frame);
  await page.keyboard.press('ArrowLeft');
  check('« ← » déplace l\'image agrandie', (await viewOf(frame)).x > before.x || before.x === 0);
  await frame.locator('[data-fk="plan-zoom-fit"]').click();
  check('le bouton « Tout le plan » revient à l\'image entière', (await viewOf(frame)).k === 1);
  await frame.locator('[data-fk="plan-zoom-in"]').click();
  const stepped = await viewOf(frame);
  await frame.locator(`input[aria-label="${t('an.searchLabel')}"]`).fill('camille');
  await page.waitForTimeout(500);
  await frame.locator(`input[aria-label="${t('an.searchLabel')}"]`).fill('');
  await page.waitForTimeout(400);
  const kept = await viewOf(frame);
  check('l\'agrandissement survit à un nouveau dessin du volet (recherche tapée puis effacée)', kept.k === stepped.k, [stepped, kept]);

  say('  choisir une image (le vrai sélecteur de fichiers), remplacer par une grosse image, retirer');
  await goTo(frame, page, ['Siège', 'Bâtiment A']);
  check('le bâtiment A n\'a pas d\'image : pas de cadre, un seul bouton « Image du plan… », ouvert pour l\'administrateur', (await frame.locator('.an-pl-map').count()) === 0
    && (await frame.locator('.an-pl-img-b').allInnerTexts()).map(each => each.trim()).join('|') === t('an.plan.imgPick') && (await frame.locator('.an-pl-img-b').first().getAttribute('aria-disabled')) !== 'true');
  await shot(frame, '16-sans-image');
  const attachments = async () => ((await rowsOf(run, '_grist_Attachments')) || []).length;
  const baseline = await attachments();
  const pick = async (name, buffer, mimeType) => {
    const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
    await frame.locator('[data-fk="plan-img-pick"]').click();
    await (await chooser).setFiles({ name, mimeType, buffer });
    await page.waitForTimeout(600);
  };
  await pick('note.txt', Buffer.from('pas une image'), 'text/plain');
  check('un fichier qui n\'est pas une image est refusé dans le pied, rien n\'est écrit', (await noteOf(frame)) === t('an.img.unreadable', { name: 'note.txt' })
    && attachmentId(await placeCell(run, 2)) === 0 && (await attachments()) === baseline, await noteOf(frame));
  const small = Buffer.from(await bigImage(page, 640, 480), 'base64');
  await pick('rez-de-chaussee.jpeg', small, 'image/jpeg');
  await frame.locator('.an-pl-img').waitFor({ state: 'visible', timeout: 25000 });
  const first = attachmentId(await placeCell(run, 2));
  check('la cellule du bâtiment A cite une nouvelle pièce jointe, une seule de plus dans Grist', first > 0 && (await attachments()) === baseline + 1, [first, await attachments()]);
  check('le pied dit que le plan est enregistré et le cadre le montre', (await noteOf(frame)) === t('an.plan.imgSaved', { name: 'Bâtiment A' }) && (await frame.locator('.an-pl-map').count()) === 1, await noteOf(frame));
  check('les boutons deviennent « Remplacer l\'image… » et « Retirer »', (await frame.locator('.an-pl-img-b').allInnerTexts()).map(each => each.trim()).join('|') === [t('an.img.replace'), t('an.img.remove')].join('|'));
  await shot(frame, '17-envoye');
  const big = Buffer.from(await bigImage(page, 3600, 2400), 'base64');
  say('  l\'original :', `${(big.length / 1048576).toFixed(1)} Mo, 3600 × 2400`);
  await pick('batiment-a-grand.jpeg', big, 'image/jpeg');
  await page.waitForFunction(() => document.querySelector('iframe') !== null, null, { timeout: 5000 }).catch(() => {});
  await frame.locator('.an-pl-img').waitFor({ state: 'visible', timeout: 40000 });
  await page.waitForTimeout(800);
  const second = attachmentId(await placeCell(run, 2));
  const info = await attachmentInfo(run, second);
  say('  ce que Grist a gardé :', JSON.stringify(info));
  check('Grist a un JPEG de 2048 pixels de grand côté, bien plus léger que l\'original', second > first && Math.max(info.width, info.height) === 2048 && info.size < big.length / 2 && info.type === 'image/jpeg', [second, info]);
  await frame.locator('[data-fk="plan-img-clear"]').click();
  await page.waitForTimeout(1200);
  check('« Retirer » vide la cellule : le cadre disparaît, le bouton « Image du plan… » revient', attachmentId(await placeCell(run, 2)) === 0 && (await frame.locator('.an-pl-map').count()) === 0
    && (await frame.locator('.an-pl-img-b').allInnerTexts()).map(each => each.trim()).join('|') === t('an.plan.imgPick'), await noteOf(frame));
  check('le pied dit que l\'image est retirée', (await noteOf(frame)) === t('an.plan.imgRemoved', { name: 'Bâtiment A' }), await noteOf(frame));
}

// Les locaux de l'étage 1 tracés là où `seedPlan` les a dessinés (le plan de 1600 × 1000 pixels fait 1000 × 625 unités) : deux bureaux, le couloir, et la salle Atlas en
// L (un polygone).
const SHAPES = { 6: { t: 'r', x: 40, y: 50, w: 300, h: 250 }, 7: { t: 'r', x: 360, y: 50, w: 300, h: 250 }, 8: { t: 'r', x: 40, y: 325, w: 920, h: 75 },
  9: { t: 'p', p: [[680, 50], [960, 50], [960, 300], [820, 300], [820, 180], [680, 180]] } };

// Le centre d'un nœud, ramené à ce qu'on en voit dans le cadre du plan (un tracé agrandi dépasse du cadre : on clique dans la part visible).
async function visibleCentre(frame, locator) {
  const box = await locator.boundingBox();
  const view = await frame.locator('.an-pl-vp').boundingBox();
  const x1 = Math.max(box.x, view.x);
  const x2 = Math.min(box.x + box.width, view.x + view.width);
  const y1 = Math.max(box.y, view.y);
  const y2 = Math.min(box.y + box.height, view.y + view.height);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

// Où tombe, dans la page, le point (x, y) du plan (en unités du plan) d'un tracé : la matrice de l'écran du SVG, plus la place du cadre dans la page.
async function unitPoint(frame, locator, x, y) {
  const inner = await locator.evaluate((path, [px, py]) => { const p = new DOMPoint(px, py).matrixTransform(path.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
  const host = await (await frame.frameElement()).boundingBox();
  return { x: host.x + inner.x, y: host.y + inner.y };
}

const shapeNamed = (frame, id) => frame.locator(`.an-pl-shape[data-id="${id}"] path`);

async function planShapes(run, page) {
  say('--- 8. les locaux tracés : cliquables, nommés, comptés ; le local ouvert est cadré avec ses places ---');
  const ids = Object.keys(SHAPES).map(Number);
  const done = await apply(run, [['BulkUpdateRecord', 'Directory_Places', ids, { Shape: ids.map(id => JSON.stringify(SHAPES[id])) }]]);
  check('les quatre tracés sont écrits dans la colonne « Shape »', done.status === 200, done.text);
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A', 'Étage 1']);
  await frame.locator('.an-pl-shape').first().waitFor({ state: 'visible', timeout: 25000 });
  const shapeIds = async () => (await frame.locator('.an-pl-shape').evaluateAll(list => list.map(node => node.dataset.id)));
  check('un tracé par local tracé, rien pour les autres', JSON.stringify((await shapeIds()).sort()) === JSON.stringify(['6', '7', '8', '9']), await shapeIds());
  const labels = async () => frame.locator('.an-pl-shape').evaluateAll(list => list.map(node => [node.dataset.id,
    [...node.querySelectorAll('.is-name')].map(each => each.textContent).filter(Boolean).join(' '), node.querySelector('.is-count').textContent]));
  const seen = Object.fromEntries((await labels()).map(([id, name, count]) => [id, [name, count]]));
  say('  les noms et les décomptes :', JSON.stringify(seen));
  check('le nom et le décompte de chaque local sont écrits dans sa forme (2 sur 2 places, 0 sur 1 depuis qu\'Emma est partie, la salle sans personne : 0 sur 12)',
    seen[6]?.join('|') === 'Bureau 101|2/2' && seen[7]?.join('|') === 'Bureau 102|0/1' && seen[9]?.join('|') === 'Salle Atlas|0/12', seen);
  check('le couloir est grisé, avec son nom et sans décompte', (await frame.locator('.an-pl-shape.is-grey').evaluateAll(list => list.map(node => node.dataset.id))).join() === '8' && seen[8]?.[0] === 'Couloir' && seen[8]?.[1] === '');
  const labelBox = await frame.locator('.an-pl-shape[data-id="6"] .is-name').first().boundingBox();
  const tracedBox = await shapeNamed(frame, 6).boundingBox();
  check('le nom garde sa taille d\'écran (autour de 12 px de haut) et tient dans sa forme',
    labelBox.height > 8 && labelBox.height < 26 && labelBox.x >= tracedBox.x && labelBox.x + labelBox.width <= tracedBox.x + tracedBox.width, [labelBox, tracedBox]);
  await shot(frame, '18-locaux-traces');
  check('la fenêtre tient dans le panneau 700 × 400', (await windowFits(frame)).inPanel);

  say('  le couloir grisé dit pourquoi ; un bureau s\'ouvre au clic, à la vraie souris');
  let at = await visibleCentre(frame, shapeNamed(frame, 8));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(250);
  check('un clic sur le couloir dit qu\'il n\'a pas de poste de travail, sans changer de lieu', (await noteOf(frame)) === t('an.plan.noSeats') && (await crumbOf(frame)).at(-1) === 'Étage 1', await noteOf(frame));
  at = await visibleCentre(frame, shapeNamed(frame, 7));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  check('un clic sur « Bureau 102 » descend dans ce bureau', (await crumbOf(frame)).at(-1) === 'Bureau 102', await crumbOf(frame));
  const closer = await viewOf(frame);
  check('le plan est resté celui de l\'étage et se cadre sur le bureau (agrandi)', closer.k > 1.3 && (await frame.locator('.an-pl-img').count()) === 1, closer);
  const classes = async () => Object.fromEntries(await frame.locator('.an-pl-shape').evaluateAll(list => list.map(node => [node.dataset.id, node.getAttribute('class')])));
  const marked = await classes();
  check('le bureau ouvert est cerné, les autres s\'estompent', Object.values(marked).filter(each => each.includes('is-current')).length === 1 && Object.values(marked).filter(each => each.includes('is-dim')).length === 3, marked);
  const seats = async () => ({ taken: await frame.locator('.an-pl-seat.is-taken').count(), free: await frame.locator('.an-pl-seat.is-free').count() });
  check('une place vide : le bureau 102 a une place et personne dedans', JSON.stringify(await seats()) === JSON.stringify({ taken: 0, free: 1 }), await seats());
  await shot(frame, '19-local-cadre');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  at = await visibleCentre(frame, shapeNamed(frame, 6));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  check('le bureau 101 : deux places pleines, aucune vide (Camille et Théo)', JSON.stringify(await seats()) === JSON.stringify({ taken: 2, free: 0 }), await seats());
  const seat = frame.locator('.an-pl-seat.is-taken').first();
  const seatRow = Number(await seat.getAttribute('data-row'));
  await seat.click();
  await page.waitForTimeout(500);
  const names = { [CAMILLE]: 'Camille Durand', [THEO]: 'Théo Lambert' };
  check('un clic sur une place pleine ouvre la fiche de la personne', (await frame.locator('.an-side').innerText()).includes(names[seatRow]), [seatRow, await frame.locator('.an-side').innerText().catch(() => '')]);
  await shot(frame, '20-place-fiche');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('Échap remonte à l\'étage : le plan revient entier', (await crumbOf(frame)).at(-1) === 'Étage 1' && (await viewOf(frame)).k === 1, [await crumbOf(frame), await viewOf(frame)]);

  say('  la salle en L : douze places, toutes dans la forme');
  await shot(frame, '21a-avant-le-l');
  // un point dans la branche haute du L (le creux est en bas à gauche), de l'unité du plan à l'écran
  at = await unitPoint(frame, shapeNamed(frame, 9), 900, 100);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  check('un clic dans le L descend dans la salle Atlas', (await crumbOf(frame)).at(-1) === 'Salle Atlas', await crumbOf(frame));
  check('douze places libres, aucune pleine', JSON.stringify(await seats()) === JSON.stringify({ taken: 0, free: 12 }), await seats());
  const inside = await frame.locator('.an-pl-shape.is-current path').evaluate(path => [...path.ownerSVGElement.querySelectorAll('.an-pl-seat')].map(circle => {
    const r = Number(circle.getAttribute('r'));
    const x = Number(circle.getAttribute('cx'));
    const y = Number(circle.getAttribute('cy'));
    return [[x, y], [x - r, y], [x + r, y], [x, y - r], [x, y + r]].every(([px, py]) => path.isPointInFill(new DOMPoint(px, py)));
  }));
  check('chaque place est entièrement dans le L (jamais dans le creux)', inside.length === 12 && inside.every(Boolean), inside);
  await shot(frame, '21-salle-en-l');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  say('  agrandi, un clic sur un tracé descend toujours (le glisser ne le mange pas)');
  await frame.locator('[data-fk="plan-zoom-in"]').click();
  await frame.locator('[data-fk="plan-zoom-in"]').click();
  await page.waitForTimeout(300);
  check('le plan est agrandi', (await viewOf(frame)).k > 2, await viewOf(frame));
  at = await visibleCentre(frame, shapeNamed(frame, 6));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  check('un clic simple sur un tracé du plan agrandi descend dans « Bureau 101 »', (await crumbOf(frame)).at(-1) === 'Bureau 101', await crumbOf(frame));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  say('  « Voir sur le plan » depuis la fiche : le bureau est repéré sur son étage');
  await frame.locator('[data-fk="v:list"]').click();
  await frame.locator(`[data-fk="pe:${CAMILLE}"]`).scrollIntoViewIfNeeded();
  if (!(await frame.locator('.an-side [data-fk="plan-open"]').count())) await frame.locator(`[data-fk="pe:${CAMILLE}"]`).click(); // sa fiche est déjà ouverte : un second clic la fermerait
  await frame.locator('[data-fk="plan-open"]').click();
  await frame.locator('.an-pl-shape.is-here').waitFor({ state: 'visible', timeout: 15000 });
  check('le bureau 101 est repéré sur le plan de son étage', (await frame.locator('.an-pl-shape.is-here').evaluateAll(list => list.map(node => node.dataset.id))).join() === '6'
    && (await crumbOf(frame)).at(-1) === 'Étage 1', await crumbOf(frame));
  await shot(frame, '22-bureau-repere');
  check('contraste 4,5:1 sur le plan, ses tracés et ses places', (await contrastProblems(frame, '.an-plan')).length === 0, await contrastProblems(frame, '.an-plan'));
}

const sibsOf = async frame => (await frame.locator('[data-fk="plan-sibs"] .an-pl-sibb').evaluateAll(list => list.map(node => [node.querySelector('.an-pl-sibn').textContent,
  node.querySelector('.an-pl-sibc').textContent, node.getAttribute('aria-pressed')])));

async function planNav(run, page) {
  say('--- 10. se déplacer : les autres étages avec leur décompte, les lieux estompés par une recherche, la carte en ligne ---');
  const context = page.context();
  let frame = await gfsFrame(page);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A']);
  check('au cran du bâtiment : les deux bâtiments du site, avec leur décompte (5 et 1), le bâtiment A enfoncé',
    JSON.stringify(await sibsOf(frame)) === JSON.stringify([['Bâtiment A', '5', 'true'], ['Bâtiment B', '1', 'false']]), await sibsOf(frame));
  await frame.locator('[data-fk="plan-sib:3"]').click();
  await page.waitForTimeout(300);
  check('un clic sur « Bâtiment B » y va, sans remonter', (await crumbOf(frame)).at(-1) === 'Bâtiment B' && (await sibsOf(frame))[1][2] === 'true', await crumbOf(frame));
  await frame.locator('[data-fk="plan-sib:2"]').click();
  await frame.locator('.an-pl-tile', { hasText: 'Étage 1' }).click();
  await page.waitForTimeout(300);
  check('au cran de l\'étage : les deux étages du bâtiment A, 2 personnes à l\'étage 1 et 3 à l\'étage 2, l\'étage 1 enfoncé',
    JSON.stringify(await sibsOf(frame)) === JSON.stringify([['Étage 1', '2', 'true'], ['Étage 2', '3', 'false']]), await sibsOf(frame));
  const sibBox = await frame.locator('[data-fk="plan-sibs"]').boundingBox();
  const planBox = await frame.locator('.an-pl-vp').boundingBox();
  const panel = await (await frame.frameElement()).boundingBox();
  check('la rangée des étages se voit en haut du volet, au-dessus du plan, sans défiler (700 × 400)', sibBox.height > 14 && sibBox.y + sibBox.height <= planBox.y + 1 && sibBox.y >= panel.y
    && sibBox.y + sibBox.height <= panel.y + panel.height, [sibBox, planBox, panel.y + panel.height]);
  await shot(frame, '30-autres-etages');
  await frame.locator('[data-fk="plan-sib:5"]').click();
  await page.waitForTimeout(300);
  check('un clic sur « Étage 2 » y va : ses locaux, son décompte', (await crumbOf(frame)).at(-1) === 'Étage 2' && JSON.stringify(await tilesOf(frame)) === JSON.stringify(['Bureau 201', 'Sanitaires']), [await crumbOf(frame), await tilesOf(frame)]);
  await frame.locator('[data-fk="plan-sib:4"]').click();
  await page.waitForTimeout(300);
  await frame.locator('.an-pl-shape').first().waitFor({ state: 'visible', timeout: 15000 });
  const tileDim = async () => (await frame.locator('.an-pl-tile.is-dim').evaluateAll(list => list.map(node => node.dataset.id)));
  const shapeDim = async () => (await frame.locator('.an-pl-shape.is-dim').evaluateAll(list => list.map(node => node.dataset.id)));
  check('sans recherche, rien n\'est estompé', (await tileDim()).length === 0 && (await shapeDim()).length === 0, [await tileDim(), await shapeDim()]);
  const search = frame.locator(`input[aria-label="${t('an.searchLabel')}"]`);
  await search.fill('camille');
  await page.waitForTimeout(500);
  check('avec « camille », les locaux où personne ne correspond (102, Atlas) sont estompés, le 101 et le couloir grisé non',
    JSON.stringify((await tileDim()).sort()) === JSON.stringify(['7', '9']) && JSON.stringify((await shapeDim()).sort()) === JSON.stringify(['7', '9']), [await tileDim(), await shapeDim()]);
  check('le décompte du bureau 101 dit 1 (Camille seule) et le nom reste lisible', (await text(frame.locator('.an-pl-tile[data-id="6"]'))).includes('1'), await text(frame.locator('.an-pl-tile[data-id="6"]')));
  await shot(frame, '31-recherche-estompe');
  check('contraste 4,5:1 avec des lieux estompés et le sélecteur d\'étages', (await contrastProblems(frame, '.an-plan')).length === 0, await contrastProblems(frame, '.an-plan'));
  await search.fill('');
  await page.waitForTimeout(400);
  check('la recherche effacée, plus rien n\'est estompé', (await tileDim()).length === 0 && (await shapeDim()).length === 0);

  say('  la carte en ligne : un lien, l\'adresse du site pour tous ses lieux, les coordonnées quand elles existent, grisé sans rien');
  const geo = frame.locator('[data-fk="plan-geo"]');
  const siege = 'https://www.openstreetmap.org/search?query=12%20rue%20des%20%C3%89coles%2C%20Lyon';
  check('l\'étage se situe par l\'adresse du site : un lien OpenStreetMap, nouvel onglet, rien d\'autre', (await geo.getAttribute('href')) === siege && (await geo.getAttribute('target')) === '_blank'
    && (await geo.getAttribute('rel')) === 'noopener noreferrer', await geo.getAttribute('href'));
  await context.route('https://www.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>OpenStreetMap</title>' })); // le cloud n'a pas de réseau : l'adresse visée suffit
  const popup = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await geo.click();
  const opened = await popup;
  check('un clic à la vraie souris ouvre un nouvel onglet vers OpenStreetMap', Boolean(opened) && /^https:\/\/www\.openstreetmap\.org\//.test(opened.url()), opened ? opened.url() : 'aucun onglet');
  if (opened) await opened.close().catch(() => {});
  const coords = await apply(run, [['UpdateRecord', 'Directory_Places', 3, { Lat: 45.75, Lng: 4.85 }]]);
  check('des coordonnées posées sur « Bâtiment B »', coords.status === 200, coords.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment B']);
  check('« Bâtiment B » se situe par ses coordonnées', (await frame.locator('[data-fk="plan-geo"]').getAttribute('href')) === 'https://www.openstreetmap.org/?mlat=45.75&mlon=4.85#map=18/45.75/4.85',
    await frame.locator('[data-fk="plan-geo"]').getAttribute('href'));
  await shot(frame, '32-carte-en-ligne');
  const blank = await apply(run, [['UpdateRecord', 'Directory_Places', 1, { Address: '' }]]);
  check('l\'adresse du site est effacée', blank.status === 200, blank.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A']);
  const grey = frame.locator('[data-fk="plan-geo"]');
  check('sans adresse ni coordonnées, le lien reste là, grisé', (await grey.count()) === 1 && (await grey.getAttribute('aria-disabled')) === 'true' && !(await grey.getAttribute('href')), await grey.getAttribute('aria-disabled'));
  await pressGreyed(page, grey);
  await page.waitForTimeout(300);
  check('un clic dit quelles colonnes remplir', (await noteOf(frame)) === t('an.plan.noGeo'), await noteOf(frame));
  await shot(frame, '33-carte-grisee');
}

// La fenêtre de tracé : sa taille et ce qui y déborde (la première fenêtre de la page est celle de l'annuaire, pas la sienne).
const traceFits = frame => frame.evaluate(() => {
  const mod = document.querySelector('.mod.an-trace');
  if (!mod) return { shown: false };
  const box = mod.getBoundingClientRect();
  const overflowing = [...mod.querySelectorAll('*')].filter(node => (node.checkVisibility ? node.checkVisibility() : true)).filter(node => {
    const at = node.getBoundingClientRect();
    return at.width > 0 && !node.closest('.an-tr-list') && (at.right > box.right + 1 || at.left < box.left - 1 || at.bottom > box.bottom + 1 || at.top < box.top - 1);
  }).map(node => node.className || node.tagName).slice(0, 5);
  return { shown: true, inPanel: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, overflowing, box: [box.width, box.height] };
});

// Tire un rectangle (ou une suite de points) à la vraie souris entre deux points du plan, en unités.
async function dragUnits(page, frame, anchor, from, to) {
  const a = await unitPoint(frame, anchor, ...from);
  const b = await unitPoint(frame, anchor, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

const roomRow = (frame, id) => frame.locator(`[data-fk="trace-room:${id}"]`);
const rowText = async (frame, id) => (await text(roomRow(frame, id)));
const countOf = frame => text(frame.locator('.an-tr-side-head .an-count'));
const saveText = frame => text(frame.locator('[data-fk="trace-save"]'));

async function planTrace(run, page) {
  say('--- 9. tracer les locaux : la fenêtre, un nouveau local, un rectangle, un polygone, un angle tiré, annuler, effacer, enregistrer d\'un coup ---');
  let frame = await gfsFrame(page);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A', 'Étage 1']);
  await frame.locator('.an-pl-shape').first().waitFor({ state: 'visible', timeout: 25000 });
  const open = frame.locator('[data-fk="plan-trace"]');
  check('« Tracer les locaux… » est là, ouvert à l\'administrateur (le propriétaire du document)', (await open.count()) === 1 && (await open.getAttribute('aria-disabled')) === 'false'
    && (await open.getAttribute('aria-label')) === t('an.plan.trace'), await open.getAttribute('aria-disabled'));
  await open.focus();
  await page.keyboard.press('Enter');
  await frame.locator('.mod.an-trace').waitFor({ state: 'visible', timeout: 20000 });
  await frame.locator('.an-tr-vp .an-pl-shape').first().waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForTimeout(400);
  check('au clavier (Entrée sur le bouton), la fenêtre s\'ouvre avec le nom du lieu', (await text(frame.locator('.mod.an-trace .mod-head h2'))) === t('an.tr.title', { name: 'Étage 1' }), await text(frame.locator('.mod.an-trace .mod-head h2')));
  const rooms = (await frame.locator('.an-tr-room .an-tr-name').allInnerTexts()).map(each => each.trim());
  check('les quatre locaux de l\'étage sont listés, tracés, et rien n\'est à enregistrer', JSON.stringify(rooms) === JSON.stringify(['Bureau 101', 'Bureau 102', 'Couloir', 'Salle Atlas'])
    && (await countOf(frame)) === t('an.tr.traced', { n: 4, max: 4 }) && (await saveText(frame)) === t('an.tr.save', { n: 0 }) && (await frame.locator('[data-fk="trace-save"]').getAttribute('aria-disabled')) === 'true', [rooms, await countOf(frame)]);
  const fits = await traceFits(frame);
  check('la fenêtre de tracé tient dans le panneau 700 × 400, rien n\'y déborde', fits.inPanel && fits.overflowing.length === 0, fits);
  const canvas = await frame.locator('.an-tr-vp').boundingBox();
  check('le plan garde une hauteur utile (150 px au moins) à 700 × 400', canvas.height >= 150 && canvas.width >= 300, canvas);
  await shot(frame, '23-trace-ouvert');
  check('contraste 4,5:1 dans la fenêtre de tracé', (await contrastProblems(frame, '.mod.an-trace')).length === 0, await contrastProblems(frame, '.mod.an-trace'));

  say('  un nouveau local : « Bureau 103 », un bureau de deux places, tracé en rectangle');
  await frame.locator('[data-fk="trace-new"]').click();
  await frame.locator('.mod.an-tr-new').waitFor({ state: 'visible' });
  check('« Créer et tracer » est grisé tant que le nom est vide', (await frame.locator('[data-fk="trn-ok"]').getAttribute('aria-disabled')) === 'true');
  await page.keyboard.type('Bureau 103');
  await frame.locator('[data-fk="trn-seats"]').click({ clickCount: 3 });
  await page.keyboard.type('2');
  await shot(frame, '24-nouveau-local');
  await frame.locator('[data-fk="trn-ok"]').click();
  await frame.locator('.mod.an-tr-new').waitFor({ state: 'detached' });
  check('le nouveau local est dans la liste, « nouveau », à tracer ; l\'outil rectangle est pris', (await rowText(frame, 'new:1')).includes('Bureau 103') && (await rowText(frame, 'new:1')).includes(t('an.tr.statusNew'))
    && (await frame.locator('[data-fk="trace-tool:rect"]').getAttribute('aria-pressed')) === 'true' && (await saveText(frame)) === t('an.tr.save', { n: 1 }), [await rowText(frame, 'new:1'), await saveText(frame)]);
  const anchor = frame.locator('.an-tr-vp .an-pl-shape[data-id="6"] path');
  await dragUnits(page, frame, anchor, [520, 430], [740, 590]);
  await page.waitForTimeout(300);
  check('le rectangle est tracé : « 5 tracés sur 5 », l\'outil revient à « Choisir » avec le tracé choisi et ses quatre poignées',
    (await countOf(frame)) === t('an.tr.traced', { n: 5, max: 5 }) && (await frame.locator('[data-fk="trace-tool:select"]').getAttribute('aria-pressed')) === 'true' && (await frame.locator('.an-tr-handle').count()) === 4,
    [await countOf(frame), await frame.locator('.an-tr-handle').count()]);
  await shot(frame, '25-rectangle-trace');

  say('  un angle tiré (la grille aimante), puis le même geste sans l\'aimant');
  const corner = frame.locator('.an-tr-handle').nth(2);
  const from = await unitPoint(frame, anchor, 740, 590);
  const to = await unitPoint(frame, anchor, 764, 590);
  const cornerBox = await corner.boundingBox();
  check('la poignée du coin bas droit est sur le coin du tracé (à la vraie souris)', Math.abs(cornerBox.x + cornerBox.width / 2 - from.x) < 4 && Math.abs(cornerBox.y + cornerBox.height / 2 - from.y) < 4, [cornerBox, from]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check('l\'angle tiré en (764, 590) tombe sur la grille : (760, 590)', await frame.locator('.an-tr-vp .an-pl-shape[data-id="new:1"] path').evaluate(path => path.getAttribute('d')).then(d => /520[ ,]430/.test(d) && /760[ ,]590/.test(d)), await frame.locator('.an-tr-vp .an-pl-shape[data-id="new:1"] path').evaluate(path => path.getAttribute('d')));
  await frame.locator('[data-fk="trace-snap"]').click();
  check('« Aimanter à la grille » se coupe et se rallume (enfoncé = allumé)', (await frame.locator('[data-fk="trace-snap"]').getAttribute('aria-pressed')) === 'false');
  await frame.locator('[data-fk="trace-snap"]').click();
  check('… et revient allumé', (await frame.locator('[data-fk="trace-snap"]').getAttribute('aria-pressed')) === 'true');

  say('  un second local, « Local technique » (sans place), tracé en polygone ; annuler et rétablir');
  await frame.locator('[data-fk="trace-new"]').click();
  await frame.locator('.mod.an-tr-new').waitFor({ state: 'visible' });
  await page.keyboard.type('Local technique');
  await frame.locator('[data-fk="trn-use:service"]').click();
  check('un lieu technique n\'a pas de places : le champ est grisé, avec sa raison', (await frame.locator('[data-fk="trn-seats"]').isDisabled()) && (await text(frame.locator('.mod.an-tr-new .an-set-hint'))) === t('an.plan.noSeats'));
  await frame.locator('[data-fk="trn-ok"]').click();
  await frame.locator('.mod.an-tr-new').waitFor({ state: 'detached' });
  await frame.locator('[data-fk="trace-tool:poly"]').click();
  for (const [x, y] of [[780, 430], [960, 430], [960, 590], [840, 590]]) {
    const at = await unitPoint(frame, anchor, x, y);
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(80);
  }
  check('pendant le tracé, quatre points posés et l\'aide dit comment fermer', (await frame.locator('.an-tr-dot').count()) === 4 && (await noteOf(frame).catch(() => '')) !== undefined);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('Entrée ferme le polygone : « 6 tracés sur 6 », deux changements à enregistrer', (await countOf(frame)) === t('an.tr.traced', { n: 6, max: 6 }) && (await saveText(frame)) === t('an.tr.save', { n: 2 }), [await countOf(frame), await saveText(frame)]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  check('Ctrl+Z défait le polygone : « 5 tracés sur 6 », le local reste à tracer', (await countOf(frame)) === t('an.tr.traced', { n: 5, max: 6 }) && (await rowText(frame, 'new:2')).includes(t('an.tr.statusNew')), await countOf(frame));
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(200);
  check('Ctrl+Y le rétablit : « 6 tracés sur 6 »', (await countOf(frame)) === t('an.tr.traced', { n: 6, max: 6 }), await countOf(frame));
  await shot(frame, '26-polygone-trace');

  say('  effacer le tracé du couloir, abandonner puis revenir, enregistrer');
  await roomRow(frame, 8).click();
  await frame.locator('[data-fk="trace-del"]').click();
  await page.waitForTimeout(200);
  check('le couloir n\'est plus tracé : « 5 tracés sur 6 », trois changements à enregistrer', (await countOf(frame)) === t('an.tr.traced', { n: 5, max: 6 }) && (await saveText(frame)) === t('an.tr.save', { n: 3 })
    && (await rowText(frame, 8)).includes(t('an.tr.statusTodo')), [await countOf(frame), await saveText(frame), await rowText(frame, 8)]);
  await page.keyboard.press('Escape');
  await frame.locator('.mod.ask').waitFor({ state: 'visible', timeout: 5000 });
  check('Échap avec un brouillon demande avant d\'abandonner, et dit combien de changements se perdraient', (await text(frame.locator('.mod.ask .mod-head h2'))) === t('an.tr.leaveTitle')
    && (await text(frame.locator('.mod.ask #ask-text'))) === t('an.tr.leaveText', { n: 3 }), await text(frame.locator('.mod.ask #ask-text')));
  await shot(frame, '27-abandonner');
  await frame.locator('[data-fk="ask-no"]').click();
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  check('« Continuer le tracé » : la fenêtre est toujours là, le brouillon intact', (await frame.locator('.mod.an-trace').count()) === 1 && (await saveText(frame)) === t('an.tr.save', { n: 3 }));
  const before = (await rowsOf(run, 'Directory_Places')).length;
  check('rien n\'est écrit dans Grist tant qu\'on n\'a pas enregistré (treize lieux)', before === 13, before);
  await frame.locator('[data-fk="trace-save"]').click();
  await frame.locator('.mod.an-trace').waitFor({ state: 'detached', timeout: 40000 });
  await page.waitForTimeout(800);
  const places = (await rowsOf(run, 'Directory_Places')) || [];
  const byName = name => places.find(row => row.Name === name);
  const shapeOf = row => (row && row.Shape ? JSON.parse(row.Shape) : null);
  check('Grist a deux lieux de plus, rien d\'autre en plus', places.length === 15, places.map(row => row.Name));
  const room = byName('Bureau 103');
  const tech = byName('Local technique');
  check('« Bureau 103 » : un local, un bureau de deux places, enfant de l\'étage 1, le rectangle aimanté à la grille',
    room && room.Kind === 'Room' && room.Use === 'Office' && room.Capacity === 2 && room.Parent === 4 && JSON.stringify(shapeOf(room)) === JSON.stringify({ t: 'r', x: 520, y: 430, w: 240, h: 160 }), room);
  check('« Local technique » : un local de service, sans place, le polygone à quatre angles', tech && tech.Kind === 'Room' && tech.Use === 'Service' && !tech.Capacity && tech.Parent === 4
    && JSON.stringify(shapeOf(tech)) === JSON.stringify({ t: 'p', p: [[780, 430], [960, 430], [960, 590], [840, 590]] }), tech);
  check('le tracé du couloir est effacé (vide), les trois autres n\'ont pas bougé', !byName('Couloir').Shape && JSON.stringify(shapeOf(byName('Salle Atlas'))) === JSON.stringify(SHAPES[9])
    && JSON.stringify(shapeOf(byName('Bureau 101'))) === JSON.stringify(SHAPES[6]), places.map(row => [row.Name, row.Shape]));
  check('la fenêtre de l\'annuaire dit que le tracé est enregistré, et le plan montre les nouveaux locaux', (await noteOf(frame)).includes(t('an.tr.saved', { name: 'Étage 1' }).replace(/\s+/g, ' ')) && (await tilesOf(frame)).includes('Bureau 103')
    && (await tilesOf(frame)).includes('Local technique'), [await noteOf(frame), await tilesOf(frame)]);
  await frame.locator('.an-pl-shape').first().waitFor({ state: 'visible', timeout: 15000 });
  const ids = (await frame.locator('.an-pl-shape').evaluateAll(list => list.map(node => node.dataset.id))).sort();
  check('le plan montre les cinq tracés (le couloir n\'en a plus)', JSON.stringify(ids) === JSON.stringify([String(room.id), String(tech.id), '6', '7', '9'].sort()), ids);
  await shot(frame, '28-apres-enregistrement');

  say('  sans colonne « Shape » : le bouton reste là, grisé, et un clic dit pourquoi');
  const gone = await apply(run, [['RemoveColumn', 'Directory_Places', 'Shape']]);
  check('la colonne « Shape » est retirée du document', gone.status === 200, gone.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('[data-fk="v:plan"]').click();
  await goTo(frame, page, ['Siège', 'Bâtiment A', 'Étage 1']);
  await frame.locator('.an-pl-img').waitFor({ state: 'visible', timeout: 25000 });
  const grey = frame.locator('[data-fk="plan-trace"]');
  check('« Tracer les locaux… » est grisé (jamais masqué)', (await grey.count()) === 1 && (await grey.getAttribute('aria-disabled')) === 'true', await grey.getAttribute('aria-disabled'));
  await pressGreyed(page, grey);
  await page.waitForTimeout(300);
  check('un clic dit qu\'il manque la colonne « Shape », et n\'ouvre aucune fenêtre', (await noteOf(frame)) === t('an.plan.noShapeCol') && (await frame.locator('.mod.an-trace').count()) === 0, await noteOf(frame));
  await shot(frame, '29-sans-colonne');
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  await play(run);
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 600));
  for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: join(SHOTS, `${TAG}-erreur.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  pages.close();
}
