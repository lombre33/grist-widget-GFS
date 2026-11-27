// La reprise après un rechargement de la page (js/broker/resume.js ; demande du porteur, 26/11 : « si un fichier d'app est ouvert, on rouvre le même fichier dans
// l'app ; si on était dans l'explorateur, on rouvre le même endroit »). Un faux contrôleur et un faux navigateur : ce que la reprise écrit sur l'onglet, ce qu'elle
// rouvre, ce qu'elle ne rouvre pas. Le rechargement lui-même, dans un vrai Grist, est dans labo/run-reprise.mjs (et sous Firefox : test/reprise-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resume, ENABLED_KEY } from '../js/broker/resume.js';
import { MEMORY_PREFIX } from '../js/broker/resume-place.js';
import { RESUME_KEY } from '../js/rights/rights-writer.js';

const WHO = 'essai@example.com';
const SLOT = `${MEMORY_PREFIX}doc1.Clients`;
const file = (key, name, folder = '') => ({ key, app: key.split(':')[0], id: key.split(':')[1], name, folder, type: 'document' });
const FILES = [file('publipostage:16', 'Contrat de prestation'), file('publipostage:17', 'Quittance de loyer', 'Formation/Archives 2025')];

// Un navigateur : `localStorage` (le choix de la personne) et `sessionStorage` (le souvenir de l'onglet), l'un et l'autre qui peuvent refuser.
function fakeWindow({ session = {}, local = {}, refuses = false } = {}) {
  const make = data => ({
    getItem: key => (key in data ? data[key] : null),
    setItem(key, value) { if (refuses) throw new Error('refusé'); data[key] = String(value); },
    removeItem(key) { if (refuses) throw new Error('refusé'); delete data[key]; },
  });
  return { session, local, localStorage: make(local), sessionStorage: make(session), addEventListener() {}, removeEventListener() {} };
}

// Le contrôleur : seulement ce que `Resume` lui demande.
function fakeController(options = {}) {
  const { files = FILES, folders = [], identity = WHO, fullAccess = true, table = 'Clients', doc = 'doc1', lock = () => null, openResult = true, explorerOpen = false,
    session = null, shown = null, state = { view: 'folder', path: '', open: new Set() } } = options;
  const calls = { opened: [], goTo: [], showExplorer: 0, refresh: 0, notices: [] };
  const listeners = [];
  const c = {
    calls, identity, fullAccess, locale: 'fr', session,
    docId: async () => doc,
    state: { whenTable: async () => (table ? { tableId: table } : null) },
    opened: { onChange: listener => listeners.push(listener), shown: () => shown, keys: () => [] },
    explorer: { files, folders, state, isOpen: explorerOpen, goTo(place) { calls.goTo.push(place); } },
    lockOf: item => lock(item),
    refreshFiles: async opts => { calls.refresh++; calls.refreshOpts = opts; },
    openings: { openFile: async item => { calls.opened.push(item.key); return openResult; } },
    showExplorer() { calls.showExplorer++; c.explorer.isOpen = true; },
    notice: text => calls.notices.push(text),
    t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
    changed: () => listeners.forEach(listener => listener()),
  };
  return c;
}

const remembered = win => (win.session[SLOT] ? JSON.parse(win.session[SLOT]) : null);
const started = async (c, win) => { const resume = new Resume(c, win); await resume.arrive(Promise.resolve(c.identity)); resume.begin(); return resume; };

test('rien ne se retient avant la fin de l\'arrivée : un souvenir ne s\'écrase pas par l\'état d\'une page qui démarre', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation' }) } });
  const c = fakeController({ explorerOpen: true });
  const resume = new Resume(c, win);
  await resume.arrive(Promise.resolve(WHO));
  const before = win.session[SLOT];
  resume.sync();
  c.changed();
  assert.equal(win.session[SLOT], before, 'avant `begin`, sync n\'écrit rien');
});

test('l\'app montre un fichier que GFS a fait ouvrir : le souvenir dit le fichier (clé, nom, app, numéro, type) et la personne', async () => {
  const win = fakeWindow();
  const c = fakeController({ session: { id: 'publipostage' }, shown: 'publipostage:16' });
  await started(c, win);
  assert.deepEqual(remembered(win), { v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation', app: 'publipostage', id: '16', type: 'document' });
});

test('l\'explorateur est devant : le souvenir dit la vue et le dossier ; « Ouverts » se retient comme la racine', async () => {
  const win = fakeWindow();
  const c = fakeController({ explorerOpen: true, state: { view: 'folder', path: 'Formation/Archives 2025', open: new Set() } });
  await started(c, win);
  assert.deepEqual(remembered(win), { v: 1, who: WHO, lieu: 'explorateur', view: 'folder', path: 'Formation/Archives 2025' });
  c.explorer.state.view = 'opened';
  c.explorer.state.path = 'Stock';
  c.changed();
  assert.deepEqual(remembered(win), { v: 1, who: WHO, lieu: 'explorateur', view: 'folder', path: '' });
});

test('une app ouverte sans fichier que GFS connaisse (« Nouveau », la fenêtre des apps) : « app », rien à rouvrir', async () => {
  const win = fakeWindow();
  await started(fakeController({ session: { id: 'publipostage' }, shown: null }), win);
  assert.deepEqual(remembered(win), { v: 1, who: WHO, lieu: 'app' });
});

test('un changement qui n\'en est pas un n\'écrit rien (le dessin de l\'explorateur rappelle sync à chaque fois)', async () => {
  const win = fakeWindow();
  let writes = 0;
  const raw = win.sessionStorage.setItem;
  win.sessionStorage.setItem = (key, value) => { writes++; raw(key, value); };
  const c = fakeController({ explorerOpen: true });
  const resume = await started(c, win);
  for (let i = 0; i < 5; i++) resume.sync();
  assert.equal(writes, 1);
  c.explorer.state.path = 'Stock';
  resume.sync();
  assert.equal(writes, 2);
});

test('un fichier qui existe encore est rouvert à l\'arrivée, la liste lue sans phrase d\'abord ; l\'explorateur n\'est pas montré', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation' }) } });
  const c = fakeController();
  const resume = new Resume(c, win);
  assert.equal(await resume.arrive(Promise.resolve(WHO)), 'file');
  assert.deepEqual(c.calls.opened, ['publipostage:16']);
  assert.equal(c.calls.refresh, 1);
  assert.deepEqual(c.calls.refreshOpts, { quiet: true });
  assert.equal(c.calls.showExplorer, 0);
});

test('un fichier supprimé, à la corbeille ou plus partagé n\'est pas rouvert : la phrase le dit, l\'arrivée est celle d\'avant', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:99', name: 'Ancien programme' }) } });
  const c = fakeController();
  assert.equal(await new Resume(c, win).arrive(Promise.resolve(WHO)), null);
  assert.deepEqual(c.calls.opened, []);
  assert.deepEqual(c.calls.notices, ['resume.gone {"name":"Ancien programme"}']);
});

test('un fichier grisé (app absente, extension éteinte) n\'est pas rouvert, et la fenêtre « débloquer » ne s\'ouvre pas : une phrase seulement', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation' }) } });
  const c = fakeController({ lock: () => ({ text: 'grisé', focus: 'row' }) });
  assert.equal(await new Resume(c, win).arrive(Promise.resolve(WHO)), null);
  assert.deepEqual(c.calls.opened, []);
  assert.deepEqual(c.calls.notices, ['resume.locked {"name":"Contrat de prestation"}']);
});

test('un fichier que l\'app n\'ouvre pas (la personne annule, l\'app ne répond pas) : l\'arrivée est celle d\'avant, sans phrase', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'Contrat de prestation' }) } });
  const c = fakeController({ openResult: false });
  assert.equal(await new Resume(c, win).arrive(Promise.resolve(WHO)), null);
  assert.deepEqual(c.calls.notices, []);
});

test('l\'explorateur revient au même dossier, puis se montre ; un dossier disparu ramène au dossier du dessus', async () => {
  const at = path => fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'explorateur', view: 'folder', path }) } });
  const c = fakeController();
  assert.equal(await new Resume(c, at('Formation/Archives 2025')).arrive(Promise.resolve(WHO)), 'explorer');
  assert.deepEqual(c.calls.goTo, [{ view: 'folder', path: 'Formation/Archives 2025' }]);
  assert.equal(c.calls.showExplorer, 1);
  const gone = fakeController();
  await new Resume(gone, at('Formation/Archives 2025/Vieux')).arrive(Promise.resolve(WHO));
  assert.deepEqual(gone.calls.goTo, [{ view: 'folder', path: 'Formation/Archives 2025' }]);
});

test('la racine et les vues sans dossier reviennent sans lire la liste : la page n\'attend rien de plus qu\'avant', async () => {
  for (const [view, path] of [['folder', ''], ['recent', ''], ['fav', ''], ['trash', '']]) {
    const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'explorateur', view, path }) } });
    const c = fakeController();
    assert.equal(await new Resume(c, win).arrive(new Promise(() => {})), 'explorer', view);
    assert.equal(c.calls.refresh, 0, `${view} : aucune lecture`);
    assert.deepEqual(c.calls.goTo, [{ view, path: '' }]);
  }
});

test('pas de souvenir, ou une app ouverte sans fichier connu, ou le souvenir d\'une autre table : rien n\'est repris, rien n\'est lu', async () => {
  for (const session of [{}, { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'app' }) }, { [SLOT]: 'n\'importe quoi' }]) {
    const c = fakeController();
    assert.equal(await new Resume(c, fakeWindow({ session })).arrive(Promise.resolve(WHO)), null);
    assert.equal(c.calls.refresh, 0);
    assert.equal(c.calls.showExplorer + c.calls.opened.length, 0);
  }
  const other = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'x' }) } });
  assert.equal(await new Resume(fakeController({ table: 'Factures' }), other).arrive(Promise.resolve(WHO)), null, 'une autre table, un autre souvenir');
});

test('sans l\'accès complet GFS ne lit pas les fichiers : l\'arrivée est celle d\'avant', async () => {
  const win = fakeWindow({ session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'x' }) } });
  const c = fakeController({ fullAccess: false });
  assert.equal(await new Resume(c, win).arrive(Promise.resolve(WHO)), null);
  assert.equal(c.calls.refresh, 0);
});

test('une section sans table ou sans identifiant de document ne retient rien', async () => {
  for (const options of [{ table: null }, { doc: null }]) {
    const win = fakeWindow();
    await started(fakeController({ ...options, explorerOpen: true }), win);
    assert.deepEqual(Object.keys(win.session), []);
  }
});

test('un navigateur qui refuse de garder n\'arrête rien : l\'arrivée est celle d\'avant, sans erreur', async () => {
  const win = fakeWindow({ refuses: true });
  const c = fakeController({ explorerOpen: true });
  const resume = await started(c, win);
  resume.sync();
  assert.equal(await new Resume(c, win).arrive(Promise.resolve(WHO)), null);
});

test('« Rouvrir au rechargement » coupé : rien n\'est repris, rien n\'est retenu, et le souvenir déjà là s\'efface ; rallumé, il se retient de nouveau', async () => {
  const win = fakeWindow({ local: { [ENABLED_KEY]: 'non' }, session: { [SLOT]: JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'x' }) } });
  const c = fakeController({ explorerOpen: true });
  const resume = new Resume(c, win);
  assert.equal(resume.enabled, false);
  assert.equal(await resume.arrive(Promise.resolve(WHO)), null);
  assert.deepEqual(c.calls.opened, []);
  resume.begin();
  assert.equal(win.session[SLOT], JSON.stringify({ v: 1, who: WHO, lieu: 'fichier', key: 'publipostage:16', name: 'x' }), 'coupée, begin n\'écrit rien');
  assert.equal(resume.toggle(), true);
  assert.equal(resume.enabled, true);
  assert.equal(win.local[ENABLED_KEY], undefined, 'allumée, la clé est absente (comme les autres choix)');
  assert.deepEqual(remembered(win), { v: 1, who: WHO, lieu: 'explorateur', view: 'folder', path: '' }, 'rallumée, où la personne est se retient');
  assert.equal(resume.toggle(), true);
  assert.equal(win.local[ENABLED_KEY], 'non');
  assert.equal(win.session[SLOT], undefined, 'coupée, le souvenir s\'efface');
});

// Mesuré le 27/11 dans un vrai Grist : le choix s'appelait `gfs.reprise`, la clé que le panneau des droits retient déjà (RESUME_KEY, `localStorage`) et retire quand
// il a fini : « coupée » puis un rechargement, la reprise se rallumait toute seule. Les clés de la reprise de la page n'ont rien de commun avec celle-là.
test('les clés de la reprise ne sont pas celle du panneau des droits (`gfs.reprise`, qu\'il retire de lui-même)', () => {
  assert.notEqual(ENABLED_KEY, RESUME_KEY);
  assert.ok(!ENABLED_KEY.startsWith(RESUME_KEY) && !MEMORY_PREFIX.startsWith(RESUME_KEY) && !RESUME_KEY.startsWith(MEMORY_PREFIX));
});
