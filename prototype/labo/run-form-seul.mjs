// Form+ sans GFS (référencée à fd5384a), directement comme widget personnalisé de Grist (grist-static), à la vraie souris et au vrai clavier. Le point de comparaison de `run-form` :
//   1. « Partir de zéro » (013, point 2) : le formulaire natif part sur une page neuve, le cadre de Form+ n'est pas rechargé et le champ que Grist ajoute tout seul est retiré, comme dans GFS.
//   2. Enregistrer ce formulaire par son lien : les deux fenêtres de Form+ (sa table, puis la publication de la copie : sans GFS, ce sont les seules confirmations), la copie, sa petite table
//      `FormPlus_Pub_<vsId>` et sa colonne cachée `FormPlusDef_<vsId>` ; le même lien deux fois ne copie rien de plus.
//   3. Un formulaire natif sur la page du widget : refusé avant toute copie (012, point 2), puisque Grist recharge le cadre du widget dès qu'on y pose une section.
//   4. Un second formulaire sur sa page : sa petite table et son champ, jamais ceux du premier (013, point 1).
import { startLab } from './lab-setup.mjs';
import { savedForms, saveByLink, linkMessage, ownPageForm, formOnWidgetPage } from './form-lab.mjs';
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
const state = await first.evaluate(async () => {
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
  const form = sections.id.find((id, i) => sections.parentKey[i] === 'form');
  const widget = sections.id.find((id, i) => sections.parentKey[i] === 'custom');
  return { tables: await grist.docApi.listTables(), form, formPage: sections.parentId[sections.id.indexOf(form)], page: sections.parentId[sections.id.indexOf(widget)], fields: fields.id.filter((id, i) => fields.parentId[i] === form).length };
});
say('document après :', JSON.stringify(state));
check('sans GFS aussi, Grist ne recharge pas le cadre de Form+ : le formulaire natif part sur une page neuve, jamais celle du widget', !first.isDetached() && state.formPage !== state.page, { recharge: first.isDetached(), formulaire: state.formPage, widget: state.page });
check('la table des réponses et le formulaire natif sont posés', state.tables.length === 2 && Number.isInteger(state.form), state);
check('le champ que Grist ajoute tout seul est retiré : le formulaire est vide', state.fields === 0, state.fields);

// ----- 2. Le formulaire de « Partir de zéro », par son lien.
const windows = await saveByLink(page, first, state.form);
const saved = await savedForms(first);
say('premier enregistrement :', JSON.stringify({ fenetres: windows, ...saved }));
const copy = saved.rows[0];
check('sans GFS : deux fenêtres de Form+, sa table `FormPlus_Formulaires` puis la publication de la copie, qui dit la table recevant des lignes', windows.length === 2 && windows.every(window => window.cote === 'Form+') && /FormPlus_Formulaires/.test(windows[0].texte) && /Reponses|Responses/.test(windows[1].texte), windows);
check('`FormPlus_Formulaires` est créée, sans section de garde (008, point 3), avec une ligne : celle de la copie gérée', saved.table && saved.gates.length === 0 && saved.rows.length === 1 && Number.isInteger(copy.vsId) && copy.vsId !== state.form, saved);
check('la copie a SA petite table d\'une ligne et SA colonne cachée `FormPlusDef_<vsId>` (une Référence qui affiche `Definition`), sans la colonne partagée d\'avant', Boolean(copy.pub) && copy.pub.lignes === 1 && copy.pub.sienne && copy.def.type === `Ref:FormPlus_Pub_${copy.vsId}` && copy.def.affiche === 'Definition' && copy.cache && copy.autres.length === 0 && !saved.ancienne, copy);
check('le cadre de Form+ n\'est pas rechargé pendant l\'enregistrement', !first.isDetached(), first.isDetached());
const again = await saveByLink(page, first, state.form, null, { quiet: 4000 });
await page.waitForTimeout(2000);
const same = await savedForms(first);
check('le même lien une seconde fois : aucune fenêtre, aucune copie de plus, aucune ligne de plus', again.length === 0 && same.forms === saved.forms && same.rows.length === 1, { fenetres: again, formulaires: same.forms, lignes: same.rows.length });

// ----- 3. Un formulaire natif sur la page du widget : refusé avant toute copie.
const onWidget = await formOnWidgetPage(lab, first, async () => widgetFrame());
const widget = onWidget.host;
const beforeWidget = await savedForms(widget);
const refused = await saveByLink(page, widget, onWidget.section, null, { quiet: 4000 });
const message = await linkMessage(widget);
const afterWidget = await savedForms(widget);
say('formulaire sur la page du widget :', JSON.stringify({ fenetres: refused, message: message.slice(0, 120), avant: beforeWidget.forms, apres: afterWidget.forms }));
check('un formulaire natif sur la page du widget : Form+ le refuse et dit pourquoi, sans ouvrir de fenêtre', refused.length === 0 && /même page que ce formulaire|same page as this native form/.test(message), { fenetres: refused, message });
check('rien n\'est copié ni écrit : mêmes formulaires, même ligne', afterWidget.forms === beforeWidget.forms && afterWidget.rows.length === 1, { formulaires: afterWidget.forms, lignes: afterWidget.rows.length });

// ----- 4. Un second formulaire, sur sa page : sa petite table et son champ, jamais ceux du premier.
const second = await ownPageForm(widget);
const secondWindows = await saveByLink(page, widget, second.sectionRef);
await page.waitForTimeout(3000);
const both = await savedForms(widget);
say('second formulaire :', JSON.stringify({ fenetres: secondWindows.map(window => window.titre), ...both }));
check('un second formulaire a sa propre ligne, sa petite table d\'une ligne et son champ caché', both.rows.length === 2 && both.rows.every(row => row.pub && row.pub.lignes === 1 && row.cache), both.rows);
check('chaque formulaire a SA petite table et SA colonne : aucune ne porte la définition d\'un autre, aucune copie ne garde le champ d\'un autre', both.rows.every(row => row.pub && row.pub.sienne && row.autres.length === 0 && row.def && row.def.type === `Ref:FormPlus_Pub_${row.vsId}`), both.rows.map(row => ({ vsId: row.vsId, def: row.def, autres: row.autres })));
await lab.browser.close();
