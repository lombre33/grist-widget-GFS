// Form+ sans GFS, directement comme widget personnalisé de Grist (grist-static), à la vraie souris et au vrai clavier. Le point de comparaison de `run-form` :
//   1. « Partir de zéro » : le cadre de Form+ est-il rechargé, et le champ que Grist ajoute tout seul à la section de formulaire est-il retiré, quand GFS n'est pas là ?
//   2. Enregistrer un formulaire par son lien (consigne 007) : la table `FormPlus_Formulaires`, la section qui l'ouvre aux répondants, la ligne du formulaire, quand GFS n'est pas là.
import { startLab } from './lab-setup.mjs';
import { savedForms, saveByLink } from './form-lab.mjs';
import { say, check } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/apps/form/poc/widget.html';
const lab = await startLab({ widget: WIDGET, lang: process.env.LAB_LANG || 'fr', colorScheme: process.env.LAB_SCHEME || 'light' });
const { page } = lab;
const widgetFrame = () => page.frames().find(frame => frame.url().startsWith(WIDGET) && !frame.isDetached());

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

// ----- 2. Enregistrer un formulaire, deux fois (la personne recommence quand rien n'a été enregistré).
const saveOnce = async form => {
  const asked = await saveByLink(page, form, state.form);
  await page.waitForTimeout(7000);
  const next = widgetFrame();
  return { asked, reloaded: form.isDetached(), saved: await savedForms(next), frame: next };
};
const once = await saveOnce(current);
say('premier enregistrement :', JSON.stringify({ ...once, frame: undefined }));
check('sans GFS : la fenêtre d\'accord, puis `FormPlus_Formulaires` créée', /FormPlus_Formulaires/.test(once.asked || '') && once.saved.table, once.asked);
check('sans GFS aussi, la section qui ouvre la table est posée sur la page du widget, et Grist recharge le cadre de Form+', once.saved.gates.length === 1 && once.saved.gates[0].page === state.page && once.reloaded, once.saved.gates);
check('sans GFS aussi, la suite est perdue : section non publiée, aucune ligne écrite', !once.saved.gates[0]?.publiee && once.saved.rows.length === 0, once.saved);
const twice = await saveOnce(once.frame);
say('second enregistrement :', JSON.stringify({ ...twice, frame: undefined }));
check('sans GFS aussi, le second essai pose une section de plus, et toujours aucune ligne', !twice.asked && twice.saved.gates.length === 2 && twice.saved.rows.length === 0, twice.saved);
await lab.browser.close();
