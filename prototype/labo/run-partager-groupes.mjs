// Les groupes et « Gérer les partages » (contrats 11.7, point 13, lot 3) dans un VRAI Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, à trois comptes en trois temps (un seul compte à la fois,
// GRIST_EMAIL ; l'état passe par /tmp/partager-groupes-etat.json). Les fichiers sont les modèles de Publipostage+ (la table et les colonnes que l'app crée, `seed.mjs`).
//   PHASE=proprietaire  active le partage ; « Gérer les partages… » : crée un groupe tapé (Achats : l'éditeur), lit les groupes d'une table (Contacts : Mail, Equipe) ; partage un modèle privé au groupe et un autre au groupe lu ;
//                       change les adresses du groupe : les colonnes d'aide suivent ; donne « Lecture » aux éditeurs sur tout le document (la racine) ; la structure se ferme depuis la fenêtre.
//   PHASE=editeur       editor@ : lit tous les modèles (la racine donne « Lecture » aux éditeurs) ; ne lit pas les adresses des groupes ; n'écrit pas les groupes ; voit les groupes à partager ;
//                       « Gérer les partages… » lui dit de demander à un propriétaire.
//   PHASE=lecteur       viewer@ : lit le modèle du groupe Achats (ajouté par la modification) et celui du groupe lu d'une table, pas celui de la racine (éditeurs) ; ne lit pas les adresses des groupes.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, names, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_GROUPES_ETAT || '/tmp/partager-groupes-etat.json';
const { t } = createI18n(lang);
const MODELS = 'Publipostage_Modeles';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FIRST = 'Contrat de prestation';
const PRIVATE_A = 'Privé groupe Achats', PRIVATE_L = 'Privé groupe Lecteurs', PRIVATE_N = 'Privé non partagé', PRIVATE_R = 'Privé racine';
const shot = (frame, name) => pdfShot(frame, `partager-groupes-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 400) };
}, [method, path, body]);
const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);
const rows = async (run, table) => { const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : []; };
const modelNames = async run => (await rows(run, MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => row.Nom).sort();
const idOf = async (run, name) => (await rows(run, MODELS)).find(row => row.Nom === name).id;

async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
const closeShare = async frame => { await frame.locator('[data-fk="share-close"]').click(); await frame.locator('.mod.sh').waitFor({ state: 'detached' }); };
async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}
async function addGroup(frame, group) {
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(group);
  await frame.locator(`[data-fk="share-pick-#${group}"]`).click();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: group }).waitFor({ timeout: 15000 });
}
const openManage = async frame => { await frame.locator('[data-fk="share-manage"]').click(); await frame.locator('.mod.mg .rt-content').waitFor(); };
const closeManage = async frame => { await frame.locator('.mod.mg [data-fk="manage-close"]').click(); await frame.locator('.mod.mg').waitFor({ state: 'detached' }); };
const inModels = async run => { const all = await rows(run, MODELS); return Object.fromEntries(all.map(row => [row.Nom, row])); };
const readers = row => JSON.stringify(row && row.GFS_Lecteurs);

async function playOwner(run) {
  const { page } = run;
  let { frame } = run;
  say('--- 0. les modèles de l\'app, et un tableau de contacts (qui est dans quel groupe) ---');
  await seedFiles(frame);
  let answer = await apply(run, [
    ['AddTable', 'Contacts', [{ id: 'Mail', fields: { type: 'Text' } }, { id: 'Equipe', fields: { type: 'Text' } }]],
  ]);
  check('la table Contacts est créée', answer.status === 200, answer.text);
  answer = await apply(run, [['BulkAddRecord', 'Contacts', [null, null, null], { Mail: [VIEWER, ` ${VIEWER.toUpperCase()} `, 'autre@example.com'], Equipe: ['Lecteurs', 'Lecteurs', 'Ailleurs'] }]]);
  check('trois contacts', answer.status === 200, answer.text);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();

  say('--- 1. activer le partage : la table des groupes naît avec lui ---');
  await openShareFor(frame, FIRST);
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  const tables = ((await call(page, 'GET', `/api/docs/${run.docId}/tables`)).json.tables || []).map(table => table.id);
  check('GFS_Groupes est créée avec le partage', tables.includes('GFS_Groupes'), tables);

  say('--- 2. « Gérer les partages… » : un groupe tapé ---');
  check('« Gérer les partages… » est dans la fenêtre « Partager », possible pour un propriétaire', (await frame.locator('[data-fk="share-manage"]').count()) === 1 && (await frame.locator('[data-fk="share-manage"]').getAttribute('aria-disabled')) === null);
  await openManage(frame);
  check('la fenêtre tient dans la page, lisible', await fits(frame, '.mod.mg'), [await contrastProblems(frame, '.mod.mg')]);
  await shot(frame, '1-options');
  await frame.locator('[data-fk="manage-tab-groups"]').click();
  await frame.locator('[data-fk="manage-group-new"]').click();
  await frame.locator('[data-fk="manage-group-name"]').fill('Achats');
  await frame.locator('[data-fk="manage-group-people"]').fill(`${EDITOR}\n`);
  check('le formulaire tient à 700 × 400 (le bouton se voit)', await fits(frame, '.mod.mg') && await frame.locator('[data-fk="manage-group-save"]').isVisible());
  await shot(frame, '2-groupe');
  await frame.locator('[data-fk="manage-group-save"]').click();
  await frame.locator('.rr[data-group="Achats"]').waitFor({ timeout: 15000 });
  const achats = (await rows(run, 'GFS_Groupes')).find(row => row.Nom === 'Achats');
  check('le groupe Achats compte une personne : l\'éditeur', achats && achats.Nb === 1 && JSON.stringify(achats.Membres).includes(EDITOR), achats);

  say('--- 3. lire les groupes d\'une table : Contacts (Mail, Equipe) ---');
  await frame.locator('[data-fk="manage-group-read"]').click();
  await frame.locator('[data-fk="pick-Contacts"]').click();
  await frame.locator('[data-fk="pick-Mail"]').click();
  await frame.locator('[data-fk="pick-Equipe"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asking = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit combien de groupes (deux : Lecteurs, Ailleurs)', /\b2\b/.test(asking) && asking.includes('Contacts'), asking);
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.locator('.rr[data-group="Lecteurs"]').waitFor({ timeout: 15000 });
  const groups = await rows(run, 'GFS_Groupes');
  const lecteurs = groups.find(row => row.Nom === 'Lecteurs');
  check('le groupe Lecteurs est lu de la table : une personne, l\'adresse nettoyée (espaces, majuscules)', lecteurs && lecteurs.Nb === 1 && JSON.stringify(lecteurs.Membres).includes(VIEWER), lecteurs);
  await shot(frame, '3-groupes');
  await closeManage(frame);
  await closeShare(frame);

  say('--- 4. partager des modèles privés à un groupe ---');
  const now = Math.floor(Date.now() / 1000);
  answer = await apply(run, [['BulkAddRecord', MODELS, [null, null, null, null], { Nom: [PRIVATE_A, PRIVATE_L, PRIVATE_N, PRIVATE_R], TypeModele: ['document', 'document', 'document', 'document'], DateModif: [now, now, now, now] }]]);
  check('quatre modèles privés créés par le propriétaire', answer.status === 200, answer.text);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, PRIVATE_A);
  await frame.locator('[data-fk="share-add"]').click();
  const options = (await frame.locator('.mod.sh .drop .opt').allInnerTexts()).join(' | ');
  check('la liste propose les deux groupes, avec leur effectif', options.includes('Achats') && options.includes('Lecteurs') && /1/.test(options), options);
  await shot(frame, '4-liste');
  await addGroup(frame, 'Achats');
  const rowA = (await inModels(run))[PRIVATE_A];
  check('la colonne d\'aide GFS_Lecteurs du modèle contient l\'éditeur (le groupe est développé par Grist)', readers(rowA).includes(EDITOR) && readers(rowA).includes(OWNER), rowA && rowA.GFS_Lecteurs);
  const shareRow = (await rows(run, 'GFS_Partages')).find(row => row.Personne === '#Achats');
  check('la ligne de partage vise « #Achats », valide', shareRow && shareRow.Valide === true && shareRow.Droit === 'lecture', shareRow);
  const text = (await frame.locator('.mod.sh').innerText()).replace(/\s+/g, ' ');
  check('la ligne se lit « Groupe · Achats »', text.includes(t('share.group.label', { name: 'Achats' })), text);
  await shot(frame, '5-partage-groupe');
  await closeShare(frame);
  await openShareFor(frame, PRIVATE_L);
  await addGroup(frame, 'Lecteurs');
  const rowL = (await inModels(run))[PRIVATE_L];
  check('le groupe lu d\'une table est développé : GFS_Lecteurs contient le lecteur', readers(rowL).includes(VIEWER), rowL && rowL.GFS_Lecteurs);
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: 'Lecteurs' }).locator('button.lvl').click();
  const adminItem = frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.admin')) }).first();
  const greyed = await adminItem.getAttribute('aria-disabled');
  await adminItem.click({ force: true });
  check('l\'administration est grisée pour un groupe, et dit pourquoi', greyed === 'true' && (await frame.locator('.mod.sh .mod-note').innerText()).includes(t('share.right.admin.person')));
  await closeShare(frame);

  say('--- 5. changer les adresses du groupe : les fichiers suivent ---');
  await openShareFor(frame, PRIVATE_A);
  await openManage(frame);
  await frame.locator('[data-fk="manage-tab-groups"]').click();
  await frame.locator('[data-fk="manage-edit-Achats"]').click();
  await frame.locator('[data-fk="manage-group-people"]').fill(`${EDITOR}\n${VIEWER}\n`);
  await frame.locator('[data-fk="manage-group-save"]').click();
  await frame.locator('.rr[data-group="Achats"]').filter({ hasText: '2' }).waitFor({ timeout: 15000 });
  const rowA2 = (await inModels(run))[PRIVATE_A];
  check('le modèle suit : le lecteur est maintenant dans GFS_Lecteurs', readers(rowA2).includes(VIEWER) && readers(rowA2).includes(EDITOR), rowA2 && rowA2.GFS_Lecteurs);

  say('--- 6. catégories : « Lecture » aux éditeurs sur tout le document ---');
  await frame.locator('[data-fk="manage-tab-cats"]').click();
  await frame.locator('[data-fk="manage-cat-editeurs"]').click();
  await frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.lecture')) }).first().click();
  await frame.locator('[data-fk="manage-cat-editeurs"]').filter({ hasText: t('share.right.lecture') }).waitFor({ timeout: 15000 });
  const root = (await rows(run, 'GFS_Partages')).find(row => row.Cible === '*' && row.Personne === '@editeurs');
  check('une ligne « * » pour les éditeurs, en lecture', root && root.Droit === 'lecture', root);
  const rowR = (await inModels(run))[PRIVATE_R];
  check('le modèle « racine » est lu des éditeurs (GFS_Cats) mais pas du lecteur', JSON.stringify(rowR.GFS_Cats).includes('editeurs') || JSON.stringify(rowR.GFS_Cats).includes('@'), rowR && rowR.GFS_Cats);
  await shot(frame, '6-categories');

  say('--- 7. la structure, depuis la fenêtre ---');
  await frame.locator('[data-fk="manage-tab-options"]').click();
  await frame.locator('[data-fk="manage-structure"]').click();
  await frame.locator('.mod.ask').waitFor();
  const closing = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question de la structure est celle du panneau (fermer)', closing.includes(t('rights.ask.close.title')), closing);
  await frame.locator('[data-fk="ask-no"]').click().catch(() => {});
  await frame.locator('.mod.ask').waitFor({ state: 'detached' }).catch(() => {});
  await closeManage(frame);
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId }));
}

async function playEditor(run) {
  const { page } = run;
  say('--- éditeur ---');
  const seen = await modelNames(run);
  check('il lit tous les modèles privés : la racine donne « Lecture » à tous les éditeurs sur tout le document', [PRIVATE_A, PRIVATE_L, PRIVATE_N, PRIVATE_R].every(name => seen.includes(name)), seen);
  const groups = await call(page, 'GET', `/api/docs/${run.docId}/tables/GFS_Groupes/records`);
  check('il ne lit ni les adresses ni les membres des groupes', !groups.text.includes('example.com'), groups.text.slice(0, 200));
  const answer = await apply(run, [['AddRecord', 'GFS_Groupes', null, { Nom: 'Pirate', PersonnesIci: EDITOR }]]);
  check('il n\'écrit pas dans les groupes', answer.status !== 200, answer.text);
  const own = await apply(run, [['AddRecord', MODELS, null, { Nom: 'Modèle de l\'éditeur', TypeModele: 'document', DateModif: Math.floor(Date.now() / 1000) }]]);
  check('il crée un modèle', own.status === 200, own.text);
  await page.reload();
  const frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, 'Modèle de l\'éditeur');
  await frame.locator('[data-fk="share-add"]').click();
  const options = (await frame.locator('.mod.sh .drop .opt').allInnerTexts()).join(' | ');
  check('auteur d\'un modèle, il voit les groupes à partager (nom et effectif), jamais leurs adresses', options.includes('Achats') && !options.includes('example.com'), options);
  await shot(frame, '7-editeur');
  await frame.locator('[data-fk="share-manage"]').click();
  await page.waitForTimeout(500);
  const note = (await frame.locator('.mod.sh .mod-note').innerText()).replace(/\s+/g, ' ');
  check('« Gérer les partages… » lui dit de demander à un propriétaire, sans ouvrir de fenêtre', note.includes(t('manage.other')) && (await frame.locator('.mod.mg').count()) === 0, note);
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  say('--- lecteur ---');
  const seen = await modelNames(run);
  check('il lit le modèle du groupe Achats (ajouté par la modification), celui du groupe lu d\'une table, pas celui de la racine ni le non partagé', seen.includes(PRIVATE_A) && seen.includes(PRIVATE_L) && !seen.includes(PRIVATE_R) && !seen.includes(PRIVATE_N), seen);
  const groups = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/GFS_Groupes/records`);
  check('il ne lit pas les adresses des groupes', !groups.text.includes('example.com'), groups.text.slice(0, 200));
  const first = (await rows(run, MODELS)).find(row => row.Nom === PRIVATE_A);
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
