// Les notifications de GFS (étude du 25/11, choix du porteur : la cloche annonce d'abord « ce qu'on me partage » ; « lu » dans une table du document) : la
// table `GFS_Notifications`, ses règles d'accès, et le calcul de ce qui est donné à la personne. Code pur : rien ne lit ni n'écrit ici
// (js/sharing/notice-store.js).
//
// Une ligne de la table dit « cette personne a été prévenue de cela » : `Pour` (son adresse), `Type` (fichier, dossier, espace), `Cible` (la clé de ce qui est
// donné), `Par` (qui l'a donné), `Cle` (`type|cible`, pour ne la dire qu'une fois), `Quand` (posé par Grist à la création, jamais par GFS), `Lu`. Chaque
// personne écrit SES lignes, jamais celles d'un autre : GFS n'écrit rien pour quelqu'un d'autre, et un éditeur ne peut pas forger la notification d'un autre
// (mesuré dans un vrai Grist, faits vérifiés 179). Un lecteur (rôle « lecteur » de Grist) n'écrit rien : son « lu » reste dans son navigateur.

export const NOTICES_TABLE = 'GFS_Notifications';
export const NOTICE_TYPES = Object.freeze(['fichier', 'dossier', 'espace']);

const lower = value => String(value ?? '').trim().toLowerCase();

// Les colonnes de la table. `Quand` est écrit par Grist (une formule déclenchée à la création : GFS ne choisit pas l'heure de ce qu'il note).
export const noticeColumns = () => [
  { id: 'Pour', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'Cible', type: 'Text' }, { id: 'Par', type: 'Text' }, { id: 'Cle', type: 'Text' },
  { id: 'Quand', type: 'DateTime:UTC', isFormula: false, formula: 'NOW()', recalcWhen: 0, recalcDeps: null }, { id: 'Lu', type: 'Bool' },
];

// Les colonnes que personne ne change après la création (sauf un propriétaire), et celle que chacun change pour ses lignes : « Lu ».
export const NOTICE_FIXED = 'Pour,Type,Cible,Par,Cle,Quand';
export const NOTICE_READ = 'Lu';

const mine = 'user.Email and rec.Pour and rec.Pour.lower() == user.Email.lower()';
const mineNew = 'user.Email and newRec.Pour and newRec.Pour.lower() == user.Email.lower()';

// Les règles, sans la note que le partage y joint (js/sharing/sharing-model.js) : { formula, rights, memo }. Mesuré (faits vérifiés 179) : chacun lit et retire
// ses lignes, un éditeur n'écrit que les siennes (`newRec.Pour` est son adresse), seule « Lu » change.
export const noticeFixedRules = () => [{ formula: 'user.Access not in [OWNER]', rights: '-U', memo: 'le contenu d’une notification ne change pas' }];
export const noticeReadRules = () => [{ formula: mine, rights: '+U', memo: 'chacun marque lues ses notifications' }];
export const noticeRules = () => [
  { formula: 'user.Access in [OWNER]', rights: '+CRUD', memo: 'les propriétaires gardent la main sur les notifications' },
  { formula: `user.Access in [EDITOR] and ${mineNew}`, rights: '+C', memo: 'chacun écrit ses notifications, jamais celles d’un autre' },
  { formula: mine, rights: '+RD', memo: 'chacun lit et retire les siennes' },
  { formula: '', rights: '-CRUD', memo: 'les notifications d’une autre personne ne sont pas à vous' },
];

const text = value => (typeof value === 'string' ? value : '');
// Le dernier nom d'un chemin « Formation/2025 » (ce que l'explorateur appelle le nom du dossier).
const lastName = path => String(path || '').split('/').filter(Boolean).pop() || '';

// Les fiches de partage lisibles d'une personne qui sont pour elle : une ligne à son adresse (ou à une catégorie), écrite par quelqu'un d'autre, encore active,
// qui ne retire rien. Un groupe n'y est jamais : une personne ne lit pas les lignes d'un groupe (`shareRules`), ce qu'un groupe donne se voit par l'espace ou
// le fichier lui-même (ci-dessous). `rows` : les lignes de `GFS_Partages` (js/rights/rights.js, `rowsOf`).
export function sharesToMe(rows, identity) {
  const me = lower(identity);
  if (!me) return [];
  return (rows || []).filter(row => {
    const who = lower(row.PersonneL || row.Personne);
    return lower(row.Auteur) !== me && row.Droit !== 'aucun' && row.Actif !== false && (who === me || who === '@tous' || who === '@editeurs');
  });
}

// Ce qui est donné à la personne `identity` : [{ cle, type, cible, nom, par, path? }] (`path` : le dossier de l'espace dans l'explorateur). Trois sources,
// toutes déjà lues par l'explorateur :
//   - les fichiers donnés par son adresse (`file.direct`, js/sharing/direct-shares.js) ;
//   - les espaces qu'elle lit : pour un éditeur ou un lecteur, tout espace qu'elle voit lui a été ouvert (par son adresse, un groupe ou une catégorie) ; un
//     propriétaire voit tous les espaces, il n'est prévenu que de ceux qu'on lui a donnés par son adresse ;
//   - les dossiers donnés par son adresse (une ligne de partage dont la cible est `dossier:…`).
// `spaces` : js/sharing/spaces-filing.js (`readSpaces`), ou null ; `shares` : les lignes de `GFS_Partages` qu'elle lit ; `owner` : elle est propriétaire du
// document (faux tant qu'on ne le sait pas : mieux vaut annoncer un espace de trop que de le taire).
export function givenToMe({ files = [], spaces = null, shares = [], identity = '', owner = false }) {
  const me = lower(identity);
  if (!me) return [];
  const out = new Map();
  const add = item => { if (!out.has(item.cle)) out.set(item.cle, item); };
  for (const file of files) {
    if (file.direct && !file.trashed) add({ cle: `fichier|${file.key}`, type: 'fichier', cible: file.key, nom: file.name, par: lower(file.direct.by) });
  }
  const toMe = sharesToMe(shares, me);
  const bySpace = new Map(toMe.filter(row => text(row.Cible).startsWith('espace:')).map(row => [text(row.Cible).slice('espace:'.length), row]));
  for (const space of (spaces && spaces.spaces) || []) {
    const row = bySpace.get(space.key);
    if (owner && !row) continue;
    add({ cle: `espace|${space.key}`, type: 'espace', cible: space.key, nom: space.name, path: space.path, par: row ? lower(row.Auteur) : '' });
  }
  for (const row of toMe) {
    const target = text(row.Cible);
    if (target.startsWith('dossier:')) add({ cle: `dossier|${target}`, type: 'dossier', cible: target, nom: lastName(target.slice(target.indexOf('/') + 1)),
      par: lower(row.Auteur) });
  }
  return [...out.values()];
}

// Les notifications de la personne telles que la table les rend (`fetchTable` : une liste par colonne) : seulement ses lignes (un propriétaire lit toutes les
// lignes du document). [{ id, cle, type, cible, par, quand, lu }].
export function noticeRows(data, identity) {
  const me = lower(identity);
  if (!me || !data || !Array.isArray(data.id)) return [];
  const rows = [];
  for (let i = 0; i < data.id.length; i++) {
    const cell = name => (Array.isArray(data[name]) ? data[name][i] : undefined);
    if (lower(cell('Pour')) !== me || !text(cell('Cle'))) continue;
    const row = { id: data.id[i], cle: text(cell('Cle')), type: text(cell('Type')), cible: text(cell('Cible')), par: lower(cell('Par')),
      quand: Number(cell('Quand')) || 0,
      lu: cell('Lu') === true };
    // Deux onglets de la même personne ont pu écrire la même ligne : la première fait foi, et « lu » d'une des deux vaut pour les deux.
    const twin = rows.find(one => one.cle === row.cle);
    if (twin) twin.lu = twin.lu || row.lu; else rows.push(row);
  }
  return rows;
}

// Ce que la cloche doit dire : chaque chose donnée avec sa ligne (`row` : le numéro de la ligne de la table, ou null quand elle n'est pas encore écrite), si
// elle est lue (`lu`) et quand elle a été annoncée (`quand`, 0 tant qu'elle ne l'est pas). `read` : les clés que le navigateur sait lues (le repli d'un
// lecteur, ou d'un document sans table). Et `add` : les lignes à écrire pour que la table dise ce que le navigateur sait ; vide quand `write` est faux (un
// lecteur n'écrit rien). Les plus récentes d'abord, les non lues avant les lues.
export function planNotices({ given, rows = [], read = [], identity, write = true }) {
  const me = lower(identity);
  const byKey = new Map(rows.map(row => [row.cle, row]));
  const seen = new Set(read);
  const items = given.map(item => {
    const row = byKey.get(item.cle) || null;
    return { ...item, row: row ? row.id : null, quand: row ? row.quand : 0, lu: Boolean((row && row.lu) || seen.has(item.cle)) };
  });
  const when = item => item.quand || Number.MAX_SAFE_INTEGER; // une notification pas encore écrite est la plus récente
  items.sort((a, b) => Number(a.lu) - Number(b.lu) || when(b) - when(a));
  const add = write && me ? items.filter(item => item.row === null).map(item => (
    { Pour: me, Type: item.type, Cible: item.cible, Par: item.par, Cle: item.cle })) : [];
  return { items, add, unread: items.filter(item => !item.lu).length };
}
