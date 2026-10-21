// Le bouton « Table de travail » de la barre de GFS (contrats 4.5) : la fenêtre du choix, ce que la barre en dit, et ce que reçoit l'app qu'on ouvre.
// Le contrôleur lui donne ce qu'il sait (la connexion à Grist, l'état de la section, les apps, l'app active) et rouvre l'app quand la table change.

import { WorkRow, workTables } from './work-row.js';
import { WorkWindow } from './work-window.js';
import { makePolicy, readRefusal } from './filter.js';

export class WorkControl {
  #env;
  #window = null;
  #row = null; // { id, label } : la ligne choisie dans la fenêtre, que l'info-bulle nomme

  // env : { port, state, dock, container, t(), appName(id), manifests() -> [manifeste], session() -> AppSession | null, inertTargets(), notice(texte),
  //   reopen(appId), hidden() }
  constructor(env) {
    this.#env = env;
    this.work = new WorkRow({ doc: env.port.doc, hidden: env.hidden });
    // La table de la section peut changer (panneau de Grist) : l'info-bulle de la page la suit.
    env.state.subscribe(kind => { if (kind === 'table' && !this.work.choice) this.relabel(); });
  }

  // L'état et la vue de Grist que reçoit l'app qu'on ouvre : ceux de la ligne de travail si elle peut lire la table choisie, sinon ceux de la page, et GFS le dit
  // (4.5, point 5).
  sourceFor(manifest) {
    const { state, port } = this.#env;
    const choice = this.work.choice;
    if (choice && readRefusal(makePolicy(manifest, this.#env.manifests()), choice.tableId)) {
      this.#env.notice(this.#env.t('work.refused', { app: this.#env.appName(manifest.id), table: choice.tableId }));
      return { state, port };
    }
    return { state: this.work.state(state), port: this.work.port(port) };
  }

  // L'info-bulle du bouton dit ce qui vaut : la table choisie, avec sa ligne quand elle a été choisie aussi, ou celle de la page.
  relabel() {
    const { t, dock, state } = this.#env;
    const choice = this.work.choice;
    const row = choice && this.#row && this.#row.id === choice.rowId ? this.#row.label : '';
    let text = t('work.tipPage', { table: (state.table && state.table.tableId) || '—' });
    if (choice) text = row ? t('work.tipChosen', { table: choice.tableId, row }) : t('work.tipTable', { table: choice.tableId });
    dock.setWork(text, Boolean(choice));
  }

  async open() {
    if (this.#window) return;
    const { port, t, container } = this.#env;
    let ids;
    try { ids = await port.doc.listTables(); } catch (error) {
      this.#env.notice(t('work.failed', { table: '—', reason: String((error && error.message) || '').slice(0, 120) }));
      return;
    }
    const session = this.#env.session();
    const tables = workTables(ids.map(String), this.#env.manifests()).map(id => ({
      id, locked: session && readRefusal(session.policy, id) ? t('work.locked', { app: this.#env.appName(session.id) }) : null,
    }));
    const { state } = this.#env;
    this.#window = new WorkWindow({
      container, i18n: { t }, inertTargets: this.#env.inertTargets,
      source: { pageTable: state.table && state.table.tableId, current: this.work.choice, tables: () => tables, rows: id => this.work.rows(id) },
      onPick: choice => void this.#pick(choice), onClose: () => { this.#window = null; },
    });
    this.#window.open();
  }

  // Une autre table (ou la page) : l'app active est rouverte (4.5, point 3) ; une autre ligne de la même table : un message de ligne, sans rouvrir. Une table
  // choisie seule (`rowId` null) garde la ligne qu'elle avait, ou prend la première.
  async #pick(choice) {
    let result;
    try {
      result = choice ? await this.work.choose(choice.tableId, choice.rowId) : this.work.clear();
    } catch (error) {
      this.#env.notice(this.#env.t('work.failed', { table: choice.tableId, reason: String((error && error.message) || '').slice(0, 120) }));
      return;
    }
    if (!choice || result.tableChanged) this.#row = null;
    if (choice && choice.rowId !== null) this.#row = { id: choice.rowId, label: choice.label };
    this.relabel();
    const session = this.#env.session();
    if (result.tableChanged && session) this.#env.reopen(session.id);
  }
}
