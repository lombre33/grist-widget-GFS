// La couleur d'une ambiance se calcule en OKLCH (clarté, vivacité et teinte qui se tiennent d'une teinte à l'autre) : la clarté d'un rôle s'ajuste, jamais sa
// teinte. Du code sans DOM ni
// stockage : il rend et reçoit des textes `#rrggbb` en minuscules. Le contraste est celui de la WCAG 2 (de 1 à 21), le même que mesurent les essais.

import { ColorMath } from '../kit/js/color-math.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const toLinear = value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const fromLinear = value => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

export const isHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);

// « #6d4fd6 », « 6D4FD6 », « #6df » : le texte d'une personne en `#rrggbb` en minuscules, ou null (cinq chiffres, un caractère qui n'est pas hexadécimal, une
// opacité). Celui du kit (kit/js/color-math.js).
export const parseHex = ColorMath.parseHex;

// { L, C, h } : clarté de 0 à 1, vivacité (0 pour un gris), teinte en degrés.
export function hexToOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(value => toLinear(value / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(labA, labB);
  return { L, C, h: C < 1e-4 ? 0 : (Math.atan2(labB, labA) * 180 / Math.PI + 360) % 360 };
}

function linearOf({ L, C, h }) {
  const labA = C * Math.cos(h * Math.PI / 180);
  const labB = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * labA + 0.2158037573 * labB) ** 3;
  const m = (L - 0.1055613458 * labA - 0.0638541728 * labB) ** 3;
  const s = (L - 0.0894841775 * labA - 1.291485548 * labB) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

const inGamut = rgb => rgb.every(value => value >= -0.0005 && value <= 1.0005);
const hexOf = rgb => `#${rgb.map(value => Math.round(clamp(fromLinear(clamp(value, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;

// La couleur la plus vive qui tient dans l'écran à cette clarté et cette teinte : la vivacité baisse jusqu'à y entrer.
export function oklchToHex({ L, C, h }) {
  let low = 0;
  let high = Math.max(0, C);
  if (inGamut(linearOf({ L, C: high, h }))) low = high;
  else for (let i = 0; i < 22; i++) { const mid = (low + high) / 2; if (inGamut(linearOf({ L, C: mid, h }))) low = mid; else high = mid; }
  return hexOf(linearOf({ L, C: low, h }));
}

// Le contraste de deux couleurs (WCAG 2) : de 1 à 21. C'est celui du kit (kit/js/color-math.js), le même pour GFS et pour les apps : GFS ne le recopie plus
// (choix du porteur, 11/11).
export const contrast = ColorMath.contrast;

// Monte ou baisse la clarté d'une couleur, d'un pas à la fois, jusqu'à ce que `ok(hex)` soit vrai ; la teinte et la vivacité demandée restent. Rend { hex, L }
// (la dernière essayée si rien ne convient).
export function settle(color, step, ok) {
  let L = color.L;
  for (let i = 0; i < 400; i++) {
    const hex = oklchToHex({ ...color, L });
    if (ok(hex)) return { hex, L };
    L = clamp(L + step, 0, 1);
  }
  return { hex: oklchToHex({ ...color, L }), L };
}
