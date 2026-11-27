// Les images de l'annuaire (module Annuaire, 27/11 : « un avatar » et « un logo en haut à droite de la carte » ; choix du porteur : les pièces jointes de Grist) :
// la lecture des colonnes « Pièces jointes » (le modèle), le niveau qui porte le logo, la copie d'un sous-annuaire, la photo de « Modifier la fiche », et le
// chargeur (concurrence, mémoire, échec). Le dessin lui-même (réduction, rognage, contraste, place) se mesure sous Firefox (test/annuaire-images-firefox.mjs) et
// l'envoi dans un vrai Grist (labo/run-annuaire-images-ui.mjs) : rien de cela n'existe sous Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, writeConfig, logoLevelOf } from '../js/annuaire/annuaire-config.js';
import { schemaOf, tablesNeeded } from '../js/annuaire/annuaire-schema.js';
import { buildPeople, buildTree, attachmentOf, lookup } from '../js/annuaire/annuaire-model.js';
import { packFiches, unpackFiches, miniSchema } from '../js/annuaire/annuaire-sub.js';
import { editableFields, valueOf, personValues, cellOf, changesOf, updateOf, PHOTO } from '../js/annuaire/annuaire-edit.js';
import { blankValues, bulkAddOf } from '../js/annuaire/annuaire-add.js';
import { say } from '../js/annuaire/annuaire-edit-controls.js';
import { useImages, imagesReady, canUpload, loadImage, imageIn, rememberImage, targetSize, prepareImage, IMAGE_MAX } from '../js/annuaire/annuaire-images.js';
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

// Le document fictif, avec une colonne « Pièces jointes » pour la photo des personnes et une pour le logo des structures.
function withImages() {
  const doc = documentFixture();
  const cols = doc._grist_Tables_column;
  for (const [id, parent, colId] of [[50, 1, 'Photo'], [51, 2, 'Logo'], [52, 1, 'Calcul']]) {
    cols.id.push(id); cols.parentId.push(parent); cols.colId.push(colId); cols.type.push('Attachments'); cols.visibleCol.push(0); cols.widgetOptions.push('');
    cols.isFormula.push(colId === 'Calcul');
  }
  doc.Personnes.Photo = [['L', 11], null, ['L', 12, 13], [], null, ['L', 'x']];
  doc.Personnes.Calcul = [null, null, null, null, null, null];
  doc.Structures.Logo = [['L', 20], null, ['L', 21], null, null, null, null];
  return doc;
}
const doc = withImages();
const schema = schemaOf(doc._grist_Tables, doc._grist_Tables_column);
const config = () => ({ ...configFixture(), avatar: 'Photo', logo: 'Structure › Direction › Logo' });
const people = buildPeople(config(), 'Personnes', doc, schema);
const named = name => people.find(person => person.name === name);
const t = key => key;

test('lecture : la photo est le numéro de la première pièce jointe de la cellule, 0 sans photo', () => {
  assert.equal(named('Camille Durand').avatar, 11);
  assert.equal(named('Nathan Roussel').avatar, 12, 'plusieurs pièces jointes : la première');
  for (const name of ['Inès Marchand', 'Louis Girard', 'Emma Rolland']) assert.equal(named(name).avatar, 0, name);
  assert.equal(named('Yanis Morel').avatar, 0, 'une cellule qui ne cite pas de numéro n\'est pas une photo');
  assert.equal(buildPeople(configFixture(), 'Personnes', doc, schema).every(person => person.avatar === 0 && person.logo === 0), true, 'sans réglage, aucune image');
});

test('lecture : le logo se suit par le chemin (la direction de la personne) et dit la cellule qui le porte', () => {
  const camille = named('Camille Durand');
  assert.equal(camille.logo, 21, 'la structure de Camille est un service ; sa direction a le logo');
  assert.deepEqual(camille.logoAt, { table: 'Structures', col: 'Logo', row: 3 });
  assert.equal(camille.logoLevel, 1, 'le niveau « Direction » porte le logo');
  assert.equal(named('Louis Girard').logo, 0, 'sa direction n\'a pas de logo');
  assert.equal(named('Louis Girard').logoAt, null);
  assert.equal(named('Emma Rolland').logo, 0, 'une structure sans direction : le chemin s\'arrête, rien ne se lit');
});

test('lecture : une colonne qui n\'est pas des pièces jointes, absente ou vide ne rend jamais d\'image', () => {
  const ctx = { ...lookup(doc), schema };
  assert.equal(attachmentOf(ctx, 'Personnes', 0, ['Nom']), null);
  assert.equal(attachmentOf(ctx, 'Personnes', 0, ['Absente']), null);
  assert.equal(attachmentOf(ctx, 'Personnes', 1, ['Photo']), null, 'cellule vide');
  assert.equal(attachmentOf(ctx, 'Personnes', 3, ['Photo']), null, 'liste vide');
  assert.equal(attachmentOf(ctx, 'Personnes', 0, []), null);
  assert.deepEqual(attachmentOf(ctx, 'Personnes', 0, ['Photo']), { id: 11, table: 'Personnes', col: 'Photo', row: 1 });
  assert.deepEqual(attachmentOf(ctx, 'Personnes', 0, ['Structure', 'Direction', 'Logo']), { id: 21, table: 'Structures', col: 'Logo', row: 3 });
});

test('niveau du logo : celui dont le chemin est celui du logo moins sa dernière colonne, -1 sinon', () => {
  const levels = configFixture().levels;
  assert.equal(logoLevelOf({ levels, logo: 'Structure › Direction › Logo' }), 1);
  assert.equal(logoLevelOf({ levels, logo: 'Structure › Pole › Logo' }), 0);
  assert.equal(logoLevelOf({ levels, logo: 'Service › Logo' }), 2);
  assert.equal(logoLevelOf({ levels, logo: 'Logo' }), -1, 'le logo de la personne : aucun niveau');
  assert.equal(logoLevelOf({ levels, logo: 'Structure › Autre › Logo' }), -1, 'aucun niveau ne suit ce chemin');
  assert.equal(logoLevelOf({ levels, logo: '' }), -1);
  assert.equal(logoLevelOf({ levels: [], logo: 'Structure › Direction › Logo' }), -1);
});

test('arbre : le nœud du niveau qui porte le logo le prend de ses personnes, les autres nœuds n\'en ont pas', () => {
  const tree = buildTree(people, readConfig(config()).levels, 'Tout');
  const walk = node => [node, ...node.ch.flatMap(walk)];
  const nodes = walk(tree);
  const logos = nodes.filter(node => node.logo).map(node => [node.name, node.level, node.logo, node.logoAt.row]);
  assert.deepEqual(logos, [['Direction des finances', 1, 21, 3]]);
  assert.equal(nodes.filter(node => !node.logo).every(node => node.logoAt === null), true);
});

test('réglage : la photo et le logo se relisent et s\'écrivent sans rien perdre, vides par défaut', () => {
  assert.equal(readConfig({}).avatar, '');
  assert.equal(readConfig({}).logo, '');
  const set = readConfig({ name: 'Nom', avatar: ' Photo ', logo: ' Structure › Direction › Logo ' });
  assert.equal(set.avatar, 'Photo');
  assert.equal(set.logo, 'Structure › Direction › Logo');
  assert.deepEqual(readConfig(writeConfig(set)), set);
});

test('tables lues : le chemin du logo fait lire la table qu\'il traverse, même sans niveau', () => {
  const alone = { ...readConfig(config()), levels: [], fields: [] };
  assert.deepEqual([...tablesNeeded(alone, 'Personnes', schema)].sort(), ['Personnes', 'Structures']);
  assert.deepEqual([...tablesNeeded({ ...alone, logo: '' }, 'Personnes', schema)], ['Personnes']);
});

test('copie : un sous-annuaire garde la photo, le logo et la cellule qui le porte, comme la lecture', () => {
  const read = readConfig(config());
  const text = packFiches({ people, schema: miniSchema(read, 'Personnes', schema), at: '2026-11-27T10:00:00.000Z' });
  const back = unpackFiches(text, 3).people;
  assert.deepEqual(back, people.map(person => ({ ...person, rel: person.rel })));
  assert.equal(back.find(person => person.name === 'Camille Durand').avatar, 11);
  assert.equal(back.find(person => person.name === 'Camille Durand').logoAt.row, 3);
});

test('fiche : la photo est un champ de la fenêtre « Modifier » (identité), seule colonne « Pièces jointes » que GFS écrit', () => {
  const { fields, locked } = editableFields(config(), schema, 'Personnes', t);
  assert.deepEqual(fields.slice(0, 3).map(field => field.key), ['name', 'title', PHOTO]);
  const photo = fields.find(field => field.key === PHOTO);
  assert.deepEqual([photo.col, photo.genre, photo.group, photo.label], ['Photo', 'file', 'identity', 'an.set.avatar']);
  assert.deepEqual(locked, []);
  assert.equal(editableFields({ ...config(), avatar: '' }, schema, 'Personnes', t).fields.some(field => field.key === PHOTO), false, 'sans colonne de photo, pas de champ');
  const calc = editableFields({ ...config(), avatar: 'Calcul' }, schema, 'Personnes', t);
  assert.equal(calc.fields.some(field => field.key === PHOTO), false);
  assert.deepEqual(calc.locked.map(entry => [entry.key, entry.why]), [[PHOTO, 'formula']], 'une colonne que Grist calcule : grisée, avec sa raison');
  const other = editableFields({ ...config(), fields: [{ col: 'Photo', filter: false }] }, schema, 'Personnes', t);
  assert.deepEqual(other.locked.map(entry => [entry.key, entry.why]), [['Photo', 'type']], 'un autre champ « Pièces jointes » reste grisé');
});

test('fiche : la valeur de la photo, ses changements et ce que Grist reçoit', () => {
  const { fields } = editableFields(config(), schema, 'Personnes', t);
  const photo = fields.find(field => field.key === PHOTO);
  assert.deepEqual(valueOf(photo, ['L', 11]), { id: 11, pick: 0, name: '' });
  assert.deepEqual(valueOf(photo, ['L', 12, 13]), { id: 12, pick: 0, name: '' });
  assert.deepEqual(valueOf(photo, null), { id: 0, pick: 0, name: '' });
  assert.deepEqual(valueOf(photo, []), { id: 0, pick: 0, name: '' });
  const before = personValues(fields, doc.Personnes, 1);
  assert.deepEqual(before[PHOTO], { id: 11, pick: 0, name: '' });
  assert.deepEqual(changesOf(fields, before, structuredClone(before)), [], 'rien n\'a changé');
  const picked = { ...structuredClone(before), [PHOTO]: { id: 11, pick: 1, name: 'camille.jpg' } };
  assert.deepEqual(changesOf(fields, before, picked).map(change => change.field.key), [PHOTO], 'une image choisie est un changement');
  const sent = { ...structuredClone(before), [PHOTO]: { id: 77, pick: 0, name: '' } };
  assert.deepEqual(updateOf('Personnes', 1, changesOf(fields, before, sent)), ['UpdateRecord', 'Personnes', 1, { Photo: ['L', 77] }]);
  const removed = { ...structuredClone(before), [PHOTO]: { id: 0, pick: 0, name: '' } };
  assert.deepEqual(updateOf('Personnes', 1, changesOf(fields, before, removed)), ['UpdateRecord', 'Personnes', 1, { Photo: null }], 'retirer : la cellule se vide');
  assert.equal(cellOf(photo, { id: 0, pick: 0, name: '' }), null);
});

test('fiche : la relecture dit la photo actuelle, ou le nom du fichier choisi', () => {
  const { fields } = editableFields(config(), schema, 'Personnes', t);
  const photo = fields.find(field => field.key === PHOTO);
  const host = { t, locale: 'fr', labels: {} };
  assert.equal(say(photo, { id: 11, pick: 0, name: '' }, host), 'an.img.current');
  assert.equal(say(photo, { id: 0, pick: 0, name: '' }, host), '');
  assert.equal(say(photo, { id: 11, pick: 2, name: 'camille.jpg' }, host), 'camille.jpg');
});

test('ajout : une fiche préparée avec sa photo écrit la cellule dans la même action, les fiches sans photo n\'écrivent rien', () => {
  const { fields } = editableFields(config(), schema, 'Personnes', t);
  const blank = blankValues(fields);
  const first = { ...structuredClone(blank), name: 'Zoé Petit', [PHOTO]: { id: 90, pick: 0, name: '' } };
  const second = { ...structuredClone(blank), name: 'Sam Lenoir' };
  const action = bulkAddOf('Personnes', [{ before: blank, values: first }, { before: blank, values: second }], fields);
  assert.equal(action[0], 'BulkAddRecord');
  assert.deepEqual(action[3].Photo, [['L', 90], null]);
  const none = bulkAddOf('Personnes', [{ before: blank, values: second }], fields);
  assert.equal('Photo' in none[3], false, 'une colonne que personne ne remplit n\'est pas écrite');
});

test('réduction : la photo remplit un carré rogné au centre, le logo tient dans sa boîte sans être agrandi', () => {
  assert.deepEqual(targetSize('avatar', 1000, 600), { width: 128, height: 128, crop: 600 });
  assert.deepEqual(targetSize('avatar', 100, 300), { width: 100, height: 100, crop: 100 }, 'une petite photo n\'est pas agrandie');
  assert.deepEqual(targetSize('logo', 400, 100), { width: 192, height: 48, crop: 0 });
  assert.deepEqual(targetSize('logo', 100, 400), { width: 24, height: 96, crop: 0 }, 'la hauteur compte aussi');
  assert.deepEqual(targetSize('logo', 40, 20), { width: 40, height: 20, crop: 0 }, 'un petit logo reste petit');
});

// Une source d'images qui rend la main à l'essai : `settle()` termine tous les téléchargements en cours (en échec : sous Node il n'y a ni Blob lisible ni dessin).
function fakeSource() {
  const source = { calls: [], running: 0, peak: 0, waiting: [], uploads: [] };
  source.download = id => new Promise((resolve, reject) => {
    source.calls.push(id);
    source.running += 1;
    source.peak = Math.max(source.peak, source.running);
    source.waiting.push(() => { source.running -= 1; reject(new Error('hors navigateur')); });
  });
  source.upload = async (file, name) => { source.uploads.push([file, name]); return 40 + source.uploads.length; };
  source.settle = async () => { while (source.waiting.length) { source.waiting.shift()(); await new Promise(resolve => setImmediate(resolve)); } };
  return source;
}

test('chargeur : sans source, rien ne se charge et rien ne casse', async () => {
  useImages(null);
  assert.equal(imagesReady(), false);
  assert.equal(canUpload(), false);
  assert.equal(await loadImage('avatar', 5), '');
  assert.equal(imageIn('avatar', 5), undefined);
  useImages({ nothing: true });
  assert.equal(imagesReady(), false, 'une source sans `download` n\'en est pas une');
  assert.equal(await prepareImage(null), null);
  assert.equal(await prepareImage({ size: IMAGE_MAX + 1 }), null, 'une image trop lourde n\'est pas lue');
  assert.equal(await prepareImage({ size: 5 }, 'inconnu'), null);
});

test('chargeur : trois téléchargements à la fois, une seule demande par image, et un échec est gardé sans exception', async () => {
  const source = fakeSource();
  useImages(source);
  assert.equal(imagesReady(), true);
  assert.equal(canUpload(), true);
  const asked = [1, 2, 3, 4, 5, 2].map(id => loadImage('avatar', id));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(source.peak, 3, 'trois à la fois, pas plus');
  assert.deepEqual(source.calls, [1, 2, 3], 'les autres attendent');
  await source.settle();
  assert.deepEqual(await Promise.all(asked), ['', '', '', '', '', ''], 'une image qui ne vient pas rend \'\'');
  assert.deepEqual([...source.calls].sort(), [1, 2, 3, 4, 5], 'l\'image 2, demandée deux fois, n\'est téléchargée qu\'une fois');
  assert.equal(source.peak, 3);
  assert.equal(imageIn('avatar', 2), '', 'l\'échec reste en mémoire : pas de nouveau téléchargement à chaque dessin');
  await loadImage('avatar', 2);
  assert.equal(source.calls.length, 5);
  assert.equal(await loadImage('avatar', 0), '', 'pas de numéro : pas d\'image');
  assert.equal(await loadImage('inconnu', 7), '');
});

test('chargeur : une photo envoyée est gardée sous son numéro, et une autre source vide la mémoire', async () => {
  const source = fakeSource();
  useImages(source);
  rememberImage('avatar', 41, 'data:image/png;base64,AAAA');
  assert.equal(imageIn('avatar', 41), 'data:image/png;base64,AAAA');
  assert.equal(await loadImage('avatar', 41), 'data:image/png;base64,AAAA');
  assert.deepEqual(source.calls, [], 'rien n\'est retéléchargé');
  rememberImage('avatar', 0, 'data:x');
  rememberImage('avatar', 42, '');
  assert.equal(imageIn('avatar', 42), undefined);
  useImages(fakeSource());
  assert.equal(imageIn('avatar', 41), undefined, 'un autre document : une autre mémoire');
  useImages(null);
});
