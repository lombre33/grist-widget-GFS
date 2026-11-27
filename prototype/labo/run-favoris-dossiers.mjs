// Les dossiers de « Moi » en favori (demande du porteur du 27/11 ; choix : « Dans Favoris, avant les fichiers » ; lot 1 ; contrats 6.4, point 11), joués dans un VRAI serveur Grist (l'image officielle,
// `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier : ce que ni grist-static ni un faux Grist écrit par nous ne peuvent dire : la valeur `Favorite` d'une ligne d'état de dossier
// que Grist garde et rend, la ligne qui naît pour épingler un dossier que seuls ses fichiers font exister, et ce que la personne retrouve en rechargeant GFS.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-favoris-dossiers.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. « Contrats » n'existe que par ses fichiers : son épingle écrit UNE ligne d'état (App et File vides, Favorite vrai, à l'adresse de la personne) ; « Vide », qui a déjà sa ligne, la garde (même numéro).
//   2. « Favoris » compte les deux et les liste avant les fichiers ; rechargé, GFS les retrouve ; le double clic ouvre le dossier ; le compte du volet suit.
//   3. F2 renomme « Vide » : la même ligne change de chemin, l'épingle reste ; Retirer des favoris éteint la ligne sans l'effacer.
//   4. Suppr sur le dossier vide épinglé : la ligne part avec son épingle ; Ctrl+Z la remet épinglée.
//   5. Le favori d'une autre personne n'est ni vu ni touché ; la console de GFS reste muette.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, contrastProblems } from './lab-pdf.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { apply, rowsOf } from './lab-rest.mjs';
import { FILING, fileRow, filing, folderRow, stateRows } from './lab-dossier-moi.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const ME = 'essai@example.com', OTHER = 'autre@example.com';
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const line = async (run, path, who = ME) => (await stateRows(run, who)).find(row => row.Folder === path);
const reopen = async run => { await run.page.reload(); const frame = await gfsFrame(run.page); await frame.locator('.ls-row').first().waitFor(); return frame; };
const favCount = frame => frame.locator('.tr-row[data-view="fav"] .cnt').textContent().catch(() => '');
// L'épingle d'une ligne : la souris va sur la ligne (le bouton ne se montre qu'alors), puis on appuie.
async function pressPin(frame, name) {
  const row = folderRow(frame, name);
  await row.hover();
  await row.locator('.rb.pin').click();
  await frame.page().waitForTimeout(900);
}
const inFavorites = async frame => { await frame.locator('.tr-row[data-view="fav"]').click(); await frame.locator('.ls-row, .empty').first().waitFor(); };
// Les lignes de la liste, dans l'ordre (dossiers compris), une fois qu'elles sont celles qu'on attend (la relecture suit l'écriture).
async function listed(frame, expected) {
  const all = () => frame.locator('.ls-row .nm .t').allTextContents();
  await frame.waitForFunction(wanted => JSON.stringify([...document.querySelectorAll('.ls-row .nm .t')].map(node => node.textContent)) === JSON.stringify(wanted), expected, { timeout: 8000 }).catch(() => {});
  return JSON.stringify(await all());
}

async function play(run) {
  const { page } = run;
  say('--- 0. des fichiers rangés, un dossier vide, le favori d\'une autre personne ---');
  await importSamples(run);
  const facture = await fileRow(run, 'Facture.pdf');
  const devis = await fileRow(run, 'Devis.pdf');
  // La table du rangement n'existe pas encore : « Nouveau dossier » la fait naître, avec l'accord de la personne (6.2) ; « Vide » est ce premier dossier.
  let { frame } = run;
  await frame.getByRole('button', { name: new RegExp(`^${t('ex.new')}$`) }).click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.newFolder')}`) }).click();
  await frame.locator('#nw-title').waitFor();
  await page.keyboard.type('Vide');
  await page.keyboard.press('Enter');
  await frame.locator('#ask-title').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  await folderRow(frame, 'Vide').waitFor({ timeout: 20000 });
  const vide = await line(run, 'Vide');
  check('« Vide » a sa ligne d\'état, sans favori', Boolean(vide) && vide.Favorite === false, await stateRows(run, ME));
  const answer = await apply(run, [filing(ME, facture, 'Contrats'), filing(ME, devis, 'Contrats/Sous'),
    ['AddRecord', FILING, null, { User: OTHER, App: '', File: '', Folder: 'Chez-autre', Favorite: true }]]);
  check('le rangement est semé (fichiers, ligne d\'une autre personne)', answer.status === 200, answer.text);
  frame = await reopen(run);

  say('--- 1. l\'épingle de la ligne ---');
  await pressPin(frame, 'Contrats');
  const contrats = await line(run, 'Contrats');
  check('« Contrats » (qui n\'existait que par ses fichiers) a désormais sa ligne d\'état : épinglée, à l\'adresse de la personne, sans app ni fichier',
    Boolean(contrats) && contrats.Favorite === true && !contrats.App && !contrats.File && contrats.User === ME, await stateRows(run, ME));
  check('une seule ligne pour « Contrats », et ses fichiers n\'ont pas bougé', (await stateRows(run, ME)).filter(row => row.Folder === 'Contrats').length === 1
    && (await rowsOf(run, FILING)).filter(row => row.App === 'gfs-fichiers').length === 2);
  await pressPin(frame, 'Vide');
  const videEpingle = await line(run, 'Vide');
  check('« Vide » garde sa ligne (même numéro), son épingle est allumée, aucune ligne de plus', videEpingle.id === vide.id && videEpingle.Favorite === true
    && (await stateRows(run, ME)).filter(row => row.Folder === 'Vide').length === 1, await stateRows(run, ME));
  check('l\'épingle de la ligne est allumée à l\'écran (« Retirer des favoris »)', await folderRow(frame, 'Vide').locator('.rb.pin').getAttribute('aria-label') === t('ex.unpin'));

  say('--- 2. « Favoris » ---');
  check('le volet compte deux favoris', (await favCount(frame)).trim() === '2', await favCount(frame));
  await inFavorites(frame);
  check('« Favoris » liste les deux dossiers (aucun fichier n\'est épinglé)', await listed(frame, ['Contrats', 'Vide']) === JSON.stringify(['Contrats', 'Vide']));
  check('la liste tient à 700 × 400, contraste de 4,5:1', (await contrastProblems(frame, '.ex-scroll')).length === 0, await contrastProblems(frame, '.ex-scroll'));
  frame = await reopen(run);
  await inFavorites(frame);
  check('rechargé, GFS retrouve les deux favoris, le volet aussi', await listed(frame, ['Contrats', 'Vide']) === JSON.stringify(['Contrats', 'Vide']) && (await favCount(frame)).trim() === '2');
  check('le favori d\'une autre personne n\'est pas vu', !(await frame.locator('.ls-row .t', { hasText: 'Chez-autre' }).count()));
  await folderRow(frame, 'Contrats').dblclick();
  await frame.locator('.crumbs', { hasText: 'Contrats' }).waitFor();
  check('le double clic ouvre le dossier favori : ses fichiers et son sous-dossier', await listed(frame, ['Sous', 'Facture.pdf']) === JSON.stringify(['Sous', 'Facture.pdf']));
  await frame.locator('.tr-row[data-path=""]').click();

  say('--- 3. F2 et « Retirer des favoris » ---');
  await folderRow(frame, 'Vide').click();
  await page.keyboard.press('F2');
  await frame.locator('#nw-title').waitFor();
  await page.keyboard.type('Libre');
  await page.keyboard.press('Enter');
  await folderRow(frame, 'Libre').waitFor({ timeout: 20000 });
  const libre = await line(run, 'Libre');
  check('la même ligne a changé de chemin sur place, l\'épingle reste', libre && libre.id === vide.id && libre.Favorite === true && !(await line(run, 'Vide')), await stateRows(run, ME));
  await pressPin(frame, 'Contrats');
  const eteinte = await line(run, 'Contrats');
  check('« Retirer des favoris » éteint la ligne sans l\'effacer (le dossier reste ce qu\'il était)', eteinte && eteinte.Favorite === false && eteinte.id === contrats.id, await stateRows(run, ME));
  check('le volet compte un favori', (await favCount(frame)).trim() === '1', await favCount(frame));

  say('--- 4. Suppr sur le dossier vide épinglé, puis Ctrl+Z ---');
  await folderRow(frame, 'Libre').click();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(1500);
  check('la ligne part avec son épingle, le volet ne compte plus rien', !(await line(run, 'Libre')) && ['', '0'].includes((await favCount(frame)).trim()), [await stateRows(run, ME), await favCount(frame)]);
  await page.keyboard.press('Control+z');
  await folderRow(frame, 'Libre').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const back = await line(run, 'Libre');
  check('Ctrl+Z remet le dossier ET son épingle (une ligne, Favorite vrai)', back && back.Favorite === true && (await stateRows(run, ME)).filter(row => row.Folder === 'Libre').length === 1, await stateRows(run, ME));
  check('le volet recompte un favori', (await favCount(frame)).trim() === '1', await favCount(frame));

  say('--- 5. les autres, la console ---');
  const other = await line(run, 'Chez-autre', OTHER);
  check('la ligne de l\'autre personne n\'a pas changé', other && other.Favorite === true, await stateRows(run, OTHER));
  check('la console de GFS reste muette', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  await play(await openGfs(context, { lang }));
} finally {
  await browser.close();
  pages.close();
}
