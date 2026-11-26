// Un dossier de « Moi » partagé dans ce document, et « Administrer » donné à un groupe (choix du porteur, 13/11 : « le dossier et ses futurs fichiers » ; « personnes et groupes, sans catégories »), dans un VRAI Grist
// (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris pour ce que la personne fait, et par l'API REST de Grist pour ce qu'une personne MALVEILLANTE ferait sans passer par GFS (le verrou est dans Grist, pas dans
// l'écran). Trois comptes un à la fois (GRIST_EMAIL ; l'état passe par /tmp/partager-moi-etat.json), quatre passages :
//   PHASE=proprietaire  active le partage (la question dit que le rangement de chacun est protégé : six règles « GFS : Partagé » sur GFS_Filing) ; rangement du propriétaire dans « Contrats » ; « Partager… » sur le dossier :
//                       une personne en lecture (la ligne vise `dossier:moi:<adresse>/Contrats`), les fichiers du dossier et du sous-dossier la lisent, un fichier rangé PLUS TARD aussi, un fichier sorti du dossier non ;
//                       un groupe « Administrer » un fichier (le menu n'est pas grisé), une catégorie non (grisé, dit pourquoi) ;
//   PHASE=editeur       editor@ : « Partagés avec moi » montre les fichiers du dossier ; ne peut PAS écrire le rangement d'une autre personne ni le lire ; un faux partage sur le dossier d'un autre est sans effet ; son propre dossier se
//                       partage ; membre d'un groupe administrateur, il partage le fichier (ligne valide, la fenêtre l'autorise) ; pas membre, ou par une catégorie : ligne invalide, la fenêtre refuse ;
//   PHASE=lecteur       viewer@ : lit ce qui lui est partagé (le dossier du propriétaire, celui de l'éditeur), jamais le fichier privé que l'éditeur a voulu y glisser ;
//   PHASE=apres         le propriétaire relit : les lignes truquées sont invalides ; le fichier d'un autre rangé dans son dossier n'hérite pas de ses droits.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   bash vrai-serveur.sh && PHASE=proprietaire node run-partager-moi.mjs ; GRIST_EMAIL=editor@example.com bash vrai-serveur.sh && PHASE=editeur node run-partager-moi.mjs ; ...
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu, rowOf, goTo, names, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';
import { call, apply, rowsOf as rows, closingRules } from './lab-rest.mjs';
import { FILES, SHARES, FILING, has, fileRow, keyOf, personal, idTarget, folderId, addFile, filing, openShareFor, closeShare, folderRow, openFolderShare, pickWho, waitReload } from './lab-dossier-moi.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_MOI_ETAT || '/tmp/partager-moi-etat.json';
const { t } = createI18n(lang);
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FOLDER = 'Contrats';
const shot = (frame, name) => pdfShot(frame, `partager-moi-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));

async function pickLevel(frame, who, level) {
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: who }).locator('button.lvl').click();
  const item = frame.getByRole('menuitemradio', { name: new RegExp(t(`share.right.${level}`)) }).first();
  const greyed = (await item.getAttribute('aria-disabled')) === 'true';
  await item.click({ force: true });
  return greyed;
}

async function playOwner(run) {
  const { page } = run;
  let { frame } = run;
  say('--- 1. activer le partage : la question dit ce que le rangement devient ---');
  await openShareFor(frame, 'Facture.pdf');
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asking = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit que le rangement de chacun n\'est plus lisible ni modifiable par une autre personne', asking.includes(t('rights.ask.sharing.filing').slice(0, 60)), asking);
  check('la question dit que la structure se ferme : seuls les propriétaires changent tables, colonnes et pages, les éditeurs gardent leurs lignes', asking.includes(t('rights.ask.sharing.structure').slice(0, 90)) && !asking.includes(t('rights.ask.sharing.item2')), asking);
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  await closeShare(frame);
  const rules = (await rows(run, '_grist_ACLRules')) || [];
  check('six règles « GFS : Partagé » sont posées sur GFS_Filing (le rangement de chacun est à lui seul)', rules.filter(rule => /^GFS : Partagé/.test(rule.memo || '')).length === 6, rules.map(rule => rule.memo));
  check('l\'activation a fermé la structure, par UNE règle « GFS : Structure fermée » (sans « Gérer les partages… »)', (await closingRules(run)).length === 1 && rules.filter(rule => /^GFS : Structure fermée/.test(rule.memo || '')).length === 1, rules.map(rule => rule.memo));
  const columns = (await run.rest.columns(FILES)).map(column => column.id);
  check('la colonne d\'aide GFS_Folder est dans la table des fichiers', columns.includes('GFS_Folder'), columns);

  say('--- 2. des fichiers du propriétaire, rangés dans « Contrats » et son sous-dossier ---');
  const facture = await fileRow(run, 'Facture.pdf');
  const devis = await fileRow(run, 'Devis.pdf');
  // Les PDF importés avant que GFS connaisse l'adresse de la personne (la sonde n'a pas encore couru) n'ont pas d'auteur : `Auteur` est vide, `GFS_Author` le reprend à l'activation.
  const legacy = !has(facture.GFS_Author, OWNER);
  say(`(Facture.pdf importé avant l'activation : GFS_Author = ${JSON.stringify(facture.GFS_Author)})`);
  const contrat = await addFile(run, 'Contrat.pdf', 'lab-contrat', OWNER);
  const prive = await addFile(run, 'Prive.pdf', 'lab-prive', OWNER);
  const admin = await addFile(run, 'Admin.pdf', 'lab-admin', OWNER);
  const cat = await addFile(run, 'Cat.pdf', 'lab-cat', OWNER);
  const autre = await addFile(run, 'Autre.pdf', 'lab-autre', OWNER);
  let answer = await apply(run, [filing(OWNER, facture, FOLDER), filing(OWNER, devis, `${FOLDER}/Sous`), filing(OWNER, contrat, FOLDER)]);
  check('le propriétaire range trois fichiers (son rangement est à lui)', answer.status === 200, answer.text);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row.folder').first().waitFor();
  check('« Contrats » est un dossier de « Moi » dans la liste', (await folderRow(frame, FOLDER).count()) === 1);
  check('sans partage de dossier, personne d\'autre ne lit les fichiers du dossier', !has((await fileRow(run, 'Facture.pdf')).GFS_Readers, EDITOR));

  say('--- 3. « Partager… » sur le dossier : une personne en lecture ---');
  const greyed = await openFolderShare(frame, FOLDER);
  check('l\'article « Partager… » d\'un dossier de « Moi » est libre', !greyed);
  check('la fenêtre s\'ouvre sur « Dans ce document », titre et sous-titre disent le dossier de « Moi »',
    (await frame.locator('[data-fk="share-tab-here"]').getAttribute('aria-selected')) === 'true' && (await frame.locator('.mod.sh .mod-head').innerText()).includes(t('share.folder.inMine', { name: t('ex.me') })));
  check('la personne est dans la liste comme propriétaire du dossier', (await frame.locator('.mod.sh [data-fixed="author"]').innerText()).includes(t('share.row.folderOwner', { who: OWNER }).split(' · ')[1]));
  await pickWho(frame, EDITOR);
  check('la fenêtre tient à 700 × 400, contraste de 4,5:1', await fits(frame, '.mod.sh'), await contrastProblems(frame, '.mod.sh'));
  await shot(frame, '1-dossier');
  // Depuis le 18/11 (contrats 11.7, point 13.n.g) la cible porte le numéro de la ligne d'état du dossier, pas son chemin (run-renommer-dossier.mjs).
  const contractsId = await folderId(run, OWNER, FOLDER);
  const folderShare = ((await rows(run, SHARES)) || []).find(row => row.Target === idTarget(OWNER, contractsId));
  check('la ligne de partage vise `dossier:moi:<adresse>//<numéro de la ligne d\'état de Contrats>`, valide', folderShare && folderShare.Person === EDITOR && folderShare.Right === 'lecture'
    && folderShare.Valid === true, folderShare);
  if (legacy) {
    const bare = [await fileRow(run, 'Facture.pdf'), await fileRow(run, 'Devis.pdf')];
    check('sans auteur connu, un fichier ne reçoit rien d\'un dossier de « Moi » (verrou fermé par défaut : le rangement seul ne prouve pas à qui est le fichier)',
      bare.every(row => !has(row.GFS_Readers, EDITOR)), bare.map(row => row.GFS_Readers));
    answer = await apply(run, [['UpdateRecord', FILES, facture.id, { GFS_Author: OWNER }], ['UpdateRecord', FILES, devis.id, { GFS_Author: OWNER }]]);
    check('un propriétaire écrit l\'auteur de ces deux fichiers (seuls les propriétaires changent GFS_Author)', answer.status === 200, answer.text);
  }
  const f1 = await fileRow(run, 'Facture.pdf');
  const d1 = await fileRow(run, 'Devis.pdf');
  check('les fichiers du dossier et du sous-dossier sont lus de l\'éditeur (GFS_Readers)', has(f1.GFS_Readers, EDITOR) && has(d1.GFS_Readers, EDITOR), [f1.GFS_Readers, d1.GFS_Readers]);
  check('le fichier du propriétaire resté hors du dossier ne l\'est pas', !has((await fileRow(run, 'Prive.pdf')).GFS_Readers, EDITOR));
  check('« Partagés avec moi » : l\'éditeur est dans GFS_Direct avec le propriétaire pour auteur du partage', has(f1.GFS_Direct, `${EDITOR}>${OWNER}`), f1.GFS_Direct);
  await closeShare(frame);

  say('--- 4. un fichier rangé plus tard dans le dossier est partagé aussi ; un fichier qui en sort ne l\'est plus ---');
  const nouveau = await addFile(run, 'Nouveau.pdf', 'lab-nouveau', OWNER);
  check('avant d\'être rangé, « Nouveau.pdf » n\'est pas lu de l\'éditeur', !has(nouveau.GFS_Readers, EDITOR));
  answer = await apply(run, [filing(OWNER, nouveau, FOLDER)]);
  check('il est rangé dans « Contrats »', answer.status === 200, answer.text);
  check('aussitôt, l\'éditeur le lit (aucune page n\'a eu à s\'ouvrir : c\'est une formule de Grist)', has((await fileRow(run, 'Nouveau.pdf')).GFS_Readers, EDITOR));
  const mine = ((await rows(run, FILING)) || []).find(row => row.File === contrat.Identifiant);
  answer = await apply(run, [['UpdateRecord', FILING, mine.id, { Folder: '' }]]);
  check('« Contrat.pdf » sort du dossier', answer.status === 200, answer.text);
  check('l\'éditeur ne le lit plus', !has((await fileRow(run, 'Contrat.pdf')).GFS_Readers, EDITOR));

  say('--- 5. un autre sous le même toit : le viewer lit le dossier aussi (pour l\'essai de l\'éditeur) ---');
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(OWNER, FOLDER), Person: VIEWER, Right: 'lecture' }]]);
  check('le propriétaire donne le dossier au lecteur (ligne écrite par l\'API)', answer.status === 200, answer.text);

  say('--- 6. « Administrer » : un groupe oui, une catégorie non ---');
  answer = await apply(run, [['AddRecord', 'GFS_Groups', null, { Name: 'Equipe', People: EDITOR }], ['AddRecord', 'GFS_Groups', null, { Name: 'Autres', People: VIEWER }]]);
  check('deux groupes : Equipe (l\'éditeur) et Autres (le lecteur)', answer.status === 200, answer.text);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, 'Admin.pdf');
  await pickWho(frame, '#Equipe', 'Equipe');
  const groupGreyed = await pickLevel(frame, 'Equipe', 'admin');
  check('le menu des droits n\'est pas grisé pour « Administration » d\'un groupe', !groupGreyed);
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: 'Equipe' }).locator('button.lvl', { hasText: t('share.right.admin') }).waitFor({ timeout: 15000 });
  const adminRow = ((await rows(run, SHARES)) || []).find(row => row.Target === keyOf(admin) && row.Person === '#Equipe');
  check('la ligne « #Equipe » est « admin » et valide', adminRow && adminRow.Right === 'admin' && adminRow.Valid === true, adminRow);
  const adminFile = await fileRow(run, 'Admin.pdf');
  check('GFS_Admins du fichier contient l\'éditeur (groupe développé) et GFS_AdminsCible aussi', has(adminFile.GFS_Admins, EDITOR) && has(adminRow.AdminsTarget, EDITOR), [adminFile.GFS_Admins, adminRow && adminRow.AdminsTarget]);
  await shot(frame, '2-groupe-admin');
  await closeShare(frame);
  await openShareFor(frame, 'Cat.pdf');
  await pickWho(frame, '@editeurs', t('share.cat.editeurs'));
  const catGreyed = await pickLevel(frame, t('share.cat.editeurs'), 'admin');
  check('« Administration » est grisée pour une catégorie, et la phrase dit « une personne ou un groupe »', catGreyed && (await frame.locator('.mod.sh .mod-note').innerText()).includes(t('share.right.admin.person')));
  await closeShare(frame);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: keyOf(cat), Person: '@editeurs', Right: 'admin' }]]);
  check('même si on écrit la ligne « catégorie admin » à la main (propriétaire, API), elle ne vaut qu\'en écriture', answer.status === 200, answer.text);
  const catFile = await fileRow(run, 'Cat.pdf');
  check('GFS_Admins du fichier n\'a pas l\'éditeur ; GFS_CatsWrite dit « editeurs » (écriture, pas administration)', !has(catFile.GFS_Admins, EDITOR) && has(catFile.GFS_CatsWrite, 'editeurs'), [catFile.GFS_Admins, catFile.GFS_CatsWrite]);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: keyOf(autre), Person: '#Autres', Right: 'admin' }]]);
  check('« Autres » (le lecteur, pas l\'éditeur) administre Autre.pdf', answer.status === 200, answer.text);

  say('--- 7. la structure est déjà fermée par l\'activation : le bouton de « Gérer les partages… » propose de la rouvrir ---');
  await openShareFor(frame, 'Admin.pdf');
  await frame.locator('[data-fk="share-manage"]').click();
  await frame.locator('.mod.mg .rt-content').waitFor();
  await frame.locator('[data-fk="manage-tab-options"]').click();
  const reopen = (await frame.locator('[data-fk="manage-structure"]').innerText()).trim();
  check('la structure est fermée : le bouton propose de la rouvrir', reopen === t('rights.act.open'), reopen);
  await frame.locator('.mod.mg [data-fk="manage-close"]').click();
  await frame.locator('.mod.mg').waitFor({ state: 'detached' });
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId, prive: prive.Identifiant, admin: admin.Identifiant, cat: cat.Identifiant, autre: autre.Identifiant, facture: facture.Identifiant }));
}

async function playEditor(run) {
  const { page } = run;
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  let { frame } = run;
  say('--- éditeur : ce qu\'il voit ---');
  const seen = ((await rows(run, FILES)) || []).map(row => row.Nom);
  check('il lit les fichiers du dossier partagé (Facture, Devis, Nouveau) et celui du groupe administrateur', ['Facture.pdf', 'Devis.pdf', 'Nouveau.pdf', 'Admin.pdf'].every(name => seen.includes(name)), seen);
  check('il ne lit ni « Prive.pdf » ni « Contrat.pdf » (sorti du dossier) ni « Autre.pdf »', !['Prive.pdf', 'Contrat.pdf', 'Autre.pdf'].some(name => seen.includes(name)), seen);
  await goTo(frame, new RegExp(t('rx.view')));
  await page.waitForTimeout(800);
  const shared = await names(frame);
  check('« Partagés avec moi » montre les fichiers donnés par le dossier du propriétaire', ['Facture.pdf', 'Devis.pdf', 'Nouveau.pdf'].every(name => shared.includes(name)), shared);
  await shot(frame, '3-partages-avec-moi');
  await goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));

  say('--- éditeur : ce qu\'il ne peut pas écrire (l\'API de Grist, sans GFS) ---');
  const others = await rows(run, FILING);
  check('il ne lit pas le rangement du propriétaire (seulement le sien et la liste des apps)', (others || []).every(row => ['@document', EDITOR].includes(String(row.User).toLowerCase())), (others || []).map(row => row.User));
  let answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: 'gfs-fichiers', File: state.prive, Folder: FOLDER, Favorite: false }]]);
  check('il ne peut PAS ranger le fichier privé du propriétaire dans le dossier partagé (ligne de rangement au nom d\'un autre : refusée)', answer.status !== 200, answer.text);
  answer = await apply(run, [['AddRecord', FILING, null, { User: EDITOR, App: 'gfs-fichiers', File: state.prive, Folder: FOLDER, Favorite: false }]]);
  say(`(ranger ce fichier à son propre nom : réponse ${answer.status} ; ce qui compte, c'est que le dossier d'un fichier est celui de son AUTEUR, vérifié plus bas)`);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(OWNER, FOLDER), Person: EDITOR, Right: 'admin' }]]);
  say(`(ligne de partage « admin » au dossier du propriétaire, écrite par l'éditeur : réponse ${answer.status} ; elle doit être invalide, vérifié plus bas)`);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: `gfs-fichiers:${state.prive}`, Person: EDITOR, Right: 'lecture' }]]);
  say(`(ligne de partage du fichier privé, écrite par l'éditeur : réponse ${answer.status} ; elle doit être invalide, vérifié plus bas)`);
  const admin = await fileRow(run, 'Admin.pdf');
  answer = await apply(run, [['UpdateRecord', FILES, admin.id, { GFS_Author: EDITOR }]]);
  check('il ne peut PAS se faire auteur d\'un fichier (GFS_Author : seuls les propriétaires l\'écrivent)', answer.status !== 200 && !has((await fileRow(run, 'Admin.pdf')).GFS_Author, EDITOR), answer.text);
  answer = await apply(run, [['ModifyColumn', FILES, 'GFS_Folder', { formula: '$GFS_Author' }]]);
  check('il ne peut PAS changer la formule de GFS_Folder (structure fermée : réservée aux propriétaires)', answer.status !== 200, answer.text);
  answer = await apply(run, [['RemoveColumn', FILES, 'GFS_Folder']]);
  check('il ne peut PAS retirer la colonne GFS_Folder', answer.status !== 200, answer.text);
  answer = await apply(run, [['ModifyColumn', FILES, 'GFS_Readers', { formula: '["L", "editor@example.com"]' }]]);
  check('il ne peut PAS réécrire la formule de GFS_Readers pour se donner la lecture', answer.status !== 200, answer.text);
  answer = await apply(run, [['RemoveTable', SHARES]]);
  check('il ne peut PAS supprimer la table des partages', answer.status !== 200, answer.text);
  answer = await apply(run, [['BulkRemoveRecord', '_grist_ACLRules', Array.from({ length: 40 }, (_, index) => index + 1)]]);
  check('il ne peut PAS retirer les règles d\'accès (aucune des quarante premières)', answer.status !== 200, answer.text);
  answer = await apply(run, [['UpdateRecord', SHARES, 1, { Auteur: EDITOR, AuthorAccess: 'owners' }]]);
  check('il ne peut PAS écrire l\'auteur ni l\'accès d\'une ligne de partage (écrits par Grist à la création)', answer.status !== 200, answer.text);
  say(`(refus de Grist, tel quel : ${answer.text.slice(0, 160)})`);
  answer = await apply(run, [['AddTable', 'Pirate', [{ id: 'A', type: 'Text' }]]]);
  check('il ne peut PAS créer une table (la structure est fermée : le prix dit à la question)', answer.status !== 200 && !(await call(run.page, 'GET', `/api/docs/${run.docId}/tables`)).text.includes('"Pirate"'), answer.text);
  answer = await apply(run, [['AddColumn', FILES, 'Ruse', { type: 'Text' }]]);
  check('il ne peut PAS ajouter une colonne aux fichiers', answer.status !== 200, answer.text);
  const columnsNow = (await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${FILES}/columns`)).json.columns || [];
  const lecteurs = columnsNow.find(column => column.id === 'GFS_Readers');
  check('après ces essais, GFS_Folder existe encore et la formule de GFS_Readers est celle de GFS (relue)', columnsNow.some(column => column.id === 'GFS_Folder') && lecteurs && !String(lecteurs.fields.formula).includes(EDITOR) && !columnsNow.some(column => column.id === 'Ruse'), lecteurs && lecteurs.fields.formula);
  check('et la table des partages est toujours là', (await rows(run, SHARES)) !== null);
  const afterForge = ((await rows(run, FILES)) || []).map(row => row.Nom);
  check('« Prive.pdf » reste illisible pour l\'éditeur après ces essais', !afterForge.includes('Prive.pdf'), afterForge);
  const forged = ((await rows(run, SHARES)) || []).filter(row => String(row.Auteur).toLowerCase() === EDITOR && [personal(OWNER, FOLDER), `gfs-fichiers:${state.prive}`].includes(row.Target));
  check('ses lignes truquées, s\'il les relit, sont marquées invalides', forged.every(row => row.Valid === false), forged);

  say('--- éditeur : son propre dossier se partage ---');
  const mineFile = await addFile(run, 'Fichier editeur.pdf', 'lab-editeur', EDITOR);
  answer = await apply(run, [filing(EDITOR, mineFile, 'Mien')]);
  check('il range son fichier dans « Mien » (son rangement est à lui)', answer.status === 200, answer.text);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(EDITOR, 'Mien'), Person: VIEWER, Right: 'lecture' }]]);
  check('il donne son dossier au lecteur : ligne acceptée', answer.status === 200, answer.text);
  const own = ((await rows(run, SHARES)) || []).find(row => row.Target === personal(EDITOR, 'Mien'));
  check('la ligne est valide, sans être propriétaire', own && own.Valid === true, own);
  check('son fichier est lu du lecteur', has((await fileRow(run, 'Fichier editeur.pdf')).GFS_Readers, VIEWER));

  say('--- éditeur : administrer par un groupe (membre), pas par une catégorie ni par un groupe dont il n\'est pas ---');
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: `gfs-fichiers:${state.admin}`, Person: VIEWER, Right: 'lecture' }]]);
  check('membre du groupe « Equipe » qui administre Admin.pdf, il y ajoute une personne : ligne acceptée', answer.status === 200, answer.text);
  const viaGroup = ((await rows(run, SHARES)) || []).find(row => row.Target === `gfs-fichiers:${state.admin}` && row.Person === VIEWER);
  check('la ligne est VALIDE (Grist a calculé qu\'il administre par son groupe)', viaGroup && viaGroup.Valid === true, viaGroup);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: `gfs-fichiers:${state.cat}`, Person: VIEWER, Right: 'lecture' }]]);
  const viaCat = ((await rows(run, SHARES)) || []).find(row => row.Target === `gfs-fichiers:${state.cat}` && row.Person === VIEWER);
  check('par la catégorie « éditeurs » (écriture seulement), la même ligne est INVALIDE', answer.status !== 200 || (viaCat && viaCat.Valid === false), [answer.status, viaCat]);

  say('--- éditeur : la fenêtre « Partager » ---');
  await frame.locator('.ls-row').first().waitFor();
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  await openShareFor(frame, 'Admin.pdf');
  check('membre d\'un groupe administrateur : la fenêtre lui laisse ajouter une personne', (await frame.locator('[data-fk="share-add"]').count()) === 1 && (await frame.locator('[data-fk="share-readonly"]').count()) === 0);
  await shot(frame, '4-editeur-groupe');
  await closeShare(frame);
  await openShareFor(frame, 'Cat.pdf');
  check('par une catégorie seulement : la fenêtre dit que seuls l\'auteur, les administrateurs et les propriétaires changent les partages', (await frame.locator('[data-fk="share-readonly"]').count()) === 1 && (await frame.locator('[data-fk="share-add"]').count()) === 0);
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  say('--- lecteur ---');
  const seen = ((await rows(run, FILES)) || []).map(row => row.Nom);
  check('il lit les fichiers du dossier du propriétaire, celui de l\'éditeur et l\'ajout de l\'éditeur à Admin.pdf', ['Facture.pdf', 'Devis.pdf', 'Fichier editeur.pdf', 'Admin.pdf'].every(name => seen.includes(name)), seen);
  check('il ne lit PAS « Prive.pdf » : ni la ligne de rangement truquée, ni le faux partage de l\'éditeur n\'ont rien ouvert', !seen.includes('Prive.pdf'), seen);
  check('« Autre.pdf » : le lecteur est dans le groupe administrateur, il lit', seen.includes('Autre.pdf'), seen);
  check('« Cat.pdf » ne lui est pas partagé (la ligne de l\'éditeur est invalide)', !seen.includes('Cat.pdf'), seen);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  void state;
}

async function playAfter(run) {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  say('--- le propriétaire relit ---');
  const shares = (await rows(run, SHARES)) || [];
  const forged = shares.filter(row => String(row.Auteur).toLowerCase() === EDITOR && [personal(OWNER, FOLDER), `gfs-fichiers:${state.prive}`, `gfs-fichiers:${state.cat}`].includes(row.Target));
  check('les trois lignes truquées de l\'éditeur sont là et INVALIDES', forged.length >= 2 && forged.every(row => row.Valid === false), forged);
  const prive = ((await rows(run, FILES)) || []).find(row => row.Identifiant === state.prive);
  check('« Prive.pdf » n\'est lu que de son auteur : ni l\'éditeur ni le lecteur', !has(prive.GFS_Readers, EDITOR) && !has(prive.GFS_Readers, VIEWER), prive.GFS_Readers);
  const rangement = (await rows(run, FILING)) || [];
  check('le propriétaire lit le rangement de chacun : l\'adresse de l\'éditeur y est (les suggestions de « Gérer les partages » la proposent)', rangement.some(row => String(row.User).toLowerCase() === EDITOR),
    rangement.map(row => row.User));
  check('aucune ligne de rangement truquée n\'est restée', !rangement.some(row => row.User === OWNER && row.File === state.prive), rangement.filter(row => row.File === state.prive));
  say('--- le fichier d\'un autre, rangé par le propriétaire dans son dossier partagé : il n\'en hérite pas ---');
  const theirs = ((await rows(run, FILES)) || []).find(row => row.Nom === 'Fichier editeur.pdf');
  const answer = await apply(run, [filing(OWNER, theirs, FOLDER)]);
  check('le propriétaire range le fichier de l\'éditeur dans « Contrats » (son rangement, il le peut)', answer.status === 200, answer.text);
  const after = ((await rows(run, FILES)) || []).find(row => row.Nom === 'Fichier editeur.pdf');
  check('le dossier du propriétaire ne donne rien sur un fichier dont il n\'est pas l\'auteur (le lecteur ne le lit que par le dossier de l\'éditeur)', has(after.GFS_Readers, VIEWER), after.GFS_Readers);
  const dossierCalc = ((await rows(run, FILES)) || []).find(row => row.Identifiant === theirs.Identifiant);
  check('GFS_Folder vaut le dossier de l\'AUTEUR (« Mien »), pas celui qu\'a choisi le propriétaire', dossierCalc.GFS_Folder === 'Mien', dossierCalc.GFS_Folder);
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
    await ({ editeur: playEditor, lecteur: playViewer, apres: playAfter }[phase])(run);
  }
} finally {
  await browser.close();
  pages.close();
}
