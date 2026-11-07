// Ce que la zone d'ajout de « Partager » propose et les articles du menu des droits (js/share-window.js ; contrats 11.7, point 13), en code pur. La fenêtre elle-même, à la souris et au clavier, à 700 × 400,
// se mesure sous Firefox (test/partager-firefox.mjs) et dans un vrai Grist (labo/run-partager-fenetre.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, levelItems, whoLabel } from '../js/share-window.js';
import { otherDocumentTargets } from '../js/share-other.js';
import { createI18n } from '../js/i18n.js';

const { t } = createI18n('fr');
const state = (extra = {}) => ({ me: 'moi@x.fr', author: 'moi@x.fr', people: ['ann@x.fr', 'marc.petit@x.fr', 'moi@x.fr'], shares: [], ...extra });

test('sans texte : les personnes connues (jamais soi-même) et les deux catégories', () => {
  const found = suggestions(t, state(), '');
  assert.deepEqual(found.people.map(item => item.who), ['ann@x.fr', 'marc.petit@x.fr']);
  assert.deepEqual(found.categories.map(item => item.who), ['@editeurs', '@tous']);
  assert.equal(found.invite, null);
});

test('la recherche : mots dans n\'importe quel ordre, accents et casse ignorés ; une catégorie se trouve par son nom', () => {
  assert.deepEqual(suggestions(t, state(), 'PETIT marc').people.map(item => item.who), ['marc.petit@x.fr']);
  assert.deepEqual(suggestions(t, state(), 'éditeurs').categories.map(item => item.who), ['@editeurs']);
  assert.deepEqual(suggestions(t, state(), 'zzz').people, []);
});

test('une adresse tapée en entier, que GFS ne connaît pas, devient « Ajouter … » avec la phrase sur l\'invitation ; jamais pour une personne déjà connue ou déjà dans la liste', () => {
  const found = suggestions(t, state(), '  Nouveau@Societe.fr ');
  assert.equal(found.invite.who, 'nouveau@societe.fr');
  assert.match(found.invite.hint, /propriétaire/);
  assert.equal(suggestions(t, state(), 'ann@x.fr').invite, null);
  const listed = state({ shares: [{ who: 'new@x.fr', inherited: false }] });
  assert.equal(suggestions(t, listed, 'new@x.fr').invite, null);
  assert.equal(suggestions(t, state(), 'pas une adresse').invite, null);
});

test('ce qui est déjà dans la liste (personne ou catégorie) n\'est plus proposé ; une ligne héritée ne compte pas', () => {
  const listed = state({ shares: [{ who: 'ann@x.fr', inherited: false }, { who: '@tous', inherited: false }, { who: '@editeurs', inherited: true }] });
  const found = suggestions(t, listed, '');
  assert.deepEqual(found.people.map(item => item.who), ['marc.petit@x.fr']);
  assert.deepEqual(found.categories.map(item => item.who), ['@editeurs']);
});

test('« Un autre document Grist… » (Sync+) arrive par `extraTargets` et reste dans la liste, grisé, avec sa raison', () => {
  const [other] = otherDocumentTargets(t);
  assert.deepEqual(suggestions(t, state(), 'zzz', [other]).others, [other]);
});

test('le menu des droits : cinq droits, le courant coché, commentaires et dépôt seul grisés avec leur raison, administration refusée à une catégorie, « Retirer » en dernier', () => {
  const said = [];
  const items = levelItems(t, { current: 'ecriture', category: false, onPick: key => said.push(`pick:${key}`), onRemove: () => said.push('remove'), onWhy: why => said.push(why) });
  assert.deepEqual(items.filter(item => item !== '-').map(item => item.label), ['Lecture seule', 'Lecture + commentaires', 'Dépôt seul', 'Écriture', 'Administration', 'Retirer l’accès']);
  assert.deepEqual(items.filter(item => item.check).map(item => item.label), ['Écriture']);
  assert.deepEqual(items.filter(item => item.greyed).map(item => item.label), ['Lecture + commentaires', 'Dépôt seul']);
  items[1].run(); items[3].run(); items.at(-1).run();
  assert.deepEqual(said, [t('share.right.commentaire.why'), 'pick:ecriture', 'remove']);
  const forCategory = levelItems(t, { current: 'lecture', category: true, onPick: () => {}, onWhy: () => {} });
  assert.ok(forCategory.find(item => item.label === 'Administration').greyed);
  assert.ok(!forCategory.some(item => item.label === 'Retirer l’accès'), 'un nouveau partage, pas encore écrit, n\'a rien à retirer');
});

test('le nom d\'une catégorie se lit dans la langue de la personne ; une adresse reste telle quelle', () => {
  assert.equal(whoLabel(t, '@tous'), 'Tout le document');
  assert.equal(whoLabel(createI18n('en').t, '@editeurs'), 'All editors');
  assert.equal(whoLabel(t, 'a@b.fr'), 'a@b.fr');
});

test('la ligne « Un autre document Grist… » du contrôleur : grisée jamais masquée, avec son icône, sa raison et les mêmes mots en français et en anglais', () => {
  for (const language of ['fr', 'en']) {
    const { t: say } = createI18n(language);
    const targets = otherDocumentTargets(say);
    assert.equal(targets.length, 1);
    const [other] = targets;
    assert.equal(other.greyed, true);
    assert.equal(other.icon, 'link');
    assert.equal(other.label, say('share.other'));
    assert.equal(other.why, say('share.other.why'));
    assert.ok(other.label && other.hint && other.why && !other.label.startsWith('share.'));
  }
  assert.notEqual(otherDocumentTargets(createI18n('fr').t)[0].label, otherDocumentTargets(createI18n('en').t)[0].label);
});

test('les groupes : proposés par leur nom avec leur effectif, jamais ceux déjà dans la liste ; « #nom » se lit « Groupe · nom » ; pas d\'administration pour un groupe', () => {
  const groups = [{ name: 'Achats', count: 3 }, { name: 'Compta', count: 1 }];
  const found = suggestions(t, state({ groups, shares: [{ who: '#Compta', inherited: false }] }), '');
  assert.deepEqual(found.groups.map(item => [item.who, item.glyph]), [['#Achats', 'users']]);
  assert.match(found.groups[0].hint, /3/);
  assert.deepEqual(suggestions(t, state({ groups }), 'compta').groups.map(item => item.who), ['#Compta']);
  assert.match(whoLabel(t, '#Achats'), /Achats/);
  assert.notEqual(whoLabel(t, '#Achats'), '#Achats');
  const admin = levelItems(t, { current: 'lecture', category: true, onPick() {}, onWhy() {} }).find(item => item.label === t('share.right.admin'));
  assert.equal(admin.greyed, true);
});
