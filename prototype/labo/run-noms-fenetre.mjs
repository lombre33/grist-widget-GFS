// La fenêtre commune de mise à jour des noms (kit 0.29.0, js/names-update/), DANS GFS, dans un VRAI Grist (grist-static, 700 × 400) avec la VRAIE Publipostage+ : son cadre isolé, son
// `SchemaColumns.planRenames` pour le lot, le courtier de GFS entre les deux (capacité `renommage`), et la fenêtre du kit chargée depuis `prototype/kit` (la copie du kit que Publipostage+
// porte aujourd'hui est la 0.27.0 : elle ne l'a pas encore). À la vraie souris et au vrai clavier.
//   REPO_DIR="$(realpath ../..)" node lab-server.mjs &   puis   REPO_DIR="$(realpath ../..)" node run-noms-fenetre.mjs        (VARIANT=clean|sync, LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   clean : un document aux noms d'avant, un propriétaire : la fenêtre s'ouvre, ne se ferme pas toute seule, « Mettre à jour » renomme tout en un lot, rien n'est perdu, et la fois suivante rien.
//   sync  : la table des modèles porte la colonne `id_sync` (un partage Sync+ s'en sert) : elle garde son nom et ses colonnes, la fenêtre le dit, le reste est renommé.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { legacyDocument, planInFrame, frameTables, frameRows } from './lab-noms.mjs';

const variant = process.env.VARIANT || 'clean';
const lang = process.env.LAB_LANG || 'fr';
// Sans Sync+ : deux tables renommées (les modèles et leurs préférences : 5 + 2 lignes) ; avec : une seule (les préférences : 2 lignes), les modèles sont gardés.
const synced = variant === 'sync';
const words = lang === 'fr'
  ? { start: 'Mettre à jour', next: 'Continuer', held: 'Une table garde son ancien nom',
    done: synced ? 'Terminé : 1 table mise à jour, 2 lignes vérifiées avant et après, aucune modifiée.' : 'Terminé : 2 tables mises à jour, 7 lignes vérifiées avant et après, aucune modifiée.' }
  : { start: 'Update', next: 'Continue', held: 'One table keeps its old name',
    done: synced ? 'Done: 1 table updated, 2 rows checked before and after, none changed.' : 'Done: 2 tables updated, 7 rows checked before and after, none changed.' };
const lab = await startLab({ lang, colorScheme: process.env.LAB_SCHEME || 'light' });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
await lab.frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage');
await page.waitForTimeout(4000);
const consent = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
if (await consent.count()) { await consent.first().click(); await page.waitForTimeout(6000); }

const start = await legacyDocument(app, variant === 'sync' ? ['id_sync', 'MajLe'] : []);
check('témoin : le document est aux noms d\'avant (tables d\'avant, lignes posées)', start.gone.ok && start.made.ok && start.added.ok, start);
say('   tables avant :', JSON.stringify(await frameTables(app)));

// Le lot de l'app, calculé dans son cadre (son `planRenames`), puis la fenêtre du kit avec un port fait de ce que l'app lit et envoie par le courtier. `isOwner` : la preuve de propriété est
// celle de GFS (mesurée dans un vrai serveur, run-noms-droits) ; grist-static n'a pas de serveur pour la donner.
await app.evaluate(`window.__planRenames = ${planInFrame.toString()}`);
await lab.forgetActions();
await app.evaluate(async () => {
  const base = new URL('../../kit/', location.href);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('css/names-update.css', base).href;
  document.head.append(link);
  const { I18n } = await import(new URL('js/i18n.js', base).href);
  I18n.init({ storageKey: null });
  const { NamesUpdate } = await import(new URL('js/names-update/index.js', base).href);
  const port = {
    isOwner: async () => true,
    apply: actions => grist.docApi.applyUserActions(actions),
    rowCount: async id => (await grist.docApi.fetchTable(id)).id.length,
    readSchema: async () => {
      const t = await grist.docApi.fetchTable('_grist_Tables');
      const c = await grist.docApi.fetchTable('_grist_Tables_column');
      const byRef = new Map(t.id.map((id, i) => [id, t.tableId[i]]));
      const tables = {};
      t.tableId.filter(id => !/^_?grist/i.test(id)).forEach(id => { tables[id] = []; });
      c.id.forEach((id, i) => { const table = byRef.get(c.parentId[i]); if (table && tables[table]) tables[table].push(c.colId[i]); });
      return { tables };
    },
  };
  window.__nuPort = port;
  window.__nu = { outcome: null };
  NamesUpdate.run({ port, plan: () => window.__planRenames(), appName: 'Publipostage+' }).then(outcome => { window.__nu.outcome = outcome; });
});

const MODAL = '#nu-modal';
await app.waitForSelector(MODAL, { state: 'visible', timeout: 15000 });
await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/noms-fenetre-${variant}-${lang}.png` });
const buttons = () => app.$$eval(`${MODAL} .pp-modal-actions button:not([hidden])`, list => list.map(button => button.textContent));
const bodyText = () => app.$eval(`${MODAL} .nu-body`, el => el.textContent);
async function clickButton(text) {
  const box = await app.locator(`${MODAL} .pp-modal-actions button:not([hidden])`).filter({ hasText: text }).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const geometry = await app.evaluate(selector => {
  const box = document.querySelector(`${selector} .pp-modal-box`).getBoundingClientRect();
  const actions = document.querySelector(`${selector} .pp-modal-actions`).getBoundingClientRect();
  return { width: innerWidth, height: innerHeight, left: box.left, top: box.top, right: box.right, bottom: box.bottom, actionsBottom: actions.bottom };
}, MODAL);
say('   cadre :', JSON.stringify(geometry));
check('la fenêtre s\'ouvre toute seule dans le cadre de l\'app et tient dans le panneau, bouton visible', geometry.left >= 11 && geometry.top >= 11 && geometry.right <= geometry.width - 11 && geometry.bottom <= geometry.height - 11 && geometry.actionsBottom <= geometry.height, geometry);
// Publipostage+ habille ses fenêtres à sa façon (son cadre est un `.modal-content`) et ne charge pas la feuille des fenêtres du kit : la fenêtre doit se tenir seule (vu dans ce labo avec la
// première version de la feuille : le texte flottait sur la page, sans fond ni bouton).
const look = await app.evaluate(selector => {
  const box = getComputedStyle(document.querySelector(`${selector} .pp-modal-box`));
  const primary = getComputedStyle(document.querySelector(`${selector} .pp-modal-primary`));
  return { box: box.backgroundColor, radius: box.borderRadius, shadow: box.boxShadow !== 'none', primary: primary.backgroundColor, primaryText: primary.color };
}, MODAL);
say('   aspect :', JSON.stringify(look));
// Les jetons que la feuille de la fenêtre emploie existent-ils dans la page de l'app ? Un jeton absent annule la déclaration (un `z-index: var(--z-dialog)` sans jeton donne `auto` : la fenêtre
// passait SOUS la barre repliable de Publipostage+, vu dans ce labo) ; seul `--z-dialog` a un repli dans la feuille.
const tokens = ['--surface', '--surface-sunken', '--text', '--text-muted', '--border-strong', '--accent', '--accent-ink', '--accent-solid', '--accent-solid-hover', '--on-accent', '--accent-soft',
  '--accent-soft-border', '--good', '--danger-ink', '--shadow-float', '--radius-sm', '--font-ui'];
const missing = await app.evaluate(names => names.filter(name => !getComputedStyle(document.documentElement).getPropertyValue(name).trim()), tokens);
check('tous les jetons de la charte que la feuille emploie existent dans la page de l\'app', missing.length === 0, missing);
const stacking = await app.evaluate(selector => {
  const modal = document.querySelector(selector);
  const above = [...document.querySelectorAll('*')].filter(el => el !== modal && !modal.contains(el) && getComputedStyle(el).position !== 'static' && getComputedStyle(el).display !== 'none'
    && Number(getComputedStyle(el).zIndex) >= Number(getComputedStyle(modal).zIndex)).map(el => `${el.tagName.toLowerCase()}#${el.id}.${String(el.className).slice(0, 30)}:${getComputedStyle(el).zIndex}`);
  return { zIndex: getComputedStyle(modal).zIndex, above: above.slice(0, 5) };
}, MODAL);
check('la fenêtre est au-dessus de tout ce que la page de l\'app empile (un niveau numérique d\'au moins 2000, aucun élément positionné au même niveau ou plus haut)',
  Number.isFinite(Number(stacking.zIndex)) && Number(stacking.zIndex) >= 2000 && stacking.above.length === 0, stacking);
check('le cadre a un fond plein, des coins et une ombre, et le bouton principal est plein : rien ne flotte sur la page de l\'app',
  look.box !== 'rgba(0, 0, 0, 0)' && look.radius !== '0px' && look.shadow && look.primary !== 'rgba(0, 0, 0, 0)' && look.primary !== look.box, look);
check(`un seul bouton, « ${words.start} » (fenêtre bloquante)`, (await buttons()).join() === words.start, await buttons());
const text = await bodyText();
check('elle dit : mêmes lignes (données inchangées) et quelques secondes', /(mêmes lignes|same rows)/.test(text) && /(quelques secondes|a few seconds)/.test(text), text.slice(0, 200));
if (variant === 'sync') check('elle dit qu\'une table garde son ancien nom parce que Sync+ s\'en sert, et laquelle', text.includes(words.held) && text.includes('Publipostage_Modeles'), text.slice(-240));
else check('aucun bandeau Sync+ quand aucune table n\'est gardée', !text.includes(words.held));
const tablesBefore = await frameTables(app);
await page.keyboard.press('Escape');
await page.mouse.click(5, 5);
check('Échap et un clic sur le voile ne ferment rien, et rien n\'est écrit tant qu\'on n\'a pas cliqué', (await app.$(MODAL)) !== null && (await app.$eval(MODAL, el => getComputedStyle(el).display)) !== 'none'
  && JSON.stringify(await frameTables(app)) === JSON.stringify(tablesBefore) && !(await lab.actions()).some(line => /^RenameTable /.test(line)));

await clickButton(words.start);
await app.waitForFunction(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent), null, { timeout: 20000 });
const after = await bodyText();
say('   résultat :', after);
check(`le résultat : « ${words.done} »`, after === words.done, after);
const received = await lab.actions();
check('le vrai moteur de Grist a reçu les renommages (par le courtier, capacité « renommage »)', received.filter(line => /^RenameTable /.test(line)).length === (synced ? 1 : 2), received.slice(0, 6));
const tables = await frameTables(app);
say('   tables après :', JSON.stringify(tables));
const models = await frameRows(app, variant === 'sync' ? 'Publipostage_Modeles' : 'Publipostage_Templates');
const prefs = await frameRows(app, 'Publipostage_TemplatePreferences');
check('aucune ligne perdue : cinq modèles et deux préférences, mêmes numéros et mêmes contenus', models.length === 5 && prefs.length === 2
  && start.before.modeles.every((row, i) => models[i].id === row.id && (models[i].Name ?? models[i].Nom) === row.Nom && (models[i].Content ?? models[i].Contenu) === row.Contenu)
  && start.before.prefs.every((row, i) => prefs[i].id === row.id && prefs[i].User === row.Utilisateur && prefs[i].TemplateId === row.ModeleId), { models: models.length, prefs: prefs.length });
if (variant === 'sync') {
  const columns = await app.evaluate(async () => {
    const t = await grist.docApi.fetchTable('_grist_Tables');
    const c = await grist.docApi.fetchTable('_grist_Tables_column');
    const ref = t.id[t.tableId.indexOf('Publipostage_Modeles')];
    return c.colId.filter((id, i) => c.parentId[i] === ref);
  });
  check('la table de Sync+ garde son nom ET ses colonnes (Nom, id_sync, MajLe : aucune renommée)', tables.includes('Publipostage_Modeles') && !tables.includes('Publipostage_Templates') && ['Nom', 'Jeton', 'id_sync', 'MajLe'].every(id => columns.includes(id)) && !columns.includes('Name'), columns);
  check('les préférences, elles, sont renommées', tables.includes('Publipostage_TemplatePreferences') && !tables.includes('Publipostage_PreferencesModeles'), tables);
} else {
  check('toutes les tables d\'avant sont renommées, aucune ne reste à côté', tables.includes('Publipostage_Templates') && tables.includes('Publipostage_TemplatePreferences') && !tables.includes('Publipostage_Modeles') && !tables.includes('Publipostage_PreferencesModeles'), tables);
}
check(`« ${words.next} » seul, avec le focus`, (await buttons()).join() === words.next && (await app.evaluate(() => document.activeElement && document.activeElement.textContent)) === words.next, await buttons());
await clickButton(words.next);
const outcome = await app.evaluate(() => window.__nu.outcome);
check('« Continuer » ferme la fenêtre et rend « done » à l\'app', Boolean(outcome) && outcome.state === 'done' && (await app.$(MODAL)) === null, outcome);
check('l\'app est prévenue des tables gardées', JSON.stringify(outcome.held) === JSON.stringify(variant === 'sync' ? ['Publipostage_Modeles'] : []), outcome.held);

// La fois suivante : rien à faire, pas de fenêtre (pour la variante sync, la table gardée ne compte pas).
const again = await app.evaluate(async () => {
  const { NamesUpdate } = await import(new URL('../../kit/js/names-update/index.js', location.href).href);
  const run = await NamesUpdate.prepare({ port: window.__nuPort, plan: () => window.__planRenames() }).catch(error => ({ state: `erreur : ${error.message}` }));
  return run.state;
});
check('la fois suivante : rien à faire, donc pas de fenêtre (même quand Sync+ garde une table)', again === 'none' && (await app.$(MODAL)) === null, again);
await lab.browser.close();
