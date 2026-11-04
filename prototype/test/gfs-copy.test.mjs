// La copie d'un fichier d'une app (js/gfs-copy.js, contrats 2.4 `copie`) : la recette du manifeste, le nom de la copie, ce qu'on écrit dans la table de l'app. Du code sans effet de bord : des tables en mémoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyPlan, copyRecipeOf } from '../js/gfs-copy.js';
import { publipostage, form } from './helpers.mjs';

const spec = publipostage().fichiers[0];
const COLUMNS = [['Nom', 'Text'], ['Contenu', 'Text'], ['TypeModele', 'Text'], ['DateModif', 'DateTime'], ['ModifiePar', 'Text'], ['EstParDefaut', 'Bool'], ['Jeton', 'Text'], ['Pieces', 'Attachments']]
  .map(([id, type]) => ({ id, type }));

const table = () => ({
  id: [1, 2, 3, 4],
  Nom: ['Convocation', 'Attestation', 'Convocation (1)', '@reglages'],
  Contenu: ['<p>un</p>', '<p>deux</p>', '<p>trois</p>', '{}'],
  TypeModele: ['document', 'grille', 'document', 'reglages'],
  DateModif: [100, 200, 300, 400],
  ModifiePar: ['ana@exemple.org', '', 'paul@exemple.fr', ''],
  EstParDefaut: [true, false, false, false],
  Jeton: ['j1', 'j2', 'j3', ''],
  Pieces: [['L', 9], null, null, null],
});

test('la recette est `copie.ligne: true` ; sans elle, ou sans `ligne`, l\'app n\'a pas dit comment copier ses fichiers', () => {
  assert.deepEqual(copyRecipeOf(spec), { ligne: true, uniques: ['Jeton'], exclusives: ['EstParDefaut'] });
  assert.equal(copyRecipeOf(form().fichiers[0]), null, 'Form+ : composite, pas de recette');
  assert.equal(copyRecipeOf({ copie: {} }), null);
  assert.equal(copyRecipeOf({ copie: { ligne: false } }), null);
  assert.equal(copyRecipeOf(null), null);
});

test('la copie a les valeurs de l\'original, sauf le nom (le premier libre), le jeton (vide) et l\'étoile du modèle par défaut (éteinte)', () => {
  const plan = copyPlan({ spec, data: table(), at: 0, columns: COLUMNS });
  assert.equal(plan.name, 'Convocation (2)', '« Convocation (1) » est pris');
  assert.deepEqual(plan.values, {
    Nom: 'Convocation (2)', Contenu: '<p>un</p>', TypeModele: 'document', DateModif: 100, ModifiePar: 'ana@exemple.org', EstParDefaut: false, Jeton: '', Pieces: ['L', 9],
  });
  assert.equal('id' in plan.values, false, 'le numéro de ligne est celui que Grist donne');
});

test('la date et l\'auteur de l\'original restent : le contenu est le même, c\'est l\'app qui les met à jour quand elle enregistre', () => {
  const plan = copyPlan({ spec, data: table(), at: 2, columns: COLUMNS });
  assert.deepEqual([plan.values.DateModif, plan.values.ModifiePar], [300, 'paul@exemple.fr']);
  assert.equal(plan.name, 'Convocation (2)', 'un numéro au bout du nom est remplacé, jamais empilé');
});

test('une ligne réservée n\'est pas un fichier : son nom ne prend aucun nom', () => {
  const data = table();
  data.Nom[3] = 'Attestation (1)';
  assert.equal(copyPlan({ spec, data, at: 1, columns: COLUMNS }).name, 'Attestation (1)', 'la ligne « reglages » n\'est pas dans la liste des noms');
});

test('le jeton se vide selon le type de sa colonne : un texte, sinon rien ; une colonne qui n\'existe pas n\'est jamais écrite', () => {
  const other = { ...spec, copie: { ligne: true, uniques: ['Jeton', 'Numero', 'Absente'], exclusives: ['EstParDefaut', 'AussiAbsente'], valeurs: { Rien: 1, Nom: 'forcé ?' } } };
  const columns = [...COLUMNS, { id: 'Numero', type: 'Int' }];
  const data = { ...table(), Numero: [7, 8, 9, 0] };
  const { values } = copyPlan({ spec: other, data, at: 0, columns });
  assert.equal(values.Jeton, '');
  assert.equal(values.Numero, null, 'un nombre n\'a pas de texte vide');
  assert.equal(values.EstParDefaut, false);
  assert.equal(values.Nom, 'forcé ?', '`valeurs` passe en dernier : l\'app décide');
  assert.deepEqual(Object.keys(values).sort(), [...columns.map(column => column.id)].sort(), 'aucune colonne de plus : ni Absente, ni AussiAbsente, ni Rien');
});

test('une colonne que Grist ne rend pas (formule, droits d\'accès) n\'est pas écrite ; sans colonne du nom, pas de copie', () => {
  const data = table();
  delete data.Contenu;
  const { values } = copyPlan({ spec, data, at: 0, columns: COLUMNS });
  assert.equal('Contenu' in values, false);
  const noName = COLUMNS.filter(column => column.id !== 'Nom');
  assert.equal(copyPlan({ spec, data: table(), at: 0, columns: noName }), null, 'la copie porterait le nom de l\'original : refusée');
});

test('la copie est une ligne comme les autres : elle ne change pas la table lue', () => {
  const data = table();
  const before = JSON.stringify(data);
  copyPlan({ spec, data, at: 0, columns: COLUMNS });
  assert.equal(JSON.stringify(data), before);
});
