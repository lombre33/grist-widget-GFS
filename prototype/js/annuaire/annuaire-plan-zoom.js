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

// Où l'image tient dans un cadre de `vw` × `vh` pixels, à l'agrandissement 1 (`object-fit: contain`) : { dw, dh (sa taille), ox, oy (son coin haut gauche) } ;
// `ratio` est sa largeur sur sa hauteur.
export function fitRect(vw, vh, ratio) {
  const wide = vw / (vh || 1) > ratio;
  const dw = wide ? vh * ratio : vw;
  const dh = wide ? vh : vw / ratio;
  return { dw, dh, ox: (vw - dw) / 2, oy: (vh - dh) / 2 };
}

// Le point (`fx`, `fy`) du cadre, en unités du plan (la largeur de l'image en vaut `units`) : on défait la vue puis le placement de l'image. C'est ce que le
// pointeur désigne sur le plan, quel que soit l'agrandissement.
export function unitsAt(view, rect, fx, fy, units) {
  const per = units / rect.dw;
  return [((fx - view.x) / view.k - rect.ox) * per, ((fy - view.y) / view.k - rect.oy) * per];
}

// La vue qui cadre le rectangle `box` ({ x, y, w, h }, en pixels du cadre, l'image étant à l'agrandissement 1) avec un peu de marge autour : le local qu'on
// ouvre, vu de près. Jamais moins que l'image entière, jamais plus que MAX_ZOOM.
export function focusView(box, vw, vh, margin = 0.25) {
  const k = clamp(Math.min(vw / (box.w * (1 + margin * 2)), vh / (box.h * (1 + margin * 2))), MIN_ZOOM, MAX_ZOOM);
  return clampView({ k, x: vw / 2 - (box.x + box.w / 2) * k, y: vh / 2 - (box.y + box.h / 2) * k }, vw, vh);
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
