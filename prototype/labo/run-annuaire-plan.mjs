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
const viewOf = frame => frame.locator('.an-pl-img').evaluate(img => {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(img.style.transform);
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
  check('tout entier : on peut agrandir, pas réduire ni ajuster (grisés, jamais masqués)', JSON.stringify(await buttons()) === JSON.stringify(['false', 'true', 'true']), await buttons());
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
  check('« Réduire » et « Tout le plan » s\'ouvrent', JSON.stringify(await buttons()) === JSON.stringify(['false', 'false', 'false']), await buttons());
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
