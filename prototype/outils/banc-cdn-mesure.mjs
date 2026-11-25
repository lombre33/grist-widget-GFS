// Les mesures du banc de comparaison des CDN (choix du porteur, 25/11) : une requête vue par curl (version du protocole, adresse IP, temps de résolution, de connexion, de premier octet et
// total, en-têtes de la réponse), l'empreinte des octets reçus et les chiffres que les CDN publient eux-mêmes (jsDelivr : sha256 de chaque fichier ; cdnjs : sri ; unpkg : `?meta`).
// Du cloud de développement, ces hôtes sont injoignables : le banc se lance depuis GitHub Actions (.github/workflows/banc-cdn.yml), ou depuis une machine qui les atteint.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const KEYS = ['http_version', 'remote_ip', 'http_code', 'num_redirects', 'size_download', 'time_namelookup', 'time_connect', 'time_appconnect', 'time_starttransfer', 'time_total'];
const WRITE = KEYS.map(key => `${key}=%{${key}}`).join('\\n');
// Les en-têtes que l'on garde : ce qu'un RSSI regarde (cache, partage d'origine, type, transport, qui répond) et ce qui trahit un suivi (cookies).
const HEADERS = ['cache-control', 'etag', 'age', 'content-type', 'content-encoding', 'access-control-allow-origin', 'cross-origin-resource-policy', 'timing-allow-origin',
  'x-content-type-options', 'strict-transport-security', 'content-security-policy', 'server', 'via', 'cf-ray', 'cf-cache-status', 'x-served-by', 'x-cache', 'x-jsd-version',
  'x-jsd-version-type', 'location', 'set-cookie'];

export const digest = (algorithm, bytes) => `${algorithm}-${createHash(algorithm).update(bytes).digest('base64')}`;

// Les en-têtes de la dernière réponse du fichier que curl a écrit avec `-D` (une redirection laisse un bloc par saut) : { nom: valeur }, noms en minuscules.
export function parseHeaders(text) {
  const blocks = String(text).split(/\r?\n\r?\n/).filter(block => /^HTTP\//.test(block.trim()));
  const last = blocks.at(-1) || '';
  const out = {};
  for (const line of last.split(/\r?\n/).slice(1)) {
    const at = line.indexOf(':');
    if (at < 1) continue;
    const name = line.slice(0, at).trim().toLowerCase();
    if (HEADERS.includes(name)) out[name] = out[name] ? `${out[name]}, ${line.slice(at + 1).trim()}` : line.slice(at + 1).trim();
  }
  return out;
}

// Les chiffres que curl écrit avec `-w` : { http_version: '2', time_total: 0.123, … }.
export function parseTimings(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const [key, value] = line.split('=');
    if (KEYS.includes(key)) out[key] = /^[\d.]+$/.test(value) && key !== 'http_version' && key !== 'remote_ip' ? Number(value) : value;
  }
  return out;
}

// Une requête, vue de la machine qui lance le banc : { statut, octets, sha384, sha256, http, ip, ms: { dns, connexion, tls, premierOctet, total }, redirections, entetes, corps }.
// `curlRun(args)` rend { stdout, headers, body } (remplaçable : les essais n'ouvrent aucune connexion).
export async function curlGet(url, curlRun = realCurl) {
  const { stdout, headers, body } = await curlRun(['-sS', '--compressed', '--max-time', '30', '-L', '--max-redirs', '3', '-A', USER_AGENT, '-w', WRITE, url]);
  const t = parseTimings(stdout);
  const ms = value => (typeof value === 'number' ? Math.round(value * 1000) : null);
  return { url, statut: t.http_code ?? 0, octets: body.length, sha384: digest('sha384', body), sha256: digest('sha256', body), http: t.http_version || null, ip: t.remote_ip || null,
    ms: { dns: ms(t.time_namelookup), connexion: ms(t.time_connect), tls: ms(t.time_appconnect), premierOctet: ms(t.time_starttransfer), total: ms(t.time_total) },
    redirections: t.num_redirects ?? 0, entetes: parseHeaders(headers), corps: body };
}

// La vraie requête : curl, des fichiers temporaires pour le corps et les en-têtes, effacés ensuite. Un échec réseau (code de sortie de curl) rend statut 0.
function realCurl(args) {
  const dir = mkdtempSync(join(tmpdir(), 'banc-cdn-'));
  const full = [...args.slice(0, -1), '-D', join(dir, 'h'), '-o', join(dir, 'b'), args.at(-1)];
  return new Promise(resolve => {
    execFile('curl', full, { maxBuffer: 1 << 20 }, (error, stdout) => {
      const read = name => { try { return readFileSync(join(dir, name)); } catch (readError) { return Buffer.alloc(0); } };
      const reply = { stdout: error ? 'http_code=0' : stdout, headers: read('h').toString('utf8'), body: read('b') };
      rmSync(dir, { recursive: true, force: true });
      resolve(reply);
    });
  });
}

// Ce que le CDN publie lui-même d'un fichier : `{ algo: 'sha256', valeur: 'base64…' }`, ou null. `reply` : la réponse JSON de son interface.
export function publishedOf(host, reply, file) {
  if (!reply || typeof reply !== 'object') return null;
  if (host === 'jsdelivr') {
    const found = (Array.isArray(reply.files) ? reply.files : []).find(each => each && each.name === `/${file}`);
    return found && typeof found.hash === 'string' ? { algo: 'sha256', valeur: found.hash } : null;
  }
  if (host === 'cdnjs') {
    const sri = reply.sri && typeof reply.sri === 'object' ? reply.sri[file] : null;
    const parsed = typeof sri === 'string' ? /^(sha\d+)-(.+)$/.exec(sri) : null;
    return parsed ? { algo: parsed[1], valeur: parsed[2] } : null;
  }
  const parsed = typeof reply.integrity === 'string' ? /^(sha\d+)-(.+)$/.exec(reply.integrity) : null;
  return parsed ? { algo: parsed[1], valeur: parsed[2] } : null;
}

// Les octets reçus portent-ils l'empreinte publiée ? true, false, ou null quand rien n'est publié.
export const publishedMatches = (published, bytes) => (published ? createHash(published.algo).update(bytes).digest('base64') === published.valeur : null);

const sorted = values => values.filter(value => typeof value === 'number').sort((a, b) => a - b);
export const median = values => { const list = sorted(values); return list.length ? list[Math.floor((list.length - 1) / 2)] : null; };
// Le plus lent des essais, hors le pire quand il y en a vingt ou plus (un seul essai ne dit rien d'un p95 : il rend le maximum).
export const slowest = values => { const list = sorted(values); return list.length ? list[Math.min(list.length - 1, Math.ceil(list.length * 0.95) - 1)] : null; };
