// Ce que l'explorateur demande au contrôleur (js/broker/entries.js) : le grisé et sa raison, les types de « Nouveau », les formats d'« Importer », l'app qui lit un fichier que GFS garde.
// Un contrôleur joué par l'essai (`host`) : les manifestes sont les quatre de GFS, lus tels quels. Ce que l'explorateur en fait à l'écran se mesure dans un vrai Grist (labo/run-ouvrir.mjs, run-importer.mjs, run-lire.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entries } from '../js/broker/entries.js';
import { readCatalogue } from '../js/apps/libraries.js';
import { FILES_APP, filesManifest } from '../js/files/gfs-files.js';
import { parseCatalogue } from '../js/apps/templates-catalogue.js';
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
    manifestOf: id => (id === FILES_APP ? filesManifest() : byId.get(id) || null), appName: id => (byId.get(id) ? byId.get(id).nom.fr : id),
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

test('personTargets : les apps dont le manifeste dit où elles posent une personne ; grisées tant qu\'elles ne sont pas prêtes (app à installer) ou que `ouverture.personne` manque', () => {
  const inserer = { fr: 'destinataire d\'un envoi', en: 'recipient of a mailing' };
  const patch = { publipostage: manifest => ({ ...manifest, actions: { ...manifest.actions, personnes: { choisir: true, inserer } }, ouverture: { ...manifest.ouverture, personne: true } }),
    form: manifest => ({ ...manifest, actions: { ...manifest.actions, personnes: { inserer: { fr: 'liste de choix', en: 'choice list' } } } }) };
  const { entries } = host({ installed: { publipostage: { extensions: [] }, form: { extensions: [] } }, patch });
  const targets = entries.personTargets();
  assert.deepEqual(targets.map(target => target.id), ['publipostage', 'form'], 'seules les apps qui déclarent `actions.personnes.inserer`');
  assert.deepEqual(targets[0], { id: 'publipostage', name: 'Publipostage+', where: 'destinataire d\'un envoi', lock: '', focus: null, ready: true });
  assert.equal(targets[1].ready, false, 'Form+ dit où elle poserait une personne, mais ne déclare pas encore `ouverture.personne`');
  assert.equal(targets[1].where, 'liste de choix');
  const missing = host({ installed: { publipostage: { extensions: [] } }, patch }).entries.personTargets().find(target => target.id === 'form');
  assert.equal(missing.lock, 'ex.lockedApp {"app":"Form+"}', 'une app à installer : grisée, avec sa raison');
  assert.equal(missing.focus, 'app:form', 'et la ligne de la fenêtre « Apps et extensions » qui la débloque');
  const noAccess = host({ fullAccess: false, installed: { publipostage: { extensions: [] } }, patch }).entries.personTargets()[0];
  assert.equal(noAccess.lock, 'gfs.needsFullAccess', 'sans l\'accès complet, tout est grisé');
  assert.deepEqual(host({}).entries.personTargets(), [], 'aucune app ne déclare rien : le menu dit « Aucune app… »');
});

test('newTypes : un article par type que l\'app sait ouvrir ; grisé avec sa raison si l\'app n\'est pas là ; le nom de l\'app s\'ajoute quand il y en a plusieurs', () => {
  const one = host({ installed: { publipostage: { extensions: [] } } }).entries.newTypes();
  assert.ok(one.filter(entry => entry.app !== 'publipostage' && entry.kind !== 'annuaire' && entry.kind !== 'guide').every(entry => entry.greyed), 'les apps absentes sont grisées, jamais masquées');
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

test('newTypes : « Annuaire » puis « Guide » sont les derniers articles, les modules de GFS (aucune app à installer) ; grisé seulement sans l\'accès complet', () => {
  const entries = host({ installed: { publipostage: { extensions: [] } } }).entries.newTypes();
  const last = entries.at(-2);
  assert.deepEqual([last.kind, last.app, last.type, last.icon, last.family, last.greyed, last.label, last.hint], ['annuaire', 'gfs-annuaires', 'annuaire', 'annuaire', 'annuaire', false,
    'Annuaire', 'an.newMenuHint'], 'aucune app installée n\'y change rien : un seul article, sans nom d\'app');
  assert.equal(entries.filter(entry => entry.kind === 'annuaire').length, 1);
  assert.deepEqual([entries.at(-1).kind, entries.at(-1).app, entries.at(-1).family, entries.at(-1).greyed], ['guide', 'gfs-guides', 'guide', false]);
  assert.equal(host({}).entries.newTypes().at(-2).greyed, false, 'même sans aucune app');
  const noAccess = host({ installed: { publipostage: { extensions: [] } }, fullAccess: false }).entries.newTypes().at(-2);
  assert.equal(noAccess.greyed, true, 'sans l\'accès complet, il est grisé comme tout le reste, avec sa raison');
  assert.equal(noAccess.reason, 'gfs.needsFullAccess');
  assert.equal(noAccess.family, null);
});

test('importTypes : un article par format, grisé tant que l\'app ne reçoit pas le fichier ; puis les PDF de GFS, puis l\'arrivée d\'un autre document', () => {
  const kept = { app: FILES_APP, label: 'PDF' };
  const other = { action: 'receive' };
  const ready = host({ installed: { publipostage: { extensions: ['diapositives'] } }, kept: [kept], other }).entries.importTypes();
  const formats = ready.filter(entry => entry.app === 'publipostage');
  assert.deepEqual(formats.map(entry => entry.valeur), ['excel', 'markdown', 'powerpoint', 'word', 'html', 'opendocument']);
  assert.ok(formats.every(entry => !entry.greyed && Array.isArray(entry.extensions)), 'Publipostage+ reçoit les fichiers : rien de grisé');
  assert.deepEqual(ready.slice(-2), [kept, other], 'les formats que GFS garde, puis l\'arrivée d\'un partage, restent en fin de liste');
  const notYet = host({
    installed: { publipostage: { extensions: ['diapositives'] } },
    patch: { publipostage: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, importer: false } }) },
  }).entries.importTypes().filter(entry => entry.app === 'publipostage');
  assert.equal(notYet.length, 6);
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

test('readerOf : un fichier REÇU dont le type n\'est pas celui de GFS n\'ouvre aucune app (le type est écrit par l\'envoyeur) ; un PDF reçu se lit comme un PDF de GFS', () => {
  const installed = { publipostage: { extensions: ['lecture-pdf'] } };
  assert.equal(host({ installed }).entries.readerOf({ type: 'pdf', known: false, received: { state: 'accepted' } }), null, 'type inconnu de GFS : téléchargement seulement');
  assert.deepEqual(host({ installed }).entries.readerOf({ type: 'pdf', known: true, received: { state: 'accepted' } }), { app: 'publipostage', name: 'Publipostage+', lock: null });
});

// La galerie « Depuis un modèle » (contrats 5.4, point 13) : les apps lues avec leurs modèles (`loaded`, js/apps/templates-control.js), les articles qui en sortent.
// `only` : les apps dont on lit le catalogue (Publipostage+ seule par défaut : les essais de grisé ne regardent que ses modèles, Form+ et Grist-BI ont les leurs plus bas).
const loadedOf = (manifests, states = {}, only = ['publipostage']) => manifests.map(manifest => {
  if (!manifest.modeles || !only.includes(manifest.id)) return { manifest, models: [], state: states[manifest.id] || 'soon', reason: '' };
  const { models } = parseCatalogue(readJson(`modeles/${manifest.modeles.catalogue}`), manifest);
  return { manifest, models, state: 'ok', reason: '' };
});
const canOpenModels = { publipostage: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, modele: true } }) };
const templatesOf = (options, lang = 'fr', only) => {
  const { c, entries } = host(options);
  c.lang = lang;
  return entries.templates(loadedOf(c.manifests(), {}, only));
};

test('templates : une pastille par app (« bientôt » pour celles sans catalogue) et un article par modèle, avec le nom, le type et l\'app dans la langue de la personne', () => {
  const { apps, models } = templatesOf({ installed: { publipostage: { extensions: ['diapositives', 'graphique'] } }, patch: canOpenModels });
  assert.deepEqual(apps.map(app => [app.id, app.state, app.count]), [['publipostage', 'ok', 22], ['automation', 'soon', 0], ['form', 'soon', 0], ['bi', 'soon', 0]], 'les apps sans modèle gardent leur pastille');
  assert.equal(apps[0].name, 'Publipostage+');
  assert.equal(models.length, 22);
  const invoice = models.find(model => model.id === 'facture');
  assert.deepEqual([invoice.app, invoice.type, invoice.greyed, invoice.reason, invoice.focus, invoice.tables], ['publipostage', 'document', false, '', null, true]);
  assert.deepEqual([invoice.label, invoice.typeLabel, invoice.appLabel, invoice.tags, invoice.thumb], ['Facture, devis ou avoir', 'Document', 'Publipostage+', ['Vente'], 'modeles/publipostage/facture.webp']);
  assert.equal(invoice.family, 'doc', 'la famille de couleur est celle du type, comme dans « Nouveau »');
  const english = templatesOf({ installed: { publipostage: { extensions: ['diapositives', 'graphique'] } }, patch: canOpenModels }, 'en').models.find(model => model.id === 'facture');
  assert.deepEqual([english.label, english.tags], ['Invoice, quote or credit note', ['Sales']]);
});

test('templates : grisé, jamais masqué, avec la raison et la ligne qui débloque : accès, app à installer, extension du type, extension du modèle, app qui ne sait pas encore', () => {
  const ready = { publipostage: { extensions: ['diapositives', 'graphique'] } };
  const find = (models, id) => models.find(model => model.id === id);
  const noAccess = templatesOf({ fullAccess: false, installed: ready, patch: canOpenModels }).models;
  assert.ok(noAccess.every(model => model.greyed && model.reason === 'gfs.needsFullAccess'), 'sans l\'accès complet, tout est grisé');
  const absent = templatesOf({ installed: {}, patch: canOpenModels }).models;
  assert.ok(absent.every(model => model.greyed && model.reason === 'ex.lockedApp {"app":"Publipostage+"}' && model.focus === 'app:publipostage'), 'l\'app absente : sa ligne de la fenêtre des apps');
  const noSlides = templatesOf({ installed: { publipostage: { extensions: ['graphique'] } }, patch: canOpenModels }).models;
  const slides = find(noSlides, 'proposition-commerciale');
  assert.deepEqual([slides.greyed, slides.focus], [true, 'ext:publipostage/diapositives'], 'l\'extension du type d\'abord');
  assert.match(slides.reason, /^ex\.lockedExtension /);
  assert.equal(find(noSlides, 'facture').greyed, false, 'un modèle sans extension reste libre');
  const noChart = templatesOf({ installed: { publipostage: { extensions: ['diapositives'] } }, patch: canOpenModels }).models;
  assert.deepEqual([find(noChart, 'proposition-commerciale').greyed, find(noChart, 'proposition-commerciale').focus], [true, 'ext:publipostage/graphique'], 'puis celle que le modèle demande en plus');
  const notYet = templatesOf({ installed: ready, patch: { publipostage: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, modele: false } }) } }).models;
  assert.ok(notYet.every(model => model.greyed && model.reason === 'ex.template.notYet {"app":"Publipostage+"}' && !model.focus), 'sans `ouverture.modele` : « pas encore », rien à débloquer ici');
  assert.equal(templatesOf({ installed: ready, patch: canOpenModels }).models.filter(model => model.greyed).length, 0, 'tout est prêt : rien de grisé');
});

// Les trois catalogues livrés le 18/11 (Publipostage+ 22, Form+ 5, Grist-BI 3) : chaque app ouvre ses modèles selon SON type, Automation+ garde sa pastille « bientôt ».
const canOpenAll = { publipostage: canOpenModels.publipostage, form: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, modele: true } }),
  bi: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, modele: true } }) };
test('templates : Publipostage+, Form+ et Grist-BI livrent chacune leur catalogue, ouvert par le type de l\'app ; une app absente grise ses seuls modèles', () => {
  const all = ['publipostage', 'form', 'bi'];
  const ready = { publipostage: { extensions: ['diapositives', 'graphique'] }, form: { extensions: [] }, bi: { extensions: [] } };
  const { apps, models } = templatesOf({ installed: ready, patch: canOpenAll }, 'fr', all);
  assert.deepEqual(apps.map(app => [app.id, app.state, app.count]), [['publipostage', 'ok', 22], ['automation', 'soon', 0], ['form', 'ok', 5], ['bi', 'ok', 3]]);
  assert.equal(models.length, 30);
  assert.equal(models.filter(model => model.greyed).length, 0, 'les trois apps savent ouvrir un modèle : rien de grisé');
  assert.deepEqual([...new Set(models.filter(model => model.app === 'form').map(model => model.type))], ['formulaire']);
  assert.deepEqual([...new Set(models.filter(model => model.app === 'bi').map(model => model.type))], ['rapport']);
  assert.ok(models.filter(model => model.app === 'form').every(model => model.tables), 'les modèles de Form+ viennent avec leurs tables');
  assert.ok(models.filter(model => model.app === 'bi').every(model => !model.tables), 'ceux de Grist-BI n\'en créent aucune');
  const noForm = templatesOf({ installed: { publipostage: ready.publipostage, bi: ready.bi }, patch: canOpenAll }, 'fr', all).models;
  const form = noForm.filter(model => model.app === 'form');
  assert.ok(form.length === 5 && form.every(model => model.greyed && model.focus === 'app:form' && model.reason === 'ex.lockedApp {"app":"Form+"}'), 'Form+ absente : ses cinq modèles grisés, avec sa ligne');
  assert.ok(noForm.filter(model => model.app !== 'form').every(model => !model.greyed), 'les autres apps ne sont pas touchées');
});

// Automation+ n'a aucun type de fichier (un automatisme est une ligne de sa table) : son manifeste déclare `modeles.type`, et ses cinq modèles prennent ce type (choix du porteur,
// 18/11, « L'app demande »). Depuis le 19/11 son manifeste déclare aussi `ouverture.modele` (l'app 0.15.4 ouvre le modèle, mesuré dans un vrai Grist) : ils sont libres. Sans cette ligne
// (une app qui ne saurait pas encore les ouvrir), ils resteraient grisés « pas encore ».
test('templates : les modèles d\'Automation+ (une app sans type de fichier) prennent le type que son manifeste déclare ; libres depuis `ouverture.modele`, grisés « pas encore » sans elle', () => {
  const only = ['automation'];
  const installed = { automation: { extensions: [] } };
  const without = { automation: manifest => ({ ...manifest, ouverture: { ...manifest.ouverture, modele: false } }) };
  const french = templatesOf({ installed, patch: without }, 'fr', only);
  assert.deepEqual(french.apps.find(app => app.id === 'automation'), { id: 'automation', name: 'Automation+', state: 'ok', reason: '', count: 5 });
  assert.equal(french.models.length, 5);
  assert.ok(french.models.every(model => model.app === 'automation' && model.type === 'automatisme' && model.icon === 'bolt' && model.typeLabel === 'Automatisme'
    && model.family === null && !model.tables), 'le type, son icône et son mot vont ensemble ; aucun modèle ne vient avec des tables');
  assert.ok(french.models.every(model => model.greyed && model.reason === 'ex.template.notYet {"app":"Automation+"}' && !model.focus), 'sans `ouverture.modele` : « pas encore »');
  assert.equal(templatesOf({ installed, patch: without }, 'en', only).models[0].typeLabel, 'Automation');
  const real = templatesOf({ installed }, 'fr', only).models;
  assert.equal(real.length, 5);
  assert.equal(real.filter(model => model.greyed).length, 0, 'le manifeste de GFS dit que l\'app ouvre un modèle (19/11) : rien n\'est grisé');
  const absent = templatesOf({ installed: {} }, 'fr', only).models;
  assert.ok(absent.every(model => model.greyed && model.focus === 'app:automation' && model.reason === 'ex.lockedApp {"app":"Automation+"}'), 'app non installée : sa ligne dans « Apps et extensions »');
});

test('templates : un catalogue illisible garde la pastille de l\'app, avec son état', () => {
  const { c, entries } = host({ installed: { publipostage: { extensions: [] } } });
  const manifests = c.manifests();
  const loaded = manifests.map(manifest => (manifest.id === 'publipostage' ? { manifest, models: [], state: 'broken', reason: 'modeles/publipostage/modeles.json : 404' } : { manifest, models: [], state: 'soon', reason: '' }));
  const { apps, models } = entries.templates(loaded);
  assert.deepEqual(apps.find(app => app.id === 'publipostage'), { id: 'publipostage', name: 'Publipostage+', state: 'broken', reason: 'modeles/publipostage/modeles.json : 404', count: 0 });
  assert.deepEqual(models, []);
});
