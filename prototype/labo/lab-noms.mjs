// Ce que les essais de la bascule des noms partagent : le traducteur de la vraie Publipostage+ (son `schema-columns.js`, chargé tel qu'elle l'écrit) et le lot de renommage qu'il calcule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { rowsOf } from './lab-rest.mjs';

const REPO = process.env.REPO_DIR;

// Le traducteur de l'app, chargé tel qu'elle l'écrit : son `planRenames` donne le lot que l'app enverrait à Grist (les deux interrupteurs allumés, comme dans le widget servi).
export function appRegistry() {
  const source = readFileSync(join(process.env.PP_DIR || join(REPO, 'prototype/apps/publipostage'), 'js/schema-columns.js'), 'utf8');
  const sandbox = { grist: { docApi: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__SC = SchemaColumns;`, sandbox);
  return sandbox.__SC;
}

// Ce que l'app lit du document pour calculer son lot : les noms des tables et le libellé de chaque colonne (les métadonnées de Grist, comme son `readSchema`).
export async function appBatch(run, registry) {
  const tables = await rowsOf(run, '_grist_Tables');
  const columns = await rowsOf(run, '_grist_Tables_column');
  const names = new Set(tables.map(row => row.tableId));
  const byRef = new Map(tables.map(row => [row.id, row.tableId]));
  const labels = new Map();
  for (const column of columns) {
    const table = byRef.get(column.parentId);
    if (!table) continue;
    if (!labels.has(table)) labels.set(table, new Map());
    labels.get(table).set(column.colId, column.label);
  }
  return registry.planRenames(names, id => labels.get(id) || null);
}

