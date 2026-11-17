// La reprise d'un document déjà partagé (contrats 11.7, point 13, lot 4a), dans un VRAI Grist : un partage activé par la version d'avant les espaces (lot 3, servie depuis une copie du dépôt à ce commit : REPO_DIR) est
// complété par la version d'aujourd'hui, sans repartager les fichiers ni perdre un droit. Quatre temps, un compte à la fois (GRIST_EMAIL ; l'état passe par /tmp/partager-reprise-etat.json).
//   PHASE=ancien     (REPO_DIR = l'ancienne version) le propriétaire active le partage, crée le groupe Achats (editor@), partage « Reprise A » à editor@ (lecture) et « Reprise B » au groupe.
//   PHASE=nouveau    (REPO_DIR = la version d'aujourd'hui) « Partager… » dit que le partage est à compléter ; il le complète ; rien n'est repartagé ; les listes d'aide sont refaites et gardent les mêmes personnes ;
//                    les tables des espaces sont là ; la fenêtre revient active, puis le partage n'est plus « à compléter ».
//   PHASE=editeur    editor@ lit A et B (ses droits d'avant sont gardés), pas le fichier privé du propriétaire.
//   PHASE=lecteur    viewer@ ne lit aucun des trois.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, openRowMenu } from './lab-pdf.mjs';
import { gfsFrame, shareWithEditorAndViewer } from './lab-droits.mjs';

const OLD_LOT = process.env.OLD_LOT || '3';
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'ancien';
const STATE = process.env.PARTAGER_REPRISE_ETAT || '/tmp/partager-reprise-etat.json';
const { t } = createI18n(lang);
const MODELS = 'Publipostage_Modeles';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FIRST = 'Contrat de prestation';
const A = 'Reprise A', B = 'Reprise B', PRIVATE = 'Reprise privé';
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 400) };
}, [method, path, body]);
const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);
const rows = async (run, table) => { const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : []; };
const byName = async run => Object.fromEntries((await rows(run, MODELS)).map(row => [row.Nom, row]));
const modelNames = async run => Object.keys(await byName(run));
const has = (list, who) => JSON.stringify(list || []).includes(who);

async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}
async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}

async function playOld(run) {
  const { page } = run;
  let { frame } = run;
  say('--- version d\'avant : activer, créer un groupe, partager ---');
  await seedFiles(frame);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, FIRST);
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  const tables = ((await call(page, 'GET', `/api/docs/${run.docId}/tables`)).json.tables || []).map(table => table.id);
  // OLD_LOT=4 : la version d'avant est celle des espaces (avant l'administration par un groupe et les dossiers de « Moi », 13/11) ; OLD_LOT=5 : celle d'avant les liens entre espaces (13/11, `c7cc1e4`) ; sinon celle des groupes (lot 3).
  if (OLD_LOT === '4' || OLD_LOT === '5') check('la version d\'avant a les espaces et le placement', tables.includes('GFS_Espaces') && tables.includes('GFS_Placement') && tables.includes('GFS_Groupes'), tables);
  else check('la version d\'avant n\'a ni espaces ni placement', !tables.includes('GFS_Espaces') && !tables.includes('GFS_Placement') && tables.includes('GFS_Groupes'), tables);
  await frame.locator('[data-fk="share-close"]').click();
  const now = Math.floor(Date.now() / 1000);
  let answer = await apply(run, [['BulkAddRecord', MODELS, [null, null, null], { Nom: [A, B, PRIVATE], TypeModele: ['document', 'document', 'document'], DateModif: [now, now, now] }]]);
  check('trois fichiers créés', answer.status === 200, answer.text);
  const models = await byName(run);
  answer = await apply(run, [
    ['AddRecord', 'GFS_Groupes', null, { Nom: 'Achats', PersonnesIci: EDITOR }],
    ['BulkAddRecord', 'GFS_Partages', [null, null], { Cible: [`publipostage:${models[A].id}`, `publipostage:${models[B].id}`], Personne: [EDITOR, '#Achats'], Droit: ['lecture', 'lecture'] }],
  ]);
  check('A partagé à l\'éditeur, B au groupe Achats', answer.status === 200, answer.text);
  const after = await byName(run);
  check('avant : A et B sont lus de l\'éditeur, le fichier privé non', has(after[A].GFS_Lecteurs, EDITOR) && has(after[B].GFS_Lecteurs, EDITOR) && !has(after[PRIVATE].GFS_Lecteurs, EDITOR), [after[A].GFS_Lecteurs, after[B].GFS_Lecteurs]);
  if (OLD_LOT === '5') {
    check('avant : la table de l\'app a GFS_Dossier, pas encore GFS_Vus', 'GFS_Dossier' in after[A] && !('GFS_Vus' in after[A]), Object.keys(after[A]).filter(key => key.startsWith('GFS_')));
    const placeColumns = (await run.rest.columns('GFS_Placement')).map(column => column.id);
    check('avant : le placement n\'a pas encore les colonnes du lien (Lien, Partages)', !placeColumns.includes('Lien') && !placeColumns.includes('Partages'), placeColumns);
  } else if (OLD_LOT === '4') {
    check('avant : la table de l\'app a GFS_Calc, pas encore GFS_Dossier', 'GFS_Calc' in after[A] && !('GFS_Dossier' in after[A]), Object.keys(after[A]).filter(key => key.startsWith('GFS_')));
    const rules = (await rows(run, '_grist_ACLRules')) || [];
    check('avant : le rangement n\'a pas encore ses règles « GFS : Partagé »', !rules.some(rule => /^GFS : Partagé/.test(rule.memo || '')), rules.map(rule => rule.memo));
  } else check('avant : la table de l\'app n\'a pas GFS_Calc', !('GFS_Calc' in after[A]), Object.keys(after[A]).filter(key => key.startsWith('GFS_')));
  const shares = await rows(run, 'GFS_Partages');
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId, shares: shares.length }));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playNew(run) {
  const { page } = run;
  let { frame } = run;
  const before = JSON.parse(readFileSync(STATE, 'utf8')).shares;
  say('--- version d\'aujourd\'hui : compléter le partage ---');
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, A);
  const text = (await frame.locator('.mod.sh').innerText()).replace(/\s+/g, ' ');
  check('« Partager… » dit que le partage est à compléter, avec le bouton « Compléter le partage… »', text.includes(t('share.upgrade.owner')) && (await frame.locator('[data-fk="share-activate"]').innerText()).includes(t('share.upgrade.activate')), text);
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asked = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question parle de compléter (pas d\'activer)', asked.includes(t('rights.ask.sharing.extend.title')), asked);
  if (OLD_LOT === '4') check('la question dit ce qui arrive au rangement de chacun', asked.includes(t('rights.ask.sharing.filing').slice(0, 60)), asked);
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  check('la fenêtre du même fichier revient, active', (await frame.locator('[data-fk="share-add"]').count()) === 1 && (await frame.locator('#share-title').innerText()).includes(A));
  const tables = ((await call(page, 'GET', `/api/docs/${run.docId}/tables`)).json.tables || []).map(table => table.id);
  check('GFS_Espaces et GFS_Placement sont nées', tables.includes('GFS_Espaces') && tables.includes('GFS_Placement'), tables);
  const shares = await rows(run, 'GFS_Partages');
  check('rien n\'est repartagé : le même nombre de lignes de partage', shares.length === before, [before, shares.length]);
  const models = await byName(run);
  check('GFS_Directs est là : A a été donné à l\'éditeur par son adresse (par le propriétaire), B par un groupe (non compté)', has(models[A].GFS_Directs, `${EDITOR}>${OWNER}`) && !has(models[B].GFS_Directs, EDITOR), [models[A].GFS_Directs, models[B].GFS_Directs]);
  check('GFS_Calc est là et les listes gardent les mêmes personnes (A : éditeur ; B : éditeur par le groupe)', Boolean(models[A].GFS_Calc) && has(models[A].GFS_Lecteurs, EDITOR) && has(models[B].GFS_Lecteurs, EDITOR) && !has(models[PRIVATE].GFS_Lecteurs, EDITOR), [models[A].GFS_Calc, models[B].GFS_Lecteurs]);
  if (OLD_LOT === '4' || OLD_LOT === '5') {
    const columns = (await run.rest.columns('Publipostage_Modeles')).map(column => column.id);
    check('la colonne d\'aide GFS_Dossier est née dans la table de l\'app', columns.includes('GFS_Dossier'), columns);
    const placeColumns = (await run.rest.columns('GFS_Placement')).map(column => column.id);
    check('les liens entre espaces : GFS_Vus est née dans la table de l\'app, Lien et Partages dans le placement', columns.includes('GFS_Vus') && placeColumns.includes('Lien') && placeColumns.includes('Partages'), [columns, placeColumns]);
    const rules = (await rows(run, '_grist_ACLRules')) || [];
    check('les six règles « GFS : Partagé » du rangement sont posées', rules.filter(rule => /^GFS : Partagé/.test(rule.memo || '')).length === 6, rules.map(rule => rule.memo));
  }
  check('les anciens fichiers (« tous » en lecture) restent lisibles de tous', has((await byName(run))[FIRST].GFS_Cats, 'tous'));
  await frame.locator('[data-fk="share-close"]').click();
  await openShareFor(frame, B);
  check('le partage n\'est plus « à compléter »', (await frame.locator('[data-fk="share-activate"]').count()) === 0 && (await frame.locator('[data-fk="share-add"]').count()) === 1);
  await frame.locator('[data-fk="share-close"]').click();
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playEditor(run) {
  say('--- éditeur ---');
  const seen = await modelNames(run);
  check('il lit A et B (ses droits d\'avant sont gardés), pas le fichier privé', seen.includes(A) && seen.includes(B) && !seen.includes(PRIVATE), seen.filter(name => name.startsWith('Reprise')));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  say('--- lecteur ---');
  const seen = await modelNames(run);
  check('il ne lit aucun des trois', ![A, B, PRIVATE].some(name => seen.includes(name)), seen.filter(name => name.startsWith('Reprise')));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'ancien') {
    const run = await openGfs(context, { lang });
    await shareWithEditorAndViewer(run.page, run.docId);
    await playOld(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await ({ nouveau: playNew, editeur: playEditor, lecteur: playViewer })[phase](run);
  }
} finally {
  await browser.close();
  pages.close();
}
