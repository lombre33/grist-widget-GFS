// Les sous-annuaires (module Annuaire, demande du porteur du 25/11, scène 10 de la maquette) : un annuaire qui ne contient que certaines personnes d'un autre
// (l'annuaire d'origine), et que Grist ne montre qu'à certaines personnes. Du code sans effet de bord, essayé sous Node (test/annuaire-sub.test.mjs).
//
// Le verrou est celui de Grist, jamais un filtre d'écran : un filtre d'affichage n'arrête personne (cahier 2, « deux zones »). La table des personnes reste
// à son propriétaire, et GFS n'y pose aucune règle ; ce que Grist verrouille est une COPIE, que GFS range dans la ligne du sous-annuaire (`Copy`, de
// `GFS_Directories`) : la table de GFS que le moteur de partage couvre (js/sharing/sharing-model.js, `ANNUAIRES_TARGET`), avec les mêmes lignes « qui voit
//   quoi »
//   que les fichiers (lecture, écriture, administration, aucun accès, pour une personne, un groupe ou une catégorie). La copie dit quand elle a été prise ; la
//   reprendre (« Actualiser ») relit l'annuaire d'origine, donc ce que la personne qui actualise y lit.
//
// Ce qu'une copie garde : les personnes (le nom, le poste, l'adresse, le téléphone, les niveaux et les champs de l'annuaire, avec leurs valeurs déjà lues) et
// le strict nécessaire du schéma pour les montrer (le type des champs) ; jamais une colonne que l'annuaire ne montre pas.

import { filterPeople, filterOptions } from './annuaire-model.js';
import { columnOf } from './annuaire-schema.js';
import { fieldPath, writeConfig } from './annuaire-config.js';

export const FICHES_VERSION = 1;

// Un sous-annuaire est une ligne qui nomme son annuaire d'origine.
export const isSub = annuaire => Boolean(annuaire && annuaire.parent);

// L'annuaire d'origine d'un sous-annuaire dans la liste lue (`Parent` : le numéro de sa ligne), ou null quand il n'existe plus.
export const parentOf = (list, annuaire) => (isSub(annuaire) ? list.find(each => String(each.row) === annuaire.parent && !isSub(each)) || null : null);

// Les sous-annuaires d'un annuaire de la liste, dans l'ordre de la liste.
export const subsOf = (list, annuaire) => list.filter(each => isSub(each) && each.parent === String(annuaire.row));

// L'ordre de la liste : chaque annuaire principal suivi de ses sous-annuaires ; un sous-annuaire dont l'origine a disparu reste à la fin (il se retrouve et
// se supprime).
export function orderAnnuaires(list) {
  const mains = list.filter(each => !isSub(each));
  const placed = new Set();
  const out = [];
  for (const main of mains) {
    out.push(main);
    for (const sub of subsOf(list, main)) { out.push(sub); placed.add(sub.row); }
  }
  return [...out, ...list.filter(each => isSub(each) && !placed.has(each.row))];
}

// Les critères qu'on peut choisir pour « contient les personnes dont… » : les niveaux de la hiérarchie et les champs réglés en filtre de l'annuaire d'origine
// (js/annuaire/annuaire-model.js, `filterOptions`), avec leurs valeurs et le nombre de personnes par valeur ; sans ceux qui n'ont aucune valeur.
export function criteriaOf(read, people = read.people) {
  return filterOptions(people, read.config, read.schema, read.annuaire.table).filter(option => option.values.length > 0);
}

// Les personnes que le critère `sub` retient (« ou » entre ses valeurs).
export const peopleOfSub = (people, sub) => filterPeople(people, { filters: { [sub.key]: new Set(sub.values) } });

// Les personnes qu'une copie peut garder : celles de l'annuaire d'origine que la lecture montre, sans celles qui ont choisi de ne pas apparaître (« Ma
// présence ») : une personne masquée ne se retrouve pas dans une copie que d'autres liront.
export const copyable = read => read.people.filter(person => !(read.masked && read.masked.has(person.row)));

// Le schéma minimal de la copie : la table des personnes et les tables que les champs suivent, avec seulement les colonnes d'un champ (le type suffit pour
// les montrer), jamais les autres colonnes du document.
export function miniSchema(config, tableId, schema) {
  const out = {};
  const keep = (table, id) => {
    const col = columnOf(schema, table, id);
    if (!col) return null;
    out[table] ??= { columns: [] };
    if (!out[table].columns.some(each => each.id === col.id)) out[table].columns.push({ ...col, formula: false, choices: [] });
    return col;
  };
  for (const field of config.fields) {
    let at = tableId;
    for (const id of fieldPath(field)) {
      const col = at ? keep(at, id) : null;
      at = col && col.genre === 'ref' ? col.ref : '';
    }
  }
  return out;
}

const PERSON_KEYS = ['row', 'name', 'sort', 'initials', 'title', 'email', 'phone', 'levels', 'fields', 'rel', 'lead', 'manager', 'avatar', 'logo', 'logoAt',
  'logoLevel'];

// Le texte d'une copie : les personnes telles que la lecture les a construites, le schéma minimal et le moment (`at`, un texte ISO).
export const packFiches = ({ people, schema, at }) => JSON.stringify({ v: FICHES_VERSION, at,
  schema, people: people.map(person => Object.fromEntries(PERSON_KEYS.map(key => [key, person[key]]))) });

const text = value => (typeof value === 'string' ? value : '');
const list = value => (Array.isArray(value) ? value.map(String) : []);
const number = (value, otherwise) => (Number.isInteger(value) ? value : otherwise);
// La cellule qui porte un logo ({ table, col, row }), ou null.
const cellOf = value => (value && typeof value === 'object' && typeof value.table === 'string' && typeof value.col === 'string' && Number.isInteger(value.row)
  ? { table: value.table, col: value.col, row: value.row } : null);

// Une personne relue d'une copie, avec tout ce que l'écran lit (jamais d'exception : une valeur absente est vide).
function personOf(raw, depth) {
  const object = raw && typeof raw === 'object' ? raw : {};
  const fields = object.fields && typeof object.fields === 'object' && !Array.isArray(object.fields) ? object.fields : {};
  const rel = object.rel && typeof object.rel === 'object' && !Array.isArray(object.rel) ? object.rel : {};
  const levels = list(object.levels);
  return { row: Number(object.row), name: text(object.name), sort: text(object.sort) || text(object.name), initials: text(object.initials),
    title: text(object.title),
    email: text(object.email), phone: text(object.phone), levels: Array.from({ length: depth }, (_, at) => levels[at] || ''),
    fields: Object.fromEntries(Object.entries(fields).map(([col, values]) => [col, list(values)])),
    rel: Object.fromEntries(Object.entries(rel).map(([col, rows]) => [col, Array.isArray(rows) ? rows.map(Number).filter(Number.isFinite) : []])),
    lead: object.lead === true, manager: Number.isFinite(object.manager) && object.manager > 0 ? object.manager : null,
    avatar: number(object.avatar, 0), logo: number(object.logo, 0), logoAt: cellOf(object.logoAt), logoLevel: number(object.logoLevel, -1) };
}

// La copie lue d'un texte : { people, schema, at } ; une copie vide ou abîmée donne aucune personne, sans exception. `depth` : le nombre de niveaux de la
// hiérarchie de l'annuaire (une copie plus courte est complétée par des niveaux vides).
export function unpackFiches(source, depth = 0) {
  let raw = null;
  try { raw = JSON.parse(source); } catch (error) { raw = null; }
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const people = (Array.isArray(input.people) ? input.people : []).map(each => personOf(each, depth)).filter(person => Number.isFinite(person.row) &&
    person.name);
  const schema = input.schema && typeof input.schema === 'object' && !Array.isArray(input.schema) ? input.schema : {};
  return { people, schema, at: text(input.at) };
}

// La ligne qu'on ajoute à `GFS_Directories` pour un nouveau sous-annuaire. `parent` : l'annuaire d'origine ({ row, table, config }) ; `sub` : le critère
// ({ key, label, values }) ; `read` : la lecture de l'annuaire d'origine (ses personnes, son schéma) ; `at` : le moment.
export function subRecord({ name, parent, sub, read, at }) {
  const people = peopleOfSub(copyable(read), sub);
  const kept = { ...sub, at };
  return { people, record: { Name: String(name ?? '').trim(), Table: parent.table, Config: writeConfig({ ...read.config, sub: kept }),
    Parent: String(parent.row),
    Copy: packFiches({ people, schema: miniSchema(read.config, parent.table, read.schema), at }) } };
}

// Les valeurs qu'un sous-annuaire change quand on l'actualise : la définition reprise de l'annuaire d'origine (ses niveaux et ses champs), le critère
// gardé, la copie et son moment.
export function refreshRecord({ sub, parent, read, at }) {
  const { people, record } = subRecord({ name: parent.name, parent, sub, read, at });
  return { people, record: { Table: record.Table, Config: record.Config, Copy: record.Copy } };
}
