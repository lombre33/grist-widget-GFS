// La vérité du banc de comparaison des CDN (choix du porteur, 25/11) : ce que le registre npm a publié, fichier par fichier. `npm pack` télécharge l'archive que le registre signe, on la
// défait et on prend l'empreinte (sha384) de chaque fichier. Un CDN qui sert « le même fichier » doit rendre exactement cette empreinte ; celui qui rend autre chose (une variante minifiée,
// un fichier reconstruit) est dit « variante », jamais « identique ».

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_FILE = 12_000_000;
const sha384 = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
const run = (command, args, cwd) => new Promise((resolve, reject) => execFile(command, args, { cwd, maxBuffer: 1 << 24 }, (error, stdout) => (error ? reject(error) : resolve(stdout))));

function walk(dir, base = dir, found = {}) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, base, found);
    else if (info.size <= MAX_FILE) found[path.slice(base.length + 1).split('\\').join('/')] = { sha384: sha384(readFileSync(path)), octets: info.size };
  }
  return found;
}

// Les fichiers d'un paquet publié : { 'dist/jszip.min.js': { sha384, octets } }. Les fichiers de plus de 12 Mo sont laissés.
export async function packageFiles(paquet, version, exec = run) {
  const dir = mkdtempSync(join(tmpdir(), 'banc-npm-'));
  try {
    const archive = (await exec('npm', ['pack', `${paquet}@${version}`, '--silent', '--pack-destination', dir], dir)).trim().split('\n').at(-1);
    await exec('tar', ['-xzf', join(dir, archive), '-C', dir], dir);
    return walk(join(dir, 'package'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Le fichier du paquet que l'adresse sert : d'abord celui que la même adresse npm désigne (jsDelivr et unpkg servent le chemin du paquet), sinon celui dont l'empreinte est celle que le CDN
// servait au dernier contrôle. Rend { chemin, sha384, octets, via: 'chemin' | 'empreinte' | null, identique } : `identique` est faux quand l'adresse désigne un fichier du paquet mais que le CDN
// en servait autre chose ; `chemin` est null quand aucun fichier du paquet ne correspond (une variante : cdnjs sert parfois un fichier minifié sous un autre nom).
export function referenceFor(files, address) {
  const byPath = (['jsdelivr', 'unpkg'].includes(address.hote) && files[address.chemin]) ? address.chemin : null;
  const byHash = Object.keys(files).find(path => address.sha384 && files[path].sha384 === address.sha384) || null;
  const path = byPath || byHash;
  if (!path) return { chemin: null, sha384: null, octets: null, via: null, identique: false };
  return { chemin: path, sha384: files[path].sha384, octets: files[path].octets, via: byPath ? 'chemin' : 'empreinte', identique: !address.sha384 || files[path].sha384 === address.sha384 };
}
