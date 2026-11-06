// Mesure (06/11, « Partager ») : des règles posées UNE fois par un propriétaire, qui lisent une table de partages que d'autres écrivent (11.7, point 13). Jouée dans un VRAI Grist, en trois temps (le serveur d'essai
// ne connaît qu'une personne à la fois : `GRIST_EMAIL`, voir labo/LISEZ-MOI.md) :
//   PHASE=proprietaire  essai@example.com : crée `Fichiers` et `Partages` (colonnes-formules, `Auteur` déclenchée), pose les règles, un administrateur de dossier (editor@), vérifie aussi si une règle peut lire l'heure ;
//   PHASE=editeur       editor@example.com, administrateur du dossier « Ventes » : il ne lit que ce qui lui est partagé, partage « Ventes » avec viewer@ SANS propriétaire, son partage hors de son dossier ne vaut rien ;
//   PHASE=lecteur       viewer@example.com : il lit le fichier partagé par l'éditeur, rien d'autre.
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf, GRIST } from './lab-serveur.mjs';
import { shareWithEditorAndViewer } from './lab-droits.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGES_ETAT || '/tmp/partages-gfs-etat.json';
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 300) };
}, [method, path, body]);
const apply = (page, id, actions) => call(page, 'POST', `/api/docs/${id}/apply`, actions);
const rows = async (page, id, table) => { const answer = await call(page, 'GET', `/api/docs/${id}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => row.fields) : answer; };
const names = list => (Array.isArray(list) ? list.map(row => row.Nom).sort().join(',') : JSON.stringify(list));

const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const own = 'user.Email and rec.Auteur and rec.Auteur.lower() == user.Email.lower()';
const FICHIERS = [
  { id: 'Nom', type: 'Text' }, { id: 'Dossier', type: 'Text' },
  { id: 'Auteur', type: 'Text', isFormula: false, formula: 'user.Email', recalcWhen: 0, recalcDeps: null },
  { id: 'Chemin', type: 'Text', isFormula: true, formula: '($Dossier + "/" if $Dossier else "") + $Nom' },
  { id: 'Lecteurs', type: 'Any', isFormula: true, formula: [
    'emails = set([str($Auteur).lower()])',
    'for p in Partages.all:',
    '  if p.Valide and p.Actif and ($Chemin == p.Cible or $Chemin.startswith(p.Cible + "/")):',
    '    emails.add(p.PersonneL)',
    'return tuple(sorted(emails))'].join('\n') },
];
const PARTAGES = [
  { id: 'Cible', type: 'Text' }, { id: 'Personne', type: 'Text' }, { id: 'Droit', type: 'Text' }, { id: 'Fin', type: 'Date' },
  { id: 'Actif', type: 'Bool', isFormula: true, formula: 'not $Fin or $Fin >= TODAY()' },
  { id: 'Auteur', type: 'Text', isFormula: false, formula: 'user.Email', recalcWhen: 0, recalcDeps: null },
  { id: 'PersonneL', type: 'Text', isFormula: true, formula: 'str($Personne).strip().lower()' },
  // Au premier niveau : l'auteur est une ligne « proprietaire » ; au second : l'auteur est administrateur (d'un dossier qui couvre la cible) d'un partage du premier niveau.
  { id: 'Valide1', type: 'Bool', isFormula: true, formula: '$Droit == "proprietaire" or any(p.Droit == "proprietaire" and p.PersonneL == str($Auteur).lower() for p in Partages.all)' },
  { id: 'Valide', type: 'Bool', isFormula: true, formula: [
    '$Valide1 or any(p.Valide1 and p.Droit == "admin" and p.PersonneL == str($Auteur).lower() and ($Cible == p.Cible or $Cible.startswith(p.Cible + "/")) for p in Partages.all)'].join('\n') },
  { id: 'AdminsCible', type: 'Any', isFormula: true, formula: 'tuple(p.PersonneL for p in Partages.all if p.Valide and p.Droit == "admin" and ($Cible == p.Cible or $Cible.startswith(p.Cible + "/")))' },
];
const rule = (formula, rights, memo) => ({ formula, rights, memo });
const RULES = {
  Fichiers: [
    rule('user.Access in [OWNER]', '+CRUD', 'propriétaires'),
    rule('user.Email and rec.Lecteurs and user.Email.lower() in rec.Lecteurs', '+R', 'lecteurs du fichier'),
    rule('', '-CRUD', 'le reste'),
  ],
  Partages: [
    rule('user.Access in [OWNER]', '+CRUD', 'propriétaires'),
    rule('user.Email and rec.AdminsCible and user.Email.lower() in rec.AdminsCible', '+RUD', 'administrateurs de la cible'),
    rule(own, '+RUD', 'auteur'),
    rule('user.Email and rec.PersonneL == user.Email.lower()', '+R', 'la personne concernée'),
    rule('user.Access in [EDITOR]', '+C', 'tout éditeur peut ajouter une ligne (elle ne vaut que si elle est valide)'),
    rule('', '-CRUD', 'le reste'),
  ],
};
function aclActions() {
  const actions = []; let resource = 100, id = 100;
  for (const [table, rules] of Object.entries(RULES)) {
    resource += 1;
    actions.push(['AddRecord', '_grist_ACLResources', resource, { tableId: table, colIds: '*' }]);
    rules.forEach((one, at) => actions.push(['AddRecord', '_grist_ACLRules', (id += 1), { resource, aclFormula: one.formula, permissionsText: one.rights, rulePos: at + 1, memo: `essai : ${one.memo}` }]));
  }
  return actions;
}

const pluginApi = await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, {});
  const page = await context.newPage();
  if (phase === 'proprietaire') {
    const path = await createDocument(page);
    const id = docIdOf(path);
    writeFileSync(STATE, JSON.stringify({ id }));
    say('partage au document :', await shareWithEditorAndViewer(page, id));
    let answer = await apply(page, id, [['AddTable', 'Partages', PARTAGES], ['AddTable', 'Fichiers', FICHIERS]]);
    check('les deux tables et leurs colonnes-formules se créent', answer.status === 200, answer.text);
    answer = await apply(page, id, [
      ['AddRecord', 'Partages', null, { Cible: '', Personne: OWNER, Droit: 'proprietaire' }],
      ['AddRecord', 'Partages', null, { Cible: 'Ventes', Personne: EDITOR, Droit: 'admin' }],
      ['AddRecord', 'Fichiers', null, { Nom: 'Devis', Dossier: 'Ventes' }],
      ['AddRecord', 'Fichiers', null, { Nom: 'Secret', Dossier: 'RH' }],
      ['AddRecord', 'Fichiers', null, { Nom: 'Plan', Dossier: '' }],
    ]);
    check('les lignes se posent', answer.status === 200, answer.text);
    const files = await rows(page, id, 'Fichiers');
    say('Lecteurs :', JSON.stringify(files.map(row => [row.Nom, row.Auteur, row.Lecteurs])));
    check('l\'auteur est écrit par Grist (formule déclenchée) pour les deux tables', files.every(row => row.Auteur === OWNER), files.map(row => row.Auteur));
    const list = row => (Array.isArray(row.Lecteurs) ? row.Lecteurs.slice(1) : row.Lecteurs);
    const devis = files.find(row => row.Nom === 'Devis');
    check('« Ventes » est lu par l\'administrateur du dossier (partage du propriétaire) et l\'auteur', JSON.stringify(list(devis)) === JSON.stringify([EDITOR, OWNER].sort()), devis.Lecteurs);
    // La fin d'accès : une colonne-formule lit la date du jour (`TODAY()`), que Grist recalcule à chaque ouverture du document.
    answer = await apply(page, id, [['AddRecord', 'Partages', null, { Cible: 'Plan', Personne: VIEWER, Droit: 'read', Fin: 1577836800 }], ['AddRecord', 'Partages', null, { Cible: 'RH/Secret', Personne: VIEWER, Droit: 'read', Fin: 4070908800 }]]);
    const dated = await rows(page, id, 'Fichiers');
    const byName = Object.fromEntries(dated.map(row => [row.Nom, list(row)]));
    check('une fin d\'accès passée ne compte plus, une fin à venir compte (formule sur `TODAY()`)', !byName.Plan.includes(VIEWER) && byName.Secret.includes(VIEWER), byName);
    answer = await apply(page, id, aclActions());
    check('les règles se posent (une seule fois)', answer.status === 200, answer.text);
    // L'heure : une règle peut-elle la lire ? (Grist vérifie la formule quand la règle s'écrit.)
    for (const formula of ['rec.Fin and rec.Fin < NOW()', 'rec.Fin and rec.Fin < DATE.today()', 'rec.Fin and rec.Fin < datetime.now()', 'rec.Fin and rec.Fin < TODAY()']) {
      const probe = await apply(page, id, [['AddRecord', '_grist_ACLResources', 200, { tableId: 'Clients', colIds: '*' }], ['AddRecord', '_grist_ACLRules', 200, { resource: 200, aclFormula: formula, permissionsText: '-R', rulePos: 1, memo: 'essai : heure' }]]);
      say(`règle « ${formula} » :`, probe.status, probe.text.replace(/\s+/g, ' ').slice(0, 220));
      await apply(page, id, [['RemoveRecord', '_grist_ACLRules', 200], ['RemoveRecord', '_grist_ACLResources', 200]]);
    }
    check('le propriétaire lit tout', names(await rows(page, id, 'Fichiers')) === 'Devis,Plan,Secret');
  } else {
    const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    if (phase === 'editeur') {
      say('--- editor@ : administrateur de « Ventes » ---');
      const seen = await rows(page, id, 'Fichiers');
      check('il ne lit que « Devis » (partagé avec lui par le dossier)', names(seen) === 'Devis', names(seen));
      let answer = await apply(page, id, [['AddRecord', 'Partages', null, { Cible: 'Ventes', Personne: VIEWER, Droit: 'read' }]]);
      check('il ajoute, SANS propriétaire, un partage « Ventes » pour viewer@', answer.status === 200, answer.text);
      answer = await apply(page, id, [['AddRecord', 'Partages', null, { Cible: 'RH', Personne: EDITOR, Droit: 'read' }]]);
      say('partage hors de son dossier (RH) :', answer.status, answer.text);
      const after = await rows(page, id, 'Fichiers');
      check('un partage hors de son dossier ne lui ouvre rien : « Secret » reste caché', names(after) === 'Devis', names(after));
      const mine = await rows(page, id, 'Partages');
      say('ses lignes de partage :', JSON.stringify(Array.isArray(mine) ? mine.map(row => [row.Cible, row.PersonneL, row.Droit, row.Valide]) : mine));
      answer = await apply(page, id, [['UpdateRecord', 'Fichiers', 1, { Nom: 'Pirate' }]]);
      check('il ne peut pas modifier un fichier (le rôle d\'éditeur ne suffit pas)', answer.status !== 200, answer.text);
    } else {
      say('--- viewer@ ---');
      const seen = await rows(page, id, 'Fichiers');
      check('il lit « Devis » (partagé par l\'éditeur) et « Secret » (partagé par le propriétaire, fin à venir), pas « Plan » (fin passée)', names(seen) === 'Devis,Secret', names(seen));
      const shares = await rows(page, id, 'Partages');
      say('ses lignes de partage :', JSON.stringify(Array.isArray(shares) ? shares.map(row => [row.Cible, row.PersonneL, row.Droit]) : shares));
      check('il ne lit que le partage qui le concerne', Array.isArray(shares) && shares.every(row => row.PersonneL === VIEWER), shares);
    }
  }
} finally {
  await browser.close();
}
