// Les types de démarche (module Guide, demande du porteur du 27/11 : « types de procédure, façon de formater pour ceux qui saisissent, plus de liberté » ;
// option A : champs par type, plus un texte libre). Un type est un modèle de fiche : les champs qu'on demande à celui qui écrit, la façon dont la fiche les
// montre à celui qui lit, les rôles de contact qu'elle montre. Six types sont livrés (Demande, Information, Signalement, Rendez-vous, Parcours, Contact seul) ;
// leurs champs sont des colonnes de texte de la table des démarches, que GFS ne crée qu'avec l'accord de la personne. Du code sans effet de bord, essayé sous
// Node.

import { FIELD_SHAPES } from './guide-config.js';

// Les champs livrés : { id, col (le nom de colonne proposé), shape }. Le libellé vient des textes (`gd.fld.<id>`).
export const BUILTIN_FIELDS = Object.freeze([
  { id: 'pieces', col: 'Documents', shape: 'list' }, { id: 'delay', col: 'Delay', shape: 'text' }, { id: 'audience', col: 'Audience', shape: 'text' },
  { id: 'form', col: 'Form_link', shape: 'link' }, { id: 'answer', col: 'Answer', shape: 'long' }, { id: 'source', col: 'Source', shape: 'link' },
  { id: 'phone', col: 'Phone', shape: 'text' }, { id: 'hours', col: 'Hours', shape: 'text' }, { id: 'say', col: 'What_to_say', shape: 'long' },
  { id: 'where', col: 'Place', shape: 'text' }, { id: 'bring', col: 'Bring', shape: 'list' }, { id: 'booking', col: 'Booking_link', shape: 'link' },
  { id: 'when', col: 'When', shape: 'text' },
]);

// Les types livrés : { id, glyph, fields, roles }. Le libellé et la question se lisent dans les textes (`gd.type.<id>`, `gd.type.<id>Hint`).
export const BUILTIN_TYPES = Object.freeze([
  { id: 'request', glyph: 'form', fields: ['pieces', 'delay', 'audience', 'form'], roles: ['ask', 'validate', 'problem', 'fallback'] },
  { id: 'info', glyph: 'book', fields: ['answer', 'source'], roles: ['ask', 'fallback'] },
  { id: 'report', glyph: 'warning', fields: ['phone', 'hours', 'say'], roles: ['ask', 'problem', 'fallback'] },
  { id: 'meeting', glyph: 'pin', fields: ['where', 'hours', 'bring', 'booking'], roles: ['ask', 'fallback'] },
  { id: 'route', glyph: 'route', fields: ['when'], roles: ['ask', 'fallback'] },
  { id: 'contact', glyph: 'users', fields: [], roles: ['ask', 'fallback'] },
]);

export const KIND_COLUMN = 'Type';

const builtinField = id => BUILTIN_FIELDS.find(field => field.id === id);
export const isBuiltinType = id => BUILTIN_TYPES.some(type => type.id === id);
export const isBuiltinField = id => BUILTIN_FIELDS.some(field => field.id === id);

// Le libellé d'un type ou d'un champ : celui des textes pour les livrés (il suit la langue), celui que la personne a écrit sinon.
export const typeLabel = (type, t) => (isBuiltinType(type.id) && !type.label ? t(`gd.type.${type.id}`) : type.label || type.id);
export const fieldLabel = (field, t) => (isBuiltinField(field.id) && !field.label ? t(`gd.fld.${field.id}`) : field.label || field.id);

// Ce qu'il faut installer pour avoir les types livrés : { fields (les champs livrés qui manquent à la configuration, avec le nom de colonne à créer), types
// (ceux qui manquent), kind (vrai quand la colonne du type est à créer) }. Rien n'est installé deux fois.
export function missingBuiltins(config) {
  const haveTypes = new Set(config.types.map(type => type.id));
  const types = BUILTIN_TYPES.filter(type => !haveTypes.has(type.id));
  const needed = new Set(types.flatMap(type => type.fields));
  const haveFields = new Set(config.fields.map(field => field.id));
  return { fields: BUILTIN_FIELDS.filter(field => needed.has(field.id) && !haveFields.has(field.id)), types, kind: !config.kind };
}

// La configuration avec les types livrés installés ; `columns` : { champ ou 'kind' : le nom de colonne créé } (Grist choisit l'identifiant réel).
export function withBuiltins(config, columns) {
  const todo = missingBuiltins(config);
  const fields = [...config.fields, ...todo.fields.filter(field => columns[field.id]).map(field =>
    ({ id: field.id, label: '', col: columns[field.id], shape: field.shape }))];
  const types = [...config.types, ...todo.types.map(type => ({ id: type.id, label: '', glyph: type.glyph, roles: [...type.roles],
    fields: type.fields.filter(id => fields.some(field => field.id === id)) }))];
  return { ...config, kind: config.kind || columns.kind || '', fields, types };
}

// Un identifiant neuf (lettres et chiffres) pour un champ ou un type écrit par la personne, d'après son nom ; `taken` : les identifiants déjà pris.
export function newId(label, taken, prefix = 'x') {
  const base = `${prefix}${String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 20);
  let id = base === prefix ? `${prefix}1` : base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}${n}`.slice(0, 24);
  return id;
}

// Le type d'une démarche : celui que sa cellule désigne (par identifiant), ou null (sans type : la fiche montre ses étapes et ses détails).
export function typeOf(config, proc) {
  return proc && proc.kind ? config.types.find(type => type.id === proc.kind) || null : null;
}

// Les champs que demande un type, dans son ordre : [{ id, label, col, shape }] (ceux de la configuration).
export function fieldsOfType(config, type) {
  return type ? type.fields.map(id => config.fields.find(field => field.id === id)).filter(Boolean) : [];
}

// Les rôles qu'un type montre : tous quand il n'en nomme aucun ; sinon ceux dont le réglage est dans sa liste, et les rôles à soi (`other`) quand la liste le
// dit.
export const showsRole = (type, role) => !type || !type.roles.length || type.roles.includes(role.preset);

// Le contenu d'un champ d'une démarche, tel que la fiche le montre : { text } pour une ligne ou un paragraphe, { items } pour une liste, { href, text } pour
// une adresse web (http ou https seulement : une autre adresse se montre en texte, sans lien), ou null quand le champ est vide.
export function valueOf(field, raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (field.shape === 'list') return { items: value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) };
  if (field.shape === 'link') return /^https?:\/\/[^\s]+$/i.test(value) ? { href: value, text: value.replace(/^https?:\/\//i, '').replace(/\/$/, '') } :
    { text: value };
  return { text: value };
}

// L'ordre d'un parcours : « J−90 », « J+15 », « J-3 » (jours avant ou après le jour J) ; null quand le texte n'en dit pas.
export function dayOf(text) {
  const found = /^\s*J\s*([−–+-])\s*(\d+)\s*$/i.exec(String(text ?? ''));
  return found ? (found[1] === '+' ? 1 : -1) * Number(found[2]) : null;
}

export { FIELD_SHAPES, builtinField };
