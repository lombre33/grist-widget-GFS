// Ce que le contrôleur fait de « Partager » (contrats 11.7, point 13) : lit la table des partages, dit si le fichier se partage, ouvre la fenêtre
// (js/share-window.js), écrit les lignes de partage et active le partage (un geste de propriétaire, avec la question qui dit le prix : js/rights-actions.js).
// Le premier lot couvre les PDF que GFS garde ; les fichiers d'une app attendent leurs colonnes d'aide.

import { rowsOf } from './rights.js';
import { FILES_TABLE } from './gfs-files.js';
import { GROUPS_TABLE, PLACE_TABLE, SHARES_TABLE, SPACES_TABLE, STAMP, TARGETS, folderTarget, groupsOf, sharesOf, spaceTarget } from './sharing-model.js';
import { openShare } from './share-window.js';
import { runAction, writeActions } from './rights-actions.js';
import { ask } from './ask-window.js';
import { locate } from './spaces-filing.js';

const lower = text => String(text ?? '').trim().toLowerCase();

// L'état d'un fichier dont le partage n'est pas (encore) actif : `extend` dit ce qui manque (false : la table des partages ; true : les colonnes d'aide ;
// 'upgrade' : celles d'avant les espaces).
const noShare = (owner, extend) => ({ active: false, extend, owner, shares: [], people: [], me: '', author: '', canManage: false });

// L'espace, puis chaque dossier du chemin : ce qu'un fichier ou un dossier hérite (`parts` : les noms de dossier, du haut vers le bas).
const originsOf = (spaceKey, name, parts) => [{ kind: 'space', name, target: spaceTarget(spaceKey) },
  ...parts.map((part, at) => ({ kind: 'folder', name: part, target: folderTarget(spaceKey, parts.slice(0, at + 1).join('/')) }))];

// Les personnes que GFS connaît déjà : celles des lignes de partage, sans les catégories (« @ ») ni les groupes (« # »), en minuscules, sans doublon, triées.
const peopleOf = rows => [...new Set(rows.map(row => lower(row.PersonneL || row.Personne)).filter(who => who && !who.startsWith('@') &&
  !who.startsWith('#')))].sort();

export class ShareControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), identity() → l'adresse de la personne ou '', fullAccess(), writeBlock() → la raison
  //   d'un blocage ou null, appName(id), other(file, state) → l'onglet « Dans un autre document Grist » (js/share-other.js) ou null }
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

  // Pourquoi ce dossier ne se partage pas (une phrase), ou null : seuls les dossiers à l'intérieur d'un espace se partagent ; « Moi » n'a pas de droits à
  // donner, et un espace donne ses droits à des groupes dans « Gérer les partages… ».
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
    return { key: folderTarget(at.space.key, at.folder), name: at.folder.split('/').pop(), shared: { space: at.space, path: at.folder } };
  }

  // L'espace, puis les dossiers au-dessus de celui-ci : ce qu'il hérite (la fenêtre les marque « Hérité »).
  #folderOrigins({ space, path }) {
    return originsOf(space.key, space.name, path.split('/').filter(Boolean).slice(0, -1));
  }

  // L'état que la fenêtre dessine : la table des partages (absente : le partage n'est pas activé), la preuve de propriété, ce que la personne peut changer.
  async load(file) {
    const owner = await this.#o.reader.owner();
    const rows = await this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(SHARES_TABLE)), null);
    if (!rows) return noShare(owner, false);
    const target = file.shared ? null : this.#target(file);
    const read = target ? await this.#authorOf(file, target) : { author: lower(file.by) };
    if (read.extend !== undefined) return noShare(owner, read.extend);
    const { author } = read;
    const me = lower(this.#o.identity());
    const shares = sharesOf(rows, file.key, file.shared ? this.#folderOrigins(file.shared) : await this.#inherited(file.key));
    const admin = shares.some(share => share.valid && share.active && share.right === 'admin' && lower(share.who) === me);
    const groups = await this.#try(async () => groupsOf(rowsOf(await this.#o.port.doc.fetchTable(GROUPS_TABLE))), []);
    return { active: true, owner, shares, people: peopleOf(rows), groups, me, author, canManage: !this.#o.writeBlock() &&
      (owner === true || (me !== '' && me === author) || admin) };
  }

  // Une lecture qui peut échouer (table absente, accès refusé) : `fallback` à la place.
  async #try(read, fallback) {
    try { return await read(); } catch (error) { return fallback; }
  }

  // L'auteur d'un fichier (d'une app ou un PDF), ou `{ extend }` quand sa table n'est pas prête au partage. La table de fichiers porte-t-elle les colonnes
  // d'aide ? Sinon le partage n'y est pas étendu (une app ajoutée après coup) ; si elle porte celles d'avant les espaces (pas `GFS_Directs`), le partage est à
  // compléter ; l'auteur est la colonne que Grist écrit.
  async #authorOf(file, target) {
    const table = await this.#try(() => this.#o.port.doc.fetchTable(target.table), null);
    const has = name => Boolean(table) && Object.prototype.hasOwnProperty.call(table, name);
    if (target.stamped && !has('GFS_Lecteurs')) return { extend: true };
    if (has('GFS_Lecteurs') && !has('GFS_Directs')) return { extend: 'upgrade' };
    // un partage d'avant l'auteur protégé des PDF : « compléter » reprend l'auteur de la colonne « Auteur »
    if (target.stamped && has('GFS_Lecteurs') && !has(STAMP)) return { extend: 'upgrade' };
    return { author: target.stamped ? lower((table[STAMP] || [])[(table.id || []).indexOf(file.row)]) : lower(file.by) };
  }

  // Ce que le fichier hérite de l'espace où il est placé : l'espace, puis chaque dossier du chemin (rien si le fichier n'est dans aucun espace, ou si la
  // personne ne lit pas le placement).
  async #inherited(key) {
    const place = await this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(PLACE_TABLE)).find(row => row.Cible === key), null);
    if (!place || !place.Espace) return [];
    const spaces = await this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(SPACES_TABLE)), []);
    const name = (spaces.find(row => row.Cle === place.Espace) || {}).Nom || place.Espace;
    return originsOf(place.Espace, name, String(place.Dossier || '').split('/').filter(Boolean));
  }

  #write(actions) { return writeActions(this.#o, actions); }

  // Ouvre la fenêtre du fichier ; rend la promesse de sa fermeture.
  open(file) {
    const { t, container, inertTargets } = this.#o;
    return openShare({
      container, t, locale: this.#o.locale(), inertTargets, other: state => this.#o.other(file, state),
        file: { key: file.key, name: file.name, app: file.shared ? t('share.folder.in', { name: file.shared.space.name }) : this.#o.appName(file.app) },
      load: () => this.load(file), onManage: () => this.#o.manage.open(),
      onAdd: record => this.#write([['AddRecord', SHARES_TABLE, null, record]]),
      onChange: (id, patch) => this.#write([['UpdateRecord', SHARES_TABLE, id, patch]]),
      onRemove: id => this.#write([['RemoveRecord', SHARES_TABLE, id]]),
      onActivate: async () => runAction({ kind: 'sharing', plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets, ...options }),
        writer: this.#o.writer, resume: `share:${file.key}` }),
    });
  }
}
