import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalogue } from '../js/libraries.js';
const require = createRequire(import.meta.url);
// Playwright : celui du dossier du labo si on l'y a installé, sinon celui du conteneur du cloud.
const playwright = (() => { try { return require('playwright'); } catch (error) { return require('/opt/node22/lib/node_modules/playwright'); } })();
export const { chromium } = playwright;
// Le navigateur des mesures : Chromium, ou `LAB_BROWSER=firefox` / `webkit` pour refaire une mesure ailleurs (ce que le cloud n'a pas : à faire sur une machine qui les a).
export const engineName = process.env.LAB_BROWSER || 'chromium';
export const engine = playwright[engineName];
export const LAB = dirname(fileURLToPath(import.meta.url));
export const SHOTS = join(LAB, 'shots');
// Sortie des essais : un texte par ligne (l'objet est écrit en JSON).
export const say = (...parts) => process.stdout.write(parts.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n');
// Une vérification : une ligne « OK » ou « ÉCHEC », et le code de sortie du script suit.
export const check = (label, ok, detail = '') => { say(ok ? 'OK    ' : 'ÉCHEC ', label, detail === '' ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail))); if (!ok) process.exitCode = 1; };

// Le miroir local des CDN (build-mirror.sh) : le conteneur du cloud n'atteint pas esm.sh, cdnjs ni jsDelivr. Absent, rien ne change.
const MIRROR = join(LAB, 'mirror');
const ESM_MAP = existsSync(join(MIRROR, 'esm-map.json')) ? JSON.parse(readFileSync(join(MIRROR, 'esm-map.json'), 'utf8')) : {};
const UMD_BY_URL = [
  [/marked\.min\.js/, 'marked.min.js'], [/pdfmake\.min\.js/, 'pdfmake.min.js'],
  [/vfs_fonts\.min\.js/, 'vfs_fonts.min.js'], [/jszip\.min\.js/, 'jszip.min.js'], [/pdf-lib\.min\.js/, 'pdf-lib.min.js'],
  [/exceljs\.min\.js/, 'exceljs.min.js'], [/docx.*index\.iife\.js/, 'docx.iife.js'], [/qrcode\.min\.js/, 'qrcode.min.js'],
];
// Les bibliothèques d'extensions ne sont plus dans la liste d'une app (la bibliothèque du graphique est à GFS, consigne 005) : à l'adresse du CDN que nomme le
// catalogue de GFS (lu comme GFS le lit), le miroir rend la copie de GFS, les mêmes octets que le CDN (même empreinte, vérifiée par l'outil des bibliothèques).
const LIBRARIES = (() => {
  try { return [...readCatalogue(JSON.parse(readFileSync(join(LAB, '..', 'bibliotheques', 'catalogue.json'), 'utf8'))).entries.values()]; } catch (error) { return []; }
})();
// Les adresses de CDN du catalogue de GFS (un fichier assemblé n'a un CDN que si GFS épingle un commit de son dépôt public : contrats 2.6, point 11). À chacune, le miroir
// rend les octets EXACTS de la copie de GFS, ceux que le CDN sert (même empreinte, vérifiée par l'outil des bibliothèques) : le navigateur y contrôle l'empreinte pour de bon.
const EXACT_ADDRESSES = LIBRARIES.filter(entry => entry.cdn).map(entry => entry.cdn.src);
export function exactMirror(url) {
  const u = new URL(url);
  const library = LIBRARIES.find(entry => entry.cdn && entry.cdn.src === u.origin + u.pathname);
  return library ? join(LAB, '..', library.vendorise.chemin) : null;
}
export function mirrored(url) {
  const u = new URL(url);
  const exact = exactMirror(url);
  if (exact) return exact;
  if (u.hostname === 'esm.sh') {
    const base = u.pathname.split('/').pop();
    if (/^chunk-.*\.js$/.test(base)) return join(MIRROR, 'esm', base);
    const spec = u.pathname.replace(/^\/\*?/, '').replace(/@[0-9][^/]*$/, '');
    const local = ESM_MAP[spec];
    return local ? join(MIRROR, 'esm', local.split('/').pop()) : null;
  }
  if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'cdnjs.cloudflare.com') {
    const hit = UMD_BY_URL.find(([re]) => re.test(u.pathname));
    return hit ? join(MIRROR, 'umd', hit[1]) : null;
  }
  return null;
}

// Les sondes du labo (labo/sondes/) : des apps d'essai que GFS ne connaît pas. Elles entrent dans le catalogue SEULEMENT pour la page du labo qui le demande
// (le fichier publié n'est pas modifié, les autres essais ne les voient pas) : la page reçoit un catalogue.js complété, après les apps du catalogue.
const PROBE_FOLDERS = { a: 'a-self', b: 'b-host', c: 'c-hash', d: 'd-texte', e: 'e-blob', f: 'f-texte-ferme', g: 'g-capacites', h: 'h-courtier', i: 'i-lecture', l: 'l-langue', o: 'o-ouvrir', r: 'r-barre', s: 's-stockage', t: 's-stockage' };
export function withProbes(text) {
  const entries = Object.entries(PROBE_FOLDERS).map(([key, folder]) => `  Object.freeze({ id: 'sonde-${key}', dossier: 'labo/sondes/${folder}/', manifeste: 'labo/sondes/sonde-${key}.json' }),`);
  return text.replace('\n]);', `\n${entries.join('\n')}\n]);`);
}

// Les attributs `sandbox` et `allow` du sous-cadre d'une app : ceux de GFS, ou ceux d'un essai (le labo seul, pour mesurer l'effet d'un drapeau en plus ou en moins ;
// le fichier publié n'est pas modifié).
export function withFrameAttributes(text, { sandbox, allow } = {}) {
  let out = text;
  if (sandbox !== undefined) out = out.replace(/export const SANDBOX = '[^']*';/, `export const SANDBOX = '${sandbox}';`);
  if (allow !== undefined) out = out.replace(/setAttribute\('allow', '[^']*'\)/, `setAttribute('allow', '${allow}')`);
  return out;
}

// Les pages modifiées d'un essai : `add(corps)` les écrit dans un dossier que le serveur du labo sert (shots/, hors du dépôt) et rend l'adresse où le navigateur ira les chercher ;
// elles disparaissent avec le navigateur.
function servePages(browser) {
  const dir = join(SHOTS, 'pages-modifiees');
  mkdirSync(dir, { recursive: true });
  const files = [];
  browser.on('disconnected', () => files.forEach(file => rmSync(file, { force: true })));
  return {
    add(body) {
      const name = `${process.pid}-${files.length}.html`;
      files.push(join(dir, name));
      writeFileSync(files.at(-1), body);
      return `http://127.0.0.1:8911/prototype/labo/shots/pages-modifiees/${name}`;
    },
  };
}

// Des fichiers de GFS remplacés pour UN essai (le labo seul, le fichier publié n'est pas touché) : `{ fichier: 'filter.js', de: texte, vers: texte }` pour un module de js/,
// `{ chemin: '/prototype/labo/reel/index.html', de, vers }` pour tout autre fichier du dépôt. Sert à affaiblir une défense pour mesurer celle qui la suit (le contrôle
// de l'identifiant réel que Grist rend, après un jugement volontairement trop large), ou à ouvrir une adresse de test dans la politique d'une page de mesure.
// Une page HTML modifiée n'est pas rendue par `fulfill` : le navigateur la prendrait pour un document d'adresse inconnue et refuserait (accès au réseau local) tous les
// fichiers que son sous-cadre, à origine opaque, demande ensuite à 127.0.0.1. Elle arrive donc par le réseau, que le serveur du labo sert (même origine, sans quoi la politique
// de GFS refuse le sous-cadre), sous l'adresse d'origine (le navigateur ne voit pas le détour).
async function routePatches(browser, page, patches) {
  let pagesServer = null;
  for (const patch of patches) {
    const path = patch.chemin || `/prototype/js/${patch.fichier}`;
    await page.route(new RegExp(`${path.replace(/\./g, '\\.')}(\\?|$)`), async route => {
      const response = await route.fetch();
      const text = await response.text();
      if (!text.includes(patch.de)) throw new Error(`Le labo ne retrouve pas « ${patch.de.slice(0, 40)} » dans ${path}`);
      const body = text.replace(patch.de, patch.vers);
      if (!path.endsWith('.html')) return route.fulfill({ response, body });
      pagesServer = pagesServer || servePages(browser);
      return route.continue({ url: pagesServer.add(body) });
    });
  }
}

export async function newLabPage(browser, { lang = 'fr', colorScheme = 'light', width = 1280, height = 800, probes = false, frameAttributes = null, patches = [] } = {}) {
  // L'interface de Grist reste en anglais (les gestes du labo cherchent ses libellés) ; la langue de GFS passe par l'adresse du widget (lab-setup.mjs).
  // La politique de sécurité du contenu de GFS et des apps est ENFORCÉE (LAB_BYPASS_CSP=1 pour la suspendre : un diagnostic, jamais une mesure).
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, bypassCSP: process.env.LAB_BYPASS_CSP === '1', locale: 'en-US' });
  const page = await context.newPage();
  if (probes) {
    await page.route(/\/prototype\/js\/catalogue\.js(\?|$)/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: withProbes(await response.text()) });
    });
  }
  if (frameAttributes) {
    await page.route(/\/prototype\/js\/frames\.js(\?|$)/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: withFrameAttributes(await response.text(), frameAttributes) });
    });
    // `frameSrc` : la source de `frame-src` dans la politique de sécurité de la page de GFS (les adresses où un sous-cadre peut aller), pour la mesurer.
    if (frameAttributes.frameSrc) {
      await page.route(/\/prototype\/index\.html(\?|$)/, async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace("frame-src 'self';", `frame-src ${frameAttributes.frameSrc};`) });
      });
    }
  }
  await routePatches(browser, page, patches);
  page.on('pageerror', e => { if (process.env.LAB_CONSOLE) say('[pageerror]', e.message.slice(0, 200)); });
  page.on('console', m => { if (process.env.LAB_CONSOLE && (m.type() === 'error' || process.env.LAB_CONSOLE === 'all')) say('[console.' + m.type() + ']', `(${m.location().url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}:${m.location().lineNumber})`, m.text().slice(0, 240)); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async route => {
    const url = route.request().url();
    try {
      if (/docs\.getgrist\.com\/grist-plugin-api\.js/.test(url)) {
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: await readFile(join(LAB, 'node_modules/grist-static/dist/grist-plugin-api.js'), 'utf8') });
      }
      // La galerie de widgets de Grist (gristlabs.github.io) n'est pas joignable d'ici : une galerie vide évite la bannière d'erreur de Grist sur les
      // captures. Cela ne touche en rien le protocole entre Grist et le widget.
      if (/gristlabs\.github\.io\/grist-widget\/manifest\.json/.test(url)) {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]' });
      }
      const exact = exactMirror(url);
      if (exact && existsSync(exact)) {
        // Comme jsDelivr : le type JavaScript et l'en-tête CORS (un module à empreinte, dans un sous-cadre à origine opaque, n'est pas contrôlé sans lui).
        return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: await readFile(exact) });
      }
      const local = mirrored(url);
      if (local && existsSync(local)) {
        // Les morceaux partagés (chunk-*.js) sont importés par adresse relative : servis sous des adresses différentes, le navigateur en chargerait deux
        // copies (deux ProseMirror, qui cassent TipTap). On les rend absolus, vers une seule adresse.
        const text = (await readFile(local, 'utf8')).replace(/(["'])\.\/(chunk-[A-Za-z0-9]+\.js)\1/g, '$1https://esm.sh/__miroir/$2$1');
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: text });
      }
      const resp = await route.fetch({ timeout: 30000 });
      return route.fulfill({ response: resp });
    } catch (e) {
      if (process.env.LAB_ROUTES) say('[route-fail]', url.slice(0, 120), String(e.message).split('\n')[0]);
      return route.abort();
    }
  });
  // Le miroir des CDN ne rend pas toujours les octets exacts du CDN (les paquets esm.sh) : l'attribut `integrity` est neutralisé, sauf dans les sondes
  // (labo/sondes/), où l'empreinte est une mesure (à l'adresse du CDN de Plotly, le miroir rend la copie de GFS : même empreinte que le CDN), sauf pour un
  // script que GFS sert lui-même (`vendor/`, la copie de GFS d'une bibliothèque d'extension) : ses octets sont ceux que le catalogue empreint, le navigateur
  // contrôle donc l'empreinte pour de bon, y compris pour un module dans un sous-cadre à origine opaque, et sauf à une adresse de CDN du catalogue de GFS
  // (`EXACT_ADDRESSES`), dont le miroir rend les octets exacts.
  await page.addInitScript((exact) => {
    try {
      if (location.pathname.includes('/labo/sondes/')) return;
      const real = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'integrity');
      const fromGfs = (script) => {
        const src = script.getAttribute('src');
        try {
          const url = new URL(src, location.href);
          return Boolean(src) && (url.origin === 'http://127.0.0.1:8911' || exact.includes(url.origin + url.pathname));
        } catch (e) { return false; }
      };
      Object.defineProperty(HTMLScriptElement.prototype, 'integrity', {
        configurable: true,
        get() { return fromGfs(this) ? real.get.call(this) : ''; },
        set(value) { if (fromGfs(this)) real.set.call(this, value); },
      });
    } catch (e) { /* déjà posé */ }
  }, EXACT_ADDRESSES);
  await page.addInitScript((l) => { try { if (location.port === '8911') localStorage.setItem('pp_lang', l); } catch (e) { /* stockage indisponible */ } }, lang);
  // Une app dans son sous-cadre n'a pas de stockage (sans allow-same-origin) : elle suit la langue du navigateur. Le labo la donne à ces cadres seulement.
  await page.addInitScript((l) => {
    try {
      if (location.port !== '8911' || !location.pathname.includes('/apps/')) return;
      const languages = l === 'en' ? ['en-GB', 'en'] : ['fr-FR', 'fr'];
      Object.defineProperty(Navigator.prototype, 'languages', { configurable: true, get: () => languages });
      Object.defineProperty(Navigator.prototype, 'language', { configurable: true, get: () => languages[0] });
    } catch (e) { /* déjà posé */ }
  }, lang);
  return { context, page };
}
