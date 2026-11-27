// Le tracé d'un lieu sur le plan de son parent (module Annuaire, plan des bâtiments, lot 3 ; demande du porteur du 27/11). Du calcul sans effet de bord, essayé
// sous Node (test/annuaire-plan-shape.test.mjs) : lire le texte de la colonne `Shape` (js/annuaire/annuaire-config.js), l'écrire, dire où est le tracé, où
// poser son nom et où poser les places de ses occupants. Un tracé est un rectangle ou un polygone, en « unités du plan » : la largeur de l'image vaut UNITS, la
// hauteur suit son rapport (une image de 3 000 × 2 000 pixels fait 1 000 × 667 unités). Ces unités ne dépendent donc pas de la taille de l'image : un plan
// remplacé par le même plan en plus net garde ses tracés. Le texte écrit dans Grist : {"t":"r","x":120,"y":80,"w":300,"h":200} ou
// {"t":"p","p":[[120,80],[420,80],[420,280]]}. Un texte qu'on ne comprend pas donne `null` : le lieu reste dans la liste, sans tracé (jamais d'erreur, jamais
// de texte lu comme du code).

export const UNITS = 1000;
export const MAX_POINTS = 64;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const round = value => Math.round(value * 10) / 10;

// Les angles du tracé, dans l'ordre : un rectangle en a quatre.
export function pointsOf(shape) {
  if (shape.type === 'rect') return [[shape.x, shape.y], [shape.x + shape.w, shape.y], [shape.x + shape.w, shape.y + shape.h], [shape.x, shape.y + shape.h]];
  return shape.pts;
}

// L'aire d'un polygone (formule des lacets), toujours positive.
export function areaOf(shape) {
  const pts = pointsOf(shape);
  let sum = 0;
  pts.forEach(([x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; sum += x * ny - nx * y; });
  return Math.abs(sum) / 2;
}

// Un polygone lu : trois à MAX_POINTS angles, chacun deux nombres, et une surface.
function readPolygon(list) {
  if (!Array.isArray(list) || list.length < 3 || list.length > MAX_POINTS) return null;
  if (!list.every(point => Array.isArray(point) && point.length === 2 && point.every(finite))) return null;
  const shape = { type: 'poly', pts: list.map(([x, y]) => [x, y]) };
  return areaOf(shape) > 0 ? shape : null;
}

// Le tracé que dit le texte `text`, ou null : un rectangle plein, ou un polygone de trois à MAX_POINTS angles qui a une surface.
export function readShape(text) {
  let raw;
  try { raw = typeof text === 'string' && text.trim() ? JSON.parse(text) : null; } catch (error) { raw = null; }
  if (!raw || typeof raw !== 'object') return null;
  if (raw.t === 'p') return readPolygon(raw.p);
  if (raw.t !== 'r') return null;
  const shape = { type: 'rect', x: raw.x, y: raw.y, w: raw.w, h: raw.h };
  return [shape.x, shape.y, shape.w, shape.h].every(finite) && shape.w > 0 && shape.h > 0 ? shape : null;
}

// Le texte à écrire dans la colonne `Shape` (les nombres au dixième : un texte court).
export function writeShape(shape) {
  if (shape.type === 'rect') return JSON.stringify({ t: 'r', x: round(shape.x), y: round(shape.y), w: round(shape.w), h: round(shape.h) });
  return JSON.stringify({ t: 'p', p: shape.pts.map(([x, y]) => [round(x), round(y)]) });
}

// La boîte qui entoure le tracé : { x, y, w, h }.
export function boundsOf(shape) {
  const pts = pointsOf(shape);
  const xs = pts.map(point => point[0]);
  const ys = pts.map(point => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Le tracé comme chemin de dessin (`d` d'un `<path>`).
export const pathD = shape => `${pointsOf(shape).map(([x, y], i) => `${i ? 'L' : 'M'}${round(x)} ${round(y)}`).join(' ')}Z`;

// Le point (x, y) est-il dans le tracé ? (tir d'un rayon : un polygone en L ou en U compte comme il se doit)
export function inside(shape, x, y) {
  const pts = pointsOf(shape);
  let within = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

// La distance du point (x, y) au bord le plus proche du tracé.
export function edgeDistance(shape, x, y) {
  const pts = pointsOf(shape);
  let best = Infinity;
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax;
    const dy = by - ay;
    const along = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(x - (ax + along * dx), y - (ay + along * dy)));
  });
  return best;
}

// Où poser le nom du lieu : le centre d'un rectangle ; pour un polygone, le point du tracé le plus éloigné de ses bords (un centre de gravité sortirait d'un
// L).
export function centerOf(shape) {
  const box = boundsOf(shape);
  if (shape.type === 'rect') return [box.x + box.w / 2, box.y + box.h / 2];
  let best = [box.x + box.w / 2, box.y + box.h / 2];
  let far = inside(shape, best[0], best[1]) ? edgeDistance(shape, best[0], best[1]) : -1;
  for (let i = 1; i < 12; i += 1) {
    for (let j = 1; j < 12; j += 1) {
      const x = box.x + (box.w * i) / 12;
      const y = box.y + (box.h * j) / 12;
      const away = inside(shape, x, y) ? edgeDistance(shape, x, y) : -1;
      if (away > far) { far = away; best = [x, y]; }
    }
  }
  return best;
}

// Où poser `count` places dans le tracé : { pts: [[x, y], …] (rangée par rangée), step : l'écart entre deux places }. La grille se resserre jusqu'à ce que
// toutes les places tiennent à l'intérieur, loin des bords, et elle est centrée dans le tracé ; les places retenues sont les plus proches du centre (une place
// seule est au milieu du local, pas dans son coin). Si le tracé est trop petit, il en rend autant qu'il peut.
export function seatSpots(shape, count) {
  if (count <= 0) return { pts: [], step: 0 };
  const box = boundsOf(shape);
  const [cx, cy] = centerOf(shape);
  let step = Math.min(Math.sqrt(areaOf(shape) / (count * 1.6)), Math.min(box.w, box.h) / 2.5);
  let found = [];
  for (let tries = 0; tries < 10 && found.length < count; tries += 1) {
    found = [];
    const x0 = box.x + (box.w - Math.floor(box.w / step) * step) / 2 + step / 2;
    const y0 = box.y + (box.h - Math.floor(box.h / step) * step) / 2 + step / 2;
    for (let y = y0; y < box.y + box.h; y += step) {
      for (let x = x0; x < box.x + box.w; x += step) if (inside(shape, x, y) && edgeDistance(shape, x, y) >= step * 0.4) found.push([x, y]);
    }
    if (found.length < count) step *= 0.85;
  }
  const near = [...found].sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy)).slice(0, count);
  return { pts: near.sort((a, b) => a[1] - b[1] || a[0] - b[0]), step };
}
