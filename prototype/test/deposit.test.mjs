// Ranger un fichier dans GFS (js/broker/deposit.js, contrats 5.4 point 9) : la lecture de la demande `ranger`, le contrôle du manifeste, la file des dépôts, la mémoire d'un lot. Le magasin et les
// fenêtres sont des doublures (`kept`) ; ce que GFS écrit dans le document et ce que la personne voit se jouent dans un vrai Grist (labo/run-ranger-pdf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Deposit, readDeposit } from '../js/broker/deposit.js';
import { ERR, Refus } from '../js/broker/filter.js';
import { PDF_BYTES } from './kept-setup.mjs';

const blob = () => new File([PDF_BYTES], 'export.pdf', { type: 'application/pdf' });
const ask = (over = {}) => ({ fichier: blob(), nom: 'Facture.pdf', ...over });
const appSession = (over = {}) => ({ id: 'publipostage', manifest: { id: 'publipostage', nom: { fr: 'Publipostage+', en: 'Publipostage+' }, actions: { ranger: ['pdf'] } }, ...over });

// Le dépôt avec un `kept` de doublure : il note chaque demande reçue et rend ce que `answer` décide.
function setup({ answer = request => ({ status: 'added', id: 'aa', name: request.name }), active } = {}) {
  const log = { requests: [] };
  const state = { session: null };
  const kept = { deposit: async request => { log.requests.push(request); return answer(request); } };
  const deposit = new Deposit({ kept, session: () => (active === undefined ? state.session : active), appName: session => session.manifest.nom.fr });
  const call = (session, args) => { state.session = session; return deposit.handlers(session).ranger(args); };
  return { deposit, kept, log, state, call };
}

async function refusedWith(promise, code) {
  await assert.rejects(promise, error => error instanceof Refus && error.code === code);
}

test('readDeposit : la demande la plus courte — le fichier et un nom — reçoit le « .pdf » manquant et les valeurs par défaut', () => {
  const file = blob();
  assert.deepEqual(readDeposit({ fichier: file, nom: 'Facture' }), { file, name: 'Facture.pdf', type: 'pdf', lot: null, more: null, folder: '' });
  assert.equal(readDeposit({ fichier: file, nom: '  Facture.PDF  ' }).name, 'Facture.PDF', 'un « .PDF » en capitales est gardé tel quel');
});

test('readDeposit : lot, suivants et dossier sont lus ; le dossier est un chemin normalisé', () => {
  const file = blob();
  assert.deepEqual(readDeposit({ fichier: file, nom: 'a', type: 'pdf', lot: 'export-1', suivants: 11, dossier: ' Factures // 2026/ ' }),
    { file, name: 'a.pdf', type: 'pdf', lot: 'export-1', more: 11, folder: 'Factures/2026' });
  assert.equal(readDeposit({ fichier: file, nom: 'a', suivants: 0 }).more, 0);
  assert.equal(readDeposit({ fichier: file, nom: 'a', dossier: '' }).folder, '');
});

test('readDeposit : un nom sur plusieurs lignes devient une ligne (une ligne d\'explorateur ne se brise pas)', () => {
  assert.equal(readDeposit(ask({ nom: 'Contrat\n\tclient\r\n.pdf' })).name, 'Contrat client .pdf');
  assert.equal(readDeposit(ask({ nom: 'Contrat\u007fclient.pdf' })).name, 'Contrat client.pdf', 'le signe « suppression » (DEL) est un signe de contrôle comme les autres');
});

test('readDeposit : une demande hors règle est refusée (GFS_REFUSE), avant que rien ne s\'écrive', () => {
  const bad = [
    ['pas de fichier', { fichier: undefined }], ['un texte au lieu du fichier', { fichier: '%PDF-1.4' }], ['des octets sans Blob', { fichier: new Uint8Array([37, 80, 68, 70]) }],
    ['un objet au lieu du fichier', { fichier: { size: 3, name: 'x.pdf' } }],
    ['pas de nom', { nom: undefined }], ['un nom qui n\'est pas un texte', { nom: 12 }], ['un nom vide', { nom: '   ' }], ['rien que « .pdf »', { nom: '.pdf' }], ['un nom trop long', { nom: 'a'.repeat(201) }],
    ['un autre type', { type: 'image' }], ['un type qui n\'est pas un texte', { type: 3 }],
    ['un lot vide', { lot: '  ' }], ['un lot trop long', { lot: 'x'.repeat(65) }], ['un lot qui n\'est pas un texte', { lot: 4 }],
    ['suivants négatif', { suivants: -1 }], ['suivants décimal', { suivants: 1.5 }], ['suivants en texte', { suivants: '3' }],
    ['un dossier qui n\'est pas un texte', { dossier: ['A'] }], ['un dossier trop long', { dossier: 'd'.repeat(201) }],
  ];
  for (const [what, patch] of bad) {
    assert.throws(() => readDeposit(ask(patch)), error => error instanceof Refus && error.code === ERR.REFUSE, what);
  }
});

test('le nom de 200 signes passe, celui de 201 est refusé ; « lot » de 64 signes passe', () => {
  assert.equal(readDeposit(ask({ nom: `${'a'.repeat(196)}.pdf` })).name.length, 200);
  assert.equal(readDeposit(ask({ lot: 'x'.repeat(64) })).lot.length, 64);
});

test('ranger : une app qui n\'a pas déclaré actions.ranger, ou pas ce type, est refusée sans que GFS touche à rien', async () => {
  const { call, log } = setup();
  for (const manifest of [{ id: 'form', nom: { fr: 'Form+' } }, { id: 'form', nom: { fr: 'Form+' }, actions: {} }, { id: 'form', nom: { fr: 'Form+' }, actions: { ranger: [] } }, { id: 'form', nom: { fr: 'Form+' }, actions: { ranger: ['image'] } }]) {
    await refusedWith(Promise.resolve().then(() => call(appSession({ id: 'form', manifest }), ask())), ERR.REFUSE);
  }
  assert.deepEqual(log.requests, []);
});

test('ranger : une demande bien formée d\'une app qui a déclaré le type arrive chez GFS avec le nom de l\'app et son identifiant', async () => {
  const { call, log } = setup();
  const file = blob();
  const reply = await call(appSession(), { fichier: file, nom: 'Facture', dossier: 'Factures/2026' });
  assert.deepEqual(reply, { statut: 'ajoute', id: 'aa', nom: 'Facture.pdf' });
  assert.equal(log.requests.length, 1);
  const [request] = log.requests;
  assert.deepEqual([request.file === file, request.name, request.folder, request.app, request.appName, request.repeat], [true, 'Facture.pdf', 'Factures/2026', 'publipostage', 'Publipostage+', false]);
});

test('ranger : les quatre issues sont dites dans les mots du contrat — ajouté, remplacé, copie, ignoré (sans identifiant ni nom)', async () => {
  const outcomes = {
    ajoute: { status: 'added', id: 'aa', name: 'Facture.pdf' }, remplace: { status: 'replaced', id: 'bb', name: 'Facture.pdf' },
    copie: { status: 'copied', id: 'cc', name: 'Facture (1).pdf' }, ignore: { status: 'skipped', id: null, name: null },
  };
  for (const [statut, outcome] of Object.entries(outcomes)) {
    const { call } = setup({ answer: () => outcome });
    assert.deepEqual(await call(appSession(), ask()), { statut, id: outcome.id, nom: outcome.name });
  }
});

test('la case « Faire pareil pour les suivants » n\'est offerte que dans un lot dont il reste des fichiers : lot donné et suivants différent de 0', async () => {
  const { call, log } = setup();
  const session = appSession();
  await call(session, ask());
  await call(session, ask({ lot: 'l1' }));
  await call(session, ask({ lot: 'l2', suivants: 0 }));
  await call(session, ask({ lot: 'l3', suivants: 4 }));
  await call(session, ask({ suivants: 4 }));
  assert.deepEqual(log.requests.map(request => request.repeat), [false, true, false, true, false]);
});

test('un lot : les fichiers d\'une même app et d\'un même nom de lot partagent leur mémoire ; un autre lot, une autre app ou aucun nom de lot repartent de zéro', async () => {
  const batches = [];
  const { call } = setup({ answer: request => { batches.push(request.batch); return { status: 'added', id: 'aa', name: request.name }; } });
  const one = appSession();
  await call(one, ask({ lot: 'A' }));
  await call(one, ask({ lot: 'A' }));
  await call(one, ask({ lot: 'B' }));
  await call(one, ask({ lot: 'A' }));
  await call(one, ask());
  await call(one, ask());
  await call(appSession(), ask({ lot: 'A' }));
  assert.equal(batches[0], batches[1], 'même app, même lot : la même mémoire');
  assert.notEqual(batches[1], batches[2], 'un autre lot repart de zéro');
  assert.notEqual(batches[2], batches[3], 'le lot précédent est oublié, même s\'il revient');
  assert.notEqual(batches[4], batches[5], 'sans nom de lot, chaque fichier est seul');
  assert.notEqual(batches[3], batches[6], 'une autre app (une autre session) a sa propre mémoire');
  for (const batch of batches) assert.deepEqual(Object.keys(batch).sort(), ['choice', 'declined', 'noFolder']);
});

test('la mémoire d\'un lot est celle que GFS écrit : une réponse retenue par le premier fichier est lue par le suivant', async () => {
  const seen = [];
  const { call } = setup({ answer: request => { seen.push(request.batch.choice); request.batch.choice = 'replace'; return { status: 'replaced', id: 'aa', name: request.name }; } });
  const session = appSession();
  await call(session, ask({ lot: 'A' }));
  await call(session, ask({ lot: 'A' }));
  await call(session, ask({ lot: 'B' }));
  assert.deepEqual(seen, [null, 'replace', null]);
});

test('les dépôts passent l\'un après l\'autre : le suivant ne commence qu\'à la fin du précédent (une seule fenêtre à la fois), même lancés ensemble', async () => {
  const order = [];
  const gates = [];
  const { call } = setup({
    answer: request => new Promise(resolve => {
      order.push(`début ${request.name}`);
      gates.push(() => { order.push(`fin ${request.name}`); resolve({ status: 'added', id: request.name, name: request.name }); });
    }),
  });
  const session = appSession();
  const first = call(session, ask({ nom: 'un' }));
  const second = call(session, ask({ nom: 'deux' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['début un.pdf']);
  gates.shift()();
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['début un.pdf', 'fin un.pdf', 'début deux.pdf']);
  gates.shift()();
  assert.deepEqual((await second).nom, 'deux.pdf');
});

test('un dépôt refusé ne bloque pas la file : le suivant passe', async () => {
  let count = 0;
  const { call } = setup({ answer: request => { count += 1; if (count === 1) throw new Refus(ERR.ANNULE, 'refusé'); return { status: 'added', id: 'aa', name: request.name }; } });
  const session = appSession();
  const first = call(session, ask());
  const second = call(session, ask());
  await refusedWith(first, ERR.ANNULE);
  assert.equal((await second).statut, 'ajoute');
});

test('une app qui n\'est plus l\'app active quand son tour vient n\'écrit rien (GFS_INACTIF) ; la file continue', async () => {
  const staying = appSession();
  const { call, log } = setup({ active: staying });
  await refusedWith(call(appSession({ id: 'form' }), ask()), ERR.INACTIF);
  assert.deepEqual(log.requests, []);
  assert.equal((await call(staying, ask())).statut, 'ajoute');
});

test('les refus du dépôt gardent leur code jusqu\'à l\'app : accès, lecture seule, annulé, échec', async () => {
  for (const code of [ERR.ACCES, ERR.LECTURE_SEULE, ERR.ANNULE, ERR.ECHEC, ERR.REFUSE]) {
    const { call } = setup({ answer: () => { throw new Refus(code, 'dit en mots'); } });
    await assert.rejects(call(appSession(), ask()), error => error.code === code && error.message === 'dit en mots');
  }
});

test('les appels d\'une app à GFS : la table des poignées de l\'enveloppe porte « ranger »', () => {
  const { deposit } = setup();
  assert.deepEqual(Object.keys(deposit.handlers(appSession())), ['ranger']);
});
