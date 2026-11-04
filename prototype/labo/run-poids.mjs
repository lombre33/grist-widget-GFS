// Le poids dans l'explorateur (demande du porteur, 04/11 : « estimer le poids de chaque élément », une instance de Grist limitant l'ensemble des documents à 15 Go ; docs/faits-verifies.md, section 32),
// jouée dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) avec les modèles de Publipostage+ (dont trois lourds de 600 Ko), des PDF de GFS (pièces jointes de Grist) et la corbeille, à 700 × 400,
// à la vraie souris et au vrai clavier. Ce que ni grist-static ni un faux Grist ne disent : ce que `fetchTable` rend de chaque colonne (listes de pièces jointes, entiers, booléens, formules), la taille que Grist
// garde des pièces jointes, ce que SQLite range vraiment (`dbstat`), et ce que la copie d'un PDF fait de sa pièce. Chromium seulement (test/interfaces-firefox.test.mjs mesure l'interface sous Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-poids.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Chaque fichier de la racine dit le poids que ses cellules ont dans Grist (lues par l'API REST, comptées par js/weight.js), la pièce jointe d'un PDF en plus (sa taille est celle de Grist) ;
//      chaque dossier dit la somme de ses fichiers ; le pied de fenêtre dit le total ; les en-têtes et le total tiennent dans 700 × 400.
//   2. L'estimation face à l'octet exact de SQLite (`dbstat`) : jamais au-dessus, à moins de 2 % pour la table des modèles lourds, et ce qu'elle laisse pour les petites tables.
//   3. Un PDF dupliqué cite la même pièce : sa ligne seule s'ajoute au total, jamais la pièce une deuxième fois.
//   4. Le tri par poids (le plus lourd d'abord, puis le plus léger), dossiers compris.
//   5. La corbeille : l'entrée d'un modèle lourd dit le poids de sa ligne de `GFS_Corbeille` (le modèle entier y est copié), le total de la vue aussi.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { attachmentIds, cellBytes, formatBytes, sumWeights } from '../js/weight.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, importPdf, importSamples, openGfs, openRowMenu, pdfFile, rowOf, shot, waitFor, waitForNames, goTo } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
const TAG = `poids-${lang}-${scheme}`;
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const FILES = 'GFS_Fichiers';
const BIN = 'GFS_Corbeille';
const show = bytes => formatBytes(bytes, locale, t);
const byName = (a, b) => a.name.localeCompare(b.name, locale, { numeric: true, sensitivity: 'base' });

const sql = (run, query) => run.page.evaluate(async ([docId, q]) => (await (await fetch(`/api/docs/${docId}/sql?q=${encodeURIComponent(q)}`)).json()).records.map(record => record.fields), [run.docId, query]);
// Les octets d'une ligne lue par l'API REST : la somme de ses cellules, comme js/weight.js la fait pour ce que GFS lit.
const rowBytes = ({ id, ...fields }) => Object.values(fields).reduce((sum, value) => sum + cellBytes(value), 0);

// Ce que l'explorateur doit montrer, tiré de Grist sans passer par GFS : [{ name, folder, bytes, pieces }] pour les modèles (la ligne de réglages n'est pas un fichier) et les PDF (la ligne, plus la taille
// que Grist garde de la pièce jointe, SQL sur `_grist_Attachments`).
async function expectedFiles(run) {
  const sizes = new Map((await sql(run, 'SELECT id, fileSize FROM _grist_Attachments')).map(row => [row.id, row.fileSize]));
  const folderOf = new Map((await run.rest.rows(PREFS)).filter(row => row.Utilisateur === '' && row.ModeleId > 0).map(row => [row.ModeleId, row.Dossier || '']));
  const list = (await run.rest.rows(MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => ({ name: row.Nom, folder: folderOf.get(row.id) ?? '', bytes: rowBytes(row), pieces: [] }));
  for (const row of (await run.rest.rows(FILES)).filter(each => !each.SupprimeLe)) {
    const [id] = attachmentIds(row.Contenu);
    const size = sizes.get(id) ?? 0;
    list.push({ name: row.Nom, folder: '', bytes: rowBytes(row) + size, pieces: [[String(id), size]], taille: row.Taille, size });
  }
  return list;
}
const inFolder = (file, folder) => file.folder === folder || file.folder.startsWith(`${folder}/`);
const total = list => sumWeights(list.map(file => ({ weight: file.bytes, pieces: file.pieces })));

// Ce que la liste montre : [{ name, folder (vrai pour un dossier), weight (le texte) }] dans l'ordre, et le total du pied.
const listed = frame => frame.evaluate(() => [...document.querySelectorAll('.ls-row')].map(row => ({ name: row.querySelector('.nm .t').textContent, folder: row.classList.contains('folder'), weight: (row.querySelector('.wt') || {}).textContent })));
const footTotal = frame => frame.locator('.ex-total').textContent();
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const waitForWeights = (frame, count) => frame.waitForFunction(n => document.querySelectorAll('.ls-row .wt').length >= n && [...document.querySelectorAll('.ls-row .wt')].every(node => node.textContent.trim() !== ''), count, { timeout: 30000 });

// ----- 0. Les modèles (dont trois lourds), les PDF (dont un de 60 pages pour que sa pièce se voie) ; le rangement reste « commun au document » (GFS ne connaît la personne qu'après sa première écriture).
async function prepare(run) {
  const { page, frame } = run;
  say('--- 0. les PDF, les modèles de Publipostage+ ---');
  await importSamples(run);
  run.rapport = pdfFile('Rapport.pdf', 60, 'Rapport');
  await importPdf(page, frame, run.rapport.file);
  await waitForNames(frame, ['Devis.pdf', 'Facture.pdf', 'Rapport.pdf']);
  await seedFiles(frame, { heavy: { rows: 3, bytes: 600000 } });
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const files = await expectedFiles(run);
  check('les fichiers sont là : 18 modèles, trois modèles lourds, trois PDF', files.length === 24 && files.filter(file => file.pieces.length).length === 3, files.map(file => file.name));
  check('la taille que GFS garde d\'un PDF (`Taille`) est celle que Grist garde de sa pièce jointe', files.filter(file => file.pieces.length).every(file => file.taille === file.size && file.size > 0), files.filter(file => file.pieces.length).map(file => [file.name, file.taille, file.size]));
}

// ----- 1. Le poids de chaque fichier, de chaque dossier, et le total du pied.
async function playWeights(run) {
  const { frame } = run;
  say('--- 1. le poids de chaque fichier et de chaque dossier ---');
  await goHome(frame);
  await waitForWeights(frame, 8);
  const files = await expectedFiles(run);
  const rows = await listed(frame);
  const folderNames = [...new Set(files.filter(file => file.folder).map(file => file.folder.split('/')[0]))];
  const rootNames = [...folderNames, ...files.filter(file => !file.folder).map(file => file.name)];
  const bytesOf = row => (row.folder ? total(files.filter(file => inFolder(file, row.name))) : (files.find(file => file.name === row.name) || { bytes: NaN }).bytes);
  const wrong = rows.filter(row => row.weight !== show(bytesOf(row))).map(row => [row.name, row.weight, show(bytesOf(row))]);
  check('la racine de « Moi » montre les quatre dossiers et les neuf fichiers sans dossier', JSON.stringify(rows.map(row => row.name).sort()) === JSON.stringify([...rootNames].sort()) && folderNames.length === 4 && rows.length === 13, rows.map(row => row.name));
  check('chaque ligne dit le poids que Grist lui donne : un fichier, ses cellules (et sa pièce jointe pour un PDF) ; un dossier, la somme de ses fichiers', wrong.length === 0, wrong.length ? wrong : rows.map(row => [row.name, row.weight]));
  const foot = (await footTotal(frame)).trim();
  check(`le pied de fenêtre dit le total de tout ce que contient « Moi » : ${show(total(files))}`, foot.endsWith(show(total(files))), { pied: foot, attendu: show(total(files)) });
  const heavy = rows.find(row => row.name === 'Modèle lourd 1');
  check('un modèle lourd (600 000 caractères) dit « Ko » ou « Mo », avec le séparateur de la langue', /^\d{3} (Ko|KB)$/.test(heavy.weight.replace(/\s/g, ' ')) || /^[\d.,]+ (Mo|MB)$/.test(heavy.weight.replace(/\s/g, ' ')), heavy);
  check('la liste porte les cinq colonnes à 700 px, le total tient entre la barre d\'information et les boutons', await frame.evaluate(() => {
    const keys = [...document.querySelectorAll('.ls-head .hd')].map(node => node.dataset.sort).join();
    const totalBox = document.querySelector('.ex-total').getBoundingClientRect();
    const open = document.querySelector('.ex-foot > button').getBoundingClientRect();
    return keys === 'name,type,poids,mod,by' && totalBox.right <= open.left + 0.5 && document.querySelector('.ex-total').scrollWidth <= document.querySelector('.ex-total').clientWidth + 1;
  }));
  await shot(frame, `${TAG}-1-poids`);
}

// ----- 2. L'estimation face à SQLite.
async function playAccuracy(run) {
  say('--- 2. l\'estimation face à l\'octet exact de SQLite (dbstat) ---');
  const rows = { [MODELS]: await run.rest.rows(MODELS), [FILES]: await run.rest.rows(FILES), [PREFS]: await run.rest.rows(PREFS) };
  const exact = Object.fromEntries((await sql(run, `SELECT name, SUM(pgsize - unused) AS octets FROM dbstat WHERE name IN ('${MODELS}', '${FILES}', '${PREFS}') GROUP BY name`)).map(row => [row.name, row.octets]));
  for (const [table, list] of Object.entries(rows)) {
    const estimate = list.reduce((sum, row) => sum + rowBytes(row), 0);
    say(`  ${table} : ${list.length} lignes, estimé ${estimate} o, SQLite ${exact[table]} o, ${(100 * (estimate - exact[table]) / exact[table]).toFixed(1)} %`);
  }
  const models = rows[MODELS].reduce((sum, row) => sum + rowBytes(row), 0);
  check('la table des modèles (trois modèles de 600 Ko) : l\'estimation est sous l\'octet exact de SQLite et à moins de 2 % de lui', models <= exact[MODELS] && models >= exact[MODELS] * 0.98, { estimé: models, sqlite: exact[MODELS] });
  const small = rows[FILES].reduce((sum, row) => sum + rowBytes(row), 0);
  check('une petite table (les PDF, sans leurs pièces) : l\'estimation reste sous l\'octet exact', small <= exact[FILES], { estimé: small, sqlite: exact[FILES] });
}

// ----- 3. Un PDF dupliqué cite la même pièce : seule sa ligne s'ajoute au total.
async function playDuplicate(run) {
  const { frame } = run;
  say('--- 3. un PDF dupliqué : la pièce jointe ne compte qu\'une fois ---');
  await openRowMenu(frame, 'Rapport.pdf');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.duplicate')}`) }).click();
  await rowOf(frame, 'Rapport (1).pdf').waitFor();
  const files = await expectedFiles(run);
  const pair = files.filter(file => /^Rapport/.test(file.name));
  check('la copie cite la même pièce jointe, une seule pièce dans le document', pair.length === 2 && pair[0].pieces[0][0] === pair[1].pieces[0][0] && (await sql(run, 'SELECT COUNT(*) AS n FROM _grist_Attachments'))[0].n === 3, pair.map(file => file.pieces));
  await frame.locator('input[type="search"]').fill('Rapport');
  await waitForWeights(frame, 2);
  const rows = await listed(frame);
  const alone = total(pair);
  const naive = pair.reduce((sum, file) => sum + file.bytes, 0);
  const foot = (await footTotal(frame)).trim();
  check('chaque exemplaire dit son poids entier (ligne et pièce), le total de la liste compte la pièce une fois', rows.length === 2 && rows.every((row, i) => row.weight === show(pair.find(file => file.name === row.name).bytes)) && foot.endsWith(show(alone)), { rows, pied: foot, unefois: show(alone), deuxfois: show(naive) });
  check('la pièce comptée deux fois aurait donné un autre total (la mesure voit la différence)', show(alone) !== show(naive), { unefois: show(alone), deuxfois: show(naive) });
  await shot(frame, `${TAG}-2-doublon`);
  await frame.locator('input[type="search"]').fill('');
  await waitForWeights(frame, 8);
}

// ----- 4. Le tri par poids, à la vraie souris.
async function playSort(run) {
  const { frame } = run;
  say('--- 4. le tri par poids ---');
  const files = await expectedFiles(run);
  const rootFolders = [...new Set(files.filter(file => file.folder).map(file => file.folder.split('/')[0]))].map(name => ({ name, bytes: total(files.filter(file => inFolder(file, name))) }));
  const rootFiles = files.filter(file => !file.folder);
  const order = sign => ({ folders: [...rootFolders].sort((a, b) => (sign * (a.bytes - b.bytes)) || byName(a, b)).map(item => item.name), files: [...rootFiles].sort((a, b) => (sign * (a.bytes - b.bytes)) || byName(a, b)).map(item => item.name) });
  const seen = async () => { const rows = await listed(frame); return { folders: rows.filter(row => row.folder).map(row => row.name), files: rows.filter(row => !row.folder).map(row => row.name) }; };
  const header = frame.locator('.ls-head .hd[data-sort="poids"]');
  await header.click();
  check('un premier clic sur « Poids » : le plus lourd d\'abord, dossiers (par leur somme) et fichiers', JSON.stringify(await seen()) === JSON.stringify(order(-1)), { vu: await seen(), attendu: order(-1) });
  await shot(frame, `${TAG}-3-tri`);
  await header.click();
  check('un second clic : le plus léger d\'abord', JSON.stringify(await seen()) === JSON.stringify(order(1)), { vu: await seen(), attendu: order(1) });
  await frame.locator('.ls-head .hd[data-sort="name"]').click();
  check('« Nom » remet l\'ordre des noms', (await seen()).files.join() === [...rootFiles].sort(byName).map(item => item.name).join());
}

// ----- 5. La corbeille : le poids de l'entrée est celui de sa ligne dans GFS_Corbeille.
async function playTrash(run) {
  const { page, frame } = run;
  say('--- 5. la corbeille ---');
  await rowOf(frame, 'Modèle lourd 3').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await waitFor(page, 'l\'entrée est dans la table de la corbeille', async () => (await run.rest.rows(BIN)).length === 1);
  const [entry] = await run.rest.rows(BIN);
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await waitForWeights(frame, 1);
  const rows = await listed(frame);
  check('la vue « Corbeille » dit le poids de la ligne de GFS_Corbeille (le modèle entier y est copié, son texte compris)', rows.length === 1 && rows[0].name === 'Modèle lourd 3' && rows[0].weight === show(rowBytes(entry)) && rowBytes(entry) > 600000, { vu: rows, attendu: show(rowBytes(entry)), octets: rowBytes(entry) });
  const foot = (await footTotal(frame)).trim();
  check('le total de la vue dit la même somme', foot.endsWith(show(rowBytes(entry))), { pied: foot });
  await shot(frame, `${TAG}-4-corbeille`);
  await rowOf(frame, 'Modèle lourd 3').click();
  await page.keyboard.press('Enter');
  check('Entrée restaure le modèle : la corbeille est vide, le modèle lourd est revenu dans sa table', await waitFor(page, 'le modèle est revenu', async () => (await run.rest.rows(BIN)).length === 0 && (await run.rest.rows(MODELS)).some(row => row.Nom === 'Modèle lourd 3')));
  await goHome(frame);
  await waitForWeights(frame, 8);
  const again = (await listed(frame)).find(row => row.name === 'Modèle lourd 3');
  const restored = (await run.rest.rows(MODELS)).find(row => row.Nom === 'Modèle lourd 3');
  check('revenu à la racine, le modèle dit le poids de sa ligne restaurée', again && again.weight === show(rowBytes(restored)), { vu: again, attendu: show(rowBytes(restored)) });
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await prepare(run);
  await playWeights(run);
  await playAccuracy(run);
  await playDuplicate(run);
  await playSort(run);
  await playTrash(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
