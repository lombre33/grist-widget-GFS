// « Partager » pour les fichiers d'une app (contrats 11.7, point 13, lot 2) : les modèles de Publipostage+ (la table et les colonnes que l'app crée, `seed.mjs`) dans GFS, dans un VRAI Grist (`bash vrai-serveur.sh`),
// à 700 × 400, à la vraie souris, à trois comptes en trois temps (un seul compte à la fois, GRIST_EMAIL ; l'état passe par /tmp/partager-apps-etat.json).
//   PHASE=proprietaire  « Partager… » d'un modèle : activer (la question cite la table de l'app), Grist recharge, la fenêtre revient ; GFS a posé `GFS_Auteur` et les colonnes d'aide ; les modèles d'avant restent lisibles de tous ;
//                       un modèle créé par le propriétaire après l'activation n'est lu que de lui ; partage d'un modèle en écriture à l'éditeur.
//   PHASE=editeur       editor@ : lit les modèles d'avant, pas celui du propriétaire ; crée un modèle (comme le fait l'app) : Grist écrit son adresse ; ne triche pas sur l'auteur ; écrit le modèle qu'on lui a
//                       ouvert en écriture, pas un modèle en lecture ; la ligne de réglages reste ouverte ; partage son modèle avec viewer@ par la fenêtre.
//   PHASE=lecteur       viewer@ : lit les modèles d'avant et celui de l'éditeur, pas le privé du propriétaire ; n'écrit rien.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { seedFiles, seedForms } from './seed.mjs';
import { PAGE_PORT, openGfs, names, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_APPS_ETAT || '/tmp/partager-apps-etat.json';
const { t } = createI18n(lang);
const MODELS = 'Publipostage_Modeles';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FIRST = 'Contrat de prestation';
const WRITABLE = 'Quittance de loyer';
const shot = (frame, name) => pdfShot(frame, `partager-apps-${lang}-${scheme}-${name}`);
const panel = async frame => (await frame.locator('.mod.sh').innerText()).replace(/\s+/g, ' ');
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 300) };
}, [method, path, body]);
const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);
const rows = async (run, table) => { const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : []; };
const modelNames = async run => (await rows(run, MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => row.Nom).sort();

async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
const closeShare = async frame => { await frame.locator('[data-fk="share-close"]').click(); await frame.locator('.mod.sh').waitFor({ state: 'detached' }); };
async function addPerson(frame, who) {
  const before = await frame.locator('.mod.sh .rr[data-share]').count();
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(who);
  await frame.locator(`[data-fk="share-pick-${who}"]`).click();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.waitForFunction(count => document.querySelectorAll('.mod.sh .rr[data-share]').length > count, before, { timeout: 15000 });
}
async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}
const idOf = async (run, name) => (await rows(run, MODELS)).find(row => row.Nom === name).id;

async function playOwner(run) {
  const { page } = run;
  let { frame } = run;
  say('--- 0. les modèles de l\'app (18 modèles et une ligne de réglages) ---');
  await seedFiles(frame);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  const listed = await names(frame);
  check('l\'explorateur liste les modèles', listed.includes(FIRST) && listed.includes(WRITABLE), listed.slice(0, 5));

  say('--- 1. « Partager… » sur un modèle, partage pas activé ---');
  await openShareFor(frame, FIRST);
  let text = await panel(frame);
  check('la fenêtre propose d\'activer (un modèle d\'app se partage)', (await frame.locator('[data-fk="share-activate"]').count()) === 1 && text.includes(t('share.inactive.owner')), text);
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asked = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question cite la table de l\'app et ses colonnes « GFS_ »', asked.includes(MODELS) && asked.includes('GFS_'), asked);
  await shot(frame, '1-question');
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  check('GFS a rouvert la fenêtre du même modèle', (await frame.locator('#share-title').innerText()).includes(FIRST));
  check('la fenêtre tient dans la page et reste lisible', await fits(frame, '.mod.sh'), [await contrastProblems(frame, '.mod.sh')]);
  await shot(frame, '2-actif');

  say('--- 2. ce que GFS a posé ---');
  const columns = await call(page, 'GET', `/api/docs/${run.docId}/tables/${MODELS}/columns`);
  const ids = (columns.json.columns || []).map(column => column.id);
  check('la table de l\'app porte GFS_Auteur et les cinq colonnes d\'aide', ['GFS_Auteur', 'GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins', 'GFS_Cats', 'GFS_CatsEcrit'].every(id => ids.includes(id)), ids);
  const shares = await rows(run, 'GFS_Partages');
  say('   partages :', shares.length, 'dont tous :', shares.filter(row => row.Personne === '@tous').length);
  check('les modèles d\'avant restent lisibles de tous : un partage « tous » par ligne de la table', shares.filter(row => row.Personne === '@tous' && /^publipostage:/.test(row.Cible)).length >= 18, shares.length);
  const before = (await rows(run, MODELS)).find(row => row.Nom === FIRST);
  say('   auteur des lignes d\'avant :', JSON.stringify(before.GFS_Auteur));
  await closeShare(frame);

  say('--- 3. un modèle créé après l\'activation (comme le fait l\'app) ---');
  let answer = await apply(run, [['AddRecord', MODELS, null, { Nom: 'Privé du propriétaire', TypeModele: 'document', DateModif: Math.floor(Date.now() / 1000) }]]);
  check('le propriétaire crée un modèle', answer.status === 200, answer.text);
  const mine = (await rows(run, MODELS)).find(row => row.Nom === 'Privé du propriétaire');
  check('Grist écrit son adresse dans GFS_Auteur (l\'app n\'écrit rien)', mine.GFS_Auteur === OWNER, mine.GFS_Auteur);
  check('un modèle neuf n\'est lu que de son auteur : GFS_Lecteurs = lui seul', JSON.stringify(mine.GFS_Lecteurs).includes(OWNER) && !JSON.stringify(mine.GFS_Lecteurs).includes('example.com","') , mine.GFS_Lecteurs);

  say('--- 4. partager par la fenêtre ---');
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, WRITABLE);
  text = await panel(frame);
  check('modèle d\'avant : la ligne « tout le document » est là, le champ d\'ajout aussi', (await frame.locator('[data-fk="share-add"]').count()) === 1 && (await frame.locator('.mod.sh .rr[data-share]').count()) >= 1, text);
  await addPerson(frame, EDITOR);
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: EDITOR }).locator('button.lvl').click();
  await frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.ecriture')) }).first().click();
  await page.waitForTimeout(1500);
  const writableKey = `publipostage:${await idOf(run, WRITABLE)}`;
  const given = (await rows(run, 'GFS_Partages')).find(row => row.Cible === writableKey && row.Personne === EDITOR);
  check('l\'éditeur a l\'écriture sur ce modèle dans la table des partages', given && given.Droit === 'ecriture' && given.Valide === true, given);
  await shot(frame, '3-partage');
  await closeShare(frame);

  say('--- 5. une app ajoutée après l\'activation : Form+ ---');
  await seedForms(frame);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  const form = (await names(frame)).find(name => /Inscription/.test(name));
  await openShareFor(frame, form);
  text = await panel(frame);
  check('la fenêtre propose d\'étendre le partage à cette app (et pas de l\'activer de nouveau)', (await frame.locator('[data-fk="share-activate"]').count()) === 1 && text.includes(t('share.extend.owner')), text);
  await shot(frame, '5-etendre');
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const extending = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question cite la table de Form+ seule', extending.includes('FormPlus_Formulaires') && !extending.includes(MODELS), extending);
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  check('GFS a rouvert la fenêtre du formulaire, prête à partager', (await frame.locator('[data-fk="share-add"]').count()) === 1);
  const formColumns = ((await call(page, 'GET', `/api/docs/${run.docId}/tables/FormPlus_Formulaires/columns`)).json.columns || []).map(column => column.id);
  check('la table de Form+ porte GFS_Auteur et les colonnes d\'aide', ['GFS_Auteur', 'GFS_Lecteurs', 'GFS_CatsEcrit'].every(id => formColumns.includes(id)), formColumns);
  const modelsAfter = await modelNames(run);
  check('les modèles de Publipostage+ n\'ont pas bougé', modelsAfter.includes(FIRST) && modelsAfter.includes('Privé du propriétaire'), modelsAfter.length);
  await shot(frame, '6-formulaire-partage');
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId }));
}

async function playEditor(run) {
  const { page } = run;
  const { frame } = run;
  say('--- éditeur ---');
  const seen = await modelNames(run);
  check('il lit les modèles d\'avant, pas le privé du propriétaire', seen.includes(FIRST) && seen.includes(WRITABLE) && !seen.includes('Privé du propriétaire'), seen);
  let answer = await apply(run, [['AddRecord', MODELS, null, { Nom: 'Modèle de l\'éditeur', TypeModele: 'document', DateModif: Math.floor(Date.now() / 1000) }]]);
  check('il crée un modèle (comme l\'app)', answer.status === 200, answer.text);
  const mine = (await rows(run, MODELS)).find(row => row.Nom === 'Modèle de l\'éditeur');
  check('Grist écrit son adresse dans GFS_Auteur', mine && mine.GFS_Auteur === EDITOR, mine);
  answer = await apply(run, [['AddRecord', MODELS, null, { Nom: 'Au nom du propriétaire', TypeModele: 'document', GFS_Auteur: OWNER }]]);
  check('il ne crée pas un modèle au nom d\'un autre', answer.status !== 200, answer.text);
  const editable = (await rows(run, MODELS)).find(row => row.Nom === WRITABLE);
  answer = await apply(run, [['UpdateRecord', MODELS, editable.id, { ModifiePar: 'editeur' }]]);
  check('il écrit le modèle qu\'on lui a ouvert en écriture', answer.status === 200, answer.text);
  const readOnly = (await rows(run, MODELS)).find(row => row.Nom === FIRST);
  answer = await apply(run, [['UpdateRecord', MODELS, readOnly.id, { ModifiePar: 'editeur' }]]);
  check('il n\'écrit pas un modèle qu\'il ne fait que lire', answer.status !== 200, answer.text);
  const settings = (await rows(run, MODELS)).find(row => row.TypeModele === 'reglages');
  check('la ligne de réglages de l\'app lui reste ouverte, en lecture', Boolean(settings));
  answer = await apply(run, [['UpdateRecord', MODELS, settings.id, { Contenu: '{"a":1}' }]]);
  check('et en écriture (l\'app y garde ses réglages)', answer.status === 200, answer.text);
  answer = await apply(run, [['UpdateRecord', MODELS, mine.id, { GFS_Auteur: OWNER }]]);
  check('il ne change pas l\'auteur d\'une ligne', answer.status !== 200, answer.text);

  say('--- la fenêtre ---');
  await page.reload();
  const refreshed = await gfsFrame(page);
  await refreshed.locator('.ls-row').first().waitFor();
  await openShareFor(refreshed, 'Modèle de l\'éditeur');
  check('auteur de son modèle : il peut ajouter quelqu\'un', (await refreshed.locator('[data-fk="share-add"]').count()) === 1 && (await refreshed.locator('[data-fixed="author"]').count()) === 1, await panel(refreshed));
  await addPerson(refreshed, VIEWER);
  const shared = (await rows(run, 'GFS_Partages')).find(row => row.Personne === VIEWER && row.Auteur === EDITOR);
  check('son partage est écrit sans propriétaire, valide', shared && shared.Valide === true, shared);
  await shot(refreshed, '4-editeur');
  await closeShare(refreshed);
  await openShareFor(refreshed, FIRST);
  check('sur un modèle qu\'il ne fait que lire : rien à ajouter, la fenêtre le dit', (await refreshed.locator('[data-fk="share-add"]').count()) === 0 && (await refreshed.locator('[data-fk="share-readonly"]').count()) === 1, await panel(refreshed));
  await closeShare(refreshed);
  check('aucune erreur de GFS dans la console', unexpected({ problems: run.problems, allow: run.allow }).length === 0, unexpected(run));
}

async function playViewer(run) {
  say('--- lecteur ---');
  const seen = await modelNames(run);
  check('il lit les modèles d\'avant et celui que l\'éditeur lui a partagé, pas le privé du propriétaire', seen.includes(FIRST) && seen.includes('Modèle de l\'éditeur') && !seen.includes('Privé du propriétaire'), seen);
  const first = (await rows(run, MODELS)).find(row => row.Nom === FIRST);
  const answer = await apply(run, [['UpdateRecord', MODELS, first.id, { ModifiePar: 'lecteur' }]]);
  check('lecteur du document : il n\'écrit rien', answer.status !== 200, answer.text);
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
    await playOwner(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await (phase === 'editeur' ? playEditor : playViewer)(run);
  }
} finally {
  await browser.close();
  pages.close();
}
