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
  const fetch = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Calc: [[], [], []], GFS_Lecteurs: [[], [], []], GFS_Auteur: ['a@x.fr', 'Auteur@x.fr', ''] }));
  const state = await control({ fetch }).load(model);
  assert.equal(state.active, true);
  assert.equal(state.author, 'auteur@x.fr');
  assert.equal(state.canManage, true, 'le propriétaire gère');
  const mine = await control({ fetch, me: 'auteur@x.fr' }).load(model);
  assert.equal(mine.me, 'auteur@x.fr');
});

test('un PDF de GFS : l\'auteur est celui que Grist a écrit (GFS_Auteur de la ligne), non « Auteur » que l\'explorateur réécrit à chaque remplacement (audit du 09/11)', async () => {
  const fetch = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Calc: [[], [], []], GFS_Lecteurs: [[], [], []], GFS_Auteur: ['a@x.fr', 'Createur@x.fr', ''] }));
  const state = await control({ fetch }).load({ ...pdf, row: 2 });
  assert.equal(state.author, 'createur@x.fr', `pas « ${pdf.by.toLowerCase()} », le dernier qui a modifié`);
  assert.equal((await control({ fetch, me: 'moi@x.fr' }).load(pdf)).canManage, true, 'le propriétaire gère');
});

test('un partage de PDF d\'avant l\'auteur protégé (colonnes d\'aide sans GFS_Auteur) : « compléter », rien n\'est lu de la colonne « Auteur »', async () => {
  const old = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Calc: [[], [], []], GFS_Lecteurs: [[], [], []] }));
  const state = await control({ fetch: old }).load(pdf);
  assert.deepEqual([state.active, state.extend, state.author], [false, 'upgrade', '']);
});

test('un partage d\'avant les espaces (colonnes d\'aide sans GFS_Calc) : « compléter », pour une app comme pour les PDF de GFS', async () => {
  const old = async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Lecteurs: [[], [], []], GFS_Auteur: ['a@x.fr', '', ''] }));
  const app = await control({ fetch: old }).load(model);
  assert.deepEqual([app.active, app.extend, app.owner], [false, 'upgrade', true]);
  const files = await control({ fetch: async name => (name === 'GFS_Partages' ? table({ Cible: [], Personne: [] }) : table({ GFS_Lecteurs: [[]] })) }).load(pdf);
  assert.equal(files.extend, 'upgrade');
});

test('un dossier d\'espace se partage (clé « dossier: »), « Moi » et un espace non : la phrase dit pourquoi ; la fenêtre hérite de l\'espace et des dossiers au-dessus', async () => {
  const info = { spaces: [{ key: 'achats', name: 'Achats', path: 'Espaces/Achats' }], placed: new Map(), folders: [] };
  const rows = { Cible: ['*', 'espace:achats', 'dossier:achats/Contrats', 'dossier:achats/Contrats/Sous', 'dossier:achats/Autre'], Personne: ['@editeurs', '#Achats', 'marc@x.fr', 'lea@x.fr', 'zoe@x.fr'], Droit: ['lecture', 'lecture', 'ecriture', 'aucun', 'lecture'] };
  const fetch = async name => (name === 'GFS_Partages' ? { id: [1, 2, 3, 4, 5], ...rows } : { id: [] });
  const share = new ShareControl({ t, targets: () => targetsOf([PP]), fullAccess: () => true, identity: () => 'moi@x.fr', writeBlock: () => null, reader: { owner: async () => true }, spaces: () => info, port: { doc: { fetchTable: fetch } } });
  assert.equal(share.whyNotFolder('Espaces/Achats/Contrats'), null);
  assert.equal(share.whyNotFolder('Espaces/Achats'), t('share.folder.space'));
  assert.equal(share.whyNotFolder('Espaces'), t('share.folder.space'));
  assert.equal(share.whyNotFolder('Perso/Dossier'), t('share.folder.personal'));
  assert.equal(share.folderFile('Perso/Dossier'), null);
  const folder = share.folderFile('Espaces/Achats/Contrats/Sous');
  assert.equal(folder.key, 'dossier:achats/Contrats/Sous');
  assert.equal(folder.name, 'Sous');
  const state = await share.load(folder);
  assert.equal(state.active, true);
  const direct = state.shares.filter(item => !item.inherited);
  assert.deepEqual(direct.map(item => [item.who, item.right]), [['lea@x.fr', 'aucun']]);
  const inherited = state.shares.filter(item => item.inherited).map(item => [item.who, item.from.kind, item.from.name]).sort();
  assert.deepEqual(inherited, [['#Achats', 'space', 'Achats'], ['@editeurs', 'root', undefined], ['marc@x.fr', 'folder', 'Contrats']]);
  assert.equal(state.canManage, true, 'un propriétaire gère les droits d\'un dossier');
});

// Ce qui suit fige l'état que `load` rend (audit du code du 09/11, complexité 22 : la fonction est découpée sans que cet état change).
const shareRows = { id: [1, 2, 3, 4, 5, 6], Cible: ['pdf:1', 'pdf:1', 'pdf:1', 'pdf:2', 'pdf:1', 'pdf:1'], Personne: ['Zoe@x.fr', '@editeurs', '#Compta', 'ann@x.fr', 'ann@x.fr', ''], PersonneL: ['', '', '', 'Marc@x.fr', '', ''], Droit: ['lecture', 'lecture', 'ecriture', 'admin', 'admin', 'lecture'] };
const stamped = (extra = {}) => async name => {
  if (name === 'GFS_Partages') return { ...shareRows, ...extra };
  if (name === 'GFS_Groupes') return { id: [1, 2], Nom: ['Achats', null], Nb: ['3', 'x'], Source: ['@x', null], PersonnesIci: ['a;b', null] };
  return table({ GFS_Calc: [[], [], []], GFS_Lecteurs: [[], [], []], GFS_Auteur: ['a@x.fr', 'Auteur@x.fr', ''] });
};
const file = { ...pdf, key: 'pdf:1', row: 2 };

test('load : les personnes connues sont celles des lignes de partage (PersonneL avant Personne), sans catégorie ni groupe, en minuscules, sans doublon, triées', async () => {
  const state = await control({ fetch: stamped() }).load(file);
  assert.deepEqual(state.people, ['ann@x.fr', 'marc@x.fr', 'zoe@x.fr']);
});

test('load : les groupes viennent de la table des groupes (nom, nombre, source, personnes ici) ; une table illisible n\'en donne aucun', async () => {
  const state = await control({ fetch: stamped() }).load(file);
  assert.deepEqual(state.groups, [{ id: 1, name: 'Achats', count: 3, source: '@x', here: 'a;b' }]);
  const broken = async name => { if (name === 'GFS_Groupes') throw new Error('absente'); return stamped()(name); };
  assert.deepEqual((await control({ fetch: broken }).load(file)).groups, []);
});

test('load : le fichier ne rend que ses lignes de partage ; la table des partages illisible ou en erreur de lecture est « à activer » (extend false), le propriétaire gardé', async () => {
  const state = await control({ fetch: stamped() }).load(file);
  assert.deepEqual(state.shares.map(item => [item.who, item.right]).sort(), [['#Compta', 'ecriture'], ['@editeurs', 'lecture'], ['Zoe@x.fr', 'lecture'], ['ann@x.fr', 'admin'], ['', 'lecture']].sort());
  const wrong = async name => (name === 'GFS_Partages' ? { id: [1], Cible: null } : stamped()(name));
  for (const fetch of [wrong, async name => { if (name === 'GFS_Partages') throw new Error('x'); return stamped()(name); }]) {
    const none = await control({ fetch }).load(file);
    assert.deepEqual([none.active, none.extend, none.owner, none.shares, none.people, none.me, none.author, none.canManage], [false, false, true, [], [], '', '', false]);
  }
  const shared = new ShareControl({ t, targets: () => targetsOf([PP]), fullAccess: () => true, identity: () => 'moi@x.fr', writeBlock: () => null, reader: { owner: async () => false }, port: { doc: { fetchTable: async () => { throw new Error('x'); } } } });
  assert.equal((await shared.load(file)).owner, false);
});

test('load : la table de fichiers illisible, pour un fichier dont GFS pose l\'auteur, veut dire « étendre » ; pour un fichier dont l\'app tient l\'auteur, le partage reste actif', async () => {
  const lost = async name => { if (name === 'GFS_Fichiers') throw new Error('absente'); return stamped()(name); };
  const state = await control({ fetch: lost }).load(file);
  assert.deepEqual([state.active, state.extend], [false, true]);
  const own = new ShareControl({ t, targets: () => [{ table: 'Notes', prefix: 'notes:', author: 'Auteur', stamped: false }], fullAccess: () => true, identity: () => 'moi@x.fr', writeBlock: () => null, reader: { owner: async () => false }, port: { doc: { fetchTable: async name => { if (name === 'Notes') throw new Error('absente'); return stamped()(name); } } } });
  const kept = await own.load({ app: 'notes', table: 'Notes', row: 1, by: 'Chef@x.fr', key: 'pdf:1' });
  assert.deepEqual([kept.active, kept.author], [true, 'chef@x.fr']);
});

test('load : qui gère les partages : le propriétaire, l\'auteur du fichier, une personne admin (valide et active, à son nom), et personne d\'autre ; jamais quand l\'écriture est bloquée', async () => {
  const owner = { reader: { owner: async () => false } };
  const make = ({ me, blocked = null, fetch = stamped() }) => new ShareControl({
    t, targets: () => targetsOf([PP]), fullAccess: () => true, identity: () => me, writeBlock: () => blocked, ...owner, port: { doc: { fetchTable: fetch } },
  });
  assert.equal((await make({ me: 'auteur@x.fr' }).load(file)).canManage, true, 'l\'auteur');
  assert.equal((await make({ me: 'ANN@x.fr' }).load(file)).canManage, true, 'une personne admin à son nom, quelle que soit la casse');
  assert.equal((await make({ me: 'zoe@x.fr' }).load(file)).canManage, false, 'une lecture');
  assert.equal((await make({ me: 'inconnu@x.fr' }).load(file)).canManage, false);
  assert.equal((await make({ me: 'auteur@x.fr', blocked: 'bloqué' }).load(file)).canManage, false, 'écriture bloquée');
  const noAuthor = stamped();
  assert.equal((await make({ me: '', fetch: async name => (name === 'GFS_Fichiers' ? table({ GFS_Calc: [[]], GFS_Lecteurs: [[]], GFS_Auteur: ['', '', ''] }) : noAuthor(name)) }).load(file)).canManage, false, 'sans identité, un auteur vide ne gère pas');
  const inactive = stamped({ Actif: [true, true, true, true, false, true], Valide: [true, true, true, true, true, true] });
  assert.equal((await make({ me: 'ann@x.fr', fetch: inactive }).load(file)).canManage, false, 'une admin qui n\'est plus active ne gère plus');
});

test('load : un fichier placé dans un espace hérite de l\'espace puis de chaque dossier du chemin (nom de l\'espace, sinon sa clé) ; placement illisible ou sans espace : rien hérité', async () => {
  const shares = { id: [1, 2, 3, 4], Cible: ['espace:achats', 'dossier:achats/Contrats', 'dossier:achats/Contrats/Sous', 'dossier:achats/Autre'], Personne: ['#Achats', 'marc@x.fr', 'lea@x.fr', 'zoe@x.fr'], Droit: ['lecture', 'ecriture', 'lecture', 'lecture'] };
  const fetchFor = ({ place, spaces }) => async name => {
    if (name === 'GFS_Partages') return shares;
    if (name === 'GFS_Placement') { if (place instanceof Error) throw place; return place; }
    if (name === 'GFS_Espaces') { if (spaces instanceof Error) throw spaces; return spaces; }
    return table({ GFS_Calc: [[]], GFS_Lecteurs: [[]], GFS_Auteur: ['a@x.fr', 'a@x.fr', ''] });
  };
  const placed = { id: [1, 2], Cible: ['autre', 'pdf:1'], Espace: ['x', 'achats'], Dossier: ['', 'Contrats/Sous'] };
  const inherited = async setup => (await control({ fetch: fetchFor(setup) }).load(file)).shares.map(item => [item.who, item.from.kind, item.from.name]).sort();
  assert.deepEqual(await inherited({ place: placed, spaces: { id: [1], Cle: ['achats'], Nom: ['Achats'] } }), [['#Achats', 'space', 'Achats'], ['lea@x.fr', 'folder', 'Sous'], ['marc@x.fr', 'folder', 'Contrats']]);
  assert.deepEqual(await inherited({ place: placed, spaces: new Error('absente') }), [['#Achats', 'space', 'achats'], ['lea@x.fr', 'folder', 'Sous'], ['marc@x.fr', 'folder', 'Contrats']], 'sans la table des espaces, la clé tient lieu de nom');
  assert.deepEqual(await inherited({ place: new Error('absente'), spaces: { id: [] } }), []);
  assert.deepEqual(await inherited({ place: { id: [1], Cible: ['pdf:1'], Espace: [''], Dossier: ['Contrats'] }, spaces: { id: [] } }), [], 'sans espace, aucun dossier ne compte');
  assert.deepEqual(await inherited({ place: { id: [1], Cible: ['pdf:1'], Espace: ['achats'], Dossier: [null] }, spaces: { id: [1], Cle: ['achats'], Nom: [''] } }), [['#Achats', 'space', 'achats']], 'un espace sans dossier ; un nom vide : la clé');
});
