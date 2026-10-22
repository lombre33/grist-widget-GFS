// Form+ (non modifiée, référencée à c249c4a) dans GFS, dans un vrai Grist (consignes 007 et 008) : à la vraie souris et au vrai clavier, à 700 × 400.
//   1. L'app s'ouvre dans le sous-cadre isolé, sans refus du courtier ni erreur de script.
//   2. Ce que le courtier refuse aux deux écritures de définition d'avant la 007 (`options` de la section, lecture de `_grist_Shares`) et ce que devient `setOptions` : mesuré
//      depuis le cadre de l'app, avec les appels de `39e0740` (Form+ ne les fait plus) ; rien n'est écrit (le courtier refuse avant Grist).
//      Puis les pièces jointes (cc21a27) : la liste se lit, le jeton passe, l'écriture reste refusée (accord du porteur, 22/10).
//   3. « Partir de zéro » passe avec le manifeste de Form+ (table, section de formulaire) ; Grist recharge alors le cadre de GFS, et le retrait du champ automatique est perdu.
//   4. Enregistrer un formulaire par son lien (007 et 008). D'abord le formulaire natif sur la page du WIDGET (celui de « Partir de zéro », posé en 3) : l'accord de la personne, la table
//      `FormPlus_Formulaires`, puis Grist reconstruit le cadre de GFS avant que la ligne soit écrite (la personne recommence : une copie de plus). Même geste sans GFS : `run-form-seul`.
//      Ensuite le formulaire natif sur SA page : aucune section de garde, aucun cadre reconstruit, une ligne qui gère la copie, le champ caché `FormPlusDef` ; le même lien deux fois ne copie
//      rien de plus ; un second formulaire a sa ligne. Puis le mode interne (la colonne d'essai qui lit `user.Email` : la capacité `formules` du manifeste).
//   5. Le type « Formulaire » dans l'explorateur, quand `FormPlus_Formulaires` a des lignes.
// Un CONSTAT dit ce que l'app fait en deçà de sa consigne, sans faire échouer l'essai (consigne 012 de GFS à Form+).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_LIVE=1 pour jouer le site en ligne de l'app au lieu de sa copie.
import { startLab } from './lab-setup.mjs';
import { seedForms } from './seed.mjs';
import { savedForms, saveByLink, pasteLink, ownPageForm } from './form-lab.mjs';
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
const constat = (label, ok, detail) => (ok ? say('OK    ', label) : say('CONSTAT', label, detail));
page.on('pageerror', error => errors.push(error.message));

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

// ----- 3. « Partir de zéro » : la table et la section de formulaire.
await app.locator('[data-startgo="scratch"]').click();
await page.waitForTimeout(500);
await lab.shotPanel(run, '2-partir-de-zero');
await app.locator('#scratchCreate').click();
await page.waitForTimeout(6000);
check('« Partir de zéro » : le courtier ne refuse rien (AddTable, CreateViewSection)', refusals.length === 0, refusals);
const frames = page.frames().filter(frame => /\/prototype\//.test(frame.url()) && !/\/labo\//.test(frame.url()));
check('Grist a rechargé le cadre de GFS (une section de plus sur la page) : plus de cadre d\'app', frames.every(frame => !FORM_URL.test(frame.url())), frames.map(frame => frame.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '')));
const reloaded = await lab.gfsFrame(/access=full/);
await lab.gfsReady(reloaded);
await lab.shot(run, '3-apres-creer-page');
const created = await documentState(reloaded);
const formSection = created.sections.find(section => section.kind === 'form');
say('document après :', JSON.stringify({ tables: created.tables, formSection: formSection && { id: formSection.id, page: formSection.page }, gfsSection: gfsSection.id }));
check('la table des réponses est créée (« Reponses » / « Responses », Grist en retire l\'accent)', created.tables.filter(name => !before.tables.includes(name)).length === 1, created.tables);
check('une section de formulaire est posée sur la page de GFS', Boolean(formSection) && formSection.page === gfsSection.page, formSection);
// Grist recharge le cadre dès que la section est posée : le retrait du champ que Grist ajoute tout seul, que Form+ fait ensuite, ne passe pas. Même résultat sans GFS (`run-form-seul`).
say('champs restés dans la section de formulaire :', created.fields.filter(field => formSection && field.section === formSection.id).length);
check('GFS repart de zéro : l\'explorateur, plus d\'app', await reloaded.locator('.ex-title-row').count() > 0);

// ----- 4. Enregistrer un formulaire (consignes 007 et 008).
// 4a. Le formulaire natif sur la page du WIDGET : celui de « Partir de zéro » (posé en 3 sur la page de GFS), ou celui d'une personne qui met le widget à côté. Form+ demande l'accord de la
// personne et crée la table, puis pose la copie sur cette même page : Grist reconstruit aussitôt le cadre de GFS, avant que la ligne soit écrite.
refusals.length = 0;
const formsBefore = (await savedForms(reloaded)).forms;
const formOne = await lab.openApp('form', FORM_URL, reloaded);
const asked = await saveByLink(page, formOne, formSection.id, () => lab.shotPanel(run, '4-accord', reloaded));
await page.waitForTimeout(7000);
const rebuilt = await lab.gfsFrame(/access=full/);
await lab.gfsReady(rebuilt);
const sameOnce = await savedForms(rebuilt);
say('même page que le widget, premier essai :', JSON.stringify({ asked, gfsReconstruit: reloaded.isDetached(), appPartie: formOne.isDetached(), ...sameOnce, formulairesAvant: formsBefore }));
check('Form+ demande l\'accord de la personne avant de créer sa table (fenêtre du kit)', /FormPlus_Formulaires/.test(asked || ''), asked);
check('« Créer la table » : `FormPlus_Formulaires` est créée, sans section de garde (008, point 3 : retirée)', sameOnce.table && sameOnce.gates.length === 0, sameOnce);
check('Grist reconstruit aussitôt le cadre de GFS : le cadre de Form+ disparaît avant la suite', reloaded.isDetached() && formOne.isDetached(), { gfs: reloaded.isDetached(), app: formOne.isDetached() });
check('la suite est perdue : la copie est posée sur la page du widget, aucune ligne n\'est écrite pour ce formulaire', sameOnce.rows.length === 0 && sameOnce.forms === formsBefore + 1, { lignes: sameOnce.rows.length, formulaires: sameOnce.forms });
check('aucun refus du courtier pendant cet essai : rien de cela ne vient de GFS', refusals.length === 0, refusals);
// La personne recommence (rien n'est enregistré, Form+ repart de son écran de départ) : encore une copie de plus, sans accord à redonner, toujours pas de ligne.
const formTwo = await lab.openApp('form', FORM_URL, rebuilt);
const askedAgain = await saveByLink(page, formTwo, formSection.id);
await page.waitForTimeout(7000);
const afterSame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(afterSame);
const sameTwice = await savedForms(afterSame);
say('même page que le widget, second essai :', JSON.stringify({ asked: askedAgain, ...sameTwice }));
check('au second essai : la table existe, aucune question ; encore une copie de plus sur la page du widget, toujours aucune ligne', !askedAgain && sameTwice.rows.length === 0 && sameTwice.forms === sameOnce.forms + 1, { question: askedAgain, lignes: sameTwice.rows.length, formulaires: sameTwice.forms });
check('aucun refus du courtier pendant ces essais', refusals.length === 0, refusals);

// 4b. Le formulaire natif sur SA page (une page à part, que n'occupe aucun widget) : le cas des personnes qui le posent dans leur document. Tout passe.
refusals.length = 0;
const own = await ownPageForm(afterSame);
const ownApp = await lab.openApp('form', FORM_URL, afterSame);
await saveByLink(page, ownApp, own.sectionRef);
await page.waitForTimeout(6000);
const first = await savedForms(afterSame);
say('premier enregistrement, page propre :', JSON.stringify(first));
await lab.shotPanel(run, '4-apres-enregistrer', afterSame);
check('aucune section de garde n\'est posée pour cette table', first.gates.length === 0, first.gates);
check('le cadre de GFS et celui de Form+ restent : le formulaire est sur sa page, pas sur celle du widget', !afterSame.isDetached() && !ownApp.isDetached(), { gfs: afterSame.isDetached(), app: ownApp.isDetached() });
check('une seule ligne, celle de ce formulaire : sa copie gérée (`Definition.vsId`), pas le formulaire d\'origine', first.rows.length === 1 && Number.isInteger(first.rows[0].vsId) && first.rows[0].vsId !== own.sectionRef, first.rows);
check('la copie porte le champ caché `FormPlusDef` : une Référence vers `FormPlus_Formulaires` qui affiche `Definition` (008, point 3)', Boolean(first.def) && first.def.type === 'Ref:FormPlus_Formulaires' && first.def.affiche === 'Definition' && first.rows[0].cache, { def: first.def, ligne: first.rows[0] });
check('aucun refus du courtier pendant l\'enregistrement', refusals.length === 0, refusals);

// Le même lien une seconde fois, puis un second formulaire sur sa propre page.
await ownApp.locator('#generate').click();
await page.waitForTimeout(4000);
const again = await savedForms(afterSame);
check('le même lien une seconde fois : aucune copie de plus, aucune ligne de plus', again.forms === first.forms && again.rows.length === 1, { formulaires: again.forms, lignes: again.rows.length });
const own2 = await ownPageForm(afterSame);
await pasteLink(page, ownApp, own2.sectionRef);
await page.waitForTimeout(5000);
const second = await savedForms(afterSame);
check('un second formulaire a sa propre ligne et sa propre copie', second.rows.length === 2 && second.rows[0].vsId !== second.rows[1].vsId, second.rows);
// Le second formulaire natif est posé APRÈS la colonne `FormPlusDef` : Grist en fait un champ du formulaire d'origine, donc de la copie, et Form+ ne cache que le champ qu'elle ajoute.
constat('la copie du second formulaire cache aussi son champ `FormPlusDef` (008, point 3)', second.rows.every(row => row.cache), second.rows.map(row => row.champ));
check('aucun refus du courtier pour le second formulaire', refusals.length === 0, refusals);

// 4c. Le mode interne (Form+ à 02be13c) : la table `FormPlus_Repondants` et sa colonne d'essai, dont la formule lit `user.Email`. Sans la capacité `formules` du manifeste, le courtier refuse
// la colonne (« Une colonne à formule demande la capacité « formules » », mesuré à c249c4a avant la déclaration).
await ownApp.locator('[data-etab="settings"]').click();
await page.waitForTimeout(500);
refusals.length = 0;
const consent = ownApp.locator('#pp-dialog-message').waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
await ownApp.locator('label:has(#opt-internal-mode) .toggle-track').click();
const askedInternal = await consent;
if (askedInternal) await ownApp.getByRole('button', { name: /Créer|Create/ }).first().click();
await page.waitForTimeout(3000);
const internal = await ownApp.evaluate(() => ({ coche: document.getElementById('opt-internal-mode').checked, message: document.getElementById('internal-mode-msg').textContent.replace(/\s+/g, ' ').trim() }));
const probe = await afterSame.evaluate(async () => {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const ref = tables.id[tables.tableId.indexOf('FormPlus_Repondants')];
  const at = ref ? columns.parentId.findIndex((parent, i) => parent === ref && columns.colId[i] === 'Email') : -1;
  return { table: Boolean(ref), colonne: at < 0 ? null : { type: columns.type[at], formule: columns.formula[at], declenchee: !columns.isFormula[at], recalcWhen: columns.recalcWhen[at] } };
});
say('mode interne :', JSON.stringify({ ...internal, ...probe, accord: askedInternal }));
check('le mode interne s\'active : la case reste cochée, sans message d\'erreur', internal.coche && !/Impossible|refus/i.test(internal.message), internal);
check('`FormPlus_Repondants` est créée avec sa colonne `Email` à formule déclenchée `user.Email` (la capacité `formules` du manifeste)', probe.table && probe.colonne && probe.colonne.formule === 'user.Email' && probe.colonne.declenchee, probe);
check('le courtier ne refuse rien au mode interne', refusals.length === 0, refusals);
// L'accord de la personne avant de créer une table (guide, règle 4) : l'activation du mode interne la crée sans fenêtre.
constat('Form+ demande l\'accord avant de créer `FormPlus_Repondants` (guide, règle 4)', askedInternal, 'la table se crée à l\'activation, sans fenêtre');

// ----- 5. Le type « Formulaire » dans l'explorateur.
say('semis des formulaires :', JSON.stringify(await seedForms(afterSame)));
await afterSame.evaluate(() => location.reload());
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
check('les formulaires de Form+ sont dans l\'explorateur, avec l\'icône « formulaire » : les deux qu\'elle a enregistrés et les trois semés', forms.length === 5, forms);
check('leur type s\'écrit « Formulaire » / « Form » dans la langue de la personne', forms.every(row => row.type === (lang === 'fr' ? 'Formulaire' : 'Form')), forms.map(row => row.type));
check('sans couleur de famille (la couleur est réservée au document, à la grille et à la présentation)', forms.every(row => !row.famille), forms.map(row => row.famille));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().click();
say('barre d\'information :', (await explorer.locator('.inf').innerText()).replace(/\s+/g, ' '));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().dblclick();
await page.waitForTimeout(800);
say('après le double-clic :', JSON.stringify({ cadres: page.frames().filter(frame => FORM_URL.test(frame.url())).length, panneau: (await explorer.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 220) }));
await lab.shotPanel(run, '5-double-clic', explorer);
// Le bouton « Changer de formulaire source » est dans un paragraphe traduit (`data-i18n`) : `translateDom` du kit remplace tout son contenu par du texte, le bouton disparaît.
const opened = await lab.appFrame(FORM_URL);
await opened.locator('#editor:not(.hidden)').waitFor({ timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
constat('« Changer de formulaire source » reste dans la page de Form+ une fois la traduction appliquée', await opened.locator('#change-source-btn').count() > 0, 'le bouton est absent : il est dans un <p data-i18n>, que translateDom remplace par du texte');
check('aucun refus du courtier depuis l\'explorateur', refusals.length === 0, refusals);
await lab.browser.close();
