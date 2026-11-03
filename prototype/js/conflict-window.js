// La fenêtre « Ce nom est déjà pris » (contrats 6.6) : un fichier qu'on range porte le nom d'un fichier que GFS garde déjà. Une seule fenêtre pour tous les rangements, sur la base commune
// des fenêtres (js/modal.js). Trois issues : « Remplacer » (le fichier existant prend le contenu du nouveau et garde sa place), « Garder les deux » (le nouveau prend le nom libre
// « Nom (1).pdf ») ou rien (Annuler, Échap, un clic hors de la fenêtre : ni l'un ni l'autre ne change). Le clavier est sur « Garder les deux » : un Entrée distrait n'écrase rien.

import { h } from './dom.js';
import { openModal } from './modal.js';

// opts : { container, inertTargets() -> [élément], t, name (le nom en conflit), detail (qui dit le fichier existant : sa date, son auteur), copy (le nom que prendrait la copie) }.
// Rend 'replace', 'both' ou null.
export function askConflict({ container, inertTargets, t, name, detail, copy }) {
  const both = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'conflict-both' } }, t('files.conflict.both'));
  const replace = h('button', { type: 'button', class: 'btn', dataset: { fk: 'conflict-replace' } }, t('files.conflict.replace'));
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'conflict-cancel' } }, t('table.cancel'));
  const option = (label, text) => h('li', {}, h('b', {}, label), `${t('files.conflict.sep')}${text}`);
  const section = h('section', { class: 'mod ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'cf-title', 'aria-describedby': 'cf-text' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'cf-title' }, t('files.conflict.title'))),
    h('div', { class: 'ask-body' },
      h('p', { id: 'cf-text' }, t('files.conflict.text', { name })),
      detail ? h('p', { class: 'mod-note ask-note' }, detail) : null,
      h('ul', { class: 'ask-items' }, option(t('files.conflict.both'), t('files.conflict.bothHint', { copy })), option(t('files.conflict.replace'), t('files.conflict.replaceHint')))),
    h('footer', { class: 'mod-foot ask-foot' }, cancel, replace, both));
  const { done, result } = openModal({ container, section, inertTargets, first: both, cancel: null });
  both.addEventListener('click', () => done('both'));
  replace.addEventListener('click', () => done('replace'));
  cancel.addEventListener('click', () => done(null));
  return result;
}
