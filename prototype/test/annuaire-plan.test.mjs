// Le plan des bâtiments de l'annuaire (demande du porteur du 27/11 ; js/annuaire/annuaire-plan*.js) : la table des lieux et son arbre (un lieu orphelin ou pris dans une
// boucle reste lisible), le bureau de chaque personne, les décomptes, la création de la table avec l'accord de la personne, la lecture par le store, la section « Lieu » de la
// fiche et la vue (les cartes, le lieu grisé, le lieu repéré). Du code pur sur un faux Grist ; ce que Grist rend vraiment d'`AddTable` et d'`AddColumn` se mesure dans le labo
// (labo/run-annuaire-plan.mjs), l'aspect à l'écran à la vraie souris.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { fakeGrist } from './fake-grist.mjs';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';
import { ANNUAIRE_PLAN_STRINGS } from '../js/i18n/i18n-annuaire-plan.js';

installFakeDocument();

const { readConfig, planReady, PLAN_COLUMNS, PLAN_TABLE } = await import('../js/annuaire/annuaire-config.js');
const { planOf, kindOf, useOf, kindAt, pathOf, pathText, placeOfPerson, occupancy, officeChoices, childrenOf, siblingsOf, mapLinkOf, geoOf } = await import('../js/annuaire/annuaire-plan.js');
const { schemaOf, tablesNeeded } = await import('../js/annuaire/annuaire-schema.js');
const { AnnuaireStore } = await import('../js/annuaire/annuaire-store.js');
const { editableFields, refOptions } = await import('../js/annuaire/annuaire-edit.js');
const { placeContent } = await import('../js/annuaire/annuaire-plan-fiche.js');
const { PlanView } = await import('../js/annuaire/annuaire-plan-view.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const { t } = createI18n('fr');

// Le site « Siège » porte deux bâtiments ; le bâtiment A un étage, et l'étage un bureau, un couloir et un second bureau (trois places).
const places = () => ({
  id: [1, 2, 3, 4, 5, 6, 7],
  Name: ['Siège', 'Bâtiment A', '2e étage', 'Bureau 204', 'Couloir', 'Bureau 12', 'Bâtiment B'],
  Kind: ['Site', 'Building', 'Floor', 'Room', 'Room', 'Room', ''],
  Use: ['', '', '', 'Office', 'Circulation', 'Office', ''],
  Parent: [0, 1, 2, 3, 3, 3, 1],
  Address: ['1 rue de la Paix', '', '', '', '', '', ''],
  Capacity: [0, 0, 0, 1, 0, 3, 0],
});
const people = () => ({ id: [1, 2, 3, 4], Nom: ['Camille Durand', 'Inès Marchand', 'Nathan Roussel', 'Louis Girard'], Bureau: [4, 6, 0, 99] });
const planConfig = (extra = {}) => readConfig({ name: 'Nom', plan: { table: 'Directory_Places', office: 'Bureau' }, ...extra });
const data = () => ({ Personnes: people(), Directory_Places: places() });
const shown = ['Camille Durand', 'Inès Marchand', 'Nathan Roussel', 'Louis Girard'].map((name, i) => ({ row: i + 1, name, levels: [], title: '', avatar: 0 }));

test('la configuration : le plan se règle par une table et une colonne, vides par défaut, et ne casse jamais', () => {
  assert.deepEqual(readConfig({}).plan, { table: '', office: '' });
  assert.deepEqual(readConfig({ plan: { table: ' Directory_Places ', office: 'Bureau', extra: 1 } }).plan, { table: 'Directory_Places', office: 'Bureau' });
  assert.deepEqual(readConfig({ plan: 'n\'importe quoi' }).plan, { table: '', office: '' });
  assert.equal(planReady(readConfig({ plan: { table: 'Directory_Places' } })), false, 'sans la colonne du bureau, le plan n\'est pas prêt');
  assert.equal(planReady(planConfig()), true);
  assert.deepEqual(readConfig(JSON.stringify(planConfig())).plan, planConfig().plan, 'écrite puis relue, la configuration garde son plan');
});

test('les lieux : l\'arbre, les profondeurs, l\'ordre naturel et le genre', () => {
  const plan = planOf(planConfig(), 'Personnes', data());
  assert.equal(plan.places.length, 7);
  assert.deepEqual(childrenOf(plan, 0).map(place => place.name), ['Siège']);
  assert.deepEqual(childrenOf(plan, 1).map(place => place.name), ['Bâtiment A', 'Bâtiment B']);
  assert.deepEqual(childrenOf(plan, 3).map(place => place.name), ['Bureau 12', 'Bureau 204', 'Couloir'], 'les chiffres se comparent comme des nombres : 12 avant 204');
  assert.equal(pathText(plan, 4), 'Siège › Bâtiment A › 2e étage › Bureau 204');
  assert.deepEqual(pathOf(plan, 4).map(place => place.depth), [0, 1, 2, 3]);
  assert.equal(kindAt(plan.byId.get(7)), 'building', 'un genre vide se déduit de la profondeur');
  assert.equal(plan.byId.get(4).capacity, 1);
  assert.equal(plan.byId.get(1).address, '1 rue de la Paix');
});

test('le genre et l\'usage écrits à la main dans Grist se reconnaissent (accents, casse, français ou anglais)', () => {
  assert.deepEqual(['Bâtiment', 'BUILDING', 'immeuble'].map(kindOf), ['building', 'building', 'building']);
  assert.deepEqual(['Étage', 'etage', 'Floor'].map(kindOf), ['floor', 'floor', 'floor']);
  assert.deepEqual(['Local', 'Salle', 'Room'].map(kindOf), ['room', 'room', 'room']);
  assert.equal(kindOf('Parking'), '');
  assert.deepEqual(['Couloir', 'Escalier', 'Circulation'].map(useOf), ['circulation', 'circulation', 'circulation']);
  assert.deepEqual(['Salle de réunion', 'Bureau', 'WC'].map(useOf), ['meeting', 'office', 'service']);
  assert.equal(useOf(''), '');
});

test('pas de plan réglé, ou table absente de la lecture : rien, jamais une erreur', () => {
  assert.equal(planOf(readConfig({ name: 'Nom' }), 'Personnes', data()), null);
  assert.equal(planOf(planConfig(), 'Personnes', { Personnes: people() }), null, 'la table des lieux n\'est pas lue');
  const empty = planOf(planConfig(), 'Personnes', { Personnes: people(), Directory_Places: { id: [] } });
  assert.equal(empty.places.length, 0);
  assert.equal(placeOfPerson(empty, 1), null);
});

test('un lieu sans nom, un parent qui n\'existe plus, une boucle : le lieu reste lisible, au sommet', () => {
  const odd = { id: [1, 2, 3, 4, 5], Name: ['A', 'B', 'C', '', 'D'], Parent: [2, 1, 99, 0, 4], Kind: ['', '', '', '', ''] };
  const plan = planOf(planConfig(), 'Personnes', { Personnes: people(), Directory_Places: odd });
  assert.deepEqual(plan.places.map(place => place.name), ['A', 'B', 'C', 'D'], 'le lieu sans nom est ignoré');
  assert.equal(plan.byId.get(3).parent, 0, 'un parent qui n\'existe plus laisse le lieu au sommet');
  assert.equal(plan.byId.get(5).parent, 0, 'un parent sans nom est ignoré aussi');
  const loop = [plan.byId.get(1), plan.byId.get(2)];
  assert.equal(loop.filter(place => place.parent === 0).length, 1, 'une boucle est coupée en un seul endroit');
  for (const place of plan.places) assert.ok(pathOf(plan, place.id).length >= 1 && pathOf(plan, place.id).length <= 2, 'aucun chemin ne tourne sans fin');
});

test('le bureau de chaque personne, et les décomptes : chaque lieu compte ceux qui sont dessous', () => {
  const plan = planOf(planConfig(), 'Personnes', data());
  assert.equal(placeOfPerson(plan, 1).name, 'Bureau 204');
  assert.equal(placeOfPerson(plan, 3), null, 'une référence vide : pas de bureau');
  assert.equal(placeOfPerson(plan, 4), null, 'une référence à un lieu qui n\'existe plus : pas de bureau');
  const count = occupancy(plan, shown);
  assert.deepEqual([1, 2, 3, 4, 6, 7].map(id => count.total.get(id) || 0), [2, 2, 2, 1, 1, 0], 'le site, le bâtiment et l\'étage comptent les deux personnes');
  assert.deepEqual(count.unplaced.map(person => person.row), [3, 4]);
  assert.deepEqual(count.direct.get(4).map(person => person.row), [1]);
  const some = occupancy(plan, shown.slice(0, 1));
  assert.deepEqual([some.total.get(1), some.total.get(6) || 0], [1, 0], 'seules les personnes que l\'annuaire montre comptent');
});

test('le choix d\'un bureau dans « Modifier » : le chemin entier, sans les lieux de passage', () => {
  const plan = planOf(planConfig(), 'Personnes', data());
  const choices = officeChoices(plan);
  assert.ok(choices.some(choice => choice.label === 'Siège › Bâtiment A › 2e étage › Bureau 204'));
  assert.ok(!choices.some(choice => /Couloir/.test(choice.label)), 'un couloir n\'a pas de poste de travail');
  assert.deepEqual(choices.map(choice => choice.label), [...choices.map(choice => choice.label)].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })));
  assert.deepEqual(refOptions({ ref: 'Directory_Places', visible: 'Name' }, { data: data(), people: [], table: 'Personnes', plan }), choices);
  assert.deepEqual(refOptions({ ref: 'Directory_Places', visible: 'Name' }, { data: data(), people: [], table: 'Personnes' }).map(option => option.label).slice(0, 2),
    ['2e étage', 'Bâtiment A'], 'sans plan, une référence se lit comme les autres');
});

// Le document de l'annuaire, avec la table des lieux et la colonne du bureau de la personne, au format des tables internes de Grist.
function world({ withPlan = true } = {}) {
  const fixture = documentFixture();
  const config = readConfig({ ...configFixture(), ...(withPlan ? { plan: { table: 'Directory_Places', office: 'Bureau' } } : {}) });
  if (withPlan) {
    const tables = fixture._grist_Tables;
    tables.id.push(9); tables.tableId.push('Directory_Places'); tables.summarySourceTable.push(0);
    const columns = fixture._grist_Tables_column;
    const add = (id, parent, colId, type, visible = 0) => {
      columns.id.push(id); columns.parentId.push(parent); columns.colId.push(colId); columns.type.push(type); columns.visibleCol.push(visible);
      columns.widgetOptions.push(''); columns.isFormula.push(false);
    };
    add(90, 9, 'Name', 'Text'); add(91, 9, 'Kind', 'Choice'); add(92, 9, 'Parent', 'Ref:Directory_Places', 90); add(93, 1, 'Bureau', 'Ref:Directory_Places', 90);
    fixture.Directory_Places = places();
    fixture.Personnes.Bureau = [4, 6, 0, 0, 0, 0];
  }
  return { grist: fakeGrist(Object.fromEntries(Object.entries(fixture).map(([name, table]) => {
    const names = Object.keys(table).filter(key => key !== 'id');
    return [name, { columns: ['id', ...names], rows: table.id.map((id, i) => Object.fromEntries([['id', id], ...names.map(key => [key, table[key][i]])])) }];
  }))), config };
}

test('le schéma lu : la table des lieux ne se lit que si le plan est réglé et que la table existe', () => {
  const { grist, config } = world();
  const store = new AnnuaireStore({ port: grist.port, consent: async () => true });
  return store.schema().then(schema => {
    assert.ok(tablesNeeded(config, 'Personnes', schema).has('Directory_Places'));
    assert.ok(!tablesNeeded(readConfig({ ...configFixture() }), 'Personnes', schema).has('Directory_Places'), 'sans plan réglé, la table des lieux n\'est pas lue');
    assert.ok(!tablesNeeded(readConfig({ ...configFixture(), plan: { table: 'Absente', office: 'Bureau' } }), 'Personnes', schema).has('Absente'));
    assert.ok(schema.Directory_Places.columns.some(col => col.id === 'Parent' && col.ref === 'Directory_Places'));
  });
});

test('lire un annuaire avec plan : les lieux et le bureau des personnes ; sans plan ou dans une copie, rien', async () => {
  const { grist, config } = world();
  const store = new AnnuaireStore({ port: grist.port, consent: async () => true });
  const made = await store.create({ name: 'Principal', table: 'Personnes', config });
  const read = await store.read(made);
  assert.equal(read.plan.places.length, 7);
  assert.equal(placeOfPerson(read.plan, read.people.find(person => person.name === 'Camille Durand').row).name, 'Bureau 204');
  const bare = world({ withPlan: false });
  const bareStore = new AnnuaireStore({ port: bare.grist.port, consent: async () => true });
  assert.equal((await bareStore.read(await bareStore.create({ name: 'Principal', table: 'Personnes', config: bare.config }))).plan, null);
});

test('créer la table des lieux : une table, puis `Parent`, une référence à elle qui montre le nom ; rien d\'autre n\'est écrit', async () => {
  const sent = [];
  const replies = {
    AddTable: { table_id: 'Directory_Places', id: 12, columns: PLAN_COLUMNS.map(col => col.id), views: [] },
    AddColumn: { colId: 'Parent', colRef: 77 },
  };
  // Ce que Grist garde de la table qui vient de naître : sa colonne `Name` a le numéro 31 (le vrai Grist n'écrit « le nom du lieu » dans `Parent` qu'avec ce numéro).
  const meta = {
    _grist_Tables: { id: [4, 12], tableId: ['Personnes', 'Directory_Places'] },
    _grist_Tables_column: { id: [20, 31, 32], parentId: [4, 12, 12], colId: ['Nom', 'Name', 'Kind'] },
  };
  const port = { doc: { applyUserActions: async actions => { sent.push(...actions); return { retValues: actions.map(action => replies[action[0]] ?? null) }; },
    fetchTable: async name => meta[name] } };
  const made = await new AnnuaireStore({ port, consent: async () => true }).addPlanTable('Directory_Places');
  assert.deepEqual(made, { id: 'Directory_Places', name: 'Name', parent: 'Parent' });
  assert.deepEqual(sent.map(action => action[0]), ['AddTable', 'AddColumn', 'SetDisplayFormula']);
  assert.deepEqual(sent[0][2].map(col => col.id), ['Name', 'Kind', 'Use', 'Address', 'Lat', 'Lng', 'Plan', 'Shape', 'Capacity']);
  assert.deepEqual(sent[0][2].find(col => col.id === 'Kind').widgetOptions && JSON.parse(sent[0][2].find(col => col.id === 'Kind').widgetOptions).choices,
    ['Site', 'Building', 'Floor', 'Room'], 'les valeurs écrites sont les mêmes dans toutes les langues');
  assert.equal(sent[0][2].find(col => col.id === 'Plan').type, 'Attachments');
  assert.deepEqual(sent[1].slice(0, 3), ['AddColumn', 'Directory_Places', 'Parent']);
  assert.equal(sent[1][3].type, 'Ref:Directory_Places');
  assert.equal(sent[1][3].visibleCol, 31, '`Parent` montre la colonne `Name` (mesuré dans un vrai Grist : sans `visibleCol`, la colonne ne montre que des numéros)');
  assert.deepEqual(sent[2], ['SetDisplayFormula', 'Directory_Places', null, 77, '$Parent.Name']);
  assert.equal(PLAN_TABLE.id, 'Directory_Places');
});

test('créer la table des lieux : Grist qui change l\'identifiant de la table est suivi', async () => {
  const sent = [];
  const port = { doc: { applyUserActions: async actions => {
    sent.push(...actions);
    return { retValues: actions.map(action => (action[0] === 'AddTable' ? { table_id: 'Directory_Places_2', id: 3, columns: PLAN_COLUMNS.map(col => col.id), views: [] } : null)) };
  } } };
  const made = await new AnnuaireStore({ port, consent: async () => true }).addPlanTable('Directory_Places');
  assert.equal(made.id, 'Directory_Places_2');
  assert.equal(sent[1][1], 'Directory_Places_2', 'la colonne `Parent` va dans la table que Grist a créée');
  assert.equal(sent[1][3].type, 'Ref:Directory_Places_2');
});

test('« Modifier » propose le bureau comme un champ de la fiche, après les autres, seulement quand le plan est réglé', () => {
  const schema = schemaOf(documentFixture()._grist_Tables, documentFixture()._grist_Tables_column);
  const withOffice = { ...schema, Personnes: { columns: [...schema.Personnes.columns, { id: 'Bureau', type: 'Ref:Directory_Places', genre: 'ref', ref: 'Directory_Places', visible: 'Name',
    formula: false, choices: [] }] } };
  const { fields } = editableFields(readConfig({ ...configFixture(), plan: { table: 'Directory_Places', office: 'Bureau' } }), withOffice, 'Personnes', t);
  const office = fields.find(field => field.key === 'office');
  assert.deepEqual([office.col, office.label, office.group], ['Bureau', 'Bureau', 'info']);
  assert.equal(fields.at(-1), office);
  assert.ok(!editableFields(readConfig(configFixture()), withOffice, 'Personnes', t).fields.some(field => field.key === 'office'));
  const absent = editableFields(readConfig({ ...configFixture(), plan: { table: 'Directory_Places', office: 'Absent' } }), withOffice, 'Personnes', t);
  assert.ok(!absent.fields.some(field => field.key === 'office'), 'une colonne absente n\'est jamais proposée (une seule annulerait tout le lot)');
});

const text = node => (typeof node === 'string' ? node : node.textContent);
const walk = (node, found = []) => { found.push(node); for (const child of node.children || []) if (typeof child !== 'string') walk(child, found); return found; };
const byClass = (node, name) => walk(node).filter(each => (each.className || '').split(' ').includes(name));

test('la fiche : le chemin du bureau, un tiret quand il manque, rien quand l\'annuaire n\'a pas de plan', () => {
  const plan = planOf(planConfig(), 'Personnes', data());
  const [steps, button] = placeContent({ row: 1 }, { t, plan });
  assert.deepEqual(byClass(steps, 'an-hp-v').map(text), ['Siège', 'Bâtiment A', '2e étage', 'Bureau 204']);
  assert.deepEqual(byClass(steps, 'an-hp-k').map(text), ['Site', 'Bâtiment', 'Étage', 'Local']);
  assert.deepEqual([button.dataset.act, button.dataset.row, text(button)], ['plan-open', '1', 'Voir sur le plan']);
  const none = placeContent({ row: 3 }, { t, plan });
  assert.equal(none.length, 1);
  assert.equal(text(none[0]), '—');
  assert.equal(placeContent({ row: 1 }, { t, plan: null }), null);
});

// Les cartes d'un lieu : celles qui se choisissent, celle qu'il faut repérer, celles qui n'ont pas de poste.
const tiles = (view, id, extra = {}) => {
  const plan = planOf(planConfig(), 'Personnes', data());
  view.show({ t, plan, people: shown.slice(0, 3), current: id, here: 0, selected: null, masked: new Set(), ...extra });
  return byClass(view.element, 'an-pl-tile');
};

test('la vue : une carte par lieu enfant, le nombre de personnes, le lieu grisé qui dit pourquoi, le lieu repéré', () => {
  const view = new PlanView();
  const top = tiles(view, 0);
  assert.deepEqual(top.map(tile => tile.dataset.act), ['plan-go']);
  assert.match(text(top[0]), /Siège.*2 personnes/);
  const floor = tiles(view, 3, { here: 6 });
  assert.deepEqual(floor.map(tile => text(byClass(tile, 'an-pl-name')[0])), ['Bureau 12', 'Bureau 204', 'Couloir']);
  const hot = floor.find(tile => tile.dataset.id === '6');
  assert.ok(hot.className.includes('is-here'), 'le bureau qu\'on cherche est repéré');
  assert.match(text(hot), /1 sur 3 places/, 'la capacité se dit quand la table la donne');
  const corridor = floor.find(tile => tile.dataset.id === '5');
  assert.deepEqual([corridor.dataset.act, corridor.attrs['aria-disabled'], corridor.dataset.why], ['plan-note', 'true', t('an.plan.noSeats')], 'grisé, jamais masqué : un clic dit pourquoi');
  assert.ok(corridor.className.includes('is-grey'));
});

test('la vue : le fil d\'Ariane, les occupants d\'un local, ceux qui n\'ont pas de bureau, la table vide', () => {
  const view = new PlanView();
  tiles(view, 4, { selected: 1 });
  assert.deepEqual(byClass(view.element, 'an-pl-step').map(text), ['Tous les lieux', 'Siège', 'Bâtiment A', '2e étage', 'Bureau 204']);
  const last = byClass(view.element, 'an-pl-step').at(-1);
  assert.deepEqual([last.attrs['aria-current'], last.attrs['aria-disabled']], ['location', 'true'], 'le lieu où l\'on est ne se clique pas');
  assert.deepEqual(byClass(view.element, 'an-person').map(row => row.dataset.row), ['1'], 'le local montre ses occupants, les mêmes lignes que la liste');
  tiles(view, 7);
  assert.match(text(view.element), /Personne n’est installé ici/);
  tiles(view, 0);
  assert.match(text(byClass(view.element, 'an-pl-unplaced')[0]), /1 personne n’a pas de bureau indiqué/);
  const empty = new PlanView();
  empty.show({ t, plan: planOf(planConfig(), 'Personnes', { Personnes: people(), Directory_Places: { id: [] } }), people: shown, current: 0, here: 0, selected: null, masked: new Set() });
  assert.match(text(empty.element), /« Directory_Places » ne contient encore aucun lieu/);
});

test('les lieux de même rang : les autres étages, bâtiments ou sites, jamais un lieu seul', () => {
  const plan = planOf(planConfig(), 'Personnes', data());
  assert.deepEqual(siblingsOf(plan, 2).map(place => place.name), ['Bâtiment A', 'Bâtiment B']);
  assert.deepEqual(siblingsOf(plan, 1), [], 'le seul site n\'a pas d\'autre site');
  assert.deepEqual(siblingsOf(plan, 3), [], 'le seul étage du bâtiment');
  assert.deepEqual(siblingsOf(plan, 0).concat(siblingsOf(plan, 999)), [], 'tous les lieux, ou un lieu inconnu : rien');
});

test('la carte en ligne : les coordonnées quand elles sont justes, sinon l\'adresse, sinon rien ; un étage se situe par son bâtiment', () => {
  assert.equal(mapLinkOf({ lat: 45.75, lng: 4.85, address: '1 rue de la Paix' }), 'https://www.openstreetmap.org/?mlat=45.75&mlon=4.85#map=18/45.75/4.85');
  assert.equal(mapLinkOf({ lat: 123, lng: 4.85, address: '1 rue de la Paix' }), 'https://www.openstreetmap.org/search?query=1%20rue%20de%20la%20Paix', 'une latitude impossible : l\'adresse');
  assert.equal(mapLinkOf({ lat: 45.75, lng: null, address: 'Lyon' }), 'https://www.openstreetmap.org/search?query=Lyon', 'une seule coordonnée ne suffit pas');
  assert.equal(mapLinkOf({ lat: null, lng: null, address: 'a&b=c#d' }), 'https://www.openstreetmap.org/search?query=a%26b%3Dc%23d', 'l\'adresse est encodée : jamais un morceau d\'adresse qui devient un paramètre');
  assert.equal(mapLinkOf({ lat: null, lng: null, address: '' }), '');
  assert.equal(mapLinkOf({ lat: 0, lng: 0, address: 'Lyon' }), 'https://www.openstreetmap.org/search?query=Lyon', 'Grist laisse 0 dans une cellule numérique vide : (0, 0) n\'est pas un endroit');
  assert.equal(mapLinkOf({ lat: 0, lng: 0, address: '' }), '');
  assert.equal(mapLinkOf({ lat: 0, lng: 4.85, address: '' }), 'https://www.openstreetmap.org/?mlat=0&mlon=4.85#map=18/0/4.85', 'sur l\'équateur, c\'est un vrai endroit');
  const plan = planOf(planConfig(), 'Personnes', data());
  const found = geoOf(plan, 4);
  assert.deepEqual([found.place.name, found.url], ['Siège', 'https://www.openstreetmap.org/search?query=1%20rue%20de%20la%20Paix'], 'le bureau se situe par le site, seul lieu qui a une adresse');
  assert.equal(geoOf(plan, 0), null);
});

test('la vue : les autres étages avec leur décompte, le lieu où l\'on est enfoncé ; rien pour un local, un lieu seul ou le sommet', () => {
  const view = new PlanView();
  tiles(view, 2);
  const group = byClass(view.element, 'an-pl-sib');
  assert.equal(group.length, 1);
  assert.equal(group[0].attrs['aria-label'], t('an.plan.sibs.building'));
  assert.ok(byClass(view.element, 'an-pl-head')[0].children.includes(group[0]), 'la rangée est dans le titre du volet : une case de plus dans la grille du plan se perdrait sous le plan');
  const buttons = byClass(group[0], 'an-pl-sibb');
  assert.deepEqual(buttons.map(button => [text(byClass(button, 'an-pl-sibn')[0]), text(byClass(button, 'an-pl-sibc')[0]), button.attrs['aria-pressed'], button.dataset.act, button.dataset.id]),
    [['Bâtiment A', '2', 'true', 'plan-go', '2'], ['Bâtiment B', '0', 'false', 'plan-go', '7']], 'les décomptes sont ceux des personnes montrées ; un clic va au lieu, comme une carte');
  for (const id of [0, 1, 3, 4]) { tiles(view, id); assert.equal(byClass(view.element, 'an-pl-sib').length, 0, `lieu ${id} : pas de sélecteur`); }
});

test('la vue : « Voir sur une carte en ligne » est un lien vers OpenStreetMap, grisé avec sa raison quand aucun lieu n\'a d\'adresse', () => {
  const view = new PlanView();
  tiles(view, 2);
  const [link] = byClass(view.element, 'an-pl-geo');
  assert.deepEqual([link.tag || link.tagName.toLowerCase(), link.attrs.href, link.attrs.target, link.attrs.rel],
    ['a', 'https://www.openstreetmap.org/search?query=1%20rue%20de%20la%20Paix', '_blank', 'noopener noreferrer'], 'un bâtiment sans adresse se situe par son site');
  assert.match(link.attrs.title, /Siège/);
  assert.match(text(link), new RegExp(t('an.plan.geo')));
  tiles(view, 0);
  assert.equal(byClass(view.element, 'an-pl-geo').length, 0, 'tous les lieux : pas de lien');
  const bare = { ...places(), Address: places().Address.map(() => '') };
  const plan = planOf(planConfig(), 'Personnes', { Personnes: people(), Directory_Places: bare });
  view.show({ t, plan, people: shown, current: 2, here: 0, selected: null, masked: new Set() });
  const [grey] = byClass(view.element, 'an-pl-geo');
  assert.deepEqual([grey.attrs['aria-disabled'], grey.dataset.act, grey.dataset.why, grey.attrs.href], ['true', 'plan-note', t('an.plan.noGeo'), undefined], 'grisé, jamais masqué : un clic dit quelle colonne remplir');
});

test('la vue : une recherche estompe les cartes où personne ne correspond, pas les autres ; sans recherche, rien ne s\'estompe', () => {
  const view = new PlanView();
  const dimmed = floor => floor.filter(tile => tile.className.includes('is-dim')).map(tile => tile.dataset.id);
  assert.deepEqual(dimmed(tiles(view, 3, { people: shown.slice(0, 1), filtered: true })), ['6'], 'seul Camille correspond : le bureau 12 (personne) s\'estompe, le 204 et le couloir non');
  assert.deepEqual(dimmed(tiles(view, 3, { people: shown.slice(0, 1) })), [], 'sans recherche, un bureau vide reste comme les autres');
  const here = tiles(view, 3, { people: [], filtered: true, here: 6 }).find(tile => tile.dataset.id === '6');
  assert.ok(here.className.includes('is-here') && here.className.includes('is-dim'), 'le bureau repéré reste repéré, et dit son décompte');
});

test('les textes : français (vouvoiement) et anglais ont les mêmes clés, et la vue n\'en cherche aucune qui manque', () => {
  const fr = Object.keys(ANNUAIRE_PLAN_STRINGS.fr).sort();
  assert.deepEqual(fr, Object.keys(ANNUAIRE_PLAN_STRINGS.en).sort());
  const english = createI18n('en').t;
  for (const key of fr) {
    assert.notEqual(t(key, { n: 2, max: 3, table: 'X' }), key, `${key} (français)`);
    assert.notEqual(english(key, { n: 2, max: 3, table: 'X' }), key, `${key} (anglais)`);
  }
  assert.equal(t('an.plan.seats', { n: 1, max: 1 }), '1 sur 1 place');
  assert.equal(english('an.plan.unplaced', { n: 1 }), '1 person has no office set.');
  assert.equal(english('an.plan.unplaced', { n: 3 }), '3 people have no office set.');
});
