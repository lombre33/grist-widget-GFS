// Le bouton « Démo » de l'explorateur (mode développement, `?dev` dans l'adresse du widget), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier : la fenêtre
// d'accord annonce ce qui sera posé, puis un seul geste pose les tables Sessions et Participants (formules calculées par Grist, Références affichées par leur numéro), installe
// Automation+ et Form+, écrit trois modèles de Publipostage+, deux règles de liaison, un automatisme éteint, un formulaire de Form+ (un repère : Form+ ne l'ouvre
// pas encore), et met GFS à droite du tableau sur les pages Participants et Sessions, qui suit la ligne choisie. Le compte rendu dit quoi faire, et la personne le fait : « Accept » sur la page, une inscription choisie, la convocation lue pour elle ; Automation+
// allumé remplit le statut des inscriptions ajoutées au tableau ; l'émargement lu pour la session choisie. Un second clic ne pose rien ; sans `?dev`, pas de bouton.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
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
check('la fenêtre annonce les tables, les modèles, l\'automatisme, le formulaire, les pages prêtes, les tables qui manquent et les pages de Grist', asked.items.length === 7 && /FormPlus_Formulaires/.test(asked.items[5]) && /Form\+/.test(asked.items[3]), asked.items.length);
check('rien n\'est écrit avant l\'accord', (await tables()).length === before.length);
await lab.shotPanel(run, '2-accord');

// 2. L'accord : un seul geste, puis le compte rendu.
await frame.locator('[data-fk="ask-yes"]').click();
await frame.waitForFunction(() => ['done', 'failed'].includes(document.body.dataset.demo), null, { timeout: 60000 });
const state = await frame.evaluate(() => document.body.dataset.demo);
check('la démo est posée', state === 'done', `${state} ${await toast()} ${errors.join(' | ')}`);
await frame.locator('.ask').waitFor();
const report = await frame.evaluate(() => ({ text: document.querySelector('.ask')?.innerText || '', steps: document.querySelectorAll('.ask .ask-items li').length, buttons: [...document.querySelectorAll('.ask button')].map(b => b.textContent) }));
say('compte rendu :', report);
check('le compte rendu donne quatre étapes, et dit que le formulaire est provisoire', report.steps === 5 && /Form\+/.test(report.text), report.steps);
check('le compte rendu a un seul bouton', report.buttons.length === 1, report.buttons);
check('le compte rendu dit le titre', report.text.includes(WORDS.ready));
check('la phrase « la démo se pose » s\'est effacée', (await toast()) === '', await toast());
await lab.shotPanel(run, '3-compte-rendu');
await frame.locator('[data-fk="ask-yes"]').click();
await page.waitForTimeout(800);

// 3. Ce que Grist a fait du geste.
const after = await tables();
say('tables après :', after);
check('les tables du parcours, des apps et de GFS sont là', ['Sessions', 'Participants', 'Publipostage_Modeles', 'Publipostage_LiensTables', 'Automation', 'FormPlus_Formulaires', 'GFS_Rangement'].every(id => after.includes(id)), after);
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
check('Automation+ et Form+ sont installées dans GFS', Boolean(kept.value && kept.value.automation && kept.value.form), kept.value);
const forms = await rows('FormPlus_Formulaires');
check('un formulaire de Form+, sans définition', forms.length === 1 && forms[0].Nom === 'Inscription à une formation' && forms[0].TypeFormulaire === 'formulaire' && !forms[0].Definition, forms.map(row => row.Nom));

// 4. L'explorateur montre les modèles.
await frame.locator('.ls-row', { hasText: WORDS.convocation }).first().waitFor({ timeout: 10000 });
const listed = await frame.locator('.ls-row').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 50)));
say('explorateur :', listed);
check('l\'explorateur montre les trois modèles et le formulaire', ['Convocation', 'Émargement', 'Attestation de formation', 'Inscription à une formation'].every(name => listed.some(line => line.includes(name))), listed);
await lab.shotPanel(run, '4-modeles');

// 5. La page prête : la personne ouvre une page dans le menu de gauche de Grist ; le tableau est à gauche, GFS à droite, sans accès ; « Accept » dans le panneau de droite.
const ACCEPT = 'Accept';
const openPage = async name => {
  await page.locator('.test-docpage-label', { hasText: new RegExp(`^${name}$`) }).first().click();
  await page.waitForTimeout(2500);
  const bare = await lab.gfsFrame(/access=none/);
  const grid = await page.locator('.gridview_data_pane').first().boundingBox();
  const box = await (await bare.frameElement()).boundingBox();
  check(`page ${name} : GFS est à droite du tableau, sans accès`, Boolean(bare && grid && box && box.x > grid.x + 100), { tableau: grid && Math.round(grid.x), gfs: box && Math.round(box.x) });
  await page.getByText('Grist Factory Suite', { exact: false }).first().click();
  await page.locator('.test-right-panel').getByRole('button', { name: ACCEPT }).click();
  await page.waitForTimeout(2500);
  const next = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(next);
  await lab.fitPanel(next, 700, 400);
  check(`page ${name} : GFS suit la table ${name}, avec l'accès complet`, await next.evaluate(() => grist.getSelectedTableId()) === name);
  return next;
};
// La personne choisit une ligne du tableau : un clic sur le numéro de la première, puis la flèche vers le bas.
const chooseRow = async index => {
  await page.locator('.gridview_data_row_num').first().click();
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(800);
};
// Un modèle ouvert depuis l'explorateur, lu en mode lecture : le texte de la page.
const readModel = async name => {
  await frame.locator('.ls-row', { hasText: name }).first().dblclick();
  const app = await lab.appFrame(/publipostage/);
  await app.waitForFunction(wanted => { const e = document.getElementById('template-name'); return Boolean(e && e.value === wanted); }, name, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await app.locator('#btn-mode-read').click();
  await app.waitForFunction(() => (document.getElementById('reader-container')?.innerText || '').length > 50, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return (await app.evaluate(() => document.getElementById('reader-container').innerText)).replace(/\s+/g, ' ');
};
frame = await openPage('Participants');
await lab.shotPanel(run, '5-page-participants', frame);
const chosen = people.findIndex(row => row.Session === sessions[1].id);
await chooseRow(chosen);
const letter = await readModel(WORDS.convocation);
say('convocation lue :', letter.slice(0, 260));
check('la convocation lue suit l\'inscription choisie et sa session', letter.includes(people[chosen].Nom) && letter.includes(sessions[1].Intitule) && letter.includes(sessions[1].Numero) && !letter.includes('#Sessions.'),
  { nom: people[chosen].Nom, session: sessions[1].Numero });
await lab.shotPanel(run, '6-convocation', frame);
await lab.shot(run, '6-page-entiere');

// 6. Automation+ allumé : une inscription ajoutée au tableau reçoit son statut (la seconde session a trois places, la première est pleine).
await lab.openModules(frame);
await frame.locator('[data-open="automation"]').click();
const flow = await lab.appFrame(/automation/);
await flow.locator('#toggle-active').waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
const drawn = await flow.evaluate(() => ({ else: document.querySelectorAll('.wire-else').length, active: document.getElementById('toggle-active')?.getAttribute('aria-pressed') }));
check('Automation+ montre l\'automatisme de Participants, éteint', drawn.else === 1 && drawn.active === 'false', drawn);
await flow.locator('#toggle-active').click();
await page.waitForTimeout(1500);
check('l\'automatisme est allumé', (await rows('Automation'))[0].Actif === true);
await lab.shotPanel(run, '7-automatisme', frame);
// Au clavier, dans la ligne d'ajout du tableau : le numéro de la session dans la colonne Session, puis Entrée.
const register = async numero => {
  await page.locator('.gridview_data_row_num').first().click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type(numero, { delay: 20 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  const all = await rows('Participants');
  return all[all.length - 1];
};
const seat = await register(sessions[1].Numero);
const full = await register(sessions[0].Numero);
say('inscriptions ajoutées :', [seat, full].map(row => ({ id: row.id, Session: row.Session, Statut: row.Statut })));
check('une inscription à la seconde session est confirmée', seat.Session === sessions[1].id && seat.Statut === 'Confirmée', seat.Statut);
check('une inscription à la session pleine passe en liste d\'attente', full.Session === sessions[0].id && full.Statut === 'Liste d’attente', full.Statut);
check('Automation+ a écrit son journal', (await rows('Automation')).some(row => row.Type === 'Log'), (await rows('Automation')).map(row => row.Type));

// 7. La page Sessions : l'émargement de la session choisie.
frame = await openPage('Sessions');
await chooseRow(1);
const sheet = await readModel('Émargement');
const listed2 = people.filter(row => row.Session === sessions[1].id).map(row => row.Nom);
say('émargement lu :', sheet.slice(0, 260));
check('l\'émargement lu est celui de la session choisie', sheet.includes(sessions[1].Numero) && listed2.every(name => sheet.includes(name)), { session: sessions[1].Numero, noms: listed2 });
await lab.shotPanel(run, '8-emargement', frame);

// 8. Un second clic : le document a déjà le parcours, rien n'est posé.
await frame.evaluate(() => { delete document.body.dataset.demo; });
const count = (await tables()).length;
if (await frame.locator('.ex').isHidden()) await frame.locator('#floater-files').click();
await button().click();
await page.waitForTimeout(800);
const said = await toast();
check('un second clic ne pose rien et le dit', WORDS.taken.test(said) && !(await frame.locator('.ask').count()) && (await tables()).length === count, said);

// 9. Sans `?dev`, pas de bouton.
const address = await frame.evaluate(() => location.href);
await frame.evaluate(() => location.replace(location.href.replace(/&dev=?(?=&|$)/, '')));
await page.waitForTimeout(1500);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
check('l\'adresse du widget n\'a plus `dev`', !/[?&]dev=?(&|$)/.test(frame.url()) && /[?&]dev=?(&|$)/.test(address), frame.url());
check('sans `?dev`, le bouton « Démo » n\'est pas là', !(await frame.locator('.ex-title-row .tb', { hasText: WORDS.button }).isVisible()));
// Avant « Accept », le cadre de GFS d'une page prête est sans accès : ce que GFS y dit est celui de run-acces-none, pas de la démo.
const own = errors.filter(text => !/Current access level none/.test(text));
say('erreurs et avertissements de GFS :', own);
check('aucune erreur ni avertissement de GFS', own.length === 0, own);
await lab.browser.close();
