// Des exemples en direct pour le réglage de l'annuaire (module Annuaire, retour du porteur, 25/11 : « des valeurs d'exemple chargées en live pour la première
// personne de l'annuaire, ou mieux une personne qui a plein d'infos remplies »). Quand on choisit une colonne, chaque article de la liste dit ce qu'elle
// contient pour UNE personne : celle de la table qui a le plus de cellules remplies, parmi les premières. Rien n'est écrit, rien n'est copié : les tables se
// lisent comme le réglage les lit déjà (`fetch`), une fois chacune. Du code sans accès à la page : le réglage le montre.

import { followPath, lookup } from './annuaire-model.js';

export const SAMPLE_ROWS = 400; // combien de lignes on regarde pour trouver la personne la mieux remplie
export const SAMPLE_HOPS = 2; // combien de références on suit pour lire les tables liées (« Personne › Poste › Pôle » : deux)
export const SAMPLE_WIDTH = 48; // la longueur d'un exemple, avant « … »

// Les tables qu'on lit pour donner des exemples : celle des personnes et, de proche en proche, celles que ses références (simples ou en liste) visent, en
// `hops` pas au plus.
export function reachable(schema, table, hops = SAMPLE_HOPS) {
  const found = new Set(schema[table] ? [table] : []);
  let edge = [...found];
  for (let step = 0; step < hops; step++) {
    const next = [];
    for (const name of edge) for (const col of schema[name].columns) if (col.ref && schema[col.ref] && !found.has(col.ref)) {
      found.add(col.ref); next.push(col.ref); }
    edge = next;
  }
  return found;
}

const filled = (cell, genre) => {
  if (cell === null || cell === undefined || cell === '' || cell === false) return false;
  if (Array.isArray(cell)) return cell.length > (cell[0] === 'L' ? 1 : 0);
  return !(cell === 0 && (genre === 'ref' || genre === 'reflist'));
};

// Le rang de la ligne de `tableId` qui a le plus de cellules remplies, parmi les `limit` premières (la première en cas d'égalité) ; -1 quand il n'y en a pas.
export function richestRow(data, tableId, schema, limit = SAMPLE_ROWS) {
  const table = data[tableId];
  const columns = (schema[tableId] ? schema[tableId].columns : []).filter(col => col.genre !== 'file' && table && Array.isArray(table[col.id]));
  if (!table || !Array.isArray(table.id) || !table.id.length) return -1;
  let best = 0;
  let most = -1;
  for (let i = 0; i < Math.min(table.id.length, limit); i++) {
    const count = columns.reduce((sum, col) => sum + (filled(table[col.id][i], col.genre) ? 1 : 0), 0);
    if (count > most) { most = count; best = i; }
  }
  return best;
}

export class Sampler {
  #o;
  #state = 'idle'; // idle, loading, ready (une personne d'exemple) ou none (rien à montrer : table vide, lecture impossible)
  #at = -1;
  #ctx = null;
  #waiting = [];
  #loading = null;

  // opts : { schema, table, fetch(nom de table) -> Promise (les tableaux de colonnes de Grist), format(valeur, genre) -> texte (facultatif) }
  constructor(opts) { this.#o = opts; }

  get table() { return this.#o.table; }
  get state() { return this.#state; }
  get ready() { return this.#state === 'ready'; }

  // Lit les tables (une fois) et choisit la personne. Ne lève jamais : une lecture qui échoue laisse le réglage sans exemples.
  load() {
    if (!this.#loading) {
      const { schema, table, fetch } = this.#o;
      this.#state = 'loading';
      this.#loading = Promise.all([...reachable(schema, table)].map(async name => [name, await fetch(name)])).then(entries => {
        const data = Object.fromEntries(entries);
        this.#at = richestRow(data, table, schema);
        this.#ctx = { ...lookup(data), schema };
        this.#state = this.#at >= 0 ? 'ready' : 'none';
        for (const callback of this.#waiting.splice(0)) callback();
      }).catch(() => {
        this.#state = 'none';
        for (const callback of this.#waiting.splice(0)) callback();
      });
    }
    return this.#loading;
  }

  // Appelle `callback` quand la lecture est finie, avec ou sans exemples (une seule fois) ; tout de suite si elle l'est déjà.
  whenLoaded(callback) {
    if (this.#state === 'ready' || this.#state === 'none') callback(); else this.#waiting.push(callback);
  }

  // Ce que la colonne `columns` (un chemin depuis la personne : [colonne, colonne…]) dit pour la personne choisie : un texte court, ou '' (pas d'exemple).
  text(columns) {
    if (this.#state !== 'ready' || !columns.length) return '';
    const { schema, table, format } = this.#o;
    let at = table;
    let col = null;
    for (const id of columns) { col = ((schema[at] && schema[at].columns) || []).find(each => each.id === id) || null; at = col && col.ref; }
    const values = followPath(this.#ctx, table, this.#at, columns).map(value => (format && col ? format(value, col.genre) : value));
    const text = values.join(', ');
    return text.length > SAMPLE_WIDTH ? `${text.slice(0, SAMPLE_WIDTH - 1)}…` : text;
  }
}
