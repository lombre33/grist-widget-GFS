// Ce que renommer, déplacer ou supprimer un dossier de « Moi » change à ses partages et à ses liens (contrats 11.7, point 13.n.g) : lit les tables, rend les
// actions à joindre au lot du rangement (js/explorer/filing.js). Les règles sont dans js/sharing/folder-identity.js (code pur) ; ici, seulement les lectures.
// Sans partage actif (pas de table des partages), il n'y a rien à suivre : aucune action.

import { rowsOf } from '../rights/rights.js';
import { PLACE_TABLE, SHARES_TABLE } from './sharing-model.js';
import { legacyPath, legacyPaths, relocationExtra, removalExtra } from './folder-identity.js';

export class FolderShares {
  #o;

  // opts : { port, rangement (`folderRows`, `folderIds`, js/files/rangement.js), identity() → l'adresse de la personne ou '', owner() → Promise<vrai si la
  //   personne
  //   est propriétaire du document> }
  constructor(opts) { this.#o = opts; }

  // Les lignes d'une table du partage, ou null quand la table manque ou ne se lit pas (le partage n'est pas actif).
  async #read(table) {
    try { return rowsOf(await this.#o.port.doc.fetchTable(table)); } catch (error) { return null; }
  }

  async #state() {
    const identity = String(this.#o.identity() || '').trim().toLowerCase();
    if (!identity) return null;
    const [shares, places] = await Promise.all([this.#read(SHARES_TABLE), this.#read(PLACE_TABLE)]);
    return shares ? { identity, shares, places: places || [] } : null;
  }

  // Le dossier `from` devient `to` (`known` : les dossiers qui existent, tels que l'explorateur les montre). Rend { refuse, extra, lost, spare } : `spare`, les
  // chemins qui ont une ligne d'état, **relus ici** (la fenêtre « Partager… » en crée une quand on partage un dossier, et l'explorateur ne la connaît pas
  // encore : sans elle, le renommage laisserait la ligne derrière, avec le partage) ; un partage posé avant ce lot sur un dossier qui n'en avait pas reçoit sa
  // ligne d'abord, pour qu'il puisse la suivre.
  async relocation(from, to, known) {
    const none = { refuse: null, extra: [], lost: 0, spare: [] };
    const state = await this.#state();
    if (!state) return none;
    const { identity, shares, places } = state;
    const before = await this.#o.rangement.folderRows();
    const exist = [...new Set([...known, ...before.map(row => row.path)])];
    const paths = legacyPaths({ identity, from, known: exist, shares, places });
    const missing = paths.filter(path => !before.some(row => row.path === path));
    if (missing.length) await this.#o.rangement.folderIds(missing, true);
    const rows = missing.length ? await this.#o.rangement.folderRows() : before;
    // La personne est-elle propriétaire du document ? Seulement quand un lien à l'ancienne mode le demande (un propriétaire seul réécrit un lien).
    const owner = places.some(row => legacyPath(row.Lien, identity) !== null) && (await this.#o.owner()) === true;
    const out = relocationExtra({ identity, rows, from, to, known: [...new Set([...exist, ...rows.map(row => row.path)])], shares, places, owner });
    return { ...out, spare: [...new Set(rows.map(row => row.path))] };
  }

  // Ces dossiers (`paths` : les chemins dont on retire la ligne d'état) sont supprimés. Rend { refuse, extra, removed }.
  async removal(paths) {
    const state = await this.#state();
    if (!state) return { refuse: null, extra: [], removed: 0 };
    return removalExtra({ ...state, rows: await this.#o.rangement.folderRows(), paths });
  }
}
