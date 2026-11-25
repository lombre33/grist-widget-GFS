// L'onglet « Hiérarchie » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11 ; fenêtre « Niveaux » de la maquette). Une option, éteinte par
// défaut, débloque tout ce qui touche au poste et à la hiérarchie ; allumée, il faut au moins un niveau qui a sa colonne. La liste des niveaux se lit du plus
// haut au plus bas, avec l'aperçu de l'arbre que les données donnent. Un niveau se crée en trois temps : son nom, sa place parmi les autres (la fenêtre
// « Nouveau niveau »), puis sa colonne : orange tant qu'elle manque. `host` : voir js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { columnOf } from './annuaire-schema.js';
import { levelLabel } from './annuaire-items.js';
import { columnItems, chooser, formRow, switchButton, iconButton, shift, MAX_PATH } from './annuaire-setup-shared.js';

const PREVIEW_NODES = 80; // combien de lignes l'aperçu écrit avant « … »

// Ce qu'un niveau lit, en morceaux : la table des personnes, les colonnes suivies, et la colonne que Grist montre pour la dernière quand c'est une référence.
function sourceOf(host, level) {
  const { schema, draft } = host;
  let table = draft.table;
  let last = null;
  for (const colId of level.path) { last = columnOf(schema, table, colId); table = last && last.ref ? last.ref : ''; }
  const shows = last && last.ref && last.visible ? host.t('an.lv.shows', { col: last.visible }) : '';
  return { parts: [draft.table, ...level.path], shows };
}

function levelCard(host, level, at) {
  const { t, draft, ui, preview } = host;
  const levels = draft.config.levels;
  const todo = level.path.length === 0;
  const fresh = ui.fresh === level && levels.length > 1; // un seul niveau : tout est nouveau, rien à repérer
  const count = preview.counts ? preview.counts[at] : 0;
  const { parts, shows } = sourceOf(host, level);
  const crumbs = parts.flatMap((part, i) => (i ? [icon('chev-right'), h('b', null, part)] : [h('span', null, part)]));
  const path = todo
    ? h('button', { type: 'button', class: 'an-lv-todo', dataset: { act: 'pick-level', index: String(at), fk: `lp:${at}` } }, icon('warning'), t('an.lv.todo'))
    : h('button', { type: 'button', class: 'an-lv-path', title: t('an.lv.change'), dataset: { act: 'pick-level', index: String(at), fk: `lp:${at}` } },
      ...crumbs,
      shows ? h('span', { class: 'an-lv-shows' }, shows) : null);
  const input = h('input', { type: 'text', class: 'an-lv-name', value: level.label, placeholder: levelLabel(level) || t('an.set.levelName'),
    'aria-label': t('an.set.levelName'), autocomplete: 'off', dataset: { fk: `ll:${at}`, input: 'level', index: String(at) } });
  const acts = h('span', { class: 'an-lv-acts' },
    iconButton(t, { glyph: 'chev-up', label: t('an.set.up'), fk: `lu:${at}`, data: { act: 'level-up', index: String(at) }, disabled: at === 0 }),
    iconButton(t, { glyph: 'chev-down', label: t('an.set.down'), fk: `ld:${at}`, data: { act: 'level-down', index: String(at) },
      disabled: at === levels.length - 1 }),
    iconButton(t, { glyph: 'trash', label: t('an.set.remove'), fk: `lr:${at}`, data: { act: 'level-remove', index: String(at) } }));
  const card = h('div', { class: `an-lvrow${fresh ? ' is-new' : ''}${todo ? ' is-todo' : ''}` },
    h('div', { class: 'an-lv-top' }, input, fresh ? h('span', { class: 'an-tag' }, t('an.lv.new')) : null,
      h('span', { class: 'an-lv-cnt', dataset: { cnt: String(at) } }, !todo && count ? t('an.lv.values', { n: count }) : ''), acts),
    h('div', { class: 'an-lv-src' }, path));
  return fresh ? [h('div', { class: 'an-ins' }, t('an.lv.here')), card] : [card];
}

// L'aperçu de l'arbre : les noms rangés comme les données les rangent, un trait à gauche par étage (« nouveau » devant ce que le nouveau niveau ajoute).
function previewTree(host) {
  const { t, preview, ui, draft } = host;
  if (preview.state === 'loading') return h('p', { class: 'an-set-hint' }, t('an.lv.previewLoading'));
  if (preview.state === 'error') return h('p', { class: 'an-set-hint' }, t('an.lv.previewError'));
  if (preview.state !== 'ready') return h('p', { class: 'an-set-hint' }, t('an.lv.previewNone'));
  const fresh = ui.fresh && draft.config.levels.length > 1 ? draft.config.levels.indexOf(ui.fresh) : -1;
  let used = 0;
  const walk = node => {
    if (used >= PREVIEW_NODES) return null;
    used += 1;
    const kids = node.ch.map(walk).filter(Boolean);
    return h('li', null, node.level === fresh && fresh >= 0 ? h('b', null, node.name) : node.name, node.level === fresh &&
      fresh >= 0 ? h('span', { class: 'an-tag' }, t('an.lv.new')) : null,
      kids.length ? h('ul', null, ...kids) : null);
  };
  const root = walk(preview.tree);
  return h('div', { class: 'an-prev-tree' }, h('ul', { class: 'an-prev-root' }, root), used >= PREVIEW_NODES ? h('p', { class: 'an-set-hint' }, '…') : null);
}

// L'aperçu et les comptes des cartes, redessinés seuls : la frappe dans le nom d'un niveau garde son curseur.
export function paintPreview(host) {
  const box = host.body.querySelector('.an-prev');
  if (!box) return;
  box.replaceChildren(previewTree(host));
  for (const node of host.body.querySelectorAll('.an-lv-cnt')) {
    const at = Number(node.dataset.cnt);
    const level = host.draft.config.levels[at];
    node.textContent = level && level.path.length && host.preview.counts && host.preview.counts[at] ? host.t('an.lv.values', { n: host.preview.counts[at] }) :
      '';
  }
}

export function hierarchyTab(host) {
  const { t, draft, ui } = host;
  const { config, table } = draft;
  const on = config.hierarchy;
  const levels = config.levels;
  const more = ui.more || Boolean(config.lead);
  const need = { disabled: !table, title: table ? '' : t('an.set.needTable') };
  const option = h('section', { class: 'an-opt' }, h('div', { class: 'an-opt-text' }, h('h3', null, t('an.hier.title')),
    h('p', null, t(on ? 'an.hier.on' : 'an.hier.off'))),
    switchButton({ on, label: t('an.hier.title'), fk: 'hier-toggle', data: { act: 'hier-toggle' } }));
  const list = h('div', { class: 'an-lvl-list' }, ...levels.flatMap((level, at) => levelCard(host, level, at)),
    levels.length ? null : h('p', { class: 'an-set-hint' }, t('an.lv.empty')));
  const add = h('button', { type: 'button', class: `btn sm${levels.length ? '' : ' primary'}`, 'aria-disabled': table ? null : 'true',
    title: table ? null : t('an.set.needTable'),
    dataset: { act: 'level-add', fk: 'level-add' } }, icon('plus'), t('an.set.addLevel'));
  const moreRows = more ? [formRow(t('an.set.lead'), chooser(t, 'pc:lead', config.lead, { act: 'pick-person', key: 'lead' }, need), t('an.set.leadHint'))] : [];
  const body = h('div', { class: `an-hier-body${on ? '' : ' is-off'}`, inert: !on, 'aria-hidden': on ? null : 'true' },
    h('div', { class: 'an-hier-grid' }, h('div', { class: 'an-hier-left' },
      h('div', { class: 'an-lab-row' }, h('span', { class: 'an-lab' }, t('an.set.levels')), h('span', { class: 'an-set-hint' }, t('an.set.levelsSub'))), list,
        add,
      formRow(t('an.set.title'), chooser(t, 'pc:title', config.title, { act: 'pick-person', key: 'title' }, need), t('an.set.titleHint')),
      h('div', { class: 'an-disclose' }, h('button', { type: 'button', class: 'an-disclose-b', 'aria-expanded': String(more),
        dataset: { act: 'toggle-more', fk: 'toggle-more' } },
        icon(more ? 'chev-down' : 'chev-right'), t('an.set.more'))), ...moreRows),
    h('div', { class: 'an-hier-right' }, h('span', { class: 'an-lab' }, t('an.lv.preview')), h('div', { class: 'an-prev' }, previewTree(host)))));
  return h('div', { class: 'an-tabpanel' }, option, on ? null : h('p', { class: 'an-set-why' }, icon('info'), t('an.hier.greyed')), body);
}

// ---------- les gestes ----------

const ACTS = Object.freeze({
  'hier-toggle': host => { host.draft.config.hierarchy = !host.draft.config.hierarchy; host.changed(); },
  'toggle-more': host => { host.ui.more = !(host.ui.more || Boolean(host.draft.config.lead)); host.repaint(); },
  'level-add': host => void addLevel(host),
  'pick-level': (host, data) => void pickLevel(host, Number(data.index)),
  'level-up': (host, data) => move(host, Number(data.index), -1),
  'level-down': (host, data) => move(host, Number(data.index), 1),
  'level-remove': (host, data) => { host.draft.config.levels.splice(Number(data.index), 1); host.ui.fresh = null; host.changed(); },
});

function move(host, at, by) {
  const levels = host.draft.config.levels;
  if (!shift(levels, at, by)) return;
  host.ui.fresh = null;
  host.changed();
  host.focus(`${by < 0 ? 'lu' : 'ld'}:${at + by}`, `lp:${at + by}`);
}

// Rend true quand le geste est de cet onglet.
export function hierarchyAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}

// Le nom d'un niveau qu'on tape : l'état suit, sans redessiner (le curseur reste là).
export function levelInput(host, input) {
  const level = host.draft.config.levels[Number(input.dataset.index)];
  if (level) level.label = input.value;
}

// Le chemin d'un niveau : une colonne de la personne, ou une référence qu'on suit vers la table qu'elle vise (le fil dit où l'on est), et on recommence.
// Renoncer en route laisse le niveau comme il était (orange s'il n'avait pas de colonne).
async function pickLevel(host, at) {
  const { t, draft } = host;
  const level = draft.config.levels[at];
  if (!level) return;
  const path = [];
  let table = draft.table;
  while (path.length < MAX_PATH) {
    const chosen = await host.list({ title: t('an.lv.pickTitle', { name: levelLabel(level) || t('an.set.levelName') }), crumbs: [draft.table, ...path],
      text: path.length ? '' : t('an.set.pickLevelText'), items: columnItems(host.schema, table, t, { follow: path.length < MAX_PATH - 1 }),
        none: t('an.set.noColumn') });
    if (chosen === null) return;
    path.push(chosen.slice(chosen.indexOf(':') + 1));
    if (chosen.startsWith('use:')) break;
    table = columnOf(host.schema, table, path.at(-1)).ref;
  }
  level.path = path;
  host.changed();
  host.focus(`lp:${at}`);
}

// Un niveau nouveau : son nom, sa place, puis sa colonne.
async function addLevel(host) {
  const made = await newLevelWindow(host);
  if (!made) return;
  const level = { label: made.label, path: [] };
  host.draft.config.levels.splice(made.at, 0, level);
  host.ui.fresh = level;
  host.changed();
  await pickLevel(host, made.at);
}

// La fenêtre « Nouveau niveau » : le nom, puis la place dans l'échelle (du plus haut au plus bas), choisie entre les niveaux qui y sont déjà. Rend { label, at
// } ou null.
function newLevelWindow(host) {
  const { t, draft } = host;
  const levels = draft.config.levels;
  let at = levels.length;
  const input = h('input', { type: 'text', class: 'an-set-input', autocomplete: 'off', placeholder: t('an.lv.namePlaceholder'),
    'aria-label': t('an.lv.nameLabel'),
    dataset: { fk: 'nl-name' } });
  const slots = h('div', { class: 'an-slots', role: 'group', 'aria-label': t('an.lv.place') });
  const where = i => (i === 0 ? t('an.lv.top') : t('an.lv.under', { name: levelLabel(levels[i - 1]) }));
  const paint = () => {
    const kept = slots.ownerDocument.activeElement && slots.contains(slots.ownerDocument.activeElement) ? slots.ownerDocument.activeElement.dataset.fk : null;
    slots.replaceChildren(...Array.from({ length: levels.length + 1 }, (_, i) => [
      h('button', { type: 'button', class: `an-slot${i === at ? ' is-here' : ''}`, 'aria-pressed': String(i === at), title: where(i), 'aria-label': where(i),
        dataset: { slot: String(i), fk: `nl-slot:${i}` } }, h('span', { class: 'an-slot-t' },
          i === at ? `${input.value.trim() || t('an.lv.namePlaceholder')} · ${t('an.lv.here')}` : t('an.lv.placeHere'))),
      levels[i] ? h('div', { class: 'an-slot-lv' }, h('b', null, levelLabel(levels[i])), h('span', { class: 'an-set-hint' }, levels[i].path.join(' › '))) :
        null].filter(Boolean)).flat());
    const again = kept && [...slots.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === kept);
    if (again) again.focus({ preventScroll: true });
    const here = slots.querySelector('.is-here');
    if (here && typeof here.scrollIntoView === 'function') here.scrollIntoView({ block: 'nearest' });
  };
  const cancel = h('button', { type: 'button', class: 'btn', dataset: { fk: 'nl-cancel' } }, t('an.set.cancel'));
  const ok = h('button', { type: 'button', class: 'btn primary', 'aria-disabled': 'true', dataset: { fk: 'nl-ok' } }, t('an.lv.add'));
  const section = h('section', { class: 'mod an-nl', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-nl-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'an-nl-title' }, t('an.lv.newTitle'))),
    h('div', { class: 'mod-body an-set-body' }, formRow(t('an.lv.nameLabel'), input, t('an.lv.nameHint')), h('span', { class: 'an-lab' }, t('an.lv.place')),
      h('p', { class: 'an-set-hint' }, t('an.lv.placeHint')), slots),
    h('footer', { class: 'mod-foot' }, h('span', { class: 'mod-note' }), cancel, ok));
  paint();
  const { done, result } = openModal({ container: host.container, section, inertTargets: host.inertTargets, first: input, cancel: null });
  const confirm = () => { if (input.value.trim()) done({ label: input.value.trim(), at }); };
  input.addEventListener('input', () => { ok.setAttribute('aria-disabled', input.value.trim() ? 'false' : 'true'); paint(); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } });
  slots.addEventListener('click', event => {
    const slot = event.target.closest('[data-slot]');
    if (slot) { at = Number(slot.dataset.slot); paint(); }
  });
  cancel.addEventListener('click', () => done(null));
  ok.addEventListener('click', confirm);
  return result;
}
