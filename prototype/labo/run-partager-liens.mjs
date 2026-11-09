// Les documents reliés (« Partager > Dans un autre document Grist », « Gérer les partages > Autres documents » ; maquette et go du porteur, 09/11) : leur vie entière, jouée dans GFS lui-même, dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), à 700 × 400, à la vraie souris. Le premier document est celui de la personne (tout passe par les fenêtres de GFS) ; le second est piloté par
// l'essai avec les fonctions du moteur (le côté qui reçoit n'a pas encore d'écran dans GFS) et reçoit toujours « en archive ».
//   1. « Une copie qui se met à jour » de Facture : le lien reste après l'envoi (un webhook, la table technique) et le fichier arrive chez l'autre ;
//   2. l'onglet montre le document relié avec le niveau de CHAQUE fichier : Facture « Copie à jour », Devis « Pas partagé » ;
//   3. Devis passe à « Copie à jour » par le menu : il arrive chez l'autre SANS nouveau code ;
//   4. « Arrêter la copie » de Devis : il sort du partage, la copie reste chez l'autre (archive) ;
//   5. « Une copie, une fois » de Devis : il repart, puis sort de la condition tout seul ; la copie reste ;
//   6. « Gérer les partages > Autres documents » : le lien est listé, « Arrêter » demande une confirmation, puis plus de webhook ni de table technique chez l'envoyeur ; les PDF restent chez l'autre.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-partager-liens.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, formLink } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `liens-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const webhooks = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}/webhooks`)).json()).webhooks.length, docId);
const closeAll = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').first().waitFor({ state: 'detached' }).catch(() => {}); };

// « Partager… » d'un fichier, l'onglet « Dans un autre document Grist » ouvert, ses liens lus.
async function openTab(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  await frame.locator('[data-fk="share-tab-other"]').click();
  await frame.locator('[data-fk="other-new"]').waitFor();
  await frame.waitForFunction(loading => !document.querySelector('.mod.sh .sh-body').textContent.includes(loading), t('so.tab.loading'));
}
const level = async frame => (await frame.locator('.mod.sh .rr[data-link]').first().getAttribute('data-level'));
async function pickLevel(frame, label) {
  await frame.locator('.mod.sh .rr[data-link] .lvl').first().click();
  await frame.locator('.menu .menu-item', { hasText: label }).click();
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  const { page, frame } = source;
  await importSamples(source);
  const devisId = (await source.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Devis.pdf').Identifiant;
  const target = await openGfs(context, { lang });
  await startEngine(target.frame);
  // Un passage du côté qui reçoit (la boucle du moteur : ce que GFS fera de lui-même à l'ouverture d'une page) ; l'envoyeur, lui, est GFS, qui rattrape tout seul.
  const pass = async () => {
    await target.frame.evaluate(() => window.__s.consolidateAll({ reread: true }));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 60) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await page.waitForTimeout(1500); } return rows; };
  const has = (rows, name) => rows.some(row => row.Nom === name && row.Contenu);

  say('--- 1. une copie qui se met à jour : le lien reste après l\'envoi ---');
  await openTab(frame, 'Facture.pdf');
  await frame.locator('[data-fk="other-new"]').click();
  await frame.locator('[data-fk="so-mode-live"]').click();
  await frame.locator('[data-fk="so-continue"]').click();
  await frame.locator('[data-fk="so-code"]').waitFor();
  const code = await frame.locator('[data-fk="so-code"]').inputValue();
  const invitation = await target.frame.evaluate(value => window.__try(() => window.__s.readInvitation(value)), code);
  const made = await target.frame.evaluate(invite => window.__try(async () => {
    const reception = await window.__s.createReception(invite, invite.tables.map(tb => ({ tb, dest: 'GFS_Recus' })), { reserve: true, options: { archive: true } });
    return { journal: reception.journal, note: reception.note };
  }), invitation.value);
  check('l\'autre document lit l\'invitation et crée sa réception (en archive)', invitation.ok && made.ok, { invitation, made });
  const { link } = await formLink(target);
  const replied = await target.frame.evaluate(args => window.__try(() => window.__s.receptionReply(args.made, args.link)), { made: made.value, link });
  await frame.locator('[data-fk="so-reply"]').click();
  await page.keyboard.insertText(replied.value.code);
  await frame.locator('[data-fk="so-check"]').click();
  await frame.locator('[data-fk="so-control"]').waitFor({ timeout: 20000 });
  await frame.locator('[data-fk="so-send"]').click();
  const done = async () => { for (let i = 0; i < 120; i++) { if ((await text(frame, '.mod.so')).includes(t('so.done.live.hint'))) return true; await page.waitForTimeout(1000); } return false; };
  check('la fenêtre dit que le lien reste', await done(), await text(frame, '.mod.so'));
  await shot(frame, '1-fini');
  check('le lien reste chez l\'envoyeur : un webhook et la table technique', (await webhooks(source)) === 1 && (await source.rest.tables()).includes('GFS_Synchro'), { hooks: await webhooks(source), tables: await source.rest.tables() });
  let rows = await until(rows => has(rows, 'Facture.pdf'));
  check('Facture est chez l\'autre, avec son contenu, et elle seule', has(rows, 'Facture.pdf') && rows.length === 1, rows.map(row => row.Nom));
  await frame.locator('[data-fk="so-close"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await closeAll(page, frame);

  say('--- 2. le niveau de chaque fichier ---');
  await openTab(frame, 'Facture.pdf');
  check('l\'onglet liste le document relié, Facture « Copie à jour »', (await frame.locator('.mod.sh .rr[data-link]').count()) === 1 && (await level(frame)) === 'live' && (await text(frame, '.mod.sh .rr[data-link] .lvl')).includes(t('so.level.live')), await text(frame, '.mod.sh'));
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(frame, '.mod.sh'), await contrastProblems(frame, '.mod.sh'));
  await shot(frame, '2-onglet-facture');
  await closeAll(page, frame);
  await openTab(frame, 'Devis.pdf');
  check('Devis est « Pas partagé » chez le même document', (await level(frame)) === 'none' && (await text(frame, '.mod.sh .rr[data-link] .lvl')).includes(t('so.level.none')), await text(frame, '.mod.sh'));
  await shot(frame, '3-onglet-devis');

  say('--- 3. Devis passe à « Copie à jour » : il arrive sans nouveau code ---');
  await pickLevel(frame, t('so.level.live'));
  await frame.waitForFunction(() => document.querySelector('.mod.sh .rr[data-link]').dataset.level === 'live', null, { timeout: 30000 });
  check('aucune fenêtre d\'envoi ne s\'est ouverte (pas de nouveau code)', (await frame.locator('.mod.so').count()) === 0);
  rows = await until(rows => has(rows, 'Devis.pdf'));
  check('Devis est arrivé chez l\'autre avec son contenu', has(rows, 'Devis.pdf'), rows.map(row => row.Nom));

  say('--- 4. « Arrêter la copie » : le fichier sort du partage, la copie reste ---');
  await pickLevel(frame, t('so.level.stop'));
  await frame.waitForFunction(() => document.querySelector('.mod.sh .rr[data-link]').dataset.level === 'none', null, { timeout: 30000 });
  rows = await until(() => false, 6);
  check('Devis est resté chez l\'autre, avec son contenu (réception en archive)', has(rows, 'Devis.pdf') && rows.filter(row => row.Nom === 'Devis.pdf').length === 1, rows.map(row => row.Nom));

  say('--- 5. « Une copie, une fois » : il repart puis sort tout seul ---');
  await pickLevel(frame, t('so.level.once'));
  let said = '';
  for (let i = 0; i < 40 && !said.includes('Devis'); i += 1) { said = `${await text(frame, '.mod.sh .mod-note')} ${await frame.locator('#toast').textContent()}`; if (!said.includes('Devis')) await page.waitForTimeout(250); }
  check('un avis dit que le fichier part (dans la fenêtre) ou qu\'il est arrivé (par l\'avis hors fenêtre)', said.includes('Devis'), said);
  rows = await until(() => false, 8);
  let gone = false;
  for (let i = 0; i < 40 && !gone; i += 1) {
    await closeAll(page, frame);
    await openTab(frame, 'Devis.pdf');
    gone = (await level(frame)) === 'none';
    if (!gone) await page.waitForTimeout(1500);
  }
  rows = await until(() => false, 4);
  check('Devis est sorti de la condition tout seul, et reste chez l\'autre', gone && has(rows, 'Devis.pdf'), { gone, rows: rows.map(row => row.Nom) });
  await closeAll(page, frame);

  say('--- 6. « Gérer les partages > Autres documents » ---');
  await openTab(frame, 'Facture.pdf');
  await frame.locator('[data-fk="share-manage"]').click();
  await frame.locator('.mod.mg [data-fk="manage-tab-other"]').click();
  await frame.locator('.mod.mg .rr[data-link]').waitFor();
  check('le lien est listé avec son document, son état et « Arrêter »', (await frame.locator('.mod.mg .rr[data-link]').count()) === 1 && (await text(frame, '.mod.mg .rr[data-link]')).includes(t('manage.other.stop')), await text(frame, '.mod.mg'));
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(frame, '.mod.mg'), await contrastProblems(frame, '.mod.mg'));
  await shot(frame, '4-gerer-autres');
  await frame.locator('.mod.mg [data-fk^="manage-other-stop-"]').click();
  await frame.locator('[data-fk="ask-no"]').waitFor();
  check('« Arrêter » demande d\'abord, le clavier sur « Annuler »', (await text(frame, '.mod.ask')).includes(t('manage.other.stop.message')) && (await frame.evaluate(() => document.activeElement.dataset.fk)) === 'ask-no', await text(frame, '.mod.ask'));
  await shot(frame, '5-question');
  await frame.locator('[data-fk="ask-no"]').click();
  check('« Annuler » n\'arrête rien', (await webhooks(source)) === 1 && (await source.rest.tables()).includes('GFS_Synchro'));
  await frame.locator('.mod.mg [data-fk^="manage-other-stop-"]').click();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.locator('.mod.mg .rt-none').filter({ hasText: t('manage.other.none') }).waitFor({ timeout: 30000 });
  let ended = false;
  for (let i = 0; i < 30 && !ended; i += 1) { ended = (await webhooks(source)) === 0 && !(await source.rest.tables()).includes('GFS_Synchro'); if (!ended) await page.waitForTimeout(1000); }
  check('plus de webhook ni de table technique chez l\'envoyeur', ended, { hooks: await webhooks(source), tables: await source.rest.tables() });
  rows = await until(() => false, 3);
  check('les deux PDF restent chez l\'autre', has(rows, 'Facture.pdf') && has(rows, 'Devis.pdf'), rows.map(row => row.Nom));
  check('les deux PDF de l\'envoyeur sont intacts', (await source.rest.rows('GFS_Fichiers')).map(row => row.Nom).sort().join() === 'Devis.pdf,Facture.pdf');
  await closeAll(page, frame);
  await closeAll(page, frame);
  check('aucune erreur de GFS dans la console', unexpected(source).length === 0 && unexpected(target).length === 0, [...unexpected(source), ...unexpected(target)]);
} finally {
  await browser.close();
  pages.close();
}
