// Ce que GFS retient des apps installées (contrats 7.4) : un objet `{ "<id>": { "extensions": [ "…" ], "modes": { "<extension>": "cdn" | "vendorise" } } }`,
// rangé en JSON dans la ligne réservée `@document` / `gfs` / `apps` de la table `GFS_Rangement` (rangement.js). `modes` est facultatif (le défaut est
// le CDN) : proposé par le prototype, d'après la question 11 du cahier (le mode se retient par extension).
// Du code sans effet de bord : il lit, il rend de nouveaux objets ; le contrôleur écrit, et seulement sur un geste de la personne.

import { extensionsOf } from './extensions.js';
import { MODES, DEFAULT_MODE } from './libraries.js';

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

// `raw` : la valeur retenue dans la table (un objet), ou null ; `manifests` : Map(id -> manifeste valide) ; `always` : les apps qui ne se retirent
// pas (provisoire : Publipostage+, comme dans la maquette). Rend { apps: { id: { extensions, modes } }, stored } : `stored` dit si le document a déjà retenu ses apps.
export function readApps(raw, manifests, always) {
  const stored = isObject(raw);
  const apps = {};
  for (const id of always) if (manifests.has(id)) apps[id] = cleanApp(manifests.get(id), stored ? raw[id] : undefined);
  if (stored) for (const [id, entry] of Object.entries(raw)) if (manifests.has(id)) apps[id] = cleanApp(manifests.get(id), entry);
  return { apps, stored };
}

// La valeur à écrire pour des apps : sans `modes` quand il est vide, dans l'ordre du catalogue. Sert de point de départ au premier enregistrement.
export function toOption(apps, order) {
  const out = {};
  for (const id of order) {
    if (!Object.hasOwn(apps, id)) continue;
    const { extensions, modes } = apps[id];
    out[id] = Object.keys(modes).length ? { extensions: [...extensions], modes: { ...modes } } : { extensions: [...extensions] };
  }
  return out;
}

// La valeur relue, avec la seule entrée de `id` remplacée par `entry` (ou retirée quand `entry` est null) : tout ce que cette version de GFS ne connaît
// pas (une app, une extension, un mode, un champ qu'une version plus récente a ajoutés) est gardé tel quel (contrats 6.5, point 4).
// `seed` : ce que l'on écrit quand rien n'est encore retenu.
export function patchApps(raw, id, entry, manifest, seed = {}) {
  const base = isObject(raw) ? { ...raw } : { ...seed };
  if (!entry) { delete base[id]; return base; }
  const before = isObject(base[id]) ? base[id] : {};
  const known = new Set(extensionsOf(manifest).map(ext => ext.id));
  const keptExtensions = Array.isArray(before.extensions) ? before.extensions.filter(ext => !known.has(ext)) : [];
  const keptModes = isObject(before.modes) ? Object.entries(before.modes).filter(([ext]) => !known.has(ext)) : [];
  const modes = { ...Object.fromEntries(keptModes), ...entry.modes };
  const next = { ...before, extensions: [...entry.extensions, ...keptExtensions] };
  if (Object.keys(modes).length) next.modes = modes; else delete next.modes;
  base[id] = next;
  return base;
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
