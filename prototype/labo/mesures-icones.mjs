// Ce que les mesures des icônes de type ont en commun (décision du porteur, 04/11 : elles suivent l'ambiance, et le PDF a sa couleur rouge) : test/icones-firefox.mjs les joue sous Firefox sur la page d'essai,
// labo/run-theme.mjs dans un vrai Grist. Une seule lecture (`readIcons`, qui s'exécute dans la page) et un seul jugement (`rowProblems`) : ce que Firefox ou Chromium CALCULE pour l'icône d'une ligne ou d'une
// vignette (sa couleur, l'épaisseur de son trait, ses angles et ses bouts, son remplissage, son halo) contre ce que dit le tableau de js/theme/ambiance-types.js et le trait de css/explorer.css.
import { typeTokens } from '../js/theme/ambiance-types.js';

// Le trait de chaque ambiance (css/explorer.css, « le trait des icônes de type ») : le facteur de l'épaisseur d'origine, les angles, les bouts, le remplissage doux, le halo.
export const STROKE = {
  defaut: { k: 1, join: 'round', cap: 'round', fill: false, glow: false },
  pop: { k: 1.1, join: 'round', cap: 'round', fill: true, glow: false },
  papier: { k: 0.88, join: 'miter', cap: 'butt', fill: false, glow: false },
  brut: { k: 1.18, join: 'miter', cap: 'square', fill: false, glow: false },
  enseigne: { k: 0.92, join: 'round', cap: 'round', fill: false, glow: true },
};
export const BASE = { list: 1.8, tiles: 1.4, info: 1.8 }; // l'épaisseur d'origine du trait : en liste et dans la barre d'information 1,8, en vignette 1,4
export const FILL_ALPHA = 0.17; // le remplissage doux de Pop : 17 % de la couleur de l'icône
export const FAMILY_TOKEN = { doc: '--t-doc', grid: '--t-grid', slides: '--t-slides', pdf: '--t-pdf' }; // l'attribut `data-fam` d'une ligne -> son jeton de couleur d'icône

// ---------- lire une couleur que le navigateur a calculée ----------

export const rgbOf = hex => `rgb(${[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;

// « rgb(r, g, b) », « rgba(r, g, b, a) », « rgb(r g b / a) » ou « color(srgb r g b / a) » (un mélange, en 0 à 1) -> { rgb: [r, g, b] sur 255, alpha } ; null si ce n'est pas une couleur.
export function parseColor(text) {
  const numbers = (String(text).match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
  if (numbers.length < 3 || /^(none|transparent)$/.test(String(text))) return null;
  const unit = /^color\(/.test(text) ? 255 : 1;
  return { rgb: numbers.slice(0, 3).map(value => value * unit), alpha: numbers.length > 3 ? numbers[3] : 1 };
}

const near = (a, b, gap = 2) => a.every((value, at) => Math.abs(value - b[at]) <= gap);

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Ce que le navigateur calcule pour l'icône de chaque ligne (`display` = « list ») ou vignette (« tiles ») : { rows: [{ name, fam, locked, folder, color, width, join, cap, fill, filter, ink }], info }.
// `fam` : la famille de couleur de la ligne (`data-fam`), ou null ; `ink` : en vignette, la couleur du mot du type ; `info` : l'icône de la barre d'information (liste seulement).
export function readIcons({ display }) {
  const look = svg => {
    if (!svg) return null;
    const style = getComputedStyle(svg);
    return { color: style.color, width: parseFloat(style.strokeWidth), join: style.strokeLinejoin, cap: style.strokeLinecap, fill: style.fill, filter: style.filter };
  };
  const tiles = display === 'tiles';
  const rows = [...document.querySelectorAll(tiles ? '.th' : '.ls-row')].map(node => {
    const label = tiles ? node.querySelector('.tt') : null;
    return {
      name: node.querySelector(tiles ? '.tn' : '.t').textContent, fam: node.dataset.fam || null, locked: node.classList.contains('lk'), folder: node.classList.contains('folder'),
      ...look(node.querySelector(tiles ? '.th-pv .ic' : '.nm .ic')), ink: label ? getComputedStyle(label).color : null,
    };
  });
  const info = tiles ? null : document.querySelector('.inf');
  return { rows, info: info ? { fam: info.dataset.fam || null, ...look(info.querySelector('.l1 > .ic:first-child')) } : null };
}

// ---------- ce que la mesure constate : des écarts { kind, text } ----------

// La couleur : celle du tableau pour une ligne de famille (et, en vignette, celle du mot du type) ; un dossier, un fichier grisé ou sans famille n'a aucune couleur de type.
function colorProblems(row, { tokens, display }, note) {
  if (!row.fam || row.locked || row.folder) {
    if (Object.values(FAMILY_TOKEN).some(token => row.color === rgbOf(tokens[token]))) note('couleur d\'un fichier sans famille', `dessinée ${row.color}, une couleur de type`);
    return;
  }
  const wanted = rgbOf(tokens[FAMILY_TOKEN[row.fam]]);
  if (row.color !== wanted) note('couleur', `dessinée ${row.color} au lieu de ${wanted} (${FAMILY_TOKEN[row.fam]} de l'ambiance)`);
  if (display !== 'tiles') return;
  const ink = rgbOf(tokens[`${FAMILY_TOKEN[row.fam]}-ink`]);
  if (row.ink !== ink) note('couleur du mot du type', `le mot du type est ${row.ink} au lieu de ${ink} (${FAMILY_TOKEN[row.fam]}-ink)`);
}

// Le trait : l'épaisseur d'origine fois le facteur de l'ambiance, ses angles, ses bouts.
function lineProblems(row, { stroke, display }, note) {
  const width = BASE[display] * stroke.k;
  if (Math.abs(row.width - width) > 0.02) note('épaisseur du trait', `${row.width} px au lieu de ${width.toFixed(2)} px (${BASE[display]} × ${stroke.k})`);
  if (row.join !== stroke.join) note('angles du trait', `${row.join} au lieu de ${stroke.join}`);
  if (row.cap !== stroke.cap) note('bouts du trait', `${row.cap} au lieu de ${stroke.cap}`);
}

// Le remplissage doux de Pop (17 % de la couleur de l'icône) ; ailleurs, et sur un fichier grisé, « none » ; un dossier garde le sien.
function fillProblems(row, { stroke }, note) {
  if (row.folder) return;
  if (!stroke.fill || row.locked) {
    if (row.fill !== 'none') note('remplissage', `« ${row.fill} » au lieu de « none »`);
    return;
  }
  const fill = parseColor(row.fill);
  const color = parseColor(row.color);
  if (!fill || !color || Math.abs(fill.alpha - FILL_ALPHA) > 0.02 || !near(fill.rgb, color.rgb)) note('remplissage doux', `« ${row.fill} » au lieu de ${FILL_ALPHA * 100} % de ${row.color}`);
}

// Le halo d'Enseigne (2,2 px) ; ailleurs, et sur un fichier grisé, « none ».
function glowProblems(row, { stroke }, note) {
  if (!stroke.glow || row.locked) {
    if (row.filter !== 'none') note('halo', `le filtre est « ${row.filter} » au lieu de « none »`);
    return;
  }
  if (!/^drop-shadow\(/.test(row.filter) || !/2\.2px/.test(row.filter)) note('halo', `le filtre est « ${row.filter} » au lieu d'un halo de 2,2 px`);
}

// Une icône lue contre ce que dit l'ambiance `id` dans le mode `mode` (« clair » ou « sombre ») : la couleur, le trait, le remplissage, le halo.
export function rowProblems(row, { id, mode, display, tag }) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `icône de type : ${kind}`, text: `${tag}, « ${row.name} » : ${text}` });
  const context = { stroke: STROKE[id], tokens: typeTokens(id, mode), display };
  colorProblems(row, context, note);
  lineProblems(row, context, note);
  fillProblems(row, context, note);
  glowProblems(row, context, note);
  return found;
}

// L'icône de la barre d'information du fichier choisi, dont la famille est `fam` : sa couleur et son trait.
export function infoProblems(info, fam, { id, mode, tag }) {
  const stroke = STROKE[id];
  const found = [];
  const note = (kind, text) => found.push({ kind: `barre d'information : ${kind}`, text: `${tag} : ${text}` });
  if (!info) { note('barre absente', 'la barre d\'information n\'est pas dans la page'); return found; }
  if (info.fam !== fam) note('famille', `la barre est de la famille ${info.fam} au lieu de ${fam}`);
  const wanted = rgbOf(typeTokens(id, mode)[FAMILY_TOKEN[fam]]);
  if (info.color !== wanted) note('couleur', `l'icône est ${info.color} au lieu de ${wanted}`);
  const width = BASE.info * stroke.k;
  if (Math.abs(info.width - width) > 0.02) note('épaisseur du trait', `${info.width} px au lieu de ${width.toFixed(2)} px`);
  if (info.join !== stroke.join || info.cap !== stroke.cap) note('angles et bouts', `${info.join} et ${info.cap} au lieu de ${stroke.join} et ${stroke.cap}`);
  return found;
}
