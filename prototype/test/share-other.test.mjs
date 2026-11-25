// Le changement de niveau d'un lien dans l'onglet de « Partager » (js/sharing/share-other.js, `levelChanger`) : ce qui le bloque, ce qui l'échoue. Le chemin qui réussit passe par le moteur de partage du kit : il se mesure dans le labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeTechnicalTables, createOtherDocuments, limitOf, whyNot } from '../js/sharing/share-other.js';
import { SEND_MAX } from '../js/sharing/share-links.js';
import { FILES_APP } from '../js/files/gfs-files.js';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const make = (over = {}) => createOtherDocuments({
  t, container: null, inertTargets: () => [], docApi: () => { throw new Error('pas de document'); }, transfer: {}, language: () => 'fr', notice: () => {}, writeBlock: () => null, ...over,
});
const file = { id: 'f1', name: 'Fichier', app: FILES_APP };
const link = { doc: { name: 'Autre' }, name: 'lien' };

test('un blocage d\'écriture dit pourquoi et ne touche à rien', async () => {
  const tab = make({ writeBlock: () => 'lecture seule' }).tab(file, { owner: true });
  assert.deepEqual(await tab.onLevel(link, 'edit'), { ok: false, message: 'lecture seule' });
});

test('une erreur du moteur rend un message, pas une exception', async () => {
  const reply = await make().tab(file, { owner: true }).onLevel(link, 'edit');
  assert.equal(reply.ok, false);
  assert.match(reply.message, /^so\.failed .*pas de document/);
});

test('la raison qui grise l\'onglet passe avant le blocage d\'écriture', async () => {
  const tab = make({ writeBlock: () => 'autre raison' }).tab(file, { owner: false });
  const reply = await tab.onLevel(link, 'edit');
  assert.equal(reply.ok, false);
  assert.equal(reply.message, tab.why || 'autre raison');
});

test('un fichier de plus de 25 Mo : l\'onglet le dit AVANT l\'envoi, aucun niveau qui l\'y mettrait ne passe, l\'arrêt reste permis (audit du 18/11)', async () => {
  const notices = [];
  const big = { ...file, pieces: [['1', SEND_MAX + 1]] };
  const tab = make({ notice: text => notices.push(text) }).tab(big, { owner: true });
  assert.equal(tab.why, null, 'l\'onglet n\'est pas grisé en entier : on peut arrêter un partage qui le portait');
  assert.match(tab.limit, /^share\.other\.limit /);
  for (const level of ['once', 'live']) assert.deepEqual(await tab.onLevel(link, level), { ok: false, message: tab.limit }, `« ${level} » est refusé sans toucher au moteur`);
  const stopped = await tab.onLevel(link, 'none');
  assert.match(stopped.message, /^so\.failed .*pas de document/, '« none » va jusqu\'au moteur (ici le faux document lève)');
  await tab.onNew();
  assert.deepEqual(notices, [tab.limit], '« Relier un nouveau document » dit la même raison au lieu d\'ouvrir la fenêtre d\'envoi');
  assert.equal(make().tab({ ...file, pieces: [['1', SEND_MAX]] }, { owner: true }).limit, null, 'pile 25 Mo part');
  assert.equal(limitOf(t, 'fr', { path: 'Contrats', pieces: [['1', SEND_MAX + 1]] }), null, 'un dossier n\'a pas de limite à lui : ses PDF se comptent');
  assert.equal(limitOf(t, 'fr', { app: 'autre', pieces: [['1', SEND_MAX + 1]] }), null, 'une app dit déjà « seuls les PDF que GFS garde »');
});

test('un dossier dont les PDF sont tous trop gros est grisé avec SA raison (pas « aucun PDF ») ; un dossier qui en garde le dit, et les gros ne partent pas', () => {
  const pdf = (id, size) => ({ ...file, id, row: Number(id.slice(1)), folder: 'Contrats', trashed: null, pieces: [['9', size]] });
  const folder = { key: 'dossier:moi/Contrats', name: 'Contrats', path: 'Contrats', mine: true };
  const state = { owner: true };
  const none = make({ files: () => [pdf('p1', SEND_MAX + 1), pdf('p2', SEND_MAX * 2)] }).tab(folder, state);
  assert.match(none.why, /^share\.other\.why\.allTooBig /);
  assert.equal(none.tooBig, 2);
  assert.equal(whyNot(t, { file: folder, state, files: [] }), 'share.other.why.emptyFolder', 'sans gros PDF, la raison d\'avant');
  const some = make({ files: () => [pdf('p1', 10), pdf('p2', SEND_MAX + 1)] }).tab(folder, state);
  assert.equal(some.why, null);
  assert.deepEqual([some.fileId, some.count, some.tooBig, some.skipped, some.limit], [['p1'], 1, 1, 0, null]);
});

// À la fermeture de la fenêtre de liaison (envoi, réception, « Relier »), les tables techniques se ferment et la structure avec elles, dans une seule écriture
// (choix du porteur, 18/11) ; jamais sans la preuve d'être propriétaire, jamais quand rien n'a été créé.
const docWith = (names, applied) => ({
  fetchTable: async name => {
    const rows = name === '_grist_Tables' ? names.map((tableId, at) => ({ id: at + 1, tableId })) : [];
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    return Object.fromEntries(keys.map(key => [key, rows.map(row => row[key])]));
  },
  applyUserActions: async actions => { applied.push(actions); },
});

test('la fermeture de la fenêtre de liaison ferme les tables techniques ET la structure, en une seule écriture, pour un propriétaire prouvé', async () => {
  const applied = [];
  await closeTechnicalTables({ transfer: { isOwner: async () => true }, docApi: () => docWith(['GFS_Files', 'GFS_Synchro'], applied) });
  assert.equal(applied.length, 1, 'une seule écriture : Grist ne recharge qu\'une fois');
  assert.ok(applied[0].some(action => action[1] === '_grist_ACLRules' && action[3].permissionsText === '-CRUD'), 'la table technique est réservée aux propriétaires');
  assert.ok(applied[0].some(action => action[1] === '_grist_ACLRules' && action[3].aclFormula === 'user.Access != OWNER' && action[3].permissionsText === '-S'), 'la structure est fermée');
});

test('sans la preuve d\'être propriétaire, ou sans table technique (fenêtre fermée avant l\'accord), rien ne s\'écrit', async () => {
  for (const owner of [false, null, undefined]) {
    const applied = [];
    await closeTechnicalTables({ transfer: { isOwner: async () => owner }, docApi: () => docWith(['GFS_Synchro'], applied) });
    assert.deepEqual(applied, [], `propriétaire : ${owner}`);
  }
  const applied = [];
  await closeTechnicalTables({ transfer: { isOwner: async () => true }, docApi: () => docWith(['GFS_Files', 'Clients'], applied) });
  assert.deepEqual(applied, [], 'rien n\'a été créé : la structure reste comme elle est');
});
