// Form+ (référencée à fd5384a) dans GFS, dans un vrai Grist (consignes 007, 008, 012 et 013 de GFS à Form+) : à la vraie souris et au vrai clavier, à 700 × 400.
//   1. L'app s'ouvre dans le sous-cadre isolé, sans refus du courtier ni erreur de script.
//   2. Ce que le courtier refuse aux deux écritures de définition d'avant la 007 (`options` de la section, lecture de `_grist_Shares`) et ce que devient `setOptions` : mesuré
//      depuis le cadre de l'app, avec les appels de `39e0740` (Form+ ne les fait plus) ; rien n'est écrit (le courtier refuse avant Grist).
//      Puis les pièces jointes (cc21a27) : la liste se lit, le jeton passe, l'écriture reste refusée (accord du porteur, 22/10).
//   3. « Partir de zéro » (013, point 2) : la table et le formulaire natif sur une page NEUVE ; Grist ne recharge ni le cadre de GFS ni celui de Form+, et le champ qu'il ajoute tout seul est retiré.
//   4. Enregistrer un formulaire par son lien. 4a. Celui de « Partir de zéro » : les deux fenêtres de Form+ (sa table, puis « Avant de publier cette copie »), les deux de GFS (la table des
//      réponses ouverte à l'ajout, puis la lecture de `Definition` dans la petite table de CE formulaire), la copie publiée avec son champ caché ; le même lien deux fois ne copie rien de plus.
//      4b. Un formulaire natif sur la page du WIDGET : refusé avant toute copie (012, point 2). 4c. Un second formulaire sur sa page : sa petite table et son champ, jamais ceux du premier
//      (013, point 1). 4d. Le mode interne : la fenêtre d'accord avant de créer `FormPlus_Repondants` (012, point 6), puis la colonne d'essai qui lit `user.Email` (la capacité `formules`).
//      4e. L'ancien portillon publié : fermé avec l'accord de la personne, dépublié sans rien supprimer (012, point 7).
//   5. Le type « Formulaire » dans l'explorateur, quand `FormPlus_Formulaires` a des lignes.
// Un CONSTAT dit ce que l'app fait en deçà de sa consigne, sans faire échouer l'essai (consigne 012 de GFS à Form+).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_LIVE=1 pour jouer le site en ligne de l'app au lieu de sa copie.
import { startLab } from './lab-setup.mjs';
import { seedForms } from './seed.mjs';
import { savedForms, saveByLink, acceptWindows, linkMessage, ownPageForm, formOnWidgetPage, oldGate } from './form-lab.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `form-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const refusals = [];
const errors = [];
// Le Grist du labo est en http : la politique de l'app (`connect-src 'self' https:`) refuse sa lecture de /forms/N, ce que Grist en ligne (https) laisse passer. Propre au labo.
const labOnly = text => /Content Security Policy|Refused to connect/.test(text) && /127\.0\.0\.1:8910\/o\/docs\/api\/s\/LABO\/forms\/\d+/.test(text);
const FORM_URL = /(apps\/form|FormPlus)\//;
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) refusals.push(message.text());
  if (message.type() === 'error' && FORM_URL.test(message.location().url || '') && !labOnly(message.text())) errors.push(message.text());
});
// grist-static n'a pas de serveur d'accueil : dès qu'une section de formulaire est publiée, Grist lit son partage (`getShare`) et échoue (« HomeDbManager not available »). Propre au labo, pas à l'app.
page.on('pageerror', error => { if (!/HomeDbManager not available/.test(error.message)) errors.push(error.message); });

// Ce que le document contient : les tables, les sections (type, page) et les champs de la section de formulaire.
const documentState = target => target.evaluate(async () => {
  const tables = await grist.docApi.listTables();
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
  return {
    tables,
    sections: sections.id.map((id, i) => ({ id, kind: sections.parentKey[i], page: sections.parentId[i], options: sections.options[i] })),
    fields: fields.id.map((id, i) => ({ id, section: fields.parentId[i] })),
  };
});

// ----- 1. L'app s'ouvre.
const app = await lab.openApp('form', FORM_URL);
check('l\'app a un cadre', Boolean(app));
await page.waitForTimeout(4000);
await lab.fitPanel(undefined, 700, 400);
const seen = await app.evaluate(() => ({
  origine: window.origin,
  titre: document.title,
  texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
  stockage: (() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (error) { return error.name; } })(),
}));
say('ce que l\'app voit :', JSON.stringify(seen));
await lab.shotPanel(run, '1-demarrage');
check('l\'app est ouverte dans le sous-cadre isolé (origine null, pas de stockage)', seen.origine === 'null' && seen.stockage === 'SecurityError', seen);
check('elle propose ses départs', /Comment voulez-vous démarrer|How do you want to start/i.test(seen.texte), seen.texte);
check('le courtier ne lui a rien refusé au démarrage', refusals.length === 0, refusals);
check('aucune erreur de script dans l\'app', errors.length === 0, errors);
const before = await documentState(lab.frame);
const gfsSection = before.sections.find(section => section.kind === 'custom');

// ----- 2. Les écritures de définition de Form+ et le courtier.
const attempt = (name, call) => app.evaluate(async ({ name, call }) => {
  try {
    const value = await (new Function('grist', `return (${call})();`))(grist);
    return { name, refused: false, value: value === undefined ? null : JSON.stringify(value).slice(0, 80) };
  } catch (error) {
    return { name, refused: true, message: String((error && error.message) || error) };
  }
}, { name, call });
const options = await attempt('options', `async () => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', ${gfsSection.id}, { options: JSON.stringify({ formplusDuplicate: true }) }]])`);
const shares = await attempt('shares', 'async () => grist.docApi.fetchTable(\'_grist_Shares\')');
const marker = await attempt('marqueur', `async () => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', ${gfsSection.id}, { shareOptions: '{}', options: '{}' }]])`);
const setOptions = await attempt('setOptions', 'async () => grist.setOptions({ formTitle: \'Inscription\', questions: [{ id: 1 }], shareKey: \'AAAA\' })');
const readBack = await attempt('getOptions', 'async () => grist.getOptions()');
for (const item of [options, shares, marker, setOptions, readBack]) say(`${item.name} :`, JSON.stringify(item));
check('l\'écriture de `options` d\'une section est refusée par le courtier (contrats 3.3, point 6)', options.refused && /GFS_REFUSE|refus|options/i.test(options.message), options);
check('la lecture de `_grist_Shares` est refusée (contrats 3.2, point 4)', shares.refused && /GFS_REFUSE|refus|_grist_Shares/i.test(shares.message), shares);
check('le lot qui écrit `shareOptions` ET `options` est refusé en entier (contrats 3.3, point 1)', marker.refused, marker);
check('`setOptions` de tout l\'objet ne dit rien et n\'écrit rien : aucune clé de Form+ n\'est déclarée', !setOptions.refused && (readBack.value === null || readBack.value === 'null'), { setOptions, readBack });
// Les pièces jointes (Form+ à `cc21a27`, accord du porteur le 22/10) : l'app lit la liste (`_grist_Attachments`) et demande un jeton pour télécharger celle que la personne choisit.
// grist-static ne délivre pas de jeton : le courtier doit seulement le laisser passer, l'erreur est celle de Grist. L'écriture de la table reste refusée.
const attachments = await attempt('pièces jointes', 'async () => { const table = await grist.docApi.fetchTable(\'_grist_Attachments\'); return { colonnes: Object.keys(table).includes(\'fileName\'), lignes: table.id.length }; }');
const token = await attempt('jeton', 'async () => grist.docApi.getAccessToken({ readOnly: false })');
const attachmentWrite = await attempt('écriture des pièces jointes', 'async () => grist.docApi.applyUserActions([[\'AddRecord\', \'_grist_Attachments\', null, { fileName: \'x.png\' }]])');
for (const item of [attachments, token, attachmentWrite]) say(`${item.name} :`, JSON.stringify(item));
check('la liste des pièces jointes (`_grist_Attachments`) se lit depuis l\'app : le manifeste la déclare', !attachments.refused && /"colonnes":true/.test(attachments.value), attachments);
check('le jeton est relayé à Grist, non refusé par le courtier (grist-static n\'en délivre pas : l\'erreur est celle de Grist)', !token.refused || !/GFS_REFUSE|permissions\.jeton|déclaré dans le manifeste/.test(token.message), token);
check('l\'écriture de `_grist_Attachments` est refusée par le courtier (colonnes non déclarées)', attachmentWrite.refused && /GFS_REFUSE|déclarées|_grist_Attachments/.test(attachmentWrite.message), attachmentWrite);
const afterRefusals = await documentState(lab.frame);
check('rien n\'a été écrit dans les sections du document par ces essais', JSON.stringify(afterRefusals.sections) === JSON.stringify(before.sections), 'les lignes de _grist_Views_section sont les mêmes');
refusals.length = 0;

// ----- 3. « Partir de zéro » : la table et le formulaire natif, sur une page neuve (013, point 2).
await app.locator('[data-startgo="scratch"]').click();
await page.waitForTimeout(500);
await lab.shotPanel(run, '2-partir-de-zero');
await app.locator('#scratchCreate').click();
await page.waitForTimeout(6000);
check('« Partir de zéro » : le courtier ne refuse rien (AddTable, CreateViewSection)', refusals.length === 0, refusals);
check('Grist ne recharge rien : le cadre de GFS et celui de Form+ restent', !lab.frame.isDetached() && !app.isDetached(), { gfs: lab.frame.isDetached(), app: app.isDetached() });
await lab.shot(run, '3-apres-creer-page');
const created = await documentState(lab.frame);
const formSection = created.sections.find(section => section.kind === 'form');
say('document après :', JSON.stringify({ tables: created.tables, formSection: formSection && { id: formSection.id, page: formSection.page }, pageDuWidget: gfsSection.page }));
check('la table des réponses est créée (« Reponses » / « Responses », Grist en retire l\'accent)', created.tables.filter(name => !before.tables.includes(name)).length === 1, created.tables);
check('le formulaire natif est seul sur une page neuve, jamais celle du widget', Boolean(formSection) && formSection.page !== gfsSection.page && created.sections.filter(section => section.page === formSection.page).length === 1, formSection);
// Le cadre n'étant plus rechargé, le retrait du champ que Grist ajoute tout seul, que Form+ fait ensuite, passe (avant la 013 il était perdu : un champ restait dans le formulaire « vide »).
check('le champ que Grist ajoute tout seul est retiré : le formulaire est vide', created.fields.filter(field => formSection && field.section === formSection.id).length === 0, created.fields);

// ----- 3b. Le guide de publication (Form+ `c32ae54`, puis `b791c22` et `3b9ac0c` : Form+ PUBLIE LUI-MÊME, au bouton « Publier le formulaire » de l'étape 1). La page que Grist appelle « New page » est renommée
// d'après la table (l'écriture de `_grist_Views.name` est déclarée au manifeste de GFS). Le bouton écrit `_grist_Shares` (AddRecord), `_grist_Pages.shareRef` puis `shareOptions` : GFS ne déclare que la
// dernière (décision du porteur attendue, 11/11) ; le courtier refuse donc la première et Form+ passe au geste à la main, qu'elle dit avec le nom de la page. Le Grist du labo ne délivre pas de jeton d'accès
// (« no access tokens ») : Form+ ne peut pas composer l'adresse de la page et le dit (« tout en bas de la liste des pages »). L'adresse à copier, dans GFS, se mesure sur un vrai serveur (faits vérifiés 65).
const GUIDE = lang === 'fr'
  ? { page: 'Formulaire Reponses', title: 'Publiez votre formulaire dans Grist', step1: 'Étape 1 sur 3', step2: 'Étape 2 sur 3', step3: 'Étape 3 sur 3', publish: 'Publier le formulaire', manual: 'n\'a pas pu publier à votre place', waiting: 'J\'attends la publication', noLink: 'Elle est tout en bas de la liste des pages, à gauche.', copied: 'J\'ai copié le lien' }
  : { page: 'Form Responses', title: 'Publish your form in Grist', step1: 'Step 1 of 3', step2: 'Step 2 of 3', step3: 'Step 3 of 3', publish: 'Publish the form', manual: 'could not publish for you', waiting: 'Waiting for the publication', noLink: 'It is at the very bottom of the page list, on the left.', copied: 'I copied the link' };
const viewNames = await lab.frame.evaluate(async () => { const views = await grist.docApi.fetchTable('_grist_Views'); return views.id.map((id, index) => ({ id, name: views.name[index] })); });
const renamed = viewNames.find(view => formSection && view.id === formSection.page);
check('la page du formulaire est renommée d\'après la table (« ' + GUIDE.page + ' »), plus « New page » : le courtier a laissé passer l\'écriture de `_grist_Views.name`', Boolean(renamed) && renamed.name === GUIDE.page && refusals.length === 0, { renamed, refusals });
const guideText = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
check('le guide de publication est à l\'écran, à l\'étape 1, avec le bouton « ' + GUIDE.publish + ' »', guideText.includes(GUIDE.title) && guideText.includes(GUIDE.step1) && (await app.locator('#guide-publish').innerText()).trim() === GUIDE.publish, guideText.slice(0, 200));
await lab.shotPanel(run, '3b-guide-etape-1');
const sharesBefore = await lab.frame.evaluate(async () => { const shares = await grist.docApi.fetchTable('_grist_Shares'); return shares.id.length; });
refusals.length = 0;
await app.locator('#guide-publish').click();
await page.waitForTimeout(2500);
const manualText = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
const sharesAfter = await lab.frame.evaluate(async () => { const shares = await grist.docApi.fetchTable('_grist_Shares'); return shares.id.length; });
const sectionPublished = await lab.frame.evaluate(async id => { const sections = await grist.docApi.fetchTable('_grist_Views_section'); return sections.shareOptions[sections.id.indexOf(id)]; }, formSection.id);
check('le courtier refuse l\'écriture de `_grist_Shares` que le bouton demande (non déclarée) : rien n\'est publié, aucune ligne de partage, la section est intacte', refusals.some(text => /_grist_Shares/.test(text)) && sharesAfter === sharesBefore && !String(sectionPublished || '').includes('publish'), { refusals, sharesBefore, sharesAfter, sectionPublished });
check('Form+ ne montre pas d\'erreur : elle passe au geste à la main, dit la page à ouvrir (« ' + GUIDE.page + ' ») et attend la publication', manualText.includes(GUIDE.manual) && manualText.includes(GUIDE.page) && manualText.includes(GUIDE.waiting) && manualText.includes(GUIDE.noLink) && (await app.locator('#guide-open, #guide-copy').count()) === 0, manualText.slice(0, 400));
await lab.shotPanel(run, '3b-guide-geste-a-la-main');
// Le geste « Publier » de Grist, fait ici depuis le cadre de GFS (accès complet) : Form+ relit `shareOptions` toutes les 2,5 s et passe tout seul à l'étape 2.
await lab.frame.evaluate(async id => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', id, { shareOptions: JSON.stringify({ publish: true, form: true }) }]]), formSection.id);
await app.locator('[data-guide="opened"]').waitFor({ state: 'visible', timeout: 12000 });
const step2 = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
check('une fois publié, l\'étape 2 s\'ouvre toute seule (Form+ lit `shareOptions` de la section à travers le courtier)', step2.includes(GUIDE.step2) && step2.includes(GUIDE.copied), step2.slice(0, 260));
await lab.shotPanel(run, '3b-guide-etape-2');
await app.locator('[data-guide="opened"]').click();
await app.locator('#guide-link').waitFor({ state: 'visible', timeout: 12000 });
const step3 = (await app.locator('#start-panel-guide').innerText()).replace(/\s+/g, ' ');
check('« ' + GUIDE.copied + ' » : l\'étape 3 attend le lien', step3.includes(GUIDE.step3), step3.slice(0, 260));
await lab.shotPanel(run, '3b-guide-etape-3');

// ----- 4. Enregistrer un formulaire par son lien (consignes 007, 008, 012 et 013).
// 4a. Le formulaire natif de « Partir de zéro », sur sa page. Form+ demande l'accord de la personne avant de créer sa table, puis dit ce que le lien ouvrira avant de publier la copie (013, points 3 et 4) ;
// GFS demande à son tour l'accord de la personne pour chaque chose que le lien public ouvre (contrats 3.3, point 9).
refusals.length = 0;
const windows = await saveByLink(page, app, formSection.id, lab.frame);
say('fenêtres d\'accord :', JSON.stringify(windows));
const ownWindows = windows.filter(window => window.cote === 'Form+');
const gfsWindows = windows.filter(window => window.cote === 'GFS');
await page.waitForTimeout(3000);
await lab.shotPanel(run, '4-apres-enregistrer');
const first = await savedForms(lab.frame);
say('premier enregistrement :', JSON.stringify(first));
const copy = first.rows[0];
check('Form+ demande deux fois l\'accord avant d\'écrire : sa table `FormPlus_Formulaires`, puis la publication de la copie, qui dit la table recevant des lignes', ownWindows.length === 2 && /FormPlus_Formulaires/.test(ownWindows[0].texte) && /Reponses|Responses/.test(ownWindows[1].texte), ownWindows);
// Avec le guide (3b), la personne a publié le formulaire d'origine elle-même, dans Grist : la table des réponses est déjà ouverte à l'ajout, GFS ne le redemande pas. Il demande seulement la lecture de `Definition`.
check('GFS demande l\'accord une fois : la lecture de `Definition` dans la petite table de CE formulaire seul (la table des réponses est déjà ouverte à l\'ajout par le « Publier » de la personne)', gfsWindows.length === 1 && Boolean(copy) && gfsWindows[0].lignes.join().includes('Definition') && gfsWindows[0].lignes.join().includes(`FormPlus_Pub_${copy.vsId}`), gfsWindows);
check('`FormPlus_Formulaires` est créée, sans section de garde (008, point 3)', first.table && first.gates.length === 0, first.gates);
check('une seule ligne, celle de la copie gérée (`Definition.vsId`), pas du formulaire d\'origine', first.rows.length === 1 && Number.isInteger(copy.vsId) && copy.vsId !== formSection.id, first.rows);
check('la copie a SA petite table d\'une ligne `FormPlus_Pub_<vsId>`, qui porte sa définition (013, point 1)', Boolean(copy.pub) && copy.pub.lignes === 1 && copy.pub.sienne, copy);
check('et SA colonne cachée `FormPlusDef_<vsId>` : une Référence vers cette petite table qui affiche `Definition`, cachée dans la copie, sans le champ d\'un autre formulaire, ni la colonne partagée d\'avant', Boolean(copy.def) && copy.def.type === `Ref:FormPlus_Pub_${copy.vsId}` && copy.def.affiche === 'Definition' && copy.cache && copy.autres.length === 0 && !first.ancienne, copy);
check('le cadre de GFS et celui de Form+ restent pendant l\'enregistrement', !lab.frame.isDetached() && !app.isDetached(), { gfs: lab.frame.isDetached(), app: app.isDetached() });
check('aucun refus du courtier pendant l\'enregistrement', refusals.length === 0, refusals);
const again = await saveByLink(page, app, formSection.id, lab.frame, { quiet: 4000 });
await page.waitForTimeout(2000);
const same = await savedForms(lab.frame);
check('le même lien une seconde fois : aucune fenêtre, aucune copie de plus, aucune ligne de plus', again.length === 0 && same.forms === first.forms && same.rows.length === 1, { fenetres: again, formulaires: same.forms, lignes: same.rows.length });

// 4b. Un formulaire natif posé sur la page du WIDGET (la personne met son widget à côté de son formulaire) : poser une section sur cette page fait recharger le cadre du widget avant que la
// ligne soit écrite (comportement de Grist). Form+ le refuse AVANT toute copie et dit pourquoi (012, point 2). Grist reconstruit le cadre de GFS dès que la section est posée.
refusals.length = 0;
const onWidget = await formOnWidgetPage(lab, lab.frame);
const host = onWidget.host;
const formApp = await lab.openApp('form', FORM_URL, host);
const beforeWidget = await savedForms(host);
const refusedWindows = await saveByLink(page, formApp, onWidget.section, host, { quiet: 4000 });
const message = await linkMessage(formApp);
const afterWidget = await savedForms(host);
say('formulaire sur la page du widget :', JSON.stringify({ fenetres: refusedWindows, message: message.slice(0, 120), avant: beforeWidget.forms, apres: afterWidget.forms }));
check('un formulaire natif sur la page du widget : Form+ le refuse et dit pourquoi, sans ouvrir aucune fenêtre', refusedWindows.length === 0 && /même page que ce formulaire|same page as this native form/.test(message), { fenetres: refusedWindows, message });
check('rien n\'est copié ni écrit : mêmes formulaires, même ligne', afterWidget.forms === beforeWidget.forms && afterWidget.rows.length === 1, { formulaires: afterWidget.forms, lignes: afterWidget.rows.length });
check('aucun refus du courtier', refusals.length === 0, refusals);

// 4c. Un second formulaire, sur sa page : sa petite table et son champ caché, jamais ceux du premier (013, point 1). GFS demande de nouveau l'accord pour la lecture de SA petite table.
refusals.length = 0;
const second = await ownPageForm(host);
const secondWindows = await saveByLink(page, formApp, second.sectionRef, host);
await page.waitForTimeout(3000);
const both = await savedForms(host);
say('second formulaire :', JSON.stringify({ fenetres: secondWindows, ...both }));
const mine = both.rows.find(row => row.vsId !== copy.vsId);
check('un second formulaire a sa propre ligne, sa petite table d\'une ligne et son champ caché', both.rows.length === 2 && Boolean(mine) && Boolean(mine.pub) && mine.pub.lignes === 1 && mine.cache, both.rows);
check('chaque formulaire a SA petite table et SA colonne : aucune ne porte la définition d\'un autre, aucune copie ne garde le champ d\'un autre (un lien ne lit que la sienne)', both.rows.every(row => row.pub && row.pub.sienne && row.autres.length === 0 && row.def && row.def.type === `Ref:FormPlus_Pub_${row.vsId}`), both.rows.map(row => ({ vsId: row.vsId, def: row.def, autres: row.autres })));
check('GFS demande de nouveau l\'accord de lecture, pour la petite table de ce second formulaire (une table de plus à lire)', Boolean(mine) && secondWindows.some(window => window.cote === 'GFS' && window.lignes.join().includes(`FormPlus_Pub_${mine.vsId}`)), secondWindows);
check('aucun refus du courtier pour le second formulaire', refusals.length === 0, refusals);

// 4d. Le mode interne (012, point 6) : la fenêtre d'accord avant de créer `FormPlus_Repondants`, puis sa colonne d'essai, dont la formule lit `user.Email`. Sans la capacité `formules` du
// manifeste, le courtier refuse la colonne (« Une colonne à formule demande la capacité « formules » », mesuré à c249c4a avant la déclaration).
await formApp.locator('[data-etab="settings"]').click();
await page.waitForTimeout(500);
refusals.length = 0;
await formApp.locator('label:has(#opt-internal-mode) .toggle-track').click();
const internalWindows = await acceptWindows(page, formApp, host, { quiet: 4000 });
await page.waitForTimeout(2000);
const internal = await formApp.evaluate(() => ({ coche: document.getElementById('opt-internal-mode').checked, message: document.getElementById('internal-mode-msg').textContent.replace(/\s+/g, ' ').trim() }));
const probe = await host.evaluate(async () => {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const ref = tables.id[tables.tableId.indexOf('FormPlus_Repondants')];
  const at = ref ? columns.parentId.findIndex((parent, i) => parent === ref && columns.colId[i] === 'Email') : -1;
  return { table: Boolean(ref), colonne: at < 0 ? null : { type: columns.type[at], formule: columns.formula[at], declenchee: !columns.isFormula[at], recalcWhen: columns.recalcWhen[at] } };
});
say('mode interne :', JSON.stringify({ ...internal, ...probe, fenetres: internalWindows }));
check('Form+ demande l\'accord avant de créer `FormPlus_Repondants` (012, point 6) : une fenêtre du kit, et GFS n\'a rien à demander', internalWindows.length === 1 && internalWindows[0].cote === 'Form+' && /FormPlus_Repondants/.test(internalWindows[0].texte), internalWindows);
check('le mode interne s\'active : la case reste cochée, sans message d\'erreur', internal.coche && !/Impossible|refus/i.test(internal.message), internal);
check('`FormPlus_Repondants` est créée avec sa colonne `Email` à formule déclenchée `user.Email` (la capacité `formules` du manifeste)', probe.table && probe.colonne && probe.colonne.formule === 'user.Email' && probe.colonne.declenchee, probe);
check('le courtier ne refuse rien au mode interne', refusals.length === 0, refusals);

// 4e. L'ancien portillon (Form+ à 038dd1b) : une section de formulaire publiée sur `FormPlus_Formulaires`. À l'enregistrement suivant, Form+ propose de la fermer ; avec l'accord de la personne
// elle la DÉPUBLIE (`UpdateRecord` de `shareOptions`) et ne la supprime jamais (`RemoveViewSection` n'est pas un verbe que le courtier laisse passer, contrats 3.3, point 2).
refusals.length = 0;
const gateId = await oldGate(host);
const third = await ownPageForm(host);
const gateWindows = await saveByLink(page, formApp, third.sectionRef, host);
await page.waitForTimeout(3000);
const closed = await savedForms(host);
say('ancien portillon :', JSON.stringify({ fenetres: gateWindows.map(window => `${window.cote} : ${window.titre}`), portes: closed.gates }));
check('Form+ propose de fermer l\'ancienne porte avant tout le reste (fenêtre du kit)', gateWindows.length > 0 && gateWindows[0].cote === 'Form+' && /FormPlus_Formulaires/.test(gateWindows[0].texte), gateWindows[0]);
check('la section est dépubliée, jamais supprimée', closed.gates.length === 1 && closed.gates[0].id === gateId && !closed.gates[0].publiee, closed.gates);
check('le courtier ne refuse rien à la fermeture, et GFS n\'ouvre aucune fenêtre pour elle (rien de plus n\'est ouvert)', refusals.length === 0 && !gateWindows.slice(0, 1).some(window => window.cote === 'GFS'), refusals);
check('le troisième formulaire est enregistré à la suite : trois lignes, chacune avec sa petite table', closed.rows.length === 3 && closed.rows.every(row => row.pub && row.pub.sienne), closed.rows.length);

// ----- 5. Le type « Formulaire » dans l'explorateur.
say('semis des formulaires :', JSON.stringify(await seedForms(host)));
await host.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const explorer = await lab.gfsFrame(/access=full/);
await lab.gfsReady(explorer);
await page.waitForTimeout(800);
await lab.fitPanel(explorer, 700, 400);
const rows = await explorer.locator('.ls-row').evaluateAll(list => list.map(row => ({
  nom: row.querySelector('.t')?.textContent, type: row.querySelector('.pill')?.textContent, icone: row.querySelector('.nm use')?.getAttribute('href'), famille: row.getAttribute('data-fam'),
})));
say('lignes de l\'explorateur :', JSON.stringify(rows));
await lab.shotPanel(run, '4-explorateur', explorer);
const forms = rows.filter(row => row.icone === '#i-form');
check('les formulaires de Form+ sont dans l\'explorateur, avec l\'icône « formulaire » : les trois qu\'elle a enregistrés et les trois semés', forms.length === 6, forms);
check('leur type s\'écrit « Formulaire » / « Form » dans la langue de la personne', forms.every(row => row.type === (lang === 'fr' ? 'Formulaire' : 'Form')), forms.map(row => row.type));
check('sans couleur de famille (la couleur est réservée au document, à la grille et à la présentation)', forms.every(row => !row.famille), forms.map(row => row.famille));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().click();
say('barre d\'information :', (await explorer.locator('.inf').innerText()).replace(/\s+/g, ' '));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().dblclick();
await page.waitForTimeout(800);
say('après le double-clic :', JSON.stringify({ cadres: page.frames().filter(frame => FORM_URL.test(frame.url())).length, panneau: (await explorer.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 220) }));
await lab.shotPanel(run, '5-double-clic', explorer);
// Le bouton « Changer de formulaire source » est dans son propre paragraphe depuis la 012 (point 3) : `translateDom` du kit ne le remplace plus par du texte.
const opened = await lab.appFrame(FORM_URL);
await opened.locator('#editor:not(.hidden)').waitFor({ timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await opened.locator('[data-etab="settings"]').click().catch(() => {});
await page.waitForTimeout(500);
const sourceButtons = await opened.locator('#change-source-btn').count();
check('« Changer de formulaire source » reste dans la page de Form+ une fois la traduction appliquée (012, point 3)', sourceButtons > 0, { boutons: sourceButtons });
check('aucun refus du courtier depuis l\'explorateur', refusals.length === 0, refusals);
check('aucune erreur de script dans l\'app pendant tout l\'essai', errors.length === 0, errors);
await lab.browser.close();
