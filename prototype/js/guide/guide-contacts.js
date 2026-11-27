// Les contacts d'un guide (module Guide, demande du porteur du 27/11 : « les contacts viennent toujours de l'annuaire, jamais ressaisis ») : ce qu'un rôle
// désigne, retrouvé dans l'annuaire que le guide a choisi. Le type de la colonne du rôle dit ce qu'il désigne : une référence à la table des personnes (une
// PERSONNE), une autre référence (un SERVICE : son ou sa responsable), du texte (un POSTE : celles et ceux qui le tiennent). Un contact introuvable (poste
// vacant, personne absente de l'annuaire ou masquée par « Ma présence », service sans responsable) se remplace par le rôle « À défaut » de la démarche, et la
// fiche le dit. Sans annuaire, un rôle se lit comme du texte et rien ne se remplace. Du code sans effet de bord, essayé sous Node.

import { normalize } from '../ui/search.js';

// L'annuaire tel que le guide le lit : { table, people, byRow (la personne par son numéro de ligne), nodes (les structures par nom comparable : les nœuds de
// l'arbre) } d'après une lecture de l'annuaire (js/annuaire/annuaire-store.js `read`, vue d'un lecteur : js/annuaire/annuaire-presence.js).
export function directoryOf(read) {
  const nodes = new Map();
  const walk = node => {
    for (const child of node.ch) {
      const key = normalize(child.name);
      nodes.set(key, [...(nodes.get(key) || []), child]);
      walk(child);
    }
  };
  walk(read.tree);
  return { table: read.annuaire.table, people: read.people, byRow: new Map(read.people.map(person => [person.row, person])), nodes };
}

// Ce que désigne une colonne de rôle : 'person', 'service', 'post', ou 'text' (sans annuaire, ou un type qu'on ne sait pas lire).
export function kindOf(col, directory) {
  if (!directory || !col) return 'text';
  if (col.genre === 'ref' || col.genre === 'reflist') return col.ref === directory.table ? 'person' : 'service';
  return col.genre === 'text' || col.genre === 'choice' ? 'post' : 'text';
}

// Les personnes qu'un texte de poste désigne : celles dont le poste s'écrit pareil (accents, casse et ponctuation ignorés), sinon celles dont le poste le
// contient.
function holdersOf(label, directory) {
  const wanted = normalize(label);
  if (!wanted) return [];
  const exact = directory.people.filter(person => normalize(person.title) === wanted);
  return exact.length ? exact : directory.people.filter(person => normalize(person.title).includes(wanted));
}

// Les responsables d'une structure : les personnes rangées dans le nœud de ce nom qui sont responsables de leur structure.
const leadsOf = (label, directory) => (directory.nodes.get(normalize(label)) || []).flatMap(node => node.own.filter(person => person.lead));

// Ce qu'un rôle désigne : [{ label (ce qui est écrit dans la cellule), people (celles et ceux qu'on a retrouvés), found (au moins une personne ; vrai aussi
// pour un texte simple, sans annuaire : rien à retrouver) }].
export function entriesOf(kind, cell, directory) {
  if (kind === 'person') {
    return cell.ids.map((id, at) => ({ label: cell.texts[at] || '', people: directory.byRow.has(id) ? [directory.byRow.get(id)] : [] }))
      .map(entry => ({ ...entry, found: entry.people.length > 0 }));
  }
  if (kind === 'service' || kind === 'post') {
    return cell.texts.map(label => {
      const people = kind === 'service' ? leadsOf(label, directory) : holdersOf(label, directory);
      return { label, people, found: people.length > 0 };
    });
  }
  return cell.texts.map(label => ({ label, people: [], found: true, plain: true }));
}

// La réponse d'un guide pour une démarche : pour chaque rôle de `resolved` (js/guide/guide-model.js `rolesFor`), { role, from, own, kind, empty (personne ne le
// dit), entries, viaFallback (les contacts viennent du rôle « À défaut »), fallbackFrom }. `cols` : la colonne de chaque rôle (`{ colonne: genre… }` du
// schéma),
// `directory` : l'annuaire lu, ou null.
export function answerOf(resolved, columnOf, directory) {
  const base = resolved.map(item => {
    const kind = kindOf(columnOf(item.role.col), directory);
    return { ...item, kind, empty: !item.cell, entries: item.cell ? entriesOf(kind, item.cell, directory) : [], viaFallback: false };
  });
  const fallback = base.find(item => item.role.preset === 'fallback' && !item.empty);
  const lost = item => !item.empty && item.kind !== 'text' && item.entries.length > 0 && item.entries.every(entry => !entry.found);
  return base.map(item => (fallback && item !== fallback && item.role.preset !== 'fallback' && lost(item) && fallback.entries.some(entry => entry.found) ?
    { ...item, viaFallback: true, fallbackFrom: fallback.from, replaced: item.entries, entries: fallback.entries.filter(entry => entry.found) } : item));
}
