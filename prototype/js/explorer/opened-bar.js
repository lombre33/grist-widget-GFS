// Le 5e bouton de la barre : les fichiers ouverts (js/explorer/opened-files.js), à portée d'un clic sans repasser par l'explorateur (contrats 5.2 point 7 et
// 6.4 point 14). La liste va du plus récent au plus ancien (le dernier fichier ouvert en tête : le va-et-vient entre deux fichiers reste aux mêmes places) ; le
// fichier que l'app affiche est marqué (gras, trait et mot, jamais une couleur seule), un clic sur un autre fichier l'ouvre comme dans l'explorateur, la croix
// (ou Suppr) le retire de la liste sans le fermer (celle du fichier que l'app affiche est grisée : retirer de la liste ce que l'app montre n'a pas de
// sens, et son clic le dit), « Rechercher un fichier… » ouvre un fichier d'après son nom sans repasser par l'explorateur (à la place du fichier affiché, ou
// dans
// un nouvel onglet : le fichier affiché reste alors dans la liste), et « Ouvrir un autre fichier… » montre l'explorateur. Pas de couleur par type ici : elle
// est réservée à
// l'explorateur (charte). Sans fichier ouvert le bouton est grisé, jamais masqué, et son menu dit pourquoi.

import { pickFrom } from '../ui/pick-window.js';

// Les fichiers ouverts qui sont encore là (un fichier renommé y est à jour, un fichier disparu n'y est plus), du plus récent au plus ancien.
export function openedList(keys, files) {
  const live = new Map(files.map(file => [file.key, file]));
  return [...keys].reverse().map(key => live.get(key)).filter(Boolean);
}

// Les articles du menu : le titre, un article par fichier, un séparateur, puis « Ouvrir un autre fichier… ».
// `shownKey` : le fichier que l'app affiche (il ne se rouvre pas, le clic referme seulement le menu) ; `onOpen(file)`, `onDrop(file, rang)`, `onFind()`,
//   `onMore()` : les gestes ; `notice(text)` : la phrase d'un article grisé.
export function openedItems({ t, list, shownKey, appName, onOpen, onDrop, onFind, onMore, notice }) {
  const files = list.length
    ? list.map((file, at) => {
      const name = file.name || t('ex.untitled');
      const app = appName(file.app);
      const shown = file.key === shownKey;
      return {
        label: name, icon: file.icon, hint: app, title: `${name} · ${app}`, current: shown ? t('ex.shown') : null,
        run: () => { if (!shown) onOpen(file); },
        // La croix du fichier que l'app affiche reste, grisée : son clic dit pourquoi elle ne retire rien.
        drop: { label: t('dock.openedDropName', { name }), greyed: shown, run: shown ? () => notice(t('dock.openedShownWhy')) : () => onDrop(file, at) },
      };
    })
    : [{ label: t('dock.openedNone'), icon: 'stack', greyed: true, run: () => notice(t('dock.openedWhy')) }];
  return [{ heading: t('dock.opened') }, ...files, '-', { label: t('dock.openedFind'), icon: 'search', run: onFind },
    { label: t('dock.openedMore'), icon: 'plus', run: onMore }];
}

// Le lien entre la barre, la liste des fichiers ouverts et le reste de GFS : tient le nombre du bouton à jour et ouvre le menu.
// opts : { opened (js/explorer/opened-files.js), files() (les fichiers vivants), session() (l'app active), dock (js/shell/dock.js), t, appName,
//   open(file) (rend la promesse de `true` quand le fichier s'est ouvert : js/broker/openings.js `openFile`), showExplorer(), notice(text),
//   container() et inertTargets() (la fenêtre de recherche), pick (la liste avec recherche : js/ui/pick-window.js par défaut) }
export class OpenedBar {
  #opts;

  constructor(opts) {
    this.#opts = opts;
    opts.opened.onChange(() => this.sync());
  }

  list() { return openedList(this.#opts.opened.keys(), this.#opts.files()); }

  // Le nombre sur le bouton : à rappeler quand la liste, ou les fichiers vivants, changent.
  sync() { this.#opts.dock.setOpened(this.list().length); }

  // Ouvre le menu sous le bouton ; `start` : le rang de l'article qui prend le clavier (après un retrait, celui qui prend la place de la ligne partie).
  show(start = null) {
    const { opened, session, dock, t, appName, open, showExplorer, notice } = this.#opts;
    const items = openedItems({
      t, list: this.list(), shownKey: opened.shown(session()), appName, onOpen: open, onFind: () => void this.find(), onMore: showExplorer, notice,
      onDrop: (file, at) => { opened.remove(file.key); this.show(at); },
    });
    dock.showOpened(items, start);
  }

  // « Rechercher un fichier… » : la liste avec recherche de tous les fichiers vivants (par leur nom), sans repasser par l'explorateur. Un clic ou Entrée
  // l'ouvre à la place du fichier affiché, le « + » de la ligne (Ctrl+Entrée) dans un nouvel onglet.
  async find() {
    const { opened, session, files, t, appName, container, inertTargets, pick = pickFrom } = this.#opts;
    const all = files();
    const choice = await pick({
      container: container(), inertTargets, t, title: t('dock.findTitle'), text: t('dock.findText'), current: opened.shown(session()), none: t('dock.findNone'),
        quick: true,
      items: all.map(file => ({ value: file.key, label: file.name || t('ex.untitled'), glyph: file.icon, hint: appName(file.app) })),
      alt: { icon: 'tab-plus', label: item => t('dock.findNewTab', { name: item.label }) },
    });
    const file = choice && all.find(item => item.key === choice.value);
    if (file) await this.openFound(file, choice.alt);
  }

  // Ouvre `file` : dans l'onglet actif, il prend la place du fichier affiché (celui-ci sort de la liste, mais seulement quand le nouveau s'est bien ouvert : un
  // refus ou une annulation dans l'app ne change rien) ; dans un nouvel onglet, le fichier affiché reste dans la liste. Le fichier déjà affiché ne se rouvre
  // pas.
  async openFound(file, newTab) {
    const { opened, session, open } = this.#opts;
    const previous = opened.shown(session());
    if (previous === file.key) return;
    await open(file);
    if (!newTab && previous && opened.keys().includes(file.key)) opened.remove(previous);
  }
}
