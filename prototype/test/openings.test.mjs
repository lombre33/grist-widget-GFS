// Les ouvertures (js/openings.js, contrats 5.4) : ouvrir un fichier, créer un fichier vierge (« Nouveau »), importer, lire un fichier que GFS garde, et quitter l'app active pour une autre,
// face à un contrôleur joué par l'essai (`host`, qui note chaque appel). Ce que Grist et l'app envoient vraiment (le cadre, les messages, le sélecteur de fichier) se mesure dans un vrai Grist :
// labo/run-ouvrir.mjs, run-importer.mjs, run-fermer.mjs, run-lire.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Openings } from '../js/openings.js';
import { FILES_APP } from '../js/gfs-files.js';
import { OpenedFiles } from '../js/opened-files.js';
import { ERR } from '../js/filter.js';

const text = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const refusal = code => Object.assign(new Error('refus'), { code });

// `apps` : { id: { ouverture } } les apps qu'on peut activer. `session` : l'app active (id, closeApp, openFile…), ou rien.
function host({ apps = { form: { ouverture: { fichier: true, nouveau: true } }, publipostage: { ouverture: { fichier: true, nouveau: true, importer: true, lire: true } } }, session = null, contextServed = true, lock = null, kept = null, reader = null } = {}) {
  const calls = [];
  const notes = [];
  const c = {
    t: text, calls, notes, session, opened: new OpenedFiles(), opening: 'gardée', contextServed, explorer: { state: { path: 'Dossier' } }, doc: {},
    lockOf: file => { calls.push(['lockOf', file.id]); return lock; },
    unlock: async value => { calls.push(['unlock', value]); },
    appById: id => (apps[id] ? { app: { id }, manifest: apps[id] } : null),
    manifestOf: id => (id === FILES_APP ? { ouverture: {} } : (apps[id] || null)), appName: id => id.toUpperCase(),
    notice: note => notes.push(note), hideExplorer: () => calls.push(['hideExplorer']),
    openable: id => Boolean(apps[id]), isOpen: id => Boolean(c.session) && c.session.id === id,
    activate: (id, opening) => { calls.push(['activate', id, opening]); if (!apps[id]) return false; c.opening = opening; if (!c.isOpen(id)) c.session = { id, openFile: async () => ({ ouvert: true }) }; return true; },
    ask: async question => { calls.push(['ask', question.title]); return false; },
    readerOf: () => reader,
    kept: {
      has: file => Boolean(kept && kept.has === file.id), open: async file => calls.push(['kept.open', file.id]), load: async file => { calls.push(['kept.load', file.id]); return kept.bytes; },
      importFile: async entry => calls.push(['kept.importFile', entry.label]),
    },
    otherDocuments: { receive: async () => calls.push(['receive']) },
  };
  return { c, openings: new Openings(c) };
}
const sessionOf = (id, extra = {}) => ({ id, closeApp: async () => ({ ferme: true }), stayApp: async () => ({ repris: true }), openFile: async () => ({ ouvert: true }), ...extra });
const steps = (c, name) => c.calls.filter(([step]) => step === name);

test('openFile : le grisé s\'explique, un fichier que GFS garde passe par son lecteur, une app absente est dite, sinon l\'app s\'ouvre sur le fichier', async () => {
  const locked = host({ lock: { text: 'raison', focus: 'app:form' } });
  locked.openings.openFile({ id: 'f1', app: 'form' });
  assert.deepEqual(steps(locked.c, 'unlock'), [['unlock', { text: 'raison', focus: 'app:form' }]]);
  assert.equal(steps(locked.c, 'activate').length, 0, 'une ligne grisée n\'ouvre rien');

  const missing = host();
  missing.openings.openFile({ id: 'f1', app: 'inconnue' });
  assert.deepEqual(missing.c.notes, ['ex.notice.noApp']);

  const open = host();
  open.openings.openFile({ id: '7', app: 'form', type: 'formulaire' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(steps(open.c, 'activate'), [['activate', 'form', { fichier: { id: '7', type: 'formulaire' }, type: 'formulaire', dossier: 'Dossier', raison: 'explorateur' }]]);
  assert.equal(steps(open.c, 'hideExplorer').length, 1, 'l\'explorateur se referme sur l\'app');
  assert.deepEqual(open.c.notes, [], 'l\'app connaît l\'ouverture « fichier » : rien à dire');
});

test('openFile d\'un fichier que GFS garde : aucun lecteur, il se télécharge ; lecteur pas prêt, son grisé ; lecteur prêt, l\'app reçoit les octets (raison « lire »)', async () => {
  const download = host({ kept: { has: 'p1' } });
  download.openings.openFile({ id: 'p1', app: FILES_APP, type: 'pdf' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(steps(download.c, 'kept.open'), [['kept.open', 'p1']]);

  const waiting = host({ kept: { has: 'p1' }, reader: { app: 'publipostage', name: 'PUBLIPOSTAGE', lock: { text: 'éteinte', focus: 'ext:publipostage/lecture-pdf' } } });
  waiting.openings.openFile({ id: 'p1', app: FILES_APP, type: 'pdf' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(steps(waiting.c, 'unlock'), [['unlock', { text: 'éteinte', focus: 'ext:publipostage/lecture-pdf' }]]);
  assert.equal(steps(waiting.c, 'kept.load').length, 0, 'les octets ne se chargent pas pour une app qui ne peut pas lire');

  const ready = host({ kept: { has: 'p1', bytes: new Uint8Array([1, 2]) }, reader: { app: 'publipostage', name: 'PUBLIPOSTAGE', lock: null } });
  ready.openings.openFile({ id: 'p1', app: FILES_APP, type: 'pdf' });
  await new Promise(resolve => setImmediate(resolve));
  const [, , opening] = steps(ready.c, 'activate')[0];
  assert.equal(opening.raison, 'lire');
  assert.equal(opening.lecture.id, 'p1');
  assert.equal(opening.dossier, 'Dossier');
});

test('openNew : l\'article grisé dit sa raison (ou son rappel) ; sinon l\'app s\'ouvre sur un fichier vierge du type', async () => {
  const grey = host();
  grey.openings.openNew({ greyed: true, reason: '', hint: 'Pas là', focus: 'app:form' });
  assert.deepEqual(steps(grey.c, 'unlock'), [['unlock', { text: 'Pas là', focus: 'app:form' }]]);
  const fresh = host();
  fresh.openings.openNew({ app: 'form', type: 'formulaire' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(steps(fresh.c, 'activate'), [['activate', 'form', { fichier: null, type: 'formulaire', dossier: 'Dossier', raison: 'nouveau' }]]);
});

test('importFile : l\'arrivée d\'un autre document, les formats que GFS garde et le grisé passent avant le sélecteur de fichier', async () => {
  const { c, openings } = host();
  await openings.importFile({ action: 'receive' });
  await openings.importFile({ app: FILES_APP, label: 'PDF' });
  await openings.importFile({ app: 'form', greyed: true, reason: 'pas encore', hint: 'indice', focus: null });
  assert.deepEqual(c.calls, [['receive'], ['kept.importFile', 'PDF'], ['unlock', { text: 'pas encore', focus: null }]]);
});

test('openIn : une app qui connaît l\'ouverture la reçoit par `ouvrir` ; une app qui ne la connaît pas voit la phrase provisoire ; le fichier part une seule fois', async () => {
  const running = host({ session: sessionOf('publipostage') });
  const answers = [];
  running.c.session.openFile = async opening => { answers.push(opening.raison); return { ouvert: true }; };
  assert.equal(await running.openings.openIn('publipostage', { fichier: { id: '1', type: 'document' }, type: 'document', raison: 'explorateur' }, 'ex.notice.open'), true);
  assert.deepEqual(answers, ['explorateur'], 'l\'app déjà ouverte reçoit l\'appel `ouvrir`, pas un nouveau contexte');

  const cancelled = host({ session: sessionOf('publipostage', { openFile: async () => ({ ouvert: false }) }) });
  assert.equal(await cancelled.openings.openIn('publipostage', { fichier: { id: '1', type: 'document' }, type: 'document', raison: 'explorateur' }, 'ex.notice.open'), false, 'la personne a annulé dans l\'app');

  const unknown = host({ session: sessionOf('publipostage', { openFile: async () => { throw refusal(ERR.INCONNU); } }) });
  assert.equal(await unknown.openings.openIn('publipostage', { fichier: null, type: 'document', raison: 'nouveau' }, 'ex.notice.new'), false);
  assert.deepEqual(unknown.c.notes, ['ex.notice.new {"app":"PUBLIPOSTAGE"}'], 'une app qui ne connaît pas l\'appel : la phrase provisoire');

  const replaced = host({ session: sessionOf('publipostage') });
  replaced.c.session.openFile = async () => { replaced.c.session = null; throw refusal(ERR.INCONNU); };
  assert.equal(await replaced.openings.openIn('publipostage', { fichier: null, type: 'document', raison: 'nouveau' }, 'ex.notice.new'), false);
  assert.deepEqual(replaced.c.notes, [], 'l\'app a été fermée pendant l\'attente : plus rien à dire');

  const failed = host({ session: sessionOf('publipostage', { openFile: async () => { throw Object.assign(new Error('x'.repeat(200)), { code: 'AUTRE' }); } }) });
  await failed.openings.openIn('publipostage', { fichier: null, type: 'document', raison: 'nouveau' }, 'ex.notice.new');
  assert.equal(failed.c.notes.length, 1);
  assert.match(failed.c.notes[0], /^ex\.notice\.openFailed /);
  assert.ok(failed.c.notes[0].length < 220, 'l\'erreur de l\'app est dite, coupée à 120 signes');

  const silent = host({ apps: { form: {} } });
  assert.equal(await silent.openings.openIn('form', { fichier: null, type: 'formulaire', raison: 'nouveau' }, 'ex.notice.new'), true, 'une app qui démarre reçoit l\'ouverture dans son contexte');
  assert.deepEqual(silent.c.notes, ['ex.notice.new {"app":"FORM"}'], 'l\'app ne déclare pas `ouverture.nouveau` : GFS le dit');

  const none = host();
  assert.equal(await none.openings.openIn('inconnue', { fichier: null, type: 'x', raison: 'nouveau' }, 'ex.notice.new'), false, 'une app qu\'on ne peut pas activer');
  assert.equal(steps(none.c, 'hideExplorer').length, 0);

  const withFile = host({ session: sessionOf('publipostage') });
  const importation = { fichier: null, type: 'grille', raison: 'importer', importation: { valeur: 'excel' } };
  await withFile.openings.openIn('publipostage', importation, 'ex.notice.import');
  assert.equal(withFile.c.opening, null, 'le fichier part une seule fois : l\'ouverture gardée est vidée');
});

test('Ouverts : un fichier que l\'app a ouvert entre dans la liste et c\'est lui qu\'elle affiche ; un refus, une app qui ne connaît pas l\'appel ou un fichier vierge n\'y mettent rien', async () => {
  const one = { fichier: { id: '1', type: 'document' }, type: 'document', raison: 'explorateur' };
  const running = host({ session: sessionOf('publipostage') });
  const first = running.c.session;
  await running.openings.openIn('publipostage', one, 'ex.notice.open');
  assert.deepEqual(running.c.opened.keys(), ['publipostage:1']);
  assert.equal(running.c.opened.shown(first), 'publipostage:1', 'l\'app affiche le fichier que GFS vient de lui donner');
  await running.openings.openIn('publipostage', { ...one, fichier: { id: '2', type: 'document' } }, 'ex.notice.open');
  assert.deepEqual(running.c.opened.keys(), ['publipostage:1', 'publipostage:2']);
  assert.equal(running.c.opened.shown(first), 'publipostage:2');

  await running.openings.openIn('publipostage', { fichier: null, type: 'document', raison: 'nouveau' }, 'ex.notice.new');
  assert.equal(running.c.opened.shown(first), null, 'un fichier vierge n\'est pas dans la liste : l\'app n\'affiche plus aucun fichier ouvert');
  assert.deepEqual(running.c.opened.keys(), ['publipostage:1', 'publipostage:2'], 'la liste garde ce qu\'elle avait');

  const cancelled = host({ session: sessionOf('publipostage', { openFile: async () => ({ ouvert: false }) }) });
  await cancelled.openings.openIn('publipostage', one, 'ex.notice.open');
  assert.deepEqual(cancelled.c.opened.keys(), [], 'la personne a annulé dans l\'app : rien n\'a été ouvert');

  const unknown = host({ session: sessionOf('publipostage', { openFile: async () => { throw refusal(ERR.INCONNU); } }) });
  await unknown.openings.openIn('publipostage', one, 'ex.notice.open');
  assert.deepEqual(unknown.c.opened.keys(), [], 'une app qui ne connaît pas l\'appel n\'a pas ouvert le fichier');

  const silent = host({ apps: { form: {} } });
  await silent.openings.openIn('form', { ...one, type: 'formulaire' }, 'ex.notice.open');
  assert.deepEqual(silent.c.opened.keys(), [], 'l\'app ne déclare pas `ouverture.fichier` : elle ne l\'ouvre pas');

  const fresh = host({ apps: { form: { ouverture: { fichier: true } } } });
  await fresh.openings.openIn('form', { fichier: { id: '9', type: 'formulaire' }, type: 'formulaire', raison: 'lien' }, 'ex.notice.open');
  assert.deepEqual(fresh.c.opened.keys(), ['form:9'], 'une app qui démarre reçoit le fichier dans son contexte : il est ouvert');
  assert.equal(fresh.c.opened.shown(fresh.c.session), 'form:9');
});

test('Ouverts : un fichier que GFS garde et fait lire entre dans la liste sous sa clé ; sans lecteur prêt, rien n\'y entre', async () => {
  const bytes = new Uint8Array([1]);
  const reading = host({ kept: { has: 'p1', bytes }, reader: { app: 'publipostage', lock: null } });
  reading.openings.openFile({ id: 'p1', key: `${FILES_APP}:p1`, app: FILES_APP, name: 'Facture.pdf', type: 'pdf' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(reading.c.opened.keys(), [`${FILES_APP}:p1`]);
  assert.equal(reading.c.opened.shown(reading.c.session), `${FILES_APP}:p1`);

  const locked = host({ kept: { has: 'p1', bytes }, reader: { app: 'publipostage', lock: { text: 'pas prêt' } } });
  locked.openings.openFile({ id: 'p1', key: `${FILES_APP}:p1`, app: FILES_APP, name: 'Facture.pdf', type: 'pdf' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(locked.c.opened.keys(), []);
});

test('leave : rien à demander sans app active, pour la même app, sans contexte lu ou pour une app qu\'on ne peut pas activer', async () => {
  assert.equal(await host().openings.leave('app', 'form'), true);
  assert.equal(await host({ session: sessionOf('form') }).openings.leave('app', 'form'), true);
  assert.equal(await host({ session: sessionOf('form'), contextServed: false }).openings.leave('app', 'publipostage'), true);
  const absent = host({ session: sessionOf('form') });
  assert.equal(await absent.openings.leave('app', 'inconnue'), true);
  assert.equal(steps(absent.c, 'hideExplorer').length, 0, 'aucun geste quand rien n\'est demandé');
});

test('leave : l\'app active est priée de se fermer, derrière l\'explorateur refermé ; elle part si la personne n\'a rien fait d\'autre', async () => {
  const stays = host({ session: sessionOf('form', { closeApp: async () => ({ ferme: false }) }) });
  assert.equal(await stays.openings.leave('ouvrir', 'publipostage'), false, 'l\'app a dit non : la personne reste');
  assert.equal(steps(stays.c, 'hideExplorer').length, 1, 'l\'explorateur se referme pour que la question de l\'app se voie');

  const goes = host({ session: sessionOf('form') });
  assert.equal(await goes.openings.leave('ouvrir', 'publipostage'), true);

  const moved = host({ session: sessionOf('form') });
  moved.c.session.closeApp = async () => { moved.openings.moved(); return { ferme: true }; };
  assert.equal(await moved.openings.leave('ouvrir', 'publipostage'), false, 'la personne a fait autre chose (`moved`) pendant l\'attente : l\'app reste');

  const gone = host({ session: sessionOf('form') });
  gone.c.session.closeApp = async () => { gone.c.session = null; return { ferme: true }; };
  assert.equal(await gone.openings.leave('ouvrir', 'publipostage'), false, 'l\'app a été fermée entre-temps : plus personne à qui parler');
});
