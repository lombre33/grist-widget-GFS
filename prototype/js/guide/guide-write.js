// Ce que l'éditeur du guide écrit dans la table des démarches (module Guide, demande du porteur du 27/11 : « toute une interface pour créer les démarches ») :
// quels champs de la table GFS sait écrire, le dossier d'une démarche (seuls les champs qui existent et que la personne a changés), les actions de Grist qui
// créent, réécrivent ou retirent une ligne, et les choix qu'offre chaque champ (les mères possibles, les personnes, les services). Du code sans effet de bord,
// essayé sous Node ; la fenêtre est à js/guide/guide-edit-window.js, l'écriture à js/guide/guide-store.js. Une colonne absente ne s'écrit jamais : une seule
// colonne inconnue ferait annuler tout le lot (cahier 5).

import { columnOf } from '../annuaire/annuaire-schema.js';
import { kindOf } from './guide-contacts.js';

const TEXTUAL = Object.freeze(['text', 'choice']);

// Les champs de la table que le guide lit : [{ key ('title', 'parent', 'keywords', 'steps', 'details' ou 'role:<colonne>'), col, column (la colonne du schéma,
// ou null), mode ('text', 'ref' ou '' quand GFS ne sait pas l'écrire), kind (pour un rôle : 'person', 'service', 'post' ou 'text'), role (le rôle du guide) }].
// Seul le titre est obligatoire ; un champ que le guide n'a pas réglé n'est pas dans la liste.
export function fieldsOf(config, schema, table, directory = null) {
  const field = (key, col, extra = {}) => {
    const column = col ? columnOf(schema, table, col) : null;
    const mode = !column ? '' : (column.genre === 'ref' && key !== 'title' ? 'ref' : (TEXTUAL.includes(column.genre) ? 'text' : ''));
    return { key, col, column, mode, kind: 'text', ...extra };
  };
  const plain = ['title', 'parent', 'keywords', 'steps', 'details'].filter(key => config[key]).map(key => field(key, config[key]));
  const roles = config.roles.map(role => {
    const base = field(`role:${role.col}`, role.col, { role });
    return { ...base, kind: kindOf(base.column, directory), mode: base.column && base.column.genre === 'ref' ? 'ref' : base.mode };
  });
  return [...plain.filter(item => item.key !== 'parent' || (item.column && item.column.genre === 'ref' && item.column.ref === table)), ...roles];
}

// Les valeurs de départ du formulaire : celles de la démarche (rien pour une nouvelle ; `parent` : la mère proposée).
export function valuesFrom(proc, parent = null) {
  const own = key => (proc ? proc.roles[key] : null);
  const values = { title: proc ? proc.title : '', parent: proc ? proc.parent : parent, keywords: proc ? proc.keywords.join(', ') : '',
    steps: proc ? proc.steps.join('\n') : '', details: proc ? proc.details : '', roles: {} };
  for (const key of Object.keys(proc ? proc.roles : {})) {
    const cell = own(key);
    values.roles[key] = cell.ids.length ? { id: cell.ids[0], text: cell.texts[0] || '' } : { id: null, text: cell.texts[0] || '' };
  }
  return values;
}

// La valeur d'une colonne d'après le formulaire.
function cellOf(item, values) {
  if (item.key.startsWith('role:')) {
    const own = values.roles[item.col] || { id: null, text: '' };
    return item.mode === 'ref' ? (own.id || 0) : String(own.text || '').trim();
  }
  if (item.key === 'parent') return values.parent || 0;
  return String(values[item.key] ?? '').trim();
}

// Le dossier à écrire : { colonne: valeur } pour les champs que GFS sait écrire. `before` (les valeurs de départ) : seuls les champs changés s'écrivent, pour
// ne pas réécrire en passant ce que la personne n'a pas touché (une liste de mots-clés mise en forme, par exemple).
export function recordOf(fields, values, before = null) {
  const record = {};
  for (const item of fields) {
    if (!item.mode || !item.col) continue;
    const next = cellOf(item, values);
    if (before && cellOf(item, before) === next) continue;
    record[item.col] = next;
  }
  return record;
}

// Ce qui empêche d'enregistrer : la clé du texte, ou ''.
export function problemOf(fields, values) {
  const title = fields.find(item => item.key === 'title');
  if (!title || !title.mode) return 'gd.proc.errNoTitleCol';
  return String(values.title || '').trim() ? '' : 'gd.proc.errTitle';
}

// Les démarches sous une démarche, de proche en proche : [lignes].
export function descendantsOf(index, row) {
  const out = [];
  const walk = at => { for (const kid of index.children.get(at) || []) { out.push(kid.row); walk(kid.row); } };
  walk(row);
  return out;
}

// Les mères possibles pour une démarche : toutes sauf elle-même et ce qui est sous elle (une mère sous soi ferait une boucle).
export function mothersFor(procs, index, row) {
  const barred = new Set(row === null ? [] : [row, ...descendantsOf(index, row)]);
  return procs.filter(proc => !barred.has(proc.row));
}

// Les actions de Grist : une ligne neuve, une ligne réécrite, une ligne retirée (ses filles passent à la racine : leur mère n'existe plus).
export const addRecordAction = (table, record) => ['AddRecord', table, null, record];
export const updateRecordAction = (table, row, record) => ['UpdateRecord', table, row, record];
export function removeActions(table, row, kids, parentCol) {
  const lift = parentCol ? kids.map(kid => updateRecordAction(table, kid, { [parentCol]: 0 })) : [];
  return [...lift, ['RemoveRecord', table, row]];
}

// Les choix d'un rôle qui désigne une ligne : [{ value (le numéro de ligne), label, hint }]. Une personne vient de l'annuaire du guide ; un service, de la
// table que la colonne vise (la valeur que Grist montre pour une ligne : la colonne visible).
export function choicesFor(item, { directory, data }) {
  if (item.kind === 'person' && directory) return directory.people.map(person => ({ value: person.row, label: person.name, hint: person.title || '' }));
  const col = item.column;
  const table = col && col.ref ? data[col.ref] : null;
  if (!table || !Array.isArray(table.id)) return [];
  const shown = Array.isArray(table[col.visible]) ? table[col.visible] : null;
  return table.id.map((row, at) => ({ value: row, label: shown ? String(shown[at] ?? '').trim() : String(row), hint: '' })).filter(choice => choice.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
