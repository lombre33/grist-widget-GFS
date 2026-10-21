// La ligne de travail choisie dans GFS (contrats 4.5), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier. GFS reste sur la page Clients : sa section
// suit Clients, et rien n'est réglé dans Grist. La démo pose ses tables ; la personne ouvre la convocation, puis choisit, par le bouton « Table et ligne de travail » de la
// barre de GFS, la table Participants et une inscription (recherche au clavier, mots dans le désordre) : l'app est rouverte sur elle, la convocation lue est la sienne.
// Une autre ligne de la même table : la lecture suit, sans rouvrir. « La table de la page » rend la main à la section. Automation+, ouverte sur Participants, traite une
// inscription créée ailleurs (relue par GFS). LAB_LANG=fr|en, LAB_SCHEME=light|dark. LAB_COUT=1 ajoute le coût de la relecture de tables de 1 000 à 20 000 lignes
// (LAB_SIZES) et le retard qu'elle donne au fil de la page de Grist.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `travail-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { button: 'Démo', page: 'La table de la page : Clients', tip: /^Table et ligne de travail : Participants, /, tipPage: /celles de la page \(Clients\)/, back: 'Tables' }
  : { button: 'Demo', page: 'The page’s table: Clients', tip: /^Working table and row: Participants, /, tipPage: /the page’s \(Clients\)/, back: 'Tables' };
const lab = await startLab({ lang, colorScheme: scheme, query: 'dev' });
const { page } = lab;
const errors = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /^GFS/.test(m.text())) errors.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const rows = id => frame.evaluate(async table => {
  const data = await grist.docApi.fetchTable(table);
  return data.id.map((rowId, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
}, id);
const workButton = () => frame.locator('#floater-work');
const items = () => frame.locator('.wk-item').allInnerTexts().then(list => list.map(text => text.replace(/\s+/g, ' ').trim()));
const reader = app => app.evaluate(() => (document.getElementById('reader-container')?.innerText || '').replace(/\s+/g, ' '));
const readerHas = (app, text) => app.waitForFunction(wanted => (document.getElementById('reader-container')?.innerText || '').includes(wanted), text, { timeout: 15000 }).catch(() => {});
// L'app de Publipostage+ ouverte en ce moment (un cadre rouvert est un autre cadre), son modèle chargé, en mode lecture.
const readingApp = async () => {
  const app = await lab.appFrame(/publipostage/);
  await app.waitForFunction(() => { const e = document.getElementById('template-name'); return Boolean(e && e.value === 'Convocation'); }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  if (!(await app.locator('#btn-mode-read').getAttribute('class') || '').includes('active')) await app.locator('#btn-mode-read').click();
  return app;
};

// 0. La démo posée d'un geste ; GFS reste sur la page Clients.
await frame.locator('.ex-title-row .tb', { hasText: WORDS.button }).click();
await frame.locator('.ask').waitFor();
await frame.locator('[data-fk="ask-yes"]').click();
await frame.waitForFunction(() => ['done', 'failed'].includes(document.body.dataset.demo), null, { timeout: 60000 });
check('la démo est posée', await frame.evaluate(() => document.body.dataset.demo) === 'done');
await frame.locator('[data-fk="ask-yes"]').click();
await page.waitForTimeout(800);
const sessions = await rows('Sessions');
const people = await rows('Participants');
const first = people.find(row => row.Session === sessions[1].id);
const second = people.find(row => row.Session === sessions[0].id);
const name = row => `${row.Prenom} ${row.Nom}`;

// 1. La convocation ouverte depuis l'explorateur : elle suit la page (Clients) ; le bouton le dit.
await frame.locator('.ls-row', { hasText: 'Convocation' }).first().dblclick();
let app = await readingApp();
check('le bouton « Table et ligne de travail » est dans la barre, relâché, et dit que la page décide', await workButton().getAttribute('aria-pressed') === 'false' && WORDS.tipPage.test(await workButton().getAttribute('title')),
  await workButton().getAttribute('title'));

// 2. La fenêtre : la page d'abord, puis les tables de données, sans celles de Grist, de GFS ni des apps.
await workButton().click();
await frame.locator('.wk').waitFor();
const tables = await items();
say('tables proposées :', tables);
check('la fenêtre propose la page, puis Clients, Sessions et Participants, et aucune table d\'app ni de GFS', tables[0] === WORDS.page && ['Clients', 'Sessions', 'Participants'].every(id => tables.includes(id))
  && !tables.some(text => /Publipostage_|GFS_|^Automation|FormPlus_/.test(text)), tables);
check('la recherche a le clavier', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'work-search'));
await lab.shotPanel(run, '1-tables', frame);
await page.keyboard.type('partic', { delay: 20 });
check('la recherche ne garde que Participants', JSON.stringify(await items()) === JSON.stringify(['Participants']), await items());
await frame.locator('.wk-item', { hasText: 'Participants' }).click();
await frame.locator('.wk-back').waitFor({ state: 'visible' });
await frame.waitForFunction(() => document.querySelectorAll('.wk-item').length > 5, null, { timeout: 15000 });
check('les lignes de Participants sont là, avec leur texte', (await items()).some(text => text.includes(first.Nom)), (await items()).slice(0, 3));
await lab.shotPanel(run, '2-lignes', frame);
// Les mots dans le désordre, sans accents ni majuscules : le prénom après le nom.
const typed = `${first.Nom} ${first.Prenom}`.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(' ').reverse().join(' ');
await page.keyboard.type(typed, { delay: 15 });
await page.waitForTimeout(300);
const found = await items();
check('la recherche retrouve l\'inscription, mots dans le désordre, accents ignorés', found.length >= 1 && found[0].includes(first.Nom), { tape: typed, trouve: found });
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
check('la fenêtre s\'est fermée', !(await frame.locator('.wk').count()));

// 3. L'app rouverte sur la ligne de travail : la convocation de l'inscription choisie, Grist n'a rien changé.
app = await readingApp();
await readerHas(app, first.Nom);
const letter = await reader(app);
say('convocation lue :', letter.slice(0, 200));
check('la convocation lue est celle de l\'inscription choisie, et de sa session', letter.includes(name(first)) && letter.includes(sessions[1].Numero), { nom: name(first), session: sessions[1].Numero });
check('la section de GFS suit toujours Clients', await frame.evaluate(() => grist.getSelectedTableId()) === 'Clients');
check('le bouton est enfoncé et dit la table et la ligne', await workButton().getAttribute('aria-pressed') === 'true' && WORDS.tip.test(await workButton().getAttribute('title')), await workButton().getAttribute('title'));
await lab.shotPanel(run, '3-convocation', frame);
await lab.shot(run, '3-page-entiere');

// 4. Une autre ligne de la même table, à la souris : la lecture suit, le cadre n'est pas rouvert.
const before = app;
await workButton().click();
await frame.locator('.wk').waitFor();
check('la table choisie est marquée', await frame.locator('.wk-item[aria-current="true"]').innerText().then(text => text.trim()) === 'Participants');
await frame.locator('.wk-item', { hasText: 'Participants' }).click();
await frame.waitForFunction(() => document.querySelectorAll('.wk-item').length > 5, null, { timeout: 15000 });
check('la ligne choisie est marquée', (await frame.locator('.wk-item[aria-current="true"]').innerText()).includes(first.Nom));
await frame.locator('.wk-item', { hasText: second.Nom }).first().click();
await readerHas(app, second.Nom);
const next = await reader(app);
check('la lecture suit l\'autre ligne, sans rouvrir l\'app', next.includes(name(second)) && next.includes(sessions[0].Numero) && !next.includes(name(first)) && !before.isDetached(), next.slice(0, 120));

// 5. La table de la page : la section décide de nouveau, l'app est rouverte sur Clients.
await workButton().click();
await frame.locator('.wk').waitFor();
await frame.locator('.wk-item').first().click();
await page.waitForTimeout(1500);
app = await lab.appFrame(/publipostage/);
await page.waitForTimeout(1500);
check('revenue à la page : le bouton est relâché', await workButton().getAttribute('aria-pressed') === 'false');
check('l\'app suit de nouveau la table de la page', before.isDetached() && await app.evaluate(() => grist.getSelectedTableId && grist.getSelectedTableId()).catch(() => null) !== 'Participants');

// 6. Automation+ sur Participants : la ligne de travail d'abord, puis l'app ; une inscription créée ailleurs reçoit son statut.
await workButton().click();
await frame.locator('.wk').waitFor();
await frame.locator('.wk-item', { hasText: 'Participants' }).click();
await frame.waitForFunction(() => document.querySelectorAll('.wk-item').length > 5, null, { timeout: 15000 });
await frame.locator('.wk-item').first().click();
await page.waitForTimeout(1500);
await lab.openModules(frame);
await frame.locator('[data-open="automation"]').click();
const flow = await lab.appFrame(/automation/);
await flow.locator('#toggle-active').waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
const drawn = await flow.evaluate(() => ({ else: document.querySelectorAll('.wire-else').length, active: document.getElementById('toggle-active')?.getAttribute('aria-pressed') }));
check('Automation+ s\'ouvre sur l\'automatisme de Participants, table d\'aucune section de la page', drawn.else === 1 && drawn.active === 'false', drawn);
await flow.locator('#toggle-active').click();
await page.waitForTimeout(1500);
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
await lab.shotPanel(run, '4-automatisme', frame);

// 7. Facultatif : le coût de la relecture (contrats 4.5, point 4).
if (process.env.LAB_COUT === '1') await measureCost();
const own = errors.filter(text => !/Current access level none/.test(text));
say('erreurs et avertissements de GFS :', own);
check('aucune erreur ni avertissement de GFS', own.length === 0, own);
await lab.browser.close();

// Des tables de 1 000 à 20 000 lignes (six colonnes), lues dix fois de suite par GFS ; puis le retard du fil de la page de Grist (un minuteur de 50 ms, et de combien il
// arrive en retard) pendant 15 s sans relecture, et pendant 15 s avec la plus grande comme ligne de travail, Automation+ ouverte dessus.
async function measureCost() {
  const sizes = (process.env.LAB_SIZES || '1000,5000,20000').split(',').map(Number);
  for (const size of sizes) {
    await frame.evaluate(async ([table, n, session]) => {
      await grist.docApi.applyUserActions([['AddTable', table, [{ id: 'Texte', type: 'Text' }, { id: 'Nombre', type: 'Numeric' }, { id: 'Jour', type: 'Date' }, { id: 'Case', type: 'Bool' },
        { id: 'Choix', type: 'Choice' }, { id: 'Session', type: 'Ref:Sessions' }]]]);
      for (let from = 0; from < n; from += 5000) {
        const range = Array.from({ length: Math.min(5000, n - from) }, (x, i) => from + i);
        await grist.docApi.applyUserActions([['BulkAddRecord', table, range.map(() => null), { Texte: range.map(i => `Ligne ${i} de la table de mesure`), Nombre: range.map(i => i * 1.5),
          Jour: range.map(i => 1760000000 + (i % 365) * 86400), Case: range.map(i => i % 2 === 0), Choix: range.map(i => ['A', 'B', 'C'][i % 3]), Session: range.map(() => session) }]]);
      }
    }, [`Mesure${size}`, size, sessions[0].id]);
  }
  await page.waitForTimeout(5000);
  const costs = [];
  for (const size of sizes) {
    costs.push(await frame.evaluate(async id => {
      const runs = [];
      let octets = 0;
      for (let i = 0; i < 10; i++) { const t0 = performance.now(); octets = JSON.stringify(await grist.docApi.fetchTable(id)).length; runs.push(performance.now() - t0); }
      runs.sort((a, b) => a - b);
      return { id, mediane: Math.round(runs[5]), max: Math.round(runs[9]), octets };
    }, `Mesure${size}`));
  }
  say('relecture seule (10 de suite) :', costs);
  const lag = ms => page.evaluate(duration => new Promise(resolve => {
    const lags = [];
    let last = performance.now();
    const tick = () => { const now = performance.now(); lags.push(now - last - 50); last = now; if (lags.length * 50 < duration) setTimeout(tick, 50); else resolve({ max: Math.round(Math.max(...lags)), sup50: lags.filter(l => l > 50).length }); };
    setTimeout(tick, 50);
  }), ms);
  const calm = await lag(15000);
  await workButton().click();
  await frame.locator('.wk').waitFor();
  await frame.locator('.wk-item', { hasText: `Mesure${sizes.at(-1)}` }).click();
  await frame.waitForFunction(() => document.querySelectorAll('.wk-item').length > 5, null, { timeout: 30000 });
  say('la fenêtre dit :', await frame.locator('.mod-note').innerText());
  await frame.locator('.wk-item').first().click();
  await page.waitForTimeout(3000);
  say('fil de Grist sans relecture :', calm, '; avec la relecture de', `Mesure${sizes.at(-1)}`, ':', await lag(15000));
}
