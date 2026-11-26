// Le réglage d'un annuaire (module Annuaire, demande du porteur du 25/11) : une fenêtre à onglets, sur la maquette. « Personnes » : la table et les
// colonnes lues (par défaut le nom et l'adresse e-mail) ; « Hiérarchie » : l'option « postes et hiérarchie » et les niveaux (un niveau = une colonne au choix,
// éventuellement après des références : « Structure › Pôle »), avec l'aperçu de l'arbre ; « Relations » : le responsable direct, l'assistant·e, le référent·e
// et les autres (une colonne qui désigne une personne, avec ses règles) ; « Champs de la fiche » : les champs libres, dont certains donnent des filtres. Une
// fenêtre du widget sur la base commune (js/ui/modal.js) ; chaque choix de table ou de colonne passe par la liste avec recherche (js/ui/pick-window.js,
// charte). Elle ne parle pas à Grist : l'aperçu lui vient de `read` (le contrôle lit les tables, une fois), et elle rend { name, table, config }, ou null quand
// la personne renonce ; l'écriture est à js/annuaire/annuaire-store.js. Les onglets sont dans js/annuaire/annuaire-setup-people.js, -levels.js, -relations.js,
// -fields.js et -options.js (« Ma présence », « À vérifier », « Écrire au groupe ») : ils reçoivent l'hôte (cet objet vu de l'extérieur : l'état, de quoi
// redessiner, de quoi choisir dans une liste). Grisé, jamais masqué : ce qu'une option éteinte débloque reste visible, grisé, avec sa raison.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { pickFrom } from '../ui/pick-window.js';
import { readConfig } from './annuaire-config.js';
import { genreOf, targetOf } from './annuaire-schema.js';
import { Sampler } from './annuaire-sample.js';
import { peopleTab, peopleAct } from './annuaire-setup-people.js';
import { hierarchyTab, hierarchyAct, levelInput, paintPreview } from './annuaire-setup-levels.js';
import { relationsTab, relationsAct, relationInput } from './annuaire-setup-relations.js';
import { fieldsTab, fieldsAct } from './annuaire-setup-fields.js';
import { optionsTab, optionsAct } from './annuaire-setup-options.js';

const TABS = Object.freeze([['people', 'an.tab.people', peopleTab], ['hier', 'an.tab.hier', hierarchyTab], ['relations', 'an.tab.relations', relationsTab],
  ['fields', 'an.tab.fields', fieldsTab], ['options', 'an.tab.options', optionsTab]]);
const PREVIEW_DELAY = 120; // ms : le temps qu'une suite de choix se pose avant de relire l'aperçu

export class AnnuaireSetup {
  #o;
  #draft;
  #ui;
  #refs = {};
  #preview = { state: 'idle', tree: null, counts: null };
  #cache = new Map();
  #sampler = null;
  #stamp = 0;
  #timer = null;

  // opts : { container, inertTargets(), t, schema, annuaire (celui qu'on règle, ou null), taken: [noms déjà pris], read(annuaire, cache) -> { people, tree }
  //   (facultatif), fetch(table) -> les tableaux de colonnes de la table (pour les exemples ; facultatif), createColumn(table, nom, type) -> { id } (l'écriture
  //   d'une
  //   colonne, avec l'accord de la personne donné dans la fenêtre « Créer une colonne » ; facultatif), createTable(nom) -> { id, columns } (l'écriture de la
  //   table
  //   des personnes, avec l'accord donné dans la fenêtre « Créer une table » ; facultatif), writeBlock() -> texte ou null (ce qui empêche d'écrire), lock (le
  //   verrou
  //   réel dans Grist : js/annuaire/annuaire-lock-control.js, `forSetup` ; facultatif : absent à la création)
  //   }
  constructor(opts) {
    this.#o = opts;
    const base = opts.annuaire;
    this.#draft = base ? { name: base.name, table: base.table, config: readConfig(base.config) } : { name: '', table: '', config: readConfig({}) };
    const { config } = this.#draft;
    this.#ui = { tab: 'people', split: Boolean(config.first), phone: Boolean(config.phone), more: Boolean(config.lead), fresh: null };
  }

  // Ce que les onglets voient de la fenêtre.
  get #host() {
    return { t: this.#o.t, schema: this.#o.schema, draft: this.#draft, ui: this.#ui, editing: Boolean(this.#o.annuaire), container: this.#o.container,
      inertTargets: this.#o.inertTargets, preview: this.#preview, lock: this.#o.lock || null, body: this.#refs.body, sample: this.#sample(),
      repaint: () => this.#paint(), changed: () => { this.#paint(); this.#schedule(); }, list: opts => this.#list(opts),
        focus: (...keys) => this.#focus(...keys), createColumn: (table, made) => this.#createColumn(table, made), createTable: name => this.#createTable(name),
        writeBlock: () => (this.#o.writeBlock ? this.#o.writeBlock() : null) };
  }

  // Les exemples en direct : une personne de la table choisie (js/annuaire/annuaire-sample.js), lue une fois par table ; le réglage se redessine quand elle
  // arrive.
  #sample() {
    const table = this.#draft.table;
    if (!this.#sampler || this.#sampler.table !== table) {
      const { t, schema } = this.#o;
      const sampler = new Sampler({ schema, table, fetch: name => this.#fetch(name),
        format: (value, genre) => (genre === 'bool' ? t(value === 'true' ? 'an.yes' : 'an.no') : value) });
      this.#sampler = sampler;
      if (table) { sampler.load(); sampler.whenLoaded(() => { if (this.#sampler === sampler && this.#ui.tab === 'people' && this.#refs.body) this.#paint(); });
        }
    }
    return this.#sampler;
  }

  // Une table lue pour les exemples : par le même cache que l'aperçu (une lecture par table) ; une lecture qui échoue n'y reste pas.
  #fetch(name) {
    if (!this.#o.fetch) return Promise.reject(new Error('lecture indisponible'));
    if (!this.#cache.has(name)) this.#cache.set(name, this.#o.fetch(name).catch(error => { this.#cache.delete(name); throw error; }));
    return this.#cache.get(name);
  }

  // Une colonne nouvelle dans `table` : Grist l'écrit (le nom réel peut changer : on le relit), le schéma du réglage la connaît aussitôt, la table se relira.
  async #createColumn(table, { name, type }) {
    if (!this.#o.createColumn) throw new Error('écriture indisponible');
    const made = await this.#o.createColumn(table, name, type, this.#draft.config.name);
    const col = { id: made.id, type, genre: genreOf(type), ref: targetOf(type), visible: '' };
    if (this.#o.schema[table]) this.#o.schema[table].columns.push(col);
    this.#cache.delete(table);
    return col;
  }

  // La table des personnes que GFS crée (son nom et son adresse e-mail) : Grist l'écrit (l'identifiant réel peut changer : on le relit), le schéma du réglage
  // la connaît aussitôt. Rend { table, name, email } : l'identifiant de la table et ceux des deux colonnes.
  async #createTable(name) {
    if (!this.#o.createTable) throw new Error('écriture indisponible');
    const made = await this.#o.createTable(name);
    this.#o.schema[made.id] = { columns: made.columns.map(col => ({ id: col.id, type: col.type, genre: genreOf(col.type), ref: '', visible: '' })) };
    this.#cache.delete(made.id);
    return { table: made.id, name: made.columns[0].id, email: made.columns[1].id };
  }

  // La fenêtre : rend { name, table, config } ou null.
  run() {
    const t = this.#o.t;
    const editing = Boolean(this.#o.annuaire);
    const refs = this.#refs = { tabs: h('div', { class: 'an-tabs', role: 'tablist', 'aria-label': t('an.tab.label') }),
      body: h('div', { class: 'mod-body an-set-body' }),
      note: h('p', { class: 'mod-note an-set-note', 'aria-live': 'polite' }) };
    const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'set-cancel' } }, t('an.set.cancel'));
    const save = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'set-save' } }, t(editing ? 'an.set.save' : 'an.set.create'));
    const section = h('section', { class: 'mod an-set', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-set-title' },
      h('header', { class: 'mod-head' }, h('h2', { id: 'an-set-title' }, t(editing ? 'an.set.titleEdit' : 'an.set.titleNew'))), refs.tabs, refs.body,
      h('footer', { class: 'mod-foot' }, refs.note, cancel, save));
    this.#paint();
    const { done, result } = openModal({ container: this.#o.container, section, inertTargets: this.#o.inertTargets, first: this.#firstFocus(), cancel: null });
    const close = value => { this.#stamp += 1; clearTimeout(this.#timer); done(value); };
    cancel.addEventListener('click', () => close(null));
    save.addEventListener('click', () => { if (this.#valid()) close(this.#result()); });
    refs.body.addEventListener('click', event => this.#click(event));
    refs.body.addEventListener('input', event => this.#input(event));
    refs.tabs.addEventListener('click', event => this.#click(event));
    refs.tabs.addEventListener('keydown', event => this.#tabKeys(event));
    this.#schedule();
    return result.then(value => { this.#stamp += 1; clearTimeout(this.#timer); return value; });
  }

  // Ce que la fenêtre rend : les niveaux sans nom prennent celui de leur colonne ; ceux qui n'ont pas de colonne ne comptent pas (la lecture les ignore).
  #result() {
    const { name, table, config } = this.#draft;
    const levels = config.levels.filter(level => level.path.length).map(level => ({ ...level, label: level.label.trim() || level.path.at(-1) }));
    const relations = config.relations.filter(rel => rel.col).map(rel => ({ ...rel, label: rel.label.trim(), inverse: rel.inverse.trim() }));
    return { name: name.trim(), table, config: { ...config, levels, relations } };
  }

  #firstFocus() {
    return this.#refs.body.querySelector('input:not([disabled])') || this.#refs.body.querySelector('button');
  }

  // Le premier de ces repères (`data-fk`) qui existe prend le clavier.
  #focus(...keys) {
    const nodes = [...this.#refs.body.querySelectorAll('[data-fk]')];
    for (const key of keys) {
      const node = nodes.find(each => each.dataset.fk === key);
      if (node) { node.focus({ preventScroll: false }); return; }
    }
  }

  // Ce qui empêche d'enregistrer : [l'onglet, le texte, le repère du clavier], ou null quand tout va.
  #problem() {
    const { name, table, config } = this.#draft;
    const taken = this.#o.taken.some(each => each.trim().toLowerCase() === name.trim().toLowerCase());
    if (!name.trim()) return ['people', 'an.set.errName', 'set-name'];
    if (taken) return ['people', 'an.set.errTaken', 'set-name'];
    if (!table) return ['people', 'an.set.errTable', 'pt'];
    if (!config.name) return ['people', 'an.set.errColumn', 'pc:name'];
    if ((this.#ui.split || config.first) && !config.first) return ['people', 'an.set.errFirst', 'pc:first'];
    if (config.hierarchy) {
      const todo = config.levels.findIndex(level => !level.path.length);
      if (!config.levels.length) return ['hier', 'an.set.errNoLevel', 'level-add'];
      if (todo >= 0) return ['hier', 'an.set.errLevel', `lp:${todo}`];
    }
    const lacking = config.relations.findIndex(rel => !rel.col);
    return lacking >= 0 ? ['relations', 'an.set.errRelation', `rp:${lacking}`] : null;
  }

  // Ce qui empêche d'enregistrer, dit dans le pied ; l'onglet concerné s'ouvre et le repère se montre. Rend true quand tout va.
  #valid() {
    const found = this.#problem();
    if (!found) { this.#say(''); return true; }
    if (this.#ui.tab !== found[0]) { this.#ui.tab = found[0]; this.#paint(false); }
    this.#say(this.#o.t(found[1]));
    this.#focus(found[2]);
    const target = [...this.#refs.body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === found[2]);
    if (target) target.setAttribute('aria-invalid', 'true'); // le repère se montre jusqu'au prochain dessin
    return false;
  }

  // Le pied dit ce qui manque ; tout nouveau dessin l'efface (il le redira à l'enregistrement).
  #say(text) {
    this.#refs.note.textContent = text;
    this.#refs.note.classList.toggle('is-warn', Boolean(text));
  }

  // Une liste avec recherche : le choix, ou null.
  #list(opts) {
    return pickFrom({ container: this.#o.container, inertTargets: this.#o.inertTargets, t: this.#o.t, ...opts });
  }

  // Un onglet a de quoi avertir : « Hiérarchie » quand l'option est allumée et qu'il manque un niveau ou une colonne, « Relations » quand une relation n'a pas
  // sa colonne.
  #needsAttention(id) {
    const { config } = this.#draft;
    if (id === 'relations') return config.relations.some(rel => !rel.col);
    return id === 'hier' && config.hierarchy && (!config.levels.length || config.levels.some(level => !level.path.length));
  }

  // Redessine l'onglet en gardant le clavier là où il était et le défilement (un autre onglet repart du haut).
  #paint(keepScroll = true) {
    const { tabs, body } = this.#refs;
    const doc = body.ownerDocument;
    const kept = doc.activeElement && (body.contains(doc.activeElement) || tabs.contains(doc.activeElement)) ? doc.activeElement.dataset.fk : null;
    const top = keepScroll ? body.scrollTop : 0;
    const t = this.#o.t;
    this.#say('');
    tabs.replaceChildren(...TABS.map(([id, key]) => h('button', { type: 'button', role: 'tab', class: 'an-tab', 'aria-selected': String(this.#ui.tab === id),
      tabindex: this.#ui.tab === id ? '0' : '-1', 'aria-controls': 'an-set-panel', id: `an-tab-${id}`, dataset: { act: 'tab', tab: id, fk: `tab:${id}` } },
        t(key),
      this.#needsAttention(id) ? h('span', { class: 'an-tab-dot', title: t('an.tab.todo'), role: 'img', 'aria-label': t('an.tab.todo') }) :
        null)));
    const [, , make] = TABS.find(([id]) => id === this.#ui.tab);
    const panel = make(this.#host);
    panel.setAttribute('role', 'tabpanel');
    panel.id = 'an-set-panel';
    panel.setAttribute('aria-labelledby', `an-tab-${this.#ui.tab}`);
    body.replaceChildren(panel);
    body.scrollTop = top;
    const again = kept && [...this.#refs.tabs.querySelectorAll('[data-fk]'), ...body.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
  }

  #tabKeys(event) {
    const ids = TABS.map(([id]) => id);
    const at = ids.indexOf(this.#ui.tab);
    const to = { ArrowRight: (at + 1) % ids.length, ArrowLeft: (at + ids.length - 1) % ids.length, Home: 0, End: ids.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    this.#select(ids[to]);
  }

  #select(id) {
    if (this.#ui.tab === id) return;
    this.#ui.tab = id;
    this.#paint(false);
    this.#focus(`tab:${id}`);
    this.#schedule();
  }

  // ---------- les gestes ----------

  #input(event) {
    const input = event.target.closest('[data-input]');
    if (!input) return;
    if (input.dataset.input === 'name') this.#draft.name = input.value;
    else if (input.dataset.input === 'level') levelInput(this.#host, input);
    else relationInput(this.#host, input);
  }

  #click(event) {
    const button = event.target.closest('[data-act]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    const { act } = button.dataset;
    if (act === 'tab') { this.#select(button.dataset.tab); return; }
    const host = this.#host;
    [peopleAct, hierarchyAct, relationsAct, fieldsAct, optionsAct].some(run => run(host, act, button.dataset));
  }

  // ---------- l'aperçu ----------

  // L'aperçu de l'arbre se relit un instant après le dernier choix (la lecture est celle de la fenêtre, avec ce qui est déjà choisi).
  #schedule() {
    clearTimeout(this.#timer);
    if (this.#ui.tab !== 'hier' || !this.#o.read) return;
    this.#timer = setTimeout(() => void this.#load(), PREVIEW_DELAY);
  }

  async #load() {
    const { name, table, config } = this.#draft;
    const usable = Boolean(table) && config.hierarchy && config.levels.some(level => level.path.length);
    if (!usable) { this.#set({ state: 'idle', tree: null, counts: null }); return; }
    const stamp = ++this.#stamp;
    if (this.#preview.state !== 'ready') this.#set({ state: 'loading', tree: null, counts: null });
    try {
      const data = await this.#o.read({ name: name.trim() || this.#o.t('an.title'), table, config }, this.#cache);
      if (stamp !== this.#stamp) return;
      const counts = config.levels.map((_, i) => new Set(data.people.map(person => person.levels[i]).filter(Boolean)).size);
      this.#set({ state: 'ready', tree: data.tree, counts });
    } catch (error) {
      if (stamp === this.#stamp) this.#set({ state: 'error', tree: null, counts: null });
    }
  }

  #set(preview) {
    Object.assign(this.#preview, preview);
    if (this.#ui.tab === 'hier') paintPreview(this.#host);
  }
}
