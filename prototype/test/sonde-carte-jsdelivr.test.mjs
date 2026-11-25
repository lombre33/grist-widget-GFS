// La sonde de la carte d'importation chez jsDelivr (outils/sonde-carte-jsdelivr.mjs, choix du porteur du 25/11) : les racines d'une app, les versions que la page chargerait paquet par
// paquet, et le verdict (une seule version conforme à la liste, un écart, un doublon). Aucun réseau : jsDelivr est injoignable du cloud ; la vraie lecture se fait depuis GitHub Actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { roots, versionsOf, verdicts, probe, summarize } from '../outils/sonde-carte-jsdelivr.mjs';

const app = {
  dependencies: { 'prosemirror-model': '1.25.11', orderedmap: '2.1.1', '@tiptap/core': '3.31.3', '@tiptap/pm': '3.31.3' },
  gfs: { carte: { origine: 'https://esm.sh', paquets: ['prosemirror-model', '@tiptap/core'], uniques: ['prosemirror-model'], sousChemins: { '@tiptap/pm': { model: 'prosemirror-model' } } } },
};

const base = 'https://cdn.jsdelivr.net/npm';
function fakeJsdelivr(files) {
  return async url => {
    const text = files[url];
    const body = Buffer.from(text === undefined ? '' : text);
    return { url, statut: text === undefined ? 404 : 200, octets: body.length, sha384: `sha384-${createHash('sha384').update(body).digest('base64')}`, corps: body,
      entetes: { 'content-type': 'application/javascript; charset=utf-8' }, ms: { total: 5 } };
  };
}

test('roots : un `+esm` par nom de la carte, un par sous-chemin que les paquets importent, à la version exacte de la liste', () => {
  assert.deepEqual(roots(app).map(root => root.adresse), [`${base}/prosemirror-model@1.25.11/+esm`, `${base}/@tiptap/core@3.31.3/+esm`, `${base}/@tiptap/pm@3.31.3/model/+esm`]);
  assert.deepEqual(roots({ dependencies: {} }), []);
});

test('versionsOf : les versions par paquet, scopes compris ; un autre hôte ne compte pas', () => {
  const found = versionsOf([`${base}/a@1.0.0/+esm`, `${base}/a@1.0.1/+esm`, `${base}/@s/b@2.0.0/x/+esm`, 'https://esm.sh/c@1.0.0/x.mjs', 'https://unpkg.com/d@1.0.0/d.js']);
  assert.deepEqual([...found].map(([name, set]) => [name, [...set]]), [['a', ['1.0.0', '1.0.1']], ['@s/b', ['2.0.0']]]);
});

test('verdicts : ok, écart avec la liste, doublon, hors liste', () => {
  const found = new Map([['a', new Set(['1.0.0'])], ['b', new Set(['2.0.0'])], ['c', new Set(['1.0.0', '1.1.0'])], ['d', new Set(['3.0.0'])]]);
  assert.deepEqual(verdicts(found, { a: '1.0.0', b: '2.1.0', c: '1.0.0' }).map(item => [item.paquet, item.verdict]), [['a', 'ok'], ['b', 'ecart'], ['c', 'doublon'], ['d', 'hors-liste']]);
});

test('probe : suit les imports absolus de chaque racine, trouve la deuxième copie de ProseMirror et le dit', async () => {
  const files = {
    [`${base}/prosemirror-model@1.25.11/+esm`]: `import"/npm/orderedmap@2.1.1/+esm";export const model=1;`,
    [`${base}/orderedmap@2.1.1/+esm`]: 'export const o=1;',
    [`${base}/@tiptap/core@3.31.3/+esm`]: `import"/npm/prosemirror-model@1.25.4/+esm";import"/npm/@tiptap/pm@3.31.3/model/+esm";export const c=1;`,
    [`${base}/prosemirror-model@1.25.4/+esm`]: 'export const model=2;',
    [`${base}/@tiptap/pm@3.31.3/model/+esm`]: `export*from"/npm/prosemirror-model@1.25.11/+esm";`,
  };
  const result = await probe(app, fakeJsdelivr(files));
  assert.deepEqual(result.racines.map(root => [root.nom, root.statut, root.fichiers]), [['prosemirror-model', 200, 2], ['@tiptap/core', 200, 5], ['@tiptap/pm/model', 200, 3]]);
  assert.deepEqual(result.doublons.map(item => [item.paquet, item.versions]), [['prosemirror-model', ['1.25.11', '1.25.4']]]);
  assert.deepEqual(result.paquets.filter(item => item.verdict === 'ok').map(item => item.paquet), ['@tiptap/core', '@tiptap/pm', 'orderedmap']);
  assert.equal(result.fichiers, 5);
  const text = summarize(result);
  assert.match(text, /Doublons \(plusieurs versions\) : prosemirror-model 1\.25\.11 \+ 1\.25\.4 \(liste : 1\.25\.11\)/);
  assert.match(text, /Racines sans réponse 200 : aucune/);
});

test('probe : une racine absente (404) est dite, sans casser la sonde', async () => {
  const result = await probe(app, fakeJsdelivr({ [`${base}/prosemirror-model@1.25.11/+esm`]: 'export const a=1;' }));
  assert.deepEqual(result.racines.map(root => [root.nom, root.statut]), [['prosemirror-model', 200], ['@tiptap/core', 404], ['@tiptap/pm/model', 404]]);
  assert.match(summarize(result), /Racines sans réponse 200 : @tiptap\/core \(404\), @tiptap\/pm\/model \(404\)/);
});
