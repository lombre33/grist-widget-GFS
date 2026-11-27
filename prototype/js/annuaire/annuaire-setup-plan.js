// L'onglet « Lieux » du réglage de l'annuaire (module Annuaire, demande du porteur du 27/11 : le plan des bâtiments, « le plan comme base ») : deux choix. La
// table des lieux (les sites, bâtiments, étages et locaux, une ligne chacun : GFS la crée avec l'accord de la personne, ou la personne en désigne une qui a
// déjà ses colonnes) et la colonne de la table des personnes qui dit où chacun travaille (une référence à cette table : elle se choisit, ou se crée, liée à la
// table des lieux). Rien ne s'écrit avant « Créer la table » et « Créer la colonne », qui disent ce qui s'écrit (js/annuaire/annuaire-setup-table.js,
// js/annuaire/annuaire-setup-path.js) ; la table et la colonne ne servent qu'une fois le réglage enregistré. Grisé, jamais masqué : la colonne du bureau reste
// là tant que la table n'est pas choisie, avec ce qui lui manque. `host` : voir js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { PLAN_TABLE } from './annuaire-config.js';
import { pickColumn } from './annuaire-setup-path.js';
import { PLAN_SPEC, createTableWindow } from './annuaire-setup-table.js';
import { chooser, formRow, block } from './annuaire-setup-shared.js';

// Les tables qui ont déjà les colonnes d'une table de lieux (le nom, le genre, le parent) : celles qu'on peut désigner sans en créer une.
const needed = Object.freeze([PLAN_TABLE.name, 'Kind', PLAN_TABLE.parent]);
const looksLikePlaces = table => needed.every(id => table.columns.some(col => col.id === id));

export function planTab(host) {
  const { t, draft } = host;
  const { plan } = draft.config;
  const why = plan.table ? '' : t('an.plan.needTable');
  return h('div', { class: 'an-tabpanel an-obs' }, h('p', { class: 'an-set-help' }, t('an.plan.help')),
    block(t('an.plan.block'), t('an.plan.blockSub'),
      formRow(t('an.plan.table'), chooser(t, 'pl:table', plan.table, { act: 'plan-table' }), t('an.plan.tableHint')),
      formRow(t('an.plan.office'), chooser(t, 'pl:office', plan.office, { act: 'plan-office' }, { disabled: !plan.table, title: why }),
        why || t('an.plan.officeHint')),
      h('p', { class: 'an-set-hint an-ob-note' }, t('an.plan.note'))));
}

// La table des lieux : la liste avec recherche, dont la première ligne propose de la créer.
async function pickTable(host) {
  const { t, schema, draft } = host;
  const { plan } = draft.config;
  for (;;) {
    const items = Object.keys(schema).filter(name => looksLikePlaces(schema[name])).sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name,
      glyph: 'table', hint: t('an.set.columns', { n: schema[name].columns.length }), alt: false }));
    const create = { value: 'new:', label: t('an.plan.item'), glyph: 'plus', hint: t('an.plan.itemHint'), pinned: true, alt: false };
    const chosen = await host.list({ title: t('an.plan.pickTable'), text: t('an.plan.pickTableText'), items: [create, ...items], current: plan.table,
      none: t('an.plan.noTable') });
    if (chosen === null) return;
    if (chosen === 'new:') {
      const made = await createTableWindow(host, PLAN_SPEC(host));
      if (!made) continue;
      adopt(host, made.table);
      return;
    }
    if (chosen !== plan.table) adopt(host, chosen);
    return;
  }
}

// Une autre table de lieux : la colonne du bureau, qui visait l'ancienne, se choisit de nouveau.
function adopt(host, table) {
  const { plan } = host.draft.config;
  plan.table = table;
  plan.office = '';
  host.changed();
  host.focus('pl:office');
}

// La colonne du bureau : une référence de la table des personnes à la table des lieux, à choisir ou à créer (liée à cette table, qui montre le nom du lieu) ;
// « Aucune » la vide.
async function pickOffice(host) {
  const { t, draft } = host;
  const { plan } = draft.config;
  if (!plan.table) return;
  const chosen = await pickColumn(host, { title: t('an.plan.pickOffice'), text: t('an.plan.pickOfficeText'), clear: true, current: plan.office,
    types: [{ type: `Ref:${plan.table}`, label: t('an.plan.refType'), show: PLAN_TABLE.name, suggest: t('an.plan.officeName') }],
    filter: col => col.genre === 'ref' && col.ref === plan.table });
  if (chosen === null) return;
  plan.office = chosen;
  host.changed();
  host.focus('pl:office');
}

const ACTS = Object.freeze({ 'plan-table': host => void pickTable(host), 'plan-office': host => void pickOffice(host) });

// Rend true quand le geste est de cet onglet.
export function planAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}
