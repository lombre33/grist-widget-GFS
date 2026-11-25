// Les gestes de rangement qui s'affichent avant d'être écrits (étude du 23/11, choix du porteur : « raccourcir, puis afficher tout de suite » ; js/explorer/pending.js,
// js/explorer/filing.js), dans un VRAI serveur Grist (Docker 1.7.19, `vrai-serveur.sh`) derrière un relais de latence (`ONE_WAY_MS`, 20 = 40 ms d'aller-retour), sous Chromium, à 700 × 400,
// à la vraie souris et au vrai clavier. Ce que Grist garde se lit après coup, quand le document ne bouge plus (lab-rest.mjs, `quiet`).
//   1. Le premier dossier (la table du rangement n'existe pas) : rien ne s'affiche avant l'accord de la personne ; la table naît avec la ligne du dossier.
//   2. Un dossier neuf s'affiche en moins de 250 ms, ne disparaît à aucun instant des trois secondes qui suivent (pas de clignotement), et Grist le garde.
//   3. Créer un dossier puis le renommer tout de suite : un seul dossier, au nouveau nom, dans Grist.
//   4. L'étoile et le nom d'un fichier s'affichent d'abord ; Grist les garde ; Ctrl+Z rend le nom d'avant (il attend l'écriture quand elle n'est pas finie).
//   5. Un refus de Grist (injecté : l'appel d'écriture du courtier lève, pour un seul nom de dossier) : le dossier s'en va, la phrase dit pourquoi, rien n'est à défaire pour lui ;
//      Ctrl+Z défait le geste d'avant, qui avait abouti.
//   6. Supprimer un dossier vide : il s'en va tout de suite ; Grist retire sa ligne.
//   7. La corbeille (choix du porteur, 24/11 : « oui, sauf si l'app doit répondre ») : le premier fichier attend l'accord de la personne pour la table (il reste dans la
//      liste) ; les suivants partent en moins de 250 ms, ne reviennent à aucune image des trois secondes qui suivent, et Grist les garde (une entrée à la corbeille,
//      la ligne de l'app retirée) ; Ctrl+Z tout de suite après les rend (il attend l'écriture), dans la liste et dans Grist.
//   8. Un refus de Grist pour la corbeille (injecté : l'ajout à `GFS_Trash` lève quand le drapeau `__refuseTrash` est levé) : le fichier part, puis revient avec la phrase
//      qui dit pourquoi ; Grist n'a rien changé.
//   9. Aucune erreur ni avertissement de GFS dans la console (les refus injectés exceptés).
// Le relais : `/mnt/project-files/gfs/audits/ouverture-fichiers-2026-11-23/banc/relay.sh 20`, puis le serveur sur 8485 (voir le LISEZ-MOI de ce dossier).
//   REPO_DIR="$(realpath ../..)" node run-affichage-immediat.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedFiles } from './seed.mjs';
import { createI18n } from '../js/i18n/i18n.js';

const lang = process.env.LAB_LANG || 'fr';
const { t } = createI18n(lang);
const MODEL = 'Contrat de prestation';
const FILING = 'GFS_Filing';
const REFUSAL = 'Refus de Grist (essai)';
const FORBIDDEN = 'Interdit';

// Le courtier refuse (pour de faux) toute écriture qui nomme le dossier « Interdit » : l'erreur que l'appel rendrait si Grist disait non.
const patches = [
  { fichier: 'broker/broker.js', de: "const doc = grist.rpc.getStub('GristDocAPI@grist');", vers: "const doc = __refusing(grist.rpc.getStub('GristDocAPI@grist'));", },
  { fichier: 'broker/broker.js', de: 'export function createPort(grist) {', vers: `function __refusing(doc) {
  return new Proxy(doc, { get(target, key) {
    const value = target[key];
    if (key !== 'applyUserActions') return value;
    return (...args) => {
      const text = JSON.stringify(args);
      const trash = globalThis.__refuseTrash && text.includes('AddRecord') && text.includes('GFS_Trash');
      return text.includes('${FORBIDDEN}') || trash ? Promise.reject(new Error('${REFUSAL}')) : value.apply(target, args);
    };
  } });
}
export function createPort(grist) {` },
];

const gfsFrame = page => page.frames().find(f => /prototype\/index\.html/.test(f.url()) && /access=full/.test(f.url()));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function restart(run) {
  await run.page.reload({ waitUntil: 'load' });
  await run.page.waitForTimeout(1500);
  let frame = null;
  for (let i = 0; i < 80 && !frame; i++) { frame = gfsFrame(run.page); if (!frame) await run.page.waitForTimeout(250); }
  await frame.waitForFunction(() => document.body && document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  await run.page.waitForTimeout(1500);
  return frame;
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  const run = await openGfs(context, { mirrors: true, patches });
  const { page } = run;
  await seedFiles(run.frame, {});
  let frame = await restart(run);
  if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

  const row = text => frame.locator('.ls-row', { hasText: text }).first();
  const has = name => frame.evaluate(n => [...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n)), name);
  const present = name => frame.waitForFunction(n => [...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n)), name, { polling: 'raf', timeout: 30000 });
  const absent = name => frame.waitForFunction(n => ![...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n)), name, { polling: 'raf', timeout: 30000 });
  const toasts = () => frame.evaluate(() => [...document.querySelectorAll('#toast')].map(node => node.textContent.trim()));
  const stateRows = async () => (await run.rest.rows(FILING)).filter(each => each.Utilisateur === 'essai@example.com' && !each.App && !each.Fichier && each.Dossier).map(each => each.Dossier).sort();
  const modelNames = async () => (await run.rest.rows('Publipostage_Modeles')).map(each => each.Nom);
  const newFolder = async name => {
    await frame.locator('.ex-nav-row .btn.primary').click();
    await frame.getByRole('menuitem', { name: /^(Nouveau dossier|New folder)/ }).click();
    await frame.locator('[data-fk="name-input"]').fill(name);
  };
  // Le temps que met la personne à voir le dossier, de la touche Entrée à la ligne affichée.
  const timed = async (press, until) => { const t0 = Date.now(); await press(); await until(); return Date.now() - t0; };
  // Les images où le dossier a manqué à la liste pendant `ms` : le clignotement.
  const missing = async (name, ms) => frame.evaluate(([n, duration]) => new Promise(resolve => {
    let gone = 0;
    const end = performance.now() + duration;
    const tick = () => { if (![...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n))) gone += 1; if (performance.now() < end) requestAnimationFrame(tick); else resolve(gone); };
    tick();
  }), [name, ms]);

  say('--- 1. le premier dossier : la table du rangement naît avec l\'accord de la personne ---');
  await newFolder('Premier');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const askedFirst = await frame.locator('[data-fk="ask-yes"]').count();
  check('la table n\'existe pas : GFS demande l\'accord avant de montrer le dossier', askedFirst === 1 && !(await has('Premier')), { question: askedFirst, dossier: await has('Premier') });
  await frame.locator('[data-fk="ask-yes"]').first().click();
  await present('Premier');
  check('la table est créée avec la ligne du dossier', same(await stateRows(), ['Premier']), await stateRows());
  frame = await restart(run);

  say('--- 2. un dossier neuf s\'affiche tout de suite, sans clignoter ---');
  await newFolder('Rapide');
  const shown = await timed(() => page.keyboard.press('Enter'), () => present('Rapide'));
  check('le dossier est là en moins de 250 ms (40 ms d\'aller-retour jusqu\'à Grist)', shown < 250, `${shown} ms`);
  const gone = await missing('Rapide', 3000);
  check('il ne manque à la liste à aucune image des trois secondes qui suivent', gone === 0, `${gone} images sans lui`);
  check('Grist le garde : une ligne d\'état', same(await stateRows(), ['Premier', 'Rapide']), await stateRows());

  say('--- 3. créer puis renommer tout de suite ---');
  await newFolder('Aller');
  await page.keyboard.press('Enter');
  await present('Aller');
  await row('Aller').click();
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').fill('Retour');
  await page.keyboard.press('Enter');
  await present('Retour');
  await absent('Aller');
  check('un seul dossier, au nouveau nom, dans Grist', same((await stateRows()).filter(name => /Aller|Retour/.test(name)), ['Retour']), await stateRows());

  say('--- 4. l\'étoile et le nom d\'un fichier ---');
  await row(MODEL).scrollIntoViewIfNeeded();
  await row(MODEL).hover();
  const pinned = await timed(() => row(MODEL).locator('button.pin').click(), () => frame.waitForFunction(n => [...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n) && r.querySelector('button.pin.on')), MODEL, { polling: 'raf', timeout: 30000 }));
  check('l\'étoile s\'allume en moins de 250 ms', pinned < 250, `${pinned} ms`);
  const prefs = await run.rest.rows('Publipostage_PreferencesModeles');
  const kept = (await run.rest.rows(FILING)).filter(each => each.App === 'publipostage' && each.Favori === true);
  check('Grist garde l\'étoile (chez l\'app ou dans le rangement de GFS)', prefs.some(each => each.Epingle === true) || kept.length > 0, { prefs: prefs.length, gfs: kept.length });
  await row(MODEL).click();
  await page.keyboard.press('F2');
  await frame.locator('[data-fk="name-input"]').fill(`${MODEL} 2`);
  const renamed = await timed(() => page.keyboard.press('Enter'), () => present(`${MODEL} 2`));
  check('le nouveau nom s\'affiche en moins de 250 ms', renamed < 250, `${renamed} ms`);
  check('Grist garde le nom', (await modelNames()).includes(`${MODEL} 2`), await modelNames());
  await page.keyboard.press('Control+z'); // l'écriture du nom est peut-être encore en route : Ctrl+Z l'attend
  await present(MODEL);
  check('Ctrl+Z rend le nom d\'avant, dans la liste et dans Grist', (await modelNames()).includes(MODEL) && !(await modelNames()).includes(`${MODEL} 2`), await modelNames());

  say('--- 5. un refus de Grist ---');
  await newFolder('Garde');
  await page.keyboard.press('Enter');
  await present('Garde');
  await page.waitForTimeout(1500);
  await newFolder(FORBIDDEN);
  await page.keyboard.press('Enter');
  await present(FORBIDDEN);
  await absent(FORBIDDEN);
  const said = (await toasts()).join(' | ');
  check('le dossier refusé s\'en va', !(await has(FORBIDDEN)));
  check('la phrase dit pourquoi', said.includes(t('ex.filingFailed', { reason: REFUSAL })), said);
  check('Grist n\'en a rien gardé', !(await stateRows()).includes(FORBIDDEN), await stateRows());
  await page.keyboard.press('Control+z');
  await absent('Garde');
  check('Ctrl+Z défait le geste d\'avant (« Garde »), non celui qui a été refusé', same((await stateRows()).filter(name => /Garde|Interdit/.test(name)), []), await stateRows());

  say('--- 6. supprimer un dossier vide ---');
  await newFolder('À jeter');
  await page.keyboard.press('Enter');
  await present('À jeter');
  await page.waitForTimeout(1500);
  await row('À jeter').click();
  const removed = await timed(() => page.keyboard.press('Delete'), () => absent('À jeter'));
  check('il s\'en va en moins de 250 ms', removed < 250, `${removed} ms`);
  check('Grist retire sa ligne', !(await stateRows()).includes('À jeter'), await stateRows());

  say('--- 7. la corbeille ---');
  const binRows = async () => (await run.rest.rows('GFS_Trash')).map(each => each.Nom).sort();
  const binState = async () => ({ corbeille: await binRows(), modeles: (await modelNames()).length });
  // les images où le fichier est dans la liste pendant `ms` : le fichier qui revient (clignotement)
  const shownFor = async (name, ms) => frame.evaluate(([n, duration]) => new Promise(resolve => {
    let seen = 0;
    const end = performance.now() + duration;
    const tick = () => { if ([...document.querySelectorAll('.ls-row')].some(r => r.textContent.includes(n))) seen += 1; if (performance.now() < end) requestAnimationFrame(tick); else resolve(seen); };
    tick();
  }), [name, ms]);
  await row(MODEL).click();
  await page.keyboard.press('Delete');
  await frame.locator('[data-fk="ask-yes"]').first().waitFor({ timeout: 20000 });
  check('la table de la corbeille n\'existe pas : GFS demande l\'accord, le fichier est encore dans la liste', await has(MODEL));
  await frame.locator('[data-fk="ask-yes"]').first().click();
  await absent(MODEL);
  check('le premier fichier est à la corbeille dans Grist, retiré de la table de l\'app', same(await binRows(), [MODEL]) && !(await modelNames()).includes(MODEL), await binState());
  await page.keyboard.press('Control+z');
  await present(MODEL);
  check('Ctrl+Z le rend, dans la liste et dans Grist', (await modelNames()).includes(MODEL) && same(await binRows(), []), await binState());
  await page.waitForTimeout(2000);
  await row(MODEL).click();
  const binned = await timed(() => page.keyboard.press('Delete'), () => absent(MODEL));
  check('le fichier part en moins de 250 ms (la table de la corbeille existe)', binned < 250, `${binned} ms`);
  const back = await shownFor(MODEL, 3000);
  check('il ne revient dans la liste à aucune image des trois secondes qui suivent', back === 0, `${back} images avec lui`);
  check('Grist le garde à la corbeille : une entrée, et la ligne de l\'app est retirée', same(await binRows(), [MODEL]) && !(await modelNames()).includes(MODEL), await binState());
  check('la phrase « à la corbeille » est dite après l\'écriture', (await toasts()).join(' | ').includes(t('trash.moved', { name: MODEL })), (await toasts()).join(' | '));
  await page.keyboard.press('Control+z'); // l'écriture est finie ici ; le cas « tout de suite » vient juste après
  await present(MODEL);
  check('Ctrl+Z rend le fichier, dans la liste et dans Grist', (await modelNames()).includes(MODEL) && same(await binRows(), []), await binState());
  await page.waitForTimeout(1500);
  await row(MODEL).click();
  await page.keyboard.press('Delete');
  await absent(MODEL);
  await page.keyboard.press('Control+z'); // sans attendre : Ctrl+Z attend l'écriture partie, puis la relecture de la corbeille
  await present(MODEL);
  check('Ctrl+Z tout de suite après la corbeille : le fichier revient quand même, dans Grist aussi', (await modelNames()).includes(MODEL) && same(await binRows(), []), await binState());

  say('--- 8. un refus de Grist pour la corbeille ---');
  await page.waitForTimeout(1500);
  await frame.evaluate(() => { globalThis.__refuseTrash = true; });
  await row(MODEL).click();
  await page.keyboard.press('Delete');
  await absent(MODEL);
  await present(MODEL);
  const refused = (await toasts()).join(' | ');
  check('le fichier revient dans la liste, la phrase dit pourquoi', refused.includes(t('trash.failed', { name: MODEL, reason: REFUSAL })), refused);
  check('Grist n\'a rien changé : le fichier est dans sa table, la corbeille est vide', (await modelNames()).includes(MODEL) && same(await binRows(), []), await binState());
  await frame.evaluate(() => { globalThis.__refuseTrash = false; });

  say('--- 9. la console ---');
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !problem.includes(REFUSAL));
  check('aucune erreur ni avertissement inattendu de GFS', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
