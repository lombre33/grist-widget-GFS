// Les pages des tables de GFS (contrats 6.6, js/files/page-tree.js), dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à la vraie souris. Grist crée une page au premier niveau, en bas du volet, pour
// chaque `AddTable` :
//   1. un document qui a déjà des tables de GFS à plat (et une table qui n'est pas la sienne) : à l'ouverture, GFS les range sous sa page, dans l'ordre, replie sa page par défaut, et note les tables dans les réglages de la vue ;
//   2. à la réouverture du document, le volet de gauche de Grist montre la page de GFS repliée (les tables n'y sont pas), sa flèche les montre ; aucune barre « Enregistrer » dans les réglages de la vue ;
//   3. une table que GFS crée ensuite (le chemin de `OwnTable`, avec le vrai contrôleur) vient sous la page de GFS ;
//   4. la personne sort une page de dessous : GFS rechargé ne la remet pas (la marque `gfs.pages`).
//
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-pages-gfs.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { SHOTS } from './lab-common.mjs';
import { join } from 'node:path';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const TAG = `pages-gfs-${lang}-${scheme}`;
const column = id => ({ id, type: 'Text' });

const apply = (run, actions) => run.page.evaluate(async ([docId, body]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body) })).json(), [run.docId, actions]);
// Les pages de la liste de Grist, dans l'ordre du volet : { id, pos, level, options, name, table }.
const pagesOf = run => run.frame.evaluate(async () => {
  const [tables, list, views] = await Promise.all(['_grist_Tables', '_grist_Pages', '_grist_Views'].map(name => grist.docApi.fetchTable(name)));
  return list.id.map((id, i) => ({ id, pos: list.pagePos[i], level: list.indentation[i], options: list.options ? list.options[i] : null,
    name: views.name[views.id.indexOf(list.viewRef[i])], table: (tables.tableId[tables.primaryViewId.indexOf(list.viewRef[i])] || null) })).sort((a, b) => a.pos - b.pos);
});
const shape = list => list.map(item => `${'  '.repeat(item.level)}${item.table || item.name}`);
const optionsOf = run => run.frame.evaluate(() => grist.getOptions());
const shot = (run, name) => run.page.screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const visible = (run, text) => run.page.getByText(text, { exact: true }).first().isVisible().catch(() => false);

// La personne rouvre le document (toute la page de Grist) : GFS repart.
async function reopen(run) {
  await run.page.reload({ waitUntil: 'load' });
  await run.page.locator('.test-onboarding-popup').first().waitFor({ timeout: 4000 }).catch(() => {});
  await run.page.keyboard.press('Escape');
  for (let i = 0; i < 80 && !run.frame.isDetached(); i++) await run.page.waitForTimeout(100); // l'ancien cadre disparaît avec la page
  run.frame = await findFrame(run);
}
async function findFrame(run) {
  for (let i = 0; i < 120; i++) {
    const frame = run.page.frames().find(each => /access=full/.test(each.url()) && !each.isDetached());
    if (frame) {
      await frame.waitForFunction(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 60000 }).catch(() => {});
      return frame;
    }
    await run.page.waitForTimeout(500);
  }
  throw new Error('Le cadre de GFS ne s\'est pas rouvert.');
}
// GFS range quelques secondes après l'ouverture (le temps que Grist dise la table) : on attend que la marque compte `wanted` tables, ou le délai.
async function waitMark(run, wanted) {
  for (let i = 0; i < 150; i++) {
    const kept = await optionsOf(run).catch(() => null);
    if (kept && Array.isArray(kept['gfs.pages']) && kept['gfs.pages'].length >= wanted) return kept['gfs.pages'];
    await run.page.waitForTimeout(100);
  }
  return ((await optionsOf(run).catch(() => null)) || {})['gfs.pages'] || null;
}
// La page de GFS dans le volet de gauche : son ligne d'en-tête et sa flèche.
const header = (run, name) => run.page.locator('.test-treeview-itemHeaderWrapper').filter({ has: run.page.locator('.test-docpage-label', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) }).first();

const server = await requireServer();
const pagesServer = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  say('\n=== Le document d\'avant : des tables de GFS à plat ===');
  say('pages :', shape(await pagesOf(run)));
  await apply(run, [['AddTable', 'GFS_Filing', [column('User')]], ['AddTable', 'GFS_Groups', [column('Name')]], ['AddTable', 'Autre_Table', [column('Name')]],
    ['AddTable', 'GFS_Files', [column('Name')]]]);
  const flat = await pagesOf(run);
  say('pages :', shape(flat));
  check('Grist a posé une page au premier niveau pour chaque table', flat.length === 6 && flat.slice(-4).every(item => item.level === 0), shape(flat));
  const mainId = await run.frame.evaluate(async () => {
    const [sections, list] = await Promise.all(['_grist_Views_section', '_grist_Pages'].map(name => grist.docApi.fetchTable(name)));
    return list.id[list.viewRef.indexOf(sections.parentId[sections.parentKey.indexOf('custom')])];
  });

  say('\n=== À l\'ouverture, GFS range ses pages sous la sienne et la replie ===');
  await reopen(run);
  const mark = await waitMark(run, 3);
  await run.page.waitForTimeout(500);
  const after = await pagesOf(run);
  say('pages :', shape(after), '\nmarque :', mark);
  const parent = after.find(item => item.id === mainId);
  check('les trois tables de GFS sont sous la page qui porte GFS, dans l\'ordre où Grist les avait mises',
    JSON.stringify(shape(after)) === JSON.stringify(['Table1', parent.table || parent.name, '  GFS_Filing', '  GFS_Groups', '  GFS_Files', 'Autre_Table']), shape(after));
  check('la page de GFS est repliée par défaut (`options.collapsed`)', Boolean(parent.options) && JSON.parse(parent.options).collapsed === true, parent.options);
  check('la table d\'autrui garde sa page au premier niveau, en bas', after.at(-1).table === 'Autre_Table' && after.at(-1).level === 0, shape(after));
  check('la marque `gfs.pages` liste les trois tables', Array.isArray(mark) && JSON.stringify([...mark].sort()) === JSON.stringify(['GFS_Files', 'GFS_Groups', 'GFS_Filing']), mark);
  const bars = await run.page.getByRole('button', { name: /^(Save|Revert|Enregistrer|Retour)$/ }).count();
  check('aucune barre « Enregistrer » dans Grist (la marque s\'écrit comme un réglage enregistré)', bars === 0, bars);
  await shot(run, '1-range');

  say('\n=== Le document rouvert : la page de GFS est repliée, sa flèche montre les tables ===');
  await reopen(run);
  await run.page.waitForTimeout(1500);
  check('les pages des tables de GFS ne sont pas dans le volet (repliées)', !(await visible(run, 'GFS_Filing')) && !(await visible(run, 'GFS_Files')));
  check('la table d\'autrui, elle, y est', await visible(run, 'Autre_Table'));
  await shot(run, '2-replie');
  const row = header(run, parent.name);
  await row.hover();
  await row.locator('.test-treeview-itemArrow').click();
  await run.page.waitForTimeout(600);
  check('la flèche de la page montre les trois tables', await visible(run, 'GFS_Filing') && await visible(run, 'GFS_Groups') && await visible(run, 'GFS_Files'));
  await shot(run, '3-deplie');
  check('replier ou déplier à la main n\'écrit rien dans le document (l\'état est celui du navigateur)', (await pagesOf(run)).find(item => item.id === mainId).options === parent.options);

  say('\n=== Une table que GFS crée ensuite vient sous sa page ===');
  await run.frame.evaluate(async () => {
    const { OwnTable } = await import('./js/files/own-table.js');
    const table = new OwnTable({ port: { doc: grist.docApi }, name: 'GFS_Trash', columns: [{ id: 'Name', type: 'Text' }], consent: async () => true });
    await table.ready();
  });
  await waitMark(run, 4);
  const created = await pagesOf(run);
  say('pages :', shape(created));
  check('la table créée par GFS est sous la page de GFS, après les autres', created.filter(item => item.level === 1).map(item => item.table).at(-1) === 'GFS_Trash', shape(created));
  check('la page de GFS garde son réglage (repliée par défaut)', JSON.parse(created.find(item => item.id === mainId).options).collapsed === true, created.find(item => item.id === mainId).options);
  check('la table d\'autrui reste en bas', created.at(-1).table === 'Autre_Table', shape(created));
  check('la marque compte la nouvelle table', ((await optionsOf(run))['gfs.pages'] || []).includes('GFS_Trash'), await optionsOf(run));

  say('\n=== La personne sort une page de dessous : GFS rechargé ne la remet pas ===');
  const moved = created.find(item => item.table === 'GFS_Groups');
  await apply(run, [['UpdateRecord', '_grist_Pages', moved.id, { indentation: 0, pagePos: created.at(-1).pos + 1 }]]);
  await reopen(run);
  await run.page.waitForTimeout(6000); // plus que le temps du premier rangement
  const again = await pagesOf(run);
  say('pages :', shape(again));
  check('la page sortie par la personne reste sortie', again.find(item => item.table === 'GFS_Groups').level === 0, shape(again));
  check('rien d\'autre n\'a bougé', JSON.stringify(shape(again).filter(line => line.trim() !== 'GFS_Groups')) === JSON.stringify(shape(created).filter(line => line.trim() !== 'GFS_Groups')), shape(again));
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pagesServer.close();
}
