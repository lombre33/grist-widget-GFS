// L'apparence d'un espace (lot 2 de la demande du 27/11 : couleur, icône et émoji ; contrats 11.14 points 8 à 10, faits vérifiés 195) dans un VRAI Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie
// souris et au vrai clavier pour ce que la personne fait, et par l'API REST de Grist pour ce qu'une personne qui n'a pas le droit tenterait sans passer par GFS (le verrou est dans Grist, pas
// dans l'écran). Trois comptes un à la fois (GRIST_EMAIL ; l'état passe par /tmp/apparence-espaces-etat.json). Le décor : l'espace « Achats » (le propriétaire et editor@ en lecture) et l'espace
// « Ventes » (le propriétaire seul) ; viewer@ n'est dans aucun espace.
//   PHASE=proprietaire  active le partage ; la table des espaces n'a pas de colonne `Style` ; « Apparence… » sur Achats : la fenêtre dit « espace », la colonne est demandée, ajoutée, la valeur écrite
//                       sur la seule ligne d'Achats ; rechargé, l'espace garde son aspect ; un second choix ne redemande rien ; Ctrl+Z, Ctrl+Y, « Rétablir » ; renommer l'espace garde l'apparence ;
//                       rien n'est écrit dans `GFS_Filing` ; un dossier dans l'espace garde son article grisé ;
//   PHASE=editeur       editor@ (lit Achats) : voit la couleur et l'icône choisies par le propriétaire ; l'article est grisé, le clic dit pourquoi ; ne voit pas Ventes ; n'écrit ni la colonne
//                       `Style` ni la structure (refus de Grist) ;
//   PHASE=lecteur       viewer@ (aucun espace) : aucune racine « Espaces » ; ne lit ni les espaces ni leur apparence ; n'écrit rien.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, folders, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';
import { apply, rowsOf } from './lab-rest.mjs';
import { activateSharing, watchToasts } from './lab-dossier-moi.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.APPARENCE_ESPACES_ETAT || '/tmp/apparence-espaces-etat.json';
const { t } = createI18n(lang);
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com';
const SPACES = 'GFS_Spaces', SHARES = 'GFS_Shares', FILING = 'GFS_Filing';
const shot = (frame, name) => pdfShot(frame, `apparence-espaces-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const rows = (run, table) => rowsOf(run, table);
const refused = answer => answer.status >= 400 || /error|refus|denied|forbidden|not allowed|blocked/i.test(answer.text || '');
const lookOf = row => { try { return (JSON.parse(row.Style) || {}).look || null; } catch { return null; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const folderRow = (frame, path) => frame.locator(`.ls-row.folder[data-key="dir:${path}"]`);
const toSpaces = frame => frame.locator('.tr-row[data-path="Espaces"]').click();
const menuItem = (frame, label) => frame.getByRole('menuitem', { name: new RegExp(`^${label}`) });
const window_ = frame => frame.locator('.mod.lk-win');
const pick = (frame, key) => frame.locator(`[data-fk="${key}"]`);
const dataLook = (frame, path) => folderRow(frame, path).getAttribute('data-look');
const iconOf = (frame, path) => folderRow(frame, path).locator('.nm').evaluate(node => (node.querySelector('.fe') ? `emoji:${node.querySelector('.fe').textContent}` : node.querySelector('use').getAttribute('href')));
const until = async (test, ms = 8000) => { const started = Date.now(); while (Date.now() - started < ms) { if (await test()) return true; await new Promise(resolve => setTimeout(resolve, 200)); } return false; };

// Recharge le cadre de GFS (la page de Grist reste) et attend qu'il soit prêt.
async function reopen(run) {
  await run.frame.evaluate(() => location.reload());
  await run.page.waitForTimeout(1500);
  run.frame = await gfsFrame(run.page);
  await run.page.waitForTimeout(800);
  return run.frame;
}
async function openSpaceMenu(frame, path) {
  await folderRow(frame, path).waitFor({ timeout: 20000 });
  await folderRow(frame, path).click({ button: 'right' });
  await frame.locator('.menu').waitFor();
}
// La ligne d'espace dans la table de Grist : { id, Key, Name, Style }.
const spaceRow = async (run, key) => ((await rows(run, SPACES)) || []).find(row => row.Key === key);
// L'ordre des gestes : l'espace, puis la fenêtre « Apparence » ouverte par son menu ; rend vrai quand elle est ouverte.
async function openLook(frame, path) {
  await openSpaceMenu(frame, path);
  await menuItem(frame, t('lk.menu')).click();
  await window_(frame).waitFor({ timeout: 5000 }).catch(() => {});
  return (await window_(frame).count()) === 1;
}
const stateLines = async run => ((await rows(run, FILING)) || []).filter(row => String(row.Folder || '').startsWith('Espaces'));

async function playOwner(run) {
  const { page } = run;
  say('--- 1. activer le partage, le décor : deux espaces, la colonne Style n\'existe pas ---');
  run.frame = await activateSharing(run, 'Facture.pdf');
  const set = await apply(run, [['AddRecord', SPACES, null, { Key: 'achats', Name: 'Achats' }], ['AddRecord', SPACES, null, { Key: 'ventes', Name: 'Ventes' }],
    ['AddRecord', SHARES, null, { Target: 'espace:achats', Person: OWNER, Right: 'ecriture' }], ['AddRecord', SHARES, null, { Target: 'espace:achats', Person: EDITOR, Right: 'lecture' }],
    ['AddRecord', SHARES, null, { Target: 'espace:ventes', Person: OWNER, Right: 'ecriture' }]]);
  check('le décor est écrit (les espaces et leurs droits)', set.status === 200, set.text);
  const columns = (await run.rest.columns(SPACES)).map(column => column.id);
  check('la table des espaces n\'a pas encore de colonne Style (un document d\'avant)', !columns.includes('Style'), columns);
  const first = await reopen(run);
  await toSpaces(first);
  check('l\'espace Achats et l\'espace Ventes sont dans la liste du propriétaire', same((await folders(first)).sort(), ['Achats', 'Ventes']), await folders(first));
  check('aucun des deux n\'a d\'apparence (le dossier d\'origine)', (await dataLook(first, 'Espaces/Achats')) === null && (await iconOf(first, 'Espaces/Achats')) === '#i-folder');

  say('--- 2. le menu et la fenêtre « espace » ---');
  await openSpaceMenu(first, 'Espaces/Achats');
  const item = menuItem(first, t('lk.menu'));
  await item.waitFor();
  check('pour le propriétaire, « Apparence… » est là et dégrisé (la sonde « propriétaire ? » a répondu)', await until(async () => (await item.getAttribute('aria-disabled')) !== 'true'),
    await item.getAttribute('aria-disabled'));
  await page.keyboard.press('Escape');
  check('la fenêtre s\'ouvre', await openLook(first, 'Espaces/Achats'));
  check('son titre dit « espace », sa ligne « vu de tous ses membres », le nom est Achats', (await window_(first).locator('h2').textContent()) === t('lk.title.space') &&
    (await window_(first).locator('.lk-sub').textContent()) === t('lk.who.space') && (await window_(first).locator('.lk-name').textContent()) === 'Achats');
  check('elle tient dans le panneau de 700 × 400, contrastes de la charte', await fits(first, '.mod.lk-win'));
  await pick(first, 'look-color-red').click();
  await pick(first, 'look-glyph-house').click();
  await shot(first, '1-fenetre');
  await pick(first, 'look-ok').click();

  say('--- 3. la colonne est demandée, ajoutée, puis la valeur écrite sur la ligne d\'Achats seule ---');
  await first.locator('.mod.ask').waitFor({ timeout: 5000 }).catch(() => {});
  const asked = (await first.locator('.mod.ask').innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('la question dit ce que GFS ajoute (une colonne « Style » à la table des espaces)', asked.includes(t('lk.col.title')) && asked.includes(t('lk.col.text').slice(0, 40)), asked);
  await shot(first, '2-question');
  await first.locator('[data-fk="ask-yes"]').click();
  check('la colonne Style est ajoutée à GFS_Spaces, en texte', await until(async () => (await run.rest.columns(SPACES)).some(column => column.id === 'Style' && column.type === 'Text')), await run.rest.columns(SPACES));
  check('Achats porte { rouge, maison }, Ventes n\'a rien', await until(async () => same(lookOf(await spaceRow(run, 'achats')), { color: 'red', glyph: 'house' })) &&
    !lookOf(await spaceRow(run, 'ventes')), await rows(run, SPACES));
  check('la fenêtre est fermée et la liste montre le rouge et la maison', (await window_(first).count()) === 0 && await until(async () => (await dataLook(first, 'Espaces/Achats')) === 'red' &&
    (await iconOf(first, 'Espaces/Achats')) === '#i-fl-house'), { look: await dataLook(first, 'Espaces/Achats'), icon: await iconOf(first, 'Espaces/Achats') });
  check('le volet montre le rouge aussi', (await first.locator('.tr-row[data-path="Espaces/Achats"]').getAttribute('data-look')) === 'red');
  check('rien n\'est écrit dans le rangement de la personne (GFS_Filing ne parle d\'aucun espace)', (await stateLines(run)).length === 0, await stateLines(run));
  await shot(first, '3-liste');
  const frame = await reopen(run);
  await toSpaces(frame);
  check('rechargé, l\'espace garde sa couleur et son icône ; Ventes reste d\'origine', (await dataLook(frame, 'Espaces/Achats')) === 'red' && (await iconOf(frame, 'Espaces/Achats')) === '#i-fl-house' &&
    (await dataLook(frame, 'Espaces/Ventes')) === null);

  say('--- 4. un second choix ne redemande rien ; Ctrl+Z, Ctrl+Y, « Rétablir » ---');
  const toasts = await watchToasts(frame);
  await openLook(frame, 'Espaces/Achats');
  check('la fenêtre montre l\'apparence d\'aujourd\'hui (rouge, maison)', (await pick(frame, 'look-color-red').getAttribute('aria-checked')) === 'true' && (await pick(frame, 'look-glyph-house').getAttribute('aria-checked')) === 'true');
  await pick(frame, 'look-color-blue').click();
  await pick(frame, 'look-emoji').fill('📦');
  await pick(frame, 'look-ok').click();
  await page.waitForTimeout(1200);
  check('la colonne est là : aucune question', (await frame.locator('.mod.ask').count()) === 0);
  check('Achats porte { bleu, émoji }', await until(async () => same(lookOf(await spaceRow(run, 'achats')), { color: 'blue', emoji: '📦' })), await spaceRow(run, 'achats'));
  check('la liste montre le bleu et l\'émoji', (await dataLook(frame, 'Espaces/Achats')) === 'blue' && (await iconOf(frame, 'Espaces/Achats')) === 'emoji:📦', await iconOf(frame, 'Espaces/Achats'));
  await frame.locator('.ls-scroll, .ex-scroll').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+z');
  check('Ctrl+Z rend le rouge et la maison', await until(async () => same(lookOf(await spaceRow(run, 'achats')), { color: 'red', glyph: 'house' })) && (await dataLook(frame, 'Espaces/Achats')) === 'red');
  check('la phrase parle de l\'espace', await until(async () => (await toasts()).includes(t('undo.lookSpace', { name: 'Achats' }))), await toasts());
  await page.keyboard.press('Control+y');
  check('Ctrl+Y remet le bleu et l\'émoji', await until(async () => same(lookOf(await spaceRow(run, 'achats')), { color: 'blue', emoji: '📦' })));
  await openLook(frame, 'Espaces/Achats');
  await pick(frame, 'look-reset').click();
  await pick(frame, 'look-ok').click();
  check('« Rétablir » vide la cellule et l\'espace reprend son aspect d\'origine', await until(async () => !(await spaceRow(run, 'achats')).Style) &&
    (await dataLook(frame, 'Espaces/Achats')) === null && (await iconOf(frame, 'Espaces/Achats')) === '#i-folder', await spaceRow(run, 'achats'));

  say('--- 5. renommer l\'espace garde son apparence ; un dossier dans l\'espace reste grisé ---');
  await openLook(frame, 'Espaces/Achats');
  await pick(frame, 'look-color-red').click();
  await pick(frame, 'look-glyph-house').click();
  await pick(frame, 'look-ok').click();
  await until(async () => same(lookOf(await spaceRow(run, 'achats')), { color: 'red', glyph: 'house' }));
  const achats = await spaceRow(run, 'achats');
  await apply(run, [['UpdateRecord', SPACES, achats.id, { Name: 'Achats 2026' }]]);
  const renamed = await reopen(run);
  await toSpaces(renamed);
  check('l\'espace renommé garde sa couleur et son icône (la clé ne change pas)', (await dataLook(renamed, 'Espaces/Achats 2026')) === 'red' && (await iconOf(renamed, 'Espaces/Achats 2026')) === '#i-fl-house',
    await folders(renamed));
  await apply(run, [['UpdateRecord', SPACES, achats.id, { Name: 'Achats' }]]);
  await apply(run, [['AddRecord', 'GFS_Placement', null, { Target: '', Space: 'achats', Folder: 'Contrats' }]]);
  const back = await reopen(run);
  await toSpaces(back);
  await folderRow(back, 'Espaces/Achats').dblclick();
  await folderRow(back, 'Espaces/Achats/Contrats').waitFor({ timeout: 20000 });
  await openSpaceMenu(back, 'Espaces/Achats/Contrats');
  const inside = menuItem(back, t('lk.menu'));
  check('« Apparence… » d\'un dossier dans l\'espace reste là, grisé', (await inside.getAttribute('aria-disabled')) === 'true');
  await inside.click({ force: true }).catch(() => {});
  check('et son clic dit pourquoi', await until(async () => (await back.locator('#toast').textContent()).trim() === t('lk.why.space')), await back.locator('#toast').textContent());
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path }));
}

async function playEditor(run) {
  const { page } = run;
  let frame = run.frame;
  say('--- éditeur (lit l\'espace Achats) : il voit l\'apparence, il ne la change pas ---');
  await toSpaces(frame);
  check('il voit Achats, pas Ventes', same((await folders(frame)).sort(), ['Achats']), await folders(frame));
  check('la liste montre le rouge et la maison choisis par le propriétaire', (await dataLook(frame, 'Espaces/Achats')) === 'red' && (await iconOf(frame, 'Espaces/Achats')) === '#i-fl-house',
    { look: await dataLook(frame, 'Espaces/Achats'), icon: await iconOf(frame, 'Espaces/Achats') });
  check('le volet aussi', (await frame.locator('.tr-row[data-path="Espaces/Achats"]').getAttribute('data-look')) === 'red');
  await shot(frame, 'editeur-liste');
  await openSpaceMenu(frame, 'Espaces/Achats');
  const item = menuItem(frame, t('lk.menu'));
  check('« Apparence… » est là, grisé (jamais masqué)', await until(async () => (await item.getAttribute('aria-disabled')) === 'true'), await item.getAttribute('aria-disabled'));
  await shot(frame, 'editeur-menu');
  await item.click({ force: true });
  check('le clic dit que seul un propriétaire change l\'apparence d\'un espace, sans fenêtre', await until(async () => (await frame.locator('#toast').textContent()).trim() === t('lk.why.owners')) &&
    (await window_(frame).count()) === 0, await frame.locator('#toast').textContent());
  const row = await spaceRow(run, 'achats');
  const forged = await apply(run, [['UpdateRecord', SPACES, row.id, { Style: JSON.stringify({ look: { color: 'green' } }) }]]);
  check('il n\'écrit pas la colonne Style (refus de Grist)', refused(forged), forged.text);
  const structure = await apply(run, [['AddColumn', SPACES, 'Intrus', { type: 'Text' }]]);
  check('il ne change pas la structure de la table', refused(structure), structure.text);
  check('l\'apparence du propriétaire est intacte', same(lookOf(await spaceRow(run, 'achats')), { color: 'red', glyph: 'house' }), await spaceRow(run, 'achats'));
  check('Ventes n\'est pas dans ce qu\'il lit', !((await rows(run, SPACES)) || []).some(each => each.Key === 'ventes'), await rows(run, SPACES));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  await page.waitForTimeout(200);
}

async function playViewer(run) {
  const { frame } = run;
  say('--- lecteur (aucun espace) : rien ---');
  check('aucune racine « Espaces » dans l\'explorateur', (await frame.locator('.tr-row[data-path="Espaces"]').count()) === 0 && (await frame.locator('.ls-row').count()) >= 0);
  const seen = await rows(run, SPACES);
  check('il ne lit aucun espace, donc aucune apparence', !seen || seen.length === 0, seen);
  const forged = await apply(run, [['AddRecord', SPACES, null, { Key: 'pirate', Name: 'Pirate', Style: JSON.stringify({ look: { color: 'red' } }) }]]);
  check('il n\'écrit rien dans la table des espaces', refused(forged), forged.text);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang });
    await shareWithEditorAndViewer(run.page, run.docId);
    await importSamples(run);
    await playOwner(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    // Hors propriétaire, Grist refuse la lecture SQL d'un document à règles : GFS éteint sa lecture légère et relit les tables en entier (son avertissement est attendu).
    run.allow.push(/la lecture légère des fichiers est éteinte pour cette session/);
    await ({ editeur: () => playEditor(run), lecteur: () => playViewer(run) }[phase])();
  }
} finally {
  await browser.close();
  pages.close();
}
