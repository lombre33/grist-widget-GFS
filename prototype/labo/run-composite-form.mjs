// La corbeille et la copie d'un formulaire depuis l'explorateur avec la VRAIE Form+, celle que GFS référence (91e4ba8 : ses consignes 020 et 021 faites, kit 0.10.0), dans un VRAI Grist (grist-static),
// à 700 × 400, à la vraie souris et au vrai clavier (contrats 2.4 `suppression.appel` et `copie.appel`, 5.4 points 10 et 11). `run-composite` joue les mêmes gestes avec une sonde (ZF) qui répond « comme
// le fera Form+ » ; ici l'app répond elle-même : `GfsLink.onDelete` ferme le lien public (`closeManagedFormPublicLink`), `GfsLink.onDuplicate` copie le formulaire (`duplicateManagedForm`).
//   bash prototype/labo/lab-server (grist-static, ports 8910 et 8911) puis : REPO_DIR="$(realpath ../..)" node run-composite-form.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   0. Form+ n'est pas ouverte : les deux gestes sont grisés et disent d'ouvrir l'app, rien n'est écrit.
//   1. Form+ ouverte sur un formulaire publié : « Dupliquer » → la copie est un formulaire de la liste (nouveau nom libre, nouvelle section, SA table de réponses vide, lien fermé), l'original n'a pas bougé,
//      GFS n'a rien écrit dans FormPlus_Formulaires, la copie prend le clavier.
//   2. « Mettre à la corbeille » → la question de la table de la corbeille passe avant l'appel ; puis Form+ ferme le lien public, la ligne part à GFS_Corbeille en un seul lot ; la section du formulaire reste.
//   3. Restaurer → la ligne revient à son numéro, la définition identique, le lien reste fermé (Form+ ne le rouvre pas).
import { startLab } from './lab-setup.mjs';
import { seedFormDesigner } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { createI18n } from '../js/i18n.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const run = `composite-form-${lang}-${scheme}`;
const APP = 'Form+';
const FORM_URL = /(apps\/form|FormPlus)\//;
const FIRST = { title: 'Inscription à une formation', question: 'Ville de départ' };
const SECOND = { title: 'Demande de matériel', question: 'Matériel demandé' };
const SAID = lang === 'fr'
  ? { closed: 'Son lien public est fermé.', notPublished: 'Elle n’est pas publiée.' }
  : { closed: 'Its public link is closed.', notPublished: 'It isn’t published.' };
const PUBLISHED = JSON.stringify({ publish: true, form: true });
// Le Grist du labo est en http : la politique de l'app (`connect-src 'self' https:`) refuse sa lecture de /forms/N, ce que Grist en ligne (https) laisse passer. Propre au labo.
const LAB_ONLY = /Content Security Policy|Refused to connect/;
const LAB_GRIST = /127\.0\.0\.1:8910\/o\/docs\/api\/s\/LABO\/forms\/\d+/;

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && FORM_URL.test(message.location().url || '') && !(LAB_ONLY.test(message.text()) && LAB_GRIST.test(message.text()))) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

let frame = lab.frame;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const toast = frame_ => frame_.locator('#toast');
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
// La dernière phrase de GFS, mot pour mot, une fois dite.
const said = async text => {
  await toast(frame).filter({ hasText: exact(text) }).waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  return (await toast(frame).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
};
const quiet = () => toast(frame).waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
const waitFor = async (label, test, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const modal = () => frame.locator('.mod.ask');
const row = name => frame.locator('.ls-row', { has: frame.locator('.t', { hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}$`) }) }).first();
const names = () => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const selectedName = async () => ((await frame.locator('.ls-row[aria-selected="true"] .nm .t').first().innerText().catch(() => '')) || '').trim();
const showFiles = async name => { if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click(); await row(name).waitFor(); };
const openMenu = async name => { await row(name).click({ button: 'right' }); await frame.locator('.menu').waitFor(); };
const item = label => frame.locator('.menu .menu-item', { hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\…]/g, '\\$&')}`) }).first();
const greyed = async label => (await item(label).getAttribute('aria-disabled')) === 'true';
// Ce que le document retient : les lignes d'une table (id et colonnes), ou null quand elle n'existe pas.
const table = name => frame.evaluate(async tableId => {
  if (!(await grist.docApi.listTables()).map(String).includes(tableId)) return null;
  const data = await grist.docApi.fetchTable(tableId);
  const columns = Object.keys(data).filter(each => each !== 'id' && !each.startsWith('manualSort'));
  return data.id.map((id, i) => ({ id, ...Object.fromEntries(columns.map(each => [each, data[each][i]])) }));
}, name);
const sectionOptions = id => frame.evaluate(async sectionId => {
  const data = await grist.docApi.fetchTable('_grist_Views_section');
  const at = data.id.indexOf(sectionId);
  return at < 0 ? null : data.shareOptions[at];
}, id);
const forms = async () => (await table('FormPlus_Formulaires')) || [];
const bin = () => table('GFS_Corbeille');
const closed = options => options === null || options === '' || options === '{}' || (() => { try { const parsed = JSON.parse(options); return !parsed.publish && !parsed.form; } catch { return false; } })();
const shown = app => app.evaluate(() => {
  const title = document.getElementById('opt-title');
  const editor = document.getElementById('editor');
  return { editor: Boolean(editor) && !editor.classList.contains('hidden'), title: title ? title.value : '' };
});
const waitEditor = async (app, title) => {
  for (let i = 0; i < 100; i++) {
    const seen = await shown(app).catch(() => null);
    if (seen && seen.editor && seen.title === title) return seen;
    await page.waitForTimeout(200);
  }
  return shown(app).catch(() => null);
};

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== préparation : Form+ installée, deux formulaires enregistrés comme Form+ les range, le premier publié ===');
await restart();
await lab.openModules(frame);
await frame.locator('[data-fk="app:form"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
const first = await seedFormDesigner(frame, FIRST);
await seedFormDesigner(frame, { ...SECOND, questions: [{ id: 'q1', kind: 'text', label: SECOND.question, writeTable: 'Clients', writeCol: 'Ville' }] });
await frame.evaluate(async ({ id, options }) => { await grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', id, { shareOptions: options }]]); }, { id: first.form, options: PUBLISHED });
await restart();
const original = (await forms()).find(each => each.Nom === FIRST.title);
const clientsBefore = await table('Clients');
check('deux formulaires sont enregistrés, le premier est publié', (await forms()).length === 2 && !closed(await sectionOptions(first.form)), { formulaires: (await forms()).map(each => each.Nom), options: await sectionOptions(first.form) });

say('=== 0. Form+ n\'est pas ouverte : les deux gestes sont grisés et disent d\'ouvrir l\'app ===');
await showFiles(FIRST.title);
await openMenu(FIRST.title);
check('le menu de la ligne grise « Mettre à la corbeille » et « Dupliquer »', await greyed(t('trash.move')) && await greyed(t('ex.duplicate')), await frame.locator('.menu .menu-item').allInnerTexts());
await item(t('trash.move')).click({ force: true }); // un article grisé reste cliquable pour la personne : le clic dit pourquoi
check('un clic sur « Mettre à la corbeille » grisé dit d\'ouvrir l\'app', await said(t('trash.openApp', { app: APP })) === t('trash.openApp', { app: APP }));
await quiet();
check('rien n\'est écrit : toujours deux formulaires, pas de table de corbeille, le lien public reste ouvert', (await forms()).length === 2 && (await bin()) === null && !closed(await sectionOptions(first.form)));
await lab.shotPanel(run, '0-app-fermee', frame);

say('=== 1. Form+ s\'ouvre sur le formulaire : « Dupliquer » ===');
await row(FIRST.title).dblclick();
let app = await lab.appFrame(FORM_URL);
const seen = await waitEditor(app, FIRST.title);
check('Form+ est ouverte sur le formulaire (son titre)', Boolean(seen) && seen.editor && seen.title === FIRST.title, seen);
await showFiles(FIRST.title);
await openMenu(FIRST.title);
check('app ouverte : « Mettre à la corbeille » et « Dupliquer » sont dégrisés', !(await greyed(t('trash.move'))) && !(await greyed(t('ex.duplicate'))), await frame.locator('.menu .menu-item').allInnerTexts());
await lab.forgetActions();
await item(t('ex.duplicate')).click();
const copyName = `${FIRST.title} (1)`;
const copied = `${t('copy.done', { as: copyName })} ${SAID.notPublished}`;
check('la phrase de GFS et celle de Form+, bout à bout', await said(copied) === copied);
await waitFor('la copie dans la liste', async () => (await names()).includes(copyName));
const afterCopy = await forms();
const copy = afterCopy.find(each => each.Nom === copyName);
const copyDefinition = copy ? JSON.parse(copy.Definition) : {};
check('la copie est un formulaire de plus dans la liste et dans le document, sous le premier nom libre', afterCopy.length === 3 && Boolean(copy) && (await names()).includes(copyName), { formulaires: afterCopy.map(each => each.Nom), liste: await names() });
check('la copie a sa propre section (pas celle de l\'original), sans clé de partage ni adresse publique, et son lien est fermé', copyDefinition.vsId != null && copyDefinition.vsId !== first.form && !copyDefinition.shareKey && !copyDefinition.publicUrl && closed(await sectionOptions(copyDefinition.vsId)), { copie: copyDefinition, options: await sectionOptions(copyDefinition.vsId) });
const copyTable = copyDefinition.questions && copyDefinition.questions[0] ? copyDefinition.questions[0].writeTable : null;
const copyRows = copyTable ? await table(copyTable) : null;
check('la copie a SA table de réponses, vide (jamais celle de l\'original)', Boolean(copyTable) && copyTable !== 'Clients' && Array.isArray(copyRows) && copyRows.length === 0, { table: copyTable, lignes: copyRows });
check('l\'original n\'a pas bougé : même ligne, même définition, son lien public reste ouvert, la table des réponses est intacte', JSON.stringify((await forms()).find(each => each.id === original.id)) === JSON.stringify(original) && !closed(await sectionOptions(first.form)) && JSON.stringify(await table('Clients')) === JSON.stringify(clientsBefore));
const verbs = (await lab.actions()).filter(each => /FormPlus_Formulaires/.test(each));
check('GFS n\'a rien écrit dans FormPlus_Formulaires : une seule ligne ajoutée, par Form+', verbs.length === 1 && /^AddRecord /.test(verbs[0]), verbs);
check('la copie est rangée avec l\'original (même niveau) et prend le clavier', (await selectedName()) === copyName, await selectedName());
await lab.shotPanel(run, '1-copie', frame);
await quiet();

say('=== 2. « Mettre à la corbeille » : Form+ ferme le lien avant que la ligne parte ===');
await showFiles(FIRST.title);
await row(FIRST.title).click();
await page.keyboard.press('Delete');
await modal().waitFor({ state: 'visible', timeout: 8000 });
check('la question de la table de la corbeille passe avant l\'appel : le lien public est encore ouvert', !closed(await sectionOptions(first.form)));
await frame.locator('[data-fk="ask-no"]').click();
await page.waitForTimeout(600);
check('la personne refuse : rien n\'est écrit, le lien reste ouvert, la ligne reste', (await bin()) === null && !closed(await sectionOptions(first.form)) && (await names()).includes(FIRST.title), { corbeille: await bin() });
await quiet();
await lab.forgetActions();
await page.keyboard.press('Delete');
await modal().waitFor({ state: 'visible', timeout: 8000 });
await frame.locator('[data-fk="ask-yes"]').click();
const moved = `${t('trash.moved', { name: FIRST.title })} ${SAID.closed}`;
check('la phrase de GFS et celle de Form+, bout à bout', await said(moved) === moved);
check('le lien public du formulaire est fermé', closed(await sectionOptions(first.form)), await sectionOptions(first.form));
const stored = (await bin()) || [];
check('GFS_Corbeille garde la ligne (app, table, fichier, nom, instantané) ; FormPlus_Formulaires garde la copie et le second', stored.length === 1 && stored[0].App === 'form' && stored[0].Table === 'FormPlus_Formulaires' && stored[0].FichierId === String(original.id)
  && stored[0].Nom === FIRST.title && JSON.parse(stored[0].Instantane).valeurs.Nom === FIRST.title && JSON.stringify((await forms()).map(each => each.Nom).sort()) === JSON.stringify([SECOND.title, copyName].sort()), { stockee: stored, formulaires: (await forms()).map(each => each.Nom) });
const moves = (await lab.actions()).filter(each => /^(AddRecord|RemoveRecord) /.test(each));
check('la ligne a été copiée puis retirée dans le même lot (AddRecord GFS_Corbeille, RemoveRecord FormPlus_Formulaires)', JSON.stringify(moves) === JSON.stringify(['AddRecord GFS_Corbeille', 'RemoveRecord FormPlus_Formulaires']), moves);
check('la section du formulaire et sa table de réponses sont toujours là (GFS ne les suit pas : restaurer remet la ligne)', (await sectionOptions(first.form)) !== null && JSON.stringify(await table('Clients')) === JSON.stringify(clientsBefore));
check('la liste ne montre plus le formulaire', !(await names()).includes(FIRST.title) && (await names()).includes(copyName), await names());
await lab.shotPanel(run, '2-a-la-corbeille', frame);
await quiet();

say('=== 3. restaurer : la ligne revient à son numéro, le lien reste fermé ===');
await frame.locator('.tr-row[data-view="trash"]').click();
await row(FIRST.title).waitFor();
await row(FIRST.title).click();
await page.keyboard.press('Enter');
check('la phrase de la restauration', await said(t('trash.restored', { name: FIRST.title })) === t('trash.restored', { name: FIRST.title }));
const back = (await forms()).find(each => each.Nom === FIRST.title);
check('la ligne est revenue au même numéro, avec exactement la même définition', Boolean(back) && back.id === original.id && back.Definition === original.Definition && back.TypeFormulaire === original.TypeFormulaire, back);
check('Form+ ne rouvre pas le lien : la personne republie quand elle le veut', closed(await sectionOptions(first.form)));
await quiet();
check('aucun avertissement de GFS, aucune erreur de script dans l\'app', warnings.length === 0 && errors.length === 0, { avertissements: warnings, erreurs: errors });
await lab.shotPanel(run, '3-restaurer', frame);
await lab.browser.close();
