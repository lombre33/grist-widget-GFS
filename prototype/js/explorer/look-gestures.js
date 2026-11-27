// Le geste « Apparence… » d'un dossier de « Moi » ou d'un espace (js/files/folder-looks.js, js/sharing/space-looks.js ; étude du 27/11, choix du porteur) : la
// fenêtre (js/explorer/look-window.js) rend l'apparence choisie, qui s'écrit dans la file des écritures de rangement, derrière celles qui sont parties. Le
// geste dépose de quoi se défaire dans la pile d'annulation de l'explorateur (Ctrl+Z, Ctrl+Y).
// - Un dossier de « Moi » : l'apparence est à la personne seule (sans son adresse, rien ne s'écrit) et s'affiche tout de suite (js/explorer/pending.js, quand
//   tout se sait d'avance).
// - Un espace : l'apparence est à tous ses membres, que seuls les propriétaires du document écrivent (les règles de `GFS_Spaces`) : pour les autres l'article
//   est grisé et sa phrase dit pourquoi. Elle s'affiche une fois écrite (la colonne `Style` peut devoir être ajoutée d'abord, avec l'accord de la personne).
// - Un dossier à l'intérieur d'un espace garde pour l'instant son aspect d'origine (lot suivant) : l'article reste là, grisé.
//
// opts : { rangement, t, notice(texte), writeBlock() -> texte | null, looks() -> la Map chemin -> apparence que l'explorateur montre, exists(path),
//   spaces: { info() -> ce que disent les espaces, owner() -> Promise<vrai si la personne est propriétaire> }, port ({ doc }), consent() -> Promise<bool> (la
//   colonne de l'espace), windows: { look(opts) }, queue(task) -> Promise, undoStack ({ later() }), pending?, refresh(opts) -> Promise }

import { lookActions, sameLook } from '../files/folder-looks.js';
import { TableDeclined } from '../files/rangement.js';
import { SPACES_ROOT, isInsideSpace, isSpaceItself, isSpacePath } from '../sharing/spaces-filing.js';
import { writeSpaceLook } from '../sharing/space-looks.js';

const reasonOf = error => String((error && error.message) || error).slice(0, 120);
const lastPart = path => path.split('/').pop();

export class LookGestures {
  #o;
  #owner = null; // vrai ou faux une fois la sonde revenue, null tant qu'on ne sait pas
  #probe = null;

  constructor(opts) { this.#o = opts; }

  // La personne est-elle propriétaire du document ? Un espace n'est changé que par un propriétaire : la sonde (une requête) part une seule fois, dès que les
  // espaces sont connus, pour que l'article soit grisé avant même le premier clic. Rend la promesse de la sonde.
  warm() {
    const { spaces } = this.#o;
    if (!this.#probe && spaces) {
      this.#probe = Promise.resolve(spaces.owner()).then(owner => { this.#owner = owner === true; }, () => { this.#owner = null; });
    }
    return this.#probe;
  }

  // L'espace que ce chemin désigne (la racine « Espaces » et les dossiers dedans non), ou null.
  #spaceAt(path) {
    const info = this.#o.spaces ? this.#o.spaces.info() : null;
    return isSpaceItself(path) && path !== SPACES_ROOT && info ? info.spaces.find(space => space.path === path) || null : null;
  }

  // Pourquoi on ne change pas l'apparence de ce dossier (une phrase), ou null.
  whyNot(path) {
    const { t } = this.#o;
    if (!isSpacePath(path)) return null;
    if (path === SPACES_ROOT) return t('lk.why.root');
    if (isInsideSpace(path)) return t('lk.why.space');
    if (!this.#spaceAt(path)) return t('lk.why.spaceUnknown');
    void this.warm();
    return this.#owner === false ? t('lk.why.owners') : null;
  }

  // « Apparence… » : la fenêtre, puis l'écriture. Rend true quand l'apparence a changé.
  async change(path) {
    const { t, notice, windows, looks, writeBlock, spaces } = this.#o;
    const why = this.whyNot(path);
    if (why) { notice(why); return false; }
    const blocked = writeBlock();
    if (blocked) { notice(blocked); return false; }
    const space = this.#spaceAt(path);
    if (space && !(await spaces.owner())) { notice(t('lk.why.owners')); return false; } // la sonde n'était pas revenue : la réponse fait foi
    const before = looks().get(path) || null;
    const name = lastPart(path);
    const answer = await windows.look({ title: t(space ? 'lk.title.space' : 'lk.title'), who: t(space ? 'lk.who.space' : 'lk.who'), name, look: before });
    if (answer === null || sameLook(before, answer.look)) return false;
    return this.#write(path, before, answer.look, name);
  }

  // Écrit l'apparence `to` du dossier `path` (`from` : celle d'avant, que l'annulation remet). `phase` : null pour le geste lui-même, 'undo' ou 'redo' quand
  // c'est la pile qui le rejoue (elle attend alors une phrase).
  #write(path, from, to, name, phase = null) {
    const { t, notice, queue, undoStack, refresh, pending, rangement, exists } = this.#o;
    if (phase && !exists(path)) return Promise.resolve(null); // le dossier n'est plus là : rien à rétablir (pas de dossier fantôme)
    const space = this.#spaceAt(path);
    const deposit = undoStack.later();
    const shown = !space && pending && rangement.known === true ? pending.add({ op: 'look', path, look: to }) : null;
    const settle = value => { if (shown) pending.cancel(shown); return value; };
    return queue(async () => {
      try {
        if (!(await (space ? this.#writeSpace(space, to) : this.#writeMine(path, to)))) return settle(phase ? null : false);
      } catch (error) {
        if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return settle(phase ? null : false); }
        console.warn('GFS : l’apparence du dossier n’a pas pu être enregistrée', error);
        notice(t('lk.failed', { reason: reasonOf(error) }));
        return settle(phase ? null : false);
      }
      if (shown) pending.confirm(shown);
      deposit({ run: () => this.#write(path, to, from, name, phase === 'undo' ? 'redo' : 'undo') });
      await refresh({ quiet: true });
      const key = space ? 'Space' : '';
      return phase ? t(`${phase === 'undo' ? 'undo' : 'redo'}.look${key}`, { name }) : true;
    });
  }

  // Écrit l'apparence d'un dossier de « Moi » dans le rangement de la personne. Rend true quand un lot est parti.
  async #writeMine(path, look) {
    const { t, notice, rangement } = this.#o;
    const done = await rangement.writeLooks(ctx => lookActions(ctx, path, look));
    if (!done && !rangement.identity) notice(t('lk.noAddress'));
    return done;
  }

  // Écrit l'apparence d'un espace dans `GFS_Spaces` (js/sharing/space-looks.js). Rend true quand c'est écrit ; sinon la phrase est dite et rend false.
  async #writeSpace(space, look) {
    const { t, notice, port, consent, spaces } = this.#o;
    if (!(await spaces.owner())) { notice(t('lk.why.owners')); return false; }
    const done = await writeSpaceLook({ doc: port.doc, key: space.key, look, consent });
    if (done === 'declined') notice(t('lk.col.declined'));
    if (done === 'missing') notice(t('lk.why.spaceUnknown'));
    return done === 'done';
  }
}
