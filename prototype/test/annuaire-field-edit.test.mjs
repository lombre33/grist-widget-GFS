// Modifier un champ de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « le nom du champ, la colonne, ses valeurs et son type ») : le nom du champ propre à l'annuaire,
// ce qu'on peut changer dans Grist pour la colonne (son type, ses valeurs), ce qui s'écrit. Rien ne parle à Grist ici : la fenêtre se mesure sous Firefox
// (test/annuaire-champ-firefox.mjs), l'écriture dans un vrai Grist (labo/run-annuaire-champ-ui.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, fieldLabel, addColumnAction } from '../js/annuaire/annuaire-config.js';
import { csvColumns } from '../js/annuaire/annuaire-mail.js';
import { FIELD_TYPES, editLock, isEmpty, splitTags, typeVerdict, suggestedChoices, mergeOptions, planChange, modifyActions } from '../js/annuaire/annuaire-field-edit.js';

const col = (type, genre, extra = {}) => ({ id: 'Tag', type, genre, ref: '', visible: '', formula: false, choices: [], ...extra });

test('le nom d\'un champ est à lui : vide, c\'est le nom de sa colonne ; une colonne suivie donne sa dernière colonne', () => {
  assert.equal(fieldLabel({ col: 'Contrat', path: [], label: '' }), 'Contrat');
  assert.equal(fieldLabel({ col: 'Contrat', path: [], label: 'Type de contrat' }), 'Type de contrat');
  assert.equal(fieldLabel({ col: 'Poste › Pôle', path: ['Poste', 'Pôle'], label: '' }), 'Pôle');
  assert.equal(fieldLabel({ col: 'Poste › Pôle', path: ['Poste', 'Pôle'], label: '  Pôle du poste ' }), 'Pôle du poste');
  assert.equal(fieldLabel({ col: 'Contrat', path: [] }), 'Contrat', 'un champ écrit avant ce réglage n\'a pas de nom propre');
});

test('le nom du champ s\'écrit dans le réglage et se relit, sans jamais toucher à la colonne', () => {
  const config = readConfig({ name: 'Nom', fields: [{ col: 'Contrat', label: ' Type de contrat ', filter: true }, { col: 'Poste › Pôle', label: '', list: true }] });
  assert.equal(config.fields[0].label, 'Type de contrat');
  assert.equal(config.fields[0].col, 'Contrat');
  assert.equal(config.fields[1].label, '');
  const again = readConfig(writeConfig(config));
  assert.deepEqual(again.fields.map(field => [field.col, field.label]), [['Contrat', 'Type de contrat'], ['Poste › Pôle', '']]);
  assert.equal(readConfig({ fields: [{ col: 'A' }] }).fields[0].label, '', 'un champ sans nom propre en a un vide');
});

test('l\'export de la liste porte le nom du champ, pas celui de sa colonne', () => {
  const config = readConfig({ name: 'Nom', fields: [{ col: 'Contrat', label: 'Type de contrat', column: true }, { col: 'Poste › Pôle', path: ['Poste', 'Pôle'], column: true }] });
  const columns = csvColumns(config, { labels: { name: 'Nom', email: 'Email', phone: 'Tél' }, genres: {}, show: value => value });
  assert.deepEqual(columns.map(column => column.label), ['Nom', 'Email', 'Type de contrat', 'Pôle']);
});

test('une colonne ne se change d\'ici que si Grist ne la calcule pas, n\'est pas un lien et a un type que GFS connaît', () => {
  assert.equal(editLock(col('Text', 'text')), '');
  assert.equal(editLock(col('ChoiceList', 'choicelist', { choices: ['A'] })), '');
  assert.equal(editLock(col('Int', 'number')), '');
  assert.equal(editLock(col('Text', 'text', { formula: true })), 'formula');
  assert.equal(editLock(col('Ref:Structures', 'ref', { ref: 'Structures' })), 'ref');
  assert.equal(editLock(col('RefList:Structures', 'reflist')), 'ref');
  assert.equal(editLock(col('DateTime:Europe/Paris', 'date')), 'type');
  assert.equal(editLock(col('Any', 'text')), 'type');
  assert.equal(editLock(null), 'type');
});

test('une cellule est vide quand elle n\'a que ce que Grist met par défaut', () => {
  for (const cell of [null, undefined, '', 0, false, ['L'], []]) assert.equal(isEmpty(cell), true, JSON.stringify(cell));
  for (const cell of ['a', 1, true, ['L', 'A']]) assert.equal(isEmpty(cell), false, JSON.stringify(cell));
});

test('des valeurs séparées par une virgule, un point-virgule ou un saut de ligne : sans blanc, sans vide, sans doublon', () => {
  assert.deepEqual(splitTags('A, B;C\nD,, A '), ['A', 'B', 'C', 'D']);
  assert.deepEqual(splitTags(''), []);
  assert.deepEqual(splitTags(null), []);
});

test('une colonne vide change de type librement ; avec des valeurs, seul le texte et le choix se changent (Grist abîme le reste)', () => {
  const empty = [null, '', null];
  const filled = ['Alpha', 'Beta, Gamma', ''];
  for (const genre of ['text', 'choice', 'choicelist', 'bool', 'date', 'number']) assert.equal(typeVerdict(col('Text', 'text'), genre, empty).ok, true);
  assert.equal(typeVerdict(col('ChoiceList', 'choicelist'), 'text', empty).ok, true, 'un choix multiple vide se change');
  assert.deepEqual(typeVerdict(col('Text', 'text'), 'choice', filled), { ok: true, why: '', tags: false, bestEffort: false });
  assert.deepEqual(typeVerdict(col('Choice', 'choice'), 'text', filled), { ok: true, why: '', tags: false, bestEffort: false });
  assert.equal(typeVerdict(col('Text', 'text'), 'choicelist', filled).tags, true, 'le texte se découpe en choix');
  for (const genre of ['bool', 'date', 'number']) assert.equal(typeVerdict(col('Text', 'text'), genre, filled).bestEffort, true);
  assert.equal(typeVerdict(col('Text', 'text'), 'text', filled).ok, true, 'le même type : rien à dire');
  for (const from of [col('ChoiceList', 'choicelist'), col('Numeric', 'number'), col('Bool', 'bool'), col('Date', 'date')]) {
    const verdict = typeVerdict(from, 'text', [from.genre === 'choicelist' ? ['L', 'A', 'B'] : 12]);
    assert.equal(verdict.ok, false, from.type);
    assert.equal(verdict.why, 'an.fld.win.noConvert');
  }
});

test('une colonne qui devient un choix propose les valeurs que ses cellules portent déjà, sans plus de cent', () => {
  assert.deepEqual(suggestedChoices('choice', ['Alpha', 'Beta', 'Alpha', '', null]), ['Alpha', 'Beta']);
  assert.deepEqual(suggestedChoices('choicelist', ['Alpha, Beta', 'Beta;Gamma', '']), ['Alpha', 'Beta', 'Gamma']);
  assert.deepEqual(suggestedChoices('choice', ['x']), ['x']);
  const many = Array.from({ length: 101 }, (_, at) => `v${at}`);
  assert.deepEqual(suggestedChoices('choice', many), [], 'du texte libre n\'est pas une liste de choix');
});

test('les options d\'une colonne gardent ce que Grist y a mis quand on change ses valeurs', () => {
  const raw = JSON.stringify({ choices: ['A'], choiceOptions: { A: { fillColor: '#FF0000' } }, alignment: 'center' });
  assert.deepEqual(JSON.parse(mergeOptions(raw, ['A', 'B'])), { choices: ['A', 'B'], choiceOptions: { A: { fillColor: '#FF0000' } }, alignment: 'center' });
  assert.deepEqual(JSON.parse(mergeOptions('', ['A'])), { choices: ['A'] });
  assert.deepEqual(JSON.parse(mergeOptions('pas du json', ['A'])), { choices: ['A'] }, 'des options illisibles ne bloquent rien');
  assert.deepEqual(JSON.parse(mergeOptions('[1]', ['A'])), { choices: ['A'] });
});

test('ajouter et retirer des valeurs : les options seules, jamais le type, jamais une cellule', () => {
  const tags = col('Choice', 'choice', { choices: ['Alpha', 'Beta'] });
  const plan = planChange({ col: tags, want: { genre: 'choice', choices: ['Alpha', 'Gamma', ' Delta ', 'Gamma', ''] }, cells: ['Alpha', 'Beta'], ids: [1, 2],
    raw: JSON.stringify({ choices: ['Alpha', 'Beta'], alignment: 'left' }) });
  assert.equal(plan.type, null);
  assert.deepEqual(plan.added, ['Gamma', 'Delta']);
  assert.deepEqual(plan.removed, ['Beta']);
  assert.deepEqual(plan.choices, ['Alpha', 'Gamma', 'Delta']);
  assert.equal(plan.rewrite, null);
  assert.equal(plan.changed, true);
  assert.deepEqual(JSON.parse(plan.options), { choices: ['Alpha', 'Gamma', 'Delta'], alignment: 'left' });
  assert.deepEqual(modifyActions('Personnes', 'Tag', plan), [['ModifyColumn', 'Personnes', 'Tag', { widgetOptions: plan.options }]]);
});

test('rien à changer : rien à écrire', () => {
  const tags = col('Choice', 'choice', { choices: ['Alpha', 'Beta'] });
  const plan = planChange({ col: tags, want: { genre: 'choice', choices: ['Alpha', 'Beta'] }, cells: [], ids: [], raw: '' });
  assert.equal(plan.changed, false);
  assert.equal(plan.options, null);
  assert.equal(planChange({ col: col('Text', 'text'), want: { genre: 'text', choices: [] }, cells: ['a'], ids: [1], raw: '' }).changed, false);
});

test('un texte qui devient un choix multiple : le type, les valeurs, et chaque cellule de texte découpée en liste, en un seul lot', () => {
  const text = col('Text', 'text');
  const cells = ['Alpha, Beta', '', 'Gamma', null, 'Beta;Alpha'];
  const plan = planChange({ col: text, want: { genre: 'choicelist', choices: ['Alpha', 'Beta', 'Gamma'] }, cells, ids: [1, 2, 3, 4, 5], raw: '' });
  assert.deepEqual(plan.type, { from: 'Text', to: 'ChoiceList', genre: 'choicelist' });
  assert.deepEqual(plan.rewrite, { ids: [1, 3, 5], cells: [['L', 'Alpha', 'Beta'], ['L', 'Gamma'], ['L', 'Beta', 'Alpha']] });
  assert.deepEqual(plan.added, ['Alpha', 'Beta', 'Gamma']);
  const actions = modifyActions('Personnes', 'Tag', plan);
  assert.equal(actions.length, 2);
  assert.deepEqual(actions[0], ['ModifyColumn', 'Personnes', 'Tag', { type: 'ChoiceList', widgetOptions: JSON.stringify({ choices: ['Alpha', 'Beta', 'Gamma'] }) }]);
  assert.deepEqual(actions[1], ['BulkUpdateRecord', 'Personnes', [1, 3, 5], { Tag: [['L', 'Alpha', 'Beta'], ['L', 'Gamma'], ['L', 'Beta', 'Alpha']] }]);
});

test('un choix multiple qui a des valeurs ne devient jamais un autre type d\'ici : le plan ne change rien', () => {
  const list = col('ChoiceList', 'choicelist', { choices: ['A', 'B'] });
  const plan = planChange({ col: list, want: { genre: 'text', choices: ['A', 'B'] }, cells: [['L', 'A', 'B']], ids: [1], raw: '' });
  assert.equal(plan.type, null, 'Grist en ferait « (\'A\', \'B\') »');
  assert.equal(plan.changed, false);
});

test('un type changé sans valeur à saisir : seulement le type ; une colonne vide devient ce qu\'on veut', () => {
  const plan = planChange({ col: col('Text', 'text'), want: { genre: 'number', choices: [] }, cells: [null, ''], ids: [1, 2], raw: '' });
  assert.deepEqual(plan.type, { from: 'Text', to: 'Numeric', genre: 'number' });
  assert.equal(plan.options, null);
  assert.equal(plan.rewrite, null);
  assert.deepEqual(modifyActions('P', 'Tag', plan), [['ModifyColumn', 'P', 'Tag', { type: 'Numeric' }]]);
  const best = planChange({ col: col('Text', 'text'), want: { genre: 'date', choices: [] }, cells: ['2024-03-01', 'hier'], ids: [1, 2], raw: '' });
  assert.equal(best.bestEffort, true);
});

test('un type d\'un autre genre que les six est ramené au texte, et les types proposés sont ceux de la création d\'une colonne', () => {
  assert.deepEqual(FIELD_TYPES.map(each => each.type), ['Text', 'Choice', 'ChoiceList', 'Bool', 'Date', 'Numeric']);
  assert.equal(planChange({ col: col('Text', 'text'), want: { genre: 'inconnu', choices: [] }, cells: [], ids: [], raw: '' }).changed, false);
});

test('une colonne créée avec des valeurs les écrit dans ses options, sans rien d\'autre ; sans valeur, rien n\'est ajouté', () => {
  const action = addColumnAction('Personnes', 'Tags', 'ChoiceList', 0, ['Alpha', 'Beta']);
  assert.deepEqual(action, ['AddColumn', 'Personnes', 'Tags', { type: 'ChoiceList', isFormula: false, label: 'Tags', widgetOptions: JSON.stringify({ choices: ['Alpha', 'Beta'] }) }]);
  assert.deepEqual(addColumnAction('Personnes', 'Note', 'Text'), ['AddColumn', 'Personnes', 'Note', { type: 'Text', isFormula: false, label: 'Note' }]);
});
