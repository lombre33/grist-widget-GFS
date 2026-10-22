// L'accord à la publication d'un formulaire (contrats 3.3, point 9 ; choix du porteur du 22/10 : « Form+ et GFS »), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier
// (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). Form+ (non modifiée, référencée à c249c4a) fait les appels, avec les droits de son manifeste.
// grist-static n'a pas de partages : ce que Grist ouvre à qui a le lien (les règles lues dans ACLRulesReader.ts, mesurées par Form+ sur un vrai Grist) n'est pas mesuré ici. Le labo mesure
// ce que GFS fait : la fenêtre, l'accord, le refus, et que rien n'est écrit tant que la personne n'a pas accordé.
//   1. Publier la section d'un formulaire dont la table a une colonne que le formulaire ne montre pas : la fenêtre dit la table et les colonnes cachées, le clavier est sur « Refuser » ;
//      « Refuser » à la souris, Entrée et Échap : l'app reçoit GFS_ANNULE, le document n'a pas bougé.
//   2. « Autoriser » à la souris : le lot passe. Le même lot rejoué : aucune fenêtre.
//   3. Ajouter à la section publiée un champ Référence : la fenêtre dit la colonne qui devient lisible (la table visée) ; « Refuser » : le champ n'est pas posé ; « Autoriser » : il l'est.
//   4. Publier une deuxième section sur la même table (tous ses champs, la Référence comprise) : rien de plus n'est ouvert, aucune fenêtre ; publier une autre table : la fenêtre la nomme,
//      sans colonne cachée à dire.
//   4 ter. Une table de GFS, d'une autre app, ou de l'app qui publie : refus sans fenêtre (rien n'est proposé à la personne), rien d'écrit.
//   5. Ce que le courtier ne juge pas est refusé sans fenêtre (« ajouter ou mettre à jour » sur les champs d'une section), et rien de tout cela n'a été écrit par un refus.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `publication-${lang}-${scheme}`;
const FORM_URL = /(apps\/form|FormPlus)\//;
const WORDS = lang === 'fr'
  ? { title: /Ouvrir au public ?/, app: /Form\+ veut ouvrir/, write: /ajouter des lignes à la table « Reponses »/, hidden: /ces colonnes que le formulaire ne montre pas : Statut, Repas/, read: /lire toutes les valeurs de la colonne « Nom » de la table « Menus »/,
    plain: /ajouter des lignes à la table « Notes »/, note: /Rien ne limite le nombre de lignes.*Dépublier/s, yes: 'Autoriser', no: 'Refuser' }
  : { title: /Open to the public\?/, app: /Form\+ wants to open/, write: /add rows to the table “Reponses”/, hidden: /these columns the form does not show: Statut, Repas/, read: /read every value of the column “Nom” of the table “Menus”/,
    plain: /add rows to the table “Notes”/, note: /Nothing limits how many rows.*Unpublish/s, yes: 'Allow', no: 'Refuse' };

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && FORM_URL.test(message.location().url || '')) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

// ----- 0. Le document, tel que la personne le prépare dans Grist (sans le courtier) : trois tables, un formulaire par page, un champ de moins que de colonnes.
let host = lab.frame;
const act = actions => host.evaluate(list => grist.docApi.applyUserActions(list), actions);
const table = name => host.evaluate(tableId => grist.docApi.fetchTable(tableId), name);
await act([['AddTable', 'Reponses', [{ id: 'Nom', type: 'Text' }, { id: 'Email', type: 'Text' }, { id: 'Statut', type: 'Text' }]]]);
await act([['AddTable', 'Menus', [{ id: 'Nom', type: 'Text' }, { id: 'Prix', type: 'Numeric' }]]]);
await act([['AddTable', 'Notes', [{ id: 'Texte', type: 'Text' }]]]);
await act([['AddColumn', 'Reponses', 'Repas', { type: 'Ref:Menus' }]]);
// Trois tables qu'un lien public n'ouvre jamais : celle de GFS, celle d'une autre app (Publipostage+), celle de l'app qui publie (Form+).
for (const name of ['GFS_Zone', 'Publipostage_Zone', 'FormPlus_Zone']) await act([['AddTable', name, [{ id: 'Nom', type: 'Text' }]]]);
const tables = await table('_grist_Tables');
const tableRef = tableId => tables.id[tables.tableId.indexOf(tableId)];
const columns = await table('_grist_Tables_column');
const columnRef = (tableId, colId) => columns.id.find((id, i) => columns.parentId[i] === tableRef(tableId) && columns.colId[i] === colId);
await act([['UpdateRecord', '_grist_Tables_column', columnRef('Reponses', 'Repas'), { visibleCol: columnRef('Menus', 'Nom') }]]);
const createdA = await act([['CreateViewSection', tableRef('Reponses'), 0, 'form', null, null]]);
const createdB = await act([['CreateViewSection', tableRef('Reponses'), 0, 'form', null, null]]);
const createdC = await act([['CreateViewSection', tableRef('Notes'), 0, 'form', null, null]]);
const protectedSections = [];
for (const name of ['GFS_Zone', 'Publipostage_Zone', 'FormPlus_Zone']) protectedSections.push([name, (await act([['CreateViewSection', tableRef(name), 0, 'form', null, null]])).retValues[0].sectionRef]);
const [sectionA, sectionB, sectionC] = [createdA, createdB, createdC].map(made => made.retValues[0].sectionRef);
host = await lab.gfsFrame(/access=full/);
await lab.gfsReady(host);
// Les champs de la section A : Nom et Email seulement (Statut et Repas ne sont pas dans le formulaire).
const fieldsNow = () => table('_grist_Views_section_field');
let fields = await fieldsNow();
const drop = fields.id.filter((id, i) => fields.parentId[i] === sectionA && [columnRef('Reponses', 'Statut'), columnRef('Reponses', 'Repas')].includes(fields.colRef[i]));
await act(drop.map(id => ['RemoveRecord', '_grist_Views_section_field', id]));
const sections = () => table('_grist_Views_section');
const optionsOf = async id => { const data = await sections(); return data.shareOptions[data.id.indexOf(id)]; };
say('document :', JSON.stringify({ sections: [sectionA, sectionB, sectionC], retirés: drop.length }));
check('le document de départ : aucune section publiée, un formulaire montre Nom et Email seulement',
  !(await optionsOf(sectionA)) && !(await optionsOf(sectionB)) && !(await optionsOf(sectionC)) && drop.length === 2, { drop });

// ----- L'app : Form+, dans son sous-cadre isolé.
const app = await lab.openApp('form', FORM_URL, host);
check('Form+ est ouverte dans son sous-cadre', Boolean(app));
await page.waitForTimeout(3000);
await lab.fitPanel(host, 700, 400);
warnings.length = 0;

// Un appel de l'app à `applyUserActions`, que la fenêtre peut retenir : on le lance, on lit sa fin plus tard.
const launch = actions => app.evaluate(list => {
  window.__call = { done: false };
  grist.docApi.applyUserActions(list).then(
    value => { window.__call = { done: true, ok: true, value: JSON.stringify(value).slice(0, 80) }; },
    error => { window.__call = { done: true, ok: false, code: error && error.code, message: String((error && error.message) || error) }; });
}, actions);
const outcome = async () => {
  try { await app.waitForFunction(() => window.__call && window.__call.done, null, { timeout: 15000 }); } catch (error) { return { done: false, ok: false, code: 'SANS_REPONSE', message: 'la demande n\'a pas abouti en 15 s (une fenêtre est restée ouverte ?)' }; }
  return app.evaluate(() => window.__call);
};
const ask = host.locator('.ask');
const askSeen = async () => { try { await ask.waitFor({ timeout: 8000 }); return true; } catch (error) { return false; } };
const noAsk = async () => { await page.waitForTimeout(1500); return (await ask.count()) === 0; };
const questionFacts = () => host.evaluate(() => {
  const box = document.querySelector('.ask').getBoundingClientRect();
  const body = document.querySelector('.ask-body');
  return {
    title: document.querySelector('.ask h2').textContent, text: document.querySelector('.ask-body #ask-text').textContent,
    items: [...document.querySelectorAll('.ask-items li')].map(li => li.textContent), note: (document.querySelector('.ask-note') || {}).textContent || '',
    buttons: [...document.querySelectorAll('.ask button')].map(button => button.textContent), focus: document.activeElement && document.activeElement.dataset.fk,
    inPanel: box.top >= -0.5 && box.left >= -0.5 && box.bottom <= innerHeight + 0.5 && box.right <= innerWidth + 0.5, whole: body.scrollHeight <= body.clientHeight + 1,
    size: [innerWidth, innerHeight],
  };
});
const publish = id => [['UpdateRecord', '_grist_Views_section', id, { shareOptions: '{"publish":true,"form":true}' }]];

// ----- 1. Publier la section A : la fenêtre, le refus sous trois formes.
await launch(publish(sectionA));
check('publier un formulaire fait apparaître une fenêtre de GFS', await askSeen());
let facts = await questionFacts();
say('la fenêtre :', JSON.stringify(facts));
check('elle dit l\'app, la table, et les colonnes que le formulaire ne montre pas mais que le lien pourra remplir',
  WORDS.title.test(facts.title) && WORDS.app.test(facts.text) && facts.items.length === 1 && WORDS.write.test(facts.items[0]) && WORDS.hidden.test(facts.items[0]), facts);
check('elle dit ce que le lien ne fera pas', WORDS.note.test(facts.note), facts.note);
check('deux boutons, « Refuser » en premier, et le clavier est dessus (Entrée ne donne rien d\'ouvert)', facts.buttons.join() === `${WORDS.no},${WORDS.yes}` && facts.focus === 'ask-no', { buttons: facts.buttons, focus: facts.focus });
check('elle tient dans le panneau de 700 × 400, sans défilement', facts.inPanel && facts.whole && facts.size[0] === 700 && facts.size[1] === 400, facts);
await lab.shotPanel(run, '1-fenetre', host);
await host.locator('[data-fk="ask-no"]').click();
let result = await outcome();
check('« Refuser » à la souris : l\'app reçoit GFS_ANNULE', !result.ok && /GFS_ANNULE|refusé|declined/i.test(`${result.code} ${result.message}`), result);
check('le document n\'a pas bougé', !(await optionsOf(sectionA)));
check('la fenêtre est partie', await noAsk());

await launch(publish(sectionA));
await askSeen();
await page.keyboard.press('Enter');
result = await outcome();
check('Entrée (le clavier est sur « Refuser ») : refusé, rien d\'écrit', !result.ok && /GFS_ANNULE|refusé|declined/i.test(`${result.code} ${result.message}`) && !(await optionsOf(sectionA)), result);

await launch(publish(sectionA));
await askSeen();
await page.keyboard.press('Escape');
result = await outcome();
check('Échap : refusé, rien d\'écrit', !result.ok && /GFS_ANNULE|refusé|declined/i.test(`${result.code} ${result.message}`) && !(await optionsOf(sectionA)), result);
check('le courtier le dit dans la console (avertissement GFS_ANNULE)', warnings.some(text => /GFS_ANNULE/.test(text)), warnings.slice(-2));

// ----- 2. Autoriser : le lot passe ; le même lot, ou une deuxième section sur la même table : plus de fenêtre.
await launch(publish(sectionA));
await askSeen();
await host.locator('[data-fk="ask-yes"]').click();
result = await outcome();
check('« Autoriser » à la souris : le lot passe', result.ok, result);
check('la section est publiée dans le document', /"publish":\s*true/.test(await optionsOf(sectionA)) && /"form":\s*true/.test(await optionsOf(sectionA)), await optionsOf(sectionA));
await launch(publish(sectionA));
result = await outcome();
check('le même lot rejoué : aucune fenêtre, il passe', result.ok && await noAsk(), result);

// ----- 3. Un champ Référence ajouté à la section publiée : la colonne affichée de la table visée devient lisible (« Menus.Nom »).
const addField = [['AddRecord', '_grist_Views_section_field', null, { parentId: sectionA, colRef: columnRef('Reponses', 'Repas'), widgetOptions: '{"formIsHidden":true}' }]];
await launch(addField);
check('ajouter un champ Référence à un formulaire publié fait apparaître la fenêtre', await askSeen());
facts = await questionFacts();
say('la fenêtre :', JSON.stringify(facts));
check('elle dit la colonne qui devient lisible, et rien d\'autre (la table des réponses est déjà ouverte)', facts.items.length === 1 && WORDS.read.test(facts.items[0]), facts.items);
check('elle tient dans le panneau', facts.inPanel && facts.whole, facts);
await lab.shotPanel(run, '2-lecture', host);
await host.locator('[data-fk="ask-no"]').click();
result = await outcome();
fields = await fieldsNow();
check('« Refuser » : le champ n\'est pas posé', !result.ok && /GFS_ANNULE/.test(`${result.code}`) && !fields.parentId.some((parent, i) => parent === sectionA && fields.colRef[i] === columnRef('Reponses', 'Repas')), result);
await launch(addField);
await askSeen();
await host.locator('[data-fk="ask-yes"]').click();
result = await outcome();
fields = await fieldsNow();
check('« Autoriser » : le champ est posé', result.ok && fields.parentId.some((parent, i) => parent === sectionA && fields.colRef[i] === columnRef('Reponses', 'Repas')), result);

// ----- 4. Une deuxième section sur la même table, avec tous ses champs (dont la Référence) : la table et la colonne lue sont déjà ouvertes, rien de plus à accorder.
await launch(publish(sectionB));
result = await outcome();
check('une deuxième section sur la même table : aucune fenêtre, rien d\'ouvert de plus', result.ok && await noAsk(), result);

// ----- 4 bis. Une autre table.
await launch(publish(sectionC));
check('publier un formulaire sur une autre table fait apparaître la fenêtre', await askSeen());
facts = await questionFacts();
check('elle nomme cette table, sans colonne cachée à dire', facts.items.length === 1 && WORDS.plain.test(facts.items[0]) && !/ne montre pas|do not show/.test(facts.items[0]), facts.items);
await lab.shotPanel(run, '3-autre-table', host);
await host.locator('[data-fk="ask-yes"]').click();
result = await outcome();
check('« Autoriser » : le lot passe', result.ok && /"publish":\s*true/.test(await optionsOf(sectionC)), result);

// ----- 4 ter. Une table protégée n'est jamais proposée à la personne : refus, sans fenêtre, le document n'a pas bougé (contrats 11.9, point 4c).
for (const [name, section] of protectedSections) {
  await launch(publish(section));
  result = await outcome();
  check(`la table ${name} n'est jamais ouverte au public : refus sans fenêtre, rien d'écrit`,
    !result.ok && result.code === 'GFS_REFUSE' && result.message.includes(name) && /à l'ajout/.test(result.message) && await noAsk() && !(await optionsOf(section)), result);
}

// ----- 5. Ce que le courtier ne sait pas juger est refusé sans fenêtre.
await launch([['AddOrUpdateRecord', '_grist_Views_section_field', { parentId: sectionA }, { widgetOptions: '{}' }]]);
result = await outcome();
check('« ajouter ou mettre à jour » sur les champs d\'une section est refusé, sans fenêtre', !result.ok && /GFS_REFUSE|ne se juge pas/i.test(`${result.code} ${result.message}`) && await noAsk(), result);
check('aucune erreur de script dans l\'app', errors.length === 0, errors);
await lab.browser.close();
