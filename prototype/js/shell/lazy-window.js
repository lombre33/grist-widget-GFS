// Les fenêtres que presque personne n'ouvre au démarrage (« Thème », « Dépendances », « Partager », « Gérer ») : leur code ne se charge qu'au premier clic,
// comme le module Annuaire (js/shell/annuaire-entry.js). L'audit du 25/11 relevait 202 fichiers préchargés à chaque ouverture du widget. `load()` rend le
// module (`import('…')`), `open(module)` ouvre la fenêtre et rend ce qu'elle rend (la promesse de sa fermeture, pour « Partager »). Seul un module qui ne se
// charge pas (le réseau, un fichier absent) se dit à la personne, sans rien casser : une erreur de la fenêtre elle-même garde son chemin. `c` : ce qui sait
// dire un texte et le montrer (`t`, `notice`) : le contrôleur, ou les options d'un contrôle.
export async function openLazily(c, name, load, open) {
  let loaded;
  try {
    loaded = await load();
  } catch (error) {
    console.error(`GFS : la fenêtre « ${name} » ne se charge pas`, error);
    if (c.notice) c.notice(c.t('gfs.windowLoadFailed'));
    return undefined;
  }
  return open(loaded);
}
