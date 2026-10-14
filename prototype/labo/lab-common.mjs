import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
export const { chromium } = require('/opt/node22/lib/node_modules/playwright');
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
  [/plotly-basic\.min\.js/, 'plotly-basic.min.js'], [/marked\.min\.js/, 'marked.min.js'], [/pdfmake\.min\.js/, 'pdfmake.min.js'],
  [/vfs_fonts\.min\.js/, 'vfs_fonts.min.js'], [/jszip\.min\.js/, 'jszip.min.js'], [/pdf-lib\.min\.js/, 'pdf-lib.min.js'],
  [/exceljs\.min\.js/, 'exceljs.min.js'], [/docx.*index\.iife\.js/, 'docx.iife.js'], [/qrcode\.min\.js/, 'qrcode.min.js'],
];
export function mirrored(url) {
  const u = new URL(url);
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
const PROBE_FOLDERS = { a: 'a-self', b: 'b-host', c: 'c-hash', d: 'd-texte', e: 'e-blob', f: 'f-texte-ferme', g: 'g-capacites', h: 'h-courtier' };
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
  // Des fichiers de GFS remplacés pour UN essai (le labo seul, le fichier publié n'est pas touché) : `{ fichier: 'filter.js', de: texte, vers: texte }`. Sert à
  // affaiblir une défense pour mesurer celle qui la suit (le contrôle de l'identifiant réel que Grist rend, après un jugement volontairement trop large).
  for (const patch of patches) {
    await page.route(new RegExp(`/prototype/js/${patch.fichier.replace('.', '\\.')}(\\?|$)`), async route => {
      const response = await route.fetch();
      const text = await response.text();
      if (!text.includes(patch.de)) throw new Error(`Le labo ne retrouve pas « ${patch.de.slice(0, 40)} » dans ${patch.fichier}`);
      await route.fulfill({ response, body: text.replace(patch.de, patch.vers) });
    });
  }
  page.on('pageerror', e => { if (process.env.LAB_CONSOLE) say('[pageerror]', e.message.slice(0, 200)); });
  page.on('console', m => { if (process.env.LAB_CONSOLE && (m.type() === 'error' || process.env.LAB_CONSOLE === 'all')) say('[console.' + m.type() + ']', m.text().slice(0, 240)); });
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
  // (labo/sondes/), où l'empreinte est une mesure (le miroir de Plotly rend les octets du paquet : même empreinte que le CDN et que la copie de GFS).
  await page.addInitScript(() => {
    try {
      if (location.pathname.includes('/labo/sondes/')) return;
      Object.defineProperty(HTMLScriptElement.prototype, 'integrity', { configurable: true, get: () => '', set: () => {} });
    } catch (e) { /* déjà posé */ }
  });
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
