// Ce que GFS retient dans les réglages de la section (contrats 7.4, défaut de la question 9) : `gfs.apps`, un objet
// `{ "<id>": { "extensions": [ "…" ], "modes": { "<extension>": "cdn" | "vendorise" } } }`. `modes` est facultatif (le défaut est le CDN) :
// proposé par le prototype, d'après la question 11 du cahier (le mode se retient par extension).
// Du code sans effet de bord : il lit, il rend de nouveaux objets ; le contrôleur écrit, et seulement sur un geste de la personne.

import { extensionsOf } from './extensions.js';
import { MODES, DEFAULT_MODE } from './libraries.js';

export const APPS_KEY = 'gfs.apps';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// L'état d'une app installée, borné par son manifeste : seules ses extensions déclarées, seuls les modes connus.
function cleanApp(manifest, raw) {
  const wanted = isObject(raw) && Array.isArray(raw.extensions) ? raw.extensions : [];
  const known = extensionsOf(manifest).map(ext => ext.id);
  const extensions = known.filter(id => wanted.includes(id));
  const modes = {};
  if (isObject(raw) && isObject(raw.modes)) {
    for (const id of extensions) if (MODES.includes(raw.modes[id]) && raw.modes[id] !== DEFAULT_MODE) modes[id] = raw.modes[id];
  }
  return { extensions, modes };
}

// `manifests` : Map(id -> manifeste valide) ; `always` : les apps qui ne se retirent pas (provisoire : Publipostage+, comme dans la maquette).
// Rend { apps: { id: { extensions, modes } }, stored } : `stored` dit si la section porte déjà `gfs.apps`.
export function readApps(allOptions, manifests, always) {
  const raw = isObject(allOptions) ? allOptions[APPS_KEY] : undefined;
  const stored = isObject(raw);
  const apps = {};
  for (const id of always) if (manifests.has(id)) apps[id] = cleanApp(manifests.get(id), stored ? raw[id] : undefined);
  if (stored) for (const [id, entry] of Object.entries(raw)) if (manifests.has(id)) apps[id] = cleanApp(manifests.get(id), entry);
  return { apps, stored };
}

// La valeur à écrire dans `gfs.apps` : sans `modes` quand il est vide, dans l'ordre du catalogue (une écriture ne change que ce qui a changé).
export function toOption(apps, order) {
  const out = {};
  for (const id of order) {
    if (!Object.hasOwn(apps, id)) continue;
    const { extensions, modes } = apps[id];
    out[id] = Object.keys(modes).length ? { extensions: [...extensions], modes: { ...modes } } : { extensions: [...extensions] };
  }
  return out;
}

// Installer, retirer, activer une extension, changer son mode : chacun rend un nouvel objet `apps`.
export function withApp(apps, manifest, on) {
  const next = { ...apps };
  if (on) next[manifest.id] = next[manifest.id] || { extensions: [], modes: {} };
  else delete next[manifest.id];
  return next;
}

export function withExtension(apps, manifest, extensionId, on) {
  const current = apps[manifest.id];
  if (!current) return apps;
  const wanted = new Set(current.extensions);
  if (on) wanted.add(extensionId); else wanted.delete(extensionId);
  return { ...apps, [manifest.id]: cleanApp(manifest, { extensions: [...wanted], modes: current.modes }) };
}

export function withMode(apps, manifest, extensionId, mode) {
  const current = apps[manifest.id];
  if (!current || !MODES.includes(mode)) return apps;
  return { ...apps, [manifest.id]: cleanApp(manifest, { extensions: current.extensions, modes: { ...current.modes, [extensionId]: mode } }) };
}
