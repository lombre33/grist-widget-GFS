// Le fichier assemblé d'une bibliothèque d'extension (contrats 2.6, points 8 à 11 ; outils/assemblage.mjs et outils/bibliotheques.mjs) : la liste, la
// construction avec esbuild sur des paquets d'essai, les gardes (aucun paquet de plus, aucun nom nu de plus ou de moins), les licences, le catalogue.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { readList, readPublication, githubAddress, gitReader, buildAssembledEntry, checkFiles, checkCdn, generate, rewriteCatalogue, verify, archiveName, integrity } from '../outils/bibliotheques.mjs';
import { registrySource, assembleFile, licencesText, registeredProblems, assembledPath, licencesPath } from '../outils/assemblage.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'gfs-assemblage-test-'));
after(() => rmSync(TMP, { recursive: true, force: true }));
let counter = 0;
const fresh = name => { const dir = join(TMP, `${name}-${counter++}`); mkdirSync(dir, { recursive: true }); return dir; };

// Des paquets d'essai, à la forme de ceux de l'écriture en direct : un paquet qui en tire un autre, un paquet à portée (`@fx/lien`) qui importe un
// sous-chemin à renvoyer (`@fx/pm/state` → `pm-state`), et un nom nu (`pm-state`) que l'app garde dans sa carte d'importation.
const FILES = {
  'lib-core': { version: '1.0.0', files: { 'index.js': "import { helper } from 'lib-aux';\nimport { State } from 'pm-state';\nexport const core = () => `${helper()}-${State.name}`;\nexport const coreState = () => State;\n" } },
  'lib-aux': { version: '2.0.0', files: { 'index.js': "export const helper = () => 'aux';\n" } },
  '@fx/lien': { version: '3.0.0', files: { 'index.js': "import { State } from '@fx/pm/state';\nexport const lien = () => State;\n" } },
};
const LIST = () => ({
  dependencies: { 'lib-core': '1.0.0', 'lib-aux': '2.0.0', '@fx/lien': '3.0.0' },
  gfs: { bibliotheques: { 'essai-live': { assemble: {
    version: '1.0.0', paquets: ['lib-core', 'lib-aux', '@fx/lien'], modules: ['lib-core', '@fx/lien'], externes: ['pm-state'], alias: { '@fx/pm/state': 'pm-state' },
  } } } },
});
const withAssemble = change => { const list = LIST(); change(list.gfs.bibliotheques['essai-live'].assemble, list); return list; };

function writePackage(dir, name, { version, files, license = 'MIT', licenseFile = 'LICENSE' }, folder = name) {
  const target = join(dir, ...folder.split('/'));
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name, version, license, type: 'module', main: 'index.js' }));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(target, file), text);
  if (licenseFile) writeFileSync(join(target, licenseFile), `Licence MIT de ${name}\nCopyright (c) essai\n`);
}
// Un dossier de travail comme celui de l'outil : node_modules/<paquet> pour chaque paquet de la liste, et rien d'autre.
function workDir(change = () => {}) {
  const dir = fresh('travail');
  const modules = join(dir, 'node_modules');
  const packages = structuredClone(FILES);
  change(packages);
  for (const [name, spec] of Object.entries(packages)) writePackage(modules, name, spec);
  return dir;
}
const item = () => readList(LIST())[0];

test('readList : un fichier assemblé se lit avec les versions exactes de ses paquets et la version de GFS', () => {
  assert.deepEqual(readList(LIST()), [{
    id: 'essai-live', forme: 'module', version: '1.0.0',
    paquets: [{ paquet: 'lib-core', version: '1.0.0' }, { paquet: 'lib-aux', version: '2.0.0' }, { paquet: '@fx/lien', version: '3.0.0' }],
    modules: ['lib-core', '@fx/lien'], externes: ['pm-state'], alias: { '@fx/pm/state': 'pm-state' },
  }]);
  const mixed = LIST();
  mixed.dependencies['plotly.js-basic-dist-min'] = '2.13.2';
  mixed.gfs.bibliotheques.plotly = { paquet: 'plotly.js-basic-dist-min', fichier: 'plotly-basic.min.js' };
  assert.deepEqual(readList(mixed).map(entry => [entry.id, entry.forme || 'script']), [['essai-live', 'module'], ['plotly', 'script']]);
});

test('readList : un fichier assemblé mal déclaré est refusé, avec la raison', () => {
  const refused = (change, pattern) => assert.throws(() => readList(withAssemble(change)), pattern);
  refused((a, list) => { list.dependencies['lib-aux'] = '^2.0.0'; }, /la version de lib-aux doit être exacte/);
  refused((a, list) => { delete list.dependencies['lib-aux']; }, /la version de lib-aux doit être exacte/);
  refused(a => { a.version = 'latest'; }, /la version du fichier de GFS doit être exacte/);
  refused(a => { a.modules = ['lib-core', 'autre']; }, /le module autre n'est dans aucun des paquets/);
  refused(a => { a.modules = []; }, /modules : liste de noms attendue/);
  refused(a => { a.modules = ['lib-core', 'lib-core']; }, /modules : un nom est écrit deux fois/);
  refused(a => { a.paquets = ['lib-core', 'lib-core']; }, /paquets : un nom est écrit deux fois/);
  refused(a => { a.externes = ['pm-state', 'lib-aux']; }, /lib-aux est à la fois assemblé et laissé à l'app/);
  refused(a => { a.alias = { '@fx/pm/state': 'pm-view' }; }, /pm-view doit être l'un des noms laissés à l'app/);
  refused(a => { a.alias = ['x']; }, /alias : objet attendu/);
  const badId = LIST();
  badId.gfs.bibliotheques.Essai = badId.gfs.bibliotheques['essai-live'];
  delete badId.gfs.bibliotheques['essai-live'];
  assert.throws(() => readList(badId), /identifiant hors format/);
});

test('registrySource : chaque module rangé sous le nom de son paquet, dans GfsPaquets[id], et rien d\'autre sur la fenêtre', () => {
  assert.equal(registrySource(item()), [
    'import * as m0 from "lib-core";',
    'import * as m1 from "@fx/lien";',
    '(globalThis.GfsPaquets ||= {})["essai-live"] = { version: "1.0.0", modules: { "lib-core": m0, "@fx/lien": m1 } };',
    '',
  ].join('\n'));
});

test('assembleFile : un seul module, les paquets dedans, le nom nu de l\'app laissé dehors et le renvoi appliqué ; il marche et partage l\'instance de l\'app', async () => {
  const dir = workDir();
  const { bytes, problems } = await assembleFile(item(), dir, esbuild);
  assert.deepEqual(problems, []);
  const text = bytes.toString('utf8');
  assert.match(text, /from"pm-state"/, 'le nom nu de l\'app reste un import');
  assert.doesNotMatch(text, /@fx\/pm/, 'le renvoi vers le nom de l\'app est appliqué');
  assert.doesNotMatch(text, /from"lib-/, 'les paquets sont dedans, pas importés');
  assert.deepEqual(registeredProblems(item(), bytes), []);
  // Exécuté avec, à côté, la bibliothèque que l'app garde : tout passe par la même instance de `pm-state`.
  const run = fresh('execution');
  writePackage(join(run, 'node_modules'), 'pm-state', { version: '1.0.0', files: { 'index.js': "export const State = { name: 'S' };\n" } });
  writeFileSync(join(run, 'essai-live.mjs'), bytes);
  delete globalThis.GfsPaquets;
  await import(pathToFileURL(join(run, 'essai-live.mjs')).href);
  const registry = globalThis.GfsPaquets['essai-live'];
  delete globalThis.GfsPaquets;
  assert.equal(registry.version, '1.0.0');
  assert.deepEqual(Object.keys(registry.modules), ['lib-core', '@fx/lien']);
  assert.equal(registry.modules['lib-core'].core(), 'aux-S');
  assert.equal(registry.modules['lib-core'].coreState(), registry.modules['@fx/lien'].lien(), 'une seule instance de la bibliothèque de l\'app, partagée');
});

test('assembleFile : la même liste donne les mêmes octets', async () => {
  const first = await assembleFile(item(), workDir(), esbuild);
  const second = await assembleFile(item(), workDir(), esbuild);
  assert.equal(integrity(first.bytes), integrity(second.bytes));
});

test('assembleFile : un paquet de plus dans le fichier, un paquet listé qui n\'y est pas, un autre numéro de version : écarts', async () => {
  const extra = workDir(packages => {
    packages['lib-extra'] = { version: '4.0.0', files: { 'index.js': "export const extra = 1;\n" } };
    packages['lib-aux'].files['index.js'] = "import { extra } from 'lib-extra';\nexport const helper = () => 'aux' + extra;\n";
  });
  assert.match((await assembleFile(item(), extra, esbuild)).problems.join('\n'), /lib-extra est dans le fichier mais pas dans la liste de GFS/);

  const unused = item();
  unused.paquets.push({ paquet: 'lib-inutile', version: '5.0.0' });
  const withUnused = workDir(packages => { packages['lib-inutile'] = { version: '5.0.0', files: { 'index.js': 'export const x = 1;\n' } }; });
  assert.match((await assembleFile(unused, withUnused, esbuild)).problems.join('\n'), /lib-inutile est dans la liste mais le fichier n'en contient rien/);

  const other = workDir(packages => { packages['lib-aux'].version = '9.9.9'; });
  assert.match((await assembleFile(item(), other, esbuild)).problems.join('\n'), /lib-aux : le fichier contient 9\.9\.9, la liste dit 2\.0\.0/);
});

test('assembleFile : un nom nu non déclaré, ou un second ProseMirror tiré par un paquet, ne passe pas', async () => {
  const undeclared = item();
  undeclared.externes = [];
  undeclared.alias = {};
  await assert.rejects(assembleFile(undeclared, workDir(), esbuild), /esbuild n'a pas pu assembler le fichier .*pm-state/);

  const stale = item();
  stale.externes = ['pm-state', 'jamais-importe'];
  assert.match((await assembleFile(stale, workDir(), esbuild)).problems.join('\n'), /jamais-importe : déclaré dans les externes mais jamais importé/);

  const noAlias = item();
  noAlias.alias = {};
  await assert.rejects(assembleFile(noAlias, workDir(), esbuild), /@fx\/pm\/state/);

  // Le piège mesuré (faits vérifiés, 9) : la bibliothèque de l'app n'est pas laissée à l'app, le fichier en apporte sa propre copie.
  const own = item();
  own.externes = [];
  own.alias = { '@fx/pm/state': 'pm-state' };
  const withCopy = workDir(packages => { packages['pm-state'] = { version: '1.0.0', files: { 'index.js': "export const State = { name: 'copie' };\n" } }; });
  const { problems } = await assembleFile(own, withCopy, esbuild);
  assert.match(problems.join('\n'), /pm-state est dans le fichier mais pas dans la liste de GFS/);
});

test('licencesText : le texte de chaque licence est recopié à côté du fichier ; un paquet sans licence est un écart', () => {
  const ok = licencesText(item(), workDir());
  assert.deepEqual(ok.problems, []);
  for (const { paquet, version } of item().paquets) assert.match(ok.text, new RegExp(`${paquet.replace('/', '\\/')}@${version} · MIT`));
  assert.match(ok.text, /Licence MIT de @fx\/lien/);
  const none = licencesText(item(), workDir(packages => { packages['lib-aux'].licenseFile = null; }));
  assert.match(none.problems.join('\n'), /lib-aux : pas de fichier de licence dans le paquet/);
  const undeclared = licencesText(item(), workDir(packages => { packages['lib-aux'].license = ''; }));
  assert.match(undeclared.problems.join('\n'), /lib-aux : licence non déclarée dans le paquet/);
});

test('buildAssembledEntry : forme module, ce que le fichier contient, range et laisse, pas de CDN sans publication, la copie de GFS', () => {
  const bytes = Buffer.from('export const x = 1;');
  const entry = buildAssembledEntry(item(), bytes);
  assert.deepEqual(entry, {
    id: 'essai-live', version: '1.0.0', forme: 'module', poids: bytes.length,
    contient: [{ paquet: 'lib-core', version: '1.0.0' }, { paquet: 'lib-aux', version: '2.0.0' }, { paquet: '@fx/lien', version: '3.0.0' }],
    modules: ['lib-core', '@fx/lien'], externes: ['pm-state'], cdn: null,
    vendorise: { chemin: 'vendor/essai-live/1.0.0/essai-live.js', integrite: integrity(bytes) },
  });
  assert.equal(assembledPath(item()), entry.vendorise.chemin);
  assert.equal(licencesPath(item()), 'vendor/essai-live/1.0.0/LICENCES.txt');
});

// Où jsDelivr sert GFS (`gfs.publication` de la liste) : le dépôt public, un commit complet, le dossier de GFS dans le dépôt.
const COMMIT = 'a'.repeat(40);
const PUBLICATION = { depot: 'essai/gfs', commit: COMMIT, racine: 'prototype/' };
const withPublication = change => { const list = LIST(); list.gfs.publication = { ...PUBLICATION, ...change }; return list; };

test('readPublication : la liste dit où jsDelivr sert GFS ; un commit abrégé ou une branche, un dépôt ou un dossier mal formés sont refusés', () => {
  assert.equal(readPublication(LIST()), null, 'sans publication, un fichier assemblé n\'a pas de CDN');
  assert.deepEqual(readPublication(withPublication({})), PUBLICATION);
  assert.deepEqual(readPublication(withPublication({ racine: '' })), { ...PUBLICATION, racine: '' });
  assert.equal(readPublication(withPublication({ depot: 'lombre33/grist-widget-GFS' })).depot, 'lombre33/grist-widget-GFS');
  for (const commit of ['main', 'v1.0.0', 'a'.repeat(7), 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), '']) {
    assert.throws(() => readPublication(withPublication({ commit })), /un commit complet/, commit);
  }
  for (const depot of ['essai', 'essai/gfs/autre', '/gfs', 'essai/', 'es sai/gfs', undefined]) {
    assert.throws(() => readPublication(withPublication({ depot })), /propriétaire\/dépôt/, String(depot));
  }
  for (const racine of ['prototype', '../x/', '/prototype/', '_cache/', 5, undefined]) {
    assert.throws(() => readPublication(withPublication({ racine })), /barre finale/, String(racine));
  }
  assert.throws(() => readPublication({ gfs: { publication: null } }), /propriétaire\/dépôt/);
});

test('buildAssembledEntry avec la publication de la liste : le CDN est l\'adresse jsDelivr du commit épinglé, de la même empreinte que la copie', () => {
  const bytes = Buffer.from('export const x = 1;');
  const entry = buildAssembledEntry(item(), bytes, PUBLICATION);
  assert.deepEqual(entry.cdn, { src: `https://cdn.jsdelivr.net/gh/essai/gfs@${COMMIT}/prototype/vendor/essai-live/1.0.0/essai-live.js`, integrite: integrity(bytes) });
  assert.equal(entry.cdn.integrite, entry.vendorise.integrite);
  assert.equal(githubAddress(PUBLICATION, 'vendor/x.js'), `https://cdn.jsdelivr.net/gh/essai/gfs@${COMMIT}/prototype/vendor/x.js`);
  assert.equal(githubAddress({ ...PUBLICATION, racine: '' }, 'vendor/x.js'), `https://cdn.jsdelivr.net/gh/essai/gfs@${COMMIT}/vendor/x.js`);
});

test('checkCdn : une entrée sans CDN n\'a rien à comparer', async () => {
  const catalogue = { bibliotheques: [buildAssembledEntry(item(), Buffer.from('x'))] };
  assert.deepEqual(await checkCdn(catalogue, async () => { throw new Error('ne doit pas être appelé'); }), []);
});

test('checkCdn : le CDN sert les mêmes octets, avec l\'en-tête CORS et un type JavaScript ; sans l\'un d\'eux, le navigateur refuserait le module', async () => {
  const bytes = Buffer.from('export const x = 1;');
  const catalogue = { bibliotheques: [buildAssembledEntry(item(), bytes, PUBLICATION)] };
  const answer = (headers = {}, body = bytes) => async url => {
    assert.equal(url, catalogue.bibliotheques[0].cdn.src, 'c\'est l\'adresse du catalogue qui est demandée');
    return { bytes: body, headers: { cors: '*', type: 'application/javascript; charset=utf-8', ...headers } };
  };
  assert.deepEqual(await checkCdn(catalogue, answer()), []);
  assert.deepEqual(await checkCdn(catalogue, answer({ cors: 'null', type: 'text/javascript' })), [], 'une origine opaque (cadre isolé) est celle que « null » nomme');
  assert.match((await checkCdn(catalogue, answer({ cors: null })))[0], /ne donne pas l'en-tête CORS \(access-control-allow-origin : absent\)/);
  assert.match((await checkCdn(catalogue, answer({ cors: 'https://autre.example' })))[0], /ne donne pas l'en-tête CORS \(access-control-allow-origin : https:\/\/autre\.example\)/);
  assert.match((await checkCdn(catalogue, answer({ type: 'text/plain' })))[0], /sert le fichier comme « text\/plain », pas comme du JavaScript/);
  assert.match((await checkCdn(catalogue, answer({ type: null })))[0], /ne dit pas le type du fichier/);
  assert.match((await checkCdn(catalogue, answer({}, Buffer.from('autre'))))[0], /le CDN sert un fichier d'empreinte sha384-/);
  assert.equal((await checkCdn(catalogue, answer({ cors: null, type: 'text/plain' }, Buffer.from('autre')))).length, 3, 'chaque écart est dit');
  assert.deepEqual(await checkCdn(catalogue, async () => bytes), [], 'les octets seuls (sans en-têtes) : seule l\'empreinte se compare');
});

// ----- De la liste aux fichiers commités : tout se fait hors ligne, depuis des archives <paquet>-<version>.tgz, comme `--paquets <dossier>`.
function archives() {
  const out = fresh('archives');
  for (const [name, spec] of Object.entries(FILES)) {
    const src = fresh('source');
    writePackage(src, name, spec, 'package');
    execFileSync('tar', ['-czf', join(out, archiveName(name, spec.version)), '-C', src, 'package']);
  }
  return out;
}
function rootWithList(list = LIST(), root = fresh('racine')) {
  mkdirSync(join(root, 'bibliotheques'), { recursive: true });
  writeFileSync(join(root, 'bibliotheques/package.json'), JSON.stringify(list));
  return root;
}

test('archiveName : le nom que npm pack donne, aussi pour un paquet à portée', () => {
  assert.equal(archiveName('lib-aux', '2.0.0'), 'lib-aux-2.0.0.tgz');
  assert.equal(archiveName('@tiptap/y-tiptap', '3.0.10'), 'tiptap-y-tiptap-3.0.10.tgz');
});

test('generate puis verify : le catalogue, la copie de GFS et les licences sont écrits, cohérents, et refaits à l\'identique', async () => {
  const paquets = archives();
  const root = rootWithList();
  const lines = [];
  await generate(root, paquets, text => lines.push(text));
  assert.match(lines.join(''), /essai-live@1\.0\.0 \(assemblé\) : \d+ octets, sha384-/);
  const { catalogue, problems } = verify(root);
  assert.deepEqual(problems, []);
  assert.equal(catalogue.bibliotheques.length, 1);
  assert.equal(catalogue.bibliotheques[0].forme, 'module');
  assert.equal(catalogue.bibliotheques[0].cdn, null);
  assert.ok(existsSync(join(root, 'vendor/essai-live/1.0.0/essai-live.js')));
  assert.match(readFileSync(join(root, 'vendor/essai-live/1.0.0/LICENCES.txt'), 'utf8'), /lib-core@1\.0\.0 · MIT/);
  const before = readFileSync(join(root, 'vendor/essai-live/1.0.0/essai-live.js'));
  const catalogueBefore = readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8');
  await generate(root, paquets, () => {});
  assert.ok(before.equals(readFileSync(join(root, 'vendor/essai-live/1.0.0/essai-live.js'))), 'refait à l\'identique');
  assert.equal(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'), catalogueBefore);
});

test('generate : un fichier qui n\'est pas ce que la liste dit n\'écrit ni le fichier ni le catalogue', async () => {
  const paquets = archives();
  const list = withAssemble(a => { a.externes = ['pm-state', 'jamais-importe']; });
  const root = rootWithList(list);
  await assert.rejects(generate(root, paquets, () => {}), /le fichier n'est pas ce que la liste dit[\s\S]*jamais-importe/);
  assert.equal(existsSync(join(root, 'bibliotheques/catalogue.json')), false);
  assert.equal(existsSync(join(root, 'vendor/essai-live')), false);
});

test('verify : un fichier abîmé, des licences absentes, un CDN que rien ne justifie, un contenu qui change sont signalés', async () => {
  const paquets = archives();
  const root = rootWithList();
  await generate(root, paquets, () => {});
  const copy = join(root, 'vendor/essai-live/1.0.0/essai-live.js');
  const original = readFileSync(copy);
  writeFileSync(copy, `${original.toString('utf8')}/* abîmé */`);
  assert.match(verify(root).problems.join('\n'), /l'empreinte de vendor\/essai-live\/1\.0\.0\/essai-live\.js ne correspond pas au catalogue/);
  writeFileSync(copy, original);
  rmSync(join(root, 'vendor/essai-live/1.0.0/LICENCES.txt'));
  assert.match(verify(root).problems.join('\n'), /licences illisibles/);
  await generate(root, paquets, () => {});
  const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
  const [entry] = catalogue.bibliotheques;
  const list = readList(JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8')));
  const read = path => readFileSync(join(root, path));
  const problemsWith = change => checkFiles({ bibliotheques: [{ ...entry, ...change }] }, list, read).join('\n');
  assert.match(problemsWith({ cdn: { src: 'https://cdn.jsdelivr.net/npm/x@1.0.0/x.js', integrite: entry.vendorise.integrite } }), /sans gfs\.publication dans la liste, un fichier assemblé n'a pas de CDN/);
  assert.match(problemsWith({ forme: undefined }), /forme « module » attendue/);
  assert.match(problemsWith({ contient: entry.contient.slice(1) }), /« contient » du catalogue n'est pas celui de la liste/);
  assert.match(problemsWith({ modules: ['lib-core'] }), /« modules » du catalogue n'est pas celui de la liste/);
  assert.match(problemsWith({ externes: [] }), /« externes » du catalogue n'est pas celui de la liste/);
  assert.match(problemsWith({ vendorise: { chemin: 'vendor/essai-live/1.0.0/ailleurs.js', integrite: entry.vendorise.integrite } }), /chemin de la copie inattendu/);
  assert.match(registeredProblems(item(), Buffer.from('export const x = 1;')).join('\n'), /ne range rien dans GfsPaquets/);
});

test('checkFiles avec gfs.publication : l\'adresse du CDN est celle du commit épinglé, de la même empreinte, et ce commit porte exactement la copie', async () => {
  const root = rootWithList();
  await generate(root, archives(), () => {});
  const list = readList(JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8')));
  const [base] = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')).bibliotheques;
  const copy = readFileSync(join(root, base.vendorise.chemin));
  const entry = buildAssembledEntry(list[0], copy, PUBLICATION);
  const where = 'prototype/vendor/essai-live/1\\.0\\.0/essai-live\\.js';
  const check = (candidate, readAtCommit = () => copy) => checkFiles({ bibliotheques: [candidate] }, list, path => readFileSync(join(root, path)), { publication: PUBLICATION, readAtCommit }).join('\n');
  assert.equal(check(entry), '');
  assert.match(check({ ...entry, cdn: null }), /la liste épingle le commit aaaaaaa, le catalogue n'a pas d'adresse de CDN : relancer l'outil \(--catalogue\)/);
  assert.match(check({ ...entry, cdn: { ...entry.cdn, src: entry.cdn.src.replace(COMMIT, 'b'.repeat(40)) } }), /l'adresse du CDN n'est pas celle du commit épinglé/);
  assert.match(check({ ...entry, cdn: { ...entry.cdn, src: entry.cdn.src.replace('/gh/essai/gfs@', '/gh/autre/gfs@') } }), /l'adresse du CDN n'est pas celle du commit épinglé/);
  assert.match(check({ ...entry, cdn: { ...entry.cdn, integrite: integrity(Buffer.from('autre')) } }), /le CDN et la copie vendorisée doivent porter la même empreinte/);
  assert.match(check(entry, () => Buffer.from('un autre fichier')), new RegExp(`le commit épinglé aaaaaaa porte un autre ${where} que la copie vendorisée`));
  assert.match(check(entry, () => { throw new Error('absent'); }), new RegExp(`le commit épinglé aaaaaaa ne porte pas ${where}`));
  assert.equal(check(entry, () => null), '', 'un commit absent de ce clone : le contrôle est laissé à --verifier-cdn');
  assert.equal(check(entry, null), '', 'sans lecteur de commit, de même');
});

// ----- Avec un vrai dépôt git : le commit épinglé se lit sans réseau (git cat-file), comme l'outil le fait dans le dépôt de GFS (dossier « prototype/ »).
const git = (dir, ...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=essai', '-c', 'user.email=essai@exemple.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
const COPY = 'prototype/vendor/essai-live/1.0.0/essai-live.js';
const pinList = (root, publication) => {
  const list = JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8'));
  list.gfs.publication = publication;
  writeFileSync(join(root, 'bibliotheques/package.json'), JSON.stringify(list));
};

test('gfs.publication avec git : l\'adresse du CDN s\'écrit après la copie commitée, et se refait à l\'identique depuis les archives', async () => {
  const paquets = archives();
  const depot = fresh('depot');
  const root = rootWithList(LIST(), join(depot, 'prototype'));
  git(depot, 'init', '-q');
  await generate(root, paquets, () => {});
  assert.equal(JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8')).bibliotheques[0].cdn, null, 'sans publication : pas de CDN');
  git(depot, 'add', '-A');
  git(depot, 'commit', '-q', '-m', 'copie');
  const commit = git(depot, 'rev-parse', 'HEAD');
  const read = gitReader(root);
  assert.ok(read(commit, COPY).equals(readFileSync(join(root, 'vendor/essai-live/1.0.0/essai-live.js'))), 'les octets du commit sont ceux de la copie');
  assert.equal(read('0'.repeat(40), COPY), null, 'un commit que ce clone n\'a pas : null, pas une erreur');
  assert.throws(() => read(commit, 'prototype/absent.js'), 'un fichier que le commit n\'a pas : une erreur');

  pinList(root, { depot: 'essai/gfs', commit, racine: 'prototype/' });
  assert.match(verify(root).problems.join('\n'), /la liste épingle le commit .{7}, le catalogue n'a pas d'adresse de CDN : relancer l'outil \(--catalogue\)/);
  const said = [];
  rewriteCatalogue(root, text => said.push(text));
  assert.deepEqual(said, []);
  const { catalogue, problems } = verify(root);
  assert.deepEqual(problems, []);
  const [entry] = catalogue.bibliotheques;
  assert.equal(entry.cdn.src, `https://cdn.jsdelivr.net/gh/essai/gfs@${commit}/${COPY}`);
  assert.equal(entry.cdn.integrite, entry.vendorise.integrite);

  const written = readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8');
  await generate(root, paquets, () => {});
  assert.equal(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'), written, 'l\'outil sans option donne le même catalogue, CDN compris');
  rewriteCatalogue(root, () => {});
  assert.equal(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'), written, '--catalogue aussi');
});

test('gfs.publication avec git : un commit qui ne porte pas la copie, ou que ce clone n\'a pas, n\'écrit aucune adresse et dit quoi faire', async () => {
  const paquets = archives();
  const depot = fresh('depot');
  const root = rootWithList(LIST(), join(depot, 'prototype'));
  git(depot, 'init', '-q');
  writeFileSync(join(depot, 'LISEZ-MOI'), 'avant la copie');
  git(depot, 'add', '-A');
  git(depot, 'commit', '-q', '-m', 'avant');
  const before = git(depot, 'rev-parse', 'HEAD');
  await generate(root, paquets, () => {});
  git(depot, 'add', '-A');
  git(depot, 'commit', '-q', '-m', 'copie');
  const after = git(depot, 'rev-parse', 'HEAD');

  pinList(root, { depot: 'essai/gfs', commit: before, racine: 'prototype/' });
  const said = [];
  rewriteCatalogue(root, text => said.push(text));
  assert.match(said.join(''), /pas d'adresse de CDN pour l'instant, le commit épinglé .{7} ne porte pas ce fichier\. Commiter la copie, mettre son commit dans gfs\.publication\.commit de la liste, puis relancer avec --catalogue/);
  assert.match(verify(root).problems.join('\n'), /la liste épingle le commit .{7}, le catalogue n'a pas d'adresse de CDN/);

  // Une adresse écrite à la main pour ce commit-là : le commit ne porte pas la copie, la vérification le dit.
  const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
  catalogue.bibliotheques[0].cdn = { src: `https://cdn.jsdelivr.net/gh/essai/gfs@${before}/${COPY}`, integrite: catalogue.bibliotheques[0].vendorise.integrite };
  writeFileSync(join(root, 'bibliotheques/catalogue.json'), JSON.stringify(catalogue));
  assert.match(verify(root).problems.join('\n'), new RegExp(`le commit épinglé ${before.slice(0, 7)} ne porte pas ${COPY.replace(/\./g, '\\.')}`));

  // Un commit que ce clone n'a pas (clone partiel) : l'outil ne devine pas, il demande de récupérer le commit.
  pinList(root, { depot: 'essai/gfs', commit: 'f'.repeat(40), racine: 'prototype/' });
  assert.throws(() => rewriteCatalogue(root, () => {}), /le commit épinglé fffffff n'est pas dans ce clone \(git fetch\)/);
  await assert.rejects(generate(root, paquets, () => {}), /n'est pas dans ce clone/);

  // Le bon commit remet tout en ordre.
  pinList(root, { depot: 'essai/gfs', commit: after, racine: 'prototype/' });
  rewriteCatalogue(root, () => {});
  assert.deepEqual(verify(root).problems, []);
});

test('rewriteCatalogue : seule l\'adresse du CDN peut changer ; une copie qui n\'est plus celle du catalogue est une erreur', async () => {
  const depot = fresh('depot');
  const root = rootWithList(LIST(), join(depot, 'prototype'));
  git(depot, 'init', '-q');
  await generate(root, archives(), () => {});
  git(depot, 'add', '-A');
  git(depot, 'commit', '-q', '-m', 'copie');
  pinList(root, { depot: 'essai/gfs', commit: git(depot, 'rev-parse', 'HEAD'), racine: 'prototype/' });
  const copy = join(root, 'vendor/essai-live/1.0.0/essai-live.js');
  const original = readFileSync(copy);
  writeFileSync(copy, `${original.toString('utf8')}/* changé */`);
  assert.throws(() => rewriteCatalogue(root, () => {}), /la copie vendorisée n'est plus celle du catalogue : relancer l'outil sans option/);
  writeFileSync(copy, original);
  const list = JSON.parse(readFileSync(join(root, 'bibliotheques/package.json'), 'utf8'));
  list.gfs.bibliotheques['essai-live'].assemble.version = '1.0.1';
  writeFileSync(join(root, 'bibliotheques/package.json'), JSON.stringify(list));
  assert.throws(() => rewriteCatalogue(root, () => {}), /essai-live@1\.0\.1 : pas de copie vendorisée à vendor\/essai-live\/1\.0\.1\/essai-live\.js : relancer l'outil sans option/, 'une version de plus dans la liste ne se règle pas sans tirer les paquets');
});
