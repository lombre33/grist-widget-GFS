// Les états de document que les essais du partage rejouent (js/sharing-model.js) : la règle intégrée de Grist, un document sans rien, un document avec la table des fichiers de GFS, et `applied`,
// qui rejoue les actions d'un plan sur un état (les tables, les colonnes, les ressources et les règles seulement). Un seul lieu pour ces fixtures : sharing-model.test.mjs et plan-sharing-golden.test.mjs.
export const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', rulePos: null, memo: '' };
export const base = () => ({ resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ ...BUILT_IN }], tables: [], columns: [] });
export const withFiles = (extra = []) => ({ ...base(), tables: [{ id: 7, tableId: 'GFS_Fichiers' }], columns: [{ parentId: 7, colId: 'Identifiant' }, { parentId: 7, colId: 'Auteur' }, ...extra] });

export const applied = (existing, actions) => {
  const next = { ...existing, resources: [...existing.resources], rules: [...existing.rules], tables: [...existing.tables], columns: [...existing.columns] };
  for (const [name, table, id, values] of actions) {
    if (name === 'AddTable') {
      const added = { id: 100 + next.tables.length, tableId: table };
      next.tables.push(added);
      for (const column of values === undefined ? id : []) next.columns.push({ parentId: added.id, colId: column.id });
    }
    if (name === 'AddColumn') next.columns.push({ parentId: next.tables.find(row => row.tableId === table).id, colId: id });
    if (name === 'AddRecord' && table === '_grist_ACLResources') next.resources.push({ id, ...values });
    if (name === 'AddRecord' && table === '_grist_ACLRules') next.rules.push({ id, ...values });
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLRules') next.rules = next.rules.filter(rule => !id.includes(rule.id));
    if (name === 'BulkRemoveRecord' && table === '_grist_ACLResources') next.resources = next.resources.filter(resource => !id.includes(resource.id));
  }
  return next;
};
