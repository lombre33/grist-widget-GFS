// Le glisser-déposer de l'explorateur (demande du porteur, 04/11 : « drag & drop des fichiers dans des dossiers, en amont, en aval » ; js/explorer-drag.js), dans un VRAI Grist (grist-static), sous Chromium, à 700 × 400,
// à la vraie souris (le bouton appuyé, la souris tirée de pas en pas, le bouton relâché : le navigateur lance lui-même le glissement HTML5). Sous Firefox sans écran le dépôt n'aboutit pas (test/firefox.mjs, `Page.drag`) :
// c'est ici qu'il se mesure. La sonde ZF (labo/sondes/zf-composite/) apporte trois fichiers ; les dossiers naissent par « Nouveau dossier », donc avec l'accord de la personne pour la table du rangement.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   1. Deux dossiers, un sous-dossier ; les lignes se tiennent (draggable).
//   2. En aval : un fichier sur un dossier de la liste, puis sur un dossier du volet ; un dossier fermé du volet qu'on survole s'ouvre et son sous-dossier accueille le fichier.
//   3. En amont : un fichier sur le fil d'Ariane (« Moi », un ancêtre), sur la racine du volet.
//   4. Un dossier plein sur un autre (ses fichiers le suivent), puis de nouveau à la racine ; en vignettes aussi.
//   5. Ce qui ne s'accepte pas : le dossier où est déjà la ligne, un dossier sur lui-même ou dans son sous-dossier ; la corbeille ne se tient pas.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { createI18n } from '../js/i18n.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const run = `glisser-explorateur-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme, probes: ['zf'] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });

const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async stamp => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeZf_Fichiers', columns]]);
  await grist.docApi.applyUserActions([['BulkAddRecord', 'SondeZf_Fichiers', [null, null, null], { Nom: ['Inscription atelier', 'Enquête', 'Bilan'], Type: ['formulaire', 'formulaire', 'formulaire'], DateModif: [stamp - 60, stamp - 120, stamp - 180] }]]);
}, now);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const ZF = /zf-composite\//;
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const toast = frame.locator('#toast');
const row = name => frame.locator('.ls-row', { has: frame.locator('.t', { hasText: exact(name) }) }).first();
const tile = name => frame.locator('.th', { has: frame.locator('.tn', { hasText: exact(name) }) }).first();
const treeRow = path => frame.locator(`.tr-row[data-path="${path}"]`);
const crumb = path => frame.locator(`.crumbs [data-path="${path}"]`);
const names = () => frame.locator('.ls-row .t').allInnerTexts();
const shot = name => lab.shotPanel(run, name, frame);
const said = async text => {
  await toast.filter({ hasText: exact(text) }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  return (await toast.innerText().catch(() => '')).trim();
};
const quiet = () => toast.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
// Ce que le document retient du rangement : où est chaque fichier (le dossier de sa ligne), et les dossiers gardés sans fichier.
const filing = () => frame.evaluate(async () => {
  if (!(await grist.docApi.listTables()).includes('GFS_Rangement')) return null;
  const data = await grist.docApi.fetchTable('GFS_Rangement');
  return data.id.map((id, i) => ({ app: data.App[i], file: data.Fichier[i], folder: data.Dossier[i] }));
});
const placeOf = async id => { const rows = (await filing()) || []; const found = rows.find(each => each.app === 'sonde-zf' && each.file === String(id)); return found ? found.folder : ''; };
const keptFolders = async () => ((await filing()) || []).filter(each => !each.app && !each.file).map(each => each.folder).sort();
const writes = () => lab.actions().then(list => list.filter(each => /^(AddRecord|UpdateRecord|BulkAddRecord|RemoveRecord|BulkUpdateRecord) GFS_Rangement/.test(each)).length);
const lit = () => frame.locator('.is-drop').evaluateAll(nodes => nodes.map(node => (node.dataset.path !== undefined ? `chemin:${node.dataset.path}` : node.dataset.key)));

// Un glissement à la vraie souris : appuyer sur `from`, s'écarter (le navigateur ne lance le glissement qu'alors), traverser par pas jusqu'à `to`, s'y arrêter `hold` ms (`during(page)` regarde ce qui s'éclaire), relâcher.
const center = async locator => { const box = await locator.boundingBox(); return { x: box.x + Math.min(box.width / 2, 60), y: box.y + box.height / 2 }; };
async function drag(from, to, { hold = 250, during = null, release = true } = {}) {
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 14 });
  await page.waitForTimeout(hold);
  const seen = during ? await during() : null;
  if (release) await page.mouse.up();
  return seen;
}
const settle = () => page.waitForTimeout(700);

// « Nouveau dossier » dans le dossier ouvert ; la première fois, la question de la table du rangement passe devant (« Créer la table »).
async function makeFolder(name) {
  await frame.locator('.ex-nav-row .btn.primary').click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) }).click();
  await frame.locator('[data-fk="name-input"]').fill(name);
  await page.keyboard.press('Enter');
  const asked = await frame.locator('.mod.ask').waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
  if (asked) await frame.locator('[data-fk="ask-yes"]').click();
  await row(name).waitFor({ timeout: 8000 });
  await quiet();
}

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. trois fichiers à la racine, deux dossiers, un sous-dossier ===');
await lab.openApp('sonde-zf', ZF, frame);
await frame.locator('#floater-files').click();
await row('Bilan').waitFor();
await makeFolder('Contrats');
await makeFolder('Archives');
await row('Archives').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('Archives') }).waitFor();
await makeFolder('2025');
await crumb('').click();
await row('Archives').waitFor();
check('trois fichiers et deux dossiers à la racine, « 2025 » dans « Archives »', JSON.stringify((await names()).sort()) === JSON.stringify(['Archives', 'Bilan', 'Contrats', 'Enquête', 'Inscription atelier']) && JSON.stringify(await keptFolders()) === JSON.stringify(['Archives', 'Archives/2025', 'Contrats']), { liste: await names(), gardes: await keptFolders() });
const draggable = await frame.locator('.ls-row[data-key]').evaluateAll(nodes => nodes.map(node => node.draggable));
check('chaque ligne de la liste (fichiers et dossiers) se tient', draggable.length === 5 && draggable.every(Boolean), draggable);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. en aval : un fichier sur un dossier de la liste, puis du volet, puis un sous-dossier du volet qu\'on ouvre en le survolant ===');
let mid = await drag(row('Bilan'), row('Contrats'), { during: async () => { const seen = { lit: await lit(), dim: await frame.locator('.is-dragging .t').allInnerTexts() }; await shot('2-survol-liste'); return seen; } });
check('en cours de glissement, le dossier « Contrats » s\'éclaire (et lui seul) et la ligne tenue s\'efface', JSON.stringify(mid.lit) === JSON.stringify(['dir:Contrats']) && JSON.stringify(mid.dim) === JSON.stringify(['Bilan']), mid);
check('la phrase du déplacement, mot pour mot', await said(t('clip.moved', { name: 'Bilan', folder: 'Contrats' })) === t('clip.moved', { name: 'Bilan', folder: 'Contrats' }));
await settle();
check('le fichier est dans « Contrats » (une ligne de rangement), plus à la racine, rien ne reste éclairé ni effacé', (await placeOf(3)) === 'Contrats' && !(await names()).includes('Bilan') && (await lit()).length === 0 && (await frame.locator('.is-dragging').count()) === 0, { place: await placeOf(3), liste: await names() });
await quiet();
mid = await drag(row('Enquête'), treeRow('Contrats'), { during: async () => { const seen = await lit(); await shot('2-survol-volet'); return seen; } });
check('sur le volet, « Contrats » s\'éclaire', JSON.stringify(mid) === JSON.stringify(['chemin:Contrats']), mid);
await settle();
check('le fichier est dans « Contrats »', (await placeOf(2)) === 'Contrats', await filing());
await quiet();
// Le sous-dossier « 2025 » n'est pas visible dans le volet : « Archives » est fermé ; le survoler un instant l'ouvre.
await frame.locator('[data-toggle="Archives"]').click().catch(() => {});
if (await treeRow('Archives/2025').count()) await frame.locator('[data-toggle="Archives"]').click();
check('le volet montre « Archives » fermé, sans « 2025 »', (await treeRow('Archives').count()) === 1 && (await treeRow('Archives/2025').count()) === 0);
mid = await drag(row('Inscription atelier'), treeRow('Archives'), { hold: 1200, release: false, during: async () => ({ lit: await lit(), opened: await treeRow('Archives/2025').count() }) });
check('survolé 1,2 s, « Archives » s\'ouvre : « 2025 » apparaît dans le volet', mid.opened === 1, mid);
const sub = await center(treeRow('Archives/2025'));
await page.mouse.move(sub.x, sub.y, { steps: 6 });
await page.waitForTimeout(250);
check('« 2025 » s\'éclaire à son tour', JSON.stringify(await lit()) === JSON.stringify(['chemin:Archives/2025']), await lit());
await page.mouse.up();
await settle();
check('le fichier est dans « Archives/2025 »', (await placeOf(1)) === 'Archives/2025', await filing());
check('la phrase nomme le sous-dossier', await said(t('clip.moved', { name: 'Inscription atelier', folder: 'Archives/2025' })) === t('clip.moved', { name: 'Inscription atelier', folder: 'Archives/2025' }));
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. en amont : un fichier sur le fil d\'Ariane, sur la racine du volet ===');
await row('Contrats').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('Contrats') }).waitFor();
check('« Contrats » montre « Bilan » et « Enquête »', JSON.stringify((await names()).sort()) === JSON.stringify(['Bilan', 'Enquête']), await names());
mid = await drag(row('Bilan'), crumb(''), { during: async () => lit() });
check('le fil d\'Ariane éclaire « Moi » : le fichier peut remonter à la racine', JSON.stringify(mid) === JSON.stringify(['chemin:']), mid);
await settle();
check('« Bilan » est revenu à la racine ; la phrase dit « Moi »', (await placeOf(3)) === '' && !(await names()).includes('Bilan') && (await toast.innerText()).trim() === t('clip.moved', { name: 'Bilan', folder: t('ex.me') }), { place: await placeOf(3), liste: await names() });
await quiet();
mid = await drag(row('Enquête'), treeRow(''), { during: async () => lit() });
check('la racine du volet s\'éclaire aussi', JSON.stringify(mid) === JSON.stringify(['chemin:']), mid);
await settle();
check('« Enquête » est à la racine, « Contrats » est vide', (await placeOf(2)) === '' && (await names()).length === 0, { place: await placeOf(2), liste: await names() });
await quiet();
// Un dossier de deux niveaux : on remonte d'un seul (« Archives/2025 » : le fil d'Ariane propose « Archives »).
await crumb('').click();
await row('Archives').dblclick();
await row('2025').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('2025') }).waitFor();
mid = await drag(row('Inscription atelier'), crumb('Archives'), { during: async () => lit() });
check('depuis « Archives/2025 », le fil d\'Ariane propose « Archives » (en amont) et s\'éclaire', JSON.stringify(mid) === JSON.stringify(['chemin:Archives']), mid);
await settle();
check('le fichier est dans « Archives »', (await placeOf(1)) === 'Archives', await filing());
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. un dossier plein sur un autre, puis à la racine ; en vignettes aussi ===');
await crumb('').click();
await row('Archives').waitFor();
mid = await drag(row('Archives'), row('Contrats'), { during: async () => lit() });
check('le dossier « Archives » s\'éclaire sur « Contrats »', JSON.stringify(mid) === JSON.stringify(['dir:Contrats']), mid);
await settle();
check('« Archives » est dans « Contrats » avec son fichier et ses dossiers gardés (« Archives » et « 2025 » suivent)', (await placeOf(1)) === 'Contrats/Archives' && JSON.stringify(await keptFolders()) === JSON.stringify(['Contrats', 'Contrats/Archives', 'Contrats/Archives/2025']), { place: await placeOf(1), gardes: await keptFolders() });
check('la phrase nomme le dossier', await said(t('clip.moved', { name: 'Archives', folder: 'Contrats' })) === t('clip.moved', { name: 'Archives', folder: 'Contrats' }));
await quiet();
await frame.locator('.tb-group .tb').nth(1).click();
await tile('Contrats').waitFor();
mid = await drag(tile('Bilan'), tile('Contrats'), { during: async () => ({ lit: await lit(), drag: await tile('Bilan').getAttribute('draggable') }) });
check('en vignettes, la vignette du dossier s\'éclaire', JSON.stringify(mid.lit) === JSON.stringify(['dir:Contrats']) && mid.drag === 'true', mid);
await settle();
check('« Bilan » est dans « Contrats »', (await placeOf(3)) === 'Contrats', await filing());
await quiet();
await frame.locator('.tb-group .tb').nth(0).click();
await row('Contrats').waitFor();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. ce qui ne s\'accepte pas ===');
await row('Contrats').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('Contrats') }).waitFor();
const before = await writes();
mid = await drag(row('Bilan'), treeRow('Contrats'), { during: async () => lit() });
check('le dossier où est déjà la ligne ne s\'éclaire pas', mid.length === 0, mid);
await settle();
mid = await drag(row('Archives'), row('Archives'), { during: async () => lit() });
check('un dossier sur lui-même ne s\'éclaire pas', mid.length === 0, mid);
await settle();
mid = await drag(row('Archives'), treeRow('Contrats/Archives/2025'), { during: async () => lit() }).catch(() => []);
check('un dossier dans son sous-dossier ne s\'éclaire pas', !mid.includes('chemin:Contrats/Archives/2025'), mid);
await settle();
check('rien n\'a été écrit, rien n\'est resté éclairé ni effacé', (await writes()) === before && (await lit()).length === 0 && (await frame.locator('.is-dragging').count()) === 0, { avant: before, apres: await writes() });
await shot('5-refus');
await crumb('').click();
await frame.locator('.tr-row[data-view="trash"]').click();
await frame.locator('.crumbs .here').waitFor();
const inTrash = await frame.locator('.ls-row[data-key]').evaluateAll(nodes => nodes.map(node => node.draggable));
check('à la corbeille, aucune ligne ne se tient', inTrash.every(value => !value), inTrash);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
