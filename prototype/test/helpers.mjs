// Outils communs des tests : les manifestes provisoires du prototype, lus tels quels.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePolicy } from '../js/filter.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
export const publipostage = () => readJson('manifestes/publipostage.json');
export const automation = () => readJson('manifestes/automation.json');
export const form = () => readJson('manifestes/form.json');
export const catalogue = () => [publipostage(), automation(), form()];
export const policyOf = manifest => makePolicy(manifest, catalogue());

// Le contraste de deux couleurs `#rrggbb` (WCAG 2, de 1 à 21), écrit à part du code qui le calcule (js/oklch.js) : c'est l'étalon des essais de contraste.
const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
