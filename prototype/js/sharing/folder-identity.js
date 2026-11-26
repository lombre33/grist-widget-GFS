// L'identité d'un dossier de « Moi » (contrats 11.7, point 13.n.g ; choix du porteur, 18/11 : « l'id de ligne de Grist ») : un dossier n'existe que par le
// texte du chemin que portent ses fichiers, donc un partage écrit avec ce texte se perdait au premier renommage. Un dossier partagé a désormais sa propre ligne
// d'état dans `GFS_Filing` (ni app ni fichier, le chemin en `Folder`), et c'est le **numéro de cette ligne** que le partage et le lien portent :
// `dossier:moi:<adresse>//<numéro>` (deux « / » de suite : un chemin n'en a jamais, aucun nom de dossier ne peut donc s'y confondre). Renommer ou déplacer le
// dossier change le texte de sa ligne, sur place ; le numéro, lui, reste. Du code pur : il lit les lignes que les appelants ont relues et rend les actions à
// écrire dans le même lot que le rangement.
//
// Les partages posés avant ce lot portent le chemin (`dossier:moi:<adresse>/<chemin>`) : la formule de Grist les lit toujours, et le premier renommage ou
// déplacement du dossier les convertit, par la personne à qui est le dossier (Grist la tient pour administratrice de ses propres partages).
// Piège mesuré (Grist 1.7.19) : Grist redonne le numéro de la dernière ligne supprimée à la ligne suivante ; un partage ne vaut donc que pour une ligne
// d'état de la même personne, et supprimer un dossier retire d'abord ses partages (même lot).

import { normalizePath, inside } from '../explorer/explorer-model.js';
import { PERSONAL_PREFIX, personalTarget, PLACE_TABLE, SHARES_TABLE } from './sharing-model.js';

const lower = text => String(text ?? '').trim().toLowerCase();
const rest = (identity, cible) => {
  const start = `${PERSONAL_PREFIX}${lower(identity)}/`;
  return identity && String(cible ?? '').startsWith(start) ? String(cible).slice(start.length) : null;
};

// La cible d'un dossier de « Moi » par le numéro de sa ligne d'état.
export const idKey = (identity, id) => `${PERSONAL_PREFIX}${lower(identity)}//${id}`;

// Le chemin que porte une cible ancienne (`dossier:moi:<adresse>/<chemin>`) de cette personne, ou null (la cible d'un autre, d'un espace, ou par numéro).
export function legacyPath(cible, identity) {
  const tail = rest(identity, cible);
  return tail === null || tail.startsWith('/') ? null : normalizePath(tail);
}

// Les cibles qui désignent le dossier `path` : par son chemin (partages anciens) et par chacune de ses lignes d'état (`rows` : [{ id, path }]).
export const keysOf = (identity, path, rows) => [personalTarget(identity, path), ...rows.filter(row => row.path === path).map(row => idKey(identity, row.id))];

// Les chemins des dossiers de `known` (ceux qui existent) à l'intérieur de `from` que porte un partage ou un lien à l'ancienne mode : à convertir au premier
// renommage. Un chemin qui ne nomme plus aucun dossier est laissé (rien ne le suit : il n'a pas de ligne à lui donner).
export function legacyPaths({ identity, from, known, shares = [], places = [] }) {
  const paths = [...shares.map(row => row.Target), ...places.map(row => row.Link)].map(cible => legacyPath(cible, identity));
  return [...new Set(paths.filter(path => path && inside(path, from) && known.includes(path)))].sort();
}

// Où va une ligne d'état quand `from` devient `to` : son chemin d'arrivée.
const arrival = (path, from, to) => normalizePath(`${to}/${path.slice(from.length)}`);

// Les lignes d'état qui arrivent sur le chemin d'un dossier qui existe déjà (fusion : « les fondre se fait en déplaçant ») : le dossier d'arrivée garde ses
// partages, ceux du dossier qui arrive ne le suivent pas (un dossier ne s'ouvre pas à d'autres personnes parce qu'on y a rangé un autre dossier). `known` : les
// dossiers qui existent, par leurs fichiers ou par leur ligne d'état.
function fusedRows(rows, from, to, known) {
  const staying = new Set(known.filter(path => !inside(path, from)));
  return rows.filter(row => inside(row.path, from) && staying.has(arrival(row.path, from, to)));
}

const linkIn = (places, keys) => places.some(row => keys.includes(row.Link));

// Ce que le dossier `from` qui devient `to` change aux partages et aux liens, dans le même lot que le rangement. Rend { refuse, extra, lost } :
// - `extra` : les actions sur `GFS_Shares` et `GFS_Placement` (les partages et liens à l'ancienne mode passent au numéro de leur ligne ; ceux d'un dossier
//   fondu dans un autre sont retirés) ;
// - `lost` : le nombre de partages retirés ;
// - `refuse` : la clé de la phrase quand un lien empêche le geste (un lien se change par un propriétaire : un dossier fondu qui en porte un, ou un lien à
//   l'ancienne mode quand la personne n'est pas propriétaire).
// `rows` : les lignes d'état de la personne, celles des chemins à convertir comprises.
export function relocationExtra({ identity, rows, from, to, known = [], shares = [], places = [], owner = false }) {
  const ctx = { identity, rows, from, fused: new Set(fusedRows(rows, from, to, known).map(row => row.id)) };
  const sharing = shares.map(row => followed(ctx, row, row.Target)).filter(Boolean);
  const linking = places.map(row => followed(ctx, row, row.Link)).filter(Boolean);
  const refuse = linking.some(({ fused, path }) => fused || (path && !owner)) ? 'ex.folderLinked' : null;
  const lost = sharing.filter(item => item.fused).length;
  const extra = [
    ...sharing.map(item => (item.fused ? ['RemoveRecord', SHARES_TABLE, item.row.id] : item.path && ['UpdateRecord', SHARES_TABLE, item.row.id,
      { Target: idKey(identity, item.found.id) }])),
    ...linking.map(item => !item.fused && item.path && ['UpdateRecord', PLACE_TABLE, item.row.id, { Link: idKey(identity, item.found.id) }])].filter(Boolean);
  return { refuse, extra: refuse ? [] : extra, lost };
}

// La ligne de partage ou de lien `row` (sa cible : `cible`) vise-t-elle un dossier du dossier déplacé ? Rend { row, found (sa ligne d'état), path (le chemin
// à l'ancienne mode, ou ''), fused (sa ligne disparaît dans un dossier qui existe déjà) }, ou null.
function followed({ identity, rows, from, fused }, row, cible) {
  const path = legacyPath(cible, identity);
  const found = path ? rows.find(item => item.path === path && inside(path, from)) :
    rows.find(item => idKey(identity, item.id) === cible && inside(item.path, from));
  return found ? { row, found, path: path || '', fused: fused.has(found.id) } : null;
}

// Ce que supprimer ces dossiers (`paths` : les chemins dont on retire la ligne d'état) change aux partages : leurs lignes de partage partent avec eux, dans le
// même lot (le numéro d'une ligne supprimée peut être redonné à une ligne neuve : un partage resté en place s'ouvrirait au dossier suivant). Un dossier
// qu'un lien montre ne se supprime pas : le lien se retire d'abord. Rend { refuse, extra, removed }.
export function removalExtra({ identity, rows, paths, shares = [], places = [] }) {
  const keys = paths.flatMap(path => keysOf(identity, path, rows));
  if (linkIn(places, keys)) return { refuse: 'ex.folderLinked', extra: [], removed: 0 };
  const gone = shares.filter(row => keys.includes(row.Target));
  return { refuse: null, extra: gone.map(row => ['RemoveRecord', SHARES_TABLE, row.id]), removed: gone.length };
}
