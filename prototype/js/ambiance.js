// Les ambiances de GFS (décision du porteur, 03/11) : de la couleur d'une ambiance, ou de la couleur libre de la personne, aux dix-neuf jetons de couleur de chaque mode (les quinze de la charte et quatre
// de décor), avec le contraste de 4,5:1 tenu à la place de la personne. Du code sans DOM ni stockage. La forme (arrondis, ombres, polices…) est dans js/ambiance-forme.js.
// Les clés `clair` et `sombre` sont celles du message aux apps (contrats 5.2, point 10). Une ambiance qui n'écrit rien (l'ambiance d'origine, sans couleur choisie) rend `null`.

import { FORME } from './ambiance-forme.js';
import { oklchToHex, hexToOklch, contrast, parseHex, settle } from './oklch.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const WHITE = '#ffffff';
const BLACK = '#0b0d12';
const MIN_TEXT = 4.6; // un peu au-dessus de 4,5 : l'arrondi du `#rrggbb` ne doit jamais la faire passer dessous
const MIN_FILL = 4.55; // le texte d'un bouton plein
const MIN_VISIBLE = 1.25; // le bouton plein se distingue de la carte où il se pose, en clair comme en sombre (un blanc en clair, un noir en sombre le feraient disparaître)
const REFERENCE_CHROMA = 0.202; // la vivacité du bleu d'origine (#2f6fed), à laquelle se mesurent la teinte des gris et le fond doux d'une couleur libre
const MODES = Object.freeze(['clair', 'sombre']);

// Les jetons de couleur que porte une ambiance : les quinze de la charte (css/gfs.css), puis quatre de décor (le filet, le bout du dégradé du bouton et de l'avatar, l'ombre dure).
export const COLOR_TOKENS = Object.freeze([
  '--bg', '--surface', '--surface-sunken', '--border', '--border-strong', '--text', '--text-muted',
  '--accent', '--accent-hover', '--accent-solid', '--accent-solid-hover', '--on-accent', '--accent-ink', '--accent-soft', '--accent-soft-border',
  '--accent-2', '--accent-3', '--accent-end', '--hard',
]);

// La charte d'origine, telle que css/gfs.css la dit (test/ambiance.test.mjs vérifie qu'elles s'accordent) : la vignette de l'ambiance d'origine la montre quand une autre est choisie.
export const ORIGIN_SEED = '#2f6fed';
export const ORIGIN = Object.freeze({
  clair: Object.freeze({ '--bg': '#f4f6fa', '--surface': '#ffffff', '--surface-sunken': '#eef1f6', '--border': '#dde2ea', '--border-strong': '#c3cad6', '--text': '#1b2430', '--text-muted': '#5f6b7e',
    '--accent': '#2f6fed', '--accent-hover': '#2558c4', '--accent-solid': '#2f6fed', '--accent-solid-hover': '#2558c4', '--on-accent': '#ffffff', '--accent-ink': '#2558c4', '--accent-soft': '#e8f0fe', '--accent-soft-border': '#c7dbfd' }),
  sombre: Object.freeze({ '--bg': '#171b23', '--surface': '#1e2430', '--surface-sunken': '#262e3c', '--border': '#323b4b', '--border-strong': '#465166', '--text': '#e7ecf5', '--text-muted': '#9aa6bb',
    '--accent': '#5b91f5', '--accent-hover': '#74a3f7', '--accent-solid': '#2f6fed', '--accent-solid-hover': '#2558c4', '--on-accent': '#ffffff', '--accent-ink': '#74a3f7', '--accent-soft': '#24324b', '--accent-soft-border': '#35507d' }),
});

const gray = (bg, surface, sunken, border, strong, text, muted) => ({ '--bg': bg, '--surface': surface, '--surface-sunken': sunken, '--border': border, '--border-strong': strong, '--text': text, '--text-muted': muted });

// Une ambiance. `seeds` : la couleur de l'ambiance (clarté, vivacité, teinte) de chaque mode ; `fill` : celle de son bouton plein si ce n'est pas la même (le jaune de Brut) ; `hue` : la teinte des gris
// ('accent' : celle de la couleur ; un nombre : fixe) ; `tint` et `darkTint` : la force de cette teinte ; `grays` : [clarté, vivacité] de chaque gris par mode (`--text-muted` n'est qu'un point de départ :
// il s'éloigne du fond tant qu'un des fonds où il se pose lui donne moins de 4,6:1) ; `soft` : [clarté, vivacité] du fond doux puis de son trait ; `second` : l'écart de teinte des deux couleurs du filet et du bout du dégradé.
const SPECS = Object.freeze({
  defaut: {
    seeds: null, fill: null, hue: 'accent', reference: REFERENCE_CHROMA, tint: 1.1, darkTint: 0.8,
    grays: {
      clair: gray([0.973, 0.006], [1, 0], [0.957, 0.007], [0.911, 0.012], [0.837, 0.018], [0.257, 0.026], [0.525, 0.033]),
      sombre: gray([0.222, 0.017], [0.26, 0.024], [0.3, 0.028], [0.351, 0.031], [0.434, 0.038], [0.942, 0.013], [0.723, 0.033]),
    },
    soft: { clair: [0.953, 0.021, 0.887, 0.052], sombre: [0.317, 0.049, 0.432, 0.082] },
    second: { dh2: 120, dh3: -120, dhEnd: 40 },
  },
  pop: {
    seeds: { clair: { L: 0.53, C: 0.2, h: 293 }, sombre: { L: 0.66, C: 0.17, h: 293 } }, fill: null, hue: 'accent', reference: 0.2, tint: 1, darkTint: 1,
    grays: {
      clair: gray([0.941, 0.034], [1, 0], [0.968, 0.015], [0.905, 0.032], [0.832, 0.06], [0.245, 0.055], [0.5, 0.055]),
      sombre: gray([0.205, 0.045], [0.255, 0.05], [0.295, 0.055], [0.36, 0.065], [0.45, 0.085], [0.95, 0.016], [0.745, 0.055]),
    },
    soft: { clair: [0.953, 0.034, 0.885, 0.075], sombre: [0.32, 0.075, 0.44, 0.1] },
    second: { dh2: 118, dh3: -106, dhEnd: 62 },
  },
  papier: {
    seeds: { clair: { L: 0.42, C: 0.135, h: 12 }, sombre: { L: 0.72, C: 0.12, h: 12 } }, fill: null, hue: 82, tint: 1, darkTint: 1,
    grays: {
      clair: gray([0.947, 0.02], [0.993, 0.006], [0.968, 0.013], [0.885, 0.03], [0.58, 0.05], [0.225, 0.014], [0.47, 0.035]),
      sombre: gray([0.2, 0.012], [0.245, 0.014], [0.285, 0.016], [0.36, 0.02], [0.62, 0.04], [0.935, 0.02], [0.74, 0.04]),
    },
    soft: { clair: [0.945, 0.022, 0.86, 0.05], sombre: [0.31, 0.04, 0.44, 0.07] },
    second: { dh2: 110, dh3: -110, dhEnd: 20 },
  },
  // Brut : le bleu sert à la sélection et aux liens, le jaune au bouton plein (le texte noir dessus).
  brut: {
    seeds: { clair: { L: 0.5, C: 0.24, h: 265 }, sombre: { L: 0.88, C: 0.17, h: 95 } }, fill: { L: 0.87, C: 0.18, h: 95 }, hue: 95, tint: 1, darkTint: 1,
    grays: {
      clair: gray([0.965, 0.085], [1, 0], [0.955, 0.06], [0.76, 0.085], [0.18, 0.005], [0.18, 0.005], [0.42, 0.025]),
      sombre: gray([0.175, 0.004], [0.225, 0.004], [0.27, 0.004], [0.4, 0.004], [0.965, 0.002], [0.965, 0.002], [0.76, 0.01]),
    },
    soft: { clair: [0.935, 0.05, 0.78, 0.12], sombre: [0.31, 0.06, 0.5, 0.1] },
    second: { dh2: 140, dh3: -150, dhEnd: -60 },
  },
  neon: {
    seeds: { clair: { L: 0.5, C: 0.22, h: 275 }, sombre: { L: 0.84, C: 0.13, h: 205 } }, fill: { L: 0.8, C: 0.13, h: 205 }, hue: 262, tint: 1, darkTint: 1,
    grays: {
      clair: gray([0.953, 0.03], [1, 0], [0.936, 0.036], [0.865, 0.055], [0.72, 0.1], [0.23, 0.07], [0.5, 0.06]),
      sombre: gray([0.17, 0.045], [0.215, 0.055], [0.255, 0.06], [0.33, 0.075], [0.45, 0.115], [0.965, 0.016], [0.775, 0.055]),
    },
    soft: { clair: [0.935, 0.04, 0.84, 0.09], sombre: [0.28, 0.06, 0.42, 0.1] },
    second: { dh2: 125, dh3: 55, dhEnd: 70 },
  },
});

// L'ordre des vignettes de la fenêtre « Thème » ; `defaut` est l'ambiance d'origine (Grist Factory).
export const AMBIANCES = Object.freeze(['defaut', 'pop', 'papier', 'brut', 'neon']);
export const DEFAULT_AMBIANCE = 'defaut';

// La couleur de l'ambiance elle-même, dans le mode demandé (la pastille « Celle de l'ambiance »).
export const seedOf = (id, mode = 'clair') => (SPECS[id] && SPECS[id].seeds ? oklchToHex(SPECS[id].seeds[mode]) : ORIGIN_SEED);

// Les gris d'un mode. Une ambiance qui suit la couleur (`hue: 'accent'`) prend sa teinte, d'autant moins qu'elle est peu vive : une couleur libre grise ne teinte presque pas les gris.
function grays(spec, mode, seed) {
  const h = spec.hue === 'accent' ? seed.h : spec.hue;
  const follow = spec.hue === 'accent' ? clamp(seed.C / spec.reference, 0.25, 1.4) : 1;
  const k = follow * spec.tint * (mode === 'sombre' ? spec.darkTint : 1);
  const out = {};
  for (const [token, [L, C]] of Object.entries(spec.grays[mode])) out[token] = oklchToHex({ L, C: C * k, h });
  return { out, h, k };
}

// Le bouton plein : la couleur telle quelle, avec l'encre (blanche ou noire) qui s'y lit le mieux ; la couleur ne bouge que si aucune des deux n'atteint 4,55:1, ou si elle se confond avec la
// carte (`surfaces` : celle de chaque mode), dont elle s'écarte alors un peu. Son survol : un cran plus foncé sous une encre blanche, plus clair sous une encre noire (le texte s'y lit toujours).
// `moved` dit si la clarté a bougé de plus de 0,02.
function fillOf(seed, surfaces) {
  const ink = contrast(oklchToHex(seed), WHITE) >= contrast(oklchToHex(seed), BLACK) ? WHITE : BLACK;
  const step = ink === WHITE ? -0.004 : 0.004;
  const seen = hex => surfaces.every(back => contrast(hex, back) >= MIN_VISIBLE);
  let base = settle({ ...seed }, step, hex => contrast(hex, ink) >= MIN_FILL);
  if (!seen(base.hex)) base = settle({ ...seed, L: base.L }, -step, seen);
  const hover = settle({ ...seed, L: clamp(base.L + (ink === WHITE ? -0.065 : 0.05), 0.2, 0.97), C: seed.C * 0.92 }, step, hex => contrast(hex, ink) >= MIN_FILL);
  return { ink, step, base: base.hex, hover: hover.hex, moved: Math.abs(base.L - seed.L) > 0.02 };
}

// L'accent, son survol et l'accent sur fond doux d'un mode. En clair : l'accent s'assombrit tant qu'il ne tient pas 4,6:1 sur la carte et sur le fond ; en sombre il s'éclaircit.
function accentsOf(mode, seed, G, soft) {
  if (mode === 'clair') {
    const accent = settle({ ...seed }, -0.004, hex => [G['--surface'], G['--bg']].every(back => contrast(hex, back) >= MIN_TEXT));
    const hover = oklchToHex({ L: Math.max(0.2, accent.L - 0.075), C: seed.C * 0.9, h: seed.h });
    const ink = settle({ L: Math.max(0.2, accent.L - 0.05), C: seed.C * 0.9, h: seed.h }, -0.004,
      hex => [G['--surface'], soft, G['--bg']].every(back => contrast(hex, back) >= MIN_TEXT)).hex;
    return { accent: accent.hex, hover, ink, moved: Math.abs(accent.L - seed.L) > 0.004 };
  }
  const accent = settle({ ...seed, L: clamp(seed.L, 0.66, 0.84) }, 0.004, hex => [G['--surface'], G['--surface-sunken'], G['--bg']].every(back => contrast(hex, back) >= MIN_TEXT));
  const ink = settle({ L: Math.max(accent.L + 0.05, 0.72), C: seed.C * 0.8, h: seed.h }, 0.004, hex => [G['--surface'], soft].every(back => contrast(hex, back) >= MIN_TEXT)).hex;
  return { accent: accent.hex, hover: ink, ink, moved: false };
}

// Les jetons d'un mode.
function modeColors(spec, mode, seed, fill, custom, scale) {
  const { out: G, h, k } = grays(spec, mode, seed);
  const [softL, softC, softBL, softBC] = spec.soft[mode];
  const softScale = spec.seeds && !custom ? 1 : scale;
  const soft = oklchToHex({ L: softL, C: clamp(softC * softScale, 0.004, 0.1), h: seed.h });
  const softBorder = oklchToHex({ L: softBL, C: clamp(softBC * softScale, 0.008, 0.14), h: seed.h });
  const found = accentsOf(mode, seed, G, soft);
  const [muted, mutedChroma] = spec.grays[mode]['--text-muted'];
  const mutedBackgrounds = [G['--surface'], G['--surface-sunken'], G['--bg'], soft];
  G['--text-muted'] = settle({ L: muted, C: mutedChroma * k, h }, mode === 'clair' ? -0.004 : 0.004, hex => mutedBackgrounds.every(back => contrast(hex, back) >= MIN_TEXT)).hex;
  // Le décor : deux autres teintes pour le filet, et le bout du dégradé du bouton (lisible sous le texte du bouton).
  const turn = degrees => (seed.h + degrees + 360) % 360;
  const { dh2, dh3, dhEnd } = spec.second;
  const end = settle({ L: fill.seed.L, C: Math.max(fill.seed.C, 0.12), h: turn(dhEnd) }, fill.step, hex => contrast(hex, fill.ink) >= MIN_FILL).hex;
  const colors = {
    ...G, '--accent': found.accent, '--accent-hover': found.hover, '--accent-solid': fill.base, '--accent-solid-hover': fill.hover, '--on-accent': fill.ink,
    '--accent-ink': found.ink, '--accent-soft': soft, '--accent-soft-border': softBorder,
    '--accent-2': oklchToHex({ L: mode === 'clair' ? 0.72 : 0.76, C: 0.16, h: turn(dh2) }), '--accent-3': oklchToHex({ L: mode === 'clair' ? 0.68 : 0.74, C: 0.12, h: turn(dh3) }), '--accent-end': end,
    '--hard': mode === 'clair' ? G['--border-strong'] : found.accent,
  };
  return { colors, moved: found.moved };
}

// Rend { clair, sombre, forme, ajustee, graine } ; `customHex` : la couleur libre de la personne (`#rrggbb`), qui remplace la couleur de l'ambiance sans toucher à sa forme. `ajustee` dit qu'une couleur
// a dû être éclaircie ou assombrie pour que le texte reste lisible. Rend `null` quand rien ne s'écrit : l'ambiance d'origine, sans couleur choisie.
export function ambiancePalette(id, customHex = null) {
  const spec = SPECS[id];
  const custom = customHex ? parseHex(customHex) : null;
  if (!spec || (!custom && !spec.seeds)) return null;
  const own = custom ? hexToOklch(custom) : null;
  const seeds = custom ? { clair: own, sombre: own } : spec.seeds;
  const fillSeed = own || spec.fill || seeds.clair;
  const surfaces = MODES.map(mode => oklchToHex({ L: spec.grays[mode]['--surface'][0], C: 0, h: 0 }));
  const fill = { ...fillOf(fillSeed, surfaces), seed: fillSeed };
  const scale = clamp(seeds.clair.C / REFERENCE_CHROMA, 0.02, 1.4);
  const result = { forme: FORME[id] || {}, ajustee: fill.moved, graine: custom || oklchToHex(seeds.clair) };
  for (const mode of MODES) {
    const { colors, moved } = modeColors(spec, mode, seeds[mode], fill, custom, scale);
    result[mode] = colors;
    // Une ambiance qui a sa propre couleur de bouton (Brut, Néon) ou une couleur libre dit seulement si le bouton a bougé : l'accent de lecture peut s'ajuster sans que la personne ait à le savoir.
    if (!spec.fill && !custom && moved) result.ajustee = true;
  }
  return result;
}

// [texte, fond] : ce que les feuilles de GFS posent l'un sur l'autre avec les jetons qu'une ambiance change, et dont le contraste est tenu à 4,5:1 au moins, y compris pour l'ambiance d'origine
// (test/ambiance.test.mjs). La fenêtre « Thème » annonce le plus faible.
export const TEXT_PAIRS = Object.freeze([
  ['--text', '--surface'], ['--text', '--bg'], ['--text', '--surface-sunken'], ['--text', '--accent-soft'],
  ['--text-muted', '--surface'], ['--text-muted', '--surface-sunken'], ['--text-muted', '--bg'], ['--text-muted', '--accent-soft'],
  ['--on-accent', '--accent-solid'], ['--on-accent', '--accent-solid-hover'], ['--on-accent', '--accent-end'],
  ['--accent-ink', '--surface'], ['--accent-ink', '--accent-soft'], ['--accent-ink', '--bg'],
].map(pair => Object.freeze(pair)));

// L'accent seul (une icône, un trait, un lien sur la carte) : le moteur le tient à 4,6:1 sur la carte et sur le fond, plus que la charte d'origine (4,2:1 sur le fond, où l'accent ne porte pas de texte).
export const ACCENT_PAIRS = Object.freeze([['--accent', '--surface'], ['--accent', '--bg']].map(pair => Object.freeze(pair)));

// Le plus faible contraste des paires de texte, dans les deux modes (de 1 à 21), pour un message ou un résultat de `ambiancePalette` ; une paire dont un jeton manque (l'ambiance d'origine n'a pas ceux
// du décor) est passée.
export function weakestContrast(palette) {
  let low = Infinity;
  for (const mode of MODES) {
    for (const [text, back] of TEXT_PAIRS) {
      if (palette[mode][text] && palette[mode][back]) low = Math.min(low, contrast(palette[mode][text], palette[mode][back]));
    }
  }
  return low;
}
