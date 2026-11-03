// Le manifeste (contrats 2.8) : ceux du prototype sont valides, et chaque règle a son cas qui échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifest, isSafePath, loadAll, label, listCapabilities } from '../js/manifest.js';
import { CATALOGUE } from '../js/catalogue.js';
import { iconNames } from '../js/icons.js';
import { publipostage, automation, form, readJson, ROOT } from './helpers.mjs';

const bad = (mutate, others) => { const m = publipostage(); mutate(m); const r = validateManifest(m, others); assert.equal(r.ok, false); return r.errors.join(' | '); };

test('les manifestes provisoires du prototype sont valides, ensemble', () => {
  assert.deepEqual(validateManifest(publipostage()), { ok: true, errors: [] });
  assert.deepEqual(validateManifest(automation(), [publipostage()]), { ok: true, errors: [] });
  assert.deepEqual(validateManifest(form(), [publipostage(), automation()]), { ok: true, errors: [] });
});

test('contrats 2.2 : champs obligatoires et formats', () => {
  assert.match(bad(m => { m.id = 'Publi'; }), /id hors format/);
  assert.match(bad(m => { delete m.nom; }), /nom/);
  assert.match(bad(m => { m.contrat = 7; }), /contrat 7/);
  assert.match(bad(m => { m.tables.prefixe = 'publipostage_'; }), /prefixe/);
  assert.match(bad(m => { m.tables.prefixe = 'Pub_Lipostage_'; }), /prefixe/);
  assert.match(bad(m => { m.tables.prefixe = 'GFS_'; }), /GFS_/);
  assert.match(bad(m => { m.entree = '../index.html'; }), /entree/);
  assert.match(bad(m => { m.entree = '_hidden/index.html'; }), /entree/);
  assert.match(bad(m => { m.entree = 'https://exemple.org/x.html'; }), /entree/);
});

test('contrats 2.3 et 2.5 : préfixes qui ne se chevauchent pas, clés de réglages uniques', () => {
  const other = automation();
  assert.match(bad(m => { m.tables.prefixe = 'Automation_'; m.id = 'autre'; }, [other]), /chevauche/);
  assert.match(bad(m => { m.tables.prefixe = 'Auto_'; m.id = 'autre'; }, [{ ...other, tables: { prefixe: 'Auto_Mat_' } }]), /chevauche|prefixe/);
  assert.match(bad(m => { m.reglages.push('workflow'); }, [other]), /workflow/);
  assert.match(bad(m => { m.reglages.push('gfs.apps'); }), /gfs\./);
  assert.match(bad(m => { m.id = 'automation'; }, [other]), /déjà pris/);
});

test('contrats 2.4 : les tables de fichiers sont dans le préfixe, avec id et nom', () => {
  assert.match(bad(m => { m.fichiers[0].table = 'Clients'; }), /hors du préfixe/);
  assert.match(bad(m => { delete m.fichiers[0].colonnes.id; }), /id et nom/);
  assert.match(bad(m => { m.fichiers[0].colonnes.date = 3; }), /chaîne/);
});

test('contrats 2.4 : le rangement propre à une app est une table du préfixe, aux colonnes nommées', () => {
  assert.match(bad(m => { m.fichiers[0].rangement.table = 'Clients'; }), /rangement\.table hors du préfixe/);
  assert.match(bad(m => { m.fichiers[0].rangement = 'x'; }), /rangement\.table/);
  assert.match(bad(m => { m.fichiers[0].rangement.dossier = 3; }), /rangement\.dossier/);
});

test('contrats 2.6 et 2.8 : la bibliothèque d\'une extension est un id et une version exacte', () => {
  assert.deepEqual(publipostage().extensions[0].bibliotheques, [{ id: 'plotly', version: '2.13.2' }, { id: 'echarts', version: '6.1.0' }]);
  assert.match(bad(m => { m.extensions[0].bibliotheques[0].version = 'latest'; }), /version de plotly doit être exacte/);
  assert.match(bad(m => { m.extensions[0].bibliotheques[0].version = '^2.13.2'; }), /exacte/);
  assert.match(bad(m => { m.extensions[0].bibliotheques[0].version = '>=2'; }), /exacte/);
  assert.match(bad(m => { m.extensions[0].bibliotheques[0].version = '2.13'; }), /exacte/);
  assert.match(bad(m => { delete m.extensions[0].bibliotheques[0].version; }), /exacte/);
  assert.match(bad(m => { delete m.extensions[0].bibliotheques[0].id; }), /sans id/);
  assert.match(bad(m => { m.extensions[0].bibliotheques = 'plotly'; }), /liste attendue/);
  const ok = publipostage();
  ok.extensions[0].bibliotheques.push({ id: 'autre-lib', version: '1.0.0-rc.1' });
  assert.equal(validateManifest(ok).ok, true);
});

test('contrats 2.8 : règles des permissions', () => {
  assert.match(bad(m => { m.permissions.acces = 'tout'; }), /acces/);
  assert.match(bad(m => { m.permissions.acces = 'read table'; }), /accès full/);
  assert.match(bad(m => { m.permissions.lit = ['Clients']; m.permissions.ecrit = ['Autre']; }), /couvert par lit/);
  assert.match(bad(m => { m.permissions.gristInterne[0].pourquoi = { fr: 'a' }; }), /pourquoi/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Shares'], lit: true, pourquoi: { fr: 'a', en: 'a' } }); }), /ne se lit jamais/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Triggers'], lit: true, pourquoi: { fr: 'a', en: 'a' } }); }), /ne se lit jamais/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_ACLRules'], lit: true, ecrit: ['x'], pourquoi: { fr: 'a', en: 'a' } }); }), /jamais écrite/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Views_section'], lit: true, ecrit: ['options'], pourquoi: { fr: 'a', en: 'a' } }); }), /options/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Pages'], ecrit: ['pagePos'], pourquoi: { fr: 'a', en: 'a' } }); }), /lit: true/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Pages'], lit: true, ecrit: ['shareRef'], pourquoi: { fr: 'a', en: 'a' } }); }), /shareRef/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Pages', '_grist_Views'], lit: true, ecrit: ['pagePos'], pourquoi: { fr: 'a', en: 'a' } }); }), /une seule table/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['Clients'], lit: true, pourquoi: { fr: 'a', en: 'a' } }); }), /pas une table interne/);
  assert.match(bad(m => { m.permissions.jeton = { lectureSeule: true }; }), /jeton/);
  assert.match(bad(m => { m.permissions.formules = true; }), /formules/);
});

// Contrats 3.3 point 9 et 11.9 point 4c (décision du porteur, 03/11) : un lien public ne lit, parmi les tables de l'app qui publie, que les petites tables que son manifeste nomme.
test('contrats 3.3 point 9 : `lienPublic` nomme des petites tables du préfixe de l\'app, jamais toutes, jamais celle de ses fichiers', () => {
  const withLink = (patterns, mutate = () => {}) => { const m = form(); m.permissions.lienPublic = { lit: patterns, pourquoi: { fr: 'a', en: 'a' } }; mutate(m); return validateManifest(m, [publipostage(), automation()]); };
  assert.deepEqual(form().permissions.lienPublic.lit, ['FormPlus_Pub_*'], 'Form+ déclare ses petites tables, et elles seules');
  assert.equal(withLink(['FormPlus_Pub_*']).ok, true);
  assert.equal(withLink(['FormPlus_Pub_12']).ok, true, 'un nom de table suffit');
  assert.equal(withLink(['formplus_pub_*']).ok, true, 'la casse ne compte pas (contrats 2.3)');
  const errorsOf = (patterns, mutate) => { const r = withLink(patterns, mutate); assert.equal(r.ok, false, JSON.stringify(patterns)); return r.errors.join(' | '); };
  assert.match(errorsOf(['*']), /doit être un nom de table, ou un préfixe suivi de « \* »/, '« * » seul désigne les tables de la personne : jamais celles de l\'app');
  assert.match(errorsOf(['Clients']), /hors du préfixe de l'app/);
  assert.match(errorsOf(['Publipostage_*']), /hors du préfixe de l'app/);
  assert.match(errorsOf(['FormPlus_*']), /couvre toutes les tables de l'app/);
  assert.match(errorsOf(['FormPlus_']), /couvre toutes les tables de l'app/);
  assert.match(errorsOf(['FormPlus_F*']), /couvre FormPlus_Formulaires, la table des fichiers de l'app/);
  assert.match(errorsOf(['FormPlus_Formulaires']), /couvre FormPlus_Formulaires, la table des fichiers de l'app/);
  assert.match(errorsOf(['FormPlus_Pub_*'], m => { m.fichiers[0].rangement = { table: 'FormPlus_Pub_Rangement', utilisateur: 'U', fichier: 'F', dossier: 'D', epingle: 'E' }; }), /couvre FormPlus_Pub_Rangement/, 'ni celle de son rangement');
  assert.match(errorsOf(['Form*Plus_Pub_*']), /doit être un nom de table/);
  assert.match(errorsOf(['Formplus_Pub_é*']), /doit être un nom de table/);
  assert.match(errorsOf([]), /liste de motifs attendue/);
  assert.match(errorsOf('FormPlus_Pub_*'), /liste de motifs attendue/);
  assert.match(errorsOf([3]), /liste de motifs attendue/);
  const noReason = form(); noReason.permissions.lienPublic = { lit: ['FormPlus_Pub_*'] };
  assert.match(validateManifest(noReason).errors.join(' | '), /lienPublic : pourquoi doit porter fr et en/);
  const notObject = form(); notObject.permissions.lienPublic = ['FormPlus_Pub_*'];
  assert.match(validateManifest(notObject).errors.join(' | '), /lienPublic/);
  const readOnly = publipostage();
  readOnly.permissions = { acces: 'read table', lienPublic: { lit: ['Publipostage_Pub_*'], pourquoi: { fr: 'a', en: 'a' } } };
  assert.match(validateManifest(readOnly).errors.join(' | '), /accès full/, 'déclarer une lecture publique demande l\'accès full comme tout le reste');
});

test('contrats 3.4, point 6 : `identite` se déclare avec sa raison en français et en anglais, sans demander l\'accès full', () => {
  const why = { fr: 'Pour « Mes tâches » : afficher les tâches de la personne', en: 'For “My tasks”: show the person\'s own tasks' };
  const declaring = (access = 'full') => { const m = publipostage(); m.permissions.acces = access; m.permissions.identite = { pourquoi: why }; return m; };
  assert.equal(validateManifest(declaring()).ok, true);
  const noReason = publipostage(); noReason.permissions.identite = {};
  assert.match(validateManifest(noReason).errors.join(' | '), /permissions\.identite : pourquoi doit porter fr et en/);
  const noEnglish = publipostage(); noEnglish.permissions.identite = { pourquoi: { fr: 'a' } };
  assert.match(validateManifest(noEnglish).errors.join(' | '), /permissions\.identite : pourquoi doit porter fr et en/);
  const notObject = publipostage(); notObject.permissions.identite = true;
  assert.match(validateManifest(notObject).errors.join(' | '), /permissions\.identite/);
  // Elle ne contourne aucun filtre de tables : une app qui ne lit rien du document peut vouloir savoir qui est là.
  const bare = { ...publipostage(), permissions: { acces: 'none', identite: { pourquoi: why } } };
  assert.equal(validateManifest(bare).ok, true, 'ni lit, ni ecrit, ni accès full : valable');
  const readOnly = { ...publipostage(), permissions: { acces: 'read table', identite: { pourquoi: why } } };
  assert.equal(validateManifest(readOnly).ok, true);
  // Les manifestes du prototype n\'en déclarent aucune tant qu\'une app ne l\'a pas demandée à GFS.
  for (const m of [publipostage(), automation(), form()]) assert.equal(m.permissions.identite, undefined, m.id);
});

test('contrats 3.4 : listCapabilities dit, pour chaque app, les capacités déclarées et leur raison (ce que lit un client)', () => {
  const why = { fr: 'Pour « Mes tâches »', en: 'For “My tasks”' };
  const withIdentity = publipostage(); withIdentity.permissions.identite = { pourquoi: why };
  const rows = listCapabilities([withIdentity, automation(), form()]);
  const identity = rows.filter(row => row.capacite === 'identite');
  assert.deepEqual(identity, [{ app: 'publipostage', nom: withIdentity.nom, capacite: 'identite', detail: '', pourquoi: why }], 'une seule app, avec sa raison');
  const formKinds = new Set(rows.filter(row => row.app === 'form').map(row => row.capacite));
  for (const kind of ['formules', 'jeton', 'lienPublic', 'structure', 'gristInterne']) assert.ok(formKinds.has(kind), `Form+ déclare ${kind}`);
  const link = rows.find(row => row.capacite === 'lienPublic');
  assert.equal(link.detail, form().permissions.lienPublic.lit.join(', '), 'les motifs que le lien public lit');
  assert.ok(rows.every(row => row.pourquoi && row.pourquoi.fr && row.pourquoi.en), 'chaque ligne porte sa raison dans les deux langues');
  assert.deepEqual(listCapabilities([{ id: 'vide', nom: { fr: 'a', en: 'a' } }]), [], 'une app sans permissions ne déclare rien');
  assert.deepEqual(listCapabilities([]), []);
});

test('contrats 2.8 : le dossier d\'une extension reste dans l\'app', () => {
  assert.match(bad(m => { m.extensions[0].dossier = '../autre/'; }), /dossier/);
  assert.equal(isSafePath('extensions/graphique'), true);
  assert.equal(isSafePath('extensions/.cache'), false);
  assert.equal(isSafePath(''), false);
});

// Les renvois du manifeste réel que le validateur ne juge pas (il juge la forme) : un type d'extension nomme une extension qui existe et qui le déclare
// en point d'entrée `type` ; un point d'entrée `type` renvoie à un type de l'app qui lui appartient ; ce que l'app ouvre est un type déclaré.
test('contrats 2.4 et 2.6 : les renvois du manifeste de Publipostage+ se recoupent (type d\'extension, point d\'entrée, ouverture)', () => {
  const m = publipostage();
  const types = m.fichiers[0].types;
  const owners = new Map(m.extensions.map(extension => [extension.id, extension]));
  for (const type of types.filter(item => item.extension)) {
    const owner = owners.get(type.extension);
    assert.ok(owner, `${type.valeur} : l'extension ${type.extension} existe`);
    assert.ok((owner.pointsEntree || []).some(point => point.genre === 'type' && point.id === type.valeur), `${type.extension} déclare le type ${type.valeur}`);
  }
  for (const extension of m.extensions) {
    for (const point of (extension.pointsEntree || []).filter(item => item.genre === 'type')) {
      const type = types.find(item => item.valeur === point.id);
      assert.ok(type && type.extension === extension.id, `${extension.id} : le type ${point.id} est déclaré et lui appartient`);
    }
  }
  for (const valeur of m.actions.ouvrir) assert.ok(types.some(item => item.valeur === valeur), `ouvrir : ${valeur} est un type déclaré`);
  const slides = types.find(item => item.valeur === 'presentation');
  assert.deepEqual([slides.couleur, slides.icone, slides.extension], ['presentation', 'slides', 'diapositives']);
  assert.ok(m.actions.ouvrir.includes('presentation'), 'le double-clic d\'une présentation ouvre l\'app (contrats 5.4)');
});

// Form+ (consigne 007) : l'app est dans le catalogue, son type de fichier est « Formulaire », et sa déclaration ne nomme rien de ce que le
// courtier refuse (contrats 3.3 point 6 : `options` d'une section, `_grist_Shares`).
test('contrats 2.4, 3.3 et 8 : le manifeste de Form+ range ses formulaires dans une table du préfixe, sans options ni partage', () => {
  const m = form();
  const [files] = m.fichiers;
  assert.ok(CATALOGUE.some(entry => entry.id === 'form' && entry.dossier === 'apps/form/'));
  assert.equal(files.table, 'FormPlus_Formulaires');
  assert.equal(files.typeParDefaut, 'formulaire');
  assert.deepEqual(files.types.map(item => item.valeur), ['formulaire']);
  assert.ok(files.types.every(item => item.couleur === undefined), 'la couleur est réservée au document, à la grille et à la présentation (charte)');
  assert.deepEqual(m.actions.ouvrir, ['formulaire'], 'la porte « ouvrir » est ouverte depuis la consigne 010 de Form+ (c249c4a) : « Nouveau » et le double-clic démarrent l\'app');
  assert.ok(m.permissions.formules.pourquoi.fr && m.permissions.formules.pourquoi.en, 'la colonne d\'essai du mode interne lit user.Email par une formule : elle se déclare, avec son pourquoi');
  assert.deepEqual(m.extensions || [], [], 'Leaflet vient avec sa consigne, pas avec l\'entrée de l\'app');
  const internal = m.permissions.gristInterne;
  assert.ok(internal.every(entry => !(entry.ecrit || []).includes('options')), 'la définition ne passe plus par les options de la section');
  assert.ok(internal.every(entry => !entry.tables.includes('_grist_Shares')), '_grist_Shares ne se lit jamais');
  assert.ok(m.permissions.structure.pourquoi.fr && m.permissions.structure.pourquoi.en, 'la structure se déclare, avec son pourquoi');
  assert.equal(m.permissions.jeton.lectureSeule, true, 'cc21a27 : le jeton de Form+ ne sert qu\'à télécharger une pièce jointe, en lecture seule (accord du porteur, 22/10)');
  assert.ok(m.permissions.jeton.pourquoi.fr && m.permissions.jeton.pourquoi.en, 'le jeton se déclare, avec son pourquoi');
  const attachments = internal.find(entry => entry.tables.includes('_grist_Attachments'));
  assert.ok(attachments && attachments.lit === true && attachments.ecrit === undefined && attachments.retire === undefined, '_grist_Attachments se lit, ne s\'écrit jamais');
  assert.deepEqual(attachments.tables, ['_grist_Attachments']);
  const names = iconNames();
  for (const name of [m.icone, ...files.types.map(item => item.icone)]) assert.ok(names.includes(name), `l'icône ${name} est dans la feuille de symboles`);
});

test('contrats 2.1 point 3 : un manifeste illisible ou invalide reste dans la liste, grisé, avec le motif', async () => {
  const fetchJson = async path => {
    if (path.includes('automation')) throw new Error('404');
    return readJson(path);
  };
  const loaded = await loadAll(CATALOGUE, fetchJson);
  assert.equal(loaded.length, CATALOGUE.length);
  assert.equal(loaded[0].ok, true);
  assert.equal(loaded[1].ok, false);
  assert.match(loaded[1].errors[0], /illisible/);
  assert.deepEqual(loaded.filter(item => item.ok).map(item => item.manifest.id), CATALOGUE.map(entry => entry.id).filter(id => id !== 'automation'));
  const wrongId = await loadAll(CATALOGUE, async path => ({ ...readJson(path), id: 'zzz' }));
  assert.match(wrongId[0].errors.join(), /catalogue/);
});

test('les noms bilingues se lisent dans la langue de la personne', () => {
  assert.equal(label({ fr: 'Graphique', en: 'Chart' }, 'en'), 'Chart');
  assert.equal(label({ fr: 'Graphique' }, 'en'), 'Graphique');
  assert.equal(label(null, 'fr'), '');
});

test('texte, icone et poids (fenêtre des apps et extensions) : facultatifs, mais bien formés quand ils sont là', () => {
  assert.ok(validateManifest(publipostage(), [automation()]).ok);
  const withText = extra => ({ ...publipostage(), ...extra });
  assert.match(validateManifest(withText({ texte: { fr: 'seulement le français' } }), [automation()]).errors.join('|'), /texte doit porter fr et en/);
  assert.match(validateManifest(withText({ icone: 3 }), [automation()]).errors.join('|'), /icone : chaîne attendue/);
  const heavy = publipostage();
  heavy.extensions[0].poids = -4;
  heavy.extensions[0].texte = 'une chaîne';
  const errors = validateManifest(heavy, [automation()]).errors.join('|');
  assert.match(errors, /extension graphique : poids/);
  assert.match(errors, /extension graphique : texte doit porter fr et en/);
});

const folderBytes = dir => readdirSync(dir, { withFileTypes: true })
  .reduce((total, item) => total + (item.isDirectory() ? folderBytes(join(dir, item.name)) : statSync(join(dir, item.name)).size), 0);

test('le poids annoncé de chaque extension est la taille de son dossier dans l\'app référencée, en Ko arrondis', () => {
  let compared = 0;
  for (const entry of CATALOGUE) {
    const dir = join(ROOT, entry.dossier);
    for (const ext of existsSync(dir) ? readJson(entry.manifeste).extensions || [] : []) {
      if (ext.poids === undefined || !existsSync(join(dir, ext.dossier))) continue;
      assert.equal(ext.poids, Math.round(folderBytes(join(dir, ext.dossier)) / 1000), `${entry.id} / ${ext.id}`);
      compared++;
    }
  }
  // Sous-module non récupéré : rien à comparer. Récupéré, les trois extensions de Publipostage+ le sont.
  assert.ok(compared === 0 || compared >= 3, `${compared} extension(s) comparée(s)`);
});

// « Nouveau > Importer » (contrats 2.7, point 4) : les formats qu'une app reçoit d'un autre logiciel, chacun avec le type qu'il crée.
test('contrats 2.7, point 4 : Publipostage+ déclare Excel, Markdown et PowerPoint, chacun vers un type qu\'il ouvre', () => {
  const { importer, ouvrir } = publipostage().actions;
  assert.deepEqual(importer.map(item => [item.valeur, item.type]), [['excel', 'grille'], ['markdown', 'document'], ['powerpoint', 'presentation']]);
  for (const item of importer) {
    assert.ok(ouvrir.includes(item.type), `${item.valeur} : ${item.type} est un type que l'app ouvre`);
    assert.ok(item.extensions.every(extension => /^\.[a-z0-9]{1,8}$/i.test(extension)), `${item.valeur} : des extensions « .ext »`);
  }
  assert.deepEqual(importer[0].extensions, ['.xlsx', '.xlsm'], 'ce que le sélecteur de l\'app propose déjà pour un classeur');
});

test('contrats 2.7 et 2.8 : un format importé mal formé invalide le manifeste', () => {
  assert.match(bad(m => { m.actions.importer = 'excel'; }), /actions\.importer : liste attendue/);
  assert.match(bad(m => { delete m.actions.importer[0].valeur; }), /valeur et nom/);
  assert.match(bad(m => { m.actions.importer[0].nom = { fr: 'Excel' }; }), /valeur et nom/);
  assert.match(bad(m => { m.actions.importer[1].valeur = 'excel'; }), /excel : valeur déjà prise/);
  assert.match(bad(m => { m.actions.importer[0].type = 'tableau'; }), /le type tableau n'est pas dans actions\.ouvrir/);
  assert.match(bad(m => { m.actions.ouvrir = ['document']; }), /le type grille n'est pas dans actions\.ouvrir/);
  assert.match(bad(m => { m.actions.importer[0].extensions = []; }), /extensions/);
  assert.match(bad(m => { m.actions.importer[0].extensions = ['xlsx']; }), /extensions/);
  assert.match(bad(m => { m.actions.importer[0].extensions = ['.xlsx', 3]; }), /extensions/);
  assert.match(bad(m => { delete m.actions.importer[0].extensions; }), /extensions/);
  const without = publipostage();
  delete without.actions.importer;
  assert.deepEqual(validateManifest(without), { ok: true, errors: [] }, 'une app qui n\'importe rien n\'a pas à le dire');
});

// Lire ce que GFS garde (contrats 2.7, point 5) : les types de fichiers (le PDF) qu'une app sait lire, et l'extension de l'app qui les lit.
test('contrats 2.7, point 5 : une app déclare le type de fichier que GFS garde et qu\'elle lit, avec l\'extension qui le lit', () => {
  const m = publipostage();
  m.extensions.push({ id: 'lecture-pdf', nom: { fr: 'Lecture de PDF', en: 'PDF reading' }, dossier: 'extensions/lecture-pdf/', bibliotheques: [{ id: 'pdfjs', version: '1.0.0' }] });
  m.actions.lire = [{ type: 'pdf', extension: 'lecture-pdf' }];
  assert.deepEqual(validateManifest(m), { ok: true, errors: [] });
  delete m.actions.lire[0].extension;
  assert.deepEqual(validateManifest(m), { ok: true, errors: [] }, 'sans extension, c\'est le socle de l\'app qui lit');
  assert.deepEqual(validateManifest(publipostage()), { ok: true, errors: [] }, 'une app qui ne lit rien n\'a pas à le dire');
});

test('contrats 2.7 et 2.8 : un type lu mal formé invalide le manifeste', () => {
  assert.match(bad(m => { m.actions.lire = 'pdf'; }), /actions\.lire : liste attendue/);
  assert.match(bad(m => { m.actions.lire = [{}]; }), /actions\.lire\[\] : un type de fichier attendu/);
  assert.match(bad(m => { m.actions.lire = ['pdf']; }), /un type de fichier attendu/);
  assert.match(bad(m => { m.actions.lire = [{ type: 'PDF' }]; }), /un type de fichier attendu/);
  assert.match(bad(m => { m.actions.lire = [{ type: 'pdf' }, { type: 'pdf' }]; }), /actions\.lire pdf : type déjà déclaré/);
  assert.match(bad(m => { m.actions.lire = [{ type: 'pdf', extension: 'lecture-pdf' }]; }), /actions\.lire pdf : l'extension lecture-pdf n'est pas déclarée dans extensions/);
  assert.match(bad(m => { m.actions.lire = [{ type: 'pdf', extension: 'diapositives' }]; delete m.extensions[2]; m.extensions.length = 2; }), /l'extension diapositives n'est pas déclarée/);
});

// Ranger chez GFS (contrats 2.7, point 6) : les types de fichiers (le PDF) qu'une app demande à GFS de garder pour elle.
test('contrats 2.7, point 6 : une app déclare les types de fichiers qu\'elle demande à GFS de ranger', () => {
  const m = publipostage();
  m.actions.ranger = ['pdf'];
  assert.deepEqual(validateManifest(m), { ok: true, errors: [] });
  m.actions.ranger = [];
  assert.deepEqual(validateManifest(m), { ok: true, errors: [] }, 'une liste vide ne déclare rien');
  assert.deepEqual(validateManifest(publipostage()), { ok: true, errors: [] }, 'une app qui ne range rien n\'a pas à le dire');
});

test('contrats 2.7 et 2.8 : un type rangé mal formé invalide le manifeste', () => {
  assert.match(bad(m => { m.actions.ranger = 'pdf'; }), /actions\.ranger : liste attendue/);
  assert.match(bad(m => { m.actions.ranger = [{ type: 'pdf' }]; }), /actions\.ranger\[\] : un type de fichier attendu/);
  assert.match(bad(m => { m.actions.ranger = [3]; }), /un type de fichier attendu/);
  assert.match(bad(m => { m.actions.ranger = ['PDF']; }), /un type de fichier attendu/);
  assert.match(bad(m => { m.actions.ranger = ['']; }), /un type de fichier attendu/);
  assert.match(bad(m => { m.actions.ranger = ['pdf', 'pdf']; }), /actions\.ranger pdf : type déjà déclaré/);
});
