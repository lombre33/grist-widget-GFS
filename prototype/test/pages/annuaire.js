// La page d'essai de l'annuaire sous Firefox (test/annuaire-firefox.mjs, module Annuaire, demande du porteur du 25/11) : le vrai contrôle (js/annuaire/annuaire-control.js), la vraie
// fenêtre, la vraie lecture (js/annuaire/annuaire-store.js) et les vraies feuilles de style de index.html, sur un faux Grist en mémoire (test/fake-grist.mjs) qui tient le document fictif
// des essais (test/annuaire-fixtures.mjs) plus deux lignes qui poussent la mise en page : un nom, un poste, une adresse et une structure très longs (et le nom très long est l'assistant de quelqu'un). Aucun Grist : ce que l'essai
// mesure est la mise en page, la souris et le clavier ; ce que Grist envoie vraiment se mesure dans le labo (labo/run-annuaire.mjs). La langue vient de `?lang=fr|en`.
// `?tools=1` : le document des essais de « À vérifier », « Écrire au groupe » et « Ma présence » (test/annuaire-tools-firefox.mjs) : deux colonnes de plus (une date de
// départ, un oui/non « fiche masquée » : faux partout, comme dans un vrai Grist), un doublon de nom, une personne sans rattachement, un responsable qui n'existe pas, un départ dépassé, une personne masquée et
// cinquante agents aux adresses longues (de quoi dépasser le lien d'un message) ; `&admin=0` : la personne qui lit n'administre pas le document ; `&me=adresse` : son adresse.
// L'essai part de zéro pour le bouton « Personnes » de l'organigramme (clé `gfs.annuaire.orgPeople` retirée du navigateur). `window.__annuaire` est le contrôle ; `window.__annuaireNotices` garde les phrases qu'il dit ; `window.__annuaireLanguage(lang)` change la langue fenêtre ouverte, comme le
// contrôleur de GFS ; `window.__annuaireCopied` garde le dernier texte copié (le presse-papiers lui-même se mesure dans le labo).
// `?home=merged` : l'annuaire s'ouvre sur la vue fusionnée « Tous mes annuaires » (test/annuaire-merge-firefox.mjs), sinon sur l'annuaire de la ligne 1.
// `window.__ambiance(id)` et `window.__theme.chooseAccess(on)` posent l'ambiance et l'accessibilité renforcée comme GFS (test/annuaire-ambiances-firefox.mjs).
// `?none=1` : le document n'a encore aucun annuaire (test/annuaire-nouveau-firefox.mjs : « Nouveau > Annuaire » commence par le réglage du premier).
// `?filters=bar` : l'annuaire principal montre ses filtres en barre (`filterMode`, test/annuaire-filtres-firefox.mjs), sinon en panneau.
// `?rights=self,own,below,role` : qui modifie les fiches de l'annuaire principal en plus des administrateurs (`edit` : sa fiche, sa structure, avec celles en dessous, la colonne
// « Gestion », cochée pour Louis Girard) ; avec `&admin=0&me=adresse`, une personne qui lit sans être administratrice.
// `?lock=none|current|stale|foreign` : le verrou réel dans Grist (js/annuaire/annuaire-lock-control.js ; test/annuaire-verrou-firefox.mjs) : de fausses règles d'accès (aucune, celles du réglage,
// celles d'un réglage d'avant, une règle écrite à la main) et un faux écrivain qui note ce qu'on lui demande d'écrire (`window.__annuaireLock`, `window.__annuaireAsks` : les questions posées) ;
// `&lockfail=texte` : Grist refuse la pose. Ce que Grist en fait vraiment se mesure dans le labo (labo/run-annuaire-verrou.mjs).
// `?links=1` : les apps du menu « Insérer dans… » (voir `FAKE_TARGETS`) ; sans lui aucune app n'accepte de personne.
//
// `?sub=1` : les sous-annuaires (test/annuaire-sub-firefox.mjs) : `GFS_Directories` porte les colonnes que le moteur de partage y pose (lecteurs, écrivains, administrateurs,
// refus), un faux « Partager » (`window.__annuaireShared` garde le fichier demandé ; `window.__annuaireShareWhy` : un texte qui le grise), et un sous-annuaire déjà là, « Pôle
// Ressources » (copie du 20/11), dont `ecrivain@exemple.fr` est écrivain (`&me=`). Le vrai verrou de Grist se mesure dans le labo (labo/run-annuaire-sous.mjs).
import { createI18n } from '/js/i18n/i18n.js';
import { installSprite } from '/js/ui/icons.js';
import { fakeGrist } from '/test/fake-grist.mjs';
import { AnnuaireStore } from '/js/annuaire/annuaire-store.js';
import { AnnuaireControl } from '/js/annuaire/annuaire-control.js';
import { ThemeSetting } from '/js/theme/theme.js';
import { ThemeHost } from '/js/theme/theme-apply.js';
import { documentFixture, configFixture } from '/test/annuaire-fixtures.mjs';
import { presenceView } from '/js/annuaire/annuaire-presence.js';
import { levelKey } from '/js/annuaire/annuaire-model.js';
import { ANNUAIRES_TABLE, readConfig } from '/js/annuaire/annuaire-config.js';
import { lockSpec, planLock } from '/js/annuaire/annuaire-lock.js';

const LONG_UNIT = 'Direction des relations internationales et de la coopération universitaire';

// Le document fictif, avec une structure et une personne aux textes très longs.
function longDocument() {
  const document = documentFixture();
  const { Structures: structures, Personnes: people } = document;
  const unit = 8;
  for (const [key, value] of Object.entries({ id: unit, Nom: LONG_UNIT, Niveau: 'Direction', Pole: 6, Direction: unit })) structures[key].push(value);
  const person = {
    id: 7, Nom: 'Jean-Baptiste de la Rochefoucauld-Montmorency', Poste: 'Directeur adjoint chargé des relations internationales et de la coopération universitaire',
    Email: 'jean-baptiste.de-la-rochefoucauld-montmorency@universite-exemple.fr', Tel: '01 02 03 04 55', Structure: unit, Contrat: 'Contractuel',
    Competences: ['L', 'Droit international'], Teletravail: true, Responsable: 5, Chef: false, Arrivee: null, Service: '', Site: 'Siège',
    Assistant: 0, Referents: null, Suppleant: 0,
  };
  for (const [key, value] of Object.entries(person)) people[key].push(value);
  people.Assistant[3] = person.id; // la personne au nom très long est l'assistant de Louis Girard : une relation qui pousse la mise en page
  return document;
}

// Le document des essais de `?rights=…` (test/annuaire-droits-firefox.mjs) : celui de `longDocument`, plus une colonne oui/non « Gestion » (cochée pour Louis Girard seul)
// que l'annuaire peut prendre pour le rôle désigné.
function rightsDocument() {
  const document = longDocument();
  const { Personnes: people, _grist_Tables_column: columns } = document;
  people.Gestion = people.id.map(row => row === 4);
  columns.id.push(39);
  columns.parentId.push(1);
  columns.colId.push('Gestion');
  columns.type.push('Bool');
  columns.visibleCol.push(0);
  columns.widgetOptions.push('');
  columns.isFormula.push(false);
  return document;
}

// Le document des essais de `?tools=1` : celui de `longDocument`, plus de quoi faire parler les contrôles.
function toolsDocument() {
  const document = longDocument();
  const { Personnes: people, _grist_Tables_column: columns } = document;
  people.Depart = people.id.map(() => null);
  people.Masquee = people.id.map(() => false); // un vrai Grist n'a pas de case vide : « non » partout
  columns.id.push(37, 38);
  columns.parentId.push(1, 1);
  columns.colId.push('Depart', 'Masquee');
  columns.type.push('Date', 'Bool');
  columns.visibleCol.push(0, 0);
  columns.widgetOptions.push('', '');
  columns.isFormula.push(false, false);
  const blank = { Nom: '', Poste: '', Email: '', Tel: '', Structure: 0, Contrat: '', Competences: null, Teletravail: null, Responsable: 0, Chef: false, Arrivee: null, Service: '',
    Site: '', Assistant: 0, Referents: null, Suppleant: 0, Depart: null, Masquee: false };
  const add = row => {
    const values = { ...blank, ...row, id: people.id.length + 1 };
    for (const key of Object.keys(people)) people[key].push(values[key] ?? null);
  };
  add({ Nom: 'Léa Garnier', Poste: 'Chargée de mission', Email: 'lea.garnier@exemple.fr', Structure: 3, Site: 'Siège' });
  add({ Nom: 'Lea Garnier', Poste: 'Chargée de mission', Email: 'l.garnier@exemple.fr', Structure: 7, Site: 'Campus Sud' });
  add({ Nom: 'Noé Petit', Poste: 'Technicien', Email: 'noe.petit@exemple.fr', Structure: 0 });
  add({ Nom: 'Julien Mercier', Poste: 'Chargé de communication', Email: 'julien.mercier@exemple.fr', Structure: 3, Responsable: 99 });
  add({ Nom: 'Rémi Colas', Poste: 'Gestionnaire', Email: 'remi.colas@exemple.fr', Structure: 3, Depart: Date.UTC(2026, 8, 30) / 1000 });
  add({ Nom: 'Sacha Bernard', Poste: 'Archiviste', Email: 'sacha.bernard@exemple.fr', Structure: 7, Masquee: true });
  for (let n = 1; n <= 50; n++) add({ Nom: `Agent Essai ${String(n).padStart(2, '0')}`, Poste: 'Agent', Structure: 5, Email: `agent.essai.${String(n).padStart(2, '0')}@universite-exemple.fr` });
  return document;
}

// Les tables du document au format du faux Grist (des lignes).
function tablesOf(document) {
  return Object.fromEntries(Object.entries(document).map(([name, data]) => {
    const names = Object.keys(data).filter(key => key !== 'id');
    return [name, { columns: ['id', ...names], rows: data.id.map((id, at) => Object.fromEntries([['id', id], ...names.map(key => [key, data[key][at]])])) }];
  }));
}

// Le faux « droits » des sous-annuaires : les règles du partage couvrent déjà `GFS_Directories` (le verrou lui-même se mesure dans un vrai Grist), et « Partager » note ce qu'on lui
// demande.
function fakeRights() {
  return { writer: { plans: async () => ({ sharing: { ok: false, reason: 'already' } }) },
    sharing: { whyNot: () => window.__annuaireShareWhy || null, open: async file => { window.__annuaireShared = file; } } };
}

// Les lignes d'une table interne de Grist, comme `RightsReader` les rend : [{ id, … }].
async function internalRows(grist, name) {
  const data = await grist.port.doc.fetchTable(name);
  return data.id.map((id, at) => Object.fromEntries(Object.keys(data).map(key => [key, data[key][at]])));
}

// De fausses règles d'accès et un faux écrivain pour `?lock=…` : `mode` dit ce que le document contient déjà. `current` : les règles du réglage enregistré ; `stale` : celles d'un
// réglage d'avant (chacun sa fiche en moins) ; `foreign` : une règle écrite à la main sur la table des personnes ; `none` : aucune.
function fakeLockRights(grist, seed, mode, t) {
  const base = () => ({ resources: [{ id: 1, tableId: '', colIds: '' }], rules: [{ id: 1, resource: 1, aclFormula: '', permissionsText: 'all', permissions: 63, rulePos: 1, memo: '' }] });
  const raw = async () => {
    const [tables, columns] = await Promise.all([internalRows(grist, '_grist_Tables'), internalRows(grist, '_grist_Tables_column')]);
    const existing = { ...base(), tables, columns };
    const [annuaire] = await seed.list();
    // Les colonnes d'aide que GFS a déjà demandées au faux Grist (il ne les range pas dans ses tables internes) : le plan des règles les relit comme le ferait Grist.
    grist.batches.flat().filter(action => action[0] === 'AddColumn' && /^GFS_/.test(action[2])).forEach((action, at) => {
      const home = tables.find(row => row.tableId === action[1]);
      if (home && !existing.columns.some(column => column.parentId === home.id && column.colId === action[2])) {
        existing.columns.push({ id: 800 + at, parentId: home.id, colId: action[2], isFormula: true, formula: action[3].formula });
      }
    });
    if (mode === 'foreign') {
      existing.resources.push({ id: 2, tableId: annuaire.table, colIds: '*' });
      existing.rules.push({ id: 2, resource: 2, aclFormula: 'user.Access == EDITOR', permissionsText: '-U', rulePos: 1, memo: 'à la main' });
    }
    if (mode !== 'current' && mode !== 'stale') return existing;
    const saved = readConfig(annuaire.config);
    const config = mode === 'stale' ? { ...saved, edit: { ...saved.edit, self: !saved.edit.self } } : saved;
    const spec = lockSpec({ table: annuaire.table, config, schema: await seed.schema() });
    const table = tables.find(row => row.tableId === annuaire.table);
    spec.helpers.forEach((each, at) => existing.columns.push({ id: 900 + at, parentId: table.id, colId: each.id, isFormula: true, formula: each.formula }));
    const say = key => t(`an.lock.note.${key}`);
    for (const action of planLock(existing, spec, say).actions) {
      if (action[0] === 'AddRecord') existing[action[1] === '_grist_ACLRules' ? 'rules' : 'resources'].push({ id: action[2], ...action[3] });
    }
    return existing;
  };
  window.__annuaireLock = [];
  const written = (kind, plan, resume) => {
    window.__annuaireLock.push({ kind, resume, ok: plan.ok, actions: (plan.actions || []).map(action => `${action[0]}:${action[1]}`) });
    return window.__annuaireLockFail ? { ok: false, message: window.__annuaireLockFail } : { ok: true };
  };
  return { reader: { raw },
    writer: { applyWith: async (planOf, resume) => written('with', planOf(await raw()), resume), apply: async (kind, resume) => written(kind, { ok: true }, resume) } };
}


// Les colonnes que le moteur de partage pose dans `GFS_Directories`, et le sous-annuaire « Pôle Ressources » déjà là (copie du 20/11 ; un écrivain, aucun administrateur).
async function seedSub(grist, seed) {
  const { applyUserActions } = grist.port.doc;
  const list = await seed.list();
  const parent = list[0];
  const read = presenceView(await seed.read(parent), { admin: true });
  const made = await seed.createSub({ name: 'Pôle Ressources', parent, sub: { key: levelKey(0), label: 'Pôle', values: ['Pôle Ressources'] }, read,
    at: '2026-11-20T09:30:00.000Z' });
  const columns = ['GFS_Readers', 'GFS_Writers', 'GFS_Admins', 'GFS_Denied'];
  await applyUserActions(columns.map(id => ['AddColumn', ANNUAIRES_TABLE, id, { type: 'ChoiceList', isFormula: false }]));
  await applyUserActions([['UpdateRecord', ANNUAIRES_TABLE, made.row, { GFS_Writers: ['L', 'ecrivain@exemple.fr'] }]]);
}

// Les apps du menu « Insérer dans… » de `?links=1` (test/annuaire-links-firefox.mjs) : deux qui reçoivent une personne, une qu'il faut d'abord activer, une qui ne sait
// pas encore. `window.__annuaireInserted` garde ce que le menu leur a envoyé, `window.__annuaireUnlocked` les apps grisées qu'on a cliquées, `window.__annuaireApps` les ouvertures de la fenêtre des apps.
const FAKE_TARGETS = Object.freeze([
  { id: 'pp', name: 'Publipostage+', where: 'dans un modèle', lock: '', focus: null, ready: true },
  { id: 'fp', name: 'Form+', where: 'dans un formulaire', lock: '', focus: null, ready: true },
  { id: 'tu', name: 'Thusday', where: 'dans une tâche', lock: 'Activez l’extension « Équipes » pour insérer dans Thusday.', focus: 'tu:equipes', ready: true },
  { id: 'bi', name: 'Grist-BI', where: 'dans un tableau', lock: '', focus: null, ready: false },
]);

// Un réglage qui ne retient rien, pour le thème de l'essai.
const memory = () => { const store = { value: null, read: () => store.value, write: value => { store.value = value; return true; } }; return store; };

async function mount() {
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
  let i18n = createI18n(language);
  const locale = lang => (lang === 'en' ? 'en-GB' : 'fr-FR');
  installSprite(document);
  try { window.localStorage.removeItem('gfs.annuaire.orgPeople'); } catch (error) { /* sans stockage, l'essai part du réglage par défaut */ }
  const query = new URLSearchParams(location.search);
  const tools = query.get('tools') === '1';
  const rights = (query.get('rights') || '').split(',');
  const grist = fakeGrist(tablesOf(tools ? toolsDocument() : (rights.includes('role') ? rightsDocument() : longDocument())));
  // Deux réglages pour les essais de « Modifier » : `window.__annuaireRefuse` (un texte : Grist refuse d'écrire la table des personnes, comme le ferait une règle d'accès)
  // et `window.__annuaireBlock` (un texte : le document ne s'écrit pas, ce que dit `writeBlock`).
  const applyUserActions = grist.port.doc.applyUserActions;
  grist.port.doc.applyUserActions = async list => {
    if (window.__annuaireRefuse && list.some(action => (action[0] === 'UpdateRecord' || action[0] === 'BulkAddRecord') && action[1] === 'Personnes')) throw new Error(window.__annuaireRefuse);
    return applyUserActions(list);
  };
  const seed = new AnnuaireStore({ port: grist.port, consent: async () => true });
  // L'annuaire principal met l'adresse et le télétravail (un oui/non) en colonnes de la liste (retour du porteur, 25/11) : toute la mesure de la liste les porte.
  const base = configFixture();
  const options = { ...(tools ? { checks: ['dup', 'mail', 'att', 'resp', 'dep'], leave: 'Depart', presence: { on: true, col: 'Masquee' }, mail: { per: 40, to: 'bcc' } } : {}),
    ...(query.get('filters') === 'bar' ? { filterMode: 'bar' } : {}),
    edit: { self: rights.includes('self'), level: rights.includes('below') ? 'below' : (rights.includes('own') ? 'own' : ''), role: rights.includes('role') ? 'Gestion' : '' } };
  if (query.get('none') !== '1') {
    await seed.create({ name: 'Annuaire principal', table: 'Personnes', config: { ...base, ...options, columns: ['email'],
      fields: base.fields.map(field => (field.col === 'Teletravail' ? { ...field, column: true } : field)) } });
    await seed.create({ name: 'Annuaire des directions', table: 'Personnes', config: { ...configFixture(), levels: configFixture().levels.slice(0, 2) } });
  }
  if (query.get('sub') === '1') await seedSub(grist, seed);
  window.__annuaireNotices = [];
  window.__annuaireAsks = [];
  window.__annuaireLockFail = query.get('lockfail') || '';
  window.__annuaireCopied = null;
  window.__annuaireShared = null;
  window.__annuaireInserted = [];
  window.__annuaireUnlocked = [];
  window.__annuaireApps = 0;
  let lang = language;
  const control = new AnnuaireControl({ port: grist.port, container: document.getElementById('stage'), t: (key, vars) => i18n.t(key, vars), locale: () => locale(lang),
    inertTargets: () => [], ask: async options => { window.__annuaireAsks.push(options.title); return true; }, notice: text => window.__annuaireNotices.push(text), writeBlock: () => window.__annuaireBlock || null, fullAccess: () => true,
    isOwner: async () => query.get('admin') !== '0', identity: () => query.get('me') || '',
    rights: query.get('sub') === '1' ? fakeRights() : (query.get('lock') ? fakeLockRights(grist, seed, query.get('lock'), (key, vars) => i18n.t(key, vars)) : undefined),
    targets: () => (query.get('links') === '1' ? FAKE_TARGETS : []),
    insert: async (id, person) => { window.__annuaireInserted.push({ id, person }); return true; },
    unlock: async target => { window.__annuaireUnlocked.push(target.id); }, apps: async () => { window.__annuaireApps += 1; } });
  // Sans numéro, l'annuaire s'ouvre sur la vue fusionnée dès qu'il y a deux annuaires : les essais d'un seul annuaire partent de la ligne 1 (`?home=merged` : la vue fusionnée).
  const openIt = control.open.bind(control);
  control.open = (row = query.get('home') === 'merged' ? null : 1) => openIt(row);
  window.__annuaire = control;
  // Le thème comme dans GFS (test/annuaire-ambiances-firefox.mjs) : le vrai réglage et le vrai hôte ; le mode vient de `data-grist-appearance`.
  const theme = new ThemeSetting({ ambianceStore: memory(), colorStore: memory(), accessStore: memory() });
  window.__theme = theme;
  window.__ambiance = id => theme.choose(id);
  new ThemeHost({ win: window, setting: theme }).start();
  window.__annuaireBatches = () => JSON.parse(JSON.stringify(grist.batches)); // les actions que le faux Grist a reçues, dans l'ordre
  window.__annuaireLanguage = next => { lang = next; i18n = createI18n(next); control.relocalize(); };
}

window.__ready = mount().then(() => true);
