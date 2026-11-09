// « Nouveau > Importer > D'un autre document Grist… » : la réception d'un partage (js/share-receive-window.js), jouée de bout en bout dans GFS lui-même, des DEUX côtés, dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`), à 700 × 400, à la vraie souris : le premier document envoie par « Partager > Dans un autre document Grist », le second reçoit par « Importer ».
// Seul le lien du formulaire (que Grist ne donne pas à un widget : sa clé se lit dans la base du serveur d'essai) est lu par l'essai, à la place de la personne qui le copie dans Grist.
//   1. « D'un autre document Grist… » est dans le sous-menu « Importer » ; rien n'est écrit avant l'accord, Échap n'écrit rien ; un code qui n'en est pas un est refusé par le moteur ;
//   2. l'accord dit ce que GFS ajoute (la table GFS_Recus, un journal) ; « Accepter » crée le journal et sa page de formulaire ; un lien qui n'écrit pas dans ce journal est refusé, la fenêtre reste où elle est ;
//   3. la réponse et le code de contrôle s'affichent ; l'envoyeur colle la réponse : le MÊME code de contrôle chez lui ; il envoie ; le fichier arrive dans GFS_Recus (mêmes octets) sans autre geste de l'essai ;
//   4. fermer la fenêtre avant la réponse défait ce qui avait été créé (le journal, la page du formulaire).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-partager-recevoir.mjs
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
const shot = (frame, name) => pdfShot(frame, `recevoir-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');

async function openReceive(frame) {
  await frame.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await frame.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  await frame.locator('.menu-sub').getByRole('menuitem', { name: new RegExp(`^${t('sr.entry').replace('…', '')}`) }).click();
  await frame.locator('.mod.so [data-fk="sr-invite"]').waitFor();
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  await importSamples(source);
  const target = await openGfs(context, { lang });
  await startEngine(target.frame); // l'essai lit la clé du formulaire ; la fenêtre, elle, charge le moteur de GFS à la demande
  const { page: tpage, frame: tframe } = target;

  say('--- 1. l\'article, l\'accord, un code qui n\'en est pas un ---');
  await tframe.getByRole('button', { name: /^(Nouveau|New)$/ }).click();
  await tframe.getByRole('menuitem', { name: /^(Importer|Import)/ }).click();
  const entry = tframe.locator('.menu-sub').getByRole('menuitem', { name: new RegExp(`^${t('sr.entry').replace('…', '')}`) });
  check('« D\'un autre document Grist… » est dans le sous-menu « Importer », dégrisé pour le propriétaire', (await entry.count()) === 1 && (await entry.getAttribute('aria-disabled')) !== 'true', await tframe.locator('.menu-sub').innerText());
  await entry.click();
  await tframe.locator('.mod.so [data-fk="sr-invite"]').waitFor();
  check('la fenêtre dit où coller le code, « Continuer » est grisé', (await tframe.locator('[data-fk="sr-continue"]').getAttribute('aria-disabled')) === 'true' && (await text(tframe, '.mod.so')).includes(t('sr.paste.hint')), await text(tframe, '.mod.so'));
  check('la fenêtre tient dans le panneau, boutons visibles, contraste de 4,5:1', await fits(tframe, '.mod.so'), await contrastProblems(tframe, '.mod.so'));
  await shot(tframe, '1-coller');
  await tframe.locator('[data-fk="sr-invite"]').click();
  await tpage.keyboard.insertText('GRISTSYNC2.pasuncode');
  await tframe.locator('[data-fk="sr-continue"]').click();
  await tframe.waitForFunction(() => /./.test(document.querySelector('.mod.so .mod-note').textContent) && document.querySelector('[data-fk="sr-invite"]'), null, { timeout: 15000 });
  check('un code qui n\'en est pas un est refusé par le moteur, la fenêtre reste où elle est', (await tframe.locator('[data-fk="sr-invite"]').count()) === 1 && /./.test(await text(tframe, '.mod.so .mod-note')), await text(tframe, '.mod.so .mod-note'));
  await tpage.keyboard.press('Escape');
  await tframe.locator('.mod.so').waitFor({ state: 'detached' });
  check('Échap n\'écrit rien (ni journal ni GFS_Recus)', !(await target.rest.tables()).some(name => /^GFS_(Journal|Recus)/.test(name)), await target.rest.tables());

  say('--- 2. l\'envoyeur prépare, le receveur accepte ---');
  await openRowMenu(source.frame, 'Facture.pdf');
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('.mod.sh .rt-content').waitFor();
  await source.frame.locator('[data-fk="share-tab-other"]').click();
  await source.frame.locator('[data-fk="other-new"]').click();
  await source.frame.locator('[data-fk="so-continue"]').click();
  await source.frame.locator('[data-fk="so-code"]').waitFor();
  const code = await source.frame.locator('[data-fk="so-code"]').inputValue();
  await openReceive(tframe);
  await tframe.locator('[data-fk="sr-invite"]').click();
  await tpage.keyboard.insertText(code);
  await tframe.locator('[data-fk="sr-continue"]').click();
  await tframe.locator('[data-fk="sr-accept"]').waitFor({ timeout: 20000 });
  const accord = await text(tframe, '.mod.so');
  check('l\'accord dit ce que GFS ajoute (GFS_Recus, un journal) et que rien n\'est copié avant', accord.includes('GFS_Recus') && accord.toLowerCase().includes(t('sr.accord.adds').toLowerCase()), accord);
  check('rien n\'est écrit avant l\'accord', !(await target.rest.tables()).some(name => /^GFS_(Journal|Recus)/.test(name)), await target.rest.tables());
  check('la fenêtre de l\'accord tient dans le panneau', await fits(tframe, '.mod.so'), await contrastProblems(tframe, '.mod.so'));
  await shot(tframe, '2-accord');
  await tframe.locator('[data-fk="sr-accept"]').click();
  await tframe.locator('[data-fk="sr-link"]').waitFor({ timeout: 30000 });
  const journal = (await target.rest.tables()).find(name => /^GFS_Journal_/.test(name));
  check('le journal et GFS_Recus sont créés, la fenêtre dit quelle page ouvrir', Boolean(journal) && (await target.rest.tables()).includes('GFS_Recus') && (await text(tframe, '.mod.so')).includes(journal), { journal, text: await text(tframe, '.mod.so') });
  await shot(tframe, '3-lien');

  say('--- 3. le lien, la réponse, le contrôle, l\'envoi ---');
  await tframe.locator('[data-fk="sr-link"]').click();
  await tpage.keyboard.insertText('https://example.invalid/o/x/forms/abc/1');
  await tframe.locator('[data-fk="sr-check"]').click();
  await tframe.waitForFunction(() => /./.test(document.querySelector('.mod.so .mod-note').textContent) && document.querySelector('[data-fk="sr-link"]'), null, { timeout: 15000 });
  check('un lien qui n\'écrit pas dans ce journal est refusé, la fenêtre reste où elle est', (await tframe.locator('[data-fk="sr-link"]').count()) === 1 && /./.test(await text(tframe, '.mod.so .mod-note')), await text(tframe, '.mod.so .mod-note'));
  const { link } = await formLink(target);
  await tframe.locator('[data-fk="sr-link"]').fill('');
  await tframe.locator('[data-fk="sr-link"]').click();
  await tpage.keyboard.insertText(link);
  await tframe.locator('[data-fk="sr-check"]').click();
  await tframe.locator('[data-fk="sr-control"]').waitFor({ timeout: 30000 });
  const reply = await tframe.locator('[data-fk="sr-code"]').inputValue();
  const control = await tframe.locator('[data-fk="sr-control"]').innerText();
  check('la réponse et le code de contrôle s\'affichent', /^GRISTSYNC2\./.test(reply) && /\S/.test(control), { reply: reply.slice(0, 20), control });
  check('la fenêtre de la réponse tient dans le panneau', await fits(tframe, '.mod.so'), await contrastProblems(tframe, '.mod.so'));
  await shot(tframe, '4-reponse');
  await source.frame.locator('[data-fk="so-reply"]').click();
  await source.page.keyboard.insertText(reply);
  await source.frame.locator('[data-fk="so-check"]').click();
  await source.frame.locator('[data-fk="so-control"]').waitFor({ timeout: 30000 });
  check('le même code de contrôle chez l\'envoyeur', (await source.frame.locator('[data-fk="so-control"]').innerText()) === control, { sender: await source.frame.locator('[data-fk="so-control"]').innerText(), receiver: control });
  await source.frame.locator('[data-fk="so-send"]').click();
  let rows = [];
  for (let i = 0; i < 120 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i += 1) { rows = await target.rest.rows('GFS_Recus').catch(() => []); if (!rows.some(row => row.Contenu)) await tpage.waitForTimeout(1000); }
  const sent = (await source.rest.rows('GFS_Fichiers')).find(row => row.Identifiant === source.id);
  const was = await source.rest.attachment(sent.Contenu[1]);
  const now = rows[0] && rows[0].Contenu ? await target.rest.attachment(rows[0].Contenu[1]) : null;
  check('le fichier arrive dans GFS_Recus, mêmes octets, sans autre geste de l\'essai (la boucle de réception démarre à la réponse)', rows.length === 1 && Boolean(now) && now.hash === was.hash && now.size === was.size, { rows: rows.map(row => row.Nom), was, now });
  await tframe.locator('[data-fk="so-close"]').click();
  await tframe.locator('.mod.so').waitFor({ state: 'detached' });

  say('--- 4. fermer avant la réponse défait ce qui avait été créé ---');
  await source.frame.locator('[data-fk="so-close"]').click().catch(() => {});
  await source.page.keyboard.press('Escape');
  await source.page.keyboard.press('Escape');
  await openRowMenu(source.frame, 'Devis.pdf');
  await source.frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await source.frame.locator('[data-fk="share-tab-other"]').click();
  await source.frame.locator('[data-fk="other-new"]').click();
  await source.frame.locator('[data-fk="so-continue"]').click();
  await source.frame.locator('[data-fk="so-code"]').waitFor();
  const code2 = await source.frame.locator('[data-fk="so-code"]').inputValue();
  const journalsBefore = (await target.rest.tables()).filter(name => /^GFS_Journal_/.test(name));
  await openReceive(tframe);
  await tframe.locator('[data-fk="sr-invite"]').click();
  await tpage.keyboard.insertText(code2);
  await tframe.locator('[data-fk="sr-continue"]').click();
  await tframe.locator('[data-fk="sr-accept"]').waitFor({ timeout: 20000 });
  const second = await text(tframe, '.mod.so');
  await tframe.locator('[data-fk="sr-accept"]').click();
  await tframe.locator('[data-fk="sr-link"]').waitFor({ timeout: 30000 });
  check('un second partage reçoit dans sa propre table (une destination ne reçoit qu\'un partage) : l\'accord nomme GFS_Recus_2, le journal est créé', second.includes('GFS_Recus_2') && (await target.rest.tables()).includes('GFS_Recus_2'), await target.rest.tables());
  check('un second journal est créé', (await target.rest.tables()).filter(name => /^GFS_Journal_/.test(name)).length === journalsBefore.length + 1);
  await tframe.locator('[data-fk="so-cancel"]').click();
  await tframe.locator('.mod.so').waitFor({ state: 'detached' });
  let undone = false;
  for (let i = 0; i < 30 && !undone; i += 1) { undone = (await target.rest.tables()).filter(name => /^GFS_Journal_/.test(name)).length === journalsBefore.length; if (!undone) await tpage.waitForTimeout(500); }
  check('« Annuler » avant la réponse défait le second journal et GFS_Recus_2 ; GFS_Recus et la première réception restent', undone && (await target.rest.tables()).includes('GFS_Recus') && !(await target.rest.tables()).includes('GFS_Recus_2') && (await target.rest.rows('GFS_Recus')).length === 1, await target.rest.tables());
  check('aucune erreur de GFS dans la console', unexpected(source).length === 0 && unexpected(target).length === 0, [...unexpected(source), ...unexpected(target)]);
} finally {
  await browser.close();
  pages.close();
}
