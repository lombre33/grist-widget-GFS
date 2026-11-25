// Le banc de comparaison des CDN (outils/banc-cdn*.mjs, choix du porteur du 25/11) : l'inventaire de ce que GFS et les apps chargent, la vérité de npm, les mesures d'une requête, le parcours des
// modules que esm.sh fabrique, et le banc entier avec un environnement fabriqué (aucun réseau : ces hôtes sont injoignables du cloud ; la vraie lecture est celle de GitHub Actions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseAddress, esmPackage, inventory } from '../outils/banc-cdn-inventaire.mjs';
import { referenceFor } from '../outils/banc-cdn-npm.mjs';
import { parseHeaders, parseTimings, curlGet, publishedOf, publishedMatches, median, slowest, digest } from '../outils/banc-cdn-mesure.mjs';
import { specifiersOf, resolveSpecifier, isUnpinned, crawl, reread } from '../outils/banc-cdn-esm.mjs';
import { bench, cdnjsFile, stateOf, summarize, targetsOf } from '../outils/banc-cdn.mjs';

const sha = text => digest('sha384', Buffer.from(text));
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

test('parseAddress : le paquet, la version et le chemin chez chaque CDN ; cdnjs porte le nom de npm quand il diffère ; une adresse inconnue rend null', () => {
  assert.deepEqual(parseAddress(JSZIP), { famille: 'fichier', hote: 'jsdelivr', paquet: 'jszip', version: '3.10.1', chemin: 'dist/jszip.min.js' });
  assert.deepEqual(parseAddress('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'), { famille: 'fichier', hote: 'unpkg', paquet: 'leaflet', version: '1.9.4', chemin: 'dist/leaflet.js' });
  assert.deepEqual(parseAddress('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
    { famille: 'fichier', hote: 'cdnjs', paquet: 'pdfjs-dist', nomCdnjs: 'pdf.js', version: '3.11.174', chemin: 'pdf.min.js' });
  assert.equal(parseAddress('https://cdn.jsdelivr.net/npm/@scope/pkg@1.0.0/a.js').paquet, '@scope/pkg');
  assert.equal(parseAddress('https://cdn.jsdelivr.net/gh/o/r@abc123/x/y.js').famille, 'depot');
  assert.equal(parseAddress('https://esm.sh/@tiptap/core@3.31.3').famille, 'esm');
  for (const bad of ['https://exemple.fr/x.js', 'pas une adresse', 'https://unpkg.com/leaflet/dist/leaflet.js']) assert.equal(parseAddress(bad), null, bad);
});

test('esmPackage : le paquet et sa version exacte ; un aiguillage sans version n\'en a pas', () => {
  assert.deepEqual(esmPackage('@tiptap/core@3.31.3/es2022/core.mjs'), { paquet: '@tiptap/core', version: '3.31.3' });
  assert.deepEqual(esmPackage('lib0@0.2.119?target=es2022'), { paquet: 'lib0', version: '0.2.119' });
  assert.equal(esmPackage('node/events.mjs'), null);
});

test('inventory : le catalogue et les adresses des apps, regroupés par paquet ; une plage ou « latest » n\'est jamais comparée ; la copie d\'un dépôt est à part', () => {
  const catalogue = { bibliotheques: [{ id: 'jszip', cdn: { src: JSZIP, integrite: 'sha384-A' } }, { id: 'interne', cdn: null },
    { id: 'edition', cdn: { src: 'https://cdn.jsdelivr.net/gh/o/r@abc/x.js', integrite: 'sha384-E' } }] };
  const securite = { apps: { pp: { empreintes: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', sha384: 'sha384-A', octets: 9 },
    { url: 'https://esm.sh/@tiptap/core@3.31.3', sha384: 'x', octets: 1 }, { url: 'https://esm.sh/@tiptap/core@3.31.3/es2022/core.mjs', sha384: 'y', octets: 2 },
    { url: 'https://esm.sh/pkg@latest', sha384: 'z', octets: 3 }, { url: 'https://unpkg.com/leaflet@^1.9.0/dist/leaflet.js', sha384: 'w', octets: 4 }] } } };
  const found = inventory(catalogue, securite);
  assert.deepEqual(found.fichiers.map(file => [file.id, file.adresses.map(address => `${address.hote}:${address.origines.join('+')}`)]), [['jszip@3.10.1', ['jsdelivr:gfs', 'cdnjs:pp']]]);
  assert.deepEqual(found.esm.map(root => [root.racine, root.adresses, root.origines]), [['@tiptap/core@3.31.3', 2, ['pp']]]);
  assert.equal(found.depots.length, 1);
  assert.equal(inventory(null, null).fichiers.length, 0);
});

test('referenceFor : le fichier de npm que l\'adresse sert, par son chemin ou par l\'empreinte servie ; une variante n\'a pas de référence', () => {
  const files = { 'dist/jszip.min.js': { sha384: 'sha384-A', octets: 9 }, 'dist/jszip.js': { sha384: 'sha384-B', octets: 99 } };
  assert.deepEqual(referenceFor(files, { hote: 'jsdelivr', chemin: 'dist/jszip.min.js', sha384: 'sha384-A' }), { chemin: 'dist/jszip.min.js', sha384: 'sha384-A', octets: 9, via: 'chemin', identique: true });
  assert.equal(referenceFor(files, { hote: 'jsdelivr', chemin: 'dist/jszip.min.js', sha384: 'sha384-ZZZ' }).identique, false, 'le CDN servait autre chose que npm à ce chemin');
  assert.deepEqual(referenceFor(files, { hote: 'cdnjs', chemin: 'jszip.min.js', sha384: 'sha384-A' }).chemin, 'dist/jszip.min.js');
  assert.deepEqual(referenceFor(files, { hote: 'cdnjs', chemin: 'qrcode.min.js', sha384: 'sha384-Q' }), { chemin: null, sha384: null, octets: null, via: null, identique: false });
});

test('parseHeaders et parseTimings : la dernière réponse seule, les en-têtes qu\'un RSSI regarde, les chiffres de curl', () => {
  const text = 'HTTP/2 302\r\nlocation: /x\r\n\r\nHTTP/2 200\r\nCache-Control: public, max-age=31536000, immutable\r\nAccess-Control-Allow-Origin: *\r\nSet-Cookie: a=1\r\nX-Autre: non\r\n\r\n';
  assert.deepEqual(parseHeaders(text), { 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*', 'set-cookie': 'a=1' });
  assert.deepEqual(parseTimings('http_version=2\nremote_ip=1.2.3.4\nhttp_code=200\ntime_total=0.1234\nrien=1'), { http_version: '2', remote_ip: '1.2.3.4', http_code: 200, time_total: 0.1234 });
});

test('curlGet : les octets reçus ont leur empreinte, les temps sont en millisecondes, un échec réseau rend le statut 0', async () => {
  const body = Buffer.from('contenu');
  const ok = await curlGet(JSZIP, async () => ({ stdout: 'http_version=2\nremote_ip=9.9.9.9\nhttp_code=200\ntime_starttransfer=0.0456\ntime_total=0.1', headers: 'HTTP/2 200\r\netag: "e"\r\n\r\n', body }));
  assert.deepEqual([ok.statut, ok.octets, ok.http, ok.ip, ok.ms.premierOctet, ok.ms.total, ok.entetes.etag], [200, 7, '2', '9.9.9.9', 46, 100, '"e"']);
  assert.equal(ok.sha384, `sha384-${createHash('sha384').update(body).digest('base64')}`);
  const down = await curlGet(JSZIP, async () => ({ stdout: 'http_code=0', headers: '', body: Buffer.alloc(0) }));
  assert.deepEqual([down.statut, down.octets], [0, 0]);
});

test('publishedOf et publishedMatches : jsDelivr publie un sha256, cdnjs un sri, unpkg une intégrité ; ce qui concorde, ce qui diffère, ce qui n\'est pas publié', () => {
  const bytes = Buffer.from('fichier');
  const hash = algorithm => createHash(algorithm).update(bytes).digest('base64');
  const jsd = publishedOf('jsdelivr', { files: [{ name: '/dist/a.js', hash: hash('sha256') }] }, 'dist/a.js');
  assert.deepEqual([jsd.algo, publishedMatches(jsd, bytes)], ['sha256', true]);
  assert.equal(publishedMatches(publishedOf('cdnjs', { sri: { 'a.js': `sha512-${hash('sha512')}` } }, 'a.js'), bytes), true);
  assert.equal(publishedMatches(publishedOf('unpkg', { integrity: `sha384-${hash('sha384')}` }, null), Buffer.from('autre')), false);
  assert.equal(publishedOf('jsdelivr', { files: [] }, 'dist/a.js'), null);
  assert.equal(publishedMatches(null, bytes), null);
  assert.equal(publishedOf('cdnjs', null, 'a.js'), null);
});

test('median et slowest : sans valeur, rien ; un seul essai rend sa valeur ; vingt essais écartent le pire', () => {
  assert.deepEqual([median([]), slowest([]), median([5]), slowest([5]), median([30, 10, 20]), median([1, 2, 3, 4])], [null, null, 5, 5, 20, 2]);
  assert.equal(slowest(Array.from({ length: 20 }, (_, index) => index + 1)), 19);
});

test('esm : les imports écrits ou minifiés, l\'adresse relue depuis le fichier, la version figée ou non', () => {
  assert.deepEqual(specifiersOf('import{a as b}from"/x/y.mjs";export*from"../z.js";import"./side.js";const q=import("/lazy.mjs");import c,{d} from \'pkg\''), ['/x/y.mjs', '../z.js', './side.js', '/lazy.mjs', 'pkg']);
  assert.equal(resolveSpecifier('/b.mjs', 'https://esm.sh/a@1.0.0/x.mjs'), 'https://esm.sh/b.mjs');
  assert.equal(resolveSpecifier('./b.mjs', 'https://esm.sh/a@1.0.0/x.mjs'), 'https://esm.sh/a@1.0.0/b.mjs');
  assert.equal(resolveSpecifier('data:text/javascript,1', 'https://esm.sh/a.mjs'), null);
  const unpinned = ['https://esm.sh/@floating-ui/core@^1.6.0?target=es2022', 'https://esm.sh/pkg@latest', 'https://cdn.jsdelivr.net/npm/prosemirror-state@^1.4.3/+esm'];
  const pinned = ['https://esm.sh/@tiptap/core@3.31.3/es2022/core.mjs', 'https://esm.sh/node/events.mjs', 'https://esm.sh/*orderedmap@2.1.1', 'https://esm.sh/v135/foo.mjs', 'https://cdn.jsdelivr.net/npm/lib0@0.2.119/+esm'];
  assert.deepEqual([unpinned.map(isUnpinned), pinned.map(isUnpinned)], [[true, true, true], [false, false, false, false, false]]);
});

// Un faux CDN de modules : une racine qui renvoie vers deux fichiers, dont un aiguillage de quelques octets et une dépendance non figée ; `change` rend un octet différent à la relecture.
function fakeModules(change = false) {
  const files = { 'https://esm.sh/root@1.0.0': 'import"/a@1.0.0/a.mjs";import"/b@^2.0.0/b.mjs";export const r=1;', 'https://esm.sh/a@1.0.0/a.mjs': 'export * from "/a@1.0.0/es/a.mjs";',
    'https://esm.sh/a@1.0.0/es/a.mjs': 'export const a=1;'.padEnd(500, ' '), 'https://esm.sh/b@^2.0.0/b.mjs': 'export const b=2;' };
  const reads = new Map();
  return async url => {
    const count = (reads.get(url) || 0) + 1;
    reads.set(url, count);
    const text = files[url];
    if (text === undefined) return { url, statut: 404, octets: 0, sha384: sha(''), corps: Buffer.alloc(0), entetes: {}, ms: { total: 5 } };
    const body = Buffer.from(change && count > 1 && url.endsWith('b.mjs') ? `${text}//autre` : text);
    return { url, statut: 200, octets: body.length, sha384: digest('sha384', body), corps: body, entetes: { 'content-type': 'text/javascript', 'cache-control': 'public, immutable' }, ms: { total: 10 } };
  };
}

test('crawl : le graphe d\'un module (fichiers, aiguillages, dépendances non figées, hôtes) et la relecture qui compare les octets', async () => {
  const graph = await crawl('https://esm.sh/root@1.0.0', fakeModules());
  assert.deepEqual([graph.fichiers, graph.aiguillages, graph.profondeur, graph.nonFiges, graph.hotes, graph.coupe, graph.erreurs],
    [4, 1, 2, ['https://esm.sh/b@^2.0.0/b.mjs'], ['https://esm.sh'], false, 0]);
  assert.deepEqual(await reread(graph, fakeModules()), { relus: 4, differents: [] });
  const stable = fakeModules(true);
  const first = await crawl('https://esm.sh/root@1.0.0', stable);
  assert.deepEqual((await reread(first, stable)).differents, ['https://esm.sh/b@^2.0.0/b.mjs'], 'un fichier dont les octets changent d\'une lecture à l\'autre se dit');
  assert.equal((await crawl('https://esm.sh/root@1.0.0', fakeModules(), { limit: 2 })).coupe, true);
  assert.equal((await crawl('https://esm.sh/absent@1.0.0', fakeModules())).statut, 404);
});

test('cdnjsFile : le même chemin, le même nom, sinon la variante minifiée dite telle ; rien sinon', () => {
  assert.deepEqual(cdnjsFile(['jszip.min.js', 'jszip.js'], 'dist/jszip.min.js'), { fichier: 'jszip.min.js', rapprochement: 'meme-fichier' });
  assert.deepEqual(cdnjsFile(['vfs_fonts.min.js'], 'build/vfs_fonts.js'), { fichier: 'vfs_fonts.min.js', rapprochement: 'variante' });
  assert.equal(cdnjsFile(['autre.js'], 'dist/jszip.min.js'), null);
  assert.equal(cdnjsFile(undefined, 'a.js'), null);
});

test('stateOf : absent, en erreur, sans référence, identique ou différent', () => {
  const reference = { sha384: 'sha384-A' };
  assert.deepEqual([stateOf({ statut: 404 }, reference), stateOf({ statut: 0 }, reference), stateOf({ statut: 200, sha384: 'x' }, null), stateOf({ statut: 200, sha384: 'sha384-A' }, reference),
    stateOf({ statut: 200, sha384: 'sha384-B' }, reference)], ['absent', 'erreur', 'sans-reference', 'identique', 'different']);
});

// Un environnement fabriqué : jszip chez les trois CDN (jsDelivr et unpkg rendent les octets de npm, cdnjs une variante), les chiffres publiés par chaque CDN, deux graphes de modules.
function fakeEnv() {
  const npmBytes = Buffer.from('jszip minifie');
  const variant = Buffer.from('jszip variante');
  const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('base64');
  const bodies = { 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js': npmBytes, 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js': npmBytes,
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js': variant };
  const api = { 'https://data.jsdelivr.com/v1/packages/npm/jszip@3.10.1?structure=flat': { files: [{ name: '/dist/jszip.min.js', hash: hash('sha256', npmBytes) }] },
    'https://api.cdnjs.com/libraries/jszip/3.10.1?fields=files,sri': { files: ['jszip.min.js'], sri: { 'jszip.min.js': `sha512-${hash('sha512', npmBytes)}` } },
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js?meta': { integrity: `sha384-${hash('sha384', npmBytes)}` } };
  const modules = fakeModules();
  const reply = (url, body) => ({ url, statut: 200, octets: body.length, sha384: digest('sha384', body), sha256: digest('sha256', body), http: '2', ip: '1.1.1.1',
    ms: { dns: 1, connexion: 2, tls: 3, premierOctet: url.includes('unpkg') ? 40 : 20, total: 50 }, redirections: 0, entetes: { 'cache-control': 'public, immutable', 'access-control-allow-origin': '*' }, corps: body });
  return { files: async () => ({ 'dist/jszip.min.js': { sha384: digest('sha384', npmBytes), octets: npmBytes.length } }), getJson: async url => api[url] || null,
    curl: async url => (bodies[url] ? reply(url, bodies[url]) : url.startsWith('https://esm.sh/') || url.includes('/+esm') ? { ...(await modules(url.replace('https://cdn.jsdelivr.net/npm/', 'https://esm.sh/').replace('/+esm', ''))), url } : reply(url, Buffer.alloc(0))),
    pause: async () => {}, now: '2026-11-25T12:00:00.000Z', rounds: 2, from: 'essai', dns: { cname: async () => ['a.example'], a: async () => ['1.2.3.4'] } };
}

test('bench : une bibliothèque chez trois CDN, comparée à npm ; le CDN qui rend une variante est « different », les chiffres publiés se vérifient, un fichier est dit absent', async () => {
  const securite = { apps: { pp: { empreintes: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', sha384: digest('sha384', Buffer.from('jszip variante')), octets: 14 }] } } };
  const catalogue = { bibliotheques: [{ id: 'jszip', cdn: { src: JSZIP, integrite: digest('sha384', Buffer.from('jszip minifie')) } }] };
  const env = fakeEnv();
  const report = await bench(env, inventory(catalogue, securite));
  const file = report.fichiers.find(each => each.id === 'jszip@3.10.1/dist/jszip.min.js');
  assert.ok(file, report.fichiers.map(each => each.id).join());
  const byCdn = Object.fromEntries(file.cdn.map(each => [each.cdn, each]));
  assert.deepEqual([byCdn.jsdelivr.etat, byCdn.unpkg.etat, byCdn.cdnjs.etat], ['identique', 'identique', 'different']);
  assert.deepEqual([byCdn.jsdelivr.publie, byCdn.cdnjs.publie, byCdn.unpkg.publie], [{ algo: 'sha256', concorde: true }, { algo: 'sha512', concorde: false }, { algo: 'sha384', concorde: true }]);
  assert.deepEqual([byCdn.jsdelivr.stable, byCdn.jsdelivr.http, byCdn.jsdelivr.premierOctetMs, byCdn.unpkg.premierOctetMs], [true, '2', [20, 20], [40, 40]]);
  assert.deepEqual(report.esm.map(each => [each.racine, each.esm && each.esm.fichiers > 0]).slice(0, 1), [['@tiptap/starter-kit@3.31.3', true]]);
  assert.deepEqual(report.hotes.jsdelivr, { hote: 'cdn.jsdelivr.net', alias: ['a.example'], adresses: ['1.2.3.4'] });
  const resume = summarize(report);
  assert.deepEqual([resume.jsdelivr.identiques, resume.cdnjs.differents, resume.cdnjs.discordent, resume.unpkg.premierOctetMs.mediane, resume.jsdelivr.cors, resume.jsdelivr.http], [1, 1, 1, 40, 1, ['2']]);
});

test('targetsOf : une variante n\'est mesurée que chez le CDN qui la sert ; une bibliothèque absente de cdnjs le dit', async () => {
  const unit = { chemin: null, adresses: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', hote: 'cdnjs' }] };
  assert.deepEqual(await targetsOf(unit, {}), [{ cdn: 'cdnjs', url: unit.adresses[0].url, rapprochement: 'variante-du-cdn' }]);
  const absent = await targetsOf({ paquet: 'rare', version: '1.0.0', chemin: 'dist/rare.js', adresses: [] }, { getJson: async () => null });
  assert.deepEqual(absent.map(target => [target.cdn, Boolean(target.absent)]), [['jsdelivr', false], ['unpkg', false], ['cdnjs', true]]);
});
