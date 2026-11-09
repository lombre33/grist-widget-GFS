// La colonne « Auteur » du journal d'Automation+ dans GFS (décision du porteur du 09/11, option « Oui, remplir ») avec la VRAIE Automation+, celle que GFS référence, dans un vrai Grist
// (grist-static, 700 × 400) : à la création de sa table, l'app demande une colonne `Auteur` à formule déclenchée `user.Email` ; sans la capacité « formules » GFS la refuse et l'app se rabat
// sur une colonne sans formule, qui reste vide. Avec elle (déclarée dans `manifestes/automation.json`, avec sa raison), la table naît avec la formule et Grist y met l'adresse de la personne à
// la création de la ligne : l'app n'écrit jamais d'auteur, GFS ne lui donne pas l'adresse. Le moteur du labo remplit une formule `user.Email` avec la personne du moment (`lab.setUser`).
//   LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_SANS_FORMULES=1 : le témoin (la capacité est retirée du manifeste le temps de la passe : l'ancien comportement).
//   1. Avec la capacité : la table `Automation` est créée avec la colonne `Auteur` à formule (`user.Email`, déclenchée à la création), les lignes ajoutées par l'app portent l'adresse de la
//      personne du moment, une autre personne ensuite n'efface pas la première, l'app n'a écrit aucune valeur d'auteur, GFS n'a rien dit.
//   Témoin : sans elle, la table naît sans la formule, `Auteur` reste vide, et GFS le dit en console (refus de la formule).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const CONTROL = process.env.LAB_SANS_FORMULES === '1';
const run = `auteur-automation-${lang}-${scheme}${CONTROL ? '-temoin' : ''}`;
const PEOPLE = { ana: { Email: 'ana@example.com', Name: 'Ana', IsLoggedIn: true, UserID: 7 }, bea: { Email: 'bea@example.com', Name: 'Bea', IsLoggedIn: true, UserID: 8 } };
const patches = CONTROL ? [{ chemin: '/prototype/manifestes/automation.json', de: '"formules": {', vers: '"formulesRetirees": {' }] : undefined;

const lab = await startLab({ lang, colorScheme: scheme, user: PEOPLE.ana, ...(patches ? { patches } : {}) });
const warnings = [];
const errors = [];
lab.page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
lab.page.on('pageerror', error => { if (/automation/i.test(String(error.stack || ''))) errors.push(String(error.message).slice(0, 200)); });
await lab.fitPanel(undefined, 700, 400);
const app = await lab.openApp('automation', /automation/);
await lab.page.waitForTimeout(3000);
check('Automation+ est ouverte dans GFS', Boolean(app) && (await app.evaluate(() => typeof Store !== 'undefined' && window.parent !== window)));

// Ce que l'app fait à la première écriture : la même fonction que celle qui suit son accord « Créer la table » (js/main.js `ensureStore`) ; l'accord est une fenêtre de l'app, pas de GFS.
await lab.forgetActions();
await app.evaluate(() => Store.ensureTables(grist.docApi));
const author = () => lab.frame.evaluate(async () => {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const ref = tables.id[tables.tableId.indexOf('Automation')];
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const at = columns.id.findIndex((id, i) => columns.parentId[i] === ref && columns.colId[i] === 'Auteur');
  return at < 0 ? null : { formula: columns.formula[at], isFormula: columns.isFormula[at], recalcWhen: columns.recalcWhen[at] };
});
const rows = () => lab.frame.evaluate(async () => { const data = await grist.docApi.fetchTable('Automation'); return data.id.map((id, i) => ({ id, Type: data.Type[i], Auteur: data.Auteur ? data.Auteur[i] : undefined })); });
const log = async who => {
  await lab.setUser(PEOPLE[who]);
  await app.evaluate(() => Store.appendLog(grist.docApi, { table: 'Clients', event: 'activate', row: null, result: 'success' }));
};

const column = await author();
say('colonne Auteur :', JSON.stringify(column));
if (CONTROL) {
  check('témoin : sans la capacité, la table naît avec une colonne `Auteur` sans formule', column !== null && column.formula === '', column);
  await log('ana');
  const seen = await rows();
  check('témoin : `Auteur` reste vide', seen.length === 1 && !seen[0].Auteur, seen);
  check('témoin : GFS dit le refus de la formule en console', warnings.some(text => /formule/i.test(text)), warnings);
} else {
  check('la table `Automation` naît avec la colonne `Auteur` à formule `user.Email`, déclenchée à la création de la ligne', column !== null && column.formula === 'user.Email' && column.recalcWhen === 0, column);
  await log('ana');
  await log('bea');
  const seen = await rows();
  say('lignes :', JSON.stringify(seen));
  check('Grist met l\'adresse de la personne du moment dans chaque ligne ajoutée, la première n\'est pas réécrite par la seconde', seen.length === 2 && seen[0].Auteur === 'ana@example.com' && seen[1].Auteur === 'bea@example.com', seen);
  const actions = await lab.actions();
  check('l\'app n\'a écrit aucune valeur d\'auteur (une table créée, deux lignes ajoutées)', actions.filter(each => /^AddRecord Automation/.test(each)).length === 2 && actions.some(each => /^AddTable Automation/.test(each)), actions);
  check('GFS n\'a rien dit (aucun refus de formule)', warnings.length === 0, warnings);
}
await lab.shotPanel(run, 'journal', app);
check('aucune erreur de script dans l\'app', errors.length === 0, errors);
await lab.browser.close();
