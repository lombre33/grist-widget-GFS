// Les modèles de départ des apps (« Nouveau > Depuis un modèle », décision du porteur du 18/11 : « Une galerie commune » ; contrats 2.2, champ `modeles`, et 5.4, point 13) : ce que le manifeste peut
// déclarer, ce que GFS lit d'un catalogue (js/apps/templates-catalogue.js), la recherche de la fenêtre, et l'outil qui copie le catalogue d'une app dans GFS (outils/modeles.mjs). La fenêtre, à l'écran,
// se mesure sous Firefox (test/modeles-firefox.mjs) ; l'ouverture (`raison: 'modele'`), dans test/openings.test.mjs ; le grisé, dans test/entries.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest } from '../js/apps/manifest.js';
import { catalogueUrl, filterModels, loadCatalogue, NAME_MAX, parseCatalogue, TEXT_MAX, thumbUrl } from '../js/apps/templates-catalogue.js';
import { main, planApp, THUMB_MAX } from '../outils/modeles.mjs';
import { catalogue, publipostage, readJson, ROOT } from './helpers.mjs';

const L = (fr, en) => ({ fr, en });
const entry = (id, extra = {}) => ({ id, type: 'document', nom: L(`Modèle ${id}`, `Template ${id}`), ...extra });
const withModeles = modeles => ({ ...publipostage(), modeles });
const errorsOf = modeles => validateManifest(withModeles(modeles)).errors;

test('un manifeste sans `modeles` reste valide : le champ est facultatif', () => {
  const { modeles, ...rest } = publipostage();
  assert.ok(modeles, 'Publipostage+ déclare son catalogue provisoire');
  assert.deepEqual(validateManifest(rest).errors, []);
  assert.deepEqual(validateManifest(publipostage()).errors, []);
});

test('`modeles.catalogue` est le chemin relatif sûr d\'un fichier .json : jamais une adresse, un dossier caché ou un autre format', () => {
  assert.deepEqual(errorsOf({ catalogue: 'publipostage/modeles.json' }), []);
  for (const bad of ['https://exemple.fr/modeles.json', '../modeles.json', '/etc/modeles.json', 'publipostage/_cache/modeles.json', 'publipostage/.cache/modeles.json', 'publipostage/modeles.js', 'publipostage', 'publipostage\\modeles.json']) {
    assert.match(errorsOf({ catalogue: bad }).join(), /modeles\.catalogue/, bad);
  }
  assert.match(errorsOf('rien').join(), /modeles\.catalogue/);
  assert.match(errorsOf({}).join(), /modeles\.catalogue/);
});

test('`ouverture.modele` est un genre d\'ouverture de plus : un booléen, comme les autres', () => {
  assert.deepEqual(validateManifest({ ...publipostage(), ouverture: { fichier: true, modele: true } }).errors, []);
  assert.match(validateManifest({ ...publipostage(), ouverture: { modele: 'oui' } }).errors.join(), /ouverture/);
});

test('un catalogue bien formé : chaque entrée reste, dans l\'ordre du fichier', () => {
  const raw = [entry('a', { description: L('Une description.', 'A description.'), etiquettes: [L('Vente', 'Sales')], vignette: 'a.webp', tables: true }), entry('b', { type: 'grille' }), entry('c', { extensions: ['graphique'] })];
  const { models, dropped } = parseCatalogue(raw, publipostage());
  assert.deepEqual(models.map(model => model.id), ['a', 'b', 'c']);
  assert.deepEqual(dropped, []);
});

test('une entrée mal formée est écartée avec sa raison, les autres restent', () => {
  const raw = [
    entry('bon'), 'pas un objet', entry('Mauvais Id'), entry('type-inconnu', { type: 'planete' }), entry('sans-fr', { nom: { fr: '', en: 'x' } }),
    entry('nom-long', { nom: L('x'.repeat(NAME_MAX + 1), 'x') }), entry('texte-long', { description: L('x'.repeat(TEXT_MAX + 1), 'x') }), entry('etiquette', { etiquettes: ['vente'] }),
    entry('vignette-url', { vignette: 'https://exemple.fr/a.webp' }), entry('vignette-svg', { vignette: 'a.svg' }), entry('vignette-haut', { vignette: '../a.webp' }),
    entry('extension', { extensions: ['inconnue'] }), entry('tables', { tables: 'oui' }), entry('bon'),
  ];
  const { models, dropped } = parseCatalogue(raw, publipostage());
  assert.deepEqual(models.map(model => model.id), ['bon'], 'seul le premier « bon » reste : un identifiant ne compte qu\'une fois');
  assert.equal(dropped.length, raw.length - 1);
  assert.match(dropped.join('\n'), /id inattendu/);
  assert.match(dropped.join('\n'), /type « planete » que l'app ne sait pas ouvrir/);
  assert.match(dropped.join('\n'), /extension inconnue de l'app/);
  assert.match(dropped.join('\n'), /id « bon » déjà pris/);
  assert.deepEqual(parseCatalogue({ pas: 'une liste' }, publipostage()).models, []);
  assert.deepEqual(parseCatalogue(null, publipostage()).dropped, ['le catalogue n\'est pas une liste']);
});

test('le type d\'un modèle est un type que l\'app sait ouvrir (`actions.ouvrir`) ET qu\'elle déclare (`fichiers[].types`)', () => {
  const manifest = publipostage();
  const noOpen = { ...manifest, actions: { ...manifest.actions, ouvrir: ['document'] } };
  assert.deepEqual(parseCatalogue([entry('a', { type: 'grille' })], noOpen).models, [], 'la grille n\'est plus dans `actions.ouvrir`');
  assert.equal(parseCatalogue([entry('a', { type: 'document' })], noOpen).models.length, 1);
});

test('l\'adresse du catalogue et celle d\'une vignette sont dans le dossier `modeles/` de GFS, jamais ailleurs', () => {
  const manifest = publipostage();
  assert.equal(catalogueUrl(manifest), 'modeles/publipostage/modeles.json');
  assert.equal(thumbUrl(manifest, { vignette: 'facture.webp' }), 'modeles/publipostage/facture.webp');
  assert.equal(thumbUrl(manifest, {}), null, 'sans vignette : l\'icône du type');
  const { modeles, ...rest } = manifest;
  assert.equal(catalogueUrl(rest), null);
  assert.equal(thumbUrl(rest, { vignette: 'facture.webp' }), null);
});

test('la lecture d\'un catalogue : ok, bientôt (pas de `modeles`, ou vide), illisible (avec la raison) ; les entrées écartées sont dites sans tout casser', async () => {
  const manifest = publipostage();
  const warnings = [];
  const warn = text => warnings.push(text);
  const read = raw => async path => { assert.equal(path, 'modeles/publipostage/modeles.json'); if (raw instanceof Error) throw raw; return raw; };
  const ok = await loadCatalogue(manifest, read([entry('a'), entry('b', { type: 'planete' })]), warn);
  assert.deepEqual([ok.state, ok.models.length, ok.reason], ['ok', 1, '']);
  assert.equal(warnings.length, 1, 'l\'entrée écartée est un avertissement');
  assert.match(warnings[0], /publipostage.*type « planete »/);
  const empty = await loadCatalogue(manifest, read([]), warn);
  assert.deepEqual([empty.state, empty.reason], ['soon', '']);
  const allBad = await loadCatalogue(manifest, read([entry('x', { type: 'planete' })]), warn);
  assert.equal(allBad.state, 'broken');
  assert.match(allBad.reason, /type « planete »/);
  const failing = await loadCatalogue(manifest, read(new Error('modeles/publipostage/modeles.json : 404')), warn);
  assert.deepEqual([failing.state, failing.reason], ['broken', 'modeles/publipostage/modeles.json : 404']);
  const { modeles, ...none } = manifest;
  const soon = await loadCatalogue(none, async () => { throw new Error('rien ne se lit'); }, warn);
  assert.deepEqual([soon.state, soon.models], ['soon', []], 'sans `modeles`, rien n\'est lu');
});

// Les articles que la fenêtre cherche : le texte déjà dans la langue de la personne (js/broker/entries.js).
const article = (id, app, extra = {}) => ({ id, app, label: `Modèle ${id}`, description: '', tags: [], typeLabel: 'Document', appLabel: app, ...extra });

test('la recherche de la fenêtre : mots dans n\'importe quel ordre, accents, casse et ponctuation ignorés ; nom, description, étiquettes, type et app', () => {
  const entries = [
    article('facture', 'publipostage', { label: 'Facture, devis ou avoir', tags: ['Vente'] }),
    article('relance', 'publipostage', { label: 'Courrier de relance', description: 'Pour les impayés', tags: ['Vente'] }),
    article('inventaire', 'publipostage', { label: 'Fiche d’inventaire d’un emplacement', tags: ['Stock'], typeLabel: 'Grille' }),
    article('enquete', 'form', { label: 'Enquête de satisfaction', appLabel: 'Form+', typeLabel: 'Formulaire' }),
  ];
  const ids = query => filterModels(entries, { query }).map(item => item.id);
  assert.deepEqual(ids(''), ['facture', 'relance', 'inventaire', 'enquete'], 'sans recherche : tout, dans l\'ordre');
  assert.deepEqual(ids('devis facture'), ['facture'], 'les mots dans n\'importe quel ordre');
  assert.deepEqual(ids('FACTURE,  devis!'), ['facture'], 'casse et ponctuation ignorées');
  assert.deepEqual(ids('enquete satisfaction'), ['enquete'], 'accents ignorés');
  assert.deepEqual(ids('impayes'), ['relance'], 'la description se lit');
  assert.deepEqual(ids('vente'), ['facture', 'relance'], 'les étiquettes se lisent');
  assert.deepEqual(ids('grille'), ['inventaire'], 'le type se lit');
  assert.deepEqual(ids('form+'), ['enquete'], 'l\'app se lit');
  assert.deepEqual(ids('introuvable'), []);
  assert.deepEqual(filterModels(entries, { app: 'form' }).map(item => item.id), ['enquete'], 'le filtre par app');
  assert.deepEqual(filterModels(entries, { app: 'form', query: 'facture' }), [], 'l\'app et la recherche se cumulent');
  assert.equal(filterModels(entries, { app: 'all' }).length, 4);
});

// ---------- le catalogue provisoire de Publipostage+ que GFS porte ----------

test('le catalogue provisoire de Publipostage+ : 22 modèles bien formés, chacun avec sa vignette (légère) à côté', () => {
  const manifest = publipostage();
  const raw = readJson('modeles/publipostage/modeles.json');
  const { models, dropped } = parseCatalogue(raw, manifest);
  assert.deepEqual(dropped, []);
  assert.equal(models.length, 22);
  for (const model of models) {
    const file = join(ROOT, 'modeles', 'publipostage', model.vignette);
    assert.ok(existsSync(file), `${model.id} : la vignette ${model.vignette} est dans GFS`);
    assert.ok(statSync(file).size <= THUMB_MAX, `${model.id} : une vignette légère`);
  }
  assert.deepEqual(models.find(model => model.id === 'proposition-commerciale').extensions, ['graphique'], 'la présentation commerciale demande le graphique en plus de ses diapositives');
  assert.equal(models.find(model => model.id === 'proposition-commerciale').type, 'presentation');
  const files = readdirSync(join(ROOT, 'modeles', 'publipostage')).filter(name => /\.(webp|png|jpe?g)$/.test(name));
  assert.deepEqual(files.sort(), models.map(model => model.vignette).sort(), 'aucune vignette orpheline');
});

test('Publipostage+, Form+, Grist-BI et Automation+ déclarent `modeles` et savent ouvrir un modèle (Automation+ depuis sa 021, 0.15.4 ; GFS le déclare le 19/11)', () => {
  const declared = catalogue().filter(manifest => manifest.modeles);
  assert.deepEqual(declared.map(manifest => manifest.id).sort(), ['automation', 'bi', 'form', 'publipostage']);
  for (const id of ['publipostage', 'form', 'bi', 'automation']) assert.equal(declared.find(manifest => manifest.id === id).ouverture.modele, true, `${id} : ouverture.modele dit que l'app ouvre un modèle (contrats 5.4, point 13)`);
  const automation = declared.find(manifest => manifest.id === 'automation');
  assert.deepEqual(automation.actions.ouvrir, [], 'son type de modèle n\'ouvre ni « Nouveau » ni une ligne de l\'explorateur');
});

// ---------- le type des modèles d'une app sans type de fichier (Automation+, décision du porteur du 18/11 : « L'app demande ») ----------

const automation = () => catalogue().find(manifest => manifest.id === 'automation');
const typed = type => ({ ...automation(), modeles: { catalogue: 'automation/modeles.json', type } });
const AUTOMATISME = { valeur: 'automatisme', nom: L('Automatisme', 'Automation'), icone: 'bolt' };

test('`modeles.type` : la valeur, le nom bilingue et une icône ; jamais une valeur déjà prise par un type de fichier ni un texte quelconque', () => {
  assert.deepEqual(validateManifest(typed(AUTOMATISME)).errors, []);
  assert.deepEqual(validateManifest(typed({ valeur: 'automatisme', nom: L('A', 'A') })).errors, [], 'l\'icône est facultative');
  for (const bad of ['automatisme', {}, { ...AUTOMATISME, valeur: 'Automatisme' }, { ...AUTOMATISME, valeur: '../x' }, { ...AUTOMATISME, nom: 'Automatisme' }, { ...AUTOMATISME, nom: { fr: 'A' } }, { ...AUTOMATISME, icone: 3 }]) {
    assert.match(validateManifest(typed(bad)).errors.join(), /modeles\.type/, JSON.stringify(bad));
  }
  const clash = validateManifest({ ...withModeles({ catalogue: 'publipostage/modeles.json', type: { valeur: 'grille', nom: L('Grille', 'Grid') } }) });
  assert.match(clash.errors.join(), /modeles\.type grille : valeur déjà prise par un type de fichier/);
});

test('une app sans type de fichier : ses entrées n\'ont pas de `type`, GFS leur donne celui du manifeste ; un autre type est écarté', () => {
  const manifest = typed(AUTOMATISME);
  const raw = [{ id: 'a', nom: L('A', 'A') }, { id: 'b', type: 'automatisme', nom: L('B', 'B') }, { id: 'c', type: 'document', nom: L('C', 'C') }, { id: 'd', type: null, nom: L('D', 'D') }];
  const { models, dropped } = parseCatalogue(raw, manifest);
  assert.deepEqual(models.map(model => [model.id, model.type]), [['a', 'automatisme'], ['b', 'automatisme']]);
  assert.equal(dropped.length, 2);
  assert.match(dropped.join('\n'), /type « document » que l'app ne sait pas ouvrir/);
  assert.equal(parseCatalogue([{ id: 'a', nom: L('A', 'A') }], { ...automation(), modeles: { catalogue: 'automation/modeles.json' } }).models.length, 0, 'sans type déclaré, une entrée sans type reste écartée');
  assert.equal(parseCatalogue([{ id: 'a', nom: L('A', 'A') }], publipostage()).models.length, 0, 'et une app qui a des types de fichier ne reçoit pas de type par défaut');
});

test('le catalogue d\'Automation+ que GFS copie : cinq modèles bien formés, tous du type « automatisme », chacun avec sa vignette légère', () => {
  const manifest = automation();
  const raw = readJson('modeles/automation/modeles.json');
  const { models, dropped } = parseCatalogue(raw, manifest);
  assert.deepEqual(dropped, []);
  assert.deepEqual(models.map(model => model.id), ['statut-vers-archive', 'valeur-a-la-creation', 'seuil-a-verifier', 'total-calcule', 'copie-depuis-une-table']);
  for (const model of models) {
    assert.equal(model.type, 'automatisme');
    assert.ok(model.tables === undefined && model.extensions === undefined, `${model.id} : aucun modèle ne vient avec des tables ni une extension`);
    assert.ok(statSync(join(ROOT, 'modeles', 'automation', model.vignette)).size <= THUMB_MAX, `${model.id} : une vignette légère`);
  }
  const files = readdirSync(join(ROOT, 'modeles', 'automation')).filter(name => /\.(webp|png|jpe?g)$/.test(name));
  assert.deepEqual(files.sort(), models.map(model => model.vignette).sort(), 'aucune vignette orpheline');
});

// ---------- l'outil : outils/modeles.mjs ----------

// Une racine de GFS à part : les manifestes (lus tels quels) et le dépôt d'une app (`apps/publipostage/modeles/`).
function workspace(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gfs-modeles-'));
  cpSync(join(ROOT, 'manifestes'), join(root, 'manifestes'), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
const repo = (extra = {}) => ({
  'apps/publipostage/modeles/modeles.json': JSON.stringify([entry('facture', { vignette: 'facture.webp' }), entry('relance', { vignette: 'relance.webp' })]),
  'apps/publipostage/modeles/facture.webp': 'image de la facture', 'apps/publipostage/modeles/relance.webp': 'image de la relance', ...extra,
});
const run = (root, ...argv) => { const lines = []; const status = main(argv, root, text => lines.push(text)); return { status, lines }; };

test('l\'outil copie le catalogue et les vignettes de l\'app dans le dossier `modeles/` de GFS, et dit « à jour » ensuite', () => {
  const root = workspace(repo());
  try {
    const check = run(root, '--verifier');
    assert.equal(check.status, 1, 'avant la copie, tout est périmé');
    assert.match(check.lines.join('\n'), /publipostage : périmé \(3 fichier\(s\) à écrire, 0 à retirer\)/);
    assert.ok(!existsSync(join(root, 'modeles')), '--verifier n\'écrit rien');
    const copy = run(root);
    assert.equal(copy.status, 0);
    assert.match(copy.lines.join('\n'), /publipostage : 3 fichier\(s\) écrits, 0 retirés/);
    assert.equal(readFileSync(join(root, 'modeles/publipostage/modeles.json'), 'utf8'), repo()['apps/publipostage/modeles/modeles.json']);
    assert.equal(readFileSync(join(root, 'modeles/publipostage/facture.webp'), 'utf8'), 'image de la facture');
    assert.match(run(root).lines.join('\n'), /publipostage : à jour/);
    assert.equal(run(root, '--verifier').status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('un modèle retiré de l\'app emporte sa vignette ; une vignette modifiée est recopiée', () => {
  const root = workspace(repo());
  try {
    run(root);
    writeFileSync(join(root, 'apps/publipostage/modeles/modeles.json'), JSON.stringify([entry('facture', { vignette: 'facture.webp' })]));
    writeFileSync(join(root, 'apps/publipostage/modeles/facture.webp'), 'une nouvelle image');
    const again = run(root);
    assert.match(again.lines.join('\n'), /publipostage : 2 fichier\(s\) écrits, 1 retirés/);
    assert.deepEqual(readdirSync(join(root, 'modeles/publipostage')).sort(), ['facture.webp', 'modeles.json']);
    assert.equal(readFileSync(join(root, 'modeles/publipostage/facture.webp'), 'utf8'), 'une nouvelle image');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('un catalogue qui s\'écarte n\'est pas copié du tout : une vignette absente, une vignette trop lourde, une entrée mal formée, un JSON illisible', () => {
  const cases = {
    'vignette absente': [repo({ 'apps/publipostage/modeles/relance.webp': undefined }), /vignette relance\.webp est absente/],
    'vignette trop lourde': [repo({ 'apps/publipostage/modeles/relance.webp': 'x'.repeat(THUMB_MAX + 1) }), /pèse \d+ Ko \(50 Ko au plus\)/],
    'entrée mal formée': [repo({ 'apps/publipostage/modeles/modeles.json': JSON.stringify([entry('facture'), entry('Mauvais Id')]) }), /modèle 2 : id inattendu/],
    'JSON illisible': [repo({ 'apps/publipostage/modeles/modeles.json': '{ pas du json' }), /modeles\/modeles\.json : /],
  };
  for (const [name, [files, pattern]] of Object.entries(cases)) {
    const defined = Object.fromEntries(Object.entries(files).filter(([, content]) => content !== undefined));
    const root = workspace(defined);
    try {
      const result = run(root);
      assert.equal(result.status, 1, name);
      assert.match(result.lines.join('\n'), /publipostage : catalogue refusé, rien n'est copié/, name);
      assert.match(result.lines.join('\n'), pattern, name);
      assert.ok(!existsSync(join(root, 'modeles')), `${name} : rien n'est écrit`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('une app sans `modeles/modeles.json` dans son dépôt garde le catalogue que GFS porte ; --app et --depuis ; une app qui ne déclare rien est dite', () => {
  const root = workspace();
  try {
    const plain = run(root);
    assert.equal(plain.status, 0);
    assert.match(plain.lines.join('\n'), /publipostage : pas de modeles\/modeles\.json dans le dépôt de l'app/);
    assert.equal(planApp(publipostage(), { root }).state, 'sans-source');
    const unknown = run(root, '--app', 'calendar');
    assert.equal(unknown.status, 1);
    assert.match(unknown.lines.join('\n'), /calendar : aucune app du catalogue qui déclare « modeles »/);
    const elsewhere = mkdtempSync(join(tmpdir(), 'gfs-modeles-depot-'));
    try {
      mkdirSync(join(elsewhere, 'modeles'));
      writeFileSync(join(elsewhere, 'modeles/modeles.json'), JSON.stringify([entry('facture', { vignette: 'facture.webp' })]));
      writeFileSync(join(elsewhere, 'modeles/facture.webp'), 'image');
      const copy = run(root, '--app', 'publipostage', '--depuis', elsewhere);
      assert.match(copy.lines.join('\n'), /publipostage : 2 fichier\(s\) écrits/);
      assert.ok(existsSync(join(root, 'modeles/publipostage/facture.webp')));
    } finally { rmSync(elsewhere, { recursive: true, force: true }); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
