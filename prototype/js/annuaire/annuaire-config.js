// La définition d'un annuaire (module Annuaire, demande du porteur du 25/11) : une ligne de la table `GFS_Annuaires` que GFS crée avec l'accord de la personne
// (js/files/own-table.js). Ce module ne parle ni à Grist ni à la page : il dit ce que la table contient et lit, sans jamais échouer, ce qu'une personne ou une
// version plus ancienne y a écrit.
//
// Une ligne : `Nom` (le nom de l'annuaire), `Table` (la table des personnes, celle du document), `Config` (le reste, en JSON : voir `readConfig`) et `Parent`
// (réservé aux sous-annuaires, vide pour un annuaire principal). Les personnes restent dans leur table : GFS n'y écrit rien et ne la copie pas (cahier 2,
// « deux zones »). Un niveau de la hiérarchie est une colonne au choix (décision du porteur, 25/11), éventuellement après des références : son `path` liste
// les colonnes à suivre depuis la personne.

export const ANNUAIRES_TABLE = 'GFS_Annuaires';
export const ANNUAIRES_COLUMNS = Object.freeze([
  { id: 'Nom', type: 'Text' }, { id: 'Table', type: 'Text' }, { id: 'Config', type: 'Text' }, { id: 'Parent', type: 'Text' },
]);
export const CONFIG_VERSION = 1;

// Un champ est une colonne de la table des personnes (`col`), ou, depuis le retour du porteur du 25/11 (« je n'ai pas de colonne pour le pôle, c'est dans la
// table des postes, mais j'ai une référence de poste »), un chemin de colonnes à suivre (`path`, au moins deux : « Poste › Pôle ») ; `col` en est alors le nom,
// les colonnes jointes par ce séparateur : c'est la clé du champ partout (la liste, les filtres).
export const FIELD_SEPARATOR = ' › ';

const text = value => (typeof value === 'string' ? value.trim() : '');
const path = value => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

// Les colonnes de la personne que GFS lit par un nom : toutes facultatives, sauf le nom. `name` est le nom complet (« Camille Martin ») ou, quand `first` est
// dit, le nom de famille seul ; `first` est le prénom (la bonne pratique : deux colonnes, pour trier par nom, saluer par le prénom et éviter les doublons).
export const PERSON_KEYS = Object.freeze(['name', 'first', 'title', 'email', 'phone', 'lead', 'manager']);
// L'ordre dans lequel le nom s'écrit quand le prénom est une colonne à part : « Camille Durand », « Durand Camille », « Durand, Camille » ; `upper` (un oui/non
// à côté) met le nom de famille en capitales (« Camille DURAND », retour du porteur, 25/11).
export const NAME_ORDERS = Object.freeze(['first-last', 'last-first', 'last-comma']);

// La configuration lue d'un texte JSON (ou d'un objet) : toujours complète, jamais d'exception. Ce que GFS ne connaît pas (une clé d'une version plus récente)
// est ignoré à la lecture et perdu à la réécriture : `writeConfig` ne garde que ce qu'elle connaît ; une version plus récente écrit donc sa propre ligne. { v,
// name, first, order, upper, hierarchy, title, email, phone, lead, manager, levels: [{ label, path: [colonnes] }], relations: [{ col, label, inverse, card }],
//   fields: [{ col, path, filter, list }] }
// `relations` (demande du porteur, 25/11 : assistant·e, référent·e, suppléant·e) : voir js/annuaire/annuaire-relations.js ; une colonne ne sert qu'une fois (au
// responsable direct, à une relation ou à un champ).
// `hierarchy` : l'option « postes et hiérarchie » (décision du porteur, 25/11 : par défaut seulement le nom et l'adresse). Une ligne écrite avant elle, qui a
// déjà un poste ou des niveaux, la garde allumée : rien ne change pour elle. Éteinte, elle garde ses niveaux écrits (on les retrouve en la rallumant) mais
// la lecture ne s'en sert pas : voir `effectiveConfig`.
export function readConfig(source) {
  let raw = source;
  if (typeof source === 'string') {
    try { raw = JSON.parse(source); } catch (error) { raw = null; }
  }
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const config = { v: CONFIG_VERSION };
  for (const key of PERSON_KEYS) config[key] = text(input[key]);
  const levels = Array.isArray(input.levels) ? input.levels : [];
  config.order = NAME_ORDERS.includes(input.order) ? input.order : NAME_ORDERS[0];
  config.upper = input.upper === true;
  config.levels = levels.map(level => ({ label: text(level && level.label), path: path(level && level.path) })).filter(level => level.path.length > 0);
  config.hierarchy = typeof input.hierarchy === 'boolean' ? input.hierarchy : Boolean(config.levels.length || config.title || config.lead);
  const relations = Array.isArray(input.relations) ? input.relations : [];
  const used = new Set([config.manager]);
  config.relations = relations.map(rel => ({ col: text(rel && rel.col), label: text(rel && rel.label), inverse: text(rel && rel.inverse),
    card: !(rel && rel.card === false) }))
    .filter(rel => rel.col && !used.has(rel.col) && used.add(rel.col));
  const fields = Array.isArray(input.fields) ? input.fields : [];
  const seen = new Set();
  config.fields = fields.map(field => {
    const route = path(field && field.path);
    const steps = route.length ? route : [text(field && field.col)].filter(Boolean);
    return { col: steps.join(FIELD_SEPARATOR), path: steps.length > 1 ? steps : [], filter: Boolean(field && field.filter),
      list: Boolean(field && field.list) };
  }).filter(field => field.col && !seen.has(field.col) && seen.add(field.col));
  return config;
}

// Les colonnes qu'un champ suit depuis la personne, et le nom qu'on lui donne à l'écran (la dernière colonne du chemin).
export const fieldPath = field => (field.path && field.path.length ? field.path : [field.col]);
export const fieldLabel = field => fieldPath(field).at(-1);

export const writeConfig = config => JSON.stringify(readConfig(config));

// Ce que la lecture et les écrans utilisent : la configuration sans ce que l'option « postes et hiérarchie » éteinte met de côté (le poste, « responsable de sa
// structure » et les niveaux). Les autres colonnes, dont le responsable direct, ne dépendent pas d'elle. Une configuration qui n'a pas passé par `readConfig`
// (sans `hierarchy`) est lue comme allumée : seul « faux » l'éteint.
export const effectiveConfig = config => (config.hierarchy === false ? { ...config, title: '', lead: '', levels: [] } : config);

// Les annuaires d'une table lue : [{ row, name, table, config, parent }]. Une ligne sans nom ou sans table est ignorée (GFS ne saurait pas l'ouvrir).
export function annuairesOf(data) {
  const rows = data && Array.isArray(data.id) ? data.id : [];
  const cell = (column, i) => (Array.isArray(data[column]) ? data[column][i] : undefined);
  const found = [];
  rows.forEach((row, i) => {
    const name = text(cell('Nom', i));
    const table = text(cell('Table', i));
    if (name && table) found.push({ row, name, table, config: readConfig(cell('Config', i)), parent: text(cell('Parent', i)) });
  });
  return found;
}

// Le dossier d'un nouvel annuaire, tel que `AddRecord` le reçoit.
export const newRecord = (name, table, config) => ({ Nom: text(name), Table: text(table), Config: writeConfig(config), Parent: '' });

// Les actions de Grist qui créent ou réécrivent une ligne : `AddRecord` (la table, un identifiant nul, les valeurs) et `UpdateRecord`.
export const addAction = (tableId, record) => ['AddRecord', tableId, null, record];
export const updateAction = (tableId, row, record) => ['UpdateRecord', tableId, row, record];
// L'action qui ajoute une colonne vide (retour du porteur, 25/11 : « le widget propose de la créer ») ; `type` : un type de Grist (« Text », « Ref:Personnes
// »…).
export const addColumnAction = (tableId, name, type) => ['AddColumn', tableId, text(name), { type, isFormula: false, label: text(name) }];
