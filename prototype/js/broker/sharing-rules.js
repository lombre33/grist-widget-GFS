// Les deux gestes de partage qu'une app peut demander quand son manifeste déclare `permissions.partage` (contrats 3.3, point 6 : l'exception ; 3.4, point 8) :
// poser le partage d'une page (une ligne de `_grist_Shares`, puis la colonne `shareRef` de la page) et le rouvrir. Du code sans effet de bord : il juge la
// FORME des actions ; ce que le document contient (le partage est-il neuf ? la page porte-t-elle déjà un formulaire publié ?) est jugé par
// js/broker/sharing.js.
//
// Rien de ceci n'ouvre quoi que ce soit au public : un formulaire ne s'ouvre que par `shareOptions`, qui passe par l'accord de la personne
// (js/broker/publication.js, contrats 3.3 point 9). Les formes permises sont celles du bouton « Publier » de Grist (app/client/components/Forms/FormView.ts, lu
// dans la 1.7.19) : rien de plus.

const LINK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isRowId = value => Number.isInteger(value) && value > 0;
const hasKeys = (object, keys) => isObject(object) && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));

// Les options d'un partage, en objet, ou null.
export function parseJson(text) {
  if (typeof text !== 'string') return null;
  try { const value = JSON.parse(text); return isObject(value) ? value : null; } catch { return null; }
}

// Une ligne de `_grist_Shares` : ajoutée avec un `linkId` à elle et `{"publish":true}`, ou mise à jour pour `options` seulement.
function shareRowRefusal(verb, [tableId, rowId, values]) {
  if (verb === 'AddRecord') {
    if (rowId !== null && rowId !== undefined) return `AddRecord ${tableId} : le numéro de la ligne est celui que Grist donne.`;
    if (!hasKeys(values, ['linkId', 'options'])) return `AddRecord ${tableId} : la ligne porte linkId et options, et rien d'autre.`;
    if (typeof values.linkId !== 'string' ||
      !LINK_ID_RE.test(values.linkId)) return `AddRecord ${tableId} : linkId est un identifiant de 8 à 64 caractères (lettres, chiffres, « - » et « _ »).`;
    const options = parseJson(values.options);
    return hasKeys(options, ['publish']) && options.publish === true ? null : `AddRecord ${tableId} : options vaut {"publish":true} et rien d'autre.`;
  }
  if (verb === 'UpdateRecord') {
    if (!isRowId(rowId)) return `UpdateRecord ${tableId} : le numéro de la ligne est attendu.`;
    if (!hasKeys(values, ['options'])) return `UpdateRecord ${tableId} : options seulement.`;
    const options = parseJson(values.options);
    return hasKeys(options, ['publish']) && typeof options.publish === 'boolean' ? null :
      `UpdateRecord ${tableId} : options vaut {"publish":true} ou {"publish":false}, et rien d'autre.`;
  }
  return `${verb} ne vise pas ${tableId} : AddRecord et UpdateRecord seulement (un partage ne se retire pas).`;
}

// La colonne `shareRef` d'une page : écrite seule, dans son propre UpdateRecord, vers un partage (détacher un partage n'est pas permis).
function pageShareRefusal(verb, [tableId, rowId, values]) {
  if (verb !== 'UpdateRecord') return `${verb} ne vise pas shareRef de ${tableId} : UpdateRecord seulement.`;
  if (!isRowId(rowId)) return `UpdateRecord ${tableId} : le numéro de la page est attendu.`;
  if (!hasKeys(values, ['shareRef'])) return `shareRef de ${tableId} s'écrit seule, dans son propre UpdateRecord.`;
  return isRowId(values.shareRef) ? null : `shareRef de ${tableId} : le numéro d'un partage (détacher un partage n'est pas permis).`;
}

// Une action écrit-elle `shareRef` ? (dans l'un ou l'autre des objets de valeurs : `require` et `col_values` des verbes « ajouter ou mettre à jour » compris)
export const writesShareRef = args => [args[1], args[2]].some(part => isObject(part) && Object.hasOwn(part, 'shareRef'));

// `tableKey` : le nom de la table en minuscules, avec son « _ » de tête. Rend null (permis dans sa forme), un texte (refus) ou `undefined` (ce n'est pas un
//   geste de partage : le filtre juge l'action comme n'importe quelle écriture dans une table interne).
export function sharingRefusal(verb, tableKey, args) {
  if (tableKey === '_grist_shares') return shareRowRefusal(verb, args);
  if (tableKey === '_grist_pages' && writesShareRef(args)) return pageShareRefusal(verb, args);
  return undefined;
}
