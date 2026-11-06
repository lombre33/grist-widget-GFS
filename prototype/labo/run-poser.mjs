// Poser et retirer des règles depuis le panneau « Permissions » (étape 7, lot a ; contrats 11.4, 11.5), jouées dans un VRAI serveur Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris. Le serveur
// d'essai ne connaît qu'une personne à la fois (GRIST_EMAIL) : trois temps sur le même document, en relançant le serveur entre eux (voir LISEZ-MOI.md, « Poser des règles »).
//   PHASE=proprietaire  le document a le rangement de GFS et des lignes de trois personnes ; Annuler n'écrit rien ; « Poser Partagé » écrit les six règles, Grist recharge la page, GFS rouvre le panneau ;
//                       « Fermer la structure » de même ; une règle écrite à la main sur une autre table est là.
//   PHASE=editeur       le serveur sous editor@example.com : il ne lit que son rangement, ne change pas celui d'un autre (le refus cite la note de GFS), ne crée pas de table, ne copie pas le document ;
//                       GFS marche pour lui, sans le bloc « Poser des règles ».
//   PHASE=retrait       le propriétaire : « Rouvrir » puis « Retirer » ; il ne reste que la règle de Grist et la règle écrite à la main.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { COLUMNS } from '../js/rangement.js';
import { PAGE_PORT, openGfs, contrastProblems } from './lab-pdf.mjs';
import { gfsFrame, chip, chipWord, openPanel, closePanel, apply, shareWithEditorAndViewer, records, fits } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.POSER_ETAT || '/tmp/poser-gfs-etat.json';
const { t } = createI18n(lang);
const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `poser-${lang}-${scheme}-${name}.png`) });
const panelText = async frame => (await frame.locator('.mod.rt').innerText()).replace(/\s+/g, ' ');
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
// Les règles du document telles que Grist les range (id, note), sans celle qu'il crée lui-même.
async function rulesOf(page, id) {
  const rows = await records(page, id, '_grist_ACLRules');
  return Array.isArray(rows) ? rows.map(row => ({ id: row.id, memo: row.fields.memo, formula: row.fields.aclFormula, rights: row.fields.permissionsText })).filter(rule => rule.formula || rule.rights || rule.memo) : rows;
}
const memos = rules => rules.map(rule => rule.memo);
const gfsRules = rules => rules.filter(rule => /^GFS : /.test(rule.memo));

// Un clic de vraie souris sur un geste du panneau, sa question, et la réponse à la question.
const gesture = (frame, kind) => frame.locator(`[data-fk="rights-act-${kind}"]`);
const answer = (frame, yes) => frame.locator(`[data-fk="ask-${yes ? 'yes' : 'no'}"]`).click();

// Une pose acceptée : Grist recharge la page de tout le monde ; GFS rouvre le panneau, une fois.
async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}

async function playOwner(run, id) {
  const { page } = run;
  let frame = run.frame;
  say('--- 1. un document sans règle, avec le rangement de GFS ---');
  const people = ['essai@example.com', 'editor@example.com', '@document', 'viewer@example.com'];
  await apply(page, id, [['AddTable', 'GFS_Rangement', COLUMNS.map(column => ({ ...column }))]]);
  await apply(page, id, [['BulkAddRecord', 'GFS_Rangement', people.map(() => null), { Utilisateur: people, App: people.map(() => 'publipostage'), Fichier: people.map((who, at) => `modele-${at}.json`) }]]);
  await page.reload();
  frame = await gfsFrame(page);
  check('sans règle : « Pas protégé »', (await chipWord(frame, 'pas')) === t('rights.chip.pas'), await chip(frame).innerText());
  await openPanel(page, frame);
  let panel = await panelText(frame);
  check('le bloc « Poser des règles » propose les deux gestes, possibles', [t('rights.act.title'), t('rights.act.shared'), t('rights.act.close')].every(part => panel.toLowerCase().includes(part.toLowerCase()))
    && (await gesture(frame, 'shared').getAttribute('aria-disabled')) === null && (await gesture(frame, 'close').getAttribute('aria-disabled')) === null, panel);
  check('le panneau tient dans la page et reste lisible (4,5:1)', await fits(frame, '.mod.rt'), [await contrastProblems(frame, '.mod.rt')]);
  await shot(frame, '1-poser');

  say('--- 2. « Annuler » n\'écrit rien ; la question dit le prix ---');
  const before = await rulesOf(page, id);
  await gesture(frame, 'shared').click();
  await frame.locator('.mod.ask').waitFor();
  const asked = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit ce qui s\'écrit, la première règle (import et copie) et le rechargement', [t('rights.ask.shared.title'), t('rights.ask.shared.message'), t('rights.ask.firstRule'), t('rights.ask.reload')].every(part => asked.includes(part)), asked);
  check('la question tient dans la page et reste lisible', await fits(frame, '.mod.ask'), [await contrastProblems(frame, '.mod.ask')]);
  check('le clavier est sur « Annuler » (on n\'accorde pas une règle d\'un Entrée distrait)', (await frame.evaluate(() => document.activeElement.dataset.fk)) === 'ask-no');
  await shot(frame, '2-question');
  await answer(frame, false);
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  check('« Annuler » : le panneau reste, aucune règle n\'est écrite', (await frame.locator('.mod.rt').count()) === 1 && JSON.stringify(await rulesOf(page, id)) === JSON.stringify(before), memos(await rulesOf(page, id)));

  say('--- 3. « Poser Partagé » ---');
  await gesture(frame, 'shared').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), answer(frame, true)]);
  await frame.locator('.mod.rt .rt-content').waitFor({ timeout: 30000 });
  check('Grist a rechargé la page et GFS a rouvert le panneau tout seul', (await frame.locator('.mod.rt').count()) === 1);
  const posed = await rulesOf(page, id);
  check('six règles de GFS dans Grist, la première pour les propriétaires, la dernière sans condition', gfsRules(posed).length === 6 && posed.find(rule => /propriétaires/.test(rule.memo)).formula === 'user.Access in [OWNER]' && posed.filter(rule => /^GFS : Partagé/.test(rule.memo)).at(-1).formula === '', JSON.stringify(posed).slice(0, 400));
  panel = await panelText(frame);
  check('le panneau dit « Protégé en partie » : le rangement est « Partagé », la structure encore ouverte', panel.includes(t('rights.chip.partie')) && panel.includes(t('rights.level.partage')) && panel.includes(t('rights.structure.open')), panel);
  check('le geste est devenu « Retirer les règles de GFS »', (await gesture(frame, 'remove-level').count()) === 1, panel);
  await shot(frame, '3-partage-pose');

  say('--- 4. « Fermer la structure » ---');
  await gesture(frame, 'close').click();
  await frame.locator('.mod.ask').waitFor();
  const closing = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit que ça vaut pour tout le document et que les éditeurs gardent leurs lignes', [t('rights.ask.close.message'), t('rights.ask.close.item1'), t('rights.ask.close.item2'), t('rights.ask.reload')].every(part => closing.includes(part)) && !closing.includes(t('rights.ask.firstRule')), closing);
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), answer(frame, true)]);
  await frame.locator('.mod.rt .rt-content').waitFor({ timeout: 30000 });
  panel = await panelText(frame);
  check('la structure est fermée et le geste devient « Rouvrir »', panel.includes(t('rights.structure.closed')) && (await gesture(frame, 'open').count()) === 1, panel);
  await shot(frame, '4-structure-fermee');
  await closePanel(page, frame);

  say('--- 5. une règle écrite à la main reste hors de portée de GFS ---');
  await apply(page, id, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Clients', colIds: '*' }], ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: '', permissionsText: '+CRUD', memo: 'écrite à la main' }]]);
  frame = await gfsFrame(page);
  say('   règles de la ressource par défaut :', JSON.stringify((await records(page, id, '_grist_ACLRules')).filter(row => row.fields.resource === 1).map(row => ({ id: row.id, pos: row.fields.rulePos, f: row.fields.aclFormula, p: row.fields.permissionsText }))));
  const now = await rulesOf(page, id);
  check('GFS_Rangement porte six règles « Partagé », une règle de structure et la règle à la main', gfsRules(now).length === 7 && now.some(rule => rule.memo === 'écrite à la main'), memos(now));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playEditor(run, id) {
  const { page } = run;
  const frame = run.frame;
  say('--- éditeur : le même document, règles posées ---');
  const word = await chipWord(frame, 'none');
  check('le pied reste « Permissions » (Grist cache les règles à qui n\'est pas propriétaire)', /Permissions/.test(word), word);
  await openPanel(page, frame);
  const panel = await panelText(frame);
  check('le panneau dit « seul un propriétaire » et n\'offre aucun geste', panel.includes(t('rights.role.false')) && !panel.toLowerCase().includes(t('rights.act.title').toLowerCase()), panel);
  await closePanel(page, frame);
  const rows = await records(page, id, 'GFS_Rangement');
  const seen = Array.isArray(rows) ? rows.map(row => row.fields.Utilisateur).sort() : rows;
  check('il ne lit que son rangement et la liste des apps du document', JSON.stringify(seen) === JSON.stringify(['@document', 'editor@example.com']), seen);
  const attempt = (method, path, body) => page.evaluate(async ([doc, verb, url, payload]) => {
    const response = await fetch(`/api/docs/${doc}${url}`, { method: verb, headers: { 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
    return { status: response.status, text: (await response.text()).slice(0, 300) };
  }, [id, method, path, body]);
  const mine = rows.find(row => row.fields.Utilisateur === 'editor@example.com');
  const own = await attempt('PATCH', '/tables/GFS_Rangement/records', { records: [{ id: mine.id, fields: { Fichier: 'renomme.json' } }] });
  check('il change son propre rangement', own.status === 200, own);
  const foreign = await attempt('POST', '/apply', [['AddRecord', 'GFS_Rangement', null, { Utilisateur: 'viewer@example.com', App: 'x', Fichier: 'forge.json' }]]);
  check('il ne crée pas de ligne au nom d\'un autre', foreign.status >= 400, foreign);
  say('   le refus dit :', foreign.text);
  // Structure fermée : les gestes de structure d'un éditeur (ce que fait l'interface de Grist), un par un. Mesuré : `AddTable` envoyé tel quel à l'API REST passe, `AddEmptyTable` (le geste de l'interface) et les colonnes non.
  for (const [label, action] of [['ajouter une table (AddEmptyTable)', ['AddEmptyTable', null]], ['ajouter une colonne', ['AddColumn', 'GFS_Rangement', 'Intrus', { type: 'Text' }]], ['supprimer une colonne', ['RemoveColumn', 'GFS_Rangement', 'Valeur']],
    ['renommer une table', ['RenameTable', 'GFS_Rangement', 'GFS_Autre']], ['ajouter une page', ['CreateViewSection', 0, 0, 'record', null, null]]]) {
    const outcome = await attempt('POST', '/apply', [action]);
    check(`structure fermée : il ne peut pas ${label}`, outcome.status >= 400, outcome);
    say('   le refus dit :', outcome.text.slice(0, 160));
  }
  const bare = await attempt('POST', '/apply', [['AddTable', 'Intrus', [{ id: 'A', type: 'Text' }]]]);
  say(`   pour mémoire, AddTable envoyé tel quel à l'API REST : ${bare.status}`, bare.text.slice(0, 120));
  const copy = await attempt('GET', '/download?template=false');
  check('dès la première règle, il ne télécharge plus le document entier', copy.status === 403, copy);
  check('GFS marche pour lui et ne dit rien de plus en console', unexpected(run).length === 0, unexpected(run));
}

async function playRemoval(run, id) {
  const { page } = run;
  let frame = run.frame;
  say('--- retrait : le propriétaire ---');
  await openPanel(page, frame);
  await gesture(frame, 'open').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), answer(frame, true)]);
  await frame.locator('.mod.rt .rt-content').waitFor({ timeout: 30000 });
  check('« Rouvrir » : la structure est rouverte, Partagé reste', (await panelText(frame)).includes(t('rights.structure.open')) && gfsRules(await rulesOf(page, id)).length === 6);
  await gesture(frame, 'remove-level').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), answer(frame, true)]);
  await frame.locator('.mod.rt .rt-content').waitFor({ timeout: 30000 });
  const left = await rulesOf(page, id);
  check('« Retirer » : plus aucune règle de GFS, la règle écrite à la main reste', gfsRules(left).length === 0 && memos(left).join('|') === 'écrite à la main', memos(left));
  check('le pied redit « Pas protégé » et le bouton redevient « Poser »', (await panelText(frame)).includes(t('rights.chip.pas')) && (await gesture(frame, 'shared').count()) === 1);
  await shot(frame, '5-retire');
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang });
    await shareWithEditorAndViewer(run.page, run.docId);
    writeFileSync(STATE, JSON.stringify({ docId: run.docId, path: run.path }));
    await playOwner(run, run.docId);
  } else {
    const { path, docId } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await (phase === 'editeur' ? playEditor : playRemoval)(run, docId);
  }
} finally {
  await browser.close();
  pages.close();
}
