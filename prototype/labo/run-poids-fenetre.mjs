// La fenêtre « Poids du document » (lot 4 du poids ; contrats 2.4 point 5 et 6.6 point 14 ; faits vérifiés, section 43), jouée dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie
// souris et au vrai clavier : un clic sur le total du pied ouvre la fenêtre, le cadre d'envoi lit le poids exact avec un vrai jeton en lecture seule (`getAccessToken`), et chaque chiffre est comparé à ce que la session
// de la page de Grist lit par `/sql` (autre chemin, mêmes requêtes) et à un calcul fait ici, à part (les pièces jointes comptées, d'après `_grist_Attachments`).
// Le serveur d'essai ne connaît qu'une personne à la fois : la seconde personne (un éditeur, un lecteur) se joue en relançant le serveur sous son compte, sur le MÊME document (voir `run-poids-fenetre.sh` de
// LISEZ-MOI.md, « La fenêtre du poids ») :
//   PHASE=seed                          la personne d'essai crée le document, y met des tables lourdes, de petites, des pièces jointes et de l'historique, le partage à editor@ et viewer@ ; la fenêtre dit tout
//   PHASE=read EXPECT=exact WHO=editeur le même document, sans aucune règle d'accès, vu par un éditeur (puis un lecteur) : Grist leur rend `/sql`, la fenêtre aussi
//   PHASE=rules                         la personne d'essai pose une règle qui cache une table aux autres (`user.Access != OWNER`, `-CRUD`) : un propriétaire lit toujours tout
//   PHASE=read EXPECT=denied WHO=…      le même document, vu par l'éditeur puis le lecteur : `/sql` leur est refusé, la fenêtre se grise avec la raison et garde l'estimation
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { formatBytes } from '../js/weight/weight.js';
import { SQL } from '../js/weight/weight-reader.js';
import { PAGE_PORT, contrastProblems, openGfs, shot } from './lab-pdf.mjs';
import { apply, noise, sql, upload } from './lab-poids.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'seed';
const expectation = process.env.EXPECT || 'exact';
const who = process.env.WHO || 'proprietaire';
const STATE = process.env.POIDS_ETAT || '/tmp/poids-fenetre-etat.json';
const { t } = createI18n(lang);
const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
const show = bytes => formatBytes(bytes, locale, t);
const text = (size, seed) => noise(Math.ceil(size * 3 / 4), seed).toString('base64').slice(0, size);
// Les erreurs que le navigateur écrit seul quand Grist refuse une lecture à qui n'a pas le droit de tout copier (le cadre d'envoi est une page de GFS) : attendues dans cet essai.
const REFUSAL = /Failed to load resource: the server responded with a status of 40[13]/;

// Le document : une table lourde (trois textes de 600 000 signes, réécrits : l'historique grossit), mille petites lignes, une table que la règle cachera, et des pièces jointes que nulle cellule ne cite.
async function seed(run) {
  say('--- le document ---');
  await apply(run, [['AddTable', 'Gros', [{ id: 'Texte', type: 'Text' }]], ['AddTable', 'Petits', [{ id: 'Nom', type: 'Text' }, { id: 'Valeur', type: 'Text' }]], ['AddTable', 'Secrets', [{ id: 'Note', type: 'Text' }]]]);
  for (let i = 1; i <= 3; i++) await apply(run, [['AddRecord', 'Gros', null, { Texte: text(600000, i) }]]);
  await apply(run, [['BulkAddRecord', 'Petits', Array.from({ length: 1000 }, () => null), { Nom: Array.from({ length: 1000 }, (unused, i) => `Nom ${i}`), Valeur: Array.from({ length: 1000 }, (unused, i) => `Valeur ${i * 7}`) }]]);
  await apply(run, [['AddRecord', 'Secrets', null, { Note: 'à ne pas montrer' }]]);
  for (let i = 1; i <= 3; i++) await apply(run, [['UpdateRecord', 'Gros', 1, { Texte: text(300000, 10 + i) }]]);
  await upload(run, [{ name: 'a.jpg', type: 'image/jpeg', buffer: noise(200000, 21) }, { name: 'b.jpg', type: 'image/jpeg', buffer: noise(350000, 22) }, { name: 'a-bis.jpg', type: 'image/jpeg', buffer: noise(200000, 21) }]);
  await run.page.evaluate(async id => (await fetch(`/api/docs/${id}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: { users: { 'editor@example.com': 'editors', 'viewer@example.com': 'viewers' } } }) })).status, run.docId);
}

// La règle qui cache une table aux autres : une lecture refusée, donc plus de « copier tout » pour eux.
async function addRule(run) {
  const status = await run.page.evaluate(async id => (await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
    ['AddRecord', '_grist_ACLResources', -1, { tableId: 'Secrets', colIds: '*' }], ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD', memo: 'essai du poids' }]]) })).status, run.docId);
  check('la règle qui cache « Secrets » aux autres est posée', status === 200, status);
}

// Ce que le serveur dit, lu à part : les lectures de la fenêtre, par la session de la page de Grist, et les pièces jointes comptées d'après leurs lignes (un calcul fait ici, pas en SQL).
async function expected(run) {
  const one = async statement => Number((await sql(run, statement))[0].octets);
  const names = (await sql(run, SQL.tables)).map(row => row.tableId);
  const tables = [];
  for (const name of names) tables.push({ name, bytes: await one(SQL.table(name)) });
  const meta = await run.page.evaluate(async id => (await (await fetch(`/api/docs/${id}/tables/_grist_Attachments/records`)).json()).records.map(record => record.fields), run.docId);
  const bySum = new Map();
  for (const row of meta.filter(each => !each.timeDeleted)) bySum.set(row.fileIdent, Math.max(bySum.get(row.fileIdent) || 0, row.fileSize));
  const grist = await one("SELECT SUM(pgsize - unused) AS octets FROM dbstat WHERE NOT (name LIKE 'sqlite_%' OR name LIKE '_gristsys_%')");
  return { file: await one(SQL.file), history: await one(SQL.history), stored: await one(SQL.stored), counted: await one(SQL.counted), tables, grist, countedByRows: [...bySum.values()].reduce((a, b) => a + b, 0) };
}

// Le clic, la lecture, ce que la fenêtre montre.
async function openWindow(run) {
  const { frame } = run;
  const started = Date.now();
  await frame.locator('.ex-total').click();
  await frame.locator('.mod.wd').waitFor({ timeout: 10000 });
  await frame.waitForFunction(() => !['loading'].includes(document.querySelector('.wd-exact').dataset.state), null, { timeout: 90000 });
  return Date.now() - started;
}

const read = frame => frame.evaluate(() => {
  const clean = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    states: [...document.querySelectorAll('.wd-sec')].map(node => node.dataset.state), message: clean(document.querySelector('.wd-state')), lead: [...document.querySelectorAll('.wd-lead')].map(clean),
    lines: Object.fromEntries([...document.querySelectorAll('.wd-line')].map(line => [line.className.replace('wd-line wd-', ''), clean(line.querySelector('dd'))])),
    rows: [...document.querySelectorAll('.wd-row')].map(row => [clean(row.querySelector('.wd-name')), clean(row.querySelector('.wd-num')), row.dataset.state]), progress: clean(document.querySelector('.wd-progress')),
    focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null,
  };
});

// La fenêtre dit tout, et chaque chiffre est celui que le serveur donne.
async function checkExact(run, ms) {
  const { frame } = run;
  const [seen, want] = [await read(frame), await expected(run)];
  say(`  lecture du poids exact : ${ms} ms, ${want.tables.length} tables ; fichier ${want.file} o, historique ${want.history} o, pièces jointes ${want.stored} o (comptées ${want.counted} o), tables ${want.tables.reduce((s, r) => s + r.bytes, 0)} o`);
  check('la lecture finit en « ok » : un seul bloc sans message, sans progression', seen.states.join() === 'ok,ok' && seen.progress === '', seen);
  check('les cinq lignes disent le fichier, les tables, les pièces jointes (stockées et comptées par Grist), l\'historique et le reste, comme le serveur', checkLines(seen, want), { vu: seen.lines });
  check('chaque table dit son poids exact (celui de `dbstat`), du plus lourd au plus léger', seen.rows.length === want.tables.length && JSON.stringify(seen.rows.map(row => [row[0], row[1]])) === JSON.stringify([...want.tables].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)).map(row => [row.name, show(row.bytes)])), { vu: seen.rows.slice(0, 6) });
  check('les pièces jointes comptées par Grist (SQL) sont celles que les lignes de `_grist_Attachments` donnent (une par empreinte, sans les supprimées)', want.counted === want.countedByRows && want.counted > 0, { sql: want.counted, lignes: want.countedByRows });
  const data = want.tables.reduce((sum, row) => sum + row.bytes, 0);
  check('les tables que GFS somme sont celles de Grist moins ses tables internes (`_grist_*`) : jamais au-dessus, à moins de 10 %', data <= want.grist && data >= want.grist * 0.9, { gfs: data, grist: want.grist });
  check('le fichier est plus lourd que les tables, l\'historique et les pièces jointes ensemble : le reste (pages libres, structure) n\'est pas négatif', want.file >= data + want.history + want.stored, { file: want.file, somme: data + want.history + want.stored });
  say(`  le reste : ${want.file - (data + want.history + want.stored)} o (${show(want.file - (data + want.history + want.stored))})`);
}

function checkLines(seen, want) {
  const data = want.tables.reduce((sum, row) => sum + row.bytes, 0);
  const rest = Math.max(0, want.file - (data + want.history + want.stored));
  return seen.lines.file === show(want.file) && seen.lines.data === show(data) && seen.lines.history === show(want.history) && seen.lines.rest === show(rest)
    && seen.lines.attachments === `${show(want.stored)} · ${t('wd.attachmentsCounted', { n: show(want.counted) })}`;
}

// La fenêtre tient dans le panneau (700 × 400), son titre et son bouton restent en place pendant que le contenu défile, et rien ne sort d'elle de côté (`windowFits` de lab-pdf.mjs compterait aussi les lignes que le
// défilement cache sous le bord : ici le contenu défile).
const fits = frame => frame.evaluate(() => {
  const mod = document.querySelector('.mod.wd');
  const box = mod.getBoundingClientRect();
  const head = mod.querySelector('.mod-head').getBoundingClientRect();
  const foot = mod.querySelector('.mod-foot').getBoundingClientRect();
  const body = mod.querySelector('.wd-body');
  const outside = [...mod.querySelectorAll('.wd-body *, .mod-head *, .mod-foot *')].filter(node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); }).map(node => node.className || node.tagName).slice(0, 5);
  return { inPanel: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1, outside, scrolls: body.scrollHeight > body.clientHeight + 1 };
});

// À 700 × 400 : la fenêtre tient dans le panneau, son contenu a le contraste voulu, le clavier est sur « Fermer », Tab reste dedans, Échap la ferme et rend le clavier au total.
async function checkWindow(run, name) {
  const { page, frame } = run;
  check('la fenêtre tient dans le panneau à 700 × 400, titre et bouton en place, et ses textes ont le contraste voulu (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && (await fits(frame)).inPanel && (await fits(frame)).sticky && (await fits(frame)).outside.length === 0,
    [await contrastProblems(frame, '.mod'), await fits(frame)]);
  check('le clavier est sur « Fermer »', (await read(frame)).focus === 'weight-close');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  check('Tab reste dans la fenêtre', await frame.evaluate(() => document.querySelector('.mod.wd').contains(document.activeElement)));
  await shot(frame, name);
  await page.keyboard.press('Escape');
  await frame.locator('.mod.wd').waitFor({ state: 'detached' });
  check('Échap ferme la fenêtre et le clavier revient sur le total', await frame.evaluate(() => document.activeElement && document.activeElement.id === 'ex-total'));
}

// Sans le droit de tout copier : le bloc reste, grisé, avec la raison ; l'estimation est là.
async function checkDenied(run, ms) {
  const { frame, page } = run;
  const seen = await read(frame);
  const direct = await page.evaluate(async id => { const response = await fetch(`/api/docs/${id}/sql?q=${encodeURIComponent('SELECT 1')}`); return [response.status, (await response.text()).slice(0, 160)]; }, run.docId);
  say(`  \`/sql\` par la session de ${who} : ${direct[0]} ${direct[1]} ; la fenêtre a su en ${ms} ms`);
  check('la session elle-même est refusée sur `/sql` (403) : ce n\'est pas GFS qui se trompe', direct[0] === 403, direct);
  check('les deux blocs sont « denied », avec la raison : le droit de tout copier', seen.states.join() === 'denied,denied' && seen.message === t('wd.denied'), seen);
  check('les cinq lignes restent là, en « — » (grisées, jamais masquées), sans aucune table listée', Object.values(seen.lines).length === 5 && Object.values(seen.lines).every(value => value === t('wd.none')) && seen.rows.length === 0, seen);
  check('l\'estimation reste dans la fenêtre', Boolean(seen.lead[0]) && seen.lead[0].includes(t('wd.estimate')), seen.lead);
}

const unexpected = (run, extra = []) => run.problems.filter(problem => ![...run.allow, ...extra].some(known => known.test(problem)));

async function play(run) {
  const ms = await openWindow(run);
  if (expectation === 'denied') await checkDenied(run, ms); else await checkExact(run, ms);
  await checkWindow(run, `poids-fenetre-${lang}-${scheme}-${phase === 'seed' ? 'proprietaire' : `${who}-${expectation}`}`);
  const bad = unexpected(run, expectation === 'denied' ? [REFUSAL] : []);
  check('aucune erreur ni avertissement de GFS dans la console', bad.length === 0, bad);
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'seed') {
    const run = await openGfs(context, { lang });
    await seed(run);
    writeFileSync(STATE, JSON.stringify({ docId: run.docId, path: run.path }));
    await run.page.reload();
    await play({ ...run, frame: await reopened(run.page) });
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    if (phase === 'rules') { await addRule(run); await run.page.reload(); await play({ ...run, frame: await reopened(run.page) }); } else await play(run);
  }
} finally {
  await browser.close();
  pages.close();
}

// Le cadre de GFS (accès complet) prêt après un rechargement de la page par Grist, sa première fenêtre refermée.
async function reopened(page) {
  for (let i = 0; i < 120; i++) {
    const frame = page.frames().find(each => /\/prototype\/index\.html/.test(each.url()) && /access=full/.test(each.url()));
    if (frame && await frame.evaluate(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done').catch(() => false)) {
      await page.waitForTimeout(600);
      if (await frame.locator('.mod-scrim').count()) await page.keyboard.press('Escape');
      return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Le cadre de GFS ne s\'est pas rouvert.');
}
