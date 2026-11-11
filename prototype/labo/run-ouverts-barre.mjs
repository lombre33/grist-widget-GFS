// Le 5e bouton de la barre, « Fichiers ouverts » (js/explorer/opened-bar.js, contrats 5.2 point 7 et 6.4 point 14), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier : la liste des fichiers que GFS a
// ouverts dans une app, à un clic de l'app, pour y revenir et faire des allers-retours sans repasser par l'explorateur. Les deux apps sont les sondes O (labo/sondes/o-ouvrir/, qui répond à `fermer` selon
// `body[data-fermer]`) et Q (qui ne connaît pas l'appel). Mesuré : la place du bouton (deuxième, entre « Fichiers » et « Apps ») et la barre de 34 × 154 ; le bouton grisé sans fichier ouvert (jamais masqué)
// et son menu qui le dit ; la pastille et le nom du bouton qui portent le nombre ; l'ordre du plus récent au plus ancien ; le fichier affiché marqué par un mot (pas une couleur seule) ; le va-et-vient par la
// barre (l'app active est priée de se fermer, le fichier part dans l'ouverture) ; un clic sur le fichier affiché ne relance rien ; la croix à la souris, Suppr au clavier (→ pour y aller, ↓ ne s'y arrête
// pas) ; « Ouvrir un autre fichier… » montre l'explorateur ; le nombre est celui de la ligne « Ouverts » de l'explorateur ; le menu s'ouvre sans recouvrir la barre et tient dans le cadre sur les quatre
// bords ; le contraste de chaque texte et de la pastille ; huit fichiers au plus ; l'accessibilité renforcée (cibles de 36 px).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, probeDeclares, contrastAudit } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const fr = lang === 'fr';
const run = `ouverts-barre-${lang}-${scheme}`;
const WORD = fr
  ? { tip: 'Fichiers ouverts', tipN: n => `Fichiers ouverts : ${n}`, none: 'Aucun fichier ouvert', more: 'Ouvrir un autre fichier…', shown: 'affiché', dropOf: name => `Retirer des ouverts : ${name}`,
    why: /Les fichiers que vous ouvrez depuis l’explorateur restent ici/, files: 'Ouvrir l’explorateur de fichiers', apps: 'Apps et extensions de Grist Factory Suite', place: 'Position de la barre',
    edges: { gauche: 'À gauche', haut: 'En haut', droite: 'À droite', bas: 'En bas' } }
  : { tip: 'Open files', tipN: n => `Open files: ${n}`, none: 'No open files', more: 'Open another file…', shown: 'shown', dropOf: name => `Remove from open files: ${name}`,
    why: /Files you open from the explorer stay here/, files: 'Open the file explorer', apps: 'Apps and extensions of Grist Factory Suite', place: 'Bar position',
    edges: { gauche: 'Left', haut: 'Top', droite: 'Right', bas: 'Bottom' } };
const ACCEPTS = [probeDeclares('sonde-o', { ouverture: { fichier: true, nouveau: true } }), probeDeclares('sonde-q', { ouverture: { fichier: true, nouveau: true } })];
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [...ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && isGfsWarning(m.text())) warnings.push(m.text()); });

const now = Math.floor(Date.now() / 1000);
const MANY = Array.from({ length: 9 }, (_, i) => `Pièce ${i + 1}`);
await lab.frame.evaluate(async ([stamp, many]) => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeO_Fichiers', columns], ['AddTable', 'SondeQ_Fichiers', columns]]);
  const names = ['Premier', 'Deuxième', 'Troisième', ...many];
  await grist.docApi.applyUserActions([
    ['BulkAddRecord', 'SondeO_Fichiers', names.map(() => null), { Nom: names, Type: names.map(() => 'document'), DateModif: names.map((_, i) => stamp - 60 - i * 10) }],
    ['BulkAddRecord', 'SondeQ_Fichiers', [null], { Nom: ['Projet Q'], Type: ['projet'], DateModif: [stamp - 30] }],
  ]);
}, [now, MANY]);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const O = /o-ouvrir\//;
const Q = /q-liens\//;
const frameOf = re => page.frames().find(f => re.test(f.url()));
const count = re => page.frames().filter(f => re.test(f.url())).length;
const readProbe = f => f.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')).catch(() => ({}));
const waitFor = async (label, test, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const ex = frame.locator('.ex');
const bar = frame.locator('#floaters');
const button = frame.locator('#floater-opened');
const menu = frame.locator('.menu-opened');
const toast = frame.locator('#toast');
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const shot = name => lab.shotPanel(run, name, frame);
const ready = re => waitFor(`le contexte de ${re}`, async () => { const f = frameOf(re); return Boolean(f) && (await readProbe(f)).contexte === true; });
const setClose = mode => frameOf(O).evaluate(value => { document.body.dataset.fermer = value; }, mode);
const showExplorer = async () => { if (!(await ex.isVisible())) await frame.locator('#floater-files').click(); await ex.waitFor({ state: 'visible' }); };
const goRoot = async () => { await showExplorer(); await frame.locator('.tr-row[data-path=""]').first().click(); await row('Premier').waitFor(); };
const openFromExplorer = async name => { await goRoot(); await row(name).dblclick(); await waitFor(`${name} ouvert`, async () => !(await ex.isVisible())); await bar.waitFor({ state: 'visible' }); };
const badge = async () => ((await button.locator('.badge').count()) ? (await button.locator('.badge').innerText()).trim() : '');
const rowsOf = () => menu.locator('.menu-row > .menu-item:not(.menu-drop)').evaluateAll(list => list.map(item => ({
  name: item.querySelector('.menu-label').textContent.trim(), app: (item.querySelector('.menu-hint') || {}).textContent, current: item.getAttribute('aria-current') === 'true',
  word: (item.querySelector('.sr-only') || {}).textContent, weight: getComputedStyle(item).fontWeight,
})));
const menuNames = async () => (await rowsOf()).map(item => item.name);
const openMenu = async () => { await button.click(); await menu.waitFor({ state: 'visible' }); };
const closeMenu = async () => { if (await menu.isVisible()) await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' }); };
const focusId = () => frame.evaluate(() => document.activeElement && document.activeElement.id);
const focusText = () => frame.evaluate(() => { const el = document.activeElement; return el ? { cls: el.className, label: (el.querySelector && el.querySelector('.menu-label') || {}).textContent || el.getAttribute('aria-label') } : null; });
const stageBox = () => frame.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; });
const rectOf = selector => frame.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, selector);
const overlaps = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) <= tolerance;

await lab.openApp('sonde-o', O, frame);
await lab.openApp('sonde-q', Q, frame);
await ready(Q);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. la place du bouton et la barre : cinq boutons, « Fichiers ouverts » le deuxième, 34 × 154 ===');
await bar.waitFor({ state: 'visible' });
const order = await frame.evaluate(() => [...document.querySelectorAll('#floaters .floater')].map(b => b.id));
check('cinq boutons : Fichiers, Fichiers ouverts, Apps, Table de travail, Position', JSON.stringify(order) === JSON.stringify(['floater-files', 'floater-opened', 'floater-apps', 'floater-work', 'floater-place']), order);
const barRect = await rectOf('#floaters');
const stage = await stageBox();
check('la barre mesure 34 × 154 px, à 4 px du bord gauche et centrée sur lui', near(barRect.width, 34) && near(barRect.height, 154) && near(barRect.left - stage.left, 4) && near((barRect.top + barRect.bottom) / 2, (stage.top + stage.bottom) / 2, 1), barRect);
const named = await button.evaluate(b => ({ title: b.title, label: b.getAttribute('aria-label'), text: b.textContent.trim(), icons: b.querySelectorAll('svg').length, popup: b.getAttribute('aria-haspopup'), empty: b.dataset.empty, expanded: b.getAttribute('aria-expanded') }));
check('sans fichier ouvert : icône seule, nom = info-bulle = « Fichiers ouverts », sans pastille, grisé (jamais masqué)', named.title === WORD.tip && named.label === WORD.tip && named.text === '' && named.icons === 1 && named.popup === 'menu' && named.empty === 'true' && (await badge()) === '', named);
const box = await rectOf('#floater-opened');
check('le bouton mesure 28 × 28 px', near(box.width, 28) && near(box.height, 28), box);
const idle = await button.evaluate(b => { const css = getComputedStyle(b); return { color: css.color }; });
const filesColor = await frame.locator('#floater-files').evaluate(b => getComputedStyle(b).color);
check('grisé : sa couleur n\'est pas celle des boutons actifs', idle.color !== filesColor, { ouvert: idle.color, fichiers: filesColor });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. rien d\'ouvert : le menu le dit, l\'article grisé explique, « Ouvrir un autre fichier… » reste ===');
await openMenu();
check('le menu a un titre, un article grisé « Aucun fichier ouvert », un séparateur, « Ouvrir un autre fichier… »', JSON.stringify(await menu.evaluate(m => [...m.children].map(el => (el.tagName === 'HR' ? '-' : el.textContent.trim())))) === JSON.stringify([WORD.tip, WORD.none, '-', WORD.more]), await menu.innerText());
check('le bouton déclare le menu ouvert (aria-expanded)', (await button.getAttribute('aria-expanded')) === 'true');
await shot('1-vide');
await menu.locator('.menu-item', { hasText: WORD.none }).click({ force: true });
await toast.waitFor({ state: 'visible' });
check('un clic sur l\'article grisé dit pourquoi et comment', WORD.why.test(await toast.innerText()), await toast.innerText());
const hidden = await toast.waitFor({ state: 'hidden', timeout: 9000 }).then(() => true, () => false);
check('la phrase s\'efface d\'elle-même (elle ne reste pas sur les captures d\'après)', hidden, await toast.innerText());
await openMenu();
await page.keyboard.press('Escape');
await menu.waitFor({ state: 'detached' });
check('Échap referme le menu et rend le clavier au bouton', (await focusId()) === 'floater-opened' && (await button.getAttribute('aria-expanded')) === 'false', { focus: await focusId() });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. un fichier ouvert : la pastille « 1 », le nom du bouton, le fichier affiché marqué ===');
await openFromExplorer('Premier');
await ready(O);
check('la pastille dit 1 et le nom du bouton aussi (« Fichiers ouverts : 1 »), le bouton n\'est plus grisé', (await badge()) === '1' && (await button.getAttribute('aria-label')) === WORD.tipN(1) && (await button.getAttribute('title')) === WORD.tipN(1) && (await button.getAttribute('data-empty')) === 'false');
await openMenu();
const one = await rowsOf();
check('le menu montre « Premier » seul, marqué affiché (gras, trait, mot pour un lecteur d\'écran, aria-current)', one.length === 1 && one[0].name === 'Premier' && one[0].current && new RegExp(`${WORD.shown}$`).test(one[0].word || '') && Number(one[0].weight) >= 600, one);
check('le nom de l\'app est dit en indice', Boolean(one[0] && one[0].app && one[0].app.trim()), one);
await closeMenu();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. un fichier d\'une autre app : la pastille « 2 », le plus récent en tête, le fichier affiché a changé ===');
await setClose('oui');
await openFromExplorer('Projet Q');
await waitFor('Q ouvert', async () => count(Q) === 1 && count(O) === 0);
await ready(Q);
check('la pastille dit 2 et le nom du bouton « Fichiers ouverts : 2 »', (await badge()) === '2' && (await button.getAttribute('aria-label')) === WORD.tipN(2));
await openMenu();
const two = await rowsOf();
check('du plus récent au plus ancien : « Projet Q » (affiché) puis « Premier »', JSON.stringify(two.map(item => [item.name, item.current])) === JSON.stringify([['Projet Q', true], ['Premier', false]]), two);
const appOf = await menu.locator('.menu-hint').allInnerTexts();
check('chaque fichier dit son app (celles des deux sondes, différentes)', appOf.length === 2 && appOf[0] !== appOf[1], appOf);
check('le clavier arrive sur le fichier affiché (le premier)', (await focusText()).label === 'Projet Q', await focusText());
await shot('2-deux-ouverts');
await closeMenu();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. l\'aller-retour par la barre, sans repasser par l\'explorateur ===');
await openMenu();
await menu.locator('.menu-row', { hasText: 'Premier' }).locator('.menu-item:not(.menu-drop)').click();
await waitFor('O ouvert', async () => count(O) === 1 && count(Q) === 0);
await ready(O);
const back = await readProbe(frameOf(O));
check('la sonde Q est partie, la sonde O s\'ouvre sur « Premier » (raison « explorateur », comme un double-clic de la liste)', count(O) === 1 && count(Q) === 0 && back.ouverture && back.ouverture.fichier.id === '1' && back.ouverture.raison === 'explorateur', back.ouverture);
check('l\'explorateur est resté fermé et la barre est là', !(await ex.isVisible()) && (await bar.isVisible()));
await openMenu();
const swapped = await rowsOf();
check('toujours 2 fichiers (rien de dupliqué) ; « Premier » passe en tête et c\'est lui qui est affiché', (await badge()) === '2' && JSON.stringify(swapped.map(item => [item.name, item.current])) === JSON.stringify([['Premier', true], ['Projet Q', false]]), swapped);
const before = await readProbe(frameOf(O));
await menu.locator('.menu-row', { hasText: 'Premier' }).locator('.menu-item:not(.menu-drop)').click();
await page.waitForTimeout(600);
const after = await readProbe(frameOf(O));
check('un clic sur le fichier déjà affiché referme le menu et ne relance rien', !(await menu.isVisible()) && JSON.stringify(after.ouverture) === JSON.stringify(before.ouverture) && count(O) === 1, { avant: before.ouverture, apres: after.ouverture });
await setClose('oui');
await openMenu();
await menu.locator('.menu-row', { hasText: 'Projet Q' }).locator('.menu-item:not(.menu-drop)').click();
await waitFor('Q ouvert', async () => count(Q) === 1 && count(O) === 0);
await ready(Q);
check('un deuxième retour par la barre : « Projet Q » est de nouveau là, la pastille dit toujours 2', (await badge()) === '2' && count(Q) === 1);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 6. retirer de la liste : la croix à la souris, Suppr au clavier ===');
await openMenu();
const premierDrop = menu.locator('.menu-row', { hasText: 'Premier' }).locator('.menu-drop');
check('la croix de chaque ligne a pour nom « Retirer des ouverts : <fichier> »', (await premierDrop.getAttribute('aria-label')) === WORD.dropOf('Premier') && (await premierDrop.getAttribute('title')) === WORD.dropOf('Premier'));
const dropBox = await premierDrop.boundingBox();
check('la croix est une cible d\'au moins 24 × 24 px', dropBox.width >= 24 && dropBox.height >= 24, dropBox);
await premierDrop.click();
await menu.waitFor({ state: 'visible' });
check('un clic sur la croix retire « Premier » : le menu se rouvre sans lui, la pastille passe à 1, l\'app affichée ne change pas', (await badge()) === '1' && JSON.stringify(await menuNames()) === JSON.stringify(['Projet Q']) && count(Q) === 1, { nombre: await badge(), noms: await menuNames() });
await closeMenu();
// De quoi retirer au clavier : deux fichiers de plus dans la liste.
await openFromExplorer('Deuxième');
await ready(O);
await openFromExplorer('Troisième');
await waitFor('Troisième ouvert', async () => (await badge()) === '3');
check('la liste compte « Projet Q », « Deuxième » et « Troisième » : la pastille dit 3', (await badge()) === '3', await badge());
await button.focus();
await page.keyboard.press('Enter');
await menu.waitFor({ state: 'visible' });
const rowsNow = await menuNames();
check('Entrée sur le bouton ouvre le menu et le clavier arrive sur le fichier affiché (« Troisième »)', rowsNow[0] === 'Troisième' && (await focusText()).label === 'Troisième', { noms: rowsNow, focus: await focusText() });
await page.keyboard.press('ArrowDown');
const second = (await focusText()).label;
await page.keyboard.press('ArrowRight');
const onDrop = await focusText();
check('↓ passe au fichier suivant ; → va à la croix de cette ligne ; ← revient à l\'article', second === rowsNow[1] && onDrop.cls.includes('menu-drop') && onDrop.label === WORD.dropOf(rowsNow[1]), { second, onDrop });
await page.keyboard.press('ArrowLeft');
check('← revient à l\'article de la ligne', (await focusText()).label === rowsNow[1], await focusText());
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
check('↓ depuis une croix passe à la ligne d\'après (la croix n\'est pas un arrêt de plus)', (await focusText()).label === rowsNow[2], await focusText());
await page.keyboard.press('ArrowUp');
await page.keyboard.press('Delete');
await menu.waitFor({ state: 'visible' });
const afterDelete = await menuNames();
check('Suppr retire la ligne qui a le clavier ; le menu se rouvre sans elle', afterDelete.length === rowsNow.length - 1 && !afterDelete.includes(rowsNow[1]), { avant: rowsNow, apres: afterDelete });
check('le clavier reste dans le menu, sur la ligne qui a pris la place de celle qui est partie', (await focusText()).label === afterDelete[1], await focusText());
await page.keyboard.press('Home');
check('Début : le premier article', (await focusText()).label === afterDelete[0], await focusText());
await page.keyboard.press('End');
check('Fin : « Ouvrir un autre fichier… »', (await focusText()).label === WORD.more, await focusText());
await closeMenu();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 7. « Ouvrir un autre fichier… » montre l\'explorateur ; le nombre est celui de la ligne « Ouverts » ===');
const barCount = await badge();
await openMenu();
await menu.locator('.menu-item', { hasText: WORD.more }).click();
await ex.waitFor({ state: 'visible' });
check('l\'explorateur est à l\'écran et la barre s\'efface (comme avec « Fichiers »)', (await ex.isVisible()) && !(await bar.isVisible()));
const treeCount = (await frame.locator('.tr-row[data-view="opened"] .cnt').innerText()).trim();
check('la ligne « Ouverts » de l\'explorateur compte autant que la pastille de la barre', treeCount === barCount, { barre: barCount, explorateur: treeCount });
await frame.locator('.ex-foot .btn', { hasText: fr ? /^Fermer$/ : /^Close$/ }).click();
await bar.waitFor({ state: 'visible' });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 8. huit fichiers au plus : le plus ancien sort quand un neuvième arrive ===');
for (const name of MANY.slice(0, 8)) { await openFromExplorer(name); await ready(O); }
await waitFor('huit', async () => (await badge()) === '8');
check('la pastille s\'arrête à 8 (les huit derniers)', (await badge()) === '8', await badge());
await openMenu();
const eight = await menuNames();
check('du plus récent au plus ancien : « Pièce 8 » en tête, 8 lignes, plus aucun des premiers fichiers', eight.length === 8 && eight[0] === 'Pièce 8' && eight[7] === 'Pièce 1' && !eight.includes('Projet Q'), eight);
const tall = await rectOf('.menu-opened');
check('la liste de huit tient dans le cadre (au plus 300 px de haut, l\'article « Ouvrir un autre fichier… » atteignable)', tall.height <= 300.5 && tall.top >= stage.top && tall.bottom <= stage.bottom, tall);
await shot('3-huit');
await closeMenu();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 9. le menu sur les quatre bords : à côté de la barre sans la recouvrir, dans le cadre ===');
const SIDE = { gauche: 'right', haut: 'below', droite: 'left', bas: 'above' };
for (const edge of ['gauche', 'haut', 'droite', 'bas']) {
  await frame.locator('#floater-place').click();
  await frame.locator('.menu .menu-item', { hasText: WORD.edges[edge] }).click();
  await page.waitForTimeout(250);
  await openMenu();
  const m = await rectOf('.menu-opened');
  const b = await rectOf('#floaters');
  const s = await stageBox();
  const where = SIDE[edge] === 'right' ? m.left >= b.right - 0.5 : SIDE[edge] === 'left' ? m.right <= b.left + 0.5 : SIDE[edge] === 'below' ? m.top >= b.bottom - 0.5 : m.bottom <= b.top + 0.5;
  check(`bord ${edge} : le menu s'ouvre ${SIDE[edge] === 'right' ? 'à droite' : SIDE[edge] === 'left' ? 'à gauche' : SIDE[edge] === 'below' ? 'au-dessous' : 'au-dessus'} de la barre, sans la recouvrir, dans le cadre`, !overlaps(m, b) && where && m.left >= s.left - 0.5 && m.right <= s.right + 0.5 && m.top >= s.top - 0.5 && m.bottom <= s.bottom + 0.5, { menu: m, barre: b, cadre: s });
  const names = await menuNames();
  const hidden = await frame.evaluate(() => { const menuEl = document.querySelector('.menu-opened'); const last = menuEl.querySelector('.menu-item:last-of-type'); return last ? menuEl.scrollHeight > menuEl.clientHeight + 1 : false; });
  check(`bord ${edge} : les huit fichiers sont là (la liste défile au besoin)`, names.length === 8, { noms: names.length, defile: hidden });
  if (edge === 'droite') await shot('4-bord-droite');
  await closeMenu();
}
await frame.locator('#floater-place').click();
await frame.locator('.menu .menu-item', { hasText: WORD.edges.gauche }).click();
await page.waitForTimeout(250);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 10. lisible : chaque texte du menu et de la barre à 4,5:1 au moins, la pastille comprise ===');
await openMenu();
const audit = await contrastAudit(frame, '.menu-opened');
check('chaque texte du menu des fichiers ouverts (titre, noms, indices, article grisé, « affiché » compris) se lit à 4,5:1 au moins', audit.failures.length === 0 && audit.seen >= 8, audit);
// La pastille et le titre du menu sont cachés aux lecteurs d'écran (le nombre est dans le nom du bouton, le titre dans celui du menu) : l'audit de contraste les saute, on les mesure ici, texte contre fond.
const ratios = await frame.evaluate(() => {
  const parse = c => c.match(/[\d.]+/g).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => { const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const backdrop = el => { for (let node = el; node; node = node.parentElement) { const c = parse(getComputedStyle(node).backgroundColor); if (c.length === 3 || c[3] === 1) return c; } return [255, 255, 255]; };
  const ratio = el => { const [hi, lo] = [lum(parse(getComputedStyle(el).color)), lum(backdrop(el))].sort((a, b) => b - a); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const pick = sel => { const el = document.querySelector(sel); return el ? ratio(el) : null; };
  return { pastille: pick('#floater-opened .badge'), titre: pick('.menu-opened .menu-title'), indice: pick('.menu-opened .menu-item.is-current .menu-hint'), affiche: pick('.menu-opened .menu-item.is-current .menu-label') };
});
check('la pastille (blanc sur le bleu plein), le titre, le fichier affiché et son indice se lisent à 4,5:1 au moins', Object.values(ratios).every(value => value !== null && value >= 4.5), ratios);
const clipped = await frame.evaluate(() => [...document.querySelectorAll('.menu-opened .menu-label')].filter(el => el.scrollWidth > el.clientWidth + 1 && !el.closest('.menu-item').title).map(el => el.textContent));
check('un nom coupé par « … » garde son texte entier au survol', clipped.length === 0, clipped);
await closeMenu();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 11. l\'accessibilité renforcée : cibles de 36 px, la barre et le menu tiennent encore ===');
await frame.evaluate(() => document.documentElement.setAttribute('data-ambiance', 'renforcee'));
await page.waitForTimeout(300);
const targets = await frame.evaluate(() => [...document.querySelectorAll('#floaters .floater')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
check('les cinq boutons de la barre mesurent 36 × 36 px', targets.length === 5 && targets.every(([w, h]) => w >= 36 && h >= 36), targets);
await openMenu();
const big = await rectOf('.menu-opened');
const bigBar = await rectOf('#floaters');
const rowsBig = await menu.locator('.menu-item').evaluateAll(list => list.map(item => { const r = item.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
check('les lignes du menu et les croix mesurent 36 px de haut au moins', rowsBig.every(([, h]) => h >= 36) && rowsBig.filter(([w]) => w <= 40).every(([w]) => w >= 36), rowsBig.slice(0, 4));
check('le menu ne recouvre pas la barre et reste dans le cadre', !overlaps(big, bigBar) && big.top >= stage.top - 0.5 && big.bottom <= stage.bottom + 0.5, { menu: big, barre: bigBar });
await page.keyboard.press('End');
check('« Ouvrir un autre fichier… » reste atteignable au clavier même quand la liste défile', (await focusText()).label === WORD.more, await focusText());
await shot('5-renforcee');
await closeMenu();
await frame.evaluate(() => document.documentElement.removeAttribute('data-ambiance'));

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
