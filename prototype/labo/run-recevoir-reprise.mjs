// La réception d'un partage quand Grist RECHARGE LA PAGE pendant que la fenêtre attend le lien du formulaire (retour du porteur du 25/11, docs.getgrist.com, Firefox : « quand on publie le
// formulaire, Grist recharge la page ; au retour dans GFS, la fenêtre qui attend le lien ne se rouvre pas, et le parcours repart du début »). Dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, dans GFS lui-même, des DEUX côtés ; le rechargement est celui du navigateur (`page.reload()`).
//   1. « Accepter » crée le journal et GFS_Received et note dans le journal que la réception attend la réponse ; la page est rechargée ;
//   2. au retour, la fenêtre se rouvre d'elle-même sur le lien du formulaire, dit que Grist a rechargé la page, sans redemander le code ; le lien collé donne la réponse et le même code de contrôle ;
//      l'envoyeur colle la réponse, envoie, et le fichier arrive dans GFS_Received ; la note « en attente » est effacée ;
//   3. une page rechargée ensuite ne rouvre rien (la réception est faite) ;
//   4. une seconde réception : après le rechargement, « Annuler » défait le journal et sa table, et la page rechargée ensuite ne rouvre rien non plus.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-recevoir-reprise.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, formLink, sendComparing } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `recevoir-reprise-${lang}-${scheme}-${name}`);
const RACE = /KeyError 'GFS_Synchro'/; // connu (faits vérifiés 71), relevé et non compté
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !RACE.test(problem));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const journalsOf = async run => (await run.rest.tables()).filter(name => /^GFS_Journal_/.test(name));
// La note du journal, telle que le moteur la garde : sa dernière ligne (colonne `Synchro_Ids`, options), où GFS note « en attente de la réponse » (`gfsAwaiting`).
const awaiting = run => run.page.evaluate(async doc => {
  const read = async table => (await (await fetch(`/api/docs/${doc}/tables/${table}/records`)).json()).records.map(row => ({ id: row.id, ...row.fields }));
  const columns = await read('_grist_Tables_column');
  return columns.filter(column => column.colId === 'Synchro_Ids' && /gfsAwaiting/.test(column.widgetOptions || '')).length;
}, run.docId).catch(() => -1);

// Le code de l'envoyeur pour le fichier `rowName`, puis la fenêtre de la réception ouverte sur le code et le code collé jusqu'à l'accord.
async function codeOf(source, rowName) {
  await openRowMenu(source.frame, rowName);
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('.mod.sh .rt-content').waitFor();
  await source.frame.locator('[data-fk="share-tab-other"]').click();
  await source.frame.locator('[data-fk="other-new"]').click();
  await source.frame.locator('[data-fk="so-continue"]').click();
  await source.frame.locator('[data-fk="so-code"]').waitFor();
  return source.frame.locator('[data-fk="so-code"]').inputValue();
}
async function acceptCode(target, code) {
  const { frame, page } = target;
  await frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await frame.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  await frame.locator('.menu-sub').getByRole('menuitem', { name: new RegExp(`^${t('sr.entry').replace('…', '')}`) }).click();
  await frame.locator('.mod.so [data-fk="sr-invite"]').click();
  await page.keyboard.insertText(code);
  await frame.locator('[data-fk="sr-continue"]').click();
  await frame.locator('[data-fk="sr-accept"]').waitFor({ timeout: 20000 });
  await frame.locator('[data-fk="sr-accept"]').click();
  await frame.locator('[data-fk="sr-link"]').waitFor({ timeout: 30000 });
}
// Le cadre de GFS tel que la page l'a en ce moment (Grist peut recharger la page deux fois : la publication du formulaire, puis la pose des règles du journal).
const currentFrame = run => run.page.frames().find(each => /\/prototype\/index\.html/.test(each.url()) && /access=full/.test(each.url()));
// Grist recharge la page (publier le formulaire) : l'essai la recharge, puis cherche la fenêtre de la réception dans le cadre du moment ; `key` : le champ qu'elle doit montrer.
// Rend vrai quand il est là. (`gfsFrame` ferme les fenêtres ouvertes par Échap : il défairait la réception qu'on veut voir reprise.)
async function reloadAndFind(run, key) {
  await run.page.reload();
  for (let i = 0; i < 160; i += 1) {
    const frame = currentFrame(run);
    if (frame && (await frame.locator(`.mod.so [data-fk="${key}"]`).count().catch(() => 0))) { run.frame = frame; return true; }
    await run.page.waitForTimeout(500);
  }
  return false;
}
// La page rechargée, rien ne doit s'ouvrir : on attend que GFS soit prêt, puis un moment de plus (la reprise du partage se joue juste après).
async function reloadAndWait(run) {
  await run.page.reload();
  let frame;
  for (let i = 0; i < 120 && !frame; i += 1) {
    const found = currentFrame(run);
    if (found && (await found.evaluate(() => document.body.dataset.gfs === 'ready').catch(() => false))) frame = found;
    else await run.page.waitForTimeout(500);
  }
  await run.page.waitForTimeout(12000);
  run.frame = currentFrame(run) || frame;
  return run.frame;
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  await importSamples(source);
  const target = await openGfs(context, { lang });

  say('--- 1. accepter, puis Grist recharge la page pendant que la fenêtre attend le lien ---');
  await acceptCode(target, await codeOf(source, 'Facture.pdf'));
  const journal = (await journalsOf(target))[0];
  check('le journal et GFS_Received sont créés', Boolean(journal) && (await target.rest.tables()).includes('GFS_Received'), await target.rest.tables());
  check('le journal note que la réception attend la réponse', (await awaiting(target)) >= 1, await awaiting(target));
  const found = await reloadAndFind(target, 'sr-link');

  say('--- 2. au retour, la fenêtre se rouvre sur le lien, sans redemander le code ---');
  check('la page rechargée, la fenêtre de la réception se rouvre d\'elle-même', found);
  const reopened = await text(target.frame, '.mod.so');
  check('la fenêtre est sur le lien du formulaire, pas sur le code à coller', (await target.frame.locator('[data-fk="sr-invite"]').count()) === 0 && reopened.includes(journal), reopened);
  check('elle dit que Grist a rechargé la page et que la réception reprend ici', reopened.includes(t('sr.link.resumed', { name: '\u0000' }).split('\u0000')[0]), reopened);
  check('le clavier est sur le champ du lien, la fenêtre tient dans le panneau, contraste de 4,5:1', (await target.frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk)) === 'sr-link' && await fits(target.frame, '.mod.so'),
    await contrastProblems(target.frame, '.mod.so'));
  await shot(target.frame, '1-reprise');
  await startEngine(target.frame); // l'essai lit la clé du formulaire
  const { link } = await formLink(target);
  await target.frame.locator('[data-fk="sr-link"]').click();
  await target.page.keyboard.insertText(link);
  await target.frame.locator('[data-fk="sr-check"]').click();
  await target.frame.locator('[data-fk="sr-control"]').waitFor({ timeout: 30000 });
  const reply = await target.frame.locator('[data-fk="sr-code"]').inputValue();
  const control = await target.frame.locator('[data-fk="sr-control"]').innerText();
  check('le lien collé donne la réponse et son code de contrôle', /^GRISTSYNC2\./.test(reply) && /\S/.test(control), { reply: reply.slice(0, 20), control });
  await source.frame.locator('[data-fk="so-reply"]').click();
  await source.page.keyboard.insertText(reply);
  await source.frame.locator('[data-fk="so-check"]').click();
  await source.frame.locator('[data-fk="so-control"]').waitFor({ timeout: 30000 });
  check('le même code de contrôle chez l\'envoyeur', (await source.frame.locator('[data-fk="so-control"]').innerText()) === control, control);
  await sendComparing(source.frame);
  let rows = [];
  for (let i = 0; i < 120 && !rows.some(row => row.Name === 'Facture.pdf' && row.Content); i += 1) { rows = await target.rest.rows('GFS_Received').catch(() => []); if (!rows.some(row => row.Content)) await target.page.waitForTimeout(1000); }
  check('le fichier arrive dans GFS_Received, avec son contenu', rows.some(row => row.Name === 'Facture.pdf' && row.Content), rows.map(row => row.Name));
  check('la note « en attente » est effacée du journal', (await awaiting(target)) === 0, await awaiting(target));
  await target.frame.locator('[data-fk="so-close"]').click();
  await source.frame.locator('[data-fk="so-close"]').click().catch(() => {});

  say('--- 3. une page rechargée ensuite ne rouvre rien ---');
  await reloadAndWait(target);
  check('aucune fenêtre ne se rouvre, la réception est faite', (await target.frame.locator('.mod.so').count()) === 0 && (await target.frame.locator('.mod-scrim').count()) === 0);

  say('--- 4. une seconde réception : « Annuler » après le rechargement la défait ---');
  await source.page.keyboard.press('Escape');
  const before = await journalsOf(target);
  await acceptCode(target, await codeOf(source, 'Devis.pdf'));
  check('un second journal et GFS_Received_2 sont créés', (await journalsOf(target)).length === before.length + 1 && (await target.rest.tables()).includes('GFS_Received_2'), await target.rest.tables());
  const again = await reloadAndFind(target, 'sr-link');
  check('la fenêtre se rouvre sur le lien de la seconde réception', again);
  check('et ne redemande pas le code', (await target.frame.locator('[data-fk="sr-invite"]').count()) === 0);
  await target.frame.locator('[data-fk="so-cancel"]').click();
  await target.frame.locator('.mod.so').waitFor({ state: 'detached' });
  let undone = false;
  for (let i = 0; i < 40 && !undone; i += 1) { undone = (await journalsOf(target)).length === before.length && !(await target.rest.tables()).includes('GFS_Received_2'); if (!undone) await target.page.waitForTimeout(500); }
  check('« Annuler » défait le second journal et GFS_Received_2 ; la première réception reste', undone && (await target.rest.tables()).includes('GFS_Received') && (await target.rest.rows('GFS_Received')).length === 1, await target.rest.tables());
  await reloadAndWait(target);
  check('la page rechargée ensuite ne rouvre rien', (await target.frame.locator('.mod.so').count()) === 0);
  check('aucune erreur de GFS dans la console', unexpected(source).length === 0 && unexpected(target).length === 0, { source: unexpected(source).map(each => each.slice(0, 160)), target: unexpected(target).map(each => each.slice(0, 160)) });
} finally {
  await browser.close();
  pages.close();
}
