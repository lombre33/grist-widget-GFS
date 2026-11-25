// Le fichier qu'une app crée après « Nouveau », « Depuis un modèle » ou « Importer » va dans le dossier où la personne était (js/broker/created-files.js ; contrats 5.4, point 1).
// Un faux rangement note ce qu'on lui demande ; ce que Grist rend à l'ajout (`retValues`) et ce que la vraie app écrit se mesurent dans un vrai Grist (labo/run-nouveau-ici.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreatedFiles, createdRows } from '../js/broker/created-files.js';

const MANIFEST = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Templates', canonique: 'Publipostage_Modeles' }] };
const add = (table, id = null) => ['AddRecord', table, id, { Nom: 'Neuf' }];

function setup(overrides = {}) {
  const placed = [];
  const log = { done: 0 };
  const created = new CreatedFiles({ manifestOf: () => MANIFEST, place: async entries => { placed.push(entries); }, done: () => { log.done++; }, ...overrides });
  const session = { id: 'publipostage' };
  const creation = (folder = 'Contrats/2026', raison = 'nouveau') => ({ fichier: null, type: 'document', dossier: folder, raison });
  return { created, placed, log, session, creation };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('createdRows : les numéros des lignes ajoutées aux tables de fichiers de l\'app, sous le nom du document ou celui du manifeste ; rien d\'autre', () => {
  assert.deepEqual(createdRows(MANIFEST, [add('Publipostage_Templates')], { retValues: [7] }), [7]);
  assert.deepEqual(createdRows(MANIFEST, [add('Publipostage_Modeles')], { retValues: [8] }), [8], 'le nom que le manifeste garde compte aussi');
  assert.deepEqual(createdRows(MANIFEST, [['BulkAddRecord', 'Publipostage_Templates', [null, null], { Nom: ['a', 'b'] }]], { retValues: [[9, 10]] }), [9, 10]);
  assert.deepEqual(createdRows(MANIFEST, [add('Autre'), add('Publipostage_Templates')], { retValues: [1, 5] }), [5], 'une autre table ne compte pas ; les numéros suivent les actions');
  assert.deepEqual(createdRows(MANIFEST, [['UpdateRecord', 'Publipostage_Templates', 3, {}]], { retValues: [null] }), [], 'une mise à jour ne crée rien');
  assert.deepEqual(createdRows(MANIFEST, [add('Publipostage_Templates')], { retValues: [] }), [], 'Grist ne rend aucun numéro : rien à ranger');
  assert.deepEqual(createdRows(MANIFEST, [add('Publipostage_Templates')], undefined), []);
  assert.deepEqual(createdRows({ id: 'bi' }, [add('Publipostage_Templates')], { retValues: [1] }), [], 'une app sans `fichiers` n\'a pas de fichier à ranger');
  assert.deepEqual(createdRows(MANIFEST, 'pas une liste', { retValues: [1] }), []);
});

test('« Nouveau », un modèle de départ et « Importer » : le premier fichier que l\'app crée est rangé dans le dossier retenu, une seule fois, et la liste est prévenue', async () => {
  for (const raison of ['nouveau', 'modele', 'importer']) {
    const { created, placed, log, session, creation } = setup();
    const opening = creation('Contrats/2026', raison);
    if (raison === 'modele') opening.modele = { id: 'facture' };
    if (raison === 'importer') opening.importation = { valeur: 'excel', fichier: {} };
    created.opened('publipostage', opening, session);
    created.written(session, [add('Publipostage_Templates')], { retValues: [12] });
    await settle();
    assert.deepEqual(placed, [[{ app: 'publipostage', file: '12', pinned: false, folder: 'Contrats/2026' }]], `${raison} : le fichier neuf va où la personne était`);
    assert.equal(log.done, 1, `${raison} : l'explorateur relit la liste`);
    created.written(session, [add('Publipostage_Templates')], { retValues: [13] });
    await settle();
    assert.equal(placed.length, 1, `${raison} : le fichier suivant n'est pas celui de « Nouveau »`);
  }
});

test('plusieurs fichiers d\'un même lot (une importation) vont tous dans le dossier ; un dossier d\'espace est un chemin comme un autre pour le rangement', async () => {
  const { created, placed, session, creation } = setup();
  created.opened('publipostage', creation('Espaces/Achats/Contrats'), session);
  created.written(session, [['BulkAddRecord', 'Publipostage_Templates', [null, null], { Nom: ['a', 'b'] }]], { retValues: [[4, 5]] });
  await settle();
  assert.deepEqual(placed, [[{ app: 'publipostage', file: '4', pinned: false, folder: 'Espaces/Achats/Contrats' }, { app: 'publipostage', file: '5', pinned: false, folder: 'Espaces/Achats/Contrats' }]]);
});

test('à la racine, rien à ranger ; l\'attente est pourtant consommée : un fichier d\'après n\'ira pas dans un dossier ancien', async () => {
  const { created, placed, session, creation } = setup();
  created.opened('publipostage', creation('Contrats'), session);
  created.opened('publipostage', creation(''), session); // la personne refait « Nouveau », cette fois à la racine
  created.written(session, [add('Publipostage_Templates')], { retValues: [1] });
  await settle();
  assert.deepEqual(placed, [], 'rien n\'est écrit à la racine');
  created.written(session, [add('Publipostage_Templates')], { retValues: [2] });
  await settle();
  assert.deepEqual(placed, [], 'le dossier d\'avant est oublié');
});

test('rien n\'est rangé sans création demandée, pour une autre app, une autre session, ni après un autre geste (ouvrir un fichier, lire un PDF, insérer une personne)', async () => {
  const { created, placed, session, creation } = setup();
  created.written(session, [add('Publipostage_Templates')], { retValues: [1] });
  created.opened('publipostage', creation('A'), session);
  created.written({ id: 'form' }, [add('Publipostage_Templates')], { retValues: [2] });
  created.written({ id: 'publipostage' }, [add('Publipostage_Templates')], { retValues: [3] }); // une autre session de la même app (cadre rouvert)
  await settle();
  assert.deepEqual(placed, [], 'ni une autre app, ni une autre session ne prennent l\'attente');
  const others = [{ fichier: { id: '3', type: 'document' }, type: 'document', dossier: 'A', raison: 'explorateur' }, { fichier: null, type: 'pdf', dossier: 'A', raison: 'lire', lecture: { id: 'p' } },
    { fichier: null, type: null, dossier: '', raison: 'personne', personne: { nom: 'Léa' } }, null];
  for (const opening of others) {
    created.opened('publipostage', creation('A'), session);
    created.opened('publipostage', opening, session);
    created.written(session, [add('Publipostage_Templates')], { retValues: [4] });
  }
  await settle();
  assert.deepEqual(placed, [], 'un autre geste fait oublier la création en attente');
  created.opened('publipostage', creation('A'), session);
  created.written(session, [add('Publipostage_Templates'), ['UpdateRecord', 'Publipostage_Templates', 1, {}]], { retValues: [null, null] });
  await settle();
  assert.deepEqual(placed, [], 'un lot sans numéro rendu ne range rien et garde l\'attente');
  created.written(session, [add('Publipostage_Templates')], { retValues: [6] });
  await settle();
  assert.equal(placed.length, 1, 'l\'attente est encore là pour le vrai ajout');
});

test('un rangement qui échoue ne fait pas échouer l\'app : un avertissement, le fichier reste à la racine', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args[0]);
  try {
    const { created, session, creation, log } = setup({ place: async () => { throw new Error('Grist refuse'); } });
    created.opened('publipostage', creation('A'), session);
    assert.doesNotThrow(() => created.written(session, [add('Publipostage_Templates')], { retValues: [1] }));
    await settle();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /n'a pas pu être rangé/);
    assert.equal(log.done, 0, 'rien à relire : rien n\'a été rangé');
  } finally {
    console.warn = original;
  }
});
