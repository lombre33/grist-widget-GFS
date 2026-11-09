// Relier deux documents SANS fichier (09/11, le modèle en deux étapes du porteur : 1. le setup qui lie les deux GFS, avec ou sans fichier ; 2. les partages par fichier ensuite), dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, des DEUX côtés, dans GFS lui-même :
//   1. « Gérer les partages > Autres documents > Relier un document… » ouvre la fenêtre du lien, sans choix « une fois / à jour » (le lien reste) ; code, réception par « Nouveau > Importer », réponse, même code de contrôle ;
//   2. aucun fichier ne part (la condition nomme l'identifiant fictif de GFS) : la table reçue reste vide ; le lien, lui, est là (un webhook, la liste « Autres documents ») ;
//   3. ensuite, « Partager » un fichier : le niveau « Copie à jour » le fait arriver chez l'autre SANS nouveau code (la boucle de réception de l'autre est partie à sa réponse).
//   LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-relier-sans-fichier.mjs
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
const shot = (frame, name) => pdfShot(frame, `relier-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const webhooks = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}/webhooks`)).json()).webhooks.length, docId);
const closeAll = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').first().waitFor({ state: 'detached' }).catch(() => {}); };
const paste = async (page, frame, key, value) => { await frame.locator(`[data-fk="${key}"]`).click(); await page.keyboard.insertText(value); };

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  await importSamples(source);
  const target = await openGfs(context, { lang });
  await startEngine(target.frame); // l'essai lit la clé du formulaire ; la fenêtre, elle, charge le moteur de GFS à la demande

  say('--- 1. « Gérer les partages > Autres documents > Relier un document… » ---');
  await openRowMenu(source.frame, 'Facture.pdf');
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('.mod.sh .rt-content').waitFor();
  await source.frame.locator('[data-fk="share-manage"]').click();
  await source.frame.locator('.mod.mg [data-fk="manage-tab-other"]').click();
  await source.frame.locator('.mod.mg [data-fk="manage-other-new"]').waitFor();
  check('l\'onglet « Autres documents » propose « Relier un document… », sans lien pour l\'instant', (await text(source.frame, '.mod.mg')).includes(t('manage.other.none')) && (await text(source.frame, '.mod.mg [data-fk="manage-other-new"]')) === t('manage.other.new'), await text(source.frame, '.mod.mg'));
  await shot(source.frame, '1-gerer');
  await source.frame.locator('.mod.mg [data-fk="manage-other-new"]').click();
  await source.frame.locator('.mod.so [data-fk="so-continue"]').waitFor();
  const accord = await text(source.frame, '.mod.so');
  check('la fenêtre dit « relier » (jamais le nom d\'un fichier), sans choix une fois / à jour, et que rien n\'est envoyé maintenant', accord.includes(t('so.title.link')) && accord.includes('Rien n’est envoyé maintenant'.replace('Rien n’est envoyé maintenant', lang === 'fr' ? 'Rien n’est envoyé maintenant' : 'Nothing is sent now')) && (await source.frame.locator('[data-fk^="so-mode-"]').count()) === 0, accord);
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(source.frame, '.mod.so'), await contrastProblems(source.frame, '.mod.so'));
  await shot(source.frame, '2-accord');
  await source.frame.locator('[data-fk="so-continue"]').click();
  await source.frame.locator('[data-fk="so-code"]').waitFor({ timeout: 30000 });
  const code = await source.frame.locator('[data-fk="so-code"]').inputValue();

  say('--- 2. l\'autre document reçoit par « Nouveau > Importer » ---');
  await target.frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await target.frame.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  await target.frame.locator('.menu-sub').getByRole('menuitem', { name: new RegExp(`^${t('sr.entry').replace('…', '')}`) }).click();
  await paste(target.page, target.frame, 'sr-invite', code);
  await target.frame.locator('[data-fk="sr-continue"]').click();
  await target.frame.locator('[data-fk="sr-accept"]').waitFor({ timeout: 20000 });
  await target.frame.locator('[data-fk="sr-accept"]').click();
  await target.frame.locator('[data-fk="sr-link"]').waitFor({ timeout: 30000 });
  const { link } = await formLink(target);
  await paste(target.page, target.frame, 'sr-link', link);
  await target.frame.locator('[data-fk="sr-check"]').click();
  await target.frame.locator('[data-fk="sr-control"]').waitFor({ timeout: 30000 });
  const reply = await target.frame.locator('[data-fk="sr-code"]').inputValue();
  const control = await target.frame.locator('[data-fk="sr-control"]').innerText();
  await paste(source.page, source.frame, 'so-reply', reply);
  await source.frame.locator('[data-fk="so-check"]').click();
  await source.frame.locator('[data-fk="so-control"]').waitFor({ timeout: 30000 });
  check('le même code de contrôle des deux côtés', (await source.frame.locator('[data-fk="so-control"]').innerText()) === control, control);
  await source.frame.locator('[data-fk="so-send"]').click();
  let done = false;
  for (let i = 0; i < 120 && !done; i += 1) { done = (await text(source.frame, '.mod.so')).includes(t('so.done.link.hint')); if (!done) await source.page.waitForTimeout(1000); }
  check('la fenêtre dit que les documents sont reliés et que rien n\'est parti', done, await text(source.frame, '.mod.so'));
  await shot(source.frame, '3-relie');
  await source.frame.locator('[data-fk="so-close"]').click();
  await source.frame.locator('.mod.so').waitFor({ state: 'detached' });
  await target.frame.locator('[data-fk="so-close"]').click();
  await target.frame.locator('.mod.so').waitFor({ state: 'detached' });

  say('--- 3. le lien est là, aucun fichier n\'est parti ---');
  await source.frame.locator('.mod.mg .rr[data-link]').waitFor({ timeout: 20000 });
  check('« Autres documents » liste le lien (un webhook chez l\'envoyeur)', (await webhooks(source)) === 1, await text(source.frame, '.mod.mg'));
  await source.page.waitForTimeout(6000);
  const none = await target.rest.rows('GFS_Recus');
  check('la table reçue existe et reste vide : aucun fichier n\'est parti (la condition nomme l\'identifiant fictif de GFS)', (await target.rest.tables()).includes('GFS_Recus') && none.length === 0, none.map(row => row.Nom));
  await closeAll(source.page, source.frame);
  await closeAll(source.page, source.frame);

  say('--- 4. ensuite, un fichier se partage sans nouveau code ---');
  await openRowMenu(source.frame, 'Facture.pdf');
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('.mod.sh .rt-content').waitFor();
  await source.frame.locator('[data-fk="share-tab-other"]').click();
  await source.frame.locator('.mod.sh .rr[data-link]').waitFor({ timeout: 20000 });
  check('l\'onglet de « Partager » liste le document relié, Facture « Pas partagé »', (await source.frame.locator('.mod.sh .rr[data-link]').first().getAttribute('data-level')) === 'none', await text(source.frame, '.mod.sh'));
  await source.frame.locator('.mod.sh .rr[data-link] .lvl').first().click();
  await source.frame.locator('.menu .menu-item', { hasText: t('so.level.live') }).click();
  let rows = [];
  for (let i = 0; i < 90 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i += 1) { rows = await target.rest.rows('GFS_Recus'); if (!rows.some(row => row.Contenu)) await source.page.waitForTimeout(1500); }
  check('Facture arrive chez l\'autre, avec son contenu, sans nouvelle fenêtre d\'envoi ni nouveau code, et sans autre geste de l\'essai', rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu) && (await source.frame.locator('.mod.so').count()) === 0, rows.map(row => row.Nom));
  check('aucune erreur de GFS dans la console, des deux côtés', unexpected(source).length === 0 && unexpected(target).length === 0, [...unexpected(source), ...unexpected(target)]);
} finally {
  await browser.close();
  pages.close();
}
