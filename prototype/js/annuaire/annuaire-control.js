// Le module Annuaire de GFS (demande du porteur du 25/11) : il tient la lecture des annuaires du document (js/annuaire/annuaire-store.js), la fenêtre qui les
// montre (js/annuaire/annuaire-window.js) et le réglage (js/annuaire/annuaire-setup.js). Le module ne se charge qu'au premier clic sur son bouton
// (js/shell/annuaire-entry.js) : GFS ne paie rien tant que la personne n'ouvre pas l'annuaire. Lire ne crée rien ; créer un annuaire écrit une ligne dans
// `GFS_Directories`, que GFS crée alors avec l'accord de la personne. Les personnes restent dans leur table : GFS la lit, ne l'écrit pas.

import { AnnuaireStore, MissingTable, NameTaken, TableDeclined } from './annuaire-store.js';
import { AnnuaireWindow } from './annuaire-window.js';
import { AnnuaireSetup } from './annuaire-setup.js';
import { pickFrom } from '../ui/pick-window.js';
import { shown } from './annuaire-panes.js';
import { EditWindow } from './annuaire-edit-window.js';
import { openAdd } from './annuaire-add-window.js';
import { addBlock } from './annuaire-add.js';
import { editableFields, personValues } from './annuaire-edit.js';
import { CheckWindow } from './annuaire-check-window.js';
import { MailWindow } from './annuaire-mail-window.js';
import { runChecks, checkNeeds } from './annuaire-check.js';
import { presenceView, presenceCol } from './annuaire-presence.js';
import { editRight, editorRows, editWhy } from './annuaire-edit-rights.js';
import { csvColumns } from './annuaire-mail.js';
import { CHECK_KINDS, updateAction } from './annuaire-config.js';
import { columnOf } from './annuaire-schema.js';
import { fieldGenres } from './annuaire-model.js';
import { copyText } from './annuaire-copy.js';
import { saveText } from '../apps/dependencies-export.js';
import { SubControl } from './annuaire-sub-control.js';
import { LockControl } from './annuaire-lock-control.js';
import { isSub, parentOf, orderAnnuaires } from './annuaire-sub.js';
import { MergedView, canMerge } from './annuaire-merge-view.js';
import { MERGED_ROW, mergeReads } from './annuaire-merge.js';
import { PickWindow, personPayload } from './annuaire-pick.js';
import { useImages } from './annuaire-images.js';

const NEW = '__new__';
const NEW_SUB = '__new_sub__';
const MERGED = '__merged__';
const SUB_WHY = Object.freeze({ refresh: 'an.sub.refreshWhy', share: 'an.sub.shareWhy', remove: 'an.sub.removeWhy' });

export class AnnuaireControl {
  #o;
  #store;
  #window;
  #list = [];
  #row = null; // l'annuaire montré (le numéro de sa ligne)
  #reading = 0; // le numéro de la dernière lecture lancée : une lecture plus ancienne qui finit après ne montre rien
  #data = null; // la dernière lecture de l'annuaire montré (le formulaire « Modifier » en prend les valeurs et les choix), vue de la personne qui lit
  #sub; // les gestes d'un sous-annuaire (js/annuaire/annuaire-sub-control.js)
  #lock; // le verrou réel dans Grist, sur demande (js/annuaire/annuaire-lock-control.js)
  #merge = new MergedView(); // la vue « Tous mes annuaires » (js/annuaire/annuaire-merge-view.js)
  #picker = null; // la fenêtre « Choisir une personne » qu'une app a demandée (js/annuaire/annuaire-pick.js)
  #loaded = false; // la liste des annuaires a été lue (sans erreur) à la dernière lecture
  #admin = null; // la preuve qu'a GFS que la personne administre le document (une promesse, demandée une fois : js/broker/transfer.js, `isOwner`)

  // opts : { port ({ doc }), container, t, locale(), inertTargets(), ask(opts) -> Promise<boolean>, notice(texte), writeBlock() -> texte ou null, fullAccess(),
  //   images ({ download(numéro) -> Blob, upload(fichier, nom) -> numéro } : les pièces jointes des photos et des logos, js/annuaire/annuaire-images.js),
  //   isOwner() -> Promise<vrai, faux ou null> (jamais deviné : seul « vrai » compte), identity() -> l'adresse de la personne, ou '' tant qu'on ne la connaît
  //   pas }
  constructor(opts) {
    this.#o = opts;
    useImages(opts.images || null);
    const consent = () => opts.ask({ title: opts.t('an.table.title'), message: opts.t('an.table.text'), confirmLabel: opts.t('table.create'),
      cancelLabel: opts.t('table.cancel') });
    this.#store = new AnnuaireStore({ port: opts.port, consent });
    this.#sub = new SubControl({ store: this.#store, t: opts.t, locale: opts.locale, container: opts.container, inertTargets: opts.inertTargets,
      ask: o => opts.ask(o),
      notice: text => opts.notice(text), say: text => this.#window.say(text), writeBlock: () => opts.writeBlock(), admin: () => this.#admin,
        identity: opts.identity,
      rights: opts.rights, origin: parent => this.#origin(parent), reload: row => this.#reload(row) });
    this.#lock = new LockControl({ t: opts.t, locale: opts.locale, container: opts.container, inertTargets: opts.inertTargets, ask: o => opts.ask(o),
      notice: text => opts.notice(text), port: opts.port, rights: opts.rights, schema: () => this.#schema(), writeBlock: () => opts.writeBlock() });
    this.#window = new AnnuaireWindow({ container: opts.container, t: opts.t, locale: opts.locale, inertTargets: opts.inertTargets, writeBlock: opts.writeBlock,
      onSwitch: () => void this.#switch(), onConfigure: () => void this.#configure(), onNew: () => void this.#create(), onEdit: row => this.#edit(row),
        onAdd: () => this.#addPeople(),
      onCheck: () => this.#check(), onMail: people => this.#mail(people), onPresence: (row, on) => this.#setPresence(row, on),
        onSub: key => this.#subGesture(key), onMergePick: row => this.#mergePick(row), targets: () => (opts.targets ? opts.targets() : []),
      onInsert: (id, person) => this.#insert(id, person), onUnlock: target => (opts.unlock ? opts.unlock(target) : undefined),
      onApps: () => (opts.apps ? opts.apps() : undefined),
      onFilterMore: (col, option) => this.#more(col, option), onSortPick: (keys, sort) => this.#pickSort(keys, sort), onClose: () => {} });
  }

  get isOpen() { return this.#window.isOpen; }
  get element() { return this.#window.element; }

  // Ouvre la fenêtre sur « Lecture… », puis lit les annuaires du document. `row` : le numéro de la ligne de l'annuaire à montrer (celui qu'on a choisi dans
  // l'explorateur) ; sans lui, le dernier vu, sinon le premier.
  async open(row = null) {
    if (this.#window.isOpen) return;
    if (Number.isFinite(row)) this.#row = row;
    this.#proof();
    this.#window.show({ state: 'loading', error: '' });
    this.#window.open();
    await this.#load();
  }

  // La preuve que GFS a que la personne administre le document, demandée une fois.
  #proof() {
    this.#admin ??= Promise.resolve().then(() => this.#o.isOwner()).then(owner => owner === true, () => false);
    return this.#admin;
  }

  close() { this.#window.close(); }

  // « Nouveau > Annuaire » de l'explorateur (retour du porteur, 25/11 : « si c'est le premier, on bascule sur le réglage du premier, sinon c'est un
  // sous-annuaire qui hérite des paramètres du premier ») : la fenêtre s'ouvre, puis le réglage d'un premier annuaire quand le document n'en a aucun, sinon un
  // sous-annuaire de celui qu'on voit (il reprend sa définition ; seul un propriétaire en crée un, et la phrase le dit sinon). Une lecture qui a échoué se dit
  // dans la fenêtre : rien n'est proposé.
  async createNew() {
    if (!this.#window.isOpen) await this.open(null);
    if (!this.#loaded) return;
    if (!this.#list.length) { await this.#create(); return; }
    if (!(await this.#proof())) { this.#o.notice(this.#o.t('an.sub.newWhy')); return; }
    await this.#newSub();
  }

  // ---------- les liens avec les apps (contrats 5.4, point 16) ----------

  // « Insérer dans… » : l'app s'ouvre avec la personne ; la fenêtre de l'annuaire se referme quand l'ouverture est partie.
  async #insert(appId, person) {
    if (!this.#o.insert) return false;
    const opened = await this.#o.insert(appId, person);
    if (opened) this.#window.close();
    return opened;
  }

  // Les groupes de la fenêtre « Choisir une personne » : « Tous mes annuaires » (quand il y en a plusieurs : une adresse e-mail ne fait qu'une personne), puis
  // chaque annuaire que la personne lit, vu comme dans la fenêtre de l'annuaire (sans les fiches masquées, sauf pour un administrateur).
  async #pickGroups() {
    const { t } = this.#o;
    const admin = (await this.#proof()) === true;
    const identity = this.#o.identity();
    const list = orderAnnuaires(await this.#store.list());
    const settled = await Promise.all(list.map(async annuaire => {
      try { return { annuaire, read: presenceView(await this.#store.read(annuaire), { admin, identity }) }; } catch (error) { return null; }
    }));
    const sources = settled.filter(Boolean);
    const labels = { origin: t('an.merge.origin'), path: t('an.merge.path') };
    const path = person => person.levels.filter(Boolean).join(' · ');
    const groups = sources.map(({ annuaire, read }) => ({ label: annuaire.name, people: read.people, path, origin: () => annuaire.name }));
    if (sources.length < 2) return groups;
    const merged = mergeReads(sources, labels);
    return [{ label: t('an.merge.title'), people: merged.people, path: person => (person.fields[labels.path] || []).join(' ; '),
      origin: person => (person.fields[labels.origin] || [])[0] || '' }, ...groups];
  }

  // `choisirPersonne` d'une app : la fenêtre s'ouvre par-dessus l'app ; rend la personne choisie, ou null (annulé). Une seule à la fois.
  async pick({ title = '', app = '' } = {}) {
    const { t } = this.#o;
    if (this.#picker) return null;
    let groups = [];
    let problem = '';
    try {
      groups = this.#o.fullAccess() ? await this.#pickGroups() : [];
      if (!this.#o.fullAccess()) problem = t('an.needsAccess');
      else if (!groups.length) problem = t('an.pick.noAnnuaire');
    } catch (error) {
      console.error('GFS : lecture des personnes impossible', error);
      problem = t('an.pick.failed', { reason: String(error && error.message ? error.message : error) });
    }
    this.#picker = new PickWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title, app, groups, problem });
    try { return await this.#picker.run(); } finally { this.#picker = null; }
  }

  // L'app qui demandait n'est plus là : la fenêtre se ferme sans rien rendre.
  cancelPick() { if (this.#picker) this.#picker.cancel(); }

  relocalize() { this.#window.relocalize({ t: this.#o.t }); }

  // L'annuaire montré ; la vue fusionnée n'existe qu'avec deux annuaires au moins.
  get #current() {
    if (this.#row === MERGED_ROW) return canMerge(this.#list) ? this.#merge.annuaire(this.#o.t, this.#merge.on(this.#list).length) : null;
    return this.#list.find(each => each.row === this.#row) || null;
  }

  // Lit la liste des annuaires, puis celui qu'on montre (le dernier vu, sinon le premier).
  async #load() {
    const t = this.#o.t;
    this.#loaded = false;
    if (!this.#o.fullAccess()) { this.#window.show({ state: 'error', error: t('an.needsAccess'), annuaires: [], current: null, data: null }); return; }
    try {
      this.#list = orderAnnuaires(await this.#store.list());
    } catch (error) {
      console.error('GFS : lecture des annuaires impossible', error);
      this.#window.show({ state: 'error', error: t('an.readFailed', { reason: String(error && error.message) }), annuaires: [], current: null, data: null });
      return;
    }
    this.#loaded = true;
    if (!this.#list.length) { this.#row = null; this.#window.show({ state: 'none', annuaires: [], current: null, data: null }); return; }
    if (!this.#current) this.#row = this.#row === null && canMerge(this.#list) ? MERGED_ROW : this.#list[0].row; // la première fois : tous les annuaires réunis
    await this.#read();
  }

  // Lit l'annuaire montré (ses personnes et sa hiérarchie) ; `silent` : sans repasser par « Lecture… » (la fiche qu'on vient d'écrire se relit sur place).
  async #read(silent = false) {
    const current = this.#current;
    const t = this.#o.t;
    const mine = ++this.#reading;
    if (!silent) this.#window.show({ state: 'loading', annuaires: this.#list, current, data: null });
    try {
      const data = current.merged ? await this.#readMerged() : await this.#viewOf(await this.#store.read(current));
      this.#data = data;
      if (mine === this.#reading) this.#window.show({ state: 'ready', annuaires: this.#list, current, data, error: '' });
    } catch (error) {
      if (mine !== this.#reading) return;
      if (!(error instanceof MissingTable)) console.error('GFS : lecture de l\'annuaire impossible', error);
      const text = error instanceof MissingTable ? t('an.tableGone', { table: error.table }) : t('an.readFailed', { reason: String(error && error.message) });
      this.#window.show({ state: 'error', annuaires: this.#list, current, data: null, error: text });
    }
  }

  // La vue fusionnée : chaque annuaire coché se lit comme pour un seul (sans les fiches masquées, sauf pour un administrateur), puis la réunion.
  async #readMerged() {
    const admin = (await this.#admin) === true;
    const identity = this.#o.identity();
    return this.#merge.read(this.#list, { t: this.#o.t, admin, identity, read: async annuaire =>
      presenceView(await this.#store.read(annuaire), { admin, identity }) });
  }

  // Une case du panneau « Annuaires affichés » : la vue se relit sur place (sans repasser par « Lecture… »). Faux : c'était le dernier annuaire coché.
  async #mergePick(row) {
    if (!this.#merge.toggle(row, this.#list)) return false;
    await this.#read(true);
    return true;
  }

  // Ce que la personne qui lit voit : sans les fiches masquées (sauf si elle administre ou si c'est la sienne), et les points de « À vérifier » (calculés pour
  // les administrateurs seulement).
  async #viewOf(read) {
    const admin = (await this.#admin) === true;
    const identity = this.#o.identity();
    const view = presenceView(read, { admin, identity });
    if (isSub(read.annuaire)) { // la copie : ni « À vérifier » ni « Modifier » (ils se font dans l'annuaire d'origine), des gestes que Grist garde
      const parent = parentOf(this.#list, read.annuaire);
      return { ...view, admin, identity, found: { issues: [], counts: {}, total: 0 }, checks: { admin: false, on: false, total: 0, sub: true },
        sub: { at: read.copy.at, parent: parent ? parent.name : '', can: this.#sub.can(read.annuaire, admin) } };
    }
    const on = CHECK_KINDS.some(kind => view.config.checks.includes(kind) && !checkNeeds(kind, view.config));
    const found = admin && on ? runChecks(view) : { issues: [], counts: {}, total: 0 };
    return { ...view, admin, identity, found, checks: { admin, on, total: found.total }, editors: editorRows(view) };
  }

  // « Modifier » une fiche : le formulaire des colonnes directes de la personne, la relecture, puis l'écriture (une ligne de la table des personnes, sur le
  // geste « Enregistrer »). Rien d'autre n'est écrit ; la fiche se relit sur place.
  async #edit(row) {
    const t = this.#o.t;
    const read = this.#data;
    const person = read && read.people.find(each => each.row === row);
    if (!person) return;
    // la fenêtre grise déjà « Modifier » : une seconde garde
    if (!editRight(person, read).can) { this.#o.notice(editWhy(read.config, t, this.#o.locale(), read.identity || '')); return false; }
    const table = read.annuaire.table;
    const { fields, locked } = editableFields(read.config, read.schema, table, t);
    const saved = await new EditWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, locale: this.#o.locale(), person, table, fields,
      locked,
      values: personValues(fields, read.data[table], row), options: { data: read.data, people: read.people, table, plan: read.plan },
      lockedText: entry => (['name', 'title', 'email', 'phone'].includes(entry.key) ? person[entry.key] : (person.fields[entry.key] || []).join(', ')),
      save: action => this.#store.update(action) }).run();
    if (!saved) return false;
    await this.#read(true);
    this.#window.say(t('an.edit.saved', { name: person.name }));
    return true;
  }

  // « Ajouter » : la fenêtre « Modifier » à vide, avec les fiches préparées l'une après l'autre ; une seule relecture, puis une seule écriture (les lignes
  // s'ajoutent à la table des personnes, rien d'autre). La liste se relit, le pied dit combien de personnes sont ajoutées.
  async #addPeople() {
    const read = this.#data;
    const { t } = this.#o;
    if (!read) return false;
    const blocked = addBlock(read, this.#o.writeBlock ? this.#o.writeBlock() : null, t);
    if (blocked) { this.#window.say(blocked); return false; } // le bouton grisé redit sa raison dans le pied
    const { saved, names } = await openAdd({ read, t, locale: this.#o.locale(), container: this.#o.container, inertTargets: this.#o.inertTargets,
      save: action => this.#store.update(action) });
    if (!saved) return false;
    await this.#read(true);
    this.#window.say(t('an.add.done', { n: names.length, names: names.length > 3 ? `${names.slice(0, 3).join(', ')}…` : names.join(', ') }));
    return true;
  }

  // « À vérifier » : la fenêtre des points, avec les gestes qui les règlent (ouvrir la fiche, la modifier, comparer, masquer) ; elle relit l'annuaire après
  // chaque écriture et relance les contrôles.
  async #check() {
    const read = this.#data;
    if (!read) return;
    const { t } = this.#o;
    if (read.sub) { this.#window.say(t('an.check.sub')); return; }
    const locale = this.#o.locale();
    const genres = fieldGenres(read.config, read.annuaire.table, read.schema);
    await new CheckWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, locale, name: read.annuaire.name,
      result: read.found, config: read.config, format: (col, value) => shown(value, genres[col], { t, locale }),
        person: row => (this.#data ? this.#data.people.find(each => each.row === row) : null),
      canHide: Boolean(presenceCol(read.config)), open: row => this.#window.showPerson(row), edit: row => this.#edit(row),
        hide: row => this.#setPresence(row, false),
      recheck: async () => { await this.#read(true); return this.#data.found; } }).run();
  }

  // « Écrire au groupe » : la fenêtre des adresses des personnes affichées (copier, ouvrir des messages qui tiennent, exporter).
  async #mail(people) {
    const read = this.#data;
    if (!read) return;
    const { t } = this.#o;
    const locale = this.#o.locale();
    const doc = this.#o.container.ownerDocument;
    const genres = fieldGenres(read.config, read.annuaire.table, read.schema);
    const columns = csvColumns(read.config, { labels: { name: t('an.col.name'), email: t('an.mail'), phone: t('an.phone') }, genres,
      show: (value, genre) => shown(value, genre, { t, locale }) });
    await new MailWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, locale, name: read.annuaire.name, people,
      options: read.config.mail,
      columns, copy: text => copyText(text, doc), save: (name, text, type) => saveText(doc, name, text, type),
        day: () => new Date().toISOString().slice(0, 10) }).run();
  }

  // « Ma présence » : la personne (ou un administrateur) choisit d'apparaître ou non ; une seule case de la table des personnes s'écrit, sur le geste. Grist
  // garde le dernier mot (ses règles d'accès) : un refus est dit tel quel. Rend vrai quand le choix est écrit.
  async #setPresence(row, on) {
    const { t } = this.#o;
    const read = this.#data;
    const col = read ? presenceCol(read.config) : '';
    const person = read && read.people.find(each => each.row === row);
    if (!col || !person) return false;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return false; }
    const table = read.annuaire.table;
    try {
      if (!columnOf(read.schema, table, col)) throw new Error(t('an.tableGone', { table: `${table}.${col}` })); // jamais une colonne qui n'existe plus
      await this.#store.update(updateAction(table, row, { [col]: !on })); // la case cochée dit « masquée »
    } catch (error) {
      this.#window.say(t('an.pres.refused', { reason: String(error && error.message ? error.message : error) }));
      return false;
    }
    await this.#read(true);
    this.#window.say(t(on ? 'an.pres.shown' : 'an.pres.hidden', { name: person.name }));
    return true;
  }

  // La lecture d'un annuaire principal, vue d'un administrateur (les fiches masquées y sont) : de quoi prendre la copie d'un sous-annuaire.
  async #origin(parent) {
    return presenceView(await this.#store.read(parent), { admin: true, identity: this.#o.identity() });
  }

  // Relit la liste et montre l'annuaire `row` (celui qu'on montrait, sans numéro).
  async #reload(row) {
    if (row !== null && row !== undefined) this.#row = row;
    await this.#load();
  }

  // Un nouveau sous-annuaire de l'annuaire montré (ou, dans un sous-annuaire, de son annuaire d'origine).
  async #newSub() {
    const current = this.#current;
    const parent = current && current.merged ? await this.#parentFor() : current && isSub(current) ? parentOf(this.#list, current) : current;
    if (!parent) { if (!(current && current.merged)) this.#o.notice(this.#o.t('an.sub.parentGone')); return; }
    await this.#sub.create(parent, this.#list);
  }

  // Dans la vue fusionnée, l'annuaire d'origine d'un nouveau sous-annuaire se choisit (le seul annuaire principal, sinon la liste avec recherche).
  async #parentFor() {
    const mains = this.#list.filter(each => !isSub(each));
    if (mains.length <= 1) return mains[0] || null;
    const t = this.#o.t;
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.merge.newSubTitle'),
      items: mains.map(each => ({ value: String(each.row), label: each.name, glyph: 'annuaire', hint: each.table })), none: t('an.noneFound') });
    return chosen === null ? null : mains.find(each => String(each.row) === chosen) || null;
  }

  // Le menu d'un sous-annuaire : actualiser, partager, supprimer. Un geste que la personne ne peut pas faire dit pourquoi.
  async #subGesture(key) {
    const current = this.#current;
    const can = this.#data && this.#data.sub ? this.#data.sub.can : null;
    if (!current || !isSub(current) || !can) return;
    if (!can[key]) { this.#window.say(this.#o.t(SUB_WHY[key])); return; }
    if (key === 'refresh') await this.#sub.refresh(current, this.#list, this.#data.people.length);
    else if (key === 'share') await this.#sub.share(current);
    else await this.#sub.remove(current, this.#list);
  }

  // Un autre annuaire du document, ou un nouveau.
  async #switch() {
    const t = this.#o.t;
    const parentName = each => (parentOf(this.#list, each) || { name: '' }).name;
    const items = [...(canMerge(this.#list) ? [{ value: MERGED, label: t('an.merge.title'), glyph: 'users',
      hint: t('an.merge.foot', { n: this.#list.length }) }] : []),
    ...this.#list.map(each => ({ value: String(each.row), label: each.name, glyph: isSub(each) ? 'lock' : 'annuaire',
      hint: isSub(each) ? t('an.sub.of', { name: parentName(each) }) : each.table })),
    { value: NEW, label: t('an.new'), glyph: 'plus', hint: '' },
    ...(this.#list.length ? [{ value: NEW_SUB, label: t('an.sub.new'), glyph: 'plus', hint: t('an.sub.newHint') }] : [])];
    const chosen = await pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.switch'), items,
      current: this.#row === MERGED_ROW ? MERGED : String(this.#row),
      none: t('an.noneFound') });
    if (chosen === null) return;
    if (chosen === MERGED) { if (this.#row !== MERGED_ROW) { this.#row = MERGED_ROW; await this.#read(); } return; }
    if (chosen === NEW) { await this.#create(); return; }
    if (chosen === NEW_SUB) { await this.#newSub(); return; }
    if (Number(chosen) === this.#row) return;
    this.#row = Number(chosen);
    await this.#read();
  }

  // Un nouvel annuaire : le réglage, puis l'écriture (la table `GFS_Directories` naît avec l'accord de la personne).
  async #create() {
    const t = this.#o.t;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const schema = await this.#schema();
    if (!schema) return;
    const made = await new AnnuaireSetup({ ...this.#setupTools(schema), annuaire: null, taken: this.#list.map(each => each.name) }).run();
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
    if (isSub(current)) { this.#window.say(t('an.sub.noConfig')); return; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return; }
    const schema = await this.#schema();
    if (!schema) return;
    const admin = (await this.#proof()) === true;
    const setup = new AnnuaireSetup({ ...this.#setupTools(schema), annuaire: current, taken: [], lock: this.#lock.forSetup(current, admin),
      read: (draft, cache) => this.#store.read({ ...current, ...draft },
      schema, cache) });
    const done = await setup.run();
    if (!done) {
      if (setup.wrote) await this.#read(); // une colonne créée ou modifiée pendant le réglage : l'annuaire se relit avec ce que Grist a maintenant
      return;
    }
    try {
      const saved = await this.#store.save(current, done.config, done.table);
      this.#list = this.#list.map(each => (each.row === saved.row ? saved : each));
      await this.#read();
    } catch (error) {
      console.error('GFS : enregistrement de l\'annuaire impossible', error);
      this.#o.notice(t('an.saveFailed', { reason: String(error && error.message) }));
    }
  }

  // Ce que le réglage reçoit : la fenêtre, les tables du document, de quoi lire (l'aperçu et les exemples) et de quoi créer une colonne (l'accord est donné
  // dans sa propre fenêtre ; `writeBlock` dit ce qui empêche d'écrire).
  #setupTools(schema) {
    return { container: this.#o.container, inertTargets: this.#o.inertTargets, t: this.#o.t, schema,
      read: (draft, cache) => this.#store.read(draft, schema, cache),
      fetch: name => this.#store.table(name), createColumn: (table, name, type, show, choices) => this.#store.addColumn(table, name, type, show, choices),
      columnState: (table, column) => this.#store.columnState(table, column), modify: actions => this.#store.modify(actions),
      createTable: name => this.#store.addTable(name), createPlanTable: name => this.#store.addPlanTable(name),
        writeBlock: () => this.#o.writeBlock() };
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

  // Les colonnes qu'on peut trier : la liste avec recherche ; le premier geste trie en croissant, le second en décroissant. « Ordre de l'annuaire » rend
  // l'ordre par nom.
  #pickSort(keys, sort) {
    const t = this.#o.t;
    const items = [{ value: '__none', label: t('an.sort.none'), glyph: 'sort', alt: false },
      ...keys.map(entry => ({ value: entry.key, label: entry.label, glyph: 'sort' }))];
    return pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, title: t('an.sort.title'), items,
      current: sort ? sort.key : '__none',
      none: t('an.noneFound'), alt: { icon: 'chev-down', label: item => t('an.sort.descFor', { col: item.label }), text: () => t('an.sort.descShort') } });
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
    notice: text => c.notice(text), writeBlock: () => c.writeBlock(), fullAccess: () => c.fullAccess, isOwner: () => c.transfer.isOwner(),
    images: { download: id => c.transfer.download(id), upload: (file, name) => c.transfer.upload(file, name) },
    identity: () => c.identity || '', rights: c.rights, targets: () => c.personTargets(), insert: (id, person) => c.openings.openPerson(id, person),
    unlock: target => c.unlock({ text: target.lock, focus: target.focus }), apps: () => c.openModules() });
}
