// La fenêtre « Apps et extensions » (cahier 6, contrats 7.3) : une case par app et par extension, le mode de la bibliothèque d'une extension
// (CDN ou copie de GFS). Les choix s'enregistrent tout de suite, pour tout le document (7.4) ; quand ils ne peuvent pas, les cases sont grisées avec la
// raison. Une fenêtre sur une seule base : titre et boutons fixes, la liste défile. Elle ne décide rien : chaque geste est rendu au contrôleur, qui
// écrit la table et recalcule ce qu'elle montre.
// Elle s'ouvre par trois portes (maquette du 12/10) : une fonction grisée, les réglages de la vue dans Grist, le premier lancement.

import { h } from './dom.js';
import { icon } from './icons.js';
import { Layers } from './layers.js';
import { label } from './manifest.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
let counter = 0;

// La clé d'une ligne : ce que `open({ focus })` reçoit pour amener la fenêtre sur un module.
export const rowKey = (app, extension = null) => (extension ? `ext:${app}/${extension}` : `app:${app}`);

export class ModulesWindow {
  #opts;
  #root = null;
  #body = null;
  #opener = null;
  #inert = [];
  #onKey = null;
  #ids = new Map();

  // opts : { container, i18n, locale, model(), blocked(), inertTargets(), on: { app(id, on), extension(app, id, on), mode(app, id, mode), open(app) }, onClose() }
  // `blocked()` : la raison pour laquelle rien ne peut s'enregistrer (texte), ou null.
  constructor(opts) { this.#opts = opts; }

  get isOpen() { return this.#root !== null; }
  // Le fond de la fenêtre, pour qu'une question posée par-dessus (ask-window.js) le rende inerte.
  get element() { return this.#root; }

  open({ focus = null } = {}) {
    if (this.#root) { this.refresh(); this.#reveal(focus); return; }
    const doc = this.#opts.container.ownerDocument;
    this.#opener = doc.activeElement;
    this.#root = this.#build();
    this.#opts.container.append(this.#root);
    Layers.raise(this.#root, '--z-window');
    // Le fond ne reçoit ni clic ni clavier ; chaque élément retrouve à la fermeture l'état où il était (l'explorateur en tenait déjà un).
    this.#inert = this.#opts.inertTargets().map(target => [target, target.inert]);
    for (const [target] of this.#inert) target.inert = true;
    // Échap et Tab sur le document, en capture : ils valent même quand le clavier est tombé sur le fond, et passent avant ceux de l'explorateur.
    this.#onKey = event => this.#keydown(event);
    doc.addEventListener('keydown', this.#onKey, true);
    this.refresh();
    this.#reveal(focus);
  }

  close() {
    if (!this.#root) return;
    this.#root.ownerDocument.removeEventListener('keydown', this.#onKey, true);
    this.#onKey = null;
    this.#root.remove();
    this.#root = null;
    for (const [target, was] of this.#inert) target.inert = was;
    this.#inert = [];
    const back = this.#opener;
    this.#opener = null;
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
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
    this.#root.querySelector('.mod-count').replaceChildren(h('strong', null, t('mod.count', { n: model.active, total: model.total })), ` · ${t('mod.countNote')}`);
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
    root.addEventListener('pointerdown', event => { if (event.target === root) this.close(); });
    this.#body.addEventListener('change', event => this.#onChange(event));
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

  #appRow(item, readonly) {
    const { t, lang } = this.#opts.i18n;
    const { manifest } = item;
    const locked = !item.ok;
    const name = manifest ? label(manifest.nom, lang) : item.id;
    let note = null;
    if (locked) note = { warn: true, text: t('mod.invalid', { reasons: item.errors.join(' ; ') }) };
    else if (item.always) note = { text: t('mod.always') };
    const side = item.installed && !locked
      ? h('button', { type: 'button', class: 'btn sm', title: t('mod.openTip', { app: name }), dataset: { open: item.id, fk: `open:${item.id}` } }, icon('open'), t('mod.open'))
      : null;
    return this.#row({
      key: rowKey(item.id), level: 'app', locked, kind: locked ? 'locked' : (item.installed ? 'on' : 'off'),
      input: { checked: item.installed, disabled: locked || item.always || readonly, dataset: { app: item.id, fk: rowKey(item.id) } },
      glyph: locked ? 'lock' : (manifest.icone || 'modules'), name, text: manifest ? label(manifest.texte, lang) : '', note, side,
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
