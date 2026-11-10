// La liste de l'explorateur quand elle est longue (carte « Afficher seulement les lignes visibles » de l'audit vitesse et poids du 10/11, faits vérifiés 87) : à partir de `WINDOW_FROM` lignes (ou
// vignettes), seules celles qu'on voit, et quelques-unes de part et d'autre, sont construites ; l'espace des autres est tenu par le remplissage du conteneur (`padding-top` et `padding-bottom`), donc la
// barre de défilement, les sauts (Fin, Début) et la position gardée au redessin sont ceux d'une liste entière. Mesuré : 20 036 fichiers = 361 000 nœuds, 10,7 s et 2,4 Go avant ; le même nombre de lignes à
// l'écran après, quel que soit le nombre de fichiers.
//
// Ce que cela suppose, et que ce module mesure au lieu de le supposer : toutes les lignes ont la même hauteur (la liste : 28 px, 37 px en accessibilité renforcée ; les vignettes : celles de la grille, dont le
// nom réserve deux lignes, css/explorer.css `.is-windowed`), et la grille garde le même nombre de colonnes (relu à chaque changement de taille). Le reste de l'explorateur (clavier, sélection, glisser-déposer)
// ne lit plus le DOM pour savoir ce que la liste contient : il lit ses données (`#keys`), et demande ici `reveal(index)` pour avoir l'élément d'une ligne qui n'est peut-être pas construite.

// À partir de ce nombre de lignes, la liste est fenêtrée ; en dessous, elle est construite entière, comme avant.
export const WINDOW_FROM = 200;
// Les rangées construites au-delà de chaque bord de l'écran (le défilement à la molette en saute plusieurs par image).
const OVERSCAN_ROWS = 8;
// Les éléments construits avant la première mesure (une grille de 30 colonnes de 112 px en montrerait deux rangées).
const FIRST_BATCH = 64;
// Avant la première mesure : la hauteur d'une ligne de liste.
const DEFAULT_ROW = 28;

// Ce qu'il faut construire : { from, to, before, after } d'après la position du défilement (`scrollTop`), la hauteur visible (`viewport`), le haut de la première rangée dans le contenu (`offset`), la hauteur d'une rangée
// (`rowH`), le nombre d'éléments par rangée (`perRow`) et le nombre d'éléments (`count`). `from` et `to` sont des index d'éléments (`to` exclu, toujours un début de rangée ou `count`) ; `before` et `after` la
// hauteur des rangées qu'on ne construit pas, au-dessus et au-dessous.
export function windowRange({ scrollTop, viewport, offset, rowH, perRow, count, overscan = OVERSCAN_ROWS }) {
  const rows = Math.ceil(count / perRow);
  const last = Math.min(rows, Math.max(0, Math.ceil((scrollTop + viewport - offset) / rowH)) + overscan);
  const first = Math.min(Math.max(0, Math.floor((scrollTop - offset) / rowH) - overscan), Math.max(0, last - 1 - overscan));
  return { from: first * perRow, to: Math.min(count, last * perRow), before: first * rowH, after: (rows - last) * rowH };
}

// Le défilement qui montre l'élément `index` en entier, ou `scrollTop` quand il l'est déjà : `sticky` est la hauteur de l'en-tête collé en haut (il couvre le haut de ce qu'on voit).
export function scrollToReveal({ scrollTop, viewport, offset, rowH, perRow, sticky = 0, index }) {
  const top = offset + Math.floor(index / perRow) * rowH;
  if (top < scrollTop + sticky) return Math.max(0, top - sticky);
  if (top + rowH > scrollTop + viewport) return top + rowH - viewport;
  return scrollTop;
}

const range = (from, to) => Array.from({ length: Math.max(0, to - from) }, (unused, i) => from + i);

export class RowWindow {
  #scroll;
  #list;
  #opts;
  #body = null;
  #build = null;
  #count = 0;
  #from = 0;
  #to = 0;
  #geometry = { rowH: DEFAULT_ROW, perRow: 1, offset: 0, sticky: 0, pad: 0 };
  #stale = false; // un dessin a été remis à plus tard (un glissement tient une ligne)
  #observer = null;
  #head = null;

  // opts : { scroll (le conteneur qui défile), list (la grille : elle garde le clavier), onPaint() (appelé après chaque dessin : l'explorateur remet l'ordre de tabulation et ce qui se glisse),
  //          held() -> bool (un glissement en cours : les lignes ne bougent pas avant sa fin), }
  constructor(opts) {
    this.#opts = { held: () => false, onPaint: () => {}, ...opts };
    this.#scroll = opts.scroll;
    this.#list = opts.list;
    this.#scroll.addEventListener('scroll', () => this.paint(), { passive: true });
    const View = this.#scroll.ownerDocument.defaultView;
    if (View && typeof View.ResizeObserver === 'function') this.#observer = new View.ResizeObserver(() => this.#resized());
    if (this.#observer) this.#observer.observe(this.#scroll);
  }

  get active() { return this.#body !== null; }

  // Fenêtre la liste : `body` est le conteneur des éléments (rempli ici), `count` leur nombre, `build(index)` rend l'élément `index`, `head` l'en-tête collé en haut (ou null),
  // `rowIndexFrom` le numéro de rangée de la première ligne pour les lecteurs d'écran (`aria-rowindex`), ou null (les vignettes).
  mount({ body, count, build, head = null, rowIndexFrom = null }) {
    this.#body = body;
    this.#head = head;
    this.#count = count;
    this.#from = 0;
    this.#to = 0;
    this.#build = rowIndexFrom === null ? build : index => { const element = build(index); element.setAttribute('aria-rowindex', String(index + rowIndexFrom)); return element; };
    this.#scroll.style.overflowAnchor = 'none'; // le navigateur ne doit pas « corriger » un défilement que ce module tient
    if (rowIndexFrom === null) this.#list.removeAttribute('aria-rowcount'); else this.#list.setAttribute('aria-rowcount', String(count + rowIndexFrom - 1));
    this.#list.replaceChildren(...(head ? [head, body] : [body]));
    body.style.paddingTop = '';
    body.style.paddingBottom = '';
    this.#geometry.pad = parseFloat(this.#list.ownerDocument.defaultView.getComputedStyle(body).paddingTop) || 0;
    this.#fill(0, Math.min(count, FIRST_BATCH));
    this.#measure();
    this.paint(true);
  }

  // La liste n'est plus fenêtrée (elle est courte, ou une autre vue la remplace).
  release() {
    if (!this.#body) return;
    this.#body = null;
    this.#scroll.style.overflowAnchor = '';
    this.#list.removeAttribute('aria-rowcount');
  }

  // Remesure la hauteur d'une rangée, le nombre de colonnes et le haut des rangées d'après ce qui est construit (au pixel près : des rangées de 36,5 px, comptées par milliers, ne se mesurent pas à l'entier).
  // Sans effet quand la liste est cachée (rien n'a de taille).
  #measure() {
    const body = this.#body;
    const tops = Array.from(body.children, element => element.getBoundingClientRect().top);
    if (!this.#scroll.clientHeight || tops.length < 2) return;
    const g = this.#geometry;
    g.perRow = Math.max(1, tops.filter(top => Math.abs(top - tops[0]) < 1).length);
    if (tops.length > g.perRow) g.rowH = tops[g.perRow] - tops[0];
    g.sticky = this.#head ? this.#head.offsetHeight : 0;
    g.offset = body.getBoundingClientRect().top - this.#scroll.getBoundingClientRect().top + this.#scroll.scrollTop + g.pad;
  }

  // Construit les éléments [from, to) à la place de ceux qui sont là : on garde ceux qui restent dans la fenêtre.
  #fill(from, to) {
    const body = this.#body;
    const kept = from < this.#to && to > this.#from && this.#to > this.#from;
    if (!kept) {
      body.replaceChildren(...range(from, to).map(this.#build));
    } else {
      for (let i = this.#from; i < Math.min(from, this.#to); i++) body.firstElementChild.remove();
      for (let i = this.#to; i > Math.max(to, this.#from); i--) body.lastElementChild.remove();
      if (from < this.#from) body.prepend(...range(from, Math.min(this.#from, to)).map(this.#build));
      if (to > this.#to) body.append(...range(Math.max(this.#to, from), to).map(this.#build));
    }
    this.#from = from;
    this.#to = to;
  }

  // La fenêtre à la position du défilement. `force` : même quand un glissement tient une ligne (le clavier la demande).
  paint(force = false) {
    if (!this.#body) return;
    if (this.#opts.held() && !force) { this.#stale = true; return; }
    this.#stale = false;
    const g = this.#geometry;
    const next = windowRange({ scrollTop: this.#scroll.scrollTop, viewport: this.#scroll.clientHeight, offset: g.offset, rowH: g.rowH, perRow: g.perRow, count: this.#count });
    const body = this.#body;
    const active = body.ownerDocument.activeElement;
    const hadFocus = Boolean(active && body.contains(active));
    if (next.from !== this.#from || next.to !== this.#to) this.#fill(next.from, next.to);
    body.style.paddingTop = `${g.pad + next.before}px`;
    body.style.paddingBottom = `${g.pad + next.after}px`;
    // La ligne qui avait le clavier est partie avec la fenêtre : le clavier reste à la liste (les flèches y répondent d'après les données), il ne tombe pas sur la page.
    if (hadFocus && !body.contains(active)) this.#list.focus({ preventScroll: true });
    this.#opts.onPaint();
  }

  // La taille a changé : le nombre de colonnes des vignettes aussi. On remesure sur ce qui est construit, puis on dessine ; si le nombre de colonnes a bougé, on reprend du début (les rangées construites ne
  // commencent plus au bon élément).
  #resized() {
    if (!this.#body || this.#opts.held() || !this.#scroll.clientHeight) return;
    const before = this.#geometry.perRow;
    this.#measure();
    if (this.#geometry.perRow !== before) {
      this.#from = this.#to = 0;
      this.#fill(0, Math.min(this.#count, FIRST_BATCH));
      this.#measure();
    }
    this.paint(true);
  }

  // Un glissement fini : le dessin remis à plus tard se fait.
  settle() { if (this.#stale) this.paint(); }

  // L'élément `index`, construit et amené à l'écran ; null quand la liste n'est pas fenêtrée ou que l'index n'y est pas.
  reveal(index) {
    if (!this.#body || index < 0 || index >= this.#count) return null;
    const g = this.#geometry;
    const to = scrollToReveal({ scrollTop: this.#scroll.scrollTop, viewport: this.#scroll.clientHeight, offset: g.offset, rowH: g.rowH, perRow: g.perRow, sticky: g.sticky, index });
    if (to !== this.#scroll.scrollTop) this.#scroll.scrollTop = to;
    this.paint(true);
    return this.#body.children[index - this.#from] || null;
  }
}
