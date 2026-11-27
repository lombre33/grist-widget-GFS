// Ajouter des personnes à un annuaire (module Annuaire ; choix du porteur, 27/11 : « Plusieurs à la suite, un seul ajout ») : la fenêtre « Modifier », à vide,
// prépare plusieurs fiches l'une après l'autre ; une seule relecture ; une seule écriture. Ce fichier est la part sans écran : les fiches préparées, ce qui les
// rend vides, leurs doublons, et l'action de Grist qui les écrit. Des fonctions sans effet de bord, essayées sous Node (test/annuaire-add.test.mjs) ; la
// fenêtre est à js/annuaire/annuaire-edit-window.js, ses pastilles et sa relecture à js/annuaire/annuaire-add-view.js.
//
// Droits : les administrateurs du document seuls (défaut prudent, dit au porteur le 27/11). Une fiche n'est jamais écrite sans le geste « Ajouter » de la
// relecture ; les colonnes que Grist calcule restent grisées ; jamais une colonne absente (les champs viennent de `editableFields`).

import { changesOf, cellOf, valueOf, problemOf } from './annuaire-edit.js';
import { nameOf } from './annuaire-model.js';
import { normalize, words } from '../ui/search.js';

// Les valeurs d'une fiche vide : « rien » pour chaque champ (le texte vide, 0 pour une référence, une liste vide, faux pour un oui/non).
export const blankValues = fields => Object.fromEntries(fields.map(field => [field.key, valueOf(field, null)]));

// Une fiche préparée est vide quand elle n'a rien de plus qu'une fiche vide : elle est ignorée à la relecture (la personne a rouvert une fiche pour rien).
export const isBlank = (fields, values) => changesOf(fields, blankValues(fields), values).length === 0;

const text = value => String(value ?? '').trim();

// Le nom d'une fiche préparée, tel que l'annuaire l'écrira (le prénom et le nom dans l'ordre du réglage), ou '' tant que le nom n'est pas saisi.
export function draftName(values, config) {
  const last = text(values.name);
  return last ? nameOf(text(values.first), last, config && config.order, Boolean(config && config.upper)).name : '';
}

const address = value => text(value).toLowerCase();
// Deux noms sont les mêmes quand leurs mots le sont, dans n'importe quel ordre (accents, casse et ponctuation ignorés).
const same = (a, b) => Boolean(a && b) && words(a).sort().join(' ') === words(b).sort().join(' ');

// Ce que la fiche `at` partage avec une personne déjà dans l'annuaire ou avec une autre fiche préparée : { email, name }, chacun `null` ou { kind: 'directory'
// | 'draft', name } (le nom de la personne ou de la fiche qui porte déjà la même adresse, ou le même nom). `drafts` : [{ values }] ; `people` : celles de
// l'annuaire ({ name, email }).
export function duplicatesOf(drafts, at, people, config) {
  const mine = drafts[at].values;
  const others = drafts.filter((_, index) => index !== at).map(draft => ({ values: draft.values, name: draftName(draft.values, config) }));
  const email = address(mine.email);
  const name = draftName(mine, config);
  const found = { email: null, name: null };
  const person = email ? people.find(each => address(each.email) === email) : null;
  const other = email ? others.find(each => address(each.values.email) === email) : null;
  if (person) found.email = { kind: 'directory', name: person.name };
  else if (other) found.email = { kind: 'draft', name: other.name || text(other.values.email) };
  const sameName = name ? people.find(each => same(normalize(each.name), normalize(name))) : null;
  const sameDraft = name ? others.find(each => same(normalize(each.name), normalize(name))) : null;
  if (sameName) found.name = { kind: 'directory', name: sameName.name };
  else if (sameDraft) found.name = { kind: 'draft', name: sameDraft.name };
  return found;
}

// Le texte qui empêche d'ajouter ces fiches : { at, key (le champ à montrer), phrase, vars }, ou null. Une fiche sans nom, une valeur qui n'en est pas une
// (`problemOf`), une adresse déjà prise (par l'annuaire ou par une autre fiche préparée : l'adresse reconnaît la personne, elle ne sert qu'à une).
export function firstProblem(drafts, fields, people, config) {
  for (let at = 0; at < drafts.length; at += 1) {
    const { values } = drafts[at];
    if (isBlank(fields, values)) continue;
    const bad = fields.find(field => problemOf(field, values[field.key]));
    if (bad) return { at, key: bad.key, phrase: problemOf(bad, values[bad.key]), vars: { what: bad.label } };
    const { email } = duplicatesOf(drafts, at, people, config);
    if (email) return { at, key: 'email', phrase: email.kind === 'directory' ? 'an.add.dupEmailDir' : 'an.add.dupEmailDraft',
      vars: { email: text(values.email), name: email.name } };
  }
  return null;
}

// L'action de Grist qui écrit les fiches préparées : une seule, `BulkAddRecord`, rien que les colonnes où une fiche au moins a une valeur (jamais une colonne
// absente : `editableFields` n'en propose pas). Les fiches vides sont ignorées.
export function bulkAddOf(table, drafts, fields) {
  const kept = drafts.filter(draft => !isBlank(fields, draft.values));
  const used = fields.filter(field => kept.some(draft => changesOf([field], blankValues([field]), draft.values).length));
  return ['BulkAddRecord', table, kept.map(() => null), Object.fromEntries(used.map(field =>
    [field.col, kept.map(draft => cellOf(field, draft.values[field.key]))]))];
}

// Ce qui empêche d'ajouter des personnes : le texte, ou ''. `data` : ce que la fenêtre de l'annuaire montre ; `blocked` : ce qui empêche d'écrire dans le
// document (son texte, ou rien). Une liste fusionnée et une copie (sous-annuaire) n'ont pas de table à elles : on ajoute dans l'annuaire d'origine. Seuls les
// administrateurs du document ajoutent (défaut prudent, dit au porteur le 27/11) ; Grist garde le dernier mot (ses règles d'accès).
export function addBlock(data, blocked, t) {
  if (!data) return '';
  if (data.merged) return t('an.add.noMerged');
  if (data.sub) return t('an.add.noSub');
  if (blocked) return blocked;
  return data.admin ? '' : t('an.add.whyAdmins');
}
