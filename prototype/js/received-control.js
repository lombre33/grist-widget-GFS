// « Partagés avec moi » dans l'explorateur : ce que la vue demande (js/explorer.js) pour les fichiers reçus d'un autre document Grist (js/received-files.js). Une arrivée « à accepter » est grisée : son clic ouvre la
// fenêtre qui demande un oui ou un non (js/received-window.js) ; une arrivée acceptée se lit comme un PDF de GFS (js/kept-files.js la reconnaît). Les marques s'écrivent seulement après ce geste, par OwnTable : GFS
// n'ajoute ses deux colonnes que sur la table reçue, et ne crée aucune table.
import { PENDING, answerFile, answerFolder } from './received-files.js';
import { openAnswer } from './received-window.js';
import { formatBytes } from './weight.js';
import { person } from './explorer-model.js';

export class ReceivedControl {
  #opts;

  // opts : { port ({ doc }), t(clé, vars), locale(), container, inertTargets(), typeLabel(fichier) (le nom du type d'un fichier d'ailleurs), notice(texte), blocked() -> la phrase qui dit pourquoi rien ne s'écrit, ou null,
  //          refresh() -> Promise (relire la liste après la réponse), open(fichier) (lire un fichier accepté : js/openings.js), answerFile?, answerFolder?, window? (la fenêtre de la question : les essais les remplacent) }
  constructor(opts) { this.#opts = { answerFile, answerFolder, window: openAnswer, ...opts }; }

  // Le grisé d'une arrivée à accepter : le fichier est dans le document, nulle app ne le voit tant qu'il n'est pas accepté.
  lockOf = file => (file.received && file.received.state === PENDING ? { text: this.#opts.t('rx.lock'), hint: this.#opts.t('rx.pending') } : null);

  // Le mot du type : « À accepter » pour une arrivée en attente, sinon le type du fichier (le mot et la couleur du type vont ensemble, charte).
  typeLabel = file => (file.received.state === PENDING ? this.#opts.t('rx.pending') : this.#opts.typeLabel(file));

  // Le geste principal d'une arrivée en attente (le bouton « Ouvrir » de l'explorateur, l'article du menu) ; les arrivées acceptées se lisent comme les PDF de GFS : null les laisse à js/kept-files.js.
  openAs = file => (file.received && file.received.state === PENDING ? { label: this.#opts.t('rx.answer.menu'), icon: 'open', greyed: false } : null);

  // Entrée, double clic, « Ouvrir » : répondre à une arrivée, ou lire un fichier accepté.
  activate(file) {
    if (file.received.state === PENDING) void this.ask(file); else this.#opts.open(file);
  }

  // Le menu d'une ligne de « Partagés avec moi » : le geste principal d'un fichier accepté se lit dans les articles que js/explorer.js tient de js/kept-files.js ; ici, celui d'une arrivée en attente.
  menu(file) {
    const { t } = this.#opts;
    return file.received.state === PENDING ? [{ label: t('rx.answer.menu'), icon: 'open', hint: t('key.enter'), run: () => void this.ask(file) }] : null;
  }

  // La question : un oui ou un non, pour ce fichier seulement. Rend 'accept', 'refuse' ou null (Échap : rien n'est écrit). La liste est relue après un oui ou un non.
  async ask(file) {
    const { t, locale, notice, blocked, refresh, container, inertTargets } = this.#opts;
    const why = blocked();
    if (why) { notice(why); return null; }
    const name = file.name || t('ex.untitled');
    const by = person(file.by).name;
    const who = by || t('rx.who.unknown');
    const answer = await this.#opts.window({
      container, t, inertTargets, who, name, size: formatBytes(file.weight, locale(), t),
      title: t('rx.answer.title', { name }), sub: by ? t('rx.answer.sub', { by }) : t('rx.answer.subUnknown'),
      answer: async accepted => {
        if (!(await this.#opts.answerFile(this.#opts.port, file, accepted))) throw new Error(t('rx.answer.gone'));
      },
    });
    if (answer) { notice(t(answer === 'accept' ? 'rx.accepted' : 'rx.refused', { name })); await refresh(); }
    return answer;
  }

  // La question d'un DOSSIER reçu (`folder` : js/received-folders.js) : un oui ou un non pour tous ses fichiers à accepter, écrit en une seule action. Rend 'accept', 'refuse' ou null (Échap : rien n'est écrit).
  async askFolder(folder) {
    const { t, locale, notice, blocked, refresh, container, inertTargets } = this.#opts;
    const why = blocked();
    if (why) { notice(why); return null; }
    const waiting = folder.files.filter(file => file.received.state === PENDING);
    const by = person(folder.by).name;
    const who = by || t('rx.who.unknown');
    const vars = { who, name: folder.name, n: waiting.length, size: formatBytes(waiting.reduce((total, file) => total + (file.weight || 0), 0), locale(), t) };
    const answer = await this.#opts.window({
      container, t, inertTargets, who, name: folder.name, size: vars.size, title: t('rx.folder.title', vars), sub: by ? t('rx.answer.sub', { by }) : t('rx.answer.subUnknown'),
      text: t('rx.folder.text', vars), keep: t('rx.folder.keep'), foot: t('rx.folder.foot'),
      answer: async accepted => {
        if (!(await this.#opts.answerFolder(this.#opts.port, folder, accepted))) throw new Error(t('rx.folder.gone'));
      },
    });
    if (answer) { notice(t(answer === 'accept' ? 'rx.folder.accepted' : 'rx.folder.refused', vars)); await refresh(); }
    return answer;
  }
}
