// La reprise après un rechargement de la page (demande du porteur, 26/11 : « si un fichier d'app est ouvert, on rouvre le même fichier dans l'app ; si on était
// dans l'explorateur, on rouvre le même endroit »). Ici, ce qui ne touche pas la page : la forme du souvenir, la clé où le garder et la décision. Le
// souvenir n'est écrit que par js/broker/resume.js, sur l'onglet (`sessionStorage`) : jamais dans le document, jamais dans la vue de Grist.
//
// Le souvenir (une ligne de JSON, aucun contenu de fichier) :
//   { v: 1, who, lieu: 'fichier', key, name } l'app montre un fichier que GFS lui a fait ouvrir (`key` : « app:identifiant », comme la liste « Ouverts ») ;
//   { v: 1, who, lieu: 'explorateur', view, path }   l'explorateur est devant : la vue et, dans un dossier, son chemin ;
//   { v: 1, who, lieu: 'app' }                       une app est ouverte sans fichier que GFS connaisse (« Nouveau », la fenêtre des apps, l'arrivée par la
//                                                    vue :
//                                                    une page que l'app a choisie elle-même) : rien à rouvrir, l'arrivée est celle d'avant.
// `who` : l'adresse de la personne, '' quand GFS ne la connaît pas : un autre compte, dans le même onglet, ne reçoit pas le souvenir de l'autre.

import { folderPaths, pathParts } from '../explorer/explorer-model.js';
import { PLACE_VIEWS } from '../explorer/explorer-place.js';

export const MEMORY_PREFIX = 'gfs.rouvrir.';
const PLACES = new Set(['fichier', 'explorateur', 'app']);
const PIECE = /^[A-Za-z0-9_~-]{1,64}$/;
const MOST = 300; // la plus longue valeur de texte qu'un souvenir garde : un nom, un chemin de dossier

const text = value => typeof value === 'string' && value.length <= MOST;

// La clé du souvenir : le document et la table de la section (Grist ne dit pas au widget laquelle est sa section : js/broker/context.js). Deux GFS sur la même
// table, dans un même onglet, partagent donc le souvenir. `null` quand le document ou la table manque : rien ne se retient, l'arrivée est celle d'avant.
export function slotKey(doc, table) {
  return typeof doc === 'string' && PIECE.test(doc) && typeof table === 'string' && PIECE.test(table) ? `${MEMORY_PREFIX}${doc}.${table}` : null;
}

// Le souvenir lu sur l'onglet, ou `null` : un texte que GFS n'a pas écrit (une main, une version à venir) est tenu pour absent.
export function parseMemory(raw) {
  if (typeof raw !== 'string') return null;
  let found;
  try { found = JSON.parse(raw); } catch (error) { return null; }
  if (!found || typeof found !== 'object' || found.v !== 1 || !PLACES.has(found.lieu) || !text(found.who)) return null;
  if (found.lieu === 'fichier') return text(found.key) && found.key && text(found.name) ? found : null;
  if (found.lieu === 'explorateur') return PLACE_VIEWS.includes(found.view) && text(found.path) ? found : null;
  return found;
}

export const serializeMemory = record => JSON.stringify(record);

// Faut-il la liste des fichiers pour décider ? Un fichier se vérifie dans la liste (sans elle, Publipostage+ lancée sur un numéro qui n'existe plus, ou que les
// règles d'accès cachent, ouvre une page blanche, mesuré le 26/11) ; un dossier, pour savoir qu'il existe encore. Les autres vues n'ont rien à vérifier : la
// page n'attend rien.
export const needsList = memory => memory.lieu === 'fichier' || (memory.lieu === 'explorateur' && memory.view === 'folder' && memory.path !== '');

// Le dossier le plus profond du chemin qui existe encore (un dossier vidé, renommé ou retiré ramène au dossier du dessus, jusqu'à la racine).
function nearestFolder(path, existing) {
  const known = new Set(existing);
  const parts = pathParts(path);
  for (let at = parts.length - 1; at >= 0; at--) if (known.has(parts[at].path)) return parts[at].path;
  return '';
}

// Ce que la reprise fait, d'après le souvenir et la liste des fichiers que la page vient de lire :
//   { kind: 'file', file }                    rouvrir ce fichier ;
//   { kind: 'place', place }                  montrer l'explorateur à cet endroit ;
//   { kind: 'missing', why, name }            le fichier ne s'ouvre plus : `gone` (il n'existe plus, la corbeille l'a pris, le partage est retiré : la liste de
//                                             la
//                                             personne ne le montre plus) ou `locked` (son app n'est plus installée, son extension est éteinte, l'accès ne
//                                             suffit
//                                             plus) ; l'arrivée est celle d'avant, avec une phrase ;
//   { kind: 'none' }                          rien à reprendre : l'arrivée est celle d'avant, sans phrase.
// ctx : { who (l'adresse de la personne), files, folders (les fichiers vivants et les dossiers gardés sans fichier), locale, lockOf(file) }.
export function decide(memory, { who, files, folders, locale, lockOf }) {
  if (!memory || memory.lieu === 'app') return { kind: 'none' };
  if (memory.lieu === 'explorateur') {
    const sure = memory.view === 'folder' && memory.path !== '' && memory.who === who && files.length > 0;
    return { kind: 'place', place: { view: memory.view, path: sure ? nearestFolder(memory.path, folderPaths(files, locale, folders)) : '' } };
  }
  // Une liste vide ne dit pas que le fichier n'existe plus (une lecture qui a échoué la rend vide aussi) ; une autre personne n'a pas ce souvenir.
  if (memory.who !== who || files.length === 0) return { kind: 'none' };
  const file = files.find(item => item.key === memory.key);
  if (!file) return { kind: 'missing', why: 'gone', name: memory.name };
  if (lockOf(file)) return { kind: 'missing', why: 'locked', name: file.name || memory.name };
  return { kind: 'file', file };
}
