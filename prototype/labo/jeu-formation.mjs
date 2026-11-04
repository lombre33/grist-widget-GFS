// Le jeu de la formation de l'essai de la table de travail (run-travail.mjs) : les tables Sessions et Participants, le modèle « Convocation » de Publipostage+, ses deux règles de liaison et
// l'automatisme d'Automation+, éteint. Avant le 04/11, le bouton « Démo » de l'explorateur les posait ; le labo les écrit maintenant lui-même, par le cadre de GFS (accès complet), sans aucun geste de GFS.
// Les tables et leurs lignes sont celles de la famille « formation » de la galerie de Publipostage+, lues à leur place dans le sous-module (rien n'est copié, aucun nom de personne n'est ici),
// complétées des colonnes du parcours ; le texte de la convocation est celui de demo/inscriptions/.
import { readFile } from 'node:fs/promises';

const FAMILY = new URL('../apps/publipostage/templates-gallery/families/', import.meta.url);
const CONVOCATION = new URL('../demo/inscriptions/convocation.html', import.meta.url);
const AUTHOR = 'Grist Factory Suite (labo)';

// Les colonnes que le parcours ajoute à la famille. Celles qui ont une formule viennent dans un second temps, une fois les deux tables là.
const ADDED = {
  Sessions: [
    { id: 'Places', type: 'Int', label: 'Places' },
    { id: 'Confirmees', type: 'Int', label: 'Inscriptions confirmées', formula: 'len(Participants.lookupRecords(Session=$id, Statut="Confirmée"))' },
    { id: 'PlacesRestantes', type: 'Int', label: 'Places restantes', formula: '$Places - $Confirmees' },
  ],
  Participants: [
    { id: 'Statut', type: 'Choice', label: 'Statut', choices: ['Confirmée', 'Liste d’attente', 'Annulée'] },
    { id: 'PlacesSession', type: 'Int', label: 'Places restantes de la session', formula: '$Session.PlacesRestantes' },
  ],
};

// Ce qu'on met sur les lignes d'exemple de la famille, dans leur ordre. Première session : 12 places, toutes prises (les 14 premières inscriptions : 12 confirmées, une en liste d'attente,
// une annulée) ; seconde : 8 places, 5 prises. Une inscription créée à la première passe en liste d'attente, une créée à la seconde est confirmée.
const STATUTS = [...Array(12).fill('Confirmée'), 'Liste d’attente', 'Annulée', ...Array(4).fill('Confirmée'), 'Annulée', 'Confirmée'];
const ROWS = { Sessions: [{ Places: 12 }, { Places: 8 }], Participants: STATUTS.map(Statut => ({ Statut })) };

// Les tables des apps, comme chaque app les crée elle-même (Publipostage+ : js/templates.js ; Automation+ : js/store.js).
const MODELS = [['Nom', 'Text'], ['Contenu', 'Text'], ['NomFichierPDF', 'Text'], ['DateModif', 'DateTime'], ['TypeModele', 'Text'], ['HeaderFooter', 'Text'], ['Margins', 'Text'], ['ModifiePar', 'Text']];
const LINKS = [['TableCible', 'Text'], ['Mode', 'Text'], ['ColonneCible', 'Text'], ['ColonneSource', 'Text']];
const AUTOMATION = [['Type', 'Text'], ['Table', 'Text'], ['Date', 'DateTime:UTC'], ['Actif', 'Bool'], ['Version', 'Int'], ['Resume', 'Text'], ['Config', 'Text'], ['Evenement', 'Text'],
  ['Ligne', 'Int'], ['Resultat', 'Text'], ['Detail', 'Text']];
const AUTHOR_COLUMN = { id: 'Auteur', type: 'Text', isFormula: false, formula: 'user.Email', recalcWhen: 0 };
const columnsOf = list => list.map(([id, type]) => ({ id, type }));

// L'automatisme : une inscription créée est confirmée s'il reste une place dans sa session, sinon elle passe en liste d'attente.
const GRAPH = {
  version: 3, active: false,
  nodes: [
    { id: 'n1', type: 'trigger', x: 40, y: 80, config: { action: 'create', column: '', targetColumn: '', targetValue: '' } },
    { id: 'n2', type: 'condition', x: 320, y: 80, config: { join: 'and', checks: [{ column: 'PlacesSession', operator: 'gt', value: '0' }] } },
    { id: 'n3', type: 'action', x: 620, y: 0, config: { type: 'UpdateRecord', table: '', matchColumn: '', matchValue: '', column: 'Statut', value: 'Confirmée' } },
    { id: 'n4', type: 'action', x: 620, y: 200, config: { type: 'UpdateRecord', table: '', matchColumn: '', matchValue: '', column: 'Statut', value: 'Liste d’attente' } },
  ],
  edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n2', to: 'n4', branch: 'else' }],
};

const readJson = async name => JSON.parse(await readFile(new URL(name, FAMILY), 'utf8'));
const specOf = column => ({ type: column.type, ...(column.label ? { label: column.label } : {}), ...(column.choices ? { widgetOptions: JSON.stringify({ choices: column.choices }) } : {}) });
// Une date de la famille ('2026-11-09') en secondes, minuit UTC, comme Grist garde une colonne Date.
const seconds = text => Date.parse(text) / 1000;

// Les lignes d'une table : une colonne de donnée à la fois ; une Référence vise l'identifiant que Grist a donné (`given` : table visée -> identifiant d'exemple -> identifiant réel).
function rowsAction(id, columns, rows, given) {
  const values = {};
  for (const column of columns.filter(item => !item.formula)) {
    const target = column.type.startsWith('Ref:') ? given.get(column.type.slice(4)) : null;
    values[column.id] = rows.map(row => {
      const value = row[column.id];
      if (value === undefined || value === null) return column.type === 'Text' || column.type === 'Choice' ? '' : null;
      if (target) return target.get(value) || 0;
      return column.type === 'Date' && typeof value === 'string' ? seconds(value) : value;
    });
  }
  return ['BulkAddRecord', id, rows.map(() => null), values];
}

// Pose le jeu dans le document que `frame` (le cadre de GFS, accès complet) montre.
export async function poserFormation(frame) {
  const apply = actions => frame.evaluate(list => grist.docApi.applyUserActions(list), actions);
  const family = await readJson('formation.json');
  const examples = (await readJson('formation.exemple.json')).rows;
  const tables = family.tables.map(table => ({ id: table.id, columns: [...table.columns, ...(ADDED[table.id] || [])] }));
  // Les tables d'abord (une Référence peut viser une table créée plus loin dans le lot), les formules ensuite, puis les lignes.
  await apply(tables.map(({ id, columns }) => ['AddTable', id, columns.filter(column => !column.formula).map(column => ({ id: column.id, ...specOf(column) }))]));
  await apply(tables.flatMap(({ id, columns }) => columns.filter(column => column.formula).map(column => ['AddColumn', id, column.id, { ...specOf(column), isFormula: true, formula: column.formula }])));
  const given = new Map();
  for (const { id, columns } of tables) {
    const rows = (examples[id] || []).map((row, i) => ({ ...row, ...((ROWS[id] || [])[i] || {}) }));
    const [ids] = (await apply([rowsAction(id, columns, rows, given)])).retValues;
    given.set(id, new Map(rows.map((row, i) => [row.id, ids[i]])));
  }
  // La Référence montre la colonne que dit la famille (`show`) : le numéro de la session, comme dans la galerie de Publipostage+.
  const shown = tables.flatMap(({ id, columns }) => columns.filter(column => column.show).map(column => ({ table: id, column: column.id, target: column.type.slice(4), show: column.show })));
  await apply(await frame.evaluate(async list => {
    const [tablesData, columnsData] = await Promise.all([grist.docApi.fetchTable('_grist_Tables'), grist.docApi.fetchTable('_grist_Tables_column')]);
    const refOf = (table, name) => {
      const parent = tablesData.id[tablesData.tableId.indexOf(table)];
      return columnsData.id.find((ref, i) => columnsData.parentId[i] === parent && columnsData.colId[i] === name);
    };
    return list.flatMap(({ table, column, target, show }) => [
      ['UpdateRecord', '_grist_Tables_column', refOf(table, column), { visibleCol: refOf(target, show) }],
      ['SetDisplayFormula', table, null, refOf(table, column), `$${column}.${show}`],
    ]);
  }, shown));
  // Les tables des apps, avec ce qu'il faut pour l'essai : le modèle « Convocation », ses règles de liaison, l'automatisme.
  const convocation = await readFile(CONVOCATION, 'utf8');
  await apply([['AddTable', 'Publipostage_Modeles', columnsOf(MODELS)], ['AddTable', 'Publipostage_LiensTables', columnsOf(LINKS)], ['AddTable', 'Automation', [...columnsOf(AUTOMATION), AUTHOR_COLUMN]]]);
  await apply([
    ['AddRecord', 'Publipostage_Modeles', null, {
      Nom: 'Convocation', Contenu: convocation, NomFichierPDF: 'Convocation #Participants.Nom', DateModif: Math.floor(Date.now() / 1000), TypeModele: 'document', ModifiePar: AUTHOR,
      Margins: JSON.stringify({ top: 22, right: 22, bottom: 22, left: 22, orientation: 'portrait', format: 'A4' }),
    }],
    ['AddRecord', 'Publipostage_LiensTables', null, { TableCible: 'Sessions', Mode: 'match', ColonneCible: 'id', ColonneSource: 'Session' }],
    ['AddRecord', 'Publipostage_LiensTables', null, { TableCible: 'Participants', Mode: 'match', ColonneCible: 'Session', ColonneSource: 'id' }],
    ['AddRecord', 'Automation', null, {
      Type: 'Workflow', Table: 'Participants', Actif: false, Version: GRAPH.version, Config: JSON.stringify(GRAPH),
      Resume: 'Une inscription créée est confirmée s’il reste une place dans sa session, sinon elle passe en liste d’attente.',
    }],
  ]);
}
