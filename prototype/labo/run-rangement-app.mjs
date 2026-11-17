// Le rangement de Publipostage+ fait foi (choix du porteur, 17/11 : « les dossiers de GFS et ceux de Publipostage+ », l'app reste utilisable seule ; contrats 2.4 `rangement.ecriture`,
// 6.4 point 8), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright), avec Ana comme personne du moment (le moteur de Grist reçoit son adresse).
// Les écritures « de Publipostage+ » sont celles de `js/template-preferences.js` (`upsert` : AddRecord, UpdateRecord sur `Publipostage_PreferencesModeles`), jouées par la connexion de GFS :
// l'app elle-même n'est pas ouverte (sa lecture, `loadNow`, est relue dans `ppView`).
//   1. Les modèles qu'Ana a rangés dans Publipostage+ et un dossier vide qu'elle y garde (ligne d'état, `ModeleId = 0`) : GFS les montre.
//   2. « Nouveau dossier » dans GFS : une ligne d'état chez GFS et une chez l'app.
//   3. Un modèle déplacé dans GFS vers un nouveau dossier : la ligne de l'app le dit, GFS_Rangement n'a aucune ligne pour lui ; Publipostage+ le voit dans ce dossier.
//   4. Le même modèle déplacé ensuite dans Publipostage+ : GFS le montre dans le nouveau dossier (celui de l'app fait foi).
//   5. Ctrl+Z rend à l'app l'état d'avant.
//   6. Une ligne que GFS_Rangement avait pour un modèle (avant ce changement) passe chez l'app au premier rangement et part de GFS_Rangement.
//   7. Renommer un dossier plein : les lignes des modèles, chez l'app, suivent ; supprimer un dossier vide : ses lignes d'état partent des deux tables.
//   8. À la fin, chaque modèle est dans le même dossier pour GFS et pour la lecture de Publipostage+.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { explorerTools } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const ANA = { Email: 'ana@exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 };
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const FILING = 'GFS_Rangement';

const lab = await startLab({ lang, colorScheme: scheme, user: ANA });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
let frame = lab.frame;
// Le rangement d'Ana chez Publipostage+ : les lignes du semis sont à personne (commun), on les remplace par les siennes.
await frame.evaluate(async ([prefs, models, email]) => {
  const old = (await grist.docApi.fetchTable(prefs)).id;
  await grist.docApi.applyUserActions([['BulkRemoveRecord', prefs, old]]);
  const named = await grist.docApi.fetchTable(models);
  const idOf = name => named.id[named.Nom.indexOf(name)];
  await grist.docApi.applyUserActions([
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: idOf('Contrat de prestation'), Epingle: false, Dossier: 'Archives' }],
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: idOf('Facture / devis multi-TVA'), Epingle: true, Dossier: 'Archives' }],
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: 0, Dossier: 'Vide', Replie: false }],
    ['AddRecord', prefs, null, { Utilisateur: 'autre@exemple.org', ModeleId: idOf('Quittance de loyer'), Epingle: false, Dossier: 'Prive' }],
  ]);
}, [PREFS, MODELS, ANA.Email]);
// Un document où GFS range déjà : sa table existe (sans elle, GFS ne connaît pas l'adresse d'Ana et ne lit que le rangement commun), sans la colonne `Adresse` que la sonde ajoute.
await frame.evaluate(async filing => {
  const columns = ['Utilisateur', 'App', 'Fichier', 'Dossier', 'Valeur'].map(id => ({ id, type: 'Text' })).concat([{ id: 'Favori', type: 'Bool' }, { id: 'Replie', type: 'Bool' }]);
  await grist.docApi.applyUserActions([['AddTable', filing, columns]]);
}, FILING);
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }

const { row, folderRow, fileNames, folderNames, table, until } = explorerTools(() => frame, page);
const reopen = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const rows = async name => {
  const data = await table(name).catch(() => null);
  if (!data) return null;
  return data.id.map((id, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
};
const idOf = async name => { const data = await table(MODELS); return data.id[data.Nom.indexOf(name)]; };
const mine = list => (list || []).filter(line => line.Utilisateur === ANA.Email);
const prefsOf = async id => mine(await rows(PREFS)).filter(line => line.ModeleId === id);
const statesOf = async () => mine(await rows(PREFS)).filter(line => line.ModeleId === 0).map(line => line.Dossier).sort();
const gfsStates = async () => mine(await rows(FILING)).filter(line => !line.App && !line.Fichier && line.Dossier).map(line => line.Dossier).sort();
const gfsLines = async () => mine(await rows(FILING)).filter(line => line.App === 'publipostage');
// Ce que Publipostage+ lit (js/template-preferences.js, `loadNow` : la dernière ligne de chaque modèle fait foi) : { modèle: dossier }.
const ppView = async () => {
  const view = {};
  for (const line of mine(await rows(PREFS))) if (line.ModeleId !== 0) view[line.ModeleId] = (line.Dossier || '').split('/').map(part => part.trim()).filter(Boolean).join('/');
  return view;
};
const openMenu = async name => { await row(name).hover(); await row(name).locator('.rb.mn').click(); await frame.locator('.menu').waitFor(); };
const menuItem = re => frame.locator('.menu-item', { hasText: re });
const goHome = () => frame.locator('.tr-row', { hasText: /^\s*Moi|^\s*Me/ }).first().click().then(() => page.waitForTimeout(300));
const folderOf = async name => {
  await goHome();
  const found = [];
  for (const folder of await folderNames()) {
    await folderRow(folder).dblclick();
    await page.waitForTimeout(300);
    if ((await fileNames()).includes(name)) found.push(folder);
    await goHome();
  }
  return found.length ? found.join('+') : ((await fileNames()).includes(name) ? '(racine)' : '(introuvable)');
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

say('\n1. Ce qu\'Ana a rangé chez Publipostage+');
const contract = 'Contrat de prestation';
const contractId = await idOf(contract);
check('GFS montre les dossiers de l\'app, dont le dossier vide', same((await folderNames()).sort(), ['Archives', 'Vide']), await folderNames());
check('le contrat est dans « Archives » (le rangement de l\'app est le point de départ)', (await folderOf(contract)) === 'Archives', await folderOf(contract));

say('\n2. « Nouveau dossier » dans GFS');
await goHome();
await frame.getByRole('button', { name: /^Nouveau$/ }).click();
await frame.getByRole('menuitem', { name: /^Nouveau dossier/ }).click();
await frame.locator('#nw-title').waitFor();
await page.keyboard.type('Projets');
await page.keyboard.press('Enter');
await until(async () => (await folderNames()).includes('Projets'));
await page.waitForTimeout(600);
check('GFS_Rangement garde une ligne d\'état « Projets », à l\'adresse d\'Ana', (await gfsStates()).includes('Projets'), await gfsStates());
check('Publipostage+ a la même ligne d\'état (ModeleId 0), à l\'adresse d\'Ana, à côté de « Vide »', same(await statesOf(), ['Projets', 'Vide']), await statesOf());

say('\n3. Un modèle déplacé dans GFS');
const rent = 'Quittance de loyer';
const rentId = await idOf(rent);
await goHome();
await openMenu(rent);
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
await page.keyboard.type('Logement', { delay: 20 });
await page.keyboard.press('Enter');
await until(async () => (await folderNames()).includes('Logement'));
const rentLines = await prefsOf(rentId);
check('Publipostage+ a une ligne pour la quittance, à son nom, dans « Logement », pas épinglée', rentLines.length === 1 && rentLines[0].Dossier === 'Logement' && rentLines[0].Epingle === false, rentLines);
check('GFS_Rangement n\'a aucune ligne pour un modèle de Publipostage+', (await gfsLines()).length === 0, await gfsLines());
check('Publipostage+ voit la quittance dans « Logement »', (await ppView())[rentId] === 'Logement', await ppView());
check('la ligne de « Prive », celle d\'une autre personne, n\'a pas bougé', (await rows(PREFS)).some(line => line.Utilisateur === 'autre@exemple.org' && line.Dossier === 'Prive'));

say('\n4. Le même modèle déplacé ensuite dans Publipostage+');
await frame.evaluate(async ([prefs, id]) => {
  const data = await grist.docApi.fetchTable(prefs);
  const at = data.id.findIndex((rowId, i) => data.ModeleId[i] === id && data.Utilisateur[i] === 'ana@exemple.org');
  await grist.docApi.applyUserActions([['UpdateRecord', prefs, data.id[at], { Dossier: 'Contrats' }]]);
}, [PREFS, rentId]);
await reopen();
check('GFS montre la quittance dans « Contrats » : le rangement de l\'app fait foi, même après un geste dans GFS', (await folderOf(rent)) === 'Contrats', await folderOf(rent));

say('\n5. Ctrl+Z rend à l\'app l\'état d\'avant');
await goHome();
await folderRow('Archives').dblclick();
await page.waitForTimeout(300);
await openMenu(contract);
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
await frame.locator('.mv .wk-item', { has: frame.locator('.wk-name', { hasText: /^Projets$/ }) }).click();
await until(async () => (await prefsOf(contractId)).some(line => line.Dossier === 'Projets'));
check('le contrat est dans « Projets » chez l\'app', same((await prefsOf(contractId)).map(line => line.Dossier), ['Projets']), await prefsOf(contractId));
await page.keyboard.press('Control+z');
const back = await until(async () => (await prefsOf(contractId)).some(line => line.Dossier === 'Archives'));
check('Ctrl+Z : la ligne de l\'app redit « Archives »', back, await prefsOf(contractId));

say('\n6. Ce que GFS_Rangement disait avant passe chez l\'app');
const support = 'Support de session';
const supportId = await idOf(support);
await frame.evaluate(async ([filing, id, email]) => {
  await grist.docApi.applyUserActions([['AddRecord', filing, null, { Utilisateur: email, App: 'publipostage', Fichier: String(id), Favori: true, Dossier: 'Ancien' }]]);
}, [FILING, supportId, ANA.Email]);
await reopen();
check('avant tout rangement, GFS montre encore le modèle dans « Ancien » (repli sur sa ligne)', (await folderOf(support)) === 'Ancien', await folderOf(support));
await goHome();
await openMenu('Badge événement A6');
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
await frame.locator('.mv .wk-item', { has: frame.locator('.wk-name', { hasText: /^Projets$/ }) }).click();
await until(async () => (await prefsOf(supportId)).length > 0);
const carried = await prefsOf(supportId);
check('au premier rangement, la ligne de GFS passe chez l\'app : dossier « Ancien », favori', carried.length === 1 && carried[0].Dossier === 'Ancien' && carried[0].Epingle === true, carried);
check('et part de GFS_Rangement', (await gfsLines()).length === 0, await gfsLines());
await reopen();
check('GFS montre toujours le modèle dans « Ancien »', (await folderOf(support)) === 'Ancien', await folderOf(support));

say('\n7. Renommer un dossier plein, supprimer un dossier vide');
await goHome();
await folderRow('Archives').hover();
await folderRow('Archives').locator('.rb.mn').click();
await frame.locator('.menu').waitFor();
await menuItem(/Renommer|Rename/).click();
await frame.locator('.nw').waitFor();
await page.keyboard.press('Control+a');
await page.keyboard.type('Classés');
await page.keyboard.press('Enter');
await until(async () => (await folderNames()).includes('Classés'));
const view = await ppView();
check('les modèles de « Archives » sont dans « Classés » chez l\'app (leurs lignes à elle)', view[contractId] === 'Classés' && view[await idOf('Facture / devis multi-TVA')] === 'Classés', view);
await folderRow('Vide').hover();
await folderRow('Vide').locator('.rb.mn').click();
await frame.locator('.menu').waitFor();
await menuItem(/Supprimer|Delete/).click();
await until(async () => !(await folderNames()).includes('Vide'));
check('le dossier vide est supprimé : ses lignes d\'état partent des deux tables', !(await statesOf()).includes('Vide') && !(await gfsStates()).includes('Vide'), { app: await statesOf(), gfs: await gfsStates() });

say('\n8. Les deux listes sont les mêmes');
await reopen();
const final = await ppView();
const mismatches = [];
for (const [name, id] of [[contract, contractId], [rent, rentId], [support, supportId], ['Facture / devis multi-TVA', await idOf('Facture / devis multi-TVA')]]) {
  const shown = await folderOf(name);
  if (shown !== (final[id] || '(racine)')) mismatches.push({ name, gfs: shown, pp: final[id] || '(racine)' });
}
check('pour chaque modèle rangé, le dossier de GFS est celui que Publipostage+ lit', mismatches.length === 0, mismatches);
check('la console de GFS est restée muette', warnings.length === 0, warnings);
await lab.browser.close();
