// La fenêtre « Partager » (contrats 11.7, point 13) jouée dans GFS lui-même, dans un VRAI serveur Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, à trois comptes en trois temps
// (le serveur d'essai ne connaît qu'une personne à la fois, GRIST_EMAIL ; l'état passe par /tmp/partager-fenetre-etat.json).
//   PHASE=proprietaire  deux PDF ; « Partager… » dit qu'il faut activer ; la question dit le prix ; Grist recharge, GFS rouvre la fenêtre ; les PDF d'avant sont lisibles par tous ; partage avec viewer@, par les éditeurs ;
//                       changer le niveau, retirer une ligne.
//   PHASE=editeur       editor@ : importe son PDF, le partage avec viewer@ SANS propriétaire ; sur le PDF du propriétaire, la fenêtre se lit sans rien offrir.
//   PHASE=lecteur       viewer@ : voit les PDF qu'on lui a partagés, pas les autres ; la fenêtre se lit sans rien offrir.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames, names, rowOf, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { gfsFrame, fits } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_FENETRE_ETAT || '/tmp/partager-fenetre-etat.json';
const { t } = createI18n(lang);
const VIEWER = 'viewer@example.com';
const shot = (frame, name) => pdfShot(frame, `partager-${lang}-${scheme}-${name}`);
const panel = async frame => (await frame.locator('.mod.sh').innerText()).replace(/\s+/g, ' ');
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const shares = async run => (await run.rest.rows('GFS_Partages')).map(row => [row.Cible.replace('gfs-fichiers:', ''), row.Personne, row.Droit, row.Valide]);

// « Partager… » du menu d'une ligne, à la vraie souris.
async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  const entry = frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) });
  await entry.click();
  await frame.locator('.mod.sh').waitFor();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
const closeShare = async frame => { await frame.locator('[data-fk="share-close"]').click(); await frame.locator('.mod.sh').waitFor({ state: 'detached' }); };

// Ajoute `who` au niveau voulu par le champ, la liste et le formulaire (clic sur la proposition, puis « Partager »).
async function addPerson(frame, who, text = who) {
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(text);
  await frame.locator(`[data-fk="share-pick-${who}"]`).click();
  const before = await frame.locator('.mod.sh .rr[data-share]').count();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.waitForFunction(count => document.querySelectorAll('.mod.sh .rr[data-share]').length > count, before, { timeout: 15000 });
}

async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}

async function playOwner(run) {
  const { page } = run;
  let { frame } = run;
  await importSamples(run);
  say('--- 1. « Partager… » sans partage activé ---');
  await openRowMenu(frame, 'Facture.pdf');
  await shot(frame, '1-menu');
  const entry = frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) });
  check('le menu de la ligne propose « Partager… », dégrisé', (await entry.count()) === 1 && (await entry.getAttribute('aria-disabled')) === null);
  await entry.click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  let text = await panel(frame);
  check('la fenêtre dit que le partage n\'est pas activé, et le propriétaire a le bouton', text.includes(t('share.inactive.owner')) && (await frame.locator('[data-fk="share-activate"]').count()) === 1, text);
  check('la fenêtre tient dans la page et reste lisible (4,5:1)', await fits(frame, '.mod.sh'), [await contrastProblems(frame, '.mod.sh')]);
  await shot(frame, '2-inactif');

  say('--- 2. activer : la question dit le prix, Grist recharge, la fenêtre revient ---');
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asked = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('la question dit ce qui s\'écrit, le prix de la première règle et le rechargement', [t('rights.ask.sharing.title'), t('rights.ask.firstRule'), t('rights.ask.reload')].every(part => asked.includes(part)), asked);
  await shot(frame, '3-question');
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  check('GFS a rouvert la fenêtre du même fichier tout seul', (await frame.locator('#share-title').innerText()).includes('Facture.pdf'));
  text = await panel(frame);
  check('le champ d\'ajout est là, le propriétaire est en tête', (await frame.locator('[data-fk="share-add"]').count()) === 1 && (await frame.locator('[data-fixed="owners"]').count()) === 1, text);
  const legacy = await shares(run);
  check('les PDF déjà dans GFS restent lisibles par tous : une ligne « tous » par PDF', legacy.length === 2 && legacy.every(row => row[1] === '@tous' && row[2] === 'lecture' && row[3] === true), legacy);
  check('la ligne « tous » apparaît dans la liste de la fenêtre', (await frame.locator('.mod.sh .rr[data-share]').count()) === 1, text);
  await shot(frame, '4-actif');

  say('--- 3. ajouter viewer@, changer le niveau, retirer ---');
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill('viewer@exam');
  await shot(frame, '5-saisie');
  await frame.locator('[data-fk="share-add"]').fill(VIEWER);
  await frame.locator(`[data-fk="share-pick-${VIEWER}"]`).click();
  await frame.locator('[data-fk="share-confirm"]').waitFor();
  check('le formulaire dit le niveau, « Peut télécharger » et la date de fin (avec la réserve)', await frame.locator('.sg-new').innerText().then(form => [t('share.download'), t('share.end'), t('share.end.hint')].every(part => form.includes(part))));
  check('le formulaire tient dans la page et reste lisible', await fits(frame, '.mod.sh'), [await contrastProblems(frame, '.mod.sh')]);
  const visible = await frame.evaluate(() => { const yes = document.querySelector('[data-fk="share-confirm"]').getBoundingClientRect(); const foot = document.querySelector('.mod.sh .mod-foot').getBoundingClientRect(); return yes.bottom <= foot.top + 1 && yes.top >= 0; });
  check('« Ajouter » se montre sans défiler, même à 700 × 400 ; le clavier est sur le droit', visible && (await frame.evaluate(() => document.activeElement.dataset.fk)) === 'share-new-level');
  await shot(frame, '6-formulaire');
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.waitForFunction(() => document.querySelectorAll('.mod.sh .rr[data-share]').length === 2, null, { timeout: 15000 });
  let rows = await shares(run);
  check('GFS_Partages porte la ligne viewer@, en lecture, valide', rows.some(row => row[1] === VIEWER && row[2] === 'lecture' && row[3] === true), rows);
  const mine = frame.locator('.mod.sh .rr[data-share]').filter({ hasText: VIEWER }).locator('button.lvl');
  await mine.click();
  await frame.locator('.menu').waitFor();
  await shot(frame, '7-niveaux');
  await frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.ecriture')) }).first().click();
  await page.waitForTimeout(1200);
  rows = await shares(run);
  check('le niveau change dans la table', rows.some(row => row[1] === VIEWER && row[2] === 'ecriture'), rows);
  await addPerson(frame, '@editeurs', t('share.cat.editeurs').slice(0, 4));
  rows = await shares(run);
  check('la catégorie « les éditeurs » s\'ajoute', rows.some(row => row[1] === '@editeurs'), rows);
  await shot(frame, '8-liste');
  const gone = frame.locator('.mod.sh .rr[data-share]').filter({ hasText: VIEWER }).locator('button.lvl');
  await gone.click();
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.remove')}`) }).click();
  await frame.waitForFunction(who => ![...document.querySelectorAll('.mod.sh .rr[data-share]')].some(node => node.textContent.includes(who)), VIEWER, { timeout: 15000 });
  rows = await shares(run);
  check('retirer une ligne l\'enlève de la table', !rows.some(row => row[1] === VIEWER) && rows.some(row => row[1] === '@editeurs'), rows);
  await addPerson(frame, VIEWER);
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId }));
}

async function playEditor(run) {
  const { page, frame } = run;
  say('--- éditeur : son PDF, celui du propriétaire ---');
  run.mine = pdfFile('Contrat.pdf', 1, 'Contrat');
  await importPdf(page, frame, run.mine.file);
  const list = await waitForNames(frame, ['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  say('   la phrase de GFS :', await frame.locator('#toast').textContent(), '| console :', JSON.stringify(run.problems.slice(-3)));
  check('il voit son PDF et ceux que « tous » ouvre', JSON.stringify(list) === JSON.stringify(['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']), list);
  await openShareFor(frame, 'Contrat.pdf');
  check('auteur de son fichier, il peut ajouter quelqu\'un', (await frame.locator('[data-fk="share-add"]').count()) === 1 && (await frame.locator('[data-fixed="author"]').count()) === 1);
  await shot(frame, '9-editeur-auteur');
  await addPerson(frame, VIEWER);
  const rows = await run.rest.rows('GFS_Partages').catch(() => []);
  check('son partage est écrit sans propriétaire, avec son nom pour auteur', rows.some(row => row.Personne === VIEWER && row.Auteur === 'editor@example.com'), rows.map(row => [row.Cible, row.Personne, row.Auteur]));
  await closeShare(frame);
  await openShareFor(frame, 'Facture.pdf');
  check('sur le PDF du propriétaire : rien à ajouter, la fenêtre le dit', (await frame.locator('[data-fk="share-add"]').count()) === 0 && (await frame.locator('[data-fk="share-readonly"]').count()) === 1, await panel(frame));
  check('il voit à qui le PDF est ouvert (la ligne « tous »), sans pouvoir la changer', (await frame.locator('.mod.sh .rr[data-share]').count()) >= 1 && (await frame.locator('.mod.sh .rr[data-share] button.lvl[aria-disabled="true"]').count()) >= 1, await panel(frame));
  await shot(frame, '10-editeur-lecture');
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  const { frame } = run;
  say('--- lecteur ---');
  const list = await waitForNames(frame, ['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']);
  check('il voit son partage et ceux de « tous »', JSON.stringify(list) === JSON.stringify(['Contrat.pdf', 'Devis.pdf', 'Facture.pdf']), list);
  await openShareFor(frame, 'Contrat.pdf');
  check('il lit la fenêtre sans rien pouvoir changer', (await frame.locator('[data-fk="share-add"]').count()) === 0 && (await frame.locator('[data-fk="share-readonly"]').count()) === 1, await panel(frame));
  await shot(frame, '11-lecteur');
  await closeShare(frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang });
    const { shareWithEditorAndViewer } = await import('./lab-droits.mjs');
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
