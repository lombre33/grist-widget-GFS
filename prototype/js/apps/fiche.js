// La fiche d'une app dans la fenêtre « Apps et extensions » (décision du porteur, 17/11 : « A · Page produit »), une page qui se lit de haut en bas, comme
// celle d'un magasin d'apps : l'app et son bouton, ses captures qu'on fait défiler, ce qu'elle fait, ses extensions en cartes (« Ajouter »), puis le choix de
// la source de ses bibliothèques en deux cartes. Du code qui ne décide rien : chaque geste est rendu à la fenêtre par `data-act` (ou par `change`, pour les
// boutons radio) et c'est le modèle (modules-model.js) qui dit ce qui est installé, ajouté, grisé.
// ctx : { t, lang, badge(kind), key(app, extension), size(kilo-octets) } ; `blocked` : la raison pour laquelle rien ne peut s'écrire (texte), ou null.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { label } from './manifest.js';
import { MODES, DEFAULT_MODE } from './libraries.js';
import { shot, glyphOf, nameOf, mainButton, removeButton, levelBadge, levelOf } from './vitrine.js';

const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
const modeName = (t, mode) => t(mode === DEFAULT_MODE ? 'mod.native.cdn' : 'mod.native.copy');

// ---------- le haut de la page ----------

// Les pastilles sous le nom : la version, « toujours active », puis le nombre d'extensions (un bouton qui mène à elles, ou « Sans extension »). Une app
// stable (« V1.1 ») dit sa version dans la pastille du niveau, à côté du nom : la ligne « Version » ne la redirait pas, et pourrait la contredire.
function chips(ctx, app, exts) {
  const { t } = ctx;
  const link = exts.length
    ? h('button', { type: 'button', class: 'fp-chip-link', dataset: { act: 'ext', fk: 'to-ext' } }, t('ap.extCount', { n: exts.length }), icon('chev-down'))
    : t('ap.noExt');
  const level = levelOf(app.manifest);
  const version = app.manifest && !(level && level.kind === 'stable') ? t('ap.version', { v: app.manifest.version }) : null;
  const items = [version, app.always ? t('mod.always').replace(/\.$/, '') : null, link];
  return h('ul', { class: 'fp-chips' }, ...items.filter(Boolean).map(item => h('li', null, item)));
}

// Le bandeau : l'icône, le nom (le titre de la fenêtre) et son état, le texte court, les pastilles, puis « Installer » ou « Ouvrir » (et « Retirer »).
// `reason` : pourquoi « Installer » est grisé, ou null.
export function hero(ctx, app, { exts, reason, blocked }) {
  const { t, lang, badge } = ctx;
  const state = !app.ok ? badge('locked') : (app.installed ? badge('on') : null);
  const tagline = app.manifest ? label(app.manifest.texte, lang) : '';
  const actions = [mainButton(ctx, app, reason, { size: 'lg', solid: true }), removeButton(ctx, app, blocked, { size: 'lg' })];
  return h('header', { class: 'fp-hero' }, h('span', { class: 'fp-tile' }, icon(glyphOf(app))),
    h('div', { class: 'fp-hero-main' }, h('h1', { id: 'mod-title' }, nameOf(app, lang), levelBadge(ctx, app.manifest), state),
      tagline ? h('p', { class: 'fp-tag' }, tagline) : null, chips(ctx, app, exts),
      app.ok ? null : h('p', { class: 'fp-warn' }, t('mod.invalid', { reasons: app.errors.join(' ; ') }))),
    h('div', { class: 'fp-cta-wrap', dataset: { hero: 'cta' } }, h('div', { class: 'fp-cta' }, ...actions)));
}

// Le nom et les boutons repris dans la barre du haut quand ceux du bandeau sont sortis de l'écran (la fenêtre les montre alors, `is-mini`).
export function miniBar(ctx, app, { reason, blocked }) {
  const { lang } = ctx;
  return [h('span', { class: 'fp-mini' }, h('span', { class: 'fp-tile xs' }, icon(glyphOf(app))), h('strong', null, nameOf(app, lang))),
    h('div', { class: 'fp-head-cta fp-mini' }, mainButton(ctx, app, reason, { prefix: 'mini-', solid: true }),
      removeButton(ctx, app, blocked, { prefix: 'mini-' }))];
}

// ---------- les captures ----------

// Les captures en une bande qu'on fait défiler (la suivante dépasse un peu) ; sans capture, une phrase le dit. La bande est une région qui prend le clavier :
// les flèches la font défiler ; les deux boutons rond aussi, et se cachent au bout.
export function strip(ctx, app, shown) {
  const { t, lang } = ctx;
  const { captures } = shown;
  if (!captures.length) return h('p', { class: 'fp-noshot' }, t('ap.noShot'));
  const glyph = glyphOf(app);
  const name = nameOf(app, lang);
  const scroller = h('div', { class: 'fp-strip', role: 'region', tabindex: '0', 'aria-label': t('ap.captions', { app: name }) },
    ...captures.map(capture => h('figure', { class: 'fp-slide' }, h('div', { class: 'fp-shot' }, shot({ capture, glyph, name })),
      h('figcaption', null, capture.caption))));
  const step = (dir, name2, glyph2) => h('button', { type: 'button', class: `fp-nav ${dir < 0 ? 'prev' : 'next'}`, 'aria-label': t(name2),
    dataset: { act: 'strip', dir } }, icon(glyph2));
  const prev = step(-1, 'ap.shotPrev', 'chev-left');
  const next = step(1, 'ap.shotNext', 'chev-right');
  const update = () => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    prev.hidden = next.hidden = max < 4;
    prev.disabled = scroller.scrollLeft < 4;
    next.disabled = scroller.scrollLeft > max - 4;
  };
  scroller.addEventListener('scroll', update, { passive: true });
  (scroller.ownerDocument.defaultView || globalThis).requestAnimationFrame(update);
  return h('div', { class: 'fp-stripwrap' }, scroller, prev, next);
}

// Ce que l'app dit d'elle-même, quand elle a une description à elle (sans, la fiche n'a que le texte court du bandeau : pas deux fois la même phrase).
export function about(ctx, app, shown) {
  const tagline = app.manifest ? label(app.manifest.texte, ctx.lang) : '';
  if (!shown.description || shown.description === tagline) return null;
  return h('section', { class: 'fp-sec fp-about' }, h('h2', null, ctx.t('ap.about')), h('p', { class: 'fp-long' }, shown.description));
}

// ---------- les extensions ----------

// Ce qui explique une extension qui ne s'ajoute pas : une bibliothèque qui manque au catalogue, ou l'app qui n'est pas installée.
function extensionNote(ctx, item, parent) {
  const { t, lang } = ctx;
  if (item.greyed) return { warn: true, text: item.missing.map(({ id, version }) => t('mod.missingLib', { lib: cap(id), version })).join(' ') };
  if (item.appInstalled) return null;
  return { text: t('mod.needsApp', { app: parent && parent.manifest ? label(parent.manifest.nom, lang) : item.app }) };
}

// Le segment « CDN | Copie figée » : deux boutons radio dans une rangée, la copie grisée (`off`) quand elle manque ; le même pour l'app, une extension, une
// fonction.
// `dataset(mode)` : les données de chaque bouton.
function segments({ name, current, legend, enabled, offMode = null, dataset, full = false, t }) {
  const options = MODES.map(mode => h('label', { class: offMode === mode ? 'is-off' : null },
    h('input', { type: 'radio', name, value: mode, checked: current === mode, disabled: !enabled || offMode === mode, dataset: dataset(mode) }),
      modeName(t, mode)));
  return h('fieldset', { class: `fp-seg${full ? ' is-full' : ''}`, disabled: !enabled }, h('legend', { class: 'fp-sr' }, legend),
    h('span', { class: 'fp-segs' }, ...options));
}

// La phrase sous le segment d'une extension : celle du mode retenu (« Par défaut. » s'il l'est), ou l'absence de CDN, ou le refus du navigateur.
function modeNote(ctx, item) {
  const { t } = ctx;
  if (item.noCdn) return h('p', { class: 'fp-note' }, t('mod.mode.cdnNone'));
  // L'app ne nomme pas encore l'adresse du CDN dans sa politique de sécurité (`cdnAccepte: false`, 2.6 point 15) : le navigateur refusera le fichier. Le choix
  // reste libre ; la phrase le dit tant que le CDN est le mode retenu, et conseille la copie.
  if (item.cdnRefused && item.mode === 'cdn') return h('p', { class: 'fp-warn' }, t('mod.mode.cdnRefused'));
  return h('p', { class: 'fp-note' }, t(`mod.mode.${item.mode}${item.mode === item.defaultMode ? 'Hint' : 'Plain'}`));
}

// Les bibliothèques d'une extension et le choix de leur source (un seul par extension, cahier question 11) ; rien à charger, la phrase le dit.
function extensionLibraries(ctx, item, enabled) {
  const { t, lang, size } = ctx;
  if (!item.libraries.length) return h('p', { class: 'fp-note fp-ext-nolib' }, t('ap.noLib'));
  if (item.greyed) return null;
  const list = item.libraries.map(lib => (lib.poids ? `${cap(lib.id)} ${size(lib.poids / 1024)}` : cap(lib.id))).join(', ');
  const name = label(item.extension.nom, lang);
  return h('div', { class: 'fp-ext-libs' }, h('p', { class: 'fp-note' }, t('ap.libsList', { list })),
    segments({ name: `mode-${item.app}-${item.extension.id}`, current: item.mode, legend: `${name} : ${t('ap.libsShort')}`, enabled,
      offMode: item.noCdn ? 'cdn' : null, t,
      dataset: mode => ({ modeFor: item.extension.id, parent: item.app, fk: `mode:${item.app}/${item.extension.id}/${mode}` }) }), modeNote(ctx, item));
}

// Le bouton d'une carte : « Ajouter », ou « Retirer » quand elle est ajoutée ; grisé avec sa raison (un clic la dit dans le pied) quand rien ne peut s'écrire
// ou que l'app n'est pas installée. Il garde la même clé de clavier d'un état à l'autre.
function extensionToggle(ctx, item, { on, reason }) {
  const { t, lang, key } = ctx;
  const name = label(item.extension.nom, lang);
  return h('button', { type: 'button', class: `btn ${on ? 'quiet ' : ''}sm`, 'aria-disabled': reason ? 'true' : null, title: reason || null,
    'aria-label': t(on ? 'ap.extRemoveLabel' : 'ap.extAddLabel', { name }),
    dataset: { act: 'extension', parent: item.app, ext: item.extension.id, on: String(!on), reason: reason || '', fk: key(item.app, item.extension.id) } },
  ...(on ? [t('ap.remove')] : [icon('plus'), t('ap.extAdd')]));
}

// L'en-tête d'une carte : l'icône (un cadenas quand une bibliothèque manque), le nom, le poids.
function extensionHead(ctx, item) {
  const { lang, size } = ctx;
  const { extension } = item;
  return h('div', { class: 'fp-ext-head' }, h('span', { class: 'fp-ext-tile' }, icon(item.greyed ? 'lock' : (extension.icone || 'modules'))),
    h('h3', null, label(extension.nom, lang)), extension.poids ? h('span', { class: 'fp-ext-size' }, size(extension.poids)) : null);
}

// Le pied d'une carte : « Ajoutée », le bouton, puis ce qui explique qu'il soit grisé (quand rien ne s'écrit, la raison est dite dans le pied de la fenêtre).
function extensionFoot(ctx, item, { blocked, parent, on, usable }) {
  const note = extensionNote(ctx, item, parent);
  const reason = blocked || (usable ? null : note && note.text);
  return h('div', { class: 'fp-ext-foot' }, on ? h('span', { class: 'fp-added' }, icon('check'), ctx.t('ap.extAdded')) : null,
    extensionToggle(ctx, item, { on, reason }), note && !blocked ? h('p', { class: note.warn ? 'fp-warn' : 'fp-note' }, note.text) : null);
}

// Une extension : son icône, son nom et son poids, ce qu'elle fait, ses bibliothèques et leur source, puis « Ajouter » (ou « Ajoutée » et « Retirer »).
function extensionCard(ctx, item, { blocked, parent }) {
  const { lang, key } = ctx;
  const usable = item.appInstalled && !item.greyed;
  const on = item.checked && item.appInstalled;
  return h('article', { class: `fp-ext${on ? ' is-on' : ''}${usable ? '' : ' is-off'}`, dataset: { row: key(item.app, item.extension.id) } },
    extensionHead(ctx, item), h('p', { class: 'fp-ext-text' }, label(item.extension.texte, lang)),
    extensionLibraries(ctx, item, usable && item.checked && blocked === null), extensionFoot(ctx, item, { blocked, parent, on, usable }));
}

// La rubrique des extensions : le compte, une phrase, puis les cartes (deux colonnes dans une fenêtre large) ; sans extension, la phrase le dit.
export function extensions(ctx, app, exts, { blocked, parent }) {
  const { t } = ctx;
  if (!exts.length) return h('section', { class: 'fp-sec fp-exts' }, h('h2', null, t('ap.extTitle')), h('p', { class: 'fp-note' }, t('ap.extNone')));
  const added = exts.filter(item => item.checked && item.appInstalled).length;
  return h('section', { class: 'fp-sec fp-exts' },
    h('h2', null, t('ap.extTitle'), h('span', { class: 'fp-count', 'aria-live': 'polite' }, t('ap.extOf', { n: added, total: exts.length }))),
    h('p', { class: 'fp-lead' }, t('ap.extLead')), h('div', { class: 'fp-ext-grid' }, ...exts.map(item => extensionCard(ctx, item, { blocked, parent }))));
}

// ---------- les bibliothèques de l'app ----------

// Les deux cartes à cocher : « CDN » (le défaut) et « Copie figée » (pour les réseaux fermés), chacune avec sa phrase ; la copie est grisée, avec sa raison,
// quand GFS n'a pas toutes les bibliothèques. Quand les fonctions diffèrent (« mélange »), aucune n'est cochée.
function sourceCards(ctx, app, { enabled, all, some }) {
  const { t } = ctx;
  const card = (mode, glyph) => {
    const off = mode !== DEFAULT_MODE && some;
    const text = off ? t('mod.native.missingSome') : t(mode === DEFAULT_MODE ? 'ap.libCdn' : 'mod.native.copyHint');
    return h('label', { class: `fp-choice${off ? ' is-off' : ''}` },
      h('input', { type: 'radio', name: `native-${app.id}`, value: mode, checked: all === mode, disabled: !enabled || off,
        dataset: { nativeAll: app.id, fk: `nativeall:${app.id}/${mode}` } }),
      h('span', { class: 'fp-choice-body' }, h('span', { class: 'fp-choice-head' }, icon(glyph), h('strong', null, modeName(t, mode)),
        h('span', { class: 'fp-pill' }, t(mode === DEFAULT_MODE ? 'ap.libDefault' : 'ap.libClosed'))), h('span', { class: 'fp-choice-desc' }, text)));
  };
  return h('fieldset', { class: 'fp-choices', disabled: !enabled }, h('legend', { class: 'fp-sr' }, t('ap.libsTitle')), card('cdn', 'globe'),
    card('vendorise', 'shield'));
}

// Une ligne du détail : la fonction, son poids, son choix ; ce qui manque ou ce qui ne prend effet qu'au prochain démarrage se dit dessous.
function nativeRow(ctx, app, row, enabled) {
  const { t, lang, size } = ctx;
  const [first] = row.missing;
  const group = label(row.group.nom, lang);
  return h('li', { class: 'fp-fn' }, h('span', { class: 'fp-fn-name' }, group), h('span', { class: 'fp-fn-size' }, size(row.poids / 1024)),
    segments({ name: `native-${app.id}-${row.group.id}`, current: row.mode, legend: group, enabled, offMode: first ? 'vendorise' : (row.fixed ? 'cdn' : null),
      t,
      dataset: mode => ({ nativeFor: row.group.id, parent: app.id, fk: `native:${app.id}/${row.group.id}/${mode}` }) }),
    first ? h('p', { class: 'fp-warn fp-fn-note' }, t('mod.native.missing', { lib: cap(first.id), version: first.version })) : null,
    row.inApp ? h('p', { class: 'fp-note fp-fn-note' }, t(row.fixed ? 'mod.native.noCdn' : 'mod.native.restart')) : null);
}

// La rubrique des bibliothèques natives de l'app (contrats 2.6, point 14) : un choix pour toutes, en deux cartes, et, dépliable, un choix par fonction ; sans
// bibliothèque que GFS sert, la phrase le dit. `open` : le détail est déplié ; `installFirst` : l'app n'est pas installée, le choix attend.
export function libraries(ctx, app, { enabled, open, installFirst }) {
  const { t, size } = ctx;
  if (!app.ok) return null;
  const title = h('h2', null, t('ap.libsTitle'));
  if (!app.natives.length) return h('section', { class: 'fp-sec fp-libs' }, title, h('p', { class: 'fp-note' }, t('ap.noNatives')));
  // Une fonction sans CDN n'a rien à choisir : elle ne compte pas dans « toutes » (sans elle, le défaut serait un « mélange »), sauf quand toutes sont dans ce
  // cas.
  const free = app.natives.filter(row => !row.fixed);
  const modes = new Set((free.length ? free : app.natives).map(row => row.mode));
  const all = modes.size === 1 ? [...modes][0] : null;
  const total = size(app.natives.reduce((sum, row) => sum + row.poids, 0) / 1024);
  title.append(h('span', { class: 'fp-count' }, `${total}${all === null ? ` · ${t('mod.native.mixed')}` : ''}`));
  const detail = h('details', { class: 'fp-detail', open, dataset: { nativesOf: app.id } }, h('summary', null, t('mod.native.detail')),
    h('ul', { class: 'fp-fns' }, ...app.natives.map(row => nativeRow(ctx, app, row, enabled))));
  return h('section', { class: 'fp-sec fp-libs' }, title, h('p', { class: 'fp-lead' }, t('ap.libsLead')),
    sourceCards(ctx, app, { enabled, all, some: app.natives.some(row => row.missing.length) }), h('p', { class: 'fp-advice' }, t('ap.libAdvice')),
    installFirst ? h('p', { class: 'fp-note' }, t('ap.installFirst')) : null, detail);
}
