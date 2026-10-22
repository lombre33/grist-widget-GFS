// L'adresse de la personne (contrats 6.4, point 6 ; choix du porteur du 22/10 : « À toi seul »), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier
// (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent).
// grist-static ouvre le document sans compte (`user.Email` y rend None) : le labo donne au moteur de données de Grist la personne du moment, et seulement elle (lab-common.mjs, `lab.setUser`).
// La formule déclenchée, le moteur, les actions sont ceux de Grist ; ce que le moteur a reçu se compte (`lab.actions()`).
//   1. Ana, sans la table : rien n'est écrit à l'ouverture ; l'étoile demande la table (l'adresse est dite dans la question) ; la table naît, la sonde passe, la ligne d'Ana est à son adresse.
//   2. Ana rouvre : une sonde par ouverture, ajoutée puis retirée ; un geste de plus n'en refait pas.
//   3. Ben ouvre le même document : il ne voit rien d'Ana ; ses favoris et ses dossiers sont à lui, la ligne d'Ana ne bouge pas.
//   4. Ana revient : ses favoris, pas ceux de Ben.
//   5. Les favoris et dossiers qu'une personne a dans Publipostage+ (rangement propre de l'app, par adresse) apparaissent aussi dans GFS.
//   6. Une table d'avant (sans la colonne `Adresse`) la reçoit, à formule déclenchée, avant la sonde.
//   7. Une personne que Grist ne connaît pas (l'anonyme de Grist, ou aucune adresse) : rangement commun au document, comme avant.
//   8. Document en lecture seule : aucune écriture du tout, pas de sonde ; épingler dit pourquoi.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `identite-${lang}-${scheme}`;
const ANA = { Email: 'ana@exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 };
const BEN = { Email: 'ben@exemple.org', Name: 'Ben', IsLoggedIn: true, UserID: 102 };
const ANONYMOUS = { Email: 'anon@getgrist.com', Name: 'Anonymous', IsLoggedIn: false, UserID: null };

const lab = await startLab({ lang, colorScheme: scheme, user: ANA });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));

let frame = lab.frame;
// Une ouverture du document par une personne : le widget se recharge, comme quand Grist l'ouvre pour quelqu'un d'autre. `query` : des paramètres de plus à l'adresse du widget.
const open = async (who, { query = '' } = {}) => {
  await lab.setUser(who);
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
  if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
};
const shot = name => lab.shotPanel(run, name, frame);
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const folderRow = name => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
const fileNames = () => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const folderNames = () => frame.locator('.ls-row.folder .t').allInnerTexts();
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()) : '');
const starOn = async name => (await row(name).locator('.rb.pin').getAttribute('class')).includes(' on');
const favCount = async () => Number(await frame.locator('.tr-row[data-view="fav"] .cnt').innerText());
const info = async () => (await frame.locator('.ex-info').innerText()).replace(/\s+/g, ' ');
const menuItem = re => frame.locator('.menu-item', { hasText: re });
const openRowMenu = async locator => { await locator.hover(); await locator.locator('.rb.mn').click(); await frame.locator('.menu').waitFor(); };
const table = name => frame.evaluate(name => grist.docApi.fetchTable(name), name);
const idOf = async name => { const data = await table('Publipostage_Modeles'); return String(data.id[data.Nom.indexOf(name)]); };
const until = async (probe, timeout = 8000) => {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(150); }
  return value;
};
// Les lignes de rangement de GFS (la ligne réservée et une sonde oubliée comprises : `all`), lues par la connexion de GFS.
const lines = async ({ all = false } = {}) => {
  const state = await lab.rangement(frame);
  if (!state.table) return null;
  return all ? state.lines : state.lines.filter(line => !String(line.Utilisateur).startsWith('@'));
};
const linesOf = async who => ((await lines()) || []).filter(line => line.Utilisateur === who);
// Ce que le moteur a reçu qui touche la table de GFS : « Verbe Table [Utilisateur] ».
const gfsActions = async () => (await lab.actions()).filter(action => / GFS_Rangement/.test(action));
const SONDE = 'AddRecord GFS_Rangement [@sonde]';
const COLUMN = name => frame.evaluate(async name => {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const at = tables.tableId.indexOf('GFS_Rangement');
  const i = columns.colId.findIndex((colId, k) => colId === name && columns.parentId[k] === tables.id[at]);
  return i < 0 ? null : { type: columns.type[i], isFormula: columns.isFormula[i], formula: columns.formula[i], recalcWhen: columns.recalcWhen[i], recalcDeps: columns.recalcDeps[i] };
}, name);

const contract = 'Contrat de prestation';
const rent = 'Quittance de loyer';
const contractId = await idOf(contract);
const rentId = await idOf(rent);
const FAV_HINT = /le tien seulement|yours only/;
const PERSONAL = /Rangement personnel|Personal folders/;
const SHARED = /Rangement commun au document|Folders shared by the whole document/;

// ----- 1. Ana, sans la table.
say('\n1. Ana ouvre un document sans la table');
await open(ANA);
check('au départ, le document n\'a pas de table GFS_Rangement', (await lab.rangement(frame)).table === false);
check('à l\'ouverture, GFS n\'écrit rien : pas de table, donc pas de sonde (la sonde ne crée jamais la table)', (await lab.actions()).length === 0, await lab.actions());
const startInfo = await info();
check('la barre du bas dit le rangement commun au document : GFS ne connaît pas encore la personne', SHARED.test(startInfo), startInfo);
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await frame.locator('.ask').waitFor({ timeout: 5000 });
const question = (await frame.locator('.ask').innerText()).replace(/\s+/g, ' ');
await shot('1-question-table');
check('l\'étoile demande de créer la table, et dit que GFS y lit l\'adresse de la personne (une ligne ajoutée puis retirée)',
  /GFS_Rangement/.test(question) && /l’adresse de la personne|the person’s address/.test(question) && /ajoutée puis retirée|added and removed/.test(question), question);
const tooTall = await frame.locator('.ask').evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight, inside: el.getBoundingClientRect().bottom <= window.innerHeight }));
check('la question tient dans le panneau de 700 × 400', tooTall.inside, tooTall);
await frame.locator('[data-fk="ask-yes"]').click();
const lit = await until(() => starOn(contract), 20000);
check('l\'étoile s\'allume après « Créer la table »', Boolean(lit));
const sequence = await gfsActions();
check('le moteur reçoit, dans l\'ordre : la table, la sonde, son retrait, puis la ligne d\'Ana à son adresse',
  JSON.stringify(sequence) === JSON.stringify(['AddTable GFS_Rangement', SONDE, 'RemoveRecord GFS_Rangement', `AddRecord GFS_Rangement [${ANA.Email}]`]), sequence);
const adresse = await COLUMN('Adresse');
check('la colonne Adresse est une formule déclenchée : à la création d\'une ligne seulement, `user.Email` pour la ligne-sonde', adresse && adresse.type === 'Text' && adresse.isFormula === false
  && /user\.Email/.test(adresse.formula) && /@sonde/.test(adresse.formula) && adresse.recalcWhen === 0 && !adresse.recalcDeps, adresse);
const first = await lines({ all: true });
check('la ligne d\'Ana est à son adresse, favori, sans dossier ; plus aucune ligne-sonde', first.length === 1 && first[0].Utilisateur === ANA.Email && first[0].App === 'publipostage'
  && first[0].Fichier === contractId && first[0].Favori === true && first[0].Dossier === '', first);
check('Grist n\'a rien inscrit dans Adresse pour la ligne d\'Ana (seule la ligne-sonde en reçoit, et elle est partie)', first.every(line => !line.Adresse), first);
const learned = await info();
check('GFS connaît Ana : la barre du bas dit « personnel » et « le tien seulement », la liste est relue pour elle', PERSONAL.test(learned) && FAV_HINT.test(learned) && (await favCount()) === 1, learned);
await shot('2-personnel');

// ----- 2. Ana rouvre : une sonde par ouverture.
say('\n2. Ana rouvre le document');
await open(ANA);
const reopened = await gfsActions();
check('à l\'ouverture, une seule sonde : ajoutée puis retirée, rien d\'autre n\'est écrit', JSON.stringify(reopened) === JSON.stringify([SONDE, 'RemoveRecord GFS_Rangement']) && (await lab.actions()).length === 2, await lab.actions());
check('le favori d\'Ana est allumé dès l\'ouverture, la barre du bas dit « personnel »', (await starOn(contract)) && PERSONAL.test(await info()), await info());
await lab.forgetActions();
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
const off = await until(async () => !(await starOn(contract)));
const gesture = await lab.actions();
check('un geste de plus ne refait pas la sonde : une seule écriture, la mise à jour de la ligne d\'Ana', off && JSON.stringify(gesture) === JSON.stringify(['UpdateRecord GFS_Rangement']), gesture);
await row(contract).locator('.rb.pin').click();
await until(() => starOn(contract));
const timings = await frame.evaluate(async () => {
  const ms = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const added = await grist.docApi.applyUserActions([['AddRecord', 'GFS_Rangement', null, { Utilisateur: '@sonde' }]]);
    await grist.docApi.fetchTable('GFS_Rangement');
    await grist.docApi.applyUserActions([['RemoveRecord', 'GFS_Rangement', added.retValues[0]]]);
    ms.push(Math.round(performance.now() - start));
  }
  return ms;
});
say('coût d\'une sonde, lecture de la table comprise (ms) :', timings);

// ----- 3. Ben ouvre le même document.
say('\n3. Ben ouvre le même document');
const anaBefore = JSON.stringify(await linesOf(ANA.Email));
await open(BEN);
check('à l\'ouverture de Ben, une seule sonde', JSON.stringify(await gfsActions()) === JSON.stringify([SONDE, 'RemoveRecord GFS_Rangement']), await lab.actions());
check('Ben ne voit pas le favori d\'Ana : l\'étoile est éteinte, aucun favori', !(await starOn(contract)) && (await favCount()) === 0);
check('la barre du bas dit « personnel » pour Ben aussi', PERSONAL.test(await info()), await info());
await row(rent).hover();
await row(rent).locator('.rb.pin').click();
check('Ben épingle un fichier : la table existe, aucune question', (await until(() => starOn(rent))) && (await frame.locator('.ask').count()) === 0);
await openRowMenu(row(rent));
await menuItem(/Déplacer|Move/).click();
await frame.locator('.mv').waitFor();
await page.keyboard.type('Dossier de Ben', { delay: 20 });
await shot('3-ben-nouveau-dossier');
await page.keyboard.press('Enter');
const benMoved = await until(async () => (await folderNames()).includes('Dossier de Ben') && !(await fileNames()).includes(rent));
check('Ben range ce fichier dans un nouveau dossier : il le voit, à la racine', benMoved, { dossiers: await folderNames(), fichiers: await fileNames() });
const bens = await linesOf(BEN.Email);
check('la ligne de Ben est à son adresse : favori et dossier', bens.length === 1 && bens[0].Fichier === rentId && bens[0].Favori === true && bens[0].Dossier === 'Dossier de Ben', bens);
check('la ligne d\'Ana n\'a pas bougé', JSON.stringify(await linesOf(ANA.Email)) === anaBefore);
check('aucune ligne-sonde ne reste dans la table, aucune ligne sans personne', (await lines({ all: true })).every(line => line.Utilisateur !== '@sonde' && line.Utilisateur !== ''));
await shot('4-ben');

// ----- 4. Ana revient.
say('\n4. Ana revient');
await open(ANA);
check('Ana retrouve son favori', await starOn(contract));
check('elle ne voit ni le dossier de Ben, ni son favori : le fichier de Ben est à la racine, éteint', !(await folderNames()).includes('Dossier de Ben') && (await fileNames()).includes(rent) && !(await starOn(rent)) && (await favCount()) === 1,
  { dossiers: await folderNames(), favoris: await favCount() });

// ----- 5. Le rangement propre de Publipostage+ (par adresse) apparaît aussi dans GFS.
say('\n5. Les favoris et dossiers de Publipostage+');
const marking = 'Fiche d’inventaire';
const badge = 'Badge événement A6';
const markingId = await idOf(marking);
const badgeId = await idOf(badge);
const before = await table('Publipostage_PreferencesModeles');
await frame.evaluate(async ({ ana, ben, markingId, badgeId }) => {
  await grist.docApi.applyUserActions([
    ['AddRecord', 'Publipostage_PreferencesModeles', null, { Utilisateur: ana, ModeleId: Number(markingId), Epingle: true, Dossier: 'Mes modèles', Replie: false }],
    ['AddRecord', 'Publipostage_PreferencesModeles', null, { Utilisateur: ben, ModeleId: Number(badgeId), Epingle: true, Dossier: 'Ceux de Ben', Replie: false }],
  ]);
}, { ana: ANA.Email, ben: BEN.Email, markingId, badgeId });
await open(ANA);
check('Ana voit, dans GFS, le fichier qu\'elle a épinglé et rangé dans Publipostage+ : favori allumé, dans son dossier', (await folderNames()).includes('Mes modèles') && !(await folderNames()).includes('Ceux de Ben') && (await favCount()) === 2,
  { dossiers: await folderNames(), favoris: await favCount() });
await folderRow('Mes modèles').dblclick();
await page.waitForTimeout(300);
check('le dossier « Mes modèles » contient ce fichier, étoile allumée', (await fileNames()).includes(marking) && (await starOn(marking)), { fichiers: await fileNames() });
await shot('5-rangement-de-publipostage');
check('GFS n\'a rien écrit dans le rangement de Publipostage+', JSON.stringify((await table('Publipostage_PreferencesModeles')).Utilisateur.length) === JSON.stringify(before.Utilisateur.length + 2));

// ----- 6. Une table d'avant, sans la colonne Adresse.
say('\n6. Une table d\'avant, sans la colonne Adresse');
await frame.evaluate(() => grist.docApi.applyUserActions([['RemoveColumn', 'GFS_Rangement', 'Adresse']]));
check('au départ, la colonne Adresse n\'y est plus', (await COLUMN('Adresse')) === null);
await open(ANA);
const oldTable = await gfsActions();
check('à l\'ouverture, la colonne est ajoutée avant la sonde, qui passe', JSON.stringify(oldTable) === JSON.stringify(['AddColumn GFS_Rangement', SONDE, 'RemoveRecord GFS_Rangement']), oldTable);
const back = await COLUMN('Adresse');
check('la colonne est revenue à formule déclenchée', back && back.isFormula === false && /user\.Email/.test(back.formula) && back.recalcWhen === 0, back);
check('Ana est reconnue : son favori, la barre du bas « personnel »', (await starOn(contract)) && PERSONAL.test(await info()));

// ----- 7. Une personne que Grist ne connaît pas.
say('\n7. Une personne que Grist ne connaît pas');
for (const [label, who] of [['l\'anonyme de Grist', ANONYMOUS], ['aucune adresse', null]]) {
  await open(who);
  check(`${label} : une sonde, qui ne donne aucune adresse`, JSON.stringify(await gfsActions()) === JSON.stringify([SONDE, 'RemoveRecord GFS_Rangement']), await lab.actions());
  const hint = await info();
  check(`${label} : la barre du bas dit le rangement commun au document ; les lignes d'Ana et de Ben ne sont pas à elle`, SHARED.test(hint) && !(await starOn(contract)), hint);
}
await shot('6-commun');
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await until(() => starOn(contract));
check('épingler y range dans le rangement commun : la ligne est sans personne, comme avant l\'adresse', (await linesOf('')).length === 1 && (await linesOf('')).every(line => line.Fichier === contractId && line.Favori === true), await lines());
await row(contract).locator('.rb.pin').click();
await until(async () => !(await starOn(contract)));

// ----- 8. Document en lecture seule.
say('\n8. Document en lecture seule');
const tableBefore = JSON.stringify(await lines({ all: true }));
await open(ANA, { query: 'readonly=true' });
check('à l\'ouverture en lecture seule, GFS n\'écrit rien du tout : pas de sonde (un compte Lecteur n\'a pas à fabriquer un refus)', (await lab.actions()).length === 0, await lab.actions());
const readonlyHint = await info();
check('personne n\'est reconnue : la barre du bas dit le rangement commun', SHARED.test(readonlyHint), readonlyHint);
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await page.waitForTimeout(500);
const readonlyNotice = await toast();
check('épingler dit pourquoi rien ne s\'enregistre ; aucune question, aucune écriture', /lecture seule|read-only/i.test(readonlyNotice) && (await frame.locator('.ask').count()) === 0 && (await lab.actions()).length === 0, readonlyNotice);
await shot('7-lecture-seule');
check('la table de GFS est telle qu\'elle était', JSON.stringify(await lines({ all: true })) === tableBefore);
check('aucun avertissement de GFS, aucune erreur de script', warnings.length === 0, warnings);
await lab.browser.close();
