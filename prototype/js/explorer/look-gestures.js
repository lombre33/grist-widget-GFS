// Le geste « Apparence… » d'un dossier de « Moi » (js/files/folder-looks.js ; étude du 27/11, choix du porteur) : la fenêtre (js/explorer/look-window.js) rend
// l'apparence choisie, qui s'affiche tout de suite (js/explorer/pending.js, quand tout se sait d'avance) puis s'écrit dans la file des écritures de rangement,
// derrière celles qui sont parties. Le geste dépose de quoi se défaire dans la pile d'annulation de l'explorateur (Ctrl+Z, Ctrl+Y). L'apparence est à la
// personne
// seule : sans son adresse, rien ne s'écrit. Un dossier d'un espace garde pour l'instant son aspect d'origine (lot suivant) : l'article reste là, grisé, et sa
//   phrase dit pourquoi.
//
// opts : { rangement, t, notice(texte), writeBlock() -> texte | null, looks() -> la Map chemin -> apparence que l'explorateur montre, exists(path),
//   isSpace(path),
//   windows: { look(opts) }, queue(task) -> Promise, undoStack ({ later() }), pending?, refresh(opts) -> Promise }

import { lookActions, sameLook } from '../files/folder-looks.js';
import { TableDeclined } from '../files/rangement.js';

const reasonOf = error => String((error && error.message) || error).slice(0, 120);
const lastPart = path => path.split('/').pop();

export class LookGestures {
  #o;

  constructor(opts) { this.#o = opts; }

  // Pourquoi on ne change pas l'apparence de ce dossier (une phrase), ou null.
  whyNot(path) {
    const { t, isSpace } = this.#o;
    return isSpace(path) ? t('lk.why.space') : null;
  }

  // « Apparence… » : la fenêtre, puis l'écriture. Rend true quand l'apparence a changé.
  async change(path) {
    const { t, notice, windows, looks, writeBlock } = this.#o;
    const why = this.whyNot(path);
    if (why) { notice(why); return false; }
    const blocked = writeBlock();
    if (blocked) { notice(blocked); return false; }
    const before = looks().get(path) || null;
    const name = lastPart(path);
    const answer = await windows.look({ title: t('lk.title'), name, look: before });
    if (answer === null || sameLook(before, answer.look)) return false;
    return this.#write(path, before, answer.look, name);
  }

  // Écrit l'apparence `to` du dossier `path` (`from` : celle d'avant, que l'annulation remet). `phase` : null pour le geste lui-même, 'undo' ou 'redo' quand
  // c'est la pile qui le rejoue (elle attend alors une phrase).
  #write(path, from, to, name, phase = null) {
    const { t, notice, queue, undoStack, refresh, rangement, pending, exists } = this.#o;
    if (phase && !exists(path)) return Promise.resolve(null); // le dossier n'est plus là : rien à rétablir (pas de dossier fantôme)
    const deposit = undoStack.later();
    const shown = pending && rangement.known === true ? pending.add({ op: 'look', path, look: to }) : null;
    const settle = value => { if (shown) pending.cancel(shown); return value; };
    return queue(async () => {
      try {
        if (!(await rangement.writeLooks(ctx => lookActions(ctx, path, to)))) {
          if (!rangement.identity) notice(t('lk.noAddress'));
          return settle(phase ? null : false);
        }
      } catch (error) {
        if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return settle(phase ? null : false); }
        console.warn('GFS : l’apparence du dossier n’a pas pu être enregistrée', error);
        notice(t('lk.failed', { reason: reasonOf(error) }));
        return settle(phase ? null : false);
      }
      if (shown) pending.confirm(shown);
      deposit({ run: () => this.#write(path, to, from, name, phase === 'undo' ? 'redo' : 'undo') });
      await refresh({ quiet: true });
      return phase ? t(phase === 'undo' ? 'undo.look' : 'redo.look', { name }) : true;
    });
  }
}
