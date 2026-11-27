// La définition d'un guide des démarches (module Guide, demande du porteur du 27/11) : une ligne de la table `GFS_Guides` que GFS crée avec l'accord de la
// personne (js/files/own-table.js). Ce module ne parle ni à Grist ni à la page : il dit ce que la table contient et lit, sans jamais échouer, ce qu'une
// personne ou une version plus ancienne y a écrit.
//
// Une ligne : `Name` (le nom du guide), `Table` (la table des démarches, celle du document), `Config` (le reste, en JSON : voir `readConfig`), `Parent` et
// `Copy` (réservées aux sous-guides, comme pour les annuaires : vides pour un guide principal). Les démarches restent dans leur table : GFS la lit, ne la copie
// pas (cahier 2, « deux zones »). Une démarche est une ligne ; son titre, sa démarche mère, ses mots-clés, ses étapes et ses détails sont des colonnes au
// choix ; un RÔLE est une colonne aussi : le type de la colonne dit ce qu'elle désigne (une référence à la table des personnes : une personne ; une autre
// référence : un service ; du texte : un poste).

import { GUIDES_TABLE } from '../files/guide-files.js';
import { listOf } from '../sharing/direct-shares.js';

export { GUIDES_TABLE };
export const GUIDES_COLUMNS = Object.freeze([
  { id: 'Name', type: 'Text' }, { id: 'Table', type: 'Text' }, { id: 'Config', type: 'Text' }, { id: 'Parent', type: 'Text' }, { id: 'Copy', type: 'Text' },
]);
export const CONFIG_VERSION = 1;

// La table que GFS crée quand le document n'a pas encore de table de démarches (« laisser l'option d'en créer une », comme pour l'annuaire) : le titre, et les
// colonnes que le guide lit par un nom. La référence à la démarche mère s'ajoute après la table (elle vise la table elle-même, dont l'identifiant réel n'est
// connu qu'une fois créée). Des noms anglais dès le départ (décision du 25/11) ; le préfixe `GFS_` est celui de la mécanique de GFS : la table des démarches
// est celle de la personne.
export const PROCEDURE_TABLE = Object.freeze({ id: 'Guide_Procedures', title: 'Title', parent: 'Parent', keywords: 'Keywords', steps: 'Steps',
  details: 'Details' });
export const PROCEDURE_COLUMNS = Object.freeze([{ id: 'Title', type: 'Text' }, { id: 'Keywords', type: 'Text' }, { id: 'Steps', type: 'Text' },
  { id: 'Details', type: 'Text' }]);

// Les rôles qu'un guide propose d'office, dans l'ordre où la fiche les montre (un rôle de plus : `other`). `fallback` est « À défaut » : celui qu'on appelle
// quand le contact d'un autre rôle est introuvable (poste vacant, personne absente de l'annuaire ou masquée).
export const ROLE_PRESETS = Object.freeze(['ask', 'validate', 'problem', 'fallback', 'other']);
export const MAX_ROLES = 12;

const text = value => (typeof value === 'string' ? value.trim() : '');

export const FIELD_SHAPES = Object.freeze(['text', 'long', 'list', 'link']);
export const MAX_FIELDS = 16;
export const MAX_TYPES = 12;
export const REVIEW_MONTHS = 12; // la relecture que « À vérifier » attend d'une démarche tant que le guide n'en dit pas d'autre
export const MAX_REVIEW_MONTHS = 60;
const ID_RE = /^[a-z][a-z0-9]{0,23}$/;

// Les champs en plus et les types (27/11, option A du porteur : « champs par type, plus un texte libre ») : `kind` est la colonne qui garde le type d'une
// démarche ; chaque champ est une colonne de texte de la table, avec sa forme (`text` : une ligne, `long` : un paragraphe, `list` : une liste séparée par des
// virgules,
// `link` : une adresse web) ; un type dit quels champs il demande (`fields`, par identifiant) et quels rôles de contact il montre (`roles`, par réglage ;
//   vide : tous). Les types livrés (js/guide/guide-types.js) s'installent d'un geste ; la personne peut en écrire d'autres.
function readFields(input, once) {
  const found = [];
  for (const item of Array.isArray(input) ? input : []) {
    const id = text(item && item.id);
    if (!ID_RE.test(id) || found.some(each => each.id === id)) continue;
    const col = once(item.col);
    if (!col) continue;
    found.push({ id, label: text(item.label), col, shape: FIELD_SHAPES.includes(item.shape) ? item.shape : 'text' });
  }
  return found.slice(0, MAX_FIELDS);
}

function readTypes(input, fields) {
  const found = [];
  for (const item of Array.isArray(input) ? input : []) {
    const id = text(item && item.id);
    if (!ID_RE.test(id) || found.some(each => each.id === id)) continue;
    const ids = (Array.isArray(item.fields) ? item.fields : []).map(text).filter((each, at, all) => fields.some(field => field.id === each) &&
      all.indexOf(each) === at);
    const roles = (Array.isArray(item.roles) ? item.roles : []).filter((each, at, all) => ROLE_PRESETS.includes(each) && all.indexOf(each) === at);
    found.push({ id, label: text(item.label), glyph: text(item.glyph) || 'guide', fields: ids, roles });
  }
  return found.slice(0, MAX_TYPES);
}

// La configuration lue d'un texte JSON (ou d'un objet) : toujours complète, jamais d'exception. Ce que GFS ne connaît pas (une clé d'une version plus récente)
// est ignoré à la lecture et perdu à la réécriture. { v, title, parent, keywords, steps, details, directory, roles: [{ col, label, preset }], kind, fields,
// types, draft (la colonne « Brouillon »), verified (la colonne « Vérifiée le »), reviewMonths (tous les combien de mois relire ; 0 : jamais) }
// `directory` : le numéro de ligne de l'annuaire dont viennent les contacts (vide : aucun, les rôles se lisent comme du texte, les gestes de contact sont
//   grisés). Une colonne ne sert qu'à un seul usage (titre, mère, mots-clés, étapes, détails, un rôle, le type, un champ).
export function readConfig(source) {
  let raw = source;
  if (typeof source === 'string') {
    try { raw = JSON.parse(source); } catch (error) { raw = null; }
  }
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const config = { v: CONFIG_VERSION };
  const used = new Set();
  const once = value => { const col = text(value); if (!col || used.has(col)) return ''; used.add(col); return col; };
  for (const key of ['title', 'parent', 'keywords', 'steps', 'details']) config[key] = once(input[key]);
  const directory = typeof input.directory === 'number' ? String(input.directory) : text(input.directory);
  config.directory = /^\d+$/.test(directory) ? directory : '';
  const roles = Array.isArray(input.roles) ? input.roles : [];
  let fallback = false;
  config.roles = roles.map(role => {
    const col = once(role && role.col);
    let preset = ROLE_PRESETS.includes(role && role.preset) ? role.preset : 'other';
    if (preset === 'fallback') { if (fallback) preset = 'other'; fallback = true; }
    return col ? { col, label: text(role.label) || col, preset } : null;
  }).filter(Boolean).slice(0, MAX_ROLES);
  config.kind = once(input.kind);
  config.draft = once(input.draft);
  config.verified = once(input.verified);
  const months = Number(input.reviewMonths);
  config.reviewMonths = Number.isInteger(months) && months >= 0 && months <= MAX_REVIEW_MONTHS ? months : REVIEW_MONTHS;
  config.fields = readFields(input.fields, once);
  config.types = readTypes(input.types, config.fields);
  return config;
}

export const writeConfig = config => JSON.stringify(readConfig(config));

// Les adresses d'une colonne d'aide du partage (`GFS_Writers`, `GFS_Admins` : js/sharing/sharing-model.js), en minuscules ; rien quand le partage n'a pas
// étendu la table.
const addressesIn = cell => listOf(cell).map(each => String(each).trim().toLowerCase()).filter(Boolean);

// Les guides d'une table lue : [{ row, name, table, config, parent, access }]. Une ligne sans nom ou sans table est ignorée (GFS ne saurait pas l'ouvrir).
export function guidesOf(data) {
  const rows = data && Array.isArray(data.id) ? data.id : [];
  const cell = (column, i) => (Array.isArray(data[column]) ? data[column][i] : undefined);
  const found = [];
  rows.forEach((row, i) => {
    const name = text(cell('Name', i));
    const table = text(cell('Table', i));
    if (name && table) found.push({ row, name, table, config: readConfig(cell('Config', i)), parent: text(cell('Parent', i)),
      access: { writers: addressesIn(cell('GFS_Writers', i)), admins: addressesIn(cell('GFS_Admins', i)) } });
  });
  return found;
}

// Le dossier d'un nouveau guide, tel que `AddRecord` le reçoit.
export const newRecord = (name, table, config) => ({ Name: text(name), Table: text(table), Config: writeConfig(config), Parent: '' });

// Les actions de Grist qui créent ou réécrivent une ligne, une colonne ou une table (les mêmes que celles de l'annuaire : js/annuaire/annuaire-config.js).
export { addAction, updateAction, addColumnAction, addTableAction, displayAction } from '../annuaire/annuaire-config.js';
