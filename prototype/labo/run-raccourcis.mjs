// Les raccourcis de fichiers dans « Moi » (js/files/shortcuts.js, js/explorer/shortcut-gestures.js ; demande du porteur, 27/11 : « le bouton pour créer des raccourcis de fichier doit
// fonctionner partout »), joués dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier. Ce que ni un faux Grist ni les essais
// de code pur ne disent : ce que Grist retient de la ligne (`GFS_Filing`, app `gfs-shortcut`), ce que la liste en relit, et que la table naît avec l'accord de la personne.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-raccourcis.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. « Créer un raccourci… » depuis « Moi », sans table de rangement : le dossier se choisit (un neuf), Grist n'est écrit qu'après l'accord pour la table ; une ligne, à l'adresse de la personne.
//   2. Le raccourci dans son dossier : l'icône, le mot « Raccourci · PDF », pas d'étoile ; le fichier n'a pas bougé et sa ligne n'est pas touchée ; Récents et la recherche ne le doublent pas.
//   3. Le menu du raccourci, « Aller au fichier d'origine » ; depuis « Récents » et « Favoris », le même bouton crée un raccourci (le cœur de la demande).
//   4. Renommer le raccourci (F2) : seul son nom change. Suppr le retire sans corbeille ; Ctrl+Z le rend, Ctrl+Y le retire, Ctrl+Z le rend.
//   5. Le fichier visé à la corbeille : le raccourci est grisé avec sa phrase, jamais effacé ; restauré, il se rallume. Ctrl+C dit qu'un raccourci ne se copie pas.
//   6. Un dossier qui n'a plus qu'un raccourci ne se supprime pas ; la console de GFS reste muette.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, names, folders, waitForNames, waitForToast, shot, rowOf, goTo } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `raccourcis-${lang}-${scheme}`;
const ME = 'essai@example.com';
const FILING = 'GFS_Filing';
const SHORTCUT = 'gfs-shortcut';
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const goRecent = frame => goTo(frame, new RegExp(`^\\s*${t('ex.recent')}`));
const folderRow = (frame, name) => frame.locator('.ls-row.folder').filter({ has: frame.locator('.nm .t', { hasText: new RegExp(`^${name}$`) }) });
const enter = async (frame, path) => { await goHome(frame); for (const part of path.split('/').filter(Boolean)) await folderRow(frame, part).dblclick(); };
const lines = async run => (await run.rest.rows(FILING)).filter(row => row.App === SHORTCUT);
const valueOf = row => { try { return JSON.parse(row.Value); } catch { return null; } };
const sameNames = async (frame, expected) => JSON.stringify([...(await waitForNames(frame, expected))].sort()) === JSON.stringify([...expected].sort());
const menuLabels = frame => frame.locator('.menu .menu-item').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.menu-label').textContent, hint: (node.querySelector('.menu-hint') || {}).textContent || '',
  greyed: node.getAttribute('aria-disabled') === 'true', icon: Boolean(node.querySelector('svg')) })));

// Le menu d'une ligne (clic droit) puis l'article « Créer un raccourci… ».
async function createFrom(run, name, view) {
  const { frame } = run;
  await rowOf(frame, name).click({ button: 'right' });
  await frame.locator('.menu').waitFor();
  const entries = await menuLabels(frame);
  const entry = entries.find(each => each.label === t('sc.menu'));
  check(`« ${t('sc.menu')} » est dans le menu de « ${name} » (${view}), avec son icône, et n'est pas grisé`, Boolean(entry) && entry.icon && !entry.greyed, entries);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('sc.menu').replace(/…/, '')}`) }).click();
  await frame.locator('[data-fk="move-search"]').waitFor();
}

// ----- 1. Sans table de rangement : le dossier se choisit, puis l'accord, puis une ligne.
async function playFirst(run) {
  const { frame, rest } = run;
  say('--- 1. « Créer un raccourci… » depuis « Moi », sans table de rangement ---');
  check('le document n\'a pas encore de table de rangement', !(await rest.tables()).includes(FILING));
  await createFrom(run, 'Facture.pdf', 'Moi');
  check('la fenêtre dit de quel fichier il s\'agit', (await frame.locator('.mv h2').textContent()) === t('sc.pick.title', { name: 'Facture.pdf' }), await frame.locator('.mv h2').textContent());
  check('elle ne propose aucun dossier d\'espace', (await frame.locator('.wk-item[data-fk^="move-Espaces"]').count()) === 0);
  await frame.locator('[data-fk="move-search"]').fill('Clients');
  await shot(frame, `${TAG}-1-dossier`);
  await frame.locator('[data-fk="move-new"]').click();
  await frame.locator('.mod.ask').waitFor();
  check('rien n\'est écrit avant l\'accord pour la table', !(await rest.tables()).includes(FILING));
  await shot(frame, `${TAG}-1-accord`);
  await frame.locator('[data-fk="ask-yes"]').click();
  const done = await said(frame, 'sc.done', { name: 'Facture.pdf', folder: 'Clients' });
  check('la phrase dit où est le raccourci et que le fichier reste', done === t('sc.done', { name: 'Facture.pdf', folder: 'Clients' }), done);
  const made = await lines(run);
  check('une ligne de rangement, à l\'adresse de la personne, dans « Clients », qui nomme le fichier visé et son type', made.length === 1 && made[0].User === ME && made[0].Folder === 'Clients'
    && valueOf(made[0]).target === `gfs-fichiers:${run.id}` && valueOf(made[0]).name === 'Facture.pdf' && valueOf(made[0]).type === 'pdf', made);
  run.shortcut = made[0];
  run.devisId = (await run.rest.rows('GFS_Files')).find(row => row.Name === 'Devis.pdf').FileId;
}

// ----- 2. Le raccourci dans son dossier.
async function playShown(run) {
  const { frame, rest } = run;
  say('--- 2. le raccourci dans son dossier ---');
  check('à la racine : les deux fichiers sont toujours là, et le dossier « Clients » est né', await sameNames(frame, ['Devis.pdf', 'Facture.pdf']) && (await folders(frame)).includes('Clients'), [await names(frame), await folders(frame)]);
  check('la table des fichiers n\'a pas été touchée', (await rest.rows('GFS_Files')).every(row => !row.DeletedAt));
  await enter(frame, 'Clients');
  check('« Clients » montre le raccourci sous le nom du fichier', await sameNames(frame, ['Facture.pdf']));
  const row = rowOf(frame, 'Facture.pdf');
  const pill = (await row.locator('.ty .pill').textContent()).trim();
  check('la ligne porte le mot « Raccourci » avec le type de son fichier ; son poids est un tiret, pas « 0 o »', pill === t('sc.typeOf', { type: 'PDF' }) && (await row.locator('.wt').textContent()) === '—', [pill, await row.locator('.wt').textContent()]);
  check('pas d\'étoile sur un raccourci', (await row.locator('.rb.pin').count()) === 0);
  await shot(frame, `${TAG}-2-liste`);
  await goRecent(frame);
  check('« Récents » ne le montre pas en double : le fichier y est une fois', (await names(frame)).filter(name => name === 'Facture.pdf').length === 1, await names(frame));
}

// ----- 3. Le menu du raccourci ; le même bouton depuis « Récents » et « Favoris ».
async function playMenu(run) {
  const { page, frame } = run;
  say('--- 3. le menu du raccourci, et le bouton depuis les autres vues ---');
  await enter(frame, 'Clients');
  await rowOf(frame, 'Facture.pdf').click({ button: 'right' });
  await frame.locator('.menu').waitFor();
  const entries = await menuLabels(frame);
  check('le menu d\'un raccourci : le geste de son fichier (« Lire » pour un PDF), aller au fichier d\'origine, renommer, déplacer, retirer ; ni corbeille ni « Créer un raccourci… »',
    JSON.stringify(entries.map(entry => entry.label)) === JSON.stringify([t('files.read'), t('sc.origin'), t('ex.rename'), t('ex.move'), t('sc.remove')]), entries);
  await shot(frame, `${TAG}-3-menu`);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('sc.origin')}`) }).click();
  await frame.waitForFunction(() => document.querySelector('.ls-row[aria-selected="true"]'), null, { timeout: 8000 });
  check('« Aller au fichier d\'origine » ouvre « Moi » sur le fichier, choisi', (await frame.locator('.ls-row[aria-selected="true"] .nm .t').textContent()) === 'Facture.pdf' && await sameNames(frame, ['Devis.pdf', 'Facture.pdf']));
  await goRecent(frame);
  await createFrom(run, 'Devis.pdf', t('ex.recent'));
  await frame.locator('[data-fk="move-Clients"]').click();
  await said(frame, 'sc.done', { name: 'Devis.pdf', folder: 'Clients' });
  const found = await lines(run);
  check('depuis « Récents » : un second raccourci, dans « Clients », vers Devis.pdf', found.length === 2 && found.some(row => valueOf(row).name === 'Devis.pdf' && row.Folder === 'Clients'), found);
  await rowOf(frame, 'Devis.pdf').hover();
  await rowOf(frame, 'Devis.pdf').locator('.rb.pin').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
  await goTo(frame, new RegExp(`^\\s*${t('ex.fav')}`));
  check('« Favoris » montre le fichier épinglé, jamais son raccourci', await sameNames(frame, ['Devis.pdf']), await names(frame));
  await createFrom(run, 'Devis.pdf', t('ex.fav'));
  await page.keyboard.press('Escape');
  await frame.locator('.mod').waitFor({ state: 'detached' });
  check('Échap renonce : aucune ligne de plus', (await lines(run)).length === 2);
}

// ----- 4. Renommer, retirer, défaire.
async function playGestures(run) {
  const { page, frame, rest } = run;
  say('--- 4. renommer, retirer, Ctrl+Z et Ctrl+Y ---');
  await enter(frame, 'Clients');
  const link = rowOf(frame, 'Devis.pdf');
  await link.click();
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').waitFor();
  check('F2 ouvre « Renommer le raccourci » avec son nom', (await frame.locator('[data-fk="name-input"]').inputValue()) === 'Devis.pdf');
  await frame.locator('[data-fk="name-input"]').fill('Devis client');
  await page.keyboard.press('Enter');
  await waitForNames(frame, ['Devis client', 'Facture.pdf']);
  const renamed = (await lines(run)).find(row => valueOf(row).target.endsWith(valueOf(run.shortcut).target) === false);
  check('seul le nom du raccourci change : la ligne dit « Devis client », le fichier garde « Devis.pdf »', valueOf(renamed).name === 'Devis client' && (await rest.rows('GFS_Files')).some(row => row.Name === 'Devis.pdf'), renamed);
  await rowOf(frame, 'Devis client').click();
  await page.keyboard.press('Delete');
  const removed = await said(frame, 'sc.removed', { name: 'Devis client' });
  check('Suppr retire le raccourci, sans corbeille : la phrase le dit, la ligne s\'en va, le fichier n\'est pas marqué', removed === t('sc.removed', { name: 'Devis client' }) && (await lines(run)).length === 1
    && (await rest.rows('GFS_Files')).every(row => !row.DeletedAt) && (await goHomeAndCount(frame)) === 2, removed);
  await enter(frame, 'Clients');
  await page.keyboard.press('Control+z');
  await waitForNames(frame, ['Devis client', 'Facture.pdf']);
  check('Ctrl+Z rend le raccourci, avec son nom et sa cible', (await lines(run)).length === 2 && (await lines(run)).some(row => valueOf(row).name === 'Devis client'), await lines(run));
  await page.keyboard.press('Control+y');
  await waitForNames(frame, ['Facture.pdf']);
  check('Ctrl+Y le retire de nouveau', (await lines(run)).length === 1);
  await page.keyboard.press('Control+z');
  await waitForNames(frame, ['Devis client', 'Facture.pdf']);
  check('un dernier Ctrl+Z le rend', (await lines(run)).length === 2);
  await rowOf(frame, 'Devis client').click();
  await page.keyboard.press('Control+x');
  await said(frame, 'clip.cut', { name: 'Devis client' });
  await goHome(frame);
  await page.keyboard.press('Control+v');
  await said(frame, 'clip.moved', { name: 'Devis client', folder: t('ex.me') });
  const moved = (await lines(run)).find(row => valueOf(row).name === 'Devis client');
  check('couper-coller un raccourci dans « Moi » : sa ligne change de dossier, sa cible et son nom restent ; le fichier visé n\'a pas bougé', moved.Folder === '' && valueOf(moved).target === `gfs-fichiers:${run.devisId}`
    && await sameNames(frame, ['Devis client', 'Devis.pdf', 'Facture.pdf']), moved);
  await page.keyboard.press('Control+z');
  await enter(frame, 'Clients');
  check('Ctrl+Z le remet dans « Clients »', await sameNames(frame, ['Devis client', 'Facture.pdf']) && (await lines(run)).some(row => valueOf(row).name === 'Devis client' && row.Folder === 'Clients'), await lines(run));
}
const goHomeAndCount = async frame => { await goHome(frame); return (await names(frame)).length; };

// ----- 5. Le fichier visé à la corbeille ; Ctrl+C.
async function playMissing(run) {
  const { page, frame } = run;
  say('--- 5. le fichier visé à la corbeille ---');
  await goHome(frame);
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Delete');
  await said(frame, 'trash.moved', { name: 'Facture.pdf' });
  await enter(frame, 'Clients');
  await frame.locator('.ls-row.lk').first().waitFor({ timeout: 20000 });
  const grey = frame.locator('.ls-row.lk').filter({ has: frame.locator('.nm .t', { hasText: /^Facture\.pdf$/ }) });
  check('le raccourci vers le fichier à la corbeille est grisé, avec sa phrase', (await grey.count()) === 1 && (await grey.getAttribute('title')) === t('sc.missing'), await grey.getAttribute('title'));
  await shot(frame, `${TAG}-5-grise`);
  check('jamais effacé tout seul : sa ligne est toujours là', (await lines(run)).length === 2);
  await grey.click();
  await page.keyboard.press('Enter');
  const said1 = await said(frame, 'sc.missing');
  check('Entrée sur le raccourci grisé redit pourquoi', said1 === t('sc.missing'), said1);
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Facture.pdf' });
  await enter(frame, 'Clients');
  await frame.waitForFunction(() => !document.querySelector('.ls-row.lk'), null, { timeout: 20000 });
  check('le fichier restauré, le raccourci se rallume', (await frame.locator('.ls-row.lk').count()) === 0 && await sameNames(frame, ['Devis client', 'Facture.pdf']));
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Control+c');
  const copy = await said(frame, 'sc.noCopy');
  check('Ctrl+C sur un raccourci dit qu\'il ne se copie pas', copy === t('sc.noCopy'), copy);
}

// ----- 6. Un dossier qui n'a plus qu'un raccourci.
async function playFolder(run) {
  const { frame } = run;
  say('--- 6. le dossier qui garde un raccourci ---');
  await goHome(frame);
  await folderRow(frame, 'Clients').click({ button: 'right' });
  await frame.locator('.menu').waitFor();
  const entries = await menuLabels(frame);
  const del = entries.find(entry => entry.label === t('ex.deleteFolder'));
  check('« Supprimer le dossier » est grisé : un raccourci y est rangé', Boolean(del) && del.greyed, entries);
  await frame.page().keyboard.press('Escape');
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await importSamples(run);
  await playFirst(run);
  await playShown(run);
  await playMenu(run);
  await playGestures(run);
  await playMissing(run);
  await playFolder(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
