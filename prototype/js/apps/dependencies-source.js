// La source d'une bibliothèque, depuis la fenêtre « Dépendances » (demande du porteur, 18/11 : « le plus d'options possible sur les dépendances »). Le choix
// n'est pas par bibliothèque : il est par fonction (une extension d'une app, ou une fonction native d'une app, contrats 2.6 points 12 et 14), et la fiche de
// l'app l'écrit déjà. Ce fichier lit les mêmes lignes du modèle des apps (`modulesModel`), dit pour chaque fonction ce qui se peut choisir, et prépare la même
// écriture : un choix par bibliothèque vaut pour chaque fonction qui l'utilise, un choix pour toutes vaut pour chaque fonction qui se peut. Du code sans effet de
// bord : l'écriture se fait par `AppsState.setSources`, sur un geste de la personne.

import { DEFAULT_MODE, MODES } from './libraries.js';
import { label } from './manifest.js';

export const COPY_MODE = 'vendorise';

// Pourquoi le choix d'une extension est grisé, ou null : l'app n'est pas installée, une bibliothèque manque, l'extension n'est pas ajoutée, ou elle n'a rien à charger.
const extensionWhy = item => {
  if (!item.appInstalled) return 'app';
  if (item.greyed) return 'missing';
  if (!item.checked) return 'off';
  return (item.libraries || []).length ? null : 'none';
};

// Une extension : sa source est un choix par extension. Sans CDN pour l'une de ses bibliothèques, elle n'a que la copie de GFS ; grisée tant que l'app
// n'est pas installée, que l'extension n'est pas ajoutée, ou qu'une bibliothèque manque. `libraries` : les id des bibliothèques de la fonction.
export const extensionUnit = (item, names, lang) => ({ key: `${item.app}|extension|${item.extension.id}`, app: item.app, kind: 'extension',
  target: item.extension.id, appName: names.get(item.app) || item.app, what: label(item.extension.nom, lang),
  mode: item.mode || DEFAULT_MODE, canCdn: !item.noCdn, canCopy: true, refused: Boolean(item.cdnRefused),
  why: extensionWhy(item), libraries: (item.libraries || []).map(lib => lib.id) });

// Une fonction native : la copie de GFS n'existe que quand GFS a toutes ses bibliothèques ; le CDN est celui de l'app.
export const nativeUnit = (app, row, names, lang) => ({ key: `${app.id}|native|${row.group.id}`, app: app.id, kind: 'native', target: row.group.id,
  appName: names.get(app.id) || app.id, what: label(row.group.nom, lang), mode: row.mode || DEFAULT_MODE, canCdn: true,
    canCopy: !(row.missing && row.missing.length), refused: false, why: app.installed ? null : 'app',
  libraries: (row.libraries || []).map(lib => lib.id) });

// Le nom de chaque app valide, dans la langue : Map(id -> nom).
export const appNames = (modules, lang) => new Map(modules.items.filter(item => item.kind === 'app' &&
  item.ok).map(item => [item.id, label(item.manifest.nom, lang)]));

// Toutes les fonctions du modèle, sans doublon : { key -> unité }. Les fonctions natives dont la copie est dans l'app y sont aussi (aucune bibliothèque de GFS,
// mais « tout en copie figée » les prend).
export function allUnits(modules, lang) {
  const names = appNames(modules, lang);
  const units = new Map();
  for (const item of modules.items) {
    if (item.kind === 'ext') units.set(extensionUnit(item, names, lang).key, extensionUnit(item, names, lang));
    else if (item.kind === 'app' && item.ok) for (const row of item.natives || []) units.set(nativeUnit(item, row, names, lang).key,
      nativeUnit(item, row, names, lang));
  }
  return units;
}

// Ce qui s'écrit pour amener ces fonctions à `mode` : une liste par app, { app, appName, extensions: [id], natives: [id], names: [nom de la fonction] },
// seulement des fonctions qui se peuvent et qui changent. Vide quand rien ne change.
export function planFor(units, mode) {
  const byApp = new Map();
  if (!MODES.includes(mode)) return [];
  for (const unit of new Map([...units].map(one => [one.key, one])).values()) {
    if (unit.why !== null || unit.mode === mode || !(mode === DEFAULT_MODE ? unit.canCdn : unit.canCopy)) continue;
    const entry = byApp.get(unit.app) || { app: unit.app, appName: unit.appName, extensions: [], natives: [], names: [] };
    entry[unit.kind === 'extension' ? 'extensions' : 'natives'].push(unit.target);
    entry.names.push(unit.what);
    byApp.set(unit.app, entry);
  }
  return [...byApp.values()];
}

export const planSize = plan => plan.reduce((total, entry) => total + entry.extensions.length + entry.natives.length, 0);

// Ce que la ligne d'une bibliothèque propose : `mode` (la source de toutes ses fonctions, ou null quand elles diffèrent), `units`, `open` (celles qui se
// choisissent), `can` (ce qui est offert), `why` (les raisons de ce qui est grisé), `follow` (les autres bibliothèques d'une fonction : elles suivent).
export function sourceOf(row) {
  const units = [...new Map(row.uses.filter(use => use.unit).map(use => [use.unit.key, use.unit])).values()];
  const open = units.filter(unit => unit.why === null);
  const modes = new Set(units.map(unit => unit.mode));
  const files = new Set(row.files.map(file => file.id));
  return { units, open, mode: modes.size === 1 ? [...modes][0] : null,
    can: { cdn: open.some(unit => unit.canCdn), [COPY_MODE]: open.some(unit => unit.canCopy) },
    why: [...new Set(units.map(unit => unit.why).filter(Boolean))], refused: units.some(unit => unit.refused && unit.mode === DEFAULT_MODE),
    follow: [...new Set(units.flatMap(unit => unit.libraries).filter(id => !files.has(id)))] };
}
