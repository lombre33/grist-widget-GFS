// « À vérifier » (module Annuaire, demande du porteur du 25/11, scène 12 de la maquette) : les fiches qui méritent un coup d'œil. Des fonctions sans effet de
// bord, essayées sous Node (test/annuaire-check.test.mjs) ; la fenêtre est à js/annuaire/annuaire-check-window.js. Cinq contrôles, que l'administrateur allume
// un par un
// (`config.checks`) : un doublon probable (le même nom, ou la même adresse), une adresse manquante, une personne sans aucun rattachement, un responsable
// introuvable, un départ dépassé (la date de départ est passée et la fiche est encore là). Rien n'est changé tout seul : chaque ligne propose le geste, la
// personne le fait.

import { normalize } from '../ui/search.js';
import { CHECK_KINDS, fieldLabel } from './annuaire-config.js';

const lower = value => String(value || '').trim().toLowerCase();

// Pourquoi un contrôle ne peut pas être allumé : la clé du texte, ou null quand la configuration de l'annuaire lui donne de quoi lire.
export function checkNeeds(kind, config) {
  const needs = { mail: config.email, att: config.levels.length, resp: config.manager, dep: config.leave };
  return kind in needs && !needs[kind] ? `an.check.needs.${kind}` : null;
}

// Les groupes de personnes qui portent la même clé (un nom comparable, une adresse) : deux personnes au moins, dans l'ordre de l'annuaire.
function groupsBy(people, keyOf) {
  const groups = new Map();
  for (const person of people) {
    const key = keyOf(person);
    if (key) groups.set(key, [...(groups.get(key) || []), person]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

// Les doublons probables : le même nom comparable (accents, casse et ponctuation ignorés : « Léa Garnier » et « Lea Garnier »), puis la même adresse ; des
// personnes déjà dites ensemble ne le sont qu'une fois (`why` : « name » ou « mail »).
function duplicates(people) {
  const said = new Set();
  const issues = [];
  const add = (group, why) => {
    const rows = group.map(person => person.row);
    const key = [...rows].sort((a, b) => a - b).join(',');
    if (said.has(key)) return;
    said.add(key);
    issues.push({ kind: 'dup', row: rows[0], rows, name: group[0].name, why, others: group.slice(1).map(person => person.name) });
  };
  for (const group of groupsBy(people, person => normalize(person.name))) add(group, 'name');
  for (const group of groupsBy(people, person => lower(person.email))) add(group, 'mail');
  return issues;
}

// Le responsable d'une personne est-il introuvable ? Rend « self » (elle est son propre responsable), « cycle » (la chaîne des responsables revient à elle),
// « missing » (la ligne n'est pas dans l'annuaire) ou '' (rien à dire).
function managerProblem(person, byRow) {
  if (person.manager === null) return '';
  if (person.manager === person.row) return 'self';
  if (!byRow.has(person.manager)) return 'missing';
  for (let at = byRow.get(person.manager), steps = 0; at && steps <= byRow.size; steps++) {
    if (at.row === person.row) return 'cycle';
    at = at.manager === null ? null : byRow.get(at.manager);
  }
  return '';
}

// La date de départ d'une personne (en secondes, minuit UTC) quand elle a une valeur lisible, sinon null.
function leaveOf(read, person) {
  const { config, data, annuaire } = read;
  const table = data && annuaire ? data[annuaire.table] : null;
  const cells = table && Array.isArray(table[config.leave]) ? table[config.leave] : null;
  const cell = cells && Array.isArray(table.id) ? cells[table.id.indexOf(person.row)] : null;
  return typeof cell === 'number' && Number.isFinite(cell) ? cell : null;
}

// Ce qui ne va pas pour une personne, un contrôle à la fois : les problèmes de chaque contrôle allumé.
function personIssues(read, person, on, byRow, midnight) {
  const own = extra => ({ row: person.row, rows: [person.row], name: person.name, ...extra });
  const found = [];
  if (on.includes('mail') && !String(person.email || '').trim()) found.push(own({ kind: 'mail' }));
  if (on.includes('att') && person.levels.every(level => !level)) found.push(own({ kind: 'att' }));
  const trouble = on.includes('resp') ? managerProblem(person, byRow) : '';
  if (trouble) found.push(own({ kind: 'resp', why: trouble, manager: person.manager }));
  const leave = on.includes('dep') && !(read.masked && read.masked.has(person.row)) ? leaveOf(read, person) : null; // une fiche masquée n'est plus « active »
  if (leave !== null && leave < midnight) found.push(own({ kind: 'dep', day: new Date(leave * 1000).toISOString().slice(0, 10) }));
  return found;
}

// Les contrôles allumés qui ont de quoi lire, sur `read` ({ people, config, data, annuaire, masked }) : { issues, counts: { dup, mail, … }, total }. Un
// contrôle éteint, ou sans la colonne qu'il lit, n'a pas de compte. `today` : le jour de « départ dépassé » (une date avant ce jour est dépassée).
export function runChecks(read, today = new Date()) {
  const { people, config } = read;
  const on = CHECK_KINDS.filter(kind => (config.checks || []).includes(kind) && !checkNeeds(kind, config));
  const byRow = new Map(people.map(person => [person.row, person]));
  const midnight = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 1000);
  const issues = [...(on.includes('dup') ? duplicates(people) : []), ...people.flatMap(person => personIssues(read, person, on, byRow, midnight))];
  const counts = Object.fromEntries(on.map(kind => [kind, issues.filter(issue => issue.kind === kind).length]));
  return { issues, counts, total: issues.length };
}

// Les lignes du tableau « Comparer » d'un doublon : une par information que l'annuaire lit (nom, poste, adresse, téléphone, niveaux, champs), avec la valeur
// de chaque personne et `same` quand elles sont égales (une ligne qui ne dit rien de différent se lit d'un coup d'œil). `labels` : les mots des lignes fixes
// ({ name, title, email, phone }).
export function compareRows(people, config, labels) {
  const rows = [['name', labels.name, person => person.name], ['title', labels.title, person => person.title],
    ['email', labels.email, person => person.email], ['phone', labels.phone, person => person.phone],
    ...config.levels.map((level, i) => [`level:${i}`, level.label || level.path.at(-1), person => person.levels[i]]),
    ...config.fields.map(field => [`field:${field.col}`, fieldLabel(field), person => (person.fields[field.col] || []).join(', ')])];
  return rows.map(([key, label, of]) => {
    const values = people.map(person => String(of(person) || '').trim());
    return { key, label, values, same: values.every(value => lower(value) === lower(values[0])) };
  }).filter(row => row.values.some(Boolean));
}
