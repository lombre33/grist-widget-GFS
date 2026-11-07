// Ce que « Partager » sait d'un fichier (js/share-control.js ; contrats 11.7, point 13), en code pur : quelles tables se partagent, l'auteur lu dans la colonne que Grist écrit, « étendre » quand la table d'une app n'a
// pas encore les colonnes d'aide. La fenêtre à la souris se mesure sous Firefox (test/partager-firefox.mjs), les règles dans un vrai Grist (labo/run-partager-apps.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShareControl } from '../js/share-control.js';
import { targetsOf } from '../js/sharing-model.js';
import { createI18n } from '../js/i18n.js';

const { t } = createI18n('fr');
const PP = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'id' } }] };
const table = columns => ({ id: [1, 2, 3], ...columns });
const control = ({ fetch, full = true, me = 'moi@x.fr' } = {}) => new ShareControl({
  t, targets: () => targetsOf([PP]), fullAccess: () => full, identity: () => me, writeBlock: () => null, reader: { owner: async () => true },
  port: { doc: { fetchTable: fetch || (async () => { throw new Error('absente'); }) } },
});
const model = { app: 'publipostage', table: 'Publipostage_Modeles', row: 2, by: 'dernier@x.fr', key: 'publipostage:2' };
const pdf = { app: 'gfs-fichiers', table: 'GFS_Fichiers', row: 1, by: 'Moi@x.fr', key: 'gfs-fichiers:abc' };

test('se partagent : les PDF de GFS et les fichiers d\'une app qui déclare sa table ; le reste est grisé avec sa phrase, et sans l\'accès complet aussi', () => {
  const share = control();
  assert.equal(share.whyNot(pdf), null);
  assert.equal(share.whyNot(model), null);
  assert.equal(share.whyNot({ app: 'autre', table: 'Autre', key: 'autre:1' }), t('share.unsupported'));
  assert.equal(share.whyNot({ ...model, table: 'Une_Autre_Table' }), t('share.unsupported'));
  assert.equal(control({ full: false }).whyNot(pdf), t('share.noAccess'));
});

test('la table d\'une app sans colonnes d\'aide : « étendre », pas « activer » ; table des partages absente : « activer »', async () => {
  const shares = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ Nom: ['a', 'b', 'c'] }));
  const state = await control({ fetch: shares }).load(model);
  assert.deepEqual([state.active, state.extend, state.owner], [false, true, true]);
  const none = await control().load(model);
  assert.deepEqual([none.active, none.extend], [false, false]);
});

test('une table d\'app couverte : l\'auteur est celui que Grist a écrit (GFS_Auteur de la ligne), non le dernier qui l\'a modifiée', async () => {
  const fetch = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Lecteurs: [[], [], []], GFS_Auteur: ['a@x.fr', 'Auteur@x.fr', ''] }));
  const state = await control({ fetch }).load(model);
  assert.equal(state.active, true);
  assert.equal(state.author, 'auteur@x.fr');
  assert.equal(state.canManage, true, 'le propriétaire gère');
  const mine = await control({ fetch, me: 'auteur@x.fr' }).load(model);
  assert.equal(mine.me, 'auteur@x.fr');
});

test('un PDF de GFS : l\'auteur est la colonne « Auteur » de la ligne que l\'explorateur a lue', async () => {
  const fetch = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({}));
  assert.equal((await control({ fetch }).load(pdf)).author, 'moi@x.fr');
});
