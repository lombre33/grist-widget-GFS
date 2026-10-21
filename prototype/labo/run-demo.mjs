// Le bouton « Démo » de l'explorateur (mode développement, `?dev` dans l'adresse du widget), dans un vrai Grist, à 700 × 400, à la vraie souris : la fenêtre d'accord annonce ce
// qui sera posé, puis un seul geste pose les tables Sessions et Participants (formules calculées par Grist, Références affichées par leur numéro), installe Automation+, écrit
// trois modèles de Publipostage+, deux règles de liaison et un automatisme éteint ; l'explorateur montre les modèles, et la vraie Publipostage+ ouvre la convocation. Un second
// clic ne pose rien (le document a déjà le parcours) ; sans `?dev`, le bouton n'est pas là. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `demo-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { button: 'Démo', create: 'Poser la démo', ready: 'La démo est prête', taken: /déjà Sessions, Participants/, convocation: 'Convocation' }
  : { button: 'Demo', create: 'Set up the demo', ready: 'The demo is ready', taken: /already has Sessions, Participants/, convocation: 'Convocation' };
const lab = await startLab({ lang, colorScheme: scheme, query: 'dev' });
const { page } = lab;
const errors = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) errors.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
let frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
// La première ouverture montre la fenêtre des apps : la personne la ferme.
if (await frame.locator('.mod').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Ce que le document a : ses tables, et les lignes d'une table, colonne par colonne.
const tables = () => frame.evaluate(() => grist.docApi.listTables());
const rows = id => frame.evaluate(async table => {
  const data = await grist.docApi.fetchTable(table);
  return data.id.map((rowId, i) => Object.fromEntries(Object.keys(data).map(column => [column, data[column][i]])));
}, id);
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const before = await tables();
say('tables au départ :', before);

// 1. Le bouton, et la fenêtre d'accord.
const button = () => frame.locator('.ex-title-row .tb', { hasText: WORDS.button });
check('le bouton « Démo » est là en mode développement', await button().isVisible());
await lab.shotPanel(run, '1-explorateur');
await button().click();
await frame.locator('.ask').waitFor();
const asked = await frame.evaluate(() => ({
  title: document.querySelector('.ask h2, .ask .ask-title')?.textContent || '',
  items: [...document.querySelectorAll('.ask .ask-items li')].map(li => li.textContent),
  buttons: [...document.querySelectorAll('.ask button')].map(b => b.textContent),
}));
say('fenêtre d\'accord :', asked);
check('la fenêtre annonce les tables, les modèles, l\'automatisme, les tables qui manquent et les pages', asked.items.length === 5 && /Publipostage_Modeles/.test(asked.items[3]), asked.items.length);
check('rien n\'est écrit avant l\'accord', (await tables()).length === before.length);
await lab.shotPanel(run, '2-accord');

// 2. L'accord : un seul geste, puis le compte rendu.
await frame.locator('[data-fk="ask-yes"]').click();
await frame.waitForFunction(() => ['done', 'failed'].includes(document.body.dataset.demo), null, { timeout: 60000 });
const state = await frame.evaluate(() => document.body.dataset.demo);
check('la démo est posée', state === 'done', `${state} ${await toast()} ${errors.join(' | ')}`);
await frame.locator('.ask').waitFor();
const report = await frame.evaluate(() => ({ text: document.querySelector('.ask')?.innerText || '', buttons: [...document.querySelectorAll('.ask button')].map(b => b.textContent) }));
say('compte rendu :', report);
check('le compte rendu a un seul bouton', report.buttons.length === 1, report.buttons);
check('le compte rendu dit le titre', report.text.includes(WORDS.ready));
check('la phrase « la démo se pose » s\'est effacée', (await toast()) === '', await toast());
await lab.shotPanel(run, '3-compte-rendu');
await frame.locator('[data-fk="ask-yes"]').click();
await page.waitForTimeout(800);

// 3. Ce que Grist a fait du geste.
const after = await tables();
say('tables après :', after);
check('les tables du parcours, des apps et de GFS sont là', ['Sessions', 'Participants', 'Publipostage_Modeles', 'Publipostage_LiensTables', 'Automation', 'GFS_Rangement'].every(id => after.includes(id)), after);
const sessions = await rows('Sessions');
const people = await rows('Participants');
say('sessions :', sessions.map(row => ({ Numero: row.Numero, Places: row.Places, Confirmees: row.Confirmees, PlacesRestantes: row.PlacesRestantes, Debut: row.Debut })));
check('deux sessions, places restantes calculées (0 et 3)', sessions.length === 2 && sessions[0].PlacesRestantes === 0 && sessions[1].PlacesRestantes === 3, sessions.map(row => row.PlacesRestantes));
check('vingt inscriptions, chacune reliée à une session', people.length === 20 && people.every(row => sessions.some(session => session.id === row.Session)));
check('deux inscriptions à convoquer, onze attestations dues', people.filter(row => row.AConvoquer).length === 2 && people.filter(row => row.AttestationDue).length === 11,
  { aConvoquer: people.filter(row => row.AConvoquer).length, attestations: people.filter(row => row.AttestationDue).length });
const shown = await frame.evaluate(async () => {
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const at = columns.colId.findIndex((id, i) => id === 'Session' && columns.type[i] === 'Ref:Sessions');
  const visible = columns.visibleCol[at];
  return { visible: columns.colId[columns.id.indexOf(visible)], display: columns.colId[columns.id.indexOf(columns.displayCol[at])] || '' };
});
check('la Référence Session affiche le numéro de la session', shown.visible === 'Numero' && shown.display.startsWith('gristHelper_Display'), shown);
const models = await rows('Publipostage_Modeles');
say('modèles :', models.map(row => ({ Nom: row.Nom, TypeModele: row.TypeModele, NomFichierPDF: row.NomFichierPDF, Margins: row.Margins, badges: (row.Contenu.match(/var-badge/g) || []).length })));
check('trois modèles, chacun avec ses variables', models.length === 3 && models.every(row => /class="var-badge"/.test(row.Contenu)), models.map(row => row.Nom));
const links = await rows('Publipostage_LiensTables');
check('deux règles de liaison', links.length === 2 && links[1].TableCible === 'Participants' && links[1].ColonneCible === 'Session', links);
const automation = await rows('Automation');
say('automatisme :', automation.map(row => ({ Type: row.Type, Table: row.Table, Actif: row.Actif, Version: row.Version, Auteur: row.Auteur })), Object.keys(automation[0] || {}));
check('un automatisme éteint sur Participants', automation.length === 1 && automation[0].Type === 'Workflow' && automation[0].Table === 'Participants' && automation[0].Actif === false);
const kept = await lab.rangement(frame);
check('Automation+ est installée dans GFS', Boolean(kept.value && kept.value.automation), kept.value);

// 4. L'explorateur montre les modèles ; la vraie Publipostage+ ouvre la convocation.
await frame.locator('.ls-row', { hasText: WORDS.convocation }).first().waitFor({ timeout: 10000 });
const listed = await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 50)));
say('explorateur :', listed);
check('l\'explorateur montre les trois modèles', ['Convocation', 'Émargement', 'Attestation de formation'].every(name => listed.some(line => line.includes(name))), listed);
await lab.shotPanel(run, '4-modeles');
await frame.locator('.ls-row', { hasText: WORDS.convocation }).first().dblclick();
const app = await lab.appFrame(/publipostage/);
await app.waitForFunction(() => { const e = document.getElementById('template-name'); return Boolean(e && e.value === 'Convocation'); }, null, { timeout: 30000 }).catch(() => {});
const opened = await app.evaluate(() => ({ name: document.getElementById('template-name').value, badges: document.querySelectorAll('.ProseMirror .var-badge').length }));
say('Publipostage+ :', opened);
check('Publipostage+ ouvre la convocation, avec ses variables', opened.name === 'Convocation' && opened.badges >= 8, opened);
await page.waitForTimeout(1500);
await lab.shotPanel(run, '5-convocation');

// 5. La personne fait ce que dit le compte rendu : la table Participants comme données de la section (panneau de droite de Grist). Grist reconstruit le cadre ; la
// convocation lue pour l'inscription choisie montre son nom et sa session (règle de liaison) ; Automation+ montre l'automatisme, éteint.
await page.locator('.test-right-panel').getByText('Change widget', { exact: true }).click();
await page.locator('.test-wselect-table-label', { hasText: /^Participants$/ }).click();
await page.locator('.test-wselect-addBtn').click();
// Grist redemande le widget (son adresse déjà remplie), puis ses avertissements.
await page.locator('.test-custom-widget-gallery-save').click();
await page.waitForTimeout(800);
const warning = page.getByText('I confirm that I understand these warnings and accept the risks');
if (await warning.count()) { await warning.click(); await page.getByRole('button', { name: 'Confirm' }).click(); }
await page.waitForTimeout(1500);
// Le widget a changé de table : Grist remet l'accès à « aucun » et redemande l'accès complet dans le panneau de droite.
await page.locator('.test-right-panel').getByRole('button', { name: 'Accept' }).click();
await page.waitForTimeout(2500);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
check('la section suit maintenant Participants', await frame.evaluate(() => grist.getSelectedTableId()) === 'Participants');
await frame.locator('.ls-row', { hasText: WORDS.convocation }).first().dblclick();
const reader = await lab.appFrame(/publipostage/);
await reader.waitForFunction(() => { const e = document.getElementById('template-name'); return Boolean(e && e.value === 'Convocation'); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
await reader.locator('#btn-mode-read').click();
await reader.waitForFunction(() => (document.getElementById('reader-container')?.innerText || '').length > 50, null, { timeout: 15000 }).catch(() => {});
const read = (await reader.evaluate(() => document.getElementById('reader-container').innerText)).replace(/\s+/g, ' ');
const first = people[0];
const session = sessions.find(row => row.id === first.Session);
say('lecture :', read.slice(0, 300));
check('la convocation lue montre l\'inscription choisie et sa session', read.includes(first.Nom) && read.includes(session.Intitule) && read.includes(session.Numero) && !read.includes('#Sessions.'), { nom: first.Nom, session: session.Numero });
await page.waitForTimeout(800);
await lab.shotPanel(run, '6-lecture', frame);
await lab.openModules(frame);
await frame.locator('[data-open="automation"]').click();
const flow = await lab.appFrame(/automation/);
await page.waitForTimeout(4000);
const drawn = await flow.evaluate(() => ({ else: document.querySelectorAll('.wire-else').length, active: document.getElementById('toggle-active')?.getAttribute('aria-pressed'), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200) }));
say('Automation+ :', drawn);
check('Automation+ montre l\'automatisme de Participants, éteint', drawn.else === 1 && drawn.active === 'false', drawn);
await lab.shotPanel(run, '7-automatisme', frame);

// 6. Un second clic : le document a déjà le parcours, rien n'est posé.
await frame.evaluate(() => { delete document.body.dataset.demo; });
const count = (await tables()).length;
if (await frame.locator('.ex').isHidden()) await frame.locator('#floater-files').click();
await button().click();
await page.waitForTimeout(800);
const said = await toast();
check('un second clic ne pose rien et le dit', WORDS.taken.test(said) && !(await frame.locator('.ask').count()) && (await tables()).length === count, said);

// 7. Sans `?dev`, pas de bouton.
const address = await frame.evaluate(() => location.href);
await frame.evaluate(() => location.replace(location.href.replace(/&dev=?(?=&|$)/, '')));
await page.waitForTimeout(1500);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
check('l\'adresse du widget n\'a plus `dev`', !/[?&]dev=?(&|$)/.test(frame.url()) && /[?&]dev=?(&|$)/.test(address), frame.url());
check('sans `?dev`, le bouton « Démo » n\'est pas là', !(await frame.locator('.ex-title-row .tb', { hasText: WORDS.button }).isVisible()));
// Entre le changement de table et « Accept », Grist reconstruit le cadre sans accès : ce que GFS y dit est celui de run-acces-none, pas de la démo.
const own = errors.filter(text => !/Current access level none/.test(text));
say('erreurs et avertissements de GFS :', own);
check('aucune erreur ni avertissement de GFS', own.length === 0, own);
await lab.browser.close();
