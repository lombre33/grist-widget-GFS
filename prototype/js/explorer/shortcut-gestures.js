// Les gestes des raccourcis de fichiers (js/files/shortcuts.js ; demande du porteur, 27/11) : créer un raccourci vers un fichier depuis n'importe quelle vue
// (« Moi », « Récents », « Favoris », « Ouverts », « Partagés avec moi », un espace), le renommer, le retirer. Un raccourci est à la personne seule et dans ses
// dossiers de « Moi » : il ne se range jamais dans un espace (les placements d'un espace se partagent, ceux-là sont à des propriétaires). Retirer un raccourci
// ou le renommer ne touche jamais au fichier visé. Chaque geste dépose de quoi se défaire dans la pile d'annulation de l'explorateur (Ctrl+Z, Ctrl+Y) et
// s'écrit dans la file des écritures de rangement (`queue`), derrière celles qui sont parties.
//
// opts : { rangement, t, notice(texte), writeBlock() -> texte | null, files(), folders() (les dossiers gardés sans fichier), locale(), here() (le dossier
//   ouvert),
//   windows: { name(opts), folder(opts) }, queue(task) -> Promise, undoStack ({ later() }), refresh(opts) -> Promise }

import { addActions, newShortcutId, removeActions, renameActions } from '../files/shortcuts.js';
import { TableDeclined } from '../files/rangement.js';
import { folderName, folderPaths, normalizePath } from './explorer-model.js';
import { isSpacePath } from '../sharing/spaces-filing.js';
import { ACCEPTED } from '../sharing/received-state.js';

const reasonOf = error => String((error && error.message) || error).slice(0, 120);

export class ShortcutGestures {
  #o;

  constructor(opts) { this.#o = opts; }

  // Pourquoi on ne crée pas de raccourci vers ce fichier (une phrase), ou null : c'est déjà un raccourci, ou c'est une arrivée d'un autre document que la
  // personne n'a pas encore acceptée.
  whyNot(file) {
    const { t } = this.#o;
    if (file.shortcut) return t('sc.why.shortcut');
    if (file.received && file.received.state !== ACCEPTED) return t('sc.why.pending');
    return null;
  }

  // Le grisé d'une ligne de raccourci : celui d'une cible qu'on ne lit plus (la phrase dit pourquoi et ce qu'on peut faire), sinon rien.
  lockOf(file) {
    return file.shortcut && file.shortcut.state === 'missing' ? { text: this.#o.t('sc.missing') } : null;
  }

  // Le mot du type d'une ligne de raccourci : « Raccourci · PDF » (l'icône et le mot du type vont ensemble, charte) ; `typeLabel(file)` : celui de la cible.
  typeLabel(file, typeLabel) {
    const { t } = this.#o;
    return file.shortcut.state === 'missing' || !file.type ? t('sc.type') : t('sc.typeOf', { type: typeLabel(file) });
  }

  // Les dossiers de « Moi » où ranger un raccourci : ceux de la liste, jamais « Espaces ».
  #folders() { return folderPaths(this.#o.files(), this.#o.locale(), (this.#o.folders && this.#o.folders()) || []).filter(path => !isSpacePath(path)); }

  // Un geste à la fois, et rien quand le document ne peut rien enregistrer (la personne en lit la phrase).
  #guard() {
    const blocked = this.#o.writeBlock();
    if (blocked) this.#o.notice(blocked);
    return !blocked;
  }

  // « Créer un raccourci… » : la personne choisit le dossier de « Moi » (ou en écrit un neuf), le raccourci s'y montre et le fichier reste où il est. Rend true
  // quand il est écrit.
  async create(file) {
    const { t, notice, windows, here } = this.#o;
    const why = this.whyNot(file);
    if (why) { notice(why); return false; }
    if (!this.#guard()) return false;
    const name = file.name || t('ex.untitled');
    const base = isSpacePath(here()) ? '' : here();
    const target = await windows.folder({ title: t('sc.pick.title', { name }), folders: this.#folders(), current: null, base, clean: folderName });
    if (target === null) return false;
    const row = { id: newShortcutId(), folder: normalizePath(target), target: file.key, name: file.name || '', type: file.type || '' };
    const done = await this.#change({ forward: ctx => addActions(ctx, row), backward: ctx => removeActions(ctx, row.id), name,
      says: { undo: 'undo.shortcutCreated', redo: 'redo.shortcutCreated' } });
    if (done) notice(t('sc.done', { name, folder: row.folder ? row.folder.split('/').join(' / ') : t('ex.me') }));
    return done;
  }

  // Renomme le raccourci (seul le nom du raccourci change, jamais celui du fichier visé).
  async rename(file) {
    const { t, windows } = this.#o;
    if (!this.#guard()) return false;
    const was = file.name || '';
    const name = await windows.name({ title: t('sc.renameTitle', { name: was || t('ex.untitled') }), label: t('sc.nameLabel'), value: was,
      confirmLabel: t('ex.rename'),
      refuse: value => (value ? null : t('ex.nameEmpty')) });
    if (name === null || name === was) return false;
    return this.#change({ forward: ctx => renameActions(ctx, file.id, name), backward: ctx => renameActions(ctx, file.id, was), name,
      says: { undo: 'undo.shortcutRenamed', redo: 'redo.shortcutRenamed' } });
  }

  // Retire le raccourci : sa ligne s'en va, le fichier n'a pas bougé.
  async remove(file) {
    const { t, notice } = this.#o;
    if (!this.#guard()) return false;
    const row = { id: file.id, folder: file.folder, target: file.shortcut.target, name: file.name, type: file.type || '' };
    const name = file.name || t('ex.untitled');
    const done = await this.#change({ forward: ctx => removeActions(ctx, row.id), backward: ctx => addActions(ctx, row), name,
      says: { undo: 'undo.shortcutRemoved', redo: 'redo.shortcutRemoved' } });
    if (done) notice(t('sc.removed', { name }));
    return done;
  }

  // Écrit un changement, puis dépose de quoi le défaire : `forward` et `backward` rendent les actions d'après la table relue, `says` les deux phrases de
  // l'annulation et du rétablissement. `phase` : null pour le geste lui-même, 'undo' ou 'redo' quand c'est la pile qui le rejoue (elle attend alors une
  // phrase).
  #change(change, phase = null) {
    const { t, notice, queue, undoStack, refresh, rangement } = this.#o;
    const deposit = undoStack.later();
    return queue(async () => {
      try {
        if (!(await rangement.writeShortcuts(change.forward))) {
          if (!rangement.identity) notice(t('sc.noAddress'));
          return phase ? null : false;
        }
      } catch (error) {
        if (error instanceof TableDeclined) { notice(t('ex.filingDeclined')); return phase ? null : false; }
        console.warn('GFS : le raccourci n’a pas pu être enregistré', error);
        notice(t('sc.failed', { reason: reasonOf(error) }));
        return phase ? null : false;
      }
      const back = { ...change, forward: change.backward, backward: change.forward };
      deposit({ run: () => this.#change(back, phase === 'undo' ? 'redo' : 'undo') });
      await refresh({ quiet: true });
      return phase ? t(change.says[phase], { name: change.name }) : true;
    });
  }
}
