// Les documents reliés (js/sharing/share-links.js) : ce que la table technique du moteur dit d'un lien, la condition qui ne reste jamais vide, et le niveau d'un fichier (une copie une fois, à jour, plus rien). Le moteur est
// ici un faux qui note ses appels ; ce qu'il fait dans un vrai Grist est mesuré par labo/run-sync-retrait.mjs (faits vérifiés 70).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NONE, SENT_COLUMNS, applyLevel, docOf, filesOf, idsWith, levelOf, linksFrom, selectionFor, settle, stopLink } from '../js/sharing/share-links.js';

const tablesWith = values => [{ table: 'GFS_Fichiers', columns: [], filter: { mode: 'all', conds: [{ id: 'Identifiant', op: 'in', values }] } }];
const hook = (id, memo = 'ami@exemple.fr · abcdef123456 · Equipe/Compta') => ({ id, fields: { memo, enabled: true } });

test('la sélection nomme les fichiers par leur identifiant ; sans fichier elle nomme un identifiant qui n\'existe pas (une condition vide enverrait tous les fichiers : mesuré)', () => {
  const [one] = selectionFor(['a', 'b']);
  assert.equal(one.table, 'GFS_Fichiers');
  assert.deepEqual(one.filter.conds, [{ id: 'Identifiant', op: 'in', values: ['a', 'b'] }]);
  assert.ok(SENT_COLUMNS.includes('Contenu') && !SENT_COLUMNS.includes('SupprimeLe'));
  assert.ok(SENT_COLUMNS.includes('Dossier_partage'), 'le nom du dossier partagé part avec le fichier (le moteur ne l\'envoie que si la table porte la colonne)');
  const [none] = selectionFor([]);
  assert.deepEqual(none.filter.conds[0].values, [NONE], 'jamais une liste vide');
  assert.deepEqual(filesOf(tablesWith([NONE])), [], 'l\'identifiant fictif n\'est pas un fichier');
});

test('filesOf : seule la condition de GFS compte ; tout autre export est laissé', () => {
  assert.deepEqual(filesOf(tablesWith(['a', 'b'])), ['a', 'b']);
  assert.equal(filesOf(null), null);
  assert.equal(filesOf([]), null);
  assert.equal(filesOf([{ table: 'Clients', columns: [], filter: null }]), null, 'une autre table');
  assert.equal(filesOf([{ table: 'GFS_Fichiers', columns: [], filter: null }]), null, 'sans condition : tous les fichiers, pas un lien de GFS');
  assert.equal(filesOf([{ table: 'GFS_Fichiers', columns: [], filter: { mode: 'all', conds: [{ id: 'Nom', op: 'in', values: ['x'] }] } }]), null, 'une autre colonne');
});

test('le document se lit dans le mémo du webhook : le nom après l\'équipe, l\'identifiant ensuite', () => {
  assert.deepEqual(docOf('ami@exemple.fr · abcdef123456 · Equipe/Compta - Nord'), { name: 'Compta - Nord', id: 'abcdef123456' });
  assert.deepEqual(docOf('ami@exemple.fr · abcdef123456 · Equipe'), { name: '', id: 'abcdef123456' });
  assert.deepEqual(docOf(''), { name: '', id: '' });
});

function raw({ exports, invitations = [], hooks = {}, tables = {} }) {
  return {
    note: { exports, invitations }, rows: [],
    hooks: { of: id => hooks[id] || [] },
    tablesOf: (rows, id) => tables[id] || [], emailOf: () => 'moi@exemple.fr', statusOf: each => each.status || 'active',
  };
}

test('linksFrom : un lien actif, un en attente, et rien pour un échange, un lien public, un export d\'une autre origine ou un export sans destinataire ni invitation', () => {
  const links = linksFrom(raw({
    exports: [{ id: 'e1', name: 'Compta' }, { id: 'e2', name: 'Direction' }, { id: 'e3', name: 'Echange', echange: true }, { id: 'e4', name: 'Public', public: true }, { id: 'e5', name: 'Autre' }, { id: 'e6', name: 'Seul' }],
    invitations: [{ id: 'i2', export: 'e2' }],
    hooks: { e1: [hook('h1')], e3: [hook('h3')], e4: [hook('h4')], e5: [hook('h5')] },
    tables: { e1: tablesWith(['a', 'b']), e2: tablesWith(['a']), e3: tablesWith(['a']), e4: tablesWith(['a']), e5: [{ table: 'Clients', columns: [], filter: null }], e6: tablesWith(['a']) },
  }));
  assert.deepEqual(links.map(link => [link.id, link.state, link.doc.name, link.files]), [['e1', 'active', 'Compta', ['a', 'b']], ['e2', 'pending', '', ['a']]]);
  assert.equal(links[0].exp.email, 'moi@exemple.fr');
  assert.equal(links[0].exp.recipients.length, 1);
  assert.equal(links[0].exp.public, false);
});

test('linksFrom : l\'état dit « bloqué » dès qu\'un destinataire est en erreur, « en pause » quand tous le sont ; sans droit sur les webhooks (null), il ne reste que les invitations', () => {
  const base = { exports: [{ id: 'e1', name: 'Compta' }], tables: { e1: tablesWith(['a']) } };
  assert.equal(linksFrom(raw({ ...base, hooks: { e1: [hook('h1'), { ...hook('h2'), status: 'error' }] } }))[0].state, 'blocked');
  assert.equal(linksFrom(raw({ ...base, hooks: { e1: [{ ...hook('h1'), status: 'paused' }] } }))[0].state, 'paused');
  const unreadable = raw({ ...base, invitations: [{ id: 'i1', export: 'e1' }] });
  unreadable.hooks = null;
  assert.deepEqual(linksFrom(unreadable).map(link => link.state), ['pending']);
  const none = raw(base);
  none.hooks = null;
  assert.deepEqual(linksFrom(none), []);
});

test('le niveau d\'un fichier est « à jour » quand il est dans la condition, sinon « pas partagé » ; la condition change par un seul fichier à la fois', () => {
  const link = { files: ['a', 'b'] };
  assert.equal(levelOf(link, 'a'), 'live');
  assert.equal(levelOf(link, 'z'), 'none');
  assert.deepEqual(idsWith(link, 'c', true), ['a', 'b', 'c']);
  assert.deepEqual(idsWith(link, 'a', true), ['a', 'b'], 'pas de doublon');
  assert.deepEqual(idsWith(link, 'a', false), ['b']);
});

test('le niveau d\'un dossier (la liste de ses fichiers) : « à jour » si tous sont dans la condition, « une partie » si certains seulement, sinon « pas partagé » ; un dossier sans fichier n\'est jamais « à jour »', () => {
  const link = { files: ['a', 'b', 'x'] };
  assert.equal(levelOf(link, ['a', 'b']), 'live');
  assert.equal(levelOf(link, ['a', 'c']), 'part', 'un fichier ajouté plus tard au dossier, pas encore partagé');
  assert.equal(levelOf(link, ['c', 'd']), 'none');
  assert.equal(levelOf(link, []), 'none');
  assert.deepEqual(idsWith(link, ['b', 'c', 'd'], true), ['a', 'b', 'x', 'c', 'd'], 'les fichiers du dossier entrent d\'un coup, sans doublon');
  assert.deepEqual(idsWith(link, ['a', 'b'], false), ['x'], 'et sortent d\'un coup, sans toucher à ce qui est partagé à côté');
});

// Un moteur qui note ses appels ; `links` : ce que relit `readLinks` à chaque appel (la condition telle qu'elle est au moment de la retirer).
function fakeEngine({ links = [], passes = [{ why: 'sent' }, { why: 'idle' }], pending = [0] } = {}) {
  const calls = [];
  let at = -1;
  return {
    calls,
    saveChosenExport: async args => { calls.push(['save', args.selection[0].filter.conds[0].values]); return { changed: ['GFS_Fichiers'] }; },
    finishEdit: async () => { calls.push(['finish']); },
    catchUp: async () => { at += 1; calls.push(['catchUp']); },
    catchState: () => ({ why: (passes[Math.min(at, passes.length - 1)] || {}).why, running: Boolean((passes[Math.min(at, passes.length - 1)] || {}).running) }),
    filesPending: () => pending[Math.min(Math.max(at, 0), pending.length - 1)],
    readLinks: async () => links,
    endExport: async exp => { calls.push(['end', exp.id]); },
  };
}
const LINK = { id: 'e1', name: 'Compta', files: ['a'], exp: { id: 'e1', name: 'Compta' } };
const nowait = async () => {};

test('applyLevel pour un dossier : tous ses fichiers entrent ou sortent en UNE condition ; « une fois » les retire tous après l\'envoi, sans toucher aux autres', async () => {
  const engine = fakeEngine({ links: [{ ...LINK, files: ['a', 'b', 'c', 'z'] }] });
  assert.equal((await applyLevel(engine, LINK, ['b', 'c'], 'live', nowait)).level, 'live');
  assert.deepEqual(engine.calls, [['save', ['a', 'b', 'c']], ['finish']]);
  const out = fakeEngine();
  await applyLevel(out, { ...LINK, files: ['a', 'b', 'c'] }, ['b', 'c'], 'none', nowait);
  assert.deepEqual(out.calls[0], ['save', ['a']]);
  const once = fakeEngine({ links: [{ ...LINK, files: ['a', 'b', 'c', 'z'] }] });
  const done = await applyLevel(once, LINK, ['b', 'c'], 'once', nowait);
  await done.later;
  assert.deepEqual(once.calls.filter(call => call[0] === 'save'), [['save', ['a', 'b', 'c']], ['save', ['a', 'z']]], 'les deux fichiers du dossier sortent, z (partagé à côté) reste');
});

test('applyLevel « à jour » : le fichier entre dans la condition et y reste ; « pas partagé » l\'en sort, et la condition ne devient jamais vide', async () => {
  const engine = fakeEngine();
  assert.equal((await applyLevel(engine, LINK, 'b', 'live', nowait)).level, 'live');
  assert.deepEqual(engine.calls, [['save', ['a', 'b']], ['finish']]);
  const last = fakeEngine();
  await applyLevel(last, LINK, 'a', 'none', nowait);
  assert.deepEqual(last.calls[0], ['save', [NONE]], 'le dernier fichier parti, la condition nomme un identifiant qui n\'existe pas');
});

test('applyLevel « une fois » : le fichier entre, part (rattrapage jusqu\'à « rien à envoyer »), puis sort de la condition relue à ce moment-là', async () => {
  const engine = fakeEngine({ links: [{ ...LINK, files: ['a', 'b', 'c'] }], passes: [{ why: 'sent' }, { why: 'idle', running: true }, { why: 'idle' }], pending: [1, 1, 0] });
  const done = await applyLevel(engine, LINK, 'b', 'once', nowait);
  assert.deepEqual(engine.calls.slice(0, 2), [['save', ['a', 'b']], ['finish']], 'le fichier entre d\'abord dans la condition, et la fenêtre n\'attend pas le reste');
  await done.later;
  assert.deepEqual(engine.calls.filter(call => call[0] === 'save'), [['save', ['a', 'b']], ['save', ['a', 'c']]], 'c, ajouté entre-temps, ne disparaît pas avec b');
  assert.equal(engine.calls.filter(call => call[0] === 'catchUp').length, 3);
});

test('settle : un lien de réception qui ne répond pas dit « blocked » ; un envoi qui ne finit pas dit « timeout »', async () => {
  await assert.rejects(() => settle(fakeEngine({ passes: [{ why: 'blocked' }] }), LINK, nowait), error => error.share === 'blocked');
  await assert.rejects(() => settle(fakeEngine({ passes: [{ why: 'idle', running: true }] }), LINK, nowait), error => error.share === 'timeout');
});

test('arrêter le lien : ses invitations en attente sont annulées, puis l\'export et son webhook s\'en vont (ce qui est arrivé reste chez l\'autre)', async () => {
  const engine = fakeEngine();
  engine.cancelPendingInvitation = async inv => { engine.calls.push(['cancel', inv.id]); };
  await stopLink(engine, { ...LINK, exp: { ...LINK.exp, invitations: [{ id: 'i1' }, { id: 'i2' }] } });
  assert.deepEqual(engine.calls, [['cancel', 'i1'], ['cancel', 'i2'], ['end', 'e1']]);
  const alone = fakeEngine();
  await stopLink(alone, { ...LINK, exp: { ...LINK.exp, invitations: [] } });
  assert.deepEqual(alone.calls, [['end', 'e1']]);
});
