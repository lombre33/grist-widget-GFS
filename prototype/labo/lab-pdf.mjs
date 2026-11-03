// Les gestes et les lectures de l'essai des PDF (run-pdf.mjs) : GFS ajouté comme widget à un document d'un VRAI serveur Grist, mis à 700 × 400 (le panneau de référence), l'explorateur manié à
// la vraie souris et au vrai clavier, et ce que le serveur retient (les tables, les lignes, les pièces jointes) lu par l'API REST avec la session de la personne.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SHOTS, withProbes, routePatches } from './lab-common.mjs';
import { createDocument, addWidget, docIdOf } from './lab-serveur.mjs';

export const PAGE_PORT = 8917;
export const GFS = `http://127.0.0.1:${PAGE_PORT}/prototype/index.html`;

// Deux messages de la console qui ne viennent pas d'un défaut de GFS, présents depuis toujours et attendus : le script d'API de Grist pose sa feuille de thème en ligne et la politique de
// GFS (`style-src 'self'`) la refuse, et le premier cadre, ouvert sans accès, ne peut pas lire le nom du document (la personne donne l'accès complet ensuite).
export const KNOWN_MESSAGES = [/grist-plugin-api\.js:\d+ Applying inline style violates/, /GFS : le nom du document est illisible ErrorWithCode: Access not granted/];

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// La personne a ajouté GFS à la page « Clients » avec l'accès complet : le cadre de GFS prêt, sa première fenêtre (le choix des apps) refermée, le panneau à 700 × 400.
// `probes` : les lettres des sondes (labo/sondes/) que cet essai ajoute au catalogue, `patches` : des fichiers de GFS remplacés pour cet essai seulement (lab-common.mjs, routePatches).
export async function openGfs(context, { lang = 'fr', probes = null, patches = [] } = {}) {
  const page = await context.newPage();
  if (probes) {
    await page.route(/\/prototype\/js\/catalogue\.js(\?|$)/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: withProbes(await response.text(), probes) });
    });
  }
  await routePatches(context.browser(), page, patches);
  // Ce que GFS dit dans la console (avertissements et erreurs), et toute violation de politique de sécurité ; les messages de Grist lui-même ne comptent pas.
  const problems = [];
  const mine = message => message.location().url.startsWith(new URL(GFS).origin) || /Content Security Policy|Refused to/.test(message.text());
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && mine(message)) problems.push(`${message.location().url.slice(0, 120)}:${message.location().lineNumber} ${message.text().slice(0, 400)}`); });
  // Une erreur non rattrapée : celle de GFS seulement (sa pile cite son adresse) ; celles de Grist lui-même (sa galerie de widgets, qui cherche GitHub) ne comptent pas.
  page.on('pageerror', error => { if (String(error.stack || '').includes(new URL(GFS).origin)) problems.push(`pageerror : ${String(error.message).slice(0, 400)}`); });
  const path = await createDocument(page);
  await addWidget(page, path, `${GFS}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}&live=0`);
  const find = async () => {
    for (let i = 0; i < 80; i++) {
      const frame = page.frames().find(each => each.url().startsWith(GFS) && /access=full/.test(each.url()));
      if (frame) return frame;
      await page.waitForTimeout(500);
    }
    throw new Error('Le cadre de GFS (accès complet) ne s\'est pas ouvert.');
  };
  const frame = await find();
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  if (await frame.locator('.mod-scrim').count()) { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').waitFor({ state: 'detached' }); }
  const box = await fitPanel(page, frame);
  return { page, frame, docId: docIdOf(path), box, problems, allow: [...KNOWN_MESSAGES], rest: rest(page, docIdOf(path)) };
}

// Le widget partage la page avec une autre section : la largeur ne suit qu'à moitié la fenêtre (gain de 2), la hauteur suit 1 pour 1 (comme lab-setup.mjs).
async function fitPanel(page, frame, width = 700, height = 400) {
  const element = await frame.frameElement();
  for (let i = 0; i < 12; i++) {
    const box = await element.boundingBox();
    const dw = Math.round(width - box.width);
    const dh = Math.round(height - box.height);
    if (Math.abs(dw) <= 1 && Math.abs(dh) <= 1) return box;
    const size = page.viewportSize();
    await page.setViewportSize({ width: size.width + (Math.abs(dw) > 1 ? dw * 2 : 0), height: size.height + dh });
    await page.waitForTimeout(500);
  }
  return element.boundingBox();
}

// Ce que le serveur retient, lu avec la session de la personne (la page de Grist est de l'origine du serveur : aucun jeton ici).
function rest(page, docId) {
  const get = path => page.evaluate(async ([id, suffix]) => (await fetch(`/api/docs/${id}${suffix}`)).json(), [docId, path]);
  return {
    tables: async () => (await get('/tables')).tables.map(table => table.id),
    columns: async table => (await get(`/tables/${table}/columns`)).columns.map(column => ({ id: column.id, type: column.fields.type })),
    // Les lignes d'une table : [{ id, …colonnes }], [] si la table n'existe pas.
    rows: async table => {
      const answer = await get(`/tables/${table}/records`);
      return answer.records ? answer.records.map(record => ({ id: record.id, ...record.fields })) : [];
    },
    // Une pièce jointe : son code, son type, sa taille et l'empreinte de son contenu.
    attachment: number => page.evaluate(async ([id, n]) => {
      const response = await fetch(`/api/docs/${id}/attachments/${n}/download`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return { status: response.status, type: response.headers.get('content-type'), size: bytes.length, hash: [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('') };
    }, [docId, number]),
    // Les pages du document (le nom de leur vue), lues dans les tables internes de Grist.
    pages: async () => (await get(`/sql?q=${encodeURIComponent('SELECT v.name AS name FROM _grist_Pages p JOIN _grist_Views v ON v.id = p.viewRef ORDER BY p.pagePos')}`)).records.map(record => record.fields.name),
    attachments: async () => (await get('/attachments')).records.map(record => ({ id: record.id, name: record.fields.fileName })),
  };
}

// ---------- l'explorateur ----------

export const toast = frame => frame.locator('#toast').textContent();
// Les noms des fichiers affichés (hors dossiers), dans l'ordre de la liste.
export const names = frame => frame.locator('.ls-row:not(.folder) .nm .t').allTextContents();
export const folders = frame => frame.locator('.ls-row.folder .nm .t').allTextContents();

// Attend que la liste porte exactement ces noms (la relecture suit l'écriture).
export async function waitForNames(frame, expected, timeout = 20000) {
  await frame.waitForFunction(wanted => {
    const found = [...document.querySelectorAll('.ls-row:not(.folder) .nm .t')].map(node => node.textContent);
    return JSON.stringify(found) === JSON.stringify(wanted);
  }, expected, { timeout }).catch(() => {});
  return names(frame);
}

export async function waitForToast(frame, pattern, timeout = 20000) {
  await frame.waitForFunction(source => new RegExp(source).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, pattern.source, { timeout }).catch(() => {});
  return toast(frame);
}

// « Nouveau > Importer > PDF » à la souris, puis le sélecteur de fichier (le seul geste que la souris ne fait pas : la boîte du système) reçoit `file` ({ name, mimeType, buffer }).
export async function importPdf(page, frame, file) {
  await frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await frame.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), frame.locator('.menu-sub').getByRole('menuitem', { name: /^PDF/ }).click()]);
  await chooser.setFiles(file);
}

export const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `pdf-${name}.png`) });

// La ligne d'un fichier par son nom affiché (fichier, pas dossier).
export const rowOf = (frame, name) => frame.locator('.ls-row:not(.folder)').filter({ has: frame.locator('.nm .t', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });

// Une entrée de l'arbre de gauche (Moi, Récents, Favoris…) ou du fil d'Ariane, à la souris.
export const goTo = (frame, pattern) => frame.locator('.tr-row', { hasText: pattern }).click();

// Playwright refuse de cliquer un contrôle grisé (`aria-disabled`) : la vraie souris appuie sur ce que la personne voit, en son centre.
export async function pressGreyed(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// Le menu « Plus d'actions » d'une ligne.
export async function openRowMenu(frame, name) {
  const row = rowOf(frame, name);
  await row.hover();
  await row.locator('.rb.mn').click();
  await frame.locator('.menu').waitFor();
}

// Le contraste (4,5:1, la charte) de chaque texte sous `selector`, mesuré sur les couleurs réellement affichées (fond composé de la racine à l'élément, opacité comprise) : la liste de ceux qui
// n'y arrivent pas, vide quand tout va bien.
export const contrastProblems = (frame, selector) => frame.evaluate(rootSelector => {
  const parse = value => {
    const modern = value.match(/color\(srgb ([^)]+)\)/);
    if (modern) { const [r, g, b, a = 1] = modern[1].split(/[\s/]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; }
    const legacy = value.match(/rgba?\(([^)]+)\)/);
    if (!legacy) return null;
    const [r, g, b, a = 1] = legacy[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const luminance = ({ r, g, b }) => { const f = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const behind = element => {
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.push(node);
    return chain.reverse().reduce((color, node) => { const bg = parse(getComputedStyle(node).backgroundColor); return bg && bg.a > 0 ? over(bg, color) : color; }, { r: 255, g: 255, b: 255, a: 1 });
  };
  const failures = [];
  for (const element of document.querySelectorAll(`${rootSelector}, ${rootSelector} *`)) {
    if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    const ink = parse(style.color);
    if (!ink) continue;
    const background = behind(element);
    const text = over({ ...ink, a: ink.a * opacity }, background);
    const ratio = (Math.max(luminance(text), luminance(background)) + 0.05) / (Math.min(luminance(text), luminance(background)) + 0.05);
    if (ratio < 4.5) failures.push({ text: element.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
  }
  return failures;
}, selector);

// La fenêtre (`.mod`) tient dans le panneau et rien n'y déborde : ses boutons, son texte, ses lignes.
export const windowFits = frame => frame.evaluate(() => {
  const mod = document.querySelector('.mod');
  if (!mod) return { shown: false };
  const box = mod.getBoundingClientRect();
  const overflowing = [...mod.querySelectorAll('*')].filter(node => {
    const at = node.getBoundingClientRect();
    return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1 || at.bottom > box.bottom + 1 || at.top < box.top - 1);
  }).map(node => node.className || node.tagName).slice(0, 5);
  return { shown: true, inPanel: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, overflowing };
});
