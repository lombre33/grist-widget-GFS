// La table des fichiers de GFS pour relier un document sans PDF (js/sharing/share-files-table.js ; retour du porteur du 25/11 : « can't access property "some", cols
// is null » au « Continuer » de « Relier un autre document Grist »). Une doublure de `grist.docApi` : la vraie création se mesure dans un vrai Grist
// (labo/run-relier-document-neuf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filesTableOf } from '../js/sharing/share-files-table.js';
import { FILES_COLUMNS, FILES_TABLE } from '../js/files/gfs-files.js';

// Un document : `tables` (identifiant → colonnes), les écritures reçues dans `actions`.
function fakeDoc(tables = {}) {
  const actions = [];
  return {
    actions,
    listTables: async () => Object.keys(tables),
    fetchTable: async id => { if (!tables[id]) throw new Error(`pas de table ${id}`); return Object.fromEntries(tables[id].map(column => [column, []])); },
    applyUserActions: async batch => {
      actions.push(...batch);
      for (const [name, table, columns] of batch) if (name === 'AddTable') { tables[table] = columns.map(column => column.id); return { retValues: [{ table_id: table }] }; }
      return { retValues: [] };
    },
  };
}

test('sans PDF, `exists` le dit sans rien écrire ; `ensure` crée la table vide avec toutes ses colonnes, une seule fois', async () => {
  const doc = fakeDoc({ Clients: ['Nom'] });
  const files = filesTableOf(doc);
  assert.equal(await files.exists(), false);
  assert.deepEqual(doc.actions, [], 'lire ne crée rien');
  assert.equal(await files.ensure(), true, 'la table vient de naître');
  assert.equal(doc.actions.length, 1);
  const [name, table, columns] = doc.actions[0];
  assert.equal(name, 'AddTable');
  assert.equal(table, FILES_TABLE);
  assert.deepEqual(columns.map(column => column.id), FILES_COLUMNS.map(column => column.id), 'les colonnes que GFS écrit ensuite sont déjà là');
  assert.equal(await files.exists(), true);
  assert.equal(await files.ensure(), false, 'un second geste ne la recrée pas');
  assert.equal(doc.actions.length, 1);
});

test('un document qui garde déjà des PDF : la table n\'est pas touchée, aucune écriture', async () => {
  const doc = fakeDoc({ [FILES_TABLE]: FILES_COLUMNS.map(column => column.id) });
  const files = filesTableOf(doc);
  assert.equal(await files.exists(), true);
  assert.equal(await files.ensure(), false);
  assert.deepEqual(doc.actions, []);
});

test('une table d\'avant, sans la corbeille : ses colonnes manquantes ne sont pas ajoutées ici (ce n\'est pas au lien de les réparer)', async () => {
  const old = FILES_COLUMNS.map(column => column.id).filter(id => !id.startsWith('Supprime'));
  const doc = fakeDoc({ [FILES_TABLE]: old });
  await filesTableOf(doc).ensure();
  assert.deepEqual(doc.actions, []);
});
