// La corbeille des fichiers des apps (décision du porteur, 04/11 : tout se fait depuis l'explorateur, pour toutes les apps, avec une corbeille ; contrats 2.4 `suppression`, 6.7), jouée dans un VRAI
// serveur Grist (l'image officielle, `bash vrai-serveur.sh`) avec les modèles de Publipostage+ et la vraie app, à 700 × 400, à la vraie souris et au vrai clavier. Ce que ni grist-static ni un
// faux Grist écrit par nous ne peuvent dire : ce que Grist fait d'un numéro de ligne voulu, d'un lot dont une action échoue, d'une ligne retirée qui n'est plus là ; ce que les tables internes
// disent des colonnes (formules, pièces jointes) ; et si la vraie app ouvre un modèle restauré. Chromium seulement (test/corbeille-firefox.mjs mesure l'interface dans un vrai Firefox).
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-corbeille-apps.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Ce que Grist fait (table d'essai) : un numéro pris est refusé, un numéro libre est repris, un lot est tout ou rien, retirer une ligne absente n'échoue pas.
//   2. Suppr sur un modèle : la table GFS_Corbeille naît avec l'accord de la personne (un refus ne supprime rien) ; la ligne est copiée et retirée.
//   3. La vue « Corbeille » montre le modèle (type, dossier de retour, qui) ; Entrée le restaure au même numéro, valeurs identiques ; le modèle par défaut ne reprend pas son étoile.
//   4. Restaurer quand le jeton est déjà là, quand le nom est pris, quand le numéro est pris.
//   5. Un modèle qui a une pièce jointe n'est pas mis à la corbeille : le refus le dit.
//   6. Supprimer pour de bon et vider la corbeille : les questions, rien d'autre ne part.
//   7. La vraie Publipostage+ ouvre le modèle restauré (son numéro, son nom, son texte).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, waitForNames, waitForToast, shot, rowOf, goTo, openRowMenu, contrastProblems, windowFits, waitFor } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `apps-${lang}-${scheme}`;
const ME = 'essai@example.com';
const MODELS = 'Publipostage_Modeles';
const BIN = 'GFS_Corbeille';
const IN_PANEL = '{"shown":true,"inPanel":true,"overflowing":[]}';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const sorted = list => [...list].sort();
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const said = (frame, key, params) => waitForToast(frame, exact(t(key, params)));
// La liste porte ces noms (dans n'importe quel ordre) ; sinon, le dit : la liste vue.
const sameNames = async (frame, expected) => {
  const found = await waitForNames(frame, expected);
  const ok = JSON.stringify(sorted(found)) === JSON.stringify(sorted(expected));
  if (!ok) say(`  (la liste montre : ${JSON.stringify(found)}, attendu : ${JSON.stringify(expected)})`);
  return ok;
};

// Une écriture directe dans le document (la page de Grist est de l'origine du serveur : la session de la personne d'essai suffit). Rend { status, body }.
const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => {
  const answer = await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: answer.status, body: await answer.json() };
}, [run.docId, actions]);
const modelRows = run => run.rest.rows(MODELS);
const byId = (rows, id) => rows.find(row => row.id === id);
const byName = (rows, name) => rows.find(row => row.Nom === name);
const withoutFormula = row => { const { Resume, ...data } = row; return data; }; // la colonne `Resume` est une formule : GFS ne la garde pas
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const textOf = async locator => ((await locator.count()) ? locator.first().textContent() : null);
const trashCount = frame => textOf(frame.locator('.tr-row[data-view="trash"] .cnt'));
const selectedName = frame => textOf(frame.locator('.ls-row[aria-selected="true"] .nm .t'));
const openTrash = frame => goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
const goHome = frame => goTo(frame, new RegExp(`^\\s*${t('ex.me')}\\s*\\d*\\s*$`));
const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
const enterFolder = async (frame, name) => { await goHome(frame); await folderRow(frame, name).dblclick(); };
const entries = run => run.rest.rows(BIN);

// Le modèle `name` est choisi à la vraie souris, puis Suppr au vrai clavier.
async function pressDelete(run, name) {
  await rowOf(run.frame, name).click();
  await run.page.keyboard.press('Delete');
}

// ----- 0. Les modèles de l'app : ceux du labo, avec un jeton, une colonne à formule et une pièce jointe, comme une app qui les aurait.
async function prepare(run) {
  const { page, frame, docId } = run;
  say('--- 0. les modèles de Publipostage+ ---');
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
  check('les modèles sont là : 19 lignes (dont les réglages), la formule calcule, la pièce jointe est citée', rows.length === 19 && byId(rows, 3).Resume === 'CONVOCATION DE SESSION' && same(byId(rows, 17).Pieces, ['L', attachment]), [rows.length, byId(rows, 3).Resume, byId(rows, 17).Pieces]);
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  check('l\'explorateur relit la table : GFS ne connaît pas encore la personne, le rangement de la personne ne s\'applique pas (les dix-huit modèles, sans dossier)', (await waitForNames(frame, [])).length === 18 || (await frame.locator('.ls-row:not(.folder)').count()) === 18, await waitForNames(frame, []));
}

// ----- 0 bis. GFS ne connaît l'adresse de la personne qu'une fois sa table de rangement lue (contrats 6.4) : un premier favori la fait naître, avec l'accord. Sans elle, la corbeille ne
// signe pas ses suppressions (rien n'est inventé) ; avec elle, l'adresse est celle que Grist donne.
async function pinFirst(run) {
  const { frame, rest } = run;
  say('--- 0 bis. un premier favori, pour que GFS connaisse la personne ---');
  await rowOf(frame, 'Support de session').hover();
  await rowOf(frame, 'Support de session').locator('.rb.pin').click();
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
  const lines = (await rest.rows('GFS_Rangement')).filter(row => row.App === 'publipostage');
  check('le favori est rangé pour la personne que Grist connaît', lines.length === 1 && lines[0].Utilisateur === ME, lines);
  await goHome(frame);
  check('GFS connaît la personne : son rangement s\'applique, les dossiers sont là et la racine n\'a que les trois modèles sans dossier', await folderRow(frame, 'Formation').count() === 1 && await sameNames(frame, ['Contrat de prestation', 'Quittance de loyer', 'Support de session']));
}

// ----- 1. Ce que Grist fait, mesuré sur une table d'essai.
async function playGristFacts(run) {
  say('--- 1. ce que Grist fait ---');
  await apply(run, [['AddTable', 'Essai_Lot2', [{ id: 'Nom', type: 'Text' }]], ['BulkAddRecord', 'Essai_Lot2', [null, null, null], { Nom: ['a', 'b', 'c'] }], ['AddTable', 'Essai_Copie', [{ id: 'Nom', type: 'Text' }]]]);
  const taken = await apply(run, [['AddRecord', 'Essai_Lot2', 2, { Nom: 'écrase ?' }]]);
  const rows = () => run.rest.rows('Essai_Lot2');
  check('un numéro de ligne déjà pris est refusé par Grist, rien n\'est écrasé (la restauration vérifie, et la course est sans danger)', taken.status === 500 && /existing record/.test(taken.body.error) && same((await rows()).map(row => row.Nom), ['a', 'b', 'c']), [taken, await rows()]);
  await apply(run, [['RemoveRecord', 'Essai_Lot2', 2]]);
  const free = await apply(run, [['AddRecord', 'Essai_Lot2', 2, { Nom: 'revenu' }]]);
  check('un numéro libre est repris tel quel : la ligne revient au même numéro', free.status === 200 && same(free.body.retValues, [2]) && byId(await rows(), 2).Nom === 'revenu');
  const absent = await apply(run, [['AddRecord', 'Essai_Copie', null, { Nom: 'copie' }], ['RemoveRecord', 'Essai_Lot2', 9999]]);
  check('retirer une ligne qui n\'est plus là n\'échoue pas : le lot continue (seule la fin du lot le sait)', absent.status === 200 && same(absent.body.retValues, [1, null]) && (await run.rest.rows('Essai_Copie')).length === 1, absent);
  const broken = await apply(run, [['AddRecord', 'Essai_Copie', null, { Nom: 'copie 2' }], ['AddRecord', 'Essai_Lot2', null, { Inconnue: 1 }]]);
  check('un lot dont une action échoue est défait en entier : un fichier n\'est jamais à la fois dans l\'app et à la corbeille', broken.status === 500 && (await run.rest.rows('Essai_Copie')).length === 1, broken);
  await apply(run, [['RemoveTable', 'Essai_Lot2'], ['RemoveTable', 'Essai_Copie']]);
}

// ----- 2. Suppr sur un modèle : la table naît avec l'accord ; un refus ne supprime rien.
async function playFirstTrash(run) {
  const { page, frame } = run;
  say('--- 2. Suppr sur un modèle ---');
  const before = byName(await modelRows(run), 'Contrat de prestation');
  check('le modèle est un fichier de l\'app : le menu de sa ligne propose « Mettre à la corbeille », avec Suppr', await (async () => {
    await openRowMenu(frame, 'Contrat de prestation');
    const item = frame.getByRole('menuitem', { name: new RegExp(`^${t('trash.move')}`) });
    const open = await item.getAttribute('aria-disabled') !== 'true';
    await page.keyboard.press('Escape');
    await frame.locator('.menu').waitFor({ state: 'detached' });
    return open;
  })());
  await pressDelete(run, 'Contrat de prestation');
  await frame.locator('.mod.ask').waitFor();
  check('la table n\'existe pas : une question de la fenêtre du widget, qui dit ce que GFS y garde', (await frame.locator('#ask-title').textContent()) === t('trash.table.title') && (await frame.locator('.ask').textContent()).includes('GFS_Corbeille'), await frame.locator('#ask-title').textContent());
  check('la fenêtre est lisible (4,5:1) et tient dans le panneau', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === IN_PANEL, [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, `${TAG}-1-table`);
  await frame.locator('[data-fk="ask-no"]').click();
  const declined = await said(frame, 'trash.failed', { name: 'Contrat de prestation', reason: t('trash.table.declined') });
  check('« Annuler » : la phrase dit que rien n\'est supprimé, la table n\'est pas créée, le modèle est toujours là', declined === t('trash.failed', { name: 'Contrat de prestation', reason: t('trash.table.declined') }) && !(await run.rest.tables()).includes(BIN) && same(withoutFormula(byName(await modelRows(run), 'Contrat de prestation')), withoutFormula(before)), declined);
  await rowOf(frame, 'Contrat de prestation').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  const moved = await said(frame, 'trash.moved', { name: 'Contrat de prestation' });
  check('« Créer la table » : le modèle est à la corbeille, la phrase le dit, la liste le montre en moins', moved === t('trash.moved', { name: 'Contrat de prestation' }) && await sameNames(frame, ['Quittance de loyer', 'Support de session']), moved);
  const types = Object.fromEntries((await run.rest.columns(BIN)).map(column => [column.id, column.type]));
  check('GFS_Corbeille est née avec ses onze colonnes, dans les types voulus', same(Object.keys(types), ['Identifiant', 'App', 'Table', 'FichierId', 'Nom', 'Type', 'Date', 'Auteur', 'SupprimeLe', 'SupprimePar', 'Instantane']) && types.SupprimeLe === 'DateTime:UTC' && types.Instantane === 'Text', types);
  const [entry] = await entries(run);
  const copy = JSON.parse(entry.Instantane);
  check('l\'entrée dit d\'où vient le fichier et qui l\'a supprimé (la date en secondes, l\'adresse que Grist donne)', entry.App === 'publipostage' && entry.Table === MODELS && entry.FichierId === '16' && entry.Nom === 'Contrat de prestation' && entry.Type === 'document' && Math.abs(entry.SupprimeLe - Date.now() / 1000) < 120 && entry.SupprimePar === ME, entry);
  check('la copie garde la ligne : son numéro et ses colonnes de données, ni la formule, ni la colonne de tri', copy.format === 1 && copy.id === 16 && copy.valeurs.Nom === 'Contrat de prestation' && copy.valeurs.Jeton === 'j16' && !('Resume' in copy.valeurs) && !('manualSort' in copy.valeurs) && 'Pieces' in copy.valeurs && 'DateModif' in copy.valeurs, Object.keys(copy.valeurs));
  check('la ligne n\'est plus dans la table de l\'app, les autres n\'ont pas bougé', !byId(await modelRows(run), 16) && (await modelRows(run)).length === 18);
  run.contract = before;
}

// ----- 3. La vue « Corbeille », puis Entrée : le modèle revient au même numéro, valeurs identiques.
async function playRestore(run) {
  const { page, frame } = run;
  say('--- 3. la vue « Corbeille » et Entrée ---');
  check('l\'arbre dit combien de fichiers y sont', await trashCount(frame) === '1', await trashCount(frame));
  await openTrash(frame);
  const row = rowOf(frame, 'Contrat de prestation');
  check('la corbeille montre le modèle, avec les initiales de la personne et le bouton « Restaurer »', await sameNames(frame, ['Contrat de prestation']) && await row.locator('.who').count() === 1 && await row.locator('.rb.rs').count() === 1);
  await row.click();
  const info = await frame.locator('.ex-info').textContent();
  check('la barre d\'information donne la date de suppression', info.includes(t('trash.deletedOn', { date: '' }).trim()), info);
  await shot(frame, `${TAG}-2-corbeille`);
  check('la liste, la barre de la corbeille et la barre d\'information sont lisibles (4,5:1)', (await contrastProblems(frame, '.ex-main')).length === 0 && (await contrastProblems(frame, '.ex-info')).length === 0, [await contrastProblems(frame, '.ex-main'), await contrastProblems(frame, '.ex-info')]);
  await page.keyboard.press('Enter');
  const restored = await said(frame, 'trash.restored', { name: 'Contrat de prestation' });
  const back = byId(await modelRows(run), 16);
  check('Entrée restaure : la phrase le dit, la corbeille est vide', restored === t('trash.restored', { name: 'Contrat de prestation' }) && await sameNames(frame, []) && (await entries(run)).length === 0, restored);
  check('la ligne est revenue au même numéro (16), avec exactement les mêmes valeurs (dates, jeton, contenu) ; la formule recalcule', Boolean(back) && same(withoutFormula(back), withoutFormula(run.contract)) && back.Resume === 'CONTRAT DE PRESTATION', [back, run.contract]);
  await goHome(frame);
  check('le modèle est de retour à la racine de « Moi »', await sameNames(frame, ['Contrat de prestation', 'Quittance de loyer', 'Support de session']));
  // Le modèle par défaut (★) : un autre l'est devenu pendant que le sien était à la corbeille.
  await enterFolder(frame, 'Formation');
  const star = byId(await modelRows(run), 1);
  await pressDelete(run, 'Feuille d’émargement');
  await said(frame, 'trash.moved', { name: 'Feuille d’émargement' });
  await apply(run, [['UpdateRecord', MODELS, 2, { EstParDefaut: true }]]);
  await openTrash(frame);
  check('le dossier de retour est dit : « revient dans Formation »', (await rowOf(frame, 'Feuille d’émargement').locator('.nm').textContent()).includes('Formation') || (await frame.locator('.ex-info').textContent()).includes('Formation'), await frame.locator('.ls-row').first().textContent());
  await rowOf(frame, 'Feuille d’émargement').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Feuille d’émargement' });
  const rows = await modelRows(run);
  check('restauré, le modèle n\'est pas redevenu par défaut : il n\'y a qu\'une étoile', byId(rows, 1).EstParDefaut === false && byId(rows, 2).EstParDefaut === true && rows.filter(row => row.EstParDefaut).length === 1 && byId(rows, 1).Jeton === star.Jeton, rows.filter(row => row.EstParDefaut).map(row => row.id));
  await enterFolder(frame, 'Formation');
  check('il est de retour dans son dossier, épinglé comme avant (le rangement de l\'app n\'a pas bougé)', await rowOf(frame, 'Feuille d’émargement').locator('.rb.pin.on').count() === 1);
}

// ----- 4. Restaurer quand quelque chose a changé pendant que le modèle était à la corbeille.
async function playTaken(run) {
  const { page, frame } = run;
  say('--- 4. le jeton, le nom et le numéro ---');
  await enterFolder(frame, 'Formation');
  // Le jeton : l'app (ou une autre personne) a déjà remis ce modèle.
  await pressDelete(run, 'Convocation de session');
  await said(frame, 'trash.moved', { name: 'Convocation de session' });
  await apply(run, [['AddRecord', MODELS, null, { Nom: 'Rétabli par l’app', TypeModele: 'email', Jeton: 'j3', Contenu: '<p>x</p>' }]]);
  const count = (await modelRows(run)).length;
  await openTrash(frame);
  await rowOf(frame, 'Convocation de session').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Convocation de session' });
  const rows = await modelRows(run);
  check('même jeton : rien n\'est écrit dans la table de l\'app (pas de doublon), l\'entrée quitte la corbeille', rows.length === count && rows.filter(row => row.Jeton === 'j3').length === 1 && (await entries(run)).length === 0, rows.filter(row => row.Jeton === 'j3').map(row => row.Nom));
  // Le nom : un autre modèle a pris « Dossier de formation ».
  await enterFolder(frame, 'Formation');
  await pressDelete(run, 'Dossier de formation');
  await said(frame, 'trash.moved', { name: 'Dossier de formation' });
  await apply(run, [['AddRecord', MODELS, null, { Nom: 'Dossier de formation', TypeModele: 'document', Jeton: 'autre-nom', Contenu: '<p>y</p>' }]]);
  await openTrash(frame);
  await rowOf(frame, 'Dossier de formation').hover();
  await rowOf(frame, 'Dossier de formation').locator('.rb.rs').click();
  const renamed = await said(frame, 'trash.restoredAs', { name: 'Dossier de formation', as: 'Dossier de formation (1)' });
  const after = await modelRows(run);
  check('nom pris : « Restaurer » à la souris le rend sous le premier nom libre, la phrase dit lequel, le numéro est le sien', renamed === t('trash.restoredAs', { name: 'Dossier de formation', as: 'Dossier de formation (1)' }) && byId(after, 4).Nom === 'Dossier de formation (1)' && byName(after, 'Dossier de formation').id !== 4, renamed);
  // Le numéro : une autre ligne a reçu le numéro du modèle.
  await enterFolder(frame, 'Formation');
  await pressDelete(run, 'Notes de session');
  await said(frame, 'trash.moved', { name: 'Notes de session' });
  await apply(run, [['AddRecord', MODELS, 5, { Nom: 'Prise', TypeModele: 'document', Jeton: 'prise', Contenu: '<p>z</p>' }]]);
  await openTrash(frame);
  await rowOf(frame, 'Notes de session').click();
  await page.keyboard.press('Enter');
  await said(frame, 'trash.restored', { name: 'Notes de session' });
  const last = await modelRows(run);
  const notes = byName(last, 'Notes de session');
  check('numéro pris : un numéro neuf, la ligne de l\'autre n\'est pas touchée', Boolean(notes) && notes.id !== 5 && notes.Jeton === 'j5' && byId(last, 5).Nom === 'Prise' && (await entries(run)).length === 0, [notes && notes.id, byId(last, 5)]);
}

// ----- 5. Un modèle qui a une pièce jointe n'est pas mis à la corbeille.
async function playAttachments(run) {
  const { frame } = run;
  say('--- 5. une pièce jointe ---');
  await goHome(frame);
  const before = await modelRows(run);
  await pressDelete(run, 'Quittance de loyer');
  const reason = t('trash.attachments');
  const refused = await said(frame, 'trash.failed', { name: 'Quittance de loyer', reason });
  check('le refus dit pourquoi, sans question ; le modèle et sa pièce jointe restent', refused === t('trash.failed', { name: 'Quittance de loyer', reason }) && await frame.locator('.mod.ask').count() === 0 && same(byId(await modelRows(run), 17), byId(before, 17)) && (await entries(run)).length === 0, refused);
}

// ----- 6. Supprimer pour de bon, vider la corbeille.
async function playPurge(run) {
  const { page, frame } = run;
  say('--- 6. supprimer pour de bon et vider ---');
  await enterFolder(frame, 'Formation');
  await folderRow(frame, 'Archives 2025').dblclick();
  await pressDelete(run, 'Ancien programme');
  await said(frame, 'trash.moved', { name: 'Ancien programme' });
  const attachments = (await run.rest.attachments()).length;
  const rowsBefore = (await modelRows(run)).length;
  await openTrash(frame);
  await rowOf(frame, 'Ancien programme').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  check('Suppr à la corbeille pose une question qui nomme le modèle et donne le clavier à « Annuler »', await frame.evaluate(() => document.activeElement.dataset.fk) === 'ask-no' && (await frame.locator('#ask-title').textContent()) === t('trash.purge.title', { name: 'Ancien programme' }));
  await page.keyboard.press('Escape');
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  check('Échap : rien n\'est supprimé', (await entries(run)).length === 1);
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await said(frame, 'trash.purged', { name: 'Ancien programme' });
  check('« Supprimer définitivement » : l\'entrée part, la table de l\'app n\'est pas touchée, la pièce jointe d\'un autre modèle reste', (await entries(run)).length === 0 && (await modelRows(run)).length === rowsBefore && (await run.rest.attachments()).length === attachments);
  await goHome(frame);
  await folderRow(frame, 'Stock').dblclick();
  for (const name of ['Étiquette produit A6', 'Fiche d’inventaire']) await pressDelete(run, name);
  await openTrash(frame);
  check('deux modèles à la corbeille, le compte le dit', await sameNames(frame, ['Étiquette produit A6', 'Fiche d’inventaire']) && await trashCount(frame) === '2', await trashCount(frame));
  await frame.locator('[data-empty-trash]').click();
  await frame.locator('.mod.ask').waitFor();
  const items = await frame.locator('.ask-items li').allTextContents();
  check('une seule question, qui nomme les modèles et donne le clavier à « Annuler »', await frame.evaluate(() => document.activeElement.dataset.fk) === 'ask-no' && same(sorted(items), sorted(['Étiquette produit A6', 'Fiche d’inventaire'])), items);
  await shot(frame, `${TAG}-3-vider`);
  await frame.locator('[data-fk="ask-yes"]').click();
  const emptied = await said(frame, 'trash.emptied', { n: 2 });
  const rows = await modelRows(run);
  check('vidée : la phrase dit combien, la table de la corbeille est vide, les modèles sont partis pour de bon', emptied === t('trash.emptied', { n: 2 }) && (await entries(run)).length === 0 && !byName(rows, 'Fiche d’inventaire') && !byName(rows, 'Étiquette produit A6'), emptied);
  await goHome(frame);
}

// ----- 7. La vraie Publipostage+ ouvre le modèle restauré.
async function playRealApp(run) {
  const { page, frame } = run;
  say('--- 7. la vraie Publipostage+ ouvre le modèle restauré ---');
  await rowOf(frame, 'Contrat de prestation').dblclick();
  const appFrame = () => page.frames().find(each => each.url().startsWith(APP_URL) && !each.isDetached());
  const shown = () => appFrame().evaluate(() => ({ id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent }));
  const opened = await waitFor(page, 'Publipostage+ montre le modèle', async () => (await shown()).name === 'Contrat de prestation', 60000);
  const seen = opened ? await shown() : await shown().catch(() => null);
  check('l\'app ouvre le modèle restauré : son numéro (16), son nom et son texte sont ceux d\'avant la corbeille', opened && seen.id === '16' && /Contrat de prestation/.test(seen.text), seen);
  await shot(frame, `${TAG}-4-app`);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await prepare(run);
  await pinFirst(run);
  await playGristFacts(run);
  await playFirstTrash(run);
  await playRestore(run);
  await playTaken(run);
  await playAttachments(run);
  await playPurge(run);
  await playRealApp(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console (hors les refus de la politique que l\'essai a posés lui-même)', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
