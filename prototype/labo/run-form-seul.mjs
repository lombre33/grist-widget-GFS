// Form+ sans GFS (référencée à c249c4a), directement comme widget personnalisé de Grist (grist-static), à la vraie souris et au vrai clavier. Le point de comparaison de `run-form` :
//   1. « Partir de zéro » : le cadre de Form+ est-il rechargé, et le champ que Grist ajoute tout seul à la section de formulaire est-il retiré, quand GFS n'est pas là ?
//   2. Enregistrer le formulaire de la page du widget (celui de 1), deux fois (la personne recommence quand rien n'a été enregistré) : Grist recharge le cadre de Form+ avant que la ligne soit écrite.
//   3. Enregistrer un formulaire sur SA page (consignes 007 et 008) : aucune section de garde, aucun cadre rechargé, la ligne de la copie gérée et son champ caché `FormPlusDef` ; le même lien
//      deux fois ne copie rien de plus ; un second formulaire a sa ligne.
import { startLab } from './lab-setup.mjs';
import { savedForms, saveByLink, pasteLink, ownPageForm } from './form-lab.mjs';
import { say, check } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/apps/form/poc/widget.html';
const lab = await startLab({ widget: WIDGET, lang: process.env.LAB_LANG || 'fr', colorScheme: process.env.LAB_SCHEME || 'light' });
const { page } = lab;
const widgetFrame = () => page.frames().find(frame => frame.url().startsWith(WIDGET) && !frame.isDetached());
const constat = (label, ok, detail) => (ok ? say('OK    ', label) : say('CONSTAT', label, detail));

// ----- 1. « Partir de zéro ».
const first = lab.frame;
await first.waitForSelector('[data-startgo="scratch"]', { timeout: 30000 });
await page.waitForTimeout(2000);
await first.locator('[data-startgo="scratch"]').click();
await page.waitForTimeout(500);
await first.locator('#scratchCreate').click();
await page.waitForTimeout(7000);
const current = widgetFrame();
const state = await current.evaluate(async () => {
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
  const form = sections.id.find((id, i) => sections.parentKey[i] === 'form');
  const widget = sections.id.find((id, i) => sections.parentKey[i] === 'custom');
  return { tables: await grist.docApi.listTables(), form, page: sections.parentId[sections.id.indexOf(widget)], fields: fields.id.filter((id, i) => fields.parentId[i] === form).length };
});
say('document après :', JSON.stringify(state));
check('sans GFS aussi, Grist recharge le cadre de Form+ dès que la section de formulaire est posée', first.isDetached());
check('la table des réponses et la section de formulaire sont posées', state.tables.length === 2 && Number.isInteger(state.form), state);
say('champs restés dans la section de formulaire :', state.fields);
check('sans GFS aussi, le retrait du champ automatique est perdu : un champ reste dans le formulaire « vide »', state.fields === 1, state.fields);

// ----- 2. Le formulaire de la page du widget, deux fois.
const formsBefore = (await savedForms(current)).forms;
const asked = await saveByLink(page, current, state.form);
await page.waitForTimeout(7000);
const once = await savedForms(widgetFrame());
say('même page que le widget, premier essai :', JSON.stringify({ asked, rechargee: current.isDetached(), ...once }));
check('sans GFS : la fenêtre d\'accord, puis `FormPlus_Formulaires` créée, sans section de garde (008, point 3)', /FormPlus_Formulaires/.test(asked || '') && once.table && once.gates.length === 0, { question: asked, gardes: once.gates.length });
check('sans GFS aussi, la copie posée sur la page du widget fait recharger le cadre de Form+, et la ligne n\'est pas écrite', current.isDetached() && once.rows.length === 0 && once.forms === formsBefore + 1, { lignes: once.rows.length, formulaires: once.forms });
const next = widgetFrame();
const askedAgain = await saveByLink(page, next, state.form);
await page.waitForTimeout(7000);
const twice = await savedForms(widgetFrame());
say('même page que le widget, second essai :', JSON.stringify({ asked: askedAgain, ...twice }));
check('sans GFS aussi, le second essai ne demande rien, pose une copie de plus, et toujours aucune ligne', !askedAgain && twice.rows.length === 0 && twice.forms === once.forms + 1, { question: askedAgain, lignes: twice.rows.length, formulaires: twice.forms });

// ----- 3. Le formulaire natif sur SA page : tout passe, comme dans GFS.
const widget = widgetFrame();
const own = await ownPageForm(widget);
await saveByLink(page, widget, own.sectionRef);
await page.waitForTimeout(6000);
const saved = await savedForms(widget);
say('premier enregistrement, page propre :', JSON.stringify(saved));
check('aucune section de garde n\'est posée, et le cadre de Form+ n\'est pas rechargé : le formulaire est sur sa page, pas sur celle du widget', saved.gates.length === 0 && !widget.isDetached(), { gardes: saved.gates.length, recharge: widget.isDetached() });
check('une ligne, celle de la copie gérée, et la copie porte le champ caché `FormPlusDef` (une Référence vers `FormPlus_Formulaires`)', saved.rows.length === 1 && Number.isInteger(saved.rows[0].vsId) && saved.rows[0].cache && Boolean(saved.def) && saved.def.type === 'Ref:FormPlus_Formulaires', { lignes: saved.rows, colonne: saved.def });
await widget.locator('#generate').click();
await page.waitForTimeout(4000);
const again = await savedForms(widget);
check('le même lien une seconde fois : aucune copie de plus, aucune ligne de plus', again.forms === saved.forms && again.rows.length === 1, { formulaires: again.forms, lignes: again.rows.length });
const own2 = await ownPageForm(widget);
await pasteLink(page, widget, own2.sectionRef);
await page.waitForTimeout(5000);
const second = await savedForms(widget);
check('un second formulaire a sa propre ligne et sa propre copie', second.rows.length === 2 && second.rows[0].vsId !== second.rows[1].vsId, second.rows);
// Posé APRÈS la colonne `FormPlusDef`, le second formulaire natif en reçoit le champ de Grist, et Form+ ne cache que le champ qu'elle ajoute.
constat('la copie du second formulaire cache aussi son champ `FormPlusDef` (008, point 3)', second.rows.every(row => row.cache), second.rows.map(row => row.champ));
await lab.browser.close();
