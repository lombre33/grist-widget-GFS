// Le poids dans l'explorateur (js/weight.js ; demande du porteur du 04/11) : les octets d'une cellule et d'une ligne comme Grist les range, la pièce jointe qu'un fichier EST, les sommes (une
// pièce citée deux fois n'est comptée qu'une fois), les pièces jointes du document que la case « + pièces jointes » ajoute et l'écriture du poids, en français et en anglais. Ce que Grist range vraiment
// se mesure dans le labo (labo/run-poids.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utf8Length, cellBytes, rowWeigher, attachmentIds, piecesOf, linkedWeights, linkedOf, LINKED, newSum, addWeight, sumWeights, pieceKeys, otherAttachments, formatBytes } from '../js/weight.js';
import { createI18n } from '../js/i18n.js';

test('utf8Length : les octets d\'un texte en UTF-8, comme Buffer.byteLength, sans copier le texte', () => {
  const samples = ['', 'abc', 'é', 'Émargement (grille)', '€', '日本語のテキスト', 'a😀b', '😀😀', '\u0000', 'x'.repeat(10000) + 'é'.repeat(1000) + '😀'.repeat(100)];
  for (const sample of samples) assert.equal(utf8Length(sample), Buffer.byteLength(sample), JSON.stringify(sample.slice(0, 20)));
});

test('cellBytes : un texte en UTF-8, un entier de 1 à 8 octets, un flottant 8, un booléen 1, rien 0, une liste sans son « L »', () => {
  assert.deepEqual([null, undefined, '', 'é', true, false].map(cellBytes), [0, 0, 0, 2, 1, 1]);
  assert.deepEqual([0, 127, 128, 32767, 32768, 2 ** 23, 2 ** 31, 2 ** 47, -5].map(cellBytes), [1, 1, 2, 2, 3, 4, 6, 8, 1]);
  assert.equal(cellBytes(1.5), 8);
  assert.equal(cellBytes(['L', 3, 5]), '[3,5]'.length, 'Grist range [3,5], pas ["L",3,5]');
  assert.equal(cellBytes(['L']), '[]'.length);
  assert.equal(cellBytes(['E', 'ZeroDivisionError']), Buffer.byteLength('["E","ZeroDivisionError"]'));
  assert.equal(cellBytes({ a: 'é' }), Buffer.byteLength('{"a":"é"}'));
});

test('rowWeigher : la somme des cellules de la ligne, sans `id` ni `manualSort` ; une colonne qui n\'est pas une liste est ignorée', () => {
  const data = { id: [1, 2], manualSort: [1, 2], Nom: ['Convocation', 'Émargement'], Contenu: ['x'.repeat(100), ''], Epingle: [true, false], Note: [null, 'é'], Bizarre: 'pas une colonne' };
  const weigh = rowWeigher(data);
  assert.equal(weigh(0), 11 + 100 + 1 + 0);
  assert.equal(weigh(1), 11 + 0 + 1 + 2, '« Émargement » : 10 caractères, 11 octets');
  assert.equal(rowWeigher(null)(0), 0);
  assert.equal(rowWeigher({ id: [1] })(0), 0);
});

test('attachmentIds : les numéros d\'une cellule `[\'L\', …]`, rien d\'autre', () => {
  assert.deepEqual(attachmentIds(['L', 3, 5]), [3, 5]);
  assert.deepEqual(attachmentIds(['L', 3, 'x', 5.5]), [3]);
  assert.deepEqual(attachmentIds(['D', 3, 'UTC']), []);
  assert.deepEqual([attachmentIds(null), attachmentIds('L'), attachmentIds(7)], [[], [], []]);
});

test('piecesOf : la pièce jointe qu\'un fichier EST (la colonne de la pièce et celle de sa taille, d\'après le manifeste) ; sans règle, sans pièce ou sans taille : rien ou zéro', () => {
  const rule = { pieces: { colonne: 'Contenu', taille: 'Taille' } };
  const data = { id: [1, 2, 3, 4], Contenu: [['L', 7], null, ['L', 8, 9], ['L', 10]], Taille: [2048, 5, 512, null] };
  assert.deepEqual(piecesOf(rule, data, 0), [['7', 2048]]);
  assert.deepEqual(piecesOf(rule, data, 1), [], 'une ligne sans pièce jointe');
  assert.deepEqual(piecesOf(rule, data, 2), [['8', 512]], 'la première pièce : le fichier n\'en est qu\'une');
  assert.deepEqual(piecesOf(rule, data, 3), [['10', 0]], 'taille inconnue : zéro, jamais NaN');
  assert.deepEqual(piecesOf(undefined, data, 0), []);
  assert.deepEqual(piecesOf({}, data, 0), []);
  assert.deepEqual(piecesOf(rule, null, 0), []);
  assert.deepEqual(piecesOf({ pieces: { colonne: 'Absente', taille: 'Taille' } }, data, 0), []);
});

test('sumWeights : une pièce jointe que deux fichiers citent n\'est comptée qu\'une fois ; la somme se construit fichier par fichier', () => {
  const file = (weight, ...pieces) => ({ weight, pieces });
  const original = file(2100, ['7', 2048]);
  const copy = file(2100, ['7', 2048]);
  const other = file(600, ['8', 512]);
  const plain = file(50);
  assert.equal(sumWeights([]), 0);
  assert.equal(sumWeights([plain, original]), 2150);
  assert.equal(sumWeights([original, copy]), 2100 + 52, 'la copie ne coûte que sa ligne : 4200 − 2048');
  assert.equal(sumWeights([original, copy, other, plain]), 2100 + 52 + 600 + 50);
  const sum = newSum();
  assert.equal(sum.seen, null, 'rien n\'est alloué pour un fichier sans pièce');
  addWeight(sum, plain);
  assert.equal(sum.seen, null);
  addWeight(sum, original);
  addWeight(sum, copy);
  assert.equal(sum.bytes, 50 + 2100 + 52);
});

test('formatBytes : o, Ko, Mo, Go (1 Ko = 1 024 o), jamais plus de trois chiffres avant la virgule, en français et en anglais', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  const cases = [
    [0, '0 o', '0 B'], [999, '999 o', '999 B'], [1024, '1 Ko', '1 KB'], [6400, '6 Ko', '6 KB'], [48200, '47 Ko', '47 KB'], [1022 * 1024, '1,0 Mo', '1.0 MB'],
    [2310000, '2,2 Mo', '2.2 MB'], [5270000, '5,0 Mo', '5.0 MB'], [18.1 * 1048576, '18,1 Mo', '18.1 MB'], [1020 * 1048576, '1,00 Go', '1.00 GB'],
    [1.87 * 1073741824, '1,87 Go', '1.87 GB'], [15 * 1073741824, '15,00 Go', '15.00 GB'],
  ];
  for (const [bytes, french, english] of cases) {
    assert.equal(formatBytes(bytes, 'fr-FR', fr), french, `${bytes} octets`);
    assert.equal(formatBytes(bytes, 'en-GB', en), english, `${bytes} octets`);
  }
  assert.equal(formatBytes(-5, 'fr-FR', fr), '0 o');
  assert.equal(formatBytes(undefined, 'fr-FR', fr), '0 o');
  assert.match(formatBytes(1536 * 1024 * 1024 * 1024, 'fr-FR', fr), /^1.536,00 Go$/, 'au-delà du Go : l\'unité ne change plus (le séparateur de milliers dépend du navigateur)');
});

test('formatBytes : une valeur à la frontière passe à l\'unité du dessus (999,5 Ko est « 1,0 Mo », pas « 1 000 Ko »)', () => {
  const fr = createI18n('fr').t;
  assert.equal(formatBytes(999.4, 'fr-FR', fr), '999 o');
  assert.equal(formatBytes(999.5, 'fr-FR', fr), '1 Ko');
  assert.equal(formatBytes(999 * 1024, 'fr-FR', fr), '999 Ko');
  assert.equal(formatBytes(999.5 * 1024, 'fr-FR', fr), '1,0 Mo');
});

// La table `_grist_Attachments` du document d'essai de l'étude, telle que Grist 1.7.19 l'a rendue (mesuré le 04/11, docs/faits-verifies.md section 39) : cinq PDF, la copie du deuxième (même `fileIdent`),
// deux PDF supprimés (`timeDeleted`), un PDF de plus et vingt photos. Le compte de Grist sur ce document (`SUM(MAX(fileSize)) … WHERE timeDeleted IS NULL GROUP BY fileIdent`) : 27 499 315 octets.
const STUDY = [
  [1, 'a.pdf', 20480, null], [2, 'b.pdf', 153600, null], [3, 'c.pdf', 1258291, null], [4, 'd.pdf', 5242880, null], [5, 'e.pdf', 12582912, null], [6, 'b.pdf', 153600, null],
  [7, 'old.pdf', 3145728, 1793784337.01], [8, 'new.pdf', 2097152, null], [9, 'orphan.pdf', 4194304, 1793784337.01],
  ...Array.from({ length: 20 }, (_, i) => [10 + i, `photo${i}.jpg`, 307200, null]),
];
const attachmentsTable = rows => ({ id: rows.map(row => row[0]), fileIdent: rows.map(row => row[1]), fileSize: rows.map(row => row[2]), timeDeleted: rows.map(row => row[3]) });
const set = (...ids) => new Set(ids.map(String));

test('pieceKeys : les numéros des pièces que citent des fichiers, vivants ou à la corbeille ; un fichier sans pièce (ou sans `pieces`) n\'en cite aucune', () => {
  const live = [{ pieces: [['3', 100]] }, { pieces: [] }, { pieces: [['4', 5]] }, {}];
  const bin = [{ pieces: [['3', 100]] }, { pieces: [['9', 1]] }];
  assert.deepEqual([...pieceKeys(live, bin)].sort(), ['3', '4', '9']);
  assert.equal(pieceKeys([]).size, 0);
});

// Les versions d'un modèle de Publipostage+ (`Publipostage_Versions`, rangées par `Jeton`) : la forme que `fetchTable` rend, une ligne par version.
const VERSIONS = { id: [1, 2, 3, 4], Jeton: ['a', 'a', '', 'b'], Date: [10, 11, 12, 13], Donnees: ['x'.repeat(100), 'é'.repeat(50), 'z'.repeat(40), null] };

test('linkedWeights : les octets de toutes les lignes qui portent la même clé, comptés comme ceux d\'un fichier ; la clé vide, absente ou illisible ne désigne personne', () => {
  const bytes = linkedWeights(VERSIONS, 'Jeton');
  // « a » : (1 + 100) + (1 + 2 × 50) ; « b » : 1 + rien ; la date 10 et 11 : 1 octet chacune, 13 : 1 octet.
  assert.equal(bytes.get('a'), (1 + 1 + 100) + (1 + 1 + 100));
  assert.equal(bytes.get('b'), 1 + 1);
  assert.equal(bytes.has(''), false, 'la clé vide ne désigne personne : ses lignes ne sont à aucun fichier');
  assert.equal(linkedWeights(VERSIONS, 'Absente').size, 0);
  assert.equal(linkedWeights(null, 'Jeton').size, 0);
  assert.equal(linkedWeights({ id: [1], Jeton: [7], Donnees: ['ab'] }, 'Jeton').get('7'), 1 + 2, 'une clé numérique se compare comme du texte');
});

test('linkedOf : ce que les tables liées ajoutent au fichier d\'une ligne, au format de piecesOf ; sans clé, sans lignes liées ou sans règle, rien', () => {
  const links = [{ table: 'Publipostage_Versions', fichier: 'Jeton', bytes: linkedWeights(VERSIONS, 'Jeton') }];
  const models = { id: [1, 2, 3, 4], Jeton: ['a', 'b', '', 'inconnu'] };
  assert.deepEqual(linkedOf(links, models, 0), [[`${LINKED}Publipostage_Versions:a`, 204]]);
  assert.deepEqual(linkedOf(links, models, 1), [[`${LINKED}Publipostage_Versions:b`, 2]]);
  assert.deepEqual(linkedOf(links, models, 2), [], 'un modèle sans jeton n\'a pas de versions (une copie, par exemple)');
  assert.deepEqual(linkedOf(links, models, 3), [], 'un jeton qu\'aucune version ne porte');
  assert.deepEqual(linkedOf(null, models, 0), []);
  assert.deepEqual(linkedOf(links, { id: [1] }, 0), [], 'une colonne que la table du fichier n\'a pas');
});

test('les lignes liées se somment avec les pièces : deux fichiers de même clé ne les comptent qu\'une fois, et `pieceKeys` n\'en fait pas des pièces jointes', () => {
  const link = [[`${LINKED}Publipostage_Versions:a`, 204]];
  const first = { weight: 50 + 204, pieces: link };
  const second = { weight: 70 + 204, pieces: link };
  assert.equal(sumWeights([first, second]), 50 + 70 + 204, 'les versions d\'une même clé comptent une fois');
  assert.equal(pieceKeys([first, { pieces: [['3', 9]] }]).size, 1, 'seule la pièce jointe est un numéro de pièce');
  assert.deepEqual([...pieceKeys([first, { pieces: [['3', 9]] }])], ['3']);
});

test('otherAttachments : le compte de Grist sur le document de l\'étude (27 499 315 octets) : une pièce par `fileIdent`, sans les supprimées', () => {
  assert.deepEqual(otherAttachments(attachmentsTable(STUDY), set()), { bytes: 27499315, count: 26 });
});

test('otherAttachments : les pièces que citent les fichiers de l\'explorateur ne sont pas recomptées : il reste les photos ; citer la copie d\'un PDF retire aussi l\'original (même `fileIdent`)', () => {
  const table = attachmentsTable(STUDY);
  assert.deepEqual(otherAttachments(table, set(1, 2, 3, 4, 5, 6, 8)), { bytes: 20 * 307200, count: 20 });
  assert.deepEqual(otherAttachments(table, set(6)), { bytes: 27499315 - 153600, count: 25 });
  assert.deepEqual(otherAttachments(table, set(7, 9)), { bytes: 27499315, count: 26 }, 'une pièce supprimée que citerait un fichier ne change rien : elle n\'est pas comptée');
});

test('otherAttachments : la plus grande taille d\'un même `fileIdent` ; une taille absente, négative ou illisible compte zéro mais la pièce compte ; sans `fileIdent`, chaque ligne est une pièce', () => {
  const table = { id: [1, 2, 3, 4], fileIdent: ['x', 'x', 'y', 'z'], fileSize: [10, 40, 'pas un nombre', -5], timeDeleted: [null, null, null, null] };
  assert.deepEqual(otherAttachments(table, set()), { bytes: 40, count: 3 });
  assert.deepEqual(otherAttachments({ id: [1, 2, 3], fileSize: [5, 6, 7] }, set()), { bytes: 18, count: 3 }, 'sans `fileIdent` ni `timeDeleted` : toutes vivantes, une par ligne');
  assert.deepEqual(otherAttachments({ id: [1, 2], fileIdent: ['', 'q'], fileSize: [5, 6], timeDeleted: [undefined, null] }, set(1)), { bytes: 6, count: 1 }, 'un `fileIdent` vide se lit par le numéro de la ligne, qu\'un fichier peut citer');
});

test('otherAttachments : une table absente, vide ou qui n\'est pas celle de Grist n\'ajoute rien', () => {
  const nothing = { bytes: 0, count: 0 };
  for (const table of [null, undefined, {}, { id: [] }, { id: 'pas une colonne' }, 'texte', 42]) assert.deepEqual(otherAttachments(table, set()), nothing, JSON.stringify(table));
});
