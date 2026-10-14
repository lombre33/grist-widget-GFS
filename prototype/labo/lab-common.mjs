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

export async function newLabPage(browser, { lang = 'fr', colorScheme = 'light', width = 1280, height = 800 } = {}) {
  // L'interface de Grist reste en anglais (les gestes du labo cherchent ses libellés) ; la langue de GFS passe par l'adresse du widget (lab-setup.mjs).
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, bypassCSP: true, locale: 'en-US' });
  const page = await context.newPage();
  page.on('pageerror', e => { if (process.env.LAB_CONSOLE) say('[pageerror]', e.message.slice(0, 200)); });
  page.on('console', m => { if (process.env.LAB_CONSOLE && (m.type() === 'error' || process.env.LAB_CONSOLE === 'all')) say('[console.' + m.type() + ']', m.text().slice(0, 240)); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async route => {
    const url = route.request().url();
    try {
      if (/docs\.getgrist\.com\/grist-plugin-api\.js/.test(url)) {
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: await readFile(join(LAB, 'node_modules/grist-static/dist/grist-plugin-api.js'), 'utf8') });
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
  await page.addInitScript(() => {
    try { Object.defineProperty(HTMLScriptElement.prototype, 'integrity', { configurable: true, get: () => '', set: () => {} }); } catch (e) { /* déjà posé */ }
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
