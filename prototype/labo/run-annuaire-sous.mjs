// Les sous-annuaires du module Annuaire (demande du porteur du 25/11) et leur VERROU, dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris,
// à quatre temps (un compte à la fois : le serveur n'en connaît qu'un, GRIST_EMAIL ; l'état passe par /tmp/annuaire-sous-etat.json). Le verrou n'est pas dans l'écran : c'est une règle d'accès de
// Grist sur la table `GFS_Directories`, que GFS pose avec l'accord de la personne. L'essai l'attaque donc par l'API REST, sans passer par GFS, avec le compte de chacun.
//   PHASE=proprietaire  le document (deux annuaires, l'un lit la table Personnes) est partagé à un éditeur et à un lecteur ; « Nouveau sous-annuaire » (Pôle Ressources) pose les règles du partage
//                       (la question, puis Grist recharge la page), crée la copie, ouvre « Partager » : l'éditeur reçoit la lecture ; la copie dit « 7 personnes » ; les annuaires principaux restent
//                       lisibles par tous ; la vue « Tous mes annuaires » compte trois annuaires.
//   PHASE=editeur       editor@ : lit la copie (partagée) ; la vue réunie la montre ; ne peut pas l'actualiser (grisé, avec sa raison) ; ne peut pas changer la ligne de la copie (règle d'accès de Grist).
//   PHASE=lecteur       viewer@ : ne lit PAS la ligne de la copie (ni ses fiches, par l'API) ; lit les annuaires principaux ; la liste des annuaires de GFS ne montre pas la copie ; la vue réunie compte deux
//                       annuaires. Limite dite à la personne : la table source des fiches reste lisible selon SES propres règles (ce que l'essai constate, sans le juger).
//   PHASE=nettoyage     essai@ de nouveau : « Supprimer » le sous-annuaire (la question, puis la ligne et ses traces partent) ; les annuaires principaux et la table Personnes ne changent pas.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" PHASE=proprietaire node run-annuaire-sous.mjs
//   GRIST_EMAIL=editor@example.com bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" PHASE=editeur node run-annuaire-sous.mjs   (puis viewer@example.com, PHASE=lecteur ; puis bash vrai-serveur.sh, PHASE=nettoyage)
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { gfsFrame, shareWithEditorAndViewer } from './lab-droits.mjs';
import { call, rowsOf, apply } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.ANNUAIRE_SOUS_ETAT || '/tmp/annuaire-sous-etat.json';
const { t } = createI18n(lang);
const EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const SUB = 'Pôle Ressources (essai)';
const TAG = `annuaire-sous-${lang}-${scheme}`;
const CONFIG = {
  v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', lead: 'Chef', manager: 'Responsable', relations: [], columns: ['email'],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }],
};

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
// Hors propriétaire, Grist refuse la lecture SQL d'un document qui a des règles d'accès : GFS éteint sa lecture légère et relit les tables en entier (son avertissement est attendu).
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));
const annuaires = async run => (await rowsOf(run, 'GFS_Directories')) || [];
const subOf = list => list.find(row => row.Name === SUB);

// Ouvre la fenêtre de l'annuaire depuis l'explorateur (le bouton du titre) ; `row` : un annuaire précis n'est pas demandé, la fenêtre prend ce que GFS choisit.
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
}

// La ligne d'une liste avec recherche (`.wk-item`) dont le nom commence par `label`.
const pickRow = (frame, label) => frame.locator('.mod-scrim:has(.wk-item)').last().locator('.wk-item', { hasText: label }).first();

// « Un seul annuaire… » depuis la vue réunie, ou la liste des annuaires depuis un annuaire : la liste s'ouvre.
async function openSwitcher(frame) {
  await frame.locator('[data-fk="switch"]').click();
  if (await frame.locator('[data-fk="mp-one"]').count()) await frame.locator('[data-fk="mp-one"]').click();
  await frame.locator('.wk-item').first().waitFor();
}
const switcherNames = frame => frame.locator('.mod-scrim:has(.wk-item)').last().locator('.wk-item .wk-name').allTextContents();

// 0. Le document : les tables des personnes, deux annuaires.
async function seed(run) {
  await seedAnnuaire(run.frame);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
    await store.create({ name: 'Annuaire des directions', table: 'Personnes', config: { ...config, levels: config.levels.slice(0, 2) } });
  }, CONFIG);
  const list = await annuaires(run);
  check('les deux annuaires principaux sont dans GFS_Directories', list.length === 2, list.map(row => row.Name));
}

// « Nouveau sous-annuaire » : la liste des annuaires, « Nouveau sous-annuaire », puis l'annuaire d'origine (la question « de quel annuaire ? » vient quand il y en a plusieurs).
async function startNew(frame) {
  await openSwitcher(frame);
  await pickRow(frame, t('an.sub.new')).click();
  await pickRow(frame, 'Annuaire de l’établissement').click();
}

// La fenêtre « Nouveau sous-annuaire » : le nom, le critère « Pôle », la valeur « Pôle Ressources », « Créer ».
async function fillSub(frame, page) {
  await frame.locator('[data-fk="sub-name"]').waitFor({ timeout: 30000 });
  await frame.locator('[data-fk="sub-name"]').fill(SUB);
  await frame.locator('[data-fk="sub-key"]').click();
  await pickRow(frame, 'Pôle').click();
  await frame.locator('[data-fk="sub-add"]').click();
  await pickRow(frame, 'Pôle Ressources').click();
  await page.waitForTimeout(300);
  await frame.locator('[data-fk="sub-ok"]').click();
}

// Le sous-annuaire : la première fois, GFS pose d'abord les règles du partage (la question, puis Grist recharge la page : GFS rouvre l'annuaire) ; le geste est alors à refaire.
async function createSub(run, start) {
  const { page } = run;
  let frame = start;
  say('--- 1. « Nouveau sous-annuaire » : les règles du partage, puis la copie ---');
  await openAnnuaire(frame, page);
  await startNew(frame);
  await frame.locator('.mod.ask').waitFor({ timeout: 20000 });
  const asking = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('GFS demande l\'accord avant de poser les règles (la question dit ce qui change)', asking.length > 40, asking.slice(0, 160));
  await shot(frame, '1-question');
  const old = frame;
  await frame.locator('[data-fk="ask-yes"]').click();
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  frame = await gfsFrame(page, { keep: true });
  await frame.locator('.mod.an').waitFor({ state: 'visible', timeout: 40000 });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  const columns = (await call(page, 'GET', `/api/docs/${run.docId}/tables/GFS_Directories/columns`)).json;
  const ids = ((columns && columns.columns) || []).map(column => column.id);
  check('les colonnes du verrou sont dans GFS_Directories (lecteurs, refus)', ids.includes('GFS_Readers') && ids.includes('GFS_Denied'), ids);
  await startNew(frame);
  await fillSub(frame, page);
  await frame.locator('.mod.sh').waitFor({ timeout: 30000 });
  await shot(frame, '2-partager');
  return frame;
}

async function playOwner(run) {
  const { page } = run;
  await shareWithEditorAndViewer(page, run.docId);
  await seed(run);
  await page.reload();
  let frame = await gfsFrame(page);
  await frame.locator('.ls-row, .ex-title-row').first().waitFor();
  frame = await createSub(run, frame);
  say('--- 2. « Partager » : l\'éditeur reçoit la lecture ---');
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(EDITOR);
  await frame.locator(`[data-fk="share-pick-${EDITOR}"]`).click();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: EDITOR }).waitFor({ timeout: 20000 });
  await frame.locator('[data-fk="share-close"]').click();
  await frame.locator('.mod.sh').waitFor({ state: 'detached' });
  const list = await annuaires(run);
  const sub = subOf(list);
  check('la copie est dans GFS_Directories, avec son origine', Boolean(sub) && Boolean(sub.Parent), list.map(row => row.Name));
  const copy = JSON.parse(sub.Fiches || '{}');
  const people = Array.isArray(copy) ? copy : (copy.people || copy.fiches || []);
  check('la copie porte les sept personnes du pôle (et non les dix-huit)', people.length === 7, people.length);
  check('l\'éditeur est lecteur de la copie, le lecteur du document ne l\'est pas', JSON.stringify(sub.GFS_Readers).includes(EDITOR) && !JSON.stringify(sub.GFS_Readers).includes(VIEWER), sub.GFS_Readers);
  const main = list.filter(row => row.Name !== SUB);
  check('les annuaires principaux n\'ont aucun lecteur nommé (lisibles par tous)', main.every(row => !row.GFS_Readers || row.GFS_Readers.length <= 1), main.map(row => row.GFS_Readers));
  say('--- 3. la liste des annuaires et la vue réunie ---');
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const name = (await frame.locator('.an-name-t').innerText()).trim();
  check('la fenêtre s\'ouvre sur « Tous mes annuaires » avec trois annuaires', name === t('an.merge.name', { n: 3 }), name);
  await openSwitcher(frame);
  const shown = await switcherNames(frame);
  check('la liste montre le sous-annuaire sous son origine', shown.includes(SUB) && shown.includes('Annuaire de l’établissement') && shown.includes('Annuaire des directions'), shown);
  await shot(frame, '3-liste');
  await pickRow(frame, SUB).click();
  await frame.locator('.an-sub-tag').waitFor({ state: 'visible' });
  check('le sous-annuaire montre son cadenas et ses sept personnes', (await frame.locator('.an-person').count()) === 7 && (await frame.locator('[data-fk="sub"]').count()) === 1, await frame.locator('.an-person').count());
  await shot(frame, '4-sous-annuaire');
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId, sub: sub.id }));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playEditor(run) {
  const { page } = run;
  say('--- éditeur ---');
  const list = await annuaires(run);
  check('il lit les annuaires principaux et la copie partagée avec lui', list.some(row => row.Name === SUB) && list.length === 3, list.map(row => row.Name));
  // Éditeur du document, il peut créer un annuaire à lui ; il ne peut pas changer la ligne de la copie dont il n'est que lecteur (le verrou : la règle d'accès de Grist sur la ligne).
  const sub = subOf(list);
  const write = await apply(run, [['UpdateRecord', 'GFS_Directories', sub.id, { Name: 'Pirate' }]]);
  check('il ne change pas la ligne de la copie (verrou de Grist)', write.status !== 200, write.text);
  const after = subOf(await annuaires(run));
  check('le nom de la copie est resté', Boolean(after) && after.Name === SUB, after && after.Name);
  await page.reload();
  const frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const name = (await frame.locator('.an-name-t').innerText()).trim();
  check('la vue réunie compte trois annuaires', name === t('an.merge.name', { n: 3 }), name);
  await openSwitcher(frame);
  await pickRow(frame, SUB).click();
  await frame.locator('.an-sub-tag').waitFor({ state: 'visible' });
  await frame.locator('[data-fk="sub"]').click();
  const refresh = frame.locator('.menu-item', { hasText: t('an.sub.refresh') }).first();
  check('« Actualiser » est grisé pour lui (lecteur de la copie), avec sa raison', (await refresh.getAttribute('aria-disabled')) === 'true' && Boolean(await refresh.getAttribute('title')), await refresh.getAttribute('title'));
  await shot(frame, '5-editeur');
  await page.keyboard.press('Escape');
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  const { page } = run;
  say('--- lecteur du document ---');
  const answer = await call(page, 'GET', `/api/docs/${run.docId}/tables/GFS_Directories/records`);
  const names = answer.status === 200 ? answer.json.records.map(row => row.fields.Name) : [];
  check('il lit les deux annuaires principaux, pas la copie', names.length === 2 && !names.includes(SUB), names);
  check('aucune fiche de la copie ne sort par l\'API', !answer.text.includes('Emma Rolland') || !JSON.stringify(answer.json).includes('"Fiches":"{'), answer.text.slice(0, 200));
  const source = await call(page, 'GET', `/api/docs/${run.docId}/tables/Personnes/records`);
  say('CONSTAT la table source des fiches est', source.status === 200 ? 'lisible par lui, selon SES propres règles (limite dite à la personne)' : `fermée (${source.status})`);
  const write = await apply(run, [['AddRecord', 'GFS_Directories', null, { Name: 'Pirate', Table: 'Personnes' }]]);
  check('il n\'écrit pas dans GFS_Directories', write.status !== 200, write.text);
  await page.reload();
  const frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const name = (await frame.locator('.an-name-t').innerText()).trim();
  check('la vue réunie compte deux annuaires', name === t('an.merge.name', { n: 2 }), name);
  await openSwitcher(frame);
  const shown = await switcherNames(frame);
  check('la liste des annuaires ne montre pas la copie', !shown.includes(SUB) && shown.length >= 2, shown);
  await shot(frame, '6-lecteur');
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playClean(run) {
  const { page } = run;
  say('--- nettoyage : « Supprimer » ---');
  const before = await annuaires(run);
  const people = await rowsOf(run, 'Personnes');
  await page.reload();
  const frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await openSwitcher(frame);
  await pickRow(frame, SUB).click();
  await frame.locator('.an-sub-tag').waitFor({ state: 'visible' });
  await frame.locator('[data-fk="sub"]').click();
  await frame.locator('.menu-item', { hasText: t('an.sub.remove') }).first().click();
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  await page.waitForTimeout(1200);
  const after = await annuaires(run);
  check('la copie a disparu de GFS_Directories, les deux annuaires principaux restent', after.length === before.length - 1 && !subOf(after), after.map(row => row.Name));
  const kept = await rowsOf(run, 'Personnes');
  check('la table des personnes ne change pas', JSON.stringify(kept) === JSON.stringify(people), kept && kept.length);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang });
    await playOwner(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await ({ editeur: playEditor, lecteur: playViewer, nettoyage: playClean }[phase])(run);
  }
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 400));
  for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: join(SHOTS, `${TAG}-erreur.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  pages.close();
}
