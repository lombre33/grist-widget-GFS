// Le zoom et le déplacement de l'image d'un plan (module Annuaire, plan des bâtiments, lot 2 ; demande du porteur du 27/11). Du calcul sans effet de bord,
// essayé sous Node (test/annuaire-plan-map.test.mjs) : une vue est { k (l'agrandissement : 1 = l'image tient dans le cadre), x, y (où tombe son coin haut
// gauche dans le cadre, en pixels, toujours négatifs ou nuls) } ; `vw` et `vh` sont la largeur et la hauteur du cadre. Rien ne sort jamais du cadre : l'image
// le recouvre toujours.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const FIT = Object.freeze({ k: 1, x: 0, y: 0 });

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// La vue ramenée à ce qui est permis : l'agrandissement entre MIN_ZOOM et MAX_ZOOM, l'image qui recouvre le cadre.
export function clampView(view, vw, vh) {
  const k = clamp(Number(view.k) || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  return { k, x: clamp(Number(view.x) || 0, Math.min(0, vw - vw * k), 0), y: clamp(Number(view.y) || 0, Math.min(0, vh - vh * k), 0) };
}

// Agrandit (`factor` > 1) ou réduit autour du point (`px`, `py`) du cadre : ce qui est sous le pointeur reste sous le pointeur.
export function zoomAt(view, factor, px, py, vw, vh) {
  const k = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = k / view.k;
  return clampView({ k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, vw, vh);
}

// Déplace l'image de (`dx`, `dy`) pixels.
export const panBy = (view, dx, dy, vw, vh) => clampView({ k: view.k, x: view.x + dx, y: view.y + dy }, vw, vh);

// Rend true quand la vue est celle de départ (l'image entière).
export const isFit = view => view.k <= MIN_ZOOM;

// Le facteur d'une graduation de molette (`deltaY` en pixels, ou en lignes quand `mode` vaut 1) : doux, et le même dans les deux sens.
export const wheelFactor = (deltaY, mode = 0) => Math.exp(-clamp(deltaY * (mode === 1 ? 16 : 1), -240, 240) * 0.0018);

// Ce que font les touches sur le plan : { zoom (un facteur), dx, dy } ou null pour une touche qui n'est pas du plan. Les flèches ne déplacent que d'une image
// agrandie (sinon elles gardent leur geste habituel).
export function keyMove(key, view) {
  if (key === '+' || key === '=') return { zoom: 1.4, dx: 0, dy: 0 };
  if (key === '-' || key === '_') return { zoom: 1 / 1.4, dx: 0, dy: 0 };
  if (key === '0') return { zoom: 0, dx: 0, dy: 0 };
  if (isFit(view)) return null;
  const step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[key];
  return step ? { zoom: 1, dx: step[0], dy: step[1] } : null;
}
