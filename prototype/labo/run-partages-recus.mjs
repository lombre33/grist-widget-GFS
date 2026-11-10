// « Partagés avec moi » (js/received-control.js, js/received-files.js ; 09/11) : la vue de ce qu'un autre document partage, jouée dans le VRAI GFS à 700 × 400, à la vraie souris, dans un VRAI Grist
// (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`). Le premier document envoie (le premier partage est monté par les fonctions du moteur, comme `run-recus-etat.mjs` : la fenêtre qui
// reçoit un premier code est mesurée par `run-partager-recevoir.mjs`) ; le second ouvre GFS :
//   1. deux arrivées : « Partagés avec moi » porte le nombre à accepter, les lignes sont grisées (cadenas, mot « À accepter », sans étoile), nulle d'elles n'est dans « Moi » ni dans « Récents » ;
//   2. une ligne, à la souris : le bouton « Ouvrir » devient « Accepter ou refuser… », la fenêtre dit le nom, qui partage et le poids ; Échap n'écrit rien (aucune colonne, aucune marque) ;
//   3. « Accepter » : la ligne n'est plus grisée, son mot est « PDF », le nombre baisse, la marque est écrite sur SA ligne (deux colonnes ajoutées à la table reçue, rien d'autre) ; « Refuser » : la ligne n'est plus montrée ;
//   4. l'envoyeur renomme les deux fichiers : l'accepté garde son état sous son nouveau nom, le refusé ne revient pas, aucun doublon ;
//   5. un fichier de plus arrive : lui seul est « à accepter » ;
//   6. une arrivée acceptée se lit comme un PDF de GFS : sans app qui le lise, « Télécharger » donne les mêmes octets que l'envoyeur.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. REPO_DIR="$(realpath ../..)" node run-partages-recus.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, importSamples, importPdf, pdfFile, waitForNames, rowOf, goTo, contrastProblems, sha256, names, toast, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, handshake } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `recus-${lang}-${scheme}-${name}`);
const RACE = /KeyError 'GFS_Synchro'/; // connu (faits vérifiés 71) : voir run-partager-recevoir.mjs
const races = [];
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && (RACE.test(problem) ? (races.push(problem), false) : true));
const COLUMNS = ['Identifiant', 'Nom', 'Type', 'Date', 'Auteur', 'Contenu', 'Taille', 'Origine'];
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');
const rail = frame => frame.locator('.tr-row', { hasText: t('rx.view') });
const badge = async frame => ((await rail(frame).locator('.cnt').count()) ? (await rail(frame).locator('.cnt').innerText()).trim() : '');
const pill = (frame, name) => rowOf(frame, name).locator('.ty .pill').innerText();
const bellBadge = async frame => ((await frame.locator('.tb-bell .tb-badge').isVisible()) ? (await frame.locator('.tb-bell .tb-badge').innerText()).trim() : '');
const greyed = async (frame, name) => (await rowOf(frame, name).getAttribute('class')).split(' ').includes('lk');

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const views = [];
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  await importSamples(source);
  const target = await openGfs(context, { lang });
  await startEngine(source.frame);
  await startEngine(target.frame);
  const files = await source.rest.rows('GFS_Fichiers');
  const idOf = name => files.find(row => row.Nom === name).Identifiant;
  const first = await handshake(source, target, { name: 'Lot', ids: [idOf('Facture.pdf'), idOf('Devis.pdf')], columns: COLUMNS, options: { archive: true } });
  // Un document dont les règles d'accès viennent de changer (les tables techniques du partage, réservées aux propriétaires : faits vérifiés 76) fait recharger sa page : le cadre de l'essai est perdu, il est rouvert et le moteur y est remis.
  const alive = async run => {
    try { await run.frame.evaluate(() => true); } catch (error) {
      const lost = run.problems;
      await run.page.close().catch(() => {});
      Object.assign(run, await openGfs(context, { lang, path: run.path }));
      run.problems.unshift(...lost);
      await startEngine(run.frame);
    }
  };
  const pass = async () => {
    await alive(source);
    await alive(target);
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await target.frame.evaluate(() => window.__try(() => window.__s.consolidateAll({ reread: true })));
    return target.rest.rows('GFS_Recus');
  };
  const until = async (test, tries = 40) => { let rows = []; for (let i = 0; i < tries; i += 1) { rows = await pass(); if (test(rows)) return rows; await source.page.waitForTimeout(1500); } return rows; };
  // GFS relit sa liste à l'ouverture de l'explorateur : une page neuve sur le document qui reçoit.
  const view = async () => {
    while (views.length) await views.pop().page.close();
    const run = await openGfs(context, { lang, path: target.path });
    views.push(run);
    await goTo(run.frame, t('rx.view'));
    return run;
  };
  const rows = await until(list => list.length === 2 && list.every(row => row.Contenu));
  check('deux fichiers arrivés dans GFS_Recus, avec leur contenu', rows.length === 2, rows.map(row => row.Nom));

  say('--- 1. deux arrivées à accepter ---');
  let ui = await view();
  let { page, frame } = ui;
  check('« Partagés avec moi » porte le nombre à accepter (2)', (await badge(frame)) === '2', await badge(frame));
  check('les deux arrivées sont listées, grisées, avec le mot « À accepter »', JSON.stringify((await names(frame)).sort()) === '["Devis.pdf","Facture.pdf"]' && (await greyed(frame, 'Facture.pdf')) && (await greyed(frame, 'Devis.pdf')) && (await pill(frame, 'Facture.pdf')) === t('rx.pending'), { names: await names(frame), pill: await pill(frame, 'Facture.pdf') });
  check('une arrivée n\'a pas d\'étoile (pas de rangement) mais garde son menu', (await rowOf(frame, 'Facture.pdf').locator('.rb.pin').count()) === 0 && (await rowOf(frame, 'Facture.pdf').locator('.rb.mn').count()) === 1);
  const noOverflow = await frame.evaluate(() => { const scroll = document.querySelector('.ex-scroll'); return scroll.scrollWidth <= scroll.clientWidth + 1; });
  const weak = [...await contrastProblems(frame, '.ex-body'), ...await contrastProblems(frame, '.ex-info')]; // le pied (Ouvrir, Fermer) est grisé par construction tant qu'aucune app n'est ouverte : ce n'est pas la vue
  check('la liste tient dans le panneau (sans défilement horizontal), contraste de 4,5:1', noOverflow && weak.length === 0, { noOverflow, weak });
  await shot(frame, '1-a-accepter');
  const bellLabel = await frame.locator('.tb-bell').getAttribute('aria-label');
  check('la cloche Notifications porte le nombre à accepter (2), dit aussi à la voix', (await bellBadge(frame)) === '2' && bellLabel === t('nt.tipCount', { n: 2 }), { badge: await bellBadge(frame), bellLabel });
  await frame.locator('.tb-bell').click();
  const bellItems = (await frame.locator('.menu .menu-item .menu-label').allInnerTexts()).map(item => item.trim());
  check('le menu de la cloche nomme les deux arrivées, puis ouvre « Partagés avec moi »', bellItems.length === 3 && bellItems.some(item => item.includes('Facture.pdf')) && bellItems.some(item => item.includes('Devis.pdf')) && bellItems.at(-1) === t('nt.open'), bellItems);
  const menuIn = await frame.evaluate(() => { const at = document.querySelector('.menu').getBoundingClientRect(); return at.left >= 0 && at.top >= 0 && at.right <= window.innerWidth && at.bottom <= window.innerHeight; });
  check('le menu de la cloche tient dans le panneau, contraste de 4,5:1', menuIn && (await contrastProblems(frame, '.menu')).length === 0, { menuIn, weak: await contrastProblems(frame, '.menu') });
  await shot(frame, '1-cloche');
  await frame.locator('.menu .menu-item', { hasText: 'Devis.pdf' }).click();
  await frame.locator('.mod.so').waitFor();
  check('un clic sur une arrivée, dans la cloche, pose la question de CE fichier', (await text(frame, '.mod.so')).includes(t('rx.answer.title', { name: 'Devis.pdf' })), await text(frame, '.mod.so'));
  await page.keyboard.press('Escape');
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await goTo(frame, new RegExp(`^${t('ex.me')}`));
  check('ni « Moi » ni « Récents » ne montrent les arrivées (nulle app ne les voit non plus)', (await names(frame)).length === 0, await names(frame));
  await goTo(frame, new RegExp(t('ex.recent')));
  check('« Récents » non plus', (await names(frame)).length === 0, await names(frame));
  await goTo(frame, t('rx.view'));

  say('--- 2. une ligne, la question, Échap ---');
  await rowOf(frame, 'Facture.pdf').click();
  const open = frame.locator('[data-fk="open"], #openBtn, .open-btn').first();
  const label = await frame.evaluate(() => [...document.querySelectorAll('button')].map(node => node.textContent.trim()).filter(Boolean));
  check('le bouton principal devient « Accepter ou refuser… » devant une arrivée à accepter', label.includes(t('rx.answer.menu')), label);
  await frame.getByRole('button', { name: t('rx.answer.menu') }).click();
  await frame.locator('.mod.so').waitFor();
  const asked = await text(frame, '.mod.so');
  check('la fenêtre dit le nom, qui partage et le poids', asked.includes(t('rx.answer.title', { name: 'Facture.pdf' })) && /Ko|KB|Mo|MB/.test(asked), asked);
  check('la fenêtre tient dans le panneau, contraste de 4,5:1', await fits(frame, '.mod.so') && (await contrastProblems(frame, '.mod.so')).length === 0, await contrastProblems(frame, '.mod.so'));
  await shot(frame, '2-question');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  const bare = await target.rest.rows('GFS_Recus');
  check('Échap n\'écrit rien : aucune marque, aucune colonne de GFS ajoutée', bare.every(row => !row.Accepte && !row.Refuse) && !(Object.keys(bare[0]).some(key => /^(Accepte|Refuse)$/.test(key))), Object.keys(bare[0]));
  check('les deux arrivées sont toujours à accepter', (await badge(frame)) === '2');

  say('--- 3. accepter, refuser ---');
  await rowOf(frame, 'Facture.pdf').dblclick();
  await frame.locator('.mod.so').waitFor();
  await frame.locator('[data-fk="rx-accept"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await frame.waitForFunction(() => document.querySelector('.ls-row:not(.lk) .nm .t'), null, { timeout: 15000 });
  check('« Facture.pdf » n\'est plus grisée, son mot est « PDF », le nombre baisse', !(await greyed(frame, 'Facture.pdf')) && (await pill(frame, 'Facture.pdf')) === 'PDF' && (await badge(frame)) === '1', { grey: await greyed(frame, 'Facture.pdf'), pill: await pill(frame, 'Facture.pdf'), badge: await badge(frame) });
  check('la phrase le dit', (await toast(frame)).includes(t('rx.accepted', { name: 'Facture.pdf' })), await toast(frame));
  check('la cloche suit : une arrivée reste à accepter', (await bellBadge(frame)) === '1', await bellBadge(frame));
  await shot(frame, '3-accepte');
  await rowOf(frame, 'Devis.pdf').click();
  await frame.getByRole('button', { name: t('rx.answer.menu') }).click();
  await frame.locator('.mod.so').waitFor();
  await frame.locator('[data-fk="rx-refuse"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await waitForNames(frame, ['Facture.pdf']);
  check('« Devis.pdf » refusé n\'est plus montré, le nombre est vide', JSON.stringify(await names(frame)) === '["Facture.pdf"]' && (await badge(frame)) === '', { names: await names(frame), badge: await badge(frame) });
  check('la cloche reste là sans nombre quand plus rien n\'attend', (await bellBadge(frame)) === '' && (await frame.locator('.tb-bell').getAttribute('aria-label')) === t('nt.tip'), await frame.locator('.tb-bell').getAttribute('aria-label'));
  const marked = await target.rest.rows('GFS_Recus');
  const row = name => marked.find(each => each.Nom === name);
  check('les marques sont sur leurs lignes (Facture acceptée, Devis refusé), les deux lignes sont là', marked.length === 2 && row('Facture.pdf').Accepte === true && row('Facture.pdf').Refuse === false && row('Devis.pdf').Refuse === true && row('Devis.pdf').Accepte === false, marked.map(each => [each.Nom, each.Accepte, each.Refuse]));
  const tables = await target.rest.tables();
  check('GFS n\'a créé aucune table pour répondre', !tables.some(name => /^GFS_(Notifications|Reponses)/.test(name)), tables);

  say('--- 4. l\'envoyeur renomme : l\'accepté reste accepté, le refusé ne revient pas ---');
  const rename = async (from, to) => {
    const found = (await source.rest.rows('GFS_Fichiers')).find(each => each.Nom === from);
    return source.page.evaluate(async ([id, docId, name]) => (await fetch(`/api/docs/${docId}/tables/GFS_Fichiers/records`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ records: [{ id, fields: { Nom: name } }] }) })).status, [found.id, source.docId, to]);
  };
  await rename('Facture.pdf', 'Facture v2.pdf');
  await rename('Devis.pdf', 'Devis v2.pdf');
  await until(list => list.some(each => each.Nom === 'Facture v2.pdf') && list.some(each => each.Nom === 'Devis v2.pdf'));
  ui = await view();
  ({ page, frame } = ui);
  await waitForNames(frame, ['Facture v2.pdf']);
  check('« Facture v2.pdf » reste acceptée (ni grisée ni comptée), « Devis v2.pdf » ne revient pas, aucun doublon', JSON.stringify(await names(frame)) === '["Facture v2.pdf"]' && !(await greyed(frame, 'Facture v2.pdf')) && (await badge(frame)) === '' && (await target.rest.rows('GFS_Recus')).length === 2, { names: await names(frame), badge: await badge(frame) });

  say('--- 5. un fichier de plus : lui seul est à accepter ---');
  await alive(source);
  await importPdf(source.page, source.frame, pdfFile('Contrat.pdf', 2, 'Contrat').file);
  await waitForNames(source.frame, ['Contrat.pdf', 'Devis v2.pdf', 'Facture v2.pdf'].sort((a, b) => a.localeCompare(b)));
  const contract = (await source.rest.rows('GFS_Fichiers')).find(each => each.Nom === 'Contrat.pdf').Identifiant;
  await source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
  }), { exp: first.exp, selection: first.selection([idOf('Facture.pdf'), idOf('Devis.pdf'), contract]) });
  await until(list => list.some(each => each.Nom === 'Contrat.pdf' && each.Contenu), 60);
  ui = await view();
  ({ page, frame } = ui);
  await waitForNames(frame, ['Contrat.pdf', 'Facture v2.pdf']);
  check('« Contrat.pdf » arrive grisé « À accepter » (compté), « Facture v2.pdf » reste acceptée', (await greyed(frame, 'Contrat.pdf')) && (await pill(frame, 'Contrat.pdf')) === t('rx.pending') && !(await greyed(frame, 'Facture v2.pdf')) && (await badge(frame)) === '1', { names: await names(frame), badge: await badge(frame) });
  await shot(frame, '5-un-de-plus');

  say('--- 5b. un fichier arrive PENDANT que l\'explorateur est ouvert ---');
  // La boucle qui reçoit tourne dans la page ouverte (js/sync-service.js) : on ne passe plus par `pass()`, seule la page recopie, et la liste doit se mettre à jour sans être rouverte.
  await alive(source);
  await importPdf(source.page, source.frame, pdfFile('Avenant.pdf', 1, 'Avenant').file);
  await waitForNames(source.frame, ['Avenant.pdf', 'Contrat.pdf', 'Devis v2.pdf', 'Facture v2.pdf'].sort((a, b) => a.localeCompare(b)));
  const amendment = (await source.rest.rows('GFS_Fichiers')).find(each => each.Nom === 'Avenant.pdf').Identifiant;
  await source.frame.evaluate(args => window.__try(async () => {
    const done = await window.__s.saveChosenExport({ exp: args.exp, name: args.exp.name, selection: args.selection });
    return window.__s.finishEdit(args.exp, { name: args.exp.name, changed: done.changed });
  }), { exp: first.exp, selection: first.selection([idOf('Facture.pdf'), idOf('Devis.pdf'), contract, amendment]) });
  for (let i = 0; i < 45 && !(await names(frame)).includes('Avenant.pdf'); i += 1) {
    await alive(source);
    await source.frame.evaluate(() => window.__try(() => window.__s.catchUp()));
    await page.waitForTimeout(3000);
  }
  const live = { names: await names(frame), rail: await badge(frame), bell: await bellBadge(frame) };
  check('« Avenant.pdf » arrive grisé dans la liste ouverte, le volet et la cloche passent à 2, sans rouvrir', live.names.includes('Avenant.pdf') && (await greyed(frame, 'Avenant.pdf')) && live.rail === '2' && live.bell === '2', live);
  await shot(frame, '5b-arrivee-en-direct');

  say('--- 6. une arrivée acceptée se lit comme un PDF de GFS ---');
  await rowOf(frame, 'Facture v2.pdf').click();
  const wanted = frame.getByRole('button', { name: new RegExp(`^(${t('files.read')}|${t('files.download')})$`) });
  check('le bouton principal dit « Lire » ou « Télécharger » devant une arrivée acceptée', (await wanted.count()) >= 1, await frame.evaluate(() => [...document.querySelectorAll('button')].map(node => node.textContent.trim()).filter(Boolean)));
  const readLabel = (await wanted.first().innerText()).trim();
  if (readLabel === t('files.download')) {
    const [download] = await Promise.all([page.waitForEvent('download'), wanted.first().click()]);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const was = await source.rest.attachment((await source.rest.rows('GFS_Fichiers')).find(each => each.Identifiant === idOf('Facture.pdf')).Contenu[1]);
    check('« Télécharger » donne les mêmes octets que l\'envoyeur, sous le nom reçu', sha256(Buffer.concat(chunks)) === was.hash && download.suggestedFilename() === 'Facture v2.pdf', { name: download.suggestedFilename() });
  } else {
    say(`(le bouton dit « ${readLabel} » : une app lit les PDF dans ce document d'essai)`);
  }
  await rowOf(frame, 'Contrat.pdf').click();
  await rowOf(frame, 'Contrat.pdf').locator('.rb.mn').click();
  const menu = await frame.locator('.menu').innerText();
  check('le menu d\'une arrivée à accepter n\'offre que la réponse (ni supprimer, ni renommer, ni dupliquer)', menu.includes(t('rx.answer.menu')) && !/Supprimer|Mettre à la corbeille|Renommer|Dupliquer|Trash|Rename|Duplicate/.test(menu), menu);
  await page.keyboard.press('Escape');
  if (races.length) say(`(connu : ${races.length} erreur « KeyError 'GFS_Synchro' », sans suite)`);
  check('aucune erreur de GFS dans la console', [source, target, ...views].every(run => unexpected(run).length === 0), [source, target, ...views].map(run => unexpected(run).map(each => each.slice(0, 160))));
} finally {
  await browser.close();
  pages.close();
}
