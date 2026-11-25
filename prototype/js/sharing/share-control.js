// Ce que le contrôleur fait de « Partager » (contrats 11.7, point 13) : lit la table des partages, dit si le fichier se partage, ouvre la fenêtre
// (js/sharing/share-window.js), écrit les lignes de partage et active le partage (un geste de propriétaire, avec la question qui dit le prix :
// js/rights/rights-actions.js). Le premier lot couvre les PDF que GFS garde ; les fichiers d'une app attendent leurs colonnes d'aide.

import { rowsOf } from '../rights/rights.js';
import { FILES_TABLE } from '../files/gfs-files.js';
import { GROUPS_TABLE, PLACE_TABLE, ROOT, SHARES_TABLE, SPACES_TABLE, STAMP, TARGETS, folderTarget, groupsOf, personalTarget, sharesOf,
  spaceTarget } from './sharing-model.js';
import { listOf } from './direct-shares.js';
import { idKey, keysOf } from './folder-identity.js';
import { openShare } from './share-window.js';
import { runAction, writeActions } from '../rights/rights-actions.js';
import { ask } from '../ui/ask-window.js';
import { locate } from './spaces-filing.js';
import { linkWithin } from './space-links.js';

const lower = text => String(text ?? '').trim().toLowerCase();

// L'état d'un fichier dont le partage n'est pas (encore) actif : `extend` dit ce qui manque (false : la table des partages ; true : les colonnes d'aide ;
// 'upgrade' : celles d'avant les espaces).
const noShare = (owner, extend) => ({ active: false, extend, owner, shares: [], people: [], me: '', author: '', canManage: false });

// L'espace, puis chaque dossier du chemin : ce qu'un fichier ou un dossier hérite (`parts` : les noms de dossier, du haut vers le bas).
const originsOf = (spaceKey, name, parts) => [{ kind: 'space', name, target: spaceTarget(spaceKey) },
  ...parts.map((part, at) => ({ kind: 'folder', name: part, target: folderTarget(spaceKey, parts.slice(0, at + 1).join('/')) }))];

// Les personnes que GFS connaît déjà : celles des lignes de partage, sans les catégories (« @ ») ni les groupes (« # »), en minuscules, sans doublon, triées.
// Les dossiers au-dessus d'un fichier ou d'un dossier de « Moi » (`parts` : les noms, du haut vers le bas) : ce qu'il hérite des droits donnés à ces dossiers.
// Un dossier de « Moi » se désigne par le numéro de sa ligne d'état (`rows`) et, pour un partage posé avant ce lot, par son chemin : `target` les liste tous.
const mineOrigins = (identity, parts, rows = []) => parts.map((part, at) => ({ kind: 'folder', name: part,
  target: keysOf(identity, parts.slice(0, at + 1).join('/'), rows) }));
const partsOf = path => String(path || '').split('/').filter(Boolean);

// Ce qu'un fichier hérite en plus de ce que son placement dit (`placed`) : hors d'un espace, les dossiers que son auteur lui a donnés dans « Moi » (ceux de
// la personne qui regarde, quand elle en est l'auteur) ; un dossier garde ses propres origines.
function inheritedFor(file, placed, me, author, rows) {
  if (file.mine || file.shared || placed.length || !file.folder || me === '' || me !== author) return placed;
  return String(file.folder).split('/')[0] === 'Espaces' ? placed : mineOrigins(me, partsOf(file.folder), rows);
}

// Les cibles du fichier ou du dossier, et ce qu'il hérite : les arguments de `sharesOf`. Un dossier de « Moi » se désigne par le numéro de sa ligne d'état et
// par son chemin (partages d'avant), ses dossiers parents de même.
function whatIs(file, { me, author, placed, stateRows }) {
  if (!file.mine) return [file.key, inheritedFor(file, placed, me, author, stateRows)];
  return [keysOf(me, file.path, stateRows), mineOrigins(me, partsOf(file.path).slice(0, -1), stateRows)];
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
    const info = this.#o.spaces ? this.#o.spaces() : null;
    if (linkWithin(info, path)) return t('share.folder.link');
    const at = locate(path, info);
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

  // Pourquoi « Partager… » est grisé pour ce chemin (une phrase), ou null : comme `whyNotFolder`, mais un espace entier se partage aussi (demande du porteur du
  // 25/11 : « Partager… » sur la ligne d'un espace ouvre le partage de cet espace). `whyNotFolder` ne change pas : « Lier dans un espace… » s'en sert, et un
  //   espace entier ne se lie pas.
  whyNotShareFolder(path) {
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    return at && !at.folder && this.#o.fullAccess() ? null : this.whyNotFolder(path);
  }

  // Ce que « Partager… » ouvre pour ce chemin : un espace entier (sa clé `espace:<clé>`, son nom, et ni chemin ni app : ce n'est ni un dossier ni un fichier,
  // la fenêtre et l'onglet « autre document » le reconnaissent à `wholeSpace` : `space` seul ne le dit pas, un fichier rangé dans un espace porte aussi
  // `space`), sinon le dossier (`folderFile`).
  shareFolderFile(path) {
    const at = locate(path, this.#o.spaces ? this.#o.spaces() : null);
    return at && !at.folder ? { key: spaceTarget(at.space.key), name: at.space.name, space: at.space, wholeSpace: true } : this.folderFile(path);
  }

  // L'espace, puis les dossiers au-dessus de celui-ci : ce qu'il hérite (la fenêtre les marque « Hérité »).
  #folderOrigins({ space, path }) {
    return originsOf(space.key, space.name, partsOf(path).slice(0, -1));
  }

  // Tout ce que la fenêtre lit, ensemble : un seul aller-retour avec Grist, au lieu de quatre l'un après l'autre (mesuré, labo/run-partager-vitesse.mjs). Un
  // partage pas activé (pas de table des partages) laisse de côté ce qui a été lu en plus. `stateRows` : les lignes d'état des dossiers de la personne, qui
  // désignent un dossier de « Moi » par leur numéro (js/sharing/folder-identity.js).
  #readAll(file, me) {
    const target = file.shared || file.mine ? null : this.#target(file);
    const wantsFolders = me !== '' && (file.mine || (file.folder && !file.shared));
    return Promise.all([this.#o.reader.owner(),
      this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(SHARES_TABLE)), null),
      target ? this.#authorOf(file, target) : { author: file.mine ? me : lower(file.by) },
      file.shared ? this.#folderOrigins(file.shared) : (file.mine || file.wholeSpace ? [] : this.#inherited(file.key)),
      this.#try(async () => rowsOf(await this.#o.port.doc.fetchTable(GROUPS_TABLE)), null), wantsFolders ? this.#folderRows() : []]);
  }

  // L'état que la fenêtre dessine : la table des partages (absente : le partage n'est pas activé), la preuve de propriété, ce que la personne peut changer.
  async load(file) {
    const me = lower(this.#o.identity());
    const [owner, rows, read, placed, groupRows, stateRows] = await this.#readAll(file, me);
    if (!rows) return noShare(owner, false);
    if (read.extend !== undefined) return noShare(owner, read.extend);
    const { author } = read;
    const shares = sharesOf(rows, ...whatIs(file, { me, author, placed, stateRows }));
    const admin = administers({ me, key: file.key, rows, shares });
    return { active: true, owner, shares, people: peopleOf(rows), groups: groupRows ? groupsOf(groupRows) : [], me, author, folder: Boolean(file.mine),
      canManage: !this.#o.writeBlock() && (owner === true || (me !== '' && me === author) || admin) };
  }

  // Les lignes d'état des dossiers de la personne ([{ id, path }], relues) : sans le rangement, ou sans sa table, aucune.
  async #folderRows() {
    return this.#o.rangement ? this.#try(() => this.#o.rangement.folderRows(), []) : [];
  }

  // La cible à écrire pour ce dossier (`folderFile`) : pour un dossier de « Moi », le numéro de sa ligne d'état, que GFS crée si le dossier n'en a pas encore
  // (un dossier existe par ses fichiers : sa ligne naît au premier partage ou au premier lien) ; pour un dossier d'espace, sa clé. Rend la clé de `folderFile`
  // (le chemin, à l'ancienne) quand la ligne ne peut pas s'écrire : le partage et le lien marchent, ils ne suivront pas un renommage.
  async keyOf(folder) {
    if (!folder.mine || !this.#o.rangement) return folder.key;
    const me = lower(this.#o.identity());
    try {
      const found = (await this.#o.rangement.folderIds([folder.path], true)).get(folder.path);
      return found ? idKey(me, found) : folder.key;
    } catch (error) {
      console.warn('GFS : la ligne du dossier n’a pas pu être écrite, le partage garde son chemin', error);
      return folder.key;
    }
  }

  // Une lecture qui peut échouer (table absente, accès refusé) : `fallback` à la place.
  async #try(read, fallback) {
    try { return await read(); } catch (error) { return fallback; }
  }

  // L'auteur d'un fichier (d'une app ou un PDF), ou `{ extend }` quand sa table n'est pas prête au partage. La table de fichiers porte-t-elle les colonnes
  // d'aide ? Sinon le partage n'y est pas étendu (une app ajoutée après coup) ; si elle porte celles d'avant les espaces ou d'avant le dossier de « Moi » (pas
  // `GFS_Directs`, pas `GFS_Dossier`, pas `GFS_Vus`, pas `GFS_Ids`), le partage est à compléter ; l'auteur est la colonne que Grist écrit.
  async #authorOf(file, target) {
    const table = await this.#try(() => this.#o.port.doc.fetchTable(target.table), null);
    const has = name => Boolean(table) && Object.prototype.hasOwnProperty.call(table, name);
    if (target.stamped && !has('GFS_Lecteurs')) return { extend: true };
    if (has('GFS_Lecteurs') && !(has('GFS_Directs') && has('GFS_Dossier') && has('GFS_Vus') && has('GFS_Ids'))) return { extend: 'upgrade' };
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
    if (file.wholeSpace) return t('share.space.kind');
    return file.mine ? t('share.folder.inMine', { name: t('ex.me') }) : this.#o.appName(file.app);
  }

  // Écrit un partage : un dossier de « Moi » le reçoit par le numéro de sa ligne d'état (`keyOf`), que la fenêtre ne connaît pas encore quand le dossier
  // n'avait aucun partage.
  async add(file, record) {
    return this.#write([['AddRecord', SHARES_TABLE, null, file.mine ? { ...record, Cible: await this.keyOf(file) } : record]]);
  }

  // Ouvre la fenêtre du fichier ; rend la promesse de sa fermeture.
  open(file) {
    const { t, container, inertTargets } = this.#o;
    return openShare({
      container, t, locale: this.#o.locale(), inertTargets, other: state => this.#o.other(file, state),
        file: { key: file.key, name: file.name, app: this.#appLabel(file) }, startTab: 'here', link: this.#o.pageLink,
      load: () => this.load(file), onManage: () => this.#o.manage.open(),
      onAdd: record => this.add(file, record),
      onChange: (id, patch) => this.#write([['UpdateRecord', SHARES_TABLE, id, patch]]),
      onRemove: id => this.#write([['RemoveRecord', SHARES_TABLE, id]]),
      onActivate: async () => runAction({ kind: 'sharing', plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets, ...options }),
        writer: this.#o.writer, resume: `share:${file.key}` }),
    });
  }
}
