// Form+ sans GFS, directement comme widget personnalisé de Grist (grist-static) : « Partir de zéro » à la vraie souris. Sert de point de comparaison à `run-form` (consigne 007) : le cadre de
// Form+ est-il rechargé, et le champ que Grist ajoute tout seul à la section de formulaire est-il retiré, quand GFS n'est pas là ?
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/apps/form/poc/widget.html';
const lab = await startLab({ widget: WIDGET, lang: process.env.LAB_LANG || 'fr', colorScheme: process.env.LAB_SCHEME || 'light' });
const { page } = lab;
const first = lab.frame;
await first.waitForSelector('[data-startgo="scratch"]', { timeout: 30000 });
await page.waitForTimeout(2000);
await first.locator('[data-startgo="scratch"]').click();
await page.waitForTimeout(500);
await first.locator('#scratchCreate').click();
await page.waitForTimeout(7000);
const current = page.frames().find(frame => frame.url().startsWith(WIDGET) && !frame.isDetached());
const state = await current.evaluate(async () => {
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
  const form = sections.id.find((id, i) => sections.parentKey[i] === 'form');
  return { tables: await grist.docApi.listTables(), form, fields: fields.id.filter((id, i) => fields.parentId[i] === form).length };
});
say('document après :', JSON.stringify(state));
check('sans GFS aussi, Grist recharge le cadre de Form+ dès que la section de formulaire est posée', first.isDetached());
check('la table des réponses et la section de formulaire sont posées', state.tables.length === 2 && Number.isInteger(state.form), state);
say('champs restés dans la section de formulaire :', state.fields);
check('sans GFS aussi, le retrait du champ automatique est perdu : un champ reste dans le formulaire « vide »', state.fields === 1, state.fields);
await lab.browser.close();
