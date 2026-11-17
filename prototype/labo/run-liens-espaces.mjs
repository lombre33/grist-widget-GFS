// Les liens entre espaces (contrats 11.7, point 13.o ; choix du porteur, 13/11 : « un lien avec son droit ») dans un VRAI Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris pour ce que la
// personne fait, et par l'API REST de Grist pour ce qu'une personne MALVEILLANTE ferait sans passer par GFS (le verrou est dans Grist, pas dans l'écran). Trois comptes un à la fois (GRIST_EMAIL ;
// l'état passe par /tmp/liens-espaces-etat.json), six passages. Le décor : l'espace « achats » (le propriétaire), l'espace « ventes » (le groupe Ventes, dont editor@ est membre), le dossier Contrats
// d'achats (Plan, Notes ; le sous-dossier Sous : Sous.pdf), le dossier Interne (Interne.pdf), Memo.pdf à la racine d'achats ; viewer@ n'est dans aucun groupe.
//   PHASE=proprietaire  active le partage ; décor ; « Lier dans un espace… » sur le dossier Contrats (espace Ventes, nom « Contrats achats », lecture) puis sur Memo.pdf (écriture) ; ce que Grist en calcule
//                       (lecteurs, copies visibles `GFS_Vus`) ; l'espace Ventes montre le lien et ses fichiers ; ferme la structure (sans quoi un éditeur réécrit les formules) ;
//   PHASE=editeur       editor@ (lecture sur le dossier lié) : voit le lien et ses fichiers dans Ventes, pas à la racine de « Moi » ; n'écrit pas Plan.pdf, écrit Memo.pdf ; ne forge ni lien, ni partage, ne retire
//                       rien, ne change aucune colonne ; ne lit ni Interne.pdf ni l'espace Achats ;
//   PHASE=releve        le propriétaire donne l'écriture au groupe dans « Partager… » du dossier d'origine (le droit posé par le lien s'affine) ;
//   PHASE=ecriture      editor@ écrit maintenant Plan.pdf et Sous.pdf ; toujours ni Interne.pdf, ni administration ;
//   PHASE=lecteur       viewer@ (aucun groupe) : ne lit rien de ce qui est lié, ni les liens ;
//   PHASE=retrait       le propriétaire retire le lien du dossier (menu du lien) : sa ligne et le droit qu'il avait posé partent, les fichiers restent ; le lien de Memo.pdf reste.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu, names, folders, waitFor, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';
import { call, apply, rowsOf, patchRow } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.LIENS_ESPACES_ETAT || '/tmp/liens-espaces-etat.json';
const { t } = createI18n(lang);
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FILES = 'GFS_Fichiers', SHARES = 'GFS_Partages', PLACE = 'GFS_Placement';
const SOURCE = 'dossier:achats/Contrats';
const LINK = 'Contrats achats';
const shot = (frame, name) => pdfShot(frame, `liens-espaces-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const rows = (run, table) => rowsOf(run, table);
const has = (value, who) => JSON.stringify(value ?? null).toLowerCase().includes(who);
const fileRow = async (run, name) => ((await rows(run, FILES)) || []).find(row => row.Nom === name);
const keyOf = row => `gfs-fichiers:${row.Identifiant}`;
const fileNames = async run => ((await rows(run, FILES)) || []).map(row => row.Nom).sort();
const refused = answer => answer.status >= 400 || /error|refus|denied|forbidden|not allowed|blocked/i.test(answer.text || '');

// Un fichier de plus dans la table des fichiers (une ligne sans pièce jointe : la liste et le partage ne lisent que les lignes), à l'adresse de la session de la page : Grist écrit l'auteur.
async function addFile(run, name, id) {
  const answer = await call(run.page, 'POST', `/api/docs/${run.docId}/tables/${FILES}/records`, { records: [{ fields: { Identifiant: id, Nom: name, Type: 'application/pdf', Auteur: OWNER, Taille: 1000, Origine: 'import' } }] });
  check(`« ${name} » est ajouté (auteur écrit par Grist)`, answer.status === 200, answer.text);
  return fileRow(run, name);
}

// Une écriture à l'API : change le nom d'un fichier, relit la ligne et rétablit le nom ; { refused, changed, text }.
async function tryEdit(run, name, to) {
  const row = await fileRow(run, name);
  const answer = await patchRow(run, FILES, row.id, { Nom: to });
  const now = ((await rows(run, FILES)) || []).find(item => item.id === row.id);
  const changed = Boolean(now) && now.Nom === to;
  if (changed) await patchRow(run, FILES, row.id, { Nom: name });
  return { refused: refused(answer), changed, text: answer.text };
}

async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}
const folderRow = (frame, path) => frame.locator(`.ls-row.folder[data-key="dir:${path}"]`);
const toSpaces = frame => frame.locator('.tr-row[data-path="Espaces"]').click();
const toMe = frame => frame.locator('.tr-row[data-path=""]').click();
async function goInto(frame, ...paths) {
  await toSpaces(frame);
  for (const path of paths) { await folderRow(frame, path).waitFor({ timeout: 20000 }); await folderRow(frame, path).dblclick(); }
}
const menuItem = (frame, label) => frame.getByRole('menuitem', { name: new RegExp(`^${label}`) });
async function openFolderMenu(frame, path) {
  await folderRow(frame, path).waitFor({ timeout: 20000 });
  await folderRow(frame, path).click({ button: 'right' });
  await frame.locator('.menu').waitFor();
}
const toast = async frame => (await frame.locator('#toast').textContent()).replace(/\s+/g, ' ');

// L'assistant à la vraie souris : l'espace, puis (un dossier) son nom ou (un fichier) son dossier d'accueil, puis le droit.
async function linkThrough(frame, { space, name, folder, right }) {
  await frame.locator(`[data-fk="pick-${space}"]`).click();
  if (name !== undefined) { await frame.locator('[data-fk="name-input"]').fill(name); await frame.locator('[data-fk="name-ok"]').click(); }
  else await frame.locator(`[data-fk="pick-${folder}"]`).click();
  await frame.locator('.mod.pk').waitFor();
  const text = (await frame.locator('.mod.pk').innerText()).replace(/\s+/g, ' ');
  await frame.locator(`[data-fk="pick-${right}"]`).click();
  return text;
}

async function activate(run) {
  const { page } = run;
  let { frame } = run;
  await openRowMenu(frame, 'Facture.pdf');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  await frame.locator('[data-fk="share-close"]').click();
  await frame.locator('.mod.sh').waitFor({ state: 'detached' });
  return frame;
}

async function closeStructure(run, frame) {
  const { page } = run;
  await toMe(frame);
  await openRowMenu(frame, 'Facture.pdf');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  await frame.locator('[data-fk="share-manage"]').click();
  await frame.locator('.mod.mg .rt-content').waitFor();
  await frame.locator('[data-fk="manage-tab-options"]').click();
  await frame.locator('[data-fk="manage-structure"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.ls-row').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(1500);
  if (await frame.locator('.mod.mg').count()) { await frame.locator('.mod.mg [data-fk="manage-close"]').click(); await frame.locator('.mod.mg').waitFor({ state: 'detached' }); }
  return frame;
}

async function playOwner(run) {
  const { page } = run;
  say('--- 1. activer le partage : le placement porte les colonnes du lien, les fichiers GFS_Vus ---');
  let frame = await activate(run);
  const placeColumns = (await run.rest.columns(PLACE)).map(column => column.id);
  check('GFS_Placement porte Lien et Partages', ['Lien', 'Partages'].every(id => placeColumns.includes(id)), placeColumns);
  check('la table des fichiers porte GFS_Vus', (await run.rest.columns(FILES)).some(column => column.id === 'GFS_Vus'));

  say('--- 2. le décor : deux espaces, le groupe Ventes (editor@), des fichiers dans achats ---');
  const plan = await addFile(run, 'Plan.pdf', 201); const notes = await addFile(run, 'Notes.pdf', 202); const sous = await addFile(run, 'Sous.pdf', 203);
  const interne = await addFile(run, 'Interne.pdf', 204); const memo = await addFile(run, 'Memo.pdf', 205);
  await addFile(run, 'Libre.pdf', 206);
  const placed = (row, folder) => ['AddRecord', PLACE, null, { Cible: keyOf(row), Espace: 'achats', Dossier: folder }];
  const set = await apply(run, [['AddRecord', 'GFS_Groupes', null, { Nom: 'Ventes', PersonnesIci: EDITOR }], ['AddRecord', 'GFS_Espaces', null, { Cle: 'achats', Nom: 'Achats' }],
    ['AddRecord', 'GFS_Espaces', null, { Cle: 'ventes', Nom: 'Ventes' }],
    ['AddRecord', SHARES, null, { Cible: 'espace:achats', Personne: OWNER, Droit: 'ecriture' }], ['AddRecord', SHARES, null, { Cible: 'espace:ventes', Personne: '#Ventes', Droit: 'lecture' }],
    placed(plan, 'Contrats'), placed(notes, 'Contrats'), placed(sous, 'Contrats/Sous'), placed(interne, 'Interne'), placed(memo, '')]);
  check('le décor est écrit', set.status === 200, set.text);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor({ timeout: 40000 });

  say('--- 3. « Lier dans un espace… » sur le dossier Contrats d\'achats : Ventes, « Contrats achats », lecture ---');
  await goInto(frame, 'Espaces/Achats');
  await openFolderMenu(frame, 'Espaces/Achats/Contrats');
  const entry = menuItem(frame, t('slink.menu'));
  check('l\'article « Lier dans un espace… » du menu du dossier n\'est pas grisé', (await entry.count()) === 1 && (await entry.getAttribute('aria-disabled')) !== 'true');
  await entry.click();
  await frame.locator('.mod.pk').waitFor();
  check('la liste propose les deux espaces, avec recherche', (await frame.locator('.mod.pk .wk-item').count()) === 2 && (await fits(frame, '.mod.pk')));
  await shot(frame, '1-espace');
  const asked = await linkThrough(frame, { space: 'ventes', name: LINK, right: 'lecture' });
  check('la fenêtre du droit nomme le groupe de l\'espace et le dossier lié', asked.includes('Ventes') && asked.includes('Contrats'), asked);
  await frame.locator('.mod.pk').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1500);
  check('la phrase dit ce que les groupes ont', (await toast(frame)).includes(t('slink.right.lecture.short')), await toast(frame));
  const link = ((await rows(run, PLACE)) || []).find(row => row.Lien === SOURCE);
  check('le lien est une ligne de placement sans Cible, dans Ventes, avec les groupes qu\'il a ajoutés', link && link.Cible === '' && link.Espace === 'ventes' && link.Dossier === LINK && link.Partages === '#Ventes', link);
  const given = ((await rows(run, SHARES)) || []).find(row => row.Cible === SOURCE && row.Personne === '#Ventes');
  check('le droit du groupe Ventes est une ligne de partage ordinaire sur le dossier d\'origine (valide, lecture)', given && given.Droit === 'lecture' && given.Valide === true, given);

  say('--- 4. ce que Grist en calcule : qui lit, où le fichier se montre ---');
  const read = async name => fileRow(run, name);
  const planRow = await read('Plan.pdf'); const sousRow = await read('Sous.pdf'); const interneRow = await read('Interne.pdf');
  check('l\'éditeur lit Plan, Notes et Sous (membre du groupe Ventes), pas Interne', has(planRow.GFS_Lecteurs, EDITOR) && has((await read('Notes.pdf')).GFS_Lecteurs, EDITOR) && has(sousRow.GFS_Lecteurs, EDITOR) &&
    !has(interneRow.GFS_Lecteurs, EDITOR), [planRow.GFS_Lecteurs, interneRow.GFS_Lecteurs]);
  check('personne ne reçoit l\'écriture par le lien en lecture', !has(planRow.GFS_Ecrivains, EDITOR), planRow.GFS_Ecrivains);
  check('GFS_Vus de Plan : « ventes/Contrats achats » ; de Sous : le chemin suit celui du lien ; d\'Interne : rien',
    has(planRow.GFS_Vus, `ventes/${LINK}"`.toLowerCase()) && has(sousRow.GFS_Vus, `ventes/${LINK}/Sous`.toLowerCase()) && !has(interneRow.GFS_Vus, 'ventes'), [planRow.GFS_Vus, sousRow.GFS_Vus, interneRow.GFS_Vus]);

  say('--- 5. « Lier dans un espace… » sur le fichier Memo.pdf : Ventes, à la racine, écriture ---');
  await goInto(frame, 'Espaces/Achats');
  await openRowMenu(frame, 'Memo.pdf');
  await menuItem(frame, t('slink.menu')).click();
  await frame.locator('.mod.pk').waitFor();
  await linkThrough(frame, { space: 'ventes', folder: '', right: 'ecriture' });
  await frame.locator('.mod.pk').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1500);
  const memoLink = ((await rows(run, PLACE)) || []).find(row => row.Lien === keyOf(memo));
  check('le lien d\'un fichier : une ligne à la racine de Ventes, le droit posé sur le fichier', memoLink && memoLink.Espace === 'ventes' && memoLink.Dossier === '' && memoLink.Partages === '#Ventes' &&
    ((await rows(run, SHARES)) || []).some(row => row.Cible === keyOf(memo) && row.Personne === '#Ventes' && row.Droit === 'ecriture'), memoLink);
  const memoRow = await read('Memo.pdf');
  check('l\'éditeur écrit Memo.pdf, et le fichier se montre à la racine de Ventes', has(memoRow.GFS_Ecrivains, EDITOR) && has(memoRow.GFS_Vus, 'ventes/'), [memoRow.GFS_Ecrivains, memoRow.GFS_Vus]);

  say('--- 6. l\'espace Ventes montre le lien, ses fichiers, le sous-dossier ; le menu du lien ne propose que de le retirer ---');
  await goInto(frame, 'Espaces/Ventes');
  await folderRow(frame, `Espaces/Ventes/${LINK}`).waitFor({ timeout: 20000 });
  check('Ventes montre le dossier « Contrats achats » et Memo.pdf', (await folders(frame)).includes(LINK) && (await names(frame)).includes('Memo.pdf'), [await folders(frame), await names(frame)]);
  await openFolderMenu(frame, `Espaces/Ventes/${LINK}`);
  const items = await frame.locator('.menu [role="menuitem"]').evaluateAll(nodes => nodes.map(node => [node.textContent.trim().replace(/\s+/g, ' '), node.getAttribute('aria-disabled') === 'true']));
  check('le menu du lien : renommer, déplacer et partager grisés, « Retirer le lien » proposé', items.some(([label, grey]) => label.startsWith(t('slink.remove')) && !grey) &&
    items.filter(([, grey]) => grey).length === 3, items);
  await shot(frame, '2-menu-du-lien');
  await page.keyboard.press('Escape');
  await folderRow(frame, `Espaces/Ventes/${LINK}`).dblclick();
  await waitFor(page, 'les fichiers du lien', async () => (await names(frame)).includes('Plan.pdf'));
  check('sous le lien : Plan et Notes, et le sous-dossier Sous', JSON.stringify((await names(frame)).sort()) === JSON.stringify(['Notes.pdf', 'Plan.pdf']) && (await folders(frame)).includes('Sous'), [await names(frame), await folders(frame)]);
  await shot(frame, '3-sous-le-lien');

  frame = await closeStructure(run, frame);
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId, plan: plan.Identifiant, sous: sous.Identifiant, interne: interne.Identifiant, memo: memo.Identifiant, shared: given.id, linkId: link.id }));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playEditor(run, writes) {
  const { page, frame } = run;
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  say(`--- éditeur (${writes ? 'écriture' : 'lecture'}) : ce qu'il voit par le lien ---`);
  const seen = await fileNames(run);
  check('il lit Plan, Notes, Sous et Memo par le lien, ni Interne ni Libre', ['Plan.pdf', 'Notes.pdf', 'Sous.pdf', 'Memo.pdf'].every(name => seen.includes(name)) && !seen.includes('Interne.pdf') && !seen.includes('Libre.pdf'), seen);
  const vus = (await rows(run, FILES)).find(row => row.Nom === 'Plan.pdf');
  check('Grist lui donne le chemin où le fichier se montre (GFS_Vus)', has(vus.GFS_Vus, `ventes/${LINK}`.toLowerCase()), vus.GFS_Vus);
  await toSpaces(frame);
  await folderRow(frame, 'Espaces/Ventes').waitFor({ timeout: 20000 });
  check('il voit l\'espace Ventes, pas l\'espace Achats (il n\'est pas dans ce groupe)', (await folderRow(frame, 'Espaces/Achats').count()) === 0);
  await folderRow(frame, 'Espaces/Ventes').dblclick();
  await folderRow(frame, `Espaces/Ventes/${LINK}`).waitFor({ timeout: 20000 });
  check('Ventes lui montre le lien et Memo.pdf', (await folders(frame)).includes(LINK) && (await names(frame)).includes('Memo.pdf'), [await folders(frame), await names(frame)]);
  await folderRow(frame, `Espaces/Ventes/${LINK}`).dblclick();
  await waitFor(page, 'les fichiers du lien', async () => (await names(frame)).includes('Plan.pdf'));
  check('sous le lien : Plan et Notes, et le sous-dossier Sous', JSON.stringify((await names(frame)).sort()) === JSON.stringify(['Notes.pdf', 'Plan.pdf']) && (await folders(frame)).includes('Sous'), [await names(frame), await folders(frame)]);
  await shot(frame, writes ? '5-editeur-ecriture' : '4-editeur-lecture');
  await toMe(frame);
  await page.waitForTimeout(600);
  check('à la racine de « Moi », ni Plan.pdf ni Notes.pdf : ils ne sont pas à lui, seul le lien les montre', !(await names(frame)).some(name => ['Plan.pdf', 'Notes.pdf', 'Sous.pdf'].includes(name)), await names(frame));

  say('--- éditeur : les attaques par l\'API de Grist, sans GFS ---');
  const plan = await tryEdit(run, 'Plan.pdf', 'Plan truqué.pdf');
  if (writes) {
    check('avec l\'écriture sur le dossier lié, il modifie Plan.pdf (la ligne a changé)', !plan.refused && plan.changed, plan.text);
    const under = await tryEdit(run, 'Sous.pdf', 'Sous truqué.pdf');
    check('et Sous.pdf, du sous-dossier du lien', !under.refused && under.changed, under.text);
  } else {
    check('en lecture sur le dossier lié, il ne modifie pas Plan.pdf (Grist refuse, la ligne n\'a pas changé)', plan.refused && !plan.changed, plan.text);
    const memo = await tryEdit(run, 'Memo.pdf', 'Memo truqué.pdf');
    check('il écrit Memo.pdf : le lien du fichier lui donne l\'écriture (la ligne a changé)', !memo.refused && memo.changed, memo.text);
  }
  const interne = await tryEdit(run, 'Notes.pdf', 'Notes truqué.pdf');
  check(writes ? 'Notes.pdf, du même dossier, se modifie aussi' : 'Notes.pdf, du dossier lié en lecture, ne se modifie pas', writes ? interne.changed : (interne.refused && !interne.changed), interne.text);
  const forged = await apply(run, [['AddRecord', PLACE, null, { Cible: '', Espace: 'ventes', Dossier: 'Volé', Lien: 'dossier:achats/Interne', Partages: '' }]]);
  check('il ne forge pas de lien (le placement n\'est écrit que par les propriétaires)', refused(forged), forged.text);
  const link = ((await rows(run, PLACE)) || []).find(row => row.Lien === SOURCE);
  check('il lit le lien de son espace', link && link.Espace === 'ventes', link);
  const removeLink = await apply(run, [['RemoveRecord', PLACE, state.linkId]]);
  check('il ne retire pas le lien', refused(removeLink), removeLink.text);
  const widen = await apply(run, [['UpdateRecord', SHARES, state.shared, { Droit: 'admin' }]]);
  check('il ne change pas le droit que le lien a posé (la ligne de partage, adressée par son numéro, n\'est pas à lui)', refused(widen), widen.text);
  const drop = await apply(run, [['RemoveRecord', SHARES, state.shared]]);
  check('il ne retire pas non plus cette ligne de partage', refused(drop), drop.text);
  await apply(run, [['AddRecord', SHARES, null, { Cible: keyOfIdentifier(state.interne), Personne: EDITOR, Droit: 'ecriture' }]]);
  const stillBlind = (await fileNames(run)).includes('Interne.pdf');
  check('un faux partage de sa main sur Interne.pdf ne lui donne pas le fichier', !stillBlind, await fileNames(run));
  const column = await apply(run, [['ModifyColumn', FILES, 'GFS_Vus', { formula: '["achats/Interne"]' }]]);
  check('il ne réécrit pas la formule des copies (structure fermée)', refused(column), column.text);
  const added = await apply(run, [['AddColumn', PLACE, 'Ruse', { type: 'Text' }]]);
  check('il n\'ajoute pas de colonne au placement', refused(added), added.text);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}
const keyOfIdentifier = id => `gfs-fichiers:${id}`;

async function playRaise(run) {
  const { page, frame } = run;
  say('--- le propriétaire affine le droit : « Partager… » sur le dossier d\'origine ---');
  await goInto(frame, 'Espaces/Achats');
  await openFolderMenu(frame, 'Espaces/Achats/Contrats');
  await menuItem(frame, t('share.menu')).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  const row = frame.locator('.mod.sh .rr[data-share]').filter({ hasText: 'Ventes' });
  check('la fenêtre du dossier d\'origine montre la ligne du groupe Ventes (lecture), posée par le lien', (await row.count()) === 1 && (await row.innerText()).includes(t('share.right.lecture')), await frame.locator('.mod.sh').innerText());
  await row.locator('button.lvl').click();
  await frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.ecriture')) }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const given = ((await rows(run, SHARES)) || []).find(item => item.Cible === SOURCE && item.Personne === '#Ventes');
  check('la ligne du groupe est maintenant en écriture, c\'est la même ligne que le lien a posée', given && given.Droit === 'ecriture', given);
  const forged = ((await rows(run, SHARES)) || []).filter(item => item.Auteur === EDITOR);
  check('ce que l\'éditeur a pu ajouter à son nom (un faux partage) ne vaut rien : aucune ligne valide de sa main', forged.every(item => item.Valide === false), forged.map(item => [item.Cible, item.Personne, item.Valide]));
  const plan = await fileRow(run, 'Plan.pdf');
  check('Grist calcule : l\'éditeur écrit Plan.pdf', has(plan.GFS_Ecrivains, EDITOR), plan.GFS_Ecrivains);
  await shot(frame, '6-releve');
  await frame.locator('[data-fk="share-close"]').click();
}

async function playViewer(run) {
  const { page, frame } = run;
  say('--- lecteur (aucun groupe) : rien de ce qui est lié ---');
  const seen = await fileNames(run);
  check('il ne lit aucun fichier d\'achats ni de Ventes', !seen.some(name => ['Plan.pdf', 'Notes.pdf', 'Sous.pdf', 'Interne.pdf', 'Memo.pdf'].includes(name)), seen);
  const links = await rows(run, PLACE);
  check('il ne lit pas les liens (le placement est caché à qui n\'est pas dans l\'espace)', !links || links.length === 0, links);
  const forged = await apply(run, [['AddRecord', PLACE, null, { Cible: '', Espace: 'ventes', Dossier: 'Volé', Lien: SOURCE }]]);
  check('il ne forge pas de lien', refused(forged), forged.text);
  const widen = await apply(run, [['UpdateRecord', SHARES, JSON.parse(readFileSync(STATE, 'utf8')).shared, { Droit: 'admin' }]]);
  check('il ne change pas le droit posé par le lien', refused(widen), widen.text);
  await page.waitForTimeout(800);
  check('l\'explorateur ne lui montre aucun espace (pas de racine « Espaces »)', (await frame.locator('.tr-row[data-path="Espaces"]').count()) === 0 && (await frame.locator('.ls-row').count()) > 0, await folders(frame));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playRemoval(run) {
  const { page, frame } = run;
  say('--- le propriétaire retire le lien du dossier ---');
  await goInto(frame, 'Espaces/Ventes');
  await openFolderMenu(frame, `Espaces/Ventes/${LINK}`);
  await menuItem(frame, t('slink.remove')).click();
  await frame.locator('.mod.ask').waitFor();
  const asking = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit que rien n\'est supprimé', asking.includes(t('slink.remove.message', { space: 'Ventes' }).slice(0, 50)), asking);
  await shot(frame, '7-retirer');
  await frame.locator('[data-fk="ask-yes"]').click();
  await page.waitForTimeout(2000);
  const place = (await rows(run, PLACE)) || [];
  check('la ligne du lien est partie ; le lien de Memo.pdf reste', !place.some(row => row.Lien === SOURCE) && place.some(row => row.Lien !== '' && row.Lien !== SOURCE), place.map(row => [row.Lien, row.Espace]));
  check('le droit que le lien avait posé est retiré, celui du lien de Memo.pdf reste', !((await rows(run, SHARES)) || []).some(row => row.Cible === SOURCE) && ((await rows(run, SHARES)) || []).some(row => row.Personne === '#Ventes' && row.Cible.startsWith('gfs-fichiers:')));
  const plan = await fileRow(run, 'Plan.pdf');
  check('les fichiers sont intacts, et l\'éditeur ne lit plus Plan.pdf (calculé par Grist)', plan && !has(plan.GFS_Lecteurs, EDITOR) && has(plan.GFS_Lecteurs, OWNER), plan && plan.GFS_Lecteurs);
  const memo = await fileRow(run, 'Memo.pdf');
  check('l\'éditeur garde Memo.pdf (le lien du fichier reste)', has(memo.GFS_Lecteurs, EDITOR), memo.GFS_Lecteurs);
  await page.waitForTimeout(500);
  check('l\'espace Ventes ne montre plus le dossier lié', (await folderRow(frame, `Espaces/Ventes/${LINK}`).count()) === 0, await folders(frame));
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
    await importSamples(run);
    await playOwner(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await ({ editeur: () => playEditor(run, false), releve: () => playRaise(run), ecriture: () => playEditor(run, true), lecteur: () => playViewer(run), retrait: () => playRemoval(run) }[phase])();
  }
} finally {
  await browser.close();
  pages.close();
}
