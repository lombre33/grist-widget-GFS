// Le 5e bouton de la barre : les fichiers ouverts (js/explorer/opened-files.js), à portée d'un clic sans repasser par l'explorateur (contrats 5.2 point 7 et
// 6.4 point 14). La liste va du plus récent au plus ancien (le dernier fichier ouvert en tête : le va-et-vient entre deux fichiers reste aux mêmes places) ; le
// fichier que l'app affiche est marqué (gras, trait et mot, jamais une couleur seule), un clic sur un autre fichier l'ouvre comme dans l'explorateur, la croix
// (ou Suppr) le retire de la liste sans le fermer, et « Ouvrir un autre fichier… » montre l'explorateur. Pas de couleur par type ici : elle est réservée à
// l'explorateur (charte). Sans fichier ouvert le bouton est grisé, jamais masqué, et son menu dit pourquoi.

// Les fichiers ouverts qui sont encore là (un fichier renommé y est à jour, un fichier disparu n'y est plus), du plus récent au plus ancien.
export function openedList(keys, files) {
  const live = new Map(files.map(file => [file.key, file]));
  return [...keys].reverse().map(key => live.get(key)).filter(Boolean);
}

// Les articles du menu : le titre, un article par fichier, un séparateur, puis « Ouvrir un autre fichier… ».
// `shownKey` : le fichier que l'app affiche (il ne se rouvre pas, le clic referme seulement le menu) ; `onOpen(file)`, `onDrop(file, rang)`, `onMore()` : les
//   gestes ; `notice(text)` : la phrase d'un article grisé.
export function openedItems({ t, list, shownKey, appName, onOpen, onDrop, onMore, notice }) {
  const files = list.length
    ? list.map((file, at) => {
      const name = file.name || t('ex.untitled');
      const app = appName(file.app);
      return {
        label: name, icon: file.icon, hint: app, title: `${name} · ${app}`, current: file.key === shownKey ? t('ex.shown') : null,
        run: () => { if (file.key !== shownKey) onOpen(file); },
        drop: { label: t('dock.openedDropName', { name }), run: () => onDrop(file, at) },
      };
    })
    : [{ label: t('dock.openedNone'), icon: 'stack', greyed: true, run: () => notice(t('dock.openedWhy')) }];
  return [{ heading: t('dock.opened') }, ...files, '-', { label: t('dock.openedMore'), icon: 'plus', run: onMore }];
}

// Le lien entre la barre, la liste des fichiers ouverts et le reste de GFS : tient le nombre du bouton à jour et ouvre le menu.
// opts : { opened (js/explorer/opened-files.js), files() (les fichiers vivants), session() (l'app active), dock (js/shell/dock.js), t, appName, open(file),
//   showExplorer(),
//   notice(text) }
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
      t, list: this.list(), shownKey: opened.shown(session()), appName, onOpen: open, onMore: showExplorer, notice,
      onDrop: (file, at) => { opened.remove(file.key); this.show(at); },
    });
    dock.showOpened(items, start);
  }
}
