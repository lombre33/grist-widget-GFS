// Ce que le contrôle de sécurité lit dans une app (cahier 3.2.2) : la page d'entrée (ses balises de politique, ses scripts et feuilles externes, sa carte
// d'importation), les adresses de CDN écrites dans son code, et les deux sections de sécurité de son `GFS-ETAT.md`. Du code sans effet de bord ni réseau ;
// outils/controle-securite.mjs lit les fichiers et lui donne les textes. Le HTML se lit par motifs, sans bibliothèque : une page d'app est la sienne, écrite à
// la main, pas un document quelconque.

import { parsePolicy } from './security-policy.js';

const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const TAG = /<(meta|script|link)\b([^>]*)>/gi;
const IMPORT_MAP = /<script\b[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
export const CDN_HOSTS = Object.freeze(['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'esm.sh', 'cdn.skypack.dev', 'ga.jspm.io']);
const CDN_URL = new RegExp(`https://(?:${CDN_HOSTS.map(host => host.replaceAll('.', '\\.')).join('|')})/[^\\s'"\`)<>\\\\]+`, 'g');

const attributesOf = text => {
  const found = {};
  for (const [, name, double, single] of text.matchAll(ATTRIBUTE)) found[name.toLowerCase()] = double ?? single ?? '';
  return found;
};

const absolute = value => (typeof value === 'string' && /^(https:)?\/\//.test(value) ? value.replace(/^\/\//, 'https://') : null);

const importMapUrls = html => {
  const block = IMPORT_MAP.exec(html);
  if (!block) return [];
  try {
    const map = JSON.parse(block[1]);
    const values = [...Object.values(map.imports || {}), ...Object.values(map.scopes || {}).flatMap(scope => Object.values(scope || {}))];
    return values.map(absolute).filter(Boolean);
  } catch (error) { return []; }
};

// Une page : { politiques: [{ directive: [sources] }], ressources: [{ genre: 'script' | 'feuille' | 'carte', url, empreinte }], enLigne: <scripts en ligne> }.
// Le relais des appels bloqués du kit (kit 0.25.0, js/violations*.js) : un module importé ou un appel écrit dans la page ou le code (cahier 3.2.2, S8).
const RELAY = /violations(?:-start|-pose)?\.js|\bcreateViolations\b|\bViolations\.start\b/;

export function readPage(html) {
  const policies = [];
  const resources = [];
  for (const [, tag, rest] of String(html || '').matchAll(TAG)) {
    const attrs = attributesOf(rest);
    if (tag.toLowerCase() === 'meta' && /content-security-policy/i.test(attrs['http-equiv'] || '')) policies.push(parsePolicy(attrs.content));
    const url = absolute(tag.toLowerCase() === 'script' ? attrs.src : attrs.href);
    if (url && (tag.toLowerCase() === 'script' || /stylesheet|modulepreload|preload/i.test(attrs.rel || ''))) {
      resources.push({ genre: tag.toLowerCase() === 'script' ? 'script' : 'feuille', url, empreinte: Boolean(attrs.integrity) });
    }
  }
  for (const url of importMapUrls(html)) resources.push({ genre: 'carte', url, empreinte: false });
  const inline = [...String(html || '').matchAll(SCRIPT_BLOCK)].filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim() !== '' &&
    !/importmap/.test(attrs)).length;
  return { politiques: policies, ressources: resources, enLigne: inline, relais: RELAY.test(String(html || '')) };
}

// Les adresses de CDN écrites dans le code d'une app (`files` : { chemin: texte }) : celles-là seulement, le reste d'un code est plein d'adresses de
// documentation.
export function scanCode(files) {
  const urls = new Set();
  for (const text of Object.values(files)) for (const [url] of String(text).matchAll(CDN_URL)) urls.add(url.replace(/[.,;:]+$/, ''));
  return [...urls].sort();
}

// Le code de l'app (`files` : { chemin: texte }) démarre-t-il le relais des appels bloqués ?
export const scanRelay = files => Object.values(files).some(text => RELAY.test(String(text)));

const STATES = [[/^non\s+tenue/i, 'non-tenue'], [/^en\s+cours/i, 'en-cours'], [/^tenue/i, 'tenue']];
const SECTION = /^##\s+(.+?)\s*$/;
const normalizeTitle = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

function sectionsOf(markdown) {
  const sections = new Map();
  let current = null;
  for (const line of String(markdown || '').split('\n')) {
    const title = SECTION.exec(line);
    if (title) { current = normalizeTitle(title[1]); sections.set(current, []); } else if (current) sections.get(current).push(line);
  }
  return sections;
}

const bullets = lines => lines.map(line => /^\s*[-*]\s+(.*\S)\s*$/.exec(line)).filter(Boolean).map(match => match[1].split(/\s+·\s+/).map(cell => cell.trim()));

// Le `GFS-ETAT.md` d'une app : { adresses: [hôtes] | null, serveurGrist: <la ligne « serveur Grist de la personne » y est>, securite: { S1: { etat, texte } } |
// null }. Une section absente rend null ; « aucune » rend une liste vide.
export function parseState(markdown) {
  const sections = sectionsOf(markdown);
  const calls = sections.get("adresses que l'app appelle");
  const security = sections.get('securite');
  const lines = calls ? bullets(calls) : [];
  const addresses = calls ? [...new Set(lines.map(cells => /^(?:https?:\/\/)?([^/\s:]+\.[^/\s:]+)/i.exec(cells[0] || '')).filter(Boolean).map(match =>
    match[1].toLowerCase()))] : null;
  const gristServer = lines.some(cells => /^serveur\s+grist/i.test(normalizeTitle(cells[0] || '')));
  let rules = null;
  if (security) {
    rules = {};
    for (const [id, status = '', ...rest] of bullets(security)) {
      const state = STATES.find(([pattern]) => pattern.test(normalizeTitle(status)));
      if (/^S[1-9]$/.test(id) && state) rules[id] = { etat: state[1], texte: [status, ...rest].join(' · ').slice(0, 200) };
    }
  }
  return { adresses: addresses, serveurGrist: gristServer, securite: rules };
}
