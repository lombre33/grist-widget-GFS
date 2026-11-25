// Les bibliothèques natives d'une app, rangées par fonction (contrats 2.6, point 14) : la personne choisit, par fonction (l'éditeur, l'export PDF, Word…), le
// CDN de l'app (le défaut) ou la copie figée que GFS garde de ces bibliothèques. Du code sans effet de bord : il lit le manifeste, les réglages et le
// catalogue, il rend ce que la fenêtre montre et ce que l'app reçoit. Le choix se range dans `modes` avec les modes des extensions, sous une clé
// `natif:<fonction>` : un id de fonction ne peut pas se confondre avec celui d'une extension.

import { lookup, resolveLibraries, MODES, DEFAULT_MODE } from './libraries.js';

export const NATIVE_PREFIX = 'natif:';
export const nativeKey = groupId => `${NATIVE_PREFIX}${groupId}`;
export const nativesOf = manifest => (manifest && Array.isArray(manifest.natives) ? manifest.natives : []);
export const modeOfGroup = (setting, groupId) => {
  const mode = setting && setting.modes && setting.modes[nativeKey(groupId)];
  return MODES.includes(mode) ? mode : DEFAULT_MODE;
};

const missingOf = (group, catalogue) => group.bibliotheques.filter(({ id, version }) => !lookup(catalogue, id, version)).map(({ id, version }) =>
  ({ id, version }));

// Une ligne par fonction pour la fenêtre : { group, libraries: [{ id, version, poids }], poids, missing, mode, inApp?, fixed? }. `mode` est le mode en
// vigueur : la copie figée seulement quand GFS a TOUTES les bibliothèques de la fonction (jamais servie à moitié) ; le choix retenu n'est pas modifié pour
// autant (rien ne s'écrit sans un geste de la personne).
export function nativeRows(manifest, setting, catalogue) {
  return nativesOf(manifest).map(group => {
    // la copie est dans l'app : GFS n'a rien à y vérifier ; sans CDN (`sansCdn`), elle est le seul mode et la personne n'a rien à choisir (`fixed`)
    if (group.copieDansApp === true) {
      const fixed = group.sansCdn === true;
      return { group, libraries: [], poids: group.poids, missing: [], mode: fixed ? 'vendorise' : modeOfGroup(setting, group.id), inApp: true, fixed };
    }
    const libraries = group.bibliotheques.map(({ id, version }) => ({ id, version, poids: (lookup(catalogue, id, version) || {}).poids || 0 }));
    const missing = missingOf(group, catalogue);
    return { group, libraries, poids: libraries.reduce((total, lib) => total + lib.poids, 0), missing,
      mode: missing.length ? DEFAULT_MODE : modeOfGroup(setting, group.id) };
  });
}

// Les fonctions dont la personne a choisi la copie figée **rangée dans l'app** (l'éditeur) : GFS ne les sert pas, il met leurs id dans l'adresse du cadre
// (`copie=editeur`, contrats 1.3) parce que la page de l'app doit connaître le choix avant la réponse de GFS ; il prend effet au prochain démarrage de l'app.
// Dans l'ordre du manifeste.
export function copiesInApp(manifest, setting) {
  if (!setting) return [];
  return nativesOf(manifest).filter(group => group.copieDansApp === true && (group.sansCdn === true || modeOfGroup(setting, group.id) !== DEFAULT_MODE)).map(
    group => group.id);
}

// Ce que l'app reçoit (5.2) : seules les bibliothèques des fonctions en copie figée, `{ "<id>": { version, src, integrite, forme } }` ; l'app charge les autres
// comme toujours, par ses propres adresses. `version` est celle de la copie : l'app ne la prend que si c'est celle que son code attend (sinon, son CDN).
// `base` : l'adresse de GFS, d'où part le chemin de la copie.
export function nativesState(manifest, setting, catalogue, base) {
  return copiesOf(manifest, setting, catalogue, base, row => row.mode !== DEFAULT_MODE);
}

// Le secours des bibliothèques natives que l'app charge par son CDN (5.2, point 14) : la même copie de GFS, `{ version, src, integrite, forme }`, pour chaque
// bibliothèque d'une fonction restée au CDN que le catalogue a (une qu'il n'a pas n'a pas de secours). L'éditeur, dont la copie est dans l'app, n'y est pas.
export function nativesSecours(manifest, setting, catalogue, base) {
  return copiesOf(manifest, setting, catalogue, base, row => row.mode === DEFAULT_MODE);
}

function copiesOf(manifest, setting, catalogue, base, wantsRow) {
  if (!setting) return {};
  const wanted = nativeRows(manifest, setting, catalogue).filter(row => wantsRow(row) && !row.inApp).flatMap(row => row.group.bibliotheques);
  const { libraries } = resolveLibraries(catalogue, wanted, () => 'vendorise', base);
  return Object.fromEntries(Object.entries(libraries).map(([id, { version, src, integrite, forme }]) => [id, { version, src, integrite, forme }]));
}
