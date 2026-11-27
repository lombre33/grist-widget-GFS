// Le module Guide de GFS (demande du porteur du 27/11) : il tient la lecture des guides du document (js/guide/guide-store.js), la fenêtre qui les montre
// (js/guide/guide-window.js) et le réglage (js/guide/guide-setup.js). Le module ne se charge qu'au premier clic sur son bouton (js/shell/guide-entry.js) : GFS
// ne paie rien tant que la personne n'ouvre pas le guide. Lire ne crée rien ; créer un guide écrit une ligne dans `GFS_Guides`, que GFS crée alors avec
// l'accord de la personne. Les démarches restent dans leur table : GFS la lit, ne l'écrit pas (sauf la table que la personne lui demande de créer, avec son
// accord). Les contacts viennent de l'annuaire que le guide a choisi, vu comme le voit n'importe quel lecteur (sans les fiches que « Ma présence » masque).

import { GuideStore, MissingTable, NameTaken, TableDeclined } from './guide-store.js';
import { GuideWindow } from './guide-window.js';
import { GuideSetup } from './guide-setup.js';
import { GuideEdit } from './guide-edit-window.js';
import { fieldsOf, recordOf } from './guide-write.js';
import { PROCEDURE_COLUMNS, PROCEDURE_TABLE } from './guide-config.js';
import { rolesFor } from './guide-model.js';
import { directoryOf, answerOf } from './guide-contacts.js';
import { AnnuaireStore } from '../annuaire/annuaire-store.js';
import { presenceView } from '../annuaire/annuaire-presence.js';
import { columnOf } from '../annuaire/annuaire-schema.js';
import { copyText } from '../annuaire/annuaire-copy.js';
import { normalize } from '../ui/search.js';
import { pickFrom } from '../ui/pick-window.js';

const NEW = '__new__';

export class GuideControl {
  #o;
  #store;
  #annuaires;
  #window;
  #list = [];
  #row = null; // le guide montré (le numéro de sa ligne)
  #reading = 0; // le numéro de la dernière lecture lancée : une lecture plus ancienne qui finit après ne montre rien
  #loaded = false;
  #data = null; // la dernière lecture du guide montré (celle que l'éditeur lit)
  #focus = null; // la personne dont la fenêtre doit montrer les démarches dès que la lecture est finie (la ligne dans l'annuaire du guide)

  // opts : { port ({ doc }), container, t, locale(), inertTargets(), ask(opts) -> Promise<boolean>, notice(texte), writeBlock() -> texte ou null, fullAccess(),
  //   identity() -> l'adresse de la personne, ou '' tant qu'on ne la connaît pas }
  constructor(opts) {
    this.#o = opts;
    const consent = () => opts.ask({ title: opts.t('gd.table.title'), message: opts.t('gd.table.text'), confirmLabel: opts.t('table.create'),
      cancelLabel: opts.t('table.cancel') });
    this.#store = new GuideStore({ port: opts.port, consent });
    this.#annuaires = new AnnuaireStore({ port: opts.port, consent: () => Promise.resolve(false) }); // le guide lit les annuaires, il n'en crée jamais
    this.#window = new GuideWindow({ container: opts.container, t: opts.t, inertTargets: opts.inertTargets, onSwitch: () => void this.#switch(),
      onConfigure: () => void this.#configure(), onNew: () => void this.#create(), onNewProc: parent => void this.#editProc(null, parent),
        onEditProc: row => void this.#editProc(row),
      writeBlock: () => opts.writeBlock(), onCopy: text => copyText(text, opts.container.ownerDocument),
        onClose: () => {} });
  }

  get isOpen() { return this.#window.isOpen; }
  get element() { return this.#window.element; }

  // Ouvre la fenêtre sur « Lecture… », puis lit les guides du document. `row` : le numéro de la ligne du guide à montrer ; sans lui, le dernier vu, sinon le
  // premier.
  async open(row = null) {
    if (this.#window.isOpen) return;
    if (Number.isFinite(row)) this.#row = row;
    this.#window.show({ state: 'loading', error: '' });
    this.#window.open();
    await this.#load();
  }

  // Le bouton « Démarches » de la fiche d'une personne dans l'annuaire : ouvre le premier guide qui s'appuie sur cet annuaire (la ligne `directory`), sur les
  // démarches de la personne (la ligne `personRow`). Rend vrai quand le guide s'est ouvert ; sinon la personne en est prévenue.
  async openForPerson(directory, personRow) {
    const { t } = this.#o;
    if (!this.#o.fullAccess()) { this.#o.notice(t('gd.needsAccess')); return false; }
    let list;
    try {
      list = await this.#store.list();
    } catch (error) {
      console.error('GFS : lecture des guides impossible', error);
      this.#o.notice(t('gd.readFailed', { reason: String(error && error.message) }));
      return false;
    }
    const found = list.find(each => each.config.directory === String(directory));
    if (!found) { this.#o.notice(t('gd.person.noGuide')); return false; }
    this.#focus = personRow;
    if (this.#window.isOpen) { this.#row = found.row; await this.#load(); } else await this.open(found.row);
    return true;
  }

  close() { this.#window.close(); }

  relocalize() { this.#window.relocalize({ t: this.#o.t }); }

  // « Nouveau > Guide » de l'explorateur : la fenêtre s'ouvre, puis le réglage d'un nouveau guide. Une lecture qui a échoué se dit dans la fenêtre : rien n'est
  // proposé.
  async createNew() {
    if (!this.#window.isOpen) await this.open(null);
    if (this.#loaded) await this.#create();
  }

  get #current() { return this.#list.find(each => each.row === this.#row) || null; }

  async #load() {
    const t = this.#o.t;
    this.#loaded = false;
    if (!this.#o.fullAccess()) { this.#window.show({ state: 'error', error: t('gd.needsAccess'), guides: [], current: null, data: null }); return; }
    try {
      this.#list = await this.#store.list();
    } catch (error) {
      console.error('GFS : lecture des guides impossible', error);
      this.#window.show({ state: 'error', error: t('gd.readFailed', { reason: String(error && error.message) }), guides: [], current: null, data: null });
      return;
    }
    this.#loaded = true;
    if (!this.#list.length) { this.#row = null; this.#window.show({ state: 'none', guides: [], current: null, data: null }); return; }
    if (!this.#current) this.#row = this.#list[0].row;
    await this.#read();
  }

  // Lit le guide montré : ses démarches, et l'annuaire dont viennent les contacts.
  async #read() {
    const current = this.#current;
    const t = this.#o.t;
    const mine = ++this.#reading;
    const focus = this.#focus;
    this.#focus = null;
    this.#data = null;
    this.#window.show({ state: 'loading', guides: this.#list, current, data: null });
    try {
      const data = await this.#viewOf(await this.#store.read(current));
      if (mine === this.#reading) {
        this.#data = data;
        this.#window.show({ state: 'ready', guides: this.#list, current, data, error: '' });
        if (focus !== null) this.#window.focusPerson(focus);
      }
    } catch (error) {
      if (mine !== this.#reading) return;
      if (!(error instanceof MissingTable)) console.error('GFS : lecture du guide impossible', error);
      const text = error instanceof MissingTable ? t('gd.tableGone', { table: error.table }) : t('gd.readFailed', { reason: String(error && error.message) });
      this.#window.show({ state: 'error', guides: this.#list, current, data: null, error: text });
    }
  }

  // L'annuaire du guide, vu d'un lecteur ordinaire (une fiche masquée par « Ma présence » ne se contacte pas) ; null sans annuaire, ou quand il ne se lit
  // plus : les rôles se lisent alors comme du texte.
  async #directory(row, schema) {
    if (!row) return null;
    try {
      const found = (await this.#annuaires.list()).find(each => String(each.row) === row);
      if (!found) return null;
      return directoryOf(presenceView(await this.#annuaires.read(found, schema), { admin: false, identity: this.#o.identity() }));
    } catch (error) {
      console.warn('GFS : l\'annuaire du guide ne se lit pas', error);
      return null;
    }
  }

  // Ce que la fenêtre montre d'un guide : sa lecture, et pour chaque démarche la réponse « qui contacter » (héritage et repli compris), calculée à la demande.
  async #viewOf(read) {
    const directory = await this.#directory(read.config.directory, read.schema);
    const colOf = col => columnOf(read.schema, read.guide.table, col);
    const cache = new Map();
    const answerFor = row => {
      if (!cache.has(row)) cache.set(row, answerOf(rolesFor(read.index, read.config, row), colOf, directory));
      return cache.get(row);
    };
    return { ...read, directory, answerFor };
  }

  async #schema() {
    try {
      return await this.#store.schema();
    } catch (error) {
      console.error('GFS : lecture des tables impossible', error);
      this.#o.notice(this.#o.t('gd.needsAccess'));
      return null;
    }
  }

  // Les annuaires du document, pour le choix des contacts : [{ row, name, table, show }].
  async #directories() {
    try {
      return (await this.#annuaires.list()).filter(each => !each.parent).map(each =>
        ({ row: each.row, name: each.name, table: each.table, show: each.config.name }));
    } catch (error) {
      return [];
    }
  }

  // « Créer une table pour ce guide » : la personne dit oui dans une fenêtre qui nomme la table et ses colonnes ; GFS crée la table, puis la colonne de la
  // démarche mère (une référence à la table elle-même, qui montre le titre). Rend les colonnes que le guide lira, ou null.
  async #makeTable(schema) {
    const { t } = this.#o;
    const taken = new Set(Object.keys(schema).map(normalize));
    let name = PROCEDURE_TABLE.id;
    for (let n = 2; taken.has(normalize(name)); n += 1) name = `${PROCEDURE_TABLE.id}_${n}`;
    const ok = await this.#o.ask({ title: t('gd.tbl.askTitle', { table: name }),
      message: t('gd.tbl.askText', { table: name, columns: PROCEDURE_COLUMNS.map(col => col.id).join(', ') }),
      confirmLabel: t('table.create'), cancelLabel: t('table.cancel') });
    if (!ok) return null;
    try {
      const made = await this.#store.addTable(name, PROCEDURE_COLUMNS);
      schema[made.id] = { columns: made.columns.map(col => ({ id: col.id, type: col.type, genre: 'text', ref: '', visible: '' })) };
      const [title, keywords, steps, details] = made.columns.map(col => col.id);
      const parent = await this.#store.addColumn(made.id, PROCEDURE_TABLE.parent, `Ref:${made.id}`, title);
      schema[made.id].columns.push({ id: parent.id, type: `Ref:${made.id}`, genre: 'ref', ref: made.id, visible: title });
      return { table: made.id, title, parent: parent.id, keywords, steps, details };
    } catch (error) {
      console.error('GFS : création de la table des démarches impossible', error);
      this.#o.notice(t('gd.tbl.failed', { reason: String(error && error.message) }));
      return null;
    }
  }

  // Des colonnes de texte pour les champs et le type des démarches : la personne dit oui dans une fenêtre qui les nomme, GFS les ajoute à la table du guide.
  // Rend { clé : identifiant réel de la colonne } (Grist choisit l'identifiant), ou null quand elle refuse.
  async #makeColumns(schema, table, specs) {
    const { t } = this.#o;
    const ok = await this.#o.ask({ title: t('gd.fld.askTitle'), message: t('gd.fld.askText', { table, columns: specs.map(spec => spec.name).join(', ') }),
      confirmLabel: t('table.create'), cancelLabel: t('table.cancel') });
    if (!ok) return null;
    const made = {};
    try {
      for (const spec of specs) {
        const col = await this.#store.addColumn(table, spec.name, 'Text');
        made[spec.key] = col.id;
        if (schema[table]) schema[table].columns.push({ id: col.id, type: 'Text', genre: 'text', ref: '', visible: '' });
      }
    } catch (error) {
      console.error('GFS : création des colonnes du guide impossible', error);
      this.#o.notice(t('gd.fld.failed', { reason: String(error && error.message) }));
    }
    return made;
  }

  async #setup(guide) {
    const schema = await this.#schema();
    if (!schema) return null;
    return new GuideSetup({ container: this.#o.container, inertTargets: this.#o.inertTargets, t: this.#o.t, schema, guide,
      taken: guide ? [] : this.#list.map(each => each.name),
      directories: await this.#directories(), createTable: () => this.#makeTable(schema),
        createColumns: (table, specs) => this.#makeColumns(schema, table, specs),
        createColumn: (table, name, type, show) => this.#store.addColumn(table, name, type, show),
      writeBlock: () => this.#o.writeBlock() }).run();
  }

  // Un nouveau guide : le réglage, puis l'écriture (la table `GFS_Guides` naît avec l'accord de la personne).
  async #create() {
    const t = this.#o.t;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const made = await this.#setup(null);
    if (!made) return;
    try {
      const guide = await this.#store.create(made);
      this.#row = guide.row;
      await this.#load();
    } catch (error) {
      if (error instanceof TableDeclined) this.#o.notice(t('gd.declined'));
      else if (error instanceof NameTaken) this.#o.notice(t('gd.set.errTaken'));
      else { console.error('GFS : création du guide impossible', error); this.#o.notice(t('gd.saveFailed', { reason: String(error && error.message) })); }
    }
  }

  // Le réglage du guide montré.
  async #configure() {
    const t = this.#o.t;
    const current = this.#current;
    if (!current) { await this.#create(); return; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const done = await this.#setup(current);
    if (!done) return;
    try {
      const saved = await this.#store.save(current, done);
      this.#list = this.#list.map(each => (each.row === saved.row ? saved : each));
      await this.#read();
    } catch (error) {
      console.error('GFS : enregistrement du guide impossible', error);
      this.#o.notice(t('gd.saveFailed', { reason: String(error && error.message) }));
    }
  }

  // Écrire une démarche (`row` null : une neuve, sous `parent`) ou la retirer : la fenêtre de saisie, puis l'écriture dans la table du guide, puis la
  // relecture.
  async #editProc(row, parent = null) {
    const { t } = this.#o;
    const data = this.#data;
    const current = this.#current;
    if (!data || !current) return;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const proc = row === null ? null : data.index.byRow.get(row) || null;
    const fields = fieldsOf(data.config, data.schema, current.table, data.directory);
    const done = await new GuideEdit({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, fields, read: data, directory: data.directory, proc,
      parent,
      writeBlock: () => this.#o.writeBlock() }).run();
    if (!done) return;
    try {
      if (done.remove) { await this.#remove(proc, data, current); return; }
      const saved = await this.#store.saveProcedure(current, proc ? proc.row : null, recordOf(done.fields, done.values, done.before));
      await this.#read();
      if (Number.isFinite(saved)) this.#window.showProc(saved);
      this.#window.say(t(proc ? 'gd.proc.saved' : 'gd.proc.created', { title: String(done.values.title).trim() }));
    } catch (error) {
      console.error('GFS : écriture de la démarche impossible', error);
      this.#o.notice(t('gd.proc.saveFailed', { reason: String(error && error.message) }));
    }
  }

  // Retirer une démarche : la personne confirme dans une fenêtre qui dit ce qui devient de ses sous-démarches (elles passent à la racine).
  async #remove(proc, data, current) {
    const { t } = this.#o;
    const kids = (data.index.children.get(proc.row) || []).map(kid => kid.row);
    const ok = await this.#o.ask({ title: t('gd.proc.del.title', { title: proc.title }),
      message: t(kids.length ? 'gd.proc.del.text' : 'gd.proc.del.none', { table: current.table, n: kids.length }),
      confirmLabel: t('gd.proc.remove'), cancelLabel: t('table.cancel') });
    if (!ok) return;
    await this.#store.removeProcedure(current, proc.row, kids);
    await this.#read();
    this.#window.say(t('gd.proc.removed', { title: proc.title }));
  }

  // Un autre guide du document, ou un nouveau.
  async #switch() {
    const t = this.#o.t;
    const items = [...this.#list.map(each => ({ value: String(each.row), label: each.name, glyph: 'guide', hint: each.table })),
      { value: NEW, label: t('gd.new'), glyph: 'plus', hint: '' }];
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('gd.switch'), items,
      current: String(this.#row), none: t('an.noneFound') });
    if (chosen === null) return;
    if (chosen === NEW) { await this.#create(); return; }
    if (Number(chosen) === this.#row) return;
    this.#row = Number(chosen);
    await this.#read();
  }
}

// Le contrôle monté pour le contrôleur de GFS (`c`).
export function createGuide(c) {
  return new GuideControl({ port: c.port, container: c.$('stage'), t: c.t, locale: () => c.locale, inertTargets: c.inertTargets, ask: opts => c.ask(opts),
    notice: text => c.notice(text),
    writeBlock: () => c.writeBlock(), fullAccess: () => c.fullAccess, identity: () => c.identity || '' });
}
