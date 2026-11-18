// La partie « Portées par l'app » d'une section de la fenêtre « Dépendances » (js/apps/dependencies-list.js ; demande du porteur, 18/11 : « Oui,
// déclaré par chaque app ») : ce que l'app dit charger elle-même, avec la version, l'adresse contactée et le moment du chargement, et dans le
// détail ce qu'elle contient et ce que GFS n'en sait pas. Tout y est noté « déclarée par l'app » : GFS ne la sert pas, n'en vérifie ni la version
// ni la source, et n'a rien à en choisir. Lecture seule : aucun geste n'écrit ici, et aucune adresse n'est offerte en lien (elle vient de l'app,
// pas du relevé de GFS).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { fact } from './dependencies-detail.js';

// Le détail : d'où vient la ligne, puis ce que l'app en dit.
function carriedDetail(t, row) {
  const facts = [
    fact(t('dep.c.origin'), h('span', { class: 'dp-chip dp-muted' }, icon('info'), t('dep.c.chip')), h('p', { class: 'dp-sub' }, t('dep.c.origin.text'))),
    fact(t('dep.c.version'), row.version || t('dep.c.version.none')),
    row.contains.length ? fact(t('dep.c.contains'), h('ul', { class: 'dp-lines' }, ...row.contains.map(name => h('li', null, name)))) : null,
    fact(t('dep.c.address'), h('code', { class: 'dp-fp' }, row.address)),
    fact(t('dep.c.when'), t(`dep.c.when.${row.when}.long`)),
    row.note ? fact(t('dep.c.note'), row.note) : null,
    row.gfs ? fact(t('dep.c.gfs'), t('dep.c.gfs.text', { version: row.gfs.version, name: row.paquet })) : null,
  ].filter(Boolean);
  return h('div', { class: 'dp-detail' }, h('dl', { class: 'dp-facts' }, ...facts));
}

// Le bouton d'une ligne : le nom et, dessous, quand elle se charge et ce qu'elle contient ; la version déclarée ; l'hôte contacté.
function carriedButton(t, row, open, onToggle) {
  const sub = [t(`dep.c.when.${row.when}`), row.contains.length ? t('dep.c.with', { names: row.contains.join(', ') }) : ''].filter(Boolean).join(' · ');
  return h('button', { type: 'button', class: 'dp-row dp-crow', 'aria-expanded': String(open), dataset: { fk: `dep-${row.slot}` }, on: { click: onToggle } },
    h('span', { class: 'dp-cell' }, h('strong', { class: 'dp-name' }, row.name), h('span', { class: 'dp-sub' }, sub)),
    h('span', { class: 'dp-cell' }, row.version ? h('span', { class: 'dp-ver' }, row.version) : h('span', { class: 'dp-sub' }, t('dep.c.version.none'))),
    h('span', { class: 'dp-cell dp-host' }, row.host), h('span', { class: 'dp-chev', 'aria-hidden': 'true' }, icon('chev-down')));
}

function carriedItem(t, row, state) {
  const open = state.open.has(row.slot);
  const li = h('li', { class: `dp-item${open ? ' is-open' : ''}`, dataset: { key: row.key, scope: row.app } });
  const toggle = () => {
    const now = !state.open.has(row.slot);
    if (now) state.open.add(row.slot); else state.open.delete(row.slot);
    li.classList.toggle('is-open', now);
    li.querySelector('.dp-row').setAttribute('aria-expanded', String(now));
    if (now) li.append(carriedDetail(t, row)); else li.querySelector('.dp-detail').remove();
  };
  li.append(carriedButton(t, row, open, toggle));
  if (open) li.append(carriedDetail(t, row));
  return li;
}

// Le bloc d'une app : `group` (js/apps/dependencies-model.js, `groupsOf`, ses `carried` déjà filtrés par la recherche), `plain` : ni filtre ni
// recherche (alors une app qui dit n'en charger aucune le dit). Rend le nœud, ou null quand il n'y a rien à dire.
export function carriedBlock({ t, group, state, plain }) {
  const { carried, declared } = group;
  if (!carried.length && !(plain && declared !== null)) return null;
  const id = `dp-c-${group.id}`;
  const head = h('header', { class: 'dp-carried-head' }, h('h4', { id }, t('dep.c.title')),
    h('span', { class: 'dp-sub' }, t('dep.group.count', { n: carried.length })),
    h('span', { class: 'dp-chip dp-muted' }, icon('info'), t('dep.c.chip')));
  if (!carried.length) return h('div', { class: 'dp-carried', role: 'group', 'aria-labelledby': id }, head,
    h('p', { class: 'dp-sub dp-carried-note' }, t(declared ? 'dep.c.allserved' : 'dep.c.none')));
  return h('div', { class: 'dp-carried', role: 'group', 'aria-labelledby': id }, head, h('p', { class: 'dp-sub dp-carried-note' }, t('dep.c.note.top')),
    h('div', { class: 'dp-carried-cols', 'aria-hidden': 'true' }, ...['lib', 'version', 'address'].map(key => h('span', null, t(`dep.c.col.${key}`))),
      h('span')),
    h('ul', { class: 'dp-list' }, ...carried.map(row => carriedItem(t, row, state))));
}
