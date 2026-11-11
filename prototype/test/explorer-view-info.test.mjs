// La barre d'information de l'explorateur (js/explorer-view.js, `infoBar`) : ce qu'elle dit d'un fichier choisi, d'un dossier choisi, ou de rien (le rappel du rangement), et son infobulle. Un DOM de poche remplace
// celui du navigateur (le texte et les attributs seulement) ; l'aspect à l'écran, lui, se mesure dans le labo, à la vraie souris.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();

const { infoBar } = await import('../js/explorer-view.js');
const { createI18n } = await import('../js/i18n.js');

const { t } = createI18n('fr');
const NOW = new Date('2026-11-09T12:00:00Z');
const file = (extra = {}) => ({ name: 'Convocation', type: 'document', icon: 'doc', app: 'publipostage', ts: 1762000000, by: 'paul@exemple.fr', family: 'doc', weight: 2048, folder: '', ...extra });
const ctx = (extra = {}) => ({
  t, locale: 'fr', now: NOW, state: { view: 'folder' }, personal: true, choosing: false, selected: null, lockOf: () => null, opensIn: () => 'S\'ouvre dans Publipostage+', typeLabel: item => item.type, ...extra,
});
// Les deux lignes de la barre, leur attribut `data-fam` et le symbole de la première.
const read = bar => {
  const [l1, l2] = bar.elements;
  return { first: l1.textContent, second: l2.textContent, fam: bar.attrs['data-fam'], symbol: l1.elements[0].elements[0].attrs.href, title: bar.title };
};

test('rien de choisi : le rappel du rangement (à la personne ou commun au document), de la corbeille, du choix d\'un fichier', () => {
  const folder = read(infoBar(ctx()));
  assert.deepEqual([folder.first, folder.second], [t('ex.hintPersonal'), t('ex.hintFav')]);
  const shared = read(infoBar(ctx({ personal: false })));
  assert.deepEqual([shared.first, shared.second], [t('ex.hintShared'), t('ex.hintFavShared')], 'GFS ne sait pas qui est la personne : le rangement est commun au document');
  assert.equal(read(infoBar(ctx({ state: { view: 'trash' } }))).first, t('trash.hint'));
  assert.equal(read(infoBar(ctx({ state: { view: 'fav' } }))).first, t('ex.hintSelect'));
  assert.equal(read(infoBar(ctx({ choosing: true }))).first, t('ex.choose.hint'), 'un choix de fichier demandé par une app passe avant le rappel');
  assert.equal(folder.title, `${t('ex.hintPersonal')}\n${t('ex.hintFav')}`, 'l\'infobulle redit les deux lignes, une par ligne');
});

test('un dossier choisi : son nom, le nombre de fichiers et le poids, puis le rappel du rangement', () => {
  const one = read(infoBar(ctx({ selected: { kind: 'folder', path: 'A/B', name: 'B', count: 3, weight: 2048 } })));
  assert.match(one.first, new RegExp(`^B· ${t('ex.fileCount', { n: 3 })} · 2 Ko$`));
  assert.equal(one.second, t('ex.hintPersonal'));
  assert.equal(one.symbol, '#i-folder');
  assert.equal(read(infoBar(ctx({ personal: false, selected: { kind: 'folder', path: 'A', name: 'A', count: 0, weight: 0 } }))).second, t('ex.hintShared'));
});

test('un fichier choisi : son nom, son type et son poids ; l\'app qui l\'ouvre, la date et l\'auteur de sa dernière modification', () => {
  const one = read(infoBar(ctx({ selected: { kind: 'file', file: file() } })));
  assert.equal(one.first, 'Convocation· document · 2 Ko');
  assert.equal(one.second, `S'ouvre dans Publipostage+ · ${t('ex.modifiedOn', { date: '01/11/2025' })} · ${t('ex.modifiedBy', { by: 'paul@exemple.fr' })}`);
  assert.equal(one.fam, 'doc');
  assert.equal(one.symbol, '#i-doc');
  assert.equal(one.title, `${one.first}\n${one.second}`);
});

test('un fichier sans date, sans auteur, sans nom : seules les phrases qui ont de quoi se dire', () => {
  const one = read(infoBar(ctx({ selected: { kind: 'file', file: file({ ts: null, by: '', name: '' }) } })));
  assert.equal(one.first, `${t('ex.untitled')}· document · 2 Ko`);
  assert.equal(one.second, 'S\'ouvre dans Publipostage+');
  assert.equal(read(infoBar(ctx({ selected: { kind: 'file', file: file({ family: 'inconnue' }) } }))).fam, undefined, 'une famille inconnue n\'a pas de couleur');
});

test('un fichier grisé : la raison remplace les faits, le cadenas remplace l\'icône, la couleur de famille s\'efface', () => {
  const one = read(infoBar(ctx({ selected: { kind: 'file', file: file() }, lockOf: () => ({ text: 'Installez Publipostage+ pour l\'ouvrir.' }) })));
  assert.equal(one.second, 'Installez Publipostage+ pour l\'ouvrir.');
  assert.equal(one.symbol, '#i-lock');
  assert.equal(one.fam, undefined);
});

test('à la corbeille : quand le fichier y est allé et par qui, et où il revient', () => {
  const gone = file({ trashed: { ts: 1762000000, by: 'paul@exemple.fr' }, folder: 'Factures' });
  const one = read(infoBar(ctx({ state: { view: 'trash' }, selected: { kind: 'file', file: gone } })));
  assert.equal(one.second, `${t('trash.deletedOn', { date: '01/11/2025' })} · ${t('ex.modifiedBy', { by: 'paul@exemple.fr' })} · ${t('trash.backTo', { folder: 'Factures' })}`);
  const root = read(infoBar(ctx({ state: { view: 'trash' }, selected: { kind: 'file', file: file({ trashed: { ts: 1762000000, by: '' }, by: '' }) } })));
  assert.equal(root.second, t('trash.deletedOn', { date: '01/11/2025' }), 'sans auteur ni dossier : la date seule');
});
