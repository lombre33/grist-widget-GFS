// Renommer, déplacer, fondre et supprimer un dossier de « Moi » partagé SANS perdre ses partages (contrats 11.7, point 13.n.g ; choix du porteur, 18/11 : « l'id de ligne de Grist »), dans un VRAI Grist
// (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier pour ce que la personne fait, et par l'API REST de Grist pour ce qu'une personne MALVEILLANTE ferait sans passer par GFS
// (le verrou est dans Grist, pas dans l'écran). Trois comptes un à la fois (GRIST_EMAIL ; l'état passe par /tmp/renommer-dossier-etat.json), quatre passages :
//   PHASE=proprietaire  active le partage ; « Contrats » (trois fichiers, un sous-dossier) partagé par la fenêtre : la ligne porte `dossier:moi:<adresse>//<numéro>` (celui de sa ligne d'état) ;
//                       F2 le renomme, Ctrl+X / Ctrl+V le déplace : le partage ne change pas et l'éditeur lit toujours les fichiers ; un partage posé à l'ancienne mode (le chemin) est converti au premier
//                       renommage ; un dossier déplacé sur un dossier qui existe déjà s'y fond (ses partages partent, ceux du dossier d'arrivée restent, la phrase le dit) ; un dossier supprimé
//                       emporte ses partages (le numéro redonné par Grist n'ouvre rien) ; un dossier montré par un lien ne se supprime pas ;
//   PHASE=editeur       editor@ : renomme son propre dossier partagé à l'ancienne mode (la conversion passe par lui : Grist le tient pour administrateur de ses partages), puis attaque par l'API : ranger au nom
//                       du propriétaire, refaire ou retirer ses partages, réécrire GFS_Ids, se donner un numéro de ligne d'état au même chemin ;
//   PHASE=lecteur       viewer@ : lit ce que les partages convertis lui donnent, rien de plus ;
//   PHASE=apres         le propriétaire relit : les lignes truquées sont invalides ; un partage qui vise le numéro d'une ligne d'état d'un autre n'ouvre rien.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   bash vrai-serveur.sh && PHASE=proprietaire node run-renommer-dossier.mjs ; GRIST_EMAIL=editor@example.com bash vrai-serveur.sh && PHASE=editeur node run-renommer-dossier.mjs ; ...
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, goTo, contrastProblems } from './lab-pdf.mjs';
import { gfsFrame, fits, shareWithEditorAndViewer } from './lab-droits.mjs';
import { apply, rowsOf as rows } from './lab-rest.mjs';
import { FILES, SHARES, FILING, has, fileRow, personal, idTarget, addFile, filing, openFolderShare, closeShare, folderRow, pickWho, stateRows, folderId, sharesOn, activateSharing, watchToasts }
  from './lab-dossier-moi.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.RENOMMER_DOSSIER_ETAT || '/tmp/renommer-dossier-etat.json';
const { t } = createI18n(lang);
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const PLACE = 'GFS_Placement';
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const refused = answer => answer.status >= 400 || /error|refus|denied|forbidden|not allowed|blocked/i.test(answer.text || '');
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const readers = async (run, name) => (await fileRow(run, name))?.GFS_Readers;
const dossierOf = async (run, name) => (await fileRow(run, name))?.GFS_Folder;

// Les gestes de la personne : F2 puis le nouveau nom, Ctrl+X puis Ctrl+V dans un dossier, Suppr.
async function renameFolder(run, frame, from, to) {
  await folderRow(frame, from).click();
  await run.page.keyboard.press('F2');
  await frame.locator('#nw-title').waitFor();
  await run.page.keyboard.type(to);
  await run.page.keyboard.press('Enter');
  await folderRow(frame, to).waitFor({ timeout: 20000 });
}
async function moveFolder(run, frame, toasts, name, into) {
  await folderRow(frame, name).click();
  await run.page.keyboard.press('Control+x');
  await folderRow(frame, into).dblclick();
  await run.page.keyboard.press('Control+v');
  const sentence = t('clip.moved', { name, folder: into });
  for (let i = 0; i < 100 && !(await toasts()).includes(sentence); i++) await run.page.waitForTimeout(200);
  await goHome(frame);
}
async function deleteFolder(run, frame, name) {
  await folderRow(frame, name).click();
  await run.page.keyboard.press('Delete');
  await run.page.waitForTimeout(1500);
}
const reopen = async run => { await run.page.reload(); const frame = await gfsFrame(run.page); await frame.locator('.ls-row').first().waitFor(); return frame; };

async function playOwner(run) {
  const { page } = run;
  say('--- 1. activer le partage, ranger des fichiers ---');
  let frame = await activateSharing(run, 'Facture.pdf');
  const columns = (await run.rest.columns(FILES)).map(column => column.id);
  check('la colonne d\'aide GFS_Ids (les numéros des lignes d\'état du dossier de chaque fichier) est dans la table des fichiers', columns.includes('GFS_Ids'), columns);
  const facture = await fileRow(run, 'Facture.pdf');
  const devis = await fileRow(run, 'Devis.pdf');
  let answer = await apply(run, [['UpdateRecord', FILES, facture.id, { GFS_Author: OWNER }], ['UpdateRecord', FILES, devis.id, { GFS_Author: OWNER }]]);
  check('un propriétaire écrit l\'auteur des deux fichiers importés avant l\'activation', answer.status === 200, answer.text);
  const named = {};
  for (const [name, id] of [['Contrat.pdf', 'lab-contrat'], ['Archive.pdf', 'lab-archive'], ['Ancien.pdf', 'lab-ancien'], ['F1.pdf', 'lab-f1'], ['F2.pdf', 'lab-f2'], ['Fb1.pdf', 'lab-fb1'], ['Fb2.pdf', 'lab-fb2'],
    ['Reprise.pdf', 'lab-reprise']]) named[name] = await addFile(run, name, id, OWNER);
  const place = (file, folder) => filing(OWNER, file, folder);
  answer = await apply(run, [place(facture, 'Contrats'), place(devis, 'Contrats/Sous'), place(named['Contrat.pdf'], 'Contrats'), place(named['Archive.pdf'], 'Archives'),
    place(named['Ancien.pdf'], 'Vieux'), place(named['F1.pdf'], 'Fus'), place(named['F2.pdf'], 'Dest/Fus'), place(named['Fb1.pdf'], 'Fb'), place(named['Fb2.pdf'], 'Dest/Fb')]);
  check('le propriétaire range ses fichiers (son rangement est à lui)', answer.status === 200, answer.text);
  let toasts;
  const fresh = async () => { frame = await reopen(run); toasts = await watchToasts(frame); };
  await fresh();

  say('--- 2. « Contrats » partagé par la fenêtre : la ligne porte le numéro de la ligne d\'état ---');
  await openFolderShare(frame, 'Contrats');
  await pickWho(frame, EDITOR);
  check('la fenêtre « Partager… » du dossier tient à 700 × 400, contraste de 4,5:1', await fits(frame, '.mod.sh'), await contrastProblems(frame, '.mod.sh'));
  await closeShare(frame);
  const contratsId = await folderId(run, OWNER, 'Contrats');
  check('le dossier a une ligne d\'état à lui dans le rangement (son numéro est celui que le partage porte)', contratsId !== null, await stateRows(run, OWNER));
  let shares = await sharesOn(run, idTarget(OWNER, contratsId));
  check('la ligne de partage vise `dossier:moi:<adresse>//<numéro>`, valide, pour l\'éditeur', shares.length === 1 && shares[0].Person === EDITOR && shares[0].Valid === true, await rows(run, SHARES));
  check('aucune ligne de partage ne porte encore le chemin « Contrats »', (await sharesOn(run, personal(OWNER, 'Contrats'))).length === 0);
  check('l\'éditeur lit les fichiers du dossier et du sous-dossier', has(await readers(run, 'Facture.pdf'), EDITOR) && has(await readers(run, 'Devis.pdf'), EDITOR) && has(await readers(run, 'Contrat.pdf'), EDITOR));
  const shareRowId = shares[0].id;

  say('--- 3. F2 : « Contrats » devient « Marchés », le partage reste ---');
  await renameFolder(run, frame, 'Contrats', 'Marchés');
  check('la ligne d\'état garde son numéro et change de chemin sur place', (await stateRows(run, OWNER)).some(row => row.id === contratsId && row.Folder === 'Marchés')
    && !(await stateRows(run, OWNER)).some(row => row.Folder === 'Contrats'), await stateRows(run, OWNER));
  shares = await sharesOn(run, idTarget(OWNER, contratsId));
  check('la ligne de partage n\'a pas changé (même ligne, même cible, valide)', shares.length === 1 && shares[0].id === shareRowId && shares[0].Valid === true, shares);
  check('les fichiers sont dans « Marchés » et « Marchés/Sous », lus de l\'éditeur comme avant', await dossierOf(run, 'Facture.pdf') === 'Marchés' && await dossierOf(run, 'Devis.pdf') === 'Marchés/Sous'
    && has(await readers(run, 'Facture.pdf'), EDITOR) && has(await readers(run, 'Devis.pdf'), EDITOR), [await dossierOf(run, 'Facture.pdf'), await readers(run, 'Devis.pdf')]);
  await openFolderShare(frame, 'Marchés');
  check('la fenêtre « Partager… » de « Marchés » montre toujours l\'éditeur', (await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: EDITOR }).count()) === 1);
  await closeShare(frame);

  say('--- 4. Ctrl+X puis Ctrl+V : « Marchés » va dans « Archives », le partage reste ---');
  await moveFolder(run, frame, toasts, 'Marchés', 'Archives');
  check('la ligne d\'état garde son numéro : « Archives/Marchés »', (await stateRows(run, OWNER)).some(row => row.id === contratsId && row.Folder === 'Archives/Marchés'), await stateRows(run, OWNER));
  check('le partage est le même et l\'éditeur lit encore tout (le sous-dossier suit)', (await sharesOn(run, idTarget(OWNER, contratsId))).length === 1 && await dossierOf(run, 'Devis.pdf') === 'Archives/Marchés/Sous'
    && has(await readers(run, 'Facture.pdf'), EDITOR) && has(await readers(run, 'Devis.pdf'), EDITOR), await dossierOf(run, 'Devis.pdf'));
  check('« Archive.pdf », resté dans « Archives », n\'est pas lu de l\'éditeur (le dossier parent n\'est pas partagé)', !has(await readers(run, 'Archive.pdf'), EDITOR));

  say('--- 5. un partage posé à l\'ancienne mode (le chemin) est converti au premier renommage ---');
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(OWNER, 'Vieux'), Person: VIEWER, Right: 'lecture' }]]);
  check('le propriétaire pose le partage à l\'ancienne mode (API)', answer.status === 200, answer.text);
  check('la formule de Grist lit encore ce partage : le lecteur lit « Ancien.pdf »', has(await readers(run, 'Ancien.pdf'), VIEWER), await readers(run, 'Ancien.pdf'));
  check('« Vieux » n\'a pas de ligne d\'état', await folderId(run, OWNER, 'Vieux') === null);
  await fresh();
  await renameFolder(run, frame, 'Vieux', 'Neuf');
  const neufId = await folderId(run, OWNER, 'Neuf');
  check('« Neuf » a sa ligne d\'état', neufId !== null, await stateRows(run, OWNER));
  check('le partage passe au numéro dans le même lot : plus aucune ligne au chemin, une seule au numéro', (await sharesOn(run, personal(OWNER, 'Vieux'))).length === 0
    && (await sharesOn(run, idTarget(OWNER, neufId))).length === 1, await rows(run, SHARES));
  check('le lecteur lit toujours « Ancien.pdf »', has(await readers(run, 'Ancien.pdf'), VIEWER), await readers(run, 'Ancien.pdf'));

  say('--- 6. un dossier déplacé sur un dossier qui existe déjà s\'y fond : le dossier d\'arrivée garde ses partages ---');
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(OWNER, 'Dest/Fus'), Person: EDITOR, Right: 'lecture' }]]);
  check('« Dest/Fus » est partagé à l\'éditeur, à l\'ancienne mode', answer.status === 200, answer.text);
  await fresh();
  await openFolderShare(frame, 'Fus');
  await pickWho(frame, VIEWER);
  await closeShare(frame);
  const fusId = await folderId(run, OWNER, 'Fus');
  check('« Fus » (à la racine) est partagé au lecteur, par numéro ; il lit F1.pdf, l\'éditeur non', (await sharesOn(run, idTarget(OWNER, fusId))).length === 1 && has(await readers(run, 'F1.pdf'), VIEWER)
    && !has(await readers(run, 'F1.pdf'), EDITOR));
  const seen = await toasts();
  await moveFolder(run, frame, toasts, 'Fus', 'Dest');
  const said = (await toasts()).slice(seen.length);
  check('« Fus » est dans « Dest/Fus » avec F2.pdf : un seul dossier', await dossierOf(run, 'F1.pdf') === 'Dest/Fus' && await dossierOf(run, 'F2.pdf') === 'Dest/Fus');
  check('la ligne d\'état de « Fus » est retirée, son partage aussi', await folderId(run, OWNER, 'Fus') === null && (await sharesOn(run, idTarget(OWNER, fusId))).length === 0, await stateRows(run, OWNER));
  check('le dossier d\'arrivée garde son partage : l\'éditeur lit F1.pdf et F2.pdf ; le lecteur ne lit plus F1.pdf', has(await readers(run, 'F1.pdf'), EDITOR) && has(await readers(run, 'F2.pdf'), EDITOR)
    && !has(await readers(run, 'F1.pdf'), VIEWER), [await readers(run, 'F1.pdf'), await readers(run, 'F2.pdf')]);
  check('la phrase dit que le dossier existait déjà et qu\'un partage est retiré', said.includes(t('ex.folderMerged', { name: 'Fus', n: 1 })), said);
  say('(deux : un dossier à l\'ancienne mode qui se fond dans un dossier qui existe)');
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(OWNER, 'Fb'), Person: VIEWER, Right: 'lecture' }]]);
  check('« Fb » est partagé au lecteur, à l\'ancienne mode', answer.status === 200 && has(await readers(run, 'Fb1.pdf'), VIEWER), answer.text);
  await fresh();
  await moveFolder(run, frame, toasts, 'Fb', 'Dest');
  check('« Fb » est fondu dans « Dest/Fb » : plus aucun partage au chemin « Fb », le lecteur ne lit ni Fb1.pdf ni Fb2.pdf',
    (await sharesOn(run, personal(OWNER, 'Fb'))).length === 0 && !has(await readers(run, 'Fb1.pdf'), VIEWER) && !has(await readers(run, 'Fb2.pdf'), VIEWER), await rows(run, SHARES));

  say('--- 7. un dossier montré par un lien se renomme (le lien suit) et ne se supprime pas ---');
  answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: '', File: '', Folder: 'Lie', Favorite: false }]]);
  const lieId = (await stateRows(run, OWNER)).find(row => row.Folder === 'Lie')?.id;
  answer = await apply(run, [['AddRecord', PLACE, null, { Space: 'ventes', Folder: '', Link: idTarget(OWNER, lieId), Shares: '' }]]);
  check('le propriétaire pose un lien sur « Lie » (par son numéro)', answer.status === 200, answer.text);
  await fresh();
  await deleteFolder(run, frame, 'Lie');
  check('Suppr : le dossier reste (la phrase demande de retirer le lien d\'abord), sa ligne et le lien aussi', (await toasts()).includes(t('ex.folderLinked')) && await folderId(run, OWNER, 'Lie') === lieId
    && ((await rows(run, PLACE)) || []).some(row => row.Link === idTarget(OWNER, lieId)), await toasts());
  await renameFolder(run, frame, 'Lie', 'Lie2');
  check('F2 : le dossier change de nom, le lien reste (il porte le numéro)', await folderId(run, OWNER, 'Lie2') === lieId && ((await rows(run, PLACE)) || []).some(row => row.Link === idTarget(OWNER, lieId)),
    await rows(run, PLACE));

  say('--- 8. un dossier supprimé emporte ses partages ; le numéro que Grist redonne n\'ouvre rien ---');
  answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: '', File: '', Folder: 'Temp', Favorite: false }]]);
  await fresh();
  await openFolderShare(frame, 'Temp');
  await pickWho(frame, VIEWER);
  await closeShare(frame);
  const tempId = await folderId(run, OWNER, 'Temp');
  check('« Temp » (un dossier gardé sans fichier) est partagé au lecteur, par numéro', (await sharesOn(run, idTarget(OWNER, tempId))).length === 1, await rows(run, SHARES));
  await deleteFolder(run, frame, 'Temp');
  check('Suppr : la ligne d\'état et le partage partent dans le même lot, la phrase compte le partage', await folderId(run, OWNER, 'Temp') === null && (await sharesOn(run, idTarget(OWNER, tempId))).length === 0
    && (await toasts()).includes(t('ex.folderDeletedShared', { name: 'Temp', n: 1 })), await toasts());
  answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: '', File: '', Folder: 'Reprise', Favorite: false }]]);
  const repriseId = await folderId(run, OWNER, 'Reprise');
  say(`(le dossier « Reprise » reçoit le numéro ${repriseId} ; « Temp » avait le ${tempId} : ${repriseId === tempId ? 'Grist l\'a redonné, comme mesuré' : 'pas redonné cette fois'})`);
  answer = await apply(run, [filing(OWNER, named['Reprise.pdf'], 'Reprise')]);
  check('« Reprise.pdf » est rangé dans « Reprise » : le lecteur ne le lit pas', answer.status === 200 && !has(await readers(run, 'Reprise.pdf'), VIEWER), await readers(run, 'Reprise.pdf'));
  say('--- 9. ce que GFS ne peut pas garder : la personne supprime elle-même la ligne d\'état dans Grist, sans passer par GFS (mesure, pas verdict) ---');
  await fresh();
  await openFolderShare(frame, 'Reprise');
  await pickWho(frame, VIEWER);
  await closeShare(frame);
  const handId = await folderId(run, OWNER, 'Reprise');
  answer = await apply(run, [['RemoveRecord', FILING, handId]]);
  const orphan = await sharesOn(run, idTarget(OWNER, handId));
  say(`(la ligne ${handId} supprimée à la main : ${answer.status === 200 ? 'acceptée' : 'refusée'} ; le partage reste, orphelin : ${orphan.length} ligne ; « Reprise.pdf » n'est plus lu du lecteur : ${!has(await readers(run, 'Reprise.pdf'), VIEWER)})`);
  const lastFile = await addFile(run, 'Suite.pdf', 'lab-suite', OWNER);
  answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: '', File: '', Folder: 'Suite', Favorite: false }], filing(OWNER, lastFile, 'Suite')]);
  const suiteId = await folderId(run, OWNER, 'Suite');
  say(`(le dossier « Suite » reçoit le numéro ${suiteId} ; le partage orphelin visait le ${handId} : le lecteur ${has(await readers(run, 'Suite.pdf'), VIEWER) ? 'LIT' : 'ne lit pas'} « Suite.pdf » — reste à dire à la personne)`);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId, contratsId, shareRowId, neufId, handId }));
}

async function playEditor(run) {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  let { frame } = run;
  say('--- éditeur : son propre dossier partagé à l\'ancienne mode, renommé par lui ---');
  const mine = await addFile(run, 'Fichier editeur.pdf', 'lab-editeur', EDITOR);
  let answer = await apply(run, [filing(EDITOR, mine, 'Mien')]);
  check('il range son fichier dans « Mien » (son rangement est à lui)', answer.status === 200, answer.text);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: personal(EDITOR, 'Mien'), Person: VIEWER, Right: 'lecture' }]]);
  const legacy = (await sharesOn(run, personal(EDITOR, 'Mien')))[0];
  check('il partage « Mien » au lecteur à l\'ancienne mode : ligne valide sans être propriétaire du document', answer.status === 200 && legacy && legacy.Valid === true, answer.text);
  frame = await reopen(run);
  await renameFolder(run, frame, 'Mien', 'Mien2');
  const mienId = await folderId(run, EDITOR, 'Mien2');
  check('il a sa ligne d\'état (le rangement de chacun est à lui)', mienId !== null, await stateRows(run, EDITOR));
  const converted = await sharesOn(run, idTarget(EDITOR, mienId));
  check('la conversion passe par lui : la ligne est au numéro, valide, plus aucune au chemin (Grist le tient pour administrateur du partage de son dossier)',
    converted.length === 1 && converted[0].Valid === true && (await sharesOn(run, personal(EDITOR, 'Mien'))).length === 0, await rows(run, SHARES));
  check('le lecteur lit toujours son fichier', has(await readers(run, 'Fichier editeur.pdf'), VIEWER), await readers(run, 'Fichier editeur.pdf'));
  check('la console de GFS reste muette', unexpected(run).length === 0, unexpected(run));

  say('--- éditeur : ce qu\'il ne peut pas faire par l\'API de Grist, sans GFS ---');
  answer = await apply(run, [['AddRecord', FILING, null, { User: OWNER, App: '', File: '', Folder: 'Pirate', Favorite: false }]]);
  check('il ne peut PAS écrire une ligne d\'état au nom du propriétaire', refused(answer) && !(await stateRows(run, OWNER)).some(row => row.Folder === 'Pirate'), answer.text);
  answer = await apply(run, [['UpdateRecord', SHARES, state.shareRowId, { Target: idTarget(OWNER, 999) }]]);
  const ownerShare = (await sharesOn(run, idTarget(OWNER, state.contratsId)))[0];
  check('il ne peut PAS changer la cible du partage du dossier du propriétaire (refusé, la ligne reste telle quelle)', refused(answer) && ownerShare && ownerShare.id === state.shareRowId, [answer.text, ownerShare]);
  answer = await apply(run, [['RemoveRecord', SHARES, state.shareRowId]]);
  check('il ne peut PAS retirer le partage du dossier du propriétaire (refusé, la ligne est toujours là)', refused(answer) && (await sharesOn(run, idTarget(OWNER, state.contratsId))).length === 1, answer.text);
  answer = await apply(run, [['ModifyColumn', FILES, 'GFS_Ids', { formula: '[[1, 0]]' }]]);
  check('il ne peut PAS réécrire la formule de GFS_Ids (structure fermée)', refused(answer), answer.text);
  answer = await apply(run, [['RemoveColumn', FILES, 'GFS_Ids']]);
  check('il ne peut PAS retirer la colonne GFS_Ids', refused(answer), answer.text);
  answer = await apply(run, [['AddRecord', SHARES, null, { Target: idTarget(OWNER, state.contratsId), Person: EDITOR, Right: 'admin' }]]);
  const forgedAdmin = ((await rows(run, SHARES)) || []).filter(row => String(row.Auteur).toLowerCase() === EDITOR && row.Target === idTarget(OWNER, state.contratsId));
  check('un faux partage « admin » au dossier du propriétaire (par son numéro) est refusé ou invalide', refused(answer) || forgedAdmin.every(row => row.Valid === false), [answer.status, forgedAdmin]);
  answer = await apply(run, [['AddRecord', FILING, null, { User: EDITOR, App: '', File: '', Folder: 'Archives/Marchés', Favorite: false }]]);
  const forgedId = await folderId(run, EDITOR, 'Archives/Marchés');
  check('il peut se donner une ligne d\'état à son nom, au même chemin que le dossier du propriétaire (son rangement est à lui) : elle a son numéro à elle', answer.status === 200 && forgedId !== null
    && forgedId !== state.contratsId, [answer.text, forgedId, state.contratsId]);
  const seen = ((await rows(run, FILES)) || []).map(row => row.Nom);
  check('il lit les fichiers du dossier partagé « Marchés » (Facture, Devis, Contrat), toujours', ['Facture.pdf', 'Devis.pdf', 'Contrat.pdf'].every(name => seen.includes(name)), seen);
  check('il ne lit pas « Archive.pdf » : sa ligne d\'état au chemin « Archives/Marchés » ne lui ouvre rien de plus', !seen.includes('Archive.pdf') && !seen.includes('Reprise.pdf'), seen);
  writeFileSync(STATE, JSON.stringify({ ...state, forgedId, mienId }));
}

async function playViewer(run) {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  say('--- lecteur ---');
  const seen = ((await rows(run, FILES)) || []).map(row => row.Nom);
  check('il lit « Ancien.pdf » (le partage à l\'ancienne mode, converti) et « Fichier editeur.pdf » (converti par l\'éditeur)', ['Ancien.pdf', 'Fichier editeur.pdf'].every(name => seen.includes(name)), seen);
  check('il ne lit ni « F1.pdf » ni « F2.pdf » ni « Fb1.pdf » ni « Fb2.pdf » (partages retirés par la fusion), ni « Reprise.pdf » (numéro redonné)', !['F1.pdf', 'F2.pdf', 'Fb1.pdf', 'Fb2.pdf', 'Reprise.pdf'].some(name => seen.includes(name)), seen);
  // « Facture.pdf » et « Devis.pdf » sont lisibles de tous par leur partage d'import (« @tous » en lecture, une catégorie) : ils ne disent rien du dossier ; « Contrat.pdf » est le fichier du dossier que rien d'autre n'ouvre.
  check('il ne lit ni « Contrat.pdf » (dans « Marchés », partagé à l\'éditeur seul) ni « Archive.pdf »', !['Contrat.pdf', 'Archive.pdf'].some(name => seen.includes(name)), seen);
  check('la console de GFS reste muette', unexpected(run).length === 0, unexpected(run));
  void state;
}

async function playAfter(run) {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  say('--- le propriétaire relit ---');
  const shares = (await rows(run, SHARES)) || [];
  const forged = shares.filter(row => String(row.Auteur).toLowerCase() === EDITOR && row.Target === idTarget(OWNER, state.contratsId));
  check('le faux partage de l\'éditeur est invalide s\'il est là', forged.every(row => row.Valid === false), forged);
  check('le vrai partage de « Marchés » est intact', (await sharesOn(run, idTarget(OWNER, state.contratsId))).some(row => row.id === state.shareRowId && row.Person === EDITOR && row.Valid === true));
  const answer = await apply(run, [['AddRecord', SHARES, null, { Target: idTarget(OWNER, state.forgedId), Person: VIEWER, Right: 'lecture' }]]);
  check('le propriétaire pose (par erreur ou par ruse) un partage qui vise le numéro de la ligne d\'état de l\'éditeur', answer.status === 200, answer.text);
  const archive = await fileRow(run, 'Archive.pdf');
  const facture = await fileRow(run, 'Facture.pdf');
  check('ce partage n\'ouvre rien : la ligne d\'état de l\'éditeur ne compte pas pour les fichiers du propriétaire (« Facture.pdf » n\'est pas lu du lecteur)',
    !has(facture.GFS_Readers, VIEWER) && !has(archive.GFS_Readers, VIEWER), [facture.GFS_Readers, archive.GFS_Readers]);
  const counted = (facture.GFS_Ids || []).slice(1).map(pair => pair[1]);
  check('GFS_Ids de « Facture.pdf » ne compte que les lignes d\'état du propriétaire (le numéro de « Marchés », pas celui de la ligne de l\'éditeur au même chemin)',
    counted.includes(state.contratsId) && !counted.includes(state.forgedId), facture.GFS_Ids);
  const mine = (await stateRows(run, EDITOR)).map(row => row.Folder);
  check('le propriétaire lit le rangement de chacun : les lignes d\'état de l\'éditeur y sont', mine.includes('Mien2') && mine.includes('Archives/Marchés'), mine);
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
