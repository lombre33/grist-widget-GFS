// Ce que l'explorateur demande au contrôleur (js/entries.js) : le grisé et sa raison, les types de « Nouveau », les formats d'« Importer », l'app qui lit un fichier que GFS garde.
// Un contrôleur joué par l'essai (`host`) : les manifestes sont les quatre de GFS, lus tels quels. Ce que l'explorateur en fait à l'écran se mesure dans un vrai Grist (labo/run-ouvrir.mjs, run-importer.mjs, run-lire.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entries } from '../js/entries.js';
import { readCatalogue } from '../js/libraries.js';
import { FILES_APP, FILES_MANIFEST } from '../js/gfs-files.js';
import { catalogue as manifestsOfGfs, readJson } from './helpers.mjs';

const text = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

// `installed` : { id: { extensions: [...] } } ; `patch` : change un manifeste avant de le passer au contrôleur joué.
function host({ installed = {}, fullAccess = true, patch = {}, kept = [], other = { action: 'receive' } } = {}) {
  const manifests = manifestsOfGfs().map(manifest => (patch[manifest.id] ? patch[manifest.id](manifest) : manifest));
  const byId = new Map(manifests.map(manifest => [manifest.id, manifest]));
  const librairies = readCatalogue(readJson('bibliotheques/catalogue.json'));
  const registry = {
    apps: installed, catalogue: librairies, has: id => id in installed, manifest: id => byId.get(id) || null, installedIds: () => Object.keys(installed),
  };
  const c = {
    lang: 'fr', t: text, fullAccess, registry,
    validApps: () => manifests.map(manifest => ({ ok: true, manifest })), manifests: () => manifests,
    manifestOf: id => (id === FILES_APP ? FILES_MANIFEST : byId.get(id) || null), appName: id => (byId.get(id) ? byId.get(id).nom.fr : id),
    kept: { importEntries: () => kept }, otherDocuments: { entry: () => other },
  };
  return { c, entries: new Entries(c) };
}

test('lockOf : sous l\'accès complet seulement, puis l\'app à installer, le type absent, l\'extension éteinte', () => {
  const { entries } = host({ installed: { publipostage: { extensions: [] } } });
  const file = (app, extra = {}) => ({ app, known: true, typeInfo: { extension: null }, ...extra });
  assert.equal(entries.lockOf(file('publipostage')), null, 'une app installée, un type connu : rien ne grise');
  assert.equal(entries.lockOf(file(FILES_APP)), null, 'un fichier que GFS garde : aucune app à installer');
  assert.deepEqual(entries.lockOf(file('automation')), { text: 'ex.lockedApp {"app":"Automation+"}', focus: 'app:automation' });
  assert.deepEqual(entries.lockOf(file('publipostage', { known: false })), { text: 'ex.lockedType {"app":"Publipostage+"}' });
  const extension = entries.lockOf(file('publipostage', { typeInfo: { extension: 'lecture-pdf' } }));
  assert.equal(extension.focus, 'ext:publipostage/lecture-pdf', 'l\'extension éteinte se débloque sur sa ligne de la fenêtre');
  assert.match(extension.text, /^ex\.lockedExtension \{"name":"[^"]+"\}$/);
  const active = host({ installed: { publipostage: { extensions: ['lecture-pdf'] } } });
  assert.equal(active.entries.lockOf(file('publipostage', { typeInfo: { extension: 'lecture-pdf' } })), null, 'extension cochée et servable : plus de grisé');
  const noAccess = host({ fullAccess: false, installed: { publipostage: { extensions: [] } } });
  assert.deepEqual(noAccess.entries.lockOf(file(FILES_APP)), { text: 'gfs.needsFullAccess', hint: 'gfs.needsFullAccessHint' }, 'l\'accès complet passe avant tout, fichiers de GFS compris');
});

test('newTypes : un article par type que l\'app sait ouvrir ; grisé avec sa raison si l\'app n\'est pas là ; le nom de l\'app s\'ajoute quand il y en a plusieurs', () => {
  const one = host({ installed: { publipostage: { extensions: [] } } }).entries.newTypes();
  assert.ok(one.filter(entry => entry.app !== 'publipostage').every(entry => entry.greyed), 'les apps absentes sont grisées, jamais masquées');
  const mine = one.filter(entry => entry.app === 'publipostage');
  assert.deepEqual(mine.map(entry => [entry.type, entry.greyed]), [['document', false], ['grille', false], ['presentation', true], ['email', false], ['macro', false]], 'les présentations attendent l\'extension Diapositives');
  assert.ok(mine.filter(entry => !entry.greyed).every(entry => entry.hint === ''), 'une seule app installée : pas de nom d\'app sous l\'article');
  const grey = one.find(entry => entry.app === 'form');
  assert.ok(grey, 'Form+ est listé même sans être installé');
  assert.equal(grey.greyed, true);
  assert.equal(grey.family, null, 'un article grisé n\'a pas de couleur de famille');
  assert.equal(grey.reason, 'ex.lockedApp {"app":"Form+"}');
  assert.equal(grey.hint, 'ex.lockedApp {"app":"Form+"}');
  assert.equal(grey.focus, 'app:form');
  const two = host({ installed: { publipostage: { extensions: [] }, form: { extensions: [] } } }).entries.newTypes();
  assert.ok(two.filter(entry => entry.app === 'form' && !entry.greyed).every(entry => entry.hint === 'Form+'), 'plusieurs apps installées : le nom de l\'app sous l\'article');
  const canOpen = new Set(manifestsOfGfs().find(m => m.id === 'automation').actions.ouvrir || []);
  assert.equal(two.filter(entry => entry.app === 'automation').length, [...canOpen].length, 'seuls les types de `actions.ouvrir` sont proposés');
});

test('importTypes : un article par format, grisé tant que l\'app ne reçoit pas le fichier ; puis les PDF de GFS, puis l\'arrivée d\'un autre document', () => {
  const kept = { app: FILES_APP, label: 'PDF' };
  const other = { action: 'receive' };
  const ready = host({ installed: { publipostage: { extensions: ['diapositives'] } }, kept: [kept], other }).entries.importTypes();
  const formats = ready.filter(entry => entry.app === 'publipostage');
  assert.deepEqual(formats.map(entry => entry.valeur), ['excel', 'markdown', 'powerpoint', 'word']);
  assert.ok(formats.every(entry => !entry.greyed && Array.isArray(entry.extensions)), 'Publipostage+ reçoit les fichiers : rien de grisé');
  assert.deepEqual(ready.slice(-2), [kept, other], 'les formats que GFS garde, puis l\'arrivée d\'un partage, restent en fin de liste');
  const notYet = host({
    installed: { publipostage: { extensions: ['diapositives'] } },
    patch: { publipostage: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, importer: false } }) },
  }).entries.importTypes().filter(entry => entry.app === 'publipostage');
  assert.equal(notYet.length, 4);
  assert.ok(notYet.every(entry => entry.greyed && entry.reason === 'ex.import.notYet {"app":"Publipostage+"}' && entry.hint === 'ex.import.notYetHint' && !entry.focus), 'sans `ouverture.importer`, le format est grisé avec « pas encore » et rien à débloquer');
  const missing = host({ kept: [], other }).entries.importTypes().filter(entry => entry.app === 'publipostage');
  assert.ok(missing.every(entry => entry.greyed && entry.focus === 'app:publipostage'), 'l\'app absente : le clic ouvre la fenêtre des apps sur sa ligne');
});

test('readerOf : l\'app qui lit le PDF, son grisé, ou rien quand aucune app ne lit ce type', () => {
  const ready = host({ installed: { publipostage: { extensions: ['lecture-pdf'] } } }).entries.readerOf({ type: 'pdf' });
  assert.deepEqual(ready, { app: 'publipostage', name: 'Publipostage+', lock: null });
  const off = host({ installed: { publipostage: { extensions: [] } } }).entries.readerOf({ type: 'pdf' });
  assert.equal(off.app, 'publipostage');
  assert.equal(off.lock.focus, 'ext:publipostage/lecture-pdf', 'l\'extension éteinte : le clic ouvre sa ligne');
  const notYet = host({
    installed: { publipostage: { extensions: ['lecture-pdf'] } },
    patch: { publipostage: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, lire: false } }) },
  }).entries.readerOf({ type: 'pdf' });
  assert.deepEqual(notYet.lock, { text: 'files.read.notYet {"app":"Publipostage+"}' }, 'une app qui ne reçoit pas encore le fichier : « pas encore »');
  assert.equal(host({ installed: { publipostage: { extensions: [] } } }).entries.readerOf({ type: 'zip' }), null, 'aucune app ne lit ce type : le fichier se télécharge');
});
