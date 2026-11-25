// La vitrine de la fenêtre « Apps » (décision du porteur, 17/11 : la mosaïque « A · Vitrine ») : la carte d'une app dans la mosaïque, ses boutons et ses
// captures. Une app montre ses captures quand son manifeste en déclare (`vitrine.captures`, contrats 2.2) ; sans capture, ou si le fichier ne se charge pas,
// une vignette d'attente montre son icône et son nom. Les captures sont des fichiers de GFS (dossier `vitrine/`) : la politique de sécurité du contenu ne
// laisse charger une image que de GFS. Du code qui ne décide rien : les gestes sont rendus à la fenêtre par `data-act`. La fiche de l'app est dans fiche.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { label, MATURITY_RE } from './manifest.js';

export const SHOT_FOLDER = 'vitrine/';

// Le niveau que le manifeste donne à l'app (`maturite`, contrats 2.2) : { kind: 'alpha' | 'beta' | 'stable', version } (`version` : « 1.1 » d'un « v1.1 »,
// null avant la V1), ou null quand le manifeste n'en dit rien ou le dit mal : la pastille n'invente jamais un niveau.
export function levelOf(manifest) {
  const value = manifest && manifest.maturite;
  if (typeof value !== 'string' || !MATURITY_RE.test(value)) return null;
  return value === 'alpha' || value === 'beta' ? { kind: value, version: null } : { kind: 'stable', version: value.slice(1) };
}

// La pastille du niveau, à côté du nom (la carte, le haut de la fiche) : un mot (« Alpha », « Bêta », « V1.1 ») qui dit où en est l'app, jamais la couleur
// seule ; le préfixe « Niveau : » est lu par les lecteurs d'écran, la phrase entière est dans l'info-bulle. Rien quand le manifeste ne donne pas de niveau.
export function levelBadge({ t }, manifest) {
  const level = levelOf(manifest);
  if (!level) return null;
  const text = level.kind === 'stable' ? `V${level.version}` : t(`ap.level.${level.kind}`);
  return h('span', { class: `lvl lvl-${level.kind}`, title: t(`ap.level.${level.kind}Tip`, { v: level.version }) },
    h('span', { class: 'fp-sr' }, `${t('ap.level.prefix')} `), text);
}

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

// Une capture, ou la vignette d'attente quand il n'y en a pas ou quand le fichier ne se charge pas. Elle est décorative : sa légende est écrite à côté.
export function shot({ capture, glyph, name }) {
  if (!capture) return placeholder(glyph, name);
  const image = h('img', { class: 'ap-img', src: capture.src, alt: '', loading: 'lazy', decoding: 'async' });
  image.addEventListener('error', () => image.replaceWith(placeholder(glyph, name)), { once: true });
  return image;
}

// ctx : { t, lang, badge(kind), key(app) } ; `item` : une ligne d'app du modèle (modules-model.js).
export const glyphOf = item => (item.ok ? ((item.manifest && item.manifest.icone) || 'modules') : 'lock');
export const nameOf = (item, lang) => (item.manifest ? label(item.manifest.nom, lang) : item.id);

// Le bouton qui dit quoi faire de l'app : « Ouvrir » quand elle est installée, sinon « Installer » ; grisé (`aria-disabled`, jamais masqué) avec sa raison
// quand l'app est refusée ou que le document est en lecture seule : un clic dit pourquoi, dans le pied de la fenêtre. `prefix` distingue les doubles de la
// barre du haut de la fiche (`mini-open:…`), `size` : 'sm' (la carte, la barre) ou 'lg' (le haut de la fiche), `solid` : « Ouvrir » plein, comme « Installer »
// (la fiche) ; sur la carte il reste au trait.
export function mainButton(ctx, item, reason, { prefix = '', size = 'sm', solid = false } = {}) {
  const { t, lang, key } = ctx;
  if (item.installed && item.ok) {
    // `data-open` est le repère des essais du labo : le double de la barre du haut ne le porte pas, pour qu'il n'y ait qu'un bouton par app.
    const dataset = { act: 'open', id: item.id, fk: `${prefix}open:${item.id}`, ...(prefix ? {} : { open: item.id }) };
    return h('button', { type: 'button', class: `btn${solid ? ' primary' : ''} ${size}`, title: t('mod.openTip', { app: nameOf(item, lang) }), dataset },
      icon('open'), t('mod.open'));
  }
  return h('button', { type: 'button', class: `btn primary ${size}`, 'aria-disabled': reason ? 'true' : null, title: reason,
    dataset: { act: 'install', id: item.id, reason: reason || '', fk: `${prefix}${key(item.id)}` } },
    t('ap.install'));
}

// « Retirer » : pour une app installée qui n'est pas toujours active ; grisé avec sa raison quand rien ne peut s'écrire (`blocked`).
export function removeButton(ctx, item, blocked, { prefix = '', size = 'sm' } = {}) {
  if (!(item.installed && item.ok && !item.always)) return null;
  return h('button', { type: 'button', class: `btn quiet ${size}`, 'aria-disabled': blocked !== null ? 'true' : null, title: blocked,
    dataset: { act: 'remove', id: item.id, reason: blocked || '', fk: `${prefix}remove:${item.id}` } }, ctx.t('ap.remove'));
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
          dataset: { act: 'show', id: item.id, fk: `name:${item.id}` } }, name), levelBadge(ctx, item.manifest), state),
      h('p', { class: 'ap-text' }, item.manifest ? label(item.manifest.texte, lang) : ''),
      item.ok ? null : h('p', { class: 'ap-warn' }, t('mod.invalid', { reasons: item.errors.join(' ; ') }))),
    h('div', { class: 'ap-act' }, mainButton(ctx, item, reason)));
}
