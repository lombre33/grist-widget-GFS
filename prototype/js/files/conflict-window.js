// La fenêtre « Ce nom est déjà pris » (contrats 6.6) : un fichier qu'on range porte le nom d'un fichier que GFS garde déjà. Une seule fenêtre pour tous les
// rangements, sur la base commune
// des fenêtres (js/ui/modal.js), que le fichier vienne de la personne (« Nouveau > Importer ») ou d'une app qui le range (contrats 5.4, point 9). Trois
// issues :
// « Remplacer » (le fichier existant
// prend le contenu du nouveau et garde sa place), « Garder les deux » (le nouveau prend le nom libre « Nom (1).pdf ») ou rien (Annuler, Échap : ni l'un ni
// l'autre
// ne change). Le clavier est sur « Garder les deux » : un Entrée distrait n'écrase rien.
// Quand une app range des fichiers en lot, une case « Faire pareil pour les suivants » évite de revoir la fenêtre à chaque nom pris : elle vaut quelle que soit
// l'issue, y compris renoncer.

import { h } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';

// opts : { container, inertTargets() -> [élément], t, name (le nom en conflit), detail (qui dit le fichier existant : sa date, son auteur), copy (le nom que
//   prendrait la copie),
//          app? (le nom de l'app qui range le fichier : la phrase la nomme et la fenêtre dit aussi ce que « Annuler » fait), repeat? (offrir la case « Faire
//          pareil pour les suivants ») }.
// Rend { choice: 'replace' | 'both' | 'skip', again } : `skip` quand la personne renonce, `again` quand la case est cochée.
export function askConflict({ container, inertTargets, t, name, detail, copy, app = '', repeat = false }) {
  const both = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'conflict-both' } }, t('files.conflict.both'));
  const replace = h('button', { type: 'button', class: 'btn', dataset: { fk: 'conflict-replace' } }, t('files.conflict.replace'));
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'conflict-cancel' } }, t('table.cancel'));
  const again = repeat ? h('input', { type: 'checkbox', dataset: { fk: 'conflict-again' } }) : null;
  const option = (label, text) => h('li', {}, h('b', {}, label), `${t('files.conflict.sep')}${text}`);
  const options = [option(t('files.conflict.both'), t('files.conflict.bothHint', { copy })),
    option(t('files.conflict.replace'), t('files.conflict.replaceHint'))];
  if (app) options.push(option(t('table.cancel'), t('files.conflict.skipHint')));
  const section = h('section', { class: 'mod ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'cf-title', 'aria-describedby': 'cf-text' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'cf-title' }, t('files.conflict.title'))),
    h('div', { class: 'ask-body' },
      h('p', { id: 'cf-text' }, app ? t('files.conflict.textFrom', { app, name }) : t('files.conflict.text', { name })),
      detail ? h('p', { class: 'mod-note ask-note' }, detail) : null,
      h('ul', { class: 'ask-items' }, ...options),
      again ? h('label', { class: 'ask-again' }, again, t('files.conflict.again')) : null),
    h('footer', { class: 'mod-foot ask-foot' }, cancel, replace, both));
  const { done, result } = openModal({ container, section, inertTargets, first: both, cancel: 'skip' });
  both.addEventListener('click', () => done('both'));
  replace.addEventListener('click', () => done('replace'));
  cancel.addEventListener('click', () => done('skip'));
  return result.then(choice => ({ choice, again: Boolean(again && again.checked) }));
}
