// Le document fictif des mesures du module Annuaire (demande du porteur du 25/11) : une table de structures qui se pointent entre elles (un pôle est son propre pôle, une
// direction sa propre direction, un service a sa direction) et une table de personnes qui disent leur structure, leur responsable, si elles dirigent leur structure, et des
// champs libres (contrat, compétences, télétravail, arrivée). Rien d'un vrai client : tous les noms sont inventés.

const STRUCTURES = [
  // [nom, niveau, pôle, direction] (des numéros de lignes ; 0 : aucun)
  ['Pôle Ressources', 'Pôle', 1, 0], ['Pôle Numérique', 'Pôle', 2, 0], ['Pôle Vie de campus', 'Pôle', 3, 0],
  ['Direction des finances', 'Direction', 1, 4], ['Direction des ressources humaines', 'Direction', 1, 5],
  ['Direction du numérique', 'Direction', 2, 6], ['Direction des systèmes d’information', 'Direction', 2, 7],
  ['Direction des sports', 'Direction', 3, 8], ['Direction de la vie étudiante', 'Direction', 3, 9], ['Budget', 'Service', 1, 4],
];

// [nom, poste, e-mail, téléphone, structure, contrat, compétences, télétravail, responsable (n° de ligne), dirige sa structure, arrivée (jj/mm/aaaa), service]
const PEOPLE = [
  ['Hélène Marchetti', 'Directrice générale des services', 'helene.marchetti@exemple.fr', '01 02 03 04 00', 0, 'Titulaire', ['Pilotage'], false, 0, false, '2016-09-01', ''],
  ['Emma Rolland', 'Cheffe du pôle Ressources', 'emma.rolland@exemple.fr', '01 02 03 04 01', 1, 'Titulaire', ['Pilotage', 'Budget'], false, 1, true, '2018-03-12', ''],
  ['Nathan Roussel', 'Directeur des finances', 'nathan.roussel@exemple.fr', '01 02 03 04 02', 4, 'Titulaire', ['Budget'], false, 2, true, '2019-01-07', ''],
  ['Camille Durand', 'Cheffe du service Budget', 'camille.durand@exemple.fr', '01 02 03 04 11', 10, 'Titulaire', ['Budget', 'Marchés publics'], true, 3, true, '2020-02-03', 'Budget'],
  ['Inès Marchand', 'Gestionnaire de marchés', 'ines.marchand@exemple.fr', '', 4, 'Contractuelle', ['Marchés publics'], true, 3, false, '2022-09-05', ''],
  ['Théo Lambert', 'Gestionnaire budgétaire', 'theo.lambert@exemple.fr', '', 10, 'Contractuel', ['Budget'], false, 4, false, '2023-04-17', 'Budget'],
  ['Sarah Benoit', 'Directrice des ressources humaines', 'sarah.benoit@exemple.fr', '01 02 03 04 05', 5, 'Titulaire', ['Pilotage', 'Recrutement'], false, 2, true, '2017-11-20', ''],
  ['Julien Perrin', 'Chargé de recrutement', 'julien.perrin@exemple.fr', '', 5, 'Contractuel', ['Recrutement'], true, 7, false, '2021-06-14', ''],
  ['Louis Girard', 'Directeur du numérique', 'louis.girard@exemple.fr', '01 02 03 04 20', 6, 'Titulaire', ['Pilotage', 'Données'], true, 1, true, '2015-05-04', ''],
  ['Manon Fabre', 'Responsable des applications', 'manon.fabre@exemple.fr', '', 7, 'Titulaire', ['Données', 'Développement'], true, 9, true, '2019-10-01', ''],
  ['Hugo Lefèvre', 'Développeur', 'hugo.lefevre@exemple.fr', '', 7, 'Contractuel', ['Développement'], true, 10, false, '2023-01-09', ''],
  ['Lina Garnier', 'Développeuse', 'lina.garnier@exemple.fr', '', 7, 'Contractuelle', ['Développement', 'Données'], true, 10, false, '2024-02-05', ''],
  ['Yanis Morel', 'Responsable équipements', 'yanis.morel@exemple.fr', '01 02 03 04 31', 8, 'Titulaire', ['Équipements'], false, 14, false, '2018-09-03', ''],
  ['Chloé Fontaine', 'Cheffe du pôle Vie de campus', 'chloe.fontaine@exemple.fr', '01 02 03 04 30', 3, 'Titulaire', ['Pilotage'], false, 1, true, '2016-02-15', ''],
  ['Maxime Colin', 'Directeur des sports', 'maxime.colin@exemple.fr', '01 02 03 04 32', 8, 'Titulaire', ['Équipements', 'Pilotage'], false, 14, true, '2014-09-01', ''],
  ['Zoé Mercier', 'Éducatrice sportive', 'zoe.mercier@exemple.fr', '', 8, 'Contractuelle', ['Équipements'], false, 15, false, '2022-01-10', ''],
  ['Adam Nicolas', 'Directeur de la vie étudiante', 'adam.nicolas@exemple.fr', '01 02 03 04 33', 9, 'Titulaire', ['Pilotage'], true, 14, true, '2020-09-07', ''],
  ['Léa Chevalier', 'Chargée d’accueil', 'lea.chevalier@exemple.fr', '', 9, 'Contractuelle', ['Accueil'], false, 17, false, '2023-09-04', ''],
];

const dayOf = iso => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);

// Les actions qui créent les deux tables, règlent la colonne que Grist montre pour chaque référence, puis les remplissent.
export const SEED = {
  tables: [
    ['AddTable', 'Structures', [{ id: 'Nom', type: 'Text' }, { id: 'Niveau', type: 'Text' }, { id: 'Pole', type: 'Ref:Structures' }, { id: 'Direction', type: 'Ref:Structures' }]],
    ['AddTable', 'Personnes', [{ id: 'Nom', type: 'Text' }, { id: 'Poste', type: 'Text' }, { id: 'Email', type: 'Text' }, { id: 'Tel', type: 'Text' },
      { id: 'Structure', type: 'Ref:Structures' }, { id: 'Contrat', type: 'Choice', widgetOptions: JSON.stringify({ choices: ['Titulaire', 'Contractuel', 'Contractuelle'] }) },
      { id: 'Competences', type: 'ChoiceList' }, { id: 'Teletravail', type: 'Bool' }, { id: 'Responsable', type: 'Ref:Personnes' }, { id: 'Chef', type: 'Bool' },
      { id: 'Arrivee', type: 'Date' }, { id: 'Service', type: 'Text' }, { id: 'Assistant', type: 'Ref:Personnes' }, { id: 'Referents', type: 'RefList:Personnes' }]],
  ],
  // Les références qui montrent la colonne « Nom » de leur table : [table, colonne, table visée].
  visible: [['Structures', 'Pole', 'Structures'], ['Structures', 'Direction', 'Structures'], ['Personnes', 'Structure', 'Structures'], ['Personnes', 'Responsable', 'Personnes'],
    ['Personnes', 'Assistant', 'Personnes'], ['Personnes', 'Referents', 'Personnes']],
  rows: [
    ['BulkAddRecord', 'Structures', STRUCTURES.map(() => null), { Nom: STRUCTURES.map(row => row[0]), Niveau: STRUCTURES.map(row => row[1]), Pole: STRUCTURES.map(row => row[2]),
      Direction: STRUCTURES.map(row => row[3]) }],
    ['BulkAddRecord', 'Personnes', PEOPLE.map(() => null), { Nom: PEOPLE.map(row => row[0]), Poste: PEOPLE.map(row => row[1]), Email: PEOPLE.map(row => row[2]),
      Tel: PEOPLE.map(row => row[3]), Structure: PEOPLE.map(row => row[4]), Contrat: PEOPLE.map(row => row[5]), Competences: PEOPLE.map(row => ['L', ...row[6]]),
      Teletravail: PEOPLE.map(row => row[7]), Responsable: PEOPLE.map(row => row[8]), Chef: PEOPLE.map(row => row[9]), Arrivee: PEOPLE.map(row => dayOf(row[10])),
      Service: PEOPLE.map(row => row[11]),
      // Les relations : Inès Marchand (5) est l'assistante d'Emma Rolland (2) et de Nathan Roussel (3) ; Camille Durand (4) a pour référents Emma et Nathan.
      Assistant: PEOPLE.map((_, i) => ([1, 2].includes(i) ? 5 : 0)), Referents: PEOPLE.map((_, i) => (i === 3 ? ['L', 2, 3] : null)) }],
  ],
};

// Pose le document dans le vrai Grist, depuis le cadre de GFS (accès complet).
export async function seedAnnuaire(frame) {
  await frame.evaluate(async seed => {
    const api = grist.docApi;
    await api.applyUserActions(seed.tables);
    const meta = await api.fetchTable('_grist_Tables_column');
    const tables = await api.fetchTable('_grist_Tables');
    const tableRow = name => tables.id[tables.tableId.indexOf(name)];
    const colRow = (table, col) => meta.id.find((id, i) => meta.parentId[i] === tableRow(table) && meta.colId[i] === col);
    await api.applyUserActions(seed.visible.map(([table, col, target]) => ['UpdateRecord', '_grist_Tables_column', colRow(table, col), { visibleCol: colRow(target, 'Nom') }]));
    await api.applyUserActions(seed.rows);
  }, SEED);
}
