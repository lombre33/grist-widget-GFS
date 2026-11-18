// La validation de `portees` (contrats 2.6, point 17) : les bibliothèques que l'app charge elle-même, que la fenêtre « Dépendances » montre sous
// l'app comme « Portées par l'app » (demande du porteur, 18/11 : « Oui, déclaré par chaque app »). Un fichier à part pour que `manifest.js` reste
// sous les seuils de l'audit.
//
//   "portees": [ { "id": "tiptap", "nom": "TipTap", "version": "3.31.3", "adresse": "https://esm.sh/", "quand": "demarrage",
//     "contient": ["ProseMirror", "linkifyjs"], "paquet": "@tiptap/core", "note": { "fr": "…", "en": "…" } } ]
//
// GFS les écrit d'après la déclaration de l'app (section « Bibliothèques que l'app charge elle-même » de son `GFS-ETAT.md`) et n'en vérifie rien :
// ni la version, ni l'adresse, ni l'empreinte. Une liste vide dit que l'app n'en charge aucune ; l'absence du champ, qu'elle n'a encore rien
// déclaré.

import { LIBRARY_ID_RE, EXACT_VERSION_RE } from './manifest.js';

export const CARRIED_WHEN = Object.freeze(['demarrage', 'usage', 'option']);
const FIELDS = ['id', 'nom', 'version', 'adresse', 'quand', 'contient', 'paquet', 'note'];
const NPM_RE = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const NAME_MAX = 60;
const NOTE_MAX = 240;
const CONTAINS_MAX = 12;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value, max) => typeof value === 'string' && value.trim() !== '' && value.length <= max;

// L'adresse que l'app contacte : https, un nom d'hôte avec un point, ni identifiants ni port.
export function carriedAddress(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password && !url.port ? url : null;
  } catch (error) { return null; }
}

// Une règle par champ : elle rend le motif de l'erreur, ou null.
const RULES = [
  ['id', entry => (LIBRARY_ID_RE.test(entry.id || '') ? null : 'identifiant hors format')],
  ['nom', entry => (isText(entry.nom, NAME_MAX) ? null : `un nom de ${NAME_MAX} signes au plus attendu`)],
  ['version', entry => (entry.version === undefined || EXACT_VERSION_RE.test(entry.version || '') ? null :
    'une version exacte attendue (ni intervalle ni latest)')],
  ['adresse', entry => (carriedAddress(entry.adresse) ? null : 'une adresse https attendue, sans identifiants ni port')],
  ['quand', entry => (CARRIED_WHEN.includes(entry.quand) ? null : `${CARRIED_WHEN.join(', ')} attendu`)],
  ['contient', entry => (entry.contient === undefined || (Array.isArray(entry.contient) && entry.contient.length <= CONTAINS_MAX
    && entry.contient.every(name => isText(name, NAME_MAX))) ? null : `${CONTAINS_MAX} noms au plus attendus`)],
  ['paquet', entry => (entry.paquet === undefined || (typeof entry.paquet === 'string' && NPM_RE.test(entry.paquet)) ? null : 'un nom de paquet npm attendu')],
  ['note', entry => (entry.note === undefined || (isObject(entry.note) && isText(entry.note.fr, NOTE_MAX) && isText(entry.note.en, NOTE_MAX)) ? null
    : `fr et en attendus (${NOTE_MAX} signes au plus)`)],
];

function checkEntry(entry, where, seen, errors) {
  if (!isObject(entry)) { errors.push(`${where} : objet attendu`); return; }
  for (const key of Object.keys(entry)) if (!FIELDS.includes(key)) errors.push(`${where}.${key} : inconnu`);
  for (const [field, rule] of RULES) {
    const problem = rule(entry);
    if (problem) errors.push(`${where}.${field} : ${problem}`);
  }
  if (!LIBRARY_ID_RE.test(entry.id || '')) return;
  if (seen.has(entry.id)) errors.push(`${where}.id : ${entry.id} déjà déclaré`);
  seen.add(entry.id);
}

export function checkCarried(m, errors) {
  if (m.portees === undefined) return;
  if (!Array.isArray(m.portees)) { errors.push('portees : liste attendue'); return; }
  const seen = new Set();
  m.portees.forEach((entry, index) => checkEntry(entry, `portees[${index}]`, seen, errors));
}
