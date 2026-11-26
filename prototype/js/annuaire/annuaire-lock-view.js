// Ce que la fenêtre du verrou montre (js/annuaire/annuaire-lock-window.js) : l'état, les règles que Grist appliquera dites en phrases, ce qui change, les
// règles exactes telles que Grist les range (l'aperçu du choix du porteur, 26/11 : « Oui, sur demande, avec aperçu »), et les gestes possibles. Du code pur :
// il reçoit les lignes des tables internes de Grist (lues par un propriétaire prouvé) et ne parle pas à Grist ; les plans sont à js/annuaire/annuaire-lock.js.

import { lockSpec, lockResources, planLock, planUnlock, lockState, lockKey } from './annuaire-lock.js';
import { planCloseStructure } from '../rights/rights-plan.js';
import { whoList } from './annuaire-edit-rights.js';

const FAILED = new Set(['no-table', 'no-email', 'no-column', 'level']);

// Les phrases des règles voulues : la table d'abord (ce que tout le monde lit en premier), puis les colonnes qui donnent des droits, puis la présence.
function sentences(spec, groups, { t, locale, config }) {
  const table = groups.find(group => group.colIds === '*');
  const keys = new Set(table.rules.map(rule => rule.key));
  const out = [t('an.lock.r.owners'), ...(keys.has('editors') ? [t('an.lock.r.editors', { who: whoList(config, t, locale) })] : []), t('an.lock.r.others')];
  if (spec.protect.length) out.push(t('an.lock.r.cols', { cols: spec.protect.join(', ') }));
  if (spec.presence) out.push(t('an.lock.r.presence', { col: spec.presence }));
  return out;
}

// Ce que le verrou change, en phrases : les colonnes d'aide, les outils qui écrivent dans la table, le rechargement, l'adresse e-mail qui reconnaît la
// personne, et la première règle du document (elle coûte l'import et la copie aux éditeurs).
function costs(plan, spec, { t }) {
  const columns = plan.columns || [];
  const named = kind => columns.filter(action => action[0] === kind).map(action => action[2]);
  const add = named('AddColumn');
  const fix = named('ModifyColumn');
  return [...(add.length ? [t('an.lock.c.columns', { n: add.length, table: spec.table, names: add.join(', ') })] : []),
    ...(fix.length ? [t('an.lock.c.update', { n: fix.length, names: fix.join(', ') })] : []), t('an.lock.c.tools'),
    ...(spec.self || spec.level || spec.presence ? [t('an.lock.c.who')] : []), ...(plan.firstRule ? [t('rights.ask.firstRule')] : []), t('an.lock.c.reload')];
}

// Les règles exactes : une entrée par ressource (la table, ou ses colonnes), chacune avec ses lignes « condition → droits », puis les formules des colonnes
// d'aide.
function codes(spec, groups, { t }) {
  const where = group => (group.colIds === '*' ? t('an.lock.code.all') : t('an.lock.code.cols', { cols: group.colIds.split(',').join(', ') }));
  return { groups: groups.map(group => ({ where: where(group), lines: group.rules.map(rule =>
    ({ formula: rule.formula || t('an.lock.code.rest'), rights: rule.rights })) })),
    helpers: spec.helpers.map(each => ({ id: each.id, formula: each.formula })) };
}

// Ce que la fenêtre dessine, d'après les lignes des tables internes de Grist (`raw` : { resources, rules, tables, columns }), le schéma et l'annuaire (`{
// table, config }`, celui qui est enregistré). Rend { state, text, ready (le verrou se pose ou se met à jour), put ('put' | 'update' : le mot du bouton, ou
// ''), remove, closed (la structure est fermée), offer (fermer aussi la structure : proposé), close (fermer la structure seule : le verrou est posé, la
// structure ouverte), rules, costs, codes, spec, say }.
export function lockModel({ raw, table, config, schema, t, locale }) {
  const say = key => t(`an.lock.note.${key}`);
  const spec = lockSpec({ table, config, schema });
  const state = lockState(raw, spec, say);
  const plan = planLock(raw, spec, say, { structure: true });
  const closed = !planCloseStructure(raw).ok;
  const ready = spec.ok && state !== 'foreign' && (plan.ok || plan.reason === 'no-helper');
  const base = { state, text: t(`an.lock.state.${state}`, { table }), ready, put: ready ? (state === 'stale' ? 'update' : 'put') : '', closed, spec, say,
    key: lockKey(config, table),
    remove: planUnlock(raw, table).ok, offer: ready && !closed, close: spec.ok && state === 'current' && !closed, rules: [], costs: [], codes: null };
  if (!spec.ok || FAILED.has(state) || state === 'foreign') return base;
  const groups = lockResources(spec, say);
  return { ...base, rules: sentences(spec, groups, { t, locale, config }), costs: state === 'current' ? [] : costs(plan, spec, { t }),
    codes: codes(spec, groups, { t }) };
}
