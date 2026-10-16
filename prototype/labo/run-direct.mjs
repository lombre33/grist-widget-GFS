// Comment un widget apprend-il qu'une AUTRE table que la sienne a changé ? (écriture en direct de Publipostage+, consigne 012)
// Grist ne prévient un widget que des changements de la table de SA section (WidgetFrame.ts, TableNotifier). Pour une autre table il reste :
//   - la relecture (docApi.fetchTable, un appel au serveur du document) à intervalle fixe ;
//   - un widget « relais » lié à cette table, que Grist prévient, et qui passe l'information aux autres cadres de la page (BroadcastChannel).
// Trois widgets de sondes/direct/ sur deux tables d'un document de test : « ecrit » (lié à Live) écrit, « pousse » (lié à Live) est
// prévenu par Grist et relaie, « relit » (lié à Autre) relit Live à l'intervalle voulu et reçoit le relais. Une seule page, une seule horloge : le délai
// d'une ligne (de l'écriture à son arrivée) est exact. Le moteur de Grist tourne ici dans le navigateur : le RÉSEAU n'est pas mesuré (`net` le simule par
// un attente à chaque sens), le coût d'un appel au serveur non plus.
//
//   node run-direct.mjs             (lab-server.mjs lancé : REPO_DIR=<dépôt> node lab-server.mjs &)
//   DIRECT_COUNT=40 DIRECT_POLLS=100,250,500,1000 DIRECT_NET=50 DIRECT_SIZES=300,1200 REPORT=<fichier.json> node run-direct.mjs
import { writeFile } from 'node:fs/promises';
import { engine, engineName, newLabPage, say, check } from './lab-common.mjs';

const COUNT = Number(process.env.DIRECT_COUNT || 40);
const POLLS = (process.env.DIRECT_POLLS || '100,250,500,1000').split(',').map(Number);
const NET = Number(process.env.DIRECT_NET ?? 50);
const SIZES = (process.env.DIRECT_SIZES || '300,1200').split(',').map(Number).filter(Boolean);
const BASE = 'http://127.0.0.1:8911/prototype/labo/sondes/direct/index.html';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const stats = values => ({ n: values.length, min: Math.round(Math.min(...values)), median: Math.round(percentile(values, 0.5)), p90: Math.round(percentile(values, 0.9)), max: Math.round(Math.max(...values)) });
const line = (name, s) => say(`  ${name.padEnd(34)} n=${String(s.n).padStart(3)}  min ${String(s.min).padStart(4)}  médiane ${String(s.median).padStart(4)}  p90 ${String(s.p90).padStart(4)}  max ${String(s.max).padStart(4)}  (ms)`);
const report = { net: NET, phases: [] };

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox', '--font-render-hinting=none'] } : {});
const { page } = await newLabPage(browser, { lang: 'fr', width: 1500, height: 900 });
const frames = role => page.frames().filter(f => f.url().startsWith(BASE) && f.url().includes(`role=${role}`) && /access=(full|read)/.test(f.url()));
const frame = async role => { for (let i = 0; i < 60; i++) { const f = frames(role).pop(); if (f && await f.evaluate(() => window.sonde && window.sonde.ready).catch(() => false)) return f; await sleep(500); } return null; };

async function createTable(name) {
  await page.locator('.test-dp-add-new').first().click();
  await page.getByText('Add empty table', { exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('Default table name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1500);
}
async function addWidget(table, role) {
  await page.locator('.test-dp-add-new').first().click();
  await page.locator('.test-dp-add-widget-to-page').click();
  await page.waitForTimeout(500);
  await page.locator('.test-wselect-type').filter({ hasText: /^Custom$/ }).click();
  await page.locator('.test-wselect-table-label').filter({ hasText: new RegExp(`^${table}$`) }).first().click();
  await page.getByText('Add to page', { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator('.test-custom-widget-gallery-widget-name').filter({ hasText: 'Custom URL' }).click();
  await page.getByPlaceholder('Widget URL').click();
  await page.getByPlaceholder('Widget URL').pressSequentially(`${BASE}?role=${role}`, { delay: 3 });
  await page.locator('.test-custom-widget-gallery-save').click();
  await page.waitForTimeout(800);
  await page.getByText('I confirm that I understand these warnings and accept the risks').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForTimeout(3000);
  if (!(await page.locator('.test-right-panel').isVisible().catch(() => false))) { await page.mouse.click(1483, 24); await page.waitForTimeout(800); }
  await page.locator('.test-right-panel').getByRole('button', { name: 'Accept' }).click();
  await page.waitForTimeout(3500);
}

say(`\n=== Le direct : comment un widget apprend qu'une autre table a changé (${engineName}, grist-static) ===`);
await page.goto('http://127.0.0.1:8910/lab.html', { waitUntil: 'load' });
await page.waitForSelector('text=Dupont', { timeout: 90000 });
await createTable('Live');
await createTable('Autre');
await addWidget('Live', 'ecrit');
await addWidget('Live', 'pousse');
await addWidget('Autre', 'relit');
await page.waitForTimeout(4000);
let W = await frame('ecrit'); let P = await frame('pousse'); let Q = await frame('relit');
check('les trois widgets sont prêts (écrit et pousse liés à Live, relit lié à Autre)', !!(W && P && Q));
if (!(W && P && Q)) { await browser.close(); process.exit(1); }

const setNet = ms => Promise.all([W, P, Q].map(f => f.evaluate(value => { window.sonde.net = value; }, ms)));
const resetAll = () => Promise.all([P, Q].map(f => f.evaluate(() => window.sonde.reset())));
const arrivals = (f, bucket) => f.evaluate(name => window.sonde.arrivals[name].map(a => a.delay), bucket);
const waitCount = async (f, bucket, count, timeout) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if ((await arrivals(f, bucket)).length >= count) return true; await sleep(100); } return false; };

// Une série d'écritures de W ; relevé de ce que P (prévenu par Grist), Q (relais) et Q (relecture) ont vu, et du coût des relectures.
async function series(label, pollMs, count = COUNT) {
  await resetAll();
  if (pollMs) await Q.evaluate(ms => window.sonde.startPolling(ms), pollMs);
  await sleep(pollMs ? 1500 : 500);
  await resetAll();
  const t0 = Date.now();
  await W.evaluate(n => window.sonde.writeSeries({ count: n }), count);
  const seconds = (Date.now() - t0) / 1000;
  const wait = (pollMs || 0) + 3000 + 2 * NET;
  const complete = { pousse: await waitCount(P, 'pousse', count, wait), relais: await waitCount(Q, 'relais', count, wait), relit: pollMs ? await waitCount(Q, 'relit', count, wait) : true };
  const out = { label, pollMs, count, seconds, complete, write: stats(await W.evaluate(() => window.sonde.write.splice(0))), pousse: stats(await arrivals(P, 'pousse')), relais: stats(await arrivals(Q, 'relais')) };
  if (pollMs) { out.relit = stats(await arrivals(Q, 'relit')); out.poll = await Q.evaluate(() => window.sonde.summary()); out.poll.perMinute = Math.round(60000 / pollMs); await Q.evaluate(() => window.sonde.stopPolling()); }
  report.phases.push(out);
  say(`\n${label}`);
  line('écriture (aller-retour jusqu\'à Grist)', out.write);
  line('prévenu par Grist (table du widget)', out.pousse);
  line('relayé par un widget lié à la table', out.relais);
  if (pollMs) {
    line(`relecture toutes les ${pollMs} ms`, out.relit);
    say(`  une relecture : ${out.poll.fetchMedianMs.toFixed(0)} ms, ${out.poll.bytesMedian} octets ; ${out.poll.perMinute} relectures par minute`);
  }
  await sleep(1200);
  return out;
}

// 1. Le navigateur seul (net 0) : la prévenance de Grist, le relais, et la relecture à quatre cadences.
await setNet(0);
const base = await series('Prévenance seule (net 0)', 0);
check('Grist prévient le widget lié à Live de chaque ligne', base.complete.pousse, base.pousse);
check('le relais arrive jusqu\'au widget lié à une autre table', base.complete.relais, base.relais);
const polled = {};
for (const ms of POLLS) {
  const out = await series(`Relecture toutes les ${ms} ms (net 0)`, ms);
  polled[ms] = out;
  check(`relecture à ${ms} ms : toutes les lignes arrivent`, out.complete.relit, out.relit);
}
// Le modèle : la relecture arrive, en moyenne, une demi-période après la prévenance (le réseau ajoute les mêmes deux trajets aux deux).
for (const ms of POLLS) {
  const gap = polled[ms].relit.median - polled[ms].pousse.median;
  check(`modèle : relecture à ${ms} ms = prévenance + environ ${ms / 2} ms (mesuré : +${gap} ms)`, Math.abs(gap - ms / 2) <= 0.3 * ms + 40, { gap });
}

// 2. Un réseau simulé (NET ms par sens).
if (NET > 0) {
  await setNet(NET);
  const mid = POLLS.includes(250) ? 250 : POLLS[0];
  const withNet = await series(`Relecture toutes les ${mid} ms, réseau simulé ${NET} ms par sens`, mid);
  check(`réseau simulé : la relecture reste à prévenance + environ ${mid / 2} ms (+${withNet.relit.median - withNet.pousse.median} ms)`, Math.abs(withNet.relit.median - withNet.pousse.median - mid / 2) <= 0.3 * mid + 40);
  await setNet(0);
}

// 3. La taille de la table du direct : coût d'une relecture et délai (relecture à 250 ms).
for (const size of SIZES) {
  await W.evaluate(n => window.sonde.fill(n), size);
  await sleep(1500);
  await series(`Table de +${size} lignes (relecture à 250 ms)`, 250, Math.min(COUNT, 20));
  await W.evaluate(() => window.sonde.clear());
  await sleep(1500);
}

say('');
if (process.env.REPORT) await writeFile(process.env.REPORT, JSON.stringify(report, null, 2));
await browser.close();
