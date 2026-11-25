// La surveillance du poids du document (js/weight/weight-guard.js, demande du porteur du 25/11 : au-delà de 12 Go, un message d'erreur dit qu'on ne peut pas dépasser 13 Go ; choix : le fichier entier du
// document) : le poids lu (le fichier entier, plus les pièces jointes que le fichier ne garde pas), la première lecture 5 s après le départ puis une toutes les 30 min, la page cachée qui ne lit pas, un échec qui
// reste silencieux, un refus de droits qui arrête tout, et le message qui n'apparaît qu'au-dessus de 12 Go. Les lectures SQL et les minuteurs sont des doublures ; ce que le vrai Grist rend se mesure dans le labo
// (labo/run-poids-alerte.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';
import { SQL } from '../js/weight/weight-reader.js';
import { TransferError } from '../js/broker/transfer.js';
import { EVERY_MS, FIRST_MS, GO, HIDDEN_MS, LIMIT_GO, WARN_BYTES, WeightWatch, isOver, readTotal } from '../js/weight/weight-guard.js';

installFakeDocument();
const { alertBar, alertText } = await import('../js/weight/weight-alert.js');
const { WeightControl } = await import('../js/weight/weight-control.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const http = (status, message = '') => new TransferError('http', message, status);

// Une doublure de `Transfer.sql` : `answers` associe une lecture à ce qu'elle rend (des lignes, ou une erreur à lever).
function fake(answers) {
  const asked = [];
  const sql = async statement => {
    asked.push(statement);
    const answer = answers[statement];
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { sql, asked };
}

test('les seuils : 12 Go pour le message, 13 Go dits, 1 Go = 1 024³ octets ; « au-delà » veut dire strictement', () => {
  assert.deepEqual([GO, WARN_BYTES, LIMIT_GO, FIRST_MS, EVERY_MS], [1073741824, 12 * 1073741824, 13, 5000, 1800000]);
  assert.equal(isOver(WARN_BYTES), false, 'pile 12 Go : pas encore au-delà');
  assert.equal(isOver(WARN_BYTES + 1), true);
  assert.equal(isOver(0), false);
});

test('le poids est le fichier entier ; les pièces jointes que Grist compte et que le fichier ne garde pas (stockage externe) s\'y ajoutent', async () => {
  const both = fake({ [SQL.file]: [{ octets: 1000 }], [SQL.stored]: [{ octets: 200 }], [SQL.counted]: [{ octets: 200 }] });
  assert.equal(await readTotal(both.sql), 1000, 'toutes les pièces jointes sont dans le fichier : rien de plus');
  assert.deepEqual(both.asked, [SQL.file, SQL.stored, SQL.counted], 'trois lectures courtes, le fichier d\'abord : jamais une table, jamais « toutes d\'un coup »');
  const external = fake({ [SQL.file]: [{ octets: 1000 }], [SQL.stored]: [{ octets: 200 }], [SQL.counted]: [{ octets: 5200 }] });
  assert.equal(await readTotal(external.sql), 6000, 'cinq mille octets de pièces jointes gardées ailleurs : ils comptent');
  const deleted = fake({ [SQL.file]: [{ octets: 1000 }], [SQL.stored]: [{ octets: 900 }], [SQL.counted]: [{ octets: 100 }] });
  assert.equal(await readTotal(deleted.sql), 1000, 'des pièces supprimées pas encore effacées : comptées moins que stockées, jamais de poids négatif');
});

test('une lecture des pièces jointes qui échoue laisse le fichier seul ; celle du fichier qui ne dit rien rend null ; un refus de droits lève', async () => {
  const slow = fake({ [SQL.file]: [{ octets: 1000 }], [SQL.stored]: http(400, 'slow'), [SQL.counted]: [{ octets: 900 }] });
  assert.equal(await readTotal(slow.sql), 1000);
  assert.equal(await readTotal(fake({ [SQL.file]: [] }).sql), null);
  await assert.rejects(readTotal(fake({ [SQL.file]: http(403, 'Insufficient access') }).sql), error => error.status === 403);
  await assert.rejects(readTotal(fake({ [SQL.file]: [{ octets: 1 }], [SQL.stored]: http(403) }).sql), error => error.status === 403, 'un refus sur les pièces jointes dit la même chose : pas le droit de tout copier');
});

// Des minuteurs que l'essai fait avancer à la main.
function clock() {
  const queue = [];
  let next = 1;
  return {
    timers: { set: (fn, ms) => { const id = next++; queue.push({ id, fn, ms }); return id; }, clear: id => { const at = queue.findIndex(entry => entry.id === id); if (at >= 0) queue.splice(at, 1); } },
    waiting: () => queue.map(entry => entry.ms),
    async fire() { const entry = queue.shift(); entry.fn(); await new Promise(resolve => setImmediate(resolve)); },
  };
}

function watch(reads, extra = {}) {
  const time = clock();
  const calls = [];
  const changes = [];
  const queue = [...reads];
  const guard = new WeightWatch({ read: async () => { calls.push('read'); const value = queue.shift(); if (value instanceof Error) throw value; return value; }, onChange: event => changes.push(event), timers: time.timers, ...extra });
  return { guard, time, calls, changes };
}

test('la première lecture part 5 s après le départ, la suivante 30 min après la fin de la précédente ; rien ne part avant', async () => {
  const { guard, time, calls } = watch([100, 100]);
  guard.start();
  guard.start();
  assert.deepEqual(time.waiting(), [FIRST_MS], 'un seul minuteur, même démarrée deux fois');
  assert.deepEqual(calls, [], 'aucune lecture au démarrage');
  await time.fire();
  assert.deepEqual([calls.length, time.waiting()], [1, [EVERY_MS]]);
  await time.fire();
  assert.deepEqual([calls.length, time.waiting()], [2, [EVERY_MS]]);
});

test('sous 12 Go, le message ne paraît jamais ; au-dessus, il paraît (« entering ») puis se redit quand le poids change, et s\'en va quand le poids repasse dessous', async () => {
  const { guard, time, changes } = watch([WARN_BYTES, WARN_BYTES + 5, WARN_BYTES + 5, WARN_BYTES + 9, 1000, 1000]);
  guard.start();
  await time.fire();
  assert.deepEqual([changes.length, guard.over, guard.bytes], [0, false, WARN_BYTES], 'pile 12 Go : rien à dire');
  await time.fire();
  assert.deepEqual(changes.at(-1), { bytes: WARN_BYTES + 5, over: true, entering: true, changed: true });
  assert.equal(guard.over, true);
  await time.fire();
  assert.deepEqual(changes.at(-1), { bytes: WARN_BYTES + 5, over: true, entering: false, changed: false }, 'même poids : le message reste, sans nouvelle entrée');
  await time.fire();
  assert.deepEqual(changes.at(-1), { bytes: WARN_BYTES + 9, over: true, entering: false, changed: true });
  await time.fire();
  assert.deepEqual(changes.at(-1), { bytes: 1000, over: false, entering: false, changed: true }, 'revenu sous la limite : une dernière annonce pour retirer le message');
  assert.equal(guard.over, false);
  const count = changes.length;
  await time.fire();
  assert.equal(changes.length, count, 'puis plus rien : sous la limite, aucune annonce');
});

test('passé sous la limite puis de nouveau au-dessus : « entering » redit, pour que le message bref reparaisse', async () => {
  const { guard, time, changes } = watch([WARN_BYTES + 1, 5, WARN_BYTES + 2]);
  guard.start();
  for (let i = 0; i < 3; i++) await time.fire();
  assert.deepEqual(changes.map(change => change.entering), [true, false, true]);
});

test('page cachée : pas de lecture, on revoit dans une minute ; quand elle se voit, la lecture part', async () => {
  let visible = false;
  const { guard, time, calls } = watch([WARN_BYTES + 1], { visible: () => visible });
  guard.start();
  await time.fire();
  assert.deepEqual([calls.length, time.waiting()], [0, [HIDDEN_MS]]);
  visible = true;
  await time.fire();
  assert.deepEqual([calls.length, time.waiting()], [1, [EVERY_MS]]);
});

test('une lecture qui échoue (Grist coupe, serveur muet, rien lu) reste silencieuse et se retente à la prochaine', async () => {
  const { guard, time, changes } = watch([http(400, 'slow'), null, new Error('réseau'), WARN_BYTES + 1]);
  guard.start();
  for (let i = 0; i < 3; i++) { await time.fire(); assert.deepEqual([changes.length, time.waiting()], [0, [EVERY_MS]]); }
  await time.fire();
  assert.equal(changes.length, 1, 'la quatrième lecture réussit : le message paraît');
});

test('un refus de droits (403 : la personne ne peut pas tout copier) arrête la surveillance : plus aucun minuteur', async () => {
  const { guard, time, calls } = watch([http(403, 'Insufficient access'), 1]);
  guard.start();
  await time.fire();
  assert.deepEqual([calls.length, time.waiting()], [1, []]);
  guard.start();
  assert.deepEqual(time.waiting(), [], 'une surveillance arrêtée ne repart pas');
});

test('arrêtée en route : la lecture en cours ne dit rien et aucun minuteur ne reste', async () => {
  let release;
  const time = clock();
  const changes = [];
  const guard = new WeightWatch({ read: () => new Promise(resolve => { release = () => resolve(WARN_BYTES + 1); }), onChange: event => changes.push(event), timers: time.timers });
  guard.start();
  time.fire();
  await new Promise(resolve => setImmediate(resolve));
  guard.stop();
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([changes.length, time.waiting()], [0, []]);
});

test('les minuteurs par défaut s\'appellent comme dans un navigateur, où `setTimeout` lève « Illegal invocation » appelé comme méthode d\'un autre objet (trouvé dans le vrai Grist)', async () => {
  const real = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  const strict = fn => function guarded(...args) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return fn(...args); };
  globalThis.setTimeout = strict(real.set);
  globalThis.clearTimeout = strict(real.clear);
  try {
    // le module est chargé À NEUF, sous ces minuteurs-là : un code qui rangerait `setTimeout` dans un objet pour l'appeler en méthode échoue ici
    const { WeightWatch: Fresh } = await import('../js/weight/weight-guard.js?navigateur');
    const guard = new Fresh({ read: async () => 1, onChange: () => {} });
    assert.doesNotThrow(() => guard.start(), 'la surveillance démarre avec les minuteurs par défaut');
    assert.doesNotThrow(() => guard.stop());
  } finally {
    globalThis.setTimeout = real.set;
    globalThis.clearTimeout = real.clear;
  }
});

test('le bandeau dit le poids et la limite dans la langue, en alerte, avec un bouton qui ouvre le détail', () => {
  const fr = createI18n('fr');
  assert.equal(alertText(12.4 * GO, 'fr-FR', fr.t), 'Ce document pèse 12,40 Go. Il ne peut pas dépasser 13 Go.');
  assert.equal(alertText(12.4 * GO, 'en-GB', createI18n('en').t), 'This document weighs 12.40 GB. It cannot exceed 13 GB.');
  let opened = 0;
  const bar = alertBar({ bytes: 13.3 * GO, locale: 'fr-FR', t: fr.t, detail: () => { opened++; } });
  assert.equal(bar.attrs.role, 'alert');
  assert.match(bar.className || bar.attrs.class, /banner--danger/);
  const button = bar.elements.find(node => node.tag === 'button');
  assert.equal(button.textContent, 'Voir le détail');
  assert.equal(bar.textContent.startsWith('Ce document pèse 13,30 Go.'), true);
  button.listeners.click.forEach(fn => fn({}));
  assert.equal(opened, 1);
});

// Le contrôleur du poids (js/weight/weight-control.js) : la surveillance lit par le cadre d'envoi (lecture seule d'abord, le jeton qui peut écrire seulement après un refus), le bandeau suit le poids, et l'explorateur fermé
// le message bref le dit une fois.
function control({ open = true, readable = true, sqlOf }) {
  const time = clock();
  const said = { repaint: 0, notices: [], jetons: [] };
  const transfer = { sql: async (statement, { writable }) => { said.jetons.push(writable); return sqlOf(statement, writable); } };
  const fr = createI18n('fr');
  const weight = new WeightControl({
    transfer, container: { ownerDocument: { hidden: false } }, inertTargets: () => [], t: fr.t, locale: () => 'fr-FR', canRead: () => readable, repaint: () => { said.repaint++; },
    notice: text => said.notices.push(text), explorerOpen: () => open, timers: time.timers,
  });
  return { weight, time, said };
}
const sizes = bytes => statement => ({ [SQL.file]: [{ octets: bytes }], [SQL.stored]: [{ octets: 0 }], [SQL.counted]: [{ octets: 0 }] }[statement]);

test('le contrôleur : au-dessus de 12 Go le bandeau paraît (l\'explorateur se redessine) ; l\'explorateur ouvert, pas de message bref ; en dessous, aucun bandeau', async () => {
  const { weight, time, said } = control({ open: true, sqlOf: sizes(12.4 * GO) });
  assert.deepEqual(weight.alerts({ detail() {} }), [], 'avant la première lecture : rien');
  weight.watch();
  await time.fire();
  assert.equal(said.repaint, 1);
  assert.deepEqual(said.notices, []);
  const [bar] = weight.alerts({ detail() {} });
  assert.equal(bar.textContent.startsWith('Ce document pèse 12,40 Go. Il ne peut pas dépasser 13 Go.'), true);
  assert.deepEqual(said.jetons, [false, false, false], 'le jeton en lecture seule, pour les trois lectures');
  const small = control({ sqlOf: sizes(3 * GO) });
  small.weight.watch();
  await small.time.fire();
  assert.deepEqual([small.said.repaint, small.weight.alerts({ detail() {} }).length], [0, 0], 'sous la limite : rien à redessiner, aucun bandeau');
});

test('le contrôleur : l\'explorateur fermé (une app est ouverte), le message bref le dit une fois, pas à chaque lecture', async () => {
  const { weight, time, said } = control({ open: false, sqlOf: sizes(13.1 * GO) });
  weight.watch();
  await time.fire();
  await time.fire();
  assert.deepEqual(said.notices, ['Ce document pèse 13,10 Go. Il ne peut pas dépasser 13 Go.'], 'une seule fois');
});

test('le contrôleur : sans l\'accès complet rien ne se lit ; un refus du jeton en lecture seule essaie une fois le jeton qui peut écrire, puis un second refus arrête tout', async () => {
  const none = control({ readable: false, sqlOf: sizes(20 * GO) });
  none.weight.watch();
  assert.deepEqual(none.time.waiting(), [], 'aucune lecture programmée sans l\'accès complet');
  const denied = control({ sqlOf: () => { throw http(403, 'Insufficient access'); } });
  denied.weight.watch();
  await denied.time.fire();
  assert.deepEqual(denied.said.jetons, [false, true], 'lecture seule d\'abord, puis une seule fois le jeton qui peut écrire');
  assert.deepEqual([denied.time.waiting(), denied.said.repaint], [[], 0], 'refusé : plus de minuteur, rien à dire');
  const owner = control({ sqlOf: (statement, writable) => { if (!writable) throw http(403, 'x'); return sizes(12.5 * GO)(statement); } });
  owner.weight.watch();
  await owner.time.fire();
  assert.deepEqual(owner.said.jetons, [false, true, true, true], 'le propriétaire d\'un document à règles : refusé en lecture seule, puis les trois lectures avec le jeton qui peut écrire');
  assert.equal(owner.weight.alerts({ detail() {} }).length, 1);
});
