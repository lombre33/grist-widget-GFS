// La liste de la fenêtre « Dépendances » (js/apps/dependencies-window.js), rangée par app (demande du porteur, 18/11 : « regroupé par app, et par défaut
// seulement celles des apps activées, avec un panneau refermé "montrer également les dépendances des apps non activées" »). Une section par app installée ;
// sous elles, un panneau refermé qui garde les apps non installées et les bibliothèques qu'aucune app ne demande. Une bibliothèque se trouve dans chaque app
// qui l'utilise, vue depuis cette app (js/apps/dependencies-model.js, `scopeRow`) : son état, ses fonctions et le choix de sa source ne parlent que d'elle.
// Rien ne s'écrit ici : les gestes vont à `pick`.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { groupsOf } from './dependencies-model.js';
import { buildDetail, externalLink } from './dependencies-detail.js';
import { sourceOf } from './dependencies-source.js';
import { carriedBlock } from './dependencies-carried-view.js';

// L'état d'une ligne de la colonne « Dernière stable » : un mot et une icône, la couleur ne le porte jamais seule.
const GAP_LOOK = { 'a-jour': ['ok', 'check'], correctif: ['info', 'download'], mineure: ['info', 'download'], majeure: ['warn', 'download'],
  avance: ['muted', 'info'],
  inconnu: ['muted', 'info'] };

// La colonne « Dernière stable » : l'avis le plus grave l'emporte sur l'écart de version.
function latestCell(t, row) {
  const [tone, glyph] = row.worst ? ['bad', 'warning'] : GAP_LOOK[row.releveAncien ? 'inconnu' : row.ecart];
  const text = row.worst ? t('dep.gap.avis', { level: t(`dep.level.${row.worst.niveau}`) }) : t(`dep.gap.${row.releveAncien ? 'inconnu' : row.ecart}`);
  return h('span', { class: 'dp-cell' }, h('span', { class: `dp-chip dp-${tone}` }, icon(glyph), text),
    h('span', { class: 'dp-sub dp-latest', title: row.latest ? t('dep.latest', { version: row.latest }) : null }, row.latest || ''));
}

// Le bouton d'une ligne : son nom et son état en mots, les autres apps qui la demandent, la version servie avec ses modes, la dernière stable.
function rowButton(t, row, open, onToggle) {
  const { mode } = sourceOf(row);
  const tag = (kind, shown) => h('span', { class: `dp-tag${shown === mode ? ' is-on' : ''}` }, shown === mode ? icon('check') : null, t(`dep.tag.${kind}`),
    shown === mode ? h('span', { class: 'fp-sr' }, ` (${t('dep.tag.on')})`) : null);
  const tags = [tag('copy', 'vendorise'), row.hasCdn ? tag('cdn', 'cdn') : null];
  return h('button', { type: 'button', class: 'dp-row', 'aria-expanded': String(open), dataset: { fk: `dep-${row.slot}` }, on: { click: onToggle } },
    h('span', { class: 'dp-cell dp-lib' }, h('span', { class: 'dp-dot', dataset: { state: row.state }, 'aria-hidden': 'true' }),
      h('span', { class: 'dp-cell' }, h('strong', { class: 'dp-name' }, row.paquet),
        h('span', { class: 'dp-sub' }, [row.functions.join(', '), t(`dep.state.${row.state}`)].filter(Boolean).join(' · ')))),
    h('span', { class: 'dp-cell dp-users' }, row.others.length ? row.others.join(', ') : '—'),
    h('span', { class: 'dp-cell dp-gfs' }, h('span', { class: 'dp-ver' }, row.version), h('span', { class: 'dp-tags' }, ...tags)),
    latestCell(t, row), h('span', { class: 'dp-chev', 'aria-hidden': 'true' }, icon('chev-down')));
}

// La vérification d'une copie : « en cours », puis ce que l'audit rend (ou l'erreur) ; chaque détail ouvert de cette bibliothèque la montre tout de suite (elle
// peut être ouverte sous deux apps).
async function runCheck(state, row, verify) {
  const shown = next => {
    state.checks.set(row.key, next);
    for (const each of state.details.values()) if (each.key === row.key) each.detail.setIntegrity(next);
  };
  shown('running');
  try { shown(await verify(row)); } catch (error) {
    shown([{ state: 'erreur', reason: String((error && error.message) || error).slice(0, 120), address: '' }]); }
}

// opts : { t, locale, state ({ open: Set de `slot`, more, checks, details, rows, carried }), date (la date du relevé, lisible), matches(row) -> booléen (les
//   filtres et la recherche), matchesCarried(entrée) -> booléen (de même, pour ce que les apps déclarent), plain() -> aucun filtre ni recherche, verify(row),
//   blocked() -> texte | null, pick(row, mode), after({ shown, rest }) (les lignes montrées, et celles du panneau : de quoi dire le vide) }.
// Rend { node, render(), items() } : `items` est ce que les flèches parcourent (les lignes et le bouton du panneau).
export function buildList(opts) {
  const { t, locale, state, date } = opts;
  const groups = h('div', { class: 'dp-groups' });
  const body = h('div', { class: 'dp-more-body', id: 'dp-more-body', hidden: true });
  const more = h('div', { class: 'dp-more' });
  const node = h('div', { class: 'dp-lists' }, groups, more);

  const showDetail = (row, li) => {
    const detail = buildDetail({ t, locale, row, surveyed: date, state: state.checks.get(row.key) || null, verify: () => void runCheck(state, row, opts.verify),
      blocked: opts.blocked(), pick: mode => opts.pick(row, mode) });
    state.details.set(row.slot, { key: row.key, detail });
    li.append(detail.node);
  };
  const toggle = (row, li) => {
    const open = !state.open.has(row.slot);
    if (open) state.open.add(row.slot); else state.open.delete(row.slot);
    li.classList.toggle('is-open', open);
    li.querySelector('.dp-row').setAttribute('aria-expanded', String(open));
    if (open) { showDetail(row, li); return; }
    li.querySelector('.dp-detail').remove();
    state.details.delete(row.slot);
  };
  const item = row => {
    const open = state.open.has(row.slot);
    const li = h('li', { class: `dp-item${open ? ' is-open' : ''}`, dataset: { key: row.key, scope: row.scope } });
    li.append(rowButton(t, row, open, () => toggle(row, li)));
    const href = row.site || row.depot;
    if (href) li.append(externalLink(t, { href, what: t(row.site ? 'dep.d.site' : 'dep.d.repo'), name: row.paquet, text: '', cls: 'dp-ext' }));
    if (open) showDetail(row, li);
    return li;
  };
  // Une app : son nom, combien de bibliothèques, si elle est installée ; la liste de ses lignes.
  const section = group => {
    const id = `dp-g-${group.id || 'none'}`;
    const chip = !group.name ? null : h('span', { class: `dp-chip dp-${group.installed ? 'ok' : 'muted'}` }, icon(group.installed ? 'check' : 'info'),
      t(group.installed ? 'dep.group.on' : 'dep.group.off'));
    return h('section', { class: 'dp-group', dataset: { group: group.id || 'none' }, 'aria-labelledby': id },
      h('header', { class: 'dp-group-head' }, h('h3', { id }, group.name || t('dep.group.none')),
        h('span', { class: 'dp-sub' }, t('dep.group.count', { n: group.rows.length + group.carried.length })), chip),
      group.rows.length ? h('ul', { class: 'dp-list' }, ...group.rows.map(item)) : null, carriedBlock({ t, group, state, plain: opts.plain() }));
  };
  const toggleMore = () => {
    state.more = !state.more;
    render();
    more.querySelector('.dp-more-btn').focus({ preventScroll: true });
  };
  const moreButton = count => h('button', { type: 'button', class: 'dp-more-btn', 'aria-expanded': String(state.more), 'aria-controls': 'dp-more-body',
    dataset: { fk: 'dep-more' }, on: { click: toggleMore } }, icon('chev-down'), t('dep.more', { n: count }));

  function render() {
    // Une app qui dit n'en charger aucune reste montrée tant qu'aucun filtre ni recherche ne l'écarte : l'absence de déclaration n'est pas la même chose.
    const found = groupsOf(state.rows, state.carried).map(group => ({ ...group, rows: group.rows.filter(opts.matches),
      carried: group.carried.filter(opts.matchesCarried) })).filter(group => group.rows.length || group.carried.length ||
        (opts.plain() && group.declared !== null));
    const shown = found.filter(group => group.installed);
    const rest = found.filter(group => !group.installed);
    const count = list => new Set(list.flatMap(group => [...group.rows, ...group.carried].map(row => row.key))).size
      + list.filter(group => !group.rows.length && !group.carried.length).length;
    state.details.clear();
    groups.replaceChildren(...shown.map(section));
    body.replaceChildren(...(state.more ? rest.map(section) : []));
    body.hidden = !state.more;
    more.replaceChildren(...(rest.length ? [moreButton(count(rest)), body] : []));
    opts.after({ shown: count(shown), rest: count(rest) });
  }
  const items = () => [...node.querySelectorAll('.dp-row, .dp-more-btn')].filter(each => !each.closest('[hidden]'));
  return { node, render, items };
}
