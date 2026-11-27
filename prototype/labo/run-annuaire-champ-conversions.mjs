// Ce que Grist fait d'un `ModifyColumn` qui change le TYPE d'une colonne qui a déjà des valeurs (module Annuaire, « Modifier le champ » ; choix du porteur, 27/11 ; faits vérifiés 191),
// dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à l'API REST : c'est ce qui fixe la règle de js/annuaire/annuaire-field-edit.js (`typeVerdict` : quels changements
// de type GFS ouvre, lesquels il grise avec leur raison). Aucun écran ici ; l'écran est mesuré par run-annuaire-champ-ui.mjs.
//   bash vrai-serveur.sh && node run-annuaire-champ-conversions.mjs
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument } from './lab-serveur.mjs';
import { call } from './lab-rest.mjs';

await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, await requireServer(), {});
  const page = await context.newPage();
  const docId = (await createDocument(page)).split('/')[3];
  const apply = async actions => { const answer = await call(page, 'POST', `/api/docs/${docId}/apply`, actions); return answer.status === 200 ? answer.json : { status: answer.status, text: answer.text }; };
  const info = async id => {
    const [row] = (await call(page, 'GET', `/api/docs/${docId}/tables/_grist_Tables_column/records`)).json.records.map(each => each.fields).filter(each => each.colId === id);
    return { type: row.type, options: row.widgetOptions ? JSON.parse(row.widgetOptions) : {} };
  };
  const cells = async (table, col) => (await call(page, 'GET', `/api/docs/${docId}/tables/${table}/records`)).json.records.map(each => each.fields[col]);
  const show = (label, value) => say('  ', label, JSON.stringify(value));

  await apply([['AddTable', 'P', [{ id: 'Tags', type: 'ChoiceList' }, { id: 'Un', type: 'Text' }, { id: 'Num', type: 'Text' }, { id: 'Flag', type: 'Text' }, { id: 'Day', type: 'Text' },
    { id: 'Vals', type: 'Text' }]], ['AddTable', 'Q', [{ id: 'N', type: 'Text' }]]]);
  await apply([['BulkAddRecord', 'Q', [null, null], { N: ['Alpha', 'Beta'] }], ['AddColumn', 'P', 'Link', { type: 'Ref:Q' }],
    ['BulkAddRecord', 'P', [null, null, null, null], { Tags: [['L', 'A', 'B'], ['L', 'A'], null, ['L', 'B']], Un: ['A, B', 'A', '', 'B; C'], Num: ['12', '3,5', 'abc', ''],
      Flag: ['oui', 'true', 'non', ''], Day: ['2024-03-01', '01/03/2024', 'hier', ''], Vals: ['x', 'y', 'x', 'z'], Link: [1, 2, 0, 1] }]]);

  say('--- 1. un choix multiple qui a des valeurs : retyper abîme les cellules ---');
  await apply([['ModifyColumn', 'P', 'Tags', { type: 'Choice' }]]);
  const asChoice = await cells('P', 'Tags');
  show('choix multiple → choix', asChoice);
  check('les listes deviennent un texte (« A, B » abîmé), plus des valeurs', asChoice.every(value => value === null || value === '' || typeof value === 'string') && asChoice[0] !== 'A', asChoice);
  await apply([['ModifyColumn', 'P', 'Tags', { type: 'ChoiceList' }]]);
  const back = await cells('P', 'Tags');
  show('… puis choix → choix multiple', back);
  check('retyper en choix multiple ne rend pas les listes d\'avant', !Array.isArray(back[0]) || back[0].join() !== 'A,B', back);

  say('--- 2. un lien vers une autre table : retyper en texte écrit des numéros de ligne ---');
  await apply([['ModifyColumn', 'P', 'Link', { type: 'Text' }]]);
  const links = await cells('P', 'Link');
  show('lien → texte', links);
  check('le texte n\'est pas « Alpha » (le numéro de ligne, ou rien, pas le libellé)', links[0] !== 'Alpha', links);

  say('--- 3. du texte vers un choix : les cellules restent, les valeurs sont dites ---');
  await apply([['ModifyColumn', 'P', 'Vals', { type: 'Choice', widgetOptions: JSON.stringify({ choices: ['x', 'y'], alignment: 'center', choiceOptions: { x: { fillColor: '#FF0000' } } }) }]]);
  check('texte → choix : les cellules sont intactes', JSON.stringify(await cells('P', 'Vals')) === JSON.stringify(['x', 'y', 'x', 'z']));
  await apply([['ModifyColumn', 'P', 'Vals', { widgetOptions: JSON.stringify({ choices: ['x', 'w'] }) }]]);
  const replaced = await info('Vals');
  show('options après un widgetOptions qui ne dit que « choices »', replaced);
  check('les options sont REMPLACÉES en entier (la couleur et l\'alignement disparaissent) : GFS fusionne', replaced.options.alignment === undefined && replaced.options.choiceOptions === undefined, replaced);
  check('retirer une valeur (« y », « z ») laisse les cellules qui la portent', JSON.stringify(await cells('P', 'Vals')) === JSON.stringify(['x', 'y', 'x', 'z']));

  say('--- 4. du texte vers un choix multiple : Grist ne découpe rien ---');
  await apply([['ModifyColumn', 'P', 'Un', { type: 'ChoiceList', widgetOptions: JSON.stringify({ choices: ['A', 'B', 'C'] }) }]]);
  const notSplit = await cells('P', 'Un');
  show('texte → choix multiple, type seul', notSplit);
  check('« A, B » n\'est pas devenu ["A","B"] : GFS écrit les listes lui-même', !Array.isArray(notSplit[0]) || notSplit[0].join() !== 'A,B', notSplit);
  await apply([['ModifyColumn', 'P', 'Un', { type: 'Text' }]]);
  const lot = await apply([['ModifyColumn', 'P', 'Un', { type: 'ChoiceList', widgetOptions: JSON.stringify({ choices: ['A', 'B', 'C'] }) }],
    ['BulkUpdateRecord', 'P', [1, 2, 3, 4], { Un: [['L', 'A', 'B'], ['L', 'A'], null, ['L', 'B', 'C']] }]]);
  const listed = await cells('P', 'Un');
  show('le même changement, en UN lot avec les listes', listed);
  check('un seul lot : le type et les listes sont écrits ensemble', !lot.status && listed.every((value, at) => JSON.stringify(Array.isArray(value) && value[0] === 'L' ? value.slice(1) : value) ===
    JSON.stringify([['A', 'B'], ['A'], null, ['B', 'C']][at])), listed);

  say('--- 5. du texte vers un nombre, un oui/non, une date : Grist convertit ce qu\'il comprend ---');
  await apply([['ModifyColumn', 'P', 'Num', { type: 'Numeric' }], ['ModifyColumn', 'P', 'Flag', { type: 'Bool' }], ['ModifyColumn', 'P', 'Day', { type: 'Date' }]]);
  const nums = await cells('P', 'Num');
  const flags = await cells('P', 'Flag');
  const days = await cells('P', 'Day');
  show('nombre', nums);
  show('oui/non', flags);
  show('date', days);
  check('nombre : « 12 » devient 12 ; « abc » reste du texte (rouge dans Grist), rien n\'est perdu', nums[0] === 12 && nums[2] === 'abc', nums);
  check('oui/non : « true » devient vrai ; la case vide devient faux', flags[1] === true && flags[3] === false, flags);
  check('date : « 2024-03-01 » devient une date ; « hier » reste du texte', typeof days[0] === 'number' && days[2] === 'hier', days);
  await browser.close();
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 400));
  await browser.close().catch(() => {});
  process.exitCode = 1;
}
