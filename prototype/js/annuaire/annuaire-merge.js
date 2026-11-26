// La vue fusionnée du module Annuaire (demande du porteur du 25/11, scène 11 de la maquette) : « Tous mes annuaires », une liste des personnes de plusieurs
// annuaires du document que la personne peut lire, où une même adresse e-mail ne fait qu'une fiche, et où chaque ligne dit son annuaire d'origine et son
// rattachement. Du code sans effet de bord, essayé sous Node (test/annuaire-merge.test.mjs).
//
// La vue ne lit rien de plus que les annuaires qu'elle réunit, avec les droits de la personne (ce que Grist lui montre) : un sous-annuaire qu'elle ne lit pas
// n'y est pas. Elle ne montre que la liste : les hiérarchies de deux annuaires ne se superposent pas (un « Pôle » de l'un n'est pas celui de l'autre), donc ni
// arbre, ni organigramme ; ce qui se modifie se modifie dans son annuaire. Les annuaires reçus d'un autre document n'y sont pas : le partage entre documents
// n'envoie pas d'annuaire.

import { readConfig } from './annuaire-config.js';

// Le « numéro de ligne » de la vue : jamais celui d'une ligne de `GFS_Directories` (qui sont des entiers positifs).
export const MERGED_ROW = -1;

const lower = text => String(text ?? '').trim().toLowerCase();

// La configuration de la vue : l'adresse en colonne, puis deux champs qui n'existent pas dans le document (l'annuaire d'origine et le rattachement : leur clé
// est leur libellé, dit dans la langue de la personne), jamais de niveaux ni de poste.
export const mergedConfig = labels => readConfig({ hierarchy: false, email: 'Email', columns: ['email'],
  fields: [{ col: labels.origin, column: true }, { col: labels.path, column: true }] });

// Réunit les lectures de `sources` ([{ annuaire, read }], dans l'ordre où l'on veut les voir : la première qui cite une adresse donne la fiche). `labels` : {
// origin, path } (les clés des deux champs). Rend { people, joined, counts } : les personnes (par nom), le nombre de personnes réunies dans une fiche déjà vue,
// et le nombre de personnes de chaque annuaire (par numéro de ligne), avant la réunion. Deux personnes de même adresse dans le MÊME annuaire restent deux :
// c'est un doublon que « À vérifier » dit, pas une personne en double d'un autre annuaire.
export function mergeReads(sources, labels) {
  const out = [];
  const byMail = new Map(); // adresse -> [{ person, from: ensemble des annuaires qui la citent }]
  const counts = {};
  let joined = 0;
  const add = (list, value) => { if (value && !list.includes(value)) list.push(value); };
  for (const { annuaire, read } of sources) {
    counts[annuaire.row] = read.people.length;
    for (const person of read.people) {
      const path = person.levels.filter(Boolean).join(' · ');
      const address = lower(person.email);
      const twin = address ? (byMail.get(address) || []).find(each => !each.from.has(annuaire.row)) : null;
      if (twin) {
        joined += 1;
        twin.from.add(annuaire.row);
        add(twin.person.fields[labels.origin], annuaire.name);
        add(twin.person.fields[labels.path], path);
        for (const key of ['title', 'phone']) if (!twin.person[key] && person[key]) twin.person[key] = person[key];
        continue;
      }
      const made = { row: out.length + 1, name: person.name, sort: person.sort, initials: person.initials, title: person.title, email: person.email,
        phone: person.phone,
        levels: [], fields: { [labels.origin]: [annuaire.name], [labels.path]: path ? [path] : [] }, rel: {}, lead: false, manager: null };
      out.push(made);
      if (address) byMail.set(address, [...(byMail.get(address) || []), { person: made, from: new Set([annuaire.row]) }]);
    }
  }
  out.sort((a, b) => a.sort.localeCompare(b.sort, 'fr'));
  return { people: out, joined, counts };
}
