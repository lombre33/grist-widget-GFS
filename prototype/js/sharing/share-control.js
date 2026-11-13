// Ce que le contrôleur fait de « Partager » (contrats 11.7, point 13) : lit la table des partages, dit si le fichier se partage, ouvre la fenêtre
// (js/sharing/share-window.js), écrit les lignes de partage et active le partage (un geste de propriétaire, avec la question qui dit le prix :
// js/rights/rights-actions.js). Le premier lot couvre les PDF que GFS garde ; les fichiers d'une app attendent leurs colonnes d'aide.

import { rowsOf } from '../rights/rights.js';
import { FILES_TABLE } from '../files/gfs-files.js';
import { GROUPS_TABLE, PLACE_TABLE, ROOT, SHARES_TABLE, SPACES_TABLE, STAMP, TARGETS, folderTarget, groupsOf, personalTarget, sharesOf,
  spaceTarget } from './sharing-model.js';
import { listOf } from './direct-shares.js';
import { openShare } from './share-window.js';
import { runAction, writeActions } from '../rights/rights-actions.js';
import { ask } from '../ui/ask-window.js';
import { locate } from './spaces-filing.js';

const lower = text => String(text ?? '').trim().toLowerCase();

// L'état d'un fichier dont le partage n'est pas (encore) actif : `extend` dit ce qui manque (false : la table des partages ; true : les colonnes d'aide ;
// 'upgrade' : celles d'avant les espaces).
const noShare = (owner, extend) => ({ active: false, extend, owner, shares: [], people: [], me: '', author: '', canManage: false });

// L'espace, puis chaque dossier du chemin : ce qu'un fichier ou un dossier hérite (`parts` : les noms de dossier, du haut vers le bas).
const originsOf = (spaceKey, name, parts) => [{ kind: 'space', name, target: spaceTarget(spaceKey) },
  ...parts.map((part, at) => ({ kind: 'folder', name: part, target: folderTarget(spaceKey, parts.slice(0, at + 1).join('/')) }))];

// Les personnes que GFS connaît déjà : celles des lignes de partage, sans les catégories (« @ ») ni les groupes (« # »), en minuscules, sans doublon, triées.
// Les dossiers au-dessus d'un fichier ou d'un dossier de « Moi » (`parts` : les noms, du haut vers le bas) : ce qu'il hérite des droits donnés à ces dossiers.
const mineOrigins = (identity, parts) => parts.map((part, at) => ({ kind: 'folder', name: part,
  target: personalTarget(identity, parts.slice(0, at + 1).join('/')) }));
const partsOf = path => String(path || '').split('/').filter(Boolean);

// Ce qu'un fichier hérite en plus de ce que son placement dit (`placed`) : hors d'un espace, les dossiers que son auteur lui a donnés dans « Moi » (ceux de
// la personne qui regarde, quand elle en est l'auteur) ; un dossier garde ses propres origines.
function inheritedFor(file, placed, me, author) {
  if (file.mine || file.shared || placed.length || !file.folder || me === '' || me !== author) return placed;
  return String(file.folder).split('/')[0] === 'Espaces' ? placed : mineOrigins(me, partsOf(file.folder));
}

// La personne administre-t-elle la cible ? Une ligne `admin` à son adresse, ou à un groupe dont elle est membre (Grist l'a calculé : `AdminsCible` dit qui
// administre la cible, la racine comprise).
function administers({ me, key, rows, shares }) {
  if (me === '') return false;
  return shares.some(share => share.valid && share.active && share.right === 'admin' && lower(share.who) === me) ||
    rows.some(row => (row.Cible === key || row.Cible === ROOT) && listOf(row.AdminsCible).map(lower).includes(me));
}

const peopleOf = rows => [...new Set(rows.map(row => lower(row.PersonneL || row.Personne)).filter(who => who && !who.startsWith('@') &&
  !who.startsWith('#')))].sort();

export class ShareControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), identity() → l'adresse de la personne ou '', fullAccess(), writeBlock() → la raison
  //   d'un blocage ou null, appName(id), other(file, state) → l'onglet « Dans un autre document Grist » (js/sharing/share-other.js) ou null }
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

  // Pourquoi ce dossier ne se partage pas du tout (une phrase), ou null : la racine, « Espaces » et un espace entier n'ont rien à envoyer ou se règlent
  // ailleurs. Un dossier de « Moi » se partage dans ce document (ses fichiers, et ceux qu'on y rangera, choix du porteur, 13/11) : sa cible porte l'adresse de
  // la personne, que GFS doit donc connaître.
  whyNotFolder(path) {
    const { t } = this.#o;
    if (!this.#o.fullAccess()) return t('share.noAccess');
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    if (at) return at.folder ? null : t('share.folder.space');
    if (path === '') return t('share.folder.personal');
    if (path.split('/')[0] === 'Espaces') return t('share.folder.space');
    return lower(this.#o.identity()) ? null : t('share.folder.noAddress');
  }

  // Le dossier `path` comme la fenêtre le prend : un dossier d'espace ("Espaces/<espace>/<dossier>") a une clé (`dossier:<clé>/<chemin>`), un nom et d'où il
  // hérite (`shared`) ; un dossier de « Moi » a la clé `dossier:moi:<adresse>/<chemin>` (`mine`) ; `path` est dans les deux cas le chemin de l'explorateur,
  // celui que portent les fichiers rangés dedans. Rien pour un dossier qui ne se partage pas (`whyNotFolder`).
  folderFile(path) {
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    const name = (at && at.folder ? at.folder : path).split('/').pop();
    if (at && at.folder) return { key: folderTarget(at.space.key, at.folder), name, path, shared: { space: at.space, path: at.folder } };
    return !at && this.whyNotFolder(path) === null ? { key: personalTarget(this.#o.identity(), path), name, path, mine: true } : null;
  }

  // L'espace, puis les dossiers au-dessus de celui-ci : ce qu'il hérite (la fenêtre les marque « Hérité »).
  #folderOrigins({ space, path }) {
    return originsOf(space.key, space.name, partsOf(path).slice(0, -1));
  }

  // L'état que la fenêtre dessine : la table des partages (absente : le partage n'est pas activé), la preuve de propriété, ce que la personne peut changer.
  async load(file) {
    const me = lower(this.#o.identity());
    const target = file.shared || file.mine ? null : this.#target(file);
    // Tout se lit ensemble : un seul aller-retour avec Grist, au lieu de quatre l'un après l'autre (mesuré, labo/run-partager-vitesse.mjs). Un partage pas
    // activé (pas de table des partages) laisse de côté ce qui a été lu en plus.
    const [owner, rows, read, placed, groupRows] = await Promise.all([this.#o.reader.owner(),
      this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(SHARES_TABLE)), null),
      target ? this.#authorOf(file, target) : { author: file.mine ? me : lower(file.by) },
      file.shared ? this.#folderOrigins(file.shared) : (file.mine ? mineOrigins(me, partsOf(file.path).slice(0, -1)) : this.#inherited(file.key)),
      this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(GROUPS_TABLE)), null)]);
    if (!rows) return noShare(owner, false);
    if (read.extend !== undefined) return noShare(owner, read.extend);
    const { author } = read;
    const shares = sharesOf(rows, file.key, inheritedFor(file, placed, me, author));
    const admin = administers({ me, key: file.key, rows, shares });
    return { active: true, owner, shares, people: peopleOf(rows), groups: groupRows ? groupsOf(groupRows) : [], me, author, folder: Boolean(file.mine),
      canManage: !this.#o.writeBlock() && (owner === true || (me !== '' && me === author) || admin) };
  }

  // Une lecture qui peut échouer (table absente, accès refusé) : `fallback` à la place.
  async #try(read, fallback) {
    try { return await read(); } catch (error) { return fallback; }
  }

  // L'auteur d'un fichier (d'une app ou un PDF), ou `{ extend }` quand sa table n'est pas prête au partage. La table de fichiers porte-t-elle les colonnes
  // d'aide ? Sinon le partage n'y est pas étendu (une app ajoutée après coup) ; si elle porte celles d'avant les espaces ou d'avant le dossier de « Moi » (pas
  // `GFS_Directs`, pas `GFS_Dossier`), le partage est à compléter ; l'auteur est la colonne que Grist écrit.
  async #authorOf(file, target) {
    const table = await this.#try(() => this.#o.port.doc.fetchTable(target.table), null);
    const has = name => Boolean(table) && Object.prototype.hasOwnProperty.call(table, name);
    if (target.stamped && !has('GFS_Lecteurs')) return { extend: true };
    if (has('GFS_Lecteurs') && !(has('GFS_Directs') && has('GFS_Dossier'))) return { extend: 'upgrade' };
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

  // Le sous-titre de la fenêtre : l'espace d'un dossier d'espace, « Moi » pour un dossier de la personne, l'app d'un fichier.
  #appLabel(file) {
    const { t } = this.#o;
    if (file.shared) return t('share.folder.in', { name: file.shared.space.name });
    return file.mine ? t('share.folder.inMine', { name: t('ex.me') }) : this.#o.appName(file.app);
  }

  // Ouvre la fenêtre du fichier ; rend la promesse de sa fermeture.
  open(file) {
    const { t, container, inertTargets } = this.#o;
    return openShare({
      container, t, locale: this.#o.locale(), inertTargets, other: state => this.#o.other(file, state),
        file: { key: file.key, name: file.name, app: this.#appLabel(file) }, startTab: 'here',
      load: () => this.load(file), onManage: () => this.#o.manage.open(),
      onAdd: record => this.#write([['AddRecord', SHARES_TABLE, null, record]]),
      onChange: (id, patch) => this.#write([['UpdateRecord', SHARES_TABLE, id, patch]]),
      onRemove: id => this.#write([['RemoveRecord', SHARES_TABLE, id]]),
      onActivate: async () => runAction({ kind: 'sharing', plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets, ...options }),
        writer: this.#o.writer, resume: `share:${file.key}` }),
    });
  }
}
