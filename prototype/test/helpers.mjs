// Outils communs des tests : les manifestes provisoires du prototype, lus tels quels.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePolicy } from '../js/filter.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
export const publipostage = () => readJson('manifestes/publipostage.json');
export const automation = () => readJson('manifestes/automation.json');
export const catalogue = () => [publipostage(), automation()];
export const policyOf = manifest => makePolicy(manifest, catalogue());
