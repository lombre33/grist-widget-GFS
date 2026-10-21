// Épingler, ranger et renommer depuis l'explorateur de GFS (contrats 6.4 ; choix du porteur du 21/10 : GFS le fait, le nom seul dans la table de l'app), dans un vrai
// Grist, à 700 × 400, à la vraie souris et au vrai clavier (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent).
//   1. L'étoile sans la table : la question ; « Annuler » ne crée rien ; « Créer la table » crée `GFS_Rangement` et la ligne du fichier ; le rangement de l'app ne bouge pas.
//   2. Retirer le favori au clavier, par le menu de la ligne : le clavier reste sur la ligne.
//   3. Déplacer un fichier vers un nouveau dossier (la recherche, Entrée), puis vers un dossier existant (la souris).
//   4. Renommer un dossier (un nom vide, ou celui d'un dossier voisin, est refusé dans la fenêtre), puis le déplacer : ni lui ni ses sous-dossiers ne sont proposés.
//   5. Renommer un fichier : un nom pris est refusé ; le nom seul, dans la table de l'app ; ses autres colonnes ne bougent pas.
//   6. Dupliquer reste grisé et dit pourquoi ; Échap et un clic hors de la fenêtre ferment sans rien écrire, l'explorateur reste ouvert.
//   7. Renommer un modèle que Publipostage+ tient ouvert, puis l'enregistrer dans l'app : il garde le nom donné dans GFS (l'app ne remet jamais l'ancien, consigne 029 ;
//      avec l'app à `2f6440a`, cette vérification échoue : l'ancien nom revient).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `ranger-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
say('panneau :', await (await frame.frameElement()).boundingBox());

const shot = name => lab.shotPanel(run, name, frame);
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const folderRow = name => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
const fileNames = () => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const folderNames = () => frame.locator('.ls-row.folder .t').allInnerTexts();
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()) : '');
const starOn = async name => (await row(name).locator('.rb.pin').getAttribute('class')).includes(' on');
const favCount = async () => Number(await frame.locator('.tr-row[data-view="fav"] .cnt').innerText());
const menuItem = re => frame.locator('.menu-item', { hasText: re });
const openRowMenu = async locator => { await locator.hover(); await locator.locator('.rb.mn').click(); await frame.locator('.menu').waitFor(); };
// Les lignes de rangement de GFS (sans la ligne réservée), et les tables de Publipostage+, lues par la connexion de GFS.
const gfsLines = async () => { const state = await lab.rangement(frame); return state.table ? state.lines.filter(line => !String(line.Utilisateur).startsWith('@')) : null; };
const lineOf = async id => ((await gfsLines()) || []).find(line => line.App === 'publipostage' && line.Fichier === id) || null;
const table = name => frame.evaluate(name => grist.docApi.fetchTable(name), name);
const idOf = async name => { const data = await table('Publipostage_Modeles'); return String(data.id[data.Nom.indexOf(name)]); };
// L'explorateur se relit après chaque geste : on attend ce que le geste doit montrer, jamais plus de huit secondes.
const until = async (probe, timeout = 8000) => {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(150); }
  return value;
};

// ----- 1. L'étoile sans la table.
say('\n1. Épingler sans la table');
const contract = 'Contrat de prestation';
const contractId = await idOf(contract);
const prefsBefore = JSON.stringify(await table('Publipostage_PreferencesModeles'));
const start = await lab.rangement(frame);
check('au départ, le document n\'a pas de table GFS_Rangement', start.table === false, start);
const hint = (await frame.locator('.ex-info').innerText()).replace(/\s+/g, ' ');
check('la barre du bas dit le rangement commun au document (GFS ne sait pas encore qui est la personne)', /commun au document|shared by the whole document/.test(hint), hint);
const favStart = await favCount();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await frame.locator('.ask').waitFor({ timeout: 5000 });
const question = (await frame.locator('.ask').innerText()).replace(/\s+/g, ' ');
await shot('1-question-table');
check('l\'étoile demande d\'abord de créer la table, et dit qu\'elle sert au rangement', /GFS_Rangement/.test(question) && /rangement de ses fichiers|how its files are filed/.test(question), question);
await frame.locator('[data-fk="ask-no"]').click();
await page.waitForTimeout(400);
const declined = await toast();
check('« Annuler » : aucune table, l\'étoile reste éteinte, la personne lit pourquoi', (await lab.rangement(frame)).table === false && !(await starOn(contract)) && /Rien n’a été rangé|Nothing was filed/.test(declined), declined);
await row(contract).locator('.rb.pin').click();
await frame.locator('.ask').waitFor({ timeout: 5000 });
const clicked = Date.now();
await frame.locator('[data-fk="ask-yes"]').click();
const lit = await until(() => starOn(contract));
say('de « Créer la table » à l\'étoile allumée (ms) :', Date.now() - clicked);
const rebuilt = frame.isDetached();
check('le cadre de GFS n\'est pas reconstruit par la création de la table', !rebuilt);
if (rebuilt) { frame = await lab.gfsFrame(/access=full/); await lab.gfsReady(frame); }
const pinned = await lineOf(contractId);
check('« Créer la table » : la table naît avec la ligne du fichier (personne vide : commun), favori, sans dossier', Boolean(pinned) && pinned.Utilisateur === '' && pinned.Favori === true && pinned.Dossier === '', pinned);
check('l\'étoile est allumée et le compteur des favoris monte d\'un', lit && (await favCount()) === favStart + 1, { avant: favStart, apres: await favCount() });
check('le rangement propre de Publipostage+ n\'a pas bougé', JSON.stringify(await table('Publipostage_PreferencesModeles')) === prefsBefore);
await shot('2-favori');

// ----- 2. Retirer le favori au clavier.
say('\n2. Retirer le favori au clavier');
await row(contract).click();
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
const moreLabel = await frame.evaluate(() => document.activeElement.getAttribute('aria-label'));
await page.keyboard.press('Enter');
await frame.locator('.menu').waitFor();
await page.keyboard.press('ArrowDown');
const chosen = await frame.evaluate(() => document.activeElement.textContent.trim());
await page.keyboard.press('Enter');
const off = await until(async () => !(await starOn(contract)));
const keyAfter = await frame.evaluate(() => { const node = document.activeElement && document.activeElement.closest('[data-key]'); return node ? node.dataset.key : (document.activeElement || {}).tagName; });
check('Tab, Tab mène à « Plus d\'actions », la flèche à « Retirer des favoris »', /Plus d’actions|More actions/.test(moreLabel) && /Retirer des favoris|Remove from favorites/.test(chosen), { moreLabel, chosen });
check('Entrée : l\'étoile s\'éteint, la ligne de GFS dit « pas favori »', off && (await lineOf(contractId)).Favori === false, await lineOf(contractId));
check('le clavier reste sur la ligne du fichier, la liste relue', keyAfter === `publipostage:${contractId}`, keyAfter);

// ----- 3. Déplacer un fichier.
say('\n3. Déplacer un fichier');
const rent = 'Quittance de loyer';
const rentId = await idOf(rent);
await openRowMenu(row(rent));
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
const inSearch = await frame.evaluate(() => document.activeElement.dataset.fk);
const offeredAll = await frame.locator('.mv .wk-name').allInnerTexts();
await shot('3-deplacer');
check('la fenêtre « Déplacer » s\'ouvre, le clavier dans sa recherche', inSearch === 'move-search', inSearch);
check('elle propose la racine et chaque dossier, parents compris', ['Moi', 'Me'].includes(offeredAll[0]) && ['Formation', 'Formation / Archives 2025', 'Stock', 'Facturation'].every(name => offeredAll.includes(name)), offeredAll);
await page.keyboard.type('Logement', { delay: 20 });
const offeredNew = await frame.locator('.mv .wk-name').allInnerTexts();
await shot('4-nouveau-dossier');
check('un nom qu\'aucun dossier ne porte devient « Nouveau dossier », seul proposé', offeredNew.length === 1 && /Nouveau dossier « Logement »|New folder “Logement”/.test(offeredNew[0]), offeredNew);
await page.keyboard.press('Enter');
const movedNew = await until(async () => (await folderNames()).includes('Logement') && !(await fileNames()).includes(rent));
check('Entrée : le fichier quitte la racine, le dossier « Logement » y apparaît', movedNew, { dossiers: await folderNames(), fichiers: await fileNames() });
check('la ligne de GFS du fichier dit « Logement »', (await lineOf(rentId) || {}).Dossier === 'Logement', await lineOf(rentId));
await openRowMenu(row(contract));
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
await frame.locator('.mv .wk-item', { has: frame.locator('.wk-name', { hasText: /^Stock$/ }) }).click();
const movedStock = await until(async () => !(await fileNames()).includes(contract));
check('à la souris, vers « Stock » : le fichier quitte la racine, sa ligne dit « Stock », toujours pas favori', movedStock && (await lineOf(contractId)).Dossier === 'Stock' && (await lineOf(contractId)).Favori === false, await lineOf(contractId));

// ----- 4. Renommer, puis déplacer un dossier.
say('\n4. Renommer et déplacer un dossier');
await openRowMenu(folderRow('Logement'));
await menuItem(/Renommer|Rename/).click();
await frame.locator('.nw').waitFor();
const field = await frame.evaluate(() => { const input = document.querySelector('#nw-input'); return { value: input.value, from: input.selectionStart, to: input.selectionEnd, focused: document.activeElement === input }; });
check('« Renommer » montre le nom du dossier, tout sélectionné, le clavier dedans', field.value === 'Logement' && field.from === 0 && field.to === 8 && field.focused, field);
await page.keyboard.press('Backspace');
await page.keyboard.press('Enter');
const emptyNote = await frame.locator('.nw-note').innerText();
await shot('5-nom-vide');
check('un nom vide est refusé : la fenêtre reste et dit pourquoi', /ne peut pas être vide|cannot be empty/.test(emptyNote) && (await frame.locator('.nw').count()) === 1, emptyNote);
await page.keyboard.type('stock', { delay: 20 });
await page.keyboard.press('Enter');
const takenFolder = await frame.locator('.nw-note').innerText();
check('le nom d\'un dossier voisin (« Stock », casse ignorée) est refusé de même', /porte déjà ce nom à cet endroit|already has this name/.test(takenFolder) && (await frame.locator('.nw').count()) === 1, takenFolder);
await page.keyboard.press('Control+A');
await page.keyboard.type('Habitat / 2026', { delay: 20 });
await page.keyboard.press('Enter');
const renamed = await until(async () => (await folderNames()).includes('Habitat 2026') && !(await folderNames()).includes('Logement'));
check('Entrée : le dossier devient « Habitat 2026 » (une « / » ne coupe pas un nom de dossier), sa ligne suit', renamed && (await lineOf(rentId)).Dossier === 'Habitat 2026', await lineOf(rentId));
await openRowMenu(folderRow('Habitat 2026'));
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
const offeredFolder = await frame.locator('.mv .wk-name').allInnerTexts();
check('déplacer un dossier : il n\'est pas proposé, la racine où il est porte la coche', !offeredFolder.includes('Habitat 2026') && (await frame.locator('.mv .wk-item[aria-current="true"]').innerText()).trim().match(/^(Moi|Me)$/), offeredFolder);
await frame.locator('.mv .wk-item', { has: frame.locator('.wk-name', { hasText: /^Stock$/ }) }).click();
const folderMoved = await until(async () => !(await folderNames()).includes('Habitat 2026'));
check('vers « Stock » : il quitte la racine, son fichier est dans « Stock/Habitat 2026 »', folderMoved && (await lineOf(rentId)).Dossier === 'Stock/Habitat 2026', await lineOf(rentId));
await folderRow('Stock').dblclick();
await page.waitForTimeout(300);
check('dans « Stock », le dossier « Habitat 2026 » et le contrat', (await folderNames()).includes('Habitat 2026') && (await fileNames()).includes(contract), { dossiers: await folderNames(), fichiers: await fileNames() });
await shot('6-dans-stock');

// ----- 5. Renommer un fichier.
say('\n5. Renommer un fichier');
const modelsBefore = await table('Publipostage_Modeles');
const at = modelsBefore.Nom.indexOf(contract);
const gfsBefore = JSON.stringify(await gfsLines());
await openRowMenu(row(contract));
await menuItem(/Renommer|Rename/).click();
await frame.locator('.nw').waitFor();
await shot('7-renommer');
await page.keyboard.type('bon de commande fournisseur ', { delay: 10 });
await page.keyboard.press('Enter');
const takenFile = await frame.locator('.nw-note').innerText();
await shot('7b-nom-pris');
check('le nom d\'un autre modèle (casse et espaces ignorés, la règle de Publipostage+) est refusé dans la fenêtre, rien n\'est écrit', /porte déjà ce nom|already has this name/.test(takenFile)
  && (await frame.locator('.nw').count()) === 1 && JSON.stringify((await table('Publipostage_Modeles')).Nom) === JSON.stringify(modelsBefore.Nom), takenFile);
await page.keyboard.press('Control+A');
await page.keyboard.type(`${contract} 2026`, { delay: 10 });
await page.keyboard.press('Enter');
const newName = `${contract} 2026`;
const shown = await until(async () => (await fileNames()).includes(newName));
const modelsAfter = await table('Publipostage_Modeles');
const changed = Object.keys(modelsBefore).filter(column => JSON.stringify(modelsBefore[column]) !== JSON.stringify(modelsAfter[column]));
check('le nouveau nom est dans la liste', shown, await fileNames());
check('dans la table de Publipostage+, seule la colonne du nom change, sur la ligne du fichier', JSON.stringify(changed) === '["Nom"]' && modelsAfter.Nom[at] === newName
  && modelsAfter.Nom.filter((name, i) => i !== at).join('|') === modelsBefore.Nom.filter((name, i) => i !== at).join('|'), changed);
check('le rangement de GFS n\'a pas bougé', JSON.stringify(await gfsLines()) === gfsBefore);

// ----- 6. Grisé, Échap, clic dehors.
say('\n6. Grisé, Échap, clic dehors');
await openRowMenu(row(newName));
// Un article grisé reste cliquable (il explique) : le geste est forcé, mais c'est toujours la vraie souris.
await menuItem(/Dupliquer|Duplicate/).click({ force: true });
await page.waitForTimeout(200);
const appOnly = await toast();
await shot('8-grise');
check('« Dupliquer » reste grisé et dit que l\'app le fait', /se font dans Publipostage\+|are done in Publipostage\+/.test(appOnly), appOnly);
const lines = JSON.stringify(await gfsLines());
await openRowMenu(row(newName));
await menuItem(/Renommer|Rename/).click();
await frame.locator('.nw').waitFor();
await page.keyboard.type('Autre nom');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Échap ferme « Renommer » sans rien écrire ; l\'explorateur reste ouvert', (await frame.locator('.nw').count()) === 0 && (await fileNames()).includes(newName) && (await frame.locator('.ex').isVisible()));
await openRowMenu(row(newName));
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
const scrim = await frame.locator('.mod-scrim').boundingBox();
await page.mouse.click(scrim.x + 4, scrim.y + 4);
await page.waitForTimeout(300);
check('un clic hors de la fenêtre la ferme sans rien écrire', (await frame.locator('.mv').count()) === 0 && JSON.stringify(await gfsLines()) === lines);

// ----- 7. Renommer un modèle que Publipostage+ tient ouvert : l'app ne doit jamais remettre l'ancien nom (guide des apps 1.2, point 10 ; consigne 029).
say('\n7. Renommer un modèle ouvert dans l\'app');
const nameOf = async id => { const data = await table('Publipostage_Modeles'); const i = data.id.map(String).indexOf(id); return { nom: data.Nom[i], date: String(data.DateModif[i]) }; };
await row(newName).dblclick();
const app = await lab.appFrame(/\/apps\/publipostage\//);
await app.waitForFunction(name => { const status = document.getElementById('status-msg'); const input = document.getElementById('template-name'); return Boolean(status && status.textContent) && Boolean(input) && input.value === name; },
  newName, { timeout: 30000 });
await page.waitForTimeout(800);
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
const givenInGfs = `${contract} (GFS)`;
await openRowMenu(row(newName));
await menuItem(/Renommer|Rename/).click();
await frame.locator('.nw').waitFor();
await page.keyboard.press('Control+A');
await page.keyboard.type(givenInGfs, { delay: 10 });
await page.keyboard.press('Enter');
await until(async () => (await fileNames()).includes(givenInGfs));
const whileOpen = await nameOf(contractId);
check('l\'app ouverte sur le modèle, « Fichiers » puis « Renommer » : la table a le nom donné dans GFS', whileOpen.nom === givenInGfs, whileOpen);
// Retour à l'app par le double-clic : le modèle est déjà ouvert, l'explorateur se ferme. Une lettre tapée, puis « Enregistrer » à la souris.
await row(givenInGfs).dblclick();
await page.waitForTimeout(800);
say('le nom que l\'app montre au retour :', await app.evaluate(() => document.getElementById('template-name').value));
const paragraph = await app.locator('.ProseMirror p').first().boundingBox();
await page.mouse.click(paragraph.x + Math.min(40, paragraph.width / 2), paragraph.y + paragraph.height / 2);
await page.keyboard.type(' x', { delay: 20 });
await app.locator('#btn-save').click();
const saved = await until(async () => { const now = await nameOf(contractId); return now.date !== whileOpen.date ? now : false; }, 15000);
await shot('9-renomme-ouvert');
check('enregistré ensuite dans l\'app, le modèle garde le nom donné dans GFS : l\'app ne remet pas l\'ancien', Boolean(saved) && saved.nom === givenInGfs, saved || await nameOf(contractId));
check('aucun avertissement de GFS, aucune erreur de script', warnings.length === 0, warnings);
await lab.browser.close();
