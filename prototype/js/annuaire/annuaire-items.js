// Ce que l'organigramme et les listes de l'annuaire montrent d'une personne ou d'une structure (module Annuaire, demande du porteur du 25/11), tiré du modèle
// (js/annuaire/annuaire-model.js) : des initiales, le libellé d'un niveau, les éléments des deux organigrammes. Du code sans effet de bord, essayé sous Node.

// Les initiales d'un nom : la première lettre du premier mot et celle du dernier (« Camille Martin » : « CM »), une seule lettre pour un mot seul, rien sans
// lettre.
export function initials(name) {
  const letters = String(name ?? '').split(/[\s'’-]+/).map(word => [...word].find(char => /\p{L}/u.test(char))).filter(Boolean);
  const two = letters.length > 1 ? letters[0] + letters.at(-1) : (letters[0] || '');
  return two.toLocaleUpperCase();
}

// Le libellé d'un niveau : celui que la personne a écrit, sinon le nom de la dernière colonne de son chemin.
export const levelLabel = level => (level && (level.label || (level.path || []).at(-1))) || '';

// Les personnes d'un nœud qui sont responsables de leur structure (colonne `lead`), les premières par nom.
export const headsOf = node => node.own.filter(person => person.lead);

// L'organigramme des structures : { id, ch, card, pick } pour chaque nœud de l'arbre des niveaux. `card` : ce que la carte écrit (le nom, le libellé du niveau,
// le nombre de personnes, le responsable) ; `pick` : ce que le clic désigne (le nœud).
export function structureItems(tree, levels) {
  const one = node => {
    const [head] = headsOf(node);
    const level = node.level >= 0 ? levels[node.level] : null;
    return { id: node.id || 'root', ch: node.ch.map(one), pick: { node: node.id },
      card: { title: node.name, sub: levelLabel(level), count: node.count, head: head ? head.name : '', initials: head ? initials(head.name) : '' } };
  };
  return [one(tree)];
}

// L'organigramme des responsables : `roots` vient de `managerTree` ([{ person, ch }]). Le nombre d'une carte est celui de toutes les personnes dessous.
export function managerItems(roots) {
  const one = node => {
    const ch = node.ch.map(one);
    const below = ch.reduce((sum, child) => sum + child.card.count + 1, 0);
    const { person } = node;
    return { id: `p${person.row}`, ch, pick: { person: person.row }, card: { title: person.name, sub: person.title, count: below, head: '',
      initials: initials(person.name) } };
  };
  return roots.map(one);
}

// Le nœud qu'une personne désigne dans l'arbre des structures : celui où elle est rangée (le chemin de ses niveaux, en sautant ceux qu'elle n'a pas).
export function nodeIdOf(person) {
  let id = '';
  person.levels.forEach((value, i) => { if (value) id = `${id}\u001f${i}:${value}`; });
  return id;
}

// Les identifiants du nœud et de tous ceux qui le portent, de la racine à lui : `\u001f0:Pôle\u001f1:Direction` donne la racine (''), le pôle, puis la
// direction.
export function pathIds(id) {
  const ids = [''];
  let at = '';
  for (const part of String(id).split('\u001f').filter(Boolean)) { at = `${at}\u001f${part}`; ids.push(at); }
  return ids;
}
