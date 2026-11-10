// Les réglages écrits dans la vue, sans « Enregistrer » (contrats 7.3). Un faux Grist ne sert ici qu'à vérifier ce que GFS lit et écrit : que Grist renvoie à un widget les réglages de SA
// section, sans « Enregistrer » et sans reconstruire son cadre, se mesure dans un vrai Grist (labo/run-reglages-directs.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewOptions, addressOf, candidatesOf, withChanges, PROBE_KEY } from '../js/view-options.js';

const ADDRESS = 'https://gfs.example/suite/prototype';
const url = (suffix = '') => `https://gfs.example/suite/prototype/index.html${suffix}`;

// `options` d'une section de Grist : un objet dont `customView` est un texte JSON (celui que Grist écrit).
const optionsText = ({ address = url('?language=fr'), widgetOptions = null, access = 'full', extra = {} } = {}) => JSON.stringify({
  verticalGridlines: true, ...extra,
  customView: JSON.stringify({ mode: 'url', url: address, widgetDef: null, access, pluginId: '', sectionId: '', renderAfterReady: false, widgetId: null, widgetOptions, columnsMapping: null }),
});
const widgetOptionsOf = text => JSON.parse(JSON.parse(text).customView).widgetOptions;

// Un document : des sections (par lignes), les tables ; `own` est la section que Grist montre à GFS (son `getOptions`).
function fakeGrist({ sections, own, reject = false, echo = true, afterApply = null, draft = null } = {}) {
  const document = { sections: sections.map(row => ({ ...row })), tables: [{ id: 1, tableId: 'Clients' }, { id: 2, tableId: 'Projets' }] };
  const log = { applied: [] };
  const columnar = rows => Object.fromEntries(Object.keys(rows[0]).map(key => [key, rows.map(row => row[key])]));
  const doc = {
    fetchTable: async name => columnar(name === '_grist_Views_section' ? document.sections : document.tables),
    applyUserActions: async actions => {
      if (reject) throw new Error('Blocked by table structure access rules');
      log.applied.push(actions);
      for (const [verb, table, id, values] of actions) {
        assert.equal(verb, 'UpdateRecord');
        assert.equal(table, '_grist_Views_section');
        document.sections.find(row => row.id === id).options = values.options;
      }
      if (afterApply) afterApply(document, log);
      return { retValues: [] };
    },
  };
  const widget = { getOptions: async () => draft || (echo ? widgetOptionsOf(document.sections.find(row => row.id === own).options) : null) };
  const timers = { setTimeout: fn => setImmediate(fn) };
  const make = (extra = {}) => new ViewOptions({ doc, widget, address: ADDRESS, tableId: () => 'Clients', timers, ...extra });
  return { document, log, make };
}
const section = (id, options = {}, tableRef = 1) => ({ id, parentKey: 'custom', tableRef, options: optionsText(options) });
const quiet = t => t.mock.method(console, 'warn', () => {});

test('addressOf : l\'origine et le chemin, sans requête, fragment, index.html ni barre finale', () => {
  assert.equal(addressOf(url('?access=full&readonly=false#x')), ADDRESS);
  assert.equal(addressOf('https://gfs.example/suite/prototype/'), ADDRESS);
  assert.equal(addressOf('https://gfs.example/suite/prototype'), ADDRESS);
  assert.equal(addressOf('pas une adresse'), null);
});

test('candidatesOf : les sections personnalisées de cette adresse et de cette table, rien d\'autre', () => {
  const rows = [
    section(1), // la nôtre
    section(2, { address: 'https://gfs.example/suite/prototype/' }), // la même adresse écrite autrement
    section(3, { address: 'https://autre.example/widget/index.html' }), // un autre widget
    section(4, {}, 2), // une autre table
    { id: 5, parentKey: 'record', tableRef: 1, options: '{}' }, // un tableau
    { id: 6, parentKey: 'custom', tableRef: 1, options: 'pas du JSON' },
  ];
  const sections = Object.fromEntries(Object.keys(rows[0]).map(key => [key, rows.map(row => row[key])]));
  const tables = { id: [1, 2], tableId: ['Clients', 'Projets'] };
  assert.deepEqual(candidatesOf(sections, tables, { address: ADDRESS, tableId: 'Clients' }).map(item => item.id), [1, 2]);
  assert.deepEqual(candidatesOf(sections, tables, { address: ADDRESS, tableId: 'Inconnue' }), []);
  assert.deepEqual(candidatesOf(sections, tables, { address: ADDRESS, tableId: null }), [], 'sans table : les sections sans table, il n\'y en a pas ici');
});

test('withChanges : seule la tranche des réglages change, le reste de la section reste tel que Grist l\'a écrit', () => {
  const before = optionsText({ widgetOptions: { a: 1, 'gfs.x': 2 }, access: 'read table', extra: { numFrozen: 0 } });
  const after = JSON.parse(withChanges(before, [['modeleDeLaVue', '16'], ['a', undefined]]));
  assert.deepEqual(JSON.parse(after.customView).widgetOptions, { 'gfs.x': 2, modeleDeLaVue: '16' });
  assert.equal(JSON.parse(after.customView).access, 'read table');
  assert.equal(JSON.parse(after.customView).url, url('?language=fr'));
  assert.equal(after.verticalGridlines, true);
  assert.equal(after.numFrozen, 0);
});

test('withChanges : plus aucune clé, Grist garde null ; un texte illisible n\'est pas touché', () => {
  assert.equal(widgetOptionsOf(withChanges(optionsText({ widgetOptions: { a: 1 } }), [['a', undefined]])), null);
  assert.equal(withChanges('pas du JSON', [['a', 1]]), null);
  assert.equal(withChanges(JSON.stringify({ customView: 'pas du JSON' }), [['a', 1]]), null);
  const guarded = JSON.parse(JSON.parse(withChanges(optionsText(), [['__proto__', { polluted: true }], ['b', null]])).customView).widgetOptions;
  assert.deepEqual(guarded, { b: null }, 'null est une valeur écrite ; __proto__ n\'est jamais une clé');
  assert.equal({}.polluted, undefined);
});

test('une seule candidate : le réglage est écrit dans la vue, relu, et rien d\'autre n\'est touché', async () => {
  const { make, document, log } = fakeGrist({ sections: [section(4, { widgetOptions: { 'gfs.x': 1 } }), section(9, {}, 2)], own: 4 });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), true);
  assert.equal(log.applied.length, 1, 'une seule écriture');
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { 'gfs.x': 1, modeleDeLaVue: '16' });
  assert.equal(document.sections[1].options, optionsText({}), 'l\'autre table n\'est pas touchée');
});

test('plusieurs réglages en une seule écriture ; une valeur indéfinie retire la clé', async () => {
  const { make, document, log } = fakeGrist({ sections: [section(4, { widgetOptions: { modeleDeLaVue: '16', droitsAcces: 'x' } })], own: 4 });
  assert.equal(await make().write([['modeleDeLaVue', null], ['droitsAcces', undefined], ['dateDernierExport', 'Date']]), true);
  assert.equal(log.applied.length, 1);
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { modeleDeLaVue: null, dateDernierExport: 'Date' });
});

test('un réglage que Grist a déjà ne s\'écrit pas', async () => {
  const { make, log } = fakeGrist({ sections: [section(4, { widgetOptions: { modeleDeLaVue: '16' } })], own: 4 });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), true);
  assert.equal(log.applied.length, 0);
});

test('sans niveau suffisant (enabled faux), rien n\'est lu ni écrit', async () => {
  const { make, log } = fakeGrist({ sections: [section(4)], own: 4 });
  assert.equal(await make({ enabled: () => false }).write([['a', 1]]), false);
  assert.equal(log.applied.length, 0);
});

test('aucune candidate : faux, rien n\'est écrit (le courtier pose le brouillon)', async t => {
  quiet(t);
  const { make, log } = fakeGrist({ sections: [section(4, { address: 'https://autre.example/w/index.html' })], own: 4 });
  assert.equal(await make().write([['a', 1]]), false);
  assert.equal(log.applied.length, 0);
});

test('Grist refuse l\'écriture (pas le droit de modifier la structure) : faux, sans erreur, et le refus est dit une fois', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { make } = fakeGrist({ sections: [section(4)], own: 4, reject: true });
  const view = make();
  assert.equal(await view.write([['a', 1]]), false);
  assert.equal(await view.write([['a', 2]]), false);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /Grist a refusé l'écriture/);
});

test('l\'écho ne revient pas (la section écrite n\'est pas la nôtre) : l\'écriture est défaite, faux', async t => {
  quiet(t);
  // La seule candidate est la 4, mais Grist montre à GFS la section 5 (une adresse écrite autrement : elle n'est pas candidate).
  const { make, document } = fakeGrist({ sections: [section(4), section(5, { address: 'https://gfs.example/ailleurs/index.html' })], own: 5 });
  const before = document.sections[0].options;
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false);
  assert.equal(document.sections[0].options, before, 'la section 4 est rendue comme elle était');
});

test('l\'écho qui n\'est pas revenu désigne une section qui n\'est pas la nôtre : GFS n\'y réécrit plus', async t => {
  quiet(t);
  const { make, log } = fakeGrist({ sections: [section(4), section(5, { address: 'https://gfs.example/ailleurs/index.html' })], own: 5 });
  const view = make();
  assert.equal(await view.write([['modeleDeLaVue', '16']]), false);
  assert.equal(log.applied.length, 2, 'l\'écriture, puis son retrait');
  assert.equal(await view.write([['modeleDeLaVue', '17']]), false);
  assert.equal(log.applied.length, 2, 'la section 4 n\'est plus candidate : plus rien n\'est écrit');
});

test('un brouillon déjà posé (« Enregistrer » est là) : rien n\'est écrit dans la vue, le réglage rejoint le brouillon', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { make, log } = fakeGrist({ sections: [section(4, { widgetOptions: { modeleDeLaVue: '2' } })], own: 4, draft: { modeleDeLaVue: '2', droitsAcces: 'brouillon' } });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false);
  assert.equal(log.applied.length, 0, 'aucune écriture, donc rien à défaire et aucune attente');
  assert.match(warn.mock.calls[0].arguments[0], /brouillon est déjà posé/);
});

test('plusieurs sections et un brouillon posé : ni recherche ni marque, le réglage rejoint le brouillon', async t => {
  quiet(t);
  const { make, log } = fakeGrist({ sections: [section(4), section(5)], own: 5, draft: { droitsAcces: 'brouillon' } });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false);
  assert.equal(log.applied.length, 0, 'aucune marque posée dans le document');
});

test('plusieurs sections de GFS, une seule dit ce que Grist dit à GFS : c\'est elle, sans recherche', async () => {
  const { make, document, log } = fakeGrist({ sections: [section(4, { widgetOptions: { modeleDeLaVue: '2' } }), section(5, { widgetOptions: { droitsAcces: 'x' } })], own: 5 });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), true);
  assert.equal(log.applied.length, 1, 'une seule écriture, aucune marque');
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { modeleDeLaVue: '2' });
  assert.deepEqual(widgetOptionsOf(document.sections[1].options), { droitsAcces: 'x', modeleDeLaVue: '16' });
});

test('la marque d\'une autre recherche en cours n\'est pas prise pour un brouillon', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { make } = fakeGrist({ sections: [section(4)], own: 4, draft: { [PROBE_KEY]: 'etrangere' } });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false); // l'écho ne vient jamais dans ce faux : ce qui compte est la raison
  assert.doesNotMatch(warn.mock.calls[0].arguments[0], /brouillon est déjà posé/);
});

test('l\'écriture défaite n\'écrase pas ce que quelqu\'un d\'autre a écrit entre-temps', async t => {
  quiet(t);
  let first = true;
  const afterApply = (document) => {
    if (!first) return;
    first = false;
    document.sections[0].options = optionsText({ widgetOptions: { autre: 'geste de quelqu\'un d\'autre' } });
  };
  const { make, document } = fakeGrist({ sections: [section(4), section(5, { address: 'https://gfs.example/ailleurs/index.html' })], own: 5, afterApply });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false);
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { autre: 'geste de quelqu\'un d\'autre' });
});

test('deux GFS sur la même table : la recherche trouve la section de GFS, retire les marques, et ne se refait pas', async () => {
  // Les deux vues disent la même chose : seule la recherche par marques les distingue.
  const { make, document, log } = fakeGrist({ sections: [section(4, { widgetOptions: { 'gfs.x': 1 } }), section(5, { widgetOptions: { 'gfs.x': 1 } })], own: 5 });
  const view = make();
  assert.equal(await view.write([['modeleDeLaVue', '16']]), true);
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { 'gfs.x': 1 }, 'l\'autre vue n\'a pas bougé');
  assert.deepEqual(widgetOptionsOf(document.sections[1].options), { 'gfs.x': 1, modeleDeLaVue: '16' });
  for (const row of document.sections) assert.equal(PROBE_KEY in (widgetOptionsOf(row.options) || {}), false, 'aucune marque ne reste');
  const first = log.applied.length;
  assert.equal(first, 3, 'marques, retrait des marques, écriture');
  assert.equal(await view.write([['modeleDeLaVue', '17']]), true);
  assert.equal(log.applied.length, first + 1, 'la section reconnue est gardée : une seule écriture');
});

test('une marque d\'une autre recherche en cours n\'est dans aucune de nos listes : GFS recommence et ne se trompe jamais', async () => {
  let overwritten = false;
  // Juste après nos marques, une autre recherche (un second GFS qui démarre) pose les siennes sur les mêmes sections : la première lecture de GFS voit un nom inconnu.
  const afterApply = (document, log) => {
    if (overwritten || log.applied.length !== 1) return;
    overwritten = true;
    document.sections.forEach(row => { row.options = withChanges(row.options, [[PROBE_KEY, `etrangere-${row.id}`]]); });
  };
  const { make, document } = fakeGrist({ sections: [section(4), section(5)], own: 5, afterApply });
  assert.equal(await make().write([['modeleDeLaVue', '16']]), true);
  assert.equal(widgetOptionsOf(document.sections[1].options).modeleDeLaVue, '16');
  assert.equal(widgetOptionsOf(document.sections[0].options), null, 'l\'autre vue ne reçoit rien');
  for (const row of document.sections) assert.equal(PROBE_KEY in (widgetOptionsOf(row.options) || {}), false);
});

test('la recherche ne trouve pas sa section : rien n\'est écrit, les marques sont retirées, faux', async t => {
  quiet(t);
  // GFS voit la section 9 : elle n'est pas parmi les candidates (une autre adresse), aucune marque ne lui revient.
  const { make, document } = fakeGrist({ sections: [section(4), section(5), section(9, { address: 'https://gfs.example/ailleurs/index.html' })], own: 9 });
  const before = document.sections.map(row => row.options);
  assert.equal(await make().write([['modeleDeLaVue', '16']]), false);
  assert.deepEqual(document.sections.map(row => row.options), before);
});

test('une recherche sans aucune marque ne se refait pas à chaque écriture', async t => {
  quiet(t);
  const { make, log } = fakeGrist({ sections: [section(4), section(5), section(9, { address: 'https://gfs.example/ailleurs/index.html' })], own: 9 });
  const view = make();
  assert.equal(await view.write([['a', 1]]), false);
  const first = log.applied.length;
  assert.equal(first, 2, 'marques, puis retrait : une seule recherche');
  assert.equal(await view.write([['a', 2]]), false);
  assert.equal(log.applied.length, first, 'pas de seconde recherche');
});

test('les écritures d\'une même session s\'enchaînent : la seconde part de ce que la première a laissé', async () => {
  const { make, document } = fakeGrist({ sections: [section(4)], own: 4 });
  const view = make();
  await Promise.all([view.write([['a', 1]]), view.write([['b', 2]]), view.write([['a', undefined]])]);
  assert.deepEqual(widgetOptionsOf(document.sections[0].options), { b: 2 });
});

// L'annonce d'ouverture (`expect`) : GFS lit sa section et dit d'avance si les réglages iront dans la vue, sans jamais rien écrire.
test('expect : une seule section dit ce que Grist dit à GFS, vrai, et rien n\'est écrit', async () => {
  const { make, log } = fakeGrist({ sections: [section(4, { widgetOptions: { modeleDeLaVue: '2' } }), section(9, {}, 2)], own: 4 });
  assert.equal(await make().expect(), true);
  assert.equal(log.applied.length, 0);
});

test('expect : sans l\'accès complet, faux, rien n\'est lu, et la raison est dite une fois en console', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { make, log } = fakeGrist({ sections: [section(4)], own: 4 });
  const view = make({ enabled: () => false });
  assert.equal(await view.expect(), false);
  assert.equal(await view.expect(), false);
  assert.equal(log.applied.length, 0);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /pas l'accès complet/);
});

test('expect : aucune section reconnue, ou un brouillon déjà posé, faux avec la raison en console, rien n\'est écrit', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const none = fakeGrist({ sections: [section(4, { address: 'https://autre.example/w/index.html' })], own: 4 });
  assert.equal(await none.make().expect(), false);
  assert.match(warn.mock.calls[0].arguments[0], /ne reconnaît pas sa section/);
  const draft = fakeGrist({ sections: [section(4)], own: 4, draft: { droitsAcces: 'brouillon' } });
  assert.equal(await draft.make().expect(), false);
  assert.match(warn.mock.calls[1].arguments[0], /brouillon est déjà posé/);
  assert.equal(none.log.applied.length + draft.log.applied.length, 0);
});

test('expect : plusieurs sections pareilles, GFS ne sait pas (une marque s\'écrirait) ; une fois sa section reconnue par une écriture, vrai', async () => {
  const { make, log } = fakeGrist({ sections: [section(4), section(5)], own: 5 });
  const view = make();
  assert.equal(await view.expect(), null);
  assert.equal(log.applied.length, 0, 'aucune marque posée pour une annonce');
  assert.equal(await view.write([['modeleDeLaVue', '16']]), true); // la recherche par marques reconnaît la section
  assert.equal(await view.expect(), true);
});

test('expect : une lecture qui échoue ne lève jamais d\'erreur, GFS ne dit rien', async () => {
  const { make } = fakeGrist({ sections: [section(4)], own: 4 });
  const view = make({ doc: { fetchTable: async () => { throw new Error('hors ligne'); }, applyUserActions: async () => assert.fail('rien ne s\'écrit') } });
  assert.equal(await view.expect(), null);
});
