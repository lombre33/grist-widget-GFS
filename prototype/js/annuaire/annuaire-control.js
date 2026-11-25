// Le module Annuaire de GFS (demande du porteur du 25/11) : il tient la lecture des annuaires du document (js/annuaire/annuaire-store.js), la fenêtre qui les
// montre (js/annuaire/annuaire-window.js) et le réglage (js/annuaire/annuaire-setup.js). Le module ne se charge qu'au premier clic sur son bouton
// (js/shell/annuaire-entry.js) : GFS ne paie rien tant que la personne n'ouvre pas l'annuaire. Lire ne crée rien ; créer un annuaire écrit une ligne dans
// `GFS_Annuaires`, que GFS crée alors avec l'accord de la personne. Les personnes restent dans leur table : GFS la lit, ne l'écrit pas.

import { AnnuaireStore, MissingTable, NameTaken, TableDeclined } from './annuaire-store.js';
import { AnnuaireWindow } from './annuaire-window.js';
import { AnnuaireSetup } from './annuaire-setup.js';
import { pickFrom } from '../ui/pick-window.js';
import { shown } from './annuaire-panes.js';

const NEW = '__new__';

export class AnnuaireControl {
  #o;
  #store;
  #window;
  #list = [];
  #row = null; // l'annuaire montré (le numéro de sa ligne)
  #reading = 0; // le numéro de la dernière lecture lancée : une lecture plus ancienne qui finit après ne montre rien

  // opts : { port ({ doc }), container, t, locale(), inertTargets(), ask(opts) -> Promise<boolean>, notice(texte), writeBlock() -> texte ou null, fullAccess()
  //   }
  constructor(opts) {
    this.#o = opts;
    const consent = () => opts.ask({ title: opts.t('an.table.title'), message: opts.t('an.table.text'), confirmLabel: opts.t('table.create'),
      cancelLabel: opts.t('table.cancel') });
    this.#store = new AnnuaireStore({ port: opts.port, consent });
    this.#window = new AnnuaireWindow({ container: opts.container, t: opts.t, locale: opts.locale, inertTargets: opts.inertTargets,
      onSwitch: () => void this.#switch(), onConfigure: () => void this.#configure(), onNew: () => void this.#create(),
      onFilterMore: (col, option) => this.#more(col, option), onClose: () => {} });
  }

  get isOpen() { return this.#window.isOpen; }
  get element() { return this.#window.element; }

  // Ouvre la fenêtre sur « Lecture… », puis lit les annuaires du document.
  async open() {
    if (this.#window.isOpen) return;
    this.#window.show({ state: 'loading', error: '' });
    this.#window.open();
    await this.#load();
  }

  close() { this.#window.close(); }

  relocalize() { this.#window.relocalize({ t: this.#o.t }); }

  get #current() { return this.#list.find(each => each.row === this.#row) || null; }

  // Lit la liste des annuaires, puis celui qu'on montre (le dernier vu, sinon le premier).
  async #load() {
    const t = this.#o.t;
    if (!this.#o.fullAccess()) { this.#window.show({ state: 'error', error: t('an.needsAccess'), annuaires: [], current: null, data: null }); return; }
    try {
      this.#list = await this.#store.list();
    } catch (error) {
      console.error('GFS : lecture des annuaires impossible', error);
      this.#window.show({ state: 'error', error: t('an.readFailed', { reason: String(error && error.message) }), annuaires: [], current: null, data: null });
      return;
    }
    if (!this.#list.length) { this.#row = null; this.#window.show({ state: 'none', annuaires: [], current: null, data: null }); return; }
    if (!this.#current) this.#row = this.#list[0].row;
    await this.#read();
  }

  // Lit l'annuaire montré (ses personnes et sa hiérarchie).
  async #read() {
    const current = this.#current;
    const t = this.#o.t;
    const mine = ++this.#reading;
    this.#window.show({ state: 'loading', annuaires: this.#list, current, data: null });
    try {
      const data = await this.#store.read(current);
      if (mine === this.#reading) this.#window.show({ state: 'ready', annuaires: this.#list, current, data, error: '' });
    } catch (error) {
      if (mine !== this.#reading) return;
      if (!(error instanceof MissingTable)) console.error('GFS : lecture de l\'annuaire impossible', error);
      const text = error instanceof MissingTable ? t('an.tableGone', { table: error.table }) : t('an.readFailed', { reason: String(error && error.message) });
      this.#window.show({ state: 'error', annuaires: this.#list, current, data: null, error: text });
    }
  }

  // Un autre annuaire du document, ou un nouveau.
  async #switch() {
    const t = this.#o.t;
    const items = [...this.#list.map(each => ({ value: String(each.row), label: each.name, glyph: 'annuaire', hint: each.table })),
      { value: NEW, label: t('an.new'), glyph: 'plus', hint: '' }];
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.switch'), items,
      current: String(this.#row),
      none: t('an.noneFound') });
    if (chosen === null) return;
    if (chosen === NEW) { await this.#create(); return; }
    if (Number(chosen) === this.#row) return;
    this.#row = Number(chosen);
    await this.#read();
  }

  // Un nouvel annuaire : le réglage, puis l'écriture (la table `GFS_Annuaires` naît avec l'accord de la personne).
  async #create() {
    const t = this.#o.t;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const schema = await this.#schema();
    if (!schema) return;
    const made = await new AnnuaireSetup({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, schema, annuaire: null,
      taken: this.#list.map(each => each.name) }).run();
    if (!made) return;
    try {
      const annuaire = await this.#store.create(made);
      this.#row = annuaire.row;
      await this.#load();
    } catch (error) {
      if (error instanceof TableDeclined) this.#o.notice(t('an.declined'));
      else if (error instanceof NameTaken) this.#o.notice(t('an.set.errTaken'));
      else { console.error('GFS : création de l\'annuaire impossible', error); this.#o.notice(t('an.saveFailed', { reason: String(error && error.message) })); }
    }
  }

  // Le réglage de l'annuaire montré.
  async #configure() {
    const t = this.#o.t;
    const current = this.#current;
    if (!current) { await this.#create(); return; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const schema = await this.#schema();
    if (!schema) return;
    const done = await new AnnuaireSetup({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, schema, annuaire: current, taken: [] }).run();
    if (!done) return;
    try {
      const saved = await this.#store.save(current, done.config, done.table);
      this.#list = this.#list.map(each => (each.row === saved.row ? saved : each));
      await this.#read();
    } catch (error) {
      console.error('GFS : enregistrement de l\'annuaire impossible', error);
      this.#o.notice(t('an.saveFailed', { reason: String(error && error.message) }));
    }
  }

  // Les tables et les colonnes du document ; sans elles (l'accès complet manque), le réglage ne s'ouvre pas et la personne le sait.
  async #schema() {
    try {
      return await this.#store.schema();
    } catch (error) {
      console.error('GFS : lecture des tables impossible', error);
      this.#o.notice(this.#o.t('an.needsAccess'));
      return null;
    }
  }

  // Les valeurs d'un filtre au-delà des pastilles : la liste avec recherche.
  #more(col, option) {
    const t = this.#o.t;
    const ctx = { t, locale: this.#o.locale() };
    const items = option.values.map(entry => ({ value: entry.value, label: shown(entry.value, option.genre, ctx), glyph: 'check', hint: String(entry.count) }));
    return pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: col, items, none: t('an.noneFound') });
  }
}

// Le contrôle monté pour le contrôleur de GFS (`c`) : ce que la fenêtre lui demande (poser une question, dire une phrase, savoir si on peut écrire).
export function createAnnuaire(c) {
  return new AnnuaireControl({ port: c.port, container: c.$('stage'), t: c.t, locale: () => c.locale, inertTargets: c.inertTargets, ask: opts => c.ask(opts),
    notice: text => c.notice(text), writeBlock: () => c.writeBlock(), fullAccess: () => c.fullAccess });
}
