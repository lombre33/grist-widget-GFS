// La tranche de réglages d'une app (contrats 7.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceOf, optionOf, checkKey, planSetOptions, planClear, contentChanged, optionsFor, gfsPart } from '../js/options-slice.js';

const keys = new Set(['modeleDeLaVue', 'droitsAcces']);
const all = { modeleDeLaVue: 4, droitsAcces: { a: 1 }, 'gfs.apps': { x: {} }, autre: 1 };

test('contrats 7.2 point 1 : getOptions rend les clés déclarées présentes, ou null', () => {
  assert.deepEqual(sliceOf(all, keys), { modeleDeLaVue: 4, droitsAcces: { a: 1 } });
  assert.equal(sliceOf({ autre: 1, 'gfs.apps': {} }, keys), null);
  assert.equal(sliceOf(null, keys), null);
  assert.equal(sliceOf([1], keys), null);
  assert.equal(optionOf(all, keys, 'modeleDeLaVue'), 4);
  assert.equal(optionOf(all, keys, 'autre'), undefined);
  assert.equal(optionOf(all, keys, 'gfs.apps'), undefined);
});

test('contrats 7.2 point 2 : une clé non déclarée est refusée par GFS_CLE_NON_DECLAREE', () => {
  assert.doesNotThrow(() => checkKey(keys, 'modeleDeLaVue'));
  assert.throws(() => checkKey(keys, 'autre'), { code: 'GFS_CLE_NON_DECLAREE' });
  assert.throws(() => checkKey(keys, 'gfs.apps'), { code: 'GFS_CLE_NON_DECLAREE' });
  assert.throws(() => checkKey(keys, undefined), { code: 'GFS_CLE_NON_DECLAREE' });
});

test('contrats 7.2 point 3 : setOptions écrit les clés déclarées, retire les déclarées absentes, ignore les autres', () => {
  const plan = planSetOptions(keys, all, { modeleDeLaVue: 9, autre: 5, 'gfs.apps': {} });
  assert.deepEqual(plan.writes, [['modeleDeLaVue', 9]]);
  assert.deepEqual(plan.removes, ['droitsAcces']);
  assert.deepEqual(plan.ignored.sort(), ['autre', 'gfs.apps']);
  assert.deepEqual(planSetOptions(keys, { autre: 1 }, {}).removes, []);
  assert.throws(() => planSetOptions(keys, all, null), { code: 'GFS_REFUSE' });
  assert.throws(() => planSetOptions(keys, all, [1]), { code: 'GFS_REFUSE' });
});

test('contrats 7.2 point 4 : clearOptions retire les clés déclarées, rien d\'autre', () => {
  assert.deepEqual(planClear(keys, all).sort(), ['droitsAcces', 'modeleDeLaVue']);
  assert.deepEqual(planClear(keys, { autre: 1 }), []);
  assert.deepEqual(planClear(keys, null), []);
});

test('contrats 4.2 point 3 : un événement dont le contenu n\'a pas changé n\'est pas transmis', () => {
  assert.equal(contentChanged({ a: { b: 1 } }, { a: { b: 1 } }), false);
  assert.equal(contentChanged(null, null), false);
  assert.equal(contentChanged(null, { a: 1 }), true);
  assert.equal(contentChanged({ a: 1 }, { a: 2 }), true);
  assert.equal(contentChanged({ a: 1 }, { a: 1, b: 2 }), true);
  assert.equal(contentChanged({ a: [1, 2] }, { a: [1, 2] }), false);
  assert.equal(contentChanged({ a: undefined }, { a: undefined }), false);
});

// Ce que Grist envoie à chaque changement de réglages ou de lien (WidgetFrame.ts, ConfigNotifier) : les réglages de la section, et `settings.linking`.
const message = (linking, extra = {}) => ({ options: { modeleDeLaVue: 4, 'gfs.apps': {}, ...extra }, settings: { accessLevel: 'full', linking } });

test('contrats 4.3 : l\'app lit sa tranche et le lien « Select by » de la section', () => {
  const linking = { asTarget: 'Cursor:Same-Table', asSource: false };
  assert.deepEqual(optionsFor(message(linking), keys), { options: { modeleDeLaVue: 4 }, linking });
  assert.deepEqual(optionsFor({ options: null, settings: { accessLevel: 'full' } }, keys), { options: null, linking: undefined }, 'un Grist qui ne dit pas le lien : rien n\'est affirmé');
  assert.deepEqual(optionsFor({ options: null }, keys), { options: null, linking: undefined });
});

test('contrats 4.2 point 3 : le lien « Select by » compte : changé seul, il est transmis', () => {
  const unlinked = { asTarget: null, asSource: false };
  const linked = { asTarget: 'Cursor:Same-Table', asSource: false };
  const before = optionsFor(message(unlinked), keys);
  assert.equal(contentChanged(before, optionsFor(message(linked), keys)), true, 'la personne relie la section pendant que l\'app est ouverte');
  assert.equal(contentChanged(optionsFor(message(linked), keys), optionsFor(message(unlinked), keys)), true, 'elle retire le lien');
  assert.equal(contentChanged(before, optionsFor(message({ ...unlinked }), keys)), false, 'le même lien redit : rien à transmettre');
  assert.equal(contentChanged(before, optionsFor(message(unlinked, { 'gfs.apps': { x: 1 }, autre: 2 }), keys)), false, 'une clé de GFS ou d\'une autre app : rien à transmettre');
  assert.equal(contentChanged(before, optionsFor(message(unlinked, { modeleDeLaVue: 5 }), keys)), true, 'une clé de la tranche de l\'app change : transmis');
});

test('contrats 7.1 point 3 : les clés de GFS commencent par gfs.', () => {
  assert.deepEqual(gfsPart(all), { 'gfs.apps': { x: {} } });
  assert.deepEqual(gfsPart(null), {});
});
