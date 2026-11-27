// L'apparence des dossiers de « Moi » (js/files/folder-looks.js, js/explorer/look-window.js ; étude du 27/11, choix du porteur : l'émoji se choisit dans la fenêtre « Apparence »), dans un VRAI
// Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright), avec Ana comme personne du moment (le moteur de Grist reçoit son adresse). Ce que le code pur ne dit pas :
// ce que Grist retient de la ligne d'état (`GFS_Filing`, `Value`), ce que la liste en relit après un rechargement, et ce que deviennent l'apparence et les lignes de Publipostage+ quand le dossier
// change de nom, de place ou disparaît.
//   1. Le menu d'un dossier : « Apparence… » juste après « Renommer », avec son icône ; la fenêtre tient dans le panneau, le clavier arrive sur la première pastille, les flèches changent de pastille.
//   2. Couleur et repère choisis à la souris : la liste, le volet et la barre d'information les montrent tout de suite ; une seule ligne d'état, à l'adresse d'Ana, rien d'autre n'est écrit
//      (les lignes de Publipostage+ n'ont pas bougé) ; rechargé, le dossier garde son aspect.
//   3. Un émoji collé dans le champ : il prend la place du repère (l'icône et le mot du dossier restent) ; un texte qui n'est pas un émoji est refusé avec sa phrase, Entrée n'écrit rien.
//   4. Renommer (F2), déplacer (Ctrl+X, Ctrl+V) : l'apparence suit, sur la même ligne d'état ; Ctrl+Z la laisse en place.
//   5. Ctrl+Z défait un changement d'apparence, Ctrl+Y le refait ; « Rétablir » vide la cellule, le dossier reprend l'accent de l'ambiance.
//   6. Un dossier vide qui a une apparence se supprime : sa ligne d'état s'en va, sans reste ; Ctrl+Z le rend avec son apparence (une seule ligne d'état, sa cellule réécrite).
//   7. Les sept couleurs, en vignettes aussi : le trait de l'icône tient 3:1 sur son fond (charte), le nom du dossier garde 4,5:1 ; la coche de chaque pastille aussi.
//   8. La console de GFS reste muette.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { explorerTools } from './lab-gestes.mjs';
import { windowFits } from './lab-pdf.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { COLORS, GLYPHS } from '../js/files/folder-looks.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `apparence-${lang}-${scheme}`;
const ANA = { Email: 'ana@exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 };
const MODELS = 'Publipostage_Modeles';
const PREFS = 'Publipostage_PreferencesModeles';
const FILING = 'GFS_Filing';
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const lab = await startLab({ lang, colorScheme: scheme, user: ANA });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
let frame = lab.frame;
// Le rangement d'Ana chez Publipostage+ : un dossier plein (« Archives », deux modèles), un dossier vide (« Vide », ligne d'état de l'app) et, pour la mesure des couleurs, sept dossiers vides
// qu'elle garde chez GFS avec chacun sa couleur (la ligne d'état dit déjà l'apparence : ce que lit GFS au démarrage).
await frame.evaluate(async ([prefs, models, filing, email, colors]) => {
  const old = (await grist.docApi.fetchTable(prefs)).id;
  await grist.docApi.applyUserActions([['BulkRemoveRecord', prefs, old]]);
  const named = await grist.docApi.fetchTable(models);
  const idOf = name => named.id[named.Nom.indexOf(name)];
  await grist.docApi.applyUserActions([
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: idOf('Contrat de prestation'), Epingle: false, Dossier: 'Archives' }],
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: idOf('Facture / devis multi-TVA'), Epingle: true, Dossier: 'Archives' }],
    ['AddRecord', prefs, null, { Utilisateur: email, ModeleId: 0, Dossier: 'Vide', Replie: false }],
  ]);
  const columns = ['User', 'App', 'File', 'Folder', 'Value'].map(id => ({ id, type: 'Text' })).concat([{ id: 'Favorite', type: 'Bool' }, { id: 'Collapsed', type: 'Bool' }]);
  await grist.docApi.applyUserActions([['AddTable', filing, columns]]);
  await grist.docApi.applyUserActions([['BulkAddRecord', filing, colors.map(() => null), {
    User: colors.map(() => email), App: colors.map(() => ''), File: colors.map(() => ''), Folder: colors.map(color => `Couleur ${color}`),
    Value: colors.map(color => JSON.stringify({ look: { color } })), Favorite: colors.map(() => false), Collapsed: colors.map(() => false),
  }]]);
}, [PREFS, MODELS, FILING, ANA.Email, COLORS]);
const reopen = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
  if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
};
await reopen();

const { folderRow, folderNames, table, until } = explorerTools(() => frame, page);
const rows = async name => {
  const data = await table(name).catch(() => null);
  if (!data) return null;
  return data.id.map((id, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
};
const stateLines = async () => (await rows(FILING)).filter(line => line.User === ANA.Email && !line.App && !line.File && line.Folder);
const stateOf = async path => (await stateLines()).filter(line => line.Folder === path);
const lookOf = line => { try { return (JSON.parse(line.Value) || {}).look || null; } catch { return null; } };
const prefsText = async () => JSON.stringify((await rows(PREFS)).map(line => [line.Utilisateur, line.ModeleId, line.Dossier, line.Epingle]).sort());
const goHome = () => frame.locator('.tr-row', { hasText: /^\s*(Moi|Me)\b/ }).first().click().then(() => page.waitForTimeout(300));
const openMenu = async name => { await folderRow(name).hover(); await folderRow(name).locator('.rb.mn').click(); await frame.locator('.menu').waitFor(); };
const menuLabels = () => frame.locator('.menu .menu-item').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.menu-label').textContent.trim(), greyed: node.getAttribute('aria-disabled') === 'true',
  icon: Boolean(node.querySelector('svg')) })));
const window_ = () => frame.locator('.mod.lk-win');
const dataLook = async name => folderRow(name).getAttribute('data-look');
const iconOf = async name => folderRow(name).locator('.nm').evaluate(node => (node.querySelector('.fe') ? `emoji:${node.querySelector('.fe').textContent}` : node.querySelector('use').getAttribute('href')));
const treeLook = async path => frame.locator(`.tr-row[data-path="${path}"]`).getAttribute('data-look');
const shot = name => lab.shotPanel(TAG, name, frame);
const pick = key => frame.locator(`[data-fk="${key}"]`);

// Ouvre la fenêtre « Apparence » d'un dossier par son menu ; rend vrai quand elle est ouverte.
async function openLook(name) {
  await openMenu(name);
  await frame.locator('.menu .menu-item', { hasText: t('lk.menu') }).click();
  await window_().waitFor({ timeout: 5000 }).catch(() => {});
  return (await window_().count()) === 1;
}
// Appliquer, puis attendre l'écriture : la ligne d'état du dossier dit l'apparence attendue (ou plus rien).
const applied = (path, expected) => until(async () => {
  const lines = await stateOf(path);
  return expected === null ? lines.every(line => lookOf(line) === null) : lines.length === 1 && same(lookOf(lines[0]), expected);
}, 8000);

say(`\n--- ${TAG} ---`);
say('1. Le menu d\'un dossier et la fenêtre');
check('GFS montre les dossiers de l\'app et ceux que garde Ana', same((await folderNames()).slice().sort(), ['Archives', ...COLORS.map(color => `Couleur ${color}`), 'Vide'].sort()), await folderNames());
check('aucun dossier n\'a d\'apparence avant le geste', (await dataLook('Archives')) === null && (await iconOf('Archives')) === '#i-folder', { look: await dataLook('Archives'), icon: await iconOf('Archives') });
await openMenu('Archives');
const labels = await menuLabels();
const at = labels.findIndex(entry => entry.label === t('lk.menu'));
check(`« ${t('lk.menu')} » est juste après « ${t('ex.rename')} », avec son icône, et n'est pas grisé`, at > 0 && labels[at - 1].label === t('ex.rename') && labels[at].icon && !labels[at].greyed, labels);
await page.keyboard.press('Escape');
check('la fenêtre s\'ouvre', await openLook('Archives'));
const fits = await windowFits(frame);
check('elle tient dans le panneau de 700 × 400 et rien n\'en sort', fits.shown && fits.inPanel && fits.overflowing.length === 0, fits);
check('son titre et le nom du dossier y sont', (await window_().locator('h2').textContent()) === t('lk.title') && (await window_().locator('.lk-name').textContent()) === 'Archives');
check('huit pastilles (par défaut et sept couleurs), treize icônes (le dossier et douze repères), un champ émoji', (await window_().locator('.lk-sw').count()) === 8 && (await window_().locator('.lk-gl').count()) === 13 &&
  (await window_().locator('.lk-in').count()) === 1, { sw: await window_().locator('.lk-sw').count(), gl: await window_().locator('.lk-gl').count() });
check('le clavier arrive sur la première pastille (« par défaut »), cochée', (await frame.evaluate(() => document.activeElement.dataset.fk)) === 'look-color-default' && (await pick('look-color-default').getAttribute('aria-checked')) === 'true');
await page.keyboard.press('ArrowRight');
check('la flèche droite choisit la couleur suivante (grise) et l\'aperçu la montre', (await pick('look-color-gray').getAttribute('aria-checked')) === 'true' && (await window_().locator('.lk-prev').getAttribute('data-look')) === 'gray');
await page.keyboard.press('End');
check('Fin choisit la dernière (violet) ; Tab quitte le groupe d\'un seul pas (un arrêt de tabulation)', (await pick('look-color-purple').getAttribute('aria-checked')) === 'true');
await page.keyboard.press('Tab');
check('Tab arrive sur l\'icône cochée (un seul arrêt par groupe)', (await frame.evaluate(() => document.activeElement.dataset.fk)) === 'look-glyph-folder', await frame.evaluate(() => document.activeElement.dataset.fk));
await shot('1-fenetre');
await pick('look-cancel').click();
check('« Annuler » ferme sans rien écrire', (await window_().count()) === 0 && (await stateOf('Archives')).length === 0);
// Au vrai clavier : Maj+F10 sur le dossier choisi, les flèches jusqu'à l'article, Entrée ; Tab reste dans la fenêtre ; Échap la ferme et rend le clavier à la ligne.
await folderRow('Archives').click();
await page.keyboard.press('Shift+F10');
await frame.locator('.menu').waitFor();
const onItem = () => frame.evaluate(() => (document.activeElement.classList.contains('menu-item') ? document.activeElement.querySelector('.menu-label').textContent.trim() : ''));
for (let i = 0; i < 12 && (await onItem()) !== t('lk.menu'); i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await window_().waitFor({ timeout: 5000 }).catch(() => {});
check('au clavier : Maj+F10, les flèches, puis Entrée ouvrent la fenêtre', (await window_().count()) === 1);
const visited = new Set();
let outside = false;
for (let i = 0; i < 40 && !outside; i++) {
  await page.keyboard.press('Tab');
  const now = await frame.evaluate(() => ({ inside: Boolean(document.activeElement.closest('.mod.lk-win')), fk: document.activeElement.dataset.fk || null }));
  outside = !now.inside;
  visited.add(now.fk);
}
check('Tab reste dans la fenêtre et visite le champ émoji et les trois boutons', !outside && ['look-emoji', 'look-ok', 'look-reset', 'look-cancel'].every(key => visited.has(key)), [...visited]);
await page.keyboard.press('Escape');
await window_().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
check('Échap ferme la fenêtre, sans rien écrire, et le clavier revient à la ligne du dossier', (await window_().count()) === 0 && (await stateOf('Archives')).length === 0 &&
  (await frame.evaluate(() => Boolean(document.activeElement.closest('.ls-row.folder')))));

say('\n2. Couleur et repère, à la souris');
const before = await prefsText();
await goHome();
await openLook('Archives');
await pick('look-color-red').click();
await pick('look-glyph-star').click();
check('l\'aperçu montre la couleur et le repère', (await window_().locator('.lk-prev').getAttribute('data-look')) === 'red' && (await window_().locator('.lk-prev use').getAttribute('href')) === '#i-fl-star');
await pick('look-ok').click();
check('la fenêtre se ferme et la liste montre la couleur et le repère tout de suite', (await window_().count()) === 0 && (await dataLook('Archives')) === 'red' && (await iconOf('Archives')) === '#i-fl-star', { look: await dataLook('Archives'), icon: await iconOf('Archives') });
check('le volet montre la couleur aussi', (await treeLook('Archives')) === 'red', await treeLook('Archives'));
check('Grist retient une seule ligne d\'état, à l\'adresse d\'Ana : { couleur, repère }', await applied('Archives', { color: 'red', glyph: 'star' }), await stateOf('Archives'));
check('les lignes de Publipostage+ (ses modèles, ses dossiers) n\'ont pas bougé', (await prefsText()) === before);
check('Archives garde ses deux modèles, le dossier existe toujours une seule fois', same((await folderNames()).filter(name => name === 'Archives'), ['Archives']));
await folderRow('Archives').click();
check('la barre d\'information du dossier choisi a la couleur', (await frame.locator('.inf').first().getAttribute('data-look')) === 'red');
await shot('2-liste');
await reopen();
check('rechargé, le dossier garde sa couleur et son repère', (await dataLook('Archives')) === 'red' && (await iconOf('Archives')) === '#i-fl-star', { look: await dataLook('Archives'), icon: await iconOf('Archives') });

say('\n3. Un émoji');
await openLook('Archives');
check('la fenêtre montre l\'apparence d\'aujourd\'hui (rouge, étoile)', (await pick('look-color-red').getAttribute('aria-checked')) === 'true' && (await pick('look-glyph-star').getAttribute('aria-checked')) === 'true');
await pick('look-emoji').click();
await pick('look-emoji').fill('abc');
check('« abc » n\'est pas un émoji : la phrase le dit, « Appliquer » est grisé', (await window_().locator('.lk-note').textContent()) === t('lk.emojiBad') && (await pick('look-ok').getAttribute('aria-disabled')) === 'true');
await page.keyboard.press('Enter');
check('Entrée n\'écrit rien et la fenêtre reste ouverte', (await window_().count()) === 1 && same(lookOf((await stateOf('Archives'))[0]), { color: 'red', glyph: 'star' }));
await pick('look-emoji').fill('🧾');
check('« 🧾 » est accepté sans phrase : le repère se décoche, l\'aperçu montre l\'émoji', (await window_().locator('.lk-note').textContent()) === '' && (await window_().locator('.lk-gl[aria-checked="true"]').count()) === 0 &&
  (await window_().locator('.lk-prev .fe').textContent()) === '🧾');
await shot('3-emoji');
await page.keyboard.press('Enter');
check('Entrée applique : la liste montre l\'émoji (un seul, caché pour la lecture d\'écran) à la place du repère, la couleur reste', (await iconOf('Archives')) === 'emoji:🧾' && (await dataLook('Archives')) === 'red' &&
  (await folderRow('Archives').locator('.fe').getAttribute('aria-hidden')) === 'true');
check('le nom reste « Archives » (l\'émoji n\'est pas dans le nom)', same((await folderNames()).filter(name => name.includes('Archives')), ['Archives']));
check('Grist retient { couleur, émoji } sur la même ligne', await applied('Archives', { color: 'red', emoji: '🧾' }), await stateOf('Archives'));
await pick('look-ok').waitFor({ state: 'detached' }).catch(() => {});
await openLook('Archives');
await pick('look-emoji').fill('1');
check('un chiffre n\'est pas un émoji (comme dans Grist)', (await window_().locator('.lk-note').textContent()) === t('lk.emojiBad'));
await pick('look-cancel').click();
check('Annuler : l\'émoji d\'avant est toujours là', (await iconOf('Archives')) === 'emoji:🧾');

say('\n4. Renommer et déplacer');
const rowId = (await stateOf('Archives'))[0].id;
await goHome();
await folderRow('Archives').click();
await page.keyboard.press('F2');
await frame.locator('.nw').waitFor();
await page.keyboard.press('Control+a');
await page.keyboard.type('Classés');
await page.keyboard.press('Enter');
await until(async () => (await folderNames()).includes('Classés'));
check('renommé, le dossier garde sa couleur et son émoji', (await dataLook('Classés')) === 'red' && (await iconOf('Classés')) === 'emoji:🧾', { look: await dataLook('Classés'), icon: await iconOf('Classés') });
check('la ligne d\'état est la même (même numéro), son chemin a changé : aucune ligne de plus', await until(async () => { const lines = await stateOf('Classés'); return lines.length === 1 && lines[0].id === rowId; }) && (await stateOf('Archives')).length === 0, await stateLines());
await folderRow('Classés').click();
await page.keyboard.press('Control+x');
await goHome();
await folderRow('Vide').dblclick();
await page.waitForTimeout(300);
await page.keyboard.press('Control+v');
await until(async () => (await stateOf('Vide/Classés')).length === 1);
check('déplacé dans « Vide », le dossier garde son apparence (même ligne, chemin « Vide/Classés »)', (await stateOf('Vide/Classés')).length === 1 && (await stateOf('Vide/Classés'))[0].id === rowId &&
  same(lookOf((await stateOf('Vide/Classés'))[0]), { color: 'red', emoji: '🧾' }), await stateLines());
check('dans la liste de « Vide » : la couleur et l\'émoji', (await dataLook('Classés')) === 'red' && (await iconOf('Classés')) === 'emoji:🧾');
await page.keyboard.press('Control+z');
await until(async () => (await stateOf('Classés')).length === 1);
await goHome();
check('Ctrl+Z remet le dossier à sa place, avec son apparence', (await dataLook('Classés')) === 'red' && (await iconOf('Classés')) === 'emoji:🧾' && (await stateOf('Classés')).length === 1 && (await stateOf('Vide/Classés')).length === 0, await stateLines());
await reopen();
check('rechargé : toujours la couleur et l\'émoji sous le nouveau nom', (await dataLook('Classés')) === 'red' && (await iconOf('Classés')) === 'emoji:🧾');

say('\n5. Ctrl+Z, Ctrl+Y et « Rétablir »');
await openLook('Classés');
await pick('look-color-blue').click();
await pick('look-ok').click();
check('bleu', await applied('Classés', { color: 'blue', emoji: '🧾' }) && (await dataLook('Classés')) === 'blue');
await frame.locator('.ls-scroll, .ex-scroll').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press('Control+z');
check('Ctrl+Z rend le rouge', await applied('Classés', { color: 'red', emoji: '🧾' }) && (await dataLook('Classés')) === 'red', await stateOf('Classés'));
check('la phrase dit ce qui a été défait', await until(async () => (await frame.locator('#toast').textContent()) === t('undo.look', { name: 'Classés' }), 3000), await frame.locator('#toast').textContent());
await page.keyboard.press('Control+y');
check('Ctrl+Y remet le bleu', await applied('Classés', { color: 'blue', emoji: '🧾' }) && (await dataLook('Classés')) === 'blue');
await openLook('Classés');
await pick('look-reset').click();
check('« Rétablir » : l\'aperçu reprend le dossier d\'origine', (await window_().locator('.lk-prev use').getAttribute('href')) === '#i-folder' && (await window_().locator('.lk-prev').getAttribute('data-look')) === null);
await pick('look-ok').click();
check('le dossier reprend l\'accent de l\'ambiance et l\'icône d\'origine', (await dataLook('Classés')) === null && (await iconOf('Classés')) === '#i-folder', { look: await dataLook('Classés'), icon: await iconOf('Classés') });
check('la cellule est vidée ; la ligne d\'état reste (le dossier est gardé)', await applied('Classés', null) && (await stateOf('Classés')).length === 1 && (await stateOf('Classés'))[0].Value === '', await stateOf('Classés'));

say('\n6. Un dossier vide qui a une apparence se supprime');
await openLook('Vide');
await pick('look-glyph-heart').click();
await pick('look-ok').click();
check('« Vide » a un cœur', await applied('Vide', { glyph: 'heart' }));
await folderRow('Vide').hover();
await folderRow('Vide').locator('.rb.mn').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${t('ex.deleteFolder')}`) }).click();
await until(async () => !(await folderNames()).includes('Vide'));
check('le dossier a disparu, sa ligne d\'état avec lui, chez GFS comme chez Publipostage+', await until(async () => (await stateOf('Vide')).length === 0 &&
  !(await rows(PREFS)).some(line => line.ModeleId === 0 && line.Dossier === 'Vide'), 8000), { gfs: await stateOf('Vide') });
await goHome();
await page.keyboard.press('Control+z');
await until(async () => (await folderNames()).includes('Vide'));
check('Ctrl+Z rend le dossier avec son repère (le cœur) : l\'apparence ne se perd pas avec la ligne', (await iconOf('Vide')) === '#i-fl-heart' && (await applied('Vide', { glyph: 'heart' })), { icon: await iconOf('Vide'), gfs: await stateOf('Vide') });
await reopen();
check('rechargé : le cœur est toujours là', (await iconOf('Vide')) === '#i-fl-heart', await iconOf('Vide'));

say('\n7. Les sept couleurs : contraste et vignettes');
const measure = () => frame.evaluate(colors => {
  const parse = value => {
    const modern = value.match(/color\(srgb ([^)]+)\)/);
    if (modern) { const [r, g, b, a = 1] = modern[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; }
    const legacy = value.match(/rgba?\(([^)]+)\)/);
    const [r, g, b, a = 1] = legacy[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const luminance = ({ r, g, b }) => { const f = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = luminance(a); const y = luminance(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
  const behind = element => {
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.push(node);
    return chain.reverse().reduce((color, node) => { const bg = parse(getComputedStyle(node).backgroundColor); return bg && bg.a > 0 ? over(bg, color) : color; }, { r: 255, g: 255, b: 255, a: 1 });
  };
  const out = {};
  for (const color of colors) {
    const rowEl = [...document.querySelectorAll('.ls-row.folder, .th.folder')].find(node => node.querySelector('.t, .tn') && /^Couleur /.test((node.querySelector('.t, .tn').textContent || '')) &&
      node.querySelector('.t, .tn').textContent === `Couleur ${color}`);
    if (!rowEl) { out[color] = null; continue; }
    const svg = rowEl.querySelector('svg.ic.fld');
    const preview = rowEl.querySelector('.th-pv') || rowEl;
    const stroke = parse(getComputedStyle(svg).color);
    const name = rowEl.querySelector('.t, .tn');
    out[color] = { look: rowEl.dataset.look, icon: ratio(over(stroke, behind(preview)), behind(preview)), name: ratio(parse(getComputedStyle(name).color), behind(name)), opacity: getComputedStyle(svg).opacity };
  }
  return out;
}, COLORS);
const list = await measure();
check('chaque dossier de couleur montre sa couleur (liste)', COLORS.every(color => list[color] && list[color].look === color), list);
check('le trait de l\'icône tient 3:1 sur la ligne, le nom 4,5:1 (liste)', COLORS.every(color => list[color] && list[color].icon >= 3 && list[color].name >= 4.5), list);
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-tiles"]') }).click();
await page.waitForTimeout(400);
const tiles = await measure();
check('chaque dossier de couleur montre sa couleur (vignettes)', COLORS.every(color => tiles[color] && tiles[color].look === color), tiles);
check('le trait de l\'icône tient 3:1 sur la vignette, le nom 4,5:1 (vignettes)', COLORS.every(color => tiles[color] && tiles[color].icon >= 3 && tiles[color].name >= 4.5), tiles);
await shot('7-vignettes');
await frame.locator('button[aria-label]', { has: frame.locator('use[href="#i-list"]') }).click();
await page.waitForTimeout(300);
await openLook('Classés');
const checks = await frame.evaluate(() => [...document.querySelectorAll('.lk-sw[data-look]')].map(sw => {
  const parse = value => { const m = value.match(/color\(srgb ([^)]+)\)/); if (m) { const [r, g, b] = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255 }; } const [r, g, b] = value.match(/rgba?\(([^)]+)\)/)[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r, g, b }; };
  const luminance = ({ r, g, b }) => { const f = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mark = parse(getComputedStyle(sw.querySelector('svg')).color);
  const fill = parse(getComputedStyle(sw).backgroundColor);
  const x = luminance(mark); const y = luminance(fill);
  return { color: sw.dataset.look, ratio: Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100 };
}));
check('la coche de chaque pastille tient 3:1 sur sa couleur', checks.length === 7 && checks.every(each => each.ratio >= 3), checks);
await shot('7-pastilles');
await pick('look-cancel').click();

say('\n8. La console');
check('la console de GFS est restée muette', warnings.length === 0, warnings);
await lab.browser.close();
