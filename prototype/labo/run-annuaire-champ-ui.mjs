// « Modifier le champ » de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « le nom du champ, la colonne, ses valeurs et son type »), DEPUIS L'ÉCRAN, dans un VRAI serveur
// Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier, le propriétaire du document dans le vrai GFS. Ce que Grist fait de
// `ModifyColumn` (les autres options de la colonne qui restent, un type de colonne qui change, des cellules qui ne suivent pas toutes seules), du lot « type puis cellules en listes »
// et la phrase d'un refus (une règle d'accès qui interdit de changer la structure) ne se simulent pas : c'est ici. Le faux Grist de test/annuaire-champ-firefox.mjs mesure le dessin.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-champ-ui.mjs        LAB_LANG=fr|en, LAB_SCHEME=light|dark
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { rowsOf, apply } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `annuaire-champ-${lang}-${scheme}`;
// Les champs de la fiche : un choix (Contrat), du texte à découper (Etiquettes, ajoutée ci-dessous), un choix multiple qui a des valeurs (Competences) et du texte (Service).
const CONFIG = {
  v: 1, name: 'Nom', title: 'Fonction', email: 'Email', phone: 'Tel', manager: 'Responsable', relations: [], columns: ['email'],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }, { col: 'Etiquettes', filter: false }, { col: 'Competences', filter: true }, { col: 'Service', filter: false }],
};
// Les étiquettes saisies à la main : séparées par une virgule ou un point-virgule, des cases vides, une valeur qui revient.
const ETIQUETTES = ['Budget, Marchés publics', 'Budget; Pilotage', 'Données', '', 'Accueil', 'Budget'];
const CHOICE_OPTIONS = { Titulaire: { fillColor: '#FF9999', textColor: '#000000' } };

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));

// Une colonne de Grist : { type, options } (les options en objet), ou null.
async function colOf(run, table, colId) {
  const tables = (await rowsOf(run, '_grist_Tables')) || [];
  const id = (tables.find(row => row.tableId === table) || {}).id;
  const col = ((await rowsOf(run, '_grist_Tables_column')) || []).find(row => row.parentId === id && row.colId === colId);
  if (!col) return null;
  let options = {};
  try { options = JSON.parse(col.widgetOptions || '{}'); } catch { /* options absentes */ }
  return { type: col.type, options };
}

// Un choix multiple tel que l'API le rend : un tableau (l'étiquette « L » du format interne est ôtée).
const listOf = value => (Array.isArray(value) ? (value[0] === 'L' ? value.slice(1) : value) : value);
// Le réglage de l'annuaire, tel que GFS l'a écrit dans `GFS_Directories`.
const configOf = async run => {
  const [row] = (await rowsOf(run, 'GFS_Directories')) || [];
  try { return JSON.parse(row.Config); } catch { return null; }
};

// Ouvre la fenêtre de l'annuaire (le bouton du titre de l'explorateur).
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
}

// Le réglage de l'annuaire, onglet « Champs de la fiche ».
async function openFields(frame) {
  const tab = frame.locator('[data-fk="tab:fields"]');
  if (!(await tab.isVisible())) {
    await frame.locator('[data-fk="configure"]').click();
    await tab.waitFor({ state: 'visible' });
  }
  await tab.click();
  await frame.locator('[data-fk="fe:0"]').waitFor({ state: 'visible' });
}

// La fenêtre « Modifier le champ » d'une ligne, ses valeurs lues quand Grist les a rendues.
async function openField(frame, page, at) {
  await frame.locator(`[data-fk="fe:${at}"]`).scrollIntoViewIfNeeded();
  await frame.locator(`[data-fk="fe:${at}"]`).click();
  await frame.locator('.mod.an-fw').waitFor({ state: 'visible' });
  await frame.locator('.mod.an-fw .an-fw-head').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

// Tape dans un champ de la fenêtre (vrai clavier) ; vide d'abord le champ.
async function typeInto(frame, fk, text) {
  const input = frame.locator(`[data-fk="${fk}"]`);
  await input.click();
  await input.press('Control+a');
  await input.pressSequentially(text, { delay: 8 });
}

const valuesOf = frame => frame.locator('.mod.an-fw .an-val-t').allInnerTexts();
const previewOf = async frame => (await frame.locator('.mod.an-fw .an-fw-preview p').allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim());
const noteOf = async frame => (await frame.locator('.mod.an-fw .mod-note').innerText()).replace(/\s+/g, ' ').trim();

async function play(run) {
  const { page } = run;
  say('--- 0. le document, l\'annuaire (quatre champs) et une colonne de texte à étiquettes ---');
  await seedAnnuaire(run.frame);
  const extra = await apply(run, [['AddColumn', 'Personnes', 'Etiquettes', { type: 'Text', isFormula: false }],
    ['ModifyColumn', 'Personnes', 'Contrat', { widgetOptions: JSON.stringify({ choices: ['Titulaire', 'Contractuel', 'Contractuelle'], choiceOptions: CHOICE_OPTIONS, alignment: 'center' }) }],
    ['BulkUpdateRecord', 'Personnes', ETIQUETTES.map((_, at) => at + 1), { Etiquettes: ETIQUETTES }]]);
  check('les étiquettes et les options de couleur du choix sont posées', extra.status === 200, extra.text);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
  }, CONFIG);
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const people = (await rowsOf(run, 'Personnes')) || [];
  const contrats = people.map(row => row.Contrat);
  check('18 personnes, le choix « Contrat » est un choix (Choice) aux trois valeurs de Grist', people.length === 18 && (await colOf(run, 'Personnes', 'Contrat')).type === 'Choice'
    && (await colOf(run, 'Personnes', 'Contrat')).options.choices.length === 3, people.length);

  say('--- 1. une valeur de plus : un seul ModifyColumn, les autres options de la colonne restent ---');
  await openFields(frame);
  await shot(frame, '1-liste');
  await openField(frame, page, 0);
  check('la fenêtre dit le titre du champ et les trois valeurs de Grist', (await frame.locator('.mod.an-fw h2').innerText()) === t('an.fld.win.title', { name: 'Contrat' })
    && JSON.stringify(await valuesOf(frame)) === JSON.stringify(['Titulaire', 'Contractuel', 'Contractuelle']), await valuesOf(frame));
  check('le bouton dit « Enregistrer » tant que rien ne change dans Grist', (await frame.locator('[data-fk="fw-ok"]').innerText()).trim() === t('an.fld.win.save'));
  await typeInto(frame, 'fw-val-in', 'Apprenti');
  await page.keyboard.press('Enter');
  check('« Apprenti » est dans les pastilles et le résumé le dit', (await valuesOf(frame)).includes('Apprenti')
    && (await previewOf(frame)).some(line => line.includes(t('an.fld.win.pvAdd', { values: 'Apprenti' }))), await previewOf(frame));
  check('le bouton dit « Écrire dans Grist »', (await frame.locator('[data-fk="fw-ok"]').innerText()).trim() === t('an.fld.win.write'));
  await shot(frame, '2-valeur');
  await frame.locator('[data-fk="fw-ok"]').click();
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached', timeout: 20000 });
  let col = await colOf(run, 'Personnes', 'Contrat');
  check('Grist a les quatre valeurs, le type est resté « Choix »', col.type === 'Choice' && col.options.choices.join() === 'Titulaire,Contractuel,Contractuelle,Apprenti', JSON.stringify(col));
  check('la couleur du choix et l\'alignement n\'ont pas bougé (les autres options restent)', JSON.stringify(col.options.choiceOptions) === JSON.stringify(CHOICE_OPTIONS) && col.options.alignment === 'center',
    JSON.stringify(col.options));
  check('aucune cellule n\'a changé', JSON.stringify(((await rowsOf(run, 'Personnes')) || []).map(row => row.Contrat)) === JSON.stringify(contrats));

  say('--- 2. une valeur de moins : les cellules qui la portent gardent leur texte ---');
  const before = contrats.filter(value => value === 'Contractuelle').length;
  await openField(frame, page, 0);
  await frame.locator('[data-fk="fw-val-x:2"]').click();
  check('le résumé dit la valeur retirée', (await previewOf(frame)).some(line => line.includes(t('an.fld.win.pvRemove', { values: 'Contractuelle' }))), await previewOf(frame));
  await frame.locator('[data-fk="fw-ok"]').click();
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached', timeout: 20000 });
  col = await colOf(run, 'Personnes', 'Contrat');
  check('Grist n\'a plus « Contractuelle » parmi les valeurs, la couleur reste', col.options.choices.join() === 'Titulaire,Contractuel,Apprenti' && Boolean(col.options.choiceOptions), JSON.stringify(col.options));
  check('les cellules « Contractuelle » sont toujours là (' + before + ')', ((await rowsOf(run, 'Personnes')) || []).filter(row => row.Contrat === 'Contractuelle').length === before);

  say('--- 3. le nom du champ : l\'annuaire l\'écrit, la colonne garde le sien, rien ne s\'écrit dans Grist ---');
  const states = async () => (await rowsOf(run, '_grist_Tables_column')).filter(row => row.colId === 'Contrat').map(row => `${row.type}|${row.widgetOptions}`).join();
  const colsBefore = await states();
  await openField(frame, page, 0);
  await typeInto(frame, 'fw-name', 'Type de contrat');
  await frame.locator('[data-fk="fw-ok"]').click();
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached' });
  const rowText = (await frame.locator('.an-ftable .an-frow', { hasText: 'Type de contrat' }).first().innerText()).replace(/\s+/g, ' ');
  check('la ligne dit « Type de contrat » et la colonne « Contrat » en repère', rowText.includes('Type de contrat') && rowText.includes('Contrat'), rowText);
  check('Grist n\'a pas bougé', (await states()) === colsBefore);
  await shot(frame, '3-nom');
  await frame.locator('[data-fk="set-save"]').click();
  await frame.locator('[data-fk="tab:fields"]').waitFor({ state: 'detached', timeout: 20000 });
  const saved = await configOf(run);
  const contrat = ((saved && saved.fields) || []).find(field => field.col === 'Contrat') || {};
  check('le réglage de l\'annuaire garde le nom « Type de contrat » et la colonne « Contrat »', contrat.label === 'Type de contrat' && contrat.col === 'Contrat', JSON.stringify(contrat));
  await frame.locator('[data-fk="filters"]').click();
  await page.waitForTimeout(400);
  const panel = (await frame.locator('body').innerText()).replace(/\s+/g, ' ');
  check('les filtres de l\'annuaire disent « Type de contrat » (la colonne s\'appelle « Contrat »)', /type de contrat/i.test(panel), panel.slice(0, 300));
  await shot(frame, '3-filtres');
  await page.keyboard.press('Escape');

  say('--- 4. du texte devient un choix multiple : un seul lot, les cellules deviennent des listes ---');
  await openFields(frame);
  await openField(frame, page, 1);
  const types = await frame.locator('.mod.an-fw [data-type]').evaluateAll(nodes => nodes.map(node => ({ genre: node.dataset.type, off: node.getAttribute('aria-disabled') === 'true',
    pressed: node.getAttribute('aria-pressed') === 'true' })));
  check('« Texte » est le type en cours ; texte, choix, choix multiple, oui/non, date et nombre sont ouverts (de quoi convertir du texte)',
    types.find(type => type.genre === 'text').pressed && types.every(type => !type.off), JSON.stringify(types));
  await frame.locator('[data-fk="fw-type:choicelist"]').click();
  const says = await previewOf(frame);
  check('le résumé dit le nouveau type et combien de valeurs seront découpées', says.some(line => line.includes(t('an.fld.win.pvType', { col: 'Etiquettes', from: t('an.type.text'), to: t('an.type.choicelist') })))
    && says.some(line => line.includes('découpée') || line.includes('split')), says);
  const proposed = await valuesOf(frame);
  say('  les valeurs que GFS propose :', proposed.join(', '));
  check('les valeurs proposées sont celles des étiquettes, sans doublon', ['Budget', 'Marchés publics', 'Pilotage', 'Données', 'Accueil'].every(value => proposed.includes(value))
    && new Set(proposed).size === proposed.length, proposed);
  await shot(frame, '4-type');
  await frame.locator('[data-fk="fw-ok"]').click();
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached', timeout: 20000 });
  col = await colOf(run, 'Personnes', 'Etiquettes');
  check('Grist a une colonne « Choix multiple » avec les valeurs proposées', col.type === 'ChoiceList' && ['Budget', 'Marchés publics', 'Pilotage', 'Données', 'Accueil'].every(value => (col.options.choices || []).includes(value)),
    JSON.stringify(col));
  const lists = ((await rowsOf(run, 'Personnes')) || []).slice(0, 6).map(row => listOf(row.Etiquettes));
  say('  les cellules relues :', JSON.stringify(lists));
  check('chaque texte est devenu une liste (virgule et point-virgule coupent, la case vide reste vide)', JSON.stringify(lists.map(list => (Array.isArray(list) ? list : []))) ===
    JSON.stringify([['Budget', 'Marchés publics'], ['Budget', 'Pilotage'], ['Données'], [], ['Accueil'], ['Budget']]), JSON.stringify(lists));
  const strings = ((await rowsOf(run, 'Personnes')) || []).filter(row => typeof row.Etiquettes === 'string' && row.Etiquettes !== '');
  check('aucune cellule n\'est restée en texte (le type et les cellules sont écrits ensemble)', strings.length === 0, strings.length);
  await frame.locator('[data-fk="set-cancel"]').click();
  await frame.locator('[data-fk="tab:fields"]').waitFor({ state: 'detached' });

  say('--- 5. un choix multiple qui a des valeurs : les types que Grist abîmerait sont grisés, avec leur raison ---');
  await openFields(frame);
  await openField(frame, page, 2);
  const grey = await frame.locator('.mod.an-fw [data-type]').evaluateAll(nodes => nodes.filter(node => node.getAttribute('aria-disabled') === 'true').map(node => node.dataset.type));
  check('texte, choix, oui/non, date et nombre sont grisés ; le choix multiple, en cours, ne l\'est pas', ['text', 'choice', 'bool', 'date', 'number'].every(genre => grey.includes(genre))
    && !grey.includes('choicelist'), JSON.stringify(grey));
  const why = (await frame.locator('.mod.an-fw .an-set-hint').allInnerTexts()).join(' ');
  check('la raison est écrite sous les types (jamais seulement dans une bulle)', why.includes(t('an.fld.win.noConvert')), why);
  await frame.locator('[data-type="text"]').click({ force: true });
  col = await colOf(run, 'Personnes', 'Competences');
  check('un clic sur un type grisé ne change rien : ni le résumé, ni Grist', (await previewOf(frame)).length === 0 && col.type === 'ChoiceList');
  await shot(frame, '5-grise');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached' });

  say('--- 6. une colonne créée avec ses valeurs ---');
  await frame.locator('[data-fk="field-add"]').click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  await frame.locator('.mod.pk [data-fk="pick-new:"]').click();
  await frame.locator('.mod.an-nl').waitFor({ state: 'visible' });
  await typeInto(frame, 'nc-name', 'Statut');
  await frame.locator('[data-fk="nc-type:Choice"]').click();
  await typeInto(frame, 'nc-val-in', 'Actif, Parti');
  await page.keyboard.press('Enter');
  await shot(frame, '6-creer');
  await frame.locator('[data-fk="nc-ok"]').click();
  await frame.locator('.mod.an-nl').waitFor({ state: 'detached', timeout: 20000 });
  col = await colOf(run, 'Personnes', 'Statut');
  check('Grist a la colonne « Statut » : un choix, aux valeurs « Actif » et « Parti »', Boolean(col) && col.type === 'Choice' && col.options.choices.join() === 'Actif,Parti', JSON.stringify(col));
  await frame.locator('[data-fk="set-cancel"]').click();
  await frame.locator('[data-fk="tab:fields"]').waitFor({ state: 'detached' });

  say('--- 7. Grist refuse (une règle d\'accès interdit de changer la structure) : sa phrase est dite, la fenêtre reste, rien n\'est écrit ---');
  const rule = await apply(run, [['AddRecord', '_grist_ACLResources', -1, { tableId: '*', colIds: '*' }],
    ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: '', permissionsText: '-S', rulePos: 1, memo: 'essai : personne ne change la structure' }]]);
  check('la règle d\'essai est posée', rule.status === 200, rule.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await openFields(frame);
  const optionsBefore = JSON.stringify((await colOf(run, 'Personnes', 'Contrat')).options);
  await openField(frame, page, 0);
  await typeInto(frame, 'fw-val-in', 'Stagiaire');
  await page.keyboard.press('Enter');
  await frame.locator('[data-fk="fw-ok"]').click();
  await page.waitForTimeout(1500);
  const refusal = await noteOf(frame);
  say('  la phrase que Grist a donnée :', refusal);
  check('la fenêtre est toujours là, le refus est dit (« Grist n\'a pas modifié la colonne : … »)', refusal.startsWith(t('an.fld.win.refused', { reason: '' }).trim().slice(0, 20)) && refusal.length > 40
    && (await frame.locator('.mod.an-fw .mod-note.is-warn').count()) === 1, refusal);
  check('on peut réessayer (le bouton n\'est pas grisé)', (await frame.locator('[data-fk="fw-ok"]').getAttribute('aria-disabled')) !== 'true');
  check('rien n\'est écrit', JSON.stringify((await colOf(run, 'Personnes', 'Contrat')).options) === optionsBefore);
  await shot(frame, '7-refus');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.an-fw').waitFor({ state: 'detached' });
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  await play(run);
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 400));
  for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: join(SHOTS, `${TAG}-erreur.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  pages.close();
}
