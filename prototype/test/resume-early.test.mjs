// L'app lancée plus tôt après un rechargement (js/broker/resume-early.js, js/broker/resume.js ; 27/11, choix du porteur après la mesure de fluidité, lot 3) : un faux contrôleur et un faux
// navigateur. Ce que la reprise lance avant que la liste ait dit si le fichier existe encore, et ce qu'elle défait quand la liste dit non. Le rechargement dans un vrai Grist, avec la
// vraie Publipostage+ : labo/run-reprise.mjs et labo/run-reprise-tot.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resume } from '../js/broker/resume.js';
import { MEMORY_PREFIX } from '../js/broker/resume-place.js';
import { earlyTarget, startEarly, keeps, undoEarly, earlyFields } from '../js/broker/resume-early.js';
import { FILES_APP } from '../js/files/gfs-files.js';
import { ANNUAIRES_APP } from '../js/files/annuaire-files.js';

const WHO = 'essai@example.com';
const SLOT = `${MEMORY_PREFIX}doc1.Clients`;
const file = (id, name, type = 'document') => ({ key: `publipostage:${id}`, app: 'publipostage', id, name, type, folder: '' });
const FILES = [file(16, 'Contrat de prestation'), file(17, 'Quittance de loyer', 'email')];
const memoryOf = (item, extra = {}) => ({ v: 1, who: WHO, lieu: 'fichier', key: item.key, name: item.name, ...earlyFields(item), ...extra });

function fakeWindow(memory) {
  const session = memory ? { [SLOT]: JSON.stringify(memory) } : {};
  const make = data => ({ getItem: key => (key in data ? data[key] : null), setItem(key, value) { data[key] = String(value); }, removeItem(key) { delete data[key]; } });
  return { session, localStorage: make({}), sessionStorage: make(session), addEventListener() {}, removeEventListener() {} };
}

// `gate` : la liste n'est lue qu'une fois `release()` appelé (pour voir ce qui part avant elle) ; `events` : l'ordre de ce qui s'est passé.
function fakeController({ files = FILES, lock = () => null, openable = () => true, openIn = async () => true, identity = WHO, gate = Promise.resolve() } = {}) {
  const events = [];
  const calls = { openIn: [], openFile: [], removed: [], closed: 0, notices: [], showExplorer: 0 };
  const c = {
    events, calls, identity, fullAccess: true, locale: 'fr', session: null, opening: 'garde',
    docId: async () => 'doc1',
    state: { whenTable: async () => ({ tableId: 'Clients' }) },
    opened: { onChange() {}, shown: () => null, keys: () => [], remove: key => calls.removed.push(key) },
    explorer: { files, folders: [], state: { view: 'folder', path: '' }, isOpen: false, goTo() {} },
    lockOf: item => lock(item),
    openable: id => openable(id),
    refreshFiles: async () => { events.push('liste demandée'); await gate; events.push('liste lue'); },
    openings: {
      openIn: async (app, opening, notice) => { events.push('app lancée'); calls.openIn.push({ app, opening, notice }); const ok = await openIn(); if (ok) c.session = { id: app }; return ok; },
      openFile: async item => { events.push('openFile'); calls.openFile.push(item.key); return true; },
    },
    closeSession() { calls.closed++; c.session = null; events.push('app refermée'); },
    showExplorer() { calls.showExplorer++; },
    notice: text => calls.notices.push(text),
    t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
  };
  return c;
}

test('earlyTarget : un souvenir de fichier d\'app qui dit l\'app, le numéro et le type peut s\'ouvrir tôt', () => {
  assert.deepEqual(earlyTarget(memoryOf(FILES[0])), { app: 'publipostage', id: 16, type: 'document', key: 'publipostage:16' });
  assert.deepEqual(earlyTarget(memoryOf(file('16', 'x'))).id, '16', 'un numéro peut être un texte');
});

test('earlyTarget : rien ne s\'ouvre tôt sans de quoi désigner le fichier, ni pour un fichier que GFS garde ou un annuaire', () => {
  const old = { v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat' };
  assert.equal(earlyTarget(old), null, 'le souvenir d\'avant le lot : la reprise est celle d\'avant');
  assert.equal(earlyTarget(null), null);
  assert.equal(earlyTarget({ ...memoryOf(FILES[0]), lieu: 'explorateur' }), null);
  assert.equal(earlyTarget(memoryOf(FILES[0], { app: FILES_APP })), null, 'un PDF que GFS garde ne passe pas par une app');
  assert.equal(earlyTarget(memoryOf(FILES[0], { app: ANNUAIRES_APP })), null, 'un annuaire est montré par le module de GFS');
  for (const bad of [{ app: '../x' }, { app: 12 }, { id: null }, { id: '' }, { id: 1.5 }, { id: {} }, { type: '' }, { type: 3 }, { type: 'x'.repeat(41) }, { key: '' }]) {
    assert.equal(earlyTarget(memoryOf(FILES[0], bad)), null, JSON.stringify(bad));
  }
});

test('startEarly : l\'app s\'ouvre sur le fichier comme à un double-clic, sans la liste', async () => {
  const c = fakeController();
  assert.equal(await startEarly(c, earlyTarget(memoryOf(FILES[0]))), true);
  assert.deepEqual(c.calls.openIn, [{ app: 'publipostage', opening: { fichier: { id: 16, type: 'document' }, type: 'document', dossier: '', raison: 'explorateur' }, notice: 'ex.notice.open' }]);
});

test('startEarly : une app qui ne s\'ouvre pas (absente, éteinte, refus) rend faux, sans lever', async () => {
  const target = earlyTarget(memoryOf(FILES[0]));
  const absent = fakeController({ openable: () => false });
  assert.equal(await startEarly(absent, target), false);
  assert.equal(absent.calls.openIn.length, 0, 'rien n\'est lancé pour une app qui ne s\'ouvre pas');
  assert.equal(await startEarly(fakeController({ openIn: async () => false }), target), false);
  assert.equal(await startEarly(fakeController({ openIn: async () => { throw new Error('boum'); } }), target), false);
});

test('keeps : seul le même fichier, du même type, est gardé', () => {
  const target = earlyTarget(memoryOf(FILES[0]));
  assert.equal(keeps(target, { kind: 'file', file: FILES[0] }), true);
  assert.equal(keeps(target, { kind: 'file', file: FILES[1] }), false);
  assert.equal(keeps(target, { kind: 'file', file: { ...FILES[0], type: 'email' } }), false, 'un type qui a changé : l\'app a été lancée sur un autre');
  for (const kind of ['missing', 'none', 'place']) assert.equal(keeps(target, { kind, file: FILES[0] }), false, kind);
});

test('undoEarly : l\'app est refermée, « Ouverts » oublie le fichier, la consigne gardée est vidée', () => {
  const c = fakeController();
  c.session = { id: 'publipostage' };
  undoEarly(c, earlyTarget(memoryOf(FILES[0])));
  assert.deepEqual(c.calls.removed, ['publipostage:16']);
  assert.equal(c.calls.closed, 1);
  assert.equal(c.opening, null);
  const bare = fakeController();
  assert.doesNotThrow(() => undoEarly(bare, earlyTarget(memoryOf(FILES[0]))), 'rien à refermer');
  assert.equal(bare.calls.closed, 0);
});

test('l\'app part AVANT que la liste soit lue, et le fichier vérifié la garde : rien n\'est rouvert une seconde fois', async () => {
  let release;
  const c = fakeController({ gate: new Promise(resolve => { release = resolve; }) });
  const arriving = new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(c.events, ['app lancée', 'liste demandée'], 'l\'app est lancée, puis la liste se lit : la liste n\'est pas encore lue');
  release();
  assert.equal(await arriving, 'file');
  assert.deepEqual(c.calls.openFile, [], 'le fichier n\'est pas rouvert : l\'app est déjà dessus');
  assert.equal(c.calls.closed, 0);
  assert.equal(c.calls.openIn.length, 1);
});

test('un fichier supprimé : l\'app lancée tôt est refermée, la phrase le dit, l\'arrivée est celle d\'avant', async () => {
  const c = fakeController({ files: [FILES[1]] });
  const outcome = await new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO));
  assert.equal(outcome, null);
  assert.deepEqual(c.events.filter(event => event.startsWith('app')), ['app lancée', 'app refermée']);
  assert.deepEqual(c.calls.removed, ['publipostage:16']);
  assert.equal(c.calls.notices.length, 1);
  assert.match(c.calls.notices[0], /^resume\.gone /);
  assert.deepEqual(c.calls.openFile, []);
  assert.equal(c.session, null);
});

test('un fichier que l\'accès cache ou qu\'une extension éteinte grise : l\'app lancée tôt est refermée, la phrase dit pourquoi', async () => {
  const c = fakeController({ lock: () => ({ text: 'grisé' }) });
  assert.equal(await new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO)), null);
  assert.equal(c.calls.closed, 1);
  assert.match(c.calls.notices[0], /^resume\.locked /);
});

test('le souvenir d\'une autre personne : l\'app lancée tôt est refermée, sans phrase', async () => {
  const c = fakeController();
  const outcome = await new Resume(c, fakeWindow(memoryOf(FILES[0], { who: 'autre@example.com' }))).arrive(Promise.resolve(WHO));
  assert.equal(outcome, null);
  assert.equal(c.calls.closed, 1);
  assert.deepEqual(c.calls.notices, []);
  assert.deepEqual(c.calls.openFile, []);
});

test('une liste vide (lecture qui a échoué) ne prouve rien : l\'app lancée tôt est refermée, sans phrase, l\'arrivée est celle d\'avant', async () => {
  const c = fakeController({ files: [] });
  assert.equal(await new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO)), null);
  assert.equal(c.calls.closed, 1);
  assert.deepEqual(c.calls.notices, []);
});

test('un type qui a changé depuis : l\'app lancée tôt est refermée, puis le fichier s\'ouvre comme avant, avec son type d\'aujourd\'hui', async () => {
  const c = fakeController({ files: [{ ...FILES[0], type: 'email' }] });
  assert.equal(await new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO)), 'file');
  assert.equal(c.calls.closed, 1);
  assert.deepEqual(c.calls.openFile, ['publipostage:16']);
});

test('une app qui ne s\'ouvre pas tôt : la reprise est celle d\'avant, le fichier s\'ouvre après la liste', async () => {
  const c = fakeController({ openable: () => false });
  assert.equal(await new Resume(c, fakeWindow(memoryOf(FILES[0]))).arrive(Promise.resolve(WHO)), 'file');
  assert.deepEqual(c.calls.openFile, ['publipostage:16']);
  assert.equal(c.calls.closed, 0);
  assert.deepEqual(c.events.filter(event => event === 'liste lue' || event === 'openFile'), ['liste lue', 'openFile']);
});

test('le souvenir d\'avant le lot (sans app, ni numéro, ni type) : rien ne part tôt, la reprise est celle d\'avant', async () => {
  const c = fakeController();
  const old = { v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation' };
  assert.equal(await new Resume(c, fakeWindow(old)).arrive(Promise.resolve(WHO)), 'file');
  assert.equal(c.calls.openIn.length, 0);
  assert.deepEqual(c.calls.openFile, ['publipostage:16']);
});

test('ce que la reprise retient d\'un fichier ouvert dit aussi l\'app, le numéro et le type (de quoi le rouvrir tôt la fois suivante)', async () => {
  const win = fakeWindow(null);
  const c = fakeController();
  c.session = { id: 'publipostage' };
  c.opened.shown = () => 'publipostage:16';
  const resume = new Resume(c, win);
  await resume.arrive(Promise.resolve(WHO));
  resume.begin();
  assert.deepEqual(JSON.parse(win.session[SLOT]), { v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation', app: 'publipostage', id: 16, type: 'document' });
});
