// Les extensions d'une app (contrats 2.6) et ce que GFS retient des apps installées dans la table du document (7.4, 6.5 point 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogue } from '../js/apps/libraries.js';
import { activeExtensionIds, libraryNeeds, extensionRows, missingLibraries, modeOfExtension, libraryModes, extensionsState } from '../js/apps/extensions.js';
import { readApps, toOption, patchApps, withApp, withExtension, withMode } from '../js/apps/settings.js';
import { publipostage, readJson } from './helpers.mjs';

const SRI = `sha384-${'B'.repeat(64)}`;
const catalogue = readCatalogue({ bibliotheques: [{
  id: 'plotly', version: '2.13.2', poids: 1000,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI },
}, {
  id: 'echarts', version: '6.1.0', poids: 1000,
  cdn: { src: 'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js', integrite: SRI },
  vendorise: { chemin: 'vendor/echarts/6.1.0/dist/echarts.min.js', integrite: SRI },
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
  assert.deepEqual(missingLibraries(pub.extensions[0], empty), [{ id: 'plotly', version: '2.13.2' }, { id: 'echarts', version: '6.1.0' }]);
  const withoutCharts = readCatalogue({ bibliotheques: [...catalogue.entries.values()].filter(entry => entry.id !== 'echarts') });
  assert.deepEqual(missingLibraries(pub.extensions[0], withoutCharts), [{ id: 'echarts', version: '6.1.0' }], 'sans ECharts, le graphique créé dans l\'app n\'a pas son moteur : l\'extension reste grisée');
  assert.deepEqual(activeExtensionIds(pub, setting, withoutCharts), []);
});

test('libraryNeeds : les bibliothèques des extensions actives, sans doublon', () => {
  const both = [{ id: 'plotly', version: '2.13.2' }, { id: 'echarts', version: '6.1.0' }];
  assert.deepEqual(libraryNeeds(pub, ['graphique']), both);
  assert.deepEqual(libraryNeeds(pub, []), []);
  assert.deepEqual(libraryNeeds(pub, ['graphique', 'graphique']), both);
});

test('extensionRows : coché, grisé avec ce qui manque, mode, poids de la bibliothèque', () => {
  const [row] = extensionRows(pub, { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, catalogue);
  assert.equal(row.checked, true);
  assert.equal(row.greyed, false);
  assert.equal(row.mode, 'vendorise');
  assert.deepEqual(row.libraries, [{ id: 'plotly', version: '2.13.2', poids: 1000 }, { id: 'echarts', version: '6.1.0', poids: 1000 }]);
  const [grey] = extensionRows(pub, { extensions: ['graphique'], modes: {} }, empty);
  assert.equal(grey.greyed, true);
  assert.equal(grey.checked, false, 'une extension qu\'on ne peut pas servir n\'est pas cochée, même retenue');
  assert.equal(modeOfExtension({ modes: {} }, 'graphique'), 'cdn');
});

test('readApps : sans valeur retenue, l\'app qui ne se retire pas ; avec, seulement des apps et extensions connues', () => {
  assert.deepEqual(readApps(null, manifests, ['publipostage']), { apps: { publipostage: { extensions: [], modes: {} } }, stored: false });
  const stored = readApps({
    publipostage: { extensions: ['graphique', 'x'], modes: { graphique: 'vendorise', x: 'cdn' } },
    automation: { extensions: [] }, fantome: { extensions: [] },
  }, manifests, ['publipostage']);
  assert.equal(stored.stored, true);
  assert.deepEqual(Object.keys(stored.apps), ['publipostage', 'automation']);
  assert.deepEqual(stored.apps.publipostage, { extensions: ['graphique'], modes: { graphique: 'vendorise' } });
  assert.deepEqual(readApps('texte', manifests, ['publipostage']).apps, { publipostage: { extensions: [], modes: {} } });
  assert.deepEqual(readApps(['liste'], manifests, ['publipostage']).stored, false, 'une liste n\'est pas une valeur retenue');
  assert.deepEqual(readApps({ automation: {} }, manifests, ['publipostage']).apps.publipostage, { extensions: [], modes: {} }, 'Publipostage+ reste, même absent de la valeur retenue');
});

test('toOption : dans l\'ordre du catalogue, sans modes vides', () => {
  const apps = { automation: { extensions: [], modes: {} }, publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } } };
  const value = toOption(apps, ['publipostage', 'automation']);
  assert.deepEqual(Object.keys(value), ['publipostage', 'automation']);
  assert.deepEqual(value, { publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, automation: { extensions: [] } });
});

test('patchApps : ne change que l\'entrée touchée et garde ce que cette version ne connaît pas (contrats 6.5, point 4)', () => {
  const raw = {
    publipostage: { extensions: ['graphique', 'futur'], modes: { graphique: 'vendorise', futur: 'cdn' }, champ: 1 },
    nouvelle: { extensions: ['x'] },
    automation: { extensions: [] },
  };
  const entry = { extensions: ['graphique'], modes: {} };
  const next = patchApps(raw, 'publipostage', entry, pub);
  assert.deepEqual(next.publipostage, { extensions: ['graphique', 'futur'], modes: { futur: 'cdn' }, champ: 1 }, 'l\'extension, le mode et le champ inconnus restent');
  assert.deepEqual(next.nouvelle, { extensions: ['x'] }, 'une app inconnue de cette version reste');
  assert.deepEqual(next.automation, { extensions: [] });
  assert.deepEqual(raw.publipostage.modes, { graphique: 'vendorise', futur: 'cdn' }, 'la valeur relue n\'est pas modifiée');
  assert.deepEqual(patchApps(raw, 'automation', null, automation).automation, undefined, 'retirer une app');
  assert.ok(Object.hasOwn(patchApps(raw, 'automation', null, automation), 'nouvelle'));
  const bare = patchApps({ automation: { extensions: [] } }, 'publipostage', { extensions: [], modes: {} }, pub);
  assert.deepEqual(bare.publipostage, { extensions: [] }, 'sans mode, pas de clé modes');
});

test('patchApps : sans valeur relue, le point de départ est ce que la fenêtre montrait', () => {
  const seed = toOption({ publipostage: { extensions: [], modes: {} } }, ['publipostage', 'automation']);
  assert.deepEqual(patchApps(null, 'automation', { extensions: [], modes: {} }, automation, seed), { publipostage: { extensions: [] }, automation: { extensions: [] } });
  assert.deepEqual(patchApps('texte', 'automation', { extensions: [], modes: {} }, automation, seed), { publipostage: { extensions: [] }, automation: { extensions: [] } }, 'un texte n\'est pas une valeur : on repart du point de départ');
  assert.deepEqual(patchApps(null, 'automation', { extensions: [], modes: {} }, automation), { automation: { extensions: [] } });
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

test('extensionsState : ce que l\'app reçoit (adresse, empreinte et forme seulement) et ce que GFS garde', () => {
  const base = 'https://exemple.test/gfs/';
  const off = extensionsState(pub, { extensions: [], modes: {} }, catalogue, base);
  assert.deepEqual(off, { extensions: [], bibliotheques: {}, details: {} });
  const cdn = extensionsState(pub, { extensions: ['graphique'], modes: {} }, catalogue, base);
  assert.deepEqual(cdn.extensions, ['graphique']);
  assert.deepEqual(cdn.bibliotheques, {
    plotly: { src: 'https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.13.2/plotly-basic.min.js', integrite: SRI, forme: 'script' },
    echarts: { src: 'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js', integrite: SRI, forme: 'script' },
  });
  assert.equal(cdn.details.plotly.mode, 'cdn');
  assert.equal(cdn.details.echarts.mode, 'cdn');
  const local = extensionsState(pub, { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, catalogue, base);
  assert.deepEqual(local.bibliotheques, {
    plotly: { src: 'https://exemple.test/gfs/vendor/plotly/2.13.2/plotly-basic.min.js', integrite: SRI, forme: 'script' },
    echarts: { src: 'https://exemple.test/gfs/vendor/echarts/6.1.0/dist/echarts.min.js', integrite: SRI, forme: 'script' },
  });
  assert.equal(local.details.plotly.mode, 'vendorise');
  assert.equal(local.details.echarts.mode, 'vendorise', 'les deux bibliothèques d\'une extension suivent le même mode');
  assert.deepEqual(extensionsState(pub, { extensions: ['graphique'], modes: {} }, empty, base).extensions, [], 'une bibliothèque absente du catalogue : l\'extension n\'est pas servie');
});

// Un fichier assemblé par GFS (2.6, points 8 à 11) : sans CDN quand GFS n'a pas d'adresse publique épinglée, la copie de GFS est son seul mode.
const SRI_MODULE = `sha384-${'C'.repeat(64)}`;
const withModule = readCatalogue({ bibliotheques: [{
  id: 'edition-live', version: '1.0.0', forme: 'module', poids: 145862,
  contient: [{ paquet: 'yjs', version: '13.6.33' }], modules: ['yjs'], externes: ['prosemirror-state'],
  cdn: null, vendorise: { chemin: 'vendor/edition-live/1.0.0/edition-live.js', integrite: SRI_MODULE },
}, ...catalogue.entries.values()] });
const live = pub;   // le manifeste de Publipostage+ déclare l'extension « edition », qui exige edition-live 1.0.0

test('une extension dont la bibliothèque n\'a pas de CDN : la copie de GFS est son seul mode, quel que soit le choix retenu', () => {
  const [graph, edition] = extensionRows(live, { extensions: ['graphique', 'edition'], modes: { graphique: 'cdn', edition: 'cdn' } }, withModule);
  assert.equal(graph.noCdn, false);
  assert.equal(graph.mode, 'cdn');
  assert.equal(edition.noCdn, true);
  assert.equal(edition.mode, 'vendorise', 'le CDN n\'existe pas : la ligne montre la copie de GFS');
  assert.equal(edition.greyed, false, 'sans CDN ne veut pas dire grisée : la copie sert');
  assert.equal(modeOfExtension({ modes: { edition: 'cdn' } }, 'edition'), 'cdn', 'le réglage retenu n\'est pas réécrit');
  assert.equal(libraryModes(live, { extensions: ['edition'], modes: {} }, ['edition'], withModule).get('edition-live'), 'vendorise');
  assert.equal(libraryModes(live, { extensions: ['edition'], modes: { edition: 'cdn' } }, ['edition']).get('edition-live'), 'cdn', 'sans catalogue, le réglage seul décide');
});

test('le manifeste et le catalogue réels s\'accordent : chaque extension a ses bibliothèques, l\'édition collaborative a ses deux modes (le CDN une fois choisi)', () => {
  const real = readCatalogue(readJson('bibliotheques/catalogue.json'));
  assert.deepEqual(pub.extensions.map(extension => extension.id), ['graphique', 'edition', 'diapositives', 'lecture-pdf', 'polices']);
  assert.deepEqual(pub.extensions.flatMap(extension => missingLibraries(extension, real)), [], 'aucune extension déclarée n\'est grisée par le catalogue');
  const rows = extensionRows(pub, { extensions: ['graphique', 'edition'], modes: { graphique: 'cdn', edition: 'cdn' } }, real);
  const edition = rows.find(row => row.extension.id === 'edition');
  assert.equal(edition.greyed, false);
  assert.equal(edition.noCdn, false, 'GFS épingle un commit de son dépôt public : jsDelivr sert le fichier assemblé');
  assert.equal(edition.mode, 'cdn', 'le CDN choisi à la main reste le CDN');
  assert.deepEqual(edition.libraries.map(lib => `${lib.id}@${lib.version}`), ['edition-live@1.0.0']);
  assert.ok(edition.libraries[0].poids > 100000, 'le poids du fichier assemblé est celui du catalogue');
  const state = extensionsState(pub, { extensions: ['edition'], modes: { edition: 'cdn' } }, real, 'https://exemple.test/gfs/');
  assert.deepEqual(state.extensions, ['edition']);
  assert.deepEqual(Object.keys(state.bibliotheques), ['edition-live']);
  const given = state.bibliotheques['edition-live'];
  assert.equal(given.forme, 'module');
  assert.match(given.src, /^https:\/\/cdn\.jsdelivr\.net\/gh\/lombre33\/grist-widget-GFS@[0-9a-f]{40}\/prototype\/vendor\/edition-live\/1\.0\.0\/edition-live\.js$/);
  assert.match(given.integrite, /^sha384-[A-Za-z0-9+/]{64}$/);
  assert.equal(state.details['edition-live'].mode, 'cdn');
  const local = extensionsState(pub, { extensions: ['edition'], modes: { edition: 'vendorise' } }, real, 'https://exemple.test/gfs/').bibliotheques['edition-live'];
  assert.equal(local.src, 'https://exemple.test/gfs/vendor/edition-live/1.0.0/edition-live.js');
  assert.equal(local.integrite, given.integrite, 'les deux modes portent la même empreinte : un seul fichier, deux adresses');
  assert.equal(local.forme, 'module');
});

// « Lecture de PDF » de Publipostage+ (sa demande de la consigne 040, déclarée le 04/11) : pdf.js vient de la copie de GFS seule, en un fichier de forme « module ».
test('Publipostage+ : « Lecture de PDF » reçoit pdf.js de la copie de GFS seule, jamais d\'un CDN, et n\'est pas grisée', () => {
  const real = readCatalogue(readJson('bibliotheques/catalogue.json'));
  const reading = pub.extensions.find(extension => extension.id === 'lecture-pdf');
  assert.deepEqual(reading.bibliotheques, [{ id: 'pdfjs', version: '1.0.0' }]);
  assert.deepEqual(missingLibraries(reading, real), [], 'le catalogue a pdf.js');
  const row = extensionRows(pub, { extensions: ['lecture-pdf'], modes: {} }, real).find(item => item.extension.id === 'lecture-pdf');
  assert.equal(row.greyed, false);
  assert.equal(row.noCdn, true, 'pdf.js n\'a pas d\'adresse de CDN');
  assert.equal(row.mode, 'vendorise', 'sans CDN, la copie de GFS sert');
  const state = extensionsState(pub, { extensions: ['lecture-pdf'], modes: {} }, real, 'https://exemple.test/gfs/');
  assert.deepEqual(state.extensions, ['lecture-pdf']);
  assert.deepEqual(Object.keys(state.bibliotheques), ['pdfjs']);
  assert.equal(state.bibliotheques.pdfjs.forme, 'module');
  assert.equal(state.bibliotheques.pdfjs.src, 'https://exemple.test/gfs/vendor/pdfjs/1.0.0/pdfjs.js');
  assert.match(state.bibliotheques.pdfjs.integrite, /^sha384-[A-Za-z0-9+/]{64}$/);
});

// « Polices » de Publipostage+ (sa demande du 12/11, `GFS-ETAT.md` : la police Marianne de l'État dans le PDF) : un seul fichier de l'app, sans bibliothèque ni point d'entrée (elle ouvre un
// choix dans une fenêtre qui existe déjà), décochée au départ, grisée jamais ; les fichiers de Marianne ne vont ni au catalogue de GFS ni dans `vendor/`.
test('Publipostage+ : « Polices » est déclarée sans bibliothèque ni point d\'entrée, décochée au départ, et l\'app ne reçoit que son identifiant', () => {
  const real = readCatalogue(readJson('bibliotheques/catalogue.json'));
  const fonts = pub.extensions.find(extension => extension.id === 'polices');
  assert.deepEqual(fonts.nom, { fr: 'Polices', en: 'Fonts' }, 'le nom est celui de l\'app (`extension.polices.name`)');
  assert.equal(fonts.dossier, 'extensions/polices/');
  assert.equal(fonts.poids, 8, 'un fichier de 7 705 octets');
  assert.equal(fonts.bibliotheques, undefined, 'GFS n\'a rien à porter : Marianne ne vient pas du catalogue');
  assert.equal(fonts.pointsEntree, undefined, 'ni bouton, ni menu, ni type, ni export');
  assert.match(fonts.texte.fr, /Marianne.*quand la personne dit avoir le droit de s.en servir/);
  assert.match(fonts.texte.en, /Marianne.*when the person says they are entitled to use it/);
  assert.deepEqual(missingLibraries(fonts, real), []);
  const off = extensionRows(pub, { extensions: [], modes: {} }, real).find(item => item.extension.id === 'polices');
  assert.equal(off.checked, false, 'décochée tant que la personne n\'a pas choisi : l\'app ne charge rien');
  assert.equal(off.greyed, false);
  assert.deepEqual(off.libraries, []);
  const on = extensionsState(pub, { extensions: ['polices'], modes: {} }, real, 'https://exemple.test/gfs/');
  assert.deepEqual(on.extensions, ['polices']);
  assert.deepEqual(Object.keys(on.bibliotheques), []);
  assert.deepEqual(extensionsState(pub, { extensions: [], modes: {} }, real, 'https://exemple.test/gfs/').extensions, []);
});

// Une extension sans bibliothèque (les diapositives de Publipostage+ : un type de fichier et une ligne de menu, du code qui reste dans l'app).
test('une extension sans bibliothèque : jamais grisée, rien à charger, l\'app ne reçoit que son identifiant', () => {
  const real = readCatalogue(readJson('bibliotheques/catalogue.json'));
  const slides = pub.extensions.find(extension => extension.id === 'diapositives');
  assert.deepEqual(slides.bibliotheques, undefined);
  assert.deepEqual(missingLibraries(slides, real), []);
  const [row] = extensionRows({ extensions: [slides] }, { extensions: ['diapositives'], modes: {} }, readCatalogue({ bibliotheques: [] }));
  assert.equal(row.greyed, false, 'même avec un catalogue vide : rien n\'est exigé, rien ne peut manquer');
  assert.equal(row.checked, true);
  assert.deepEqual(row.libraries, []);
  assert.equal(row.noCdn, false, 'pas de bibliothèque, donc pas de question de CDN');
  assert.equal(activeExtensionIds(pub, { extensions: ['diapositives'] }, real).join(), 'diapositives');
  const state = extensionsState(pub, { extensions: ['diapositives'], modes: {} }, real, 'https://exemple.test/gfs/');
  assert.deepEqual(state.extensions, ['diapositives']);
  assert.deepEqual(state.bibliotheques, {}, 'aucune bibliothèque dans le contexte : l\'app n\'a rien à charger');
  assert.deepEqual(state.details, {});
  assert.deepEqual(extensionsState(pub, { extensions: [], modes: {} }, real, 'https://exemple.test/gfs/').extensions, [], 'éteinte, elle n\'est pas dite à l\'app');
});

test('extensionsState : un fichier assemblé arrive à l\'app sous la forme module, servi par la copie de GFS', () => {
  const base = 'https://exemple.test/gfs/';
  const state = extensionsState(live, { extensions: ['edition'], modes: {} }, withModule, base);
  assert.deepEqual(state.extensions, ['edition']);
  assert.deepEqual(state.bibliotheques, { 'edition-live': { src: 'https://exemple.test/gfs/vendor/edition-live/1.0.0/edition-live.js', integrite: SRI_MODULE, forme: 'module' } });
  assert.equal(state.details['edition-live'].mode, 'vendorise');
  assert.deepEqual(extensionsState(live, { extensions: ['edition'], modes: {} }, empty, base).extensions, [], 'absent du catalogue : grisée comme toute extension');
});

// 13/11 : le porteur a vu « Écriture en direct impossible » au premier essai. Le défaut était « Depuis un CDN » et la politique de sécurité de Publipostage+ ne nomme pas l'adresse de
// jsDelivr (consigne 016 en attente de la bascule) : le navigateur refusait le fichier. Sa demande : que cela fonctionne dans les deux modes, et que l'un soit réglé par défaut quand
// on active l'extension. Le manifeste dit que l'app n'accepte pas encore le CDN (`cdnAccepte: false`) : le défaut est la copie de GFS, qui marche ; le CDN reste un choix libre.
test('Publipostage+ ne nomme pas encore l\'adresse du CDN de l\'édition collaborative : activée, elle démarre en copie de GFS ; le CDN reste un choix libre', () => {
  const real = readCatalogue(readJson('bibliotheques/catalogue.json'));
  const rows = extensionRows(pub, { extensions: ['edition'], modes: {} }, real);
  assert.deepEqual(rows.filter(row => row.cdnRefused).map(row => row.extension.id), ['edition'], 'seule l\'édition collaborative est refusée au CDN');
  const edition = rows.find(row => row.extension.id === 'edition');
  assert.equal(edition.mode, 'vendorise', 'au défaut, l\'activation donne la copie de GFS : le CDN serait refusé par le navigateur');
  assert.equal(edition.defaultMode, 'vendorise');
  assert.equal(rows.find(row => row.extension.id === 'graphique').defaultMode, 'cdn', 'les autres extensions gardent le CDN par défaut');
  assert.equal(edition.noCdn, false, 'le CDN reste libre : il suffira que l\'app nomme l\'adresse');
  assert.equal(extensionRows(pub, { extensions: ['edition'], modes: { edition: 'cdn' } }, real).find(row => row.extension.id === 'edition').mode, 'cdn', 'le choix du CDN est respecté');
  const given = extensionsState(pub, { extensions: ['edition'], modes: {} }, real, 'https://exemple.test/gfs/').bibliotheques['edition-live'];
  assert.equal(given.src, 'https://exemple.test/gfs/vendor/edition-live/1.0.0/edition-live.js', 'l\'app reçoit l\'adresse de la copie de GFS, que sa politique accepte (\'self\')');
  assert.match(extensionsState(pub, { extensions: ['edition'], modes: { edition: 'cdn' } }, real, 'https://exemple.test/gfs/').bibliotheques['edition-live'].src, /^https:\/\/cdn\.jsdelivr\.net\/gh\//);
  const named = JSON.parse(JSON.stringify(pub));
  delete named.extensions.find(extension => extension.id === 'edition').cdnAccepte;
  const back = extensionRows(named, { extensions: ['edition'], modes: {} }, real).find(row => row.extension.id === 'edition');
  assert.equal(back.mode, 'cdn', 'dès que l\'app nomme l\'adresse, le défaut redevient le CDN');
  assert.equal(back.cdnRefused, false);
});

// Le défaut de l'édition collaborative étant la copie, c'est le CDN qui doit pouvoir se retenir : `cleanApp` n'écrit que ce qui n'est pas le défaut de l'extension (un CDN écarté comme « défaut »
// aurait rendu le choix du CDN impossible : la ligne serait revenue à la copie au rechargement).
test('Publipostage+ : choisir le CDN pour l\'édition collaborative se retient ; choisir la copie, qui est le défaut, ne s\'écrit pas ; les autres extensions gardent le CDN pour défaut', () => {
  const start = { publipostage: { extensions: ['edition', 'graphique'], modes: {} } };
  const cdn = withMode(start, pub, 'edition', 'cdn');
  assert.deepEqual(cdn.publipostage.modes, { edition: 'cdn' }, 'le CDN est un choix : il s\'écrit');
  assert.deepEqual(readApps(toOption(cdn, ['publipostage']), new Map([['publipostage', pub]]), []).apps.publipostage.modes, { edition: 'cdn' }, 'et il se relit tel quel');
  assert.deepEqual(withMode(cdn, pub, 'edition', 'vendorise').publipostage.modes, {}, 'la copie est le défaut de cette extension : rien à écrire');
  const graphic = withMode(start, pub, 'graphique', 'vendorise');
  assert.deepEqual(graphic.publipostage.modes, { graphique: 'vendorise' }, 'ailleurs la copie est le choix, le CDN le défaut');
  assert.deepEqual(withMode(graphic, pub, 'graphique', 'cdn').publipostage.modes, {});
});

