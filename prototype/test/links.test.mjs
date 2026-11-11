// Les liens entre apps (js/broker/links.js, contrats 5.4 points 2 et 7) : la lecture des deux demandes, les fichiers qu'un choix laisse passer, et le déroulement de `choisir` et `ouvrir` face à un
// contrôleur joué par l'essai. Ce que Grist envoie (les tables, les fenêtres, le cadre) se mesure dans un vrai Grist : labo/run-liens.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppLinks, chooser, readChoice, readOpen } from '../js/broker/links.js';
import { ERR } from '../js/broker/filter.js';
import { automation, form, publipostage } from './helpers.mjs';

const refused = (run, code) => assert.throws(run, error => error.code === code, `attendu : ${code}`);
const refusedLater = (promise, code) => assert.rejects(promise, error => error.code === code, `attendu : ${code}`);

test('readChoice : les types, les apps et le titre d\'une demande de choix', () => {
  assert.deepEqual(readChoice({ types: ['document', 'grille', 'document'] }), { types: ['document', 'grille'], apps: null, titre: '' });
  assert.deepEqual(readChoice({ types: ['projet'], apps: ['tuesday'], titre: '  Lier\n un   projet ' }), { types: ['projet'], apps: ['tuesday'], titre: 'Lier un projet' });
  assert.equal(readChoice({ types: ['a'], titre: 'x'.repeat(300) }).titre.length, 120, 'un titre trop long est coupé');
  for (const bad of [{}, { types: [] }, { types: 'document' }, { types: [1] }, { types: [''] }, { types: ['x'.repeat(65)] }, { types: Array.from({ length: 17 }, (_, i) => `t${i}`) },
    { types: ['a'], apps: [] }, { types: ['a'], apps: 'form' }, { types: ['a'], titre: 5 }]) {
    refused(() => readChoice(bad), ERR.REFUSE);
  }
});

test('chooser : un fichier se choisit si son type est demandé ET offert par son app (actions.choisir), dans les apps demandées', () => {
  const manifests = [publipostage(), form(), automation()];
  const file = (app, type) => ({ app, type });
  const all = chooser(manifests, { types: ['document', 'grille', 'presentation', 'email', 'formulaire'], apps: null });
  assert.equal(all(file('publipostage', 'document')), true);
  assert.equal(all(file('publipostage', 'grille')), true);
  assert.equal(all(file('publipostage', 'presentation')), true, 'décision du 03/11 : les présentations de Publipostage+ se lient aussi');
  assert.equal(all(file('publipostage', 'email')), false, 'demandé, mais pas offert par l\'app (choisir ne le déclare pas)');
  assert.equal(all(file('form', 'formulaire')), false, 'Form+ n\'offre rien à choisir');
  assert.equal(all(file('inconnue', 'document')), false, 'une app que GFS ne connaît pas n\'offre rien');
  const documents = chooser(manifests, { types: ['document'], apps: null });
  assert.equal(documents(file('publipostage', 'grille')), false, 'offert, mais pas demandé');
  const only = chooser(manifests, { types: ['document'], apps: ['automation'] });
  assert.equal(only(file('publipostage', 'document')), false, 'une app qui n\'est pas dans `apps`');
});

test('readOpen : la clé { app, fichier: { id, type } } d\'un lien ; l\'id se lit comme texte', () => {
  assert.deepEqual(readOpen({ app: 'tuesday', fichier: { id: '7', type: 'projet' } }), { app: 'tuesday', id: '7', type: 'projet' });
  assert.deepEqual(readOpen({ app: 'tuesday', fichier: { id: 12, type: 'projet' }, raison: 'lien' }), { app: 'tuesday', id: '12', type: 'projet' });
  for (const bad of [{}, { app: 'a' }, { app: 'a', fichier: null }, { app: 'a', fichier: { id: '1' } }, { app: 'a', fichier: { type: 't' } }, { app: '', fichier: { id: '1', type: 't' } },
    { app: 'a', fichier: { id: ' ', type: 't' } }, { app: 'a', fichier: { id: 1.5, type: 't' } }, { app: 'a', fichier: { id: {}, type: 't' } }, { app: 'a'.repeat(65), fichier: { id: '1', type: 't' } },
    { app: 'a', fichier: { id: 'x'.repeat(201), type: 't' } }, { app: 'a', fichier: { id: '1', type: 't' }, raison: 'nouveau' }, { app: 'a', fichier: { id: '1', type: 't' }, raison: 'importer' }]) {
    refused(() => readOpen(bad), ERR.REFUSE);
  }
});

// Le contrôleur joué par l'essai : l'explorateur, la fenêtre qui débloque, les fichiers de l'app visée, l'ouverture. `log` note ce que GFS a fait, dans l'ordre.
function setup({ full = true, locks = new Map(), files = [], problems = [], opened = true, explorerOpen = false } = {}) {
  const log = [];
  const state = { session: 'S1', explorerOpen };
  const manifests = [publipostage(), form()];
  const lockFor = new Map(locks);
  let choice = null;
  const explorer = {
    get isOpen() { return state.explorerOpen; },
    enterChoice: c => { choice = c; log.push(['enterChoice', c.title]); },
    exitChoice: () => { choice = null; log.push(['exitChoice']); },
  };
  const host = {
    explorer: () => explorer, session: () => state.session, manifests: () => manifests, appById: id => manifests.map(manifest => ({ manifest })).find(item => item.manifest.id === id) || null,
    appName: id => `App ${id}`, fullAccess: () => full, t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key), notice: text => log.push(['notice', text]),
    lockOf: file => lockFor.get(file.id) || null,
    unlock: async lock => { log.push(['unlock', lock.text]); if (lock.unlockedBy) { lockFor.delete(lock.unlockedBy); } },
    showExplorer: () => { state.explorerOpen = true; log.push(['showExplorer']); },
    hideExplorer: () => { state.explorerOpen = false; log.push(['hideExplorer']); },
    loadFiles: async apps => { log.push(['loadFiles', apps.map(app => app.manifest.id)]); return { files, problems }; },
    openIn: async (appId, opening) => { log.push(['openIn', appId, opening]); return opened; },
  };
  return { links: new AppLinks(host), log, state, explorer, lockFor, choice: () => choice, host };
}

const doc = (id, extra = {}) => ({ app: 'publipostage', id, type: 'document', name: `Modèle ${id}`, folder: 'Contrats', ...extra });

test('choisir : l\'explorateur s\'ouvre en mode choix, le fichier désigné est rendu avec le nom que la personne a vu, puis l\'explorateur se referme', async () => {
  const { links, log, state, choice } = setup();
  const pending = links.choose('S1', { types: ['document'], titre: 'Lier un modèle' });
  assert.deepEqual(log, [['enterChoice', 'Lier un modèle'], ['showExplorer']]);
  assert.equal(choice().accept(doc('3')), true);
  assert.equal(choice().accept({ ...doc('3'), type: 'email' }), false);
  choice().onPick(doc('3'));
  assert.deepEqual(await pending, { app: 'publipostage', id: '3', nom: 'Modèle 3', type: 'document' });
  assert.deepEqual(log.slice(2), [['exitChoice'], ['hideExplorer']]);
  assert.equal(state.explorerOpen, false);
  const second = links.choose('S1', { types: ['document'] });
  choice().onPick(doc('4', { name: '' }));
  assert.equal((await second).nom, 'ex.untitled', 'un fichier sans nom porte le texte « sans nom » que la liste montrait');
});

test('choisir : Annuler rend null ; l\'explorateur déjà ouvert avant la demande reste ouvert ; un seul choix à la fois', async () => {
  const { links, log, choice } = setup();
  const pending = links.choose('S1', { types: ['document'] });
  assert.throws(() => links.choose('S1', { types: ['document'] }), error => error.code === ERR.REFUSE && /déjà en cours/.test(error.message));
  choice().onCancel();
  assert.equal(await pending, null);
  assert.deepEqual(log.slice(-2), [['exitChoice'], ['hideExplorer']]);
  log.length = 0;
  const open = setup({ explorerOpen: true });
  const kept = open.links.choose('S1', { types: ['document'] });
  open.links.cancel();
  assert.equal(await kept, null);
  assert.deepEqual(open.log, [['enterChoice', ''], ['showExplorer'], ['exitChoice']], 'l\'explorateur qui était ouvert le reste');
});

test('choisir : cancel(false) et drop() finissent le choix sans toucher à l\'affichage ; sans choix en cours, ils ne font rien', async () => {
  for (const end of [links => links.cancel(false), links => links.drop()]) {
    const { links, log } = setup();
    const pending = links.choose('S1', { types: ['document'] });
    end(links);
    assert.equal(await pending, null);
    assert.deepEqual(log, [['enterChoice', ''], ['showExplorer'], ['exitChoice']]);
    end(links);
    assert.equal(log.length, 3);
  }
});

test('choisir : un fichier grisé ne se choisit pas, la fenêtre qui le débloque s\'ouvre et le choix continue', async () => {
  const lock = { text: 'Demande l\'app', focus: 'row-app' };
  const { links, log, choice } = setup({ locks: new Map([['9', lock]]) });
  const pending = links.choose('S1', { types: ['document'] });
  choice().onPick(doc('9'));
  assert.deepEqual(log.slice(2), [['unlock', 'Demande l\'app']]);
  assert.equal(choice() !== null, true, 'toujours en mode choix');
  choice().onPick(doc('3'));
  assert.equal((await pending).id, '3');
});

test('choisir : une demande hors règle est refusée avant que rien ne s\'ouvre ; sans l\'accès complet, GFS_ACCES', () => {
  const { links, log } = setup();
  refused(() => links.choose('S1', { types: [] }), ERR.REFUSE);
  assert.deepEqual(log, []);
  const poor = setup({ full: false });
  refused(() => poor.links.choose('S1', { types: ['document'] }), ERR.ACCES);
  assert.deepEqual(poor.log, []);
});

test('ouvrir : le fichier est relu chez l\'app visée, puis ouvert avec la raison « lien » et son dossier ; la réponse dit si l\'app a ouvert', async () => {
  const { links, log } = setup({ files: [doc('3'), doc('4', { folder: '' })] });
  assert.deepEqual(await links.open('S1', { app: 'publipostage', fichier: { id: 3, type: 'document' } }), { ouvert: true });
  assert.deepEqual(log, [['loadFiles', ['publipostage']], ['openIn', 'publipostage', { fichier: { id: '3', type: 'document' }, type: 'document', dossier: 'Contrats', raison: 'lien' }]]);
  const declined = setup({ files: [doc('3')], opened: false });
  assert.deepEqual(await declined.links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' }, raison: 'lien' }), { ouvert: false });
});

test('ouvrir : une app inconnue, un type que l\'app n\'ouvre pas, une forme hors règle, ou pas d\'accès complet, sont refusés sans rien lire', async () => {
  const { links, log } = setup({ files: [doc('3')] });
  await refusedLater(links.open('S1', { app: 'nulle-part', fichier: { id: '1', type: 'document' } }), ERR.INTROUVABLE);
  await refusedLater(links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'secret' } }), ERR.REFUSE);
  await refusedLater(links.open('S1', { app: 'publipostage' }), ERR.REFUSE);
  await refusedLater(setup({ full: false }).links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' } }), ERR.ACCES);
  assert.deepEqual(log, []);
});

test('ouvrir : un fichier qui n\'est plus dans la table de l\'app visée n\'ouvre rien, GFS le dit (GFS_INTROUVABLE) ; une table illisible est dite avec sa raison', async () => {
  const { links, log } = setup({ files: [doc('3')] });
  await refusedLater(links.open('S1', { app: 'publipostage', fichier: { id: '99', type: 'document' } }), ERR.INTROUVABLE);
  await refusedLater(links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'grille' } }), ERR.INTROUVABLE);
  assert.equal(log.filter(entry => entry[0] === 'openIn').length, 0);
  assert.deepEqual(log.filter(entry => entry[0] === 'notice').map(entry => entry[1]), ['link.gone {"app":"App publipostage"}', 'link.gone {"app":"App publipostage"}']);
  const broken = setup({ files: [], problems: [{ app: 'publipostage', reason: 'Table inconnue' }] });
  await refusedLater(broken.links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' } }), ERR.INTROUVABLE);
  assert.match(broken.log.find(entry => entry[0] === 'notice')[1], /^ex\.readFailed .*Table inconnue/);
});

test('ouvrir : un fichier grisé ouvre la fenêtre qui le débloque et l\'appel attend ; débloqué, il s\'ouvre, sinon GFS_ANNULE', async () => {
  const lock = { text: 'Demande l\'app Publipostage+', focus: 'row', unlockedBy: '3' };
  const unlocked = setup({ files: [doc('3')], locks: new Map([['3', lock]]) });
  assert.deepEqual(await unlocked.links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' } }), { ouvert: true });
  assert.deepEqual(unlocked.log.map(entry => entry[0]), ['loadFiles', 'unlock', 'openIn']);
  const stuck = setup({ files: [doc('3')], locks: new Map([['3', { text: 'Demande l\'extension', focus: 'row' }]]) });
  await refusedLater(stuck.links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' } }), ERR.ANNULE);
  assert.deepEqual(stuck.log.map(entry => entry[0]), ['loadFiles', 'unlock']);
});

test('ouvrir : l\'app qui a demandé a été remplacée pendant l\'attente, rien ne s\'ouvre', async () => {
  const { links, log, state } = setup({ files: [doc('3')] });
  const pending = links.open('S1', { app: 'publipostage', fichier: { id: '3', type: 'document' } });
  state.session = 'S2';
  await refusedLater(pending, ERR.INACTIF);
  assert.equal(log.filter(entry => entry[0] === 'openIn').length, 0);
});

test('les poignées de l\'enveloppe : `choisir` et `ouvrir`, rien d\'autre', () => {
  const { links } = setup();
  assert.deepEqual(Object.keys(links.handlers('S1')).sort(), ['choisir', 'ouvrir']);
});
