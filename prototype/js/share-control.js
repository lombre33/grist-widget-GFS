// Ce que le contrôleur fait de « Partager » (contrats 11.7, point 13) : lit la table des partages, dit si le fichier se partage, ouvre la fenêtre (js/share-window.js), écrit les lignes de partage et active
// le partage (un geste de propriétaire, avec la question qui dit le prix : js/rights-actions.js). Le premier lot couvre les PDF que GFS garde ; les fichiers d'une app attendent leurs colonnes d'aide.

import { rowsOf } from './rights.js';
import { FILES_APP } from './gfs-files.js';
import { SHARES_TABLE, sharesOf } from './sharing-model.js';
import { openShare } from './share-window.js';
import { runAction } from './rights-actions.js';
import { ask } from './ask-window.js';

const lower = text => String(text ?? '').trim().toLowerCase();

export class ShareControl {
  #o;

  // opts : { port, reader, writer, t, locale(), container, inertTargets(), identity() → l'adresse de la personne ou '', fullAccess(), writeBlock() → la raison d'un blocage ou null, appName(id), extraTargets() }
  constructor(opts) { this.#o = opts; }

  // Pourquoi ce fichier ne se partage pas (une phrase), ou null quand il se partage.
  whyNot(file) {
    if (!this.#o.fullAccess()) return this.#o.t('share.noAccess');
    return file && file.app === FILES_APP ? null : this.#o.t('share.unsupported');
  }

  // L'état que la fenêtre dessine : la table des partages (absente : le partage n'est pas activé), la preuve de propriété, ce que la personne peut changer.
  async load(file) {
    const owner = await this.#o.reader.owner();
    let rows = null;
    try { rows = rowsOf(await this.#o.port.doc.fetchTable(SHARES_TABLE)); } catch (error) { rows = null; }
    if (!rows) return { active: false, owner, shares: [], people: [], me: '', author: '', canManage: false };
    const me = lower(this.#o.identity());
    const author = lower(file.by);
    const shares = sharesOf(rows, file.key);
    const admin = shares.some(share => share.valid && share.active && share.right === 'admin' && lower(share.who) === me);
    const people = [...new Set(rows.map(row => lower(row.PersonneL || row.Personne)).filter(who => who && !who.startsWith('@')))].sort();
    return { active: true, owner, shares, people, me, author, canManage: !this.#o.writeBlock() && (owner === true || (me !== '' && me === author) || admin) };
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
      container, t, locale: this.#o.locale(), inertTargets, extraTargets: this.#o.extraTargets(), file: { key: file.key, name: file.name, app: this.#o.appName(file.app) },
      load: () => this.load(file),
      onAdd: record => this.#write([['AddRecord', SHARES_TABLE, null, record]]),
      onChange: (id, patch) => this.#write([['UpdateRecord', SHARES_TABLE, id, patch]]),
      onRemove: id => this.#write([['RemoveRecord', SHARES_TABLE, id]]),
      onActivate: async () => runAction({ kind: 'sharing', plans: await this.#o.writer.plans(), t, ask: options => ask({ container, inertTargets, ...options }), writer: this.#o.writer, resume: `share:${file.key}` }),
    });
  }
}
