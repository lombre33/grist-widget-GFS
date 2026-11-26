// Qui peut modifier une fiche (module Annuaire, retour du porteur du 25/11 : « par défaut les administrateurs, mais aussi chacun sa propre fiche, les personnes
// de son niveau hiérarchique avec en option celles du niveau en dessous, ou un rôle désigné »). Des fonctions sans effet de bord, essayées sous Node
// (test/annuaire-edit-rights.test.mjs) : elles disent « oui » ou la phrase qui explique le « non » ; elles n'écrivent rien.
//
// C'est la règle de GFS : elle grise « Modifier » avec sa raison. Elle n'est pas un verrou : la table des personnes reste ce que ses règles d'accès disent, et
// Grist garde le dernier mot (un refus de sa part se dit dans la fenêtre « Modifier »). Le verrou réel dans Grist, que le propriétaire pose sur demande après
// l'aperçu (choix du porteur, 26/11), est à js/annuaire/annuaire-lock.js : mêmes droits, écrits en règles d'accès sur la table des personnes.

import { effectiveConfig } from './annuaire-config.js';
import { nodeId } from './annuaire-model.js';
import { mineOf } from './annuaire-presence.js';

// Les lignes de la table des personnes dont la case « peut modifier les fiches » est cochée (la colonne oui/non du rôle désigné).
export function editorRows(read) {
  const col = read.config && read.config.edit ? read.config.edit.role : '';
  const table = col && read.data && read.annuaire ? read.data[read.annuaire.table] : null;
  const cells = table && Array.isArray(table[col]) && Array.isArray(table.id) ? table[col] : null;
  return new Set(cells ? table.id.filter((row, i) => cells[i] === true) : []);
}

// Les règles allumées en plus des administrateurs, dans l'ordre où le réglage les montre : ['self', 'own' | 'below', 'role'].
export function activeRules(config) {
  const edit = config && config.edit ? config.edit : {};
  return [edit.self ? 'self' : '', edit.level || '', edit.role ? 'role' : ''].filter(Boolean);
}

// Le droit de modifier la fiche de `person`, pour la personne qui lit : un administrateur, toujours ; sinon l'une des règles allumées.
// `ctx` : { admin (GFS a prouvé que la personne administre le document), identity (son adresse, ou ''), people (celles qu'elle voit), config, editors (Set :
// les lignes du rôle désigné) }. Rend { can, rule } : `rule` dit laquelle des règles l'accorde ('admin', 'self', 'own', 'below', 'role'), ou '' quand non.
export function editRight(person, { admin = false, identity = '', people = [], config, editors = new Set() }) {
  if (admin) return { can: true, rule: 'admin' };
  const edit = config && config.edit ? config.edit : {};
  const mine = mineOf(people, identity);
  if (!mine) return { can: false, rule: '' };
  if (edit.self && mine.row === person.row) return { can: true, rule: 'self' };
  if (edit.role && editors.has(mine.row)) return { can: true, rule: 'role' };
  const levels = effectiveConfig(config).levels;
  const own = edit.level ? nodeId(mine, levels) : '';
  if (own) {
    const there = nodeId(person, levels);
    if (there === own) return { can: true, rule: 'own' };
    if (edit.level === 'below' && there.startsWith(`${own}\u001f`)) return { can: true, rule: 'below' };
  }
  return { can: false, rule: '' };
}

// La phrase qui dit pourquoi « Modifier » est grisé : qui modifie cette fiche (les administrateurs seuls, ou avec les règles allumées), et, quand une règle
// reconnaît la personne à son adresse que GFS ne connaît pas, que c'est ce qui manque. `t` : la fonction des textes ; `locale` : la langue des listes (« a, b
// et c ») ;
// `identity` : l'adresse de la personne qui lit, '' quand GFS ne la connaît pas, null quand on ne le dit pas.
export function editWhy(config, t, locale, identity = null) {
  const rules = activeRules(config);
  if (!rules.length) return t('an.edit.whyAdmins');
  const said = t('an.edit.whyRules', { who: whoList(config, t, locale) });
  const unknown = identity !== null && !String(identity).trim();
  return unknown && rules.some(rule => rule !== 'role') ? `${said} ${t('an.edit.whyNoIdentity')}` : said;
}

// Les règles allumées en plus des administrateurs, dites en une liste (« la personne elle-même, les personnes désignées ») : la phrase de « Modifier » grisé et
// l'aperçu du verrou (js/annuaire/annuaire-lock-view.js) la partagent.
export function whoList(config, t, locale) {
  const who = activeRules(config).map(rule => t(`an.edit.who.${rule}`));
  try { return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(who); } catch (error) { return who.join(', '); }
}

// Ce qui empêche de modifier cette fiche : ce qui empêche d'écrire (`blocked`, le texte de la fenêtre), sinon la règle de l'annuaire ; le texte, ou rien.
export function editBlock(person, data, blocked, t, locale) {
  if (blocked || !data || editRight(person, data).can) return blocked;
  return editWhy(data.config, t, locale, data.identity || '');
}
