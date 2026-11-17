// Partager un fichier (contrats 11.7, point 13 ; maquettes du 06/11) : le modèle de données et les règles, en code pur. Une table `GFS_Partages` dit qui a quel
// droit sur quelle cible (un fichier : sa clé d'explorateur, `app:identifiant` ; `*` : tout le document) ; des colonnes-formules d'aide, sur chaque table de
// fichiers, en tirent les listes que lisent les règles (une règle ne lit que `rec` et `newRec` : faits vérifiés, 46 et 55). Ce module ne touche pas à Grist :
// il rend les actions à envoyer en UNE `applyUserActions` et les lignes à écrire.
//
// Le premier lot couvre les fichiers que GFS garde (`GFS_Fichiers`, les PDF : une table de GFS, sans app) : « lecture » et « écriture » et « administration ».
// « Commentaires » (ceux des apps) et « dépôt seul » attendent leurs tables ; « peut télécharger » est un confort de GFS (le bouton), jamais une protection :
// qui lit la pièce jointe peut la copier (contrats 11.1, point 8).

import { FILES_TABLE } from '../files/gfs-files.js';
import { TABLE as FILING_TABLE, COLUMNS as FILING_COLUMNS } from '../files/rangement.js';

export const SHARES_TABLE = 'GFS_Partages';
// Le dossier d'une personne dans « Moi » se partage par la cible `dossier:moi:<adresse en minuscules>/<chemin>` : le droit vaut pour les fichiers de cette
// personne rangés dans ce dossier (ou dessous), et pour ceux qu'elle y rangera.
export const PERSONAL_PREFIX = 'dossier:moi:';
export const ROOT = '*';
export const RIGHTS = Object.freeze(['aucun', 'lecture', 'ecriture', 'admin']);
export const CATEGORIES = Object.freeze({ editeurs: '@editeurs', tous: '@tous' });
const NOTE = 'GFS : Partages · ';
const NOTE_ANY = /^\s*GFS\s*:\s*Partages\b/i;
export const isSharingNote = memo => NOTE_ANY.test(String(memo ?? ''));
const GFS_ANY = /^\s*GFS\s*:/i;
export const isGfsNote = memo => GFS_ANY.test(String(memo ?? ''));

// Les tables de fichiers que le partage couvre : la clé d'une ligne est `<préfixe><identifiant>` (le même que `fileKey` de l'explorateur). `id` : la colonne de
// l'identifiant (null : le numéro de ligne de Grist, `colonnes.id: "id"` du manifeste) ; `author` : la colonne de l'auteur ; `stamped` : GFS pose lui-même
// cette colonne (une formule déclenchée sur `user`, écrite par Grist à la création, que l'app n'a pas à tenir) ;
// `open` : une condition sur la ligne (`rec`) des lignes qui ne sont pas des fichiers (`exclure` du manifeste, les réglages de l'app) et restent ouvertes comme
//   avant. L'auteur d'un PDF est `GFS_Auteur`, que Grist écrit à la création et que seuls les propriétaires changent, comme pour les fichiers des apps. Pas
//   `Auteur` : l'explorateur le réécrit à chaque remplacement du contenu (c'est le dernier qui a modifié), et un porteur du droit « écriture » s'y serait nommé
//   auteur, donc administrateur (mesuré le 09/11, labo/run-partager-auteur.mjs).
export const STAMP = 'GFS_Auteur';
export const FILES_TARGET = Object.freeze({ table: FILES_TABLE, prefix: 'gfs-fichiers:', id: 'Identifiant', author: STAMP, stamped: true, open: '' });
export const TARGETS = Object.freeze([FILES_TARGET]);

// Les tables de fichiers que les manifestes des apps déclarent (`fichiers[]`) : une cible par table, d'après la forme de l'explorateur
// (js/explorer/explorer-model.js).
export function appTargets(manifests) {
  const out = [];
  for (const manifest of manifests || []) {
    for (const spec of (manifest && manifest.fichiers) || []) {
      if (!spec || !spec.table || !manifest.id) continue;
      const idColumn = spec.colonnes && spec.colonnes.id;
      const open = Object.entries(spec.exclure || {}).filter(([, values]) => Array.isArray(values) &&
        values.length).map(([col, values]) => `rec.${col} in (${values.map(value => JSON.stringify(String(value))).join(', ')},)`).join(' or ');
      out.push(Object.freeze({ table: spec.table, prefix: `${manifest.id}:`, id: !idColumn || idColumn === 'id' ? null : idColumn, author: STAMP, stamped: true,
        open }));
    }
  }
  return out;
}
export const targetsOf = manifests => [FILES_TARGET, ...appTargets(manifests)];
const idOf = target => (target.id ? `$${target.id}` : '$id');
// La ligne d'un fichier d'après sa clé, dans une formule de la table de partages (le numéro de ligne se lit par `id`).
const findFile = target => (target.id
  ? `  found = ${target.table}.lookupOne(${target.id}=cible[${target.prefix.length}:])`
  : `  raw = cible[${target.prefix.length}:]\n  found = ${target.table}.lookupOne(id=int(raw)) if raw.isdigit() else None`);

const column = (id, type, extra = {}) => Object.freeze({ id, type, ...extra });
// `Auteur` et `AuteurAcces` : écrits par Grist à la création (formule déclenchée sur `user`), jamais choisis par la personne.
const stamped = (id, formula) => column(id, 'Text', { isFormula: false, formula, recalcWhen: 0, recalcDeps: null });
const formula = (id, type, body) => column(id, type, { isFormula: true, formula: body });

// La table de partages. `Valide1` : l'auteur est propriétaire. `AdminsBase` : l'auteur du fichier visé et les administrateurs que des propriétaires ont nommés,
// pour la cible. `Valide` : le partage vient d'un propriétaire ou d'un administrateur de la cible (deux niveaux : une formule ne peut pas dépendre
// d'elle-même). `AdminsCible` : ceux qui administrent la cible (les règles s'y fient).
export function shareColumns(targets = TARGETS) {
  const author = targets.map(target =>
    `if cible.startswith("${target.prefix}"):\n${findFile(target)}\n  if found:\n    out.add(str(found.${target.author}).strip().lower())`).join('\n');
  return [
    column('Cible', 'Text'), column('Personne', 'Text'), column('Droit', 'Text'), column('Telecharger', 'Bool'), column('Fin', 'Date'),
    stamped('Auteur', 'user.Email'), stamped('AuteurAcces', 'str(user.Access)'),
    formula('PersonneL', 'Text', 'str($Personne or "").strip().lower()'),
    formula('Actif', 'Bool', 'not $Fin or $Fin >= TODAY()'),
    formula('Valide1', 'Bool', 'str($AuteurAcces).lower() in ("owners", "owner")'),
    formula('AdminsBase', 'Any', [
      'cible = str($Cible)', 'out = set()',
      author,
      // Le dossier d'une personne dans « Moi » (`dossier:moi:<adresse>/<chemin>`) : la personne en est l'administratrice, sans propriétaire.
      `if cible.startswith("${PERSONAL_PREFIX}"):`,
      `  out.add(cible[${PERSONAL_PREFIX.length}:].split("/")[0].strip().lower())`,
      'for p in Partages.lookupRecords(Droit="admin"):',
      '  if p.Valide1 and p.Actif and p.Cible in (cible, "*"):',
      adminsOf('    '),
      'return tuple(sorted(out))'].filter(Boolean).join('\n').replace(/Partages\./g, `${SHARES_TABLE}.`)),
    formula('Valide', 'Bool', '$Valide1 or str($Auteur).strip().lower() in $AdminsBase'),
    formula('AdminsCible', 'Any', [
      'out = set($AdminsBase)',
      `for p in ${SHARES_TABLE}.lookupRecords(Droit="admin"):`,
      '  if p.Valide and p.Actif and p.Cible in (str($Cible), "*"):',
      adminsOf('    '),
      'return tuple(sorted(out))'].join('\n')),
  ];
}

// Ajoute à `out` ceux qu'une ligne `admin` désigne : une personne, ou les membres d'un groupe (« Administrer » comme une personne, choix du porteur, 13/11).
// Une catégorie (« @ ») n'administre jamais : « tous les éditeurs » ne change pas les partages d'un fichier.
const adminsOf = indent => [
  'if p.PersonneL.startswith("#"):',
  `  g = ${GROUPS_TABLE}.lookupOne(NomL=p.PersonneL[1:])`,
  '  out.update(list(g.Membres or ()) if g else [])',
  'elif p.PersonneL and not p.PersonneL.startswith("@"):',
  '  out.add(p.PersonneL)'].map(line => indent + line).join('\n');

// Les groupes (contrats 11.7, point 13, lot 3) : `GFS_Groupes`, une ligne par groupe. Un groupe créé dans GFS garde ses adresses dans `PersonnesIci` (une par
// ligne) ; un groupe lu dans une table du document porte la table et les deux colonnes (`Source`, `SourceEmail`, `SourceGroupe`) et `Membres` les relit
// (formule : une règle de Grist ne lit pas une autre table, les colonnes d'aide de chaque fichier lisent `Membres`). Un partage cible un groupe par `#nom`. Les
// noms de table et de colonne sont des identifiants Grist, vérifiés avant d'entrer dans une formule.
export const GROUPS_TABLE = 'GFS_Groupes';
export const GROUP_PREFIX = '#';
export const isGroup = who => String(who ?? '').startsWith(GROUP_PREFIX);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const isIdent = text => IDENT.test(String(text ?? ''));

// Les sources distinctes (table, colonne des adresses, colonne des groupes) que portent les lignes de groupes.
export function sourcesOf(rows) {
  const seen = new Map();
  for (const row of rows || []) {
    if (!row.Source || !isIdent(row.Source) || !isIdent(row.SourceEmail) || !isIdent(row.SourceGroupe)) continue;
    seen.set(`${row.Source}/${row.SourceEmail}/${row.SourceGroupe}`, { table: row.Source, email: row.SourceEmail, group: row.SourceGroupe });
  }
  return [...seen.values()];
}

const membersFormula = sources => [
  'out = set(m.strip().lower() for m in str($PersonnesIci or "").replace(",", "\\n").split("\\n") if m.strip())',
  ...sources.filter(source => isIdent(source.table) && isIdent(source.email) && isIdent(source.group)).map(source =>
    `if $Source == "${source.table}":\n  for r in ${source.table}.lookupRecords(${source.group}=$Nom):\n    out.add(str(r.${source.email} or "").strip().lower())`),
  'out.discard("")', 'return tuple(sorted(out))'].join('\n');

export const groupColumns = (sources = []) => [
  column('Nom', 'Text'), formula('NomL', 'Text', 'str($Nom or "").strip().lower()'), column('PersonnesIci', 'Text'),
  column('Source', 'Text'), column('SourceEmail', 'Text'), column('SourceGroupe', 'Text'),
  formula('Membres', 'Any', membersFormula(sources)), formula('Nb', 'Int', 'len($Membres or ())'),
];

// Les règles de la table des groupes : les propriétaires font tout ; les éditeurs lisent le nom, la source et le nombre (pour proposer un groupe), jamais les
// adresses ; le reste est refusé.
export const GROUP_PUBLIC = 'Nom,NomL,Nb,Source';
export const groupRules = () => [rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires tiennent les groupes'),
  rule('', '-CRUD', 'les adresses d’un groupe ne se lisent que des propriétaires')];
export const groupPublicRules = () => [rule('user.Access in [EDITOR]', '+R', 'un éditeur voit le nom d’un groupe et combien de personnes il compte')];

// Le plan d'un changement de sources : la formule de `Membres` relue avec `sources`.
export const planGroupSources = sources => ({ ok: true, actions: [['ModifyColumn', GROUPS_TABLE, 'Membres', { formula: membersFormula(sources) }]] });

// Les espaces (contrats 11.7, point 13, lot 4 ; décision du porteur du 09/11, comme Google Drive) : `GFS_Espaces` (une ligne par espace partagé ; l'accès à
// l'espace passe par des groupes, des lignes de partage dont la cible est `espace:<clé>`) et `GFS_Placement` (quel fichier est dans quel espace, et dans quel
// dossier de l'espace). Un dossier se partage par la cible `dossier:<clé>/<chemin>`. Le droit qui s'applique est **le plus précis** : le fichier avant son
// dossier, le dossier avant l'espace, l'espace avant le document entier (`*`) ; à précision égale, la personne avant le groupe, le groupe avant la catégorie ;
// à égalité, le droit le plus large. « Aucun accès » retire tout droit à cette personne (ou à ce groupe) à ce niveau et en dessous : c'est ainsi qu'on cache un
// fichier à un membre de l'espace.
export const SPACES_TABLE = 'GFS_Espaces';
export const PLACE_TABLE = 'GFS_Placement';
export const spaceTarget = key => `espace:${key}`;
// La cible d'un dossier de « Moi » : l'adresse de la personne en minuscules, puis le chemin nettoyé (`dossier:moi:<adresse>/<chemin>`).
export const personalTarget = (identity, path) => folderTarget(`${PERSONAL_PREFIX.slice('dossier:'.length)}${String(identity ?? '').trim().toLowerCase()}`,
  path);
export const folderTarget = (key, path) => `dossier:${key}/${String(path || '').split('/').filter(Boolean).join('/')}`;
const POSITIVE = '("lecture", "ecriture", "admin")';

export const spaceColumns = () => [column('Cle', 'Text'), column('Nom', 'Text'), formula('Voit', 'Any', [
  'out = set()',
  `for p in ${SHARES_TABLE}.lookupRecords(Cible="espace:" + str($Cle)):`,
  `  if p.Valide and p.Actif and p.Droit in ${POSITIVE}:`,
  '    if p.PersonneL.startswith("#"):',
  `      g = ${GROUPS_TABLE}.lookupOne(NomL=p.PersonneL[1:])`,
  '      out.update(list(g.Membres or ()) if g else [])',
  '    elif p.PersonneL and not p.PersonneL.startswith("@"):',
  '      out.add(p.PersonneL)',
  'return tuple(sorted(out))'].join('\n'))];
// Un lien (contrats 11.7, point 13.o) est une ligne de placement sans `Cible` (comme un dossier vide d'espace) qui porte en plus `Lien` (la cible vue d'un
// autre
// espace : un fichier ou `dossier:<clé>/<chemin>`) et `Partages` (les groupes à qui le lien a donné un droit, `#nom` séparés par une virgule).
export const PLACE_LINK_COLUMNS = Object.freeze(['Lien', 'Partages']);
export const placeColumns = () => [column('Cible', 'Text'), column('Espace', 'Text'), column('Dossier', 'Text'),
  formula('Voit', 'Any', `${SPACES_TABLE}.lookupOne(Cle=$Espace).Voit or ()`), ...PLACE_LINK_COLUMNS.map(id => column(id, 'Text'))];

// Le dossier que l'auteur du fichier lui a donné dans « Moi » (une ligne de `GFS_Rangement` à son adresse, pour ce fichier ; rien si le fichier n'y est pas
// rangé) : le calcul des droits le lit, et c'est aussi ce qui dit à GFS qu'un document partagé avant ce lot est à mettre à jour.
function folderFormula(target) {
  const app = target.prefix.slice(0, -1);
  return [
    `author = str($${target.author}).strip().lower()`, 'out = ""', 'if author:',
    `  for r in ${FILING_TABLE}.lookupRecords(App="${app}", Fichier=str(${idOf(target)})):`,
    '    if str(r.Utilisateur or "").strip().lower() == author:',
    '      out = "/".join(x for x in str(r.Dossier or "").split("/") if x)',
    '      break',
    'return out'].join('\n');
}

// Les cibles qui valent pour un fichier, de la plus large (`*`, 0) à la plus précise (le fichier, 99) : l'espace où il est placé et ses dossiers, ou, hors d'un
// espace, le dossier que son auteur lui a donné dans « Moi » (`GFS_Dossier`) : les droits de ce dossier et de ceux au-dessus valent pour lui, et pour tout
// fichier que l'auteur y rangera. Le dossier d'une autre personne ne compte jamais : sa clé porte l'adresse de l'auteur. `full` : les noms de ces dossiers
// (`GFS_Vus` en tire le chemin sous le dossier d'un lien).
const chainLines = target => [
  `key = "${target.prefix}" + str(${idOf(target)})`,
  `author = str($${target.author}).strip().lower()`,
  'chain = {"*": 0}',
  'full = []',
  `pl = ${PLACE_TABLE}.lookupOne(Cible=key)`,
  'if pl and pl.Espace:',
  '  chain["espace:" + str(pl.Espace)] = 1',
  '  parts = [x for x in str(pl.Dossier or "").split("/") if x]',
  '  full = parts',
  '  for i in range(len(parts)):',
  '    chain["dossier:" + str(pl.Espace) + "/" + "/".join(parts[:i + 1])] = 2 + i',
  'elif author:',
  '  mine = [x for x in str($GFS_Dossier or "").split("/") if x]',
  '  full = mine',
  '  for i in range(len(mine)):',
  `    chain["${PERSONAL_PREFIX}" + author + "/" + "/".join(mine[:i + 1])] = 2 + i`,
  'chain[key] = 99'];

// Où le fichier se montre en plus, par les liens d'autres espaces (contrats 11.7, point 13.o) : « <clé de l'espace>/<chemin> », un par lien dont la source est
// le fichier ou un dossier au-dessus de lui (le chemin sous ce dossier suit celui du lien). Une personne ne lit que les fichiers où elle a un droit : Grist
// décide donc seul qui voit quoi, comme pour les listes de lecteurs.
function vusFormula(target) {
  return [...chainLines(target),
    'out = set()',
    'for cible, lvl in chain.items():',
    `  for l in ${PLACE_TABLE}.lookupRecords(Lien=cible):`,
    '    if not l.Espace:',
    '      continue',
    '    base = [x for x in str(l.Dossier or "").split("/") if x]',
    '    rest = [] if cible == key else full[lvl - 1:]',
    '    out.add(str(l.Espace) + "/" + "/".join(base + rest))',
    'return tuple(sorted(out))'].join('\n');
}

// Le calcul du droit de chaque personne sur un fichier (une seule colonne cachée, `GFS_Calc`, que les autres lisent) : la liste des lecteurs, des écrivains,
// des administrateurs, des refus, des catégories qui lisent et qui écrivent.
function calcFormula(target) {
  return [
    ...chainLines(target),
    'RANK ={"aucun": 0, "lecture": 1, "ecriture": 2, "admin": 3}',
    'best = {}',
    'cats = {}',
    'def put(table, who, lvl, kind, rank, src=""):',
    '  cur = table.get(who)',
    '  if cur is None or (lvl, kind) > (cur[0], cur[1]) or ((lvl, kind) == (cur[0], cur[1]) and rank > cur[2]):',
    '    table[who] = (lvl, kind, rank, src)',
    'for cible, lvl in chain.items():',
    `  for p in ${SHARES_TABLE}.lookupRecords(Cible=cible):`,
    '    if not (p.Valide and p.Actif) or p.Droit not in RANK:',
    '      continue',
    '    rank = RANK[p.Droit]',
    '    if p.PersonneL.startswith("@"):',
    // une catégorie lit ou écrit, jamais n'administre
    '      if rank:',
    '        put(cats, p.PersonneL[1:], lvl, 0, min(rank, 2))',
    '    elif p.PersonneL.startswith("#"):',
    `      g = ${GROUPS_TABLE}.lookupOne(NomL=p.PersonneL[1:])`,
    // les membres d'un groupe à qui un dossier de « Moi » est donné ont le fichier « donné » (« Partagés avec moi »), comme ceux dont l'adresse est nommée
    `      gave = str(p.Auteur or "").strip().lower() if cible.startswith("${PERSONAL_PREFIX}") else ""`,
    '      for m in (list(g.Membres or ()) if g else []):',
    '        put(best, m, lvl, 1, rank, gave)',
    '    elif p.PersonneL:',
    '      put(best, p.PersonneL, lvl, 2, rank, str(p.Auteur or "").strip().lower() if lvl >= 2 else "")',
    'if author:',
    '  best[author] = (999, 9, 3, "")',
    'def has(table, least):',
    '  return sorted(who for who, v in table.items() if v[2] >= least)',
    // Ceux à qui le fichier a été donné par leur adresse, sur le fichier ou sur un dossier d'espace, par quelqu'un d'autre : « adresse>auteur du partage »
    // (« Partagés avec moi », lot 4c) ; et les membres d'un groupe à qui un dossier de « Moi » est donné.
    'directs = sorted(who + ">" + v[3] for who, v in best.items() if v[1] in (1, 2) and v[2] >= 1 and v[3] and v[3] != who)',
    'return [has(best, 1), has(best, 2), has(best, 3), sorted(who for who, v in best.items() if v[2] == 0), has(cats, 1), has(cats, 2), directs]'].join('\n');
}

// Les colonnes d'aide d'une table de fichiers : `GFS_Calc` (le calcul), puis les adresses qui lisent, écrivent, administrent, celles à qui l'accès est retiré
// (`GFS_Refus`), et les catégories entières (`editeurs`, `tous`) qui lisent ou écrivent.
export const HELPERS = Object.freeze(['GFS_Dossier', 'GFS_Calc', 'GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Refus', 'GFS_Cats', 'GFS_CatsEcrit',
  'GFS_Directs', 'GFS_Vus']);
export function helperColumns(target = FILES_TARGET) {
  const part = at => `tuple(($GFS_Calc or [[], [], [], [], [], [], []])[${at}])`;
  return [
    ...(target.stamped ? [stamped(STAMP, 'user.Email')] : []),
    formula('GFS_Dossier', 'Text', folderFormula(target)),
    formula('GFS_Calc', 'Any', calcFormula(target)),
    formula('GFS_Lecteurs', 'Any', part(0)),
    formula('GFS_Ecrivains', 'Any', part(1)),
    formula('GFS_Admins', 'Any', part(2)),
    formula('GFS_Refus', 'Any', part(3)),
    formula('GFS_Cats', 'Any', part(4)),
    formula('GFS_CatsEcrit', 'Any', part(5)),
    formula('GFS_Directs', 'Any', part(6)),
    formula('GFS_Vus', 'Any', vusFormula(target)),
  ];
}

const me = 'user.Email and user.Email.lower()';
const inList = name => `user.Email and rec.${name} and user.Email.lower() in rec.${name}`;
// Les règles des deux tables d'espaces : les propriétaires font tout ; ceux qui voient l'espace le lisent (son nom, ses membres) ; le reste est refusé.
export const spaceRules = () => [rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires tiennent les espaces'),
  rule(inList('Voit'), '+R', 'ceux qui ont accès à un espace le voient'), rule('', '-CRUD', 'un espace est caché à qui n’y a pas accès')];
const ownShare = 'user.Email and rec.Auteur and rec.Auteur.lower() == user.Email.lower()';
const rule = (formulaText, rights, memo, extra = {}) => ({ formula: formulaText, rights, memo: `${NOTE}${memo}`, ...extra });

// Les règles d'une table de fichiers : les propriétaires, les administrateurs, qui écrit, qui lit (par adresse ou par catégorie), la création à son nom, le
// reste refusé.
export function fileRules(target = FILES_TARGET) {
  const open = target.open ? [
    rule(target.open, '+R', 'les lignes de réglages de l’app restent lisibles'),
    rule(`user.Access in [EDITOR] and (${target.open})`, '+UD', 'et modifiables par les éditeurs, comme avant'),
  ] : [];
  return [
    rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires gardent la main'),
    ...open,
    rule(inList('GFS_Refus'), '-CRUD', 'un accès retiré à cette personne pour ce fichier'),
    rule(inList('GFS_Admins'), '+CRUD', 'l’auteur et les administrateurs du fichier gèrent son partage'),
    rule(`${inList('GFS_Ecrivains')} or (user.Access in [EDITOR] and rec.GFS_CatsEcrit and "editeurs" in rec.GFS_CatsEcrit)`, '+RU',
      'ceux qui ont l’écriture modifient le fichier'),
    rule(`${inList('GFS_Lecteurs')} or (rec.GFS_Cats and (("editeurs" in rec.GFS_Cats and user.Access in [EDITOR]) or ("tous" in rec.GFS_Cats and user.Access in [EDITOR, VIEWER])))`,
      '+R', 'ceux à qui le fichier est partagé le lisent'),
    rule(`user.Access in [EDITOR] and user.Email and newRec.${target.author} and newRec.${target.author}.lower() == user.Email.lower()`, '+C',
      'chacun ajoute des fichiers à son nom'),
    rule('', '-CRUD', 'le fichier d’une autre personne n’est pas à vous'),
  ];
}

// Les règles de la table de partages (sur la table entière), et celles qui gardent l'auteur écrit par Grist (sur ses deux colonnes seules : passent avant).
export function shareRules() {
  return [
    rule('user.Access in [OWNER]', '+CRUD', 'les propriétaires gardent la main'),
    rule(inList('AdminsCible'), '+RUD', 'les administrateurs d’un fichier gèrent ses partages'),
    rule(ownShare, '+RUD', 'chacun gère les partages qu’il a ajoutés'),
    rule('(user.Email and rec.PersonneL == user.Email.lower()) or (rec.PersonneL == "@tous" and user.Access in [EDITOR, VIEWER]) or (rec.PersonneL == "@editeurs" and user.Access in [EDITOR])',
      '+R', 'chacun lit les partages qui le concernent, catégories comprises'),
    // Mesuré (faits 55) : une colonne à formule déclenchée garde la valeur qu'on lui donne à la création, et `newRec` porte, à la création, celle que Grist
    // écrit ou celle qu'on a donnée : la règle exige que l'auteur et son rôle soient ceux de la personne.
    rule('user.Access in [EDITOR] and user.Email and newRec.Auteur and newRec.Auteur.lower() == user.Email.lower() and newRec.AuteurAcces == user.Access', '+C',
      'tout éditeur peut ajouter une ligne, à son nom : elle ne vaut que si elle est valide'),
    rule('', '-CRUD', 'le reste est refusé'),
  ];
}
export const stampRules = (memo = 'l’auteur d’un partage est écrit par Grist, personne ne le change') => [rule('user.Access not in [OWNER]', '-U', memo)];

// Les six règles de « Partagé » pour une table de lignes par personne (contrats 11.4, point 2), de la première à la dernière ; chacune porte sa note, que Grist
// joint à son refus. Le partage les pose sur `GFS_Rangement` : le dossier qu'une personne donne à un fichier dans « Moi » ouvre des droits (`GFS_Dossier`), et
// n'importe quel éditeur pourrait sinon écrire la ligne de rangement d'une autre personne pour y ranger son fichier dans un dossier partagé.
export function sharedRules() {
  const own = 'user.Email and rec.Utilisateur and rec.Utilisateur.lower() == user.Email.lower()';
  return [
    { formula: 'user.Access in [OWNER]', rights: '+CRUD', memo: 'GFS : Partagé · les propriétaires gardent la main' },
    { formula: 'rec.Utilisateur == "@document"', rights: '+R', memo: 'GFS : Partagé · la liste des apps du document se lit par tous' },
    { formula: own, rights: '+R', memo: 'GFS : Partagé · chacun lit son propre rangement' },
    { formula: `${own} and newRec.Utilisateur.lower() == user.Email.lower()`, rights: '+CUD',
      memo: 'GFS : Partagé · chacun écrit son propre rangement, jamais celui d’un autre' },
    { formula: 'rec.Utilisateur == "@sonde" and user.Email and rec.Adresse and rec.Adresse.lower() == user.Email.lower()', rights: '+CRD',
      memo: 'GFS : Partagé · la ligne-sonde de l’adresse' },
    { formula: '', rights: '-CRUD', memo: 'GFS : Partagé · le rangement d’une autre personne n’est pas à vous' },
  ];
}
// Les colonnes sans lesquelles ces règles ne s'écrivent pas (Grist refuse une formule qui nomme une colonne absente).
export const RANGEMENT_NEEDED = Object.freeze(['Utilisateur', 'Adresse']);

const maxId = rows => rows.reduce((top, row) => Math.max(top, Number(row.id) || 0), 0);
const byResource = existing => new Map(existing.resources.map(resource => [resource.id, resource]));
const onTable = (existing, tableId) => {
  const map = byResource(existing); return existing.rules.filter(item => (map.get(item.resource) || {}).tableId === tableId); };

// Les ressources et règles à écrire : une ressource par table (et une pour les colonnes écrites par Grist), les règles aux identifiants choisis, dans l'ordre
// (rulePos).
function rulesActions(existing, groups) {
  let resource = maxId(existing.resources);
  let id = maxId(existing.rules);
  const actions = [];
  for (const { tableId, colIds, rules } of groups) {
    resource += 1;
    actions.push(['AddRecord', '_grist_ACLResources', resource, { tableId, colIds }]);
    rules.forEach((one, at) => actions.push(['AddRecord', '_grist_ACLRules', (id += 1),
      { resource, aclFormula: one.formula, permissionsText: one.rights, rulePos: at + 1, memo: one.memo }]));
  }
  return actions;
}

const isBuiltIn = (item, map) => {
  const res = map.get(item.resource); return (!res || ((!res.tableId || res.tableId === '*') && (!res.colIds || res.colIds === '*'))) &&
  !String(item.aclFormula || '').trim() && (item.permissionsText ? !String(item.permissionsText).includes('-') : Number(item.permissions) === 63); };

// Retirer des règles précises (une table déjà partagée dont on repose les règles) : les règles, et les ressources qu'elles laissent vides.
function dropRules(existing, items) {
  const dropped = new Set(items.map(item => item.id));
  const emptied = [...new Set(items.map(item => item.resource))].filter(id => !existing.rules.some(item => item.resource === id && !dropped.has(item.id)));
  return [['BulkRemoveRecord', '_grist_ACLRules', [...dropped]], ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])];
}

// Activer le partage : crée `GFS_Partages` (et `GFS_Fichiers`, `GFS_Rangement` s'ils manquent), ajoute les colonnes d'aide aux tables de fichiers (celles que
// GFS garde et celles des apps : `GFS_Auteur`, que Grist écrit à la création, en plus pour les apps), pose les règles. Rejoué quand une app a été ajoutée
// depuis (ou après un retrait), il ne complète que ce qui manque. `existing` : { resources, rules, tables, columns, targets, files: { table: [identifiants] }
// } ; `targets` : les tables de fichiers (`targetsOf`, js/sharing/sharing-model.js), celles des apps seulement si elles sont dans le document. Rend { ok: true,
// actions, firstRule, creates: [tables créées], adds: [colonnes ajoutées], legacy: nombre de fichiers déjà là, laissés lisibles de tous, appTables, skipped,
// extends } ou { ok: false, reason } : 'already' (tout est posé), 'foreign' (une règle d'un autre auteur sur une table de GFS). Une table d'app qui porte déjà
// une règle d'un autre auteur est laissée (`skipped`) : ce qu'elle protège est à elle.
export function planSharing(existing, filesColumns, targets = existing.targets || TARGETS) {
  const view = sharingView(existing);
  const shared = view.hasTable(SHARES_TABLE);
  if (!shared && [SHARES_TABLE, FILES_TABLE].some(view.foreign)) return { ok: false, reason: 'foreign' };
  const filing = view.filing();
  if (filing.foreign) return { ok: false, reason: 'foreign' };
  const picked = pickTargets(view, targets, shared);
  const { skipped, hadRules, todo } = picked;
  const core = coreTables(view);
  const sharesRules = shared && view.mine(SHARES_TABLE).length > 0;
  if (upToDate({ shared, todo, sharesRules, core, filing })) return { ok: false, reason: 'already' };
  const { actions, creates, adds } = structureActions(existing, view, filesColumns, { shared, core, filing, ...picked });
  // Les fichiers déjà rangés restent lisibles de tous ceux qui ont accès au document, comme avant l'activation (contrats 11.7, point 12) : un partage « tout le
  // document » par fichier ; les nouveaux fichiers ne sont lus que de leur auteur.
  const legacy = legacyKeys(existing, todo.filter(target => !hadRules(target)));
  if (legacy.length) actions.push(legacyAction(legacy));
  const map = byResource(existing);
  const appTables = todo.filter(target => !isFilesTarget(target)).map(target => target.table);
  return { ok: true, actions: [...actions, ...rulesActions(existing, ruleGroups({ sharesRules, core, todo, filing }))],
    firstRule: existing.rules.every(item => isBuiltIn(item, map)), creates, adds, legacy: legacy.length, appTables, skipped, extends: shared,
    filing: !filing.covered };
}

const isFilesTarget = target => target.table === FILES_TABLE;

// Ce que le plan lit du document : ses tables et leurs colonnes, les règles de GFS (`mine`) et celles d'un autre auteur (`foreign`) sur une table.
function sharingView(existing) {
  const hasTable = name => existing.tables.some(row => row.tableId === name);
  const columnsOf = table => new Set(existing.columns.filter(col => col.parentId === (existing.tables.find(row => row.tableId === table) || {}).id).map(col =>
    col.colId));
  const mine = table => onTable(existing, table).filter(item => isSharingNote(item.memo));
  const foreign = table => onTable(existing, table).some(item => !isSharingNote(item.memo));
  // Le rangement : posé (une règle de GFS, celles de « Partagé » comprises), d'un autre auteur (GFS n'y touche pas), colonnes qui manquent aux règles.
  const filing = () => {
    const rules = onTable(existing, FILING_TABLE);
    const have = columnsOf(FILING_TABLE);
    return { covered: rules.some(item => isGfsNote(item.memo)), foreign: rules.length > 0 && !rules.some(item => isGfsNote(item.memo)),
      missing: hasTable(FILING_TABLE) ? RANGEMENT_NEEDED.filter(colId => !have.has(colId)) : [] };
  };
  return { hasTable, columnsOf, mine, foreign, filing };
}

// Les tables de fichiers à traiter : celles de GFS et des apps qui sont dans le document, sans celles qui portent une règle d'un autre auteur (`skipped`,
// laissées). `todo` : celles qui ne sont pas à jour. Une table de fichiers est à jour quand elle porte toutes les colonnes d'aide et la règle des refus (celle
// du lot 4) ; une table partagée avant, ou avant les groupes, est relue : formules d'aide reprises, règles reposées.
function pickTargets(view, targets, shared) {
  const { hasTable, columnsOf, mine, foreign } = view;
  const skipped = targets.filter(target => !isFilesTarget(target) && hasTable(target.table) && foreign(target.table)).map(target => target.table);
  const here = targets.filter(target => (isFilesTarget(target) ? (!shared || hasTable(target.table)) : hasTable(target.table)) &&
    !skipped.includes(target.table));
  const hadRules = target => hasTable(target.table) && mine(target.table).length > 0;
  const covered = target => hadRules(target) && helperColumns(target).every(helper => columnsOf(target.table).has(helper.id)) &&
    mine(target.table).some(item => String(item.aclFormula || '').includes('GFS_Refus'));
  return { skipped, here, hadRules, todo: here.filter(target => !covered(target)) };
}

// Les tables communes : les groupes (un partage cible `#nom`), les espaces et leur placement. `missing` : celles à créer ; `unruled` : celles qui sont là sans
// leurs règles.
function coreTables(view) {
  const core = [[GROUPS_TABLE, groupColumns, GROUP_PUBLIC, groupPublicRules, groupRules], [SPACES_TABLE, spaceColumns, 'Cle,Nom,Voit', null, spaceRules],
    [PLACE_TABLE, placeColumns, 'Cible,Espace,Dossier,Voit', null, spaceRules]];
  // Un placement d'avant les liens : ses deux colonnes de lien s'ajoutent (additif, rien ne se recharge).
  const have = view.columnsOf(PLACE_TABLE);
  return { missing: core.filter(([name]) => !view.hasTable(name)), unruled: core.filter(([name]) => view.hasTable(name) && view.mine(name).length === 0),
    placeMissing: view.hasTable(PLACE_TABLE) ? PLACE_LINK_COLUMNS.filter(colId => !have.has(colId)) : [] };
}

// Rien à faire : le partage est là, avec ses règles, toutes les tables de fichiers sont à jour et les tables communes sont posées.
const upToDate = ({ shared, todo, sharesRules, core, filing }) => shared && !todo.length && sharesRules && !core.missing.length && !core.unruled.length &&
  !core.placeMissing.length && filing.covered;

// Les tables et les colonnes à poser, dans l'ordre où Grist les veut : les tables communes en tête (les groupes d'abord : les colonnes d'aide qui les lisent
// viennent après), les tables de fichiers à créer (la dernière en tête), la table de rangement, puis la table de partages (ou la formule de ses
// administrateurs) et les colonnes d'aide ajoutées. `creates` : les tables créées ; `adds` : les colonnes ajoutées.
function structureActions(existing, view, filesColumns, { shared, here, hadRules, todo, core, filing }) {
  const actions = []; const creates = []; const adds = [];
  // Les colonnes que les règles du rangement nomment, ajoutées d'abord si elles manquent.
  for (const colId of filing.missing) {
    actions.push(['AddColumn', FILING_TABLE, colId, { ...FILING_COLUMNS.find(column => column.id === colId), id: undefined }]);
    adds.push(`${FILING_TABLE}.${colId}`);
  }
  // Les colonnes de lien du placement, avant les formules d'aide des fichiers qui les lisent (`GFS_Vus`).
  for (const colId of core.placeMissing) { actions.push(['AddColumn', PLACE_TABLE, colId, { type: 'Text' }]); adds.push(`${PLACE_TABLE}.${colId}`); }
  if (!shared) { actions.push(['AddTable', SHARES_TABLE, shareColumns(here)]); creates.push(SHARES_TABLE); }
  else if (todo.length) actions.push(['ModifyColumn', SHARES_TABLE, 'AdminsBase',
    { formula: shareColumns(here).find(item => item.id === 'AdminsBase').formula }]);
  // Une fois le partage actif, un éditeur n'ajoute un fichier qu'à son nom : GFS doit connaître son adresse, qu'il ne lit que par la sonde de `GFS_Rangement`
  // (js/files/rangement.js). Sans cette table, son PDF serait refusé (mesuré, labo/run-partager-fenetre.mjs) : le partage la crée avec le reste, et la question
  // le dit.
  if (!view.hasTable(FILING_TABLE)) { actions.unshift(['AddTable', FILING_TABLE, FILING_COLUMNS.map(column => ({ ...column }))]); creates.push(FILING_TABLE); }
  for (const target of todo) {
    if (!view.hasTable(target.table)) {
      actions.unshift(['AddTable', target.table, [...filesColumns, ...helperColumns(target)]]); creates.push(target.table); continue; }
    const step = helperActions(existing, view, target, hadRules(target));
    actions.push(...step.actions);
    adds.push(...step.adds);
  }
  for (const [name, columns] of [...core.missing].reverse()) actions.unshift(['AddTable', name, columns()]);
  creates.push(...core.missing.map(([name]) => name));
  return { actions, creates, adds };
}

// Une table de fichiers déjà là : ses colonnes d'aide manquantes ; si elle était déjà partagée (`hadRules`), ses formules d'aide d'avant sont reprises (après
// les colonnes ajoutées) et ses règles d'avant retirées pour être reposées.
function helperActions(existing, view, target, hadRules) {
  const have = view.columnsOf(target.table);
  const missing = helperColumns(target).filter(helper => !have.has(helper.id));
  const actions = missing.flatMap(helper => addColumnActions(target, helper, have));
  const adds = missing.map(helper => `${target.table}.${helper.id}`);
  if (!hadRules) return { actions, adds };
  const formulas = helperColumns(target).filter(helper => helper.isFormula && have.has(helper.id)).map(helper =>
    ['ModifyColumn', target.table, helper.id, { formula: helper.formula }]);
  return { actions: [...actions, ...formulas, ...dropRules(existing, view.mine(target.table))], adds };
}

// Une colonne d'aide à ajouter. Les PDF d'avant : l'auteur est repris de `Auteur` (une colonne à formule `$Auteur` qu'on rend ordinaire garde ses valeurs,
// mesuré le 09/11), puis la formule de création reprend (`user.Email`, pour les nouvelles lignes seulement).
function addColumnActions(target, helper, have) {
  if (isFilesTarget(target) && helper.id === STAMP && have.has('Auteur')) {
    return [['AddColumn', target.table, STAMP, { type: 'Text', isFormula: true, formula: '$Auteur' }],
      ['ModifyColumn', target.table, STAMP, { isFormula: false, formula: helper.formula, recalcWhen: 0, recalcDeps: null }]];
  }
  return [['AddColumn', target.table, helper.id, { ...helper, id: undefined }]];
}

// Les clés des fichiers déjà rangés des tables qui n'étaient pas encore partagées (`existing.files` par table, ou `fileIds` pour les fichiers de GFS).
function legacyKeys(existing, targets) {
  const keysOf = target => ((existing.files && existing.files[target.table]) || (isFilesTarget(target) ? existing.fileIds : null) ||
    []).map(String).map(one => `${target.prefix}${one}`);
  return targets.flatMap(keysOf);
}

const legacyAction = keys => ['BulkAddRecord', SHARES_TABLE, keys.map(() => null),
  { Cible: keys, Personne: keys.map(() => CATEGORIES.tous), Droit: keys.map(() => 'lecture'), Telecharger: keys.map(() => true) }];

// Les règles à poser, par ressource : celles de la table de partages (si elles manquent), des tables communes qui n'en ont pas, puis de chaque table de
// fichiers à faire.
function ruleGroups({ sharesRules, core, todo, filing }) {
  return [
    ...(sharesRules ? [] : [{ tableId: SHARES_TABLE, colIds: 'Auteur,AuteurAcces', rules: stampRules() },
      { tableId: SHARES_TABLE, colIds: '*', rules: shareRules() }]),
    ...[...core.missing, ...core.unruled].flatMap(([name, , publicColumns, publicRules, tableRules]) =>
      [...(publicRules ? [{ tableId: name, colIds: publicColumns, rules: publicRules() }] : []), { tableId: name, colIds: '*', rules: tableRules() }]),
    ...todo.flatMap(target => [...(target.stamped ? [{ tableId: target.table, colIds: STAMP,
      rules: stampRules('l’auteur d’un fichier est écrit par Grist, personne ne le change') }] : []),
      { tableId: target.table, colIds: '*', rules: fileRules(target) }]),
    ...(filing.covered ? [] : [{ tableId: FILING_TABLE, colIds: '*', rules: sharedRules() }]),
  ];
}

// Retirer le partage : les règles de GFS (note « GFS : Partages ») et leurs ressources. Les tables et les colonnes d'aide restent (rien d'une donnée ne
// s'efface) ; plus aucune règle ne les lit.
export function planUnsharing(existing) {
  const mine = existing.rules.filter(item => isSharingNote(item.memo));
  if (!mine.length) return { ok: false, reason: 'none' };
  const dropped = new Set(mine.map(item => item.id));
  const emptied = [...new Set(mine.map(item => item.resource))].filter(id => !existing.rules.some(item => item.resource === id && !dropped.has(item.id)));
  return { ok: true, actions: [['BulkRemoveRecord', '_grist_ACLRules', [...dropped]],
    ...(emptied.length ? [['BulkRemoveRecord', '_grist_ACLResources', emptied]] : [])] };
}

export const sharingActive = tables => tables.some(row => row.tableId === SHARES_TABLE);

// La ligne d'un partage à écrire : le droit, la personne (adresse ou catégorie), la fin d'accès éventuelle (secondes, 'Date' de Grist). L'auteur est écrit par
// Grist.
export function shareRecord({ target, who, right, download = false, end = null }) {
  const cleaned = String(who ?? '').trim();
  if (!target || !cleaned || !RIGHTS.includes(right)) return null;
  if (right === 'admin' && cleaned.startsWith('@')) return null; // l'administration est celle d'une personne ou d'un groupe, jamais d'une catégorie
  if (right === 'aucun' && cleaned.startsWith('@')) return null; // « Aucun accès » vise une personne ou un groupe, jamais une catégorie
  return { Cible: target, Personne: cleaned, Droit: right, Telecharger: Boolean(download), Fin: end ?? null };
}

// Ce que dit la table de partages d'une cible, pour la fenêtre : les lignes qui la visent (la racine `*` et, pour un fichier placé dans un espace, l'espace et
// ses dossiers : `extras` = [{ kind, name, target }], marquées héritées), triées, avec leur validité.
export function sharesOf(rows, target, extras = []) {
  const origin = row => (row.Cible === ROOT ? { kind: 'root' } : extras.find(item => item.target === row.Cible) || null);
  return rows.filter(row => row.Cible === target || origin(row)).map(row => ({
    id: row.id, who: String(row.Personne || ''), right: row.Droit, download: Boolean(row.Telecharger), end: row.Fin || null, inherited: row.Cible !== target,
      from: row.Cible === target ? null : origin(row), valid: row.Valide !== false, active: row.Actif !== false, author: String(row.Auteur || ''),
  })).sort((a, b) => Number(a.inherited) - Number(b.inherited) || a.who.localeCompare(b.who));
}

// Un nom de groupe se tape dans la fenêtre : sans `@` ni `#` au début, ni retour à la ligne, 60 signes au plus. Rend le nom propre ou null.
export function groupName(text) {
  const name = String(text ?? '').replace(/\s+/g, ' ').trim();
  return name && name.length <= 60 && !/^[@#]/.test(name) ? name : null;
}

// Les groupes pour la fenêtre : { id, name, count, source (la table lue, ou ''), here (les adresses tapées dans GFS) }, triés par nom. Un éditeur ne lit que le
// nom, le nombre et la source.
export const groupsOf = rows => (rows || []).map(row => ({ id: row.id, name: String(row.Nom || ''), count: Number(row.Nb) || 0,
  source: String(row.Source || ''), here: String(row.PersonnesIci || '') }))
  .filter(group => group.name).sort((a, b) => a.name.localeCompare(b.name));

// La ligne d'un groupe : tapé dans GFS (`people` : les adresses) ou lu d'une table (`source` : { table, email, group }, identifiants Grist vérifiés). Null si
// le nom ou un identifiant ne vaut rien.
export function groupRecord({ name, people = '', source = null }) {
  const clean = groupName(name);
  if (!clean) return null;
  if (!source) return { Nom: clean, PersonnesIci: String(people || '').trim(), Source: '', SourceEmail: '', SourceGroupe: '' };
  if (![source.table, source.email, source.group].every(isIdent)) return null;
  return { Nom: clean, PersonnesIci: '', Source: source.table, SourceEmail: source.email, SourceGroupe: source.group };
}

// L'ajout d'un groupe lu d'une table : la formule de `Membres` relue avec toutes les sources (celles d'avant et la nouvelle), puis la ligne.
export function planGroupAdd(rows, record) {
  if (!record) return { ok: false, reason: 'invalid' };
  if ((rows || []).some(row => String(row.Nom || '').trim().toLowerCase() === record.Nom.toLowerCase())) return { ok: false, reason: 'exists' };
  const actions = [];
  if (record.Source) actions.push(...planGroupSources(sourcesOf([...(rows || []), record])).actions);
  actions.push(['AddRecord', GROUPS_TABLE, null, record]);
  return { ok: true, actions };
}

// Lire les groupes d'une table du document : un groupe par valeur distincte de la colonne des groupes (`names`), les noms pris ou douteux laissés. Rend { ok,
// actions, added, skipped } ou { ok: false, reason }.
export function planGroupsRead(rows, source, names) {
  if (!source || ![source.table, source.email, source.group].every(isIdent)) return { ok: false, reason: 'invalid' };
  const taken = new Set((rows || []).map(row => String(row.Nom || '').trim().toLowerCase()));
  const fresh = [];
  for (const name of [...new Set((names || []).map(groupName).filter(Boolean))]) {
    if (taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    fresh.push(groupRecord({ name, source }));
  }
  const skipped = new Set((names || []).map(item => String(item ?? '').trim()).filter(Boolean)).size - fresh.length;
  if (!fresh.length) return { ok: false, reason: 'none', skipped };
  return { ok: true, added: fresh.length, skipped, actions: [...planGroupSources(sourcesOf([...(rows || []), ...fresh])).actions,
    ['BulkAddRecord', GROUPS_TABLE, fresh.map(() => null), Object.fromEntries(Object.keys(fresh[0]).map(key => [key, fresh.map(record => record[key])]))]] };
}

// ---------- les espaces, vus par les écrans (lot 4b) ----------

// La clé d'un espace d'après son nom : minuscules, sans accent, tirets ; unique parmi `taken`. Rend '' si le nom ne donne rien.
export function spaceKey(name, taken = []) {
  const base = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!base) return '';
  const used = new Set(taken);
  let key = base;
  for (let at = 2; used.has(key); at += 1) key = `${base}-${at}`;
  return key;
}

// Les espaces pour la fenêtre : { id, key, name, people (qui y a accès), groups: [{ id (la ligne de partage), group, right }] }, triés par nom. `shares` : les
// lignes de GFS_Partages.
export function spacesOf(spaceRows, shareRows) {
  return (spaceRows || []).filter(row => row.Cle && row.Nom).map(row => ({
    id: row.id, key: String(row.Cle), name: String(row.Nom), people: Array.isArray(row.Voit) ? row.Voit.filter(item => typeof item === 'string').length : 0,
    groups: (shareRows || []).filter(share => share.Cible === spaceTarget(row.Cle) &&
      isGroup(share.Personne)).map(share => ({ id: share.id, group: String(share.Personne).slice(1), right: share.Droit })),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Créer un espace : la ligne, et la personne qui le crée y entre (écriture : elle le voit, y range des fichiers ; sans cela un espace neuf est « vide de
// monde » et on ne l'y retrouve pas) ; aucun groupe n'y entre tant qu'on ne l'a pas dit. `creator` : l'adresse de la personne, ou rien. Refuse un nom vide ou
// déjà pris.
export function planSpaceAdd(spaceRows, name, creator = '') {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 60) return { ok: false, reason: 'invalid' };
  if ((spaceRows || []).some(row => String(row.Nom || '').trim().toLowerCase() === clean.toLowerCase())) return { ok: false, reason: 'exists' };
  const key = spaceKey(clean, (spaceRows || []).map(row => row.Cle));
  if (!key) return { ok: false, reason: 'invalid' };
  const member = shareRecord({ target: spaceTarget(key), who: String(creator ?? '').trim().toLowerCase(), right: 'ecriture' });
  return { ok: true, key, actions: [['AddRecord', SPACES_TABLE, null, { Cle: key, Nom: clean }],
    ...(member ? [['AddRecord', SHARES_TABLE, null, member]] : [])] };
}

// Supprimer un espace : sa ligne, les partages de l'espace et de ses dossiers, et les placements (les fichiers restent, simplement hors de l'espace).
export function planSpaceRemove(space, shareRows, placeRows) {
  if (!space) return { ok: false, reason: 'none' };
  const mine = target => target === spaceTarget(space.key) || String(target).startsWith(`dossier:${space.key}/`);
  const shares = (shareRows || []).filter(share => mine(share.Cible)).map(share => share.id);
  const places = (placeRows || []).filter(place => place.Espace === space.key).map(place => place.id);
  return { ok: true, actions: [...(shares.length ? [['BulkRemoveRecord', SHARES_TABLE, shares]] : []),
    ...(places.length ? [['BulkRemoveRecord', PLACE_TABLE, places]] : []), ['RemoveRecord', SPACES_TABLE, space.id]] };
}

// Donner à un groupe un rôle dans l'espace (lecture ou écriture), le changer ou le retirer (`right` null). L'administration d'un espace n'est pas encore donnée
// à un groupe.
export function planSpaceGroup(space, shareRows, group, right) {
  const name = String(group ?? '').replace(/^#/, '');
  if (!space || !name) return { ok: false, reason: 'invalid' };
  const current = (shareRows || []).find(share => share.Cible === spaceTarget(space.key) && String(share.Personne) === `${GROUP_PREFIX}${name}`);
  if (!right) return current ? { ok: true, actions: [['RemoveRecord', SHARES_TABLE, current.id]] } : { ok: true, actions: [] };
  if (!['lecture', 'ecriture'].includes(right)) return { ok: false, reason: 'invalid' };
  if (current) return { ok: true, actions: [['UpdateRecord', SHARES_TABLE, current.id, { Droit: right }]] };
  return { ok: true, actions: [['AddRecord', SHARES_TABLE, null, shareRecord({ target: spaceTarget(space.key), who: `${GROUP_PREFIX}${name}`, right })]] };
}
