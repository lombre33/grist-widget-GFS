// GFS lit les deux jeux de noms de Publipostage+ (contrats 2.4 `noms`, js/apps/doc-names.js), dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), avec les modèles de Publipostage+ et la vraie
// app, à 700 × 400, à la vraie souris et au vrai clavier. Publipostage+ renomme ses tables et ses colonnes en anglais (son traducteur, js/schema-columns.js, à b32f450) : le document d'essai porte d'abord les noms d'avant,
// puis il est RENOMMÉ comme le fera l'app (`RenameTable` et `RenameColumn` de Grist, les lignes suivent), et chaque geste de l'explorateur qui touche la table de l'app est rejoué sur ce document.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-pp-noms-anglais-reel.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Témoin : le document aux noms d'avant montre ses modèles. Il est renommé : la liste est la même, le rangement de l'app (dossiers, étoiles) aussi, au rechargement.
//   2. Une étoile (vraie souris) : la ligne s'écrit dans `Publipostage_TemplatePreferences` (User, TemplateId, Pinned), `GFS_Filing` n'a rien pour ce modèle.
//   3. F2 : le nom s'écrit dans `Name` de `Publipostage_Templates` ; « Dupliquer » : la copie a les valeurs de l'original, sauf le nom et `Token` (vide) ; l'étoile par défaut ne passe pas à la copie.
//   4. Suppr puis la corbeille : l'entrée garde le nom du manifeste (`Table`), la ligne revient au même numéro avec les mêmes valeurs, sous les noms anglais.
//   5. Un modèle mis à la corbeille AVANT le renommage se restaure APRÈS, sans rien perdre (nom, type, contenu) : l'instantané est écrit sous les noms du manifeste.
//   6. La vraie Publipostage+ ouvre un modèle du document renommé (nom et texte).
//   7. (a6465c1 : les deux interrupteurs de l'app sont allumés, mais sa reprise des documents d'avant ne tourne pas dans GFS : `isHostedByGfs()`, le courtier refuse RenameColumn et ModifyColumn) le document est
//      remis aux noms d'avant, la vraie app ouvre un modèle : elle ne renomme rien, elle et GFS le lisent tel quel ; GFS rechargé montre les mêmes modèles, dossiers et étoiles, sans rien écrire dans `GFS_Filing`.
//   8. Un document neuf pour l'app (ses tables retirées) : la vraie app crée ses tables SOUS LES NOMS ANGLAIS (aucun nom d'avant), la personne enregistre un modèle, GFS le liste et le rouvre.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, waitForNames, waitForToast, shot, rowOf, goTo, openRowMenu, waitFor } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `noms-anglais-${lang}-${scheme}`;
const ME = 'essai@example.com';
const BIN = 'GFS_Trash';
const FILING = 'GFS_Filing';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
// Le registre de l'app (b32f450, inchangé à a6465c1) pour les tables que GFS lit : [table d'avant, table anglaise, [[colonne d'avant, colonne anglaise]…]].
const RENAMES = [
  ['Publipostage_Modeles', 'Publipostage_Templates', [['Nom', 'Name'], ['Contenu', 'Content'], ['TypeModele', 'TemplateType'], ['DateModif', 'ModifiedAt'], ['ModifiePar', 'ModifiedBy'], ['Jeton', 'Token'],
    ['EstParDefaut', 'IsDefault']]],
  ['Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences', [['Utilisateur', 'User'], ['ModeleId', 'TemplateId'], ['Dossier', 'Folder'], ['Epingle', 'Pinned'], ['Replie', 'Collapsed']]],
];
const MODELS = 'Publipostage_Templates';
const PREFS = 'Publipostage_TemplatePreferences';
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = list => [...list].sort();
const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => {
  const answer = await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: answer.status, body: await answer.json() };
}, [run.docId, actions]);
const byName = (rows, name) => rows.find(row => row.Name === name);
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const fileNames = frame => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
const reload = async run => {
  await run.frame.evaluate(() => location.reload());
  await run.frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await run.page.waitForTimeout(1000);
};

// Un premier favori : GFS connaît la personne que Grist donne (avec l'accord de la personne, la table `GFS_Filing` naît).
async function pinFirst(run, name) {
  const { frame } = run;
  await rowOf(frame, name).hover();
  await rowOf(frame, name).locator('.rb.pin').click();
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
}

// ----- 0 et 1. Les modèles d'avant, puis le document renommé.
async function prepare(run) {
  const { frame } = run;
  say('--- 0. les modèles de Publipostage+ sous les noms d\'avant ---');
  await seedFiles(frame);
  const models = 'Publipostage_Modeles';
  const ids = Array.from({ length: 18 }, (unused, i) => i + 1);
  await apply(run, [['AddColumn', models, 'Jeton', { type: 'Text' }]]);
  await apply(run, [['BulkUpdateRecord', models, ids, { Jeton: ids.map(id => `j${id}`) }], ['UpdateRecord', models, 1, { EstParDefaut: true }]]);
  const prefs = (await run.rest.rows('Publipostage_PreferencesModeles')).filter(row => row.Utilisateur === '').map(row => row.id);
  await apply(run, [['BulkUpdateRecord', 'Publipostage_PreferencesModeles', prefs, { Utilisateur: prefs.map(() => ME) }]]);
  await reload(run);
  await pinFirst(run, 'Support de session');
  await goHome(frame);
  run.legacyNames = sorted(await fileNames(frame));
  check('témoin : le document aux noms d\'avant montre ses modèles à la racine de « Moi »', run.legacyNames.includes('Contrat de prestation') && run.legacyNames.length >= 3, run.legacyNames);
  run.legacyFolders = await frame.locator('.ls-row.folder .t').allInnerTexts();
  check('et ses dossiers : GFS connaît la personne (un premier favori), le rangement de l\'app s\'applique', run.legacyFolders.length > 0 && run.legacyNames.length === 3, [run.legacyFolders, run.legacyNames]);
  say('--- 1. le même document, renommé comme le fera l\'app ---');
  const reports = [];
  for (const [legacy, english, columns] of RENAMES) {
    const have = (await run.rest.columns(legacy)).map(column => column.id);
    const actions = columns.filter(([from]) => have.includes(from)).map(([from, to]) => ['RenameColumn', legacy, from, to]);
    actions.push(['RenameTable', legacy, english]);
    reports.push((await apply(run, actions)).status);
  }
  check('Grist renomme les deux tables et leurs colonnes', reports.every(status => status === 200), reports);
  const tables = await run.rest.tables();
  check('le document porte les noms anglais et plus ceux d\'avant', tables.includes(MODELS) && tables.includes(PREFS) && !tables.includes('Publipostage_Modeles'), tables);
  await reload(run);
  await goHome(frame);
  const names = sorted(await fileNames(frame));
  check('GFS montre les mêmes modèles qu\'avant le renommage', same(names, run.legacyNames), [names, run.legacyNames]);
  check('les mêmes dossiers et la même étoile : le rangement de l\'app est lu sous ses noms anglais', same(await frame.locator('.ls-row.folder .t').allInnerTexts(), run.legacyFolders) &&
    await rowOf(frame, 'Support de session').locator('.rb.pin.on').count() === 1, run.legacyFolders);
  check('la console de GFS est restée muette', run.problems.filter(problem => !run.allow.some(known => known.test(problem))).length === 0, run.problems);
}

// ----- 2. Une étoile.
async function playPin(run) {
  const { frame } = run;
  say('--- 2. une étoile, à la vraie souris ---');
  const target = byName(await run.rest.rows(MODELS), 'Quittance de loyer');
  await rowOf(frame, 'Quittance de loyer').hover();
  await rowOf(frame, 'Quittance de loyer').locator('.rb.pin').click();
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row .rb.pin.on').length === 2, null, { timeout: 20000 });
  const mine = (await run.rest.rows(PREFS)).filter(row => row.TemplateId === target.id);
  check('la ligne s\'écrit dans la table de l\'app renommée, par ses noms anglais (la personne, le modèle, l\'étoile)', mine.length === 1 && mine[0].User === ME && mine[0].Pinned === true, mine);
  const lines = (await run.rest.rows(FILING)).filter(row => row.App === 'publipostage' && row.Fichier === String(target.id));
  check('GFS_Filing ne garde rien pour ce modèle : celui de l\'app fait foi', lines.length === 0, lines);
  await reload(run);
  await goHome(frame);
  check('l\'étoile se relit au rechargement', await rowOf(frame, 'Quittance de loyer').locator('.rb.pin.on').count() === 1);
}

// ----- 3. Renommer, dupliquer.
async function playRenameCopy(run) {
  const { page, frame } = run;
  say('--- 3. F2 et « Dupliquer » ---');
  await rowOf(frame, 'Quittance de loyer').click();
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').fill('Quittance de loyer 2025');
  await page.keyboard.press('Enter');
  await waitFor(page, 'le nom est écrit', async () => Boolean(byName(await run.rest.rows(MODELS), 'Quittance de loyer 2025')), 20000);
  const rows = await run.rest.rows(MODELS);
  check('F2 : le nom est écrit dans `Name` de `Publipostage_Templates`, sur la ligne du modèle', Boolean(byName(rows, 'Quittance de loyer 2025')) && !byName(rows, 'Quittance de loyer'));
  await openRowMenu(frame, 'Contrat de prestation');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.duplicate')}`) }).click();
  await said(frame, 'copy.done', { as: 'Contrat de prestation (1)' });
  const after = await run.rest.rows(MODELS);
  const original = byName(after, 'Contrat de prestation');
  const copy = byName(after, 'Contrat de prestation (1)');
  check('« Dupliquer » : une ligne de plus dans `Publipostage_Templates`, mêmes valeurs que l\'original sauf le nom et `Token` (vide) ; l\'original n\'a pas bougé',
    Boolean(copy) && after.length === rows.length + 1 && copy.Token === '' && copy.TemplateType === original.TemplateType && copy.IsDefault === false && original.Token === 'j16', [copy, original]);
  run.original = original;
  await shot(frame, `${TAG}-1-copie`);
}

// ----- 4. Suppr, la corbeille, Entrée.
async function playTrash(run) {
  const { page, frame } = run;
  say('--- 4. Suppr, la corbeille, Entrée ---');
  const before = byName(await run.rest.rows(MODELS), 'Contrat de prestation (1)');
  await rowOf(frame, 'Contrat de prestation (1)').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await said(frame, 'trash.moved', { name: 'Contrat de prestation (1)' });
  const [entry] = await run.rest.rows(BIN);
  const snapshot = JSON.parse(entry.Instantane);
  check('l\'entrée garde le nom du manifeste (`Publipostage_Modeles`) : elle ne change pas quand le document est renommé', entry.Table === 'Publipostage_Modeles' && entry.App === 'publipostage' && entry.Nom === 'Contrat de prestation (1)', entry);
  check('l\'instantané est écrit sous les noms du manifeste (`Nom`, `Jeton`), pas sous les noms anglais du document', snapshot.valeurs.Nom === 'Contrat de prestation (1)' && 'Jeton' in snapshot.valeurs && !('Name' in snapshot.valeurs), Object.keys(snapshot.valeurs));
  check('la ligne n\'est plus dans la table de l\'app', !byName(await run.rest.rows(MODELS), 'Contrat de prestation (1)'));
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await rowOf(frame, 'Contrat de prestation (1)').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Contrat de prestation (1)' });
  const back = (await run.rest.rows(MODELS)).find(row => row.id === before.id);
  check('Entrée : la ligne revient au même numéro, avec exactement les mêmes valeurs, sous les noms anglais', Boolean(back) && same(back, before), [back, before]);
  check('la corbeille est vide', (await run.rest.rows(BIN)).length === 0);
  await goHome(frame);
}

// ----- 5. Un modèle mis à la corbeille avant le renommage, restauré après.
async function playBeforeRename(run) {
  const { page, frame } = run;
  say('--- 5. à la corbeille AVANT le renommage, restauré APRÈS ---');
  for (const [legacyTable, englishTable, columns] of RENAMES) {
    await apply(run, [...columns.map(([from, to]) => ['RenameColumn', englishTable, to, from]), ['RenameTable', englishTable, legacyTable]]);
  }
  await reload(run);
  await goHome(frame);
  check('retour aux noms d\'avant : les modèles sont toujours là (le renommage va dans les deux sens)', await rowOf(frame, 'Contrat de prestation').count() === 1);
  await rowOf(frame, 'Contrat de prestation').click();
  await page.keyboard.press('Delete');
  await said(frame, 'trash.moved', { name: 'Contrat de prestation' });
  const [entry] = await run.rest.rows(BIN);
  check('mis à la corbeille sous les noms d\'avant : l\'entrée dit `Publipostage_Modeles` et son instantané `Nom`', entry.Table === 'Publipostage_Modeles' && JSON.parse(entry.Instantane).valeurs.Nom === 'Contrat de prestation');
  const saved = JSON.parse(entry.Instantane).valeurs;
  for (const [legacyTable, englishTable, columns] of RENAMES) {
    await apply(run, [...columns.map(([from, to]) => ['RenameColumn', legacyTable, from, to]), ['RenameTable', legacyTable, englishTable]]);
  }
  await reload(run);
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  check('le document est renommé : la corbeille montre toujours le modèle', await rowOf(frame, 'Contrat de prestation').count() === 1);
  await rowOf(frame, 'Contrat de prestation').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Contrat de prestation' });
  const restored = byName(await run.rest.rows(MODELS), 'Contrat de prestation');
  check('restauré sous les noms anglais : nom, type, jeton et contenu sont ceux d\'avant', Boolean(restored) && restored.Name === saved.Nom && restored.TemplateType === saved.TypeModele && restored.Token === saved.Jeton &&
    restored.Content === saved.Contenu, [restored, saved]);
  await goHome(frame);
}

// ----- 6. La vraie Publipostage+ ouvre un modèle du document renommé.
async function playRealApp(run) {
  const { page, frame } = run;
  say('--- 6. la vraie Publipostage+ ouvre un modèle du document renommé ---');
  await rowOf(frame, 'Contrat de prestation').dblclick();
  const appFrame = () => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
  const shown = () => appFrame().evaluate(() => ({ name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent }));
  const opened = await waitFor(page, 'Publipostage+ montre le modèle', async () => (await shown()).name === 'Contrat de prestation', 60000);
  const seen = opened ? await shown() : await shown().catch(() => null);
  check('l\'app ouvre le modèle : son nom et son texte sont ceux du document renommé', opened && /Contrat de prestation/.test(seen.text), seen);
  await shot(frame, `${TAG}-2-app`);
}


// ----- 7. Dans GFS, la vraie app ne renomme rien (a6465c1 : `isHostedByGfs()` coupe sa reprise, le courtier refuse RenameColumn et ModifyColumn) : le document garde ses noms d'avant, elle et GFS le lisent tel quel.
async function playHostedKeepsNames(run) {
  const { page, frame } = run;
  say('--- 7. dans GFS, la vraie app laisse le document aux noms d\'avant ---');
  for (const [legacyTable, englishTable, columns] of RENAMES) {
    await apply(run, [...columns.map(([from, to]) => ['RenameColumn', englishTable, to, from]), ['RenameTable', englishTable, legacyTable]]);
  }
  await reload(run);
  await goHome(frame);
  const before = sorted(await fileNames(frame));
  const foldersBefore = await frame.locator('.ls-row.folder .t').allInnerTexts();
  const starBefore = await frame.locator('.ls-row .rb.pin.on').count();
  const legacy = await run.rest.tables();
  check('témoin : le document est aux noms d\'avant, GFS montre ses modèles, ses dossiers et ses étoiles', legacy.includes('Publipostage_Modeles') && !legacy.includes(MODELS) && before.length >= 3 && starBefore >= 1, [before, starBefore]);
  await rowOf(frame, 'Contrat de prestation').dblclick();
  const appFrame = () => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
  const opened = await waitFor(page, 'l\'app montre le modèle', async () => { const each = appFrame(); return Boolean(each) && await each.evaluate(() => document.getElementById('template-name').value === 'Contrat de prestation').catch(() => false); }, 60000);
  check('la vraie app ouvre le modèle d\'un document aux noms d\'avant', opened);
  await page.waitForTimeout(8000);
  const tables = await run.rest.tables();
  check('hébergée par GFS, elle ne renomme rien (sa reprise attend une ouverture hors de GFS) : les tables gardent leurs noms d\'avant, aucune table anglaise ne naît à côté',
    tables.includes('Publipostage_Modeles') && tables.includes('Publipostage_PreferencesModeles') && !tables.includes(MODELS) && !tables.includes(PREFS), tables);
  await reload(run);
  await goHome(frame);
  check('GFS rechargé montre les mêmes modèles, les mêmes dossiers et les mêmes étoiles', same(sorted(await fileNames(frame)), before) &&
    same(await frame.locator('.ls-row.folder .t').allInnerTexts(), foldersBefore) && await frame.locator('.ls-row .rb.pin.on').count() === starBefore, [sorted(await fileNames(frame)), before]);
  const lines = (await run.rest.rows(FILING)).filter(row => row.App === 'publipostage');
  check('GFS_Filing ne garde rien de Publipostage+ : le rangement de l\'app fait foi', lines.length === 0, lines);
  await shot(frame, `${TAG}-3-noms-d-avant-dans-gfs`);
}

// ----- 8. Un document neuf pour l'app : les tables naissent sous les noms anglais.
async function playBornEnglish(run) {
  const { page, frame } = run;
  say('--- 8. un document neuf : la vraie app crée ses tables sous les noms anglais ---');
  const own = (await run.rest.tables()).filter(name => /^Publipostage_/.test(name));
  await apply(run, own.map(name => ['RemoveTable', name]));
  await reload(run);
  await goHome(frame);
  check('plus aucune table de l\'app dans le document : GFS ne montre aucun modèle de Publipostage+ et n\'en crée aucune', !(await run.rest.tables()).some(name => /^Publipostage_/.test(name)) &&
    (await rowOf(frame, 'Contrat de prestation').count()) === 0, await run.rest.tables());
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu').waitFor();
  await frame.locator('.menu-item', { hasText: /^\s*Document\s*$/ }).first().click();
  const appFrame = () => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
  await waitFor(page, 'l\'app demande de créer ses tables', async () => Boolean(appFrame()), 60000);
  const create = appFrame().getByRole('button', { name: /Create the tables|Créer les tables/ });
  await create.first().waitFor({ timeout: 60000 });
  await create.first().click();
  await appFrame().locator('#editor-container .ProseMirror').waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const born = await run.rest.tables();
  const english = born.filter(name => /^Publipostage_/.test(name));
  check('la vraie app a créé ses tables sous les noms anglais, aucune sous un nom d\'avant', english.includes(MODELS) && english.includes(PREFS) && !english.some(name => /^Publipostage_(Modeles|PreferencesModeles|Commentaires)$/.test(name)), english);
  const born1 = (await run.rest.columns(MODELS)).map(column => column.id);
  check('les colonnes de `Publipostage_Templates` sont les anglaises (`Name`, `Content`, `TemplateType`, `ModifiedAt`)', ['Name', 'Content', 'TemplateType', 'ModifiedAt'].every(id => born1.includes(id)) && !born1.includes('Nom'), born1);
  await appFrame().locator('#editor-container .ProseMirror').click();
  await page.keyboard.type('Écrit dans un document neuf', { delay: 15 });
  await appFrame().locator('#btn-rename-template').click();
  await page.keyboard.type('Né en anglais', { delay: 20 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await appFrame().locator('#btn-save').click();
  await waitFor(page, 'le modèle est enregistré', async () => Boolean(byName(await run.rest.rows(MODELS), 'Né en anglais')), 30000);
  const saved = byName(await run.rest.rows(MODELS), 'Né en anglais');
  check('l\'app enregistre le modèle dans `Publipostage_Templates`, sous `Name`', Boolean(saved) && /Écrit dans un document neuf/.test(String(saved.Content)), saved && saved.id);
  await reload(run);
  await goHome(frame);
  check('GFS liste le modèle d\'un document né anglais et le rouvre dans la vraie app', (await rowOf(frame, 'Né en anglais').count()) === 1, await fileNames(frame));
  await rowOf(frame, 'Né en anglais').dblclick();
  const opened = await waitFor(page, 'l\'app rouvre le modèle', async () => { const each = appFrame(); return Boolean(each) && await each.evaluate(() => document.getElementById('template-name').value === 'Né en anglais').catch(() => false); }, 60000);
  check('l\'app rouvre ce modèle (son nom et son texte)', opened && /Écrit dans un document neuf/.test(await appFrame().evaluate(() => document.querySelector('.ProseMirror').textContent)));
  await shot(frame, `${TAG}-4-ne-en-anglais`);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await prepare(run);
  await playPin(run);
  await playRenameCopy(run);
  await playTrash(run);
  await playBeforeRename(run);
  await playRealApp(run);
  await playHostedKeepsNames(run);
  await playBornEnglish(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console (hors les refus de la politique que l\'essai a posés lui-même)', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
