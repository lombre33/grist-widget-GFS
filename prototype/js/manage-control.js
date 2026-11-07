// Ce que le contrôleur fait de « Gérer les partages » (contrats 11.7, point 13, i) : lit les groupes, les partages de tout le document (la racine `*`), la structure et les tables lisibles pour un groupe lu d'une table,
// ouvre la fenêtre (js/manage-window.js) et écrit. Un geste de propriétaire : les autres lisent à qui le demander. Une écriture se fait en UNE `applyUserActions`.

import { rowsOf } from './rights.js';
import { actionsOf } from './rights-plan.js';
import { runAction } from './rights-actions.js';
import { ask } from './ask-window.js';
import { openManage } from './manage-window.js';
import { pickFrom } from './pick-window.js';
import { CATEGORIES, GROUPS_TABLE, ROOT, SHARES_TABLE, groupRecord, groupsOf, isIdent, planGroupAdd, planGroupsRead, shareRecord } from './sharing-model.js';

const GROUP_TYPES = ['Text', 'Choice'];
const EMAIL_TYPES = ['Text', 'Choice', 'Any'];

export class ManageControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), fullAccess(), writeBlock() }
  constructor(opts) { this.#o = opts; }

  // Pourquoi « Gérer les partages » est grisé (une phrase), ou null.
  whyNot() { return this.#o.fullAccess() ? null : this.#o.t('share.noAccess'); }

  async #rows(table) {
    try { return rowsOf(await this.#o.port.doc.fetchTable(table)); } catch (error) { return null; }
  }

  // Les tables du document que GFS peut lire pour un groupe : leurs colonnes de texte, jamais les tables internes ni celles de GFS.
  #readable(raw) {
    const tables = (raw.tables || []).filter(row => isIdent(row.tableId) && !row.tableId.startsWith('_grist_') && !row.tableId.startsWith('GFS_'));
    return tables.map(table => {
      const columns = (raw.columns || []).filter(col => col.parentId === table.id && isIdent(col.colId) && !col.colId.startsWith('gristHelper_'));
      return { id: table.tableId, emails: columns.filter(col => EMAIL_TYPES.includes(col.type)).map(col => col.colId), groups: columns.filter(col => GROUP_TYPES.includes(col.type)).map(col => col.colId) };
    }).filter(table => table.emails.some(email => table.groups.some(group => group !== email)));
  }

  async load() {
    const owner = await this.#o.reader.owner();
    if (owner !== true) return { owner, active: false, groups: [], root: {}, structure: null, tables: [] };
    const [shares, groupRows, plans, raw] = await Promise.all([this.#rows(SHARES_TABLE), this.#rows(GROUPS_TABLE), this.#o.writer.plans(), this.#o.reader.raw()]);
    const rootRows = (shares || []).filter(row => row.Cible === ROOT);
    const root = Object.fromEntries(Object.values(CATEGORIES).map(who => { const row = rootRows.find(item => String(item.Personne) === who); return [who, row ? { id: row.id, right: row.Droit } : null]; }));
    return {
      owner, active: shares !== null && groupRows !== null, groups: groupsOf(groupRows || []), rows: groupRows || [], root, tables: raw ? this.#readable(raw) : [],
      structure: plans ? actionsOf(plans)[1] : null, blocked: this.#o.writeBlock(),
    };
  }

  async #write(actions) {
    const blocked = this.#o.writeBlock();
    if (blocked) return { ok: false, message: blocked };
    try { await this.#o.port.doc.applyUserActions(actions); return { ok: true }; } catch (error) { return { ok: false, message: String((error && error.message) || error).slice(0, 300) }; }
  }

  addGroup(state, { name, people }) {
    const plan = planGroupAdd(state.rows, groupRecord({ name, people }));
    return plan.ok ? this.#write(plan.actions) : Promise.resolve({ ok: false, message: this.#o.t(`manage.groups.${plan.reason}`) });
  }

  updateGroup(id, people) { return this.#write([['UpdateRecord', GROUPS_TABLE, id, { PersonnesIci: String(people || '').trim() }]]); }
  removeGroup(id) { return this.#write([['RemoveRecord', GROUPS_TABLE, id]]); }

  // Un droit sur tous les fichiers pour une catégorie (la racine `*`) ; `right` null : le retirer.
  setRoot(state, who, right) {
    const current = state.root[who];
    if (!right) return current ? this.#write([['RemoveRecord', SHARES_TABLE, current.id]]) : Promise.resolve({ ok: true });
    if (current) return this.#write([['UpdateRecord', SHARES_TABLE, current.id, { Droit: right }]]);
    return this.#write([['AddRecord', SHARES_TABLE, null, shareRecord({ target: ROOT, who, right })]]);
  }

  // La structure : fermer ou rouvrir, avec la question qui dit le prix ; la page se recharge, la fenêtre se rouvre (clé `manage`).
  async structure() {
    const { t, container } = this.#o;
    const kind = actionsOf(await this.#o.writer.plans())[1].kind;
    return kind ? runAction({ kind, plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets: this.#o.inertTargets, ...options }), writer: this.#o.writer, resume: 'manage' }) : false;
  }

  // Lire les groupes d'une table : la table, la colonne des adresses, la colonne des groupes (trois listes avec recherche), puis les groupes que la table nomme. Rend { ok, message? } ou null si la personne renonce.
  async readTable(state) {
    const { t, container } = this.#o;
    const base = { container, inertTargets: this.#o.inertTargets, t };
    const table = await pickFrom({ ...base, title: t('manage.read.table'), text: t('manage.read.tableText'), items: state.tables.map(item => ({ value: item.id, label: item.id, glyph: 'table' })), none: t('pick.none') });
    if (!table) return null;
    const found = state.tables.find(item => item.id === table);
    const email = await pickFrom({ ...base, title: t('manage.read.email', { table }), items: found.emails.map(id => ({ value: id, label: id, glyph: 'mail' })) });
    if (!email) return null;
    const group = await pickFrom({ ...base, title: t('manage.read.group', { table }), items: found.groups.filter(id => id !== email).map(id => ({ value: id, label: id, glyph: 'users' })), none: t('pick.none') });
    if (!group) return null;
    const rows = await this.#rows(table);
    if (!rows) return { ok: false, message: t('manage.read.unreadable', { table }) };
    const plan = planGroupsRead(state.rows, { table, email, group }, rows.map(row => row[group]));
    if (!plan.ok) return { ok: false, message: t(`manage.read.${plan.reason}`) };
    if (!(await ask({ container, inertTargets: this.#o.inertTargets, title: t('manage.read.ask.title'), message: t('manage.read.ask.message', { n: plan.added, table, group, email }), confirmLabel: t('manage.read.ask.confirm'), cancelLabel: t('rights.ask.cancel'), safeFirst: true }))) return null;
    return this.#write(plan.actions);
  }

  open() {
    const { t, container, inertTargets } = this.#o;
    return openManage({
      container, t, inertTargets, load: () => this.load(), onAddGroup: (state, group) => this.addGroup(state, group), onUpdateGroup: (id, people) => this.updateGroup(id, people), onRemoveGroup: id => this.removeGroup(id),
      onReadTable: state => this.readTable(state), onRoot: (state, who, right) => this.setRoot(state, who, right), onStructure: () => this.structure(),
      onConfirmRemove: name => ask({ container, inertTargets, title: t('manage.groups.remove.title', { name }), message: t('manage.groups.remove.message'), confirmLabel: t('manage.groups.remove.confirm'), cancelLabel: t('rights.ask.cancel'), safeFirst: true }),
    });
  }
}
