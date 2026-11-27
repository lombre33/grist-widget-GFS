// L'empreinte de ce qu'une lecture des fichiers a rendu (js/explorer/files-reading.js) : deux lectures qui donnent la même empreinte donnent la même liste, et
// la relecture automatique (js/explorer/live-list.js) ne redessine alors rien. Elle ne porte que ce que la liste montre ou en déduit : les noms, les dossiers,
// les espaces, les dates, le poids, l'apparence des dossiers, les arrivées d'un autre document et les apps illisibles. `typeInfo` et `search` se déduisent du
// reste (le manifeste, le nom), `pieces` aussi (le poids les compte).
const SKIPPED = new Set(['typeInfo', 'search', 'pieces']);
const drop = (key, value) => (SKIPPED.has(key) ? undefined : value);

export function listSignature({ files, trash, folders, received, spaces, notices, problems, shortcutFiles, looks }) {
  const places = spaces ? [spaces.spaces, spaces.links, [...spaces.placed]] : null;
  const told = notices ? [notices.shares, notices.data] : null; // les partages lisibles et les notifications : ce que la cloche annonce
  return JSON.stringify([files, trash, folders, received, places, told, problems, shortcutFiles || [], looks ? [...looks] : []], drop);
}
