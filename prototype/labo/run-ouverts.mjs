// La vue « Ouverts » de l'explorateur (js/explorer/opened-files.js, contrats 6.4 point 14), dans un vrai Grist, à 700 × 400, à la vraie souris : les fichiers que GFS a ouverts dans une app depuis que la personne est là,
// pour y revenir d'un double-clic et faire des allers-retours sans repartir de l'arborescence. Les deux apps sont les sondes O (labo/sondes/o-ouvrir/, qui répond à `fermer` selon `body[data-fermer]`) et Q
// (qui ne connaît pas l'appel et part comme avant). Mesuré : la liste vide et son message, le nombre et l'ordre (par nom), le mot « affiché » sur le fichier que l'app montre, le retour d'un fichier à l'autre
// par la liste (l'app active est priée de se fermer, le fichier part dans l'ouverture), un refus dans l'app (la liste ne change pas), « Retirer des ouverts », le contraste de chaque texte, la mise en page à 700 × 400.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, probeDeclares, contrastAudit } from './lab-common.mjs';
import { collectWarnings, waiter, seedProbeFiles, reopenGfs, probeTools } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const fr = lang === 'fr';
const run = `ouverts-${lang}-${scheme}`;
const WORD = fr
  ? { opened: 'Ouverts', shown: 'affiché', empty: /Aucun fichier ouvert pour le moment/, drop: 'Retirer des ouverts', more: 'Plus d’actions' }
  : { opened: 'Open', shown: 'shown', empty: /No open files yet/, drop: 'Remove from open files', more: 'More actions' };
const ACCEPTS = [probeDeclares('sonde-o', { ouverture: { fichier: true, nouveau: true } }), probeDeclares('sonde-q', { ouverture: { fichier: true, nouveau: true } })];
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [...ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = collectWarnings(page);

// Les fichiers des deux sondes : une table du préfixe de chaque app, remplie par GFS (accès complet) ; GFS les relit en repartant.
await seedProbeFiles(lab, { SondeO_Fichiers: [['Premier', 'document', 60], ['Deuxième', 'document', 120], ['Troisième', 'document', 180]], SondeQ_Fichiers: [['Projet Q', 'projet', 30]] });
const frame = await reopenGfs(lab);

const O = /o-ouvrir\//;
const Q = /q-liens\//;
const { frameOf, count, readProbe } = probeTools(page);
const waitFor = waiter(page, 80);
const ex = frame.locator('.ex');
const toast = frame.locator('#toast');
const modal = frame.locator('.mod.ask');
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const rows = () => frame.locator('.ls-row');
const openedRow = frame.locator('.tr-row[data-view="opened"]');
const shot = name => lab.shotPanel(run, name, frame);
const showExplorer = async () => { if (!(await ex.isVisible())) await frame.locator('#floater-files').click(); await ex.waitFor({ state: 'visible' }); };
const goOpened = async () => { await showExplorer(); await openedRow.click(); await page.waitForTimeout(150); };
const goRoot = async () => { await showExplorer(); await frame.locator('.tr-row[data-path=""]').first().click(); await row('Premier').waitFor(); };
const names = async () => (await rows().locator('.nm .t').allInnerTexts()).map(item => item.trim());
const shownNames = async () => (await rows().evaluateAll(list => list.filter(item => item.querySelector('.now')).map(item => item.querySelector('.nm .t').textContent.trim())));
const counted = async () => ((await openedRow.locator('.cnt').count()) ? (await openedRow.locator('.cnt').innerText()).trim() : '');
const ready = re => waitFor(`le contexte de ${re}`, async () => { const f = frameOf(re); return Boolean(f) && (await readProbe(f)).contexte === true; });
const setClose = mode => frameOf(O).evaluate(value => { document.body.dataset.fermer = value; }, mode);

// Les deux sondes sont des apps à activer une fois (la fenêtre des apps) ; la sonde Q reste à l'écran, aucun fichier n'a été ouvert par GFS.
await lab.openApp('sonde-o', O, frame);
await lab.openApp('sonde-q', Q, frame);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. rien d\'ouvert : la ligne « Ouverts » est la première du volet, sans nombre, et la liste le dit ===');
await goOpened();
const order = await frame.locator('.tr-pin .tr-row').evaluateAll(list => list.map(item => item.dataset.view));
check('« Ouverts » est la première ligne du volet, avant « Récents », « Favoris », « Partagés avec moi » et la corbeille', order[0] === 'opened' && order.includes('recent') && order.includes('trash'), order);
check('la ligne porte son mot, la vue courante la désigne, sans nombre tant que rien n\'est ouvert', (await openedRow.innerText()).trim() === WORD.opened && (await openedRow.getAttribute('aria-current')) === 'true' && (await counted()) === '');
check('la liste vide dit quoi faire (jamais une page blanche)', WORD.empty.test(await frame.locator('.ex .empty').innerText()) && (await rows().count()) === 0, await frame.locator('.ex .empty').innerText());
check('le fil d\'Ariane dit « Ouverts »', (await frame.locator('.ex .crumbs').innerText()).includes(WORD.opened), await frame.locator('.ex .crumbs').innerText());
await shot('1-vide');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. un fichier ouvert dans une app entre dans la liste, et c\'est lui que l\'app affiche ===');
await goRoot();
await row('Premier').dblclick();
await waitFor('O ouvert', () => count(O) === 1);
await ready(O);
const first = await readProbe(frameOf(O));
check('la sonde O s\'ouvre sur « Premier » (l\'identifiant du fichier en texte, raison « explorateur »)', first.ouverture && first.ouverture.fichier.id === '1' && first.ouverture.raison === 'explorateur', first.ouverture);
await goOpened();
check('« Ouverts » compte 1 et montre « Premier », seul, marqué « affiché »', (await counted()) === '1' && JSON.stringify(await names()) === JSON.stringify(['Premier']) && JSON.stringify(await shownNames()) === JSON.stringify(['Premier']), { nombre: await counted(), noms: await names(), affiche: await shownNames() });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. un fichier d\'une autre app : la première est priée de se fermer, la liste en garde les deux, « affiché » suit ===');
await setClose('oui');
await goRoot();
await row('Projet Q').dblclick();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
await ready(Q);
check('la sonde O a été priée de se fermer (raison « explorateur ») avant de partir, la sonde Q s\'ouvre', count(Q) === 1 && count(O) === 0);
await goOpened();
check('deux fichiers ouverts, par nom : « Premier » puis « Projet Q », et « affiché » est sur « Projet Q » seulement', (await counted()) === '2' && JSON.stringify(await names()) === JSON.stringify(['Premier', 'Projet Q']) && JSON.stringify(await shownNames()) === JSON.stringify(['Projet Q']), { nombre: await counted(), noms: await names(), affiche: await shownNames() });
await shot('2-deux-ouverts');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. l\'aller-retour : un double-clic dans la liste ramène au fichier de l\'autre app, sans repartir de l\'arborescence ===');
await row('Premier').dblclick();
await waitFor('O ouvert', () => count(O) === 1 && count(Q) === 0);
await ready(O);
const back = await readProbe(frameOf(O));
check('la sonde Q part comme avant (GFS_INCONNU), la sonde O s\'ouvre sur « Premier » (raison « explorateur »)', count(O) === 1 && count(Q) === 0 && back.ouverture && back.ouverture.fichier.id === '1' && back.ouverture.raison === 'explorateur', back.ouverture);
await goOpened();
check('toujours deux fichiers ouverts (rien n\'est dupliqué) ; « affiché » est passé à « Premier »', (await counted()) === '2' && JSON.stringify(await names()) === JSON.stringify(['Premier', 'Projet Q']) && JSON.stringify(await shownNames()) === JSON.stringify(['Premier']), { nombre: await counted(), noms: await names(), affiche: await shownNames() });
await setClose('oui');
await row('Projet Q').dblclick();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
await ready(Q);
const appelsQ = count(Q);
await goOpened();
check('un deuxième retour : la sonde O a répondu « oui », la liste garde ses deux fichiers, « affiché » est sur « Projet Q »', appelsQ === 1 && (await counted()) === '2' && JSON.stringify(await shownNames()) === JSON.stringify(['Projet Q']), { nombre: await counted(), affiche: await shownNames() });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. « Retirer des ouverts » : la ligne sort de la liste, l\'app garde ce qu\'elle affiche ===');
await row('Premier').hover();
await row('Premier').locator('.rb.mn').click();
const dropItem = frame.locator('.menu .menu-item', { hasText: WORD.drop });
await dropItem.waitFor({ state: 'visible' });
await shot('3-menu-retirer');
await dropItem.click();
await page.waitForTimeout(300);
check('« Premier » n\'est plus dans la liste (le nombre passe à 1) ; la sonde Q est toujours là, rien n\'a été fermé', (await counted()) === '1' && JSON.stringify(await names()) === JSON.stringify(['Projet Q']) && count(Q) === 1, { nombre: await counted(), noms: await names(), q: count(Q) });
check('le fichier lui-même est resté à sa place : « Premier » est toujours dans le dossier', await (async () => { await goRoot(); return (await row('Premier').count()) > 0; })());
const menuOutside = await (async () => { await goRoot(); await row('Premier').hover(); await row('Premier').locator('.rb.mn').click(); const items = await frame.locator('.menu .menu-item').allInnerTexts(); await page.keyboard.press('Escape'); return items.map(item => item.trim()); })();
check('l\'article n\'existe que dans la vue « Ouverts » (pas dans le menu d\'une ligne du dossier)', !menuOutside.includes(WORD.drop) && menuOutside.length > 0, menuOutside);

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 6. un refus dans l\'app : rien n\'est ajouté, « affiché » ne bouge pas ===');
await goRoot();
await row('Premier').dblclick();
await waitFor('O ouvert', () => count(O) === 1 && count(Q) === 0);
await ready(O);
await goOpened();
const before = await shownNames();
const droppedAgain = await (async () => { await row('Projet Q').hover(); await row('Projet Q').locator('.rb.mn').click(); await frame.locator('.menu .menu-item', { hasText: WORD.drop }).click(); await page.waitForTimeout(300); return names(); })();
check('« Projet Q » retiré à son tour : « Premier » seul, affiché par la sonde O', JSON.stringify(droppedAgain) === JSON.stringify(['Premier']) && JSON.stringify(before) === JSON.stringify(['Premier']), { apres: droppedAgain, avant: before });
await setClose('non');
await goRoot();
await row('Projet Q').dblclick();
await page.waitForTimeout(1200);
check('la sonde O répond « non » : elle reste, la sonde Q ne s\'ouvre pas', count(O) === 1 && count(Q) === 0, { o: count(O), q: count(Q) });
await goOpened();
check('la liste ne change pas : « Premier » seul, toujours affiché ; « Projet Q » n\'y est pas entré', (await counted()) === '1' && JSON.stringify(await names()) === JSON.stringify(['Premier']) && JSON.stringify(await shownNames()) === JSON.stringify(['Premier']), { nombre: await counted(), noms: await names(), affiche: await shownNames() });
await setClose('oui');
await goRoot();
await row('Projet Q').dblclick();
await waitFor('Q ouvert', () => count(Q) === 1 && count(O) === 0);
await ready(Q);
await goOpened();
check('après le « oui », « Projet Q » entre dans la liste et devient le fichier affiché', (await counted()) === '2' && JSON.stringify(await shownNames()) === JSON.stringify(['Projet Q']), { nombre: await counted(), affiche: await shownNames() });

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 7. la vue à 700 × 400 : tout se lit, rien ne déborde ===');
await row('Premier').click();
await shot('4-ligne-choisie');
const audit = await contrastAudit(frame, '.ex');
check('chaque texte de l\'explorateur (« affiché » compris) se lit à 4,5:1 au moins', audit.failures.length === 0 && audit.seen > 10, audit);
const fit = await frame.locator('.ex').evaluate(root => {
  const box = root.getBoundingClientRect();
  const out = [];
  for (const el of root.querySelectorAll('.tr-row[data-view="opened"], .ls-row .nm, .ls-row .now')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > box.right + 0.5 || r.left < box.left - 0.5)) out.push(`${el.className} déborde`);
    if (el.matches('.now') && el.scrollWidth > el.clientWidth + 1) out.push('« affiché » est coupé');
  }
  const label = root.querySelector('.tr-row[data-view="opened"] .lbl');
  if (label && label.scrollWidth > label.clientWidth + 1) out.push('« Ouverts » est coupé');
  return out;
});
check('la ligne du volet, le nom et « affiché » tiennent dans la fenêtre, sans être coupés', fit.length === 0, fit);
const chip = await frame.locator('.ls-row .now').first().evaluate(el => ({ text: el.textContent.trim(), weight: getComputedStyle(el).fontWeight }));
check('« affiché » est un mot (pas une couleur seule)', chip.text === WORD.shown, chip);

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
