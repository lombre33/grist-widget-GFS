// La vue « À vérifier » du guide (module Guide, demande du porteur du 27/11, maquette « À vérifier ») : les démarches qui ont un point à regarder (un contact
// introuvable, aucun contact, pas relue depuis longtemps, un brouillon, une boucle), les plus graves d'abord, chacune avec ses points en pastilles ; une
// démarche à relire se « marque vérifiée » d'un clic (le seul geste d'écriture de la vue). Des fonctions qui construisent des nœuds ; le relevé vient de
// js/guide/guide-checks.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { SEVERITY } from './guide-checks.js';

// La phrase d'un point : ce qu'il y a à regarder, avec les noms quand il y en a.
function issueText(issue, t) {
  const names = (issue.labels || []).join(', ');
  if (issue.code === 'stale') return issue.since ? t('gd.chk.stale', { date: issue.since }) : t('gd.chk.never');
  return t(`gd.chk.${issue.code}`, { role: issue.role || '', names });
}

// Un point, en pastille : rouge quand c'est un contact introuvable ou une boucle, neutre sinon.
const issueChip = (issue, t) => h('span', { class: `gd-chip${SEVERITY[issue.code] <= 2 ? ' is-warn' : ''}` },
  SEVERITY[issue.code] <= 2 ? icon('warning') : null,
  h('span', null, issueText(issue, t)));

// Une ligne : la démarche (elle s'ouvre), ses points, et « Marquer vérifiée » quand elle est à relire. `mark` : { blocked (le texte qui l'empêche, ou '') }.
function checkRow({ proc, issues }, { t, mark }) {
  const stale = issues.some(issue => issue.code === 'stale');
  return h('li', { class: 'gd-ck' }, h('button', { type: 'button', class: 'gd-ck-b', dataset: { act: 'open', row: String(proc.row), fk: `ck:${proc.row}` } },
    h('span', { class: 'gd-ck-t' }, proc.title), h('span', { class: 'gd-ck-chips' }, ...issues.map(issue => issueChip(issue, t)))),
  stale ? h('button', { type: 'button', class: 'btn sm gd-ck-mark', 'aria-disabled': mark.blocked ? 'true' : null, title: mark.blocked || t('gd.chk.markTip'),
    dataset: { act: 'mark', row: String(proc.row), fk: `ckm:${proc.row}` } }, icon('check'), t('gd.chk.mark')) : null);
}

// La vue : l'explication, ce qui manque pour suivre la relecture (grisé, jamais caché : la phrase dit comment l'allumer), puis les démarches à regarder, ou
// la phrase qui dit que tout est à jour. `checks` : js/guide/guide-checks.js `checksOf`.
export function checkView(model, { t, checks, mark }) {
  const { config } = model;
  return h('div', { class: 'gd-card gd-check-card' }, h('p', { class: 'gd-hint' }, t('gd.chk.hint')),
    config.verified ? null : h('p', { class: 'gd-note' }, icon('info'), h('span', null, t('gd.chk.noColumn'))),
    checks.items.length ? h('ul', { class: 'gd-cks' }, ...checks.items.map(item => checkRow(item, { t, mark }))) :
      h('p', { class: 'gd-ok' }, icon('check'), h('span', null, t('gd.chk.allGood'))));
}
