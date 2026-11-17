// La fenêtre « Apps et extensions » (cahier 6, contrats 7.3), en vitrine (décisions du porteur, 17/11 : « A · Vitrine » pour la mosaïque, « A · Page produit »
// pour la
// fiche) : une mosaïque de cartes, une par app, avec sa capture, son texte et un bouton « Installer » ou « Ouvrir » ; un clic sur le nom ou la capture ouvre sa
//   fiche, une page qui se lit de haut en bas (fiche.js : le bandeau et son bouton, les captures, les extensions en cartes, le choix des bibliothèques). Les
//   choix s'enregistrent tout de suite, pour tout le document (7.4) ; quand ils ne peuvent pas, les boutons et les cases sont grisés avec la raison. Une
//   fenêtre sur une seule base : titre et boutons fixes, le contenu défile. Elle ne décide rien : chaque geste est rendu au contrôleur, qui écrit la table et
//   recalcule ce qu'elle montre. Elle s'ouvre par trois portes (maquette du 12/10) : une fonction grisée (la fiche de l'app, sur la carte de l'extension), les
//   réglages de la vue dans Grist, le premier lancement.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, tabStops } from '../ui/modal.js';
import { appCard, vitrineOf } from './vitrine.js';
import { hero, miniBar, strip, about, extensions, libraries } from './fiche.js';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), summary, [tabindex="0"]';

// La clé d'une ligne : ce que `open({ focus })` reçoit pour amener la fenêtre sur un module.
export const rowKey = (app, extension = null) => (extension ? `ext:${app}/${extension}` : `app:${app}`);

// « Ouvrir » et « Installer » se remplacent (un refus de créer la table remet « Installer » à la place d'« Ouvrir », mesuré le 17/11 dans un vrai Grist) : le
// clavier suit l'autre bouton, celui du bandeau ou celui de la barre du haut (`mini-`).
const otherKey = (key) => {
  const found = key && /^(mini-)?(open|app):(.*)$/.exec(key);
  return found ? `${found[1] || ''}${found[2] === 'open' ? 'app' : 'open'}:${found[3]}` : null;
};

export class ModulesWindow {
  #opts;
  #root = null;
  #win = null;
  #head = null;
  #body = null;
  #mounted = null; // { opener, unmount } de la fenêtre ouverte (modal.js, mountWindow)
  #openNatives = new Set(); // les apps dont le détail « fonction par fonction » est déplié : il le reste d'un dessin à l'autre
  #view = 'grid'; // 'grid' : la mosaïque ; 'fiche' : la fiche de `#current`
  #current = null;
  #gridTop = 0; // où la mosaïque défilait quand on a ouvert une fiche
  #screen = null; // l'écran dessiné en dernier : un nouveau dessin du même écran garde le défilement
  #want = null; // le prochain élément à qui rendre le clavier (le bouton « Ouvrir » qui prend la place d'« Installer »)
  #mini = false; // le bouton du bandeau est sorti de l'écran : la barre du haut prend le nom et le bouton
  #watcher = null; // l'observateur qui le dit
  #flashTimer = 0;

  // opts : { container, i18n, locale, model(), blocked(), inertTargets(), on: { app(id, on), extension(app, id, on), mode(app, id, mode), nativeMode(app,
  //   group, mode), open(app) },
  //   onClose() }
  // `blocked()` : la raison pour laquelle rien ne peut s'enregistrer (texte), ou null.
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#root !== null; }
  // Le fond de la fenêtre, pour qu'une question posée par-dessus (ask-window.js) le rende inerte.
  get element() { return this.#root; }

  open({ focus = null } = {}) {
    if (focus) this.#goTo(focus);
    if (!this.#root) {
      this.#root = this.#build();
      this.#mounted = mountWindow({ container: this.#opts.container, root: this.#root, inertTargets: () => this.#opts.inertTargets(),
        onKey: event => this.#keydown(event) });
    }
    this.refresh();
    this.#reveal(focus);
  }

  close() {
    if (!this.#root) return;
    const { opener, unmount } = this.#mounted;
    unmount();
    clearTimeout(this.#flashTimer);
    this.#watcher?.disconnect();
    this.#watcher = null;
    this.#root = null;
    this.#mounted = null;
    this.#view = 'grid';
    this.#current = null;
    this.#screen = null;
    this.#mini = false;
    giveBackFocus(opener);
    this.#opts.onClose();
  }

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes et se redessine, une fenêtre fermée prendra les nouveaux à son ouverture.
  relocalize({ i18n, locale }) {
    this.#opts = { ...this.#opts, i18n, locale };
    if (!this.#root) return;
    this.#root.querySelector('[data-fk="close"]').textContent = i18n.t('mod.close');
    this.refresh();
  }

  // Redessine l'écran d'après le modèle, en gardant le défilement et l'élément qui avait le clavier.
  refresh() {
    if (!this.#root) return;
    const { t } = this.#opts.i18n;
    const model = this.#opts.model();
    const doc = this.#root.ownerDocument;
    const kept = doc.activeElement && this.#root.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const blocked = this.#opts.blocked();
    const app = this.#view === 'fiche' ? model.items.find(item => item.kind === 'app' && item.id === this.#current) : null;
    if (!app) this.#view = 'grid';
    const screen = app ? `fiche:${app.id}` : 'grid';
    const same = screen === this.#screen;
    if (!same) this.#mini = false;
    const top = same ? this.#body.scrollTop : (app ? 0 : this.#gridTop);
    this.#paint(app, model, blocked);
    this.#body.scrollTop = top;
    this.#screen = screen;
    this.#root.querySelector('.mod-note').textContent = blocked !== null ? blocked : t('mod.saved');
    this.#watch();
    this.#restoreFocus(kept);
  }

  // Le haut et le corps de l'écran : la mosaïque (`app` nul) ou la fiche de `app`.
  #paint(app, model, blocked) {
    const { t } = this.#opts.i18n;
    const ctx = this.#ctx();
    this.#win.classList.toggle('is-fixed', app !== null);
    this.#head.className = app ? `mod-head fp-head${this.#mini ? ' is-mini' : ''}` : 'mod-head';
    this.#head.replaceChildren(...(app ? this.#ficheHead(ctx, app, blocked) : [h('h2', { id: 'mod-title' }, t('mod.title')), this.#count(model)]));
    this.#body.className = app ? 'mod-body fp-body' : 'mod-body ap-body';
    this.#body.replaceChildren(app ? this.#fiche(ctx, app, model, blocked) : this.#grid(ctx, model, blocked));
  }

  // ---------- la structure ----------

  #build() {
    const { t } = this.#opts.i18n;
    this.#head = h('header', { class: 'mod-head' });
    this.#body = h('div', { class: 'mod-body ap-body' });
    this.#win = h('section', { class: 'mod ap-win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mod-title' }, this.#head, this.#body,
      h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note', 'aria-live': 'polite' }),
        h('button', { type: 'button', class: 'btn', dataset: { fk: 'close' }, on: { click: () => this.close() } }, t('mod.close'))));
    const root = h('div', { class: 'mod-scrim' }, this.#win);
    this.#body.addEventListener('change', event => this.#onChange(event));
    this.#body.addEventListener('toggle', (event) => {
      const app = event.target.dataset && event.target.dataset.nativesOf;
      if (!app) return;
      if (event.target.open) this.#openNatives.add(app); else this.#openNatives.delete(app);
    }, true);
    root.addEventListener('click', event => this.#onClick(event));
    return root;
  }

  #ctx() {
    const { t, lang } = this.#opts.i18n;
    return { t, lang, badge: kind => this.#badge(kind), key: rowKey, size: kilobytes => this.#size(kilobytes) };
  }

  // Les gestes de la vitrine, par `data-act` : ouvrir la fiche ou revenir, installer, retirer, ouvrir l'app, ajouter ou retirer une extension, faire défiler
  // les captures, aller aux extensions. Un bouton grisé (`aria-disabled`) dit pourquoi dans le pied de la fenêtre et ne fait rien d'autre.
  #onClick(event) {
    const node = event.target.closest('[data-act]');
    if (!node || !this.#root.contains(node)) return;
    const { act, id } = node.dataset;
    const { on } = this.#opts;
    if (act === 'show') this.#show(id);
    else if (act === 'back') this.#back();
    else if (act === 'open') { this.close(); on.open(id); }
    else if (act === 'strip') this.#scrollStrip(Number(node.dataset.dir));
    else if (act === 'ext') this.#body.querySelector('.fp-exts').scrollIntoView({ block: 'start' });
    else if (node.getAttribute('aria-disabled') === 'true') this.#flash(node.dataset.reason);
    else if (act === 'install') { this.#want = `${node.dataset.fk.startsWith('mini-') ? 'mini-' : ''}open:${id}`; on.app(id, true); }
    else if (act === 'remove') { this.#want = `${node.dataset.fk.startsWith('mini-') ? 'mini-' : ''}${rowKey(id)}`; on.app(id, false); }
    else if (act === 'extension') on.extension(node.dataset.parent, node.dataset.ext, node.dataset.on === 'true');
  }

  #show(id) {
    this.#gridTop = this.#body.scrollTop;
    this.#view = 'fiche';
    this.#current = id;
    this.#want = 'back';
    this.refresh();
  }

  #back() {
    this.#want = `name:${this.#current}`;
    this.#view = 'grid';
    this.refresh();
  }

  // Les boutons ronds des captures : la bande défile de la plupart de sa largeur ; une personne qui préfère moins de mouvement la voit sauter.
  #scrollStrip(dir) {
    const scroller = this.#body.querySelector('.fp-strip');
    if (!scroller) return;
    let still = false;
    try { still = this.#root.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { /* le mouvement reste */ }
    scroller.scrollBy({ left: dir * Math.max(200, scroller.clientWidth * 0.7), behavior: still ? 'auto' : 'smooth' });
  }

  // La barre du haut prend le nom et le bouton de l'app quand ceux du bandeau sortent par le haut de la page (jamais quand la page n'a pas encore défilé).
  #watch() {
    this.#watcher?.disconnect();
    this.#watcher = null;
    const cta = this.#body.querySelector('[data-hero="cta"]');
    const Observer = this.#root.ownerDocument.defaultView.IntersectionObserver;
    if (!cta || !Observer) return;
    this.#watcher = new Observer(([entry]) => {
      this.#mini = !entry.isIntersecting && entry.boundingClientRect.bottom < entry.rootBounds.top + 4;
      this.#head.classList.toggle('is-mini', this.#mini);
    }, { root: this.#body, threshold: 0 });
    this.#watcher.observe(cta);
  }

  // La phrase d'un bouton grisé, dans le pied : elle reste un instant, puis le pied reprend sa phrase.
  #flash(text) {
    const { t } = this.#opts.i18n;
    const note = this.#root.querySelector('.mod-note');
    note.textContent = text;
    clearTimeout(this.#flashTimer);
    this.#flashTimer = setTimeout(() => {
      const again = this.#root && this.#root.querySelector('.mod-note');
      if (again) again.textContent = this.#opts.blocked() ?? t('mod.saved');
    }, 2600);
  }

  // Les portes qui visent un module : une extension ouvre la fiche de son app ; une app, la mosaïque.
  #goTo(focus) {
    if (focus.startsWith('ext:')) {
      this.#view = 'fiche';
      this.#current = focus.slice(4).split('/')[0];
    } else this.#view = 'grid';
  }

  #restoreFocus(kept) {
    const wanted = this.#want;
    this.#want = null;
    const nodes = [...this.#root.querySelectorAll('[data-fk]')];
    const find = key => key && nodes.find(node => node.dataset.fk === key && !node.disabled && node.getClientRects().length);
    const target = find(wanted) || find(kept) || find(otherKey(kept));
    if (target) target.focus({ preventScroll: true });
  }

  #keydown(event) {
    if (!this.#root || this.#root.inert) return; // une question posée par-dessus (ask-window.js) a le clavier
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.#view === 'fiche') this.#back(); else this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    // Tab et Maj+Tab tournent dans la fenêtre, d'après les arrêts visibles (un groupe de boutons radio n'en a qu'un) : l'ordre ne dépend pas du point de départ
    // que Firefox garde d'une fenêtre fermée (mesuré le 17/11 : à la deuxième ouverture, Tab tournait entre deux boutons).
    const stops = tabStops([...this.#root.querySelectorAll(FOCUSABLE)].filter(node => node.getClientRects().length));
    if (!stops.length) return;
    const at = stops.indexOf(this.#root.ownerDocument.activeElement);
    const step = event.shiftKey ? -1 : 1;
    event.preventDefault();
    stops[at < 0 ? (step > 0 ? 0 : stops.length - 1) : (at + step + stops.length) % stops.length].focus();
  }

  #onChange(event) {
    const input = event.target;
    const { on } = this.#opts;
    if (input.dataset.modeFor) on.mode(input.dataset.parent, input.dataset.modeFor, input.value);
    else if (input.dataset.nativeAll) on.nativeMode(input.dataset.nativeAll, null, input.value);
    else if (input.dataset.nativeFor) on.nativeMode(input.dataset.parent, input.dataset.nativeFor, input.value);
  }

  // Où la fenêtre pose le clavier à l'ouverture : le bouton (« Ajouter » ou « Retirer ») de la carte de l'extension visée (contrats 5.4, `installer`) ou le
  // bouton de l'app visée, sinon le premier nom de la mosaïque.
  #reveal(focus) {
    const nodes = [...this.#root.querySelectorAll('[data-fk]')];
    const byKey = key => nodes.find(node => node.dataset.fk === key && !node.disabled && node.getClientRects().length);
    const card = focus && focus.startsWith('ext:') ? [...this.#root.querySelectorAll('.fp-ext')].find(node => node.dataset.row === focus) : null;
    const id = focus && focus.startsWith('app:') ? focus.slice(4) : null;
    const target = (card ? (card.querySelector('[data-act="extension"]') || card.querySelector(FOCUSABLE)) : id &&
      (byKey(rowKey(id)) || byKey(`open:${id}`) || byKey(`name:${id}`)))
      || this.#body.querySelector('[data-fk]:not([disabled])') || this.#root.querySelector('[data-fk="close"]');
    if (card) card.scrollIntoView({ block: 'nearest' });
    // La fenêtre peut s'ouvrir depuis Grist (réglages de la vue) : le clavier doit venir ici pour que Échap et Tab la servent.
    try { this.#root.ownerDocument.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
    target.focus({ preventScroll: true });
  }

  // ---------- la mosaïque et la fiche ----------

  #count(model) {
    const { t } = this.#opts.i18n;
    return h('p', { class: 'mod-count', 'aria-live': 'polite' }, h('strong', null, t('mod.count', { n: model.active, total: model.total })),
      ` · ${t('mod.countNote')}`);
  }

  // Pourquoi le bouton d'une app est grisé (le texte du pied), ou null : le manifeste est refusé, ou rien ne peut s'écrire.
  #why(item, blocked) {
    const { t } = this.#opts.i18n;
    return item.ok ? blocked : t('mod.invalid', { reasons: item.errors.join(' ; ') });
  }

  #grid(ctx, model, blocked) {
    return h('div', { class: 'ap-grid' }, ...model.items.filter(item => item.kind === 'app').map(item => appCard(ctx, item, this.#why(item, blocked))));
  }

  // L'en-tête de la fiche : revenir à la mosaïque ; puis, quand le bandeau de la page est sorti de l'écran, le nom et les boutons de l'app (`is-mini`).
  #ficheHead(ctx, app, blocked) {
    const { t } = ctx;
    return [h('button', { type: 'button', class: 'btn sm ap-back', dataset: { act: 'back', fk: 'back' } }, icon('chev-left'), t('ap.back')),
      ...miniBar(ctx, app, { reason: this.#why(app, blocked), blocked })];
  }

  // La fiche d'une app, de haut en bas : le bandeau, les captures, ce qu'elle dit d'elle, ses extensions, puis le choix des bibliothèques de l'app.
  #fiche(ctx, app, model, blocked) {
    const shown = vitrineOf(app.manifest, ctx.lang);
    const exts = model.items.filter(item => item.kind === 'ext' && item.app === app.id);
    const reason = this.#why(app, blocked);
    return h('div', { class: 'fp-page', dataset: { app: app.id } }, hero(ctx, app, { exts, reason, blocked }), strip(ctx, app, shown), about(ctx, app, shown),
      extensions(ctx, app, exts, { blocked, parent: app }),
      libraries(ctx, app, { enabled: app.ok && app.installed && blocked === null, open: this.#openNatives.has(app.id),
        installFirst: app.ok && app.natives.length > 0 && !app.installed && blocked === null }));
  }

  // ---------- les petits morceaux ----------

  #badge(kind) {
    const { t } = this.#opts.i18n;
    return h('span', { class: `badge ${kind}` }, kind === 'on' ? icon('check') : (kind === 'locked' ? icon('lock') : null), t(`mod.badge.${kind}`));
  }

  #size(kilobytes) {
    const { t } = this.#opts.i18n;
    const format = new Intl.NumberFormat(this.#opts.locale, { maximumFractionDigits: 1 });
    return kilobytes >= 1024 ? t('mod.sizeMb', { n: format.format(kilobytes / 1024) }) : t('mod.sizeKb', { n: format.format(Math.round(kilobytes)) });
  }
}
