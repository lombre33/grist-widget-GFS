// « Nouveau > Importer » (contrats 5.4, point 1) : les formats d'une app, le fichier reconnu par ses extensions, l'ouverture qu'on passe à l'app. Le sélecteur de fichier
// est du navigateur : ce que GFS lui demande (un champ caché, cliqué dans le geste de la personne) se teste ici, ce que le navigateur en fait se mesure dans le labo (run-importer.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importFormats, acceptsFile, importOpening, openingKind, pickFile } from '../js/import-file.js';
import { publipostage, automation, form } from './helpers.mjs';

test('les formats d\'une app : chacun avec le type qu\'il crée, dans l\'ordre du manifeste', () => {
  const formats = importFormats(publipostage());
  assert.deepEqual(formats.map(({ item, type }) => [item.valeur, type.valeur, type.icone]), [['excel', 'grille', 'grid'], ['markdown', 'document', 'doc'], ['powerpoint', 'presentation', 'slides']]);
  assert.deepEqual(importFormats(automation()), [], 'une app sans `actions.importer` n\'a rien dans « Importer »');
  assert.deepEqual(importFormats(form()), []);
});

test('un format dont le type n\'est pas déclaré par l\'app est écarté', () => {
  const m = publipostage();
  m.actions.importer.push({ valeur: 'word', type: 'tableau', nom: { fr: 'Word', en: 'Word' }, extensions: ['.docx'] });
  assert.deepEqual(importFormats(m).map(({ item }) => item.valeur), ['excel', 'markdown', 'powerpoint']);
  delete m.actions;
  assert.deepEqual(importFormats(m), []);
});

test('le fichier choisi doit porter l\'une des extensions du format, quelle que soit la casse', () => {
  const excel = ['.xlsx', '.xlsm'];
  assert.equal(acceptsFile('Budget 2026.xlsx', excel), true);
  assert.equal(acceptsFile('BUDGET.XLSM', excel), true);
  assert.equal(acceptsFile('budget.xls', excel), false, 'l\'ancien format n\'est pas proposé par le sélecteur : un .xls choisi malgré tout est dit avant d\'ouvrir l\'app');
  assert.equal(acceptsFile('xlsx', excel), false, 'une extension, pas un nom qui se termine par ces lettres');
  assert.equal(acceptsFile('notes.md.exe', ['.md']), false);
  assert.equal(acceptsFile('', excel), false);
});

test('l\'ouverture d\'un import : « Nouveau » du type du format, avec le format et le fichier, raison « importer »', () => {
  const entry = { app: 'publipostage', valeur: 'excel', type: 'grille' };
  const file = { name: 'budget.xlsx' };
  const opening = importOpening(entry, file, 'Clients');
  assert.deepEqual(opening, { fichier: null, type: 'grille', dossier: 'Clients', raison: 'importer', importation: { valeur: 'excel', fichier: file } });
  assert.equal(opening.importation.fichier, file, 'le même objet : GFS ne lit pas le fichier, le sous-cadre le lira');
});

test('le genre d\'une ouverture range « importer » à part de « nouveau » et de « fichier »', () => {
  assert.equal(openingKind({ fichier: { id: '3', type: 'document' }, type: 'document', raison: 'explorateur' }), 'fichier');
  assert.equal(openingKind({ fichier: null, type: 'document', raison: 'nouveau' }), 'nouveau');
  assert.equal(openingKind(importOpening({ valeur: 'excel', type: 'grille' }, {}, '')), 'importer');
});

// Un document de faux : le champ `file` caché que `pickFile` pose, avec ce que `pickFile` en attend (des écouteurs, `remove`, `click`).
function fakeDoc() {
  const doc = { appended: [], body: { append: node => doc.appended.push(node) } };
  doc.createElement = tag => {
    const input = Object.assign(new EventTarget(), { tag, files: null, removed: false, clicks: 0 });
    input.remove = () => { input.removed = true; };
    input.click = () => { input.clicks += 1; };
    return input;
  };
  return doc;
}

test('le sélecteur est un champ « file » caché, posé dans la page et cliqué dans l\'appel même (le geste de la personne)', () => {
  const doc = fakeDoc();
  void pickFile(doc, '.xlsx,.xlsm');
  const [input] = doc.appended;
  assert.equal(doc.appended.length, 1);
  assert.deepEqual([input.tag, input.type, input.accept, input.hidden], ['input', 'file', '.xlsx,.xlsm', true]);
  assert.equal(input.clicks, 1, 'cliqué avant tout `await` : le navigateur refuse un sélecteur ouvert hors du geste');
});

test('le fichier choisi est rendu, et le champ retiré de la page', async () => {
  const doc = fakeDoc();
  const picking = pickFile(doc, '.md');
  const [input] = doc.appended;
  const file = { name: 'notes.md' };
  input.files = [file];
  input.dispatchEvent(new Event('change'));
  assert.equal(await picking, file);
  assert.equal(input.removed, true);
});

test('annuler le sélecteur rend `null` (rien ne s\'ouvre), un changement sans fichier aussi', async () => {
  const doc = fakeDoc();
  const cancelled = pickFile(doc, '.md');
  doc.appended[0].dispatchEvent(new Event('cancel'));
  assert.equal(await cancelled, null);
  assert.equal(doc.appended[0].removed, true);
  const empty = pickFile(doc, '.md');
  doc.appended[1].files = [];
  doc.appended[1].dispatchEvent(new Event('change'));
  assert.equal(await empty, null);
});
