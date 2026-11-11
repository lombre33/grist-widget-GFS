// Une app qui ne répond pas (js/broker/session.js, contrats 1.4, point 2) : GFS attend 15 secondes son site en ligne, ouvre sa copie figée, attend 15 secondes de plus, puis renonce.
// Le porteur a vu (04/11) « Form+ ne répond pas. » et rouvrir l'app ne la relançait pas : une session qui a renoncé le dit (`gaveUp`), et le contrôleur ne la réutilise plus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppSession } from '../js/broker/session.js';
import { CATALOGUE } from '../js/apps/catalogue.js';
import { form, publipostage, catalogue } from './helpers.mjs';
import { isGfsWarning, isSilentProbeWarning } from '../labo/sondes-muettes.mjs';

const DELAY = 15000;
const MSG_READY = { mtype: 5 };
// Les deux délais de suite (le site en ligne, puis la copie figée) : le second ne démarre que quand le premier est écoulé, d'où deux pas.
const waitBoth = t => { t.mock.timers.tick(DELAY); t.mock.timers.tick(DELAY); };

// Un cadre et une page réduits à ce que la session en demande ; les cadres créés sont gardés pour lire leur adresse.
function fakeFrame() {
  const classes = new Set();
  return {
    className: '', title: '', src: '', removed: false, contentWindow: { postMessage() {} },
    setAttribute() {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) },
    remove() { this.removed = true; },
  };
}

function setup(t, { live = true, probe = false, publi = false, extra = {} } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => { warnings.push(args.join(' ')); });
  const frames = [];
  globalThis.document = { createElement: () => { const frame = fakeFrame(); frames.push(frame); return frame; } };
  t.after(() => { delete globalThis.document; });
  const events = [];
  const route = { handler: null, setActive(win, handler) { this.handler = handler; }, clearActive() {} };
  const session = new AppSession({
    entry: probe ? { id: 'sonde-o', dossier: 'labo/sondes/o-ouvrir/', manifeste: 'labo/sondes/sonde-o.json' } : CATALOGUE.find(item => item.id === (publi ? 'publipostage' : 'form')),
    manifest: probe ? { ...form(), id: 'sonde-o' } : publi ? publipostage() : form(), catalogue: catalogue(),
    state: { grantedAccess: 'full', subscribe: () => () => {} }, port: {}, router: route, container: { append() {} },
    readonly: false, preferences: {}, base: 'https://exemple.github.io/grist-widget-GFS/prototype/index.html', live, lang: 'fr',
    onStatus: kind => events.push(kind), envelopeHandlers: () => ({}), ...extra,
  });
  session.open();
  return { session, frames, events, route, warnings };
}

test('une app muette : au premier délai GFS ouvre la copie figée, au second il renonce, et la session le dit', t => {
  const { session, frames, events } = setup(t);
  assert.deepEqual(events, ['loading']);
  assert.equal(session.gaveUp, false);
  assert.match(frames[0].src, /\/FormPlus\/poc\/widget\.html/);
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'fallback']);
  assert.equal(session.source, 'pinned');
  assert.match(frames[0].src, /\/apps\/form\/poc\/widget\.html/, 'le même cadre ouvre la copie figée');
  assert.equal(session.gaveUp, false, 'la copie a encore son délai');
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'fallback', 'timeout']);
  assert.equal(session.gaveUp, true);
});

test('une app sans copie à ouvrir (live=0) renonce dès le premier délai', t => {
  const { session, events } = setup(t, { live: false });
  t.mock.timers.tick(DELAY);
  assert.deepEqual(events, ['loading', 'timeout']);
  assert.equal(session.gaveUp, true);
});

test('une app qui finit par répondre après avoir renoncé n\'a plus renoncé', t => {
  const { session, events, route } = setup(t);
  waitBoth(t);
  assert.equal(session.gaveUp, true);
  route.handler(MSG_READY); // le `ready` de son script d'API, arrivé tard
  assert.equal(session.isReady, true);
  assert.equal(session.gaveUp, false);
  assert.equal(events.at(-1), 'ready');
});

test('une app prête dans le délai ne renonce jamais', t => {
  const { session, events, route } = setup(t);
  t.mock.timers.tick(5000);
  route.handler(MSG_READY);
  waitBoth(t);
  assert.deepEqual(events, ['loading', 'ready']);
  assert.equal(session.gaveUp, false);
});

test('une session fermée ne renonce pas après coup, et le cadre est retiré', t => {
  const { session, frames, events } = setup(t);
  session.close();
  waitBoth(t);
  assert.deepEqual(events, ['loading']);
  assert.equal(frames[0].removed, true);
});

test('GFS dit dans la console où il a attendu, sans l\'adresse de recherche : la cause est dans la console du cadre de l\'app', t => {
  const { warnings } = setup(t);
  waitBoth(t);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^GFS : form : pas de « prête » en 15 s sur le site en ligne \(https:\/\/exemple\.github\.io\/FormPlus\/poc\/widget\.html\)$/);
  assert.match(warnings[1], /^GFS : form : pas de « prête » en 15 s sur la copie figée \(https:\/\/exemple\.github\.io\/grist-widget-GFS\/prototype\/apps\/form\/poc\/widget\.html\)$/);
});

// Les passes du labo comptent les avertissements de GFS (« aucun avertissement de GFS »). Une sonde qui se tait par construction (labo/sondes/) provoque celui-là sans que GFS y soit pour rien : il ne
// compte pas (labo/sondes-muettes.mjs). Celui d'une vraie app, et tout autre avertissement, comptent toujours.
test('l\'attente d\'une sonde muette du labo n\'est pas comptée par les passes du labo (l\'avertissement est celui que GFS écrit)', t => {
  const { warnings } = setup(t, { probe: true });
  waitBoth(t);
  assert.equal(warnings.length, 1, 'une sonde n\'a pas de site en ligne : un seul délai');
  assert.match(warnings[0], /^GFS : sonde-o : pas de « prête » en 15 s sur la copie figée \(/);
  assert.equal(isSilentProbeWarning(warnings[0]), true);
  assert.equal(isGfsWarning(warnings[0]), false);
});

test('l\'attente d\'une vraie app, et tout autre avertissement de GFS, sont toujours comptés par les passes du labo', t => {
  const { warnings } = setup(t);
  waitBoth(t);
  assert.equal(warnings.length, 2);
  for (const text of warnings) assert.equal(isGfsWarning(text), true, text);
  assert.equal(isGfsWarning('GFS : sonde-o : contexte.lire refusé (GFS_REFUSE) : accès'), true, 'un autre avertissement d\'une sonde compte');
  assert.equal(isGfsWarning('Failed to load resource'), false, 'ce qui ne vient pas de GFS ne compte pas');
});

// Un fichier qui tient à plus qu'une ligne (contrats 5.4, points 10 et 11) : GFS demande à l'app ouverte de le fermer ou de le copier ; l'appel part par l'enveloppe, la réponse revient par elle.
test('`supprimer` et `dupliquer` partent dans l\'enveloppe de GFS vers l\'app, et la réponse (ou l\'erreur) de l\'app revient à l\'appelant', async t => {
  const { session, frames, route } = setup(t);
  const sent = [];
  frames[0].contentWindow.postMessage = message => sent.push(message);
  const body = { fichier: { id: '7', type: 'formulaire' }, raison: 'corbeille' };
  const deleting = session.deleteFile(body);
  assert.deepEqual(sent[0], { gfs: 0, type: 'appel', id: 1, nom: 'supprimer', args: body });
  route.handler({ gfs: 0, type: 'reponse', id: 1, data: { fait: true } });
  assert.deepEqual(await deleting, { fait: true });
  const copying = session.copyFile({ fichier: { id: '7', type: 'formulaire' }, nom: 'Inscription (1)' });
  assert.deepEqual(sent[1], { gfs: 0, type: 'appel', id: 2, nom: 'dupliquer', args: { fichier: { id: '7', type: 'formulaire' }, nom: 'Inscription (1)' } });
  route.handler({ gfs: 0, type: 'erreur', id: 2, code: 'GFS_INCONNU', message: 'inconnu' });
  await assert.rejects(copying, { code: 'GFS_INCONNU', message: 'inconnu' });
});

// L'annonce d'ouverture de l'événement `reglages` (contrats 7.3, point 5) : une app qui rappelle « Enregistrer » ne sait rien avant son premier réglage ; GFS lui dit d'avance, sans rien écrire,
// ce que deviendront ses réglages de vue. Le faux `viewOptions` ne rend que ce que `expect()` rend ; la lecture de la section se vérifie dans view-options.test.mjs.
const announce = async (t, expected, options = {}) => {
  const viewOptions = { expect: () => Promise.resolve(expected) };
  const { session, frames } = setup(t, { publi: true, extra: { viewOptions, ...options } });
  const sent = [];
  frames[0].contentWindow.postMessage = message => sent.push(message);
  session.announceSaved();
  await Promise.resolve();
  await Promise.resolve();
  return { session, sent };
};
const reglages = enregistres => ({ gfs: 0, type: 'evenement', nom: 'reglages', data: { enregistres } });

test('l\'annonce d\'ouverture : GFS dit « enregistres: true » avant tout réglage, quand ils iront dans la vue', async t => {
  const { sent } = await announce(t, true);
  assert.deepEqual(sent, [reglages(true)]);
});

test('l\'annonce d\'ouverture : GFS dit aussi « enregistres: false » quand il sait qu\'il se repliera sur le brouillon', async t => {
  const { sent } = await announce(t, false);
  assert.deepEqual(sent, [reglages(false)]);
});

test('l\'annonce d\'ouverture : quand GFS ne sait pas (null), il ne dit rien', async t => {
  const { sent } = await announce(t, null);
  assert.deepEqual(sent, []);
});

test('l\'annonce d\'ouverture : une app sans réglages de vue (Form+) ne reçoit rien, et GFS ne lit même pas la section', async t => {
  let asked = 0;
  const viewOptions = { expect: () => { asked++; return Promise.resolve(true); } };
  const { session, frames } = setup(t, { extra: { viewOptions } });
  frames[0].contentWindow.postMessage = () => assert.fail('Form+ ne déclare aucune clé de réglage : rien à annoncer');
  session.announceSaved();
  await Promise.resolve();
  assert.equal(asked, 0);
});

test('l\'annonce d\'ouverture : un document en lecture seule ne reçoit rien (rien ne s\'y écrit, ni dans la vue ni en brouillon)', async t => {
  let asked = 0;
  const viewOptions = { expect: () => { asked++; return Promise.resolve(true); } };
  const { session, frames } = setup(t, { publi: true, extra: { viewOptions, readonly: true } });
  const sent = [];
  frames[0].contentWindow.postMessage = message => sent.push(message);
  session.announceSaved();
  await Promise.resolve();
  assert.deepEqual(sent, []);
  assert.equal(asked, 0);
});

test('l\'annonce d\'ouverture : un réglage écrit avant la réponse la dépasse, elle ne dit pas le contraire', async t => {
  let answer;
  const viewOptions = { expect: () => new Promise(resolve => { answer = resolve; }) };
  const { session, frames } = setup(t, { publi: true, extra: { viewOptions } });
  const sent = [];
  frames[0].contentWindow.postMessage = message => sent.push(message);
  session.announceSaved();
  session.sendSaved(false); // le premier réglage de l'app a été refusé par Grist : brouillon
  answer(true); // la lecture, partie avant, rend vrai
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(sent, [reglages(false)]);
});
