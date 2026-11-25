// Les notifications de la personne, entre le document et la cloche (js/sharing/notice-model.js pour le calcul) : à chaque lecture des fichiers, GFS compare ce
// qui est donné à la personne aux lignes de `GFS_Notifications`, écrit celles qui manquent (les siennes seulement, en un seul lot) et dit à la cloche ce qu'il
// y a de nouveau. « Lu » se garde dans la table ; un lecteur du document (qui n'écrit rien), un document où la table n'existe pas encore et un refus de Grist
// gardent « lu » dans le navigateur, pour la personne seule : le code marche sans lui (aucun accès au stockage hors d'un `try/catch`,
// js/shell/stored-choice.js). Lire ne crée rien : la table naît avec le partage (js/sharing/sharing-model.js, `coreTables`), jamais ici (aucune table sans
// l'accord de la personne).
//
// o : { doc (l'API des documents de Grist : applyUserActions, fetchTable), identity() (l'adresse de la personne, '' si GFS ne la connaît pas), canWrite()
//   (accès
//   complet et pas en lecture seule), owner() (promesse : propriétaire du document ? mise en cache ici), storage() (promesse du stockage du navigateur pour ce
//   document : { read(), write(texte) }, ou null), onChange(état) (la cloche : { items, unread }) }

import { SHARES_TABLE } from './sharing-model.js';
import { NOTICES_TABLE, givenToMe, noticeRows, planNotices } from './notice-model.js';
import { rowsOf } from '../rights/rights.js';

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const KEPT = 300; // les clés « lues » que le navigateur retient au plus
export const NO_NOTICES = Object.freeze({ shares: [], data: null, table: null });

// Ce que la lecture des fichiers apporte aux notifications : les lignes de partage que la personne lit, la table des notifications telle que `fetchTable` la
// rend et le nom que le document lui donne. Une table absente ou illisible (un refus) ne gêne rien : rien n'en est lu, tout se garde dans le navigateur.
export async function loadNoticeSources(doc, tables) {
  if (!tables) return NO_NOTICES;
  const found = name => tables.find(each => sameName(each, name)) || null;
  const read = async name => { if (!name) return null; try { return await doc.fetchTable(name); } catch (error) { return null; } };
  const [shares, notices] = await Promise.all([read(found(SHARES_TABLE)), read(found(NOTICES_TABLE))]);
  return { shares: shares ? rowsOf(shares) : [], data: notices, table: notices ? found(NOTICES_TABLE) : null };
}

// Le stockage du navigateur de ce document et de cette personne (`docId` : js/explorer/doc-key.js ; `open(clé)` : js/shell/stored-choice.js, `keyStore`), ou
// null quand l'un des deux manque : « lu » ne se retient alors que pour la page ouverte.
export const noticeStorage = (docId, identity, open) => (docId && identity ? open(`gfs.notif.${docId}.${String(identity).trim().toLowerCase()}`) : null);

export class NoticeStore {
  #o;
  #queue = Promise.resolve();
  #owner = null;
  #input = null; // la dernière lecture : { files, spaces, sources }
  #writeOff = false; // Grist a refusé une écriture : plus d'essai de cette session, tout se garde dans le navigateur
  #state = { items: [], unread: 0 };

  constructor(o) { this.#o = o; }

  get state() { return this.#state; }

  // Une lecture des fichiers vient d'arriver : la cloche se met à jour ; les lignes qui manquent s'écrivent. Les passages s'enchaînent l'un après l'autre.
  update(input) {
    this.#input = input;
    return this.#run(() => this.#sync(true));
  }

  // Marquer lues : `keys` (les clés des notifications), ou toutes les non lues. Rend le nombre de notifications marquées.
  markRead(keys = null) {
    return this.#run(() => this.#mark(keys));
  }

  #run(step) {
    const next = this.#queue.then(step, step);
    this.#queue = next.catch(() => {});
    return next.catch(error => { console.warn('GFS : les notifications ne se mettent pas à jour', error); return 0; });
  }

  async #owned() {
    this.#owner ??= Promise.resolve().then(() => this.#o.owner()).then(value => value === true, () => false);
    return this.#owner;
  }

  async #store() {
    try { return (await this.#o.storage()) || null; } catch (error) { return null; }
  }

  async #browserRead() {
    const store = await this.#store();
    try { const kept = JSON.parse((store && store.read()) || '[]'); return Array.isArray(kept) ? kept.map(String) : []; } catch (error) { return []; }
  }

  async #browserKeep(keys) {
    const store = await this.#store();
    if (!store || !keys.length) return;
    const kept = [...new Set([...(await this.#browserRead()), ...keys])].slice(-KEPT);
    store.write(JSON.stringify(kept));
  }

  #writable() {
    const input = this.#input;
    return Boolean(input && input.sources.table && !this.#writeOff && this.#o.canWrite());
  }

  async #given() {
    const { files, spaces, sources } = this.#input;
    return givenToMe({ files, spaces, shares: sources.shares, identity: this.#o.identity(), owner: await this.#owned() });
  }

  async #sync(mayWrite) {
    if (!this.#input || !this.#o.identity()) { this.#emit({ items: [], unread: 0 }); return 0; }
    const given = await this.#given();
    const read = await this.#browserRead();
    const identity = this.#o.identity();
    let plan = planNotices({ given, rows: noticeRows(this.#input.sources.data, identity), read, identity, write: this.#writable() });
    if (mayWrite && plan.add.length) {
      if (await this.#append(given, identity)) plan = planNotices({ given, rows: noticeRows(this.#input.sources.data, identity), read, identity,
        write: false });
    }
    this.#emit(plan);
    return plan.unread;
  }

  // Écrit les lignes qui manquent, après avoir relu la table (un autre onglet de la même personne a pu les écrire) ; rend vrai quand la table a changé.
  async #append(given, identity) {
    const { doc } = this.#o;
    const table = this.#input.sources.table;
    try {
      const fresh = await doc.fetchTable(table);
      const read = await this.#browserRead();
      const add = planNotices({ given, rows: noticeRows(fresh, identity), read, identity, write: true }).add;
      this.#input = { ...this.#input, sources: { ...this.#input.sources, data: fresh } };
      if (!add.length) return true;
      const column = name => add.map(row => row[name]);
      await doc.applyUserActions([['BulkAddRecord', table, add.map(() => null),
        { Recipient: column('Recipient'), Type: column('Type'), Target: column('Target'), By: column('By'), Key: column('Key') }]]);
      this.#input = { ...this.#input, sources: { ...this.#input.sources, data: await doc.fetchTable(table) } };
      return true;
    } catch (error) {
      this.#writeOff = true;
      console.warn('GFS : les notifications ne s\'écrivent pas dans le document, « lu » reste dans le navigateur', error);
      return false;
    }
  }

  async #mark(keys) {
    const targets = this.#state.items.filter(item => !item.lu && (!keys || keys.includes(item.cle)));
    if (!targets.length) return 0;
    const rows = targets.filter(item => item.row !== null).map(item => item.row);
    let written = new Set();
    if (rows.length && this.#writable()) {
      try {
        await this.#o.doc.applyUserActions([['BulkUpdateRecord', this.#input.sources.table, rows, { Read: rows.map(() => true) }]]);
        written = new Set(rows);
        this.#patch(written);
      } catch (error) {
        this.#writeOff = true;
        console.warn('GFS : « lu » ne s\'écrit pas dans le document, il reste dans le navigateur', error);
      }
    }
    await this.#browserKeep(targets.filter(item => item.row === null || !written.has(item.row)).map(item => item.cle));
    await this.#sync(false);
    return targets.length;
  }

  // « Lu » vient d'être écrit sur ces lignes : la copie de la table que la cloche relit le sait sans la relire.
  #patch(ids) {
    const data = this.#input.sources.data;
    if (!data || !Array.isArray(data.id)) return;
    const lu = (Array.isArray(data.Read) ? data.Read : []).slice();
    data.id.forEach((id, at) => { if (ids.has(id)) lu[at] = true; });
    this.#input = { ...this.#input, sources: { ...this.#input.sources, data: { ...data, Read: lu } } };
  }

  #emit(plan) {
    this.#state = { items: plan.items || [], unread: plan.unread || 0 };
    this.#o.onChange(this.#state);
  }
}
