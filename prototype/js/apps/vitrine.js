// La vitrine de la fenêtre « Apps » (décision du porteur, 17/11 : la mosaïque « A · Vitrine ») : la carte d'une app dans la mosaïque et la galerie de sa fiche.
// Une app montre ses captures quand son manifeste en déclare (`vitrine.captures`, contrats 2.2) ; sans capture, ou si le fichier ne se charge pas, une vignette
// d'attente montre son icône et son nom. Les captures sont des fichiers de GFS (dossier `vitrine/`) : la politique de sécurité du contenu ne laisse charger une
// image que de GFS. Du code qui ne décide rien : les gestes sont rendus à la fenêtre par `data-act`.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { label } from './manifest.js';

export const SHOT_FOLDER = 'vitrine/';

// Ce que la vitrine montre d'une app : sa description (celle de `vitrine`, sinon le texte court de la carte) et ses captures `{ src, caption }`. Un manifeste
// invalide (ou absent) n'a rien à montrer que son nom.
export function vitrineOf(manifest, lang) {
  const shown = manifest && manifest.vitrine && typeof manifest.vitrine === 'object' ? manifest.vitrine : {};
  const captures = Array.isArray(shown.captures) ? shown.captures.map(capture =>
    ({ src: `${SHOT_FOLDER}${capture.fichier}`, caption: label(capture.legende, lang) })) : [];
  return { description: label(shown.description, lang) || label(manifest && manifest.texte, lang), captures };
}

// La vignette d'attente : l'icône de l'app et son nom, sur le fond de la capture.
function placeholder(glyph, name) {
  return h('span', { class: 'ap-ph' }, icon(glyph), h('span', { class: 'ap-ph-name' }, name));
}

// Une capture, ou la vignette d'attente quand il n'y en a pas ou quand le fichier ne se charge pas. `alt` : la légende, pour la grande vue seulement (les
// petites sont des doublons).
function shot({ capture, glyph, name, alt = false }) {
  if (!capture) return placeholder(glyph, name);
  const image = h('img', { class: 'ap-img', src: capture.src, alt: alt ? capture.caption : '', loading: 'lazy', decoding: 'async' });
  image.addEventListener('error', () => image.replaceWith(placeholder(glyph, name)), { once: true });
  return image;
}

// ctx : { t, lang, badge(kind), key(app) } ; `item` : une ligne d'app du modèle (modules-model.js).
export const glyphOf = item => (item.ok ? ((item.manifest && item.manifest.icone) || 'modules') : 'lock');
export const nameOf = (item, lang) => (item.manifest ? label(item.manifest.nom, lang) : item.id);

// Le bouton qui dit quoi faire de l'app : « Ouvrir » quand elle est installée, sinon « Installer » ; grisé (`aria-disabled`, jamais masqué) avec sa raison
// quand l'app est refusée ou que le document est en lecture seule : un clic dit pourquoi, dans le pied de la fenêtre.
export function mainButton(ctx, item, reason) {
  const { t, lang, key } = ctx;
  if (item.installed && item.ok) {
    return h('button', { type: 'button', class: 'btn sm', title: t('mod.openTip', { app: nameOf(item, lang) }),
      dataset: { act: 'open', id: item.id, open: item.id, fk: `open:${item.id}` } },
      icon('open'), t('mod.open'));
  }
  return h('button', { type: 'button', class: 'btn sm primary', 'aria-disabled': reason ? 'true' : null, title: reason,
    dataset: { act: 'install', id: item.id, reason: reason || '', fk: key(item.id) } },
    t('ap.install'));
}

// La carte d'une app dans la mosaïque : la capture (un clic ouvre la fiche), le nom (le bouton qui a le clavier), l'état, le texte court, le bouton.
export function appCard(ctx, item, reason) {
  const { t, lang, badge } = ctx;
  const name = nameOf(item, lang);
  const glyph = glyphOf(item);
  const { captures } = vitrineOf(item.manifest, lang);
  const state = !item.ok ? badge('locked') : (item.installed ? badge('on') : null);
  return h('article', { class: `ap-card${item.ok ? '' : ' is-locked'}`, dataset: { app: item.id } },
    h('button', { type: 'button', class: 'ap-shot', tabindex: '-1', 'aria-hidden': 'true', dataset: { act: 'show', id: item.id } },
      shot({ capture: captures[0], glyph, name })),
    h('div', { class: 'ap-main' },
      h('div', { class: 'ap-title' }, icon(glyph),
        h('button', { type: 'button', class: 'ap-name', 'aria-label': t('ap.details', { app: name }),
          dataset: { act: 'show', id: item.id, fk: `name:${item.id}` } }, name), state),
      h('p', { class: 'ap-text' }, item.manifest ? label(item.manifest.texte, lang) : ''),
      item.ok ? null : h('p', { class: 'ap-warn' }, t('mod.invalid', { reasons: item.errors.join(' ; ') }))),
    h('div', { class: 'ap-act' }, mainButton(ctx, item, reason)));
}

// La galerie de la fiche : la grande vue, la bande des petites (quand il y a plusieurs captures) et la légende de celle qu'on regarde.
export function gallery(ctx, item, shown, index) {
  const { t, lang } = ctx;
  const name = nameOf(item, lang);
  const glyph = glyphOf(item);
  const { captures } = shown;
  const current = captures[index] || captures[0] || null;
  const thumbs = captures.length > 1
    ? h('div', { class: 'ap-thumbs' }, ...captures.map((capture, at) => h('button',
      { type: 'button', class: 'ap-thumb', 'aria-current': String(capture === current),
      'aria-label': t('ap.shotN', { n: at + 1, total: captures.length }), dataset: { act: 'shot', index: at, fk: `shot:${at}` } },
        shot({ capture, glyph, name }))))
    : null;
  return h('div', { class: 'ap-gallery', role: 'group', 'aria-label': t('ap.captions', { app: name }) },
    h('div', { class: 'ap-big' }, shot({ capture: current, glyph, name, alt: true })), thumbs,
    current ? h('p', { class: 'ap-cap', 'aria-live': 'polite' }, current.caption) : null);
}
