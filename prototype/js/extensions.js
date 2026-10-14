// Les extensions d'une app (contrats 2.6) : lesquelles sont actives, ce que leur code exige, lesquelles sont grisées et pourquoi.
// Du code sans effet de bord : le contrôleur et la fenêtre « Modules » s'en servent, aucun ne recalcule cela de son côté.

import { lookup, resolveLibraries, forContext, DEFAULT_MODE } from './libraries.js';

export const extensionsOf = manifest => (manifest && manifest.extensions) || [];
export const findExtension = (manifest, id) => extensionsOf(manifest).find(ext => ext.id === id) || null;

// Ce que le code d'une extension exige : [{ id, version }] (2.6, point 5).
export const requirementsOf = extension => (extension.bibliotheques || []).map(({ id, version }) => ({ id, version }));

// Les bibliothèques exigées qui manquent au catalogue (identifiant ou version) : l'extension est grisée avec cette raison (2.6, point 6).
export const missingLibraries = (extension, catalogue) => requirementsOf(extension).filter(({ id, version }) => !lookup(catalogue, id, version));

// Les extensions réellement actives d'une app : cochées ET servables. `setting` : { extensions, modes } de l'app, ou rien (app non installée).
export function activeExtensionIds(manifest, setting, catalogue) {
  const wanted = new Set((setting && setting.extensions) || []);
  return extensionsOf(manifest).filter(ext => wanted.has(ext.id) && !missingLibraries(ext, catalogue).length).map(ext => ext.id);
}

// Les bibliothèques que les extensions actives exigent, sans doublon : [{ id, version }].
export function libraryNeeds(manifest, activeIds) {
  const seen = new Map();
  for (const id of activeIds) {
    const ext = findExtension(manifest, id);
    for (const need of ext ? requirementsOf(ext) : []) seen.set(`${need.id}@${need.version}`, need);
  }
  return [...seen.values()];
}

export const modeOfExtension = (setting, extensionId) => (setting && setting.modes && setting.modes[extensionId]) || DEFAULT_MODE;

// Une ligne par extension pour la fenêtre : { extension, checked, greyed, missing, mode, libraries: [{ id, version, poids }] }.
export function extensionRows(manifest, setting, catalogue) {
  return extensionsOf(manifest).map(extension => {
    const missing = missingLibraries(extension, catalogue);
    const libraries = requirementsOf(extension).map(({ id, version }) => ({ id, version, poids: (lookup(catalogue, id, version) || {}).poids || 0 }));
    return {
      extension, missing, libraries, greyed: missing.length > 0, mode: modeOfExtension(setting, extension.id),
      checked: Boolean(setting && (setting.extensions || []).includes(extension.id)) && !missing.length,
    };
  });
}

// Le mode de chaque bibliothèque que les extensions actives exigent : la copie de GFS dès qu'une seule extension active la demande
// (le choix est par extension, question 11 ; une bibliothèque n'est chargée qu'une fois, par un seul mode). Rend Map(id de bibliothèque -> mode).
export function libraryModes(manifest, setting, activeIds) {
  const modes = new Map();
  for (const id of activeIds) {
    const mode = modeOfExtension(setting, id);
    for (const { id: library } of requirementsOf(findExtension(manifest, id))) {
      if (mode === 'vendorise' || !modes.has(library)) modes.set(library, mode);
    }
  }
  return modes;
}

// Ce que l'app reçoit d'une app installée (contrats 5.2) : `extensions` et `bibliotheques` pour le message, `details` (mode, poids) pour GFS.
// `base` : l'adresse de GFS, d'où part le chemin de la copie vendorisée.
export function extensionsState(manifest, setting, catalogue, base) {
  const extensions = activeExtensionIds(manifest, setting, catalogue);
  const modes = libraryModes(manifest, setting, extensions);
  const { libraries } = resolveLibraries(catalogue, libraryNeeds(manifest, extensions), id => modes.get(id), base);
  return { extensions, bibliotheques: forContext(libraries), details: libraries };
}
