// Les gestes d'un sous-annuaire (module Annuaire, demande du porteur du 25/11) : le créer, actualiser sa copie, le partager, le supprimer. Ils vivent à part du
// contrôle de l'annuaire (js/annuaire/annuaire-control.js), qui ne fait que les lancer. Le verrou est celui de Grist : avant d'écrire la copie, ce module
// vérifie que les règles du partage couvrent `GFS_Directories` (sinon il les pose, avec la question qui dit le prix : js/rights/rights-actions.js), car une
// copie écrite avant ses règles serait lisible de tous le temps qu'elles arrivent. Seul un propriétaire du document crée ou supprime un sous-annuaire (preuve
// de GFS,
// js/broker/transfer.js : jamais devinée) ; qui actualise ou partage, c'est Grist qui le dit (`access`).

import { SubWindow } from './annuaire-sub-window.js';
import { criteriaOf, copyable, peopleOfSub, parentOf } from './annuaire-sub.js';
import { fieldGenres } from './annuaire-model.js';
import { shown } from './annuaire-panes.js';
import { NameTaken, TableDeclined, MissingTable } from './annuaire-store.js';
import { ANNUAIRES_TABLE, annuaireFile, annuaireKey, ANNUAIRES_APP } from '../files/annuaire-files.js';
import { runAction } from '../rights/rights-actions.js';
import { rowsOf } from '../rights/rights.js';
import { SHARES_TABLE, PLACE_TABLE } from '../sharing/sharing-model.js';
import { TABLE as FILING_TABLE } from '../files/rangement.js';

const lower = text => String(text ?? '').trim().toLowerCase();

export class SubControl {
  #o;

  // opts : { store, t, locale(), container, inertTargets(), ask(opts) -> Promise<boolean>, notice(texte), say(texte) (le pied de la fenêtre de l'annuaire),
  //   writeBlock(), admin() -> Promise<vrai si GFS a prouvé que la personne est propriétaire>, identity(), rights ({ writer, sharing }), origin(annuaire) -> la
  //   lecture de l'annuaire d'origine, vue d'un administrateur (js/annuaire/annuaire-control.js), reload(row) -> relit la liste et montre l'annuaire `row` }
  constructor(opts) { this.#o = opts; }

  // Ce que la personne peut faire d'un sous-annuaire : { refresh, share, remove }. Un propriétaire, tout ; sinon ce que Grist dit de ses droits sur la ligne
  // (un écrivain actualise, un administrateur partage), jamais supprimer.
  can(annuaire, admin) {
    const me = lower(this.#o.identity());
    const { writers, admins } = annuaire.access || { writers: [], admins: [] };
    const isAdmin = me !== '' && admins.includes(me);
    return { refresh: admin || isAdmin || (me !== '' && writers.includes(me)), share: admin || isAdmin, remove: admin };
  }

  // Les règles du partage couvrent-elles `GFS_Directories` ? Sinon elles se posent (la question dit le prix) et Grist recharge la page : GFS rouvre l'annuaire
  // au retour. Rend vrai quand le verrou est en place et que la copie peut s'écrire.
  async #locked(again = true) {
    const { t, rights } = this.#o;
    const plans = await rights.writer.plans();
    if (!plans) { this.#o.notice(t('an.sub.noRules')); return false; }
    const plan = plans.sharing;
    if (plan.ok) {
      const done = again && await runAction({ kind: 'sharing', plans, t, ask: options => this.#o.ask(options), writer: rights.writer, resume: 'annuaire' });
      return done ? this.#locked(false) : false;
    }
    const table = plan.reason === 'already' ? await this.#o.store.table(ANNUAIRES_TABLE) : null;
    const covered = Boolean(table) && Array.isArray(table.GFS_Lecteurs) && Array.isArray(table.GFS_Refus);
    if (!covered) this.#o.notice(t(plan.reason === 'foreign' || plan.reason === 'already' ? 'an.sub.foreign' : 'an.sub.noRules'));
    return covered;
  }

  // Un nouveau sous-annuaire de `parent` : le verrou, la fenêtre, l'écriture de la copie, puis la fenêtre « Partager » (qui d'autre le voit). Rend vrai quand
  // il est créé.
  async create(parent, list) {
    const { t, store } = this.#o;
    if ((await this.#o.admin()) !== true) { this.#o.notice(t('an.sub.newWhy')); return false; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return false; }
    if (!(await this.#locked())) return false;
    const read = await this.#origin(parent);
    if (!read) return false;
    const genres = fieldGenres(read.config, parent.table, read.schema);
    const ctx = { t, locale: this.#o.locale() };
    const people = copyable(read);
    const made = await new SubWindow({ container: this.#o.container, inertTargets: this.#o.inertTargets, t, parent: parent.name,
      criteria: criteriaOf(read, people), taken: list.map(each => each.name),
      show: (value, genre) => shown(value, genre || genres[value], ctx), count: sub =>
        (sub.key && sub.values.length ? peopleOfSub(people, sub).length : 0) }).run();
    if (!made) return false;
    try {
      const annuaire = await store.createSub({ name: made.name, parent, sub: made.sub, read, at: new Date().toISOString() });
      await this.#o.reload(annuaire.row);
      this.#o.notice(t('an.sub.created', { name: annuaire.name, n: annuaire.count }));
      await this.share(annuaire);
      return true;
    } catch (error) {
      this.#fail(error, 'an.sub.createFailed');
      return false;
    }
  }

  // La lecture de l'annuaire d'origine, vue d'un administrateur (les fiches masquées s'y voient : la copie les écarte) ; une phrase quand il n'existe plus.
  async #origin(parent) {
    try { return await this.#o.origin(parent); } catch (error) { this.#fail(error, 'an.sub.refreshFailed'); return null; }
  }

  #fail(error, key) {
    const { t } = this.#o;
    if (error instanceof TableDeclined) this.#o.notice(t('an.declined'));
    else if (error instanceof NameTaken) this.#o.notice(t('an.sub.errTaken'));
    else if (error instanceof MissingTable) this.#o.notice(t('an.tableGone', { table: error.table }));
    else { console.error('GFS : geste de sous-annuaire impossible', error); this.#o.notice(
      t(key, { reason: String(error && error.message ? error.message : error) })); }
  }

  // « Actualiser » : la copie reprise de l'annuaire d'origine, par quelqu'un qui peut l'écrire (Grist garde le dernier mot). `before` : combien de personnes la
  // copie en avait.
  async refresh(annuaire, list, before) {
    const { t, store } = this.#o;
    const parent = parentOf(list, annuaire);
    if (!parent) { this.#o.notice(t('an.sub.parentGone')); return false; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return false; }
    const read = await this.#origin(parent);
    if (!read) return false;
    try {
      const { count } = await store.refreshSub(annuaire, { parent, read, at: new Date().toISOString() });
      await this.#o.reload(annuaire.row);
      this.#o.say(t(count === before ? 'an.sub.refreshed' : 'an.sub.refreshedChange', { n: count, before }));
      return true;
    } catch (error) {
      this.#fail(error, 'an.sub.refreshFailed');
      return false;
    }
  }

  // « Partager… » : la fenêtre des partages de GFS pour la ligne du sous-annuaire (les mêmes lignes que pour un fichier). Elle rend la main quand on la ferme ;
  // la liste se relit (les droits ont pu changer).
  async share(annuaire) {
    const { rights } = this.#o;
    const file = annuaireFile(annuaire);
    const why = rights.sharing.whyNot(file);
    if (why) { this.#o.notice(why); return false; }
    this.#o.say(this.#o.t('an.sub.shared', { name: annuaire.name }));
    await rights.sharing.open(file);
    await this.#o.reload(annuaire.row);
    return true;
  }

  // Les lignes des tables de GFS qui parlent d'un sous-annuaire (partages, placement, rangement) : leurs numéros, pour les retirer avec lui.
  async #traces(annuaire) {
    const key = annuaireKey(annuaire.row);
    const read = async (table, keep) => {
      try { return rowsOf(await this.#o.store.table(table)).filter(keep).map(row => row.id); } catch (error) { return []; }
    };
    const [shares, places, filing] = await Promise.all([read(SHARES_TABLE, row => row.Cible === key), read(PLACE_TABLE, row => row.Cible === key),
      read(FILING_TABLE, row => row.App === ANNUAIRES_APP && String(row.Fichier) === String(annuaire.row))]);
    return { shares, places, filing };
  }

  // « Supprimer » : la question, puis la ligne et ce qui en parlait. Un annuaire principal et ses données ne changent pas. Rend vrai quand il est supprimé.
  async remove(annuaire, list) {
    const { t, store } = this.#o;
    if ((await this.#o.admin()) !== true) { this.#o.notice(t('an.sub.removeWhy')); return false; }
    const blocked = this.#o.writeBlock();
    if (blocked) { this.#o.notice(blocked); return false; }
    const yes = await this.#o.ask({ title: t('an.sub.removeAsk.title', { name: annuaire.name }), message: t('an.sub.removeAsk.message'),
      confirmLabel: t('an.sub.removeAsk.confirm'), cancelLabel: t('an.set.cancel'), safeFirst: true });
    if (!yes) return false;
    try {
      await store.removeSub(annuaire, await this.#traces(annuaire));
      const parent = parentOf(list, annuaire);
      await this.#o.reload(parent ? parent.row : null);
      this.#o.notice(t('an.sub.removed', { name: annuaire.name }));
      return true;
    } catch (error) {
      this.#fail(error, 'an.sub.removeFailed');
      return false;
    }
  }
}
