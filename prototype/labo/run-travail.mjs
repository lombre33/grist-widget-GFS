// La ligne de travail choisie dans GFS (piste 3 de « où vit GFS, quelle ligne suit chaque app », 21/10), dans un vrai Grist. GFS reste sur la page du labo : sa section
// suit la table du labo, et rien n'est réglé dans Grist. La démo pose ses tables ; une couche du labo (sondes/travail/vue-de-travail.js, injectée dans session.js pour cet
// essai seulement, GFS publié n'en sait rien) présente à l'app la table et la ligne choisies dans GFS. On mesure :
//  1. Publipostage+ lit la convocation de l'inscription choisie, puis suit un changement de ligne, sans qu'aucune section de la page montre Participants ;
//  2. Automation+, ouverte sur Participants, traite une inscription créée ailleurs (ici par la connexion de GFS), que Grist ne signale à aucune section de la page ;
//  3. le coût de la relecture : tables de 1 000, 5 000 et 20 000 lignes lues dix fois de suite ; puis la table de 20 000 lignes relue toutes les 1,5 s pendant 15 s, et
//     le retard que cela donne au fil de la page de Grist, contre 15 s sans relecture.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_SIZES=1000,5000,20000.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `travail-${lang}-${scheme}`;
const SIZES = (process.env.LAB_SIZES || '1000,5000,20000').split(',').map(Number);
const BUTTON = lang === 'fr' ? 'Démo' : 'Demo';
const INJECT = [
  { fichier: 'session.js', de: "import { label } from './manifest.js';", vers: "import { label } from './manifest.js';\nimport '../labo/sondes/travail/vue-de-travail.js';" },
  { fichier: 'session.js', de: '    this.ctx = ctx;\n', vers: '    this.ctx = globalThis.__travail.wrap(ctx);\n' },
];
const lab = await startLab({ lang, colorScheme: scheme, query: 'dev', patches: INJECT });
const { page } = lab;
const errors = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /^GFS/.test(m.text())) errors.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const rows = id => frame.evaluate(async table => {
  const data = await grist.docApi.fetchTable(table);
  return data.id.map((rowId, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
}, id);
const choose = (tableId, rowId) => frame.evaluate(([t, r]) => globalThis.__travail.choose(t, r), [tableId, rowId]);
const sectionTable = () => frame.evaluate(() => grist.getSelectedTableId());

// 0. La démo posée d'un geste ; GFS reste sur la page du labo.
await frame.locator('.ex-title-row .tb', { hasText: BUTTON }).click();
await frame.locator('.ask').waitFor();
await frame.locator('[data-fk="ask-yes"]').click();
await frame.waitForFunction(() => ['done', 'failed'].includes(document.body.dataset.demo), null, { timeout: 60000 });
check('la démo est posée', await frame.evaluate(() => document.body.dataset.demo) === 'done');
await frame.locator('[data-fk="ask-yes"]').click();
await page.waitForTimeout(800);
const home = await sectionTable();
const sessions = await rows('Sessions');
const people = await rows('Participants');
say('table de la section de GFS :', home, '; colonnes de Participants :', Object.keys(people[0]));
check('la section de GFS suit une autre table que Participants', home && home !== 'Participants', home);

// 1. Publipostage+ : la ligne de travail est une inscription de la seconde session, choisie dans GFS (ici par l'essai : aucune liste n'est dessinée).
const first = people.find(row => row.Session === sessions[1].id);
const second = people.find(row => row.Session === sessions[0].id);
await choose('Participants', first.id);
await frame.locator('.ls-row', { hasText: 'Convocation' }).first().dblclick();
const letterApp = await lab.appFrame(/publipostage/);
await letterApp.waitForFunction(() => { const e = document.getElementById('template-name'); return Boolean(e && e.value === 'Convocation'); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
await letterApp.locator('#btn-mode-read').click();
const reader = () => letterApp.evaluate(() => (document.getElementById('reader-container')?.innerText || '').replace(/\s+/g, ' '));
await letterApp.waitForFunction(name => (document.getElementById('reader-container')?.innerText || '').includes(name), first.Nom, { timeout: 15000 }).catch(() => {});
const letter = await reader();
say('convocation lue :', letter.slice(0, 220));
check('Publipostage+ lit la convocation de l\'inscription choisie dans GFS, et sa session', letter.includes(`${first.Prenom} ${first.Nom}`) && letter.includes(sessions[1].Intitule) && letter.includes(sessions[1].Numero) && !letter.includes('#Sessions.'),
  { nom: `${first.Prenom} ${first.Nom}`, session: sessions[1].Numero });
await lab.shotPanel(run, '1-convocation', frame);
await lab.shot(run, '1-page-entiere');
await choose('Participants', second.id);
await letterApp.waitForFunction(name => (document.getElementById('reader-container')?.innerText || '').includes(name), second.Nom, { timeout: 15000 }).catch(() => {});
const next = await reader();
check('la lecture suit la ligne de travail suivante', next.includes(`${second.Prenom} ${second.Nom}`) && next.includes(sessions[0].Numero) && !next.includes(`${first.Prenom} ${first.Nom}`), next.slice(0, 160));
check('la section de GFS suit toujours sa table : rien n\'a été réglé dans Grist', await sectionTable() === home);

// 2. Automation+ ouverte sur Participants, puis allumée : une inscription créée ailleurs reçoit son statut (la seconde session a trois places, la première est pleine).
await choose('Participants', first.id);
await lab.openModules(frame);
await frame.locator('[data-open="automation"]').click();
const flow = await lab.appFrame(/automation/);
await flow.locator('#toggle-active').waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
const drawn = await flow.evaluate(() => ({ else: document.querySelectorAll('.wire-else').length, active: document.getElementById('toggle-active')?.getAttribute('aria-pressed') }));
check('Automation+ montre l\'automatisme de Participants, table d\'aucune section de la page', drawn.else === 1 && drawn.active === 'false', drawn);
await flow.locator('#toggle-active').click();
await page.waitForTimeout(1500);
check('l\'automatisme est allumé', (await rows('Automation'))[0].Actif === true);
const register = async (session, nom) => {
  const started = Date.now();
  const id = await frame.evaluate(async ([s, n]) => (await grist.docApi.applyUserActions([['AddRecord', 'Participants', null, { Session: s, Nom: n, Prenom: 'Essai' }]])).retValues[0], [session, nom]);
  for (let i = 0; i < 60; i++) {
    const row = (await rows('Participants')).find(r => r.id === id);
    if (row && row.Statut) return { ...row, ms: Date.now() - started };
    await page.waitForTimeout(250);
  }
  return { id, Statut: '', ms: Date.now() - started };
};
const seat = await register(sessions[1].id, 'Travail-A');
const full = await register(sessions[0].id, 'Travail-B');
say('inscriptions créées ailleurs :', [seat, full].map(row => ({ id: row.id, Statut: row.Statut, 'traitée en (ms)': row.ms })));
check('une inscription créée ailleurs à la seconde session est confirmée', seat.Statut === 'Confirmée', seat.Statut);
check('une inscription créée ailleurs à la session pleine passe en liste d\'attente', full.Statut === 'Liste d’attente', full.Statut);
await lab.shotPanel(run, '2-automatisme', frame);
const used = await frame.evaluate(() => { const s = globalThis.__travail.stats; const ms = s.reads.map(r => r.ms).sort((a, b) => a - b); return { lectures: s.reads.length, relectures: s.polls, changements: s.changes, messages: s.messages, mediane: ms[Math.floor(ms.length / 2)], max: ms.at(-1) }; });
say('ligne de travail, jusqu\'ici :', used);

// 3. Le coût de la relecture : GFS rechargé (aucune app ouverte, aucune ligne de travail), des tables de mesure, puis la plus grande relue à intervalle.
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1500);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
for (const size of SIZES) {
  const id = `Mesure${size}`;
  const started = Date.now();
  await frame.evaluate(async ([table, n, session]) => {
    await grist.docApi.applyUserActions([['AddTable', table, [{ id: 'Texte', type: 'Text' }, { id: 'Nombre', type: 'Numeric' }, { id: 'Jour', type: 'Date' }, { id: 'Case', type: 'Bool' },
      { id: 'Choix', type: 'Choice' }, { id: 'Session', type: 'Ref:Sessions' }]]]);
    for (let from = 0; from < n; from += 5000) {
      const count = Math.min(5000, n - from);
      const range = Array.from({ length: count }, (x, i) => from + i);
      await grist.docApi.applyUserActions([['BulkAddRecord', table, range.map(() => null), { Texte: range.map(i => `Ligne ${i} de la table de mesure`), Nombre: range.map(i => i * 1.5),
        Jour: range.map(i => 1760000000 + (i % 365) * 86400), Case: range.map(i => i % 2 === 0), Choix: range.map(i => ['A', 'B', 'C'][i % 3]), Session: range.map(() => session) }]]);
    }
  }, [id, size, sessions[0].id]);
  say(`table ${id} posée en ${Date.now() - started} ms`);
}
await page.waitForTimeout(5000);
const costs = [];
for (const size of SIZES) costs.push(await frame.evaluate(id => globalThis.__travail.measure(id, 10), `Mesure${size}`));
say('relecture seule (10 de suite) :', costs);
check('les tables de mesure ont le bon nombre de lignes', costs.every(cost => cost.octets > 0));
// Le retard du fil de la page de Grist : un minuteur de 50 ms, et de combien il arrive en retard (le cadre de GFS et la page de Grist partagent ce fil).
const lag = ms => page.evaluate(duration => new Promise(resolve => {
  const lags = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    lags.push(now - last - 50);
    last = now;
    if (lags.length * 50 < duration) setTimeout(tick, 50);
    else resolve({ max: Math.round(Math.max(...lags)), sup50: lags.filter(l => l > 50).length, mesures: lags.length });
  };
  setTimeout(tick, 50);
}), ms);
const calm = await lag(15000);
const biggest = `Mesure${SIZES.at(-1)}`;
await choose(biggest, 1);
const busy = await lag(15000);
const polled = await frame.evaluate(() => { const s = globalThis.__travail.stats; const ms = s.reads.map(r => r.ms).sort((a, b) => a - b); return { relectures: s.polls, mediane: ms[Math.floor(ms.length / 2)], max: ms.at(-1), octets: s.reads.at(-1).octets }; });
say('fil de Grist sans relecture :', calm, '; avec la relecture de', biggest, 'toutes les 1,5 s :', busy, polled);
check('la relecture tourne', polled.relectures >= 8, polled.relectures);
const own = errors.filter(text => !/Current access level none/.test(text));
say('erreurs et avertissements de GFS :', own);
check('aucune erreur ni avertissement de GFS', own.length === 0, own);
await lab.browser.close();
