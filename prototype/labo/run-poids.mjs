// Le poids dans l'explorateur (demande du porteur, 04/11 : « estimer le poids de chaque élément », une instance de Grist limitant l'ensemble des documents à 15 Go ; docs/faits-verifies.md, section 32),
// jouée dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) avec les modèles de Publipostage+ (dont trois lourds de 600 Ko), des PDF de GFS (pièces jointes de Grist) et la corbeille, à 700 × 400,
// à la vraie souris et au vrai clavier. Ce que ni grist-static ni un faux Grist ne disent : ce que `fetchTable` rend de chaque colonne (listes de pièces jointes, entiers, booléens, formules), la taille que Grist
// garde des pièces jointes, ce que SQLite range vraiment (`dbstat`), et ce que la copie d'un PDF fait de sa pièce. Chromium seulement (test/interfaces-firefox.test.mjs mesure l'interface sous Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-poids.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Chaque fichier de la racine dit le poids que ses cellules ont dans Grist (lues par l'API REST, comptées par js/weight/weight.js), la pièce jointe d'un PDF en plus (sa taille est celle de Grist) ;
//      chaque dossier dit la somme de ses fichiers ; le pied de fenêtre dit le total ; les en-têtes et le total tiennent dans 700 × 400.
//   2. L'estimation face à l'octet exact de SQLite (`dbstat`) : jamais au-dessus, à moins de 2 % pour la table des modèles lourds, et ce qu'elle laisse pour les petites tables.
//   3. Un PDF dupliqué cite la même pièce : sa ligne seule s'ajoute au total, jamais la pièce une deuxième fois.
//   4. Le tri par poids (le plus lourd d'abord, puis le plus léger), dossiers compris.
//   5. La corbeille : l'entrée d'un modèle lourd dit le poids de sa ligne de `GFS_Corbeille` (le modèle entier y est copié), le total de la vue aussi.
//   6. La case « + pièces jointes » (lot 2 ; faits vérifiés, section 39) : de vraies pièces jointes envoyées à Grist (un doublon, le contenu d'un PDF de GFS, une pièce que plus aucune cellule ne cite, que Grist
//      retire de son compte), le total de la case face au calcul exact de SQL (la formule de Grist), les gestes à la vraie souris et au vrai clavier (Tab, Espace, anneau de focus), le pied de fenêtre à 700 × 400,
//      une table de 3 000 pièces de plus.
//   7. Les versions d'un modèle (lot 3 ; contrats 2.4, `poids.liees` ; faits vérifiés, section 41) : la table `Publipostage_Versions` de la vraie Publipostage+ (colonnes de son magasin), rangée par `Jeton` : un modèle compte ses
//      versions, un modèle sans jeton ou une copie non, des versions orphelines ou sans jeton à personne ; le dossier, le total, la corbeille ; ce que la lecture de la table de plus coûte à l'ouverture (3 Mo de versions).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { attachmentIds, cellBytes, formatBytes, sumWeights } from '../js/weight/weight.js';
import { seedFiles } from './seed.mjs';
import { apply, noise, sql, upload } from './lab-poids.mjs';
import { PAGE_PORT, contrastProblems, importPdf, importSamples, openGfs, openRowMenu, pdfFile, rowOf, shot, waitFor, waitForNames, goTo } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
const TAG = `poids-${lang}-${scheme}`;
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const FILES = 'GFS_Fichiers';
const BIN = 'GFS_Corbeille';
const VERSIONS = 'Publipostage_Versions';
const show = bytes => formatBytes(bytes, locale, t);
const byName = (a, b) => a.name.localeCompare(b.name, locale, { numeric: true, sensitivity: 'base' });

// Les octets d'une ligne lue par l'API REST : la somme de ses cellules, comme js/weight/weight.js la fait pour ce que GFS lit.
const rowBytes = ({ id, ...fields }) => Object.values(fields).reduce((sum, value) => sum + cellBytes(value), 0);

// Ce que l'explorateur doit montrer, tiré de Grist sans passer par GFS : [{ name, folder, bytes, pieces }] pour les modèles (la ligne de réglages n'est pas un fichier) et les PDF (la ligne, plus la taille
// que Grist garde de la pièce jointe, SQL sur `_grist_Attachments`).
async function expectedFiles(run) {
  const sizes = new Map((await sql(run, 'SELECT id, fileSize FROM _grist_Attachments')).map(row => [row.id, row.fileSize]));
  const folderOf = new Map((await run.rest.rows(PREFS)).filter(row => row.Utilisateur === '' && row.ModeleId > 0).map(row => [row.ModeleId, row.Dossier || '']));
  // Les versions d'un modèle (`Publipostage_Versions`, par `Jeton`) : leurs octets s'ajoutent à ceux du modèle, une fois par jeton (comme js/weight/weight.js, `linkedOf`).
  const byToken = new Map();
  if ((await run.rest.tables()).includes(VERSIONS)) for (const row of await run.rest.rows(VERSIONS)) if (row.Jeton) byToken.set(row.Jeton, (byToken.get(row.Jeton) || 0) + rowBytes(row));
  const list = (await run.rest.rows(MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => {
    const linked = row.Jeton ? byToken.get(row.Jeton) || 0 : 0;
    return { name: row.Nom, folder: folderOf.get(row.id) ?? '', bytes: rowBytes(row) + linked, linked, pieces: linked ? [[`liee:${VERSIONS}:${row.Jeton}`, linked]] : [] };
  });
  for (const row of (await run.rest.rows(FILES)).filter(each => !each.SupprimeLe)) {
    const [id] = attachmentIds(row.Contenu);
    const size = sizes.get(id) ?? 0;
    list.push({ name: row.Nom, folder: '', bytes: rowBytes(row) + size, pieces: [[String(id), size]], linked: 0, taille: row.Taille, size });
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
    const open = document.querySelector('.ex-foot > .btn').getBoundingClientRect();
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

// ----- 6. La case « + pièces jointes » : de vraies pièces jointes, le calcul exact de SQL, la souris et le clavier.
const PHOTOS = 'Photos';

// Ce que Grist compte des pièces jointes que nul fichier de l'explorateur ne cite : SQL, la formule de Grist (`fileIdent` distincts, `timeDeleted` vide, la plus grande taille), sans les `fileIdent` des
// pièces que citent les fichiers de GFS, vivants ou à la corbeille (leurs numéros viennent de `GFS_Fichiers`, toutes lignes).
async function exactOthers(run) {
  const own = (await run.rest.rows(FILES)).flatMap(row => attachmentIds(row.Contenu));
  const [row] = await sql(run, `SELECT COUNT(*) AS n, COALESCE(SUM(len), 0) AS octets FROM (SELECT MAX(meta.fileSize) AS len FROM _grist_Attachments AS meta WHERE meta.timeDeleted IS NULL AND meta.fileIdent NOT IN (SELECT fileIdent FROM _grist_Attachments WHERE id IN (${own.length ? own.join(',') : '0'})) GROUP BY meta.fileIdent)`);
  return { bytes: row.octets, count: row.n };
}
const listBytes = async run => total(await expectedFiles(run));
const footNumber = frame => frame.locator('.ex-total .tot-n').textContent().then(text => text.trim());
const footTip = frame => frame.locator('.ex-total').getAttribute('title');

// Attend que le total du pied dise `text`, puis rend les millisecondes que cela a pris depuis `started`.
async function waitForTotal(frame, text, started = Date.now(), timeout = 30000) {
  await frame.waitForFunction(wanted => (document.querySelector('.ex-total .tot-n') || {}).textContent === wanted && document.querySelector('.ex-total').getAttribute('aria-busy') !== 'true', text, { timeout }).catch(() => {});
  return Date.now() - started;
}

// Les pièces d'essai : une photo de 200 000 octets envoyée deux fois (le même contenu, deux noms : une pièce pour Grist), une de 350 000, une de 90 000, le contenu d'un PDF de GFS (même empreinte : la pièce
// du PDF, jamais recomptée), et une de 120 000 qu'une cellule cite puis ne cite plus (Grist la retire de son compte au bout d'une minute environ).
async function addPhotos(run) {
  const { rapport } = run;
  const pieces = await upload(run, [
    { name: 'chantier-1.jpg', type: 'image/jpeg', buffer: noise(200000, 1) },
    { name: 'chantier-1-copie.jpg', type: 'image/jpeg', buffer: noise(200000, 1) },
    { name: 'chantier-2.jpg', type: 'image/jpeg', buffer: noise(350000, 2) },
    { name: 'plan.jpg', type: 'image/jpeg', buffer: noise(90000, 3) },
    { name: 'Rapport-reçu.pdf', type: 'application/pdf', buffer: rapport.file.buffer },
    { name: 'brouillon.jpg', type: 'image/jpeg', buffer: noise(120000, 4) },
  ]);
  const [one, copy, two, plan, pdfCopy, draft] = pieces;
  await apply(run, [
    ['AddTable', PHOTOS, [{ id: 'Nom', type: 'Text' }, { id: 'Pieces', type: 'Attachments' }]],
    ['AddRecord', PHOTOS, null, { Nom: 'Chantier', Pieces: ['L', one, copy, two] }],
    ['AddRecord', PHOTOS, null, { Nom: 'Plan et rapport', Pieces: ['L', plan, pdfCopy] }],
    ['AddRecord', PHOTOS, null, { Nom: 'Brouillon', Pieces: ['L', draft] }],
  ]);
  await apply(run, [['UpdateRecord', PHOTOS, 3, { Pieces: null }]]);
  return { pieces, draft };
}

// Le départ : la liste de « Moi », les six pièces envoyées à Grist, la case décochée ; rend ce que les passes suivantes se partagent.
async function attachmentsStart(run) {
  const { frame } = run;
  await goHome(frame);
  await waitForWeights(frame, 8);
  const box = frame.locator('.ex-pj input');
  const base = await listBytes(run);
  const { pieces, draft } = await addPhotos(run);
  const ids = await sql(run, 'SELECT id, fileIdent, fileSize, timeDeleted FROM _grist_Attachments');
  check('Grist range les six pièces : le contenu envoyé deux fois partage son empreinte, celui du PDF de GFS aussi', ids.length === 9 && new Set(ids.map(row => row.fileIdent)).size === 7 && ids.find(row => row.id === pieces[0]).fileIdent === ids.find(row => row.id === pieces[1]).fileIdent
    && ids.find(row => row.id === pieces[4]).fileIdent === ids.find(row => row.fileSize === run.rapport.size && row.id !== pieces[4]).fileIdent, ids);
  await frame.locator('input[type="search"]').fill('Rapport');
  await frame.locator('input[type="search"]').fill('');
  await waitForWeights(frame, 8);

  // Avant de cocher : la case est là, décochée, et le total est celui de la liste.
  check('la case « + pièces jointes » est dans le pied de fenêtre, décochée, et le total est celui de la liste', await box.count() === 1 && !(await box.isChecked()) && (await footNumber(frame)) === show(base), { vu: await footNumber(frame), attendu: show(base) });
  const footBefore = await frame.locator('.ex-foot').boundingBox();
  say(`  contraste des boutons du pied avant la case cochée (sonde) : ${JSON.stringify(await contrastProblems(frame, '.ex-foot button'))}`);
  return { box, base, draft, footBefore };
}

// À la souris : cocher, le total prend les pièces que nul fichier de l'explorateur ne cite, comme SQL les compte ; décocher par le texte de la case, sans rien écrire dans le document. Rend la somme de SQL.
async function attachmentsMouse(run, { box, base, footBefore }) {
  const { frame } = run;
  // 1. La souris : cocher, le total prend les pièces que nul fichier de l'explorateur ne cite, comme SQL les compte.
  const first = await exactOthers(run);
  say(`  SQL (formule de Grist) : ${first.count} pièces, ${first.bytes} o à ajouter à la liste (${base} o)`);
  const started = Date.now();
  await box.click();
  const lasted = await waitForTotal(frame, show(base + first.bytes), started);
  say(`  total passé de ${show(base)} à ${await footNumber(frame)} en ${lasted} ms (lecture de _grist_Attachments, 9 lignes)`);
  check('le clic coche la case et le total est la liste plus les pièces jointes que SQL compte (le doublon une fois, la pièce du PDF de GFS jamais recomptée)', await box.isChecked() && (await footNumber(frame)) === show(base + first.bytes) && first.bytes >= 640000, { vu: await footNumber(frame), attendu: show(base + first.bytes), sql: first });
  const tip = await footTip(frame);
  const split = t('weight.totalSplit', { list: show(base), pj: show(first.bytes), n: first.count });
  check('l\'infobulle du total dit d\'où il vient : la liste, les pièces jointes et leur nombre', tip.includes(split), { infobulle: tip, attendu: split });
  const footAfter = await frame.locator('.ex-foot').boundingBox();
  check('le pied de fenêtre garde sa hauteur et le total, la case et les boutons ne se recouvrent pas ni ne se coupent (700 × 400)', Math.abs(footAfter.height - footBefore.height) <= 1 && await frame.evaluate(() => {
    const foot = document.querySelector('.ex-foot').getBoundingClientRect();
    const parts = [...document.querySelectorAll('.ex-foot > *')].filter(node => node.getBoundingClientRect().width > 0);
    const boxes = parts.map(node => node.getBoundingClientRect());
    const crossing = boxes.some((a, i) => boxes.some((b, j) => j > i && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    const cut = parts.some(node => node.scrollWidth > node.clientWidth + 1);
    return !crossing && !cut && boxes.every(rect => rect.left >= foot.left - 0.5 && rect.right <= foot.right + 0.5);
  }), { avant: footBefore.height, apres: footAfter.height });
  check('le texte du total et de la case atteint 4,5:1 contre son fond, case cochée', (await contrastProblems(frame, '.ex-total, .ex-pj')).length === 0, await contrastProblems(frame, '.ex-total, .ex-pj'));
  check('le total se lit en entier pour un lecteur d\'écran : « Total : », la somme, puis la part de la liste et des pièces jointes (aucun « null » ni texte perdu)', (await frame.locator('.ex-total').textContent()).trim() === `${t('weight.total')} : ${show(base + first.bytes)}, ${split}`, await frame.locator('.ex-total').textContent());
  await shot(frame, `${TAG}-5-pieces-jointes`);

  // 2. La souris encore : le texte de la case décoche, rien ne reste ajouté ; la case n'écrit rien dans le document.
  const tablesBefore = (await run.rest.tables()).join();
  await frame.locator('.ex-pj span').click();
  await waitForTotal(frame, show(base));
  check('un clic sur le texte de la case la décoche et le total revient à celui de la liste', !(await box.isChecked()) && (await footNumber(frame)) === show(base), { vu: await footNumber(frame) });
  check('la case n\'a rien écrit dans le document (aucune table de plus, la table des pièces jointes inchangée)', (await run.rest.tables()).join() === tablesBefore && (await sql(run, 'SELECT COUNT(*) AS n FROM _grist_Attachments'))[0].n === 9);
  return first;
}

// Au clavier : la case est un arrêt de Tab avant la pastille des droits et « Ouvrir », son anneau de focus se voit, Espace la coche et elle garde le focus.
async function attachmentsKeyboard(run, { box, base, first }) {
  const { page, frame } = run;
  // 3. Le clavier : de la case, Maj+Tab vient de la liste et Tab va à la pastille des droits, « Ouvrir » puis « Fermer » ; Espace coche sans que la case perde le focus ; l'anneau de focus se voit.
  await frame.locator('.ex-foot button', { hasText: t('ex.open') }).first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  const onBox = await frame.evaluate(() => document.activeElement && document.activeElement.matches('.ex-pj input'));
  const stops = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    stops.push(await frame.evaluate(() => (document.activeElement.matches('.rights-chip') ? 'droits' : document.activeElement.textContent.trim())));
  }
  check('au clavier, la case est juste avant la pastille des droits, « Ouvrir » et « Fermer » (Tab : droits, Ouvrir, Fermer)', onBox && stops.join('|') === ['droits', t('ex.open'), t('ex.close')].join('|'), { onBox, stops });
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+Tab');
  const ring = await box.evaluate(input => { const style = getComputedStyle(input); return { focused: document.activeElement === input, visible: input.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth }; });
  check('la case prise au clavier montre son anneau de focus (2 px)', ring.focused && ring.visible && ring.style === 'solid' && parseFloat(ring.width) >= 2, ring);
  const keyStart = Date.now();
  await page.keyboard.press('Space');
  await waitForTotal(frame, show(base + first.bytes), keyStart);
  const kept = await box.evaluate(input => document.activeElement === input);
  check('Espace coche la case, le total dit la même somme, et la case garde le focus (rien ne reconstruit le pied)', await box.isChecked() && (await footNumber(frame)) === show(base + first.bytes) && kept, { vu: await footNumber(frame), focus: kept });
  await shot(frame, `${TAG}-5-pieces-jointes-clavier`);
}

// Un PDF à la corbeille, la case cochée : sa pièce reste la sienne.
async function attachmentsTrash(run, { base, first }) {
  const { page, frame } = run;
  // 4. Un PDF mis à la corbeille, la case cochée : sa pièce reste à lui (la corbeille la garde), elle ne devient pas « autre » ; remis, il revient.
  const devisPiece = (await expectedFiles(run)).find(file => file.name === 'Devis.pdf');
  await rowOf(frame, 'Devis.pdf').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor({ timeout: 3000 }).then(() => frame.locator('[data-fk="ask-yes"]').click()).catch(() => {});
  await waitFor(page, 'le PDF est à la corbeille', async () => (await run.rest.rows(FILES)).some(row => row.Nom === 'Devis.pdf' && row.SupprimeLe));
  const trashed = await exactOthers(run);
  const listNow = await listBytes(run);
  await waitForTotal(frame, show(listNow + trashed.bytes));
  check('avec le PDF à la corbeille, la case ne compte pas sa pièce jointe comme « autre » (SQL dit la même somme)', trashed.bytes === first.bytes && (await footNumber(frame)) === show(listNow + trashed.bytes) && listNow < base, { sql: trashed, avant: first, liste: listNow, vu: await footNumber(frame), piece: devisPiece.size });
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await rowOf(frame, 'Devis.pdf').click();
  await page.keyboard.press('Enter');
  await waitFor(page, 'le PDF est revenu', async () => (await run.rest.rows(FILES)).some(row => row.Nom === 'Devis.pdf' && !row.SupprimeLe));
  await goHome(frame);
  await waitForWeights(frame, 8);
  await waitForTotal(frame, show(base + first.bytes));
  check('le PDF remis, le total est de nouveau la liste d\'avant plus les pièces jointes', (await footNumber(frame)) === show(base + first.bytes), { vu: await footNumber(frame), attendu: show(base + first.bytes) });
}

// Le passage de Grist : la pièce que plus aucune cellule ne cite sort du compte.
async function attachmentsRemoval(run, { box, base, draft, first }) {
  const { page, frame } = run;
  // 5. Grist retire de son compte la pièce que plus aucune cellule ne cite : il le fait toutes les heures (REMOVE_UNUSED_ATTACHMENTS_DELAY, 60 min ± 30 s), ou quand le propriétaire le demande
  // (POST …/attachments/removeUnused?expiredonly=true : il marque `timeDeleted` des pièces sans référence et n'efface que celles marquées depuis plus de 7 jours). Tant qu'il ne l'a pas fait, elle compte.
  const stillThere = (await sql(run, `SELECT timeDeleted FROM _grist_Attachments WHERE id = ${draft}`))[0].timeDeleted === null;
  const marked = await page.evaluate(async docId => (await fetch(`/api/docs/${docId}/attachments/removeUnused?expiredonly=true`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })).status, run.docId);
  const gone = await waitFor(page, 'Grist retire la pièce sans référence de son compte', async () => (await sql(run, `SELECT timeDeleted FROM _grist_Attachments WHERE id = ${draft}`))[0].timeDeleted !== null, 30000);
  const second = await exactOthers(run);
  say(`  avant le passage de Grist : la pièce comptait (${stillThere}) ; après (${marked}) : SQL dit ${second.count} pièces, ${second.bytes} o (avant : ${first.count}, ${first.bytes} o)`);
  await box.click();
  await waitForTotal(frame, show(base));
  await box.click();
  await waitForTotal(frame, show(base + second.bytes));
  check('tant que Grist n\'a pas fait son passage, la pièce de 120 000 octets que plus aucune cellule ne cite compte (SQL la compte aussi) ; après, la case recochée relit et ne la compte plus', stillThere && marked === 200 && gone && second.bytes === first.bytes - 120000 && second.count === first.count - 1 && (await footNumber(frame)) === show(base + second.bytes), { avant: stillThere, statut: marked, retiree: gone, sql: second, vu: await footNumber(frame) });
  await box.click();
  await waitForTotal(frame, show(base));
  await shot(frame, `${TAG}-5-pieces-jointes-fin`);
}

async function playAttachments(run) {
  say('--- 6. la case « + pièces jointes » ---');
  const state = await attachmentsStart(run);
  const first = await attachmentsMouse(run, state);
  await attachmentsKeyboard(run, { ...state, first });
  await attachmentsTrash(run, { ...state, first });
  await attachmentsRemoval(run, { ...state, first });
  await scaleAttachments(run, state.base);
}

// 6. Une table de pièces jointes de 3 000 lignes de plus : la case rend toujours le total de SQL, la lecture se compte en millisecondes.
async function scaleAttachments(run, base) {
  const { frame } = run;
  const box = frame.locator('.ex-pj input');
  for (let batch = 0; batch < 6; batch++) await upload(run, Array.from({ length: 500 }, (_, i) => ({ name: `mille-${batch * 500 + i}.bin`, type: 'application/octet-stream', buffer: noise(64, 1000 + batch * 500 + i) })));
  const rows = (await sql(run, 'SELECT COUNT(*) AS n FROM _grist_Attachments'))[0].n;
  const expected = await exactOthers(run);
  const started = Date.now();
  await box.click();
  const lasted = await waitForTotal(frame, show(base + expected.bytes), started);
  say(`  ${rows} pièces dans le document : lecture et total en ${lasted} ms ; SQL : ${expected.count} pièces, ${expected.bytes} o`);
  check(`avec ${rows} lignes dans la table des pièces jointes, le total reste celui de SQL et vient en moins de 5 s`, (await footNumber(frame)) === show(base + expected.bytes) && lasted < 5000, { vu: await footNumber(frame), attendu: show(base + expected.bytes), ms: lasted, sql: expected });
  await box.click();
  await waitForTotal(frame, show(base));
}

// ----- 7. Les versions d'un modèle : leurs octets s'ajoutent à ceux du modèle, par le jeton.
// La table de la vraie Publipostage+ (js/versions-store.js du dépôt de l'app : Jeton, Date, Auteur, Nom, Genre, Donnees), de gros textes comme ses états compressés (base64).
const text = (size, seed) => noise(Math.ceil(size * 3 / 4), seed).toString('base64').slice(0, size);
const versionRow = (token, size, seed) => ({ Jeton: token, Date: 1762000000 + seed, Auteur: 'paul@exemple.fr', Nom: '', Genre: '', Donnees: text(size, seed) });
const addVersions = (run, rows) => apply(run, [['BulkAddRecord', VERSIONS, rows.map(() => null), Object.fromEntries(Object.keys(rows[0]).map(key => [key, rows.map(row => row[key])]))]]);
const timeLoad = async frame => {
  const started = Date.now();
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await goHome(frame);
  await waitForWeights(frame, 8);
  return Date.now() - started;
};
const weightOf = async (frame, name) => (await listed(frame)).find(row => row.name === name);

// Les jetons des modèles et la table des versions, comme Publipostage+ les écrit ; rend ce que les passes suivantes se partagent.
async function versionsStart(run) {
  const { frame } = run;
  say('--- 7. les versions d\'un modèle ---');
  await goHome(frame);
  await waitForWeights(frame, 8);
  const ids = (await run.rest.rows(MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => row.id);
  await apply(run, [['AddColumn', MODELS, 'Jeton', { type: 'Text' }]]);
  await apply(run, [['BulkUpdateRecord', MODELS, ids, { Jeton: ids.map(id => `j${id}`) }]]);
  await apply(run, [['AddTable', VERSIONS, ['Jeton', 'Auteur', 'Nom', 'Genre', 'Donnees'].map(id => ({ id, type: 'Text' })).concat([{ id: 'Date', type: 'DateTime' }])]]);
  const models = await run.rest.rows(MODELS);
  const token = name => models.find(row => row.Nom === name).Jeton;
  const baseline = [await timeLoad(frame), await timeLoad(frame)];
  await addVersions(run, [1, 2, 3, 4].map(n => versionRow(token('Modèle lourd 1'), 120000, n)));
  await addVersions(run, [5, 6, 7].map(n => versionRow(token('Contrat de prestation'), 2000, n)));
  await addVersions(run, [8, 9].map(n => versionRow('orphelin', 50000, n)).concat([versionRow('', 10000, 10)]));
  return { baseline, token };
}

// Chaque ligne dit le poids de son modèle plus celui de ses versions ; un dossier, la somme ; le total ; la table face à SQLite.
async function versionsWeights(run, { token }) {
  const { frame } = run;
  await timeLoad(frame);
  const files = await expectedFiles(run);
  const rows = await listed(frame);
  const heavy = files.find(file => file.name === 'Modèle lourd 1');
  const small = files.find(file => file.name === 'Contrat de prestation');
  const all = (await run.rest.rows(VERSIONS)).reduce((sum, row) => sum + rowBytes(row), 0);
  const attributed = files.reduce((sum, file) => sum + file.linked, 0);
  say(`  les versions : ${all} o dans la table, ${attributed} o rattachés à un modèle (le reste : jeton inconnu ou vide)`);
  check('« Modèle lourd 1 » dit le poids de sa ligne plus ses quatre versions (le jeton rattache), « Contrat de prestation » le sien plus ses trois', heavy.linked > 480000 && small.linked > 6000
    && (await weightOf(frame, 'Modèle lourd 1')).weight === show(heavy.bytes) && (await weightOf(frame, 'Contrat de prestation')).weight === show(small.bytes), { vu: rows.filter(row => /Modèle lourd 1|Contrat/.test(row.name)), attendu: [show(heavy.bytes), show(small.bytes)] });
  check('les versions orphelines (jeton inconnu) et sans jeton ne sont à aucun modèle : elles ne sont pas comptées', attributed === heavy.linked + small.linked && attributed < all && all - attributed > 100000, { toutes: all, rattachees: attributed });
  const wrong = rows.filter(row => row.weight !== show(row.folder ? total(files.filter(file => inFolder(file, row.name))) : files.find(file => file.name === row.name).bytes)).map(row => [row.name, row.weight]);
  check('les autres lignes et les dossiers disent toujours le poids de leurs fichiers (un dossier somme les modèles et leurs versions)', wrong.length === 0, wrong);
  check('le total du pied est la somme de ce que la liste montre, versions comprises', (await footNumber(frame)) === show(total(files)), { vu: await footNumber(frame), attendu: show(total(files)) });
  const exact = (await sql(run, `SELECT SUM(pgsize - unused) AS octets FROM dbstat WHERE name = '${VERSIONS}'`))[0].octets;
  say(`  ${VERSIONS} : estimé ${all} o, SQLite ${exact} o, ${(100 * (all - exact) / exact).toFixed(1)} %`);
  check('la table des versions : l\'estimation est sous l\'octet exact de SQLite et à moins de 2 % de lui', all <= exact && all >= exact * 0.98, { estimé: all, sqlite: exact });
  await shot(frame, `${TAG}-6-versions`);
}

// La copie d'un modèle n'a pas de jeton (la recette `copie` le vide) : pas de versions ; à la corbeille, l'entrée ne garde que sa ligne ; remis, le modèle retrouve ses versions.
async function versionsCopyAndTrash(run) {
  const { page, frame } = run;
  const before = await expectedFiles(run);
  const heavy = before.find(file => file.name === 'Modèle lourd 1');
  const token = (await run.rest.rows(MODELS)).find(row => row.Nom === 'Modèle lourd 1').Jeton;
  await openRowMenu(frame, 'Modèle lourd 1');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.duplicate')}`) }).click();
  await rowOf(frame, 'Modèle lourd 1 (1)').waitFor();
  await waitForWeights(frame, 8);
  const copy = (await run.rest.rows(MODELS)).find(row => row.Nom === 'Modèle lourd 1 (1)');
  check('la copie d\'un modèle n\'a pas de jeton et ne compte aucune version : elle pèse sa ligne, ses 600 000 caractères', !copy.Jeton && (await weightOf(frame, 'Modèle lourd 1 (1)')).weight === show(rowBytes(copy)) && rowBytes(copy) > 590000, { copie: copy.Jeton, vu: await weightOf(frame, 'Modèle lourd 1 (1)'), attendu: show(rowBytes(copy)) });
  await rowOf(frame, 'Modèle lourd 1').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor({ timeout: 3000 }).then(() => frame.locator('[data-fk="ask-yes"]').click()).catch(() => {});
  await waitFor(page, 'le modèle est à la corbeille', async () => (await run.rest.rows(BIN)).length === 1);
  const [entry] = await run.rest.rows(BIN);
  const still = (await run.rest.rows(VERSIONS)).filter(row => row.Jeton === token).length;
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await waitForWeights(frame, 1);
  check('à la corbeille, l\'entrée pèse sa ligne de GFS_Corbeille et rien de plus, et les quatre versions restent dans leur table', still === 4 && (await listed(frame))[0].weight === show(rowBytes(entry)), { versions: still, vu: await listed(frame), attendu: show(rowBytes(entry)) });
  await rowOf(frame, 'Modèle lourd 1').click();
  await page.keyboard.press('Enter');
  await waitFor(page, 'le modèle est revenu', async () => (await run.rest.rows(BIN)).length === 0);
  await goHome(frame);
  await waitForWeights(frame, 8);
  const again = (await expectedFiles(run)).find(file => file.name === 'Modèle lourd 1');
  check('remis, le modèle dit de nouveau sa ligne plus ses versions', (await weightOf(frame, 'Modèle lourd 1')).weight === show(again.bytes) && again.linked === heavy.linked, { vu: await weightOf(frame, 'Modèle lourd 1'), attendu: show(again.bytes) });
}

// Ce que la table de plus coûte à l'ouverture : 3 Mo de versions (le plafond de Publipostage+ : 3 000 000 caractères pour tout le document) ; le poids garde son exactitude.
async function versionsCost(run, { baseline }) {
  const { frame } = run;
  const models = await run.rest.rows(MODELS);
  const token = name => models.find(row => row.Nom === name).Jeton;
  for (let batch = 0; batch < 5; batch++) await addVersions(run, [0, 1, 2, 3, 4].map(n => versionRow(token(n % 2 ? 'Modèle lourd 2' : 'Modèle lourd 3'), 100000, 100 + batch * 5 + n)));
  const rows = (await run.rest.rows(VERSIONS)).length;
  const bytes = (await run.rest.rows(VERSIONS)).reduce((sum, row) => sum + rowBytes(row), 0);
  const loads = [await timeLoad(frame), await timeLoad(frame)];
  const files = await expectedFiles(run);
  const slower = Math.round(loads.reduce((a, b) => a + b) / 2 - baseline.reduce((a, b) => a + b) / 2);
  say(`  ouverture de l'explorateur : ${baseline.join(' et ')} ms sans la table, ${loads.join(' et ')} ms avec ${rows} versions (${(bytes / 1048576).toFixed(1)} Mo) : ${slower >= 0 ? '+' : ''}${slower} ms`);
  check(`avec ${rows} versions (${(bytes / 1048576).toFixed(1)} Mo), le poids reste celui des octets de Grist et l'ouverture ne prend pas plus de 3 s de plus`, slower < 3000 && (await weightOf(frame, 'Modèle lourd 2')).weight === show(files.find(file => file.name === 'Modèle lourd 2').bytes) && (await footNumber(frame)) === show(total(files)), { lenteur: slower, vu: await footNumber(frame), attendu: show(total(files)) });
}

async function playVersions(run) {
  const state = await versionsStart(run);
  await versionsWeights(run, state);
  await versionsCopyAndTrash(run);
  await versionsCost(run, state);
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
  await playAttachments(run);
  await playVersions(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
