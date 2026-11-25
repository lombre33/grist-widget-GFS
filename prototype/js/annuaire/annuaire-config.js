// La définition d'un annuaire (module Annuaire, demande du porteur du 25/11) : une ligne de la table `GFS_Directories` que GFS crée avec l'accord de la
// personne (js/files/own-table.js). Ce module ne parle ni à Grist ni à la page : il dit ce que la table contient et lit, sans jamais échouer, ce qu'une
// personne ou une version plus ancienne y a écrit.
//
// Une ligne : `Name` (le nom de l'annuaire), `Table` (la table des personnes, celle du document), `Config` (le reste, en JSON : voir `readConfig`) et `Parent`
// (le numéro de ligne de l'annuaire d'origine pour un sous-annuaire, vide pour un annuaire principal) et `Copy` (la copie des personnes d'un sous-annuaire,
// vide pour un annuaire principal : js/annuaire/annuaire-sub.js). Les personnes d'un annuaire principal restent dans leur table : GFS n'y écrit rien et ne la
// copie pas (cahier 2, « deux zones ») ; seule la copie d'un sous-annuaire, que Grist verrouille (js/sharing/sharing-model.js), en garde une. Un niveau de la
// hiérarchie est une colonne au choix (décision du porteur, 25/11), éventuellement après des références : son `path` liste les colonnes à suivre depuis la
// personne.

import { ANNUAIRES_TABLE } from '../files/annuaire-files.js';
import { listOf } from '../sharing/direct-shares.js';

export { ANNUAIRES_TABLE };
export const ANNUAIRES_COLUMNS = Object.freeze([
  { id: 'Name', type: 'Text' }, { id: 'Table', type: 'Text' }, { id: 'Config', type: 'Text' }, { id: 'Parent', type: 'Text' }, { id: 'Copy', type: 'Text' },
]);
export const CONFIG_VERSION = 1;

// Les contrôles de « À vérifier » (js/annuaire/annuaire-check.js), dans l'ordre où la fenêtre les montre ; allumés par défaut : tous sauf « départ dépassé »,
// qui demande une colonne de date de départ.
export const CHECK_KINDS = Object.freeze(['dup', 'mail', 'att', 'resp', 'dep']);
export const DEFAULT_CHECKS = Object.freeze(['dup', 'mail', 'att', 'resp']);
// « Écrire au groupe » : combien d'adresses par message au plus, et où elles vont (Cci par défaut : les personnes ne se voient pas entre elles).
export const MAIL_DEFAULT = Object.freeze({ per: 40, to: 'bcc' });
export const MAIL_PER = Object.freeze({ min: 5, max: 200 });

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
// Les colonnes fixes qui peuvent devenir une colonne de la liste, dans l'ordre où la liste les montre.
export const FIXED_COLUMNS = Object.freeze(['email', 'phone']);

// Les options de l'annuaire (« À vérifier », « Ma présence », « Écrire au groupe ») : toujours complètes, jamais d'exception.
function readOptions(input) {
  const object = value => (value && typeof value === 'object' ? value : {});
  const presence = object(input.presence);
  const mail = object(input.mail);
  const per = Math.round(Number(mail.per));
  return { leave: text(input.leave), checks: Array.isArray(input.checks) ? CHECK_KINDS.filter(kind => input.checks.includes(kind)) : [...DEFAULT_CHECKS],
    presence: { on: presence.on === true && Boolean(text(presence.col)), col: text(presence.col) },
    mail: { per: Number.isFinite(per) ? Math.min(MAIL_PER.max, Math.max(MAIL_PER.min, per)) : MAIL_DEFAULT.per, to: mail.to === 'to' ? 'to' : 'bcc' } };
}

// Le critère d'un sous-annuaire (js/annuaire/annuaire-sub.js) : { key (la clé du filtre : celle d'un niveau de la hiérarchie, ou la colonne d'un champ), label
// (son nom à l'écran), values (les valeurs retenues : « ou » entre elles), at (le moment de la copie, un texte ISO) } ; null pour un annuaire principal.
function readSub(input) {
  const object = input && typeof input === 'object' ? input : {};
  const values = Array.isArray(object.values) ? [...new Set(object.values.map(text).filter(Boolean))] : [];
  return text(object.key) && values.length ? { key: text(object.key), label: text(object.label), values, at: text(object.at) } : null;
}

// La configuration lue d'un texte JSON (ou d'un objet) : toujours complète, jamais d'exception. Ce que GFS ne connaît pas (une clé d'une version plus récente)
// est ignoré à la lecture et perdu à la réécriture : `writeConfig` ne garde que ce qu'elle connaît ; une version plus récente écrit donc sa propre ligne. { v,
// name, first, order, upper, hierarchy, title, email, phone, lead, manager, levels: [{ label, path: [colonnes] }], relations: [{ col, label, inverse, card }],
//   columns: ['email', 'phone'], fields: [{ col, path, filter, list, column }] }
// `columns` : les colonnes fixes que la personne met en colonne de la liste (retour du porteur, 25/11 : « des colonnes pour les attributs, réglables comme les
// filtres ») ; les champs ont leur propre `column`.
// `name`, `first`, `title`, `email` et `phone` sont une colonne de la personne ou, quand la personne en a dit une dans une table liée (retour du porteur,
// 25/11 :
// « le poste est une référence, je veux choisir une autre colonne de la table des postes »), un chemin écrit « Poste › Intitulé » (`keyPath`).
// `relations` (demande du porteur, 25/11 : assistant·e, référent·e, suppléant·e) : voir js/annuaire/annuaire-relations.js ; une colonne ne sert qu'une fois (au
// responsable direct, à une relation ou à un champ).
// `checks` (demande du porteur du 25/11 : « À vérifier ») : les contrôles allumés ; `leave` : la colonne de la date de départ (pour « départ dépassé ») ;
// `presence` (« Ma présence », une option de l'administrateur) : { on, col } : `col` est une colonne oui/non de la personne, « apparaître dans l'annuaire » ;
// `mail` : { per, to } (« Écrire au groupe »).
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
  config.columns = FIXED_COLUMNS.filter(key => Array.isArray(input.columns) && input.columns.includes(key));
  const relations = Array.isArray(input.relations) ? input.relations : [];
  const used = new Set([config.manager]);
  config.relations = relations.map(rel => ({ col: text(rel && rel.col), label: text(rel && rel.label), inverse: text(rel && rel.inverse),
    card: !(rel && rel.card === false) }))
    .filter(rel => rel.col && !used.has(rel.col) && used.add(rel.col));
  Object.assign(config, readOptions(input));
  const sub = readSub(input.sub);
  if (sub) config.sub = sub;
  const fields = Array.isArray(input.fields) ? input.fields : [];
  const seen = new Set();
  config.fields = fields.map(field => {
    const route = path(field && field.path);
    const steps = route.length ? route : [text(field && field.col)].filter(Boolean);
    return { col: steps.join(FIELD_SEPARATOR), path: steps.length > 1 ? steps : [], filter: Boolean(field && field.filter),
      list: Boolean(field && field.list), column: Boolean(field && field.column) };
  }).filter(field => field.col && !seen.has(field.col) && seen.add(field.col));
  return config;
}

// Les colonnes que suit une clé de la personne (`name`, `title`…) : « Poste › Intitulé » donne ['Poste', 'Intitulé'], une colonne seule [colonne], rien [].
export const keyPath = key => (key ? String(key).split(FIELD_SEPARATOR).map(step => step.trim()).filter(Boolean) : []);
// Les colonnes qu'un champ suit depuis la personne, et le nom qu'on lui donne à l'écran (la dernière colonne du chemin).
export const fieldPath = field => (field.path && field.path.length ? field.path : [field.col]);
export const fieldLabel = field => fieldPath(field).at(-1);

export const writeConfig = config => JSON.stringify(readConfig(config));

// Ce que la lecture et les écrans utilisent : la configuration sans ce que l'option « postes et hiérarchie » éteinte met de côté (le poste, « responsable de sa
// structure » et les niveaux). Les autres colonnes, dont le responsable direct, ne dépendent pas d'elle. Une configuration qui n'a pas passé par `readConfig`
// (sans `hierarchy`) est lue comme allumée : seul « faux » l'éteint.
export const effectiveConfig = config => (config.hierarchy === false ? { ...config, title: '', lead: '', levels: [] } : config);

// Les adresses d'une colonne d'aide du partage (`GFS_Writers`, `GFS_Admins` : js/sharing/sharing-model.js), en minuscules ; rien quand le partage n'a pas
// étendu la table.
const addressesIn = cell => listOf(cell).map(each => String(each).trim().toLowerCase()).filter(Boolean);

// Les annuaires d'une table lue : [{ row, name, table, config, parent, fiches, access }] (`fiches` : le texte de la copie d'un sous-annuaire, vide sinon ;
// `access` : { writers, admins }, les adresses que Grist dit écrivains et administrateurs de la ligne, quand le partage est étendu à la table). Une ligne sans
// nom ou sans table est ignorée (GFS ne saurait pas l'ouvrir).
export function annuairesOf(data) {
  const rows = data && Array.isArray(data.id) ? data.id : [];
  const cell = (column, i) => (Array.isArray(data[column]) ? data[column][i] : undefined);
  const found = [];
  rows.forEach((row, i) => {
    const name = text(cell('Name', i));
    const table = text(cell('Table', i));
    if (name && table) found.push({ row, name, table, config: readConfig(cell('Config', i)), parent: text(cell('Parent', i)),
      fiches: String(cell('Copy', i) ?? ''), access: { writers: addressesIn(cell('GFS_Writers', i)), admins: addressesIn(cell('GFS_Admins', i)) } });
  });
  return found;
}

// Le dossier d'un nouvel annuaire, tel que `AddRecord` le reçoit.
export const newRecord = (name, table, config) => ({ Name: text(name), Table: text(table), Config: writeConfig(config), Parent: '' });

// Les actions de Grist qui créent ou réécrivent une ligne : `AddRecord` (la table, un identifiant nul, les valeurs) et `UpdateRecord`.
export const addAction = (tableId, record) => ['AddRecord', tableId, null, record];
export const updateAction = (tableId, row, record) => ['UpdateRecord', tableId, row, record];
// L'action qui ajoute une colonne vide (retour du porteur, 25/11 : « le widget propose de la créer ») ; `type` : un type de Grist (« Text », « Ref:Personnes
// »…). `shown` : le numéro de la colonne que montre une référence (Grist écrit le nom de la personne plutôt que son numéro), 0 sans.
export const addColumnAction = (tableId, name, type, shown = 0) => ['AddColumn', tableId, text(name),
  { type, isFormula: false, label: text(name), ...(shown ? { visibleCol: shown } : {}) }];
// L'action qui range dans une référence la formule de la colonne qu'elle montre (`$Assistant.Nom`) : la colonne d'aide que Grist lit pour l'écran.
export const displayAction = (tableId, colRef, colId, shown) => ['SetDisplayFormula', tableId, null, colRef, `$${colId}.${shown}`];
