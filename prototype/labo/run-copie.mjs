// La copie depuis l'explorateur (décision du porteur, 04/11 : tout se fait depuis l'explorateur, pour toutes les apps ; « Dupliquer », Ctrl+C / Ctrl+X / Ctrl+V ; contrats 2.4 `copie`, 6.3, 6.6), jouée
// dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) avec les modèles de Publipostage+, des PDF de GFS et la vraie app, à 700 × 400, à la vraie souris et au vrai clavier. Ce que ni
// grist-static ni un faux Grist écrit par nous ne peuvent dire : ce que Grist fait d'une ligne ajoutée avec les valeurs d'une autre (colonne à formule, pièce jointe citée deux fois), la vraie touche
// Ctrl+C / Ctrl+X / Ctrl+V dans le cadre de Grist, et si la vraie app ouvre la copie. Chromium seulement (test/copier-firefox.mjs mesure l'interface dans un vrai Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-copie.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. « Dupliquer » sur un modèle : le menu le propose avec ses raccourcis ; la copie a les valeurs de l'original, sauf le nom (le premier libre) et le jeton (vide) ; la formule se recalcule ; l'original n'a pas bougé.
//   2. Dans un dossier, sur le modèle par défaut : la copie reste dans le dossier de l'original, n'est ni épinglée ni par défaut (une seule étoile).
//   3. Un modèle qui a une pièce jointe : la copie cite la même pièce (rien n'est envoyé : le nombre de pièces du document ne bouge pas).
//   4. Ctrl+C puis Ctrl+V : coller dans un autre dossier, deux fois (une copie se colle autant que la personne veut), le rangement de la copie est celui du dossier ouvert.
//   5. Ctrl+X puis Ctrl+V : un PDF et un dossier changent de dossier ; rien n'est dupliqué, les favoris restent, la table de l'app n'est pas touchée.
//   6. Un PDF : « Dupliquer » ne copie aucun octet (même pièce jointe, nouvel identifiant, la personne et le jour) ; l'original supprimé pour de bon, la copie se télécharge octet pour octet.
//   7. Les refus (rien à coller, ni dans Récents, un dossier ne se copie pas) ; la vraie Publipostage+ ouvre la copie ; la console de GFS reste muette.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, importSamples, sha256, waitForNames, waitForToast, shot, rowOf, goTo, openRowMenu, waitFor } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `copie-${lang}-${scheme}`;
const ME = 'essai@example.com';
const MODELS = 'Publipostage_Modeles';
const FILES = 'GFS_Fichiers';
const FILING = 'GFS_Rangement';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const sorted = list => [...list].sort();
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// La liste porte ces noms (dans n'importe quel ordre) ; sinon, le dit : la liste vue.
const sameNames = async (frame, expected) => {
  const found = await waitForNames(frame, expected);
  const ok = same(sorted(found), sorted(expected));
  if (!ok) say(`  (la liste montre : ${JSON.stringify(found)}, attendu : ${JSON.stringify(expected)})`);
  return ok;
};

// Une écriture directe dans le document (la page de Grist est de l'origine du serveur : la session de la personne d'essai suffit).
const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(), [run.docId, actions]);
const modelRows = run => run.rest.rows(MODELS);
const byName = (rows, name) => rows.find(row => row.Nom === name);
const withoutIdentity = row => { const { id, Nom, Jeton, Resume, ...data } = row; return data; }; // ce que la copie garde de l'original : tout, sauf son numéro, son nom, son jeton et sa formule
const pdfShape = row => { const { id, Identifiant, Nom, Date, Auteur, ...data } = row; return data; }; // ce que la copie d'un PDF garde de l'original : la pièce jointe, la taille, l'origine
const textOf = async locator => ((await locator.count()) ? locator.first().textContent() : null);
const selectedName = frame => textOf(frame.locator('.ls-row[aria-selected="true"] .nm .t'));
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
const enterFolder = async (frame, name) => { await goHome(frame); await folderRow(frame, name).dblclick(); };
// Le rangement de la personne pour un fichier d'une app : ses lignes de GFS_Rangement.
const filingOf = async (run, app, id) => (await run.rest.rows(FILING)).filter(row => row.App === app && String(row.Fichier) === String(id));
const duplicateItem = frame => frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.duplicate')}`) });
async function duplicate(run, name) {
  await openRowMenu(run.frame, name);
  await duplicateItem(run.frame).click();
}

// ----- 0. Les modèles de l'app : ceux du labo, avec un jeton, une colonne à formule et une pièce jointe, comme une app qui les aurait ; deux PDF ; un premier favori pour que GFS connaisse la personne.
async function prepare(run) {
  const { page, frame, docId } = run;
  say('--- 0. les PDF, les modèles de Publipostage+ ---');
  await importSamples(run);
  await seedFiles(frame);
  await apply(run, [['AddColumn', MODELS, 'Jeton', { type: 'Text' }], ['AddColumn', MODELS, 'Resume', { type: 'Text', isFormula: true, formula: '$Nom.upper()' }], ['AddColumn', MODELS, 'Pieces', { type: 'Attachments' }]]);
  const ids = Array.from({ length: 18 }, (_, i) => i + 1);
  await apply(run, [['BulkUpdateRecord', MODELS, ids, { Jeton: ids.map(id => `j${id}`) }], ['UpdateRecord', MODELS, 1, { EstParDefaut: true }]]);
  const attachment = await page.evaluate(async id => {
    const form = new FormData();
    form.append('upload', new Blob(['%PDF-1.4 essai'], { type: 'application/pdf' }), 'essai.pdf');
    // Grist demande cet en-tête à un envoi de fichier (sans lui : 401, contre les envois d'une autre page).
    return (await (await fetch(`/api/docs/${id}/attachments`, { method: 'POST', body: form, headers: { 'X-Requested-With': 'XMLHttpRequest' } })).json())[0];
  }, docId);
  await apply(run, [['UpdateRecord', MODELS, 17, { Pieces: ['L', attachment] }]]);
  // Le rangement de ces modèles est celui de la personne d'essai (le labo le sème « commun » : tant que GFS ne la connaît pas, c'est celui-là qui s'applique ; une fois connue, le sien).
  const prefs = (await run.rest.rows('Publipostage_PreferencesModeles')).filter(row => row.Utilisateur === '').map(row => row.id);
  await apply(run, [['BulkUpdateRecord', 'Publipostage_PreferencesModeles', prefs, { Utilisateur: prefs.map(() => ME) }]]);
  const rows = await modelRows(run);
  run.attachment = attachment;
  check('les modèles sont là : 19 lignes (dont les réglages), la formule calcule, la pièce jointe est citée', rows.length === 19 && byName(rows, 'Convocation de session').Resume === 'CONVOCATION DE SESSION' && same(byName(rows, 'Quittance de loyer').Pieces, ['L', attachment]), [rows.length, byName(rows, 'Quittance de loyer').Pieces]);
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await rowOf(frame, 'Support de session').hover();
  await rowOf(frame, 'Support de session').locator('.rb.pin').click();
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
  const lines = (await run.rest.rows(FILING)).filter(row => row.App === 'publipostage');
  check('un premier favori : GFS connaît la personne que Grist donne, les dossiers sont là et la racine a les trois modèles sans dossier et les deux PDF', lines.length === 1 && lines[0].Utilisateur === ME && await sameNames(frame, ['Contrat de prestation', 'Quittance de loyer', 'Support de session', 'Facture.pdf', 'Devis.pdf']), lines);
  run.before = await modelRows(run);
  run.prefsBefore = await run.rest.rows('Publipostage_PreferencesModeles');
}

// ----- 1. « Dupliquer » sur un modèle.
async function playDuplicate(run) {
  const { frame } = run;
  say('--- 1. « Dupliquer » sur un modèle ---');
  const original = byName(run.before, 'Contrat de prestation');
  await openRowMenu(frame, 'Contrat de prestation');
  const item = duplicateItem(frame);
  const label = await item.textContent();
  check('le menu de la ligne propose « Dupliquer » dégrisé, avec ses raccourcis (Ctrl+C puis V)', (await item.getAttribute('aria-disabled')) !== 'true' && /Ctrl\+C/.test(label), label);
  await item.click();
  const done = await said(frame, 'copy.done', { as: 'Contrat de prestation (1)' });
  const rows = await modelRows(run);
  const copy = byName(rows, 'Contrat de prestation (1)');
  check('la phrase dit le nom de la copie, la liste a les deux modèles, la copie prend le clavier', done === t('copy.done', { as: 'Contrat de prestation (1)' }) && await sameNames(frame, ['Contrat de prestation', 'Contrat de prestation (1)', 'Quittance de loyer', 'Support de session', 'Facture.pdf', 'Devis.pdf']) && await selectedName(frame) === 'Contrat de prestation (1)', [done, await selectedName(frame)]);
  check('la copie est une ligne de plus, à la suite : mêmes valeurs que l\'original (contenu, type, date, auteur), jeton vide, pas par défaut ; la formule s\'est recalculée', Boolean(copy) && rows.length === run.before.length + 1 && copy.id > Math.max(...run.before.map(row => row.id)) && same(withoutIdentity(copy), withoutIdentity(original)) && copy.Jeton === '' && copy.EstParDefaut === false && copy.Resume === 'CONTRAT DE PRESTATION (1)', copy);
  check('l\'original n\'a pas bougé (jeton compris)', same(byName(rows, 'Contrat de prestation'), original) && original.Jeton === 'j16', byName(rows, 'Contrat de prestation'));
  check('à la racine, rien n\'est rangé : aucune ligne de rangement pour la copie', (await filingOf(run, 'publipostage', copy.id)).length === 0);
  await duplicate(run, 'Contrat de prestation');
  const again = await said(frame, 'copy.done', { as: 'Contrat de prestation (2)' });
  check('une deuxième copie du même modèle prend le premier nom libre : « (2) », la première n\'est pas touchée', again === t('copy.done', { as: 'Contrat de prestation (2)' }) && Boolean(byName(await modelRows(run), 'Contrat de prestation (2)')) && same(byName(await modelRows(run), 'Contrat de prestation (1)'), copy), again);
  await shot(frame, `${TAG}-1-copie`);
  run.copy = copy;
}

// ----- 2. Dans un dossier, sur le modèle par défaut.
async function playInFolder(run) {
  const { frame } = run;
  say('--- 2. « Dupliquer » dans un dossier, sur le modèle par défaut ---');
  await enterFolder(frame, 'Formation');
  const before = await modelRows(run);
  const star = byName(before, 'Feuille d’émargement');
  check('au départ, une seule étoile, et le modèle est épinglé', star.EstParDefaut === true && before.filter(row => row.EstParDefaut).length === 1 && await rowOf(frame, 'Feuille d’émargement').locator('.rb.pin.on').count() === 1);
  await duplicate(run, 'Feuille d’émargement');
  const done = await said(frame, 'copy.doneIn', { as: 'Feuille d’émargement (1)', folder: 'Formation' });
  const rows = await modelRows(run);
  const copy = byName(rows, 'Feuille d’émargement (1)');
  const lines = copy ? await filingOf(run, 'publipostage', copy.id) : [];
  check('la phrase dit le dossier ; la copie est dans « Formation », à côté de l\'original, la copie prend le clavier', done === t('copy.doneIn', { as: 'Feuille d’émargement (1)', folder: 'Formation' }) && await rowOf(frame, 'Feuille d’émargement (1)').count() === 1 && await selectedName(frame) === 'Feuille d’émargement (1)', done);
  check('le rangement de la copie : une ligne pour la personne, dans « Formation », sans favori', lines.length === 1 && lines[0].Dossier === 'Formation' && lines[0].Utilisateur === ME && lines[0].Favori === false, lines);
  check('la copie n\'est pas par défaut : il n\'y a toujours qu\'une étoile, celle de l\'original, et la copie n\'est pas épinglée', rows.filter(row => row.EstParDefaut).length === 1 && byName(rows, 'Feuille d’émargement').EstParDefaut === true && copy.Jeton === '' && await rowOf(frame, 'Feuille d’émargement (1)').locator('.rb.pin.on').count() === 0 && await rowOf(frame, 'Feuille d’émargement').locator('.rb.pin.on').count() === 1);
}

// ----- 3. Un modèle qui a une pièce jointe.
async function playAttachments(run) {
  const { frame } = run;
  say('--- 3. une pièce jointe ---');
  await goHome(frame);
  const attachments = (await run.rest.attachments()).length;
  await duplicate(run, 'Quittance de loyer');
  const done = await said(frame, 'copy.done', { as: 'Quittance de loyer (1)' });
  const rows = await modelRows(run);
  const copy = byName(rows, 'Quittance de loyer (1)');
  check('la copie cite la même pièce jointe que l\'original', done === t('copy.done', { as: 'Quittance de loyer (1)' }) && Boolean(copy) && same(copy.Pieces, ['L', run.attachment]) && same(byName(rows, 'Quittance de loyer').Pieces, ['L', run.attachment]), [done, copy && copy.Pieces]);
  check('rien n\'est envoyé : le document garde le même nombre de pièces jointes', (await run.rest.attachments()).length === attachments, await run.rest.attachments());
}

// ----- 4. Ctrl+C puis Ctrl+V.
async function playCopyPaste(run) {
  const { page, frame } = run;
  say('--- 4. Ctrl+C puis Ctrl+V ---');
  await enterFolder(frame, 'Événementiel');
  const before = await modelRows(run);
  await rowOf(frame, 'Badge événement A6').click();
  await page.keyboard.press('Control+c');
  const copied = await said(frame, 'clip.copied', { name: 'Badge événement A6' });
  check('Ctrl+C : la phrase dit comment coller, rien n\'est écrit', copied === t('clip.copied', { name: 'Badge événement A6' }) && (await modelRows(run)).length === before.length, copied);
  await enterFolder(frame, 'Facturation');
  await page.keyboard.press('Control+v');
  const first = await said(frame, 'copy.doneIn', { as: 'Badge événement A6 (1)', folder: 'Facturation' });
  await page.keyboard.press('Control+v');
  const second = await said(frame, 'copy.doneIn', { as: 'Badge événement A6 (2)', folder: 'Facturation' });
  const rows = await modelRows(run);
  check('Ctrl+V colle dans le dossier ouvert, deux fois : « (1) » puis « (2) » (une copie se colle autant qu\'on veut)', first === t('copy.doneIn', { as: 'Badge événement A6 (1)', folder: 'Facturation' }) && second === t('copy.doneIn', { as: 'Badge événement A6 (2)', folder: 'Facturation' }) && rows.length === before.length + 2, [first, second]);
  check('la liste de « Facturation » les montre, la dernière copie prend le clavier ; l\'original est resté dans « Événementiel »', await sameNames(frame, ['Facture / devis multi-TVA', 'Badge événement A6 (1)', 'Badge événement A6 (2)']) && await selectedName(frame) === 'Badge événement A6 (2)' && (await filingOf(run, 'publipostage', byName(rows, 'Badge événement A6').id)).length === 0);
  const lines = await Promise.all(['Badge événement A6 (1)', 'Badge événement A6 (2)'].map(name => filingOf(run, 'publipostage', byName(rows, name).id)));
  check('le rangement de chaque copie : une ligne dans « Facturation », sans favori', lines.every(each => each.length === 1 && each[0].Dossier === 'Facturation' && each[0].Favori === false), lines);
  check('les copies ont les valeurs de l\'original', same(withoutIdentity(byName(rows, 'Badge événement A6 (2)')), withoutIdentity(byName(rows, 'Badge événement A6'))));
}

// ----- 5. Ctrl+X puis Ctrl+V : un PDF, un modèle épinglé, un dossier.
async function playCutPaste(run) {
  const { page, frame } = run;
  say('--- 5. Ctrl+X puis Ctrl+V ---');
  await goHome(frame);
  const pdfs = await run.rest.rows(FILES);
  const devis = pdfs.find(row => row.Nom === 'Devis.pdf');
  await rowOf(frame, 'Devis.pdf').click();
  await page.keyboard.press('Control+x');
  const cut = await said(frame, 'clip.cut', { name: 'Devis.pdf' });
  await folderRow(frame, 'Stock').dblclick();
  await page.keyboard.press('Control+v');
  const moved = await said(frame, 'clip.moved', { name: 'Devis.pdf', folder: 'Stock' });
  const lines = await filingOf(run, 'gfs-fichiers', devis.Identifiant);
  check('couper puis coller déplace le PDF : les phrases le disent, une ligne de rangement dans « Stock », aucun PDF de plus', cut === t('clip.cut', { name: 'Devis.pdf' }) && moved === t('clip.moved', { name: 'Devis.pdf', folder: 'Stock' }) && lines.length === 1 && lines[0].Dossier === 'Stock' && lines[0].Utilisateur === ME && (await run.rest.rows(FILES)).length === pdfs.length, [moved, lines]);
  check('le PDF est dans « Stock », prend le clavier, et n\'est plus à la racine', await rowOf(frame, 'Devis.pdf').count() === 1 && await selectedName(frame) === 'Devis.pdf');
  await page.keyboard.press('Control+v');
  check('rien n\'est resté à coller : la phrase le dit, rien n\'est écrit', await said(frame, 'clip.empty') === t('clip.empty') && (await filingOf(run, 'gfs-fichiers', devis.Identifiant)).length === 1);
  // Un modèle épinglé garde son favori quand il change de dossier.
  await goHome(frame);
  const support = byName(await modelRows(run), 'Support de session');
  await rowOf(frame, 'Support de session').click();
  await page.keyboard.press('Control+x');
  await said(frame, 'clip.cut', { name: 'Support de session' });
  await folderRow(frame, 'Stock').dblclick();
  await page.keyboard.press('Control+v');
  await said(frame, 'clip.moved', { name: 'Support de session', folder: 'Stock' });
  const pinned = await filingOf(run, 'publipostage', support.id);
  check('le modèle épinglé garde son favori dans « Stock » (une ligne : Favori et Dossier)', pinned.length === 1 && pinned[0].Favori === true && pinned[0].Dossier === 'Stock' && await rowOf(frame, 'Support de session').locator('.rb.pin.on').count() === 1, pinned);
  // Un dossier entier, avec ce qu'il contient (un sous-dossier de « Formation »).
  await enterFolder(frame, 'Formation');
  const old = byName(await modelRows(run), 'Ancien programme');
  await folderRow(frame, 'Archives 2025').click();
  await page.keyboard.press('Control+x');
  const cutFolder = await said(frame, 'clip.cut', { name: 'Archives 2025' });
  await goHome(frame);
  await folderRow(frame, 'Stock').dblclick();
  await page.keyboard.press('Control+v');
  const movedFolder = await said(frame, 'clip.moved', { name: 'Archives 2025', folder: 'Stock' });
  const inside = await filingOf(run, 'publipostage', old.id);
  check('couper un dossier puis le coller dans « Stock » : les phrases le disent, le dossier est là et prend le clavier', cutFolder === t('clip.cut', { name: 'Archives 2025' }) && movedFolder === t('clip.moved', { name: 'Archives 2025', folder: 'Stock' }) && await folderRow(frame, 'Archives 2025').count() === 1 && await selectedName(frame) === 'Archives 2025', [cutFolder, movedFolder]);
  check('ce qu\'il contient le suit : le modèle est rangé dans « Stock/Archives 2025 »', inside.length === 1 && inside[0].Dossier === 'Stock/Archives 2025', inside);
  await folderRow(frame, 'Archives 2025').dblclick();
  check('l\'ouvrir montre le modèle', await sameNames(frame, ['Ancien programme']));
  await enterFolder(frame, 'Formation');
  check('« Formation » n\'a plus le dossier (le rangement de l\'app n\'a pas bougé : GFS n\'y écrit pas)', await folderRow(frame, 'Archives 2025').count() === 0 && same(await run.rest.rows('Publipostage_PreferencesModeles'), run.prefsBefore));
}

// ----- 6. Un PDF : « Dupliquer » ne copie aucun octet.
async function playPdf(run) {
  const { page, frame } = run;
  say('--- 6. un PDF ---');
  await goHome(frame);
  const attachments = (await run.rest.attachments()).length;
  const original = (await run.rest.rows(FILES)).find(row => row.Nom === 'Facture.pdf');
  await duplicate(run, 'Facture.pdf');
  const done = await said(frame, 'copy.done', { as: 'Facture (1).pdf' });
  const rows = await run.rest.rows(FILES);
  const copy = rows.find(row => row.Nom === 'Facture (1).pdf');
  check('la phrase dit le nom de la copie ; la liste a les deux PDF ; la copie prend le clavier', done === t('copy.done', { as: 'Facture (1).pdf' }) && Boolean(await rowOf(frame, 'Facture (1).pdf').count()) && await selectedName(frame) === 'Facture (1).pdf', done);
  check('la copie a son propre identifiant et ce que le PDF est (type, pièce jointe, taille, origine)', Boolean(copy) && /^[0-9a-f]{12}$/.test(copy.Identifiant) && copy.Identifiant !== original.Identifiant && same(pdfShape(copy), pdfShape(original)), [copy, original]);
  check('elle est de la personne que Grist donne, d\'aujourd\'hui (l\'original, importé avant que GFS la connaisse, n\'a pas d\'auteur : la copie ne le reprend pas)', copy.Auteur === ME && original.Auteur === '' && Math.abs(copy.Date - Date.now() / 1000) < 120, [copy.Auteur, original.Auteur, copy.Date]);
  check('aucun octet de plus : le document a le même nombre de pièces jointes, les deux lignes citent la même', (await run.rest.attachments()).length === attachments && same(copy.Contenu, original.Contenu), [copy && copy.Contenu, original.Contenu]);
  // L'original part pour de bon : la copie reste lisible.
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Delete');
  await said(frame, 'trash.moved', { name: 'Facture.pdf' });
  await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
  await rowOf(frame, 'Facture.pdf').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await said(frame, 'trash.purged', { name: 'Facture.pdf' });
  const left = await run.rest.rows(FILES);
  check('l\'original supprimé pour de bon : sa ligne est partie, celle de la copie reste', !left.some(row => row.Nom === 'Facture.pdf') && left.some(row => row.Nom === 'Facture (1).pdf'));
  await goHome(frame);
  const stored = await run.rest.attachment(copy.Contenu[1]);
  check('la pièce jointe de la copie est toujours là, sans changement (même empreinte)', stored.status === 200 && stored.hash === run.facture.hash, stored);
  await openRowMenu(frame, 'Facture (1).pdf');
  const [download] = await Promise.all([page.waitForEvent('download'), frame.getByRole('menuitem', { name: new RegExp(`^${t('files.download')}`) }).click()]);
  const bytes = await readFile(await download.path());
  check('« Télécharger » rend la copie sous son nom, octet pour octet', download.suggestedFilename() === 'Facture (1).pdf' && sha256(bytes) === run.facture.hash, [download.suggestedFilename(), bytes.length]);
}

// ----- 7. Les refus, la vraie app, la console.
async function playRefusals(run) {
  const { page, frame } = run;
  say('--- 7. les refus ---');
  await goHome(frame);
  await page.keyboard.press('Control+v');
  check('Ctrl+V sans rien de copié : la phrase le dit', await said(frame, 'clip.empty') === t('clip.empty'));
  await folderRow(frame, 'Stock').click();
  await page.keyboard.press('Control+c');
  check('un dossier ne se copie pas : la phrase dit de le couper', await said(frame, 'clip.folderCopy') === t('clip.folderCopy'));
  await rowOf(frame, 'Contrat de prestation').click();
  await page.keyboard.press('Control+c');
  await said(frame, 'clip.copied', { name: 'Contrat de prestation' });
  await goTo(frame, new RegExp(`^\\s*${t('ex.recent')}`));
  await page.keyboard.press('Control+v');
  check('dans « Récents », la liste n\'est pas un dossier : la phrase le dit, rien n\'est copié', await said(frame, 'clip.noFolder') === t('clip.noFolder') && !byName(await modelRows(run), 'Contrat de prestation (3)'));
  await goHome(frame);
}

async function playRealApp(run) {
  const { page, frame } = run;
  say('--- 8. la vraie Publipostage+ ouvre la copie ---');
  const copy = byName(await modelRows(run), 'Contrat de prestation (1)');
  await rowOf(frame, 'Contrat de prestation (1)').dblclick();
  const appFrame = () => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
  const shown = () => appFrame().evaluate(() => ({ id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent }));
  const opened = await waitFor(page, 'Publipostage+ montre la copie', async () => (await shown()).name === 'Contrat de prestation (1)', 60000);
  const seen = opened ? await shown() : await shown().catch(() => null);
  check('l\'app ouvre la copie : son numéro, son nom (« Contrat de prestation (1) ») et le texte de l\'original', opened && seen.id === String(copy.id) && /Contrat de prestation/.test(seen.text), seen);
  await shot(frame, `${TAG}-2-app`);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await prepare(run);
  await playDuplicate(run);
  await playInFolder(run);
  await playAttachments(run);
  await playCopyPaste(run);
  await playCutPaste(run);
  await playPdf(run);
  await playRefusals(run);
  await playRealApp(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console (hors les refus de la politique que l\'essai a posés lui-même)', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
