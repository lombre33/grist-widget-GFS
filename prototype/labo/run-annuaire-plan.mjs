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
  check('aucune erreur de GFS dans la console (ni violation de la politique de contenu)', unexpected(run).length === 0, unexpected(run));
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
