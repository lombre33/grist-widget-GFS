// Le manifeste (contrats 2.8) : ceux du prototype sont valides, et chaque règle a son cas qui échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifest, isSafePath, loadAll, label } from '../js/manifest.js';
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
  assert.deepEqual(publipostage().extensions[0].bibliotheques, [{ id: 'plotly', version: '2.13.2' }]);
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
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['_grist_Pages', '_grist_Views'], lit: true, ecrit: ['pagePos'], pourquoi: { fr: 'a', en: 'a' } }); }), /une seule table/);
  assert.match(bad(m => { m.permissions.gristInterne.push({ tables: ['Clients'], lit: true, pourquoi: { fr: 'a', en: 'a' } }); }), /pas une table interne/);
  assert.match(bad(m => { m.permissions.jeton = { lectureSeule: true }; }), /jeton/);
  assert.match(bad(m => { m.permissions.formules = true; }), /formules/);
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
