// Ctrl+Z et Ctrl+Y dans l'explorateur (demande du porteur, 04/11 : « Ctrl+Z doit aussi faire revenir un fichier supprimé, et plus globalement toutes les modifications : renommage, déplacement, etc. », puis le
// rétablissement « au clavier seulement » ; js/undo-stack.js, js/explorer-undo.js, js/filing.js), dans un VRAI Grist (grist-static), sous Chromium, à 700 × 400, au vrai clavier. La sonde ZF (labo/sondes/zf-composite/) apporte trois formulaires et répond aux appels
// `supprimer` et `dupliquer` de GFS comme le fera Form+ ; les dossiers naissent par « Nouveau dossier », donc avec l'accord de la personne pour la table du rangement. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   1. Rien à annuler au départ.
//   2. Suppr puis Ctrl+Z : la ligne revient À SON NUMÉRO, valeurs identiques, la corbeille est vide ; un second Ctrl+Z n'a plus rien à défaire.
//   3. Renommer, épingler, nouveau dossier, déplacer (Ctrl+X, Ctrl+V), supprimer un dossier : chacun se défait d'un Ctrl+Z, et le document le dit (le rangement, le nom).
//   4. Trois gestes, trois Ctrl+Z, dans l'ordre inverse, puis « Rien à annuler ».
//   5. Copier-coller puis Ctrl+Z : la copie part à la corbeille (l'app est appelée, sa phrase s'ajoute) ; supprimer pour de bon puis Ctrl+Z : « n'est plus là », rien n'est écrit.
//   6. Dans la recherche, Ctrl+Z reste celui du texte ; l'app qui n'est pas ouverte : remettre à la corbeille attend l'app (restaurer non), et le geste reste à défaire.
//   7. Ctrl+Y et Ctrl+Maj+Z rétablissent ce que Ctrl+Z vient de défaire : la corbeille (même ligne), le nom, le déplacement ; un cran par appui, jamais en rond ; un geste neuf vide le rétablissement.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, waiter, seedProbeFiles, reopenGfs, probeTools } from './lab-gestes.mjs';
import { createI18n } from '../js/i18n.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const run = `annuler-${lang}-${scheme}`;
const APP = lang === 'fr' ? 'Sonde ZF' : 'Probe ZF';
const SAID = { trash: 'Son lien public est fermé.', copy: 'Elle n’est pas publiée.' };
const lab = await startLab({ lang, colorScheme: scheme, probes: ['zf', 'q'] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
// Cette passe compte aussi les avertissements des sondes muettes (sondes-muettes.mjs les écarte dans les passes plus récentes).
const warnings = collectWarnings(page, text => text.startsWith('GFS'));

// Les formulaires de la sonde : une table du préfixe de l'app, remplie par GFS (accès complet) ; GFS les relit en repartant.
const now = await seedProbeFiles(lab, { SondeZf_Fichiers: [['Inscription atelier', 'formulaire', 60], ['Enquête', 'formulaire', 120], ['Bilan', 'formulaire', 180]] });
const frame = await reopenGfs(lab);

const ZF = /zf-composite\//;
const Q = /q-liens\//;
const { frameOf, readProbe } = probeTools(page);
const waitFor = waiter(page, 80);
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const modal = frame.locator('.mod.ask');
const toast = frame.locator('#toast');
const row = name => frame.locator('.ls-row', { has: frame.locator('.t', { hasText: exact(name) }) }).first();
const names = () => frame.locator('.ls-row .t').allInnerTexts();
const crumb = path => frame.locator(`.crumbs [data-path="${path}"]`);
const shot = name => lab.shotPanel(run, name, frame);
const said = async text => {
  await toast.filter({ hasText: exact(text) }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  return (await toast.innerText().catch(() => '')).trim();
};
const quiet = () => toast.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
const ready = () => waitFor('le contexte de la sonde ZF', async () => { const each = frameOf(ZF); return Boolean(each) && (await readProbe(each)).contexte === true; }, 120);
const answer = (name, value) => frameOf(ZF).evaluate(([key, mode]) => { if (mode) document.body.dataset[key] = mode; else delete document.body.dataset[key]; }, [name, value]);
const showFiles = async name => { if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click(); await frame.locator('.tr-row[data-path=""]').click(); await row(name).waitFor(); }; // la racine : l'explorateur rouvre où la personne l'a laissé (la corbeille, par exemple)
const table = name => frame.evaluate(async tableId => {
  if (!(await grist.docApi.listTables()).includes(tableId)) return null;
  const data = await grist.docApi.fetchTable(tableId);
  const columns = Object.keys(data).filter(each => each !== 'id' && !each.startsWith('manualSort'));
  return data.id.map((id, i) => ({ id, ...Object.fromEntries(columns.map(each => [each, data[each][i]])) }));
}, name);
const files = async () => ((await table('SondeZf_Fichiers')) || []).map(each => each.Nom).sort();
const bin = async () => ((await table('GFS_Corbeille')) || []).map(each => each.Nom).sort();
const filing = async () => (await table('GFS_Rangement')) || [];
const placeOf = async id => { const found = (await filing()).find(each => each.App === 'sonde-zf' && each.Fichier === String(id)); return found ? found.Dossier : ''; };
const pinned = async id => { const found = (await filing()).find(each => each.App === 'sonde-zf' && each.Fichier === String(id)); return Boolean(found && found.Favori); };
const keptFolders = async () => (await filing()).filter(each => !each.App && !each.Fichier).map(each => each.Dossier).sort();
const undo = () => page.keyboard.press('Control+z');
const redo = () => page.keyboard.press('Control+y');
const redoShift = () => page.keyboard.press('Control+Shift+z');
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Une question d'accord de table (GFS_Corbeille, GFS_Rangement) : la première fois seulement.
const agree = async () => {
  const asked = await modal.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
  if (asked) await frame.locator('[data-fk="ask-yes"]').click();
};
const rename = async (from, to) => {
  await row(from).click();
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').fill(to);
  await page.keyboard.press('Enter');
  await row(to).waitFor({ timeout: 8000 });
  await quiet();
};
const makeFolder = async name => {
  await frame.locator('.ex-nav-row .btn.primary').click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) }).click();
  await frame.locator('[data-fk="name-input"]').fill(name);
  await page.keyboard.press('Enter');
  await agree();
  await row(name).waitFor({ timeout: 8000 });
  await quiet();
};

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 1. rien à annuler au départ ===');
await lab.openApp('sonde-zf', ZF, frame);
await ready();
await answer('supprimer', 'oui');
await answer('dupliquer', 'oui');
await showFiles('Inscription atelier');
await row('Bilan').click();
await undo();
check('Ctrl+Z sans geste : « Rien à annuler », mot pour mot ; rien ne change', await said(t('undo.nothing')) === t('undo.nothing') && sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']), { liste: await files() });
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. Suppr puis Ctrl+Z : la ligne revient à son numéro ===');
await row('Inscription atelier').click();
await page.keyboard.press('Delete');
await agree();
const moved = `${t('trash.moved', { name: 'Inscription atelier' })} ${SAID.trash}`;
check('Suppr met le formulaire à la corbeille (la phrase de GFS et celle de l\'app)', await said(moved) === moved && sameList(await bin(), ['Inscription atelier']) && sameList(await files(), ['Bilan', 'Enquête']), { corbeille: await bin(), fichiers: await files() });
await quiet();
await undo();
check('Ctrl+Z : la phrase de la restauration, mot pour mot', await said(t('trash.restored', { name: 'Inscription atelier' })) === t('trash.restored', { name: 'Inscription atelier' }));
const back = ((await table('SondeZf_Fichiers')) || []).find(each => each.Nom === 'Inscription atelier');
check('la ligne est revenue au numéro 1, avec son type et sa date ; la corbeille est vide ; la liste le montre', Boolean(back) && back.id === 1 && back.Type === 'formulaire' && back.DateModif === now - 60 && (await bin()).length === 0 && (await names()).includes('Inscription atelier'), { back, corbeille: await bin() });
await shot('2-revenu');
await quiet();
await undo();
check('un second Ctrl+Z n\'a plus rien à défaire (la restauration ne se défait pas en boucle)', await said(t('undo.nothing')) === t('undo.nothing') && (await bin()).length === 0);
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. renommer, épingler, nouveau dossier, déplacer, supprimer un dossier ===');
await rename('Enquête', 'Sondage');
check('renommé « Sondage » dans le document', sameList(await files(), ['Bilan', 'Inscription atelier', 'Sondage']), await files());
await undo();
check('Ctrl+Z : le nom d\'avant est revenu, dans le document et dans la liste, et la phrase le dit', await said(t('undo.renamed', { name: 'Enquête' })) === t('undo.renamed', { name: 'Enquête' }) && sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']) && (await names()).includes('Enquête'), { fichiers: await files(), liste: await names() });
await quiet();
await row('Bilan').hover();
await row('Bilan').locator('.rb.pin').click();
await agree();
await waitFor('l\'étoile écrite', async () => pinned(3));
check('l\'étoile est écrite dans le rangement', await pinned(3), await filing());
await quiet();
await undo();
check('Ctrl+Z : plus épinglé, la phrase le dit', await said(t('undo.unpinned', { name: 'Bilan' })) === t('undo.unpinned', { name: 'Bilan' }) && !(await pinned(3)), await filing());
await quiet();
await makeFolder('Contrats');
check('« Contrats » est gardé', sameList(await keptFolders(), ['Contrats']), await keptFolders());
await undo();
check('Ctrl+Z : le dossier créé est supprimé, la phrase le dit', await said(t('undo.folderCreated', { name: 'Contrats' })) === t('undo.folderCreated', { name: 'Contrats' }) && sameList(await keptFolders(), []) && !(await names()).includes('Contrats'), { gardes: await keptFolders(), liste: await names() });
await quiet();
await makeFolder('Contrats');
await row('Bilan').click();
await page.keyboard.press('Control+x');
await row('Contrats').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('Contrats') }).waitFor();
await page.keyboard.press('Control+v');
check('couper-coller : « Bilan » est dans « Contrats »', await said(t('clip.moved', { name: 'Bilan', folder: 'Contrats' })) === t('clip.moved', { name: 'Bilan', folder: 'Contrats' }) && (await placeOf(3)) === 'Contrats', { place: await placeOf(3) });
await quiet();
await undo();
check('Ctrl+Z : « Bilan » est revenu à la racine (« Moi »), la phrase le dit', await said(t('undo.moved', { name: 'Bilan', folder: t('ex.me') })) === t('undo.moved', { name: 'Bilan', folder: t('ex.me') }) && (await placeOf(3)) === '', { place: await placeOf(3) });
await quiet();
await crumb('').click();
await row('Contrats').waitFor();
await row('Contrats').click({ button: 'right' });
await frame.locator('.menu').waitFor();
await frame.locator('.menu .menu-item', { hasText: t('ex.deleteFolder') }).first().click();
await agree();
await waitFor('le dossier supprimé', async () => (await keptFolders()).length === 0);
check('« Contrats » (vide) est supprimé', sameList(await keptFolders(), []) && !(await names()).includes('Contrats'), { gardes: await keptFolders() });
await quiet();
await undo();
check('Ctrl+Z : le dossier supprimé est revenu, la phrase le dit', await said(t('undo.folder', { name: 'Contrats' })) === t('undo.folder', { name: 'Contrats' }) && sameList(await keptFolders(), ['Contrats']) && (await names()).includes('Contrats'), { gardes: await keptFolders(), liste: await names() });
await shot('3-dossier-revenu');
await quiet();
// Ce qui reste dans la pile : le second « Nouveau dossier » (le premier a été défait). Ctrl+Z le défait à son tour : la pile est vide pour la suite.
await undo();
check('Ctrl+Z encore : le dossier créé en dernier est supprimé (la pile se vide, le dernier geste d\'abord)', await said(t('undo.folderCreated', { name: 'Contrats' })) === t('undo.folderCreated', { name: 'Contrats' }) && sameList(await keptFolders(), []) && !(await names()).includes('Contrats'), { gardes: await keptFolders(), liste: await names() });
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. trois gestes, trois Ctrl+Z, dans l\'ordre inverse, puis « Rien à annuler » ===');
await row('Bilan').click();
await row('Bilan').locator('.rb.pin').click();
await waitFor('l\'étoile', async () => pinned(3));
await quiet();
await rename('Enquête', 'Sondage');
await row('Inscription atelier').click();
await page.keyboard.press('Delete');
await said(moved);
await quiet();
check('départ : « Bilan » épinglé, « Sondage » renommé, « Inscription atelier » à la corbeille', await pinned(3) && sameList(await files(), ['Bilan', 'Sondage']) && sameList(await bin(), ['Inscription atelier']), { fichiers: await files(), corbeille: await bin() });
await undo();
await said(t('trash.restored', { name: 'Inscription atelier' }));
check('1er appui : « Inscription atelier » revient (le dernier geste), le reste n\'a pas bougé', sameList(await files(), ['Bilan', 'Inscription atelier', 'Sondage']) && await pinned(3), await files());
await quiet();
await undo();
await said(t('undo.renamed', { name: 'Enquête' }));
check('2e appui : « Enquête » reprend son nom, « Bilan » est toujours épinglé', sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']) && await pinned(3), await files());
await quiet();
await undo();
await said(t('undo.unpinned', { name: 'Bilan' }));
check('3e appui : « Bilan » n\'est plus épinglé', !(await pinned(3)));
await quiet();
await undo();
check('4e appui : « Rien à annuler »', await said(t('undo.nothing')) === t('undo.nothing'));
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. copier-coller puis Ctrl+Z ; supprimer pour de bon puis Ctrl+Z ===');
await row('Enquête').click();
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
const copied = `${t('copy.done', { as: 'Enquête (1)' })} ${SAID.copy}`;
check('la copie est faite (la phrase de GFS et celle de l\'app)', await said(copied) === copied);
await waitFor('la copie dans la liste', async () => (await names()).includes('Enquête (1)'));
await quiet();
await undo();
const copyBin = `${t('trash.moved', { name: 'Enquête (1)' })} ${SAID.trash}`;
check('Ctrl+Z : la copie, et elle seule, part à la corbeille (l\'app est appelée, sa phrase s\'ajoute)', await said(copyBin) === copyBin && sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']) && sameList(await bin(), ['Enquête (1)']), { fichiers: await files(), corbeille: await bin() });
await quiet();
// Supprimer pour de bon ne s'annule pas : la copie est refaite, mise à la corbeille à la main, puis supprimée pour de bon ; les deux Ctrl+Z qui la visaient disent « n'est plus là » et n'écrivent rien.
await frame.locator('.tr-row[data-view="trash"]').click();
await row('Enquête (1)').click();
await page.keyboard.press('Delete');
await modal.waitFor({ state: 'visible', timeout: 8000 });
await frame.locator('[data-fk="ask-yes"]').click();
await said(t('trash.purged', { name: 'Enquête (1)' }));
check('supprimé pour de bon : la corbeille est vide', (await bin()).length === 0, await bin());
await quiet();
await frame.locator('.tr-row[data-path=""]').click();
await row('Enquête').click();
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
await said(copied);
await waitFor('la copie dans la liste', async () => (await names()).includes('Enquête (1)'));
await quiet();
await row('Enquête (1)').click();
await page.keyboard.press('Delete');
await said(copyBin);
await quiet();
await frame.locator('.tr-row[data-view="trash"]').click();
await row('Enquête (1)').click();
await page.keyboard.press('Delete');
await modal.waitFor({ state: 'visible', timeout: 8000 });
await frame.locator('[data-fk="ask-yes"]').click();
await said(t('trash.purged', { name: 'Enquête (1)' }));
await quiet();
const before = await files();
await undo();
check('Ctrl+Z de la mise à la corbeille : « n\'est plus là » (supprimée pour de bon depuis), rien n\'est écrit', await said(t('undo.gone', { name: 'Enquête (1)' })) === t('undo.gone', { name: 'Enquête (1)' }) && sameList(await files(), before) && (await bin()).length === 0, { fichiers: await files(), corbeille: await bin() });
await quiet();
await undo();
check('Ctrl+Z de la copie : « n\'est plus là » aussi', await said(t('undo.gone', { name: 'Enquête (1)' })) === t('undo.gone', { name: 'Enquête (1)' }) && sameList(await files(), before) && (await bin()).length === 0, { fichiers: await files(), corbeille: await bin() });
await quiet();
await undo();
check('la pile est vide : « Rien à annuler »', await said(t('undo.nothing')) === t('undo.nothing'));
await quiet();
await frame.locator('.tr-row[data-path=""]').click();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 6. la recherche garde son Ctrl+Z ; l\'app fermée ===');
await showFiles('Bilan');
await row('Bilan').click();
await page.keyboard.press('Delete');
await said(t('trash.moved', { name: 'Bilan' }) + ` ${SAID.trash}`);
await quiet();
await page.keyboard.press('/');
await frame.locator('.inp-search input').fill('abc');
await undo();
await page.waitForTimeout(500);
check('dans la recherche, Ctrl+Z défait le texte, pas la suppression', sameList(await bin(), ['Bilan']) && sameList(await files(), ['Enquête', 'Inscription atelier']), { corbeille: await bin() });
await row('Enquête').click(); // le clavier revient à la liste (Échap dans une recherche vide fermerait l'explorateur)
// Restaurer à la main (Corbeille, Entrée), puis l'app part : défaire = remettre à la corbeille, qui attend l'app.
await frame.locator('.tr-row[data-view="trash"]').click();
await row('Bilan').click();
await page.keyboard.press('Enter');
await said(t('trash.restored', { name: 'Bilan' }));
await quiet();
await lab.openApp('sonde-q', Q, frame);
await showFiles('Bilan');
await undo();
check('app fermée : Ctrl+Z dit d\'ouvrir l\'app, rien n\'est écrit', await said(t('trash.openApp', { app: APP })) === t('trash.openApp', { app: APP }) && sameList(await bin(), []) && (await files()).includes('Bilan'), { corbeille: await bin() });
await quiet();
await lab.openApp('sonde-zf', ZF, frame);
await ready();
await answer('supprimer', 'oui');
await showFiles('Bilan');
await undo();
const again = `${t('trash.moved', { name: 'Bilan' })} ${SAID.trash}`;
check('l\'app est rouverte : le même Ctrl+Z remet « Bilan » à la corbeille', await said(again) === again && sameList(await bin(), ['Bilan']), { corbeille: await bin() });
await shot('6-fin');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 7. rétablir : Ctrl+Y et Ctrl+Maj+Z refont ce que Ctrl+Z vient de défaire ===');
// Le dernier Ctrl+Z (6) a remis « Bilan » à la corbeille en défaisant une restauration : Ctrl+Y refait la restauration.
await quiet();
await redo();
check('Ctrl+Y refait la restauration défaite : « Bilan » revient, la phrase de la restauration, mot pour mot', await said(t('trash.restored', { name: 'Bilan' })) === t('trash.restored', { name: 'Bilan' }) && (await bin()).length === 0 && (await files()).includes('Bilan'), { corbeille: await bin(), fichiers: await files() });
const rowBack = ((await table('SondeZf_Fichiers')) || []).find(each => each.Nom === 'Bilan');
check('à son numéro (3), valeurs identiques', Boolean(rowBack) && rowBack.id === 3 && rowBack.Type === 'formulaire' && rowBack.DateModif === now - 180, rowBack);
await quiet();
await undo();
const binAgain = `${t('trash.moved', { name: 'Bilan' })} ${SAID.trash}`;
check('Ctrl+Z puis Ctrl+Y ne tournent pas en rond : Ctrl+Z remet « Bilan » à la corbeille (l\'app est appelée)', await said(binAgain) === binAgain && sameList(await bin(), ['Bilan']));
await quiet();
await redo();
check('Ctrl+Y le ressort de la corbeille', await said(t('trash.restored', { name: 'Bilan' })) === t('trash.restored', { name: 'Bilan' }) && (await bin()).length === 0);
await quiet();
await redo();
check('Ctrl+Y de plus : « Rien à rétablir », rien n\'est écrit', await said(t('redo.nothing')) === t('redo.nothing') && (await bin()).length === 0);
await quiet();
// Un renommage défait se refait.
await rename('Enquête', 'Sondage');
await undo();
await said(t('undo.renamed', { name: 'Enquête' }));
await quiet();
await redo();
check('Ctrl+Y refait le renommage : « Sondage » dans le document, la phrase le dit', await said(t('redo.renamed', { name: 'Sondage' })) === t('redo.renamed', { name: 'Sondage' }) && sameList(await files(), ['Bilan', 'Inscription atelier', 'Sondage']), await files());
await quiet();
await undo();
await said(t('undo.renamed', { name: 'Enquête' }));
check('Ctrl+Z défait ce que Ctrl+Y vient de refaire', sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']), await files());
await quiet();
// Un geste neuf vide le rétablissement : le renommage défait ne se refait plus.
await row('Bilan').hover();
await row('Bilan').locator('.rb.pin').click();
await agree();
await waitFor('l\'étoile écrite', async () => pinned(3));
await quiet();
await redo();
check('un geste neuf (une étoile) a vidé le rétablissement : Ctrl+Y dit « Rien à rétablir » et « Enquête » garde son nom', await said(t('redo.nothing')) === t('redo.nothing') && sameList(await files(), ['Bilan', 'Enquête', 'Inscription atelier']), await files());
await quiet();
await undo();
await said(t('undo.unpinned', { name: 'Bilan' }));
await quiet();
// Un déplacement défait se refait ; Ctrl+Maj+Z fait comme Ctrl+Y.
await makeFolder('Contrats');
await row('Bilan').click();
await page.keyboard.press('Control+x');
await row('Contrats').dblclick();
await frame.locator('.crumbs .here', { hasText: exact('Contrats') }).waitFor();
await page.keyboard.press('Control+v');
await said(t('clip.moved', { name: 'Bilan', folder: 'Contrats' }));
await quiet();
await undo();
await said(t('undo.moved', { name: 'Bilan', folder: t('ex.me') }));
check('Ctrl+Z : « Bilan » est à la racine', (await placeOf(3)) === '', { place: await placeOf(3) });
await quiet();
await redoShift();
check('Ctrl+Maj+Z refait le déplacement : « Bilan » retourne dans « Contrats », la phrase le dit', await said(t('redo.moved', { name: 'Bilan', folder: 'Contrats' })) === t('redo.moved', { name: 'Bilan', folder: 'Contrats' }) && (await placeOf(3)) === 'Contrats', { place: await placeOf(3) });
await quiet();
await undo();
check('Ctrl+Z le ramène à la racine encore', await said(t('undo.moved', { name: 'Bilan', folder: t('ex.me') })) === t('undo.moved', { name: 'Bilan', folder: t('ex.me') }) && (await placeOf(3)) === '', { place: await placeOf(3) });
await shot('7-retabli');
check('aucun avertissement inattendu dans la console', warnings.every(each => /le geste sur la corbeille a échoué|la copie a échoué/.test(each)), warnings);
await lab.browser.close();
