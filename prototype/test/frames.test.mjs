// L'adresse du sous-cadre (contrats 1.3, point 2) : GFS la calcule, depuis le catalogue et le manifeste livrés avec lui ; le site vivant de l'app ou sa copie figée, jamais une
// adresse venue d'ailleurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameUrl, liveSwitch } from '../js/frames.js';
import { CATALOGUE } from '../js/catalogue.js';
import { publipostage, form } from './helpers.mjs';

const BASE = 'https://exemple.github.io/grist-widget-GFS/prototype/index.html?access=full&language=fr';
const common = { access: 'full', readonly: false, preferences: { language: 'fr' }, base: BASE };
const entryOf = id => CATALOGUE.find(entry => entry.id === id);

test('la copie figée : le dossier de l\'app dans le site de GFS, avec les six paramètres de Grist et le numéro de contrat', () => {
  const url = new URL(frameUrl({ ...common, entry: entryOf('publipostage'), manifest: publipostage() }));
  assert.equal(url.origin + url.pathname, 'https://exemple.github.io/grist-widget-GFS/prototype/apps/publipostage/index.html');
  assert.equal(url.searchParams.get('access'), 'full');
  assert.equal(url.searchParams.get('language'), 'fr');
  assert.equal(url.searchParams.get('gfs'), '0');
});

test('le site vivant : le site de l\'app, à la racine de l\'origine de GFS, avec les mêmes paramètres', () => {
  const url = new URL(frameUrl({ ...common, entry: entryOf('publipostage'), manifest: publipostage(), live: true }));
  assert.equal(url.origin + url.pathname, 'https://exemple.github.io/publipostageGrist/index.html');
  assert.equal(url.searchParams.get('access'), 'full');
  assert.equal(url.searchParams.get('language'), 'fr');
  assert.equal(url.searchParams.get('gfs'), '0');
  // L'entrée vient du manifeste, comme pour la copie : Form+ a la sienne dans `poc/`.
  const formUrl = new URL(frameUrl({ ...common, entry: entryOf('form'), manifest: form(), live: true }));
  assert.equal(formUrl.origin + formUrl.pathname, 'https://exemple.github.io/FormPlus/poc/widget.html');
});

test('une app qui n\'a pas de site vivant garde sa copie figée, même quand le vivant est demandé', () => {
  const entry = { id: 'sans-site', dossier: 'apps/sans-site/' };
  const url = new URL(frameUrl({ ...common, entry, manifest: { ...publipostage(), entree: 'index.html' }, live: true }));
  assert.equal(url.pathname, '/grist-widget-GFS/prototype/apps/sans-site/index.html');
});

test('chaque app du catalogue a un site vivant : un seul segment du site de GFS, jamais une autre origine ni un chemin qui remonte', () => {
  for (const entry of CATALOGUE) {
    assert.match(entry.site, /^[A-Za-z0-9][A-Za-z0-9_.-]*\/$/, entry.id);
    assert.ok(!entry.site.startsWith('_') && !entry.site.startsWith('.'), `${entry.id} : Pages ne sert rien dont le nom commence par « _ » ou « . »`);
    const url = new URL(frameUrl({ ...common, entry, manifest: { entree: 'index.html' }, live: true }));
    assert.equal(url.origin, 'https://exemple.github.io', entry.id);
  }
});

test('le vivant est le défaut des essais ; `live=0` ramène à la copie figée, rien d\'autre n\'y change', () => {
  assert.equal(liveSwitch(''), true);
  assert.equal(liveSwitch('?access=full&language=fr'), true);
  assert.equal(liveSwitch('?live=0'), false);
  assert.equal(liveSwitch('?access=full&live=0&language=fr'), false);
  assert.equal(liveSwitch('?live=1'), true);
  assert.equal(liveSwitch('?live=non'), true);
});
