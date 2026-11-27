// Les contacts d'un guide, vus à l'envers (module Guide, demande du porteur du 27/11, maquette « Les contacts : qui est cité par quoi ») : chaque interlocuteur
// (une personne, un service, un poste) avec les démarches qui le citent, pour tenir le guide à jour. Un contact introuvable (poste vacant, fiche supprimée ou
// masquée par « Ma présence », service sans responsable) passe en tête : c'est ce qui se périme en silence. Du code sans effet de bord, essayé sous Node.

import { normalize } from '../ui/search.js';

// L'index : [{ key, kind ('person', 'service', 'post' ou 'text'), label, people (celles et ceux qu'on a retrouvés), found, own (les démarches qui le disent
//   elles-mêmes), procs: [{ row, title, own }] (celles qui le citent, par héritage comprises) }]. `answerFor(row)` : la réponse d'une démarche
//   (js/guide/guide-contacts.js `answerOf`). Un contact remplacé par « À défaut » compte comme cité (et perdu) par la démarche qui le disait ; le contact de
//   repli n'est compté que par le rôle « À défaut ».
export function contactsIndex(procs, answerFor) {
  const groups = new Map();
  const cite = (kind, entry, proc, own) => {
    const label = entry.label || (entry.people[0] ? entry.people[0].name : '');
    if (!label) return;
    const key = `${kind}:${normalize(label)}`;
    if (!groups.has(key)) groups.set(key, { key, kind, label, people: entry.people, found: true, own: 0, procs: [] });
    const group = groups.get(key);
    if (!entry.found && !entry.plain) group.found = false;
    group.procs.push({ row: proc.row, title: proc.title, own });
    if (own) group.own += 1;
  };
  for (const proc of procs) {
    for (const item of answerFor(proc.row)) {
      if (item.empty) continue;
      for (const entry of item.viaFallback ? item.replaced : item.entries) cite(item.kind, entry, proc, item.own);
    }
  }
  return [...groups.values()].sort((a, b) => Number(a.found) - Number(b.found) || b.procs.length - a.procs.length || a.label.localeCompare(b.label, 'fr'));
}

// Les démarches qui citent une personne de l'annuaire (la ligne `row` de la table des personnes), directement (une référence) ou par son poste ou le service
// dont elle est responsable : [{ row, title, via ('person', 'service' ou 'post'), own }], sans doublon. Sert à la section « Démarches » de la fiche de
// l'annuaire.
export function citingPerson(procs, answerFor, personRow) {
  const out = new Map();
  for (const proc of procs) {
    for (const item of answerFor(proc.row)) {
      if (item.empty) continue;
      const entries = item.viaFallback ? item.entries : item.entries.filter(entry => entry.found);
      if (entries.some(entry => entry.people.some(person => person.row === personRow)) && !out.has(proc.row)) {
        out.set(proc.row, { row: proc.row, title: proc.title, via: item.kind, own: item.own });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}
