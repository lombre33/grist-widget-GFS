// La démo du parcours « inscriptions à une formation » (étude d'orchestration du 21/10) : le bouton « Démo » de l'explorateur, visible seulement
// avec `?dev` dans l'adresse du widget, comme la galerie de développement de Publipostage+. Après l'accord de la personne, un seul geste pose
// les tables Sessions et Participants (le schéma et les exemples de la famille « formation » de la galerie de Publipostage+, lus à leur place,
// plus les colonnes du parcours et leurs formules), installe les apps, trois modèles de Publipostage+ et un automatisme d'Automation+.
// Exception voulue par le porteur (21/10), au mode développement seulement : GFS écrit ici dans les tables de deux apps, sous la forme que
// chacune lit (Publipostage+ : js/templates.js, js/grist-api.js ; Automation+ : js/store.js). Ce code peut disparaître, ou devenir les
// « parcours prêts à installer » de l'étape 7.

import { TABLE as RANGEMENT } from './rangement.js';

export const DEMO_PACK = 'demo/inscriptions.json';
const DAY = 86400;
const AUTHOR = 'Grist Factory Suite (démo)';
const lower = text => String(text).toLowerCase();

// Les tables des apps, telles que chaque app les crée elle-même.
export const APP_TABLES = Object.freeze({
  models: { id: 'Publipostage_Modeles', columns: [['Nom', 'Text'], ['Contenu', 'Text'], ['NomFichierPDF', 'Text'], ['DateModif', 'DateTime'], ['TypeModele', 'Text'],
    ['HeaderFooter', 'Text'], ['Margins', 'Text'], ['ModifiePar', 'Text']], required: ['Nom', 'Contenu'] },
  links: { id: 'Publipostage_LiensTables', columns: [['TableCible', 'Text'], ['Mode', 'Text'], ['ColonneCible', 'Text'], ['ColonneSource', 'Text']],
    required: ['TableCible', 'Mode', 'ColonneCible', 'ColonneSource'] },
  automation: { id: 'Automation', columns: [['Type', 'Text'], ['Table', 'Text'], ['Date', 'DateTime:UTC'], ['Actif', 'Bool'], ['Version', 'Int'], ['Resume', 'Text'],
    ['Config', 'Text'], ['Evenement', 'Text'], ['Ligne', 'Int'], ['Resultat', 'Text'], ['Detail', 'Text']], required: ['Type', 'Table', 'Config'],
  // La colonne « Auteur » d'Automation+ : une formule déclenchée à la création de la ligne.
  extra: [{ id: 'Auteur', type: 'Text', isFormula: false, formula: 'user.Email', recalcWhen: 0 }] },
});

// Une erreur de la démo : `code` (taken, renamed) et ce qui la précise.
export class DemoError extends Error {
  constructor(code, detail) { super(`${code} : ${detail}`); this.code = code; this.detail = detail; }
}

// Une date du parcours : `{ jours: n }` (n jours après aujourd'hui, jour de la personne), ou une date ISO de la galerie ; en secondes, minuit UTC, comme Grist garde une Date.
export function dateValue(value, now) {
  if (value && typeof value === 'object' && Number.isFinite(value.jours)) return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 1000 + value.jours * DAY;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value) / 1000;
  return value;
}

// ---------- lire le parcours ----------

// Le parcours prêt à poser : `read` = { json(chemin), text(chemin) }, chemins relatifs à GFS. Les tables reprennent la famille de la galerie de Publipostage+,
// complétée des colonnes du parcours ; leurs lignes sont les exemples de la famille, complétés ligne à ligne.
export async function loadDemo(read) {
  const raw = await read.json(DEMO_PACK);
  const family = await read.json(`${raw.galerie}families/${raw.famille}.json`);
  const examples = await read.json(`${raw.galerie}families/${raw.famille}.exemple.json`);
  const tables = Object.entries(raw.tables).map(([id, spec]) => {
    const base = family.tables.find(table => table.id === id);
    if (!base) throw new Error(`la famille « ${raw.famille} » n'a pas de table ${id}`);
    return { id, columns: [...base.columns, ...spec.ajouter] };
  });
  const rows = Object.fromEntries(tables.map(({ id }) => [id, ((examples.rows || {})[id] || []).map((row, i) => ({ ...row, ...((raw.lignes[id] || [])[i] || {}) }))]));
  const gallery = await read.json(`${raw.galerie}catalogue.json`);
  const models = await Promise.all(raw.publipostage.modeles.map(spec => loadModel(spec, raw.galerie, gallery, read)));
  return { name: raw.nom, tables, rows, apps: raw.apps, models, links: raw.publipostage.liens, workflow: raw.automation };
}

// Un modèle : un modèle de la galerie de Publipostage+ (son texte, sa page, son en-tête), ou un texte du parcours.
async function loadModel(spec, base, gallery, read) {
  if (!spec.galerie) return { name: spec.nom, type: spec.type || 'document', html: await read.text(spec.contenu), pdf: spec.pdf || '', page: spec.page, headerFooter: null };
  const entry = gallery.find(item => item.id === spec.galerie);
  if (!entry || !entry.pack) throw new Error(`la galerie n'a pas le modèle ${spec.galerie}`);
  const pack = await read.json(base + entry.pack);
  return {
    name: spec.nom, type: pack.template.type, html: await read.text(base + entry.html), pdf: pack.template.pdfName || '',
    page: { format: pack.template.page.format, orientation: pack.template.page.orientation, marges: pack.template.page.margins },
    headerFooter: entry.headerFooter ? await read.json(base + entry.headerFooter) : null,
  };
}

// ---------- ce que le document a déjà ----------

// Les tables et colonnes du document, par nom en minuscules : { id, ref, columns: Map(nom -> { id, ref }) }.
export async function readSchema(doc) {
  const [tables, columns] = await Promise.all([doc.fetchTable('_grist_Tables'), doc.fetchTable('_grist_Tables_column')]);
  const byRef = new Map();
  const schema = new Map();
  (tables.id || []).forEach((ref, i) => {
    const entry = { id: tables.tableId[i], ref, columns: new Map() };
    byRef.set(ref, entry);
    if (entry.id) schema.set(lower(entry.id), entry);
  });
  (columns.id || []).forEach((ref, i) => {
    const table = byRef.get(columns.parentId[i]);
    if (table) table.columns.set(lower(columns.colId[i]), { id: columns.colId[i], ref });
  });
  return schema;
}

// Le plan : les tables du parcours déjà là arrêtent tout (rien n'est écrit) ; les tables des apps et de GFS qui manquent seront créées.
export function planDemo(pack, schema) {
  const taken = pack.tables.map(table => table.id).filter(id => schema.has(lower(id)));
  const created = [APP_TABLES.models.id, APP_TABLES.links.id, APP_TABLES.automation.id, RANGEMENT].filter(id => !schema.has(lower(id)));
  return { taken, created };
}

// ---------- les actions de Grist ----------

const columnSpec = column => {
  const spec = { type: column.type };
  if (column.label) spec.label = column.label;
  if (column.choices) spec.widgetOptions = JSON.stringify({ choices: column.choices });
  return spec;
};

// Le premier lot : les tables, avec leurs seules colonnes de donnée (une Référence peut viser une table créée plus loin dans le lot).
export const tableActions = pack => pack.tables.map(table => ['AddTable', table.id, table.columns.filter(column => !column.formula).map(column => ({ id: column.id, ...columnSpec(column) }))]);

// Le deuxième lot : les formules, une fois toutes les tables là.
export const formulaActions = pack => pack.tables.flatMap(table => table.columns.filter(column => column.formula)
  .map(column => ['AddColumn', table.id, column.id, { ...columnSpec(column), isFormula: true, formula: column.formula }]));

const emptyOf = type => (type === 'Bool' ? false : (type === 'Text' || type === 'Choice' ? '' : null));

// Les lignes d'une table : une colonne de donnée à la fois, dates en secondes, Références traduites vers les identifiants que Grist vient de donner
// (`ids` : table visée -> identifiant d'exemple -> identifiant réel).
export function rowsAction(table, rows, now, ids) {
  const values = {};
  for (const column of table.columns.filter(item => !item.formula)) {
    const target = column.type.startsWith('Ref:') ? ids.get(column.type.slice(4)) : null;
    values[column.id] = rows.map(row => {
      const value = row[column.id];
      if (value === undefined || value === null) return emptyOf(column.type);
      if (target) return target.get(value) || 0;
      return column.type === 'Date' || column.type.startsWith('DateTime') ? dateValue(value, now) : value;
    });
  }
  return ['BulkAddRecord', table.id, rows.map(() => null), values];
}

// La colonne qu'affiche une Référence (`show` de la famille) : comme le fait la galerie de Publipostage+ après avoir créé ses tables.
export function displayActions(pack, schema) {
  const actions = [];
  for (const table of pack.tables) {
    for (const column of table.columns.filter(item => item.show && item.type.startsWith('Ref:'))) {
      const own = schema.get(lower(table.id));
      const target = schema.get(lower(column.type.slice(4)));
      const col = own && own.columns.get(lower(column.id));
      const shown = target && target.columns.get(lower(column.show));
      if (!col || !shown) continue;
      actions.push(['UpdateRecord', '_grist_Tables_column', col.ref, { visibleCol: shown.ref }]);
      actions.push(['SetDisplayFormula', table.id, null, col.ref, `$${column.id}.${column.show}`]);
    }
  }
  return actions;
}

// Un nom libre parmi les modèles déjà là : « Convocation », sinon « Convocation (2) »…
export function freeName(name, taken) {
  const used = new Set(taken.map(lower));
  if (!used.has(lower(name))) return name;
  let n = 2;
  while (used.has(lower(`${name} (${n})`))) n += 1;
  return `${name} (${n})`;
}

// La ligne d'un modèle, dans les seules colonnes que la table a (une colonne absente annulerait tout le lot).
export function modelRecord(model, name, columns, now) {
  const [top, right, bottom, left] = (model.page && model.page.marges) || [];
  const margins = model.page ? { ...(top === undefined ? {} : { top, right, bottom, left }), orientation: model.page.orientation, format: model.page.format } : null;
  const record = {
    Nom: name, Contenu: model.html, NomFichierPDF: model.pdf, DateModif: Math.floor(now.getTime() / 1000), TypeModele: model.type,
    HeaderFooter: model.headerFooter ? JSON.stringify(model.headerFooter) : null, Margins: margins ? JSON.stringify(margins) : null, ModifiePar: AUTHOR,
  };
  return Object.fromEntries(Object.entries(record).filter(([column, value]) => value !== null && columns.has(lower(column))));
}

export const linkRecord = link => ({ TableCible: link.table, Mode: link.mode, ColonneCible: link.cible || '', ColonneSource: link.source || '' });

export const workflowRecord = workflow => ({ Type: 'Workflow', Table: workflow.table, Actif: false, Version: workflow.graphe.version, Resume: workflow.resume, Config: JSON.stringify({ ...workflow.graphe, active: false }) });

// ---------- ce que la personne lit ----------

// Ce que la fenêtre d'accord annonce, avant tout geste.
export function demoSummary(pack, plan, t) {
  const count = id => (pack.rows[id] || []).length;
  const lines = [
    t('demo.tables', { sessions: count('Sessions'), participants: count('Participants') }),
    t('demo.models', { n: pack.models.length, links: pack.links.length }),
    t('demo.automation'),
  ];
  if (plan.created.length) lines.push(t('demo.appTables', { tables: plan.created.join(', ') }));
  return [...lines, t('demo.pages')];
}

// Le compte rendu : ce qui a été posé, et la table d'une app qui n'a pas servi.
export function demoReport(report, t) {
  const lines = [t('demo.doneModels', { n: report.models.count, links: report.links.count })];
  if (report.workflow.count) lines.push(t('demo.doneWorkflow'));
  for (const part of [report.models, report.links, report.workflow]) if (part.skipped) lines.push(t('demo.skipped', { table: part.skipped }));
  return lines;
}

// ---------- poser ----------

async function created(doc, actions) {
  const result = await doc.applyUserActions(actions);
  return ((result && result.retValues) || []).map(made => (made && made.table_id) || null);
}

// Les tables du parcours : créées ensemble ; un nom que Grist aurait changé (une table née entre-temps) retire tout ce que le lot a créé.
async function createTables(doc, pack) {
  const wanted = pack.tables.map(table => table.id);
  const given = await created(doc, tableActions(pack));
  if (given.some((id, i) => id !== wanted[i])) {
    await removeTables(doc, given.filter(Boolean));
    throw new DemoError('renamed', given.join(', '));
  }
  return given;
}

const removeTables = (doc, ids) => (ids.length ? doc.applyUserActions(ids.map(id => ['RemoveTable', id])).catch(() => {}) : Promise.resolve());

// Les lignes, table après table : les Références visent les identifiants que Grist vient de donner.
async function addRows(doc, pack, now) {
  const ids = new Map();
  for (const table of pack.tables) {
    const rows = pack.rows[table.id] || [];
    if (!rows.length) continue;
    const result = await doc.applyUserActions([rowsAction(table, rows, now, ids)]);
    const given = (result && result.retValues && result.retValues[0]) || [];
    ids.set(table.id, new Map(rows.map((row, i) => [row.id, given[i]])));
  }
}

// La table d'une app : celle qui est là (ses colonnes), ou créée comme l'app la crée. Rend les colonnes, ou null quand elle ne peut pas servir.
async function appTable(doc, schema, spec) {
  const found = schema.get(lower(spec.id));
  if (found) {
    if (found.id !== spec.id || !spec.required.every(column => found.columns.has(lower(column)))) return null;
    return new Set(found.columns.keys());
  }
  const base = spec.columns.map(([id, type]) => ({ id, type }));
  let columns = [...base, ...(spec.extra || [])];
  let given;
  // Comme Automation+ : un Grist qui refuse la formule d'auteur reçoit la table sans elle.
  try { [given] = await created(doc, [['AddTable', spec.id, columns]]); } catch (error) {
    if (!spec.extra) throw error;
    columns = base;
    [given] = await created(doc, [['AddTable', spec.id, columns]]);
  }
  if (given !== spec.id) return null;
  return new Set(columns.map(column => lower(column.id)));
}

async function rowsOf(doc, id) {
  const data = await doc.fetchTable(id);
  return (data.id || []).map((rowId, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
}

async function addModels(doc, schema, pack, now) {
  const columns = await appTable(doc, schema, APP_TABLES.models);
  if (!columns) return { count: 0, skipped: APP_TABLES.models.id };
  const names = (await rowsOf(doc, APP_TABLES.models.id)).map(row => row.Nom);
  const records = pack.models.map(model => {
    const name = freeName(model.name, names);
    names.push(name);
    return ['AddRecord', APP_TABLES.models.id, null, modelRecord(model, name, columns, now)];
  });
  await doc.applyUserActions(records);
  return { count: records.length };
}

// Une seule règle par table, pour tout le document : une règle déjà posée reste telle quelle.
async function addLinks(doc, schema, pack) {
  if (!(await appTable(doc, schema, APP_TABLES.links))) return { count: 0, skipped: APP_TABLES.links.id };
  const existing = new Set((await rowsOf(doc, APP_TABLES.links.id)).map(row => row.TableCible));
  const actions = pack.links.filter(link => !existing.has(link.table)).map(link => ['AddRecord', APP_TABLES.links.id, null, linkRecord(link)]);
  if (actions.length) await doc.applyUserActions(actions);
  return { count: actions.length };
}

// L'automatisme, éteint : la personne l'active dans Automation+. Un automatisme déjà enregistré pour la table n'est pas touché.
async function addWorkflow(doc, schema, pack) {
  const spec = APP_TABLES.automation;
  if (!(await appTable(doc, schema, spec))) return { count: 0, skipped: spec.id };
  const known = (await rowsOf(doc, spec.id)).some(row => row.Type === 'Workflow' && row.Table === pack.workflow.table);
  if (known) return { count: 0, skipped: spec.id };
  await doc.applyUserActions([['AddRecord', spec.id, null, workflowRecord(pack.workflow)]]);
  return { count: 1 };
}

// Le geste entier. `install(ids)` installe les apps du parcours dans GFS. Rend ce qui a été posé : { models, links, workflow } (chacun { count, skipped? }).
export async function runDemo({ doc, pack, now, install }) {
  const before = await readSchema(doc);
  const { taken } = planDemo(pack, before);
  if (taken.length) throw new DemoError('taken', taken.join(', '));
  const tables = await createTables(doc, pack);
  try {
    const formulas = formulaActions(pack);
    if (formulas.length) await doc.applyUserActions(formulas);
    await addRows(doc, pack, now);
    const shown = displayActions(pack, await readSchema(doc));
    if (shown.length) await doc.applyUserActions(shown);
  } catch (error) {
    await removeTables(doc, tables);
    throw error;
  }
  await install(pack.apps);
  const schema = await readSchema(doc);
  return { models: await addModels(doc, schema, pack, now), links: await addLinks(doc, schema, pack), workflow: await addWorkflow(doc, schema, pack) };
}
