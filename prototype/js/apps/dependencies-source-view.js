// Le choix de la source dans le détail d'une ligne de la fenêtre « Dépendances » (demande du porteur, 18/11 : « le plus d'options possible sur les dépendances
// ») : le même segment « CDN | Copie figée » que la fiche d'une app (js/apps/fiche.js : mêmes classes, mêmes mots), mais pour une bibliothèque. Il vaut pour
// chaque fonction qui l'utilise (js/apps/dependencies-source.js) ; ce qui est grisé dit pourquoi, jamais caché. Le geste de la personne s'écrit par
// `pick(mode)` ; rien ne s'écrit ici.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { MODES, DEFAULT_MODE } from './libraries.js';
import { sourceOf, COPY_MODE } from './dependencies-source.js';

const modeName = (t, mode) => t(mode === DEFAULT_MODE ? 'mod.native.cdn' : 'mod.native.copy');

// Pourquoi un mode est grisé : le CDN, quand une bibliothèque de la fonction n'a pas d'adresse publique ; la copie, quand GFS n'a pas toute la fonction.
function modeNotes(t, row, source, blocked) {
  const notes = [];
  if (blocked !== null) notes.push({ text: blocked, warn: true });
  else if (source.units.length && !source.open.length) notes.push(...source.why.map(key => ({ text: t(`dep.src.why.${key}`) })));
  if (source.open.length && !source.can.cdn) notes.push({ text: t('mod.mode.cdnNone') });
  if (source.open.length && !source.can[COPY_MODE]) notes.push({ text: t('dep.src.noCopy') });
  if (source.refused) notes.push({ text: t('mod.mode.cdnRefused'), warn: true });
  return notes;
}

// Ce que dit la ligne du choix en vigueur : un mot sur la source, ou « mélange », ou « aucune app ».
function currentNote(t, source) {
  if (!source.units.length) return t('dep.src.none');
  return source.mode === null ? t('dep.src.mixed') : t(`dep.src.is.${source.mode}`);
}

// Rend les nœuds du corps de la rubrique « Source ». `blocked` : la raison pour laquelle rien ne s'écrit (texte), ou null ; `pick(mode)` : le geste.
export function sourceBody({ t, row, blocked, pick }) {
  const source = sourceOf(row);
  const enabled = blocked === null && source.open.length > 0;
  const options = MODES.map(mode => {
    const off = !enabled || !source.can[mode];
    return h('label', { class: off ? 'is-off' : null },
      h('input', { type: 'radio', name: `dep-src-${row.slot || row.key}`, value: mode, checked: source.mode === mode, disabled: off,
        dataset: { fk: `dep-src-${row.slot || row.key}-${mode}`, source: mode }, on: { change: () => pick(mode) } }), modeName(t, mode));
  });
  const follow = source.follow.length ? h('p', { class: 'dp-sub' }, t('dep.src.follow', { n: source.follow.length, list: source.follow.join(', ') })) : null;
  return [h('fieldset', { class: 'fp-seg dp-seg' }, h('legend', { class: 'fp-sr' }, t('dep.src.legend', { name: row.paquet })),
    h('span', { class: 'fp-segs' }, ...options)),
    h('p', { class: 'dp-sub', role: 'status' }, currentNote(t, source)), follow,
    ...modeNotes(t, row, source, blocked).map(note => h('p', { class: note.warn ? 'dp-sub dp-attn' : 'dp-sub' }, ...(note.warn ? [icon('warning')] : []),
      note.text))];
}
