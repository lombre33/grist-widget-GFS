// Ce que le contrôleur fait de « Gérer les partages » (contrats 11.7, point 13, i) : lit les groupes, les partages de tout le document (la racine `*`), la structure et les tables lisibles pour un groupe lu d'une table,
// ouvre la fenêtre (js/manage-window.js) et écrit. Un geste de propriétaire : les autres lisent à qui le demander. Une écriture se fait en UNE `applyUserActions`.

import { rowsOf } from './rights.js';
import { actionsOf } from './rights-plan.js';
import { runAction, writeActions } from './rights-actions.js';
import { ask } from './ask-window.js';
import { openManage } from './manage-window.js';
import { pickFrom } from './pick-window.js';
import { CATEGORIES, GROUPS_TABLE, PLACE_TABLE, ROOT, SHARES_TABLE, SPACES_TABLE, groupRecord, groupsOf, isIdent, planGroupAdd, planGroupsRead, planSpaceAdd, planSpaceGroup, planSpaceRemove, shareRecord, spacesOf } from './sharing-model.js';
import { askName } from './filing-window.js';

const GROUP_TYPES = ['Text', 'Choice'];
const EMAIL_TYPES = ['Text', 'Choice', 'Any'];

export class ManageControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), fullAccess(), writeBlock(), otherLinks() → les documents reliés (js/share-other.js), otherStop(lien) → { ok, message? }, otherNew() (relier un document sans fichier), ask?(options) (la question ; par défaut la fenêtre du widget, js/ask-window.js) }
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
    if (owner !== true) return { owner, active: false, groups: [], spaces: [], root: {}, structure: null, tables: [] };
    const [shares, groupRows, plans, raw, spaceRows, placeRows] = await Promise.all([this.#rows(SHARES_TABLE), this.#rows(GROUPS_TABLE), this.#o.writer.plans(), this.#o.reader.raw(), this.#rows(SPACES_TABLE), this.#rows(PLACE_TABLE)]);
    const rootRows = (shares || []).filter(row => row.Cible === ROOT);
    const root = Object.fromEntries(Object.values(CATEGORIES).map(who => { const row = rootRows.find(item => String(item.Personne) === who); return [who, row ? { id: row.id, right: row.Droit } : null]; }));
    return {
      owner, active: shares !== null && groupRows !== null && spaceRows !== null, groups: groupsOf(groupRows || []), rows: groupRows || [], root, tables: raw ? this.#readable(raw) : [],
      spaces: spacesOf(spaceRows || [], shares || []), spaceRows: spaceRows || [], shareRows: shares || [], placeRows: placeRows || [],
      structure: plans ? actionsOf(plans)[1] : null, blocked: this.#o.writeBlock(),
    };
  }

  #write(actions) { return writeActions(this.#o, actions); }

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

  // Les espaces : créer (le nom se demande dans une fenêtre du widget), supprimer (avec la question), donner un rôle à un groupe, choisir le groupe à ajouter.
  async addSpace(state) {
    const { t, container } = this.#o;
    const name = await askName({ container, inertTargets: this.#o.inertTargets, t, title: t('manage.spaces.new'), label: t('manage.spaces.name'), value: '', confirmLabel: t('manage.spaces.create'),
      refuse: text => (text ? (state.spaceRows.some(row => String(row.Nom || '').trim().toLowerCase() === text.toLowerCase()) ? t('manage.spaces.exists') : null) : t('manage.spaces.invalid')), clean: text => text.replace(/\s+/g, ' ').trim() });
    if (!name) return null;
    const plan = planSpaceAdd(state.spaceRows, name);
    return plan.ok ? this.#write(plan.actions) : { ok: false, message: t(`manage.spaces.${plan.reason}`) };
  }

  async removeSpace(state, space) {
    const { t, container } = this.#o;
    if (!(await ask({ container, inertTargets: this.#o.inertTargets, title: t('manage.spaces.remove.title', { name: space.name }), message: t('manage.spaces.remove.message'), confirmLabel: t('manage.spaces.remove.confirm'), cancelLabel: t('rights.ask.cancel'), safeFirst: true }))) return null;
    const plan = planSpaceRemove(space, state.shareRows, state.placeRows);
    return plan.ok ? this.#write(plan.actions) : { ok: false, message: t('manage.spaces.invalid') };
  }

  setSpaceGroup(state, space, group, right) {
    const plan = planSpaceGroup(space, state.shareRows, group, right);
    return plan.ok ? (plan.actions.length ? this.#write(plan.actions) : Promise.resolve({ ok: true })) : Promise.resolve({ ok: false, message: this.#o.t('manage.spaces.invalid') });
  }

  pickGroup(state, space) {
    const { t, container } = this.#o;
    const taken = new Set(space.groups.map(item => item.group.toLowerCase()));
    return pickFrom({ container, inertTargets: this.#o.inertTargets, t, title: t('manage.spaces.pick'), text: t('manage.spaces.pickText', { name: space.name }), none: t('pick.none'),
      items: state.groups.filter(group => !taken.has(group.name.toLowerCase())).map(group => ({ value: group.name, label: group.name, glyph: 'users' })) });
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

  // « Autres documents » : arrêter un lien, ou annuler une invitation qui attend sa réponse, après la question. Rend { ok, message? } ou null si la personne renonce.
  async stopLink(link) {
    const { t, container, inertTargets } = this.#o;
    const kind = link.state === 'pending' ? 'cancel' : 'stop';
    const yes = await (this.#o.ask || ask)({ container, inertTargets, title: t(`manage.other.${kind}.title`, { name: link.doc.name || link.name }), message: t(`manage.other.${kind}.message`), confirmLabel: t(`manage.other.${kind}.confirm`), cancelLabel: t('rights.ask.cancel'), safeFirst: true });
    return yes ? this.#o.otherStop(link) : null;
  }

  open() {
    const { t, container, inertTargets } = this.#o;
    return openManage({
      onLinks: () => (this.#o.otherLinks ? this.#o.otherLinks() : []), onStopLink: link => this.stopLink(link), onNewLink: () => (this.#o.otherNew ? this.#o.otherNew() : null),
      container, t, inertTargets, load: () => this.load(), onAddGroup: (state, group) => this.addGroup(state, group), onUpdateGroup: (id, people) => this.updateGroup(id, people), onRemoveGroup: id => this.removeGroup(id),
      onReadTable: state => this.readTable(state), onAddSpace: state => this.addSpace(state), onRemoveSpace: (state, space) => this.removeSpace(state, space), onSpaceGroup: (state, space, group, right) => this.setSpaceGroup(state, space, group, right), onPickGroup: (state, space) => this.pickGroup(state, space), onRoot: (state, who, right) => this.setRoot(state, who, right), onStructure: () => this.structure(),
      onConfirmRemove: name => ask({ container, inertTargets, title: t('manage.groups.remove.title', { name }), message: t('manage.groups.remove.message'), confirmLabel: t('manage.groups.remove.confirm'), cancelLabel: t('rights.ask.cancel'), safeFirst: true }),
    });
  }
}
