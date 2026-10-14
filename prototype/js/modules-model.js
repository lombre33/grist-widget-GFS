// Ce que la fenêtre « Apps et extensions » montre (cahier 6, contrats 7.3) : une ligne par app du catalogue, puis une par extension de cette app.
// Une app dont le manifeste est invalide reste dans la liste, grisée, avec le motif (contrats 2.1, point 3). Du code sans effet de bord.

import { extensionRows } from './extensions.js';

// `loaded` : le résultat de loadAll ({ app, manifest, ok, errors }) ; `settings` : { apps } ; `always` : les apps qui ne se retirent pas.
// Rend { items, active, total } ; `active` et `total` comptent les apps et les extensions.
export function modulesModel(loaded, settings, catalogue, always) {
  const items = [];
  for (const item of loaded) {
    if (!item.ok) {
      items.push({ kind: 'app', id: item.app.id, manifest: item.manifest, ok: false, errors: item.errors, installed: false, always: false });
      continue;
    }
    const manifest = item.manifest;
    const setting = settings.apps[manifest.id];
    items.push({ kind: 'app', id: manifest.id, manifest, ok: true, errors: [], installed: Boolean(setting), always: always.includes(manifest.id) });
    for (const row of extensionRows(manifest, setting, catalogue)) items.push({ kind: 'ext', app: manifest.id, appInstalled: Boolean(setting), ...row });
  }
  const valid = items.filter(item => item.kind === 'ext' || item.ok);
  const active = valid.filter(item => (item.kind === 'app' ? item.installed : item.checked && item.appInstalled)).length;
  return { items, active, total: valid.length };
}
