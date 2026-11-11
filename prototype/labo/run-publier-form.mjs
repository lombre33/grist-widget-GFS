// « Avec accord » (décision du porteur, 11/11) : la vraie Form+, celle que GFS référence, publie son formulaire elle-même au bouton « Publier le formulaire » de son guide, dans GFS, dans un VRAI
// serveur Grist (l'image officielle, `bash vrai-serveur.sh`). grist-static ne peut pas jouer ceci : sans serveur d'accueil il refuse d'attacher un partage à une page (« HomeDbManager not available »).
// À 700 × 400, à la vraie souris. LAB_ACCORD=accepter (par défaut) | refuser ; LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   REPO_DIR="$(realpath ../..)" node run-publier-form.mjs
//   1. « Partir de zéro » crée la table et la page du formulaire ; le guide de Form+ est à l'étape 1 avec son bouton.
//   2. Le bouton : GFS laisse passer les deux écritures de partage (la ligne de `_grist_Shares`, puis `shareRef` de la page) et ouvre SA fenêtre d'accord avant la publication ; rien n'est ouvert à ce stade
//      (la clé que le serveur a tirée, lue dans sa base, ne donne ni le formulaire ni l'ajout de lignes). Le clavier part sur « Refuser ».
//   3. « Autoriser » : la section est publiée, le lien public marche en visiteur anonyme (le formulaire s'ouvre, une ligne s'ajoute dans la table des réponses et dans elle seule), Form+ est à l'étape 2.
//      « Refuser » : rien ne s'ouvre, le partage posé reste sans effet, Form+ attend la publication à la main.
//   4. (accepter) Un second formulaire sur le MÊME lien (choix du porteur, 11/11, « Au choix, non coché ») : sa page prend le partage de la première ; GFS demande l'accord dans sa fenêtre (« Refuser »
//      au clavier) ; refusé, rien ne change ; accepté, la même clé ouvre les deux formulaires et chacun reçoit des lignes dans sa seule table. Le geste est celui que Form+ fera avec sa case : ici
//      il part du cadre de la vraie Form+ (le courtier la juge comme elle), pas de son bouton, qui n'a pas encore la case.
//   5. Aucune erreur ni avertissement dans la console de GFS et de Form+.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { GRIST, openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs, settle } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const accord = process.env.LAB_ACCORD || 'accepter';
// Grist retire l'accent du nom de la table que Form+ crée d'après la langue de la personne.
const TABLE = lang === 'fr' ? 'Reponses' : 'Responses';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/form/`;
const GUIDE = lang === 'fr'
  ? { step1: 'Étape 1 sur 3', step2: 'Étape 2 sur 3', copied: 'J\'ai copié le lien', waiting: 'J\'attends la publication', page: 'Formulaire Reponses' }
  : { step1: 'Step 1 of 3', step2: 'Step 2 of 3', copied: 'I copied the link', waiting: 'Waiting for the publication', page: 'Form Responses' };

const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());

async function openForm(run) {
  const { page, frame } = run;
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  if (!(await frame.locator('.mod').count())) {
    if (await frame.locator('#floater-apps').isVisible()) await frame.locator('#floater-apps').click();
    else await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
    await frame.locator('.mod').waitFor();
  }
  await frame.locator('[data-fk="app:form"]').check();
  await settle(page, frame);
  await frame.locator('[data-open="form"]').click();
  for (let i = 0; i < 120 && !appFrame(page); i++) await page.waitForTimeout(500);
  return appFrame(page);
}

// Le document vu de l'extérieur (REST, comme la personne connectée) et la clé que le serveur a tirée, lue dans sa base d'accueil (ni un widget ni le document ne la voient).
const sql = (page, docId, query) => page.evaluate(async ([id, text]) => (await (await fetch(`/api/docs/${id}/sql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: text }) })).json()).records.map(row => row.fields), [docId, query]);
const stateOf = async (page, docId, sectionId) => {
  const [shares, pages, sections] = await Promise.all([sql(page, docId, 'select id, linkId, options from _grist_Shares'), sql(page, docId, 'select id, viewRef, shareRef from _grist_Pages'),
    sql(page, docId, 'select id, parentId, shareOptions from _grist_Views_section')]);
  const section = sections.find(row => row.id === sectionId);
  const pageRow = pages.find(row => row.viewRef === section.parentId);
  return { shares, shareRef: pageRow ? pageRow.shareRef : null, published: section.shareOptions || '' };
};
const keyOf = linkId => {
  const work = mkdtempSync(join(tmpdir(), 'cle-'));
  execFileSync('docker', ['cp', 'grist:/persist/home.sqlite3', join(work, 'home.sqlite3')]);
  return execFileSync('python3', ['-c', 'import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);r=c.execute("select key from shares where link_id=?",(sys.argv[2],)).fetchone();print(r[0] if r else "")', join(work, 'home.sqlite3'), linkId]).toString().trim();
};
const anonymous = async (route, init) => { const response = await fetch(`${GRIST}${route}`, init); return { status: response.status, ok: response.ok }; };
const addRow = (key, table) => anonymous(`/api/s/${key}/tables/${table}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: [{ fields: {} }] }) });

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  const { page, frame, docId } = run;
  const shot = async name => (await frame.frameElement()).screenshot({ path: join(SHOTS, `publier-form-${lang}-${scheme}-${accord}-${name}.png`) });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme}, accord : ${accord})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);

  // 1. Partir de zéro.
  const app = await openForm(run);
  check('Form+ s\'ouvre dans GFS', Boolean(app));
  await app.locator('[data-startgo="scratch"]').click();
  await page.waitForTimeout(500);
  await app.locator('#scratchCreate').click();
  await app.locator('#guide-publish').waitFor({ state: 'visible', timeout: 60000 });
  const sections = await sql(page, docId, 'select s.id, s.parentKey, s.parentId from _grist_Views_section s');
  const formSection = sections.find(row => row.parentKey === 'form');
  const guide = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
  check('le guide de publication est à l\'étape 1, avec le bouton « Publier le formulaire »', Boolean(formSection) && guide.includes(GUIDE.step1), guide.slice(0, 200));
  const start = await stateOf(page, docId, formSection.id);
  check('avant le clic : aucune ligne de partage, la page n\'en a pas, la section n\'est pas publiée', start.shares.length === 0 && !start.shareRef && !start.published.includes('publish'), start);
  await shot('1-guide');

  // 2. Le bouton.
  await app.locator('#guide-publish').click();
  const ask = frame.locator('.ask').first();
  await ask.waitFor({ state: 'visible', timeout: 20000 });
  const asked = { titre: await ask.locator('h2').innerText(), lignes: await ask.locator('.ask-items li').allInnerTexts(), focus: await frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null) };
  say('fenêtre de GFS :', JSON.stringify(asked));
  const posed = await stateOf(page, docId, formSection.id);
  const [share] = posed.shares;
  check('GFS laisse passer la ligne de partage et le rattachement à la page, mais la section n\'est pas encore publiée', posed.shares.length === 1 && posed.shareRef === share.id && !posed.published.includes('publish'), posed);
  check('la ligne de partage a la forme de celle du bouton de Grist : un `linkId` uuid et `{"publish":true}` seulement', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(share.linkId) && share.options === '{"publish":true}', share);
  check('la fenêtre de GFS dit la table des réponses, et le clavier part sur « Refuser »', /Reponses|Responses/.test(asked.lignes.join(' ')) && asked.focus === 'ask-no', asked);
  await page.waitForTimeout(3000);
  const key = keyOf(share.linkId);
  say('clé tirée par le serveur :', key ? `${key.length} caractères` : 'aucune');
  check('le serveur a tiré la clé de ce partage, elle n\'est pas dans le document', key.length >= 16 && !JSON.stringify(posed).includes(key), { key: key.length });
  const closed = await anonymous(`/api/s/${key}/forms/${formSection.id}`);
  const closedAdd = await addRow(key, TABLE);
  check('tant que la personne n\'a pas répondu, le lien n\'ouvre rien : ni le formulaire ni l\'ajout de lignes', !closed.ok && !closedAdd.ok, { formulaire: closed, ajout: closedAdd });
  await shot('2-fenetre');

  // 3. La réponse de la personne.
  if (accord === 'accepter') {
    await frame.locator('[data-fk="ask-yes"]').click();
    await app.locator('[data-guide="opened"]').waitFor({ state: 'visible', timeout: 20000 });
    const done = await stateOf(page, docId, formSection.id);
    const step2 = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
    check('« Autoriser » : la section est publiée (`publish` et `form`), le partage tient, Form+ est à l\'étape 2 sans geste de plus', done.published.includes('"publish":true') && done.published.includes('"form":true') && done.shares.length === 1 && done.shareRef === share.id && step2.includes(GUIDE.step2) && step2.includes(GUIDE.copied), { done, step2: step2.slice(0, 200) });
    await page.waitForTimeout(3000);
    const open = await anonymous(`/api/s/${key}/forms/${formSection.id}`);
    const add = await addRow(key, TABLE);
    const rows = await sql(page, docId, `select count(*) as n from ${TABLE}`);
    check('le lien public marche en visiteur anonyme : le formulaire s\'ouvre et une ligne s\'ajoute dans la table des réponses', open.ok && add.ok && rows[0].n === 1, { formulaire: open, ajout: add, lignes: rows });
    const clients = await addRow(key, 'Clients');
    check('mais le lien n\'écrit pas dans une autre table du document (« Clients »)', !clients.ok, clients);
    const withLinkId = await anonymous(`/api/s/${share.linkId}/forms/${formSection.id}`);
    check('et l\'adresse bâtie avec le `linkId` que le document connaît ne marche pas (seule la clé du serveur ouvre)', !withLinkId.ok, withLinkId);
    await shot('3-etape-2');

    // 4. Un second formulaire sur le même lien.
    const second = await app.evaluate(async () => {
      await grist.docApi.applyUserActions([['AddTable', 'Autres', [{ id: 'Nom', type: 'Text' }]]]);
      const tables = await grist.docApi.fetchTable('_grist_Tables');
      const result = await grist.docApi.applyUserActions([['CreateViewSection', tables.id[tables.tableId.indexOf('Autres')], 0, 'form', null, 'Autres']]);
      return result.retValues[0];
    });
    const secondPage = (await sql(page, docId, `select p.id, v.name from _grist_Pages p join _grist_Views v on v.id = p.viewRef where p.viewRef = ${second.viewRef}`))[0];
    const attach = () => app.evaluate(async ([pageId, shareRef]) => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Pages', pageId, { shareRef }]]).then(() => 'fait', error => ({ code: error && error.code, message: String(error && error.message || error) })), [secondPage.id, share.id]);
    const pageShare = async () => (await sql(page, docId, `select shareRef from _grist_Pages where id = ${secondPage.id}`))[0].shareRef;
    const pending = attach();
    const sameLink = frame.locator('.ask').first();
    await sameLink.waitFor({ state: 'visible', timeout: 20000 });
    const sameAsked = { titre: await sameLink.locator('h2').innerText(), texte: (await sameLink.locator('#ask-text').innerText()).replace(/\s+/g, ' '), lignes: await sameLink.locator('.ask-items li').allInnerTexts(), focus: await frame.evaluate(() => (document.activeElement && document.activeElement.dataset.fk) || null) };
    say('fenêtre « même lien » :', JSON.stringify(sameAsked));
    check('la page du second formulaire demande le lien du premier : GFS ouvre sa fenêtre, qui nomme les deux pages et la table du premier, et le clavier part sur « Refuser »',
      /Un seul lien|One link/.test(sameAsked.titre) && sameAsked.texte.includes(secondPage.name) && sameAsked.lignes.join(' ').includes(GUIDE.page) && sameAsked.lignes.join(' ').includes(TABLE) && sameAsked.focus === 'ask-no', sameAsked);
    await shot('4-meme-lien');
    await frame.locator('[data-fk="ask-no"]').click();
    const refusedLink = await pending;
    check('« Refuser » : la page garde son propre état (aucun partage), l\'app reçoit le refus avec le code `GFS_ANNULE` (`error.code`, que Form+ lit pour ne pas dire « n\'a pas pu publier »)', (await pageShare()) === 0 && refusedLink.code === 'GFS_ANNULE', { partage: await pageShare(), reponse: refusedLink });
    const again = attach();
    await frame.locator('.ask').first().waitFor({ state: 'visible', timeout: 20000 });
    await frame.locator('[data-fk="ask-yes"]').click();
    check('« Même lien » : la page prend le partage de la première', (await again) === 'fait' && (await pageShare()) === share.id, { reponse: await again, partage: await pageShare() });
    const publishSecond = app.evaluate(async id => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', id, { shareOptions: JSON.stringify({ publish: true, form: true }) }]]).then(() => 'fait', error => String(error && error.message || error)), second.sectionRef);
    const tableWindow = frame.locator('.ask').first();
    await tableWindow.waitFor({ state: 'visible', timeout: 20000 });
    check('la publication du second demande l\'accord comme avant : sa table, `Autres`, reçoit des lignes', (await tableWindow.locator('.ask-items li').allInnerTexts()).join(' ').includes('Autres'));
    await frame.locator('[data-fk="ask-yes"]').click();
    check('le second formulaire est publié', (await publishSecond) === 'fait');
    await page.waitForTimeout(3000);
    const bothOpen = [await anonymous(`/api/s/${key}/forms/${formSection.id}`), await anonymous(`/api/s/${key}/forms/${second.sectionRef}`)];
    const addSecond = await addRow(key, 'Autres');
    const addFirst = await addRow(key, TABLE);
    const rowsSecond = await sql(page, docId, 'select count(*) as n from Autres');
    check('la même clé ouvre les DEUX formulaires en visiteur anonyme et chacun reçoit des lignes dans sa table : c\'est ce que la fenêtre a dit', bothOpen.every(each => each.ok) && addSecond.ok && addFirst.ok && rowsSecond[0].n === 1, { formulaires: bothOpen, ajouts: [addFirst, addSecond], lignesSecond: rowsSecond });
    const stillClosed = await addRow(key, 'Clients');
    check('mais toujours pas dans une autre table du document (« Clients »)', !stillClosed.ok, stillClosed);
  } else {
    await frame.locator('[data-fk="ask-no"]').click();
    await app.locator('.guide-wait').waitFor({ state: 'visible', timeout: 20000 });
    const refused = await stateOf(page, docId, formSection.id);
    const manual = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
    check('« Refuser » : la section n\'est pas publiée, le partage posé reste, sans rien ouvrir', !refused.published.includes('publish') && refused.shares.length === 1 && refused.shareRef === share.id, refused);
    await page.waitForTimeout(2500);
    const closedAfter = await anonymous(`/api/s/${key}/forms/${formSection.id}`);
    const addAfter = await addRow(key, TABLE);
    check('le lien ne donne toujours ni le formulaire ni l\'ajout de lignes', !closedAfter.ok && !addAfter.ok, { formulaire: closedAfter, ajout: addAfter });
    check('Form+ passe au geste à la main : la page à ouvrir (« ' + GUIDE.page + ' ») et l\'attente', manual.includes(GUIDE.page) && manual.includes(GUIDE.waiting), manual.slice(0, 300));
    say('CONSTAT : Form+ dit-elle « n\'a pas pu publier à votre place » après le refus de la personne ?', /n'a pas pu publier|could not publish/.test(manual));
    await shot('3-geste-a-la-main');
  }

  // 4. Console.
  // Le refus de la personne arrive à Form+ comme `GFS_ANNULE` et GFS l'avertit dans la console : attendu (variante « refuser » ; dans « accepter », le refus du même lien de l'étape 4).
  const expected = [/refusé \(GFS_ANNULE\) : La personne a refusé/];
  const unexpected = run.problems.filter(problem => ![...run.allow, ...expected].some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, Form+), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
