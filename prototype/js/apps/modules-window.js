// La fenêtre « Apps et extensions » (cahier 6, contrats 7.3), en vitrine (décision du porteur, 17/11, « A · Vitrine ») : une mosaïque de cartes, une par app,
// avec sa capture, son texte et un bouton « Installer » ou « Ouvrir » ; un clic sur le nom ou la capture ouvre sa fiche (galerie, description, choix des
// bibliothèques, extensions). Les choix s'enregistrent tout de suite, pour tout le document (7.4) ; quand ils ne peuvent pas, les boutons et les cases sont
// grisés avec la raison. Une fenêtre sur une seule base : titre et boutons fixes, le contenu défile. Elle ne décide rien : chaque geste est rendu au
// contrôleur, qui écrit la table et recalcule ce qu'elle montre. Elle s'ouvre par trois portes (maquette du 12/10) : une fonction grisée (la fiche de l'app,
// sur la ligne de l'extension), les réglages de la vue dans Grist, le premier lancement.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus, tabStops } from '../ui/modal.js';
import { label } from './manifest.js';
import { MODES, DEFAULT_MODE } from './libraries.js';
import { appCard, gallery, mainButton, vitrineOf, glyphOf, nameOf } from './vitrine.js';

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), summary';
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
let counter = 0;

// La clé d'une ligne : ce que `open({ focus })` reçoit pour amener la fenêtre sur un module.
export const rowKey = (app, extension = null) => (extension ? `ext:${app}/${extension}` : `app:${app}`);

export class ModulesWindow {
  #opts;
  #root = null;
  #head = null;
  #body = null;
  #mounted = null; // { opener, unmount } de la fenêtre ouverte (modal.js, mountWindow)
  #ids = new Map();
  #openNatives = new Set(); // les apps dont le détail « fonction par fonction » est déplié : il le reste d'un dessin à l'autre
  #view = 'grid'; // 'grid' : la mosaïque ; 'fiche' : la fiche de `#current`
  #current = null;
  #shot = 0; // la capture que la fiche montre en grand
  #gridTop = 0; // où la mosaïque défilait quand on a ouvert une fiche
  #screen = null; // l'écran dessiné en dernier : un nouveau dessin du même écran garde le défilement
  #want = null; // le prochain élément à qui rendre le clavier (le bouton « Ouvrir » qui prend la place d'« Installer »)
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
    this.#root = null;
    this.#mounted = null;
    this.#view = 'grid';
    this.#current = null;
    this.#screen = null;
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
    const top = screen === this.#screen ? this.#body.scrollTop : (app ? 0 : this.#gridTop);
    const ctx = this.#ctx();
    this.#head.className = app ? 'mod-head ap-head' : 'mod-head';
    this.#head.replaceChildren(...(app ? this.#ficheHead(ctx, app, model, blocked) : [h('h2', { id: 'mod-title' }, t('mod.title')), this.#count(model)]));
    this.#body.replaceChildren(app ? this.#fiche(ctx, app, model, blocked) : this.#grid(ctx, model, blocked));
    this.#body.scrollTop = top;
    this.#screen = screen;
    this.#root.querySelector('.mod-note').textContent = blocked !== null ? blocked : t('mod.saved');
    this.#restoreFocus(kept);
  }

  // ---------- la structure ----------

  #build() {
    const { t } = this.#opts.i18n;
    this.#head = h('header', { class: 'mod-head' });
    this.#body = h('div', { class: 'mod-body ap-body' });
    const root = h('div', { class: 'mod-scrim' },
      h('section', { class: 'mod ap-win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mod-title' }, this.#head, this.#body,
        h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note', 'aria-live': 'polite' }),
          h('button', { type: 'button', class: 'btn', dataset: { fk: 'close' }, on: { click: () => this.close() } }, t('mod.close')))));
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
    return { t, lang, badge: kind => this.#badge(kind), key: rowKey };
  }

  // Les gestes de la vitrine, par `data-act` : ouvrir la fiche ou revenir, installer, retirer, ouvrir l'app, changer de capture, aller aux extensions.
  // Un bouton grisé (`aria-disabled`) dit pourquoi dans le pied de la fenêtre et ne fait rien d'autre.
  #onClick(event) {
    const node = event.target.closest('[data-act]');
    if (!node || !this.#root.contains(node)) return;
    const { act, id } = node.dataset;
    const { on } = this.#opts;
    if (act === 'show') this.#show(id);
    else if (act === 'back') this.#back();
    else if (act === 'open') { this.close(); on.open(id); }
    else if (act === 'shot') { this.#shot = Number(node.dataset.index); this.#want = `shot:${this.#shot}`; this.refresh(); }
    else if (act === 'ext') this.#body.querySelector('.ap-sect').scrollIntoView({ block: 'start' });
    else if (node.getAttribute('aria-disabled') === 'true') this.#flash(node.dataset.reason);
    else if (act === 'install') { this.#want = `open:${id}`; on.app(id, true); } else if (act === 'remove') { this.#want = rowKey(id); on.app(id, false); }
  }

  #show(id) {
    this.#gridTop = this.#body.scrollTop;
    this.#view = 'fiche';
    this.#current = id;
    this.#shot = 0;
    this.#want = 'back';
    this.refresh();
  }

  #back() {
    this.#want = `name:${this.#current}`;
    this.#view = 'grid';
    this.refresh();
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
      this.#shot = 0;
    } else this.#view = 'grid';
  }

  #restoreFocus(kept) {
    const wanted = this.#want;
    this.#want = null;
    const nodes = [...this.#root.querySelectorAll('[data-fk]')];
    const find = key => key && nodes.find(node => node.dataset.fk === key && !node.disabled);
    // « Ouvrir » et « Installer » se remplacent (un refus de créer la table remet « Installer » à la place d'« Ouvrir », mesuré le 17/11 dans un vrai Grist) :
    // le clavier suit l'autre.
    const other = key => (key && /^(open|app):/.test(key) ? key.replace(/^(open|app):/, (all, kind) => (kind === 'open' ? 'app:' : 'open:')) : null);
    const target = find(wanted) || find(kept) || find(other(kept));
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
    if (input.dataset.ext) on.extension(input.dataset.parent, input.dataset.ext, input.checked);
    else if (input.dataset.modeFor) on.mode(input.dataset.parent, input.dataset.modeFor, input.value);
    else if (input.dataset.nativeAll) on.nativeMode(input.dataset.nativeAll, null, input.value);
    else if (input.dataset.nativeFor) on.nativeMode(input.dataset.parent, input.dataset.nativeFor, input.value);
  }

  // Où la fenêtre pose le clavier à l'ouverture : la ligne de l'extension visée (contrats 5.4, `installer`) ou le bouton de l'app visée, sinon le premier nom
  // de la mosaïque.
  #reveal(focus) {
    const nodes = [...this.#root.querySelectorAll('[data-fk]')];
    const byKey = key => nodes.find(node => node.dataset.fk === key && !node.disabled);
    const row = focus && focus.startsWith('ext:') ? [...this.#root.querySelectorAll('.mr')].find(node => node.dataset.row === focus) : null;
    const id = focus && focus.startsWith('app:') ? focus.slice(4) : null;
    const target = (row ? row.querySelector(FOCUSABLE) : id && (byKey(rowKey(id)) || byKey(`open:${id}`) || byKey(`name:${id}`)))
      || this.#body.querySelector('[data-fk]:not([disabled])') || this.#root.querySelector('[data-fk="close"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
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

  // L'en-tête de la fiche : revenir à la mosaïque, l'icône, le nom et l'état, le compte, puis « Retirer » (une app toujours active ne se retire pas) et
  // « Installer » ou « Ouvrir ».
  #ficheHead(ctx, app, model, blocked) {
    const { t, lang } = ctx;
    const remove = app.installed && app.ok && !app.always
      ? h('button', { type: 'button', class: 'btn sm', 'aria-disabled': blocked !== null ? 'true' : null, title: blocked,
        dataset: { act: 'remove', id: app.id, reason: blocked || '', fk: `remove:${app.id}` } }, t('ap.remove'))
      : null;
    const state = !app.ok ? this.#badge('locked') : (app.installed ? this.#badge('on') : null);
    return [
      h('button', { type: 'button', class: 'btn sm ap-back', dataset: { act: 'back', fk: 'back' } }, icon('chev-left'), t('ap.back')),
      h('span', { class: 'ap-tile' }, icon(glyphOf(app))),
      h('div', { class: 'ap-head-main' }, h('h2', { id: 'mod-title' }, nameOf(app, lang), state), this.#count(model)),
      h('div', { class: 'ap-head-acts' }, remove, mainButton(ctx, app, this.#why(app, blocked))),
    ];
  }

  // La fiche d'une app : la galerie, la description et les faits, le choix des bibliothèques de l'app, puis ses extensions.
  #fiche(ctx, app, model, blocked) {
    const { t, lang } = ctx;
    const shown = vitrineOf(app.manifest, lang);
    const exts = model.items.filter(item => item.kind === 'ext' && item.app === app.id);
    const enabled = app.ok && app.installed && blocked === null;
    const facts = [app.manifest ? t('ap.version', { v: app.manifest.version }) : null,
      app.always ? t('mod.always').replace(/\.$/, '') : null].filter(Boolean).join(' · ');
    const toExt = exts.length
      ? h('button', { type: 'button', class: 'ap-link', dataset: { act: 'ext', fk: 'to-ext' } }, t('ap.extCount', { n: exts.length }), icon('chev-down'))
      : null;
    let choice = null;
    if (!app.ok) choice = h('p', { class: 'ap-warn' }, t('mod.invalid', { reasons: app.errors.join(' ; ') }));
    else if (app.natives.length) choice = this.#natives(app, enabled);
    else choice = h('p', { class: 'mr-note' }, t('ap.noNatives'));
    const hint = app.ok && app.natives.length && !app.installed && blocked === null ? h('p', { class: 'mr-note' }, t('ap.installFirst')) : null;
    const about = h('div', { class: 'ap-about' }, h('p', { class: 'ap-long' }, shown.description),
      h('p', { class: 'ap-facts' }, facts, toExt ? ' · ' : '', toExt), choice, hint);
    const active = exts.filter(item => item.checked && item.appInstalled).length;
    const section = exts.length
      ? h('section', { class: 'ap-sect' }, h('h3', null, t('ap.extTitle'), h('span', { class: 'ap-ext-count' },
        `· ${t('ap.extActive', { n: active })} / ${exts.length}`)),
        ...exts.map(item => this.#extensionRow(item, blocked !== null, model)))
      : null;
    return h('div', { class: 'ap-fiche', dataset: { app: app.id } }, gallery(ctx, app, shown, this.#shot), about, section);
  }

  // ---------- les lignes ----------

  #id(key) {
    if (!this.#ids.has(key)) this.#ids.set(key, `mod-${++counter}`);
    return this.#ids.get(key);
  }

  #badge(kind) {
    const { t } = this.#opts.i18n;
    return h('span', { class: `badge ${kind}` }, kind === 'on' ? icon('check') : (kind === 'locked' ? icon('lock') : null), t(`mod.badge.${kind}`));
  }

  #size(kilobytes) {
    const { t } = this.#opts.i18n;
    const format = new Intl.NumberFormat(this.#opts.locale, { maximumFractionDigits: 1 });
    return kilobytes >= 1024 ? t('mod.sizeMb', { n: format.format(kilobytes / 1024) }) : t('mod.sizeKb', { n: format.format(Math.round(kilobytes)) });
  }

  // Une ligne : la case, le titre (icône, nom, état), le texte, une remarque, du contenu en plus et le côté droit. Les lignes d'app et d'extension ne
  // diffèrent que par ce qu'elles y mettent.
  #row({ key, level, locked, input, glyph, name, kind, text, note, extra, side }) {
    const id = this.#id(key);
    return h('div', { class: `mr mr--${level}${locked ? ' is-locked' : ''}`, dataset: { row: key } },
      h('div', { class: 'mr-check' }, h('input', { type: 'checkbox', id, ...input, 'aria-describedby': `${id}-text` })),
      h('div', { class: 'mr-main' },
        h('div', { class: 'mr-title' }, h('label', { for: id }, icon(glyph), h('strong', null, name)), this.#badge(kind)),
        h('p', { class: 'mr-text', id: `${id}-text` }, text),
        note ? h('p', { class: note.warn ? 'mr-warn' : 'mr-note' }, note.text) : null,
        extra),
      h('div', { class: 'mr-side' }, side));
  }

  // Ce qui explique une extension qui ne se coche pas : une bibliothèque qui manque au catalogue, ou l'app qui n'est pas installée.
  #extensionNote(item, model) {
    const { t, lang } = this.#opts.i18n;
    if (item.greyed) return { warn: true, text: item.missing.map(({ id, version }) => t('mod.missingLib', { lib: cap(id), version })).join(' ') };
    if (item.appInstalled) return null;
    const parent = model.items.find(other => other.kind === 'app' && other.id === item.app);
    return { text: t('mod.needsApp', { app: parent && parent.manifest ? label(parent.manifest.nom, lang) : item.app }) };
  }

  #extensionRow(item, readonly, model) {
    const { lang } = this.#opts.i18n;
    const { extension } = item;
    const usable = item.appInstalled && !item.greyed;
    const on = item.checked && item.appInstalled;
    return this.#row({
      key: rowKey(item.app, extension.id), level: 'ext', locked: !usable, kind: item.greyed ? 'locked' : (on ? 'on' : 'off'),
      input: { checked: on, disabled: !usable || readonly, dataset: { ext: extension.id, parent: item.app, fk: rowKey(item.app, extension.id) } },
      glyph: item.greyed ? 'lock' : (extension.icone || 'modules'), name: label(extension.nom, lang), text: label(extension.texte, lang),
      note: this.#extensionNote(item, model),
      extra: item.libraries.length && !item.greyed ? this.#modes(item, usable && item.checked && !readonly) : null,
      side: extension.poids ? h('strong', { class: 'sz' }, this.#size(extension.poids)) : null,
    });
  }

  // Un bouton radio du choix CDN ou copie figée. Sans `hint`, la version courte d'une ligne de fonction. `off` : grisé parce que la copie manque (avec sa
  // raison), `disabled` : parce que la fenêtre ne peut rien écrire.
  #radio({ name, mode, checked, disabled, off = false, dataset, hint = null }) {
    const { t } = this.#opts.i18n;
    return h('label', { class: `rd${hint === null ? ' mini' : ''}${off ? ' is-off' : ''}` },
      h('input', { type: 'radio', name, value: mode, checked, disabled: disabled || off, dataset }),
      h('span', { class: 'rd-text' }, h('span', { class: 'rd-label' }, t(mode === DEFAULT_MODE ? 'mod.native.cdn' : 'mod.native.copy')),
        hint === null ? null : h('span', { class: 'rd-hint' }, hint)));
  }

  // Les bibliothèques natives d'une app (contrats 2.6, point 14) : un choix pour toutes, et, dépliable, un choix par fonction. Quand les fonctions diffèrent,
  // le choix de toutes est vide (« mélange »). La copie figée est grisée, avec sa raison, quand GFS n'a pas toutes les bibliothèques de la fonction.
  #natives(item, enabled) {
    const { t } = this.#opts.i18n;
    const rows = item.natives;
    const modes = new Set(rows.map(row => row.mode));
    const all = modes.size === 1 ? [...modes][0] : null;
    const some = rows.some(row => row.missing.length);
    const size = this.#size(rows.reduce((total, row) => total + row.poids, 0) / 1024);
    const group = `native-${item.id}`;
    const radios = MODES.map(mode => this.#radio({
      name: group, mode, checked: all === mode, disabled: !enabled, off: mode !== DEFAULT_MODE && some,
        dataset: { nativeAll: item.id, fk: `nativeall:${item.id}/${mode}` },
      hint: t(mode === DEFAULT_MODE ? 'mod.native.cdnHint' : (some ? 'mod.native.missingSome' : 'mod.native.copyHint')),
    }));
    const legend = `${t('mod.native.title')} · ${size}${all === null ? ` · ${t('mod.native.mixed')}` : ''}`;
    const detail = h('details', { class: 'mr-detail', open: this.#openNatives.has(item.id), dataset: { nativesOf: item.id } },
      h('summary', null, t('mod.native.detail')), ...rows.map(row => this.#nativeRow(item, row, enabled)));
    return h('div', { class: 'mr-natives' }, h('fieldset', { class: 'mr-mode', disabled: !enabled }, h('legend', null, legend), ...radios), detail);
  }

  #nativeRow(item, row, enabled) {
    const { t, lang } = this.#opts.i18n;
    const off = row.missing.length > 0;
    const radios = MODES.map(mode => this.#radio({
      name: `native-${item.id}-${row.group.id}`, mode, checked: row.mode === mode, disabled: !enabled, off: mode !== DEFAULT_MODE && off,
      dataset: { nativeFor: row.group.id, parent: item.id, fk: `native:${item.id}/${row.group.id}/${mode}` },
    }));
    const [first] = row.missing;
    return h('div', { class: 'mr-lib' },
      h('span', { class: 'mr-lib-name' }, label(row.group.nom, lang)),
      h('span', { class: 'mr-lib-size' }, this.#size(row.poids / 1024)),
      ...radios,
      off ? h('p', { class: 'mr-warn mr-lib-warn' }, t('mod.native.missing', { lib: cap(first.id), version: first.version })) : null,
      row.inApp ? h('p', { class: 'mr-note mr-lib-warn' }, t('mod.native.restart')) : null);
  }

  // Le mode des bibliothèques de l'extension : CDN (le défaut) ou copie de GFS. Un seul choix par extension (cahier, question 11).
  #modes(item, enabled) {
    const { t } = this.#opts.i18n;
    const group = `mode-${item.app}-${item.extension.id}`;
    const names = item.libraries.map(lib => (lib.poids ? t('mod.library', { lib: cap(lib.id), size: this.#size(lib.poids / 1024) }) : cap(lib.id))).join(' · ');
    // « Par défaut. » se dit du mode que GFS choisit à l'activation : le CDN, ou la copie quand l'app ne nomme pas encore l'adresse du CDN (2.6 point 15).
    const hintKey = mode => (mode === 'cdn' && item.noCdn ? 'mod.mode.cdnNone' : `mod.mode.${mode}${mode === item.defaultMode ? 'Hint' : 'Plain'}`);
    // Sans CDN (GFS n'a pas encore d'adresse publique, 2.6 point 11), l'option CDN reste là, grisée, avec la raison.
    const option = mode => h('label', { class: mode === 'cdn' && item.noCdn ? 'rd is-off' : 'rd' },
      h('input', {
        type: 'radio', name: group, value: mode, checked: item.mode === mode, disabled: !enabled || (mode === 'cdn' && item.noCdn),
        dataset: { modeFor: item.extension.id, parent: item.app, fk: `mode:${item.app}/${item.extension.id}/${mode}` },
      }),
      h('span', { class: 'rd-text' }, h('span', { class: 'rd-label' }, t(`mod.mode.${mode}`)),
        h('span', { class: 'rd-hint' }, t(hintKey(mode)))));
    // L'app ne nomme pas encore l'adresse du CDN dans sa politique de sécurité (`cdnAccepte: false`, 2.6 point 15) : le navigateur refusera le fichier. Le
    // choix reste libre ; la phrase le dit tant que le CDN est le mode retenu, et conseille la copie.
    const refused = item.cdnRefused && item.mode === 'cdn' ? h('p', { class: 'mr-warn mr-mode-warn' }, t('mod.mode.cdnRefused')) : null;
    return h('fieldset', { class: 'mr-mode', disabled: !enabled }, h('legend', null, names), option('cdn'), option('vendorise'), refused);
  }
}
