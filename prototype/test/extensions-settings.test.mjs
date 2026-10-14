// Les extensions d'une app (contrats 2.6) et ce que GFS retient dans les réglages de la section (7.4) : `gfs.apps`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogue } from '../js/libraries.js';
import { activeExtensionIds, libraryNeeds, extensionRows, missingLibraries, modeOfExtension, libraryModes, extensionsState } from '../js/extensions.js';
import { readApps, toOption, withApp, withExtension, withMode, APPS_KEY } from '../js/settings.js';
import { publipostage } from './helpers.mjs';

const SRI = `sha384-${'B'.repeat(64)}`;
const catalogue = readCatalogue({ bibliotheques: [{
  id: 'plotly', version: '2.13.2', poids: 1000,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI },
}] });
const empty = readCatalogue({ bibliotheques: [] });
const pub = publipostage();
const automation = { id: 'automation', nom: { fr: 'A', en: 'A' } };
const manifests = new Map([[pub.id, pub], [automation.id, automation]]);

test('activeExtensionIds : cochée ET servable ; une bibliothèque absente du catalogue grise l\'extension', () => {
  const setting = { extensions: ['graphique', 'inconnue'], modes: {} };
  assert.deepEqual(activeExtensionIds(pub, setting, catalogue), ['graphique']);
  assert.deepEqual(activeExtensionIds(pub, setting, empty), []);
  assert.deepEqual(activeExtensionIds(pub, undefined, catalogue), []);
  assert.deepEqual(missingLibraries(pub.extensions[0], empty), [{ id: 'plotly', version: '2.13.2' }]);
});

test('libraryNeeds : les bibliothèques des extensions actives, sans doublon', () => {
  assert.deepEqual(libraryNeeds(pub, ['graphique']), [{ id: 'plotly', version: '2.13.2' }]);
  assert.deepEqual(libraryNeeds(pub, []), []);
  assert.deepEqual(libraryNeeds(pub, ['graphique', 'graphique']), [{ id: 'plotly', version: '2.13.2' }]);
});

test('extensionRows : coché, grisé avec ce qui manque, mode, poids de la bibliothèque', () => {
  const [row] = extensionRows(pub, { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, catalogue);
  assert.equal(row.checked, true);
  assert.equal(row.greyed, false);
  assert.equal(row.mode, 'vendorise');
  assert.deepEqual(row.libraries, [{ id: 'plotly', version: '2.13.2', poids: 1000 }]);
  const [grey] = extensionRows(pub, { extensions: ['graphique'], modes: {} }, empty);
  assert.equal(grey.greyed, true);
  assert.equal(grey.checked, false, 'une extension qu\'on ne peut pas servir n\'est pas cochée, même retenue');
  assert.equal(modeOfExtension({ modes: {} }, 'graphique'), 'cdn');
});

test('readApps : sans gfs.apps, l\'app qui ne se retire pas ; avec, seulement des apps et extensions connues', () => {
  assert.deepEqual(readApps(null, manifests, ['publipostage']), { apps: { publipostage: { extensions: [], modes: {} } }, stored: false });
  const stored = readApps({ [APPS_KEY]: {
    publipostage: { extensions: ['graphique', 'x'], modes: { graphique: 'vendorise', x: 'cdn' } },
    automation: { extensions: [] }, fantome: { extensions: [] },
  } }, manifests, ['publipostage']);
  assert.equal(stored.stored, true);
  assert.deepEqual(Object.keys(stored.apps), ['publipostage', 'automation']);
  assert.deepEqual(stored.apps.publipostage, { extensions: ['graphique'], modes: { graphique: 'vendorise' } });
  assert.deepEqual(readApps({ [APPS_KEY]: 'texte' }, manifests, ['publipostage']).apps, { publipostage: { extensions: [], modes: {} } });
  assert.deepEqual(readApps({ [APPS_KEY]: { automation: {} } }, manifests, ['publipostage']).apps.publipostage, { extensions: [], modes: {} }, 'Publipostage+ reste, même absent de la valeur retenue');
});

test('toOption : dans l\'ordre du catalogue, sans modes vides', () => {
  const apps = { automation: { extensions: [], modes: {} }, publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } } };
  const value = toOption(apps, ['publipostage', 'automation']);
  assert.deepEqual(Object.keys(value), ['publipostage', 'automation']);
  assert.deepEqual(value, { publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, automation: { extensions: [] } });
});

test('withApp, withExtension, withMode : chacun rend un nouvel objet et borne ce qu\'il écrit', () => {
  const base = { publipostage: { extensions: [], modes: {} } };
  const installed = withApp(base, automation, true);
  assert.deepEqual(Object.keys(installed), ['publipostage', 'automation']);
  assert.notStrictEqual(installed, base);
  assert.deepEqual(Object.keys(withApp(installed, automation, false)), ['publipostage']);
  const on = withExtension(base, pub, 'graphique', true);
  assert.deepEqual(on.publipostage.extensions, ['graphique']);
  assert.deepEqual(withExtension(on, pub, 'graphique', false).publipostage.extensions, []);
  assert.deepEqual(withExtension(base, pub, 'inconnue', true).publipostage.extensions, [], 'une extension non déclarée n\'entre pas');
  assert.deepEqual(withExtension(base, automation, 'graphique', true), base, 'une app non installée ne reçoit rien');
  const local = withMode(on, pub, 'graphique', 'vendorise');
  assert.deepEqual(local.publipostage.modes, { graphique: 'vendorise' });
  assert.deepEqual(withMode(local, pub, 'graphique', 'cdn').publipostage.modes, {}, 'le défaut ne s\'écrit pas');
  assert.deepEqual(withMode(on, pub, 'graphique', 'bizarre'), on);
  assert.deepEqual(withExtension(local, pub, 'graphique', false).publipostage.modes, {}, 'décocher une extension retire son mode');
});

test('libraryModes : la copie de GFS dès qu\'une extension active la demande', () => {
  const two = { ...pub, extensions: [...pub.extensions, { ...pub.extensions[0], id: 'courbes', nom: { fr: 'C', en: 'C' } }] };
  const cdn = libraryModes(two, { extensions: ['graphique', 'courbes'], modes: {} }, ['graphique', 'courbes']);
  assert.equal(cdn.get('plotly'), 'cdn');
  const mixed = libraryModes(two, { extensions: ['graphique', 'courbes'], modes: { courbes: 'vendorise' } }, ['graphique', 'courbes']);
  assert.equal(mixed.get('plotly'), 'vendorise', 'l\'ordre des extensions ne change pas le résultat');
  assert.equal(libraryModes(two, { extensions: ['courbes', 'graphique'], modes: { courbes: 'vendorise' } }, ['courbes', 'graphique']).get('plotly'), 'vendorise');
  assert.equal(libraryModes(two, undefined, []).size, 0);
});

test('extensionsState : ce que l\'app reçoit (adresse et empreinte seulement) et ce que GFS garde', () => {
  const base = 'https://exemple.test/gfs/';
  const off = extensionsState(pub, { extensions: [], modes: {} }, catalogue, base);
  assert.deepEqual(off, { extensions: [], bibliotheques: {}, details: {} });
  const cdn = extensionsState(pub, { extensions: ['graphique'], modes: {} }, catalogue, base);
  assert.deepEqual(cdn.extensions, ['graphique']);
  assert.deepEqual(cdn.bibliotheques, { plotly: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI } });
  assert.equal(cdn.details.plotly.mode, 'cdn');
  const local = extensionsState(pub, { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, catalogue, base);
  assert.deepEqual(local.bibliotheques, { plotly: { src: 'https://exemple.test/gfs/vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI } });
  assert.equal(local.details.plotly.mode, 'vendorise');
  assert.deepEqual(extensionsState(pub, { extensions: ['graphique'], modes: {} }, empty, base).extensions, [], 'une bibliothèque absente du catalogue : l\'extension n\'est pas servie');
});
