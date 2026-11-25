// Un document fictif pour les essais de l'annuaire (module Annuaire, 25/11) : une table de personnes, une table de structures qui se pointent entre elles
// (une direction a un pôle, un service a une direction), et les tables internes de Grist que GFS lit pour connaître les colonnes. Rien d'un vrai client.

// Les tables internes, telles que `fetchTable` les rend : des tableaux de colonnes.
const TABLES = [[1, 'Personnes'], [2, 'Structures'], [3, 'GFS_Annuaires']];
const COLUMNS = [
  // [numéro, table, colId, type, colonne visible]
  [10, 1, 'Nom', 'Text', 0], [11, 1, 'Poste', 'Text', 0], [12, 1, 'Email', 'Text', 0], [13, 1, 'Tel', 'Text', 0],
  [14, 1, 'Structure', 'Ref:Structures', 20], [15, 1, 'Contrat', 'Choice', 0], [16, 1, 'Competences', 'ChoiceList', 0], [17, 1, 'Teletravail', 'Bool', 0],
  [18, 1, 'Responsable', 'Ref:Personnes', 10], [19, 1, 'Chef', 'Bool', 0], [30, 1, 'Arrivee', 'Date', 0], [32, 1, 'Service', 'Text', 0], [33, 1, 'Site', 'Choice', 0],
  [34, 1, 'Assistant', 'Ref:Personnes', 10], [35, 1, 'Referents', 'RefList:Personnes', 10], [36, 1, 'Suppleant', 'Ref:Personnes', 10],
  [20, 2, 'Nom', 'Text', 0], [21, 2, 'Niveau', 'Text', 0], [22, 2, 'Pole', 'Ref:Structures', 20], [23, 2, 'Direction', 'Ref:Structures', 20],
  [40, 3, 'Nom', 'Text', 0], [41, 3, 'Config', 'Text', 0], [42, 1, 'gristHelper_Display', 'Any', 0], [43, 1, 'manualSort', 'ManualSortPos', 0],
];

export const metaTables = () => ({ id: TABLES.map(row => row[0]), tableId: TABLES.map(row => row[1]), summarySourceTable: TABLES.map(() => 0) });
export const metaColumns = () => ({ id: COLUMNS.map(row => row[0]), parentId: COLUMNS.map(row => row[1]), colId: COLUMNS.map(row => row[2]),
  type: COLUMNS.map(row => row[3]), visibleCol: COLUMNS.map(row => row[4]) });

// Les structures : trois pôles, des directions, un service. Chacune dit son pôle et sa direction (un pôle est son propre pôle, une direction sa propre direction).
export const structures = () => ({
  id: [1, 2, 3, 4, 5, 6, 7],
  Nom: ['Pôle Ressources', 'Pôle Numérique', 'Direction des finances', 'Direction du numérique', 'Budget', 'Pôle Vie de campus', 'Direction des sports'],
  Niveau: ['Pôle', 'Pôle', 'Direction', 'Direction', 'Service', 'Pôle', 'Direction'],
  Pole: [1, 2, 1, 2, 1, 6, 6],
  Direction: [0, 0, 3, 4, 3, 0, 7],
});

// Les personnes : la Structure d'une personne est une ligne de `structures` ; son pôle et sa direction se déduisent en suivant les références de cette ligne
// (`Structure › Pole`, `Structure › Direction`) ; son service est une colonne à elle.
export const personnes = () => ({
  id: [1, 2, 3, 4, 5, 6],
  Nom: ['Camille Durand', 'Inès Marchand', 'Nathan Roussel', 'Louis Girard', 'Emma Rolland', 'Yanis Morel'],
  Poste: ['Cheffe du service Budget', 'Gestionnaire de marchés', 'Directeur des finances', 'Directeur du numérique', 'Cheffe du pôle Ressources',
    'Responsable équipements'],
  Email: ['camille.durand@exemple.fr', 'ines.marchand@exemple.fr', 'nathan.roussel@exemple.fr', 'louis.girard@exemple.fr', 'emma.rolland@exemple.fr', ''],
  Tel: ['01 02 03 04 11', '', '', '', '', ''],
  Structure: [5, 3, 3, 4, 1, 7],
  Contrat: ['Titulaire', 'Contractuelle', 'Titulaire', 'Titulaire', 'Titulaire', 'Titulaire'],
  Competences: [['L', 'Budget', 'Marchés publics'], ['L', 'Marchés publics'], null, ['L', 'Pilotage'], null, null],
  Teletravail: [true, true, false, true, null, false],
  Responsable: [3, 3, 5, 5, 0, 0],
  Chef: [true, false, true, true, true, false],
  Arrivee: [1456790400, null, null, null, null, null],
  Service: ['Budget', '', '', '', '', ''],
  Site: ['Siège', 'Siège', 'Campus Nord', 'Siège', 'Siège', 'Campus Sud'],
  // Les relations : l'assistante de Nathan et d'Emma est Inès ; les référents de Camille sont Emma et Nathan, celui d'Inès est Emma.
  Assistant: [0, 0, 2, 0, 2, 0],
  Referents: [['L', 5, 3], ['L', 5], null, null, null, null],
  Suppleant: [0, 0, 0, 0, 0, 0], // une colonne libre qui désigne une personne : celle qu'une nouvelle relation peut prendre
});

export const documentFixture = () => ({ _grist_Tables: metaTables(), _grist_Tables_column: metaColumns(), Personnes: personnes(), Structures: structures() });

// La configuration des essais : niveaux par chemins de colonnes (le pôle et la direction de la structure, puis le service).
export const configFixture = () => ({
  v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', lead: 'Chef', manager: 'Responsable',
  relations: [{ col: 'Assistant', label: 'Assistant·e', inverse: 'Assistant·e de', card: true }, { col: 'Referents', label: 'Référent·e', inverse: '', card: false }],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }, { col: 'Competences', filter: true }, { col: 'Teletravail', filter: true }, { col: 'Arrivee', filter: false }],
});
