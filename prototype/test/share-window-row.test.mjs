// Une ligne de « Qui a accès » (js/sharing/share-window.js, `row`) : le nom et ses détails, les étiquettes, le bouton du droit (menu, ou cadenas quand la personne ne peut pas le changer). Un DOM de poche remplace celui du navigateur
// (le texte et les attributs seulement) ; la fenêtre à la souris se mesure sous Firefox (test/partager-firefox.mjs) et dans un vrai Grist (labo/run-partager-fenetre.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();

const { row } = await import('../js/sharing/share-window.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const { t } = createI18n('fr');
const share = (extra = {}) => ({ id: 7, who: 'ann@x.fr', right: 'lecture', download: false, end: null, inherited: false, from: null, valid: true, active: true, ...extra });
const ctx = (extra = {}) => ({ t, locale: 'fr', state: { me: 'moi@x.fr', canManage: true }, container: {}, change() {}, remove() {}, say() {}, ...extra });
const glyph = node => node.elements[0].attrs.href;

// La ligne lue : ce qu'elle montre, étiquettes et bouton compris.
function read(li) {
  const [avatar, name, ...rest] = li.elements;
  const button = rest.pop();
  return {
    key: li.dataset.share, cls: li.className, avatar: avatar.tag === 'span' ? avatar.textContent : glyph(avatar), label: name.elements[0].textContent, notes: name.elements[1] ? name.elements[1].textContent : null,
    tags: rest.map(tag => tag.textContent), level: button.children[0], glyph: glyph(button.elements[0]), locked: button.attrs['aria-disabled'], popup: button.attrs['aria-haspopup'], fk: button.dataset.fk, clicks: (button.listeners.click || []).length,
  };
}
const SEC = date => new Date(date).getTime() / 1000;

test('une personne qui a accès : initiales, nom, droit et menu pour qui peut changer les partages', () => {
  const line = read(row(ctx(), share()));
  assert.deepEqual(line, { key: '7', cls: 'rr', avatar: 'A', label: 'ann@x.fr', notes: null, tags: [], level: t('share.right.lecture'), glyph: '#i-chev-down', locked: undefined, popup: 'menu', fk: 'share-level-7', clicks: 1 });
});

test('« (moi) » après son propre nom, quelle que soit la casse ; pas pour un droit hérité ni pour une autre personne', () => {
  assert.equal(read(row(ctx(), share({ who: 'Moi@X.fr' }))).label, `Moi@X.fr${t('share.row.me')}`);
  assert.equal(read(row(ctx(), share({ who: 'moi@x.fr', inherited: true, from: { kind: 'root' } }))).label, `moi@x.fr · ${t('share.row.inherited')}`);
});

test('les détails : fin d\'accès, téléchargement, accès terminé, invalide ; les étiquettes disent « Invalide » et « Terminé » ; ils se joignent par « · »', () => {
  const end = SEC('2026-01-01T00:00:00Z');
  const until = read(row(ctx(), share({ end, download: true })));
  assert.equal(until.notes, `${t('share.row.until', { date: '1 janvier 2026' })} · ${t('share.row.download')}`);
  assert.deepEqual(until.tags, []);
  const expired = read(row(ctx(), share({ end, active: false })));
  assert.equal(expired.notes, t('share.row.expired', { date: '1 janvier 2026' }));
  assert.deepEqual(expired.tags, [t('share.tag.expired')]);
  const invalid = read(row(ctx(), share({ valid: false })));
  assert.equal(invalid.notes, t('share.row.invalid'));
  assert.deepEqual(invalid.tags, [t('share.tag.invalid')]);
  const both = read(row(ctx(), share({ valid: false, active: false, end })));
  assert.deepEqual(both.tags, [t('share.tag.invalid'), t('share.tag.expired')]);
  assert.equal(both.notes, `${t('share.row.expired', { date: '1 janvier 2026' })} · ${t('share.row.invalid')}`);
  assert.equal(read(row(ctx(), share({ end: null, active: false }))).notes.startsWith(t('share.row.expired', { date: '' }).slice(0, 5)), true, 'sans date, l\'accès terminé le dit quand même');
});

test('un droit hérité dit d\'où il vient (le document, l\'espace, un dossier) et se voit sous cadenas, sans menu', () => {
  const root = read(row(ctx(), share({ inherited: true, from: { kind: 'root' } })));
  assert.equal(root.label, `ann@x.fr · ${t('share.row.inherited')}`);
  assert.deepEqual([root.locked, root.popup, root.glyph, root.clicks], ['true', undefined, '#i-lock', 0]);
  assert.equal(read(row(ctx(), share({ inherited: true, from: { kind: 'space', name: 'Achats' } }))).label, `ann@x.fr · ${t('share.row.inherited.space', { name: 'Achats' })}`);
  assert.equal(read(row(ctx(), share({ inherited: true, from: { kind: 'folder', name: 'Contrats' } }))).label, `ann@x.fr · ${t('share.row.inherited.folder', { name: 'Contrats' })}`);
  assert.equal(read(row(ctx(), share({ inherited: true, from: null }))).label, `ann@x.fr · ${t('share.row.inherited')}`);
});

test('qui ne gère pas les partages voit le droit sous cadenas, sans menu', () => {
  const line = read(row(ctx({ state: { me: 'moi@x.fr', canManage: false } }), share({ right: 'ecriture' })));
  assert.deepEqual([line.level, line.glyph, line.locked, line.popup, line.clicks], [t('share.right.ecriture'), '#i-lock', 'true', undefined, 0]);
});

test('une catégorie et un groupe : leur nom en toutes lettres et leur icône', () => {
  const cat = read(row(ctx(), share({ who: '@editeurs' })));
  assert.deepEqual([cat.label, cat.avatar], [t('share.cat.editeurs'), '#i-edit']);
  assert.deepEqual([read(row(ctx(), share({ who: '@tous' }))).label, read(row(ctx(), share({ who: '@tous' }))).avatar], [t('share.cat.tous'), '#i-globe']);
  const group = read(row(ctx(), share({ who: '#Compta' })));
  assert.deepEqual([group.label, group.avatar], [t('share.group.label', { name: 'Compta' }), '#i-users']);
});
