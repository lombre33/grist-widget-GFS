// Joindre un fichier à la cellule « Pièces jointes » d'une ligne (js/attach.js, contrats 5.4 point 12) : la lecture de la demande, les contrôles du manifeste et de la colonne, l'envoi puis le lot
// unique, le rapport. Le document et le cadre d'envoi sont des doublures ; ce que Grist garde vraiment se joue dans un vrai Grist (labo/run-joindre.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Attach, readAttach } from '../js/attach.js';
import { ERR, Refus } from '../js/filter.js';
import { TransferError } from '../js/transfer.js';
import { policyOf, publipostage } from './helpers.mjs';
import { PDF_BYTES } from './kept-setup.mjs';

const pdf = (name = 'Facture.pdf', content = PDF_BYTES) => new File([content], name, { type: 'application/pdf' });
const entry = (row, name, over = {}) => ({ ligne: row, fichier: pdf(name), nom: name, ...over });
const session = (over = {}) => ({ id: 'publipostage', manifest: { id: 'publipostage', actions: { joindre: ['pdf'] } }, policy: policyOf(publipostage()), ...over });

// Un document de doublure : la table `Clients` (trois lignes, colonne `Pdf` de type Pièces jointes, `Texte`, `Calcul` à formule), les pièces jointes 4 et 9 déjà là, ce que `applyUserActions` a reçu.
function setup({ upload, apply, cells, readonly = false } = {}) {
  const state = { Pdf: cells || [null, ['L', 9], ['L', 4, 9]], rows: [1, 2, 3], uploads: [], writes: [], next: 100, active: null };
  const doc = {
    fetchTable: async name => ({
      _grist_Tables: { id: [1], tableId: ['Clients'] },
      _grist_Tables_column: { id: [10, 11, 12, 13], parentId: [1, 1, 1, 1], colId: ['Pdf', 'Texte', 'Calcul', 'Declenchee'], type: ['Attachments', 'Text', 'Attachments', 'Attachments'], formula: ['', '', '$Pdf', 'x'], isFormula: [false, false, true, false] },
      Clients: { id: state.rows, Pdf: state.Pdf },
      _grist_Attachments: { id: [4, 9], fileName: ['Autre.pdf', 'Facture.pdf'] },
    })[name],
    applyUserActions: async actions => { if (apply) await apply(actions); state.writes.push(actions); },
  };
  const transfer = { upload: async (file, name) => { if (upload) await upload(file, name); state.uploads.push(name); return state.next++; } };
  const attach = new Attach({ doc, transfer, session: () => state.active, readonly: () => readonly });
  const call = (app, args) => { state.active = app; return attach.handlers(app).joindre(args); };
  return { state, call, attach };
}

const args = (fichiers, over = {}) => ({ table: 'Clients', colonne: 'Pdf', fichiers, ...over });
async function refusedWith(promise, code, pattern) {
  await assert.rejects(promise, error => error instanceof Refus && error.code === code && (!pattern || pattern.test(error.message)));
}

test('readAttach : la demande la plus courte reçoit le mode « remplacer » et le « .pdf » manquant ; une forme hors règle est refusée', () => {
  const file = pdf();
  assert.deepEqual(readAttach({ table: 'T', colonne: 'C', fichiers: [{ ligne: 3, fichier: file, nom: ' Facture ' }] }), { table: 'T', column: 'C', mode: 'remplacer', items: [{ index: 0, row: 3, file, name: 'Facture.pdf' }] });
  const bad = over => () => readAttach({ table: 'T', colonne: 'C', fichiers: [{ ligne: 1, fichier: file, nom: 'a' }], ...over });
  for (const [label, make, pattern] of [
    ['sans table', bad({ table: '' }), /table/], ['sans colonne', bad({ colonne: 3 }), /colonne/], ['mode inconnu', bad({ mode: 'écraser' }), /mode/],
    ['liste vide', bad({ fichiers: [] }), /1 à 200/], ['201 entrées', bad({ fichiers: Array(201).fill({ ligne: 1, fichier: file, nom: 'a' }) }), /1 à 200/],
    ['ligne 0', bad({ fichiers: [{ ligne: 0, fichier: file, nom: 'a' }] }), /ligne/], ['ligne en texte', bad({ fichiers: [{ ligne: '1', fichier: file, nom: 'a' }] }), /ligne/],
    ['texte à la place du fichier', bad({ fichiers: [{ ligne: 1, fichier: 'x', nom: 'a' }] }), /File ou un Blob/], ['fichier vide', bad({ fichiers: [{ ligne: 1, fichier: new File([], 'a.pdf'), nom: 'a' }] }), /vide/],
    ['nom vide', bad({ fichiers: [{ ligne: 1, fichier: file, nom: '  ' }] }), /nom/], ['nom trop long', bad({ fichiers: [{ ligne: 1, fichier: file, nom: 'n'.repeat(201) }] }), /nom/],
  ]) assert.throws(make, error => error instanceof Refus && error.code === ERR.REFUSE && pattern.test(error.message), label);
  assert.throws(() => readAttach(null), Refus);
});

test('un PDF à une ligne : envoyé, la colonne relue, un seul lot, rapport sans problème', async () => {
  const { state, call } = setup();
  const report = await call(session(), args([entry(1, 'Devis.pdf')]));
  assert.deepEqual(report, { colonne: 'Pdf', probleme: null, joints: [{ index: 0, remplace: false }], echecs: [] });
  assert.deepEqual(state.uploads, ['Devis.pdf']);
  assert.deepEqual(state.writes, [[['BulkUpdateRecord', 'Clients', [1], { Pdf: [['L', 100]] }]]], 'une cellule vide devient la liste du nouveau fichier');
});

test('« remplacer » (par défaut) retire de la cellule le fichier de même nom, la casse ignorée, et garde les autres ; « ajouter » garde tout', async () => {
  const replacing = setup();
  const first = await replacing.call(session(), args([entry(3, 'facture.PDF')]));
  assert.deepEqual(first.joints, [{ index: 0, remplace: true }]);
  assert.deepEqual(replacing.state.writes[0][0][3], { Pdf: [['L', 4, 100]] }, 'la pièce 9 (Facture.pdf) sort, la 4 (Autre.pdf) reste');
  const adding = setup();
  const second = await adding.call(session(), args([entry(3, 'Facture.pdf')], { mode: 'ajouter' }));
  assert.deepEqual(second.joints, [{ index: 0, remplace: false }]);
  assert.deepEqual(adding.state.writes[0][0][3], { Pdf: [['L', 4, 9, 100]] }, 'le nom pris n\'empêche pas d\'ajouter');
});

test('plusieurs fichiers d\'une même ligne vont dans la même cellule, dans l\'ordre ; plusieurs lignes, un seul lot', async () => {
  const { state, call } = setup();
  const report = await call(session(), args([entry(2, 'A.pdf'), entry(1, 'B.pdf'), entry(2, 'C.pdf')]));
  assert.deepEqual(report.joints, [{ index: 0, remplace: false }, { index: 1, remplace: false }, { index: 2, remplace: false }]);
  assert.equal(state.writes.length, 1, 'un seul lot');
  assert.deepEqual(state.writes[0], [['BulkUpdateRecord', 'Clients', [2, 1], { Pdf: [['L', 9, 100, 102], ['L', 101]] }]]);
});

test('une ligne qui n\'existe pas est un échec de cette ligne, les autres sont jointes ; une ligne supprimée entre l\'envoi et l\'écriture l\'est aussi', async () => {
  const { state, call } = setup({ upload: async () => { if (state.uploads.length === 1) state.rows = [1, 2]; } });
  const report = await call(session(), args([entry(7, 'A.pdf'), entry(3, 'B.pdf'), entry(1, 'C.pdf')]));
  assert.deepEqual(report.joints, [{ index: 2, remplace: false }]);
  assert.deepEqual(report.echecs, [{ index: 0, raison: 'ligne' }, { index: 1, raison: 'ligne' }], 'la ligne 7 n\'a jamais existé, la 3 a disparu pendant l\'envoi');
  assert.equal(report.probleme, null);
  assert.deepEqual(state.uploads, ['B.pdf', 'C.pdf']);
  assert.deepEqual(state.writes[0][0][3], { Pdf: [['L', 101]] });
});

test('une colonne absente, d\'un autre type ou à formule : rien n\'est envoyé, chaque fichier est un échec qui dit pourquoi', async () => {
  for (const [column, problem] of [['Absente', 'absente'], ['Texte', 'inutilisable'], ['Calcul', 'inutilisable'], ['Declenchee', 'inutilisable']]) {
    const { state, call } = setup();
    const report = await call(session(), args([entry(1, 'A.pdf'), entry(2, 'B.pdf')], { colonne: column }));
    assert.deepEqual(report, { colonne: column, probleme: problem, joints: [], echecs: [{ index: 0, raison: problem }, { index: 1, raison: problem }] }, column);
    assert.deepEqual([state.uploads, state.writes], [[], []], `${column} : rien n'est envoyé ni écrit`);
  }
  const { call } = setup();
  const report = await call(session(), args([entry(1, 'A.pdf')], { table: 'Inconnue' }));
  assert.equal(report.probleme, 'absente', 'une table qui n\'existe plus : la colonne est absente');
});

test('ce que Grist refuse à l\'envoi arrête le lot (sauf la taille) : les fichiers déjà envoyés sont joints, les autres sont des échecs du même mot', async () => {
  const cases = [[new TransferError('http', 'refus', 403), 'refus'], [new TransferError('http', 'refus', 401), 'refus'],
    [new TransferError('http', 'erreur', 500), 'echec'], [new TransferError('network', 'coupé'), 'injoignable'], [new TransferError('timeout', 'long'), 'injoignable'],
    [new TransferError('answer', 'bizarre'), 'echec'], [new Error('autre'), 'echec']];
  for (const [error, problem] of cases) {
    const { state, call } = setup({ upload: async () => { if (state.uploads.length === 1) throw error; } });
    const report = await call(session(), args([entry(1, 'A.pdf'), entry(2, 'B.pdf'), entry(3, 'C.pdf')]));
    assert.equal(report.probleme, problem, problem);
    assert.deepEqual(report.joints, [{ index: 0, remplace: false }], 'le premier fichier, parti avant, est joint');
    assert.deepEqual(report.echecs, [{ index: 1, raison: problem }, { index: 2, raison: problem }]);
    assert.deepEqual(state.uploads, ['A.pdf'], 'plus rien ne part après le refus');
    assert.equal(state.writes.length, 1);
  }
});

test('un fichier que Grist trouve trop gros (413) est un échec à lui seul : les autres partent et sont joints, `probleme` reste null', async () => {
  let calls = 0;
  const { state, call } = setup({ upload: async () => { if (++calls === 2) throw new TransferError('http', 'trop gros', 413); } });
  const report = await call(session(), args([entry(1, 'A.pdf'), entry(2, 'B.pdf'), entry(3, 'C.pdf')]));
  assert.equal(report.probleme, null, 'la taille n\'arrête pas le lot');
  assert.deepEqual(report.joints, [{ index: 0, remplace: false }, { index: 2, remplace: false }], 'le premier et le dernier fichiers sont joints');
  assert.deepEqual(report.echecs, [{ index: 1, raison: 'trop-gros' }]);
  assert.equal(calls, 3, 'chaque fichier est essayé, celui d\'après le trop gros aussi');
  assert.deepEqual(state.uploads, ['A.pdf', 'C.pdf']);
  assert.equal(state.writes.length, 1, 'un seul lot, pour ceux qui sont partis');
  const alone = setup({ upload: async () => { throw new TransferError('http', 'trop gros', 413); } });
  const lone = await alone.call(session(), args([entry(1, 'A.pdf')]));
  assert.deepEqual([lone.probleme, lone.joints, lone.echecs, alone.state.writes], [null, [], [{ index: 0, raison: 'trop-gros' }], []], 'rien d\'envoyé : rien d\'écrit');
});

test('une écriture que Grist refuse (règles d\'accès) : `refus`, aucun fichier n\'est dit joint ; une autre erreur est `echec`', async () => {
  for (const [message, problem] of [['[Sandbox] Access denied: no write on Pdf', 'refus'], ['Grist ne répond pas', 'echec']]) {
    const { call } = setup({ apply: async () => { throw new Error(message); } });
    const report = await call(session(), args([entry(1, 'A.pdf'), entry(2, 'B.pdf')]));
    assert.deepEqual(report, { colonne: 'Pdf', probleme: problem, joints: [], echecs: [{ index: 0, raison: problem }, { index: 1, raison: problem }] }, problem);
  }
});

test('un appel hors règle est refusé avant tout envoi : type non déclaré, table que le manifeste ne laisse pas écrire, fichier qui n\'est pas un PDF, lecture seule, app partie', async () => {
  const undeclared = setup();
  await assert.rejects(async () => undeclared.call(session({ manifest: { id: 'publipostage', actions: {} } }), args([entry(1, 'A.pdf')])), error => error.code === ERR.REFUSE && /actions\.joindre/.test(error.message));
  await assert.rejects(async () => undeclared.call(session({ manifest: { id: 'publipostage', actions: { joindre: ['docx'] } } }), args([entry(1, 'A.pdf')])), error => error.code === ERR.REFUSE);
  for (const table of ['GFS_Fichiers', '_grist_Attachments', 'Automation_Etat']) {
    await refusedWith(setup().call(session(), args([entry(1, 'A.pdf')], { table })), ERR.REFUSE, /joindre/);
  }
  const noWrite = policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, ecrit: ['Rien'] } });
  await refusedWith(setup().call(session({ policy: noWrite }), args([entry(1, 'A.pdf')])), ERR.REFUSE, /Écriture de Clients/);
  const noRead = policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, lit: ['Rien'] } });
  await refusedWith(setup().call(session({ policy: noRead }), args([entry(1, 'A.pdf')])), ERR.REFUSE, /Lecture de Clients/);
  const fake = setup();
  await refusedWith(fake.call(session(), args([{ ligne: 1, fichier: pdf('x.pdf', 'pas un pdf'), nom: 'x' }])), ERR.REFUSE, /pas un PDF/);
  assert.deepEqual([fake.state.uploads, fake.state.writes], [[], []]);
  await refusedWith(setup({ readonly: true }).call(session(), args([entry(1, 'A.pdf')])), ERR.LECTURE_SEULE);
  const gone = setup();
  const app = session();
  const promise = gone.attach.attach(app, args([entry(1, 'A.pdf')]));
  gone.state.active = session();
  await refusedWith(promise, ERR.INACTIF);
});

test('deux appels lancés ensemble se jouent l\'un après l\'autre : le second relit la colonne que le premier a écrite', async () => {
  const { state, call } = setup();
  const app = session();
  const first = call(app, args([entry(1, 'A.pdf')]));
  const second = call(app, args([entry(1, 'B.pdf')]));
  state.rows = [1, 2, 3];
  await first;
  state.Pdf = [['L', 100], ['L', 9], ['L', 4, 9]]; // ce que le premier lot a écrit
  const report = await second;
  assert.deepEqual(report.joints, [{ index: 0, remplace: false }]);
  assert.deepEqual(state.writes[1][0][3], { Pdf: [['L', 100, 101]] });
});
