// Un document fictif pour les essais du guide des démarches (module Guide, 27/11) : celui de l'annuaire (test/annuaire-fixtures.mjs : personnes et structures) plus une
// table de démarches. Rien d'un vrai client.
import { documentFixture, configFixture } from './annuaire-fixtures.mjs';

// Les colonnes de la table des démarches (numéro, colId, type, colonne visible).
const COLUMNS = [
  [50, 'Titre', 'Text', 0], [51, 'Mere', 'Ref:Demarches', 50], [52, 'Mots', 'Text', 0], [53, 'Etapes', 'Text', 0], [54, 'Details', 'Text', 0],
  [55, 'Demander', 'Ref:Structures', 20], [56, 'Valider', 'Ref:Personnes', 10], [57, 'Probleme', 'Text', 0], [58, 'Defaut', 'Ref:Structures', 20],
];
export const PROCEDURES_TABLE = 'Demarches';

// Les démarches : deux thèmes, une démarche et sa sous-démarche, une démarche sans responsable de service, une boucle (6 et 7), une mère qui n'existe pas (8).
const ROWS = [
  { id: 1, Titre: 'Congés et absences', Mere: 0, Mots: '', Etapes: '', Details: 'Tout ce qui touche aux congés.', Demander: 5, Valider: 0, Probleme: '', Defaut: 3 },
  { id: 2, Titre: 'Poser des congés', Mere: 1, Mots: 'vacances, RTT; jours', Etapes: 'Saisir la demande\nFaire valider par la direction\n\nAttendre la confirmation', Details: '',
    Demander: 0, Valider: 3, Probleme: '', Defaut: 0 },
  { id: 3, Titre: 'Poser des congés exceptionnels', Mere: 2, Mots: '', Etapes: '', Details: '', Demander: 0, Valider: 0, Probleme: 'Directeur du numérique', Defaut: 0 },
  { id: 4, Titre: 'Missions et déplacements', Mere: 0, Mots: 'voyage', Etapes: '', Details: '', Demander: 0, Valider: 99, Probleme: '', Defaut: 3 },
  { id: 5, Titre: 'Remboursement de frais', Mere: 4, Mots: '', Etapes: 'Joindre les justificatifs', Details: '', Demander: 6, Valider: 0, Probleme: 'Poste vacant', Defaut: 0 },
  { id: 6, Titre: 'Boucle A', Mere: 7, Mots: '', Etapes: '', Details: '', Demander: 0, Valider: 0, Probleme: '', Defaut: 0 },
  { id: 7, Titre: 'Boucle B', Mere: 6, Mots: '', Etapes: '', Details: '', Demander: 0, Valider: 0, Probleme: '', Defaut: 0 },
  { id: 8, Titre: 'Démarche orpheline', Mere: 99, Mots: '', Etapes: '', Details: '', Demander: 0, Valider: 0, Probleme: '', Defaut: 0 },
];

export function guideDocument() {
  const document = documentFixture();
  document._grist_Tables.id.push(4);
  document._grist_Tables.tableId.push(PROCEDURES_TABLE);
  document._grist_Tables.summarySourceTable.push(0);
  const columns = document._grist_Tables_column;
  for (const [id, colId, type, visible] of COLUMNS) {
    columns.id.push(id);
    columns.parentId.push(4);
    columns.colId.push(colId);
    columns.type.push(type);
    columns.visibleCol.push(visible);
    columns.widgetOptions.push('');
    columns.isFormula.push(false);
  }
  document[PROCEDURES_TABLE] = { id: ROWS.map(row => row.id) };
  for (const [, colId] of COLUMNS) document[PROCEDURES_TABLE][colId] = ROWS.map(row => row[colId]);
  return document;
}

// La configuration du guide des essais : le titre, la mère, les mots-clés, les étapes, les détails, quatre rôles (un service, une personne, un poste, « À défaut »).
export const guideConfig = () => ({ v: 1, title: 'Titre', parent: 'Mere', keywords: 'Mots', steps: 'Etapes', details: 'Details', directory: '1',
  roles: [{ col: 'Demander', label: 'Pour demander', preset: 'ask' }, { col: 'Valider', label: 'Pour faire valider', preset: 'validate' },
    { col: 'Probleme', label: 'En cas de problème', preset: 'problem' }, { col: 'Defaut', label: 'À défaut', preset: 'fallback' }] });

export { configFixture };
