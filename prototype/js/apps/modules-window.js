// La fenêtre « Apps et extensions » (cahier 6, contrats 7.3) : une case par app et par extension, le mode de la bibliothèque d'une extension
// (CDN ou copie de GFS). Les choix s'enregistrent tout de suite, pour tout le document (7.4) ; quand ils ne peuvent pas, les cases sont grisées avec la
// raison. Une fenêtre sur une seule base : titre et boutons fixes, la liste défile. Elle ne décide rien : chaque geste est rendu au contrôleur, qui
// écrit la table et recalcule ce qu'elle montre.
// Elle s'ouvre par trois portes (maquette du 12/10) : une fonction grisée, les réglages de la vue dans Grist, le premier lancement.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { mountWindow, giveBackFocus } from '../ui/modal.js';
import { label } from './manifest.js';
import { MODES, DEFAULT_MODE } from './libraries.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
let counter = 0;

// La clé d'une ligne : ce que `open({ focus })` reçoit pour amener la fenêtre sur un module.
export const rowKey = (app, extension = null) => (extension ? `ext:${app}/${extension}` : `app:${app}`);

export class ModulesWindow {
  #opts;
  #root = null;
  #body = null;
  #mounted = null; // { opener, unmount } de la fenêtre ouverte (modal.js, mountWindow)
  #ids = new Map();
  #openNatives = new Set(); // les apps dont le détail « fonction par fonction » est déplié : il le reste d'un dessin à l'autre

  // opts : { container, i18n, locale, model(), blocked(), inertTargets(), on: { app(id, on), extension(app, id, on), mode(app, id, mode), open(app) },
  //   onClose() }
  // `blocked()` : la raison pour laquelle rien ne peut s'enregistrer (texte), ou null.
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#root !== null; }
  // Le fond de la fenêtre, pour qu'une question posée par-dessus (ask-window.js) le rende inerte.
  get element() { return this.#root; }

  open({ focus = null } = {}) {
    if (this.#root) { this.refresh(); this.#reveal(focus); return; }
    this.#root = this.#build();
    this.#mounted = mountWindow({ container: this.#opts.container, root: this.#root, inertTargets: () => this.#opts.inertTargets(),
      onKey: event => this.#keydown(event) });
    this.refresh();
    this.#reveal(focus);
  }

  close() {
    if (!this.#root) return;
    const { opener, unmount } = this.#mounted;
    unmount();
    this.#root = null;
    this.#mounted = null;
    giveBackFocus(opener);
    this.#opts.onClose();
  }

  // La langue de GFS a changé : une fenêtre ouverte réécrit ses textes et se redessine, une fenêtre fermée prendra les nouveaux à son ouverture.
  relocalize({ i18n, locale }) {
    this.#opts = { ...this.#opts, i18n, locale };
    if (!this.#root) return;
    this.#root.querySelector('#mod-title').textContent = i18n.t('mod.title');
    this.#root.querySelector('[data-fk="close"]').textContent = i18n.t('mod.close');
    this.refresh();
  }

  // Redessine la liste d'après le modèle, en gardant le défilement et l'élément qui avait le clavier.
  refresh() {
    if (!this.#root) return;
    const { t } = this.#opts.i18n;
    const model = this.#opts.model();
    const doc = this.#root.ownerDocument;
    const kept = doc.activeElement && this.#root.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const top = this.#body.scrollTop;
    const blocked = this.#opts.blocked();
    const readonly = blocked !== null;
    this.#body.replaceChildren(...model.items.map(item => (item.kind === 'app' ? this.#appRow(item, readonly) : this.#extensionRow(item, readonly, model))));
    this.#body.scrollTop = top;
    this.#root.querySelector('.mod-count').replaceChildren(h('strong', null, t('mod.count', { n: model.active, total: model.total })),
      ` · ${t('mod.countNote')}`);
    this.#root.querySelector('.mod-note').textContent = readonly ? blocked : t('mod.saved');
    if (kept) {
      const again = [...this.#root.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept && !node.disabled);
      if (again) again.focus({ preventScroll: true });
    }
  }

  // ---------- la structure ----------

  #build() {
    const { t } = this.#opts.i18n;
    this.#body = h('div', { class: 'mod-body' });
    const root = h('div', { class: 'mod-scrim' },
      h('section', { class: 'mod', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mod-title' },
        h('header', { class: 'mod-head' }, h('h2', { id: 'mod-title' }, t('mod.title')), h('p', { class: 'mod-count', 'aria-live': 'polite' })),
        this.#body,
        h('footer', { class: 'mod-foot' }, h('p', { class: 'mod-note', 'aria-live': 'polite' }),
          h('button', { type: 'button', class: 'btn', dataset: { fk: 'close' }, on: { click: () => this.close() } }, t('mod.close')))));
    this.#body.addEventListener('change', event => this.#onChange(event));
    this.#body.addEventListener('toggle', (event) => {
      const app = event.target.dataset && event.target.dataset.nativesOf;
      if (!app) return;
      if (event.target.open) this.#openNatives.add(app); else this.#openNatives.delete(app);
    }, true);
    this.#body.addEventListener('click', event => {
      const open = event.target.closest('[data-open]');
      if (open) { const id = open.dataset.open; this.close(); this.#opts.on.open(id); }
    });
    return root;
  }

  #keydown(event) {
    if (!this.#root || this.#root.inert) return; // une question posée par-dessus (ask-window.js) a le clavier
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...this.#root.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = this.#root.ownerDocument.activeElement;
    const to = node => { event.preventDefault(); node.focus(); };
    if (!this.#root.contains(active)) to(event.shiftKey ? last : first);
    else if (event.shiftKey && active === first) to(last);
    else if (!event.shiftKey && active === last) to(first);
  }

  #onChange(event) {
    const input = event.target;
    const { on } = this.#opts;
    if (input.dataset.app) on.app(input.dataset.app, input.checked);
    else if (input.dataset.ext) on.extension(input.dataset.parent, input.dataset.ext, input.checked);
    else if (input.dataset.modeFor) on.mode(input.dataset.parent, input.dataset.modeFor, input.value);
    else if (input.dataset.nativeAll) on.nativeMode(input.dataset.nativeAll, null, input.value);
    else if (input.dataset.nativeFor) on.nativeMode(input.dataset.parent, input.dataset.nativeFor, input.value);
  }

  // La porte « fonction grisée » : la fenêtre s'ouvre sur la ligne du module (contrats 5.4, `installer`) ; sinon sur la première case libre.
  #reveal(focus) {
    const row = focus ? [...this.#root.querySelectorAll('.mr')].find(node => node.dataset.row === focus) : null;
    const target = (row ? row.querySelector(FOCUSABLE) : this.#body.querySelector(FOCUSABLE)) || this.#root.querySelector('[data-fk="close"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
    // La fenêtre peut s'ouvrir depuis Grist (réglages de la vue) : le clavier doit venir ici pour que Échap et Tab la servent.
    try { this.#root.ownerDocument.defaultView.focus(); } catch (error) { /* le cadre garde l'état qu'il avait */ }
    target.focus({ preventScroll: true });
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

  // La remarque d'une ligne d'app : pourquoi elle ne se coche pas (manifeste refusé), ou qu'elle est toujours active.
  #appNote(item, locked) {
    const { t } = this.#opts.i18n;
    if (locked) return { warn: true, text: t('mod.invalid', { reasons: item.errors.join(' ; ') }) };
    return item.always ? { text: t('mod.always') } : null;
  }

  #appRow(item, readonly) {
    const { t, lang } = this.#opts.i18n;
    const { manifest } = item;
    const locked = !item.ok;
    const name = manifest ? label(manifest.nom, lang) : item.id;
    const note = this.#appNote(item, locked);
    const side = item.installed && !locked
      ? h('button', { type: 'button', class: 'btn sm', title: t('mod.openTip', { app: name }), dataset: { open: item.id, fk: `open:${item.id}` } },
        icon('open'), t('mod.open'))
      : null;
    return this.#row({
      key: rowKey(item.id), level: 'app', locked, kind: locked ? 'locked' : (item.installed ? 'on' : 'off'),
      input: { checked: item.installed, disabled: locked || item.always || readonly, dataset: { app: item.id, fk: rowKey(item.id) } },
      glyph: locked ? 'lock' : (manifest.icone || 'modules'), name, text: manifest ? label(manifest.texte, lang) : '', note, side,
      extra: !locked && item.natives.length ? this.#natives(item, item.installed && !readonly) : null,
    });
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
    // Sans CDN (GFS n'a pas encore d'adresse publique, 2.6 point 11), l'option CDN reste là, grisée, avec la raison.
    const option = mode => h('label', { class: mode === 'cdn' && item.noCdn ? 'rd is-off' : 'rd' },
      h('input', {
        type: 'radio', name: group, value: mode, checked: item.mode === mode, disabled: !enabled || (mode === 'cdn' && item.noCdn),
        dataset: { modeFor: item.extension.id, parent: item.app, fk: `mode:${item.app}/${item.extension.id}/${mode}` },
      }),
      h('span', { class: 'rd-text' }, h('span', { class: 'rd-label' }, t(`mod.mode.${mode}`)),
        h('span', { class: 'rd-hint' }, t(mode === 'cdn' && item.noCdn ? 'mod.mode.cdnNone' : `mod.mode.${mode}Hint`))));
    return h('fieldset', { class: 'mr-mode', disabled: !enabled }, h('legend', null, names), option('cdn'), option('vendorise'));
  }
}
