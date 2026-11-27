// « Ajouter des personnes » (module Annuaire ; choix du porteur, 27/11 : « Plusieurs à la suite, un seul ajout ») : la fenêtre « Modifier » de l'annuaire, à
// vide (js/annuaire/annuaire-edit-window.js), avec la rangée des fiches préparées. Elle ne parle pas à Grist : l'écriture est `save`, que le contrôle lui donne
// (une seule action `BulkAddRecord`, sur le geste « Ajouter » de la relecture). Les champs sont ceux de « Modifier » (jamais une colonne absente ; une colonne
// que Grist calcule reste grisée, avec sa raison).

import { EditWindow } from './annuaire-edit-window.js';
import { editableFields } from './annuaire-edit.js';
import { blankValues } from './annuaire-add.js';

// Ouvre la fenêtre sur la lecture `read` de l'annuaire (`read.annuaire.table` : la table des personnes ; `read.people` : celles qui y sont déjà, pour les
// doublons et les liens). Rend { saved (vrai quand les fiches sont écrites), names (les noms des personnes ajoutées) }.
export async function openAdd({ read, t, locale, container, inertTargets, save }) {
  const table = read.annuaire.table;
  const { fields, locked } = editableFields(read.config, read.schema, table, t);
  const window_ = new EditWindow({ container, inertTargets, t, locale, person: { row: 0, name: '' }, table, fields, locked, values: blankValues(fields),
    options: { data: read.data, people: read.people, table, plan: read.plan }, lockedText: () => '', save,
    add: { who: read.annuaire.name, config: read.config, people: read.people } });
  const saved = await window_.run();
  return { saved, names: window_.added };
}
