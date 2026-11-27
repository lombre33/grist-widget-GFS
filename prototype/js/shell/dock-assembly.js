// La barre de GFS au-dessus de l'app ouverte, et ce qui en dépend, montés pour le contrôleur (js/controller.js) : la barre (js/shell/dock.js), le bouton
// « LanguageTool », la ligne de travail (contrats 4.5) et la liste des fichiers ouverts. Sortis du contrôleur pour qu'il reste sous les 600 lignes de code de
// l'outil d'audit. Comme js/broker/entries.js, ce module reçoit le contrôleur et lui pose ce qu'il monte (`correcteurs`, `dock`, `langtool`, `workControl`,
// `openedBar`).

import { Dock } from './dock.js';
import { Correcteurs } from './correcteurs.js';
import { WorkControl } from '../apps/work-control.js';
import { OpenedBar } from '../explorer/opened-bar.js';
import { openAnnuaire } from './annuaire-entry.js';
import { openGuide } from './guide-entry.js';

// Le bouton « LanguageTool » (contrats 5.2, point 13) : le bouton de la barre coupe ou rallume ; la ligne du menu « Réglages » le met dans la barre ou l'en
// retire. Un navigateur qui refuse de retenir le choix le garde pour la page, et GFS le dit. Quand ce que les apps doivent faire change, l'app ouverte le sait
// (événement `correcteurs`).
//
// x : { correcteurs (js/shell/correcteurs.js), dock, session() (l'app ouverte, ou null), notice(texte), t }
export class LangtoolBar {
  #x;

  constructor(x) { this.#x = x; }

  toggle() {
    const x = this.#x;
    if (!x.correcteurs.toggleCut()) x.notice(x.t('lang.notKept'));
  }

  choose() {
    const x = this.#x;
    if (!x.correcteurs.setShown(!x.correcteurs.state.shown)) x.notice(x.t('lang.notKept'));
  }

  // L'état a changé (un geste, ou un autre onglet de la personne) : la barre le montre, et l'app ouverte n'est prévenue que si ce qu'elle doit faire a changé.
  sync(state, before) {
    const x = this.#x;
    x.dock.setLt(state);
    const session = x.session();
    if (state.coupes !== before.coupes && session) session.sendCorrecteurs({ coupes: state.coupes });
  }
}

// La barre au-dessus de l'app ouverte : ses boutons ouvrent l'explorateur et la fenêtre des apps ; quand ce qu'elle recouvre change, l'app ouverte le sait
// (événement `barre`, contrats 5.2, point 7).
export function buildDock(c) {
  c.correcteurs = new Correcteurs({ win: window }); // deux choix retenus sur ce navigateur, dits aux apps (js/shell/correcteurs.js, contrats 5.2, point 13)
  c.dock = new Dock({
    root: c.$('floaters'), stage: c.$('stage'), onFiles: () => c.showExplorer(), onOpened: () => c.openedBar.show(),
      onApps: () => void c.openModules(), onWork: () => void c.workControl.open(), onAnnuaire: () => void openAnnuaire(c), onGuide: () => void openGuide(c),
        onLt: () => c.langtool.toggle(),
    onNotKept: () => c.notice(c.t('lang.notKept')),
  });
  c.langtool = new LangtoolBar({ correcteurs: c.correcteurs, dock: c.dock, session: () => c.session, notice: text => c.notice(text), t: c.t });
  c.dock.setLt(c.correcteurs.state);
  c.correcteurs.onChange((state, before) => c.langtool.sync(state, before));
  // La ligne de travail (contrats 4.5) : une autre table rouvre l'app active, qui la reçoit dès son démarrage.
  c.workControl = new WorkControl({
    port: c.port, state: c.state, dock: c.dock, container: c.$('stage'), t: c.t, appName: c.appName, manifests: c.manifests,
    session: () => c.session, inertTargets: c.inertTargets, notice: text => c.notice(text),
    reopen: id => { c.closeSession(); c.activate(id, c.opening); }, hidden: () => c.doc.hidden,
  });
  // Le 5e bouton : les fichiers ouverts (js/explorer/opened-bar.js), qu'on retrouve d'un clic sans repasser par l'explorateur.
  c.openedBar = new OpenedBar({
    opened: c.opened, files: () => (c.explorer ? c.explorer.files : []), session: () => c.session, dock: c.dock, t: c.t,
      appName: c.appName,
    open: file => c.openings.openFile(file), showExplorer: () => c.showExplorer(), notice: text => c.notice(text),
    container: () => c.$('stage'), inertTargets: c.inertTargets,
  });
  c.dock.relabel(c.t);
  c.workControl.relabel();
  c.dock.onChange(barre => { if (c.session) c.session.sendBar(barre); });
}
