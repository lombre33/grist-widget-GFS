// Les gestes du verrou réel de « qui modifie les fiches » (module Annuaire ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu ») : lire les règles
// d'accès (un propriétaire prouvé seulement), montrer l'aperçu (js/annuaire/annuaire-lock-window.js), et n'écrire qu'à l'accord de la personne : les colonnes
// d'aide, puis la liasse de règles en une seule écriture (contrats 11.5), ou le retrait. Grist recharge alors la page de tout le monde ; GFS rouvre l'annuaire
// au retour (`annuaire:lock`, `annuaire:unlock` ou `annuaire:close` : le mot que js/controller.js reconnaît, et la phrase qu'il dit ;
// js/rights/rights-writer.js). Les plans sont à js/annuaire/annuaire-lock.js.

import { readConfig } from './annuaire-config.js';
import { lockKey, planLock, planUnlock } from './annuaire-lock.js';
import { lockModel } from './annuaire-lock-view.js';
import { openLockWindow } from './annuaire-lock-window.js';

// Le verrou ne lit pas la table des fichiers (la plus lourde du document) : il n'a besoin que des règles, des tables et de leurs colonnes.
const READING = Object.freeze({ files: false });

export class LockControl {
  #o;

  // opts : { t, locale(), container, inertTargets(), ask(opts) -> Promise<boolean>, notice(texte), port ({ doc: { applyUserActions } }), rights ({ reader,
  //   writer }),
  //   schema() -> les tables du document, ou null, writeBlock() -> texte ou null }
  constructor(opts) { this.#o = opts; }

  // Ce que le réglage de l'annuaire reçoit : de quoi dire pourquoi le bouton est grisé (`why(brouillon)` : le texte, ou '') et de quoi ouvrir la fenêtre. Le
  // verrou suit le réglage ENREGISTRÉ : un brouillon qui en diffère est dit, jamais écrit.
  forSetup(annuaire, admin) {
    const { t } = this.#o;
    const saved = readConfig(annuaire.config);
    return { why: draft => {
      if (!admin) return t('an.opt.lockWhy.admin');
      return lockKey(readConfig(draft.config), draft.table) === lockKey(saved, annuaire.table) ? '' : t('an.opt.lockWhy.dirty');
    }, open: () => this.open(annuaire) };
  }

  // La fenêtre du verrou de `annuaire` (celui qui est enregistré) ; rend vrai quand quelque chose s'est écrit.
  async open(annuaire) {
    const { t } = this.#o;
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return false; }
    const raw = await this.#o.rights.reader.raw(READING);
    const schema = raw ? await this.#o.schema() : null;
    if (!schema) { if (!raw) this.#o.notice(t('an.opt.lockWhy.unreadable')); return false; }
    const config = readConfig(annuaire.config);
    const model = lockModel({ raw, table: annuaire.table, config, schema, t, locale: this.#o.locale() });
    const choice = await openLockWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, model, name: annuaire.name,
      table: annuaire.table });
    if (!choice.action) return false;
    return this.#run(choice, model, annuaire);
  }

  async #run({ action, structure }, model, annuaire) {
    const { t, rights } = this.#o;
    const table = annuaire.table;
    if (action === 'close') return this.#report(await rights.writer.apply('close', 'annuaire:close'));
    if (action === 'remove') {
      const yes = await this.#o.ask({ title: t('an.lock.removeTitle'), message: t('an.lock.removeMessage', { table }), items: [t('an.lock.c.reload')],
        confirmLabel: t('an.lock.removeConfirm'), cancelLabel: t('an.lock.cancel'), safeFirst: true });
      return yes ? this.#report(await rights.writer.applyWith(existing => planUnlock(existing, table), 'annuaire:unlock', READING)) : false;
    }
    // Poser ou mettre à jour : les colonnes d'aide d'abord (des formules : elles ne rechargent personne), puis les règles, relues au moment même.
    const { spec, say } = model;
    const first = await rights.reader.raw(READING);
    const plan = first ? planLock(first, spec, say, { structure }) : null;
    if (plan && plan.columns && plan.columns.length) {
      try { await this.#o.port.doc.applyUserActions(plan.columns); } catch (error) {
        return this.#report({ ok: false, message: String((error && error.message) || error).slice(0, 300) }); }
    }
    return this.#report(await rights.writer.applyWith(existing => planLock(existing, spec, say, { structure }), 'annuaire:lock', READING));
  }

  // Le compte rendu : un échec se dit dans une fenêtre ; ce qui n'avait plus rien à écrire (déjà posé) se dit en une phrase. Rend vrai quand Grist a écrit.
  async #report(result) {
    const { t } = this.#o;
    if (result.ok) { if (result.written === false) this.#o.notice(t('an.lock.done')); return true; }
    if (result.reason === 'already') { this.#o.notice(t('an.lock.done')); return true; }
    await this.#o.ask({ title: t('an.lock.failedTitle'), message: result.message ? t('an.lock.failed', { message: result.message }) : t('an.lock.stale'),
      confirmLabel: t('rights.ask.ok') });
    return false;
  }
}
