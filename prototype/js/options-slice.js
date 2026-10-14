// La tranche de réglages d'une app : les clés que son manifeste déclare, dans l'objet unique des réglages de la section (contrats 7.2).
// Du code sans effet de bord : il dit quoi lire, quoi écrire et quoi retirer ; le courtier fait les appels à Grist, clé par clé.

import { Refus, ERR } from './filter.js';

export const GFS_PREFIX = 'gfs.';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => value !== undefined;

// Ce que l'app voit : les clés déclarées présentes dans l'objet, ou null s'il n'y en a aucune (7.2, point 1).
export function sliceOf(allOptions, declaredKeys) {
  if (!isObject(allOptions)) return null;
  const slice = {};
  for (const key of declaredKeys) {
    if (present(allOptions[key])) slice[key] = allOptions[key];
  }
  return Object.keys(slice).length ? slice : null;
}

export function optionOf(allOptions, declaredKeys, key) {
  return declaredKeys.has(key) && isObject(allOptions) ? allOptions[key] : undefined;
}

// setOption(k, v) : la clé doit être déclarée, sinon GFS_CLE_NON_DECLAREE (7.2, point 2).
export function checkKey(declaredKeys, key) {
  if (typeof key !== 'string' || !declaredKeys.has(key)) {
    throw new Refus(ERR.CLE, `La clé de réglage « ${key} » n'est pas déclarée dans le manifeste de l'app.`);
  }
}

// setOptions(objet) : les clés déclarées de l'objet sont écrites, les clés déclarées absentes de l'objet sont retirées, les clés non
// déclarées sont ignorées (7.2, point 3). Rend { writes: [[clé, valeur]], removes: [clé], ignored: [clé] }.
export function planSetOptions(declaredKeys, current, incoming) {
  if (!isObject(incoming)) throw new Refus(ERR.REFUSE, 'Les réglages sont un objet.');
  const writes = [];
  const ignored = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (declaredKeys.has(key)) writes.push([key, value]);
    else ignored.push(key);
  }
  const written = new Set(writes.map(([key]) => key));
  const removes = [...declaredKeys].filter(key => !written.has(key) && isObject(current) && present(current[key]));
  return { writes, removes, ignored };
}

// clearOptions() : les clés déclarées de l'app, rien d'autre (7.2, point 4).
export function planClear(declaredKeys, current) {
  return [...declaredKeys].filter(key => isObject(current) && present(current[key]));
}

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]));
}

// Un événement de réglages dont la tranche n'a pas changé n'est pas transmis à l'app (4.2, point 3).
export const sliceChanged = (previous, next) => !same(previous, next);

// Les clés de GFS : tout ce qui commence par « gfs. » (7.1, point 3).
export function gfsPart(allOptions) {
  const out = {};
  if (isObject(allOptions)) {
    for (const [key, value] of Object.entries(allOptions)) {
      if (key.startsWith(GFS_PREFIX) && present(value)) out[key] = value;
    }
  }
  return out;
}
