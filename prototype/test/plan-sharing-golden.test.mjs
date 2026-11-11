// Le plan d'activation du partage (planSharing, js/sharing/sharing-model.js) sous une batterie d'états du document : le plan rendu (actions, tables et colonnes créées, règles écrites, raison du refus) est comparé,
// à l'octet près, à celui que l'ancienne version écrivait avant d'être découpée en petites fonctions (test/golden/plan-sharing.json, réécrit à la main par `UPDATE_GOLDEN=1 node --test …` quand le plan
// DOIT changer, avec le diff relu). Ce qu'une règle fait dans Grist se mesure dans un vrai Grist : labo/run-partager.mjs, run-partager-auteur.mjs. Les cas particuliers sont aussi dans sharing-model.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { planSharing, planUnsharing, targetsOf } from '../js/sharing/sharing-model.js';
import { FILES_COLUMNS } from '../js/files/gfs-files.js';
import { BUILT_IN, base, withFiles, applied } from './sharing-fixtures.mjs';

const GOLDEN = fileURLToPath(new URL('./golden/plan-sharing.json', import.meta.url));
const PP = { id: 'publipostage', fichiers: [{ table: 'Publipostage_Modeles', colonnes: { id: 'id', nom: 'Nom' }, exclure: { TypeModele: ['reglages'] } }] };
const ids = { id: 'fichier', fichiers: [{ table: 'Autre_Fichiers', colonnes: { id: 'Jeton' } }] };
const withApp = (extra = {}) => ({ ...base(), tables: [{ id: 7, tableId: 'Publipostage_Modeles' }], columns: [{ parentId: 7, colId: 'Nom' }], targets: targetsOf([PP]), files: { Publipostage_Modeles: [3, 5] }, ...extra });

// Un texte long (une formule Python, une règle) est gardé par son empreinte : la fixture reste lisible, et un seul octet de différence se voit.
const LONG = 40;
const compact = value => {
  if (typeof value === 'string') return value.length > LONG ? `sha256:${createHash('sha256').update(value).digest('hex').slice(0, 16)} (${value.length} signes)` : value;
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, compact(one)]));
  return value;
};
// Une action par ligne : un diff de la fixture montre l'action qui change.
const written = golden => `{\n${Object.entries(golden).map(([name, one]) => ` ${JSON.stringify(name)}: {\n${Object.entries(one).map(([key, value]) => (key === 'actions'
  ? `  "actions": [\n${value.map(action => `   ${JSON.stringify(action)}`).join(',\n')}\n  ]` : `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)).join(',\n')}\n }`).join(',\n')}\n}\n`;
const plan = (existing, targets) => planSharing(existing, FILES_COLUMNS, targets);

function scenarios() {
  const out = {};
  const record = (name, existing, targets) => { out[name] = compact(plan(existing, targets)); };
  const done = applied(base(), plan(base()).actions);
  const hand = (resource, memo = 'écrite à la main') => ({ id: 90, resource, aclFormula: '', permissionsText: '-D', memo });
  record('document vierge', base());
  record('table de fichiers déjà là', withFiles());
  record('une colonne d\'aide déjà là', withFiles([{ parentId: 7, colId: 'GFS_Lecteurs' }]));
  record('colonne d\'aide d\'auteur déjà là', withFiles([{ parentId: 7, colId: 'GFS_Auteur' }]));
  record('table de fichiers sans « Auteur »', { ...withFiles(), columns: [{ parentId: 7, colId: 'Identifiant' }] });
  record('déjà activé', done);
  record('règle d\'un autre auteur sur la table de partages', { ...base(), tables: [{ id: 3, tableId: 'GFS_Fichiers' }], resources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Fichiers', colIds: '*' }], rules: [{ ...BUILT_IN }, hand(2)] });
  record('règle d\'un autre auteur sur une table de fichiers', { ...withFiles(), resources: [{ id: 1, tableId: '', colIds: '' }, { id: 2, tableId: 'GFS_Fichiers', colIds: '*' }], rules: [{ ...BUILT_IN }, hand(2)] });
  record('avec une app', withApp());
  record('avec une app et ses numéros de lignes', withApp({ files: { Publipostage_Modeles: [3, 5, 8] } }));
  record('avec une app sans ses numéros', withApp({ files: undefined }));
  record('avec deux apps', { ...withApp(), targets: targetsOf([PP, ids]) });
  record('une app absente du document', { ...base(), targets: targetsOf([PP]) });
  record('règle d\'un autre auteur sur la table d\'une app', withApp({ resources: [{ id: 1, tableId: '', colIds: '' }, { id: 4, tableId: 'Publipostage_Modeles', colIds: '*' }], rules: [{ ...BUILT_IN }, hand(4)] }));
  const later = { ...done, tables: [...done.tables, { id: 7, tableId: 'Publipostage_Modeles' }], columns: [...done.columns, { parentId: 7, colId: 'Nom' }], targets: targetsOf([PP]), files: { Publipostage_Modeles: [1] } };
  record('une app ajoutée après coup', later);
  record('l\'app ajoutée, déjà complétée', applied(later, plan(later).actions));
  record('après un retrait', applied(done, planUnsharing(done).actions));
  const old = { ...done, tables: done.tables.filter(row => !['GFS_Espaces', 'GFS_Placement'].includes(row.tableId)) };
  const goneResources = done.resources.filter(row => ['GFS_Espaces', 'GFS_Placement'].includes(row.tableId)).map(row => row.id);
  old.resources = done.resources.filter(row => !goneResources.includes(row.id));
  old.rules = done.rules.filter(rule => !goneResources.includes(rule.resource) && !String(rule.aclFormula || '').includes('GFS_Refus'));
  old.columns = done.columns.filter(col => !['GFS_Calc', 'GFS_Refus'].includes(col.colId));
  record('partagé avant les espaces', old);
  record('sans la table des groupes', { ...done, tables: done.tables.filter(row => row.tableId !== 'GFS_Groupes') });
  record('sans les règles des espaces', { ...done, rules: done.rules.filter(rule => !done.resources.some(res => res.id === rule.resource && res.tableId === 'GFS_Espaces')) });
  record('sans la règle des refus', { ...done, rules: done.rules.filter(rule => !String(rule.aclFormula || '').includes('GFS_Refus')) });
  record('sans une colonne d\'aide d\'une app', { ...later, columns: later.columns.filter(col => col.colId !== 'GFS_Lecteurs') });
  record('sans la table de rangement', { ...done, tables: done.tables.filter(row => row.tableId !== 'GFS_Rangement') });
  record('cibles données à part', base(), targetsOf([ids]));
  record('fichiers rangés avant', { ...withFiles(), fileIds: [4, 9] });
  record('fichiers rangés par table', { ...withFiles(), files: { GFS_Fichiers: [2, 3] } });
  return JSON.parse(JSON.stringify(out, (key, value) => (value === undefined ? null : value)));
}

test('planSharing : le plan de chaque état du document est celui qu\'écrivait la version d\'avant le découpage (fixture test/golden/plan-sharing.json)', () => {
  const actual = scenarios();
  if (process.env.UPDATE_GOLDEN) { writeFileSync(GOLDEN, written(actual)); return; }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(actual), Object.keys(golden), 'les mêmes états');
  for (const name of Object.keys(golden)) assert.deepEqual(actual[name], golden[name], name);
});
