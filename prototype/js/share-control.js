// Ce que le contrôleur fait de « Partager » (contrats 11.7, point 13) : lit la table des partages, dit si le fichier se partage, ouvre la fenêtre (js/share-window.js), écrit les lignes de partage et active
// le partage (un geste de propriétaire, avec la question qui dit le prix : js/rights-actions.js). Le premier lot couvre les PDF que GFS garde ; les fichiers d'une app attendent leurs colonnes d'aide.

import { rowsOf } from './rights.js';
import { FILES_TABLE } from './gfs-files.js';
import { GROUPS_TABLE, PLACE_TABLE, SHARES_TABLE, SPACES_TABLE, STAMP, TARGETS, folderTarget, groupsOf, sharesOf, spaceTarget } from './sharing-model.js';
import { openShare } from './share-window.js';
import { runAction } from './rights-actions.js';
import { ask } from './ask-window.js';
import { locate } from './spaces-filing.js';

const lower = text => String(text ?? '').trim().toLowerCase();

export class ShareControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), identity() → l'adresse de la personne ou '', fullAccess(), writeBlock() → la raison d'un blocage ou null, appName(id), extraTargets() }
  constructor(opts) { this.#o = opts; }

  // La table de fichiers que le partage couvre pour ce fichier (un PDF de GFS, ou le fichier d'une app qui déclare sa table), ou null.
  #target(file) {
    const targets = this.#o.targets ? this.#o.targets() : TARGETS;
    return file ? targets.find(item => item.prefix === `${file.app}:` && item.table === (file.table || FILES_TABLE)) || null : null;
  }

  // Pourquoi ce fichier ne se partage pas (une phrase), ou null quand il se partage.
  whyNot(file) {
    if (!this.#o.fullAccess()) return this.#o.t('share.noAccess');
    return this.#target(file) ? null : this.#o.t('share.unsupported');
  }

  // Pourquoi ce dossier ne se partage pas (une phrase), ou null : seuls les dossiers à l'intérieur d'un espace se partagent ; « Moi » n'a pas de droits à donner, et un espace donne ses droits à des groupes dans « Gérer les partages… ».
  whyNotFolder(path) {
    const { t } = this.#o;
    if (!this.#o.fullAccess()) return t('share.noAccess');
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    if (!at) return path === '' || path.split('/')[0] !== 'Espaces' ? t('share.folder.personal') : t('share.folder.space');
    return at.folder ? null : t('share.folder.space');
  }

  // Le dossier d'espace `path` ("Espaces/<espace>/<dossier>") comme la fenêtre le prend : une clé (`dossier:<clé>/<chemin>`), un nom, et d'où il hérite.
  folderFile(path) {
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    if (!at || !at.folder) return null;
    return { key: folderTarget(at.space.key, at.folder), name: at.folder.split('/').pop(), folder: { space: at.space, path: at.folder } };
  }

  // L'espace, puis les dossiers au-dessus de celui-ci : ce qu'il hérite (la fenêtre les marque « Hérité »).
  #folderOrigins({ space, path }) {
    const parts = path.split('/').filter(Boolean).slice(0, -1);
    return [{ kind: 'space', name: space.name, target: spaceTarget(space.key) }, ...parts.map((part, at) => ({ kind: 'folder', name: part, target: folderTarget(space.key, parts.slice(0, at + 1).join('/')) }))];
  }

  // L'état que la fenêtre dessine : la table des partages (absente : le partage n'est pas activé), la preuve de propriété, ce que la personne peut changer.
  async load(file) {
    const owner = await this.#o.reader.owner();
    let rows = null;
    try { rows = rowsOf(await this.#o.port.doc.fetchTable(SHARES_TABLE)); } catch (error) { rows = null; }
    const none = extend => ({ active: false, extend, owner, shares: [], people: [], me: '', author: '', canManage: false });
    if (!rows) return none(false);
    const target = file.folder ? null : this.#target(file);
    let author = lower(file.by);
    if (target) {
      // La table de fichiers porte-t-elle les colonnes d'aide ? Sinon le partage n'y est pas étendu (une app ajoutée après coup) ; si elle porte celles d'avant les espaces (pas `GFS_Calc`), le partage est à compléter ;
      // l'auteur d'un fichier d'app est la colonne que Grist écrit.
      let table = null;
      try { table = await this.#o.port.doc.fetchTable(target.table); } catch (error) { table = null; }
      const has = name => Boolean(table) && Object.prototype.hasOwnProperty.call(table, name);
      if (target.stamped && !has('GFS_Lecteurs')) return none(true);
      if (has('GFS_Lecteurs') && !has('GFS_Calc')) return none('upgrade');
      if (target.stamped) author = lower((table[STAMP] || [])[(table.id || []).indexOf(file.row)]);
    }
    const me = lower(this.#o.identity());
    const shares = sharesOf(rows, file.key, file.folder ? this.#folderOrigins(file.folder) : await this.#inherited(file.key));
    const admin = shares.some(share => share.valid && share.active && share.right === 'admin' && lower(share.who) === me);
    const people = [...new Set(rows.map(row => lower(row.PersonneL || row.Personne)).filter(who => who && !who.startsWith('@') && !who.startsWith('#')))].sort();
    let groups = [];
    try { groups = groupsOf(rowsOf(await this.#o.port.doc.fetchTable(GROUPS_TABLE))); } catch (error) { groups = []; }
    return { active: true, owner, shares, people, groups, me, author, canManage: !this.#o.writeBlock() && (owner === true || (me !== '' && me === author) || admin) };
  }

  // Ce que le fichier hérite de l'espace où il est placé : l'espace, puis chaque dossier du chemin (rien si le fichier n'est dans aucun espace, ou si la personne ne lit pas le placement).
  async #inherited(key) {
    let place = null; let spaces = [];
    try { place = rowsOf(await this.#o.port.doc.fetchTable(PLACE_TABLE)).find(row => row.Cible === key); } catch (error) { place = null; }
    if (!place || !place.Espace) return [];
    try { spaces = rowsOf(await this.#o.port.doc.fetchTable(SPACES_TABLE)); } catch (error) { spaces = []; }
    const name = (spaces.find(row => row.Cle === place.Espace) || {}).Nom || place.Espace;
    const parts = String(place.Dossier || '').split('/').filter(Boolean);
    return [{ kind: 'space', name, target: spaceTarget(place.Espace) }, ...parts.map((part, at) => ({ kind: 'folder', name: part, target: folderTarget(place.Espace, parts.slice(0, at + 1).join('/')) }))];
  }

  async #write(actions) {
    const blocked = this.#o.writeBlock();
    if (blocked) return { ok: false, message: blocked };
    try { await this.#o.port.doc.applyUserActions(actions); return { ok: true }; } catch (error) { return { ok: false, message: String((error && error.message) || error).slice(0, 300) }; }
  }

  // Ouvre la fenêtre du fichier ; rend la promesse de sa fermeture.
  open(file) {
    const { t, container, inertTargets } = this.#o;
    return openShare({
      container, t, locale: this.#o.locale(), inertTargets, extraTargets: this.#o.extraTargets(), file: { key: file.key, name: file.name, app: file.folder ? t('share.folder.in', { name: file.folder.space.name }) : this.#o.appName(file.app) },
      load: () => this.load(file), onManage: () => this.#o.manage.open(),
      onAdd: record => this.#write([['AddRecord', SHARES_TABLE, null, record]]),
      onChange: (id, patch) => this.#write([['UpdateRecord', SHARES_TABLE, id, patch]]),
      onRemove: id => this.#write([['RemoveRecord', SHARES_TABLE, id]]),
      onActivate: async () => runAction({ kind: 'sharing', plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets, ...options }), writer: this.#o.writer, resume: `share:${file.key}` }),
    });
  }
}
